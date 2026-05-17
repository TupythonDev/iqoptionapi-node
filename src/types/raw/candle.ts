import type { TimeFrame } from '../primitives';

export interface IQRawCandle {
  active_id: number;
  size: TimeFrame; // timeframe in seconds
  at: number; // open time in Unix seconds
  open: number;
  max: number; // high
  min: number; // low
  close: number;
  volume: number;
}

export interface IQRawCandlesResponse {
  candles: IQRawCandle[];
}
