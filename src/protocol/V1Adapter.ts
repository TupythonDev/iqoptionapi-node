import type { MessageName } from '../types/messages';

export interface ProtocolAdapter {
  readonly authorization: MessageName;
  readonly ssid: MessageName;
  readonly profile: MessageName;
  readonly getCandles: MessageName;
  readonly candles: MessageName;
  readonly candleGenerated: MessageName;
  readonly subscribe: MessageName;
  readonly unsubscribe: MessageName;
  readonly quoteGenerated: MessageName;
  readonly initData: MessageName;
  readonly buyV2: MessageName;
  readonly buyComplete: MessageName;
  readonly option: MessageName;
  readonly digitalOrderBinary: MessageName;
  readonly heartbeat: MessageName;
}

export const V1Adapter: ProtocolAdapter = {
  authorization: 'authorization',
  ssid: 'ssid',
  profile: 'profile',
  getCandles: 'get-candles',
  candles: 'candles',
  candleGenerated: 'candle-generated',
  subscribe: 'subscribeMessage',
  unsubscribe: 'unsubscribeMessage',
  quoteGenerated: 'quote-generated',
  initData: 'init_data',
  buyV2: 'buyV2',
  buyComplete: 'buy-complete',
  option: 'option',
  digitalOrderBinary: 'digital-options/place-order-binary',
  heartbeat: 'heartbeat',
} as const;
