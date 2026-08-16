import {
  ALL_SECTORS,
  nextState,
  sampleDuration,
  SECTOR_MODIFIER,
  sectorForSymbol,
  sectorTiltFor,
  STOCK_SECTORS,
} from '../sectors';
import { DEFAULT_PRICES } from '@/lib/economy/stockMarket';

describe('sectorForSymbol', () => {
  it('returns the correct sector for known symbols', () => {
    expect(sectorForSymbol('AAPL')).toBe('tech');
    expect(sectorForSymbol('JPM')).toBe('finance');
    expect(sectorForSymbol('JNJ')).toBe('healthcare');
    expect(sectorForSymbol('WMT')).toBe('consumer');
    expect(sectorForSymbol('BA')).toBe('industrial');
  });

  it('falls back to tech for unknown symbols', () => {
    expect(sectorForSymbol('XYZ')).toBe('tech');
  });

  it('is case-insensitive', () => {
    expect(sectorForSymbol('aapl')).toBe('tech');
  });
});

describe('STOCK_SECTORS coverage', () => {
  // M19: the registry is `Record<StockSymbol, Sector>`, keyed off
  // `DEFAULT_PRICES` — the universe. A missing symbol is now a COMPILE error,
  // so this asserts the two registries actually cover the same set (a stale
  // hard-coded list of 20 was what let five symbols go untagged unnoticed).
  it('tags every symbol in the universe, and nothing else', () => {
    expect(Object.keys(STOCK_SECTORS).sort()).toEqual(Object.keys(DEFAULT_PRICES).sort());
  });

  it('every tag is a real sector', () => {
    for (const sector of Object.values(STOCK_SECTORS)) {
      expect(ALL_SECTORS).toContain(sector);
    }
  });
});

describe('SECTOR_MODIFIER', () => {
  it('strong is positive, weak negative, neutral zero', () => {
    expect(SECTOR_MODIFIER.strong).toBeGreaterThan(0);
    expect(SECTOR_MODIFIER.weak).toBeLessThan(0);
    expect(SECTOR_MODIFIER.neutral).toBe(0);
  });
});

describe('nextState', () => {
  it('always returns a valid state', () => {
    for (const s of ['strong', 'neutral', 'weak'] as const) {
      for (let i = 0; i < 100; i++) {
        const next = nextState(s, i / 100);
        expect(['strong', 'neutral', 'weak']).toContain(next);
      }
    }
  });

  it('neutral stays neutral most of the time', () => {
    let neutralCount = 0;
    for (let i = 0; i < 100; i++) {
      if (nextState('neutral', i / 100) === 'neutral') neutralCount++;
    }
    expect(neutralCount).toBeGreaterThan(60); // >60% of rolls keep neutral
  });
});

describe('sampleDuration', () => {
  it('strong/weak runs are shorter than neutral on average', () => {
    let neutralSum = 0;
    let strongSum = 0;
    for (let i = 1; i < 50; i++) {
      neutralSum += sampleDuration('neutral', i / 50);
      strongSum += sampleDuration('strong', i / 50);
    }
    expect(neutralSum).toBeGreaterThan(strongSum);
  });

  it('clamps to at least 2 weeks', () => {
    expect(sampleDuration('neutral', 0.001)).toBeGreaterThanOrEqual(2);
  });

  it('clamps to 3× the mean', () => {
    expect(sampleDuration('strong', 0.999)).toBeLessThanOrEqual(18);
  });
});

describe('sectorTiltFor', () => {
  it('returns positive tilt for a stock in a strong sector', () => {
    const tilt = sectorTiltFor('AAPL', [
      { sector: 'tech', state: 'strong', weeksRemaining: 10 },
      { sector: 'finance', state: 'neutral', weeksRemaining: 10 },
    ]);
    expect(tilt).toBe(SECTOR_MODIFIER.strong);
  });

  it('returns 0 when sector is not in snapshots', () => {
    expect(sectorTiltFor('AAPL', [])).toBe(0);
  });
});

describe('ALL_SECTORS', () => {
  it('contains 6 distinct sectors', () => {
    expect(new Set(ALL_SECTORS).size).toBe(ALL_SECTORS.length);
    expect(ALL_SECTORS.length).toBe(6);
  });
});

describe('energy + healthcare content (no dead 0-stock tile)', () => {
  it('energy has at least 3 mapped symbols', () => {
    const energy = Object.entries(STOCK_SECTORS).filter(([, sec]) => sec === 'energy').map(([s]) => s);
    expect(energy.length).toBeGreaterThanOrEqual(3);
    expect(sectorForSymbol('XOM')).toBe('energy');
    expect(sectorForSymbol('CVX')).toBe('energy');
    expect(sectorForSymbol('SLB')).toBe('energy');
  });

  it('healthcare has more than one symbol', () => {
    const health = Object.entries(STOCK_SECTORS).filter(([, sec]) => sec === 'healthcare').map(([s]) => s);
    expect(health.length).toBeGreaterThan(1);
    expect(sectorForSymbol('JNJ')).toBe('healthcare');
    expect(sectorForSymbol('PFE')).toBe('healthcare');
    expect(sectorForSymbol('UNH')).toBe('healthcare');
  });

  it('every ALL_SECTORS entry has at least one listing (no empty board tile)', () => {
    for (const sec of ALL_SECTORS) {
      const count = Object.values(STOCK_SECTORS).filter((s) => s === sec).length;
      expect(count).toBeGreaterThan(0);
    }
  });
});
