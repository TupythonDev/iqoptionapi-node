import {
  IQOptionError,
  AuthenticationError,
  ConnectionError,
  ProtocolError,
  TradingError,
  ValidationError,
  TimeoutError,
} from '../../src/errors';

const errorClasses = [
  { Cls: AuthenticationError, name: 'AuthenticationError' },
  { Cls: ConnectionError, name: 'ConnectionError' },
  { Cls: ProtocolError, name: 'ProtocolError' },
  { Cls: TradingError, name: 'TradingError' },
  { Cls: ValidationError, name: 'ValidationError' },
  { Cls: TimeoutError, name: 'TimeoutError' },
] as const;

describe('Error hierarchy', () => {
  it('IQOptionError extends Error', () => {
    const err = new IQOptionError('base');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('base');
    expect(err.name).toBe('IQOptionError');
  });

  for (const { Cls, name } of errorClasses) {
    it(`${name} extends IQOptionError`, () => {
      const err = new Cls('msg');
      expect(err).toBeInstanceOf(IQOptionError);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('msg');
      expect(err.name).toBe(name);
    });
  }
});
