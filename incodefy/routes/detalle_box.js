const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

function formatFechaLarga(fechaStr) {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const [y, m, d] = fechaStr.split('-');
  return `${parseInt(d, 10)} de ${meses[parseInt(m, 10) - 1]} de ${y}`;
}

router.get('/especifico/:id', checkPermission('box.detalle.read'), async (req, res) => {
  try {
    const boxId = req.params.id;
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    if (!grupoId) {
      return res.status(400).send("No hay grupo activo");
    }

    // Obtener el espacio específico directamente de listarEspacios
    const espaciosResponse = await req.apiClient.listarEspacios(grupoId);
    const espacios = espaciosResponse.espacios || [];
    
    // Buscar el espacio específico
    let espacioEspecifico = null;
    let espacioGeneral = null;
    
    espacios.forEach(espacio => {
      if (espacio.tipo === 'general' && Array.isArray(espacio.specificSpaces)) {
        espacio.specificSpaces.forEach(sub => {
          const subId = sub.SK?.split('#')[1];
          if (subId === boxId) {
            espacioEspecifico = sub;
            espacioGeneral = espacio;
          }
        });
      }
    });

    if (!espacioEspecifico) {
      return res.status(404).send("Espacio específico no encontrado");
    }

    // Obtener instrumentos (si existe el endpoint)
    let instrumentos = [];
    try {
      instrumentos = await req.apiClient.obtenerInstrumentosPorBox(boxId, grupoId);
    } catch (err) {
      console.warn('No se pudieron obtener instrumentos:', err.message);
    }

    // Helper para verificar permisos (mismo patrón que server.js)
    const userHasPermission = (permission) => {
      if (req.session.user?.has_admin_permissions) return true;
      const grupoActivo = req.session.grupoActivo;
      if (!grupoActivo) return false;
      const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo.grupo_id;
      if (!grupoId) return false;
      const permissionsByGroup = req.session.user?.permissions_by_group || {};
      const groupPermissions = permissionsByGroup[grupoId];
      if (!groupPermissions || !groupPermissions.permissions) return false;
      return groupPermissions.permissions.includes(permission);
    };

    res.render("detalle_box", {
      currentPath: req.path,
      canEdit: userHasPermission('box.detalle.write'),
      personalization: res.locals.personalization || {},
      nomenclatura: req.nomenclatura || res.locals.nomenclatura || {},
      language: req.session.language || req.language || 'es',
      nombre: espacioEspecifico.nombre,
      idpasillo: espacioGeneral?.SK?.split('#')[1] || null,
      pasillo_nombre: espacioGeneral?.nombre || null,
      box_id: boxId,
      estado: espacioEspecifico.estado === 0 ? 'Inhabilitado' : 'Habilitado',
      instrumentos: instrumentos,
    });
  } catch (err) {
    console.error('❌ Error cargando detalle del box:', err);
    res.status(500).send('Error cargando detalle del box');
  }
});

router.get('/api/box-info', async (req, res) => {
  try {
    const { box_id, fecha } = req.query;
    if (!box_id || !fecha) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    const agendas = await req.apiClient.obtenerAgendaPorBoxYFecha(box_id, fecha);

    const horas_disponibles = [
      "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
      "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
      "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
      "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
    ];

    const tabla_horaria = {};
    horas_disponibles.forEach(h => (tabla_horaria[h] = ''));

    agendas.forEach(a => {
      if (a.horaInicio) {
        const inicio = a.horaInicio.slice(0, 5);
        const fin = a.horaFin ? a.horaFin.slice(0, 5) : '';
        const bloque = `${inicio} - ${fin}`;
        if (tabla_horaria[bloque] !== undefined) {
          tabla_horaria[bloque] = {
            medico: a.medicoNombre || '',
            especialidad: a.especialidadNombre || '',
            estado: a.estadoNombre || '',
            tipo_consulta: a.tipoConsulta || '',
          };
        }
      }
    });


    const total_consultas = agendas.length;
    const consultas_no_realizadas = agendas.filter(
      (a) => a.estadoNombre === 'No atendido'
    ).length;
    const consultas_realizadas = total_consultas - consultas_no_realizadas;
    const uso_box = horas_disponibles.length
      ? Math.round((total_consultas / horas_disponibles.length) * 100)
      : 0;
    const cumplimiento =
      total_consultas > 0
        ? Math.round((consultas_realizadas / total_consultas) * 100)
        : 0;

    res.json({
      fecha: formatFechaLarga(fecha),
      horarios: tabla_horaria,
      total_consultas,
      consultas_no_realizadas,
      uso_box,
      cumplimiento,
    });
  } catch (err) {
    console.error("❌ Error en /api/box-info:", err);
    res.status(500).json({ error: "Error al cargar información del box" });
  }
});

module.exports = router;