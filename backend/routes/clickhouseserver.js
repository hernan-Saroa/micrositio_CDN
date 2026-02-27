const express = require('express');
const router = express.Router();
const { createClient } = require('@clickhouse/client');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ExcelJS = require('exceljs');
const path = require('path');

// 🔹 Configuración de ClickHouse
const clickhouseConfig = {
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

console.log('Configuración ClickHouse:', {
  url: clickhouseConfig.url,
  hasUsername: !!clickhouseConfig.username,
  hasPassword: !!clickhouseConfig.password,
});

// 🔹 Cliente ClickHouse global
let client;

async function getClient() {
  console.log('Creando cliente ClickHouse...', clickhouseConfig.url);
  if (!client) {
    client = createClient(clickhouseConfig);
  }
  return client;
}

// 🔹 Función para cargar datos del Excel
async function loadExcelData() {
  try {
    const filePath = path.join(__dirname, '../data/catalogo_invias.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet('Información Vías');

    if (!sheet) {
      throw new Error('Hoja "Información Vías" no encontrada en el archivo Excel');
    }

    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(row.values.slice(1)); // exceljs es 1-indexed; slice(1) da array 0-indexed
    });

    // Crear mapa por dispositivo (columna B, índice 1 → rows[][0]=A, rows[][1]=B)
    const deviceMap = new Map();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1]) { // Columna B: dispositivo
        const type = (row[5] != null ? String(row[5]).trim() : '').toLowerCase();
        if (['wim', 'galibos', 'radares', 'conteos fijos'].includes(type)) {
          const device = String(row[0]).split('-').slice(0, 3).join('-');
          deviceMap.set(device, {
            departamento: row[1] || '',
            municipio: row[2] || '',
            codigo_ruta: row[6] || '',
            ruta: row[7] || '',
            codigo_tramo: row[8] || '',
            tramo: row[9] || '',
            sector: row[10] || '',
            administrador: row[11] || '',
            pr_aprox: row[12] || '',
            street_view: row[15] || '',
          });
        }
      }
    }
    console.log(`Datos del Excel cargados: ${deviceMap.size} dispositivos (WiM, Galibos, Radares, Conteos Fijos)`);
    return deviceMap;
  } catch (error) {
    console.error('Error cargando datos del Excel:', error);
    throw error;
  }
}

// 🔹 Función helper para ejecutar queries
async function executeQuery(query, params = {}) {
  try {
    const chClient = await getClient();

    // Usar query con parámetros directos en lugar de query_params
    let finalQuery = query;
    for (const [key, value] of Object.entries(params)) {
      finalQuery = finalQuery.replace(new RegExp(`{${key}:String}`, 'g'), `'${value}'`);
    }

    console.log('Query final:', finalQuery);

    const resultSet = await chClient.query({
      query: finalQuery,
      format: 'JSONEachRow',
    });

    const result = await resultSet.json();
    console.log('Query ejecutado exitosamente, filas obtenidas:', result.length);

    return result;
  } catch (error) {
    console.error('Error ejecutando query ClickHouse:', error);
    throw error;
  }
}

function addDynamicColumn(table) {
  let ctlgId = 'fcCtlgIdCatalog';
  let speed = 'fnAttrSpeed';
  let fcPldPlate = 'fcPldPlate,';
  if (table === 'RadaresVelocidad') {
    speed = 'fnPldSpeed';
    fcPldPlate = '';
  }
  if (table === 'Basculas') {
    speed = 'fnWghtVelocity'
  }
  if (['RadaresVelocidad', 'Galibos', 'Basculas'].includes(table)) {
    ctlgId = 'fcCtlgId';
  }
  return [ctlgId, speed, fcPldPlate];
}

