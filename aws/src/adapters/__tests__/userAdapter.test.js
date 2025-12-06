/**
 * UserAdapter Unit Tests
 * 
 * Tests para el Anti-Corruption Layer de gestión de usuarios Cognito
 * 
 * Coverage:
 * - Domain model transformations (User)
 * - Error mapping (Cognito errors → Domain exceptions)
 * - All public methods (getUser, listUsers, createUser, updateUser, etc.)
 * - Business logic methods (isActive, isAdmin, canAccessResource)
 * - Filter building (_buildCognitoFilter)
 */

const {
  getUserAdapter,
  UserAdapter,
  User,
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidUserDataError
} = require('../userAdapter');

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
  AdminGetUserCommand,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

describe('UserAdapter', () => {
  let userAdapter;
  let mockCognitoClient;
  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSend = jest.fn();
    mockCognitoClient = {
      send: mockSend
    };

    CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

    userAdapter = new UserAdapter({
      userPoolId: 'us-east-1_test123'
    });
  });

  // ========== DOMAIN MODEL ==========

  describe('User Domain Model', () => {
    it('should create User with all properties', () => {
      const user = new User({
        userId: 'user-123',
        email: 'user@test.com',
        role: 'admin',
        displayName: 'John Doe',
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
        lastModified: '2024-01-02T00:00:00Z',
        emailVerified: true,
        phone: '+1234567890',
        attributes: { department: 'IT' }
      });

      expect(user.userId).toBe('user-123');
      expect(user.email).toBe('user@test.com');
      expect(user.role).toBe('admin');
      expect(user.displayName).toBe('John Doe');
      expect(user.status).toBe('ACTIVE');
      expect(user.emailVerified).toBe(true);
    });

    it('should check if user is active', () => {
      const activeUser = new User({ userId: '1', status: 'ACTIVE' });
      const inactiveUser = new User({ userId: '2', status: 'DISABLED' });

      expect(activeUser.isActive()).toBe(true);
      expect(inactiveUser.isActive()).toBe(false);
    });

    it('should check if user is admin', () => {
      const admin = new User({ userId: '1', role: 'admin' });
      const user = new User({ userId: '2', role: 'user' });

      expect(admin.isAdmin()).toBe(true);
      expect(user.isAdmin()).toBe(false);
    });

    it('should check resource access', () => {
      const owner = new User({ userId: 'user-123' });
      const otherUser = new User({ userId: 'user-456' });

      expect(owner.canAccessResource('user-123')).toBe(true);
      expect(otherUser.canAccessResource('user-123')).toBe(false);
    });

    it('should convert to JSON', () => {
      const user = new User({
        userId: 'user-123',
        email: 'user@test.com',
        role: 'user',
        status: 'ACTIVE'
      });

      const json = user.toJSON();
      expect(json).toEqual({
        userId: 'user-123',
        email: 'user@test.com',
        role: 'user',
        displayName: undefined,
        status: 'ACTIVE',
        createdAt: undefined,
        lastModified: undefined,
        emailVerified: undefined,
        phone: undefined,
        attributes: undefined
      });
    });
  });

  // ========== GET USER METHOD ==========

  describe('getUser()', () => {
    it('should return User domain model on success', async () => {
      const mockResponse = {
        Username: 'user-sub-123',
        UserAttributes: [
          { Name: 'email', Value: 'user@test.com' },
          { Name: 'custom:role', Value: 'admin' },
          { Name: 'name', Value: 'John Doe' },
          { Name: 'email_verified', Value: 'true' }
        ],
        UserStatus: 'CONFIRMED',
        UserCreateDate: new Date('2024-01-01'),
        UserLastModifiedDate: new Date('2024-01-02')
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const user = await userAdapter.getUser('user-sub-123');

      expect(user).toBeInstanceOf(User);
      expect(user.userId).toBe('user-sub-123');
      expect(user.email).toBe('user@test.com');
      expect(user.role).toBe('admin');
      expect(user.displayName).toBe('John Doe');
      expect(user.status).toBe('ACTIVE');
      expect(user.emailVerified).toBe(true);

      expect(AdminGetUserCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Username: 'user-sub-123'
      });
    });

    it('should throw UserNotFoundError when user not found', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.getUser('nonexistent-user'))
        .rejects.toThrow(UserNotFoundError);
    });

    it('should map Cognito status to domain status', async () => {
      const mockResponse = {
        Username: 'user-123',
        UserAttributes: [{ Name: 'email', Value: 'user@test.com' }],
        UserStatus: 'FORCE_CHANGE_PASSWORD'
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const user = await userAdapter.getUser('user-123');
      expect(user.status).toBe('PENDING');
    });
  });

  // ========== LIST USERS METHOD ==========

  describe('listUsers()', () => {
    it('should return array of User domain models', async () => {
      const mockResponse = {
        Users: [
          {
            Username: 'user-1',
            UserAttributes: [
              { Name: 'email', Value: 'user1@test.com' },
              { Name: 'custom:role', Value: 'admin' }
            ],
            UserStatus: 'CONFIRMED'
          },
          {
            Username: 'user-2',
            UserAttributes: [
              { Name: 'email', Value: 'user2@test.com' },
              { Name: 'custom:role', Value: 'user' }
            ],
            UserStatus: 'CONFIRMED'
          }
        ]
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const users = await userAdapter.listUsers();

      expect(users).toHaveLength(2);
      expect(users[0]).toBeInstanceOf(User);
      expect(users[0].email).toBe('user1@test.com');
      expect(users[1].email).toBe('user2@test.com');
    });

    it('should support pagination with limit and token', async () => {
      const mockResponse = {
        Users: [],
        PaginationToken: 'next-page-token'
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      await userAdapter.listUsers({ limit: 10, paginationToken: 'prev-token' });

      expect(ListUsersCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Limit: 10,
        PaginationToken: 'prev-token'
      });
    });

    it('should apply filter for role', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] });

      await userAdapter.listUsers({ filter: { role: 'admin' } });

      expect(ListUsersCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Filter: 'custom:role = "admin"'
      });
    });

    it('should apply filter for email', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] });

      await userAdapter.listUsers({ filter: { email: 'test@test.com' } });

      expect(ListUsersCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Filter: 'email = "test@test.com"'
      });
    });

    it('should return empty array when no users found', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] });

      const users = await userAdapter.listUsers();

      expect(users).toEqual([]);
    });
  });

  // ========== CREATE USER METHOD ==========

  describe('createUser()', () => {
    it('should create user and return User domain model', async () => {
      const mockResponse = {
        User: {
          Username: 'new-user-123',
          UserAttributes: [
            { Name: 'email', Value: 'newuser@test.com' },
            { Name: 'custom:role', Value: 'user' }
          ],
          UserStatus: 'FORCE_CHANGE_PASSWORD'
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const user = await userAdapter.createUser({
        email: 'newuser@test.com',
        role: 'user',
        displayName: 'New User',
        temporaryPassword: 'TempPass123!'
      });

      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('newuser@test.com');
      expect(user.role).toBe('user');
      expect(user.status).toBe('PENDING');

      expect(AdminCreateUserCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Username: 'newuser@test.com',
        UserAttributes: [
          { Name: 'email', Value: 'newuser@test.com' },
          { Name: 'custom:role', Value: 'user' },
          { Name: 'name', Value: 'New User' }
        ],
        TemporaryPassword: 'TempPass123!',
        MessageAction: 'SUPPRESS'
      });
    });

    it('should throw UserAlreadyExistsError when user exists', async () => {
      const mockError = new Error('UsernameExistsException');
      mockError.name = 'UsernameExistsException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.createUser({
        email: 'existing@test.com',
        role: 'user'
      })).rejects.toThrow(UserAlreadyExistsError);
    });

    it('should throw InvalidUserDataError on invalid data', async () => {
      const mockError = new Error('InvalidParameterException');
      mockError.name = 'InvalidParameterException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.createUser({
        email: 'invalid-email',
        role: 'user'
      })).rejects.toThrow(InvalidUserDataError);
    });

    it('should support optional attributes', async () => {
      const mockResponse = {
        User: {
          Username: 'user-123',
          UserAttributes: [
            { Name: 'email', Value: 'user@test.com' },
            { Name: 'custom:role', Value: 'admin' },
            { Name: 'phone_number', Value: '+1234567890' }
          ],
          UserStatus: 'CONFIRMED'
        }
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      await userAdapter.createUser({
        email: 'user@test.com',
        role: 'admin',
        phone: '+1234567890',
        customAttributes: { department: 'IT' }
      });

      const callArgs = AdminCreateUserCommand.mock.calls[0][0];
      expect(callArgs.UserAttributes).toContainEqual(
        { Name: 'phone_number', Value: '+1234567890' }
      );
    });
  });

  // ========== UPDATE USER METHOD ==========

  describe('updateUser()', () => {
    it('should update user attributes', async () => {
      mockSend.mockResolvedValueOnce({});

      await userAdapter.updateUser('user-123', {
        role: 'admin',
        displayName: 'Updated Name'
      });

      expect(AdminUpdateUserAttributesCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Username: 'user-123',
        UserAttributes: [
          { Name: 'custom:role', Value: 'admin' },
          { Name: 'name', Value: 'Updated Name' }
        ]
      });
    });

    it('should throw UserNotFoundError when user not found', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.updateUser('nonexistent', { role: 'admin' }))
        .rejects.toThrow(UserNotFoundError);
    });

    it('should update only provided attributes', async () => {
      mockSend.mockResolvedValueOnce({});

      await userAdapter.updateUser('user-123', { role: 'moderator' });

      const callArgs = AdminUpdateUserAttributesCommand.mock.calls[0][0];
      expect(callArgs.UserAttributes).toEqual([
        { Name: 'custom:role', Value: 'moderator' }
      ]);
    });
  });

  // ========== ENABLE/DISABLE USER METHODS ==========

  describe('enableUser()', () => {
    it('should enable user', async () => {
      mockSend.mockResolvedValueOnce({});

      await userAdapter.enableUser('user-123');

      expect(AdminEnableUserCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Username: 'user-123'
      });
    });

    it('should throw UserNotFoundError when user not found', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.enableUser('nonexistent'))
        .rejects.toThrow(UserNotFoundError);
    });
  });

  describe('disableUser()', () => {
    it('should disable user', async () => {
      mockSend.mockResolvedValueOnce({});

      await userAdapter.disableUser('user-123');

      expect(AdminDisableUserCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Username: 'user-123'
      });
    });

    it('should throw UserNotFoundError when user not found', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.disableUser('nonexistent'))
        .rejects.toThrow(UserNotFoundError);
    });
  });

  // ========== FIND METHODS ==========

  describe('findByEmail()', () => {
    it('should find user by email', async () => {
      const mockResponse = {
        Users: [
          {
            Username: 'user-123',
            UserAttributes: [
              { Name: 'email', Value: 'test@test.com' },
              { Name: 'custom:role', Value: 'user' }
            ],
            UserStatus: 'CONFIRMED'
          }
        ]
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const user = await userAdapter.findByEmail('test@test.com');

      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('test@test.com');

      expect(ListUsersCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Filter: 'email = "test@test.com"',
        Limit: 1
      });
    });

    it('should return null when user not found', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] });

      const user = await userAdapter.findByEmail('nonexistent@test.com');

      expect(user).toBeNull();
    });
  });

  describe('findByRole()', () => {
    it('should find users by role', async () => {
      const mockResponse = {
        Users: [
          {
            Username: 'admin-1',
            UserAttributes: [
              { Name: 'email', Value: 'admin1@test.com' },
              { Name: 'custom:role', Value: 'admin' }
            ],
            UserStatus: 'CONFIRMED'
          },
          {
            Username: 'admin-2',
            UserAttributes: [
              { Name: 'email', Value: 'admin2@test.com' },
              { Name: 'custom:role', Value: 'admin' }
            ],
            UserStatus: 'CONFIRMED'
          }
        ]
      };

      mockSend.mockResolvedValueOnce(mockResponse);

      const users = await userAdapter.findByRole('admin');

      expect(users).toHaveLength(2);
      expect(users[0].role).toBe('admin');
      expect(users[1].role).toBe('admin');

      expect(ListUsersCommand).toHaveBeenCalledWith({
        UserPoolId: 'us-east-1_test123',
        Filter: 'custom:role = "admin"'
      });
    });

    it('should return empty array when no users found', async () => {
      mockSend.mockResolvedValueOnce({ Users: [] });

      const users = await userAdapter.findByRole('superadmin');

      expect(users).toEqual([]);
    });
  });

  // ========== STATUS MAPPING ==========

  describe('Status Mapping', () => {
    it('should map CONFIRMED to ACTIVE', async () => {
      mockSend.mockResolvedValueOnce({
        Username: 'user-123',
        UserAttributes: [{ Name: 'email', Value: 'user@test.com' }],
        UserStatus: 'CONFIRMED'
      });

      const user = await userAdapter.getUser('user-123');
      expect(user.status).toBe('ACTIVE');
    });

    it('should map UNCONFIRMED to PENDING', async () => {
      mockSend.mockResolvedValueOnce({
        Username: 'user-123',
        UserAttributes: [{ Name: 'email', Value: 'user@test.com' }],
        UserStatus: 'UNCONFIRMED'
      });

      const user = await userAdapter.getUser('user-123');
      expect(user.status).toBe('PENDING');
    });

    it('should map FORCE_CHANGE_PASSWORD to PENDING', async () => {
      mockSend.mockResolvedValueOnce({
        Username: 'user-123',
        UserAttributes: [{ Name: 'email', Value: 'user@test.com' }],
        UserStatus: 'FORCE_CHANGE_PASSWORD'
      });

      const user = await userAdapter.getUser('user-123');
      expect(user.status).toBe('PENDING');
    });

    it('should map ARCHIVED to DISABLED', async () => {
      mockSend.mockResolvedValueOnce({
        Username: 'user-123',
        UserAttributes: [{ Name: 'email', Value: 'user@test.com' }],
        UserStatus: 'ARCHIVED'
      });

      const user = await userAdapter.getUser('user-123');
      expect(user.status).toBe('DISABLED');
    });

    it('should map unknown status to UNKNOWN', async () => {
      mockSend.mockResolvedValueOnce({
        Username: 'user-123',
        UserAttributes: [{ Name: 'email', Value: 'user@test.com' }],
        UserStatus: 'SOME_NEW_STATUS'
      });

      const user = await userAdapter.getUser('user-123');
      expect(user.status).toBe('UNKNOWN');
    });
  });

  // ========== FACTORY FUNCTION ==========

  describe('getUserAdapter()', () => {
    it('should return singleton instance', () => {
      const adapter1 = getUserAdapter();
      const adapter2 = getUserAdapter();

      expect(adapter1).toBe(adapter2);
      expect(adapter1).toBeInstanceOf(UserAdapter);
    });

    it('should create adapter with custom config', () => {
      const customAdapter = getUserAdapter({
        userPoolId: 'custom-pool-id'
      });

      expect(customAdapter).toBeInstanceOf(UserAdapter);
    });
  });

  // ========== ERROR MAPPING ==========

  describe('Error Mapping', () => {
    it('should map UserNotFoundException to UserNotFoundError', async () => {
      const mockError = new Error('UserNotFoundException');
      mockError.name = 'UserNotFoundException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.getUser('nonexistent'))
        .rejects.toThrow(UserNotFoundError);
    });

    it('should map UsernameExistsException to UserAlreadyExistsError', async () => {
      const mockError = new Error('UsernameExistsException');
      mockError.name = 'UsernameExistsException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.createUser({ email: 'existing@test.com', role: 'user' }))
        .rejects.toThrow(UserAlreadyExistsError);
    });

    it('should map InvalidParameterException to InvalidUserDataError', async () => {
      const mockError = new Error('InvalidParameterException');
      mockError.name = 'InvalidParameterException';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.createUser({ email: 'invalid', role: 'user' }))
        .rejects.toThrow(InvalidUserDataError);
    });

    it('should propagate unknown errors', async () => {
      const mockError = new Error('UnknownError');
      mockError.name = 'UnknownError';

      mockSend.mockRejectedValueOnce(mockError);

      await expect(userAdapter.getUser('user-123'))
        .rejects.toThrow('UnknownError');
    });
  });
});
