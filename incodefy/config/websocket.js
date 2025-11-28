// config/websocket.js
// Configuración del WebSocket
// NOTA: Esta URL se obtendrá de los outputs de Serverless después del despliegue

module.exports = {
    // Reemplazar con la URL real después del despliegue
    WS_ENDPOINT: process.env.WS_ENDPOINT || 'wss://TU_WS_ID.execute-api.us-east-2.amazonaws.com/dev'
};