function queryDynamic(vehicleType, table) {
  let [catId, fnSpeed, fcPldPlate] = addDynamicColumn(table);
  let query = `
    WITH 
      toDate(fdFecha) AS fecha,
      toFloat64(${fnSpeed}) AS speed
    SELECT
      fecha,
      fcCtlgDesc,
      fcCtlgIdCatalog,
      countIf(speed BETWEEN 10 AND 200) AS total_registros,
      round(avgIf(speed, speed BETWEEN 10 AND 200), 2) AS promedio_velocidad,
      countIf(speed BETWEEN 10 AND 200) AS total_entre_10_y_200,
      countIf(speed < 10) AS total_menor_10,
      countIf(speed > 200) AS total_mayor_200,
      countIf(speed > 80) AS registros_mayor_80,
      '${table}' AS type
    FROM (
      SELECT
        fdFecha, fcCtlgDesc, fcIndex, fcId, fcTimeStamp, ${fcPldPlate} ${catId} AS fcCtlgIdCatalog, ${fnSpeed}
      FROM ${table}
      PREWHERE fdFecha >= {startDate:String} AND fdFecha <= {endDate:String}`;

  if (fcPldPlate !== '') {
    query += ` AND fcPldPlate != 'NO_PLATE'`;
  }

  // 🔸 Filtro adicional para ConteosFijosMoviles
  if (table === 'ConteosFijosMoviles') {
    query += ` AND fcCtlgAuxiliar = 'F'`;
  }

  // 🔸 Filtro por tipo de vehículo
  if (['ConteosFijosMoviles', 'Galibos', 'Basculas'].includes(table)) {
    if (vehicleType === 'motorcycles') {
      const motorcycle = 'MOTOCICLETA';
      query += ` AND fcRuntClass = '${motorcycle}'`;
    } else if (vehicleType === 'heavy') {
      const vehicleTypeList = ['CAMION', 'VOLQUETA', 'TRACTOCAMION']
        .map(v => `'${v}'`)
        .join(', ');
      query += ` AND fcRuntClass IN (${vehicleTypeList})`;
    }
  }

  // 🔸 Cierre de la subconsulta y agrupación final
  query += `
      GROUP BY
        fdFecha, fcCtlgDesc, fcCtlgIdCatalog, fcIndex, fcId, fcTimeStamp, ${fcPldPlate} ${fnSpeed}
    )
    GROUP BY
      fecha, fcCtlgDesc, fcCtlgIdCatalog
    ORDER BY
      fecha, fcCtlgIdCatalog, fcCtlgDesc
  `;

  return query;
}

