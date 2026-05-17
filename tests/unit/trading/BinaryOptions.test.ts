import { BinaryOptions } from '../../../src/trading/BinaryOptions';
import { OrderCache } from '../../../src/trading/OrderCache';
import { AssetCatalog } from '../../../src/market-data/AssetCatalog';
import { ValidationError, TradingError, TimeoutError } from '../../../src/errors';
import { Direction } from '../../../src/types/primitives';
import type { MessageRouter, MessageHandler } from '../../../src/transport/MessageRouter';
import type { IQRawMessage } from '../../../src/types/messages';
import initDataFixture from '../../fixtures/assets/init_data.json';
import buyCompleteFixture from '../../fixtures/orders/buy-complete.json';
import optionResultFixture from '../../fixtures/orders/option-result.json';

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

describe('BinaryOptions', () => {
  let router: ReturnType<typeof makeRouter>;
  let catalog: AssetCatalog;
  let cache: OrderCache;
  let binary: BinaryOptions;

  beforeEach(() => {
    router = makeRouter();
    catalog = new AssetCatalog(router);
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'init_data',
      initDataFixture as unknown as IQRawMessage,
    );
    cache = new OrderCache();
    binary = new BinaryOptions(router, catalog, cache);
  });

  describe('buy()', () => {
    it('sends buyV2 request with correct params', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(buyCompleteFixture);
      await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      expect(router.sendRequest).toHaveBeenCalledWith(
        'buyV2',
        expect.objectContaining({ price: 10, direction: Direction.Call }),
      );
    });

    it('adds position to cache after successful buy', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(buyCompleteFixture);
      const { orderId } = await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      expect(cache.has(orderId)).toBe(true);
    });

    it('throws ValidationError for unknown symbol', async () => {
      await expect(
        binary.buy({
          symbol: 'UNKNOWN',
          direction: Direction.Call,
          amount: 10,
          durationSeconds: 60,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws TradingError when response has no id', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce({ name: 'buy-complete', msg: {} });
      await expect(
        binary.buy({
          symbol: 'EURUSD',
          direction: Direction.Call,
          amount: 10,
          durationSeconds: 60,
        }),
      ).rejects.toBeInstanceOf(TradingError);
    });

    it('uses fallback 0 for missing profit_percent and open_time', async () => {
      const minimalResponse = {
        name: 'buy-complete',
        msg: {
          id: 'order-min',
          active_id: 1,
          direction: 'call',
          price: 10,
          exp: 1700000060,
          option_type_id: 1,
          profit_amount: null,
          status: 'open',
        },
      };
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(minimalResponse);
      const { orderId } = await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      const positions = cache.getOpen();
      expect(positions[0]?.profitPercent).toBe(0);
      expect(positions[0]?.openTime).toBe(0);
      expect(orderId).toBe('order-min');
    });
  });

  describe('checkResult()', () => {
    it('resolves with win/profit when option event arrives', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(buyCompleteFixture);
      const { orderId } = await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });

      const resultPromise = binary.checkResult(orderId);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
        'option',
        optionResultFixture as unknown as IQRawMessage,
      );

      const result = await resultPromise;
      expect(result.orderId).toBe(orderId);
      expect(result.win).toBe('win');
      expect(result.profitAmount).toBe(8.0);
    });

    it('ignores option events for different order IDs', async () => {
      const resultPromise = binary.checkResult('order-abc-123', 200);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger('option', {
        name: 'option',
        msg: { id: 'different-order', win: 'win', profit_amount: 5 },
      } as unknown as IQRawMessage);
      await expect(resultPromise).rejects.toBeInstanceOf(TimeoutError);
    });

    it('rejects with TimeoutError when no event arrives', async () => {
      await expect(binary.checkResult('order-abc-123', 50)).rejects.toBeInstanceOf(TimeoutError);
    });

    it('uses fallback loss/null/0 when option event fields are missing', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(buyCompleteFixture);
      const { orderId } = await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      const resultPromise = binary.checkResult(orderId);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger('option', {
        name: 'option',
        msg: { id: orderId, active_id: 1, direction: 'call' }, // no win, no profit_amount, no close_time
      } as unknown as IQRawMessage);
      const result = await resultPromise;
      expect(result.win).toBe('loss');
      expect(result.profitAmount).toBeNull();
    });

    it('closes the order in cache when result arrives', async () => {
      (router.sendRequest as jest.Mock).mockResolvedValueOnce(buyCompleteFixture);
      const { orderId } = await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });

      const resultPromise = binary.checkResult(orderId);
      (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
        'option',
        optionResultFixture as unknown as IQRawMessage,
      );
      await resultPromise;

      expect(cache.has(orderId)).toBe(false);
      expect(cache.getClosed()).toHaveLength(1);
    });
  });

  describe('circuit breaker', () => {
    it('opens after 5 consecutive failures', async () => {
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('server error'));
      for (let i = 0; i < 5; i++) {
        await binary
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      expect(binary.isCircuitOpen).toBe(true);
    });

    it('emits tradingCircuitOpen event on 5th failure', async () => {
      const cb = jest.fn();
      binary.on('tradingCircuitOpen', cb);
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('server error'));
      for (let i = 0; i < 5; i++) {
        await binary
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ module: 'BinaryOptions' }));
    });

    it('throws TradingError immediately when circuit is open', async () => {
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('server error'));
      for (let i = 0; i < 5; i++) {
        await binary
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      (router.sendRequest as jest.Mock).mockClear();
      await expect(
        binary.buy({
          symbol: 'EURUSD',
          direction: Direction.Call,
          amount: 10,
          durationSeconds: 60,
        }),
      ).rejects.toBeInstanceOf(TradingError);
      expect(router.sendRequest).not.toHaveBeenCalled();
    });

    it('resetCircuit() closes the circuit again', async () => {
      (router.sendRequest as jest.Mock).mockRejectedValue(new TradingError('server error'));
      for (let i = 0; i < 5; i++) {
        await binary
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      binary.resetCircuit();
      expect(binary.isCircuitOpen).toBe(false);
    });

    it('resets failure count on success', async () => {
      (router.sendRequest as jest.Mock)
        .mockRejectedValueOnce(new TradingError('error'))
        .mockRejectedValueOnce(new TradingError('error'))
        .mockResolvedValueOnce(buyCompleteFixture) // success resets counter
        .mockRejectedValueOnce(new TradingError('error'));

      for (let i = 0; i < 2; i++) {
        await binary
          .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
          .catch(() => undefined);
      }
      await binary.buy({
        symbol: 'EURUSD',
        direction: Direction.Call,
        amount: 10,
        durationSeconds: 60,
      });
      await binary
        .buy({ symbol: 'EURUSD', direction: Direction.Call, amount: 10, durationSeconds: 60 })
        .catch(() => undefined);

      expect(binary.isCircuitOpen).toBe(false);
    });
  });
});
