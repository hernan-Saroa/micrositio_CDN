// ========================================
// VERIFICACIÓN DE AUTENTICACIÓN
// ========================================

// Modo de demostración (debe coincidir con login.html)
const DEMO_MODE = false;

// Mapeo de rol BD → nombre en configuración de roles (um_roles)
const ROLE_NAME_MAP = {
    admin: 'Administrador',
    viewer: 'Monitor DAI',
    editor: 'Editor',
    user: 'Usuario'
};

// Módulos completos para admin (fallback de seguridad)
const ALL_MODULES = ['dashboard', 'reports', 'slider', 'alertas-dai', 'users', 'downloads', 'audit', 'settings'];

// UM_MODULES usa 'config' pero el sidebar usa 'settings'
// Este mapeo traduce IDs de UM_MODULES → data-section del sidebar
const MODULE_ID_MAP = { config: 'settings' };
function toSidebarSection(moduleId) { return MODULE_ID_MAP[moduleId] || moduleId; }

/**
 * Obtiene los módulos permitidos para un rol leyendo dinámicamente
 * la configuración de roles (um_roles) almacenada en localStorage.
 * Esa configuración se gestiona desde la UI de Roles en el admin panel.
 */
function getAllowedModules(dbRole) {
    // Admin siempre tiene acceso total
    if (dbRole === 'admin') return ALL_MODULES;

    // Leer roles configurados desde localStorage (gestionados por UI de Roles)
    const roles = JSON.parse(localStorage.getItem('um_roles') || '[]');
    const roleName = ROLE_NAME_MAP[dbRole] || dbRole;

    // Buscar por nombre del rol (case-insensitive)
    const roleConfig = roles.find(r =>
        r.name && r.name.toLowerCase() === roleName.toLowerCase()
    );

    if (roleConfig && roleConfig.modules && roleConfig.modules.length > 0) {
        // Convertir IDs de UM_MODULES a IDs del sidebar
        return roleConfig.modules.map(toSidebarSection);
    }

    // Fallback: si no se encuentra configuración, solo dashboard
    console.warn(`Rol "${dbRole}" (${roleName}) no encontrado en um_roles. Usando fallback.`);
    return ['dashboard'];
}

// Función para filtrar sidebar según rol
function applySidebarRoleFilter(role) {
    const allowedSections = getAllowedModules(role);
    const menuItems = document.querySelectorAll('#sidebarMenu .menu-item[data-section]');
    const sectionLabels = document.querySelectorAll('#sidebarMenu .menu-section-label[data-section-label]');

    // Ocultar/mostrar items según rol
    menuItems.forEach(item => {
        const section = item.getAttribute('data-section');
        if (allowedSections.includes(section)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
            item.classList.remove('active');
        }
    });

    // Ocultar section labels si no tienen items visibles
    sectionLabels.forEach(label => {
        let next = label.nextElementSibling;
        let hasVisibleItem = false;
        while (next && !next.hasAttribute('data-section-label')) {
            if (next.classList.contains('menu-item') && next.style.display !== 'none') {
                hasVisibleItem = true;
                break;
            }
            next = next.nextElementSibling;
        }
        label.style.display = hasVisibleItem ? '' : 'none';
    });

    // Asegurarse de que la sección activa sea una permitida
    const activeItem = document.querySelector('#sidebarMenu .menu-item.active[data-section]');
    if (!activeItem || activeItem.style.display === 'none') {
        // Navegar a la primera sección permitida
        const firstAllowed = allowedSections[0] || 'dashboard';
        showSection(firstAllowed);
    }

    // También ocultar las secciones de contenido (tab-content) no permitidas
    document.querySelectorAll('.tab-content').forEach(tc => {
        const id = tc.id;
        if (id && !allowedSections.includes(id)) {
            tc.style.display = 'none';
            tc.classList.remove('active');
        }
    });
}

// Función para actualizar sidebar footer con datos reales del usuario
function updateSidebarUser(userData) {
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarAvatar');

    if (nameEl && userData.name) {
        nameEl.textContent = userData.name;
    }
    if (roleEl) {
        const roleLabels = {
            admin: 'Administrador',
            viewer: 'Monitor DAI',
            editor: 'Editor',
            user: 'Usuario'
        };
        roleEl.textContent = roleLabels[userData.role] || userData.role || '';
    }
    if (avatarEl && userData.name) {
        const parts = userData.name.split(' ');
        const initials = parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : userData.name.substring(0, 2).toUpperCase();
        avatarEl.textContent = initials;
    }
}

// Verificar autenticación al cargar la página
(async function checkAuth() {
    // MODO DEMOSTRACIÓN - Sin backend
    if (DEMO_MODE) {
        const isAuthenticated = sessionStorage.getItem('isAuthenticated');
        const demoUser = sessionStorage.getItem('demoUser');

        if (!isAuthenticated || isAuthenticated !== 'true') {
            // No está autenticado, redirigir a login
            window.location.href = 'login.html';
            return;
        }

        // Actualizar información del usuario en la UI
        const userNameElement = document.querySelector('.topbar p');
        if (userNameElement && demoUser) {
            const userName = demoUser.split('@')[0];
            userNameElement.textContent = `Bienvenido, ${userName}`;
        }

        console.log('%c✅ MODO DEMOSTRACIÓN ACTIVO', 'color: #10b981; font-size: 14px; font-weight: bold;');
        console.log(`%cUsuario: ${demoUser}`, 'color: #6b7280; font-size: 12px;');

        return;
    }

    // MODO PRODUCCIÓN - Con backend
    const token = localStorage.getItem('authToken');

    if (!token) {
        // No hay token, redirigir a login
        window.location.href = 'login.html';
        return;
    }

    try {
        // Verificar token con el servidor
        const response = await fetch('/api/auth/verify-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            // Token inválido o expirado
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();

        // Leer datos del usuario desde localStorage
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const userRole = userData.role || 'user';

        // Actualizar información del usuario en la topbar
        const userNameElement = document.querySelector('.topbar p');
        if (userNameElement && userData.name) {
            userNameElement.textContent = `Bienvenido, ${userData.name}`;
        }

        // Actualizar sidebar footer con datos reales
        updateSidebarUser(userData);

        // Aplicar filtro de roles al sidebar
        applySidebarRoleFilter(userRole);

        // Load system configuration (DAI alerts, etc.)
        loadSettingsConfig();

        console.log(`%c🔐 Rol: ${userRole}`, 'color: #f59e0b; font-size: 12px; font-weight: bold;');

    } catch (error) {
        console.error('Error al verificar autenticación:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
})();

// Función de logout
async function handleLogout() {
    if (DEMO_MODE) {
        // Modo demostración - solo limpiar sessionStorage
        sessionStorage.clear();
        window.location.href = 'login.html';
        return;
    }

    // Modo producción
    const token = localStorage.getItem('authToken');

    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    // Limpiar almacenamiento local
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    sessionStorage.clear();

    // Redirigir a login
    window.location.href = 'login.html';
}

// Interceptor para peticiones API (agregar token automáticamente)
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('authToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Para FormData, no agregar Content-Type (dejar que el navegador lo haga automáticamente)
    const isFormData = options.body instanceof FormData;
    const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers
    };

    const mergedOptions = { ...options, headers: defaultHeaders };

    try {
        const response = await fetch(url, mergedOptions);

        if (response.status === 401 || response.status === 403) {
            // Token expirado o inválido
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('loginTime');
            window.location.href = 'login.html';
            return;
        }

        return response;
    } catch (error) {
        console.error('Error en petición API:', error);
        throw error;
    }
}

// ========================================
// FUNCIONALIDADES DEL PANEL
// ========================================

// Variables para paginación de auditoría
let currentAuditPage = 1;
let totalAuditPages = 1;

// Cargar logs de auditoría desde la base de datos
async function loadAuditLogs(page = 1) {
    try {
        const action = document.getElementById('auditActionFilter').value;
        const status = document.getElementById('auditStatusFilter').value;
        const dateFrom = document.getElementById('auditDateFrom').value;
        const dateTo = document.getElementById('auditDateTo').value;

        let url = `/api/audit?page=${page}&limit=10`;
        if (action) url += `&action=${action}`;
        if (status) url += `&status=${status}`;
        if (dateFrom) url += `&date_from=${dateFrom}`;
        if (dateTo) url += `&date_to=${dateTo}`;

        const response = await apiRequest(url);
        if (!response.ok) {
            throw new Error('Error al cargar logs de auditoría');
        }

        const data = await response.json();
        const totalRegistros = document.getElementById('total-registros');
        totalRegistros.textContent = `Total de registros: ${data.pagination.total}`;
        displayAuditLogs(data.audit_logs);

        // Actualizar paginación
        currentAuditPage = data.pagination.page;
        totalAuditPages = data.pagination.pages;
        updateAuditPagination(data.pagination);

    } catch (error) {
        console.error('Error al cargar logs de auditoría:', error);
        // Mostrar mensaje de error en la tabla
        const tbody = document.getElementById('auditTableBody');
        tbody.innerHTML = window.safeHTML(`
            <tr>
                <td colspan="6" style="text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar logs de auditoría. Verifica la conexión con la base de datos.
                </td>
            </tr>
        `);
    }
}

// Aplicar filtros de auditoría
function applyAuditFilters() {
    currentAuditPage = 1;
    loadAuditLogs(1);
}

// Limpiar filtros de auditoría
function clearAuditFilters() {
    document.getElementById('auditActionFilter').value = '';
    document.getElementById('auditStatusFilter').value = '';
    document.getElementById('auditDateFrom').value = '';
    document.getElementById('auditDateTo').value = '';
    currentAuditPage = 1;
    loadAuditLogs(1);
}

// Cambiar página de auditoría
function changeAuditPage(direction) {
    const newPage = currentAuditPage + direction;
    if (newPage >= 1 && newPage <= totalAuditPages) {
        loadAuditLogs(newPage);
    }
}

// Actualizar controles de paginación
function updateAuditPagination(pagination) {
    const paginationDiv = document.getElementById('auditPagination');
    const prevBtn = document.getElementById('auditPrevBtn');
    const nextBtn = document.getElementById('auditNextBtn');
    const pageInfo = document.getElementById('auditPageInfo');

    if (pagination.pages > 1) {
        paginationDiv.style.display = 'block';
        prevBtn.disabled = pagination.page <= 1;
        nextBtn.disabled = pagination.page >= pagination.pages;
        pageInfo.textContent = `Página ${pagination.page} de ${pagination.pages}`;
    } else {
        paginationDiv.style.display = 'none';
    }
}

// Mostrar logs de auditoría en la tabla
function displayAuditLogs(auditLogs) {
    const tbody = document.getElementById('auditTableBody');

    if (!auditLogs || auditLogs.length === 0) {
        tbody.innerHTML = window.safeHTML(`
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No hay registros de auditoría disponibles
            </td>
        </tr>
        `);
        return;
    }

    tbody.innerHTML = window.safeHTML(auditLogs.map(log => {
        const createdDate = new Date(log.created_at).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const userDisplay = log.user_name ?
            `${log.user_name} (${log.user_email})` :
            log.user_email || 'Sistema';

        const actionDisplay = getActionDisplayName(log.action);
        const statusBadge = getStatusBadge(log.status);

        return `
            <tr>
                <td><strong>${userDisplay}</strong></td>
                <td>${actionDisplay}</td>
                <td>${log.resource_type || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${createdDate}</td>
                <td>${log.ip_address || 'N/A'}</td>
            </tr>
        `;
    }).join(''));
}

// Función auxiliar para obtener nombre display de acción
function getActionDisplayName(action) {
    const actionNames = {
        'login': 'Inicio de Sesión',
        'logout': 'Cierre de Sesión',
        'create_report': 'Crear Reporte',
        'update_report': 'Actualizar Reporte',
        'delete_report': 'Eliminar Reporte',
        'download_report': 'Descargar Reporte',
        'download': 'Descarga',
        'register': 'Registro de Usuario',
        'verify_code': 'Verificar Código',
        'create_user': 'Crear Usuario',
        'update_user': 'Actualizar Usuario',
        'delete_user': 'Eliminar Usuario',
        'view_report': 'Ver Reporte',
        'upload': 'Subir Archivo',
        'export_data': 'Exportar Datos',
        'import_data': 'Importar Datos',
        'change_password': 'Cambiar Contraseña',
        'reset_password': 'Restablecer Contraseña',
        'enable_2fa': 'Habilitar 2FA',
        'disable_2fa': 'Deshabilitar 2FA',
        'update_profile': 'Actualizar Perfil',
        'delete_account': 'Eliminar Cuenta',
        'verify_code_success': 'Código Verificado',
        'send_verification_code': 'Enviar Código de Verificación',
        'verify_code_failed': 'Código de Verificación Fallido',
        'verify_code_expired': 'Código de Verificación Expirado',
    };
    return actionNames[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Función auxiliar para obtener badge de estado
function getStatusBadge(status) {
    const statusConfig = {
        'success': { class: 'badge-success', text: 'Exitoso' },
        'failed': { class: 'badge-error', text: 'Fallido' },
        'warning': { class: 'badge-warning', text: 'Advertencia' }
    };

    const config = statusConfig[status] || { class: 'badge-new', text: status };
    return `<span class="badge ${config.class}">${config.text}</span>`;
}

// Función auxiliar para obtener badge del rol
function getRoleBadgeDisplay(role) {
    if (!role) return '<span class="badge badge-new">Sistema</span>';

    const roleConfig = {
        'admin': { class: 'badge-error', text: 'Admin' },
        'editor': { class: 'badge-warning', text: 'Editor' },
        'user': { class: 'badge-success', text: 'Usuario' }
    };

    const config = roleConfig[role] || { class: 'badge-new', text: role };
    return `<span class="badge ${config.class}">${config.text}</span>`;
}

// Función para formatear tiempo relativo
function getRelativeTime(dateString) {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
        return 'Hace menos de 1 min';
    } else if (diffMinutes < 60) {
        return `Hace ${diffMinutes} min`;
    } else if (diffHours < 24) {
        return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
        return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    } else if (diffWeeks < 4) {
        return `Hace ${diffWeeks} semana${diffWeeks !== 1 ? 's' : ''}`;
    } else if (diffMonths < 12) {
        return `Hace ${diffMonths} mes${diffMonths !== 1 ? 'es' : ''}`;
    } else {
        return `Hace ${diffYears} año${diffYears !== 1 ? 's' : ''}`;
    }
}

// Cargar usuarios desde la base de datos
async function loadUsers() {
    try {
        const response = await apiRequest('/api/users');
        if (!response.ok) {
            throw new Error('Error al cargar usuarios');
        }

        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        // Mostrar mensaje de error en la tabla
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = window.safeHTML(`
            <tr>
                <td colspan="6" style="text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar usuarios. Verifica la conexión con la base de datos.
                </td>
            </tr>
        `);
    }
}

// Mostrar usuarios en la tabla
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = window.safeHTML(`
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No hay usuarios registrados
                </td>
            </tr>
        `);
        return;
    }

    tbody.innerHTML = window.safeHTML(users.map(user => {
        const createdDate = new Date(user.created_at).toLocaleDateString('es-CO');
        const lastLogin = getRelativeTime(user.last_login);

        return `
            <tr>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>
                    <span class="badge ${getRoleBadgeClass(user.role)}">
                        ${getRoleDisplayName(user.role)}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-error'}">
                        ${user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${lastLogin}</td>
                <td>${createdDate}</td>
            </tr>
        `;
    }).join(''));
}

// Función auxiliar para obtener clase del badge del rol
function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin': return 'badge-error';
        case 'editor': return 'badge-warning';
        case 'viewer': return 'badge-info';
        case 'user': return 'badge-warning';
        default: return 'badge-new';
    }
}

// Función auxiliar para obtener nombre display del rol
function getRoleDisplayName(role) {
    switch (role) {
        case 'admin': return 'Administrador';
        case 'editor': return 'Editor';
        case 'viewer': return 'Monitor DAI';
        case 'user': return 'Usuario';
        default: return role;
    }
}

// All report CRUD functions moved to admin-panel-functions.js



