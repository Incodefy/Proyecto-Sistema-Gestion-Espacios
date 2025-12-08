// Estado global
const state = {
    viewMode: 'week', // 'day', 'week', 'month'
    currentDate: new Date(),
    selectedGeneralSpace: '',
    selectedSpecificSpace: '',
    generalSpaces: [],
    specificSpaces: [],
    occupants: [],
    bookings: [],
    editingBooking: null,
    groupId: null,
    userRole: null, // Rol del usuario
    currentAbortController: null, // Para cancelar requests anteriores
    loadBookingsTimeout: null, // Para debouncing
    isLoadingBookings: false,
    websocket: null,
    wsReconnectAttempts: 0,
    wsMaxReconnectAttempts: 5
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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    state.groupId = getGroupIdFromContext();
    state.userRole = window.USER_ROLE || null;
    
    console.log('👤 Rol del usuario:', state.userRole);
    
    // Aplicar restricciones de permisos según el rol
    applyRoleRestrictions();
    
    initializeEventListeners();
    loadInitialData();
    populateTimeSelects();
    
    restoreStateFromURL();
});

// Obtener groupId del contexto
function getGroupIdFromContext() {
    // Puede venir de una variable global del servidor, URL, o elemento data
    return window.GROUP_ID || new URLSearchParams(window.location.search).get('groupId');
}

// Aplicar restricciones de permisos según el rol del usuario
function applyRoleRestrictions() {
    const isReader = state.userRole === 'reader';
    
    if (isReader) {
        console.log('🔒 Aplicando restricciones para rol reader');
        
        // Deshabilitar botones de guardar y eliminar en el modal
        const saveBtn = document.getElementById('saveBookingBtn');
        const deleteBtn = document.getElementById('deleteBookingBtn');
        
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'No tienes permisos para crear o editar agendaciones';
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
        }
        
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.title = 'No tienes permisos para eliminar agendaciones';
            deleteBtn.style.opacity = '0.5';
            deleteBtn.style.cursor = 'not-allowed';
        }
    }
}

// Verificar si el usuario puede modificar agendaciones
function canModifyBookings() {
    return state.userRole !== 'reader';
}

// Sincronizar estado con URL
function updateURL() {
    const params = new URLSearchParams(window.location.search);
    
    if (state.selectedGeneralSpace) {
        params.set('generalSpace', state.selectedGeneralSpace);
    } else {
        params.delete('generalSpace');
    }
    
    if (state.selectedSpecificSpace) {
        params.set('specificSpace', state.selectedSpecificSpace);
    } else {
        params.delete('specificSpace');
    }
    
    params.set('viewMode', state.viewMode);
    params.set('date', state.currentDate.toISOString().split('T')[0]);
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
}

