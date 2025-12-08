// config/websocket.js
// Configuración del WebSocket
// NOTA: Esta URL se obtendrá de los outputs de Serverless después del despliegue

module.exports = {
    // Reemplazar con la URL real después del despliegue
    WS_ENDPOINT: process.env.WS_ENDPOINT || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev'
};
