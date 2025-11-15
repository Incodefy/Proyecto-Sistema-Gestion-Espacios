// routes/auth.js
require('dotenv').config();

const express = require("express");
const router = express.Router();
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const fetch = require('node-fetch');
const db = require('../db'); // Asegúrate de importar tu conexión a la base de datos
const requireAuth = require('../middleware/requireAuth');
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION
});

// URLs configurables
const API_BASE_URL = process.env.API_BASE_URL;
const PERMISSIONS_ENDPOINT = process.env.PERMISSIONS_ENDPOINT;
const PERSONALIZATION_ENDPOINT = process.env.PERSONALIZATION_ENDPOINT;

const PERMISSIONS_URL = `${API_BASE_URL}${PERMISSIONS_ENDPOINT}`;
const PERSONALIZATION_URL = `${API_BASE_URL}${PERSONALIZATION_ENDPOINT}`;

console.log('🔗 URLs configuradas:');
console.log('   Permisos:', PERMISSIONS_URL);
console.log('   Personalización:', PERSONALIZATION_URL);

// Función para refrescar personalización del usuario
const refreshUserPersonalization = async (req) => {
  try {
    console.log('🔄 Refrescando personalización para usuario:', req.session.user.email);
    
    const personalizationResponse = await fetch(PERSONALIZATION_URL, {
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`
      }
    });
    
    if (personalizationResponse.ok) {
      const personalizationData = await personalizationResponse.json();
      req.session.user.personalization = personalizationData.final_parameters;
      console.log('✅ Personalización actualizada en sesión:', personalizationData.final_parameters);
      return true;
    } else {
      console.log('❌ Error en respuesta de personalización:', personalizationResponse.status);
      return false;
    }
  } catch (err) {
    console.log('❌ Error refrescando personalización:', err.message);
    return false;
  }
};

// Página login
router.get('/login', (req, res) => {
  if (req.session.user && req.session.user.idToken) {
    return res.redirect('/dashboard');
  }

  res.render('login', {
    error_msg: req.flash('error') || [],
    form_errors: {},
    form_data: {}
  });
});

// Procesar login con Cognito
router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;
    let form_errors = {};
    let error_msg = [];

    if (!correo) form_errors.email = 'El correo electrónico es requerido';
    if (!password) form_errors.password = 'La contraseña es requerida';

    if (Object.keys(form_errors).length > 0) {
      console.warn('⚠️ Errores de validación:', form_errors);
      return res.render('login', {
        error_msg,
        form_errors,
        form_data: { correo }
      });
    }

    console.log('➡️ POST /login - intentando autenticar con Cognito:', correo);

    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: correo,
        PASSWORD: password
      }
    });

    const authResult = await cognitoClient.send(authCommand);
    console.log('🔐 Respuesta de Cognito:', authResult);

    if (authResult.ChallengeName) {
      error_msg.push('Debes cambiar tu contraseña temporal');
      return res.render('login', {
        error_msg,
        form_errors: {},
        form_data: { correo }
      });
    }

    const tokens = authResult.AuthenticationResult;
    if (!tokens) {
      throw new Error('No se recibieron tokens de autenticación');
    }

    const getUserCommand = new GetUserCommand({
      AccessToken: tokens.AccessToken
    });

    const userInfo = await cognitoClient.send(getUserCommand);
    console.log('👤 Información del usuario:', userInfo);

    const userAttributes = {};
    userInfo.UserAttributes.forEach(attr => {
      userAttributes[attr.Name] = attr.Value;
    });

    let idioma = 'es';

    req.session.user = {
      sub: userAttributes.sub,
      username: userInfo.Username,
      email: userAttributes.email,
      idToken: tokens.IdToken,
      accessToken: tokens.AccessToken,
      refreshToken: tokens.RefreshToken,
      nombre: userAttributes.name || userAttributes.email.split('@')[0],
      authTime: new Date().toISOString(),
      idioma: idioma // Guardar idioma en la sesión
    };
    req.session.language = idioma;

    // Obtener permisos y personalización inicial
    try {
      console.log('📡 Obteniendo permisos desde:', PERMISSIONS_URL);
      
      const permissionsResponse = await fetch(PERMISSIONS_URL, {
        headers: { 
          'Authorization': `Bearer ${tokens.IdToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log("permisos: ", req.session.user.permissions)
      
      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        req.session.user.permissions = permissionsData.permissions || [];
        req.session.user.ui_config = permissionsData.ui_config || {};
        console.log('✅ Permisos obtenidos:', req.session.user.permissions);
      } else {
        console.log('⚠️ Error obteniendo permisos:', permissionsResponse.status);
      }
    } catch (err) {
      console.error('❌ Error obteniendo permisos:', err);
      req.session.user.permissions = [];
      req.session.user.ui_config = {};
    }

    try {
      console.log('📡 Obteniendo personalización desde:', PERSONALIZATION_URL);
      const personalizationResponse = await fetch(PERSONALIZATION_URL, {
        headers: { 'Authorization': `Bearer ${tokens.IdToken}` }
      });
      
      if (personalizationResponse.ok) {
        const personalizationData = await personalizationResponse.json();
        req.session.user.personalization = personalizationData.final_parameters;
        console.log('✅ Personalización obtenida:', personalizationData.final_parameters);
      } else {
        console.log('⚠️ No se pudo obtener personalización:', personalizationResponse.status);
        req.session.user.personalization = {};
      }
      
    } catch (err) {
      console.log('❌ Error obteniendo personalización:', err.message);
      req.session.user.personalization = {};
    }

    console.log('✅ Sesión creada:', {
      sub: req.session.user.sub,
      email: req.session.user.email,
      nombre: req.session.user.nombre,
      idioma: req.session.user.idioma
    });

    // Verificar si el usuario tiene un grupo activo
    try {
      console.log('🔍 Verificando grupo activo del usuario...');
      
      const ApiClient = require('../apiClient');
      const apiClient = new ApiClient(tokens.IdToken);
      
      const grupoActivoResponse = await apiClient.obtenerGrupoActivo();
      
      if (grupoActivoResponse && grupoActivoResponse.ok && grupoActivoResponse.grupo_activo) {
        // Usuario tiene grupo activo, cachear en sesión y ir al dashboard
        req.session.grupoActivo = grupoActivoResponse.grupo_activo;
        req.session.grupoActivoVerificado = true;
        req.session.grupoActivoVerificadoEn = Date.now();
        
        console.log(`✅ Grupo activo encontrado: ${grupoActivoResponse.grupo_activo.grupo_id}, redirigiendo a dashboard`);
        req.flash('success', `¡Bienvenido ${req.session.user.nombre}!`);
        res.redirect('/dashboard');
      } else {
        // Usuario no tiene grupo activo, ir a onboarding
        req.session.grupoActivo = null;
        req.session.grupoActivoVerificado = true;
        req.session.grupoActivoVerificadoEn = Date.now();
        
        console.log('⚠️ Usuario sin grupo activo, redirigiendo a onboarding');
        req.flash('success', `¡Bienvenido ${req.session.user.nombre}! Por favor, configura tu primer espacio.`);
        res.redirect('/onboarding-espacios');
      }
      
    } catch (error) {
      // Si hay error al verificar grupo (ej: 404), ir a onboarding
      if (error.response?.status === 404) {
        req.session.grupoActivo = null;
        req.session.grupoActivoVerificado = true;
        req.session.grupoActivoVerificadoEn = Date.now();
        
        console.log('ℹ️ No hay grupo activo (404), redirigiendo a onboarding');
        req.flash('success', `¡Bienvenido ${req.session.user.nombre}! Por favor, configura tu primer espacio.`);
        res.redirect('/onboarding-espacios');
      } else {
        console.error('❌ Error verificando grupo activo:', error.message);
        // Ir a onboarding como medida de seguridad
        req.flash('success', `¡Bienvenido ${req.session.user.nombre}! Por favor, configura tu primer espacio.`);
        res.redirect('/onboarding-espacios');
      }
    }

  } catch (err) {
    console.error('❌ Error en login:', err);
    
    let errorMessage = 'Error interno en el login';
    let form_errors = {};
    
    if (err.name === 'NotAuthorizedException') {
      errorMessage = 'Credenciales incorrectas';
      form_errors = { 
        email: 'Usuario o contraseña incorrectos',
        password: 'Usuario o contraseña incorrectos'
      };
    } else if (err.name === 'UserNotConfirmedException') {
      errorMessage = 'Tu cuenta no está confirmada. Revisa tu email.';
    } else if (err.name === 'UserNotFoundException') {
      errorMessage = 'No existe una cuenta con este email';
      form_errors = { email: 'Email no registrado' };
    } else if (err.name === 'TooManyRequestsException') {
      errorMessage = 'Demasiados intentos. Intenta más tarde.';
    }

    res.render('login', {
      error_msg: [errorMessage],
      form_errors: form_errors,
      form_data: { correo: req.body.correo || '' }
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  console.log('📤 Usuario cerrando sesión:', req.session.user?.email);
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al destruir sesión:', err);
    }
    // Limpiar la cookie de sesión (nombre personalizado 'sessionId')
    res.clearCookie('sessionId');
    // También limpiar cookie de idioma si existe
    res.clearCookie('i18next');
    res.redirect('/login');
  });
});

// Endpoint para verificar estado de autenticación
router.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  res.json({
    user: {
      sub: req.session.user.sub,
      email: req.session.user.email,
      nombre: req.session.user.nombre,
      username: req.session.user.username,
      idioma: req.session.user.idioma
    }
  });
});

// Exportar el router y la función de refresh
module.exports = router;
module.exports.refreshUserPersonalization = refreshUserPersonalization;