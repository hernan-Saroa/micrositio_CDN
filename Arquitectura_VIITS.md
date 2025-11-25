# Arquitectura del Proyecto VIITS

## Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad - INVIAS Colombia

Este documento describe la arquitectura del sistema VIITS (Vías Inteligentes ITS) desarrollado para el Instituto Nacional de Vías (INVIAS) de Colombia, especificando sus componentes principales, la interacción entre ellos y las tecnologías utilizadas.

### Diagrama de Arquitectura General

El diagrama representa la arquitectura de despliegue del sistema VIITS, mostrando la interacción entre los diferentes componentes, protocolos de comunicación y flujos de datos.

## Estructura de Directorios del Proyecto

La estructura de directorios del proyecto VIITS está organizada de manera modular para facilitar el desarrollo, mantenimiento y despliegue:

```
/Users/henrryrojas/Documents/SAROA/invias/micrositio-invias/
├── .DS_Store
├── .gitignore
├── 00-LEER-PRIMERO.md
├── Arquitectura del proyecto.docx
├── Arquitectura_VIITS.md
├── GUIA-DESPLIEGUE-COMPLETO.md
├── INICIAR-SERVIDOR.bat
├── iniciar-servidor.sh
├── INSTALACION-RAPIDA.md
├── INSTRUCCIONES-DESPLIEGUE-FINAL.txt
├── package-lock.json
├── package.json
├── QUICK-START.md
├── README-DESPLIEGUE.md
├── README-PRODUCCION.md
├── README.md
├── RESUMEN-TRABAJO-REALIZADO.txt
├── SEGURIDAD-OWASP.md
├── START-HERE.md
├── test-security-owasp.sh
├── VALIDACION-OWASP-IMPLEMENTADA.md
├── VERIFICACION-DESPLIEGUE.md
├── verificar-proyecto.sh
├── backend/
│   ├── .env
│   ├── .gitignore
│   ├── package-lock.json
│   ├── package.json
│   ├── schema.sql
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   ├── data/
│   │   └── catalogo_invias.xlsx
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── audit.js
│   │   ├── auth.js
│   │   ├── clickhouseserver.js
│   │   ├── downloads.js
│   │   ├── elastic.js
│   │   ├── reports.js
│   │   ├── slider.js
│   │   ├── sqlserver.js
│   │   ├── stats.js
│   │   └── users.js
│   └── utils/
│       ├── emailService.js
│       └── logger.js
└── frontend/
    ├── 00-INICIO-PROYECTO.html
    ├── admin-panel-functions.js
    ├── admin-panel.html
    ├── all-routes.js
    ├── BIENVENIDA.html
    ├── dashboard-sectores-viales.html
    ├── documentos.html
    ├── favicon.ico
    ├── INDEX-PROYECTO.html
    ├── index.html
    ├── INICIO-DESPLIEGUE.html
    ├── login.html
    ├── owaspSecurity.js
    ├── participacion-ciudadana.html
    ├── RESUMEN-DESPLIEGUE.html
    ├── SEGURIDAD-OWASP.html
    ├── images/
    │   ├── gov.co.png
    │   ├── gov.png
    │   ├── govco.png
    │   ├── logo_co_footer.png
    │   ├── logo_invias_nuevo.jpg
    │   ├── logo-mintransporte.png
    │   └── VIITS-LOGO.png
    ├── mnt/
    │   └── user-data/
    │       └── outputs/
    │           └── proyecto-viits/
    │               └── backend/
    │                   └── routes/
    │                       └── auth.js
    ├── scripts/
    │   ├── admin-panel.js
    │   ├── dashboard-sectores-viales.js
    │   ├── documentos.js
    │   ├── index.js
    │   ├── login.js
    │   └── participacion-ciudadana.js
    ├── static/
    │   ├── css/
    │   └── js/
    └── styles/
        ├── admin-panel.css
        ├── dashboard-sectores-viales.css
        ├── documentos.css
        ├── index.css
        ├── login.css
        └── participacion-ciudadana.css
```

