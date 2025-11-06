const express = require("express");
const router = express.Router();
const { obtenerInstrumentosPorBox, obtenerBoxYPasillo, obtenerAgendaPorBoxYFecha } = require("../db");
const checkPermission = require("../middleware/checkPermission");

function formatFechaLarga(fechaStr) {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const [y, m, d] = fechaStr.split("-");
  return `${parseInt(d, 10)} de ${meses[parseInt(m, 10) - 1]} de ${y}`;
}

router.get("/box/:id", checkPermission('box.detalle.read'), async (req, res) => {
  try {
    const boxId = req.params.id;

    const box = await obtenerBoxYPasillo(boxId);
    if (!box) {
      return res.status(404).send("Box no encontrado");
    }

    const instrumentos = await obtenerInstrumentosPorBox(boxId);

    const userPermissions = req.session.user?.permissions || [];

    res.render("detalle_box", {
      currentPath: req.path,
      canEdit: userPermissions.includes('box.detalle.write') || userPermissions.includes('admin.users'),
      personalization: req.session.user?.personalization || {},
      nombre: box.nombre,
      idpasillo: box.idPasillo,
      pasillo_nombre: box.pasilloNombre,
      box_id: box.idBox,
      estado:
        box.estado === 0
          ? "Inhabilitado"
          : box.estado === 1
          ? "Habilitado"
          : "Desconocido",
      instrumentos: instrumentos,
    });
  } catch (err) {
    console.error("Error cargando detalle del box:", err);
    res.status(500).send("Error cargando detalle del box");
  }
});

router.get("/api/box-info", async (req, res) => {
  try {
    const { box_id, fecha } = req.query;
    if (!box_id || !fecha) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    const agendas = await obtenerAgendaPorBoxYFecha(box_id, fecha);

    const horas_disponibles = [
      "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
      "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
      "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
      "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
    ];

    const tabla_horaria = {};
    horas_disponibles.forEach(h => (tabla_horaria[h] = ""));

    agendas.forEach(a => {
      if (a.horaInicio) {
        const inicio = a.horaInicio.slice(0, 5);
        const fin = a.horaFin ? a.horaFin.slice(0, 5) : "";
        const bloque = `${inicio} - ${fin}`;
        if (tabla_horaria[bloque] !== undefined) {
          tabla_horaria[bloque] = {
            medico: a.medico || "",
            especialidad: a.especialidad || "",
            estado: a.estado || "",
            tipo_consulta: a.tipoConsulta || "",
          };
        }
      }
    });

    const total_consultas = agendas.length;
    const consultas_no_realizadas = agendas.filter(
      (a) => a.estado === "No atendido"
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
    console.error("Error en /api/box-info:", err);
    res.status(500).json({ error: "Error al cargar información del box" });
  }
});

module.exports = router;
