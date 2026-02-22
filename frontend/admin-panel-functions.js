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
    try {
        const response = await apiRequest('/stats/dashboard');
        if (response && response.ok) {
            const data = await response.json();
            updateStatsDisplay(data);
        }
    } catch (error) {
        // Mantener valores por defecto del HTML si falla
        console.warn('Dashboard stats no disponibles:', error.message);
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
                else if (section === 'audit') loadAuditLogs();
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
