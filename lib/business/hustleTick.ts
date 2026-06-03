/**
 * Hustle weekly tick — processes business overlay each game week.
 *
 * Called once per nextWeek() advance from GameActionsContext.tsx. Pure
 * function — no React, no side effects on input.
 *
 * Per-company order of operations (all use `nextWeeksLived`):
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
  scandalRevenueDrag,
} from './hustleLogic';

const NOTIFICATION_CAP = 80;

function pushNotif(o: HustleCompanyOverlay, text: string, type: any, weeksLived: number): HustleCompanyOverlay {
  return {
    ...o,
    notifications: [
      {
        id: `tick-${o.companyId}-${weeksLived}-${o.notifications.length}`,
        type,
        text,
        timestamp: Date.now(),
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

  const playerCompanies = state.companies ?? [];

  for (const company of playerCompanies) {
    if (!company || typeof company.id !== 'string') continue;
    const prevOverlay = out.companies[company.id];
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
      // Pay spend
      cashDelta -= camp.spendPerWeek;
      cashReasons.push(`${camp.kind} campaign weekly spend`);
      // Add ROI-driven revenue lift
      const lift = Math.floor(camp.spendPerWeek * (camp.projectedROI - 1));
      if (lift > 0) {
        cashDelta += lift;
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
        o = pushNotif({
          ...o,
          // R3-E: cap to 25 per company — was unbounded; multiplied by N
          // companies that's significant save bloat over many lives.
          scandalHistory: [
            ...o.scandalHistory,
            {
              id: o.activeScandal.id,
              kind: o.activeScandal.kind,
              severity: o.activeScandal.severity,
              survivedAtWeek: nextWeeksLived,
              finalReputationLoss: 0,
              totalRevenueLoss: 0,
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

    // 4. Named hires — morale & performance drift
    if (o.hiringPipeline.namedHires.length > 0) {
      const updatedHires = o.hiringPipeline.namedHires.map((h) => {
        const delta = namedHireMoraleDelta(h, o, h.salary);
        const morale = Math.max(0, Math.min(100, h.morale + delta));
        const performance = Math.max(0, Math.min(100, h.performance + (morale > 70 ? 1 : morale < 30 ? -2 : 0)));
        return { ...h, morale, performance };
      });
      o = {
        ...o,
        hiringPipeline: { ...o.hiringPipeline, namedHires: updatedHires, weeksSinceLastHire: o.hiringPipeline.weeksSinceLastHire + 1 },
      };
    }

    // 5. Market share recompute
    o = { ...o, marketSharePercent: recomputeMarketShare(o) };
    out.lifetimeStats.peakMarketShare = Math.max(out.lifetimeStats.peakMarketShare, o.marketSharePercent);

    // 6. Acquisition offer generation — every 8 weeks, gated by company size
    if (nextWeeksLived % 8 === 0 && o.pendingAcquisitions.length < 2) {
      const offer = generateAcquisitionOffer(company, nextWeeksLived);
      if (offer) {
        o = pushNotif(
          { ...o, pendingAcquisitions: [...o.pendingAcquisitions, offer] },
          `New acquisition target: ${offer.targetName} for $${offer.askingPrice.toLocaleString()}`,
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

    // 7. IPO quarterly earnings — every 12 weeks since listing
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
          `${company.name} Q earnings: ${beat ? '✅ Beat' : '⚠️ Missed'} — share price $${newPrice}`,
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
