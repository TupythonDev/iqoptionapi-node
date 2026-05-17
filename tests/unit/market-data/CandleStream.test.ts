import { EventEmitter } from 'events';
import { CandleStream } from '../../../src/market-data/CandleStream';
import { AssetCatalog } from '../../../src/market-data/AssetCatalog';
import { ValidationError } from '../../../src/errors';
import { TimeFrame } from '../../../src/types/primitives';
import type { MessageRouter, MessageHandler } from '../../../src/transport/MessageRouter';
import type { ReconnectionManager } from '../../../src/transport/ReconnectionManager';
import type { IQRawMessage } from '../../../src/types/messages';
import initDataFixture from '../../fixtures/assets/init_data.json';
import candleGenFixture from '../../fixtures/candles/candle-generated.json';

function makeRouter() {
  const handlers = new Map<string, Set<MessageHandler>>();
  return {
    sendRequest: jest.fn(),
    sendMessage: jest.fn(),
    registerHandler: jest.fn((name: string, h: MessageHandler) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(h);
    }),
    unregisterHandler: jest.fn((name: string, h: MessageHandler) => {
      handlers.get(name)?.delete(h);
    }),
    clearPending: jest.fn(),
    on: jest.fn(),
    trigger: (name: string, msg: IQRawMessage) =>
      handlers.get(name)?.forEach((h) => {
        h(msg);
      }),
  } as unknown as MessageRouter & { trigger: (n: string, m: IQRawMessage) => void };
}

function makeReconnection() {
  const em = new EventEmitter();
  return em as unknown as ReconnectionManager;
}

describe('CandleStream', () => {
  let router: ReturnType<typeof makeRouter>;
  let catalog: AssetCatalog;
  let reconnection: ReconnectionManager;
  let stream: CandleStream;

  beforeEach(() => {
    router = makeRouter();
    catalog = new AssetCatalog(router);
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'init_data',
      initDataFixture as unknown as IQRawMessage,
    );
    reconnection = makeReconnection();
    stream = new CandleStream(router, catalog, reconnection);
  });

  it('subscribe() sends subscribeMessage', () => {
    stream.subscribe('EURUSD', TimeFrame.M1, jest.fn());
    expect(router.sendMessage).toHaveBeenCalledWith(
      'subscribeMessage',
      expect.objectContaining({ name: 'candle-generated' }),
    );
  });

  it('callback is invoked when candle-generated arrives for subscribed asset', () => {
    const cb = jest.fn();
    stream.subscribe('EURUSD', TimeFrame.M1, cb);

    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'candle-generated',
      candleGenFixture as unknown as IQRawMessage,
    );

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ time: candleGenFixture.msg.at * 1000 }),
    );
  });

  it('callback not invoked for a different timeframe', () => {
    const cb = jest.fn();
    stream.subscribe('EURUSD', TimeFrame.M5, cb); // subscribed to M5

    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'candle-generated',
      candleGenFixture as unknown as IQRawMessage, // fixture is M1
    );

    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribe() sends unsubscribeMessage and stops callback', () => {
    const cb = jest.fn();
    stream.subscribe('EURUSD', TimeFrame.M1, cb);
    stream.unsubscribe('EURUSD', TimeFrame.M1);

    expect(router.sendMessage).toHaveBeenCalledWith(
      'unsubscribeMessage',
      expect.objectContaining({ name: 'candle-generated' }),
    );

    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'candle-generated',
      candleGenFixture as unknown as IQRawMessage,
    );
    expect(cb).not.toHaveBeenCalled();
  });

  it('re-subscribes all active subscriptions on reconnect', () => {
    stream.subscribe('EURUSD', TimeFrame.M1, jest.fn());
    (router.sendMessage as jest.Mock).mockClear();

    reconnection.emit('reconnected');

    expect(router.sendMessage).toHaveBeenCalledWith(
      'subscribeMessage',
      expect.objectContaining({ name: 'candle-generated' }),
    );
  });

  it('throws ValidationError for unknown symbol', () => {
    expect(() => {
      stream.subscribe('UNKNOWN', TimeFrame.M1, jest.fn());
    }).toThrow(ValidationError);
  });

  it('unsubscribe() of a symbol never subscribed is a no-op', () => {
    expect(() => {
      stream.unsubscribe('EURUSD', TimeFrame.M1);
    }).not.toThrow();
    expect(router.sendMessage).not.toHaveBeenCalled();
  });

  it('duplicate subscribe() is a no-op', () => {
    stream.subscribe('EURUSD', TimeFrame.M1, jest.fn());
    stream.subscribe('EURUSD', TimeFrame.M1, jest.fn());
    expect(router.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('getBuffer() returns the candle buffer for a subscription', () => {
    stream.subscribe('EURUSD', TimeFrame.M1, jest.fn());
    expect(stream.getBuffer('EURUSD', TimeFrame.M1)).toBeDefined();
  });
});
