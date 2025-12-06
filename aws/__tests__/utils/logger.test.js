/**
 * Tests para Logger
 */

const { Logger } = require('../../src/utils/logger');

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    logger = Logger.create({ module: 'test' });
  });

  test('debe crear logger con correlationId', () => {
    expect(logger.correlationId).toBeDefined();
    expect(logger.correlationId).toMatch(/^[a-f0-9-]{36}$/);
  });

  test('debe crear logger desde evento', () => {
    const event = {
      headers: { 'x-correlation-id': 'test-correlation-123' },
      requestContext: { requestId: 'request-456' }
    };
    
    const eventLogger = Logger.fromEvent(event);
    expect(eventLogger.correlationId).toBe('test-correlation-123');
  });

  test('debe crear child logger con metadata adicional', () => {
    const child = logger.child({ handler: 'testHandler' });
    expect(child.context.handler).toBe('testHandler');
    expect(child.context.module).toBe('test');
  });

  test('debe soportar diferentes niveles de log', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    
    expect(consoleSpy).toHaveBeenCalledTimes(4);
    consoleSpy.mockRestore();
  });

  test('traceAsync debe ejecutar función y medir tiempo', async () => {
    const testFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'result';
    };

    const result = await logger.traceAsync('test-operation', testFn);
    expect(result).toBe('result');
  });

  test('debe incluir metadata en logs', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    logger.info('test message', { userId: '123', action: 'test' });
    
    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
    const logData = JSON.parse(lastCall);
    
    expect(logData.userId).toBe('123');
    expect(logData.action).toBe('test');
    
    consoleSpy.mockRestore();
  });
});
