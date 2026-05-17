import type { MessageRouter } from '../transport/MessageRouter';
import type { SessionManager } from './SessionManager';
import type { IQProfile, IQRawProfile } from '../types/profile';
import { AuthenticationError } from '../errors';
import { V1Adapter } from '../protocol/V1Adapter';

interface SsidResponse {
  isSuccessful?: boolean;
  ssid?: string;
}

export class SsidAuth {
  private readonly router: MessageRouter;
  private readonly session: SessionManager;

  constructor(router: MessageRouter, session: SessionManager) {
    this.router = router;
    this.session = session;
  }

  async restore(ssid: string): Promise<IQProfile> {
    const response = await this.router.sendRequest<SsidResponse | IQRawProfile>(
      V1Adapter.ssid,
      ssid,
    );

    const msg = response.msg as Record<string, unknown>;

    if ('isSuccessful' in msg && msg['isSuccessful'] === false) {
      throw new AuthenticationError('SESSION_EXPIRED');
    }

    if (!('ssid' in msg) || typeof msg['ssid'] !== 'string') {
      throw new AuthenticationError('SESSION_EXPIRED');
    }

    return this.session.store(response.msg as IQRawProfile);
  }
}
