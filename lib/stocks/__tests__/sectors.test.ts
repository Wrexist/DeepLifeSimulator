import {
  ALL_SECTORS,
  nextState,
  sampleDuration,
  SECTOR_MODIFIER,
  sectorForSymbol,
  sectorTiltFor,
  STOCK_SECTORS,
} from '../sectors';

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
  it('tags all 20 default stocks', () => {
    const expected = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX', 'WMT', 'JPM', 'JNJ', 'PG', 'KO', 'DIS', 'V', 'MA', 'HD', 'BA', 'CAT', 'IBM'];
    for (const sym of expected) {
      expect(STOCK_SECTORS[sym]).toBeDefined();
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
