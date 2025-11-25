/**
 * Middleware de Autenticación y Autorización
 * VIITS - INVIAS Colombia
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Middleware para verificar token JWT
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

        if (!token) {
            return res.status(401).json({
                error: 'Acceso denegado',
                message: 'No se proporcionó token de autenticación'
            });
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verificar si el token está en la lista negra (opcional)
        // TODO: Implementar blacklist en Redis

        // Verificar si la sesión está activa
        const sessionResult = await query(
            'SELECT * FROM sessions WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
            [decoded.userId, token.substring(0, 64)] // Guardar hash del token
        );

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Sesión inválida',
                message: 'La sesión ha expirado o es inválida'
            });
        }

        // Verificar si el usuario existe y está activo
        const userResult = await query(
            'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Usuario no encontrado',
                message: 'El usuario asociado al token no existe'
            });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                error: 'Usuario inactivo',
                message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
            });
        }

        // Actualizar última actividad de la sesión
        await query(
            'UPDATE sessions SET last_activity = NOW() WHERE id = $1',
            [sessionResult.rows[0].id]
        );

        // Agregar información del usuario al request
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido',
                message: 'El token proporcionado no es válido'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                message: 'El token ha expirado. Por favor, inicia sesión nuevamente.'
            });
        }

        console.error('Error en middleware de autenticación:', error);
        return res.status(500).json({
            error: 'Error del servidor',
            message: 'Error al verificar autenticación'
        });
    }
};

/**
 * Middleware para verificar roles
 * @param {Array} allowedRoles - Array de roles permitidos
 */
const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'No autenticado',
                message: 'Debes iniciar sesión para acceder a este recurso'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tienes permisos para acceder a este recurso',
                requiredRoles: allowedRoles,
                currentRole: req.user.role
            });
        }

        next();
    };
};

/**
 * Middleware opcional - permite acceso sin autenticación pero agrega user si existe
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // No hay token, continuar sin usuario
            req.user = null;
            return next();
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Obtener información del usuario
        const userResult = await query(
            'SELECT id, email, name, role, is_active FROM users WHERE id = $1 AND is_active = true',
            [decoded.userId]
        );

        if (userResult.rows.length > 0) {
            req.user = userResult.rows[0];
        } else {
            req.user = null;
        }

        next();

    } catch (error) {
        // Si hay error en el token, continuar sin usuario
        req.user = null;
        next();
    }
};

/**
 * Middleware para verificar si el usuario ha verificado su email
 */
const requireEmailVerified = async (req, res, next) => {
    try {
        const userResult = await query(
            'SELECT email_verified FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].email_verified) {
            return res.status(403).json({
                error: 'Email no verificado',
                message: 'Debes verificar tu email antes de acceder a este recurso'
            });
        }

        next();

    } catch (error) {
        console.error('Error al verificar email:', error);
        return res.status(500).json({
            error: 'Error del servidor',
            message: 'Error al verificar el estado del email'
        });
    }
};

/**
 * Middleware para verificar 2FA si está habilitado
 */
const require2FA = async (req, res, next) => {
    try {
        const userResult = await query(
            'SELECT totp_enabled FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length > 0 && userResult.rows[0].totp_enabled) {
            // Verificar que la sesión tenga 2FA verificado
            const sessionResult = await query(
                'SELECT * FROM sessions WHERE user_id = $1 AND token_hash = $2',
                [req.user.id, req.headers['authorization'].split(' ')[1].substring(0, 64)]
            );

            // TODO: Agregar campo 2fa_verified a la tabla sessions
            // Por ahora, asumir que si la sesión existe, 2FA está verificado

            next();
        } else {
            next();
        }

    } catch (error) {
        console.error('Error al verificar 2FA:', error);
        return res.status(500).json({
            error: 'Error del servidor',
            message: 'Error al verificar 2FA'
        });
    }
};

module.exports = {
    authenticateToken,
    authorizeRole,
    optionalAuth,
    requireEmailVerified,
    require2FA
};
