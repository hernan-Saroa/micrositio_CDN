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
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/alerts — Listar alertas (REST) ───────────────────────────
router.get('/', async (req, res) => {
    // Si el cache está vacío, intentar cargar de nuevo
    if (alertsHistory.length === 0) await loadHistoryFromDB();
    res.json({
        success: true,
        alerts: alertsHistory,
        timestamp: new Date().toISOString()
    });
});

// ── POST /api/alerts/:id/lock — Bloquear alerta para edición ─────────────
router.post('/:id/lock', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userName = req.user.name;

    try {
        // Verificar si ya está bloqueada por otro
        const check = await query('SELECT locked_by, locked_at FROM dai_alerts WHERE seq_id = $1', [id]);
        const alert = (check.rows || check)[0];

        if (alert && alert.locked_by && alert.locked_by !== userId) {
            // Si el bloqueo tiene más de 5 minutos, permitir sobreescribir (evitar bloqueos huérfanos)
            const lockTime = new Date(alert.locked_at).getTime();
            if (Date.now() - lockTime < 5 * 60 * 1000) {
                return res.status(409).json({ error: 'Alerta bloqueada por otro usuario' });
            }
        }

        await query(
            'UPDATE dai_alerts SET locked_by = $1, locked_at = CURRENT_TIMESTAMP WHERE seq_id = $2',
            [userId, id]
        );

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
        const check = await query('SELECT locked_by FROM dai_alerts WHERE seq_id = $1', [id]);
        const alert = (check.rows || check)[0];

        if (alert && alert.locked_by && alert.locked_by !== userId) {
            // Solo el dueño del bloqueo o un admin puede desbloquear
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'No tienes permiso para desbloquear esta alerta' });
            }
        }

        await query('UPDATE dai_alerts SET locked_by = NULL, locked_at = NULL WHERE seq_id = $1', [id]);

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
        // Actualizar tabla y agregar al historial
        const alertCheck = await query('SELECT detalles_json FROM dai_alerts WHERE seq_id = $1', [id]);
        const alert = (alertCheck.rows || alertCheck)[0];
        if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });

        const detalles = typeof alert.detalles_json === 'string' ? JSON.parse(alert.detalles_json) : (alert.detalles_json || {});
        const history = detalles.history || [];

        history.push({
            ts: new Date().toISOString(),
            type: 'assigned',
            icon: 'person_add',
            color: '#10b981',
            text: `Alerta asignada a ${userName || userId}`,
            user: req.user.name
        });

        await query(
            'UPDATE dai_alerts SET assigned_to = $1, detalles_json = $2, updated_at = CURRENT_TIMESTAMP WHERE seq_id = $3',
            [userId, JSON.stringify({ ...detalles, history }), id]
        );

        broadcast('alert_updated', {
            id,
            assigned_to: userId,
            assigned_to_name: userName,
            history_latest: history[history.length - 1]
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

// ── Generate a single synthetic alert ─────────────────────────────────
async function generateOneAlert() {
    const dep = _pick(DEP_NAMES);
    const info = DAI_DEPTOS[dep];
    const tramo = _pick(info.tramos);
    const tipo = _pick(DAI_TIPOS);
    // Weighted severity: more critical/alta to keep it interesting
    const sevRoll = Math.random();
    const sev = sevRoll < 0.25 ? 'critica' : sevRoll < 0.50 ? 'alta' : sevRoll < 0.75 ? 'media' : 'baja';
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

    // PERSISTIR A LA BASE DE DATOS
    try {
        await query(
            `INSERT INTO dai_alerts (
                seq_id, tipo, severidad, estado, departamento, tramo, codigo_via, 
                poste_referencia, dispositivo_id, dispositivo_tipo, latitud, longitud, 
                tipo_registro, fecha_captura, fecha_plataforma, latencia_ms, evidencia_json, detalles_json
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
                alertData.id, alertData.tipo, alertData.sev, alertData.estado, alertData.dep,
                alertData.tramo, alertData.codigo_via, alertData.poste_ref, alertData.disp,
                alertData.dTipo, alertData.lat, alertData.lng, alertData.tipo_registro,
                alertData.t_captura, alertData.t_plataforma, alertData.latencia_ms,
                JSON.stringify(alertData.evidencia), JSON.stringify({ history: alertData.history })
            ]
        );
    } catch (err) {
        console.error('Error persistiendo alerta DAI:', err);
    }

    return alertData;
}

// ── SSE client management ─────────────────────────────────────────────
const clients = new Set();
// ── Cache de últimas alertas (se inicializa desde DB) ─────────────────
let alertsHistory = [];
const MAX_HISTORY = 50;

async function loadHistoryFromDB() {
    try {
        const res = await query(
            `SELECT a.*, u1.name as assigned_to_name, u2.name as locked_by_name 
             FROM dai_alerts a
             LEFT JOIN users u1 ON a.assigned_to = u1.id
             LEFT JOIN users u2 ON a.locked_by = u2.id
             ORDER BY a.fecha_plataforma DESC LIMIT $1`,
            [MAX_HISTORY]
        );
        alertsHistory = res.rows.map(row => {
            const detalles = typeof row.detalles_json === 'string' ? JSON.parse(row.detalles_json) : (row.detalles_json || {});
            return {
                id: row.seq_id,
                tipo: row.tipo,
                sev: row.severidad,
                estado: row.estado,
                dep: row.departamento,
                tramo: row.tramo,
                codigo_via: row.codigo_via,
                poste_ref: row.poste_referencia,
                disp: row.dispositivo_id,
                dTipo: row.dispositivo_tipo,
                lat: row.latitud,
                lng: row.longitud,
                tipo_registro: row.tipo_registro,
                fecha: row.fecha_plataforma,
                fecha_ts: new Date(row.fecha_plataforma).getTime(),
                t_captura: row.fecha_captura,
                t_plataforma: row.fecha_plataforma,
                latencia_ms: row.latencia_ms,
                evidencia: typeof row.evidencia_json === 'string' ? JSON.parse(row.evidencia_json) : (row.evidencia_json || null),
                history: detalles.history || [],
                assignedTo: row.assigned_to_name || null,
                assignedToId: row.assigned_to || null,
                locked_by: row.locked_by || null,
                locked_by_name: row.locked_by_name || null
            };
        });
        console.log(`[SSE] Historial cargado desde DB: ${alertsHistory.length} alertas`);
    } catch (err) {
        console.error('Error cargando historial DAI:', err);
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

// ── REST endpoint to get current alerts ───────────────────────────────
router.get('/', async (req, res) => {
    // Si el cache está vacío, intentar cargar de nuevo
    if (alertsHistory.length === 0) await loadHistoryFromDB();
    res.json({
        success: true,
        alerts: alertsHistory,
        timestamp: new Date().toISOString()
    });
});

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
        message: 'Conexión SSE establecida (Persistencia DB activa)',
        timestamp: new Date().toISOString(),
        clientCount: clients.size + 1
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

// ── Simulated alert generator ─────────────────────────────────────────
// Generates a new alert every 15-30 seconds when at least 1 client is connected
let _simTimer = null;

function scheduleNextAlert() {
    const delay = 15000 + Math.floor(Math.random() * 15000); // 15-30s
    _simTimer = setTimeout(async () => {
        if (clients.size > 0) {
            const alert = await generateOneAlert();
            broadcast('new_alert', alert);
            console.log(`[SSE] Nueva alerta (Guardada en DB): ${alert.id} (${alert.sev}) → ${alert.tipo} [${alert.dep}]  —  ${clients.size} clientes`);
        }
        scheduleNextAlert();
    }, delay);
}

// Start the simulator immediately
scheduleNextAlert();
console.log('[SSE] Simulador de alertas DAI iniciado (cada 15-30s)');

// ── REST endpoint to manually trigger an alert (for testing) ──────────
router.post('/trigger', (req, res) => {
    const alert = generateOneAlert();
    // Optionally override severity
    if (req.body && req.body.sev && SEV_LEVELS.includes(req.body.sev)) {
        alert.sev = req.body.sev;
    }
    broadcast('new_alert', alert);
    res.json({ success: true, alert });
});

module.exports = router;
