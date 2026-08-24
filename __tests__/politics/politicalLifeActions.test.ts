/**
 * The Political Life actions, at the layer where money actually moves.
 *
 * `lib/politics/__tests__/politicalLife.test.ts` pins the pure math. This pins
 * the part that has historically gone wrong in this repo: the gate and the
 * grant have to happen inside the SAME `setGameState` updater, re-checked
 * against `prev`, or a double-tap in one React batch pays once and grants twice
 * (CLAUDE.md §4.4 — "the single most repeated bug class in this repo").
 *
 * Each case therefore runs the captured updater TWICE against the same `prev`
 * chain, which is exactly what React does with two dispatches in one batch.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  availableAppointments,
  embezzleCampaignFunds,
  joinParty,
  resignAppointment,
  retireFromPolitics,
  runForOffice,
  takeAppointment,
} from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { getPoliticalPensionWeekly, getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { findAppointment } from '@/lib/politics/appointments';
import { MAX_WEEKLY_SKIM_FRACTION } from '@/lib/politics/embezzlement';
import {
  resolveEmbezzle,
  resolveJoinParty,
  resolveResignAppointment,
  resolveRetirement,
  resolveTakeAppointment,
} from '@/lib/politics/lifeOperations';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/** Collects EVERY functional updater a call dispatches, in order. */
function captureUpdaters() {
  const updaters: ((prev: GameState) => GameState)[] = [];
  const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updaters.push(u as (prev: GameState) => GameState);
  };
  return {
    setGameState,
    /** Apply everything captured so far, in order, like a committed batch. */
    commit(prev: GameState): GameState {
      return updaters.reduce((acc, u) => u(acc), prev);
    },
    count: () => updaters.length,
  };
}

function politician(over: Partial<GameState['politics']> = {}, state: Partial<GameState> = {}): GameState {
  const base = createTestGameState({
    weeksLived: 3_000,
    stats: { money: 100_000, reputation: 80 },
    ...state,
  } as never);
  return {
    ...base,
    currentJob: 'political',
    careers: [{ ...POLITICAL_CAREER, level: 5, accepted: true, applied: true, startedWeeksLived: 2_000 }],
    politics: {
      careerLevel: 6,
      approvalRating: 60,
      policyInfluence: 10,
      electionsWon: 3,
      policiesEnacted: [],
      lobbyists: [],
      alliances: [],
      campaignFunds: 400_000,
      ...over,
    },
  };
}

// ---------------------------------------------------------------------------
// Embezzlement
// ---------------------------------------------------------------------------

