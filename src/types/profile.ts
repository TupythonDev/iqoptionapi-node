import type { AccountType } from './primitives';

/** Raw wire format received from IQOption server (snake_case). */
export interface IQRawProfile {
  ssid: string;
  /** Top-level profile uses `id`; balance entries use `user_id`. Accept both. */
  user_id?: number;
  id?: number;
  email: string;
  first_name: string;
  last_name: string;
  balance: number;
  currency: string;
  currency_char: string;
}

/** SDK profile exposed to consumers (camelCase). */
export interface IQProfile {
  ssid: string;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  balance: number;
  currency: string;
  accountType: AccountType;
}
