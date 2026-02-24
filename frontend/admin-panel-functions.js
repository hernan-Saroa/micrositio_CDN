/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  VIITS - Admin Panel JavaScript Functions                     ║
 * ║  Funciones completas para gestión del sistema                ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

// ========================================
// HELPERS DROP-ZONE REPORTES
// ========================================

function handleReportFileDrop(event) {
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    const fileInput = document.getElementById('reportFile');
    if (fileInput) {
        // Asignar archivo al input vía DataTransfer
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        fileInput.files = dt.files;
        onReportFileSelected(fileInput);
    }
}

function onReportFileSelected(input) {
    const nameEl = document.getElementById('reportFileSelectedName');
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (nameEl) {
        nameEl.textContent = `📄 ${file.name} (${formatFileSize(file.size)})`;
        nameEl.style.display = 'block';
    }
    // Auto-fill title if empty
    const titleInput = document.getElementById('reportTitle');
    if (titleInput && !titleInput.value) {
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        titleInput.value = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    }
}



// Configuración API — usa ventana global para evitar redeclaración de const entre scripts
window.API_BASE_URL = window.API_BASE_URL || (window.location.origin + '/api');
window.DEMO_MODE = window.DEMO_MODE ?? false;

// ========================================
// UTILIDADES
// ========================================

// Helper para peticiones API con autenticación
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (!token && !window.DEMO_MODE) {
        window.location.href = 'login.html';
        return;
    }

    const isFormData = options.body instanceof FormData;
    const defaultHeaders = {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    // Si ya viene con /api/ o es URL absoluta, usarla tal cual
    // Si viene sin /api/ (ej: '/reports'), agregar el prefijo base
    let fullUrl;
    if (endpoint.startsWith('http') || endpoint.startsWith('/api/')) {
        fullUrl = endpoint;
    } else {
        fullUrl = (window.API_BASE_URL || (window.location.origin + '/api')) + endpoint;
    }

    try {
        const response = await fetch(fullUrl, {
            ...options,
            headers: defaultHeaders
        });

        if (response.status === 401) {
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
            window.location.href = 'login.html';
            return null;
        }

        return response;
    } catch (error) {
        console.error('API Request Error:', error);
        if (typeof showNotification === 'function') showNotification('Error de conexión con el servidor', 'error');
        throw error;
    }
}


// Mostrar notificaciones
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
        color: white;
        padding: 0.875rem 1.25rem;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.9rem;
        font-weight: 500;
        max-width: 360px;
    `;
    const icons = { success: 'check_circle', error: 'error', warning: 'warning' };
    notification.innerHTML = `<i class="material-icons" style="font-size:20px;">${icons[type] || 'info'}</i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3500);
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

// Obtener ícono según tipo MIME
function getMimeIcon(mimeType, fileName) {
    if (!mimeType && fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        if (ext === 'pdf') return { icon: 'picture_as_pdf', color: '#ef4444' };
        if (['xls', 'xlsx'].includes(ext)) return { icon: 'table_chart', color: '#10b981' };
        if (ext === 'csv') return { icon: 'grid_on', color: '#3b82f6' };
        if (['doc', 'docx'].includes(ext)) return { icon: 'article', color: '#6366f1' };
        return { icon: 'insert_drive_file', color: '#6b7280' };
    }
    if (!mimeType) return { icon: 'insert_drive_file', color: '#6b7280' };
    if (mimeType === 'application/pdf') return { icon: 'picture_as_pdf', color: '#ef4444' };
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return { icon: 'table_chart', color: '#10b981' };
    if (mimeType.includes('csv')) return { icon: 'grid_on', color: '#3b82f6' };
    if (mimeType.includes('word') || mimeType.includes('wordprocessing')) return { icon: 'article', color: '#6366f1' };
    return { icon: 'insert_drive_file', color: '#6b7280' };
}

// ========================================
// DASHBOARD
// ========================================

async function loadDashboardStats() {
    // Delegate to new executive dashboard loader (admin-panel.js)
    if (typeof loadDashboardData === 'function') {
        var range = dbGetDateRange(_dbPreset || 'today');
        loadDashboardData(range.from, range.to);
    }
}

function updateStatsDisplay(stats) {
    const statCards = document.querySelectorAll('.stat-card .stat-value');
    if (statCards.length >= 4) {
        statCards[0].textContent = stats.reports_today || 0;
        statCards[1].textContent = stats.downloads_today || 0;
        statCards[2].textContent = (stats.active_users_today || 0).toLocaleString();
        statCards[3].textContent = '99.9%';
    }
}

// ========================================
// GESTIÓN DE REPORTES
// ========================================

let currentReports = [];
let reportsStatData = {};

