// ════════════════════════════════════════════════════════════════════════
//  ALERTAS DAI — Speed-First Alert Response Platform
//  Ventaja competitiva: VELOCIDAD de gestión
//  Métricas: t_captura · t_plataforma · t_respuesta
//  UX: acciones rápidas a un clic, workflow mínimo, urgencia visual
// ════════════════════════════════════════════════════════════════════════

// ── Data catalogue ────────────────────────────────────────────────────
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

// ── Tipo-to-icon mapping for instant recognition ──────────────────────
const TIPO_ICONS = {
    'Abandono de vehículo': 'directions_car', 'Acc. vehículo con lesionados': 'car_crash',
    'Acc. vehículo con fallecidos': 'car_crash', 'Acc. vehículo sin lesionados': 'minor_crash',
    'Alta densidad vehicular': 'traffic', 'Animal en calzada': 'pets',
    'Derrumbe / Deslizamiento': 'landslide', 'Exceso de velocidad': 'speed',
    'Falla en dispositivo DAI': 'build_circle', 'Falla en sensor WIM': 'scale',
    'Mercancía en vía': 'inventory_2', 'Objeto caido en calzada': 'report_problem',
    'Parada de emergencia': 'emergency', 'Peatón en calzada': 'directions_walk',
    'Pérdida de carga': 'local_shipping', 'Semáforo no operativo': 'traffic',
    'Vehículo averiado': 'car_repair', 'Vehículo en contravía': 'wrong_location',
    'Vehículo sobredimensionado': 'local_shipping', 'Violación de señal de tránsito': 'do_not_disturb',
    'Zona de obras — tráfico lento': 'construction',
};
function _tipoIcon(tipo) { return TIPO_ICONS[tipo] || 'warning'; }
const ESTADOS = ['creado', 'activa', 'en_revision', 'resuelta'];

// ── Platform users (loaded dynamically) ─────────────────────────────
let DAI_USERS = [];
async function _loadDaiUsers() {
    try {
        const r = await fetch('/api/users/by-permission/alertas-dai', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        DAI_USERS = await r.json();
        console.log(`[DAI] ${DAI_USERS.length} usuarios con permiso cargados`);
    } catch (e) {
        console.error('Error cargando usuarios DAI:', e);
    }
}
_loadDaiUsers();

// Obtenemos el usuario actual del localStorage
const _currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// ── State ─────────────────────────────────────────────────────────────
window.DAI = window.DAI || {};
Object.assign(window.DAI, {
    all: [], filtered: [], selected: null, page: 1, pageSize: 30, activeTab: 'detalle',
    f: {
        search: '', autoMan: new Set(['Automático', 'Manual']),
        quickDate: '', severidad: new Set(SEV_LEVELS), estado: '',
        tipos: new Set(), dep: '', tramo: '', dispTipo: '',
        dateFrom: '', dateTo: ''
    },
    counts: { total: 0, critica: 0, alta: 0, media: 0, baja: 0 },
    severityFilter: '',
    notifDaiEnabled: typeof window.DAI.notifDaiEnabled !== 'undefined' ? window.DAI.notifDaiEnabled : true,
});
const DAI = window.DAI; // Local reference for compatibility

// ── Helpers ───────────────────────────────────────────────────────────
const _p = n => String(n).padStart(2, '0');
const _fm = d => `${_p(d.getDate())}/${_p(d.getMonth() + 1)}/${d.getFullYear()} ${_p(d.getHours())}:${_p(d.getMinutes())}`;
const _fmShort = d => `${_p(d.getHours())}:${_p(d.getMinutes())} ${_p(d.getDate())}/${_p(d.getMonth() + 1)}`;
const _now = () => _fm(new Date());

function _elapsed(d) {
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function _elapsedMs(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}min ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
}
// Latency color class based on 20s challenge
function _latencyColor(ms) {
    const s = ms / 1000;
    if (s <= 10) return 'lat-excellent';   // green
    if (s <= 20) return 'lat-ok';          // yellow-green
    if (s <= 30) return 'lat-warn';        // orange
    return 'lat-critical';                 // red
}
function _latSecFmt(ms) { return (ms / 1000).toFixed(1) + 's'; }

// Urgency level based on time without response
function _urgency(a) {
    if (a.estado === 'resuelta') return 'resolved';
    const mins = Math.floor((Date.now() - a.fecha) / 60000);
    if (a.sev === 'critica') {
        if (mins > 30) return 'critical'; if (mins > 15) return 'high'; return 'normal';
    }
    if (a.sev === 'alta') {
        if (mins > 60) return 'critical'; if (mins > 30) return 'high'; return 'normal';
    }
    if (mins > 240) return 'high';
    return 'normal';
}

function _rc(c) { return [(c[0] + (Math.random() - .5) * 1.8).toFixed(7), (c[1] + (Math.random() - .5) * 1.8).toFixed(7)]; }
function _gid(n) {
    const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random() * 30));
    return `DAI-${d.getFullYear()}${_p(d.getMonth() + 1)}${_p(d.getDate())}-${String(n).padStart(4, '0')}`;
}
function _rd(days = 30) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * days));
    d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0);
    return d;
}

