import type { MessageRouter, MessageHandler } from '../transport/MessageRouter';
import type { ReconnectionManager } from '../transport/ReconnectionManager';
import type { AssetCatalog } from './AssetCatalog';
import type { IQCandle } from '../types/market-data';
import type { TimeFrame } from '../types/primitives';
import type { IQRawCandle } from '../types/raw/candle';
import { CandleBuffer } from './CandleBuffer';
import { transformCandle } from '../transformers/entities';
import { ValidationError } from '../errors';
import { V1Adapter } from '../protocol/V1Adapter';

interface Subscription {
  activeId: number;
  timeframe: TimeFrame;
  buffer: CandleBuffer;
  handler: MessageHandler;
  callback: (candle: IQCandle) => void;
}

function subKey(symbol: string, timeframe: TimeFrame): string {
  return `${symbol.toUpperCase()}:${String(timeframe)}`;
}

export class CandleStream {
  private readonly router: MessageRouter;
  private readonly catalog: AssetCatalog;
  private readonly subs = new Map<string, Subscription>();

  constructor(router: MessageRouter, catalog: AssetCatalog, reconnection: ReconnectionManager) {
    this.router = router;
    this.catalog = catalog;
    reconnection.on('reconnected', () => {
      this.resubscribeAll();
    });
  }

  subscribe(symbol: string, timeframe: TimeFrame, callback: (candle: IQCandle) => void): void {
    const key = subKey(symbol, timeframe);
    if (this.subs.has(key)) return;

    const asset = this.catalog.getAsset(symbol);
    if (!asset) throw new ValidationError(`Unknown asset: ${symbol}`);

    const buffer = new CandleBuffer();

    const handler: MessageHandler = (msg) => {
      const raw = msg.msg as IQRawCandle;
      if (raw.active_id !== asset.activeId || raw.size !== timeframe) return;
      const candle = transformCandle(raw);
      buffer.push(candle);
      callback(candle);
    };

    this.router.registerHandler(V1Adapter.candleGenerated, handler);
    this.sendSubscribe(asset.activeId, timeframe);

    this.subs.set(key, { activeId: asset.activeId, timeframe, buffer, handler, callback });
  }

  unsubscribe(symbol: string, timeframe: TimeFrame): void {
    const key = subKey(symbol, timeframe);
    const sub = this.subs.get(key);
    if (!sub) return;

    this.router.unregisterHandler(V1Adapter.candleGenerated, sub.handler);
    this.sendUnsubscribe(sub.activeId, sub.timeframe);
    this.subs.delete(key);
  }

  getBuffer(symbol: string, timeframe: TimeFrame): CandleBuffer | undefined {
    return this.subs.get(subKey(symbol, timeframe))?.buffer;
  }

  private resubscribeAll(): void {
    for (const sub of this.subs.values()) {
      this.sendSubscribe(sub.activeId, sub.timeframe);
    }
  }

  private sendSubscribe(activeId: number, timeframe: TimeFrame): void {
    this.router.sendMessage(V1Adapter.subscribe, {
      name: V1Adapter.candleGenerated,
      params: { active_id: activeId, size: timeframe },
    });
  }

  private sendUnsubscribe(activeId: number, timeframe: TimeFrame): void {
    this.router.sendMessage(V1Adapter.unsubscribe, {
      name: V1Adapter.candleGenerated,
      params: { active_id: activeId, size: timeframe },
    });
  }
}
