/**
 * Anti-Corruption Layer: User Adapter
 * 
 * Traduce entre Cognito (AWS) y el modelo de dominio de User.
 * 
 * Propósito:
 * - Aislar handlers de la estructura de datos de Cognito
 * - Facilitar cambio de proveedor (Cognito → Auth0, Firebase, etc.)
 * - Proporcionar modelo de dominio consistente
 * - Simplificar testing (mock solo este adaptador)
 * 
 * Principios:
 * - Handlers NUNCA llaman directamente a Cognito
 * - Solo el adaptador conoce detalles de Cognito
 * - Modelo de dominio NO expone AWS internals
 * - Errores traducidos a excepciones del dominio
 */

const { 
  CognitoIdentityProviderClient, 
  AdminGetUserCommand, 
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const Logger = require("../utils/logger");

/**
 * Domain Model: User
 * Estructura INDEPENDIENTE de Cognito
 */
class User {
  constructor(data) {
    this.userId = data.userId;
    this.email = data.email;
    this.role = data.role || 'USER';
    this.displayName = data.displayName;
    this.phoneNumber = data.phoneNumber;
    this.emailVerified = data.emailVerified || false;
    this.status = data.status; // ACTIVE, DISABLED, PENDING, ARCHIVED
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.metadata = data.metadata || {};
  }

  /**
   * Business logic methods (domain behavior)
   */
  isActive() {
    return this.status === 'ACTIVE';
  }

  isAdmin() {
    return this.role === 'ADMIN';
  }

  canAccessResource(resourceType) {
    // Domain-level authorization logic
    const permissions = {
      'ADMIN': ['ALL'],
      'DOCTOR': ['APPOINTMENTS', 'SPACES', 'PATIENTS'],
      'NURSE': ['APPOINTMENTS', 'PATIENTS'],
      'USER': ['APPOINTMENTS']
    };
    
    return permissions[this.role]?.includes(resourceType) || 
           permissions[this.role]?.includes('ALL');
  }

  toJSON() {
    return {
      userId: this.userId,
      email: this.email,
      role: this.role,
      displayName: this.displayName,
      phoneNumber: this.phoneNumber,
      emailVerified: this.emailVerified,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }
}

/**
 * Domain Exception: User Not Found
 */
class UserNotFoundError extends Error {
  constructor(userId) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
    this.userId = userId;
    this.statusCode = 404;
  }
}

/**
 * Domain Exception: User Already Exists
 */
class UserAlreadyExistsError extends Error {
  constructor(email) {
    super(`User already exists: ${email}`);
    this.name = 'UserAlreadyExistsError';
    this.email = email;
    this.statusCode = 409;
  }
}

/**
 * Domain Exception: Invalid User Data
 */
class InvalidUserDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUserDataError';
    this.statusCode = 400;
  }
}

/**
 * UserAdapter - Anti-Corruption Layer para Cognito
 */
class UserAdapter {
  constructor(options = {}) {
    this.cognito = options.cognitoClient || new CognitoIdentityProviderClient({});
    this.userPoolId = options.userPoolId || process.env.USER_POOL_ID;
    this.logger = options.logger || Logger.create({ component: 'UserAdapter' });
  }

  /**
   * Obtiene usuario por ID
   * @param {string} userId - User ID (Cognito Username)
   * @returns {Promise<User>} - Domain User model
   * @throws {UserNotFoundError} - Si el usuario no existe
   */
  async getUser(userId) {
    try {
      this.logger.debug('Getting user', { userId });

      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId
      });

      const cognitoUser = await this.cognito.send(command);

      // ✅ Traducción: Cognito → Domain Model
      const domainUser = this._toDomainModel(cognitoUser);

