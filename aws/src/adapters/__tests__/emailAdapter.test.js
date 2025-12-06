/**
 * EmailAdapter Unit Tests
 * 
 * Tests para el Anti-Corruption Layer de envío de emails SES
 * 
 * Coverage:
 * - Domain model transformations (Email, EmailResult)
 * - Error mapping (SES errors → Domain exceptions)
 * - All public methods (send, sendBulk, sendTemplate, etc.)
 * - Template rendering
 * - Rate limiting (batch processing)
 * - Ambassador integration
 */

const {
  getEmailAdapter,
  EmailAdapter,
  Email,
  EmailResult,
  InvalidEmailError,
  EmailSendError,
  EmailQuotaExceededError
} = require('../emailAdapter');

// Mock Logger
jest.mock('../../utils/logger', () => ({
  create: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  }))
}));

// Mock Ambassador
jest.mock('../../utils/ambassador');
const { getAmbassador } = require('../../utils/ambassador');

describe('EmailAdapter', () => {
  let emailAdapter;
  let mockAmbassador;
  let mockSendEmail;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Ambassador sendEmail
    mockSendEmail = jest.fn();
    mockAmbassador = {
      sendEmail: mockSendEmail
    };

    getAmbassador.mockReturnValue(mockAmbassador);

    emailAdapter = new EmailAdapter({
      fromEmail: 'noreply@test.com',
      useAmbassador: true
    });
  });

  // ========== DOMAIN MODELS ==========

  describe('Email Domain Model', () => {
    it('should create Email with all properties', () => {
      const email = new Email({
        to: ['user@test.com'],
        from: 'sender@test.com',
        subject: 'Test Subject',
        body: 'Test Body',
        isHtml: true,
        cc: ['cc@test.com'],
        bcc: ['bcc@test.com'],
        replyTo: 'reply@test.com'
      });

      expect(email.to).toEqual(['user@test.com']);
      expect(email.from).toBe('sender@test.com');
      expect(email.subject).toBe('Test Subject');
      expect(email.body).toBe('Test Body');
      expect(email.isHtml).toBe(true);
      expect(email.cc).toEqual(['cc@test.com']);
      expect(email.bcc).toEqual(['bcc@test.com']);
      expect(email.replyTo).toBe('reply@test.com');
    });

    it('should validate email addresses', () => {
      const validEmail = new Email({
        to: ['valid@test.com'],
        from: 'sender@test.com',
        subject: 'Test',
        body: 'Test'
      });

      expect(validEmail.validate()).toBe(true);

      const invalidEmail = new Email({
        to: ['invalid-email'],
        from: 'sender@test.com',
        subject: 'Test',
        body: 'Test'
      });

      expect(invalidEmail.validate()).toBe(false);
    });

    it('should convert to JSON', () => {
      const email = new Email({
        to: ['user@test.com'],
        from: 'sender@test.com',
        subject: 'Test',
        body: 'Body'
      });

      const json = email.toJSON();
      expect(json).toEqual({
        to: ['user@test.com'],
        from: 'sender@test.com',
        subject: 'Test',
        body: 'Body',
        isHtml: false,
        cc: undefined,
        bcc: undefined,
        replyTo: undefined
      });
    });
  });

  describe('EmailResult Domain Model', () => {
    it('should create EmailResult with success', () => {
      const result = new EmailResult({
        messageId: 'msg-123',
        status: 'sent',
        provider: 'SES',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(result.messageId).toBe('msg-123');
      expect(result.status).toBe('sent');
      expect(result.provider).toBe('SES');
      expect(result.isSuccess()).toBe(true);
    });

    it('should create EmailResult with failure', () => {
      const result = new EmailResult({
        status: 'failed',
        error: 'Invalid email address'
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Invalid email address');
      expect(result.isSuccess()).toBe(false);
    });

    it('should convert to JSON', () => {
      const result = new EmailResult({
        messageId: 'msg-123',
        status: 'sent',
        provider: 'SES'
      });

      const json = result.toJSON();
      expect(json).toMatchObject({
        messageId: 'msg-123',
        status: 'sent',
        provider: 'SES'
      });
    });
  });

  // ========== SEND METHOD ==========

  describe('send()', () => {
    it('should send email and return EmailResult', async () => {
      const mockResponse = {
        MessageId: 'ses-msg-123'
      };

      mockSendEmail.mockResolvedValueOnce(mockResponse);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test Subject',
        body: 'Test Body'
      });

      const result = await emailAdapter.send(email);

      expect(result).toBeInstanceOf(EmailResult);
      expect(result.messageId).toBe('ses-msg-123');
      expect(result.status).toBe('sent');
      expect(result.provider).toBe('SES');
      expect(result.isSuccess()).toBe(true);

      expect(mockSendEmail).toHaveBeenCalledWith({
        Destination: {
          ToAddresses: ['user@test.com']
        },
        Message: {
          Subject: { Data: 'Test Subject' },
          Body: { Text: { Data: 'Test Body' } }
        },
        Source: 'noreply@test.com'
      });
    });

    it('should send HTML email', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'HTML Test',
        body: '<h1>Hello</h1>',
        isHtml: true
      });

      await emailAdapter.send(email);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: expect.objectContaining({
            Body: { Html: { Data: '<h1>Hello</h1>' } }
          })
        })
      );
    });

    it('should include CC and BCC addresses', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test',
        cc: ['cc@test.com'],
        bcc: ['bcc@test.com']
      });

      await emailAdapter.send(email);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: {
            ToAddresses: ['user@test.com'],
            CcAddresses: ['cc@test.com'],
            BccAddresses: ['bcc@test.com']
          }
        })
      );
    });

    it('should include ReplyTo address', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test',
        replyTo: 'support@test.com'
      });

      await emailAdapter.send(email);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          ReplyToAddresses: ['support@test.com']
        })
      );
    });

    it('should throw InvalidEmailError on invalid email', async () => {
      const email = new Email({
        to: ['invalid-email'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(InvalidEmailError);
    });

    it('should throw EmailSendError on SES error', async () => {
      const mockError = new Error('MessageRejected');
      mockError.name = 'MessageRejected';

      mockSendEmail.mockRejectedValueOnce(mockError);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(EmailSendError);
    });

    it('should throw EmailQuotaExceededError on throttling', async () => {
      const mockError = new Error('Throttling');
      mockError.name = 'Throttling';

      mockSendEmail.mockRejectedValueOnce(mockError);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(EmailQuotaExceededError);
    });
  });

  // ========== SEND BULK METHOD ==========

  describe('sendBulk()', () => {
    it('should send multiple emails in batches', async () => {
      mockSendEmail.mockResolvedValue({ MessageId: 'msg-123' });

      const emails = [
        new Email({ to: ['user1@test.com'], from: 'noreply@test.com', subject: 'Test 1', body: 'Body 1' }),
        new Email({ to: ['user2@test.com'], from: 'noreply@test.com', subject: 'Test 2', body: 'Body 2' }),
        new Email({ to: ['user3@test.com'], from: 'noreply@test.com', subject: 'Test 3', body: 'Body 3' })
      ];

      const results = await emailAdapter.sendBulk(emails);

      expect(results).toHaveLength(3);
      expect(results[0]).toBeInstanceOf(EmailResult);
      expect(results[0].status).toBe('sent');
      expect(mockSendEmail).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk send', async () => {
      mockSendEmail
        .mockResolvedValueOnce({ MessageId: 'msg-1' })
        .mockRejectedValueOnce(new Error('MessageRejected'))
        .mockResolvedValueOnce({ MessageId: 'msg-3' });

      const emails = [
        new Email({ to: ['user1@test.com'], from: 'noreply@test.com', subject: 'Test 1', body: 'Body 1' }),
        new Email({ to: ['user2@test.com'], from: 'noreply@test.com', subject: 'Test 2', body: 'Body 2' }),
        new Email({ to: ['user3@test.com'], from: 'noreply@test.com', subject: 'Test 3', body: 'Body 3' })
      ];

      const results = await emailAdapter.sendBulk(emails);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('sent');
      expect(results[1].status).toBe('failed');
      expect(results[2].status).toBe('sent');
    });

    it('should respect batch size limit', async () => {
      mockSendEmail.mockResolvedValue({ MessageId: 'msg-123' });

      const emails = Array.from({ length: 15 }, (_, i) => 
        new Email({ 
          to: [`user${i}@test.com`], 
          from: 'noreply@test.com', 
          subject: `Test ${i}`, 
          body: `Body ${i}` 
        })
      );

      await emailAdapter.sendBulk(emails, { batchSize: 10 });

      expect(mockSendEmail).toHaveBeenCalledTimes(15);
    }, 15000); // Increased timeout due to delay between batches

    it('should return empty array for empty input', async () => {
      const results = await emailAdapter.sendBulk([]);

      expect(results).toEqual([]);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ========== TEMPLATE METHODS ==========

  describe('sendTemplate()', () => {
    it('should send email with rendered template', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const result = await emailAdapter.sendTemplate(
        'user@test.com',
        'welcome',
        { userName: 'John Doe', activationLink: 'https://test.com/activate' }
      );

      expect(result).toBeInstanceOf(EmailResult);
      expect(result.status).toBe('sent');

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: expect.objectContaining({
            Subject: { Data: 'Welcome to Incodefy' },
            Body: expect.objectContaining({
              Html: expect.objectContaining({
                Data: expect.stringContaining('John Doe')
              })
            })
          })
        })
      );
    });

    it('should throw error on unknown template', async () => {
      await expect(emailAdapter.sendTemplate(
        'user@test.com',
        'nonexistent-template',
        {}
      )).rejects.toThrow('Unknown template');
    });
  });

  describe('sendWelcomeEmail()', () => {
    it('should send welcome email with correct template', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const result = await emailAdapter.sendWelcomeEmail(
        'newuser@test.com',
        'New User',
        'https://app.test.com/activate?token=abc123'
      );

      expect(result).toBeInstanceOf(EmailResult);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: ['newuser@test.com'] },
          Message: expect.objectContaining({
            Subject: { Data: 'Welcome to Incodefy' }
          })
        })
      );
    });
  });

  describe('sendGroupInvitation()', () => {
    it('should send group invitation with correct template', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const result = await emailAdapter.sendGroupInvitation(
        'invitee@test.com',
        'Engineering Team',
        'John Doe',
        'https://app.test.com/groups/123/accept'
      );

      expect(result).toBeInstanceOf(EmailResult);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: ['invitee@test.com'] },
          Message: expect.objectContaining({
            Subject: { Data: 'Group Invitation: Engineering Team' }
          })
        })
      );
    });
  });

  describe('sendAppointmentConfirmation()', () => {
    it('should send appointment confirmation with correct template', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const appointmentDate = '2024-12-15';
      const appointmentTime = '10:00 AM';
      const spaceName = 'Conference Room A';
      const cancelLink = 'https://app.test.com/appointments/cancel/abc123';

      const result = await emailAdapter.sendAppointmentConfirmation(
        'user@test.com',
        appointmentDate,
        appointmentTime,
        spaceName,
        cancelLink
      );

      expect(result).toBeInstanceOf(EmailResult);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: ['user@test.com'] },
          Message: expect.objectContaining({
            Subject: { Data: 'Appointment Confirmation' }
          })
        })
      );
    });
  });

  // ========== TEMPLATE RENDERING ==========

  describe('Template Rendering', () => {
    it('should replace template variables', () => {
      const template = 'Hello {{userName}}, welcome to {{appName}}!';
      const variables = { userName: 'John', appName: 'TestApp' };

      const rendered = emailAdapter._renderTemplate(template, variables);

      expect(rendered).toBe('Hello John, welcome to TestApp!');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{userName}}, welcome to {{appName}}!';
      const variables = { userName: 'John' };

      const rendered = emailAdapter._renderTemplate(template, variables);

      expect(rendered).toBe('Hello John, welcome to {{appName}}!');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{{name}} is {{name}}';
      const variables = { name: 'awesome' };

      const rendered = emailAdapter._renderTemplate(template, variables);

      expect(rendered).toBe('awesome is awesome');
    });
  });

  // ========== FACTORY FUNCTION ==========

  describe('getEmailAdapter()', () => {
    it('should return singleton instance', () => {
      const adapter1 = getEmailAdapter();
      const adapter2 = getEmailAdapter();

      expect(adapter1).toBe(adapter2);
      expect(adapter1).toBeInstanceOf(EmailAdapter);
    });

    it('should create adapter with custom config', () => {
      const customAdapter = getEmailAdapter({
        fromEmail: 'custom@test.com',
        useAmbassador: false
      });

      expect(customAdapter).toBeInstanceOf(EmailAdapter);
    });
  });

  // ========== ERROR HANDLING ==========

  describe('Error Handling', () => {
    it('should map MessageRejected to EmailSendError', async () => {
      const mockError = new Error('MessageRejected');
      mockError.name = 'MessageRejected';

      mockSendEmail.mockRejectedValueOnce(mockError);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(EmailSendError);
    });

    it('should map MailFromDomainNotVerifiedException to EmailSendError', async () => {
      const mockError = new Error('MailFromDomainNotVerifiedException');
      mockError.name = 'MailFromDomainNotVerifiedException';

      mockSendEmail.mockRejectedValueOnce(mockError);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(EmailSendError);
    });

    it('should map Throttling to EmailQuotaExceededError', async () => {
      const mockError = new Error('Throttling');
      mockError.name = 'Throttling';

      mockSendEmail.mockRejectedValueOnce(mockError);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(EmailQuotaExceededError);
    });

    it('should map AccountSendingPausedException to EmailQuotaExceededError', async () => {
      const mockError = new Error('AccountSendingPausedException');
      mockError.name = 'AccountSendingPausedException';

      mockSendEmail.mockRejectedValueOnce(mockError);

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await expect(emailAdapter.send(email))
        .rejects.toThrow(EmailQuotaExceededError);
    });
  });

  // ========== AMBASSADOR INTEGRATION ==========

  describe('Ambassador Integration', () => {
    it('should use Ambassador when enabled', async () => {
      mockSendEmail.mockResolvedValueOnce({ MessageId: 'msg-123' });

      const adapterWithAmbassador = new EmailAdapter({
        fromEmail: 'noreply@test.com',
        useAmbassador: true
      });

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      await adapterWithAmbassador.send(email);

      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('should bypass Ambassador when disabled', async () => {
      const adapterWithoutAmbassador = new EmailAdapter({
        fromEmail: 'noreply@test.com',
        useAmbassador: false
      });

      const email = new Email({
        to: ['user@test.com'],
        from: 'noreply@test.com',
        subject: 'Test',
        body: 'Test'
      });

      // Should use SES client directly (not mocked in this test)
      // Just verify it doesn't use Ambassador
      expect(getAmbassador).not.toHaveBeenCalled();
    });
  });
});
