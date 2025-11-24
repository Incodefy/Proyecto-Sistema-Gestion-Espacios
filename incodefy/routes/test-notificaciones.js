// routes/test-notificaciones.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');

router.use(requireAuth);
router.use(attachApiClient);

/**
 * Ruta de prueba para debuggear notificaciones
 */
router.get('/test-notificaciones', async (req, res) => {
  try {
    const user = req.session.user;
    const grupoActivo = req.session.grupoActivo;
    const token = req.session.authToken;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST NOTIFICACIONES - DEBUG INFO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('👤 Usuario en sesión:');
    console.log('   Email:', user.email);
    console.log('   User Sub:', user.sub);
    console.log('   Username:', user.username);
    console.log('');
    console.log('🏢 Grupo activo:', grupoActivo);
    console.log('   Grupo ID extraído:', grupoActivo?.grupo_id || grupoActivo);
    console.log('');
    console.log('🔑 Token presente:', !!token);
    console.log('═══════════════════════════════════════════════════════════');

    // Intentar obtener notificaciones sin filtros
    console.log('\n📡 Probando endpoint SIN filtros...');
    const result1 = await req.apiClient.obtenerNotificaciones({});
    console.log('Resultado 1:', JSON.stringify(result1, null, 2));

    // Intentar con filtro de grupo
    console.log('\n📡 Probando endpoint CON grupo activo...');
    const grupoActivoId = grupoActivo?.grupo_id || grupoActivo;
    const result2 = await req.apiClient.obtenerNotificaciones({ 
      grupo_id: grupoActivoId
    });
    console.log('Resultado 2:', JSON.stringify(result2, null, 2));

    // Intentar con límite
    console.log('\n📡 Probando endpoint con limit=100...');
    const result3 = await req.apiClient.obtenerNotificaciones({ 
      limit: 100 
    });
    console.log('Resultado 3:', JSON.stringify(result3, null, 2));

    res.json({
      debug_info: {
        user: {
          email: user.email,
          sub: user.sub,
          username: user.username
        },
        grupo_activo: grupoActivo,
        grupo_activo_id: grupoActivoId,
        token_presente: !!token
      },
      test_results: {
        sin_filtros: result1,
        con_grupo: result2,
        con_limit: result3
      }
    });

  } catch (err) {
    console.error('❌ Error en test:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
