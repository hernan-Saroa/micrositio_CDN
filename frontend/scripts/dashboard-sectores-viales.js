// ============================================
// DASHBOARD Y GRÁFICAS - LÓGICA INTEGRADA DE DASHBOARD-SECTORES-VIALES.HTML
// ============================================

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar
    initPeriodSelector();

    // Cargar KPIs desde cache primero, luego del endpoint
    loadKPIsFromCache();
    loadKPIs(true);

    // Inicializar gráfica con datos simulados como respaldo
    updateChart();
    //updateTable();

    // Actualizar tabla con datos de API cuando se carguen los KPIs
    updateTableFromAPI();
});

// Función para cargar KPIs desde el endpoint comparacion
async function loadKPIs(isFirstLoad = false, maxRetries = 3) {
    let attempts = 0;
    let success = false;

    if (isFirstLoad === false) {
        showLoadingModal();
    }

    while (attempts < maxRetries && !success) {
        try {
            console.log(`🔄 Intento ${attempts + 1} de ${maxRetries}`);
            // Cambiar a endpoint de ClickHouse con rango de fechas por defecto
            const rangeDate = getDateRange();
            const vehicleTypeSelector = document.getElementById('vehicleTypeFilter').value;
            const response = await fetch(`/api/clickhouse/road-analysis-dashboard?startDate=${rangeDate.startDate}&endDate=${rangeDate.endDate}&vehicleType=${vehicleTypeSelector}`);

            // ⚠️ Verificar si la respuesta es exitosa (status 200–299)
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // ✅ Guardar respuesta en localStorage
                localStorage.setItem('kpiDataCache', JSON.stringify(data));

                // ✅ Generar lista de estados únicos
                generateDepartmentList(data.data);

                // ✅ Procesar datos y salir del bucle
                processKPIData(data);
                updateTrafficChart();
                updateTableFromAPI();

                success = true;
            } else {
                throw new Error('Respuesta vacía o sin datos');
            }
            hideLoadingModal();

        } catch (error) {
            hideLoadingModal();
            console.error(`❌ Error al cargar KPIs (intento ${attempts + 1}):`, error.message);
            attempts++;
            if (attempts >= maxRetries) {
                console.warn('⚠️ Límite de reintentos alcanzado. Cargando desde caché...');
                loadKPIsFromCache();
            }
        }
    }
}

