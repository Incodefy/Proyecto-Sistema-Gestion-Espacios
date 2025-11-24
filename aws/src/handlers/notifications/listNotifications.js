const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE;

/**
 * GET /notifications
 * Lista las notificaciones de un usuario
 * 
 * Query params:
 * - limit: número máximo de notificaciones (default: 50, max: 100)
 * - grupo_id: filtrar por grupo específico (opcional)
 * - solo_no_leidas: true/false (default: false)
 */
module.exports.handler = async (event) => {
  const TRACE_ID = event.headers?.['x-trace-id'] || `lambda-${Date.now()}`;
  
  try {
    console.log(`[${TRACE_ID}] 📬 Listando notificaciones...`);

    // Obtener userSub del JWT
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userSub) {
      console.warn(`[${TRACE_ID}] ⚠️ No se encontró userSub en JWT`);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "No autenticado",
          trace_id: TRACE_ID
        })
      };
    }

    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
    const grupoId = queryParams.grupo_id;
    const soloNoLeidas = queryParams.solo_no_leidas === 'true';

    console.log(`[${TRACE_ID}] 👤 Usuario: ${userSub}`);
    console.log(`[${TRACE_ID}] 📊 Filtros: limit=${limit}, grupo=${grupoId || 'todos'}, no_leidas=${soloNoLeidas}`);

    let params;
    
    if (grupoId) {
      // Buscar por grupo usando GSI1
      params = {
        TableName: NOTIFICATIONS_TABLE,
        IndexName: 'GroupIndex',
        KeyConditionExpression: 'GSI1PK = :grupo',
        ExpressionAttributeValues: {
          ':grupo': `GROUP#${grupoId}`
        },
        ScanIndexForward: false, // Ordenar de más reciente a más antiguo
        Limit: limit
      };

      // Filtrar SOLO por usuario (el grupo ya está en la KeyCondition)
      // Las notificaciones en este grupo son para todos los miembros, 
      // pero solo queremos las del usuario actual
      const filterParts = [`PK = :user`];
      params.ExpressionAttributeValues[':user'] = `USER#${userSub}`;
      
      if (soloNoLeidas) {
        filterParts.push('leida = :leida');
        params.ExpressionAttributeValues[':leida'] = false;
      }
      
      params.FilterExpression = filterParts.join(' AND ');
      
      console.log(`[${TRACE_ID}] 🔍 Query params (con grupo):`, JSON.stringify(params, null, 2));
    } else {
      // Buscar todas las notificaciones del usuario
      params = {
        TableName: NOTIFICATIONS_TABLE,
        KeyConditionExpression: 'PK = :user',
        ExpressionAttributeValues: {
          ':user': `USER#${userSub}`
        },
        ScanIndexForward: false,
        Limit: limit
      };

      if (soloNoLeidas) {
        params.FilterExpression = 'leida = :leida';
        params.ExpressionAttributeValues[':leida'] = false;
      }
      
      console.log(`[${TRACE_ID}] 🔍 Query params (sin grupo):`, JSON.stringify(params, null, 2));
    }

    const result = await db.send(new QueryCommand(params));
    
    console.log(`[${TRACE_ID}] 📊 Items obtenidos de DynamoDB: ${result.Items?.length || 0}`);
    
    const notifications = (result.Items || []).map(item => ({
      id: item.notification_id,
      tipo: item.tipo,
      categoria: item.categoria,
      titulo: item.titulo,
      mensaje: item.mensaje,
      leida: item.leida,
      prioridad: item.prioridad,
      accion_requerida: item.accion_requerida,
      grupo_id: item.grupo_id,
      entidad_afectada: item.entidad_afectada,
      detalles: item.detalles,
      created_at: item.created_at,
      created_by: item.created_by
    }));

    console.log(`[${TRACE_ID}] ✅ ${notifications.length} notificaciones encontradas`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        notifications,
        count: notifications.length,
        has_more: !!result.LastEvaluatedKey,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error:`, error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Error al obtener notificaciones",
        trace_id: TRACE_ID
      })
    };
  }
};
