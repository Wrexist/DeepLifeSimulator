export interface StockData {
  price: number;
  dividendYield: number;
}

const DEFAULT_PRICES: Record<string, StockData> = {
  AAPL: { price: 150.25, dividendYield: 0.006 },
  GOOGL: { price: 2750.80, dividendYield: 0.0 },
  MSFT: { price: 310.45, dividendYield: 0.008 },
  TSLA: { price: 245.67, dividendYield: 0.0 },
  AMZN: { price: 145.82, dividendYield: 0.0 },
  META: { price: 324.15, dividendYield: 0.0 },
  NVDA: { price: 432.50, dividendYield: 0.0 },
  NFLX: { price: 485.20, dividendYield: 0.0 },
  WMT: { price: 86.30, dividendYield: 0.015 },
  JPM: { price: 142.85, dividendYield: 0.025 },
  JNJ: { price: 158.90, dividendYield: 0.028 },
  PG: { price: 152.40, dividendYield: 0.024 },
  KO: { price: 58.75, dividendYield: 0.031 },
  DIS: { price: 89.45, dividendYield: 0.0 },
  V: { price: 245.80, dividendYield: 0.008 },
  MA: { price: 412.30, dividendYield: 0.005 },
  HD: { price: 298.75, dividendYield: 0.022 },
  BA: { price: 185.60, dividendYield: 0.0 },
  CAT: { price: 298.40, dividendYield: 0.018 },
  IBM: { price: 142.30, dividendYield: 0.048 },
  // Energy sector — gives the board a real Energy tile instead of an empty
  // "0 stocks" placeholder, and lets sector rotation + quarterly dividends
  // cover all six sectors. Prices/yields consistent with blue-chip neighbors.
  XOM: { price: 112.40, dividendYield: 0.034 },
  CVX: { price: 156.80, dividendYield: 0.041 },
  SLB: { price: 44.15, dividendYield: 0.025 },
  // Healthcare — thickens a sector that was JNJ-only.
  PFE: { price: 27.60, dividendYield: 0.061 },
  UNH: { price: 512.30, dividendYield: 0.015 },
};

// Per-share ceiling. It exists to stop a corrupt multiplier compounding to
// Infinity (which `validateGameState` treats as critical and resets), NOT to
// express a view about how expensive a share may get.
//
// Raised from $1M once the walk got a real drift term. At ~10%/yr a sixty-year
// life compounds ~300×, so the old ceiling started BINDING on the high-priced
// symbols — GOOGL opens at $2 750 — and a clamped price is a broken market: it
// can still fall but never rise, so the board quietly turns into a one-way bet.
// $10M is far below overflow and far above any price a played life reaches.
export const MAX_STOCK_PRICE = 10_000_000;

/**
 * Intended long-run broad-market return, expressed the way a human states it.
 *
 * ── Why this constant has to exist ────────────────────────────────────────
 *
 * The weekly walk used to be `price *= (1 + z·σ)` with z ~ N(0,1) and no drift
 * term at all. That is zero-mean in the ARITHMETIC return and therefore
 * NEGATIVE in the geometric one: E[log(1 + zσ)] ≈ −σ²/2 per week. At the 8%
 * weekly vol carried by TSLA/NVDA/META/NFLX that is −0.32%/week, so a 60-year
 * life compounds to e^-10 — those four symbols reached the $0.01 floor. Driving
 * the real pipeline (walk + sector tilt + adjustStockPrice) for ten game years
 * left 22 of 25 symbols down with the median at 0.32×.
 *
 * And because the walk is seeded on `weeksLived`, that was not variance — it
 * was the SAME guaranteed collapse in every save on every device.
 *
 * ── Why a drift term and not a −σ²/2 correction ───────────────────────────
 *
 * Cancelling the drag exactly would make the market flat in expectation, which
 * still gives the player no reason to hold equities over cash. Stocks are meant
 * to be the patient, lower-effort wealth engine that offsets crypto's swings, so
 * they need a real risk premium. This is that premium, stated once, in the unit
 * a designer thinks in.
 *
 * 7% nominal per year is deliberately below the ~10% a long-run index posts:
 * the player also collects dividends on top (up to 6.1% on PFE), sector tilt,
 * and boom drift, and the point is a slow compounding floor rather than a
 * strategy that dominates every other system in the game.
 */
