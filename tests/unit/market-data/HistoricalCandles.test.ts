import { HistoricalCandles } from '../../../src/market-data/HistoricalCandles';
import { AssetCatalog } from '../../../src/market-data/AssetCatalog';
import { ValidationError } from '../../../src/errors';
import { TimeFrame } from '../../../src/types/primitives';
import type { MessageRouter } from '../../../src/transport/MessageRouter';
import type { IQRawMessage } from '../../../src/types/messages';
import candlesFixture from '../../fixtures/candles/candles.json';
import initDataFixture from '../../fixtures/assets/init_data.json';
function makeRouter(response?: IQRawMessage) {
  const handlers = new Map<string, Set<(msg: IQRawMessage) => void>>();
  return {
    sendRequest: jest.fn().mockResolvedValue(response),
    sendMessage: jest.fn(),
    registerHandler: jest.fn((name: string, h: (msg: IQRawMessage) => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(h);
    }),
    unregisterHandler: jest.fn(),
    clearPending: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    trigger: (name: string, msg: IQRawMessage) =>
      handlers.get(name)?.forEach((h) => {
        h(msg);
      }),
  } as unknown as MessageRouter & { trigger: (n: string, m: IQRawMessage) => void };
}

describe('HistoricalCandles', () => {
  let router: ReturnType<typeof makeRouter>;
  let catalog: AssetCatalog;
  let historical: HistoricalCandles;

  beforeEach(() => {
    router = makeRouter(candlesFixture as unknown as IQRawMessage);
    catalog = new AssetCatalog(router);
    (router as unknown as { trigger: (n: string, m: IQRawMessage) => void }).trigger(
      'init_data',
      initDataFixture as unknown as IQRawMessage,
    );
    historical = new HistoricalCandles(router, catalog);
  });

  it('returns sorted candles for a known symbol', async () => {
    const candles = await historical.getCandles('EURUSD', TimeFrame.M1, 3);
    expect(candles).toHaveLength(3);
    expect(candles[0]!.time).toBeLessThan(candles[1]!.time);
  });

  it('converts server times to milliseconds', async () => {
    const candles = await historical.getCandles('EURUSD', TimeFrame.M1, 3);
    expect(candles[0]!.time).toBe(1700000000 * 1000);
  });

  it('sends get-candles request with correct params', async () => {
    await historical.getCandles('EURUSD', TimeFrame.M1, 10);
    expect(router.sendRequest).toHaveBeenCalledWith(
      'get-candles',
      expect.objectContaining({ active_id: expect.any(Number), size: TimeFrame.M1, count: 10 }),
    );
  });

  it('throws ValidationError for unknown symbol', async () => {
    await expect(historical.getCandles('UNKNOWN', TimeFrame.M1, 10)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('throws ValidationError for count <= 0', async () => {
    await expect(historical.getCandles('EURUSD', TimeFrame.M1, 0)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('passes endTime as unix seconds when provided', async () => {
    await historical.getCandles('EURUSD', TimeFrame.M1, 3, 1700086400000);
    expect(router.sendRequest).toHaveBeenCalledWith(
      'get-candles',
      expect.objectContaining({ to: 1700086400 }),
    );
  });
});
