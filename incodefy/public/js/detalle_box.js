let fechaActual = new Date(new Date().toISOString().split('T')[0]); 
let graficoUso = null;
let graficoCumplimiento = null;
let tiposInstrumentos = [];
let instrumentos = [];
let tipoActivo = null;
let userRole = null;

// ========= Performance Optimization Utilities =========
const performanceUtils = {
    // Debounce para evitar múltiples llamadas rápidas
    debounceTimers: new Map(),
    debounce(fn, delay, key) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        const timer = setTimeout(() => {
            fn();
            this.debounceTimers.delete(key);
        }, delay);
        this.debounceTimers.set(key, timer);
    },
    
    // Request deduplication - evita requests duplicados simultáneos
    pendingRequests: new Map(),
    async dedupedFetch(key, fetchFn) {
        if (this.pendingRequests.has(key)) {
            console.log('⚡ Reusando request pendiente:', key);
            return this.pendingRequests.get(key);
        }
        
        const promise = fetchFn();
        this.pendingRequests.set(key, promise);
        
        try {
            const result = await promise;
            return result;
        } finally {
            this.pendingRequests.delete(key);
        }
    },
    
    // Cache con TTL (Time To Live)
    cache: new Map(),
    cacheTTL: 5 * 60 * 1000, // 5 minutos
    setCache(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    },
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        // Verificar si expiró
        if (Date.now() - cached.timestamp > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        
        console.log('⚡ Usando cache:', key);
        return cached.value;
    },
    clearCache() {
        this.cache.clear();
    }
};

// ========= Funciones de Permisos por Rol =========
function applyRoleRestrictions() {
    if (!canModifyBookings()) {
        // Deshabilitar botón de guardar agendamiento
        const btnGuardar = document.querySelector('[data-action="save-agendamiento"]');
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.classList.add('btn-disabled');
            btnGuardar.title = 'No tienes permisos para modificar agendamientos';
        }
        
        // Deshabilitar botón de eliminar agendamiento
        const btnEliminar = document.querySelector('[data-action="delete-agendamiento"]');
        if (btnEliminar) {
            btnEliminar.disabled = true;
            btnEliminar.classList.add('btn-disabled');
            btnEliminar.title = 'No tienes permisos para eliminar agendamientos';
        }
    }
}

function canModifyBookings() {
    return userRole !== 'reader';
}

// ========= Función de pluralización =========
function pluralize(word) {
    if (!word) return '';
    const lastChar = word.slice(-1).toLowerCase();
    if (lastChar === 's') return word; // Ya es plural
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return vowels.includes(lastChar) ? word + 's' : word + 'es';
}

// ========= Inicializar textos con nomenclatura =========
function inicializarNomenclatura() {
    const nomenclatura = window.nomenclatura || { especifico: 'Espacio Específico', instrumento: 'Instrumento' };
    const especificoPlural = pluralize(nomenclatura.especifico || 'Espacio Específico');
    const instrumentoPlural = pluralize(nomenclatura.instrumento || 'Instrumento');
    
    // Actualizar botón
    const btnText = document.getElementById('btn-instrumentos-text');
    if (btnText) {
        btnText.textContent = `${instrumentoPlural} ${nomenclatura.especifico || 'Espacio Específico'}`;
    }
    
    // Actualizar título del modal
    const modalTitle = document.getElementById('modal-instrumentos-title');
    if (modalTitle) {
        modalTitle.textContent = `${instrumentoPlural} del ${nomenclatura.especifico || 'Espacio Específico'}`;
    }

    // Actualizar métricas
    const metricUsoLabel = document.getElementById('metric-uso-label');
    if (metricUsoLabel) {
        metricUsoLabel.textContent = `USO DE ${nomenclatura.especifico.toUpperCase()}`;
    }

    // Actualizar título del gráfico de uso
    const chartUsoTitle = document.getElementById('chart-uso-title');
    if (chartUsoTitle) {
        chartUsoTitle.textContent = `Uso de ${nomenclatura.especifico || 'Espacio Específico'}`;
    }
}

// ========= Modal Instrumentos =========
async function abrirModalInstrumentos() {
    const modal = document.getElementById('modalInstrumentos');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Cargar tipos de instrumentos y instrumentos
    await cargarTiposEInstrumentos();
}

