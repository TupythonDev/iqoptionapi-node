import type { IQIncomingMessage } from '../types/messages';
import { parseIncomingMessage } from './messageSchema';

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface ParseError {
  raw: string;
  reason: string;
}

export class MalformedMessageHandler {
  parse(raw: string): Result<IQIncomingMessage, ParseError> {
    const message = parseIncomingMessage(raw);
    if (message === null) {
      return { ok: false, error: { raw, reason: 'Invalid envelope structure' } };
    }
    return { ok: true, value: message };
  }
}
