/**
 * RUTAS CONSOLIDADAS - VIITS Backend
 * stats.js, slider.js, users.js, audit.js, downloads.js
 */

// ========================================
// STATS ROUTES (routes/stats.js)
// ========================================
const express = require('express');
const statsRouter = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

statsRouter.get('/dashboard', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM dashboard_stats');
    res.json(result.rows[0]);
}));

statsRouter.get('/traffic', asyncHandler(async (req, res) => {
    const { department, limit = 10 } = req.query;
    
    let queryStr = `
        SELECT sector_name, department, AVG(average_speed) as avg_speed,
               SUM(total_vehicles) as total_vehicles,
               SUM(vehicles_over_limit) as vehicles_over_limit
        FROM traffic_stats
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const params = [];
    
    if (department) {
        params.push(department);
        queryStr += ` AND department = $${params.length}`;
    }
    
    queryStr += ` GROUP BY sector_name, department ORDER BY total_vehicles DESC`;
    params.push(limit);
    queryStr += ` LIMIT $${params.length}`;
    
    const result = await query(queryStr, params);
    res.json(result.rows);
}));

// ========================================
// SLIDER ROUTES (routes/slider.js)
// ========================================
const sliderRouter = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const sliderStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/slider');
        await fs.mkdir(dir, { recursive: true});
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const sliderUpload = multer({
    storage: sliderStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo imágenes permitidas'));
        }
    }
});

sliderRouter.get('/', asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT * FROM slider_images ORDER BY position ASC'
    );
    res.json(result.rows);
}));

sliderRouter.post('/', sliderUpload.single('image'), asyncHandler(async (req, res) => {
    const { title, description, alt_text, position = 0, link_url } = req.body;
    
    const result = await query(
        `INSERT INTO slider_images (title, description, image_path, alt_text, position, link_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [title, description, req.file.path, alt_text, position, link_url, req.user.id]
    );
    
    res.status(201).json(result.rows[0]);
}));

sliderRouter.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, alt_text, position, is_active, link_url } = req.body;
    
    const updates = [];
    const params = [id];
    
    if (title) {
        params.push(title);
        updates.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
        params.push(description);
        updates.push(`description = $${params.length}`);
    }
    if (alt_text) {
        params.push(alt_text);
        updates.push(`alt_text = $${params.length}`);
    }
    if (position !== undefined) {
        params.push(position);
        updates.push(`position = $${params.length}`);
    }
    if (is_active !== undefined) {
        params.push(is_active);
        updates.push(`is_active = $${params.length}`);
    }
    if (link_url !== undefined) {
        params.push(link_url);
        updates.push(`link_url = $${params.length}`);
    }
    
    params.push(req.user.id);
    updates.push(`updated_by = $${params.length}`);
    
    const result = await query(
        `UPDATE slider_images SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        params
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    
    res.json(result.rows[0]);
}));

sliderRouter.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const imageResult = await query('SELECT image_path FROM slider_images WHERE id = $1', [id]);
    if (imageResult.rows.length > 0) {
        try {
            await fs.unlink(imageResult.rows[0].image_path);
        } catch (err) {
            console.error('Error deleting image file:', err);
        }
    }
    
    await query('DELETE FROM slider_images WHERE id = $1', [id]);
    res.json({ message: 'Imagen eliminada exitosamente' });
}));

// ========================================
// USERS ROUTES (routes/users.js)
// ========================================
const usersRouter = express.Router();
const bcrypt = require('bcrypt');

usersRouter.get('/', asyncHandler(async (req, res) => {
    const { role, is_active, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let queryStr = `
        SELECT id, email, name, role, is_active, email_verified, totp_enabled,
               last_login, created_at, COUNT(*) OVER() as total_count
        FROM users
        WHERE 1=1
    `;
    const params = [];
    
    if (role) {
        params.push(role);
        queryStr += ` AND role = $${params.length}`;
    }
    if (is_active !== undefined) {
        params.push(is_active);
        queryStr += ` AND is_active = $${params.length}`;
    }
    if (search) {
        params.push(`%${search}%`);
        queryStr += ` AND (email ILIKE $${params.length} OR name ILIKE $${params.length})`;
    }
    
    queryStr += ` ORDER BY created_at DESC`;
    params.push(limit, offset);
    queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await query(queryStr, params);
    const users = result.rows;
    const totalCount = users.length > 0 ? parseInt(users[0].total_count) : 0;
    
    res.json({
        users: users.map(u => {
            const { total_count, ...user } = u;
            return user;
        }),
        pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / limit)
        }
    });
}));

usersRouter.post('/', asyncHandler(async (req, res) => {
    const { email, password, name, role = 'user' } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    const result = await query(
        `INSERT INTO users (email, password_hash, name, role, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, is_active, created_at`,
        [email, hashedPassword, name, role, req.user.id]
    );
    
    res.status(201).json(result.rows[0]);
}));

usersRouter.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, role, is_active, email_verified } = req.body;
    
    const updates = [];
    const params = [id];
    
    if (name) {
        params.push(name);
        updates.push(`name = $${params.length}`);
    }
    if (role) {
        params.push(role);
        updates.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
        params.push(is_active);
        updates.push(`is_active = $${params.length}`);
    }
    if (email_verified !== undefined) {
        params.push(email_verified);
        updates.push(`email_verified = $${params.length}`);
    }
    
    params.push(req.user.id);
    updates.push(`updated_by = $${params.length}`);
    
    const result = await query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1
         RETURNING id, email, name, role, is_active, email_verified`,
        params
    );
    
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
}));