async function loadReports(page = 1) {
    const search = document.getElementById('reportsSearch')?.value || '';
    const isPublic = document.getElementById('reportsStatusFilter')?.value ?? '';
    const sortBy = document.getElementById('reportsSortBy')?.value || 'created_at';
    const sortOrder = document.getElementById('reportsSortOrder')?.value || 'DESC';

    let url = `/reports?page=${page}&limit=20&sort_by=${sortBy}&sort_order=${sortOrder}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (isPublic !== '') url += `&is_public=${isPublic}`;



    try {
        const response = await apiRequest(url);
        if (response && response.ok) {
            const data = await response.json();
            currentReports = data.reports || [];
            renderReportsTable(currentReports);
            // Usar stats globales del API (no basados en la página actual)
            if (data.stats) {
                updateReportsStats(data.stats);
            } else {
                // Fallback: calcular desde la lista actual (solo para la página)
                updateReportsStats({
                    total: currentReports.length,
                    totalPublic: currentReports.filter(r => r.is_public == true || r.is_public == 1).length,
                    totalFeatured: currentReports.filter(r => r.is_featured == true || r.is_featured == 1).length,
                    totalDownloads: currentReports.reduce((s, r) => s + (r.download_count || 0), 0)
                });
            }
        } else {
            showNotification('Error al cargar reportes', 'error');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showNotification('Error de conexión al cargar reportes', 'error');
    }
}

function applyReportsFilters() {
    loadReports(1);
}

// Actualizar mini stat-cards usando stats del servidor
function updateReportsStats(stats) {
    const totalEl = document.getElementById('statTotalReports');
    const publicEl = document.getElementById('statPublicReports');
    const featuredEl = document.getElementById('statFeaturedReports');
    const downloadsEl = document.getElementById('statTotalDownloads');

    const total = typeof stats.total === 'number' ? stats.total : 0;
    const pub = typeof stats.totalPublic === 'number' ? stats.totalPublic : 0;
    const feat = typeof stats.totalFeatured === 'number' ? stats.totalFeatured : 0;
    const downloads = typeof stats.totalDownloads === 'number' ? stats.totalDownloads : 0;

    if (totalEl) totalEl.textContent = total;
    if (publicEl) publicEl.textContent = pub;
    if (featuredEl) featuredEl.textContent = feat;
    if (downloadsEl) downloadsEl.textContent = downloads > 999 ? (downloads / 1000).toFixed(1) + 'K' : downloads;
}

function renderReportsTable(reports) {
    const container = document.getElementById('reportsCardList');
    if (!container) return;

    if (!reports || reports.length === 0) {
        container.innerHTML = `
            <div class="rpt-empty">
                <i class="material-icons">description</i>
                No hay reportes. Carga el primero con el botón <strong>+ Cargar Reporte</strong>.
            </div>`;
        return;
    }

    container.innerHTML = reports.map(report => {
        const fileName = report.file_name || '';
        const fileSize = report.file_size || 0;
        const mimeType = report.mime_type || '';
        const isPublic = report.is_public == true || report.is_public == 1;
        const isFeatured = report.is_featured == true || report.is_featured == 1;
        const viewCount = report.view_count || 0;
        const dlCount = report.download_count || 0;
        const createdAt = report.created_at || '';

        const { icon, color } = getMimeIcon(mimeType, fileName);
        const titleText = escapeHtml(report.title || 'Sin título');
        const descText = escapeHtml((report.description || '').substring(0, 100))
            + ((report.description || '').length > 100 ? '…' : '');
        const fileSizeStr = formatFileSize(fileSize);
        const dateStr = formatDate(createdAt);

        return `
        <div class="rpt-card" data-id="${report.id}">
            <!-- 1. File icon -->
            <div class="rpt-file-icon" style="background:${color}1a;">
                <i class="material-icons" style="color:${color};font-size:24px;">${icon}</i>
            </div>

            <!-- 2. Info -->
            <div class="rpt-info">
                <div class="rpt-title" title="${titleText}">${titleText}</div>
                ${descText ? `<div class="rpt-desc" title="${descText}">${descText}</div>` : ''}
                <div class="rpt-meta">
                    <span class="rpt-badge ${isPublic ? 'rpt-badge-public' : 'rpt-badge-private'}">
                        <i class="material-icons" style="font-size:11px;">${isPublic ? 'public' : 'lock'}</i>
                        ${isPublic ? 'Público' : 'Privado'}
                    </span>
                    ${isFeatured ? `<span class="rpt-badge rpt-badge-featured"><i class="material-icons" style="font-size:11px;">star</i>Destacado</span>` : ''}
                    ${fileName ? `<span class="rpt-file-meta">${escapeHtml(fileName)}${fileSizeStr ? ' · ' + fileSizeStr : ''}</span>` : ''}
                </div>
            </div>

            <!-- 3. Date -->
            <div class="rpt-date">${dateStr}</div>

            <!-- 4. Vistas -->
            <div class="rpt-counter">
                <span class="rpt-counter-val">${viewCount}</span>
                <span class="rpt-counter-lbl">Vistas</span>
            </div>

            <!-- 5. Descargas -->
            <div class="rpt-counter">
                <span class="rpt-counter-val">${dlCount}</span>
                <span class="rpt-counter-lbl">Descargas</span>
            </div>

            <!-- 6. Actions -->
            <div class="rpt-actions">
                <button class="rpt-btn ${isPublic ? 'rpt-btn-vis' : 'rpt-btn-invis'}"
                    title="${isPublic ? 'Hacer Privado' : 'Hacer Público'}"
                    onclick="toggleReportVisibility('${report.id}', ${isPublic})">
                    <i class="material-icons">${isPublic ? 'visibility' : 'visibility_off'}</i>
                </button>
                <button class="rpt-btn ${isFeatured ? 'rpt-btn-star' : 'rpt-btn-nostar'}"
                    title="${isFeatured ? 'Quitar Destacado' : 'Marcar como Destacado'}"
                    onclick="toggleReportFeatured('${report.id}', ${isFeatured})">
                    <i class="material-icons">${isFeatured ? 'star' : 'star_border'}</i>
                </button>
                <button class="rpt-btn rpt-btn-down"
                    title="Descargar archivo"
                    onclick="downloadReport('${report.id}')">
                    <i class="material-icons">download</i>
                </button>
                <button class="rpt-btn rpt-btn-edit"
                    title="Editar información"
                    onclick="editReport('${report.id}')">
                    <i class="material-icons">edit</i>
                </button>
                <button class="rpt-btn rpt-btn-del"
                    title="Eliminar reporte"
                    onclick="deleteReport('${report.id}')">
                    <i class="material-icons">delete</i>
                </button>
            </div>
        </div>`;
    }).join('');
}



async function toggleReportVisibility(id, currentIsPublic) {
    try {
        const response = await apiRequest(`/reports/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_public: !currentIsPublic })
        });
        if (response && response.ok) {
            showNotification(currentIsPublic ? 'Reporte marcado como Privado' : 'Reporte marcado como Público', 'success');
            loadReports();
        } else {
            showNotification('Error al cambiar visibilidad', 'error');
        }
    } catch (e) {
        showNotification('Error al cambiar visibilidad', 'error');
    }
}