export const MARKET_ANNUAL_DRIFT = 0.07;

/**
 * The weekly LOG drift that produces `MARKET_ANNUAL_DRIFT` when compounded over
 * a year. Kept as a log-space figure because the step below is log-normal:
 * `price *= exp(μ + σz)` makes μ mean exactly "expected log return per week",
 * with no σ²/2 bookkeeping hiding in the call site, and makes a negative price
 * arithmetically impossible rather than merely clamped away.
 */
const WEEKLY_LOG_DRIFT = Math.log(1 + MARKET_ANNUAL_DRIFT) / 52;

/**
 * Extra annual drift a company gets while a policy is boosting it, in log space.
 * Small on purpose — a policy should tilt the odds, not hand out a guaranteed
 * outperformer the player can park everything in.
 */
const BOOST_ANNUAL_DRIFT_BONUS_LOG = Math.log(1 + 0.05) / 52;

/**
 * Extra weekly log drift per unit of weekly volatility — the risk premium.
 *
 * With a flat drift for every symbol, TSLA (8% weekly vol) and KO (4%) have the
 * same expected return and TSLA is simply worse: same reward, four times the
 * variance. Nobody should ever buy it, and a player who does is being punished
 * for engaging with the most interesting part of the board.
 *
 * Tying a slice of the drift to volatility restores the trade the UI implies:
 * the volatile names pay more in expectation, and can still ruin you.
 *
 * λ = 0.01 puts a 4%-vol blue chip at ~9%/yr all-in and an 8%-vol growth name at
 * ~11.5%/yr, which lands the board on a real index's long-run return rather than
 * above it. The first pass used 0.02 and compounded to ~8 000× over a sixty-year
 * life — a number that says more about unchecked exponentials than about a stock
 * market. Its dispersion still swamps the extra drift over any horizon a player
 * actually holds, so the high-vol tier is a genuine gamble, not a free lunch.
 */
const VOLATILITY_RISK_PREMIUM = 0.01;

/**
 * The full weekly log drift for one symbol. Exported so the intended
 * relationship — more volatility earns more expected return — can be asserted
 * directly instead of inferred from a noisy 25-symbol sample, where dispersion
 * drowns the signal at every horizon short of the price ceiling.
 */
export function weeklyLogDriftFor(volatility: number, isBoosted = false): number {
  const vol = Number.isFinite(volatility) && volatility > 0 ? volatility : 0;
  return (
    WEEKLY_LOG_DRIFT +
    VOLATILITY_RISK_PREMIUM * vol +
    (isBoosted ? BOOST_ANNUAL_DRIFT_BONUS_LOG : 0)
  );
}

/**
 * Ceiling on a single week's realized return, as a multiplier.
 *
 * The old additive form self-limited (a −5σ draw floored at a −40% week); the
 * exponential form does not, so a fat tail could otherwise 2.5× a stock in one
 * tick. ±35% covers a genuine crash week and keeps the tails from minting money.
 */
const MAX_WEEKLY_MOVE = 0.35;

// Mutable stock state — initialized from defaults, restored from save via restoreStockPrices()
const stocks: Record<string, StockData> = {};
Object.entries(DEFAULT_PRICES).forEach(([symbol, data]) => {
  stocks[symbol] = { ...data };
});

