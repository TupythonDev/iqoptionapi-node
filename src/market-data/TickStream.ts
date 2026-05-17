import type { MessageRouter, MessageHandler } from '../transport/MessageRouter';
import type { ReconnectionManager } from '../transport/ReconnectionManager';
import type { AssetCatalog } from './AssetCatalog';
import type { IQTick } from '../types/market-data';
import type { IQRawTick } from '../types/raw/tick';
import { TickAggregator } from './TickAggregator';
import { transformTick } from '../transformers/entities';
import { ValidationError } from '../errors';
import { V1Adapter } from '../protocol/V1Adapter';

interface Subscription {
  activeId: number;
  handler: MessageHandler;
  callback: (tick: IQTick) => void;
}

export class TickStream {
  private readonly router: MessageRouter;
  private readonly catalog: AssetCatalog;
  readonly aggregator: TickAggregator;
  private readonly subs = new Map<string, Subscription>();

  constructor(router: MessageRouter, catalog: AssetCatalog, reconnection: ReconnectionManager) {
    this.router = router;
    this.catalog = catalog;
    this.aggregator = new TickAggregator();
    reconnection.on('reconnected', () => {
      this.resubscribeAll();
    });
  }

  subscribe(symbol: string, callback: (tick: IQTick) => void): void {
    const key = symbol.toUpperCase();
    if (this.subs.has(key)) return;

    const asset = this.catalog.getAsset(symbol);
    if (!asset) throw new ValidationError(`Unknown asset: ${symbol}`);

    const handler: MessageHandler = (msg) => {
      const raw = msg.msg as IQRawTick;
      if (raw.active_id !== asset.activeId) return;
      const tick = transformTick(raw);
      this.aggregator.push(tick);
      callback(tick);
    };

    this.router.registerHandler(V1Adapter.quoteGenerated, handler);
    this.sendSubscribe(asset.activeId);

    this.subs.set(key, { activeId: asset.activeId, handler, callback });
  }

  unsubscribe(symbol: string): void {
    const key = symbol.toUpperCase();
    const sub = this.subs.get(key);
    if (!sub) return;

    this.router.unregisterHandler(V1Adapter.quoteGenerated, sub.handler);
    this.sendUnsubscribe(sub.activeId);
    this.subs.delete(key);
  }

  private resubscribeAll(): void {
    for (const sub of this.subs.values()) {
      this.sendSubscribe(sub.activeId);
    }
  }

  private sendSubscribe(activeId: number): void {
    this.router.sendMessage(V1Adapter.subscribe, {
      name: V1Adapter.quoteGenerated,
      params: { routingFilters: { active_id: activeId } },
    });
  }

  private sendUnsubscribe(activeId: number): void {
    this.router.sendMessage(V1Adapter.unsubscribe, {
      name: V1Adapter.quoteGenerated,
      params: { routingFilters: { active_id: activeId } },
    });
  }
}
