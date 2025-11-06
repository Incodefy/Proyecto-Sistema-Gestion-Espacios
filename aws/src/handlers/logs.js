// src/handlers/logs.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 15000 });

const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const crypto = require('crypto');

/**
 * GET /admin/activity-logs
 * Obtener logs de actividad
 */
module.exports.getActivityLogs = async (event) => {
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userSub) return response(401, { ok: false, error: "Usuario no autenticado" });

    const queryParams = event.queryStringParameters || {};
    const { user_sub: filterUserSub, limit = '50', last_key, action_filter } = queryParams;

    let command;
    let params = {
      TableName: process.env.ACTIVITY_LOGS_TABLE,
      Limit: parseInt(limit),
      ScanIndexForward: false
    };

    if (last_key) params.ExclusiveStartKey = JSON.parse(decodeURIComponent(last_key));

    if (filterUserSub) {
      params.IndexName = 'UserActivityIndex';
      params.KeyConditionExpression = 'user_sub = :userSub';
      params.ExpressionAttributeValues = { ':userSub': filterUserSub };
      if (action_filter) {
        params.FilterExpression = 'contains(#action, :actionFilter)';
        params.ExpressionAttributeNames = { '#action': 'action' };
        params.ExpressionAttributeValues[':actionFilter'] = action_filter;
      }
      command = new QueryCommand(params);
    } else {
      if (action_filter) {
        params.FilterExpression = 'contains(#action, :actionFilter)';
        params.ExpressionAttributeNames = { '#action': 'action' };
        params.ExpressionAttributeValues = { ':actionFilter': action_filter };
      }
      command = new ScanCommand(params);
    }

    const result = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) throw new Error("CircuitBreakerOpen");
        const res = await docClient.send(command);
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const processedLogs = (result.Items || []).map(log => ({
      id: log.id,
      user_email: log.user_email,
      action: log.action,
      timestamp: log.timestamp,
      source: log.source || 'unknown',
      metadata: log.metadata || {},
      formatted_time: new Date(log.timestamp).toLocaleString('es-ES', {
        timeZone: 'America/Santiago'
      })
    }));

    const response_data = {
      ok: true,
      logs: processedLogs,
      count: processedLogs.length,
      has_more: !!result.LastEvaluatedKey,
      filters: { user_sub: filterUserSub, action_filter, limit: parseInt(limit) }
    };

    if (result.LastEvaluatedKey)
      response_data.next_key = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));

    return response(200, response_data);

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Logs] ❌ Error obteniendo logs de actividad:", err);
    return response(500, { ok: false, error: "Error interno del servidor", details: err.message });
  }
};

/**
 * GET /admin/activity-stats
 * Obtener estadísticas de actividad
 */
module.exports.getActivityStats = async (event) => {
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userSub) return response(401, { ok: false, error: "Usuario no autenticado" });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) throw new Error("CircuitBreakerOpen");
        const res = await docClient.send(new ScanCommand({
          TableName: process.env.ACTIVITY_LOGS_TABLE,
          FilterExpression: '#timestamp > :weekAgo',
          ExpressionAttributeNames: { '#timestamp': 'timestamp' },
          ExpressionAttributeValues: { ':weekAgo': weekAgo.toISOString() }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const logs = result.Items || [];
    const stats = {
      total_events: logs.length,
      unique_users: new Set(logs.map(log => log.user_email)).size,
      actions_count: {},
      users_activity: {},
      daily_activity: {}
    };

    logs.forEach(log => {
      stats.actions_count[log.action] = (stats.actions_count[log.action] || 0) + 1;
      stats.users_activity[log.user_email] = (stats.users_activity[log.user_email] || 0) + 1;
      const day = log.timestamp.split('T')[0];
      stats.daily_activity[day] = (stats.daily_activity[day] || 0) + 1;
    });

    stats.top_users = Object.entries(stats.users_activity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([email, count]) => ({ email, activity_count: count }));

    return response(200, { ok: true, period: 'last_7_days', stats });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Logs] ❌ Error obteniendo estadísticas:", err);
    return response(500, { ok: false, error: "Error interno del servidor", details: err.message });
  }
};

/**
 * Función para registrar actividad
 */
module.exports.logActivity = async (activityData) => {
  try {
    // ✅ Validar campos obligatorios
    if (!activityData.userSub || !activityData.action) {
      throw new Error("userSub y action son obligatorios para logActivity");
    }

    // ✅ Generar clave de idempotencia basada en contenido
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        userSub: activityData.userSub,
        action: activityData.action,
        metadata: activityData.metadata,
        timestamp: activityData.timestamp
      }))
      .digest('hex')
      .substring(0, 16);
    
    const idempotencyKey = `logActivity-${activityData.userSub}-${activityData.action}-${contentHash}`;

    // ✅ Verificar si ya fue procesado
    if (await wasAlreadyProcessed(idempotencyKey)) {
      console.log('[Logs] ⏭️ Log ya registrado (idempotente):', {
        action: activityData.action,
        user: activityData.userEmail
      });
      return { skipped: true, reason: 'already_processed' };
    }

    const ttlSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 días

    const logEntry = {
      id: `${activityData.userSub}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_sub: activityData.userSub,
      user_email: activityData.userEmail,
      action: activityData.action,
      metadata: activityData.metadata || {},
      timestamp: activityData.timestamp || new Date().toISOString(),
      ip_address: activityData.ipAddress || 'unknown',
      user_agent: activityData.userAgent || 'unknown',
      source: activityData.source || 'direct_call',
      ttl: ttlSeconds,
      idempotency_key: idempotencyKey  // ✅ Guardar para trazabilidad
    };

    await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) throw new Error("CircuitBreakerOpen");
        await docClient.send(new PutCommand({
          TableName: process.env.ACTIVITY_LOGS_TABLE,
          Item: logEntry
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    // ✅ Marcar como procesado DESPUÉS de escritura exitosa
    await markAsProcessed(idempotencyKey);

    console.log('[Logs] 📊 Actividad registrada:', {
      action: logEntry.action,
      user: logEntry.user_email,
      idempotent: true
    });

    return logEntry;
  } catch (error) {
    dynamoBreaker.reportFailure();
    console.error('[Logs] ❌ Error registrando actividad:', error);
    throw error;
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}
