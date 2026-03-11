/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  VIITS - Script de inicialización de BD de prueba (SQLite)    ║
 * ║  Crea todas las tablas y carga datos de ejemplo               ║
 * ║  Ejecutar: node scripts/seed-dev.js                           ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

const path = require('path');
const fs = require('fs');

// Asegurar que existe la carpeta data/
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Importar el adaptador SQLite
const { _db: db } = require('../config/database-dev');

console.log('\n🚀 Inicializando base de datos de prueba SQLite...\n');

// ============================================================
// CREAR TABLAS
// ============================================================

db.exec(`
-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    email_mask TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    verification_code TEXT,
    verification_code_expires TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    totp_secret TEXT,
    totp_enabled INTEGER DEFAULT 0,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    updated_by TEXT
);

-- Tabla de reportes/documentos
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    is_public INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT
);

-- Tabla de slider de imágenes
CREATE TABLE IF NOT EXISTS slider_images (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    image_path TEXT NOT NULL,
    alt_text TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    link_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT
);

-- Tabla de estadísticas de tráfico
CREATE TABLE IF NOT EXISTS traffic_stats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sector_id TEXT NOT NULL,
    sector_name TEXT NOT NULL,
    department TEXT NOT NULL,
    date TEXT NOT NULL,
    average_speed REAL,
    total_vehicles INTEGER DEFAULT 0,
    vehicles_over_limit INTEGER DEFAULT 0,
    metric_type TEXT,
    device_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabla de descargas
CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    file_name TEXT,
    filters TEXT,
    status TEXT DEFAULT 'pending',
    download_url TEXT,
    expires_at TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_activity TEXT DEFAULT (datetime('now'))
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT
);

-- Tabla de dispositivos confiables para 2FA
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT,
    label TEXT DEFAULT 'Dispositivo',
    created_at TEXT DEFAULT (datetime('now')),
    last_used TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de eventos de analítica web (tracking anónimo)
CREATE TABLE IF NOT EXISTS page_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    section TEXT,
    event_type TEXT NOT NULL DEFAULT 'pageview',
    event_target TEXT,
    device_type TEXT DEFAULT 'desktop',
    browser TEXT,
    os TEXT,
    screen_width INTEGER,
    referrer TEXT,
    duration_seconds INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

    -- Tabla de alertas DAI
    CREATE TABLE IF NOT EXISTS dai_alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        seq_id TEXT UNIQUE NOT NULL,
        tipo TEXT NOT NULL,
        severidad TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'activa',
        departamento TEXT NOT NULL,
        tramo TEXT,
        codigo_via TEXT,
        poste_referencia TEXT,
        dispositivo_id TEXT,
        dispositivo_tipo TEXT,
        latitud REAL,
        longitud REAL,
        tipo_registro TEXT DEFAULT 'Automático',
        fecha_captura TEXT NOT NULL,
        fecha_plataforma TEXT NOT NULL DEFAULT (datetime('now')),
        latencia_ms INTEGER,
        evidencia_json TEXT,
        detalles_json TEXT,
        assigned_to TEXT,
        locked_by TEXT,
        locked_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dai_fecha ON dai_alerts(fecha_plataforma DESC);
    CREATE INDEX IF NOT EXISTS idx_dai_severidad ON dai_alerts(severidad);
    CREATE INDEX IF NOT EXISTS idx_dai_estado ON dai_alerts(estado);
    CREATE INDEX IF NOT EXISTS idx_dai_departamento ON dai_alerts(departamento);
`);

console.log('✅ Tablas creadas correctamente');

// ============================================================
// DATOS DE PRUEBA
// ============================================================

// ID del administrador (fijo para referencia)
const ADMIN_ID = 'admin-0001-0001-0001-000100010001';

// -- 1. Usuario administrador
// Contraseña: admin123  (hash bcrypt pre-generado)
const adminHash = '$2b$12$42eySg6GNYlQMCAirYzY0uSk.b2sA1Ov5E5H0kJm7U833EQlE1dgq';

const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, email_mask, password_hash, name, role, is_active, email_verified)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1)
`);
insertAdmin.run(ADMIN_ID, 'admin@invias.gov.co', 'a***@invias.gov.co', adminHash, 'Administrador VIITS', 'admin');

// Usuario de prueba normal
const USER_ID = 'user-0001-0001-0001-000100010001';
insertAdmin.run(USER_ID, 'usuario@invias.gov.co', 'u***@invias.gov.co', adminHash, 'Usuario de Prueba', 'user');

console.log('✅ Usuarios creados  →  admin@invias.gov.co / admin123');

// -- 2. Configuración del sistema
const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO system_config (config_key, config_value, description, is_public)
    VALUES (?, ?, ?, ?)
`);

const configs = [
    ['site_name', '"VIITS - Sistema de Vigilancia Inteligente"', 'Nombre del sitio', 1],
    ['site_description', '"Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad"', 'Descripción', 1],
    ['max_upload_size', '52428800', 'Tamaño máximo de archivo (50MB)', 0],
    ['enable_downloads', 'true', 'Habilitar descargas', 0],
    ['enable_2fa', 'false', 'Autenticación de dos factores (deshabilitada en dev)', 0],
    ['download_max_months', '3', 'Máximo meses por descarga', 0],
];

