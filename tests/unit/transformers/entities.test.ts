import { transformCandle, transformAsset, transformTick } from '../../../src/transformers/entities';
import { TimeFrame } from '../../../src/types/primitives';
import type { IQRawCandle } from '../../../src/types/raw/candle';
import type { IQRawAsset } from '../../../src/types/raw/asset';
import type { IQRawTick } from '../../../src/types/raw/tick';

const rawCandle: IQRawCandle = {
  active_id: 1,
  size: 60,
  at: 1700000000,
  open: 1.08,
  max: 1.082,
  min: 1.079,
  close: 1.081,
  volume: 1500,
};

const rawAsset: IQRawAsset = {
  id: 1,
  name: 'EURUSD',
  precision: 5,
  suspended: false,
  is_otc: false,
  option: { profit: 80 },
  digital_profit: 90,
  schedule: [{ open: 1700000000, close: 1700086400 }],
};

const rawTick: IQRawTick = {
  active_id: 1,
  price: 1.081,
  ask: 1.0812,
  bid: 1.0808,
  time: 1700000030,
};

describe('transformCandle', () => {
  it('maps raw fields to IQCandle correctly', () => {
    const c = transformCandle(rawCandle);
    expect(c.high).toBe(1.082);
    expect(c.low).toBe(1.079);
    expect(c.volume).toBe(1500);
    expect(c.timeframe).toBe(TimeFrame.M1);
  });

  it('converts server Unix seconds to milliseconds', () => {
    const c = transformCandle(rawCandle);
    expect(c.time).toBe(1700000000 * 1000);
  });
});

describe('transformAsset', () => {
  it('maps raw fields to IQAsset correctly', () => {
    const a = transformAsset(rawAsset);
    expect(a.name).toBe('EURUSD');
    expect(a.symbol).toBe('EURUSD');
    expect(a.precision).toBe(5);
    expect(a.isOtc).toBe(false);
    expect(a.isSuspended).toBe(false);
    expect(a.profitPercent.binary).toBe(80);
    expect(a.profitPercent.digital).toBe(90);
    expect(a.schedules).toHaveLength(1);
  });

  it('detects OTC via is_otc flag', () => {
    const a = transformAsset({ ...rawAsset, is_otc: true, name: 'EURUSD' });
    expect(a.isOtc).toBe(true);
  });

  it('detects OTC via -OTC name suffix (no is_otc flag present)', () => {
    // Omit is_otc entirely to simulate assets that only have the -OTC suffix.
    const { is_otc: _, ...rest } = rawAsset;
    const a = transformAsset({ ...rest, name: 'EURUSD-OTC' });
    expect(a.isOtc).toBe(true);
  });

  it('strips -OTC suffix from symbol', () => {
    const a = transformAsset({ ...rawAsset, name: 'EURUSD-OTC' });
    expect(a.symbol).toBe('EURUSD');
    expect(a.name).toBe('EURUSD-OTC');
  });

  it('handles missing optional fields gracefully', () => {
    const a = transformAsset({ id: 99, name: 'XYZUSD', precision: 2 });
    expect(a.profitPercent.binary).toBe(0);
    expect(a.profitPercent.digital).toBe(0);
    expect(a.schedules).toEqual([]);
    expect(a.isSuspended).toBe(false);
    expect(a.isOtc).toBe(false);
  });
});

describe('transformTick', () => {
  it('converts Unix seconds to milliseconds', () => {
    const t = transformTick(rawTick);
    expect(t.time).toBe(1700000030 * 1000);
    expect(t.price).toBe(1.081);
    expect(t.ask).toBe(1.0812);
    expect(t.bid).toBe(1.0808);
  });
});
