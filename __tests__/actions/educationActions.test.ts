/**
 * WAVE A — EducationApp action layer.
 *
 *  - enrollInProgram now threads chosen class ids into `enrolledClasses`
 *    (mapped + capped), lighting the completion stat-bonus loop, exam difficulty,
 *    and the detail "Classes" section that were all previously dead.
 *  - toggleStudyGroup is the missing writer for `studyGroupActive`: joining
 *    charges a small one-time cost atomically (double-tap safe, unaffordable-
 *    reject) so the already-wired +2 happy/−3 energy weekly bonus can occur.
 */
import {
  enrollInProgram,
  toggleStudyGroup,
} from '@/contexts/game/actions/EducationActions';
import { STUDY_GROUP_JOIN_COST } from '@/lib/education/educationSystem';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Education } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

function ed(over: Partial<Education> = {}): Education {
  return {
    id: 'business_degree',
    name: 'Business Degree',
    description: 'biz',
    cost: 48_000,
    duration: 90,
    completed: false,
    weeksRemaining: 90,
    paused: false,
    enrolledClasses: [],
    examsPassed: 0,
    examsFailed: 0,
    gpa: 3.0,
    studyGroupActive: false,
    semesterNumber: 1,
    ...over,
  };
}

describe('enrollInProgram — class picker', () => {
  it('populates enrolledClasses from the chosen class ids (cash mode)', () => {
    const snapshot = createTestGameState({ stats: { money: 100_000 } as never, educations: [] });
    const { setState, get } = makeBatchedSetState(snapshot);

    enrollInProgram(setState, {
      templateId: 'business_degree',
      name: 'Business Degree',
      description: 'biz',
      cost: 10_000,
      duration: 90,
      mode: 'cash',
      classIds: ['intro_writing', 'corporate_finance'],
    });

    const created = get().educations.find((e) => e.id === 'business_degree')!;
    expect(created).toBeDefined();
    expect(created.enrolledClasses).toHaveLength(2);
    expect(created.enrolledClasses!.map((c) => c.id).sort()).toEqual(['corporate_finance', 'intro_writing']);
    expect(created.enrolledClasses!.every((c) => c.completed === false)).toBe(true);
  });

  it('drops class ids not offered by the program', () => {
    const snapshot = createTestGameState({ stats: { money: 100_000 } as never, educations: [] });
    const { setState, get } = makeBatchedSetState(snapshot);

    enrollInProgram(setState, {
      templateId: 'business_degree',
      name: 'Business Degree',
      description: 'biz',
      cost: 10_000,
      duration: 90,
      mode: 'cash',
      classIds: ['organic_chemistry', 'intro_writing'], // organic_chemistry is medical-only
    });

    const created = get().educations.find((e) => e.id === 'business_degree')!;
    expect(created.enrolledClasses!.map((c) => c.id)).toEqual(['intro_writing']);
  });

  it('caps enrolledClasses at 3 even if more ids are passed', () => {
    const snapshot = createTestGameState({ stats: { money: 100_000 } as never, educations: [] });
    const { setState, get } = makeBatchedSetState(snapshot);

    enrollInProgram(setState, {
      templateId: 'business_degree',
      name: 'Business Degree',
      description: 'biz',
      cost: 10_000,
      duration: 90,
      mode: 'cash',
      classIds: ['intro_writing', 'math_fundamentals', 'public_speaking', 'corporate_finance', 'debate_club'],
    });

    const created = get().educations.find((e) => e.id === 'business_degree')!;
    expect(created.enrolledClasses!.length).toBe(3);
  });

  it('empty classIds keeps enrolledClasses [] (old saves stay valid)', () => {
    const snapshot = createTestGameState({ stats: { money: 100_000 } as never, educations: [] });
    const { setState, get } = makeBatchedSetState(snapshot);

    enrollInProgram(setState, {
      templateId: 'high_school',
      name: 'High School',
      description: 'hs',
      cost: 0,
      duration: 104,
      mode: 'cash',
    });

    const created = get().educations.find((e) => e.id === 'high_school')!;
    expect(created.enrolledClasses).toEqual([]);
  });
});

describe('toggleStudyGroup', () => {
  it('joining sets the flag and debits the one-time join cost', () => {
    const snapshot = createTestGameState({ stats: { money: 1000 } as never, educations: [ed()] });
    const { setState, get } = makeBatchedSetState(snapshot);

    toggleStudyGroup(setState, 'business_degree');

    expect(get().educations[0].studyGroupActive).toBe(true);
    expect(get().stats.money).toBe(1000 - STUDY_GROUP_JOIN_COST);
  });

  it('is double-tap safe — two same-batch joins debit once', () => {
    const snapshot = createTestGameState({ stats: { money: 1000 } as never, educations: [ed()] });
    const { setState, get } = makeBatchedSetState(snapshot);

    toggleStudyGroup(setState, 'business_degree');
    // second call on the SAME stale snapshot would double-charge without the
    // atomic guard; but the updater re-reads prev, where the flag is already on
    // → it is treated as a LEAVE, so money is not debited again.
    const afterFirst = get().stats.money;
    toggleStudyGroup(setState, 'business_degree');
    expect(get().stats.money).toBe(afterFirst); // no further debit
    expect(get().educations[0].studyGroupActive).toBe(false); // toggled back off
  });

  it('leaving is free (no refund, no charge)', () => {
    const snapshot = createTestGameState({ stats: { money: 1000 } as never, educations: [ed({ studyGroupActive: true })] });
    const { setState, get } = makeBatchedSetState(snapshot);

    toggleStudyGroup(setState, 'business_degree');

    expect(get().educations[0].studyGroupActive).toBe(false);
    expect(get().stats.money).toBe(1000); // unchanged
  });

  it('rejects joining when the player cannot afford the cost (flag stays off)', () => {
    const snapshot = createTestGameState({ stats: { money: STUDY_GROUP_JOIN_COST - 1 } as never, educations: [ed()] });
    const { setState, get } = makeBatchedSetState(snapshot);

    toggleStudyGroup(setState, 'business_degree');

    expect(get().educations[0].studyGroupActive).toBe(false);
    expect(get().stats.money).toBe(STUDY_GROUP_JOIN_COST - 1);
  });

  it('no-ops on a completed program', () => {
    const snapshot = createTestGameState({ stats: { money: 1000 } as never, educations: [ed({ completed: true })] });
    const { setState, get } = makeBatchedSetState(snapshot);

    toggleStudyGroup(setState, 'business_degree');

    expect(get().educations[0].studyGroupActive).toBe(false);
    expect(get().stats.money).toBe(1000);
  });
});
