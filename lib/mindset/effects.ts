/**
 * What a Mindset does - the ONE table, the ONE resolver, and the copy generated
 * from them.
 *
 * ── The design ────────────────────────────────────────────────────────────
 *
 * A Mindset is picked once per life (onboarding, inherited by an heir) and
 * shapes that life in the system its name promises: a Workaholic is paid more
 * and wears down faster, a Socialite bonds faster and spends more doing it, an
 * Investor earns more from assets and pays more to buy them. Every Mindset has
 * exactly ONE upside and ONE downside, each modest (5-25%), so the choice is a
 * playstyle rather than a power pick.
 *
 * Three rules keep it honest:
 *
 *   1. Every number lives in `MINDSET_EFFECTS` below and nowhere else.
 *   2. Every system reads it through `mindsetEffects(state)` (or, for street
 *      work, `MINDSET_STREET_EFFECTS`), at the one function that system already
 *      uses for both the payout and the screen that shows it.
 *   3. The text every screen shows (`describeMindsetEffects`) is GENERATED from
 *      the table, so the card can never promise a number the game does not
 *      apply. Before this, eleven hand-written descriptions promised savings,
 *      travel, stocks and relationships while the only reader was one street-job
 *      toast.
 *
 * Pure: no state writes, no randomness, no new save fields - a Mindset is the
 * `mindset.traits` id the save already carries.
 */
import type { GameState } from '@/contexts/game/types';
import type { MindsetId } from './config';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

// ── Street work ─────────────────────────────────────────────────────────────

/** One Mindset's effect on a street job. Absent keys are neutral. */
export interface MindsetStreetEffect {
  /** Pay multiplier on every street job. */
  pay?: number;
  /** Pay multiplier on LEGAL street jobs only. */
  legalPay?: number;
  /** Pay multiplier on ILLEGAL street jobs only. */
  illegalPay?: number;
  /** Success chance, in percentage points (before the 95% cap). */
  success?: number;
  /** Arrest chance on illegal jobs, in percentage points (before the 80% cap). */
  arrestPoints?: number;
  /** Arrest chance multiplier on illegal jobs (applied after the cap). */
  arrestMultiplier?: number;
  /** Halve every street job's happiness cost, rounded in the player's favour. */
  halveHappinessCost?: boolean;
  /**
   * Added to every street job's happiness COST (a cost is negative): -1 makes
   * a job cost 1 more happiness, +2 makes it cost 2 less. A cost can never
   * turn into a gain.
   */
  happiness?: number;
  /** Same as `happiness`, LEGAL street jobs only. */
  legalHappiness?: number;
  /** Added to every street job's health cost: -1 = costs 1 more health. */
  health?: number;
  /** Successful runs needed to rank a street job up (the default is 3). */
  runsPerRank?: number;
}

/** The default number of successful runs per street-job rank. */
export const DEFAULT_RUNS_PER_RANK = 3;

// ── The rest of a life ──────────────────────────────────────────────────────

/**
 * Bond a contact loses when a want of theirs goes ignored for a whole cycle
 * (`rotateWantIfDue`, lib/social/npcDepth.ts) - the base the `neglectBondLoss`
 * multiplier scales.
 */
export const NEGLECT_BOND_LOSS = 2;

/** One Mindset's effect outside street work. Absent keys are neutral (1). */
export interface MindsetLifeEffect {
  /** Career weekly pay (`careerPayMultiplier`). */
  careerPay?: number;
  /** Weekly promotion progress (`applyCareerProgress`). */
  careerProgress?: number;
  /** Natural HEALTH decay each week (tick + Home's vitals projection). */
  healthDecay?: number;
  /** Natural HAPPINESS decay each week (tick + Home's vitals projection). */
  happinessDecay?: number;
  /** The week's net happiness GAIN, before the diminishing curve. */
  happinessGain?: number;
  /** Bond gained from calls, hangouts and dates. */
  bondGain?: number;
  /** Price of hangouts, dates and gifts. */
  socialCost?: number;
  /** Bond lost when a contact's want goes ignored for a whole cycle (base 2). */
  neglectBondLoss?: number;
  /** Trip prices (`quoteTrip`). */
  travelCost?: number;
  /** The happiness a trip itself gives (not its random events). */
  travelHappiness?: number;
  /**
   * RESTLESS: once this many weeks pass without a trip, happiness decay is
   * multiplied by `restlessHappinessDecay`. Resolved in `mindsetEffects`.
   */
  restlessAfterWeeks?: number;
  restlessHappinessDecay?: number;
  /** Market item and food prices. */
  marketPrice?: number;
  /** Weekly happiness from owned luxury items. */
  luxuryHappiness?: number;
  /** Stock dividends. */
  dividends?: number;
  /** Rent paid by tenants. */
  rent?: number;
  /** Property purchase price (`quotePropertyPurchase`). */
  propertyPrice?: number;
}

