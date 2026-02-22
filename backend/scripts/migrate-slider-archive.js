/**
 * Migración: agrega columna is_archived al slider_images
 */
const { query } = require('../config/database');

async function migrate() {
    try {
        console.log('🔄 Agregando columna is_archived a slider_images...');
        // SQLite no soporta IF NOT EXISTS en ALTER TABLE, así que capturamos el error de duplicado
        await query(`ALTER TABLE slider_images ADD COLUMN is_archived INTEGER DEFAULT 0`);
        await query(`UPDATE slider_images SET is_archived = 0 WHERE is_archived IS NULL`);
        console.log('✅ Migración completada: columna is_archived añadida.');
    } catch (err) {
        if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
            console.log('ℹ️  Columna is_archived ya existe, sin cambios.');
        } else {
            console.error('❌ Error en migración:', err.message);
            process.exit(1);
        }
    }
    process.exit(0);
}

migrate();
