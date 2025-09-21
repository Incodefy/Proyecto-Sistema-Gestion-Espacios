// routes/api.js
const express = require("express");
const router = express.Router();
const fetch = require('node-fetch');
const { refreshUserPersonalization } = require('./auth');

// Middleware para verificar autenticación en API
const requireAuthAPI = (req, res, next) => {
  if (!req.session.user || !req.session.user.idToken) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  next();
};

// POST /api/personalization - Actualizar personalización del usuario
router.post('/personalization', requireAuthAPI, async (req, res) => {
  try {
    console.log("📝 Actualizando personalización:", req.body);

    const response = await fetch(
      'https://0llhfn3ycj.execute-api.us-east-1.amazonaws.com/personalization',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.session.user.idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
      }
    );

    const data = await response.json();
    
    if (response.ok) {
      // Actualizar la personalización en la sesión
      const refreshSuccess = await refreshUserPersonalization(req);
      
      if (refreshSuccess) {
        console.log("✅ Personalización actualizada en sesión");
      }

      res.json({
        ...data,
        session_updated: refreshSuccess
      });
    } else {
      console.error("❌ Error del API de personalización:", data);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error("❌ Error actualizando personalización:", error);
    res.status(500).json({ 
      ok: false, 
      error: "Error interno del servidor",
      details: error.message 
    });
  }
});

// GET /api/personalization - Obtener personalización actual
router.get('/personalization', requireAuthAPI, async (req, res) => {
  try {
    const response = await fetch(
      'https://0llhfn3ycj.execute-api.us-east-1.amazonaws.com/personalization',
      {
        headers: {
          'Authorization': `Bearer ${req.session.user.idToken}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      const errorData = await response.json();
      res.status(response.status).json(errorData);
    }
  } catch (error) {
    console.error("❌ Error obteniendo personalización:", error);
    res.status(500).json({ 
      ok: false, 
      error: "Error interno del servidor" 
    });
  }
});

module.exports = router;