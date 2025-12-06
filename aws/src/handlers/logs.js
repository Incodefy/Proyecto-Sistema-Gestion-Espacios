// src/handlers/logs.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { retryWithJitter } = require("../utils/retry");
const { createCircuitBreaker } = require("../utils/circuitBreaker");
const Logger = require("../utils/logger");
const { createAPIHandler } = require("../utils/interceptors");
const { successResponse } = require("../utils/response");
const { AuthorizationError } = require("../utils/errors");
const { validate } = require("../utils/validator");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 15000 });
const { wasAlreadyProcessed, markAsProcessed } = require("../utils/idempotency");
const crypto = require('crypto');

async function getActivityLogsHandler(event, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");
  
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
    logs: processedLogs,
    count: processedLogs.length,
    has_more: !!result.LastEvaluatedKey,
    filters: { user_sub: filterUserSub, action_filter, limit: parseInt(limit) }
  };

  if (result.LastEvaluatedKey)
    response_data.next_key = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));

  logger.info('Logs de actividad obtenidos', { count: processedLogs.length });
  return successResponse(response_data);
}

module.exports.getActivityLogs = createAPIHandler(getActivityLogsHandler, { rateLimit: { maxRequests: 50, windowSeconds: 60 } });

async function getActivityStatsHandler(event, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // OPTIMIZADO: Query por usuario específico usando UserActivityIndex
  const result = await retryWithJitter(
    async () => {
      if (!dynamoBreaker.shouldAllow()) throw new Error("CircuitBreakerOpen");
      const res = await docClient.send(new QueryCommand({
        TableName: process.env.ACTIVITY_LOGS_TABLE,
        IndexName: 'UserActivityIndex',
        KeyConditionExpression: 'user_sub = :userSub AND #timestamp > :weekAgo',
        ExpressionAttributeNames: { '#timestamp': 'timestamp' },
        ExpressionAttributeValues: { 
          ':userSub': userSub,
          ':weekAgo': weekAgo.toISOString() 
        }
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

    logger.info("Estadísticas de actividad calculadas", { totalActions: stats.total_actions });

    return successResponse({
      ok: true,
      stats: {
        ...stats,
        period: {
          from: weekAgo.toISOString(),
          to: new Date().toISOString()
        }
      }
    });
}

module.exports.getActivityStats = createAPIHandler(getActivityStatsHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });

module.exports.logActivity = async (activityData) => {
  const logger = Logger.create({ handler: 'logActivity' });
  
  try {
    if (!activityData.userSub || !activityData.action) {
      throw new ValidationError("userSub y action son obligatorios para logActivity");
    }

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

    // ✅ VALIDACIÓN AJV antes de escribir
    const validationResult = validate('logUserActivity', {
      userSub: activityData.userSub,
      userEmail: activityData.userEmail,
      action: activityData.action,
      metadata: activityData.metadata || {},
      timestamp: activityData.timestamp || new Date().toISOString(),
      ipAddress: activityData.ipAddress || 'unknown',
      userAgent: activityData.userAgent || 'unknown',
      source: activityData.source || 'direct_call'
    }, logger);

    if (!validationResult.valid) {
      logger.warn('Validación fallida en logUserActivity', { errors: validationResult.errors });
      throw new Error(`Validation failed: ${validationResult.errors}`);
    }

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

    logger.info('Actividad registrada', {
      action: logEntry.action,
      user: logEntry.user_email,
      idempotent: true
    });

    return logEntry;
  } catch (error) {
    dynamoBreaker.reportFailure();
    logger.error('Error registrando actividad', error);
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
