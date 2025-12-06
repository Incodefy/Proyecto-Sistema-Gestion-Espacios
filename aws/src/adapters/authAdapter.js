/**
 * Anti-Corruption Layer: Auth Adapter
 * 
 * Traduce entre Cognito Authentication (AWS) y el modelo de dominio de Auth.
 * 
 * Propósito:
 * - Aislar handlers de la autenticación específica de Cognito
 * - Facilitar cambio de proveedor (Cognito → Auth0, Firebase, Okta, etc.)
 * - Proporcionar modelo de dominio de autenticación consistente
 * - Simplificar testing (mock solo este adaptador)
 * 
 * Principios:
 * - Handlers NUNCA llaman directamente a Cognito auth commands
 * - Solo el adaptador conoce detalles de InitiateAuth, RespondToAuthChallenge, etc.
 * - Modelo de dominio NO expone AWS internals (ChallengeParameters, etc.)
 * - Errores traducidos a excepciones del dominio
 * 
 * Features:
 * - Login (email/password)
 * - Refresh tokens
 * - Logout
 * - Password change/reset
 * - MFA verification
 * - Token validation
 */

const { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GlobalSignOutCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const Logger = require("../utils/logger");

/**
 * Domain Model: AuthSession
 * Estructura INDEPENDIENTE de Cognito
 */
class AuthSession {
  constructor(data) {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.idToken = data.idToken;
    this.tokenType = data.tokenType || 'Bearer';
    this.expiresIn = data.expiresIn; // Seconds until expiration
    this.expiresAt = data.expiresAt || this._calculateExpiration(data.expiresIn);
    this.user = data.user; // User info from ID token
    this.challengeName = data.challengeName; // NEW_PASSWORD_REQUIRED, MFA, etc.
    this.challengeParameters = data.challengeParameters;
    this.session = data.session; // Challenge session token
  }

  _calculateExpiration(expiresIn) {
    if (!expiresIn) return null;
    return new Date(Date.now() + expiresIn * 1000).toISOString();
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) <= new Date();
  }

  requiresChallenge() {
    return !!this.challengeName;
  }

  toJSON() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      idToken: this.idToken,
      tokenType: this.tokenType,
      expiresIn: this.expiresIn,
      expiresAt: this.expiresAt,
      user: this.user,
      challengeName: this.challengeName,
      challengeParameters: this.challengeParameters
      // session omitted (internal use only)
    };
  }
}

/**
 * Domain Model: TokenSet
 * Para operaciones de refresh (sin refresh token)
 */
class TokenSet {
  constructor(data) {
    this.accessToken = data.accessToken;
    this.idToken = data.idToken;
    this.tokenType = data.tokenType || 'Bearer';
    this.expiresIn = data.expiresIn;
    this.expiresAt = data.expiresAt || this._calculateExpiration(data.expiresIn);
  }

  _calculateExpiration(expiresIn) {
    if (!expiresIn) return null;
    return new Date(Date.now() + expiresIn * 1000).toISOString();
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) <= new Date();
  }

  toJSON() {
    return {
      accessToken: this.accessToken,
      idToken: this.idToken,
      tokenType: this.tokenType,
      expiresIn: this.expiresIn,
      expiresAt: this.expiresAt
    };
  }
}

/**
 * Domain Exceptions
 */
class AuthenticationError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'AuthenticationError';
    this.originalError = originalError;
    this.statusCode = 401;
  }
}

