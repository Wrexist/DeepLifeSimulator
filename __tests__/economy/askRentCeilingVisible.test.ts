/**
 * An over-asked rent was accepted and then silently clamped.
 *
 * `effectiveAskRent` caps what a tenant pays at `value × ASK_RENT_CEILING_RATE`
 * (0.4% of property value per week). `ManagePropertyModal` accepts any typed
 * number and says nothing, so a player asking $5,000/wk on a $200,000 property
 * collects $800 and is never told why.
 *
 * Deliberately scoped SMALLER than the savings-APR fix, because the severity is
 * genuinely lower and the fix should match:
 *
 *   - All three suggested yields (longTerm 0.0015, airbnb 0.0028, commercial
 *     0.0020) sit BELOW the 0.004 ceiling, so the modal's own pre-filled
 *     suggestion is always achievable. The ceiling only bites on a deliberate
 *     over-ask.
 *   - `askFillMultiplier` already penalises over-asking through a slower fill,
 *     which is the designed feedback loop. The ceiling is a backstop, not the
 *     primary mechanic.
 *
 * So this does not restructure the display the way the APR fix did. It states
 * the cap at the moment the player exceeds it, and stays silent otherwise —
 * a warning shown on every normal ask would be noise, and noise is how a real
 * warning stops being read.
 */
import {
  ASK_RENT_CEILING_RATE,
  RENT_MODE_PARAMS,
  effectiveAskRent,
} from '@/lib/realEstate/tenancy';
import { askRentCeiling, askRentOverage } from '@/lib/realEstate/askRentGuidance';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the ceiling the guidance quotes is the ceiling that applies', () => {
  it('agrees with effectiveAskRent at and above the cap', () => {
    const value = 200_000;
    const ceiling = askRentCeiling(value);

    expect(ceiling).toBe(value * ASK_RENT_CEILING_RATE);
    expect(ceiling).toBe(800);
    // The payout must agree, or the guidance is quoting a number of its own.
    expect(effectiveAskRent(5000, value, 300)).toBe(ceiling);
    expect(effectiveAskRent(ceiling, value, 300)).toBe(ceiling);
  });

  it('says nothing while the ask is at or under the cap (the control)', () => {
    // A warning on every normal ask is noise, and noise is how a real warning
    // stops being read.
    expect(askRentOverage(700, 200_000)).toBeNull();
    expect(askRentOverage(800, 200_000)).toBeNull();
    expect(askRentOverage(0, 200_000)).toBeNull();
  });

  it('reports the collectable amount once the ask exceeds it', () => {
    const over = askRentOverage(5000, 200_000);

    expect(over).not.toBeNull();
    expect(over!.collected).toBe(800);
    expect(over!.asked).toBe(5000);
  });

  it('every mode\'s suggested rent stays under the cap (the control)', () => {
    // If a suggestion exceeded the ceiling the game would be pre-filling an
    // unachievable number, which would be a far worse bug than the silence.
    for (const mode of ['longTerm', 'airbnb', 'commercial'] as const) {
      expect(RENT_MODE_PARAMS[mode].weeklyYieldMean).toBeLessThan(ASK_RENT_CEILING_RATE);
    }
  });

  it('a zero or corrupt property value cannot produce a bogus cap', () => {
    for (const bad of [0, NaN, -1, Infinity] as number[]) {
      const c = askRentCeiling(bad);
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      // With no usable value there is no cap to advertise.
      expect(askRentOverage(5000, bad)).toBeNull();
    }
  });
});

describe('the modal states the cap when it bites', () => {
  const src = code('components/realEstate/ManagePropertyModal.tsx');

  it('reads the shared guidance rather than re-deriving the rate', () => {
    expect(src).toMatch(/askRentOverage/);
    expect(src).not.toMatch(/0\.004/);
  });

  it('shows the amount that would actually be collected', () => {
    expect(src).toMatch(/collected/);
  });
});
