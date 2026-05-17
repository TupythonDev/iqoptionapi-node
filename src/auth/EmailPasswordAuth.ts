import type { MessageRouter } from '../transport/MessageRouter';
import type { CredentialProvider } from './CredentialAbstraction';
import { sanitizeLog } from './CredentialAbstraction';
import type { SessionManager } from './SessionManager';
import type { IQProfile, IQRawProfile } from '../types/profile';
import { AuthenticationError } from '../errors';
import { V1Adapter } from '../protocol/V1Adapter';

interface AuthResponse {
  isSuccessful: boolean;
  message?: string;
  ssid?: string;
}

export class EmailPasswordAuth {
  private readonly router: MessageRouter;
  private readonly session: SessionManager;

  constructor(router: MessageRouter, session: SessionManager) {
    this.router = router;
    this.session = session;
  }

  async login(credentials: CredentialProvider): Promise<IQProfile> {
    const { identifier, password } = credentials.provide();
    try {
      const response = await this.router.sendRequest<AuthResponse | IQRawProfile>(
        V1Adapter.authorization,
        { identifier, password },
      );

      // The server either responds with a profile directly (success)
      // or with an authorization result containing isSuccessful: false (failure).
      const msg = response.msg as unknown as Record<string, unknown>;
      if ('isSuccessful' in msg && msg['isSuccessful'] === false) {
        const detail = typeof msg['message'] === 'string' ? msg['message'] : 'Invalid credentials';
        throw new AuthenticationError(sanitizeLog(detail, password, identifier));
      }

      if (!('ssid' in msg) || typeof msg['ssid'] !== 'string') {
        throw new AuthenticationError('Unexpected authorization response from server');
      }

      return this.session.store(response.msg as IQRawProfile);
    } finally {
      credentials.zero();
    }
  }
}
