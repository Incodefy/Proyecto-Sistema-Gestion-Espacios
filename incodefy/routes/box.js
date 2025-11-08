// routes/box.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

router.get('/box', checkPermission('box.read'), async (req, res) => {
  try {
    const filtroPasillo = expandirRangos(req.query.pasillo);
    const filtroBox = expandirRangos(req.query.box);
    const filtroEstado = req.query.estado;

    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toTimeString().slice(0, 5);

    const pasillos = (await req.apiClient.obtenerPasillos()).sort((a, b) => a.idPasillo - b.idPasillo);
    
    const boxes = (await req.apiClient.obtenerBoxes()).sort((a, b) => a.idBox - b.idBox);
    
    const agendas = await req.apiClient.obtenerAgendaPorFecha(hoy);

    const pasillo_box_map = generarPasillosConBoxes(
      req,
      pasillos,
      boxes,
      agendas,
      filtroPasillo,
      filtroBox,
      filtroEstado,
      hoy,
      ahora
    );

    const userPermissions = req.session.user?.permissions || [];

    res.render('box', { 
      pasillo_box_map, 
      personalization: req.session.user?.personalization || {},
      currentPath: req.path,
      canWrite: userPermissions.includes('box.write') || userPermissions.includes('admin.users'),
      canViewDetail: userPermissions.includes('box.detalle.read') || userPermissions.includes('admin.users')
    });
  } catch (err) {
    console.error('❌ Error en /box:', err);
    res.status(500).send('Error cargando datos de boxes');
  }
});

function expandirRangos(texto) {
  if (!texto) return null;
  const resultado = new Set();

  texto.split(',').forEach(parte => {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-').map(Number);
      if (!isNaN(inicio) && !isNaN(fin)) {
        for (let i = inicio; i <= fin; i++) resultado.add(i);
      }
    } else {
      const num = Number(parte);
      if (!isNaN(num)) resultado.add(num);
    }
  });

  return Array.from(resultado).sort((a, b) => a - b);
}

function generarPasillosConBoxes(req, pasillos, boxes, agendas, filtroPasillo, filtroBox, filtroEstado, hoy, horaActual) {
  const resultado = {};

  pasillos.forEach(pasillo => {
    if (filtroPasillo && !filtroPasillo.includes(pasillo.idPasillo)) return;

    const boxesFiltrados = boxes.filter(b => b.idPasillo === pasillo.idPasillo);
    const boxesProcesados = [];

    boxesFiltrados.forEach(box => {
      if (filtroBox && !filtroBox.includes(box.idBox)) return;

      let estadoKey = box.estado === 0 ? 'disabled' : 'free';
      let estado = req.t(`common.state_${estadoKey}`);

      if (box.estado !== 0) {
        const consultas = agendas.filter(a => {
          const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
          const horaInicio = a.horaInicio.slice(0,5);
          return (
            a.idBox === box.idBox &&
            fechaAgenda === hoy &&
            horaInicio <= horaActual
          );
        });

        for (const consulta of consultas) {
          const inicio = new Date(`${hoy}T${consulta.horaInicio}`);
          let fin;

          if (!consulta.horaFin) {
            fin = new Date(`${hoy}T23:59:59`);
          } else if (consulta.horaFin <= consulta.horaInicio) {
            const nextDay = new Date(hoy);
            nextDay.setDate(nextDay.getDate() + 1);
            fin = new Date(`${nextDay.toISOString().split('T')[0]}T${consulta.horaFin}`);
          } else {
            fin = new Date(`${hoy}T${consulta.horaFin}`);
          }

          const ahora = new Date(`${hoy}T${horaActual}`);

          if (ahora >= inicio && ahora < fin) {
            estadoKey = 'in_use';
            estado = req.t(`common.state_${estadoKey}`);
            break;
          }
        }
      }

      if (filtroEstado && estado.replace(' ', '-').toLowerCase() !== filtroEstado) return;

      boxesProcesados.push({
        id: box.idBox,
        nombre: box.nombre || `Box ${box.idBox}`,
        estado
      });
    });

    if (boxesProcesados.length > 0) {
      resultado[pasillo.nombre] = boxesProcesados;
    }
  });

  return resultado;
}

