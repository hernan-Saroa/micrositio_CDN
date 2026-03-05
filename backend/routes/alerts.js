/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ALERTAS DAI — Server-Sent Events (SSE) Endpoint           ║
 * ║  Real-time alert push to all connected clients              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Provides:
 *  • GET /api/alerts/stream  — SSE stream (new_alert, alert_update, heartbeat)
 *  • Simulated alert generator (every 15-30 s) for demo/dev
 *  • When a real DB is connected, replace the simulator with DB triggers
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');

// Ensure query function is available
const query = db.query;
if (typeof query !== 'function') {
    console.error('[Alerts] ERROR: Database query function is not available. db exports:', Object.keys(db));
}

// ── Elasticsearch Configuration ───────────────────────────────────────
const elasticConfig = {
    baseURL: process.env.ELASTIC_URL,
    auth: process.env.ELASTIC_USER && (process.env.ELASTIC_PASS || process.env.ELASTIC_PASSWORD) ? {
        username: process.env.ELASTIC_USER,
        password: process.env.ELASTIC_PASS || process.env.ELASTIC_PASSWORD
    } : undefined,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
};

const ELASTIC_INDEX = 'neural.dai.output-*';
let _seqCounterElastic = 0; // Sequential counter for alerts from Elastic

// Helper to make requests to Elasticsearch
async function elasticRequest(method, path, data = null) {
    try {
        const config = {
            method,
            url: path,
            ...elasticConfig
        };
        if (data && (method === 'POST' || method === 'PUT')) {
            config.data = data;
        }
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`[Elastic] Error ${method} ${path}:`, error.message);
        throw error;
    }
}

// ── In-memory cache for severity configuration ────────────────────────
let _severityMap = null; // { "Tipo de alerta": "critica" | "alta" | "media" | "baja" }

async function getSeverityMap() {
    if (_severityMap) return _severityMap;
    try {
        const res = await query("SELECT config_value FROM system_config WHERE config_key = 'dai_severity_map'");
        const row = (res.rows || res)[0];
        if (row && row.config_value) {
            _severityMap = typeof row.config_value === 'string' ? JSON.parse(row.config_value) : row.config_value;
        }
    } catch (e) {
        console.warn('[Severity] Could not load map from DB:', e.message);
    }
    return _severityMap || {};
}

// ── In-memory store for alert metadata (locks, assignments) ───────────
// This replaces the SQLite dai_alerts table for dynamic operation
const alertMetadata = new Map(); // Key: alertId, Value: { locked_by, locked_at, assigned_to, history, notes, attachments }

// ── GET /api/alerts — Listar alertas (REST) desde Elasticsearch ────────
router.get('/', async (req, res) => {
    try {
        // Get period from query params (today, week, month, or default today)
        const period = req.query.period || 'today';
        
        // Fetch fresh alerts from Elasticsearch (limited to 100 for display)
        const elasticAlerts = await fetchAlertsFromElasticForDisplay(period);
        
        // Get total count separately (for accurate totals)
        const totalCount = await countAlertsFromElastic(period);
        
        // Merge with in-memory metadata (locks, assignments)
        const enrichedAlerts = elasticAlerts.map(alert => {
            const meta = alertMetadata.get(alert.id);
            if (meta) {
                return {
                    ...alert,
                    locked_by: meta.locked_by || null,
                    locked_by_name: meta.locked_by_name || null,
                    assignedTo: meta.assigned_to_name || meta.assigned_to || null,
                    assignedToId: meta.assigned_to || null,
                    history: meta.history || alert.history,
                    notes: meta.notes || [],
                    attachments: meta.attachments || []
                };
            }
            return alert;
        });
        
        res.json({
            success: true,
            alerts: enrichedAlerts,
            totalCount: totalCount,           // ← Total real en Elastic (puede ser > 100)
            displayedCount: enrichedAlerts.length,  // ← Cantidad mostrada (máx 100)
            timestamp: new Date().toISOString(),
            source: 'elasticsearch'
        });
    } catch (err) {
        console.error('[Alerts] Error fetching from Elastic:', err);
        res.status(500).json({
            error: 'Error al consultar alertas',
            details: err.message,
            alerts: []
        });
    }
});

