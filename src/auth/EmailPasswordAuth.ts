import https from 'https';
import type { SsidAuth } from './SsidAuth';
import type { CredentialProvider } from './CredentialAbstraction';
import { sanitizeLog } from './CredentialAbstraction';
import type { IQProfile } from '../types/profile';
import { AuthenticationError } from '../errors';

interface LoginApiResponse {
  data?: { ssid?: string };
  code?: string;
  errors?: Array<{ code: number; title: string }>;
}

function httpLogin(identifier: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ identifier, password });
    const req = https.request(
      {
        hostname: 'auth.iqoption.com',
        path: '/api/v1.0/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk: Buffer) => (raw += chunk.toString()));
        res.on('end', () => {
          // SSID from Set-Cookie header
          const cookies = res.headers['set-cookie'] ?? [];
          for (const cookie of cookies) {
            const m = /ssid=([^;]+)/.exec(cookie);
            if (m?.[1]) {
              resolve(m[1]);
              return;
            }
          }
          // SSID from response body
          try {
            const json = JSON.parse(raw) as LoginApiResponse;
            if (json.data?.ssid) {
              resolve(json.data.ssid);
              return;
            }
            const title = json.errors?.[0]?.title ?? 'Authentication failed';
            reject(new AuthenticationError(title));
          } catch {
            reject(new AuthenticationError('Unexpected login response'));
          }
        });
      },
    );
    req.on('error', (err: Error) => {
      reject(new AuthenticationError(err.message));
    });
    req.write(body);
    req.end();
  });
}

export class EmailPasswordAuth {
  private readonly ssidAuth: SsidAuth;

  constructor(ssidAuth: SsidAuth) {
    this.ssidAuth = ssidAuth;
  }

  async login(credentials: CredentialProvider): Promise<IQProfile> {
    const { identifier, password } = credentials.provide();
    try {
      const ssid = await httpLogin(identifier, password);
      return await this.ssidAuth.restore(ssid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AuthenticationError(sanitizeLog(msg, password, identifier));
    } finally {
      credentials.zero();
    }
  }
}
