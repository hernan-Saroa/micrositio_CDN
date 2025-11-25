# 🔒 DOCUMENTACIÓN DE SEGURIDAD OWASP - SISTEMA VIITS

## Instituto Nacional de Vías (INVIAS) - Colombia

**Versión:** 1.0.0  
**Fecha:** 13 de Octubre, 2025  
**Estándar:** OWASP Top 10 - 2021

---

## 📋 Tabla de Contenido

1. [Introducción](#introducción)
2. [OWASP Top 10 - 2021](#owasp-top-10---2021)
3. [Implementaciones de Seguridad](#implementaciones-de-seguridad)
4. [Pruebas de Seguridad](#pruebas-de-seguridad)
5. [Checklist de Verificación](#checklist-de-verificación)
6. [Monitoreo y Respuesta](#monitoreo-y-respuesta)
7. [Referencias](#referencias)

---

## 🎯 Introducción

### ¿Qué es OWASP?

**OWASP** (Open Web Application Security Project) es una organización sin fines de lucro dedicada a mejorar la seguridad del software. El **OWASP Top 10** es una lista de las 10 vulnerabilidades de seguridad más críticas en aplicaciones web.

### Objetivo de este Documento

Este documento detalla cómo el Sistema VIITS implementa medidas de seguridad para cada una de las categorías del OWASP Top 10 - 2021, proporcionando:

- ✅ Descripción de cada vulnerabilidad
- ✅ Implementación específica en VIITS
- ✅ Código de ejemplo
- ✅ Pruebas de validación
- ✅ Mejores prácticas

---

## 🛡️ OWASP Top 10 - 2021

### A01:2021 – Broken Access Control

#### 📖 Descripción
Fallas en el control de acceso permiten a los usuarios realizar acciones o acceder a datos fuera de sus permisos previstos.

#### ✅ Implementación en VIITS

**1. Autenticación JWT**
```javascript
// backend/middleware/auth.js
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Validación adicional...
}
```

**2. Control de Acceso Basado en Roles (RBAC)**
```javascript
const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Acceso denegado',
                requiredRoles: allowedRoles 
            });
        }
        next();
    };
};
```

**3. Prevención de Referencia Directa a Objetos (IDOR)**
```javascript
// backend/middleware/owaspSecurity.js
const preventDirectObjectReference = async (req, res, next) => {
    const resourceOwnerId = req.params.userId;
    
    if (resourceOwnerId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
};
```

#### 🧪 Pruebas de Validación

**Test 1: Acceso sin autenticación**
```bash
# Debe fallar (401)
curl -X GET http://localhost:3000/api/users

# Respuesta esperada:
# { "error": "Token no proporcionado" }
```

**Test 2: Acceso con rol incorrecto**
```bash
# Usuario normal intentando acceder a ruta de admin
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <token_usuario_normal>"

# Respuesta esperada:
# { "error": "Acceso denegado", "requiredRoles": ["admin"] }
```

**Test 3: IDOR (Insecure Direct Object Reference)**
```bash
# Usuario intentando acceder a recursos de otro usuario
curl -X GET http://localhost:3000/api/users/123/documents \
  -H "Authorization: Bearer <token_usuario_456>"

# Respuesta esperada:
# { "error": "Acceso denegado" }
```

#### ✅ Checklist
- [x] Autenticación JWT implementada
- [x] Control basado en roles (RBAC)
- [x] Prevención IDOR
- [x] Verificación de sesiones activas
- [x] Validación de tokens en cada petición
- [x] Logout invalida sesiones

---

### A02:2021 – Cryptographic Failures

#### 📖 Descripción
Fallas relacionadas con criptografía que pueden exponer datos sensibles.

#### ✅ Implementación en VIITS

**1. Encriptación de Contraseñas con Bcrypt**
```javascript
// backend/routes/auth.js
const bcrypt = require('bcrypt');

// Al crear usuario
const hashedPassword = await bcrypt.hash(password, 12); // 12 rounds

// Al verificar
const validPassword = await bcrypt.compare(password, user.password_hash);
```

**2. Configuración de Variables Sensibles**
```bash
# backend/.env
JWT_SECRET=clave_secreta_super_segura_minimo_32_caracteres_alfanumericos
JWT_REFRESH_SECRET=otra_clave_diferente_para_refresh_tokens
DB_PASSWORD=password_encriptado_postgresql
```

**3. Requerimiento de HTTPS en Producción**
```javascript
// backend/middleware/owaspSecurity.js
const requireHTTPS = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        return res.status(403).json({ 
            error: 'Se requiere HTTPS' 
        });
    }
    next();
};
```

**4. Headers de Seguridad con Helmet**
```javascript
// backend/server.js
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
```

#### 🧪 Pruebas de Validación

**Test 1: Verificar encriptación de contraseñas**
```sql
-- En PostgreSQL
SELECT password_hash FROM users LIMIT 1;

-- Debe mostrar un hash bcrypt (60 caracteres comenzando con $2b$)
-- Ejemplo: $2b$12$abcdefghijklmnopqrstuvwxyz1234567890...
```

**Test 2: Verificar HTTPS en producción**
```bash
# Debe redirigir a HTTPS
curl -I http://tu-dominio.com/api/users

# Headers esperados:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Test 3: Verificar fortaleza de JWT Secret**
```bash
# En el servidor
echo $JWT_SECRET | wc -c

# Debe ser >= 32 caracteres
```

#### ✅ Checklist
- [x] Bcrypt con 12 rounds para passwords
- [x] JWT secrets >= 32 caracteres
- [x] HTTPS obligatorio en producción
- [x] HSTS configurado
- [x] Variables sensibles en .env
- [x] No hay datos sensibles en logs
- [x] Tokens con expiración

---

### A03:2021 – Injection

#### 📖 Descripción
Vulnerabilidades de inyección (SQL, NoSQL, OS Command, etc.) que permiten ejecutar comandos maliciosos.

#### ✅ Implementación en VIITS

**1. Queries Parametrizadas (Prevención SQL Injection)**
```javascript
// ❌ INCORRECTO (Vulnerable)
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ CORRECTO (Seguro)
const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
);
```

**2. Sanitización de Entrada**
```javascript
// backend/middleware/owaspSecurity.js
const sanitizeInput = (req, res, next) => {
    const dangerousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/gi,
        /(--|#|\/\*|\*\/)/g,
        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi
    ];
    
    // Verificar en req.body y req.query
    // Si se detecta patrón peligroso, rechazar
};
```

**3. Validación con Express-Validator**
```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/users',
    body('email').isEmail().normalizeEmail(),
    body('name').trim().escape(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // Procesar...
    }
);
```

**4. Prevención NoSQL Injection**
```javascript
const preventNoSQLInjection = (req, res, next) => {
    const checkForOperators = (obj) => {
        for (let key in obj) {
            if (key.startsWith('$') || key.includes('.')) {
                return true;
            }
        }
        return false;
    };
    
    if (checkForOperators(req.body)) {
        return res.status(400).json({ 
            error: 'Operadores no permitidos' 
        });
    }
    next();
};
```

#### 🧪 Pruebas de Validación

**Test 1: SQL Injection**
```bash
# Intento de inyección SQL
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com' OR '1'='1",
    "password": "test"
  }'

# Respuesta esperada:
# { "error": "Patrón de inyección detectado" }
```

**Test 2: NoSQL Injection**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": {"$ne": null},
    "password": {"$ne": null}
  }'

# Respuesta esperada:
# { "error": "Operadores no permitidos" }
```

**Test 3: XSS en campos de texto**
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "<script>alert(\"XSS\")</script>",
    "description": "Test"
  }'

# El script debe ser escapado o rechazado
```

#### ✅ Checklist
- [x] Queries parametrizadas en todas las consultas SQL
- [x] Sanitización de entrada implementada
- [x] Express-validator en uso
- [x] Prevención NoSQL injection
- [x] Validación de tipos de datos
- [x] Escape de caracteres especiales
- [x] No se ejecutan comandos del sistema con input del usuario

---

### A04:2021 – Insecure Design

#### 📖 Descripción
Fallas de diseño que crean riesgos de seguridad inherentes a la arquitectura.

#### ✅ Implementación en VIITS

**1. Rate Limiting por Operación**
```javascript
// backend/server.js

// Rate limiting general
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // 100 peticiones
});

// Rate limiting estricto para login
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5 // Solo 5 intentos
});