// 🔹 Endpoint para consultar ConteosFijosMoviles, RadaresVelocidad,Basculas y Galibos
// GET /api/clickhouse/road-analysis-dashboard
// Parámetros query: startDate, endDate (formato YYYY-MM-DD)
router.get('/road-analysis-dashboard', asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, vehicleType } = req.query;

    // 🔹 Validar parámetros de fecha
    console.log('Parámetros de fecha:', startDate, endDate, vehicleType);
    if (!startDate || !endDate || !vehicleType) {
      return res.status(400).json({
        error: "Parámetros requeridos faltantes",
        message: "Se requieren startDate y endDate en formato YYYY-MM-DD"
      });
    }

    // 🔹 Validar formato de fechas
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // Incluir el día siguiente para obtener datos completos

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: "Formato de fecha inválido",
        message: "Las fechas deben estar en formato YYYY-MM-DD"
      });
    }

    if (start > end) {
      return res.status(400).json({
        error: "Rango de fechas inválido",
        message: "La fecha de inicio no puede ser posterior a la fecha de fin"
      });
    }
    const newEndDate = end.toISOString().split('T')[0];
    console.log('Consultando ConteosFijosMoviles y RadaresVelocidad en ClickHouse para rango:', { startDate, newEndDate });

    // 🔹 Query SQL para ConteosFijosMoviles
    let conteosQuery = queryDynamic(vehicleType, 'ConteosFijosMoviles');
    // 🔹 Query SQL para RadaresVelocidad
    let radaresQuery = queryDynamic(vehicleType, 'RadaresVelocidad');
    // 🔹 Query SQL para Galibos
    let galibosQuery = queryDynamic(vehicleType, 'Galibos');
    // 🔹 Query SQL para Basculas
    let basculasQuery = queryDynamic(vehicleType, 'Basculas');

    const params = {
      startDate: startDate,
      endDate: newEndDate,
    };
    // 🔹 Ejecutar queries en paralelo
    const [conteosResult, radaresResult, galibosResult, basculasResult] = await Promise.all([
      executeQuery(conteosQuery, params),
      executeQuery(radaresQuery, params),
      executeQuery(galibosQuery, params),
      executeQuery(basculasQuery, params)
    ]);

    console.log(`ConteosFijosMoviles: ${conteosResult.length} registros`);
    console.log(`RadaresVelocidad: ${radaresResult.length} registros`);
    console.log(`Galibos: ${galibosResult.length} registros`);
    console.log(`Basculas: ${basculasResult.length} registros`);

    // 🔹 Combinar resultados de tablas
    const combinedResult = [...conteosResult, ...radaresResult, ...galibosResult, ...basculasResult];

    // 🔹 Cargar datos del Excel
    const excelData = await loadExcelData();

    // 🔹 Procesar resultados y enriquecer con datos del Excel
    const data = await Promise.all(combinedResult.map(async (row) => {
      const fcCtlgDesc = row.fcCtlgDesc;

      // Datos del Excel por dispositivo
      const prefix = fcCtlgDesc.split('-').slice(0, 3).join('-');
      const excelInfo = excelData.get(prefix) || {};
      let sector = excelInfo.sector || '';
      if (sector == '') {
        sector = fcCtlgDesc;
      }
      return {
        id: row.fcCtlgIdCatalog,
        fecha: row.fecha,
        dispositivo: fcCtlgDesc,
        codigo_tramo: excelInfo.codigo_tramo || '',
        tramo: excelInfo.tramo || '',
        estado: excelInfo.departamento || '',
        municipio: excelInfo.municipio || '',
        codigo_ruta: excelInfo.codigo_ruta || '',
        ruta: excelInfo.ruta || '',
        sector: sector,
        administrador: excelInfo.administrador || '',
        pr_aprox: excelInfo.pr_aprox || '',
        street_view: excelInfo.street_view || '',
        total_registros: parseInt(row.total_registros),
        promedio_velocidad: parseFloat(row.promedio_velocidad),
        registros_mayor_80: parseInt(row.registros_mayor_80),
        total_entre_10_y_200: parseInt(row.total_entre_10_y_200),
        total_menor_10: parseInt(row.total_menor_10),
        total_mayor_200: parseInt(row.total_mayor_200),
        type: row.type
      };
    }));

    // Crear un set de los dispositivos que están en el arreglo
    const dispositivosArray = new Set(data.map(item => item.dispositivo));
    // Revisar qué claves del Excel faltan en el arreglo
    const missingDevices = [...excelData.keys()].filter(key => !dispositivosArray.has(key));
    const deviceNotFound = [];
    if (missingDevices.length === 0) {
      console.log("✅ Todos los dispositivos del Excel están en el arreglo");
    } else {
      missingDevices.forEach(f => {
        // Tomar los primeros 3 segmentos
        const prefix = f.split('-').slice(0, 3).join('-');

        // Buscar coincidencia por prefijo
        const match = [...dispositivosArray].find(d => d.startsWith(prefix));

        if (!match) {
          const excelInfo = excelData.get(f)
          deviceNotFound.push({
            device: f,
            departamento: excelInfo.departamento,
            municipio: excelInfo.municipio,
            codigo_ruta: excelInfo.codigo_ruta,
            ruta: excelInfo.ruta,
            tramo: excelInfo.tramo,
            codigo_tramo: excelInfo.codigo_tramo,
            sector: excelInfo.sector,
            administrador: excelInfo.administrador,
            pr_aprox: excelInfo.pr_aprox,
          });
        }
      });
    }

    res.json({
      success: true,
      total_grupos: data.length,
      conteos_registros: conteosResult.length,
      radares_registros: radaresResult.length,
      galibos_registros: galibosResult.length,
      data: data,
      deviceNotFound: deviceNotFound
    });

  } catch (err) {
    console.error('Error en consulta ClickHouse:', err);
    res.status(500).json({
      error: "Error al consultar ClickHouse",
      details: err.message
    });
  }
}));

