// ============================================
// SLIDER - CÓDIGO OPTIMIZADO Y RESPONSIVE
// ============================================

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    // Inicializar slider dinámico desde la base de datos
    loadSliderImages();

    // Inicializar slider estático (por si no hay imágenes dinámicas)
    const sliderWrapper = document.getElementById('sliderWrapper');

    if (sliderWrapper) {
        sliderWrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
        sliderWrapper.addEventListener('touchmove', handleTouchMove, { passive: true });
        sliderWrapper.addEventListener('touchend', handleTouchEnd);
    }

    document.addEventListener('keydown', handleKeyboard);

    startSliderInterval();

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            clearTimeout(sliderInterval);
        } else if (isPlaying) {
            startSliderInterval();
        }
    });

    updateSliderPosition();

    // Inicializar otras funcionalidades
    initScrollFeatures();
    initWhatsApp();
    initPeriodSelector();

    // Inicializar gráfica
    if (document.getElementById('trafficChart')) {
        updateTrafficChart();
    }

    // Cargar KPIs desde cache primero, luego del endpoint
    loadKPIsFromCache();
    loadKPIs(true);

    // Cerrar menú móvil al hacer clic fuera
    document.getElementById('mobileMenu').addEventListener('click', function (e) {
        if (e.target === this) {
            toggleMobileMenu();
        }
    });

    // Event listeners para los controles del slider
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    document.querySelector('.slider-nav-prev').addEventListener('click', () => changeSlide(-1));
    document.querySelector('.slider-nav-next').addEventListener('click', () => changeSlide(1));

    // Event listeners para los indicadores del slider
    document.querySelectorAll('.slider-dot').forEach((dot, index) => {
        dot.addEventListener('click', () => goToSlide(index));
    });

    // Event listeners para los botones del gráfico
    document.getElementById('chartTypeBarras').addEventListener('click', () => changeChartType('bar'));
    document.getElementById('chartTypeLineas').addEventListener('click', () => changeChartType('line'));

    // Initialize ARIA attributes for chart buttons
    document.getElementById('chartTypeBarras').setAttribute('aria-pressed', 'true');
    document.getElementById('chartTypeBarras').setAttribute('aria-label', 'Vista de barras activada');
    document.getElementById('chartTypeLineas').setAttribute('aria-pressed', 'false');
    document.getElementById('chartTypeLineas').setAttribute('aria-label', 'Cambiar a vista de líneas');

    // Cargar reportes públicos al inicializar
    loadPublicReports();

    // Event listeners para los botones de descarga (se manejan dinámicamente)
    // Los botones se crean dinámicamente, por lo que los event listeners se agregan en createReportCard

    // Optimización de performance
    if ('loading' in HTMLImageElement.prototype) {
        const images = document.querySelectorAll('img[loading="lazy"]');
        images.forEach(img => {
            img.src = img.dataset.src;
        });
    }
});

// Optimizar resize events
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (trafficChart) {
            trafficChart.resize();
        }
    }, 250);
});

let currentSlide = 0;
let totalSlides = 5;
let sliderInterval;
let isPlaying = true;
let touchStartX = 0;
let touchEndX = 0;

const slideDurations = {
    0: 8000,
    1: 5000,
    2: 5000,
    3: 5000,
    4: 5000
};

function togglePlayPause() {
    const btn = document.getElementById('playPauseBtn');
    const icon = document.getElementById('playPauseIcon');

    if (isPlaying) {
        clearTimeout(sliderInterval);
        icon.textContent = 'play_arrow';
        btn.classList.remove('playing');
        btn.setAttribute('aria-label', 'Reproducir slider automático');
        isPlaying = false;
    } else {
        startSliderInterval();
        icon.textContent = 'pause';
        btn.classList.add('playing');
        btn.setAttribute('aria-label', 'Pausar slider automático');
        isPlaying = true;
    }
}

function startSliderInterval() {
    clearTimeout(sliderInterval);
    const duration = slideDurations[currentSlide] || 5000;

    sliderInterval = setTimeout(() => {
        changeSlide(1);
    }, duration);
}

function updateSliderPosition() {
    const sliderWrapper = document.getElementById('sliderWrapper');
    const translateX = -(currentSlide * 20);
    sliderWrapper.style.transform = `translateX(${translateX}%)`;

    // Actualizar indicadores con ARIA
    const dots = document.querySelectorAll('.slider-dot');
    dots.forEach((dot, index) => {
        const isActive = index === currentSlide;
        dot.classList.toggle('active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Actualizar slides
    document.querySelectorAll('.slide').forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
    });
}

function changeSlide(direction) {
    currentSlide += direction;

    if (currentSlide >= totalSlides) {
        currentSlide = 0;
    } else if (currentSlide < 0) {
        currentSlide = totalSlides - 1;
    }

    updateSliderPosition();
    resetSliderInterval();
}

function goToSlide(slideIndex) {
    if (slideIndex < 0 || slideIndex >= totalSlides) return;
    currentSlide = slideIndex;
    updateSliderPosition();
    resetSliderInterval();
}

function resetSliderInterval() {
    if (isPlaying) {
        clearTimeout(sliderInterval);
        startSliderInterval();
    }
}

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
}

function handleTouchMove(e) {
    touchEndX = e.touches[0].clientX;
}

function handleTouchEnd() {
    const swipeThreshold = 50;
    if (touchStartX - touchEndX > swipeThreshold) {
        changeSlide(1);
    }
    if (touchEndX - touchStartX > swipeThreshold) {
        changeSlide(-1);
    }
}

function handleKeyboard(e) {
    if (e.key === 'ArrowLeft') {
        changeSlide(-1);
    } else if (e.key === 'ArrowRight') {
        changeSlide(1);
    } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        togglePlayPause();
    }
}

// ============================================
// FUNCIONALIDAD DEL SLIDER DINÁMICO
// ============================================

// Función para cargar imágenes del slider desde la base de datos
async function loadSliderImages() {
    try {
        console.log('🔄 Cargando imágenes del slider desde la base de datos...');
        const response = await fetch('/api/slider');

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
        }

        const images = await response.json();
        console.log(`✅ Cargadas ${images.length} imágenes del slider:`, images);

        if (images && images.length > 0) {
            // Si hay imágenes en la base de datos, crear slider dinámico
            console.log('🎯 Creando slider dinámico con imágenes de BD');
            createDynamicSlider(images);
        } else {
            // Si no hay imágenes, mostrar slider estático por defecto
            console.log('📄 No hay imágenes en la base de datos, usando slider estático');
            showStaticSlider();
        }
    } catch (error) {
        console.error('❌ Error al cargar imágenes del slider:', error);
        // En caso de error, mostrar slider estático
        showStaticSlider();
    }
}

