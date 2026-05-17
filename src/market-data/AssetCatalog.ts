import type { MessageRouter } from '../transport/MessageRouter';
import type { IQRawInitData } from '../types/raw/asset';
import type { IQAsset, IQAssetMap } from '../types/market-data';
import type { ActiveId } from '../types/primitives';
import { transformAsset } from '../transformers/entities';
import { V1Adapter } from '../protocol/V1Adapter';

export class AssetCatalog {
  private readonly byId: IQAssetMap = new Map();
  private readonly byName = new Map<string, IQAsset>();

  constructor(router: MessageRouter) {
    router.registerHandler(V1Adapter.initData, (msg) => {
      const data = msg.msg as IQRawInitData;
      this.populate(data);
    });
  }

  private populate(data: IQRawInitData): void {
    this.byId.clear();
    this.byName.clear();

    for (const raw of data.instruments) {
      const asset = transformAsset(raw);
      this.byId.set(asset.activeId, asset);
      this.byName.set(asset.name.toUpperCase(), asset);
    }
  }

  getAsset(symbol: string): IQAsset | undefined {
    const upper = symbol.toUpperCase();
    return this.byName.get(upper) ?? this.byName.get(`${upper}-OTC`);
  }

  getAssetById(activeId: ActiveId): IQAsset | undefined {
    return this.byId.get(activeId);
  }

  getAllAssets(): IQAsset[] {
    return Array.from(this.byId.values());
  }

  getOpenAssets(): IQAsset[] {
    return this.getAllAssets().filter((a) => !a.isSuspended);
  }

  getOtcAssets(): IQAsset[] {
    return this.getAllAssets().filter((a) => a.isOtc);
  }

  getNonOtcAssets(): IQAsset[] {
    return this.getAllAssets().filter((a) => !a.isOtc);
  }
}
