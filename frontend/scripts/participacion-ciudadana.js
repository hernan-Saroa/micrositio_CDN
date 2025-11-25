let currentStep = 1;
let selectedDevices = [];
let generatedCode = '';
let countdownTimer = null;
let remainingSeconds = 300;
let codeSent = false;
let userInfo = {};
let isLoggedIn = false;
let departmentList = {};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const deviceCards = document.querySelectorAll('.device-card');
    deviceCards.forEach(card => {
        card.addEventListener('click', function(event) {
            if (event.target.type === 'checkbox') {
                event.preventDefault();
            }
            const deviceId = this.getAttribute('data-device');
            toggleDevice(this, deviceId);
        });
    });

    // Add event listeners for buttons
    document.getElementById('btnBack').addEventListener('click', previousStep);
    document.getElementById('btnNext').addEventListener('click', nextStep);

    // Add event listener for department select
    document.getElementById('department').addEventListener('change', updateSectors);

    // Add event listener for user profile trigger
    const userProfileTrigger = document.getElementById('userProfileTrigger');
    if (userProfileTrigger) {
        userProfileTrigger.addEventListener('click', toggleUserDropdown);
    }

    // Add event listener for history link
    const historyLink = document.getElementById('historyLink');
    if (historyLink) {
        historyLink.addEventListener('click', function() {
            scrollToHistory();
            toggleUserDropdown(); // Close dropdown after clicking
        });
    }

    // Add event listener for logout link
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', function() {
            logout();
            toggleUserDropdown(); // Close dropdown after clicking
        });
    }

    // Add event listeners for modal buttons
    const closeModalBtn = document.querySelector('.modal-header button');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', close2FAModal);
    }

    document.getElementById('btnAction').addEventListener('click', handleModalAction);
    document.getElementById('resendCodeLink').addEventListener('click', resendCode);

    // Add event listener for success modal close button
    const successModalBtn = document.querySelector('#successModal button');
    if (successModalBtn) {
        successModalBtn.addEventListener('click', closeSuccessModal);
    }
});

// Verificar sesión al cargar
window.onload = function() {
    checkSession();
    initializeDates();
    loadDepartments();
};

function initializeDates() {
    const today = new Date();
    today.setDate(today.getDate() - 1);
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(today.getDate() - 7);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const todayStr = formatDateToInput(today);
    const eightDaysAgoStr = formatDateToInput(eightDaysAgo);

    console.log(todayStr, eightDaysAgoStr);

    document.getElementById('endDate').value = todayStr;
    document.getElementById('endDate').max = todayStr;
    document.getElementById('startDate').value = eightDaysAgoStr;
    document.getElementById('startDate').max = todayStr;
}

function formatDateToInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Verificar si hay sesión activa
function checkSession() {
    const session = localStorage.getItem('viits_session');
    if (session) {
        const sessionData = JSON.parse(session);
        // Verificar si la sesión no ha expirado (24 horas)
        const sessionTime = new Date(sessionData.timestamp);
        const now = new Date();
        const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
            isLoggedIn = true;
            userInfo = sessionData.user;
            showUserProfile();
            loadDownloadHistory();
        } else {
            // Sesión expirada
            logout();
        }
    }
}

// Mostrar perfil de usuario
function showUserProfile() {
    document.getElementById('notLoggedInfo').style.display = 'none';
    document.getElementById('userProfile').classList.add('active');
    document.getElementById('welcomeMessage').classList.add('active');
    document.getElementById('historySection').style.display = 'block';
    
    // Obtener iniciales
    const initials = userInfo.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = userInfo.name.split(' ')[0];
    document.getElementById('userEntity').textContent = userInfo.entity;
    document.getElementById('dropdownUserName').textContent = userInfo.name;
    document.getElementById('userEmail').textContent = userInfo.email;
}

// Toggle dropdown
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    const trigger = document.querySelector('.user-profile-trigger');
    const isActive = dropdown.classList.contains('active');

    // Close any other open dropdowns first
    document.querySelectorAll('.user-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('active');
    });
    document.querySelectorAll('.user-profile-trigger').forEach(t => {
        if (t !== trigger) t.classList.remove('open');
    });

    // Toggle current dropdown
    if (isActive) {
        dropdown.classList.remove('active');
        trigger.classList.remove('open');
    } else {
        dropdown.classList.add('active');
        trigger.classList.add('open');
    }
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', function(event) {
    const userProfile = document.getElementById('userProfile');
    const dropdown = document.getElementById('userDropdown');
    const trigger = document.querySelector('.user-profile-trigger');

    if (!userProfile.contains(event.target) && dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        if (trigger) trigger.classList.remove('open');
    }
});

