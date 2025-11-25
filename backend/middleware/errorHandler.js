/**
 * Middleware para manejo centralizado de errores
 * VIITS - INVIAS Colombia
 */

const logger = require('../utils/logger');

/**
 * Clase personalizada para errores de la aplicación
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Middleware principal de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
    // Log del error
    logger.error('Error capturado:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
    });

    // Error operacional conocido
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            error: err.message,
            timestamp: err.timestamp
        });
    }

    // Error de validación de express-validator
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Error de validación',
            message: err.message,
            details: err.errors
        });
    }

    // Error de base de datos
    if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint violation
        let message = 'Error de base de datos';
        
        if (err.code === '23505') { // Unique violation
            message = 'El valor ya existe en el sistema';
        } else if (err.code === '23503') { // Foreign key violation
            message = 'Referencia inválida a otro recurso';
        } else if (err.code === '23502') { // Not null violation
            message = 'Faltan campos requeridos';
        }

        return res.status(400).json({
            error: message,
            detail: err.detail
        });
    }

    // Error de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Token inválido',
            message: 'El token de autenticación no es válido'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expirado',
            message: 'La sesión ha expirado. Por favor, inicia sesión nuevamente.'
        });
    }

    // Error de Multer (upload de archivos)
    if (err.name === 'MulterError') {
        let message = 'Error al subir archivo';
        
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'El archivo excede el tamaño máximo permitido';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Demasiados archivos';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Campo de archivo inesperado';
        }

        return res.status(400).json({
            error: message,
            code: err.code
        });
    }

    // Error no manejado - No exponer detalles en producción
    if (process.env.NODE_ENV === 'production') {
        logger.error('Error no manejado:', err);
        
        return res.status(500).json({
            error: 'Error interno del servidor',
            message: 'Ha ocurrido un error inesperado. Por favor, intenta nuevamente.',
            timestamp: new Date().toISOString()
        });
    } else {
        // En desarrollo, mostrar más detalles
        return res.status(err.statusCode || 500).json({
            error: err.message || 'Error interno del servidor',
            stack: err.stack,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Middleware para rutas no encontradas
 */
const notFound = (req, res, next) => {
    const error = new AppError(
        `Ruta no encontrada: ${req.originalUrl}`,
        404
    );
    next(error);
};

/**
 * Wrapper para async functions (evita try-catch repetitivo)
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    AppError,
    errorHandler,
    notFound,
    asyncHandler
};
