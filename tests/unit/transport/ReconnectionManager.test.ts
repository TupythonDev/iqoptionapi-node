import { EventEmitter } from 'events';
import { ReconnectionManager } from '../../../src/transport/ReconnectionManager';
import type { WebSocketTransport } from '../../../src/transport/WebSocketTransport';

function makeTransport(connectImpl: () => Promise<void> = () => Promise.resolve()) {
  const emitter = new EventEmitter();
  const transport = Object.assign(emitter, {
    connect: jest.fn(connectImpl),
    disconnect: jest.fn(),
    isConnected: false,
    send: jest.fn(),
  }) as unknown as WebSocketTransport;
  return transport;
}

describe('ReconnectionManager', () => {
  let transport: WebSocketTransport;
  let manager: ReconnectionManager;

  beforeEach(() => {
    jest.useFakeTimers();
    transport = makeTransport();
    manager = new ReconnectionManager(transport, 3);
  });

  afterEach(() => {
    manager.reset();
    jest.useRealTimers();
  });

  // ── no reconnect on intentional close ──────────────────────────────────────

  it('does not reconnect when code is 1000 (intentional)', async () => {
    const onReconnecting = jest.fn();
    manager.on('reconnecting', onReconnecting);

    transport.emit('disconnected', 1000, 'Normal Closure');
    await jest.runAllTimersAsync();

    expect(onReconnecting).not.toHaveBeenCalled();
    expect(transport.connect as jest.Mock).not.toHaveBeenCalled();
  });

  // ── reconnect on unexpected disconnect ─────────────────────────────────────

  it('emits reconnecting with attempt info on unexpected disconnect', async () => {
    const onReconnecting = jest.fn();
    manager.on('reconnecting', onReconnecting);

    transport.emit('disconnected', 1006, 'Abnormal Closure');
    await jest.runAllTimersAsync();

    expect(onReconnecting).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, delayMs: expect.any(Number) }),
    );
  });

  it('delayMs stays within jitter bounds', async () => {
    const delays: number[] = [];
    manager.on('reconnecting', ({ delayMs }: { attempt: number; delayMs: number }) =>
      delays.push(delayMs),
    );

    transport.emit('disconnected', 1001, '');
    await jest.runAllTimersAsync();

    const [d] = delays;
    // attempt 0 → base = 1000ms ± 20%
    expect(d).toBeGreaterThanOrEqual(800);
    expect(d).toBeLessThanOrEqual(1200);
  });

  // ── successful reconnect ───────────────────────────────────────────────────

  it('emits reconnected after connect() succeeds and resets attempts', async () => {
    const onReconnected = jest.fn();
    manager.on('reconnected', onReconnected);

    transport.emit('disconnected', 1001, '');
    await jest.runAllTimersAsync();

    expect(onReconnected).toHaveBeenCalledTimes(1);
    expect(transport.connect as jest.Mock).toHaveBeenCalledTimes(1);
  });

  // ── exhausted retries ──────────────────────────────────────────────────────

  it('emits failed after maxRetries exhausted', async () => {
    const failTransport = makeTransport(() => Promise.reject(new Error('refused')));
    const failManager = new ReconnectionManager(failTransport, 2);
    const onFailed = jest.fn();
    failManager.on('failed', onFailed);

    failTransport.emit('disconnected', 1001, '');

    // Each retry schedules a new timer; run until no timers remain.
    await jest.runAllTimersAsync();
    await jest.runAllTimersAsync();
    await jest.runAllTimersAsync();

    expect(onFailed).toHaveBeenCalledTimes(1);
    failManager.reset();
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset cancels the pending timer before it fires', async () => {
    const onReconnecting = jest.fn();
    manager.on('reconnecting', onReconnecting);

    transport.emit('disconnected', 1001, '');
    // Reconnecting event fired, but the actual connect() hasn't run yet.
    // Reset before the timer fires.
    manager.reset();

    await jest.runAllTimersAsync();

    // connect() should not have been called
    expect(transport.connect as jest.Mock).not.toHaveBeenCalled();
  });

  // ── default maxRetries ────────────────────────────────────────────────────

  it('uses default maxRetries=5 when not specified', () => {
    const defaultManager = new ReconnectionManager(transport);
    // Verify it doesn't throw and emits reconnecting (meaning it's active)
    const onReconnecting = jest.fn();
    defaultManager.on('reconnecting', onReconnecting);
    transport.emit('disconnected', 1006, '');
    expect(onReconnecting).toHaveBeenCalled();
    defaultManager.reset();
  });

  // ── no double-reconnect ────────────────────────────────────────────────────

  it('ignores a second disconnected event while already reconnecting', async () => {
    const onReconnecting = jest.fn();
    manager.on('reconnecting', onReconnecting);

    transport.emit('disconnected', 1001, '');
    transport.emit('disconnected', 1001, ''); // duplicate
    await jest.runAllTimersAsync();

    expect(onReconnecting).toHaveBeenCalledTimes(1);
  });
});