describe('embezzling campaign funds', () => {
  it('moves money out of the war chest and into cash, once', () => {
    const prev = politician();
    const cap = captureUpdaters();
    const res = embezzleCampaignFunds(prev, cap.setGameState, 50_000);
    expect(res.success).toBe(true);

    const after = cap.commit(prev);
    expect(after.stats.money).toBe(150_000);
    expect(after.politics!.campaignFunds).toBe(350_000);
    expect(after.politics!.embezzlement!.totalUSD).toBe(50_000);
    expect(after.politics!.embezzlement!.heat).toBeGreaterThan(0);
    expect(after.politics!.embezzlement!.lastWeek).toBe(3_000);
  });

  it('a same-batch double tap pays ONCE (§4.4)', () => {
    const prev = politician();
    const cap = captureUpdaters();
    // Two dispatches, both computed from the SAME pre-batch snapshot — the
    // shape a double tap takes before React re-renders.
    embezzleCampaignFunds(prev, cap.setGameState, 50_000);
    embezzleCampaignFunds(prev, cap.setGameState, 50_000);
    expect(cap.count()).toBe(2);

    const after = cap.commit(prev);
    // The second updater re-reads `lastWeek` off `prev` and returns it unchanged.
    expect(after.stats.money).toBe(150_000);
    expect(after.politics!.campaignFunds).toBe(350_000);
    expect(after.politics!.embezzlement!.totalUSD).toBe(50_000);
  });

  it('refuses a second dip in the same game week, and allows it the next', () => {
    const prev = politician();
    const first = captureUpdaters();
    embezzleCampaignFunds(prev, first.setGameState, 50_000);
    const afterFirst = first.commit(prev);

    expect(embezzleCampaignFunds(afterFirst, () => {}, 50_000).success).toBe(false);

    const nextWeek = { ...afterFirst, weeksLived: 3_001 };
    const second = captureUpdaters();
    expect(embezzleCampaignFunds(nextWeek, second.setGameState, 50_000).success).toBe(true);
    expect(second.commit(nextWeek).stats.money).toBe(200_000);
  });

  it('never takes more than the weekly allowance, however it is asked', () => {
    const prev = politician();
    const allowance = 400_000 * MAX_WEEKLY_SKIM_FRACTION;
    expect(embezzleCampaignFunds(prev, () => {}, allowance + 1).success).toBe(false);
    expect(embezzleCampaignFunds(prev, () => {}, allowance).success).toBe(true);
  });

  it('cannot mint money out of an empty war chest', () => {
    const broke = politician({ campaignFunds: 0 });
    const cap = captureUpdaters();
    expect(embezzleCampaignFunds(broke, cap.setGameState, 50_000).success).toBe(false);
    expect(cap.commit(broke).stats.money).toBe(100_000);
  });

  it('never drives the war chest or the PAC negative', () => {
    const prev = politician({
      campaignFunds: 10_000,
      pac: { cleanUSD: 30_000, dirtyUSD: 999_999, lifetimeDirtyUSD: 999_999 },
    });
    const cap = captureUpdaters();
    // Allowance is 25% of (10k + 30k) = 10k, drawn campaign-first.
    expect(embezzleCampaignFunds(prev, cap.setGameState, 10_000).success).toBe(true);
    const after = cap.commit(prev);
    expect(after.politics!.campaignFunds).toBe(0);
    expect(after.politics!.pac!.cleanUSD).toBe(30_000);
    // The dirty balance is never touched — it is not part of the pot.
    expect(after.politics!.pac!.dirtyUSD).toBe(999_999);
  });

  it('is a no-op for a player with no politics at all', () => {
    const civilian = createTestGameState({ weeksLived: 100 });
    const cap = captureUpdaters();
    expect(embezzleCampaignFunds(civilian, cap.setGameState, 50_000).success).toBe(false);
    expect(cap.commit(civilian).stats.money).toBe(civilian.stats.money);
  });
});

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

