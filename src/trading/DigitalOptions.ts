import { EventEmitter } from 'events';
import type { MessageRouter, MessageHandler } from '../transport/MessageRouter';
import type { AssetCatalog } from '../market-data/AssetCatalog';
import type { OrderCache } from './OrderCache';
import type {
  BuyDigitalOptionParams,
  DigitalOptionResult,
  IQPosition,
  OrderResult,
} from '../types/trading';
import type { ActiveId } from '../types/primitives';
import type { IQRawDigitalOrderResult } from '../types/raw/order';
import { V1Adapter } from '../protocol/V1Adapter';
import { TradingError, ValidationError, TimeoutError } from '../errors';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const DEFAULT_RESULT_TIMEOUT_MS = 60_000;

function asActiveId(n: number): ActiveId {
  return n as unknown as ActiveId;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface DigitalOptions {
  on(
    event: 'tradingCircuitOpen',
    listener: (info: { module: string; failures: number }) => void,
  ): this;
  emit(event: 'tradingCircuitOpen', info: { module: string; failures: number }): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DigitalOptions extends EventEmitter {
  private consecutiveFailures = 0;
  private circuitOpen = false;

  constructor(
    private readonly router: MessageRouter,
    private readonly catalog: AssetCatalog,
    private readonly cache: OrderCache,
  ) {
    super();
  }

  async buy(params: BuyDigitalOptionParams): Promise<{ orderId: string }> {
    if (this.circuitOpen) {
      throw new TradingError('Circuit breaker is open — too many consecutive failures');
    }

    const asset = this.catalog.getAsset(params.symbol);
    if (!asset) throw new ValidationError(`Unknown asset: ${params.symbol}`);

    try {
      const response = await this.router.sendRequest<IQRawDigitalOrderResult>(
        V1Adapter.digitalOrderBinary,
        {
          active_id: asset.activeId,
          direction: params.direction,
          amount: params.amount,
          duration: params.durationSeconds,
          instrument_type: 'digital-option',
        },
      );

      const raw = response.msg;
      if (!raw.id) throw new TradingError('Digital buy response missing order ID');

      const position: IQPosition = {
        orderId: String(raw.id),
        activeId: asActiveId(raw.active_id),
        direction: params.direction,
        amount: params.amount,
        profitPercent: 0,
        status: 'open',
        openTime: Date.now(),
        closeTime: null,
        profitAmount: null,
        win: null,
      };

      this.cache.add(position);
      this.consecutiveFailures = 0;
      return { orderId: position.orderId };
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  checkResult(
    orderId: string,
    timeoutMs = DEFAULT_RESULT_TIMEOUT_MS,
  ): Promise<DigitalOptionResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.router.unregisterHandler(V1Adapter.option, handler);
        reject(new TimeoutError(`Timeout waiting for digital result of order ${orderId}`));
      }, timeoutMs);

      const handler: MessageHandler = (msg) => {
        const raw = msg.msg as IQRawDigitalOrderResult;
        if (String(raw.id) !== orderId) return;

        clearTimeout(timer);
        this.router.unregisterHandler(V1Adapter.option, handler);

        const win = (raw.win ?? 'loss') as OrderResult;
        const profitAmount = raw.profit ?? null;

        this.cache.close(orderId, {
          win,
          profitAmount,
          closeTime: (raw.close_time ?? 0) * 1000,
        });

        resolve({ orderId, win, profitAmount });
      };

      this.router.registerHandler(V1Adapter.option, handler);
    });
  }

  resetCircuit(): void {
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
  }

  get isCircuitOpen(): boolean {
    return this.circuitOpen;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpen = true;
      this.emit('tradingCircuitOpen', {
        module: 'DigitalOptions',
        failures: this.consecutiveFailures,
      });
    }
  }
}
