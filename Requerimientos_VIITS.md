# Requerimientos del Sistema VIITS

## Sistema de Vigilancia Inteligente de Infraestructura de Transporte y Seguridad - INVIAS Colombia

Este documento especifica los requerimientos funcionales y no funcionales del sistema VIITS (Vías Inteligentes ITS), desarrollado para el Instituto Nacional de Vías (INVIAS) de Colombia.

---

## 1. Requerimientos Funcionales

### 1.1 Gestión de Usuarios y Autenticación

#### RF-001: Registro de Usuarios
**Descripción**: El sistema debe permitir el registro de nuevos usuarios ciudadanos mediante verificación de email.
**Actores**: Ciudadano
**Precondiciones**: Email válido no registrado previamente
**Postcondiciones**: Usuario creado con rol 'user', email enviado para verificación
**Requerimientos relacionados**: RF-002, RF-003

#### RF-002: Autenticación JWT
**Descripción**: El sistema debe implementar autenticación basada en tokens JWT con sesiones persistentes.
**Actores**: Usuario Administrador, Ciudadano
**Precondiciones**: Credenciales válidas
**Postcondiciones**: Token JWT generado, sesión creada en base de datos

#### RF-003: Recuperación de Contraseña
**Descripción**: Los usuarios deben poder recuperar su contraseña mediante código enviado por email.
**Actores**: Usuario Administrador, Ciudadano
**Precondiciones**: Email registrado en el sistema
**Postcondiciones**: Código de 6 dígitos enviado, contraseña actualizable

#### RF-004: Gestión de Roles y Permisos
**Descripción**: El sistema debe gestionar diferentes roles (admin, user) con permisos específicos.
**Actores**: Usuario Administrador
**Precondiciones**: Usuario autenticado con rol admin
**Postcondiciones**: Roles asignados correctamente

### 1.2 Portal Público y Visualización de Datos

#### RF-005: Dashboard de Tráfico Público
**Descripción**: Los ciudadanos deben poder visualizar métricas de tráfico en tiempo real mediante gráficos interactivos.
**Actores**: Ciudadano
**Precondiciones**: Acceso al portal público
**Postcondiciones**: KPIs y gráficos mostrados con filtros por departamento, período y tipo de vehículo

#### RF-006: Filtros Dinámicos
**Descripción**: El sistema debe permitir filtrar datos por departamento, período, métrica y tipo de vehículo.
**Actores**: Ciudadano, Usuario Administrador
**Precondiciones**: Datos disponibles en el sistema
**Postcondiciones**: Datos filtrados y actualizados en tiempo real

#### RF-007: Descarga de Reportes
**Descripción**: Los usuarios deben poder descargar reportes en formato PDF con estadísticas de tráfico.
**Actores**: Ciudadano, Usuario Administrador
**Precondiciones**: Reporte generado
**Postcondiciones**: Archivo PDF descargado, contador de descargas actualizado

### 1.3 Panel Administrativo

#### RF-008: Gestión de Contenido del Slider
**Descripción**: Los administradores deben poder gestionar imágenes y contenido dinámico del slider principal.
**Actores**: Usuario Administrador
**Precondiciones**: Usuario con rol admin autenticado
**Postcondiciones**: Contenido del slider actualizado en base de datos

#### RF-009: Auditoría de Acciones
**Descripción**: Todas las acciones de los usuarios deben registrarse en logs de auditoría.
**Actores**: Sistema
**Precondiciones**: Acción realizada por usuario
**Postcondiciones**: Registro creado en tabla audit_logs con timestamp, IP y detalles

#### RF-010: Gestión de Usuarios Administrativos
**Descripción**: Los administradores deben poder crear, editar y desactivar cuentas de usuario.
**Actores**: Usuario Administrador
**Precondiciones**: Rol admin
**Postcondiciones**: Usuarios gestionados en base de datos

### 1.4 Integración con Fuentes de Datos

#### RF-011: Consulta a ClickHouse
**Descripción**: El sistema debe consultar métricas de tráfico desde base de datos ClickHouse.
**Actores**: Sistema
**Precondiciones**: Conexión a ClickHouse disponible
**Postcondiciones**: Datos analíticos obtenidos y procesados

#### RF-012: Búsqueda en Elasticsearch
**Descripción**: El sistema debe permitir búsquedas avanzadas mediante Elasticsearch.
**Actores**: Usuario Administrador
**Precondiciones**: Datos indexados en Elasticsearch
**Postcondiciones**: Resultados de búsqueda retornados

#### RF-013: Conexión a SQL Server
**Descripción**: El sistema debe integrar datos legacy desde SQL Server de INVIAS.
**Actores**: Sistema
**Precondiciones**: Credenciales válidas para SQL Server
**Postcondiciones**: Datos legacy accesibles

