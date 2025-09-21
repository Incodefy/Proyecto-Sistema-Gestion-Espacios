const express = require('express');
const path = require('path');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const session = require("express-session");
const flash = require("connect-flash");

const checkPermission = require('./middleware/checkPermission');

app.use(session({
  secret: process.env.SESSION_SECRET || "clave-secreta",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.error_msg = req.flash("error");
  res.locals.success_msg = req.flash("success");
  // Hacer el usuario disponible en todas las vistas
  res.locals.user = req.session.user || null;
  next();
});

// Importar middleware de autenticación
const requireAuth = require('./middleware/requireAuth');

// === RUTAS PÚBLICAS (sin autenticación) ===

// Ruta raíz - redirigir según estado de autenticación
app.get('/', (req, res) => {
  console.log("Acceso a ruta raíz");
  console.log("Usuario autenticado:", req.session.user ? "SÍ" : "NO");
  
  if (req.session.user && req.session.user.idToken) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Auth routes (públicas)
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);

// === RUTAS PROTEGIDAS (requieren autenticación) ===

// Agenda - protegida
app.get('/agenda', requireAuth, checkPermission('agenda.read'), (req, res) => {
  const userPermissions = req.session.user?.permissions || [];
  
  res.render('agenda', {
    currentPath: req.path,
    // Permisos específicos para mostrar secciones
    canViewAgenda: userPermissions.includes('agenda.read') || userPermissions.includes('admin.users'),
    canWriteAgenda: userPermissions.includes('agenda.write') || userPermissions.includes('admin.users'),
    canImport: userPermissions.includes('data.import') || userPermissions.includes('admin.users'),
    canExport: userPermissions.includes('data.export') || userPermissions.includes('admin.users'),
    personalization: req.session.user?.personalization || {},
    idToken: req.session.user?.idToken || ""
  });
});

// Rutas de importar y exportar (si no las tienes ya)
app.get('/importar', requireAuth, checkPermission('data.import'), (req, res) => {
  res.render('importar', { currentPath: req.path });
});

app.get('/exportar', requireAuth, checkPermission('data.export'), (req, res) => {
  res.render('exportar', { currentPath: req.path });
});

// Rutas de calendario (sub-rutas de agenda)
app.get('/calendario/box', requireAuth, checkPermission('agenda.read'), (req, res) => {
  const userPermissions = req.session.user?.permissions || [];
  res.render('calendario-box', { 
    currentPath: req.path,
    canEdit: userPermissions.includes('agenda.write') || userPermissions.includes('admin.users')
  });
});

app.get('/calendario/medico', requireAuth, checkPermission('agenda.read'), (req, res) => {
  const userPermissions = req.session.user?.permissions || [];
  res.render('calendario-medico', { 
    currentPath: req.path,
    canEdit: userPermissions.includes('agenda.write') || userPermissions.includes('admin.users')
  });
});

// Box routes - protegidas
const boxRoutes = require("./routes/box");
app.use("/", requireAuth, boxRoutes);

// Detalle de box - protegidas
const detalleBoxRoutes = require("./routes/detalle_box");
app.use("/", requireAuth, detalleBoxRoutes);

// Consultas en curso - protegidas
const consultasRoutes = require("./routes/consultas");
app.use("/", requireAuth, consultasRoutes);

// Dashboard - protegido
const dashboardRoutes = require("./routes/dashboard");
app.use("/", requireAuth, dashboardRoutes);

// Historial notificaciones - protegido
const notificacionesRoutes = require("./routes/notificaciones");
app.use("/", requireAuth, notificacionesRoutes);

// Calendario agenda - protegido
const calendarioRouter = require('./routes/calendario');
app.use('/', requireAuth, calendarioRouter);

// Perfil - protegido
app.get('/perfil', requireAuth, (req, res) => {
  res.render('perfil', {
    currentPath: req.path,
    personalization: req.session.user?.personalization || {},
    idToken: req.session.user?.idToken
  });
});

// En server.js, reemplaza el endpoint actual de /api/personalization con este:
// POST /api/personalization - Actualizado para manejar comunicación asíncrona
app.post('/api/personalization', requireAuth, async (req, res) => {
  try {
    console.log('📡 POST /api/personalization - Usuario:', req.session.user?.email);
    console.log('📡 Datos recibidos:', req.body);
    
    if (!req.session.user?.idToken) {
      console.error('❌ Usuario no autenticado o sin token');
      return res.status(401).json({ 
        ok: false, 
        error: 'Usuario no autenticado' 
      });
    }
    
    if (!req.body.parameters) {
      console.error('❌ No se enviaron parámetros');
      return res.status(400).json({ 
        ok: false, 
        error: 'Parámetros requeridos' 
      });
    }
    
    console.log('📡 Enviando request a Lambda con cola...');
    
    // Hacer la petición al endpoint que usa SQS
    const response = await fetch('https://ux70372886.execute-api.us-east-1.amazonaws.com/personalization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.session.user.idToken}`
      },
      body: JSON.stringify(req.body)
    });
    
    console.log('📥 Response status de Lambda:', response.status);
    
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
      console.log('📥 Response data de Lambda:', result);
    } else {
      const textResult = await response.text();
      console.error('❌ Lambda retornó contenido no-JSON:', textResult);
      
      return res.status(response.status || 500).json({ 
        ok: false, 
        error: `Error del servidor de personalización: ${response.status} ${response.statusText}`,
        details: textResult
      });
    }
    
    // Si la respuesta es exitosa (202 - Accepted para procesamiento asíncrono)
    if (response.status === 202 && result.ok) {
      console.log('✅ Evento enviado a cola exitosamente:', result.event_id);
      
      // Opción 1: Responder inmediatamente (modo fire-and-forget)
      if (req.query.async === 'true') {
        return res.status(202).json({
          ok: true,
          message: 'Personalización enviada a procesamiento',
          event_id: result.event_id,
          status: 'queued',
          async: true
        });
      }
      
      // Opción 2: Hacer polling para esperar el procesamiento (default)
      console.log('🔍 Iniciando polling para verificar procesamiento...');
      
      try {
        const pollResult = await pollPersonalizationStatus(
          result.event_id,
          req.session.user.idToken,
          15, // máximo 15 intentos
          800  // empezar con 800ms
        );
        
        if (pollResult.success) {
          console.log('✅ Personalización procesada exitosamente');
          
          // Actualizar sesión con la nueva personalización
          req.session.user.personalization = pollResult.data;
          
          return res.status(200).json({
            ok: true,
            message: 'Personalización actualizada exitosamente',
            event_id: result.event_id,
            status: 'completed',
            personalization: pollResult.data,
            polling_completed: true
          });
        } else {
          console.log('⚠️ Polling falló, pero evento fue enviado:', pollResult.error);
          
          return res.status(202).json({
            ok: true,
            message: 'Personalización enviada a procesamiento. Los cambios se aplicarán pronto.',
            event_id: result.event_id,
            status: 'processing',
            polling_error: pollResult.error,
            suggestion: 'Recarga la página en unos segundos para ver los cambios'
          });
        }
      } catch (pollError) {
        console.error('❌ Error en polling:', pollError);
        
        return res.status(202).json({
          ok: true,
          message: 'Personalización enviada a procesamiento',
          event_id: result.event_id,
          status: 'processing',
          polling_error: pollError.message
        });
      }
      
    } else {
      console.error('❌ Error en Lambda response:', result);
      res.status(response.status).json(result);
    }
    
  } catch (error) {
    console.error('❌ Error en /api/personalization:', error);
    console.error('❌ Error stack:', error.stack);
    
    let errorMessage = 'Error interno del servidor';
    let statusCode = 500;
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'No se pudo conectar al servicio de personalización';
      statusCode = 503;
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Error de conectividad con el servicio externo';
      statusCode = 502;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      ok: false, 
      error: errorMessage,
      type: error.name,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/personalization-status/:eventId - Nuevo endpoint para verificar estado
app.get('/api/personalization-status/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log('🔍 Verificando estado del evento:', eventId);
    
    if (!req.session.user?.idToken) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado' });
    }
    
    // Hacer polling limitado para verificar el estado
    const pollResult = await pollPersonalizationStatus(
      eventId,
      req.session.user.idToken,
      3, // solo 3 intentos para verificación rápida
      500
    );
    
    if (pollResult.success) {
      // Actualizar sesión
      req.session.user.personalization = pollResult.data;
      
      res.json({
        ok: true,
        event_id: eventId,
        status: 'completed',
        personalization: pollResult.data
      });
    } else {
      res.json({
        ok: false,
        event_id: eventId,
        status: 'processing',
        error: pollResult.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error verificando estado:', error);
    res.status(500).json({
      ok: false,
      error: 'Error verificando estado del evento'
    });
  }
});

// POST /api/refresh-personalization - Actualizado para mejor manejo
app.post('/api/refresh-personalization', requireAuth, async (req, res) => {
  try {
    const { refreshUserPersonalization } = require('./routes/auth');
    
    const success = await refreshUserPersonalization(req);
    if (success) {
      req.session.save((err) => {
        if (err) {
          console.log("Error guardando sesión:", err);
          return res.status(500).json({ ok: false, error: 'Error guardando sesión' });
        }
        
        console.log("✅ Sesión actualizada correctamente");
        res.json({ 
          ok: true, 
          personalization: req.session.user.personalization,
          message: 'Personalización actualizada en sesión'
        });
      });
    } else {
      res.status(500).json({ ok: false, error: 'No se pudo actualizar la personalización' });
    }
  } catch (error) {
    console.error("Error en refresh-personalization:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// WebSocket o SSE endpoint para notificaciones en tiempo real (opcional)
app.get('/api/personalization-events', requireAuth, (req, res) => {
  // Configurar Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  const userId = req.session.user?.sub;
  console.log('📡 Cliente SSE conectado para usuario:', userId);
  
  // Enviar evento inicial
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    userId,
    timestamp: new Date().toISOString()
  })}\n\n`);
  
  // En un sistema real, aquí te suscribirías a eventos de personalización
  // Por ahora, mantener la conexión viva
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    })}\n\n`);
  }, 30000);
  
  req.on('close', () => {
    console.log('📡 Cliente SSE desconectado:', userId);
    clearInterval(keepAlive);
  });
});


// === RUTAS DE UTILIDAD ===

// Ruta de test para verificar funcionamiento
app.get('/test', (req, res) => {
  res.json({ 
    message: "Servidor funcionando correctamente",
    authenticated: req.session.user ? true : false,
    user: req.session.user ? {
      email: req.session.user.email,
      nombre: req.session.user.nombre
    } : null,
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).render('error', { 
    error: 'Página no encontrada',
    message: `La ruta ${req.path} no existe`
  });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error en la aplicación:', err);
  res.status(500).render('error', { 
    error: 'Error interno del servidor',
    message: 'Ha ocurrido un error inesperado'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Vistas en: ${path.join(__dirname, 'views')}`);
  console.log(`📁 Archivos estáticos en: ${path.join(__dirname, 'public')}`);
});

module.exports = app;