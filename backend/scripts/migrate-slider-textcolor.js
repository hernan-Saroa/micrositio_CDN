/**
 * Migración: Agregar columna text_color a slider_images
 * Ejecutar: node scripts/migrate-slider-textcolor.js
 */
const { _db: db } = require('../config/database-dev');

try {
    db.exec(`ALTER TABLE slider_images ADD COLUMN text_color TEXT DEFAULT '#ffffff'`);
    console.log('✅ Columna text_color agregada a slider_images (default #ffffff)');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️  Columna text_color ya existe, continuando...');
    } else {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

// Los slides 1 (fondo claro) deben tener texto oscuro; el resto blanco
db.prepare(`UPDATE slider_images SET text_color = '#0f172a' WHERE id = 'slide-001' AND (text_color IS NULL OR text_color = '#ffffff')`).run();
db.prepare(`UPDATE slider_images SET text_color = '#ffffff' WHERE id != 'slide-001' AND (text_color IS NULL OR text_color = '#ffffff')`).run();

const slides = db.prepare('SELECT id, title, text_color FROM slider_images').all();
console.log('\nEstado actual:');
slides.forEach(r => console.log(`  [${r.id}] ${(r.title || '').substring(0, 30).padEnd(30)} → text: ${r.text_color}`));
db.close();
