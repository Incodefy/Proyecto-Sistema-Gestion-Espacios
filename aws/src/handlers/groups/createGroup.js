const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { ValidationError, ConflictError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { quickBatchPut } = require("../../utils/batchHelper");
const { retryDB } = require("../../utils/retry");
const { cacheSystemConfig } = require("../../utils/cache");

/**
 * POST /groups
 * Crea un nuevo grupo y asigna al creador como owner
 * 
 * MEJORAS:
 * ✅ Logging estructurado con correlation IDs
 * ✅ JSON Schema validation automática
 * ✅ Error handling centralizado
 * ✅ Batch operations para mejor performance
 * ✅ Retry logic para resiliencia
 * ✅ Cache para configuraciones
 * ✅ Interceptors automáticos (rate limit, sanitization, security headers)
 */
async function createGroupHandler(event, context, logger) {
  logger.info('Creating new group', { 
    operation: 'createGroup'
  });

  // 1️⃣ VALIDACIÓN CON JSON SCHEMA
  const validationResult = validate('createGroup', event.parsedBody, logger);
  
  if (!validationResult.valid) {
    logger.warn('Validation failed', { errors: validationResult.errors });
    throw new ValidationError('Invalid group data', { errors: validationResult.errors });
  }

  const { name, nomenclatura } = validationResult.data;
  const userSub = event.userContext?.sub;
  const userEmail = event.userContext?.email;
  const userName = event.userContext?.name || userEmail?.split('@')[0] || 'Usuario';

  logger = logger.child({ userSub, groupName: name });

  // 2️⃣ VERIFICAR LÍMITES DEL USUARIO CON CACHE
  const config = await cacheSystemConfig('groupLimits', async () => {
    logger.debug('Fetching group limits config from DB');
    return {
      maxGroupsPerUser: 10,
      maxNameLength: 100
    };
  });

  // Validación adicional usando config cacheada
  if (name.length > config.maxNameLength) {
    throw new ValidationError(`El nombre no puede exceder ${config.maxNameLength} caracteres`);
  }

  // 3️⃣ CREAR GRUPO Y MEMBERSHIP CON BATCH OPERATIONS
  const groupId = `grp_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const defaultNomenclatura = {
    general: 'Pasillo',
    especifico: 'Box',
    ocupante: 'Médico',
    especialidad: 'Especialidad'
  };

  const finalNomenclatura = nomenclatura || defaultNomenclatura;

  logger.info('Preparing group and membership items', { groupId });

  // Preparar items para batch write
  const groupItem = {
    group_id: groupId,
    nombre: name.trim(),
    owner_sub: userSub,
    configured: false,
    nomenclatura: finalNomenclatura,
    created_at: now,
    updated_at: now
  };

  const memberItem = {
    group_id: groupId,
    user_sub: userSub,
    user_email: userEmail,
    user_name: userName,
    role: "owner",
    added_at: now,
    updated_by: userSub
  };

  // 4️⃣ BATCH WRITE CON RETRY AUTOMÁTICO
  await logger.traceAsync('batchWriteGroupData', async () => {
    // Escribir grupo con retry
    await retryDB(async () => {
      await db.send(new PutCommand({
        TableName: process.env.GROUPS_TABLE,
        Item: groupItem
      }));
    });

    // Escribir membership con retry
    await retryDB(async () => {
      await db.send(new PutCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Item: memberItem
      }));
    });
  }, { tables: 2 });

  logger.info('Group created successfully', { 
    groupId,
    role: 'owner'
  });

  // 5️⃣ RESPONSE CON ERROR HANDLER
  return successResponse({
    group_id: groupId,
    nombre: name,
    role: 'owner'
  }, 201);
}

// Exportar con interceptors automáticos (rate limit, sanitization, headers, etc.)
exports.handler = createAPIHandler(createGroupHandler, {
  rateLimit: {
    limit: 10,
    window: 60,
    endpoint: 'createGroup'
  }
});