import https from 'https';
import { EventEmitter } from 'events';
import { EmailPasswordAuth } from '../../../src/auth/EmailPasswordAuth';
import { EmailPasswordCredentials } from '../../../src/auth/CredentialAbstraction';
import { AuthenticationError } from '../../../src/errors';
import type { SsidAuth } from '../../../src/auth/SsidAuth';
import type { IQProfile } from '../../../src/types/profile';
import { AccountType } from '../../../src/types/primitives';

jest.mock('https');

const mockProfile: IQProfile = {
  ssid: 'abc123testsession',
  userId: 99887766,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  balance: 10000,
  currency: 'USD',
  accountType: AccountType.Practice,
};

function mockHttp(body: string, cookies: string[] = []) {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string[]>;
  };
  res.statusCode = 200;
  res.headers = { 'set-cookie': cookies };

  const req = new EventEmitter() as EventEmitter & {
    write: jest.Mock;
    end: jest.Mock;
  };
  req.write = jest.fn();
  req.end = jest.fn(() => {
    process.nextTick(() => {
      res.emit('data', Buffer.from(body));
      res.emit('end');
    });
  });

  (https.request as jest.Mock).mockImplementation((_opts: unknown, cb: (r: unknown) => void) => {
    cb(res);
    return req;
  });
}

function mockHttpSuccess(ssid: string) {
  mockHttp(JSON.stringify({ data: { ssid }, code: 'success' }));
}

function mockHttpError(title: string) {
  mockHttp(JSON.stringify({ errors: [{ code: 1, title }] }));
}

function makeSsidAuth(result: IQProfile | Error): jest.Mocked<Pick<SsidAuth, 'restore'>> {
  return {
    restore: jest
      .fn()
      .mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
      ),
  };
}

describe('EmailPasswordAuth', () => {
  it('login() calls ssidAuth.restore with the SSID from HTTP response', async () => {
    mockHttpSuccess('test-ssid-value');
    const ssidAuth = makeSsidAuth(mockProfile);
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);

    const profile = await auth.login(new EmailPasswordCredentials('u@test.com', 'pass'));

    expect(ssidAuth.restore).toHaveBeenCalledWith('test-ssid-value');
    expect(profile).toEqual(mockProfile);
  });

  it('login() accepts SSID from Set-Cookie header', async () => {
    mockHttp('{}', ['ssid=cookie-ssid; Path=/; HttpOnly']);
    const ssidAuth = makeSsidAuth(mockProfile);
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);

    await auth.login(new EmailPasswordCredentials('u@test.com', 'pass'));

    expect(ssidAuth.restore).toHaveBeenCalledWith('cookie-ssid');
  });

  it('login() zeros credentials after success', async () => {
    mockHttpSuccess('test-ssid');
    const ssidAuth = makeSsidAuth(mockProfile);
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);
    const creds = new EmailPasswordCredentials('u@test.com', 'pass');
    const zeroSpy = jest.spyOn(creds, 'zero');

    await auth.login(creds);

    expect(zeroSpy).toHaveBeenCalledTimes(1);
    expect(creds.provide().password).toBe('');
  });

  it('login() zeros credentials even on HTTP failure', async () => {
    mockHttpError('Invalid email');
    const ssidAuth = makeSsidAuth(mockProfile);
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);
    const creds = new EmailPasswordCredentials('u@test.com', 'wrong');
    const zeroSpy = jest.spyOn(creds, 'zero');

    await expect(auth.login(creds)).rejects.toBeInstanceOf(AuthenticationError);
    expect(zeroSpy).toHaveBeenCalledTimes(1);
    expect(creds.provide().password).toBe('');
  });

  it('login() zeros credentials even when ssidAuth.restore fails', async () => {
    mockHttpSuccess('test-ssid');
    const ssidAuth = makeSsidAuth(new AuthenticationError('SESSION_EXPIRED'));
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);
    const creds = new EmailPasswordCredentials('u@test.com', 'pass');
    const zeroSpy = jest.spyOn(creds, 'zero');

    await expect(auth.login(creds)).rejects.toBeInstanceOf(AuthenticationError);
    expect(zeroSpy).toHaveBeenCalledTimes(1);
  });

  it('login() throws AuthenticationError when HTTP login fails', async () => {
    mockHttpError('Invalid email');
    const ssidAuth = makeSsidAuth(mockProfile);
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);

    await expect(
      auth.login(new EmailPasswordCredentials('u@test.com', 'wrong')),
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(ssidAuth.restore).not.toHaveBeenCalled();
  });

  it('login() does not expose password in AuthenticationError message', async () => {
    const password = 'mySecretPass';
    mockHttpError(`Wrong password: ${password}`);
    const ssidAuth = makeSsidAuth(mockProfile);
    const auth = new EmailPasswordAuth(ssidAuth as unknown as SsidAuth);

    const err = await auth
      .login(new EmailPasswordCredentials('u@test.com', password))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).not.toContain(password);
  });
});
