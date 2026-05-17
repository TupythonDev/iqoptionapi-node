import type { IQCandle } from '../types/market-data';

const DEFAULT_MAX = 500;

export class CandleBuffer {
  private readonly candles: IQCandle[] = [];
  private readonly maxSize: number;

  constructor(maxSize = DEFAULT_MAX) {
    this.maxSize = maxSize;
  }

  push(candle: IQCandle): void {
    const existing = this.candles.findIndex((c) => c.time === candle.time);

    if (existing !== -1) {
      this.candles[existing] = candle; // update in place (same-timestamp merge)
      return;
    }

    // Insert at the correct position to keep the array sorted by time.
    let insertAt = this.candles.length;
    for (let i = this.candles.length - 1; i >= 0; i--) {
      const c = this.candles[i];
      if (c !== undefined && c.time <= candle.time) break;
      insertAt = i;
    }

    this.candles.splice(insertAt, 0, candle);

    if (this.candles.length > this.maxSize) {
      this.candles.shift(); // drop oldest
    }
  }

  getAll(): readonly IQCandle[] {
    return this.candles;
  }

  getLast(count: number): readonly IQCandle[] {
    return this.candles.slice(-count);
  }

  clear(): void {
    this.candles.length = 0;
  }

  get size(): number {
    return this.candles.length;
  }
}
