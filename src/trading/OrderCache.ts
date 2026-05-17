import { EventEmitter } from 'events';
import type { IQPosition } from '../types/trading';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface OrderCache {
  on(event: 'orderClosed', listener: (position: IQPosition) => void): this;
  emit(event: 'orderClosed', position: IQPosition): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class OrderCache extends EventEmitter {
  private readonly openOrders = new Map<string, IQPosition>();
  private readonly closedOrders: IQPosition[] = [];

  add(position: IQPosition): void {
    this.openOrders.set(position.orderId, position);
  }

  close(orderId: string, update: Partial<IQPosition>): IQPosition | null {
    const existing = this.openOrders.get(orderId);
    if (!existing) return null;

    const closed: IQPosition = { ...existing, ...update, status: 'closed' };
    this.openOrders.delete(orderId);
    this.closedOrders.push(closed);
    this.emit('orderClosed', closed);
    return closed;
  }

  getOpen(): IQPosition[] {
    return Array.from(this.openOrders.values());
  }

  getClosed(limit?: number): IQPosition[] {
    if (limit === undefined) return [...this.closedOrders];
    return this.closedOrders.slice(-limit);
  }

  has(orderId: string): boolean {
    return this.openOrders.has(orderId);
  }

  clear(): void {
    this.openOrders.clear();
    this.closedOrders.length = 0;
  }
}
