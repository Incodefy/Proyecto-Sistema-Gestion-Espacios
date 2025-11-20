const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const { token } = JSON.parse(event.body);

  const invite = await db.send(new GetCommand({
    TableName: process.env.GROUP_INVITATIONS_TABLE,
    Key: { token }
  }));

  if (!invite.Item) return { statusCode: 404, body: JSON.stringify({ ok: false, error: "Invalid token" }) };

  const userSub = event?.requestContext?.authorizer?.jwt?.claims?.sub;

  await db.send(new PutCommand({
    TableName: process.env.GROUP_MEMBERS_TABLE,
    Item: {
      group_id: invite.Item.group_id,
      user_sub: userSub,
      role: invite.Item.role,
      joined_at: new Date().toISOString()
    }
  }));

  await db.send(new UpdateCommand({
    TableName: process.env.GROUP_INVITATIONS_TABLE,
    Key: { token },
    UpdateExpression: "SET status = :accepted",
    ExpressionAttributeValues: { ":accepted": "ACCEPTED" }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, group_id: invite.Item.group_id })
  };
};
