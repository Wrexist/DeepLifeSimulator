import {
  applyExamResult,
  applyStudySession,
  bestGpa,
  enroll,
  pauseEducation,
  setStudyGroup,
  withdraw,
} from '../operations';
import { Education, EducationClass } from '@/contexts/game/types';

function active(over: Partial<Education> = {}): Education {
  return {
    id: 'cs101',
    name: 'CS 101',
    description: 'intro',
    cost: 5000,
    duration: 26,
    completed: false,
    weeksRemaining: 26,
    paused: false,
    enrolledClasses: [],
    examsPassed: 0,
    examsFailed: 0,
    gpa: 3.0,
    studyGroupActive: false,
    ...over,
  };
}

describe('enroll', () => {
  it('adds a fresh education with sane defaults', () => {
    const r = enroll([], {
      templateId: 'cs101',
      name: 'CS 101',
      description: 'intro',
      cost: 5000,
      duration: 26,
      startedWeek: 1,
    });
    expect(r.educations).toHaveLength(1);
    expect(r.education.gpa).toBe(3.0);
    expect(r.education.completed).toBe(false);
    expect(r.education.weeksRemaining).toBe(26);
  });

  it('applies politics weeksReduction', () => {
    const r = enroll([], {
      templateId: 'cs101',
      name: 'CS 101',
      description: 'intro',
      cost: 5000,
      duration: 26,
      startedWeek: 0,
      weeksReduction: 4,
    });
    expect(r.education.duration).toBe(22);
    expect(r.education.weeksRemaining).toBe(22);
  });

  it('clamps duration to at least 1 week', () => {
    const r = enroll([], {
      templateId: 'cs101',
      name: 'CS 101',
      description: 'intro',
      cost: 5000,
      duration: 4,
      startedWeek: 0,
      weeksReduction: 100,
    });
    expect(r.education.duration).toBe(1);
  });

  it('defaults enrolledClasses to [] when no classes chosen', () => {
    const r = enroll([], {
      templateId: 'cs101', name: 'CS 101', description: 'intro',
      cost: 5000, duration: 26, startedWeek: 0,
    });
    expect(r.education.enrolledClasses).toEqual([]);
  });

  it('populates enrolledClasses from the chosen classes (capped at 3)', () => {
    const mk = (id: string): EducationClass => ({
      id, name: id, category: 'core', statBonuses: { reputation: 2 }, difficulty: 2, completed: false,
    });
    const r = enroll([], {
      templateId: 'cs101', name: 'CS 101', description: 'intro',
      cost: 5000, duration: 26, startedWeek: 0,
      classes: [mk('a'), mk('b'), mk('c'), mk('d')],
    });
    expect(r.education.enrolledClasses).toHaveLength(3);
    expect(r.education.enrolledClasses!.every((c) => c.completed === false)).toBe(true);
  });
});

describe('setStudyGroup', () => {
  it('activates the flag on the matching education', () => {
    const r = setStudyGroup([active()], 'cs101', true);
    expect(r[0].studyGroupActive).toBe(true);
  });
  it('deactivates the flag', () => {
    const r = setStudyGroup([active({ studyGroupActive: true })], 'cs101', false);
    expect(r[0].studyGroupActive).toBe(false);
  });
  it('no-ops on unknown id', () => {
    const r = setStudyGroup([active()], 'other', true);
    expect(r[0].studyGroupActive).toBe(false);
  });
});

describe('pauseEducation', () => {
  it('toggles paused', () => {
    const r = pauseEducation([active()], 'cs101', true);
    expect(r[0].paused).toBe(true);
    const r2 = pauseEducation(r, 'cs101', false);
    expect(r2[0].paused).toBe(false);
  });
  it('no-ops on unknown id', () => {
    const r = pauseEducation([active()], 'other', true);
    expect(r[0].paused).toBe(false);
  });
});

describe('withdraw', () => {
  it('removes the education', () => {
    expect(withdraw([active()], 'cs101')).toHaveLength(0);
  });
  it('no-ops on unknown id', () => {
    expect(withdraw([active()], 'nope')).toHaveLength(1);
  });
});

describe('applyExamResult', () => {
  it('increments examsPassed when passed', () => {
    const r = applyExamResult([active()], 'cs101', { gpaChange: 0.1, passed: true, currentWeek: 13 });
    expect(r[0].examsPassed).toBe(1);
    expect(r[0].gpa).toBeCloseTo(3.1, 5);
    expect(r[0].lastExamWeek).toBe(13);
  });

  it('increments examsFailed when failed', () => {
    const r = applyExamResult([active()], 'cs101', { gpaChange: -0.2, passed: false, currentWeek: 13 });
    expect(r[0].examsFailed).toBe(1);
    expect(r[0].gpa).toBeCloseTo(2.8, 5);
  });

  it('clamps GPA at 4.0', () => {
    const r = applyExamResult([active({ gpa: 3.9 })], 'cs101', { gpaChange: 1.0, passed: true, currentWeek: 13 });
    expect(r[0].gpa).toBe(4.0);
  });
});

describe('applyStudySession', () => {
  it('reduces weeksRemaining by 1 by default', () => {
    const r = applyStudySession([active()], 'cs101');
    expect(r[0].weeksRemaining).toBe(25);
  });

  it('completes when weeksRemaining hits 0', () => {
    const r = applyStudySession([active({ weeksRemaining: 1 })], 'cs101');
    expect(r[0].weeksRemaining).toBe(0);
    expect(r[0].completed).toBe(true);
  });

  it('does nothing when paused', () => {
    const r = applyStudySession([active({ paused: true })], 'cs101');
    expect(r[0].weeksRemaining).toBe(26);
  });

  it('does nothing when already completed', () => {
    const r = applyStudySession([active({ completed: true })], 'cs101');
    expect(r[0].completed).toBe(true);
  });
});

describe('bestGpa', () => {
  it('returns highest GPA across educations', () => {
    expect(bestGpa([active({ gpa: 2.5 }), active({ id: 'b', gpa: 3.7 })])).toBe(3.7);
  });
});
