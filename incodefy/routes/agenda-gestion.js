const express = require('express');
const router = express.Router();
// Importa tu configuración de DynamoDB aquí
// const dynamoDB = require('../config/dynamodb');

/**
 * GET /agenda/gestion
 * Renderiza la vista de gestión de agenda (calendario)
 */
router.get('/agenda/gestion', async (req, res) => {
    try {
        // Obtener el groupId de la sesión o query params
        const groupId = req.query.groupId || req.session?.grupoActivo?.grupo_id;
        
        let generalSpaces = [];
        let occupants = [];
        
        // Pre-cargar datos si hay groupId
        if (groupId) {
            const ApiClientV2 = require('../apiClientV2');
            const apiClient = new ApiClientV2(req.session.user?.idToken || '');
            
            try {
                // Cargar espacios generales
                const spacesResponse = await apiClient.listarEspacios(groupId);
                if (spacesResponse && spacesResponse.espacios) {
                    generalSpaces = spacesResponse.espacios
                        .filter(e => e.tipo === 'general')
                        .map(e => ({
                            id: e.SK,
                            SK: e.SK,
                            name: e.nombre
                        }));
                }
                
                // Cargar ocupantes
                const occupantsResponse = await apiClient.client.get(`/groups/${groupId}/ocupantes`);
                if (occupantsResponse.data && occupantsResponse.data.ocupantes) {
                    console.log('[SSR] Ocupantes del Lambda:', JSON.stringify(occupantsResponse.data.ocupantes, null, 2));
                    
                    occupants = occupantsResponse.data.ocupantes.map(occ => {
                        // El Lambda devuelve 'id' sin prefijo, construir occupant_id correcto
                        const occupantId = occ.ocupante_id || occ.SK || (occ.id ? `OCCUPANT#${occ.id}` : undefined);
                        
                        const mapped = {
                            occupant_id: occupantId,
                            nombre: occ.nombre,
                            especialidad: occ.especialidad, // Si el Lambda no lo envía, será undefined
                            especialidad_id: occ.especialidad_id
                        };
                        console.log('[SSR] Ocupante mapeado:', mapped);
                        return mapped;
                    });
                }
            } catch (error) {
                console.error('Error pre-cargando datos:', error);
                // Continuar sin datos pre-cargados
            }
        }
        
        res.render('agenda-gestion', {
            currentPath: req.path,
            title: 'Sistema de Agendación',
            groupId: groupId,
            personalization: res.locals.personalization || {},
            idToken: req.session.user?.idToken || '',
            wsEndpoint: process.env.WS_ENDPOINT || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev',
            initialData: {
                generalSpaces,
                occupants
            }
        });
    } catch (error) {
        console.error('Error en ruta /agenda/gestion:', error);
        res.status(500).send('Error al cargar la página');
    }
});

/**
 * GET /api/groups/:groupId/spaces/general
 * Obtiene todos los espacios generales de un grupo
 */
router.get('/api/groups/:groupId/spaces/general', async (req, res) => {
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        const response = await apiClient.listarEspacios(groupId);
        if (!response.ok) {
            return res.status(500).json({ error: 'Error al obtener espacios generales' });
        }
        // Espacios generales: tipo === 'general'
        const generales = (response.espacios || []).filter(e => e.tipo === 'general');
        const spaces = generales.map(e => {
            const sk = e.SK || e.id || e.space_id;
            return {
                id: sk,
                SK: sk,
                name: e.nombre || e.name
            };
        });
        res.json(spaces);
    } catch (error) {
        console.error('Error obteniendo espacios generales:', error);
        res.status(500).json({ error: 'Error al obtener espacios generales' });
    }
});

/**
 * GET /api/groups/:groupId/spaces/specific
 * Obtiene espacios específicos filtrados por espacio general
 */
router.get('/api/groups/:groupId/spaces/specific', async (req, res) => {
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        const { general_id } = req.query;
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        const response = await apiClient.listarEspacios(groupId);
        if (!response.ok) {
            return res.status(500).json({ error: 'Error al obtener espacios específicos' });
        }
        // Espacios específicos: tipo === 'especifico'
        let allSpecifics = (response.espacios || [])
            .flatMap(e => Array.isArray(e.specificSpaces) ? e.specificSpaces : [])
            .filter(e => e.tipo === 'especifico');
        
        let spaces = allSpecifics;
        if (general_id) {
            spaces = allSpecifics.filter(s => s.parent === general_id || s.general_id === general_id);
        }
        
        spaces = spaces.map(e => ({
            id: e.SK || e.id || e.space_id,
            general_id: e.parent || e.general_id,
            name: e.nombre || e.name
        }));
        res.json(spaces);
    } catch (error) {
        console.error('Error obteniendo espacios específicos:', error);
        res.status(500).json({ error: 'Error al obtener espacios específicos' });
    }
});