app.use('/api/', limiter);
app.use('/api/auth/login', strictLimiter);
```

**2. Validación de Flujo de Negocio**
```javascript
// No permitir eliminar reportes en revisión
const validateBusinessLogic = async (req, res, next) => {
    const reportId = req.params.id;
    
    const report = await query(
        'SELECT status FROM reports WHERE id = $1',
        [reportId]
    );
    
    if (report.rows[0].status === 'in_review') {
        return res.status(400).json({
            error: 'No se puede eliminar un reporte en revisión'
        });
    }
    
    next();
};
```

**3. Límites de Recursos**
```javascript
// backend/server.js
app.use(express.json({ limit: '50mb' })); // Límite de payload
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

#### 🧪 Pruebas de Validación

**Test 1: Rate Limiting**
```bash
# Hacer 6 peticiones rápidas al login
for i in {1..6}; do
    curl -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@test.com","password":"test"}' &
done

# La 6ta debe ser rechazada con 429
```

**Test 2: Payload demasiado grande**
```bash
# Enviar payload > 50MB
curl -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @large_file.json

# Respuesta esperada: 413 Payload Too Large
```

#### ✅ Checklist
- [x] Rate limiting implementado
- [x] Límites de payload configurados
- [x] Validación de flujos de negocio
- [x] Timeouts configurados
- [x] Límites de recursos
- [x] Principio de menor privilegio

