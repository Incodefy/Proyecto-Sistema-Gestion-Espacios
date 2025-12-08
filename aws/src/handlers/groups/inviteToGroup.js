const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

const inviteToGroup = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'inviteToGroup' });
  const body = JSON.parse(event.body || "{}");
  const group_id = event.pathParameters?.group_id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('inviteToGroup', { ...body, group_id });
  
  const { email, role } = body;
  
  logger.info('Invitando usuario a grupo', { email: email.toLowerCase(), role, group_id });
  
  const token = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  
  await retryDB(
    () => db.send(new PutCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Item: {
        token,
        group_id,
        invited_email: email.toLowerCase(),
        role,
        status: "PENDING",
        sent_at: new Date().toISOString(),
        expires_at: expiresAt,
        invited_by: userSub
      }
    })),
    { operation: 'createInvitation' }
  );
  
  logger.info('Invitación creada', { token: token.substring(0, 8) + '...' });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      invite_link: `https://app.tu-dominio.com/invite?token=${token}`
    })
  };
};

module.exports.handler = createAPIHandler(inviteToGroup, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });
