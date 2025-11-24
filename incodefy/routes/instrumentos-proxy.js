const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');

router.use(requireAuth);
router.use(attachApiClient);

// Proxy para tipos de instrumentos
router.get('/groups/:grupo_id/tipos-instrumentos', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    
    console.log('🔄 PROXY: GET tipos-instrumentos para grupo:', grupo_id);
    
    const response = await req.apiClient.client.get(`/groups/${grupo_id}/tipos-instrumentos`);
    
    console.log('✅ PROXY: Tipos obtenidos:', response.data);
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ PROXY Error tipos-instrumentos:', error.message);
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Proxy para instrumentos
router.get('/groups/:grupo_id/instrumentos', async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const { espacio_id } = req.query;
    
    console.log('🔄 PROXY: GET instrumentos para grupo:', grupo_id, 'espacio:', espacio_id);
    
    const params = {};
    if (espacio_id) params.espacio_id = espacio_id;
    
    const response = await req.apiClient.client.get(`/groups/${grupo_id}/instrumentos`, { params });
    
    console.log('✅ PROXY: Instrumentos obtenidos:', response.data);
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ PROXY Error instrumentos:', error.message);
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

module.exports = router;