// Restaurar estado desde URL
async function restoreStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    const generalSpace = params.get('generalSpace');
    const specificSpace = params.get('specificSpace');
    const viewMode = params.get('viewMode');
    const date = params.get('date');
    
    console.log('Restaurando estado desde URL:', { generalSpace, specificSpace, viewMode, date });
    
    if (viewMode && ['day', 'week', 'month'].includes(viewMode)) {
        state.viewMode = viewMode;
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${viewMode}ViewBtn`).classList.add('active');
    }
    
    if (date) {
        state.currentDate = new Date(date);
    }
    
    // Restaurar espacios después de cargar los datos
    if (generalSpace) {
        // Esperar a que se carguen los espacios generales
        await waitForCondition(() => state.generalSpaces.length > 0, 5000);
        
        console.log('Espacios generales cargados:', state.generalSpaces.length);
        
        if (state.generalSpaces.some(s => s.SK === generalSpace)) {
            state.selectedGeneralSpace = generalSpace;
            document.getElementById('generalSpaceSelect').value = generalSpace;
            document.getElementById('specificSpaceSelect').disabled = false;
            
            console.log('Cargando espacios específicos para:', generalSpace);
            
            // Cargar espacios específicos
            await loadSpecificSpaces(generalSpace);
            
            console.log('Espacios específicos cargados:', state.specificSpaces.length);
            
            if (specificSpace && state.specificSpaces.some(s => s.id === specificSpace || s.SK === specificSpace)) {
                console.log('Seleccionando espacio específico:', specificSpace);
                state.selectedSpecificSpace = specificSpace;
                document.getElementById('specificSpaceSelect').value = specificSpace;
                showCalendar();
                loadBookings();
            } else {
                console.log('Espacio específico no encontrado:', specificSpace);
                console.log('Espacios disponibles:', state.specificSpaces.map(s => s.id || s.SK));
            }
        } else {
            console.log('Espacio general no encontrado:', generalSpace);
        }
    }
}

// Función auxiliar para esperar condiciones
function waitForCondition(condition, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            if (condition()) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error('Timeout esperando condición'));
            }
        }, 50);
    });
}

// Event Listeners
function initializeEventListeners() {
    // Filtros
    document.getElementById('generalSpaceSelect').addEventListener('change', handleGeneralSpaceChange);
    document.getElementById('specificSpaceSelect').addEventListener('change', handleSpecificSpaceChange);
    
    // Navegación
    document.getElementById('prevBtn').addEventListener('click', () => navigateDate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => navigateDate(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    
    // Vistas
    document.getElementById('dayViewBtn').addEventListener('click', () => changeViewMode('day'));
    document.getElementById('weekViewBtn').addEventListener('click', () => changeViewMode('week'));
    document.getElementById('monthViewBtn').addEventListener('click', () => changeViewMode('month'));
    
    // Modal
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
    document.getElementById('saveBookingBtn').addEventListener('click', saveBooking);
    document.getElementById('deleteBookingBtn').addEventListener('click', deleteBooking);
    
    // Cerrar modal al hacer click fuera
    document.getElementById('bookingModal').addEventListener('click', (e) => {
        if (e.target.id === 'bookingModal') closeModal();
    });
    
    // Event delegation para elementos dinámicos (booking-block, cell-button, month-booking-item)
    document.addEventListener('click', (e) => {
        // Click en booking existente para editar
        const bookingBlock = e.target.closest('[data-booking-id]');
        if (bookingBlock) {
            console.log('📌 Click en booking:', bookingBlock.getAttribute('data-booking-id'));
            const bookingId = bookingBlock.getAttribute('data-booking-id');
            openEditModal(bookingId);
            return;
        }
        
        // Click en botón para crear nueva agendación
        const createButton = e.target.closest('[data-create-booking]');
        if (createButton) {
            console.log('➕ Click en crear booking');
            const date = createButton.getAttribute('data-date');
            const time = createButton.getAttribute('data-time');
            openCreateModal(date, time);
            return;
        }
    });
}

// Cargar datos iniciales
async function loadInitialData() {
    try {
        await Promise.all([
            loadGeneralSpaces(),
            loadOccupants()
        ]);
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        alert('Error al cargar los datos. Por favor recarga la página.');
    }
}

// API Calls
async function loadGeneralSpaces() {
    try {
        // Usar datos pre-cargados del servidor si están disponibles
        if (window.INITIAL_DATA && window.INITIAL_DATA.generalSpaces && window.INITIAL_DATA.generalSpaces.length > 0) {
            console.log('[SSR] Usando espacios generales pre-cargados:', window.INITIAL_DATA.generalSpaces.length);
            state.generalSpaces = window.INITIAL_DATA.generalSpaces;
            renderGeneralSpacesSelect();
            return;
        }
        
        // Fallback a API si no hay datos pre-cargados
        console.log('[API] Cargando espacios generales desde API');
        const response = await fetch(`/api/groups/${state.groupId}/spaces/general`);
        const data = await response.json();
        state.generalSpaces = data;
        renderGeneralSpacesSelect();
    } catch (error) {
        console.error('Error cargando espacios generales:', error);
    }
}

async function loadSpecificSpaces(generalSpaceId) {
    try {
        console.log('[LOAD SPECIFIC] Iniciando carga para:', generalSpaceId);
        
        // Mostrar loading en el select de espacios específicos
        const specificSelect = document.getElementById('specificSpaceSelect');
        const originalHtml = specificSelect.innerHTML;
        specificSelect.innerHTML = '<option value="">Cargando espacios...</option>';
        specificSelect.disabled = true;
        
        const encodedGeneralId = encodeURIComponent(generalSpaceId);
        const startTime = Date.now();
        
        const response = await fetch(`/api/groups/${state.groupId}/spaces/specific?general_id=${encodedGeneralId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const loadTime = Date.now() - startTime;
        
        console.log('[LOAD SPECIFIC] Espacios recibidos:', data.length, 'en', loadTime, 'ms');
        
        state.specificSpaces = data;
        renderSpecificSpacesSelect();
        
        // Habilitar el select solo después de renderizar
        specificSelect.disabled = false;
        
        console.log('[LOAD SPECIFIC] Select habilitado con', data.length, 'opciones');
    } catch (error) {
        console.error('[LOAD SPECIFIC ERROR] Error cargando espacios específicos:', error);
        
        // En caso de error, mostrar mensaje y restaurar
        const specificSelect = document.getElementById('specificSpaceSelect');
        specificSelect.innerHTML = '<option value="">Error al cargar - Intenta de nuevo</option>';
        specificSelect.disabled = false;
        
        // Limpiar estado
        state.specificSpaces = [];
    }
}

async function loadOccupants() {
    try {
        // Usar datos pre-cargados del servidor si están disponibles
        if (window.INITIAL_DATA && window.INITIAL_DATA.occupants && window.INITIAL_DATA.occupants.length > 0) {
            console.log('[SSR] Usando ocupantes pre-cargados:', window.INITIAL_DATA.occupants.length);
            state.occupants = window.INITIAL_DATA.occupants;
            renderOccupantsSelect();
            return;
        }
        
        // Fallback a API si no hay datos pre-cargados
        console.log('[API] Cargando ocupantes desde API');
        const response = await fetch(`/api/groups/${state.groupId}/occupants`);
        const data = await response.json();
        state.occupants = data;
        renderOccupantsSelect();
    } catch (error) {
        console.error('Error cargando ocupantes:', error);
    }
}

async function loadBookings() {
    if (!state.selectedSpecificSpace) return;
    
    // Cancelar request anterior si existe
    if (state.currentAbortController) {
        state.currentAbortController.abort();
    }
    
    // Cancelar debounce anterior
    if (state.loadBookingsTimeout) {
        clearTimeout(state.loadBookingsTimeout);
    }
    
    // Debouncing: esperar 150ms antes de cargar (navegación rápida)
    state.loadBookingsTimeout = setTimeout(async () => {
        await loadBookingsImmediate();
    }, 150);
}

