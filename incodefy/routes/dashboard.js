// routes/dashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // tu conexión a la BD (MySQL, Postgres, etc.)
const checkPermission = require("../middleware/checkPermission");

// --- Helpers ---

// Función para normalizar y crear claves de traducción
const toKey = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD") // Descomponer tildes y caracteres especiales
    .replace(/[\u0300-\u036f]/g, "") // Eliminar tildes
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
    inicio: lunes.toISOString().split("T")[0],
    fin: domingo.toISOString().split("T")[0],
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
      inicio: fechaInicioAnterior.toISOString().split("T")[0],
      fin: fechaFinAnterior.toISOString().split("T")[0]
    };
  } catch (error) {
    return null;
  }
}

// **NUEVA FUNCIÓN: Aplicar filtros base**
function construirFiltrosSQL(especialidades, boxes, fechaInicio, fechaFin) {
  let filtros = "WHERE fecha BETWEEN ? AND ?";
  const params = [fechaInicio, fechaFin];

  if (especialidades && especialidades.length > 0) {
    const placeholders = especialidades.map(() => '?').join(',');
    filtros += ` AND idmedico IN (
      SELECT idmedico FROM medico WHERE idespecialidad IN (${placeholders}))`;
    params.push(...especialidades);
  }

  if (boxes && boxes.length > 0) {
    const placeholders = boxes.map(() => '?').join(',');
    filtros += ` AND idbox IN (${placeholders})`;
    params.push(...boxes);
  }

  return { filtros, params };
}

// ==========================
// 1. Render del dashboard
// ==========================
router.get("/dashboard",checkPermission('dashboard.read'), async (req, res) => {
  res.render("dashboard", { 
    currentPath: req.path,
    personalization: req.session.user?.personalization || {}
  });
});