describe('appointed positions', () => {
  it('pays its salary through the ONE political income path', () => {
    const prev = politician({ careerLevel: 0 }, {});
    const outOfOffice: GameState = {
      ...prev,
      careers: prev.careers.map(c => ({ ...c, accepted: false, level: 4 })),
      politics: { ...prev.politics!, careerLevel: 0, electionsWon: 3 },
    };
    const cap = captureUpdaters();
    const res = takeAppointment(outOfOffice, cap.setGameState, 'ambassador');
    expect(res.success).toBe(true);

    const after = cap.commit(outOfOffice);
    expect(after.politics!.appointment).toEqual({ id: 'ambassador', startedWeek: 3_000 });
    expect(getPoliticalWeeklySalary(after)).toBe(findAppointment('ambassador')!.weeklySalary);
  });

  it('adds to the office salary rather than replacing it', () => {
    const prev = politician();
    const office = getPoliticalWeeklySalary(prev);
    expect(office).toBeGreaterThan(0);

    const cap = captureUpdaters();
    takeAppointment(prev, cap.setGameState, 'ambassador');
    const after = cap.commit(prev);
    expect(getPoliticalWeeklySalary(after)).toBe(office + findAppointment('ambassador')!.weeklySalary);
  });

  it('charges the reputation cost ONCE on a same-batch double tap', () => {
    const prev = politician({ careerLevel: 0 });
    const outOfOffice: GameState = {
      ...prev,
      careers: prev.careers.map(c => ({ ...c, accepted: false, level: 4 })),
      politics: { ...prev.politics!, careerLevel: 0 },
    };
    const cap = captureUpdaters();
    takeAppointment(outOfOffice, cap.setGameState, 'lobbyist');
    takeAppointment(outOfOffice, cap.setGameState, 'lobbyist');

    const after = cap.commit(outOfOffice);
    const cost = findAppointment('lobbyist')!.reputationOnTake;
    expect(after.stats.reputation).toBe(80 + cost);
  });

  it('bars a conflicted post from running for office until it is resigned', () => {
    const prev = politician({ careerLevel: 0 });
    const exGovernor: GameState = {
      ...prev,
      careers: prev.careers.map(c => ({ ...c, accepted: false, level: 4 })),
      politics: { ...prev.politics!, careerLevel: 0, appointment: { id: 'lobbyist', startedWeek: 2_900 } },
    };
    const blocked = runForOffice(exGovernor, () => {}, 'senator', { updateMoney });
    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/cannot run for office while serving as Lobbyist/);

    const cap = captureUpdaters();
    expect(resignAppointment(exGovernor, cap.setGameState).success).toBe(true);
    expect(cap.commit(exGovernor).politics!.appointment).toBeUndefined();
  });

  it('cannot slip past the office bar by taking a conflicted post in the SAME batch', () => {
    // The bar is a designed constraint, so it is a §4.4 gate→grant hole if it is
    // only enforced against the render snapshot. An ex-official with NO
    // appointment in that snapshot taps "take Lobbyist" and "run for office" in
    // one React batch: the outer guard on the run sees a clear ballot, and the
    // appointment updater flushes first. The election updater must re-check the
    // bar against `prev`, or the batch ends with the player holding a
    // ballot-barred post AND sitting in office (both salaries streaming).
    const prev = politician({ careerLevel: 0, appointment: undefined });
    const exOfficial: GameState = {
      ...prev,
      // Clear council_member's outer gates (minAge 25, the Business Degree
      // education requirement) so the run actually reaches its win updater
      // rather than bailing early — otherwise the bar is never exercised.
      date: { ...prev.date, age: 55 },
      educations: [...(prev.educations ?? []), { id: 'business_degree', completed: true } as never],
      careers: prev.careers.map(c => ({ ...c, accepted: false, level: 4 })),
      politics: { ...prev.politics!, careerLevel: 0, electionsWon: 3, appointment: undefined },
    };

    const roll = jest.spyOn(Math, 'random').mockReturnValue(0); // force a win
    try {
      const cap = captureUpdaters();
      // Take the barring post FIRST, then run — both off the same pre-batch snapshot.
      expect(takeAppointment(exOfficial, cap.setGameState, 'lobbyist').success).toBe(true);
      // Proves the run cleared every outer gate and reached its win updater —
      // otherwise this test would pass trivially with the bar never exercised.
      expect(runForOffice(exOfficial, cap.setGameState, 'council_member', { updateMoney }).success).toBe(true);

      const after = cap.commit(exOfficial);
      // The bar holds: they keep the lobbyist post and never took the seat…
      expect(after.politics!.appointment).toEqual({ id: 'lobbyist', startedWeek: 3_000 });
      expect(after.politics!.careerLevel).toBe(0);
      expect(after.careers.find(c => c.id === 'political')!.accepted).toBe(false);
      // …and were not even charged the campaign cost (the loss branch refuses too).
      expect(after.stats.money).toBe(exOfficial.stats.money);
    } finally {
      roll.mockRestore();
    }
  });

  it('lists the whole catalog with a reason for every refusal', () => {
    const rookie = createTestGameState({ stats: { reputation: 5 } });
    const offers = availableAppointments(rookie);
    expect(offers).toHaveLength(6);
    // Nothing is available to someone who has never held office…
    expect(offers.every(o => o.blocker !== null)).toBe(true);
    // …and every refusal explains itself rather than greying a row out.
    expect(offers.every(o => typeof o.blocker === 'string' && o.blocker.length > 10)).toBe(true);
  });

  it('refuses an unknown id without dispatching anything', () => {
    const prev = politician();
    const cap = captureUpdaters();
    expect(takeAppointment(prev, cap.setGameState, 'chancellor').success).toBe(false);
    expect(cap.count()).toBe(0);
  });

  it('cannot be farmed for reputation by alternating two posts', () => {
    // Reputation from a post lasts only while it is held: swapping gives the
    // old bump back before granting the new one. Before this rule, alternating
    // ambassador (+5) and cabinet secretary (+8) with no cooldown took a
    // Governor from 70 to the 100 clamp in six taps — and reputation feeds the
    // election roll and its up-to-$5M rewards.
    let state = politician({ party: 'democratic', partySupport: 60 });
    const rep0 = state.stats.reputation;

    for (let i = 0; i < 6; i++) {
      const target = i % 2 === 0 ? 'ambassador' : 'cabinet_secretary';
      const cap = captureUpdaters();
      expect(takeAppointment(state, cap.setGameState, target).success).toBe(true);
      state = cap.commit(state);
      // Invariant after every swap: baseline + the CURRENT post's bump, never
      // an accumulating sum.
      expect(state.stats.reputation).toBe(
        rep0 + findAppointment(target)!.reputationOnTake,
      );
    }
  });

  it('resign-and-retake nets zero reputation', () => {
    const prev = politician({ careerLevel: 0 });
    const outOfOffice: GameState = {
      ...prev,
      careers: prev.careers.map(c => ({ ...c, accepted: false, level: 4 })),
      politics: { ...prev.politics!, careerLevel: 0 },
    };
    const rep0 = outOfOffice.stats.reputation;

    let state = outOfOffice;
    for (let i = 0; i < 3; i++) {
      const take = captureUpdaters();
      expect(takeAppointment(state, take.setGameState, 'ambassador').success).toBe(true);
      state = take.commit(state);
      const resign = captureUpdaters();
      expect(resignAppointment(state, resign.setGameState).success).toBe(true);
      state = resign.commit(state);
    }
    expect(state.stats.reputation).toBe(rep0);
  });
});

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