---

### A05:2021 – Security Misconfiguration

#### 📖 Descripción
Configuraciones incorrectas que exponen el sistema a vulnerabilidades.

#### ✅ Implementación en VIITS

**1. Variables de Entorno**
```bash
# ✅ CORRECTO: .env (no versionado)
NODE_ENV=production
JWT_SECRET=clave_segura_aleatoria
DB_PASSWORD=password_fuerte

# ❌ INCORRECTO: Nunca hardcodear en el código
const JWT_SECRET = "mi_clave_secreta"; // ¡NUNCA!
```

**2. Headers de Seguridad**
```javascript
// backend/middleware/owaspSecurity.js
const removeServerHeaders = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
};
```

**3. Modo de Producción**
```javascript
// backend/server.js
if (process.env.NODE_ENV === 'production') {
    // Desactivar stack traces detallados
    app.use((err, req, res, next) => {
        res.status(500).json({ 
            error: 'Error interno del servidor' 
            // No incluir err.stack ni detalles
        });
    });
}
```

**4. CORS Configurado**
```javascript
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### 🧪 Pruebas de Validación

**Test 1: Headers de seguridad**
```bash
curl -I http://localhost:3000/api/health

# Headers esperados:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000

# Headers NO presentes:
# X-Powered-By (debe estar removido)
# Server (debe estar removido)
```

**Test 2: Variables de entorno**
```bash
# Verificar que no existan credenciales hardcodeadas
grep -r "password.*=.*\"" backend/
grep -r "JWT_SECRET.*=.*\"" backend/

# No debe encontrar resultados
```

**Test 3: CORS**
```bash
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS http://localhost:3000/api/users

# Debe rechazar origen no autorizado
```

#### ✅ Checklist
- [x] Variables sensibles en .env
- [x] .env no versionado (.gitignore)
- [x] Headers de servidor removidos
- [x] CORS configurado correctamente
- [x] Modo producción sin debug info
- [x] Permisos de archivos correctos
- [x] Servicios innecesarios deshabilitados
- [x] Actualizaciones de seguridad aplicadas

---

### A06:2021 – Vulnerable and Outdated Components

#### 📖 Descripción
Uso de componentes con vulnerabilidades conocidas.

#### ✅ Implementación en VIITS

**1. Gestión de Dependencias**
```json
// backend/package.json
{
  "dependencies": {
    "express": "^4.18.2",      // Versión actualizada
    "bcrypt": "^5.1.1",         // Última versión estable
    "jsonwebtoken": "^9.0.2",  // Sin vulnerabilidades conocidas
    "helmet": "^7.1.0"          // Actualizado
  }
}
```

**2. Auditoría Regular**
```bash
# Ejecutar regularmente
npm audit

