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
  resave: true, // Forzar guardado de sesión en cada request
  saveUninitialized: false,
  name: 'sessionId',
  rolling: true, // Renovar cookie en cada request
  cookie: {
    httpOnly: true,
    secure: false, // Deshabilitado para desarrollo local
    sameSite: 'lax',
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
const nomenclaturaMiddleware = require('./middleware/nomenclatura');

// === MIDDLEWARES GLOBALES DE PERSONALIZACIÓN ===
// Estos se ejecutarán en todas las rutas que vengan después de ellos.

// Middleware de logging para debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log('\n' + '='.repeat(80));
  console.log(`[${timestamp}] 🌐 ${req.method} ${req.path}`);
  console.log(`📧 Usuario: ${req.session?.user?.email || 'NO AUTENTICADO'}`);
  console.log(`🆔 Session ID: ${req.sessionID || 'NO SESSION'}`);
  console.log(`🔐 Token presente: ${req.session?.user?.idToken ? 'SÍ' : 'NO'}`);
  console.log(`📦 Grupo activo: ${req.session?.grupoActivo?.grupo_id || 'NINGUNO'}`);
  console.log('='.repeat(80));

  // Interceptar res.redirect para ver qué se está enviando
  const originalRedirect = res.redirect;
  res.redirect = function(url) {
    console.log(`\n🔀 REDIRECT INTERCEPTADO:`);
    console.log(`   📍 Destino: ${url}`);
    console.log(`   🆔 Session ID: ${req.sessionID}`);
    console.log(`   📧 Usuario en sesión: ${req.session?.user?.email || 'NINGUNO'}`);
    console.log(`   🔢 Status Code: ${this.statusCode || 302}`);
    return originalRedirect.call(this, url);
  };

  // Interceptar res.render para ver qué vistas se renderizan
  const originalRender = res.render;
  res.render = function(view, locals) {
    console.log(`\n🎨 RENDER INTERCEPTADO:`);
    console.log(`   📄 Vista: ${view}`);
    console.log(`   🆔 Session ID: ${req.sessionID}`);
    return originalRender.call(this, view, locals);
  };

  // Log cuando la respuesta termina
  res.on('finish', () => {
    console.log(`\n✅ RESPUESTA COMPLETADA:`);
    console.log(`   🔢 Status Code: ${res.statusCode}`);
    console.log(`   📏 Content-Length: ${res.get('Content-Length') || 'N/A'}`);
    console.log(`   📍 Location header: ${res.get('Location') || 'N/A'}`);
    console.log('─'.repeat(80) + '\n');
  });

  next();
});

app.use(personalizationMiddleware);
app.use(setLanguage);

// Inyectar funciones de permisos en las vistas
const injectPermissions = require('./middleware/injectPermissions');
app.use(injectPermissions);


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

// Rutas de registro y verificación de email (públicas)
const signupRoutes = require('./routes/signup');
const verifyEmailRoutes = require('./routes/verify-email');
app.use('/auth', signupRoutes);
app.use('/auth', verifyEmailRoutes);

// API routes (requieren autenticación)
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// API especialidades, ocupantes, tipos-instrumentos e instrumentos (requieren autenticación)
const apiEspecialidadesRoutes = require('./routes/api-especialidades');
const apiOcupantesRoutes = require('./routes/api-ocupantes');
const apiTiposInstrumentosRoutes = require('./routes/api-tipos-instrumentos');
const apiInstrumentosRoutes = require('./routes/api-instrumentos');
app.use('/api/grupos', apiEspecialidadesRoutes);
app.use('/api/grupos', apiOcupantesRoutes);
app.use('/api/grupos', apiTiposInstrumentosRoutes);
app.use('/api/grupos', apiInstrumentosRoutes);

// Aceptar invitación (COMPLETAMENTE PÚBLICO - debe ir ANTES de requireAuth global)
const aceptarInvitacionRoutes = require('./routes/aceptar-invitacion');
app.use('/aceptar-invitacion', aceptarInvitacionRoutes);

// Onboarding espacios (requiere auth pero NO grupo activo)
const onboardingEspaciosRouter = require('./routes/onboarding-espacios');
app.use('/onboarding-espacios', requireAuth, attachApiClient, onboardingEspaciosRouter);

