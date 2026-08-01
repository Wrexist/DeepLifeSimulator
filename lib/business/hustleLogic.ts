/**
 * Hustle logic — pure functions backing the business app.
 *
 * Owns: hiring scoring, campaign ROI, scandal severity decay, market-share
 * math, IPO valuation, candidate generation. No React, no setGameState —
 * these are pure functions on input data.
 */

import { familyReputationScandalMultiplier } from './familyBusinessEffects';
import type {
  GameState,
  Company,
  HustleCandidate,
  HustleCandidateRole,
  HustleCampaign,
  HustleCampaignKind,
  HustleCompanyOverlay,
  HustleScandalKind,
  HustleActiveScandal,
  HustleHire,
  HustleAcquisitionOffer,
  HustleIndustry,
  HustleBoardMember,
  HustleSupplier,
} from '@/contexts/game/types';

// ── Candidate generation ─────────────────────────────────────────────────

const FIRST_NAMES = [
  'Sarah', 'Marcus', 'Jin', 'Priya', 'David', 'Naomi', 'Alex', 'Tomas',
  'Olivia', 'Hassan', 'Maya', 'Wei', 'Diego', 'Zara', 'Kai', 'Sofia',
];
const LAST_NAMES = [
  'Chen', 'Patel', 'Reyes', 'Okafor', 'Yamada', 'Singh', 'Vargas', 'Cohen',
  'Mensah', 'Kim', 'Mitchell', 'Hassan', 'Garcia', 'Anders', 'Bauer', 'Pham',
];

const ROLE_SALARY_BASE: Record<HustleCandidateRole, number> = {
  engineer: 2000,
  sales: 1400,
  manager: 1800,
  designer: 1500,
  analyst: 1300,
  operations: 1200,
};

function seededRand(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10_000) / 10_000;
}

/**
 * Generate a deterministic batch of candidates for a company, seeded by
 * `(companyId, weeksLived)` so re-renders / StrictMode reuse the same list.
 *
 * `excludeIds` drops any candidate whose deterministic id is already in use —
 * pass the company's already-hired candidateIds so Refresh can't keep re-emitting
 * a person you already hired (which let hire → Refresh → hire-same-person repeat
 * unboundedly). Skipped indices advance to the next unused slot, keeping every
 * emitted candidate's id + attributes stable/deterministic.
 */
export function generateCandidates(
  companyId: string,
  weeksLived: number,
  count: number = 3,
  excludeIds: readonly string[] = [],
  nonce: number = 0,
): HustleCandidate[] {
  const out: HustleCandidate[] = [];
  const exclude = new Set(excludeIds);
  const roles: HustleCandidateRole[] = ['engineer', 'sales', 'manager', 'designer', 'analyst', 'operations'];

  // A per-open reroll `nonce` mixes into both the id and the seed so tapping
  // Refresh within the same game week yields a genuinely different set (not the
  // same 3 people), while staying deterministic for a given (company, week,
  // nonce). nonce 0 preserves the original ids/values exactly (backward compat).
  const rerollTag = nonce ? `-r${nonce}` : '';

  // Advance the index past any excluded (already-hired) slots. The cap is a
  // safety bound so a pathological excludeIds set can never spin forever.
  for (let i = 0; out.length < count && i < count + exclude.size + 8; i++) {
    const id = `cand-${companyId}-${weeksLived}${rerollTag}-${i}`;
    if (exclude.has(id)) continue;
    const seed = `hustle-candidate|${companyId}|${weeksLived}${rerollTag}|${i}`;
    const r1 = seededRand(seed);
    const r2 = seededRand(seed + 'a');
    const r3 = seededRand(seed + 'b');
    const r4 = seededRand(seed + 'c');

    const role = roles[Math.floor(r1 * roles.length)];
    const skill = Math.floor(30 + r2 * 60);          // 30-90
    const experience = Math.floor(r3 * 90);          // 0-90
    const askVariance = 0.85 + r4 * 0.6;             // 85% - 145% of base
    const salaryAsk = Math.floor(ROLE_SALARY_BASE[role] * (1 + skill / 100) * askVariance);
    const signOnBonus = skill > 70 ? Math.floor(salaryAsk * 4) : undefined;

    out.push({
      id,
      name: `${FIRST_NAMES[Math.floor(r2 * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r3 * LAST_NAMES.length)]}`,
      role,
      skill,
      experience,
      salaryAsk,
      signOnBonus,
      postedWeek: weeksLived,
      expiresWeek: weeksLived + 2,
      interestLevel: 60 + Math.floor(r4 * 30),
    });
  }
  return out;
}