// Scroll al historial
function scrollToHistory() {
    document.getElementById('historySection').scrollIntoView({ behavior: 'smooth' });
    toggleUserDropdown();
}

// Cerrar sesión
function logout() {
    // Detener polling antes de cerrar sesión
    stopStatusPolling();
    showLogoutConfirmModal();
}

// Mostrar modal de confirmación de logout
function showLogoutConfirmModal() {
    document.getElementById('logoutConfirmModal').classList.add('active');
}

// Cerrar modal de confirmación de logout
function closeLogoutConfirmModal() {
    document.getElementById('logoutConfirmModal').classList.remove('active');
}

// Confirmar logout
function confirmLogout() {
    closeLogoutConfirmModal();

    // Limpiar datos de sesión
    localStorage.removeItem('viits_session');
    isLoggedIn = false;
    userInfo = {};
    selectedDevices = [];

    // Resetear interfaz de usuario
    document.getElementById('notLoggedInfo').style.display = 'flex';
    document.getElementById('userProfile').classList.remove('active');
    document.getElementById('welcomeMessage').classList.remove('active');
    document.getElementById('historySection').style.display = 'none';

    // Limpiar selecciones de dispositivos
    const deviceCards = document.querySelectorAll('.device-card');
    deviceCards.forEach(card => {
        card.classList.remove('selected');
        const checkbox = card.querySelector('.device-checkbox');
        if (checkbox) checkbox.checked = false;
    });

    // Reset al paso 1
    currentStep = 1;
    updateStepDisplay();

    // Limpiar filtros
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('department').value = '';
    document.getElementById('sector').value = '';
    document.getElementById('sector').disabled = true;
    document.getElementById('dataType').value = 'all';
    document.getElementById('termsAccept').checked = false;

    // Limpiar resumen
    document.getElementById('summaryDevices').textContent = 'Ninguno seleccionado';
    document.getElementById('summaryDates').textContent = 'No especificado';
    document.getElementById('summaryDays').textContent = 'No especificado';
    document.getElementById('summaryDepartment').textContent = 'Todos los departamentos';
    document.getElementById('summarySector').textContent = 'Todos los sectores';
    document.getElementById('summaryDataType').textContent = 'Todos los datos disponibles';

    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Mostrar modal de éxito
    showLogoutSuccessModal();
}

// Variable global para controlar el polling
let statusCheckInterval = null;
let currentPage = 1;
let totalPages = 1;

