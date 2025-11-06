const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

require('dotenv').config();

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  }
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Función para obtener pasillos
async function obtenerPasillos() {
  const response = await axios.get(
    `${process.env.API_URL}/db/pasillos`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener boxes
async function obtenerBoxes() {
  const response = await axios.get(
    `${process.env.API_URL}/db/boxes`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener agendas por fecha
async function obtenerAgendaPorFecha(fecha) {
  const response = await axios.get(
    `${process.env.API_URL}/db/agenda?fecha=${fecha}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener especialidades
async function obtenerEspecialidades() {
  const response = await axios.get(
    `${process.env.API_URL}/db/especialidades`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener medicos
async function obtenerMedicos() {
  const response = await axios.get(
    `${process.env.API_URL}/db/medicos`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}


// Función para obtener agendas por box_id
async function obtenerAgendaPorBox(box_id) {
  const response = await axios.get(
    `${process.env.API_URL}/db/agenda-box?box_id=${box_id}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}


// Función para obtener agendas por medico_id
async function obtenerAgendaPorMedico(medico_id) {
  const response = await axios.get(
    `${process.env.API_URL}/db/agenda-medico?medico_id=${medico_id}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}


// Función para verificar conflictos de box
async function verificarConflictoBox(box_id, fecha, hora_inicio, hora_fin) {
  const response = await axios.get(
    `${process.env.API_URL}/db/conflicto-box?box_id=${box_id}&fecha=${fecha}&hora_inicio=${hora_inicio}&hora_fin=${hora_fin}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}



// Función para verificar conflictos de médico
async function verificarConflictoMedico(medico_id, fecha, hora_inicio, hora_fin) {
  const response = await axios.get(
    `${process.env.API_URL}/db/conflicto-medico?medico_id=${medico_id}&fecha=${fecha}&hora_inicio=${hora_inicio}&hora_fin=${hora_fin}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener el estado "no atendido"
async function obtenerEstadoNoAtendido() {
  const response = await axios.get(
    `${process.env.API_URL}/db/estado-no-atendido`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Insertar agenda
async function insertarAgenda(agendaInput) {
  const response = await axios.post(
    `${process.env.API_URL}/db/insertar-agenda`,
    agendaInput,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
}




// Función para obtener consultas en curso
async function obtenerConsultasEnCurso(hora_actual, estadosPermitidos) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    IndexName: 'GSI2PK',
    KeyConditionExpression: 'GSI2PK = :fecha',
    FilterExpression: 'idEstado IN (:estado1, :estado2) AND horaInicio <= :hora_actual AND horaFin > :hora_actual',
    ExpressionAttributeValues: {
      ':fecha': `DATE#${new Date().toISOString().split("T")[0]}`,
      ':estado1': estadosPermitidos[0],
      ':estado2': estadosPermitidos[1],
      ':hora_actual': hora_actual,
    }
  };

  try {
    const data = await docClient.send(new QueryCommand(params));
    return data.Items;
  } catch (err) {
    console.error("Error obteniendo consultas en curso:", err);
    throw new Error("Error obteniendo consultas en curso");
  }
}

async function actualizarEstadoAgenda(idAgenda, nuevoEstado) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    Key: {
      PK: `AGENDA#${idAgenda}`,
      SK: `${idAgenda}`,
    },
    UpdateExpression: 'SET idEstado = :estado',
    ExpressionAttributeValues: {
      ':estado': nuevoEstado,
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await docClient.send(new UpdateItemCommand(params));

    if (result.Attributes) {
      return { success: true, updatedAttributes: result.Attributes };
    } else {
      return { success: false, error: "Agenda no encontrada" };
    }
  } catch (err) {
    console.error("Error al actualizar estado de la agenda:", err);
    return { success: false, error: "Error al actualizar estado" };
  }
}

async function obtenerInstrumentosPorBox(boxId) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-box-instrumento',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `BOX#${boxId}`
    }
  };

  try {
    const data = await docClient.send(new QueryCommand(params));
    return data.Items || [];
  } catch (err) {
    console.error("Error obteniendo instrumentos por box:", err);
    throw new Error("Error obteniendo instrumentos por box");
  }
}

// Función para obtener el box y el pasillo
async function obtenerBoxYPasillo(boxId) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-catalogo',
    Key: {
      PK: `BOX#${boxId}`,
      SK: `${boxId}`,
    }
  };

  try {
    const data = await docClient.send(new GetCommand(params));
    return data.Item ? data.Item : null;
  } catch (err) {
    console.error("Error obteniendo box:", err);
    throw new Error("Error obteniendo box");
  }
}

