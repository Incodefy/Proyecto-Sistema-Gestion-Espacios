// routes/calendario.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

// Ruta principal del calendario
router.get('/agenda/calendario/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    if (!['box', 'medico'].includes(tipo)) {
      return res.status(400).send('Tipo de vista no válido');
    }

    const horas = [
      '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
      '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
      '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00',
      '20:00 - 21:00', '21:00 - 22:00', '22:00 - 23:00', '23:00 - 00:00'
    ];
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const [pasillos, boxes, especialidades, medicos] = await Promise.all([
      req.apiClient.obtenerPasillos(),
      req.apiClient.obtenerBoxes(),
      req.apiClient.obtenerEspecialidades(),
      req.apiClient.obtenerMedicos()
    ]);

    let config;
    
    if (tipo === 'box') {
      config = {
        select_parent_placeholder: '-- Selecciona un pasillo --',
        select_entidad_placeholder: '-- Selecciona un box --',
        
        parent_items: pasillos.map(p => ({ id: p.idpasillo, nombre: p.nombre })),
        entidad_items: boxes.map(b => ({ 
          id: b.idbox, 
          parent_id: b.idpasillo, 
          display_name: `Box ${b.idbox}` 
        })),
        
        filtros_title: 'Especialidades',
        filtros_items: especialidades,
        grupos: especialidades,
        items_por_grupo: medicos
          .filter(m => m.idespecialidad !== null)
          .map(m => ({
            id: m.idmedico,
            nombre: m.nombre,
            grupo_nombre: m.especialidad_nombre,
            grupo_id: m.idespecialidad
          })),
        
        item_id_prefix: 'med',
        entidad_param: 'box',
        entidad_id: 'box_id',
        label_prefix: 'BOX',
        eliminar_endpoint: '/agenda/eliminar-agenda-box',
        item_id_field: 'medico_id',
      };
    } else {
      config = {
        select_parent_placeholder: '-- Selecciona especialidad --',
        select_entidad_placeholder: '-- Selecciona un médico --',
        
        parent_items: especialidades.map(e => ({ id: e.idespecialidad, nombre: e.nombre })),
        entidad_items: medicos.map(m => ({ 
          id: m.idmedico, 
          parent_id: m.idespecialidad, 
          display_name: m.nombre 
        })),
        
        filtros_title: 'Pasillos',
        filtros_items: pasillos,
        grupos: pasillos,
        items_por_grupo: boxes
          .filter(b => b.idpasillo !== null)
          .map(b => ({
            id: b.idbox,
            nombre: b.nombre,
            grupo_nombre: pasillos.find(p => p.idpasillo === b.idpasillo)?.nombre || 'Sin pasillo'
          })),
        
        item_id_prefix: 'box',
        entidad_param: 'medico',
        entidad_id: 'medico_id',
        label_prefix: 'MÉDICO',
        eliminar_endpoint: '/agenda/eliminar-agenda-medico',
        item_id_field: 'box_id',
      };
    }

    res.render('calendario_agenda', {
      currentPath: req.path,
      tipo,
      horas,
      dias,
      config,
      medicos,
      boxes,
      pasillos,
      especialidades,
      personalization: req.session.user?.personalization || {},
      user: req.session.user
    });

  } catch (error) {
    console.error('❌ Error al cargar calendario:', error);
    res.status(500).render('error', { 
      message: 'Error al cargar el calendario',
      error_msg: ['Error al cargar el calendario']
    });
  }
});