// Función para crear slider dinámico desde la base de datos
function createDynamicSlider(images) {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) {
        console.error('No se encontró el contenedor del slider');
        return;
    }

    // Limpiar contenido existente
    sliderWrapper.innerHTML = window.safeHTML('');

    // Filtrar solo imágenes activas y ordenar por posición
    const activeImages = images.filter(img => img.is_active).sort((a, b) => a.position - b.position);

    if (activeImages.length === 0) {
        console.log('No hay imágenes activas, mostrando slider estático');
        showStaticSlider();
        return;
    }

    // Crear slides dinámicos — MISMO DISEÑO APROBADO POR EL CLIENTE
    // Se mantiene exactamente la misma estructura HTML/CSS del slider estático
    activeImages.forEach((image, index) => {
        const slide = document.createElement('div');
        slide.className = `slide slide-dynamic ${index === 0 ? 'active' : ''}`;

        // Aplicar color de fondo desde la BD (gradiente CSS almacenado en bg_color)
        const defaultGradient = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)';
        const bgGradient = image.bg_color || defaultGradient;
        slide.style.background = bgGradient;

        // Determinar color de texto desde la BD (o auto-detectar si no está configurado)
        const savedTextColor = image.text_color || null;
        const isLightBg = bgGradient.includes('#f0f9ff') || bgGradient.includes('#e0f2fe') || bgGradient.includes('ffffff');
        const resolvedTextColor = savedTextColor || (isLightBg ? '#0f172a' : '#ffffff');
        const isDark = resolvedTextColor === '#ffffff' || resolvedTextColor.toLowerCase() === 'white' ||
            (resolvedTextColor.startsWith('#') && parseInt(resolvedTextColor.slice(1), 16) > 0x888888 === false);
        const textColor = `color: ${resolvedTextColor};`;
        const subtitleColor = `color: ${resolvedTextColor}; opacity: 0.9;`;
        const badgeBg = (resolvedTextColor === '#ffffff' || resolvedTextColor === 'white')
            ? 'background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);'
            : '';
        const accentColor = (resolvedTextColor === '#ffffff' || resolvedTextColor === 'white')
            ? '#fbbf24' : 'var(--color-primary)';

        // Si hay imagen real (no placeholder), se aplica como fondo sutil encima del gradiente
        const hasRealImage = image.image_path && image.image_path !== 'placeholder.jpg';

        // Misma estructura HTML exacta del slider estático aprobado
        slide.innerHTML = window.safeHTML(`
            <div class="slide-content">
                <div class="hero-content">
                    <div class="hero-badge" style="${badgeBg}">
                        <span style="width: 8px; height: 8px; background: ${(resolvedTextColor === '#ffffff' || resolvedTextColor === 'white') ? '#10b981' : 'var(--color-primary)'}; border-radius: 50%; animation: pulse 2s infinite;" aria-hidden="true"></span>
                        <span style="color:${image.badge_color||'inherit'}">${image.badge_text || 'Sistema en línea • Monitoreo 24/7'}</span>
                    </div>

                    <h1 class="hero-title" style="${textColor}">
                        ${image.title || 'Sistema de Vigilancia Inteligente'}<br>
                        <span style="color: ${accentColor};">${image.alt_text || 'de Infraestructura Vial'}</span>
                    </h1>

                    <p class="hero-subtitle" style="${subtitleColor}">
                        ${image.description || 'Accede a dashboards, reportes y microdatos para tomar decisiones informadas.'}
                    </p>
                </div>
            </div>
            ${hasRealImage ? `<div class="slide-background" style="position:absolute;top:0;left:0;width:100%;height:100%;background-image:url('/uploads/slider/${image.image_path}');background-size:cover;background-position:center;z-index:-1;opacity:${(image.image_opacity !== undefined && image.image_opacity !== null) ? image.image_opacity : 0.35};" aria-hidden="true"></div>` : ''}
        `);

        sliderWrapper.appendChild(slide);
    });

    // Actualizar variables globales del slider
    const newTotalSlides = activeImages.length;
    const newCurrentSlide = 0;

    // Solo actualizar si hay cambios para evitar el error de constante
    if (totalSlides !== newTotalSlides) {
        totalSlides = newTotalSlides;
    }
    if (currentSlide !== newCurrentSlide) {
        currentSlide = newCurrentSlide;
    }

    // Actualizar indicadores del slider
    updateSliderIndicators(totalSlides);

    // Reiniciar intervalo del slider
    resetSliderInterval();

    console.log(`Slider dinámico creado con ${totalSlides} slides`);
}

