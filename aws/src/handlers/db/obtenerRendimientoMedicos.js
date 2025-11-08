const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  console.log('=== INICIO obtenerRendimientoMedicos ===');
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

    const rendimientoMedicos = {};

    allItems.forEach((item) => {
      const medico = item.medicoNombre;
      const especialidad = item.especialidadNombre;

      if (!medico) {
        console.log('⚠️ Item sin medicoNombre:', item);
        return;
      }

      if (!rendimientoMedicos[medico]) {
        rendimientoMedicos[medico] = {
          consultas: 0,
          especialidad: especialidad ?? "No especificada"
        };
      }

      rendimientoMedicos[medico].consultas += 1;
    });

    console.log('📊 Rendimiento de médicos:', rendimientoMedicos);

    const topMedicos = Object.entries(rendimientoMedicos)
      .sort((a, b) => b[1].consultas - a[1].consultas)
      .slice(0, 10)
      .map(([nombre, info]) => ({
        nombre,
        consultas: info.consultas,
        especialidad: info.especialidad
      }));

    console.log('✅ Top 10 médicos:', topMedicos);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(topMedicos)
    };

  } catch (err) {
    console.error("❌ Error obteniendo rendimiento de médicos:", err);
    console.error("Stack trace:", err.stack);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: "Error obteniendo rendimiento de médicos",
        message: err.message
      })
    };
  }
};