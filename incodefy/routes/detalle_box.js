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

router.get('/especifico/:id', checkPermission('espacio.read'), async (req, res) => {
  try {
    // Decodificar el ID del espacio (puede venir como SUBSPACE%231 desde la URL)
    const espacioId = decodeURIComponent(req.params.id); // ej: SUBSPACE#1
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    console.log('🔍 Buscando espacio específico:', espacioId);
    console.log('📦 Grupo activo:', grupoId);

    if (!grupoId) {
      return res.status(400).send('No hay grupo activo');
    }

    // Obtener todos los espacios del grupo
    const espaciosResponse = await req.apiClient.listarEspacios(grupoId);
    const espacios = espaciosResponse.espacios || [];

    console.log('📋 Total espacios obtenidos:', espacios.length);

    // Buscar el espacio específico
    let espacio = null;
    for (const esp of espacios) {
      console.log(`   Revisando espacio general: ${esp.nombre} (${esp.SK || esp.id})`);
      
      // Buscar en los específicos dentro de cada general
      if (esp.specificSpaces && Array.isArray(esp.specificSpaces)) {
        console.log(`      Tiene ${esp.specificSpaces.length} específicos:`, 
          esp.specificSpaces.map(s => ({ nombre: s.nombre, SK: s.SK, id: s.id })));
        
        const encontrado = esp.specificSpaces.find(sub => {
          const match = sub.SK === espacioId || sub.id === espacioId || sub.nombre === espacioId;
          if (match) {
            console.log(`      ✅ ENCONTRADO: ${sub.nombre}`);
          }
          return match;
        });
        
        if (encontrado) {
          espacio = {
            ...encontrado,
            parent_id: esp.SK || esp.id,
            parent_nombre: esp.nombre
          };
          break;
        }
      } else {
        console.log(`      ⚠️ No tiene specificSpaces`);
      }
    }

    if (!espacio) {
      console.error('❌ Espacio específico no encontrado:', espacioId);
      console.error('   Espacios disponibles:', espacios.map(e => ({
        nombre: e.nombre,
        SK: e.SK,
        specificSpaces: e.specificSpaces?.map(s => s.SK || s.id)
      })));
      return res.status(404).send('Espacio específico no encontrado');
    }

    console.log('✅ Espacio encontrado:', espacio);

    // Obtener instrumentos del espacio (endpoint puede no existir aún)
    let instrumentos = [];
    try {
      const instrumentosResponse = await req.apiClient.fetch(
        `/groups/${grupoId}/instrumentos?espacio_id=${espacioId}`
      );
      instrumentos = instrumentosResponse.ok ? instrumentosResponse.instrumentos || [] : [];
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar instrumentos:', err.message);
      // Continuar sin instrumentos
    }

    console.log('Instrumentos:', instrumentos);

    // Obtener nomenclatura
    const nomenclatura = req.nomenclatura || { general: 'General', especifico: 'Específico' };

    res.render('detalle_box', {
      currentPath: req.path,
      personalization: res.locals.personalization || {},
      nomenclatura,
      espacio_id: espacio.SK || espacio.id,
      nombre: espacio.nombre,
      espacio_general_id: espacio.parent_id || null,
      espacio_general_nombre: espacio.parent_nombre || nomenclatura.general,
      estado: espacio.activo !== false ? 'Habilitado' : 'Inhabilitado',
      instrumentos: instrumentos,
      grupo_id: grupoId,
      wsEndpoint: process.env.WS_ENDPOINT || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev',
      userRole: req.session.userRole || res.locals.userRole || null
    });
  } catch (err) {
    console.error('❌ Error cargando detalle del espacio:', err);
    res.status(500).send('Error cargando detalle del espacio');
  }
});

router.get('/api/espacio-info', async (req, res) => {
  try {
    const { espacio_id, fecha } = req.query;
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    if (!espacio_id || !fecha) {
      return res.status(400).json({ error: 'Faltan parámetros: espacio_id y fecha son requeridos' });
    }

    if (!grupoId) {
      return res.status(400).json({ error: 'No hay grupo activo' });
    }

    // Obtener appointments del espacio en la fecha específica usando la nueva API
    let agendas = [];
    try {
      const appointmentsResponse = await req.apiClient.client.get(
        `/groups/${grupoId}/appointments`,
        { params: { fecha, espacio_id } }
      );
      agendas = appointmentsResponse.data.appointments || [];
      console.log(`📅 Appointments obtenidos: ${agendas.length} para espacio ${espacio_id} en fecha ${fecha}`);
    } catch (err) {
      console.warn('⚠️ Error obteniendo appointments (continuando con array vacío):', err.message);
      console.error('Detalles del error:', err.response?.data || err.message);
      // Continuar con agendas vacías
    }

    const horas_disponibles = [
      '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
      '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
      '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00',
      '20:00 - 21:00', '21:00 - 22:00', '22:00 - 23:00', '23:00 - 00:00'
    ];

    const tabla_horaria = {};
    horas_disponibles.forEach(h => (tabla_horaria[h] = ''));

    agendas.forEach(a => {
      if (a.hora_inicio) {
        const inicio = a.hora_inicio.length === 5 ? a.hora_inicio : a.hora_inicio.slice(0, 5);
        const fin = a.hora_fin ? (a.hora_fin.length === 5 ? a.hora_fin : a.hora_fin.slice(0, 5)) : '';
        const bloque = `${inicio} - ${fin}`;
        if (tabla_horaria[bloque] !== undefined) {
          tabla_horaria[bloque] = {
            ocupante: a.ocupante_nombre || '',
            especialidad: a.especialidad_nombre || '',
            estado: a.estado || '',
            tipo_consulta: a.tipo_consulta || '',
          };
        }
      }
    });

    const total_consultas = agendas.length;
    const consultas_no_realizadas = agendas.filter(
      (a) => a.estado === 'No atendido' || a.estado === 'Programado'
    ).length;
    const consultas_realizadas = total_consultas - consultas_no_realizadas;
    const uso_espacio = horas_disponibles.length
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
      uso_espacio,
      cumplimiento,
    });
  } catch (err) {
    console.error('❌ Error en /api/espacio-info:', err);
    res.status(500).json({ error: 'Error al cargar información del espacio' });
  }
});

module.exports = router;