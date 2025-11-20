const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const { group_id } = event.pathParameters;
  const { email, role } = JSON.parse(event.body);

  const token = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 días

  await db.send(new PutCommand({
    TableName: process.env.GROUP_INVITATIONS_TABLE,
    Item: {
      token,
      group_id,
      invited_email: email,
      role,
      status: "PENDING",
      sent_at: new Date().toISOString(),
      expires_at: expiresAt
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      invite_link: `https://app.tu-dominio.com/invite?token=${token}`
    })
  };
};
