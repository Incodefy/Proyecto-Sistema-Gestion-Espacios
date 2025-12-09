// ============================================
// SISTEMA DE CALENDARIO PARA DETALLE_BOX
// ============================================

// Performance utilities para calendario
const calendarioPerformance = {
    // Throttle para eventos de scroll/resize
    throttle(fn, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                fn.apply(this, args);
            }
        };
    },
    
    // Batch DOM updates
    pendingUpdates: [],
    scheduledUpdate: null,
    batchUpdate(fn) {
        this.pendingUpdates.push(fn);
        if (!this.scheduledUpdate) {
            this.scheduledUpdate = requestAnimationFrame(() => {
                this.pendingUpdates.forEach(update => update());
                this.pendingUpdates = [];
                this.scheduledUpdate = null;
            });
        }
    }
};

// Estado del calendario
const calendarioState = {
    viewMode: 'week', // 'day', 'week', 'month' - Por defecto en semana
    currentDate: new Date(),
    espacioId: null,
    grupoId: null,
    ocupantes: [],
    bookings: [],
    editingBooking: null,
    isLoading: false,
    bookingsCache: new Map(),
    currentAbortController: null,
    cacheTTL: 5 * 60 * 1000 // 5 minutos
};

// Constantes
const TIME_SLOTS = [];
for (let h = 8; h < 20; h++) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
}

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ============================================
// INICIALIZACIÓN
// ============================================

function inicializarCalendario() {
    console.log('📅 Inicializando calendario...');
    
    // Obtener IDs del DOM
    calendarioState.espacioId = document.body.dataset.espacioId;
    calendarioState.grupoId = document.body.dataset.grupoId;
    
    console.log('Espacio ID:', calendarioState.espacioId);
    console.log('Grupo ID:', calendarioState.grupoId);
    
    if (!calendarioState.espacioId || !calendarioState.grupoId) {
        console.error('❌ No se encontraron espacioId o grupoId');
        return;
    }
    
    // Restaurar estado desde URL (fecha y modo de vista)
    restaurarEstadoDesdeURL();
    
    // Actualizar display de fecha (ahora que tenemos la fecha correcta)
    actualizarDisplayFecha();
    
    // Sincronizar selector de fecha del header
    sincronizarSelectorFecha();
    
    // Cargar ocupantes
    cargarOcupantes();
    
    // Renderizar calendario inicial
    renderizarCalendario();
    cargarBookings();
    
    // Sincronizar URL inicial (por si no había parámetros)
    sincronizarURL();
}

// ============================================
// SINCRONIZACIÓN CON URL
// ============================================

function restaurarEstadoDesdeURL() {
    const params = new URLSearchParams(window.location.search);
    
    console.log('📖 Restaurando estado desde URL...');
    console.log('Parámetros URL:', {
        viewMode: params.get('viewMode'),
        date: params.get('date')
    });
    
    // Restaurar modo de vista
    const viewMode = params.get('viewMode');
    if (viewMode && ['day', 'week', 'month'].includes(viewMode)) {
        console.log('✅ Restaurando modo de vista:', viewMode);
        calendarioState.viewMode = viewMode;
        // Actualizar botones activos
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const btnId = `${viewMode}ViewBtn`;
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.add('active');
            console.log('✅ Botón activado:', btnId);
        }
    } else {
        console.log('ℹ️ No hay viewMode en URL, usando default: day');
    }
    
    // Restaurar fecha
    const dateStr = params.get('date');
    if (dateStr) {
        const fecha = new Date(dateStr + 'T00:00:00');
        if (!isNaN(fecha.getTime())) {
            console.log('✅ Restaurando fecha:', dateStr);
            calendarioState.currentDate = fecha;
        } else {
            console.warn('⚠️ Fecha inválida en URL:', dateStr);
        }
    } else {
        console.log('ℹ️ No hay fecha en URL, usando fecha actual');
    }
    
    console.log('🔄 Estado final después de restaurar:', { 
        viewMode: calendarioState.viewMode, 
        date: calendarioState.currentDate 
    });
}

function sincronizarURL() {
    const params = new URLSearchParams(window.location.search);
    
    // Mantener el tab actual
    const tabActual = params.get('tab') || 'agendamientos';
    
    // Actualizar parámetros
    params.set('tab', tabActual);
    params.set('viewMode', calendarioState.viewMode);
    params.set('date', formatDate(calendarioState.currentDate));
    
    // Actualizar URL sin recargar
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
    
    console.log('🔗 URL sincronizada:', newURL);
}

