// src/utils/emailTemplates.js

/**
 * Template HTML para email de invitación a grupo - Diseño mejorado y compatible
 */
function getInvitationEmailTemplate({ 
  invitedEmail, 
  groupName, 
  inviterName, 
  roleName, 
  acceptLink 
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Invitación a Grupo - Incodefy</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
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
                    <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; backdrop-filter: blur(10px);">
                      <span style="font-size: 32px;">📨</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      Invitación a Grupo
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <p style="margin: 0; font-size: 16px; color: rgba(255, 255, 255, 0.9); font-weight: 400;">
                      Has sido invitado a colaborar
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Contenido principal -->
          <tr>
            <td style="padding: 48px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                
                <!-- Saludo -->
                <tr>
                  <td style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 16px; color: #4a5568; line-height: 1.6;">
                      ¡Hola! 👋
                    </p>
                  </td>
                </tr>
                
                <!-- Mensaje principal -->
                <tr>
                  <td style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 16px; color: #2d3748; line-height: 1.7;">
                      <strong style="color: #667eea; font-weight: 600;">${inviterName}</strong> te ha invitado a formar parte del grupo <strong style="color: #1a202c; font-weight: 600;">${groupName}</strong> en Incodefy.
                    </p>
                  </td>
                </tr>
                
                <!-- Tarjeta de detalles -->
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(to bottom right, #f7fafc, #edf2f7); border-radius: 12px; border: 2px solid #e2e8f0; overflow: hidden;">
                      <tr>
                        <td style="padding: 28px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            
                            <!-- Detalle: Grupo -->
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td width="35%">
                                      <p style="margin: 0; font-size: 12px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">
                                        📁 Grupo
                                      </p>
                                    </td>
                                    <td align="right">
                                      <p style="margin: 0; font-size: 15px; color: #1a202c; font-weight: 600;">
                                        ${groupName}
                                      </p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            
                            <!-- Detalle: Rol -->
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td width="35%">
                                      <p style="margin: 0; font-size: 12px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">
                                        🎯 Rol
                                      </p>
                                    </td>
                                    <td align="right">
                                      <span style="display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.3px;">
                                        ${roleName}
                                      </span>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            
                            <!-- Detalle: Invitador -->
                            <tr>
                              <td style="padding: 12px 0 0 0;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                  <tr>
                                    <td width="35%">
                                      <p style="margin: 0; font-size: 12px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">
                                        👤 Invitado por
                                      </p>
                                    </td>
                                    <td align="right">
                                      <p style="margin: 0; font-size: 15px; color: #1a202c; font-weight: 600;">
                                        ${inviterName}
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
                  </td>
                </tr>
                
                <!-- Botón CTA -->
                <tr>
                  <td align="center" style="padding: 40px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                          <a href="${acceptLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; color: #ffffff; text-decoration: none; font-weight: 600; letter-spacing: 0.3px;">
                            ✓ Aceptar invitación
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Aviso importante -->
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td width="32" valign="top">
                                <span style="font-size: 20px;">⏰</span>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
                                  <strong style="font-weight: 700;">Importante:</strong> Este enlace expirará en <strong>7 días</strong>. Asegúrate de aceptar la invitación antes de ese tiempo.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Disclaimer -->
                <tr>
                  <td align="center" style="padding-top: 32px;">
                    <p style="margin: 0; font-size: 13px; color: #a0aec0; line-height: 1.5;">
                      Si no esperabas esta invitación, puedes ignorar este correo de forma segura.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 32px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #2d3748; letter-spacing: 0.5px;">
                      Incodefy
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 20px 0; font-size: 13px; color: #718096;">
                      Sistema de Gestión Hospitalaria
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${acceptLink}" target="_blank" style="font-size: 13px; color: #667eea; text-decoration: none; border-bottom: 1px solid #667eea;">
                      Ver invitación en el navegador →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px;">
                    <p style="margin: 0; font-size: 11px; color: #a0aec0;">
                      © 2025 Incodefy. Todos los derechos reservados.
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
  `.trim();
}

/**
 * Template de texto plano mejorado (fallback)
 */
function getInvitationEmailText({ 
  invitedEmail, 
  groupName, 
  inviterName, 
  roleName, 
  acceptLink 
}) {
  return `
╔════════════════════════════════════════════════════════════╗
║                   INVITACIÓN A GRUPO                       ║
╚════════════════════════════════════════════════════════════╝

¡Hola! 👋

${inviterName} te ha invitado a formar parte del grupo 
"${groupName}" en Incodefy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALLES DE LA INVITACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Grupo:              ${groupName}
🎯 Rol asignado:       ${roleName}
👤 Invitado por:       ${inviterName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACEPTAR INVITACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Haz clic en el siguiente enlace para aceptar:
${acceptLink}

⏰ IMPORTANTE: Este enlace expirará en 7 días.
   Asegúrate de aceptar la invitación antes de ese tiempo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Si no esperabas esta invitación, puedes ignorar este correo 
de forma segura.

────────────────────────────────────────────────────────────
Incodefy - Sistema de Gestión Hospitalaria
© 2025 Incodefy. Todos los derechos reservados.
────────────────────────────────────────────────────────────
  `.trim();
}

module.exports = {
  getInvitationEmailTemplate,
  getInvitationEmailText
};