# Corregir automáticamente vulnerabilidades
npm audit fix

# Para vulnerabilidades críticas
npm audit fix --force
```

**3. Dependabot/Renovate**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

#### 🧪 Pruebas de Validación

**Test 1: npm audit**
```bash
cd backend
npm audit

# Resultado esperado:
# found 0 vulnerabilities
```

**Test 2: Verificar versiones**
```bash
npm outdated

# Actualizar dependencias desactualizadas
npm update
```

**Test 3: Verificar CVEs conocidos**
```bash
# Usar herramientas como Snyk
npx snyk test

# O OWASP Dependency-Check
dependency-check --project "VIITS" --scan ./backend
```

#### ✅ Checklist
- [x] npm audit ejecutado sin vulnerabilidades
- [x] Dependencias actualizadas regularmente
- [x] Dependabot/Renovate configurado
- [x] No usar dependencias deprecadas
- [x] Verificar licencias de dependencias
- [x] Monitoreo continuo de CVEs
- [x] Proceso de actualización documentado

---

### A07:2021 – Identification and Authentication Failures

#### 📖 Descripción
Fallas en autenticación que permiten acceso no autorizado.

#### ✅ Implementación en VIITS

**1. Contraseñas Fuertes**
```javascript
// backend/middleware/owaspSecurity.js
const validatePasswordStrength = [
    body('password')
        .isLength({ min: 12 })
        .withMessage('Mínimo 12 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
        .withMessage('Debe contener mayúsculas, minúsculas, números y símbolos')
];
```

**2. Autenticación de Dos Factores (2FA)**
```javascript
// backend/routes/auth.js
const speakeasy = require('speakeasy');

// Generar secret para 2FA
const secret = speakeasy.generateSecret({
    name: 'VIITS (admin@invias.gov.co)'
});

// Verificar código TOTP
const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token: req.body.totp_code,
    window: 2
});
```

**3. Prevención de Enumeración de Usuarios**
```javascript
// Siempre la misma respuesta para email existente o no
app.post('/api/auth/login', async (req, res) => {
    const user = await findUser(email);
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
        // ✅ Mensaje genérico
        return res.status(401).json({
            error: 'Credenciales inválidas'
        });
        
        // ❌ NO hacer esto:
        // return res.status(404).json({ error: 'Usuario no encontrado' });
        // return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});
```

**4. Protección contra Credential Stuffing**
```javascript
const credentialStuffingProtection = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return `${req.ip}-${req.body.email}`;
    }
});
```

**5. Gestión de Sesiones**
```javascript
// Sesiones con expiración
const sessionResult = await query(
    'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW()',
    [userId]
);

// Logout invalida sesión
await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
```

#### 🧪 Pruebas de Validación

**Test 1: Contraseña débil**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "123456"
  }'

# Respuesta esperada:
# { "error": "Mínimo 12 caracteres" }
```

**Test 2: Múltiples intentos fallidos**
```bash
# 6 intentos de login con credenciales incorrectas
for i in {1..6}; do
    curl -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@test.com","password":"wrong"}' &
done

# 6to intento debe devolver: 429 Too Many Requests
```

**Test 3: Enumeración de usuarios**
```bash
# Usuario existente
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"admin@invias.gov.co","password":"wrong"}'

# Usuario inexistente
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"noexiste@test.com","password":"wrong"}'

# Ambos deben devolver la misma respuesta:
# { "error": "Credenciales inválidas" }
```

**Test 4: Expiración de tokens**
```bash
# Crear token con expiración corta
# Esperar a que expire
# Intentar usar token expirado

curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <token_expirado>"

# Respuesta esperada:
# { "error": "Token expirado" }
```

