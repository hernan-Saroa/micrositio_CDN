const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createClient } = require('@clickhouse/client');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { Parser } = require('json2csv');

// Función helper para formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1000; // base decimal
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Cola de tareas para procesamiento asíncrono
const processingQueue = [];
let isProcessing = false;

// Función para procesar la cola de tareas
async function processQueue() {
    if (isProcessing || processingQueue.length === 0) {
        return;
    }

    isProcessing = true;

    while (processingQueue.length > 0) {
        const task = processingQueue.shift();
        try {
            await processCsvGeneration(task);
        } catch (error) {
            console.error('Error procesando tarea:', error);
        }
    }

    isProcessing = false;
}

// Configuraciones por tabla para campos y headers
const tableConfigs = {
    'Basculas': {
        headers: ['PLACA', 'LONGITUD', 'LATITUD', 'FECHA', 'CLASE_RUNT', 'CLASE_INVIAS', 'EJES', 'DESCRIP_CATALOGO', 'PESO'],
        fields: ['fcPldPlate', 'fnCtlgLng', 'fnCtlgLat', 'fdFecha', 'fcRuntCustomClass', 'fcInviasCustomClass', 'fnWghtAxlesCount', 'fcCtlgDesc', 'fnWghtGrossWeight']
    },
    'ConteosFijosMoviles': {
        headers: ['PLACA', 'LONGITUD', 'LATITUD', 'FECHA', 'CLASE_RUNT', 'DESCRIP_CATALOGO', 'VELOCIDAD'],
        fields: ['fcPldPlate', 'fnCtlgLng', 'fnCtlgLat', 'fdFecha', 'fcRuntCustomClass', 'fcCtlgDesc', 'fnAttrSpeed']
    },
    'DAI': {
        headers: ['PLACA', 'LONGITUD', 'LATITUD', 'FECHA', 'CLASE_RUNT', 'DESCRIP_CATALOGO', 'VELOCIDAD'],
        fields: ['fcPldPlate', 'fnCtlgLng', 'fnCtlgLat', 'fdFecha', 'fcRuntCustomClass', 'fcCtlgDesc', 'fnAttrSpeed']
    },
    'Galibos': {
        headers: ['PLACA', 'LONGITUD', 'LATITUD', 'FECHA', 'CLASE_RUNT', 'DESCRIP_CATALOGO', 'VELOCIDAD', 'ALTURA'],
        fields: ['fcPldPlate', 'fnCtlgLng', 'fnCtlgLat', 'fdFecha', 'fcRuntCustomClass', 'fcCtlgDesc', 'fnAttrSpeed', 'fnAttrCharHeight']
    },
    'RadaresVelocidad': {
        headers: ['LONGITUD', 'LATITUD', 'FECHA', 'DESCRIP_CATALOGO', 'VELOCIDAD'],
        fields: ['fnCtlgLng', 'fnCtlgLat', 'fdFecha', 'fcCtlgDesc', 'fnPldSpeed']
    }
};

