import { createConsoleLogger, noopLogger } from '../../../src/logger';

describe('createConsoleLogger', () => {
  let spyDebug: jest.SpyInstance;
  let spyInfo: jest.SpyInstance;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;

  beforeEach(() => {
    spyDebug = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    spyInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    spyError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs all levels at debug minLevel', () => {
    const logger = createConsoleLogger('debug');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(spyDebug).toHaveBeenCalledWith('[IQOption] d');
    expect(spyInfo).toHaveBeenCalledWith('[IQOption] i');
    expect(spyWarn).toHaveBeenCalledWith('[IQOption] w');
    expect(spyError).toHaveBeenCalledWith('[IQOption] e');
  });

  it('suppresses debug at info minLevel (default)', () => {
    const logger = createConsoleLogger();
    logger.debug('should not appear');
    logger.info('should appear');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).toHaveBeenCalled();
  });

  it('only logs warn and error at warn minLevel', () => {
    const logger = createConsoleLogger('warn');
    logger.debug('x');
    logger.info('x');
    logger.warn('w');
    logger.error('e');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalled();
    expect(spyError).toHaveBeenCalled();
  });

  it('only logs error at error minLevel', () => {
    const logger = createConsoleLogger('error');
    logger.debug('x');
    logger.info('x');
    logger.warn('x');
    logger.error('e');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalled();
  });
});

describe('noopLogger', () => {
  it('all methods can be called without throwing', () => {
    expect(() => {
      noopLogger.debug('d');
      noopLogger.info('i');
      noopLogger.warn('w');
      noopLogger.error('e');
    }).not.toThrow();
  });
});