// ── GET /api/alerts/severity-config — Obtener mapa de severidades ───────
router.get('/severity-config', authenticateToken, async (req, res) => {
    try {
        _severityMap = null; // force refresh
        const map = await getSeverityMap();
        res.json({ success: true, severityMap: map });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener configuración de severidades' });
    }
});

// ── PUT /api/alerts/severity-config — Guardar mapa de severidades ───────
router.put('/severity-config', authenticateToken, async (req, res) => {
    const { severityMap } = req.body;
    if (!severityMap || typeof severityMap !== 'object') {
        return res.status(400).json({ error: 'severityMap requerido (objeto)' });
    }

    const VALID_SEVS = ['critica', 'alta', 'media', 'baja'];
    for (const [tipo, sev] of Object.entries(severityMap)) {
        if (!VALID_SEVS.includes(sev)) {
            return res.status(400).json({ error: `Severidad inválida '${sev}' para tipo '${tipo}'` });
        }
    }

    try {
        const value = JSON.stringify(severityMap);
        const existing = await query("SELECT id FROM system_config WHERE config_key = 'dai_severity_map'");
        if ((existing.rows || existing).length > 0) {
            await query(
                "UPDATE system_config SET config_value = $1, updated_at = datetime('now'), updated_by = $2 WHERE config_key = 'dai_severity_map'",
                [value, req.user.id]
            );
        } else {
            await query(
                "INSERT INTO system_config (config_key, config_value, description, updated_by) VALUES ('dai_severity_map', $1, 'Mapa de severidades por tipo de alerta DAI', $2)",
                [value, req.user.id]
            );
        }
        _severityMap = severityMap; // update cache immediately

        // Audit log
        try {
            await query(
                `INSERT INTO audit_logs (user_id, action, resource_type, new_values, ip_address, user_agent, status)
                 VALUES ($1, 'update_config', 'dai_severity_map', $2, $3, $4, 'success')`,
                [req.user.id, value, req.ip, req.get('User-Agent')]
            );
        } catch (_) { /* audit non-critical */ }

        res.json({ success: true, message: 'Configuración de severidades guardada' });
    } catch (err) {
        console.error('Error saving severity config:', err);
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

// ── POST /api/alerts/:id/lock — Bloquear alerta para edición ─────────────
router.post('/:id/lock', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userName = req.user.name;

    try {
        // Verificar si ya está bloqueada por otro (en memoria)
        const meta = alertMetadata.get(id);
        
        if (meta && meta.locked_by && meta.locked_by !== userId) {
            // Si el bloqueo tiene más de 5 minutos, permitir sobreescribir
            const lockTime = new Date(meta.locked_at).getTime();
            if (Date.now() - lockTime < 5 * 60 * 1000) {
                return res.status(409).json({ error: 'Alerta bloqueada por otro usuario' });
            }
        }

        // Guardar en memoria
        if (!alertMetadata.has(id)) {
            alertMetadata.set(id, {});
        }
        const alertMeta = alertMetadata.get(id);
        alertMeta.locked_by = userId;
        alertMeta.locked_by_name = userName;
        alertMeta.locked_at = new Date().toISOString();

        broadcast('alert_locked', { id, locked_by: userId, locked_by_name: userName });
        res.json({ success: true, message: 'Alerta bloqueada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al bloquear alerta' });
    }
});

// ── POST /api/alerts/:id/unlock — Desbloquear alerta ────────────────────
router.post('/:id/unlock', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const meta = alertMetadata.get(id);

        if (meta && meta.locked_by && meta.locked_by !== userId) {
            // Solo el dueño del bloqueo o un admin puede desbloquear
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para desbloquear esta alerta' });
            }
        }

        // Actualizar en memoria
        if (meta) {
            meta.locked_by = null;
            meta.locked_by_name = null;
            meta.locked_at = null;
        }

        broadcast('alert_unlocked', { id });
        res.json({ success: true, message: 'Alerta desbloqueada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al desbloquear alerta' });
    }
});