// Función para generar CSV de forma asíncrona
async function processCsvGeneration(task) {
    const { downloadId, filters } = task;

    try {
        console.log(`Iniciando generación de CSV para descarga ${downloadId}`);

        // Actualizar estado a 'processing'
        await query('UPDATE downloads SET status = $1 WHERE id = $2', ['processing', downloadId]);

        // Crear cliente ClickHouse
        const client = createClient(clickhouseConfig);

        // Parsear fechas
        const [startDate, endDate] = filters.dateRange.split(' a ');
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1); // Incluir el día siguiente
        const newEndDate = end.toISOString().split('T')[0];

        // Mapear tabla para clickhouse
        const deviceMappingTable = {
            'WIM': 'Basculas',
            'Conteos Fijos': 'ConteosFijosMoviles',
            'Conteos Móviles': 'ConteosFijosMoviles',
            'DAI': 'DAI',
            'Galibos': 'Galibos',
            'Radares': 'RadaresVelocidad'
        };

        // Determinar tabla basada en deviceType
        const tableName = deviceMappingTable[filters.deviceType];
        if (!tableName) {
            throw new Error(`Tipo de dispositivo no soportado: ${filters.deviceType}`);
        }

        // Obtener configuración de la tabla
        const tableConfig = tableConfigs[tableName];
        if (!tableConfig) {
            throw new Error(`Configuración no encontrada para tabla: ${tableName}`);
        }

        let csvHeaders = tableConfig.headers;
        // Construir SELECT dinámico basado en la configuración de la tabla
        const selectFields = tableConfig.fields.map((field, index) =>
            `${field} as ${csvHeaders[index]}`
        ).join(',\n                ');

        // Query para obtener datos
        let sqlQuery = `
            SELECT
                ${selectFields}
            FROM ${tableName}
            WHERE fdFecha >= {startDate:String} AND fdFecha <= {endDate:String}
        `;

        // Agregar condición específica para ConteosFijosMoviles basada en deviceType
        if (tableName === 'ConteosFijosMoviles') {
            const auxiliarValue = filters.deviceType === 'Conteos Fijos' ? 'F' : 'M';
            sqlQuery += ` AND fcCtlgAuxiliar = '${auxiliarValue}'`;
        }

        if (filters.devices.length > 0) {
            sqlQuery += ` AND fcCtlgDesc IN (${filters.devices.map(a => `'${a}'`).join(', ')})`;
        }

        sqlQuery += `
            ORDER BY toDate(fdFecha), fcCtlgDesc
        `;

        // Generar nombre de archivo
        const fileName = `${tableName}_${downloadId}_${new Date().toISOString().split('T')[0]}.csv`;
        const filePath = path.join(__dirname, '../temp', fileName);

        if (tableName === 'ConteosFijosMoviles' && filters.deviceType === 'Conteos Móviles') {
            csvHeaders = [];
            sqlQuery = `
                SELECT
                    'NULL' AS Departamento,
                    fcCtlgDesc AS Dispositivo,
                    arrayElement(
                        ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
                        month(toStartOfWeek(fdFecha))
                    ) AS Mes,
                    formatDateTime(toStartOfWeek(fdFecha), '%d/%m/%Y') AS Desde,
                    formatDateTime(toLastDayOfWeek(fdFecha), '%d/%m/%Y') AS Hasta,
                    'NULL' AS Longitud,
                    'NULL' AS Latitud,
                    countIf(fcTPDCategoryClass = 'Motocicleta') AS Motocicletas,
                    round(Motocicletas / 7, 2) AS "TPD Motocicletas",
                    countIf(fcTPDCategoryClass = 'Autos') AS "Automoviles (Categoria I)",
                    round("Automoviles (Categoria I)" / 7, 2) AS "TPD Automoviles (Categoria I)",
                    countIf(fcRuntClass IN ('C2', 'CAMION', 'Buses')) AS "Categoria II",
                    round("Categoria II" / 7, 2) AS "TPD Categoria II",
                    countIf(fcRuntClass IN ('C3', 'VOLQUETA')) AS "Categoria III",
                    round("Categoria III" / 7, 2) AS "TPD Categoria III",
                    countIf(fcRuntClass = 'C4') AS "Categoria IV",
                    round("Categoria IV" / 7, 2) AS "TPD Categoria IV",
                    countIf(fcRuntClass = 'C5') AS "Categoria V",
                    round("Categoria V" / 7, 2) AS "TPD Categoria V",
                    countIf(fcRuntClass IN ('C6', 'C7')) AS "Categoria > V",
                    round("Categoria > V" / 7, 2) AS "TPD Categoria > V",
                    (
                        countIf(fcTPDCategoryClass IN('Motocicleta', 'Autos'))
                        + countIf(fcRuntClass IN ('C2','C3','C4', 'C5', 'C6', 'C7', 'CAMION', 'Buses', 'VOLQUETA'))
                    ) AS "Total"
                FROM ConteosFijosMoviles
                WHERE fcCtlgAuxiliar = 'M' AND fdFecha >= {startDate:String} AND fdFecha <= {endDate:String}
                GROUP BY
                    fcCtlgDesc, toStartOfWeek(fdFecha), toLastDayOfWeek(fdFecha), month(toStartOfWeek(fdFecha))
                ORDER BY
                    fcCtlgDesc, Desde;
            `;
            const resultSet = await client.query({
                query: sqlQuery,
                query_params: { startDate: start, endDate: newEndDate },
                format: 'JSONEachRow'
            });

            const dbRows = await resultSet.json();

            // ----------- LEER Y NORMALIZAR EXCEL ------------
            const excelPath = path.join(__dirname, '../data/matriz_conteos_moviles.xlsx');
            const workbook = xlsx.readFile(excelPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const excelRaw = xlsx.utils.sheet_to_json(sheet, { defval: null });

            const excelData = excelRaw.map(r => ({
                id: r["ID"] != null ? String(r["ID"]).trim() : null,
                fechaInicio: parseExcelFechaInicio(r["FECHA DE INICIO"]),
                fechaFinal: parseExcelFechaInicio(r["FECHA FINAL"]),
                latitud: r["LATITUD"] != null ? Number(r["LATITUD"]) : null,
                longitud: r["LONGITUD"] != null ? Number(r["LONGITUD"]) : null,
                departamento: r["DEPARTAMENTO"] != null ? String(r["DEPARTAMENTO"]).trim() : null,
            }));
            // console.log('excelData:', excelData);

            // ----------- REEMPLAZAR LONGITUD/LATITUD/DEPARTAMENTO ------------
            const mergedRows = dbRows.map(row => {
                const match = findGeo(excelData, row.Dispositivo, row.Desde, row.Hasta);
                // console.log('match:', row.Dispositivo, row.Desde, row.Hasta, match);
                if (match) {
                    if (match.longitud != null) row.Longitud = match.longitud;
                    if (match.latitud != null) row.Latitud = match.latitud;
                    if (match.departamento != null) row.Departamento = match.departamento;
                }
                return row;
            });

            // ----------- GENERAR CSV FINAL ------------
            const fields = Object.keys(mergedRows[0]);
            const parser = new Parser({ fields });
            const csv = parser.parse(mergedRows);

            fs.writeFileSync(filePath, csv, 'utf8');

        } else {

            const resultSet = await client.query({
                query: sqlQuery,
                query_params: { startDate: start, endDate: newEndDate },
                format: 'CSVWithNames'
            });

            // Leer CSV completo como texto
            const csv = await resultSet.text();

            // Guardarlo directamente
            fs.writeFileSync(filePath, csv, 'utf8');
        }

        console.log(`✅ CSV generado directamente por ClickHouse: ${filePath}`);

        // Obtener tamaño del archivo generado
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        // Actualizar descarga con URL del archivo, tamaño y estado completado
        const downloadUrl = `/temp/${fileName}`;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Expira en 24 horas

        await query(
            'UPDATE downloads SET status = $1, download_url = $2, expires_at = $3, completed_at = $4 WHERE id = $5',
            ['completed', downloadUrl, expiresAt, new Date(), downloadId]
        );

        console.log(`Descarga ${downloadId} completada exitosamente - Archivo: ${fileName} (${formatFileSize(fileSize)})`);

    } catch (error) {
        console.error(`Error generando CSV para descarga ${downloadId}:`, error);

        // Actualizar estado a 'failed'
        await query('UPDATE downloads SET status = $1 WHERE id = $2', ['failed', downloadId]);
    }
}