// Función para mostrar slider estático por defecto
function showStaticSlider() {
    const sliderWrapper = document.getElementById('sliderWrapper');
    if (!sliderWrapper) return;

    // Restaurar contenido estático original
    sliderWrapper.innerHTML = window.safeHTML(`
        <!-- Slide 1 - Principal -->
        <div class="slide slide-1 active">
            <div class="slide-content">
                <div class="hero-content">
                    <div class="hero-badge">
                        <span style="width: 8px; height: 8px; background: var(--color-primary); border-radius: 50%; animation: pulse 2s infinite;" aria-hidden="true"></span>
                        Sistema en línea • Monitoreo 24/7
                    </div>

                    <h1 id="hero-title" class="hero-title">
                        Consulta el estado del tráfico en los puntos de monitoreo del proyecto<br>
                        <span style="color: var(--color-primary);">Vías inteligentes en las carreteras nacionales.</span>
                    </h1>

                    <p class="hero-subtitle">
                        Accede a dashboards, reportes y microdatos para tomar decisiones informadas.
                    </p>
                </div>
            </div>
        </div>
        <!--
        <!-- Slide 2 - Monitoreo en Tiempo Real -->
        <div class="slide slide-2">
            <div class="slide-content">
                <div class="hero-content">
                    <div class="hero-badge" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                        <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;" aria-hidden="true"></span>
                        Linea #767
                    </div>

                    <h1 class="hero-title" style="color: white;">
                        Monitoreo en tiempo real<br>
                        <span style="color: #10b981;">de infraestructura vial</span>
                    </h1>

                    <p class="hero-subtitle" style="color: rgba(255,255,255,0.9);">
                        Más de <strong>237 puntos implementados a lo largo de los corredores viales</strong> conectados en toda Colombia,
                        procesando datos continuamente para garantizar la seguridad vial.
                    </p>
                </div>
            </div>
        </div>

        <!-- Slide 3 - Tecnología de Punta -->
        <div class="slide slide-3">
            <div class="slide-content">
                <div class="hero-content">
                    <div class="hero-badge" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                        <span style="width: 8px; height: 8px; background: white; border-radius: 50%;" aria-hidden="true"></span>
                        Innovación y tecnología
                    </div>

                    <h1 class="hero-title" style="color: white;">
                        Tecnología de punta<br>
                        <span style="color: #fbbf24;">en análisis de datos</span>
                    </h1>

                    <p class="hero-subtitle" style="color: rgba(255,255,255,0.9);">
                        Inteligencia artificial y machine learning aplicados al análisis
                        predictivo de tráfico y mantenimiento preventivo de vías.
                    </p>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: clamp(0.75rem, 2.5vw, 1.5rem); margin-top: clamp(1.25rem, 3vw, 1.75rem); max-width: 800px; margin-left: auto; margin-right: auto; padding: 0 1rem;" role="list" aria-label="Características técnicas del sistema">
                        <div style="text-align: center;" role="listitem">
                            <svg viewBox="0 0 24 24" style="width: clamp(32px, 7vw, 48px); height: clamp(32px, 7vw, 48px); margin-bottom: 0.5rem; fill: currentColor;" aria-hidden="true" role="img">
                                <path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 1.58l.06.85 2.07.68a.5.5 0 0 0 .61-.37l.49-2.06a.5.5 0 0 0-.34-.61l-1.85-.6-.6-1.85a.5.5 0 0 0-.61-.34l-2.06.49a.5.5 0 0 0-.37.61z"/>
                                <path d="M10.5 20l-1.21-2.17A8 8 0 0 0 8 15.58l.05-.85-2.07-.68a.5.5 0 0 0-.61.37l-.49 2.06a.5.5 0 0 0 .34.61l1.85.6.6 1.85a.5.5 0 0 0 .61.34l2.06-.49a.5.5 0 0 0 .37-.61z"/>
                                <path d="M10.5 4l1.21 2.17A8 8 0 0 0 12 8.42l-.05.85 2.07.68a.5.5 0 0 0 .61-.37l.49-2.06a.5.5 0 0 0-.34-.61l-1.85-.6-.6-1.85a.5.5 0 0 0-.61-.34l-2.06.49a.5.5 0 0 0-.37.61z"/>
                                <path d="M3.62 15.43l1.23-1.85a8 8 0 0 0 .22-1.58l-.06-.85-2.07-.68a.5.5 0 0 0-.61.37l-.49 2.06a.5.5 0 0 0 .34.61l1.85.6.6 1.85a.5.5 0 0 0 .61.34l2.06-.49a.5.5 0 0 0 .37-.61z"/>
                                <circle cx="12" cy="12" r="4"/>
                            </svg>
                            <div style="font-size: clamp(0.95rem, 2.8vw, 1.25rem); font-weight: bold;">99.9%</div>
                            <div style="font-size: clamp(0.7rem, 1.8vw, 0.875rem); opacity: 0.9;">Disponibilidad del sistema</div>
                        </div>
                        <div style="text-align: center;" role="listitem">
                            <svg viewBox="0 0 24 24" style="width: clamp(32px, 7vw, 48px); height: clamp(32px, 7vw, 48px); margin-bottom: 0.5rem; fill: currentColor;" aria-hidden="true" role="img">
                                <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                                <path d="M10 17l-3.5-3.5 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                            </svg>
                            <div style="font-size: clamp(0.95rem, 2.8vw, 1.25rem); font-weight: bold;">Cloud</div>
                            <div style="font-size: clamp(0.7rem, 1.8vw, 0.875rem); opacity: 0.9;">Infraestructura en la nube</div>
                        </div>
                        <div style="text-align: center;" role="listitem">
                            <svg viewBox="0 0 24 24" style="width: clamp(32px, 7vw, 48px); height: clamp(32px, 7vw, 48px); margin-bottom: 0.5rem; fill: currentColor;" aria-hidden="true" role="img">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                                <path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                            </svg>
                            <div style="font-size: clamp(0.95rem, 2.8vw, 1.25rem); font-weight: bold;">Seguro</div>
                            <div style="font-size: clamp(0.7rem, 1.8vw, 0.875rem); opacity: 0.9;">Certificado de seguridad</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Slide 4 - Impacto Nacional -->
        <div class="slide slide-4">
            <div class="slide-content">
                <div class="hero-content">
                    <div class="hero-badge" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                        <span style="width: 8px; height: 8px; background: #fbbf24; border-radius: 50%;" aria-hidden="true"></span>
                        Alcance nacional
                    </div>

                    <h1 class="hero-title" style="color: white;">
                        Impacto a Nivel<br>
                        <span style="color: #fbbf24;">nacional</span>
                    </h1>

                    <p class="hero-subtitle" style="color: rgba(255,255,255,0.9);">
                        Cobertura en <strong>24 departamentos</strong> de Colombia,
                        mejorando la seguridad vial y la calidad de la infraestructura.
                    </p>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: clamp(0.75rem, 2.5vw, 1.5rem); margin-top: clamp(1.5rem, 4vw, 2rem); max-width: 800px; margin-left: auto; margin-right: auto; padding: 0 1rem;" role="list" aria-label="Cobertura nacional del sistema">
                        <div style="text-align: center; background: rgba(255,255,255,0.1); padding: clamp(0.875rem, 2.5vw, 1.5rem); border-radius: 12px;" role="listitem">
                            <div style="font-size: clamp(1.75rem, 5vw, 2.5rem); font-weight: bold; margin-bottom: 0.5rem;">256</div>
                            <div style="font-size: clamp(0.75rem, 2vw, 0.95rem); opacity: 0.9;">Dispositivos</div>
                        </div>
                        <div style="text-align: center; background: rgba(255,255,255,0.1); padding: clamp(0.875rem, 2.5vw, 1.5rem); border-radius: 12px;" role="listitem">
                            <div style="font-size: clamp(1.75rem, 5vw, 2.5rem); font-weight: bold; margin-bottom: 0.5rem;">6K+</div>
                            <div style="font-size: clamp(0.75rem, 2vw, 0.95rem); opacity: 0.9;">KM de cobertura</div>
                        </div>
                        <div style="text-align: center; background: rgba(255,255,255,0.1); padding: clamp(0.875rem, 2.5vw, 1.5rem); border-radius: 12px;" role="listitem">
                            <div style="font-size: clamp(1.75rem, 5vw, 2.5rem); font-weight: bold; margin-bottom: 0.5rem;">109</div>
                            <div style="font-size: clamp(0.75rem, 2vw, 0.95rem); opacity: 0.9;">Sectores viales</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Slide 5 - Participación Ciudadana -->
        <div class="slide slide-5">
            <div class="slide-content">
                <div class="hero-content">
                    <div class="hero-badge" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                        <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;" aria-hidden="true"></span>
                        Acceso Ciudadano
                    </div>

                    <h1 class="hero-title" style="color: white;">
                        Participa y Accede<br>
                        <span style="color: #fbbf24;">a la Información Pública</span>
                    </h1>

                    <p class="hero-subtitle" style="color: rgba(255,255,255,0.9);">
                        Transparencia y acceso a datos abiertos sobre el estado
                        de la infraestructura vial en Colombia. Tu derecho a saber.
                    </p>
                </div>
            </div>
        </div>
    `);

    // Actualizar variables globales
    const newTotalSlides = 5;
    const newCurrentSlide = 0;

    // Solo actualizar si hay cambios para evitar el error de constante
    if (totalSlides !== newTotalSlides) {
        totalSlides = newTotalSlides;
    }
    if (currentSlide !== newCurrentSlide) {
        currentSlide = newCurrentSlide;
    }

    // Actualizar indicadores
    updateSliderIndicators(totalSlides);

    console.log('Slider estático restaurado');
}