// ── POST /api/alerts/:id/assign — Asignar alerta a usuario ───────────────
router.post('/:id/assign', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { userId, userName } = req.body; // Usuario al que se asigna

    if (!userId) return res.status(400).json({ error: 'ID de usuario requerido' });

    try {
        // Obtener o crear metadata en memoria
        if (!alertMetadata.has(id)) {
            alertMetadata.set(id, { history: [] });
        }
        const meta = alertMetadata.get(id);
        
        // Actualizar asignación
        meta.assigned_to = userId;
        meta.assigned_to_name = userName;
        
        // Agregar al historial
        if (!meta.history) meta.history = [];
        const historyEntry = {
            ts: new Date().toISOString(),
            type: 'assigned',
            icon: 'person_add',
            color: '#10b981',
            text: `Alerta asignada a ${userName || userId}`,
            user: req.user.name
        };
        meta.history.push(historyEntry);

        broadcast('alert_updated', {
            id,
            assigned_to: userId,
            assigned_to_name: userName,
            history_latest: historyEntry
        });

        res.json({ success: true, message: 'Alerta asignada correctamente' });
    } catch (err) {
        console.error('Error assigning alert:', err);
        res.status(500).json({ error: 'Error al asignar alerta' });
    }
});

// ── DAI catalogue (mirrors frontend dai-module.js) ────────────────────
const DAI_TIPOS = [
    'Abandono de vehículo', 'Acc. vehículo con lesionados', 'Acc. vehículo con fallecidos',
    'Acc. vehículo sin lesionados', 'Alta densidad vehicular', 'Animal en calzada',
    'Congestión vehicular', 'Conducción en sentido contrario', 'Derrumbe / Deslizamiento',
    'Desplazamiento irregular', 'Exceso de velocidad', 'Falla en dispositivo DAI',
    'Falla en sensor WIM', 'Incendio vehicular', 'Mercancía en vía',
    'Objeto caído en calzada', 'Parada de emergencia', 'Peatón en calzada',
    'Pérdida de carga', 'Semáforo no operativo', 'Vehículo averiado',
    'Vehículo lento en tráfico fluido', 'Vehículo sobredimensionado',
    'Violación pesaje control', 'Zona de obras — tráfico lento',
];

const DAI_DEPTOS = {
    'Antioquia': { tramos: ['44-44-2', '44-44-5', '44-60-1'], center: [-75.58, 6.24] },
    'Boyacá': { tramos: ['50-50-6', '52-20-3'], center: [-73.62, 5.54] },
    'Cundinamarca': { tramos: ['55-55-14', '55-30-8'], center: [-74.15, 4.67] },
    'Huila': { tramos: ['38-38-17', '38-55-2'], center: [-75.53, 2.93] },
    'Norte de Santander': { tramos: ['6-6-22', '6-15-4'], center: [-72.51, 7.89] },
    'Quindío': { tramos: ['24-24-24', '24-12-9'], center: [-75.70, 4.43] },
    'Valle Del Cauca': { tramos: ['63-63-30', '63-44-1'], center: [-76.52, 3.45] },
};
const DEP_NAMES = Object.keys(DAI_DEPTOS);
const SEV_LEVELS = ['critica', 'alta', 'media', 'baja'];
const ESTADOS = ['creado', 'activa'];

// ── Helpers ───────────────────────────────────────────────────────────
const _p = n => String(n).padStart(2, '0');
const _pick = arr => arr[Math.floor(Math.random() * arr.length)];
let _seqCounter = 500; // start above the initial 487

