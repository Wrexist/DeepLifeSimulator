/**
 * Career ladder integrity + promotion/hiring gating (task #46).
 *
 * Covers:
 *   1. Ladder integrity — every career (basic + advanced + political) has a
 *      valid, non-decreasing salary ladder and non-decreasing experienceRequired
 *      gates; the extended short ladders reached 6 levels.
 *   2. Promotion gating — promoteCareer is blocked when performance is low or the
 *      target level's experience (tenure) requirement isn't met, and allowed once
 *      the player qualifies.
 *   3. Hiring qualification — applyForJob rejects an applicant missing the
 *      required education (the interview/qualification path).
 *   4. Save migration — repairGameState extends a pre-existing short ladder to the
 *      current catalog while preserving the player's level/progress.
 */
import { GameState, Career } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { promoteCareer, applyForJob } from '@/contexts/game/actions/JobActions';
import { getPromotionEligibility, PROMOTION_MIN_PERFORMANCE } from '@/lib/careers/promotionGating';
import { repairGameState } from '@/utils/saveValidation';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import { ADVANCED_CAREERS } from '@/lib/careers/advancedCareers';
import { POLITICAL_CAREER } from '@/lib/careers/political';

function harness(initial: GameState) {
  const ref = { state: initial };
  const setGameState = ((u: GameState | ((p: GameState) => GameState)) => {
    ref.state = typeof u === 'function' ? u(ref.state) : u;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { ref, setGameState };
}

/** A working career with a 3-rung ladder whose TOP rung is experience-gated. */
function employedState(careerOverrides: Partial<Career> = {}, weeksLived = 200): GameState {
  const career: Career = {
    id: 'testcareer',
    levels: [
      { name: 'Rung One', salary: 100 },
      { name: 'Rung Two', salary: 200 },
      { name: 'Rung Three', salary: 300, experienceRequired: 100 },
    ],
    level: 0,
    description: '',
    requirements: {} as never,
    progress: 100,
    applied: true,
    accepted: true,
    performance: 80,
    startedWeeksLived: 0,
    ...careerOverrides,
  };
  return createTestGameState({ currentJob: 'testcareer', careers: [career], weeksLived });
}

describe('career ladder integrity', () => {
  const allCareers: Career[] = [...INITIAL_CAREERS, ...ADVANCED_CAREERS, POLITICAL_CAREER];

  it.each(allCareers.map((c) => [c.id, c] as const))('%s has a valid, non-decreasing ladder', (_id, career) => {
    expect(Array.isArray(career.levels)).toBe(true);
    expect(career.levels.length).toBeGreaterThanOrEqual(2);

    let prevSalary = -Infinity;
    let prevExp = -Infinity;
    for (const level of career.levels) {
      // Every salary is a positive, finite number.
      expect(typeof level.salary).toBe('number');
      expect(Number.isFinite(level.salary)).toBe(true);
      expect(level.salary).toBeGreaterThan(0);
      // Salaries never go backwards up the ladder.
      expect(level.salary).toBeGreaterThanOrEqual(prevSalary);
      prevSalary = level.salary;

      // experienceRequired, where present, is a non-decreasing, non-negative gate.
      if (level.experienceRequired !== undefined) {
        expect(level.experienceRequired).toBeGreaterThanOrEqual(0);
        expect(level.experienceRequired).toBeGreaterThanOrEqual(prevExp);
        prevExp = level.experienceRequired;
      }
    }
  });

  it('leaves no previously-short ladder short', () => {
    // Was `toBe(6)`. The intent of this test is that a ladder which used to
    // have 3 or 4 rungs is no longer stunted — 6 was the number that fix
    // happened to land on, not a ceiling. The five advanced ladders now carry
    // two capstone rungs each (Board Seat at 20 years of tenure, Emeritus at
    // 30), so they sit at 8. Pinning the exact length made the floor read as a
    // maximum and blocked adding a career tail at all.
    const extended = [
      'legal', 'bank', 'accountant', 'politician', 'celebrity', 'athlete', // basic 3 -> 6
      'ceo', 'research_scientist', 'creative_director', 'investment_banker', 'surgeon', // advanced 4 -> 6 -> 8
    ];
    for (const id of extended) {
      const career = allCareers.find((c) => c.id === id);
      expect(career).toBeDefined();
      expect(`${id}:${career!.levels.length >= 6}`).toBe(`${id}:true`);
    }
  });

  it('keeps top salaries within the existing top band (<= CEO ceiling)', () => {
    // CEO is the game's designed pinnacle earner; nothing else should out-earn it.
    const ceo = allCareers.find((c) => c.id === 'ceo')!;
    const ceoTop = ceo.levels[ceo.levels.length - 1].salary;
    for (const career of allCareers) {
      if (career.id === 'political') continue; // political salaries are annual-denominated
      const top = career.levels[career.levels.length - 1].salary;
      expect(top).toBeLessThanOrEqual(ceoTop);
    }
  });
});

describe('promotion gating (promoteCareer)', () => {
  it('promotes when qualified (progress 100, performance OK, no experience gate)', () => {
    const state = employedState({ level: 0, progress: 100, performance: 80 });
    const { ref, setGameState } = harness(state);
    const r = promoteCareer(ref.state, setGameState, 'testcareer');
    expect(r.success).toBe(true);
    const career = ref.state.careers.find((c) => c.id === 'testcareer')!;
    expect(career.level).toBe(1);
    expect(career.progress).toBe(0); // reset after promotion
  });

  it('blocks promotion while performance is below the review threshold', () => {
    const state = employedState({ level: 0, progress: 100, performance: PROMOTION_MIN_PERFORMANCE - 10 });
    const { ref, setGameState } = harness(state);
    const r = promoteCareer(ref.state, setGameState, 'testcareer');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/performance/i);
    expect(ref.state.careers[0].level).toBe(0); // unchanged
  });

  it('blocks a leap to an experience-gated level when tenure is too short', () => {
    // Sitting at level 1; the level-2 rung needs 100 weeks in the career.
    // Started at week 150, now week 200 → only 50 weeks of tenure.
    const state = employedState({ level: 1, progress: 100, performance: 90, startedWeeksLived: 150 }, 200);
    const { ref, setGameState } = harness(state);
    const r = promoteCareer(ref.state, setGameState, 'testcareer');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/weeks/i);
    expect(ref.state.careers[0].level).toBe(1); // unchanged
  });

  it('allows the experience-gated promotion once tenure is met', () => {
    // Same rung, but started at week 0 → 200 weeks of tenure >= the 100 required.
    const state = employedState({ level: 1, progress: 100, performance: 90, startedWeeksLived: 0 }, 200);
    const { ref, setGameState } = harness(state);
    const r = promoteCareer(ref.state, setGameState, 'testcareer');
    expect(r.success).toBe(true);
    expect(ref.state.careers[0].level).toBe(2);
  });

  it('getPromotionEligibility does not gate tenure for legacy saves with no start week', () => {
    const career = employedState({ level: 1, progress: 100, performance: 90, startedWeeksLived: undefined }, 5)
      .careers[0];
    // weeksLived (5) < required (100), but start is unknown → not blocked on tenure.
    const elig = getPromotionEligibility(career, 5);
    expect(elig.eligible).toBe(true);
  });
});

