import type { MessageRouter } from '../transport/MessageRouter';
import type { SessionManager } from './SessionManager';
import type { IQProfile, IQRawProfile } from '../types/profile';
import type { IQRawMessage } from '../types/messages';
import { AuthenticationError, TimeoutError } from '../errors';
import { V1Adapter } from '../protocol/V1Adapter';

const SSID_TIMEOUT_MS = 10_000;

export class SsidAuth {
  private readonly router: MessageRouter;
  private readonly session: SessionManager;

  constructor(router: MessageRouter, session: SessionManager) {
    this.router = router;
    this.session = session;
  }

  restore(ssid: string): Promise<IQProfile> {
    return new Promise<IQProfile>((resolve, reject) => {
      const onProfile = (msg: IQRawMessage) => {
        clearTimeout(timer);
        this.router.unregisterHandler(V1Adapter.profile, onProfile);

        const raw = msg.msg as Record<string, unknown>;
        if (!raw['user_id'] && !raw['id']) {
          reject(new AuthenticationError('SESSION_EXPIRED'));
          return;
        }
        try {
          // Server returns ssid: false in the profile; inject the known ssid
          const profileRaw = { ...raw, ssid } as unknown as IQRawProfile;
          resolve(this.session.store(profileRaw));
        } catch (err) {
          reject(err instanceof Error ? err : new AuthenticationError(String(err)));
        }
      };

      const timer = setTimeout(() => {
        this.router.unregisterHandler(V1Adapter.profile, onProfile);
        reject(new TimeoutError(`Request 'ssid' timed out after ${String(SSID_TIMEOUT_MS)}ms`));
      }, SSID_TIMEOUT_MS);

      this.router.registerHandler(V1Adapter.profile, onProfile);
      this.router.sendMessage(V1Adapter.ssid, ssid);
    });
  }
}