### Descripción de Directorios Principales

**Directorio Raíz (/):**
- Archivos de documentación (README.md, GUIA-DESPLIEGUE-COMPLETO.md, etc.)
- Scripts de despliegue (iniciar-servidor.sh, verificar-proyecto.sh)
- Configuración del proyecto (package.json, .gitignore)
- Documentación de seguridad (SEGURIDAD-OWASP.md, VALIDACION-OWASP-IMPLEMENTADA.md)

**Backend (/backend):**
- `server.js`: Punto de entrada principal del servidor Node.js/Express
- `config/`: Configuraciones de base de datos y sistema
- `routes/`: Endpoints de la API REST organizados por funcionalidad
- `middleware/`: Middlewares de autenticación, validación y manejo de errores
- `utils/`: Utilidades como servicio de email y logging
- `data/`: Archivos de datos estáticos (catálogos, etc.)

**Frontend (/frontend):**
- Archivos HTML principales (index.html, login.html, admin-panel.html)
- `scripts/`: JavaScript vanilla para cada página
- `styles/`: CSS responsive para cada componente
- `images/`: Recursos gráficos e imágenes del sistema
- `static/`: Assets estáticos (CSS/JS compilados)

## Componentes Lógicos del Sistema

### 1. Actores Principales

**Usuario Administrador**: Persona que interactúa con el sistema a través del panel administrativo para gestionar usuarios, reportes, configuraciones y monitorear el sistema.

**Ciudadano**: Usuario público que accede al portal web para consultar información de tráfico, descargar reportes y participar en procesos ciudadanos.

**Sistema de Dispositivos ITS**: Dispositivos físicos (sensores, cámaras, balanzas) que capturan datos de tráfico en tiempo real y los envían al sistema.

**Sistemas Externos**: ClickHouse (analytics), Elasticsearch (búsqueda), SQL Server (datos legacy) que proporcionan datos al sistema.

### 2. Infraestructura del Sistema

**Servidor Web (Node.js/Express API)**

- Gestiona todas las solicitudes HTTP de usuarios y sistemas externos
- Procesa y valida datos antes de almacenarlos o servirlos
- Implementa middleware de seguridad y autenticación

**Autenticación JWT**: Implementa autenticación segura con tokens JWT y sesiones persistentes.

**Procesamiento de Datos**: Convierte y valida datos de tráfico, genera KPIs y reportes.

**Bases de Datos**

- **PostgreSQL**: Almacena usuarios, sesiones, configuraciones, logs de auditoría y metadatos del sistema
- **ClickHouse**: Fuente de datos analíticos de tráfico en tiempo real para consultas de alto rendimiento
- **Elasticsearch**: Índice de búsqueda para consultas complejas y full-text search
- **SQL Server**: Integración con sistemas legacy de INVIAS

### 3. Integración con Sistemas Externos

El sistema VIITS se integra con múltiples fuentes de datos:

**ClickHouse**: Para consultas analíticas de tráfico con agregaciones complejas.

**Elasticsearch**: Para búsqueda avanzada y análisis de patrones.

**SQL Server**: Para acceso a datos históricos y legacy.

**Email Service**: Para notificaciones y recuperación de contraseñas.

### 4. Flujo de Comunicación

El **Usuario Administrador** envía solicitudes al servidor web (Node.js API) para autenticación y gestión mediante HTTPS (Puerto 3000).

Los **Ciudadanos** acceden al portal público mediante HTTPS para consultar datos y descargar información.

Los **Dispositivos ITS** envían datos en formato JSON a la API mediante HTTPS.

El **Servidor Web** autentica solicitudes usando JWT y delega consultas a las bases de datos especializadas:

- PostgreSQL (Puerto 5432) para datos transaccionales
- ClickHouse (Puerto 8123) para analytics
- Elasticsearch (Puerto 9200) para búsqueda

