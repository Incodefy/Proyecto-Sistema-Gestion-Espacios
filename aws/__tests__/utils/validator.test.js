/**
 * Tests para Validator
 */

const { validate, schemas } = require('../../src/utils/validator');
const { ValidationError } = require('../../src/utils/errorHandler');

describe('Validator', () => {
  describe('validate() function', () => {
    test('debe validar datos correctos contra schema', () => {
      const data = {
        name: 'Test Group',
        description: 'Test description'
      };

      const result = validate(data, schemas.createGroup);
      expect(result).toEqual(data);
    });

    test('debe lanzar ValidationError para datos inválidos', () => {
      const data = {
        // name faltante (required)
        description: 'Test'
      };

      expect(() => {
        validate(data, schemas.createGroup);
      }).toThrow(ValidationError);
    });

    test('debe remover propiedades no definidas en schema', () => {
      const data = {
        name: 'Test',
        extraField: 'should be removed'
      };

      const result = validate(data, schemas.createGroup);
      expect(result.extraField).toBeUndefined();
      expect(result.name).toBe('Test');
    });
  });

  describe('schemas', () => {
    test('createGroup schema debe validar nombre', () => {
      expect(() => {
        validate({ name: '' }, schemas.createGroup);
      }).toThrow(ValidationError);

      expect(() => {
        validate({ name: 'a'.repeat(101) }, schemas.createGroup);
      }).toThrow(ValidationError);
    });

    test('inviteMember schema debe validar email y rol', () => {
      const validData = {
        grupo_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        rol: 'admin'
      };

      const result = validate(validData, schemas.inviteMember);
      expect(result.email).toBe(validData.email);
    });

    test('createSpace schema debe validar campos requeridos', () => {
      const validSpace = {
        nombre: 'Espacio 1',
        tipo: 'SPACE',
        grupo_id: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = validate(validSpace, schemas.createSpace);
      expect(result.nombre).toBe('Espacio 1');
    });
  });

  describe('validateMiddleware', () => {
    test('debe retornar middleware function', () => {
      const { validateMiddleware } = require('../../src/utils/validator');
      const middleware = validateMiddleware(schemas.createGroup);
      
      expect(typeof middleware).toBe('function');
    });
  });
});