// ============================================
// CARGAR DATOS
// ============================================

async function cargarOcupantes() {
    try {
        console.log('📋 Cargando ocupantes...');
        const response = await fetch(`/api/groups/${calendarioState.grupoId}/occupants`);
        const data = await response.json();
        calendarioState.ocupantes = data;
        
        console.log('✅ Ocupantes cargados:', data.length);
        
        // Renderizar selector de ocupantes en el modal
        renderizarSelectorOcupantes();
    } catch (error) {
        console.error('❌ Error cargando ocupantes:', error);
    }
}

function renderizarSelectorOcupantes() {
    const select = document.getElementById('agendamientoOcupante');
    if (!select) return;
    
    const nomenclatura = window.nomenclatura || {};
    select.innerHTML = `<option value="">Selecciona un ${nomenclatura.ocupante || 'ocupante'}</option>`;
    
    calendarioState.ocupantes.forEach(ocupante => {
        const option = document.createElement('option');
        option.value = ocupante.occupant_id;
        const especialidadText = ocupante.especialidad ? ` - ${ocupante.especialidad}` : '';
        option.textContent = `${ocupante.nombre}${especialidadText}`;
        select.appendChild(option);
    });
}

async function cargarBookings() {
    if (!calendarioState.espacioId) return;
    
    // Cancelar request anterior si existe
    if (calendarioState.currentAbortController) {
        calendarioState.currentAbortController.abort();
    }
    
    const days = getDaysForView();
    const dateFrom = formatDate(days[0]);
    const dateTo = formatDate(days[days.length - 1]);
    const cacheKey = `${calendarioState.espacioId}:${dateFrom}:${dateTo}`;
    
    // Verificar caché con TTL
    const cached = calendarioState.bookingsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < calendarioState.cacheTTL)) {
        console.log('⚡ Usando caché válido');
        calendarioState.bookings = cached.data;
        renderizarCalendario();
        return;
    }
    
    // Limpiar caché expirado
    if (cached) calendarioState.bookingsCache.delete(cacheKey);
    
    // Mostrar loading solo si tarda más de 200ms
    const loadingTimer = setTimeout(() => {
        calendarioState.isLoading = true;
        mostrarLoadingCalendario();
    }, 200);
    
    // Crear AbortController
    const abortController = new AbortController();
    calendarioState.currentAbortController = abortController;
    
    try {
        const encodedSpaceId = encodeURIComponent(calendarioState.espacioId);
        const url = `/api/groups/${calendarioState.grupoId}/bookings?space_id=${encodedSpaceId}&date_from=${dateFrom}&date_to=${dateTo}`;
        
        const response = await fetch(url, { signal: abortController.signal });
        
        clearTimeout(loadingTimer);
        
        if (abortController.signal.aborted) {
            console.log('⚠️ Request abortado');
            return;
        }
        
        const data = await response.json();
        
        console.log('✅ Bookings recibidos:', data.length);
        
        // Guardar en caché con timestamp
        calendarioState.bookingsCache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
        
        // Limitar tamaño del caché (mantener solo los 15 más recientes)
        if (calendarioState.bookingsCache.size > 15) {
            // Eliminar las entradas más antiguas
            const entries = Array.from(calendarioState.bookingsCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            entries.slice(0, 5).forEach(([key]) => {
                calendarioState.bookingsCache.delete(key);
            });
            console.log('🗑️ Cache limpiado, tamaño:', calendarioState.bookingsCache.size);
        }
        
        calendarioState.bookings = data;
        renderizarCalendario();
        
        // Precarga inteligente: cargar datos del período siguiente en background
        precargarPeriodoAdyacente(dateFrom, dateTo);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⚠️ Request cancelado');
            return;
        }
        console.error('❌ Error cargando bookings:', error);
        calendarioState.bookings = [];
        renderizarCalendario();
    } finally {
        calendarioState.isLoading = false;
        ocultarLoadingCalendario();
        calendarioState.currentAbortController = null;
    }
}