describe('retiring from office', () => {
  it('records the title while it is still true, and starts the pension', () => {
    const prev = politician();
    const cap = captureUpdaters();
    const res = retireFromPolitics(prev, cap.setGameState);
    expect(res.success).toBe(true);

    const after = cap.commit(prev);
    expect(after.politics!.retirement!.title).toBe('President');
    expect(after.politics!.careerLevel).toBe(0);
    expect(after.currentJob).toBeUndefined();
    expect(after.careers.find(c => c.id === 'political')!.accepted).toBe(false);

    // The seat stops paying; the pension starts.
    expect(getPoliticalWeeklySalary(after)).toBe(0);
    expect(getPoliticalPensionWeekly(after)).toBe(after.politics!.retirement!.weeklyPension);
    expect(getPoliticalPensionWeekly(after)).toBeGreaterThan(0);
  });

  it('settles office-scoped state on the way out (scandals + lobbyists)', () => {
    // Retirement is the THIRD office-exit path. Voted-out and scandal
    // forced-resignation both run `applyOfficeExit`; this one did not, so a
    // scandal live at the moment of retirement froze `active: true` forever (the
    // tick early-returns to `tickOutOfOffice` for citizens and never processes
    // it again) and hired lobbyists kept their retainer + contact card + policy
    // influence for the rest of the life — the exact BBQ report class.
    const prev = politician({
      policyInfluence: 30,
      scandals: [{
        id: 's1', category: 'corruption', severity: 'minor',
        headline: 'Pay-to-play scheme uncovered', startedWeek: 2_900,
        weeksRemaining: 3, approvalLost: 3, suppressedUSD: 0, active: true,
      }],
      lobbyists: [{ id: 'l1', name: 'K Street', cost: 500, influence: 10, active: true }],
    } as never);
    const cap = captureUpdaters();
    expect(retireFromPolitics(prev, cap.setGameState).success).toBe(true);
    const after = cap.commit(prev);

    // The scandal leaves the news cycle, kept in history as survived.
    expect(after.politics!.scandals!.every(s => !s.active)).toBe(true);
    expect(after.politics!.scandals!.find(s => s.id === 's1')!.resolution).toBe('survived');
    // The lobbyist is deactivated and its influence stripped from the total.
    expect(after.politics!.lobbyists!.every(l => !l.active)).toBe(true);
    expect(after.politics!.policyInfluence).toBe(20);
  });

  it('a same-batch double tap cannot stamp a second, wrongly-titled record', () => {
    // The second updater runs at careerLevel 0, where the title would resolve
    // to whatever rank 0 is called — the exact bug v42 exists to prevent.
    const prev = politician();
    const cap = captureUpdaters();
    retireFromPolitics(prev, cap.setGameState);
    retireFromPolitics(prev, cap.setGameState);

    const after = cap.commit(prev);
    expect(after.politics!.retirement!.title).toBe('President');
    expect(after.politics!.retirement!.officeLevel).toBe(6);
  });

  it('refuses a citizen, and a first-termer who has not served a year', () => {
    const civilian = createTestGameState({ weeksLived: 100 });
    expect(retireFromPolitics(civilian, () => {}).success).toBe(false);

    const fresh = politician({ electionsWon: 1 });
    const justElected: GameState = {
      ...fresh,
      careers: fresh.careers.map(c => ({ ...c, startedWeeksLived: 2_990, progress: 0 })),
    };
    const res = retireFromPolitics(justElected, () => {});
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/full year/);

    const served: GameState = {
      ...fresh,
      careers: fresh.careers.map(c => ({ ...c, startedWeeksLived: 3_000 - WEEKS_PER_YEAR, progress: 0 })),
    };
    expect(retireFromPolitics(served, () => {}).success).toBe(true);
  });

  it('the pension does not count as work toward a bigger pension', () => {
    // `getPoliticalWeeklySalary` is what the lifetime-statistics tick counts as
    // political WORK. A pension inside it would compound on itself.
    const prev = politician();
    const cap = captureUpdaters();
    retireFromPolitics(prev, cap.setGameState);
    const retired = cap.commit(prev);
    expect(getPoliticalWeeklySalary(retired)).toBe(0);
  });

  it('winning office again SUSPENDS the pension — no double draw', () => {
    // A retired President who takes a council seat must not draw the $6,000/wk
    // maximum pension ON TOP of the new salary, indefinitely, from a seat they
    // can defend forever. The record survives; the payment pauses.
    const prev = politician();
    const cap = captureUpdaters();
    retireFromPolitics(prev, cap.setGameState);
    const retired = cap.commit(prev);
    expect(getPoliticalPensionWeekly(retired)).toBeGreaterThan(0);

    const backInOffice: GameState = {
      ...retired,
      careers: retired.careers.map(c =>
        c.id === 'political' ? { ...c, accepted: true, level: 0 } : c),
      politics: { ...retired.politics!, careerLevel: 1 },
    };
    expect(getPoliticalPensionWeekly(backInOffice)).toBe(0);
    expect(getPoliticalWeeklySalary(backInOffice)).toBeGreaterThan(0);

    // …and resumes when they leave office again.
    const outAgain: GameState = {
      ...backInOffice,
      politics: { ...backInOffice.politics!, careerLevel: 0 },
    };
    expect(getPoliticalPensionWeekly(outAgain)).toBe(retired.politics!.retirement!.weeklyPension);
  });
});

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

