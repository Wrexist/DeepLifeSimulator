/**
 * Owner decisions on the 2026-10-23 audit, onboarding/progression/events half
 * (D1, D4, D13). Each block pins the rule the decision set.
 */
import { LIFE_CHAPTERS, earnedEducationThisLife } from '@/lib/progress/lifeChapters';
import { applyEducationProgression } from '@/contexts/game/actions/weekly/applyEducationProgression';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { scenarios as LIFE_PATHS } from '@/src/features/onboarding/scenarioData';
import { SCENARIOS as CHALLENGES } from '@/lib/scenarios/scenarioDefinitions';
import { eventTemplates, type EventTemplate } from '@/lib/events/engine';
import { creditCampaignFunds } from '@/lib/politics/campaignFunds';
import { completeAllPrograms } from '@/lib/education/operations';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Education, GameState, GameStats, PoliticsState } from '@/contexts/game/types';
import { zeroPreRolls } from '../helpers/zeroPreRolls';

// ---------------------------------------------------------------------------
// D1 - Chapter 4 "Get Educated" counts only a degree earned in THIS life
// ---------------------------------------------------------------------------

const educationGoal = (() => {
  for (const chapter of LIFE_CHAPTERS) {
    const goal = chapter.goals.find((g) => g.id === 'ch4_education');
    if (goal) return goal;
  }
  throw new Error('ch4_education goal missing');
})();

function buildScenario(id: string): GameState {
  const scenario = LIFE_PATHS.find((s) => s.id === id);
  if (!scenario) throw new Error(`missing scenario ${id}`);
  const template = createTestGameState();
  return buildNewGameState({
    initialGameState: template,
    stateVersion: template.version ?? 1,
    firstName: 'Test',
    lastName: 'Player',
    sex: 'female',
    sexuality: 'straight',
    scenario: { id, start: scenario.start },
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
  }) as GameState;
}

function tickCtx(nextWeeksLived: number): WeekContext {
  const newStats = { health: 70, happiness: 70, energy: 70, fitness: 60, money: 1000, reputation: 50, gems: 0 } as GameStats;
  return { newStats, notifications: [] as WeekNotification[], preRolls: zeroPreRolls(), nextWeeksLived } as WeekContext;
}

describe('D1: a starting degree does not complete "Get Educated"', () => {
  const degreeStarts = LIFE_PATHS.filter((s) => typeof s.start.education === 'string' && s.start.education !== 'Dropout');

  it('the scenarios with a starting degree exist (the case this pins is live)', () => {
    expect(degreeStarts.map((s) => s.id)).toEqual(expect.arrayContaining(['corporate_intern', 'trust_fund_baby', 'medical_student']));
  });

  it.each(degreeStarts.map((s) => [s.id] as const))('%s starts with the degree but not the goal', (id) => {
    const state = buildScenario(id);
    expect(state.educations.some((e) => e.completed)).toBe(true); // the scenario still grants its degree
    expect(educationGoal.checkComplete(state)).toBe(false);
    expect(educationGoal.checkProgress(state)).toBe(0);
  });

  it('a degree graduated by the weekly tick completes it', () => {
    const state = buildScenario('corporate_intern');
    const enrolled: Education = {
      id: 'mba', name: 'MBA', description: '', cost: 0, duration: 52, completed: false, paused: false, weeksRemaining: 1,
    };
    const { updatedEducations } = applyEducationProgression({
      prevEducations: [...state.educations, enrolled],
      nextWeeksLived: state.weeksLived + 1,
      goldFastLearner: false,
      perkFastLearner: false,
    }, tickCtx(state.weeksLived + 1));
    const graduated = { ...state, educations: updatedEducations };
    expect(updatedEducations.find((e) => e.id === 'mba')?.completed).toBe(true);
    expect(educationGoal.checkComplete(graduated)).toBe(true);
    expect(educationGoal.checkProgress(graduated)).toBe(1);
  });

  it('prestige "all educations" grants do not count either', () => {
    expect(earnedEducationThisLife({ educations: completeAllPrograms([]) })).toBe(false);
  });

  it('an in-progress programme still shows partial progress', () => {
    const state = createTestGameState({
      educations: [{ id: 'mba', name: 'MBA', description: '', cost: 0, duration: 40, completed: false, weeksRemaining: 10 }],
    });
    expect(educationGoal.checkComplete(state)).toBe(false);
    expect(educationGoal.checkProgress(state)).toBeCloseTo(0.75);
  });
});

