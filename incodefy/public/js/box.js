// ============================================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================================

let detallesVisibles = window.detallesVisiblesInicial !== undefined ? window.detallesVisiblesInicial : false;
let filtroTimeout;

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Establece una cookie con el valor especificado
 */
function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

/**
 * Obtiene el valor de una cookie
 */
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

/**
 * Parsea rangos de texto (ej: "1-5,8,10-12" -> [1,2,3,4,5,8,10,11,12])
 */
function parseRangos(texto) {
    const valores = new Set();

    texto.split(',').forEach(fragmento => {
        const partes = fragmento.trim().split('-');

        if (partes.length === 1) {
            const num = parseInt(partes[0]);
            if (!isNaN(num)) valores.add(num);
        } else if (partes.length === 2) {
            const inicio = parseInt(partes[0]);
            const fin = parseInt(partes[1]);

            if (!isNaN(inicio) && !isNaN(fin)) {
                for (let i = inicio; i <= fin; i++) {
                    valores.add(i);
                }
            }
        }
    });

    return Array.from(valores);
}

// ============================================================
// ACTUALIZACIÓN DE ESTADOS
// ============================================================

/**
 * Actualiza los estados de todos los espacios específicos
 */
function actualizarEspecificos() {
    console.log('🔄 Actualizando estados de espacios...');
    
    fetch('/estado-boxes')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('📦 Datos recibidos:', data);
            let actualizados = 0;
            
            for (const [id, info] of Object.entries(data)) {
                const contenedor = document.getElementById(`info-especifico-${id}`);
                if (contenedor) {
                    actualizarContenedorEspacio(contenedor, info);
                    actualizados++;
                }
            }
            
            console.log(`✅ ${actualizados} espacios actualizados`);
            aplicarFiltrosLocales();
        })
        .catch(error => {
            console.error('❌ Error al obtener estados:', error);
        });
}

/**
 * Actualiza el contenido de un contenedor de espacio
 */
function actualizarContenedorEspacio(contenedor, info) {
    const estadoClassName = info.estado.replace(/\s+/g, '-').toLowerCase();
    const claseOculto = detallesVisibles ? '' : 'oculto';
    
    let detallesHTML = '';
    
    // Mostrar información según disponibilidad
    if (info.estado === "Libre" && (!info.proxima_consulta || info.proxima_consulta.trim() === '')) {
        detallesHTML += `
            <div class="info-item info-empty">
                <i class="fas fa-calendar-check"></i>
                <span>${window.translations.notNextAppointment}</span>
            </div>
        `;
    } else if (info.proxima_consulta) {
        detallesHTML += `
            <div class="info-item">
                <i class="fas fa-calendar-alt"></i>
                <div class="info-content">
                    <span class="info-label">${window.translations.nextAppointment}</span>
                    <span class="info-value">${info.proxima_consulta}</span>
                </div>
            </div>
        `;
    }
    
    if (info.medico) {
        detallesHTML += `
            <div class="info-item">
                <i class="fas fa-user-md"></i>
                <div class="info-content">
                    <span class="info-label">${window.nomenclatura.ocupante}</span>
                    <span class="info-value">${info.medico}</span>
                </div>
            </div>
        `;
    }
    
    if (info.especialidad) {
        detallesHTML += `
            <div class="info-item">
                <i class="fas fa-stethoscope"></i>
                <div class="info-content">
                    <span class="info-label">${window.nomenclatura.especialidad}</span>
                    <span class="info-value">${info.especialidad}</span>
                </div>
            </div>
        `;
    }
    
    if (info.consulta_actual) {
        detallesHTML += `
            <div class="info-item">
                <i class="fas fa-clock"></i>
                <div class="info-content">
                    <span class="info-label">${window.translations.time}</span>
                    <span class="info-value">${info.consulta_actual}</span>
                </div>
            </div>
        `;
    }
    
    contenedor.innerHTML = `
        <div class="space-details ${claseOculto}">
            ${detallesHTML}
        </div>
        <div class="space-status-bar ${estadoClassName}">
            <span class="status-text">${info.estado}</span>
        </div>
    `;
    
    // Actualizar indicador de estado en el header
    const card = contenedor.closest('.space-card');
    if (card) {
        const statusIndicator = card.querySelector('.space-status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `space-status-indicator ${estadoClassName}`;
        }
    }
}

// ============================================================
// SISTEMA DE FILTROS
// ============================================================

/**
 * Aplica filtros locales a los espacios mostrados
 */