/**
 * Score how attractive an offer is to a candidate. <50 → likely to reject,
 * 50-70 → considering, >70 → likely to accept. Used by `hireCandidate` action.
 */
export function evaluateOffer(
  candidate: HustleCandidate,
  offeredSalary: number,
  offeredBonus: number,
  playerReputation: number,
): number {
  const salaryRatio = offeredSalary / Math.max(1, candidate.salaryAsk);
  // 1.0 ratio = neutral baseline; <0.85 hits hard
  let s = 30 + (salaryRatio - 0.5) * 80;
  if (offeredBonus > 0) s += Math.min(15, offeredBonus / Math.max(1, candidate.salaryAsk) * 3);
  s += Math.min(15, playerReputation / 4);
  s += (candidate.interestLevel - 60) * 0.3;
  return Math.max(0, Math.min(100, Math.round(s)));
}

// ── Campaigns ────────────────────────────────────────────────────────────

const CAMPAIGN_EFFICIENCY: Record<HustleCampaignKind, { roi: number; brandLift: number; costFloor: number }> = {
  tv: { roi: 1.4, brandLift: 4, costFloor: 5_000 },
  social: { roi: 2.2, brandLift: 6, costFloor: 500 },
  billboard: { roi: 1.2, brandLift: 3, costFloor: 2_000 },
  influencer: { roi: 2.6, brandLift: 8, costFloor: 1_500 },
  guerrilla: { roi: 3.2, brandLift: 5, costFloor: 100 }, // high variance flavor
};

export function projectCampaignROI(
  kind: HustleCampaignKind,
  spendPerWeek: number,
  companyWeeklyIncome: number,
): number {
  const e = CAMPAIGN_EFFICIENCY[kind];
  if (spendPerWeek < e.costFloor) return 0;
  // ROI scales with company size — bigger companies get less marginal lift
  const sizeDamp = Math.max(0.4, 1 - companyWeeklyIncome / 1_000_000);
  return Number((e.roi * sizeDamp).toFixed(2));
}

export function brandLiftForCampaign(kind: HustleCampaignKind): number {
  return CAMPAIGN_EFFICIENCY[kind].brandLift;
}

// Weekly realized-ROI variance band, as a multiplier on a campaign's PROJECTED
// ROI. The projected number is an optimistic ceiling-ish flavor figure; the
// actual weekly return is a seeded gamble around it so marketing is never a
// guaranteed printer. Mean multiplier = 0.6, which pulls the EXPECTED realized
// ROI below the break-even point of 2.0 even for the highest-ROI kind:
//   guerrilla  projected 3.2 → mean realized ~1.92 → expected weekly net ≈ −0.08×spend
//   influencer projected 2.6 → mean realized ~1.56 → expected weekly net ≈ −0.44×spend
//   social     projected 2.2 → mean realized ~1.32 → expected weekly net ≈ −0.68×spend
// (net per week = spend × (realizedROI − 2), since spend is paid then lift =
// spend × (realizedROI − 1) is credited). Good weeks still pay out handsomely
// (guerrilla can realize up to ~3.36 → +1.36×spend), so campaigns stay a fun,
// brand-building gamble with real downside instead of free money.
export const CAMPAIGN_ROI_VARIANCE_MIN = 0.15;
export const CAMPAIGN_ROI_VARIANCE_MAX = 1.05;

/**
 * Well-mixed string → [0, 1) hash (xmur3 avalanche + a finalizing mix). Unlike
 * the lightweight `seededRand` above, this spreads *sequentially incrementing*
 * seeds (`...|week=1`, `...|week=2`, …) uniformly across the unit interval, so a
 * campaign's realized ROI genuinely varies week to week instead of clustering
 * near one value per id. Used only for the campaign gamble; `seededRand` is left
 * untouched so scandal / candidate / earnings determinism is unchanged.
 */