### 5. Patrones de Diseño

**Modelo Vista Controlador (MVC)**: Organiza la lógica del backend en rutas, controladores y modelos.

**Arquitectura Modular**: Separación clara entre rutas, middleware, servicios y utilidades.

**Repository Pattern**: Abstracción del acceso a datos con funciones helper.

**Middleware Chain**: Procesamiento secuencial de solicitudes con autenticación, validación y logging.

### 6. Infraestructura

**Despliegue en Contenedores**: Recomendado usar Docker para facilitar despliegue y escalabilidad.

**Servidores**: Puede desplegarse en servidores locales o en la nube (AWS, GCP, Azure).

**Balanceo de Carga**: Para alta disponibilidad con múltiples instancias.

**Seguridad**: Uso de HTTPS, CORS, rate limiting y encriptación de datos sensibles.

## Modelo de Caching y Procesamiento Asíncrono

El sistema implementa un modelo híbrido de caching y procesamiento optimizado:

### a. Componentes del Modelo

| Elemento | Descripción |
|----------|-------------|
| localStorage | Cache del lado cliente para KPIs y datos de gráficas |
| PostgreSQL Pool | Pool de conexiones para datos transaccionales |
| ClickHouse | Base de datos columnar para analytics de alto rendimiento |
| Redis (Planeado) | Cache distribuido para sesiones y datos frecuentes |

### b. Funcionamiento

**Carga Inicial**: Los datos se cargan desde cache local (localStorage) primero, luego del endpoint.

**Actualización**: Las consultas a ClickHouse se ejecutan con filtros dinámicos por departamento, métrica y período.

**Persistencia**: Los resultados se almacenan en localStorage con TTL para evitar consultas repetidas.

### c. Ventajas del Modelo

- **Performance**: Respuestas rápidas mediante cache local
- **Escalabilidad**: Separación de cargas entre bases de datos especializadas
- **Confiabilidad**: Fallback a datos cacheados si falla la conexión
- **Eficiencia**: Consultas optimizadas según el tipo de dato requerido

## Procesos Implementados en el Sistema

En esta sección se describen los procesos implementados en el sistema VIITS para garantizar el flujo eficiente de la información y la correcta integración con los sistemas de datos de INVIAS. Estos procesos han sido diseñados para automatizar la autenticación, gestión de datos, generación de reportes y análisis de tráfico en tiempo real.

### Autenticación y Gestión de Usuarios

**Descripción breve**: Este proceso permite establecer sesiones seguras de autenticación para usuarios administradores y ciudadanos registrados.

**Descripción general**: El proceso de autenticación implementa JWT con sesiones persistentes, verificación de email, recuperación de contraseña y soporte para 2FA. Incluye validación de roles y permisos.

**Datos requeridos**:
- Credenciales de usuario (email, password)
- Información de sesión (IP, User-Agent)
- Tokens JWT y refresh tokens

### Consulta de Datos Analíticos

**Descripción breve**: Este proceso permite obtener métricas de tráfico y KPIs desde múltiples fuentes de datos.

**Descripción general**: El sistema consulta datos desde ClickHouse para análisis en tiempo real, con agregaciones por departamento, período y tipo de vehículo. Incluye filtros dinámicos y caching inteligente.

**Datos requeridos**:
- Parámetros de consulta (fechas, departamento, métrica)
- Credenciales de base de datos
- Filtros de agregación

### Procesamiento de Reportes

**Descripción breve**: Este proceso genera y gestiona reportes públicos y administrativos.

**Descripción general**: Los reportes se generan desde datos consolidados, con opciones de descarga en PDF y Excel. Incluye estadísticas de uso y versionado.

**Datos requeridos**:
- Datos fuente para el reporte
- Parámetros de formato y filtros
- Metadatos del reporte

### Gestión de Contenido Dinámico

