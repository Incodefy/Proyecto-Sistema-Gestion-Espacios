// routes/auth.js
require('dotenv').config();

const express = require("express");
const router = express.Router();
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const fetch = require('node-fetch');
const { sendPasswordResetEmail, sendPasswordChangedConfirmation } = require('../utils/emailService');
const { createVerificationCode, verifyCode, consumeCode } = require('../utils/verificationCodes');
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
    // Si ya está logueado y hay redirect, ir ahí; sino al dashboard
    const redirect = req.query.redirect;
    return res.redirect(redirect || '/dashboard');
  }

  // Debug: Verificar que i18n, csrf y csp estén disponibles
  console.log('🔍 Debug login - res.locals:', {
    hasT: typeof res.locals.t,
    hasCsrfToken: typeof res.locals.csrfToken,
    hasCspNonce: typeof res.locals.cspNonce,
    hasI18n: typeof res.locals.i18n,
    reqT: typeof req.t,
    reqI18n: typeof req.i18n
  });

  res.render('login', {
    error_msg: req.flash('error') || [],
    success_msg: req.flash('success') || [],
    verification_email_sent: req.flash('verification_email_sent') || [],
    form_errors: {},
    form_data: {},
    redirect: req.query.redirect || null
  });
});

// Procesar login con Cognito
router.post('/login', async (req, res) => {
  try {
    const { correo, password, redirect } = req.body;
    let form_errors = {};
    let error_msg = [];

    if (!correo) form_errors.email = 'El correo electrónico es requerido';
    if (!password) form_errors.password = 'La contraseña es requerida';

    if (Object.keys(form_errors).length > 0) {
      console.warn('⚠️ Errores de validación:', form_errors);
      return res.render('login', {
        error_msg,
        form_errors,
        form_data: { correo },
        redirect: redirect || null
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
        form_data: { correo },
        redirect: redirect || null
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
        // La nueva API ya no devuelve todos los permisos, solo información de membresías
        req.session.user.groups = permissionsData.groups || [];
        req.session.user.has_admin_permissions = permissionsData.has_admin_permissions || false;
        // Mantener array vacío para compatibilidad, ahora se verifican permisos individualmente
        req.session.user.permissions = [];
        console.log('✅ Membresías obtenidas:', req.session.user.groups.length);
        console.log('✅ Tiene permisos admin:', req.session.user.has_admin_permissions);
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

    // Obtener permisos del usuario
    try {
      console.log('📡 Obteniendo permisos del usuario...');
      const MY_PERMISSIONS_URL = `${process.env.API_BASE_URL}/my-permissions`;
      const permissionsResponse = await fetch(MY_PERMISSIONS_URL, {
        headers: { 'Authorization': `Bearer ${tokens.IdToken}` }
      });
      
      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        const data = permissionsData.data || permissionsData;
        
        req.session.user.groups = data.groups || [];
        req.session.user.has_admin_permissions = data.has_admin_permissions || false;
        req.session.user.permissions_by_group = data.permissions_by_group || {};
        
        console.log(`✅ Permisos: ${data.groups?.length || 0} grupos, Admin: ${data.has_admin_permissions}`);
      }
    } catch (err) {
      console.log('⚠️ Error obteniendo permisos:', err.message);
      req.session.user.groups = [];
      req.session.user.has_admin_permissions = false;
      req.session.user.permissions_by_group = {};
    }

    // Obtener grupo activo
    try {
      const ApiClientV2 = require('../apiClientV2');
      const apiClient = new ApiClientV2(tokens.IdToken);
      const grupoActivoResponse = await apiClient.obtenerGrupoActivo();
      
      if (grupoActivoResponse?.ok && grupoActivoResponse.grupo_activo) {
        req.session.grupoActivo = grupoActivoResponse.grupo_activo;
        req.session.grupoActivoVerificado = true;
        req.session.grupoActivoVerificadoEn = Date.now();
        console.log(`✅ Grupo activo: ${grupoActivoResponse.grupo_activo.grupo_id}`);
      } else {
        req.session.grupoActivo = null;
        req.session.grupoActivoVerificado = true;
        req.session.grupoActivoVerificadoEn = Date.now();
        console.log('⚠️ Sin grupo activo');
      }
    } catch (error) {
      req.session.grupoActivo = null;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      console.log('⚠️ Error verificando grupo activo:', error.message);
    }

    // GUARDAR SESIÓN EXPLÍCITAMENTE antes de redirect
    console.log('🔄 Iniciando guardado de sesión...');
    console.log('📊 Estado sesión antes de guardar:', {
      hasUser: !!req.session.user,
      hasToken: !!req.session.user?.idToken,
      hasGrupoActivo: !!req.session.grupoActivo,
      grupoId: req.session.grupoActivo?.grupo_id
    });

    req.session.save((err) => {
      if (err) {
        console.error('❌ ERROR CRÍTICO guardando sesión:', err);
        console.error('❌ Stack:', err.stack);
        return res.render('login', {
          error_msg: ['Error al guardar la sesión'],
          form_errors: {},
          form_data: { correo },
          redirect: redirect || null
        });
      }

      console.log('✅ Sesión guardada exitosamente');
      console.log('📊 Sesión ID:', req.sessionID);
      
      // Decidir a dónde redirigir
      let redirectUrl;
      if (redirect) {
        redirectUrl = redirect;
        console.log(`🔀 Redirect específico: ${redirect}`);
      } else if (req.session.grupoActivo) {
        redirectUrl = '/dashboard';
        console.log('🎯 Usuario con grupo activo, redirigiendo a dashboard');
      } else {
        redirectUrl = '/onboarding-espacios';
        console.log('🎯 Usuario sin grupo activo, redirigiendo a onboarding');
      }

      console.log(`🚀 ENVIANDO REDIRECT 302 a: ${redirectUrl}`);
      console.log('=' .repeat(80));
      return res.redirect(redirectUrl);
    });

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
      form_data: { correo: req.body.correo || '' },
      redirect: req.body.redirect || null
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  console.log('📤 Usuario cerrando sesión:', req.session.user?.email);
  
  // Guardar email y redirect para log antes de destruir sesión
  const userEmail = req.session.user?.email;
  const redirectUrl = req.query.redirect || '/login?logout=true';
  
  // Destruir sesión del servidor
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Error al destruir sesión:', err);
    } else {
      console.log('✅ Sesión destruida para:', userEmail);
    }
    
    // Limpiar TODAS las cookies
    res.clearCookie('sessionId', { path: '/' });
    res.clearCookie('connect.sid', { path: '/' }); // Cookie por defecto de express-session
    res.clearCookie('i18next', { path: '/' });
    
    // Headers para prevenir cache de la página de logout
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Clear-Site-Data': '"cache", "cookies", "storage"' // HTML5 API para limpiar todo
    });
    
    // Redirigir a la URL especificada o al login
    res.redirect(redirectUrl);
  });
});

