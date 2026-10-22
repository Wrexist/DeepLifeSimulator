/**
 * Pausing and resuming must not reset the exam clock.
 *
 * Resume used to set `lastExamWeek = lastCampusEventWeek = weeksLived`. A
 * pause followed by a resume in the same week never shows the tick a paused
 * program, so the term kept advancing while the exam clock restarted: doing it
 * every 12 weeks skipped every exam and every campus event for a whole degree.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import { togglePauseProgram } from '@/contexts/game/actions/EducationActions';
import { EXAM_INTERVAL_WEEKS, isExamWeek } from '@/lib/education/educationSystem';
import type { Education, GameState } from '@/contexts/game/types';

const NOW = 500;

function studentWithExamDue(lastExamWeek: number): GameState {
  const base = createTestGameState({ weeksLived: NOW });
  const program: Education = {
    id: 'cs101',
    name: 'CS 101',
    description: 'intro',
    cost: 5000,
    duration: 52,
    completed: false,
    paused: false,
    weeksRemaining: 40,
    enrolledClasses: [],
    examsPassed: 0,
    examsFailed: 0,
    gpa: 3.0,
    studyGroupActive: false,
    lastExamWeek,
    lastCampusEventWeek: lastExamWeek,
  };
  return { ...base, educations: [program] };
}

function pauseThenResume(state: GameState): Education {
  const stub = createSetGameStateStub(state);
  const id = (state.educations ?? [])[0].id;
  togglePauseProgram(stub.setGameState, id);
  togglePauseProgram(stub.setGameState, id);
  return (stub.current().educations ?? [])[0];
}

describe('pause + resume in the same week', () => {
  it('leaves the exam clock where it was', () => {
    const before = studentWithExamDue(NOW - (EXAM_INTERVAL_WEEKS - 1));
    const after = pauseThenResume(before);
    expect(after.paused).toBe(false);
    expect(after.lastExamWeek).toBe(before.educations![0].lastExamWeek);
    // The exam is still due next week, exactly as it was without the toggle.
    expect(isExamWeek(after, NOW + 1)).toBe(true);
  });

  it('a long-overdue clock resumes due next week, not immediately', () => {
    const after = pauseThenResume(studentWithExamDue(NOW - 40));
    expect(isExamWeek(after, NOW)).toBe(false);
    expect(isExamWeek(after, NOW + 1)).toBe(true);
  });
});
