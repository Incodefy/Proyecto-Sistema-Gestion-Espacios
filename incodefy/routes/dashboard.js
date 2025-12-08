// routes/dashboard.js
const express = require('express');
const router = express.Router();
const checkPermission = require("../middleware/checkPermission");

// NOTA: requireAuth y attachApiClient ya están aplicados en server.js
// No duplicar middlewares aquí

// ============================================
// Cache de memoización para funciones puras
// ============================================
const memoCache = new Map();

const toKey = (str) => {
  if (!str) return '';
  const cached = memoCache.get(`toKey:${str}`);
  if (cached) return cached;
  
  const result = str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  
  memoCache.set(`toKey:${str}`, result);
  // Limpiar cache si crece mucho (>1000 entradas)
  if (memoCache.size > 1000) {
    const firstKey = memoCache.keys().next().value;
    memoCache.delete(firstKey);
  }
  return result;
};

function obtenerSemanaActual() {
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const diasHastaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diasHastaLunes);
  lunes.setHours(0, 0, 0, 0);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  return {
    inicio: lunes.toISOString().split('T')[0],
    fin: domingo.toISOString().split('T')[0],
  };
}

function calcularPeriodoAnterior(fechaInicio, fechaFin) {
  try {
    // Cache de memoización
    const cacheKey = `periodo:${fechaInicio}:${fechaFin}`;
    const cached = memoCache.get(cacheKey);
    if (cached) return cached;
    
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);
    
    const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const fechaInicioAnterior = new Date(fechaInicioDate);
    fechaInicioAnterior.setDate(fechaInicioDate.getDate() - diasPeriodo);
    
    const fechaFinAnterior = new Date(fechaInicioDate);
    fechaFinAnterior.setDate(fechaInicioDate.getDate() - 1);
    
    const result = {
      inicio: fechaInicioAnterior.toISOString().split('T')[0],
      fin: fechaFinAnterior.toISOString().split('T')[0]
    };
    
    memoCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error calculando período anterior:', error);
    return null;
  }
}

async function construirFiltrosDynamoDB(fechaInicio, fechaFin, grupoId) {
  const filtros = {
    fechaInicio: fechaInicio,
    fechaFin: fechaFin,
    grupo_id: grupoId
  };

  return filtros;
}

// ==========================
// 1. Render del dashboard
// ==========================
router.get('/dashboard', checkPermission('dashboard.read'), async (req, res) => {
  console.log('\n🎨 [DASHBOARD HANDLER] Ejecutando...');
  console.log('🎨 [DASHBOARD HANDLER] Usuario:', req.session?.user?.email);
  console.log('🎨 [DASHBOARD HANDLER] Grupo activo:', req.session?.grupoActivo?.grupo_id);
  
  res.render('dashboard', { 
    currentPath: req.path,
    personalization: res.locals.personalization || {},
    user: req.session.user,
    grupoActivo: req.session.grupoActivo,
    wsEndpoint: process.env.WS_ENDPOINT || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev'
  });
  
  console.log('🎨 [DASHBOARD HANDLER] Vista renderizada exitosamente\n');
});

