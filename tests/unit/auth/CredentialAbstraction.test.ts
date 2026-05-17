import {
  EmailPasswordCredentials,
  sanitizeLog,
  loadCredentialsFromEnv,
} from '../../../src/auth/CredentialAbstraction';
import { ValidationError } from '../../../src/errors';

describe('EmailPasswordCredentials', () => {
  it('provide() returns identifier and password', () => {
    const creds = new EmailPasswordCredentials('user@test.com', 'secret');
    expect(creds.provide()).toEqual({ identifier: 'user@test.com', password: 'secret' });
  });

  it('zero() clears credentials so they cannot be retrieved', () => {
    const creds = new EmailPasswordCredentials('user@test.com', 'secret');
    creds.zero();
    const { identifier, password } = creds.provide();
    expect(identifier).toBe('');
    expect(password).toBe('');
  });
});

describe('sanitizeLog', () => {
  it('replaces a single sensitive value', () => {
    expect(sanitizeLog('token is abc123', 'abc123')).toBe('token is [REDACTED]');
  });

  it('replaces all occurrences of a sensitive value', () => {
    expect(sanitizeLog('abc123 and abc123 again', 'abc123')).toBe(
      '[REDACTED] and [REDACTED] again',
    );
  });

  it('replaces multiple sensitive values', () => {
    const result = sanitizeLog('user: me@x.com pass: secret', 'me@x.com', 'secret');
    expect(result).toBe('user: [REDACTED] pass: [REDACTED]');
  });

  it('skips empty sensitive values without error', () => {
    expect(sanitizeLog('clean message', '')).toBe('clean message');
  });

  it('returns message unchanged when no sensitive values given', () => {
    expect(sanitizeLog('no secrets here')).toBe('no secrets here');
  });

  it('handles sensitive value appearing mid-string', () => {
    expect(sanitizeLog('Authorization: Bearer tok123xyz', 'tok123xyz')).toBe(
      'Authorization: Bearer [REDACTED]',
    );
  });

  it('SSID never leaks — critical security check', () => {
    const ssid = 'supersecretssid99';
    const logged = sanitizeLog(`connected with ssid=${ssid}`, ssid);
    expect(logged).not.toContain(ssid);
    expect(logged).toContain('[REDACTED]');
  });
});

describe('loadCredentialsFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns credentials when both env vars are set', () => {
    process.env['IQ_EMAIL'] = 'env@test.com';
    process.env['IQ_PASSWORD'] = 'envpass';
    const creds = loadCredentialsFromEnv();
    expect(creds.provide()).toEqual({ identifier: 'env@test.com', password: 'envpass' });
  });

  it('throws ValidationError when IQ_EMAIL is missing', () => {
    delete process.env['IQ_EMAIL'];
    process.env['IQ_PASSWORD'] = 'pass';
    expect(() => loadCredentialsFromEnv()).toThrow(ValidationError);
  });

  it('throws ValidationError when IQ_PASSWORD is missing', () => {
    process.env['IQ_EMAIL'] = 'email@test.com';
    delete process.env['IQ_PASSWORD'];
    expect(() => loadCredentialsFromEnv()).toThrow(ValidationError);
  });
});
