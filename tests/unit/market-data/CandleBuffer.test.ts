import { CandleBuffer } from '../../../src/market-data/CandleBuffer';
import { TimeFrame } from '../../../src/types/primitives';
import type { IQCandle } from '../../../src/types/market-data';

function makeCandle(time: number, close = 1.0): IQCandle {
  return {
    activeId: 1 as unknown as import('../../../src/types/primitives').ActiveId,
    timeframe: TimeFrame.M1,
    open: 1.0,
    high: 1.01,
    low: 0.99,
    close,
    volume: 100,
    time,
  };
}

describe('CandleBuffer', () => {
  let buf: CandleBuffer;

  beforeEach(() => {
    buf = new CandleBuffer(5);
  });

  it('starts empty', () => {
    expect(buf.size).toBe(0);
    expect(buf.getAll()).toHaveLength(0);
  });

  it('pushes candles in order', () => {
    buf.push(makeCandle(100));
    buf.push(makeCandle(200));
    expect(buf.size).toBe(2);
    expect(buf.getAll()[0]?.time).toBe(100);
    expect(buf.getAll()[1]?.time).toBe(200);
  });

  it('inserts out-of-order candles at the correct position', () => {
    buf.push(makeCandle(300));
    buf.push(makeCandle(100));
    buf.push(makeCandle(200));
    const times = buf.getAll().map((c) => c.time);
    expect(times).toEqual([100, 200, 300]);
  });

  it('updates existing candle with same timestamp (merge)', () => {
    buf.push(makeCandle(100, 1.0));
    buf.push(makeCandle(100, 1.5)); // same time, updated close
    expect(buf.size).toBe(1);
    expect(buf.getAll()[0]?.close).toBe(1.5);
  });

  it('drops the oldest candle when maxSize is exceeded', () => {
    for (let i = 0; i < 6; i++) buf.push(makeCandle(i * 100));
    expect(buf.size).toBe(5);
    expect(buf.getAll()[0]?.time).toBe(100); // first candle (time=0) dropped
  });

  it('getLast() returns the N most recent candles', () => {
    for (let i = 1; i <= 4; i++) buf.push(makeCandle(i * 100));
    const last2 = buf.getLast(2);
    expect(last2).toHaveLength(2);
    expect(last2[0]?.time).toBe(300);
    expect(last2[1]?.time).toBe(400);
  });

  it('clear() empties the buffer', () => {
    buf.push(makeCandle(100));
    buf.clear();
    expect(buf.size).toBe(0);
  });
});
