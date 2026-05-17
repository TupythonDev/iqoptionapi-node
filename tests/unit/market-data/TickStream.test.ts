import { EventEmitter } from 'events';
import { TickStream } from '../../../src/market-data/TickStream';
import { AssetCatalog } from '../../../src/market-data/AssetCatalog';
import { ValidationError } from '../../../src/errors';
import type { MessageRouter, MessageHandler } from '../../../src/transport/MessageRouter';
import type { ReconnectionManager } from '../../../src/transport/ReconnectionManager';
import type { IQRawMessage } from '../../../src/types/messages';
import initDataFixture from '../../fixtures/assets/init_data.json';

const rawTick: IQRawMessage = {
  name: 'quote-generated',
  msg: { active_id: 1, price: 1.081, ask: 1.0812, bid: 1.0808, time: 1700000030 },
};

function makeRouter() {
  const handlers = new Map<string, Set<MessageHandler>>();
  return {
    sendMessage: jest.fn(),
    registerHandler: jest.fn((name: string, h: MessageHandler) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(h);
    }),
    unregisterHandler: jest.fn((name: string, h: MessageHandler) => {
      handlers.get(name)?.delete(h);
    }),
    trigger: (name: string, msg: IQRawMessage) =>
      handlers.get(name)?.forEach((h) => {
        h(msg);
      }),
  } as unknown as MessageRouter & { trigger: (n: string, m: IQRawMessage) => void };
}

describe('TickStream', () => {
  let router: ReturnType<typeof makeRouter>;
  let catalog: AssetCatalog;
  let reconnection: ReconnectionManager;
  let stream: TickStream;

  beforeEach(() => {
    router = makeRouter();
    catalog = new AssetCatalog(router);
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'init_data',
      initDataFixture as unknown as IQRawMessage,
    );
    reconnection = new EventEmitter() as unknown as ReconnectionManager;
    stream = new TickStream(router, catalog, reconnection);
  });

  it('subscribe() sends subscribeMessage for quote-generated', () => {
    stream.subscribe('EURUSD', jest.fn());
    expect(router.sendMessage).toHaveBeenCalledWith(
      'subscribeMessage',
      expect.objectContaining({ name: 'quote-generated' }),
    );
  });

  it('callback is invoked when quote-generated arrives for subscribed asset', () => {
    const cb = jest.fn();
    stream.subscribe('EURUSD', cb);
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'quote-generated',
      rawTick,
    );
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ price: 1.081 }));
  });

  it('callback not invoked for a different asset', () => {
    const cb = jest.fn();
    stream.subscribe('GBPUSD', cb); // GBPUSD has activeId=2
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'quote-generated',
      rawTick, // rawTick has active_id=1 (EURUSD)
    );
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribe() stops the callback', () => {
    const cb = jest.fn();
    stream.subscribe('EURUSD', cb);
    stream.unsubscribe('EURUSD');
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'quote-generated',
      rawTick,
    );
    expect(cb).not.toHaveBeenCalled();
  });

  it('re-subscribes on reconnect', () => {
    stream.subscribe('EURUSD', jest.fn());
    (router.sendMessage as jest.Mock).mockClear();
    reconnection.emit('reconnected');
    expect(router.sendMessage).toHaveBeenCalledWith(
      'subscribeMessage',
      expect.objectContaining({ name: 'quote-generated' }),
    );
  });

  it('throws ValidationError for unknown symbol', () => {
    expect(() => {
      stream.subscribe('UNKNOWN', jest.fn());
    }).toThrow(ValidationError);
  });

  it('duplicate subscribe() is a no-op', () => {
    stream.subscribe('EURUSD', jest.fn());
    stream.subscribe('EURUSD', jest.fn());
    expect(router.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe() of a symbol never subscribed is a no-op', () => {
    expect(() => {
      stream.unsubscribe('EURUSD');
    }).not.toThrow();
    expect(router.sendMessage).not.toHaveBeenCalled();
  });

  it('aggregator stores ticks pushed via subscribe', () => {
    stream.subscribe('EURUSD', jest.fn());
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'quote-generated',
      rawTick,
    );
    const window = stream.aggregator.getWindow(
      1 as unknown as import('../../../src/types/primitives').ActiveId,
    );
    expect(window).toHaveLength(1);
    expect(window[0]?.price).toBe(1.081);
  });
});