// Función para manejar el envío del formulario de carga
async function handleUploadFormSubmit(event) {
    event.preventDefault();
    console.log('Iniciando envío del formulario de carga de reporte');

    const form = event.target;
    const formData = new FormData();

    // Obtener valores del formulario usando IDs específicos
    const title = document.getElementById('reportTitle')?.value.trim() || '';
    const description = document.getElementById('reportDescription')?.value.trim() || '';
    const fileInput = document.getElementById('reportFile');
    const isPublic = document.getElementById('isPublic')?.checked || false;
    const isFeatured = document.getElementById('isFeatured')?.checked || false;

    console.log('Valores del formulario:', { title, description, isPublic, isFeatured });

    // Validaciones
    if (!title) {
        alert('El título es obligatorio');
        return;
    }

    if (!description) {
        alert('La descripción es obligatoria');
        return;
    }

    if (!fileInput || !fileInput.files[0]) {
        alert('Debe seleccionar un archivo PDF');
        return;
    }

    const file = fileInput.files[0];
    console.log('Archivo seleccionado:', file.name, file.type, file.size);

    // Validar tipo de archivo
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Solo se permiten archivos PDF');
        return;
    }

    // Validar tamaño del archivo (50MB máximo)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        alert('El archivo no puede superar los 50MB');
        return;
    }

    // Preparar FormData
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);
    formData.append('is_public', isPublic.toString());
    formData.append('is_featured', isFeatured.toString());

    console.log('FormData preparado, enviando al servidor...');

    // Mostrar loading
    const submitBtn = document.querySelector('#uploadModal button[type="submit"]');
    if (submitBtn) {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = window.safeHTML('<i class="material-icons">hourglass_empty</i> Subiendo...');
        submitBtn.disabled = true;

        // Restaurar botón después
        setTimeout(() => {
            submitBtn.innerHTML = window.safeHTML(originalText);
            submitBtn.disabled = false;
        }, 1000);
    }

    // Crear reporte
    const success = await createReport(formData);

    // Limpiar formulario si fue exitoso
    if (success) {
        form.reset();
    }
}

// Función para actualizar el progreso de carga
function updateUploadProgress(loaded, total) {
    const progress = (loaded / total) * 100;
    console.log(`Progreso de carga: ${progress.toFixed(1)}%`);
    // Aquí podrías mostrar una barra de progreso si lo deseas
}

// Section Navigation
function showSection(sectionId) {
    // Guard: check if the user has access to this section
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = userData.role || 'user';
    const allowed = getAllowedModules(userRole);
    if (!allowed.includes(sectionId)) {
        console.warn(`Acceso denegado a sección "${sectionId}" para rol "${userRole}"`);
        return;
    }

    if (typeof _updateTopbar === "function") _updateTopbar(sectionId);
    // Hide all sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    // Update menu items — usar data-section para match robusto
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const menuItem = document.querySelector(`.menu-item[data-section="${sectionId}"]`);
    if (menuItem) menuItem.classList.add('active');

    // Cargar datos cuando se muestra la sección correspondiente
    if (sectionId === 'users') {
        loadUsers();
    } else if (sectionId === 'reports') {
        loadReports();
    } else if (sectionId === 'dashboard') {
        var range = dbGetDateRange(_dbPreset || 'today');
        loadDashboardData(range.from, range.to);
    } else if (sectionId === 'slider') {
        loadSliderImages();
    } else if (sectionId === 'analytics') {
        var rng = anGetDateRange(_anPreset || 'today');
        loadAnalytics(rng.from, rng.to);
    } else if (sectionId === 'audit') {
        loadAuditAdmin(1);
    } else if (sectionId === 'alertas-dai') {
        loadAlertasDAI();
    } else if (sectionId === 'downloads') {
        loadDownloadsAdmin(1);
    } else if (sectionId === 'settings') {
        loadSettingsConfig();
        if (typeof loadDaiSeverityConfig === 'function') loadDaiSeverityConfig();
    }
}


// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Success Modal Function
function showSuccessModal(message) {
    document.getElementById('successMessage').textContent = message;
    showModal('successModal');
}

// Logout Confirmation Functions
function showLogoutConfirm() {
    showModal('logoutConfirmModal');
}

function confirmLogout() {
    closeModal('logoutConfirmModal');
    handleLogout();
}

// ========================================
// FUNCIONALIDADES DEL SLIDER
// ========================================

// Variables para el slider
let sliderImages = [];

// Cargar imágenes del slider desde la base de datos
async function loadSliderImages() {
    try {
        // Cargar slides activos e inactivos (no archivados)
        const [activeRes, archivedRes] = await Promise.all([
            apiRequest('/api/slider'),
            apiRequest('/api/slider?archived=1')
        ]);

        if (!activeRes.ok) throw new Error('Error al cargar imágenes del slider');

        sliderImages = await activeRes.json();
        displaySliderImages(sliderImages);

        if (archivedRes && archivedRes.ok) {
            const archived = await archivedRes.json();
            displayArchivedSliders(archived);
        }
    } catch (error) {
        console.error('Error al cargar imágenes del slider:', error);
        const sliderSection = document.getElementById('slider');
        const grid = sliderSection ? sliderSection.querySelector('.grid') : null;
        if (grid) {
            grid.innerHTML = window.safeHTML(`
                <div style="grid-column: 1 / -1; text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar imágenes del slider. Verifica la conexión con la base de datos.
                </div>
            `);
        }
    }
}

// Mostrar imágenes del slider en la interfaz
function displaySliderImages(images) {
    const grid = document.getElementById('sliderGrid');
    if (!grid) return;

    if (!images || images.length === 0) {
        grid.innerHTML = window.safeHTML(`
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;">
                <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">image</i>
                <br>
                No hay imágenes en el slider. Haz clic en "Agregar Imagen" para comenzar.
            </div>
        `);
        return;
    }

    grid.innerHTML = window.safeHTML(images.map(image => {
        const hasRealImage = image.image_path && image.image_path !== 'placeholder.jpg';
        const imageUrl = hasRealImage ? `/uploads/slider/${image.image_path}` : '';
        const isActive = image.is_active;
        return `
            <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1px solid #f1f5f9;transition:box-shadow 0.2s;opacity:${isActive ? '1' : '0.65'};" onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'" onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'">
                <div style="height:180px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
                    ${hasRealImage ? `<img src="${imageUrl}" alt="${image.alt_text}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` : ''}
                    <div style="${hasRealImage ? 'display:none;' : 'display:flex;'}position:absolute;inset:0;align-items:center;justify-content:center;background:#f8fafc;">
                        <i class="material-icons" style="font-size:40px;color:#cbd5e1;">image</i>
                    </div>
                    ${!isActive ? '<div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:white;font-size:0.7rem;font-weight:600;padding:3px 8px;border-radius:6px;">OCULTO</div>' : ''}
                </div>
                <div style="padding:1rem 1.25rem;">
                    <h4 style="margin:0 0 4px;font-size:0.95rem;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${image.title}</h4>
                    <p style="color:#94a3b8;font-size:0.8rem;margin:0 0 0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${image.description || 'Sin descripción'}</p>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.72rem;font-weight:600;padding:3px 10px;border-radius:20px;
                            background:${isActive ? '#f0fdf4' : '#f8fafc'};
                            color:${isActive ? '#059669' : '#94a3b8'};
                            border:1px solid ${isActive ? '#a7f3d0' : '#e2e8f0'};">
                            ${isActive ? '● Visible' : '● Oculto'} · Pos ${image.position}
                        </span>
                        <div style="display:flex;gap:4px;">
                            <button onclick="toggleSliderVisibility('${image.id}', ${isActive})"
                                title="${isActive ? 'Ocultar slide' : 'Mostrar slide'}"
                                style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;
                                       background:${isActive ? '#f0fdf4' : '#f8fafc'};color:${isActive ? '#059669' : '#94a3b8'};">
                                <i class="material-icons" style="font-size:18px;">${isActive ? 'visibility' : 'visibility_off'}</i>
                            </button>
                            <button onclick="editSliderImage('${image.id}')"
                                title="Editar"
                                style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fff7ed;color:#ea580c;">
                                <i class="material-icons" style="font-size:18px;">edit</i>
                            </button>
                            <button onclick="archiveSliderImage('${image.id}')"
                                title="Archivar (no elimina)"
                                style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#6b7280;">
                                <i class="material-icons" style="font-size:18px;">inventory_2</i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join(''));
}

// Mostrar slides archivados
function displayArchivedSliders(archived) {
    const grid = document.getElementById('sliderArchivedGrid');
    const countBadge = document.getElementById('archivedCount');
    if (countBadge) countBadge.textContent = archived.length;
    if (!grid) return;

    if (!archived || archived.length === 0) {
        grid.innerHTML = window.safeHTML(
            '<p style="color:#9ca3af;font-size:0.875rem;padding:1rem;">No hay slides archivados.</p>'
        );
        return;
    }

    grid.innerHTML = window.safeHTML(archived.map(image => {
        const imageUrl = `/uploads/slider/${image.image_path}`;
        return `
            <div style="background:#f8fafc;border-radius:12px;overflow:hidden;border:1px dashed #e2e8f0;opacity:0.85;">
                <div style="height:140px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
                    <img src="${imageUrl}" alt="${image.alt_text}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(50%);" onerror="this.style.display='none';">
                </div>
                <div style="padding:0.875rem 1rem;">
                    <h4 style="margin:0 0 2px;font-size:0.875rem;font-weight:600;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${image.title}</h4>
                    <div style="margin-top:0.625rem;">
                        <button onclick="restoreSliderImage('${image.id}')"
                            style="width:100%;display:flex;align-items:center;justify-content:center;gap:0.4rem;padding:0.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;color:#059669;transition:all 0.15s;"
                            onmouseenter="this.style.background='#f0fdf4'" onmouseleave="this.style.background='#fff'">
                            <i class="material-icons" style="font-size:16px;">unarchive</i>
                            Restaurar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join(''));
}

// Toggle acordeón archivados
function toggleArchivedSection() {
    const collapsible = document.getElementById('archivedCollapsible');
    const chevron = document.getElementById('archivedChevron');
    const isOpen = collapsible.style.display !== 'none';
    collapsible.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.textContent = isOpen ? 'expand_more' : 'expand_less';
}

// Función para crear nueva imagen del slider
async function createSliderImage(formData) {
    try {
        const response = await apiRequest('/api/slider', {
            method: 'POST',
            body: formData // FormData ya incluye la imagen y los campos
        });

        if (response.ok) {
            const newImage = await response.json();
            showSuccessModal('Imagen agregada al slider exitosamente');
            closeModal('sliderModal');
            loadSliderImages(); // Recargar la lista
            return true;
        } else {
            const error = await response.json();
            alert('Error al agregar imagen: ' + (error.message || 'Error desconocido'));
            return false;
        }
    } catch (error) {
        console.error('Error al crear imagen del slider:', error);
        alert('Error de conexión al agregar imagen del slider');
        return false;
    }
}

// Función para editar imagen del slider
function editSliderImage(id) {
    const image = sliderImages.find(img => String(img.id) === String(id));
    if (!image) {
        alert('Imagen no encontrada');
        return;
    }

    // Abrir modal de edición con los datos actuales
    openEditSliderModal(image);
}

// Función para archivar imagen del slider (reemplaza eliminar)
async function archiveSliderImage(id) {
    const image = sliderImages.find(img => String(img.id) === String(id));
    const name = image ? image.title : `Slide #${id}`;
    const ok = await ccmConfirm({
        title: `¿Archivar "${name}"?`,
        message: 'El slide dejará de aparecer en el carrusel. Podrás restaurarlo desde la sección de archivados.',
        confirmLabel: 'Archivar',
        icon: 'inventory_2',
        type: 'warn'
    });
    if (!ok) return;
    try {
        const response = await apiRequest(`/api/slider/${id}/archive`, { method: 'PATCH' });
        if (response && response.ok) {
            showNotification('Slide archivado correctamente', 'success');
            loadSliderImages();
        } else {
            const err = await response.json().catch(() => ({}));
            showNotification('Error al archivar: ' + (err.message || 'Error desconocido'), 'error');
        }
    } catch (error) {
        console.error('Error al archivar imagen del slider:', error);
        showNotification('Error de conexión al intentar archivar', 'error');
    }
}

// Función para restaurar imagen archivada
async function restoreSliderImage(id) {
    try {
        const response = await apiRequest(`/api/slider/${id}/restore`, { method: 'PATCH' });
        if (response && response.ok) {
            showSuccessModal('Slide restaurado al carrusel');
            loadSliderImages();
        } else {
            alert('Error al restaurar');
        }
    } catch (error) {
        console.error('Error al restaurar imagen del slider:', error);
    }
}

// Función para toggle de visibilidad del slide
async function toggleSliderVisibility(id, currentIsActive) {
    try {
        const response = await apiRequest(`/api/slider/${id}/visibility`, { method: 'PATCH' });
        if (response && response.ok) {
            loadSliderImages();
        } else {
            alert('Error al cambiar visibilidad');
        }
    } catch (error) {
        console.error('Error al cambiar visibilidad:', error);
    }
}

// Función para manejar la selección de imagen
function handleImageSelection(event) {
    const file = event.target.files[0];
    const selectedFileName = document.getElementById('selectedFileName');

    if (file) {
        selectedFileName.textContent = `Seleccionado: ${file.name}`;
        selectedFileName.style.display = 'block';
    } else {
        selectedFileName.style.display = 'none';
    }
}

// Función para abrir modal de edición del slider
function openEditSliderModal(image) {
    // Crear modal de edición dinámicamente
    const editModal = document.createElement('div');
    editModal.id = 'editSliderModal';
    editModal.innerHTML = window.safeHTML(`
        <div class="modal-content">
            <div class="modal-header">
                <h3>Editar Imagen del Slider</h3>
                <button onclick="closeEditSliderModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body">
                <form id="editSliderForm" onsubmit="handleEditSliderFormSubmit(event)">
                    <div class="form-group">
                        <label>Título *</label>
                        <input type="text" id="editSliderTitle" placeholder="Ej: Sistema VIITS" value="${image.title}" required>
                    </div>
                    <div class="form-group">
                        <label>Subtítulo *</label>
                        <input type="text" id="editSliderSubTitle" placeholder="Ej: Sistema VIITS" value="${image.alt_text}" required>
                    </div>
                    <div class="form-group">
                        <label>Texto Descriptivo</label>
                        <input type="text" id="editSliderDescription" placeholder="Ej: Vigilancia Inteligente" value="${image.description || ''}">
                    </div>

                    <div class="form-group">
                        <label>Posición en el Slider</label>
                        <select id="editSliderPosition">
                            <option value="0" ${image.position == 0 ? 'selected' : ''}>Automática (última posición)</option>
                            <option value="1" ${image.position == 1 ? 'selected' : ''}>1 - Primera</option>
                            <option value="2" ${image.position == 2 ? 'selected' : ''}>2 - Segunda</option>
                            <option value="3" ${image.position == 3 ? 'selected' : ''}>3 - Tercera</option>
                            <option value="4" ${image.position == 4 ? 'selected' : ''}>4 - Cuarta</option>
                            <option value="5" ${image.position == 5 ? 'selected' : ''}>5 - Quinta</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Estado</label>
                        <select id="editSliderStatus">
                            <option value="true" ${image.is_active ? 'selected' : ''}>Activo</option>
                            <option value="false" ${!image.is_active ? 'selected' : ''}>Inactivo</option>
                        </select>
                    </div>

                    <!-- Selector de color de fondo -->
                    <div class="form-group">
                        <label style="font-weight:600;">Color de Fondo del Slide</label>
                        <!-- Swatches preestablecidos -->
                        <div id="editSliderBgColorPicker" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">
                            ${[
            ['linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)', 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', 'Azul claro'],
            ['linear-gradient(135deg, #004a8f 0%, #003366 100%)', 'linear-gradient(135deg,#004a8f,#003366)', 'Azul gobierno'],
            ['linear-gradient(135deg, #f97316 0%, #ea580c 100%)', 'linear-gradient(135deg,#f97316,#ea580c)', 'Naranja INVIAS'],
            ['linear-gradient(135deg, #069169 0%, #047857 100%)', 'linear-gradient(135deg,#069169,#047857)', 'Verde'],
            ['linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', 'linear-gradient(135deg,#6366f1,#4338ca)', 'Índigo'],
            ['linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', 'linear-gradient(135deg,#0ea5e9,#0284c7)', 'Azul cielo'],
            ['linear-gradient(135deg, #d946ef 0%, #a21caf 100%)', 'linear-gradient(135deg,#d946ef,#a21caf)', 'Morado'],
        ].map(([full, preview, label]) => {
            const isCurrent = (image.bg_color || '').substring(0, 30) === full.substring(0, 30);
            return `<button type="button" class="slider-color-swatch" data-gradient="${full}" onclick="selectSliderBgColor(this,'editSliderBgColor','editSliderColorText','editSliderColorNative')" title="${label}" style="background:${preview};width:32px;height:32px;border-radius:6px;border:2px solid ${isCurrent ? 'var(--orange,#f97316)' : 'transparent'};cursor:pointer;"></button>`;
        }).join('')}
                        </div>
                        <!-- Color personalizado -->
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
                            <label style="font-size:0.8rem;color:#6b7280;white-space:nowrap;margin:0;">Color personalizado:</label>
                            <input type="color" id="editSliderColorNative" value="#f0f9ff" title="Elegir color sólido"
                                style="width:36px;height:32px;border-radius:6px;border:1px solid #d1d5db;cursor:pointer;padding:2px;"
                                oninput="syncColorFromNative('editSliderColorNative','editSliderBgColor','editSliderColorText','editSliderBgColorPicker')">
                            <input type="text" id="editSliderColorText"
                                value="${image.bg_color || 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)'}"
                                placeholder="ej: #1e40af o linear-gradient(135deg,#004a8f,#003366)"
                                style="flex:1;min-width:200px;padding:0.35rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.8rem;font-family:monospace;"
                                oninput="syncColorFromText('editSliderColorText','editSliderBgColor','editSliderBgColorPicker')">
                        </div>
                        <input type="hidden" id="editSliderBgColor" value="${image.bg_color || 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)'}">  
                    </div>

                    <!-- Opacidad de la imagen de fondo -->
                    <div class="form-group">
                        <label style="font-weight:600;">Opacidad de la Imagen de Fondo
                            <span id="editOpacityDisplay" style="font-weight:400;color:#f97316;margin-left:0.5rem;">${Math.round((image.image_opacity ?? 0.35) * 100)}%</span>
                        </label>
                        <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem;">
                            <span style="font-size:0.75rem;color:#9ca3af;">0% (invisible)</span>
                            <input type="range" id="editSliderImageOpacity" min="0" max="100" step="5"
                                value="${Math.round((image.image_opacity ?? 0.35) * 100)}"
                                style="flex:1;accent-color:var(--orange,#f97316);"
                                oninput="document.getElementById('editOpacityDisplay').textContent = this.value + '%'">
                            <span style="font-size:0.75rem;color:#9ca3af;">100% (sólida)</span>
                        </div>
                        <small style="color:#6b7280;font-size:0.75rem;display:block;margin-top:0.4rem;">0% = solo color de fondo, 35% = sutil (recomendado), 100% = imagen completa.</small>
                    </div>

                    <div class="form-group">
                        <label>Imagen actual:</label>
                        <div style="margin-top: 0.5rem;">
                            <img src="/uploads/slider/${image.image_path}" alt="${image.alt_text}" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <small style="color: #6b7280; font-size: 0.75rem;">Deja vacío para mantener la imagen actual</small>
                    </div>

                    <!-- ── Badge del Slide ── -->
                    <div class="form-group">
                        <label style="font-weight:600;">Texto del Badge (etiqueta de estado)</label>
                        <input type="text" id="editSliderBadgeText"
                            value="${image.badge_text || 'Sistema en línea • Monitoreo 24/7'}"
                            placeholder="Ej: Sistema en línea • Monitoreo 24/7"
                            oninput="livePreviewSlide('editSlider')">
                        <small style="color:#6b7280;font-size:0.75rem;">Texto visible en la píldora pequeña encima del título.</small>
                    </div>

                    <!-- ── Color del Texto del Badge ── -->
                    <div class="form-group">
                        <label style="font-weight:600;">Color del Texto del Badge</label>
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap;">
                            <button type="button" onclick="setTextColor('editSliderBadgeColor','#ffffff');livePreviewSlide('editSlider')" title="Blanco"
                                style="width:28px;height:28px;background:#ffffff;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderBadgeColor','#0f172a');livePreviewSlide('editSlider')" title="Negro"
                                style="width:28px;height:28px;background:#0f172a;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderBadgeColor','#10b981');livePreviewSlide('editSlider')" title="Verde"
                                style="width:28px;height:28px;background:#10b981;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderBadgeColor','#f97316');livePreviewSlide('editSlider')" title="Naranja"
                                style="width:28px;height:28px;background:#f97316;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderBadgeColor','#fbbf24');livePreviewSlide('editSlider')" title="Amarillo"
                                style="width:28px;height:28px;background:#fbbf24;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <label style="font-size:0.8rem;color:#6b7280;margin:0 0.25rem;">o personalizado:</label>
                            <input type="color" id="editSliderBadgeColor" value="${image.badge_color || '#ffffff'}"
                                style="width:36px;height:32px;border-radius:6px;border:1px solid #d1d5db;cursor:pointer;padding:2px;"
                                oninput="livePreviewSlide('editSlider')">
                        </div>
                    </div>

                    <!-- ── Color del Texto ── -->
                    <div class="form-group">
                        <label style="font-weight:600;">Color del Texto</label>
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap;">
                            <button type="button" onclick="setTextColor('editSliderTextColor','#ffffff');livePreviewSlide('editSlider')" title="Blanco"
                                style="width:28px;height:28px;background:#ffffff;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderTextColor','#0f172a');livePreviewSlide('editSlider')" title="Negro"
                                style="width:28px;height:28px;background:#0f172a;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderTextColor','#f97316');livePreviewSlide('editSlider')" title="Naranja"
                                style="width:28px;height:28px;background:#f97316;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderTextColor','#fbbf24');livePreviewSlide('editSlider')" title="Amarillo"
                                style="width:28px;height:28px;background:#fbbf24;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <button type="button" onclick="setTextColor('editSliderTextColor','#e0f2fe');livePreviewSlide('editSlider')" title="Azul claro"
                                style="width:28px;height:28px;background:#e0f2fe;border:2px solid #d1d5db;border-radius:50%;cursor:pointer;"></button>
                            <label style="font-size:0.8rem;color:#6b7280;margin:0 0.25rem;">o personalizado:</label>
                            <input type="color" id="editSliderTextColor" value="${image.text_color || '#ffffff'}"
                                style="width:36px;height:32px;border-radius:6px;border:1px solid #d1d5db;cursor:pointer;padding:2px;"
                                oninput="livePreviewSlide('editSlider')">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Cambiar Imagen (opcional)</label>
                        <input type="file" id="editSliderImageInput" accept="image/*"
                            onchange="handleEditImageSelection(event);(function(f){if(f){var r=new FileReader();r.onload=function(e){window.editSliderPreviewUrl=e.target.result;livePreviewSlide('editSlider');};r.readAsDataURL(f);}})(event?.target?.files?.[0])">
                        <div class="upload-area" id="editSliderUploadArea">
                            <i class="material-icons" style="font-size: 48px; color: #9ca3af; margin-bottom: 1rem;">add_photo_alternate</i>
                            <p style="font-weight: 600;">Seleccionar Nueva Imagen</p>
                            <p style="color: #6b7280; font-size: 0.75rem; margin-top: 1rem;">JPG, PNG, GIF, WebP • Máximo 10MB</p>
                            <p id="editSelectedFileName" style="color: var(--success); font-size: 0.875rem; margin-top: 0.5rem; display: none;"></p>
                        </div>
                    </div>

                    <!-- ── VISTA PREVIA EN VIVO ── -->
                    <div class="form-group">
                        <label style="font-weight:600;">Vista Previa del Slide</label>
                        <div id="editSliderLivePreview" style="position:relative;height:180px;border-radius:12px;overflow:hidden;background:${image.bg_color || 'linear-gradient(135deg,#f0f9ff,#e0f2fe)'};display:flex;align-items:center;justify-content:center;margin-top:0.5rem;box-shadow:0 4px 16px rgba(0,0,0,0.12);">
                            <div id="editSliderPreviewImg" style="position:absolute;inset:0;background-size:cover;background-position:center;opacity:${image.image_opacity ?? 0.35};${image.image_path && image.image_path !== 'placeholder.jpg' ? `background-image:url('/uploads/slider/${image.image_path}');` : 'display:none;'}"></div>
                            <div id="editSliderPreviewContent" style="position:relative;z-index:1;text-align:center;padding:1rem;color:${image.text_color || '#ffffff'};">
                                <div style="font-size:0.65rem;font-weight:600;letter-spacing:0.05em;opacity:0.9;margin-bottom:0.5rem;" id="editSliderPreviewBadge">⬤ ${image.badge_text || 'Sistema en línea • Monitoreo 24/7'}</div>
                                <div id="editSliderPreviewTitle" style="font-size:1rem;font-weight:700;line-height:1.2;margin-bottom:0.3rem;">${image.title || 'Título del slide'}</div>
                                <div id="editSliderPreviewSub" style="font-size:0.75rem;opacity:0.85;">${image.alt_text || 'Subtítulo aquí'}</div>
                            </div>
                        </div>
                        <small style="color:#6b7280;font-size:0.75rem;margin-top:0.4rem;display:block;">La vista previa refleja el fondo, la imagen y los colores del texto configurados arriba.</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeEditSliderModal()">Cancelar</button>
                <button type="submit" form="editSliderForm" class="btn btn-primary">
                    <i class="material-icons">save</i>
                    Guardar Cambios
                </button>
            </div>
        </div>
    `);

    // Agregar clase modal
    editModal.className = 'modal active';

    // Agregar al DOM
    document.body.appendChild(editModal);

    // Initialize live preview for edit modal (title field uses editSliderTitle)
    setTimeout(() => {
        const titleInput = editModal.querySelector('#editSliderForm input[id="editSliderTitle"]') ||
            editModal.querySelector('input[id^="editSlider"][id$="Title"]');
        // Wire title/subtitle oninput to preview
        ['editSliderTitle', 'editSliderSubTitle'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => livePreviewSlide('editSlider'));
        });
        // Wire opacity slider
        const opSlider = document.getElementById('editSliderImageOpacity');
        if (opSlider) opSlider.addEventListener('input', () => livePreviewSlide('editSlider'));
        // Clear stale preview URL from previous edit sessions
        window.editSliderPreviewUrl = null;
    }, 50);

    // Configurar drag and drop para la nueva área de carga
    setupEditSliderDragDrop();

    // Guardar ID de la imagen que se está editando
    editModal.dataset.imageId = image.id;
}

// Función para cerrar modal de edición
function closeEditSliderModal() {
    const modal = document.getElementById('editSliderModal');
    if (modal) {
        modal.remove();
    }
}

// Función para manejar selección de imagen en edición
function handleEditImageSelection(event) {
    const file = event.target.files[0];
    const selectedFileName = document.getElementById('editSelectedFileName');

    if (file) {
        selectedFileName.textContent = `Seleccionado: ${file.name}`;
        selectedFileName.style.display = 'block';
    } else {
        selectedFileName.style.display = 'none';
    }
}

// Función para configurar drag and drop en edición
function setupEditSliderDragDrop() {
    const editSliderUploadArea = document.getElementById('editSliderUploadArea');

    if (editSliderUploadArea) {
        editSliderUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            editSliderUploadArea.classList.add('dragover');
        });

        editSliderUploadArea.addEventListener('dragleave', () => {
            editSliderUploadArea.classList.remove('dragover');
        });

        editSliderUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            editSliderUploadArea.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(file.type)) {
                    const fileInput = document.getElementById('editSliderImageInput');
                    if (fileInput) {
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        fileInput.files = dt.files;
                        handleEditImageSelection({ target: fileInput });
                    }
                } else {
                    alert('Por favor selecciona un archivo de imagen válido (JPEG, PNG, GIF, WebP)');
                }
            }
        });

        editSliderUploadArea.addEventListener('click', () => {
            const input = document.getElementById('editSliderImageInput');
            if (input) {
                input.click();
            }
        });
    }
}

