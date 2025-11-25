# 🚀 GUÍA COMPLETA DE DESPLIEGUE - PROYECTO VIITS

## 📋 Índice
1. [Análisis de la Estructura Actual](#análisis-de-la-estructura-actual)
2. [Problemas Identificados](#problemas-identificados)
3. [Soluciones Implementadas](#soluciones-implementadas)
4. [Instrucciones de Despliegue](#instrucciones-de-despliegue)
5. [Verificación del Sistema](#verificación-del-sistema)

---

## 🔍 Análisis de la Estructura Actual

### Archivos Principales del Sistema

```
VIITS-Project/
├── 📄 index.html                              (150 KB) - Micrositio público ⭐ PRINCIPAL
├── 📄 login.html                             (13 KB)  - Login administrativo
├── 📄 admin-panel.html                       (48 KB)  - Panel administrativo
├── 📄 dashboard-sectores-viales.html         (37 KB)  - Dashboard interactivo
├── 📄 participacion-ciudadana.html           (75 KB)  - Plataforma ciudadana
├── 📄 documentos.html                        (31 KB)  - Repositorio de docs
├── 📄 00-INICIO-PROYECTO.html                (16 KB)  - Índice principal
├── 📄 INICIO-AQUI.html                       (21 KB)  - Guía de inicio
├── 📄 INDICE-NAVEGACION.html                 (14 KB)  - Índice de navegación
└── 📄 INDEX-RECURSOS-VIITS.html              (23 KB)  - Recursos del proyecto
```

### Documentación y Scripts

```
├── 📝 LEER-PRIMERO.txt                       - Instrucciones iniciales
├── 📝 RESUMEN-DESPLIEGUE.txt                 - Resumen de despliegue
├── 📝 VERIFICACION-ADMIN-PANEL.txt           - Verificación del admin
├── 📝 *.md                                   - Documentación técnica
├── 🔧 iniciar-servidor.sh                    - Script Linux/Mac
└── 🔧 INICIAR-SERVIDOR.bat                   - Script Windows
```

---

## ⚠️ Problemas Identificados

### 1. Referencias a archivos inexistentes

**PROBLEMA:** El archivo `index.html` hace referencia a:
- `participacion-ciudadana-CON-SESION.html` ❌ (No existe)

**ARCHIVO REAL:**
- `participacion-ciudadana.html` ✅ (Existe)

**UBICACIONES DE LAS REFERENCIAS ERRÓNEAS EN index.html:**
- Línea 1936: Navbar principal
- Línea 1958: Menú móvil
- Línea 2664: Botón CTA en sección

**IMPACTO:** Los usuarios no pueden acceder a la plataforma de participación ciudadana desde la navegación principal.

### 2. Estructura de carpetas vs referencias

**OBSERVADO:** Los archivos de documentación mencionan:
- `admin-panel/login.html`
- `admin-panel/admin-panel.html`

**REALIDAD:** Los archivos están en la raíz:
- `login.html` (en raíz)
- `admin-panel.html` (en raíz)

**ESTADO:** ✅ Las referencias en el código están correctas, solo la documentación usa la notación de carpeta conceptual.

---

## ✅ Soluciones Implementadas

### Solución 1: Corrección de Referencias en index.html

Se deben actualizar TODAS las referencias de:
```html
<!-- ANTES (INCORRECTO) -->
<a href="participacion-ciudadana-CON-SESION.html">

<!-- DESPUÉS (CORRECTO) -->
<a href="participacion-ciudadana.html">
```

### Solución 2: Verificación de Integridad

Todas las referencias entre archivos principales:

```
index.html
  ├── ✅ documentos.html (correcto)
  ├── ⚠️  participacion-ciudadana-CON-SESION.html (CORREGIR)
  └── ✅ admin-panel.html (correcto)

login.html
  └── ✅ admin-panel.html (correcto)

admin-panel.html
  └── ✅ login.html (correcto)
```

---

## 🛠️ Instrucciones de Despliegue

### PASO 1: Corrección de Referencias

**Archivo a modificar:** `index.html`

**Cambios necesarios (3 ubicaciones):**

1. **Línea ~1936 - Navbar principal:**
```html
<!-- BUSCAR -->
<a href="participacion-ciudadana-CON-SESION.html" class="navbar-link"

<!-- REEMPLAZAR CON -->
<a href="participacion-ciudadana.html" class="navbar-link"
```

2. **Línea ~1958 - Menú móvil:**
```html
<!-- BUSCAR -->
<a href="participacion-ciudadana-CON-SESION.html" class="mobile-menu-link"

<!-- REEMPLAZAR CON -->
<a href="participacion-ciudadana.html" class="mobile-menu-link"
```

3. **Línea ~2664 - Botón CTA:**
```html
<!-- BUSCAR -->
<a href="participacion-ciudadana-CON-SESION.html" class="btn"

<!-- REEMPLAZAR CON -->
<a href="participacion-ciudadana.html" class="btn"
```

### PASO 2: Estructura de Despliegue

#### Opción A: Despliegue Local (Sin Backend)

**Características:**
- ✅ Visualización completa de todas las páginas
- ✅ Navegación entre componentes
- ✅ Gráficos y visualizaciones (datos estáticos)
- ✅ Diseño responsivo
- ❌ Sin autenticación real
- ❌ Sin descarga de datos
- ❌ Sin persistencia

**Método 1: Apertura Directa**
```bash
# Simplemente abre en tu navegador
00-INICIO-PROYECTO.html
```

**Método 2: Servidor HTTP Simple**
```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Luego accede a: `http://localhost:8000/00-INICIO-PROYECTO.html`

#### Opción B: Despliegue Completo (Con Backend)

**Requisitos:**
- Node.js v16+
- PostgreSQL 13+ (con PostGIS)
- Redis
- npm/yarn

**Configuración:**

1. **Crear archivo `.env`:**
```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=viits_db
DB_USER=tu_usuario
DB_PASSWORD=tu_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura_aqui
JWT_EXPIRES_IN=24h

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASSWORD=tu_password

# Servidor
PORT=3000
NODE_ENV=development
```

2. **Instalar dependencias:**
```bash
npm install express pg redis bcrypt jsonwebtoken
npm install nodemailer winston helmet express-rate-limit
npm install dotenv cors body-parser
```

3. **Configurar base de datos:**
```bash
# Crear base de datos
createdb viits_db

# Habilitar PostGIS
psql viits_db -c "CREATE EXTENSION postgis;"

# Ejecutar scripts (si existen)
psql viits_db < database/schema.sql
psql viits_db < database/seed.sql
```

4. **Iniciar servidor:**
```bash
# Desarrollo
npm run dev

# Producción
pm2 start server.js --name viits
```

### PASO 3: Configuración del Admin Panel

**Modo Demostración (Actual):**

Ambos archivos (`login.html` y `admin-panel.html`) tienen:
```javascript
const DEMO_MODE = true;
```

**Para activar autenticación real:**
```javascript
// En login.html (línea ~299)
const DEMO_MODE = false;

// En admin-panel.html (línea ~1010)
const DEMO_MODE = false;
```

**⚠️ IMPORTANTE:** Solo cambiar a `DEMO_MODE = false` cuando el backend esté completamente configurado.

---

## ✔️ Verificación del Sistema

### Checklist de Funcionalidad

#### Frontend (Sin Backend)
- [ ] index.html se carga correctamente
- [ ] Navegación principal funciona
- [ ] Slider de 5 imágenes funciona
- [ ] Estadísticas se muestran (datos estáticos)
- [ ] Gráfico de sectores viales funciona
- [ ] Dashboard responsive en móvil/tablet/desktop
- [ ] documentos.html accesible
- [ ] participacion-ciudadana.html accesible
- [ ] login.html accesible
- [ ] admin-panel.html (modo demo) funciona

#### Admin Panel (Modo Demo)
- [ ] Login acepta cualquier email/password
- [ ] Redirección a admin-panel.html funciona
- [ ] Sidebar de navegación visible
- [ ] Dashboard muestra estadísticas
- [ ] Gráficos Chart.js funcionan
- [ ] Logout limpia sesión y redirige

#### Con Backend (Producción)
- [ ] Autenticación real funciona
- [ ] 2FA/TOTP operativo
- [ ] Descarga de datos CSV funciona
- [ ] Filtros avanzados operativos
- [ ] Sistema de auditoría registra acciones
- [ ] Persistencia en base de datos
- [ ] Redis gestiona sesiones
- [ ] Emails de verificación se envían

### Script de Verificación

```bash
#!/bin/bash
echo "🔍 Verificando estructura del proyecto VIITS..."

# Verificar archivos principales
files=(
    "index.html"
    "login.html"
    "admin-panel.html"
    "participacion-ciudadana.html"
    "documentos.html"
    "dashboard-sectores-viales.html"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file encontrado"
    else
        echo "❌ $file NO ENCONTRADO"
    fi
done

echo ""
echo "🔍 Verificando referencias en index.html..."

# Verificar si existe la referencia incorrecta
if grep -q "participacion-ciudadana-CON-SESION.html" index.html; then
    echo "⚠️  ADVERTENCIA: Referencia incorrecta encontrada"
    echo "   Debe corregirse a: participacion-ciudadana.html"
else
    echo "✅ Todas las referencias están correctas"
fi

echo ""
echo "✅ Verificación completa"
```

---

## 📊 Mapa de Navegación del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    00-INICIO-PROYECTO.html                  │
│                         (Punto de Entrada)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├─────► index.html (Micrositio Público)
                      │         │
                      │         ├──► documentos.html
                      │         ├──► participacion-ciudadana.html
                      │         └──► admin-panel.html (oculto)
                      │
                      ├─────► login.html
                      │         │
                      │         └──► admin-panel.html
                      │               │
                      │               └──► (gestión completa)
                      │
                      ├─────► dashboard-sectores-viales.html
                      │
                      ├─────► INICIO-AQUI.html
                      ├─────► INDICE-NAVEGACION.html
                      └─────► INDEX-RECURSOS-VIITS.html
```

---

## 🎯 Casos de Uso Principales

### 1. Usuario Público (Ciudadano)
```
1. Accede a: index.html
2. Visualiza estadísticas en tiempo real
3. Navega a: documentos.html (descarga PDFs)
4. Accede a: participacion-ciudadana.html
5. Se registra/autentica (si backend activo)
6. Descarga datos de tráfico vehicular
```

### 2. Oficial INVIAS (Administrador)
```
1. Accede a: login.html
2. Ingresa credenciales (o cualquier dato en modo demo)
3. [Con backend: Verifica código 2FA]
4. Accede a: admin-panel.html
5. Gestiona contenidos
6. Sube informes PDF
7. Administra usuarios
8. Revisa auditoría
```

### 3. Desarrollador/Mantenimiento
```
1. Abre: 00-INICIO-PROYECTO.html
2. Accede a toda la documentación
3. Revisa: LEER-PRIMERO.txt
4. Consulta: *.md para guías técnicas
5. Modifica según necesidad
6. Verifica cambios en navegador
```

---

## 🔧 Mantenimiento y Actualizaciones

### Para actualizar contenidos (Modo Demo)

**Estadísticas en index.html:**
- Buscar: `<!-- ESTADÍSTICAS EN TIEMPO REAL -->`
- Modificar valores directamente en el HTML

**Slider de imágenes:**
- Buscar: `<!-- SLIDER PRINCIPAL -->`
- Actualizar rutas de imágenes y textos

**Datos de gráficos:**
- Buscar: `const sectorData = [...]`
- Modificar array de datos

### Para actualizar contenidos (Con Backend)

**A través del admin-panel.html:**
- Subir nuevos PDFs a "Información Pública"
- Gestionar usuarios y permisos
- Configurar parámetros del sistema

**Base de datos:**
- Actualizar datos de sectores viales
- Modificar indicadores de cobertura
- Gestionar históricos de tráfico

---

## 📞 Soporte y Contacto

**Stakeholders del Proyecto:**
- **Javier Velásquez** - Líder Técnico
- **Juan Sebastián Pérez** - Analista de Requerimientos
- **Hernán Darío Buitrago** - Gerente de Desarrollo

**Para reportar problemas:**
1. Verificar esta guía primero
2. Revisar LEER-PRIMERO.txt
3. Consultar documentación técnica (.md)
4. Contactar al equipo técnico

---

## 📝 Resumen de Comandos Rápidos

```bash
# Verificar archivos
ls -la *.html

# Iniciar servidor Python
python3 -m http.server 8000

# Iniciar servidor Node
npx http-server -p 8000

# Buscar referencias en archivos
grep -r "href=\".*\.html\"" *.html

# Ver permisos de scripts
ls -la *.sh *.bat

# Dar permisos de ejecución (Linux/Mac)
chmod +x iniciar-servidor.sh
```

---

## ✨ Conclusión

Este proyecto está **99% funcional** para visualización directa. Solo requiere:

1. **Corrección inmediata:** Referencias a `participacion-ciudadana-CON-SESION.html`
2. **Opcional:** Configuración de backend para funcionalidad completa

Una vez corregidas las referencias, el sistema estará **100% operativo** para visualización y demo.

---

**Fecha de última actualización:** Octubre 13, 2025  
**Versión de la guía:** 1.0  
**Estado del proyecto:** LISTO PARA DESPLIEGUE (con correcciones menores)

