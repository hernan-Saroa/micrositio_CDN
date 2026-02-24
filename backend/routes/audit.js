const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Aplicar middleware de autenticación y autorización
router.use(authenticateToken);
router.use(authorizeRole(['admin']));

router.get('/', asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 25,
        action,
        user_id,
        resource_type,
        status,
        date_from,
        date_to,
        search
    } = req.query;

    const offset = (page - 1) * limit;
    let queryStr = `
        SELECT
            a.*,
            u.name as user_name,
            COALESCE(u.email_mask, u.email) AS user_email
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    // Build WHERE clause (shared between main query and count)
    let whereClause = '';

    if (action) {
        params.push(action);
        whereClause += ` AND a.action = $${params.length}`;
    }

    if (user_id) {
        params.push(user_id);
        whereClause += ` AND a.user_id = $${params.length}`;
    }

    if (resource_type) {
        params.push(resource_type);
        whereClause += ` AND a.resource_type = $${params.length}`;
    }

    if (status) {
        params.push(status);
        whereClause += ` AND a.status = $${params.length}`;
    }

    if (date_from) {
        params.push(date_from);
        whereClause += ` AND a.created_at >= $${params.length}`;
    }

    if (date_to) {
        params.push(date_to + ' 23:59:59');
        whereClause += ` AND a.created_at <= $${params.length}`;
    }

    if (search) {
        params.push(`%${search}%`);
        whereClause += ` AND (u.name LIKE $${params.length} OR COALESCE(u.email_mask, u.email) LIKE $${params.length})`;
    }

    queryStr += whereClause;

    // Ordering & pagination
    queryStr += ` ORDER BY a.created_at DESC`;
    const mainParams = [...params];
    mainParams.push(parseInt(limit), offset);
    queryStr += ` LIMIT $${mainParams.length - 1} OFFSET $${mainParams.length}`;

    const result = await query(queryStr, mainParams);

    // Count query
    let countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
    ` + whereClause;

    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Stats queries
    let statsResult;
    try {
        const todayQ = await query(`SELECT COUNT(*) as c FROM audit_logs WHERE date(created_at) = date('now')`);
        const loginQ = await query(`SELECT COUNT(*) as c FROM audit_logs WHERE action = 'login'`);
        const failedQ = await query(`SELECT COUNT(*) as c FROM audit_logs WHERE status = 'failed'`);
        statsResult = {
            today: parseInt(todayQ.rows[0].c),
            logins: parseInt(loginQ.rows[0].c),
            failed: parseInt(failedQ.rows[0].c)
        };
    } catch (e) {
        statsResult = { today: 0, logins: 0, failed: 0 };
    }

    // Parse JSON fields
    const parsedLogs = result.rows.map(log => {
        try { if (log.old_values && typeof log.old_values === 'string') log.old_values = JSON.parse(log.old_values); } catch { }
        try { if (log.new_values && typeof log.new_values === 'string') log.new_values = JSON.parse(log.new_values); } catch { }
        return log;
    });

    res.json({
        audit_logs: parsedLogs,
        stats: statsResult,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
        }
    });
}));

module.exports = router;