function _rc(c) {
    return [
        (c[0] + (Math.random() - .5) * 1.8).toFixed(7),
        (c[1] + (Math.random() - .5) * 1.8).toFixed(7)
    ];
}

function _gid() {
    const d = new Date();
    _seqCounter++;
    return `DAI-${d.getFullYear()}${_p(d.getMonth() + 1)}${_p(d.getDate())}-${String(_seqCounter).padStart(4, '0')}`;
}

// ── Map Elastic description to DAI alert type ─────────────────────────
function mapElasticTypeToDai(description) {
    if (!description) return 'Alta densidad vehicular';
    const desc = description.toUpperCase();
    
    const typeMap = {
        'WRONG WAY DETECTION': 'Conducción en sentido contrario',
        'WRONG WAY': 'Conducción en sentido contrario',
        'SPEED': 'Exceso de velocidad',
        'STOPPED VEHICLE': 'Vehículo averiado',
        'CONGESTION': 'Congestión vehicular',
        'HIGH DENSITY': 'Alta densidad vehicular',
        'ACCIDENT': 'Acc. vehículo sin lesionados',
        'CRASH': 'Acc. vehículo con lesionados',
        'FIRE': 'Incendio vehicular',
        'SMOKE': 'Incendio vehicular',
        'PEDESTRIAN': 'Peatón en calzada',
        'ANIMAL': 'Animal en calzada',
        'OBJECT': 'Objeto caído en calzada',
        'SPILL': 'Pérdida de carga',
        'CARGO': 'Mercancía en vía'
    };
    
    for (const [key, value] of Object.entries(typeMap)) {
        if (desc.includes(key)) return value;
    }
    return 'Alta densidad vehicular';
}

// ── Infer device type from camera_id or description ───────────────────
function inferDeviceType(cameraId, desc) {
    if (!cameraId && !desc) return 'VID';
    const text = (cameraId + ' ' + desc).toUpperCase();
    if (text.includes('WIM')) return 'WIM';
    if (text.includes('RAD') || text.includes('RADAR')) return 'RAD';
    if (text.includes('CNT') || text.includes('COUNT')) return 'CNT';
    return 'VID';
}

// ── Calculate severity based on alert type ────────────────────────────
function calculateSeverityFromType(tipo) {
    const severityMap = {
        'Acc. vehículo con fallecidos': 'critica',
        'Acc. vehículo con lesionados': 'critica',
        'Incendio vehicular': 'critica',
        'Conducción en sentido contrario': 'alta',
        'Exceso de velocidad': 'alta',
        'Acc. vehículo sin lesionados': 'alta',
        'Congestión vehicular': 'media',
        'Vehículo averiado': 'media',
        'Peatón en calzada': 'media',
        'Alta densidad vehicular': 'baja',
        'Animal en calzada': 'baja'
    };
    return severityMap[tipo] || 'media';
}