async function toggleReportFeatured(id, currentIsFeatured) {
    try {
        const response = await apiRequest(`/reports/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_featured: !currentIsFeatured })
        });
        if (response && response.ok) {
            showNotification(currentIsFeatured ? 'Quitado de destacados' : 'Marcado como destacado ⭐', 'success');
            loadReports();
        } else {
            showNotification('Error al cambiar estado destacado', 'error');
        }
    } catch (e) {
        showNotification('Error al cambiar estado destacado', 'error');
    }
}

function downloadReport(id) {
    window.open(`/api/reports/${id}/download`, '_blank');
}

async function deleteReport(id) {
    if (!confirm('¿Eliminar este reporte permanentemente? Esta acción no se puede deshacer.')) return;
    try {
        const response = await apiRequest(`/reports/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            showNotification('Reporte eliminado', 'success');
            loadReports();
        } else {
            showNotification('Error al eliminar el reporte', 'error');
        }
    } catch (e) {
        showNotification('Error al eliminar el reporte', 'error');
    }
}


async function uploadReport() {
    const fileInput = document.getElementById('reportFile');
    const titleInput = document.getElementById('reportTitle');
    const descInput = document.getElementById('reportDescription');
    const isPublicToggle = document.getElementById('reportIsPublic');
    const isFeaturedToggle = document.getElementById('reportIsFeatured');

    if (!fileInput || !fileInput.files[0]) {
        showNotification('Selecciona un archivo para continuar', 'error');
        return;
    }
    if (!titleInput || !titleInput.value.trim()) {
        showNotification('El título es requerido', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('title', titleInput.value.trim());
    formData.append('description', descInput?.value.trim() || '');
    formData.append('is_public', isPublicToggle?.checked ? 'true' : 'false');
    formData.append('is_featured', isFeaturedToggle?.checked ? 'true' : 'false');

    try {
        const uploadBtn = document.getElementById('uploadReportBtn');
        if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = 'Cargando…'; }

        const response = await apiRequest('/reports', {
            method: 'POST',
            body: formData
        });

        if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.textContent = 'Cargar Reporte'; }

        if (response && response.ok) {
            showNotification('✅ Reporte cargado exitosamente', 'success');
            closeModal('uploadModal');
            loadReports();
            // Limpiar form
            fileInput.value = '';
            if (titleInput) titleInput.value = '';
            if (descInput) descInput.value = '';
        } else {
            const err = await response.json().catch(() => ({}));
            showNotification('Error: ' + (err.message || 'No se pudo cargar el reporte'), 'error');
        }
    } catch (error) {
        console.error('Error uploading report:', error);
        showNotification('Error de conexión al cargar el reporte', 'error');
    }
}

