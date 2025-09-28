// routes/notificaciones.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const checkPermission = require("../middleware/checkPermission");

// Página de historial
router.get("/historial-notificaciones", checkPermission('notificaciones.historial'), (req, res) => {
  res.render("historial_notificaciones", {
    currentPath: req.path,
    personalization: req.session.user?.personalization || {}
  });
});

// API de notificaciones
router.get("/notificaciones-usuario", async (req, res) => {
  try {
    // 1. Obtener todos los médicos y boxes para mapeo eficiente
    const [medicos] = await db.query("SELECT idmedico, nombre FROM medico");
    const [boxes] = await db.query("SELECT idbox, nombre FROM box");

    const medicosMap = new Map(medicos.map(m => [m.idmedico, m.nombre]));
    const boxesMap = new Map(boxes.map(b => [b.idbox, b.nombre]));

    // 2. Obtener las notificaciones
    const [rows] = await db.query(
      "SELECT fecha, mensaje, detalle FROM notificacion ORDER BY fecha DESC LIMIT 50"
    );

    // 3. Procesar y enriquecer cada notificación
    const data = rows.map(n => {
      let detalleProcesado = [];
      let mensajeTraducido = n.mensaje; // Usar mensaje original por defecto

      try {
        // Intentar traducir el mensaje principal
        const match = n.mensaje.match(/(\d+)/);
        const count = match ? parseInt(match[1], 10) : 0;
        if (count > 0) {
          mensajeTraducido = req.t('notifications.import_success', { count });
        }

        const detalleOriginal = JSON.parse(n.detalle);
        if (Array.isArray(detalleOriginal)) {
          detalleProcesado = detalleOriginal.map(consulta => {
            const medicoNombre = medicosMap.get(consulta.idmedico) || req.t('common.unknown_doctor');
            const boxNombre = boxesMap.get(consulta.idbox) || req.t('common.unknown_box');
            
            let estadoTraducido = req.t('common.pending'); // Por defecto
            if (consulta.estado) {
                const estadoKey = consulta.estado.toLowerCase().replace(/\s+/g, '_');
                estadoTraducido = req.t(`notifications.${estadoKey}`, req.t('common.pending'));
            }

            return {
              ...consulta,
              medico: medicoNombre,
              box: boxNombre,
              estado: estadoTraducido,
              tipoconsulta: req.t(`common.${(consulta.tipoconsulta || 'medical').toLowerCase()}`)
            };
          });
        }
      } catch (e) {
        // Si hay un error, mantener los valores originales
        detalleProcesado = n.detalle;
      }

      return {
        fecha: n.fecha ? n.fecha.toISOString().slice(0, 19).replace("T", " ") : "",
        mensaje: mensajeTraducido,
        detalle: detalleProcesado
      };
    });

    res.json({ 
      notificaciones: data,
      // Enviar cabeceras traducidas para la tabla del modal
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
    console.error("Error al cargar notificaciones:", err);
    res.status(500).json({ error: "Error al cargar notificaciones" });
  }
});

module.exports = router;
