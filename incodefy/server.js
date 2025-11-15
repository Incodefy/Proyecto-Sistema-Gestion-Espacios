// server.js
const express = require('express');
const path = require('path');
const db = require('./db');
const fetch = require('node-fetch');
const cors = require('cors');

// === i18next configuración para internacionalización ===
const i18next = require('./i18n');
const i18nextHttpMiddleware = require('i18next-http-middleware');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración del motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// === Configuración de CORS restrictiva ===
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origin (como aplicaciones móviles o Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'La política CORS no permite el acceso desde este origen.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// === Middlewares de base ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// === Configuración de Sesión Segura ===
const session = require('express-session');
const flash = require('connect-flash');

// Validación de SESSION_SECRET obligatoria en producción
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en producción');
}

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  ADVERTENCIA: SESSION_SECRET no está configurado. Usando valor por defecto INSEGURO.');
}

const sessionSecret = process.env.SESSION_SECRET || 'default-insecure-secret-change-me';

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Nombre personalizado en lugar de 'connect.sid'
  cookie: {
    httpOnly: true, // Previene acceso por JavaScript del cliente
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    sameSite: 'lax', // Protección CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// === Integración de i18next (Internacionalización) ===
// 1. Añade las funciones de i18next (req.t, req.i18n) a cada petición.
//    Debe ir DESPUÉS de la sesión para poder persistir el idioma.
app.use(i18nextHttpMiddleware.handle(i18next));

// 2. Middleware para cambiar el idioma basado en la sesión y exponer la función `t` a las vistas.
app.use((req, res, next) => {
  // Si el usuario tiene un idioma guardado en la sesión, lo usamos.
  if (req.session && req.session.language && req.i18n?.language !== req.session.language) {
    req.i18n.changeLanguage(req.session.language);
  }
  // Hacemos la función `t` y el idioma actual disponibles en TODAS las vistas EJS
  res.locals.t = req.t;
  const currentLang = req.i18n?.language || req.language;
  res.locals.lng = currentLang;
  res.locals.language = currentLang; // Alias para consistencia
  // Compatibilidad con plantillas que esperan `i18n.language`
  res.locals.i18n = { language: currentLang };
  next();
});


// === Middlewares de aplicación (dependen de sesión) ===
app.use(flash());

app.use((req, res, next) => {
  res.locals.error_msg = req.flash('error');
  res.locals.success_msg = req.flash('success');
  res.locals.user = req.session.user || null;
  next();
});

// Importar middlewares
const requireAuth = require('./middleware/requireAuth');
const personalizationMiddleware = require('./middleware/personalization');
const setLanguage = require('./middleware/setLanguage');
const checkPermission = require('./middleware/checkPermission');
const checkGrupoActivo = require('./middleware/checkGrupoActivo');
const attachApiClient = require('./middleware/apiClient');

// === MIDDLEWARES GLOBALES DE PERSONALIZACIÓN ===
// Estos se ejecutarán en todas las rutas que vengan después de ellos.
app.use(personalizationMiddleware);
app.use(setLanguage);


// === RUTAS PÚBLICAS (sin autenticación) ===

app.get('/', async (req, res) => {
  console.log('Acceso a ruta raíz');
  console.log('Usuario autenticado:', req.session.user ? 'SÍ' : 'NO');
  
  if (!req.session.user || !req.session.user.idToken) {
    return res.redirect('/login');
  }

  // Usuario autenticado - verificar si tiene grupo activo
  try {
    const ApiClient = require('./apiClient');
    const apiClient = new ApiClient(req.session.user.idToken);
    
    const grupoActivoResponse = await apiClient.obtenerGrupoActivo();
    
    if (grupoActivoResponse && grupoActivoResponse.ok && grupoActivoResponse.grupo_activo) {
      // Tiene grupo activo - ir a dashboard
      return res.redirect('/dashboard');
    } else {
      // No tiene grupo activo - ir a onboarding
      return res.redirect('/onboarding-espacios');
    }
  } catch (error) {
    // Si hay error al verificar (incluyendo 404), ir a onboarding
    console.log('ℹ️ No hay grupo activo, redirigiendo a onboarding');
    return res.redirect('/onboarding-espacios');
  }
});

// Auth routes (públicas)
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// === RUTAS PROTEGIDAS (requieren autenticación) ===

// Agenda - protegida
app.get('/agenda', requireAuth, attachApiClient, checkGrupoActivo, checkPermission('agenda.read'), (req, res) => {
  const userPermissions = req.session.user?.permissions || [];
  
  res.render('agenda', {
    currentPath: req.path,
    canViewAgenda: userPermissions.includes('agenda.read') || userPermissions.includes('admin.users'),
    canWriteAgenda: userPermissions.includes('agenda.write') || userPermissions.includes('admin.users'),
    canImport: userPermissions.includes('data.import') || userPermissions.includes('admin.users'),
    canExport: userPermissions.includes('data.export') || userPermissions.includes('admin.users'),
    personalization: req.session.user?.personalization || {},
    idToken: req.session.user?.idToken || ''
  });
});

// Rutas de importar y exportar
app.get('/importar', requireAuth, attachApiClient, checkGrupoActivo, checkPermission('data.import'), (req, res) => {
  res.render('importar', { currentPath: req.path });
});

app.get('/exportar', requireAuth, attachApiClient, checkGrupoActivo, checkPermission('data.export'), (req, res) => {
  res.render('exportar', { currentPath: req.path });
});

// Rutas de calendario
app.get('/calendario/box', requireAuth, attachApiClient, checkGrupoActivo, checkPermission('agenda.read'), (req, res) => {
  const userPermissions = req.session.user?.permissions || [];
  res.render('calendario-box', { 
    currentPath: req.path,
    canEdit: userPermissions.includes('agenda.write') || userPermissions.includes('admin.users')
  });
});

app.get('/calendario/medico', requireAuth, attachApiClient, checkGrupoActivo, checkPermission('agenda.read'), (req, res) => {
  const userPermissions = req.session.user?.permissions || [];
  res.render('calendario-medico', { 
    currentPath: req.path,
    canEdit: userPermissions.includes('agenda.write') || userPermissions.includes('admin.users')
  });
});

// Box routes
const boxRoutes = require('./routes/box');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, boxRoutes);

