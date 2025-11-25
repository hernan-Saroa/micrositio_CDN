/**
 * Rutas de Autenticación
 * VIITS - INVIAS Colombia
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendVerificationCode, sendPasswordResetToken } = require('../utils/emailService');
const logger = require('../utils/logger');
const crypto = require('crypto');

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

function hashEmail(email) {
  const secret = process.env.SECRET_KEY_EMAIL_HASH;
  return crypto
    .createHmac('sha256', secret)
    .update(email.toLowerCase().trim())
    .digest('hex');
}

function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    if (!domain) return email; // por si el string no tiene '@'

    // Parte local: h***y
    const maskedLocal = localPart.length <= 2 ? localPart[0] + '•' : localPart[0] + '•••' + localPart.slice(-1);

    // Dominio: s***a.co
    const domainParts = domain.split('.');
    const domainName = domainParts[0];
    const maskedDomain = domainName.length <= 2 ? domainName[0] + '•' : domainName[0] + '•••' + domainName.slice(-1);

    const domainTLD = domainParts.slice(1).join('.'); // ej: co

    return `${maskedLocal}@${maskedDomain}.${domainTLD}`;
}

// ========================================
// POST /api/auth/login
// Iniciar sesión
// ========================================
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { email, password } = req.body;

    const emailHash = hashEmail(email);
    const emailMask = maskEmail(email);

    // Buscar usuario
    let userResult = await query(
        'SELECT * FROM users WHERE email = $1',
        [emailHash]
    );
    
    if (userResult.rows.length === 0) {
        userResult = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        if (userResult.rows.length === 0) {
            throw new AppError('Credenciales inválidas', 401);
        }
    }

    const user = userResult.rows[0];

    // Verificar contraseña con bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
        throw new AppError('Credenciales inválidas', 401);
    }

    // Verificar si el usuario está activo
    if (!user.is_active) {
        throw new AppError('Cuenta desactivada. Contacta al administrador.', 403);
    }

    // Generar token JWT
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Crear sesión
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    await query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, token.substring(0, 64), expiresAt, req.ip, req.get('User-Agent')]
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
         VALUES ($1, 'login', 'user', $2, $3, $4)`,
        [user.id, user.id, req.ip, req.get('User-Agent')]
    );

    // Actualizar último login
    await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
    );

    logger.info(`Usuario ${email} inició sesión exitosamente`);

    res.json({
        message: 'Inicio de sesión exitoso',
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    });
}));

// ========================================
// POST /api/auth/logout
// Cerrar sesión
// ========================================
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];

    // Eliminar sesión
    await query(
        'DELETE FROM sessions WHERE user_id = $1 AND token_hash = $2',
        [req.user.id, token.substring(0, 64)]
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
         VALUES ($1, 'logout', 'user', $2, $3, $4)`,
        [req.user.id, req.user.id, req.ip, req.get('User-Agent')]
    );

    logger.info(`Usuario ${req.user.email} cerró sesión`);

    res.json({ message: 'Sesión cerrada exitosamente' });
}));

// ========================================
// GET /api/auth/me
// Obtener información del usuario actual
// ========================================
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
    const userResult = await query(
        'SELECT id, email, name, role, is_active, email_verified, last_login, created_at FROM users WHERE id = $1',
        [req.user.id]
    );

    if (userResult.rows.length === 0) {
        throw new AppError('Usuario no encontrado', 404);
    }

    res.json(userResult.rows[0]);
}));

// ========================================
// GET /api/auth/verify-token
// Verificar token JWT (para el frontend)
// ========================================
router.get('/verify-token', authenticateToken, asyncHandler(async (req, res) => {
    res.json({
        valid: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role
        }
    });
}));

// ========================================
// POST /api/auth/send-verification-code
// Enviar código de verificación por email
// ========================================
router.post('/send-verification-code', [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('entity').notEmpty().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { name, email, entity } = req.body;

    // Generar código de 6 dígitos
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const emailHash = hashEmail(email);
    const emailMask = maskEmail(email);

    // Crear usuario temporal con rol 'user'
    const userResult = await query(
        `INSERT INTO users (email, email_mask, name, role, is_active, email_verified, password_hash, created_at)
         VALUES ($1, $2, $3, 'user', false, false, '', NOW())
         ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         updated_at = NOW()
         RETURNING id, email, name, role`,
        [emailHash, emailMask, name]
    );

    const user = userResult.rows[0];

    // Guardar código de verificación en la base de datos
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    await query(
        'UPDATE users SET verification_code = $1, verification_code_expires = $2, updated_at = NOW() WHERE id = $3',
        [verificationCode, expirationTime, user.id]
    );

    console.log(`Código de verificación para ${email}: ${verificationCode}`);

    // Enviar email con código de verificación
    try {
        const emailResult = await sendVerificationCode(email, verificationCode, name);
        logger.info(`Código de verificación enviado exitosamente a ${emailMask} para usuario ${user.id}: ${emailResult.messageId}`);
    } catch (emailError) {
        logger.error(`Error al enviar email a ${emailMask}:`, emailError.message);
        // Si falla el email, limpiar el código guardado
        await query(
            'UPDATE users SET verification_code = NULL, verification_code_expires = NULL, updated_at = NOW() WHERE id = $1',
            [user.id]
        );
        // En desarrollo, continuar y mostrar el código
        if (process.env.NODE_ENV !== 'development') {
            throw new AppError('Error al enviar el código de verificación. Intente nuevamente.', 500);
        }
    }

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address)
         VALUES ($1, 'send_verification_code', 'user', $2, $3, $4)`,
        [user.id, user.id, JSON.stringify({ message: `Código enviado a ${emailMask}` }), req.ip]
    );

    res.json({
        message: 'Código de verificación enviado exitosamente',
        email: email,
    });
}));

// ========================================
// POST /api/auth/verify-code
// Verificar código y crear sesión
// ========================================
router.post('/verify-code', [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { email, code } = req.body;

    const emailHash = hashEmail(email);
    const emailMask = maskEmail(email);
    // Buscar usuario
    const userResult = await query(
        'SELECT * FROM users WHERE email = $1 AND role = $2',
        [emailHash, 'user']
    );

    if (userResult.rows.length === 0) {
        throw new AppError('Usuario no encontrado', 404);
    }

    const user = userResult.rows[0];

    // Verificar código desde la base de datos
    const userWithCode = await query(
        'SELECT verification_code, verification_code_expires FROM users WHERE email = $1 AND role = $2',
        [emailHash, 'user']
    );

    if (userWithCode.rows.length === 0) {
        throw new AppError('Usuario no encontrado', 404);
    }

    const userData = userWithCode.rows[0];

    // Verificar si el código existe y no ha expirado
    if (!userData.verification_code || !userData.verification_code_expires) {
        throw new AppError('No se encontró código de verificación. Solicite uno nuevo.', 400);
    }

    if (new Date() > new Date(userData.verification_code_expires)) {
        // Limpiar código expirado
        await query(
            'UPDATE users SET verification_code = NULL, verification_code_expires = NULL, updated_at = NOW() WHERE email = $1',
            [emailHash]
        );
        throw new AppError('El código de verificación ha expirado. Solicite uno nuevo.', 400);
    }

    if (userData.verification_code !== code) {
        throw new AppError('Código de verificación incorrecto', 400);
    }

    // Marcar email como verificado y limpiar código
    await query(
        'UPDATE users SET email_verified = true, is_active = true, verification_code = NULL, verification_code_expires = NULL, updated_at = NOW(), last_login = NOW() WHERE id = $1',
        [user.id]
    );

    // Generar token JWT
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Crear sesión
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    await query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, token.substring(0, 64), expiresAt, req.ip, req.get('User-Agent')]
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent)
         VALUES ($1, 'verify_code_success', 'user', $2, $3, $4, $5)`,
        [user.id, user.id, JSON.stringify({ message: `Código verificado exitosamente para ${emailMask}` }), req.ip, req.get('User-Agent')]
    );

    logger.info(`Usuario ${emailMask} verificó código exitosamente`);

    res.json({
        message: 'Verificación exitosa',
        token,
        user: {
            id: user.id,
            email: user.email_mask,
            name: user.name,
            role: user.role
        }
    });
}));

// ========================================
// POST /api/auth/forgot-password
// Solicitar restablecimiento de contraseña
// ========================================
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { email } = req.body;
    
    const emailHash = hashEmail(email);
    const emailMask = maskEmail(email);
    
    // Buscar usuario
    let userResult = await query(
        'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
        [emailHash]
    );

    if (userResult.rows.length === 0) {
        // No revelar si el email existe o no por seguridad
        userResult = await query(
            'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
            [email]
        );
        
        if (userResult.rows.length === 0) {
            throw new AppError('Usuario no encontrado', 404);
        }
    }

    const user = userResult.rows[0];

    // Generar token de 6 dígitos
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Token de restablecimiento para ${email}: ${resetToken}`);
    // Guardar token en la base de datos con expiración (15 minutos)
    const expirationTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    await query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() WHERE id = $3',
        [resetToken, expirationTime, user.id]
    );

    console.log(`Token de restablecimiento para ${email}: ${resetToken}`);

    // Enviar email con token
    try {
        const emailResult = await sendPasswordResetToken(email, resetToken, user.name);
        logger.info(`Token de restablecimiento enviado exitosamente a ${emailMask} para usuario ${user.id}: ${emailResult.messageId}`);
    } catch (emailError) {
        logger.error(`Error al enviar email a ${emailMask}:`, emailError.message);
        // Limpiar token si falla el email
        await query(
            'UPDATE users SET reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1',
            [user.id]
        );
        throw new AppError('Error al enviar el token de restablecimiento. Intente nuevamente.', 500);
    }

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
         VALUES ($1, 'forgot_password', 'user', $2, $3)`,
        [user.id, user.id, req.ip]
    );

    res.json({
        message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.'
    });
}));

// ========================================
// POST /api/auth/verify-reset-token
// Verificar token de restablecimiento
// ========================================
router.post('/verify-reset-token', [
    body('email').isEmail().normalizeEmail(),
    body('token').isLength({ min: 6, max: 6 }).isNumeric()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { email, token } = req.body;

    const emailHash = hashEmail(email);
    // Buscar usuario
    let userResult = await query(
        'SELECT id, name, reset_token, reset_token_expires FROM users WHERE email = $1 AND is_active = true',
        [emailHash]
    );

    if (userResult.rows.length === 0) {
        userResult = await query(
            'SELECT id, name, reset_token, reset_token_expires FROM users WHERE email = $1 AND is_active = true',
            [email]
        );
        if (userResult.rows.length === 0) {
            throw new AppError('Usuario no encontrado', 404);
        }
    }

    const user = userResult.rows[0];

    // Verificar token
    if (!user.reset_token || !user.reset_token_expires) {
        throw new AppError('No se encontró token de restablecimiento. Solicite uno nuevo.', 400);
    }

    if (new Date() > new Date(user.reset_token_expires)) {
        // Limpiar token expirado
        await query(
            'UPDATE users SET reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1',
            [user.id]
        );
        throw new AppError('El token de restablecimiento ha expirado. Solicite uno nuevo.', 400);
    }

    if (user.reset_token !== token) {
        throw new AppError('Token de restablecimiento incorrecto', 400);
    }

    // Token válido, mantenerlo para el siguiente paso
    res.json({
        message: 'Token verificado exitosamente',
        valid: true
    });
}));

// ========================================
// POST /api/auth/reset-password
// Restablecer contraseña
// ========================================
router.post('/reset-password', [
    body('email').isEmail().normalizeEmail(),
    body('token').isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { email, token, newPassword } = req.body;

    const emailHash = hashEmail(email);
    const emailMask = maskEmail(email);
    
    // Buscar usuario
    let userResult = await query(
        'SELECT id, name, reset_token, reset_token_expires FROM users WHERE email = $1 AND is_active = true',
        [emailHash]
    );

    if (userResult.rows.length === 0) {
        userResult = await query(
            'SELECT id, name, reset_token, reset_token_expires FROM users WHERE email = $1 AND is_active = true',
            [email]
        );
        if (userResult.rows.length === 0) {
            throw new AppError('Usuario no encontrado', 404);
        }
    }

    const user = userResult.rows[0];

    // Verificar token nuevamente
    if (!user.reset_token || !user.reset_token_expires) {
        throw new AppError('No se encontró token de restablecimiento. Solicite uno nuevo.', 400);
    }

    if (new Date() > new Date(user.reset_token_expires)) {
        await query(
            'UPDATE users SET reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1',
            [user.id]
        );
        throw new AppError('El token de restablecimiento ha expirado. Solicite uno nuevo.', 400);
    }

    if (user.reset_token !== token) {
        throw new AppError('Token de restablecimiento incorrecto', 400);
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña y limpiar token
    await query(
        'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
        [hashedPassword, user.id]
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent)
         VALUES ($1, 'reset_password', 'user', $2, $3, $4, $5)`,
        [user.id, user.id, JSON.stringify({ message: 'Contraseña restablecida exitosamente' }), req.ip, req.get('User-Agent')]
    );

    logger.info(`Usuario ${emailMask} restableció su contraseña exitosamente`);

    res.json({
        message: 'Contraseña restablecida exitosamente'
    });
}));

module.exports = {
    router,
    authenticateToken,
    authorizeRole,
    optionalAuth,
    requireEmailVerified,
    require2FA
};