function cerrarModalInstrumentos() {
    const modal = document.getElementById('modalInstrumentos');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

async function cargarTiposEInstrumentos() {
    // Usar caché si existe
    const cacheKey = `instrumentos-${window.grupoId}-${window.espacioId}`;
    const cached = performanceUtils.getCache(cacheKey);
    if (cached) {
        tiposInstrumentos = cached.tipos;
        instrumentos = cached.instrumentos;
        renderizarTiposInstrumentos();
        return;
    }
    
    try {
        const grupoId = window.grupoId;
        const espacioId = window.espacioId;
        
        console.log('📦 Cargando tipos e instrumentos para:', { grupoId, espacioId });
        
        // Cargar ambos en paralelo para mejor performance
        const [tiposResult, instrumentosResult] = await Promise.allSettled([
            fetch(`/groups/${grupoId}/tipos-instrumentos`).then(r => r.ok ? r.json() : null),
            fetch(`/groups/${grupoId}/instrumentos?espacio_id=${encodeURIComponent(espacioId)}`).then(r => r.ok ? r.json() : null)
        ]);
        
        // Procesar tipos
        if (tiposResult.status === 'fulfilled' && tiposResult.value) {
            tiposInstrumentos = (tiposResult.value.tipos || []).map(tipo => ({
                SK: `TIPO_INST#${tipo.id}`,
                nombre: tipo.nombre,
                icono: 'tools'
            }));
        } else {
            tiposInstrumentos = [];
        }
        
        // Procesar instrumentos
        if (instrumentosResult.status === 'fulfilled' && instrumentosResult.value) {
            instrumentos = instrumentosResult.value.instrumentos || [];
        } else {
            instrumentos = [];
        }
        
        // Si no hay tipos pero sí hay instrumentos, agrupar por tipo automáticamente
        if (tiposInstrumentos.length === 0 && instrumentos.length > 0) {
            const tiposUnicos = new Map();
            instrumentos.forEach(inst => {
                const tipoId = inst.tipo_instrumento_id || inst.tipo || 'GENERAL';
                const tipoNombre = inst.tipo_instrumento_nombre || inst.tipo || 'General';
                if (!tiposUnicos.has(tipoId)) {
                    tiposUnicos.set(tipoId, { SK: tipoId, nombre: tipoNombre, icono: 'tools' });
                }
            });
            tiposInstrumentos = Array.from(tiposUnicos.values());
        }
        
        // Guardar en caché
        performanceUtils.setCache(cacheKey, { tipos: tiposInstrumentos, instrumentos });
        
        renderizarTiposInstrumentos();
        
    } catch (error) {
        console.error('❌ Error general cargando instrumentos:', error);
        mostrarErrorInstrumentos();
    }
}

function renderizarTiposInstrumentos() {
    const tabsContainer = document.getElementById('tabs-tipos-instrumentos');
    const bodyContainer = document.getElementById('modal-instrumentos-body');
    
    console.log('🎨 Renderizando tipos:', tiposInstrumentos);
    
    if (tiposInstrumentos.length === 0) {
        console.log('⚠️ No hay tipos de instrumentos');
        tabsContainer.innerHTML = '';
        bodyContainer.innerHTML = `<p class="text-center text-muted">${window.translations.noInstrumentTypes || 'No hay tipos de instrumentos configurados'}</p>`;
        return;
    }
    
    // Renderizar tabs
    tabsContainer.innerHTML = tiposInstrumentos.map((tipo, index) => `
        <button 
            id="tab-${tipo.SK}" 
            class="tab-btn ${index === 0 ? 'active' : ''}" 
            role="tab" 
            aria-selected="${index === 0 ? 'true' : 'false'}"
            onclick="seleccionarTipoInstrumento('${tipo.SK}', '${tipo.nombre}')"
            aria-controls="lista-instrumentos">
            <i class="fas fa-${tipo.icono || 'tools'}"></i> ${tipo.nombre}
        </button>
    `).join('');
    
    // Seleccionar el primer tipo por defecto
    if (tiposInstrumentos.length > 0) {
        seleccionarTipoInstrumento(tiposInstrumentos[0].SK, tiposInstrumentos[0].nombre);
    }
}

function seleccionarTipoInstrumento(tipoSK, tipoNombre) {
    console.log('🔍 Seleccionando tipo:', tipoSK, tipoNombre);
    
    // Actualizar tabs activos (solo dentro del modal de instrumentos)
    const tabsContainer = document.getElementById('tabs-tipos-instrumentos');
    if (tabsContainer) {
        tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
    }
    
    const tabActivo = document.getElementById(`tab-${tipoSK}`);
    if (tabActivo) {
        tabActivo.classList.add('active');
        tabActivo.setAttribute('aria-selected', 'true');
    }
    
    tipoActivo = tipoSK;
    
    // Extraer el ID del tipo (sin el prefijo TIPO_INST#)
    const tipoId = tipoSK.replace('TIPO_INST#', '');
    
    // Filtrar instrumentos por tipo (el handler ya quitó el prefijo TIPO_INST#)
    const instrumentosFiltrados = instrumentos.filter(inst => inst.tipo_instrumento_id === tipoId);
    
    console.log('🔧 Instrumentos filtrados:', instrumentosFiltrados);
    
    // Renderizar lista de instrumentos
    renderizarInstrumentos(instrumentosFiltrados, tipoNombre);
}

function renderizarInstrumentos(instrumentosList, tipoNombre) {
    const bodyContainer = document.getElementById('modal-instrumentos-body');
    
    console.log('🎨 Renderizando instrumentos:', {
        cantidad: instrumentosList.length,
        tipoNombre,
        instrumentos: instrumentosList
    });
    
    if (instrumentosList.length === 0) {
        bodyContainer.innerHTML = `<p class="text-center text-muted">${window.translations.noInstrumentsInCategory || 'No hay instrumentos en esta categoría'}</p>`;
        return;
    }
    
    bodyContainer.innerHTML = `
        <ul id="lista-instrumentos" class="instrument-list-enhanced">
            ${instrumentosList.map(inst => `
                <li class="instrument-item-enhanced">
                    <span class="instrument-name">${inst.nombre}</span>
                    <span class="instrument-count">${inst.cantidad || 1}</span>
                </li>
            `).join('')}
        </ul>
    `;
    
    console.log('✅ Instrumentos renderizados en el DOM');
}

function mostrarErrorInstrumentos() {
    const bodyContainer = document.getElementById('modal-instrumentos-body');
    bodyContainer.innerHTML = `<p class="text-center text-danger">Error al cargar los instrumentos</p>`;
}

// ========= Fechas =========
function cambiarFecha(dias) {
    fechaActual.setDate(fechaActual.getDate() + dias);
    cargarEstadisticas();
}

function seleccionarFecha(valor) {
    if (!valor) return;
    const partes = valor.split('-');
    if (partes.length !== 3) return;
    const nuevaFecha = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    if (!isNaN(nuevaFecha.getTime())) {
        fechaActual = nuevaFecha;
        window.fechaActual = nuevaFecha;  // Sincronizar con window
        cargarEstadisticas();
    }
}

// ========= Actualización principal (DEPRECATED - usar cargarEstadisticas) =========
function actualizarVista() {
    // Redirigir a la nueva función
    cargarEstadisticas();
}

// ========= Cargar estadísticas desde API de bookings =========
let cargarEstadisticasAbortController = null;

async function cargarEstadisticas(immediate = false) {
    const espacioId = document.body.dataset.espacioId;
    const grupoId = document.body.dataset.grupoId;
    
    if (!espacioId || !grupoId) {
        console.error('❌ No se encontró espacioId o grupoId');
        return;
    }
    
    // Debouncing para evitar llamadas múltiples rápidas (excepto si es immediate)
    if (!immediate) {
        performanceUtils.debounce(() => cargarEstadisticas(true), 300, 'cargarEstadisticas');
        return;
    }

    // Usar la fecha y modo de vista del calendario si existe, sino desde URL o defaults
    let currentDate, viewMode;
    
    // Primero verificar si hay parámetros en la URL (máxima prioridad)
    const params = new URLSearchParams(window.location.search);
    const dateStrParam = params.get('date');
    const viewModeParam = params.get('viewMode');
    
    // Prioridad 1: Si hay fecha en URL, usarla (incluso si existe calendarioState)
    if (dateStrParam) {
        currentDate = new Date(dateStrParam + 'T00:00:00');
        if (isNaN(currentDate.getTime())) {
            currentDate = fechaActual || new Date();
        }
        viewMode = viewModeParam || 'week';
        console.log('📊 Usando fecha desde URL (prioridad máxima):', { 
            currentDate: currentDate.toISOString(), 
            viewMode, 
            dateStrParam 
        });
    }
    // Prioridad 2: Usar fechaActual si ya fue establecido (desde mostrarTab)
    else if (fechaActual) {
        currentDate = fechaActual;
        viewMode = viewModeParam || 'week';
        console.log('📊 Usando fechaActual establecido:', { 
            currentDate: currentDate.toISOString(), 
            viewMode 
        });
    }
    // Prioridad 3: Usar estado del calendario si existe
    else if (window.calendarioState && window.calendarioState.currentDate) {
        currentDate = window.calendarioState.currentDate;
        viewMode = window.calendarioState.viewMode || 'week';
        console.log('📊 Usando estado del calendario:', { currentDate, viewMode });
    } 
    // Prioridad 4: Fecha actual como último recurso
    else {
        currentDate = new Date();
        viewMode = 'week';
        console.log('📊 Usando fecha actual (fallback):', { 
            currentDate: currentDate.toISOString(), 
            viewMode 
        });
    }
    
    // Calcular rango de fechas según el modo de vista
    const { dateFrom, dateTo } = calcularRangoFechas(currentDate, viewMode);
    const cacheKey = `stats:${espacioId}:${grupoId}:${dateFrom}:${dateTo}`;

    console.log('📊 Cargando estadísticas para:', { espacioId, grupoId, viewMode, dateFrom, dateTo });
    
    // Cancelar request anterior si existe
    if (cargarEstadisticasAbortController) {
        cargarEstadisticasAbortController.abort();
    }

    try {
        // Intentar obtener del cache primero
        const cachedData = performanceUtils.getCache(cacheKey);
        if (cachedData) {
            calcularYMostrarMetricas(cachedData, viewMode, dateFrom, dateTo);
            return;
        }
        
        // Request deduplication - evitar requests duplicados simultáneos
        const bookings = await performanceUtils.dedupedFetch(cacheKey, async () => {
            cargarEstadisticasAbortController = new AbortController();
            
            const response = await fetch(
                `/api/groups/${grupoId}/bookings?space_id=${encodeURIComponent(espacioId)}&date_from=${dateFrom}&date_to=${dateTo}`,
                { signal: cargarEstadisticasAbortController.signal }
            );

            if (!response.ok) {
                throw new Error('Error al cargar agendamientos');
            }

            const data = await response.json();
            console.log('📅 Agendamientos recibidos:', data.length);
            return data;
        });
        
        // Guardar en cache
        performanceUtils.setCache(cacheKey, bookings);

        // Calcular métricas según el modo
        calcularYMostrarMetricas(bookings, viewMode, dateFrom, dateTo);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⚠️ Request de estadísticas cancelado');
            return;
        }
        console.error('❌ Error cargando estadísticas:', error);
        // Mostrar valores por defecto
        mostrarMetricasVacias();
    } finally {
        cargarEstadisticasAbortController = null;
    }
}