async function loadBookingsImmediate() {
    if (!state.selectedSpecificSpace) {
        console.log('[LOAD BOOKINGS] No hay espacio específico seleccionado');
        return;
    }
    
    const days = getDaysForView();
    const dateFrom = formatDate(days[0]);
    const dateTo = formatDate(days[days.length - 1]);
    
    console.log('[LOAD BOOKINGS] Modo:', state.viewMode);
    console.log('[LOAD BOOKINGS] Rango:', dateFrom, 'a', dateTo);
    console.log('[LOAD BOOKINGS] Espacio:', state.selectedSpecificSpace);
    
    // Mostrar skeleton loader
    state.isLoadingBookings = true;
    showSkeletonLoader();
    
    // Crear nuevo AbortController para este request
    const abortController = new AbortController();
    state.currentAbortController = abortController;
    
    try {
        const encodedSpaceId = encodeURIComponent(state.selectedSpecificSpace);
        
        // SIEMPRE usar cache-busting para garantizar datos frescos
        const url = `/api/groups/${state.groupId}/bookings?space_id=${encodedSpaceId}&date_from=${dateFrom}&date_to=${dateTo}&_t=${Date.now()}`;
        
        console.log('[API REQUEST] Cargando datos frescos...');
        
        const response = await fetch(url, { 
            signal: abortController.signal,
            cache: 'no-store' // Nunca usar caché HTTP
        });
        
        if (abortController.signal.aborted) {
            console.log('[ABORT] Request abortado');
            return;
        }
        
        if (!response.ok) {
            console.error('[API ERROR] HTTP', response.status);
            state.bookings = [];
            renderCalendar();
            return;
        }
        
        const data = await response.json();
        
        console.log('[API RESPONSE] Bookings recibidos:', data.length || 0);
        
        // Validar datos básicos
        const validatedBookings = (data || [])
            .filter(booking => booking && booking.date && booking.startTime && booking.endTime)
            .map(booking => ({
                ...booking,
                startTime: booking.startTime.trim(),
                endTime: booking.endTime.trim(),
                date: booking.date.trim()
            }));
        
        if (validatedBookings.length < (data || []).length) {
            console.warn('[VALIDATION] Descartados', (data || []).length - validatedBookings.length, 'bookings inválidos');
        }
        
        state.bookings = validatedBookings;
        console.log('[RENDER] Renderizando con', validatedBookings.length, 'bookings');
        renderCalendar();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[ABORT] Request cancelado (navegación rápida)');
            return;
        }
        console.error('[ERROR] Error cargando agendaciones:', error);
        state.bookings = [];
        renderCalendar();
    } finally {
        state.isLoadingBookings = false;
        hideSkeletonLoader();
        state.currentAbortController = null;
    }
}

