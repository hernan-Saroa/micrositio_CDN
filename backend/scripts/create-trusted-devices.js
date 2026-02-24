const { _db } = require('../config/database-dev');

_db.exec(`
CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT,
    label TEXT DEFAULT 'Dispositivo',
    created_at TEXT DEFAULT (datetime('now')),
    last_used TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

console.log('✅ trusted_devices table created');
process.exit(0);
