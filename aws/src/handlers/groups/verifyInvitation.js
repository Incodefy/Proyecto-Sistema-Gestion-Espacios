// src/handlers/groups/verifyInvitation.js
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError, ValidationError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const verifyInvitation = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'verifyInvitation' });
  const token = event.queryStringParameters?.token;
  
  validate('verifyInvitation', { token });
  
  logger.info('Verificando invitación', { token: token.substring(0, 8) + '...' });
  
  const result = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Key: { token }
    })),
    { operation: 'getInvitation' }
  );
  
  if (!result.Item) throw new NotFoundError('Invitación no encontrada o ha expirado');
  
  const invitation = result.Item;
  
  if (invitation.status !== 'pending') {
    throw new ValidationError(
      invitation.status === 'ACCEPTED' 
        ? 'Esta invitación ya fue aceptada' 
        : 'Esta invitación no está disponible'
    );
  }
  
  const groupResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: invitation.group_id }
    })),
    { operation: 'getGroup' }
  );
  
  logger.info('Invitación válida');
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      ok: true,
      invitation: {
        email: invitation.invited_email,
        role: invitation.role,
        group_id: invitation.group_id,
        group_name: groupResult.Item?.name || 'sin nombre',
        invited_by: invitation.invited_by,
        sent_at: invitation.sent_at
      }
    })
  };
};

module.exports.handler = createAPIHandler(verifyInvitation, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });
