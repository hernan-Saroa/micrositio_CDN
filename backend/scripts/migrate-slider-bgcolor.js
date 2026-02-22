/**
 * Migración: Agregar columna bg_color a slider_images
 * Ejecutar: node scripts/migrate-slider-bgcolor.js
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const { _db: db } = require('../config/database-dev');

// Colores originales de cada slide (de index.css .slide-1 a .slide-5)
const ORIGINAL_GRADIENTS = {
    'slide-001': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)',  // Azul claro
    'slide-002': 'linear-gradient(135deg, #004a8f 0%, #003366 100%)',                // Azul gobierno
    'slide-003': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',                // Naranja INVIAS
    'slide-004': 'linear-gradient(135deg, #069169 0%, #047857 100%)',                // Verde
    'slide-005': 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',                // Índigo
};

// Agregar columna si no existe
try {
    db.exec(`ALTER TABLE slider_images ADD COLUMN bg_color TEXT DEFAULT 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)'`);
    console.log('✅ Columna bg_color agregada a slider_images');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  Columna bg_color ya existe, actualizando valores...');
    } else {
        console.error('Error:', e.message);
    }
}

// Actualizar los slides originales con sus gradientes correctos
const update = db.prepare('UPDATE slider_images SET bg_color = ? WHERE id = ?');
let updated = 0;
for (const [id, gradient] of Object.entries(ORIGINAL_GRADIENTS)) {
    const result = update.run(gradient, id);
    if (result.changes > 0) updated++;
}

const sample = db.prepare('SELECT id, title, bg_color FROM slider_images LIMIT 5').all();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║   ✅  MIGRACIÓN COMPLETADA                                   ║
╠══════════════════════════════════════════════════════════════╣
║  Slides actualizados con color de fondo: ${String(updated).padEnd(19)}║
╠══════════════════════════════════════════════════════════════╣
`);
sample.forEach(r => {
    const short = r.bg_color ? r.bg_color.substring(0, 45) + '...' : 'NULL';
    console.log(`  [${r.id}] ${r.title.substring(0, 30).padEnd(30)} → ${short}`);
});
console.log(`╚══════════════════════════════════════════════════════════════╝`);

db.close();
