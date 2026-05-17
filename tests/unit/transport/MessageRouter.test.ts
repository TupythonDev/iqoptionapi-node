import { WebSocketTransport } from '../../../src/transport/WebSocketTransport';
import { MessageRouter } from '../../../src/transport/MessageRouter';
import { TimeoutError } from '../../../src/errors';
import { MockWsServer } from '../../helpers/mockWsServer';
import type { IQRawMessage } from '../../../src/types/messages';

describe('MessageRouter', () => {
  let server: MockWsServer;
  let transport: WebSocketTransport;
  let router: MessageRouter;

  beforeEach(async () => {
    server = new MockWsServer();
    transport = new WebSocketTransport(server.url);
    router = new MessageRouter(transport);
    await transport.connect();
    await server.waitForConnection();
  });

  afterEach(async () => {
    router.clearPending();
    transport.disconnect();
    await server.close();
  });

  // ── sendRequest ─────────────────────────────────────────────────────────────

  it('resolves sendRequest when server replies with matching request_id', async () => {
    const requestPromise = router.sendRequest<{ ssid: string }>('authorization', {
      identifier: 'u@test.com',
      password: 'secret',
    });

    const sent = await server.nextMessage();
    expect(sent.name).toBe('authorization');
    expect(sent.request_id).toBeDefined();

    server.replyTo(sent.request_id!, { name: 'profile', msg: { ssid: 'tok123' } });

    const response = await requestPromise;
    expect(response.name).toBe('profile');
    expect(response.msg.ssid).toBe('tok123');
  });

  it('rejects sendRequest with TimeoutError when no reply arrives', async () => {
    await expect(router.sendRequest('authorization', {}, 50)).rejects.toBeInstanceOf(TimeoutError);
  });

  // ── sendMessage ─────────────────────────────────────────────────────────────

  it('sendMessage sends envelope without request_id', async () => {
    router.sendMessage('heartbeat', { heartbeatTime: '2026-01-01T00:00:00Z' });
    const msg = await server.nextMessage();
    expect(msg.name).toBe('heartbeat');
    expect(msg.request_id).toBeUndefined();
  });

  // ── persistent handlers ─────────────────────────────────────────────────────

  it('routes server-pushed messages to registered persistent handlers', async () => {
    const handler = jest.fn();
    router.registerHandler('candle-generated', handler);

    const payload: IQRawMessage = {
      name: 'candle-generated',
      msg: { active_id: 1, close: 1.234 },
    };
    server.injectMessage(payload);

    await new Promise((r) => setTimeout(r, 20));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'candle-generated' }));
  });

  it('unregisterHandler stops routing', async () => {
    const handler = jest.fn();
    router.registerHandler('candle-generated', handler);
    router.unregisterHandler('candle-generated', handler);

    server.injectMessage({ name: 'candle-generated', msg: {} });
    await new Promise((r) => setTimeout(r, 20));

    expect(handler).not.toHaveBeenCalled();
  });

  // ── malformed JSON ──────────────────────────────────────────────────────────

  it('emits parseError and does not throw on malformed JSON', async () => {
    const onParseError = jest.fn();
    router.on('parseError', onParseError);

    transport['ws']?.emit('message', Buffer.from('{not valid json}'));
    await new Promise((r) => setTimeout(r, 20));

    expect(onParseError).toHaveBeenCalledWith('{not valid json}');
  });

  // ── clearPending ────────────────────────────────────────────────────────────

  it('clearPending rejects all outstanding requests', async () => {
    const p = router.sendRequest('get-candles', {}, 5_000);
    router.clearPending();
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });
});
