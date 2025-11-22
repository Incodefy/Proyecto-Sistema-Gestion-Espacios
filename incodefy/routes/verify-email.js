// routes/verify-email.js - Verificación de email y registro en SES
const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.AWS_REGION || 'us-east-2' });
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION || 'us-east-2' });

// GET /auth/verify-email - Verificar email del usuario
router.get('/verify-email', async (req, res) => {
  const { token, email } = req.query;

  if (!email) {
    return res.render('email-verification-result', {
      success: false,
      message: 'Email no especificado',
      i18n: req.i18n,
      t: req.t
    });
  }

  try {
    console.log('🔍 Verificando email para:', email);

    // Si viene sin token, significa que el usuario hizo clic en el email de SES
    // Solo necesitamos marcar como verificado en Cognito
    if (!token) {
      console.log('📧 Verificación desde email de SES');
      
      // Marcar email como verificado en Cognito
      try {
        await cognito.adminUpdateUserAttributes({
          UserPoolId: process.env.USER_POOL_ID,
          Username: email,
          UserAttributes: [
            {
              Name: 'email_verified',
              Value: 'true'
            }
          ]
        }).promise();

        console.log('✅ Email verificado en Cognito:', email);

        res.render('email-verification-result', {
          success: true,
          message: '¡Tu cuenta ha sido verificada exitosamente! Ya puedes iniciar sesión y enviar/recibir invitaciones.',
          email: email,
          i18n: req.i18n,
          t: req.t
        });
      } catch (cognitoError) {
        console.error('❌ Error verificando en Cognito:', cognitoError);
        res.render('email-verification-result', {
          success: false,
          message: 'Error al verificar la cuenta en el sistema',
          i18n: req.i18n,
          t: req.t
        });
      }
      return;
    }

    // Si viene con token, es nuestro sistema de verificación personalizado

    // Buscar token en DynamoDB
    const tokenData = await dynamodb.get({
      TableName: process.env.PARAMETERS_TABLE || 'incodefy-dev-parameters',
      Key: {
        user_sub: `EMAIL_VERIFICATION#${email}`,
        parameter_key: 'TOKEN'
      }
    }).promise();

    if (!tokenData.Item) {
      return res.render('email-verification-result', {
        success: false,
        message: 'El enlace de verificación no es válido o ya fue utilizado',
        i18n: req.i18n,
        t: req.t
      });
    }

    // Verificar que el token coincida
    if (tokenData.Item.token !== token) {
      return res.render('email-verification-result', {
        success: false,
        message: 'El token de verificación no es válido',
        i18n: req.i18n,
        t: req.t
      });
    }

    // Verificar que el token no haya expirado
    if (Date.now() > tokenData.Item.expires_at) {
      return res.render('email-verification-result', {
        success: false,
        message: 'El enlace de verificación ha expirado. Por favor, solicita uno nuevo.',
        i18n: req.i18n,
        t: req.t
      });
    }

    // Marcar email como verificado en Cognito
    await cognito.adminUpdateUserAttributes({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      UserAttributes: [
        {
          Name: 'email_verified',
          Value: 'true'
        }
      ]
    }).promise();

    console.log('✅ Email verificado en Cognito:', email);

    // Verificar email en SES (para poder enviar/recibir emails)
    try {
      await ses.verifyEmailIdentity({
        EmailAddress: email
      }).promise();

      console.log('📧 Email verificado en SES:', email);
    } catch (sesError) {
      console.warn('⚠️ No se pudo verificar en SES (puede que ya esté verificado):', sesError.message);
      // Continuar aunque falle SES, ya que el usuario puede verificar manualmente
    }

    // Eliminar el token usado
    await dynamodb.delete({
      TableName: process.env.PARAMETERS_TABLE || 'incodefy-dev-parameters',
      Key: {
        user_sub: `EMAIL_VERIFICATION#${email}`,
        parameter_key: 'TOKEN'
      }
    }).promise();

    console.log('🎉 Verificación completada para:', email);

    res.render('email-verification-result', {
      success: true,
      message: '¡Tu cuenta ha sido verificada exitosamente! Ya puedes iniciar sesión y enviar/recibir invitaciones.',
      email: email,
      i18n: req.i18n,
      t: req.t
    });

  } catch (error) {
    console.error('❌ Error verificando email:', error);
    
    res.render('email-verification-result', {
      success: false,
      message: 'Ocurrió un error al verificar tu cuenta. Por favor, contacta con soporte.',
      i18n: req.i18n,
      t: req.t
    });
  }
});

module.exports = router;