// ── Generate synthetic records ────────────────────────────────────────
function generateDAIData(n = 487) {
    return Array.from({ length: n }, (_, i) => {
        const dep = DEP_NAMES[Math.floor(Math.random() * DEP_NAMES.length)];
        const info = DAI_DEPTOS[dep];
        const tramo = info.tramos[Math.floor(Math.random() * info.tramos.length)];
        const tipo = DAI_TIPOS[Math.floor(Math.random() * DAI_TIPOS.length)];
        const sev = SEV_LEVELS[Math.floor(Math.random() * SEV_LEVELS.length)];
        const est = ESTADOS[Math.floor(Math.random() * ESTADOS.length)];
        const [lng, lat] = _rc(info.center);
        const fecha = _rd(30);
        const devN = 100 + Math.floor(Math.random() * 300);
        const devS = Math.random().toString(36).slice(2, 8).toUpperCase();
        const dTipo = ['WIM', 'RAD', 'CNT', 'VID'][Math.floor(Math.random() * 4)];
        const am = Math.random() > .25 ? 'Automático' : 'Manual';
        const creador = am === 'Automático' ? 'Sistema DAI' : DAI_USERS[Math.floor(Math.random() * DAI_USERS.length)].name;

        // ── TIME METRICS (competitive advantage) ──
        // Realistic latency distribution for 20s challenge
        const _r = Math.random();
        let _latMs;
        if (_r < 0.30) _latMs = 1000 + Math.floor(Math.random() * 4000);       // 1-5s  (30%)
        else if (_r < 0.55) _latMs = 5000 + Math.floor(Math.random() * 5000);  // 5-10s (25%)
        else if (_r < 0.75) _latMs = 10000 + Math.floor(Math.random() * 5000); // 10-15s (20%)
        else if (_r < 0.88) _latMs = 15000 + Math.floor(Math.random() * 5000); // 15-20s (13%)
        else if (_r < 0.95) _latMs = 20000 + Math.floor(Math.random() * 10000);// 20-30s (7%)
        else _latMs = 30000 + Math.floor(Math.random() * 15000);               // 30-45s (5%)
        const t_plataforma = new Date(fecha.getTime());
        const t_captura = new Date(t_plataforma.getTime() - _latMs);
        const latencia_ms = _latMs;
        // Response time: only for non-active alerts
        const t_respuesta = (est !== 'creado' && est !== 'activa')
            ? new Date(fecha.getTime() + Math.floor(Math.random() * 3600000 * 2))
            : null;
        const t_resolucion = est === 'resuelta'
            ? new Date(fecha.getTime() + Math.floor(Math.random() * 7200000 * 3))
            : null;

        return {
            id: _gid(i + 1), seq: i + 1, tipo_registro: am, tipo, sev, estado: est,
            dep, tramo,
            codigo_via: `${_p(Math.floor(Math.random() * 99))}-${_p(Math.floor(Math.random() * 99))}`,
            poste_ref: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9) + 1}`,
            disp: `INV-DAI-${devN}-${devS}`, dTipo, lng, lat,
            fecha, fecha_str: _fm(fecha),
            // Time metrics
            t_captura, t_plataforma, latencia_ms, t_respuesta, t_resolucion,
            // Video evidence
            evidencia: Math.random() > 0.08 ? {
                hasVideo: true,
                duration: 12 + Math.floor(Math.random() * 33),  // 12-45 seconds
                fileSize: (1.2 + Math.random() * 4.8).toFixed(1) + ' MB',
                cameraAngle: ['Frontal', 'Lateral izq.', 'Lateral der.', 'Cenital', 'Panorámica'][Math.floor(Math.random() * 5)],
                resolution: Math.random() > 0.3 ? '1080p' : '720p',
                fps: Math.random() > 0.5 ? 30 : 25,
            } : null,
            // Management
            assignedTo: null,
            attachments: [],
            notes: [],
            history: [
                {
                    ts: fecha, type: 'created', icon: 'add_circle', color: '#6366f1',
                    text: `Alerta creada (${am})`, user: creador
                }
            ],
        };
    }).sort((a, b) => b.fecha - a.fecha);
}

// ── Init ──────────────────────────────────────────────────────────────
window.loadAlertasDAI = function () {
    if (!DAI.all.length) DAI.all = generateDAIData(487);
    _buildStatCounts(); _renderStatBar(); _renderLatencyDashboard(); _renderStatusTabCounts();
    _applyFilters(); _renderRows(); _renderDetailEmpty();
    // Start live clock for urgency indicators
    if (!DAI._ticker) DAI._ticker = setInterval(() => {
        if (DAI.selected) { const a = DAI.all.find(x => x.id === DAI.selected); if (a) _updateLiveClock(a); }
    }, 30000);
};

function _updateLiveClock(a) {
    const el = document.getElementById('daiLiveElapsed');
    if (el) el.textContent = _elapsed(a.fecha);
    const urgEl = document.getElementById('daiUrgencyBar');
    if (urgEl) urgEl.className = `dai-urgency-bar urg-${_urgency(a)}`;
}

// ── Counts ────────────────────────────────────────────────────────────
function _buildStatCounts() {
    DAI.counts = { total: DAI.all.length, critica: 0, alta: 0, media: 0, baja: 0 };
    DAI.all.forEach(a => DAI.counts[a.sev]++);
}

// ── Stat bar ──────────────────────────────────────────────────────────
function _renderStatBar() {
    const bar = document.getElementById('daiStatBar'); if (!bar) return;
    const pending = DAI.all.filter(a => a.estado === 'activa' || a.estado === 'creado');
    const responded = DAI.all.filter(a => a.t_respuesta);
    const avgResp = responded.length ? responded.reduce((s, a) => s + (a.t_respuesta - a.fecha), 0) / responded.length : 0;

    // Trend: compare today vs yesterday (simulated)
    const todayCount = _filterByPeriod(DAI.all, 'hoy').length;
    const totalTrend = todayCount > 20 ? '+' : todayCount > 10 ? '' : '-';

    const items = [
        { key: 'total', icon: 'notifications', label: 'Total', cls: 'sev-total', val: DAI.counts.total, trend: totalTrend },
        { key: 'critica', icon: 'error', label: 'Crítica', cls: 'sev-critica', val: DAI.counts.critica, trend: DAI.counts.critica > 100 ? '+' : '' },
        { key: 'alta', icon: 'warning', label: 'Alta', cls: 'sev-alta', val: DAI.counts.alta, trend: '' },
        { key: 'media', icon: 'info', label: 'Media', cls: 'sev-media', val: DAI.counts.media, trend: '' },
        { key: 'baja', icon: 'check_circle', label: 'Baja', cls: 'sev-baja', val: DAI.counts.baja, trend: '' },
    ];

    const trendHtml = (t) => t === '+' ? '<span class="dai-stat-trend up"><i class="material-icons">trending_up</i></span>'
        : t === '-' ? '<span class="dai-stat-trend down"><i class="material-icons">trending_down</i></span>' : '';

    bar.innerHTML = items.map((it, i) => `
        <div class="dai-stat-card ${it.cls} ${DAI.severityFilter === it.key ? 'active-filter' : ''}" style="--card-i:${i}"
             onclick="daiStatFilter('${it.key}')" title="Filtrar por ${it.label}">
            <div class="dai-stat-icon"><i class="material-icons">${it.icon}</i></div>
            <div>
                <div class="dai-stat-num" data-target="${it.val}">0</div>
                <div class="dai-stat-lbl">${it.label}${trendHtml(it.trend)}</div>
            </div>
        </div>`).join('') + `
        <div class="dai-stat-card sev-pending ${pending.length > 200 ? 'has-pulse' : ''}" style="--card-i:5" title="${pending.length} alertas sin atender">
            <div class="dai-stat-icon"><i class="material-icons">hourglass_top</i></div>
            <div><div class="dai-stat-num" data-target="${pending.length}">0</div><div class="dai-stat-lbl">Pendientes</div></div>
        </div>
        <div class="dai-stat-card sev-speed" style="--card-i:6" title="Tiempo promedio de respuesta">
            <div class="dai-stat-icon"><i class="material-icons">speed</i></div>
            <div><div class="dai-stat-num">${_elapsedMs(avgResp)}</div><div class="dai-stat-lbl">T. Respuesta</div></div>
        </div>`;
    // Count-up animation
    requestAnimationFrame(() => _animateCountUp());
}

function _animateCountUp() {
    document.querySelectorAll('.dai-stat-num[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        if (isNaN(target)) return;
        const duration = 600, start = performance.now();
        const step = (ts) => {
            const p = Math.min((ts - start) / duration, 1);
            el.textContent = Math.round(p * target);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}
window.daiStatFilter = function (key) {
    DAI.severityFilter = DAI.severityFilter === key ? '' : key;
    if (!DAI.severityFilter || DAI.severityFilter === 'total') { DAI.f.severidad = new Set(SEV_LEVELS); DAI.severityFilter = ''; }
    else DAI.f.severidad = new Set([DAI.severityFilter]);
    _renderStatBar(); _applyFilters(); _renderRows();
};
function _renderStatusTabCounts() {
    const c = { all: DAI.all.length, creado: 0, activa: 0, en_revision: 0, resuelta: 0 };
    DAI.all.forEach(a => c[a.estado]++);
    Object.entries(c).forEach(([k, v]) => { const el = document.getElementById(`tabCount_${k}`); if (el) el.textContent = v; });
}

// ── Latency Performance Dashboard ─────────────────────────────────────
const LAT_RANGES = [
    { min: 0, max: 5000, label: '0–5s', color: '#16a34a', cls: 'lat-excellent' },
    { min: 5000, max: 10000, label: '5–10s', color: '#22c55e', cls: 'lat-good' },
    { min: 10000, max: 15000, label: '10–15s', color: '#84cc16', cls: 'lat-accept' },
    { min: 15000, max: 20000, label: '15–20s', color: '#eab308', cls: 'lat-limit' },
    { min: 20000, max: 30000, label: '20–30s', color: '#f97316', cls: 'lat-exceed' },
    { min: 30000, max: Infinity, label: '>30s', color: '#ef4444', cls: 'lat-critical' },
];
const CHALLENGE_MS = 20000; // 20 seconds

function _computeLatencyStats(alerts) {
    if (!alerts.length) return { avg: 0, compliance: 0, avgResp: 0, count: 0 };
    const total = alerts.length;
    const sumLat = alerts.reduce((s, a) => s + a.latencia_ms, 0);
    const passing = alerts.filter(a => a.latencia_ms <= CHALLENGE_MS).length;
    const responded = alerts.filter(a => a.t_respuesta);
    const avgResp = responded.length
        ? responded.reduce((s, a) => s + (a.t_respuesta - a.fecha), 0) / responded.length
        : 0;
    return {
        avg: sumLat / total,
        compliance: (passing / total) * 100,
        avgResp,
        count: total,
        passing,
    };
}

function _filterByPeriod(alerts, period) {
    const now = new Date();
    const start = new Date(now);
    switch (period) {
        case 'hoy': start.setHours(0, 0, 0, 0); break;
        case 'semana': start.setDate(now.getDate() - 7); break;
        case 'mes': start.setMonth(now.getMonth() - 1); break;
        case 'trimestre': start.setMonth(now.getMonth() - 3); break;
        case 'semestre': start.setMonth(now.getMonth() - 6); break;
        case 'anual': start.setFullYear(now.getFullYear() - 1); break;
    }
    return alerts.filter(a => a.fecha >= start);
}

function _gaugeColor(pct) {
    if (pct >= 95) return '#16a34a';
    if (pct >= 80) return '#eab308';
    return '#ef4444';
}

function _renderLatencyDashboard() {
    const container = document.getElementById('daiLatencyDashboard');
    if (!container) return;

    const allAlerts = DAI.all;
    const todayStats = _computeLatencyStats(_filterByPeriod(allAlerts, 'hoy'));
    const globalStats = _computeLatencyStats(allAlerts);

    // Compliance gauge values
    const pct = globalStats.compliance;
    const gaugeColor = _gaugeColor(pct);

    // Distribution counts
    const distrib = LAT_RANGES.map(r => {
        const c = allAlerts.filter(a => a.latencia_ms >= r.min && a.latencia_ms < r.max).length;
        return { ...r, count: c, pct: (c / allAlerts.length * 100).toFixed(1) };
    });
    const maxCount = Math.max(...distrib.map(d => d.count), 1);

    // Historical periods
    const periods = [
        { key: 'hoy', label: 'Hoy', icon: 'today' },
        { key: 'semana', label: 'Semana', icon: 'date_range' },
        { key: 'mes', label: 'Mes', icon: 'calendar_month' },
        { key: 'trimestre', label: 'Trimestre', icon: 'event_note' },
        { key: 'semestre', label: 'Semestre', icon: 'calendar_today' },
        { key: 'anual', label: 'Anual', icon: 'event' },
    ];
    const periodStats = periods.map(p => ({
        ...p,
        stats: _computeLatencyStats(_filterByPeriod(allAlerts, p.key))
    }));

    // Update the external challenge badge
    const challengeEl = document.getElementById('daiLatencyChallenge');
    if (challengeEl) {
        challengeEl.className = `dai-latency-challenge ${pct >= 95 ? 'badge-ok' : pct >= 80 ? 'badge-warn' : 'badge-fail'}`;
        challengeEl.textContent = `Reto 20s: ${pct.toFixed(1)}%`;
    }

    container.innerHTML = `
        <div class="dai-lat-body">
            <div class="dai-lat-grid">

                <!-- GAUGE -->
                <div class="dai-lat-card dai-lat-gauge-card">
                    <div class="dai-lat-card-title"><i class="material-icons">verified</i>Tiempo de Carga a la Plataforma</div>
                    <div class="dai-lat-gauge-wrap">
                        <div class="dai-lat-gauge" style="--pct:${pct};--gauge-color:${gaugeColor}">
                            <div class="dai-lat-gauge-inner">
                                <span class="dai-lat-gauge-num">${pct.toFixed(1)}%</span>
                                <span class="dai-lat-gauge-sub">${globalStats.passing} de ${globalStats.count}</span>
                            </div>
                        </div>
                        <div class="dai-lat-gauge-legend">
                            <div class="dai-lat-gl-row">
                                <span class="dai-lat-gl-dot" style="background:#16a34a"></span>
                                <span>≤ 20s</span>
                                <strong>${globalStats.passing}</strong>
                            </div>
                            <div class="dai-lat-gl-row">
                                <span class="dai-lat-gl-dot" style="background:#ef4444"></span>
                                <span>> 20s</span>
                                <strong>${globalStats.count - globalStats.passing}</strong>
                            </div>
                            <div class="dai-lat-gl-row">
                                <span class="dai-lat-gl-dot" style="background:#6366f1"></span>
                                <span>Promedio</span>
                                <strong>${_latSecFmt(globalStats.avg)}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- DISTRIBUTION -->
                <div class="dai-lat-card dai-lat-distrib-card">
                    <div class="dai-lat-card-title"><i class="material-icons">bar_chart</i>Distribución de Latencia</div>
                    <div class="dai-lat-distrib">
                        ${distrib.map((d, bi) => `
                            <div class="dai-lat-bar-row">
                                <span class="dai-lat-bar-label">${d.label}</span>
                                <div class="dai-lat-bar-track">
                                    <div class="dai-lat-bar-fill" style="width:${(d.count / maxCount * 100).toFixed(1)}%;background:${d.color};--bar-i:${bi}"></div>
                                </div>
                                <span class="dai-lat-bar-count">${d.count}</span>
                                <span class="dai-lat-bar-pct">${d.pct}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- HISTORICAL AVERAGES -->
                <div class="dai-lat-card dai-lat-history-card">
                    <div class="dai-lat-card-title"><i class="material-icons">analytics</i>Promedios Históricos</div>
                    <div class="dai-lat-table-wrap">
                        <table class="dai-lat-table">
                            <thead>
                                <tr>
                                    <th>Período</th>
                                    <th>Latencia</th>
                                    <th>Cumplimiento</th>
                                    <th>T. Atención</th>
                                    <th>Alertas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${periodStats.map(p => {
        const s = p.stats;
        const compCls = s.compliance >= 95 ? 'comp-ok' : s.compliance >= 80 ? 'comp-warn' : 'comp-fail';
        return `
                                    <tr>
                                        <td><i class="material-icons">${p.icon}</i>${p.label}</td>
                                        <td class="${_latencyColor(s.avg)}">${s.count ? _latSecFmt(s.avg) : '—'}</td>
                                        <td><span class="dai-lat-comp ${compCls}">${s.count ? s.compliance.toFixed(1) + '%' : '—'}</span></td>
                                        <td>${s.count ? _elapsedMs(s.avgResp) : '—'}</td>
                                        <td>${s.count}</td>
                                    </tr>`;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    `;

    // Auto-collapse on small screens (width ≤ 900) OR limited height (≤ 850px)
    function _daiCheckLatencySpace() {
        const collapsible = document.getElementById('daiLatencyCollapsible');
        const chevron = document.getElementById('daiLatencyChevron');
        if (!collapsible) return;
        const tooSmall = window.innerWidth <= 900 || window.innerHeight <= 850;
        if (tooSmall && !collapsible.classList.contains('collapsed')) {
            collapsible.classList.add('collapsed');
            if (chevron) chevron.textContent = 'expand_more';
        }
    }
    _daiCheckLatencySpace();
    if (!window._daiResizeListenerAdded) {
        window._daiResizeListenerAdded = true;
        window.addEventListener('resize', _daiCheckLatencySpace);
    }
}

// Toggle latency dashboard visibility
function daiToggleLatencyDashboard() {
    const collapsible = document.getElementById('daiLatencyCollapsible');
    const chevron = document.getElementById('daiLatencyChevron');
    if (!collapsible) return;
    const isCollapsed = collapsible.classList.toggle('collapsed');
    if (chevron) chevron.textContent = isCollapsed ? 'expand_more' : 'expand_less';
    // Save preference
    try { localStorage.setItem('dai-lat-collapsed', isCollapsed ? '1' : '0'); } catch (e) { }
    // Recalcular altura del split-pane tras la transición CSS (0.35s)
    setTimeout(() => { if (typeof _daiFixHeight === 'function') _daiFixHeight(); }, 360);
}
// ── Filters ───────────────────────────────────────────────────────────
// Toggle entire stats section (stat bar + latency)
function daiToggleStatsSection() {
    var c = document.getElementById('daiStatsCollapsible');
    var ch = document.getElementById('daiStatsChevron');
    if (!c) return;
    var isOpen = c.style.maxHeight && c.style.maxHeight !== '0px';
    if (isOpen) {
        c.style.maxHeight = '0px';
        if (ch) { ch.textContent = 'expand_more'; ch.style.transform = 'rotate(0deg)'; }
    } else {
        c.style.maxHeight = c.scrollHeight + 'px';
        if (ch) { ch.textContent = 'expand_less'; ch.style.transform = 'rotate(180deg)'; }
    }
    // Save preference
    try { localStorage.setItem('dai-stats-collapsed', isOpen ? '1' : '0'); } catch (e) { }
    // Fix height after transition
    setTimeout(function () { if (typeof _daiFixHeight === 'function') _daiFixHeight(); }, 450);
}
window.daiApplyFilters = function () { _applyFilters(); _renderRows(); closeDaiFilterModal(); };
function _applyFilters() {
    const f = DAI.f, now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    let data = DAI.all;
    if (f.quickDate === 'today') data = data.filter(a => a.fecha >= todayStart);
    if (f.quickDate === 'week') data = data.filter(a => a.fecha >= weekStart);
    data = data.filter(a => f.severidad.has(a.sev));
    const activeTab = document.querySelector('.dai-status-tab.active');
    const tabVal = activeTab?.dataset.estado || '';
    if (tabVal) data = data.filter(a => a.estado === tabVal);
    if (f.dep) data = data.filter(a => a.dep === f.dep);
    if (f.tramo) data = data.filter(a => a.tramo === f.tramo);
    if (f.dispTipo) data = data.filter(a => a.dTipo === f.dispTipo);
    if (f.tipos.size) data = data.filter(a => f.tipos.has(a.tipo));
    if (f.dateFrom) data = data.filter(a => a.fecha >= new Date(f.dateFrom));
    if (f.dateTo) data = data.filter(a => a.fecha <= new Date(f.dateTo));
    if (f.search) {
        const q = f.search.toLowerCase();
        data = data.filter(a => `${a.id} ${a.tipo} ${a.disp} ${a.dep} ${a.tipo_registro} ${a.tramo}`.toLowerCase().includes(q));
    }
    DAI.filtered = data; DAI.page = 1;
    const c = { all: data.length, creado: 0, activa: 0, en_revision: 0, resuelta: 0 };
    data.forEach(a => c[a.estado]++);
    Object.entries(c).forEach(([k, v]) => { const el = document.getElementById(`tabCount_${k}`); if (el) el.textContent = v; });
}
window.daiSearch = function (v) { DAI.f.search = v; _applyFilters(); _renderRows(); };

window.daiChipDate = function (el, v) {
    document.querySelectorAll('.dai-chip[data-date]').forEach(c => c.classList.remove('active'));
    if (DAI.f.quickDate === v) { DAI.f.quickDate = ''; } else { DAI.f.quickDate = v; el.classList.add('active'); }
    _applyFilters(); _renderRows();
};
window.daiTabClick = function (el) {
    document.querySelectorAll('.dai-status-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active'); _applyFilters(); _renderRows();
};

// ════════════════════════════════════════════════════════════════════════
//  TABLE ROWS — with urgency indicators
// ════════════════════════════════════════════════════════════════════════
const _sevLabel = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
const _estLabel = { creado: 'Creado', activa: 'Activa', en_revision: 'En Revisión', resuelta: 'Resuelta' };

function _renderRows() {
    const list = document.getElementById('daiTableBody'),
        resEl = document.getElementById('daiResultsCount'),
        pgEl = document.getElementById('daiPageInfo2'),
        moreBtn = document.getElementById('daiMoreBtn');
    if (!list) return;
    const total = DAI.filtered.length, slice = DAI.filtered.slice(0, DAI.page * DAI.pageSize), hasMore = slice.length < total;
    if (resEl) resEl.innerHTML = `Mostrando <strong>${slice.length}</strong> de <strong>${total}</strong> alertas`;
    if (pgEl) pgEl.textContent = `${slice.length}/${total}`;
    if (moreBtn) moreBtn.style.display = hasMore ? 'flex' : 'none';
    if (!slice.length) { list.innerHTML = `<div class="dai-empty-state"><i class="material-icons">search_off</i><h4>Sin resultados</h4><p>Ajusta los filtros</p></div>`; return; }
    // Marcar las primeras 5 alertas NO resueltas para animación de pulso
    const unresolved = slice.filter(a => a.estado !== 'resuelta');
    const pulseIds = new Set(unresolved.slice(0, 5).map(a => a.id));
    list.innerHTML = slice.map((a, i) => _rowHTML(a, i, pulseIds.has(a.id))).join('');
    // Actualizar urgencia sonora según alertas activas sin resolver
    const activeCount = DAI.all.filter(a => a.estado === 'activa' || a.estado === 'creado').length;
    DAI_SOUND.updateUrgency(activeCount);
}

function _rowHTML(a, idx = 0, isPulsing = false) {
    const sel = a.id === DAI.selected ? 'is-selected' : '';
    const urg = _urgency(a);
    const urgCls = urg === 'critical' ? 'row-urgent-critical' : urg === 'high' ? 'row-urgent-high' : '';
    // Clase de pulso solo si la alerta no está resuelta
    const pulseCls = isPulsing && a.estado !== 'resuelta' ? `dai-row-new-${a.sev}` : '';
    const elapsed = a.estado !== 'resuelta' ? `<span class="dai-row-elapsed ${urg}">${_elapsed(a.fecha)}</span>` : '';
    const assignIcon = a.assignedTo ? `<i class="material-icons" style="font-size:11px;color:#6366f1;margin-left:3px" title="→ ${a.assignedTo}">person</i>` : '';
    const latSec = (a.latencia_ms / 1000).toFixed(1);
    const latCls = _latencyColor(a.latencia_ms);
    const tipoIc = _tipoIcon(a.tipo);
    const hasVid = a.evidencia ? '<i class="material-icons dai-row-vid-icon" title="Video disponible">videocam</i>' : '';
    const lockIcon = a.locked_by ? `<i class="material-icons dai-row-lock-icon" style="font-size:12px;color:#f59e0b;margin-left:3px" title="Bloqueado por ${a.locked_by_name || 'otro usuario'}">lock</i>` : '';

    return `
    <div class="dai-row ${sel} ${urgCls} ${pulseCls}" onclick="daiSelectAlert('${a.id}')" style="--row-i:${idx}">
        <div class="dai-row-strip ${a.sev}"></div>
        <div class="dai-row-sev"><span class="sev-pill ${a.sev}">${_sevLabel[a.sev]}</span></div>
        <div class="dai-row-tipo-icon"><i class="material-icons">${tipoIc}</i></div>
        <div class="dai-row-info">
            <div class="dai-row-tipo" title="${a.tipo}">${a.tipo}${assignIcon}${lockIcon}${hasVid}</div>
            <div class="dai-row-id">${a.id}</div>
        </div>
        <div class="dai-row-cell"><span class="cell-label">Departamento</span><span class="cell-value">${a.dep}</span></div>
        <div class="dai-row-cell"><span class="cell-label">Dispositivo</span><span class="cell-value mono">${a.disp.replace('INV-DAI-', '')}</span></div>
        <div class="dai-row-cell"><span class="cell-label">Fecha</span><span class="cell-value">${a.fecha_str}</span></div>
        <div class="dai-row-cell dai-row-status-cell">
            <span class="status-pill ${a.estado}"><span class="status-dot"></span>${_estLabel[a.estado]}</span>
            ${elapsed}
        </div>
        <div class="dai-row-lat ${latCls}" title="Latencia: ${latSec}s">${latSec}s</div>
        <div class="dai-row-arrow"><i class="material-icons">chevron_right</i></div>
    </div>`;
}
window.daiLoadMore = function () { DAI.page++; _renderRows(); };

// ════════════════════════════════════════════════════════════════════════
//  DETAIL PANEL
//  One compact, scrollable panel that shows everything needed.
// ════════════════════════════════════════════════════════════════════════
async function daiSelectAlert(id) {
    if (DAI.selected) {
        // Desbloquear la anterior antes de pasar a la nueva
        daiUnlockAlert(DAI.selected);
    }

    DAI.selected = id;
    _renderRows();
    const pane = document.getElementById('daiDetailPane');
    const backdrop = document.getElementById('daiDetailBackdrop');
    if (pane) {
        pane.classList.remove('collapsed');
        pane.classList.remove('dai-detail-animate');
        void pane.offsetWidth; // force reflow
        pane.classList.add('dai-detail-animate');
        pane.scrollTop = 0;
    }
    if (backdrop) {
        backdrop.classList.add('active');
        backdrop.classList.remove('hidden');
    }

    const alert = DAI.all.find(x => x.id === id);
    _renderDetail(alert);

    // Intentar bloquearla para el usuario actual
    daiLockAlert(id);
}
function daiCloseDetail() {
    if (DAI.selected) {
        daiUnlockAlert(DAI.selected);
    }
    document.getElementById('daiDetailPane')?.classList.add('collapsed');
    const backdrop = document.getElementById('daiDetailBackdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        backdrop.classList.add('hidden');
    }
    DAI.selected = null; DAI.activeTab = 'detalle'; _renderRows(); _renderDetailEmpty();
}
function _renderDetailEmpty() {
    const pane = document.getElementById('daiDetailPane'); if (!pane) return;
    pane.innerHTML = `<div class="dai-detail-empty"><i class="material-icons">touch_app</i><h4>Selecciona una alerta</h4><p>Clic en cualquier fila para gestionar, asignar, adjuntar y ver historial.</p></div>`;
}

// Tab switcher
window.daiSwitchTab = function (tab) {
    DAI.activeTab = tab;
    document.querySelectorAll('.dai-detail-tab').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`.dai-detail-tab[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.dai-tab-content').forEach(c => c.style.display = 'none');
    const content = document.getElementById(`daiTab_${tab}`);
    if (content) content.style.display = 'block';
};

// ── Main render ───────────────────────────────────────────────────────
function _renderDetail(a) {
    const pane = document.getElementById('daiDetailPane'); if (!pane) return;

    const mapsUrl = `https://www.google.com/maps?q=${a.lat},${a.lng}`;
    const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(a.lng) - .01).toFixed(4)}%2C${(parseFloat(a.lat) - .01).toFixed(4)}%2C${(parseFloat(a.lng) + .01).toFixed(4)}%2C${(parseFloat(a.lat) + .01).toFixed(4)}&layer=mapnik&marker=${a.lat}%2C${a.lng}`;
    const dIcon = { WIM: 'scale', RAD: 'speed', CNT: 'numbers', VID: 'videocam' }[a.dTipo] || 'sensors';
    const dLabel = { WIM: 'Pesaje (WIM)', RAD: 'Radar (RAD)', CNT: 'Contador (CNT)', VID: 'Video (VID)' }[a.dTipo] || a.dTipo;
    const tab = DAI.activeTab;
    const urg = _urgency(a);

    const isLockedByOther = a.locked_by && a.locked_by !== _currentUser.id;
    const lockWarning = isLockedByOther ? `
        <div class="dai-detail-lock-msg">
            <i class="material-icons">lock</i>
            <span>Este incidente está siendo atendido por <strong>${a.locked_by_name || 'otro usuario'}</strong></span>
        </div>
    ` : '';

    pane.innerHTML = `
    <!-- URGENCY BAR — visual pulse for active alerts -->
    <div class="dai-urgency-bar urg-${urg}" id="daiUrgencyBar"></div>

    ${lockWarning}

    <!-- HEADER -->
    <div class="dai-detail-header ${isLockedByOther ? 'is-locked' : ''}">
        <div class="dai-detail-top-row">
            <span class="dai-detail-id">${a.id} ${a.locked_by ? '<i class="material-icons" style="font-size:14px;vertical-align:middle;color:#f59e0b">lock</i>' : ''}</span>
            <button class="dai-detail-close" onclick="daiCloseDetail()"><i class="material-icons">close</i></button>
        </div>
        <div class="dai-detail-tipo">${a.tipo}</div>
        <div class="dai-detail-pills">
            <span class="sev-pill ${a.sev}">${_sevLabel[a.sev]}</span>
            <span class="status-pill ${a.estado}"><span class="status-dot"></span>${_estLabel[a.estado]}</span>
            <span class="dai-pill-tag">${a.tipo_registro === 'Automático' ? '⚡' : '👤'} ${a.tipo_registro}</span>
            ${a.assignedTo ? `<span class="dai-pill-tag assigned" title="Asignado a ${a.assignedTo}"><i class="material-icons">person</i> ${a.assignedTo}</span>` : ''}
        </div>
        ${a.estado === 'resuelta' && a.resolutionLabel ? `
        <div class="dai-resolution-info">
            <i class="material-icons">check_circle</i>
            <div>
                <div class="dai-resolution-method">${a.resolutionLabel}</div>
                ${a.resolutionComment ? `<div class="dai-resolution-comment">${a.resolutionComment}</div>` : ''}
            </div>
        </div>` : ''}
    </div>

    <!-- ★ VIDEO EVIDENCE — inline preview ★ -->
    ${a.evidencia ? `
    <div class="dai-video-preview" id="daiVideoPreview">
        <div class="dai-video-thumb" id="daiVideoThumb" onclick="daiPlayVideo()">
            <canvas id="daiCCTVCanvas" width="400" height="225"></canvas>
            <div class="dai-video-overlay">
                <div class="dai-video-cam-info">
                    <span class="dai-video-rec"><span class="dai-rec-dot"></span>REC</span>
                    <span>${a.disp}</span>
                </div>
                <div class="dai-video-play-btn"><i class="material-icons">play_circle_filled</i></div>
                <div class="dai-video-bottom-info">
                    <span><i class="material-icons">videocam</i>${a.evidencia.cameraAngle} · ${a.evidencia.resolution}</span>
                    <span><i class="material-icons">timer</i>${a.evidencia.duration}s · ${a.evidencia.fileSize}</span>
                </div>
            </div>
        </div>
    </div>
    ` : `
    <div class="dai-video-preview dai-no-video">
        <i class="material-icons">videocam_off</i>
        <span>Sin evidencia de video</span>
    </div>
    `}

    <!-- ★ TIME METRICS — visual timeline ★ -->
    <div class="dai-time-timeline">
        <div class="dai-tt-step done">
            <div class="dai-tt-icon"><i class="material-icons">sensors</i></div>
            <div class="dai-tt-line"></div>
            <div class="dai-tt-label">Captura</div>
            <div class="dai-tt-value">${_fmShort(a.t_captura)}</div>
        </div>
        <div class="dai-tt-connector">
            <div class="dai-tt-connector-line"></div>
            <span class="dai-tt-latency ${_latencyColor(a.latencia_ms)}">${_latSecFmt(a.latencia_ms)}</span>
        </div>
        <div class="dai-tt-step done">
            <div class="dai-tt-icon"><i class="material-icons">cloud_upload</i></div>
            <div class="dai-tt-line"></div>
            <div class="dai-tt-label">Plataforma</div>
            <div class="dai-tt-value">${_fmShort(a.t_plataforma)}</div>
        </div>
        <div class="dai-tt-connector">
            <div class="dai-tt-connector-line ${a.estado !== 'resuelta' ? 'animate-pulse' : ''}"></div>
        </div>
        <div class="dai-tt-step ${a.estado === 'resuelta' ? 'done' : 'pending'}">
            <div class="dai-tt-icon"><i class="material-icons">${a.estado === 'resuelta' ? 'check_circle' : 'timer'}</i></div>
            <div class="dai-tt-line"></div>
            <div class="dai-tt-label">${a.estado === 'resuelta' ? 'Resuelta' : 'Esperando'}</div>
            <div class="dai-tt-value" id="daiLiveElapsed">${a.estado === 'resuelta' && a.t_resolucion ? _fmShort(a.t_resolucion) : _elapsed(a.fecha)}</div>
        </div>
    </div>

    <!-- ★ QUICK ACTIONS — solo acción de estado ★ -->
    <div class="dai-quick-actions">
        ${a.estado !== 'resuelta' ? `
        <button class="dai-qaction resolve" onclick="daiQuickResolve()" title="Marcar como resuelta">
            <i class="material-icons">check_circle</i><span>Resolver</span>
        </button>` : `
        <button class="dai-qaction reopen" onclick="daiQuickReopen()" title="Reabrir alerta">
            <i class="material-icons">replay</i><span>Reabrir</span>
        </button>`}
    </div>

    <!-- TABS -->
    <div class="dai-detail-tabs">
        <button class="dai-detail-tab ${tab === 'detalle' ? 'active' : ''}" data-tab="detalle" onclick="daiSwitchTab('detalle')">
            <i class="material-icons">info</i>Detalle
        </button>
        <button class="dai-detail-tab ${tab === 'gestion' ? 'active' : ''}" data-tab="gestion" onclick="daiSwitchTab('gestion')">
            <i class="material-icons">settings</i>Gestión
        </button>
        <button class="dai-detail-tab ${tab === 'historial' ? 'active' : ''}" data-tab="historial" onclick="daiSwitchTab('historial')">
            <i class="material-icons">history</i>Historial <span class="dai-tab-badge">${a.history.length}</span>
        </button>
    </div>

    <!-- TAB BODIES -->
    <div class="dai-detail-body">

        <!-- ═══ TAB: DETALLE ═══ -->
        <div class="dai-tab-content" id="daiTab_detalle" style="display:${tab === 'detalle' ? 'block' : 'none'}">
            <div class="dai-detail-map">
                <iframe src="${osmUrl}" loading="lazy"></iframe>
                <div class="dai-detail-map-overlay">
                    <a href="${mapsUrl}" target="_blank" rel="noopener"><i class="material-icons">open_in_new</i>Google Maps</a>
                </div>
            </div>
            <div class="dai-detail-info">
                <div class="dai-detail-section-title">Ubicación del incidente</div>
                <div class="dai-info-grid">
                    <div class="dai-info-item"><label>Departamento</label><span>${a.dep}</span></div>
                    <div class="dai-info-item"><label>Tramo</label><span>${a.tramo}</span></div>
                    <div class="dai-info-item"><label>Código de vía</label><span>${a.codigo_via}</span></div>
                    <div class="dai-info-item"><label>Poste – Distancia</label><span>${a.poste_ref}</span></div>
                    <div class="dai-info-item"><label>Latitud</label><span class="mono">${a.lat}</span></div>
                    <div class="dai-info-item"><label>Longitud</label><span class="mono">${a.lng}</span></div>
                </div>
            </div>
            <div class="dai-detail-info"><div class="dai-detail-section-title">Dispositivo involucrado</div></div>
            <div class="dai-device-card">
                <div class="dai-device-icon"><i class="material-icons">${dIcon}</i></div>
                <div><div class="dai-device-name">${a.disp}</div><div class="dai-device-meta">${dLabel} — ${a.dep} · Tramo ${a.tramo}</div></div>
            </div>
        </div>

        <!-- ═══ TAB: GESTIÓN ═══ -->
        <div class="dai-tab-content" id="daiTab_gestion" style="display:${tab === 'gestion' ? 'block' : 'none'}">

            <!-- Cambiar estado -->
            <div class="dai-mgmt-section">
                <div class="dai-mgmt-title"><i class="material-icons">swap_horiz</i>Cambiar estado</div>
                <div class="dai-mgmt-body">
                    <div class="dai-form-row">
                        <label>Nuevo estado</label>
                        <select id="daiNewStatus">
                            ${ESTADOS.map(e => `<option value="${e}" ${a.estado === e ? 'selected' : ''}>${_estLabel[e]}</option>`).join('')}
                        </select>
                    </div>
                    <div class="dai-form-row">
                        <label>Comentario <span class="req">*</span></label>
                        <textarea id="daiStatusComment" placeholder="Describe el motivo del cambio…" rows="2"></textarea>
                    </div>
                    <button class="dai-mgmt-btn primary" onclick="daiChangeStatus()">
                        <i class="material-icons">save</i>Guardar cambio
                    </button>
                </div>
            </div>

            <!-- Asignar -->
            <div class="dai-mgmt-section">
                <div class="dai-mgmt-title"><i class="material-icons">person_add</i>Asignar a usuario</div>
                <div class="dai-mgmt-body">
                    <div class="dai-form-row">
                        <label>Seleccionar usuario</label>
                        <select id="daiAssignSelect">
                            <option value="">— Seleccionar —</option>
                            ${DAI_USERS.map(u => `<option value="${u.name}" ${a.assignedTo === u.name ? 'selected' : ''}>${u.name} (${u.role})</option>`).join('')}
                        </select>
                    </div>
                    <button class="dai-mgmt-btn indigo" onclick="daiAssignUser()">
                        <i class="material-icons">assignment_ind</i>Asignar alerta
                    </button>
                </div>
            </div>

            <!-- Email -->
            <div class="dai-mgmt-section">
                <div class="dai-mgmt-title"><i class="material-icons">email</i>Enviar por correo</div>
                <div class="dai-mgmt-body">
                    <div class="dai-form-row">
                        <label>Correo electrónico</label>
                        <input type="email" id="daiEmailTo" placeholder="correo@ejemplo.com">
                    </div>
                    <div class="dai-form-row">
                        <label>Mensaje (opcional)</label>
                        <textarea id="daiEmailMsg" placeholder="Mensaje adicional…" rows="2"></textarea>
                    </div>
                    <button class="dai-mgmt-btn blue" onclick="daiSendEmail()">
                        <i class="material-icons">send</i>Enviar correo
                    </button>
                </div>
            </div>

            <!-- Adjuntos -->
            <div class="dai-mgmt-section">
                <div class="dai-mgmt-title"><i class="material-icons">attach_file</i>Adjuntos <span class="dai-tab-badge">${a.attachments.length}</span></div>
                <div class="dai-mgmt-body">
                    <div id="daiAttachList">
                        ${a.attachments.length ? a.attachments.map((att, i) => `
                            <div class="dai-attachment-item">
                                <i class="material-icons">${_fileIcon(att.name)}</i>
                                <div class="dai-att-info"><span class="dai-att-name">${att.name}</span><span class="dai-att-meta">${att.size} · ${att.date}</span></div>
                                <button class="dai-att-remove" onclick="daiRemoveAttachment(${i})"><i class="material-icons">close</i></button>
                            </div>`).join('')
            : '<div class="dai-no-items"><i class="material-icons">cloud_upload</i>Sin archivos</div>'}
                    </div>
                    <label class="dai-upload-btn">
                        <i class="material-icons">cloud_upload</i>Subir archivo
                        <input type="file" id="daiFileInput" onchange="daiAddAttachment()" hidden>
                    </label>
                </div>
            </div>

            <!-- Notas -->
            <div class="dai-mgmt-section">
                <div class="dai-mgmt-title"><i class="material-icons">sticky_note_2</i>Notas <span class="dai-tab-badge">${a.notes.length}</span></div>
                <div class="dai-mgmt-body">
                    ${a.notes.length ? `<div class="dai-notes-list">${a.notes.map(n => `
                        <div class="dai-note-item">
                            <div class="dai-note-header"><strong>${n.user}</strong><span>${n.date}</span></div>
                            <p>${n.text}</p>
                        </div>`).join('')}</div>` : ''}
                    <div class="dai-form-row">
                        <textarea id="daiNoteText" placeholder="Escribe una nota…" rows="2"></textarea>
                    </div>
                    <button class="dai-mgmt-btn amber" onclick="daiAddNote()">
                        <i class="material-icons">note_add</i>Agregar nota
                    </button>
                </div>
            </div>
        </div>

        <!-- ═══ TAB: HISTORIAL ═══ -->
        <div class="dai-tab-content" id="daiTab_historial" style="display:${tab === 'historial' ? 'block' : 'none'}">
            <div class="dai-detail-info" style="padding-top:14px">
                <div class="dai-detail-section-title">Trazabilidad completa</div>
            </div>
            <div class="dai-timeline">
                ${[...a.history].reverse().map(h => `
                    <div class="dai-timeline-item">
                        <div class="dai-tl-dot" style="background:${h.color}"><i class="material-icons">${h.icon}</i></div>
                        <div class="dai-tl-content">
                            <div class="dai-tl-title">${h.text}</div>
                            ${h.detail ? `<div class="dai-tl-detail"><i class="material-icons">info</i>${h.detail}</div>` : ''}
                            ${h.comment ? `<div class="dai-tl-comment">"${h.comment}"</div>` : ''}
                            <div class="dai-tl-meta">
                                <span><i class="material-icons">person</i>${h.user}</span>
                                <span><i class="material-icons">schedule</i>${_fm(h.ts)}</span>
                            </div>
                        </div>
                    </div>`).join('')}
            </div>
        </div>

    </div>`;
    // Draw CCTV canvas thumbnail after DOM update
    requestAnimationFrame(() => _drawCCTVCanvas(a));
}

// ── CCTV Canvas Thumbnail ─────────────────────────────────────────────
function _drawCCTVCanvas(a) {
    const cvs = document.getElementById('daiCCTVCanvas');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const w = cvs.width, h = cvs.height;

    // Dark road-scene gradient
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#1a1a2e');
    grd.addColorStop(0.4, '#16213e');
    grd.addColorStop(1, '#0f3460');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Road perspective lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2, h * 0.3);
        ctx.lineTo(i * (w / 7), h);
        ctx.stroke();
    }
    // Horizon line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.35);
    ctx.lineTo(w, h * 0.35);
    ctx.stroke();

    // Road dashes
    ctx.strokeStyle = 'rgba(255,200,0,0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.35);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Vehicle silhouette (simple)
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const vx = w * 0.35, vy = h * 0.5;
    ctx.fillRect(vx, vy, 60, 30);
    ctx.fillRect(vx + 8, vy - 15, 44, 18);

    // Headlights glow
    const hlGrd = ctx.createRadialGradient(vx + 60, vy + 20, 0, vx + 60, vy + 20, 40);
    hlGrd.addColorStop(0, 'rgba(255,230,100,0.15)');
    hlGrd.addColorStop(1, 'rgba(255,230,100,0)');
    ctx.fillStyle = hlGrd;
    ctx.fillRect(vx + 40, vy - 10, 80, 60);

    // Scan lines effect
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
    }

    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Top-left timestamp
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const ts = a.t_captura;
    ctx.fillText(
        `${_p(ts.getFullYear())}/${_p(ts.getMonth() + 1)}/${_p(ts.getDate())} ${_p(ts.getHours())}:${_p(ts.getMinutes())}:${_p(ts.getSeconds())}`,
        10, 18
    );

    // Bottom-left camera info
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`CAM ${a.disp} | ${a.evidencia?.cameraAngle || 'Frontal'} | ${a.evidencia?.resolution || '1080p'}`, 10, h - 10);

    // Incident marker — red box
    ctx.strokeStyle = 'rgba(239,68,68,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(vx - 10, vy - 20, 85, 60);
    ctx.setLineDash([]);
    // Label
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚠ INCIDENTE DETECTADO', vx - 10, vy - 25);
}

// ── Video Player Functions ────────────────────────────────────────────
window.daiPlayVideo = function () {
    const a = DAI.all.find(x => x.id === DAI.selected);
    if (!a || !a.evidencia) return;
    const preview = document.getElementById('daiVideoPreview');
    if (!preview) return;

    preview.innerHTML = `
        <div class="dai-video-player" id="daiVideoPlayer">
            <div class="dai-vp-screen">
                <canvas id="daiPlayerCanvas" width="400" height="225"></canvas>
                <div class="dai-vp-hud">
                    <div class="dai-vp-hud-top">
                        <span class="dai-video-rec"><span class="dai-rec-dot"></span>REC</span>
                        <span class="dai-vp-cam">${a.disp} — ${a.evidencia.cameraAngle}</span>
                    </div>
                    <div class="dai-vp-incident-tag"><i class="material-icons">warning</i>${a.tipo}</div>
                </div>
            </div>
            <div class="dai-vp-controls">
                <button class="dai-vp-btn" onclick="daiTogglePlayback()" id="daiPlayPauseBtn">
                    <i class="material-icons">pause</i>
                </button>
                <div class="dai-vp-progress-wrap">
                    <div class="dai-vp-progress" id="daiVPProgress">
                        <div class="dai-vp-progress-fill" id="daiVPFill" style="width:0%"></div>
                        <div class="dai-vp-incident-marker" style="left:${(5 + Math.random() * 20).toFixed(0)}%"
                             title="Momento del incidente"></div>
                    </div>
                    <div class="dai-vp-time">
                        <span id="daiVPCurrent">00:00</span>
                        <span>${Math.floor(a.evidencia.duration / 60)}:${_p(a.evidencia.duration % 60)}</span>
                    </div>
                </div>
                <button class="dai-vp-btn" onclick="daiVideoFullscreen()" title="Pantalla completa">
                    <i class="material-icons">fullscreen</i>
                </button>
                <button class="dai-vp-btn close" onclick="daiClosePlayer()" title="Cerrar reproductor">
                    <i class="material-icons">close</i>
                </button>
            </div>
        </div>
    `;
    // Draw player canvas
    requestAnimationFrame(() => {
        _drawCCTVCanvas(a);
        // Rename canvas id since we reuse the same function
        const playerCanvas = document.getElementById('daiPlayerCanvas');
        if (playerCanvas) {
            const ctx = playerCanvas.getContext('2d');
            // Copy the CCTV canvas look to the player canvas
            _drawPlayerScene(ctx, playerCanvas.width, playerCanvas.height, a);
        }
    });
    // Start simulated playback
    _startPlayback(a);
};

function _drawPlayerScene(ctx, w, h, a) {
    // Same dark scene but slightly brighter (playing)
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#1e1e3a');
    grd.addColorStop(0.35, '#1a2a4e');
    grd.addColorStop(1, '#0f3460');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Road perspective
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2, h * 0.3);
        ctx.lineTo(i * (w / 7), h);
        ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(0, h * 0.35); ctx.lineTo(w, h * 0.35); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,0,0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.35); ctx.lineTo(w * 0.5, h); ctx.stroke();
    ctx.setLineDash([]);

    // Vehicle — slightly larger (closer frame)
    const vx = w * 0.3, vy = h * 0.45;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(vx, vy, 80, 38);
    ctx.fillRect(vx + 10, vy - 18, 58, 22);

    const hlGrd = ctx.createRadialGradient(vx + 80, vy + 25, 0, vx + 80, vy + 25, 50);
    hlGrd.addColorStop(0, 'rgba(255,230,100,0.2)');
    hlGrd.addColorStop(1, 'rgba(255,230,100,0)');
    ctx.fillStyle = hlGrd;
    ctx.fillRect(vx + 50, vy - 15, 100, 70);

    // Scan lines
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Red bounding box
    ctx.strokeStyle = 'rgba(239,68,68,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx - 12, vy - 22, 105, 70);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚠ INCIDENTE DETECTADO', vx - 12, vy - 28);
}

let _playbackTimer = null;
function _startPlayback(a) {
    if (_playbackTimer) clearInterval(_playbackTimer);
    let elapsed = 0;
    const dur = a.evidencia.duration;
    _playbackTimer = setInterval(() => {
        elapsed += 0.5;
        if (elapsed > dur) { clearInterval(_playbackTimer); _playbackTimer = null; return; }
        const fill = document.getElementById('daiVPFill');
        const cur = document.getElementById('daiVPCurrent');
        if (fill) fill.style.width = (elapsed / dur * 100).toFixed(1) + '%';
        if (cur) {
            const s = Math.floor(elapsed);
            cur.textContent = `${_p(Math.floor(s / 60))}:${_p(s % 60)}`;
        }
    }, 500);
}

window.daiTogglePlayback = function () {
    const btn = document.getElementById('daiPlayPauseBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (_playbackTimer) {
        clearInterval(_playbackTimer);
        _playbackTimer = null;
        icon.textContent = 'play_arrow';
    } else {
        const a = DAI.all.find(x => x.id === DAI.selected);
        if (a && a.evidencia) { _startPlayback(a); icon.textContent = 'pause'; }
    }
};

window.daiClosePlayer = function () {
    if (_playbackTimer) { clearInterval(_playbackTimer); _playbackTimer = null; }
    const a = DAI.all.find(x => x.id === DAI.selected);
    if (!a) return;
    const preview = document.getElementById('daiVideoPreview');
    if (!preview || !a.evidencia) return;
    preview.innerHTML = `
        <div class="dai-video-thumb" id="daiVideoThumb" onclick="daiPlayVideo()">
            <canvas id="daiCCTVCanvas" width="400" height="225"></canvas>
            <div class="dai-video-overlay">
                <div class="dai-video-cam-info">
                    <span class="dai-video-rec"><span class="dai-rec-dot"></span>REC</span>
                    <span>${a.disp}</span>
                </div>
                <div class="dai-video-play-btn"><i class="material-icons">play_circle_filled</i></div>
                <div class="dai-video-bottom-info">
                    <span><i class="material-icons">videocam</i>${a.evidencia.cameraAngle} · ${a.evidencia.resolution}</span>
                    <span><i class="material-icons">timer</i>${a.evidencia.duration}s · ${a.evidencia.fileSize}</span>
                </div>
            </div>
        </div>
    `;
    requestAnimationFrame(() => _drawCCTVCanvas(a));
};

window.daiVideoFullscreen = function () {
    const a = DAI.all.find(x => x.id === DAI.selected);
    if (!a || !a.evidencia) return;
    // Create fullscreen modal
    let modal = document.getElementById('daiVideoModal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'daiVideoModal';
    modal.className = 'dai-video-modal';
    modal.innerHTML = `
        <div class="dai-vm-backdrop" onclick="daiCloseVideoModal()"></div>
        <div class="dai-vm-container">
            <div class="dai-vm-header">
                <div>
                    <span class="dai-video-rec"><span class="dai-rec-dot"></span>REC</span>
                    <strong>${a.disp}</strong> — ${a.evidencia.cameraAngle} · ${a.evidencia.resolution} · ${a.evidencia.fps}fps
                </div>
                <button class="dai-vm-close" onclick="daiCloseVideoModal()"><i class="material-icons">close</i></button>
            </div>
            <div class="dai-vm-screen">
                <canvas id="daiModalCanvas" width="800" height="450"></canvas>
                <div class="dai-vm-incident">
                    <i class="material-icons">warning</i>
                    <span>${a.tipo} — ${a.dep}, ${a.tramo}</span>
                </div>
            </div>
            <div class="dai-vm-info">
                <span><i class="material-icons">event</i>${_fm(a.t_captura)}</span>
                <span><i class="material-icons">timer</i>Duración: ${a.evidencia.duration}s</span>
                <span><i class="material-icons">sd_storage</i>${a.evidencia.fileSize}</span>
                <span><i class="material-icons">badge</i>${a.id}</span>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        modal.classList.add('show');
        const cvs = document.getElementById('daiModalCanvas');
        if (cvs) _drawPlayerScene(cvs.getContext('2d'), 800, 450, a);
    });
};