// Función para manejar envío del formulario de edición
async function handleEditSliderFormSubmit(event) {
    event.preventDefault();

    const modal = document.getElementById('editSliderModal');
    const imageId = modal.dataset.imageId;

    const formData = new FormData();

    // Obtener valores del formulario
    const title = document.getElementById('editSliderTitle').value.trim();
    const subtitle = document.getElementById('editSliderSubTitle').value.trim();
    const description = document.getElementById('editSliderDescription').value.trim();
    const position = document.getElementById('editSliderPosition').value;
    const isActive = document.getElementById('editSliderStatus').value === 'true';
    const fileInput = document.getElementById('editSliderImageInput');

    console.log('Valores del formulario de edición:', {
        title,
        description,
        position,
        isActive,
        hasFile: fileInput && fileInput.files && fileInput.files.length > 0
    });

    // Validaciones
    if (!title) {
        alert('El título es obligatorio');
        return;
    }

    // Preparar FormData
    formData.append('title', title);
    formData.append('subtitle', subtitle);
    formData.append('description', description);
    formData.append('position', position);
    formData.append('is_active', isActive);
    formData.append('bg_color', document.getElementById('editSliderBgColor')?.value || 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)');
    const editOpacityPct = parseInt(document.getElementById('editSliderImageOpacity')?.value ?? 35, 10);
    formData.append('image_opacity', (editOpacityPct / 100).toFixed(2));
    formData.append('text_color', document.getElementById('editSliderTextColor')?.value || '#ffffff');
    formData.append('badge_text', document.getElementById('editSliderBadgeText')?.value.trim() || '');
    formData.append('badge_color', document.getElementById('editSliderBadgeColor')?.value || '#ffffff');

    // Solo agregar imagen si se seleccionó una nueva
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Solo se permiten archivos de imagen (JPEG, PNG, GIF, WebP)');
            return;
        }

        // Validar tamaño del archivo (10MB máximo)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert('La imagen no puede superar los 10MB');
            return;
        }

        formData.append('image', file);
    }

    try {
        // Mostrar loading
        const submitBtn = document.querySelector('#editSliderModal button[type="submit"]');
        if (submitBtn) {
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = window.safeHTML('<i class="material-icons">hourglass_empty</i> Guardando...');
            submitBtn.disabled = true;
        }

        // Enviar actualización al servidor
        console.log('Enviando FormData al servidor...');
        const response = await apiRequest(`/api/slider/${imageId}`, {
            method: 'PUT',
            body: formData
        });
        console.log('Respuesta del servidor:', response.status);

        if (response.ok) {
            const updatedImage = await response.json();
            showSuccessModal('Imagen del slider actualizada exitosamente');
            closeEditSliderModal();
            // Actualizar la imagen en el array local para reflejar cambios inmediatamente
            const index = sliderImages.findIndex(img => img.id === imageId);
            if (index !== -1) {
                sliderImages[index] = updatedImage;
                displaySliderImages(sliderImages); // Actualizar la UI inmediatamente
            } else {
                loadSliderImages(); // Fallback: recargar desde servidor
            }
        } else {
            const error = await response.json();
            alert('Error al actualizar imagen: ' + (error.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al actualizar imagen del slider:', error);
        alert('Error de conexión al actualizar imagen del slider');
    } finally {
        // Restaurar botón
        const submitBtn = document.querySelector('#editSliderModal button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = window.safeHTML('<i class="material-icons">save</i> Guardar Cambios');
            submitBtn.disabled = false;
        }
    }
}

// Función para manejar el envío del formulario del slider
async function handleSliderFormSubmit(event) {
    event.preventDefault();
    console.log('Iniciando envío del formulario del slider');

    const form = event.target;
    const formData = new FormData();

    // Obtener valores del formulario usando IDs específicos
    const title = document.getElementById('sliderTitle')?.value.trim() || '';
    const subtitle = document.getElementById('slidersubTitle')?.value.trim() || '';
    const description = document.getElementById('sliderDescription')?.value.trim() || '';
    const position = document.getElementById('sliderPosition')?.value || '0';
    const fileInput = document.getElementById('sliderImageInput');

    console.log('Valores del formulario del slider:', { title, description, position });
    console.log('fileInput encontrado:', fileInput);
    console.log('fileInput.files:', fileInput ? fileInput.files : 'fileInput es null');
    console.log('fileInput.files[0]:', fileInput && fileInput.files ? fileInput.files[0] : 'no hay archivo');

    // Validaciones
    if (!title) {
        alert('El título es obligatorio');
        return;
    }

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        console.error('Validación fallida: no hay archivo seleccionado');
        alert('Debe seleccionar una imagen');
        return;
    }

    const file = fileInput.files[0];
    console.log('Imagen seleccionada:', file.name, file.type, file.size);

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        alert('Solo se permiten archivos de imagen (JPEG, PNG, GIF, WebP)');
        return;
    }

    // Validar tamaño del archivo (10MB máximo)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert('La imagen no puede superar los 10MB');
        return;
    }

    // Preparar FormData
    formData.append('title', title);
    formData.append('subtitle', subtitle);
    formData.append('description', description);
    formData.append('position', position);
    formData.append('bg_color', document.getElementById('sliderBgColor')?.value || 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)');
    const opacityPct = parseInt(document.getElementById('sliderImageOpacity')?.value ?? 35, 10);
    formData.append('image_opacity', (opacityPct / 100).toFixed(2));
    formData.append('text_color', document.getElementById('sliderTextColor')?.value || '#ffffff');
    if (file) formData.append('image', file);

    console.log('FormData del slider preparado, enviando al servidor...');

    // Mostrar loading
    const submitBtn = document.querySelector('#sliderModal button[type="submit"]');
    if (submitBtn) {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = window.safeHTML('<i class="material-icons">hourglass_empty</i> Subiendo...');
        submitBtn.disabled = true;

        // Restaurar botón después
        setTimeout(() => {
            submitBtn.innerHTML = window.safeHTML(originalText);
            submitBtn.disabled = false;
        }, 1000);
    }

    // Crear imagen del slider
    const success = await createSliderImage(formData);

    // Limpiar formulario si fue exitoso
    if (success) {
        form.reset();
        // Limpiar también el indicador de archivo seleccionado
        const selectedFileName = document.getElementById('selectedFileName');
        if (selectedFileName) {
            selectedFileName.style.display = 'none';
        }
        // Limpiar el input file explícitamente
        const fileInput = document.getElementById('sliderImageInput');
        if (fileInput) {
            fileInput.value = '';
        }
        // Resetear color picker al primer swatch (azul claro)
        const swatches = document.querySelectorAll('#sliderBgColorPicker .slider-color-swatch');
        swatches.forEach((s, i) => s.style.borderColor = i === 0 ? 'var(--orange)' : 'transparent');
        const hiddenInput = document.getElementById('sliderBgColor');
        if (hiddenInput) hiddenInput.value = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)';
    }
}

