# 🏛️ SISTEMA VIITS - INVIAS Colombia

## Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad

![Estado](https://img.shields.io/badge/estado-producción-green)
![Versión](https://img.shields.io/badge/versión-1.0.0-blue)
![Node](https://img.shields.io/badge/node-16%2B-brightgreen)
![PostgreSQL](https://img.shields.io/badge/postgresql-13%2B-blue)

---

## 📋 Contenido

1. [Acerca del Proyecto](#acerca-del-proyecto)
2. [Características](#características)
3. [Inicio Rápido](#inicio-rápido)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Tecnologías](#tecnologías)
6. [Documentación](#documentación)
7. [Licencia](#licencia)

---

## 🎯 Acerca del Proyecto

El Sistema VIITS es una plataforma integral desarrollada para el **Instituto Nacional de Vías (INVIAS)** de Colombia, diseñada para:

- ✅ Gestión centralizada de sectores viales
- ✅ Monitoreo de tráfico en tiempo real
- ✅ Repositorio de documentos e informes
- ✅ Participación ciudadana
- ✅ Panel administrativo completo
- ✅ Sistema de autenticación seguro
- ✅ API REST completa

---

## ✨ Características

### Frontend
- 🎨 Diseño responsive basado en Gov.co Design System
- 📊 Dashboard interactivo con visualizaciones
- 📄 Sistema de gestión documental
- 🗺️ Visualización geográfica de sectores viales
- 🔍 Búsqueda y filtrado avanzado
- 📱 Compatible con dispositivos móviles

### Backend
- 🔐 Autenticación JWT + 2FA
- 🛡️ Seguridad multi-capa (Helmet, CORS, Rate Limiting)
- 📡 API REST completa
- 🗄️ Base de datos PostgreSQL con PostGIS
- 📝 Sistema de logs con Winston
- 📧 Notificaciones por email
- 💾 Gestión de archivos con Multer
- 🔄 Cache con Redis (opcional)

### Seguridad
- 🔒 Encriptación bcrypt (12 rounds)
- 🎫 Tokens JWT con expiración
- 👥 Control de acceso basado en roles
- 📋 Auditoría completa de acciones
- 🚫 Protección contra SQL Injection y XSS
- ⚡ Rate limiting por IP

---

## 🚀 Inicio Rápido

### Opción 1: Modo Demo (Sin instalación)

```bash
# Simplemente abre en tu navegador:
index.html           # Sitio público
login.html          # Panel administrativo
```

**Credenciales demo:** Cualquier email/password

### Opción 2: Instalación Completa (5 minutos)

```bash
# 1. Clonar/Descargar el proyecto
cd micrositio-viits

# 2. Instalar dependencias
cd backend
npm install

# 3. Configurar base de datos
sudo -u postgres psql -f database/schema.sql

# 4. Configurar variables de entorno
cp .env.example .env
nano .env

# 5. Iniciar servidor
npm start
```

**Ver [INSTALACION-RAPIDA.md](./INSTALACION-RAPIDA.md) para detalles completos.**

---

## 📁 Estructura del Proyecto

```
micrositio-viits/
│
├── backend/                          # Backend Node.js/Express
│   ├── config/                       # Configuraciones
│   │   └── database.js              # Pool PostgreSQL
│   ├── middleware/                   # Middlewares
│   │   ├── auth.js                  # Autenticación JWT
│   │   └── errorHandler.js          # Manejo de errores
│   ├── routes/                       # Rutas de API
│   │   ├── auth.js                  # Autenticación
│   │   ├── reports.js               # Reportes
│   │   ├── slider.js                # Slider
│   │   ├── users.js                 # Usuarios
│   │   ├── stats.js                 # Estadísticas
│   │   ├── audit.js                 # Auditoría
│   │   └── downloads.js             # Descargas
│   ├── utils/                        # Utilidades
│   │   └── logger.js                # Logger Winston
│   ├── database/                     # Base de datos
│   │   └── schema.sql               # Schema PostgreSQL
│   ├── uploads/                      # Archivos subidos
│   ├── logs/                         # Logs del sistema
│   ├── server.js                     # Servidor principal
│   ├── package.json                  # Dependencias
│   └── .env.example                  # Variables de entorno
│
├── index.html                        # Página principal
├── login.html                        # Login administrativo
├── admin-panel.html                  # Panel de administración
├── admin-panel-functions.js          # Funciones del admin
├── participacion-ciudadana.html      # Participación ciudadana
├── documentos.html                   # Repositorio documentos
├── dashboard-sectores-viales.html    # Dashboard sectores
│
├── README.md                         # Este archivo
├── INSTALACION-RAPIDA.md            # Guía de instalación
├── QUICK-START.md                   # Comandos rápidos
├── README-PRODUCCION.md             # Guía completa
├── 00-LEER-PRIMERO.md              # Resumen ejecutivo
│
├── iniciar-servidor.sh              # Script inicio Linux
├── INICIAR-SERVIDOR.bat            # Script inicio Windows
└── verificar-proyecto.sh            # Script verificación
```

---

## 🛠️ Tecnologías

### Backend
- **Node.js** v16+ - Runtime JavaScript
- **Express** 4.18 - Framework web
- **PostgreSQL** 13+ - Base de datos principal
- **PostGIS** - Extensión geográfica
- **Redis** 6+ - Cache (opcional)
- **JWT** - Autenticación
- **Bcrypt** - Encriptación passwords
- **Speakeasy** - 2FA/TOTP
- **Winston** - Logging
- **Multer** - Upload archivos
- **Helmet** - Seguridad headers
- **Express Rate Limit** - Protección DDoS

### Frontend
- **HTML5, CSS3, JavaScript** ES6+
- **Chart.js** - Gráficos y visualizaciones
- **Material Icons** - Iconografía
- **Gov.co Design System** - Diseño gubernamental
- **Responsive Design** - Mobile-first

---

## 📚 Documentación

### Guías Disponibles

| Documento | Descripción | Tiempo |
|-----------|-------------|--------|
| [00-LEER-PRIMERO.md](./00-LEER-PRIMERO.md) | Resumen ejecutivo del proyecto | 5 min |
| [INSTALACION-RAPIDA.md](./INSTALACION-RAPIDA.md) | Instalación en 5 minutos | 5 min |
| [QUICK-START.md](./QUICK-START.md) | Comandos esenciales | 3 min |
| [README-PRODUCCION.md](./README-PRODUCCION.md) | Guía completa de despliegue | 30 min |
| [GUIA-DESPLIEGUE-COMPLETO.md](./GUIA-DESPLIEGUE-COMPLETO.md) | Despliegue paso a paso | 20 min |

### Tutoriales HTML

| Archivo | Contenido |
|---------|-----------|
| [00-INICIO-PROYECTO.html](./00-INICIO-PROYECTO.html) | Introducción visual |
| [INICIO-DESPLIEGUE.html](./INICIO-DESPLIEGUE.html) | Guía visual de despliegue |

---

## 🔐 Seguridad

El sistema implementa múltiples capas de seguridad siguiendo las mejores prácticas de **OWASP Top 10 - 2021**:

### Implementaciones de Seguridad

- ✅ **Autenticación**: JWT + 2FA/TOTP
- ✅ **Autorización**: Control basado en roles (RBAC)
- ✅ **Encriptación**: Bcrypt (12 rounds)
- ✅ **Headers seguros**: Helmet.js
- ✅ **Rate Limiting**: Protección DDoS (100 req/15min, 5 login/15min)
- ✅ **CORS**: Configurado para producción
- ✅ **Validación**: Express-validator
- ✅ **SQL Injection**: Queries parametrizadas
- ✅ **NoSQL Injection**: Validación de operadores
- ✅ **XSS**: Sanitización de inputs
- ✅ **SSRF**: Validación de URLs y bloqueo de IPs privadas
- ✅ **Auditoría**: Log completo de acciones con Winston
- ✅ **Integridad**: Validación de archivos y checksums
- ✅ **Monitoreo**: Logs con rotación diaria

### Validación OWASP Top 10 - 2021

El sistema ha sido validado contra las 10 categorías de seguridad más críticas:

| Categoría | Estado | Documentación |
|-----------|--------|---------------|
| A01 - Broken Access Control | ✅ Implementado | JWT, RBAC, prevención IDOR |
| A02 - Cryptographic Failures | ✅ Implementado | Bcrypt, HTTPS, JWT secrets |
| A03 - Injection | ✅ Implementado | Queries parametrizadas, sanitización |
| A04 - Insecure Design | ✅ Implementado | Rate limiting, límites de recursos |
| A05 - Security Misconfiguration | ✅ Implementado | .env, headers seguros, CORS |
| A06 - Vulnerable Components | ✅ Implementado | npm audit, monitoreo de CVEs |
| A07 - Authentication Failures | ✅ Implementado | Passwords fuertes, 2FA |
| A08 - Data Integrity Failures | ✅ Implementado | Validación de archivos, checksums |
| A09 - Logging Failures | ✅ Implementado | Winston logs, auditoría en BD |
| A10 - SSRF | ✅ Implementado | Validación de URLs, bloqueo de IPs |

### Documentación de Seguridad

- **[SEGURIDAD-OWASP.md](./SEGURIDAD-OWASP.md)** - Documentación completa con ejemplos y pruebas
- **[SEGURIDAD-OWASP.html](./SEGURIDAD-OWASP.html)** - Vista visual interactiva
- **[owaspSecurity.js](./backend/middleware/owaspSecurity.js)** - Middleware de validaciones
- **[test-security-owasp.sh](./test-security-owasp.sh)** - Script de pruebas automatizadas

### Ejecutar Pruebas de Seguridad

```bash
# Ejecutar suite completa de pruebas OWASP
./test-security-owasp.sh

# Auditoría de dependencias
cd backend && npm audit

# Verificar vulnerabilidades con Snyk
cd backend && npx snyk test
```

⚠️ **IMPORTANTE**: 
- Cambiar todas las credenciales por defecto en producción
- Ejecutar pruebas de seguridad regularmente
- Mantener dependencias actualizadas
- Revisar logs de seguridad semanalmente

---

## 🚀 Despliegue en Producción

### Requisitos del Sistema

| Componente | Versión Mínima | Recomendado |
|------------|----------------|-------------|
| Node.js | 16.0.0 | 18+ |
| PostgreSQL | 13.0 | 15+ |
| Redis | 6.0 | 7+ (opcional) |
| RAM | 2 GB | 4+ GB |
| Disco | 10 GB | 20+ GB |

### Pasos Resumidos

1. **Preparar Servidor**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Instalar Dependencias del Sistema**
   ```bash
   sudo apt install nodejs npm postgresql redis-server nginx certbot -y
   ```

3. **Configurar el Proyecto**
   ```bash
   npm install
   cp .env.example .env
   nano .env
   ```

4. **Configurar Base de Datos**
   ```bash
   sudo -u postgres psql -f database/schema.sql
   ```

5. **Iniciar con PM2**
   ```bash
   pm2 start server.js --name viits-backend
   pm2 save
   pm2 startup
   ```

6. **Configurar Nginx + SSL**
   ```bash
   sudo certbot --nginx -d tu-dominio.com
   ```

**Ver [README-PRODUCCION.md](./README-PRODUCCION.md) para instrucciones detalladas.**

---

## 📊 API Endpoints

### Autenticación
```
POST   /api/auth/login          # Login usuario
POST   /api/auth/verify-2fa     # Verificar 2FA
GET    /api/auth/verify-token   # Validar token
POST   /api/auth/logout         # Cerrar sesión
```

### Reportes/Documentos
```
GET    /api/reports             # Listar reportes
POST   /api/reports             # Crear reporte
PUT    /api/reports/:id         # Actualizar reporte
DELETE /api/reports/:id         # Eliminar reporte
```

### Gestión de Usuarios
```
GET    /api/users               # Listar usuarios
POST   /api/users               # Crear usuario
PUT    /api/users/:id           # Actualizar usuario
DELETE /api/users/:id           # Eliminar usuario
```

### Estadísticas
```
GET    /api/stats/dashboard     # Stats del dashboard
GET    /api/stats/traffic       # Stats de tráfico
```

### Auditoría
```
GET    /api/audit               # Log de auditoría
GET    /api/downloads           # Historial descargas
```

**Ver documentación completa en `/docs` (próximamente)**

---

## 🧪 Testing

```bash
# Tests unitarios
npm test

# Tests con cobertura
npm run test:coverage

# Tests de integración
npm run test:integration
```

---

## 📈 Monitoreo

### Logs del Sistema
```bash
# Ver logs en tiempo real
pm2 logs viits-backend

# Ver logs guardados
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Métricas
```bash
# Estado del proceso
pm2 status

# Monitoreo en tiempo real
pm2 monit

# Información detallada
pm2 info viits-backend
```

---

## 🔄 Mantenimiento

### Backups de Base de Datos
```bash
# Backup manual
pg_dump -U viits_user viits_db > backup_$(date +%Y%m%d).sql

# Backup automático (cron)
0 2 * * * pg_dump -U viits_user viits_db > /backups/viits_$(date +\%Y\%m\%d).sql
```

### Actualizaciones
```bash
# Actualizar dependencias
npm update

# Reiniciar servidor
pm2 restart viits-backend

# Ver changelog
pm2 logs viits-backend --lines 100
```

---

## 🤝 Contribuciones

Para contribuir al proyecto:

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -m 'Agregar NuevaCaracteristica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto fue desarrollado para el **Instituto Nacional de Vías (INVIAS)** de Colombia.

Todos los derechos reservados © 2025 INVIAS

---

## 👥 Equipo

- **Javier Velásquez** - Líder Técnico
- **Juan Sebastián Pérez** - Analista de Requerimientos
- **Hernán Darío Buitrago** - Gerente de Desarrollo

---

## 📞 Soporte

Para soporte técnico:

- 📧 Email: soporte@invias.gov.co
- 📱 Teléfono: +57 (1) 234-5678
- 🌐 Web: https://www.invias.gov.co

---

## 🎯 Estado del Proyecto

- ✅ **Fase 1**: Desarrollo completado
- ✅ **Fase 2**: Testing completado
- ✅ **Fase 3**: Documentación completada
- ✅ **Fase 4**: Listo para producción
- 🔄 **Fase 5**: Mantenimiento continuo

---

**Última actualización:** 13 de Octubre, 2025  
**Versión:** 1.0.0  
**Estado:** ✅ Producción Ready