function parseExcelFechaInicio(value) {
    if (!value) return null;

    // 1. Ya es Date
    if (value instanceof Date) return value;

    // 2. Número serial de Excel
    if (typeof value === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // base Excel
        const msPerDay = 24 * 60 * 60 * 1000;
        return new Date(excelEpoch.getTime() + value * msPerDay);
    }

    // 3. String en d/m/yyyy, dd/mm/yyyy o yyyy-mm-dd
    const s = String(value).trim();
    if (!s) return null;

    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length !== 3) return null;
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return null;
        return new Date(y, m - 1, d);
    }

    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length !== 3) return null;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return null;
        return new Date(y, m - 1, d);
    }

    return null;
}

// ----------- BUSCAR MATCH EN EXCEL ------------
function findGeo(excelData, dispositivo, desdeStr, hastaStr) {
    const dispositivoId = getDeviceIdFromDispositivo(dispositivo);

    if (!dispositivoId) return null;

    const [d1, m1, y1] = desdeStr.split('/').map(Number);
    const [d2, m2, y2] = hastaStr.split('/').map(Number);

    const desde = new Date(y1, m1 - 1, d1);
    const hasta = new Date(y2, m2 - 1, d2);
    // console.log('dispositivoId:', dispositivoId, 'desde:', desde, 'hasta:', hasta);
    const existData = excelData.find(row =>
        row.id === dispositivoId &&
        row.fechaInicio &&
        desde >= row.fechaInicio &&
        desde <= row.fechaFinal
    );
    if (existData) {
        return existData;
    } else {
        return excelData.find(row =>
            row.id === dispositivoId &&
            hasta >= row.fechaInicio &&
            hasta <= row.fechaFinal
        );
    }
}

function getDeviceIdFromDispositivo(dispositivo) {
    // console.log('getDeviceIdFromDispositivo:', dispositivo);
    if (!dispositivo) return null;
    const str = String(dispositivo).trim();

    // Opción 1: después del último '-'
    const parts = str.split('-');
    const lastPart = parts[parts.length - 1].trim();

    // Si la última parte son solo dígitos, usamos eso
    if (/^\d+$/.test(lastPart)) {
        return lastPart;
    }

    // Opción 2: tomar solo los últimos dígitos del string
    const match = str.match(/(\d+)\s*$/);
    if (match) {
        return match[1];
    }

    return null;
}