// ========= Calcular rango de fechas según modo de vista =========
function calcularRangoFechas(currentDate, viewMode) {
    const date = new Date(currentDate);
    let dateFrom, dateTo;
    
    if (viewMode === 'day') {
        // Solo el día actual
        dateFrom = formatDateString(date);
        dateTo = formatDateString(date);
    } else if (viewMode === 'week') {
        // Semana completa (Lunes a Domingo)
        const dayOfWeek = date.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() + diff);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        dateFrom = formatDateString(startOfWeek);
        dateTo = formatDateString(endOfWeek);
    } else if (viewMode === 'month') {
        // Mes completo
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        dateFrom = formatDateString(startOfMonth);
        dateTo = formatDateString(endOfMonth);
    }
    
    return { dateFrom, dateTo };
}

// ========= Formatear fecha a string YYYY-MM-DD =========
function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ========= Calcular métricas desde bookings =========
function calcularYMostrarMetricas(bookings, viewMode, dateFrom, dateTo) {
    const totalConsultas = bookings.length;
    
    // Calcular tiempo total agendado (en minutos)
    let minutosAgendados = 0;
    bookings.forEach(booking => {
        const inicio = booking.startTime || booking.start_time || '00:00';
        const fin = booking.endTime || booking.end_time || '00:00';
        const duracion = timeToMinutes(fin) - timeToMinutes(inicio);
        minutosAgendados += Math.max(0, duracion);
    });

    // Calcular minutos disponibles según el modo
    let minutosDisponibles;
    if (viewMode === 'day') {
        // 1 día: 8:00 a 20:00 = 12 horas = 720 minutos
        minutosDisponibles = 720;
    } else if (viewMode === 'week') {
        // 7 días x 12 horas = 5040 minutos
        minutosDisponibles = 720 * 7;
    } else if (viewMode === 'month') {
        // Calcular días del rango
        const inicio = new Date(dateFrom);
        const fin = new Date(dateTo);
        const dias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
        minutosDisponibles = 720 * dias;
    }

    // Calcular porcentaje de uso
    const usoEspacio = Math.min(100, (minutosAgendados / minutosDisponibles) * 100);

    // Para cumplimiento, asumimos que todas están realizadas (puedes agregar lógica de estados después)
    const consultasRealizadas = totalConsultas;
    const consultasNoRealizadas = 0;
    const cumplimiento = totalConsultas > 0 ? (consultasRealizadas / totalConsultas) * 100 : 100;

    // Actualizar UI
    const metricas = {
        total_consultas: totalConsultas,
        consultas_no_realizadas: consultasNoRealizadas,
        uso_espacio: usoEspacio,
        cumplimiento: cumplimiento
    };

    actualizarMetricas(metricas);
    renderGraficos(usoEspacio, consultasNoRealizadas, totalConsultas);

    console.log('📊 Métricas calculadas:', metricas, { viewMode, minutosAgendados, minutosDisponibles });
}

