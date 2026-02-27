// Variables globales para documentos dinámicos
let allDocuments = [];
let filteredDocuments = [];
let currentPage = 1;
const itemsPerPage = 10;


// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    loadDocuments(); // Cargar documentos desde API
    // Establecer fecha actual en el campo "Hasta"
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').value = today;
});

// Función para cargar documentos desde la API
async function loadDocuments() {
    try {
        const response = await fetch('/api/reports/public?limit=1000'); // Cargar todos los documentos
        const data = await response.json();

        if (data.reports) {
            allDocuments = data.reports.map(report => ({
                id: report.id,
                icon: getIconForMimeType(report.mimeType),
                title: report.title,
                description: report.description || 'Sin descripción disponible',
                date: new Date(report.createdAt).toISOString().split('T')[0],
                downloads: report.downloadCount,
                size: formatFileSize(report.fileSize),
                badge: report.isFeatured ? 'new' : null,
                mimeType: report.mimeType,
                downloadUrl: report.downloadUrl
            }));

            filteredDocuments = [...allDocuments];
            renderDocuments();
            updateStats(data);
        }
    } catch (error) {
        console.error('Error al cargar documentos:', error);
        // Fallback a datos simulados si falla la API
        loadFallbackDocuments();
    }
}

// Función para obtener icono según tipo MIME
function getIconForMimeType(mimeType) {
    if (mimeType === 'application/pdf') return 'description';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('text/')) return 'article';
    return 'insert_drive_file';
}

// Función para formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
        return Math.round(bytes / 1024) + ' KB';
    }
}

// Función fallback con datos simulados
function loadFallbackDocuments() {
    allDocuments = [
    {
        id: 1,
        icon: 'description',
        title: 'Informe Mensual de Tráfico',
        description: 'Análisis detallado del comportamiento vehicular en las vías nacionales',
        date: '2025-10-08',
        downloads: 2847,
        size: '2.5 MB',
        badge: 'new'
    },
    {
        id: 2,
        icon: 'analytics',
        title: 'Estadísticas de Seguridad Vial',
        description: 'Reporte de incidentes y métricas de seguridad en corredores viales',
        date: '2025-10-05',
        downloads: 1923,
        size: '1.8 MB',
        badge: 'new'
    },
    {
        id: 3,
        icon: 'memory',
        title: 'Estado de Dispositivos ITS',
        description: 'Informe técnico del funcionamiento de los equipos de monitoreo',
        date: '2025-10-03',
        downloads: 3456,
        size: '3.2 MB',
        badge: null
    },
    {
        id: 4,
        icon: 'route',
        title: 'Análisis de Rutas Nacionales',
        description: 'Evaluación de las principales rutas y corredores viales del país',
        date: '2025-10-01',
        downloads: 1567,
        size: '4.1 MB',
        badge: null
    },
    {
        id: 5,
        icon: 'show_chart',
        title: 'Indicadores de Movilidad',
        description: 'Métricas clave sobre movilidad y flujo vehicular en tiempo real',
        date: '2025-09-28',
        downloads: 2134,
        size: '2.9 MB',
        badge: null
    },
    {
        id: 6,
        icon: 'assessment',
        title: 'Reporte de Mantenimiento Vial',
        description: 'Estado de mantenimiento de la infraestructura vial nacional',
        date: '2025-09-25',
        downloads: 1789,
        size: '3.7 MB',
        badge: null
    },
    {
        id: 7,
        icon: 'traffic',
        title: 'Estudio de Flujo Vehicular',
        description: 'Análisis de patrones de tráfico en horas pico',
        date: '2025-09-20',
        downloads: 2456,
        size: '3.1 MB',
        badge: null
    },
    {
        id: 8,
        icon: 'warning',
        title: 'Reporte de Incidentes Viales',
        description: 'Documentación de eventos y accidentes en carreteras',
        date: '2025-09-15',
        downloads: 1876,
        size: '2.2 MB',
        badge: null
    },
    {
        id: 9,
        icon: 'speed',
        title: 'Control de Velocidades',
        description: 'Estadísticas de velocidad promedio por sector',
        date: '2025-09-10',
        downloads: 3124,
        size: '1.9 MB',
        badge: null
    },
    {
        id: 10,
        icon: 'local_shipping',
        title: 'Informe de Carga Pesada',
        description: 'Análisis del tráfico de vehículos de carga',
        date: '2025-09-05',
        downloads: 2567,
        size: '3.8 MB',
        badge: null
    },
    {
        id: 11,
        icon: 'map',
        title: 'Cartografía Vial Actualizada',
        description: 'Mapas actualizados de la red vial nacional',
        date: '2025-08-30',
        downloads: 4123,
        size: '5.2 MB',
        badge: null
    },
    {
        id: 12,
        icon: 'timeline',
        title: 'Tendencias de Tráfico 2025',
        description: 'Análisis de tendencias y proyecciones',
        date: '2025-08-25',
        downloads: 3456,
        size: '2.7 MB',
        badge: null
    },
    {
        id: 13,
        icon: 'construction',
        title: 'Estado de Obras Viales',
        description: 'Informe sobre obras en curso y planificadas',
        date: '2025-08-20',
        downloads: 1892,
        size: '3.3 MB',
        badge: null
    },
    {
        id: 14,
        icon: 'eco',
        title: 'Impacto Ambiental Vial',
        description: 'Evaluación del impacto ambiental de la red vial',
        date: '2025-08-15',
        downloads: 2134,
        size: '2.6 MB',
        badge: null
    },
    {
        id: 15,
        icon: 'groups',
        title: 'Encuesta de Satisfacción',
        description: 'Resultados de encuestas a usuarios de carreteras',
        date: '2025-08-10',
        downloads: 1654,
        size: '1.5 MB',
        badge: null
    }
];
}

