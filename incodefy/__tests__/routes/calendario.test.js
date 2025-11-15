/**
 * Tests unitarios para las rutas de Agenda
 */

const request = require('supertest');
const express = require('express');
const calendarioRoutes = require('../../routes/calendario');

// Mock del apiClient
jest.mock('../../middleware/apiClient', () => {
  return (req, res, next) => {
    req.apiClient = {
      obtenerPasillos: jest.fn(),
      obtenerBoxes: jest.fn(),
      obtenerMedicos: jest.fn(),
      obtenerEspecialidades: jest.fn(),
      obtenerAgendaPorBox: jest.fn(),
      obtenerAgendaPorMedico: jest.fn(),
      insertarAgenda: jest.fn(),
      eliminarAgenda: jest.fn()
    };
    next();
  };
});

// Mock de requireAuth
jest.mock('../../middleware/requireAuth', () => {
  return (req, res, next) => {
    req.session = {
      user: {
        sub: 'test-user-123',
        email: 'test@example.com',
        idToken: 'mock-token'
      }
    };
    next();
  };
});

describe('Calendario/Agenda Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock session
    app.use((req, res, next) => {
      req.session = {
        user: {
          sub: 'test-user-123',
          email: 'test@example.com',
          idToken: 'mock-token'
        }
      };
      next();
    });

    app.use('/', calendarioRoutes);
  });

  describe('GET /agenda/calendario/:tipo', () => {
    test('debe cargar la vista de calendario para box', async () => {
      const mockApiClient = {
        obtenerPasillos: jest.fn().mockResolvedValue([
          { idPasillo: 1, nombre: 'Pasillo A' }
        ]),
        obtenerBoxes: jest.fn().mockResolvedValue([
          { idBox: 1, nombre: 'Box 1' }
        ]),
        obtenerMedicos: jest.fn().mockResolvedValue([
          { idMedico: 1, nombre: 'Dr. Test' }
        ]),
        obtenerEspecialidades: jest.fn().mockResolvedValue([
          { idEspecialidad: 1, nombre: 'Cardiología' }
        ])
      };

      // Redefinir ruta con mock
      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const response = await request(app)
        .get('/agenda/calendario/box')
        .expect(200);

      expect(mockApiClient.obtenerPasillos).toHaveBeenCalled();
      expect(mockApiClient.obtenerBoxes).toHaveBeenCalled();
    });

    test('debe retornar 400 si el tipo es inválido', async () => {
      const response = await request(app)
        .get('/agenda/calendario/invalid-type')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /agenda/obtener-agendamientos', () => {
    test('debe obtener agendamientos por box', async () => {
      const mockAgendas = [
        {
          idAgenda: 1,
          fecha: '2025-11-15',
          hora_inicio: '09:00',
          hora_fin: '10:00'
        }
      ];

      const mockApiClient = {
        obtenerAgendaPorBox: jest.fn().mockResolvedValue(mockAgendas)
      };

      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const response = await request(app)
        .get('/agenda/obtener-agendamientos')
        .query({ tipo: 'box', id: '1' })
        .expect(200);

      expect(response.body).toEqual(mockAgendas);
      expect(mockApiClient.obtenerAgendaPorBox).toHaveBeenCalledWith('1');
    });

    test('debe obtener agendamientos por médico', async () => {
      const mockAgendas = [
        {
          idAgenda: 2,
          fecha: '2025-11-16',
          hora_inicio: '14:00',
          hora_fin: '15:00'
        }
      ];

      const mockApiClient = {
        obtenerAgendaPorMedico: jest.fn().mockResolvedValue(mockAgendas)
      };

      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const response = await request(app)
        .get('/agenda/obtener-agendamientos')
        .query({ tipo: 'medico', id: '5' })
        .expect(200);

      expect(response.body).toEqual(mockAgendas);
      expect(mockApiClient.obtenerAgendaPorMedico).toHaveBeenCalledWith('5');
    });

    test('debe retornar 400 si faltan parámetros', async () => {
      const response = await request(app)
        .get('/agenda/obtener-agendamientos')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /agenda/guardar-agenda', () => {
    test('debe crear una nueva agenda con datos válidos', async () => {
      const mockInsertResult = { success: true, idAgenda: 123 };
      
      const mockApiClient = {
        insertarAgenda: jest.fn().mockResolvedValue(mockInsertResult)
      };

      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const agendaData = {
        idBox: 1,
        idMedico: 5,
        fecha: '2025-11-20',
        hora_inicio: '09:00',
        hora_fin: '10:00',
        observaciones: 'Test agenda'
      };

      const response = await request(app)
        .post('/agenda/guardar-agenda')
        .send(agendaData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(mockApiClient.insertarAgenda).toHaveBeenCalled();
    });

    test('debe validar campos obligatorios', async () => {
      const response = await request(app)
        .post('/agenda/guardar-agenda')
        .send({
          idBox: 1
          // Faltan campos obligatorios
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('debe validar formato de fecha', async () => {
      const agendaData = {
        idBox: 1,
        idMedico: 5,
        fecha: 'invalid-date',
        hora_inicio: '09:00',
        hora_fin: '10:00'
      };

      const response = await request(app)
        .post('/agenda/guardar-agenda')
        .send(agendaData)
        .expect(400);

      expect(response.body.error).toContain('fecha');
    });

    test('debe validar formato de hora', async () => {
      const agendaData = {
        idBox: 1,
        idMedico: 5,
        fecha: '2025-11-20',
        hora_inicio: '25:00', // Hora inválida
        hora_fin: '10:00'
      };

      const response = await request(app)
        .post('/agenda/guardar-agenda')
        .send(agendaData)
        .expect(400);

      expect(response.body.error).toContain('hora');
    });

    test('debe validar que hora_fin sea posterior a hora_inicio', async () => {
      const agendaData = {
        idBox: 1,
        idMedico: 5,
        fecha: '2025-11-20',
        hora_inicio: '10:00',
        hora_fin: '09:00' // Anterior a hora_inicio
      };

      const response = await request(app)
        .post('/agenda/guardar-agenda')
        .send(agendaData)
        .expect(400);

      expect(response.body.error).toContain('hora_fin');
    });
  });

  describe('POST /agenda/eliminar-agenda-medico', () => {
    test('debe eliminar agenda de médico con id válido', async () => {
      const mockApiClient = {
        eliminarAgenda: jest.fn().mockResolvedValue({ success: true })
      };

      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const response = await request(app)
        .post('/agenda/eliminar-agenda-medico')
        .send({ idAgenda: 123 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(mockApiClient.eliminarAgenda).toHaveBeenCalledWith(123);
    });

    test('debe retornar 400 si falta idAgenda', async () => {
      const response = await request(app)
        .post('/agenda/eliminar-agenda-medico')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /agenda/eliminar-agenda-box', () => {
    test('debe eliminar agenda de box con id válido', async () => {
      const mockApiClient = {
        eliminarAgenda: jest.fn().mockResolvedValue({ success: true })
      };

      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const response = await request(app)
        .post('/agenda/eliminar-agenda-box')
        .send({ idAgenda: 456 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(mockApiClient.eliminarAgenda).toHaveBeenCalledWith(456);
    });
  });

  describe('Manejo de errores', () => {
    test('debe manejar errores del apiClient', async () => {
      const mockApiClient = {
        obtenerAgendaPorBox: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      app.use((req, res, next) => {
        req.apiClient = mockApiClient;
        next();
      });

      const response = await request(app)
        .get('/agenda/obtener-agendamientos')
        .query({ tipo: 'box', id: '1' })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });
});
