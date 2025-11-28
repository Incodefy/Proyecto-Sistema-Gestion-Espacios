// public/js/box.js
// Obtener estado inicial desde el servidor (renderizado en la vista)
let detallesVisibles = window.detallesVisiblesInicial !== undefined ? window.detallesVisiblesInicial : false;
let filtroTimeout;

// Función helper para establecer cookies
function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

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
                    const estadoClassName = info.estado.replace(/\s+/g, '-').toLowerCase();
                    const claseOculto = detallesVisibles ? '' : 'oculto';
                    const displayStyle = detallesVisibles ? 'flex' : 'none';
                    contenedor.innerHTML = `
                        <div class="contenido-especifico ${claseOculto}" style="display: ${displayStyle};">
                            ${info.estado === "Libre" && (!info.proxima_consulta || info.proxima_consulta.trim() === '') 
                                ? `<p>${window.translations.notNextAppointment}</p>`
                                : (info.proxima_consulta 
                                    ? `<p>${window.translations.nextAppointment}: ${info.proxima_consulta}</p>` 
                                    : '')}
                            ${info.consulta_actual ? `<p>${window.translations.time}: ${info.consulta_actual}</p>` : ''}
                            ${info.medico ? `<p>${window.nomenclatura.ocupante}: ${info.medico}</p>` : ''}
                            ${info.especialidad ? `<p>${window.nomenclatura.especialidad}: ${info.especialidad}</p>` : ''}
                        </div>
                        <div class="estado-bar ${estadoClassName}">${info.estado}</div>
                    `;
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