class InvalidCredentialsError extends AuthenticationError {
  constructor(message = 'Invalid username or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

class TokenExpiredError extends AuthenticationError {
  constructor(message = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

class InvalidTokenError extends AuthenticationError {
  constructor(message = 'Invalid or malformed token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

class UserNotConfirmedError extends AuthenticationError {
  constructor(message = 'User account not confirmed') {
    super(message);
    this.name = 'UserNotConfirmedError';
    this.statusCode = 403;
  }
}

class PasswordResetRequiredError extends AuthenticationError {
  constructor(message = 'Password reset required') {
    super(message);
    this.name = 'PasswordResetRequiredError';
    this.statusCode = 403;
  }
}

class MFARequiredError extends AuthenticationError {
  constructor(message = 'MFA verification required', session, challengeParameters) {
    super(message);
    this.name = 'MFARequiredError';
    this.session = session;
    this.challengeParameters = challengeParameters;
    this.statusCode = 403;
  }
}

/**
 * AuthAdapter - Anti-Corruption Layer para Cognito Authentication
 */
class AuthAdapter {
  constructor(options = {}) {
    this.cognito = options.cognitoClient || new CognitoIdentityProviderClient({});
    this.userPoolId = options.userPoolId || process.env.USER_POOL_ID;
    this.clientId = options.clientId || process.env.USER_POOL_CLIENT_ID;
    this.logger = options.logger || Logger.create({ component: 'AuthAdapter' });
  }

  /**
   * Login con email y password
   * @param {string} email - Email del usuario
   * @param {string} password - Password
   * @returns {Promise<AuthSession>} - Sesión de autenticación
   * @throws {InvalidCredentialsError} - Credenciales inválidas
   * @throws {UserNotConfirmedError} - Usuario no confirmado
   * @throws {MFARequiredError} - MFA requerido
   */
  async login(email, password) {
    try {
      this.logger.debug('Attempting login', { email });

      // ✅ Llamada a Cognito
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const result = await this.cognito.send(command);

      // ✅ Traducción: Cognito response → Domain AuthSession
      const authSession = this._toAuthSession(result);

      // Check for challenges
      if (authSession.requiresChallenge()) {
        this.logger.info('Login requires challenge', { 
          challenge: authSession.challengeName,
          email 
        });

        // Handle specific challenges
        if (authSession.challengeName === 'NEW_PASSWORD_REQUIRED') {
          throw new PasswordResetRequiredError('New password required');
        }

        if (authSession.challengeName === 'SMS_MFA' || authSession.challengeName === 'SOFTWARE_TOKEN_MFA') {
          throw new MFARequiredError(
            'MFA verification required',
            authSession.session,
            authSession.challengeParameters
          );
        }
      }

      this.logger.info('Login successful', { email });
      return authSession;

    } catch (error) {
      // ✅ Si ya es una excepción de dominio, re-lanzarla sin modificar
      if (error instanceof PasswordResetRequiredError || 
          error instanceof MFARequiredError ||
          error instanceof InvalidCredentialsError ||
          error instanceof UserNotConfirmedError ||
          error instanceof TokenExpiredError ||
          error instanceof InvalidTokenError) {
        throw error;
      }

      // ✅ Traducción: Cognito errors → Domain exceptions
      return this._handleAuthError(error, 'login', { email });
    }
  }

  /**
   * Refresh tokens usando refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<TokenSet>} - Nuevos tokens (sin refresh token)
   * @throws {TokenExpiredError} - Refresh token expirado
   * @throws {InvalidTokenError} - Refresh token inválido
   */
  async refresh(refreshToken) {
    try {
      this.logger.debug('Refreshing tokens');

      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      });

      const result = await this.cognito.send(command);

      // ✅ Traducción: Cognito response → Domain TokenSet
      const tokenSet = this._toTokenSet(result);

      this.logger.info('Tokens refreshed successfully');
      return tokenSet;

    } catch (error) {
      return this._handleAuthError(error, 'refresh');
    }
  }

  /**
   * Logout global (invalida todos los tokens)
   * @param {string} accessToken - Access token del usuario
   * @returns {Promise<void>}
   */
  async logout(accessToken) {
    try {
      this.logger.debug('Logging out user');

      const command = new GlobalSignOutCommand({
        AccessToken: accessToken
      });

      await this.cognito.send(command);

      this.logger.info('User logged out successfully');

    } catch (error) {
      return this._handleAuthError(error, 'logout');
    }
  }

  /**
   * Cambia password del usuario autenticado
   * @param {string} accessToken - Access token
   * @param {string} oldPassword - Password actual
   * @param {string} newPassword - Nueva password
   * @returns {Promise<void>}
   */
  async changePassword(accessToken, oldPassword, newPassword) {
    try {
      this.logger.debug('Changing password');

      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: oldPassword,
        ProposedPassword: newPassword
      });

      await this.cognito.send(command);

      this.logger.info('Password changed successfully');

    } catch (error) {
      return this._handleAuthError(error, 'changePassword');
    }
  }

  /**
   * Inicia proceso de reset de password (envía código por email)
   * @param {string} email - Email del usuario
   * @returns {Promise<{codeDeliveryDetails: Object}>}
   */
  async forgotPassword(email) {
    try {
      this.logger.debug('Initiating password reset', { email });

      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email
      });

      const result = await this.cognito.send(command);

      this.logger.info('Password reset initiated', { email });

      // ✅ Traducción: Cognito response → Domain model
      return {
        codeDeliveryDetails: {
          destination: result.CodeDeliveryDetails?.Destination,
          deliveryMedium: result.CodeDeliveryDetails?.DeliveryMedium,
          attributeName: result.CodeDeliveryDetails?.AttributeName
        }
      };

    } catch (error) {
      return this._handleAuthError(error, 'forgotPassword', { email });
    }
  }

