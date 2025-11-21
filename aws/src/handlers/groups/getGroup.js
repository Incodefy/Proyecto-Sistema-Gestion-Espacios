const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(
  new (require("@aws-sdk/client-dynamodb").DynamoDBClient)()
);

exports.handler = async (event) => {
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const groupId = event.pathParameters?.group_id;

    if (!userSub) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "No autenticado" })
      };
    }

    if (!groupId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "group_id requerido" })
      };
    }

    // Buscar el grupo
    const res = await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: groupId }
    }));

    if (!res.Item) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: "Grupo no encontrado" }) };
    }

    // Validar que el usuario es owner o miembro del grupo
    const isOwner = res.Item.owner_sub === userSub;
    
    // Verificar si es miembro del grupo
    let isMember = false;
    try {
      const memberCheck = await db.send(new GetCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Key: { group_id: groupId, user_sub: userSub }
      }));
      isMember = !!memberCheck.Item;
    } catch (memberErr) {
      console.log("No se pudo verificar membresía:", memberErr);
    }

    if (!isOwner && !isMember) {
      return {
        statusCode: 403,
        body: JSON.stringify({ ok: false, error: "No tienes acceso al grupo" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, group: res.Item })
    };

  } catch (e) {
    console.error("❌ Error getGroup:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "Error interno", details: e.message })
    };
  }
};