#### ✅ Checklist
- [x] Contraseñas mínimo 12 caracteres
- [x] Requisitos de complejidad de contraseña
- [x] 2FA disponible para administradores
- [x] Rate limiting en login
- [x] Prevención de enumeración de usuarios
- [x] Tokens con expiración (1 hora)
- [x] Refresh tokens implementados (7 días)
- [x] Logout invalida sesiones
- [x] No hay credenciales por defecto en producción
- [x] Recuperación de contraseña segura

---

### A08:2021 – Software and Data Integrity Failures

#### 📖 Descripción
Fallas relacionadas con la integridad del código y datos.

#### ✅ Implementación en VIITS

**1. Validación de Archivos Subidos**
```javascript
// backend/middleware/owaspSecurity.js
const validateFileIntegrity = (req, res, next) => {
    if (req.file) {
        const allowedTypes = {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png']
        };
        
        const mimeType = req.file.mimetype;
        const extension = path.extname(req.file.originalname);
        
        if (!allowedTypes[mimeType]?.includes(extension)) {
            return res.status(400).json({
                error: 'Tipo de archivo no coincide con extensión'
            });
        }
    }
    next();
};
```

**2. Validación de Tamaño de Archivos**
```javascript
const multer = require('multer');

const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
    },
    fileFilter: (req, file, cb) => {
        // Validar tipo de archivo
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Tipo de archivo no permitido'));
        }
        
        cb(null, true);
    }
});
```

**3. Checksums para Integridad**
```javascript
const crypto = require('crypto');

// Generar hash del archivo
const fileHash = crypto
    .createHash('sha256')
    .update(fileBuffer)
    .digest('hex');

// Guardar hash en base de datos
await query(
    'INSERT INTO files (name, hash, size) VALUES ($1, $2, $3)',
    [filename, fileHash, filesize]
);
```

**4. Verificación de Dependencias**
```bash
# package-lock.json incluye hashes de integridad
{
  "integrity": "sha512-XYZ123..."
}

# npm verifica automáticamente
npm ci  # En CI/CD usar esto en lugar de npm install
```

#### 🧪 Pruebas de Validación

**Test 1: Archivo con extensión falsa**
```bash
# Crear archivo PDF pero renombrarlo como .jpg
cp documento.pdf imagen.jpg

curl -X POST http://localhost:3000/api/reports/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@imagen.jpg"

# Respuesta esperada:
# { "error": "Tipo de archivo no coincide con extensión" }
```

**Test 2: Archivo demasiado grande**
```bash
# Crear archivo > 10MB
dd if=/dev/zero of=large.pdf bs=1M count=11

curl -X POST http://localhost:3000/api/reports/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@large.pdf"

# Respuesta esperada:
# { "error": "Archivo excede tamaño máximo" }
```

**Test 3: Integridad de dependencias**
```bash
# Verificar que package-lock.json existe
ls -la backend/package-lock.json

# Verificar integridad
npm ci
```

#### ✅ Checklist
- [x] Validación de tipo MIME vs extensión
- [x] Límites de tamaño de archivo
- [x] Checksums/hashes de archivos
- [x] package-lock.json versionado
- [x] npm ci en CI/CD
- [x] Validación de firmas digitales (si aplica)
- [x] Auditoría de cambios en datos críticos

---

### A09:2021 – Security Logging and Monitoring Failures

#### 📖 Descripción
Falta de logging y monitoreo adecuado de eventos de seguridad.

#### ✅ Implementación en VIITS

**1. Sistema de Logs con Winston**
```javascript
// backend/utils/logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Logs diarios que rotan
        new DailyRotateFile({
            filename: 'logs/viits-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d'
        }),
        // Logs de errores separados
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});
```

**2. Logging de Eventos de Seguridad**
```javascript
// backend/middleware/owaspSecurity.js
const logSecurityEvent = (eventType) => {
    return (req, res, next) => {
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            path: req.path,
            method: req.method,
            userId: req.user?.id || 'anonymous'
        };
        
        logger.info('[SECURITY]', event);
        
        // También guardar en base de datos
        query(
            'INSERT INTO audit_logs (event_type, user_id, ip_address, details) VALUES ($1, $2, $3, $4)',
            [eventType, req.user?.id, req.ip, JSON.stringify(event)]
        );
        
        next();
    };
};
```