### 1.5 Participación Ciudadana

#### RF-014: Portal de Participación
**Descripción**: Los ciudadanos deben poder acceder a información pública y participar en procesos ciudadanos.
**Actores**: Ciudadano
**Precondiciones**: Acceso al portal
**Postcondiciones**: Información pública disponible, formularios de participación accesibles

---

## 2. Requerimientos No Funcionales

### 2.1 Rendimiento

#### RNF-001: Tiempo de Respuesta
**Descripción**: Las consultas al dashboard deben responder en menos de 3 segundos.
**Métrica**: Tiempo de respuesta < 3s para 95% de las consultas
**Medición**: Logs de respuesta del servidor

#### RNF-002: Capacidad Concurrente
**Descripción**: El sistema debe soportar al menos 100 usuarios concurrentes.
**Métrica**: 100 usuarios simultáneos sin degradación significativa
**Medición**: Pruebas de carga con JMeter

#### RNF-003: Disponibilidad del Sistema
**Descripción**: El sistema debe tener una disponibilidad del 99.9% mensual.
**Métrica**: Uptime > 99.9%
**Medición**: Monitoreo continuo con health checks

### 2.2 Seguridad

#### RNF-004: Encriptación de Datos
**Descripción**: Todos los datos sensibles deben estar encriptados en tránsito y en reposo.
**Estándar**: TLS 1.3 para transporte, AES-256 para datos en reposo
**Medición**: Auditorías de seguridad OWASP

#### RNF-005: Control de Acceso
**Descripción**: Implementar principio de menor privilegio con autenticación multifactor.
**Estándar**: JWT + sesiones persistentes + 2FA opcional
**Medición**: Pruebas de penetración

#### RNF-006: Rate Limiting
**Descripción**: Limitar peticiones por IP para prevenir ataques DoS.
**Métrica**: Máximo 100 peticiones por IP cada 15 minutos
**Medición**: Logs de rate limiting

### 2.3 Usabilidad

#### RNF-007: Accesibilidad Web
**Descripción**: El portal debe cumplir con estándares WCAG 2.1 nivel AA.
**Estándar**: Etiquetas ARIA, navegación por teclado, contraste adecuado
**Medición**: Auditorías de accesibilidad

#### RNF-008: Compatibilidad de Navegadores
**Descripción**: Soporte para navegadores modernos (Chrome, Firefox, Safari, Edge).
**Estándar**: Funcionalidad completa en versiones actuales
**Medición**: Pruebas cross-browser

#### RNF-009: Diseño Responsive
**Descripción**: La interfaz debe adaptarse a dispositivos móviles y desktop.
**Estándar**: Breakpoints para móvil, tablet y desktop
**Medición**: Pruebas en diferentes dispositivos

### 2.4 Mantenibilidad

#### RNF-010: Documentación del Código
**Descripción**: Todo el código debe estar documentado con JSDoc y comentarios.
**Estándar**: Cobertura de documentación > 80%
**Medición**: Herramientas de análisis de código

#### RNF-011: Modularidad
**Descripción**: Arquitectura modular con separación clara de responsabilidades.
**Estándar**: Principios SOLID aplicados
**Medición**: Análisis de acoplamiento y cohesión

#### RNF-012: Logging Estructurado
**Descripción**: Sistema de logging con niveles y rotación automática.
**Estándar**: Winston con niveles error, warn, info, debug
**Medición**: Logs disponibles para troubleshooting

### 2.5 Escalabilidad

#### RNF-013: Arquitectura Horizontal
**Descripción**: El sistema debe poder escalar horizontalmente con múltiples instancias.
**Estándar**: Stateless design, external session storage
**Medición**: Pruebas de escalabilidad

#### RNF-014: Optimización de Base de Datos
**Descripción**: Consultas optimizadas con índices apropiados.
**Estándar**: Tiempo de consulta < 1s para operaciones comunes
**Medición**: Query profiling

---

## 3. Casos de Uso

### CU-001: Acceso al Portal Público
**Actores**: Ciudadano
**Precondiciones**: Usuario accede al sitio web
**Flujo Principal**:
1. Usuario ingresa a la URL principal
2. Sistema carga página index.html
3. Slider dinámico se carga desde base de datos
4. Dashboard muestra KPIs por defecto
5. Usuario puede aplicar filtros

**Flujo Alternativo**:
- Si no hay conexión a BD, mostrar slider estático

### CU-002: Autenticación de Administrador
**Actores**: Usuario Administrador
**Precondiciones**: Usuario tiene credenciales válidas
**Flujo Principal**:
1. Usuario accede a /admin
2. Ingresa email y contraseña
3. Sistema valida credenciales en PostgreSQL
4. Genera token JWT
5. Redirige a panel administrativo

