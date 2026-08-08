/**
 * What it costs to come back from the dead.
 *
 * Three products sold the SAME outcome at wildly different prices, and nothing
 * compared them because each was configured in its own file:
 *
 *   - Revive             15,000 gems  (the contents of the $49.99 pack)
 *   - Revival Pack IAP   $2.99        ("Instant revival on death", same effect)
 *   - Rewind → "Before Death"  500 gems (a living character, one week older)
 *
 * So the gem route charged about sixteen times the real-money route for an
 * identical result, and a 500-gem rewind undercut both. None of it was a bug in
 * any one file; it was only visible by reading three files together, which is
 * exactly what this test does so it cannot drift apart again.
 */

import { REVIVE_GEM_COST } from '@/lib/config/gameConstants';
import { BASE_REWIND_COST } from '@/lib/timeMachine/checkpointSystem';
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';
import { applyAutoCheckpoint } from '@/contexts/game/actions/weekly/applyAutoCheckpoint';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameStats } from '@/contexts/game/types';

/** Cheapest and dearest gems-per-dollar across the whole ladder. */
function gemRateBounds(): { min: number; max: number } {
  const rates: number[] = [];
  for (const id of Object.values(IAP_PRODUCTS)) {
    const cfg = getProductConfig(id) as { gems?: number; price?: string } | undefined;
    const gems = cfg?.gems;
    const usd = Number(String(cfg?.price ?? '').replace(/[^0-9.]/g, ''));
    if (typeof gems === 'number' && gems > 0 && usd > 0) rates.push(gems / usd);
  }
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

const packUsd = () =>
  Number(
    String((getProductConfig(IAP_PRODUCTS.REVIVAL_PACK) as { price?: string })?.price ?? '').replace(
      /[^0-9.]/g,
      ''
    )
  );

// ---------------------------------------------------------------------------

describe('the Revival Pack is the honest best deal, and stays that way', () => {
  it('has a price and a revival flag, so the death screen can quote it', () => {
    const cfg = getProductConfig(IAP_PRODUCTS.REVIVAL_PACK) as {
      price?: string;
      revival?: boolean;
    };
    expect(cfg?.revival).toBe(true);
    expect(cfg?.price).toMatch(/^\$\d/);
  });

  it('costs less in real money than buying the gems to revive would', () => {
    // The property that was violated. At 15,000 gems the gem route cost
    // $30-$150 depending on pack — against a $2.99 button doing the same thing.
    const { min, max } = gemRateBounds();
    const cheapestUsdForRevive = REVIVE_GEM_COST / max;
    const dearestUsdForRevive = REVIVE_GEM_COST / min;

    expect(packUsd()).toBeLessThan(cheapestUsdForRevive);
    expect(packUsd()).toBeLessThan(dearestUsdForRevive);
  });

  it('is not so much cheaper that the gem price is a joke', () => {
    // The other failure mode: if gems were near-free the sink would be gone and
    // death would stop mattering. Revive should be worth single-to-double-digit
    // dollars of gems, not hundreds and not pennies.
    const { min, max } = gemRateBounds();
    expect(REVIVE_GEM_COST / max).toBeGreaterThanOrEqual(5);
    expect(REVIVE_GEM_COST / min).toBeLessThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------

describe('rewinding is not a cheap revive', () => {
  it('no longer snapshots a checkpoint on the tick that kills you', () => {
    // The exploit: that snapshot was one week before death, so a first rewind
    // at BASE_REWIND_COST handed back a living character for a fraction of
    // either revive price.
    const state = createTestGameState({ weeksLived: 99, showDeathPopup: false });
    const stats = state.stats as GameStats;

    const result = applyAutoCheckpoint({
      prevState: state,
      newStats: { ...stats, health: 0 },
      nextWeeksLived: 100,
    });

    const labels = (result.partial.checkpoints ?? []).map((cp) => cp.label);
    expect(labels).not.toContain('Before Death');
  });

  it('costs far less than a revive — which is only sound because it costs a YEAR', () => {
    // Rewind staying cheap is correct: year checkpoints cost up to 52 weeks of
    // progress, so it is a real trade rather than a discount on dying. The
    // relationship is asserted so nobody "fixes" the price by raising this one.
    expect(BASE_REWIND_COST).toBeLessThan(REVIVE_GEM_COST);
  });
});

// ---------------------------------------------------------------------------

describe('the revive price has one source', () => {
  it('is not hard-coded anywhere that renders it to the player', () => {
    // The help copy quoted "15,000 gems" as a literal and would have gone stale
    // the moment the constant moved — which it just did.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const help = require('fs').readFileSync('components/HelpModal.tsx', 'utf8') as string;
    expect(help).toContain('REVIVE_GEM_COST');
    expect(help).not.toMatch(/Revive with gems \(\s*(costs\s*)?[\d,]+\s*gems\)/);
  });
});