// === RUTAS PROTEGIDAS CON GRUPO ACTIVO ===
// Middleware de nomenclatura solo para rutas con grupo activo
// Helper para verificar permisos del usuario en el grupo activo
function userHasPermission(req, permission) {
  // Admin siempre tiene acceso
  if (req.session.user?.has_admin_permissions) {
    return true;
  }
  
  // Obtener grupo activo
  const grupoActivo = req.session.grupoActivo;
  if (!grupoActivo) return false;
  
  const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo.grupo_id;
  if (!grupoId) return false;
  
  // Verificar permisos del grupo
  const permissionsByGroup = req.session.user?.permissions_by_group || {};
  const groupPermissions = permissionsByGroup[grupoId];
  
  if (!groupPermissions || !groupPermissions.permissions) return false;
  
  return groupPermissions.permissions.includes(permission);
}

// Agenda - protegida
app.get('/agenda', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, checkPermission('agenda.read'), (req, res) => {
  res.render('agenda', {
    currentPath: req.path,
    canViewAgenda: userHasPermission(req, 'agenda.read'),
    canWriteAgenda: userHasPermission(req, 'agenda.write'),
    canImport: userHasPermission(req, 'data.import'),
    canExport: userHasPermission(req, 'data.export'),
    personalization: res.locals.personalization || {},
    idToken: req.session.user?.idToken || ''
    // nomenclatura ya está en res.locals gracias al middleware
  });
});

// Rutas de importar y exportar
app.get('/importar', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, checkPermission('data.import'), (req, res) => {
  res.render('importar', { currentPath: req.path });
});

app.get('/exportar', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, checkPermission('data.export'), (req, res) => {
  res.render('exportar', { currentPath: req.path });
});

// Rutas de calendario
app.get('/calendario/box', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, checkPermission('agenda.read'), (req, res) => {
  res.render('calendario-box', { 
    currentPath: req.path,
    canEdit: userHasPermission(req, 'agenda.write')
  });
});

app.get('/calendario/medico', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, checkPermission('agenda.read'), (req, res) => {
  res.render('calendario-medico', { 
    currentPath: req.path,
    canEdit: userHasPermission(req, 'agenda.write')
  });
});

// Box routes
const boxRoutes = require('./routes/box');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, boxRoutes);

// Detalle de box
const detalleBoxRoutes = require('./routes/detalle_box');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, detalleBoxRoutes);

// Consultas en curso
const consultasRoutes = require('./routes/consultas');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, consultasRoutes);

// Dashboard
const dashboardRoutes = require('./routes/dashboard');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, dashboardRoutes);

// Historial notificaciones
const notificacionesRoutes = require('./routes/notificaciones');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, notificacionesRoutes);

// Test notificaciones (development only)
if (process.env.NODE_ENV === 'development') {
  const testNotificacionesRoutes = require('./routes/test-notificaciones');
  app.use('/', testNotificacionesRoutes);
}

// Calendario agenda
const calendarioRouter = require('./routes/calendario');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, calendarioRouter);

const gestionGrupoRoutes = require('./routes/gestionGrupo');
app.use('/', requireAuth, attachApiClient, checkGrupoActivo, nomenclaturaMiddleware, gestionGrupoRoutes);

// Ruta de test para instrumentos
const testInstrumentosRoutes = require('./routes/test-instrumentos');
app.use('/', testInstrumentosRoutes);

// Proxy para instrumentos (permite que el frontend llame a /groups/.../instrumentos)
const instrumentosProxyRoutes = require('./routes/instrumentos-proxy');
app.use('/', instrumentosProxyRoutes);

// Configuración espacios (NO requiere grupo activo - es el onboarding)

// Perfil (NO requiere grupo activo)
app.get('/perfil', requireAuth, attachApiClient, (req, res) => {
  console.log('📄 GET /perfil - Usuario:', req.session.user?.email);
  console.log('📄 req.session.user.personalization:', req.session.user?.personalization);
  console.log('📄 res.locals.personalization:', res.locals.personalization);
  
  res.render('perfil', {
    currentPath: req.path,
    personalization: res.locals.personalization || req.session.user?.personalization || {},
    idToken: req.session.user?.idToken,
    language: req.session.language || req.language
  });
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

// Debug endpoint para verificar personalización
app.get('/debug/personalization', requireAuth, async (req, res) => {
  try {
    const API_BASE_URL = process.env.API_BASE_URL;
    const url = `${API_BASE_URL}/personalization`;
    
    console.log('🔍 DEBUG: Llamando a:', url);
    console.log('🔍 DEBUG: Token:', req.session.user?.idToken?.substring(0, 20) + '...');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`
      }
    });
    
    const data = await response.json();
    
    console.log('🔍 DEBUG: Status:', response.status);
    console.log('🔍 DEBUG: Respuesta completa:', JSON.stringify(data, null, 2));
    
    res.json({
      status: response.status,
      ok: response.ok,
      data: data,
      session_personalization: req.session.user?.personalization,
      locals_personalization: res.locals.personalization
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

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