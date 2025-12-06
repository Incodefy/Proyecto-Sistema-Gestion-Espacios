const { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { ValidationError, successResponse } = require("../../utils/errorHandler");

const saveSpaces = async (event, context, logger) => {
  const body = event.parsedBody;
  const userEmail = event.userContext.email;
  
  validate('saveSpaces', body);
  
  const { grupo_id, espacios, especialidades = [], ocupantes = [], tipos_instrumentos = [], instrumentos = [] } = body;
  
  logger.info('Guardando configuración completa', {
    grupo_id,
    espacios: espacios.length,
    especialidades: especialidades.length,
    ocupantes: ocupantes.length,
    tipos_instrumentos: tipos_instrumentos.length,
    instrumentos: instrumentos.length
  });
  
  const timestamp = new Date().toISOString();
  
  // Marcar grupo como configurado
  await retryDB(
    () => db.send(new UpdateCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupo_id },
      UpdateExpression: "SET configured = :cfg, updated_at = :now",
      ExpressionAttributeValues: { ":cfg": true, ":now": timestamp }
    })),
    { operation: 'markGroupConfigured' }
  );
  logger.info('Grupo marcado como configurado', { grupo_id });
  
  let generalIdx = 0;
  let specificIdx = 0;
  const writes = [];
  
  // Generar espacios generales y específicos
  for (const espacio of espacios) {
    generalIdx++;
    const generalId = `SPACE#${generalIdx}`;
    
    const generalItem = {
      PK: grupo_id,
      SK: generalId,
      tipo: "general",
      nombre: espacio.name,
      created_at: timestamp,
      created_by: userEmail
    };

    // ✅ VALIDACIÓN AJV para cada Item
    const validationResult = validate('batchSpaceItem', generalItem, logger);
    if (!validationResult.valid) {
      logger.warn('Validación fallida para espacio general', { errors: validationResult.errors, item: generalItem });
      throw new Error(`Validation failed for general space: ${validationResult.errors}`);
    }
    
    writes.push({ PutRequest: { Item: generalItem } });
    
    for (const spec of espacio.specificSpaces) {
      specificIdx++;
      const specId = `SUBSPACE#${specificIdx}`;
      
      const specificItem = {
        PK: grupo_id,
        SK: specId,
        tipo: "especifico",
        nombre: spec.name,
        parent: generalId,
        created_at: timestamp,
        created_by: userEmail
      };

      // ✅ VALIDACIÓN AJV para cada Item
      const specificValidation = validate('batchSpaceItem', specificItem, logger);
      if (!specificValidation.valid) {
        logger.warn('Validación fallida para espacio específico', { errors: specificValidation.errors, item: specificItem });
        throw new Error(`Validation failed for specific space: ${specificValidation.errors}`);
      }

      writes.push({ PutRequest: { Item: specificItem } });
    }
  }
  
  // Batch write espacios (25 por lote)
  const chunks = [];
  const writesCopy = [...writes];
  while (writesCopy.length) chunks.push(writesCopy.splice(0, 25));

  for (const chunk of chunks) {
    await db.send(new BatchWriteCommand({
      RequestItems: {
        [process.env.SPACES_TABLE]: chunk
      }
    }));
  }

  logger.info('Espacios guardados', { 
    generales: generalIdx, 
    especificos: specificIdx 
  });
  
  // Generar especialidades
  let especialidadIdx = 0;
  const especialidadWrites = [];
  
  for (const esp of especialidades) {
    if (!esp.nombre || !esp.nombre.trim()) continue;
    
    especialidadIdx++;
    const especialidadId = `ESP#${especialidadIdx}`;
    
    especialidadWrites.push({
      PutRequest: {
        Item: {
          PK: grupo_id,
          SK: especialidadId,
          especialidad_id: especialidadId,
          nombre: esp.nombre.trim(),
          created_at: timestamp,
          created_by: userEmail
        }
      }
    });
  }

  // Batch write especialidades (25 por lote)
  if (especialidadWrites.length > 0) {
    const especialidadChunks = [];
    const especialidadWritesCopy = [...especialidadWrites];
    while (especialidadWritesCopy.length) especialidadChunks.push(especialidadWritesCopy.splice(0, 25));

    for (const chunk of especialidadChunks) {
      await db.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.ESPECIALIDADES_TABLE]: chunk
        }
      }));
    }
    
    logger.info('Especialidades guardadas', { total: especialidadIdx });
  }

  // Generar ocupantes
  let occupantIdx = 0;
  const occupantWrites = [];

  for (const ocupante of ocupantes) {
    if (!ocupante.nombre || !ocupante.nombre.trim()) continue;
    
    occupantIdx++;
    const occupantId = `OCCUPANT#${occupantIdx}`;

    occupantWrites.push({
      PutRequest: {
        Item: {
          PK: grupo_id,
          SK: occupantId,
          occupant_id: occupantId,
          nombre: ocupante.nombre.trim(),
          tipo: ocupante.tipo || "General",
          email: ocupante.email || null,
          especialidad_id: ocupante.especialidad_id || null,
          especialidad: ocupante.especialidad || null,
          created_at: timestamp,
          created_by: userEmail
        }
      }
    });
  }

  // Batch write ocupantes (25 por lote)
  if (occupantWrites.length > 0) {
    const occupantChunks = [];
    const occupantWritesCopy = [...occupantWrites];
    while (occupantWritesCopy.length) occupantChunks.push(occupantWritesCopy.splice(0, 25));

    for (const chunk of occupantChunks) {
      await db.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.OCCUPANTS_TABLE]: chunk
        }
      }));
    }
    
    logger.info('Ocupantes guardados', { total: occupantIdx });
  }

  // Generar tipos de instrumentos
  let tipoInstrumentoIdx = 0;
  const tipoInstrumentoWrites = [];
  const tipoIdMapping = {}; // Mapeo de IDs temporales del frontend a IDs reales

  for (const tipo of tipos_instrumentos) {
    if (!tipo.nombre || !tipo.nombre.trim()) continue;
    
    tipoInstrumentoIdx++;
    const tipoId = `TIPO_INST#${tipoInstrumentoIdx}`;

    // Guardar mapeo si el frontend envió un ID temporal
    if (tipo.id) {
      tipoIdMapping[tipo.id] = tipoId;
    }

    tipoInstrumentoWrites.push({
      PutRequest: {
        Item: {
          PK: grupo_id,
          SK: tipoId,
          nombre: tipo.nombre.trim(),
          created_at: timestamp,
          created_by: userEmail
        }
      }
    });
  }

  // Batch write tipos de instrumentos (25 por lote)
  if (tipoInstrumentoWrites.length > 0) {
    const tipoChunks = [];
    const tipoInstrumentoWritesCopy = [...tipoInstrumentoWrites];
    while (tipoInstrumentoWritesCopy.length) tipoChunks.push(tipoInstrumentoWritesCopy.splice(0, 25));

    for (const chunk of tipoChunks) {
      await db.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.TIPOS_INSTRUMENTOS_TABLE]: chunk
        }
      }));
    }
    
    logger.info('Tipos de instrumentos guardados', { total: tipoInstrumentoIdx });
  }

  // Generar instrumentos
  let instrumentoIdx = 0;
  const instrumentoWrites = [];

  for (const inst of instrumentos) {
    if (!inst.nombre || !inst.nombre.trim()) continue;
    
    instrumentoIdx++;
    const instrumentoId = `INST#${instrumentoIdx}`;

    // Mapear el tipo_id temporal al ID real
    const tipoIdReal = inst.tipo_id ? tipoIdMapping[inst.tipo_id] : null;

    instrumentoWrites.push({
      PutRequest: {
        Item: {
          PK: grupo_id,
          SK: instrumentoId,
          nombre: inst.nombre.trim(),
          tipo_instrumento_id: tipoIdReal,
          created_at: timestamp,
          created_by: userEmail
        }
      }
    });
  }

  // Batch write instrumentos (25 por lote)
  if (instrumentoWrites.length > 0) {
    const instrumentoChunks = [];
    const instrumentoWritesCopy = [...instrumentoWrites];
    while (instrumentoWritesCopy.length) instrumentoChunks.push(instrumentoWritesCopy.splice(0, 25));

    for (const chunk of instrumentoChunks) {
      await db.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.INSTRUMENTOS_TABLE]: chunk
        }
      }));
    }
    
    logger.info('Instrumentos guardados', { total: instrumentoIdx });
  }

  // Retornar resultado exitoso
  return successResponse({
    ok: true,
    grupo_id,
    total_generales: generalIdx,
    total_especificos: specificIdx,
    total_especialidades: especialidadIdx,
    total_ocupantes: occupantIdx,
    total_tipos_instrumentos: tipoInstrumentoIdx,
    total_instrumentos: instrumentoIdx
  });
};

module.exports.handler = createAPIHandler(saveSpaces, {
  allowAnonymous: false,
  rateLimitConfig: {
    maxRequests: 50,
    windowMs: 60000
  }
});
