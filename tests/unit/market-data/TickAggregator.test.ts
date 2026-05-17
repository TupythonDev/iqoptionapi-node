import { TickAggregator } from '../../../src/market-data/TickAggregator';
import type { IQTick } from '../../../src/types/market-data';
import type { ActiveId } from '../../../src/types/primitives';

function id(n: number): ActiveId {
  return n as unknown as ActiveId;
}

function makeTick(assetId: number, time: number, price = 1.0): IQTick {
  return { assetId: id(assetId), price, ask: price + 0.001, bid: price - 0.001, time };
}

describe('TickAggregator', () => {
  let agg: TickAggregator;

  beforeEach(() => {
    agg = new TickAggregator(5_000, 10);
  });

  it('starts empty for any assetId', () => {
    expect(agg.getWindow(id(1))).toHaveLength(0);
  });

  it('push() stores ticks per asset', () => {
    agg.push(makeTick(1, 1000));
    agg.push(makeTick(1, 2000));
    agg.push(makeTick(2, 1000));
    expect(agg.getWindow(id(1))).toHaveLength(2);
    expect(agg.getWindow(id(2))).toHaveLength(1);
  });

  it('evicts ticks outside the time window', () => {
    agg.push(makeTick(1, 1000));
    agg.push(makeTick(1, 2000));
    agg.push(makeTick(1, 8000)); // 1000 and 2000 are now outside the 5000ms window
    expect(agg.getWindow(id(1))).toHaveLength(1);
    expect(agg.getWindow(id(1))[0]?.time).toBe(8000);
  });

  it('evicts oldest ticks when maxTicks is exceeded', () => {
    for (let i = 0; i < 12; i++) agg.push(makeTick(1, i * 100));
    expect(agg.getWindow(id(1))).toHaveLength(10);
  });

  it('clearAsset() removes ticks for a specific asset only', () => {
    agg.push(makeTick(1, 1000));
    agg.push(makeTick(2, 1000));
    agg.clearAsset(id(1));
    expect(agg.getWindow(id(1))).toHaveLength(0);
    expect(agg.getWindow(id(2))).toHaveLength(1);
  });

  it('clear() removes all assets', () => {
    agg.push(makeTick(1, 1000));
    agg.push(makeTick(2, 1000));
    agg.clear();
    expect(agg.getWindow(id(1))).toHaveLength(0);
    expect(agg.getWindow(id(2))).toHaveLength(0);
  });
});
