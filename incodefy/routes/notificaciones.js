// routes/notificaciones.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const checkPermission = require("../middleware/checkPermission");

// Página de historial
router.get("/historial-notificaciones", checkPermission('notificaciones.historial'), (req, res) => {
  res.render("historial_notificaciones", {
    currentPath: req.path,
    personalization: req.session.user?.personalization || {}
  });
});

// API de notificaciones
router.get("/notificaciones-usuario", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT fecha, mensaje, detalle FROM notificacion ORDER BY fecha DESC LIMIT 50"
    );

    const data = rows.map(n => ({
      fecha: n.fecha ? n.fecha.toISOString().slice(0, 19).replace("T", " ") : "",
      mensaje: n.mensaje,
      detalle: n.detalle
    }));

    res.json({ notificaciones: data });
  } catch (err) {
    console.error("Error al cargar notificaciones:", err);
    res.status(500).json({ error: "Error al cargar notificaciones" });
  }
});

module.exports = router;
