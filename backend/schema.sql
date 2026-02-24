-- ╔════════════════════════════════════════════════════════════════╗
-- ║  VIITS - Database Schema                                      ║
-- ║  Instituto Nacional de Vías (INVIAS) - Colombia              ║
-- ║  Script de inicialización de base de datos PostgreSQL        ║
-- ╚════════════════════════════════════════════════════════════════╝

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ========================================
-- TABLA DE USUARIOS
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_mask VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    verification_code VARCHAR(10),
    verification_code_expires TIMESTAMP,
    reset_token VARCHAR(10),
    reset_token_expires TIMESTAMP,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Índices para users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ========================================
-- TABLA DE REPORTES/DOCUMENTOS
-- ========================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) NOT NULL,
    updated_by UUID REFERENCES users(id)
);

-- Índices para reports
CREATE INDEX idx_reports_public ON reports(is_public);
CREATE INDEX idx_reports_featured ON reports(is_featured);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
CREATE INDEX idx_reports_published ON reports(published_at DESC);

-- ========================================
-- TABLA DE SLIDER DE IMÁGENES
-- ========================================
CREATE TABLE IF NOT EXISTS slider_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    image_path VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    link_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) NOT NULL,
    updated_by UUID REFERENCES users(id)
);

-- Índices para slider_images
CREATE INDEX idx_slider_active ON slider_images(is_active);
CREATE INDEX idx_slider_position ON slider_images(position);

-- ========================================
-- TABLA DE ESTADÍSTICAS DE TRÁFICO
-- ========================================
CREATE TABLE IF NOT EXISTS traffic_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sector_id VARCHAR(100) NOT NULL,
    sector_name VARCHAR(500) NOT NULL,
    department VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    average_speed DECIMAL(10, 2),
    total_vehicles INTEGER DEFAULT 0,
    vehicles_over_limit INTEGER DEFAULT 0,
    metric_type VARCHAR(50), -- 'speed', 'volume', 'weight'
    device_type VARCHAR(50), -- 'radar', 'wim', 'counter', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para traffic_stats
CREATE INDEX idx_traffic_sector ON traffic_stats(sector_id);
CREATE INDEX idx_traffic_date ON traffic_stats(date DESC);
CREATE INDEX idx_traffic_department ON traffic_stats(department);
CREATE INDEX idx_traffic_device ON traffic_stats(device_type);

-- ========================================
-- TABLA DE DESCARGAS
-- ========================================
CREATE TABLE IF NOT EXISTS downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'report', 'traffic_data', 'statistics'
    resource_id UUID,
    file_name VARCHAR(500),
    filters JSONB, -- Filtros aplicados (fechas, sectores, etc.)
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    download_url VARCHAR(500),
    expires_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Índices para downloads
CREATE INDEX idx_downloads_user ON downloads(user_id);
CREATE INDEX idx_downloads_status ON downloads(status);
CREATE INDEX idx_downloads_created ON downloads(created_at DESC);

-- ========================================
-- TABLA DE AUDITORÍA
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para audit_logs
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_status ON audit_logs(status);

-- ========================================
-- TABLA DE SESIONES
-- ========================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ========================================
-- TABLA DE CONFIGURACIÓN DEL SISTEMA
-- ========================================
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Índices para system_config
CREATE INDEX idx_config_key ON system_config(config_key);

-- ========================================
-- FUNCIONES Y TRIGGERS
-- ========================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slider_updated_at BEFORE UPDATE ON slider_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_traffic_updated_at BEFORE UPDATE ON traffic_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- DATOS INICIALES
-- ========================================

