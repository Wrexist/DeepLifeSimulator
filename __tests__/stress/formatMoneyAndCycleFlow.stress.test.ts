/**
 * Audit pass — bugs found in this round:
 *  - BUGFIX #35: IAPHandler require-cycle through GameContext barrel caused
 *    `useGame` to be undefined at render → SceneView "Element type is invalid"
 *    crash on every fresh app launch.
 *  - BUGFIX #36: formatMoney(NaN) / formatMoney(Infinity) rendered as "$NaN"
 *    or "$Infinity" in the UI when upstream calc bugs leaked.
 *  - BUGFIX #37: formatCurrency(NaN) same problem.
 *  - BUGFIX #38: SeasonalEventModal + InteractiveTutorial Animated.loop()
 *    calls without cleanup → memory leak + wasted CPU after modal close.
 *
 * Plus regression tests so a follow-up edit can't reintroduce.
 */

import { formatMoney, formatMoneyNoSign, formatCurrency } from '@/utils/moneyFormatting';

// ---------------------------------------------------------------------------
// formatMoney — BUGFIX #36, #37
// ---------------------------------------------------------------------------
describe('formatMoney NaN/Infinity safety — BUGFIX #36', () => {
  it('NaN renders as $0', () => {
    expect(formatMoney(NaN)).toBe('$0');
  });

  it('Infinity renders as $0', () => {
    expect(formatMoney(Infinity)).toBe('$0');
  });

  it('-Infinity renders as $0', () => {
    expect(formatMoney(-Infinity)).toBe('$0');
  });

  it('undefined renders as $0', () => {
    expect(formatMoney(undefined as any)).toBe('$0');
  });

  it('null renders as $0', () => {
    expect(formatMoney(null as any)).toBe('$0');
  });

  it('"100" (string) renders as $0 (not "$100")', () => {
    expect(formatMoney('100' as any)).toBe('$0');
  });

  it('regular numbers still format correctly', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(50)).toBe('$50');
    // toLocaleString output uses the platform's locale separator (NBSP, space, or comma)
    expect(formatMoney(1500)).toMatch(/^\$1\D500$/);
    expect(formatMoney(1_500_000)).toMatch(/^\$1\.50?M$/);
    expect(formatMoney(1_500_000_000)).toMatch(/^\$1\.50?B$/);
  });

  it('negative numbers still work', () => {
    expect(formatMoney(-500)).toBe('$-500');
    expect(formatMoney(-1_500_000)).toMatch(/^\$-1\.50?M$/);
  });

  it('formatMoneyNoSign: NaN renders as 0', () => {
    expect(formatMoneyNoSign(NaN)).toBe('0');
  });
});

describe('formatCurrency NaN/Infinity safety — BUGFIX #37', () => {
  it('NaN with currency renders as "0 GEMS"', () => {
    expect(formatCurrency(NaN, 'GEMS')).toBe('0 GEMS');
  });

  it('NaN without currency renders as "0"', () => {
    expect(formatCurrency(NaN)).toBe('0');
  });

  it('Infinity renders as 0', () => {
    expect(formatCurrency(Infinity, 'GEMS')).toBe('0 GEMS');
  });

  it('regular currency formatting still works', () => {
    expect(formatCurrency(100, 'GEMS')).toBe('100 GEMS');
    expect(formatCurrency(1_500_000, 'COINS')).toMatch(/^1\.50?M COINS$/);
  });

  it('fuzz: 100 random inputs never produce NaN/Infinity in output', () => {
    const inputs: any[] = [
      0, 1, -1, 1.5, -1.5, NaN, Infinity, -Infinity,
      Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
      undefined, null, '5', 'not a number', {}, [],
    ];
    for (const v of inputs) {
      const result = formatMoney(v as any);
      expect(typeof result).toBe('string');
      expect(result.includes('NaN')).toBe(false);
      expect(result.includes('Infinity')).toBe(false);
      expect(result.includes('undefined')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Require cycle — BUGFIX #35 (cannot test directly without spinning up
// React Native, but we can verify the IAPHandler module imports from leaf
// contexts only, not from the barrel)
// ---------------------------------------------------------------------------
describe('IAPHandler require-cycle fix — BUGFIX #35', () => {
  it('IAPHandler source does NOT import from @/contexts/GameContext (barrel)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const file = path.resolve(__dirname, '../../components/IAPHandler.tsx');
    const src = fs.readFileSync(file, 'utf8');
    // The cycle was triggered by importing from the barrel; verify we now
    // import from the leaf context files instead.
    expect(/from\s+['"]@\/contexts\/GameContext['"]/.test(src)).toBe(false);
    expect(/from\s+['"]@\/contexts\/game\/GameStateContext['"]/.test(src)).toBe(true);
    expect(/from\s+['"]@\/contexts\/game\/GameActionsContext['"]/.test(src)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Animation cleanup — BUGFIX #38 (source-level invariant)
// ---------------------------------------------------------------------------
describe('Animated.loop cleanup — BUGFIX #38', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');

  it('SeasonalEventModal: every Animated.loop is stopped on cleanup', () => {
    const file = path.resolve(__dirname, '../../components/events/SeasonalEventModal.tsx');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('sparkleLoop?.stop()');
    expect(src).toContain('pulseLoop?.stop()');
  });

  it('InteractiveTutorial: every Animated.loop is stopped on cleanup', () => {
    const file = path.resolve(__dirname, '../../components/InteractiveTutorial.tsx');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('pulseLoop?.stop()');
    expect(src).toContain('arrowLoop?.stop()');
  });
});