// 🔹 Endpoint para verificar conexión a ClickHouse
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const chClient = await getClient();

    // Query simple para verificar conexión
    const resultSet = await chClient.query({
      query: 'SELECT version() as version, now() as current_time',
      format: 'JSONEachRow',
    });

    const result = await resultSet.json();

    res.json({
      status: 'connected',
      url: clickhouseConfig.url,
      database: clickhouseConfig.database,
      version: result[0]?.version,
      current_time: result[0]?.current_time
    });
  } catch (error) {
    console.error('Error verificando conexión ClickHouse:', error);
    res.status(500).json({
      status: 'disconnected',
      error: error.message
    });
  }
}));

// 🔹 Endpoint para consultar datos por dispositivo y fecha con agrupación por hora
// GET /api/clickhouse/road-analysis-dashboard-by-device
// Parámetros query: tramo, fecha (formato YYYY-MM-DD)
router.get('/road-analysis-dashboard-by-device', asyncHandler(async (req, res) => {
  try {
    const { type, device, date } = req.query;

    // 🔹 Validar parámetros requeridos
    if (!device || !date) {
      return res.status(400).json({
        error: "Parámetros requeridos faltantes",
        message: "Se requieren 'dispositivo' y 'fecha' en formato YYYY-MM-DD"
      });
    }

    // 🔹 Validar formato de fecha
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        error: "Formato de fecha inválido",
        message: "La fecha debe estar en formato YYYY-MM-DD"
      });
    }

    console.log('Consultando datos por hora en ClickHouse para:', { device, date });
    let [catId, fnSpeed] = addDynamicColumn(type);
    // 🔹 Query SQL para ClickHouse con agrupación por hora
    const query = `
      SELECT
        ${catId} as id,
        fcCtlgDesc as dispositivo,
        formatDateTime(toStartOfHour(fdFecha), '%H:%i') as hora,
        count() as total_registros,
        round(avgIf(toFloat64(${fnSpeed}), toFloat64(${fnSpeed}) BETWEEN 10 AND 200), 2) AS promedio_velocidad,
        countIf(toFloat64(${fnSpeed}) BETWEEN 10 AND 200) AS total_entre_10_y_200,
        countIf(toFloat64(${fnSpeed}) < 10) AS total_menor_10,
        countIf(toFloat64(${fnSpeed}) > 200) AS total_mayor_200,
        countIf(toFloat64(${fnSpeed}) > 80) as registros_mayor_80
      FROM ${type}
      WHERE ${catId} = {device:String} AND toDate(fdFecha) = {date:String}
      GROUP BY ${catId}, fcCtlgDesc, toStartOfHour(fdFecha)
      ORDER BY toStartOfHour(fdFecha)
    `;

    const params = {
      device: device,
      date: date
    };

    const result = await executeQuery(query, params);

    const excelData = await loadExcelData();
    console.log('Resultado de filtrado:', result[0]);
    const dispositivo = result[0].dispositivo.split('-').slice(0, 3).join('-');
    const excelInfo = excelData.get(dispositivo) || {};
    const deviceInfo = {
      id: result[0].id,
      dispositivo: result[0].dispositivo,
      tramo: excelInfo.tramo || '',
      estado: excelInfo.departamento || '',
      municipio: excelInfo.municipio || '',
      codigo_ruta: excelInfo.codigo_ruta || '',
      ruta: excelInfo.ruta || '',
      sector: excelInfo.sector || '',
      administrador: excelInfo.administrador || '',
      pr_aprox: excelInfo.pr_aprox || '',
      street_view: excelInfo.street_view || '',
    }
    // 🔹 Procesar resultados
    const data = result.map(row => ({
      hora: row.hora,
      total_registros: parseInt(row.total_registros),
      promedio_velocidad: parseFloat(row.promedio_velocidad),
      registros_mayor_80: parseInt(row.registros_mayor_80),
      total_entre_10_y_200: parseInt(row.total_entre_10_y_200),
      total_menor_10: parseInt(row.total_menor_10),
      total_mayor_200: parseInt(row.total_mayor_200),
    }));

    console.log(`Consulta completada: ${data.length} registros agrupados por hora`);

    res.json({
      success: true,
      device: deviceInfo,
      fecha: date,
      total_horas: data.length,
      data: data
    });

  } catch (err) {
    console.error('Error en consulta datos por hora ClickHouse:', err);
    res.status(500).json({
      error: "Error al consultar ClickHouse",
      details: err.message
    });
  }
}));