// --- Seeded PRNG (Mulberry32) to prevent save/reload stock price manipulation ---
// Same weeksLived + symbol always produces the same price change
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash for combining weeksLived + stock index into a unique seed
function hashSeed(weeksLived: number, index: number): number {
  let hash = 2166136261;
  const combined = `${weeksLived}:${index}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Pre-calculate volatility map to avoid recalculation every tick
const volatilityMap: Record<string, number> = {};

Object.keys(stocks).forEach(symbol => {
  // High volatility stocks (tech, growth stocks)
  if (['TSLA', 'NVDA', 'META', 'NFLX'].includes(symbol)) {
    volatilityMap[symbol] = 0.08; // 8% volatility
  }
  // Medium volatility stocks
  else if (['AAPL', 'GOOGL', 'MSFT', 'AMZN'].includes(symbol)) {
    volatilityMap[symbol] = 0.06; // 6% volatility
  }
  // Higher-beta energy services / healthcare insurer
  else if (['SLB', 'UNH'].includes(symbol)) {
    volatilityMap[symbol] = 0.06; // 6% volatility
  }
  // Low volatility stocks (blue chips, dividend stocks, energy majors)
  else if (['JPM', 'JNJ', 'PG', 'KO', 'WMT', 'V', 'MA', 'HD', 'CAT', 'IBM', 'XOM', 'CVX', 'PFE'].includes(symbol)) {
    volatilityMap[symbol] = 0.04; // 4% volatility
  }
  else {
    volatilityMap[symbol] = 0.05; // Default 5% volatility
  }
});

/**
 * Sync the module's live board to a save's persisted market.
 *
 * The board is module-level mutable state that OUTLIVES a save — it is created
 * once per app launch and every slot, life and generation shares it. So this is
 * not "restore if present", it is "make the board equal this save's market".
 *
 * A save with no persisted prices is a life that has not traded yet, and it must
 * open on the catalogue, not on whatever the previous session left behind. The
 * early-return that used to sit here meant starting a new game right after
 * playing an old one inherited that old market — and since `nextWeek` snapshots
 * the board into the new save on its first tick, the inheritance became
 * permanent. With the drift fix that is worse, not better: an heir would open on
 * a market that had compounded for sixty years while holding a starter wallet.
 */
export function restoreStockPrices(savedPrices?: Record<string, { price: number; dividendYield?: number }> | null) {
  if (!savedPrices || typeof savedPrices !== 'object') {
    resetStockPrices();
    return;
  }
  Object.entries(savedPrices).forEach(([symbol, data]) => {
    // ANTI-EXPLOIT (B-6): Normalize to uppercase to match stock key format
    const normalizedSymbol = symbol?.toUpperCase() ?? '';
    if (stocks[normalizedSymbol] && typeof data?.price === 'number' && isFinite(data.price) && data.price > 0) {
      stocks[normalizedSymbol].price = data.price;
      // R3-M1: a persisted yield ABOVE the catalogue default is the fingerprint
      // of the ratchet bug — nothing in the game raises a yield any more, so a
      // saved value can only equal the default or be inflated by it. Clamping
      // here heals affected saves on load without a STATE_VERSION bump, since
      // no schema changes: the field simply returns to the only value it should
      // ever have held. Below-default values are still honoured, so a future
      // yield-cut mechanic would not be silently reverted.
      const catalogueYield = DEFAULT_PRICES[normalizedSymbol]?.dividendYield;
      if (typeof data.dividendYield === 'number' && isFinite(data.dividendYield) && data.dividendYield >= 0) {
        stocks[normalizedSymbol].dividendYield =
          typeof catalogueYield === 'number'
            ? Math.min(data.dividendYield, catalogueYield)
            : data.dividendYield;
      }
    }
  });
}

/**
 * A stock's dividend yield with the standing policy bonus applied.
 *
 * Read-time, so it reflects the policies CURRENTLY in force and can never
 * accumulate — see the note in `simulateWeek`, where this used to be a
 * once-per-week mutation of persistent state. Capped at the same 10% the old
 * code capped at, so the ceiling the design intended is unchanged.
 */
export const MAX_POLICY_DIVIDEND_YIELD = 0.1;

export function policyAdjustedYield(baseYield: number, dividendBonus: number): number {
  const base = Number.isFinite(baseYield) ? Math.max(0, baseYield) : 0;
  if (base <= 0) return 0;
  const bonus = Number.isFinite(dividendBonus) ? Math.max(0, dividendBonus) : 0;
  return Math.min(MAX_POLICY_DIVIDEND_YIELD, base + bonus);
}

/**
 * Get a snapshot of current prices for persistence in game state.
 */
export function getStockPricesSnapshot(): Record<string, { price: number; dividendYield: number }> {
  const snapshot: Record<string, { price: number; dividendYield: number }> = {};
  Object.entries(stocks).forEach(([symbol, data]) => {
    snapshot[symbol] = { price: data.price, dividendYield: data.dividendYield };
  });
  return snapshot;
}

/**
 * Reset stock prices to defaults (used on prestige/new game).
 */
export function resetStockPrices() {
  Object.entries(DEFAULT_PRICES).forEach(([symbol, data]) => {
    stocks[symbol] = { ...data };
  });
}

/**
 * Simulate one week of stock market price changes.
 * ANTI-EXPLOIT: Uses seeded PRNG based on weeksLived so that the same week
 * always produces the same price changes regardless of save/reload.
 */
export function simulateWeek(policyEffects?: {
  volatilityModifier?: number;
  dividendBonus?: number;
  companyBoost?: string[];
}, weeksLived?: number) {
  const symbols = Object.keys(stocks);
  const len = symbols.length;

  // Apply policy effects
  const volatilityModifier = policyEffects?.volatilityModifier ?? 1;
  // `policyEffects.dividendBonus` is deliberately NOT read here — see the R3-M1
  // note at the end of the loop. It stays on the parameter type because callers
  // pass the whole aggregated effects object, but it is applied at read time in
  // the week loop (`policyAdjustedYield`) so it cannot compound into the
  // persisted per-stock yield.
  const companyBoost = policyEffects?.companyBoost ?? [];

  // Use weeksLived for deterministic seeding; fall back to Math.random() only if not provided
  const useSeededRng = typeof weeksLived === 'number' && isFinite(weeksLived) && weeksLived >= 0;

  for (let i = 0; i < len; i++) {
    const symbol = symbols[i];
    const stock = stocks[symbol];
    let volatility = volatilityMap[symbol];

    // Apply volatility modifier from policies
    volatility *= volatilityModifier;

    // Company boost from an enacted policy: a genuine edge on the DRIFT.
    //
    // This used to be `changePercent *= 1.02` — scaling a zero-mean shock by
    // 1.02, which leaves it zero-mean. The "2% positive bias" the comment
    // promised was 2% of nothing. Adding it to the drift instead is what the
    // wording always meant, and it does not also amplify the downside.
    const isBoosted = companyBoost.includes(symbol);

    // Generate random price change with normal distribution approximation
    // Box-Muller transform (clamp u1 away from 0 to prevent Math.log(0) = -Infinity)
    let u1: number, u2: number;
    if (useSeededRng) {
      // Seeded PRNG: same weeksLived + stock index = same price change every time
      const rng = mulberry32(hashSeed(weeksLived, i));
      u1 = Math.max(Number.EPSILON, rng());
      u2 = rng();
    } else {
      u1 = Math.max(Number.EPSILON, Math.random());
      u2 = Math.random();
    }
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Guard against NaN/Infinity from edge-case random values
    if (!isFinite(z)) continue;

    // Log-normal step: `exp(μ + σz)`, NOT the old `1 + σz`.
    //
    // μ is the intended weekly log drift (see MARKET_ANNUAL_DRIFT). Without it
    // the walk was zero-mean arithmetically and −σ²/2 geometrically, which is
    // why every market in the game trended to the $0.01 floor.
    //
    // The company boost stays a multiplicative nudge on the drift rather than on
    // the whole return, so a boosted stock gets a persistent edge instead of an
    // amplified shock — a policy that "supports" a company should not also make
    // it swing harder on the way down.
    const logReturn = weeklyLogDriftFor(volatility, isBoosted) + z * volatility;

    // Guard against extreme changes that could corrupt prices
    if (!isFinite(logReturn)) continue;

    // Bound the realized weekly move. The additive form self-limited; the
    // exponential one does not, so clamp the multiplier explicitly.
    const changePercent = Math.max(
      -MAX_WEEKLY_MOVE,
      Math.min(MAX_WEEKLY_MOVE, Math.expm1(logReturn)),
    );

    // CRASH FIX (B-2): Apply the change with floor AND ceiling to prevent overflow
    // ($1M per-share max — module-level MAX_STOCK_PRICE, shared with adjustStockPrice).
    let newPrice = stock.price * (1 + changePercent);
    // Guard against NaN/Infinity from edge-case calculations
    if (!isFinite(newPrice) || isNaN(newPrice)) {
      newPrice = stock.price; // Keep previous price if calculation corrupted
    }
    stock.price = Math.max(0.01, Math.min(MAX_STOCK_PRICE, newPrice));

    // R3-M1: the policy dividend bonus is NOT applied here any more.
    //
    // `dividendBonus` is a STANDING modifier — the aggregate of the enacted
    // policies, recomputed from scratch by `calculateActivePolicyEffects` every
    // time a policy changes. This line added it to the persistent per-stock
    // yield once per game week, so it compounded: IBM's 4.8% reached the 10%
    // cap in about a year of game time under a single $30k Mayor-level policy,
    // and every dividend payer eventually sat at a permanent 10% — roughly 3x
    // the highest real yield on the board. `getStockPricesSnapshot` persists
    // `dividendYield`, so it survived save/reload, and nothing ever subtracted
    // it, so repealing the policy did not undo it either. The card advertises
    // "+0.5% bonus to dividend yields"; it delivered +0.5 points per week,
    // cumulatively and permanently.
    //
    // The bonus is now applied where the yield is READ for payout, in the week
    // loop, via `policyAdjustedYield`. That makes it a modifier again: it
    // tracks the policies currently in force and cannot accumulate.

    // Round to 2 decimal places for realistic pricing
    stock.price = Math.round(stock.price * 100) / 100;
  }
}

export function getStockInfo(id: string): StockData {
  // ANTI-EXPLOIT (B-6): Normalize to uppercase — stock keys are uppercase (AAPL, GOOGL, etc.)
  // Prevents silent zero-dividend from case mismatch (e.g., 'aapl' vs 'AAPL')
  const normalizedId = id?.toUpperCase() ?? '';
  return stocks[normalizedId] || { price: 0, dividendYield: 0 };
}

export function adjustStockPrice(id: string, factor: number) {
  // ANTI-EXPLOIT (B-6): Normalize to uppercase to match stock key format
  const normalizedId = id?.toUpperCase() ?? '';
  const stock = stocks[normalizedId];
  if (stock) {
    // Guard non-finite factors (a bad tilt/drift ratio must never poison price),
    // then clamp to the same [0.01, $1M] band as the weekly walk so persisting
    // the sector tilt + macro drift can't breach the ceiling as it compounds.
    if (!isFinite(factor) || factor <= 0) return;
    const next = stock.price * factor;
    if (!isFinite(next)) return;
    stock.price = Math.max(0.01, Math.min(MAX_STOCK_PRICE, next));
  }
}

export function getAllStockSymbols(): string[] {
  return Object.keys(stocks);
}

export function getAllStocks(): Record<string, StockData> {
  // Return a copy to prevent direct mutation outside this module
  // Deep copy not needed as StockData is simple object, but shallow copy of Record is needed
  return { ...stocks };
}
