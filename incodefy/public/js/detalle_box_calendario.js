// ============================================
// CALENDARIO PARA DETALLE DE ESPACIO ESPECÍFICO
// ============================================

// Estado del calendario
const calendarioState = {
    viewMode: 'day', // 'day', 'week', 'month'
    currentDate: new Date(),
    espacioId: window.espacioId,
    grupoId: window.grupoId,
    ocupantes: [],
    agendamientos: [],
    editingAgendamiento: null
};

// Constantes
const HORARIOS = [];
for (let h = 8; h < 20; h++) {
    HORARIOS.push(`${h.toString().padStart(2, '0')}:00`);
    HORARIOS.push(`${h.toString().padStart(2, '0')}:30`);
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ============================================
// INICIALIZACIÓN
// ============================================

function inicializarCalendario() {
    console.log('🗓️ Inicializando calendario para espacio:', calendarioState.espacioId);
    
    cargarOcupantes();
    renderizarCalendario();
    
    // Configurar event listeners del formulario
    const form = document.getElementById('formAgendamiento');
    if (form) {
        form.addEventListener('submit', handleGuardarAgendamiento);
    }
}

// ============================================
// CAMBIO DE VISTA
// ============================================

function cambiarVista(modo) {
    console.log('📅 Cambiando vista a:', modo);
    calendarioState.viewMode = modo;
    
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${modo}ViewBtn`).classList.add('active');
    
    renderizarCalendario();
}

// ============================================
// RENDERIZADO DEL CALENDARIO
// ============================================

async function renderizarCalendario() {
    console.log(`🎨 Renderizando calendario - Vista: ${calendarioState.viewMode}`);
    
    // Cargar agendamientos según la vista actual
    await cargarAgendamientos();
    
    switch (calendarioState.viewMode) {
        case 'day':
            renderizarDia();
            break;
        case 'week':
            renderizarSemana();
            break;
        case 'month':
            renderizarMes();
            break;
    }
}

function renderizarDia() {
    const timelineView = document.getElementById('timelineView');
    const monthView = document.getElementById('monthView');
    
    timelineView.style.display = 'block';
    monthView.style.display = 'none';
    
    const fecha = calendarioState.currentDate.toISOString().split('T')[0];
    const diaTexto = DIAS_SEMANA[calendarioState.currentDate.getDay()];
    const diaNumero = calendarioState.currentDate.getDate();
    const mes = MESES[calendarioState.currentDate.getMonth()];
    
    let html = `
        <table class="timeline-table">
            <thead>
                <tr>
                    <th class="time-column">Hora</th>
                    <th>${diaTexto} ${diaNumero} ${mes}</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    HORARIOS.forEach(hora => {
        html += `<tr>`;
        html += `<td class="time-cell">${hora}</td>`;
        html += `<td class="event-cell" data-fecha="${fecha}" data-hora="${hora}" onclick="clickHorario('${fecha}', '${hora}')">`;
        
        // Buscar agendamientos en este horario
        const agendamientosHora = calendarioState.agendamientos.filter(a => 
            a.date === fecha && a.startTime <= hora && a.endTime > hora
        );
        
        agendamientosHora.forEach(ag => {
            if (ag.startTime === hora) {
                const slots = calcularSlots(ag.startTime, ag.endTime);
                html += `
                    <div class="timeline-event" style="grid-row: span ${slots};" onclick="event.stopPropagation(); editarAgendamiento('${ag.id}')">
                        <div class="timeline-event-title">${ag.occupant_name}</div>
                        <div class="timeline-event-time">${ag.startTime} - ${ag.endTime}</div>
                    </div>
                `;
            }
        });
        
        html += `</td>`;
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    document.getElementById('timelineContent').innerHTML = html;
}

function renderizarSemana() {
    const timelineView = document.getElementById('timelineView');
    const monthView = document.getElementById('monthView');
    
    timelineView.style.display = 'block';
    monthView.style.display = 'none';
    
    // Obtener inicio de semana (Lunes)
    const inicioSemana = new Date(calendarioState.currentDate);
    const dia = inicioSemana.getDay();
    const diff = inicioSemana.getDate() - dia + (dia === 0 ? -6 : 1);
    inicioSemana.setDate(diff);
    
    // Generar 7 días
    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(inicioSemana);
        fecha.setDate(inicioSemana.getDate() + i);
        diasSemana.push(fecha);
    }
    
    let html = `
        <table class="timeline-table timeline-week">
            <thead>
                <tr>
                    <th class="time-column">Hora</th>
    `;
    
    diasSemana.forEach(fecha => {
        const diaTexto = DIAS_SEMANA[fecha.getDay()];
        const diaNumero = fecha.getDate();
        html += `<th>${diaTexto} ${diaNumero}</th>`;
    });
    
    html += `</tr></thead><tbody>`;
    
    HORARIOS.forEach(hora => {
        html += `<tr>`;
        html += `<td class="time-cell">${hora}</td>`;
        
        diasSemana.forEach(fecha => {
            const fechaStr = fecha.toISOString().split('T')[0];
            html += `<td class="event-cell" data-fecha="${fechaStr}" data-hora="${hora}" onclick="clickHorario('${fechaStr}', '${hora}')">`;
            
            // Buscar agendamientos en este horario
            const agendamientosHora = calendarioState.agendamientos.filter(a => 
                a.date === fechaStr && a.startTime <= hora && a.endTime > hora
            );
            
            agendamientosHora.forEach(ag => {
                if (ag.startTime === hora) {
                    const slots = calcularSlots(ag.startTime, ag.endTime);
                    html += `
                        <div class="timeline-event" style="grid-row: span ${slots};" onclick="event.stopPropagation(); editarAgendamiento('${ag.id}')">
                            <div class="timeline-event-title">${ag.occupant_name}</div>
                            <div class="timeline-event-time">${ag.startTime}-${ag.endTime}</div>
                        </div>
                    `;
                }
            });
            
            html += `</td>`;
        });
        
        html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    document.getElementById('timelineContent').innerHTML = html;
}

function renderizarMes() {
    const timelineView = document.getElementById('timelineView');
    const monthView = document.getElementById('monthView');
    
    timelineView.style.display = 'none';
    monthView.style.display = 'block';
    
    const año = calendarioState.currentDate.getFullYear();
    const mes = calendarioState.currentDate.getMonth();
    
    // Primer día del mes
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    
    // Día de inicio (puede ser del mes anterior)
    const inicioCalendario = new Date(primerDia);
    inicioCalendario.setDate(primerDia.getDate() - primerDia.getDay());
    
    // Header con días de la semana
    let html = '<div class="month-header">';
    DIAS_SEMANA.forEach(dia => {
        html += `<div class="month-header-cell">${dia}</div>`;
    });
    html += '</div><div class="month-grid">';
    
    // Grid con 6 semanas (42 días)
    for (let i = 0; i < 42; i++) {
        const fecha = new Date(inicioCalendario);
        fecha.setDate(inicioCalendario.getDate() + i);
        
        const esOtroMes = fecha.getMonth() !== mes;
        const esHoy = fecha.toDateString() === new Date().toDateString();
        const fechaStr = fecha.toISOString().split('T')[0];
        
        let clases = 'month-day';
        if (esOtroMes) clases += ' other-month';
        if (esHoy) clases += ' today';
        
        html += `<div class="${clases}" data-fecha="${fechaStr}" onclick="clickDia('${fechaStr}')">`;
        html += `<div class="month-day-number">${fecha.getDate()}</div>`;
        
        // Agendamientos de este día
        const agendamientosDia = calendarioState.agendamientos.filter(a => a.date === fechaStr);
        agendamientosDia.slice(0, 3).forEach(ag => {
            html += `
                <div class="month-event" onclick="event.stopPropagation(); editarAgendamiento('${ag.id}')">
                    ${ag.startTime} ${ag.occupant_name}
                </div>
            `;
        });
        
        if (agendamientosDia.length > 3) {
            html += `<div class="month-event">+${agendamientosDia.length - 3} más</div>`;
        }
        
        html += `</div>`;
    }
    
    html += '</div>';
    document.getElementById('monthView').innerHTML = html;
}

// ============================================
// CARGA DE DATOS
// ============================================

async function cargarOcupantes() {
    try {
        const response = await fetch(`/api/groups/${calendarioState.grupoId}/occupants`);
        const data = await response.json();
        
        calendarioState.ocupantes = data;
        
        // Llenar select del modal
        const select = document.getElementById('agendamientoOcupante');
        select.innerHTML = '<option value="">Selecciona un ocupante</option>';
        
        data.forEach(ocupante => {
            const option = document.createElement('option');
            option.value = ocupante.occupant_id;
            option.textContent = ocupante.nombre;
            option.dataset.especialidadId = ocupante.especialidad_id || '';
            option.dataset.especialidadNombre = ocupante.especialidad || '';
            select.appendChild(option);
        });
        
        console.log('✅ Ocupantes cargados:', data.length);
    } catch (error) {
        console.error('❌ Error cargando ocupantes:', error);
    }
}

async function cargarAgendamientos() {
    try {
        let dateFrom, dateTo;
        
        if (calendarioState.viewMode === 'day') {
            dateFrom = dateTo = calendarioState.currentDate.toISOString().split('T')[0];
        } else if (calendarioState.viewMode === 'week') {
            const inicioSemana = new Date(calendarioState.currentDate);
            const dia = inicioSemana.getDay();
            const diff = inicioSemana.getDate() - dia + (dia === 0 ? -6 : 1);
            inicioSemana.setDate(diff);
            
            const finSemana = new Date(inicioSemana);
            finSemana.setDate(inicioSemana.getDate() + 6);
            
            dateFrom = inicioSemana.toISOString().split('T')[0];
            dateTo = finSemana.toISOString().split('T')[0];
        } else { // month
            const año = calendarioState.currentDate.getFullYear();
            const mes = calendarioState.currentDate.getMonth();
            const primerDia = new Date(año, mes, 1);
            const ultimoDia = new Date(año, mes + 1, 0);
            
            dateFrom = primerDia.toISOString().split('T')[0];
            dateTo = ultimoDia.toISOString().split('T')[0];
        }
        
        console.log(`📅 Cargando agendamientos: ${dateFrom} - ${dateTo}`);
        
        const response = await fetch(
            `/api/groups/${calendarioState.grupoId}/bookings?space_id=${calendarioState.espacioId}&date_from=${dateFrom}&date_to=${dateTo}`
        );
        const data = await response.json();
        
        calendarioState.agendamientos = data;
        console.log('✅ Agendamientos cargados:', data.length);
    } catch (error) {
        console.error('❌ Error cargando agendamientos:', error);
    }
}

// ============================================
// INTERACCIONES
// ============================================

function clickHorario(fecha, hora) {
    console.log('🖱️ Click en horario:', fecha, hora);
    abrirModalAgendamiento(null, fecha, hora);
}

function clickDia(fecha) {
    console.log('🖱️ Click en día:', fecha);
    abrirModalAgendamiento(null, fecha, '09:00');
}

function abrirModalAgendamiento(agendamientoId = null, fecha = null, hora = null) {
    const modal = document.getElementById('modalAgendamiento');
    const form = document.getElementById('formAgendamiento');
    const titleEl = document.getElementById('modalAgendamientoTitle');
    const btnEliminar = document.getElementById('btnEliminarAgendamiento');
    
    form.reset();
    document.getElementById('agendamientoEspacioId').value = calendarioState.espacioId;
    
    if (agendamientoId) {
        // Modo edición
        const ag = calendarioState.agendamientos.find(a => a.id === agendamientoId);
        if (!ag) return;
        
        calendarioState.editingAgendamiento = ag;
        titleEl.textContent = 'Editar Agendación';
        btnEliminar.style.display = 'inline-flex';
        
        document.getElementById('agendamientoId').value = ag.id;
        document.getElementById('agendamientoOcupante').value = ag.occupant_id;
        document.getElementById('agendamientoFecha').value = ag.date;
        document.getElementById('agendamientoHoraInicio').value = ag.startTime;
        document.getElementById('agendamientoHoraFin').value = ag.endTime;
        document.getElementById('agendamientoObservaciones').value = ag.observaciones || '';
    } else {
        // Modo creación
        calendarioState.editingAgendamiento = null;
        titleEl.textContent = 'Nueva Agendación';
        btnEliminar.style.display = 'none';
        
        if (fecha) {
            document.getElementById('agendamientoFecha').value = fecha;
        }
        if (hora) {
            document.getElementById('agendamientoHoraInicio').value = hora;
            // Calcular hora fin (1 hora después)
            const [h, m] = hora.split(':');
            const horaFin = `${(parseInt(h) + 1).toString().padStart(2, '0')}:${m}`;
            document.getElementById('agendamientoHoraFin').value = horaFin;
        }
    }
    
    modal.style.display = 'flex';
}

function cerrarModalAgendamiento() {
    document.getElementById('modalAgendamiento').style.display = 'none';
    calendarioState.editingAgendamiento = null;
}

async function handleGuardarAgendamiento(e) {
    e.preventDefault();
    
    const agendamientoId = document.getElementById('agendamientoId').value;
    const ocupanteSelect = document.getElementById('agendamientoOcupante');
    const ocupanteId = ocupanteSelect.value;
    const fecha = document.getElementById('agendamientoFecha').value;
    const horaInicio = document.getElementById('agendamientoHoraInicio').value;
    const horaFin = document.getElementById('agendamientoHoraFin').value;
    const observaciones = document.getElementById('agendamientoObservaciones').value;
    
    if (!ocupanteId || !fecha || !horaInicio || !horaFin) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    if (horaInicio >= horaFin) {
        alert('La hora de fin debe ser posterior a la hora de inicio');
        return;
    }
    
    // Obtener datos adicionales del ocupante
    const selectedOption = ocupanteSelect.selectedOptions[0];
    const ocupanteNombre = selectedOption.textContent;
    const especialidadId = selectedOption.dataset.especialidadId;
    const especialidadNombre = selectedOption.dataset.especialidadNombre;
    
    const data = {
        space_id: calendarioState.espacioId,
        space_name: window.nombre || 'Espacio',
        occupant_id: ocupanteId,
        occupant_name: ocupanteNombre,
        occupant_especialidad_id: especialidadId,
        occupant_especialidad_nombre: especialidadNombre,
        date: fecha,
        startTime: horaInicio,
        endTime: horaFin,
        observaciones: observaciones
    };
    
    try {
        let response;
        if (agendamientoId) {
            // Actualizar
            data.current_date = calendarioState.editingAgendamiento.date;
            response = await fetch(`/api/groups/${calendarioState.grupoId}/bookings/${agendamientoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // Crear
            response = await fetch(`/api/groups/${calendarioState.grupoId}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al guardar');
        }
        
        console.log('✅ Agendamiento guardado');
        cerrarModalAgendamiento();
        renderizarCalendario();
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al guardar: ' + error.message);
    }
}

async function eliminarAgendamiento() {
    if (!confirm('¿Estás seguro de eliminar esta agendación?')) return;
    
    const ag = calendarioState.editingAgendamiento;
    if (!ag) return;
    
    try {
        const response = await fetch(
            `/api/groups/${calendarioState.grupoId}/bookings/${ag.id}?fecha=${ag.date}&hora_inicio=${ag.startTime}`,
            { method: 'DELETE' }
        );
        
        if (!response.ok) {
            throw new Error('Error al eliminar');
        }
        
        console.log('✅ Agendamiento eliminado');
        cerrarModalAgendamiento();
        renderizarCalendario();
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al eliminar: ' + error.message);
    }
}

function editarAgendamiento(agendamientoId) {
    abrirModalAgendamiento(agendamientoId);
}

// ============================================
// UTILIDADES
// ============================================

function calcularDuracion(inicio, fin) {
    const [hi, mi] = inicio.split(':').map(Number);
    const [hf, mf] = fin.split(':').map(Number);
    const minutosInicio = hi * 60 + mi;
    const minutosFin = hf * 60 + mf;
    const duracionMinutos = minutosFin - minutosInicio;
    // 1 slot = 30 min = 60px
    return (duracionMinutos / 30) * 60;
}

function calcularSlots(inicio, fin) {
    const [hi, mi] = inicio.split(':').map(Number);
    const [hf, mf] = fin.split(':').map(Number);
    const minutosInicio = hi * 60 + mi;
    const minutosFin = hf * 60 + mf;
    const duracionMinutos = minutosFin - minutosInicio;
    // 1 slot = 30 minutos
    return Math.ceil(duracionMinutos / 30);
}

// Exponer funciones globales
window.cambiarVista = cambiarVista;
window.abrirModalAgendamiento = abrirModalAgendamiento;
window.cerrarModalAgendamiento = cerrarModalAgendamiento;
window.eliminarAgendamiento = eliminarAgendamiento;
window.editarAgendamiento = editarAgendamiento;
window.clickHorario = clickHorario;
window.clickDia = clickDia;