export interface MindsetEffectRow {
  life: MindsetLifeEffect;
  street: MindsetStreetEffect;
}

/**
 * THE table. One upside, one downside each. The generated copy
 * (`describeMindsetEffects`) quotes every number in it.
 */
export const MINDSET_EFFECTS: Readonly<Record<MindsetId, MindsetEffectRow>> = {
  frugal: { life: { marketPrice: 0.9, luxuryHappiness: 0.75 }, street: {} },
  workaholic: { life: { careerPay: 1.1, healthDecay: 1.2 }, street: {} },
  socialite: { life: { bondGain: 1.25, socialCost: 1.25 }, street: {} },
  optimist: { life: { happinessGain: 1.15 }, street: { success: -5 } },
  perfectionist: { life: { careerProgress: 1.15, happinessDecay: 1.2 }, street: {} },
  adventurous: {
    life: { travelCost: 0.85, travelHappiness: 1.25, restlessAfterWeeks: 26, restlessHappinessDecay: 1.25 },
    street: {},
  },
  gambler: { life: {}, street: { illegalPay: 1.25, arrestPoints: 5 } },
  riskAverse: { life: {}, street: { arrestMultiplier: 0.75, pay: 0.95 } },
  investor: { life: { dividends: 1.15, rent: 1.15, propertyPrice: 1.05 }, street: {} },
  spender: { life: { luxuryHappiness: 1.25, marketPrice: 1.1 }, street: {} },
  hustler: { life: { neglectBondLoss: 1.5 }, street: { pay: 1.15 } },
};

/** The street half of the table, by id - read by `mindsetStreetTerms`. */
export const MINDSET_STREET_EFFECTS: Readonly<Record<MindsetId, MindsetStreetEffect>> = Object.fromEntries(
  (Object.keys(MINDSET_EFFECTS) as MindsetId[]).map((id) => [id, MINDSET_EFFECTS[id].street]),
) as Record<MindsetId, MindsetStreetEffect>;

const KNOWN_MINDSETS = new Set<string>(Object.keys(MINDSET_EFFECTS));

export function isMindsetId(id: unknown): id is MindsetId {
  return typeof id === 'string' && KNOWN_MINDSETS.has(id);
}

/**
 * The Mindset ids active on this save.
 *
 * `mindset.traits` is the list both writers set (onboarding and heir
 * selection write `{ activeTraitId, traits: [activeTraitId] }`). A save whose
 * list is missing or empty falls back to `activeTraitId`, which is the id the
 * Home card DISPLAYS - so a Mindset the player can see is a Mindset that
 * applies. Unknown ids are dropped.
 */
export function activeMindsetIds(state: Pick<GameState, 'mindset'> | null | undefined): MindsetId[] {
  const mindset = state?.mindset;
  const listed: unknown[] = Array.isArray(mindset?.traits) ? (mindset?.traits as unknown[]) : [];
  const source = listed.length > 0 ? listed : [mindset?.activeTraitId];
  return [...new Set(source.filter(isMindsetId))];
}

// ── The resolver ────────────────────────────────────────────────────────────

/** Every life multiplier, resolved for one state. All neutral at 1. */
export interface ResolvedMindsetEffects {
  careerPay: number;
  careerProgress: number;
  healthDecay: number;
  happinessDecay: number;
  happinessGain: number;
  bondGain: number;
  socialCost: number;
  neglectBondLoss: number;
  travelCost: number;
  travelHappiness: number;
  marketPrice: number;
  luxuryHappiness: number;
  dividends: number;
  rent: number;
  propertyPrice: number;
  /** True when an Adventurous life has gone too long without a trip. */
  restless: boolean;
}

export const NEUTRAL_MINDSET_EFFECTS: Readonly<ResolvedMindsetEffects> = Object.freeze({
  careerPay: 1,
  careerProgress: 1,
  healthDecay: 1,
  happinessDecay: 1,
  happinessGain: 1,
  bondGain: 1,
  socialCost: 1,
  neglectBondLoss: 1,
  travelCost: 1,
  travelHappiness: 1,
  marketPrice: 1,
  luxuryHappiness: 1,
  dividends: 1,
  rent: 1,
  propertyPrice: 1,
  restless: false,
});

/** No stack - however corrupt the save - can move a system outside this band. */
export const MINDSET_MULTIPLIER_MIN = 0.5;
export const MINDSET_MULTIPLIER_MAX = 1.6;

const finite = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

const clampMult = (n: number): number =>
  Math.min(MINDSET_MULTIPLIER_MAX, Math.max(MINDSET_MULTIPLIER_MIN, finite(n, 1)));

/**
 * Weeks since the player last LEFT on a trip, or since this life began when
 * they never have. 0 while they are away.
 */
