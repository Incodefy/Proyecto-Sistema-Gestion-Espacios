/**
 * AuthAdapter Unit Tests
 * 
 * Tests para el Anti-Corruption Layer de autenticación Cognito
 * 
 * Coverage:
 * - Domain model transformations (AuthSession, TokenSet)
 * - Error mapping (Cognito errors → Domain exceptions)
 * - All public methods (login, refresh, logout, changePassword, etc.)
 * - Challenge handling (MFA, NEW_PASSWORD_REQUIRED)
 * - Token operations (getUserFromToken, validateToken)
 */

const {
  getAuthAdapter,
  AuthAdapter,
  AuthSession,
  TokenSet,
  InvalidCredentialsError,
  TokenExpiredError,
  InvalidTokenError,
  UserNotConfirmedError,
  PasswordResetRequiredError,
  MFARequiredError,
  AuthenticationError
} = require('../authAdapter');

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

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider');

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  RespondToAuthChallengeCommand
} = require('@aws-sdk/client-cognito-identity-provider');

describe('AuthAdapter', () => {
  let authAdapter;
  let mockCognitoClient;
  let mockSend;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock CognitoIdentityProviderClient
    mockSend = jest.fn();
    mockCognitoClient = {
      send: mockSend
    };

    CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

    // Create adapter instance
    authAdapter = new AuthAdapter({
      userPoolId: 'us-east-1_test123',
      clientId: 'test-client-id'
    });
  });

  // ========== DOMAIN MODELS ==========

  describe('AuthSession Domain Model', () => {
    it('should create AuthSession with tokens', () => {
      const session = new AuthSession({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        idToken: 'id-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      });

      expect(session.accessToken).toBe('access-token');
      expect(session.refreshToken).toBe('refresh-token');
      expect(session.idToken).toBe('id-token');
      expect(session.expiresIn).toBe(3600);
      expect(session.tokenType).toBe('Bearer');
      expect(session.challengeName).toBeUndefined();
    });

    it('should create AuthSession with challenge', () => {
      const session = new AuthSession({
        challengeName: 'NEW_PASSWORD_REQUIRED',
        session: 'session-token',
        challengeParameters: { USER_ID_FOR_SRP: 'user-123' }
      });

      expect(session.challengeName).toBe('NEW_PASSWORD_REQUIRED');
      expect(session.session).toBe('session-token');
      expect(session.challengeParameters).toEqual({ USER_ID_FOR_SRP: 'user-123' });
    });

    it('should convert to JSON', () => {
      const session = new AuthSession({
        accessToken: 'access-token',
        idToken: 'id-token',
        expiresIn: 3600
      });

      const json = session.toJSON();
      expect(json).toMatchObject({
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: undefined,
        expiresIn: 3600,
        tokenType: 'Bearer',
        challengeName: undefined
      });
      expect(json).toHaveProperty('expiresAt');
      expect(json.expiresAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
    });
  });

  describe('TokenSet Domain Model', () => {
    it('should create TokenSet without refresh token', () => {
      const tokenSet = new TokenSet({
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        expiresIn: 3600
      });

      expect(tokenSet.accessToken).toBe('new-access-token');
      expect(tokenSet.idToken).toBe('new-id-token');
      expect(tokenSet.expiresIn).toBe(3600);
      expect(tokenSet.tokenType).toBe('Bearer');
      expect(tokenSet.refreshToken).toBeUndefined();
    });

    it('should convert to JSON', () => {
      const tokenSet = new TokenSet({
        accessToken: 'access-token',
        idToken: 'id-token',
        expiresIn: 1800
      });

      const json = tokenSet.toJSON();
      expect(json).toMatchObject({
        accessToken: 'access-token',
        idToken: 'id-token',
        expiresIn: 1800,
        tokenType: 'Bearer'
      });
      expect(json).toHaveProperty('expiresAt');
      expect(json.expiresAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
    });
  });

  // ========== LOGIN METHOD ==========

  describe('login()', () => {
    it('should return AuthSession with tokens on successful login', async () => {
      const mockResponse = {
        AuthenticationResult: {
          IdToken: 'mock-id-token',
          AccessToken: 'mock-access-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer'
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const session = await authAdapter.login('user@test.com', 'password123');

      expect(session).toBeInstanceOf(AuthSession);
      expect(session.idToken).toBe('mock-id-token');
      expect(session.accessToken).toBe('mock-access-token');
      expect(session.refreshToken).toBe('mock-refresh-token');
      expect(session.expiresIn).toBe(3600);
      expect(session.tokenType).toBe('Bearer');

      // Verify InitiateAuthCommand was called correctly
      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: 'test-client-id',
        AuthParameters: {
          USERNAME: 'user@test.com',
          PASSWORD: 'password123'
        }
      });
    });

    it('should throw InvalidCredentialsError on incorrect username/password', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Incorrect username or password.';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.login('user@test.com', 'wrong-password'))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw UserNotConfirmedError when user is not confirmed', async () => {
      const mockError = new Error('UserNotConfirmedException');
      mockError.name = 'UserNotConfirmedException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.login('unconfirmed@test.com', 'password123'))
        .rejects.toThrow(UserNotConfirmedError);
    });

    it('should throw PasswordResetRequiredError on NEW_PASSWORD_REQUIRED challenge', async () => {
      const mockResponse = {
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: 'challenge-session-token',
        ChallengeParameters: { USER_ID_FOR_SRP: 'user-123' }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      try {
        await authAdapter.login('user@test.com', 'temp-password');
        fail('Should have thrown PasswordResetRequiredError');
      } catch (error) {
        expect(error).toBeInstanceOf(PasswordResetRequiredError);
        expect(error.message).toContain('password');
      }
    });

    it('should throw MFARequiredError on SMS_MFA challenge', async () => {
      const mockResponse = {
        ChallengeName: 'SMS_MFA',
        Session: 'mfa-session-token'
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      try {
        await authAdapter.login('user@test.com', 'password123');
        fail('Should have thrown MFARequiredError');
      } catch (error) {
        expect(error).toBeInstanceOf(MFARequiredError);
        expect(error.message).toContain('MFA');
        expect(error.session).toBe('mfa-session-token');
      }
    });

    it('should throw MFARequiredError on SOFTWARE_TOKEN_MFA challenge', async () => {
      const mockResponse = {
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: 'totp-session-token'
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      try {
        await authAdapter.login('user@test.com', 'password123');
        fail('Should have thrown MFARequiredError');
      } catch (error) {
        expect(error).toBeInstanceOf(MFARequiredError);
        expect(error.message).toContain('MFA');
        expect(error.session).toBe('totp-session-token');
      }
    });

    it('should throw InvalidCredentialsError when user not found (security)', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      // Security: Don't reveal user existence
      await expect(authAdapter.login('nonexistent@test.com', 'password123'))
        .rejects.toThrow(InvalidCredentialsError);
    });
  });

  // ========== REFRESH METHOD ==========

  describe('refresh()', () => {
    it('should return TokenSet with new tokens', async () => {
      const mockResponse = {
        AuthenticationResult: {
          IdToken: 'new-id-token',
          AccessToken: 'new-access-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer'
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const tokenSet = await authAdapter.refresh('refresh-token-123');

      expect(tokenSet).toBeInstanceOf(TokenSet);
      expect(tokenSet.idToken).toBe('new-id-token');
      expect(tokenSet.accessToken).toBe('new-access-token');
      expect(tokenSet.expiresIn).toBe(3600);
      expect(tokenSet.refreshToken).toBeUndefined(); // Refresh no devuelve nuevo refresh token

      // Verify InitiateAuthCommand with REFRESH_TOKEN_AUTH
      expect(InitiateAuthCommand).toHaveBeenCalledWith({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: 'test-client-id',
        AuthParameters: {
          REFRESH_TOKEN: 'refresh-token-123'
        }
      });
    });

    it('should throw TokenExpiredError on expired refresh token', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Refresh Token has expired';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.refresh('expired-token'))
        .rejects.toThrow(TokenExpiredError);
    });

    it('should throw InvalidTokenError on invalid refresh token', async () => {
      const mockError = new Error('InvalidParameterException');
      mockError.name = 'InvalidParameterException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.refresh('invalid-token'))
        .rejects.toThrow(InvalidTokenError);
    });
  });

  // ========== LOGOUT METHOD ==========

  describe('logout()', () => {
    it('should call GlobalSignOutCommand with access token', async () => {
      mockSend.mockResolvedValueOnce({});

      await authAdapter.logout('access-token-123');

      expect(GlobalSignOutCommand).toHaveBeenCalledWith({
        AccessToken: 'access-token-123'
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw TokenExpiredError on expired access token', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Access Token has expired';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.logout('expired-token'))
        .rejects.toThrow(TokenExpiredError);
    });
  });

  // ========== CHANGE PASSWORD METHOD ==========

  describe('changePassword()', () => {
    it('should change password successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      await authAdapter.changePassword('access-token', 'oldPass123', 'newPass456');

      expect(ChangePasswordCommand).toHaveBeenCalledWith({
        AccessToken: 'access-token',
        PreviousPassword: 'oldPass123',
        ProposedPassword: 'newPass456'
      });
    });

    it('should throw InvalidCredentialsError on incorrect old password', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Incorrect username or password';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.changePassword('access-token', 'wrong-old', 'newPass456'))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw AuthenticationError on weak password', async () => {
      const mockError = new Error('InvalidPasswordException');
      mockError.name = 'InvalidPasswordException';
      mockError.message = 'Password does not conform to policy';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.changePassword('access-token', 'oldPass123', 'weak'))
        .rejects.toThrow(AuthenticationError);
    });
  });

  // ========== FORGOT PASSWORD METHODS ==========

  describe('forgotPassword()', () => {
    it('should send password reset code', async () => {
      const mockResponse = {
        CodeDeliveryDetails: {
          DeliveryMedium: 'EMAIL',
          Destination: 'u***@t***.com'
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const result = await authAdapter.forgotPassword('user@test.com');

      expect(result).toMatchObject({
        codeDeliveryDetails: expect.objectContaining({
          deliveryMedium: 'EMAIL',
          destination: 'u***@t***.com'
        })
      });

      expect(ForgotPasswordCommand).toHaveBeenCalledWith({
        ClientId: 'test-client-id',
        Username: 'user@test.com'
      });
    });

    it('should throw InvalidCredentialsError when user not found', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.forgotPassword('nonexistent@test.com'))
        .rejects.toThrow(InvalidCredentialsError);
    });
  });

  describe('confirmForgotPassword()', () => {
    it('should reset password with confirmation code', async () => {
      mockSend.mockResolvedValueOnce({});

      await authAdapter.confirmForgotPassword('user@test.com', '123456', 'newPassword123');

      expect(ConfirmForgotPasswordCommand).toHaveBeenCalledWith({
        ClientId: 'test-client-id',
        Username: 'user@test.com',
        ConfirmationCode: '123456',
        Password: 'newPassword123'
      });
    });

    it('should throw AuthenticationError on invalid code', async () => {
      const mockError = new Error('CodeMismatchException');
      mockError.name = 'CodeMismatchException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.confirmForgotPassword('user@test.com', 'wrong-code', 'newPass'))
        .rejects.toThrow(AuthenticationError);
      
      try {
        await authAdapter.confirmForgotPassword('user@test.com', 'wrong-code', 'newPass');
      } catch (error) {
        expect(error.message).toContain('Invalid verification code');
      }
    });

    it('should throw AuthenticationError on expired code', async () => {
      const mockError = new Error('ExpiredCodeException');
      mockError.name = 'ExpiredCodeException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.confirmForgotPassword('user@test.com', '123456', 'newPass'))
        .rejects.toThrow(AuthenticationError);
      
      try {
        await authAdapter.confirmForgotPassword('user@test.com', '123456', 'newPass');
      } catch (error) {
        expect(error.message).toContain('expired');
      }
    });
  });

  // ========== CHALLENGE RESPONSE METHOD ==========

  describe('respondToChallenge()', () => {
    it('should respond to NEW_PASSWORD_REQUIRED challenge', async () => {
      const mockResponse = {
        AuthenticationResult: {
          IdToken: 'id-token',
          AccessToken: 'access-token',
          RefreshToken: 'refresh-token',
          ExpiresIn: 3600
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const session = await authAdapter.respondToChallenge(
        'NEW_PASSWORD_REQUIRED',
        'challenge-session',
        { NEW_PASSWORD: 'newPassword123' }
      );

      expect(session).toBeInstanceOf(AuthSession);
      expect(session.accessToken).toBe('access-token');

      expect(RespondToAuthChallengeCommand).toHaveBeenCalledWith({
        ClientId: 'test-client-id',
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: 'challenge-session',
        ChallengeResponses: { NEW_PASSWORD: 'newPassword123' }
      });
    });

    it('should respond to SMS_MFA challenge', async () => {
      const mockResponse = {
        AuthenticationResult: {
          IdToken: 'id-token',
          AccessToken: 'access-token',
          RefreshToken: 'refresh-token',
          ExpiresIn: 3600
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const session = await authAdapter.respondToChallenge(
        'SMS_MFA',
        'mfa-session',
        { SMS_MFA_CODE: '123456' }
      );

      expect(session).toBeInstanceOf(AuthSession);
    });
  });

  // ========== TOKEN OPERATIONS ==========

  describe('getUserFromToken()', () => {
    it('should extract user from access token', async () => {
      const mockResponse = {
        Username: 'user-sub-123',
        UserAttributes: [
          { Name: 'email', Value: 'user@test.com' },
          { Name: 'custom:role', Value: 'admin' },
          { Name: 'email_verified', Value: 'true' }
        ]
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const user = await authAdapter.getUserFromToken('access-token-123');

      expect(user).toMatchObject({
        username: 'user-sub-123',
        email: 'user@test.com',
        role: 'admin',
        emailVerified: true
      });
      expect(user).toHaveProperty('attributes');

      expect(GetUserCommand).toHaveBeenCalledWith({
        AccessToken: 'access-token-123'
      });
    });

    it('should throw TokenExpiredError on expired token', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Access Token has expired';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.getUserFromToken('expired-token'))
        .rejects.toThrow(TokenExpiredError);
    });

    it('should throw InvalidTokenError on invalid token', async () => {
      const mockError = new Error('InvalidParameterException');
      mockError.name = 'InvalidParameterException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.getUserFromToken('invalid-token'))
        .rejects.toThrow(InvalidTokenError);
    });
  });

  describe('validateToken()', () => {
    it('should return true for valid token', async () => {
      const mockResponse = {
        Username: 'user-sub-123',
        UserAttributes: []
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const isValid = await authAdapter.validateToken('valid-token');

      expect(isValid).toBe(true);
    });

    it('should return false for expired token', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Access Token has expired';

      mockSend.mockRejectedValueOnce(mockError);

      const isValid = await authAdapter.validateToken('expired-token');

      expect(isValid).toBe(false);
    });

    it('should return false for invalid token', async () => {
      const mockError = new Error('InvalidParameterException');
      mockError.name = 'InvalidParameterException';

      mockSend.mockRejectedValueOnce(mockError);

      const isValid = await authAdapter.validateToken('invalid-token');

      expect(isValid).toBe(false);
    });
  });

  // ========== FACTORY FUNCTION ==========

  describe('getAuthAdapter()', () => {
    it('should return singleton instance', () => {
      const adapter1 = getAuthAdapter();
      const adapter2 = getAuthAdapter();

      expect(adapter1).toBe(adapter2);
      expect(adapter1).toBeInstanceOf(AuthAdapter);
    });

    it('should create adapter with custom config', () => {
      const customAdapter = getAuthAdapter({
        userPoolId: 'custom-pool',
        clientId: 'custom-client'
      });

      expect(customAdapter).toBeInstanceOf(AuthAdapter);
    });
  });

  // ========== ERROR MAPPING ==========

  describe('Error Mapping', () => {
    it('should map NotAuthorizedException with "Incorrect username" to InvalidCredentialsError', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Incorrect username or password.';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.login('user@test.com', 'wrong'))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('should map NotAuthorizedException with "expired" to TokenExpiredError', async () => {
      const mockError = new Error('NotAuthorizedException');
      mockError.name = 'NotAuthorizedException';
      mockError.message = 'Access Token has expired';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.logout('expired-token'))
        .rejects.toThrow(TokenExpiredError);
    });

    it('should map UserNotFoundException to InvalidCredentialsError', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.login('nonexistent@test.com', 'password'))
        .rejects.toThrow(InvalidCredentialsError);
    });

    it('should map UserNotConfirmedException to UserNotConfirmedError', async () => {
      const mockError = new Error('UserNotConfirmedException');
      mockError.name = 'UserNotConfirmedException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.login('unconfirmed@test.com', 'password'))
        .rejects.toThrow(UserNotConfirmedError);
    });

    it('should map PasswordResetRequiredException to PasswordResetRequiredError', async () => {
      const mockError = new Error('PasswordResetRequiredException');
      mockError.name = 'PasswordResetRequiredException';

      mockSend.mockRejectedValueOnce(mockError);

      try {
        await authAdapter.login('user@test.com', 'temp');
        fail('Should have thrown PasswordResetRequiredError');
      } catch (error) {
        expect(error).toBeInstanceOf(PasswordResetRequiredError);
      }
    });

    it('should map InvalidParameterException to InvalidTokenError', async () => {
      const mockError = new Error('InvalidParameterException');
      mockError.name = 'InvalidParameterException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.refresh('invalid-token'))
        .rejects.toThrow(InvalidTokenError);
    });

    it('should map CodeMismatchException to AuthenticationError', async () => {
      const mockError = new Error('CodeMismatchException');
      mockError.name = 'CodeMismatchException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.confirmForgotPassword('user@test.com', 'wrong', 'newPass'))
        .rejects.toThrow(AuthenticationError);
    });

    it('should map ExpiredCodeException to AuthenticationError', async () => {
      const mockError = new Error('ExpiredCodeException');
      mockError.name = 'ExpiredCodeException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.confirmForgotPassword('user@test.com', '123456', 'newPass'))
        .rejects.toThrow(AuthenticationError);
    });

    it('should map unknown errors to generic AuthenticationError', async () => {
      const mockError = new Error('UnknownException');
      mockError.name = 'UnknownException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(authAdapter.login('user@test.com', 'password'))
        .rejects.toThrow(AuthenticationError);
    });
  });
});
