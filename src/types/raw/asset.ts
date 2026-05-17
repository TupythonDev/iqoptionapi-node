export interface IQRawSchedule {
  open: number;
  close: number;
}

export interface IQRawAsset {
  id: number;
  name: string;
  is_otc?: boolean;
  suspended?: boolean;
  precision: number;
  schedule?: IQRawSchedule[];
  option?: { profit?: number };
  digital_profit?: number;
}

export interface IQRawInitData {
  instruments: IQRawAsset[];
}
