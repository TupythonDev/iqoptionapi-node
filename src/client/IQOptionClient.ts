import { WebSocketTransport } from '../transport/WebSocketTransport';
import { MessageRouter } from '../transport/MessageRouter';
import { ReconnectionManager } from '../transport/ReconnectionManager';
import { SessionManager } from '../auth/SessionManager';
import { EmailPasswordAuth } from '../auth/EmailPasswordAuth';
import { SsidAuth } from '../auth/SsidAuth';
import { EmailPasswordCredentials } from '../auth/CredentialAbstraction';
import { AssetCatalog } from '../market-data/AssetCatalog';
import { HistoricalCandles } from '../market-data/HistoricalCandles';
import { CandleStream } from '../market-data/CandleStream';
import { TickStream } from '../market-data/TickStream';
import { OrderCache } from '../trading/OrderCache';
import { BinaryOptions } from '../trading/BinaryOptions';
import { DigitalOptions } from '../trading/DigitalOptions';
import { OrderHistory } from '../trading/OrderHistory';
import { createConsoleLogger, noopLogger } from '../logger';
import type { ILogger } from '../types/logger';
import type { IQProfile } from '../types/profile';
import type { IQAsset, IQCandle, IQTick } from '../types/market-data';
import type {
  IQPosition,
  BuyBinaryOptionParams,
  BuyDigitalOptionParams,
  BinaryOptionResult,
  DigitalOptionResult,
} from '../types/trading';
import type { TimeFrame } from '../types/primitives';

const IQ_WS_URL = 'wss://iqoption.com/echo/websocket';

export interface IQOptionClientOptions {
  url?: string;
  logger?: ILogger;
  silent?: boolean;
  requestTimeoutMs?: number;
  maxReconnectRetries?: number;
}

export class IQOptionClient {
  private readonly transport: WebSocketTransport;
  private readonly router: MessageRouter;
  private readonly reconnection: ReconnectionManager;
  private readonly session: SessionManager;
  private readonly emailAuth: EmailPasswordAuth;
  private readonly ssidAuth: SsidAuth;
  private readonly catalog: AssetCatalog;
  private readonly historical: HistoricalCandles;
  private readonly candleStream: CandleStream;
  private readonly tickStream: TickStream;
  private readonly orderCache: OrderCache;
  private readonly binaryOptions: BinaryOptions;
  private readonly digitalOptions: DigitalOptions;
  private readonly orderHistory: OrderHistory;

  constructor(options: IQOptionClientOptions = {}) {
    const url = options.url ?? IQ_WS_URL;
    const logger = options.logger ?? (options.silent ? noopLogger : createConsoleLogger());
    const maxRetries = options.maxReconnectRetries ?? 5;

    this.transport = new WebSocketTransport(url);
    this.router = new MessageRouter(this.transport);
    this.reconnection = new ReconnectionManager(this.transport, maxRetries);
    this.session = new SessionManager(logger);
    this.ssidAuth = new SsidAuth(this.router, this.session);
    this.emailAuth = new EmailPasswordAuth(this.ssidAuth);
    this.catalog = new AssetCatalog(this.router);
    this.historical = new HistoricalCandles(this.router, this.catalog);
    this.candleStream = new CandleStream(this.router, this.catalog, this.reconnection);
    this.tickStream = new TickStream(this.router, this.catalog, this.reconnection);
    this.orderCache = new OrderCache();
    this.binaryOptions = new BinaryOptions(this.router, this.catalog, this.orderCache);
    this.digitalOptions = new DigitalOptions(this.router, this.catalog, this.orderCache);
    this.orderHistory = new OrderHistory(this.orderCache);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  disconnect(): void {
    this.reconnection.reset();
    this.router.clearPending();
    this.transport.disconnect();
  }

  async login(credentials: { email: string; password: string }): Promise<IQProfile> {
    return this.emailAuth.login(
      new EmailPasswordCredentials(credentials.email, credentials.password),
    );
  }

  async restoreSession(ssid: string): Promise<IQProfile> {
    return this.ssidAuth.restore(ssid);
  }

  getProfile(): IQProfile {
    return this.session.getProfile();
  }

  // --- Assets ---

  getAllAssets(): IQAsset[] {
    return this.catalog.getAllAssets();
  }

  getOpenAssets(): IQAsset[] {
    return this.catalog.getOpenAssets();
  }

  getOtcAssets(): IQAsset[] {
    return this.catalog.getOtcAssets();
  }

  getNonOtcAssets(): IQAsset[] {
    return this.catalog.getNonOtcAssets();
  }

  getAsset(symbol: string): IQAsset | undefined {
    return this.catalog.getAsset(symbol);
  }

  // --- Market Data ---

  getCandles(
    symbol: string,
    timeframe: TimeFrame,
    count: number,
    endTime?: number,
  ): Promise<IQCandle[]> {
    return this.historical.getCandles(symbol, timeframe, count, endTime);
  }

  subscribeCandles(symbol: string, timeframe: TimeFrame, callback: (c: IQCandle) => void): void {
    this.candleStream.subscribe(symbol, timeframe, callback);
  }

  unsubscribeCandles(symbol: string, timeframe: TimeFrame): void {
    this.candleStream.unsubscribe(symbol, timeframe);
  }

  subscribeQuotes(symbol: string, callback: (t: IQTick) => void): void {
    this.tickStream.subscribe(symbol, callback);
  }

  unsubscribeQuotes(symbol: string): void {
    this.tickStream.unsubscribe(symbol);
  }

  // --- Trading ---

  buyBinaryOption(params: BuyBinaryOptionParams): Promise<{ orderId: string }> {
    return this.binaryOptions.buy(params);
  }

  checkBinaryOptionResult(orderId: string, timeoutMs?: number): Promise<BinaryOptionResult> {
    return this.binaryOptions.checkResult(orderId, timeoutMs);
  }

  buyDigitalOption(params: BuyDigitalOptionParams): Promise<{ orderId: string }> {
    return this.digitalOptions.buy(params);
  }

  checkDigitalOptionResult(orderId: string, timeoutMs?: number): Promise<DigitalOptionResult> {
    return this.digitalOptions.checkResult(orderId, timeoutMs);
  }

  getOpenPositions(): IQPosition[] {
    return this.orderHistory.getOpenPositions();
  }

  getClosedPositions(limit?: number): IQPosition[] {
    return this.orderHistory.getClosedPositions(limit);
  }
}
