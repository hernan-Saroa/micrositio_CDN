// ========================================
// VERIFICACIÓN DE AUTENTICACIÓN
// ========================================

// Modo de demostración (debe coincidir con login.html)
const DEMO_MODE = false;

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
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
            return;
        }
        
        const data = await response.json();
        
        // Actualizar información del usuario en la UI
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const userNameElement = document.querySelector('.topbar p');
        if (userNameElement && userData.name) {
            userNameElement.textContent = `Bienvenido, ${userData.name}`;
        }
        
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
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
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar logs de auditoría. Verifica la conexión con la base de datos.
                </td>
            </tr>
        `;
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
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No hay registros de auditoría disponibles
            </td>
        </tr>
        `;
        return;
    }

    tbody.innerHTML = auditLogs.map(log => {
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
    }).join('');
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
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar usuarios. Verifica la conexión con la base de datos.
                </td>
            </tr>
        `;
    }
}

// Mostrar usuarios en la tabla
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No hay usuarios registrados
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
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
    }).join('');
}

// Función auxiliar para obtener clase del badge del rol
function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin': return 'badge-error';
        case 'editor': return 'badge-warning';
        case 'user': return 'badge-warning';
        default: return 'badge-new';
    }
}

// Función auxiliar para obtener nombre display del rol
function getRoleDisplayName(role) {
    switch (role) {
        case 'admin': return 'Admin';
        case 'editor': return 'Editor';
        case 'user': return 'Usuario';
        default: return role;
    }
}

// Cargar reportes desde la base de datos
async function loadReports() {
    try {
        const response = await apiRequest('/api/reports');
        if (!response.ok) {
            throw new Error('Error al cargar reportes');
        }

        const data = await response.json();
        displayReports(data.reports);
    } catch (error) {
        console.error('Error al cargar reportes:', error);
        // Mostrar mensaje de error en la tabla
        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar reportes. Verifica la conexión con la base de datos.
                </td>
            </tr>
        `;
    }
}

// Aplicar filtros de reportes
async function applyReportsFilters() {
    const search = document.getElementById('reportsSearch').value;
    const isPublic = document.getElementById('reportsStatusFilter').value;
    const sortBy = document.getElementById('reportsSortBy').value;
    const sortOrder = document.getElementById('reportsSortOrder').value;

    try {
        let url = `/api/reports?page=1&limit=50&search=${encodeURIComponent(search)}&sort_by=${sortBy}&sort_order=${sortOrder}`;
        if (isPublic !== '') {
            url += `&is_public=${isPublic}`;
        }

        const response = await apiRequest(url);
        if (!response.ok) {
            throw new Error('Error al filtrar reportes');
        }

        const data = await response.json();
        displayReports(data.reports);
    } catch (error) {
        console.error('Error al aplicar filtros:', error);
    }
}

