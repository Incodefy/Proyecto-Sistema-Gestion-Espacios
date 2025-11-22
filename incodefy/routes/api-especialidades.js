// routes/api-especialidades.js
const express = require('express');
const router = express.Router();

// GET /api/grupos/:grupo_id/especialidades - Listar especialidades
router.get('/:grupo_id/especialidades', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    
    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/especialidades`, {
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
      throw new Error(data.error || 'Error obteniendo especialidades');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET /api/grupos/:grupo_id/especialidades:', error);
    console.error('Error completo:', error.message, error.stack);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error obteniendo especialidades'
    });
  }
});

// POST /api/grupos/:grupo_id/especialidades - Crear especialidad
router.post('/:grupo_id/especialidades', async (req, res) => {
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

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/especialidades`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre: nombre.trim() })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error creando especialidad');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en POST /api/grupos/:grupo_id/especialidades:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error creando especialidad'
    });
  }
});

// PUT /api/grupos/:grupo_id/especialidades/:id - Actualizar especialidad
router.put('/:grupo_id/especialidades/:id', async (req, res) => {
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

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/especialidades/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre: nombre.trim() })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error actualizando especialidad');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /api/grupos/:grupo_id/especialidades/:id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error actualizando especialidad'
    });
  }
});

// DELETE /api/grupos/:grupo_id/especialidades/:id - Eliminar especialidad
router.delete('/:grupo_id/especialidades/:id', async (req, res) => {
  try {
    const { grupo_id, id } = req.params;

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/especialidades/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error eliminando especialidad');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en DELETE /api/grupos/:grupo_id/especialidades/:id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error eliminando especialidad'
    });
  }
});

module.exports = router;
