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
    if (typeof _updateTopbar === "function") _updateTopbar(sectionId);
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
    } else if (sectionId === 'alertas-dai') {
        loadAlertasDAI();
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
    const grid = document.getElementById('sliderGrid');
    if (!grid) return;

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
        const imageUrl = `/uploads/slider/${image.image_path}`;
        const isActive = image.is_active;
        return `
            <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1px solid #f1f5f9;transition:box-shadow 0.2s;opacity:${isActive ? '1' : '0.65'};" onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'" onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'">
                <div style="height:180px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
                    <img src="${imageUrl}" alt="${image.alt_text}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;background:#f8fafc;">
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
    }).join('');
}

// Mostrar slides archivados
function displayArchivedSliders(archived) {
    const grid = document.getElementById('sliderArchivedGrid');
    const countBadge = document.getElementById('archivedCount');
    if (countBadge) countBadge.textContent = archived.length;
    if (!grid) return;

    if (!archived || archived.length === 0) {
        grid.innerHTML = '<p style="color:#9ca3af;font-size:0.875rem;padding:1rem;">No hay slides archivados.</p>';
        return;
    }

    grid.innerHTML = archived.map(image => {
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
    }).join('');
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
    const image = sliderImages.find(img => img.id === id);
    if (!image) {
        alert('Imagen no encontrada');
        return;
    }

    // Abrir modal de edición con los datos actuales
    openEditSliderModal(image);
}

// Función para archivar imagen del slider (reemplaza eliminar)
async function archiveSliderImage(id) {
    const image = sliderImages.find(img => img.id === id);
    const name = image ? image.title : id;
    if (!confirm(`¿Archivar "${name}"? Podrás restaurarla luego desde la sección de archivados.`)) return;

    try {
        const response = await apiRequest(`/api/slider/${id}/archive`, { method: 'PATCH' });
        if (response && response.ok) {
            showSuccessModal('Slide archivado correctamente');
            loadSliderImages();
        } else {
            const err = await response.json().catch(() => ({}));
            alert('Error al archivar: ' + (err.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al archivar imagen del slider:', error);
        alert('Error de conexión');
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
                            <div id="editSliderPreviewImg" style="position:absolute;inset:0;background-image:url('/uploads/slider/${image.image_path}');background-size:cover;background-position:center;opacity:${image.image_opacity ?? 0.35};${image.image_path && image.image_path !== 'placeholder.jpg' ? '' : 'display:none;'}"></div>
                            <div id="editSliderPreviewContent" style="position:relative;z-index:1;text-align:center;padding:1rem;color:${image.text_color || '#ffffff'};">
                                <div style="font-size:0.65rem;font-weight:600;letter-spacing:0.05em;opacity:0.8;margin-bottom:0.5rem;">⬤ Sistema en línea • Monitoreo 24/7</div>
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
    `;

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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#6b7280;"><i class="material-icons" style="font-size:2rem;display:block;margin-bottom:0.5rem;">search_off</i>No se encontraron alertas</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(a => {
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
        }).join('');
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
    alert('ALERTA DAI  ' + a.id + '\n\nDispositivo: ' + a.dispositivo + '\nEstaci�n: ' + a.estacion + '\nTipo: ' + a.tipo + '\nSeveridad: ' + a.severidad.toUpperCase() + '\nEstado: ' + a.estado + '\nV�a: ' + a.via + '\nFecha: ' + new Date(a.fecha).toLocaleString('es-CO'));
}

function resolverAlertaDAI(id) {
    if (!confirm('�Marcar la alerta ' + id + ' como RESUELTA?')) return;
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
function showLogoutConfirm() { showModal("logoutConfirmModal"); }
function confirmLogout() { closeModal("logoutConfirmModal"); logout(); }
