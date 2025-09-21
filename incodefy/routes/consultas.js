const express = require("express");
const router = express.Router();
const db = require("../db");
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

    const sql = `
      SELECT 
        a.idAgenda     AS idagenda,
        a.fecha        AS fecha,
        TIME_FORMAT(a.horaInicio, '%H:%i') AS horainicio,
        TIME_FORMAT(a.horaFin, '%H:%i')    AS horafin,
        b.nombre       AS box,
        m.nombre       AS medico,
        a.tipoConsulta AS tipoconsulta,
        a.idEstado     AS estado_id,
        es.nombre      AS estado
      FROM agenda a
      LEFT JOIN box b ON a.idBox = b.idBox
      LEFT JOIN medico m ON a.idMedico = m.idMedico
      LEFT JOIN estado es ON a.idEstado = es.idEstado
      WHERE a.fecha = CURDATE()
        AND a.idEstado IN (?, ?)
        AND a.horaInicio <= ?
        AND a.horaFin > ?
      ORDER BY a.horaInicio, b.nombre, m.nombre
    `;

    const [results] = await db.query(sql, [
      ESTADO_PENDIENTE_ID,
      ESTADO_REALIZADA_ID,
      ahora,
      ahora,
    ]);

    const data = results.map((a) => ({
      idagenda: a.idagenda,
      fecha: a.fecha
        ? new Date(a.fecha).toISOString().split("T")[0]
        : null,
      horainicio: a.horainicio || "",
      horafin: a.horafin || "",
      box: a.box || "-",
      medico: a.medico || "-",
      tipoconsulta: a.tipoconsulta || "—",
      estado_id: a.estado_id,
      estado:
        a.estado ||
        (a.estado_id === ESTADO_REALIZADA_ID
          ? "Confirmada"
          : "Pendiente"),
    }));

    const slot = data.length
      ? `${data[0].horainicio} – ${data[0].horafin}`
      : null;

    res.json({
      consultas: data,
      server_now: full.toISOString(),
      slot,
    });
  } catch (err) {
    console.error("Error SQL:", err);
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

    const sql = "UPDATE agenda SET idEstado = ? WHERE idAgenda = ?";
    const [result] = await db.query(sql, [to, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Agenda no encontrada" });
    }

    res.json({ ok: true, idagenda: id, nuevo_estado_id: to });
  } catch (err) {
    console.error("Error SQL:", err);
    res.status(500).json({ error: "No se pudo actualizar" });
  }
});

module.exports = router;