// ========= Mostrar métricas vacías =========
function mostrarMetricasVacias() {
    const metricas = {
        total_consultas: 0,
        consultas_no_realizadas: 0,
        uso_espacio: 0,
        cumplimiento: 100
    };
    actualizarMetricas(metricas);
    renderGraficos(0, 0, 0);
}

// ========= Convertir hora a minutos =========
function timeToMinutes(time) {
    if (!time || typeof time !== 'string') return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// ========= Métricas =========
function actualizarMetricas(data) {
    document.getElementById('totalConsultas').innerText = data.total_consultas;
    document.getElementById('noRealizadas').innerText = data.consultas_no_realizadas;
    document.getElementById('usoBox').innerHTML = `${parseFloat(data.uso_espacio || data.uso_box || 0).toFixed(1)}<span class="percentage-symbol">%</span>`;
    document.getElementById('cumplimiento').innerHTML = `${parseFloat(data.cumplimiento).toFixed(1)}<span class="percentage-symbol">%</span>`;
}

// ========= Gráficos MEJORADOS con Lazy Loading =========
let pendingChartRender = null;

function renderGraficos(uso, noRealizadas, total) {
    // Cancelar renderizado pendiente si existe
    if (pendingChartRender) {
        cancelAnimationFrame(pendingChartRender);
    }
    
    // Usar requestAnimationFrame para renderizado suave
    pendingChartRender = requestAnimationFrame(() => {
        renderGraficosInmediato(uso, noRealizadas, total);
        pendingChartRender = null;
    });
}

function renderGraficosInmediato(uso, noRealizadas, total) {
    const realizadas = total - noRealizadas;
    
    // Destruir gráficos anteriores de forma segura
    try {
        if (graficoUso) {
            graficoUso.destroy();
            graficoUso = null;
        }
        if (graficoCumplimiento) {
            graficoCumplimiento.destroy();
            graficoCumplimiento = null;
        }
    } catch (e) {
        console.warn('⚠️ Error al destruir gráficos:', e);
    }

    // Detectar si está en modo oscuro usando window.userPersonalization
    const userPersonalization = window.userPersonalization || {};
    const isDarkMode = userPersonalization['theme.mode'] === 'dark';
    const labelColor = isDarkMode ? '#f1f1f1' : '#2c2c2c';

    // ===== GRÁFICO DE USO =====
    const ctxUso = document.getElementById('graficoUso').getContext('2d');
    graficoUso = new Chart(ctxUso, {
        type: 'doughnut',
        data: { 
            labels: ['Usado', 'Libre'], 
            datasets: [{ 
                data: [uso, 100 - uso], 
                backgroundColor: ['#142c59', '#e8f2ff'],
                borderColor: ['#142c59', '#e8f2ff'],
                borderWidth: 2,
                cutout: '70%' 
            }] 
        },
        plugins: [ChartDataLabels],
        options: { 
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        color: labelColor, // Color dinámico según tema
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                datalabels: {
                    color: '#ffffff', // Texto blanco
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    formatter: (value) => {
                        return value.toFixed(1) + '%';
                    },
                    anchor: 'center',
                    align: 'center',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowBlur: 4,
                    textShadowOffsetX: 1,
                    textShadowOffsetY: 1
                }
            }
        }
    });

    // ===== GRÁFICO DE CUMPLIMIENTO =====
    const ctxCumplimiento = document.getElementById('graficoCumplimiento').getContext('2d');
    graficoCumplimiento = new Chart(ctxCumplimiento, {
        type: 'doughnut',
        data: { 
            labels: ['Realizadas', 'No Realizadas'], 
            datasets: [{ 
                data: [realizadas, noRealizadas], 
                backgroundColor: ['#1d428a', '#dc3545'],
                borderColor: ['#1d428a', '#dc3545'],
                borderWidth: 2,
                cutout: '70%' 
            }] 
        },
        plugins: [ChartDataLabels],
        options: { 
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        color: labelColor, // Color dinámico según tema
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                datalabels: {
                    color: '#ffffff', // Texto blanco
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    formatter: (value) => {
                        // Mostrar número entero para conteos
                        return Math.round(value);
                    },
                    anchor: 'center',
                    align: 'center',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowBlur: 4,
                    textShadowOffsetX: 1,
                    textShadowOffsetY: 1
                }
            }
        }
    });

    console.log('✅ Gráficos renderizados con mejor contraste (Tema: ' + (isDarkMode ? 'Oscuro' : 'Claro') + ')');
}

