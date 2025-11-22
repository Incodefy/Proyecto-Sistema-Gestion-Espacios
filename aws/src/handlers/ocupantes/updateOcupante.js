// aws/src/handlers/ocupantes/updateOcupante.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /groups/{grupo_id}/ocupantes/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const ocupanteId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const userEmail = event.requestContext.authorizer.jwt.claims.email;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userEmail || userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Ocupante ID:`, ocupanteId);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!grupo_id || !ocupanteId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id y ocupante id son requeridos",
          trace_id: TRACE_ID
        })
      };
    }

    if (!body.nombre || !body.nombre.trim()) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre del ocupante es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que el ocupante existe
    const getResult = await db.send(
      new GetCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        }
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Ocupante no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    const now = new Date().toISOString();
    
    // Preparar la expresión de actualización
    let updateExpression = "SET nombre = :nombre, updated_at = :updated";
    let expressionValues = {
      ":nombre": body.nombre.trim(),
      ":updated": now
    };

    // Actualizar tipo si se proporciona
    if (body.tipo) {
      updateExpression += ", tipo = :tipo";
      expressionValues[":tipo"] = body.tipo;
    }

    // Solo actualizar especialidad si se proporciona
    if (body.especialidad_id) {
      // Buscar el nombre de la especialidad
      let especialidadNombre = null;
      const especialidadIdConPrefijo = body.especialidad_id.startsWith('ESP#') 
        ? body.especialidad_id 
        : `ESP#${body.especialidad_id}`;
      
      try {
        const especialidadResult = await db.send(
          new GetCommand({
            TableName: process.env.ESPECIALIDADES_TABLE,
            Key: {
              PK: grupo_id,
              SK: especialidadIdConPrefijo
            }
          })
        );
        
        if (especialidadResult.Item) {
          especialidadNombre = especialidadResult.Item.nombre;
        }
      } catch (err) {
        console.warn(`[${TRACE_ID}] No se pudo obtener el nombre de la especialidad:`, err.message);
      }

      updateExpression += ", especialidad_id = :especialidad";
      expressionValues[":especialidad"] = especialidadIdConPrefijo;

      // Agregar nombre de especialidad si se encontró
      if (especialidadNombre) {
        updateExpression += ", especialidad = :especialidadNombre";
        expressionValues[":especialidadNombre"] = especialidadNombre;
      }
    }

    await db.send(
      new UpdateCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues
      })
    );

    console.log(`[${TRACE_ID}] ✅ Ocupante actualizado: ${ocupanteId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        ocupante: {
          id: ocupanteId,
          nombre: body.nombre.trim(),
          especialidad_id: body.especialidad_id || getResult.Item.especialidad_id,
          grupo_id,
          updated_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando ocupante:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar ocupante",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
