/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║  VIITS - Seed inicial de slides del slider            ║
 * ║  Replica los 5 slides estáticos aprobados en la BD   ║
 * ║  Ejecutar: node scripts/seed-slider.js                ║
 * ╚═══════════════════════════════════════════════════════╝
 *
 * IMPORTANTE: Este script NO cambia el diseño del slider.
 * Solo mueve el contenido de texto de los slides estáticos
 * a la base de datos para que sean editables desde el admin.
 */

const path = require('path');
const fs = require('fs');

// Asegurar carpeta data/
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const { _db: db } = require('../config/database-dev');

const ADMIN_ID = 'admin-0001-0001-0001-000100010001';

// Crear tabla si no existe (por si se ejecuta antes que seed-dev.js)
db.exec(`
    CREATE TABLE IF NOT EXISTS slider_images (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        description TEXT,
        image_path TEXT NOT NULL DEFAULT 'placeholder.jpg',
        alt_text TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        link_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        created_by TEXT NOT NULL DEFAULT 'admin',
        updated_by TEXT
    );
`);

// 5 slides estáticos aprobados (mismo contenido que showStaticSlider en index.js)
const slides = [
    {
        id: 'slide-001',
        title: 'Consulta el estado del tráfico en los puntos de monitoreo del proyecto',
        alt_text: 'Vías inteligentes en las carreteras nacionales.',
        description: 'Accede a dashboards, reportes y microdatos para tomar decisiones informadas.',
        image_path: 'placeholder.jpg',
        position: 1,
        is_active: 1
    },
    {
        id: 'slide-002',
        title: 'Monitoreo en tiempo real',
        alt_text: 'de infraestructura vial',
        description: 'Más de 237 puntos implementados a lo largo de los corredores viales conectados en toda Colombia, procesando datos continuamente para garantizar la seguridad vial.',
        image_path: 'placeholder.jpg',
        position: 2,
        is_active: 1
    },
    {
        id: 'slide-003',
        title: 'Tecnología de punta',
        alt_text: 'en análisis de datos',
        description: 'Inteligencia artificial y machine learning aplicados al análisis predictivo de tráfico y mantenimiento preventivo de vías.',
        image_path: 'placeholder.jpg',
        position: 3,
        is_active: 1
    },
    {
        id: 'slide-004',
        title: 'Impacto a Nivel',
        alt_text: 'nacional',
        description: 'Cobertura en 24 departamentos de Colombia, mejorando la seguridad vial y la calidad de la infraestructura.',
        image_path: 'placeholder.jpg',
        position: 4,
        is_active: 1
    },
    {
        id: 'slide-005',
        title: 'Participa y Accede',
        alt_text: 'a la Información Pública',
        description: 'Transparencia y acceso a datos abiertos sobre el estado de la infraestructura vial en Colombia. Tu derecho a saber.',
        image_path: 'placeholder.jpg',
        position: 5,
        is_active: 1
    }
];

const insert = db.prepare(`
    INSERT OR IGNORE INTO slider_images
        (id, title, description, image_path, alt_text, position, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
slides.forEach(s => {
    const result = insert.run(s.id, s.title, s.description, s.image_path, s.alt_text, s.position, s.is_active, ADMIN_ID);
    if (result.changes > 0) inserted++;
});

const count = db.prepare('SELECT COUNT(*) as n FROM slider_images').get();

console.log(`
╔═══════════════════════════════════════════════════════╗
║   ✅  SLIDER SEED COMPLETADO                          ║
╠═══════════════════════════════════════════════════════╣
║  Slides insertados:  ${String(inserted).padEnd(34)}║
║  Total en BD:        ${String(count.n).padEnd(34)}║
╠═══════════════════════════════════════════════════════╣
║  Los slides son editables desde el admin en:         ║
║  http://localhost:3000/admin-panel.html              ║
║  Sección: Slider de Imágenes                         ║
╚═══════════════════════════════════════════════════════╝
`);

db.close();
