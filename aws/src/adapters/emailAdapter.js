/**
 * Anti-Corruption Layer: Email Adapter
 * 
 * Traduce entre SES (AWS) y el modelo de dominio de Email.
 * 
 * Propósito:
 * - Aislar handlers del servicio de email específico (SES)
 * - Facilitar cambio de proveedor (SES → SendGrid, Mailgun, etc.)
 * - Proporcionar interfaz de dominio consistente
 * - Simplificar testing (mock solo este adaptador)
 * 
 * Principios:
 * - Handlers NUNCA llaman directamente a SES
 * - Solo el adaptador conoce detalles de SES
 * - Modelo de dominio NO expone AWS internals
 * - Errores traducidos a excepciones del dominio
 * 
 * Features:
 * - Envío simple (texto/HTML)
 * - Envío con plantillas
 * - Envío masivo (bulk)
 * - Attachments
 * - Tracking de estado
 */

const { SESClient, SendEmailCommand, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const { createLogger } = require('../utils/logger');

/**
 * Domain Model: Email
 * Estructura INDEPENDIENTE de SES
 */
class Email {
  constructor(data) {
    this.to = Array.isArray(data.to) ? data.to : [data.to];
    this.from = data.from;
    this.subject = data.subject;
    this.body = data.body;
    this.isHtml = data.isHtml || false;
    this.cc = data.cc || [];
    this.bcc = data.bcc || [];
    this.replyTo = data.replyTo || [];
    this.attachments = data.attachments || [];
    this.metadata = data.metadata || {};
  }

  /**
   * Validación del dominio
   */
  validate() {
    if (!this.to || this.to.length === 0) {
      throw new InvalidEmailError('At least one recipient is required');
    }

    if (!this.subject) {
      throw new InvalidEmailError('Subject is required');
    }

    if (!this.body) {
      throw new InvalidEmailError('Body is required');
    }

    // Validar formato de emails
    const allEmails = [...this.to, ...this.cc, ...this.bcc, this.from];
    for (const email of allEmails) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new InvalidEmailError(`Invalid email format: ${email}`);
      }
    }
  }

  toJSON() {
    return {
      to: this.to,
      from: this.from,
      subject: this.subject,
      body: this.body,
      isHtml: this.isHtml,
      cc: this.cc,
      bcc: this.bcc,
      replyTo: this.replyTo,
      attachments: this.attachments.length,
      metadata: this.metadata
    };
  }
}

/**
 * Domain Model: Email Result
 */
class EmailResult {
  constructor(data) {
    this.messageId = data.messageId;
    this.status = data.status; // SENT, FAILED, QUEUED
    this.provider = data.provider; // ses, sendgrid, etc.
    this.sentAt = data.sentAt;
    this.recipient = data.recipient;
    this.error = data.error;
    this.metadata = data.metadata || {};
  }

  isSuccess() {
    return this.status === 'SENT';
  }

  toJSON() {
    return {
      messageId: this.messageId,
      status: this.status,
      provider: this.provider,
      sentAt: this.sentAt,
      recipient: this.recipient,
      error: this.error,
      metadata: this.metadata
    };
  }
}

/**
 * Domain Exceptions
 */
class InvalidEmailError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEmailError';
    this.statusCode = 400;
  }
}

class EmailSendError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'EmailSendError';
    this.originalError = originalError;
    this.statusCode = 500;
  }
}

class EmailQuotaExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmailQuotaExceededError';
    this.statusCode = 429;
  }
}

/**
 * EmailAdapter - Anti-Corruption Layer para SES
 */
class EmailAdapter {
  constructor(options = {}) {
    // SES client directo
    this.sesClient = options.sesClient || new SESClient({});
    
    this.fromEmail = options.fromEmail || process.env.SES_FROM_EMAIL || 'noreply@incodefy.com';
    this.logger = options.logger || createLogger({ component: 'EmailAdapter' });
  }

