// Variables globales para los gráficos
let consultasEspecialidadChart = null;
let consultasPorDiaChart = null;
let rendimientoMedicosChart = null;

// Función para obtener la fecha de inicio y fin de la semana actual
function obtenerSemanaActual() {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, etc.
    const lunes = new Date(hoy);
    const domingo = new Date(hoy);
    
    // Ajustar para que el lunes sea el primer día
    const diasHastaLunes = (diaSemana === 0 ? -6 : 1 - diaSemana);
    lunes.setDate(hoy.getDate() + diasHastaLunes);
    
    // El domingo es 6 días después del lunes
    domingo.setDate(lunes.getDate() + 6);
    
    // Asegurar que las fechas incluyan el día completo
    lunes.setHours(0, 0, 0, 0);  // Inicio del día
    domingo.setHours(23, 59, 59, 999);  // Final del día
    
    return {
        inicio: lunes.toISOString().split('T')[0],
        fin: domingo.toISOString().split('T')[0]
    };
}

// Función para cargar especialidades y boxes
async function cargarFiltrosIniciales() {
    try {
        const response = await fetch('/dashboard/filtros-iniciales');
        const data = await response.json();
        
        // Cargar especialidades
        const especialidadesList = document.getElementById('especialidades-list');
        especialidadesList.innerHTML = '';
        data.especialidades.forEach((especialidad, index) => {
            especialidadesList.innerHTML += `
                <li>
                    <div class="form-check dropdown-item">
                        <input class="form-check-input especialidad-check"
                            type="checkbox"
                            value="${especialidad.id}"
                            id="filtro-especialidad-${especialidad.id}-${index + 1}">
                        <span class="form-check-label" style="cursor:default; user-select: none;">${especialidad.nombre}</span>
                    </div>
                </li>
            `;
        });
        
        // Cargar boxes
        const boxesList = document.getElementById('boxes-list');
        boxesList.innerHTML = '';
        data.boxes.forEach((box, index) => {
            const listItem = document.createElement('div');
            listItem.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input box-check"
                        type="checkbox"
                        value="${box.id}"
                        id="filtro-box-${box.id}-${index + 1}">
                    <label class="form-check-label" 
                        for="filtro-box-${box.id}-${index + 1}"
                        style="cursor:pointer; user-select: none;"
                        title="${box.nombre}">
                        ${box.nombre}
                    </label>
                </div>
            `;
            boxesList.appendChild(listItem);
        });
        
        // Configurar eventos después de cargar
        configurarEventosFiltros();
        
    } catch (error) {
        console.error('Error al cargar filtros iniciales:', error);
    }
}

// Función para configurar eventos de filtros
function configurarEventosFiltros() {
    // Eventos para "Seleccionar Todo"
    const selectAllEspecialidades = document.getElementById('selectAllEspecialidades');
    if (selectAllEspecialidades) {
        selectAllEspecialidades.addEventListener('change', function() {
            document.querySelectorAll('.especialidad-check').forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            actualizarDatos();
        });
    }

    const selectAllBoxes = document.getElementById('selectAllBoxes');
    if (selectAllBoxes) {
        selectAllBoxes.addEventListener('change', function() {
            document.querySelectorAll('.box-check').forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            actualizarDatos();
        });
    }

    // Eventos para checkboxes individuales
    document.addEventListener('change', function(e) {
        if (e.target.matches('.especialidad-check') || e.target.matches('.box-check')) {
            actualizarDatos();
        }
    });

    // Eventos para fechas
    const fechaInicio = document.getElementById('fechaInicioFiltro');
    const fechaFin = document.getElementById('fechaFinFiltro');
    
    if (fechaInicio) {
        fechaInicio.addEventListener('change', actualizarDatos);
    }
    if (fechaFin) {
        fechaFin.addEventListener('change', actualizarDatos);
    }

    // Evento para resetear filtros
    const resetButton = document.getElementById('resetearFiltros');
    if (resetButton) {
        resetButton.addEventListener('click', resetearFiltros);
    }
}

// Función para obtener filtros actuales
function obtenerFiltrosActuales() {
    const especialidades = [];
    document.querySelectorAll('.especialidad-check:checked').forEach(checkbox => {
        especialidades.push(checkbox.value);
    });

    const boxes = [];
    document.querySelectorAll('.box-check:checked').forEach(checkbox => {
        boxes.push(checkbox.value);
    });

    const fechaInicio = document.getElementById('fechaInicioFiltro').value;
    const fechaFin = document.getElementById('fechaFinFiltro').value;

    return {
        especialidades,
        boxes,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
    };
}

// Función para actualizar datos
async function actualizarDatos() {
    try {
        const filtros = obtenerFiltrosActuales();
        const response = await fetch('/dashboard/datos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filtros)
        });

        const data = await response.json();
        actualizarKPIs(data.kpis);
        actualizarGraficos(data.graficos);

    } catch (error) {
        console.error('Error al actualizar datos:', error);
    }
}

// Función para actualizar KPIs (ACTUALIZADA)
function actualizarKPIs(kpis) {
    // KPI 1: Ocupación
    const ocupacionElement = document.getElementById('ocupacion-actual');
    const ocupacionSubtext = document.getElementById('ocupacion-subtext');
    
    if (kpis.ocupacion_actual !== null) {
        ocupacionElement.innerHTML = `${kpis.ocupacion_actual}%`;
        if (kpis.variacion_ocupacion > 0) {
            ocupacionElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-up"><i class="fa-solid fa-arrow-up"></i>+${kpis.variacion_ocupacion}%</span>`;
        } else if (kpis.variacion_ocupacion < 0) {
            ocupacionElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-down"><i class="fa-solid fa-arrow-down"></i>${kpis.variacion_ocupacion}%</span>`;
        } else {
            ocupacionElement.innerHTML += `<span class="dashboard-kpi-variation"><i class="fa-solid fa-equals"></i></span>`;
        }
    ocupacionSubtext.textContent = kpis.ocupacion_subtext || (window.i18nDashboard?.ocupacionSubtext || '');
    } else {
        ocupacionElement.textContent = '--%';
    ocupacionSubtext.textContent = window.i18nDashboard?.applyFilters || '';
    }

    // KPI 2: Total consultas
    const consultasElement = document.getElementById('total-consultas');
    const consultasSubtext = document.getElementById('consultas-subtext');
    
    consultasElement.innerHTML = `${kpis.total_consultas || 0}`;
    if (kpis.variacion_consultas > 0) {
        consultasElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-up"><i class="fa-solid fa-arrow-up"></i>+${kpis.variacion_consultas}</span>`;
    } else if (kpis.variacion_consultas < 0) {
        consultasElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-down"><i class="fa-solid fa-arrow-down"></i>${kpis.variacion_consultas}</span>`;
    } else if (kpis.variacion_consultas === 0 && kpis.total_consultas > 0) {
        consultasElement.innerHTML += `<span class="dashboard-kpi-variation"><i class="fa-solid fa-equals"></i></span>`;
    }
    consultasSubtext.textContent = kpis.consultas_subtext || (window.i18nDashboard?.periodSelected || '');

    // KPI 3: Promedio diario (NUEVO)
    const promedioElement = document.getElementById('promedio-consultas-diario');
    const promedioSubtext = document.getElementById('promedio-subtext');
    
    promedioElement.innerHTML = `${kpis.promedio_consultas_diario || 0}`;
    if (kpis.variacion_promedio_diario > 0) {
        promedioElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-up"><i class="fa-solid fa-arrow-up"></i>+${kpis.variacion_promedio_diario}</span>`;
    } else if (kpis.variacion_promedio_diario < 0) {
        promedioElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-down"><i class="fa-solid fa-arrow-down"></i>${kpis.variacion_promedio_diario}</span>`;
    } else if (kpis.variacion_promedio_diario === 0 && kpis.promedio_consultas_diario > 0) {
        promedioElement.innerHTML += `<span class="dashboard-kpi-variation"><i class="fa-solid fa-equals"></i></span>`;
    }
    promedioSubtext.textContent = kpis.promedio_subtext || (window.i18nDashboard?.perDay || '');

    // KPI 4: Especialidad más demandada
    const especialidadElement = document.getElementById('especialidad-demandada');
    const especialidadSubtext = document.getElementById('especialidad-subtext');
    
    if (kpis.especialidad_mas_demandada) {
        especialidadElement.innerHTML = kpis.especialidad_mas_demandada;
        if (kpis.tendencia_especialidad === 'sube') {
            especialidadElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-up"><i class="fa-solid fa-arrow-up"></i></span>`;
        } else if (kpis.tendencia_especialidad === 'baja') {
            especialidadElement.innerHTML += `<span class="dashboard-kpi-variation dashboard-kpi-down"><i class="fa-solid fa-arrow-down"></i></span>`;
        } else {
            especialidadElement.innerHTML += `<span class="dashboard-kpi-variation"><i class="fa-solid fa-equals"></i></span>`;
        }
        especialidadSubtext.textContent = kpis.especialidad_subtext || (window.i18nDashboard?.currentPeriod || '');
    } else {
        especialidadElement.textContent = window.i18nDashboard?.noData || '—';
        especialidadSubtext.textContent = window.i18nDashboard?.applyFilters || '';
    }
}

// Función para actualizar gráficos
function actualizarGraficos(graficos) {
    // Actualizar gráfico de consultas por especialidad
    actualizarGraficoEspecialidades(graficos.consultas_por_especialidad);
    
    // Actualizar gráfico de consultas por día
    actualizarGraficoPorDia(graficos.consultas_por_dia);
    
    // Actualizar gráfico de rendimiento de médicos
    actualizarGraficoMedicos(graficos.rendimiento_medicos);
}

// Función auxiliar para convertir color hex a RGB
function hexToRgb(hex) {
    // Remover el # si existe
    hex = hex.replace('#', '');
    
    // Convertir los valores hex a decimal
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
}

// Paleta de colores mejorada con sistema de intensidad
const DASHBOARD_CHART_COLORS = {
    // Color base para el sistema de intensidad - se actualizará dinámicamente
    baseColor: (() => {
        const primaryColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-color')
            .trim();
        return hexToRgb(primaryColor);
    })(),

    lightColor: (() => {
        const primaryLightColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-color-light')
            .trim();
        return hexToRgb(primaryLightColor);
    })(),
    
    // Función para generar colores por intensidad
    getIntensityColor: function(value, maxValue, minOpacity = 0.4, maxOpacity = 1.0) {
        if (maxValue === 0) return `rgba(${this.baseColor.r}, ${this.baseColor.g}, ${this.baseColor.b}, 0.6)`;
        
        const intensity = value / maxValue;
        
        // Interpolación entre color claro y color base (#142c59)
        const r = Math.round(this.lightColor.r + (this.baseColor.r - this.lightColor.r) * intensity);
        const g = Math.round(this.lightColor.g + (this.baseColor.g - this.lightColor.g) * intensity);
        const b = Math.round(this.lightColor.b + (this.baseColor.b - this.lightColor.b) * intensity);
        
        // La opacidad también puede variar según la intensidad
        const opacity = minOpacity + (intensity * (maxOpacity - minOpacity));
        
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    },
    
    // Función para colores hover (ligeramente más brillantes)
    getHoverColor: function(value, maxValue) {
        if (maxValue === 0) return `rgba(26, 53, 102, 0.9)`;
        
        const intensity = value / maxValue;
        
        // Usar el mismo sistema de interpolación pero con un factor de brillo
        const brightenFactor = 1.15; // 15% más brillante
        
        const baseR = Math.round(this.lightColor.r + (this.baseColor.r - this.lightColor.r) * intensity);
        const baseG = Math.round(this.lightColor.g + (this.baseColor.g - this.lightColor.g) * intensity);
        const baseB = Math.round(this.lightColor.b + (this.baseColor.b - this.lightColor.b) * intensity);
        
        const r = Math.min(255, Math.round(baseR * brightenFactor));
        const g = Math.min(255, Math.round(baseG * brightenFactor));
        const b = Math.min(255, Math.round(baseB * brightenFactor));
        
        return `rgba(${r}, ${g}, ${b}, 0.95)`;
    },
    
    // Colores sólidos para diferentes elementos (mantener para variedad si es necesario)
    solidColors: [
        'rgba(20, 44, 89, 1.0)',   // #142c59 - Color base
        'rgba(30, 58, 114, 1.0)',
        'rgba(44, 90, 160, 1.0)',
        'rgba(74, 144, 226, 1.0)', // Más claro
        'rgba(61, 109, 176, 1.0)',
        'rgba(90, 156, 229, 1.0)',
        'rgba(26, 64, 128, 1.0)',
        'rgba(33, 71, 135, 1.0)',
    ]
};

// Función para actualizar gráfico de especialidades con intensidad de color
function actualizarGraficoEspecialidades(data) {
    const canvas = document.getElementById('consultasEspecialidadChart');
    const placeholder = document.getElementById('consultasEspecialidadPlaceholder');
    
    if (data && data.labels && data.labels.length > 0) {
        canvas.style.display = 'block';
        placeholder.style.display = 'none';
        
        if (consultasEspecialidadChart) {
            // Actualizar labels
            consultasEspecialidadChart.data.labels = data.labels;
            
            // Colores por intensidad - más oscuro = mayor valor (hasta #142c59)
            const maxValue = Math.max(...data.data);
            const backgroundColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getIntensityColor(value, maxValue, 0.7, 1.0)
            );
            const hoverColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getHoverColor(value, maxValue)
            );
            
            // Actualizar datos y colores
            consultasEspecialidadChart.data.datasets[0].data = data.data;
            consultasEspecialidadChart.data.datasets[0].backgroundColor = backgroundColors;
            consultasEspecialidadChart.data.datasets[0].hoverBackgroundColor = hoverColors;
            consultasEspecialidadChart.data.datasets[0].borderColor = backgroundColors;
            
            // Aplicar la actualización con animación
            consultasEspecialidadChart.update('active');
            
        } else {
            // Crear gráfico por primera vez
            const ctx = canvas.getContext('2d');
            
            const maxValue = Math.max(...data.data);
            const backgroundColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getIntensityColor(value, maxValue, 0.7, 1.0)
            );
            const hoverColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getHoverColor(value, maxValue)
            );
            
            consultasEspecialidadChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Cantidad de Consultas',
                        data: data.data,
                        backgroundColor: backgroundColors,
                        hoverBackgroundColor: hoverColors,
                        borderColor: backgroundColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 800,
                        easing: 'easeInOutCubic'
                    },
                    layout: {
                        padding: {
                            top: 20,
                            right: 20,
                            bottom: 20,
                            left: 20
                        }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            title: { display: false },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.2)',
                                lineWidth: 1
                            },
                            ticks: {
                                color: '#64748b',
                                font: {
                                    size: 12,
                                    weight: '500'
                                }
                            },
                            animation: {
                                duration: 800
                            }
                        },
                        x: { 
                            title: { display: false },
                            grid: {
                                display: false
                            },
                            ticks: { 
                                maxRotation: 45, 
                                minRotation: 45,
                                color: '#64748b',
                                font: { 
                                    size: 11,
                                    weight: '500' 
                                }
                            }
                        }
                    },
                    plugins: { 
                        legend: { display: false },
                        title: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 31, 61, 0.95)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#2c5aa0',
                            borderWidth: 1,
                            cornerRadius: 8,
                            displayColors: true,
                            callbacks: {
                                labelColor: function(context) {
                                    return {
                                        borderColor: context.dataset.backgroundColor[context.dataIndex],
                                        backgroundColor: context.dataset.backgroundColor[context.dataIndex]
                                    };
                                }
                            }
                        }
                    }
                }
            });
        }
    } else {
        if (consultasEspecialidadChart) {
            consultasEspecialidadChart.destroy();
            consultasEspecialidadChart = null;
        }
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

// Función para actualizar gráfico por día (mejorado)
function actualizarGraficoPorDia(data) {
    const canvas = document.getElementById('consultasPorDiaChart');
    const placeholder = document.getElementById('consultasPorDiaPlaceholder');
    
    if (data && data.labels && data.labels.length > 0) {
        canvas.style.display = 'block';
        placeholder.style.display = 'none';
        
        if (consultasPorDiaChart) {
            // Actualizar datos existentes
            consultasPorDiaChart.data.labels = data.labels;
            
            // Colores por intensidad mejorados - del azul claro al #142c59
            const maxValue = Math.max(...data.data);
            const backgroundColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getIntensityColor(value, maxValue, 0.8, 1.0)
            );
            const hoverColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getHoverColor(value, maxValue)
            );
            
            consultasPorDiaChart.data.datasets[0].data = data.data;
            consultasPorDiaChart.data.datasets[0].backgroundColor = backgroundColors;
            consultasPorDiaChart.data.datasets[0].hoverBackgroundColor = hoverColors;
            consultasPorDiaChart.data.datasets[0].borderColor = backgroundColors;
            
            // Actualizar con animación suave
            consultasPorDiaChart.update('active');
            
        } else {
            // Crear gráfico por primera vez
            const ctx = canvas.getContext('2d');
            
            const maxValue = Math.max(...data.data);
            const backgroundColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getIntensityColor(value, maxValue, 0.8, 1.0)
            );
            const hoverColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getHoverColor(value, maxValue)
            );
            
            consultasPorDiaChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Cantidad de Consultas',
                        data: data.data,
                        backgroundColor: backgroundColors,
                        hoverBackgroundColor: hoverColors,
                        borderColor: backgroundColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 800,
                        easing: 'easeInOutCubic'
                    },
                    layout: {
                        padding: {
                            top: 20,
                            right: 20,
                            bottom: 20,
                            left: 20
                        }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            title: { display: false },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.2)',
                                lineWidth: 1
                            },
                            ticks: {
                                color: '#64748b',
                                font: {
                                    size: 12,
                                    weight: '500'
                                }
                            },
                            animation: {
                                duration: 800
                            }
                        },
                        x: { 
                            title: { display: false },
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#64748b',
                                font: {
                                    size: 12,
                                    weight: '500'
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 31, 61, 0.95)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#2c5aa0',
                            borderWidth: 1,
                            cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    return `Consultas: ${context.raw}`;
                                },
                                title: function(context) {
                                    return data.labels[context[0].dataIndex];
                                }
                            }
                        }
                    }
                }
            });
        }
    } else {
        if (consultasPorDiaChart) {
            consultasPorDiaChart.destroy();
            consultasPorDiaChart = null;
        }
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

// Función para actualizar gráfico de médicos con intensidad de color
function actualizarGraficoMedicos(data) {
    const canvas = document.getElementById('rendimientoMedicosChart');
    const placeholder = document.getElementById('rendimientoMedicosPlaceholder');
    
    if (data && data.labels && data.labels.length > 0) {
        canvas.style.display = 'block';
        placeholder.style.display = 'none';
        
        if (rendimientoMedicosChart) {
            // Actualizar datos existentes
            const labelsCortos = data.labels.map(label => 
                label.length > 14 ? label.substring(0, 14) + '…' : label
            );
            
            // Colores por intensidad para médicos - del azul claro al #142c59
            const maxValue = Math.max(...data.data);
            const backgroundColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getIntensityColor(value, maxValue, 0.8, 1.0)
            );
            const hoverColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getHoverColor(value, maxValue)
            );
            
            rendimientoMedicosChart.data.labels = labelsCortos;
            rendimientoMedicosChart.data.datasets[0].data = data.data;
            rendimientoMedicosChart.data.datasets[0].backgroundColor = backgroundColors;
            rendimientoMedicosChart.data.datasets[0].hoverBackgroundColor = hoverColors;
            rendimientoMedicosChart.data.datasets[0].borderColor = backgroundColors;
            
            // Actualizar con animación suave
            rendimientoMedicosChart.update('active');
            
        } else {
            // Crear gráfico por primera vez
            const ctx = canvas.getContext('2d');
            
            const maxValue = Math.max(...data.data);
            const backgroundColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getIntensityColor(value, maxValue, 0.8, 1.0)
            );
            const hoverColors = data.data.map(value => 
                DASHBOARD_CHART_COLORS.getHoverColor(value, maxValue)
            );
            
            rendimientoMedicosChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels.map(label => label.length > 14 ? label.substring(0, 14) + '…' : label),
                    datasets: [{
                        label: 'Consultas atendidas',
                        data: data.data,
                        backgroundColor: backgroundColors,
                        hoverBackgroundColor: hoverColors,
                        borderColor: backgroundColors,
                        borderWidth: 0,
                        borderRadius: 6,
                        borderSkipped: false,
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 800,
                        easing: 'easeInOutCubic'
                    },
                    layout: {
                        padding: {
                            top: 20,
                            right: 20,
                            bottom: 20,
                            left: 20
                        }
                    },
                    scales: {
                        x: { 
                            beginAtZero: true,
                            title: { display: false },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.2)',
                                lineWidth: 1
                            },
                            ticks: {
                                color: '#64748b',
                                font: {
                                    size: 12,
                                    weight: '500'
                                }
                            },
                            animation: {
                                duration: 800
                            }
                        },
                        y: {
                            title: { display: false },
                            grid: {
                                display: false
                            },
                            ticks: {
                                callback: function(val, index) {
                                    const label = this.getLabelForValue(val);
                                    return label.length > 14 ? label.substring(0, 14) + '…' : label;
                                },
                                color: '#64748b',
                                font: { 
                                    size: 11,
                                    weight: '500'
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 31, 61, 0.95)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#2c5aa0',
                            borderWidth: 1,
                            cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    return `Consultas: ${context.raw}`;
                                },
                                title: function(context) {
                                    // Mostrar el nombre completo en el tooltip
                                    return data.labels[context[0].dataIndex];
                                }
                            }
                        }
                    }
                }
            });
        }
    } else {
        if (rendimientoMedicosChart) {
            rendimientoMedicosChart.destroy();
            rendimientoMedicosChart = null;
        }
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
    }
}

