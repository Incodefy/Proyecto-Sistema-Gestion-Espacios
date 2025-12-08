// utils/emailService.js
require('dotenv').config();
const AWS = require('aws-sdk');

// Configurar SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-1'
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'incodefy2025@gmail.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Enviar email de código de recuperación de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} code - Código de verificación
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendPasswordResetEmail(email, code) {
  const htmlBody = getPasswordResetTemplate(email, code);
  
  const params = {
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Código de Recuperación de Contraseña - Incodefy',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: `Tu código de recuperación de contraseña es: ${code}\n\nEste código expira en 15 minutos.\n\nSi no solicitaste este cambio, ignora este correo.`,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    console.log('📧 Enviando email de recuperación a:', email);
    const result = await ses.sendEmail(params).promise();
    console.log('✅ Email enviado exitosamente:', result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    throw error;
  }
}

/**
 * Template HTML para email de recuperación de contraseña
 */
function getPasswordResetTemplate(email, code) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Recuperación de Contraseña - Incodefy</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Contenedor principal -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden; max-width: 600px;">
          
          <!-- Header con gradiente -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: inline-block; line-height: 64px; margin-bottom: 16px;">
                      <span style="font-size: 32px;">🔐</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      Recuperación de Contraseña
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Contenido -->
          <tr>
            <td style="padding: 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Hola,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Recibimos una solicitud para restablecer la contraseña de tu cuenta <strong>${email}</strong>.
                    </p>
                    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                      Usa el siguiente código de verificación para continuar:
                    </p>
                  </td>
                </tr>
                
                <!-- Código de verificación -->
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px 40px;">
                          <p style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 4px; font-family: 'Courier New', monospace;">
                            ${code}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td>
                    <!-- Información importante -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 8px;">
                      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
                        <strong>⚠️ Importante:</strong> Este código expira en <strong>1 hora</strong>.
                      </p>
                    </div>
                    
                    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                      Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña no se modificará.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                      © 2025 Incodefy. Sistema de Gestión Hospitalaria
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Este es un correo automático, por favor no respondas.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Enviar email de confirmación de cambio de contraseña
 * @param {string} email - Email del destinatario
 * @returns {Promise<Object>} Resultado del envío
 */
async function sendPasswordChangedConfirmation(email) {
  const htmlBody = getPasswordChangedTemplate(email);
  
  const params = {
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Contraseña Actualizada - Incodefy',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: `Tu contraseña ha sido actualizada exitosamente.\n\nSi no realizaste este cambio, contacta inmediatamente con soporte.`,
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    console.log('📧 Enviando confirmación de cambio de contraseña a:', email);
    const result = await ses.sendEmail(params).promise();
    console.log('✅ Email de confirmación enviado:', result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error('❌ Error al enviar email de confirmación:', error);
    // No lanzamos error aquí porque el cambio de contraseña ya se realizó
    return { success: false, error: error.message };
  }
}

/**
 * Template HTML para confirmación de cambio de contraseña
 */
function getPasswordChangedTemplate(email) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contraseña Actualizada</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden; max-width: 600px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 48px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: inline-block; line-height: 64px; margin-bottom: 16px;">
                <span style="font-size: 32px;">✅</span>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">
                Contraseña Actualizada
              </h1>
            </td>
          </tr>
          
          <!-- Contenido -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Hola,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Tu contraseña para la cuenta <strong>${email}</strong> ha sido actualizada exitosamente.
              </p>
              
              <!-- Alerta de seguridad -->
              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #991b1b;">
                  <strong>🔒 Seguridad:</strong> Si NO realizaste este cambio, contacta inmediatamente con nuestro equipo de soporte.
                </p>
              </div>
              
              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-align: center;">
                © 2025 Incodefy. Sistema de Gestión Hospitalaria
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                Este es un correo automático, por favor no respondas.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

module.exports = {
  sendPasswordResetEmail,
  sendPasswordChangedConfirmation
};