// Función para actualizar indicadores del slider
function updateSliderIndicators(totalSlidesCount) {
    const indicatorsContainer = document.querySelector('.slider-indicators');
    if (!indicatorsContainer) return;

    // Limpiar indicadores existentes
    indicatorsContainer.innerHTML = window.safeHTML('');

    // Crear nuevos indicadores
    for (let i = 0; i < totalSlidesCount; i++) {
        const dot = document.createElement('button');
        dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Ir a slide ${i + 1}`);
        dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        dot.addEventListener('click', () => goToSlide(i));
        indicatorsContainer.appendChild(dot);
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

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

function scrollToSection(sectionId) {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = '';

    let targetElement;
    if (sectionId === 'inicio') {
        targetElement = document.querySelector('.hero');
    } else if (sectionId === 'participacion') {
        targetElement = document.querySelector('.cta');
    } else {
        targetElement = document.getElementById(sectionId);
    }

    if (targetElement) {
        const navbarHeight = document.querySelector('.navbar').offsetHeight;
        const targetPosition = targetElement.offsetTop - navbarHeight;

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

function goToDashboard() {
    window.location.href = 'dashboard-sectores-viales.html';
}

function initScrollFeatures() {
    const scrollProgress = document.getElementById('scrollProgress');
    const scrollToTopBtn = document.getElementById('scrollToTop');

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = (window.scrollY / windowHeight) * 100;
                scrollProgress.style.width = scrolled + '%';

                if (window.scrollY > 300) {
                    scrollToTopBtn.classList.add('visible');
                } else {
                    scrollToTopBtn.classList.remove('visible');
                }

                ticking = false;
            });

            ticking = true;
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function initWhatsApp() {
    const whatsappButton = document.getElementById('whatsappButton');

    if (!whatsappButton) return;

    const CONFIG = {
        phoneNumber: '573017057400',
        message: '¡Hola! Vi el Sistema VIITS de INVIAS y me gustaría obtener más información.',
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };

    whatsappButton.addEventListener('click', function (e) {
        e.preventDefault();
        const encodedMessage = encodeURIComponent(CONFIG.message);
        let whatsappURL;

        if (CONFIG.isMobile) {
            whatsappURL = `whatsapp://send?phone=${CONFIG.phoneNumber}&text=${encodedMessage}`;
        } else {
            whatsappURL = `https://wa.me/${CONFIG.phoneNumber}?text=${encodedMessage}`;
        }

        window.open(whatsappURL, '_blank');
    });

    setTimeout(() => {
        whatsappButton.style.opacity = '0';
        whatsappButton.style.display = 'flex';
        setTimeout(() => {
            whatsappButton.style.transition = 'opacity 0.5s ease';
            whatsappButton.style.opacity = '1';
        }, 50);
    }, 2000);
}

// ============================================
// DASHBOARD Y GRÁFICAS
// ============================================

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
            const vehicleTypeSelector = document.getElementById('vehicleTypeSelector').value;
            const response = await fetch(`/api/clickhouse/road-analysis-dashboard?startDate=${rangeDate.startDate}&endDate=${rangeDate.endDate}&vehicleType=${vehicleTypeSelector}`);

            // ⚠️ Verificar si la respuesta es exitosa (status 200–299)
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // ✅ Guardar respuesta en localStorage
                const cacheData = {
                    data: data.data,
                    fechas: data.fechas,
                    timestamp: Date.now()
                };
                localStorage.setItem('kpiDataCache', JSON.stringify(cacheData));

                // ✅ Generar lista de estados únicos
                generateDepartmentList(data.data);

                // ✅ Procesar datos y salir del bucle
                processKPIData(cacheData);

                // ✅ Procesar datos para la grafica
                updateTrafficChart()
                success = true;
                hideLoadingModal();
            } else {
                hideLoadingModal();
                throw new Error('Respuesta vacía o sin datos');
            }

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
    const periodSelector = document.getElementById('periodSelector').value;
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
        const departmentSelector = document.getElementById('departmentSelector');
        if (departmentSelector) {
            // Limpiar opciones existentes excepto "Todos los departamentos"
            const firstOption = departmentSelector.querySelector('option[value="all"]');
            departmentSelector.innerHTML = window.safeHTML('');

            // Agregar opción "Todos los departamentos"
            if (firstOption) {
                departmentSelector.appendChild(firstOption);
            } else {
                const allOption = document.createElement('option');
                allOption.value = 'all';
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
    const dia = ayer.toLocaleDateString('es-ES', { weekday: 'long' });
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
            if (i == 2) {
                kpi = data.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            }
            kpiValue.innerHTML = window.safeHTML(
                `${kpi} <span style="font-size: clamp(1rem, 3vw, 1.25rem); font-weight: 500; color: #6b7280;">${unit}</span>`
            );
        }

        // KPI 2: promedio vs anteayer
        const kpiTrend = elementKpiCart.querySelector('.kpi-trend');
        if (kpiTrend && dataTrend) {
            const icon = dataTrend.esAumento ? 'trending_up' : 'trending_down';
            const color = dataTrend.esAumento ? '#10b981' : '#ef4444';
            const signo = dataTrend.esAumento ? '+' : '-';
            kpiTrend.innerHTML = window.safeHTML(`
                <i class="material-icons" style="color: ${color}; font-size: 18px;" aria-hidden="true">${icon}</i>
                <span style="color: ${color}; font-weight: 600;">${signo}${dataTrend.porcentaje}%</span>
                <span style="color: #6b7280;">vs anteayer</span>
            `);
            kpiTrend.className = `kpi-trend ${dataTrend.esAumento ? 'positive' : 'negative'}`;
        }

        // KPI 2: promedio vs hace 8 días
        const kpiTrend8 = elementKpiCart.querySelector('.kpi-trend-8');
        if (kpiTrend8 && dataTrend8) {
            const icon = dataTrend8.esAumento ? 'trending_up' : 'trending_down';
            const color = dataTrend8.esAumento ? '#10b981' : '#ef4444';
            const signo = dataTrend8.esAumento ? '+' : '-';
            kpiTrend8.innerHTML = window.safeHTML(`
                <i class="material-icons" style="color: ${color}; font-size: 18px;" aria-hidden="true">${icon}</i>
                <span style="color: ${color}; font-weight: 600;">${signo}${dataTrend8.porcentaje}%</span>
                <span style="color: #6b7280;">vs el ${day} pasado</span>
            `);
            kpiTrend8.className = `kpi-trend-8 ${dataTrend8.esAumento ? 'positive' : 'negative'}`;
        }
    }
}