// Detalle de box
const detalleBoxRoutes = require('./routes/detalle_box');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, detalleBoxRoutes);

// Consultas en curso
const consultasRoutes = require('./routes/consultas');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, consultasRoutes);

// Dashboard
const dashboardRoutes = require('./routes/dashboard');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, dashboardRoutes);

// Historial notificaciones
const notificacionesRoutes = require('./routes/notificaciones');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, notificacionesRoutes);

// Calendario agenda
const calendarioRouter = require('./routes/calendario');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, calendarioRouter);

// Configuración espacios (NO requiere grupo activo - es el onboarding)
const onboardingEspaciosRouter = require('./routes/onboarding-espacios');
app.use('/', requireAuth, attachApiClient, onboardingEspaciosRouter);

// Perfil (NO requiere grupo activo)
app.get('/perfil', requireAuth, attachApiClient, (req, res) => {
  res.render('perfil', {
    currentPath: req.path,
    personalization: req.session.user?.personalization || {},
    idToken: req.session.user?.idToken,
    language: req.session.language || req.language
  });
});

// API de personalización - Versión simple
app.post('/api/personalization', requireAuth, async (req, res) => {
  try {
    console.log('📡 POST /api/personalization - Usuario:', req.session.user?.email);
    console.log('📡 Datos recibidos:', req.body);
    console.log('📡 Parámetros a actualizar:', req.body.parameters);

    // Validación de token
    if (!req.session.user?.idToken) {
      return res.status(401).json({
        ok: false,
        error: 'Usuario no autenticado'
      });
    }

    const API_BASE_URL = process.env.API_BASE_URL;
    console.log('📡 Enviando request a Lambda:', `${API_BASE_URL}/personalization`);

    // Llamada a Lambda
    const response = await fetch(`${API_BASE_URL}/personalization`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parameters: req.body.parameters
      })
    });

    console.log('📥 Response status de Lambda:', response.status);
    const result = await response.json();
    console.log('📥 Response data de Lambda:', result);

    if (response.ok && result.ok) {
      // Actualizar personalización en sesión
      if (result.final_parameters) {
        req.session.user.personalization = result.final_parameters;

        // Manejo adicional de idioma (locale.language)
        const newLang = result.final_parameters['locale.language'];
        if (newLang && typeof newLang === 'string') {
          req.session.language = newLang;

          if (req.i18n?.language !== newLang) {
            try {
              req.i18n.changeLanguage(newLang);
            } catch (e) {
              console.warn('⚠️ No se pudo cambiar idioma en i18n:', e.message);
            }
          }

          // Guardar cookie persistente en el navegador (30 días)
          res.cookie('i18next', newLang, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          });
        }
      }

      // Guardar sesión explícitamente antes de responder
      req.session.save((err) => {
        if (err) {
          console.error('❌ Error guardando sesión:', err);
          return res.status(500).json({
            ok: false,
            error: 'Error guardando la sesión'
          });
        }

        return res.status(200).json({
          ok: true,
          message: 'Personalización actualizada correctamente',
          saved_parameters: result.saved_parameters,
          personalization: req.session.user.personalization
        });
      });

    } else {
      console.error('❌ Error del Lambda:', result);
      return res.status(response.status || 400).json({
        ok: false,
        error: result.error || result.message || 'Error al actualizar personalización'
      });
    }

  } catch (error) {
    console.error('❌ Error en /api/personalization:', error);
    res.status(500).json({
      ok: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Refrescar personalización en sesión
app.post('/api/refresh-personalization', requireAuth, async (req, res) => {
  try {
    const { refreshUserPersonalization } = require('./routes/auth');
    
    const success = await refreshUserPersonalization(req);
    if (success) {
      req.session.save((err) => {
        if (err) {
          console.log('Error guardando sesión:', err);
          return res.status(500).json({ ok: false, error: 'Error guardando sesión' });
        }
        
        console.log('✅ Sesión actualizada correctamente');
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
    console.error('Error en refresh-personalization:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// === RUTAS DE UTILIDAD ===

app.get('/test', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando correctamente',
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