// Función para obtener las agendas por box_id y fecha
async function obtenerAgendaPorBoxYFecha(boxId, fecha) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    KeyConditionExpression: 'PK = :pk AND fecha = :fecha',
    ExpressionAttributeValues: {
      ':pk': `BOX#${boxId}`,
      ':fecha': `DATE#${fecha}`,
    }
  };

  try {
    const data = await docClient.send(new QueryCommand(params));
    return data.Items || [];
  } catch (err) {
    console.error("Error obteniendo agendas por box y fecha:", err);
    throw new Error("Error obteniendo agendas por box y fecha");
  }
}

// Función para obtener las notificaciones
async function obtenerNotificaciones() {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-notificacion',
    ScanIndexForward: false,
    Limit: 50,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    return data.Items || [];
  } catch (err) {
    console.error("Error obteniendo notificaciones:", err);
    throw new Error("Error obteniendo notificaciones");
  }
}

// Función para obtener el nombre del médico
async function obtenerMedicoNombre(medicoId) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-catalogo',
    Key: {
      PK: `MEDICO#${medicoId}`,
      SK: '#',
    }
  };

  try {
    const data = await docClient.send(new GetCommand(params));
    return data.Item ? data.Item.nombre : null;
  } catch (err) {
    console.error("Error obteniendo médico:", err);
    throw new Error("Error obteniendo médico");
  }
}

// Función para obtener el nombre del box
async function obtenerBoxNombre(boxId) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-catalogo',
    Key: {
      PK: `BOX#${boxId}`,
      SK: '#',
    }
  };

  try {
    const data = await docClient.send(new GetCommand(params));
    return data.Item ? data.Item.nombre : null;
  } catch (err) {
    console.error("Error obteniendo box:", err);
    throw new Error("Error obteniendo box");
  }
}

// Función para obtener el total de consultas
async function obtenerTotalConsultas(filtros) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    FilterExpression: filtros.finalFilterExpression,
    ExpressionAttributeValues: filtros.expressionAttributeValues,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    return data.Items.length;
  } catch (err) {
    console.error("Error obteniendo total de consultas:", err);
    throw new Error("Error obteniendo total de consultas");
  }
}

// Función para obtener los boxes disponibles
async function obtenerBoxesDisponibles(boxes) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-catalogo',
  };

  if (boxes && boxes.length > 0) {
    const placeholders = boxes.map(() => '?').join(',');
    params.FilterExpression = `idbox IN (${placeholders})`;
    params.ExpressionAttributeValues = boxes.reduce((acc, box, index) => {
      acc[`:${index}`] = box;
      return acc;
    }, {});
  }

  try {
    const data = await docClient.send(new ScanCommand(params));
    return data.Items.length;
  } catch (err) {
    console.error("Error obteniendo boxes disponibles:", err);
    throw new Error("Error obteniendo boxes disponibles");
  }
}

// Función para obtener la especialidad más demandada
async function obtenerEspecialidadMasDemandada(filtros) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    FilterExpression: filtros.finalFilterExpression,
    ExpressionAttributeValues: filtros.expressionAttributeValues,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    const especialidadCounts = {};
    data.Items.forEach(item => {
      const especialidad = item.especialidad;
      if (especialidadCounts[especialidad]) {
        especialidadCounts[especialidad] += 1;
      } else {
        especialidadCounts[especialidad] = 1;
      }
    });

    const maxEspecialidad = Object.entries(especialidadCounts).reduce((max, current) => {
      return current[1] > max[1] ? current : max;
    });

    return {
      nombre: maxEspecialidad[0],
      consultas: maxEspecialidad[1]
    };
  } catch (err) {
    console.error("Error obteniendo especialidad más demandada:", err);
    throw new Error("Error obteniendo especialidad más demandada");
  }
}

