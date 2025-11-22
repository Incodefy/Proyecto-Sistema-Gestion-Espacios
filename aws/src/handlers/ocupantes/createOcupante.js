// aws/src/handlers/ocupantes/createOcupante.js
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /groups/{grupo_id}/ocupantes | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const userEmail = event.requestContext.authorizer.jwt.claims.email;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userEmail || userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!grupo_id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id es requerido",
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

    if (!body.especialidad_id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "La especialidad es requerida",
          trace_id: TRACE_ID
        })
      };
    }

    // Buscar la especialidad para obtener su nombre
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

    const ocupanteId = crypto.randomUUID().substring(0, 8);
    const now = new Date().toISOString();

    const item = {
      PK: grupo_id,
      SK: `OCCUPANT#${ocupanteId}`,
      occupant_id: `OCCUPANT#${ocupanteId}`,
      nombre: body.nombre.trim(),
      especialidad_id: especialidadIdConPrefijo,
      tipo: body.tipo || 'Ocupante', // Nombre de la nomenclatura
      created_at: now,
      updated_at: now,
      created_by: userEmail || userSub
    };

    // Agregar nombre de especialidad si se encontró
    if (especialidadNombre) {
      item.especialidad = especialidadNombre;
    }

    await db.send(
      new PutCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Item: item
      })
    );

    console.log(`[${TRACE_ID}] ✅ Ocupante creado: ${ocupanteId}`);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        ocupante: {
          id: ocupanteId,
          nombre: body.nombre.trim(),
          especialidad_id: body.especialidad_id,
          grupo_id,
          created_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando ocupante:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al crear ocupante",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
