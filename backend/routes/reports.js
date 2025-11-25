/**
 * Rutas de Gestión de Reportes/Documentos
 * VIITS - INVIAS Colombia
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Configurar Multer para subida de archivos
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/reports');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 50 * 1024 * 1024 // 50MB default
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new AppError('Solo se permiten archivos PDF', 400));
        }
    }
});

// ========================================
// GET /api/reports/public
// Obtener reportes públicos para el frontend (sin autenticación)
// ========================================
router.get('/public', asyncHandler(async (req, res) => {
    const { limit = 50, featured = null, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = `
        SELECT
            r.id,
            r.title,
            r.description,
            r.file_name,
            r.file_size,
            r.mime_type,
            r.is_featured,
            r.view_count,
            r.download_count,
            r.created_at,
            r.published_at,
            u.name as created_by_name
        FROM reports r
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.is_public = true
    `;
    const params = [];

    // Filtro por destacados si se especifica
    if (featured !== null) {
        params.push(featured === 'true');
        queryStr += ` AND r.is_featured = $${params.length}`;
    }

    // Obtener total para estadísticas
    const totalQuery = await query(`SELECT COUNT(*) as total FROM reports WHERE is_public = true`);
    const totalReports = parseInt(totalQuery.rows[0].total);

    // Obtener total de descargas
    const downloadsQuery = await query(`SELECT SUM(download_count) as total_downloads FROM reports WHERE is_public = true`);
    const totalDownloads = parseInt(downloadsQuery.rows[0].total_downloads || 0);

    // Obtener reportes del mes actual
    const currentMonth = new Date();
    currentMonth.setDate(1); // Primer día del mes
    const thisMonthQuery = await query(`SELECT COUNT(*) as this_month FROM reports WHERE is_public = true AND created_at >= $1`, [currentMonth]);
    const thisMonthReports = parseInt(thisMonthQuery.rows[0].this_month);

    // Obtener tamaño promedio
    const avgSizeQuery = await query(`SELECT AVG(file_size) as avg_size FROM reports WHERE is_public = true`);
    const avgSizeBytes = parseFloat(avgSizeQuery.rows[0].avg_size || 0);
    const avgSizeFormatted = avgSizeBytes >= 1024 * 1024 ?
        (avgSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' :
        Math.round(avgSizeBytes / 1024) + ' KB';

    // Ordenar por fecha de creación descendente (más recientes primero)
    queryStr += ` ORDER BY r.created_at DESC`;

    // Paginación
    params.push(parseInt(limit), offset);
    queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryStr, params);

    // Formatear respuesta
    const reports = result.rows.map(report => ({
        id: report.id,
        title: report.title,
        description: report.description,
        fileName: report.file_name,
        fileSize: report.file_size,
        mimeType: report.mime_type,
        isFeatured: report.is_featured,
        viewCount: report.view_count,
        downloadCount: report.download_count,
        createdAt: report.created_at,
        publishedAt: report.published_at,
        createdBy: report.created_by_name,
        // URL para descarga (sin autenticación para archivos públicos)
        downloadUrl: `/api/reports/${report.id}/download`
    }));

    res.json({
        reports,
        total: totalReports,
        totalDownloads,
        thisMonth: thisMonthReports,
        avgSize: avgSizeFormatted,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalReports / limit)
        }
    });
}));

// ========================================
// GET /api/reports
// Obtener todos los reportes (con paginación y filtros) - PROTEGIDO
// ========================================
router.get('/', asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        search = '',
        is_public = null,
        sort_by = 'created_at',
        sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;

    // Construir query
    let queryStr = `
        SELECT 
            r.*,
            u.name as created_by_name,
            COUNT(*) OVER() as total_count
        FROM reports r
        LEFT JOIN users u ON r.created_by = u.id
        WHERE 1=1
    `;
    const params = [];

    // Filtros
    if (search) {
        params.push(`%${search}%`);
        queryStr += ` AND (r.title ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
    }

    if (is_public !== null) {
        params.push(is_public === 'true');
        queryStr += ` AND r.is_public = $${params.length}`;
    }

    // Ordenamiento
    queryStr += ` ORDER BY r.${sort_by} ${sort_order}`;

    // Paginación
    params.push(limit, offset);
    queryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryStr, params);

    const reports = result.rows;
    const totalCount = reports.length > 0 ? parseInt(reports[0].total_count) : 0;

    res.json({
        reports: reports.map(r => {
            const { total_count, ...report } = r;
            return report;
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
// GET /api/reports/:id
// Obtener un reporte por ID
// ========================================
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT r.*, u.name as created_by_name
         FROM reports r
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new AppError('Reporte no encontrado', 404);
    }

    // Incrementar contador de vistas
    await query(
        'UPDATE reports SET view_count = view_count + 1 WHERE id = $1',
        [id]
    );

    res.json(result.rows[0]);
}));

// ========================================
// POST /api/reports
// Crear nuevo reporte
// ========================================
router.post('/', [
    authenticateToken,
    authorizeRole(['admin', 'editor']),
    upload.single('file')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    if (!req.file) {
        throw new AppError('Archivo PDF requerido', 400);
    }

    // Obtener valores del body (FormData)
    const { title, description, is_public = 'true', is_featured = 'false' } = req.body;

    // Validaciones básicas
    if (!title || title.trim() === '') {
        throw new AppError('Título es requerido', 400);
    }

    if (!description || description.trim() === '') {
        throw new AppError('Descripción es requerida', 400);
    }

    const result = await query(
        `INSERT INTO reports (
            title, description, file_name, file_path, file_size, mime_type,
            is_public, is_featured, published_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
        RETURNING *`,
        [
            title.trim(),
            description.trim(),
            req.file.originalname,
            req.file.path,
            req.file.size,
            req.file.mimetype,
            is_public === 'true',
            is_featured === 'true',
            req.user.id
        ]
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address)
         VALUES ($1, 'create_report', 'report', $2, $3, $4)`,
        [req.user.id, result.rows[0].id, JSON.stringify(result.rows[0]), req.ip]
    );

    logger.info(`Usuario ${req.user.email} creó reporte: ${title}`);

    res.status(201).json(result.rows[0]);
}));

// ========================================
// PUT /api/reports/:id
// Actualizar reporte
// ========================================
router.put('/:id', [
    authenticateToken,
    authorizeRole(['admin', 'editor']),
    body('title').optional().notEmpty().trim(),
    body('description').optional().trim()
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, is_public, is_featured } = req.body;

    // Obtener valores actuales
    const currentResult = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
        throw new AppError('Reporte no encontrado', 404);
    }

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
    if (is_public !== undefined) {
        params.push(is_public);
        updates.push(`is_public = $${params.length}`);
    }
    if (is_featured !== undefined) {
        params.push(is_featured);
        updates.push(`is_featured = $${params.length}`);
    }

    params.push(req.user.id);
    updates.push(`updated_by = $${params.length}`);

    const result = await query(
        `UPDATE reports SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        params
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address)
         VALUES ($1, 'update_report', 'report', $2, $3, $4, $5)`,
        [req.user.id, id, JSON.stringify(currentResult.rows[0]), JSON.stringify(result.rows[0]), req.ip]
    );

    logger.info(`Usuario ${req.user.email} actualizó reporte ID: ${id}`);

    res.json(result.rows[0]);
}));

// ========================================
// DELETE /api/reports/:id
// Eliminar reporte
// ========================================
router.delete('/:id', [
    authenticateToken,
    authorizeRole(['admin'])
], asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Obtener información del reporte
    const reportResult = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportResult.rows.length === 0) {
        throw new AppError('Reporte no encontrado', 404);
    }

    const report = reportResult.rows[0];

    // Eliminar archivo físico
    try {
        await fs.unlink(report.file_path);
    } catch (error) {
        logger.warn(`No se pudo eliminar archivo: ${report.file_path}`);
    }

    // Eliminar de base de datos
    await query('DELETE FROM reports WHERE id = $1', [id]);

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address)
         VALUES ($1, 'delete_report', 'report', $2, $3, $4)`,
        [req.user.id, id, JSON.stringify(report), req.ip]
    );

    logger.info(`Usuario ${req.user.email} eliminó reporte ID: ${id}`);

    res.json({ message: 'Reporte eliminado exitosamente' });
}));

// ========================================
// GET /api/reports/:id/download
// Descargar reporte (permite acceso público para archivos públicos)
// ========================================
router.get('/:id/download', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        throw new AppError('Reporte no encontrado', 404);
    }

    const report = result.rows[0];

    // Verificar si el archivo es público o si el usuario está autenticado
    if (!report.is_public && !req.user) {
        throw new AppError('Acceso denegado. Este archivo requiere autenticación.', 401);
    }

    // Incrementar contador de descargas
    await query(
        'UPDATE reports SET download_count = download_count + 1 WHERE id = $1',
        [id]
    );

    // Log descarga si el usuario está autenticado
    if (req.user) {
        await query(
            `INSERT INTO downloads (user_id, resource_type, resource_id, file_name, status, ip_address, completed_at)
             VALUES ($1, 'report', $2, $3, 'completed', $4, NOW())`,
            [req.user.id, id, report.file_name, req.ip]
        );
    }

    // Log
    const userLog = req.user ? req.user.id : null;
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address)
         VALUES ($1, 'download_report', 'report', $2, $3, $4)`,
        [userLog, id, JSON.stringify(report), req.ip]
    );

    // Enviar archivo
    res.download(report.file_path, report.file_name);
}));

module.exports = router;