**Descripción breve**: Este proceso administra el contenido del slider y elementos dinámicos del portal.

**Descripción general**: El contenido se almacena en PostgreSQL y se sirve dinámicamente al frontend, permitiendo actualizaciones en tiempo real sin redeploy.

**Datos requeridos**:
- Contenido multimedia (imágenes, texto)
- Metadatos de posición y activación
- Configuración de visualización

### Auditoría y Monitoreo

**Descripción breve**: Este proceso registra todas las acciones del sistema para trazabilidad y seguridad.

**Descripción general**: Cada acción se registra en logs de auditoría con información completa del usuario, acción, timestamp y resultado.

**Datos requeridos**:
- Información del usuario
- Detalles de la acción realizada
- Contexto de la solicitud (IP, User-Agent)

## Métodos del Sistema (API Endpoints)

En esta sección se describen los métodos expuestos por la API REST del sistema VIITS.

| Proceso | Descripción | Ubicación | Método/Endpoint |
|---------|-------------|-----------|-----------------|
| Autenticación | Login con JWT | `routes/auth.js` | `POST /api/auth/login` |
| Verificación Token | Validar sesión activa | `routes/auth.js` | `GET /api/auth/verify-token` |
| Gestión Usuarios | CRUD de usuarios | `routes/users.js` | `GET/POST/PUT/DELETE /api/users` |
| Consulta KPIs | Datos analíticos | `routes/clickhouseserver.js` | `GET /api/clickhouse/road-analysis-dashboard` |
| Gestión Reportes | CRUD de reportes | `routes/reports.js` | `GET/POST /api/reports` |
| Contenido Slider | Gestión de slides | `routes/slider.js` | `GET/POST /api/slider` |
| Auditoría | Logs del sistema | `routes/audit.js` | `GET /api/audit` |
| Descargas | Gestión de archivos | `routes/downloads.js` | `GET /api/downloads` |

## Gestión de Errores y Resiliencia

### Manejo de Excepciones

Todos los endpoints están envueltos en middleware de manejo de errores que capturan y registran excepciones comunes:

- **ValidationError**: Datos inválidos en requests
- **AuthenticationError**: Credenciales incorrectas
- **DatabaseError**: Fallos de conexión a BD
- **ExternalServiceError**: Fallos en integraciones

### Estrategias de Resiliencia

**a. Caching por Capas**
- Frontend: localStorage para datos de usuario
- Backend: Planeado Redis para sesiones
- Base de datos: Connection pooling

**b. Reintentos Automáticos**
- Consultas fallidas se reintentan con backoff exponencial
- Fallback a datos cacheados cuando falla la conexión

**c. Logging Estructurado**
- Winston para logging con rotación diaria
- Niveles: error, warn, info, debug
- Logs de auditoría en base de datos

**d. Health Checks**
- Endpoint `/api/health` para monitoreo del sistema
- Verificación de conexiones a bases de datos
- Métricas de uptime y performance

## Conclusiones

La arquitectura del sistema VIITS está diseñada para garantizar modularidad, escalabilidad y eficiencia en la gestión de datos de tráfico e infraestructura vial. La separación clara entre backend y frontend, junto con el uso de bases de datos especializadas, permite un sistema robusto y performant.

**Puntos Fuertes:**
- Arquitectura modular con responsabilidades claras
- Integración con múltiples fuentes de datos
- Seguridad avanzada con autenticación JWT y auditoría
- Interfaz responsive y accesible
- Caching inteligente para optimización de performance

**Recomendaciones:**
- Implementar Redis para caching distribuido
- Agregar monitoreo con herramientas como Prometheus/Grafana
- Considerar migración a framework moderno (React/Vue) para el frontend
- Implementar CI/CD para despliegues automatizados

Este sistema garantiza la transmisión, procesamiento y visualización segura de datos de tráfico, asegurando trazabilidad, autenticación robusta y análisis eficiente de la infraestructura vial colombiana.