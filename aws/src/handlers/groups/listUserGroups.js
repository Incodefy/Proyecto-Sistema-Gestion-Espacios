const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(
  new (require("@aws-sdk/client-dynamodb").DynamoDBClient)()
);

exports.handler = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;

    if (!userSub) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "No autenticado", trace_id: TRACE_ID })
      };
    }

    // 1️⃣ Buscar todos los grupos donde pertenece
    const memberQuery = await db.send(
      new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        IndexName: "UserGroupsIndex",
        KeyConditionExpression: "user_sub = :u",
        ExpressionAttributeValues: { ":u": userSub }
      })
    );

    if (!memberQuery.Items || memberQuery.Items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, grupos: [], total: 0, trace_id: TRACE_ID })
      };
    }

    // 2️⃣ Obtener detalles del grupo
    const grupos = [];

    for (const membership of memberQuery.Items) {
      const groupDetails = await db.send(
        new GetCommand({
          TableName: process.env.GROUPS_TABLE,
          Key: { group_id: membership.group_id }
        })
      );

      if (groupDetails.Item) {
        grupos.push({
          grupo_id: groupDetails.Item.group_id,
          nombre: groupDetails.Item.nombre,
          role: membership.role,
          created_at: groupDetails.Item.created_at,
          owner_sub: groupDetails.Item.owner_sub
        });
      }
    }

    // 3️⃣ Ordenar por fecha (nuevo arriba)
    grupos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        grupos,
        total: grupos.length,
        trace_id: TRACE_ID
      })
    };

  } catch (err) {
    console.error(`[${TRACE_ID}] Error listando grupos →`, err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: "Error interno en servidor",
        details: err.message,
        trace_id: TRACE_ID
      })
    };
  }
};