router.get('/estado-boxes', async (req, res) => {
  try {
    
    const hoy = new Date().toISOString().split('T')[0];
    const ahora = new Date().toTimeString().slice(0, 5);
    const contexto = new ContextoEstado();

    const boxes = await req.apiClient.obtenerBoxes();
    let agendas = await req.apiClient.obtenerAgendaPorFecha(hoy);

    agendas = agendas.map(a => ({
      ...a,
      boxId: Number(a.idbox),
      horaInicio: a.horaInicio.slice(0, 5),
      horaFin: a.horaFin ? a.horaFin.slice(0, 5) : null,
    }));

    const data = {};
      for (const box of boxes) {
        const estado = contexto.obtenerEstado(req, box, hoy, ahora, agendas);
        // console.log("Estado para el box", box.idBox, ":", estado);
        data[box.idBox] = {
          estado: estado.nombre,
          medico: estado.medico,
          especialidad: estado.especialidad,
          consulta_actual: estado.consulta_actual,
          consulta_actual_id: estado.consulta_id,
          proxima_consulta: estado.proxima_consulta,
          inhabilitado: box.estado === 0,
        };
    }

    res.json(data);
  } catch (err) {
    console.error('❌ Error en /estado-boxes:', err);
    res.status(500).json({ error: 'Error cargando estado de boxes' });
  }
  
});

class EstadoBox {
  constructor({ nombre, medico = '', especialidad = '', consulta_actual = '', proxima_consulta = '', consulta_id = null }) {
    this.nombre = nombre;
    this.medico = medico;
    this.especialidad = especialidad;
    this.consulta_actual = consulta_actual;
    this.proxima_consulta = proxima_consulta;
    this.consulta_id = consulta_id;
  }
}

class EstadoInhabilitado {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    return new EstadoBox({ 
      nombre: req.t('common.state_disabled')
    });
  }
}

class EstadoConConsulta {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    const consultas = agendas.filter(a => {
      const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
      const fechaHoy = fecha;
      const horaInicio = a.horaInicio.slice(0,5);
      const matchFecha = fechaAgenda === fechaHoy;
      const matchHora = horaInicio <= horaActual;

      return a.idBox === box.idBox && matchFecha && matchHora;
    });

    for (const consulta of consultas) {
      const inicio = new Date(`${fecha}T${consulta.horaInicio}`);
      let fin;

      if (!consulta.horaFin) {
        fin = new Date(`${fecha}T23:59:59`);
      } else if (consulta.horaFin <= consulta.horaInicio) {
        const nextDay = new Date(fecha);
        nextDay.setDate(nextDay.getDate() + 1);
        fin = new Date(`${nextDay.toISOString().split('T')[0]}T${consulta.horaFin}`);
      } else {
        fin = new Date(`${fecha}T${consulta.horaFin}`);
      }

      const ahora = new Date(`${fecha}T${horaActual}`);

      if (ahora >= inicio && ahora < fin) {
        const estadoNombre = consulta.estado ? consulta.estado.toLowerCase() : '';
        let nombreEstado = req.t('common.state_in_use');

        if (estadoNombre === 'en espera' || estadoNombre === 'no atendido') {
          nombreEstado = req.t('common.state_waiting');
        } else if (estadoNombre === 'atendido') {
          nombreEstado = req.t('common.state_in_use');
        }

        return new EstadoBox({
          nombre: nombreEstado,
          medico: consulta.medicoNombre,
          especialidad: consulta.especialidadNombre,
          consulta_actual: `${consulta.horaInicio} - ${consulta.horaFin}`,
          consulta_id: consulta.idAgenda
        });
      }
    }

    return null;
  }
}

class EstadoLibre {
  calcularEstado(req, box, fecha, horaActual, agendas) {
    const proximas = agendas.filter(a => {
      const fechaAgenda = new Date(a.fecha).toISOString().split('T')[0];
      const fechaHoy = fecha;
      const horaInicio = a.horaInicio.slice(0,5);
      const matchFecha = fechaAgenda === fechaHoy;
      const matchHora = horaInicio > horaActual;
      return a.idBox === box.idBox && matchFecha && matchHora;
    });

    const proxima = proximas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))[0];

    if (proxima) {
      return new EstadoBox({
        nombre: req.t('common.state_free'),
        medico: proxima.medicoNombre,
        especialidad: proxima.especialidadNombre,
        proxima_consulta: `${proxima.horaInicio} - ${proxima.horaFin || ''}`
      });
    }

    return new EstadoBox({ nombre: req.t('common.state_free') });
  }
}

class ContextoEstado {
  obtenerEstado(req, box, fecha, horaActual, agendas) {
    if (box.estado === 0) {
      return new EstadoInhabilitado().calcularEstado(req, box, fecha, horaActual, agendas);
    }

    let estado = new EstadoConConsulta().calcularEstado(req, box, fecha, horaActual, agendas);

    if (!estado) {
      estado = new EstadoLibre().calcularEstado(req, box, fecha, horaActual, agendas);
    }

    return estado;
  }
}

module.exports = router;