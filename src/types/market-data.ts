import type { ActiveId, TimeFrame } from './primitives';

export interface Schedule {
  open: number;
  close: number;
}

export interface IQAsset {
  activeId: ActiveId;
  name: string;
  symbol: string;
  precision: number;
  isOtc: boolean;
  isSuspended: boolean;
  profitPercent: { binary: number; digital: number };
  schedules: Schedule[];
}

export interface IQCandle {
  activeId: ActiveId;
  timeframe: TimeFrame;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number; // Unix ms
}

export interface IQTick {
  assetId: ActiveId;
  price: number;
  ask: number;
  bid: number;
  time: number; // Unix ms
}

/** Record<ActiveId, IQAsset> */
export type IQAssetMap = Map<ActiveId, IQAsset>;
