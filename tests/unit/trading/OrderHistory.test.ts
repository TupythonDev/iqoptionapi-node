import { OrderHistory } from '../../../src/trading/OrderHistory';
import { OrderCache } from '../../../src/trading/OrderCache';
import type { IQPosition } from '../../../src/types/trading';
import { Direction } from '../../../src/types/primitives';

function makePosition(orderId: string): IQPosition {
  return {
    orderId,
    activeId: 1 as unknown as import('../../../src/types/primitives').ActiveId,
    direction: Direction.Call,
    amount: 10,
    profitPercent: 80,
    status: 'open',
    openTime: 1700000000000,
    closeTime: null,
    profitAmount: null,
    win: null,
  };
}

describe('OrderHistory', () => {
  let cache: OrderCache;
  let history: OrderHistory;

  beforeEach(() => {
    cache = new OrderCache();
    history = new OrderHistory(cache);
  });

  it('getOpenPositions() returns all open orders', () => {
    cache.add(makePosition('o1'));
    cache.add(makePosition('o2'));
    expect(history.getOpenPositions()).toHaveLength(2);
  });

  it('getClosedPositions() returns all closed orders', () => {
    cache.add(makePosition('o1'));
    cache.add(makePosition('o2'));
    cache.close('o1', { win: 'win' });
    expect(history.getClosedPositions()).toHaveLength(1);
    expect(history.getClosedPositions()[0]?.orderId).toBe('o1');
  });

  it('getClosedPositions(limit) returns the N most recent', () => {
    for (let i = 1; i <= 5; i++) {
      cache.add(makePosition(`o${String(i)}`));
      cache.close(`o${String(i)}`, { win: 'win' });
    }
    const last3 = history.getClosedPositions(3);
    expect(last3).toHaveLength(3);
    expect(last3[0]?.orderId).toBe('o3');
    expect(last3[2]?.orderId).toBe('o5');
  });

  it('open and closed are independent', () => {
    cache.add(makePosition('open1'));
    cache.add(makePosition('closed1'));
    cache.close('closed1', { win: 'loss' });
    expect(history.getOpenPositions()).toHaveLength(1);
    expect(history.getOpenPositions()[0]?.orderId).toBe('open1');
    expect(history.getClosedPositions()).toHaveLength(1);
    expect(history.getClosedPositions()[0]?.orderId).toBe('closed1');
  });
});