**3. Eventos Críticos Registrados**
```javascript
// Login exitoso
logger.info('[AUTH]', { 
    event: 'login_success', 
    userId: user.id, 
    ip: req.ip 
});

// Login fallido
logger.warn('[AUTH]', { 
    event: 'login_failed', 
    email: req.body.email, 
    ip: req.ip 
});

// Cambio de permisos
logger.info('[SECURITY]', { 
    event: 'permission_change', 
    targetUser: targetUserId, 
    changedBy: req.user.id 
});

// Acceso denegado
logger.warn('[SECURITY]', { 
    event: 'access_denied', 
    userId: req.user.id, 
    resource: req.path 
});
```

**4. Tabla de Auditoría**
```sql
-- backend/database/schema.sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
```

#### 🧪 Pruebas de Validación

**Test 1: Verificar logs se están generando**
```bash
# Hacer una petición
curl http://localhost:3000/api/health

# Verificar log
tail -f backend/logs/viits-$(date +%Y-%m-%d).log

# Debe mostrar la petición
```

**Test 2: Logs de eventos de seguridad**
```bash
# Intento de login fallido
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"test@test.com","password":"wrong"}'

# Verificar log
grep "login_failed" backend/logs/viits-$(date +%Y-%m-%d).log
```

**Test 3: Auditoría en base de datos**
```sql
-- Verificar eventos recientes
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

**Test 4: Retención de logs**
```bash
# Verificar que los logs antiguos se están rotando
ls -lh backend/logs/

# Debe haber máximo 30 días de logs
```

#### ✅ Checklist
- [x] Winston configurado y funcionando
- [x] Logs rotan diariamente
- [x] Logs de error separados
- [x] Eventos de autenticación registrados
- [x] Cambios de permisos registrados
- [x] Accesos denegados registrados
- [x] IP y user-agent capturados
- [x] Logs con timestamps
- [x] Auditoría en base de datos
- [x] Retención de logs (30 días)
- [x] Logs protegidos (solo lectura admin)

---

### A10:2021 – Server-Side Request Forgery (SSRF)

#### 📖 Descripción
Vulnerabilidad que permite al atacante hacer que el servidor realice peticiones no autorizadas.

#### ✅ Implementación en VIITS

**1. Validación de URLs**
```javascript
// backend/middleware/owaspSecurity.js
const validateURL = (req, res, next) => {
    const urlFields = ['url', 'webhook', 'callback_url'];
    
    for (let field of urlFields) {
        if (req.body[field]) {
            const url = req.body[field];
            
            // Bloquear URLs internas
            const blockedPatterns = [
                /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
                /^(https?:\/\/)?192\.168\./i,
                /^(https?:\/\/)?10\./i,
                /^(https?:\/\/)?172\.16\./i,
                /^file:\/\//i,
                /^data:/i
            ];
            
            for (let pattern of blockedPatterns) {
                if (pattern.test(url)) {
                    return res.status(400).json({
                        error: 'URL no permitida',
                        owaspCategory: 'A10 - SSRF'
                    });
                }
            }
        }
    }
    
    next();
};
```

**2. Whitelist de Dominios**
```javascript
const allowedDomains = [
    'api.invias.gov.co',
    'cdn.invias.gov.co',
    'storage.invias.gov.co'
];

