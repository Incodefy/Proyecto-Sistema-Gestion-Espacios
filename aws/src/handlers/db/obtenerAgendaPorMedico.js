const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const box_id = event.queryStringParameters?.box_id;

    if (!box_id) {
        return {
        statusCode: 400,
        body: JSON.stringify({ error: "Debe enviar ?box_id=*" })
        };
    }

    const params = {
        TableName: process.env.DB_AGENDA,
        IndexName: "MedicoFechaIndex",
        FilterExpression: "begins_with(GSI1PK, :prefix)",
        ExpressionAttributeValues: {
        ":prefix": `MEDICO#${medico_id}`
        }
    };

    try {
        const result = await client.send(new ScanCommand(params));
        return {
        statusCode: 200,
        body: JSON.stringify(result.Items || [])
        };
    } catch (err) {
        console.error("Error Dynamo:", err);
        return {
        statusCode: 500,
        body: JSON.stringify({ error: "Error obteniendo agenda" })
        };
    }
};
