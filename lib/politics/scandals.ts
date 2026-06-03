/**
 * Political scandal engine.
 *
 * Scandals are the political equivalent of dark-web heat — high-risk actions
 * (excessive donations, dirty money in PAC, controversial alliances) generate
 * scandal risk, which can erupt into a public scandal that damages approval
 * rating, drains campaign funds in damage-control, or ends a career.
 *
 * Pure functions. No game state, no React.
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type ScandalCategory =
  | 'corruption'      // PAC funded by laundered BTC, bribery
  | 'extramarital'    // affair (NPC-driven)
  | 'tax-evasion'     // suspicious wealth
  | 'criminal-ties'   // dark-web heat bleeds into political reputation
  | 'policy-flip'     // enacted a deeply unpopular policy
  | 'donor-fraud';    // illegal campaign finance

export type ScandalSeverity = 'minor' | 'moderate' | 'major' | 'career-ending';

export interface PoliticalScandal {
  id: string;
  category: ScandalCategory;
  severity: ScandalSeverity;
  /** Public headline / description shown in the UI. */
  headline: string;
  /** weeksLived when the scandal broke. */
  startedWeek: number;
  /** Weeks remaining until the scandal naturally fades from the news. */
  weeksRemaining: number;
  /** Cumulative approval damage this scandal has dealt (so UI can show the total hit). */
  approvalLost: number;
  /** Suppression spending so far — reduces severity / accelerates decay. */
  suppressedUSD: number;
  /** Whether the scandal is currently active (not yet resolved). */
  active: boolean;
  /** Resolution state once weeksRemaining hits 0. */
  resolution?: 'survived' | 'forced-resignation' | 'image-restored';
}

/** Per-severity baseline parameters. */
export const SEVERITY_PARAMS: Record<ScandalSeverity, {
  /** Approval damage per week the scandal is active. */
  weeklyApprovalDrain: number;
  /** Total lifespan before the scandal fades (also reset by suppression). */
  baseLifetimeWeeks: number;
  /** USD cost to fully suppress (PR machine, legal team). */
  suppressionCost: number;
  /** True when severity is high enough to force resignation at end of life. */
  canForceResignation: boolean;
}> = {
  minor:          { weeklyApprovalDrain: 1,  baseLifetimeWeeks: 4,  suppressionCost: 5_000,   canForceResignation: false },
  moderate:       { weeklyApprovalDrain: 3,  baseLifetimeWeeks: 8,  suppressionCost: 25_000,  canForceResignation: false },
  major:          { weeklyApprovalDrain: 6,  baseLifetimeWeeks: 12, suppressionCost: 100_000, canForceResignation: true },
  'career-ending':{ weeklyApprovalDrain: 12, baseLifetimeWeeks: 20, suppressionCost: 500_000, canForceResignation: true },
};

/**
 * Probability per week that a given category of risk triggers a real scandal.
 *
 *   - darkWebHeat (0..100) maps to corruption / criminal-ties risk
 *   - PAC dirty-money intake adds corruption / donor-fraud risk
 *   - Karma negativity contributes to a steady drumbeat
 *
 * Returns a probability in [0, 0.35] per week.
 */
export function scandalProbability(input: {
  darkWebHeat?: number;
  /** USD dirty-BTC equivalent the player funneled through the PAC this lifetime. */
  pacDirtyUSD?: number;
  /** -100..100. Negative karma adds risk. */
  karma?: number;
  /** Recent flip-flopped or extreme policies — count of contentious policies enacted in the last 12 weeks. */
  contentiousPolicies?: number;
  /** Current careerLevel — higher offices attract more scrutiny. */
  careerLevel?: number;
}): number {
  const heat = Math.max(0, Math.min(100, safe(input.darkWebHeat, 0)));
  const pacDirty = Math.max(0, safe(input.pacDirtyUSD, 0));
  const karmaNeg = Math.max(0, -safe(input.karma, 0)); // only negative karma counts
  const contentious = Math.max(0, safe(input.contentiousPolicies, 0));
  const office = Math.max(0, safe(input.careerLevel, 0));

  // Each driver contributes a small probability; they add together with a cap.
  let p = 0;
  p += (heat / 100) * 0.08;             // heat 100 → +8%/wk
  p += Math.min(0.06, pacDirty / 5_000_000); // $5M dirty → +6%/wk, capped
  p += karmaNeg * 0.001;                // karma -100 → +10%/wk
  p += contentious * 0.005;             // 5 contentious policies → +2.5%/wk
  p += office * 0.005;                  // president (5) → +2.5%/wk baseline (always under microscope)
  return Math.max(0, Math.min(0.35, p));
}

/**
 * Pick a severity for a fresh scandal given driver intensities.
 * Strong drivers (heat ≥ 80, big dirty money) escalate.
 */
export function pickSeverity(input: {
  darkWebHeat?: number;
  pacDirtyUSD?: number;
  karma?: number;
  roll: number;
}): ScandalSeverity {
  const heat = Math.max(0, Math.min(100, safe(input.darkWebHeat, 0)));
  const dirty = Math.max(0, safe(input.pacDirtyUSD, 0));
  const karma = safe(input.karma, 0);
  const intensity =
    (heat / 100) * 0.4 +
    Math.min(1, dirty / 1_000_000) * 0.4 +
    Math.max(0, -karma / 100) * 0.2;
  // Roll is uniform [0,1). Higher intensity skews toward bigger scandals.
  // We ADD intensity so a maxed-out player rolling 0.99 lands at career-ending.
  const r = Math.max(0, Math.min(0.9999, safe(input.roll, 0.5))) + intensity * 0.5;
  if (r > 1.1) return 'career-ending';
  if (r > 0.75) return 'major';
  if (r > 0.4) return 'moderate';
  return 'minor';
}