function mixedRoll01(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The ROI a campaign actually realizes for a given week. Deterministic — seeded
 * by campaign id + week (no Math.random / wall clock) so the weekly tick stays
 * reproducible. Applies a uniform variance multiplier in
 * [CAMPAIGN_ROI_VARIANCE_MIN, CAMPAIGN_ROI_VARIANCE_MAX] to the projected ROI.
 * Can dip well below break-even (losing week) or spike above it (windfall).
 */
export function realizedCampaignROI(
  campaignId: string,
  projectedROI: number,
  weeksLived: number,
): number {
  const safeProjected = isFinite(projectedROI) && projectedROI > 0 ? projectedROI : 0;
  const roll = mixedRoll01(`hustle-campaign-roi|${campaignId}|${weeksLived}`);
  const mult = CAMPAIGN_ROI_VARIANCE_MIN + roll * (CAMPAIGN_ROI_VARIANCE_MAX - CAMPAIGN_ROI_VARIANCE_MIN);
  return Math.max(0, safeProjected * mult);
}

export function campaignCostFloor(kind: HustleCampaignKind): number {
  return CAMPAIGN_EFFICIENCY[kind].costFloor;
}

// ── Scandal severity & resolution ────────────────────────────────────────

export const SCANDAL_HEADLINES: Record<HustleScandalKind, string[]> = {
  product_defect: [
    'Product recall after defect reports surface',
    'Quality control failure goes viral',
    'Flagship line pulled from shelves over safety fears',
    'Customers post videos of malfunctioning units',
  ],
  labor_abuse: [
    'Workers allege unsafe conditions in leaked memo',
    'Whistleblower exposes overtime violations',
    'Union files complaint over unpaid wages',
    'Undercover report reveals grueling shift quotas',
  ],
  environmental: [
    'Regulators investigate pollution complaints',
    'Local activists protest emissions',
    'Leaked report ties operations to contaminated runoff',
    'City council reviews permits after spill allegations',
  ],
  data_breach: [
    'Customer data leaked in cyber breach',
    'Internal records dumped online',
    'Millions of accounts exposed in security lapse',
    'Regulators probe delayed breach disclosure',
  ],
  fraud_allegation: [
    'SEC opens accounting irregularities probe',
    'Insider claims books were cooked',
    'Auditors flag suspicious revenue recognition',
    'Short-seller report alleges inflated numbers',
  ],
  pr_disaster: [
    'CEO comment sparks boycott calls',
    'Marketing campaign backfires',
    'Tone-deaf ad pulled after public outcry',
    'Executive email leak fuels online backlash',
  ],
};

export const SCANDAL_BASE_SEVERITY: Record<HustleScandalKind, number> = {
  product_defect: 50,
  labor_abuse: 60,
  environmental: 55,
  data_breach: 70,
  fraud_allegation: 80,
  pr_disaster: 45,
};

export function scandalRevenueDrag(severity: number): number {
  // % weekly drag — severity 100 → 30%, severity 30 → 5%
  return Math.min(0.3, Math.max(0, (severity - 20) / 270));
}

// ── Organic scandal roll (weekly tick) ───────────────────────────────────

/** Companies below this weekly income are too small to attract a scandal. */
export const SCANDAL_MIN_WEEKLY_INCOME = 3_000;
/** Weeks after a scandal is survived before another can spawn on that company. */
export const SCANDAL_COOLDOWN_WEEKS = 12;
/** Base per-week spawn chance, before brand/size scaling. */
export const SCANDAL_BASE_CHANCE = 0.025;
/** Absolute per-week ceiling on spawn chance after scaling. */
export const SCANDAL_MAX_CHANCE = 0.12;

/**
 * Which scandal kinds each industry is prone to (used to weight the roll so a
 * factory tends toward product/labor/environmental, a bank toward fraud/data).
 * Falls back to the full pool for unknown industries.
 */
const SCANDAL_KINDS_BY_INDUSTRY: Record<HustleIndustry, HustleScandalKind[]> = {
  factory: ['product_defect', 'labor_abuse', 'environmental'],
  ai: ['data_breach', 'pr_disaster', 'fraud_allegation'],
  restaurant: ['product_defect', 'labor_abuse', 'pr_disaster'],
  realestate: ['fraud_allegation', 'environmental', 'pr_disaster'],
  bank: ['fraud_allegation', 'data_breach', 'pr_disaster'],
};

const ALL_SCANDAL_KINDS: HustleScandalKind[] = [
  'product_defect', 'labor_abuse', 'environmental', 'data_breach', 'fraud_allegation', 'pr_disaster',
];

/**
 * Per-week seeded spawn chance for a company. Base ~2.5%/wk, raised as brand
 * health falls (weak brand → up to 2× risk) and gently by company size, capped
 * at SCANDAL_MAX_CHANCE. Exposed for tests + tuning.
 */
export function scandalSpawnChance(brandScore: number, weeklyIncome: number): number {
  const brand = isFinite(brandScore) ? brandScore : 50;
  const income = isFinite(weeklyIncome) && weeklyIncome > 0 ? weeklyIncome : 0;
  const brandRiskMul = 1 + Math.max(0, 50 - brand) / 50;      // brand 50→1×, brand 0→2×
  const sizeRiskMul = 1 + Math.min(0.5, income / 200_000);     // bigger → up to +50%
  return Math.min(SCANDAL_MAX_CHANCE, SCANDAL_BASE_CHANCE * brandRiskMul * sizeRiskMul);
}

/**
 * Roll a single organic scandal for a company in a given week. Deterministic
 * (seeded by company id + week — no wall clock). Returns null when no scandal
 * fires. Guards: never spawns a 2nd concurrent scandal, size-gated, and honors
 * a post-resolution cooldown off the most-recent scandalHistory entry.
 */
export function rollScandalForWeek(
  company: Company,
  overlay: HustleCompanyOverlay,
  weeksLived: number,
  /** C-2: the family-business reputation for this company, if it is one. */
  familyReputation?: number,
): HustleActiveScandal | null {
  // One scandal at a time.
  if (overlay.activeScandal) return null;
  // Size gate — small companies don't draw scrutiny.
  const income = company.weeklyIncome ?? 0;
  if (income < SCANDAL_MIN_WEEKLY_INCOME) return null;
  // Post-resolution cooldown — no back-to-back scandals.
  const history = overlay.scandalHistory ?? [];
  if (history.length > 0) {
    const lastSurvived = history[history.length - 1].survivedAtWeek ?? -Infinity;
    if (weeksLived - lastSurvived < SCANDAL_COOLDOWN_WEEKS) return null;
  }

  const brand = overlay.brand?.score ?? 50;
  /**
   * C-2: a family business's Reputation moves how much scrutiny it draws.
   * MULTIPLIES the chance already computed from brand and size rather than
   * replacing it, so the size gate and post-scandal cooldown above still do
   * their work. Neutral at the seeded reputation of 50, and bounded well away
   * from zero — reputation must not buy immunity, or the scandal system and
   * the resolution UI built for it stop existing for anyone who invests.
   * Companies that are not family businesses pass `undefined` and get 1.0.
   */
  const chance = scandalSpawnChance(brand, income)
    * familyReputationScandalMultiplier(familyReputation);
  const seed = `hustle-scandal-roll|${company.id}|${weeksLived}`;
  if (seededRand(seed) >= chance) return null;

  const industry = company.type as HustleIndustry;
  const kinds = SCANDAL_KINDS_BY_INDUSTRY[industry] ?? ALL_SCANDAL_KINDS;
  const kind = kinds[Math.floor(seededRand(seed + '|kind') * kinds.length)];
  const severity = SCANDAL_BASE_SEVERITY[kind];
  const headlines = SCANDAL_HEADLINES[kind];
  const headline = headlines[Math.floor(seededRand(seed + '|hl') * headlines.length)];

  return {
    id: `scn-${company.id}-${weeksLived}`,
    kind,
    severity,
    startedWeek: weeksLived,
    weeksRemaining: 6,
    headline,
    resolutionMethod: null,
    revenueDragPercent: scandalRevenueDrag(severity),
  };
}

/**
 * Estimate the total revenue a scandal dragged away over its active life, from
 * its initial (base) severity, the number of weeks it was active, and the
 * company's weekly income. Uses the average of the start/end weekly drag as
 * severity decays ~10/wk. Deterministic; used to fill HustleScandalRecord's
 * totalRevenueLoss (previously hardcoded 0).
 */
export function estimateScandalRevenueLoss(
  initialSeverity: number,
  weeksActive: number,
  companyWeeklyIncome: number,
): number {
  const weeks = Math.max(0, Math.floor(weeksActive));
  const income = isFinite(companyWeeklyIncome) && companyWeeklyIncome > 0 ? companyWeeklyIncome : 0;
  if (weeks === 0 || income === 0) return 0;
  const finalSeverity = Math.max(0, initialSeverity - 10 * weeks);
  const avgDrag = (scandalRevenueDrag(initialSeverity) + scandalRevenueDrag(finalSeverity)) / 2;
  return Math.max(0, Math.round(weeks * income * avgDrag));
}

/**
 * Reputation damage a scandal leaves behind on resolution (a small, bounded
 * figure scaled by its initial severity). Used to fill HustleScandalRecord's
 * finalReputationLoss (previously hardcoded 0 on the natural-decay path).
 */
export function scandalReputationLoss(initialSeverity: number): number {
  return Math.max(1, Math.round((isFinite(initialSeverity) ? initialSeverity : 0) / 12));
}

// ── Named-hire productivity payoff ───────────────────────────────────────

/**
 * Bounded income factor contribution from a company's named-hire roster. Reads
 * the existing per-hire `performance` (0-100). Neutral (0) with an empty roster
 * so older saves / hire-less companies are unaffected. Range: [-0.08, +0.08]
 * (a ±8% nudge), folded into passiveIncome's existing [0.75, 1.6] clamp so the
 * COMBINED brand + share + hire multiplier can never exceed the cap.
 */
export function namedHirePerformanceFactor(namedHires: HustleHire[] | undefined): number {
  const hires = Array.isArray(namedHires) ? namedHires : [];
  if (hires.length === 0) return 0;
  const avg =
    hires.reduce(
      (sum, h) => sum + (typeof h.performance === 'number' && isFinite(h.performance) ? h.performance : 50),
      0,
    ) / hires.length;
  // (avg-50)/625 → 0 at neutral 50, ±0.08 at the 0/100 extremes.
  return Math.max(-0.08, Math.min(0.08, (avg - 50) / 625));
}

// ── Company overlay factory ──────────────────────────────────────────────

/**
 * Build a fresh Hustle overlay for a newly-founded company. Single source of
 * truth for the default shape (mirrors the v17 save migration + ensureOverlay)
 * so `createCompany` can seed the overlay immediately — otherwise the weekly
 * tick skips overlay-less companies (`if (!prevOverlay) continue`).
 */
export function createDefaultCompanyOverlay(
  companyId: string,
  weeksLived: number,
): HustleCompanyOverlay {
  return {
    companyId,
    hiringPipeline: { candidates: [], namedHires: [], weeksSinceLastHire: 0, totalSeverance: 0 },
    activeCampaigns: [],
    brand: { score: 50, trend: 'flat', lastUpdatedWeek: weeksLived },
    activeScandal: null,
    scandalHistory: [],
    boardSeats: [],
    ipo: { status: 'private', ownershipPercent: 100, sharePrice: 0, sharesOutstandingK: 0, recentEarnings: [] },
    pendingAcquisitions: [],
    suppliers: [],
    marketSharePercent: 5,
    notifications: [],
  };
}

// ── Board & supplier seeding ─────────────────────────────────────────────

const BOARD_ROLE_ORDER: HustleBoardMember['role'][] = [
  'chair', 'lead_investor', 'cfo', 'cto', 'cmo', 'independent',
];
const BOARD_ALIGNMENTS: HustleBoardMember['alignment'][] = [
  'aggressive_growth', 'cost_cutting', 'employee_focused', 'shareholder_focused',
];

/**
 * Deterministic board roster for a public company, seeded by (companyId,
 * seedWeek) — no Math.random, so re-renders and reloads reproduce the same 3-5
 * directors. Roles are drawn distinctly from BOARD_ROLE_ORDER (chair first), and
 * every display field (name/role/votingShare/alignment/satisfaction) is filled.
 * Used to seed on IPO, or to lazily derive when a public company carries no
 * stored board (the CompanyDetailScreen "Board of directors" section reads this).
 */
export function generateBoardSeats(
  companyId: string,
  seedWeek: number,
  count?: number,
): HustleBoardMember[] {
  const base = `hustle-board|${companyId}|${seedWeek}`;
  const n = count ?? 3 + Math.floor(seededRand(base + '|count') * 3); // 3-5
  const seats: HustleBoardMember[] = [];
  for (let i = 0; i < n; i++) {
    const seed = `${base}|${i}`;
    const r1 = seededRand(seed);
    const r2 = seededRand(seed + 'a');
    const r3 = seededRand(seed + 'b');
    const role = BOARD_ROLE_ORDER[Math.min(i, BOARD_ROLE_ORDER.length - 1)];
    const votingShare = role === 'chair' ? 9 + r1 * 6 : 3 + r3 * 6; // chair 9-15%, others 3-9%
    seats.push({
      id: `board-${companyId}-${seedWeek}-${i}`,
      name: `${FIRST_NAMES[Math.floor(r1 * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(r3 * LAST_NAMES.length)]}`,
      role,
      votingShare: Number(votingShare.toFixed(1)),
      alignment: BOARD_ALIGNMENTS[Math.floor(r2 * BOARD_ALIGNMENTS.length)],
      satisfaction: Math.floor(45 + r1 * 45), // 45-90
    });
  }
  return seats;
}

const SUPPLIER_NAMES: Record<HustleIndustry, string[]> = {
  factory: ['Steel & Sons Supply', 'Precision Components Co.', 'BulkRaw Logistics', 'Forge Parts Ltd.'],
  ai: ['CloudCore Compute', 'DataStream Providers', 'SiliconEdge Chips', 'ModelHost Infra'],
  restaurant: ['FreshField Produce', 'Harbor Seafood Co.', 'Prime Meats Supply', 'DailyBread Distributors'],
  realestate: ['BuildRight Contractors', 'Skyline Materials', 'Metro Fixtures Co.', 'Cornerstone Concrete'],
  bank: ['SecureLedger Systems', 'ComplyTech Services', 'VaultGuard Security', 'DataTrust Providers'],
};

/**
 * Deterministic supplier roster for a company, seeded by companyId (stable
 * across weeks — no Math.random) so a founded company always shows the same 2-4
 * vendors. costPerWeek scales gently with the company's weekly income (falling
 * back to a flat band when income is unknown); reliability is 60-95. Derived
 * suppliers are month-to-month (contractEndWeek undefined) so the "Xw contract"
 * display never drifts negative as weeks pass. Used to seed on founding, or to
 * lazily derive when a company carries no stored suppliers.
 */
export function generateSuppliers(
  companyId: string,
  industry: HustleIndustry,
  weeklyIncome: number = 0,
  count?: number,
): HustleSupplier[] {
  const base = `hustle-supplier|${companyId}`;
  const n = count ?? 2 + Math.floor(seededRand(base + '|count') * 3); // 2-4
  const pool = SUPPLIER_NAMES[industry] ?? SUPPLIER_NAMES.factory;
  const income = isFinite(weeklyIncome) && weeklyIncome > 0 ? weeklyIncome : 0;
  const suppliers: HustleSupplier[] = [];
  for (let i = 0; i < n; i++) {
    const seed = `${base}|${i}`;
    const r1 = seededRand(seed);
    const r2 = seededRand(seed + 'a');
    const rawCost = income > 0 ? income * (0.03 + r1 * 0.05) : 300 + r1 * 900;
    suppliers.push({
      id: `supplier-${companyId}-${i}`,
      name: pool[i % pool.length],
      industry,
      costPerWeek: Math.max(100, Math.round(rawCost / 10) * 10),
      reliability: Math.floor(60 + r2 * 35), // 60-95
      contractEndWeek: undefined, // month-to-month; keeps the contract display stable
    });
  }
  return suppliers;
}

// ── Market share ─────────────────────────────────────────────────────────

/**
 * Recompute a company's market share. Brand health + campaign activity push
 * up, scandals push down. Capped 0-100.
 */
export function recomputeMarketShare(overlay: HustleCompanyOverlay): number {
  const base = overlay.marketSharePercent || 5;
  const brandFactor = (overlay.brand.score - 50) / 100; // -0.5 to +0.5
  const campaignFactor = overlay.activeCampaigns.length * 0.4;
  const scandalDrag = overlay.activeScandal ? -overlay.activeScandal.severity / 20 : 0;
  const next = base + brandFactor + campaignFactor + scandalDrag;
  return Math.max(0.1, Math.min(85, Number(next.toFixed(2))));
}

// ── IPO valuation ────────────────────────────────────────────────────────

/**
 * Compute the per-share price at IPO. Valuation = 8× annual revenue × brand
 * multiplier × scandal penalty, divided by shares outstanding.
 */
export function computeIPOSharePrice(
  company: Company,
  overlay: HustleCompanyOverlay,
  sharesOutstandingK: number = 100,
): number {
  const annualRevenue = (company.weeklyIncome || 0) * 52;
  const brandMul = 0.5 + overlay.brand.score / 100; // 0.5-1.5
  const scandalPenalty = overlay.activeScandal ? Math.max(0.3, 1 - overlay.activeScandal.severity / 100) : 1;
  const valuation = annualRevenue * 8 * brandMul * scandalPenalty;
  return Math.max(0.5, Number((valuation / Math.max(1, sharesOutstandingK * 1000)).toFixed(2)));
}

/**
 * Quarterly earnings volatility — a small random-walk per share price tick
 * scaled by brand health. Used by hustleTick on the 12-week earnings cadence.
 */
export function computeQuarterlyEarningsMovement(
  overlay: HustleCompanyOverlay,
  baseSharePrice: number,
): { newPrice: number; beat: boolean } {
  const seed = `hustle-earnings|${overlay.companyId}|${overlay.ipo.lastEarningsWeek ?? 0}`;
  const rng = seededRand(seed);
  // Beat estimates 55% of the time; missing wipes 10% off, beating adds 12%
  const beat = rng > 0.45;
  const delta = beat ? 0.05 + rng * 0.07 : -(0.05 + (1 - rng) * 0.05);
  const newPrice = Math.max(0.5, Number((baseSharePrice * (1 + delta)).toFixed(2)));
  return { newPrice, beat };
}

// ── Acquisition offer generation ─────────────────────────────────────────

const RIVAL_NAMES: Record<HustleIndustry, string[]> = {
  factory: ['IronWorks Co.', 'Apex Manufacturing', 'NorthForge Industries', 'Stratus Mills'],
  ai: ['Neural Labs', 'Cortex AI', 'DeepFork', 'Mira Intelligence'],
  restaurant: ['Bistro Group', 'Skyline Eats', 'Urban Spice', 'Plate & Pantry'],
  realestate: ['Lighthouse Properties', 'Citywide Realty', 'Anchor REIT', 'Summit Holdings'],
  bank: ['First Pacific', 'Heritage Trust', 'Crown Capital', 'Foundry Bank'],
};

export function generateAcquisitionOffer(
  forCompany: Company,
  weeksLived: number,
  seedSalt: string = '',
): HustleAcquisitionOffer | null {
  // Only generate offers if the player has enough company size to be a target.
  if ((forCompany.weeklyIncome ?? 0) < 5_000) return null;

  const rng = seededRand(`hustle-acq|${forCompany.id}|${weeksLived}|${seedSalt}`);
  const industry = forCompany.type as HustleIndustry;
  const pool = RIVAL_NAMES[industry] ?? RIVAL_NAMES.factory;
  const targetName = pool[Math.floor(rng * pool.length)];

  const targetAnnualRev = Math.floor((forCompany.weeklyIncome ?? 0) * 52 * (0.5 + rng * 1.3));
  const askingPrice = Math.floor(targetAnnualRev * (4 + rng * 6)); // 4-10× revenue
  const synergyBonusPercent = Math.floor(8 + rng * 22); // 8-30%

  return {
    id: `acq-${forCompany.id}-${weeksLived}`,
    targetName,
    targetIndustry: industry,
    askingPrice,
    estimatedAnnualRevenue: targetAnnualRev,
    synergyBonusPercent,
    offeredWeek: weeksLived,
    expiresWeek: weeksLived + 4,
    status: 'pending',
  };
}

// ── Hiring pipeline morale drift ─────────────────────────────────────────

/**
 * Weekly morale change for a named hire. Driven by salary fairness, recent
 * scandals, board satisfaction. Range: -8 to +8.
 */
export function namedHireMoraleDelta(
  hire: { salary: number; morale: number },
  overlay: HustleCompanyOverlay,
  marketRate: number,
): number {
  const fairness = hire.salary >= marketRate ? 2 : -3;
  const scandalDrag = overlay.activeScandal ? -Math.floor(overlay.activeScandal.severity / 20) : 0;
  const random = Math.floor((seededRand(`morale|${overlay.companyId}|${hire.morale}`) - 0.5) * 6);
  return Math.max(-8, Math.min(8, fairness + scandalDrag + random));
}

// ── Brand health drift ───────────────────────────────────────────────────

export function computeBrandTrend(
  prevScore: number,
  nextScore: number,
): 'rising' | 'flat' | 'declining' {
  const diff = nextScore - prevScore;
  if (diff > 1) return 'rising';
  if (diff < -1) return 'declining';
  return 'flat';
}
