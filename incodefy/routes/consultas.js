const express = require("express");
const router = express.Router();
const { obtenerConsultasEnCurso, actualizarEstadoAgenda } = require("../db");
const checkPermission = require("../middleware/checkPermission");

const ESTADO_REALIZADA_ID = 1;
const ESTADO_PENDIENTE_ID = 2;

function nowLocal() {
  const now = new Date();
  return {
    hoy: now.toISOString().split("T")[0],
    ahora: now.toTimeString().slice(0, 5),
    full: now,
  };
}

router.get("/en-curso", checkPermission('box.write'), (req, res) => {
  res.render("consultas_en_curso", { 
    currentPath: req.path,
    personalization: req.session.user?.personalization || {}
  });
});

// 2. API: obtener consultas en curso
router.get("/consultas/en-curso/api", async (req, res) => {
  try {
    const { ahora, full } = nowLocal();
    
    const hora_actual = ahora; 

    const estadosPermitidos = [ESTADO_PENDIENTE_ID, ESTADO_REALIZADA_ID];

    const consultas = await obtenerConsultasEnCurso(hora_actual, estadosPermitidos);

    const data = consultas.map((a) => {
      const estadoKey = a.estado_id === ESTADO_REALIZADA_ID ? 'confirmed' : 'pending';
      return {
        idagenda: a.idAgenda,
        fecha: a.fecha ? new Date(a.fecha).toISOString().split("T")[0] : null,
        horainicio: a.horaInicio || "",
        horafin: a.horaFin || "",
        box: a.box || "-",
        medico: a.medico || "-",
        tipoconsulta: a.tipoConsulta || "—",
        estado_id: a.estado_id,
        estado: req.t(`common.${estadoKey}`)
      };
    });

    const slot = data.length ? `${data[0].horainicio} – ${data[0].horafin}` : null;

    res.json({
      consultas: data,
      server_now: full.toISOString(),
      slot,
    });
  } catch (err) {
    console.error("Error al cargar consultas:", err);
    res.status(500).json({ error: "Error al cargar consultas" });
  }
});

router.post("/consultas/en-curso/toggle", async (req, res) => {
  try {
    const { idagenda, to_estado } = req.body;

    const id = Number(idagenda);
    const to = Number(to_estado);

    if (!id || ![ESTADO_REALIZADA_ID, ESTADO_PENDIENTE_ID].includes(to)) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    const result = await actualizarEstadoAgenda(id, to);

    if (result.success) {
      res.json({ ok: true, idagenda: id, nuevo_estado_id: to });
    } else {
      return res.status(404).json({ error: result.error || "Agenda no encontrada" });
    }

  } catch (err) {
    console.error("Error al cambiar el estado de la consulta:", err);
    res.status(500).json({ error: "No se pudo actualizar el estado" });
  }
});

module.exports = router;