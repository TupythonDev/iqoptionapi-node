import type { ActiveId } from '../types/primitives';
import type { IQRawAsset } from '../types/raw/asset';
import type { IQRawCandle } from '../types/raw/candle';
import type { IQRawTick } from '../types/raw/tick';
import type { IQAsset, IQCandle, IQTick, Schedule } from '../types/market-data';

function asActiveId(n: number): ActiveId {
  return n as unknown as ActiveId;
}

export function transformCandle(raw: IQRawCandle): IQCandle {
  return {
    activeId: asActiveId(raw.active_id),
    timeframe: raw.size,
    open: raw.open,
    high: raw.max,
    low: raw.min,
    close: raw.close,
    volume: raw.volume,
    time: raw.at * 1000, // server sends Unix seconds; SDK uses ms
  };
}

export function transformAsset(raw: IQRawAsset): IQAsset {
  // Dual OTC detection: explicit flag OR -OTC name suffix.
  const isOtc = raw.is_otc === true || raw.name.includes('-OTC');
  const schedules: Schedule[] = (raw.schedule ?? []).map((s) => ({
    open: s.open,
    close: s.close,
  }));

  return {
    activeId: asActiveId(raw.id),
    name: raw.name,
    symbol: raw.name.replace(/-OTC$/, ''),
    precision: raw.precision,
    isOtc,
    isSuspended: raw.suspended === true,
    profitPercent: {
      binary: raw.option?.profit ?? 0,
      digital: raw.digital_profit ?? 0,
    },
    schedules,
  };
}

export function transformTick(raw: IQRawTick): IQTick {
  return {
    assetId: asActiveId(raw.active_id),
    price: raw.price,
    ask: raw.ask,
    bid: raw.bid,
    time: raw.time * 1000,
  };
}
