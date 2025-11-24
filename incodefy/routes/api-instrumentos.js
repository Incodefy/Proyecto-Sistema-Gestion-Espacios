// routes/api-instrumentos.js
const express = require('express');
const router = express.Router();

// GET /api/grupos/:grupo_id/instrumentos - Listar instrumentos
router.get('/:grupo_id/instrumentos', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    
    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/instrumentos`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Error obteniendo instrumentos');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET /api/grupos/:grupo_id/instrumentos:', error);
    console.error('Error completo:', error.message, error.stack);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error obteniendo instrumentos'
    });
  }
});

// POST /api/grupos/:grupo_id/instrumentos - Crear instrumento
router.post('/:grupo_id/instrumentos', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { nombre, tipo_instrumento_id } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre del instrumento es requerido'
      });
    }

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/instrumentos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        nombre: nombre.trim(),
        tipo_instrumento_id
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error creando instrumento');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en POST /api/grupos/:grupo_id/instrumentos:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error creando instrumento'
    });
  }
});

// PUT /api/grupos/:grupo_id/instrumentos/:instrumento_id - Actualizar instrumento
router.put('/:grupo_id/instrumentos/:instrumento_id', async (req, res) => {
  try {
    const { grupo_id, instrumento_id } = req.params;
    const { nombre, tipo_instrumento_id } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre del instrumento es requerido'
      });
    }

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/instrumentos/${instrumento_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        nombre: nombre.trim(),
        tipo_instrumento_id
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error actualizando instrumento');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /api/grupos/:grupo_id/instrumentos/:instrumento_id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error actualizando instrumento'
    });
  }
});

// DELETE /api/grupos/:grupo_id/instrumentos/:instrumento_id - Eliminar instrumento
router.delete('/:grupo_id/instrumentos/:instrumento_id', async (req, res) => {
  try {
    const { grupo_id, instrumento_id } = req.params;

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/instrumentos/${instrumento_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error eliminando instrumento');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en DELETE /api/grupos/:grupo_id/instrumentos/:instrumento_id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error eliminando instrumento'
    });
  }
});

module.exports = router;
