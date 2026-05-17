import { SsidAuth } from '../../../src/auth/SsidAuth';
import { SessionManager } from '../../../src/auth/SessionManager';
import { AuthenticationError } from '../../../src/errors';
import { noopLogger } from '../../../src/logger';
import type { MessageRouter } from '../../../src/transport/MessageRouter';
import profileFixture from '../../fixtures/auth/profile-success.json';
import type { IQRawMessage } from '../../../src/types/messages';

function makeRouter(response: IQRawMessage): MessageRouter {
  return {
    sendRequest: jest.fn().mockResolvedValue(response),
  } as unknown as MessageRouter;
}

describe('SsidAuth', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager(noopLogger);
  });

  it('restore() stores profile and returns IQProfile on valid SSID', async () => {
    const router = makeRouter(profileFixture as IQRawMessage);
    const auth = new SsidAuth(router, session);

    const profile = await auth.restore('abc123testsession');

    expect(profile.ssid).toBe('abc123testsession');
    expect(profile.userId).toBe(99887766);
    expect(session.isAuthenticated).toBe(true);
  });

  it('restore() sends ssid message to the router', async () => {
    const router = makeRouter(profileFixture as IQRawMessage);
    const auth = new SsidAuth(router, session);

    await auth.restore('my-ssid-token');

    expect(router.sendRequest as jest.Mock).toHaveBeenCalledWith('ssid', 'my-ssid-token');
  });

  it('restore() throws AuthenticationError(SESSION_EXPIRED) when server returns isSuccessful=false', async () => {
    const expiredResponse: IQRawMessage = {
      name: 'ssid',
      msg: { isSuccessful: false },
    };
    const router = makeRouter(expiredResponse);
    const auth = new SsidAuth(router, session);

    const err = await auth.restore('expired-token').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toBe('SESSION_EXPIRED');
  });

  it('restore() throws AuthenticationError(SESSION_EXPIRED) when response has no ssid', async () => {
    const badResponse: IQRawMessage = { name: 'profile', msg: { something_else: true } };
    const router = makeRouter(badResponse);
    const auth = new SsidAuth(router, session);

    const err = await auth.restore('bad-token').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toBe('SESSION_EXPIRED');
  });
});
