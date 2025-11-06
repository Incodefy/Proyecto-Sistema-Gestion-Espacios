// routes/dashboard.js
const express = require('express');
const router = express.Router();
const { 
  obtenerEspecialidades, obtenerBoxes, obtenerEspecialidadMasDemandada, obtenerBoxesDisponibles, 
  obtenerTotalConsultas, obtenerRendimientoMedicos, obtenerMedicosPorEspecialidades,
  obtenerConsultasPorDia, obtenerConsultasPorEspecialidad
} = require("../db");
const checkPermission = require("../middleware/checkPermission");

// --- Helpers ---

// Función para normalizar y crear claves de traducción
const toKey = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD') // Descomponer tildes y caracteres especiales
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes
    .replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos
};


function obtenerSemanaActual() {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0=domingo, 1=lunes
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

// **NUEVA FUNCIÓN: Calcular período anterior**
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
    return null;
  }
}

// **NUEVA FUNCIÓN: Aplicar filtros base**
async function construirFiltrosDynamoDB(especialidades, boxes, fechaInicio, fechaFin) {
  let filtros = {};
  let expressionAttributeValues = {};

  // Filtro por fecha
  filtros['fecha'] = { 
    ConditionExpression: 'fecha BETWEEN :fechaInicio AND :fechaFin', 
    ExpressionAttributeValues: { ':fechaInicio': fechaInicio, ':fechaFin': fechaFin }
  };
  
  // Filtro por especialidades
  if (especialidades && especialidades.length > 0) {
    const medicoIds = await obtenerMedicosPorEspecialidades(especialidades);
    if (medicoIds.length > 0) {
      filtros['medicos'] = {
        ConditionExpression: 'idmedico IN (:medicoIds)',
        ExpressionAttributeValues: { ':medicoIds': medicoIds }
      };
    }
  }

  // Filtro por boxes
  if (boxes && boxes.length > 0) {
    filtros['boxes'] = {
      ConditionExpression: 'idbox IN (:boxes)',
      ExpressionAttributeValues: { ':boxes': boxes }
    };
  }

  // Crear la expresión completa para DynamoDB
  let finalFilterExpression = Object.values(filtros).map(f => f.ConditionExpression).join(' AND ');

  // Agregar valores de expresiones
  expressionAttributeValues = Object.assign({}, ...Object.values(filtros).map(f => f.ExpressionAttributeValues));

  return { finalFilterExpression, expressionAttributeValues };
}

// ==========================
// 1. Render del dashboard
// ==========================
router.get('/dashboard',checkPermission('dashboard.read'), async (req, res) => {
  res.render('dashboard', { 
    currentPath: req.path,
    personalization: req.session.user?.personalization || {}
  });
});