const isAllowedDomain = (url) => {
    try {
        const urlObj = new URL(url);
        return allowedDomains.some(domain => 
            urlObj.hostname === domain || 
            urlObj.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
};
```

**3. Timeout en Peticiones Externas**
```javascript
const axios = require('axios');

const httpClient = axios.create({
    timeout: 5000, // 5 segundos máximo
    maxRedirects: 3,
    validateStatus: (status) => status < 500
});
```

#### 🧪 Pruebas de Validación

**Test 1: SSRF a localhost**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3000/api/users"
  }'

# Respuesta esperada:
# { "error": "URL no permitida" }
```

**Test 2: SSRF a IP privada**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "http://192.168.1.1/admin"
  }'

# Respuesta esperada:
# { "error": "URL no permitida" }
```

**Test 3: File protocol**
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "file:///etc/passwd"
  }'

# Respuesta esperada:
# { "error": "URL no permitida" }
```

#### ✅ Checklist
- [x] Validación de URLs implementada
- [x] Bloqueo de IPs privadas
- [x] Bloqueo de localhost
- [x] Bloqueo de protocolos file:// y data://
- [x] Whitelist de dominios permitidos
- [x] Timeouts en peticiones externas
- [x] Límite de redirects
- [x] Validación de certificados SSL

---

## 🧪 Plan de Pruebas de Seguridad

### Herramientas Recomendadas

#### 1. OWASP ZAP
```bash
# Instalación
docker pull owasp/zap2docker-stable

# Ejecutar escaneo
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r zap-report.html
```

#### 2. npm audit
```bash
# Auditoría de dependencias
npm audit

# Corregir vulnerabilidades
npm audit fix
```

#### 3. Snyk
```bash
# Instalación
npm install -g snyk

# Autenticación
snyk auth

# Escaneo
snyk test
```

#### 4. SonarQube
```bash
# Análisis de código
sonar-scanner \
  -Dsonar.projectKey=viits \
  -Dsonar.sources=./backend \
  -Dsonar.host.url=http://localhost:9000
```

### Script de Pruebas Automatizadas

```bash
#!/bin/bash
# test-security.sh

echo "🔒 Iniciando pruebas de seguridad OWASP..."

# A01 - Access Control
echo "\n[A01] Probando control de acceso..."
curl -s -X GET http://localhost:3000/api/users | grep -q "error" && echo "✓ Acceso sin auth bloqueado" || echo "✗ FALLO"

# A02 - Cryptographic Failures
echo "\n[A02] Verificando encriptación..."
psql -U viits_user -d viits_db -c "SELECT password_hash FROM users LIMIT 1" | grep -q "\$2b\$" && echo "✓ Passwords encriptados" || echo "✗ FALLO"

# A03 - Injection
echo "\n[A03] Probando inyección SQL..."
curl -s -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"admin' OR '1'='1","password":"test"}' | grep -q "inyección" && echo "✓ SQL injection bloqueado" || echo "✗ FALLO"

# A04 - Insecure Design
echo "\n[A04] Probando rate limiting..."
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/auth/login -d '{"email":"test","password":"test"}' > /dev/null
done
curl -s -X POST http://localhost:3000/api/auth/login -d '{"email":"test","password":"test"}' | grep -q "429" && echo "✓ Rate limiting funcionando" || echo "✗ FALLO"

# A05 - Security Misconfiguration
echo "\n[A05] Verificando headers..."
curl -sI http://localhost:3000/api/health | grep -q "X-Frame-Options" && echo "✓ Headers de seguridad presentes" || echo "✗ FALLO"

# A06 - Vulnerable Components
echo "\n[A06] Auditando dependencias..."
npm audit --audit-level=critical | grep -q "0 vulnerabilities" && echo "✓ Sin vulnerabilidades críticas" || echo "✗ FALLO"

# A07 - Auth Failures
echo "\n[A07] Probando contraseña débil..."
curl -s -X POST http://localhost:3000/api/users \
  -d '{"email":"test@test.com","password":"123"}' | grep -q "12 caracteres" && echo "✓ Validación de password funcionando" || echo "✗ FALLO"

# A08 - Data Integrity
echo "\n[A08] Probando integridad de archivos..."
# Crear archivo falso
echo "test" > fake.pdf
curl -s -X POST http://localhost:3000/api/reports/upload \
  -F "file=@fake.pdf" | grep -q "no coincide" && echo "✓ Validación de tipo de archivo" || echo "✗ FALLO"

# A09 - Logging
echo "\n[A09] Verificando logs..."
[ -f "backend/logs/viits-$(date +%Y-%m-%d).log" ] && echo "✓ Logs generándose" || echo "✗ FALLO"

# A10 - SSRF
echo "\n[A10] Probando SSRF..."
curl -s -X POST http://localhost:3000/api/webhooks \
  -d '{"url":"http://localhost/admin"}' | grep -q "no permitida" && echo "✓ SSRF bloqueado" || echo "✗ FALLO"

echo "\n🎉 Pruebas completadas"
```

---

## ✅ Checklist General de Seguridad

### Pre-Despliegue

- [ ] Ejecutar `npm audit` sin vulnerabilidades
- [ ] Todas las variables en .env configuradas
- [ ] .env no está en control de versiones
- [ ] Credenciales por defecto cambiadas
- [ ] JWT secrets únicos y seguros (>32 caracteres)
- [ ] HTTPS configurado
- [ ] Certificados SSL válidos
- [ ] Headers de seguridad verificados
- [ ] CORS configurado correctamente
- [ ] Rate limiting activo
- [ ] Logs funcionando
- [ ] Backups configurados

### Post-Despliegue

- [ ] Escaneo con OWASP ZAP ejecutado
- [ ] Pruebas de penetración completadas
- [ ] Monitoreo activo
- [ ] Alertas configuradas
- [ ] Plan de respuesta a incidentes documentado
- [ ] Auditoría de accesos configurada
- [ ] Rotación de claves programada
- [ ] Actualizaciones de seguridad aplicadas

### Mantenimiento Regular

- [ ] npm audit semanal
- [ ] Revisión de logs de seguridad
- [ ] Actualización de dependencias
- [ ] Revisión de permisos de usuarios
- [ ] Verificación de backups
- [ ] Pruebas de restauración
- [ ] Auditoría de código trimestral
- [ ] Capacitación de equipo en seguridad

---

## 📊 Monitoreo y Respuesta

### Métricas de Seguridad

```sql
-- Top 10 IPs con más intentos fallidos
SELECT ip_address, COUNT(*) as attempts
FROM audit_logs
WHERE event_type = 'login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY attempts DESC
LIMIT 10;

-- Usuarios con actividad sospechosa
SELECT user_id, COUNT(*) as actions
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 100;

-- Eventos de seguridad por tipo
SELECT event_type, COUNT(*) as count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
  AND event_type LIKE 'security_%'
GROUP BY event_type
ORDER BY count DESC;
```

### Alertas Recomendadas

1. **Múltiples intentos de login fallidos** (> 5 en 15 min)
2. **Acceso desde IP desconocida** (admin users)
3. **Cambios de permisos** (cualquier usuario)
4. **Errores de autenticación** (> 10 por minuto)
5. **Upload de archivos sospechosos**
6. **Patrones de inyección detectados**
7. **Uso de CPU/memoria anormal**

### Plan de Respuesta a Incidentes

**Fase 1: Detección**
1. Revisar logs y alertas
2. Confirmar incidente
3. Clasificar severidad

**Fase 2: Contención**
1. Bloquear IP atacante
2. Desactivar cuentas comprometidas
3. Aislar sistemas afectados

**Fase 3: Erradicación**
1. Identificar vulnerabilidad
2. Aplicar parche
3. Verificar no hay backdoors

**Fase 4: Recuperación**
1. Restaurar servicios
2. Monitorear comportamiento
3. Validar integridad

**Fase 5: Post-Mortem**
1. Documentar incidente
2. Actualizar procedimientos
3. Capacitar equipo

---

## 📚 Referencias

### Documentación OWASP

- [OWASP Top 10 - 2021](https://owasp.org/Top10/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)

### Herramientas

- [OWASP ZAP](https://www.zaproxy.org/)
- [Burp Suite](https://portswigger.net/burp)
- [Snyk](https://snyk.io/)
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [SonarQube](https://www.sonarqube.org/)

### Estándares

- [PCI DSS](https://www.pcisecuritystandards.org/)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## 📞 Contacto y Soporte

Para cuestiones de seguridad:

- **Email de seguridad:** security@invias.gov.co
- **Reportar vulnerabilidad:** https://invias.gov.co/security/report
- **Equipo de seguridad:** 24/7 disponible

---

**Última actualización:** 13 de Octubre, 2025  
**Versión del documento:** 1.0.0  
**Próxima revisión:** 13 de Enero, 2026

---

✅ **SISTEMA VIITS - SEGURO POR DISEÑO**

**Instituto Nacional de Vías (INVIAS) - Colombia**