-- Insertar usuario administrador por defecto
-- Password: admin123 (debe cambiarse en producción)
INSERT INTO users (email, password_hash, name, role, is_active, email_verified)
VALUES (
    'admin@invias.gov.co',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lH3vQQp0hL5G',
    'Administrador VIITS',
    'admin',
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Insertar configuraciones iniciales
INSERT INTO system_config (config_key, config_value, description, is_public) VALUES
('site_name', '"VIITS - Sistema de Vigilancia Inteligente"', 'Nombre del sitio', true),
('site_description', '"Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad"', 'Descripción del sitio', true),
('max_upload_size', '52428800', 'Tamaño máximo de archivo en bytes (50MB)', false),
('enable_downloads', 'true', 'Habilitar descargas de datos', false),
('enable_2fa', 'true', 'Habilitar autenticación de dos factores', false),
('download_max_months', '3', 'Máximo de meses permitidos por descarga', false),
-- Configuraciones de contacto y footer
('footer_address', '"Carrera 59 No. 26 - 60 CAN, Bogotá D.C., Colombia"', 'Dirección sede principal', true),
('footer_phone', '"(601) 705 6000"', 'Teléfono conmutador', true),
('footer_email', '"servicioalciudadano@invias.gov.co"', 'Email de servicio al ciudadano', true),
('footer_schedule', '"Lunes a Viernes de 8:00 a.m. a 4:00 p.m."', 'Horario de atención', true),
('social_twitter', '"https://twitter.com/InviasCol"', 'Enlace Twitter', true),
('social_facebook', '"https://www.facebook.com/InviasCol"', 'Enlace Facebook', true),
('social_youtube', '"https://www.youtube.com/InviasCol"', 'Enlace YouTube', true),
('social_instagram', '"https://www.instagram.com/inviascol/"', 'Enlace Instagram', true)
ON CONFLICT (config_key) DO NOTHING;

-- ========================================
-- TABLA DE ALERTAS DAI
-- ========================================
CREATE TABLE IF NOT EXISTS dai_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seq_id VARCHAR(50) UNIQUE NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    severidad VARCHAR(20) NOT NULL, -- 'critica', 'alta', 'media', 'baja'
    estado VARCHAR(20) NOT NULL DEFAULT 'creado', -- 'creado', 'activa', 'resuelta'
    departamento VARCHAR(100) NOT NULL,
    tramo VARCHAR(200),
    codigo_via VARCHAR(50),
    poste_referencia VARCHAR(50),
    dispositivo_id VARCHAR(100),
    dispositivo_tipo VARCHAR(50),
    latitud DECIMAL(10, 7),
    longitud DECIMAL(10, 7),
    tipo_registro VARCHAR(50) DEFAULT 'Automático',
    fecha_captura TIMESTAMP NOT NULL,
    fecha_plataforma TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latencia_ms INTEGER,
    evidencia_json JSONB,
    detalles_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dai_fecha ON dai_alerts(fecha_plataforma DESC);
CREATE INDEX idx_dai_severidad ON dai_alerts(severidad);
CREATE INDEX idx_dai_estado ON dai_alerts(estado);
CREATE INDEX idx_dai_departamento ON dai_alerts(departamento);

CREATE TRIGGER update_dai_updated_at BEFORE UPDATE ON dai_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de ejemplo para estadísticas de tráfico
-- (Estos son los 57 sectores viales reales de Colombia)
INSERT INTO traffic_stats (sector_id, sector_name, department, date, average_speed, total_vehicles, vehicles_over_limit, metric_type, device_type)
SELECT 
    'SECTOR_' || ROW_NUMBER() OVER (),
    sector_name,
    department,
    CURRENT_DATE - (random() * 30)::integer,
    60 + (random() * 40)::numeric(10,2),
    (3000 + random() * 5000)::integer,
    (800 + random() * 1000)::integer,
    'speed',
    'radar'
FROM (VALUES
    ('Bogotá - Girardot', 'Cundinamarca'),
    ('Cali - Yumbo', 'Valle del Cauca'),
    ('Medellín - Santa Fe de Antioquia', 'Antioquia'),
    ('Barranquilla - Cartagena', 'Atlántico'),
    ('Bucaramanga - Barrancabermeja', 'Santander'),
    ('Pereira - Armenia', 'Risaralda'),
    ('Cúcuta - Pamplona', 'Norte de Santander'),
    ('Ibagué - Cajamarca', 'Tolima'),
    ('Popayán - Pasto', 'Cauca'),
    ('Villavicencio - Puerto López', 'Meta')
) AS sectors(sector_name, department)
ON CONFLICT DO NOTHING;

-- ========================================
-- COMENTARIOS EN TABLAS
-- ========================================

COMMENT ON TABLE users IS 'Tabla de usuarios del sistema con autenticación y roles';
COMMENT ON TABLE reports IS 'Tabla de reportes y documentos públicos del sistema';
COMMENT ON TABLE slider_images IS 'Tabla de imágenes del slider principal';
COMMENT ON TABLE traffic_stats IS 'Tabla de estadísticas de tráfico vehicular';
COMMENT ON TABLE downloads IS 'Tabla de registro de descargas de datos';
COMMENT ON TABLE audit_logs IS 'Tabla de auditoría de todas las acciones del sistema';
COMMENT ON TABLE sessions IS 'Tabla de sesiones activas de usuarios';
COMMENT ON TABLE system_config IS 'Tabla de configuración del sistema';

-- ========================================
-- VISTA: Estadísticas del dashboard
-- ========================================
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM reports WHERE published_at >= CURRENT_DATE) AS reports_today,
    (SELECT COUNT(*) FROM downloads WHERE created_at >= CURRENT_DATE) AS downloads_today,
    (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE last_activity >= CURRENT_DATE) AS active_users_today,
    (SELECT COUNT(*) FROM audit_logs WHERE created_at >= CURRENT_DATE) AS activities_today;

-- Finalizar
SELECT 'Base de datos inicializada correctamente' AS status;