// ========= Tabs =========
function mostrarTab(tab) {
    console.log('📑 Mostrando tab:', tab);
    
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    
    // Actualizar contenido de tabs
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('hidden', '');
    });
    
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    const targetContent = document.getElementById(`tab-${tab}`);
    
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.setAttribute('aria-selected', 'true');
    }
    
    if (targetContent) {
        targetContent.classList.add('active');
        targetContent.removeAttribute('hidden');
    }

    // Si se muestra el tab de agendamientos, inicializar calendario
    if (tab === 'agendamientos') {
        console.log('📅 Inicializando calendario desde mostrarTab');
        // Pequeño delay para asegurar que el DOM del tab está visible
        setTimeout(() => {
            if (typeof inicializarCalendario === 'function') {
                inicializarCalendario();
            }
        }, 50);
    }

    // Si se muestra el tab de estadísticas, sincronizar fecha y cargar datos
    if (tab === 'estadisticas') {
        console.log('📊 Cargando estadísticas desde mostrarTab');
        
        // Lazy loading - solo cargar si no se ha cargado antes
        const metricsLoaded = document.getElementById('totalConsultas').textContent.trim() !== '';
        if (!metricsLoaded) {
            // Primero, restaurar fecha y viewMode desde URL o calendario
            let fechaRestaurada = null;
            let viewModeRestaurado = 'week';
            
            // Intentar desde URL primero
            const params = new URLSearchParams(window.location.search);
            const dateStr = params.get('date');
            const viewModeParam = params.get('viewMode');
            
            if (dateStr) {
                const fecha = new Date(dateStr + 'T00:00:00');
                if (!isNaN(fecha.getTime())) {
                    fechaRestaurada = fecha;
                }
            }
            
            if (viewModeParam && ['day', 'week', 'month'].includes(viewModeParam)) {
                viewModeRestaurado = viewModeParam;
            }
        
        // Si no hay en URL, intentar desde calendario
        if (!fechaRestaurada && window.calendarioState) {
            fechaRestaurada = new Date(window.calendarioState.currentDate);
            viewModeRestaurado = window.calendarioState.viewMode || 'week';
            console.log('✅ Fecha y modo desde calendario:', { fechaRestaurada, viewModeRestaurado });
        }
        
        // Si aún no hay fecha, usar actual
        if (!fechaRestaurada) {
            fechaRestaurada = new Date();
            console.log('ℹ️ Usando fecha actual por defecto');
        }
        
        // Actualizar variable global
        fechaActual = fechaRestaurada;
        window.fechaActual = fechaRestaurada;  // Sincronizar con window
        
        // Actualizar el display de fecha en el tab de estadísticas
        actualizarDisplayFechaEstadisticas(fechaRestaurada, viewModeRestaurado);
        
        // Cargar estadísticas
        setTimeout(() => cargarEstadisticas(), 100);
        }
    }

    // Mantener el tab en la URL sin perder otros parámetros
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
}