// 🔹 Endpoint para obtener información de tablas
router.get('/tables', asyncHandler(async (req, res) => {
  try {
    const chClient = await getClient();

    const query = `
      SELECT
        database,
        name as table_name,
        engine,
        total_rows,
        total_bytes,
        lifetime_rows,
        lifetime_bytes
      FROM system.tables
      WHERE database = {database:String}
      ORDER BY name
    `;

    const resultSet = await chClient.query({
      query,
      query_params: { database: clickhouseConfig.database },
      format: 'JSONEachRow',
    });

    const tables = await resultSet.json();

    res.json({
      database: clickhouseConfig.database,
      tables: tables
    });
  } catch (error) {
    console.error('Error obteniendo información de tablas:', error);
    res.status(500).json({
      error: 'Error al obtener información de tablas',
      details: error.message
    });
  }
}));

// 🔹 Endpoint para obtener dispositivos agrupados por tipo, departamento y sector
router.get('/departamentos-sectores', asyncHandler(async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/catalogo_invias.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet('Información Vías');

    if (!sheet) {
      throw new Error('Hoja "Información Vías" no encontrada en el archivo Excel');
    }

    // Leer filas como arrays 0-indexed (equivalente a { header: 1 } en xlsx)
    const rawRows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      rawRows.push(row.values.slice(1));
    });
    const data = rawRows;

    // Crear estructura: tipoDispositivo -> departamento -> sector -> dispositivos
    const tiposDispositivos = {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length > 0) {
        const dispositivo = row[0]; // Columna A: dispositivo
        const departamento = row[1]; // Columna B: departamento
        const tipo = row[5].trim().toLowerCase().replace(/\s+/g, '-'); // Columna B: departamento
        const sector = row[10]; // Columna K: sector

        if (departamento && sector && dispositivo) {
          const deptKey = departamento.toLowerCase().replace(/\s+/g, '-'); // Normalizar key

          // Inicializar estructura si no existe
          if (!tiposDispositivos[tipo]) {
            tiposDispositivos[tipo] = {};
          }
          if (!tiposDispositivos[tipo][deptKey]) {
            tiposDispositivos[tipo][deptKey] = {
              nombre: departamento,
              sectores: {}
            };
          }
          if (!tiposDispositivos[tipo][deptKey].sectores[sector]) {
            tiposDispositivos[tipo][deptKey].sectores[sector] = [];
          }

          // Agregar dispositivo si no está ya en el array
          if (!tiposDispositivos[tipo][deptKey].sectores[sector].includes(dispositivo)) {
            tiposDispositivos[tipo][deptKey].sectores[sector].push(dispositivo);
          }
        }
      }
    }

    // Ordenar tipos, departamentos, sectores y dispositivos
    const resultado = {};
    Object.keys(tiposDispositivos).sort().forEach(tipo => {
      resultado[tipo] = {};
      Object.keys(tiposDispositivos[tipo]).sort().forEach(deptKey => {
        const dept = tiposDispositivos[tipo][deptKey];
        const sectoresOrdenados = {};

        Object.keys(dept.sectores).sort().forEach(sector => {
          sectoresOrdenados[sector] = dept.sectores[sector].sort();
        });

        resultado[tipo][deptKey] = {
          nombre: dept.nombre,
          sectores: sectoresOrdenados
        };
      });
    });

    console.log(`Dispositivos agrupados por tipo, departamento y sector: ${Object.keys(resultado).length} tipos de dispositivo`);

    res.json({
      success: true,
      total_tipos_dispositivo: Object.keys(resultado).length,
      data: resultado
    });

  } catch (error) {
    console.error('Error cargando dispositivos por tipo, departamento y sector del Excel:', error);
    res.status(500).json({
      error: 'Error al cargar datos del Excel',
      details: error.message
    });
  }
}));

module.exports = router;