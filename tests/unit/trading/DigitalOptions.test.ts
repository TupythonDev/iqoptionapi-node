import { DigitalOptions } from '../../../src/trading/DigitalOptions';
import { OrderCache } from '../../../src/trading/OrderCache';
import { AssetCatalog } from '../../../src/market-data/AssetCatalog';
import { ValidationError, TradingError, TimeoutError } from '../../../src/errors';
import { Direction } from '../../../src/types/primitives';
import type { MessageRouter, MessageHandler } from '../../../src/transport/MessageRouter';
import type { IQRawMessage } from '../../../src/types/messages';
import initDataFixture from '../../fixtures/assets/init_data.json';

const digitalBuyResponse = {
  name: 'digital-options/place-order-binary',
  msg: { id: 'digital-order-1', active_id: 1, direction: 'call', win: '', status: 'open' },
  request_id: 'req-uuid',
};

const digitalResultEvent = {
  name: 'option',
  msg: { id: 'digital-order-1', active_id: 1, direction: 'call', win: 'win', profit: 9.0 },
};

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

describe('DigitalOptions', () => {
  let router: ReturnType<typeof makeRouter>;
  let catalog: AssetCatalog;
  let cache: OrderCache;
  let digital: DigitalOptions;

  beforeEach(() => {
    router = makeRouter();
    catalog = new AssetCatalog(router);
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'init_data',
      initDataFixture as unknown as IQRawMessage,
    );
    cache = new OrderCache();
    digital = new DigitalOptions(router, catalog, cache);
  });

  describe('buy()', () => {
    it('sends digital order request with correct params', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(digitalBuyResponse);
      await digital.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      expect(router.sendRequest).toHaveBeenCalledWith(
        'digital-options/place-order-binary',
        expect.objectContaining({ active_id: expect.any(Number), direction: Direction.Call }),
      );
    });

    it('adds position to cache after successful buy', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(digitalBuyResponse);
      const { orderId } = await digital.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      expect(cache.has(orderId)).toBe(true);
    });

    it('throws ValidationError for unknown symbol', async () => {
      await expect(
        digital.buy({
          symbol: 'UNKNOWN',
          direction: Direction.Call,
          amount: 10,
          durationSeconds: 60,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws TradingError when response has no id', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce({
        name: 'digital-options/place-order-binary',
        msg: {},
      });
      await expect(
        digital.buy({
          symbol: 'EURUSD',
          direction: Direction.Call,
          amount: 10,
          durationSeconds: 60,
        }),
      ).rejects.toBeInstanceOf(TradingError);
    });
  });

  describe('checkResult()', () => {
    it('resolves when option event arrives for the order', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(digitalBuyResponse);
      const { orderId } = await digital.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });

      const resultPromise = digital.checkResult(orderId);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
        'option',
        digitalResultEvent as unknown as IQRawMessage,
      );
      const result = await resultPromise;
      expect(result.orderId).toBe(orderId);
      expect(result.win).toBe('win');
      expect(result.profitAmount).toBe(9.0);
    });

    it('ignores option events for a different order ID', async () => {
      const resultPromise = digital.checkResult('digital-order-1', 100);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger('option', {
        name: 'option',
        msg: { id: 'different-order', active_id: 1, direction: 'call', win: 'win', profit: 5 },
      } as unknown as IQRawMessage);
      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutError);
    });

    it('rejects with TimeoutError when no event arrives', async () => {
      await expect(digital.checkResult('digital-order-1', 50)).rejects.toBeInstanceOf(TimeoutError);
    });

    it('uses fallback loss/null/0 when option event fields are missing', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(digitalBuyResponse);
      const { orderId } = await digital.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      const resultPromise = digital.checkResult(orderId);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger('option', {
        name: 'option',
        msg: { id: orderId, active_id: 1, direction: 'call' }, // no win, no profit, no close_time
      } as unknown as IQRawMessage);
      const result = await resultPromise;
      expect(result.win).toBe('loss');
      expect(result.profitAmount).toBeNull();
    });
  });

  describe('circuit breaker', () => {
    it('opens after 5 consecutive failures', async () => {
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('error'));
      for (let i = 0; i < 5; i++) {
        await digital
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      expect(digital.isCircuitOpen).toBe(true);
    });

    it('emits tradingCircuitOpen with module=DigitalOptions', async () => {
      const cb = jest.fn();
      digital.on('tradingCircuitOpen', cb);
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('error'));
      for (let i = 0; i < 5; i++) {
        await digital
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ module: 'DigitalOptions' }));
    });

    it('throws TradingError immediately when circuit is open', async () => {
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('error'));
      for (let i = 0; i < 5; i++) {
        await digital
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      (router.sendRequest as jest.Mock).mockClear();
      await expect(
        digital.buy({
          symbol: 'EURUSD',
          direction: Direction.Call,
          amount: 10,
          durationSeconds: 60,
        }),
      ).rejects.toBeInstanceOf(TradingError);
      expect(router.sendRequest).not.toHaveBeenCalled();
    });

    it('resetCircuit() closes the circuit', async () => {
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('error'));
      for (let i = 0; i < 5; i++) {
        await digital
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      digital.resetCircuit();
      expect(digital.isCircuitOpen).toBe(false);
    });
  });
});
