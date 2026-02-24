const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'viits_dev.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.sql');

const db = new Database(DB_PATH);

function convertQuery(text) {
    return text
        .replace(/UUID PRIMARY KEY/gi, 'TEXT PRIMARY KEY')
        .replace(/UUID REFERENCES/gi, 'TEXT REFERENCES')
        .replace(/UUID/gi, 'TEXT')
        .replace(/JSONB/gi, 'TEXT')
        .replace(/INET/gi, 'TEXT')
        .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/::uuid/gi, '')
        .replace(/::text/gi, '')
        .replace(/::integer/gi, '')
        .replace(/::boolean/gi, '')
        .replace(/::jsonb/gi, '')
        .replace(/::inet/gi, '')
        .replace(/::numeric\([^)]*\)/gi, 'NUMERIC')
        .replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')")
        .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
        .replace(/\bCURRENT_DATE\b/gi, "date('now')")
        .replace(/uuid_generate_v4\s*\(\s*\)/gi, "(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))")
        .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '-- extension ignore')
        .replace(/CREATE EXTENSION IF NOT EXISTS "postgis";/gi, '-- extension ignore')
        .replace(/COMMENT ON [\s\S]+? IS '[\s\S]+?';/gi, '-- comment ignore')
        .replace(/ON CONFLICT \(email\) DO NOTHING/gi, 'OR IGNORE')
        .replace(/ON CONFLICT \(config_key\) DO NOTHING/gi, 'OR IGNORE')
        .replace(/ON CONFLICT DO NOTHING/gi, 'OR IGNORE')
        .replace(/\(random\(\) \* 30\)::integer/gi, 'ABS(RANDOM() % 30)')
        .replace(/\(3000 \+ random\(\) \* 5000\)::integer/gi, '(3000 + ABS(RANDOM() % 5000))')
        .replace(/\(800 \+ random\(\) \* 1000\)::integer/gi, '(800 + ABS(RANDOM() % 1000))')
        .replace(/60 \+ \(random\(\) \* 40\)::numeric\(10,2\)/gi, '(60 + (ABS(RANDOM() % 40)))')
        .replace(/CREATE OR REPLACE FUNCTION[\s\S]+?END;[\s\S]+?\$\$ language 'plpgsql';/gi, '-- function ignore')
        .replace(/CREATE TRIGGER[\s\S]+?EXECUTE FUNCTION[\s\S]+?;/gi, '-- trigger ignore');
}

try {
    const rawSchema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const convertedSchema = convertQuery(rawSchema);

    // Split by semicolon to run statements one-by-one to avoid errors blocking everything
    const statements = convertedSchema.split(';');

    db.exec('BEGIN TRANSACTION');
    for (let stmt of statements) {
        stmt = stmt.trim();
        if (stmt && !stmt.startsWith('--')) {
            try {
                db.exec(stmt);
            } catch (err) {
                if (!err.message.includes('already exists')) {
                    console.warn(`Warning executing statement: ${err.message}`);
                    // console.warn(`Statement: ${stmt.substring(0, 100)}...`);
                }
            }
        }
    }
    db.exec('COMMIT');
    console.log('✅ Database initialized with converted schema');
} catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ Error initializing database:', err);
    process.exit(1);
} finally {
    db.close();
}