// ========= Actualizar display de fecha en estadísticas =========
function actualizarDisplayFechaEstadisticas(fecha, viewMode) {
    const display = document.getElementById('currentDateDisplay');
    if (!display) {
        console.warn('⚠️ No se encontró currentDateDisplay');
        return;
    }
    
    const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    let textoFecha = '';
    
    if (viewMode === 'month') {
        textoFecha = `${MONTHS_ES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    } else if (viewMode === 'week') {
        // Calcular inicio y fin de semana
        const dayOfWeek = fecha.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(fecha);
        startOfWeek.setDate(fecha.getDate() + diff);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        textoFecha = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${MONTHS_ES[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
    } else {
        // Día
        const dayName = DAYS_ES[(fecha.getDay() + 6) % 7];
        textoFecha = `${dayName} ${fecha.getDate()} de ${MONTHS_ES[fecha.getMonth()]}`;
    }
    
    display.textContent = textoFecha;
    
    // También actualizar los botones de vista activos
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    const btnId = `${viewMode}ViewBtn`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.add('active');
    }
    
    console.log('📅 Display de fecha actualizado (estadísticas):', textoFecha, 'Modo:', viewMode);
}

// Exponer función y variable globalmente
window.actualizarDisplayFechaEstadisticas = actualizarDisplayFechaEstadisticas;
window.fechaActual = fechaActual;  // Exponer para que navegarFecha pueda accederla


// ========= Funciones unificadas para navegación (detectan el tab activo) =========
window.navegarFechaUnificado = function(direccion) {
    const tabActual = document.querySelector('.tab-content.active')?.id;
    
    if (tabActual === 'tab-agendamientos' && typeof navegarFecha === 'function') {
        navegarFecha(direccion);
    } else if (tabActual === 'tab-estadisticas') {
        navegarFechaEstadisticas(direccion);
    }
};

window.irHoyUnificado = function() {
    const tabActual = document.querySelector('.tab-content.active')?.id;
    
    if (tabActual === 'tab-agendamientos' && typeof irHoy === 'function') {
        irHoy();
    } else if (tabActual === 'tab-estadisticas') {
        irHoyEstadisticas();
    }
};

window.cambiarVistaUnificado = function(modo) {
    const tabActual = document.querySelector('.tab-content.active')?.id;
    
    if (tabActual === 'tab-agendamientos' && typeof cambiarVista === 'function') {
        cambiarVista(modo);
    } else if (tabActual === 'tab-estadisticas') {
        cambiarVistaEstadisticas(modo);
    }
};

// ========= Init =========
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar nomenclatura
    inicializarNomenclatura();
    
    // Inicializar rol de usuario
    userRole = window.USER_ROLE || null;
    
    // Aplicar restricciones de rol
    applyRoleRestrictions();

    // ========= Event Listeners (refactorizado para CSP sin unsafe-inline) =========
    
    // Navegación de fechas
    document.querySelectorAll('[data-action="navigate-date"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const offset = parseInt(btn.dataset.offset);
            navegarFecha(offset);
        });
    });
    
    // Botón "Hoy"
    const btnToday = document.querySelector('[data-action="go-today"]');
    if (btnToday) {
        btnToday.addEventListener('click', irHoy);
    }
    
    // Cambiar vista (día/semana/mes)
    document.querySelectorAll('[data-action="change-view"]').forEach(btn => {
        btn.addEventListener('click', () => {
            cambiarVista(btn.dataset.view);
        });
    });
    
    // Mostrar tabs (agendamientos/estadísticas)
    document.querySelectorAll('[data-action="show-tab"]').forEach(btn => {
        btn.addEventListener('click', () => {
            mostrarTab(btn.dataset.tab);
        });
    });
    
    // Cerrar modal instrumentos
    const btnCloseInstrumentos = document.querySelector('[data-action="close-modal-instrumentos"]');
    if (btnCloseInstrumentos) {
        btnCloseInstrumentos.addEventListener('click', cerrarModalInstrumentos);
    }
    
    // Cerrar modal agendamiento
    document.querySelectorAll('[data-action="close-modal-agendamiento"]').forEach(btn => {
        btn.addEventListener('click', cerrarModalAgendamiento);
    });
    
    // Eliminar agendamiento
    const btnDeleteAgendamiento = document.querySelector('[data-action="delete-agendamiento"]');
    if (btnDeleteAgendamiento) {
        btnDeleteAgendamiento.addEventListener('click', eliminarAgendamiento);
    }
    
    // ========= Fin Event Listeners =========

    // Restaurar estado desde URL ANTES de mostrar el tab
    const urlParams = new URLSearchParams(window.location.search);
    const dateStr = urlParams.get('date');
    const viewModeParam = urlParams.get('viewMode');
    
    // Restaurar fecha
    if (dateStr) {
        const fecha = new Date(dateStr + 'T00:00:00');
        if (!isNaN(fecha.getTime())) {
            fechaActual = fecha;
            window.fechaActual = fecha;  // Sincronizar con window
            console.log('✅ Fecha global restaurada desde URL en DOMContentLoaded:', dateStr);
        }
    }
    
    // Restaurar viewMode en el DOM
    if (viewModeParam && ['day', 'week', 'month'].includes(viewModeParam)) {
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const btnId = `${viewModeParam}ViewBtn`;
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.add('active');
            console.log('✅ Botón de vista activado desde URL:', btnId);
        }
    }

    const tabInicial = urlParams.get('tab') || 'agendamientos';
    mostrarTab(tabInicial);
    
    // Conectar WebSocket después de un delay para no bloquear carga inicial
    setTimeout(() => connectWebSocket(), 1000);
});

// ============================================
// WEBSOCKET PARA ACTUALIZACIONES EN TIEMPO REAL
// ============================================

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const wsEndpointElement = document.querySelector('[data-ws-endpoint]');
const WS_URL = wsEndpointElement ? wsEndpointElement.dataset.wsEndpoint : 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev';

function connectWebSocket() {
    const grupoId = document.body.dataset.grupoId;
    
    if (!grupoId) {
        console.warn('⚠️ No hay grupoId disponible, no se puede conectar WebSocket');
        return;
    }

    try {
        websocket = new WebSocket(`${WS_URL}?grupo_id=${grupoId}`);

        websocket.onopen = () => {
            console.log('✅ WebSocket conectado para detalle_box');
            reconnectAttempts = 0;
        };

        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (err) {
                console.error('❌ Error parseando mensaje WebSocket:', err);
            }
        };

        websocket.onerror = (error) => {
            console.error('❌ Error en WebSocket:', error);
        };

        websocket.onclose = () => {
            console.log('🔌 WebSocket desconectado');
            websocket = null;

            // Intentar reconectar con backoff exponencial
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                reconnectAttempts++;
                console.log(`🔄 Reintentando conexión en ${delay/1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                setTimeout(connectWebSocket, delay);
            }
        };
    } catch (err) {
        console.error('❌ Error creando WebSocket:', err);
    }
}

