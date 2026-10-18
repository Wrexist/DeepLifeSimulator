/**
 * Hustle weekly tick — processes business overlay each game week.
 *
 * Called once per nextWeek() advance from GameActionsContext.tsx. Pure
 * function — no React, no side effects on input.
 *
 * Per-company order of operations (all use `nextWeeksLived`):
 *   0. General-staff payroll (employees − named hires) × companyStaffWage
 *      (furloughed while the owner is jailed - see `payrollFurloughed`)
 *   1. Campaign progression — decrement durations, mark expired
 *   2. Brand health drift toward 50 (no campaigns), lift with active ones
 *   3. Scandal severity decay (10/wk, +15 if 'apology' resolution)
 *   4. Named hire morale drift + performance roll
 *   5. Market share recompute
 *   6. Acquisition offer generation (every 8 weeks, eligibility-gated)
 *   7. IPO quarterly earnings report (every 12 weeks)
 *   8. Pending notification trim
 */
import type {
  GameState,
  HustleAppState,
  HustleCompanyOverlay,
  HustleAcquisitionOffer,
} from '@/contexts/game/types';
import {
  recomputeMarketShare,
  computeBrandTrend,
  computeQuarterlyEarningsMovement,
  generateAcquisitionOffer,
  namedHireMoraleDelta,
  realizedCampaignROI,
  scandalRevenueDrag,
  rollScandalForWeek,
  estimateScandalRevenueLoss,
  scandalReputationLoss,
  SCANDAL_BASE_SEVERITY,
} from './hustleLogic';

const NOTIFICATION_CAP = 80;

const finiteNonNeg = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

/**
 * A general employee is never paid less than this share of the company's
 * `baseWeeklyIncome` (its income before the headcount multiplier).
 *
 * WHY (2026-10-17, owner call "fully upgraded factory nets ~$5k/wk at 10
 * staff"): the staff lift is a PERCENTAGE of base income (+10%/+5%/+2%/+1% a
 * head, `companyIncomeMultiplier`), but the wage was a flat industry constant
 * fixed at founding. Upgrades raise base income 4-15x while the wage stays put,
 * so how many heads paid off was decided by an arbitrary wage-to-income ratio
 * rather than by anything the player chose. Measured on fully upgraded
 * companies at a fresh brand: the restaurant ($400 wage = 3.4% of its $11,597
 * base) kept hiring to 20 heads, staff added +83% to its net, and its whole
 * $827k build paid back in 38 weeks - faster than the 40-60 week band any
 * single level-1 upgrade is held to, and 46% more net than a factory built for
 * the same money. Every other industry stopped at 5-10 heads.
 *
 * 5% is DERIVED, not tuned: heads 11-20 add 1.025 x (m(20) - m(10)) = 0.46 of
 * base income at a fresh brand, so any per-head wage above 4.6% of base makes
 * that band an overspend. At 5% no industry's best headcount passes 10 unless
 * its brand is genuinely strong. It binds only once base income outgrows
 * 20x the industry wage; at founding the industry wage always wins, so an
 * early hire is still a loss everywhere (the ratchet in
 * `__tests__/economy/companyStaffPayroll.test.ts`).
 */
export const STAFF_WAGE_MIN_SHARE_OF_BASE = 0.05;

/**
 * What ONE general employee of `company` is paid per week: the industry wage
 * (`workerSalary`) or `STAFF_WAGE_MIN_SHARE_OF_BASE` of base income, whichever
 * is higher. Read live from the stored base, so it applies to every save at
 * once with no migration. NaN-safe: a malformed field degrades to 0 on its own
 * side of the max, never into the tick's cash line.
 */
export function companyStaffWage(
  company: { workerSalary?: number; baseWeeklyIncome?: number } | null | undefined,
): number {
  const industry = finiteNonNeg(company?.workerSalary);
  const scaled = Math.round(finiteNonNeg(company?.baseWeeklyIncome) * STAFF_WAGE_MIN_SHARE_OF_BASE);
  return Math.max(industry, scaled);
}

export interface CompanyWeeklyPayroll {
  /** Headcount that is NOT a named hire - paid `wagePerHead` each. */
  generalStaff: number;
  /** One general employee's weekly wage (`companyStaffWage`). */
  wagePerHead: number;
  /** `generalStaff * wagePerHead`. */
  generalPayroll: number;
  /** Sum of the named hires' individual weekly salaries. */
  namedPayroll: number;
  /** Everything the company's people cost per week. */
  total: number;
}

