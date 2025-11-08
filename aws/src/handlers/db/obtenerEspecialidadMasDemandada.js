const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  console.log('=== INICIO obtenerEspecialidadMasDemandada ===');
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

    if (allItems.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          nombre: null, 
          consultas: 0
        })
      };
    }

    const especialidadCounts = {};

    allItems.forEach(item => {
      const especialidad = item.especialidadNombre;

      if (!especialidad) return;

      especialidadCounts[especialidad] = (especialidadCounts[especialidad] || 0) + 1;
    });

    console.log('📊 Conteo de especialidades:', especialidadCounts);

    if (Object.keys(especialidadCounts).length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          nombre: null, 
          consultas: 0
        })
      };
    }

    const maxEspecialidad = Object.entries(especialidadCounts)
      .reduce((max, current) => current[1] > max[1] ? current : max);

    const response = {
      nombre: maxEspecialidad[0],
      consultas: maxEspecialidad[1]
    };

    console.log('✅ Especialidad más demandada:', response);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (err) {
    console.error("❌ Error obteniendo especialidad más demandada:", err);
    console.error("Stack trace:", err.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: "Error obteniendo especialidad más demandada",
        message: err.message
      })
    };
  }
};