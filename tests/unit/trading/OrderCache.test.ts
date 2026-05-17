import { OrderCache } from '../../../src/trading/OrderCache';
import type { IQPosition } from '../../../src/types/trading';
import { Direction } from '../../../src/types/primitives';

function makePosition(orderId: string, extra: Partial<IQPosition> = {}): IQPosition {
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
    ...extra,
  };
}

describe('OrderCache', () => {
  let cache: OrderCache;

  beforeEach(() => {
    cache = new OrderCache();
  });

  it('starts empty', () => {
    expect(cache.getOpen()).toHaveLength(0);
    expect(cache.getClosed()).toHaveLength(0);
  });

  it('add() stores a position as open', () => {
    cache.add(makePosition('order-1'));
    expect(cache.getOpen()).toHaveLength(1);
    expect(cache.has('order-1')).toBe(true);
  });

  it('close() moves order from open to closed', () => {
    cache.add(makePosition('order-1'));
    const closed = cache.close('order-1', { win: 'win', profitAmount: 8 });
    expect(closed).not.toBeNull();
    expect(closed?.status).toBe('closed');
    expect(closed?.win).toBe('win');
    expect(cache.getOpen()).toHaveLength(0);
    expect(cache.getClosed()).toHaveLength(1);
    expect(cache.has('order-1')).toBe(false);
  });

  it('close() emits orderClosed event', () => {
    const cb = jest.fn();
    cache.on('orderClosed', cb);
    cache.add(makePosition('order-1'));
    cache.close('order-1', { win: 'win' });
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1', win: 'win' }));
  });

  it('close() returns null for unknown order', () => {
    const result = cache.close('nonexistent', {});
    expect(result).toBeNull();
  });

  it('getClosed(limit) returns the N most recent closed orders', () => {
    cache.add(makePosition('o1'));
    cache.add(makePosition('o2'));
    cache.add(makePosition('o3'));
    cache.close('o1', {});
    cache.close('o2', {});
    cache.close('o3', {});
    const last2 = cache.getClosed(2);
    expect(last2).toHaveLength(2);
    expect(last2[0]?.orderId).toBe('o2');
    expect(last2[1]?.orderId).toBe('o3');
  });

  it('clear() removes all orders', () => {
    cache.add(makePosition('o1'));
    cache.close('o1', {});
    cache.add(makePosition('o2'));
    cache.clear();
    expect(cache.getOpen()).toHaveLength(0);
    expect(cache.getClosed()).toHaveLength(0);
  });
});