export function weeksWithoutTrip(state: Pick<GameState, 'travel' | 'weeksLived' | 'lifeStartWeek'>): number {
  const now = finite(state.weeksLived, 0);
  if (state.travel?.currentTrip) return 0;
  const history = Array.isArray(state.travel?.travelHistory) ? state.travel!.travelHistory : [];
  const thisLife = weeksSinceLifeStart(now, state.lifeStartWeek);
  const last = history.length > 0 ? finite(history[history.length - 1]?.week, NaN) : NaN;
  // Capped at this life's length: an heir can carry a parent's trip history,
  // and a trip taken before this life began is not one this life took.
  if (Number.isFinite(last)) return Math.max(0, Math.min(now - last, thisLife));
  return thisLife;
}

type MindsetState = Pick<GameState, 'mindset' | 'travel' | 'weeksLived' | 'lifeStartWeek'>;

/**
 * Every life multiplier for this state, folded across the active Mindset(s)
 * (one is the norm; a corrupt save could list several) and clamped.
 *
 * The one place a condition is resolved: an Adventurous life is RESTLESS once
 * `restlessAfterWeeks` pass without a trip, which multiplies happiness decay.
 */
export function mindsetEffects(state: MindsetState | null | undefined): ResolvedMindsetEffects {
  if (!state) return { ...NEUTRAL_MINDSET_EFFECTS };
  const ids = activeMindsetIds(state);
  if (ids.length === 0) return { ...NEUTRAL_MINDSET_EFFECTS };

  const out: ResolvedMindsetEffects = { ...NEUTRAL_MINDSET_EFFECTS };
  const keys: (keyof Omit<ResolvedMindsetEffects, 'restless'>)[] = [
    'careerPay', 'careerProgress', 'healthDecay', 'happinessDecay', 'happinessGain', 'bondGain',
    'socialCost', 'neglectBondLoss', 'travelCost', 'travelHappiness', 'marketPrice', 'luxuryHappiness',
    'dividends', 'rent', 'propertyPrice',
  ];
  for (const id of ids) {
    const life = MINDSET_EFFECTS[id]?.life;
    if (!life) continue;
    for (const key of keys) out[key] *= finite(life[key], 1);
    const after = finite(life.restlessAfterWeeks, NaN);
    if (Number.isFinite(after) && weeksWithoutTrip(state) >= after) {
      out.restless = true;
      out.happinessDecay *= finite(life.restlessHappinessDecay, 1);
    }
  }
  for (const key of keys) out[key] = clampMult(out[key]);
  return out;
}

/**
 * Bond a contact loses when one of their wants goes ignored for a whole cycle,
 * for this life - `NEGLECT_BOND_LOSS` (2) scaled by the Mindset (a Hustler's 3).
 */
export function neglectBondLossFor(mult: number | undefined): number {
  return Math.max(0, Math.round(NEGLECT_BOND_LOSS * clampMult(finite(mult, 1))));
}

/** Apply a Mindset price multiplier to a dollar amount, rounded to the dollar. */
export function mindsetPrice(base: number, mult: number): number {
  const b = finite(base, 0);
  if (b <= 0) return Math.max(0, b);
  return Math.max(0, Math.round(b * clampMult(mult)));
}

// ── The copy ────────────────────────────────────────────────────────────────

const pct = (mult: number): number => Math.round(Math.abs(mult - 1) * 100);
const moreLess = (up: boolean, more: string, less: string): string => (up ? more : less);

/** One generated line, and whether it helps the player. */
export interface MindsetEffectLine {
  text: string;
  upside: boolean;
}

/**
 * The lines a Mindset card shows, generated from the table - every number the
 * game applies, and nothing it does not. Upsides first, then downsides; a line
 * is placed by whether it HELPS the player (cheaper prices help, faster decay
 * hurts), not by which system it touches.
 */
