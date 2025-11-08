const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  console.log('=== INICIO obtenerConsultasPorDia ===');
  console.log('Event completo:', JSON.stringify(event, null, 2));

  let filtros = null;

  if (event.body) {
    try {
      filtros = JSON.parse(event.body);
      console.log('Filtros recibidos:', JSON.stringify(filtros, null, 2));
    } catch (err) {
      console.error('Error parseando body:', err);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Body inválido. Debe ser JSON." })
      };
    }
  }

  const tableName = process.env.DB_AGENDA;
  
  if (!tableName) {
    console.error('ERROR: DB_AGENDA no está definido');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Configuración de tabla no encontrada" })
    };
  }

  const params = {
    TableName: tableName
  };

  // Solo filtro de fecha
  if (filtros?.fechaInicio && filtros?.fechaFin) {
    params.FilterExpression = '#fecha BETWEEN :fechaInicio AND :fechaFin';
    params.ExpressionAttributeValues = {
      ':fechaInicio': filtros.fechaInicio,
      ':fechaFin': filtros.fechaFin
    };
    params.ExpressionAttributeNames = {
      '#fecha': 'fecha'
    };
    
    console.log('✅ Filtro de fecha aplicado:', {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin
    });
  } else {
    console.log('⚠️ Sin filtros - obteniendo todos los registros');
  }

  console.log('Parámetros de Scan:', JSON.stringify(params, null, 2));

  try {
    let allItems = [];
    let lastEvaluatedKey = null;
    let scanCount = 0;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      console.log(`Ejecutando scan #${++scanCount}...`);
      const data = await client.send(new ScanCommand(params));
      
      console.log(`Scan #${scanCount} completado:`, {
        itemsEncontrados: data.Items?.length || 0,
        scannedCount: data.ScannedCount
      });

      allItems = allItems.concat(data.Items || []);
      lastEvaluatedKey = data.LastEvaluatedKey;

    } while (lastEvaluatedKey);

    console.log('✅ Total de items encontrados:', allItems.length);

    // Inicializar array de 7 días (Domingo=0, Lunes=1, ..., Sábado=6)
    const consultasPorDia = Array(7).fill(0);

    allItems.forEach(item => {
      if (!item.fecha) {
        console.log('⚠️ Item sin fecha:', item);
        return;
      }

      const dia = new Date(item.fecha).getDay();
      if (!isNaN(dia)) {
        consultasPorDia[dia] += 1;
      }
    });

    console.log('📊 Consultas por día:', consultasPorDia);
    console.log('📊 Desglose: Dom:', consultasPorDia[0], 'Lun:', consultasPorDia[1], 
                'Mar:', consultasPorDia[2], 'Mié:', consultasPorDia[3], 
                'Jue:', consultasPorDia[4], 'Vie:', consultasPorDia[5], 
                'Sáb:', consultasPorDia[6]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(consultasPorDia)
    };

  } catch (err) {
    console.error("❌ Error obteniendo consultas por día:", err);
    console.error("Stack trace:", err.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: "Error obteniendo consultas por día",
        message: err.message
      })
    };
  }
};