import { AssetCatalog } from '../../../src/market-data/AssetCatalog';
import type { MessageRouter } from '../../../src/transport/MessageRouter';
import initDataFixture from '../../fixtures/assets/init_data.json';
import type { IQRawMessage } from '../../../src/types/messages';

function makeRouter() {
  const handlers = new Map<string, Set<(msg: IQRawMessage) => void>>();

  const router = {
    registerHandler: jest.fn((name: string, handler: (msg: IQRawMessage) => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(handler);
    }),
    trigger: (name: string, msg: IQRawMessage) => {
      handlers.get(name)?.forEach((h) => {
        h(msg);
      });
    },
  };

  return { router: router as unknown as MessageRouter, trigger: router.trigger };
}

describe('AssetCatalog', () => {
  let trigger: (name: string, msg: IQRawMessage) => void;
  let catalog: AssetCatalog;

  beforeEach(() => {
    const r = makeRouter();
    trigger = r.trigger;
    catalog = new AssetCatalog(r.router);
    trigger('init_data', initDataFixture as unknown as IQRawMessage);
  });

  it('populates from init_data and returns all assets', () => {
    expect(catalog.getAllAssets()).toHaveLength(3);
  });

  it('getAsset() finds by symbol (case-insensitive)', () => {
    expect(catalog.getAsset('eurusd')?.name).toBe('EURUSD');
    expect(catalog.getAsset('EURUSD')?.name).toBe('EURUSD');
  });

  it('getAsset() finds OTC variant by base symbol', () => {
    expect(catalog.getAsset('EURUSD-OTC')?.name).toBe('EURUSD-OTC');
  });

  it('getAsset() returns undefined for unknown symbol', () => {
    expect(catalog.getAsset('UNKNOWN')).toBeUndefined();
  });

  it('getOtcAssets() returns only OTC assets', () => {
    const otc = catalog.getOtcAssets();
    expect(otc.every((a) => a.isOtc)).toBe(true);
    expect(otc.map((a) => a.name)).toContain('EURUSD-OTC');
  });

  it('getNonOtcAssets() returns only non-OTC assets', () => {
    const nonOtc = catalog.getNonOtcAssets();
    expect(nonOtc.every((a) => !a.isOtc)).toBe(true);
  });

  it('getOpenAssets() excludes suspended assets', () => {
    const open = catalog.getOpenAssets();
    expect(open.every((a) => !a.isSuspended)).toBe(true);
    expect(open.map((a) => a.name)).not.toContain('GBPUSD');
  });

  it('getAssetById() returns asset by numeric activeId', () => {
    const asset = catalog.getAllAssets()[0];
    expect(asset).toBeDefined();
    expect(catalog.getAssetById(asset!.activeId)).toBe(asset);
  });

  it('getAssetById() returns undefined for unknown id', () => {
    expect(
      catalog.getAssetById(9999 as unknown as import('../../../src/types/primitives').ActiveId),
    ).toBeUndefined();
  });

  it('repopulates when a second init_data arrives', () => {
    const smallData = {
      name: 'init_data',
      msg: { instruments: [{ id: 99, name: 'XYZUSD', precision: 2 }] },
    };
    trigger('init_data', smallData as unknown as IQRawMessage);
    expect(catalog.getAllAssets()).toHaveLength(1);
    expect(catalog.getAsset('XYZUSD')?.name).toBe('XYZUSD');
  });
});