// Función para obtener las consultas por especialidad
async function obtenerConsultasPorEspecialidad(filtros) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    FilterExpression: filtros.finalFilterExpression,
    ExpressionAttributeValues: filtros.expressionAttributeValues,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    const especialidadCounts = {};
    data.Items.forEach(item => {
      const especialidad = item.especialidad;
      if (especialidadCounts[especialidad]) {
        especialidadCounts[especialidad] += 1;
      } else {
        especialidadCounts[especialidad] = 1;
      }
    });

    return Object.entries(especialidadCounts).map(([nombre, consultas]) => ({ nombre, consultas }));
  } catch (err) {
    console.error("Error obteniendo consultas por especialidad:", err);
    throw new Error("Error obteniendo consultas por especialidad");
  }
}

// Función para obtener las consultas por día
async function obtenerConsultasPorDia(filtros) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    FilterExpression: filtros.finalFilterExpression,
    ExpressionAttributeValues: filtros.expressionAttributeValues,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    const diasSemana = [0, 1, 2, 3, 4, 5, 6];
    const consultasPorDia = Array(7).fill(0);
    data.Items.forEach(item => {
      const dia = new Date(item.fecha).getDay();
      consultasPorDia[dia] += 1;
    });

    return consultasPorDia;
  } catch (err) {
    console.error("Error obteniendo consultas por día:", err);
    throw new Error("Error obteniendo consultas por día");
  }
}

// Función para obtener el rendimiento de los médicos
async function obtenerRendimientoMedicos(filtros) {
  const params = {
    TableName: 'aws-cognito-jwt-login-dev-agenda',
    FilterExpression: filtros.finalFilterExpression,
    ExpressionAttributeValues: filtros.expressionAttributeValues,
  };

  try {
    const data = await docClient.send(new ScanCommand(params));
    const rendimientoMedicos = {};
    data.Items.forEach(item => {
      const medico = item.medico;
      const especialidad = item.especialidad;

      if (!rendimientoMedicos[medico]) {
        rendimientoMedicos[medico] = { consultas: 0, especialidad };
      }
      rendimientoMedicos[medico].consultas += 1;
    });

    const topMedicos = Object.entries(rendimientoMedicos)
      .sort((a, b) => b[1].consultas - a[1].consultas)
      .slice(0, 10)
      .map(([nombre, { consultas, especialidad }]) => ({
        nombre,
        consultas,
        especialidad
      }));

    return topMedicos;
  } catch (err) {
    console.error("Error obteniendo rendimiento de médicos:", err);
    throw new Error("Error obteniendo rendimiento de médicos");
  }
}

// Función para obtener los médicos por especialidades
async function obtenerMedicosPorEspecialidades(especialidades) {
  const medicoIds = [];
  for (const especialidad of especialidades) {
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-catalogo',
      IndexName: 'GSI1PK',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `ESP#${especialidad}`,
      }
    };
    try {
      const data = await docClient.send(new QueryCommand(params));
      const ids = data.Items.map(item => item.idMedico);
      medicoIds.push(...ids);
    } catch (err) {
      console.error("Error obteniendo médicos por especialidad:", err);
      throw new Error("Error obteniendo médicos por especialidad");
    }
  }
  return medicoIds;
}


module.exports = {
  obtenerPasillos,
  obtenerBoxes,
  obtenerAgendaPorFecha,
  obtenerEspecialidades,
  obtenerMedicos,
  obtenerAgendaPorBox,
  obtenerAgendaPorMedico,
  verificarConflictoBox,
  verificarConflictoMedico,
  obtenerEstadoNoAtendido,
  insertarAgenda,
  obtenerConsultasEnCurso,
  actualizarEstadoAgenda,
  obtenerInstrumentosPorBox,
  obtenerBoxYPasillo,
  obtenerAgendaPorBoxYFecha,
  obtenerNotificaciones,
  obtenerMedicoNombre,
  obtenerBoxNombre,
  obtenerTotalConsultas,
  obtenerBoxesDisponibles,
  obtenerEspecialidadMasDemandada,
  obtenerConsultasPorEspecialidad,
  obtenerConsultasPorDia,
  obtenerRendimientoMedicos,
  obtenerMedicosPorEspecialidades,
  docClient
};