describe('party membership', () => {
  it('is free to join and starts you at the baseline', () => {
    const prev = politician();
    const cap = captureUpdaters();
    expect(joinParty(prev, cap.setGameState, 'democratic').success).toBe(true);
    const after = cap.commit(prev);
    expect(after.politics!.party).toBe('democratic');
    expect(after.politics!.partySupport).toBe(50);
    expect(after.politics!.approvalRating).toBe(65);
  });

  it('costs approval and standing to cross the floor', () => {
    const member = politician({ party: 'democratic', partySupport: 90 });
    const cap = captureUpdaters();
    const res = joinParty(member, cap.setGameState, 'republican');
    expect(res.success).toBe(true);

    const after = cap.commit(member);
    expect(after.politics!.party).toBe('republican');
    expect(after.politics!.partySupport).toBeLessThan(90);
    expect(after.politics!.approvalRating).toBeLessThan(60);
    expect(after.politics!.partySwitches).toBe(1);
  });

  it('a same-batch double tap defects ONCE', () => {
    const member = politician({ party: 'democratic', partySupport: 90 });
    const cap = captureUpdaters();
    joinParty(member, cap.setGameState, 'republican');
    joinParty(member, cap.setGameState, 'republican');

    const after = cap.commit(member);
    expect(after.politics!.partySwitches).toBe(1);
  });

  it('refuses re-joining the party you are already in', () => {
    const member = politician({ party: 'democratic', partySupport: 50 });
    const cap = captureUpdaters();
    expect(joinParty(member, cap.setGameState, 'democratic').success).toBe(false);
    expect(cap.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The resolver contract
// ---------------------------------------------------------------------------

describe('the pure resolvers behind the actions', () => {
  it('return the SAME state reference when they refuse', () => {
    // A refusal must not churn state. If it returned a fresh object every time,
    // `setGameState(prev => resolve(prev).next)` would re-render the whole tree
    // on every rejected tap and defeat every memo downstream.
    const civilian = createTestGameState({ weeksLived: 100 });
    for (const resolve of [
      () => resolveEmbezzle(civilian, 50_000),
      () => resolveRetirement(civilian),
      () => resolveResignAppointment(civilian),
      () => resolveTakeAppointment(civilian, 'ambassador'),
      () => resolveTakeAppointment(civilian, 'no_such_post'),
    ]) {
      const r = resolve();
      expect(r.ok).toBe(false);
      expect(r.next).toBe(civilian);
      expect(r.message.length).toBeGreaterThan(10);
    }
  });

  it('are idempotent under repeated application — the same-batch double tap', () => {
    // Applying a resolver to its own output must refuse the second time. This
    // is the property the whole preview/commit shape rests on: two dispatches
    // in one React batch are exactly `resolve(resolve(prev).next)`.
    const prev = politician();
    for (const [label, run] of [
      ['embezzle', (s: GameState) => resolveEmbezzle(s, 50_000)],
      ['retire', (s: GameState) => resolveRetirement(s)],
      ['party', (s: GameState) => resolveJoinParty(s, 'democratic')],
      ['appointment', (s: GameState) => resolveTakeAppointment(s, 'ambassador')],
    ] as const) {
      const first = run(prev);
      expect(`${label} first: ${first.ok}`).toBe(`${label} first: true`);
      const second = run(first.next);
      expect(`${label} second: ${second.ok}`).toBe(`${label} second: false`);
      expect(second.next).toBe(first.next);
    }
  });

  it('never INTRODUCE a non-finite balance from a corrupt war chest', () => {
    // The honest property. A resolver that refuses returns the input untouched,
    // so a save that already carries `campaignFunds: NaN` still carries it
    // afterwards — that is repair's job, not this action's. What must never
    // happen is a resolver ACCEPTING a corrupt pot and paying out against it,
    // which would move the NaN into `stats.money` and poison every later week.
    for (const funds of [NaN, Infinity, -1_000_000]) {
      const broken = politician({ campaignFunds: funds as number });
      const r = resolveEmbezzle(broken, 50_000);
      if (!r.ok) {
        expect(`${funds}: refused, untouched`).toBe(`${funds}: refused, untouched`);
        expect(r.next).toBe(broken);
        continue;
      }
      const money = r.next.stats.money;
      const chest = r.next.politics!.campaignFunds;
      expect(`${funds}: ${Number.isFinite(money) && money >= 0 && Number.isFinite(chest) && chest >= 0}`)
        .toBe(`${funds}: true`);
    }
  });

  it('and cash is never left non-finite by a payout that DOES go through', () => {
    // `Infinity` in the chest is the dangerous one: it passes a naive `> 0`
    // check. The allowance is derived with Math.floor, so it must not survive.
    const infinite = politician({ campaignFunds: Infinity as number });
    const r = resolveEmbezzle(infinite, 50_000);
    expect(Number.isFinite(r.next.stats.money)).toBe(true);
  });
});
