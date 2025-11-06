const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async () => {
    const params = {
        TableName: process.env.DB_CATALOGO,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
        ":pk": "ESTADO#2"
        }
    };

    try {
        const data = await docClient.send(new QueryCommand(params));
        return data.Items?.[0]?.idEstado || null;
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error obteniendo estado 'no atendido'" })
        };
    }
};