  /**
   * Envía email simple (texto o HTML)
   * @param {Email|Object} emailData - Email del dominio
   * @returns {Promise<EmailResult>} - Resultado del envío
   * @throws {InvalidEmailError} - Si los datos son inválidos
   * @throws {EmailSendError} - Si falla el envío
   */
  async send(emailData) {
    try {
      // Crear modelo de dominio
      const email = emailData instanceof Email 
        ? emailData 
        : new Email({ ...emailData, from: emailData.from || this.fromEmail });

      // ✅ Validación del dominio
      email.validate();

      this.logger.debug('Sending email', { 
        to: email.to, 
        subject: email.subject,
        isHtml: email.isHtml 
      });

      // ✅ Enviar directamente via SES
      const result = await this._sendViaSES(email);

      this.logger.info('Email sent successfully', { 
        messageId: result.messageId,
        to: email.to 
      });

      return result;

    } catch (error) {
      // ✅ Traducción: SES errors → Domain exceptions
      return this._handleError(error, emailData);
    }
  }

  /**
   * Envía múltiples emails (bulk)
   * @param {Email[]|Object[]} emails - Array de emails
   * @returns {Promise<EmailResult[]>} - Resultados de todos los envíos
   */
  async sendBulk(emails) {
    try {
      this.logger.debug('Sending bulk emails', { count: emails.length });

      // Enviar en paralelo (con límite para no saturar SES)
      const BATCH_SIZE = 10; // SES limit: 14 emails/second
      const results = [];

      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(email => this.send(email))
        );

        // Convertir resultados settled a EmailResult
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // Error en el envío
            results.push(new EmailResult({
              messageId: null,
              status: 'FAILED',
              provider: 'ses',
              sentAt: new Date().toISOString(),
              recipient: batch[j].to,
              error: result.reason.message
            }));
          }
        }

        // Delay entre batches para respetar rate limit de SES
        if (i + BATCH_SIZE < emails.length) {
          await this._delay(1000); // 1 segundo entre batches
        }
      }

      const successCount = results.filter(r => r.isSuccess()).length;
      const failedCount = results.length - successCount;

      this.logger.info('Bulk email completed', { 
        total: results.length,
        successful: successCount,
        failed: failedCount
      });

      return results;

    } catch (error) {
      this.logger.error('Error sending bulk emails', error);
      throw new EmailSendError('Bulk email failed', error);
    }
  }

  /**
   * Envía email con plantilla (template)
   * @param {Object} templateData - Datos de la plantilla
   * @returns {Promise<EmailResult>}
   */
  async sendTemplate(templateData) {
    const { template, to, variables } = templateData;

    // Renderizar plantilla con variables
    const body = this._renderTemplate(template, variables);

    return await this.send({
      to,
      subject: templateData.subject || this._extractSubject(template),
      body,
      isHtml: true
    });
  }

  /**
   * Envía email de bienvenida (template predefinido)
   */
  async sendWelcomeEmail(to, userName) {
    return await this.sendTemplate({
      template: 'welcome',
      to,
      subject: '¡Bienvenido a Incodefy!',
      variables: { userName, appUrl: process.env.APP_URL }
    });
  }

  /**
   * Envía email de invitación a grupo
   */
  async sendGroupInvitation(to, groupName, inviterName, invitationLink) {
    return await this.sendTemplate({
      template: 'group-invitation',
      to,
      subject: `Invitación al grupo: ${groupName}`,
      variables: { 
        groupName, 
        inviterName, 
        invitationLink,
        appUrl: process.env.APP_URL 
      }
    });
  }

  /**
   * Envía email de confirmación de cita
   */
  async sendAppointmentConfirmation(to, appointmentDetails) {
    return await this.sendTemplate({
      template: 'appointment-confirmation',
      to,
      subject: 'Confirmación de cita médica',
      variables: appointmentDetails
    });
  }

  /**
   * Envía email de recordatorio
   */
  async sendReminder(to, reminderDetails) {
    return await this.sendTemplate({
      template: 'reminder',
      to,
      subject: `Recordatorio: ${reminderDetails.title}`,
      variables: reminderDetails
    });
  }

  // ========== INTERNAL METHODS ==========

  /**
   * Envía email via SES
   */
  async _sendViaSES(email) {
    const command = new SendEmailCommand({
      Source: email.from,
      Destination: {
        ToAddresses: email.to,
        CcAddresses: email.cc.length > 0 ? email.cc : undefined,
        BccAddresses: email.bcc.length > 0 ? email.bcc : undefined
      },
      Message: {
        Subject: { Data: email.subject },
        Body: email.isHtml 
          ? { Html: { Data: email.body } }
          : { Text: { Data: email.body } }
      },
      ReplyToAddresses: email.replyTo.length > 0 ? email.replyTo : undefined
    });

    const result = await this.sesClient.send(command);

    // ✅ Traducción: SES response → Domain EmailResult
    return new EmailResult({
      messageId: result.MessageId,
      status: 'SENT',
      provider: 'ses',
      sentAt: new Date().toISOString(),
      recipient: email.to.join(', '),
      metadata: {
        requestId: result.$metadata?.requestId
      }
    });
  }

  /**
   * Maneja errores de SES y los traduce a excepciones del dominio
   */
  _handleError(error, emailData) {
    this.logger.error('Email send error', error, { 
      to: emailData.to,
      subject: emailData.subject 
    });

    // ✅ Traducción: SES errors → Domain exceptions
    
    // Quota exceeded (429)
    if (error.name === 'MessageRejected' && error.message.includes('quota')) {
      throw new EmailQuotaExceededError('SES daily sending quota exceeded');
    }

    // Invalid email (400)
    if (error.name === 'InvalidParameterValue' || error.name === 'ValidationError') {
      throw new InvalidEmailError(error.message);
    }

    // Generic error (500)
    throw new EmailSendError('Failed to send email', error);
  }

  /**
   * Renderiza plantilla con variables
   */
  _renderTemplate(templateName, variables) {
    // Templates predefinidos (en producción, cargar desde archivos o S3)
    const templates = {
      'welcome': `
        <!DOCTYPE html>
        <html>
          <head><style>body { font-family: Arial, sans-serif; }</style></head>
          <body>
            <h1>¡Bienvenido a Incodefy, {{userName}}!</h1>
            <p>Estamos emocionados de tenerte en nuestra plataforma.</p>
            <p><a href="{{appUrl}}">Comenzar ahora</a></p>
          </body>
        </html>
      `,
      'group-invitation': `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background-color: #f5f5f5;
              padding: 40px 20px;
              line-height: 1.6;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
            }
            .header {
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 8px;
              letter-spacing: -0.5px;
            }
            .header p {
              color: rgba(255, 255, 255, 0.8);
              font-size: 14px;
            }
            .content {
              padding: 40px 30px;
            }
            .invitation-box {
              background-color: #fafafa;
              border-left: 4px solid #1a1a1a;
              border-radius: 8px;
              padding: 24px;
              margin-bottom: 32px;
            }
            .invitation-box p {
              color: #2c2c2c;
              font-size: 16px;
              margin-bottom: 12px;
            }
            .invitation-box .group-name {
              font-weight: 600;
              color: #1a1a1a;
              font-size: 18px;
            }
            .invitation-box .inviter {
              color: #64748b;
              font-size: 14px;
            }
            .invitation-box .inviter strong {
              color: #1a1a1a;
              font-weight: 600;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
              color: #ffffff;
              text-decoration: none;
              padding: 16px 40px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              text-align: center;
              transition: transform 0.2s, box-shadow 0.2s;
              box-shadow: 0 4px 12px rgba(26, 26, 26, 0.2);
            }
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(26, 26, 26, 0.3);
            }
            .button-container {
              text-align: center;
              margin-bottom: 32px;
            }
            .info-text {
              color: #64748b;
              font-size: 14px;
              text-align: center;
              margin-top: 24px;
              padding-top: 24px;
              border-top: 1px solid #e5e5e5;
            }
            .footer {
              background-color: #fafafa;
              padding: 24px 30px;
              text-align: center;
              border-top: 1px solid #e5e5e5;
            }
            .footer p {
              color: #a3a3a3;
              font-size: 13px;
              margin-bottom: 8px;
            }
            .footer a {
              color: #1a1a1a;
              text-decoration: none;
              font-weight: 500;
            }
            @media only screen and (max-width: 600px) {
              .email-container { border-radius: 0; }
              .header { padding: 30px 20px; }
              .content { padding: 30px 20px; }
              .invitation-box { padding: 20px; }
              .cta-button { display: block; width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Invitación a Grupo</h1>
              <p>Has sido invitado a colaborar</p>
            </div>
            
            <div class="content">
              <div class="invitation-box">
                <p class="group-name">{{groupName}}</p>
                <p class="inviter">Invitado por: <strong>{{inviterName}}</strong></p>
              </div>
              
              <div class="button-container">
                <a href="{{invitationLink}}" class="cta-button">Aceptar Invitación</a>
              </div>
              
              <p class="info-text">
                Al aceptar esta invitación, tendrás acceso al grupo y podrás colaborar con el equipo.
              </p>
            </div>
            
            <div class="footer">
              <p>Este correo fue enviado desde <strong>Incodefy</strong></p>
              <p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>
              <p><a href="{{appUrl}}">Visitar plataforma</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      'appointment-confirmation': `
        <!DOCTYPE html>
        <html>
          <head><style>body { font-family: Arial, sans-serif; }</style></head>
          <body>
            <h1>Confirmación de cita</h1>
            <p>Tu cita ha sido confirmada:</p>
            <ul>
              <li><strong>Fecha:</strong> {{date}}</li>
              <li><strong>Hora:</strong> {{time}}</li>
              <li><strong>Doctor:</strong> {{doctorName}}</li>
              <li><strong>Especialidad:</strong> {{specialty}}</li>
            </ul>
          </body>
        </html>
      `,
      'reminder': `
        <!DOCTYPE html>
        <html>
          <head><style>body { font-family: Arial, sans-serif; }</style></head>
          <body>
            <h1>Recordatorio: {{title}}</h1>
            <p>{{message}}</p>
            <p><strong>Fecha:</strong> {{date}}</p>
          </body>
        </html>
      `
    };

    let template = templates[templateName];
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Reemplazar variables {{variable}} con valores
    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return template;
  }

  /**
   * Extrae subject de plantilla (si está definido en el template)
   */
  _extractSubject(templateName) {
    const subjects = {
      'welcome': '¡Bienvenido a Incodefy!',
      'group-invitation': 'Invitación a grupo',
      'appointment-confirmation': 'Confirmación de cita',
      'reminder': 'Recordatorio'
    };

    return subjects[templateName] || 'Notificación de Incodefy';
  }

  /**
   * Delay helper para bulk sending
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas de envío (para monitoreo)
   */
  async getStats() {
    // Implementar integración con CloudWatch Metrics de SES
    // Por ahora, retornar stats básicas
    return {
      provider: 'ses',
      fromEmail: this.fromEmail,
      timestamp: new Date().toISOString()
    };
  }
}

// ========== EXPORTS ==========

/**
 * Factory para crear instancia singleton del adapter
 */
let _instance = null;

function getEmailAdapter(options = {}) {
  if (!_instance) {
    _instance = new EmailAdapter(options);
  }
  return _instance;
}

module.exports = {
  EmailAdapter,
  getEmailAdapter,
  Email,
  EmailResult,
  // Domain Exceptions
  InvalidEmailError,
  EmailSendError,
  EmailQuotaExceededError
};
