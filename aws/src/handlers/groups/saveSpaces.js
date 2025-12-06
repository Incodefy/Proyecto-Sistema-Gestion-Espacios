const { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { quickBatchPut } = require("../../utils/batchHelper");
const { createAPIHandler } = require("../../middleware/interceptors");

const saveSpaces = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'saveSpaces' });
  const body = JSON.parse(event.body || "{}");
  const userEmail = event.requestContext.authorizer.jwt.claims.email;
  
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
  
  await retryDB(
    () => db.send(new UpdateCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupo_id },
      UpdateExpression: "SET configured = :cfg, updated_at = :now",
      ExpressionAttributeValues: { ":cfg": true, ":now": timestamp }
    })),
    { operation: 'markGroupConfigured' }
  );
  
  let generalIdx = 0;
  let specificIdx = 0;
  const writes = [];
  
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

    // ⭐ Generar ocupantes
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

    // ⭐ Batch write espacios (25 por lote)
    const chunks = [];
    while (writes.length) chunks.push(writes.splice(0, 25));

    for (const chunk of chunks) {
      await db.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.SPACES_TABLE]: chunk
        }
      }));
    }

    console.log(`✅ Espacios guardados: ${generalIdx} generales, ${specificIdx} específicos`);

    // ⭐ Batch write especialidades (25 por lote)
    if (especialidadWrites.length > 0) {
      const especialidadChunks = [];
      while (especialidadWrites.length) especialidadChunks.push(especialidadWrites.splice(0, 25));

      for (const chunk of especialidadChunks) {
        await db.send(new BatchWriteCommand({
          RequestItems: {
            [process.env.ESPECIALIDADES_TABLE]: chunk
          }
        }));
      }
      
      console.log(`✅ Especialidades guardadas: ${especialidadIdx}`);
    }

    // ⭐ Batch write ocupantes (25 por lote)
    if (occupantWrites.length > 0) {
      const occupantChunks = [];
      while (occupantWrites.length) occupantChunks.push(occupantWrites.splice(0, 25));

      for (const chunk of occupantChunks) {
        await db.send(new BatchWriteCommand({
          RequestItems: {
            [process.env.OCCUPANTS_TABLE]: chunk
          }
        }));
      }
      
      console.log(`✅ Ocupantes guardados: ${occupantIdx}`);
    }

    // ⭐ Generar tipos de instrumentos
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

    // ⭐ Batch write tipos de instrumentos (25 por lote)
    if (tipoInstrumentoWrites.length > 0) {
      const tipoChunks = [];
      while (tipoInstrumentoWrites.length) tipoChunks.push(tipoInstrumentoWrites.splice(0, 25));

      for (const chunk of tipoChunks) {
        await db.send(new BatchWriteCommand({
          RequestItems: {
            [process.env.TIPOS_INSTRUMENTOS_TABLE]: chunk
          }
        }));
      }
      
      console.log(`✅ Tipos de instrumentos guardados: ${tipoInstrumentoIdx}`);
    }

    // ⭐ Generar instrumentos
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

    // ⭐ Batch write instrumentos (25 por lote)
    if (instrumentoWrites.length > 0) {
      const instrumentoChunks = [];
      while (instrumentoWrites.length) instrumentoChunks.push(instrumentoWrites.splice(0, 25));

      for (const chunk of instrumentoChunks) {
        await db.send(new BatchWriteCommand({
          RequestItems: {
            [process.env.INSTRUMENTOS_TABLE]: chunk
          }
        }));
      }
      
      console.log(`✅ Instrumentos guardados: ${instrumentoIdx}`);
    }

    return {
      statusCode: 200,
      headers: getSecurityHeaders(),
      body: JSON.stringify({
        ok: true,
        grupo_id,
        total_generales: generalIdx,
        total_especificos: specificIdx,
        total_especialidades: especialidadIdx,
        total_ocupantes: occupantIdx,
        total_tipos_instrumentos: tipoInstrumentoIdx,
        total_instrumentos: instrumentoIdx,
        trace: TRACE
      })
    };

  } catch (e) {
    console.error(`[ERROR][${TRACE}]`, e);
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ ok: false, error: "Error guardando espacios" })
    };
  }
};
