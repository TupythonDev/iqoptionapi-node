import type { ActiveId, Direction } from './primitives';

export type OrderStatus = 'open' | 'closed';
export type OrderResult = 'win' | 'loss' | 'equal';

export interface IQPosition {
  orderId: string;
  activeId: ActiveId;
  direction: Direction;
  amount: number;
  profitPercent: number;
  status: OrderStatus;
  openTime: number;
  closeTime: number | null;
  profitAmount: number | null;
  win: OrderResult | null;
}

export interface BuyBinaryOptionParams {
  symbol: string;
  direction: Direction;
  amount: number;
  durationSeconds: number;
}

export interface BuyDigitalOptionParams {
  symbol: string;
  direction: Direction;
  amount: number;
  durationSeconds: number;
}

export interface BinaryOptionResult {
  orderId: string;
  win: OrderResult;
  profitAmount: number | null;
}

export interface DigitalOptionResult {
  orderId: string;
  win: OrderResult;
  profitAmount: number | null;
}
