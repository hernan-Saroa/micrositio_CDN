const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 🔹 Configuración de SQL Server
const sqlConfig = {
  server: process.env.SQL_SERVER_HOST || 'localhost',
  port: parseInt(process.env.SQL_SERVER_PORT) || 1433,
  database: process.env.SQL_SERVER_DATABASE || 'VIITS_DB',
  user: process.env.SQL_SERVER_USER,
  password: process.env.SQL_SERVER_PASSWORD,
  options: {
    encrypt: process.env.SQL_SERVER_ENCRYPT === 'true' || true, // Habilitado por defecto
    trustServerCertificate: process.env.SQL_SERVER_TRUST_CERT === 'true' || true, // Confiar en certificados autofirmados
    enableArithAbort: true,
    connectionTimeout: 60000, // Aumentado a 60 segundos
    requestTimeout: 120000, // Aumentado a 120 segundos para consultas grandes
    cancelTimeout: 5000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

console.log('Configuración SQL Server:', {
  server: sqlConfig.server,
  port: sqlConfig.port,
  database: sqlConfig.database,
  hasUser: !!sqlConfig.user,
  hasPassword: !!sqlConfig.password,
  encrypt: sqlConfig.options.encrypt,
  trustCert: sqlConfig.options.trustServerCertificate,
});

// 🔹 Pool de conexiones global
let poolPromise;

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(sqlConfig).connect();
  }
  return poolPromise;
}

// 🔹 Función helper para ejecutar queries
async function executeQuery(query, params = []) {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Agregar parámetros si existen
    params.forEach((param, index) => {
      request.input(`param${index}`, param.value);
    });

    console.log('Ejecutando query SQL Server:', query, params);
    const result = await request.query(query);
    console.log('Query ejecutado exitosamente, filas afectadas:', result.rowsAffected);

    return result;
  } catch (error) {
    console.error('Error ejecutando query SQL Server:', error);
    throw error;
  }
}

// 🔹 Endpoint para consultar ConteosFijosMoviles
// GET /api/sqlserver/conteos-fijos-moviles
// Parámetros query: startDate, endDate (formato YYYY-MM-DD)
router.get('/conteos-fijos-moviles', asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 🔹 Validar parámetros de fecha
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Parámetros requeridos faltantes",
        message: "Se requieren startDate y endDate en formato YYYY-MM-DD"
      });
    }

    // 🔹 Validar formato de fechas
    const start = new Date(startDate);
    const end = new Date(endDate);

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

    // 🔹 Query SQL para obtener datos agrupados
    const query = `
      SELECT
        fcCtlgStateDesc,
        fcCtlgStretchDesc,
        COUNT(*) as total_registros,
        AVG(CAST(fnAttrSpeed AS FLOAT)) as promedio_velocidad,
        SUM(CASE WHEN CAST(fnAttrSpeed AS FLOAT) > 80 THEN 1 ELSE 0 END) as registros_mayor_80
      FROM ConteosFijosMoviles
      WHERE fdFecha BETWEEN @param0 AND @param1
      GROUP BY fcCtlgStateDesc, fcCtlgStretchDesc
      ORDER BY fcCtlgStateDesc, fcCtlgStretchDesc
    `;

    const params = [
      { value: startDate + ' 00:00:00.000' },
      { value: endDate + ' 23:59:59.999' }
    ];

    const result = await executeQuery(query, params);

    // 🔹 Procesar resultados
    const data = result.recordset.map(row => ({
      estado: row.fcCtlgStateDesc,
      tramo: row.fcCtlgStretchDesc,
      total_registros: row.total_registros,
      promedio_velocidad: parseFloat(row.promedio_velocidad.toFixed(2)),
      registros_mayor_80: row.registros_mayor_80
    }));

    console.log(`Consulta completada: ${data.length} registros agrupados`);

    res.json({
      success: true,
      rango_fechas: {
        inicio: startDate,
        fin: endDate
      },
      total_grupos: data.length,
      data: data
    });

  } catch (err) {
    console.error('Error en consulta ConteosFijosMoviles:', err);
    res.status(500).json({
      error: "Error al consultar SQL Server",
      details: err.message
    });
  }
}));

// 🔹 Endpoint para verificar conexión a SQL Server
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT GETDATE() as current_time');

    res.json({
      status: 'connected',
      server: sqlConfig.server,
      database: sqlConfig.database,
      current_time: result.recordset[0].current_time
    });
  } catch (error) {
    console.error('Error verificando conexión SQL Server:', error);
    res.status(500).json({
      status: 'disconnected',
      error: error.message
    });
  }
}));

module.exports = router;