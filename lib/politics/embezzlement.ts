/**
 * Taking the money.
 *
 * The player asked to "steal stake money", and the game had exactly one corrupt
 * lever: `raisePACDirty`, which launders crypto INTO the campaign. Nothing ever
 * took money OUT. Campaign funds and the PAC were a number that only ever grew
 * and could only ever be spent on politics — so the most obvious thing a
 * corrupt politician does was the one thing the political system could not
 * represent.
 *
 * The design rule here is that this must be a DECISION, not a faucet:
 *
 *   - it is bounded per week, as a fraction of the pot rather than a flat cap,
 *     so it scales with the empire but never outruns it;
 *   - it builds HEAT, which feeds the scandal roll that already exists — so the
 *     consequence is the machinery the game already has (approval drain, forced
 *     resignation), not a new punishment system;
 *   - heat decays only slowly, so a player who keeps dipping keeps the risk.
 *
 * Pure functions. No game state, no React.
 */

const safe = (n: number | undefined | null, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Most of the pot that can be taken in a single game week. */
export const MAX_WEEKLY_SKIM_FRACTION = 0.25;

/** Below this there is nothing worth the risk. */
export const MIN_SKIM_USD = 500;

/** Heat added per full weekly allowance taken. */
export const HEAT_PER_FULL_SKIM = 18;

/** Heat shed per week when the player keeps their hands out of the pot. */
export const HEAT_DECAY_PER_WEEK = 2;

export interface EmbezzlementState {
  /** Lifetime dollars diverted to personal cash. */
  totalUSD: number;
  /** 0..100 exposure pressure. Feeds `scandalProbability`. */
  heat: number;
  /** `weeksLived` of the most recent diversion — the one-per-week gate. */
  lastWeek: number;
}

export const EMPTY_EMBEZZLEMENT: EmbezzlementState = { totalUSD: 0, heat: 0, lastWeek: -1 };

/**
 * Read the slice off a save, degrading anything malformed to the empty answer.
 *
 * Never throws: this is read inside the weekly tick, where a throw costs the
 * whole week (§4.3).
 */
export function readEmbezzlement(stored: unknown): EmbezzlementState {
  if (!stored || typeof stored !== 'object') return EMPTY_EMBEZZLEMENT;
  const raw = stored as Partial<EmbezzlementState>;
  return {
    totalUSD: Math.max(0, safe(raw.totalUSD, 0)),
    heat: clamp(safe(raw.heat, 0), 0, 100),
    lastWeek: safe(raw.lastWeek, -1),
  };
}

/**
 * The pot that can be skimmed: campaign funds plus the clean PAC balance.
 *
 * Deliberately NOT the dirty PAC balance. That money is already laundered
 * crypto the player put in themselves, and letting it round-trip back out to
 * cash would turn the PAC into a money-laundering no-op with a heat cost
 * attached — the dirty-money mechanic charges for going IN.
 */
export function skimmablePot(input: {
  campaignFunds?: number | null;
  pacCleanUSD?: number | null;
}): number {
  const campaign = Math.max(0, safe(input.campaignFunds, 0));
  const clean = Math.max(0, safe(input.pacCleanUSD, 0));
  const pot = campaign + clean;
  return isFinite(pot) && pot > 0 ? Math.floor(pot) : 0;
}

/** Most that can be taken this week, given the pot. */
export function maxWeeklySkim(pot: number | undefined | null): number {
  const p = Math.max(0, Math.floor(safe(pot, 0)));
  const allowance = Math.floor(p * MAX_WEEKLY_SKIM_FRACTION);
  return allowance >= MIN_SKIM_USD ? allowance : 0;
}

/** Has the player already dipped into the pot this game week? */
export function skimmedThisWeek(state: EmbezzlementState, weeksLived: number | undefined | null): boolean {
  const now = safe(weeksLived, 0);
  return safe(state.lastWeek, -1) >= now;
}

export interface SkimRefusal {
  ok: false;
  reason: string;
}

export interface SkimPlan {
  ok: true;
  /** Dollars leaving the pot and landing in personal cash. */
  amount: number;
  /** Taken from `campaignFunds` first. */
  fromCampaign: number;
  /** The remainder, taken from the clean PAC balance. */
  fromPAC: number;
  /** The embezzlement slice after the diversion. */
  next: EmbezzlementState;
}

/**
 * Plan a diversion, or say why it cannot happen.
 *
 * Returns a PLAN rather than mutating, so the caller can apply the cash and the
 * bookkeeping inside a single `setGameState` updater — a gate here and a grant
 * there is the repeated bug class this repo keeps finding (§4.4).
 *
 * Gated on `weeksLived`, never the device clock: a wall-clock gate on a lever
 * that pays real money is farmable by scrubbing the date, which this codebase
 * has now fixed five separate times (v28/v31/v35/v40/v44).
 */
export function planSkim(input: {
  state: EmbezzlementState;
  campaignFunds?: number | null;
  pacCleanUSD?: number | null;
  requested: number;
  weeksLived: number;
  /** Office rank, 1-based. Higher office draws more scrutiny per dollar. */
  careerLevel?: number | null;
}): SkimPlan | SkimRefusal {
  const now = safe(input.weeksLived, 0);
  if (skimmedThisWeek(input.state, now)) {
    return { ok: false, reason: 'You have already moved money this week. Wait for the next one.' };
  }

  const pot = skimmablePot(input);
  const allowance = maxWeeklySkim(pot);
  if (allowance <= 0) {
    return { ok: false, reason: `There is not enough in the war chest to be worth the risk (minimum $${MIN_SKIM_USD.toLocaleString()}).` };
  }

  const requested = Math.floor(safe(input.requested, 0));
  if (requested < MIN_SKIM_USD) {
    return { ok: false, reason: `The smallest transfer worth hiding is $${MIN_SKIM_USD.toLocaleString()}.` };
  }
  if (requested > allowance) {
    return { ok: false, reason: `Moving more than $${allowance.toLocaleString()} in one week would not survive an audit.` };
  }

  const campaignAvailable = Math.max(0, Math.floor(safe(input.campaignFunds, 0)));
  const fromCampaign = Math.min(requested, campaignAvailable);
  const fromPAC = requested - fromCampaign;

  // Heat scales with how much of the ALLOWANCE was taken, not the raw dollars -
  // a small operator emptying their pot is as exposed as a big one skimming the
  // same fraction. Office rank adds scrutiny on top.
  const office = clamp(Math.floor(safe(input.careerLevel, 0)), 0, 6);
  const intensity = allowance > 0 ? requested / allowance : 0;
  const heatGain = HEAT_PER_FULL_SKIM * intensity * (1 + office * 0.1);

  return {
    ok: true,
    amount: requested,
    fromCampaign,
    fromPAC,
    next: {
      totalUSD: Math.round(input.state.totalUSD + requested),
      heat: clamp(Math.round(input.state.heat + heatGain), 0, 100),
      lastWeek: now,
    },
  };
}

/**
 * Weekly cool-down.
 *
 * Only decays when the player did NOT dip this week, so heat is a running
 * account of ongoing behaviour rather than something that fades while you keep
 * doing it.
 */
export function decayHeat(state: EmbezzlementState, weeksLived: number | undefined | null): EmbezzlementState {
  if (skimmedThisWeek(state, weeksLived)) return state;
  if (state.heat <= 0) return state;
  return { ...state, heat: clamp(state.heat - HEAT_DECAY_PER_WEEK, 0, 100) };
}

/**
 * The dirty-money equivalent this contributes to the EXISTING scandal roll.
 *
 * `scandalProbability` already understands `pacDirtyUSD` (a dollar figure
 * capped at $5M → +6%/wk). Expressing embezzlement heat in the same currency
 * means corruption risk stays ONE number with one tuning point, instead of a
 * second probability curve that has to be kept in step with the first.
 */
export function embezzlementScandalPressureUSD(state: EmbezzlementState): number {
  const heat = clamp(safe(state.heat, 0), 0, 100);
  return Math.round((heat / 100) * 5_000_000);
}