// Función para resetear filtros
function resetearFiltros() {
    // Limpiar checkboxes
    document.querySelectorAll('.especialidad-check, .box-check').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    document.getElementById('selectAllEspecialidades').checked = false;
    document.getElementById('selectAllBoxes').checked = false;
    
    // Configurar fechas de la semana actual
    const semanaActual = obtenerSemanaActual();
    document.getElementById('fechaInicioFiltro').value = semanaActual.inicio;
    document.getElementById('fechaFinFiltro').value = semanaActual.fin;
    
    // Actualizar datos
    actualizarDatos();
}

// Función para obtener cookie CSRF
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Script para animaciones de carga y scroll
document.addEventListener('DOMContentLoaded', function() {
    
    // Activar animaciones de carga con delays individuales
    const elementsToAnimate = document.querySelectorAll('.dashboard-animate-on-load');
    
    elementsToAnimate.forEach((el, index) => {
        const delay = parseFloat(el.style.animationDelay) || (index * 200);
        setTimeout(() => {
            el.classList.add('visible');
        }, delay);
    });

    // Mantener el observer para elementos que aparecen al scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.dashboard-animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // Inicializar dashboard
    inicializarDashboard();
});

// Función principal de inicialización
async function inicializarDashboard() {
    // Configurar fechas de la semana actual
    const semanaActual = obtenerSemanaActual();
    document.getElementById('fechaInicioFiltro').value = semanaActual.inicio;
    document.getElementById('fechaFinFiltro').value = semanaActual.fin;
    
    // Cargar filtros iniciales
    await cargarFiltrosIniciales();
    
    // Cargar datos iniciales
    actualizarDatos();
}