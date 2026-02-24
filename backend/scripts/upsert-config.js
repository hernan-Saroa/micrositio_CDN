const Database = require('better-sqlite3');
const db = new Database('./data/viits_dev.db');

const configs = [
    ['footer_address', '"Carrera 59 No. 26 - 60 CAN, Bogotá D.C., Colombia"', 'Dirección sede principal', 1],
    ['footer_phone', '"(601) 705 6000"', 'Teléfono conmutador', 1],
    ['footer_email', '"servicioalciudadano@invias.gov.co"', 'Email de servicio al ciudadano', 1],
    ['footer_schedule', '"Lunes a Viernes de 8:00 a.m. a 4:00 p.m."', 'Horario de atención', 1],
    ['social_twitter', '"https://twitter.com/InviasCol"', 'Enlace Twitter', 1],
    ['social_facebook', '"https://www.facebook.com/InviasCol"', 'Enlace Facebook', 1],
    ['social_youtube', '"https://www.youtube.com/InviasCol"', 'Enlace YouTube', 1],
    ['social_instagram', '"https://www.instagram.com/inviascol/"', 'Enlace Instagram', 1],
    ['site_name', '"VIITS - INVIAS"', 'Nombre del sitio', 1]
];

const upsertStmt = db.prepare(`
    INSERT INTO system_config (config_key, config_value, description, is_public) 
    VALUES (?, ?, ?, ?)
    ON CONFLICT(config_key) DO UPDATE SET 
        config_value = excluded.config_value,
        is_public = excluded.is_public
`);

db.transaction(() => {
    for (const config of configs) {
        upsertStmt.run(...config);
    }
})();

console.log('✅ Configuration Upserted Successfully');
db.close();