window.daiCloseVideoModal = function () {
    const modal = document.getElementById('daiVideoModal');
    if (modal) { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); }
};

// ── File icon ─────────────────────────────────────────────────────────
function _fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    return 'insert_drive_file';
}

// ════════════════════════════════════════════════════════════════════════
//  MANAGEMENT ACTIONS
// ════════════════════════════════════════════════════════════════════════

// ★ Quick one-click actions (speed-first) ─────────────────────────────

// Resolution methods
const RESOLUTION_METHODS = [
    { value: 'intervencion_campo', label: 'Intervención en campo', icon: 'engineering' },
    { value: 'correccion_remota', label: 'Corrección remota', icon: 'settings_remote' },
    { value: 'falsa_alarma', label: 'Falsa alarma', icon: 'report_off' },
    { value: 'mantenimiento', label: 'Mantenimiento preventivo', icon: 'build' },
    { value: 'escalamiento', label: 'Escalado a otra área', icon: 'escalator_warning' },
    { value: 'otro', label: 'Otro', icon: 'more_horiz' }
];

// Show inline resolve panel
window.daiQuickResolve = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const panel = document.getElementById('daiResolvePanel');
    if (panel) { panel.classList.toggle('show'); return; }
    _closeAllInlinePanels();
    const qa = document.querySelector('.dai-quick-actions');
    if (!qa) return;
    const div = document.createElement('div');
    div.id = 'daiResolvePanel';
    div.className = 'dai-resolve-panel show';
    div.innerHTML = `
        <div class="dai-resolve-title"><i class="material-icons">check_circle</i> ¿Cómo se resolvió?</div>
        <div class="dai-resolve-options">
            ${RESOLUTION_METHODS.map(m => `
                <label class="dai-resolve-opt" data-val="${m.value}">
                    <input type="radio" name="daiResolveMethod" value="${m.value}">
                    <span class="dai-resolve-opt-inner">
                        <i class="material-icons">${m.icon}</i>
                        <span>${m.label}</span>
                    </span>
                </label>
            `).join('')}
        </div>
        <div class="dai-resolve-comment">
            <textarea id="daiResolveComment" placeholder="Descripción breve de la resolución (opcional)…" rows="2"></textarea>
        </div>
        <div class="dai-resolve-actions">
            <button class="dai-resolve-btn confirm" onclick="daiConfirmResolve()">
                <i class="material-icons">check_circle</i>Confirmar resolución
            </button>
            <button class="dai-resolve-btn cancel" onclick="daiCancelResolve()">
                Cancelar
            </button>
        </div>
    `;
    qa.insertAdjacentElement('afterend', div);
};