// ============ RECUPERACIÓN DE CONTRASEÑA ============

// Página de recuperación de contraseña
router.get('/forgot-password', (req, res) => {
  // Si ya está logueado, redirigir al dashboard
  if (req.session.user && req.session.user.idToken) {
    return res.redirect('/dashboard');
  }

  res.render('forgot-password', {
    error_msg: req.flash('error') || [],
    success_msg: req.flash('success') || []
  });
});

// Enviar código de verificación
router.post('/forgot-password', async (req, res) => {
  try {
    const { correo } = req.body;

    if (!correo) {
      return res.status(400).json({
        success: false,
        error: 'El correo electrónico es requerido'
      });
    }

    console.log('📧 Solicitud de recuperación de contraseña para:', correo);

    // Verificar que el usuario existe en Cognito
    try {
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: correo
      });
      
      await cognitoClient.send(getUserCommand);
      console.log('✅ Usuario encontrado en Cognito:', correo);
    } catch (error) {
      console.error('❌ Usuario no encontrado:', error.name);
      if (error.name === 'UserNotFoundException') {
        return res.status(404).json({
          success: false,
          error: 'No existe una cuenta con ese correo electrónico'
        });
      }
      throw error; // Re-throw si es otro tipo de error
    }

    // Generar código de verificación personalizado (6 dígitos, 15 minutos de expiración)
    const code = createVerificationCode(correo);
    console.log('🔐 Código de verificación generado para:', correo);

    // Enviar email con el código usando AWS SES
    await sendPasswordResetEmail(correo, code);
    console.log('✅ Email de recuperación enviado a:', correo);

    // Retornar éxito al cliente
    return res.json({
      success: true,
      message: 'Código de verificación enviado a tu correo electrónico'
    });

  } catch (error) {
    console.error('❌ Error al procesar recuperación de contraseña:', error);
    
    let errorMessage = 'Error al enviar el código de verificación';
    
    // Manejar errores específicos
    if (error.name === 'LimitExceededException') {
      errorMessage = 'Has excedido el límite de intentos. Por favor, intenta más tarde';
    } else if (error.name === 'InvalidParameterException') {
      errorMessage = 'El correo electrónico no es válido';
    } else if (error.code === 'MessageRejected') {
      errorMessage = 'No se pudo enviar el correo. Verifica que tu email sea válido';
    }

    return res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

// Nueva ruta: Verificar código sin cambiar contraseña
router.post('/verify-code', async (req, res) => {
  try {
    const { correo, codigo } = req.body;

    if (!correo || !codigo) {
      return res.status(400).json({
        success: false,
        error: 'El correo y el código son requeridos'
      });
    }

    console.log('🔍 Verificando código para:', correo);

    // Verificar el código personalizado (sin consumir)
    const codeValidation = verifyCode(correo, codigo, false);
    
    if (!codeValidation.valid) {
      console.error('❌ Código inválido:', codeValidation.error);
      
      let errorMessage = 'El código de verificación es incorrecto';
      
      if (codeValidation.error === 'Code not found') {
        errorMessage = 'No existe un código de verificación para este correo. Solicita uno nuevo';
      } else if (codeValidation.error === 'Code expired') {
        errorMessage = 'El código de verificación ha expirado. Solicita uno nuevo';
      } else if (codeValidation.error === 'Too many attempts') {
        errorMessage = 'Has excedido el límite de intentos. Solicita un nuevo código';
      }
      
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    console.log('✅ Código verificado correctamente');

    return res.json({
      success: true,
      message: 'Código verificado correctamente'
    });

  } catch (error) {
    console.error('❌ Error al verificar código:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Error al verificar el código'
    });
  }
});

// Restablecer contraseña con código de verificación
router.post('/reset-password', async (req, res) => {
  try {
    const { correo, codigo, password } = req.body;

    // Validaciones
    if (!correo || !codigo || !password) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos'
      });
    }

    console.log('🔐 Intentando restablecer contraseña para:', correo);

    // Verificar el código de verificación personalizado (consume = true)
    const codeValidation = verifyCode(correo, codigo, true);
    
    if (!codeValidation.valid) {
      console.error('❌ Código inválido:', codeValidation.error);
      
      let errorMessage = 'El código de verificación es incorrecto';
      
      if (codeValidation.error === 'Code not found') {
        errorMessage = 'No existe un código de verificación para este correo. Solicita uno nuevo';
      } else if (codeValidation.error === 'Code expired') {
        errorMessage = 'El código de verificación ha expirado. Solicita uno nuevo';
      } else if (codeValidation.error === 'Too many attempts') {
        errorMessage = 'Has excedido el límite de intentos. Solicita un nuevo código';
      }
      
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    console.log('✅ Código verificado correctamente');

    // Cambiar la contraseña en Cognito usando AdminSetUserPassword
    // Esto permite establecer una contraseña sin necesitar el código de Cognito
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: correo,
      Password: password,
      Permanent: true // Contraseña permanente, no temporal
    });

    await cognitoClient.send(setPasswordCommand);
    console.log('✅ Contraseña actualizada en Cognito para:', correo);

    // Enviar email de confirmación de cambio de contraseña
    sendPasswordChangedConfirmation(correo).catch(err => {
      console.error('⚠️ No se pudo enviar email de confirmación:', err.message);
      // No detenemos el flujo si falla el email de confirmación
    });

    return res.json({
      success: true,
      message: 'Contraseña restablecida correctamente'
    });

  } catch (error) {
    console.error('❌ Error al restablecer contraseña:', error);
    
    let errorMessage = 'Error al restablecer la contraseña';
    
    // Manejar errores específicos de Cognito
    if (error.name === 'UserNotFoundException') {
      errorMessage = 'No existe una cuenta con ese correo electrónico';
    } else if (error.name === 'InvalidPasswordException') {
      errorMessage = 'La contraseña no cumple con los requisitos de seguridad';
    } else if (error.name === 'LimitExceededException') {
      errorMessage = 'Has excedido el límite de intentos. Por favor, intenta más tarde';
    } else if (error.name === 'InvalidParameterException') {
      errorMessage = 'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales';
    }

    return res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

// ============ RENOVACIÓN DE TOKEN ============
/**
 * Endpoint para renovar el token JWT usando el refreshToken
 * Cognito permite renovar tokens sin requerir credenciales
 * El refreshToken es válido por 30 días
 */
router.post('/refresh-token', async (req, res) => {
  try {
    // Verificar que existe una sesión con refreshToken
    if (!req.session.user?.refreshToken) {
      console.warn('⚠️ Intento de refresh sin refreshToken en sesión');
      return res.status(401).json({ 
        ok: false, 
        error: 'No refresh token available',
        shouldRelogin: true 
      });
    }

    const refreshToken = req.session.user.refreshToken;
    console.log('🔄 Renovando token para usuario:', req.session.user.email);

    // Usar el flujo REFRESH_TOKEN_AUTH de Cognito
    const refreshCommand = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    });

    const authResult = await cognitoClient.send(refreshCommand);
    const tokens = authResult.AuthenticationResult;

    if (!tokens || !tokens.IdToken) {
      throw new Error('No se recibieron tokens válidos en la respuesta');
    }

    // Actualizar tokens en la sesión
    // IMPORTANTE: El refreshToken NO cambia, Cognito devuelve el mismo
    req.session.user.idToken = tokens.IdToken;
    req.session.user.accessToken = tokens.AccessToken;
    req.session.user.authTime = new Date().toISOString();

    console.log('✅ Token renovado exitosamente para:', req.session.user.email);

    return res.json({ 
      ok: true, 
      message: 'Token refreshed successfully',
      authTime: req.session.user.authTime
    });

  } catch (error) {
    console.error('❌ Error al renovar token:', error.message);
    
    // Si el refreshToken también expiró o es inválido, el usuario debe hacer login
    if (error.name === 'NotAuthorizedException' || error.message.includes('Invalid Refresh Token')) {
      console.warn('🔒 RefreshToken inválido o expirado, requiere nuevo login');
      
      // Limpiar sesión
      req.session.destroy();
      
      return res.status(401).json({ 
        ok: false, 
        error: 'Refresh token expired',
        shouldRelogin: true,
        message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      });
    }

    // Otros errores (red, configuración, etc)
    return res.status(500).json({ 
      ok: false, 
      error: 'Failed to refresh token',
      message: 'Error al renovar la sesión. Intenta nuevamente.'
    });
  }
});

// Endpoint para verificar estado de autenticación
router.get('/profile', (req, res) => {
  // Si no hay sesión, devolver 401
  if (!req.session.user) {
    return res.status(401).json({ 
      error: 'No autenticado',
      authenticated: false 
    });
  }
  
  // Headers anti-cache para esta respuesta también
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.json({
    authenticated: true,
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