// Cargar historial de descargas
async function loadDownloadHistory(page = 1) {
    const historyList = document.getElementById('historyList');
    const historyListCount = document.getElementById('historyListCount');
    currentPage = page;

    try {
        const response = await fetch(`/api/downloads?page=${page}&limit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${JSON.parse(localStorage.getItem('viits_session')).token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar historial de descargas');
        }

        const data = await response.json();
        const downloads = data.downloads;
        const pagination = data.pagination;
        totalPages = pagination.total_pages;
        historyListCount.textContent = `Total registros: ${pagination.total}`;

        if (downloads.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="material-icons">folder_open</i>
                    <p>No tienes descargas previas</p>
                </div>
            `;
            return;
        }

        // Verificar si hay descargas en procesamiento
        const hasProcessingDownloads = downloads.some(d => d.status === 'processing' || d.status === 'pending');

        // Iniciar o detener polling según sea necesario
        if (hasProcessingDownloads && !statusCheckInterval) {
            startStatusPolling();
        } else if (!hasProcessingDownloads && statusCheckInterval) {
            stopStatusPolling();
        }

        // Generar tabla de historial
        const tableRows = downloads
            .map((download, index) => {
                const date = new Date(download.created_at);
                const status = download.status;
                let statusText = '';
                let statusClass = '';

                switch (status) {
                    case 'completed':
                        statusText = 'Completado';
                        statusClass = 'completado';
                        break;
                    case 'processing':
                        statusText = 'Procesando...';
                        statusClass = 'procesando';
                        break;
                    case 'pending':
                        statusText = 'Pendiente';
                        statusClass = 'procesando';
                        break;
                    case 'failed':
                        statusText = 'Fallido';
                        statusClass = 'fallido';
                        break;
                    default:
                        statusText = 'Desconocido';
                        statusClass = 'procesando';
                }

                // Formatear fecha de solicitud
                const fechaSolicitud = date.toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }) + ' ' + date.toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Obtener tamaño (simulado por ahora, en producción vendría de la BD)
                const tamano = download.completed_at ? download.file_size_formatted : '-';

                return `
                    <tr>
                        <td>${(index + 1) + ((currentPage-1)*10)}</td>
                        <td>${fechaSolicitud}</td>
                        <td>${download.filters.deviceType}</td>
                        <td>${download.filters.department == 'all' ? 'Todos' : download.filters.department}</td>
                        <td>${download.filters.sector == 'all' ? 'Todos' : download.filters.sector}</td>
                        <td>${download.filters.dateRange}</td>
                        <td>${tamano}</td>
                        <td>
                            ${status === 'completed'
                                ? `<span class="table-status ${statusClass}">${statusText}</span>`
                                : status === 'processing'
                                ? `
                                    <div class="table-action-progress">
                                        <span class="table-status ${statusClass}">${statusText}</span>
                                        <div class="progress-bar-small">
                                            <div class="progress-bar-small-fill progress-animated" id="progress-${download.id}"></div>
                                        </div>
                                    </div>
                                `
                                : `<span class="table-status ${statusClass}">${statusText}</span>`
                            }
                        </td>
                        <td>
                            ${status === 'completed'
                                ? `<button class="table-action-btn" onclick="downloadFile('${download.id}')" title="Descargar archivo">
                                    <i class="material-icons">download</i>
                                </button>`
                                : '<span style="color: #9ca3af; font-size: 0.75rem;">-</span>'
                            }
                        </td>
                    </tr>
                `;
            })
            .join('');

        // Generar controles de paginación
        const paginationControls = generatePaginationControls(pagination);

        historyList.innerHTML = `
            <div class="history-table">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>FECHA SOLICITUD</th>
                            <th>TIPO DE DISPOSITIVO</th>
                            <th>DEPARTAMENTO</th>
                            <th>SECTOR</th>
                            <th>RANGO DE FECHAS</th>
                            <th>TAMAÑO</th>
                            <th>ESTADO</th>
                            <th>ACCIONES</th>
                        </tr>
                    </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            ${paginationControls}
        </div>
    `;
    } catch (error) {
        console.error('Error cargando historial:', error);
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="material-icons">error</i>
                <p>Error al cargar el historial de descargas</p>
            </div>
        `;
    }
}

// Iniciar polling de estado cada 30 segundos
function startStatusPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }

    statusCheckInterval = setInterval(async () => {
        try {
            await loadDownloadHistory();
        } catch (error) {
            console.error('Error en polling de estado:', error);
        }
    }, 5000); // 5 segundos

    console.log('Polling de estado de descargas iniciado');
}

// Detener polling de estado
function stopStatusPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        console.log('Polling de estado de descargas detenido');
    }
}

async function downloadFile(downloadId) {
    try {
        // Mostrar indicador de carga
        const downloadBtn = document.querySelector(`button[onclick="downloadFile('${downloadId}')"]`);
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<i class="material-icons">hourglass_empty</i>';
        }

        // Verificar estado de la descarga primero
        const statusResponse = await fetch(`/api/downloads/${downloadId}/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${JSON.parse(localStorage.getItem('viits_session')).token}`
            }
        });

        if (statusResponse.ok) {
            const download = await statusResponse.json();
            // const download = downloads.find(d => d.id === downloadId);

            if (download && download.status === 'completed') {
                // Descargar archivo si está completado
                const response = await fetch(`/api/downloads/${downloadId}/download`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('viits_session')).token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al descargar el archivo');
                }

                // Crear blob y descargar
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;

                // Obtener nombre del archivo desde headers
                const contentDisposition = response.headers.get('Content-Disposition');
                let fileName = `datos_trafico_${downloadId}.csv`;
                if (contentDisposition) {
                    const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (fileNameMatch) {
                        fileName = fileNameMatch[1];
                    }
                }

                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                // Recargar historial para actualizar estado
                // loadDownloadHistory();

            } else if (download && download.status === 'processing') {
                alert('El archivo aún se está procesando. Por favor espere unos minutos e intente nuevamente.');
            } else if (download && download.status === 'failed') {
                alert('Error al generar el archivo. Por favor contacte al administrador.');
            } else {
                alert('Estado de descarga desconocido. Por favor recargue la página.');
            }
        } else {
            throw new Error('Error al verificar estado de descarga');
        }

    } catch (error) {
        console.error('Error descargando archivo:', error);
        alert('Error al descargar el archivo: ' + error.message);
    } finally {
        // Restaurar botón
        const downloadBtn = document.querySelector(`button[onclick="downloadFile('${downloadId}')"]`);
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="material-icons">download</i>';
        }
    }
}

function onlyNumbers(event) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        event.preventDefault();
        return false;
    }
    return true;
}

function toggleDevice(card, deviceId) {
    const checkbox = card.querySelector('.device-checkbox');

    // Desmarcar todos los otros checkboxes
    document.querySelectorAll('.device-checkbox').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('.device-card').forEach(c => {
        c.classList.remove('selected');
    });

    // Marcar el checkbox actual
    checkbox.checked = true;
    card.classList.add('selected');

    // Actualizar el array de dispositivos seleccionados
    selectedDevices = [deviceId];
    console.log('Dispositivo seleccionado:', selectedDevices);

    // Recargar departamentos filtrados por el dispositivo seleccionado
    updateDepartmentSelect();
}

function validateDateRange() {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    const dateError = document.getElementById('dateError');
    
    if (startDate > endDate) {
        dateError.textContent = 'La fecha inicial no puede ser mayor que la fecha final';
        dateError.style.display = 'block';
        return false;
    }
    
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 7) {
        // dateError.textContent = 'El rango máximo permitido es de 90 días (3 meses)';
        dateError.textContent = 'El rango máximo permitido es de 7 días';
        dateError.style.display = 'block';
        return false;
    }
    
    dateError.style.display = 'none';
    return true;
}

async function loadDepartments() {
    try {
        const response = await fetch('/api/clickhouse/departamentos-sectores');
        const data = await response.json();

        if (data.success) {
            departmentList = data.data;
            updateDepartmentSelect();
            console.log(`Departamentos cargados: ${Object.keys(getFilteredDepartments(data.data)).length}`);
        } else {
            console.error('Error al cargar departamentos:', data);
        }
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
    }
}

function getFilteredDepartments(departamentosData) {
    // Si no hay dispositivo seleccionado, mostrar todos los departamentos
    // if (selectedDevices.length === 0) {
    //     const allDepartments = new Map();
    //     Object.keys(departamentosData).forEach(tipo => {
    //         Object.keys(departamentosData[tipo]).forEach(deptKey => {
    //             const dept = departamentosData[tipo][deptKey];
    //             if (!allDepartments.has(deptKey)) {
    //                 allDepartments.set(deptKey, dept.nombre);
    //             }
    //         });
    //     });
    //     return allDepartments;
    // }

    // Filtrar departamentos que tienen el tipo de dispositivo seleccionado
    const selectedTipo = selectedDevices[0]; // Solo uno seleccionado
    const filteredDepartments = new Map();
    console.log('Filtrando departamentos por:', selectedTipo);

    if (departamentosData[selectedTipo]) {
        Object.keys(departamentosData[selectedTipo]).forEach(deptKey => {
            const dept = departamentosData[selectedTipo][deptKey];
            filteredDepartments.set(deptKey, dept.nombre);
        });
    }

    return filteredDepartments;
}

function updateDepartmentSelect() {
    const departmentSelect = document.getElementById('department');
    const filteredDepartments = getFilteredDepartments(departmentList);

    departmentSelect.innerHTML = '<option value="">Todos los departamentos</option>';

    // Ordenar y agregar al select
    Array.from(filteredDepartments.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([key, nombre]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = nombre;
            departmentSelect.appendChild(option);
        });

    // Si hay un departamento seleccionado que ya no está disponible, resetear
    const currentValue = departmentSelect.value;
    console.log('Actualizando sectores:', currentValue);
    updateSectors(); // Resetear sectores también
}

function updateSectors() {
    const department = document.getElementById('department').value;
    const sectorSelect = document.getElementById('sector');

    sectorSelect.innerHTML = '<option value="">Todos los sectores</option>';

    if (department) {
        sectorSelect.disabled = false;
        // Cargar sectores dinámicamente desde el endpoint
        loadSectorsForDepartment(department);
    } else {
        sectorSelect.disabled = true;
    }
}

async function loadSectorsForDepartment(departmentKey) {
    try {
        // const response = await fetch('/api/clickhouse/departamentos-sectores');
        // const data = await response.json();

        // if (data.success) {
            const sectorSelect = document.getElementById('sector');
            const sectors = new Set();

            // Si hay un dispositivo seleccionado, filtrar sectores por ese tipo
            if (selectedDevices.length > 0) {
                const selectedTipo = selectedDevices[0];
                if (departmentList[selectedTipo] && departmentList[selectedTipo][departmentKey] && departmentList[selectedTipo][departmentKey].sectores) {
                    Object.keys(departmentList[selectedTipo][departmentKey].sectores).forEach(sector => {
                        sectors.add(sector);
                    });
                }
            } else {
                // Si no hay dispositivo seleccionado, mostrar todos los sectores del departamento
                Object.keys(departmentList).forEach(tipo => {
                    if (departmentList[tipo][departmentKey] && departmentList[tipo][departmentKey].sectores) {
                        Object.keys(departmentList[tipo][departmentKey].sectores).forEach(sector => {
                            sectors.add(sector);
                        });
                    }
                });
            }

            // Agregar sectores ordenados
            Array.from(sectors).sort().forEach(sector => {
                const option = document.createElement('option');
                option.value = sector;
                option.textContent = sector;
                sectorSelect.appendChild(option);
            });

            console.log(`Sectores cargados para ${departmentKey}: ${sectors.size}`);
        // }
    } catch (error) {
        console.error('Error al cargar sectores:', error);
    }
}

function nextStep() {
    if (currentStep === 1) {
        if (selectedDevices.length === 0) {
            openDeviceSelectionModal();
            return;
        }
    }
    
    if (currentStep === 2) {
        if (!validateDateRange()) {
            return;
        }
        updateSummary(); // Actualizar resumen cuando se pasa al paso 3
    }
    
    if (currentStep === 3) {
        if (!document.getElementById('termsAccept').checked) {
            openTermsModal();
            return;
        }
        updateSummary();

        // Si ya está logueado, procesar descarga directamente
        if (isLoggedIn) {
            processDownload();
        } else {
            open2FAModal();
        }
        return;
    }
    
    currentStep++;
    updateStepDisplay();
}

function previousStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepDisplay();
    }
}

function updateStepDisplay() {
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < currentStep) {
            step.classList.add('completed');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
        }
    });
    
    document.querySelectorAll('.step-content').forEach((content, index) => {
        content.classList.remove('active');
        if (index + 1 === currentStep) {
            content.classList.add('active');
        }
    });
    
    document.getElementById('btnBack').style.display = currentStep > 1 ? 'inline-flex' : 'none';
    document.getElementById('btnNext').innerHTML = currentStep === 3 
        ? 'Confirmar y Descargar <i class="material-icons">download</i>'
        : 'Siguiente <i class="material-icons">arrow_forward</i>';
}

function updateSummary() {
    const deviceNames = {
        'wim': 'WIM',
        'conteos-fijos': 'Conteos Fijos',
        'conteos-moviles': 'Conteos Móviles',
        'dai': 'DAI',
        'galibos': 'Galibos',
        'radares': 'Radares'
    };

    const selectedDeviceNames = selectedDevices.map(d => deviceNames[d]);
    document.getElementById('summaryDevices').textContent = selectedDeviceNames[0];

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    document.getElementById('summaryDates').textContent = startDate && endDate ? `${startDate} a ${endDate}` : 'No especificado';

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir el día final
        document.getElementById('summaryDays').textContent = `${days} días`;
    } else {
        document.getElementById('summaryDays').textContent = 'No especificado';
    }

    const dept = document.getElementById('department');
    document.getElementById('summaryDepartment').textContent =
        dept.value ? dept.options[dept.selectedIndex].text : 'Todos los departamentos';

    const sector = document.getElementById('sector');
    document.getElementById('summarySector').textContent =
        sector.value ? sector.options[sector.selectedIndex].text : 'Todos los sectores';

    // const dataType = document.getElementById('dataType');
    // document.getElementById('summaryDataType').textContent =
    //     dataType.value ? dataType.options[dataType.selectedIndex].text : 'Todos los datos disponibles';
}

function open2FAModal() {
    document.getElementById('twoFactorModal').classList.add('active');
    codeSent = false;
    document.getElementById('otpSection').classList.remove('visible');
    document.getElementById('btnActionText').textContent = 'Enviar Código';
    document.getElementById('btnActionIcon').textContent = 'send';
}

function close2FAModal() {
    document.getElementById('twoFactorModal').classList.remove('active');
    clearInterval(countdownTimer);
    resetForm();
}

function resetForm() {
    document.getElementById('userNameInput').value = '';
    document.getElementById('userEmailInput').value = '';
    document.getElementById('userEntityInput').value = '';
    document.getElementById('otpSection').classList.remove('visible');
    codeSent = false;
    
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`otp${i}`).value = '';
        document.getElementById(`otp${i}`).classList.remove('filled');
    }
    
    document.getElementById('codeError').style.display = 'none';
}

function handleModalAction() {
    if (!codeSent) {
        sendVerificationCode();
    } else {
        verifyCode();
    }
}

async function sendVerificationCode() {
    const name = document.getElementById('userNameInput').value.trim();
    const email = document.getElementById('userEmailInput').value.trim();
    const entity = document.getElementById('userEntityInput').value;

    let hasError = false;

    if (!name) {
        document.getElementById('nameError').style.display = 'block';
        hasError = true;
    } else {
        document.getElementById('nameError').style.display = 'none';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        document.getElementById('emailError').style.display = 'block';
        hasError = true;
    } else {
        document.getElementById('emailError').style.display = 'none';
    }

    if (!entity) {
        document.getElementById('entityError').style.display = 'block';
        hasError = true;
    } else {
        document.getElementById('entityError').style.display = 'none';
    }

    if (hasError) return;

    userInfo = { name, email, entity };

    try {
        // Mostrar loading
        document.getElementById('btnActionText').textContent = 'Enviando...';
        document.getElementById('btnAction').disabled = true;

        // Enviar solicitud al backend
        const response = await fetch('/api/auth/send-verification-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                entity: entity
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al enviar el código');
        }

        // Mostrar popup de éxito
        showVerificationCodePopup();

        document.getElementById('otpSection').classList.add('visible');
        document.getElementById('displayEmail').textContent = email;
        codeSent = true;

        document.getElementById('btnActionText').textContent = 'Verificar y Descargar';
        document.getElementById('btnActionIcon').textContent = 'verified';

        remainingSeconds = 300;
        updateCountdown();
        countdownTimer = setInterval(updateCountdown, 1000);

        document.getElementById('otp1').focus();

    } catch (error) {
        console.error('Error:', error);
        alert('Error al enviar el código: ' + error.message);
    } finally {
        document.getElementById('btnAction').disabled = false;
        document.getElementById('btnActionText').textContent = 'Enviar Código';
    }
}

function updateCountdown() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    document.getElementById('countdown').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (remainingSeconds <= 0) {
        clearInterval(countdownTimer);
        handleCodeExpiration();
    }
    
    remainingSeconds--;
}

function handleCodeExpiration() {
    document.getElementById('codeError').style.display = 'block';
    document.getElementById('codeErrorMessage').textContent = 'El código ha expirado. Por favor solicite uno nuevo.';
    
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`otp${i}`).disabled = true;
    }
    
    document.getElementById('btnActionText').textContent = 'Solicitar Nuevo Código';
    document.getElementById('btnActionIcon').textContent = 'refresh';
}

function moveToNext(current, nextId) {
    current.value = current.value.replace(/[^0-9]/g, '');
    
    if (current.value.length === 1) {
        current.classList.add('filled');
        if (nextId) {
            document.getElementById(nextId).focus();
        }
    } else {
        current.classList.remove('filled');
    }
}

function handlePaste(event) {
    event.preventDefault();
    const pastedData = event.clipboardData.getData('text').trim();
    
    if (/^\d{6}$/.test(pastedData)) {
        for (let i = 0; i < 6; i++) {
            const input = document.getElementById(`otp${i + 1}`);
            input.value = pastedData[i];
            input.classList.add('filled');
        }
        document.getElementById('otp6').focus();
        autoVerifyCode();
    } else {
        showCodeError('El código debe contener solo 6 dígitos numéricos');
    }
}

function autoVerifyCode() {
    const otp = getOTPValue();
    if (otp.length === 6 && /^\d{6}$/.test(otp)) {
        setTimeout(() => verifyCode(), 300);
    }
}

function getOTPValue() {
    let otp = '';
    for (let i = 1; i <= 6; i++) {
        otp += document.getElementById(`otp${i}`).value;
    }
    return otp;
}

async function verifyCode() {
    const enteredCode = getOTPValue();

    if (enteredCode.length !== 6) {
        showCodeError('Por favor ingrese el código completo de 6 dígitos');
        return;
    }

    if (!/^\d{6}$/.test(enteredCode)) {
        showCodeError('El código debe contener solo números');
        return;
    }

    if (remainingSeconds <= 0) {
        showCodeError('El código ha expirado. Por favor solicite uno nuevo.');
        return;
    }

    try {
        // Mostrar loading
        document.getElementById('btnActionText').textContent = 'Verificando...';
        document.getElementById('btnAction').disabled = true;

        // Verificar código con el backend
        const response = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: userInfo.email,
                code: enteredCode
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al verificar el código');
        }

        clearInterval(countdownTimer);

        // Guardar token y sesión
        const sessionData = {
            user: data.user,
            token: data.token,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('viits_session', JSON.stringify(sessionData));

        isLoggedIn = true;
        userInfo = data.user;
        close2FAModal();
        showUserProfile();
        processDownload();

    } catch (error) {
        console.error('Error:', error);
        showCodeError(error.message || 'Error al verificar el código');

        for (let i = 1; i <= 6; i++) {
            const input = document.getElementById(`otp${i}`);
            input.value = '';
            input.classList.remove('filled');
        }
        document.getElementById('otp1').focus();
    } finally {
        document.getElementById('btnAction').disabled = false;
        document.getElementById('btnActionText').textContent = 'Verificar y Descargar';
    }
}

function showCodeError(message) {
    document.getElementById('codeErrorMessage').textContent = message;
    document.getElementById('codeError').style.display = 'block';
    
    setTimeout(() => {
        document.getElementById('codeError').style.display = 'none';
    }, 5000);
}

function resendCode(event) {
    if (event) event.preventDefault();

    if (remainingSeconds > 0) {
        alert('El código actual aún es válido. Espere a que expire para solicitar uno nuevo.');
        return;
    }

    codeSent = false;
    document.getElementById('otpSection').classList.remove('visible');
    sendVerificationCode();
}

async function processDownload() {
    const deviceNames = {
        'wim': 'WIM',
        'conteos-fijos': 'Conteos Fijos',
        'conteos-moviles': 'Conteos Móviles',
        'dai': 'DAI',
        'galibos': 'Galibos',
        'radares': 'Radares'
    };
    let department = document.getElementById('department').selectedOptions[0]?.text || 'Todos los departamentos';
    let sector =  document.getElementById('sector').selectedOptions[0]?.text || 'Todos los sectores'
    let devices = []
    if (sector !== 'Todos los sectores' && department !== 'Todos los departamentos') {
        devices = departmentList[selectedDevices[0]][department.toLowerCase()]['sectores'][sector];
    }
    const downloadData = {
        devices: devices,
        deviceType: selectedDevices.map(d => deviceNames[d]).join(', '),
        dateRange: `${document.getElementById('startDate').value} a ${document.getElementById('endDate').value}`,
        department: department == 'Todos los departamentos' ? 'all' : department,
        sector: sector == 'Todos los sectores' ? 'all' : sector,
        dataType: 'all', // Por ahora siempre 'all'
        days: document.getElementById('summaryDays').textContent
    };

    try {
        // Mostrar loading
        document.getElementById('btnNext').disabled = true;
        document.getElementById('btnNext').innerHTML = 'Procesando... <i class="material-icons">hourglass_empty</i>';

        // Enviar datos al backend para guardar la descarga
        const response = await fetch('/api/downloads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JSON.parse(localStorage.getItem('viits_session')).token}`
            },
            body: JSON.stringify(downloadData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error al procesar la descarga');
        }

        // Actualizar ID en modal de éxito
        const date = new Date(result.created_at);
        const millis = date.getTime();
        document.getElementById('requestId').textContent = 'REQ-' + millis;

        // Recargar historial
        loadDownloadHistory();

        // Mostrar modal de éxito
        showSuccessModal();

    } catch (error) {
        console.error('Error procesando descarga:', error);
        alert('Error al procesar la descarga: ' + error.message);
    } finally {
        // Restaurar botón
        document.getElementById('btnNext').disabled = false;
        document.getElementById('btnNext').innerHTML = 'Confirmar y Descargar <i class="material-icons">download</i>';
    }
}

