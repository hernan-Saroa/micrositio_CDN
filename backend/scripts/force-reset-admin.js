const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const dbPath = path.join(__dirname, "data/viits_dev.db");
const db = new sqlite3.Database(dbPath);

async function resetAdmin() {
    console.log("Conectando a SQLite...", dbPath);
    const email = "admin@invias.gov.co";
    const newPass = "admin123";
    const saltRounds = 10;
    const hash = await bcrypt.hash(newPass, saltRounds);

    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
            console.error("Error consultando BD:", err);
            db.close();
            return;
        }

        if (row) {
            console.log(`Usuario encontrado (ID: ${row.id}). Actualizando contraseña...`);
            db.run("UPDATE users SET password_hash = ? WHERE email = ?", [hash, email], function(err) {
                if (err) console.error("Error actualizando:", err);
                else console.log(` Contraseña actualizada a '${newPass}' para ${email}`);
                db.close();
            });
        } else {
            console.log("Usuario admin no encontrado. Creando...");
            const id = require("crypto").randomUUID();
            const sql = `INSERT INTO users (id, email, email_mask, password_hash, name, role, created_at, is_active) 
                         VALUES (?, ?, ?, ?, ?, ?, datetime("now"), 1)`;
            db.run(sql, [id, email, "a***@invias.gov.co", hash, "Administrador VIITS", "admin"], function(err) {
                if (err) console.error("Error creando usaurio:", err);
                else console.log(` Usuario creado: ${email} / ${newPass}`);
                db.close();
            });
        }
    });
}

resetAdmin();
