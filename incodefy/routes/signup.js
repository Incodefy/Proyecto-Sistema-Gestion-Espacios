// routes/signup.js - Manejo del registro de usuarios
const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.AWS_REGION || 'us-east-2' });
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-2' });

// GET /auth/signup - Mostrar formulario de registro
router.get('/signup', (req, res) => {
  res.render('signup', {
    error_msg: req.flash('error'),
    success_msg: req.flash('success'),
    form_data: req.flash('form_data')[0] || {},
    i18n: req.i18n,
    t: req.t
  });
});

// POST /auth/signup - Procesar registro
router.post('/signup', async (req, res) => {
  const { nombre, email, password, confirm_password } = req.body;

  try {
    // Validaciones básicas
    if (!nombre || nombre.trim().length < 2) {
      req.flash('error', 'El nombre debe tener al menos 2 caracteres');
      req.flash('form_data', { nombre, email });
      return res.redirect('/auth/signup');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      req.flash('error', 'Ingresa un correo electrónico válido');
      req.flash('form_data', { nombre, email });
      return res.redirect('/auth/signup');
    }

    if (password !== confirm_password) {
      req.flash('error', 'Las contraseñas no coinciden');
      req.flash('form_data', { nombre, email });
      return res.redirect('/auth/signup');
    }

    // Validar requisitos de contraseña de Cognito
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      req.flash('error', 'La contraseña no cumple con los requisitos de seguridad');
      req.flash('form_data', { nombre, email });
      return res.redirect('/auth/signup');
    }

    console.log('📝 Intentando registrar usuario:', email);

    // Verificar si el usuario ya existe
    try {
      await cognito.adminGetUser({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email
      }).promise();

      req.flash('error', 'Ya existe una cuenta con este correo electrónico');
      req.flash('form_data', { nombre, email });
      return res.redirect('/auth/signup');
    } catch (err) {
      // Usuario no existe, continuar con el registro
      if (err.code !== 'UserNotFoundException') {
        throw err;
      }
    }

    // Crear usuario en Cognito
    const createUserParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'false' },
        { Name: 'name', Value: nombre }
      ],
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS' // No enviar email automático de Cognito
    };

    const createUserResult = await cognito.adminCreateUser(createUserParams).promise();
    console.log('✅ Usuario creado en Cognito:', email);

    // Establecer la contraseña permanente
    await cognito.adminSetUserPassword({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    }).promise();

    // Verificar si el email ya está verificado en SES
    let emailYaVerificado = false;
    try {
      const identityVerification = await ses.getIdentityVerificationAttributes({
        Identities: [email]
      }).promise();

      const verificationStatus = identityVerification.VerificationAttributes?.[email]?.VerificationStatus;
      emailYaVerificado = verificationStatus === 'Success';
      
      if (emailYaVerificado) {
        console.log('✅ Email ya está verificado en SES:', email);
      } else {
        console.log('📧 Email no verificado en SES, status:', verificationStatus || 'No existe');
      }
    } catch (checkError) {
      console.error('⚠️ Error verificando estado en SES:', checkError.message);
    }

    // Solo solicitar verificación si no está verificado
    if (!emailYaVerificado) {
      try {
        await ses.verifyEmailIdentity({
          EmailAddress: email
        }).promise();
        console.log('📧 Email de verificación de SES enviado a:', email);
        
        req.flash('success', '¡Cuenta creada! Revisa tu correo para verificar tu dirección de email (revisa spam también).');
        return res.redirect('/login');
      } catch (sesError) {
        console.error('⚠️ Error solicitando verificación SES:', sesError.message);
        req.flash('success', '¡Cuenta creada! Por favor contacta al administrador para verificar tu email.');
        return res.redirect('/login');
      }
    } else {
      // Email ya verificado, no enviar correo
      console.log('✅ Email ya verificado, omitiendo envío de correo de verificación');
      req.flash('success', '¡Cuenta creada exitosamente! Tu email ya está verificado.');
      return res.redirect('/login');
    }

  } catch (error) {
    console.error('❌ Error en registro:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Si el usuario ya fue creado pero falló el envío del email, eliminar el usuario
    if (email && error.code !== 'UsernameExistsException') {
      try {
        await cognito.adminDeleteUser({
          UserPoolId: process.env.USER_POOL_ID,
          Username: email
        }).promise();
        console.log('🗑️ Usuario eliminado debido a error en el proceso');
      } catch (deleteError) {
        console.error('⚠️ No se pudo eliminar el usuario:', deleteError.message);
      }
    }
    
    let errorMessage = 'Ocurrió un error al crear la cuenta. Por favor, intenta nuevamente.';
    
    if (error.code === 'UsernameExistsException') {
      errorMessage = 'Ya existe una cuenta con este correo electrónico';
    } else if (error.code === 'InvalidPasswordException') {
      errorMessage = 'La contraseña no cumple con los requisitos de seguridad';
    } else if (error.code === 'InvalidParameterException') {
      errorMessage = 'Uno o más parámetros son inválidos';
    }

    req.flash('error', errorMessage);
    req.flash('form_data', { nombre, email });
    res.redirect('/auth/signup');
  }
});

module.exports = router;