// ─── Color picker helpers ─────────────────────────────────────────────────────

// Called when a preset swatch button is clicked
// hiddenId = 'sliderBgColor' or 'editSliderBgColor'
// textId   = 'sliderColorText'  or 'editSliderColorText'
// nativeId = 'sliderColorNative' or 'editSliderColorNative'
function selectSliderBgColor(button, hiddenId, textId, nativeId) {
    const container = button.closest('div');
    // Deselect all swatches in this picker
    container.querySelectorAll('.slider-color-swatch').forEach(s => {
        s.style.borderColor = 'transparent';
    });
    button.style.borderColor = 'var(--orange, #f97316)';

    const gradient = button.getAttribute('data-gradient');

    // Update hidden input
    const hidden = hiddenId ? document.getElementById(hiddenId) : null;
    if (hidden) hidden.value = gradient;

    // Sync the text field
    const textEl = textId ? document.getElementById(textId) : null;
    if (textEl) textEl.value = gradient;

    // Try to extract a base color for the native picker (first hex after #)
    if (nativeId) {
        const hexMatch = gradient.match(/#([0-9a-fA-F]{6})/);
        const nativeEl = document.getElementById(nativeId);
        if (nativeEl && hexMatch) nativeEl.value = '#' + hexMatch[1];
    }
    // Update live preview
    const previewPrefix = hiddenId && hiddenId.startsWith('edit') ? 'editSlider' : 'slider';
    livePreviewSlide(previewPrefix);
}

// Called when the native <input type="color"> changes
// Creates a gradient from the selected solid color
function syncColorFromNative(nativeId, hiddenId, textId, pickerId) {
    const nativeEl = document.getElementById(nativeId);
    if (!nativeEl) return;
    const hex = nativeEl.value; // e.g. "#1e40af"
    // Darken 15% for gradient end
    const darken = (h) => {
        const n = parseInt(h.slice(1), 16);
        const r = Math.max(0, ((n >> 16) & 0xff) - 38);
        const g = Math.max(0, ((n >> 8) & 0xff) - 38);
        const b = Math.max(0, (n & 0xff) - 38);
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    };
    const gradient = `linear-gradient(135deg, ${hex} 0%, ${darken(hex)} 100%)`;

    // Update hidden input
    const hidden = hiddenId ? document.getElementById(hiddenId) : null;
    if (hidden) hidden.value = gradient;

    // Update text field
    const textEl = textId ? document.getElementById(textId) : null;
    if (textEl) textEl.value = gradient;

    // Deselect all swatches (custom color)
    if (pickerId) {
        document.querySelectorAll(`#${pickerId} .slider-color-swatch`).forEach(s => {
            s.style.borderColor = 'transparent';
        });
    }
    // Update live preview
    const previewPrefix2 = hiddenId && hiddenId.startsWith('edit') ? 'editSlider' : 'slider';
    livePreviewSlide(previewPrefix2);
}

// Called as the user types directly in the color code text field
function syncColorFromText(textId, hiddenId, pickerId) {
    const textEl = document.getElementById(textId);
    if (!textEl) return;
    const val = textEl.value.trim();
    if (!val) return;

    // Update hidden input immediately
    const hidden = hiddenId ? document.getElementById(hiddenId) : null;
    if (hidden) hidden.value = val;

    // Deselect all swatches (custom value)
    if (pickerId) {
        document.querySelectorAll(`#${pickerId} .slider-color-swatch`).forEach(s => {
            s.style.borderColor = 'transparent';
        });
    }
    // Update live preview
    const previewPrefix3 = hiddenId && hiddenId.startsWith('edit') ? 'editSlider' : 'slider';
    livePreviewSlide(previewPrefix3);
}

// ─── Set text color from preset swatch ───────────────────────────────────────
function setTextColor(inputId, hex) {
    const el = document.getElementById(inputId);
    if (el) el.value = hex;
}

// ─── Live preview of the slide ───────────────────────────────────────────────
// prefix = 'slider' (create modal) or 'editSlider' (edit modal)
function livePreviewSlide(prefix) {
    // IDs differ slightly between create and edit modals
    const isEdit = prefix === 'editSlider';
    const previewEl = document.getElementById(prefix + 'LivePreview');
    const imgEl = document.getElementById(prefix + 'PreviewImg');
    const contentEl = document.getElementById(prefix + 'PreviewContent');
    const titleEl = document.getElementById(prefix + 'PreviewTitle');
    const subEl = document.getElementById(prefix + 'PreviewSub');
    if (!previewEl) return;

    // 1. Background color
    const bgColor = document.getElementById(isEdit ? 'editSliderBgColor' : 'sliderBgColor')?.value
        || 'linear-gradient(135deg, #f0f9ff, #e0f2fe)';
    previewEl.style.background = bgColor;

    // 2. Image overlay
    const opacity = (parseInt(
        document.getElementById(isEdit ? 'editSliderImageOpacity' : 'sliderImageOpacity')?.value ?? 35
        , 10) / 100).toFixed(2);

    // image URL: check stored preview URL
    const urlKey = prefix + 'PreviewUrl';
    const storedUrl = window[urlKey];

    // For edit modal, also use an existing image if no new file picked
    let imgSrc = storedUrl || null;
    if (!imgSrc && isEdit) {
        // Try the existing image shown in the edit modal
        const existingImg = document.querySelector('#editSliderModal .form-group img');
        if (existingImg) imgSrc = existingImg.src;
    }
    if (imgEl) {
        if (imgSrc) {
            imgEl.style.backgroundImage = `url(${imgSrc})`;
            imgEl.style.opacity = opacity;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
    }

    // 3. Text color
    const textColor = document.getElementById(isEdit ? 'editSliderTextColor' : 'sliderTextColor')?.value || '#ffffff';
    if (contentEl) contentEl.style.color = textColor;

    // 4. Title and subtitle
    const title = document.getElementById(isEdit ? 'editSliderTitle' : 'sliderTitle')?.value || 'Título del slide';
    const subtitle = document.getElementById(isEdit ? 'editSliderSubTitle' : 'slidersubTitle')?.value || 'Subtítulo aquí';
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;

    // 5. Badge text and color
    const badgeEl = document.getElementById(prefix + 'PreviewBadge');
    if (badgeEl) {
        const badgeText = document.getElementById(isEdit ? 'editSliderBadgeText' : 'sliderBadgeText')?.value
            || 'Sistema en línea • Monitoreo 24/7';
        const badgeColor = document.getElementById(isEdit ? 'editSliderBadgeColor' : 'sliderBadgeColor')?.value || '#ffffff';
        badgeEl.textContent = '⬤ ' + badgeText;
        badgeEl.style.color = badgeColor;
    }
}

// Whenever a new image is selected for the CREATE modal, store the preview URL
const _origHandleImageSelection = window.handleImageSelection;
window.handleImageSelectionWithPreview = function (event) {
    const file = event?.target?.files?.[0] || event;
    if (file && file instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
            window.sliderPreviewUrl = e.target.result;
            livePreviewSlide('slider');
        };
        reader.readAsDataURL(file);
    }
};

// ─── Drag and Drop Upload para el slider ─────────────────────────────────────
const sliderUploadArea = document.getElementById('sliderUploadArea');

if (sliderUploadArea) {
    console.log('Configurando event listeners para sliderUploadArea');

    sliderUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        sliderUploadArea.classList.add('dragover');
    });

    sliderUploadArea.addEventListener('dragleave', () => {
        sliderUploadArea.classList.remove('dragover');
    });

    sliderUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        sliderUploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        console.log('Archivos soltados:', files);
        if (files.length > 0) {
            const file = files[0];
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedTypes.includes(file.type)) {
                // Asignar el archivo al input file
                const fileInput = document.getElementById('sliderImageInput');
                if (fileInput) {
                    console.log('Asignando archivo al input:', file.name);
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInput.files = dt.files;
                    handleImageSelection({ target: fileInput }); // Actualizar la UI
                } else {
                    console.error('Input file no encontrado para asignar archivo');
                }
            } else {
                alert('Por favor selecciona un archivo de imagen válido (JPEG, PNG, GIF, WebP)');
            }
        }
    });

    sliderUploadArea.addEventListener('click', () => {
        const input = document.getElementById('sliderImageInput');
        if (input) {
            console.log('Haciendo click en input file desde upload area');
            input.click();
        } else {
            console.error('Input file no encontrado en click');
        }
    });
} else {
    console.warn('sliderUploadArea no encontrado - funcionalidad de drag and drop limitada');
}

// Drag and Drop Upload para reportes (existente)
const uploadArea = document.getElementById('uploadArea');

if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                // Handle file upload
                alert(`Archivo seleccionado: ${file.name}`);
            } else {
                alert('Por favor selecciona un archivo PDF');
            }
        }
    });

    uploadArea.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                alert(`Archivo seleccionado: ${file.name}`);
            }
        };
        input.click();
    });
}
// ============================================================
// M�DULO ALERTAS DAI (CDN)
// ============================================================

let daiAlertas = [];
let daiFiltradas = [];
let daiPage = 1;
const DAI_PAGE_SIZE = 15;

const DAI_SAMPLE_DATA = [
    { id: 'ALT-2024-0001', dispositivo: 'WIM-001', estacion: 'Estaci�n Km 45+200', tipo: 'Sobrepeso detectado', severidad: 'critica', estado: 'activa', via: 'Ruta 45  Bogot�/Medell�n', fecha: '2024-12-15T08:32:00' },
    { id: 'ALT-2024-0002', dispositivo: 'RAD-003', estacion: 'Radar Cajic� Norte', tipo: 'Exceso de velocidad', severidad: 'alta', estado: 'en_revision', via: 'Autopista Norte Km 20+100', fecha: '2024-12-15T09:15:00' },
    { id: 'ALT-2024-0003', dispositivo: 'CNT-007', estacion: 'Conteo Fijo Dorado', tipo: 'Falla de comunicaci�n', severidad: 'alta', estado: 'activa', via: 'Ruta 80  Bogot�/Cali', fecha: '2024-12-15T10:00:00' },
    { id: 'ALT-2024-0004', dispositivo: 'VID-012', estacion: 'C�mara Siberia', tipo: 'Obstrucci�n de carril', severidad: 'media', estado: 'resuelta', via: 'Autopista Medell�n Km 5+600', fecha: '2024-12-15T07:45:00' },
    { id: 'ALT-2024-0005', dispositivo: 'WIM-004', estacion: 'Estaci�n Km 112+000', tipo: 'Sensor fuera de rango', severidad: 'media', estado: 'activa', via: 'Ruta 25  Bogot�/Girardot', fecha: '2024-12-15T11:20:00' },
    { id: 'ALT-2024-0006', dispositivo: 'RAD-009', estacion: 'Radar Zipaquir�', tipo: 'Velocidad promedio alta', severidad: 'baja', estado: 'resuelta', via: 'Ruta 55  Bogot�/Tunja', fecha: '2024-12-14T23:10:00' },
    { id: 'ALT-2024-0007', dispositivo: 'CNT-002', estacion: 'Conteo Fijo La Caro', tipo: 'Bater�a baja (< 20%)', severidad: 'baja', estado: 'en_revision', via: 'Autopista Norte Km 15+800', fecha: '2024-12-14T20:30:00' },
    { id: 'ALT-2024-0008', dispositivo: 'WIM-006', estacion: 'Estaci�n Km 88+500', tipo: 'Sobrepeso detectado', severidad: 'critica', estado: 'resuelta', via: 'Ruta 45  Bogot�/Medell�n', fecha: '2024-12-14T15:55:00' },
    { id: 'ALT-2024-0009', dispositivo: 'VID-005', estacion: 'C�mara Ch�a', tipo: 'P�rdida de se�al de video', severidad: 'alta', estado: 'activa', via: 'Ruta 53 Km 2+300', fecha: '2024-12-15T12:05:00' },
    { id: 'ALT-2024-0010', dispositivo: 'RAD-015', estacion: 'Radar Mosquera', tipo: 'Falla de calibraci�n', severidad: 'media', estado: 'en_revision', via: 'Autopista Medell�n Km 18+400', fecha: '2024-12-15T06:00:00' },
];

function loadAlertasDAI() {
    daiAlertas = DAI_SAMPLE_DATA;
    daiFiltradas = [...daiAlertas];
    daiPage = 1;
    _renderDaiStats();
    _renderDaiTable();
}

function _renderDaiStats() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('dai-criticas').textContent = daiAlertas.filter(a => a.severidad === 'critica' && a.estado !== 'resuelta').length;
    document.getElementById('dai-altas').textContent = daiAlertas.filter(a => a.severidad === 'alta' && a.estado !== 'resuelta').length;
    document.getElementById('dai-medias').textContent = daiAlertas.filter(a => a.severidad === 'media' && a.estado !== 'resuelta').length;
    document.getElementById('dai-resueltas').textContent = daiAlertas.filter(a => a.estado === 'resuelta' && a.fecha.startsWith(today)).length;
}

function _renderDaiTable() {
    const tbody = document.getElementById('daiAlertsTableBody');
    const totalPages = Math.max(1, Math.ceil(daiFiltradas.length / DAI_PAGE_SIZE));
    const start = (daiPage - 1) * DAI_PAGE_SIZE;
    const pageData = daiFiltradas.slice(start, start + DAI_PAGE_SIZE);

    if (pageData.length === 0) {
        tbody.innerHTML = window.safeHTML(
            '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#6b7280;"><i class="material-icons" style="font-size:2rem;display:block;margin-bottom:0.5rem;">search_off</i>No se encontraron alertas</td></tr>'
        );
    } else {
        tbody.innerHTML = window.safeHTML(pageData.map(a => {
            const resolvBtn = a.estado !== 'resuelta'
                ? '<button class="btn btn-primary" style="padding:0.3rem 0.6rem;font-size:0.8rem;margin-left:0.25rem;" onclick="resolverAlertaDAI(\'' + a.id + '\')" title="Marcar resuelta"><i class="material-icons" style="font-size:1rem;">check</i></button>'
                : '';
            return '<tr>'
                + '<td><code style="font-size:0.8rem;">' + a.id + '</code></td>'
                + '<td><strong>' + a.dispositivo + '</strong><br><small style="color:#6b7280;">' + a.estacion + '</small></td>'
                + '<td>' + a.tipo + '</td>'
                + '<td>' + _daiSeveridadBadge(a.severidad) + '</td>'
                + '<td>' + _daiEstadoBadge(a.estado) + '</td>'
                + '<td style="font-size:0.85rem;">' + a.via + '</td>'
                + '<td style="white-space:nowrap;font-size:0.85rem;">' + new Date(a.fecha).toLocaleString('es-CO') + '</td>'
                + '<td>'
                + '  <button class="btn btn-secondary" style="padding:0.3rem 0.6rem;font-size:0.8rem;" onclick="verDetalleDAI(\'' + a.id + '\')" title="Ver detalle"><i class="material-icons" style="font-size:1rem;">visibility</i></button>'
                + resolvBtn
                + '</td>'
                + '</tr>';
        }).join(''));
    }

    const paginDiv = document.getElementById('daiPagination');
    paginDiv.style.display = daiFiltradas.length > DAI_PAGE_SIZE ? 'block' : 'none';
    document.getElementById('daiPageInfo').textContent = 'P�gina ' + daiPage + ' de ' + totalPages;
    document.getElementById('daiPrevBtn').disabled = daiPage <= 1;
    document.getElementById('daiNextBtn').disabled = daiPage >= totalPages;
}

function _daiSeveridadBadge(sev) {
    const map = { critica: ['#ef4444', '', 'Cr�tica'], alta: ['#f97316', '', 'Alta'], media: ['#f59e0b', '', 'Media'], baja: ['#10b981', '', 'Baja'] };
    const d = map[sev] || ['#6b7280', '', 'Desconocida'];
    return '<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.78rem;font-weight:600;background:' + d[0] + '18;color:' + d[0] + ';">' + d[1] + ' ' + d[2] + '</span>';
}

function _daiEstadoBadge(est) {
    const map = { activa: ['#ef4444', 'Activa'], en_revision: ['#f59e0b', 'En Revisi�n'], resuelta: ['#10b981', 'Resuelta'] };
    const d = map[est] || ['#6b7280', 'Desconocido'];
    return '<span style="padding:0.2rem 0.6rem;border-radius:20px;font-size:0.78rem;font-weight:600;background:' + d[0] + '18;color:' + d[0] + ';">' + d[1] + '</span>';
}