describe('hiring qualification (applyForJob)', () => {
  it('rejects an applicant missing the required education', () => {
    const gated: Career = {
      id: 'edu_gated',
      levels: [{ name: 'Analyst', salary: 500 }],
      level: 0,
      description: '',
      requirements: { education: ['masters_degree'] },
      progress: 0,
      applied: false,
      accepted: false,
    };
    const state = createTestGameState({ currentJob: undefined, careers: [gated], educations: [] });
    const { ref, setGameState } = harness(state);
    const r = applyForJob(ref.state, setGameState, 'edu_gated');
    expect(r && r.success).toBe(false);
    expect(r && r.message).toMatch(/education/i);
    // Never became employed.
    expect(ref.state.currentJob).toBeFalsy();
    expect(ref.state.careers[0].accepted).toBe(false);
  });
});

describe('save migration (repairGameState extends short ladders)', () => {
  it('grows a pre-existing 3-level legal ladder to 6 while preserving level/progress', () => {
    // A save captured before the ladder extension: legal stored with 3 levels.
    const oldSave = JSON.parse(JSON.stringify(createTestGameState({
      currentJob: 'legal',
      careers: [{
        id: 'legal',
        levels: [
          { name: 'Junior Legal Assistant', salary: 130 },
          { name: 'Legal Assistant', salary: 190 },
          { name: 'Senior Legal Assistant', salary: 270 },
        ],
        level: 1,
        description: 'Support legal professionals',
        requirements: { items: ['smartphone', 'computer'], education: ['legal_studies'] },
        progress: 40,
        applied: true,
        accepted: true,
        performance: 70,
        startedWeeksLived: 10,
      }],
    })));

    const result = repairGameState(oldSave);
    expect(result.repaired).toBe(true);

    const legal = (oldSave.careers as Career[]).find((c) => c.id === 'legal')!;
    expect(legal.levels.length).toBe(6);
    // Player's earned position is preserved.
    expect(legal.level).toBe(1);
    expect(legal.progress).toBe(40);
    expect(legal.accepted).toBe(true);
    // New top rung is present with its experience gate.
    expect(legal.levels[5].name).toBe('Director of Legal Services');
    expect(legal.levels[5].experienceRequired).toBeGreaterThan(0);
  });

  it('is idempotent - a save already at 6 levels is left untouched', () => {
    const current = JSON.parse(JSON.stringify(createTestGameState()));
    const before = JSON.stringify((current.careers as Career[]).find((c) => c.id === 'legal'));
    repairGameState(current);
    const after = JSON.stringify((current.careers as Career[]).find((c) => c.id === 'legal'));
    expect(after).toBe(before);
  });
});
