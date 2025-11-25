# 🚀 INSTALACIÓN RÁPIDA - SISTEMA VIITS

## ⚡ INICIO RÁPIDO (5 minutos)

### 1. Verificar Requisitos Previos

```bash
# Verificar Node.js (debe ser v16+)
node --version

# Verificar npm
npm --version

# Verificar PostgreSQL (debe ser v13+)
psql --version
```

### 2. Instalar Dependencias del Backend

```bash
cd backend
npm install

# Si hay errores con bcrypt, instalar herramientas de compilación:
# En Ubuntu/Debian:
sudo apt-get install build-essential python3

# En RHEL/CentOS:
sudo yum install gcc-c++ make python3

# Luego reintentar:
npm install
```

### 3. Configurar Base de Datos

```bash
# Crear usuario y base de datos PostgreSQL
sudo -u postgres psql

# Dentro de psql:
CREATE DATABASE viits_db;
CREATE USER viits_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE viits_db TO viits_user;
\q

# Importar schema
sudo -u postgres psql -d viits_db -f backend/database/schema.sql
```

### 4. Configurar Variables de Entorno

```bash
cd backend
cp .env.example .env
nano .env

# Editar las variables importantes:
# - DB_PASSWORD
# - JWT_SECRET
# - JWT_REFRESH_SECRET
```

### 5. Iniciar el Servidor

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start

# Con PM2 (recomendado)
npm install -g pm2
pm2 start server.js --name viits-backend
pm2 save
pm2 startup
```

### 6. Verificar Funcionamiento

```bash
# Verificar que el servidor está corriendo
curl http://localhost:3000/api/health

# Debería responder:
# {"status":"ok","message":"VIITS API is running"}
```

### 7. Acceder al Sistema

- **Frontend**: http://localhost:3000
- **Login Admin**: http://localhost:3000/login.html
- **API Docs**: http://localhost:3000/api

**Credenciales por defecto:**
- Email: admin@invias.gov.co
- Password: admin123
- ⚠️ **CAMBIAR INMEDIATAMENTE EN PRODUCCIÓN**

---

## 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

### Error: EADDRINUSE (Puerto en uso)
```bash
# Cambiar el puerto en .env
PORT=3001
```

### Error: Cannot connect to database
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar credenciales en .env
# Verificar que la base de datos existe
psql -U viits_user -d viits_db
```

### Error: bcrypt compilation failed
```bash
# Instalar herramientas de compilación
sudo apt-get install build-essential python3 -y

# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 MODO DEMO (Sin Backend)

Si solo quieres probar el frontend:

1. Abre `index.html` en tu navegador
2. Para admin, abre `login.html`
3. El modo demo está activado por defecto
4. Usa cualquier email/password para entrar

---

## 🎯 SIGUIENTE PASO

Consulta **README-PRODUCCION.md** para:
- Configuración avanzada
- Despliegue con Nginx
- SSL/HTTPS
- Seguridad en producción
- Monitoreo y logs
- Backups automáticos

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Node.js 16+ instalado
- [ ] PostgreSQL 13+ instalado y corriendo
- [ ] Base de datos creada
- [ ] Schema SQL importado
- [ ] Archivo .env configurado
- [ ] Dependencias npm instaladas
- [ ] Servidor iniciado correctamente
- [ ] API responde en /api/health
- [ ] Frontend carga correctamente
- [ ] Login funciona
- [ ] Credenciales por defecto cambiadas

---

**¿Necesitas ayuda?** Consulta la sección de Troubleshooting en README-PRODUCCION.md
