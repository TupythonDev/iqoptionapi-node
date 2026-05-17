import { ValidationError } from '../errors';

export interface CredentialProvider {
  provide(): { identifier: string; password: string };
  zero(): void;
}

/**
 * Replaces every occurrence of each sensitive value with [REDACTED].
 * Safe to call with empty strings — they are skipped.
 */
export function sanitizeLog(message: string, ...sensitiveValues: string[]): string {
  let result = message;
  for (const value of sensitiveValues) {
    if (value.length > 0) {
      result = result.split(value).join('[REDACTED]');
    }
  }
  return result;
}

export class EmailPasswordCredentials implements CredentialProvider {
  private _identifier: string;
  private _password: string;

  constructor(email: string, password: string) {
    this._identifier = email;
    this._password = password;
  }

  provide(): { identifier: string; password: string } {
    return { identifier: this._identifier, password: this._password };
  }

  /** Overwrite references so credentials are not retained in memory. */
  zero(): void {
    this._identifier = '';
    this._password = '';
  }
}

export function loadCredentialsFromEnv(): EmailPasswordCredentials {
  const email = process.env['IQ_EMAIL'];
  const password = process.env['IQ_PASSWORD'];
  if (!email) throw new ValidationError('IQ_EMAIL environment variable is required');
  if (!password) throw new ValidationError('IQ_PASSWORD environment variable is required');
  return new EmailPasswordCredentials(email, password);
}