/**
 * What a company's people cost per week - the ONE definition, read by the tick
 * that charges it and by every surface that quotes it (Contacts' team row).
 *
 * Named hires ARE employees (`withEmployeeDelta` bumps `company.employees` when
 * one is accepted) but carry their own negotiated salary, which the tick already
 * charges below. So general staff = headcount minus named hires, each at
 * `companyStaffWage` - never both, or a named hire would be paid twice.
 *
 * Before this, general staff paid `workerSalary` ONCE, at hire, while the
 * headcount multiplier raised `weeklyIncome` forever: a factory's 30 hires cost
 * a one-off $15,000 and lifted $1,500/wk to $4,152/wk, a ~6-week payback in a
 * catalogue whose upgrades are pinned to 40-60 weeks. NaN-safe throughout: a
 * malformed field degrades to 0, never into the tick's cash line.
 */
export function companyWeeklyPayroll(
  company: { employees?: number; workerSalary?: number; baseWeeklyIncome?: number } | null | undefined,
  namedHires: readonly { salary?: number }[] | null | undefined,
): CompanyWeeklyPayroll {
  const named = Array.isArray(namedHires) ? namedHires : [];
  const headcount = Math.floor(finiteNonNeg(company?.employees));
  const generalStaff = Math.max(0, headcount - named.length);
  const wagePerHead = companyStaffWage(company);
  const generalPayroll = generalStaff * wagePerHead;
  const namedPayroll = named.reduce((sum, h) => sum + finiteNonNeg(h?.salary), 0);
  return { generalStaff, wagePerHead, generalPayroll, namedPayroll, total: generalPayroll + namedPayroll };
}

/**
 * How much of this week's taxable income company payroll shelters.
 *
 * Payroll is a business expense, so it comes off the tax base - but only up to
 * the company income actually paid this week (`companyIncomeThisWeek`, 0 while
 * the owner is jailed). Without the ceiling, a payroll larger than the week's
 * company income would shelter salary, rent and every other stream.
 *
 * WHY (2026-10-17): company revenue entered the tax base in full while the
 * hustle tick paid wages out of what was left after tax, so a staffed AI
 * company or bank at its best headcount lost money once taxed. Reads the same
 * heads and named-hire salaries `processHustleWeeklyTick` charges, from the
 * same pre-tick state, so the deduction is exactly the payroll the week pays.
 */
export function companyPayrollTaxDeduction(
  state: Pick<GameState, 'companies' | 'hustleApp'>,
  companyIncomeThisWeek: number,
): number {
  const ceiling = finiteNonNeg(companyIncomeThisWeek);
  if (ceiling <= 0) return 0;
  let payroll = 0;
  for (const company of state.companies ?? []) {
    if (!company || typeof company.id !== 'string') continue;
    const namedHires = state.hustleApp?.companies?.[company.id]?.hiringPipeline?.namedHires;
    payroll += companyWeeklyPayroll(company, namedHires).total;
  }
  return Math.min(ceiling, finiteNonNeg(payroll));
}

/**
 * Whether this week's payroll is furloughed: true while the owner is jailed.
 *
 * The tick withholds ALL company income while the owner is jailed - companies
 * carry no managed mode, so a jailed owner's business earns nothing
 * (GameActionsContext, `companyIncomeThisWeek`). Until 2026-10-18 the staff
 * were still paid for those weeks, so a jail sentence charged a full payroll
 * against zero revenue: a closed business with its wage bill running. The
 * staff of a closed business are furloughed for the same weeks instead.
 *
 * Not a farm: jail costs the week's company income, and the payroll ratchet
 * (`__tests__/economy/companyStaffPayroll.test.ts`) keeps income above payroll
 * at every headcount worth hiring, so a jailed week is always a net loss.
 * Reads the same pre-tick `jailWeeks` the income gate reads.
 */
export function payrollFurloughed(state: Pick<GameState, 'jailWeeks'>): boolean {
  return (state.jailWeeks ?? 0) > 0;
}

