export interface IQRawBuyComplete {
  id: string | number;
  active_id: number;
  direction: string;
  price: number;
  profit_percent?: number;
  profit_amount: number | null;
  status: string;
  open_time?: number;
  exp: number;
  option_type_id: number;
}

export interface IQRawOptionEvent {
  id: string | number;
  active_id: number;
  direction: string;
  win?: string;
  profit_amount: number | null;
  close_rate?: number;
  close_time?: number;
}

export interface IQRawDigitalOrderResult {
  id: string | number;
  active_id: number;
  direction: string;
  win?: string;
  profit?: number | null;
  status: string;
  close_time?: number;
}
