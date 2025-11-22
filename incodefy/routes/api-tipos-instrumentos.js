// routes/api-tipos-instrumentos.js
const express = require('express');
const router = express.Router();

// GET /api/grupos/:grupo_id/tipos-instrumentos - Listar tipos de instrumentos
router.get('/:grupo_id/tipos-instrumentos', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    
    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/tipos-instrumentos`, {
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
      throw new Error(data.error || 'Error obteniendo tipos de instrumentos');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET /api/grupos/:grupo_id/tipos-instrumentos:', error);
    console.error('Error completo:', error.message, error.stack);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error obteniendo tipos de instrumentos'
    });
  }
});

// POST /api/grupos/:grupo_id/tipos-instrumentos - Crear tipo de instrumento
router.post('/:grupo_id/tipos-instrumentos', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre es requerido'
      });
    }

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/tipos-instrumentos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre: nombre.trim() })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error creando tipo de instrumento');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en POST /api/grupos/:grupo_id/tipos-instrumentos:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error creando tipo de instrumento'
    });
  }
});

// PUT /api/grupos/:grupo_id/tipos-instrumentos/:id - Actualizar tipo de instrumento
router.put('/:grupo_id/tipos-instrumentos/:id', async (req, res) => {
  try {
    const { grupo_id, id } = req.params;
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre es requerido'
      });
    }

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/tipos-instrumentos/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre: nombre.trim() })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error actualizando tipo de instrumento');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /api/grupos/:grupo_id/tipos-instrumentos/:id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error actualizando tipo de instrumento'
    });
  }
});

// DELETE /api/grupos/:grupo_id/tipos-instrumentos/:id - Eliminar tipo de instrumento
router.delete('/:grupo_id/tipos-instrumentos/:id', async (req, res) => {
  try {
    const { grupo_id, id } = req.params;

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/tipos-instrumentos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error eliminando tipo de instrumento');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en DELETE /api/grupos/:grupo_id/tipos-instrumentos/:id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error eliminando tipo de instrumento'
    });
  }
});

module.exports = router;
