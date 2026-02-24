const Database = require('better-sqlite3');
const db = new Database('./data/viits_dev.db');

const roles = [
    { id: 'admin', name: 'Administrador', desc: 'Acceso total a la plataforma', modules: ['dashboard', 'reports', 'slider', 'alertas-dai', 'users', 'downloads', 'audit', 'config'] },
    { id: 'viewer', name: 'Monitor DAI', desc: 'Visualización y gestión de alertas', modules: ['dashboard', 'alertas-dai', 'downloads'] },
    { id: 'editor', name: 'Editor', desc: 'Gestión de contenido publicable', modules: ['dashboard', 'reports', 'slider'] },
    { id: 'user', name: 'Usuario Estándar', desc: 'Acceso básico de consulta', modules: ['dashboard'] }
];

const sql = `
    INSERT INTO system_config (config_key, config_value, description, is_public)
    VALUES ('roles_definition', ?, 'Definición de roles y permisos modulares', 0)
    ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value;
`;

db.prepare(sql).run(JSON.stringify(roles));

console.log('✅ Standardized roles seeded into system_config');
db.close();