function getDateRange() {
    const periodSelector = document.getElementById('periodFilter').value;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endDate = new Date(yesterday);
    const startDate = new Date(yesterday);
    
    switch (periodSelector) {
        case 'last7days':
            const today = new Date();
            startDate.setDate(today.getDate() - 7);
            break;

        case 'day-0': // hoy
            break;

        case 'day-1': // ayer
        case 'day-2':
        case 'day-3':
        case 'day-4':
        case 'day-5':
        case 'day-6':
            const daysAgo = parseInt(periodSelector.split('-')[1], 10);
            console.log('Days ago:', daysAgo);
            startDate.setDate(yesterday.getDate() - daysAgo);
            endDate.setDate(yesterday.getDate() - daysAgo);
            break;

        case 'lastMonth':
            startDate.setMonth(yesterday.getMonth() - 1);
            startDate.setDate(1);
            endDate.setDate(0); // último día del mes anterior
            break;

        case 'lastQuarter':
            const currentMonth = yesterday.getMonth();
            const startQuarterMonth = currentMonth - (currentMonth % 3) - 3;
            startDate.setMonth(startQuarterMonth);
            startDate.setDate(1);
            endDate.setMonth(startQuarterMonth + 3);
            endDate.setDate(0);
            break;

        case 'lastYear':
            startDate.setFullYear(yesterday.getFullYear() - 1, 0, 1); // 1 de enero del año anterior
            endDate.setFullYear(yesterday.getFullYear() - 1, 11, 31); // 31 de diciembre del año anterior
            break;

        default:
            // Si no coincide con nada, usamos los últimos 7 días
            startDate.setDate(yesterday.getDate() - 7);
            break;
    }

    // 🔹 Función auxiliar para formatear YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}

// Función para generar la lista de estados/departamentos desde los datos
function generateDepartmentList(data) {
    try {
        // Extraer estados únicos de los datos
        const estadosUnicos = [...new Set(data.map(item => item.estado))].filter(estado =>
            estado && estado !== 'SIN_ESTADO' && estado !== null && estado !== undefined
        ).sort();

        // Actualizar el selector de departamentos
        const departmentSelector = document.getElementById('departmentFilter');
        if (departmentSelector) {
            // Limpiar opciones existentes excepto "Todos los departamentos"
            const firstOption = departmentSelector.querySelector('option[value=""]');
            departmentSelector.innerHTML = '';

            // Agregar opción "Todos los departamentos"
            if (firstOption) {
                departmentSelector.appendChild(firstOption);
            } else {
                const allOption = document.createElement('option');
                allOption.value = '';
                allOption.textContent = 'Todos los departamentos';
                departmentSelector.appendChild(allOption);
            }

            // Agregar estados como opciones
            estadosUnicos.forEach(estado => {
                const option = document.createElement('option');
                option.value = estado.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                option.textContent = estado;
                departmentSelector.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Error al generar lista de departamentos:', error);
    }
}

// Función para procesar datos de KPIs
function processKPIData(data) {
    // Calcular KPIs totales
    const fechasUnicas = [...new Set(data.data.map(item => item.fecha))].sort((a, b) => new Date(b) - new Date(a)); // Ordenar fechas descendente
    const totalFechas = fechasUnicas.length;

    // Agrupar por fecha para calcular promedios diarios
    const datosPorFecha = {};

    data.data.forEach(tramo => {
        const fecha = tramo.fecha;
        if (!datosPorFecha[fecha]) {
            datosPorFecha[fecha] = {
                velocidadPonderada: 0,
                registrosPonderados: 0,
                volumenTotal: 0,
                excesoTotal: 0
            };
        }

        const velocidad = parseFloat(tramo.promedio_velocidad) || 0;
        const registros = parseInt(tramo.total_registros) || 0;
        const exceso = parseInt(tramo.registros_mayor_80) || 0;

        // Ponderar velocidad por número de registros
        datosPorFecha[fecha].velocidadPonderada += velocidad * registros;
        datosPorFecha[fecha].registrosPonderados += registros;
        datosPorFecha[fecha].volumenTotal += registros;
        datosPorFecha[fecha].excesoTotal += exceso;
    });

    // Calcular promedios diarios
    const promediosDiarios = {};
    Object.keys(datosPorFecha).forEach(fecha => {
        const fechaData = datosPorFecha[fecha];
        promediosDiarios[fecha] = {
            velocidad: fechaData.registrosPonderados > 0 ? fechaData.velocidadPonderada / fechaData.registrosPonderados : 0,
            volumen: fechaData.volumenTotal,
            exceso: fechaData.excesoTotal
        };
    });

    // Calcular promedios totales
    let velocidadTotal = 0;
    let volumenTotal = 0;
    let excesoTotal = 0;

    Object.values(promediosDiarios).forEach(diaData => {
        velocidadTotal += diaData.velocidad;
        volumenTotal += diaData.volumen;
        excesoTotal += diaData.exceso;
    });

    const velocidadPromedioTotal = totalFechas > 0 ? (velocidadTotal / totalFechas) : 0;
    const volumenPromedioTotal = totalFechas > 0 ? Math.round(volumenTotal / totalFechas) : 0;
    const excesoPromedioTotal = totalFechas > 0 ? Math.round(excesoTotal / totalFechas) : 0;

    // Calcular tendencias comparando la fecha más reciente con la anterior
    let velocidadTrend = { porcentaje: 0, esAumento: true };
    let volumenTrend = { porcentaje: 0, esAumento: true };
    let excesoTrend = { porcentaje: 0, esAumento: false };
    let velocidadTrend8 = { porcentaje: 0, esAumento: true };
    let volumenTrend8 = { porcentaje: 0, esAumento: true };
    let excesoTrend8 = { porcentaje: 0, esAumento: false };

    if (fechasUnicas.length >= 2) {
        const fechaMasReciente = fechasUnicas[0];
        const fechaAnterior = fechasUnicas[1];
        const fechaAnterior8 = fechasUnicas[7];

        const velocidadReciente = promediosDiarios[fechaMasReciente].velocidad;
        const velocidadAnterior = promediosDiarios[fechaAnterior].velocidad;
        const velocidadAnterior8 = fechaAnterior8 ? promediosDiarios[fechaAnterior8].velocidad : 0;
        velocidadTrend = calcularTendencia(velocidadReciente, velocidadAnterior);
        velocidadTrend8 = calcularTendencia(velocidadReciente, velocidadAnterior8);

        const volumenReciente = promediosDiarios[fechaMasReciente].volumen;
        const volumenAnterior = promediosDiarios[fechaAnterior].volumen;
        const volumenAnterior8 = fechaAnterior8 ? promediosDiarios[fechaAnterior8].volumen : 0;
        volumenTrend = calcularTendencia(volumenReciente, volumenAnterior);
        volumenTrend8 = calcularTendencia(volumenReciente, volumenAnterior8);

        const excesoReciente = promediosDiarios[fechaMasReciente].exceso;
        const excesoAnterior = promediosDiarios[fechaAnterior].exceso;
        const excesoAnterior8 = fechaAnterior8 ? promediosDiarios[fechaAnterior8].exceso : 0;
        excesoTrend = calcularTendencia(excesoReciente, excesoAnterior);
        excesoTrend8 = calcularTendencia(excesoReciente, excesoAnterior8);

    }

    // Actualizar elementos del DOM
    updateKPIElements(velocidadPromedioTotal, volumenPromedioTotal, excesoPromedioTotal, velocidadTrend, volumenTrend, excesoTrend, velocidadTrend8, volumenTrend8, excesoTrend8);
}

// Función para cargar KPIs desde localStorage
function loadKPIsFromCache() {
    try {
        const cachedData = localStorage.getItem('kpiDataCache');
        if (cachedData) {
            const cache = JSON.parse(cachedData);

            // Verificar si el cache no es muy antiguo (24 horas)
            const cacheAge = Date.now() - cache.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

            if (cacheAge < maxAge) {
                console.log('Cargando KPIs desde cache localStorage');
                // Generar lista de estados desde cache también
                generateDepartmentList(cache.data);
                processKPIData(cache);
                updateTrafficChart();
                updateTableFromAPI();
                return true;
            } else {
                console.log('Cache expirado, eliminando datos antiguos');
                localStorage.removeItem('kpiDataCache');
            }
        }
    } catch (error) {
        console.error('Error al cargar KPIs desde cache:', error);
    }
    return false;
}

// Función para calcular tendencia (porcentaje de cambio)
function calcularTendencia(valorHoy, valorAyer) {
    if (valorAyer === 0) return { porcentaje: 0, esAumento: true };

    const cambio = ((valorHoy - valorAyer) / valorAyer) * 100;
    const esAumento = cambio >= 0;

    return {
        porcentaje: Math.abs(cambio).toFixed(1),
        esAumento: esAumento
    };
}

// Función para actualizar los elementos KPI en el DOM
function updateKPIElements(velocidad, volumen, exceso, velocidadTrend, volumenTrend, excesoTrend, velocidadTrend8, volumenTrend8, excesoTrend8) {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const dia =ayer.toLocaleDateString('es-ES', { weekday: 'long' });
    // Actualizar KPIs por volumen
    updateDataKPIs(1, volumen, volumenTrend, volumenTrend8, dia, 'vehículos/día');
    // Actualizar KPIs por velocidad
    updateDataKPIs(2, velocidad, velocidadTrend, velocidadTrend8, dia, 'km/h');
    // Actualizar KPIs por velodicad mayor a 80km/h
    updateDataKPIs(3, exceso, excesoTrend, excesoTrend8, dia, 'vehículos/día');
}

function updateDataKPIs(i, data, dataTrend, dataTrend8, day, unit) {
    const elementKpiCart = document.querySelector(`.kpi-card:nth-child(${i})`);
    if (elementKpiCart) {

        // KPI 1: promedio
        const kpiValue = elementKpiCart.querySelector('.kpi-value');
        if (kpiValue) {
            let kpi = data.toLocaleString('es-CO');
            if (i == 2 ) {
                kpi = data.toLocaleString('es-CO', {minimumFractionDigits: 1, maximumFractionDigits: 1});
            }
            kpiValue.innerHTML = `${kpi} <span style="font-size: clamp(1rem, 3vw, 1.25rem); font-weight: 500; color: #6b7280;">${unit}</span>`;
        }
        
        // KPI 2: promedio vs anteayer
        const kpiTrend = elementKpiCart.querySelector('.kpi-trend');
        if (kpiTrend && dataTrend) {
            const icon = dataTrend.esAumento ? 'trending_up' : 'trending_down';
            const color = dataTrend.esAumento ? '#10b981' : '#ef4444';
            const signo = dataTrend.esAumento ? '+' : '-';
            kpiTrend.innerHTML = `
                <i class="material-icons" style="color: ${color}; font-size: 18px;" aria-hidden="true">${icon}</i>
                <span style="color: ${color}; font-weight: 600;">${signo}${dataTrend.porcentaje}%</span>
                <span style="color: #6b7280;">vs anteayer</span>
            `;
            kpiTrend.className = `kpi-trend ${dataTrend.esAumento ? 'positive' : 'negative'}`;
        }

        // KPI 3: promedio vs hace 8 días
        const kpiTrend8 = elementKpiCart.querySelector('.kpi-trend-8');
        if (kpiTrend8 && dataTrend8) {
            const icon = dataTrend8.esAumento ? 'trending_up' : 'trending_down';
            const color = dataTrend8.esAumento ? '#10b981' : '#ef4444';
            const signo = dataTrend8.esAumento ? '+' : '-';
            kpiTrend8.innerHTML = `
                <i class="material-icons" style="color: ${color}; font-size: 18px;" aria-hidden="true">${icon}</i>
                <span style="color: ${color}; font-weight: 600;">${signo}${dataTrend8.porcentaje}%</span>
                <span style="color: #6b7280;">vs el ${day} pasado</span>
            `;
            kpiTrend8.className = `kpi-trend-8 ${dataTrend8.esAumento ? 'positive' : 'negative'}`;
        }
    }
}

let sectorsData = [
    {dept: "Valle del Cauca", tramo: "1901. Cali - Cruce Ruta 40 (Loboguerrero)", pr: "20+0187", sector: "Cali - Cruce Ruta 40 (Loboguerrero)"},
    {dept: "Valle del Cauca", tramo: "2302. Mediacanoa - La Unión - La Virginia", pr: "104+0936", sector: "Mediacanoa - Ansermanuevo"},
    {dept: "Quindío", tramo: "4003A. Armenia - Ibagué", pr: "15+0521", sector: "Calarcá - Cajamarca"},
    {dept: "Cundinamarca", tramo: "4510. Honda - Río Ermitaño", pr: "46+0284", sector: "Puerto Salgar - Río Ermitaño"},
    {dept: "Valle del Cauca", tramo: "2301. Cali - Vijes - Mediacanoa", pr: "9+0074", sector: "Cali - Yumbo"},
    {dept: "Boyacá", tramo: "6211. Sogamoso - Aguazul", pr: "37+0263", sector: "El Crucero - Aguazul"},
    {dept: "Casanare", tramo: "6513. Yopal - Paz de Ariporo", pr: "12+0320", sector: "Yopal - Paz de Ariporo"},
    {dept: "Santander", tramo: "5504. La Palmera - Presidente", pr: "3+0387", sector: "La Palmera - Presidente"},
    {dept: "Casanare", tramo: "6513. Yopal - Paz de Ariporo", pr: "1+0629", sector: "Yopal - Paz de Ariporo"},
    {dept: "Casanare", tramo: "6513. Yopal - Paz de Ariporo", pr: "2+0718", sector: "Yopal - Paz de Ariporo"},
    {dept: "Tolima", tramo: "3603. Ortega - Guamo", pr: "5+0940", sector: "Ortega - Guamo"},
    {dept: "Valle del Cauca", tramo: "23VL01. Riofrío - Trujillo", pr: "12+0391", sector: "Glorieta Cencar - Aeropuerto - Cruce Ruta 25"},
    {dept: "Valle del Cauca", tramo: "2505B. Por Definir", pr: "17+0415", sector: "Palmaseca - El Cerrito"},
    {dept: "Boyacá", tramo: "6209. Barbosa - Tunja", pr: "32+0639", sector: "Barbosa - Tunja"},
    {dept: "Valle del Cauca", tramo: "2506. La Victoria - Cerritos", pr: "48+0691", sector: "La Victoria - Cartago"},
    {dept: "Cauca", tramo: "25CCB. Variante de Popayán", pr: "7+0636", sector: "Variante de Popayán"},
    {dept: "Risaralda", tramo: "2507. Cerritos - Cauyá", pr: "1+0667", sector: "Cerritos - La Virginia"},
    {dept: "Antioquia", tramo: "2512. Tarazá - Caucasia", pr: "37+0234", sector: "Tarazá - Caucasia"},
    {dept: "Cauca", tramo: "2503. Mojarras - Popayán", pr: "111+0940", sector: "Mojarras - Popayán"},
    {dept: "Cordoba", tramo: "2514. Planeta Rica - Chinú - Sincelejo", pr: "43+0214", sector: "Planeta Rica - La Ye"},
    {dept: "Boyacá", tramo: "45A06. Puente Nacional - San Gil", pr: "33+0116", sector: "Puente Nacional - San Gil"},
    {dept: "Cordoba", tramo: "2103. Montería - Lorica", pr: "10+0209", sector: "Paso Nacional por Cereté"},
    {dept: "Cauca", tramo: "25CCB. Variante de Popayán", pr: "3+0238", sector: "Variante de Popayán"},
    {dept: "Antioquia", tramo: "2510. Medellín - Los Llanos", pr: "81+0369", sector: "Hoyo Rico - Los Llanos"},
    {dept: "Nariño", tramo: "2502. San Juan de Pasto - Mojarras", pr: "10+0958", sector: "San Juan de Pasto - Cano"},
    {dept: "Valle del Cauca", tramo: "2505. Cali - Palmira - Andalucía", pr: "56+0540", sector: "Palmira - Buga"},
    {dept: "Valle del Cauca", tramo: "2504A. Cruce Tramo 2504 - Puerto Tejada - Cruce Tramo 2505", pr: "41+0429", sector: "Límites Cauca - Palmira"},
    {dept: "Quindío", tramo: "2901B. Armenia - Alcalá - Pereira", pr: "3+0421", sector: "Armenia - Montenegro - Alcalá"},
    {dept: "Risaralda", tramo: "29RSC. Variante El Pollo - Chinchiná", pr: "8+0681", sector: "Intersección El Pollo - Intersección El Mandarino (3)"},
    {dept: "Valle del Cauca", tramo: "3105. Alternas a la Troncal de Occidente", pr: "71+0448", sector: "Río Desbaratado - Palmira"},
    {dept: "Quindío", tramo: "4003. Armenia - Ibagué", pr: "2+0164", sector: "Armenia - La Línea"},
    {dept: "Valle del Cauca", tramo: "4001. Buenaventura - Cruce Ruta 25 (Buga)", pr: "112+0605", sector: "Cruce Ruta 40 (Loboguerrero) - Buga"},
    {dept: "Valle del Cauca", tramo: "4001. Buenaventura - Cruce Ruta 25 (Buga)", pr: "49+0682", sector: "Córdoba - Cruce Ruta 40 (Loboguerrero)"},
    {dept: "Valle del Cauca", tramo: "4001. Buenaventura - Cruce Ruta 25 (Buga)", pr: "15+0378", sector: "Intersección Citronela - Córdoba"},
    {dept: "Boyacá", tramo: "45A05. Ubaté - Puente Nacional", pr: "56+0661", sector: "Ubaté - Puente Nacional"},
    {dept: "Santander", tramo: "45A07. San Gil - Bucaramanga", pr: "82+1982", sector: "San Gil - Bucaramanga"},
    {dept: "Cundinamarca", tramo: "45A04. Bogotá - Ubaté", pr: "36+0241", sector: "Zipaquirá - Ubaté"},
    {dept: "Santander", tramo: "45A06. Puente Nacional - San Gil", pr: "100+0545", sector: "Puente Nacional - San Gil"},
    {dept: "Santander", tramo: "45A07. San Gil - Bucaramanga", pr: "16+0604", sector: "San Gil - Bucaramanga"},
    {dept: "Santander", tramo: "45A07. San Gil - Bucaramanga", pr: "84+2171", sector: "San Gil - Bucaramanga"},
    {dept: "Santander", tramo: "45A08. Bucaramanga - San Alberto", pr: "23+0931", sector: "Río Negro - San Alberto"},
    {dept: "Santander", tramo: "4511. Río Ermitaño - La Lizama", pr: "40+0624", sector: "Río Ermitaño - La Lizama"},
    {dept: "Santander", tramo: "4511. Río Ermitaño - La Lizama", pr: "42+0272", sector: "Río Ermitaño - La Lizama"},
    {dept: "Cesar", tramo: "4515. La Mata - San Roque", pr: "77+0786", sector: "La Mata - San Roque"},
    {dept: "Cesar", tramo: "4514. San Alberto - La Mata", pr: "64+0520", sector: "San Alberto - La Mata"},
    {dept: "Santander", tramo: "4513. La Lizama - San Alberto", pr: "67+0695", sector: "La Lizama -Rio Sogamoso"},
    {dept: "Cundinamarca", tramo: "4510. Honda - Río Ermitaño", pr: "65+0387", sector: "Puerto Salgar - Río Ermitaño"},
    {dept: "Santander", tramo: "6207. Cruce Puerto Araujo - Landázuri", pr: "0+0098", sector: "Cruce Puerto Araujo - Landázuri"},
    {dept: "Boyacá", tramo: "6404. Belén - Sácama", pr: "36+0786", sector: "Belén - Sácama"},
    {dept: "Norte de Santander", tramo: "7008. Ocaña - Sardinata", pr: "15+0185", sector: "Ocaña - Alto del Pozo"},
    {dept: "Nariño", tramo: "0801. Guachucal - Ipiales", pr: "19+0565", sector: "Guachucal - Ipiales"},
    {dept: "Valle del Cauca", tramo: "2504. Popayán - Cali", pr: "111+0721", sector: "Puente Valencia sobre el río Cauca - Cali"},
    {dept: "Cesar", tramo: "8004A. Valledupar - San Juan del Cesar", pr: "0+0381", sector: "Valledupar - San Juan del Cesar"},
    {dept: "Valle del Cauca", tramo: "2505. Cali - Palmira - Andalucía", pr: "32+0138", sector: "Palmira - Buga"},
    {dept: "Cesar", tramo: "8004. Valledupar - Manaure", pr: "2+0486", sector: "Valledupar - La Paz"},
    {dept: "La Guajira", tramo: "8801. Buenavista - Maicao", pr: "21+0000", sector: "Buenavista - Cuestecitas"}
];

// Los departamentos se cargan dinámicamente desde la API en generateDepartmentList()

// Variables globales
let currentChart = null;
let currentChartType = 'bar';
let filteredData = [...sectorsData];
let filteredTrafficData = []; // Variable global para almacenar datos filtrados
let selectedSectorChartdays = '';
let selectedSectorCharthour = '';
let selectedDeviceChartdays = ''
let selectedDeviceData = '';

// Función para inicializar el selector de período con fechas
function initPeriodSelector() {
    console.log('Inicializando selector de periodo');
    const selector = document.getElementById('periodFilter');
    if (!selector) return;
    
    // Obtener fecha de ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Opción de los últimos 7 días (rango completo)
    const last7DaysStart = new Date(yesterday);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);
    
    const formatDate = (date) => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${date.getDate()} ${months[date.getMonth()]}`;
    };
    
    // Opción principal: Últimos 7 días (con rango de fechas)
    const options = [
        { value: 'last7days', text: `Últimos 7 días (${formatDate(last7DaysStart)} - ${formatDate(yesterday)})`, selected: true }
    ];
    
    // Opciones individuales por día (solo últimos 7 días)
    for (let i = 0; i < 7; i++) {
        const date = new Date(yesterday);
        date.setDate(date.getDate() - i);
        
        const dayLabel = i === 0 ? 'Ayer' : formatDate(date);
        const fullDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        
        options.push({
            value: `day-${i}`,
            text: `${dayLabel} (${fullDate})`,
            selected: false
        });
    }
    
    // options.push(
    //     { value: 'lastMonth', text: 'Último mes', selected: false },
    //     { value: 'lastQuarter', text: 'Último trimestre', selected: false },
    //     { value: 'lastYear', text: 'Último año', selected: false }
    // );
    // Limpiar y agregar opciones
    selector.innerHTML = '';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if (opt.selected) option.selected = true;
        selector.appendChild(option);
    });
}

// Aplicar filtros
function applyFilters() {
    const dept = document.getElementById('departmentFilter').value;

    if (dept) {
        filteredData = sectorsData.filter(s => s.dept === dept);
    } else {
        filteredData = [...sectorsData];
    }

    updateKPIs();
    updateChart();
    //updateTable();
}

// Función para actualizar la tabla con datos de API
function updateTableFromAPI() {
    const cachedData = localStorage.getItem('kpiDataCache');
    if (!cachedData) {
        console.log('No hay datos en cache para actualizar tabla');
        return;
    }

    const cache = JSON.parse(cachedData);
    const selectedDept = document.getElementById('departmentFilter').value;

    let filteredData = cache.data;
    let deviceNotFound = cache.deviceNotFound;

    // Filtrar por departamento si no es vacío
    if (selectedDept !== '') {
        filteredData = cache.data.filter(tramo => tramo.estado.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === selectedDept);
        deviceNotFound = cache.deviceNotFound.filter(tramo => tramo.departamento.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === selectedDept);
    }

    // Agrupar por tramo para calcular promedios
    const datosPorSector = {};
    filteredData.forEach(tramo => {
        const key = tramo.dispositivo;
        const device = {};
        if (!datosPorSector[key]) {
            datosPorSector[key] = {
                estado: tramo.estado,
                municipio: tramo.municipio,
                ruta: tramo.ruta,
                codigo_ruta: tramo.codigo_ruta,
                tramo: tramo.tramo,
                codigo_tramo: tramo.codigo_tramo,
                sector: tramo.sector,
                pr_aprox: tramo.pr_aprox,
                velocidadPonderada: 0,
                registrosPonderados: 0,
                volumenTotal: 0,
                excesoTotal: 0,
                fechas: new Set(),
                dispostivos: device,
            };
        }
        if (!device[tramo.dispositivo]) {
            device[tramo.dispositivo] = [tramo]
        } else {
            device[tramo.dispositivo].push(tramo);
        }

        const velocidad = parseFloat(tramo.promedio_velocidad) || 0;
        const registros = parseInt(tramo.total_registros) || 0;
        const exceso = parseInt(tramo.registros_mayor_80) || 0;

        datosPorSector[key].velocidadPonderada += velocidad * registros;
        datosPorSector[key].registrosPonderados += registros;
        datosPorSector[key].volumenTotal += registros;
        datosPorSector[key].excesoTotal += exceso;
        datosPorSector[key].fechas.add(tramo.fecha);
        datosPorSector[key].dispostivos = device;
    });

    // Actualizar tabla
    const tbody = document.getElementById('sectorsTableBody');
    tbody.innerHTML = '';
    console.log('Datos por sector:', datosPorSector);
    Object.keys(datosPorSector).forEach((tramoKey, index) => {
        const tramoData = datosPorSector[tramoKey];
        const velocidadPromedio = tramoData.registrosPonderados > 0 ?
            tramoData.velocidadPonderada / tramoData.registrosPonderados : 0;
        const volumenPromedio = tramoData.fechas.size > 0 ?
            tramoData.volumenTotal / tramoData.fechas.size : 0;
        const excesoPromedio = tramoData.fechas.size > 0 ?
            tramoData.excesoTotal / tramoData.fechas.size : 0;

        const row = document.createElement('tr');
        const statusBadgePromedio = (tramoData.excesoTotal * 100) / tramoData.volumenTotal;

        //console.log('Tramo:', tramoKey, statusBadgePromedio, tramoData);
        // Determinar estado basado en exceso de velocidad
        let statusBadge, statusText;
        if (statusBadgePromedio > 80) {
            statusBadge = 'high';
            statusText = 'Alto';
        } else if (statusBadgePromedio >= 50 && statusBadgePromedio <= 80) {
            statusBadge = 'medium';
            statusText = 'Medio';
        } else {
            statusBadge = 'low';
            statusText = 'Normal';
        }

        row.innerHTML = `
            <td><strong>${index + 1}</strong></td>
            <td>${tramoData.estado.toLowerCase().replace(/\S+/g, palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))}</td>
            <td>${tramoData.municipio.toLowerCase().replace(/\S+/g, palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))}</td>
            <td>${tramoData.codigo_ruta} · ${tramoData.ruta}</td>
            <td>${tramoData.codigo_tramo} · ${tramoData.tramo}</td>
            <td>${tramoData.sector}</td>
            <td>${tramoData.pr_aprox}</td>
            <td>${velocidadPromedio.toLocaleString('es-CO', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
            <td>${Math.round(volumenPromedio).toLocaleString('es-CO')}</td>
            <td>${Math.round(excesoPromedio).toLocaleString('es-CO')}</td>
            <td><span class="badge ${statusBadge}">${statusText}</span></td>
        `;
        //<td><code>N/A</code></td>
        //<td><span class="badge ${statusBadge}">${statusText}</span></td>

        tbody.appendChild(row);
    });

    deviceNotFound.forEach((tramoData, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td title="${tramoData.device}"><strong>${Object.keys(datosPorSector).length + index + 1}</strong></td>
            <td>${tramoData.departamento.toLowerCase().replace(/\S+/g, palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))}</td>
            <td>${tramoData.municipio.toLowerCase().replace(/\S+/g, palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))}</td>
            <td>${tramoData.codigo_ruta} · ${tramoData.ruta}</td>
            <td>${tramoData.codigo_tramo} · ${tramoData.tramo}</td>
            <td>${tramoData.sector}</td>
            <td>${tramoData.pr_aprox}</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td><span class="badge low-0" title="${tramoData.device}">--</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Función para actualizar KPIs basados en el departamento seleccionado
function updateKPIsByDepartment() {
    try {
        const cachedData = localStorage.getItem('kpiDataCache');
        if (!cachedData) {
            console.log('No hay datos en cache para calcular KPIs por departamento');
            return;
        }

        const cache = JSON.parse(cachedData);
        const selectedDept = document.getElementById('departmentFilter').value;

        let filteredData = cache.data;

        // Filtrar por departamento si no es vacío
        if (selectedDept !== '') {
            console.log(`Filtrando KPIs por departamento: ${selectedDept}`);
            filteredData = cache.data.filter(tramo => tramo.estado.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === selectedDept);
        }

        // Si no hay datos filtrados, usar todos los datos
        if (filteredData.length === 0) {
            filteredData = cache.data;
        }

        // Procesar datos filtrados
        processKPIData({
            data: filteredData,
            fechas: cache.fechas
        });

        console.log(`KPIs actualizados para departamento: ${selectedDept} (${filteredData.length} tramos)`);

    } catch (error) {
        console.error('Error al actualizar KPIs por departamento:', error);
    }
}

// Función para actualizar dashboard completo
function updateDashboard() {
    closeDailyChart();
    closeHoursChart();
    updateTrafficChart();
    updateKPIsByDepartment();
    updateTableFromAPI(); // Actualizar tabla con datos de API
}

function updateDashboardQuery() {
    closeDailyChart();
    closeHoursChart();
    loadKPIs();
}

// Función para actualizar la gráfica de tráfico (basada en index.html)
function updateTrafficChart() {
    const metricType = document.getElementById('metricFilter').value;
    const vehicleType = document.getElementById('vehicleTypeFilter').value;
    const selectedDept = document.getElementById('departmentFilter').value;

    // Obtener datos del cache
    const cachedData = localStorage.getItem('kpiDataCache');
    if (!cachedData) {
        console.log('No hay datos en cache para la gráfica');
        return;
    }

    const cache = JSON.parse(cachedData);
    let filteredData = cache.data;

    // Filtrar por departamento si no es "all"
    if (selectedDept !== '') {
        filteredData = cache.data.filter(tramo =>
            tramo.estado.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === selectedDept
        );
    }

    // Agrupar por tramo
    const datosPorTramo = {};
    filteredData.forEach(tramo => {
        let key = tramo.sector;
        if (metricType === 'volume' || metricType === 'excess') {
            key += '_' + tramo.pr_aprox;
        }
        if (!datosPorTramo[key]) {
            datosPorTramo[key] = {
                codigo_tramo: tramo.codigo_tramo,
                estado: tramo.estado,
                pr_aprox: tramo.pr_aprox,
                dispositivo: tramo.id,
                velocidadPonderada: 0,
                registrosPonderados: 0,
                volumenTotal: 0,
                excesoTotal: 0,
                fechas: new Set(),
                type: tramo.type
            };
        }

        const velocidad = parseFloat(tramo.promedio_velocidad) || 0;
        const registros = parseInt(tramo.total_registros) || 0;
        const exceso = parseInt(tramo.registros_mayor_80) || 0;

        datosPorTramo[key].velocidadPonderada += velocidad * registros;
        datosPorTramo[key].registrosPonderados += registros;
        datosPorTramo[key].volumenTotal += registros;
        datosPorTramo[key].excesoTotal += exceso;
        datosPorTramo[key].fechas.add(tramo.fecha);
    });

    // Convertir a array y calcular promedios
    const processedData = Object.keys(datosPorTramo).map(tramoKey => {
        const tramoData = datosPorTramo[tramoKey];
        const velocidadPromedio = tramoData.registrosPonderados > 0 ?
            tramoData.velocidadPonderada / tramoData.registrosPonderados : 0;
        const volumenPromedio = tramoData.fechas.size > 0 ?
            tramoData.volumenTotal / tramoData.fechas.size : 0;
        const excesoPromedio = tramoData.fechas.size > 0 ?
            tramoData.excesoTotal / tramoData.fechas.size : 0;

        return {
            label: (metricType === 'volume' || metricType === 'excess') ? tramoKey.split('_')[0] : tramoKey, // Truncar para label
            velocidad: parseFloat(velocidadPromedio.toFixed(1)),
            volumen: Math.round(volumenPromedio),
            exceso: Math.round(excesoPromedio),
            sector: (metricType === 'volume' || metricType === 'excess') ? tramoKey.split('_')[0] : tramoKey,
            estado: tramoData.estado,
            pr_aprox: tramoData.pr_aprox,
            dispositivo: tramoData.dispositivo,
            codigo_tramo: tramoData.codigo_tramo,
            rawData: tramoData // Guardar datos crudos para gráfica diaria
        };
    });

    // Guardar datos filtrados globalmente
    filteredTrafficData = processedData;

    // Determinar qué métrica usar
    let metricKey = 'velocidad';
    let metricLabel = 'Velocidad promedio (km/h)';
    let color, bgColor;

    if (metricType === 'volume') {
        color = '#10b981';
        bgColor = 'rgba(16, 185, 129, 0.7)';
        metricKey = vehicleType === 'all' ? 'volumen' :
                    vehicleType === 'motorcycles' ? 'volumen' : 'volumen'; // Adaptar según datos disponibles
        metricLabel = vehicleType === 'all' ? 'Volumen promedio (vehículos/día)' :
                        vehicleType === 'motorcycles' ? 'Volumen promedio (vehículos/día)' :
                        'Volumen promedio (vehículos/día)';
    } else if (metricType === 'excess') {
        color = '#ef4444';
        bgColor = 'rgba(239, 68, 68, 0.7)';
        metricKey = 'exceso';
        metricLabel = 'Vehículos con velocidad mayor a 80km/h';
    } else {
        color = '#3b82f6';
        bgColor = 'rgba(59, 130, 246, 0.7)';
    }

    // Ordenar y preparar datos
    let sortedData = [...processedData];
    sortedData.sort((a, b) => b[metricKey] - a[metricKey]);

    const sortedLabels = sortedData.map(s => s.label);
    const sortedValues = sortedData.map(s => s[metricKey]);
    const sortedSectors = sortedData.map(s => s.sector);
    const sortedEstados = sortedData.map(s => s.estado);
    const sortedPrAprox = sortedData.map(s => s.pr_aprox);
    const sortedDevices = sortedData.map(s => s.dispositivo);
    const sortedCodigoTramo = sortedData.map(s => s.codigo_tramo);

    if (currentChart) {
        currentChart.destroy();
    }

    const ctx = document.getElementById('sectorsChart');
    currentChart = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels: sortedLabels,
            datasets: [{
                label: metricLabel,
                data: sortedValues,
                backgroundColor: bgColor,
                borderColor: color,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // 🔄 Cambia los ejes (barras horizontales)
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(event, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    selectedDeviceData = sortedData[index];
                    selectedSectorChartdays = sortedSectors[index];
                    selectedDeviceChartdays = sortedDevices[index];
                    const periodSelector = document.getElementById('periodFilter').value;
                    closeHoursChart();
                    if (periodSelector.includes('day-')) {
                        closeDailyChart(false);
                        const rangeDate = getDateRange();
                        selectedSectorCharthour = rangeDate.startDate;
                        showHoursChart();
                    } else {
                        showDailyChart();
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 12 },
                        color: '#3b82f6'
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return 'Código tramo: ' + sortedCodigoTramo[index] + '\nPR: ' + sortedPrAprox[index] + '\nSector: ' + sortedSectors[index];
                        },
                        label: function(context) {
                            const value = context.parsed.x;
                            if (metricType === 'speed') {
                                return metricLabel + ': ' + value + ' km/h';
                            } else {
                                return metricLabel + ': ' + value.toLocaleString('es-CO') + ' veh/día';
                            }
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            if (metricType === 'speed') {
                                return value;
                            }
                            return value.toLocaleString('es-CO');
                        },
                        font: {
                            size: 12
                        }
                    },
                    title: {
                        display: true,
                        text: metricType === 'speed' ? 'Velocidad promedio (km/h)' : 'Cantidad de vehículos',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 12 } },
                    title: {
                        display: true,
                        text: 'Sectores viales',
                        font: { size: 12, weight: 'bold' }
                    }
                }
            }
        },
        plugins: [{
            // 👇 Este plugin dibuja los valores dentro o al final de cada barra
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const text = dataset.data[index].toLocaleString('es-CO');
                        ctx.save();
                        ctx.font = '10px sans-serif';
                        ctx.textBaseline = 'middle';

                        // Si quieres dentro de la barra, usa color blanco
                        ctx.fillStyle = '#000';

                        // Posiciona el texto dentro o al final de la barra
                        const xPos = bar.x + 5; // final de la barra
                        const yPos = bar.y;
                        ctx.textAlign = 'left';
                        ctx.fillText(text, xPos, yPos);
                        ctx.restore();
                    });
                });
            }
        }]
    });
}

// Actualizar KPIs
function updateKPIs() {
    const avgSpeed = (filteredData.reduce((sum, s) => sum + s.speed, 0) / filteredData.length).toFixed(1);
    const avgVolume = Math.floor(filteredData.reduce((sum, s) => sum + s.volume, 0) / filteredData.length);
    const avgExcess = Math.floor(filteredData.reduce((sum, s) => sum + s.excess, 0) / filteredData.length);
    
    document.getElementById('avgSpeed').innerHTML = `${avgSpeed} <span class="kpi-unit">km/h</span>`;
    document.getElementById('avgVolume').innerHTML = `${avgVolume.toLocaleString('es-CO')} <span class="kpi-unit">vehículos/día</span>`;
    document.getElementById('avgExcess').innerHTML = `${avgExcess.toLocaleString('es-CO')} <span class="kpi-unit">vehículos/día</span>`;
}

// Crear/Actualizar gráfica
function updateChart() {
    const metric = document.getElementById('metricFilter').value;
    
    // Crear copia de datos para ordenar sin modificar el original
    let sortedData = [...filteredData];
    
    // Ordenar de mayor a menor según la métrica seleccionada
    switch(metric) {
        case 'speed':
            sortedData.sort((a, b) => b.speed - a.speed);
            break;
        case 'volume':
            sortedData.sort((a, b) => b.volume - a.volume);
            break;
        case 'excess':
            sortedData.sort((a, b) => b.excess - a.excess);
            break;
    }
    
    const labels = sortedData.map((_, i) => `S${i + 1}`);
    let data, label, color;
    
    switch(metric) {
        case 'speed':
            data = sortedData.map(s => s.speed);
            label = 'Velocidad promedio (km/h)';
            color = 'rgb(59, 130, 246)';
            break;
        case 'volume':
            data = sortedData.map(s => s.volume);
            label = 'Volumen de tráfico (veh/día)';
            color = 'rgb(16, 185, 129)';
            break;
        case 'excess':
            data = sortedData.map(s => s.excess);
            label = 'Vehículos con velocidad mayor a 80km/h';
            color = 'rgb(239, 68, 68)';
            break;
    }
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    const ctx = document.getElementById('sectorsChart').getContext('2d');
    currentChart = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.6)'),
                borderColor: color,
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const sector = sortedData[index];
                            return `PR: ${sector.pr}`;
                        },
                        beforeBody: function(context) {
                            const index = context[0].dataIndex;
                            const sector = sortedData[index];
                            return [
                                `Sector: ${sector.sector}`,
                                `Departamento: ${sector.dept}`
                            ];
                        },
                        label: function(context) {
                            return `${label}: ${context.parsed.y.toLocaleString('es-CO')}`;
                        }
                    },
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Sectores viales',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        maxRotation: 90,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: label,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// Cambiar tipo de gráfica
function updateChartType(type) {
    currentChartType = type;
    currentChart.config.type = type;
    currentChart.update();
    
    // Actualizar botones
    document.querySelectorAll('.chart-controls .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // updateChart();
}

// Actualizar tabla
function updateTable() {
    const tbody = document.getElementById('sectorsTableBody');
    tbody.innerHTML = '';
    
    filteredData.forEach((sector, index) => {
        const row = document.createElement('tr');
        
        // Determinar estado basado en exceso de velocidad
        let statusBadge, statusText;
        if (sector.excess > 1500) {
            statusBadge = 'high';
            statusText = 'Alto';
        } else if (sector.excess > 800) {
            statusBadge = 'medium';
            statusText = 'Medio';
        } else {
            statusBadge = 'low';
            statusText = 'Bajo';
        }
        
        row.innerHTML = `
            <td><strong>${index + 1}</strong></td>
            <td>${sector.dept}</td>
            <td><code>${sector.pr}</code></td>
            <td>${sector.sector}</td>
            <td>${sector.speed} km/h</td>
            <td>${sector.volume.toLocaleString('es-CO')}</td>
            <td>${sector.excess.toLocaleString('es-CO')}</td>
            <td><span class="badge ${statusBadge}">${statusText}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

// Función para formatear fecha como 'YYYY-MM-DD'
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Función para mostrar gráfica diaria del tramo seleccionado
function showDailyChart() {
    try {
        // Obtener datos del cache
        const cachedData = localStorage.getItem('kpiDataCache');
        if (!cachedData) {
            console.error('No hay datos en cache para mostrar gráfica diaria');
            return;
        }

        const cache = JSON.parse(cachedData);

        // Filtrar datos por el sector seleccionado
        const sectorData = cache.data.filter(tramo => tramo.sector === selectedSectorChartdays);

        if (sectorData.length === 0) {
            console.error('No se encontraron datos para el sector:', selectedSectorChartdays);
            return;
        }

        // Agrupar datos por fecha
        const datosPorFecha = {};
        sectorData.forEach(tramo => {
            const fecha = tramo.fecha;
            if (!datosPorFecha[fecha]) {
                datosPorFecha[fecha] = {
                    velocidad: parseFloat(tramo.promedio_velocidad) || 0,
                    volumen: parseInt(tramo.total_registros) || 0,
                    exceso: parseInt(tramo.registros_mayor_80) || 0
                };
            }
        });

        const periodSelector = document.getElementById('periodFilter').value;
        if (periodSelector === 'last7days') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const endDate = new Date(yesterday);
            const startDate = new Date(yesterday);
            const today = new Date();
            startDate.setDate(today.getDate() - 7);
            // 🔹 Agregar días faltantes con valores 0
            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                const fechaStr = formatDate(currentDate);
                if (!datosPorFecha[fechaStr]) {
                    datosPorFecha[fechaStr] = {
                    velocidad: 0,
                    volumen: 0,
                    exceso: 0
                    };
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // (Opcional) Ordenar las fechas
            const datosOrdenados = Object.keys(datosPorFecha)
            .sort((a, b) => new Date(a) - new Date(b))
            .map(fecha => ({
                fecha,
                ...datosPorFecha[fecha]
            }));
        }

        // Convertir a arrays ordenados por fecha
        const fechas = Object.keys(datosPorFecha).sort();
        const velocidades = fechas.map(fecha => datosPorFecha[fecha].velocidad);
        const volumenes = fechas.map(fecha => datosPorFecha[fecha].volumen);
        const excesos = fechas.map(fecha => datosPorFecha[fecha].exceso);

        // Formatear fechas para mostrar
        const fechasFormateadas = fechas.map(fecha => {
            const date = new Date(fecha);
            return date.toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short'
            });
        });

        // Obtener la métrica seleccionada
        const metricType = document.getElementById('metricFilter').value;

        // Determinar qué datos mostrar basado en la métrica
        let data, label, color, bgColor, yAxisTitle, yAxisCallback;
        if (metricType === 'speed') {
            data = velocidades;
            label = 'Velocidad promedio (km/h)';
            color = '#3b82f6';
            bgColor = 'rgba(59, 130, 246, 0.7)';
            yAxisTitle = 'Velocidad promedio (km/h)';
            yAxisCallback = function(value) { return value + ' km/h'; };
        } else if (metricType === 'volume') {
            data = volumenes;
            label = 'Volumen de tráfico (# vehículos)';
            color = '#10b981';
            bgColor = 'rgba(16, 185, 129, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function(value) { return value.toLocaleString('es-CO'); };
        } else if (metricType === 'excess') {
            data = excesos;
            label = 'Vehículos con velocidad mayor a 80km/h';
            color = '#ef4444';
            bgColor = 'rgba(239, 68, 68, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function(value) { return value.toLocaleString('es-CO'); };
        }

        // Actualizar título
        const titleElement = document.getElementById('dailyChartTitle');
        if (titleElement) {
            titleElement.textContent = `Análisis diario · ${selectedSectorChartdays} (${label})`;
        }

        // Mostrar contenedor
        const container = document.getElementById('dailyChartContainer');
        if (container) {
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Crear gráfica
        const ctx = document.getElementById('dailyChart');
        if (ctx) {
            // Destruir gráfica anterior si existe
            if (window.dailyChart && typeof window.dailyChart.destroy === 'function') {
                window.dailyChart.destroy();
            }

            window.dailyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: fechas,
                    datasets: [{
                        label: label,
                        data: data,
                        backgroundColor: bgColor,
                        borderColor: color,
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function(event, elements) {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            selectedSectorCharthour = fechas[index];
                            showHoursChart();
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            displayColors: true,
                            callbacks: {
                                title: function(context) {
                                    const fechaIndex = context[0].dataIndex;
                                    return new Date(fechas[fechaIndex] + 'T00:00:00').toLocaleDateString('es-CO', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    });
                                },
                                label: function(context) {
                                    const value = context.parsed.y;
                                    if (metricType === 'speed') {
                                        return `${label}: ${value.toFixed(1)} km/h`;
                                    } else {
                                        return `${label}: ${value.toLocaleString('es-CO')} vehículos`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Fecha',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                font: {
                                    size: 11
                                }
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: yAxisTitle,
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                callback: yAxisCallback,
                                font: {
                                    size: 11
                                }
                            },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        console.log(`Gráfica diaria mostrada para el sector: ${selectedSectorChartdays} con métrica: ${metricType}`);

    } catch (error) {
        console.error('Error al mostrar gráfica diaria:', error);
    }
}

// Función para mostrar gráfica por hora
async function showHoursChart() {
    try {
        console.log('Mostrando gráfica por hora para fecha:', selectedSectorCharthour);

        // Ocultar contenedor
        const container = document.getElementById('hourChartContainer');
        if (container) {
            container.style.display = 'none';
        }

        // Obtener el tramo seleccionado de la gráfica diaria
        if (!selectedSectorChartdays) {
            console.error('No hay tramo seleccionado');
            return;
        }

        // Actualizar título
        const titleElement = document.getElementById('hourChartTitle');
        if (titleElement) {
            const fechaFormateada = new Date(selectedSectorCharthour + 'T00:00:00').toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            titleElement.textContent = `Análisis por hora · ${selectedSectorChartdays} (${fechaFormateada})`;
        }

        const loadingSpinner = document.getElementById('hourChartLoading');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }

        // Hacer petición al endpoint de horas
        const response = await fetch(`/api/clickhouse/road-analysis-dashboard-by-device?type=${selectedDeviceData.rawData.type}&device=${encodeURIComponent(selectedDeviceChartdays)}&date=${selectedSectorCharthour}`);

        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
        }

        // Mostrar contenedor
        if (container) {
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
            console.error('No hay datos disponibles para la fecha seleccionada');
            return;
        }

        // Preparar datos para la gráfica
        const horas = data.data.map(item => formatHora(item.hora));
        const totalRegistros = data.data.map(item => item.total_registros);
        const promedioVelocidad = data.data.map(item => item.promedio_velocidad);
        const registrosMayor80 = data.data.map(item => item.registros_mayor_80);

        // Obtener la métrica seleccionada
        const metricType = document.getElementById('metricFilter').value;

        // Determinar qué datos mostrar basado en la métrica
        let dataArray, label, color, bgColor, yAxisTitle, yAxisCallback;
        if (metricType === 'speed') {
            dataArray = promedioVelocidad;
            label = 'Velocidad promedio (km/h)';
            color = '#3b82f6';
            bgColor = 'rgba(59, 130, 246, 0.7)';
            yAxisTitle = 'Velocidad promedio (km/h)';
            yAxisCallback = function(value) { return value.toFixed(1) + ' km/h'; };
        } else if (metricType === 'volume') {
            dataArray = totalRegistros;
            label = 'Volumen de tráfico (# vehículos)';
            color = '#10b981';
            bgColor = 'rgba(16, 185, 129, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function(value) { return value.toLocaleString('es-CO'); };
        } else if (metricType === 'excess') {
            dataArray = registrosMayor80;
            label = 'Vehículos con velocidad mayor a 80km/h';
            color = '#ef4444';
            bgColor = 'rgba(239, 68, 68, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function(value) { return value.toLocaleString('es-CO'); };
        }

        // Crear gráfica
        const ctx = document.getElementById('hourChart');
        if (ctx) {
            // Destruir gráfica anterior si existe
            if (window.hourChart && typeof window.hourChart.destroy === 'function') {
                window.hourChart.destroy();
            }

            window.hourChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: horas,
                    datasets: [{
                        label: label,
                        data: dataArray,
                        backgroundColor: bgColor,
                        borderColor: color,
                        borderWidth: 1,
                        borderRadius: 4,
                        tension: 0.5,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            displayColors: true,
                            callbacks: {
                                title: function(context) {
                                    const horaIndex = context[0].dataIndex;
                                    return `Hora: ${horas[horaIndex]}`;
                                },
                                label: function(context) {
                                    const value = context.parsed.y;
                                    if (metricType === 'speed') {
                                        return `${label}: ${value.toFixed(1)} km/h`;
                                    } else {
                                        return `${label}: ${value.toLocaleString('es-CO')}`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Hora del día',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                font: {
                                    size: 11
                                }
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: yAxisTitle,
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                callback: yAxisCallback,
                                font: {
                                    size: 11
                                }
                            },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        console.log(`Gráfica por hora mostrada para el tramo: ${selectedSectorChartdays} en fecha: ${selectedSectorCharthour}`);

    } catch (error) {
        console.error('Error al mostrar gráfica por hora:', error);
    }
}

function formatHora(hora24) {
    const [hours, minutes] = hora24.split(':').map(Number);
    const fecha = new Date();
    fecha.setHours(hours);
    fecha.setMinutes(minutes);

    let horaFormateada = fecha.toLocaleTimeString('es-CO', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    // Si termina en ":00", lo quitamos
    horaFormateada = horaFormateada.replace(':00', '');
    
    // Normalizar el texto para evitar espacios o caracteres invisibles
    horaFormateada = horaFormateada
        .replace(/\s*a\.?\s*m\.?/i, ' a.m')  // reemplaza "a. m." / "a.m." / "a. m."
        .replace(/\s*p\.?\s*m\.?/i, ' p.m'); // reemplaza "p. m." / "p.m." / "p. m."
    return horaFormateada;
}

// Función para cerrar la gráfica por hora
function closeHoursChart() {
    const container = document.getElementById('hourChartContainer');
    if (container) {
        container.style.display = 'none';
    }

    // Destruir gráfica para liberar memoria
    if (window.hourChart && typeof window.hourChart.destroy === 'function') {
        window.hourChart.destroy();
        window.hourChart = null;
    }

    selectedSectorCharthour = '';

    console.log('Gráfica por hora cerrada');
}

// Función para cerrar la gráfica diaria
function closeDailyChart(clear = true) {
    const container = document.getElementById('dailyChartContainer');
    if (container) {
        container.style.display = 'none';
    }

    // Destruir gráfica para liberar memoria
    if (window.dailyChart && typeof window.dailyChart.destroy === 'function') {
        window.dailyChart.destroy();
        window.dailyChart = null;
    }

    if (clear) {
        selectedDeviceData = '';
        selectedSectorChartdays = ''
        selectedDeviceChartdays = ''
    }

    console.log('Gráfica diaria cerrada');
}

// Función para filtrar la tabla en tiempo real
function filterTable() {
    const filters = {
        department: document.getElementById('filterDepartment').value.toLowerCase(),
        municipality: document.getElementById('filterMunicipality').value.toLowerCase(),
        route: document.getElementById('filterRoute').value.toLowerCase(),
        tramo: document.getElementById('filterTramo').value.toLowerCase(),
        sector: document.getElementById('filterSector').value.toLowerCase(),
        pr: document.getElementById('filterPR').value.toLowerCase(),
    };

    const tbody = document.getElementById('sectorsTableBody');
    const rows = tbody.getElementsByTagName('tr');
    let visibleIndex = 1; // Contador para índices visibles

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        let showRow = true;

        // Verificar cada filtro (búsqueda parcial, insensible a mayúsculas)
        if (filters.department && !cells[1].textContent.toLowerCase().includes(filters.department)) {
            showRow = false;
        }
        if (filters.municipality && !cells[2].textContent.toLowerCase().includes(filters.municipality)) {
            showRow = false;
        }
        if (filters.route && !cells[3].textContent.toLowerCase().includes(filters.route)) {
            showRow = false;
        }
        if (filters.tramo && !cells[4].textContent.toLowerCase().includes(filters.tramo)) {
            showRow = false;
        }
        if (filters.sector && !cells[5].textContent.toLowerCase().includes(filters.sector)) {
            showRow = false;
        }
        if (filters.pr && !cells[6].textContent.toLowerCase().includes(filters.pr)) {
            showRow = false;
        }

        if (showRow) {
            // Actualizar el índice de la fila visible
            cells[0].innerHTML = `<strong>${visibleIndex}</strong>`;
            rows[i].style.display = '';
            visibleIndex++;
        } else {
            rows[i].style.display = 'none';
        }
    }
}

// ============================================
// FUNCIONES DEL MODAL DE CARGA
// ============================================

// Función para mostrar el modal de carga
function showLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
        // Focus management - hacer focus en el modal
        modal.focus();

    }
}

// Función para ocultar el modal de carga
function hideLoadingModal() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        // Restaurar scroll del body
        document.body.style.overflow = '';

    }
}