// Mostrar reportes en la tabla
function displayReports(reports) {
    const tbody = document.getElementById('reportsTableBody');

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No hay reportes disponibles
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = reports.map(report => {
        const createdDate = new Date(report.created_at).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const publishedDate = report.published_at ?
            new Date(report.published_at).toLocaleDateString('es-CO') : 'No publicado';

        const fileSizeMB = (report.file_size / (1024 * 1024)).toFixed(2);

        return `
            <tr>
                <td><strong>${report.title}</strong></td>
                <td>${report.description || 'Sin descripción'}</td>
                <td>
                    ${report.file_name}
                    <br>
                    <span style="color: #6b7280; font-size: 0.875rem;">(${fileSizeMB} MB)</span>
                </td>
                <td>${createdDate}</td>
                <td>
                    <span class="badge ${report.is_public ? 'badge-success' : 'badge-warning'}">
                        ${report.is_public ? 'Público' : 'Privado'}
                    </span>
                    ${report.is_featured ? '<br><span class="badge badge-new">Destacado</span>' : ''}
                </td>
                <td>${report.view_count || 0}</td>
                <td>${report.download_count || 0}</td>
                <td>
                    <button style="background: none; border: none; color: var(--orange); cursor: pointer; margin-right: 0.5rem;" onclick="viewReport('${report.id}')" title="Ver">
                        <i class="material-icons">visibility</i>
                    </button>
                    <button style="background: none; border: none; color: #10b981; cursor: pointer; margin-right: 0.5rem;" onclick="downloadReport('${report.id}')" title="Descargar">
                        <i class="material-icons">download</i>
                    </button>
                    <button style="background: none; border: none; color: var(--orange); cursor: pointer; margin-right: 0.5rem;" onclick="editReport('${report.id}')" title="Editar">
                        <i class="material-icons">edit</i>
                    </button>
                    <button style="background: none; border: none; color: var(--error); cursor: pointer;" onclick="deleteReport('${report.id}')" title="Eliminar">
                        <i class="material-icons">delete</i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Funciones para acciones de reportes
function viewReport(id) {
    // Abrir modal o página de vista del reporte
    console.log('Ver reporte:', id);
}

function downloadReport(id) {
    // Descargar el archivo del reporte
    window.open(`/api/reports/${id}/download`, '_blank');
}

function editReport(id) {
    // Abrir modal de edición
    console.log('Editar reporte:', id);
}

async function deleteReport(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este reporte?')) {
        return;
    }

    try {
        const response = await apiRequest(`/api/reports/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showSuccessModal('Reporte eliminado exitosamente');
            loadReports(); // Recargar la lista
        } else {
            const error = await response.json();
            alert('Error al eliminar reporte: ' + (error.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al eliminar reporte:', error);
        alert('Error de conexión al eliminar reporte');
    }
}

// Función para crear nuevo reporte
async function createReport(formData) {
    try {
        const response = await apiRequest('/api/reports', {
            method: 'POST',
            body: formData // FormData ya incluye el archivo y los campos
        });

        if (response.ok) {
            const newReport = await response.json();
            showSuccessModal('Reporte creado exitosamente');
            closeModal('uploadModal');
            loadReports(); // Recargar la lista de reportes
            return true;
        } else {
            const error = await response.json();
            alert('Error al crear reporte: ' + (error.message || 'Error desconocido'));
            return false;
        }
    } catch (error) {
        console.error('Error al crear reporte:', error);
        alert('Error de conexión al crear reporte');
        return false;
    }
}

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
        submitBtn.innerHTML = '<i class="material-icons">hourglass_empty</i> Subiendo...';
        submitBtn.disabled = true;

        // Restaurar botón después
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
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
    // Hide all sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');

    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');

    // Cargar datos cuando se muestra la sección correspondiente
    if (sectionId === 'users') {
        loadUsers();
    } else if (sectionId === 'reports') {
        loadReports();
    } else if (sectionId === 'slider') {
        loadSliderImages();
    } else if (sectionId === 'audit') {
        loadAuditLogs();
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
        const response = await apiRequest('/api/slider');
        if (!response.ok) {
            throw new Error('Error al cargar imágenes del slider');
        }

        sliderImages = await response.json();
        displaySliderImages(sliderImages);
    } catch (error) {
        console.error('Error al cargar imágenes del slider:', error);
        // Mostrar mensaje de error en la sección del slider
        const sliderSection = document.getElementById('slider');
        const grid = sliderSection.querySelector('.grid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--error); padding: 2rem;">
                    <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">error</i>
                    <br>
                    Error al cargar imágenes del slider. Verifica la conexión con la base de datos.
                </div>
            `;
        }
    }
}

// Mostrar imágenes del slider en la interfaz
function displaySliderImages(images) {
    const grid = document.querySelector('#slider .grid');

    if (!images || images.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;">
                <i class="material-icons" style="font-size: 48px; margin-bottom: 1rem;">image</i>
                <br>
                No hay imágenes en el slider. Haz clic en "Agregar Imagen" para comenzar.
            </div>
        `;
        return;
    }

    grid.innerHTML = images.map(image => {
        // El backend ahora guarda solo el filename, así que usamos directamente image.image_path
        const imageUrl = `/uploads/slider/${image.image_path}`;
        console.log('URL de imagen generada:', imageUrl, 'desde path:', image.image_path);
        return `
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="height: 200px; background: linear-gradient(135deg, var(--orange), #ea580c); display: flex; align-items: center; justify-content: center; color: white; position: relative;">
                    <img src="${imageUrl}" alt="${image.alt_text}" style="width: 100%; height: 100%; object-fit: cover;" onerror="console.error('Error cargando imagen:', this.src); this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display: none; position: absolute; inset: 0; align-items: center; justify-content: center;">
                        <i class="material-icons" style="font-size: 48px;">image</i>
                    </div>
                </div>
                <div style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem;">${image.title}</h4>
                    <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 1rem;">${image.description || 'Sin descripción'}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="badge ${image.is_active ? 'badge-success' : 'badge-warning'}">
                            ${image.is_active ? 'Activo' : 'Inactivo'} • Posición ${image.position}
                        </span>
                        <div>
                            <button style="background: none; border: none; color: var(--orange); cursor: pointer; margin-right: 0.5rem;" onclick="editSliderImage('${image.id}')" title="Editar">
                                <i class="material-icons">edit</i>
                            </button>
                            <button style="background: none; border: none; color: var(--error); cursor: pointer;" onclick="deleteSliderImage('${image.id}')" title="Eliminar">
                                <i class="material-icons">delete</i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
    const image = sliderImages.find(img => img.id === id);
    if (!image) {
        alert('Imagen no encontrada');
        return;
    }

    // Abrir modal de edición con los datos actuales
    openEditSliderModal(image);
}

// Función para eliminar imagen del slider
async function deleteSliderImage(id) {
    const image = sliderImages.find(img => img.id === id);
    if (!image) {
        alert('Imagen no encontrada');
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar la imagen "${image.title}"?`)) {
        return;
    }

    try {
        const response = await apiRequest(`/api/slider/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showSuccessModal('Imagen eliminada del slider exitosamente');
            loadSliderImages(); // Recargar la lista
        } else {
            const error = await response.json();
            alert('Error al eliminar imagen: ' + (error.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al eliminar imagen del slider:', error);
        alert('Error de conexión al eliminar imagen del slider');
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
    editModal.innerHTML = `
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

                    <div class="form-group">
                        <label>Imagen actual:</label>
                        <div style="margin-top: 0.5rem;">
                            <img src="/uploads/slider/${image.image_path}" alt="${image.alt_text}" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <small style="color: #6b7280; font-size: 0.75rem;">Deja vacío para mantener la imagen actual</small>
                    </div>

                    <div class="form-group">
                        <label>Cambiar Imagen (opcional)</label>
                        <input type="file" id="editSliderImageInput" accept="image/*" onchange="handleEditImageSelection(event)">
                        <div class="upload-area" id="editSliderUploadArea">
                            <i class="material-icons" style="font-size: 48px; color: #9ca3af; margin-bottom: 1rem;">add_photo_alternate</i>
                            <p style="font-weight: 600;">Seleccionar Nueva Imagen</p>
                            <p style="color: #6b7280; font-size: 0.75rem; margin-top: 1rem;">JPG, PNG, GIF, WebP • Máximo 10MB</p>
                            <p id="editSelectedFileName" style="color: var(--success); font-size: 0.875rem; margin-top: 0.5rem; display: none;"></p>
                        </div>
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
    `;

    // Agregar clase modal
    editModal.className = 'modal active';

    // Agregar al DOM
    document.body.appendChild(editModal);

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
            submitBtn.innerHTML = '<i class="material-icons">hourglass_empty</i> Guardando...';
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
            submitBtn.innerHTML = '<i class="material-icons">save</i> Guardar Cambios';
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
    const subtitle = document.getElementById('sliderSubtitle')?.value.trim() || '';
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
    formData.append('image', file);

    console.log('FormData del slider preparado, enviando al servidor...');

    // Mostrar loading
    const submitBtn = document.querySelector('#sliderModal button[type="submit"]');
    if (submitBtn) {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="material-icons">hourglass_empty</i> Subiendo...';
        submitBtn.disabled = true;

        // Restaurar botón después
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
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
    }
}

// Drag and Drop Upload para el slider
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