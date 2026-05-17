import type { OrderCache } from './OrderCache';
import type { IQPosition } from '../types/trading';

export class OrderHistory {
  constructor(private readonly cache: OrderCache) {}

  getOpenPositions(): IQPosition[] {
    return this.cache.getOpen();
  }

  getClosedPositions(limit?: number): IQPosition[] {
    return this.cache.getClosed(limit);
  }
}
