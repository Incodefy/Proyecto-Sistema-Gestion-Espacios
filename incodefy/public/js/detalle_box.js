let fechaActual = new Date(new Date().toISOString().split('T')[0]); 
let graficoUso = null;
let graficoCumplimiento = null;
let tiposInstrumentos = [];
let instrumentos = [];
let tipoActivo = null;

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
    try {
        const grupoId = window.grupoId;
        const espacioId = window.espacioId;
        
        console.log('📦 Cargando tipos e instrumentos para:', { grupoId, espacioId });
        
        // Cargar tipos de instrumentos con manejo de errores
        try {
            const tiposResponse = await fetch(`/groups/${grupoId}/tipos-instrumentos`);
            if (tiposResponse.ok) {
                const tiposData = await tiposResponse.json();
                // El handler retorna 'tipos', no 'tipos_instrumentos'
                tiposInstrumentos = (tiposData.tipos || []).map(tipo => ({
                    SK: `TIPO_INST#${tipo.id}`,
                    nombre: tipo.nombre,
                    icono: 'tools'
                }));
                console.log('📋 Tipos de instrumentos:', tiposInstrumentos);
            } else {
                console.warn('⚠️ No se pudieron cargar tipos de instrumentos (puede que no estén desplegados)');
                tiposInstrumentos = [];
            }
        } catch (error) {
            console.warn('⚠️ Error cargando tipos de instrumentos:', error.message);
            tiposInstrumentos = [];
        }
        
        // Cargar instrumentos del espacio
        try {
            const instrumentosResponse = await fetch(`/groups/${grupoId}/instrumentos?espacio_id=${encodeURIComponent(espacioId)}`);
            if (instrumentosResponse.ok) {
                const instrumentosData = await instrumentosResponse.json();
                instrumentos = instrumentosData.instrumentos || [];
                console.log('🔧 Instrumentos del espacio:', instrumentos);
            } else {
                console.warn('⚠️ No se pudieron cargar instrumentos');
                instrumentos = [];
            }
        } catch (error) {
            console.warn('⚠️ Error cargando instrumentos:', error.message);
            instrumentos = [];
        }
        
        // Si no hay tipos pero sí hay instrumentos, agrupar por tipo automáticamente
        if (tiposInstrumentos.length === 0 && instrumentos.length > 0) {
            console.log('📦 Creando tipos temporales desde instrumentos...');
            const tiposUnicos = new Map();
            
            instrumentos.forEach(inst => {
                const tipoId = inst.tipo_instrumento_id || inst.tipo || 'GENERAL';
                const tipoNombre = inst.tipo_instrumento_nombre || inst.tipo || 'General';
                
                if (!tiposUnicos.has(tipoId)) {
                    tiposUnicos.set(tipoId, {
                        SK: tipoId,
                        nombre: tipoNombre,
                        icono: 'tools'
                    });
                }
            });
            
            tiposInstrumentos = Array.from(tiposUnicos.values());
            console.log('📋 Tipos generados:', tiposInstrumentos);
        }
        
        // Renderizar tabs y contenido
        console.log('📊 Estado final:', { 
            tiposInstrumentos: tiposInstrumentos.length, 
            instrumentos: instrumentos.length 
        });
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
    actualizarVista();
}

function seleccionarFecha(valor) {
    if (!valor) return;
    const partes = valor.split('-');
    if (partes.length !== 3) return;
    const nuevaFecha = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    if (!isNaN(nuevaFecha.getTime())) {
        fechaActual = nuevaFecha;
        actualizarVista();
    }
}

// ========= Actualización principal =========
function actualizarVista() {
    const espacioId = document.body.dataset.espacioId;
    const fechaStr = fechaActual.toISOString().split('T')[0]; 

    console.log('📅 Actualizando vista con:', { espacioId, fechaStr });

    if (!espacioId) {
        console.error('❌ No se encontró espacio_id en el body');
        alert('Error: No se pudo identificar el espacio');
        return;
    }

    document.getElementById('selectorFecha').value = fechaStr;

    fetch(`/api/espacio-info?espacio_id=${encodeURIComponent(espacioId)}&fecha=${fechaStr}`)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                alert('Error al cargar la información: ' + data.error);
                return;
            }

            document.getElementById('fechaLabel').innerText = data.fecha;

            // Tabla
            const tabla = document.getElementById('tablaHorarios');
            tabla.innerHTML = '';
            for (const hora in data.horarios) {
                const fila = document.createElement('tr');
                const bloque = data.horarios[hora];
                fila.innerHTML = `
                    <td>${hora}</td>
                    <td>${bloque.ocupante || '-'}</td>
                    <td>${bloque.especialidad || '-'}</td>
                    <td>${bloque.estado || '-'}</td>
                `;
                tabla.appendChild(fila);
            }

            actualizarMetricas(data);
            renderGraficos(data.uso_espacio, data.consultas_no_realizadas, data.total_consultas);
        })
        .catch(err => console.error('Error:', err));
}

// ========= Métricas =========
function actualizarMetricas(data) {
    document.getElementById('totalConsultas').innerText = data.total_consultas;
    document.getElementById('noRealizadas').innerText = data.consultas_no_realizadas;
    document.getElementById('usoBox').innerHTML = `${parseFloat(data.uso_espacio || data.uso_box || 0).toFixed(0)}<span style="font-size:1.5rem;">%</span>`;
    document.getElementById('cumplimiento').innerHTML = `${parseFloat(data.cumplimiento).toFixed(0)}<span style="font-size:1.5rem;">%</span>`;
}

// ========= Gráficos MEJORADOS =========
function renderGraficos(uso, noRealizadas, total) {
    const realizadas = total - noRealizadas;
    
    // Destruir gráficos anteriores
    if (graficoUso) graficoUso.destroy();
    if (graficoCumplimiento) graficoCumplimiento.destroy();

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
                        return value + '%';
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
                        return value;
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
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Mantener el tab en la URL sin recargar
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
}

// ========= Init =========
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar nomenclatura
    inicializarNomenclatura();
    
    // Actualizar vista de appointments
    actualizarVista();

    const urlParams = new URLSearchParams(window.location.search);
    mostrarTab(urlParams.get('tab') || 'consultas');
});