// ==========================
// 2. Filtros iniciales
// ==========================
router.get('/dashboard/filtros-iniciales', async (req, res) => {
  try {
    // Consultar especialidades desde DynamoDB
    const especialidades = await obtenerEspecialidades();
    // Consultar boxes desde DynamoDB
    const boxes = await obtenerBoxes();

    // Formatear y traducir los datos
    const especialidadesFormatted = especialidades.map(esp => ({
      id: esp.idEspecialidad,
      nombre: req.t(`specialties.${toKey(esp.nombre)}`, esp.nombre) // Traducir usando 't()' con fallback al nombre original
    }));

    const boxesFormatted = boxes.map(box => ({
      id: box.idBox,
      nombre: box.nombre
    }));

    res.json({
      success: true,
      especialidades: especialidadesFormatted,
      boxes: boxesFormatted,
    });
  } catch (err) {
    console.error('Error en filtros-iniciales:', err);
    res.status(500).json({ success: false, error: err.message });
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

    // **MEJORADO: Filtrar y convertir a enteros como en Python**
    especialidades = especialidades.filter(id => id && !isNaN(parseInt(id))).map(id => parseInt(id));
    boxes = boxes.filter(id => id && !isNaN(parseInt(id))).map(id => parseInt(id));

    console.log('Procesando dashboard con filtros:', { especialidades, boxes, fecha_inicio, fecha_fin });

    // Pasar req para acceder a la función de traducción t()
    const kpis = await calcularKpis(req, especialidades, boxes, fecha_inicio, fecha_fin);
    const graficos = await calcularGraficos(req, especialidades, boxes, fecha_inicio, fecha_fin);

    res.json({ success: true, kpis, graficos });
  } catch (err) {
    console.error('Error en dashboard/datos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================
// 4. Función: calcular KPIs (MEJORADA)
// ==========================
async function calcularKpis(req, especialidades, boxes, fechaInicio, fechaFin) {
  const periodoAnterior = calcularPeriodoAnterior(fechaInicio, fechaFin);
  
  const { filtros, params } = construirFiltrosDynamoDB(especialidades, boxes, fechaInicio, fechaFin);
  
  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24));

  console.log(`Período actual: ${fechaInicio} a ${fechaFin} (${diasPeriodo} días)`);

  const totalActual = await obtenerTotalConsultas(filtros);

  let variacionConsultas = 0;
  let totalConsultasAnterior = 0;
  
  if (periodoAnterior) {
    const { filtros: filtrosAnt, params: paramsAnt } = construirFiltrosDynamoDB(
      especialidades, boxes, periodoAnterior.inicio, periodoAnterior.fin
    );
    totalConsultasAnterior = await obtenerTotalConsultas(filtrosAnt);
    variacionConsultas = totalActual - totalConsultasAnterior;
    
    console.log(`Período anterior: ${periodoAnterior.inicio} a ${periodoAnterior.fin}`);
    console.log(`Consultas actuales: ${totalActual}, anteriores: ${totalConsultasAnterior}`);
  }

  const totalBoxes = await obtenerBoxesDisponibles(boxes);

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

  const promedioConsultasDiario = diasPeriodo > 0 ? parseFloat((totalActual / diasPeriodo).toFixed(1)) : 0;
  let variacionPromedioDiario = 0;
  
  const promedioAnterior = parseFloat((totalConsultasAnterior / diasPeriodo).toFixed(1));
  variacionPromedioDiario = parseFloat((promedioConsultasDiario - promedioAnterior).toFixed(1));

  const especialidadTop = await obtenerEspecialidadMasDemandada(filtros);

  let tendenciaEspecialidad = 'igual';
  if (especialidadTop && periodoAnterior) {
    const { filtros: filtrosAnt, params: paramsAnt } = construirFiltrosDynamoDB(
      especialidades, boxes, periodoAnterior.inicio, periodoAnterior.fin
    );
    
    const especialidadAnt = await obtenerEspecialidadMasDemandada(filtrosAnt);
    
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

    especialidad_mas_demandada: especialidadTop ? req.t(`specialties.${toKey(especialidadTop.nombre)}`, especialidadTop.nombre) : null,
    consultas_especialidad_top: especialidadTop?.consultas || 0,
    tendencia_especialidad: tendenciaEspecialidad,
    especialidad_subtext: especialidadTop ? req.t('dashboard.kpi.appointments_count', { count: especialidadTop.consultas }) : '',

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
// 5. Función: calcular Gráficos (MEJORADA)
// ==========================
async function calcularGraficos(req, especialidades, boxes, fechaInicio, fechaFin) {
  const { filtros, params } = construirFiltrosDynamoDB(especialidades, boxes, fechaInicio, fechaFin);

  const consultasPorEspecialidad = await obtenerConsultasPorEspecialidad(filtros);
  const consultasPorEspecialidadFormatted = consultasPorEspecialidad ? {
    labels: consultasPorEspecialidad.map((e) => req.t(`specialties.${toKey(e.nombre)}`, e.nombre)),
    data: consultasPorEspecialidad.map((e) => e.consultas),
    total: consultasPorEspecialidad.reduce((sum, e) => sum + e.consultas, 0)
  } : null;

  const consultasPorDia = await obtenerConsultasPorDia(filtros);
  const dias = [
    req.t('days.monday'), req.t('days.tuesday'), req.t('days.wednesday'), 
    req.t('days.thursday'), req.t('days.friday'), req.t('days.saturday'), req.t('days.sunday')
  ];
  const totalDias = consultasPorDia.reduce((sum, count) => sum + count, 0);
  const diaMasActivo = totalDias > 0 ? dias[consultasPorDia.indexOf(Math.max(...consultasPorDia))] : null;

  const rendimientoMedicos = await obtenerRendimientoMedicos(filtros);
  const rendimientoMedicosFormatted = rendimientoMedicos ? {
    labels: rendimientoMedicos.map((m) => m.nombre),
    data: rendimientoMedicos.map((m) => m.consultas),
    especialidades: rendimientoMedicos.map((m) => req.t(`specialties.${toKey(m.especialidad)}`, m.especialidad)),
    promedio: parseFloat((rendimientoMedicos.reduce((sum, m) => sum + m.consultas, 0) / rendimientoMedicos.length).toFixed(1))
  } : null;

  return {
    consultas_por_especialidad: consultasPorEspecialidadFormatted,
    consultas_por_dia: {
      labels: dias,
      data: consultasPorDia,
      total: totalDias,
      dia_mas_activo: diaMasActivo
    },
    rendimiento_medicos: rendimientoMedicosFormatted,
    distribucion_horarios: null,
  };
}

module.exports = router;