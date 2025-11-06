const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async () => {
    const params = {
        TableName: process.env.DB_CATALOGO,
        FilterExpression: "begins_with(PK, :pk)",
        ExpressionAttributeValues: {
        ":pk": "PASILLO#"
        }
    };

    try {
        const data = await client.send(new ScanCommand(params));
        return {
        statusCode: 200,
        body: JSON.stringify(data.Items)
        };
    } catch (err) {
        console.error(err);
        return {
        statusCode: 500,
        body: JSON.stringify({ error: "Error obteniendo pasillos" })
        };
    }
};