async function editReport(id) {
    const report = currentReports.find(r => r.id === id || r.id === parseInt(id));
    if (!report) {
        showNotification('Reporte no encontrado', 'error');
        return;
    }

    // Crear modal de edición dinámicamente
    let existing = document.getElementById('editReportModal');
    if (existing) existing.remove();

    const fileSizeLabel = report.file_size
        ? `${(report.file_size / (1024 * 1024)).toFixed(2)} MB`
        : '';

    const modal = document.createElement('div');
    modal.id = 'editReportModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;">
            <div class="modal-header">
                <h3>Editar Reporte</h3>
                <button onclick="document.getElementById('editReportModal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:1rem;">
                <div class="form-group">
                    <label>Título *</label>
                    <input type="text" id="editReportTitle" value="${escapeHtml(report.title || '')}" placeholder="Título del reporte">
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <textarea id="editReportDescription" rows="3" placeholder="Descripción del reporte">${escapeHtml(report.description || '')}</textarea>
                </div>
                <div style="display:flex;gap:1.5rem;">
                    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-weight:500;">
                        <input type="checkbox" id="editReportIsPublic" ${report.is_public ? 'checked' : ''} style="width:16px;height:16px;">
                        <i class="material-icons" style="font-size:18px;color:#059669;">public</i> Público
                    </label>
                    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-weight:500;">
                        <input type="checkbox" id="editReportIsFeatured" ${report.is_featured ? 'checked' : ''} style="width:16px;height:16px;">
                        <i class="material-icons" style="font-size:18px;color:#ea580c;">star</i> Destacado
                    </label>
                </div>

                <!-- REEMPLAZAR ARCHIVO -->
                <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                    <div style="background:#f9fafb;padding:0.75rem 1rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:0.5rem;">
                        <i class="material-icons" style="font-size:18px;color:#6b7280;">swap_horiz</i>
                        <span style="font-weight:600;font-size:0.875rem;color:#374151;">Reemplazar archivo</span>
                    </div>
                    <div style="padding:1rem;">
                        <!-- Archivo actual -->
                        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.85rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:0.75rem;">
                            <i class="material-icons" style="color:#ea580c;font-size:20px;">description</i>
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:0.8rem;color:#6b7280;">Archivo actual</div>
                                <div style="font-weight:600;font-size:0.85rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(report.file_name || 'Desconocido')} ${fileSizeLabel ? '<span style="font-weight:400;color:#6b7280;">· ' + fileSizeLabel + '</span>' : ''}</div>
                            </div>
                        </div>
                        <!-- Drop zone nuevo archivo -->
                        <label id="editFileDropZone" for="editReportFile" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4rem;padding:1rem;border:2px dashed #d1d5db;border-radius:8px;cursor:pointer;transition:border-color .2s,background .2s;background:#fafafa;">
                            <i class="material-icons" style="font-size:32px;color:#9ca3af;">upload_file</i>
                            <span style="font-size:0.85rem;color:#6b7280;">Haz clic o arrastra el nuevo archivo aquí</span>
                            <span id="editFileSelectedName" style="font-size:0.8rem;font-weight:600;color:#ea580c;display:none;"></span>
                            <input type="file" id="editReportFile" accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.ppt,.pptx" style="display:none;"
                                onchange="
                                    const f = this.files[0];
                                    const lbl = document.getElementById('editFileSelectedName');
                                    if (f) {
                                        lbl.textContent = '\u2705 ' + f.name + ' (' + (f.size/1024/1024).toFixed(2) + ' MB)';
                                        lbl.style.display = 'block';
                                        document.getElementById('editFileDropZone').style.borderColor = '#ea580c';
                                        document.getElementById('editFileDropZone').style.background = '#fff7ed';
                                    }
                                ">
                        </label>
                        <p style="font-size:0.78rem;color:#9ca3af;margin-top:0.5rem;margin-bottom:0;">Al guardar con un nuevo archivo, el documento anterior será eliminado permanentemente.</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e5e7eb;">
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('editReportModal').remove()">Cancelar</button>
                <button class="btn btn-primary btn-sm" onclick="saveEditReport('${id}')">
                    <i class="material-icons">save</i> Guardar Cambios
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function saveEditReport(id) {
    const title = document.getElementById('editReportTitle')?.value.trim();
    const description = document.getElementById('editReportDescription')?.value.trim();
    const isPublic = document.getElementById('editReportIsPublic')?.checked;
    const isFeatured = document.getElementById('editReportIsFeatured')?.checked;
    const newFile = document.getElementById('editReportFile')?.files[0];

    if (!title) {
        showNotification('El título es requerido', 'error');
        return;
    }

    try {
        let response;

        if (newFile) {
            // Con archivo nuevo: multipart/form-data para reemplazar el documento
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description || '');
            formData.append('is_public', isPublic ? 'true' : 'false');
            formData.append('is_featured', isFeatured ? 'true' : 'false');
            formData.append('file', newFile);
            response = await apiRequest(`/reports/${id}/replace`, {
                method: 'PUT',
                body: formData
            });
            // Fallback: si no hay endpoint /replace, intentar el endpoint estándar con FormData
            if (response && response.status === 404) {
                response = await apiRequest(`/reports/${id}`, {
                    method: 'PUT',
                    body: formData
                });
            }
        } else {
            // Sin archivo nuevo: solo actualizar metadatos con JSON
            response = await apiRequest(`/reports/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ title, description, is_public: isPublic, is_featured: isFeatured })
            });
        }

        if (response && response.ok) {
            showNotification(newFile ? 'Reporte y archivo actualizados ✅' : 'Reporte actualizado ✅', 'success');
            document.getElementById('editReportModal')?.remove();
            loadReports();
        } else {
            showNotification('Error al guardar cambios', 'error');
        }
    } catch (e) {
        console.error('saveEditReport error:', e);
        showNotification('Error de conexión', 'error');
    }
}




async function deleteReport(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este reporte? Esta acción es permanente.')) return;

    try {
        const response = await apiRequest(`/reports/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            showNotification('Reporte eliminado', 'success');
            loadReports();
        } else {
            showNotification('Error al eliminar reporte', 'error');
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        showNotification('Error de conexión', 'error');
    }
}

function downloadReport(id) {
    window.open(`${API_BASE_URL}/reports/${id}/download`, '_blank');
}

// ========================================
// GESTIÓN DE USUARIOS
// ========================================

async function loadUsers() {
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
    const tbody = document.querySelector('#users table tbody') || document.getElementById('usersTableBody');
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
    // Redirect to the new audit module in admin-panel.js
    if (typeof loadAuditAdmin === 'function') loadAuditAdmin(1);
}

// ========================================
// UTILIDAD ESCAPE HTML
// ========================================

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ========================================
// INICIALIZACIÓN
// ========================================

// Añadir estilos de animación de notificaciones si no existen
(function () {
    if (!document.getElementById('fnStylesheet')) {
        const s = document.createElement('style');
        s.id = 'fnStylesheet';
        s.textContent = `
            @keyframes slideInRight { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
            @keyframes slideOutRight { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(30px); } }
            .report-row { transition: background 0.15s; }
            .report-row:hover { background:#f8fafc; }
            #reportsTableBody tr td { vertical-align: middle; padding: 0.75rem 1rem; }
        `;
        document.head.appendChild(s);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();

    // Event listeners para las secciones
    const sections = ['dashboard', 'reports', 'slider', 'users', 'downloads', 'audit', 'settings'];
    sections.forEach(section => {
        const menuItem = document.querySelector(`[onclick="showSection('${section}')"]`);
        if (menuItem) {
            menuItem.addEventListener('click', () => {
                if (section === 'reports') loadReports();
                else if (section === 'users') loadUsers();
                else if (section === 'audit') { if (typeof loadAuditAdmin === 'function') loadAuditAdmin(1); }
            });
        }
    });

    // Búsqueda de reportes en tiempo real (debounce)
    const searchInput = document.getElementById('reportsSearch');
    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadReports(1), 350);
        });
    }

    console.log('%c✅ Admin Panel Cargado', 'color: #10b981; font-size: 14px; font-weight: bold;');
    console.log(`%cModo: PRODUCCIÓN (API real)`, 'color: #6b7280; font-size: 12px;');
});

