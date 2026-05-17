import { EmailPasswordAuth } from '../../../src/auth/EmailPasswordAuth';
import { EmailPasswordCredentials } from '../../../src/auth/CredentialAbstraction';
import { SessionManager } from '../../../src/auth/SessionManager';
import { AuthenticationError } from '../../../src/errors';
import { noopLogger } from '../../../src/logger';
import type { MessageRouter } from '../../../src/transport/MessageRouter';
import profileFixture from '../../fixtures/auth/profile-success.json';
import authFailedFixture from '../../fixtures/auth/auth-failed.json';
import type { IQRawMessage } from '../../../src/types/messages';

function makeRouter(response: IQRawMessage): jest.Mocked<Pick<MessageRouter, 'sendRequest'>> {
  return {
    sendRequest: jest.fn().mockResolvedValue(response),
  };
}

describe('EmailPasswordAuth', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager(noopLogger);
  });

  it('login() stores profile and returns IQProfile on success', async () => {
    const router = makeRouter(profileFixture as IQRawMessage);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);
    const creds = new EmailPasswordCredentials('u@test.com', 'pass');

    const profile = await auth.login(creds);

    expect(profile.ssid).toBe('abc123testsession');
    expect(profile.userId).toBe(99887766);
    expect(profile.email).toBe('test@example.com');
    expect(session.isAuthenticated).toBe(true);
  });

  it('login() zeros credentials after success', async () => {
    const router = makeRouter(profileFixture as IQRawMessage);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);
    const creds = new EmailPasswordCredentials('u@test.com', 'pass');
    const zeroSpy = jest.spyOn(creds, 'zero');

    await auth.login(creds);

    expect(zeroSpy).toHaveBeenCalledTimes(1);
    expect(creds.provide().password).toBe('');
  });

  it('login() zeros credentials even on failure', async () => {
    const router = makeRouter(authFailedFixture as unknown as IQRawMessage);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);
    const creds = new EmailPasswordCredentials('u@test.com', 'wrong');
    const zeroSpy = jest.spyOn(creds, 'zero');

    await expect(auth.login(creds)).rejects.toBeInstanceOf(AuthenticationError);
    expect(zeroSpy).toHaveBeenCalledTimes(1);
    expect(creds.provide().password).toBe('');
  });

  it('login() throws AuthenticationError when server returns isSuccessful=false', async () => {
    const router = makeRouter(authFailedFixture as unknown as IQRawMessage);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);

    await expect(
      auth.login(new EmailPasswordCredentials('u@test.com', 'wrong')),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('login() does not expose password in the AuthenticationError message', async () => {
    const password = 'mySecretPass';
    const failResponse: IQRawMessage = {
      name: 'authorization',
      msg: { isSuccessful: false, message: `Wrong password: ${password}` },
    };
    const router = makeRouter(failResponse);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);

    const err = await auth
      .login(new EmailPasswordCredentials('u@test.com', password))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).not.toContain(password);
  });

  it('login() uses fallback message when server isSuccessful=false but message is not a string', async () => {
    const failResponse: IQRawMessage = {
      name: 'authorization',
      msg: { isSuccessful: false, message: 12345 },
    };
    const router = makeRouter(failResponse);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);

    const err = await auth
      .login(new EmailPasswordCredentials('u@test.com', 'pass'))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toContain('Invalid credentials');
  });

  it('login() throws AuthenticationError when response has no ssid', async () => {
    const badResponse: IQRawMessage = { name: 'profile', msg: { no_ssid: true } };
    const router = makeRouter(badResponse);
    const auth = new EmailPasswordAuth(router as unknown as MessageRouter, session);

    await expect(
      auth.login(new EmailPasswordCredentials('u@test.com', 'pass')),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
