// routes/box.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

router.get('/especifico', checkPermission('box.read'), async (req, res) => {
  try {
    const filtroGeneral = expandirRangos(req.query.general);
    const filtroEspecifico = expandirRangos(req.query.especifico);
    const filtroEstado = req.query.estado;

    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toTimeString().slice(0, 5);

    // Obtener grupo activo
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
    
    if (!grupoId) {
      return res.status(400).send('No hay grupo activo');
    }

    // Obtener espacios del grupo
    const espaciosResponse = await req.apiClient.listarEspacios(grupoId);
    console.log('📦 Respuesta de listarEspacios:', espaciosResponse);
    
    const espacios = espaciosResponse.espacios || [];
    console.log('📋 Espacios obtenidos:', espacios.length);
    if (espacios.length > 0) {
      console.log('📦 Primer espacio:', espacios[0]);
    }
    
    // Separar espacios generales y específicos
    // NOTA: Los específicos vienen dentro de cada general en el campo specificSpaces
    const generales = espacios.filter(e => e.tipo === 'general').sort((a, b) => {
      const numA = parseInt(a.nombre.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.nombre.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
    
    // Extraer todos los específicos de los arrays specificSpaces de cada general
    const especificos = [];
    espacios.forEach(espacio => {
      if (espacio.tipo === 'general' && Array.isArray(espacio.specificSpaces)) {
        espacio.specificSpaces.forEach(sub => {
          especificos.push(sub);
        });
      }
    });
    
    // Ordenar específicos por número
    especificos.sort((a, b) => {
      const numA = parseInt(a.nombre.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.nombre.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
    
    console.log('🏢 Generales:', generales.length, generales.map(g => ({ nombre: g.nombre, SK: g.SK, PK: g.PK })));
    console.log('🚪 Específicos:', especificos.length, especificos.map(e => ({ nombre: e.nombre, SK: e.SK, parent: e.parent })));
    
    // Obtener agenda del día (con manejo de errores graceful)
    let agendas = [];
    let agendasError = null;
    try {
      const agendasResponse = await req.apiClient.obtenerAgendaPorFecha(hoy);
      agendas = Array.isArray(agendasResponse) ? agendasResponse : (agendasResponse.agendas || []);
      console.log('📅 Agendas obtenidas:', agendas.length);
    } catch (err) {
      console.error('⚠️ Error obteniendo appointments (continuando sin ellos):', err.message);
      agendasError = 'No se pudieron cargar los appointments. Los espacios se mostrarán sin información de ocupación.';
      agendas = [];
    }

    // Generar estructura de datos
    const general_especifico_map = generarGeneralesConEspecificos(
      req,
      generales,
      especificos,
      agendas,
      filtroGeneral,
      filtroEspecifico,
      filtroEstado,
      hoy,
      ahora
    );

    console.log('🗺️ Map generado:', JSON.stringify(general_especifico_map, null, 2));

    // Obtener nomenclatura
    const nomenclatura = req.nomenclatura || { general: 'General', especifico: 'Específico' };
    console.log('📋 Nomenclatura:', nomenclatura);

    res.render('box', { 
      generales_especificos_map: general_especifico_map,
      personalization: res.locals.personalization || {},
      nomenclatura,
      currentPath: req.path,
      i18n: req.i18n,
      t: req.t,
      user: req.session.user,
      agendasError: agendasError // Pasar el error a la vista para mostrar advertencia
    });
  } catch (err) {
    console.error('❌ Error en /especifico:', err);
    res.status(500).send('Error cargando datos de espacios específicos');
  }
});

function expandirRangos(texto) {
  if (!texto) return null;
  const resultado = new Set();

  texto.split(',').forEach(parte => {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-').map(Number);
      if (!isNaN(inicio) && !isNaN(fin)) {
        for (let i = inicio; i <= fin; i++) resultado.add(i);
      }
    } else {
      const num = Number(parte);
      if (!isNaN(num)) resultado.add(num);
    }
  });

  return Array.from(resultado).sort((a, b) => a - b);
}

function generarGeneralesConEspecificos(req, generales, especificos, agendas, filtroGeneral, filtroEspecifico, filtroEstado, hoy, horaActual) {
  const resultado = {};
  
  console.log('\n🔧 generarGeneralesConEspecificos - Iniciando...');
  console.log('   Generales recibidos:', generales.length);
  console.log('   Específicos recibidos:', especificos.length);
  console.log('   Filtros:', { filtroGeneral, filtroEspecifico, filtroEstado });

  generales.forEach(general => {
    console.log(`\n   📂 Procesando general: "${general.nombre}" (SK: ${general.SK})`);
    
    // Extraer número del nombre para filtrado
    const numeroGeneral = parseInt(general.nombre.match(/\d+/)?.[0] || '0');
    if (filtroGeneral && !filtroGeneral.includes(numeroGeneral)) {
      console.log(`      ⏭️  Saltado por filtro (número ${numeroGeneral} no en filtro)`);
      return;
    }

    // Filtrar específicos que pertenecen a este general
    // Nota: parent puede ser grp_xxx#SPACE#1 o solo SPACE#1
    const generalId = general.SK; // Ej: SPACE#1
    console.log(`      🔍 Buscando específicos con parent = "${generalId}" o "${general.PK}"`);
    
    const especificosFiltrados = especificos.filter(e => {
      const match = e.parent === generalId || e.parent === general.PK;
      if (match) {
        console.log(`         ✅ "${e.nombre}" (parent: ${e.parent}) - MATCH`);
      }
      return match;
    });
    
    console.log(`      📊 Específicos encontrados: ${especificosFiltrados.length}`);
    
    const especificosProcesados = [];

    especificosFiltrados.forEach(especifico => {
      const numeroEspecifico = parseInt(especifico.nombre.match(/\d+/)?.[0] || '0');
      if (filtroEspecifico && !filtroEspecifico.includes(numeroEspecifico)) {
        console.log(`         ⏭️  "${especifico.nombre}" saltado por filtro`);
        return;
      }

      // Determinar estado (por ahora libre, luego integraremos con agenda)
      let estadoKey = 'free';
      let estado = req.t(`common.state_${estadoKey}`);

      // TODO: Integrar con agenda para determinar estado real
      // Por ahora todos son "Libre"

      if (filtroEstado && estado.replace(' ', '-').toLowerCase() !== filtroEstado) {
        console.log(`         ⏭️  "${especifico.nombre}" saltado por estado`);
        return;
      }

      console.log(`         ➕ Agregando "${especifico.nombre}" con estado "${estado}"`);
      especificosProcesados.push({
        id: especifico.SK,
        nombre: especifico.nombre,
        estado
      });
    });

    if (especificosProcesados.length > 0) {
      console.log(`      ✅ Agregando "${general.nombre}" con ${especificosProcesados.length} específicos`);
      resultado[general.nombre] = especificosProcesados;
    } else {
      console.log(`      ⚠️  "${general.nombre}" sin específicos, no se agrega al resultado`);
    }
  });

  console.log('\n🔧 Resultado final:', Object.keys(resultado).length, 'generales con específicos\n');
  return resultado;
}

router.get('/estado-boxes', async (req, res) => {
  try {
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
    
    if (!grupoId) {
      return res.status(400).json({ error: 'No hay grupo activo' });
    }

    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toTimeString().slice(0, 5);
    const contexto = new ContextoEstado();

    // Obtener espacios en lugar de boxes
    const espaciosResponse = await req.apiClient.listarEspacios(grupoId);
    const espacios = espaciosResponse.espacios || [];
    
    // Extraer específicos de los arrays specificSpaces de cada general
    const especificos = [];
    espacios.forEach(espacio => {
      if (espacio.tipo === 'general' && Array.isArray(espacio.specificSpaces)) {
        espacio.specificSpaces.forEach(sub => {
          especificos.push(sub);
        });
      }
    });

    const agendasResponse = await req.apiClient.obtenerAgendaPorFecha(hoy);
    let agendas = Array.isArray(agendasResponse) ? agendasResponse : (agendasResponse.agendas || []);

    agendas = agendas.map(a => ({
      ...a,
      boxId: Number(a.idbox),
      horaInicio: a.horaInicio.slice(0, 5),
      horaFin: a.horaFin ? a.horaFin.slice(0, 5) : null,
    }));

    const data = {};
    for (const especifico of especificos) {
      // Adaptar el objeto especifico al formato que espera el contexto
      const espacioAdaptado = {
        idBox: especifico.SK.split('#')[1], // Extraer ID del SK
        estado: 1 // Por defecto habilitado, TODO: añadir campo estado a SPACES_TABLE
      };

      const estado = contexto.obtenerEstado(req, espacioAdaptado, hoy, ahora, agendas);
      
      data[especifico.SK] = {
        estado: estado.nombre,
        medico: estado.medico,
        especialidad: estado.especialidad,
        consulta_actual: estado.consulta_actual,
        consulta_actual_id: estado.consulta_id,
        proxima_consulta: estado.proxima_consulta,
        inhabilitado: false, // TODO: añadir campo estado a SPACES_TABLE
      };
    }

    res.json(data);
  } catch (err) {
    console.error('❌ Error en /estado-boxes:', err);
    res.status(500).json({ error: 'Error cargando estado de espacios' });
  }
  
});

class EstadoBox {
  constructor({ nombre, medico = '', especialidad = '', consulta_actual = '', proxima_consulta = '', consulta_id = null }) {
    this.nombre = nombre;
    this.medico = medico;
    this.especialidad = especialidad;
    this.consulta_actual = consulta_actual;
    this.proxima_consulta = proxima_consulta;
    this.consulta_id = consulta_id;
  }
}

class EstadoInhabilitado {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    return new EstadoBox({ 
      nombre: req.t('common.state_disabled')
    });
  }
}

class EstadoConConsulta {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    const consultas = agendas.filter(a => {
      const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
      const fechaHoy = fecha;
      const horaInicio = a.horaInicio.slice(0,5);
      const matchFecha = fechaAgenda === fechaHoy;
      const matchHora = horaInicio <= horaActual;

      return a.idBox === box.idBox && matchFecha && matchHora;
    });

    for (const consulta of consultas) {
      const inicio = new Date(`${fecha}T${consulta.horaInicio}`);
      let fin;

      if (!consulta.horaFin) {
        fin = new Date(`${fecha}T23:59:59`);
      } else if (consulta.horaFin <= consulta.horaInicio) {
        const nextDay = new Date(fecha);
        nextDay.setDate(nextDay.getDate() + 1);
        fin = new Date(`${nextDay.toISOString().split('T')[0]}T${consulta.horaFin}`);
      } else {
        fin = new Date(`${fecha}T${consulta.horaFin}`);
      }

      const ahora = new Date(`${fecha}T${horaActual}`);

      if (ahora >= inicio && ahora < fin) {
        const estadoNombre = consulta.estado ? consulta.estado.toLowerCase() : '';
        let nombreEstado = req.t('common.state_in_use');

        if (estadoNombre === 'en espera' || estadoNombre === 'no atendido') {
          nombreEstado = req.t('common.state_waiting');
        } else if (estadoNombre === 'atendido') {
          nombreEstado = req.t('common.state_in_use');
        }

        return new EstadoBox({
          nombre: nombreEstado,
          medico: consulta.medicoNombre,
          especialidad: consulta.especialidadNombre,
          consulta_actual: `${consulta.horaInicio} - ${consulta.horaFin}`,
          consulta_id: consulta.idAgenda
        });
      }
    }

    return null;
  }
}

class EstadoLibre {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    const proximas = agendas.filter(a => {
      const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
      const fechaHoy = fecha;
      const horaInicio = a.horaInicio.slice(0,5);
      const matchFecha = fechaAgenda === fechaHoy;
      const matchHora = horaInicio > horaActual;
      return a.idBox === box.idBox && matchFecha && matchHora;
    });

    const proxima = proximas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0];

    if (proxima) {
      return new EstadoBox({
        nombre: req.t('common.state_free'),
        medico: proxima.medicoNombre,
        especialidad: proxima.especialidadNombre,
        proxima_consulta: `${proxima.horaInicio} - ${proxima.horaFin || ''}`
      });
    }

    return new EstadoBox({ nombre: req.t('common.state_free') });
  }
}

class ContextoEstado {
  obtenerEstado(req, box, fecha, horaActual, agendas) {
    if (box.estado === 0) {
      return new EstadoInhabilitado().calcularEstado(req, box, fecha, horaActual, agendas);
    }

    let estado = new EstadoConConsulta().calcularEstado(req, box, fecha, horaActual, agendas);

    if (!estado) {
      estado = new EstadoLibre().calcularEstado(req, box, fecha, horaActual, agendas);
    }

    return estado;
  }
}

module.exports = router;