      this.logger.info('User retrieved', { userId, role: domainUser.role });
      return domainUser;

    } catch (error) {
      // ✅ Traducción: Cognito errors → Domain exceptions
      if (error.name === 'UserNotFoundException') {
        throw new UserNotFoundError(userId);
      }
      
      this.logger.error('Error getting user', error, { userId });
      throw error;
    }
  }

  /**
   * Lista usuarios con filtros opcionales
   * @param {Object} filters - Filtros del dominio
   * @param {string} filters.role - Filtrar por rol
   * @param {string} filters.status - Filtrar por estado
   * @param {number} filters.limit - Límite de resultados
   * @returns {Promise<User[]>} - Array de usuarios del dominio
   */
  async listUsers(filters = {}) {
    try {
      this.logger.debug('Listing users', { filters });

      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: this._buildCognitoFilter(filters),
        Limit: filters.limit || 60
      });

      const response = await this.cognito.send(command);

      // ✅ Traducción: Cognito Users → Domain Users
      const domainUsers = response.Users.map(u => this._toDomainModel(u));

      // Aplicar filtros adicionales del dominio (que Cognito no soporta)
      let filtered = domainUsers;
      
      if (filters.status) {
        filtered = filtered.filter(u => u.status === filters.status);
      }

      this.logger.info('Users listed', { 
        count: filtered.length, 
        filters 
      });

      return filtered;

    } catch (error) {
      this.logger.error('Error listing users', error, { filters });
      throw error;
    }
  }

  /**
   * Crea nuevo usuario
   * @param {Object} userData - Datos del usuario (domain model)
   * @returns {Promise<User>} - Usuario creado
   * @throws {UserAlreadyExistsError} - Si el usuario ya existe
   * @throws {InvalidUserDataError} - Si los datos son inválidos
   */
  async createUser(userData) {
    try {
      // ✅ Validación del dominio
      this._validateUserData(userData);

      this.logger.debug('Creating user', { email: userData.email });

      // ✅ Traducción: Domain → Cognito
      const command = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: userData.email,
        UserAttributes: [
          { Name: 'email', Value: userData.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:role', Value: userData.role || 'USER' }
        ],
        DesiredDeliveryMediums: ['EMAIL'],
        MessageAction: 'SUPPRESS' // No enviar email automático
      });

      if (userData.displayName) {
        command.input.UserAttributes.push({
          Name: 'name',
          Value: userData.displayName
        });
      }

      if (userData.phoneNumber) {
        command.input.UserAttributes.push({
          Name: 'phone_number',
          Value: userData.phoneNumber
        });
      }

      const result = await this.cognito.send(command);

      this.logger.info('User created', { 
        userId: result.User.Username,
        role: userData.role 
      });

      // Obtener usuario completo y retornar como domain model
      return await this.getUser(result.User.Username);

    } catch (error) {
      // ✅ Traducción: Cognito errors → Domain exceptions
      if (error.name === 'UsernameExistsException') {
        throw new UserAlreadyExistsError(userData.email);
      }

      this.logger.error('Error creating user', error, { email: userData.email });
      throw error;
    }
  }

  /**
   * Actualiza atributos del usuario
   * @param {string} userId - User ID
   * @param {Object} updates - Campos a actualizar (domain model)
   * @returns {Promise<User>} - Usuario actualizado
   */
  async updateUser(userId, updates) {
    try {
      this.logger.debug('Updating user', { userId, updates });

      // ✅ Traducción: Domain updates → Cognito attributes
      const attributes = [];

      if (updates.role) {
        attributes.push({ Name: 'custom:role', Value: updates.role });
      }

      if (updates.displayName) {
        attributes.push({ Name: 'name', Value: updates.displayName });
      }

      if (updates.phoneNumber) {
        attributes.push({ Name: 'phone_number', Value: updates.phoneNumber });
      }

      if (updates.email) {
        attributes.push({ Name: 'email', Value: updates.email });
        attributes.push({ Name: 'email_verified', Value: 'true' });
      }

      if (attributes.length > 0) {
        const command = new AdminUpdateUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: userId,
          UserAttributes: attributes
        });

        await this.cognito.send(command);
      }

      this.logger.info('User updated', { userId, fieldsUpdated: attributes.length });

      // Retornar usuario actualizado
      return await this.getUser(userId);

    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw new UserNotFoundError(userId);
      }

      this.logger.error('Error updating user', error, { userId });
      throw error;
    }
  }

  /**
   * Habilita usuario (cambia estado a ACTIVE)
   * @param {string} userId - User ID
   * @returns {Promise<User>} - Usuario habilitado
   */
  async enableUser(userId) {
    try {
      this.logger.debug('Enabling user', { userId });

      const command = new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId
      });

      await this.cognito.send(command);

      this.logger.info('User enabled', { userId });
      return await this.getUser(userId);

    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw new UserNotFoundError(userId);
      }

      this.logger.error('Error enabling user', error, { userId });
      throw error;
    }
  }

  /**
   * Deshabilita usuario (cambia estado a DISABLED)
   * @param {string} userId - User ID
   * @returns {Promise<User>} - Usuario deshabilitado
   */
  async disableUser(userId) {
    try {
      this.logger.debug('Disabling user', { userId });

      const command = new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId
      });

      await this.cognito.send(command);

      this.logger.info('User disabled', { userId });
      return await this.getUser(userId);

    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw new UserNotFoundError(userId);
      }

      this.logger.error('Error disabling user', error, { userId });
      throw error;
    }
  }

  /**
   * Elimina usuario (SOFT DELETE: deshabilita en lugar de eliminar)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteUser(userId) {
    try {
      this.logger.debug('Deleting user', { userId });

      // Por seguridad, usar soft delete (deshabilitar) en lugar de eliminar
      await this.disableUser(userId);

      // Si se requiere hard delete (permanente), descomentar:
      // const command = new AdminDeleteUserCommand({
      //   UserPoolId: this.userPoolId,
      //   Username: userId
      // });
      // await this.cognito.send(command);

      this.logger.info('User deleted (soft delete)', { userId });

    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw new UserNotFoundError(userId);
      }

      this.logger.error('Error deleting user', error, { userId });
      throw error;
    }
  }

  /**
   * Busca usuarios por email
   * @param {string} email - Email a buscar
   * @returns {Promise<User[]>} - Usuarios encontrados
   */
  async findByEmail(email) {
    try {
      this.logger.debug('Finding users by email', { email });

      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `email = "${email}"`
      });

      const response = await this.cognito.send(command);
      const domainUsers = response.Users.map(u => this._toDomainModel(u));

      this.logger.info('Users found by email', { 
        email, 
        count: domainUsers.length 
      });

      return domainUsers;

    } catch (error) {
      this.logger.error('Error finding users by email', error, { email });
      throw error;
    }
  }

  /**
   * Busca usuarios por rol
   * @param {string} role - Rol a buscar (ADMIN, DOCTOR, NURSE, USER)
   * @returns {Promise<User[]>} - Usuarios con ese rol
   */
  async findByRole(role) {
    return await this.listUsers({ role });
  }

  // ========== INTERNAL METHODS (Traducción Cognito ↔ Domain) ==========

  /**
   * Traduce estructura Cognito → Modelo de dominio
   * ✅ AISLAMIENTO: Si Cognito cambia estructura, solo modificar aquí
   */
  _toDomainModel(cognitoUser) {
    // Cognito puede retornar UserAttributes o Attributes dependiendo del comando
    const attributes = this._parseAttributes(
      cognitoUser.UserAttributes || cognitoUser.Attributes || []
    );

    return new User({
      userId: cognitoUser.Username,
      email: attributes.email || cognitoUser.Username,
      role: attributes['custom:role'] || 'USER',
      displayName: attributes.name || attributes.email,
      phoneNumber: attributes.phone_number,
      emailVerified: attributes.email_verified === 'true',
      status: this._mapCognitoStatus(cognitoUser),
      createdAt: cognitoUser.UserCreateDate,
      updatedAt: cognitoUser.UserLastModifiedDate,
      metadata: {
        // Metadata adicional (nunca exponer en API pública)
        _provider: 'cognito',
        _cognitoStatus: cognitoUser.UserStatus,
        _enabled: cognitoUser.Enabled
      }
    });
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
   * Mapea estados de Cognito → Estados del dominio
   */
  _mapCognitoStatus(cognitoUser) {
    // Cognito UserStatus: UNCONFIRMED, CONFIRMED, ARCHIVED, COMPROMISED, etc.
    // Domain Status: ACTIVE, DISABLED, PENDING, ARCHIVED

    if (cognitoUser.Enabled === false) {
      return 'DISABLED';
    }

    if (cognitoUser.UserStatus === 'ARCHIVED') {
      return 'ARCHIVED';
    }

    if (cognitoUser.UserStatus === 'UNCONFIRMED') {
      return 'PENDING';
    }

    if (cognitoUser.UserStatus === 'CONFIRMED' || cognitoUser.UserStatus === 'FORCE_CHANGE_PASSWORD') {
      return 'ACTIVE';
    }

    // Default
    return 'ACTIVE';
  }

  /**
   * Construye filtro de Cognito desde filtros del dominio
   */
  _buildCognitoFilter(domainFilters) {
    // Cognito solo soporta filtros limitados (email, phone_number, custom attributes)
    
    if (domainFilters.role) {
      return `custom:role = "${domainFilters.role}"`;
    }

    if (domainFilters.email) {
      return `email = "${domainFilters.email}"`;
    }

    return undefined; // Sin filtro
  }

  /**
   * Valida datos del usuario (domain-level validation)
   */
  _validateUserData(userData) {
    if (!userData.email) {
      throw new InvalidUserDataError('Email is required');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      throw new InvalidUserDataError('Invalid email format');
    }

    if (userData.role && !['ADMIN', 'DOCTOR', 'NURSE', 'USER'].includes(userData.role)) {
      throw new InvalidUserDataError(`Invalid role: ${userData.role}`);
    }

    if (userData.phoneNumber && !/^\+[1-9]\d{1,14}$/.test(userData.phoneNumber)) {
      throw new InvalidUserDataError('Phone number must be in E.164 format (+1234567890)');
    }
  }
}

// ========== EXPORTS ==========

/**
 * Factory para crear instancia singleton del adapter
 */
let _instance = null;

function getUserAdapter(options = {}) {
  if (!_instance) {
    _instance = new UserAdapter(options);
  }
  return _instance;
}

module.exports = {
  UserAdapter,
  getUserAdapter,
  User,
  // Domain Exceptions
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidUserDataError
};