function aplicarFiltrosLocales() {
    const filtroGeneral = document.getElementById('filtroPasillo').value.trim().toLowerCase();
    const filtroEspecifico = document.getElementById('filtroBox').value.trim().toLowerCase();
    const filtroEstado = document.getElementById('filtroEstado').value.trim();

    const rangosGeneral = filtroGeneral ? parseRangos(filtroGeneral) : [];
    const rangosEspecifico = filtroEspecifico ? parseRangos(filtroEspecifico) : [];

    let tieneResultados = false;
    
    // Procesar cada sección general
    document.querySelectorAll('.space-section').forEach(seccionGeneral => {
        const nombreGeneral = seccionGeneral.dataset.generalNombre.toLowerCase();
        let generalTieneEspecificosVisibles = false;

        // Verificar si el general coincide con el filtro
        let generalCoincide = true;
        if (filtroGeneral) {
            if (rangosGeneral.length > 0) {
                const numeroGeneral = nombreGeneral.match(/\d+/);
                if (numeroGeneral) {
                    generalCoincide = rangosGeneral.includes(parseInt(numeroGeneral[0]));
                } else {
                    generalCoincide = nombreGeneral.includes(filtroGeneral);
                }
            } else {
                generalCoincide = nombreGeneral.includes(filtroGeneral);
            }
        }

        // Procesar espacios específicos dentro de este general
        if (generalCoincide) {
            seccionGeneral.querySelectorAll('.space-card-wrapper').forEach(wrapper => {
                const card = wrapper.querySelector('.space-card');
                if (card) {
                    const nombreEspecifico = card.dataset.especificoNombre.toLowerCase();
                    const statusBar = card.querySelector('.space-status-bar');
                    const estadoActual = statusBar ? statusBar.querySelector('.status-text').textContent.trim().toLowerCase().replace(' ', '-') : '';

                    let especificoCoincide = true;

                    // Filtro por nombre específico
                    if (filtroEspecifico) {
                        if (rangosEspecifico.length > 0) {
                            const numeroEspecifico = nombreEspecifico.match(/\d+/);
                            if (numeroEspecifico) {
                                especificoCoincide = rangosEspecifico.includes(parseInt(numeroEspecifico[0]));
                            } else {
                                especificoCoincide = nombreEspecifico.includes(filtroEspecifico);
                            }
                        } else {
                            especificoCoincide = nombreEspecifico.includes(filtroEspecifico);
                        }
                    }

                    // Filtro por estado
                    if (filtroEstado && especificoCoincide) {
                        especificoCoincide = estadoActual === filtroEstado;
                    }
                
                    // Mostrar/ocultar según resultado
                    if (especificoCoincide) {
                        wrapper.classList.remove('filtrado-oculto');
                        generalTieneEspecificosVisibles = true;
                        tieneResultados = true;
                    } else {
                        wrapper.classList.add('filtrado-oculto');
                    }
                }
            });
        }

        // Mostrar/ocultar sección general
        if (generalCoincide && generalTieneEspecificosVisibles) {
            seccionGeneral.classList.remove('filtrado-oculto');
        } else {
            seccionGeneral.classList.add('filtrado-oculto');
        }
    });

    // Mostrar/ocultar mensaje de sin resultados
    const mensajeNoResultados = document.getElementById('mensaje-no-resultados');
    if (tieneResultados) {
        mensajeNoResultados.classList.add('hidden');
    } else {
        mensajeNoResultados.classList.remove('hidden');
    }

    // Actualizar contadores
    contarEstadosVisibles();
}

/**
 * Aplica filtros con un retraso (debounce)
 */
function aplicarFiltrosConRetraso() {
    clearTimeout(filtroTimeout);
    filtroTimeout = setTimeout(aplicarFiltrosLocales, 300);
}

/**
 * Reinicia todos los filtros
 */
function reiniciarFiltros() {
    document.getElementById('filtroPasillo').value = '';
    document.getElementById('filtroBox').value = '';
    document.getElementById('filtroEstado').value = '';
    
    document.querySelectorAll('.space-section').forEach(el => el.classList.remove('filtrado-oculto'));
    document.querySelectorAll('.space-card-wrapper').forEach(el => el.classList.remove('filtrado-oculto'));
    document.getElementById('mensaje-no-resultados').classList.add('hidden');
    
    contarEstadosVisibles();
}

// ============================================================
// GESTIÓN DE DETALLES
// ============================================================

/**
 * Aplica el estado visual de expansión/colapso de detalles
 */
