require('dotenv').config();
const axios = require('axios');

// Función para obtener pasillos con el token
async function obtenerPasillos() {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/pasillos`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener boxes
async function obtenerBoxes() {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/boxes`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener agendas por fecha
async function obtenerAgendaPorFecha(fecha) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/agenda?fecha=${fecha}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener especialidades
async function obtenerEspecialidades() {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/especialidades`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener medicos
async function obtenerMedicos() {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/medicos`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}


// Función para obtener agendas por box_id
async function obtenerAgendaPorBox(box_id) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/agenda-box?box_id=${box_id}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}


// Función para obtener agendas por medico_id
async function obtenerAgendaPorMedico(medico_id) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/agenda-medico?medico_id=${medico_id}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener agenda por idAgenda
async function obtenerAgendaPorId(idAgenda) {
  const { data } = await axios.get(
    `${process.env.API_BASE_URL}/db/agenda-id?idAgenda=${idAgenda}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

// Función para verificar conflictos de box
async function verificarConflictoBox(box_id, fecha, hora_inicio, hora_fin) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/conflicto-box?box_id=${box_id}&fecha=${fecha}&hora_inicio=${hora_inicio}&hora_fin=${hora_fin}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para verificar conflictos de médico
async function verificarConflictoMedico(medico_id, fecha, hora_inicio, hora_fin) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/conflicto-medico?medico_id=${medico_id}&fecha=${fecha}&hora_inicio=${hora_inicio}&hora_fin=${hora_fin}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener el estado "no atendido"
async function obtenerEstadoNoAtendido() {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/estado-no-atendido`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Insertar agenda
async function insertarAgenda(agendaInput) {
  const response = await axios.post(
    `${process.env.API_BASE_URL}/db/insertar-agenda`,
    agendaInput,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
}

// Función para obtener consultas en curso
async function obtenerConsultasEnCurso(hora_actual, estadosPermitidos) {
  const { data } = await axios.get(
    `${process.env.API_BASE_URL}/db/consultas-en-curso`,
    {
      params: {
        hora_actual,
        estadosPermitidos: estadosPermitidos.join(",")
      },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  return data;
}

// Función actualizar estado de agenda
async function actualizarEstadoAgenda(idAgenda, nuevoEstado) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/nuevo-estado-agenda`,
    { idAgenda, nuevoEstado },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

// Función para obtener isntrumentos por box
async function obtenerInstrumentosPorBox(boxId) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/instrumentos-box?boxId=${boxId}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener el box y el pasillo
async function obtenerBoxYPasillo(boxId) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/box-pasillo?boxId=${boxId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

// Función para obtener las agendas por box_id y fecha
async function obtenerAgendaPorBoxYFecha(boxId, fecha) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/agenda-box-fecha?boxId=${boxId}&fecha=${fecha}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// Función para obtener las notificaciones
async function obtenerNotificaciones() {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/notificaciones`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

// Función para obtener el nombre del médico
async function obtenerMedicoNombre(medicoId) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/medico-nombre?medicoId=${medicoId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.nombre;
}

// Función para obtener el nombre del box
async function obtenerBoxNombre(boxId) {
  const response = await axios.get(
    `${process.env.API_BASE_URL}/db/box-nombre?medicoId=${boxId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.nombre;
}

// Función para obtener el total de consultas
async function obtenerTotalConsultas(filtros) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/total-consultas`,
    filtros,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.total;
}

// Función para obtener los boxes disponibles
async function obtenerBoxesDisponibles(boxes) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/boxes-disponibles`,
    { boxes },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
}

// Función para obtener la especialidad más demandada
async function obtenerEspecialidadMasDemandada(filtros) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/especialidad-mas-demandada`,
    filtros,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

// Función para obtener las consultas por especialidad
async function obtenerConsultasPorEspecialidad(filtros) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/consultas-especialidad`,
    filtros,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

// Función para obtener las consultas por día
async function obtenerConsultasPorDia(filtros) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/consultas-dia`,
    filtros,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

// Función para obtener el rendimiento de los médicos
async function obtenerRendimientoMedicos(filtros) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/rendimiento-medicos`,
    filtros,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
}

// Función para obtener los médicos por especialidades
async function obtenerMedicosPorEspecialidades(especialidades) {
  const { data } = await axios.post(
    `${process.env.API_BASE_URL}/db/medicos-especialidades`,
    { especialidades },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

module.exports = {
  obtenerPasillos,
  obtenerBoxes,
  obtenerAgendaPorFecha,
  obtenerEspecialidades,
  obtenerMedicos,
  obtenerAgendaPorBox,
  obtenerAgendaPorMedico,
  obtenerAgendaPorId,
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
  obtenerMedicosPorEspecialidades
};
