import type { IQTick } from '../types/market-data';
import type { ActiveId } from '../types/primitives';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_TICKS = 1_000;

export class TickAggregator {
  private readonly windows = new Map<ActiveId, IQTick[]>();
  private readonly windowMs: number;
  private readonly maxTicks: number;

  constructor(windowMs = DEFAULT_WINDOW_MS, maxTicks = DEFAULT_MAX_TICKS) {
    this.windowMs = windowMs;
    this.maxTicks = maxTicks;
  }

  push(tick: IQTick): void {
    let ticks = this.windows.get(tick.assetId);
    if (!ticks) {
      ticks = [];
      this.windows.set(tick.assetId, ticks);
    }

    ticks.push(tick);

    // Evict by time window first, then by max count
    const cutoff = tick.time - this.windowMs;
    const firstValid = ticks.findIndex((t) => t.time >= cutoff);
    if (firstValid > 0) ticks.splice(0, firstValid);
    if (ticks.length > this.maxTicks) ticks.splice(0, ticks.length - this.maxTicks);
  }

  getWindow(assetId: ActiveId): readonly IQTick[] {
    return this.windows.get(assetId) ?? [];
  }

  clearAsset(assetId: ActiveId): void {
    this.windows.delete(assetId);
  }

  clear(): void {
    this.windows.clear();
  }
}
