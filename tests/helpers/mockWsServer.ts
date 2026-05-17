import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import type { IQRawMessage } from '../../src/types/messages';

export class MockWsServer {
  private readonly wss: WebSocketServer;
  private _client: WebSocket | null = null;

  readonly url: string;

  constructor() {
    this.wss = new WebSocketServer({ port: 0 });
    const { port } = this.wss.address() as AddressInfo;
    this.url = `ws://localhost:${String(port)}`;

    this.wss.on('connection', (ws) => {
      this._client = ws;
    });
  }

  /** Wait until a client connects. */
  waitForConnection(): Promise<void> {
    if (this._client) return Promise.resolve();
    return new Promise((resolve) => {
      this.wss.once('connection', () => {
        resolve();
      });
    });
  }

  /** Push a message to the connected client. */
  injectMessage(payload: IQRawMessage): void {
    this.requireClient().send(JSON.stringify(payload));
  }

  /** Reply to a specific request_id. */
  replyTo(requestId: string, payload: Omit<IQRawMessage, 'request_id'>): void {
    const frame: IQRawMessage = { ...payload, request_id: requestId };
    this.requireClient().send(JSON.stringify(frame));
  }

  /** Capture the next message the client sends. */
  nextMessage(): Promise<IQRawMessage> {
    return new Promise((resolve) => {
      this.requireClient().once('message', (data) => {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        resolve(JSON.parse(String(data)) as IQRawMessage);
      });
    });
  }

  /** Simulate a server-side close. code must be a valid WS close code (1000, 1001-1003, 1007-1011, 3000-4999). */
  closeClient(code = 1001): void {
    this._client?.terminate();
    void code; // terminate() triggers abnormal close without sending a code frame
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this._client?.terminate();
      this.wss.close(() => {
        resolve();
      });
    });
  }

  private requireClient(): WebSocket {
    if (!this._client) throw new Error('MockWsServer: no client connected');
    return this._client;
  }
}
