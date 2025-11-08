// routes/dashboard.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

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

async function construirFiltrosDynamoDB(fechaInicio, fechaFin) {
  const filtros = {
    fechaInicio: fechaInicio,
    fechaFin: fechaFin
  };

  return filtros;
}

// ==========================
// 1. Render del dashboard
// ==========================
router.get('/dashboard', checkPermission('dashboard.read'), async (req, res) => {
  res.render('dashboard', { 
    currentPath: req.path,
    personalization: req.session.user?.personalization || {},
    user: req.session.user
  });
});

// ==========================
// 2. Filtros iniciales
// ==========================
router.get('/dashboard/filtros-iniciales', async (req, res) => {
  try {
    console.log('📊 Obteniendo filtros iniciales del dashboard');

    const [especialidades, boxes] = await Promise.all([
      req.apiClient.obtenerEspecialidades(),
      req.apiClient.obtenerBoxes()
    ]);

    const especialidadesFormatted = especialidades.map(esp => ({
      id: esp.idEspecialidad,
      nombre: req.t(`specialties.${toKey(esp.nombre)}`, esp.nombre)
    }));

    const boxesFormatted = boxes
      .map(box => ({
        id: box.idBox,
        nombre: box.nombre || `Box ${box.idBox}`
      }))
      .sort((a, b) => a.id - b.id);

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
      especialidades, 
      boxes, 
      fecha_inicio, 
      fecha_fin 
    });

    console.log("Especialidades: ", especialidades)
    console.log("Boxes: ", boxes)
    console.log("Fecha: ", fecha_inicio, fecha_fin)

    const [kpis, graficos] = await Promise.all([
      calcularKpis(req, especialidades, boxes, fecha_inicio, fecha_fin),
      calcularGraficos(req, especialidades, boxes, fecha_inicio, fecha_fin)
    ]);

    console.log('✅ Dashboard calculado exitosamente');

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
async function calcularKpis(req, especialidades, boxes, fechaInicio, fechaFin) {
  const periodoAnterior = calcularPeriodoAnterior(fechaInicio, fechaFin);
  
  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24)) + 1;

  console.log(`📅 Período actual: ${fechaInicio} a ${fechaFin} (${diasPeriodo} días)`);

  // ✅ Construir filtros para Lambda
  const filtrosActuales = await construirFiltrosDynamoDB(fechaInicio, fechaFin);

  console.log("Filtros: ", filtrosActuales)

  // Obtener total de consultas actual
  const totalActual = await req.apiClient.obtenerTotalConsultas(filtrosActuales);

  let variacionConsultas = 0;
  let totalConsultasAnterior = 0;
  
  if (periodoAnterior) {
    const filtrosAnteriores = await construirFiltrosDynamoDB(
      periodoAnterior.inicio, 
      periodoAnterior.fin
    );
    
    totalConsultasAnterior = await req.apiClient.obtenerTotalConsultas(filtrosAnteriores);
    variacionConsultas = totalActual - totalConsultasAnterior;
    
    console.log(`📈 Período anterior: ${periodoAnterior.inicio} a ${periodoAnterior.fin}`);
    console.log(`📊 Consultas actuales: ${totalActual}, anteriores: ${totalConsultasAnterior}`);
  }

  // Obtener boxes disponibles
  const todosBoxes = await req.apiClient.obtenerBoxes();
  const boxesFiltrados = boxes.length > 0 
    ? todosBoxes.filter(b => boxes.includes(b.idBox))
    : todosBoxes;
  const totalBoxes = boxesFiltrados.length;

  let ocupacionActual = null;
  let variacionOcupacion = 0;
  
  if (totalBoxes > 0 && totalActual > 0) {
    const capacidad = totalBoxes * diasPeriodo * 12;
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
      periodoAnterior.fin
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
    ocupacion_subtext: req.t('dashboard.kpi.total_capacity', { count: totalBoxes }),

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

    total_boxes_disponibles: totalBoxes,
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
async function calcularGraficos(req, especialidades, boxes, fechaInicio, fechaFin) {
  console.log('📊 Calculando gráficos del dashboard');

  // ✅ Construir filtros
  const filtros = await construirFiltrosDynamoDB(fechaInicio, fechaFin);

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

  // Formatear rendimiento de médicos
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