function aplicarEstadoVisual() {
    const elementos = document.querySelectorAll('.space-details');
    elementos.forEach(el => {
        el.classList.toggle('oculto', !detallesVisibles);
    });
    
    // Guardar preferencia
    localStorage.setItem('detallesVisibles', detallesVisibles);
    
    // Actualizar texto del botón
    const botonToggle = document.getElementById('toggle-detalles');
    if (botonToggle) {
        const iconElement = botonToggle.querySelector('i');
        const textElement = botonToggle.querySelector('.btn-text');
        
        if (detallesVisibles) {
            iconElement.className = 'fas fa-eye-slash';
            textElement.textContent = window.translations.hideDetails;
        } else {
            iconElement.className = 'fas fa-eye';
            textElement.textContent = window.translations.showDetails;
        }
    }
}

// ============================================================
// CONTADORES
// ============================================================

/**
 * Cuenta y actualiza los contadores de estados visibles
 */
function contarEstadosVisibles() {
    const estados = { 'libre': 0, 'en-espera': 0, 'en-uso': 0, 'inhabilitado': 0 };

    document.querySelectorAll('.space-status-bar').forEach(el => {
        const wrapper = el.closest('.space-card-wrapper');
        if (wrapper && !wrapper.classList.contains('filtrado-oculto')) {
            const estado = el.classList.contains('libre') ? 'libre' :
                        el.classList.contains('en-espera') ? 'en-espera' :
                        el.classList.contains('en-uso') ? 'en-uso' :
                        el.classList.contains('inhabilitado') ? 'inhabilitado' : null;
            if (estado) {
                estados[estado]++;
            }
        }
    });

    document.getElementById('count-libre').textContent = estados['libre'];
    document.getElementById('count-en-espera').textContent = estados['en-espera'];
    document.getElementById('count-en-uso').textContent = estados['en-uso'];
    document.getElementById('count-inhabilitado').textContent = estados['inhabilitado'];
}

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Inicializando interfaz de espacios...');
    
    // Configurar botón de toggle de detalles
    const botonToggle = document.getElementById('toggle-detalles');
    if (botonToggle) {
        botonToggle.addEventListener('click', function () {
            detallesVisibles = !detallesVisibles;
            setCookie('detallesVisibles', detallesVisibles);
            aplicarEstadoVisual();
        });
    }

    // Configurar filtros
    const inputGeneral = document.getElementById('filtroPasillo');
    const inputEspecifico = document.getElementById('filtroBox');
    const selectEstado = document.getElementById('filtroEstado');
    
    if (inputGeneral) inputGeneral.addEventListener('input', aplicarFiltrosConRetraso);
    if (inputEspecifico) inputEspecifico.addEventListener('input', aplicarFiltrosConRetraso);
    if (selectEstado) selectEstado.addEventListener('change', aplicarFiltrosLocales);

    // Configurar botón de reset
    const btnResetFilters = document.querySelector('[data-action="reset-filters"]');
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', reiniciarFiltros);
    }

    // Cargar valores de filtros desde URL
    const params = new URLSearchParams(window.location.search);
    if (inputGeneral) inputGeneral.value = params.get('pasillo') || '';
    if (inputEspecifico) inputEspecifico.value = params.get('box') || '';
    if (selectEstado) selectEstado.value = params.get('estado') || '';

    // Aplicar estado inicial
    aplicarEstadoVisual();
    
    // Cargar datos iniciales
    actualizarEspecificos();
    
    console.log('✅ Interfaz inicializada correctamente');
});

// ============================================================
// BOTÓN BACK TO TOP
// ============================================================

(function() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    const threshold = 500;
    let ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        
        requestAnimationFrame(() => {
            const show = window.scrollY > threshold;
            
            if (show) {
                if (!btn.classList.contains('is-visible')) {
                    btn.classList.add('is-visible');
                    btn.setAttribute('aria-hidden', 'false');
                }
            } else {
                if (btn.classList.contains('is-visible')) {
                    btn.classList.remove('is-visible');
                    btn.setAttribute('aria-hidden', 'true');
                }
            }
            
            ticking = false;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', () => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReduced) { 
            window.scrollTo(0, 0); 
            return; 
        }

        const startY = window.scrollY || window.pageYOffset;
        if (startY <= 0) return;

        const MIN = 180;
        const MAX = 500;
        const duration = Math.max(MIN, Math.min(MAX, startY / 4));
        const startTime = performance.now();
        const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = easeOutCubic(t);
            const y = Math.round(startY * (1 - eased));
            window.scrollTo(0, y);
            if (t < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    });
})();