// ==========================
// 2. Filtros iniciales
// ==========================
router.get("/dashboard/filtros-iniciales", async (req, res) => {
  try {
    // Consultar especialidades con nombres de columnas correctos según los modelos Django
    const [especialidades] = await db.query(
      "SELECT idespecialidad AS id, nombre FROM especialidad"
    );
    // Consultar boxes con nombres de columnas correctos según los modelos Django
    const [boxes] = await db.query("SELECT idbox AS id, nombre FROM box");

    // Formatear datos consistentemente y TRADUCIRLOS
    const especialidadesFormatted = especialidades.map(esp => ({
      id: esp.id,
      nombre: req.t(`specialties.${toKey(esp.nombre)}`, esp.nombre) // Usar t() con fallback al nombre original
    }));

    const boxesFormatted = boxes.map(box => ({
      id: box.id,
      nombre: box.nombre
    }));

    res.json({
      success: true,
      especialidades: especialidadesFormatted,
      boxes: boxesFormatted,
    });
  } catch (err) {
    console.error("Error en filtros-iniciales:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================
// 3. Datos del dashboard
// ==========================
router.post("/dashboard/datos", async (req, res) => {
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

    console.log(`Procesando dashboard con filtros:`, { especialidades, boxes, fecha_inicio, fecha_fin });

    // Pasar req para acceder a la función de traducción t()
    const kpis = await calcularKpis(req, especialidades, boxes, fecha_inicio, fecha_fin);
    const graficos = await calcularGraficos(req, especialidades, boxes, fecha_inicio, fecha_fin);

    res.json({ success: true, kpis, graficos });
  } catch (err) {
    console.error("Error en dashboard/datos:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================
// 4. Función: calcular KPIs (MEJORADA)
// ==========================
async function calcularKpis(req, especialidades, boxes, fechaInicio, fechaFin) {
  // **NUEVO: Calcular período anterior para comparaciones**
  const periodoAnterior = calcularPeriodoAnterior(fechaInicio, fechaFin);
  
  const { filtros, params } = construirFiltrosSQL(especialidades, boxes, fechaInicio, fechaFin);
  
  // Calcular días del período
  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  const diasPeriodo = Math.floor((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24));

  console.log(`Período actual: ${fechaInicio} a ${fechaFin} (${diasPeriodo} días)`);

  // **MEJORADO: Total consultas con comparación**
  const [[totalActual]] = await db.query(
    `SELECT COUNT(*) AS total FROM agenda ${filtros}`,
    params
  );

  let variacionConsultas = 0;
  let totalConsultasAnterior = 0;
  
  if (periodoAnterior) {
    const { filtros: filtrosAnt, params: paramsAnt } = construirFiltrosSQL(
      especialidades, boxes, periodoAnterior.inicio, periodoAnterior.fin
    );
    const [[totalAnt]] = await db.query(
      `SELECT COUNT(*) AS total FROM agenda ${filtrosAnt}`,
      paramsAnt
    );
    totalConsultasAnterior = totalAnt.total;
    variacionConsultas = totalActual.total - totalConsultasAnterior;
    
    console.log(`Período anterior: ${periodoAnterior.inicio} a ${periodoAnterior.fin}`);
    console.log(`Consultas actuales: ${totalActual.total}, anteriores: ${totalConsultasAnterior}`);
  }

  // **MEJORADO: Total boxes con filtro**
  let queryBoxes = "SELECT COUNT(*) AS total_boxes FROM box";
  let paramsBoxes = [];
  
  if (boxes.length > 0) {
    const placeholders = boxes.map(() => '?').join(',');
    queryBoxes += ` WHERE idbox IN (${placeholders})`;
    paramsBoxes = boxes;
  }
  
  const [[{ total_boxes }]] = await db.query(queryBoxes, paramsBoxes);

  // **MEJORADO: Ocupación con comparación**
  let ocupacionActual = null;
  let variacionOcupacion = 0;
  
  if (total_boxes > 0 && totalActual.total > 0) {
    const capacidad = total_boxes * diasPeriodo * 12; // 12h/día
    ocupacionActual = parseFloat(((totalActual.total / capacidad) * 100).toFixed(1));
    
    if (periodoAnterior && totalConsultasAnterior > 0) {
      const ocupacionAnterior = parseFloat(((totalConsultasAnterior / capacidad) * 100).toFixed(1));
      variacionOcupacion = parseFloat((ocupacionActual - ocupacionAnterior).toFixed(1));
    }
  }

  // **NUEVO: Promedio diario de consultas**
  const promedioConsultasDiario = diasPeriodo > 0 ? parseFloat((totalActual.total / diasPeriodo).toFixed(1)) : 0;
  let variacionPromedioDiario = 0;
  
  const promedioAnterior = parseFloat((totalConsultasAnterior / diasPeriodo).toFixed(1));
  variacionPromedioDiario = parseFloat((promedioConsultasDiario - promedioAnterior).toFixed(1));

  // **CORREGIDO: Especialidad más demandada con tendencia - usando tabla 'medico'**
  const [especialidadTopRows] = await db.query(
    `SELECT e.nombre, COUNT(a.idagenda) AS consultas
     FROM agenda a
     JOIN medico m ON a.idmedico = m.idmedico
     JOIN especialidad e ON m.idespecialidad = e.idespecialidad
     ${filtros}
     GROUP BY e.nombre
     ORDER BY consultas DESC
     LIMIT 1`,
    params
  );
  const especialidadTop = especialidadTopRows[0];

  let tendenciaEspecialidad = "igual";
  if (especialidadTop && periodoAnterior) {
    const { filtros: filtrosAnt, params: paramsAnt } = construirFiltrosSQL(
      especialidades, boxes, periodoAnterior.inicio, periodoAnterior.fin
    );
    
    const [especialidadAnt] = await db.query(
      `SELECT COUNT(a.idagenda) AS consultas
       FROM agenda a
       JOIN medico m ON a.idmedico = m.idmedico
       JOIN especialidad e ON m.idespecialidad = e.idespecialidad
       ${filtrosAnt} AND e.nombre = ?
       GROUP BY e.nombre`,
      [...paramsAnt, especialidadTop.nombre]
    );
    
    if (especialidadAnt && especialidadAnt.length > 0) {
      const consultasAnteriores = especialidadAnt[0].consultas;
      if (especialidadTop.consultas > consultasAnteriores) {
        tendenciaEspecialidad = "sube";
      } else if (especialidadTop.consultas < consultasAnteriores) {
        tendenciaEspecialidad = "baja";
      }
    }
  }

  return {
    // **KPI principal**
    total_consultas: totalActual.total,
    variacion_consultas: variacionConsultas,
    consultas_subtext: req.t('dashboard.kpi.days_in_period', { count: diasPeriodo }),

    // **Ocupación**
    ocupacion_actual: ocupacionActual,
    variacion_ocupacion: variacionOcupacion,
    ocupacion_subtext: req.t('dashboard.kpi.total_capacity', { count: total_boxes }),

    // **NUEVO: Promedio diario**
    promedio_consultas_diario: promedioConsultasDiario,
    variacion_promedio_diario: variacionPromedioDiario,
    promedio_subtext: req.t('dashboard.kpi.appointments_per_day'),

    // **Especialidad top mejorada**
    especialidad_mas_demandada: especialidadTop ? req.t(`specialties.${toKey(especialidadTop.nombre)}`, especialidadTop.nombre) : null,
    consultas_especialidad_top: especialidadTop?.consultas || 0,
    tendencia_especialidad: tendenciaEspecialidad,
    especialidad_subtext: especialidadTop ? req.t('dashboard.kpi.appointments_count', { count: especialidadTop.consultas }) : "",

    // **NUEVOS: Información adicional**
    total_boxes_disponibles: total_boxes,
    dias_periodo: diasPeriodo,
    horas_pico: "No disponible", // DateField sin hora

    // **NUEVO: Métricas de comparación**
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
  const { filtros, params } = construirFiltrosSQL(especialidades, boxes, fechaInicio, fechaFin);

  // **CORREGIDO: Consultas por especialidad - usando tabla 'medico'**
  const [espRows] = await db.query(
    `SELECT e.nombre, COUNT(a.idagenda) AS consultas
     FROM agenda a
     JOIN medico m ON a.idmedico = m.idmedico
     JOIN especialidad e ON m.idespecialidad = e.idespecialidad
     ${filtros}
     GROUP BY e.nombre
     ORDER BY consultas DESC`,
    params
  );

  const consultasPorEspecialidad = espRows.length ? {
    labels: espRows.map((e) => req.t(`specialties.${toKey(e.nombre)}`, e.nombre)),
    data: espRows.map((e) => e.consultas),
    total: espRows.reduce((sum, e) => sum + e.consultas, 0) // **NUEVO**
  } : null;

  // **MEJORADO: Consultas por día con información adicional**
  const [diaRows] = await db.query(
    `SELECT DAYOFWEEK(fecha) AS dia_semana, COUNT(*) AS conteo
     FROM agenda a
     ${filtros}
     GROUP BY dia_semana
     ORDER BY dia_semana`,
    params
  );
  
  const dias = [
    req.t('days.monday'), req.t('days.tuesday'), req.t('days.wednesday'), 
    req.t('days.thursday'), req.t('days.friday'), req.t('days.saturday'), req.t('days.sunday')
  ];
  const consultasPorDia = Array(7).fill(0);
  
  diaRows.forEach((row) => {
    const idx = row.dia_semana === 1 ? 6 : row.dia_semana - 2; // Ajustar: Lunes=0
    consultasPorDia[idx] = row.conteo;
  });

  const totalDias = consultasPorDia.reduce((sum, count) => sum + count, 0);
  const diaMasActivo = totalDias > 0 ? dias[consultasPorDia.indexOf(Math.max(...consultasPorDia))] : null;

  // **CORREGIDO: Rendimiento de médicos - usando tabla 'medico'**
  const [medRows] = await db.query(
    `SELECT m.nombre, e.nombre AS especialidad, COUNT(a.idagenda) AS consultas
     FROM agenda a
     JOIN medico m ON a.idmedico = m.idmedico
     JOIN especialidad e ON m.idespecialidad = e.idespecialidad
     ${filtros}
     GROUP BY m.nombre, e.nombre
     ORDER BY consultas DESC
     LIMIT 10`,
    params
  );

  const rendimientoMedicos = medRows.length ? {
    labels: medRows.map((m) => m.nombre),
    data: medRows.map((m) => m.consultas),
    especialidades: medRows.map((m) => req.t(`specialties.${toKey(m.especialidad)}`, m.especialidad)), // **NUEVO Y TRADUCIDO**
    promedio: parseFloat((medRows.reduce((sum, m) => sum + m.consultas, 0) / medRows.length).toFixed(1)) // **NUEVO**
  } : null;

  return {
    consultas_por_especialidad: consultasPorEspecialidad,
    consultas_por_dia: {
      labels: dias,
      data: consultasPorDia,
      total: totalDias, // **NUEVO**
      dia_mas_activo: diaMasActivo // **NUEVO**
    },
    rendimiento_medicos: rendimientoMedicos,
    distribucion_horarios: null, // **NUEVO: Deshabilitado - DateField sin hora**
  };
}

module.exports = router;