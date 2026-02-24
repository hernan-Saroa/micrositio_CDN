const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// GET /api/config/public
// Get public site configuration (footer, site name, etc.)
router.get('/public', asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT config_key, config_value FROM system_config WHERE is_public = true'
    );

    const config = {};
    (result.rows || result).forEach(row => {
        let val = row.config_value;
        try { val = JSON.parse(val); } catch (_) { /* keep raw */ }
        config[row.config_key] = val;
    });

    res.json(config);
}));

// Protect admin config routes
router.use(authenticateToken);
router.use(authorizeRole(['admin']));

// ========================================
// GET /api/config
// Return all system configuration
// ========================================
router.get('/', asyncHandler(async (req, res) => {
    const result = await query('SELECT config_key, config_value, description FROM system_config ORDER BY config_key');

    // Convert rows array into a key-value object for easier frontend consumption
    const config = {};
    (result.rows || result).forEach(row => {
        let val = row.config_value;
        // Try to parse JSON-wrapped values
        try { val = JSON.parse(val); } catch (_) { /* keep raw */ }
        config[row.config_key] = val;
    });

    res.json({ config });
}));

// ========================================
// PUT /api/config
// Update one or more config keys
// Body: { key1: value1, key2: value2 }
// ========================================
router.put('/', asyncHandler(async (req, res) => {
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron datos para actualizar' });
    }

    let updatedCount = 0;

    for (const [key, rawValue] of Object.entries(updates)) {
        // Stringify non-string values for storage
        const value = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);

        // UPSERT: update if exists, insert if not
        const existing = await query('SELECT id FROM system_config WHERE config_key = $1', [key]);

        if ((existing.rows || existing).length > 0) {
            await query(
                'UPDATE system_config SET config_value = $1, updated_at = datetime(\'now\'), updated_by = $2 WHERE config_key = $3',
                [value, req.user.id, key]
            );
        } else {
            await query(
                'INSERT INTO system_config (config_key, config_value, updated_by) VALUES ($1, $2, $3)',
                [key, value, req.user.id]
            );
        }
        updatedCount++;
    }

    // Log the change
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, new_values, ip_address, user_agent, status)
         VALUES ($1, 'update_config', 'system_config', $2, $3, $4, 'success')`,
        [req.user.id, JSON.stringify(updates), req.ip, req.get('User-Agent')]
    );

    res.json({ message: `${updatedCount} configuración(es) actualizada(s)`, updated: updatedCount });
}));

module.exports = router;