document.addEventListener('click', function (e) {
    if (e.target.closest('.btn-confirmar')) {
        e.preventDefault();
        e.stopPropagation();

        const btn = e.target.closest('.btn-confirmar');
        const agendaId = btn.getAttribute('data-agenda-id');

        fetch(`/actualizar-estado/${agendaId}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log('Estado actualizado correctamente');
                actualizarEspecificos();
            } else {
                console.error('Error:', data.error);
            }
        })
        .catch(err => console.error('Error:', err));
    }
});

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

function actualizarBoxesBatch(boxIds) {
    if (!Array.isArray(boxIds) || boxIds.length === 0) {
        console.warn('⚠️ actualizarBoxesBatch: lista de boxIds vacía');
        return;
    }

    fetch('/estado-boxes-batch/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_ids: boxIds })
    })
    .then(response => response.json())
    .then(data => {
        for (const [id, info] of Object.entries(data)) {
            const contenedor = document.getElementById(`info-box-${id}`);
            if (contenedor) {
                const estadoClassName = info.estado.replace(/\s+/g, '-').toLowerCase();
                const claseOculto = detallesVisibles ? '' : 'oculto';
                const displayStyle = detallesVisibles ? 'flex' : 'none';
                contenedor.innerHTML = `
                    <div class="contenido-box ${claseOculto}" style="display: ${displayStyle};">
                        ${info.proxima_consulta ? `<p>${window.translations.nextAppointment}: ${info.proxima_consulta}</p>` : ''}
                        ${info.consulta_actual ? `<p>${window.translations.time}: ${info.consulta_actual}</p>` : ''}
                        ${info.medico ? `<p>${window.nomenclatura.ocupante}: ${info.medico}</p>` : ''}
                        ${info.especialidad ? `<p>${window.nomenclatura.especialidad}: ${info.especialidad}</p>` : ''}
                    </div>
                    <div class="estado-bar ${estadoClassName}">${info.estado}</div>
                `;
            }
        }
        aplicarFiltrosLocales();
    })
    .catch(error => {
        console.error('Error al obtener estados batch:', error);
    });
}

function aplicarFiltrosLocales() {
    const filtroGeneral = document.getElementById('filtroPasillo').value.trim().toLowerCase();
    const filtroEspecifico = document.getElementById('filtroBox').value.trim().toLowerCase();
    const filtroEstado = document.getElementById('filtroEstado').value.trim();

    const rangosGeneral = filtroGeneral ? parseRangos(filtroGeneral) : [];
    const rangosEspecifico = filtroEspecifico ? parseRangos(filtroEspecifico) : [];

    let tieneResultados = false;
    
    document.querySelectorAll('.general-bloque').forEach(generalBloque => {
        const nombreGeneral = generalBloque.dataset.generalNombre.toLowerCase();
        let generalTieneEspecificosVisibles = false;

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

        if (generalCoincide) {
            generalBloque.querySelectorAll('.col-12, .col-sm-6, .col-md-4, .col-lg-4, .col-xl-3, .col-xxl-2').forEach(colEspecifico => {
                const especificoCard = colEspecifico.querySelector('.especifico-card');
                if (especificoCard) {
                    const nombreEspecifico = especificoCard.dataset.especificoNombre.toLowerCase();
                    const estadoBar = especificoCard.querySelector('.estado-bar');
                    const estadoActual = estadoBar ? estadoBar.textContent.trim().toLowerCase().replace(' ', '-') : '';

                    let especificoCoincide = true;

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

                    if (filtroEstado && especificoCoincide) {
                        especificoCoincide = estadoActual === filtroEstado;
                    }
                
                    if (especificoCoincide) {
                        colEspecifico.classList.remove('filtrado-oculto');
                        generalTieneEspecificosVisibles = true;
                        tieneResultados = true;
                    } else {
                        colEspecifico.classList.add('filtrado-oculto');
                    }
                }
            });
        }

        if (generalCoincide && generalTieneEspecificosVisibles) {
            generalBloque.classList.remove('filtrado-oculto');
        } else {
            generalBloque.classList.add('filtrado-oculto');
        }
    });

    const mensajeNoResultados = document.getElementById('mensaje-no-resultados');
    if (tieneResultados) {
        mensajeNoResultados.style.display = 'none';
    } else {
        mensajeNoResultados.style.display = 'block';
    }

    contarEstadosVisibles();
}

function aplicarFiltrosConRetraso() {
    clearTimeout(filtroTimeout);
    filtroTimeout = setTimeout(aplicarFiltrosLocales, 300);
}

function reiniciarFiltros() {
    document.getElementById('filtroPasillo').value = '';
    document.getElementById('filtroBox').value = '';
    document.getElementById('filtroEstado').value = '';
    
    document.querySelectorAll('.general-bloque').forEach(el => el.classList.remove('filtrado-oculto'));
    document.querySelectorAll('.col-12, .col-sm-6, .col-md-4, .col-lg-4, .col-xl-3, .col-xxl-2').forEach(el => el.classList.remove('filtrado-oculto'));
    document.getElementById('mensaje-no-resultados').style.display = 'none';
    
    contarEstadosVisibles();
}

function aplicarEstadoVisual() {
    const elementos = document.querySelectorAll('.contenido-especifico');
    elementos.forEach(el => {
        el.classList.toggle('oculto', !detallesVisibles);
        el.style.display = detallesVisibles ? 'flex' : 'none';
    });
    localStorage.setItem('detallesVisibles', detallesVisibles);
}

function contarEstadosVisibles() {
    const estados = { 'libre': 0, 'en-espera': 0, 'en-uso': 0, 'inhabilitado': 0 };

    document.querySelectorAll('.estado-bar').forEach(el => {
        const colContainer = el.closest('.col-12, .col-sm-6, .col-md-4, .col-lg-4, .col-xl-3, .col-xxl-2');
        if (colContainer && !colContainer.classList.contains('filtrado-oculto')) {
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

document.addEventListener('DOMContentLoaded', function () {
    const botonToggle = document.getElementById('toggle-detalles');

    // Actualizar el texto del botón según estado inicial
    botonToggle.textContent = detallesVisibles ? window.translations.hideDetails : window.translations.showDetails;

    // Agregar el evento click
    botonToggle.addEventListener('click', function () {
        detallesVisibles = !detallesVisibles;
        
        // Guardar en localStorage y cookie
        localStorage.setItem('detallesVisibles', detallesVisibles);
        setCookie('detallesVisibles', detallesVisibles);
        
        botonToggle.textContent = detallesVisibles ? window.translations.hideDetails : window.translations.showDetails;
        aplicarEstadoVisual();
        
        // Recargar página con el parámetro para que el servidor renderice correctamente
        const url = new URL(window.location);
        url.searchParams.set('detallesVisibles', detallesVisibles);
        window.location.href = url.toString();
    });

    document.getElementById('filtroPasillo').addEventListener('input', aplicarFiltrosConRetraso);
    document.getElementById('filtroBox').addEventListener('input', aplicarFiltrosConRetraso);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltrosLocales);

    const params = new URLSearchParams(window.location.search);
    document.getElementById('filtroPasillo').value = params.get('pasillo') || '';
    document.getElementById('filtroBox').value = params.get('box') || '';
    document.getElementById('filtroEstado').value = params.get('estado') || '';

    aplicarEstadoVisual();
    actualizarEspecificos();
});

document.addEventListener('DOMContentLoaded', () => {
    const t = document.querySelector('.fab-consultas');
    if (t) new bootstrap.Tooltip(t);
});

(function(){
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  const threshold = 500;
  let ticking = false;

  function onScroll(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const show = window.scrollY > threshold;
      if (show) {
        if (!btn.classList.contains('is-visible')){
          btn.classList.add('is-visible');
          btn.setAttribute('aria-hidden','false');
        }
      } else {
        if (btn.classList.contains('is-visible')){
          btn.classList.remove('is-visible');
          btn.setAttribute('aria-hidden','true');
        }
      }
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  btn.addEventListener('click', () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { window.scrollTo(0,0); return; }

    const startY = window.scrollY || window.pageYOffset;
    if (startY <= 0) return;

    const MIN = 180;
    const MAX = 500;
    const duration = Math.max(MIN, Math.min(MAX, startY / 4));

    const startTime = performance.now();
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    function step(now){
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      const y = Math.round(startY * (1 - eased));
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  });
})();

// ============ WEBSOCKET PARA ACTUALIZACIONES EN TIEMPO REAL ============

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const WS_URL = 'wss://erwiw5frx8.execute-api.us-east-2.amazonaws.com/dev';

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

function handleWebSocketMessage(message) {
    console.log('📨 Mensaje WebSocket recibido:', message);

    const { type, data } = message;

    switch (type) {
        // Espacios
        case 'ESPACIO_CREADO':
            console.log('🆕 Espacio creado:', data);
            // Recargar la página para mostrar el nuevo espacio
            setTimeout(() => location.reload(), 500);
            break;

        case 'ESPACIO_MODIFICADO':
            console.log('✏️ Espacio modificado:', data);
            // Actualizar estados y invalidar caché
            invalidarCacheYActualizar();
            break;

        case 'ESPACIO_ELIMINADO':
            console.log('🗑️ Espacio eliminado:', data);
            // Recargar la página para eliminar el espacio
            setTimeout(() => location.reload(), 500);
            break;

        // Agendas/Citas (tipos nuevos y legacy)
        case 'CITA_CREADA':
        case 'CITA_MODIFICADA':
        case 'CITA_ELIMINADA':
        case 'INSERT':  // Legacy type
        case 'MODIFY':  // Legacy type
        case 'REMOVE':  // Legacy type
            console.log('📅 Cambio en agenda:', type, data);
            // Actualizar estados sin recargar
            invalidarCacheYActualizar();
            break;

        // Ocupantes
        case 'OCUPANTE_CREADO':
        case 'OCUPANTE_MODIFICADO':
        case 'OCUPANTE_ELIMINADO':
            console.log('👤 Cambio en ocupante:', type, data);
            // Los ocupantes afectan las agendas
            invalidarCacheYActualizar();
            break;

        default:
            console.log('ℹ️ Tipo de mensaje no manejado:', type);
    }
}

function invalidarCacheYActualizar() {
    console.log('🔄 Iniciando invalidación de caché...');
    // Invalidar ambos cachés: estados y agendas
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
        // Esperar un momento antes de actualizar para asegurar que el caché se limpió
        setTimeout(() => {
            actualizarEspecificos();
        }, 300);
    })
    .catch(err => {
        console.error('❌ Error invalidando caché:', err);
        // Actualizar de todas formas
        actualizarEspecificos();
    });
}

function disconnectWebSocket() {
    if (websocket) {
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Evitar reconexión automática
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