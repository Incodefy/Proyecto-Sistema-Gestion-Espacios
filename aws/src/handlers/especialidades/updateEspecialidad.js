// aws/src/handlers/especialidades/updateEspecialidad.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { NotFoundError } = require("../../utils/errorHandler");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const updateEspecialidad = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateEspecialidad' });
  
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const especialidadId = event.pathParameters?.id;
  
  validate('updateEspecialidad', { ...body, grupo_id, especialidadId });
  
  logger.info('Actualizando especialidad', { grupo_id, especialidadId });
  
  // Verificar existencia
  const getResult = await retryDB(
    () => db.send(
      new GetCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        }
      })
    ),
    { operation: 'getEspecialidad' }
  );
  
  if (!getResult.Item) {
    throw new NotFoundError('Especialidad no encontrada');
  }
  
  const now = new Date().toISOString();
  
  await retryDB(
    () => db.send(
      new UpdateCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        },
        UpdateExpression: "SET nombre = :nombre, updated_at = :updated",
        ExpressionAttributeValues: {
          ":nombre": body.nombre.trim(),
          ":updated": now
        }
      })
    ),
    { operation: 'updateEspecialidad' }
  );
  
  logger.info('Especialidad actualizada exitosamente', { especialidadId });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      ok: true,
      especialidad: {
        id: especialidadId,
        nombre: body.nombre.trim(),
        grupo_id,
        updated_at: now
      }
    })
  };
};

module.exports.handler = createAPIHandler(updateEspecialidad, {
  rateLimit: { maxRequests: 40, windowSeconds: 60 }
});

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando especialidad:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar especialidad",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