// Configuración de ClickHouse
const clickhouseConfig = {
    url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
};

// GET /api/downloads/all - Admin: ver TODAS las descargas con info del usuario
router.get('/all', authenticateToken, authorizeRole(['admin']), asyncHandler(async (req, res) => {
    console.log('📥 [ADMIN] GET /api/downloads/all llamado', { page: req.query.page, status: req.query.status, search: req.query.search });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const search = req.query.search || '';

    // Construir condiciones WHERE
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
        conditions.push(`d.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }
    if (search) {
        conditions.push(`(u.name LIKE $${paramIndex} OR u.email LIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Estadísticas globales
    const statsResult = await query(`
        SELECT 
            COUNT(*) as total_downloads,
            COUNT(CASE WHEN d.status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN d.status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN d.status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN d.status = 'completed' AND date(d.completed_at) = date('now') THEN 1 END) as completed_today
        FROM downloads d
        LEFT JOIN users u ON d.user_id = u.id
        ${whereClause}
    `, params);

    const stats = statsResult.rows[0] || {};

    // Total para paginación (usando las mismas condiciones)
    const totalResult = await query(`
        SELECT COUNT(*) as total 
        FROM downloads d
        LEFT JOIN users u ON d.user_id = u.id
        ${whereClause}
    `, params);
    const total = parseInt(totalResult.rows[0].total);

    // Consulta principal con JOIN a users
    const mainParams = [...params, limit, offset];
    const result = await query(`
        SELECT 
            d.id,
            d.user_id,
            d.resource_type,
            d.resource_id,
            d.file_name,
            d.filters,
            d.status,
            d.download_url,
            d.expires_at,
            d.ip_address,
            d.user_agent,
            d.created_at,
            d.completed_at,
            u.name as user_name,
            COALESCE(u.email_mask, u.email) as user_email,
            u.role as user_role
        FROM downloads d
        LEFT JOIN users u ON d.user_id = u.id
        ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, mainParams);

    // Procesar resultados para agregar info del archivo y parsear filters
    const downloads = await Promise.all(result.rows.map(async (dl) => {
        const data = { ...dl };

        // Parsear filters JSON
        try {
            data.filters_parsed = dl.filters ? JSON.parse(dl.filters) : null;
        } catch { data.filters_parsed = null; }

        // Verificar archivo si está completada
        if (dl.status === 'completed' && dl.download_url) {
            try {
                const fileName = dl.download_url.replace('/temp/', '');
                const filePath = path.join(__dirname, '../temp', fileName);
                if (fs.existsSync(filePath)) {
                    const fstats = fs.statSync(filePath);
                    data.file_size = fstats.size;
                    data.file_size_formatted = formatFileSize(fstats.size);
                } else {
                    data.status = 'expired';
                    data.file_size_formatted = 'Expirado';
                }
            } catch {
                data.file_size_formatted = 'Error';
            }
        } else {
            data.file_size_formatted = '-';
        }

        return data;
    }));

    res.json({
        downloads,
        stats: {
            total_downloads: parseInt(stats.total_downloads || 0),
            completed: parseInt(stats.completed || 0),
            processing: parseInt(stats.processing || 0),
            failed: parseInt(stats.failed || 0),
            completed_today: parseInt(stats.completed_today || 0),
        },
        pagination: {
            current_page: page,
            per_page: limit,
            total,
            total_pages: Math.ceil(total / limit),
            has_next: page * limit < total,
            has_prev: page > 1
        }
    });
}));

// GET /api/downloads/:id/status - Validar estado de descarga
router.get('/:id/status', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
    }
    try {
        // Verificar que la descarga pertenece al usuario y está completada
        const downloadResult = await query(
            'SELECT status FROM downloads WHERE id = $1 AND user_id = $2 AND status = $3',
            [id, req.user.id, 'completed']
        );

        const download = downloadResult.rows[0];
        if (!download) {
            return res.status(404).json({ message: 'Descarga no encontrada o no autorizada' });
        }
        res.json(download);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error al consultar la base de datos' });
    }
}));

// GET /api/downloads - Obtener descargas del usuario autenticado con paginación
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Obtener total de registros para paginación
    const totalResult = await query('SELECT COUNT(*) as total FROM downloads WHERE user_id = $1', [req.user.id]);
    const total = parseInt(totalResult.rows[0].total);

    // Obtener registros paginados
    const result = await query(
        'SELECT * FROM downloads WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [req.user.id, limit, offset]
    );

    // Procesar cada descarga para agregar información del archivo si está completada
    const downloadsWithFileInfo = await Promise.all(result.rows.map(async (download) => {
        const downloadData = { ...download };

        // Parsear filters JSON string a objeto
        try {
            downloadData.filters = typeof download.filters === 'string'
                ? JSON.parse(download.filters)
                : (download.filters || {});
        } catch { downloadData.filters = {}; }

        // Si está completada y tiene download_url, verificar el archivo
        if (download.status === 'completed' && download.download_url) {
            try {
                const fileName = download.download_url.replace('/temp/', '');
                const filePath = path.join(__dirname, '../temp', fileName);

                // Verificar si el archivo existe y obtener su tamaño
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    downloadData.file_size = stats.size;
                    downloadData.file_size_formatted = formatFileSize(stats.size);
                } else {
                    // Archivo no existe, marcar como expirado
                    downloadData.status = 'expired';
                    downloadData.file_size = null;
                    downloadData.file_size_formatted = 'Archivo expirado';
                }
            } catch (error) {
                console.error(`Error verificando archivo para descarga ${download.id}:`, error);
                downloadData.file_size = null;
                downloadData.file_size_formatted = 'Error al verificar';
            }
        } else {
            downloadData.file_size = null;
            downloadData.file_size_formatted = '-';
        }

        return downloadData;
    }));

    res.json({
        downloads: downloadsWithFileInfo,
        pagination: {
            current_page: page,
            per_page: limit,
            total: total,
            total_pages: Math.ceil(total / limit),
            has_next: page * limit < total,
            has_prev: page > 1
        }
    });
}));

// POST /api/downloads - Crear nueva descarga
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    console.log('Body recibido en POST /api/downloads:', req.body);

    const {
        deviceType,
        devices,
        dateRange,
        department,
        sector,
        dataType,
        days
    } = req.body;
    // Validar datos requeridos
    if (!deviceType || !devices || !dateRange) {
        return res.status(400).json({
            error: 'Datos requeridos faltantes',
            message: 'Se requieren dispositivos y rango de fechas'
        });
    }

    const filters = {
        deviceType,
        devices,
        dateRange,
        department: department || null,
        sector: sector || null,
        dataType: dataType || 'all',
        days: days || null
    };

    // Generar ID único para la descarga
    const downloadId = require('crypto').randomBytes(16).toString('hex');

    // Insertar nueva descarga (sin RETURNING para compatibilidad SQLite)
    await query(
        `INSERT INTO downloads (id, user_id, resource_type, filters, status, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [downloadId, req.user.id, 'traffic_data', JSON.stringify(filters), 'pending', req.ip, req.get('User-Agent')]
    );

    // Obtener la descarga recién creada
    const result = await query('SELECT id, created_at FROM downloads WHERE id = $1', [downloadId]);
    const download = result.rows[0];

    if (!download) {
        return res.status(500).json({ error: 'Error al crear la descarga' });
    }

    // Agregar tarea a la cola para procesamiento asíncrono
    processingQueue.push({
        downloadId: download.id,
        filters: filters
    });

    // Iniciar procesamiento si no está corriendo
    processQueue();

    res.status(201).json({
        success: true,
        downloadId: download.id,
        created_at: download.created_at,
        message: 'Descarga creada exitosamente. El archivo CSV se está generando en segundo plano.'
    });
}));

// GET /api/downloads/:id/download - Descargar CSV si está listo
router.get('/:id/download', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Verificar que la descarga pertenece al usuario y está completada
    const downloadResult = await query(
        'SELECT * FROM downloads WHERE id = $1 AND user_id = $2 AND status = $3',
        [id, req.user.id, 'completed']
    );

    if (downloadResult.rows.length === 0) {
        return res.status(404).json({
            error: 'Archivo no disponible',
            message: 'El archivo no está listo para descarga o no pertenece a este usuario'
        });
    }

    const download = downloadResult.rows[0];

    // Verificar si el archivo aún existe y no ha expirado
    if (download.expires_at && new Date() > new Date(download.expires_at)) {
        return res.status(410).json({
            error: 'Archivo expirado',
            message: 'El archivo ha expirado y ya no está disponible'
        });
    }

    const fileName = download.download_url.replace('/temp/', '');
    const filePath = path.join(__dirname, '../temp', fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            error: 'Archivo no encontrado',
            message: 'El archivo físico no existe en el servidor'
        });
    }

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Enviar archivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
}));

module.exports = router;