/**
 * GET /api/groups/:groupId/occupants
 * Obtiene todos los ocupantes de un grupo
 */
router.get('/api/groups/:groupId/occupants', async (req, res) => {
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        
        // Usar el endpoint de ocupantes del grupo
        const response = await apiClient.client.get(`/groups/${groupId}/ocupantes`);
        
        console.log('=== DEBUG OCUPANTES API ===');
        console.log('Response completa:', JSON.stringify(response.data, null, 2));
        
        if (response.data && response.data.ocupantes) {
            console.log('Ocupantes del Lambda:', JSON.stringify(response.data.ocupantes, null, 2));
            
            const occupants = response.data.ocupantes.map(occ => {
                // El Lambda devuelve 'id' sin prefijo, construir occupant_id correcto
                const occupantId = occ.ocupante_id || occ.SK || (occ.id ? `OCCUPANT#${occ.id}` : undefined);
                
                const mapped = {
                    occupant_id: occupantId,
                    nombre: occ.nombre,
                    especialidad: occ.especialidad, // Si el Lambda no lo envía, será undefined
                    especialidad_id: occ.especialidad_id
                };
                console.log('Mapeado:', mapped);
                return mapped;
            });
            console.log('=========================');
            return res.json(occupants);
        }
        
        console.log('No hay ocupantes en la respuesta');
        console.log('=========================');
        res.json([]);
    } catch (error) {
        console.error('Error obteniendo ocupantes:', error);
        console.error('Error completo:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al obtener ocupantes' });
    }
});

/**
 * GET /api/groups/:groupId/bookings
 * Obtiene agendaciones filtradas por espacio y rango de fechas
 */