function handleWebSocketMessage(message) {
    console.log('📨 Mensaje WebSocket recibido en detalle_box:', message);

    const { type, data } = message;

    // Mapeo de tipos legacy a nuevos
    const typeMapping = {
        'INSERT': 'CITA_CREADA',
        'MODIFY': 'CITA_MODIFICADA',
        'REMOVE': 'CITA_ELIMINADA'
    };
    
    const normalizedType = typeMapping[type] || type;

    switch (normalizedType) {
        // Agendas/Citas
        case 'CITA_CREADA':
            console.log('🆕 Cita creada:', data);
            actualizarVistaConWebSocket('CREADA', data);
            // Mostrar notificación toast
            if (window.notificationManager) {
                window.notificationManager.showAppointmentCreated(data);
            }
            break;

        case 'CITA_MODIFICADA':
            console.log('✏️ Cita modificada:', data);
            actualizarVistaConWebSocket('MODIFICADA', data);
            if (window.notificationManager) {
                window.notificationManager.showAppointmentModified(data);
            }
            break;

        case 'CITA_ELIMINADA':
            console.log('🗑️ Cita eliminada:', data);
            actualizarVistaConWebSocket('ELIMINADA', data);
            if (window.notificationManager) {
                window.notificationManager.showAppointmentCancelled(data);
            }
            break;

        // Espacios
        case 'ESPACIO_MODIFICADO':
            console.log('✏️ Espacio modificado:', data);
            // Recargar estadísticas si afecta este espacio
            const espacioId = document.body.dataset.espacioId;
            if (data && data.id === espacioId) {
                invalidarCacheYRecargar();
                if (window.notificationManager) {
                    window.notificationManager.showSpaceModified(data);
                }
            }
            break;

        case 'ESPACIO_ELIMINADO':
            console.log('🗑️ Espacio eliminado:', data);
            // Si eliminaron este espacio, redirigir
            const currentEspacioId = document.body.dataset.espacioId;
            if (data && data.id === currentEspacioId) {
                if (window.notificationManager) {
                    window.notificationManager.showSpaceDeleted(data);
                }
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            }
            break;

        default:
            console.log('ℹ️ Mensaje WebSocket no manejado:', type);
    }
}

