const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const boxId = event.queryStringParameters?.boxId;

    if (!boxId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "boxId es requerido" })
        };
    }

    const params = {
        TableName: process.env.DB_BOX_INSTRUMENTO,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
            ":pk": `BOX#${boxId}`
        }
    };

    try {
        const result = await client.send(new QueryCommand(params));
        return {
            statusCode: 200,
            body: JSON.stringify(result.Items || [])
        };
    } catch (err) {
        console.error("Error Dynamo:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error obteniendo instrumentos por box" })
        };
    }
};