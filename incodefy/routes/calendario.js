// routes/calendario.js
const express = require('express');
const router = express.Router();
const db = require("../db");
const checkPermission = require("../middleware/checkPermission");

// Ruta principal del calendario
router.get('/agenda/calendario/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    if (!['box', 'medico'].includes(tipo)) {
      return res.status(400).send("Tipo de vista no válido");
    }

    const horas = [
      "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
      "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
      "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
      "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
    ];
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    // Obtener datos base
    const [pasillos, boxes, especialidades, medicos] = await Promise.all([
      db.query('SELECT idpasillo, nombre FROM pasillo ORDER BY nombre'),
      db.query('SELECT idbox, nombre, idpasillo FROM box ORDER BY nombre'),
      db.query('SELECT idespecialidad, nombre FROM especialidad ORDER BY nombre'),
      db.query(`
        SELECT m.idmedico, m.nombre, m.idespecialidad, e.nombre as especialidad_nombre
        FROM medico m
        LEFT JOIN especialidad e ON m.idespecialidad = e.idespecialidad
        ORDER BY m.nombre
      `)
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
    });

  } catch (error) {
    console.error('Error al cargar calendario:', error);
    res.status(500).render('error', { message: 'Error al cargar el calendario' });
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

    let query;
    let params;

    if (tipo === 'box' && box_id) {
      console.log('Consultando por BOX, box_id:', box_id);
      query = `
        SELECT 
          a.*,
          m.nombre as medico_nombre,
          b.nombre as box_nombre,
          e.nombre as estado_nombre
        FROM agenda a
        LEFT JOIN medico m ON a.idmedico = m.idmedico
        LEFT JOIN box b ON a.idbox = b.idbox
        LEFT JOIN estado e ON a.idestado = e.idestado
        WHERE a.idbox = ?
        ORDER BY a.fecha, a.horainicio
      `;
      params = [box_id];
    } else if (tipo === 'medico' && medico_id) {
      console.log('Consultando por MEDICO, medico_id:', medico_id);
      query = `
        SELECT 
          a.*,
          m.nombre as medico_nombre,
          b.nombre as box_nombre,
          e.nombre as estado_nombre
        FROM agenda a
        LEFT JOIN medico m ON a.idmedico = m.idmedico
        LEFT JOIN box b ON a.idbox = b.idbox
        LEFT JOIN estado e ON a.idestado = e.idestado
        WHERE a.idmedico = ?
        ORDER BY a.fecha, a.horainicio
      `;
      params = [medico_id];
    } else {
      console.log('Parámetros inválidos - tipo:', tipo, 'box_id:', box_id, 'medico_id:', medico_id);
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    console.log('Query a ejecutar:', query);
    console.log('Parámetros:', params);

    const agendamientos = await db.query(query, params);
    console.log('Agendamientos encontrados:', agendamientos.length);
    res.json({ agendamientos });

  } catch (error) {
    console.error('Error al obtener agendamientos:', error);
    res.status(500).json({ error: 'Error al obtener agendamientos' });
  }
});

// Guardar agenda
router.post('/agenda/guardar-agenda', async (req, res) => {
  try {
    const { medico_id, hora, fecha_inicio, box_id, tipo_usuario } = req.body;
    
    const partes_hora = hora.split(" - ");
    const hora_inicio = partes_hora[0];
    const hora_fin = partes_hora[1];
    
    // Verificar conflictos de box
    const conflictoBox = await db.query(`
      SELECT COUNT(*) as count FROM agenda 
      WHERE idbox = ? AND fecha = ? 
      AND ((horainicio < ? AND horafin > ?) OR (horainicio < ? AND horafin > ?))
    `, [box_id, fecha_inicio, hora_fin, hora_inicio, hora_inicio, hora_fin]);

    if (conflictoBox[0].count > 0) {
      return res.json({ status: 'error', mensaje: 'Ese horario ya está ocupado.' });
    }

    // Verificar conflictos de médico
    const conflictoMedico = await db.query(`
      SELECT COUNT(*) as count FROM agenda 
      WHERE idmedico = ? AND fecha = ? 
      AND ((horainicio < ? AND horafin > ?) OR (horainicio < ? AND horafin > ?))
    `, [medico_id, fecha_inicio, hora_fin, hora_inicio, hora_inicio, hora_fin]);

    if (conflictoMedico[0].count > 0) {
      return res.json({ status: 'error', mensaje: 'El médico ya está asignado en ese horario.' });
    }

    // Obtener estado "no atendido"
    const estado = await db.query(`
      SELECT idestado FROM estado WHERE nombre LIKE '%no atendido%' LIMIT 1
    `);

    const estadoId = estado.length > 0 ? estado[0].idestado : null;

    // Crear nueva agenda
    const result = await db.query(`
      INSERT INTO agenda (idmedico, idbox, idestado, horainicio, horafin, fecha, tipoconsulta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [medico_id, box_id, estadoId, hora_inicio, hora_fin, fecha_inicio, tipo_usuario]);

    res.json({ status: 'ok', idAgenda: result.insertId });

  } catch (error) {
    console.error('Error al guardar agenda:', error);
    res.status(500).json({ status: 'error', mensaje: 'Error interno del servidor' });
  }
});

// Eliminar agenda médico
router.post('/agenda/eliminar-agenda-medico', async (req, res) => {
  try {
    const { medico_id, fecha, hora, box_id } = req.body;
    
    const [hora_inicio, hora_fin] = hora.split(" - ");
    
    const result = await db.query(`
      DELETE FROM agenda 
      WHERE idmedico = ? AND fecha = ? AND horainicio = ? AND horafin = ? AND idbox = ?
    `, [medico_id, fecha, hora_inicio, hora_fin, box_id]);

    if (result.affectedRows > 0) {
      res.json({ status: 'ok', mensaje: 'Agenda eliminada' });
    } else {
      res.status(404).json({ error: 'Agenda no encontrada' });
    }

  } catch (error) {
    console.error('Error al eliminar agenda:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar agenda box
router.post('/agenda/eliminar-agenda-box', async (req, res) => {
  try {
    const { medico_id, fecha, hora, box_id } = req.body;
    
    const [hora_inicio, hora_fin] = hora.split(" - ");
    
    const result = await db.query(`
      DELETE FROM agenda 
      WHERE idmedico = ? AND fecha = ? AND horainicio = ? AND horafin = ? AND idbox = ?
    `, [medico_id, fecha, hora_inicio, hora_fin, box_id]);

    if (result.affectedRows > 0) {
      res.json({ status: 'ok' });
    } else {
      res.json({ status: 'error', mensaje: 'Agendamiento no encontrado.' });
    }

  } catch (error) {
    console.error('Error al eliminar agenda:', error);
    res.json({ status: 'error', mensaje: 'Error interno del servidor.' });
  }
});

module.exports = router;