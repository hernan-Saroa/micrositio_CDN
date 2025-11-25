/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║                                                                ║
 * ║    VIITS - BACKEND SERVER                                     ║
 * ║    Instituto Nacional de Vías (INVIAS) - Colombia            ║
 * ║                                                                ║
 * ║    Servidor Node.js/Express para el Panel Administrativo     ║
 * ║    Version: 1.0.0 - Production Ready                         ║
 * ║                                                                ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Importar rutas
const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const sliderRoutes = require('./routes/slider');
const usersRoutes = require('./routes/users');
const downloadsRoutes = require('./routes/downloads');
const auditRoutes = require('./routes/audit');
const statsRoutes = require('./routes/stats');
const elasticRoutes = require('./routes/elastic');
const sqlserverRoutes = require('./routes/sqlserver');
const clickhouseRoutes = require('./routes/clickhouseserver');

// Importar middlewares
const { authenticateToken, authorizeRole } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARES DE SEGURIDAD
// ========================================

// Helmet para headers de seguridad
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"]
        }
    }
}));

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite de 100 peticiones por ventana
    message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.'
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Límite más estricto para rutas sensibles
    message: 'Demasiados intentos. Por favor intente más tarde.'
});

app.use('/api/', limiter);
app.use('/api/auth/login', strictLimiter);
app.use('/api/auth/register', strictLimiter);

// Body parsers - IMPORTANTE: No usar json parser para rutas con archivos
// Solo usar urlencoded para datos de formulario normales
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware específico para rutas que NO manejan archivos
const jsonParser = express.json({ limit: '50mb' });

// Aplicar json parser solo a rutas que no usan multer
app.use('/api/auth', jsonParser);
app.use('/api/users', jsonParser);
app.use('/api/stats', jsonParser);
app.use('/api/slider', jsonParser);
app.use('/api/audit', jsonParser);
app.use('/api/downloads', jsonParser);
// NO aplicar a /api/reports porque usa multer

// Servir archivos estáticos desde frontend/
app.use(express.static(path.join(process.cwd(), '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Logging de peticiones
// app.use((req, res, next) => {
//     logger.info(`${req.method} ${req.path} - ${req.ip}`);
//     next();
// });

// ========================================
// RUTAS DE LA API
// ========================================

// Ruta de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rutas de autenticación (públicas)
app.use('/api/auth', authRoutes.router);

// Rutas protegidas (requieren autenticación)
app.use('/api/reports', reportsRoutes);
app.use('/api/slider', sliderRoutes);
app.use('/api/clickhouse', clickhouseRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/sqlserver', sqlserverRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/elastic', elasticRoutes);

// ========================================
// RUTAS PARA SERVIR HTML
// ========================================

// Ruta principal - redirigir al micrositio
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/00-INICIO-PROYECTO.html'));
});

// Admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/login.html'));
});

// Otras páginas
app.get('/participacion-ciudadana', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/participacion-ciudadana.html'));
});

app.get('/documentos', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/documentos.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(process.cwd(), '../frontend/dashboard-sectores-viales.html'));
});

// ========================================
// MANEJO DE ERRORES
// ========================================

// Ruta 404
app.use(notFound);

// Manejador global de errores
app.use(errorHandler);

// ========================================
// INICIO DEL SERVIDOR
// ========================================

app.listen(PORT, () => {
    logger.info(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║    🚀 SERVIDOR VIITS INICIADO EXITOSAMENTE 🚀                 ║
║                                                                ║
║    Puerto: ${PORT}                                            ║
║    Entorno: ${process.env.NODE_ENV || 'development'}          ║
║    Tiempo: ${new Date().toLocaleString('es-CO')}             ║
║                                                                ║
║    URLs disponibles:                                          ║
║    • http://localhost:${PORT}                                ║
║    • http://localhost:${PORT}/admin                          ║
║    • http://localhost:${PORT}/api/health                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    logger.info('SIGTERM recibido. Cerrando servidor gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT recibido. Cerrando servidor gracefully...');
    process.exit(0);
});

module.exports = app;
