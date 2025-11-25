/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  VIITS - Admin Panel JavaScript Functions                     ║
 * ║  Funciones completas para gestión del sistema                ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

// Configuración API
const API_BASE_URL = window.location.origin + '/api';
const DEMO_MODE = true; // Cambiar a false para producción

// ========================================
// UTILIDADES
// ========================================

// Helper para peticiones API con autenticación
async function apiRequest(endpoint, options = {}) {
    const token = DEMO_MODE 
        ? sessionStorage.getItem('demoToken') 
        : localStorage.getItem('authToken');

    if (!token && !DEMO_MODE) {
        window.location.href = 'login.html';
        return;
    }

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(!DEMO_MODE && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        });

        if (response.status === 401) {
            if (!DEMO_MODE) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
            }
            return null;
        }

        return response;
    } catch (error) {
        console.error('API Request Error:', error);
        showNotification('Error de conexión con el servidor', 'error');
        throw error;
    }
}

// Mostrar notificaciones
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="material-icons">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'warning'}</i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// DASHBOARD
// ========================================

async function loadDashboardStats() {
    if (DEMO_MODE) {
        // Datos de demostración
        updateStatsDisplay({
            reports_today: 15,
            downloads_today: 847,
            active_users_today: 1234,
            activities_today: 425
        });
        return;
    }

    try {
        const response = await apiRequest('/stats/dashboard');
        if (response && response.ok) {
            const data = await response.json();
            updateStatsDisplay(data);
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function updateStatsDisplay(stats) {
    // Actualizar las tarjetas de estadísticas
    const statCards = document.querySelectorAll('.stat-card .stat-value');
    if (statCards.length >= 4) {
        statCards[0].textContent = stats.reports_today || 0;
        statCards[1].textContent = stats.downloads_today || 0;
        statCards[2].textContent = (stats.active_users_today || 0).toLocaleString();
        statCards[3].textContent = '99.9%'; // Uptime
    }
}

// ========================================
// GESTIÓN DE REPORTES
// ========================================

let currentReports = [];

async function loadReports(page = 1) {
    if (DEMO_MODE) {
        // Datos de demostración
        currentReports = [
            {
                id: '1',
                title: 'Informe Mensual de Tráfico',
                description: 'Análisis detallado del comportamiento vehicular',
                file_name: 'informe_trafico_dic.pdf',
                file_size: 2621440,
                created_at: new Date().toISOString(),
                is_public: true,
                is_featured: false,
                created_by_name: 'Admin INVIAS'
            },
            {
                id: '2',
                title: 'Estadísticas de Seguridad Vial',
                description: 'Reporte de incidentes y métricas de seguridad',
                file_name: 'seguridad_vial_dic.pdf',
                file_size: 1887436,
                created_at: new Date(Date.now() - 86400000).toISOString(),
                is_public: true,
                is_featured: true,
                created_by_name: 'Admin INVIAS'
            }
        ];
        renderReportsTable(currentReports);
        return;
    }

    try {
        const response = await apiRequest(`/reports?page=${page}&limit=20`);
        if (response && response.ok) {
            const data = await response.json();
            currentReports = data.reports;
            renderReportsTable(currentReports);
        }
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

function renderReportsTable(reports) {
    const tbody = document.querySelector('#reports table tbody');
    if (!tbody) return;

    if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay reportes disponibles</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(report => `
        <tr data-report-id="${report.id}">
            <td><strong>${escapeHtml(report.title)}</strong></td>
            <td>${escapeHtml(report.description || '')}</td>
            <td>${escapeHtml(report.file_name)} <span style="color: #6b7280;">(${formatFileSize(report.file_size)})</span></td>
            <td>${formatDate(report.created_at)}</td>
            <td>
                ${report.is_featured ? '<span class="badge badge-new">DESTACADO</span>' : ''}
                ${report.is_public ? '<span class="badge badge-success">Público</span>' : '<span class="badge">Privado</span>'}
            </td>
            <td>
                <button onclick="editReport('${report.id}')" style="background: none; border: none; color: var(--orange); cursor: pointer; margin-right: 0.5rem;" title="Editar">
                    <i class="material-icons">edit</i>
                </button>
                <button onclick="deleteReport('${report.id}')" style="background: none; border: none; color: var(--error); cursor: pointer;" title="Eliminar">
                    <i class="material-icons">delete</i>
                </button>
                <button onclick="downloadReport('${report.id}')" style="background: none; border: none; color: var(--success); cursor: pointer;" title="Descargar">
                    <i class="material-icons">download</i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function uploadReport() {
    if (DEMO_MODE) {
        showNotification('Modo demostración: Reporte simulado agregado', 'success');
        return;
    }

    const fileInput = document.getElementById('reportFile');
    const titleInput = document.getElementById('reportTitle');
    const descInput = document.getElementById('reportDescription');

    if (!fileInput.files[0] || !titleInput.value) {
        showNotification('Archivo y título son requeridos', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('title', titleInput.value);
    formData.append('description', descInput.value);

    try {
        const response = await apiRequest('/reports', {
            method: 'POST',
            headers: {}, // Dejar que el navegador establezca Content-Type para FormData
            body: formData
        });

        if (response && response.ok) {
            showNotification('Reporte subido exitosamente', 'success');
            closeModal('uploadModal');
            loadReports();
        } else {
            showNotification('Error al subir reporte', 'error');
        }
    } catch (error) {
        console.error('Error uploading report:', error);
        showNotification('Error al subir reporte', 'error');
    }
}

async function deleteReport(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este reporte?')) {
        return;
    }

    if (DEMO_MODE) {
        showNotification('Modo demostración: Reporte eliminado simuladamente', 'success');
        currentReports = currentReports.filter(r => r.id !== id);
        renderReportsTable(currentReports);
        return;
    }

    try {
        const response = await apiRequest(`/reports/${id}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            showNotification('Reporte eliminado exitosamente', 'success');
            loadReports();
        } else {
            showNotification('Error al eliminar reporte', 'error');
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        showNotification('Error al eliminar reporte', 'error');
    }
}

// ========================================
// GESTIÓN DE USUARIOS
// ========================================

async function loadUsers() {
    if (DEMO_MODE) {
        const demoUsers = [
            {
                id: '1',
                name: 'Admin INVIAS',
                email: 'admin@invias.gov.co',
                role: 'admin',
                is_active: true,
                totp_enabled: true,
                last_login: new Date().toISOString()
            },
            {
                id: '2',
                name: 'Usuario Academia',
                email: 'investigador@universidad.edu.co',
                role: 'viewer',
                is_active: true,
                totp_enabled: true,
                last_login: new Date(Date.now() - 7200000).toISOString()
            }
        ];
        renderUsersTable(demoUsers);
        return;
    }

    try {
        const response = await apiRequest('/users');
        if (response && response.ok) {
            const data = await response.json();
            renderUsersTable(data.users || data);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsersTable(users) {
    const tbody = document.querySelector('#users table tbody');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${escapeHtml(user.name)}</strong></td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="badge badge-${user.role === 'admin' ? 'error' : 'warning'}">${user.role.toUpperCase()}</span></td>
            <td>INVIAS</td>
            <td>
                <i class="material-icons" style="color: ${user.totp_enabled ? 'var(--success)' : '#ccc'};">
                    ${user.totp_enabled ? 'check_circle' : 'cancel'}
                </i>
            </td>
            <td>${formatDate(user.last_login)}</td>
            <td><span class="badge badge-${user.is_active ? 'success' : 'error'}">${user.is_active ? 'Activo' : 'Inactivo'}</span></td>
        </tr>
    `).join('');
}

// ========================================
// GESTIÓN DE AUDITORÍA
// ========================================

async function loadAuditLogs() {
    if (DEMO_MODE) return; // Ya tiene datos de demostración en HTML

    try {
        const response = await apiRequest('/audit');
        if (response && response.ok) {
            const data = await response.json();
            renderAuditLogs(data.logs || data);
        }
    } catch (error) {
        console.error('Error loading audit logs:', error);
    }
}

// ========================================
// UTILIDAD ESCAPE HTML
// ========================================

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    loadDashboardStats();
    
    // Event listeners para las secciones
    const sections = ['dashboard', 'reports', 'slider', 'users', 'downloads', 'audit', 'settings'];
    sections.forEach(section => {
        const menuItem = document.querySelector(`[onclick="showSection('${section}')"]`);
        if (menuItem) {
            menuItem.addEventListener('click', () => {
                if (section === 'reports') loadReports();
                else if (section === 'users') loadUsers();
                else if (section === 'audit') loadAuditLogs();
            });
        }
    });

    console.log('%c✅ Admin Panel Cargado', 'color: #10b981; font-size: 14px; font-weight: bold;');
    console.log(`%cModo: ${DEMO_MODE ? 'DEMOSTRACIÓN' : 'PRODUCCIÓN'}`, 'color: #6b7280; font-size: 12px;');
});
