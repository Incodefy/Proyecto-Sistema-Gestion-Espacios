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
    groupId: null // Se debe obtener del contexto
};

// Constantes
const TIME_SLOTS = [];
for (let h = 8; h < 20; h++) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Obtener groupId del contexto (puede venir del servidor o URL)
    state.groupId = getGroupIdFromContext();
    
    initializeEventListeners();
    loadInitialData();
    populateTimeSelects();
});

// Obtener groupId del contexto
function getGroupIdFromContext() {
    // Puede venir de una variable global del servidor, URL, o elemento data
    return window.GROUP_ID || new URLSearchParams(window.location.search).get('groupId');
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
        const response = await fetch(`/api/groups/${state.groupId}/spaces/specific?general_id=${generalSpaceId}`);
        const data = await response.json();
        state.specificSpaces = data;
        renderSpecificSpacesSelect();
    } catch (error) {
        console.error('Error cargando espacios específicos:', error);
    }
}

async function loadOccupants() {
    try {
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
    
    const days = getDaysForView();
    const dateFrom = formatDate(days[0]);
    const dateTo = formatDate(days[days.length - 1]);
    
    try {
        const response = await fetch(
            `/api/groups/${state.groupId}/bookings?space_id=${state.selectedSpecificSpace}&date_from=${dateFrom}&date_to=${dateTo}`
        );
        const data = await response.json();
        state.bookings = data;
        renderCalendar();
    } catch (error) {
        console.error('Error cargando agendaciones:', error);
    }
}

async function saveBooking() {
    const form = {
        occupant_id: document.getElementById('occupantSelect').value,
        date: document.getElementById('dateInput').value,
        startTime: document.getElementById('startTimeSelect').value,
        endTime: document.getElementById('endTimeSelect').value
    };
    
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
    
    try {
        if (state.editingBooking) {
            // Actualizar
            const response = await fetch(
                `/api/groups/${state.groupId}/bookings/${state.editingBooking.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, space_id: state.selectedSpecificSpace })
                }
            );
            
            if (!response.ok) throw new Error('Error al actualizar');
        } else {
            // Crear
            const response = await fetch(
                `/api/groups/${state.groupId}/bookings`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, space_id: state.selectedSpecificSpace })
                }
            );
            
            if (!response.ok) throw new Error('Error al crear');
        }
        
        closeModal();
        await loadBookings();
    } catch (error) {
        console.error('Error guardando agendación:', error);
        alert('Error al guardar la agendación');
    }
}

async function deleteBooking() {
    if (!state.editingBooking) return;
    
    if (!confirm('¿Estás seguro de eliminar esta agendación?')) return;
    
    try {
        const response = await fetch(
            `/api/groups/${state.groupId}/bookings/${state.editingBooking.id}`,
            { method: 'DELETE' }
        );
        
        if (!response.ok) throw new Error('Error al eliminar');
        
        closeModal();
        await loadBookings();
    } catch (error) {
        console.error('Error eliminando agendación:', error);
        alert('Error al eliminar la agendación');
    }
}

// Handlers
async function handleGeneralSpaceChange(e) {
    state.selectedGeneralSpace = e.target.value;
    state.selectedSpecificSpace = '';
    
    document.getElementById('specificSpaceSelect').value = '';
    document.getElementById('specificSpaceSelect').disabled = !state.selectedGeneralSpace;
    
    if (state.selectedGeneralSpace) {
        await loadSpecificSpaces(state.selectedGeneralSpace);
    } else {
        state.specificSpaces = [];
        renderSpecificSpacesSelect();
        hideCalendar();
    }
}

async function handleSpecificSpaceChange(e) {
    state.selectedSpecificSpace = e.target.value;
    
    if (state.selectedSpecificSpace) {
        showCalendar();
        await loadBookings();
    } else {
        hideCalendar();
    }
}

function changeViewMode(mode) {
    state.viewMode = mode;
    
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${mode}ViewBtn`).classList.add('active');
    
    renderCalendar();
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
    loadBookings();
}

function goToToday() {
    state.currentDate = new Date();
    loadBookings();
}

// Renderizado
function renderGeneralSpacesSelect() {
    const select = document.getElementById('generalSpaceSelect');
    select.innerHTML = '<option value="">Selecciona un espacio general</option>';
    
    state.generalSpaces.forEach(space => {
        const option = document.createElement('option');
        option.value = space.id;
        option.textContent = space.name;
        select.appendChild(option);
    });
}

function renderSpecificSpacesSelect() {
    const select = document.getElementById('specificSpaceSelect');
    select.innerHTML = '<option value="">Selecciona un espacio específico</option>';
    
    state.specificSpaces.forEach(space => {
        const option = document.createElement('option');
        option.value = space.id;
        option.textContent = space.name;
        select.appendChild(option);
    });
}

function renderOccupantsSelect() {
    const select = document.getElementById('occupantSelect');
    select.innerHTML = '<option value="">Selecciona un ocupante</option>';
    
    state.occupants.forEach(occupant => {
        const option = document.createElement('option');
        option.value = occupant.occupant_id;
        option.textContent = `${occupant.nombre} - ${occupant.especialidad}`;
        select.appendChild(option);
    });
}

function showCalendar() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('viewControls').style.display = 'flex';
    document.getElementById('calendarContainer').style.display = 'block';
}

function hideCalendar() {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('viewControls').style.display = 'none';
    document.getElementById('calendarContainer').style.display = 'none';
}

function renderCalendar() {
    updateDateDisplay();
    
    if (state.viewMode === 'month') {
        document.getElementById('timelineView').style.display = 'none';
        document.getElementById('monthView').style.display = 'block';
        renderMonthView();
    } else {
        document.getElementById('timelineView').style.display = 'block';
        document.getElementById('monthView').style.display = 'none';
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
        display.textContent = `${DAYS_ES[state.currentDate.getDay()]} ${state.currentDate.getDate()} de ${MONTHS_ES[state.currentDate.getMonth()]}`;
    }
}

function renderTimelineView() {
    const days = getDaysForView();
    const container = document.getElementById('timelineContent');
    
    // Header
    let html = '<div class="timeline-header">';
    html += '<div class="timeline-time-col"></div>';
    
    days.forEach(day => {
        const isToday = formatDate(day) === formatDate(new Date());
        html += `<div class="timeline-day-header">
            <div class="day-name">${DAYS_ES[day.getDay()]}</div>
            <div class="day-number ${isToday ? 'today' : ''}">${day.getDate()}</div>
        </div>`;
    });
    
    html += '</div>';
    
    // Body
    html += '<div class="timeline-body">';
    
    TIME_SLOTS.forEach(time => {
        html += '<div class="timeline-row">';
        html += `<div class="time-label">${time}</div>`;
        
        days.forEach(day => {
            const booking = getBookingForSlot(day, time);
            
            html += '<div class="timeline-cell">';
            
            if (booking) {
                const occupant = getOccupant(booking.occupant_id);
                const isFirstSlot = booking.startTime === time;
                
                if (isFirstSlot) {
                    const duration = calculateDuration(booking.startTime, booking.endTime);
                    const height = (duration / 30) * 40 - 8;
                    
                    html += `<div class="booking-block" style="height: ${height}px" onclick="openEditModal('${booking.id}')">
                        <div class="booking-name">${occupant ? occupant.nombre : 'N/A'}</div>
                        <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                    </div>`;
                }
            } else {
                html += `<button class="cell-button" onclick="openCreateModal('${formatDate(day)}', '${time}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>`;
            }
            
            html += '</div>';
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    
    container.innerHTML = html;
}

function renderMonthView() {
    const days = getDaysForView();
    
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
        const dayBookings = state.bookings.filter(b => b.date === dateStr);
        
        gridHtml += '<div class="month-cell">';
        gridHtml += `<div class="month-cell-date ${isToday ? 'today' : ''}">${day.getDate()}</div>`;
        gridHtml += '<div class="month-bookings">';
        
        dayBookings.slice(0, 3).forEach(booking => {
            const occupant = getOccupant(booking.occupant_id);
            gridHtml += `<div class="month-booking-item" onclick="openEditModal('${booking.id}')">
                ${booking.startTime} ${occupant ? occupant.nombre : 'N/A'}
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
    state.editingBooking = null;
    
    document.getElementById('modalTitle').textContent = 'Nueva Agendación';
    document.getElementById('occupantSelect').value = '';
    document.getElementById('dateInput').value = date;
    document.getElementById('startTimeSelect').value = time;
    document.getElementById('endTimeSelect').value = '';
    document.getElementById('deleteBookingBtn').style.display = 'none';
    document.getElementById('saveBookingBtn').textContent = 'Crear Agendación';
    
    document.getElementById('bookingModal').classList.add('active');
}

function openEditModal(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    state.editingBooking = booking;
    
    document.getElementById('modalTitle').textContent = 'Editar Agendación';
    document.getElementById('occupantSelect').value = booking.occupant_id;
    document.getElementById('dateInput').value = booking.date;
    document.getElementById('startTimeSelect').value = booking.startTime;
    document.getElementById('endTimeSelect').value = booking.endTime;
    document.getElementById('deleteBookingBtn').style.display = 'flex';
    document.getElementById('saveBookingBtn').textContent = 'Guardar Cambios';
    
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
        start.setDate(start.getDate() - start.getDay());
        for (let i = 0; i < 7; i++) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
    } else if (state.viewMode === 'month') {
        start.setDate(1);
        const month = start.getMonth();
        while (start.getMonth() === month) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }
    }
    
    return days;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function getBookingForSlot(date, time) {
    const dateStr = formatDate(date);
    return state.bookings.find(b => 
        b.date === dateStr &&
        b.startTime <= time &&
        b.endTime > time
    );
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