import type { MessageRouter } from '../transport/MessageRouter';
import type { AssetCatalog } from './AssetCatalog';
import type { IQCandle } from '../types/market-data';
import type { TimeFrame } from '../types/primitives';
import type { IQRawCandlesResponse } from '../types/raw/candle';
import { transformCandle } from '../transformers/entities';
import { ValidationError } from '../errors';
import { V1Adapter } from '../protocol/V1Adapter';

export class HistoricalCandles {
  private readonly router: MessageRouter;
  private readonly catalog: AssetCatalog;

  constructor(router: MessageRouter, catalog: AssetCatalog) {
    this.router = router;
    this.catalog = catalog;
  }

  async getCandles(
    symbol: string,
    timeframe: TimeFrame,
    count: number,
    endTime?: number,
  ): Promise<IQCandle[]> {
    const asset = this.catalog.getAsset(symbol);
    if (!asset) throw new ValidationError(`Unknown asset: ${symbol}`);
    if (count <= 0) throw new ValidationError('count must be greater than 0');

    const params: Record<string, unknown> = {
      active_id: asset.activeId,
      size: timeframe,
      count,
    };
    if (endTime !== undefined) params['to'] = Math.floor(endTime / 1000);

    const response = await this.router.sendRequest<IQRawCandlesResponse>(
      V1Adapter.getCandles,
      params,
    );

    return response.msg.candles.map(transformCandle).sort((a, b) => a.time - b.time);
  }
}