function pushNotif(o: HustleCompanyOverlay, text: string, type: any, weeksLived: number): HustleCompanyOverlay {
  return {
    ...o,
    notifications: [
      {
        id: `tick-${o.companyId}-${weeksLived}-${o.notifications.length}`,
        type,
        text,
        // Seeded from the game week (deterministic) rather than wall-clock
        // Date.now() - this is an otherwise fully-seeded tick, and Date.now()
        // made notifications save-scummable + StrictMode-inconsistent.
        timestamp: weeksLived,
        gameWeek: weeksLived,
        read: false,
        refCompanyId: o.companyId,
      },
      ...o.notifications,
    ].slice(0, NOTIFICATION_CAP),
  };
}

export interface HustleTickResult {
  hustleApp: HustleAppState;
  /** Money to credit the player (campaign revenue lift + quarterly dividends - campaign spend). */
  cashDelta: number;
  /** Reasons (for daily summary). */
  cashReasons: string[];
}

export function processHustleWeeklyTick(
  state: GameState,
  nextWeeksLived: number,
): HustleTickResult {
  const base: HustleAppState = state.hustleApp ?? {
    companies: {},
    lifetimeStats: {
      totalCompaniesFounded: 0, totalCompaniesSold: 0, totalIPOsLaunched: 0,
      totalAcquisitionsCompleted: 0, totalScandalsSurvived: 0, totalCampaignsRun: 0,
      totalNamedHires: 0, totalFires: 0,
      peakBrandScore: 0, peakMarketShare: 0, peakSharePrice: 0,
    },
  };

  const out: HustleAppState = {
    companies: { ...base.companies },
    lifetimeStats: { ...base.lifetimeStats },
    lastOpenedTimestamp: base.lastOpenedTimestamp,
  };

  let cashDelta = 0;
  const cashReasons: string[] = [];

  // R10-2: track spendable cash so a broke player can't run marketing campaigns
  // "for free". The weekly-tick consumer floors money at `Math.max(0, money +
  // cashDelta)`, which silently masked unaffordable campaign spend. Gate each
  // campaign's weekly spend on the running balance and pause it otherwise.
  let availableCash = state.stats?.money ?? 0;

  const playerCompanies = state.companies ?? [];
  const furloughed = payrollFurloughed(state);

  for (const company of playerCompanies) {
    if (!company || typeof company.id !== 'string') continue;
    const prevOverlay = out.companies[company.id];

    // 0. General-staff payroll - charged BEFORE the overlay check, because the
    // staff and their income multiplier live on the canonical Company record,
    // not the overlay: a company with no overlay still has employees to pay.
    // Named hires are excluded here (see companyWeeklyPayroll) and charged with
    // their own salaries in step 4.
    const { generalPayroll } = companyWeeklyPayroll(company, prevOverlay?.hiringPipeline?.namedHires);
    if (generalPayroll > 0 && !furloughed) {
      cashDelta -= generalPayroll;
      availableCash -= generalPayroll;
      cashReasons.push(`${company.name} staff payroll`);
    }

    if (!prevOverlay) continue; // migration creates these; if missing, skip

    let o: HustleCompanyOverlay = { ...prevOverlay };
    const prevBrand = o.brand.score;

    // 1. Campaigns — decrement & expire
    const stillActive = [];
    for (const camp of o.activeCampaigns) {
      const weeksElapsed = nextWeeksLived - camp.startedWeek;
      if (weeksElapsed >= camp.durationWeeks) {
        o = pushNotif(o, `${camp.kind} campaign ended`, 'campaign_complete', nextWeeksLived);
        continue;
      }
      // Can the player actually fund this week's spend? If not, PAUSE the
      // campaign rather than running it for free against the floored balance.
      // BUG FIX: previously this `continue`d WITHOUT re-adding the campaign to
      // `stillActive`, silently DELETING a merely-underfunded campaign. Keep it
      // active (it just skips this week's spend + lift) so it resumes once the
      // player can afford it and still expires on its own schedule.
      if (availableCash < camp.spendPerWeek) {
        o = pushNotif(o, `${camp.kind} campaign paused - insufficient funds`, 'campaign_complete', nextWeeksLived);
        stillActive.push(camp);
        continue;
      }
      // Pay spend
      cashDelta -= camp.spendPerWeek;
      availableCash -= camp.spendPerWeek;
      cashReasons.push(`${camp.kind} campaign weekly spend`);
      // Add ROI-driven revenue lift. MONEY-SAFETY FIX: the realized ROI is a
      // SEEDED weekly gamble around the projected number (deterministic - seeded
      // by campaign id + week), not the projected number itself. Previously the
      // full projected lift was credited risk-free, so any kind with projected
      // ROI > 2 (guerrilla/influencer/social) was a guaranteed, stackable printer
      // (net = spend × (ROI − 2) every week). Now bad weeks realize below break-
      // even (lift < spend, or 0 lift → the whole spend is a loss) while good
      // weeks still pay out - expected net is ≈0-or-negative for the high-ROI kinds.
      const realizedROI = realizedCampaignROI(camp.id, camp.projectedROI, nextWeeksLived);
      const lift = Math.floor(camp.spendPerWeek * (realizedROI - 1));
      if (lift > 0) {
        cashDelta += lift;
        availableCash += lift;
        cashReasons.push(`${camp.kind} campaign revenue lift`);
      }
      stillActive.push(camp);
    }
    o = { ...o, activeCampaigns: stillActive };

    // 2. Brand health drift toward 50 if no campaigns, lift slightly otherwise
    let brandNext = o.brand.score;
    if (stillActive.length > 0) {
      brandNext = Math.min(100, brandNext + 1);
    } else {
      brandNext += brandNext > 50 ? -0.5 : 0.5;
      brandNext = Math.max(0, Math.min(100, brandNext));
    }
    if (o.activeScandal) brandNext = Math.max(0, brandNext - o.activeScandal.severity / 30);
    o = {
      ...o,
      brand: {
        score: Math.round(brandNext),
        trend: computeBrandTrend(prevBrand, brandNext),
        lastUpdatedWeek: nextWeeksLived,
      },
    };
    out.lifetimeStats.peakBrandScore = Math.max(out.lifetimeStats.peakBrandScore, Math.round(brandNext));

    // 3. Scandal progression
    if (o.activeScandal) {
      const apologyBonus = o.activeScandal.resolutionMethod === 'apology' ? 15 : 0;
      const sev = Math.max(0, o.activeScandal.severity - (10 + apologyBonus));
      const wr = Math.max(0, o.activeScandal.weeksRemaining - 1);
      if (sev <= 0 || wr <= 0) {
        out.lifetimeStats.totalScandalsSurvived += 1;
        // Fill the ledger with REAL values (previously hardcoded 0 → the UI
        // showed a permanent "−$0 lost" line). Reconstruct the drag over the
        // scandal's active life from its initial (base) severity, weeks active,
        // and current company income (deterministic - no persisted accumulator,
        // since adding a field to HustleActiveScandal would touch shared types).
        const initialSeverity = SCANDAL_BASE_SEVERITY[o.activeScandal.kind] ?? o.activeScandal.severity;
        const weeksActive = Math.max(1, nextWeeksLived - o.activeScandal.startedWeek);
        const totalRevenueLoss = estimateScandalRevenueLoss(
          initialSeverity,
          weeksActive,
          company.weeklyIncome ?? 0,
        );
        o = pushNotif({
          ...o,
          // R3-E: cap to 25 per company - was unbounded; multiplied by N
          // companies that's significant save bloat over many lives.
          scandalHistory: [
            ...o.scandalHistory,
            {
              id: o.activeScandal.id,
              kind: o.activeScandal.kind,
              severity: o.activeScandal.severity,
              survivedAtWeek: nextWeeksLived,
              finalReputationLoss: scandalReputationLoss(initialSeverity),
              totalRevenueLoss,
              resolutionMethod: o.activeScandal.resolutionMethod ?? 'natural',
            },
          ].slice(-25),
          activeScandal: null,
        }, 'Scandal resolved', 'scandal_alert', nextWeeksLived);
      } else {
        const newRevenueDrag = scandalRevenueDrag(sev);
        o = {
          ...o,
          activeScandal: {
            ...o.activeScandal,
            severity: sev,
            weeksRemaining: wr,
            revenueDragPercent: newRevenueDrag,
          },
        };
        // Apply drag to weekly revenue
        const drag = Math.floor((company.weeklyIncome ?? 0) * newRevenueDrag);
        if (drag > 0) {
          cashDelta -= drag;
          cashReasons.push(`Scandal drag on ${company.name}`);
        }
      }
    }

    // 3b. Organic scandal roll - brand/size-gated, cooldown-respecting,
    // deterministic (seeded by company id + week). Only when no scandal is
    // active. Activates the fully-built resolution UI/ledger that previously
    // had no trigger (triggerScandal had zero callers).
    if (!o.activeScandal) {
      // C-2: a family business's Reputation moves its scandal odds. Passed
      // through rather than looked up inside the roll so `hustleLogic` stays a
      // pure function of its arguments. `undefined` for a company that is not
      // a family business, which the multiplier reads as neutral.
      const familyRep = state.familyBusinesses?.find(fb => fb?.companyId === company.id)?.reputation;
      const rolled = rollScandalForWeek(company, o, nextWeeksLived, familyRep);
      if (rolled) {
        o = pushNotif(
          {
            ...o,
            activeScandal: rolled,
            brand: {
              score: Math.max(0, o.brand.score - 15),
              trend: 'declining',
              lastUpdatedWeek: nextWeeksLived,
            },
          },
          `⚠ ${rolled.headline}`,
          'scandal_alert',
          nextWeeksLived,
        );
      }
    }

    // 4. Named hires - morale & performance drift
    if (o.hiringPipeline.namedHires.length > 0) {
      const updatedHires = o.hiringPipeline.namedHires.map((h) => {
        const delta = namedHireMoraleDelta(h, o, h.salary);
        const morale = Math.max(0, Math.min(100, h.morale + delta));
        const performance = Math.max(0, Math.min(100, h.performance + (morale > 70 ? 1 : morale < 30 ? -2 : 0)));
        return { ...h, morale, performance };
      });
      // MONEY-SAFETY FIX: charge each named hire's weekly salary. Previously
      // `salary` was only read for morale fairness - accepted hires raised
      // `weeklyIncome` (via the headcount multiplier) but their payroll was never
      // deducted, so every hire was free money. Deduct it through the same
      // cash-delta path other company costs use (mirrors scandal drag / campaign
      // spend) so hires are an INVESTMENT (income multiplier vs salary cost).
      const totalSalary = companyWeeklyPayroll(company, updatedHires).namedPayroll;
      if (totalSalary > 0 && !furloughed) {
        cashDelta -= totalSalary;
        availableCash -= totalSalary;
        cashReasons.push(`${company.name} named-hire payroll`);
      }
      o = {
        ...o,
        hiringPipeline: { ...o.hiringPipeline, namedHires: updatedHires, weeksSinceLastHire: o.hiringPipeline.weeksSinceLastHire + 1 },
      };
    }

    // 5. Market share recompute
    o = { ...o, marketSharePercent: recomputeMarketShare(o) };
    out.lifetimeStats.peakMarketShare = Math.max(out.lifetimeStats.peakMarketShare, o.marketSharePercent);

    // 6. Acquisition offer generation - every 8 weeks, gated by company size
    if (nextWeeksLived % 8 === 0 && o.pendingAcquisitions.length < 2) {
      const offer = generateAcquisitionOffer(company, nextWeeksLived);
      if (offer) {
        o = pushNotif(
          { ...o, pendingAcquisitions: [...o.pendingAcquisitions, offer] },
          `New acquisition target: ${offer.targetName} for $${offer.askingPrice.toLocaleString('en-US')}`,
          'acquisition_offer',
          nextWeeksLived,
        );
      }
    }
    // Drop expired offers
    o = {
      ...o,
      pendingAcquisitions: o.pendingAcquisitions.filter((a) => a.expiresWeek > nextWeeksLived),
    };

    // 7. IPO quarterly earnings - every 12 weeks since listing
    if (o.ipo.status === 'public' && o.ipo.lastEarningsWeek != null) {
      if (nextWeeksLived - o.ipo.lastEarningsWeek >= 12) {
        const { newPrice, beat } = computeQuarterlyEarningsMovement(o, o.ipo.sharePrice);
        const earnings = {
          week: nextWeeksLived,
          revenue: (company.weeklyIncome ?? 0) * 12,
          beat,
        };
        o = pushNotif(
          {
            ...o,
            ipo: {
              ...o.ipo,
              sharePrice: newPrice,
              lastEarningsWeek: nextWeeksLived,
              recentEarnings: [...o.ipo.recentEarnings.slice(-3), earnings],
            },
          },
          `${company.name} Q earnings: ${beat ? '✅ Beat' : '⚠️ Missed'} - share price $${newPrice}`,
          'earnings_report',
          nextWeeksLived,
        );
        out.lifetimeStats.peakSharePrice = Math.max(out.lifetimeStats.peakSharePrice, newPrice);
      }
    }

    out.companies[company.id] = o;
  }

  return { hustleApp: out, cashDelta, cashReasons };
}
