const Database = require('better-sqlite3');
const db = new Database('./data/viits_dev.db');
try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in DB:', tables.map(t => t.name).join(', '));

    if (tables.find(t => t.name === 'dai_alerts')) {
        console.log('✅ dai_alerts table exists');
        const cols = db.prepare("PRAGMA table_info(dai_alerts)").all();
        console.log('Columns in dai_alerts:', cols.map(c => c.name).join(', '));
    } else {
        console.log('❌ dai_alerts table MISSING');
    }

    const configs = db.prepare("SELECT config_key FROM system_config WHERE config_key LIKE 'footer_%' OR config_key LIKE 'social_%'").all();
    console.log('Relevant Configs present:', configs.length, 'keys');
    if (configs.length > 0) {
        console.log('Keys:', configs.map(c => c.config_key).join(', '));
    } else {
        console.log('❌ Public configuration keys MISSING in system_config');
    }
} catch (err) {
    console.error('Error diagnosticando DB:', err);
} finally {
    db.close();
}
