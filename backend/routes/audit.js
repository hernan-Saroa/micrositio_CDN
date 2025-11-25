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
        limit = 50,
        action,
        user_id,
        resource_type,
        status,
        date_from,
        date_to
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

    // Filtros
    if (action) {
        params.push(action);
        queryStr += ` AND a.action = $${params.length}`;
    }

    if (user_id) {
        params.push(user_id);
        queryStr += ` AND a.user_id = $${params.length}`;
    }

    if (resource_type) {
        params.push(resource_type);
        queryStr += ` AND a.resource_type = $${params.length}`;
    }

    if (status) {
        params.push(status);
        queryStr += ` AND a.status = $${params.length}`;
    }

    if (date_from) {
        params.push(date_from);
        queryStr += ` AND a.created_at >= $${params.length}`;
    }

    if (date_to) {
        params.push(date_to + ' 23:59:59');
        queryStr += ` AND a.created_at <= $${params.length}`;
    }

    // Ordenamiento y paginación
    queryStr += ` ORDER BY a.created_at DESC`;
    params.push(limit, offset);
    queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    console.log('Query de auditoría:', queryStr);
    console.log('Parámetros:', params);

    const result = await query(queryStr, params);

    // Obtener total para paginación
    let countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
    `;
    const countParams = [];

    if (action) {
        countParams.push(action);
        countQuery += ` AND a.action = $${countParams.length}`;
    }
    if (user_id) {
        countParams.push(user_id);
        countQuery += ` AND a.user_id = $${countParams.length}`;
    }
    if (resource_type) {
        countParams.push(resource_type);
        countQuery += ` AND a.resource_type = $${countParams.length}`;
    }
    if (status) {
        countParams.push(status);
        countQuery += ` AND a.status = $${countParams.length}`;
    }
    if (date_from) {
        countParams.push(date_from);
        countQuery += ` AND a.created_at >= $${countParams.length}`;
    }
    if (date_to) {
        countParams.push(date_to + ' 23:59:59');
        countQuery += ` AND a.created_at <= $${countParams.length}`;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
        audit_logs: result.rows,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
        }
    });
}));

module.exports = router;
