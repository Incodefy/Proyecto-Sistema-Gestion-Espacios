// public/js/box.js
const valorGuardado = localStorage.getItem('detallesVisibles');
let detallesVisibles = valorGuardado === 'true';
let filtroTimeout;

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

function actualizarBoxes() {
    fetch('/estado-boxes/')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            for (const [id, info] of Object.entries(data)) {
                const contenedor = document.getElementById(`info-box-${id}`);
                if (contenedor) {
                    const estadoClassName = info.estado.replace(/\s+/g, '-').toLowerCase();
                    const claseOculto = detallesVisibles ? '' : 'oculto';
                    const displayStyle = detallesVisibles ? 'flex' : 'none';
                    contenedor.innerHTML = `
                        <div class="contenido-box ${claseOculto}" style="display: ${displayStyle};">
                            ${info.estado === "Libre" && (!info.proxima_consulta || info.proxima_consulta.trim() === '') 
                                ? `<p>${window.translations.notNextAppointment}</p>`
                                : (info.proxima_consulta 
                                    ? `<p>${window.translations.nextAppointment}: ${info.proxima_consulta}</p>` 
                                    : '')}
                            ${info.consulta_actual ? `<p>${window.translations.time}: ${info.consulta_actual}</p>` : ''}
                            ${info.medico ? `<p>${window.translations.doctor}: ${info.medico}</p>` : ''}
                            ${info.especialidad ? `<p>${window.translations.specialty}: ${info.especialidad}</p>` : ''}
                        </div>
                        <div class="estado-bar ${estadoClassName}">${info.estado}</div>
                    `;
                }
            }
            aplicarFiltrosLocales();
        })
        .catch(error => {
            console.error('Error al obtener estados:', error);
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
                actualizarBoxes();
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
                        ${info.medico ? `<p>${window.translations.doctor}: ${info.medico}</p>` : ''}
                        ${info.especialidad ? `<p>${window.translations.specialty}: ${info.especialidad}</p>` : ''}
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
    const filtroPasillo = document.getElementById('filtroPasillo').value.trim().toLowerCase();
    const filtroBox = document.getElementById('filtroBox').value.trim().toLowerCase();
    const filtroEstado = document.getElementById('filtroEstado').value.trim();

    const rangosPasillo = filtroPasillo ? parseRangos(filtroPasillo) : [];
    const rangosBox = filtroBox ? parseRangos(filtroBox) : [];

    let tieneResultados = false;
    
    document.querySelectorAll('.pasillo-bloque').forEach(pasilloBloque => {
        const nombrePasillo = pasilloBloque.dataset.pasilloNombre.toLowerCase();
        let pasilloTieneBoxesVisibles = false;

        let pasilloCoincide = true;
        if (filtroPasillo) {
            if (rangosPasillo.length > 0) {
                const numeroPasillo = nombrePasillo.match(/\d+/);
                if (numeroPasillo) {
                    pasilloCoincide = rangosPasillo.includes(parseInt(numeroPasillo[0]));
                } else {
                    pasilloCoincide = nombrePasillo.includes(filtroPasillo);
                }
            } else {
                pasilloCoincide = nombrePasillo.includes(filtroPasillo);
            }
        }

        if (pasilloCoincide) {
            pasilloBloque.querySelectorAll('.col-12, .col-sm-6, .col-md-4, .col-lg-4, .col-xl-3, .col-xxl-2').forEach(colBox => {
                const boxCard = colBox.querySelector('.box-card');
                if (boxCard) {
                    const nombreBox = boxCard.dataset.boxNombre.toLowerCase();
                    const estadoBar = boxCard.querySelector('.estado-bar');
                    const estadoActual = estadoBar ? estadoBar.textContent.trim().toLowerCase().replace(' ', '-') : '';

                    let boxCoincide = true;

                    if (filtroBox) {
                        if (rangosBox.length > 0) {
                            const numeroBox = nombreBox.match(/\d+/);
                            if (numeroBox) {
                                boxCoincide = rangosBox.includes(parseInt(numeroBox[0]));
                            } else {
                                boxCoincide = nombreBox.includes(filtroBox);
                            }
                        } else {
                            boxCoincide = nombreBox.includes(filtroBox);
                        }
                    }

                    if (filtroEstado && boxCoincide) {
                        boxCoincide = estadoActual === filtroEstado;
                    }
                
                    if (boxCoincide) {
                        colBox.classList.remove('filtrado-oculto');
                        pasilloTieneBoxesVisibles = true;
                        tieneResultados = true;
                    } else {
                        colBox.classList.add('filtrado-oculto');
                    }
                }
            });
        }

        if (pasilloCoincide && pasilloTieneBoxesVisibles) {
            pasilloBloque.classList.remove('filtrado-oculto');
        } else {
            pasilloBloque.classList.add('filtrado-oculto');
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
    
    document.querySelectorAll('.pasillo-bloque').forEach(el => el.classList.remove('filtrado-oculto'));
    document.querySelectorAll('.col-12, .col-sm-6, .col-md-4, .col-lg-4, .col-xl-3, .col-xxl-2').forEach(el => el.classList.remove('filtrado-oculto'));
    document.getElementById('mensaje-no-resultados').style.display = 'none';
    
    contarEstadosVisibles();
}

function aplicarEstadoVisual() {
    const elementos = document.querySelectorAll('.contenido-box');
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

    // Inicializar el estado desde localStorage
    const valorGuardado = localStorage.getItem('detallesVisibles');
    detallesVisibles = valorGuardado === 'true';

    // Actualizar el texto del botón
    botonToggle.textContent = detallesVisibles ? window.translations.hideDetails : window.translations.showDetails;

    // Agregar el evento click
    botonToggle.addEventListener('click', function () {
        detallesVisibles = !detallesVisibles;
        localStorage.setItem('detallesVisibles', detallesVisibles);
        botonToggle.textContent = detallesVisibles ? window.translations.hideDetails : window.translations.showDetails;
        aplicarEstadoVisual();
    });

    document.getElementById('filtroPasillo').addEventListener('input', aplicarFiltrosConRetraso);
    document.getElementById('filtroBox').addEventListener('input', aplicarFiltrosConRetraso);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltrosLocales);

    const params = new URLSearchParams(window.location.search);
    document.getElementById('filtroPasillo').value = params.get('pasillo') || '';
    document.getElementById('filtroBox').value = params.get('box') || '';
    document.getElementById('filtroEstado').value = params.get('estado') || '';

    aplicarEstadoVisual();
    actualizarBoxes();
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