// Confirm resolve with method
window.daiConfirmResolve = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const radio = document.querySelector('input[name="daiResolveMethod"]:checked');
    if (!radio) { _toast('Selecciona cómo se resolvió', 'warning', 'warning'); return; }
    const method = radio.value;
    const methodLabel = RESOLUTION_METHODS.find(m => m.value === method)?.label || method;
    const comment = document.getElementById('daiResolveComment')?.value.trim() || '';
    const oldEst = a.estado;
    a.estado = 'resuelta';
    a.t_resolucion = new Date();
    a.resolutionMethod = method;
    a.resolutionLabel = methodLabel;
    a.resolutionComment = comment;
    a.history.push({
        ts: new Date(), type: 'status_change', icon: 'check_circle', color: '#16a34a',
        text: `Estado: ${_estLabel[oldEst]} → Resuelta`,
        detail: `Método: ${methodLabel}${comment ? ' — ' + comment : ''}`,
        user: 'Admin Principal'
    });
    daiCancelResolve();
    _refresh(a);
    _toast('✅ Alerta resuelta — ' + methodLabel, 'check_circle', 'success');
};

// Cancel resolve
window.daiCancelResolve = function () {
    _closeInlinePanel('daiResolvePanel');
};

// ── Helper: close any open inline panel ──────────────────────────────
window._closeInlinePanel = function (id) {
    const panel = document.getElementById(id);
    if (panel) { panel.classList.remove('show'); setTimeout(() => panel.remove(), 250); }
};
function _closeAllInlinePanels() {
    ['daiResolvePanel', 'daiAssignPanel', 'daiEmailPanel'].forEach(window._closeInlinePanel);
}

