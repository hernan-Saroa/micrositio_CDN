/**
 * Migración: Agregar columna image_opacity a slider_images
 * Ejecutar: node scripts/migrate-slider-opacity.js
 */
const path = require('path');
const { _db: db } = require('../config/database-dev');

// Agregar columna image_opacity si no existe
try {
    db.exec(`ALTER TABLE slider_images ADD COLUMN image_opacity REAL DEFAULT 0.35`);
    console.log('✅ Columna image_opacity agregada a slider_images (default 0.35)');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  Columna image_opacity ya existe, continuando...');
    } else {
        console.error('Error:', e.message);
    }
}

// Actualizar todos los slides existentes con valor por defecto si es NULL
const updated = db.prepare(`UPDATE slider_images SET image_opacity = 0.35 WHERE image_opacity IS NULL`).run();
console.log(`✅ ${updated.changes} slides actualizados con opacidad default 0.35`);

const sample = db.prepare('SELECT id, title, image_opacity FROM slider_images LIMIT 5').all();
console.log('\nEstado actual:');
sample.forEach(r => console.log(`  [${r.id}] ${r.title?.substring(0, 35).padEnd(35)} → opacidad: ${r.image_opacity}`));

db.close();