// ============================================================
// WEBSOCKET PARA ACTUALIZACIONES EN TIEMPO REAL
// ============================================================

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const wsEndpointElement = document.querySelector('[data-ws-endpoint]');
const WS_URL = wsEndpointElement ? wsEndpointElement.dataset.wsEndpoint : 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev';

/**
 * Conecta al servidor WebSocket
 */
function connectWebSocket() {
    if (!window.grupoId) {
        console.warn('⚠️ No hay grupoId disponible, no se puede conectar WebSocket');
        return;
    }

    try {
        websocket = new WebSocket(`${WS_URL}?grupo_id=${window.grupoId}`);

        websocket.onopen = () => {
            console.log('✅ WebSocket conectado');
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

/**
 * Maneja mensajes recibidos del WebSocket
 */
function handleWebSocketMessage(message) {
    console.log('📨 Mensaje WebSocket recibido:', message);

    const { type, data } = message;
    
    // Mapeo de tipos legacy a nuevos
    const typeMapping = {
        'INSERT': 'CITA_CREADA',
        'MODIFY': 'CITA_MODIFICADA',
        'REMOVE': 'CITA_ELIMINADA'
    };
    
    const normalizedType = typeMapping[type] || type;

    switch (normalizedType) {
        // Espacios
        case 'ESPACIO_CREADO':
            console.log('🆕 Espacio creado:', data);
            if (window.notificationManager) {
                window.notificationManager.showSpaceCreated(data);
            }
            setTimeout(() => location.reload(), 500);
            break;

        case 'ESPACIO_MODIFICADO':
            console.log('✏️ Espacio modificado:', data);
            if (window.notificationManager) {
                window.notificationManager.showSpaceModified(data);
            }
            invalidarCacheYActualizar();
            break;

        case 'ESPACIO_ELIMINADO':
            console.log('🗑️ Espacio eliminado:', data);
            if (window.notificationManager) {
                window.notificationManager.showSpaceDeleted(data);
            }
            setTimeout(() => location.reload(), 500);
            break;

        // Agendas/Citas
        case 'CITA_CREADA':
            console.log('📅 Cita creada:', data);
            if (window.notificationManager) {
                window.notificationManager.showAppointmentCreated(data);
            }
            invalidarCacheYActualizar();
            break;
            
        case 'CITA_MODIFICADA':
            console.log('📅 Cita modificada:', data);
            if (window.notificationManager) {
                window.notificationManager.showAppointmentModified(data);
            }
            invalidarCacheYActualizar();
            break;
            
        case 'CITA_ELIMINADA':
            console.log('📅 Cita eliminada:', data);
            if (window.notificationManager) {
                window.notificationManager.showAppointmentCancelled(data);
            }
            invalidarCacheYActualizar();
            break;

        // Ocupantes
        case 'OCUPANTE_CREADO':
            console.log('👤 Ocupante creado:', data);
            if (window.notificationManager) {
                window.notificationManager.showOccupantCreated(data);
            }
            invalidarCacheYActualizar();
            break;
            
        case 'OCUPANTE_MODIFICADO':
            console.log('👤 Ocupante modificado:', data);
            if (window.notificationManager) {
                window.notificationManager.showOccupantModified(data);
            }
            invalidarCacheYActualizar();
            break;
            
        case 'OCUPANTE_ELIMINADO':
            console.log('👤 Ocupante eliminado:', data);
            if (window.notificationManager) {
                window.notificationManager.showOccupantDeleted(data);
            }
            invalidarCacheYActualizar();
            break;

        default:
            console.log('ℹ️ Tipo de mensaje no manejado:', type);
    }
}

/**
 * Invalida la caché del servidor y actualiza los datos
 */
function invalidarCacheYActualizar() {
    console.log('🔄 Iniciando invalidación de caché...');
    
    Promise.all([
        fetch('/invalidar-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'estados' })
        }),
        fetch('/invalidar-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'agendas' })
        })
    ])
    .then(() => {
        console.log('🗑️ Cachés invalidados en servidor (estados + agendas)');
        setTimeout(() => {
            actualizarEspecificos();
        }, 300);
    })
    .catch(err => {
        console.error('❌ Error invalidando caché:', err);
        actualizarEspecificos();
    });
}

/**
 * Desconecta el WebSocket
 */
function disconnectWebSocket() {
    if (websocket) {
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
        websocket.close();
        websocket = null;
    }
}

// Conectar al WebSocket cuando se carga la página
if (window.grupoId) {
    connectWebSocket();
}

// Desconectar al salir de la página
window.addEventListener('beforeunload', disconnectWebSocket);