// ========= Precarga inteligente de datos adyacentes =========
function precargarPeriodoAdyacente(currentFrom, currentTo) {
    // Usar requestIdleCallback si está disponible, sino setTimeout
    const schedulePreload = (callback) => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout: 2000 });
        } else {
            setTimeout(callback, 500);
        }
    };
    
    schedulePreload(async () => {
        try {
            // Calcular el siguiente período
            const fromDate = new Date(currentFrom);
            const toDate = new Date(currentTo);
            const diff = toDate - fromDate;
            
            const nextFrom = new Date(toDate);
            nextFrom.setDate(nextFrom.getDate() + 1);
            const nextTo = new Date(nextFrom.getTime() + diff);
            
            const nextDateFrom = formatDate(nextFrom);
            const nextDateTo = formatDate(nextTo);
            const nextCacheKey = `${calendarioState.espacioId}:${nextDateFrom}:${nextDateTo}`;
            
            // Solo precargar si no está en caché
            if (!calendarioState.bookingsCache.has(nextCacheKey)) {
                console.log('⚡ Precargando período siguiente:', nextDateFrom, '-', nextDateTo);
                
                const encodedSpaceId = encodeURIComponent(calendarioState.espacioId);
                const url = `/api/groups/${calendarioState.grupoId}/bookings?space_id=${encodedSpaceId}&date_from=${nextDateFrom}&date_to=${nextDateTo}`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                calendarioState.bookingsCache.set(nextCacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                console.log('✅ Período siguiente precargado');
            }
        } catch (error) {
            console.log('⚠️ Error en precarga (ignorado):', error.message);
        }
    });
}

// ============================================
// NAVEGACIÓN DE FECHAS
// ============================================

function navegarFecha(direccion) {
    // Detectar si estamos en el tab de estadísticas
    const tabActual = document.querySelector('.tab-content.active')?.id;
    const enEstadisticas = tabActual === 'tab-estadisticas';
    
    // Obtener fecha actual correcta (desde URL/fechaActual si estamos en estadísticas)
    let fechaBase;
    let viewMode = calendarioState.viewMode;
    
    if (enEstadisticas && typeof window.fechaActual !== 'undefined' && window.fechaActual) {
        fechaBase = new Date(window.fechaActual);
        // Leer viewMode desde URL si existe
        const params = new URLSearchParams(window.location.search);
        viewMode = params.get('viewMode') || calendarioState.viewMode || 'day';
    } else {
        fechaBase = new Date(calendarioState.currentDate);
    }
    
    const newDate = new Date(fechaBase);
    
    if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() + direccion);
    } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + (direccion * 7));
    } else if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + direccion);
    }
    
    // Actualizar ambas variables
    calendarioState.currentDate = newDate;
    if (typeof window.fechaActual !== 'undefined') {
        window.fechaActual = newDate;
    }
    
    // Actualizar display de fecha
    actualizarDisplayFecha();
    
    // Si estamos en estadísticas, NO renderizar calendario
    if (!enEstadisticas) {
        calendarioState.bookings = [];
        renderizarCalendario();
        cargarBookings();
        sincronizarSelectorFecha();
    }
    
    // Sincronizar URL
    sincronizarURL();
    
    // Notificar cambio de fecha para estadísticas
    notificarCambioFecha();
}

function irHoy() {
    // Detectar si estamos en el tab de estadísticas
    const tabActual = document.querySelector('.tab-content.active')?.id;
    const enEstadisticas = tabActual === 'tab-estadisticas';
    
    const hoy = new Date();
    
    // Actualizar ambas variables
    calendarioState.currentDate = hoy;
    if (typeof window.fechaActual !== 'undefined') {
        window.fechaActual = hoy;
    }
    
    // Actualizar display de fecha
    actualizarDisplayFecha();
    
    // Si estamos en estadísticas, NO renderizar calendario
    if (!enEstadisticas) {
        calendarioState.bookings = [];
        renderizarCalendario();
        cargarBookings();
        sincronizarSelectorFecha();
    }
    
    // Sincronizar URL
    sincronizarURL();
    
    // Notificar cambio de fecha para estadísticas
    notificarCambioFecha();
}

// Notificar cambio de fecha a otros componentes (ej: estadísticas)
function notificarCambioFecha() {
    // Si existe la función de estadísticas en detalle_box.js, actualizarla
    if (typeof cargarEstadisticas === 'function') {
        const tabActual = document.querySelector('.tab-content.active')?.id;
        if (tabActual === 'tab-estadisticas') {
            // Actualizar display de fecha en estadísticas
            if (typeof actualizarDisplayFechaEstadisticas === 'function') {
                actualizarDisplayFechaEstadisticas(calendarioState.currentDate, calendarioState.viewMode);
            }
            // Recargar estadísticas
            cargarEstadisticas();
        }
    }
}