function actualizarVistaConWebSocket(accion, data) {
    const espacioId = document.body.dataset.espacioId;
    
    // Obtener el ID del espacio del mensaje (puede venir como space_id o espacio_id)
    const espacioMensaje = data?.space_id || data?.espacio_id || data?.GSI2PK;
    
    // Solo actualizar si la cita pertenece a este espacio
    if (espacioMensaje === espacioId) {
        console.log('🔄 Actualizando vista por cambio en cita de este espacio');
        
        // Invalidar caché de performance
        performanceUtils.clearCache();
        
        // Obtener tab actual
        const tabActual = document.querySelector('.tab-content.active')?.id;
        
        if (tabActual === 'tab-agendamientos') {
            // Si estamos en el tab de agendamientos, recargar calendario
            if (window.calendarioState) {
                window.calendarioState.bookingsCache.clear();
                if (typeof cargarBookings === 'function') {
                    cargarBookings();
                }
            }
        } else if (tabActual === 'tab-estadisticas') {
            // Si estamos en estadísticas, recargar estadísticas
            cargarEstadisticas(true);
        }
    } else {
        console.log('ℹ️ Evento de otro espacio, ignorando. Espacio actual:', espacioId, 'Espacio mensaje:', espacioMensaje);
    }
}

function invalidarCacheYRecargar() {
    console.log('🔄 Invalidando caché y recargando datos');
    
    // Limpiar todos los cachés
    performanceUtils.clearCache();
    if (window.calendarioState) {
        window.calendarioState.bookingsCache.clear();
    }
    
    // Recargar según el tab activo
    const tabActual = document.querySelector('.tab-content.active')?.id;
    
    if (tabActual === 'tab-agendamientos' && typeof cargarBookings === 'function') {
        cargarBookings();
    } else if (tabActual === 'tab-estadisticas') {
        cargarEstadisticas(true);
    }
}

// Exponer función para desconectar WebSocket al salir
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
});