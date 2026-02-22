/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  VIITS - Configuración de Base de Datos                       ║
 * ║  • development  →  SQLite local (sin instalación)             ║
 * ║  • production   →  PostgreSQL real                            ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

const dotenv = require('dotenv');
dotenv.config();

// En modo desarrollo, usar SQLite como reemplazo de PostgreSQL
if (process.env.NODE_ENV !== 'production') {
    console.log('🛠️  [Modo DESARROLLO] Usando base de datos SQLite local');
    module.exports = require('./database-dev');
    return;
}

// En producción, usar PostgreSQL
const { Pool } = require('pg');

// Configuración del pool de conexiones
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'viits_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: 2000,
});

// Evento de conexión exitosa
pool.on('connect', () => {
    console.log('✅ Conectado a la base de datos PostgreSQL');
});

// Evento de error
pool.on('error', (err) => {
    console.error('❌ Error inesperado en el pool de base de datos:', err);
    process.exit(-1);
});

// Función helper para ejecutar queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Query ejecutado:', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Error en query:', error);
        throw error;
    }
};

// Función para transacciones
const getClient = async () => {
    const client = await pool.connect();
    const query = client.query.bind(client);
    const release = client.release.bind(client);

    // Agregar timeout
    const timeout = setTimeout(() => {
        console.error('Cliente de base de datos no liberado después de 5 segundos');
    }, 5000);

    client.release = () => {
        clearTimeout(timeout);
        release();
    };

    return client;
};

// Función para verificar conexión
const checkConnection = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Conexión a base de datos verificada:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Error al verificar conexión a base de datos:', error);
        return false;
    }
};

// Función para cerrar el pool gracefully
const closePool = async () => {
    try {
        await pool.end();
        console.log('✅ Pool de conexiones cerrado correctamente');
    } catch (error) {
        console.error('❌ Error al cerrar pool de conexiones:', error);
        throw error;
    }
};

module.exports = {
    pool,
    query,
    getClient,
    checkConnection,
    closePool
};