**Excepciones**:
- Credenciales inválidas: mostrar mensaje de error
- Cuenta inactiva: mostrar mensaje de desactivación

### CU-003: Consulta de Datos Analíticos
**Actores**: Ciudadano, Usuario Administrador
**Precondiciones**: Usuario accede al dashboard
**Flujo Principal**:
1. Usuario selecciona filtros (departamento, período, métrica)
2. Sistema consulta ClickHouse con parámetros
3. Datos se procesan y muestran en gráficos Chart.js
4. Usuario puede hacer drill-down en barras del gráfico

**Flujo Alternativo**:
- Si falla conexión a ClickHouse, usar datos cacheados

### CU-004: Gestión de Contenido
**Actores**: Usuario Administrador
**Precondiciones**: Usuario autenticado con rol admin
**Flujo Principal**:
1. Admin accede al panel administrativo
2. Selecciona gestión de slider
3. Sube nueva imagen con título y descripción
4. Sistema guarda en PostgreSQL y actualiza orden
5. Contenido se refleja inmediatamente en el portal

### CU-005: Descarga de Reportes
**Actores**: Ciudadano
**Precondiciones**: Usuario en sección de documentos
**Flujo Principal**:
1. Usuario hace clic en botón de descarga
2. Sistema registra la descarga en base de datos
3. Incrementa contador de descargas
4. Inicia descarga del archivo PDF

---

## 4. Requerimientos de Usuario

### 4.1 Perfiles de Usuario

#### Ciudadano
- **Necesidades**: Acceder a información pública de tráfico, descargar reportes, participar en consultas ciudadanas
- **Conocimientos técnicos**: Básicos, navegación web estándar
- **Frecuencia de uso**: Ocasional, según necesidad de información

#### Administrador del Sistema
- **Necesidades**: Gestionar usuarios, contenido, monitorear sistema, revisar auditorías
- **Conocimientos técnicos**: Avanzados, familiarizado con interfaces administrativas
- **Frecuencia de uso**: Diaria, tareas de mantenimiento

### 4.2 Interfaces de Usuario

#### IU-001: Portal Público
- Diseño moderno y accesible
- Navegación intuitiva con menú responsive
- Dashboard con gráficos interactivos
- Formularios simples para participación ciudadana

#### IU-002: Panel Administrativo
- Interfaz de gestión con CRUD operations
- Formularios de carga de archivos
- Tablas de datos con paginación
- Logs de auditoría consultables

---

## 5. Requerimientos Técnicos

### 5.1 Tecnologías del Sistema

#### Backend
- **Lenguaje**: Node.js versión 16+
- **Framework**: Express.js 4.18+
- **Base de datos principal**: PostgreSQL 13+
- **Base de datos analítica**: ClickHouse 23+
- **Búsqueda**: Elasticsearch 8+
- **Cache**: Redis (planeado)
- **Autenticación**: JWT, bcrypt para hashing

#### Frontend
- **Lenguaje**: JavaScript ES6+
- **Frameworks**: Vanilla JS (sin frameworks)
- **Visualización**: Chart.js 4+
- **Estilos**: CSS3 con Grid y Flexbox
- **Accesibilidad**: ARIA labels, navegación por teclado

### 5.2 Infraestructura

#### Servidor
- **SO**: Linux (Ubuntu 20.04+)
- **CPU**: 2 vCPU mínimo
- **RAM**: 4GB mínimo
- **Almacenamiento**: 50GB SSD
- **Red**: 100Mbps+

#### Bases de Datos Externas
- **ClickHouse**: Instancia dedicada para analytics
- **Elasticsearch**: Cluster para búsqueda
- **SQL Server**: Base de datos legacy INVIAS

### 5.3 APIs y Integraciones

#### API REST
- **Base URL**: /api/v1
- **Autenticación**: Bearer tokens
- **Formato**: JSON
- **Versionado**: En URL path

#### Endpoints Principales
- `GET /api/health` - Health check
- `POST /api/auth/login` - Autenticación
- `GET /api/clickhouse/road-analysis-dashboard` - Datos analíticos
- `GET /api/slider` - Contenido dinámico
- `GET /api/reports/public` - Reportes públicos

---

## 6. Requerimientos de Seguridad

### 6.1 Autenticación y Autorización

#### SEG-001: Autenticación Multifactor
**Descripción**: Soporte para 2FA basado en TOTP (Time-based One-Time Password).
**Implementación**: Librería speakeasy para generación de códigos.

#### SEG-002: Gestión de Sesiones
**Descripción**: Sesiones persistentes con expiración automática.
**Duración**: 24 horas por defecto, configurable.

#### SEG-003: Hashing de Contraseñas
**Descripción**: Hashing seguro con bcrypt, salting automático.
**Configuración**: Cost factor 12 para balance seguridad/rendimiento.