/**
 * Pick a category that matches the dominant driver. Used to label the scandal.
 */
export function pickCategory(input: {
  darkWebHeat?: number;
  pacDirtyUSD?: number;
  karma?: number;
  contentiousPolicies?: number;
  roll: number;
}): ScandalCategory {
  const heat = safe(input.darkWebHeat, 0);
  const dirty = safe(input.pacDirtyUSD, 0);
  const karma = safe(input.karma, 0);
  const contentious = safe(input.contentiousPolicies, 0);
  // Build a weighted pool.
  const weights: { cat: ScandalCategory; w: number }[] = [
    { cat: 'criminal-ties', w: heat / 100 },
    { cat: 'corruption',    w: Math.min(1, dirty / 1_000_000) },
    { cat: 'donor-fraud',   w: Math.min(0.8, dirty / 2_500_000) },
    { cat: 'tax-evasion',   w: Math.max(0, -karma / 100) },
    { cat: 'policy-flip',   w: contentious * 0.1 },
    { cat: 'extramarital',  w: 0.05 }, // small constant probability
  ];
  const total = weights.reduce((s, w) => s + w.w, 0);
  if (total <= 0) return 'extramarital';
  const r = Math.max(0, Math.min(0.9999, safe(input.roll, 0.5))) * total;
  let cum = 0;
  for (const w of weights) {
    cum += w.w;
    if (r < cum) return w.cat;
  }
  return 'extramarital';
}

const HEADLINES: Record<ScandalCategory, string[]> = {
  corruption:     ['Pay-to-play scheme uncovered', 'Bribery allegations surface', 'Kickbacks tied to your office'],
  extramarital:   ['Affair rumors spread', 'Tabloid breaks personal story', 'Spouse files for separation in spotlight'],
  'tax-evasion':  ['Tax filings under audit', 'Hidden offshore accounts leaked', 'IRS investigates wealth'],
  'criminal-ties':['Linked to a darknet investigation', 'Ties to organized crime alleged', 'Underworld associate exposed'],
  'policy-flip':  ['Voters revolt over policy reversal', 'Activists camp at your office', 'Editorial boards demand resignation'],
  'donor-fraud':  ['Illegal campaign contributions traced', 'FEC opens donor investigation', 'PAC funds source questioned'],
};

export function generateHeadline(category: ScandalCategory, roll: number): string {
  const list = HEADLINES[category];
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  return list[Math.floor(r * list.length)];
}

/**
 * Compute approval damage and severity decay for one week given the scandal's current state.
 * Suppression spending reduces both damage and lifetime.
 */
export function tickScandal(scandal: PoliticalScandal): {
  scandal: PoliticalScandal;
  approvalDamage: number;
} {
  if (!scandal.active) return { scandal, approvalDamage: 0 };
  const params = SEVERITY_PARAMS[scandal.severity];
  // Suppression reduces the weekly drain proportionally.
  const suppressionFraction = Math.min(1, safe(scandal.suppressedUSD) / params.suppressionCost);
  const damage = Math.max(0, params.weeklyApprovalDrain * (1 - suppressionFraction));
  const nextRemaining = Math.max(0, safe(scandal.weeksRemaining) - 1);
  const stillActive = nextRemaining > 0;
  let resolution: PoliticalScandal['resolution'] = undefined;
  if (!stillActive) {
    if (suppressionFraction >= 1) resolution = 'image-restored';
    else if (params.canForceResignation && suppressionFraction < 0.3) resolution = 'forced-resignation';
    else resolution = 'survived';
  }
  return {
    scandal: {
      ...scandal,
      weeksRemaining: nextRemaining,
      approvalLost: safe(scandal.approvalLost) + damage,
      active: stillActive,
      resolution,
    },
    approvalDamage: damage,
  };
}

/**
 * Add suppression spending to a scandal. Caller is responsible for debiting cash.
 */
export function suppressScandal(scandal: PoliticalScandal, amountUSD: number): PoliticalScandal {
  return {
    ...scandal,
    suppressedUSD: safe(scandal.suppressedUSD) + Math.max(0, safe(amountUSD)),
  };
}

/**
 * Build a fresh scandal from the driver inputs. Caller decides when to call this
 * (typically when scandalProbability fires).
 */
export function createScandal(input: {
  darkWebHeat?: number;
  pacDirtyUSD?: number;
  karma?: number;
  contentiousPolicies?: number;
  careerLevel?: number;
  currentWeek: number;
  rolls: { severity: number; category: number; headline: number };
}): PoliticalScandal {
  const severity = pickSeverity({
    darkWebHeat: input.darkWebHeat,
    pacDirtyUSD: input.pacDirtyUSD,
    karma: input.karma,
    roll: input.rolls.severity,
  });
  const category = pickCategory({
    darkWebHeat: input.darkWebHeat,
    pacDirtyUSD: input.pacDirtyUSD,
    karma: input.karma,
    contentiousPolicies: input.contentiousPolicies,
    roll: input.rolls.category,
  });
  return {
    id: `scandal-${input.currentWeek}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    category,
    severity,
    headline: generateHeadline(category, input.rolls.headline),
    startedWeek: input.currentWeek,
    weeksRemaining: SEVERITY_PARAMS[severity].baseLifetimeWeeks,
    approvalLost: 0,
    suppressedUSD: 0,
    active: true,
  };
}
