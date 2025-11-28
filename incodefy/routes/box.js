// routes/box.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");
const CacheManager = require('../utils/cacheManager');

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
      let agendasRaw = Array.isArray(agendasResponse) ? agendasResponse : (agendasResponse.appointments || agendasResponse.agendas || []);
      
      // Mapear campos para compatibilidad (igual que en /estado-boxes)
      agendas = agendasRaw.map(a => ({
        ...a,
        boxId: a.espacio_id ? Number(a.espacio_id.replace(/\D/g, '')) : 
               (a.espacio_especifico?.id ? Number(a.espacio_especifico.id.replace(/\D/g, '')) : 
               (a.idbox ? Number(a.idbox) : null)),
        horaInicio: a.hora_inicio ? a.hora_inicio.slice(0, 5) : (a.horaInicio ? a.horaInicio.slice(0, 5) : null),
        horaFin: a.hora_fin ? a.hora_fin.slice(0, 5) : (a.horaFin ? a.horaFin.slice(0, 5) : null),
        idMedico: a.ocupante_id || a.ocupante?.id || a.idMedico,
        nombreMedico: a.ocupante_nombre || a.ocupante?.nombre || a.nombreMedico,
        especialidad: a.especialidad_nombre || a.especialidad?.nombre || a.especialidad,
      }));
      
      console.log('📅 Agendas obtenidas y mapeadas:', agendas.length);
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

    // Obtener estado de detallesVisibles 
    // Prioridad: 1) query param (cuando se recarga después de toggle), 2) cookie, 3) false por defecto
    let detallesVisibles = false;
    if (req.query.detallesVisibles !== undefined) {
      detallesVisibles = req.query.detallesVisibles === 'true';
    } else if (req.cookies?.detallesVisibles !== undefined) {
      detallesVisibles = req.cookies.detallesVisibles === 'true';
    }

    // Calcular contadores iniciales de estados
    const contadoresEstados = { libre: 0, 'en-espera': 0, 'en-uso': 0, inhabilitado: 0 };
    Object.values(general_especifico_map).forEach(especificos => {
      especificos.forEach(esp => {
        const estadoNormalizado = esp.estado.replace(/\s+/g, '-').toLowerCase();
        if (contadoresEstados.hasOwnProperty(estadoNormalizado)) {
          contadoresEstados[estadoNormalizado]++;
        }
      });
    });

    res.render('box', { 
      generales_especificos_map: general_especifico_map,
      personalization: res.locals.personalization || {},
      nomenclatura,
      currentPath: req.path,
      i18n: req.i18n,
      t: req.t,
      user: req.session.user,
      agendasError: agendasError, // Pasar el error a la vista para mostrar advertencia
      detallesVisibles: detallesVisibles, // Pasar estado inicial de expansión
      grupoActivo: req.session.grupoActivo, // Pasar grupoActivo para WebSocket
      contadoresEstados: contadoresEstados // Pasar contadores iniciales
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
  const contexto = new ContextoEstado();
  
  console.log('\n🔧 generarGeneralesConEspecificos - Iniciando...');
  console.log('   Generales recibidos:', generales.length);
  console.log('   Específicos recibidos:', especificos.length);
  console.log('   Agendas recibidas:', agendas.length);
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

      // Calcular estado real usando el mismo sistema que /estado-boxes
      const espacioAdaptado = {
        idBox: especifico.SK.split('#')[1], // Extraer ID del SK
        estado: 1 // Por defecto habilitado
      };

      const estadoObj = contexto.obtenerEstado(req, espacioAdaptado, hoy, horaActual, agendas);
      const estado = estadoObj.nombre;

      console.log(`         🔍 Estado calculado para "${especifico.nombre}": ${estado}`);

      if (filtroEstado && estado.replace(' ', '-').toLowerCase() !== filtroEstado) {
        console.log(`         ⏭️  "${especifico.nombre}" saltado por estado`);
        return;
      }

      console.log(`         ➕ Agregando "${especifico.nombre}" con estado "${estado}"`);
      especificosProcesados.push({
        id: especifico.SK,
        nombre: especifico.nombre,
        estado,
        medico: estadoObj.medico,
        especialidad: estadoObj.especialidad,
        consulta_actual: estadoObj.consulta_actual,
        proxima_consulta: estadoObj.proxima_consulta
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
    
    // Clave de caché: grupo + fecha + hora (redondeada a decenas de minutos)
    const horaRedondeada = ahora.substring(0, 4) + '0'; // HH:M0
    const cacheKey = `estados:${grupoId}:${hoy}:${horaRedondeada}`;
    
    // Intentar obtener de caché
    const estadosCache = CacheManager.get('estados', cacheKey);
    if (estadosCache) {
      console.log(`✅ Cache HIT para estados - Key: ${cacheKey}`);
      return res.json(estadosCache);
    }
    
    console.log(`❌ Cache MISS para estados - Key: ${cacheKey} - Calculando...`);
    const contexto = new ContextoEstado();

    // Obtener espacios (con caché propio)
    const espaciosCacheKey = `espacios:${grupoId}`;
    let espacios = CacheManager.get('espacios', espaciosCacheKey);
    
    if (!espacios) {
      console.log(`❌ Cache MISS para espacios - Llamando API...`);
      const espaciosResponse = await req.apiClient.listarEspacios(grupoId);
      espacios = espaciosResponse.espacios || [];
      CacheManager.set('espacios', espaciosCacheKey, espacios);
      console.log(`💾 Espacios guardados en caché (${espacios.length} items)`);
    } else {
      console.log(`✅ Cache HIT para espacios (${espacios.length} items)`);
    }
    
    // Extraer específicos de los arrays specificSpaces de cada general
    const especificos = [];
    espacios.forEach(espacio => {
      if (espacio.tipo === 'general' && Array.isArray(espacio.specificSpaces)) {
        espacio.specificSpaces.forEach(sub => {
          especificos.push(sub);
        });
      }
    });

    // Obtener agendas (con caché propio)
    const agendasCacheKey = `agendas:${hoy}`;
    let agendasResponse = CacheManager.get('agendas', agendasCacheKey);
    
    if (!agendasResponse) {
      console.log(`❌ Cache MISS para agendas - Llamando API...`);
      agendasResponse = await req.apiClient.obtenerAgendaPorFecha(hoy);
      CacheManager.set('agendas', agendasCacheKey, agendasResponse);
      console.log(`💾 Agendas guardadas en caché`);
    } else {
      console.log(`✅ Cache HIT para agendas`);
    }
    
    let agendas = Array.isArray(agendasResponse) ? agendasResponse : (agendasResponse.appointments || agendasResponse.agendas || []);

    console.log(`\n📋 === AGENDAS RECIBIDAS DE LA API ===`);
    console.log(`Total: ${agendas.length}`);
    if (agendas.length > 0) {
      console.log(`Ejemplo de agenda sin mapear:`, JSON.stringify(agendas[0], null, 2));
    }

    agendas = agendas.map(a => ({
      ...a,
      // Mapear campos nuevos a los esperados por el sistema
      // Prioridad: espacio_id directo, luego espacio_especifico.id, finalmente idbox antiguo
      boxId: a.espacio_id ? Number(a.espacio_id.replace(/\D/g, '')) : 
             (a.espacio_especifico?.id ? Number(a.espacio_especifico.id.replace(/\D/g, '')) : 
             (a.idbox ? Number(a.idbox) : null)),
      horaInicio: a.hora_inicio ? a.hora_inicio.slice(0, 5) : (a.horaInicio ? a.horaInicio.slice(0, 5) : null),
      horaFin: a.hora_fin ? a.hora_fin.slice(0, 5) : (a.horaFin ? a.horaFin.slice(0, 5) : null),
      // Mantener campos originales también
      idMedico: a.ocupante_id || a.ocupante?.id || a.idMedico,
      nombreMedico: a.ocupante_nombre || a.ocupante?.nombre || a.nombreMedico,
      especialidad: a.especialidad_nombre || a.especialidad?.nombre || a.especialidad,
    }));
    
    console.log(`\n📋 === AGENDAS DESPUÉS DEL MAPEO ===`);
    if (agendas.length > 0) {
      console.log(`Ejemplo mapeado:`, JSON.stringify(agendas[0], null, 2));
    }
    console.log(`===================================\n`);

    const data = {};
    console.log(`\n📊 === PROCESANDO ESTADOS DE ${especificos.length} ESPACIOS ===`);
    console.log(`📅 Fecha: ${hoy}, ⏰ Hora actual: ${ahora}`);
    console.log(`📋 Total agendas/appointments: ${agendas.length}`);
    
    for (const especifico of especificos) {
      // Adaptar el objeto especifico al formato que espera el contexto
      const espacioAdaptado = {
        idBox: especifico.SK.split('#')[1], // Extraer ID del SK
        estado: 1 // Por defecto habilitado, TODO: añadir campo estado a SPACES_TABLE
      };

      console.log(`\n🏢 Procesando: ${especifico.nombre} (${especifico.SK})`);
      console.log(`   📍 idBox adaptado: ${espacioAdaptado.idBox}`);
      
      // Mostrar agendas que coinciden con este espacio
      const agendasEspacio = agendas.filter(a => {
        const boxIdNum = Number(espacioAdaptado.idBox);
        const match = a.boxId === boxIdNum;
        return match;
      });
      
      console.log(`   📅 Agendas encontradas para este espacio: ${agendasEspacio.length}`);
      agendasEspacio.forEach(ag => {
        console.log(`      - Fecha: ${ag.fecha}, Hora: ${ag.horaInicio || ag.hora_inicio} - ${ag.horaFin || ag.hora_fin}`);
        console.log(`        Ocupante: ${ag.nombreMedico || ag.ocupante?.nombre || 'N/A'}`);
        console.log(`        boxId: ${ag.boxId}, espacio_especifico: ${ag.espacio_especifico?.id || 'N/A'}`);
      });

      const estado = contexto.obtenerEstado(req, espacioAdaptado, hoy, ahora, agendas);
      
      console.log(`   ✅ Estado calculado: ${estado.nombre}`);
      if (estado.medico) console.log(`      👤 Médico: ${estado.medico}`);
      if (estado.consulta_actual) console.log(`      🕒 Consulta actual: ${estado.consulta_actual}`);
      if (estado.proxima_consulta) console.log(`      ⏭️  Próxima: ${estado.proxima_consulta}`);
      
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
    
    console.log(`\n✅ === FIN PROCESAMIENTO DE ESTADOS ===\n`);

    // Guardar resultado en caché
    CacheManager.set('estados', cacheKey, data);
    console.log(`💾 Estados guardados en caché - Key: ${cacheKey}`);

    res.json(data);
  } catch (err) {
    console.error('❌ Error en /estado-boxes:', err);
    res.status(500).json({ error: 'Error cargando estado de espacios' });
  }
  
});

// Endpoint para invalidar caché (útil para webhooks/websockets)
router.post('/invalidar-cache', (req, res) => {
  try {
    const { tipo, clave } = req.body;
    
    if (tipo && clave) {
      // Invalidar una clave específica
      CacheManager.invalidate(tipo, clave);
      console.log(`🗑️  Cache invalidado: ${tipo}:${clave}`);
      res.json({ success: true, mensaje: `Cache ${tipo}:${clave} invalidado` });
    } else if (tipo) {
      // Invalidar todo un tipo de cache
      CacheManager.flush(tipo);
      console.log(`🗑️  Cache flush completo: ${tipo}`);
      res.json({ success: true, mensaje: `Todos los caches de tipo ${tipo} invalidados` });
    } else {
      res.status(400).json({ error: 'Se requiere al menos el parámetro tipo' });
    }
  } catch (err) {
    console.error('❌ Error invalidando cache:', err);
    res.status(500).json({ error: 'Error invalidando cache' });
  }
});

// Endpoint para ver estadísticas de caché
router.get('/cache-stats', (req, res) => {
  try {
    const stats = CacheManager.getStats();
    res.json(stats);
  } catch (err) {
    console.error('❌ Error obteniendo stats de cache:', err);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
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
    console.log(`      🔍 [EstadoConConsulta] Verificando si tiene consulta activa...`);
    const consultas = agendas.filter(a => {
      if (!a.fecha || !a.horaInicio) return false;
      const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
      const fechaHoy = fecha;
      const horaInicio = a.horaInicio.slice(0,5);
      const matchFecha = fechaAgenda === fechaHoy;
      const matchHora = horaInicio <= horaActual;
      const boxIdNum = Number(box.idBox);
      const matchBox = a.boxId === boxIdNum;
      
      if (matchBox) {
        console.log(`         📌 Agenda: ${a.horaInicio}-${a.horaFin || '?'}, Fecha match: ${matchFecha}, Hora match: ${matchHora} (inicio: ${horaInicio} <= actual: ${horaActual})`);
      }
      
      return matchBox && matchFecha && matchHora;
    });
    
    console.log(`      📊 Consultas que empezaron antes/ahora: ${consultas.length}`);

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

      console.log(`         ⏰ Verificando si está en progreso: ahora=${ahora.toISOString()} entre ${inicio.toISOString()} y ${fin.toISOString()}`);

      if (ahora >= inicio && ahora < fin) {
        console.log(`         ✅ CONSULTA ACTIVA ENCONTRADA`);
        const estadoNombre = consulta.estado ? consulta.estado.toLowerCase() : '';
        let nombreEstado = req.t('common.state_in_use');

        if (estadoNombre === 'en espera' || estadoNombre === 'no atendido') {
          nombreEstado = req.t('common.state_waiting');
        } else if (estadoNombre === 'atendido') {
          nombreEstado = req.t('common.state_in_use');
        }

        return new EstadoBox({
          nombre: nombreEstado,
          medico: consulta.nombreMedico || consulta.medicoNombre || '',
          especialidad: consulta.especialidad || consulta.especialidadNombre || '',
          consulta_actual: `${consulta.horaInicio} - ${consulta.horaFin || ''}`,
          consulta_id: consulta.appointment_id || consulta.SK || consulta.idAgenda
        });
      } else {
        console.log(`         ❌ Consulta no está activa (fuera del rango de tiempo)`);
      }
    }

    console.log(`      ❌ [EstadoConConsulta] No hay consulta activa`);
    return null;
  }
}

class EstadoLibre {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    console.log(`      🔍 [EstadoLibre] Buscando próximas consultas...`);
    const proximas = agendas.filter(a => {
      if (!a.fecha || !a.horaInicio) return false;
      const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
      const fechaHoy = fecha;
      const horaInicio = a.horaInicio.slice(0,5);
      const matchFecha = fechaAgenda === fechaHoy;
      const matchHora = horaInicio > horaActual;
      const boxIdNum = Number(box.idBox);
      const matchBox = a.boxId === boxIdNum;
      
      if (matchBox && matchFecha) {
        console.log(`         📌 Próxima posible: ${a.horaInicio}-${a.horaFin || '?'}, Hora match: ${matchHora} (inicio: ${horaInicio} > actual: ${horaActual})`);
      }
      
      return matchBox && matchFecha && matchHora;
    });
    
    console.log(`      📊 Próximas consultas: ${proximas.length}`);

    const proxima = proximas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0];

    if (proxima) {
      console.log(`      ✅ [EstadoLibre] Próxima consulta: ${proxima.horaInicio}`);
      return new EstadoBox({
        nombre: req.t('common.state_free'),
        medico: proxima.nombreMedico || proxima.medicoNombre || '',
        especialidad: proxima.especialidad || proxima.especialidadNombre || '',
        proxima_consulta: `${proxima.horaInicio} - ${proxima.horaFin || ''}`
      });
    }

    console.log(`      ✅ [EstadoLibre] Libre sin próximas consultas`);
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