// ── Transform Elastic document to DAI alert format ────────────────────
function transformElasticToAlert(source) {
    _seqCounterElastic++;
    
    // Extract fields from Elastic _source
    const elasticId = source.id || `elastic-${_seqCounterElastic}`;
    
    // 📝 Imprimir ID de Elasticsearch para poder buscarlo después
    console.log(`[Elastic → DAI] ID Elastic: ${elasticId} → ID DAI: ALT-${new Date().getFullYear()}-${elasticId.split('-').pop()}`);
    const timestamp = source['@timestamp'] || new Date().toISOString();
    const loadDate = source.loadDate || timestamp;
    const payload = source.payload || {};
    const catalog = source.catalog || {};
    
    // Map fields according to user specification
    const tipo = mapElasticTypeToDai(payload.description);
    const sev = calculateSeverityFromType(tipo);
    
    // Build alert ID: "77-171380" → "ALT-2025-171380"
    const idParts = elasticId.split('-');
    const alertId = idParts.length >= 2 
        ? `ALT-${new Date().getFullYear()}-${idParts[idParts.length - 1]}`
        : `ALT-${new Date().getFullYear()}-${_seqCounterElastic}`;
    
    // Calculate latency
    const t_captura = new Date(timestamp);
    const t_plataforma = new Date(loadDate);
    const latencia_ms = t_plataforma.getTime() - t_captura.getTime();
    
    // Build station name from postDesc + stretchDesc
    const estacion = catalog.postDesc && catalog.stretchDesc 
        ? `${catalog.postDesc} - ${catalog.stretchDesc}`
        : catalog.stretchDesc || 'Estación desconocida';
    
    // Infer device type
    const dTipo = inferDeviceType(payload.camera_id, catalog.desc);
    
    // Build evidence object
    const evidencia = payload.video_path ? {
        hasVideo: true,
        videoUrl: payload.video_path,
        duration: null, // Would need to extract from video metadata
        fileSize: null,
        cameraAngle: payload.camera_id || 'Frontal',
        resolution: null,
        fps: null
    } : null;
    
    const alertData = {
        id: alertId,
        seq: _seqCounterElastic,
        tipo_registro: 'Automático',
        tipo,
        sev,
        estado: 'activa', // Only native alerts have estado
        dep: catalog.stateDesc || 'Desconocido',
        tramo: catalog.subStretchDesc || 'N/A',
        codigo_via: catalog.stretchId ? String(catalog.stretchId) : 'N/A',
        poste_ref: catalog.postDistance ? String(catalog.postDistance) : 'N/A',
        disp: catalog.desc || 'INV-DAI-UNKNOWN',
        dTipo,
        lng: catalog.lng || 0,
        lat: catalog.lat || 0,
        fecha: t_plataforma.toISOString(),
        fecha_ts: t_plataforma.getTime(),
        t_captura: t_captura.toISOString(),
        t_plataforma: t_plataforma.toISOString(),
        latencia_ms: Math.max(0, latencia_ms),
        t_respuesta: null,
        t_resolucion: null,
        evidencia,
        assignedTo: null,
        locked_by: null,
        locked_by_name: null,
        attachments: [],
        notes: [],
        estacion, // Additional field for UI
        history: [{
            ts: t_plataforma.toISOString(),
            type: 'created',
            icon: 'add_circle',
            color: '#6366f1',
            text: `Alerta creada (Automático desde Elastic)`,
            user: 'Sistema DAI'
        }],
        // Store raw Elastic data for reference
        _elasticSource: {
            id: source.id,
            camera_id: payload.camera_id,
            description: payload.description
        }
    };
    
    return alertData;
}

