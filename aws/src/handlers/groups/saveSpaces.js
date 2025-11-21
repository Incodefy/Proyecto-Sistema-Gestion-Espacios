const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(
  new (require("@aws-sdk/client-dynamodb").DynamoDBClient)()
);

exports.handler = async (event) => {
  const TRACE = `spaces-${Date.now()}`;
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;

    if (!userSub) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "No autenticado" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const { grupo_id, espacios } = body;

    if (!grupo_id || !espacios?.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Datos incompletos: se requiere grupo_id y espacios" })
      };
    }

    const timestamp = new Date().toISOString();

    // ⭐ Marcar el grupo como configurado
    await db.send(new UpdateCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupo_id },
      UpdateExpression: "SET configured = :cfg, updated_at = :now",
      ExpressionAttributeValues: {
        ":cfg": true,
        ":now": timestamp
      }
    }));

    // ⭐ Generar espacios
    let generalIdx = 0;
    let specificIdx = 0;

    const writes = [];

    for (const espacio of espacios) {
      generalIdx++;
      const generalId = `SPACE#${generalIdx}`;

      writes.push({
        PutRequest: {
          Item: {
            PK: grupo_id,
            SK: generalId,
            tipo: "general",
            nombre: espacio.name,
            created_at: timestamp,
            created_by: userEmail
          }
        }
      });

      for (const spec of espacio.specificSpaces) {
        specificIdx++;
        const specId = `BOX#${specificIdx}`;

        writes.push({
          PutRequest: {
            Item: {
              PK: grupo_id,
              SK: specId,
              tipo: "especifico",
              nombre: spec.name,
              parent: generalId,
              created_at: timestamp,
              created_by: userEmail
            }
          }
        });
      }
    }

    // ⭐ Batch write (25 por lote)
    const chunks = [];
    while (writes.length) chunks.push(writes.splice(0, 25));

    for (const chunk of chunks) {
      await db.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.SPACES_TABLE]: chunk
        }
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        grupo_id,
        total_generales: generalIdx,
        total_especificos: specificIdx,
        trace: TRACE
      })
    };

  } catch (e) {
    console.error(`[ERROR][${TRACE}]`, e);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "Error guardando espacios", details: e.message })
    };
  }
};