router.get('/api/groups/:groupId/bookings', async (req, res) => {
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        
        const { space_id, date_from, date_to } = req.query;
        
        console.log('[BOOKINGS API] Params:', { groupId, space_id, date_from, date_to });
        
        if (!space_id) {
            return res.status(400).json({ error: 'space_id es requerido' });
        }
        
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        
        // Obtener appointments para cada fecha en el rango - EN PARALELO
        const startDate = new Date(date_from);
        const endDate = new Date(date_to);
        
        console.log('[BOOKINGS API] Fechas parseadas:', { startDate, endDate });
        
        // Crear array de fechas
        const dates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }
        
        console.log('[BOOKINGS API] Total fechas a consultar:', dates.length);
        console.log('[BOOKINGS API] Primera fecha:', dates[0], 'Última fecha:', dates[dates.length - 1]);
        
        // Hacer peticiones en lotes para evitar saturar el Lambda
        const BATCH_SIZE = 5; // Máximo 5 peticiones simultáneas
        const appointments = [];
        
        for (let i = 0; i < dates.length; i += BATCH_SIZE) {
            const batch = dates.slice(i, i + BATCH_SIZE);
            console.log(`[BOOKINGS API] Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dates.length / BATCH_SIZE)}`);
            
            const batchPromises = batch.map(fecha => 
                apiClient.client.get(`/groups/${groupId}/appointments`, {
                    params: { fecha, espacio_id: space_id }
                })
                .then(response => {
                    const apts = response.data?.appointments || [];
                    console.log(`[BOOKINGS API] ${fecha}: ${apts.length} appointments encontrados`);
                    return apts;
                })
                .catch(err => {
                    console.error(`[BOOKINGS API ERROR] Fecha ${fecha} falló:`, {
                        message: err.message,
                        status: err.response?.status,
                        data: err.response?.data,
                        stack: err.stack
                    });
                    return [];
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            appointments.push(...batchResults.flat());
        }
        
        console.log('[BOOKINGS API] Total appointments encontrados:', appointments.length);
        
        // Validar que appointments sea un array
        if (!Array.isArray(appointments)) {
            console.error('[BOOKINGS API ERROR] appointments no es un array:', typeof appointments);
            return res.json([]);
        }
        
        // Adaptar formato de appointments a bookings
        const bookings = appointments
            .filter(apt => {
                // Validar que cada appointment tenga los campos necesarios
                if (!apt || !apt.fecha || !apt.hora_inicio || !apt.hora_fin) {
                    console.warn('[BOOKINGS API] Appointment inválido descartado:', apt);
                    return false;
                }
                return true;
            })
            .map(apt => {
                const id = apt.appointment_id || apt.SK;
                console.log('[BOOKINGS API] Mapeando appointment:', { 
                    fecha: apt.fecha,
                    appointment_id: apt.appointment_id, 
                    SK: apt.SK,
                    id_final: id 
                });
                return {
                    id: id,
                    space_id: apt.espacio_id,
                    occupant_id: apt.ocupante_id,
                    occupant_name: apt.ocupante_nombre,
                    date: apt.fecha,
                    startTime: apt.hora_inicio,
                    endTime: apt.hora_fin,
                    patient_name: apt.paciente_nombre,
                    patient_rut: apt.paciente_rut,
                    estado: apt.estado,
                    observaciones: apt.observaciones
                };
            });
        
        console.log('[BOOKINGS API] Bookings válidos después de mapeo:', bookings.length);
        console.log('[BOOKINGS API] TODOS los bookings:', bookings.map(b => ({ id: b.id, date: b.date, start: b.startTime })));
        
        // SIEMPRE devolver un array, incluso si está vacío
        res.json(Array.isArray(bookings) ? bookings : []);
    } catch (error) {
        console.error('[BOOKINGS API ERROR] Error crítico obteniendo agendaciones:', {
            message: error.message,
            stack: error.stack,
            params: req.query
        });
        // En caso de error, devolver array vacío en lugar de error 500
        // Esto evita que el frontend falle
        res.json([]);
    }
});

/**
 * POST /api/groups/:groupId/bookings
 * Crea una nueva agendación
 */
router.post('/api/groups/:groupId/bookings', async (req, res) => {
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        
        const { space_id, space_name, occupant_id, date, startTime, endTime, occupant_name, occupant_especialidad_id, occupant_especialidad_nombre } = req.body;
        
        console.log('[CREATE BOOKING] Request body:', req.body);
        
        // Validaciones
        if (!space_id || !occupant_id || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        if (startTime >= endTime) {
            return res.status(400).json({ error: 'La hora de fin debe ser posterior a la hora de inicio' });
        }
        
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        
        // Usar el nombre del espacio enviado desde el frontend
        const espacioNombre = space_name || 'Espacio desconocido';
        
        // Preparar datos en el formato que espera el Lambda
        const appointmentData = {
            fecha: date,
            hora_inicio: startTime,
            hora_fin: endTime,
            espacio_especifico: {
                id: space_id,
                nombre: espacioNombre
            },
            ocupante: {
                id: occupant_id,
                nombre: occupant_name || 'Ocupante desconocido'
            },
            estado: 'CONFIRMADA'
        };
        
        // Agregar especialidad si existe
        if (occupant_especialidad_id) {
            const espId = occupant_especialidad_id.toString().startsWith('ESP#') 
                ? occupant_especialidad_id 
                : `ESP#${occupant_especialidad_id}`;
            
            appointmentData.especialidad = {
                id: espId,
                nombre: occupant_especialidad_nombre || 'Especialidad desconocida'
            };
        }
        
        console.log('[CREATE BOOKING] Datos a enviar al Lambda:', appointmentData);
        
        const response = await apiClient.client.post(`/groups/${groupId}/appointments`, appointmentData);
        
        res.status(201).json(response.data);
    } catch (error) {
        console.error('Error creando agendación:', error);
        if (error.response) {
            console.log('❌ Error API [' + error.response.status + ']:', error.response.data);
        }
        res.status(500).json({ error: error.response?.data?.error || error.response?.data?.message || 'Error al crear agendación' });
    }
});

/**
 * PUT /api/groups/:groupId/bookings/:bookingId
 * Actualiza una agendación existente
 */
router.put('/api/groups/:groupId/bookings/:bookingId', async (req, res) => {
    let bookingId = req.params.bookingId; // Declarar fuera del try para que sea accesible en catch
    let updateData = {}; // Declarar fuera del try para logging en catch
    
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        
        console.log('BookingId recibido en Express:', bookingId);
        console.log('Params completos:', req.params);
        
        const { 
            space_id, 
            occupant_id, 
            date, 
            startTime, 
            endTime, 
            current_date,
            observaciones,
            occupant_name,
            occupant_especialidad_id,
            occupant_especialidad_nombre
        } = req.body;
        
        console.log('[UPDATE BOOKING] Datos recibidos del frontend:');
        console.log('  - occupant_id:', occupant_id);
        console.log('  - occupant_name:', occupant_name);
        console.log('  - occupant_especialidad_id:', occupant_especialidad_id);
        console.log('  - occupant_especialidad_nombre:', occupant_especialidad_nombre);
        console.log('  - observaciones:', observaciones);
        
        // Validaciones
        if (!occupant_id || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        if (startTime >= endTime) {
            return res.status(400).json({ error: 'La hora de fin debe ser posterior a la hora de inicio' });
        }
        
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        
        // Asegurar que el ocupante_id tiene el prefijo OCCUPANT#
        const fullOccupantId = occupant_id.startsWith('OCCUPANT#') ? occupant_id : `OCCUPANT#${occupant_id}`;
        
        updateData = {
            ocupante_id: fullOccupantId,
            fecha: date,
            hora_inicio: startTime,
            hora_fin: endTime,
            fecha_actual: current_date || date
        };
        
        // Agregar observaciones si existen
        if (observaciones !== undefined && observaciones !== null) {
            updateData.observaciones = observaciones;
        }
        
        // Agregar campos adicionales del ocupante si están disponibles
        if (occupant_name) {
            updateData.ocupante_nombre = occupant_name;
        }
        if (occupant_especialidad_id) {
            // Asegurar que el especialidad_id tiene el prefijo ESP#
            const fullEspecialidadId = occupant_especialidad_id.toString().startsWith('ESP#') 
                ? occupant_especialidad_id 
                : `ESP#${occupant_especialidad_id}`;
            
            updateData.especialidad_id = fullEspecialidadId;
        }
        if (occupant_especialidad_nombre) {
            updateData.especialidad_nombre = occupant_especialidad_nombre;
        }
        
        if (space_id) {
            updateData.espacio_id = space_id;
        }
        
        console.log('[UPDATE BOOKING] Datos a enviar al Lambda:');
        console.log(JSON.stringify(updateData, null, 2));
        
        console.log('[UPDATE BOOKING] Enviando a Lambda:');
        console.log('  - bookingId original:', bookingId);
        console.log('  - groupId:', groupId);
        
        // Codificar el bookingId para la URL de Lambda
        const encodedBookingId = encodeURIComponent(bookingId);
        console.log('  - bookingId codificado:', encodedBookingId);
        
        const lambdaUrl = `/groups/${groupId}/appointments/${encodedBookingId}`;
        console.log('  - URL Lambda:', lambdaUrl);
        
        const response = await apiClient.client.put(lambdaUrl, updateData);
        
        console.log('[UPDATE BOOKING] ✅ Respuesta exitosa del Lambda');
        res.json(response.data);
    } catch (error) {
        console.error('[UPDATE BOOKING] ❌ Error actualizando agendación:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            bookingId: bookingId,
            payload: updateData
        });
        
        const errorMessage = error.response?.data?.message 
            || error.response?.data?.error 
            || error.message 
            || 'Error al actualizar agendación';
        
        res.status(error.response?.status || 500).json({ 
            error: errorMessage,
            details: error.response?.data 
        });
    }
});