function showSuccessModal() {
    document.getElementById('successModal').classList.add('active');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
    currentStep = 1;
    selectedDevices = [];
    document.querySelectorAll('.device-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.device-checkbox').checked = false;
    });
    updateStepDisplay();

    // Scroll al historial
    setTimeout(() => {
        document.getElementById('historySection').scrollIntoView({ behavior: 'smooth' });
    }, 300);
}

function openDeviceSelectionModal() {
    document.getElementById('deviceSelectionModal').classList.add('active');
}

function closeDeviceSelectionModal() {
    document.getElementById('deviceSelectionModal').classList.remove('active');
}

function openTermsModal() {
    document.getElementById('termsModal').classList.add('active');
}

function closeTermsModal() {
    document.getElementById('termsModal').classList.remove('active');
}

// Logout Success Modal Functions
function showLogoutSuccessModal() {
    document.getElementById('logoutSuccessModal').classList.add('active');
}

function closeLogoutSuccessModal() {
    document.getElementById('logoutSuccessModal').classList.remove('active');
}

// Función para mostrar popup de código de verificación enviado
function showVerificationCodePopup() {
    // Crear el popup
    const popup = document.createElement('div');
    popup.id = 'verificationCodePopup';
    popup.innerHTML = `
        <div class="popup-overlay">
            <div class="popup-content">
                <div class="popup-icon">
                    <i class="material-icons">check_circle</i>
                </div>
                <h3>Código de verificación enviado</h3>
                <p>Se ha enviado un código de verificación a tu correo electrónico. Revisa tu bandeja de entrada y carpeta de spam si no lo encuentras.</p>
                <button class="btn btn-primary" onclick="closeVerificationCodePopup()">Entendido</button>
            </div>
        </div>
    `;

    // Agregar estilos CSS
    const style = document.createElement('style');
    style.textContent = `
        .popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        }

        .popup-content {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease-out;
        }

        .popup-icon {
            color: #10b981;
            font-size: 3rem;
            margin-bottom: 1rem;
        }

        .popup-content h3 {
            color: #1f2937;
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }

        .popup-content p {
            color: #6b7280;
            margin-bottom: 1.5rem;
            line-height: 1.5;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;

    // Agregar al DOM
    document.head.appendChild(style);
    document.body.appendChild(popup);

    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        closeVerificationCodePopup();
    }, 5000);
}

// Función para cerrar el popup
function closeVerificationCodePopup() {
    const popup = document.getElementById('verificationCodePopup');
    if (popup) {
        popup.remove();
    }
}

// Función para generar controles de paginación
function generatePaginationControls(pagination) {
    if (pagination.total_pages <= 1) {
        return '';
    }

    const { current_page, total_pages, has_prev, has_next } = pagination;

    let controls = '<div class="pagination-controls">';

    // Botón anterior
    if (has_prev) {
        controls += `<button class="pagination-btn" onclick="loadDownloadHistory(${current_page - 1})" title="Página anterior">
            <i class="material-icons">chevron_left</i>
        </button>`;
    } else {
        controls += `<button class="pagination-btn disabled" disabled>
            <i class="material-icons">chevron_left</i>
        </button>`;
    }

    // Números de página
    const startPage = Math.max(1, current_page - 2);
    const endPage = Math.min(total_pages, current_page + 2);

    if (startPage > 1) {
        controls += `<button class="pagination-btn" onclick="loadDownloadHistory(1)">1</button>`;
        if (startPage > 2) {
            controls += '<span class="pagination-dots">...</span>';
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === current_page) {
            controls += `<button class="pagination-btn active" disabled>${i}</button>`;
        } else {
            controls += `<button class="pagination-btn" onclick="loadDownloadHistory(${i})">${i}</button>`;
        }
    }

    if (endPage < total_pages) {
        if (endPage < total_pages - 1) {
            controls += '<span class="pagination-dots">...</span>';
        }
        controls += `<button class="pagination-btn" onclick="loadDownloadHistory(${total_pages})">${total_pages}</button>`;
    }

    // Botón siguiente
    if (has_next) {
        controls += `<button class="pagination-btn" onclick="loadDownloadHistory(${current_page + 1})" title="Página siguiente">
            <i class="material-icons">chevron_right</i>
        </button>`;
    } else {
        controls += `<button class="pagination-btn disabled" disabled>
            <i class="material-icons">chevron_right</i>
        </button>`;
    }

    controls += '</div>';

    return controls;
}