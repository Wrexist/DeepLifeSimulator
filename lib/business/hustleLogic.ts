/**
 * Hustle logic — pure functions backing the business app.
 *
 * Owns: hiring scoring, campaign ROI, scandal severity decay, market-share
 * math, IPO valuation, candidate generation. No React, no setGameState —
 * these are pure functions on input data.
 */

import type {
  GameState,
  Company,
  HustleCandidate,
  HustleCandidateRole,
  HustleCampaign,
  HustleCampaignKind,
  HustleCompanyOverlay,
  HustleScandalKind,
  HustleAcquisitionOffer,
  HustleIndustry,
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
 */
export function generateCandidates(
  companyId: string,
  weeksLived: number,
  count: number = 3,
): HustleCandidate[] {
  const out: HustleCandidate[] = [];
  const roles: HustleCandidateRole[] = ['engineer', 'sales', 'manager', 'designer', 'analyst', 'operations'];

  for (let i = 0; i < count; i++) {
    const seed = `hustle-candidate|${companyId}|${weeksLived}|${i}`;
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
      id: `cand-${companyId}-${weeksLived}-${i}`,
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

export function campaignCostFloor(kind: HustleCampaignKind): number {
  return CAMPAIGN_EFFICIENCY[kind].costFloor;
}

// ── Scandal severity & resolution ────────────────────────────────────────

export const SCANDAL_HEADLINES: Record<HustleScandalKind, string[]> = {
  product_defect: [
    'Product recall after defect reports surface',
    'Quality control failure goes viral',
  ],
  labor_abuse: [
    'Workers allege unsafe conditions in leaked memo',
    'Whistleblower exposes overtime violations',
  ],
  environmental: [
    'Regulators investigate pollution complaints',
    'Local activists protest emissions',
  ],
  data_breach: [
    'Customer data leaked in cyber breach',
    'Internal records dumped online',
  ],
  fraud_allegation: [
    'SEC opens accounting irregularities probe',
    'Insider claims books were cooked',
  ],
  pr_disaster: [
    'CEO comment sparks boycott calls',
    'Marketing campaign backfires',
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