function actualizarDisplayFecha() {
    const display = document.getElementById('currentDateDisplay');
    if (!display) {
        console.warn('⚠️ No se encontró elemento currentDateDisplay');
        return;
    }
    
    const days = getDaysForView();
    
    let textoFecha = '';
    if (calendarioState.viewMode === 'month') {
        textoFecha = `${MONTHS_ES[calendarioState.currentDate.getMonth()]} ${calendarioState.currentDate.getFullYear()}`;
    } else if (calendarioState.viewMode === 'week') {
        const firstDay = days[0];
        const lastDay = days[days.length - 1];
        textoFecha = `${firstDay.getDate()} - ${lastDay.getDate()} ${MONTHS_ES[firstDay.getMonth()]} ${firstDay.getFullYear()}`;
    } else {
        textoFecha = `${DAYS_ES[(calendarioState.currentDate.getDay() + 6) % 7]} ${calendarioState.currentDate.getDate()} de ${MONTHS_ES[calendarioState.currentDate.getMonth()]}`;
    }
    
    display.textContent = textoFecha;
    console.log('📅 Display de fecha actualizado:', textoFecha);
}

function sincronizarSelectorFecha() {
    // Sincronizar con el selector de fecha original del header (si existe)
    const selectorFecha = document.getElementById('selectorFecha');
    if (selectorFecha) {
        const fechaFormateada = formatDate(calendarioState.currentDate);
        selectorFecha.value = fechaFormateada;
        console.log('📅 Selector de fecha sincronizado:', fechaFormateada);
    }
    
    // Sincronizar con el label de fecha
    const fechaLabel = document.getElementById('fechaLabel');
    if (fechaLabel) {
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const fecha = calendarioState.currentDate;
        fechaLabel.textContent = `${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
    }
}

// ============================================
// CAMBIAR VISTA
// ============================================

function cambiarVista(modo) {
    console.log('🔄 Cambiando vista a:', modo);
    
    calendarioState.viewMode = modo;
    
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${modo}ViewBtn`).classList.add('active');
    
    // Actualizar display de fecha
    actualizarDisplayFecha();
    
    // Limpiar caché y recargar
    calendarioState.bookings = [];
    renderizarCalendario();
    cargarBookings();
    
    // Sincronizar URL
    sincronizarURL();
    
    // Notificar cambio para estadísticas
    notificarCambioFecha();
}

// ============================================
// RENDERIZAR CALENDARIO
// ============================================

function renderizarCalendario() {
    console.log('🎨 Renderizando calendario - Modo:', calendarioState.viewMode);
    
    if (calendarioState.viewMode === 'month') {
        document.getElementById('timelineView').classList.add('d-none');
        document.getElementById('monthView').classList.remove('d-none');
        renderizarVistaMonth();
    } else {
        document.getElementById('timelineView').classList.remove('d-none');
        document.getElementById('monthView').classList.add('d-none');
        renderizarVistaTimeline();
    }
}