// ── Lock/Unlock Logic ────────────────────────────────────────────────
window.daiLockAlert = async function (id) {
    try {
        const r = await fetch(`/api/alerts/${id}/lock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (r.status === 409) {
            _toast('Incidente bloqueado por otro usuario', 'lock', 'warning');
        }
    } catch (e) { console.error('Error locking alert:', e); }
};

window.daiUnlockAlert = async function (id) {
    try {
        await fetch(`/api/alerts/${id}/unlock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
    } catch (e) { console.error('Error unlocking alert:', e); }
};

// ★ Inline Assign Panel ───────────────────────────────────────────────
window.daiQuickAssign = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;

    // Si está bloqueado por otro, no permitir asignar
    if (a.locked_by && a.locked_by !== _currentUser.id) {
        _toast('No puedes asignar un incidente bloqueado', 'lock', 'warning');
        return;
    }

    const existing = document.getElementById('daiAssignPanel');
    if (existing) { existing.classList.toggle('show'); return; }
    _closeAllInlinePanels();
    const qa = document.querySelector('.dai-quick-actions');
    if (!qa) return;
    const div = document.createElement('div');
    div.id = 'daiAssignPanel';
    div.className = 'dai-inline-panel show';
    div.innerHTML = `
        <div class="dai-inline-title" style="color:#4f46e5"><i class="material-icons">person_add</i> Asignar a usuario</div>
        <div class="dai-assign-users">
            ${DAI_USERS.map(u => `
                <label class="dai-assign-user-card ${a.assignedTo === u.name ? 'current' : ''}" data-name="${u.name}" data-id="${u.id}">
                    <input type="radio" name="daiAssignUser" value="${u.id}" data-name="${u.name}" ${a.assignedTo === u.name ? 'checked' : ''}>
                    <span class="dai-assign-card-inner">
                        <span class="dai-assign-avatar">${u.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                        <span class="dai-assign-info">
                            <span class="dai-assign-name">${u.name}</span>
                            <span class="dai-assign-role">${u.role}</span>
                        </span>
                    </span>
                </label>
            `).join('')}
        </div>
        <div class="dai-inline-actions">
            <button class="dai-inline-btn confirm" style="background:#4f46e5" onclick="daiConfirmAssign()">
                <i class="material-icons">assignment_ind</i>Asignar
            </button>
            <button class="dai-inline-btn cancel" onclick="_closeInlinePanel('daiAssignPanel')">
                Cancelar
            </button>
        </div>
    `;
    qa.insertAdjacentElement('afterend', div);
};

window.daiConfirmAssign = async function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const radio = document.querySelector('input[name="daiAssignUser"]:checked');
    if (!radio) { _toast('Selecciona un usuario', 'warning', 'warning'); return; }

    const userId = radio.value;
    const userName = radio.dataset.name;

    try {
        const r = await fetch(`/api/alerts/${a.id}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ userId, userName })
        });

        if (r.ok) {
            _toast(`✅ Alerta asignada a ${userName}`, 'check_circle', 'success');
            _closeInlinePanel('daiAssignPanel');
        } else {
            const err = await r.json();
            _toast(err.error || 'Error al asignar', 'error', 'error');
        }
    } catch (e) {
        console.error('Error assigning:', e);
        _toast('Error de conexión', 'error', 'error');
    }
};

// ★ Inline Email Panel ────────────────────────────────────────────────
window.daiQuickEmail = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const existing = document.getElementById('daiEmailPanel');
    if (existing) { existing.classList.toggle('show'); return; }
    _closeAllInlinePanels();
    const qa = document.querySelector('.dai-quick-actions');
    if (!qa) return;
    const div = document.createElement('div');
    div.id = 'daiEmailPanel';
    div.className = 'dai-inline-panel show';
    div.innerHTML = `
        <div class="dai-inline-title" style="color:#2563eb"><i class="material-icons">email</i> Enviar por correo</div>
        <div class="dai-email-form">
            <div class="dai-email-field">
                <label>Correo electrónico</label>
                <input type="email" id="daiInlineEmailTo" placeholder="correo@ejemplo.com">
            </div>
            <div class="dai-email-field">
                <label>Mensaje (opcional)</label>
                <textarea id="daiInlineEmailMsg" placeholder="Contexto adicional sobre la alerta…" rows="2"></textarea>
            </div>
        </div>
        <div class="dai-inline-actions">
            <button class="dai-inline-btn confirm" style="background:#2563eb" onclick="daiConfirmEmail()">
                <i class="material-icons">send</i>Enviar correo
            </button>
            <button class="dai-inline-btn cancel" onclick="_closeInlinePanel('daiEmailPanel')">
                Cancelar
            </button>
        </div>
    `;
    qa.insertAdjacentElement('afterend', div);
    setTimeout(() => document.getElementById('daiInlineEmailTo')?.focus(), 300);
};

window.daiConfirmEmail = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const email = document.getElementById('daiInlineEmailTo')?.value.trim();
    const msg = document.getElementById('daiInlineEmailMsg')?.value.trim();
    if (!email || !email.includes('@')) { _toast('Ingresa un correo válido', 'warning', 'warning'); return; }
    a.history.push({
        ts: new Date(), type: 'email_sent', icon: 'email', color: '#3b82f6',
        text: `Enviada por correo a ${email}`, comment: msg || null, user: 'Admin Principal'
    });
    _closeInlinePanel('daiEmailPanel');
    _renderDetail(a);
    _toast(`📧 Correo enviado a ${email}`, 'email', 'success');
};

window.daiQuickReview = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const oldEst = a.estado; a.estado = 'en_revision';
    if (!a.t_respuesta) a.t_respuesta = new Date();
    a.history.push({
        ts: new Date(), type: 'status_change', icon: 'visibility', color: '#f59e0b',
        text: `Estado: ${_estLabel[oldEst]} → En Revisión (acción rápida)`, user: 'Admin Principal'
    });
    _refresh(a);
    _toast('👁️ Alerta en revisión', 'visibility', 'info');
};
window.daiQuickReopen = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    a.estado = 'activa'; a.t_resolucion = null;
    a.resolutionMethod = null; a.resolutionLabel = null; a.resolutionComment = null;
    a.history.push({
        ts: new Date(), type: 'status_change', icon: 'replay', color: '#ea580c',
        text: `Alerta reabierta → Activa`, user: 'Admin Principal'
    });
    _refresh(a);
    _toast('🔄 Alerta reabierta', 'replay', 'warning');
};

// Full status change with comment
window.daiChangeStatus = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const newSt = document.getElementById('daiNewStatus').value;
    const comment = document.getElementById('daiStatusComment').value.trim();
    if (!comment) { _toast('El comentario es obligatorio', 'warning', 'warning'); return; }
    if (newSt === a.estado) { _toast('Selecciona un estado diferente', 'info', 'info'); return; }
    const oldSt = a.estado;
    a.estado = newSt;
    if (newSt === 'resuelta') {
        a.t_resolucion = new Date();
        a.resolutionMethod = 'otro';
        a.resolutionLabel = 'Cambio manual de estado';
        a.resolutionComment = comment;
    }
    if (newSt !== 'creado' && !a.t_respuesta) a.t_respuesta = new Date();
    a.history.push({
        ts: new Date(), type: 'status_change', icon: 'swap_horiz', color: '#f59e0b',
        text: `Estado: ${_estLabel[oldSt]} → ${_estLabel[newSt]}`, comment, user: 'Admin Principal'
    });
    _refresh(a);
    _toast(`Estado → ${_estLabel[newSt]}`, 'check_circle', 'success');
};

// Assign user
window.daiAssignUser = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const name = document.getElementById('daiAssignSelect').value;
    if (!name) { _toast('Selecciona un usuario', 'warning', 'warning'); return; }
    a.assignedTo = name;
    a.history.push({
        ts: new Date(), type: 'assignment', icon: 'person_add', color: '#6366f1',
        text: `Asignada a ${name}`, user: 'Admin Principal'
    });
    _refresh(a);
    _toast(`Asignada a ${name}`, 'assignment_ind', 'success');
};

// Send email
window.daiSendEmail = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const email = document.getElementById('daiEmailTo').value.trim();
    const msg = document.getElementById('daiEmailMsg').value.trim();
    if (!email || !email.includes('@')) { _toast('Ingresa un correo válido', 'warning', 'warning'); return; }
    a.history.push({
        ts: new Date(), type: 'email_sent', icon: 'email', color: '#3b82f6',
        text: `Enviada por correo a ${email}`, comment: msg || null, user: 'Admin Principal'
    });
    _renderDetail(a);
    _toast(`Correo enviado a ${email}`, 'email', 'success');
};

// Attachments
window.daiAddAttachment = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const input = document.getElementById('daiFileInput');
    if (!input || !input.files.length) return;
    const file = input.files[0];
    const sz = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;
    a.attachments.push({ name: file.name, size: sz, date: _now() });
    a.history.push({
        ts: new Date(), type: 'attachment', icon: 'attach_file', color: '#64748b',
        text: `Adjunto: ${file.name} (${sz})`, user: 'Admin Principal'
    });
    input.value = '';
    _refresh(a);
    _toast(`Adjunto: ${file.name}`, 'attach_file', 'success');
};
window.daiRemoveAttachment = function (idx) {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const rm = a.attachments.splice(idx, 1)[0];
    if (rm) a.history.push({
        ts: new Date(), type: 'attachment_removed', icon: 'delete', color: '#ef4444',
        text: `Eliminado: ${rm.name}`, user: 'Admin Principal'
    });
    _refresh(a);
};

// Notes
window.daiAddNote = function () {
    const a = DAI.all.find(x => x.id === DAI.selected); if (!a) return;
    const text = document.getElementById('daiNoteText').value.trim();
    if (!text) { _toast('Escribe una nota', 'warning', 'warning'); return; }
    a.notes.push({ text, user: 'Admin Principal', date: _now() });
    a.history.push({
        ts: new Date(), type: 'note', icon: 'sticky_note_2', color: '#ca8a04',
        text: `Nota agregada`, comment: text, user: 'Admin Principal'
    });
    _renderDetail(a);
    _toast('Nota agregada', 'sticky_note_2', 'success');
};

// Refresh everything
function _refresh(a) {
    _buildStatCounts(); _renderStatBar(); _renderStatusTabCounts();
    _applyFilters(); _renderRows(); _renderDetail(a);
}

// ── Filter Modal ──────────────────────────────────────────────────────
window.openDaiFilterModal = function () {
    _buildFilterModalContent();
    document.getElementById('daiFilterModalOverlay').classList.add('open');
};
window.closeDaiFilterModal = function () {
    document.getElementById('daiFilterModalOverlay').classList.remove('open');
};
function _buildFilterModalContent() {
    const tiposEl = document.getElementById('daiModalTipos');
    if (tiposEl) tiposEl.innerHTML = DAI_TIPOS.map(t => `
        <span class="dai-tipo-tag ${DAI.f.tipos.has(t) ? 'active' : ''}" onclick="daiToggleTipoTag(this,'${t.replace(/'/g, "\\\'")}')">
            ${t}</span>`).join('');
    const depEl = document.getElementById('daiModalDep');
    if (depEl) {
        depEl.innerHTML = `<option value="">Todos</option>` + DEP_NAMES.map(d => `<option value="${d}" ${DAI.f.dep === d ? 'selected' : ''}>${d}</option>`).join('');
        depEl.onchange = () => { DAI.f.dep = depEl.value; _updateTramoOpts(depEl.value); };
    }
    _updateTramoOpts(DAI.f.dep);
    const dEl = document.getElementById('daiModalDisp');
    if (dEl) { dEl.value = DAI.f.dispTipo; dEl.onchange = () => DAI.f.dispTipo = dEl.value; }
    const df = document.getElementById('daiModalDateFrom'), dt = document.getElementById('daiModalDateTo');
    if (df) { df.value = DAI.f.dateFrom; df.onchange = () => DAI.f.dateFrom = df.value; }
    if (dt) { dt.value = DAI.f.dateTo; dt.onchange = () => DAI.f.dateTo = dt.value; }
}
function _updateTramoOpts(dep) {
    const el = document.getElementById('daiModalTramo'); if (!el) return;
    const tramos = dep ? (DAI_DEPTOS[dep]?.tramos || []) : [];
    el.innerHTML = `<option value="">Todos</option>` + tramos.map(t => `<option value="${t}" ${DAI.f.tramo === t ? 'selected' : ''}>${t}</option>`).join('');
    el.onchange = () => DAI.f.tramo = el.value;
}
window.daiToggleTipoTag = function (el, t) {
    el.classList.toggle('active');
    if (el.classList.contains('active')) DAI.f.tipos.add(t); else DAI.f.tipos.delete(t);
};
window.daiClearAdvancedFilters = function () {
    DAI.f.tipos.clear(); DAI.f.dep = ''; DAI.f.tramo = ''; DAI.f.dispTipo = '';
    DAI.f.dateFrom = ''; DAI.f.dateTo = ''; DAI.f.quickDate = ''; DAI.severityFilter = '';
    DAI.f.severidad = new Set(SEV_LEVELS);
    _renderStatBar(); _applyFilters(); _renderRows(); closeDaiFilterModal();
};

// ── Export ─────────────────────────────────────────────────────────────
window.daiExportCSV = function () {
    const data = DAI.filtered.length ? DAI.filtered : DAI.all;
    const hdrs = ['ID', 'Tipo Registro', 'Tipo Alerta', 'Departamento', 'Tramo', 'Código Vía', 'Poste Ref',
        'Dispositivo', 'Tipo Disp', 'Longitud', 'Latitud', 'Fecha', 'Severidad', 'Estado', 'Asignado',
        'T. Captura', 'T. Plataforma', 'Latencia', 'T. Respuesta', 'T. Resolución'];
    const rows = data.map(a => [a.id, a.tipo_registro, a.tipo, a.dep, a.tramo, a.codigo_via, a.poste_ref,
    a.disp, a.dTipo, a.lng, a.lat, a.fecha_str, a.sev, a.estado, a.assignedTo || '',
    _fm(a.t_captura), _fm(a.t_plataforma), `${a.latencia_ms}ms`,
    a.t_respuesta ? _fm(a.t_respuesta) : '', a.t_resolucion ? _fm(a.t_resolucion) : ''
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = [hdrs.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `alertas_dai_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
    _toast(`Exportando ${data.length} alertas…`, 'download', 'info');
};

// ── Toast ─────────────────────────────────────────────────────────────
function _toast(msg, icon = 'info', type = 'info') {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="material-icons">${icon}</i><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ════════════════════════════════════════════════════════════════════════
//  DAI SOUND ENGINE — urgencia sonora dinámica
//  Web Audio API (sin archivos externos)
//  Velocidad de pitido crece con el número de alertas activas
// ════════════════════════════════════════════════════════════════════════
const DAI_SOUND = {
    _ctx: null,
    _timer: null,
    _activeCount: 0,
    _initialized: false,

    // Inicializar el AudioContext (requiere gesto del usuario)
    _init() {
        if (this._ctx) return;
        try {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { }
    },

    // Generar un pitido corto (beep sinusoidal con fade)
    beep(freq = 880, dur = 0.08, vol = 0.25) {
        if (!this._ctx) return;
        try {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.connect(gain);
            gain.connect(this._ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol, this._ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
            osc.start(this._ctx.currentTime);
            osc.stop(this._ctx.currentTime + dur + 0.01);
        } catch (e) { }
    },

    // Calcular intervalo en ms según cantidad de alertas activas
    // 0 → silencio  |  1 → 8s  |  4 → 2s  |  8+ → 400ms
    _interval(count) {
        if (count <= 0) return 0;
        const ms = Math.max(400, 8000 / (1 + (count - 1) * 0.9));
        return ms;
    },

    // Pitch aumenta con la urgencia (440hz base → hasta 1320hz)
    _freq(count) {
        return Math.min(1320, 440 + (count - 1) * 110);
    },

    // Parar el timer actual
    _stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    // Actualizar urgencia — llamado en cada renderizado de filas
    updateUrgency(activeCount) {
        if (activeCount === this._activeCount) return; // sin cambio
        this._activeCount = activeCount;
        this._stop();
        if (activeCount <= 0) return;

        const interval = this._interval(activeCount);
        const freq = this._freq(activeCount);

        // Primer pitido inmediato si acaba de aparecer una alerta nueva
        if (this._ctx) this.beep(freq);

        this._timer = setInterval(() => {
            if (!this._ctx) return;
            this.beep(freq);
            // Si es crítico (muchas alertas) hacer doble pitido
            if (activeCount >= 5) {
                setTimeout(() => this.beep(freq * 1.2, 0.06, 0.18), 120);
            }
        }, interval);
    },

    // Activar el motor con el primer clic del usuario
    enable() {
        this._init();
        this._initialized = true;
        // Reproducir un pitido de prueba silencioso para desbloquear el contexto
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
        this.beep(660, 0.05, 0.1);
    }
};

// Inicializar el contexto de audio en el primer clic del usuario
// (requisito de los navegadores para autoplay)
document.addEventListener('click', function _daiSoundInit() {
    DAI_SOUND.enable();
    document.removeEventListener('click', _daiSoundInit);
}, { once: true });

// ── Mute toggle — expuesto globalmente para el botón de la topbar ─────
DAI_SOUND._muted = false;

// Parchea beep() para respetar el estado mute
const _origBeep = DAI_SOUND.beep.bind(DAI_SOUND);
DAI_SOUND.beep = function (freq, dur, vol) {
    if (this._muted) return;
    _origBeep(freq, dur, vol);
};

window.daiToggleMute = function () {
    DAI_SOUND._muted = !DAI_SOUND._muted;
    const icon = document.getElementById('daiMuteIcon');
    const btn = document.getElementById('daiMuteBtn');
    if (!icon || !btn) return;
    if (DAI_SOUND._muted) {
        icon.textContent = 'volume_off';
        btn.style.color = '#ef4444';
        btn.title = 'Activar alertas sonoras';
        DAI_SOUND._stop(); // Para el timer mientras esté silenciado
    } else {
        icon.textContent = 'volume_up';
        btn.style.color = '';
        btn.title = 'Silenciar alertas sonoras';
        // Reinicia el sonido según urgencia actual
        const activeCount = DAI.all.filter(a => a.estado === 'activa' || a.estado === 'creado').length;
        DAI_SOUND._activeCount = 0; // fuerza reinicio
        DAI_SOUND.updateUrgency(activeCount);
    }
};

// ── Fix dinámico de altura del split-pane ─────────────────────────────
// Mide dónde empieza el split-pane en el viewport y le asigna
// exactamente la altura que queda. Bypasea cualquier problema de
// cadena CSS (padding, margin, flex) de los contenedores padre.
function _daiFixHeight() {
    const splitPane = document.querySelector('.dai-split-pane');
    if (!splitPane) return;
    const rect = splitPane.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 2; // 2px buffer
    if (available > 120) {
        splitPane.style.height = available + 'px';
        splitPane.style.flex = 'none';
    }
}

// Exponer para que el admin panel lo llame cuando cambia de tab
window.daiFixHeight = _daiFixHeight;

// Llamar cada vez que cambia el tamaño de la ventana
window.addEventListener('resize', _daiFixHeight);

// ════════════════════════════════════════════════════════════════════════
//  LIVE CONNECTOR — Server-Sent Events (SSE) for real-time alerts
//  Auto-reconnects, injects new alerts, updates badge & toast
// ════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var _es = null;           // EventSource instance
    var _reconnDelay = 1000;  // exponential backoff (ms)
    var _maxReconn = 30000;   // max 30s between retries
    var _isConnected = false;

    // ── Fetch existing alert history ──────────────────────────────────
    window.daiFetchInitialAlerts = function () {
        console.log('[DAI Live] Cargando historial de alertas...');
        fetch('/api/alerts')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success && data.alerts) {
                    // Filter out any we already have (by ID) just in case
                    var existingIds = new Set(DAI.all.map(function (a) { return a.id; }));
                    var toAdd = data.alerts.filter(function (a) { return !existingIds.has(a.id); });

                    if (toAdd.length > 0) {
                        var hydrated = toAdd.map(_hydrateAlert);
                        // Add to all and sort
                        DAI.all = hydrated.concat(DAI.all);
                        DAI.all.sort(function (a, b) { return b.fecha - a.fecha; });

                        console.log('[DAI Live] Historial cargado: ' + hydrated.length + ' alertas');

                        // Refresh UI if necessary
                        _buildStatCounts();
                        _updateNotifBadge();
                        if (typeof _renderStatBar === 'function') _renderStatBar();
                        if (typeof _renderStatusTabCounts === 'function') _renderStatusTabCounts();

                        var daiSection = document.getElementById('alertas-dai');
                        if (daiSection && daiSection.style.display !== 'none') {
                            if (typeof _applyFilters === 'function') _applyFilters();
                            if (typeof _renderRows === 'function') _renderRows();
                        }
                    }
                }
            })
            .catch(function (err) { console.error('[DAI Live] Error cargando historial:', err); });
    };

    // ── Start the SSE connection ──────────────────────────────────────
    window.daiStartLiveUpdates = function () {
        // Fetch existing history first
        daiFetchInitialAlerts();

        if (_es) { try { _es.close(); } catch (e) { } }

        var url = '/api/alerts/stream';
        _es = new EventSource(url);

        // ─ Connected ─
        _es.addEventListener('connected', function (e) {
            _isConnected = true;
            _reconnDelay = 1000; // reset backoff
            _updateLiveIndicator(true);
            console.log('[DAI Live] Conectado al stream SSE');
        });

        // ─ New alert ─
        _es.addEventListener('new_alert', function (e) {
            try {
                var raw = JSON.parse(e.data);
                var alert = _hydrateAlert(raw);
                _injectAlert(alert);
            } catch (err) {
                console.error('[DAI Live] Error procesando alerta:', err);
            }
        });

        // ─ Alert Locked ─
        _es.addEventListener('alert_locked', function (e) {
            try {
                var data = JSON.parse(e.data);
                var alert = DAI.all.find(a => a.id === data.id);
                if (alert) {
                    alert.locked_by = data.locked_by;
                    alert.locked_by_name = data.locked_by_name;
                    _refreshRow(alert.id);
                    if (DAI.selected === alert.id) _renderDetail(alert);
                }
            } catch (err) { console.error('Error alert_locked:', err); }
        });

        // ─ Alert Unlocked ─
        _es.addEventListener('alert_unlocked', function (e) {
            try {
                var data = JSON.parse(e.data);
                var alert = DAI.all.find(a => a.id === data.id);
                if (alert) {
                    alert.locked_by = null;
                    alert.locked_by_name = null;
                    _refreshRow(alert.id);
                    if (DAI.selected === alert.id) _renderDetail(alert);
                }
            } catch (err) { console.error('Error alert_unlocked:', err); }
        });

        // ─ Alert Updated (Assignment, etc) ─
        _es.addEventListener('alert_updated', function (e) {
            try {
                var data = JSON.parse(e.data);
                var alert = DAI.all.find(a => a.id === data.id);
                if (alert) {
                    if (data.assigned_to) {
                        alert.assignedTo = data.assigned_to_name || data.assigned_to;
                    }
                    if (data.history_latest) {
                        alert.history.push(data.history_latest);
                    }
                    _refreshRow(alert.id);
                    if (DAI.selected === alert.id) _renderDetail(alert);
                }
            } catch (err) { console.error('Error alert_updated:', err); }
        });

        // ─ Heartbeat ─
        _es.addEventListener('heartbeat', function () {
            _isConnected = true;
            _updateLiveIndicator(true);
        });

        // ─ Error / disconnect ─
        _es.onerror = function () {
            _isConnected = false;
            _updateLiveIndicator(false);
            _es.close();
            console.warn('[DAI Live] Desconectado, reconectando en ' + _reconnDelay + 'ms...');
            setTimeout(function () {
                _reconnDelay = Math.min(_reconnDelay * 2, _maxReconn);
                daiStartLiveUpdates();
            }, _reconnDelay);
        };
    };

    // ── Convert SSE JSON → match frontend DAI record format ───────────
    function _hydrateAlert(raw) {
        var fecha = new Date(raw.fecha || raw.fecha_ts);
        var t_cap = raw.t_captura ? new Date(raw.t_captura) : fecha;
        var t_plat = raw.t_plataforma ? new Date(raw.t_plataforma) : fecha;
        return {
            id: raw.id,
            seq: raw.seq,
            tipo_registro: raw.tipo_registro || 'Automático',
            tipo: raw.tipo,
            sev: raw.sev,
            estado: raw.estado || 'creado',
            dep: raw.dep,
            tramo: raw.tramo,
            codigo_via: raw.codigo_via || '00-00',
            poste_ref: raw.poste_ref || '000-0',
            disp: raw.disp,
            dTipo: raw.dTipo || 'WIM',
            lng: raw.lng,
            lat: raw.lat,
            fecha: fecha,
            fecha_str: _fm(fecha),
            t_captura: t_cap,
            t_plataforma: t_plat,
            latencia_ms: raw.latencia_ms || 0,
            t_respuesta: raw.t_respuesta ? new Date(raw.t_respuesta) : null,
            t_resolucion: raw.t_resolucion ? new Date(raw.t_resolucion) : null,
            evidencia: raw.evidencia || null,
            assignedTo: raw.assignedTo || null,
            locked_by: raw.locked_by || null,
            locked_by_name: raw.locked_by_name || null,
            attachments: raw.attachments || [],
            notes: raw.notes || [],
            history: (raw.history || []).map(function (h) {
                return { ts: new Date(h.ts), type: h.type, icon: h.icon, color: h.color, text: h.text, user: h.user };
            })
        };
    }

    // ── Inject alert into DAI.all and refresh the UI ──────────────────
    function _injectAlert(alert) {
        // Prepend to DAI.all (newest first)
        DAI.all.unshift(alert);

        // Rebuild counts
        _buildStatCounts();

        // Re-render stat bar if visible
        if (document.getElementById('daiStatBar')) {
            _renderStatBar();
        }

        // Re-render status tab counts
        _renderStatusTabCounts();

        // Re-apply filters and re-render rows if DAI module is active
        var daiSection = document.getElementById('alertas-dai');
        if (daiSection && daiSection.style.display !== 'none') {
            _applyFilters();
            _renderRows();

            // Re-render latency dashboard if it's expanded
            if (document.getElementById('daiLatencyDashboard') && document.getElementById('daiLatencyDashboard').innerHTML) {
                _renderLatencyDashboard();
            }
        }

        // Update notification badge (always, regardless of current section)
        _updateNotifBadge();

        // Show toast for critical/alta alerts if enabled
        console.log('[DAI Live] ¿Mostrar toast?', alert.id, 'Sev:', alert.sev, 'Enabled:', DAI.notifDaiEnabled);
        if ((alert.sev === 'critica' || alert.sev === 'alta') && DAI.notifDaiEnabled) {
            _showAlertToast(alert);
        }

        console.log('[DAI Live] Alerta inyectada: ' + alert.id + ' (' + alert.sev + ') → ' + alert.tipo);
    }

    // ── Update notification bell badge ────────────────────────────────
    function _updateNotifBadge() {
        var pending = DAI.all.filter(function (a) { return a.estado !== 'resuelta'; }).length;
        var badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = pending > 99 ? '99+' : pending;
            badge.style.display = pending > 0 ? '' : 'none';
            // Pulse animation on update
            badge.classList.remove('notif-badge-pulse');
            void badge.offsetWidth; // force reflow
            badge.classList.add('notif-badge-pulse');
        }
        // Also update header subtitle if panel is open
        var sub = document.getElementById('notifSubtitle');
        if (sub) {
            var crit = DAI.all.filter(function (a) { return a.sev === 'critica' && a.estado !== 'resuelta'; }).length;
            sub.textContent = pending + ' alertas pendientes · ' + crit + ' críticas';
        }
        // Update panel body if open
        if (typeof renderNotifAlerts === 'function' && document.getElementById('notifPanel') &&
            document.getElementById('notifPanel').classList.contains('open')) {
            renderNotifAlerts();
        }
    }

    // ── Toast notification for critical alerts ────────────────────────
    function _showAlertToast(alert) {
        var container = document.getElementById('alertToastContainer');
        if (!container) {
            // Create container if not present
            container = document.createElement('div');
            container.id = 'alertToastContainer';
            container.className = 'alert-toast-container';
            document.body.appendChild(container);
        }

        var sevLabel = { critica: 'CRÍTICA', alta: 'ALTA', media: 'MEDIA', baja: 'BAJA' };
        var sevIcon = { critica: 'error', alta: 'warning', media: 'info', baja: 'check_circle' };

        var toast = document.createElement('div');
        toast.className = 'alert-toast alert-toast-' + alert.sev;
        toast.innerHTML =
            '<div class="alert-toast-strip ' + alert.sev + '"></div>' +
            '<div class="alert-toast-icon"><i class="material-icons">' + (sevIcon[alert.sev] || 'warning') + '</i></div>' +
            '<div class="alert-toast-body">' +
            '<div class="alert-toast-title">' +
            '<span class="alert-toast-sev">' + (sevLabel[alert.sev] || alert.sev) + '</span> ' + alert.tipo +
            '</div>' +
            '<div class="alert-toast-meta">' +
            '<span><i class="material-icons" style="font-size:12px;vertical-align:-2px;">location_on</i> ' + alert.dep + '</span>' +
            '<span><i class="material-icons" style="font-size:12px;vertical-align:-2px;">router</i> ' + alert.disp.replace('INV-DAI-', '') + '</span>' +
            '</div>' +
            '</div>' +
            '<button class="alert-toast-close" onclick="this.parentElement.remove()"><i class="material-icons">close</i></button>';

        // Click to navigate to alert
        toast.addEventListener('click', function (e) {
            if (e.target.closest('.alert-toast-close')) return;
            // Navigate to DAI section and select the alert
            if (typeof showSection === 'function') showSection('alertas-dai');
            setTimeout(function () {
                if (typeof daiSelectAlert === 'function') daiSelectAlert(alert.id);
            }, 500);
            toast.remove();
        });

        container.prepend(toast);

        // Auto-remove after 10 seconds
        setTimeout(function () {
            toast.classList.add('alert-toast-exit');
            setTimeout(function () { toast.remove(); }, 400);
        }, 10000);

        // Limit visible toasts to 5
        while (container.children.length > 5) {
            container.lastChild.remove();
        }
    }

    // ── Live indicator ("● En vivo" badge) ────────────────────────────
    function _updateLiveIndicator(connected) {
        var el = document.getElementById('daiLiveIndicator');
        if (!el) return;
        if (connected) {
            el.className = 'dai-live-indicator live';
            el.innerHTML = '<span class="dai-live-dot"></span> En vivo';
        } else {
            el.className = 'dai-live-indicator offline';
            el.innerHTML = '<span class="dai-live-dot"></span> Reconectando…';
        }
    }

    // ── Background badge updater (every 10s) ──────────────────────────
    // Ensures the badge stays current even without new SSE events
    setInterval(function () {
        if (DAI.all.length > 0) _updateNotifBadge();
    }, 10000);

    // ── Auto-start SSE when page loads ────────────────────────────────
    // Slight delay to let the DOM and initial data load first
    setTimeout(function () {
        daiStartLiveUpdates();
        // Also do an initial badge update
        if (DAI.all.length > 0) _updateNotifBadge();
    }, 3000);

})();