/**
 * DELETE /api/groups/:groupId/bookings/:bookingId
 * Elimina una agendación
 */
router.delete('/api/groups/:groupId/bookings/:bookingId', async (req, res) => {
    try {
        let groupId = req.params.groupId;
        if (!groupId || groupId === 'null') {
            groupId = req.session?.grupoActivo?.grupo_id;
        }
        if (!groupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo activo.' });
        }
        
        const { bookingId } = req.params;
        const { fecha, hora_inicio } = req.query;
        
        console.log('[DELETE BOOKING] bookingId:', bookingId, 'fecha:', fecha, 'hora_inicio:', hora_inicio);
        
        if (!fecha || !hora_inicio) {
            return res.status(400).json({ error: 'Se requieren los parámetros fecha y hora_inicio' });
        }
        
        const ApiClientV2 = require('../apiClientV2');
        const apiClient = new ApiClientV2(req.session.user?.idToken || req.headers.authorization?.replace('Bearer ', ''));
        
        // Codificar el bookingId para la URL de Lambda
        const encodedBookingId = encodeURIComponent(bookingId);
        
        await apiClient.client.delete(`/groups/${groupId}/appointments/${encodedBookingId}?fecha=${fecha}&hora_inicio=${hora_inicio}`);
        
        res.json({ message: 'Agendación eliminada exitosamente' });
    } catch (error) {
        console.error('Error eliminando agendación:', error);
        res.status(500).json({ error: error.response?.data?.message || 'Error al eliminar agendación' });
    }
});

module.exports = router;
