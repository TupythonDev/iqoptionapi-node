export type MessageName =
  | 'authorization'
  | 'ssid'
  | 'profile'
  | 'get-candles'
  | 'candles'
  | 'candle-generated'
  | 'subscribeMessage'
  | 'unsubscribeMessage'
  | 'quote-generated'
  | 'init_data'
  | 'buyV2'
  | 'buy-complete'
  | 'option'
  | 'digital-options/place-order-binary'
  | 'heartbeat';

export interface IQRawMessage<T = unknown> {
  name: MessageName;
  msg: T;
  request_id?: string;
}

export type IQIncomingMessage = IQRawMessage;
