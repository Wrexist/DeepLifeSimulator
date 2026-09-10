/**
 * GoalsCard row builder — the consolidation of the home screen's five
 * checklist cards (2026-09-01 UI audit, blueprint §2 item 2 / §10).
 *
 * `buildGoalRows` is the pure priority ladder the card slices its top three
 * from: actionable recommendation → chosen ambition → chapter, with secondary
 * challenges and events available in the full details.
 */
import { buildGoalRows } from '@/components/GoalsCard';
import { getWeeklyChallengeIdForWeek } from '@/lib/challenges/weeklyChallenges';
import { createTestGameState } from '../helpers/createTestGameState';
import type { ResolvedLiveEvent } from '@/lib/liveops/types';

/** Just enough of a resolved event for the builder — it reads state,
 *  definition.{id,title,rewards} and objectives only. */
function fakeEvent(
  state: ResolvedLiveEvent['state'],
  objectives: { met: boolean }[] = [{ met: false }],
): ResolvedLiveEvent {
  return {
    state,
    definition: {
      id: `evt_${state}`,
      title: `Event ${state}`,
      rewards: [{ kind: 'gems', amount: 200 }],
    },
    objectives: objectives.map((o, i) => ({
      objectiveId: `obj_${i}`,
      label: `Objective ${i}`,
      current: o.met ? 1 : 0,
      target: 1,
      met: o.met,
    })),
  } as unknown as ResolvedLiveEvent;
}

describe('buildGoalRows', () => {
  it('returns nothing for a missing state', () => {
    expect(buildGoalRows(null, [])).toEqual([]);
    expect(buildGoalRows(undefined, [])).toEqual([]);
  });

  it('leads with an actionable recommendation followed by chapter progress', () => {
    const rows = buildGoalRows(createTestGameState(), []);
    expect(rows.length).toBeGreaterThan(1);
    // A fresh life sits in chapter 1 with unfinished goals.
    expect(rows[0].system).toBe('catalogue');
    expect(rows[1].system).toBe('chapter');
    expect(rows[0].route).toBeTruthy();
    for (const row of rows) {
      if (row.system !== 'catalogue') expect(row.route).toBeUndefined();
    }
  });

  it('shows a single pending application as awaiting review, not one of three applications', () => {
    const state = createTestGameState({ currentJob: undefined });
    const pending = { ...state, careers: [{ ...state.careers[0], applied: true, accepted: false }] };
    const row = buildGoalRows(pending, []).find(r => r.id === 'catalogue:now_get_hired');
    expect(row?.fraction).toBe('Application under review');
    expect(row?.progress).toBe(0.5);
  });

  it('keeps the selected ambition visible even when challenges and events compete', () => {
    const state = createTestGameState({ ambitionId: 'business_empire' });
    const rows = buildGoalRows(state, [fakeEvent('active')]);
    expect(rows.slice(0, 3).map(r => r.system)).toEqual(['catalogue', 'ambition', 'chapter']);
    expect(rows[1].title).toBeTruthy();
  });

  it('the routed recommendation survives a full feed (chapter + challenge + live event)', () => {
    const state = createTestGameState();
    const weeksLived = state.weeksLived ?? 0;
    const full = {
      ...state,
      stats: { ...state.stats, money: 5_000 },
      weeklyChallenge: {
        challengeId: getWeeklyChallengeIdForWeek(weeksLived),
        startedAt: Date.now(),
        startedWeek: weeksLived,
        progress: [],
        completed: false,
        rewardClaimed: false,
      },
    };
    const top3 = buildGoalRows(full, [fakeEvent('active')]).slice(0, 3);
    expect(top3.some((r) => r.system === 'catalogue' && r.route)).toBe(true);
  });

  it('slots the weekly challenge after the catalogue row once the mid-game is open', () => {
    const state = createTestGameState();
    const weeksLived = state.weeksLived ?? 0;
    const withChallenge = {
      ...state,
      // Tier 2 (wealth ≥ $2,000): the padlocks the challenges depend on are open.
      stats: { ...state.stats, money: 5_000 },
      weeklyChallenge: {
        challengeId: getWeeklyChallengeIdForWeek(weeksLived),
        startedAt: Date.now(),
        startedWeek: weeksLived,
        progress: [],
        completed: false,
        rewardClaimed: false,
      },
    };
    const systems = buildGoalRows(withChallenge, []).map((r) => r.system);
    const chapter = systems.indexOf('chapter');
    const challenge = systems.indexOf('challenge');
    const catalogue = systems.indexOf('catalogue');
    expect(chapter).toBe(1);
    expect(catalogue).toBe(0);
    expect(challenge).toBeGreaterThan(catalogue);
  });

  it('hides the weekly challenge from a life that has not opened the mid-game (tier < 2)', () => {
    // Every weekly challenge is a mid-game bundle (properties, educations,
    // pets, followers, $10k savings). Measured on a fresh quick start the row
    // read "Have 80+ fitness · 0/4 objectives" as the LEAD goal at fitness 10.
    const state = createTestGameState();
    const weeksLived = state.weeksLived ?? 0;
    const fresh = {
      ...state,
      currentJob: undefined,
      stats: { ...state.stats, money: 500 },
      bankSavings: 0,
      weeklyChallenge: {
        challengeId: getWeeklyChallengeIdForWeek(weeksLived),
        startedAt: Date.now(),
        startedWeek: weeksLived,
        progress: [],
        completed: false,
        rewardClaimed: false,
      },
    };
    expect(buildGoalRows(fresh, []).some((r) => r.system === 'challenge')).toBe(false);
  });

  it('a money objective on a live event reads as money, not as "0/3 done"', () => {
    const event = {
      ...fakeEvent('active'),
      objectives: [
        { objectiveId: 'cash', label: 'Hold $5,000 in cash', current: 1_500, target: 5_000, met: false },
        { objectiveId: 'o2', label: 'Objective 2', current: 0, target: 1, met: false },
      ],
    } as unknown as ResolvedLiveEvent;
    const live = buildGoalRows(createTestGameState(), [event]).find((r) => r.system === 'liveops');
    expect(live?.fraction).toBe(`$${(1500).toLocaleString()} / $${(5000).toLocaleString()}`);
  });

  it('skips a challenge whose reward is already claimed', () => {
    const state = createTestGameState();
    const weeksLived = state.weeksLived ?? 0;
    const claimed = {
      ...state,
      weeklyChallenge: {
        challengeId: getWeeklyChallengeIdForWeek(weeksLived),
        startedAt: Date.now(),
        startedWeek: weeksLived,
        progress: [],
        completed: false,
        rewardClaimed: true,
      },
    };
    expect(buildGoalRows(claimed, []).some((r) => r.system === 'challenge')).toBe(false);
  });

  it('surfaces an in-progress live event objective with a bar', () => {
    const rows = buildGoalRows(createTestGameState(), [fakeEvent('active')]);
    const live = rows.find((r) => r.system === 'liveops');
    expect(live?.title).toBe('Objective 0');
    expect(live?.progress).toBe(0);
  });

  it('prefers a claimable live event over an in-progress one', () => {
    const rows = buildGoalRows(createTestGameState(), [
      fakeEvent('active'),
      fakeEvent('claimable', [{ met: true }]),
    ]);
    const live = rows.filter((r) => r.system === 'liveops');
    // One slot — a claimable event takes it and names the reward, no bar
    // (there is nothing left to progress).
    expect(live).toHaveLength(1);
    expect(live[0].title).toBe('Collect: Event claimable');
    expect(live[0].fraction).toBe('200 gems');
    expect(live[0].progress).toBeUndefined();
  });
});
