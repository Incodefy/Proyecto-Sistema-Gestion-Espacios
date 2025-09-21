// Nuevo sistema de Toast - Versión simplificada y funcional
class SimpleToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toastId = 0;
        this.toasts = new Map();
    }

    createContainer() {
        // Eliminar contenedor existente si existe
        const existing = document.querySelector('.toast-container-new');
        if (existing) {
            existing.remove();
        }

        const container = document.createElement('div');
        container.className = 'toast-container-new';
        container.id = 'toastContainerNew';
        document.body.appendChild(container);
        return container;
    }

    show(type, title, message, duration = 5000) {
        const id = ++this.toastId;
        const toast = this.createToast(id, type, title, message, duration);
        
        this.container.appendChild(toast);
        this.toasts.set(id, toast);

        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }

        return id;
    }

    createToast(id, type, title, message, duration) {
        const toast = document.createElement('div');
        toast.className = `toast-new ${type}`;
        toast.setAttribute('data-toast-id', id);

        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <div class="toast-icon-new">${icon}</div>
            <div class="toast-content-new">
                <div class="toast-title-new">${title}</div>
                <div class="toast-message-new">${message}</div>
            </div>
            <button class="toast-close-new" onclick="simpleToastManager.remove(${id})">&times;</button>
            ${duration > 0 ? `
                <div class="toast-progress-new">
                    <div class="toast-progress-bar-new"></div>
                </div>
            ` : ''}
        `;

        if (duration > 0) {
            setTimeout(() => {
                const progressBar = toast.querySelector('.toast-progress-bar-new');
                if (progressBar) {
                    progressBar.style.transform = 'scaleX(0)';
                    progressBar.style.transitionDuration = duration + 'ms';
                }
            }, 50);
        }

        return toast;
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || 'ℹ';
    }

    remove(id) {
        const toast = this.toasts.get(id);
        if (!toast) return;

        toast.classList.add('hiding');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(id);
        }, 300);
    }
}

// Inicializar el nuevo sistema
const simpleToastManager = new SimpleToastManager();

// Nuevas funciones globales (reemplazan las anteriores)
function showSuccessToast(message, duration = 4000) {
    return simpleToastManager.show('success', 'Éxito', message, duration);
}

function showErrorToast(message, duration = 4000) {
    return simpleToastManager.show('error', 'Error', message, duration);
}

function showWarningToast(message, duration = 4000) {
    return simpleToastManager.show('warning', 'Advertencia', message, duration);
}

function showInfoToast(message, duration = 4000) {
    return simpleToastManager.show('info', 'Información', message, duration);
}

// ====== VARIABLES GLOBALES Y CONFIGURACIÓN ======
const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function ajustarAInicioDeSemana(fechaInput) {
    let f;

    if (typeof fechaInput === "string") {
        const partes = fechaInput.split("-");
        const anio = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const dia = parseInt(partes[2], 10);
        f = new Date(anio, mes, dia);
    } else if (fechaInput instanceof Date) {
        f = new Date(fechaInput.getFullYear(), fechaInput.getMonth(), fechaInput.getDate());
    } else {
        throw new Error("Formato de fecha no válido");
    }

    f.setHours(0, 0, 0, 0);

    const diaSemana = f.getDay();

    if (diaSemana === 1) return f;

    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    f.setDate(f.getDate() + diff);

    return f;
}

let fechaInicioActual = ajustarAInicioDeSemana(new Date());

function actualizarURL() {
    const url = new URL(window.location);
    const startActual = fechaInicioActual.toISOString().split("T")[0];
    const entidadValue = document.getElementById("selectEntidad").value;

    url.searchParams.set("start", startActual);
    url.searchParams.set(CONFIG.entidadParam, entidadValue);
    
    const otrosParams = TIPO_CALENDARIO === "box" ? ["medico"] : ["box"];
    otrosParams.forEach(param => url.searchParams.delete(param));

    window.history.pushState({}, "", url);
}

function cambiarSemana(direccion) {
    fechaInicioActual.setDate(fechaInicioActual.getDate() + direccion * 7);
    actualizarRangoFechas();
    actualizarURL();
    cargarAgendamientos();
}

function actualizarRangoFechas() {
    const inicio = new Date(fechaInicioActual);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);

    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    const inicioStr = inicio.toLocaleDateString('es-CL', opciones);
    const finStr = fin.toLocaleDateString('es-CL', opciones);

    document.getElementById("rangoFechas").innerText = `${inicioStr} - ${finStr}`;
}

function obtenerIndiceDiaSemana(fechaStr) {
    const fecha = new Date(fechaStr);
    const day = fecha.getDay();
    return day;
}

function normalizarHora(str) {
    return str.replace(/\s/g, '').toLowerCase();
}

function limpiarCalendario() {
    document.querySelectorAll("tbody td").forEach(td => {
        if (!td.classList.contains("hora-col")) {
            td.innerHTML = "";
        }
    });
}

function cambiarEntidad() {
    const label = document.getElementById("label");
    const entidadValue = document.getElementById("selectEntidad").value;
    
    label.innerText = entidadValue ? `${CONFIG.labelPrefix} ${entidadValue}` : CONFIG.labelPrefix;

    const url = new URL(window.location);
    url.searchParams.set(CONFIG.entidadParam, entidadValue);
    window.history.pushState({}, "", url);

    cargarAgendamientos();
}

// No necesitamos getCookie en Node.js
function getCookie(name) {
    // Para Node.js, no necesitamos CSRF token en las requests
    return '';
}

function allowDrop(ev) {
    ev.preventDefault();
    document.getElementById('basurero').classList.add('drag-over');
}

let agendaCache = [];

function fetchAgenda(itemId) {
    let tipoParam, entidadIdParam;

    if (CONFIG.entidadId === "box_id") {
        tipoParam = "medico";
        entidadIdParam = "medico_id";
    } else {
        tipoParam = "box";
        entidadIdParam = "box_id";
    }

    const fechaInicioValue = fechaInicioActual.toISOString().split("T")[0];
    const url = `/agenda/obtener-agendamientos?tipo=${tipoParam}&${entidadIdParam}=${itemId}&fecha_inicio=${fechaInicioValue}`;
    
    return fetch(url)
        .then(response => response.json())
        .then(data => {
            agendaCache = data.agendamientos || [];
        });
}

function drag(ev) {
    const draggedId = ev.target.id;
    ev.dataTransfer.setData("text", draggedId);

    const itemId = draggedId.replace(CONFIG.itemIdPrefix, "");

    const entidad_id = document.getElementById("selectEntidad").value;

    if (!entidad_id) {
        // Si no hay entidad → todas las celdas en rojo
        document.querySelectorAll(".dropzone").forEach(celda => {
            celda.classList.remove("dropzone-ok");
            celda.classList.add("dropzone-no");
        });
        return; // salir sin seguir
    }

    fetchAgenda(itemId).then(() => {
        // Primero, limpiamos cualquier rastro previo
        document.querySelectorAll(".dropzone").forEach(celda => {
            celda.classList.remove("dropzone-ok", "dropzone-no");
        });

        agendaCache.forEach(agenda => {
            const diaIndex = obtenerIndiceDiaSemana(agenda.fecha);
            const horaCompleta = `${agenda.horainicio} - ${agenda.horafin}`;

            // misma lógica que cargarAgendamientos
            document.querySelectorAll("tbody tr").forEach(fila => {
                const horaTexto = fila.querySelector("td.hora-col").innerText.trim();

                if (normalizarHora(horaTexto) === normalizarHora(horaCompleta)) {
                    const columnas = fila.querySelectorAll("td");
                    const celda = columnas[diaIndex + 1]; // +1 por columna de hora
                    if (celda) {
                        celda.classList.add("dropzone-no");
                    }
                }
            });
        });

        // Y marcamos el resto como válidas si están vacías y no fueron bloqueadas
        document.querySelectorAll(".dropzone").forEach(celda => {
            const celdaOcupada = celda.children.length > 0;
            if (celdaOcupada) {
                celda.classList.add("dropzone-no");
            } else if (!celda.classList.contains("dropzone-no")) {
                celda.classList.add("dropzone-ok");
            }
        });
    });
}

function dragend(ev) {
    document.querySelectorAll('.dropzone').forEach(celda => {
        celda.classList.remove('dropzone-ok', 'dropzone-no');
    });
}

function drop(ev) {
    ev.preventDefault();

    let celda = ev.target;
    while (!celda.classList.contains("dropzone")) {
        celda = celda.parentElement;
        if (!celda) {
            showErrorToast("No se pudo identificar la celda destino.")
            return;
        }
    }

    const data = ev.dataTransfer.getData("text");
    const box = document.getElementById(data).cloneNode(true);

    const item_id = data.replace(CONFIG.itemIdPrefix, "");
    const diaIndex = parseInt(celda.getAttribute("data-dia-index"));

    const fila = celda.parentElement;
    const hora = fila.querySelector("td.hora-col").innerText;
    const entidad_id = document.getElementById("selectEntidad").value;

    if (!entidad_id) {
        showInfoToast(`Debes seleccionar primero un ${TIPO_CALENDARIO} antes de agendar.`);
        return;
    }

    const fecha_agendada = new Date(fechaInicioActual);
    fecha_agendada.setDate(fecha_agendada.getDate() + diaIndex);
    const yyyy = fecha_agendada.getFullYear();
    const mm = String(fecha_agendada.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha_agendada.getDate()).padStart(2, '0');
    const fecha_inicio = `${yyyy}-${mm}-${dd}`;

    const tipoSeleccionado = document.querySelector('input[name="tipoUsuario"]:checked').value;

    const payload = {
        dia: dias[diaIndex],
        hora: hora,
        fecha_inicio: fecha_inicio,
        tipo_usuario: tipoSeleccionado
    };
    payload[CONFIG.entidadId] = entidad_id;
    payload[CONFIG.itemIdField] = item_id;

    fetch("/agenda/guardar-agenda", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            celda.innerHTML = '';
            celda.appendChild(box);
            cargarAgendamientos();
        } else if (data.status === 'error') {
            showErrorToast(data.mensaje);
        }
    })
    .catch(error => {
        console.error("Error al guardar agenda:", error);
        showErrorToast("Ocurrió un error al intentar guardar la agenda.");
    });
}

function moverAlBasurero(ev) {
    ev.preventDefault();
    
    const dataId = ev.dataTransfer.getData("text");
    const reservaElement = document.getElementById(dataId);

    if (!reservaElement) return;

    const celda = reservaElement.parentElement;
    if (!celda.classList.contains("dropzone")) return;

    const itemId = reservaElement.dataset.nombreId;
    const fecha = reservaElement.dataset.fecha;
    const horaInicio = reservaElement.dataset.horaInicio;
    const horaFin = reservaElement.dataset.horaFin;
    const entidad_id = document.getElementById("selectEntidad").value;

    if (!entidad_id) {
        showWarningToast(`Por favor selecciona un ${CONFIG.labelPrefix.toLowerCase()} antes de eliminar una agendación.`);
        return;
    }

    const payload = {
        fecha: fecha,
        hora: `${horaInicio} - ${horaFin}`
    };
    payload[CONFIG.entidadId] = entidad_id;
    payload[CONFIG.itemIdField] = itemId;

    fetch(CONFIG.eliminarEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            reservaElement.classList.add('fade-out');

            reservaElement.addEventListener('animationend', () => {
                celda.innerHTML = "";
                cargarAgendamientos();
            });

        } else if (data.status === 'error') {
            showErrorToast(data.mensaje);
        }
    })
    .catch(error => {
        console.error("Error al eliminar reserva:", error);
        showErrorToast("Ocurrió un error al intentar eliminar la reserva.");
    });
}

function toggleFiltros() {
    const contenedor = document.getElementById('contenedorFiltros');
    contenedor.classList.toggle('oculto');
}

function filtrarItems() {
    const checks = document.querySelectorAll('.filtro');
    const activas = Array.from(checks).filter(c => c.checked).map(c => c.value);
    const bloques = document.querySelectorAll('.bloque');

    let visible = 0;

    bloques.forEach(bloque => {
        const nombre = bloque.dataset.grupo;
        if (activas.includes(nombre)) {
            bloque.style.display = 'block';
            visible++;
        } else {
            bloque.style.display = 'none';
        }
    });
}

function cargarAgendamientos() {
    const entidad_id = document.getElementById("selectEntidad").value;
    const fechaInicio = fechaInicioActual.toISOString().split("T")[0];

    console.log('=== DEBUG cargarAgendamientos ===');
    console.log('TIPO_CALENDARIO:', TIPO_CALENDARIO);
    console.log('CONFIG:', CONFIG);
    console.log('entidad_id:', entidad_id);
    console.log('CONFIG.entidadId:', CONFIG.entidadId);
    console.log('fechaInicio:', fechaInicio);

    // Si no hay entidad seleccionada, no hacer la petición
    if (!entidad_id) {
        console.log('No hay entidad seleccionada, saltando carga de agendamientos');
        limpiarCalendario();
        return;
    }

    const url = `/agenda/obtener-agendamientos?tipo=${TIPO_CALENDARIO}&${CONFIG.entidadId}=${entidad_id}&fecha_inicio=${fechaInicio}`;
    console.log('URL construida:', url);

    fetch(url)
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) throw new Error("Error al obtener los agendamientos");
            return response.json();
        })
        .then(data => {
            console.log('Datos recibidos:', data);
            if (data.error) return console.error(data.error);

            limpiarCalendario();
            data.agendamientos.forEach(agenda => {
                const diaIndex = obtenerIndiceDiaSemana(agenda.fecha);
                const horaCompleta = `${agenda.horainicio} - ${agenda.horafin}`;

                document.querySelectorAll("tbody tr").forEach(fila => {
                    const horaTexto = fila.querySelector("td.hora-col").innerText.trim();
                    if (normalizarHora(horaTexto) === normalizarHora(horaCompleta)) {
                        const columnas = fila.querySelectorAll("td");
                        const celda = columnas[diaIndex + 1];
                        if (celda) {
                            const reservaDiv = document.createElement("div");
                            reservaDiv.classList.add("reserva");
                            reservaDiv.setAttribute("draggable", "true");
                            reservaDiv.setAttribute("ondragstart", "drag(event)");

                            // Adaptado para Node.js - usar campos correctos
                            const nombreId = TIPO_CALENDARIO === 'box' ? agenda.idmedico : agenda.idbox;
                            const nombre = TIPO_CALENDARIO === 'box' ? agenda.medico_nombre : agenda.box_nombre;
                            const detalle = TIPO_CALENDARIO === 'box' ? agenda.estado_nombre : agenda.tipoconsulta;

                            reservaDiv.setAttribute("id", `reserva-${nombreId}-${agenda.fecha}-${agenda.horainicio}`);

                            reservaDiv.dataset.nombreId = nombreId;
                            reservaDiv.dataset.nombre = nombre;
                            reservaDiv.dataset.fecha = agenda.fecha;
                            reservaDiv.dataset.horaInicio = agenda.horainicio;
                            reservaDiv.dataset.horaFin = agenda.horafin;

                            const contenido = `
                                <div class="reserva-card">
                                    <div class="reserva-nombre">${nombre || 'Sin nombre'}</div>
                                    <div class="reserva-especialidad">${detalle || 'Sin detalle'}</div>
                                </div>
                            `;

                            celda.innerHTML = "";
                            reservaDiv.innerHTML = contenido;
                            celda.appendChild(reservaDiv);
                        }
                    }
                });
            });
        })
        .catch(error => {
            console.error("Error al cargar agendamientos:", error);
            console.error("URL que falló:", url);
        });
}

function filtrarSubentidades() {
    const parentId = document.getElementById("selectParent").value;
    const selectEntidad = document.getElementById("selectEntidad");

    Array.from(selectEntidad.options).forEach(option => {
        if (option.value === "") {
            option.style.display = "block";
        } else {
            const parentValue = option.getAttribute("data-parent");
            option.style.display = (parentValue === parentId) ? "block" : "none";
        }
    });

    selectEntidad.value = "";
}

// ====== MODAL FUNCTIONS ======
function filtrarBoxes() {
    const parentId = document.getElementById("selectPasillo").value;
    const selectEntidad = document.getElementById("selectBox");

    Array.from(selectEntidad.options).forEach(option => {
        if (option.value === "") {
            option.style.display = "block";
        } else {
            const parentValue = option.getAttribute("data-parent");
            option.style.display = (parentValue === parentId) ? "block" : "none";
        }
    });

    selectEntidad.value = "";
}

function filtrarMedicos() {
    const parentId = document.getElementById("selectEspecialidad").value;
    const selectEntidad = document.getElementById("selectMedico");

    Array.from(selectEntidad.options).forEach(option => {
        if (option.value === "") {
            option.style.display = "block";
        } else {
            const parentValue = option.getAttribute("data-parent");
            option.style.display = (parentValue === parentId) ? "block" : "none";
        }
    });

    selectEntidad.value = "";
}

// Función para llenar las horas disponibles
function llenarHorasDisponibles() {
    const horaSelect = document.getElementById("hora");
    const horas = [
        "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
        "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
        "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
        "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
    ];

    // Limpiar las opciones existentes
    horaSelect.innerHTML = '<option value="">-- Selecciona hora --</option>';

    // Llenar el selector de horas
    horas.forEach(hora => {
        const option = document.createElement("option");
        option.value = hora;
        option.textContent = hora;
        horaSelect.appendChild(option);
    });
}

// ====== EVENT LISTENERS ======
document.addEventListener("DOMContentLoaded", () => {
    // Modal functionality
    const modal = document.getElementById("modalAgendar");
    const btn = document.getElementById("btnAgendar");
    const span = document.getElementById("closeModal");

    // Abrir el modal al hacer clic en el botón
    btn.onclick = function() {
        modal.style.display = "block";
        llenarHorasDisponibles(); // Llenar horas al abrir el modal
    }

    // Cerrar el modal al hacer clic en la "x"
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Cerrar el modal al hacer clic fuera del contenido del modal
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Manejo del envío del formulario
    document.getElementById("formAgendar").onsubmit = function(event) {
        event.preventDefault(); // Prevenir el envío del formulario por defecto

        // Obtener los valores del formulario
        const box = document.querySelector("select[name='box']").value;
        const medico = document.querySelector("select[name='medico']").value;
        const fecha = document.getElementById("fecha").value;
        const hora = document.getElementById("hora").value;
        const tipoConsulta = document.getElementById("tipoConsulta").value;

        // Crear el objeto de datos a enviar
        const data = {
            box_id: box,
            medico_id: medico,
            fecha_inicio: fecha,
            hora: hora,
            tipo_usuario: tipoConsulta
        };

        console.log("Datos: ", data); // Para depuración

        // Enviar los datos al backend
        fetch("/agenda/guardar-agenda", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                showSuccessToast("Agendamiento realizado con éxito.");
                modal.style.display = "none";
                document.getElementById("formAgendar").reset();
                cargarAgendamientos();
            } else if (data.status === 'error') {
                showErrorToast(data.mensaje);
            }
        })
        .catch(error => {
            console.error("Error al guardar agenda:", error);
            showErrorToast("Ocurrió un error al intentar guardar la agenda.");
        });
    }

    // Drag and Drop setup
    const basurero = document.getElementById("basurero");
    basurero.addEventListener("dragover", allowDrop);
    basurero.addEventListener("drop", moverAlBasurero);

    const listaItems = document.getElementById("listaItems");
    if (listaItems) {
        listaItems.addEventListener("dragover", allowDrop);
        listaItems.addEventListener("drop", moverAlBasurero);
    }

    document.querySelectorAll("tbody tr").forEach(fila => {
        const celdas = fila.querySelectorAll("td.dropzone");
        celdas.forEach((celda, index) => {
            celda.setAttribute("data-dia-index", index);
        });
    });

    // URL parameters handling
    const urlParams = new URLSearchParams(window.location.search);
    const fechaStart = urlParams.get("start");
    const entidadId = urlParams.get(CONFIG.entidadParam);

    if (fechaStart) {
        const fechaAjustada = ajustarAInicioDeSemana(fechaStart);
        fechaInicioActual = fechaAjustada;

        const startAjustado = fechaAjustada.toISOString().split("T")[0];
        if (startAjustado !== fechaStart) {
            const url = new URL(window.location);
            url.searchParams.set("start", startAjustado);
            window.history.pushState({}, "", url);
        }
    } else {
        fechaInicioActual = ajustarAInicioDeSemana(new Date());
        actualizarURL();
    }

    if (entidadId) {
        document.getElementById("selectEntidad").value = entidadId;
        document.getElementById("label").innerText = `${CONFIG.labelPrefix} ${entidadId}`;
    }

    actualizarRangoFechas();
    cargarAgendamientos();
    filtrarItems();
});

// Función de prueba para toasts
function testNewToasts() {
    showSuccessToast("¡Toast de éxito funcionando!");
    setTimeout(() => showErrorToast("Toast de error funcionando"), 500);
    setTimeout(() => showWarningToast("Toast de advertencia funcionando"), 1000);
    setTimeout(() => showInfoToast("Toast de información funcionando"), 1500);
}