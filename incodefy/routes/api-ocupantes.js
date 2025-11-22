// routes/api-ocupantes.js
const express = require('express');
const router = express.Router();

// GET /api/grupos/:grupo_id/ocupantes - Listar ocupantes
router.get('/:grupo_id/ocupantes', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    
    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/ocupantes`, {
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
      throw new Error(data.error || 'Error obteniendo ocupantes');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET /api/grupos/:grupo_id/ocupantes:', error);
    console.error('Error completo:', error.message, error.stack);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error obteniendo ocupantes'
    });
  }
});

// POST /api/grupos/:grupo_id/ocupantes - Crear ocupante
router.post('/:grupo_id/ocupantes', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { nombre, especialidad_id } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'El nombre es requerido'
      });
    }

    if (!especialidad_id) {
      return res.status(400).json({
        ok: false,
        error: 'La especialidad es requerida'
      });
    }

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/ocupantes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        nombre: nombre.trim(),
        especialidad_id
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error creando ocupante');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en POST /api/grupos/:grupo_id/ocupantes:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error creando ocupante'
    });
  }
});

// PUT /api/grupos/:grupo_id/ocupantes/:id - Actualizar ocupante
router.put('/:grupo_id/ocupantes/:id', async (req, res) => {
  try {
    const { grupo_id, id } = req.params;
    const { nombre, especialidad_id } = req.body;

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

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/ocupantes/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        nombre: nombre.trim(),
        especialidad_id
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error actualizando ocupante');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /api/grupos/:grupo_id/ocupantes/:id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error actualizando ocupante'
    });
  }
});

// DELETE /api/grupos/:grupo_id/ocupantes/:id - Eliminar ocupante
router.delete('/:grupo_id/ocupantes/:id', async (req, res) => {
  try {
    const { grupo_id, id } = req.params;

    // Validar que el usuario tenga acceso al grupo
    if (req.session.grupoActivo?.grupo_id !== grupo_id) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes acceso a este grupo'
      });
    }

    const response = await fetch(`${process.env.API_BASE_URL}/groups/${grupo_id}/ocupantes/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error eliminando ocupante');
    }

    res.json(data);
  } catch (error) {
    console.error('Error en DELETE /api/grupos/:grupo_id/ocupantes/:id:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Error eliminando ocupante'
    });
  }
});

module.exports = router;