// Obtener agendamientos
router.get('/agenda/obtener-agendamientos', async (req, res) => {
  try {
    console.log('=== DEBUG obtener-agendamientos ===');
    console.log('Query params:', req.query);
    console.log('tipo:', req.query.tipo);
    console.log('box_id:', req.query.box_id);
    console.log('medico_id:', req.query.medico_id);

    const { tipo, box_id, medico_id } = req.query;
    
    let agendas = [];

    if (tipo === 'box' && box_id) {
      console.log('Consultando por BOX, box_id:', box_id);
      agendas = await req.apiClient.obtenerAgendaPorBox(box_id);
    } else if (tipo === 'medico' && medico_id) {
      console.log('Consultando por MEDICO, medico_id:', medico_id);
      agendas = await req.apiClient.obtenerAgendaPorMedico(medico_id);
    } else {
      console.log('Parámetros inválidos - tipo:', tipo, 'box_id:', box_id, 'medico_id:', medico_id);
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    console.log('Agendamientos encontrados:', agendas.length);
    res.json({ agendamientos: agendas });

  } catch (error) {
    console.error('❌ Error al obtener agendamientos:', error);
    res.status(500).json({ error: 'Error al obtener agendamientos' });
  }
});

// Guardar agenda
router.post('/agenda/guardar-agenda', async (req, res) => {
  try {
    const { medico_id, hora, fecha_inicio, box_id, tipo_usuario } = req.body;
    
    if (!medico_id || !hora || !fecha_inicio || !box_id) {
      return res.status(400).json({ 
        status: 'error', 
        mensaje: 'Faltan datos requeridos' 
      });
    }
    
    const partes_hora = hora.split(' - ');
    if (partes_hora.length !== 2) {
      return res.status(400).json({ 
        status: 'error', 
        mensaje: 'Formato de hora inválido' 
      });
    }
    
    const hora_inicio = partes_hora[0];
    const hora_fin = partes_hora[1];
    
    const [conflictoBox, conflictoMedico] = await Promise.all([
      req.apiClient.verificarConflictoBox(box_id, fecha_inicio, hora_inicio, hora_fin),
      req.apiClient.verificarConflictoMedico(medico_id, fecha_inicio, hora_inicio, hora_fin)
    ]);

    if (conflictoBox && conflictoBox.tieneConflicto) {
      return res.json({ 
        status: 'error', 
        mensaje: 'Ese horario ya está ocupado en el box.' 
      });
    }

    if (conflictoMedico && conflictoMedico.tieneConflicto) {
      return res.json({ 
        status: 'error', 
        mensaje: 'El médico ya está asignado en ese horario.' 
      });
    }

    const estadoData = await req.apiClient.obtenerEstadoNoAtendido();
    const estadoId = estadoData.idEstado || estadoData.id;

    const nuevaAgenda = {
      PK: `BOX#${box_id}#DATE#${fecha_inicio}`,
      SK: hora_inicio,
      idMedico: medico_id,
      idBox: box_id,
      idEstado: estadoId,
      horaInicio: hora_inicio,
      horaFin: hora_fin,
      fecha: fecha_inicio,
      tipoConsulta: tipo_usuario,
      creadoPor: req.session.user.email,
      fechaCreacion: new Date().toISOString()
    };

    await req.apiClient.insertarAgenda(nuevaAgenda);

    console.log('✅ Agenda guardada correctamente:', nuevaAgenda);
    res.json({ status: 'ok', mensaje: 'Agenda guardada correctamente' });

  } catch (error) {
    console.error('❌ Error al guardar agenda:', error);
    res.status(500).json({ 
      status: 'error', 
      mensaje: 'Error interno del servidor',
      detalle: error.message 
    });
  }
});

// Eliminar agenda médico
router.post('/agenda/eliminar-agenda-medico', async (req, res) => {
  try {
    const { medico_id, fecha, hora, box_id } = req.body;
    const [hora_inicio, hora_fin] = hora.split(' - ');
    
    const agendas = await req.apiClient.obtenerAgendaPorMedico(medico_id);
    const agendaEncontrada = agendas.find(a => 
      a.fecha === fecha && 
      a.horaInicio === hora_inicio && 
      a.horaFin === hora_fin &&
      a.idBox === parseInt(box_id)
    );

    if (!agendaEncontrada) {
      return res.status(404).json({ 
        status: 'error', 
        mensaje: 'Agenda no encontrada' 
      });
    }

    await req.apiClient.eliminarAgenda(agendaEncontrada.idAgenda);
    
    res.json({ status: 'ok', mensaje: 'Agenda eliminada' });

  } catch (error) {
    console.error('❌ Error al eliminar agenda:', error);
    res.status(500).json({ 
      status: 'error', 
      mensaje: 'Error interno del servidor' 
    });
  }
});

router.post('/agenda/eliminar-agenda-box', async (req, res) => {
  try {
    const { medico_id, fecha, hora, box_id } = req.body;
    
    if (!medico_id || !fecha || !hora || !box_id) {
      return res.status(400).json({ 
        status: 'error', 
        mensaje: 'Faltan datos requeridos' 
      });
    }
    
    const [hora_inicio, hora_fin] = hora.split(' - ');
    
    const agendas = await req.apiClient.obtenerAgendaPorBox(box_id);
    const agendaEncontrada = agendas.find(a => 
      a.fecha === fecha && 
      a.horaInicio === hora_inicio && 
      a.horaFin === hora_fin &&
      a.idMedico === parseInt(medico_id)
    );

    if (!agendaEncontrada) {
      return res.json({ 
        status: 'error', 
        mensaje: 'Agendamiento no encontrado.' 
      });
    }

    await req.apiClient.eliminarAgenda(agendaEncontrada.idAgenda);
    
    console.log('⚠️ Eliminación de agenda pendiente de implementar endpoint en Lambda');
    res.json({ 
      status: 'ok',
      mensaje: 'Agenda eliminada',
      warning: 'Funcionalidad parcialmente implementada'
    });

  } catch (error) {
    console.error('❌ Error al eliminar agenda:', error);
    res.json({ 
      status: 'error', 
      mensaje: 'Error interno del servidor.',
      detalle: error.message 
    });
  }
});

module.exports = router;