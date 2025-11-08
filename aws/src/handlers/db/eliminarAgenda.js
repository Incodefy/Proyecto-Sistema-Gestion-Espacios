const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    console.log('=== INICIO eliminarAgenda ===');
    console.log('Event:', JSON.stringify(event, null, 2));

    const tableName = process.env.DB_AGENDA;
    
    // Obtener agendaId de query parameters
    const agendaId = event.queryStringParameters?.agendaId;
    
    if (!agendaId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                error: "agendaId es requerido" 
            })
        };
    }

    try {
        const getParams = {
            TableName: tableName,
            Key: {
                PK: agendaId,
                SK: agendaId
            }
        };

        const agenda = await client.send(new GetCommand(getParams));
        
        if (!agenda.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ 
                    error: "Agenda no encontrada" 
                })
            };
        }

        const deleteParams = {
            TableName: tableName,
            Key: {
                PK: agenda.Item.PK,
                SK: agenda.Item.SK
            }
        };

        await client.send(new DeleteCommand(deleteParams));
        
        console.log('✅ Agenda eliminada exitosamente');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: true,
                message: "Agenda eliminada correctamente" 
            })
        };
    } catch (err) {
        console.error('❌ ERROR eliminando agenda:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "Error eliminando agenda",
                message: err.message
            })
        };
    }
};