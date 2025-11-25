# 🚀 VIITS - GUÍA COMPLETA DE DESPLIEGUE A PRODUCCIÓN

## Instituto Nacional de Vías (INVIAS) - Colombia
### Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad

---

## ✅ ESTADO DEL SISTEMA

**Fecha:** 13 de Octubre, 2025  
**Versión:** 1.0.0 - Production Ready  
**Backend:** ✅ Completo y Funcional  
**Frontend:** ✅ Integrado con Backend  
**Base de Datos:** ✅ Scripts SQL Listos  
**Documentación:** ✅ Completa

---

## 📋 TABLA DE CONTENIDOS

1. [Requisitos del Sistema](#requisitos)
2. [Estructura del Proyecto](#estructura)
3. [Instalación Paso a Paso](#instalación)
4. [Configuración de Base de Datos](#base-de-datos)
5. [Configuración del Backend](#backend)
6. [Configuración del Frontend](#frontend)
7. [Despliegue en Producción](#despliegue)
8. [Verificación del Sistema](#verificación)
9. [Mantenimiento y Monitoreo](#mantenimiento)
10. [Troubleshooting](#troubleshooting)

---

## 🔧 REQUISITOS DEL SISTEMA {#requisitos}

### Software Necesario

```
✅ Node.js v16+ (Recomendado: v18 LTS)
✅ PostgreSQL 13+ con extensión PostGIS
✅ Redis 6+
✅ npm v8+ o yarn v1.22+
✅ PM2 (para producción)
✅ Nginx (recomendado para proxy inverso)
✅ Sistema Operativo: Linux (Ubuntu 20.04+ recomendado) o macOS
```

### Recursos del Servidor (Recomendado)

```
Desarrollo:
- CPU: 2 cores
- RAM: 4 GB
- Disco: 20 GB SSD

Producción:
- CPU: 4+ cores
- RAM: 8+ GB
- Disco: 100+ GB SSD
- Ancho de banda: 100+ Mbps
```

---

## 📂 ESTRUCTURA DEL PROYECTO {#estructura}

```
viits-project/
├── backend/
│   ├── config/
│   │   └── database.js          # Configuración de PostgreSQL
│   ├── middleware/
│   │   ├── auth.js              # Autenticación JWT
│   │   └── errorHandler.js      # Manejo de errores
│   ├── routes/
│   │   ├── auth.js              # Rutas de autenticación
│   │   ├── reports.js           # CRUD de reportes
│   │   ├── slider.js            # CRUD de slider
│   │   ├── users.js             # Gestión de usuarios
│   │   ├── stats.js             # Estadísticas
│   │   ├── audit.js             # Auditoría
│   │   └── downloads.js         # Descargas
│   ├── utils/
│   │   └── logger.js            # Winston logger
│   ├── database/
│   │   └── schema.sql           # Schema de PostgreSQL
│   ├── uploads/                  # Archivos subidos
│   ├── logs/                     # Logs del sistema
│   ├── server.js                # Servidor principal
│   ├── package.json             # Dependencias
│   └── .env.example             # Variables de entorno
│
├── frontend/                     # Archivos HTML del frontend
│   ├── index.html               # Micrositio público
│   ├── login.html               # Login administrativo
│   ├── admin-panel.html         # Panel administrativo
│   ├── participacion-ciudadana.html
│   ├── documentos.html
│   └── dashboard-sectores-viales.html
│
└── docs/                         # Documentación
    ├── README-PRODUCCION.md     # Este archivo
    └── API-DOCUMENTATION.md     # Documentación de API
```

---

## 🔽 INSTALACIÓN PASO A PASO {#instalación}

### PASO 1: Preparar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y git curl wget build-essential

# Instalar Node.js v18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # debe mostrar v18.x.x
npm --version   # debe mostrar v9.x.x o superior
```

### PASO 2: Instalar PostgreSQL

```bash
# Instalar PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib postgresql-14-postgis-3

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar instalación
sudo -u postgres psql --version
```

### PASO 3: Instalar Redis

```bash
# Instalar Redis
sudo apt install -y redis-server

# Configurar Redis para iniciar con el sistema
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verificar instalación
redis-cli ping  # debe responder PONG
```

### PASO 4: Instalar PM2 (Gestor de Procesos)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Configurar PM2 para iniciar con el sistema
pm2 startup
# Ejecutar el comando que PM2 sugiere (usa sudo)
```

### PASO 5: Clonar/Subir el Proyecto

```bash
# Crear directorio del proyecto
sudo mkdir -p /var/www/viits
sudo chown -R $USER:$USER /var/www/viits

# Navegar al directorio
cd /var/www/viits

# Si tienes Git repository:
# git clone [URL_DEL_REPOSITORIO] .

# O subir archivos con SCP/SFTP
# scp -r ./viits-project/* user@server:/var/www/viits/
```

---

## 💾 CONFIGURACIÓN DE BASE DE DATOS {#base-de-datos}

### PASO 1: Crear Base de Datos y Usuario

```bash
# Conectar a PostgreSQL como superusuario
sudo -u postgres psql

# En la consola de PostgreSQL, ejecutar:
```

```sql
-- Crear usuario
CREATE USER viits_user WITH PASSWORD 'tu_password_seguro_aqui';

-- Crear base de datos
CREATE DATABASE viits_db OWNER viits_user;

-- Dar permisos
GRANT ALL PRIVILEGES ON DATABASE viits_db TO viits_user;

-- Conectar a la base de datos
\c viits_db

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Salir
\q
```

### PASO 2: Ejecutar Schema SQL

```bash
# Navegar al directorio del backend
cd /var/www/viits/backend

# Ejecutar schema SQL
psql -U viits_user -d viits_db -f database/schema.sql

# Verificar que las tablas se crearon correctamente
psql -U viits_user -d viits_db -c "\dt"
```

### PASO 3: Verificar Instalación de PostGIS

```bash
# Conectar a la base de datos
psql -U viits_user -d viits_db

# Verificar PostGIS
SELECT PostGIS_version();

# Debe mostrar la versión de PostGIS instalada
# Ejemplo: "3.1 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
```

---

## ⚙️ CONFIGURACIÓN DEL BACKEND {#backend}

### PASO 1: Instalar Dependencias

```bash
# Navegar al directorio del backend
cd /var/www/viits/backend

# Instalar dependencias de Node.js
npm install

# Verificar que no haya errores
npm list
```

### PASO 2: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar archivo .env
nano .env
```

Configurar las siguientes variables:

```env
# Entorno
NODE_ENV=production

# Puerto
PORT=3000

# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=viits_db
DB_USER=viits_user
DB_PASSWORD=tu_password_seguro_aqui

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=generar_clave_segura_de_64_caracteres_aqui
JWT_EXPIRES_IN=24h

# Email (configurar según tu proveedor)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASSWORD=tu_app_password

# URLs
CORS_ORIGIN=https://tu-dominio.com
FRONTEND_URL=https://tu-dominio.com
```

**🔐 IMPORTANTE:** Generar claves seguras para JWT:

```bash
# Generar clave JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Copiar el output y pegarlo en JWT_SECRET
```

### PASO 3: Crear Directorios Necesarios

```bash
# Crear directorios para uploads y logs
mkdir -p uploads/reports
mkdir -p uploads/slider
mkdir -p logs

# Establecer permisos correctos
chmod -R 755 uploads
chmod -R 755 logs
```

### PASO 4: Probar el Servidor

```bash
# Iniciar servidor en modo desarrollo
npm run dev

# O con node directamente
node server.js

# El servidor debe iniciar sin errores y mostrar:
# 🚀 SERVIDOR VIITS INICIADO EXITOSAMENTE 🚀
```

### PASO 5: Crear Usuario Administrador Inicial

El schema SQL ya crea un usuario administrador por defecto:
- **Email:** `admin@invias.gov.co`
- **Password:** `admin123`

**⚠️ CRÍTICO:** Cambiar esta contraseña inmediatamente en producción.

Para cambiar la contraseña:

```bash
# Conectar a la base de datos
psql -U viits_user -d viits_db

# Generar hash de nueva contraseña
# Usar bcrypt con 12 rounds
```

```javascript
// Ejecutar en Node.js para generar hash
const bcrypt = require('bcrypt');
const password = 'tu_nueva_contraseña_segura';
bcrypt.hash(password, 12).then(hash => console.log(hash));
```

```sql
-- Actualizar password en PostgreSQL
UPDATE users 
SET password_hash = '$2b$12$...' -- pegar el hash generado
WHERE email = 'admin@invias.gov.co';
```

---

## 🌐 CONFIGURACIÓN DEL FRONTEND {#frontend}

### PASO 1: Verificar Archivos HTML

Asegurarse de que todos los archivos HTML estén en su lugar:

```bash
cd /var/www/viits

# Verificar archivos principales
ls -la *.html

# Deben estar:
# - index.html
# - login.html
# - admin-panel.html
# - participacion-ciudadana.html
# - documentos.html
# - dashboard-sectores-viales.html
```

### PASO 2: Actualizar Modo de Producción

Editar los archivos `login.html` y `admin-panel.html`:

```bash
# Editar login.html
nano login.html

# Cambiar línea ~299:
# const DEMO_MODE = true;  →  const DEMO_MODE = false;

# Editar admin-panel.html
nano admin-panel.html

# Cambiar línea ~1010:
# const DEMO_MODE = true;  →  const DEMO_MODE = false;
```

### PASO 3: Configurar URLs en Frontend

Si tu backend está en un puerto diferente o subdominio, actualizar las URLs en los archivos JavaScript.

---

## 🚀 DESPLIEGUE EN PRODUCCIÓN {#despliegue}

### OPCIÓN A: Despliegue con PM2 (Recomendado)

```bash
# Navegar al directorio del backend
cd /var/www/viits/backend

# Iniciar aplicación con PM2
pm2 start server.js --name viits-backend

# Guardar configuración de PM2
pm2 save

# Ver estado
pm2 status

# Ver logs
pm2 logs viits-backend

# Configurar auto-restart
pm2 startup
```

### OPCIÓN B: Despliegue con Nginx como Proxy Inverso

#### 1. Instalar Nginx

```bash
sudo apt install -y nginx
```

#### 2. Configurar Nginx

```bash
# Crear archivo de configuración
sudo nano /etc/nginx/sites-available/viits
```

Contenido del archivo:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Tamaño máximo de upload
    client_max_body_size 100M;

    # Servir archivos estáticos
    location / {
        root /var/www/viits;
        try_files $uri $uri/ =404;
        index index.html;
    }

    # Proxy para API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Servir archivos subidos
    location /uploads {
        alias /var/www/viits/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3. Habilitar Configuración

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/viits /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Si no hay errores, recargar Nginx
sudo systemctl reload nginx
```

#### 4. Configurar SSL con Let's Encrypt (OPCIONAL pero RECOMENDADO)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática
sudo certbot renew --dry-run
```

---

## ✔️ VERIFICACIÓN DEL SISTEMA {#verificación}

### Script de Verificación Automatizada

Crear archivo `verify-system.sh`:

```bash
#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  VERIFICACIÓN DEL SISTEMA VIITS                           ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Verificar Node.js
echo "📦 Verificando Node.js..."
node --version || echo "❌ Node.js no instalado"

# Verificar PostgreSQL
echo "💾 Verificando PostgreSQL..."
psql --version || echo "❌ PostgreSQL no instalado"

# Verificar Redis
echo "🔴 Verificando Redis..."
redis-cli ping || echo "❌ Redis no está corriendo"

# Verificar PM2
echo "⚙️  Verificando PM2..."
pm2 --version || echo "❌ PM2 no instalado"

# Verificar backend
echo "🔧 Verificando Backend..."
curl -s http://localhost:3000/api/health || echo "❌ Backend no responde"

# Verificar base de datos
echo "💾 Verificando Base de Datos..."
psql -U viits_user -d viits_db -c "SELECT 1;" || echo "❌ No se puede conectar a DB"

echo ""
echo "✅ Verificación completa"
```

Ejecutar:

```bash
chmod +x verify-system.sh
./verify-system.sh
```

### Verificación Manual

```bash
# 1. Verificar que el backend esté corriendo
curl http://localhost:3000/api/health

# Debe retornar:
# {"status":"OK","timestamp":"...","uptime":...}

# 2. Verificar conexión a base de datos
psql -U viits_user -d viits_db -c "SELECT COUNT(*) FROM users;"

# Debe mostrar al menos 1 (el admin)

# 3. Verificar Redis
redis-cli ping
# Debe responder: PONG

# 4. Verificar PM2 (si lo usas)
pm2 status
# Debe mostrar viits-backend online

# 5. Verificar Nginx (si lo usas)
sudo nginx -t
sudo systemctl status nginx
```

---

## 🔒 SEGURIDAD EN PRODUCCIÓN

### Checklist de Seguridad

```
✅ Cambiar password del admin por defecto
✅ Usar HTTPS (SSL/TLS)
✅ Configurar firewall (UFW)
✅ Limitar acceso SSH
✅ Configurar rate limiting
✅ Usar contraseñas fuertes en BD
✅ Configurar backups automáticos
✅ Monitorear logs de seguridad
✅ Mantener sistema actualizado
✅ Usar .env para secrets (nunca en Git)
```

### Configurar Firewall

```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verificar estado
sudo ufw status
```

---

## 🔧 MANTENIMIENTO Y MONITOREO {#mantenimiento}

### Logs

```bash
# Ver logs del backend (con PM2)
pm2 logs viits-backend

# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ver logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Backups

#### Base de Datos

```bash
# Crear script de backup
nano /var/www/viits/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/viits"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U viits_user viits_db | gzip > $BACKUP_DIR/viits_db_$DATE.sql.gz
# Mantener solo últimos 30 días
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
# Dar permisos
chmod +x /var/www/viits/backup-db.sh

# Configurar cron para backup diario
crontab -e

# Agregar línea:
0 2 * * * /var/www/viits/backup-db.sh
```

#### Archivos Subidos

```bash
# Backup de uploads
tar -czf /var/backups/viits/uploads_$(date +%Y%m%d).tar.gz /var/www/viits/backend/uploads/
```

### Monitoreo con PM2

```bash
# Instalar PM2 monitoring (opcional)
pm2 install pm2-logrotate

# Configurar
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🆘 TROUBLESHOOTING {#troubleshooting}

### Problema: Backend no inicia

```bash
# Verificar logs
pm2 logs viits-backend --lines 100

# Verificar variables de entorno
cat backend/.env

# Verificar conexión a BD
psql -U viits_user -d viits_db -c "SELECT 1;"

# Verificar puerto en uso
netstat -tlnp | grep 3000
```

### Problema: Error de conexión a base de datos

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar credenciales en .env
# Intentar conexión manual
psql -h localhost -U viits_user -d viits_db

# Verificar pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Debe incluir: host all all 127.0.0.1/32 md5
```

### Problema: Error 502 Bad Gateway (Nginx)

```bash
# Verificar que backend esté corriendo
pm2 status

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Verificar configuración de Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Problema: Uploads fallan

```bash
# Verificar permisos del directorio
ls -la backend/uploads

# Debe ser escribible
chmod -R 755 backend/uploads
chown -R $USER:$USER backend/uploads

# Verificar tamaño máximo en Nginx (si aplica)
# client_max_body_size en nginx.conf
```

---

## 📞 SOPORTE Y CONTACTO

**Equipo del Proyecto:**
- Javier Velásquez - Líder Técnico
- Juan Sebastián Pérez - Analista de Requerimientos
- Hernán Darío Buitrago - Gerente de Desarrollo

**Para Soporte Técnico:**
1. Revisar esta documentación
2. Verificar logs del sistema
3. Consultar documentación de API
4. Contactar al equipo técnico

---

## 📚 RECURSOS ADICIONALES

- [Documentación de Node.js](https://nodejs.org/docs/)
- [Documentación de PostgreSQL](https://www.postgresql.org/docs/)
- [Documentación de PM2](https://pm2.keymetrics.io/docs/)
- [Documentación de Nginx](https://nginx.org/en/docs/)
- [Best Practices de Seguridad](https://cheatsheetseries.owasp.org/)

---

**Versión del Documento:** 1.0.0  
**Última Actualización:** 13 de Octubre, 2025  
**Estado:** ✅ LISTO PARA PRODUCCIÓN