// ══════════════════════════════════════════════════════════════════════════════
//  USERS MODULE — API Real + Responsive (v2)
// ══════════════════════════════════════════════════════════════════════════════

const UM_MODULES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'reports', label: 'Reportes', icon: 'description' },
    { id: 'slider', label: 'Slider', icon: 'image' },
    { id: 'alertas-dai', label: 'Alertas DAI', icon: 'warning_amber' },
    { id: 'users', label: 'Usuarios', icon: 'people' },
    { id: 'downloads', label: 'Descargas', icon: 'download' },
    { id: 'audit', label: 'Auditoría', icon: 'history' },
    { id: 'config', label: 'Configuración', icon: 'settings' },
];

const ROLE_PALETTES = [
    { bg: '#fff7ed', border: '#fed7aa', icon: '#f97316', bar: '#f97316', name: '#ea580c' },
    { bg: '#eff6ff', border: '#bfdbfe', icon: '#3b82f6', bar: '#3b82f6', name: '#2563eb' },
    { bg: '#f5f3ff', border: '#ddd6fe', icon: '#8b5cf6', bar: '#8b5cf6', name: '#7c3aed' },
    { bg: '#f0fdf4', border: '#bbf7d0', icon: '#22c55e', bar: '#22c55e', name: '#16a34a' },
    { bg: '#fef2f2', border: '#fecaca', icon: '#ef4444', bar: '#ef4444', name: '#dc2626' },
    { bg: '#ecfdf5', border: '#a7f3d0', icon: '#10b981', bar: '#10b981', name: '#059669' },
];

const AVATAR_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#10b981', '#f59e0b', '#06b6d4'];

// ── Estado en memoria ─────────────────────────────────────────────────────────
let _umCachedUsers = [];      // usuarios cargados desde la API
let _umFilterRole = '';
let _umFilterSearch = '';

// ── Roles (localStorage) ──────────────────────────────────────────────────────
function _umRoles() { return JSON.parse(localStorage.getItem('um_roles') || '[]'); }
function _umSaveRoles(r) { localStorage.setItem('um_roles', JSON.stringify(r)); }
function _umId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function _umRoleById(id) { return _umRoles().find(r => r.id === id) || null; }