function applyDaiFiltros() {
    const sev = document.getElementById('daiSeverityFilter').value;
    const est = document.getElementById('daiEstadoFilter').value;
    const disp = document.getElementById('daiDispositivoFilter').value;
    const desde = document.getElementById('daiDateFrom').value;
    const hasta = document.getElementById('daiDateTo').value;
    daiFiltradas = daiAlertas.filter(a => {
        if (sev && a.severidad !== sev) return false;
        if (est && a.estado !== est) return false;
        if (disp && !a.dispositivo.toUpperCase().startsWith(disp.substring(0, 3).toUpperCase())) return false;
        if (desde && a.fecha < desde) return false;
        if (hasta && a.fecha.slice(0, 10) > hasta) return false;
        return true;
    });
    daiPage = 1;
    _renderDaiTable();
}

function clearDaiFiltros() {
    ['daiSeverityFilter', 'daiEstadoFilter', 'daiDispositivoFilter', 'daiDateFrom', 'daiDateTo'].forEach(id => { document.getElementById(id).value = ''; });
    daiFiltradas = [...daiAlertas];
    daiPage = 1;
    _renderDaiTable();
}

function changeDaiPage(dir) {
    const totalPages = Math.ceil(daiFiltradas.length / DAI_PAGE_SIZE);
    daiPage = Math.max(1, Math.min(totalPages, daiPage + dir));
    _renderDaiTable();
}

function verDetalleDAI(id) {
    const a = daiAlertas.find(x => x.id === id);
    if (!a) return;
    alert('ALERTA DAI  ' + a.id + '\n\nDispositivo: ' + a.dispositivo + '\nEstacin: ' + a.estacion + '\nTipo: ' + a.tipo + '\nSeveridad: ' + a.severidad.toUpperCase() + '\nEstado: ' + a.estado + '\nVa: ' + a.via + '\nFecha: ' + new Date(a.fecha).toLocaleString('es-CO'));
}

function resolverAlertaDAI(id) {
    if (!ccmConfirm('¿Marcar la alerta ' + id + ' como RESUELTA?')) return;
    const idx = daiAlertas.findIndex(x => x.id === id);
    if (idx !== -1) {
        daiAlertas[idx].estado = 'resuelta';
        applyDaiFiltros();
        _renderDaiStats();
        showSuccessModal('Alerta ' + id + ' marcada como resuelta.');
    }
}

function exportAlertasDAI() {
    const headers = ['ID Alerta', 'Dispositivo', 'Estaci�n', 'Tipo', 'Severidad', 'Estado', 'V�a / Corredor', 'Fecha/Hora'];
    const rows = daiFiltradas.map(a => [a.id, a.dispositivo, '"' + a.estacion + '"', '"' + a.tipo + '"', a.severidad, a.estado, '"' + a.via + '"', new Date(a.fecha).toLocaleString('es-CO')].join(','));
    const csv = [headers.join(',')].concat(rows).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alertas_dai_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
}

// Logout confirm helpers


// ========================================
// MÓDULO DESCARGAS — CENTRO DE DESCARGAS
// ========================================

let dlCurrentPage = 1;
let dlSearchTimer = null;

function dlDebounceSearch() {
    clearTimeout(dlSearchTimer);
    dlSearchTimer = setTimeout(() => loadDownloadsAdmin(1), 400);
}

function dlPrevPage() { if (dlCurrentPage > 1) loadDownloadsAdmin(dlCurrentPage - 1); }
function dlNextPage() { loadDownloadsAdmin(dlCurrentPage + 1); }

async function loadDownloadsAdmin(page = 1) {
    dlCurrentPage = page;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const search = (document.getElementById('dlSearchInput')?.value || '').trim();
    const status = document.getElementById('dlStatusFilter')?.value || '';

    // Show loading, hide table & empty
    const dlLoading = document.getElementById('dlLoading');
    const dlTableContainer = document.getElementById('dlTableContainer');
    const dlEmpty = document.getElementById('dlEmpty');
    const dlPagination = document.getElementById('dlPagination');

    if (dlLoading) dlLoading.style.display = 'flex';
    if (dlTableContainer) dlTableContainer.style.display = 'none';
    if (dlEmpty) dlEmpty.style.display = 'none';
    if (dlPagination) dlPagination.style.display = 'none';

    try {
        const params = new URLSearchParams({ page, limit: 15 });
        if (search) params.set('search', search);
        if (status) params.set('status', status);

        const res = await fetch(`/api/downloads/all?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Update stats
        const { stats, downloads, pagination } = data;
        if (document.getElementById('dlStatTotal')) document.getElementById('dlStatTotal').textContent = stats.total_downloads;
        if (document.getElementById('dlStatToday')) document.getElementById('dlStatToday').textContent = stats.completed_today;
        if (document.getElementById('dlStatProcessing')) document.getElementById('dlStatProcessing').textContent = stats.processing;
        if (document.getElementById('dlStatFailed')) document.getElementById('dlStatFailed').textContent = stats.failed;

        if (dlLoading) dlLoading.style.display = 'none';

        if (downloads.length === 0) {
            if (dlEmpty) dlEmpty.style.display = 'block';
            return;
        }

        // Render table
        dlTableContainer.innerHTML = window.safeHTML(renderDownloadsTable(downloads));
        dlTableContainer.style.display = 'block';

        // Pagination
        if (pagination.total_pages > 1) {
            dlPagination.style.display = 'flex';
            const from = (pagination.current_page - 1) * pagination.per_page + 1;
            const to = Math.min(pagination.current_page * pagination.per_page, pagination.total);
            document.getElementById('dlPageInfo').textContent =
                `Mostrando ${from}–${to} de ${pagination.total}`;
            document.getElementById('dlPageCurrent').textContent = pagination.current_page;
            document.getElementById('dlPrevBtn').disabled = !pagination.has_prev;
            document.getElementById('dlNextBtn').disabled = !pagination.has_next;
        }
    } catch (err) {
        console.error('Error cargando descargas admin:', err);
        if (dlLoading) dlLoading.style.display = 'none';
        if (dlEmpty) {
            dlEmpty.querySelector('h3').textContent = 'Error al cargar descargas';
            dlEmpty.querySelector('p').textContent = err.message;
            dlEmpty.style.display = 'block';
        }
    }
}

function renderDownloadsTable(downloads) {
    const avatarColors = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308'];
    const statusMap = {
        completed: { label: 'Completado', icon: 'check_circle', cls: 'dl-badge-completed' },
        processing: { label: 'Procesando', icon: 'sync', cls: 'dl-badge-processing' },
        pending: { label: 'Pendiente', icon: 'schedule', cls: 'dl-badge-pending' },
        failed: { label: 'Fallido', icon: 'error', cls: 'dl-badge-failed' },
        expired: { label: 'Expirado', icon: 'timer_off', cls: 'dl-badge-expired' },
    };

    const rows = downloads.map((dl, idx) => {
        const name = dl.user_name || 'Desconocido';
        const email = dl.user_email || '—';
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2);
        const color = avatarColors[idx % avatarColors.length];

        // Filters
        const fp = dl.filters_parsed;
        let filtersHtml = '<span style="color:var(--gray-300)">—</span>';
        if (fp) {
            const tags = [];
            if (fp.deviceType) tags.push(`<span class="dl-filter-tag"><i class="material-icons">devices</i>${fp.deviceType}</span>`);
            if (fp.dateRange) tags.push(`<span class="dl-filter-tag"><i class="material-icons">date_range</i>${fp.dateRange}</span>`);
            if (fp.devices?.length) tags.push(`<span class="dl-filter-tag"><i class="material-icons">router</i>${fp.devices.length} dispositivo${fp.devices.length > 1 ? 's' : ''}</span>`);
            filtersHtml = `<div class="dl-filters-cell">${tags.join('')}</div>`;
        }

        // Status badge
        const st = statusMap[dl.status] || statusMap.pending;

        // Date
        const dateObj = dl.created_at ? new Date(dl.created_at) : null;
        const dateStr = dateObj ? dateObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const timeAgoStr = dateObj ? dlTimeAgo(dateObj) : '';

        // Download button
        const canDownload = dl.status === 'completed' && dl.download_url;
        const dlBtnHtml = canDownload
            ? `<button class="dl-download-btn" onclick="dlDownloadFile('${dl.id}')" title="Descargar archivo"><i class="material-icons">download</i></button>`
            : `<button class="dl-download-btn" disabled title="No disponible"><i class="material-icons">download</i></button>`;

        return `<tr>
            <td>
                <div class="dl-user-cell">
                    <div class="dl-user-avatar" style="background:${color}">${initials}</div>
                    <div>
                        <div class="dl-user-name">${name}</div>
                        <div class="dl-user-email">${email}</div>
                    </div>
                </div>
            </td>
            <td>${fp?.deviceType || dl.resource_type || '—'}</td>
            <td>${filtersHtml}</td>
            <td>${dl.file_size_formatted || '—'}</td>
            <td><span class="dl-badge ${st.cls}"><i class="material-icons" style="font-size:13px">${st.icon}</i> ${st.label}</span></td>
            <td class="dl-ip-cell">${dl.ip_address || '—'}</td>
            <td>
                <div class="dl-date-main">${dateStr}</div>
                <div class="dl-date-relative">${timeAgoStr}</div>
            </td>
            <td>${dlBtnHtml}</td>
        </tr>`;
    }).join('');

    return `<div style="overflow-x:auto"><table class="dl-table">
        <thead><tr>
            <th>Usuario</th>
            <th>Tipo</th>
            <th>Filtros</th>
            <th>Tamaño</th>
            <th>Estado</th>
            <th>IP</th>
            <th>Fecha</th>
            <th>Acción</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table></div>`;
}

function dlTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    return `Hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
}

async function dlDownloadFile(downloadId) {
    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`/api/downloads/${downloadId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.message || 'Error al descargar');
            return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?(.+?)"?$/);
        const fileName = match ? match[1] : `descarga_${downloadId}.csv`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error descargando archivo:', err);
        alert('Error al descargar el archivo');
    }
}


// ════════════════════════════════════════════════════════════════════════════════
//  AUDIT MODULE — World-Class Audit Log Viewer
// ════════════════════════════════════════════════════════════════════════════════

let auCurrentPage = 1;
let auSearchTimer = null;

// Action metadata map: icon, color, label in Spanish
const AU_ACTIONS = {
    login: { icon: 'login', color: '#3b82f6', bg: '#eff6ff', label: 'Inicio de sesión' },
    logout: { icon: 'logout', color: '#6b7280', bg: '#f3f4f6', label: 'Cierre de sesión' },
    register: { icon: 'person_add', color: '#8b5cf6', bg: '#faf5ff', label: 'Registro de usuario' },
    send_verification_code: { icon: 'mark_email_read', color: '#f59e0b', bg: '#fffbeb', label: 'Envío código verificación' },
    verify_code_success: { icon: 'verified', color: '#22c55e', bg: '#f0fdf4', label: 'Código verificado' },
    verify_code_failed: { icon: 'gpp_bad', color: '#ef4444', bg: '#fef2f2', label: 'Verificación fallida' },
    create_report: { icon: 'note_add', color: '#3b82f6', bg: '#eff6ff', label: 'Reporte creado' },
    update_report: { icon: 'edit_note', color: '#f59e0b', bg: '#fffbeb', label: 'Reporte actualizado' },
    delete_report: { icon: 'delete', color: '#ef4444', bg: '#fef2f2', label: 'Reporte eliminado' },
    toggle_visibility: { icon: 'visibility', color: '#8b5cf6', bg: '#faf5ff', label: 'Visibilidad cambiada' },
    toggle_featured: { icon: 'star', color: '#f59e0b', bg: '#fffbeb', label: 'Destacado cambiado' },
    download_report: { icon: 'file_download', color: '#06b6d4', bg: '#ecfeff', label: 'Reporte descargado' },
    create_slider: { icon: 'add_photo_alternate', color: '#22c55e', bg: '#f0fdf4', label: 'Imagen slider creada' },
    update_slider: { icon: 'image', color: '#f59e0b', bg: '#fffbeb', label: 'Imagen slider actualizada' },
    delete_slider: { icon: 'hide_image', color: '#ef4444', bg: '#fef2f2', label: 'Imagen slider eliminada' },
    request_download: { icon: 'cloud_download', color: '#06b6d4', bg: '#ecfeff', label: 'Descarga solicitada' },
    download_completed: { icon: 'download_done', color: '#22c55e', bg: '#f0fdf4', label: 'Descarga completada' },
    download_failed: { icon: 'cloud_off', color: '#ef4444', bg: '#fef2f2', label: 'Descarga fallida' },
    update_role: { icon: 'admin_panel_settings', color: '#8b5cf6', bg: '#faf5ff', label: 'Rol actualizado' },
    toggle_user_active: { icon: 'toggle_on', color: '#f59e0b', bg: '#fffbeb', label: 'Usuario activado/desactivado' },
    update_config: { icon: 'settings', color: '#6b7280', bg: '#f3f4f6', label: 'Configuración actualizada' },
};

const AU_MODULES = {
    user: { icon: 'person', label: 'Usuarios' },
    report: { icon: 'description', label: 'Reportes' },
    slider: { icon: 'image', label: 'Slider' },
    download: { icon: 'cloud_download', label: 'Descargas' },
    config: { icon: 'settings', label: 'Config' },
};

function auDebounceSearch() {
    clearTimeout(auSearchTimer);
    auSearchTimer = setTimeout(() => loadAuditAdmin(1), 400);
}

function auPrevPage() { if (auCurrentPage > 1) loadAuditAdmin(auCurrentPage - 1); }
function auNextPage() { loadAuditAdmin(auCurrentPage + 1); }

function auTimeAgo(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffH < 24) return `Hace ${diffH}h`;
    if (diffD < 7) return `Hace ${diffD}d`;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function auFormatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
    return d.toLocaleString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
}

function auGetActionMeta(action) {
    return AU_ACTIONS[action] || { icon: 'info', color: '#6b7280', bg: '#f3f4f6', label: action || 'Desconocido' };
}

function auParseJson(str) {
    if (!str) return null;
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch { return null; }
}

function auRenderJsonDiff(oldVals, newVals) {
    let html = '<div class="au-detail-grid">';
    if (oldVals && Object.keys(oldVals).length) {
        html += '<div class="au-detail-col"><div class="au-detail-label"><i class="material-icons" style="font-size:14px;color:#ef4444">remove_circle</i> Valores anteriores</div>';
        html += '<div class="au-detail-json">';
        for (const [k, v] of Object.entries(oldVals)) {
            html += `<div class="au-kv"><span class="au-k">${k}:</span> <span class="au-v">${typeof v === 'object' ? JSON.stringify(v) : v}</span></div>`;
        }
        html += '</div></div>';
    }
    if (newVals && Object.keys(newVals).length) {
        html += '<div class="au-detail-col"><div class="au-detail-label"><i class="material-icons" style="font-size:14px;color:#22c55e">add_circle</i> Valores nuevos</div>';
        html += '<div class="au-detail-json">';
        for (const [k, v] of Object.entries(newVals)) {
            html += `<div class="au-kv"><span class="au-k">${k}:</span> <span class="au-v">${typeof v === 'object' ? JSON.stringify(v) : v}</span></div>`;
        }
        html += '</div></div>';
    }
    html += '</div>';
    return html;
}

function toggleAuditDetail(id) {
    const row = document.getElementById(`au-detail-${id}`);
    if (row) {
        row.classList.toggle('au-detail-open');
    }
}

function renderAuditTable(logs) {
    if (!logs || !logs.length) return '';
    let html = `<table class="au-table">
        <thead>
            <tr>
                <th style="width:40px"></th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Estado</th>
                <th>Fecha / Hora</th>
                <th>IP</th>
                <th style="width:40px"></th>
            </tr>
        </thead><tbody>`;

    logs.forEach((log, idx) => {
        const meta = auGetActionMeta(log.action);
        const modMeta = AU_MODULES[log.resource_type] || { icon: 'category', label: log.resource_type || '—' };
        const statusClass = log.status === 'success' ? 'au-status-ok' : (log.status === 'failed' ? 'au-status-fail' : 'au-status-pending');
        const statusLabel = log.status === 'success' ? 'Exitoso' : (log.status === 'failed' ? 'Fallido' : (log.status || '—'));
        const userName = log.user_name || 'Sistema';
        const userEmail = log.user_email || '';
        const initials = userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const oldVals = auParseJson(log.old_values);
        const newVals = auParseJson(log.new_values);
        const hasDetail = oldVals || newVals || log.user_agent;

        html += `
        <tr class="au-row ${hasDetail ? 'au-row-expandable' : ''}" ${hasDetail ? `onclick="toggleAuditDetail('${log.id || idx}')"` : ''}>
            <td><div class="au-action-icon" style="background:${meta.bg};color:${meta.color}"><i class="material-icons">${meta.icon}</i></div></td>
            <td>
                <div class="au-user-cell">
                    <div class="au-avatar" style="background:${meta.bg};color:${meta.color}">${initials}</div>
                    <div>
                        <div class="au-user-name">${userName}</div>
                        <div class="au-user-email">${userEmail}</div>
                    </div>
                </div>
            </td>
            <td><span class="au-action-badge" style="background:${meta.bg};color:${meta.color}">${meta.label}</span></td>
            <td><span class="au-module-badge"><i class="material-icons" style="font-size:14px">${modMeta.icon}</i> ${modMeta.label}</span></td>
            <td><span class="au-status ${statusClass}">${statusLabel}</span></td>
            <td>
                <div class="au-time-cell">
                    <div class="au-time-ago">${auTimeAgo(log.created_at)}</div>
                    <div class="au-time-full">${auFormatDateTime(log.created_at)}</div>
                </div>
            </td>
            <td class="au-ip">${log.ip_address || '—'}</td>
            <td>${hasDetail ? '<i class="material-icons au-expand-icon">expand_more</i>' : ''}</td>
        </tr>`;

        if (hasDetail) {
            html += `<tr class="au-detail-row" id="au-detail-${log.id || idx}">
                <td colspan="8">
                    <div class="au-detail-content">
                        ${(oldVals || newVals) ? auRenderJsonDiff(oldVals, newVals) : ''}
                        ${log.user_agent ? `<div class="au-ua"><i class="material-icons" style="font-size:14px">devices</i> ${log.user_agent.substring(0, 100)}</div>` : ''}
                        ${log.resource_id ? `<div class="au-ua"><i class="material-icons" style="font-size:14px">fingerprint</i> Recurso ID: ${log.resource_id}</div>` : ''}
                    </div>
                </td>
            </tr>`;
        }
    });

    html += '</tbody></table>';
    return html;
}

async function loadAuditAdmin(page = 1) {
    auCurrentPage = page;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const search = (document.getElementById('auSearchInput')?.value || '').trim();
    const action = document.getElementById('auActionFilter')?.value || '';
    const resourceType = document.getElementById('auModuleFilter')?.value || '';
    const status = document.getElementById('auStatusFilter')?.value || '';
    const dateFrom = document.getElementById('auDateFrom')?.value || '';
    const dateTo = document.getElementById('auDateTo')?.value || '';

    const auLoading = document.getElementById('auLoading');
    const auTableContainer = document.getElementById('auTableContainer');
    const auEmpty = document.getElementById('auEmpty');
    const auPagination = document.getElementById('auPagination');

    // Show loading
    if (auLoading) auLoading.style.display = 'flex';
    if (auTableContainer) auTableContainer.style.display = 'none';
    if (auEmpty) auEmpty.style.display = 'none';
    if (auPagination) auPagination.style.display = 'none';

    try {
        const params = new URLSearchParams({ page, limit: 25 });
        if (action) params.set('action', action);
        if (resourceType) params.set('resource_type', resourceType);
        if (status) params.set('status', status);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        if (search) params.set('search', search);

        const res = await fetch(`/api/audit?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const logs = data.audit_logs || [];
        const pagination = data.pagination || {};

        // Calculate stats from response
        const total = pagination.total || logs.length;
        // We'll approximate stats from current page data context
        if (document.getElementById('auStatTotal')) document.getElementById('auStatTotal').textContent = total;

        // Calculate stats from logs array
        const today = new Date().toISOString().split('T')[0];
        let todayCount = 0, loginCount = 0, failedCount = 0;
        logs.forEach(l => {
            const logDate = (l.created_at || '').substring(0, 10);
            if (logDate === today) todayCount++;
            if (l.action === 'login') loginCount++;
            if (l.status === 'failed') failedCount++;
        });

        if (document.getElementById('auStatToday')) document.getElementById('auStatToday').textContent = data.stats?.today || todayCount;
        if (document.getElementById('auStatLogins')) document.getElementById('auStatLogins').textContent = data.stats?.logins || loginCount;
        if (document.getElementById('auStatFailed')) document.getElementById('auStatFailed').textContent = data.stats?.failed || failedCount;

        if (auLoading) auLoading.style.display = 'none';

        if (logs.length === 0) {
            if (auEmpty) auEmpty.style.display = 'flex';
            return;
        }

        // Render table
        auTableContainer.innerHTML = window.safeHTML(renderAuditTable(logs));
        auTableContainer.style.display = 'block';

        // Pagination
        const totalPages = pagination.pages || 1;
        if (totalPages > 1) {
            auPagination.style.display = 'flex';
            const from = (page - 1) * (pagination.limit || 25) + 1;
            const to = Math.min(page * (pagination.limit || 25), total);
            document.getElementById('auPageInfo').textContent = `Mostrando ${from}–${to} de ${total}`;
            document.getElementById('auPageCurrent').textContent = page;
            document.getElementById('auPrevBtn').disabled = page <= 1;
            document.getElementById('auNextBtn').disabled = page >= totalPages;
        }
    } catch (err) {
        console.error('Error cargando auditoría:', err);
        if (auLoading) auLoading.style.display = 'none';
        if (auEmpty) {
            auEmpty.querySelector('h3').textContent = 'Error al cargar auditoría';
            auEmpty.querySelector('p').textContent = err.message;
            auEmpty.style.display = 'flex';
        }
    }
}

// =====================================================================
// CONFIGURACION MODULE
// =====================================================================

let _cfgEmail = '';

// Load settings from database on section open
async function loadSettingsConfig() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/config', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return;
        const data = await res.json();
        const cfg = data.config || {};

        // Populate General Config fields
        const nameEl = document.getElementById('cfgSystemName');
        const emailEl = document.getElementById('cfgEmail');
        if (nameEl && cfg.site_name) nameEl.value = cfg.site_name;
        if (emailEl && cfg.notification_email) emailEl.value = cfg.notification_email;

        // Populate Notification toggles
        const notifEl = document.getElementById('cfgNotifEnabled');
        const secEl = document.getElementById('cfgSecurityAlerts');
        const weeklyEl = document.getElementById('cfgWeeklyDigest');
        const daiNotifEl = document.getElementById('cfgDaiNotifEnabled');
        if (notifEl) notifEl.checked = cfg.notifications_enabled !== false && cfg.notifications_enabled !== 'false';
        if (secEl) secEl.checked = cfg.security_alerts !== false && cfg.security_alerts !== 'false';
        if (weeklyEl) weeklyEl.checked = cfg.weekly_digest === true || cfg.weekly_digest === 'true';
        if (daiNotifEl) {
            const val = cfg.dai_notifications_enabled !== false && cfg.dai_notifications_enabled !== 'false';
            daiNotifEl.checked = val;
            window.DAI = window.DAI || {};
            window.DAI.notifDaiEnabled = val;
            console.log('[Config] DAI alerts enabled:', val);
        }

    } catch (err) {
        console.error('Error loading config:', err);
    }
}