export function mindsetEffectLines(id: MindsetId): MindsetEffectLine[] {
  const row = MINDSET_EFFECTS[id];
  if (!row) return [];
  const L = row.life;
  const S = row.street;
  const out: MindsetEffectLine[] = [];
  /**
   * `goodWhenHigher` says which direction helps: pay up helps, decay up hurts.
   * `text` gets whether the value is above neutral.
   */
  const mult = (m: number | undefined, goodWhenHigher: boolean, text: (up: boolean, p: number) => string) => {
    if (typeof m !== 'number' || m === 1) return;
    const up = m > 1;
    out.push({ text: text(up, pct(m)), upside: up === goodWhenHigher });
  };

  mult(L.careerPay, true, (up, p) => `Career pay ${up ? '+' : '-'}${p}%`);
  mult(L.careerProgress, true, (up, p) => `Promotions come ${p}% ${moreLess(up, 'faster', 'slower')}`);
  mult(L.bondGain, true, (up, p) => `Calls, hangouts and dates build ${p}% ${moreLess(up, 'more', 'less')} bond`);
  mult(L.happinessGain, true, (up, p) => `Happiness gains are ${p}% ${moreLess(up, 'bigger', 'smaller')}`);
  mult(L.travelCost, false, (up, p) => `Trips cost ${p}% ${moreLess(up, 'more', 'less')}`);
  mult(L.travelHappiness, true, (up, p) => `Trips give ${p}% ${moreLess(up, 'more', 'less')} happiness`);
  mult(L.marketPrice, false, (up, p) => `Market items and food cost ${p}% ${moreLess(up, 'more', 'less')}`);
  mult(L.luxuryHappiness, true, (up, p) => `Luxury items give ${p}% ${moreLess(up, 'more', 'less')} happiness`);
  mult(L.dividends, true, (up, p) => `Stock dividends ${up ? '+' : '-'}${p}%`);
  mult(L.rent, true, (up, p) => `Rent from tenants ${up ? '+' : '-'}${p}%`);
  mult(L.propertyPrice, false, (up, p) => `Property costs ${p}% ${moreLess(up, 'more', 'less')} to buy`);
  mult(L.healthDecay, false, (up, p) => `Health wears down ${p}% ${moreLess(up, 'faster', 'slower')}`);
  mult(L.happinessDecay, false, (up, p) => `Happiness wears down ${p}% ${moreLess(up, 'faster', 'slower')}`);
  mult(L.socialCost, false, (up, p) => `Hangouts, dates and gifts cost ${p}% ${moreLess(up, 'more', 'less')}`);
  if (typeof L.neglectBondLoss === 'number' && L.neglectBondLoss !== 1) {
    const loss = Math.round(NEGLECT_BOND_LOSS * L.neglectBondLoss);
    out.push({
      text: `A contact whose wish you ignore loses ${loss} bond instead of ${NEGLECT_BOND_LOSS}`,
      upside: loss < NEGLECT_BOND_LOSS,
    });
  }
  if (typeof L.restlessAfterWeeks === 'number' && typeof L.restlessHappinessDecay === 'number' && L.restlessHappinessDecay !== 1) {
    out.push({
      text: `Restless: after ${L.restlessAfterWeeks} weeks without a trip, happiness wears down ${pct(L.restlessHappinessDecay)}% faster`,
      upside: false,
    });
  }

  mult(S.pay, true, (up, p) => `Street jobs pay ${p}% ${moreLess(up, 'more', 'less')}`);
  mult(S.legalPay, true, (up, p) => `Legal street jobs pay ${p}% ${moreLess(up, 'more', 'less')}`);
  mult(S.illegalPay, true, (up, p) => `Illegal street jobs pay ${p}% ${moreLess(up, 'more', 'less')}`);
  mult(S.arrestMultiplier, false, (up, p) => `${p}% ${moreLess(up, 'more', 'less')} arrest risk on illegal jobs`);
  if (typeof S.success === 'number' && S.success !== 0) {
    out.push({ text: `Street jobs succeed ${Math.abs(S.success)}% ${S.success > 0 ? 'more' : 'less'} often`, upside: S.success > 0 });
  }
  if (typeof S.arrestPoints === 'number' && S.arrestPoints !== 0) {
    out.push({ text: `${S.arrestPoints > 0 ? '+' : '-'}${Math.abs(S.arrestPoints)}% arrest risk on illegal jobs`, upside: S.arrestPoints < 0 });
  }
  if (typeof S.health === 'number' && S.health !== 0) {
    out.push({ text: `Street jobs cost ${Math.abs(S.health)} ${S.health < 0 ? 'more' : 'less'} health`, upside: S.health > 0 });
  }
  if (typeof S.happiness === 'number' && S.happiness !== 0) {
    out.push({ text: `Street jobs cost ${Math.abs(S.happiness)} ${S.happiness < 0 ? 'more' : 'less'} happiness`, upside: S.happiness > 0 });
  }
  if (typeof S.runsPerRank === 'number' && S.runsPerRank !== DEFAULT_RUNS_PER_RANK) {
    out.push({
      text: `Street jobs rank up after ${S.runsPerRank} runs instead of ${DEFAULT_RUNS_PER_RANK}`,
      upside: S.runsPerRank < DEFAULT_RUNS_PER_RANK,
    });
  }

  return [...out.filter((l) => l.upside), ...out.filter((l) => !l.upside)];
}

/** The effect lines' text only, upsides first. */
export function describeMindsetEffects(id: MindsetId): string[] {
  return mindsetEffectLines(id).map((l) => l.text);
}

/** The effect lines as one sentence, for places that show a single string. */
export function mindsetEffectSentence(id: MindsetId): string {
  return describeMindsetEffects(id).map((l) => `${l}.`).join(' ');
}
