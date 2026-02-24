/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  VIITS - Adaptador de Base de Datos para DESARROLLO           ║
 * ║  Usa SQLite como reemplazo de PostgreSQL (sin instalación)    ║
 * ║  NO usar en producción - solo para pruebas locales            ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ruta del archivo SQLite (se crea automáticamente)
const DB_PATH = path.join(__dirname, '..', 'data', 'viits_dev.db');

// Asegurar que el directorio data/ existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Crear/abrir la base de datos SQLite
const db = new Database(DB_PATH);

// Habilitar WAL para mejor rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`✅ [DEV] Base de datos SQLite conectada: ${DB_PATH}`);

/**
 * Adaptador que imita la interfaz de 'pg' para que el resto del código
 * no necesite cambios. Convierte queries de PostgreSQL a SQLite.
 */

// Convierte placeholders de PostgreSQL ($1, $2...) a SQLite (?, ?, ...)
// Returns { query, paramOrder } where paramOrder maps positional ? to original $N index
function convertQuery(text) {
    // Extract the order of $N placeholders as they appear in the query
    const paramOrder = [];
    const paramRegex = /\$(\d+)/g;
    let match;
    while ((match = paramRegex.exec(text)) !== null) {
        paramOrder.push(parseInt(match[1], 10) - 1); // $1 -> index 0, $2 -> index 1, etc.
    }

    let q = text
        .replace(/\$\d+/g, '?')                          // $1, $2... -> ?
        .replace(/::uuid/gi, '')                          // quitar casts de pg
        .replace(/::text/gi, '')
        .replace(/::integer/gi, '')
        .replace(/::boolean/gi, '')
        .replace(/::jsonb/gi, '')
        .replace(/::inet/gi, '')
        .replace(/::numeric\([^)]*\)/gi, '')
        .replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')")   // NOW() -> datetime('now')
        .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
        .replace(/\bCURRENT_DATE\b/gi, "date('now')")
        .replace(/uuid_generate_v4\s*\(\s*\)/gi, "(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))");

    // ON CONFLICT DO NOTHING -> OR IGNORE (solo cuando no hay columna especificada)
    q = q.replace(/\bON CONFLICT\s+DO\s+NOTHING\b/gi, 'OR IGNORE INTO -- placeholder');

    return { query: q, paramOrder };
}

// Función auxiliar para manejar RETURNING en SQLite (no soportado antes de 3.35)
function handleReturning(text, stmt, params) {
    const returningMatch = text.match(/RETURNING\s+(.+)$/i);
    if (!returningMatch) return null;

    // Ejecutar el INSERT/UPDATE y luego hacer SELECT del último row insertado
    const result = stmt.run(...(params || []));
    if (result.lastInsertRowid) {
        // Intentar obtener el row recién insertado/actualizado
        const tableName = text.match(/(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE)\s+(\w+)/i)?.[1];
        if (tableName) {
            try {
                const row = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(result.lastInsertRowid);
                return { rows: row ? [row] : [], rowCount: result.changes };
            } catch (e) {
                return { rows: [], rowCount: result.changes };
            }
        }
    }
    return { rows: [], rowCount: result.changes };
}

// Convierte parámetros a tipos compatibles con SQLite
// (SQLite solo acepta: number, string, null, Buffer)
function sanitizeParams(params) {
    if (!params) return [];
    return params.map(p => {
        if (p === undefined || p === null) return null;
        if (p instanceof Date) return p.toISOString();   // Date -> ISO string
        if (typeof p === 'boolean') return p ? 1 : 0;    // bool -> 0/1
        if (typeof p === 'object') return JSON.stringify(p); // object -> JSON string
        return p;
    });
}

// Función principal query (imita pg.query)
async function query(text, params = []) {
    try {
        const { query: convertedQuery, paramOrder } = convertQuery(text);
        let safeParams = sanitizeParams(params);

        // Reorder params to match SQLite positional ? order
        // PostgreSQL $1 can appear anywhere, but SQLite ? is strictly positional
        if (paramOrder.length > 0 && safeParams.length > 0) {
            const reordered = paramOrder.map(idx => safeParams[idx] !== undefined ? safeParams[idx] : null);
            // Keep the original first param reference for RETURNING lookups
            reordered._originalFirst = safeParams[0];
            safeParams = reordered;
        }

        // ── Detectar si tiene RETURNING ──────────────────────────────────────
        const hasReturning = /\bRETURNING\b/i.test(convertedQuery);

        // Quitar la cláusula RETURNING (SQLite moderno sí la soporta, 
        // pero para máxima compatibilidad la manejamos manualmente)
        const queryWithoutReturning = convertedQuery.replace(/\s+RETURNING\s+[\s\S]+$/i, '').trim();

        // ── Detectar tipo de operación ────────────────────────────────────────
        const trimmedUpper = queryWithoutReturning.trim().toUpperCase();

        if (trimmedUpper.startsWith('SELECT') || trimmedUpper.startsWith('WITH')) {
            const stmt = db.prepare(queryWithoutReturning);
            const rows = stmt.all(...safeParams);
            return { rows, rowCount: rows.length };
        }

        // INSERT / UPDATE / DELETE
        const stmt = db.prepare(queryWithoutReturning);
        const result = stmt.run(...safeParams);

        if (hasReturning) {
            const tableMatch = queryWithoutReturning.match(
                /(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE)\s+(\w+)/i
            );
            if (tableMatch) {
                const tableName = tableMatch[1];
                try {
                    let row = null;
                    // For INSERT: use lastInsertRowid
                    if (result.lastInsertRowid) {
                        row = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`)
                            .get(result.lastInsertRowid);
                    }
                    // For UPDATE: use original first param (the ID from WHERE id = $1)
                    if (!row && trimmedUpper.startsWith('UPDATE')) {
                        const lookupId = safeParams._originalFirst || safeParams[0];
                        if (lookupId) {
                            row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
                                .get(lookupId);
                        }
                    }
                    return { rows: row ? [row] : [], rowCount: result.changes };
                } catch (e) {
                    return { rows: [], rowCount: result.changes };
                }
            }
        }

        return { rows: [], rowCount: result.changes };

    } catch (error) {
        console.error(`❌ [DEV DB] Error en query:`, error.message);
        console.error(`   Query original: ${text.substring(0, 200)}`);
        if (params?.length) console.error(`   Params: ${JSON.stringify(params)}`);
        throw error;
    }
}

// Pool mock (imita pg.Pool)
const pool = {
    query: (text, params) => query(text, params),
    connect: async () => getClient(),
    on: () => { },
    end: async () => { db.close(); }
};

// Cliente mock para transacciones
async function getClient() {
    return {
        query: (text, params) => query(text, params),
        release: () => { },
        query: (text, params) => query(text, params)
    };
}

// Verificar conexión
async function checkConnection() {
    try {
        const result = db.prepare("SELECT datetime('now') as now").get();
        console.log('✅ [DEV] Conexión SQLite verificada:', result.now);
        return true;
    } catch (error) {
        console.error('❌ [DEV] Error al verificar conexión SQLite:', error);
        return false;
    }
}

// Cerrar base de datos
async function closePool() {
    db.close();
    console.log('✅ [DEV] Base de datos SQLite cerrada');
}

// Exportar instancia raw de SQLite para el seed script
module.exports = {
    pool,
    query,
    getClient,
    checkConnection,
    closePool,
    _db: db  // acceso directo para scripts de inicialización
};
