import { SessionManager } from '../../../src/auth/SessionManager';
import { AccountType } from '../../../src/types/primitives';
import { AuthenticationError } from '../../../src/errors';
import { noopLogger } from '../../../src/logger';
import type { IQRawProfile } from '../../../src/types/profile';

const rawProfile: IQRawProfile = {
  ssid: 'tok123',
  user_id: 99887766,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  balance: 10000,
  currency: 'USD',
  currency_char: '$',
};

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager(noopLogger);
  });

  // ── store ───────────────────────────────────────────────────────────────────

  it('store() converts raw profile to IQProfile with PRACTICE as default', () => {
    const profile = manager.store(rawProfile);
    expect(profile.ssid).toBe('tok123');
    expect(profile.userId).toBe(99887766);
    expect(profile.email).toBe('test@example.com');
    expect(profile.firstName).toBe('Test');
    expect(profile.lastName).toBe('User');
    expect(profile.balance).toBe(10000);
    expect(profile.currency).toBe('USD');
    expect(profile.accountType).toBe(AccountType.Practice);
  });

  it('store() preserves existing accountType across re-authentication', () => {
    manager.store(rawProfile);
    manager.switchAccount(AccountType.Real);
    const refreshed = manager.store({ ...rawProfile, balance: 9000 });
    expect(refreshed.accountType).toBe(AccountType.Real);
  });

  // ── getProfile ──────────────────────────────────────────────────────────────

  it('getProfile() returns the stored profile', () => {
    manager.store(rawProfile);
    expect(manager.getProfile().ssid).toBe('tok123');
  });

  it('getProfile() throws AuthenticationError when not authenticated', () => {
    expect(() => manager.getProfile()).toThrow(AuthenticationError);
  });

  // ── switchAccount ───────────────────────────────────────────────────────────

  it('switchAccount(REAL) changes accountType and emits warning via logger', () => {
    const warnSpy = jest.fn();
    const spyManager = new SessionManager({ ...noopLogger, warn: warnSpy });
    spyManager.store(rawProfile);

    spyManager.switchAccount(AccountType.Real);

    expect(spyManager.getProfile().accountType).toBe(AccountType.Real);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('REAL'));
  });

  it('switchAccount(PRACTICE) changes accountType without warning', () => {
    const warnSpy = jest.fn();
    const spyManager = new SessionManager({ ...noopLogger, warn: warnSpy });
    spyManager.store(rawProfile);
    spyManager.switchAccount(AccountType.Real);

    spyManager.switchAccount(AccountType.Practice);

    expect(spyManager.getProfile().accountType).toBe(AccountType.Practice);
    expect(warnSpy).toHaveBeenCalledTimes(1); // only called for Real
  });

  it('switchAccount() is a no-op when session is not set', () => {
    expect(() => {
      manager.switchAccount(AccountType.Real);
    }).not.toThrow();
  });

  // ── clear ───────────────────────────────────────────────────────────────────

  it('clear() removes the session', () => {
    manager.store(rawProfile);
    manager.clear();
    expect(manager.isAuthenticated).toBe(false);
    expect(() => manager.getProfile()).toThrow(AuthenticationError);
  });

  // ── isAuthenticated ─────────────────────────────────────────────────────────

  it('isAuthenticated is false before store()', () => {
    expect(manager.isAuthenticated).toBe(false);
  });

  it('isAuthenticated is true after store()', () => {
    manager.store(rawProfile);
    expect(manager.isAuthenticated).toBe(true);
  });
});