async function saveGeneralConfig() {
    const name = document.getElementById('cfgSystemName')?.value?.trim();
    const email = document.getElementById('cfgEmail')?.value?.trim();
    const status = document.getElementById('cfgSaveStatus');

    if (!name) { if (status) { status.textContent = 'El nombre es requerido'; status.style.color = '#ef4444'; } return; }

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ site_name: name, notification_email: email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar');
        if (status) {
            status.style.color = '#22c55e';
            status.textContent = '\u2713 Cambios guardados';
            setTimeout(() => { status.textContent = ''; }, 3000);
        }
    } catch (err) {
        if (status) { status.style.color = '#ef4444'; status.textContent = err.message; }
    }
}

async function toggleNotifications(el) {
    const key = el.id === 'cfgNotifEnabled' ? 'notifications_enabled'
        : el.id === 'cfgSecurityAlerts' ? 'security_alerts'
            : el.id === 'cfgWeeklyDigest' ? 'weekly_digest'
                : el.id === 'cfgDaiNotifEnabled' ? 'dai_notifications_enabled' : null;
    if (!key) return;

    // Actualizar estado local inmediatamente
    if (key === 'dai_notifications_enabled') {
        window.DAI = window.DAI || {};
        window.DAI.notifDaiEnabled = el.checked;
        console.log('[Config] Toggle DAI alerts:', el.checked);

        // Mostrar feedback visual rápido
        const msg = el.checked ? 'Alertas emergentes DAI habilitadas' : 'Alertas emergentes DAI deshabilitadas';
        if (typeof showSuccessModal === 'function') {
            // No queremos un modal intrusivo cada vez, mejor un pequeño toast si existe
            // Pero como no tenemos un snackbar genérico simple, usaremos un console log visible
            console.log(`%c🔔 ${msg}`, 'color: #3b82f6; font-weight: bold;');
        }
    }

    try {
        const token = localStorage.getItem('authToken');
        const body = {};
        body[key] = el.checked;
        await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(body)
        });
    } catch (err) {
        console.error('Error saving notification toggle:', err);
        el.checked = !el.checked; // revert on error
    }
}

function cfgShowMsg(id, type, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'cfg-msg cfg-msg-' + type;
    el.textContent = text;
}

function cfgClearMsg(id) {
    const el = document.getElementById(id);
    if (el) { el.className = 'cfg-msg'; el.textContent = ''; }
}

function cfgGoToStep(step) {
    ['cfgPwStep1', 'cfgPwStep2', 'cfgPwStep3', 'cfgPwSuccess'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('cfg-pw-step-hidden');
    });
    const targetId = step === 4 ? 'cfgPwSuccess' : 'cfgPwStep' + step;
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('cfg-pw-step-hidden');
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById('cfgStep' + i + 'Indicator');
        if (!indicator) continue;
        indicator.classList.remove('cfg-step-active', 'cfg-step-done');
        if (i < step) indicator.classList.add('cfg-step-done');
        else if (i === step) indicator.classList.add('cfg-step-active');
    }
    for (let i = 1; i <= 2; i++) {
        const line = document.getElementById('cfgStepLine' + i);
        if (!line) continue;
        line.classList.remove('cfg-step-line-active', 'cfg-step-line-done');
        if (i < step) line.classList.add('cfg-step-line-done');
        else if (i === step) line.classList.add('cfg-step-line-active');
    }
}

function cfgBackToStep(step) {
    cfgClearMsg('cfgMsg1');
    cfgClearMsg('cfgMsg2');
    cfgClearMsg('cfgMsg3');
    cfgGoToStep(step);
}

async function cfgRequestToken() {
    const email = document.getElementById('cfgPwEmail')?.value?.trim();
    if (!email || !email.includes('@')) {
        cfgShowMsg('cfgMsg1', 'error', 'Por favor ingresa un correo valido');
        return;
    }
    _cfgEmail = email;
    const btn = document.getElementById('cfgBtnRequestToken');
    if (btn) { btn.disabled = true; btn.innerHTML = window.safeHTML('<i class="material-icons">hourglass_top</i> Enviando...'); }
    try {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Error al enviar token');
        cfgShowMsg('cfgMsg1', 'success', 'Token enviado a tu correo. Revisa tu bandeja de entrada.');
        setTimeout(() => cfgGoToStep(2), 1200);
    } catch (err) {
        cfgShowMsg('cfgMsg1', 'error', err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = window.safeHTML('<i class="material-icons">send</i> Enviar Token de Verificacion'); }
    }
}

function cfgVerifyToken() {
    const token = document.getElementById('cfgPwToken')?.value?.trim();
    if (!token || token.length !== 6) {
        cfgShowMsg('cfgMsg2', 'error', 'El token debe tener exactamente 6 digitos');
        return;
    }
    cfgGoToStep(3);
}

async function cfgResetPassword() {
    const token = document.getElementById('cfgPwToken')?.value?.trim();
    const newPw = document.getElementById('cfgPwNew')?.value;
    const confirmPw = document.getElementById('cfgPwConfirm')?.value;
    if (!newPw || newPw.length < 8) {
        cfgShowMsg('cfgMsg3', 'error', 'La contrasena debe tener al menos 8 caracteres');
        return;
    }
    if (newPw !== confirmPw) {
        cfgShowMsg('cfgMsg3', 'error', 'Las contrasenas no coinciden');
        return;
    }
    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: _cfgEmail, token, newPassword: newPw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Error al cambiar contrasena');
        cfgGoToStep(4);
    } catch (err) {
        cfgShowMsg('cfgMsg3', 'error', err.message);
    }
}

function cfgResetPwFlow() {
    _cfgEmail = '';
    ['cfgPwEmail', 'cfgPwToken', 'cfgPwNew', 'cfgPwConfirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    cfgClearMsg('cfgMsg1');
    cfgClearMsg('cfgMsg2');
    cfgClearMsg('cfgMsg3');
    cfgGoToStep(1);
}

// =====================================================================
// EXECUTIVE DASHBOARD MODULE
// =====================================================================

let _dbData = null;
let _dbPreset = 'today';

function dbGetDateRange(preset) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    switch (preset) {
        case 'today': return { from: todayStr, to: todayStr + ' 23:59:59' };
        case '7d': {
            const d = new Date(now - 7 * 86400000);
            return { from: d.toISOString().split('T')[0], to: todayStr + ' 23:59:59' };
        }
        case '30d': {
            const d = new Date(now - 30 * 86400000);
            return { from: d.toISOString().split('T')[0], to: todayStr + ' 23:59:59' };
        }
        default: return { from: todayStr, to: todayStr + ' 23:59:59' };
    }
}

function dbSetPreset(preset, btn) {
    document.querySelectorAll('.db-preset').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    _dbPreset = preset;
    var custom = document.getElementById('dbCustomDates');
    if (preset === 'custom') {
        if (custom) custom.style.display = 'flex';
        return;
    }
    if (custom) custom.style.display = 'none';
    var range = dbGetDateRange(preset);
    loadDashboardData(range.from, range.to);
}

function dbLoadCustom() {
    var from = document.getElementById('dbDateFrom');
    var to = document.getElementById('dbDateTo');
    if (from && from.value && to && to.value) {
        loadDashboardData(from.value, to.value + ' 23:59:59');
    }
}

async function loadDashboardData(from, to) {
    try {
        var token = localStorage.getItem('authToken');
        var url = '/api/stats/dashboard';
        if (from || to) {
            var params = [];
            if (from) params.push('from=' + encodeURIComponent(from));
            if (to) params.push('to=' + encodeURIComponent(to));
            url += '?' + params.join('&');
        }
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) throw new Error('Error ' + res.status);
        var data = await res.json();
        _dbData = data;
        dbRender(data);
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function dbRender(d) {
    // KPI: Reports
    dbSet('dbRptTotal', d.reports.total);
    dbSet('dbRptBadge', '+' + d.reports.today + ' hoy');
    dbSet('dbRptViews', d.reports.total_views);
    dbSet('dbRptDl', d.reports.total_downloads);
    dbSet('dbRptPublic', d.reports.public || d.reports.total);
    dbSet('dbRptFeatured', d.reports.featured || 0);

    // KPI: Downloads
    dbSet('dbDlTotal', d.downloads.total);
    dbSet('dbDlBadge', '+' + d.downloads.today + ' hoy');
    dbSet('dbDlOk', d.downloads.completed);
    dbSet('dbDlFail', d.downloads.failed);
    dbSet('dbDlProcessing', d.downloads.processing || 0);

    // KPI: Users
    dbSet('dbUsrTotal', d.users.total);
    dbSet('dbUsrActive', d.users.active);
    dbSet('dbUsrMfa', d.users.with_mfa);

    // KPI: Sessions
    dbSet('dbSessActive', d.sessions.active);

    // KPI: Security
    dbSet('dbSecLogins', d.security.logins_total);
    dbSet('dbSecOk', d.security.logins_success);
    dbSet('dbSecFail', d.security.logins_failed);
    var badge = document.getElementById('dbSecBadge');
    if (badge) {
        badge.textContent = d.security.success_rate + '%';
        badge.className = 'db-kpi-badge' + (d.security.success_rate < 90 ? ' db-kpi-badge-warn' : '');
    }

    // Activity
    dbSet('dbActTotal', d.activity.total_actions);
    dbRenderChart(d.activity.trend);

    // Recent items
    dbRenderRecentReports(d.recent.reports);
    dbRenderRecentDownloads(d.recent.downloads);
    dbRenderRecentAudit(d.recent.audit);

    // Module Charts (Chart.js)
    dbRenderChartReports(d);
    dbRenderChartDownloads(d);
    dbRenderChartSecurity(d);

    // KPI: DAI (From API)
    dbRenderDaiKPIs(d.dai);
}

function dbSet(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

function dbRenderChart(trend) {
    var container = document.getElementById('dbActivityChart');
    if (!container || !trend || !trend.length) return;
    var max = Math.max.apply(null, trend.map(function (t) { return t.actions; }));
    if (max === 0) max = 1;
    var html = '<div class="db-chart-bars">';
    trend.forEach(function (t) {
        var pct = Math.round((t.actions / max) * 100);
        html += '<div class="db-bar-col">' +
            '<div class="db-bar-val">' + t.actions + '</div>' +
            '<div class="db-bar-track"><div class="db-bar-fill" style="height:' + pct + '%"></div></div>' +
            '<div class="db-bar-label">' + t.label + '</div>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = window.safeHTML(html);
}

function dbRenderRecentReports(reports) {
    var tbody = document.getElementById('dbRecentReports');
    if (!tbody) return;
    if (!reports || !reports.length) {
        tbody.innerHTML = window.safeHTML(
            '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);padding:1.5rem">Sin reportes</td></tr>'
        );
        return;
    }
    tbody.innerHTML = window.safeHTML(reports.map(function (r) {
        return '<tr>' +
            '<td><span class="db-cell-title">' + dbEsc(r.title) + '</span></td>' +
            '<td>' + dbFormatSize(r.file_size) + '</td>' +
            '<td>' + dbFormatDate(r.created_at) + '</td>' +
            '</tr>';
    }).join(''));
}

function dbRenderRecentDownloads(downloads) {
    var tbody = document.getElementById('dbRecentDownloads');
    if (!tbody) return;
    if (!downloads || !downloads.length) {
        tbody.innerHTML = window.safeHTML(
            '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);padding:1.5rem">Sin descargas</td></tr>'
        );
        return;
    }
    tbody.innerHTML = window.safeHTML(downloads.map(function (d) {
        var statusClass = d.status === 'completed' ? 'db-status-ok' : d.status === 'failed' ? 'db-status-fail' : 'db-status-pending';
        var statusLabel = d.status === 'completed' ? 'Exitosa' : d.status === 'failed' ? 'Fallida' : d.status;
        return '<tr>' +
            '<td>' + dbEsc(d.user_name || 'Usuario') + '</td>' +
            '<td><span class="' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td>' + dbFormatDate(d.created_at) + '</td>' +
            '</tr>';
    }).join(''));
}

function dbRenderRecentAudit(audit) {
    var tbody = document.getElementById('dbRecentAudit');
    if (!tbody) return;
    if (!audit || !audit.length) {
        tbody.innerHTML = window.safeHTML(
            '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:1.5rem">Sin actividad</td></tr>'
        );
        return;
    }
    tbody.innerHTML = window.safeHTML(audit.map(function (a) {
        var statusClass = a.status === 'success' ? 'db-status-ok' : 'db-status-fail';
        var statusLabel = a.status === 'success' ? 'OK' : 'Error';
        return '<tr>' +
            '<td>' + dbEsc(a.user_name || '-') + '</td>' +
            '<td>' + dbEsc(a.action || '-') + '</td>' +
            '<td>' + dbEsc(a.resource_type || '-') + '</td>' +
            '<td><span class="' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td>' + dbFormatDate(a.created_at) + '</td>' +
            '</tr>';
    }).join(''));
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD – Chart.js Module Charts (simulated historical data)
// ════════════════════════════════════════════════════════════════
var _dbChartInstances = {};

function _dbDestroyChart(id) {
    if (_dbChartInstances[id]) { _dbChartInstances[id].destroy(); delete _dbChartInstances[id]; }
}

function _dbLast7Days() {
    var labels = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
        var d = new Date(now); d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }));
    }
    return labels;
}

function _dbSimSeries(base, variance, len) {
    var arr = [];
    for (var i = 0; i < (len || 7); i++) {
        arr.push(Math.max(0, Math.round(base + (Math.random() - 0.5) * variance)));
    }
    return arr;
}

function dbRenderChartReports(d) {
    var ctx = document.getElementById('dbChartReports');
    if (!ctx) return;
    _dbDestroyChart('reports');
    var labels = _dbLast7Days();
    var total = d.reports.total || 3;
    _dbChartInstances['reports'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Publicaciones', data: _dbSimSeries(Math.ceil(total / 5), 2, 7), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.12)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#f97316' },
                { label: 'Descargas', data: _dbSimSeries(d.reports.total_downloads || 2, 3, 7), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#3b82f6' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } }
    });
}

