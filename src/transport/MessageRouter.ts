import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { IQRawMessage, MessageName } from '../types/messages';
import { TimeoutError } from '../errors';
import type { WebSocketTransport } from './WebSocketTransport';

export type MessageHandler = (msg: IQRawMessage) => void;

interface PendingRequest {
  resolve: (msg: IQRawMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class MessageRouter extends EventEmitter {
  private readonly transport: WebSocketTransport;
  private readonly persistentHandlers = new Map<MessageName, Set<MessageHandler>>();
  private readonly pending = new Map<string, PendingRequest>();

  constructor(transport: WebSocketTransport) {
    super();
    this.transport = transport;
    this.transport.on('message', (raw) => {
      this.dispatch(raw);
    });
  }

  private dispatch(raw: string): void {
    let parsed: IQRawMessage;
    try {
      parsed = JSON.parse(raw) as IQRawMessage;
    } catch {
      this.emit('parseError', raw);
      return;
    }

    // Correlate to a pending request first
    if (parsed.request_id) {
      const req = this.pending.get(parsed.request_id);
      if (req) {
        clearTimeout(req.timer);
        this.pending.delete(parsed.request_id);
        req.resolve(parsed);
        return;
      }
    }

    // Route to persistent handlers
    const handlers = this.persistentHandlers.get(parsed.name);
    if (handlers) {
      for (const handler of handlers) {
        handler(parsed);
      }
    }

    this.emit('message', parsed);
  }

  sendRequest<T = unknown>(
    name: MessageName,
    msg: unknown,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<IQRawMessage<T>> {
    const requestId = randomUUID();
    this.transport.send(
      JSON.stringify({ name, msg, request_id: requestId } satisfies IQRawMessage),
    );

    return new Promise<IQRawMessage<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new TimeoutError(`Request '${name}' timed out after ${String(timeoutMs)}ms`));
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve: (m) => {
          resolve(m as IQRawMessage<T>);
        },
        reject,
        timer,
      });
    });
  }

  sendMessage(name: MessageName, msg: unknown): void {
    this.transport.send(JSON.stringify({ name, msg } satisfies IQRawMessage));
  }

  registerHandler(name: MessageName, handler: MessageHandler): void {
    let set = this.persistentHandlers.get(name);
    if (!set) {
      set = new Set();
      this.persistentHandlers.set(name, set);
    }
    set.add(handler);
  }

  unregisterHandler(name: MessageName, handler: MessageHandler): void {
    this.persistentHandlers.get(name)?.delete(handler);
  }

  clearPending(): void {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new TimeoutError(`Pending request '${id}' cancelled`));
    }
    this.pending.clear();
  }
}
