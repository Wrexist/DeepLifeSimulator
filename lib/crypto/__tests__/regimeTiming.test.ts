/**
 * ECO-1 gate: regime timing must not be a money printer.
 *
 * The audit (2026-10-21) found that the Trade screen showed each coin's regime
 * AND its "weeks left", and the tick only re-rolled a regime when that
 * countdown ran out. So a coin showing "Bull Run, N > 1 weeks left" had a
 * KNOWN bull draw next week, and a player who held whichever coins showed Bull
 * (cash otherwise) earned a median ~66%/yr against ~10% for buy-and-hold.
 *
 * This is a seeded simulation of exactly that player against the production
 * regime step (`evolveCoinRegime`) and price step (`stepPrice`), paying the
 * spread on every switch. It sees only what the screen now shows: the regime,
 * no countdown. Deterministic: every draw comes from a fixed-seed stream.
 */
import { evolveCoinRegime, REGIME_HAZARD_WEEKLY } from '../weeklyTick';
import { REGIME_PARAMS, stepPrice, type CryptoRegime } from '../marketModel';
import { fnv1a32, mulberry32 } from '@/utils/seededRoll';

const COINS = 8;
const LIVES = 300;
const WEEKS = 260;
const BURN_IN = 26;

interface CoinSim {
  regime: CryptoRegime;
  regimeWeeksRemaining: number;
  bidAskSpread: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * One life. Returns annualised returns for the regime-timer and for an
 * equal-weight buy-and-hold of the same tape.
 *
 * `seeCountdown` reproduces the old screen (timer only trusts a Bull with more
 * than one week left); `hazard` false reproduces the old countdown-only tick.
 */
function simulateLife(life: number, opts: { seeCountdown: boolean; hazard: boolean }) {
  const rand = mulberry32(fnv1a32(`regime-timing|${life}`));
  const coins: CoinSim[] = Array.from({ length: COINS }, () => ({
    regime: 'stable' as CryptoRegime,
    regimeWeeksRemaining: 16,
    bidAskSpread: REGIME_PARAMS.stable.bidAskSpread,
  }));

  let timer = 1;
  let hold = 1;
  let held: number[] = [];

  for (let w = 0; w < BURN_IN + WEEKS; w++) {
    const live = w >= BURN_IN;
    // Decide on what the screen showed at the END of last week.
    const bullNow = coins
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.regime === 'bull' && (!opts.seeCountdown || c.regimeWeeksRemaining > 1))
      .map(({ i }) => i);
    if (live) {
      // Turnover: fraction of the book that changes coin. Each switched
      // fraction pays the bull spread (half on the sell, half on the buy).
      const prev = new Set(held);
      const next = new Set(bullNow);
      const prevW = held.length ? 1 / held.length : 0;
      const nextW = bullNow.length ? 1 / bullNow.length : 0;
      let turnover = 0;
      for (let i = 0; i < COINS; i++) {
        turnover += Math.abs((next.has(i) ? nextW : 0) - (prev.has(i) ? prevW : 0));
      }
      timer *= 1 - (turnover / 2) * REGIME_PARAMS.bull.bidAskSpread;
      held = bullNow;
    }

    // Step the market one week.
    const rets: number[] = [];
    for (const c of coins) {
      const step = evolveCoinRegime(c, null, rand(), rand(), opts.hazard ? rand() : 1);
      c.regime = step.regime;
      c.regimeWeeksRemaining = step.weeksRemaining;
      c.bidAskSpread = step.spread;
      const next = stepPrice(100, step.regime, { u1: rand(), u2: rand() });
      rets.push(next / 100 - 1);
    }
    if (live) {
      hold *= 1 + rets.reduce((a, b) => a + b, 0) / COINS;
      if (held.length) timer *= 1 + held.reduce((a, i) => a + rets[i], 0) / held.length;
    }
  }
  const years = WEEKS / 52;
  return { timer: Math.pow(timer, 1 / years) - 1, hold: Math.pow(hold, 1 / years) - 1 };
}

function runCohort(opts: { seeCountdown: boolean; hazard: boolean }) {
  const timer: number[] = [];
  const hold: number[] = [];
  for (let life = 0; life < LIVES; life++) {
    const r = simulateLife(life, opts);
    timer.push(r.timer);
    hold.push(r.hold);
  }
  return { timerMedian: median(timer), holdMedian: median(hold) };
}

describe('ECO-1: crypto regime timing (seeded)', () => {
  it('a hazard re-roll is in force', () => {
    expect(REGIME_HAZARD_WEEKLY).toBeGreaterThanOrEqual(0.15);
    expect(REGIME_HAZARD_WEEKLY).toBeLessThanOrEqual(0.25);
  });

  it('holding whichever coin shows Bull earns a median under 20%/yr', () => {
    const r = runCohort({ seeCountdown: false, hazard: true });
    // REGIME_TIMING_REPORT=<file> writes the shipped numbers beside the old
    // screen + old tick (jest swallows console output from --silent runs).
    if (process.env.REGIME_TIMING_REPORT) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('fs').writeFileSync(
        process.env.REGIME_TIMING_REPORT,
        JSON.stringify({
          shipped: r,
          shippedSeeingCountdown: runCohort({ seeCountdown: true, hazard: true }),
          oldScreenOldTick: runCohort({ seeCountdown: true, hazard: false }),
        }, null, 1)
      );
    }
    expect(r.timerMedian).toBeLessThan(0.2);
    // And it stays a modest edge, not a loss: the regime still MEANS something.
    expect(r.timerMedian).toBeGreaterThan(r.holdMedian - 0.05);
  });

  it('is deterministic', () => {
    expect(simulateLife(7, { seeCountdown: false, hazard: true })).toEqual(
      simulateLife(7, { seeCountdown: false, hazard: true })
    );
  });
});