function dbRenderChartDownloads(d) {
    var ctx = document.getElementById('dbChartDownloads');
    if (!ctx) return;
    _dbDestroyChart('downloads');
    var labels = _dbLast7Days();
    var tot = d.downloads.total || 4;
    _dbChartInstances['downloads'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Exitosas', data: _dbSimSeries(Math.ceil(tot * .6), 2, 7), backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 4 },
                { label: 'Fallidas', data: _dbSimSeries(Math.ceil(tot * .3), 2, 7), backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 4 },
                { label: 'En Proceso', data: _dbSimSeries(Math.ceil(tot * .1), 1, 7), backgroundColor: 'rgba(249,115,22,.5)', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { x: { stacked: true, ticks: { font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } } } } }
    });
}

function dbRenderChartDai() {
    var ctx = document.getElementById('dbChartDai');
    if (!ctx) return;
    _dbDestroyChart('dai');
    var labels = _dbLast7Days();
    _dbChartInstances['dai'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Crítica', data: _dbSimSeries(18, 8, 7), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.1)', fill: true, tension: .3, pointRadius: 3 },
                { label: 'Alta', data: _dbSimSeries(20, 10, 7), borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,.08)', fill: true, tension: .3, pointRadius: 3 },
                { label: 'Media', data: _dbSimSeries(22, 8, 7), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,.06)', fill: true, tension: .3, pointRadius: 3 },
                { label: 'Baja', data: _dbSimSeries(16, 6, 7), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.06)', fill: true, tension: .3, pointRadius: 3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } }
    });
}

function dbRenderChartSecurity(d) {
    var ctx = document.getElementById('dbChartSecurity');
    if (!ctx) return;
    _dbDestroyChart('security');
    var labels = _dbLast7Days();
    var loginsOk = d.security.logins_success || 30;
    var loginsFail = d.security.logins_failed || 0;
    _dbChartInstances['security'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Logins Exitosos', data: _dbSimSeries(Math.ceil(loginsOk / 5), 4, 7), backgroundColor: 'rgba(99,102,241,.65)', borderRadius: 4 },
                { label: 'Logins Fallidos', data: _dbSimSeries(Math.ceil(loginsFail / 5), 1, 7), backgroundColor: 'rgba(239,68,68,.5)', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { x: { stacked: false, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { font: { size: 10 } } } } }
    });
}

// ── DAI KPIs (populated from DAI module data) ─────────────────
// ── DAI KPIs (populated from API data) ───────────────────────
function dbRenderDaiKPIs(dai) {
    if (!dai) return;

    // Latency format
    var avgMs = dai.avg_latency || 0;
    var avgMin = Math.floor(avgMs / 60000);
    var avgSec = Math.floor((avgMs % 60000) / 1000);
    var tResp = avgMin + 'min ' + avgSec + 's';

    dbSet('dbDaiTotal', dai.total);
    dbSet('dbDaiCritica', dai.critical);
    dbSet('dbDaiAlta', 0); // Placeholder if not in API but we use API total now
    dbSet('dbDaiMedia', 0); // Placeholder
    dbSet('dbDaiAlta2', 0); // Placeholder for 'baja' in old code
    dbSet('dbDaiPendientes', dai.pending);
    dbSet('dbDaiTResp', tResp);

    // Render chart (can still use DAI.all if available for detailed breakdown)
    dbRenderChartDai();
}

