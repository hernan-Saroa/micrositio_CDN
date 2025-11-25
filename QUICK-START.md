# 🚀 VIITS - GUÍA RÁPIDA DE DESPLIEGUE

## ⚡ Comandos Rápidos para Inicio

### 1. Instalación Rápida (Ubuntu/Debian)

```bash
# Script de instalación automática
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs postgresql postgresql-contrib redis-server
sudo npm install -g pm2
```

### 2. Configurar Base de Datos

```bash
sudo -u postgres psql << EOF
CREATE USER viits_user WITH PASSWORD 'cambiar_password';
CREATE DATABASE viits_db OWNER viits_user;
\c viits_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
\q
EOF

# Ejecutar schema
cd backend
psql -U viits_user -d viits_db -f database/schema.sql
```

### 3. Configurar Backend

```bash
cd backend
npm install
cp .env.example .env
nano .env  # Editar variables
```

### 4. Iniciar Sistema

```bash
# Desarrollo
npm run dev

# Producción con PM2
pm2 start server.js --name viits-backend
pm2 save
pm2 startup
```

### 5. Verificar Instalación

```bash
curl http://localhost:3000/api/health
# Debe responder: {"status":"OK",...}
```

---

## 📝 Checklist de Configuración

```
☐ Node.js 18+ instalado
☐ PostgreSQL 13+ instalado con PostGIS
☐ Redis instalado y corriendo
☐ Base de datos creada y schema ejecutado
☐ Archivo .env configurado
☐ Dependencias npm instaladas
☐ Backend iniciado exitosamente
☐ Password del admin cambiado
☐ DEMO_MODE cambiado a false en frontend
☐ Nginx configurado (opcional)
☐ SSL configurado (opcional)
☐ Firewall configurado
☐ Backups configurados
```

---

## 🔑 Credenciales por Defecto

**⚠️ CAMBIAR INMEDIATAMENTE EN PRODUCCIÓN**

- **Email:** admin@invias.gov.co
- **Password:** admin123

---

## 🆘 Comandos de Troubleshooting

```bash
# Ver logs de PM2
pm2 logs viits-backend

# Reiniciar backend
pm2 restart viits-backend

# Ver estado de servicios
sudo systemctl status postgresql
sudo systemctl status redis-server
pm2 status

# Verificar conexión a BD
psql -U viits_user -d viits_db -c "SELECT 1;"

# Verificar puerto en uso
sudo netstat -tlnp | grep 3000
```

---

## 📞 Soporte

Ver **README-PRODUCCION.md** para documentación completa.

**Equipo VIITS - INVIAS Colombia**
