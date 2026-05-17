import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ConnectionError, ValidationError } from '../errors';

// Allow loopback ws:// for in-process test servers; all other connections require wss://.
const LOOPBACK_RE = /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

function validateUrl(url: string): void {
  if (url.startsWith('wss://') || LOOPBACK_RE.test(url)) return;
  throw new ValidationError(
    `Only WSS connections are allowed. Received: ${url.replace(/\?.*/, '')}`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface WebSocketTransport {
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: (code: number, reason: string) => void): this;
  on(event: 'message', listener: (data: string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  emit(event: 'connected'): boolean;
  emit(event: 'disconnected', code: number, reason: string): boolean;
  emit(event: 'message', data: string): boolean;
  emit(event: 'error', error: Error): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class WebSocketTransport extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly url: string;

  constructor(url: string) {
    super();
    validateUrl(url);
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isLoopback = LOOPBACK_RE.test(this.url);
      const ws = new WebSocket(this.url, {
        rejectUnauthorized: !isLoopback,
      });

      const onOpen = () => {
        ws.removeListener('error', onInitError);
        this.ws = ws;

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        ws.on('message', (data) => this.emit('message', String(data)));
        ws.on('close', (code, reason) => {
          this.ws = null;
          this.emit('disconnected', code, reason.toString());
        });
        ws.on('error', (err) => this.emit('error', new ConnectionError(err.message)));

        this.emit('connected');
        resolve();
      };

      const onInitError = (err: Error) => {
        ws.removeListener('open', onOpen);
        reject(new ConnectionError(err.message));
      };

      ws.once('open', onOpen);
      ws.once('error', onInitError);
    });
  }

  send(data: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new ConnectionError('WebSocket is not connected');
    }
    this.ws.send(data);
  }

  disconnect(code = 1000): void {
    this.ws?.close(code);
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