function dbFormatSize(bytes) {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function dbFormatDate(str) {
    if (!str) return '-';
    try {
        var d = new Date(str);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return str; }
}

function dbEsc(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function dbExportCSV() {
    if (!_dbData) return;
    var d = _dbData;
    var lines = [
        'Indicador,Valor',
        'Reportes Total,' + d.reports.total,
        'Reportes Hoy,' + d.reports.today,
        'Reportes Publicos,' + d.reports.public,
        'Total Vistas,' + d.reports.total_views,
        'Total Descargas Reportes,' + d.reports.total_downloads,
        'Descargas Total,' + d.downloads.total,
        'Descargas Hoy,' + d.downloads.today,
        'Descargas Exitosas,' + d.downloads.completed,
        'Descargas Fallidas,' + d.downloads.failed,
        'Usuarios Total,' + d.users.total,
        'Usuarios Activos,' + d.users.active,
        'Usuarios Nuevos Periodo,' + d.users.new_in_period,
        'Usuarios con 2FA,' + d.users.with_mfa,
        'Sesiones Activas,' + d.sessions.active,
        'Logins Total,' + d.security.logins_total,
        'Logins Exitosos,' + d.security.logins_success,
        'Logins Fallidos,' + d.security.logins_failed,
        'Tasa Exito Login,' + d.security.success_rate + '%',
        'Acciones Periodo,' + d.activity.total_actions,
        '',
        'Actividad 7 Dias',
        'Dia,Acciones'
    ];
    d.activity.trend.forEach(function (t) { lines.push(t.day + ',' + t.actions); });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dashboard_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
}

// ========================================
// ANALYTICS MODULE
// ========================================
var _anData = null;
var _anPreset = 'today';

function anSetPreset(preset) {
    _anPreset = preset;
    document.querySelectorAll('.an-preset').forEach(function (b) { b.classList.remove('active'); });
    var btns = document.querySelectorAll('.an-preset');
    for (var i = 0; i < btns.length; i++) {
        if ((preset === 'today' && i === 0) || (preset === '7d' && i === 1) || (preset === '30d' && i === 2) || (preset === 'custom' && i === 3)) {
            btns[i].classList.add('active');
        }
    }
    var customEl = document.getElementById('anCustomDates');
    if (customEl) customEl.style.display = preset === 'custom' ? 'flex' : 'none';
    if (preset !== 'custom') {
        var range = anGetDateRange(preset);
        loadAnalytics(range.from, range.to);
    }
}

function anGetDateRange(preset) {
    var now = new Date();
    var to = now.toISOString().split('T')[0] + ' 23:59:59';
    var from;
    if (preset === '7d') {
        from = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    } else if (preset === '30d') {
        from = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    } else {
        from = now.toISOString().split('T')[0];
    }
    return { from: from, to: to };
}

async function loadAnalytics(from, to) {
    try {
        var token = localStorage.getItem('authToken');
        var url = '/api/analytics/summary';
        if (from || to) {
            url += '?';
            if (from) url += 'from=' + encodeURIComponent(from);
            if (to) url += '&to=' + encodeURIComponent(to);
        }
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) throw new Error('API error ' + res.status);
        var data = await res.json();
        _anData = data;
        anRender(data);
    } catch (err) {
        console.error('Analytics load error:', err);
    }
}

function anRender(d) {
    // KPI cards
    anSet('anTotalSessions', d.total_sessions || 0);
    anSet('anTotalPageviews', d.total_pageviews || 0);
    anSet('anActiveNow', d.active_visitors || 0);

    // Avg duration across pages
    var avgArr = d.avg_duration || [];
    if (avgArr.length > 0) {
        var totalSec = 0;
        avgArr.forEach(function (a) { totalSec += parseInt(a.avg_seconds || 0); });
        var avgSec = Math.round(totalSec / avgArr.length);
        var mins = Math.floor(avgSec / 60);
        var secs = avgSec % 60;
        anSet('anAvgDuration', mins + 'm ' + secs + 's');
    } else {
        anSet('anAvgDuration', '0m');
    }

    // Top device
    var devArr = d.by_device || [];
    if (devArr.length > 0) {
        var topDev = devArr[0];
        var devMap = { desktop: 'Desktop', mobile: 'Móvil', tablet: 'Tablet' };
        anSet('anTopDevice', (devMap[topDev.device_type] || topDev.device_type) + ' (' + topDev.sessions + ')');
    } else {
        anSet('anTopDevice', '—');
    }

    // Trend chart
    anRenderTrend(d.daily_trend || []);

    // By page
    anRenderByPage(d.by_page || []);

    // Device pie
    anRenderPieList('anDevicePie', devArr, 'device_type', 'sessions', { desktop: '#3b82f6', mobile: '#10b981', tablet: '#f59e0b' });

    // Browser pie
    var browserColors = { Chrome: '#4285F4', Firefox: '#FF7139', Safari: '#0088cc', Edge: '#0078D7', Opera: '#FF1B2D', Otro: '#94a3b8' };
    anRenderPieList('anBrowserPie', d.by_browser || [], 'browser', 'sessions', browserColors);

    // OS pie
    var osColors = { Windows: '#0078D7', macOS: '#555', Android: '#3DDC84', iOS: '#A2AAAD', Linux: '#FCC624', Otro: '#94a3b8' };
    anRenderPieList('anOSPie', d.by_os || [], 'os', 'sessions', osColors);

    // Section heat map
    anRenderSectionHeat(d.section_heat || []);

    // Top clicks
    anRenderClicks(d.top_clicks || []);
}

function anSet(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

function anEsc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function anRenderTrend(trend) {
    var container = document.getElementById('anTrendChart');
    if (!container || !trend.length) { if (container) container.innerHTML = window.safeHTML('<p style="text-align:center;color:#94a3b8;padding:2rem;">Sin datos</p>'); return; }
    var max = 1;
    trend.forEach(function (t) { if (t.visitors > max) max = t.visitors; });
    var html = '<div class="an-chart-bars">';
    trend.forEach(function (t) {
        var pct = Math.round((t.visitors / max) * 100);
        html += '<div class="an-bar-col">' +
            '<div class="an-bar-val">' + t.visitors + '</div>' +
            '<div class="an-bar-track"><div class="an-bar-fill" style="height:' + pct + '%"></div></div>' +
            '<div class="an-bar-label">' + (t.label || t.day) + '</div>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = window.safeHTML(html);
}

function anRenderByPage(pages) {
    var container = document.getElementById('anByPage');
    if (!container) return;
    if (!pages.length) { container.innerHTML = window.safeHTML('<p style="text-align:center;color:#94a3b8;padding:1rem;">Sin datos</p>'); return; }
    var max = 1;
    pages.forEach(function (p) { if (p.visitors > max) max = p.visitors; });
    var pageLabels = { landing: 'Inicio', participacion: 'Participación', documentos: 'Documentos', sectores: 'Sectores Viales' };
    var pageColors = { landing: '#3b82f6', participacion: '#10b981', documentos: '#f59e0b', sectores: '#8b5cf6' };
    var html = '<div class="an-page-bars">';
    pages.forEach(function (p) {
        var pct = Math.round((p.visitors / max) * 100);
        var label = pageLabels[p.page] || p.page;
        var color = pageColors[p.page] || '#94a3b8';
        html += '<div class="an-page-row">' +
            '<div class="an-page-name">' + anEsc(label) + '</div>' +
            '<div class="an-page-bar-container">' +
            '<div class="an-page-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
            '</div>' +
            '<div class="an-page-count">' + p.visitors + '</div>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = window.safeHTML(html);
}

function anRenderPieList(containerId, items, key, valKey, colors) {
    var container = document.getElementById(containerId);
    if (!container) return;
    if (!items.length) { container.innerHTML = window.safeHTML('<p style="color:#94a3b8;font-size:.78rem;">Sin datos</p>'); return; }
    var total = 0;
    items.forEach(function (i) { total += parseInt(i[valKey] || 0); });
    var html = '';
    items.forEach(function (i) {
        var pct = total > 0 ? Math.round((parseInt(i[valKey]) / total) * 100) : 0;
        var color = (colors && colors[i[key]]) || '#94a3b8';
        var label = i[key] || 'Desconocido';
        html += '<div class="an-pie-item">' +
            '<span class="an-pie-dot" style="background:' + color + '"></span>' +
            '<span class="an-pie-name">' + anEsc(label) + '</span>' +
            '<span class="an-pie-pct">' + pct + '%</span>' +
            '<span class="an-pie-n">(' + i[valKey] + ')</span>' +
            '</div>';
    });
    container.innerHTML = window.safeHTML(html);
}

function anRenderSectionHeat(heat) {
    var tbody = document.querySelector('#anSectionTable tbody');
    if (!tbody) return;
    if (!heat.length) { tbody.innerHTML = window.safeHTML(
        '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Sin datos</td></tr>'
    ); return; }
    var max = 1;
    heat.forEach(function (h) { if (h.views > max) max = h.views; });
    var pageLabels = { landing: 'Inicio', participacion: 'Participación', documentos: 'Documentos', sectores: 'Sectores' };
    var html = '';
    heat.forEach(function (h) {
        var pct = Math.round((h.views / max) * 100);
        var dur = parseInt(h.avg_duration || 0);
        var durStr = dur > 60 ? Math.floor(dur / 60) + 'm ' + (dur % 60) + 's' : dur + 's';
        html += '<tr>' +
            '<td>' + anEsc(pageLabels[h.page] || h.page) + '</td>' +
            '<td><strong>' + anEsc(h.section) + '</strong></td>' +
            '<td>' + h.views + '</td>' +
            '<td>' + durStr + '</td>' +
            '<td><div class="an-heat-bar"><div class="an-heat-fill" style="width:' + pct + '%"></div></div></td>' +
            '</tr>';
    });
    tbody.innerHTML = window.safeHTML(html);
}

function anRenderClicks(clicks) {
    var tbody = document.querySelector('#anClicksTable tbody');
    if (!tbody) return;
    if (!clicks.length) { tbody.innerHTML = window.safeHTML(
        '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">Sin datos</td></tr>'
    ); return; }
    var pageLabels = { landing: 'Inicio', participacion: 'Participación', documentos: 'Documentos', sectores: 'Sectores' };
    var html = '';
    clicks.forEach(function (c) {
        html += '<tr>' +
            '<td><span class="an-click-label">' + anEsc(c.event_target) + '</span></td>' +
            '<td>' + anEsc(pageLabels[c.page] || c.page) + '</td>' +
            '<td><strong>' + c.clicks + '</strong></td>' +
            '</tr>';
    });
    tbody.innerHTML = window.safeHTML(html);
}

// ========================================
// ANALYTICS — Custom Dates + Export
// ========================================

function anApplyCustom() {
    var from = document.getElementById('anDateFrom').value;
    var to = document.getElementById('anDateTo').value;
    if (!from || !to) { alert('Seleccione ambas fechas'); return; }
    if (from > to) { alert('La fecha inicial no puede ser posterior a la final'); return; }
    _anPreset = 'custom';
    loadAnalytics(from, to + ' 23:59:59');
}

// ── Report HTML builder ────────────────────────────
function anBuildReportHTML() {
    if (!_anData) return '<p>No hay datos para exportar.</p>';
    var d = _anData;
    var period = (d.period ? d.period.from + ' al ' + d.period.to.split(' ')[0] : 'Hoy');
    var pageLabels = { landing: 'Inicio', participacion: 'Participación Ciudadana', documentos: 'Documentos', sectores: 'Sectores Viales' };

    var html = '<html><head><meta charset="utf-8"><style>';
    html += 'body{font-family:"Segoe UI",Arial,sans-serif;margin:2cm;color:#1e293b;font-size:11pt;}';
    html += 'h1{color:#4c1d95;font-size:18pt;border-bottom:3px solid #4c1d95;padding-bottom:8pt;margin-bottom:12pt;}';
    html += 'h2{color:#6d28d9;font-size:14pt;margin-top:20pt;margin-bottom:8pt;}';
    html += 'h3{color:#334155;font-size:12pt;margin-top:14pt;margin-bottom:6pt;}';
    html += '.period{background:#f5f3ff;padding:8pt 12pt;border-radius:6pt;margin-bottom:16pt;color:#4c1d95;font-weight:600;}';
    html += '.kpi-grid{display:flex;gap:12pt;margin-bottom:16pt;flex-wrap:wrap;}';
    html += '.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8pt;padding:12pt 16pt;min-width:120pt;}';
    html += '.kpi-val{font-size:20pt;font-weight:800;color:#1e293b;}';
    html += '.kpi-label{font-size:9pt;color:#64748b;margin-top:2pt;}';
    html += 'table{width:100%;border-collapse:collapse;margin:8pt 0;font-size:10pt;}';
    html += 'th{background:#f1f5f9;padding:6pt 10pt;text-align:left;font-weight:600;color:#475569;border:1px solid #e2e8f0;}';
    html += 'td{padding:6pt 10pt;border:1px solid #e2e8f0;}';
    html += 'tr:nth-child(even){background:#fafafa;}';
    html += '.bar-container{display:inline-block;width:100pt;height:12pt;background:#e2e8f0;border-radius:4pt;vertical-align:middle;overflow:hidden;}';
    html += '.bar-fill{height:100%;border-radius:4pt;}';
    html += '.footer{margin-top:24pt;padding-top:8pt;border-top:2px solid #e2e8f0;font-size:9pt;color:#94a3b8;text-align:center;}';
    html += '@page{margin:2cm;}';
    html += '@media print{body{margin:0;}.kpi-grid{page-break-inside:avoid;}table{page-break-inside:auto;}tr{page-break-inside:avoid;}}';
    html += '</style></head><body>';

    // Header
    html += '<h1>📊 Informe de Analítica Web — VIITS INVIAS</h1>';
    html += '<div class="period">Período: ' + anEsc(period) + '</div>';

    // KPIs
    html += '<h2>Indicadores Clave</h2>';
    html += '<div class="kpi-grid">';
    html += '<div class="kpi"><div class="kpi-val">' + (d.total_sessions || 0) + '</div><div class="kpi-label">Sesiones únicas</div></div>';
    html += '<div class="kpi"><div class="kpi-val">' + (d.total_pageviews || 0) + '</div><div class="kpi-label">Páginas vistas</div></div>';
    html += '<div class="kpi"><div class="kpi-val">' + (d.active_visitors || 0) + '</div><div class="kpi-label">Visitantes activos</div></div>';
    var avgArr = d.avg_duration || [];
    if (avgArr.length > 0) {
        var totalSec = 0; avgArr.forEach(function (a) { totalSec += parseInt(a.avg_seconds || 0); });
        var avgSec = Math.round(totalSec / avgArr.length);
        html += '<div class="kpi"><div class="kpi-val">' + Math.floor(avgSec / 60) + 'm ' + (avgSec % 60) + 's</div><div class="kpi-label">Duración promedio</div></div>';
    }
    html += '</div>';

    // By page
    html += '<h2>Visitantes por Página</h2><table><tr><th>Página</th><th>Visitantes</th><th>Eventos</th><th>Proporción</th></tr>';
    var maxP = 1; (d.by_page || []).forEach(function (p) { if (p.visitors > maxP) maxP = p.visitors; });
    (d.by_page || []).forEach(function (p) {
        var pct = Math.round((p.visitors / maxP) * 100);
        var colors = { landing: '#3b82f6', participacion: '#10b981', documentos: '#f59e0b', sectores: '#8b5cf6' };
        html += '<tr><td>' + anEsc(pageLabels[p.page] || p.page) + '</td><td><strong>' + p.visitors + '</strong></td><td>' + p.events + '</td>';
        html += '<td><div class="bar-container"><div class="bar-fill" style="width:' + pct + '%;background:' + (colors[p.page] || '#94a3b8') + '"></div></div> ' + pct + '%</td></tr>';
    });
    html += '</table>';

    // Devices
    html += '<h2>Dispositivos y Tecnología</h2>';
    html += '<h3>Tipo de Dispositivo</h3><table><tr><th>Dispositivo</th><th>Sesiones</th><th>%</th></tr>';
    var totalDev = 0; (d.by_device || []).forEach(function (dd) { totalDev += parseInt(dd.sessions); });
    (d.by_device || []).forEach(function (dd) {
        var devMap = { desktop: 'Escritorio', mobile: 'Móvil', tablet: 'Tablet' };
        var pct = totalDev > 0 ? Math.round((parseInt(dd.sessions) / totalDev) * 100) : 0;
        html += '<tr><td>' + (devMap[dd.device_type] || dd.device_type) + '</td><td>' + dd.sessions + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</table>';

    html += '<h3>Navegadores</h3><table><tr><th>Navegador</th><th>Sesiones</th><th>%</th></tr>';
    var totalBr = 0; (d.by_browser || []).forEach(function (b) { totalBr += parseInt(b.sessions); });
    (d.by_browser || []).forEach(function (b) {
        var pct = totalBr > 0 ? Math.round((parseInt(b.sessions) / totalBr) * 100) : 0;
        html += '<tr><td>' + anEsc(b.browser) + '</td><td>' + b.sessions + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</table>';

    html += '<h3>Sistemas Operativos</h3><table><tr><th>Sistema</th><th>Sesiones</th><th>%</th></tr>';
    var totalOS = 0; (d.by_os || []).forEach(function (o) { totalOS += parseInt(o.sessions); });
    (d.by_os || []).forEach(function (o) {
        var pct = totalOS > 0 ? Math.round((parseInt(o.sessions) / totalOS) * 100) : 0;
        html += '<tr><td>' + anEsc(o.os) + '</td><td>' + o.sessions + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</table>';

    // Section heat map
    if ((d.section_heat || []).length > 0) {
        html += '<h2>Secciones Más Visitadas</h2><table><tr><th>Página</th><th>Sección</th><th>Vistas</th><th>Duración Prom.</th></tr>';
        d.section_heat.forEach(function (h) {
            var dur = parseInt(h.avg_duration || 0);
            var durStr = dur > 60 ? Math.floor(dur / 60) + 'm ' + (dur % 60) + 's' : dur + 's';
            html += '<tr><td>' + anEsc(pageLabels[h.page] || h.page) + '</td><td>' + anEsc(h.section) + '</td><td>' + h.views + '</td><td>' + durStr + '</td></tr>';
        });
        html += '</table>';
    }

    // Top clicks
    if ((d.top_clicks || []).length > 0) {
        html += '<h2>Acciones Más Usadas</h2><table><tr><th>Acción</th><th>Página</th><th>Clics</th></tr>';
        d.top_clicks.forEach(function (c) {
            html += '<tr><td>' + anEsc(c.event_target) + '</td><td>' + anEsc(pageLabels[c.page] || c.page) + '</td><td><strong>' + c.clicks + '</strong></td></tr>';
        });
        html += '</table>';
    }

    // Avg duration per page
    if (avgArr.length > 0) {
        html += '<h2>Duración Promedio por Página</h2><table><tr><th>Página</th><th>Duración Promedio</th></tr>';
        avgArr.forEach(function (a) {
            var s = parseInt(a.avg_seconds || 0);
            html += '<tr><td>' + anEsc(pageLabels[a.page] || a.page) + '</td><td>' + Math.floor(s / 60) + 'm ' + (s % 60) + 's</td></tr>';
        });
        html += '</table>';
    }

    // Daily trend
    if ((d.daily_trend || []).length > 0) {
        html += '<h2>Tendencia Diaria (7 días)</h2><table><tr><th>Fecha</th><th>Día</th><th>Visitantes</th></tr>';
        d.daily_trend.forEach(function (t) {
            html += '<tr><td>' + t.day + '</td><td>' + (t.label || '') + '</td><td>' + t.visitors + '</td></tr>';
        });
        html += '</table>';
    }

    html += '<div class="footer">Generado el ' + new Date().toLocaleString('es-CO') + ' — Sistema VIITS INVIAS</div>';
    html += '</body></html>';
    return html;
}

// ── PDF Export (print) ────────────────────────────
function anExportPDF() {
    if (!_anData) { alert('Primero cargue los datos de analítica'); return; }
    var content = anBuildReportHTML();
    var w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(content);
    w.document.close();
    setTimeout(function () { w.print(); }, 600);
}

// ── Word Export (.doc) ────────────────────────────
function anExportWord() {
    if (!_anData) { alert('Primero cargue los datos de analítica'); return; }
    var content = anBuildReportHTML();
    // Wrap in Word-compatible format
    var wordDoc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    wordDoc += '<head><meta charset="utf-8"><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>';
    // Extract style from content
    var styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
    if (styleMatch) wordDoc += '<style>' + styleMatch[1] + '</style>';
    wordDoc += '</head>';
    // Extract body
    var bodyMatch = content.match(/<body>([\s\S]*?)<\/body>/);
    if (bodyMatch) wordDoc += '<body>' + bodyMatch[1] + '</body>';
    wordDoc += '</html>';

    var blob = new Blob(['\ufeff' + wordDoc], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var dateStr = new Date().toISOString().split('T')[0];
    a.download = 'Analitica_VIITS_' + dateStr + '.doc';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ============================================================
//  NOTIFICATION PANEL — Bell icon slide-in drawer
// ============================================================

let _notifOpen = false;
let _notifFilter = 'pendientes';

/** Toggle the notification panel open / closed */
function toggleNotifPanel() {
    _notifOpen = !_notifOpen;
    const panel = document.getElementById('notifPanel');
    const backdrop = document.getElementById('notifBackdrop');
    if (_notifOpen) {
        // Ensure DAI data is loaded
        if (typeof DAI !== 'undefined' && DAI.all.length === 0 && typeof generateDAIData === 'function') {
            generateDAIData();
        }
        renderNotifAlerts();
        panel?.classList.add('open');
        backdrop?.classList.add('open');
    } else {
        panel?.classList.remove('open');
        backdrop?.classList.remove('open');
    }
}

/** Render alert cards inside the notification panel body */
function renderNotifAlerts() {
    const body = document.getElementById('notifPanelBody');
    if (!body) return;

    // Get alerts from DAI module
    let alerts = [];
    if (typeof DAI !== 'undefined' && DAI.all && DAI.all.length > 0) {
        alerts = [...DAI.all];
    }

    // Sort: critical first, then by date (newest first)
    const sevOrder = { critica: 0, alta: 1, media: 2, baja: 3 };
    alerts.sort((a, b) => (sevOrder[a.sev] ?? 9) - (sevOrder[b.sev] ?? 9) || b.fecha - a.fecha);

    // Apply filter
    let filtered = alerts;
    if (_notifFilter === 'pendientes') {
        filtered = alerts.filter(a => a.estado !== 'resuelta');
    } else if (_notifFilter === 'criticas') {
        filtered = alerts.filter(a => a.sev === 'critica' && a.estado !== 'resuelta');
    }

    // Update tab counts
    const pendCount = alerts.filter(a => a.estado !== 'resuelta').length;
    const critCount = alerts.filter(a => a.sev === 'critica' && a.estado !== 'resuelta').length;
    const el1 = document.getElementById('notifCountPend');
    const el2 = document.getElementById('notifCountCrit');
    if (el1) el1.textContent = pendCount;
    if (el2) el2.textContent = critCount;

    // Update subtitle
    const sub = document.getElementById('notifSubtitle');
    if (sub) sub.textContent = `${pendCount} alertas pendientes · ${critCount} críticas`;

    // Limit to 50 most relevant
    const limited = filtered.slice(0, 50);

    if (limited.length === 0) {
        body.innerHTML = window.safeHTML(`
            <div class="notif-empty">
                <i class="material-icons">notifications_off</i>
                <p>${_notifFilter === 'criticas' ? 'Sin alertas críticas pendientes' :
                _notifFilter === 'pendientes' ? 'Sin alertas pendientes' :
                    'Sin alertas registradas'}</p>
            </div>`);
        return;
    }

    // Severity labels
    const sevLabels = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
    const estLabels = { creado: 'Creado', activa: 'Activa', en_revision: 'En Revisión', resuelta: 'Resuelta' };

    // Helper: elapsed time from date
    function _notifElapsed(d) {
        const ms = Date.now() - d.getTime();
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ${m % 60}m`;
        const dy = Math.floor(h / 24);
        return `${dy}d ${h % 24}h`;
    }

    // Helper: get icon for alert type
    function _notifIcon(tipo) {
        if (typeof _tipoIcon === 'function') return _tipoIcon(tipo);
        return 'warning';
    }

    // Build cards HTML
    let html = '';
    let currentSev = '';

    for (const a of limited) {
        // Section divider when severity changes
        if (a.sev !== currentSev) {
            currentSev = a.sev;
            html += `<div class="notif-section-label">${sevLabels[a.sev] || a.sev} (${filtered.filter(x => x.sev === a.sev).length})</div>`;
        }

        const isUrgent = a.sev === 'critica' && a.estado !== 'resuelta';
        const icon = _notifIcon(a.tipo);
        const elapsed = _notifElapsed(a.fecha);
        const estado = estLabels[a.estado] || a.estado;

        html += `
        <div class="notif-card ${isUrgent ? 'urgent' : ''}" onclick="notifGoToAlert('${a.id}')">
            <div class="notif-card-strip ${a.sev}"></div>
            <div class="notif-card-icon ${a.sev}">
                <i class="material-icons">${icon}</i>
            </div>
            <div class="notif-card-body">
                <div class="notif-card-title">${a.tipo}</div>
                <div class="notif-card-meta">
                    <span><i class="material-icons">location_on</i>${a.dep}</span>
                    <span><i class="material-icons">router</i>${a.disp.replace('INV-DAI-', '')}</span>
                    <span class="status-pill ${a.estado}" style="font-size:.6rem;padding:1px 6px;">${estado}</span>
                </div>
            </div>
            <div class="notif-card-right">
                <span class="notif-card-sev ${a.sev}">${sevLabels[a.sev]}</span>
                <span class="notif-card-time"><i class="material-icons" style="font-size:11px;vertical-align:-1px;">schedule</i> ${elapsed}</span>
            </div>
            <div class="notif-card-arrow">
                <i class="material-icons">chevron_right</i>
            </div>
        </div>`;
    }

    body.innerHTML = window.safeHTML(html);
}

/** Switch notification filter tab */
function notifFilterTab(el, filter) {
    _notifFilter = filter;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderNotifAlerts();
}

/** Navigate to DAI section and open the alert detail panel */
function notifGoToAlert(alertId) {
    // Close the notification panel first
    toggleNotifPanel();

    // Navigate to the Alertas DAI section
    showSection('alertas-dai');

    // Wait for section to render, then open the detail panel
    setTimeout(() => {
        if (typeof daiSelectAlert === 'function') {
            daiSelectAlert(alertId);
        }
    }, 300);
}

/** Update the notification badge count on the bell icon */
function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    let pendingCount = 0;
    if (typeof DAI !== 'undefined' && DAI.all && DAI.all.length > 0) {
        pendingCount = DAI.all.filter(a => a.estado !== 'resuelta').length;
    }

    if (pendingCount > 0) {
        badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

// Hook: update badge when DAI data loads (late-binding for correct script order)
document.addEventListener('DOMContentLoaded', () => {
    // Retry badge update until DAI data is available
    let _badgeRetries = 0;
    const _badgeInterval = setInterval(() => {
        if (typeof DAI !== 'undefined' && DAI.all && DAI.all.length > 0) {
            updateNotifBadge();
            clearInterval(_badgeInterval);
        }
        if (++_badgeRetries > 30) clearInterval(_badgeInterval); // stop after 30s
    }, 1000);
});