// ==========================
// 2. Filtros iniciales
// ==========================
router.get('/dashboard/filtros-iniciales', async (req, res) => {
  try {
    const startTime = Date.now();
    console.log('📊 Obteniendo filtros iniciales del dashboard');

    // Obtener grupo_id de la sesión
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    if (!grupoId) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay grupo activo. Por favor selecciona un grupo.' 
      });
    }

    // ✅ Llamadas paralelas optimizadas
    const [especialidades, espacios] = await Promise.all([
      req.apiClient.client.get(`/groups/${grupoId}/especialidades`).then(r => r.data.especialidades || []).catch(() => []),
      req.apiClient.listarEspacios(grupoId).then(r => r.espacios || []).catch(() => [])
    ]);

    // Formatear especialidades
    const especialidadesFormatted = especialidades.map((esp, index) => ({
      id: index + 1, // Usar índice como ID temporal
      nombre: esp.nombre || `Especialidad ${index + 1}`
    }));

    // Extraer espacios específicos (SUBSPACE) de todos los espacios
    const espaciosEspecificos = [];
    espacios.forEach(espacio => {
      if (espacio.specificSpaces && Array.isArray(espacio.specificSpaces)) {
        espacio.specificSpaces.forEach((subEspacio, index) => {
          espaciosEspecificos.push({
            id: parseInt(subEspacio.SK?.split('#')[1]) || index + 1,
            nombre: subEspacio.nombre || `Espacio ${index + 1}`
          });
        });
      }
    });

    const boxesFormatted = espaciosEspecificos.sort((a, b) => a.id - b.id);

    const endTime = Date.now();
    console.log(`✅ Filtros obtenidos en ${endTime - startTime}ms:`, {
      especialidades: especialidadesFormatted.length,
      boxes: boxesFormatted.length
    });

    // ✅ Headers de caching para optimizar requests subsecuentes
    res.set({
      'Cache-Control': 'private, max-age=300', // 5 minutos
      'ETag': `"${grupoId}-${especialidadesFormatted.length}-${boxesFormatted.length}"`,
      'X-Response-Time': `${endTime - startTime}ms`
    });

    res.json({
      success: true,
      especialidades: especialidadesFormatted,
      boxes: boxesFormatted,
    });
  } catch (err) {
    console.error('❌ Error en filtros-iniciales:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ==========================
// 3. Datos del dashboard
// ==========================
router.post('/dashboard/datos', async (req, res) => {
  try {
    let { especialidades = [], boxes = [], fecha_inicio, fecha_fin } = req.body;

    // Obtener grupo_id de la sesión
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    if (!grupoId) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay grupo activo. Por favor selecciona un grupo.' 
      });
    }

    if (!fecha_inicio || !fecha_fin) {
      const semana = obtenerSemanaActual();
      fecha_inicio = semana.inicio;
      fecha_fin = semana.fin;
    }

    especialidades = especialidades
      .filter(id => id && !isNaN(parseInt(id)))
      .map(id => parseInt(id));
    
    boxes = boxes
      .filter(id => id && !isNaN(parseInt(id)))
      .map(id => parseInt(id));

    console.log('📊 Procesando dashboard con filtros:', { 
      grupoId,
      especialidades, 
      boxes, 
      fecha_inicio, 
      fecha_fin 
    });

    const startTime = Date.now();

    // ✅ OPTIMIZACIÓN CRÍTICA: Caché compartido de appointments a nivel de request
    // Pre-cargar appointments una sola vez para evitar duplicación
    const periodoAnterior = calcularPeriodoAnterior(fecha_inicio, fecha_fin);
    
    // Caché compartido entre KPIs y gráficos
    const appointmentsCache = {
      actual: null,
      anterior: null
    };
    
    // Pre-cargar appointments en paralelo (período actual + anterior)
    const [appointmentsActual, appointmentsAnterior] = await Promise.all([
      req.apiClient.obtenerAppointmentsRango(grupoId, fecha_inicio, fecha_fin),
      periodoAnterior ? req.apiClient.obtenerAppointmentsRango(grupoId, periodoAnterior.inicio, periodoAnterior.fin) : Promise.resolve([])
    ]);
    
    appointmentsCache.actual = appointmentsActual;
    appointmentsCache.anterior = appointmentsAnterior;
    
    console.log(`📦 Appointments cargados: ${appointmentsActual.length} actual, ${appointmentsAnterior.length} anterior`);

    // Calcular KPIs y gráficos en paralelo usando caché compartido
    const [kpis, graficos] = await Promise.all([
      calcularKpis(req, especialidades, boxes, fecha_inicio, fecha_fin, grupoId, appointmentsCache),
      calcularGraficos(req, especialidades, boxes, fecha_inicio, fecha_fin, grupoId, appointmentsCache)
    ]);

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    console.log(`✅ Dashboard calculado en ${responseTime}ms`);

    // ✅ Headers de performance y caching
    res.set({
      'Cache-Control': 'private, max-age=60', // 1 minuto de cache
      'X-Response-Time': `${responseTime}ms`,
      'X-Appointments-Count': appointmentsCache.actual.length.toString()
    });

    res.json({ success: true, kpis, graficos });
  } catch (err) {
    console.error('❌ Error en dashboard/datos:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ==========================
// 4. Función: calcular KPIs
// ==========================
async function calcularKpis(req, especialidades, boxes, fechaInicio, fechaFin, grupoId, appointmentsCache) {
  const periodoAnterior = calcularPeriodoAnterior(fechaInicio, fechaFin);
  
  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24)) + 1;

  console.log(`📅 Período actual: ${fechaInicio} a ${fechaFin} (${diasPeriodo} días)`);

  // ✅ OPTIMIZACIÓN: Usar caché compartido en lugar de llamadas a Lambda
  const appointmentsActual = appointmentsCache.actual;
  const appointmentsAnterior = appointmentsCache.anterior;
  
  const totalActual = appointmentsActual.length;
  const totalConsultasAnterior = appointmentsAnterior.length;
  const variacionConsultas = totalActual - totalConsultasAnterior;
  
  if (periodoAnterior) {
    console.log(`📈 Período anterior: ${periodoAnterior.inicio} a ${periodoAnterior.fin}`);
    console.log(`📊 Consultas actuales: ${totalActual}, anteriores: ${totalConsultasAnterior}`);
  }

  // Obtener espacios específicos (SUBSPACE) del grupo - reemplazo de boxes
  let espaciosEspecificos = [];
  try {
    const espaciosResponse = await req.apiClient.listarEspacios(grupoId);
    const todosEspacios = espaciosResponse.espacios || [];
    
    // Extraer todos los SUBSPACE de los SPACE
    todosEspacios.forEach(espacio => {
      if (espacio.specificSpaces && Array.isArray(espacio.specificSpaces)) {
        espaciosEspecificos.push(...espacio.specificSpaces);
      }
    });
  } catch (err) {
    console.warn('⚠️ Error obteniendo espacios específicos:', err.message);
  }

  const totalEspacios = boxes.length > 0 
    ? espaciosEspecificos.filter(e => boxes.includes(parseInt(e.id || e.SK?.split('#')[1]))).length
    : espaciosEspecificos.length;

  let ocupacionActual = null;
  let variacionOcupacion = 0;
  
  if (totalEspacios > 0 && totalActual > 0) {
    const capacidad = totalEspacios * diasPeriodo * 12;
    ocupacionActual = parseFloat(((totalActual / capacidad) * 100).toFixed(1));
    
    if (periodoAnterior && totalConsultasAnterior > 0) {
      const ocupacionAnterior = parseFloat(((totalConsultasAnterior / capacidad) * 100).toFixed(1));
      variacionOcupacion = parseFloat((ocupacionActual - ocupacionAnterior).toFixed(1));
    }
  }

  const promedioConsultasDiario = diasPeriodo > 0 
    ? parseFloat((totalActual / diasPeriodo).toFixed(1)) 
    : 0;
  
  let variacionPromedioDiario = 0;
  if (periodoAnterior && totalConsultasAnterior > 0) {
    const promedioAnterior = parseFloat((totalConsultasAnterior / diasPeriodo).toFixed(1));
    variacionPromedioDiario = parseFloat((promedioConsultasDiario - promedioAnterior).toFixed(1));
  }

  // ✅ OPTIMIZACIÓN: Calcular especialidad más demandada directamente desde caché
  const porEspecialidadActual = {};
  appointmentsActual.forEach(apt => {
    const esp = apt.especialidad_nombre || 'Sin especialidad';
    porEspecialidadActual[esp] = (porEspecialidadActual[esp] || 0) + 1;
  });
  
  let especialidadTop = null;
  let maxCount = 0;
  for (const [nombre, consultas] of Object.entries(porEspecialidadActual)) {
    if (consultas > maxCount) {
      maxCount = consultas;
      especialidadTop = { nombre, consultas };
    }
  }

  console.log("especialidadTop: ", especialidadTop);

  // Calcular tendencia comparando con período anterior
  let tendenciaEspecialidad = 'igual';
  if (especialidadTop && periodoAnterior && appointmentsAnterior.length > 0) {
    const porEspecialidadAnterior = {};
    appointmentsAnterior.forEach(apt => {
      const esp = apt.especialidad_nombre || 'Sin especialidad';
      porEspecialidadAnterior[esp] = (porEspecialidadAnterior[esp] || 0) + 1;
    });
    
    let maxCountAnt = 0;
    let especialidadAnt = null;
    for (const [nombre, consultas] of Object.entries(porEspecialidadAnterior)) {
      if (consultas > maxCountAnt) {
        maxCountAnt = consultas;
        especialidadAnt = { nombre, consultas };
      }
    }
    
    if (especialidadAnt) {
      if (especialidadTop.consultas > especialidadAnt.consultas) {
        tendenciaEspecialidad = 'sube';
      } else if (especialidadTop.consultas < especialidadAnt.consultas) {
        tendenciaEspecialidad = 'baja';
      }
    }
  }

  return {
    total_consultas: totalActual,
    variacion_consultas: variacionConsultas,
    consultas_subtext: req.t('dashboard.kpi.days_in_period', { count: diasPeriodo }),

    ocupacion_actual: ocupacionActual,
    variacion_ocupacion: variacionOcupacion,
    ocupacion_subtext: req.t('dashboard.kpi.total_capacity', { count: totalEspacios }),

    promedio_consultas_diario: promedioConsultasDiario,
    variacion_promedio_diario: variacionPromedioDiario,
    promedio_subtext: req.t('dashboard.kpi.appointments_per_day'),

    especialidad_mas_demandada: especialidadTop 
      ? req.t(`specialties.${toKey(especialidadTop.nombre)}`, especialidadTop.nombre) 
      : null,
    consultas_especialidad_top: especialidadTop?.consultas || 0,
    tendencia_especialidad: tendenciaEspecialidad,
    especialidad_subtext: especialidadTop 
      ? req.t('dashboard.kpi.appointments_count', { count: especialidadTop.consultas }) 
      : '',

    total_boxes_disponibles: totalEspacios,
    dias_periodo: diasPeriodo,
    horas_pico: "No disponible",

    periodo_anterior: {
      fecha_inicio: periodoAnterior?.inicio || null,
      fecha_fin: periodoAnterior?.fin || null,
    }
  };
}

// ==========================
// 5. Función: calcular Gráficos
// ==========================
async function calcularGraficos(req, especialidades, boxes, fechaInicio, fechaFin, grupoId, appointmentsCache) {
  console.log('📊 Calculando gráficos del dashboard');

  // ✅ OPTIMIZACIÓN: Usar caché compartido
  const appointments = appointmentsCache.actual;
  
  console.log('📊 [DEBUG] Total appointments desde caché:', appointments.length);

  // ============================================
  // 1. Calcular consultas por día de la semana
  // ============================================
  const dias = [
    req.t('days.monday'), 
    req.t('days.tuesday'), 
    req.t('days.wednesday'), 
    req.t('days.thursday'), 
    req.t('days.friday'), 
    req.t('days.saturday'), 
    req.t('days.sunday')
  ];

  // Array ordenado: [Lun, Mar, Mie, Jue, Vie, Sab, Dom]
  const consultasPorDiaData = [0, 0, 0, 0, 0, 0, 0];
  
  appointments.forEach(apt => {
    if (!apt.fecha) return;
    
    // Parsear fecha en UTC para evitar problemas de timezone
    const [year, month, day] = apt.fecha.split('-').map(Number);
    const diaJS = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    
    // Convertir a índice Lunes-Domingo
    let diaOrdenado;
    if (diaJS === 0) {
      diaOrdenado = 6; // Domingo va al final
    } else {
      diaOrdenado = diaJS - 1; // Lunes(1)->0, Martes(2)->1, etc.
    }
    
    consultasPorDiaData[diaOrdenado]++;
  });
  
  console.log('📊 [DEBUG] consultasPorDiaData calculado:', consultasPorDiaData);
  console.log('📊 [DEBUG] Labels (días):', dias);
  
  const totalDias = consultasPorDiaData.reduce((sum, count) => sum + count, 0);
  const diaMasActivo = totalDias > 0 
    ? dias[consultasPorDiaData.indexOf(Math.max(...consultasPorDiaData))] 
    : null;

  // ============================================
  // 2. Calcular consultas por especialidad
  // ============================================
  const porEspecialidad = {};
  appointments.forEach(apt => {
    const esp = apt.especialidad_nombre || 'Sin especialidad';
    porEspecialidad[esp] = (porEspecialidad[esp] || 0) + 1;
  });

  const consultasPorEspecialidadArray = Object.entries(porEspecialidad)
    .map(([nombre, consultas]) => ({ nombre, consultas }))
    .sort((a, b) => b.consultas - a.consultas);

  const consultasPorEspecialidadFormatted = consultasPorEspecialidadArray.length > 0 ? {
    labels: consultasPorEspecialidadArray.map((e) => 
      req.t(`specialties.${toKey(e.nombre)}`, e.nombre)
    ),
    data: consultasPorEspecialidadArray.map((e) => e.consultas),
    total: consultasPorEspecialidadArray.reduce((sum, e) => sum + e.consultas, 0)
  } : { labels: [], data: [], total: 0 };

  // ============================================
  // 3. Calcular rendimiento de médicos/ocupantes
  // ============================================
  const porOcupante = {};
  appointments.forEach(apt => {
    const nombre = apt.ocupante_nombre || 'Sin ocupante';
    const especialidad = apt.especialidad_nombre || 'Sin especialidad';
    
    if (!porOcupante[nombre]) {
      porOcupante[nombre] = {
        nombre,
        especialidad,
        consultas: 0
      };
    }
    porOcupante[nombre].consultas++;
  });

  const rendimientoMedicosArray = Object.values(porOcupante)
    .sort((a, b) => b.consultas - a.consultas);

  // Formatear rendimiento de médicos/ocupantes
  const rendimientoMedicosFormatted = rendimientoMedicosArray.length > 0 ? {
    labels: rendimientoMedicosArray.map((m) => m.nombre),
    data: rendimientoMedicosArray.map((m) => m.consultas),
    especialidades: rendimientoMedicosArray.map((m) => 
      req.t(`specialties.${toKey(m.especialidad)}`, m.especialidad)
    ),
    promedio: parseFloat(
      (rendimientoMedicosArray.reduce((sum, m) => sum + m.consultas, 0) / rendimientoMedicosArray.length).toFixed(1)
    )
  } : { labels: [], data: [], especialidades: [], promedio: 0 };

  console.log('✅ Gráficos calculados:', {
    especialidades: consultasPorEspecialidadFormatted.labels.length,
    dias: consultasPorDiaData.length,
    medicos: rendimientoMedicosFormatted.labels.length
  });

  return {
    consultas_por_especialidad: consultasPorEspecialidadFormatted,
    consultas_por_dia: {
      labels: dias,
      data: consultasPorDiaData,
      total: totalDias,
      dia_mas_activo: diaMasActivo
    },
    rendimiento_medicos: rendimientoMedicosFormatted,
    distribucion_horarios: null,
  };
}

module.exports = router;