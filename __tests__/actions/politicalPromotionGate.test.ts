/**
 * PLAYER REPORT (1.4 bug-reports) — the political ladder had two doors and only
 * one of them was locked.
 *
 *   "Able to promote political on the career page when the political page stops
 *    you due to age. After promotion the career page will list you as mayor,
 *    state rep, etc; while political page says you're a council member."
 *
 * The Politics app runs `canRunForOffice`, which correctly refused a
 * 27-year-old running for Mayor — "You must be at least 30 years old to run for
 * this office." The Work tab's Promote button ran `getPromotionEligibility`,
 * which covers acceptance, progress, performance and tenure and knows nothing
 * about `POLITICAL_CAREER_REQUIREMENTS`. So the same player was promoted into
 * the very office the other screen had just denied them.
 *
 * The rank mismatch follows from it: `politics.careerLevel` is maintained only
 * by `runForOffice`, so a Work-tab promotion left it behind and the two screens
 * reported different offices for one player.
 *
 * 2026-08-01, from live player reports.
 */
import { promoteCareer } from '@/contexts/game/actions/JobActions';
import {
  POLITICAL_CAREER,
  POLITICAL_CAREER_REQUIREMENTS,
  officeForLevel,
  politicalPromotionBlocker,
} from '@/lib/careers/political';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Career, GameState } from '@/contexts/game/types';

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

/** A sitting Council Member, promotion-ready, at the given age. */
function councilMember(age: number, over: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  const career: Career = {
    ...POLITICAL_CAREER,
    accepted: true,
    applied: true,
    level: 0,
    progress: 100,
    performance: 100,
    startedWeeksLived: 0,
  } as unknown as Career;

  return createTestGameState({
    stats: { ...base.stats, reputation: 95 },
    date: { ...base.date, age },
    weeksLived: 520, // 10 years in office — clears every tenure gate
    currentJob: 'political',
    careers: [career],
    educations: [{ id: 'business_degree', completed: true } as never],
    politics: { ...(base.politics ?? {}), careerLevel: 1 } as never,
    ...over,
  });
}

describe('the office requirements are real (the premise)', () => {
  it('Mayor requires 30, and the ladder order matches the career levels', () => {
    expect(POLITICAL_CAREER_REQUIREMENTS.mayor.minAge).toBe(30);
    expect(officeForLevel(0)).toBe('council_member');
    expect(officeForLevel(1)).toBe('mayor');
    expect(POLITICAL_CAREER.levels[1].name).toBe('Mayor');
  });

  it('the blocker names the age, matching what the Politics app says', () => {
    const reason = politicalPromotionBlocker({
      targetLevel: 1,
      age: 27,
      reputation: 95,
      currentLevel: 0,
      weeksInCurrentLevel: 520,
      hasEducation: () => true,
    });

    expect(reason).toMatch(/at least 30 years old/);
    expect(reason).toMatch(/You are 27/);
  });

  it('returns null for a non-political rung', () => {
    // The control: this gate must not touch any other career.
    expect(politicalPromotionBlocker({
      targetLevel: 99,
      age: 18,
      reputation: 0,
      currentLevel: 0,
      weeksInCurrentLevel: 0,
      hasEducation: () => false,
    })).toBeNull();
  });
});

describe('the Work tab cannot promote past the office gate', () => {
  it('refuses a 27-year-old Council Member the Mayor promotion', () => {
    const state = councilMember(27);
    const { setState, get } = batched(state);

    const result = promoteCareer(state, setState, 'political');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/at least 30 years old/);
    expect(get().careers?.[0].level).toBe(0);
  });

  it('allows it at 30 (the control — the gate is age, not politics itself)', () => {
    const state = councilMember(30);
    const { setState, get } = batched(state);

    const result = promoteCareer(state, setState, 'political');

    expect(result.success).toBe(true);
    expect(get().careers?.[0].level).toBe(1);
  });

  it('keeps the Politics app rank in step on a successful promotion', () => {
    // The second half of the report: the two screens disagreed afterwards.
    const state = councilMember(30);
    const { setState, get } = batched(state);

    promoteCareer(state, setState, 'political');

    // `politics.careerLevel` is the 1-based office RANK (0 = Citizen).
    expect(get().politics?.careerLevel).toBe(2);
  });

  it('never lowers a rank the Politics app already granted', () => {
    // `runForOffice` is the other writer; a Work-tab promotion must not undo a
    // higher office won through an election.
    const state = councilMember(30, { politics: { careerLevel: 5 } as never });
    const { setState, get } = batched(state);

    promoteCareer(state, setState, 'political');

    expect(get().politics?.careerLevel).toBe(5);
  });

  it('a non-political career is unaffected', () => {
    // The control that matters most: this must not have gated every career in
    // the game behind an age requirement.
    const base = createTestGameState();
    const career = {
      id: 'tech',
      levels: [{ name: 'Junior', salary: 1000 }, { name: 'Senior', salary: 2000 }],
      level: 0,
      progress: 100,
      performance: 100,
      accepted: true,
      applied: true,
      startedWeeksLived: 0,
    } as unknown as Career;
    const state = createTestGameState({
      date: { ...base.date, age: 19 },
      weeksLived: 520,
      currentJob: 'tech',
      careers: [career],
    });
    const { setState, get } = batched(state);

    const result = promoteCareer(state, setState, 'tech');

    expect(result.success).toBe(true);
    expect(get().careers?.[0].level).toBe(1);
  });

  it('a double tap still promotes only one level', () => {
    // The existing atomicity guard must survive the new gate.
    const state = councilMember(30);
    const { setState, get } = batched(state);

    promoteCareer(state, setState, 'political');
    promoteCareer(state, setState, 'political');

    expect(get().careers?.[0].level).toBe(1);
  });
});