function renderizarVistaTimeline() {
    const days = getDaysForView();
    const container = document.getElementById('timelineContent');
    
    // Usar DocumentFragment para evitar reflows múltiples
    const fragment = document.createDocumentFragment();
    const table = document.createElement('table');
    table.className = 'timeline-table';
    
    // Header con thead
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const timeCol = document.createElement('th');
    timeCol.className = 'timeline-time-col';
    headerRow.appendChild(timeCol);
    
    days.forEach(day => {
        const isToday = formatDate(day) === formatDate(new Date());
        const th = document.createElement('th');
        th.className = 'timeline-day-header';
        th.innerHTML = `<div class="day-name">${DAYS_ES[(day.getDay() + 6) % 7]}</div>
            <div class="day-number ${isToday ? 'today' : ''}">${day.getDate()}</div>`;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body con tbody
    const tbody = document.createElement('tbody');
    
    TIME_SLOTS.forEach(time => {
        const tr = document.createElement('tr');
        tr.className = 'timeline-row';
        
        const timeLabel = document.createElement('td');
        timeLabel.className = 'time-label';
        timeLabel.textContent = time;
        tr.appendChild(timeLabel);
        
        days.forEach(day => {
            const booking = getBookingForSlot(day, time);
            const td = document.createElement('td');
            td.className = 'timeline-cell';
            
            if (booking) {
                const isFirstSlot = booking.startTime === time;
                
                if (isFirstSlot) {
                    const duration = calculateDuration(booking.startTime, booking.endTime);
                    const height = (duration / 30) * 40 - 8;
                    
                    const bookingDiv = document.createElement('div');
                    bookingDiv.className = 'booking-block booking-dynamic-height';
                    bookingDiv.dataset.bookingId = booking.id;
                    bookingDiv.dataset.computedHeight = height;
                    bookingDiv.innerHTML = `<div class="booking-name">${booking.occupant_name || 'Sin nombre'}</div>
                        <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>`;
                    td.appendChild(bookingDiv);
                } else {
                    const contDiv = document.createElement('div');
                    contDiv.className = 'booking-continuation';
                    contDiv.dataset.bookingId = booking.id;
                    td.appendChild(contDiv);
                }
            } else {
                const btn = document.createElement('button');
                btn.className = 'cell-button';
                btn.dataset.createBooking = '';
                btn.dataset.date = formatDate(day);
                btn.dataset.time = time;
                btn.setAttribute('aria-label', `Crear agendación para ${formatDateForDisplay(day)} a las ${time}`);
                btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>`;
                td.appendChild(btn);
            }
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    fragment.appendChild(table);
    
    // Un solo reflow al reemplazar contenido
    container.innerHTML = '';
    container.appendChild(fragment);
}

function renderizarVistaMonth() {
    const days = getDaysForView();
    const currentMonth = calendarioState.currentDate.getMonth();
    
    console.log('📅 Renderizando vista mensual');
    
    // Wrapper para scroll horizontal
    const monthContainer = document.getElementById('monthView');
    let wrapperDiv = monthContainer.querySelector('.month-view-container');
    
    if (!wrapperDiv) {
        wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'month-view-container';
        
        // Mover monthHeader y monthGrid dentro del wrapper
        const monthHeader = document.getElementById('monthHeader');
        const monthGrid = document.getElementById('monthGrid');
        
        monthContainer.insertBefore(wrapperDiv, monthHeader);
        wrapperDiv.appendChild(monthHeader);
        wrapperDiv.appendChild(monthGrid);
    }
    
    // Header
    const headerHtml = DAYS_ES.map(day => 
        `<div class="month-day-name">${day}</div>`
    ).join('');
    document.getElementById('monthHeader').innerHTML = headerHtml;
    
    // Grid con optimización
    let gridHtml = '';
    const dateStrToday = formatDate(new Date());
    
    days.forEach(day => {
        const dateStr = formatDate(day);
        const isToday = dateStr === dateStrToday;
        const isCurrentMonth = day.getMonth() === currentMonth;
        const dayBookings = calendarioState.bookings.filter(b => b.date === dateStr);
        
        const cellClass = isCurrentMonth ? 'month-cell' : 'month-cell month-cell-outside';
        
        gridHtml += `<div class="${cellClass}">`;
        gridHtml += `<div class="month-cell-date ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'outside-month' : ''}">${day.getDate()}</div>`;
        gridHtml += '<div class="month-bookings">';
        
        dayBookings.slice(0, 3).forEach(booking => {
            gridHtml += `<div class="month-booking-item" onclick="abrirModalEditar('${booking.id}')">
                ${booking.startTime} ${booking.occupant_name || 'Sin nombre'}
            </div>`;
        });
        
        if (dayBookings.length > 3) {
            gridHtml += `<div class="month-more">+${dayBookings.length - 3} más</div>`;
        }
        
        gridHtml += '</div></div>';
    });
    
    document.getElementById('monthGrid').innerHTML = gridHtml;
}

// ============================================
// MODAL DE AGENDAMIENTO
// ============================================

function abrirModalAgendamiento() {
    abrirModalCrear(formatDate(calendarioState.currentDate), '08:00');
}

function abrirModalCrear(fecha, hora) {
    // Verificar permisos
    if (!canModifyBookings()) {
        window.notificationManager.showNotification(
            'No tienes permisos para crear agendamientos',
            'warning'
        );
        return;
    }
    
    calendarioState.editingBooking = null;
    
    document.getElementById('modalAgendamientoTitle').textContent = 'Nueva Agendación';
    document.getElementById('agendamientoId').value = '';
    document.getElementById('agendamientoOcupante').value = '';
    document.getElementById('agendamientoFecha').value = fecha;
    document.getElementById('agendamientoHoraInicio').value = hora;
    document.getElementById('agendamientoHoraFin').value = '';
    document.getElementById('agendamientoObservaciones').value = '';
    document.getElementById('btnEliminarAgendamiento').classList.add('d-none');
    document.getElementById('btnGuardarAgendamiento').innerHTML = '<i class="fas fa-save"></i> Guardar';
    
    document.getElementById('modalAgendamiento').classList.remove('d-none');
}

function abrirModalEditar(bookingId) {
    const booking = calendarioState.bookings.find(b => b.id === bookingId);
    if (!booking) {
        console.error('❌ Booking no encontrado:', bookingId);
        return;
    }
    
    console.log('✏️ Editando booking completo:', {
        id: booking.id,
        occupant_id: booking.occupant_id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime
    });
    
    calendarioState.editingBooking = booking;
    
    // Determinar si el usuario puede modificar
    const canModify = canModifyBookings();
    
    document.getElementById('modalAgendamientoTitle').textContent = canModify ? 'Editar Agendación' : 'Ver Agendación';
    document.getElementById('agendamientoId').value = booking.id;
    document.getElementById('agendamientoOcupante').value = booking.occupant_id;
    document.getElementById('agendamientoFecha').value = booking.date;
    document.getElementById('agendamientoHoraInicio').value = booking.startTime;
    document.getElementById('agendamientoHoraFin').value = booking.endTime;
    document.getElementById('agendamientoObservaciones').value = booking.observaciones || '';
    
    // Deshabilitar inputs si es reader
    const inputs = [
        document.getElementById('agendamientoOcupante'),
        document.getElementById('agendamientoFecha'),
        document.getElementById('agendamientoHoraInicio'),
        document.getElementById('agendamientoHoraFin'),
        document.getElementById('agendamientoObservaciones')
    ];
    
    inputs.forEach(input => {
        if (input) {
            input.disabled = !canModify;
        }
    });
    
    // Ocultar botones de acción si es reader
    const btnEliminar = document.getElementById('btnEliminarAgendamiento');
    const btnGuardar = document.getElementById('btnGuardarAgendamiento');
    
    if (canModify) {
        btnEliminar.classList.remove('d-none');
        btnGuardar.classList.remove('d-none');
        btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
    } else {
        btnEliminar.classList.add('d-none');
        btnGuardar.classList.add('d-none');
    }
    
    document.getElementById('modalAgendamiento').classList.remove('d-none');
}

function cerrarModalAgendamiento() {
    document.getElementById('modalAgendamiento').classList.add('d-none');
    calendarioState.editingBooking = null;
}

// ============================================
// GUARDAR AGENDAMIENTO
// ============================================

async function guardarAgendamiento(event) {
    event.preventDefault();
    
    const form = {
        occupant_id: document.getElementById('agendamientoOcupante').value,
        date: document.getElementById('agendamientoFecha').value,
        startTime: document.getElementById('agendamientoHoraInicio').value,
        endTime: document.getElementById('agendamientoHoraFin').value,
        observaciones: document.getElementById('agendamientoObservaciones').value
    };
    
    console.log('💾 Guardando agendamiento:', form);
    
    // Validaciones
    if (!form.occupant_id || !form.date || !form.startTime || !form.endTime) {
        alert('Por favor completa todos los campos obligatorios');
        return;
    }
    
    if (form.startTime >= form.endTime) {
        alert('La hora de fin debe ser posterior a la hora de inicio');
        return;
    }
    
    // Verificar conflictos
    if (hasConflict(form.date, form.startTime, form.endTime, calendarioState.editingBooking?.id)) {
        alert('Ya existe una agendación en este horario');
        return;
    }
    
    try {
        // Obtener datos completos del ocupante
        const selectedOccupant = calendarioState.ocupantes.find(o => o.occupant_id === form.occupant_id);
        
        console.log('👤 Ocupante seleccionado:', selectedOccupant);
        console.log('📋 Lista de ocupantes disponibles:', calendarioState.ocupantes.length);
        
        if (!selectedOccupant) {
            console.warn('⚠️ No se encontró el ocupante con ID:', form.occupant_id);
        }
        
        if (calendarioState.editingBooking) {
            // Actualizar
            const payload = {
                occupant_id: form.occupant_id,
                date: form.date,
                startTime: form.startTime,
                endTime: form.endTime,
                observaciones: form.observaciones || '',
                space_id: calendarioState.espacioId,
                current_date: calendarioState.editingBooking.date,
                occupant_name: selectedOccupant?.nombre || '',
                occupant_especialidad_id: selectedOccupant?.especialidad_id || '',
                occupant_especialidad_nombre: selectedOccupant?.especialidad || ''
            };
            
            console.log('📝 Actualizando booking:', calendarioState.editingBooking.id);
            console.log('📦 Payload completo:', payload);
            
            const encodedBookingId = encodeURIComponent(calendarioState.editingBooking.id);
            const response = await fetch(
                `/api/groups/${calendarioState.grupoId}/bookings/${encodedBookingId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                console.error('❌ Error del servidor:', errorData);
                throw new Error(errorData.error || 'Error al actualizar');
            }
            
            console.log('✅ Agendamiento actualizado');
            
        } else {
            // Crear
            const payload = {
                ...form,
                space_id: calendarioState.espacioId,
                space_name: window.nombre || 'Espacio',
                occupant_name: selectedOccupant?.nombre,
                occupant_especialidad_id: selectedOccupant?.especialidad_id,
                occupant_especialidad_nombre: selectedOccupant?.especialidad
            };
            
            console.log('➕ Creando:', payload);
            
            const response = await fetch(
                `/api/groups/${calendarioState.grupoId}/bookings`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al crear');
            }
            
            console.log('✅ Agendamiento creado');
        }
        
        // Cerrar modal y recargar
        cerrarModalAgendamiento();
        calendarioState.bookingsCache.clear();
        await cargarBookings();
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert(`Error: ${error.message}`);
    }
}

// ============================================
// ELIMINAR AGENDAMIENTO
// ============================================

async function eliminarAgendamiento() {
    if (!calendarioState.editingBooking) return;
    
    const booking = calendarioState.editingBooking;
    
    // Mostrar modal de confirmación con detalles
    mostrarModalConfirmacion({
        title: '¿Eliminar agendación?',
        message: 'Esta acción no se puede deshacer',
        details: [
            {
                icon: 'user',
                label: 'Ocupante',
                value: booking.occupant_name || 'N/A'
            },
            {
                icon: 'calendar',
                label: 'Fecha',
                value: formatearFecha(booking.date)
            },
            {
                icon: 'clock',
                label: 'Horario',
                value: `${booking.startTime} - ${booking.endTime}`
            }
        ],
        onConfirm: async () => {
            try {
                const bookingId = encodeURIComponent(booking.id);
                const fecha = booking.date;
                const horaInicio = booking.startTime;
                
                console.log('🗑️ Eliminando:', { bookingId, fecha, horaInicio });
                
                const response = await fetch(
                    `/api/groups/${calendarioState.grupoId}/bookings/${bookingId}?fecha=${fecha}&hora_inicio=${horaInicio}`,
                    { method: 'DELETE' }
                );
                
                if (!response.ok) {
                    throw new Error('Error al eliminar');
                }
                
                console.log('✅ Agendamiento eliminado');
                
                // Cerrar modal y recargar
                cerrarModalAgendamiento();
                calendarioState.bookingsCache.clear();
                await cargarBookings();
                
            } catch (error) {
                console.error('❌ Error:', error);
                alert('Error al eliminar la agendación');
            }
        }
    });
}

// ============================================
// MODAL DE CONFIRMACIÓN
// ============================================

function mostrarModalConfirmacion({ title, message, details, onConfirm }) {
    const modal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmDetailsContainer = document.getElementById('confirmDetails');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    
    // Establecer título y mensaje
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    
    // Renderizar detalles
    confirmDetailsContainer.innerHTML = details.map(detail => `
        <div class="confirm-detail-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${getIconPath(detail.icon)}
            </svg>
            <span class="confirm-detail-label">${detail.label}:</span>
            <strong>${detail.value}</strong>
        </div>
    `).join('');
    
    // Configurar botones
    const confirmarHandler = async () => {
        cerrarModalConfirmacion();
        if (onConfirm) await onConfirm();
    };
    
    const cancelarHandler = () => {
        cerrarModalConfirmacion();
    };
    
    // Remover listeners anteriores
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    
    // Agregar nuevos listeners
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmarHandler);
    document.getElementById('confirmCancelBtn').addEventListener('click', cancelarHandler);
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Cerrar con ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            cerrarModalConfirmacion();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function cerrarModalConfirmacion() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('active');
}

function getIconPath(icon) {
    const icons = {
        user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
        calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
        clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'
    };
    return icons[icon] || '';
}

function formatearFecha(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
}

// ============================================
// UTILIDADES
// ============================================

function getDaysForView() {
    const days = [];
    const start = new Date(calendarioState.currentDate);
    
    if (calendarioState.viewMode === 'day') {
        days.push(new Date(start));
    } else if (calendarioState.viewMode === 'week') {
        const dayOfWeek = start.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        start.setDate(start.getDate() + diff);
        for (let i = 0; i < 7; i++) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
    } else if (calendarioState.viewMode === 'month') {
        start.setDate(1);
        const firstDayOfWeek = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - firstDayOfWeek);
        for (let i = 0; i < 42; i++) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
    }
    
    return days;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    
    return `${dayName} ${day} de ${month}`;
}

function getBookingForSlot(date, time) {
    const dateStr = formatDate(date);
    return calendarioState.bookings.find(b => 
        b.date === dateStr &&
        b.startTime <= time &&
        b.endTime > time
    );
}

function hasConflict(date, startTime, endTime, excludeId = null) {
    return calendarioState.bookings.some(b => {
        if (b.id === excludeId) return false;
        if (b.date !== date) return false;
        
        const start1 = timeToMinutes(startTime);
        const end1 = timeToMinutes(endTime);
        const start2 = timeToMinutes(b.startTime);
        const end2 = timeToMinutes(b.endTime);
        
        return (start1 < end2 && end1 > start2);
    });
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function calculateDuration(startTime, endTime) {
    return timeToMinutes(endTime) - timeToMinutes(startTime);
}

function mostrarLoadingCalendario() {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    
    container.classList.add('loading');
    
    let overlay = container.querySelector('.skeleton-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'skeleton-overlay';
        overlay.innerHTML = `
            <div class="skeleton-spinner">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        container.style.position = 'relative';
        container.appendChild(overlay);
    }
}

function ocultarLoadingCalendario() {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    
    container.classList.remove('loading');
    const overlay = container.querySelector('.skeleton-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOMContentLoaded del calendario');
    
    // Event listener para el formulario
    const form = document.getElementById('formAgendamiento');
    if (form) {
        form.addEventListener('submit', guardarAgendamiento);
    }
    
    // Nota: La inicialización se hace desde mostrarTab() en detalle_box.js
    // para asegurar que el tab está activo antes de inicializar
});

// Event delegation para bookings dinámicos (fuera de DOMContentLoaded para evitar duplicados)
document.addEventListener('click', (e) => {
    const bookingBlock = e.target.closest('[data-booking-id]');
    if (bookingBlock) {
        console.log('📌 Click en booking:', bookingBlock.getAttribute('data-booking-id'));
        const bookingId = bookingBlock.getAttribute('data-booking-id');
        abrirModalEditar(bookingId);
        e.stopPropagation();
        e.preventDefault();
        return;
    }
    
    const createButton = e.target.closest('[data-create-booking]');
    if (createButton) {
        console.log('➕ Click en crear booking');
        const date = createButton.getAttribute('data-date');
        const time = createButton.getAttribute('data-time');
        abrirModalCrear(date, time);
        e.stopPropagation();
        e.preventDefault();
        return;
    }
});

// Exponer funciones globales necesarias
window.calendarioState = calendarioState; // Exponer estado para sincronización
window.inicializarCalendario = inicializarCalendario;
window.cambiarVista = cambiarVista;
window.navegarFecha = navegarFecha;
window.irHoy = irHoy;
window.abrirModalAgendamiento = abrirModalAgendamiento;
window.abrirModalCrear = abrirModalCrear;
window.abrirModalEditar = abrirModalEditar;
window.cerrarModalAgendamiento = cerrarModalAgendamiento;
window.eliminarAgendamiento = eliminarAgendamiento;
window.cargarBookings = cargarBookings; // Exponer para WebSocket

// Listener para el selector de fecha del header (si existe)
document.addEventListener('DOMContentLoaded', () => {
    const selectorFecha = document.getElementById('selectorFecha');
    if (selectorFecha) {
        selectorFecha.addEventListener('change', (e) => {
            if (e.target.value) {
                const nuevaFecha = new Date(e.target.value + 'T00:00:00');
                if (!isNaN(nuevaFecha.getTime())) {
                    calendarioState.currentDate = nuevaFecha;
                    actualizarDisplayFecha();
                    calendarioState.bookings = [];
                    renderizarCalendario();
                    cargarBookings();
                    
                    // Sincronizar URL
                    sincronizarURL();
                    
                    // Notificar cambio para estadísticas
                    notificarCambioFecha();
                }
            }
        });
    }
});