// ── Generate a single synthetic alert ─────────────────────────────────
async function generateOneAlert() {
    const dep = _pick(DEP_NAMES);
    const info = DAI_DEPTOS[dep];
    const tramo = _pick(info.tramos);
    const tipo = _pick(DAI_TIPOS);
    // Use configured severity map; fall back to weighted random if not configured
    const _map = await getSeverityMap();
    let sev;
    if (_map && _map[tipo]) {
        sev = _map[tipo];
    } else {
        const sevRoll = Math.random();
        sev = sevRoll < 0.25 ? 'critica' : sevRoll < 0.50 ? 'alta' : sevRoll < 0.75 ? 'media' : 'baja';
    }
    const est = _pick(ESTADOS);
    const [lng, lat] = _rc(info.center);
    const fecha = new Date();
    const devN = 100 + Math.floor(Math.random() * 300);
    const devS = Math.random().toString(36).slice(2, 8).toUpperCase();
    const dTipo = _pick(['WIM', 'RAD', 'CNT', 'VID']);
    const am = Math.random() > 0.25 ? 'Automático' : 'Manual';

    // Latency simulation
    const _r = Math.random();
    let _latMs;
    if (_r < 0.30) _latMs = 1000 + Math.floor(Math.random() * 4000);
    else if (_r < 0.55) _latMs = 5000 + Math.floor(Math.random() * 5000);
    else if (_r < 0.75) _latMs = 10000 + Math.floor(Math.random() * 5000);
    else if (_r < 0.88) _latMs = 15000 + Math.floor(Math.random() * 5000);
    else if (_r < 0.95) _latMs = 20000 + Math.floor(Math.random() * 10000);
    else _latMs = 30000 + Math.floor(Math.random() * 15000);

    const t_plataforma = new Date(fecha.getTime());
    const t_captura = new Date(t_plataforma.getTime() - _latMs);

    const alertId = _gid();

    const alertData = {
        id: alertId,
        seq: _seqCounter,
        tipo_registro: am,
        tipo,
        sev,
        estado: est,
        dep,
        tramo,
        codigo_via: `${_p(Math.floor(Math.random() * 99))}-${_p(Math.floor(Math.random() * 99))}`,
        poste_ref: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9) + 1}`,
        disp: `INV-DAI-${devN}-${devS}`,
        dTipo,
        lng,
        lat,
        fecha: fecha.toISOString(),
        fecha_ts: fecha.getTime(),
        t_captura: t_captura.toISOString(),
        t_plataforma: t_plataforma.toISOString(),
        latencia_ms: _latMs,
        t_respuesta: null,
        t_resolucion: null,
        evidencia: Math.random() > 0.08 ? {
            hasVideo: true,
            duration: 12 + Math.floor(Math.random() * 33),
            fileSize: (1.2 + Math.random() * 4.8).toFixed(1) + ' MB',
            cameraAngle: _pick(['Frontal', 'Lateral izq.', 'Lateral der.', 'Cenital', 'Panorámica']),
            resolution: Math.random() > 0.3 ? '1080p' : '720p',
            fps: Math.random() > 0.5 ? 30 : 25,
        } : null,
        assignedTo: null,
        locked_by: null,
        locked_by_name: null,
        attachments: [],
        notes: [],
        history: [{
            ts: fecha.toISOString(),
            type: 'created',
            icon: 'add_circle',
            color: '#6366f1',
            text: `Alerta creada (${am})`,
            user: am === 'Automático' ? 'Sistema DAI' : 'Admin Principal'
        }],
    };

    // Alerta generada en memoria (sin persistencia en SQLite)
    // Las alertas reales vienen de Elasticsearch
    return alertData;
}

// ── SSE client management ─────────────────────────────────────────────
const clients = new Set();
// ── Cache de últimas alertas (se inicializa desde DB) ─────────────────
let alertsHistory = [];
const MAX_HISTORY = 50;

async function loadHistoryFromDB() {
    // Ahora carga dinámicamente desde Elasticsearch en lugar de SQLite
    try {
        alertsHistory = await fetchAlertsFromElasticForDisplay();
        console.log(`[SSE] Historial cargado desde Elastic: ${alertsHistory.length} alertas`);
    } catch (err) {
        console.error('Error cargando historial desde Elastic:', err);
        alertsHistory = [];
    }
}

// Cargar historial al iniciar
loadHistoryFromDB();

function broadcast(eventName, data) {
    // Mantener sincronizado el cache local
    if (eventName === 'new_alert') {
        alertsHistory.unshift(data);
        if (alertsHistory.length > MAX_HISTORY) alertsHistory.pop();
    } else if (['alert_locked', 'alert_unlocked', 'alert_updated'].includes(eventName)) {
        const alert = alertsHistory.find(a => a.id === data.id);
        if (alert) {
            if (eventName === 'alert_locked') {
                alert.locked_by = data.locked_by;
                alert.locked_by_name = data.locked_by_name;
            } else if (eventName === 'alert_unlocked') {
                alert.locked_by = null;
                alert.locked_by_name = null;
            } else if (eventName === 'alert_updated') {
                if (data.assigned_to) {
                    alert.assignedTo = data.assigned_to_name || data.assigned_to;
                }
                if (data.history_latest) {
                    alert.history.push(data.history_latest);
                }
            }
        }
    }

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
        try { res.write(payload); } catch (e) { clients.delete(res); }
    }
}

// ── REST endpoint to get current alerts (ya definido arriba con consulta dinámica a Elastic) ──

// ── SSE endpoint ──────────────────────────────────────────────────────
router.get('/stream', (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx compatibility
        'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({
        message: 'Conexión SSE establecida (Modo Dinámico - Elasticsearch)',
        timestamp: new Date().toISOString(),
        clientCount: clients.size + 1,
        mode: 'dynamic'
    })}\n\n`);

    // Register client
    clients.add(res);
    console.log(`[SSE] Cliente conectado. Total: ${clients.size}`);

    // Heartbeat every 30s to keep the connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(`event: heartbeat\ndata: ${JSON.stringify({
                timestamp: new Date().toISOString(),
                clients: clients.size
            })}\n\n`);
        } catch (e) {
            clearInterval(heartbeat);
            clients.delete(res);
        }
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
        console.log(`[SSE] Cliente desconectado. Total: ${clients.size}`);
    });
});

// ── NEW: Fetch alerts from Elasticsearch for display (Dynamic) ─────────
async function fetchAlertsFromElasticForDisplay(period = '24h') {
    // Skip if Elastic is not configured
    if (!elasticConfig.baseURL) {
        console.log('[Elastic] Not configured, returning empty array');
        return [];
    }

    try {
        // Calculate the date range based on period
        let startDate;
        const now = new Date();
        
        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '24h':
            default:
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
        }
        
        const startDateStr = startDate.toISOString();
        console.log(`[Elastic] Fetching alerts from last ${period} (from: ${startDateStr})`);
        
        const searchQuery = {
            size: 100,
            query: {
                bool: {
                    must: [
                        { range: { '@timestamp': { gte: startDateStr } } }
                    ]
                }
            },
            sort: [{ '@timestamp': 'desc' }]
        };

        const response = await elasticRequest('POST', `/${ELASTIC_INDEX}/_search`, searchQuery);
        
        if (!response.hits || !response.hits.hits) {
            return [];
        }

        // Transform Elastic hits to alert format
        const alerts = response.hits.hits.map(hit => transformElasticToAlert(hit._source));
        
        console.log(`[Elastic] Fetched ${alerts.length} alerts for display`);
        return alerts;
    } catch (err) {
        console.error('[Elastic] Error fetching alerts for display:', err.message);
        return [];
    }
}

// ── NEW: Count total alerts from Elasticsearch (for accurate totals) ────
async function countAlertsFromElastic(period = '24h') {
    // Skip if Elastic is not configured
    if (!elasticConfig.baseURL) {
        console.log('[Elastic Count] Not configured, returning 0');
        return 0;
    }

    try {
        // Calculate the date range based on period
        let startDate;
        const now = new Date();
        
        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '24h':
            default:
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
        }
        
        const startDateStr = startDate.toISOString();
        
        const countQuery = {
            query: {
                bool: {
                    must: [
                        { range: { '@timestamp': { gte: startDateStr } } }
                    ]
                }
            }
        };

        const response = await elasticRequest('POST', `/${ELASTIC_INDEX}/_count`, countQuery);
        
        const totalCount = response.count || 0;
        console.log(`[Elastic Count] Total alerts in last ${period}: ${totalCount}`);
        return totalCount;
    } catch (err) {
        console.error('[Elastic Count] Error counting alerts:', err.message);
        return 0;
    }
}

// ── Elasticsearch Alert Fetcher (for SSE/real-time updates) ────────────
// Fetch real alerts from Elasticsearch instead of generating synthetic ones
let _elasticTimer = null;
let _lastElasticCheck = new Date(Date.now() - 60000).toISOString(); // Start checking from 1 minute ago
let _knownAlertIds = new Set(); // Track already-seen alert IDs to avoid duplicates

async function fetchAlertsFromElastic() {
    // Skip if Elastic is not configured
    if (!elasticConfig.baseURL) {
        console.log('[Elastic] Not configured, skipping fetch');
        return [];
    }

    try {
        // Query for alerts from last 10 minutes (native alerts logic)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const searchQuery = {
            size: 100,
            query: {
                bool: {
                    must: [
                        { range: { '@timestamp': { gte: tenMinutesAgo } } }
                    ]
                }
            },
            sort: [{ '@timestamp': 'desc' }]
        };

        const response = await elasticRequest('POST', `/${ELASTIC_INDEX}/_search`, searchQuery);
        
        if (!response.hits || !response.hits.hits || response.hits.hits.length === 0) {
            return [];
        }

        const newAlerts = [];
        for (const hit of response.hits.hits) {
            const alertData = transformElasticToAlert(hit._source);
            
            // Check if alert was already seen (avoid duplicates in SSE)
            if (_knownAlertIds.has(alertData.id)) {
                continue; // Skip duplicate
            }
            
            // Track this alert as seen
            _knownAlertIds.add(alertData.id);
            
            // Keep set size manageable (keep last 1000 IDs)
            if (_knownAlertIds.size > 1000) {
                const iterator = _knownAlertIds.values();
                _knownAlertIds.delete(iterator.next().value);
            }
            
            newAlerts.push(alertData);
        }

        if (newAlerts.length > 0) {
            console.log(`[Elastic] Fetched ${newAlerts.length} new alerts from Elasticsearch`);
        }
        
        return newAlerts;
    } catch (err) {
        console.error('[Elastic] Error fetching from Elasticsearch:', err.message);
        return [];
    }
}

// ── Simulated alert generator (Fallback when Elastic is unavailable) ───
let _simTimer = null;
let _useElastic = true; // Flag to toggle between Elastic and simulator

function scheduleNextAlert() {
    const delay = 30000; // Check every 30 seconds
    
    _elasticTimer = setTimeout(async () => {
        if (clients.size > 0) {
            if (_useElastic && elasticConfig.baseURL) {
                // Try to fetch from Elastic
                const newAlerts = await fetchAlertsFromElastic();
                for (const alert of newAlerts) {
                    broadcast('new_alert', alert);
                    console.log(`[SSE] Nueva alerta desde Elastic: ${alert.id} (${alert.sev}) → ${alert.tipo} [${alert.dep}]`);
                }
            } else {
                // Fallback to simulator
                const alert = await generateOneAlert();
                broadcast('new_alert', alert);
                console.log(`[SSE] Nueva alerta (Simulada): ${alert.id} (${alert.sev}) → ${alert.tipo} [${alert.dep}]`);
            }
        }
        scheduleNextAlert();
    }, delay);
}

// Start the fetcher
scheduleNextAlert();
console.log(`[SSE] Alert fetcher iniciado - Modo: ${elasticConfig.baseURL ? 'Elasticsearch' : 'Simulador (Elastic no configurado)'}`);

// Manual trigger endpoint now uses Elastic if available
router.post('/trigger', async (req, res) => {
    try {
        if (_useElastic && elasticConfig.baseURL) {
            const newAlerts = await fetchAlertsFromElastic();
            if (newAlerts.length > 0) {
                for (const alert of newAlerts) {
                    broadcast('new_alert', alert);
                }
                res.json({ success: true, alerts: newAlerts, source: 'elastic' });
            } else {
                res.json({ success: true, alerts: [], message: 'No new alerts from Elastic' });
            }
        } else {
            const alert = await generateOneAlert();
            broadcast('new_alert', alert);
            res.json({ success: true, alert, source: 'simulated' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error fetching alerts', details: err.message });
    }
});

module.exports = router;