// Seed de roles si no existen
function _umSeedRoles() {
    if (localStorage.getItem('um_roles')) return;
    localStorage.setItem('um_roles', JSON.stringify([
        { id: 'r_admin', name: 'Administrador', desc: 'Acceso total a la plataforma', modules: UM_MODULES.map(m => m.id) },
        { id: 'r_viewer', name: 'Monitor DAI', desc: 'Visualización y gestión de alertas', modules: ['dashboard', 'alertas-dai', 'downloads'] },
        { id: 'r_editor', name: 'Editor', desc: 'Gestión de contenido publicable', modules: ['dashboard', 'reports', 'slider'] },
    ]));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _umEsc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
function _umTimeAgo(date) {
    const d = Math.floor((Date.now() - date) / 1000);
    if (d < 60) return 'Hace unos segundos';
    if (d < 3600) return `Hace ${Math.floor(d / 60)}m`;
    if (d < 86400) return `Hace ${Math.floor(d / 3600)}h`;
    return `Hace ${Math.floor(d / 86400)}d`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.loadUsers = async function () {
    _umSeedRoles();
    _umSetLoading(true);
    try {
        const response = await apiRequest('/users');
        if (!response) { _umCachedUsers = []; }
        else if (!response.ok) {
            console.warn('Users API responded with status:', response.status);
            _umCachedUsers = [];
            _umToast('Error al cargar usuarios (' + response.status + ')', 'error');
        } else {
            const data = await response.json();
            if (Array.isArray(data)) {
                _umCachedUsers = data;
            } else if (data && Array.isArray(data.users)) {
                _umCachedUsers = data.users;
            } else {
                _umCachedUsers = [];
            }
        }
    } catch (e) {
        console.warn('Users API error:', e);
        _umCachedUsers = [];
        _umToast('Error al cargar usuarios de la API', 'error');
    }
    _umSetLoading(false);
    _umRenderUsers();
    _umRenderRoles();
    _umPopulateRoleFilter();
};


function _umSetLoading(on) {
    const body = document.getElementById('umUsersBody');
    if (!body) return;
    if (on) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:#94a3b8;">
            <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
               <div class="um-spinner"></div> Cargando usuarios...
            </div></td></tr>`;
    }
}

// ── Tab switch ────────────────────────────────────────────────────────────────
window.usersTabSwitch = function (tab) {
    const isU = tab === 'usuarios';
    document.getElementById('umPanelUsuarios').style.display = isU ? '' : 'none';
    document.getElementById('umPanelRoles').style.display = isU ? 'none' : '';
    document.getElementById('umSearchWrap').style.display = isU ? '' : 'none';
    document.getElementById('umRoleFilter').style.display = isU ? '' : 'none';
    document.getElementById('umTabUsuarios').classList.toggle('active', isU);
    document.getElementById('umTabRoles').classList.toggle('active', !isU);
};

// ── Render Users ──────────────────────────────────────────────────────────────
function _umRenderUsers() {
    let users = [..._umCachedUsers];

    // Filtrar por rol si aplica (campo `role` de la API)
    if (_umFilterRole) users = users.filter(u => (u.role || '') === _umFilterRole);

    // Búsqueda
    if (_umFilterSearch) {
        const q = _umFilterSearch.toLowerCase();
        users = users.filter(u =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }

    const body = document.getElementById('umUsersBody');
    const empty = document.getElementById('umUsersEmpty');
    const countEl = document.getElementById('umCountUsuarios');
    if (countEl) countEl.textContent = _umCachedUsers.length;
    if (!body) return;

    if (!users.length) {
        body.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }
    if (empty) empty.style.display = 'none';

    // Mapa de rol string→paleta (index por orden de aparición)
    const roleNames = [...new Set(_umCachedUsers.map(u => u.role).filter(Boolean))];

    body.innerHTML = users.map((u, i) => {
        const initials = (u.name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
        const avatarC = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const roleStr = u.role || 'sin rol';
        const roleIdx = roleNames.indexOf(u.role);
        const palette = ROLE_PALETTES[Math.max(0, roleIdx) % ROLE_PALETTES.length];
        const isActive = u.is_active !== false && u.is_active !== 0;
        const lastLogin = u.last_login ? _umTimeAgo(new Date(u.last_login)) : '—';

        return `<tr>
          <td>
            <div class="um-avatar-cell">
              <div class="um-avatar" style="background:${avatarC}">${initials}</div>
              <div>
                <div class="um-user-name">${_umEsc(u.name || '—')}</div>
                <div class="um-user-email">${_umEsc(u.email || '—')}</div>
                <span class="um-role-badge-sm" style="background:${palette.bg};color:${palette.name};border:1px solid ${palette.border}">
                  ${_umEsc(roleStr)}
                </span>
              </div>
            </div>
          </td>
          <td>
            <span class="um-status-pill ${isActive ? 'active' : 'suspended'}">${isActive ? 'Activo' : 'Suspendido'}</span>
          </td>
          <td class="um-td-hide-sm" style="color:var(--gray-500);font-size:.8rem;white-space:nowrap">${lastLogin}</td>
          <td>
            <div class="um-actions">
              <button class="um-act-btn um-act-btn--edit" title="Editar" onclick="usersOpenEditUser('${u.id}')">
                <i class="material-icons">edit</i>
              </button>
              ${isActive
                ? `<button class="um-act-btn um-act-btn--suspend" title="Suspender" onclick="usersToggleStatus('${u.id}',false)"><i class="material-icons">block</i></button>`
                : `<button class="um-act-btn um-act-btn--activate" title="Activar" onclick="usersToggleStatus('${u.id}',true)"><i class="material-icons">check_circle</i></button>`
            }
            </div>
          </td>
        </tr>`;
    }).join('');
}


// ── Render Roles ──────────────────────────────────────────────────────────────
function _umRenderRoles() {
    const roles = _umRoles();
    const grid = document.getElementById('umRolesGrid');
    const empty = document.getElementById('umRolesEmpty');
    const countEl = document.getElementById('umCountRoles');
    if (countEl) countEl.textContent = roles.length;
    if (!grid) return;
    if (!roles.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'flex'; return; }
    if (empty) empty.style.display = 'none';

    // Contar usuarios por rol (aproximado por string del role field)
    function countByRole(roleName) {
        return _umCachedUsers.filter(u => (u.role || '').toLowerCase().includes(roleName.toLowerCase())).length;
    }

    grid.innerHTML = roles.map((role, idx) => {
        const palette = ROLE_PALETTES[idx % ROLE_PALETTES.length];
        const userCnt = countByRole(role.name);
        const modBadges = UM_MODULES.map(m => {
            const on = role.modules.includes(m.id);
            return `<span class="um-role-mod ${on ? 'on' : 'off'}">
              <i class="material-icons">${m.icon}</i>${m.label}
            </span>`;
        }).join('');
        return `<div class="um-role-card" style="border-color:${palette.border}">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${palette.bar};border-radius:20px 20px 0 0"></div>
          <div class="um-role-card-head">
            <div class="um-role-card-info">
              <div class="um-role-icon" style="background:${palette.bg}">
                <i class="material-icons" style="color:${palette.icon}">admin_panel_settings</i>
              </div>
              <div>
                <div class="um-role-name" style="color:${palette.name}">${_umEsc(role.name)}</div>
                <div class="um-role-desc">${_umEsc(role.desc || '')}</div>
              </div>
            </div>
          </div>
          <div class="um-role-users">
            <i class="material-icons">people</i>
            ${userCnt} usuario${userCnt !== 1 ? 's' : ''} asignado${userCnt !== 1 ? 's' : ''}
          </div>
          <div class="um-role-modules-title">Módulos (${role.modules.length}/${UM_MODULES.length})</div>
          <div class="um-role-modules">${modBadges}</div>
          <div class="um-role-card-actions">
            <button class="um-act-btn um-act-btn--edit" style="flex:1;justify-content:center" onclick="usersOpenEditRole('${role.id}')">
              <i class="material-icons">edit</i> Editar
            </button>
            <button class="um-act-btn um-act-btn--delete" onclick="usersConfirmDelete('role','${role.id}','${_umEsc(role.name)}')">
              <i class="material-icons">delete</i>
            </button>
          </div>
        </div>`;
    }).join('');
}

// ── Populate selects ──────────────────────────────────────────────────────────
function _umPopulateRoleFilter() {
    const roles = _umRoles();
    const fsel = document.getElementById('umRoleFilter');
    const usel = document.getElementById('umUserRole');
    // Para el filtro de la tabla usamos los roles únicos del campo `role` de la API
    const apiRoles = [...new Set(_umCachedUsers.map(u => u.role).filter(Boolean))];
    if (fsel) {
        fsel.innerHTML = '<option value="">Todos los roles</option>' +
            apiRoles.map(r => `<option value="${_umEsc(r)}">${_umEsc(r)}</option>`).join('');
    }
    if (usel) {
        const roleMap = [
            { value: 'admin', label: 'Administrador' },
            { value: 'user', label: 'Usuario' },
            { value: 'editor', label: 'Editor' },
            { value: 'viewer', label: 'Monitor DAI' },
        ];
        usel.innerHTML = roleMap.map(r => `<option value="${r.value}">${_umEsc(r.label)}</option>`).join('');
    }
}

// ── Filter & Search ───────────────────────────────────────────────────────────
window.usersFilterByRole = function (roleId) {
    _umFilterRole = roleId;
    _umRenderUsers();
};
window.usersSearch = function (q) {
    _umFilterSearch = q;
    _umRenderUsers();
};

// ── Modal helpers ─────────────────────────────────────────────────────────────
window.usersCloseModal = function (id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); };
function _umOpenModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }

// ── Password toggle ───────────────────────────────────────────────────────────
window.usersTogglePass = function () {
    const inp = document.getElementById('umUserPassword');
    const ico = document.getElementById('umEyeIcon');
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    if (ico) ico.textContent = show ? 'visibility_off' : 'visibility';
};

// ── Create / Edit User ────────────────────────────────────────────────────────
window.usersOpenCreateUser = function () {
    _umPopulateRoleFilter();
    ['umUserId', 'umUserName', 'umUserEmail', 'umUserPassword'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    document.getElementById('umUserPassword').type = 'password';
    document.getElementById('umEyeIcon').textContent = 'visibility';
    document.getElementById('umUserActive').checked = true;
    document.getElementById('umUserActiveLabel').textContent = 'Activo';
    document.getElementById('umModalUserTitle').textContent = 'Nuevo Usuario';
    document.getElementById('umModalUserSub').textContent = 'Completa los datos para crear el usuario';
    document.getElementById('umUserSaveLbl').textContent = 'Crear Usuario';
    document.getElementById('umPassHint').style.display = 'none';
    document.getElementById('umPassReq').style.display = 'inline';
    _umOpenModal('umModalUser');
};

window.usersOpenEditUser = function (userId) {
    const user = _umCachedUsers.find(u => String(u.id) === String(userId));
    if (!user) return;
    _umPopulateRoleFilter();
    document.getElementById('umUserId').value = user.id;
    document.getElementById('umUserName').value = user.name || '';
    document.getElementById('umUserEmail').value = user.email || '';
    document.getElementById('umUserPassword').value = '';
    document.getElementById('umUserPassword').type = 'password';
    document.getElementById('umEyeIcon').textContent = 'visibility';
    document.getElementById('umUserActive').checked = user.is_active !== false;
    document.getElementById('umUserActiveLabel').textContent = user.is_active !== false ? 'Activo' : 'Suspendido';
    document.getElementById('umModalUserTitle').textContent = 'Editar Usuario';
    document.getElementById('umModalUserSub').textContent = `Modificando datos de ${user.name}`;
    document.getElementById('umUserSaveLbl').textContent = 'Guardar Cambios';
    document.getElementById('umPassHint').style.display = 'block';
    document.getElementById('umPassReq').style.display = 'none';
    const sel = document.getElementById('umUserRole');
    if (sel && user.role) {
        const opt = [...sel.options].find(o => o.value.toLowerCase() === user.role.toLowerCase());
        if (opt) opt.selected = true;
    }
    _umOpenModal('umModalUser');
};

document.addEventListener('DOMContentLoaded', () => {
    const chk = document.getElementById('umUserActive');
    const lbl = document.getElementById('umUserActiveLabel');
    if (chk && lbl) chk.addEventListener('change', () => { lbl.textContent = chk.checked ? 'Activo' : 'Suspendido'; });
});

// ── Save User (crea o edita vía API) ──────────────────────────────────────────
window.usersSaveUser = async function () {
    const id = document.getElementById('umUserId').value.trim();
    const name = document.getElementById('umUserName').value.trim();
    const email = document.getElementById('umUserEmail').value.trim();
    const pass = document.getElementById('umUserPassword').value;
    const active = document.getElementById('umUserActive').checked;
    const role = document.getElementById('umUserRole').value;

    if (!name || !email) { _umToast('Completa los campos obligatorios', 'error'); return; }
    if (!id && !pass) { _umToast('La contraseña es obligatoria para nuevos usuarios', 'error'); return; }
    if (pass && pass.length < 8) { _umToast('Contraseña mínimo 8 caracteres', 'error'); return; }

    const saveBtn = document.getElementById('umUserSaveLbl');
    const origText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) saveBtn.textContent = 'Guardando...';

    try {
        const body = { name, role, is_active: active };
        let response;

        if (id) {
            // Editar usuario existente
            if (pass) body.password = pass;
            response = await apiRequest('/users/' + id, {
                method: 'PUT',
                body: JSON.stringify(body)
            });
        } else {
            // Crear nuevo usuario
            body.email = email;
            body.password = pass;
            response = await apiRequest('/users', {
                method: 'POST',
                body: JSON.stringify(body)
            });
        }

        if (!response || !response.ok) {
            const errData = response ? await response.json().catch(() => ({})) : {};
            _umToast(errData.error || 'Error al guardar el usuario', 'error');
            return;
        }

        _umToast(id ? `Cambios guardados para "${name}"` : `Usuario "${name}" creado exitosamente`, 'success');
        usersCloseModal('umModalUser');
        await loadUsers();
    } catch (e) {
        console.error('Error guardando usuario:', e);
        _umToast('Error de conexión al guardar usuario', 'error');
    } finally {
        if (saveBtn) saveBtn.textContent = origText;
    }
};

// ── Toggle status ─────────────────────────────────────────────────────────────
window.usersToggleStatus = async function (userId, activate) {
    const u = _umCachedUsers.find(x => String(x.id) === String(userId));
    if (!u) return;
    _umToast(`${u.name} ${activate ? 'activado' : 'suspendido'}`, activate ? 'success' : 'warn');
    // Actualizar localmente mientras la API no tiene endpoint de PATCH
    u.is_active = activate;
    _umRenderUsers();
};

// ── Create / Edit Role ────────────────────────────────────────────────────────
window.usersOpenCreateRole = function () {
    document.getElementById('umRoleId').value = '';
    document.getElementById('umRoleName').value = '';
    document.getElementById('umRoleDesc').value = '';
    document.getElementById('umModalRoleTitle').textContent = 'Nuevo Rol';
    document.getElementById('umModalRoleSub').textContent = 'Define qué módulos puede acceder este rol';
    document.getElementById('umRoleSaveLbl').textContent = 'Crear Rol';
    _umBuildModulesGrid([]);
    _umOpenModal('umModalRole');
};

window.usersOpenEditRole = function (roleId) {
    const role = _umRoleById(roleId);
    if (!role) return;
    document.getElementById('umRoleId').value = role.id;
    document.getElementById('umRoleName').value = role.name;
    document.getElementById('umRoleDesc').value = role.desc || '';
    document.getElementById('umModalRoleTitle').textContent = 'Editar Rol';
    document.getElementById('umModalRoleSub').textContent = `Modificando permisos de "${role.name}"`;
    document.getElementById('umRoleSaveLbl').textContent = 'Guardar Cambios';
    _umBuildModulesGrid(role.modules || []);
    _umOpenModal('umModalRole');
};

function _umBuildModulesGrid(checked) {
    const grid = document.getElementById('umModulesGrid');
    if (!grid) return;
    grid.innerHTML = UM_MODULES.map(m => {
        const on = checked.includes(m.id);
        return `<div class="um-mod-check ${on ? 'checked' : ''}" data-mod="${m.id}" onclick="_umToggleMod(this)">
          <div class="um-mod-check-box"></div>
          <div class="um-mod-check-label"><i class="material-icons">${m.icon}</i>${m.label}</div>
        </div>`;
    }).join('');
}
window._umToggleMod = function (el) { el.classList.toggle('checked'); };

window.usersSaveRole = function () {
    const id = document.getElementById('umRoleId').value.trim();
    const name = document.getElementById('umRoleName').value.trim();
    const desc = document.getElementById('umRoleDesc').value.trim();
    const mods = Array.from(document.querySelectorAll('#umModulesGrid .um-mod-check.checked')).map(el => el.dataset.mod).filter(Boolean);
    if (!name) { _umToast('Nombre del rol obligatorio', 'error'); return; }
    if (!mods.length) { _umToast('Selecciona al menos un módulo', 'error'); return; }
    let roles = _umRoles();
    if (id) { roles = roles.map(r => r.id === id ? { ...r, name, desc, modules: mods } : r); _umToast(`Rol "${name}" actualizado`, 'success'); }
    else { roles.push({ id: _umId(), name, desc, modules: mods }); _umToast(`Rol "${name}" creado`, 'success'); }
    _umSaveRoles(roles);
    usersCloseModal('umModalRole');
    _umRenderRoles();
    _umPopulateRoleFilter();
    const c = document.getElementById('umCountRoles'); if (c) c.textContent = roles.length;
};

// ── Delete Confirm ────────────────────────────────────────────────────────────
window.usersConfirmDelete = function (type, id, name) {
    document.getElementById('umConfirmTitle').textContent = `¿Eliminar ${type === 'user' ? 'usuario' : 'rol'}?`;
    document.getElementById('umConfirmMsg').textContent = `Se eliminará "${name}". Esta acción no se puede deshacer.`;
    const btn = document.getElementById('umConfirmBtn');
    btn.onclick = () => {
        if (type === 'role') {
            _umSaveRoles(_umRoles().filter(r => r.id !== id));
            _umToast('Rol eliminado', 'warn');
            _umRenderRoles(); _umPopulateRoleFilter();
        }
        usersCloseModal('umModalConfirm');
    };
    _umOpenModal('umModalConfirm');
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function _umToast(msg, type) {
    const c = { success: '#22c55e', error: '#ef4444', warn: '#f59e0b' }[type] || '#22c55e';
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:#1e293b;color:#fff;
        padding:14px 20px;border-radius:14px;font-size:.85rem;font-weight:600;
        display:flex;align-items:center;gap:10px;box-shadow:0 10px 40px rgba(0,0,0,.3);
        border-left:4px solid ${c};font-family:var(--font);animation:umSlideUp .25s ease;max-width:340px;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}