let sectorsData = [
    { label: 'S_1', velocidad: 76.6, volumen: 7854, motos: 2150, pesados: 1935, pr: '20+0187', sector: 'Cali - Cruce Ruta 40 (Loboguerrero)', departamento: 'Valle del Cauca' },
    { label: 'S_2', velocidad: 70.6, volumen: 4293, motos: 1331, pesados: 925, pr: '104+0936', sector: 'Mediacanoa - Ansermanuevo', departamento: 'Valle del Cauca' },
    { label: 'S_3', velocidad: 52.1, volumen: 6365, motos: 1856, pesados: 998, pr: '15+0521', sector: 'Calarcá - Cajamarca', departamento: 'Quindío' },
    { label: 'S_4', velocidad: 84.1, volumen: 3099, motos: 960, pesados: 768, pr: '46+0284', sector: 'Puerto Salgar - Río Ermitaño', departamento: 'Cundinamarca' },
    { label: 'S_5', velocidad: 51.6, volumen: 3063, motos: 961, pesados: 680, pr: '9+0074', sector: 'Cali - Yumbo', departamento: 'Valle del Cauca' },
    { label: 'S_6', velocidad: 67.2, volumen: 6167, motos: 1900, pesados: 1393, pr: '37+0263', sector: 'El Crucero - Aguazul', departamento: 'Boyacá' },
    { label: 'S_7', velocidad: 58.7, volumen: 5028, motos: 1673, pesados: 1202, pr: '12+0320', sector: 'Yopal - Paz de Ariporo', departamento: 'Casanare' },
    { label: 'S_8', velocidad: 57.2, volumen: 3351, motos: 1051, pesados: 635, pr: '3+0387', sector: 'La Palmera - Presidente', departamento: 'Santander' },
    { label: 'S_9', velocidad: 84.6, volumen: 3993, motos: 1118, pesados: 779, pr: '1+0629', sector: 'Yopal - Paz de Ariporo', departamento: 'Casanare' },
    { label: 'S_10', velocidad: 76.7, volumen: 2540, motos: 711, pesados: 389, pr: '2+0718', sector: 'Yopal - Paz de Ariporo', departamento: 'Casanare' },
    { label: 'S_11', velocidad: 60.6, volumen: 2369, motos: 688, pesados: 426, pr: '5+0940', sector: 'Ortega - Guamo', departamento: 'Tolima' },
    { label: 'S_12', velocidad: 51.5, volumen: 5104, motos: 1606, pesados: 873, pr: '12+0391', sector: 'Glorieta Cencar - Aeropuerto - Cruce Ruta 25', departamento: 'Valle del Cauca' },
    { label: 'S_13', velocidad: 70.3, volumen: 6404, motos: 2058, pesados: 1161, pr: '17+0415', sector: 'Palmaseca - El Cerrito', departamento: 'Valle del Cauca' },
    { label: 'S_14', velocidad: 72.0, volumen: 6777, motos: 1801, pesados: 1185, pr: '32+0639', sector: 'Barbosa - Tunja', departamento: 'Boyacá' },
    { label: 'S_15', velocidad: 76.9, volumen: 4786, motos: 1311, pesados: 905, pr: '48+0691', sector: 'La Victoria - Cartago', departamento: 'Valle del Cauca' },
    { label: 'S_16', velocidad: 79.0, volumen: 5931, motos: 1662, pesados: 1048, pr: '7+0636', sector: 'Variante de Popayán', departamento: 'Cauca' },
    { label: 'S_17', velocidad: 82.7, volumen: 3569, motos: 1161, pesados: 575, pr: '1+0667', sector: 'Cerritos - La Virginia', departamento: 'Risaralda' },
    { label: 'S_18', velocidad: 62.9, volumen: 2508, motos: 691, pesados: 577, pr: '37+0234', sector: 'Tarazá - Caucasia', departamento: 'Antioquia' },
    { label: 'S_19', velocidad: 53.4, volumen: 2937, motos: 818, pesados: 552, pr: '111+0940', sector: 'Mojarras - Popayán', departamento: 'Cauca' },
    { label: 'S_20', velocidad: 71.3, volumen: 3178, motos: 1057, pesados: 783, pr: '43+0214', sector: 'Planeta Rica - La Ye', departamento: 'Cordoba' },
    { label: 'S_21', velocidad: 78.0, volumen: 6693, motos: 2000, pesados: 1021, pr: '33+0116', sector: 'Puente Nacional - San Gil', departamento: 'Boyacá' },
    { label: 'S_22', velocidad: 72.6, volumen: 7550, motos: 2641, pesados: 1616, pr: '10+0209', sector: 'Paso Nacional por Cereté', departamento: 'Cordoba' },
    { label: 'S_23', velocidad: 54.8, volumen: 7747, motos: 2061, pesados: 1766, pr: '3+0238', sector: 'Variante de Popayán', departamento: 'Cauca' },
    { label: 'S_24', velocidad: 86.3, volumen: 7233, motos: 2136, pesados: 1692, pr: '81+0369', sector: 'Hoyo Rico - Los Llanos', departamento: 'Antioquia' },
    { label: 'S_25', velocidad: 62.6, volumen: 5568, motos: 1633, pesados: 1210, pr: '10+0958', sector: 'San Juan de Pasto - Cano', departamento: 'Nariño' },
    { label: 'S_26', velocidad: 80.0, volumen: 7462, motos: 2473, pesados: 1347, pr: '56+0540', sector: 'Palmira - Buga', departamento: 'Valle del Cauca' },
    { label: 'S_27', velocidad: 76.8, volumen: 2148, motos: 557, pesados: 378, pr: '41+0429', sector: 'Límites Cauca - Palmira', departamento: 'Valle del Cauca' },
    { label: 'S_28', velocidad: 88.1, volumen: 4952, motos: 1462, pesados: 812, pr: '3+0421', sector: 'Armenia - Montenegro - Alcalá', departamento: 'Quindío' },
    { label: 'S_29', velocidad: 81.3, volumen: 6164, motos: 1637, pesados: 1294, pr: '8+0681', sector: 'Intersección El Pollo - Intersección El Mandarino (3)', departamento: 'Risaralda' },
    { label: 'S_30', velocidad: 55.0, volumen: 7132, motos: 2193, pesados: 1308, pr: '71+0448', sector: 'Río Desbaratado - Palmira', departamento: 'Valle del Cauca' },
    { label: 'S_31', velocidad: 59.2, volumen: 5447, motos: 1892, pesados: 1215, pr: '2+0164', sector: 'Armenia - La Línea', departamento: 'Quindío' },
    { label: 'S_32', velocidad: 89.6, volumen: 7971, motos: 2475, pesados: 1812, pr: '112+0605', sector: 'Cruce Ruta 40 (Loboguerrero) - Buga', departamento: 'Valle del Cauca' },
    { label: 'S_33', velocidad: 70.4, volumen: 4404, motos: 1411, pesados: 704, pr: '49+0682', sector: 'Córdoba - Cruce Ruta 40 (Loboguerrero)', departamento: 'Valle del Cauca' },
    { label: 'S_34', velocidad: 78.1, volumen: 2133, motos: 658, pesados: 415, pr: '15+0378', sector: 'Intersección Citronela - Córdoba', departamento: 'Valle del Cauca' },
    { label: 'S_35', velocidad: 62.8, volumen: 5731, motos: 1754, pesados: 1302, pr: '56+0661', sector: 'Ubaté - Puente Nacional', departamento: 'Boyacá' },
    { label: 'S_36', velocidad: 87.7, volumen: 5465, motos: 1594, pesados: 1110, pr: '82+1982', sector: 'San Gil - Bucaramanga', departamento: 'Santander' },
    { label: 'S_37', velocidad: 61.3, volumen: 3199, motos: 904, pesados: 525, pr: '36+0241', sector: 'Zipaquirá - Ubaté', departamento: 'Cundinamarca' },
    { label: 'S_38', velocidad: 67.5, volumen: 7849, motos: 2625, pesados: 1720, pr: '100+0545', sector: 'Puente Nacional - San Gil', departamento: 'Santander' },
    { label: 'S_39', velocidad: 81.4, volumen: 2833, motos: 795, pesados: 641, pr: '16+0604', sector: 'San Gil - Bucaramanga', departamento: 'Santander' },
    { label: 'S_40', velocidad: 59.1, volumen: 2508, motos: 631, pesados: 394, pr: '84+2171', sector: 'San Gil - Bucaramanga', departamento: 'Santander' },
    { label: 'S_41', velocidad: 75.3, volumen: 2959, motos: 860, pesados: 476, pr: '23+0931', sector: 'Río Negro - San Alberto', departamento: 'Santander' },
    { label: 'S_42', velocidad: 83.8, volumen: 3598, motos: 1002, pesados: 868, pr: '40+0624', sector: 'Río Ermitaño - La Lizama', departamento: 'Santander' },
    { label: 'S_43', velocidad: 63.2, volumen: 4640, motos: 1623, pesados: 870, pr: '42+0272', sector: 'Río Ermitaño - La Lizama', departamento: 'Santander' },
    { label: 'S_44', velocidad: 65.6, volumen: 6014, motos: 1709, pesados: 1195, pr: '77+0786', sector: 'La Mata - San Roque', departamento: 'Cesar' },
    { label: 'S_45', velocidad: 56.2, volumen: 6338, motos: 1677, pesados: 1250, pr: '64+0520', sector: 'San Alberto - La Mata', departamento: 'Cesar' },
    { label: 'S_46', velocidad: 86.0, volumen: 2810, motos: 937, pesados: 594, pr: '67+0695', sector: 'La Lizama -Rio Sogamoso', departamento: 'Santander' },
    { label: 'S_47', velocidad: 58.5, volumen: 3583, motos: 1246, pesados: 606, pr: '65+0387', sector: 'Puerto Salgar - Río Ermitaño', departamento: 'Cundinamarca' },
    { label: 'S_48', velocidad: 84.7, volumen: 6226, motos: 2049, pesados: 1106, pr: '0+0098', sector: 'Cruce Puerto Araujo - Landázuri', departamento: 'Santander' },
    { label: 'S_49', velocidad: 89.0, volumen: 2575, motos: 780, pesados: 550, pr: '36+0786', sector: 'Belén - Sácama', departamento: 'Boyacá' },
    { label: 'S_50', velocidad: 83.1, volumen: 4862, motos: 1591, pesados: 982, pr: '15+0185', sector: 'Ocaña - Alto del Pozo', departamento: 'Norte de Santander' },
    { label: 'S_51', velocidad: 81.4, volumen: 5007, motos: 1541, pesados: 767, pr: '19+0565', sector: 'Guachucal - Ipiales', departamento: 'Nariño' },
    { label: 'S_52', velocidad: 63.7, volumen: 3589, motos: 1117, pesados: 854, pr: '111+0721', sector: 'Puente Valencia sobre el río Cauca - Cali', departamento: 'Valle del Cauca' },
    { label: 'S_53', velocidad: 50.6, volumen: 5669, motos: 1834, pesados: 931, pr: '0+0381', sector: 'Valledupar - San Juan del Cesar', departamento: 'Cesar' },
    { label: 'S_54', velocidad: 71.5, volumen: 7911, motos: 2675, pesados: 1261, pr: '32+0138', sector: 'Palmira - Buga', departamento: 'Valle del Cauca' },
    { label: 'S_55', velocidad: 61.1, volumen: 5657, motos: 1866, pesados: 973, pr: '2+0486', sector: 'Valledupar - La Paz', departamento: 'Cesar' },
    { label: 'S_56', velocidad: 71.3, volumen: 3596, motos: 1098, pesados: 552, pr: '21+0000', sector: 'Buenavista - Cuestecitas', departamento: 'La Guajira' },
    { label: 'S_57', velocidad: 87.0, volumen: 6619, motos: 1896, pesados: 1324, pr: '38+0425', sector: 'Canoas - Cuestecitas', departamento: 'La Guajira' }
];

