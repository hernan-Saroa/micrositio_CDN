const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ── Helpers ───────────────────────────────────────────────────────────────────
function hashEmail(email) {
    const secret = process.env.SECRET_KEY_EMAIL_HASH || 'dev-secret-key';
    return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
}

function maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = local.length <= 2 ? local[0] + '•' : local[0] + '•••' + local.slice(-1);
    const domainParts = domain.split('.');
    const dName = domainParts[0];
    const maskedDomain = dName.length <= 2 ? dName[0] + '•' : dName[0] + '•••' + dName.slice(-1);
    return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
}

// ── GET /api/users — Listar usuarios ──────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
    const result = await query('SELECT id, email_mask AS email, name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows || result);
}));

// ── GET /api/users/by-permission/:moduleId — Listar usuarios con permiso específico ────────────────
router.get('/by-permission/:moduleId', asyncHandler(async (req, res) => {
    const { moduleId } = req.params;

    // 1. Obtener definición de roles
    const configRes = await query("SELECT config_value FROM system_config WHERE config_key = 'roles_definition'");
    let roles = [];
    try {
        roles = JSON.parse((configRes.rows || configRes)[0]?.config_value || '[]');
    } catch (e) {
        console.error('Error parsing roles_definition:', e);
    }

    // 2. Filtrar roles que tienen el módulo
    const allowedRoles = roles
        .filter(r => r.modules && r.modules.includes(moduleId))
        .map(r => r.id);

    if (allowedRoles.length === 0) {
        return res.json([]);
    }

    // 3. Buscar usuarios con esos roles
    const placeholders = allowedRoles.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
        `SELECT id, email_mask AS email, name, role FROM users WHERE role IN (${placeholders}) AND is_active = 1`,
        allowedRoles
    );

    res.json(result.rows || result);
}));

// ── POST /api/users — Crear usuario ──────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
    const { name, email, password, role, is_active } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
    }

    // Verificar si el email ya existe
    const emailH = hashEmail(email);
    const existing = await query('SELECT id FROM users WHERE email = $1', [emailH]);
    if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese correo electrónico' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailMask = maskEmail(email);
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;
    const userRole = role || 'user';

    await query(
        `INSERT INTO users (email, email_mask, password_hash, name, role, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, 0)`,
        [emailH, emailMask, passwordHash, name.trim(), userRole, active]
    );

    res.status(201).json({ message: 'Usuario creado exitosamente', email_mask: emailMask });
}));

// ── PUT /api/users/:id — Editar usuario ──────────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, role, is_active, password } = req.body;

    const user = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar campos
    if (name) await query('UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [name.trim(), id]);
    if (role) await query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [role, id]);
    if (is_active !== undefined) await query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [is_active ? 1 : 0, id]);
    if (password && password.length >= 8) {
        const hash = await bcrypt.hash(password, 12);
        await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, id]);
    }

    res.json({ message: 'Usuario actualizado exitosamente' });
}));

// ── DELETE /api/users/:id — Eliminar usuario ─────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0 && result.changes === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado exitosamente' });
}));

module.exports = router;
