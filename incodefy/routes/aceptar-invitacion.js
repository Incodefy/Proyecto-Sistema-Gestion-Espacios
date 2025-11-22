// routes/aceptar-invitacion.js
const express = require('express');
const router = express.Router();
const ApiClient = require('../apiClient');

/**
 * GET /aceptar-invitacion?token=xxx
 * Página pública para aceptar invitación (no requiere autenticación)
 */
router.get('/', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).render('error', {
        error: 'Token de invitación no válido',
        message: 'El enlace de invitación no contiene un token válido.'
      });
    }

    // Crear cliente API sin token para verificación pública
    const apiClient = new ApiClient(null);
    
    // Verificar que la invitación existe y está pendiente
    const invitationData = await apiClient.verificarInvitacion(token);
    
    if (!invitationData.ok) {
      return res.status(404).render('error', {
        error: 'Invitación no válida',
        message: invitationData.error || 'Esta invitación no existe, ya fue aceptada o ha expirado.'
      });
    }

    // Obtener usuario de sesión si existe
    const user = req.session.user || null;

    // Renderizar página de aceptación
    res.render('aceptar-invitacion', {
      token,
      invitation: invitationData.invitation,
      user: user, // Pasar el usuario de la sesión
      currentPath: '/aceptar-invitacion'
    });
    
  } catch (error) {
    console.error('❌ Error cargando invitación:', error);
    res.status(500).render('error', {
      error: 'Error al cargar la invitación',
      message: 'Ocurrió un error al procesar tu invitación. Por favor, intenta nuevamente.'
    });
  }
});

/**
 * POST /aceptar-invitacion
 * Procesar aceptación de invitación
 */
router.post('/', async (req, res) => {
  try {
    console.log('📨 POST /aceptar-invitacion - Body:', req.body);
    const { token } = req.body;
    
    if (!token) {
      console.warn('⚠️ Token no proporcionado');
      return res.status(400).json({
        ok: false,
        error: 'Token de invitación requerido'
      });
    }

    // Verificar si el usuario está autenticado
    const user = req.session.user;
    console.log('👤 Usuario en sesión:', user?.email || 'No autenticado');
    
    if (user && user.idToken) {
      // Usuario autenticado - crear cliente con su token
      const ApiClient = require('../apiClient');
      const apiClient = new ApiClient(user.idToken);
      
      console.log('🔄 Intentando aceptar invitación...');
      const result = await apiClient.aceptarInvitacion(token);
      console.log('📊 Resultado de aceptación:', result);
      
      if (result.ok) {
        // Invalidar cache del grupo activo para que se recargue
        if (req.session) {
          delete req.session.grupoActivo;
          delete req.session.grupoActivoVerificado;
          delete req.session.grupoActivoVerificadoEn;
          console.log('🔄 Cache de grupo activo invalidado');
        }
        
        console.log('✅ Invitación aceptada exitosamente');
        return res.json({
          ok: true,
          message: 'Invitación aceptada exitosamente',
          group_id: result.group_id,
          redirect: '/dashboard'
        });
      } else {
        console.error('❌ Error en resultado:', result.error);
        return res.status(400).json({
          ok: false,
          error: result.error || 'No se pudo aceptar la invitación'
        });
      }
    } else {
      console.warn('⚠️ Usuario no autenticado');
      // Usuario no autenticado - debe registrarse o hacer login primero
      return res.json({
        ok: false,
        requiresAuth: true,
        message: 'Debes iniciar sesión o registrarte para aceptar la invitación',
        redirect: `/login?redirect=${encodeURIComponent('/aceptar-invitacion?token=' + token)}`
      });
    }
    
  } catch (error) {
    console.error('❌ Error aceptando invitación:', error);
    res.status(500).json({
      ok: false,
      error: 'Error al procesar la invitación'
    });
  }
});

module.exports = router;