  /**
   * Confirma reset de password con código
   * @param {string} email - Email del usuario
   * @param {string} code - Código recibido por email
   * @param {string} newPassword - Nueva password
   * @returns {Promise<void>}
   */
  async confirmForgotPassword(email, code, newPassword) {
    try {
      this.logger.debug('Confirming password reset', { email });

      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword
      });

      await this.cognito.send(command);

      this.logger.info('Password reset confirmed', { email });

    } catch (error) {
      return this._handleAuthError(error, 'confirmForgotPassword', { email });
    }
  }

  /**
   * Responde a challenge (NEW_PASSWORD_REQUIRED, MFA, etc.)
   * @param {string} challengeName - Nombre del challenge
   * @param {string} session - Session token del challenge
   * @param {Object} challengeResponses - Respuestas al challenge
   * @returns {Promise<AuthSession>}
   */
  async respondToChallenge(challengeName, session, challengeResponses) {
    try {
      this.logger.debug('Responding to auth challenge', { challengeName });

      const command = new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: challengeName,
        Session: session,
        ChallengeResponses: challengeResponses
      });

      const result = await this.cognito.send(command);

      // ✅ Traducción: Cognito response → Domain AuthSession
      const authSession = this._toAuthSession(result);

      this.logger.info('Challenge response successful', { challengeName });
      return authSession;

    } catch (error) {
      return this._handleAuthError(error, 'respondToChallenge', { challengeName });
    }
  }

  /**
   * Obtiene información del usuario desde access token
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} - User attributes
   */
  async getUserFromToken(accessToken) {
    try {
      this.logger.debug('Getting user from token');

      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const result = await this.cognito.send(command);

      // ✅ Traducción: Cognito user attributes → Domain user
      const attributes = this._parseAttributes(result.UserAttributes || []);

      const user = {
        username: result.Username,
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        phoneNumber: attributes.phone_number,
        phoneNumberVerified: attributes.phone_number_verified === 'true',
        sub: attributes.sub,
        role: attributes['custom:role'] || 'USER',
        name: attributes.name,
        // Additional attributes
        attributes: attributes
      };

      this.logger.info('User retrieved from token', { username: user.username });
      return user;

    } catch (error) {
      return this._handleAuthError(error, 'getUserFromToken');
    }
  }

  /**
   * Valida access token (verifica que no esté expirado/inválido)
   * @param {string} accessToken - Access token
   * @returns {Promise<boolean>} - true si válido
   */
  async validateToken(accessToken) {
    try {
      await this.getUserFromToken(accessToken);
      return true;
    } catch (error) {
      if (error instanceof InvalidTokenError || error instanceof TokenExpiredError) {
        return false;
      }
      throw error;
    }
  }

  // ========== INTERNAL METHODS (Traducción Cognito ↔ Domain) ==========

  /**
   * Traduce Cognito InitiateAuth/RespondToChallenge → AuthSession
   */
  _toAuthSession(cognitoResult) {
    // Si hay challenge, retornar session con challenge info
    if (cognitoResult.ChallengeName) {
      return new AuthSession({
        challengeName: cognitoResult.ChallengeName,
        challengeParameters: cognitoResult.ChallengeParameters,
        session: cognitoResult.Session,
        accessToken: null,
        refreshToken: null,
        idToken: null
      });
    }

    // Si hay tokens, retornar session completa
    const authResult = cognitoResult.AuthenticationResult;
    if (!authResult) {
      throw new Error('No authentication result or challenge in response');
    }

    return new AuthSession({
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
      idToken: authResult.IdToken,
      tokenType: authResult.TokenType,
      expiresIn: authResult.ExpiresIn,
      user: this._parseIdToken(authResult.IdToken)
    });
  }

  /**
   * Traduce Cognito refresh response → TokenSet
   */
  _toTokenSet(cognitoResult) {
    const authResult = cognitoResult.AuthenticationResult;
    if (!authResult) {
      throw new Error('No authentication result in refresh response');
    }

    return new TokenSet({
      accessToken: authResult.AccessToken,
      idToken: authResult.IdToken,
      tokenType: authResult.TokenType,
      expiresIn: authResult.ExpiresIn
    });
  }

  /**
   * Parsea ID token JWT (simple, sin verificación de firma)
   * NOTA: En producción, usar librería JWT con verificación completa
   */
  _parseIdToken(idToken) {
    if (!idToken) return null;

    try {
      const payload = idToken.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());

      return {
        sub: decoded.sub,
        email: decoded.email,
        emailVerified: decoded.email_verified,
        role: decoded['custom:role'] || 'USER',
        name: decoded.name,
        exp: decoded.exp,
        iat: decoded.iat
      };
    } catch (error) {
      this.logger.warn('Failed to parse ID token', error);
      return null;
    }
  }

  /**
   * Parsea atributos de Cognito a objeto simple
   */
  _parseAttributes(attrs) {
    return attrs.reduce((acc, attr) => {
      acc[attr.Name] = attr.Value;
      return acc;
    }, {});
  }

  /**
   * Maneja errores de Cognito y los traduce a excepciones del dominio
   */
  _handleAuthError(error, operation, context = {}) {
    this.logger.error(`Auth error during ${operation}`, error, context);

    // ✅ Traducción: Cognito errors → Domain exceptions

    // Credenciales inválidas
    if (error.name === 'NotAuthorizedException') {
      if (error.message.includes('Incorrect username or password')) {
        throw new InvalidCredentialsError();
      }
      if (error.message.includes('expired')) {
        throw new TokenExpiredError();
      }
      throw new AuthenticationError(error.message, error);
    }

    // Usuario no confirmado
    if (error.name === 'UserNotConfirmedException') {
      throw new UserNotConfirmedError();
    }

    // Password reset requerido
    if (error.name === 'PasswordResetRequiredException') {
      throw new PasswordResetRequiredError('Password reset is required');
    }

    // Token expirado
    if (error.name === 'TokenExpiredException' || error.message?.includes('expired')) {
      throw new TokenExpiredError();
    }

    // Token inválido
    if (error.name === 'InvalidParameterException' || error.message?.includes('token')) {
      throw new InvalidTokenError(error.message);
    }

    // Usuario no existe
    if (error.name === 'UserNotFoundException') {
      throw new InvalidCredentialsError('Invalid username or password');
    }

    // Password policy violation
    if (error.name === 'InvalidPasswordException') {
      throw new AuthenticationError(`Password does not meet requirements: ${error.message}`, error);
    }

    // Código inválido (forgot password)
    if (error.name === 'CodeMismatchException') {
      throw new AuthenticationError('Invalid verification code', error);
    }

    // Código expirado
    if (error.name === 'ExpiredCodeException') {
      throw new AuthenticationError('Verification code has expired', error);
    }

    // Generic error
    throw new AuthenticationError(`Authentication failed: ${error.message}`, error);
  }
}

// ========== EXPORTS ==========

/**
 * Factory para crear instancia singleton del adapter
 */
let _instance = null;

function getAuthAdapter(options = {}) {
  if (!_instance) {
    _instance = new AuthAdapter(options);
  }
  return _instance;
}

module.exports = {
  AuthAdapter,
  getAuthAdapter,
  AuthSession,
  TokenSet,
  // Domain Exceptions
  AuthenticationError,
  InvalidCredentialsError,
  TokenExpiredError,
  InvalidTokenError,
  UserNotConfirmedError,
  PasswordResetRequiredError,
  MFARequiredError
};
