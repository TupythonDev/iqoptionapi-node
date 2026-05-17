import type { IQIncomingMessage } from '../types/messages';

/**
 * Parses a raw WebSocket string into a typed message envelope.
 * Never throws — returns null for malformed or structurally invalid input.
 */
export function parseIncomingMessage(raw: string): IQIncomingMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj['name'] !== 'string' || obj['name'].length === 0) return null;
  if (!('msg' in obj)) return null;

  return parsed as IQIncomingMessage;
}