// Función para renderizar documentos
function renderDocuments() {
    const tbody = document.getElementById('documentsBody');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredDocuments.length === 0) {
        tbody.innerHTML = window.safeHTML('');
        emptyState.style.display = 'block';
        document.getElementById('pagination').style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    document.getElementById('pagination').style.display = 'flex';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageDocuments = filteredDocuments.slice(startIndex, endIndex);
    
    tbody.innerHTML = window.safeHTML(pageDocuments.map(doc => `
        <tr>
            <td>
                <div class="doc-icon">
                    <i class="material-icons">${doc.icon}</i>
                </div>
            </td>
            <td>
                <div class="doc-title">${doc.title}</div>
                <div class="doc-description">${doc.description}</div>
                ${doc.badge ? `<span class="badge badge-${doc.badge}">${doc.badge === 'new' ? 'NUEVO' : 'ACTUALIZADO'}</span>` : ''}
            </td>
            <td class="hide-mobile">${formatDate(doc.date)}</td>
            <td class="hide-mobile">
                <div class="download-counter">
                    <i class="material-icons" style="font-size: 16px;">download</i>
                    ${doc.downloads.toLocaleString('es-CO')}
                </div>
            </td>
            <td>${doc.size}</td>
            <td>
                <button class="action-btn" onclick="downloadDoc('${doc.id}')" title="Descargar">
                    <i class="material-icons">download</i>
                </button>
            </td>
        </tr>
    `).join(''));
    
    renderPagination();
}

// Función para formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-CO', options);
}

// Función de filtrado
function filterDocuments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    filteredDocuments = allDocuments.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchTerm) || 
                            doc.description.toLowerCase().includes(searchTerm);
        
        let matchesDate = true;
        if (dateFrom && doc.date < dateFrom) matchesDate = false;
        if (dateTo && doc.date > dateTo) matchesDate = false;
        
        return matchesSearch && matchesDate;
    });
    
    currentPage = 1;
    renderDocuments();
    updateStats();
}

// Función para resetear filtros
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    filteredDocuments = [...allDocuments];
    currentPage = 1;
    renderDocuments();
    updateStats();
}

// Función para renderizar paginación
function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = window.safeHTML('');
        return;
    }
    
    let html = `
        <button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="material-icons">chevron_left</i>
        </button>
    `;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span style="padding: 0 0.5rem;">...</span>`;
        }
    }
    
    html += `
        <button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="material-icons">chevron_right</i>
        </button>
    `;
    
    pagination.innerHTML = window.safeHTML(html);
}

// Función para cambiar página
function changePage(page) {
    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderDocuments();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Función para actualizar estadísticas
function updateStats(apiData = null) {
    if (apiData) {
        // Usar datos de la API
        document.getElementById('totalDocuments').textContent = apiData.total;
        document.getElementById('totalDownloads').textContent =
            apiData.totalDownloads > 1000 ? (apiData.totalDownloads / 1000).toFixed(1) + 'K' : apiData.totalDownloads;
        document.getElementById('thisMonth').textContent = apiData.thisMonth;
        document.getElementById('avgSize').textContent = apiData.avgSize;
    } else {
        // Fallback a cálculo local
        document.getElementById('totalDocuments').textContent = filteredDocuments.length;

        const totalDownloads = filteredDocuments.reduce((sum, doc) => sum + doc.downloads, 0);
        document.getElementById('totalDownloads').textContent =
            totalDownloads > 1000 ? (totalDownloads / 1000).toFixed(1) + 'K' : totalDownloads;
    }
}

// Función para descargar documento
function downloadDoc(id) {
    console.log('Iniciando descarga para ID:', id);
    console.log('Documentos disponibles:', allDocuments.length);

    const doc = allDocuments.find(d => d.id === id);
    console.log('Documento encontrado:', doc);

    if (!doc) {
        console.error('Documento no encontrado con ID:', id);
        alert('Documento no encontrado. Por favor, recargue la página.');
        return;
    }

    console.log('URL de descarga:', doc.downloadUrl);

    // Abrir directamente en nueva ventana/pestaña para descarga
    window.open(doc.downloadUrl, '_blank');

    // Incrementar contador visualmente
    doc.downloads++;
    renderDocuments();
    updateStats();

    console.log('Descarga iniciada:', doc.title);
}

// Función para toggle del menú móvil
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const toggle = document.querySelector('.navbar-toggle');
    const isActive = menu.classList.toggle('active');

    // Actualizar ARIA
    toggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    menu.setAttribute('aria-hidden', !isActive);
    toggle.querySelector('.material-icons').textContent = isActive ? 'close' : 'menu';

    // Prevenir scroll cuando el menú está abierto
    document.body.style.overflow = isActive ? 'hidden' : '';

    // Focus management
    if (isActive) {
        // Focus first menu item
        const firstMenuItem = menu.querySelector('.mobile-menu-link');
        if (firstMenuItem) firstMenuItem.focus();
    } else {
        // Return focus to toggle button
        toggle.focus();
    }
}