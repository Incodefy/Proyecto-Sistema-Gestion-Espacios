// routes/dashboard.js
const express = require('express');
const router = express.Router();
const checkPermission = require("../middleware/checkPermission");

// NOTA: requireAuth y attachApiClient ya están aplicados en server.js
// No duplicar middlewares aquí

const toKey = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
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
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);
    
    const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const fechaInicioAnterior = new Date(fechaInicioDate);
    fechaInicioAnterior.setDate(fechaInicioDate.getDate() - diasPeriodo);
    
    const fechaFinAnterior = new Date(fechaInicioDate);
    fechaFinAnterior.setDate(fechaInicioDate.getDate() - 1);
    
    return {
      inicio: fechaInicioAnterior.toISOString().split('T')[0],
      fin: fechaFinAnterior.toISOString().split('T')[0]
    };
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
    user: req.session.user
  });
  
  console.log('🎨 [DASHBOARD HANDLER] Vista renderizada exitosamente\n');
});

// ==========================
// 2. Filtros iniciales
// ==========================
router.get('/dashboard/filtros-iniciales', async (req, res) => {
  try {
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

    const [especialidades, espacios] = await Promise.all([
      req.apiClient.client.get(`/groups/${grupoId}/especialidades`).then(r => r.data.especialidades || []),
      req.apiClient.listarEspacios(grupoId).then(r => r.espacios || [])
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

    console.log('✅ Filtros obtenidos:', {
      especialidades: especialidadesFormatted.length,
      boxes: boxesFormatted.length
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

    // Calcular KPIs y gráficos en paralelo (ahora comparten cache)
    const [kpis, graficos] = await Promise.all([
      calcularKpis(req, especialidades, boxes, fecha_inicio, fecha_fin, grupoId),
      calcularGraficos(req, especialidades, boxes, fecha_inicio, fecha_fin, grupoId)
    ]);

    const endTime = Date.now();
    console.log(`✅ Dashboard calculado en ${endTime - startTime}ms`);

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
async function calcularKpis(req, especialidades, boxes, fechaInicio, fechaFin, grupoId) {
  const periodoAnterior = calcularPeriodoAnterior(fechaInicio, fechaFin);
  
  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24)) + 1;

  console.log(`📅 Período actual: ${fechaInicio} a ${fechaFin} (${diasPeriodo} días)`);

  // ✅ Construir filtros para Lambda (ahora incluye grupo_id)
  const filtrosActuales = await construirFiltrosDynamoDB(fechaInicio, fechaFin, grupoId);

  console.log("Filtros: ", filtrosActuales)

  // Obtener total de consultas actual
  const totalActual = await req.apiClient.obtenerTotalConsultas(filtrosActuales);

  let variacionConsultas = 0;
  let totalConsultasAnterior = 0;
  
  if (periodoAnterior) {
    const filtrosAnteriores = await construirFiltrosDynamoDB(
      periodoAnterior.inicio, 
      periodoAnterior.fin,
      grupoId
    );
    
    totalConsultasAnterior = await req.apiClient.obtenerTotalConsultas(filtrosAnteriores);
    variacionConsultas = totalActual - totalConsultasAnterior;
    
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

  // Especialidad más demandada
  const especialidadTop = await req.apiClient.obtenerEspecialidadMasDemandada(filtrosActuales);

  console.log("especialidadTop: ", especialidadTop)

  let tendenciaEspecialidad = 'igual';
  if (especialidadTop && periodoAnterior) {
    const filtrosAnteriores = await construirFiltrosDynamoDB(
      periodoAnterior.inicio,
      periodoAnterior.fin,
      grupoId
    );
    
    const especialidadAnt = await req.apiClient.obtenerEspecialidadMasDemandada(filtrosAnteriores);
    
    if (especialidadAnt) {
      const consultasAnteriores = especialidadAnt.consultas;
      if (especialidadTop.consultas > consultasAnteriores) {
        tendenciaEspecialidad = 'sube';
      } else if (especialidadTop.consultas < consultasAnteriores) {
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
async function calcularGraficos(req, especialidades, boxes, fechaInicio, fechaFin, grupoId) {
  console.log('📊 Calculando gráficos del dashboard');

  // ✅ Construir filtros (ahora incluye grupo_id)
  const filtros = await construirFiltrosDynamoDB(fechaInicio, fechaFin, grupoId);

  // ✅ Obtener datos en paralelo
  const [consultasPorEspecialidad, consultasPorDia, rendimientoMedicos] = await Promise.all([
    req.apiClient.obtenerConsultasPorEspecialidad(filtros),
    req.apiClient.obtenerConsultasPorDia(filtros),
    req.apiClient.obtenerRendimientoMedicos(filtros)
  ]);

  // Formatear consultas por especialidad
  const consultasPorEspecialidadFormatted = consultasPorEspecialidad && consultasPorEspecialidad.length > 0 ? {
    labels: consultasPorEspecialidad.map((e) => 
      req.t(`specialties.${toKey(e.nombre)}`, e.nombre)
    ),
    data: consultasPorEspecialidad.map((e) => e.consultas),
    total: consultasPorEspecialidad.reduce((sum, e) => sum + e.consultas, 0)
  } : { labels: [], data: [], total: 0 };

  // Formatear consultas por día
  const dias = [
    req.t('days.monday'), 
    req.t('days.tuesday'), 
    req.t('days.wednesday'), 
    req.t('days.thursday'), 
    req.t('days.friday'), 
    req.t('days.saturday'), 
    req.t('days.sunday')
  ];

  const consultasPorDiaData = Array.isArray(consultasPorDia) 
    ? consultasPorDia 
    : [0, 0, 0, 0, 0, 0, 0];
  
  const totalDias = consultasPorDiaData.reduce((sum, count) => sum + count, 0);
  const diaMasActivo = totalDias > 0 
    ? dias[consultasPorDiaData.indexOf(Math.max(...consultasPorDiaData))] 
    : null;

  // Formatear rendimiento de médicos/ocupantes
  const rendimientoMedicosFormatted = rendimientoMedicos && rendimientoMedicos.length > 0 ? {
    labels: rendimientoMedicos.map((m) => m.nombre),
    data: rendimientoMedicos.map((m) => m.consultas),
    especialidades: rendimientoMedicos.map((m) => 
      req.t(`specialties.${toKey(m.especialidad)}`, m.especialidad)
    ),
    promedio: parseFloat(
      (rendimientoMedicos.reduce((sum, m) => sum + m.consultas, 0) / rendimientoMedicos.length).toFixed(1)
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