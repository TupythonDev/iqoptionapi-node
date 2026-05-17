import { EventEmitter } from 'events';
import type { WebSocketTransport } from './WebSocketTransport';

const BASE_MS = 1_000;
const MAX_MS = 8_000;
const JITTER = 0.2;

function backoffDelay(attempt: number): number {
  const base = Math.min(BASE_MS * Math.pow(2, attempt), MAX_MS);
  const jitter = base * JITTER * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface ReconnectionManager {
  on(event: 'reconnecting', listener: (info: { attempt: number; delayMs: number }) => void): this;
  on(event: 'reconnected' | 'failed', listener: () => void): this;
  emit(event: 'reconnecting', info: { attempt: number; delayMs: number }): boolean;
  emit(event: 'reconnected' | 'failed'): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ReconnectionManager extends EventEmitter {
  private readonly transport: WebSocketTransport;
  private readonly maxRetries: number;
  private attempts = 0;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(transport: WebSocketTransport, maxRetries = 5) {
    super();
    this.transport = transport;
    this.maxRetries = maxRetries;
    this.transport.on('disconnected', (code) => {
      if (code !== 1000 && !this.active) this.schedule();
    });
  }

  private schedule(): void {
    if (this.attempts >= this.maxRetries) {
      this.emit('failed');
      return;
    }

    this.active = true;
    const delayMs = backoffDelay(this.attempts);
    this.emit('reconnecting', { attempt: this.attempts + 1, delayMs });

    this.timer = setTimeout(() => {
      this.timer = null;
      this.transport
        .connect()
        .then(() => {
          this.attempts = 0;
          this.active = false;
          this.emit('reconnected');
        })
        .catch(() => {
          this.attempts++;
          this.active = false;
          this.schedule();
        });
    }, delayMs);
  }

  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.attempts = 0;
    this.active = false;
  }
}