usersRouter.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // No permitir eliminar al propio usuario
    if (id === req.user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }
    
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado exitosamente' });
}));

// ========================================
// AUDIT ROUTES (routes/audit.js)
// ========================================
const auditRouter = express.Router();

auditRouter.get('/', asyncHandler(async (req, res) => {
    const { user_id, action, resource_type, days = 30, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let queryStr = `
        SELECT a.*, u.name as user_name, u.email as user_email,
               COUNT(*) OVER() as total_count
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `;
    const params = [];
    
    if (user_id) {
        params.push(user_id);
        queryStr += ` AND a.user_id = $${params.length}`;
    }
    if (action) {
        params.push(action);
        queryStr += ` AND a.action = $${params.length}`;
    }
    if (resource_type) {
        params.push(resource_type);
        queryStr += ` AND a.resource_type = $${params.length}`;
    }
    
    queryStr += ` ORDER BY a.created_at DESC`;
    params.push(limit, offset);
    queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await query(queryStr, params);
    const logs = result.rows;
    const totalCount = logs.length > 0 ? parseInt(logs[0].total_count) : 0;
    
    res.json({
        logs: logs.map(l => {
            const { total_count, ...log } = l;
            return log;
        }),
        pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / limit)
        }
    });
}));

// ========================================
// DOWNLOADS ROUTES (routes/downloads.js)
// ========================================
const downloadsRouter = express.Router();

downloadsRouter.get('/', asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let queryStr = `
        SELECT d.*, u.name as user_name, u.email as user_email,
               COUNT(*) OVER() as total_count
        FROM downloads d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.user_id = $1
    `;
    const params = [req.user.id];
    
    if (status) {
        params.push(status);
        queryStr += ` AND d.status = $${params.length}`;
    }
    
    queryStr += ` ORDER BY d.created_at DESC`;
    params.push(limit, offset);
    queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await query(queryStr, params);
    const downloads = result.rows;
    const totalCount = downloads.length > 0 ? parseInt(downloads[0].total_count) : 0;
    
    res.json({
        downloads: downloads.map(d => {
            const { total_count, ...download } = d;
            return download;
        }),
        pagination: {
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(totalCount / limit)
        }
    });
}));

downloadsRouter.post('/request', asyncHandler(async (req, res) => {
    const { resource_type, filters } = req.body;
    
    const result = await query(
        `INSERT INTO downloads (user_id, resource_type, filters, status, ip_address, user_agent)
         VALUES ($1, $2, $3, 'pending', $4, $5)
         RETURNING *`,
        [req.user.id, resource_type, JSON.stringify(filters), req.ip, req.headers['user-agent']]
    );
    
    // TODO: Procesar descarga en background
    
    res.status(201).json(result.rows[0]);
}));

// Exportar todos los routers
module.exports = {
    statsRouter,
    sliderRouter,
    usersRouter,
    auditRouter,
    downloadsRouter
};
