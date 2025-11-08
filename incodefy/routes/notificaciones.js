// routes/notificaciones.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

router.get('/historial-notificaciones', checkPermission('notificaciones.historial'), (req, res) => {
  res.render('historial_notificaciones', {
    currentPath: req.path,
    personalization: req.session.user?.personalization || {},
    user: req.session.user
  });
});

router.get('/notificaciones-usuario', async (req, res) => {
  try {
    console.log('📡 Obteniendo notificaciones del usuario:', req.session.user.email);

    const notificaciones = await req.apiClient.obtenerNotificaciones();

    console.log(notificaciones)
    
    console.log(`✅ ${notificaciones.length} notificaciones obtenidas`);

    const data = await Promise.all(notificaciones.map(async (n) => {
      let detalleProcesado = [];
      let mensajeTraducido = n.descripcion;

      try {
        const match = n.descripcion.match(/(\d+)/);
        const count = match ? parseInt(match[1], 10) : 0;
        if (count > 0) {
          mensajeTraducido = req.t('notifications.import_success', { count });
        }

        const detalleOriginal = typeof n.detalle === 'string' 
          ? JSON.parse(n.detalle) 
          : n.detalle;
        
        if (Array.isArray(detalleOriginal)) {
          detalleProcesado = await Promise.all(detalleOriginal.map(async (consulta) => {
            try {
              
              let estadoTraducido = req.t('common.pending');
              if (consulta.estado) {
                const estadoKey = consulta.estado.toLowerCase().replace(/\s+/g, '_');
                estadoTraducido = req.t(`notifications.${estadoKey}`, req.t('common.pending'));
              }

              const tipoConsulta = consulta.tipoconsulta;
              const normalizedTipo = String(tipoConsulta || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
              const tipoConsultaTraducido = normalizedTipo === 'medica'
                ? req.t('common.medical')
                : req.t('common.non_medical');

              return {
                fecha: consulta.fecha,
                horaInicio: consulta.horaInicio || consulta.horainicio,
                horaFin: consulta.horaFin || consulta.horafin,
                medico: consulta.medico,
                box: consulta.box,
                estado: estadoTraducido,
                tipoconsulta: tipoConsultaTraducido
              };
            } catch (consultaErr) {
              console.error('❌ Error procesando consulta individual:', consultaErr);
              return {
                fecha: consulta.fecha || '',
                horaInicio: consulta.horaInicio || consulta.horainicio || '',
                horaFin: consulta.horaFin || consulta.horafin || '',
                medico: req.t('common.unknown_doctor'),
                box: req.t('common.unknown_box'),
                estado: req.t('common.pending'),
                tipoconsulta: req.t('common.medical')
              };
            }
          }));
        }
      } catch (e) {
        console.error('❌ Error procesando notificación:', e);
        detalleProcesado = typeof n.detalle === 'string' ? n.detalle : JSON.stringify(n.detalle);
      }

      return {
        id: n.id || n.idNotificacion,
        fecha: n.fecha ? new Date(n.fecha).toISOString().slice(0, 19).replace('T', ' ') : '',
        mensaje: mensajeTraducido,
        detalle: detalleProcesado,
        tipo: n.tipo || 'info',
        leida: n.leida || false
      };
    }));

    console.log(`✅ ${data.length} notificaciones procesadas correctamente`);

    res.json({ 
      notificaciones: data,
      headers: {
        date: req.t('common.date'),
        start_time: req.t('common.start_time'),
        end_time: req.t('common.end_time'),
        doctor: req.t('common.doctor'),
        box: req.t('common.box'),
        consult_type: req.t('common.consult_type'),
        status: req.t('common.status')
      }
    });
  } catch (err) {
    console.error('❌ Error al cargar notificaciones:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ 
      error: 'Error al cargar notificaciones',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});
module.exports = router;