import { WebSocketTransport } from '../../../src/transport/WebSocketTransport';
import { ValidationError, ConnectionError } from '../../../src/errors';
import { MockWsServer } from '../../helpers/mockWsServer';

describe('WebSocketTransport', () => {
  let server: MockWsServer;
  let transport: WebSocketTransport;

  beforeEach(() => {
    server = new MockWsServer();
  });

  afterEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    transport?.disconnect();
    await server.close();
  });

  // ── URL validation ──────────────────────────────────────────────────────────

  it('throws ValidationError for ws:// non-loopback URLs', () => {
    expect(() => new WebSocketTransport('ws://iqoption.com/echo/websocket')).toThrow(
      ValidationError,
    );
  });

  it('throws ValidationError for http:// URLs', () => {
    expect(() => new WebSocketTransport('http://iqoption.com')).toThrow(ValidationError);
  });

  it('accepts wss:// URLs', () => {
    expect(() => new WebSocketTransport('wss://iqoption.com/echo/websocket')).not.toThrow();
  });

  it('accepts ws://localhost for test servers', () => {
    expect(() => new WebSocketTransport(server.url)).not.toThrow();
  });

  it('accepts ws://127.0.0.1 for test servers', () => {
    const url = server.url.replace('localhost', '127.0.0.1');
    expect(() => new WebSocketTransport(url)).not.toThrow();
  });

  // ── connect / disconnect ────────────────────────────────────────────────────

  it('resolves connect() and emits connected', async () => {
    transport = new WebSocketTransport(server.url);
    const connected = jest.fn();
    transport.on('connected', connected);

    await transport.connect();

    expect(connected).toHaveBeenCalledTimes(1);
    expect(transport.isConnected).toBe(true);
  });

  it('rejects connect() when server is unavailable', async () => {
    const deadUrl = server.url; // capture before close
    await server.close();
    transport = new WebSocketTransport(deadUrl);

    await expect(transport.connect()).rejects.toBeInstanceOf(ConnectionError);
  });

  it('emits disconnected when server closes', async () => {
    transport = new WebSocketTransport(server.url);
    await transport.connect();

    const disconnected = jest.fn();
    transport.on('disconnected', disconnected);

    server.closeClient(1001);
    await new Promise((r) => transport.once('disconnected', r));

    // terminate() on server side causes abnormal closure (1006)
    expect(disconnected).toHaveBeenCalledWith(1006, expect.any(String));
    expect(transport.isConnected).toBe(false);
  });

  // ── send ───────────────────────────────────────────────────────────────────

  it('sends data to the server', async () => {
    transport = new WebSocketTransport(server.url);
    await transport.connect();
    await server.waitForConnection();

    const received = server.nextMessage();
    transport.send(JSON.stringify({ name: 'heartbeat', msg: {} }));

    const msg = await received;
    expect(msg.name).toBe('heartbeat');
  });

  it('throws ConnectionError when sending while disconnected', () => {
    transport = new WebSocketTransport(server.url);
    expect(() => {
      transport.send('data');
    }).toThrow(ConnectionError);
  });

  it('emits error when ws emits error during active connection', async () => {
    transport = new WebSocketTransport(server.url);
    await transport.connect();
    await server.waitForConnection();

    const onError = jest.fn();
    transport.on('error', onError);

    // Access the private ws to simulate a runtime error on an established connection
    const internalWs = (transport as unknown as { ws: import('ws') }).ws;
    internalWs.emit('error', new Error('connection reset by peer'));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── message forwarding ─────────────────────────────────────────────────────

  it('emits message when server sends data', async () => {
    transport = new WebSocketTransport(server.url);
    await transport.connect();
    await server.waitForConnection();

    const onMessage = jest.fn();
    transport.on('message', onMessage);

    server.injectMessage({ name: 'heartbeat', msg: { heartbeatTime: '2026-01-01T00:00:00Z' } });

    await new Promise((r) => transport.once('message', r));
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('heartbeat'));
  });
});
