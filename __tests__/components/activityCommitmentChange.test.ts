import { applyCommitmentChange } from '@/components/ActivityCommitmentModal';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * UI2-3: the commitment change used to write unconditionally - the 4-week lock
 * was checked only against the render snapshot - and was never saved. The
 * pure commit re-checks the lock against `prev`.
 */
describe('applyCommitmentChange', () => {
  it('writes the picks and stamps the lock on weeksLived', () => {
    const prev = createTestGameState({ weeksLived: 300 });
    const next = applyCommitmentChange(prev, 'career', 'health');
    expect(next.activityCommitments?.primary).toBe('career');
    expect(next.activityCommitments?.secondary).toBe('health');
    expect(next.activityCommitments?.lastChangedWeek).toBe(300);
  });

  it('refuses a second change inside the lock, returning prev unchanged', () => {
    const prev = createTestGameState({ weeksLived: 300 });
    const first = applyCommitmentChange(prev, 'career', 'health');
    // The same batch, or a later tap within 4 weeks, sees the stamp on prev.
    const second = applyCommitmentChange(first, 'relationships', 'hobbies');
    expect(second).toBe(first);
    expect(second.activityCommitments?.primary).toBe('career');
  });

  it('allows a change again once the 4-week lock has run', () => {
    const prev = createTestGameState({ weeksLived: 300 });
    const first = applyCommitmentChange(prev, 'career', 'health');
    const later = applyCommitmentChange({ ...first, weeksLived: 304 }, 'relationships', undefined);
    expect(later.activityCommitments?.primary).toBe('relationships');
    expect(later.activityCommitments?.lastChangedWeek).toBe(304);
  });

  it('keeps the earned commitment levels', () => {
    const prev = createTestGameState({ weeksLived: 300 });
    const withLevels = {
      ...prev,
      activityCommitments: {
        ...prev.activityCommitments,
        commitmentLevels: { career: 40, hobbies: 10, relationships: 5, health: 20 },
      },
    };
    const next = applyCommitmentChange(withLevels, 'career', 'health');
    expect(next.activityCommitments?.commitmentLevels?.career).toBe(40);
  });

  it('locks a change made at weeksLived 0 (an age-18 life\'s first week)', () => {
    const prev = createTestGameState({ weeksLived: 0 });
    const first = applyCommitmentChange(prev, 'career', 'health');
    expect(first.activityCommitments?.lastChangedWeek).toBe(0);
    expect(applyCommitmentChange(first, 'relationships', undefined)).toBe(first);
  });
});