### 6.2 Protección de Datos

#### SEG-004: Encriptación en Tránsito
**Descripción**: TLS 1.3 obligatorio para todas las conexiones.
**Certificados**: Let's Encrypt para desarrollo, certificados válidos en producción.

#### SEG-005: Sanitización de Entrada
**Descripción**: Validación y sanitización de todos los inputs del usuario.
**Librerías**: express-validator para validaciones.

#### SEG-006: Control de Acceso Basado en Roles
**Descripción**: RBAC (Role-Based Access Control) con permisos granulares.
**Roles**: admin (acceso total), user (acceso limitado).

### 6.3 Auditoría y Monitoreo

#### SEG-007: Logging de Seguridad
**Descripción**: Registro de todas las acciones de seguridad.
**Eventos**: Login/logout, cambios de contraseña, accesos denegados.

#### SEG-008: Detección de Intrusiones
**Descripción**: Monitoreo de patrones sospechosos.
**Métricas**: Rate limiting, análisis de logs.

---

## 7. Requerimientos de Pruebas

### 7.1 Pruebas Unitarias

#### PRU-001: Cobertura de Código
**Descripción**: Mínimo 80% de cobertura en código backend.
**Herramientas**: Jest para pruebas, Istanbul para cobertura.

#### PRU-002: Pruebas de API
**Descripción**: Tests completos para todos los endpoints.
**Tipos**: Unitarias, integración, end-to-end.

### 7.2 Pruebas de Rendimiento

#### PRU-003: Pruebas de Carga
**Descripción**: Simulación de 100+ usuarios concurrentes.
**Herramientas**: Artillery o k6.

#### PRU-004: Pruebas de Estrés
**Descripción**: Validación de límites del sistema.
**Escenarios**: Picos de carga, fallos de componentes.

### 7.3 Pruebas de Seguridad

#### PRU-005: Análisis OWASP
**Descripción**: Auditorías de seguridad según top 10 OWASP.
**Frecuencia**: Antes de cada despliegue.

#### PRU-006: Pruebas de Penetración
**Descripción**: Simulación de ataques comunes.
**Alcance**: APIs, interfaces web, base de datos.

---

## 8. Requerimientos de Despliegue y Mantenimiento

### 8.1 Despliegue

#### DEP-001: Contenedorización
**Descripción**: Aplicación containerizada con Docker.
**Beneficios**: Portabilidad, escalabilidad, aislamiento.

#### DEP-002: CI/CD
**Descripción**: Pipeline automatizado para despliegue.
**Herramientas**: GitHub Actions, Docker Compose.

### 8.2 Monitoreo

#### MON-001: Health Checks
**Descripción**: Endpoints de monitoreo de salud.
**Métricas**: CPU, memoria, conexiones a BD, uptime.

#### MON-002: Alertas
**Descripción**: Notificaciones automáticas de incidentes.
**Canales**: Email, Slack, dashboard de monitoreo.

### 8.3 Backup y Recuperación

#### BKP-001: Estrategia de Backup
**Descripción**: Backups automáticos de base de datos.
**Frecuencia**: Diaria para datos operativos, semanal para históricos.

#### BKP-002: Plan de Recuperación
**Descripción**: Procedimientos documentados para disaster recovery.
**Objetivo**: RTO < 4 horas, RPO < 1 hora.

---

## 9. Requerimientos de Documentación

### 9.1 Documentación Técnica

#### DOC-001: API Documentation
**Descripción**: Documentación completa de APIs con OpenAPI/Swagger.
**Contenido**: Endpoints, parámetros, respuestas, ejemplos.

#### DOC-002: Guía de Despliegue
**Descripción**: Instrucciones detalladas para instalación y configuración.
**Audiencia**: Equipos de DevOps y sysadmin.

### 9.2 Documentación de Usuario

#### DOC-003: Manual de Usuario
**Descripción**: Guías para ciudadanos y administradores.
**Formato**: PDF con capturas de pantalla.

#### DOC-004: FAQ
**Descripción**: Preguntas frecuentes y soluciones.
**Mantenimiento**: Actualización continua basada en soporte.

---

## 10. Matriz de Trazabilidad

| Requerimiento | Caso de Uso | Prueba | Documento |
|---------------|-------------|--------|-----------|
| RF-001 | CU-002 | PRU-002 | Arquitectura |
| RF-005 | CU-003 | PRU-003 | Manual Usuario |
| RNF-001 | - | PRU-004 | SLA |
| SEG-001 | CU-002 | PRU-005 | Política Seguridad |

---

**Versión**: 1.0
**Fecha**: Noviembre 2025
**Autor**: Equipo de Desarrollo VIITS
**Revisado por**: INVIAS - Colombia