import { SsidAuth } from '../../../src/auth/SsidAuth';
import { SessionManager } from '../../../src/auth/SessionManager';
import { AuthenticationError } from '../../../src/errors';
import { noopLogger } from '../../../src/logger';
import type { MessageRouter, MessageHandler } from '../../../src/transport/MessageRouter';
import profileFixture from '../../fixtures/auth/profile-success.json';
import type { IQRawMessage } from '../../../src/types/messages';

function makeRouter() {
  let capturedHandler: MessageHandler | null = null;

  const router = {
    registerHandler: jest.fn((_name: string, handler: MessageHandler) => {
      capturedHandler = handler;
    }),
    unregisterHandler: jest.fn(),
    sendMessage: jest.fn(),
  } as unknown as MessageRouter;

  return {
    router,
    fireProfile: (msg: IQRawMessage) => {
      capturedHandler!(msg);
    },
  };
}

describe('SsidAuth', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager(noopLogger);
  });

  it('restore() stores profile and returns IQProfile on valid SSID', async () => {
    const { router, fireProfile } = makeRouter();
    const auth = new SsidAuth(router, session);

    const promise = auth.restore('abc123testsession');
    fireProfile(profileFixture as IQRawMessage);
    const profile = await promise;

    expect(profile.ssid).toBe('abc123testsession');
    expect(profile.userId).toBe(99887766);
    expect(session.isAuthenticated).toBe(true);
  });

  it('restore() sends ssid message to the router', async () => {
    const { router, fireProfile } = makeRouter();
    const auth = new SsidAuth(router, session);

    const promise = auth.restore('my-ssid-token');
    fireProfile(profileFixture as IQRawMessage);
    await promise;

    expect(router.sendMessage as jest.Mock).toHaveBeenCalledWith('ssid', 'my-ssid-token');
  });

  it('restore() unregisters the profile handler after resolution', async () => {
    const { router, fireProfile } = makeRouter();
    const auth = new SsidAuth(router, session);

    const promise = auth.restore('my-ssid-token');
    fireProfile(profileFixture as IQRawMessage);
    await promise;

    expect(router.unregisterHandler as jest.Mock).toHaveBeenCalledWith(
      'profile',
      expect.any(Function),
    );
  });

  it('restore() throws AuthenticationError(SESSION_EXPIRED) when server returns isSuccessful=false', async () => {
    const { router, fireProfile } = makeRouter();
    const auth = new SsidAuth(router, session);

    const promise = auth.restore('expired-token');
    fireProfile({ name: 'profile', msg: { isSuccessful: false } });

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toBe('SESSION_EXPIRED');
  });

  it('restore() throws AuthenticationError(SESSION_EXPIRED) when response has no ssid', async () => {
    const { router, fireProfile } = makeRouter();
    const auth = new SsidAuth(router, session);

    const promise = auth.restore('bad-token');
    fireProfile({ name: 'profile', msg: { something_else: true } });

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).message).toBe('SESSION_EXPIRED');
  });
});