let trafficChart = null;
let filteredTrafficData = []; // Variable global para almacenar datos filtrados
let selectedSectorChartdays = ''
let selectedSectorCharthour = ''
let selectedDeviceChartdays = ''

function updateTrafficChart() {
    const metricType = document.getElementById('metricSelector').value;
    const vehicleType = document.getElementById('vehicleTypeSelector').value;
    const selectedDept = document.getElementById('departmentSelector').value;

    // Obtener datos del cache
    const cachedData = localStorage.getItem('kpiDataCache');
    if (!cachedData) {
        console.log('No hay datos en cache para la gráfica');
        return;
    }

    const cache = JSON.parse(cachedData);
    let filteredData = cache.data;

    // Filtrar por departamento si no es "all"
    if (selectedDept !== 'all') {
        filteredData = cache.data.filter(tramo =>
            tramo.estado.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === selectedDept
        );
    }

    // Agrupar por tramo
    const datosPorSector = {};
    filteredData.forEach(tramo => {
        let key = tramo.sector;
        if (metricType === 'volume' || metricType === 'excess') {
            key += '_' + tramo.pr_aprox;
        }
        if (!datosPorSector[key]) {
            datosPorSector[key] = {
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

        datosPorSector[key].velocidadPonderada += velocidad * registros;
        datosPorSector[key].registrosPonderados += registros;
        datosPorSector[key].volumenTotal += registros;
        datosPorSector[key].excesoTotal += exceso;
        datosPorSector[key].fechas.add(tramo.fecha);
    });

    // Convertir a array y calcular promedios
    const processedData = Object.keys(datosPorSector).map(tramoKey => {
        const tramoData = datosPorSector[tramoKey];
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
    let color, bgColor

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

    if (trafficChart) {
        trafficChart.destroy();
    }

    const ctx = document.getElementById('trafficChart');
    trafficChart = new Chart(ctx, {
        type: 'bar',
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
            onClick: function (event, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    selectedDeviceData = sortedData[index];
                    selectedSectorChartdays = sortedSectors[index];
                    selectedDeviceChartdays = sortedDevices[index];
                    const periodSelector = document.getElementById('periodSelector').value;
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
                        title: function (context) {
                            const index = context[0].dataIndex;
                            return 'Código tramo: ' + sortedCodigoTramo[index] + '\nPR: ' + sortedPrAprox[index] + '\nSector: ' + sortedSectors[index];
                        },
                        label: function (context) {
                            const value = context.parsed.x; // 👈 si inviertes los ejes, ahora el valor está en X
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
                x: { // ahora representa los valores
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                    ticks: {
                        callback: function (value) {
                            if (metricType === 'speed') {
                                return value;
                            }
                            return value.toLocaleString('es-CO');
                        },
                        font: { size: 12 }
                    },
                    title: {
                        display: true,
                        text: metricType === 'speed' ? 'Velocidad promedio (km/h)' : 'Cantidad de vehículos',
                        font: { size: 12, weight: 'bold' }
                    }
                },
                y: { // ahora muestra los nombres de los sectores
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

function changeChartType(type) {
    if (!trafficChart) return;

    trafficChart.config.type = type;
    trafficChart.update();

    const btnBarras = document.getElementById('chartTypeBarras');
    const btnLineas = document.getElementById('chartTypeLineas');

    if (type === 'bar') {
        btnBarras.classList.add('active');
        btnBarras.setAttribute('aria-pressed', 'true');
        btnLineas.classList.remove('active');
        btnLineas.setAttribute('aria-pressed', 'false');
        btnBarras.setAttribute('aria-label', 'Vista de barras activada');
        btnLineas.setAttribute('aria-label', 'Cambiar a vista de líneas');
    } else {
        btnLineas.classList.add('active');
        btnLineas.setAttribute('aria-pressed', 'true');
        btnBarras.classList.remove('active');
        btnBarras.setAttribute('aria-pressed', 'false');
        btnLineas.setAttribute('aria-label', 'Vista de líneas activada');
        btnBarras.setAttribute('aria-label', 'Cambiar a vista de barras');
    }

    // Announce change to screen readers
    const announcement = type === 'bar' ? 'Gráfico cambiado a vista de barras' : 'Gráfico cambiado a vista de líneas';
    announceToScreenReader(announcement);

    console.log('Chart type changed to:', type);
}

function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
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

        const periodSelector = document.getElementById('periodSelector').value;
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
        const metricType = document.getElementById('metricSelector').value;

        // Determinar qué datos mostrar basado en la métrica
        let data, label, color, bgColor, yAxisTitle, yAxisCallback;
        if (metricType === 'speed') {
            data = velocidades;
            label = 'Velocidad promedio (km/h)';
            color = '#3b82f6';
            bgColor = 'rgba(59, 130, 246, 0.7)';
            yAxisTitle = 'Velocidad promedio (km/h)';
            yAxisCallback = function (value) { return value + ' km/h'; };
        } else if (metricType === 'volume') {
            data = volumenes;
            label = 'Volumen de tráfico (# vehículos)';
            color = '#10b981';
            bgColor = 'rgba(16, 185, 129, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function (value) { return value.toLocaleString('es-CO'); };
        } else if (metricType === 'excess') {
            data = excesos;
            label = 'Vehículos con velocidad mayor a 80km/h';
            color = '#ef4444';
            bgColor = 'rgba(239, 68, 68, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function (value) { return value.toLocaleString('es-CO'); };
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
                    onClick: function (event, elements) {
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
                                title: function (context) {
                                    const fechaIndex = context[0].dataIndex;
                                    return new Date(fechas[fechaIndex] + 'T00:00:00').toLocaleDateString('es-CO', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    });
                                },
                                label: function (context) {
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

        // Agregar event listener para cerrar (si no existe)
        const closeBtn = document.getElementById('closeDailyChart');
        if (closeBtn && !closeBtn.hasEventListener) {
            closeBtn.addEventListener('click', closeDailyChart);
            closeBtn.hasEventListener = true; // Marcar que ya tiene el listener
        }

        console.log(`Gráfica diaria mostrada para el sector: ${selectedSectorChartdays} con métrica: ${metricType}`);

    } catch (error) {
        console.error('Error al mostrar gráfica diaria:', error);
    }
}

// Función para mostrar gráfica por hora
async function showHoursChart() {
    try {
        console.log('Mostrando gráfica por hora para fecha:', selectedSectorCharthour, ' y tramo', selectedSectorChartdays);

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
        const metricType = document.getElementById('metricSelector').value;

        // Determinar qué datos mostrar basado en la métrica
        let dataArray, label, color, bgColor, yAxisTitle, yAxisCallback;
        if (metricType === 'speed') {
            dataArray = promedioVelocidad;
            label = 'Velocidad promedio (km/h)';
            color = '#3b82f6';
            bgColor = 'rgba(59, 130, 246, 0.7)';
            yAxisTitle = 'Velocidad promedio (km/h)';
            yAxisCallback = function (value) { return value.toFixed(1) + ' km/h'; };
        } else if (metricType === 'volume') {
            dataArray = totalRegistros;
            label = 'Volumen de tráfico (# vehículos)';
            color = '#10b981';
            bgColor = 'rgba(16, 185, 129, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function (value) { return value.toLocaleString('es-CO'); };
        } else if (metricType === 'excess') {
            dataArray = registrosMayor80;
            label = 'Vehículos con velocidad mayor a 80km/h';
            color = '#ef4444';
            bgColor = 'rgba(239, 68, 68, 0.7)';
            yAxisTitle = 'Vehículos';
            yAxisCallback = function (value) { return value.toLocaleString('es-CO'); };
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
                                title: function (context) {
                                    const horaIndex = context[0].dataIndex;
                                    return `Hora: ${horas[horaIndex]}`;
                                },
                                label: function (context) {
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

        // Agregar event listener para cerrar (si no existe)
        const closeBtn = document.getElementById('closeHourChart');
        if (closeBtn && !closeBtn.hasEventListener) {
            closeBtn.addEventListener('click', closeHoursChart);
            closeBtn.hasEventListener = true; // Marcar que ya tiene el listener
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

    selectedSectorCharthour = ''

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

function updateDashboard() {
    closeDailyChart();
    closeHoursChart();
    updateTrafficChart();
    updateKPIsByDepartment();
}

function updateDashboardQuery() {
    closeDailyChart();
    closeHoursChart();
    loadKPIs();
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
        const selectedDept = document.getElementById('departmentSelector').value;

        let filteredData = cache.data;

        // Filtrar por departamento si no es "all"
        if (selectedDept !== 'all') {
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

function initPeriodSelector() {
    const selector = document.getElementById('periodSelector');
    if (!selector) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const last7DaysStart = new Date(yesterday);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);

    const formatDate = (date) => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${date.getDate()} ${months[date.getMonth()]}`;
    };

    const options = [
        { value: 'last7days', text: `Últimos 7 días (${formatDate(last7DaysStart)} - ${formatDate(yesterday)})`, selected: true }
    ];

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

    selector.innerHTML = window.safeHTML('');
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if (opt.selected) option.selected = true;
        selector.appendChild(option);
    });
}

// Función para cargar reportes desde la API
async function loadPublicReports() {
    try {
        const response = await fetch('/api/reports/public?limit=3');
        const data = await response.json();

        if (data.reports && data.reports.length > 0) {
            renderReports(data.reports);
        } else {
            console.log('No hay reportes disponibles');
        }
    } catch (error) {
        console.error('Error al cargar reportes:', error);
        // Mostrar mensaje de error o datos de respaldo
    }
}

// Función para renderizar los reportes en las cards
function renderReports(reports) {
    const grid = document.querySelector('.grid.grid-sm-2.grid-lg-3');
    if (!grid) return;

    // Limpiar contenido existente
    grid.innerHTML = window.safeHTML('');

    reports.forEach((report, index) => {
        const reportCard = createReportCard(report, index);
        grid.appendChild(reportCard);
    });

    // Agregar badge "NUEVO" si el reporte fue creado el mismo día
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    reports.forEach((report, index) => {
        const reportDate = new Date(report.createdAt).toISOString().split('T')[0];
        if (reportDate === todayString) {
            const card = grid.children[index];
            const header = card.querySelector('.report-header');
            if (header && !header.querySelector('.report-badge')) {
                const badge = document.createElement('span');
                badge.className = 'report-badge';
                badge.textContent = 'NUEVO';
                header.appendChild(badge);
            }
        }
    });
}

// Función para crear una card de reporte
function createReportCard(report, index) {
    const card = document.createElement('div');
    card.className = 'report-card';

    // Formatear fecha
    const createdDate = new Date(report.createdAt);
    const formattedDate = createdDate.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Formatear tamaño del archivo
    const fileSize = report.fileSize;
    let formattedSize;
    if (fileSize >= 1024 * 1024) { // >= 1MB
        formattedSize = (fileSize / (1024 * 1024)).toFixed(1) + ' MB';
    } else { // < 1MB, mostrar en KB
        formattedSize = Math.round(fileSize / 1024) + ' KB';
    }
    let icon = 'description';
    if (index === 1) icon = 'analytics';
    if (index === 2) icon = 'memory';
    if (index === 3) icon = 'route';
    if (index === 4) icon = 'show_chart';
    if (index === 5) icon = 'assessment';

    card.innerHTML = window.safeHTML(`
        <div class="report-header">
            <i class="material-icons" style="color: var(--color-primary);" aria-hidden="true">${icon}</i>
            <!-- ${report.isFeatured ? '<span class="report-badge">DESTACADO</span>' : ''} -->
        </div>
        <h3 class="report-title">${report.title}</h3>
        <p class="report-description">${report.description || 'Sin descripción disponible'}</p>
        <div class="report-date">
            <i class="material-icons" style="font-size: 16px;" aria-hidden="true">calendar_today</i>
            <span>${formattedDate}</span>
        </div>
        <div class="report-stats">
            <div class="report-stat-item">
                <i class="material-icons" style="font-size: 18px; color: var(--color-primary);" aria-hidden="true">download</i>
                <span class="download-counter" data-downloads="${report.downloadCount}" aria-label="${report.downloadCount} descargas">${report.downloadCount.toLocaleString('es-CO')}</span>
                <span style="font-size: 0.8rem;">descargas</span>
            </div>
        </div>
        <div class="report-meta">
            <span>${formattedSize} • ${getFileTypeLabel(report.mimeType)}</span>
            <button onclick="downloadDocument(this, '${report.downloadUrl}')" style="background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 0.5rem;" aria-label="Descargar documento">
                <i class="material-icons">download</i>
            </button>
        </div>
    `);

    return card;
}

// Función auxiliar para obtener etiqueta del tipo de archivo
function getFileTypeLabel(mimeType) {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.startsWith('image/')) return 'Imagen';
    if (mimeType.startsWith('text/')) return 'Texto';
    return 'Archivo';
}

function downloadDocument(button, downloadUrl) {
    // Abrir URL de descarga en nueva pestaña
    window.open(downloadUrl, '_blank');

    const card = button.closest('.report-card');
    const counterElement = card.querySelector('.download-counter');

    if (counterElement) {
        let currentDownloads = parseInt(counterElement.getAttribute('data-downloads'));
        currentDownloads++;

        counterElement.setAttribute('data-downloads', currentDownloads);
        counterElement.textContent = currentDownloads.toLocaleString('es-CO');
        counterElement.setAttribute('aria-label', `${currentDownloads} descargas`);

        counterElement.style.transform = 'scale(1.2)';
        counterElement.style.background = 'rgba(249, 115, 22, 0.2)';

        setTimeout(() => {
            counterElement.style.transform = 'scale(1)';
            counterElement.style.background = 'rgba(249, 115, 22, 0.1)';
        }, 300);
    }

    const icon = button.querySelector('.material-icons');
    if (icon) {
        icon.textContent = 'check_circle';
        button.style.color = 'var(--color-success)';

        setTimeout(() => {
            icon.textContent = 'download';
            button.style.color = 'var(--color-primary)';
        }, 1500);
    }

    console.log('Descargando documento...');
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