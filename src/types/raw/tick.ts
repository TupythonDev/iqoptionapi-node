export interface IQRawTick {
  active_id: number;
  price: number;
  ask: number;
  bid: number;
  value?: number;
  time: number; // Unix seconds (float)
}
