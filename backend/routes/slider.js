/**
 * Rutas de Gestión del Slider de Imágenes
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

// Configurar Multer para subida de imágenes
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/slider');
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
        fileSize: 10 * 1024 * 1024 // 10MB máximo para imágenes
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new AppError('Solo se permiten archivos de imagen (JPEG, PNG, GIF, WebP)', 400));
        }
    }
});

// Función para corregir el path del archivo después de subir
const fixImagePath = (filePath) => {
    // Extraer solo el filename del path completo
    return path.basename(filePath);
};

// ========================================
// GET /api/slider
// Obtener todas las imágenes del slider
// ========================================
router.get('/', asyncHandler(async (req, res) => {
    const result = await query('SELECT * FROM slider_images ORDER BY position ASC');
    res.json(result.rows);
}));

// ========================================
// POST /api/slider
// Crear nueva imagen del slider
// ========================================
router.post('/', [
    authenticateToken,
    authorizeRole(['admin', 'editor']),
    upload.single('image')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError('Datos inválidos', 400);
    }

    if (!req.file) {
        throw new AppError('Imagen requerida', 400);
    }

    // Obtener valores del body (FormData)
    const { title, subtitle, description, position = 0, link_url } = req.body;

    // Validaciones básicas
    if (!title || title.trim() === '') {
        throw new AppError('Título es requerido', 400);
    }

    // Obtener la siguiente posición si no se especifica
    let finalPosition = position;
    if (position === 0 || position === '0') {
        const maxPosResult = await query('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM slider_images');
        finalPosition = maxPosResult.rows[0].next_pos;
    }

    const result = await query(
        `INSERT INTO slider_images (
            title, description, image_path, alt_text, position, is_active, link_url, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
            title.trim(),
            description ? description.trim() : null,
            req.file.filename, // Solo el nombre del archivo, no la ruta completa
            subtitle.trim(), // alt_text = title por defecto
            finalPosition,
            true, // is_active por defecto
            link_url ? link_url.trim() : null,
            req.user.id
        ]
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address)
         VALUES ($1, 'create_slider_image', 'slider_image', $2, $3, $4)`,
        [req.user.id, result.rows[0].id, JSON.stringify(result.rows[0]), req.ip]
    );

    logger.info(`Usuario ${req.user.email} creó imagen del slider: ${title}`);

    res.status(201).json(result.rows[0]);
}));

// Configurar Multer para actualización (sin destination ya que no siempre hay archivo)
const updateUpload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB máximo para imágenes
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new AppError('Solo se permiten archivos de imagen (JPEG, PNG, GIF, WebP)', 400));
        }
    }
});

// ========================================
// PUT /api/slider/:id
// Actualizar imagen del slider
// ========================================
router.put('/:id', [
    authenticateToken,
    authorizeRole(['admin', 'editor']),
    updateUpload.single('image'), // Agregar multer para manejar archivos opcionales
    body('title').optional().notEmpty().trim(),
    body('subtitle').optional().trim(),
    body('description').optional().trim(),
    body('position').optional().isInt({ min: 0 }),
    body('is_active').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, subtitle, description, position, is_active, link_url } = req.body;

    // Obtener valores actuales
    const currentResult = await query('SELECT * FROM slider_images WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
        throw new AppError('Imagen del slider no encontrada', 404);
    }

    const updates = [];
    const params = [id];
    let hasUpdates = false;

    // Manejar nueva imagen si se subió
    let newImagePath = null;
    if (req.file) {
        newImagePath = req.file.filename; // Solo el nombre del archivo

        // Eliminar imagen anterior si existe
        const currentImage = currentResult.rows[0];
        if (currentImage.image_path) {
            try {
                const oldImagePath = path.join(__dirname, '../uploads/slider', currentImage.image_path);
                await fs.unlink(oldImagePath);
                logger.info(`Imagen anterior eliminada: ${oldImagePath}`);
            } catch (error) {
                logger.warn(`No se pudo eliminar imagen anterior: ${currentImage.image_path}`);
            }
        }

        params.push(newImagePath);
        updates.push(`image_path = $${params.length}`);
        hasUpdates = true;
    }

    if (title !== undefined && title !== null) {
        params.push(title);
        updates.push(`title = $${params.length}`);
        hasUpdates = true;
    }
    if (subtitle !== undefined && subtitle !== null) {
        params.push(subtitle);
        updates.push(`alt_text = $${params.length}`);
        hasUpdates = true;
    }
    if (description !== undefined) {
        params.push(description);
        updates.push(`description = $${params.length}`);
        hasUpdates = true;
    }
    if (position !== undefined) {
        params.push(position);
        updates.push(`position = $${params.length}`);
        hasUpdates = true;
    }
    if (is_active !== undefined) {
        params.push(is_active === 'true' || is_active === true);
        updates.push(`is_active = $${params.length}`);
        hasUpdates = true;
    }
    if (link_url !== undefined) {
        params.push(link_url);
        updates.push(`link_url = $${params.length}`);
        hasUpdates = true;
    }

    // Si no hay actualizaciones, devolver error
    if (!hasUpdates) {
        throw new AppError('No se proporcionaron campos para actualizar', 400);
    }

    params.push(req.user.id);
    updates.push(`updated_by = $${params.length}`);

    const result = await query(
        `UPDATE slider_images SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        params
    );

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address)
         VALUES ($1, 'update_slider_image', 'slider_image', $2, $3, $4, $5)`,
        [req.user.id, id, JSON.stringify(currentResult.rows[0]), JSON.stringify(result.rows[0]), req.ip]
    );

    logger.info(`Usuario ${req.user.email} actualizó imagen del slider ID: ${id}`);

    res.json(result.rows[0]);
}));

// ========================================
// DELETE /api/slider/:id
// Eliminar imagen del slider
// ========================================
router.delete('/:id', [
    authenticateToken,
    authorizeRole(['admin'])
], asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Obtener información de la imagen
    const imageResult = await query('SELECT * FROM slider_images WHERE id = $1', [id]);
    if (imageResult.rows.length === 0) {
        throw new AppError('Imagen del slider no encontrada', 404);
    }

    const image = imageResult.rows[0];

    // Eliminar archivo físico
    try {
        await fs.unlink(image.image_path);
    } catch (error) {
        logger.warn(`No se pudo eliminar archivo de imagen: ${image.image_path}`);
    }

    // Eliminar de base de datos
    await query('DELETE FROM slider_images WHERE id = $1', [id]);

    // Log
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address)
         VALUES ($1, 'delete_slider_image', 'slider_image', $2, $3, $4)`,
        [req.user.id, id, JSON.stringify(image), req.ip]
    );

    logger.info(`Usuario ${req.user.email} eliminó imagen del slider ID: ${id}`);

    res.json({ message: 'Imagen del slider eliminada exitosamente' });
}));

module.exports = router;