// ---------------------------------------------------------------------------
// D4 - politician events do not pay government money into the wallet
// ---------------------------------------------------------------------------

const byId = (id: string): EventTemplate => {
  const t = eventTemplates.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};
const politicsAt = (careerLevel: number, extra: Partial<PoliticsState> = {}): PoliticsState => ({
  careerLevel, approvalRating: 50, policyInfluence: 0, electionsWon: 0, policiesEnacted: [],
  lobbyists: [], alliances: [], campaignFunds: 0, ...extra,
});
const politician = () => createTestGameState({ weeksLived: 400, lifeStartWeek: 0, politics: politicsAt(3) });

describe('D4: political events and the wallet', () => {
  it('budget_crisis is reputation-only: no choice moves money', () => {
    const event = byId('budget_crisis').generate(politician());
    expect(event.choices.length).toBeGreaterThan(0);
    for (const c of event.choices) {
      expect(c.effects.money ?? 0).toBe(0);
      expect(c.effects.moneyPct ?? 0).toBe(0);
      expect(c.effects.campaignFunds ?? 0).toBe(0);
      expect(c.effects.stats?.reputation ?? 0).toBeLessThan(0);
    }
  });

  it('budget_crisis has no strictly dominant choice once the cash is gone', () => {
    const event = byId('budget_crisis').generate(politician());
    const cost = event.choices.map((c) => ({
      id: c.id, rep: c.effects.stats?.reputation ?? 0, hap: c.effects.stats?.happiness ?? 0,
    }));
    for (const a of cost) {
      const dominated = cost.some((b) => b.id !== a.id && b.rep >= a.rep && b.hap >= a.hap && (b.rep > a.rep || b.hap > a.hap));
      expect({ id: a.id, dominated }).toEqual({ id: a.id, dominated: false });
    }
  });

  it('political_fundraiser pays the campaign, not the wallet, and says so', () => {
    const event = byId('political_fundraiser').generate(politician());
    const attend = event.choices.find((c) => c.id === 'attend');
    expect(attend).toBeDefined();
    expect(attend?.effects.money ?? 0).toBe(0);
    expect(attend?.effects.campaignFunds).toBe(25000);
    expect(attend?.text).toContain('$25,000 campaign funds');
  });

  it('creditCampaignFunds adds to the pot, floors at 0 and is identity on 0', () => {
    const p = politicsAt(2, { campaignFunds: 1000 });
    expect(creditCampaignFunds(p, 25000).campaignFunds).toBe(26000);
    expect(creditCampaignFunds(p, -5000).campaignFunds).toBe(0);
    expect(creditCampaignFunds(p, 0)).toBe(p);
    expect(creditCampaignFunds(politicsAt(1, { campaignFunds: Number.NaN }), 500).campaignFunds).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// D13 - Redemption Arc's copy states what is applied
// ---------------------------------------------------------------------------

describe('D13: Redemption Arc copy matches the applied start', () => {
  const arc = CHALLENGES.find((c) => c.id === 'redemption_arc');

  it('advertises a reputation the 0-100 stat can hold', () => {
    expect(arc?.startingConditions.reputation).toBe(0);
  });

  it('does not promise a wanted level nothing sets', () => {
    expect(arc?.description.toLowerCase()).not.toContain('wanted');
  });

  it('every challenge advertises a starting reputation inside 0-100', () => {
    for (const c of CHALLENGES) {
      const rep = c.startingConditions.reputation;
      if (typeof rep === 'number') expect({ id: c.id, ok: rep >= 0 && rep <= 100 }).toEqual({ id: c.id, ok: true });
    }
  });
});