configs.forEach(([key, val, desc, pub]) => insertConfig.run(key, val, desc, pub));
console.log('✅ Configuración del sistema cargada');

// -- 3. Estadísticas de tráfico (sectores viales reales de Colombia)
const insertTraffic = db.prepare(`
    INSERT OR IGNORE INTO traffic_stats
        (id, sector_id, sector_name, department, date, average_speed, total_vehicles, vehicles_over_limit, metric_type, device_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const sectors = [
    ['Bogotá - Girardot', 'Cundinamarca'],
    ['Cali - Yumbo', 'Valle del Cauca'],
    ['Medellín - Santa Fe de Antioquia', 'Antioquia'],
    ['Barranquilla - Cartagena', 'Atlántico'],
    ['Bucaramanga - Barrancabermeja', 'Santander'],
    ['Pereira - Armenia', 'Risaralda'],
    ['Cúcuta - Pamplona', 'Norte de Santander'],
    ['Ibagué - Cajamarca', 'Tolima'],
    ['Popayán - Pasto', 'Cauca'],
    ['Villavicencio - Puerto López', 'Meta'],
    ['Santa Marta - Barranquilla', 'Magdalena'],
    ['Manizales - La Dorada', 'Caldas'],
    ['Neiva - Florencia', 'Huila'],
    ['Tunja - Bogotá', 'Boyacá'],
    ['Armenia - Ibagué', 'Quindío'],
];

// Generar datos para los últimos 30 días
const now = new Date();
sectors.forEach(([name, dept], idx) => {
    for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split('T')[0];
        const id = `traf-${String(idx).padStart(3, '0')}-${dateStr}`;
        const speed = (50 + Math.random() * 50).toFixed(2);
        const vehicles = Math.floor(3000 + Math.random() * 5000);
        const overLimit = Math.floor(200 + Math.random() * 800);

        insertTraffic.run(id, `SECTOR_${idx + 1}`, name, dept, dateStr,
            parseFloat(speed), vehicles, overLimit, 'speed', 'radar');
    }
});

console.log('✅ Estadísticas de tráfico cargadas (15 sectores × 7 días)');

// -- 4. Reportes de ejemplo
const insertReport = db.prepare(`
    INSERT OR IGNORE INTO reports
        (id, title, description, file_name, file_path, file_size, mime_type, is_public, is_featured, published_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
`);

const reports = [
    ['rep-001', 'Informe Anual de Tráfico 2024',
        'Estadísticas de tráfico vehicular en las principales vías nacionales de Colombia.',
        'informe-trafico-2024.pdf', '/uploads/informes/informe-trafico-2024.pdf', 2048000, 'application/pdf', 1, 1],
    ['rep-002', 'Reporte de Seguridad Vial - Primer Semestre 2024',
        'Análisis de incidentes de seguridad vial en los sectores monitoreados por VIITS.',
        'seguridad-vial-s1-2024.pdf', '/uploads/informes/seguridad-vial-s1-2024.pdf', 1536000, 'application/pdf', 1, 0],
    ['rep-003', 'Estadísticas de Velocidad - Red Vial Nacional',
        'Datos de velocidad promedio capturados por los radares VIITS en las vías concesionadas.',
        'velocidades-red-vial.xlsx', '/uploads/informes/velocidades-red-vial.xlsx', 512000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1, 0],
];

reports.forEach(([id, title, desc, fname, fpath, fsize, mime, pub, feat]) => {
    insertReport.run(id, title, desc, fname, fpath, fsize, mime, pub, feat, ADMIN_ID);
});

console.log('✅ Reportes de ejemplo cargados (3 reportes)');

// -- 5. Registros de auditoría
const insertAudit = db.prepare(`
    INSERT OR IGNORE INTO audit_logs (id, user_id, action, resource_type, status)
    VALUES (?, ?, ?, ?, ?)
`);

insertAudit.run('aud-001', ADMIN_ID, 'LOGIN', 'session', 'success');
insertAudit.run('aud-002', ADMIN_ID, 'CREATE', 'report', 'success');
insertAudit.run('aud-003', ADMIN_ID, 'UPDATE', 'system_config', 'success');
insertAudit.run('aud-004', USER_ID, 'LOGIN', 'session', 'success');
insertAudit.run('aud-005', USER_ID, 'DOWNLOAD', 'report', 'success');

console.log('✅ Registros de auditoría cargados');

// -- Resumen final
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
const trafficCount = db.prepare('SELECT COUNT(*) as count FROM traffic_stats').get();
const reportCount = db.prepare('SELECT COUNT(*) as count FROM reports').get();

console.log(`
╔═══════════════════════════════════════════════════════╗
║     ✅ BASE DE DATOS DE PRUEBA LISTA                  ║
╠═══════════════════════════════════════════════════════╣
║  📁 Archivo: backend/data/viits_dev.db                ║
║  👥 Usuarios:           ${String(userCount.count).padEnd(30)}║
║  🚗 Stats de tráfico:   ${String(trafficCount.count).padEnd(30)}║
║  📄 Reportes:           ${String(reportCount.count).padEnd(30)}║
╠═══════════════════════════════════════════════════════╣
║  🔑 Credenciales de prueba:                           ║
║     Email:    admin@invias.gov.co                     ║
║     Password: admin123                                ║
╚═══════════════════════════════════════════════════════╝
`);

db.close();
