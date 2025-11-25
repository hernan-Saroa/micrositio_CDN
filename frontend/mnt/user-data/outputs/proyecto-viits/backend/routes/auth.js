/**
 * Rutas de Autenticación
 * VIITS - INVIAS Colombia
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ========================================
// POST /api/auth/login
// Login inicial (paso 1 de 2FA)
// ========================================
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], asyncHandler(async (req, res) => {
    // Validar entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos de entrada inválidos', 400);
    }

    const { email, password } = req.body;

    // Buscar usuario
    const userResult = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );

    if (userResult.rows.length === 0) {
        // No revelar si el usuario existe o no
        throw new AppError('Credenciales inválidas', 401);
    }

    const user = userResult.rows[0];

    // Verificar si está activo
    if (!user.is_active) {
        throw new AppError('Tu cuenta ha sido desactivada', 403);
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        // Log intento fallido
        await query(
            `INSERT INTO audit_logs (user_id, action, status, ip_address, error_message)
             VALUES ($1, 'login_attempt', 'failed', $2, 'Invalid password')`,
            [user.id, req.ip]
        );

        throw new AppError('Credenciales inválidas', 401);
    }

    // Si tiene 2FA habilitado, solo crear sesión temporal
    if (user.totp_enabled) {
        // Crear token temporal para verificación 2FA
        const tempToken = jwt.sign(
            { userId: user.id, temp: true },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        logger.info(`Usuario ${user.email} requiere verificación 2FA`);

        return res.json({
            requiresTwoFactor: true,
            tempToken,
            message: 'Se requiere código de verificación 2FA'
        });
    }

    // Si no tiene 2FA, crear sesión completa
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Guardar sesión en base de datos
    await query(
        `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')`,
        [user.id, token.substring(0, 64), req.ip, req.headers['user-agent']]
    );

    // Actualizar último login
    await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
    );

    // Log exitoso
    await query(
        `INSERT INTO audit_logs (user_id, action, status, ip_address)
         VALUES ($1, 'login', 'success', $2)`,
        [user.id, req.ip]
    );

    logger.info(`Usuario ${user.email} inició sesión exitosamente`);

    res.json({
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
// POST /api/auth/verify-2fa
// Verificar código 2FA (paso 2)
// ========================================
router.post('/verify-2fa', [
    body('tempToken').notEmpty(),
    body('code').notEmpty().isLength({ min: 6, max: 6 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    const { tempToken, code } = req.body;

    // Verificar tempToken
    let decoded;
    try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (!decoded.temp) {
            throw new Error('Token no es temporal');
        }
    } catch (error) {
        throw new AppError('Token temporal inválido o expirado', 401);
    }

    // Obtener usuario
    const userResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.userId]
    );

    if (userResult.rows.length === 0) {
        throw new AppError('Usuario no encontrado', 404);
    }

    const user = userResult.rows[0];

    // Verificar código TOTP
    const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: code,
        window: parseInt(process.env.TOTP_WINDOW) || 1
    });

    if (!verified) {
        // Log intento fallido
        await query(
            `INSERT INTO audit_logs (user_id, action, status, ip_address, error_message)
             VALUES ($1, '2fa_verification', 'failed', $2, 'Invalid code')`,
            [user.id, req.ip]
        );

        throw new AppError('Código 2FA inválido', 401);
    }

    // Crear token completo
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Guardar sesión
    await query(
        `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')`,
        [user.id, token.substring(0, 64), req.ip, req.headers['user-agent']]
    );

    // Actualizar último login
    await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
    );

    // Log exitoso
    await query(
        `INSERT INTO audit_logs (user_id, action, status, ip_address)
         VALUES ($1, 'login_with_2fa', 'success', $2)`,
        [user.id, req.ip]
    );

    logger.info(`Usuario ${user.email} completó 2FA exitosamente`);

    res.json({
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
// GET /api/auth/verify-token
// Verificar si el token es válido
// ========================================
router.get('/verify-token', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

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
        `INSERT INTO audit_logs (user_id, action, status, ip_address)
         VALUES ($1, 'logout', 'success', $2)`,
        [req.user.id, req.ip]
    );

    logger.info(`Usuario ${req.user.email} cerró sesión`);

    res.json({ message: 'Sesión cerrada exitosamente' });
}));

// ========================================
// POST /api/auth/setup-2fa
// Configurar 2FA para el usuario
// ========================================
router.post('/setup-2fa', authenticateToken, asyncHandler(async (req, res) => {
    // Generar secret
    const secret = speakeasy.generateSecret({
        name: `VIITS INVIAS (${req.user.email})`,
        issuer: 'VIITS INVIAS'
    });

    // Generar QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Guardar secret (aún no habilitado)
    await query(
        'UPDATE users SET totp_secret = $1 WHERE id = $2',
        [secret.base32, req.user.id]
    );

    logger.info(`Usuario ${req.user.email} configuró 2FA`);

    res.json({
        secret: secret.base32,
        qrCode: qrCodeUrl
    });
}));

// ========================================
// POST /api/auth/enable-2fa
// Habilitar 2FA después de verificar código
// ========================================
router.post('/enable-2fa', [
    authenticateToken,
    body('code').notEmpty().isLength({ min: 6, max: 6 })
], asyncHandler(async (req, res) => {
    const { code } = req.body;

    // Obtener secret
    const userResult = await query(
        'SELECT totp_secret FROM users WHERE id = $1',
        [req.user.id]
    );

    if (!userResult.rows[0].totp_secret) {
        throw new AppError('Primero debes configurar 2FA', 400);
    }

    // Verificar código
    const verified = speakeasy.totp.verify({
        secret: userResult.rows[0].totp_secret,
        encoding: 'base32',
        token: code,
        window: 1
    });

    if (!verified) {
        throw new AppError('Código inválido', 400);
    }

    // Habilitar 2FA
    await query(
        'UPDATE users SET totp_enabled = true WHERE id = $1',
        [req.user.id]
    );

    logger.info(`Usuario ${req.user.email} habilitó 2FA`);

    res.json({ message: '2FA habilitado exitosamente' });
}));

// ========================================
// POST /api/auth/disable-2fa
// Deshabilitar 2FA
// ========================================
router.post('/disable-2fa', [
    authenticateToken,
    body('password').notEmpty()
], asyncHandler(async (req, res) => {
    const { password } = req.body;

    // Verificar password
    const userResult = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
    );

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!validPassword) {
        throw new AppError('Contraseña incorrecta', 401);
    }

    // Deshabilitar 2FA
    await query(
        'UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1',
        [req.user.id]
    );

    logger.info(`Usuario ${req.user.email} deshabilitó 2FA`);

    res.json({ message: '2FA deshabilitado exitosamente' });
}));

module.exports = router;
