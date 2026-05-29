import { AccountType } from '../types/primitives';
import type { ILogger } from '../types/logger';
import type { IQRawProfile, IQProfile } from '../types/profile';
import { AuthenticationError } from '../errors';

function toProfile(raw: IQRawProfile, accountType: AccountType): IQProfile {
  return {
    ssid: raw.ssid,
    userId: (raw.user_id ?? raw.id) as number,
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    balance: raw.balance,
    currency: raw.currency,
    accountType,
  };
}

export class SessionManager {
  private profile: IQProfile | null = null;
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  store(raw: IQRawProfile): IQProfile {
    const existing = this.profile;
    const accountType = existing?.accountType ?? AccountType.Practice;
    this.profile = toProfile(raw, accountType);
    return this.profile;
  }

  getProfile(): IQProfile {
    if (!this.profile) throw new AuthenticationError('Not authenticated');
    return this.profile;
  }

  switchAccount(type: AccountType): void {
    if (type === AccountType.Real) {
      this.logger.warn(
        '[IQOption SDK] WARNING: Switching to REAL account. All subsequent trades will use REAL MONEY.',
      );
    }
    if (this.profile) {
      this.profile = { ...this.profile, accountType: type };
    }
  }

  clear(): void {
    this.profile = null;
  }

  get isAuthenticated(): boolean {
    return this.profile !== null;
  }
}