async function saveBooking() {
    const form = {
        occupant_id: document.getElementById('occupantSelect').value,
        date: document.getElementById('dateInput').value,
        startTime: document.getElementById('startTimeSelect').value,
        endTime: document.getElementById('endTimeSelect').value
    };
    
    console.log('[SAVE BOOKING] Valores del formulario:', form);
    console.log('[SAVE BOOKING] Ocupantes disponibles:', state.occupants);
    
    // Validaciones
    if (!form.occupant_id || !form.date || !form.startTime || !form.endTime) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    if (form.startTime >= form.endTime) {
        alert('La hora de fin debe ser posterior a la hora de inicio');
        return;
    }
    
    if (hasConflict(form.date, form.startTime, form.endTime, state.editingBooking?.id)) {
        alert('Ya existe una agendación en este horario');
        return;
    }
    
    // Obtener datos completos del ocupante seleccionado
    const selectedOccupant = state.occupants.find(o => o.occupant_id === form.occupant_id);
    
    console.log('[SAVE BOOKING] Ocupante seleccionado completo:', selectedOccupant);
    console.log('[SAVE BOOKING] Especialidad (nombre):', selectedOccupant?.especialidad);
    console.log('[SAVE BOOKING] Especialidad ID:', selectedOccupant?.especialidad_id);
    
    try {
        if (state.editingBooking) {
            // Actualizar
            const payload = { 
                ...form, 
                space_id: state.selectedSpecificSpace,
                current_date: state.editingBooking.date,  // Fecha original para localizar el appointment
                occupant_name: selectedOccupant?.nombre,
                occupant_especialidad_id: selectedOccupant?.especialidad_id,
                // Solo enviar especialidad_nombre si existe y no es un número
                occupant_especialidad_nombre: selectedOccupant?.especialidad && 
                    isNaN(selectedOccupant.especialidad) ? 
                    selectedOccupant.especialidad : 
                    undefined
            };
            
            console.log('[SAVE BOOKING] Payload completo:', payload);
            
            console.log('Actualizando booking:', state.editingBooking.id);
            console.log('Payload:', payload);
            
            // Codificar el ID para manejar el carácter #
            const encodedBookingId = encodeURIComponent(state.editingBooking.id);
            console.log('BookingId original:', state.editingBooking.id);
            console.log('BookingId codificado:', encodedBookingId);
            console.log('URL completa:', `/api/groups/${state.groupId}/bookings/${encodedBookingId}`);
            
            const response = await fetch(
                `/api/groups/${state.groupId}/bookings/${encodedBookingId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error del servidor:', errorData);
                throw new Error('Error al actualizar');
            }
            
            const result = await response.json();
            console.log('Resultado de actualización:', result);
        } else {
            // Crear
            // Obtener información completa del espacio seleccionado
            const selectedSpace = state.specificSpaces.find(s => 
                s.id === state.selectedSpecificSpace || 
                s.SK === state.selectedSpecificSpace
            );
            
            const payload = {
                ...form,
                space_id: state.selectedSpecificSpace,
                space_name: selectedSpace?.name || selectedSpace?.nombre || 'Espacio desconocido',
                occupant_name: selectedOccupant?.nombre,
                occupant_especialidad_id: selectedOccupant?.especialidad_id,
                occupant_especialidad_nombre: selectedOccupant?.especialidad
            };
            
            console.log('[CREATE BOOKING] Payload:', payload);
            
            const response = await fetch(
                `/api/groups/${state.groupId}/bookings`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('[CREATE BOOKING] Error del servidor:', errorData);
                throw new Error(errorData.error || 'Error al crear');
            }
            
            const result = await response.json();
            console.log('[CREATE BOOKING] Resultado:', result);
        }
        
        console.log('Cerrando modal y recargando bookings...');
        closeModal();
        await loadBookingsImmediate();
        
        console.log('Bookings recargados');
    } catch (error) {
        console.error('Error guardando agendación:', error);
        alert('Error al guardar la agendación');
    }
}

async function deleteBooking() {
    if (!state.editingBooking) return;
    
    // Mostrar modal de confirmación personalizado
    const confirmed = await showConfirmModal({
        title: '¿Eliminar agendación?',
        message: 'Esta acción no se puede deshacer',
        booking: state.editingBooking
    });
    
    if (!confirmed) return;
    
    try {
        const bookingId = encodeURIComponent(state.editingBooking.id || state.editingBooking.appointment_id);
        const fecha = state.editingBooking.date;
        const horaInicio = state.editingBooking.startTime; // CORREGIDO: era start_time
        
        console.log('[DELETE] bookingId:', bookingId, 'fecha:', fecha, 'hora:', horaInicio);
        
        if (!horaInicio) {
            console.error('[DELETE ERROR] horaInicio es undefined!', state.editingBooking);
            alert('Error: No se pudo obtener la hora de inicio del agendamiento');
            return;
        }
        
        const response = await fetch(
            `/api/groups/${state.groupId}/bookings/${bookingId}?fecha=${fecha}&hora_inicio=${horaInicio}`,
            { method: 'DELETE' }
        );
        
        if (!response.ok) throw new Error('Error al eliminar');
        
        closeModal();
        await loadBookingsImmediate();
    } catch (error) {
        console.error('Error eliminando agendación:', error);
        alert('Error al eliminar la agendación');
    }
}

// Handlers
async function handleGeneralSpaceChange(e) {
    const newGeneralSpace = e.target.value;
    
    console.log('[GENERAL SPACE CHANGE] De', state.selectedGeneralSpace, 'a', newGeneralSpace);
    
    state.selectedGeneralSpace = newGeneralSpace;
    state.selectedSpecificSpace = '';
    
    // Limpiar selección de espacio específico
    const specificSelect = document.getElementById('specificSpaceSelect');
    specificSelect.value = '';
    
    // Actualizar URL INMEDIATAMENTE (antes de cargar espacios específicos)
    updateURL();
    
    if (state.selectedGeneralSpace) {
        console.log('[GENERAL SPACE CHANGE] Cargando espacios específicos...');
        
        // Cargar espacios específicos (loadSpecificSpaces ya maneja el loading state)
        await loadSpecificSpaces(state.selectedGeneralSpace);
        
        console.log('[GENERAL SPACE CHANGE] Carga completada');
    } else {
        // No hay espacio general seleccionado
        state.specificSpaces = [];
        renderSpecificSpacesSelect();
        specificSelect.disabled = true;
        hideCalendar();
    }
}

async function handleSpecificSpaceChange(e) {
    state.selectedSpecificSpace = e.target.value;
    
    if (state.selectedSpecificSpace) {
        showCalendar();
        loadBookingsImmediate();
    } else {
        hideCalendar();
    }
    
    updateURL();
}

function changeViewMode(mode) {
    const oldMode = state.viewMode;
    state.viewMode = mode;
    
    console.log('[CHANGE VIEW MODE]', oldMode, '->', mode);
    
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${mode}ViewBtn`).classList.add('active');
    
    // Cancelar cualquier carga pendiente
    if (state.loadBookingsTimeout) {
        clearTimeout(state.loadBookingsTimeout);
        state.loadBookingsTimeout = null;
    }
    
    if (state.currentAbortController) {
        state.currentAbortController.abort();
        state.currentAbortController = null;
    }
    
    // Limpiar bookings y renderizar estructura vacía primero
    state.bookings = [];
    renderCalendar();
    
    // Cargar datos inmediatamente SIN revisar caché (para asegurar carga)
    console.log('[CHANGE VIEW MODE] Cargando bookings...');
    loadBookingsImmediate();
    
    updateURL();
}

function navigateDate(direction) {
    const newDate = new Date(state.currentDate);
    
    if (state.viewMode === 'day') {
        newDate.setDate(newDate.getDate() + direction);
    } else if (state.viewMode === 'week') {
        newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (state.viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + direction);
    }
    
    state.currentDate = newDate;
    
    // Renderizar calendario vacío inmediatamente (feedback visual)
    state.bookings = [];
    renderCalendar();
    
    // Cargar datos (con debouncing para navegación rápida)
    loadBookings();
    updateURL();
}

function goToToday() {
    const newDate = new Date();
    
    // Feedback visual instantáneo
    state.currentDate = newDate;
    state.bookings = [];
    renderCalendar();
    
    // Cargar inmediatamente sin debouncing
    loadBookingsImmediate();
    updateURL();
}

// Renderizado
function renderGeneralSpacesSelect() {
    const select = document.getElementById('generalSpaceSelect');
    select.innerHTML = '<option value="">Selecciona un espacio general</option>';
    
    console.log('[FRONT] Renderizando espacios generales:', state.generalSpaces);
    state.generalSpaces.forEach(space => {
        const option = document.createElement('option');
        // Forzar que el value sea siempre SK (id real de DynamoDB)
        const sk = space.SK || space.id;
        console.log('[FRONT] Espacio general:', { name: space.name, SK: space.SK, id: space.id, valueUsado: sk });
        option.value = sk;
        option.textContent = space.name;
        select.appendChild(option);
    });
}

function renderSpecificSpacesSelect() {
    const select = document.getElementById('specificSpaceSelect');
    
    console.log('[RENDER SPECIFIC] Renderizando', state.specificSpaces.length, 'espacios');
    
    select.innerHTML = '<option value="">Selecciona un espacio específico</option>';
    
    state.specificSpaces.forEach(space => {
        const option = document.createElement('option');
        option.value = space.id;
        option.textContent = space.name;
        select.appendChild(option);
    });
    
    console.log('[RENDER SPECIFIC] Select actualizado con', select.options.length - 1, 'opciones');
}

function renderOccupantsSelect() {
    const select = document.getElementById('occupantSelect');
    select.innerHTML = '<option value="">Selecciona un ocupante</option>';
    
    console.log('[RENDER OCCUPANTS] Total ocupantes:', state.occupants.length);
    
    state.occupants.forEach(occupant => {
        console.log('[RENDER OCCUPANTS] Ocupante:', occupant);
        
        const option = document.createElement('option');
        option.value = occupant.occupant_id || '';
        const especialidadText = occupant.especialidad ? ` - ${occupant.especialidad}` : '';
        option.textContent = `${occupant.nombre}${especialidadText}`;
        
        console.log(`[RENDER OCCUPANTS] Option creado - value: "${option.value}", text: "${option.textContent}"`);
        
        select.appendChild(option);
    });
}

function showCalendar() {
    document.getElementById('emptyState').classList.add('d-none');
    document.getElementById('viewControls').classList.remove('d-none');
    document.getElementById('calendarContainer').classList.remove('d-none');
}

function hideCalendar() {
    document.getElementById('emptyState').classList.remove('d-none');
    document.getElementById('viewControls').classList.add('d-none');
    document.getElementById('calendarContainer').classList.add('d-none');
}

function renderCalendar() {
    updateDateDisplay();
    
    if (state.viewMode === 'month') {
        document.getElementById('timelineView').classList.add('d-none');
        document.getElementById('monthView').classList.remove('d-none');
        renderMonthView();
    } else {
        document.getElementById('timelineView').classList.remove('d-none');
        document.getElementById('monthView').classList.add('d-none');
        renderTimelineView();
    }
}

function updateDateDisplay() {
    const display = document.getElementById('currentDateDisplay');
    const days = getDaysForView();
    
    if (state.viewMode === 'month') {
        display.textContent = `${MONTHS_ES[state.currentDate.getMonth()]} ${state.currentDate.getFullYear()}`;
    } else if (state.viewMode === 'week') {
        display.textContent = `Semana del ${days[0].getDate()} de ${MONTHS_ES[days[0].getMonth()]}`;
    } else {
        display.textContent = `${DAYS_ES[(state.currentDate.getDay() + 6) % 7]} ${state.currentDate.getDate()} de ${MONTHS_ES[state.currentDate.getMonth()]}`;
    }
}

function renderTimelineView() {
    const days = getDaysForView();
    const container = document.getElementById('timelineContent');
    
    console.log('[TIMELINE VIEW] Renderizando con', state.bookings.length, 'bookings');
    console.log('[TIMELINE VIEW] Días a mostrar:', days.length);
    
    // Contar cuántos bookings hay por día para debugging
    const bookingsByDay = {};
    state.bookings.forEach(b => {
        bookingsByDay[b.date] = (bookingsByDay[b.date] || 0) + 1;
    });
    console.log('[TIMELINE VIEW] Bookings por día:', bookingsByDay);
    
    // Header
    let html = '<table class="timeline-table">';
    html += '<thead><tr>';
    html += '<th class="timeline-time-col"></th>';
    
    days.forEach(day => {
        const isToday = formatDate(day) === formatDate(new Date());
        html += `<th class="timeline-day-header">
            <div class="day-name">${DAYS_ES[(day.getDay() + 6) % 7]}</div>
            <div class="day-number ${isToday ? 'today' : ''}">${day.getDate()}</div>
        </th>`;
    });
    
    html += '</tr></thead>';
    
    // Body
    html += '<tbody>';
    
    let totalBookingsRendered = 0;
    
    TIME_SLOTS.forEach(time => {
        html += '<tr class="timeline-row">';
        html += `<td class="time-label">${time}</td>`;
        
        days.forEach(day => {
            const booking = getBookingForSlot(day, time);
            
            html += '<td class="timeline-cell">';
            
            if (booking) {
                const isFirstSlot = booking.startTime === time;
                
                if (isFirstSlot) {
                    totalBookingsRendered++;
                    const duration = calculateDuration(booking.startTime, booking.endTime);
                    const height = (duration / 30) * 40 - 8;
                    
                    html += `<div class="booking-block booking-dynamic-height" data-booking-id="${booking.id}" data-computed-height="${height}">
                        <div class="booking-name">${booking.occupant_name || booking.patient_name || 'Sin nombre'}</div>
                        <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                    </div>`;
                } else {
                    // Slot de continuación - clickeable pero sin contenido visible
                    html += `<div class="booking-continuation" data-booking-id="${booking.id}"></div>`;
                }
            } else {
                html += `<button class="cell-button" data-create-booking data-date="${formatDate(day)}" data-time="${time}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>`;
            }
            
            html += '</td>';
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    container.innerHTML = html;
    
    console.log('[TIMELINE VIEW] Bookings renderizados en vista:', totalBookingsRendered, 'de', state.bookings.length);
    
    if (totalBookingsRendered < state.bookings.length) {
        console.warn('[TIMELINE VIEW] ADVERTENCIA: No se renderizaron todos los bookings!');
        console.warn('[TIMELINE VIEW] Faltan:', state.bookings.length - totalBookingsRendered);
        
        // Identificar cuáles no se renderizaron
        const renderedIds = new Set();
        document.querySelectorAll('.booking-block, .booking-continuation').forEach(el => {
            renderedIds.add(el.getAttribute('data-booking-id'));
        });
        
        const notRendered = state.bookings.filter(b => !renderedIds.has(b.id));
        console.warn('[TIMELINE VIEW] Bookings no renderizados:', notRendered);
    }
}

function renderMonthView() {
    const days = getDaysForView();
    const currentMonth = state.currentDate.getMonth();
    
    console.log('[MONTH VIEW] Renderizando vista mensual');
    console.log('[MONTH VIEW] Total de bookings:', state.bookings.length);
    console.log('[MONTH VIEW] Bookings:', state.bookings);
    console.log('[MONTH VIEW] Días a mostrar:', days.length);
    
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
    
    // Grid
    let gridHtml = '';
    
    days.forEach(day => {
        const dateStr = formatDate(day);
        const isToday = dateStr === formatDate(new Date());
        const isCurrentMonth = day.getMonth() === currentMonth;
        const dayBookings = state.bookings.filter(b => b.date === dateStr);
        
        if (dayBookings.length > 0) {
            console.log(`[MONTH VIEW] ${dateStr}: ${dayBookings.length} bookings`);
        }
        
        // Agregar clase para días fuera del mes actual
        const cellClass = isCurrentMonth ? 'month-cell' : 'month-cell month-cell-outside';
        
        gridHtml += `<div class="${cellClass}">`;
        gridHtml += `<div class="month-cell-date ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'outside-month' : ''}">${day.getDate()}</div>`;
        gridHtml += '<div class="month-bookings">';
        
        dayBookings.slice(0, 3).forEach(booking => {
            gridHtml += `<div class="month-booking-item" data-booking-id="${booking.id}">
                ${booking.startTime} ${booking.occupant_name || booking.patient_name || 'Sin nombre'}
            </div>`;
        });
        
        if (dayBookings.length > 3) {
            gridHtml += `<div class="month-more">+${dayBookings.length - 3} más</div>`;
        }
        
        gridHtml += '</div></div>';
    });
    
    document.getElementById('monthGrid').innerHTML = gridHtml;
}

// Modal
function openCreateModal(date, time) {
    // Verificar permisos
    if (!canModifyBookings()) {
        if (window.notificationManager) {
            window.notificationManager.show('No tienes permisos para crear agendaciones', 'warning');
        } else {
            alert('No tienes permisos para crear agendaciones');
        }
        return;
    }
    
    state.editingBooking = null;
    
    document.getElementById('modalTitle').textContent = 'Nueva Agendación';
    document.getElementById('occupantSelect').value = '';
    document.getElementById('dateInput').value = date;
    document.getElementById('startTimeSelect').value = time;
    document.getElementById('endTimeSelect').value = '';
    document.getElementById('deleteBookingBtn').classList.add('d-none');
    document.getElementById('saveBookingBtn').textContent = 'Crear Agendación';
    
    document.getElementById('bookingModal').classList.add('active');
}

function openEditModal(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    console.log('=== DEBUG EDICIÓN ===');
    console.log('Booking completo:', booking);
    console.log('Ocupantes disponibles:', state.occupants);
    
    state.editingBooking = booking;
    
    // Readers pueden ver pero no editar
    const canEdit = canModifyBookings();
    const modalTitle = canEdit ? 'Editar Agendación' : 'Ver Agendación';
    
    document.getElementById('modalTitle').textContent = modalTitle;
    document.getElementById('dateInput').value = booking.date;
    document.getElementById('startTimeSelect').value = booking.startTime;
    document.getElementById('endTimeSelect').value = booking.endTime;
    
    // Mostrar/ocultar botón eliminar según permisos
    if (canEdit) {
        document.getElementById('deleteBookingBtn').classList.remove('d-none');
        document.getElementById('saveBookingBtn').textContent = 'Guardar Cambios';
    } else {
        document.getElementById('deleteBookingBtn').classList.add('d-none');
        document.getElementById('saveBookingBtn').textContent = 'Guardar Cambios';
    }
    
    // Deshabilitar inputs para readers
    document.getElementById('occupantSelect').disabled = !canEdit;
    document.getElementById('dateInput').disabled = !canEdit;
    document.getElementById('startTimeSelect').disabled = !canEdit;
    document.getElementById('endTimeSelect').disabled = !canEdit;
    
    // Establecer el ocupante después de un pequeño delay para asegurar que el select está renderizado
    setTimeout(() => {
        const occupantSelect = document.getElementById('occupantSelect');
        console.log('Opciones del selector:', Array.from(occupantSelect.options).map(opt => ({
            value: opt.value,
            text: opt.textContent
        })));
        console.log('Intentando seleccionar occupant_id:', booking.occupant_id);
        
        occupantSelect.value = booking.occupant_id;
        console.log('Valor después de asignar:', occupantSelect.value);
        
        // Si no se seleccionó (el ID no existe en las opciones), intentar buscar por nombre
        if (!occupantSelect.value && booking.occupant_name) {
            console.log('No se pudo seleccionar por ID, buscando por nombre:', booking.occupant_name);
            const matchingOption = Array.from(occupantSelect.options).find(opt => 
                opt.textContent.includes(booking.occupant_name)
            );
            if (matchingOption) {
                console.log('Opción encontrada por nombre:', matchingOption.value, matchingOption.textContent);
                occupantSelect.value = matchingOption.value;
            } else {
                console.log('No se encontró ninguna opción que coincida con el nombre');
            }
        }
        console.log('===================');
    }, 50);
    
    document.getElementById('bookingModal').classList.add('active');
}

function closeModal() {
    document.getElementById('bookingModal').classList.remove('active');
    state.editingBooking = null;
}

function populateTimeSelects() {
    const startSelect = document.getElementById('startTimeSelect');
    const endSelect = document.getElementById('endTimeSelect');
    
    TIME_SLOTS.forEach(time => {
        const option1 = document.createElement('option');
        option1.value = time;
        option1.textContent = time;
        startSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = time;
        option2.textContent = time;
        endSelect.appendChild(option2);
    });
}

// Utilidades
function getDaysForView() {
    const days = [];
    const start = new Date(state.currentDate);
    
    if (state.viewMode === 'day') {
        days.push(new Date(start));
    } else if (state.viewMode === 'week') {
        // Ajustar al lunes de la semana
        const dayOfWeek = start.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo (0), retroceder 6 días
        start.setDate(start.getDate() + diff);
        for (let i = 0; i < 7; i++) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
    } else if (state.viewMode === 'month') {
        // Para el mes, incluir días del mes anterior/siguiente para completar semanas
        start.setDate(1); // Primer día del mes
        
        // Retroceder al domingo de la semana que contiene el primer día
        const firstDayOfWeek = (start.getDay() + 6) % 7; // 0=Lun, 1=Mar, ..., 6=Dom
        start.setDate(start.getDate() - firstDayOfWeek);
        
        // Agregar 42 días (6 semanas x 7 días = calendario completo)
        for (let i = 0; i < 42; i++) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
    }
    
    return days;
}

function formatDate(date) {
    // Usar fecha local sin conversión a UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getBookingForSlot(date, time) {
    const dateStr = formatDate(date);
    
    // Validar que bookings sea un array
    if (!Array.isArray(state.bookings)) {
        console.error('[getBookingForSlot] state.bookings no es un array:', typeof state.bookings);
        state.bookings = [];
        return null;
    }
    
    return state.bookings.find(b => {
        // Validar que el booking tenga los campos necesarios
        if (!b || !b.date || !b.startTime || !b.endTime) {
            console.warn('[getBookingForSlot] Booking inválido encontrado:', b);
            return false;
        }
        
        return b.date === dateStr && b.startTime <= time && b.endTime > time;
    });
}

function getOccupant(occupantId) {
    return state.occupants.find(o => o.occupant_id === occupantId);
}

function hasConflict(date, startTime, endTime, excludeId = null) {
    return state.bookings.some(b => {
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

// ===== SKELETON LOADER =====
function showSkeletonLoader() {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    // Agregar clase de loading si no existe
    if (!calendarContainer.classList.contains('loading')) {
        calendarContainer.classList.add('loading');
        
        // Agregar overlay sutil
        let overlay = calendarContainer.querySelector('.skeleton-overlay');
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
            calendarContainer.classList.add('calendar-loading');
            calendarContainer.appendChild(overlay);
        }
    }
}

function hideSkeletonLoader() {
    const calendarContainer = document.getElementById('calendarContainer');
    if (!calendarContainer) return;
    
    calendarContainer.classList.remove('loading');
    const overlay = calendarContainer.querySelector('.skeleton-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// ============ WEBSOCKET PARA ACTUALIZACIONES EN TIEMPO REAL ============

function connectWebSocket() {
    // URL del WebSocket (se obtendrá después del despliegue)
    const wsEndpointElement = document.querySelector('[data-ws-endpoint]');
    const WS_URL = wsEndpointElement ? wsEndpointElement.dataset.wsEndpoint : 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev';
    
    if (!state.groupId) {
        console.warn('[WS] No se puede conectar: falta groupId');
        return;
    }

    try {
        console.log(`[WS] Conectando a ${WS_URL}?grupo_id=${state.groupId}`);
        state.websocket = new WebSocket(`${WS_URL}?grupo_id=${state.groupId}`);

        state.websocket.onopen = () => {
            console.log('✅ [WS] Conectado');
            state.wsReconnectAttempts = 0;
        };

        state.websocket.onmessage = (event) => {
            console.log('[WS] Mensaje recibido:', event.data);
            handleWebSocketMessage(JSON.parse(event.data));
        };

        state.websocket.onerror = (error) => {
            console.error('❌ [WS] Error:', error);
        };

        state.websocket.onclose = () => {
            console.log('🔌 [WS] Desconectado');
            state.websocket = null;
            
            // Intentar reconectar
            if (state.wsReconnectAttempts < state.wsMaxReconnectAttempts) {
                state.wsReconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, state.wsReconnectAttempts), 30000);
                console.log(`[WS] Reconectando en ${delay/1000}s (intento ${state.wsReconnectAttempts}/${state.wsMaxReconnectAttempts})`);
                setTimeout(connectWebSocket, delay);
            } else {
                console.warn('[WS] Máximo de intentos de reconexión alcanzado');
            }
        };

    } catch (error) {
        console.error('[WS] Error al crear conexión:', error);
    }
}

function handleWebSocketMessage(message) {
    console.log('[WS] Procesando mensaje tipo:', message.type);
    
    // Mostrar notificación toast
    const eventData = message.data || {};
    
    switch (message.type) {
        // === Eventos de Appointments ===
        case 'INSERT':
            console.log('[WS] Nueva agendación creada');
            if (window.notificationManager) {
                window.notificationManager.showAppointmentCreated(eventData);
            }
            loadBookingsImmediate();
            break;
            
        case 'MODIFY':
            console.log('[WS] Agendación modificada');
            if (window.notificationManager) {
                window.notificationManager.showAppointmentModified(eventData);
            }
            loadBookingsImmediate();
            break;
            
        case 'REMOVE':
            console.log('[WS] Agendación eliminada');
            if (window.notificationManager) {
                window.notificationManager.showAppointmentCancelled(eventData);
            }
            loadBookingsImmediate();
            break;
        
        // === Eventos de Spaces ===
        case 'SPACE_CREATED':
            console.log('[WS] Espacio creado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showSpaceCreated(eventData);
            }
            break;
            
        case 'SPACE_MODIFIED':
            console.log('[WS] Espacio modificado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showSpaceModified(eventData);
            }
            break;
            
        case 'SPACE_DELETED':
            console.log('[WS] Espacio eliminado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showSpaceDeleted(eventData);
            }
            break;
        
        // === Eventos de Occupants ===
        case 'OCCUPANT_CREATED':
            console.log('[WS] Ocupante creado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showOccupantCreated(eventData);
            }
            // Recargar si hay un impacto en la agenda
            state.bookingsCache.clear();
            loadBookings();
            break;
            
        case 'OCCUPANT_MODIFIED':
            console.log('[WS] Ocupante modificado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showOccupantModified(eventData);
            }
            // Recargar si hay un impacto en la agenda
            state.bookingsCache.clear();
            loadBookings();
            break;
            
        case 'OCCUPANT_DELETED':
            console.log('[WS] Ocupante eliminado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showOccupantDeleted(eventData);
            }
            // Recargar si hay un impacto en la agenda
            state.bookingsCache.clear();
            loadBookings();
            break;
        
        // === Eventos de GroupMembers ===
        case 'MEMBER_ADDED':
            console.log('[WS] Miembro agregado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showMemberAdded(eventData);
            }
            break;
            
        case 'ROLE_CHANGED':
            console.log('[WS] Rol cambiado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showRoleChanged(eventData);
            }
            break;
            
        case 'MEMBER_REMOVED':
            console.log('[WS] Miembro removido:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showMemberRemoved(eventData);
            }
            break;
            
        case 'MEMBER_MODIFIED':
            console.log('[WS] Miembro modificado:', eventData);
            if (window.notificationManager) {
                window.notificationManager.showMemberModified(eventData);
            }
            break;
            
        default:
            console.log('[WS] Tipo de mensaje desconocido:', message.type);
    }
}

function disconnectWebSocket() {
    if (state.websocket) {
        console.log('[WS] Cerrando conexión...');
        state.websocket.close();
        state.websocket = null;
    }
}

// Conectar al WebSocket cuando se carga la página
window.addEventListener('load', () => {
    if (state.groupId) {
        connectWebSocket();
    }
});

// Desconectar al salir de la página
window.addEventListener('beforeunload', () => {
    disconnectWebSocket();
});

// ============================================================================
// MODAL DE CONFIRMACIÓN PERSONALIZADO
// ============================================================================

/**
 * Muestra un modal de confirmación personalizado
 * @param {Object} options - Opciones del modal
 * @param {string} options.title - Título del modal
 * @param {string} options.message - Mensaje descriptivo
 * @param {Object} options.booking - Datos del agendamiento (opcional)
 * @returns {Promise<boolean>} - true si confirma, false si cancela
 */
function showConfirmModal(options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const detailsEl = document.getElementById('confirmDetails');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const deleteBtn = document.getElementById('confirmDeleteBtn');
        
        // Establecer título y mensaje
        titleEl.textContent = options.title || '¿Confirmar acción?';
        messageEl.textContent = options.message || 'Esta acción no se puede deshacer';
        
        // Limpiar detalles previos
        detailsEl.innerHTML = '';
        
        // Si hay datos del booking, mostrar detalles
        if (options.booking) {
            const details = [
                { 
                    icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
                    label: 'Ocupante:',
                    value: options.booking.occupant_name || options.booking.patient_name || 'Sin nombre'
                },
                { 
                    icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
                    label: 'Fecha:',
                    value: formatDateForDisplay(options.booking.date)
                },
                { 
                    icon: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
                    label: 'Horario:',
                    value: `${options.booking.startTime} - ${options.booking.endTime}`
                }
            ];
            
            details.forEach(detail => {
                const item = document.createElement('div');
                item.className = 'confirm-detail-item';
                item.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${detail.icon}
                    </svg>
                    <span class="confirm-detail-label">${detail.label}</span>
                    <span>${detail.value}</span>
                `;
                detailsEl.appendChild(item);
            });
        }
        
        // Handlers
        const handleCancel = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(false);
        };
        
        const handleConfirm = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(true);
        };
        
        const handleOutsideClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        
        const cleanup = () => {
            cancelBtn.removeEventListener('click', handleCancel);
            deleteBtn.removeEventListener('click', handleConfirm);
            modal.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
        
        // Event listeners
        cancelBtn.addEventListener('click', handleCancel);
        deleteBtn.addEventListener('click', handleConfirm);
        modal.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        
        // Mostrar modal
        modal.classList.add('active');
    });
}

/**
 * Formatea una fecha para mostrar
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {string} - Fecha formateada (ej: "Lunes, 5 de Diciembre de 2025")
 */
function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}
