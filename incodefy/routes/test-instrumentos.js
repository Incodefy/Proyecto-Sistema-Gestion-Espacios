const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');

router.use(requireAuth);
router.use(attachApiClient);

router.get('/test-instrumentos', async (req, res) => {
  try {
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    if (!grupoId) {
      return res.status(400).json({ error: 'No hay grupo activo' });
    }

    console.log('🧪 TEST: Obteniendo datos de instrumentos...');
    console.log('📦 Grupo ID:', grupoId);

    // Probar endpoint de tipos
    let tiposResponse, tiposData;
    try {
      tiposResponse = await req.apiClient.client.get(`/groups/${grupoId}/tipos-instrumentos`);
      tiposData = tiposResponse.data;
      console.log('✅ Tipos response:', JSON.stringify(tiposData, null, 2));
    } catch (error) {
      console.error('❌ Error tipos:', error.message);
      tiposData = { error: error.message, status: error.response?.status };
    }

    // Probar endpoint de instrumentos
    let instrumentosResponse, instrumentosData;
    try {
      instrumentosResponse = await req.apiClient.client.get(`/groups/${grupoId}/instrumentos`);
      instrumentosData = instrumentosResponse.data;
      console.log('✅ Instrumentos response:', JSON.stringify(instrumentosData, null, 2));
    } catch (error) {
      console.error('❌ Error instrumentos:', error.message);
      instrumentosData = { error: error.message, status: error.response?.status };
    }

    // Retornar todo como HTML legible
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Instrumentos</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
          h1 { color: #4ec9b0; }
          h2 { color: #dcdcaa; margin-top: 30px; }
          pre { background: #252526; padding: 15px; border-radius: 5px; overflow-x: auto; }
          .success { color: #4ec9b0; }
          .error { color: #f48771; }
        </style>
      </head>
      <body>
        <h1>🧪 Test Instrumentos</h1>
        <p><strong>Grupo ID:</strong> ${grupoId}</p>
        
        <h2>📋 Tipos de Instrumentos</h2>
        <pre>${JSON.stringify(tiposData, null, 2)}</pre>
        
        <h2>🔧 Instrumentos</h2>
        <pre>${JSON.stringify(instrumentosData, null, 2)}</pre>
        
        <h2>📊 Resumen</h2>
        <pre>
Tipos cargados: ${tiposData?.tipos?.length || 0}
Instrumentos cargados: ${instrumentosData?.instrumentos?.length || 0}

Estructura esperada en JavaScript:
- tiposData.tipos[] -> Array de tipos
- instrumentosData.instrumentos[] -> Array de instrumentos
        </pre>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('❌ Error general en test:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
