/**
 * Jealousy confrontation content — copy + choice-set tests.
 */
import {
  getJealousyFlavor,
  getJealousyChoices,
  JEALOUSY_CONFESS_SEVERITY,
} from '@/lib/dating/jealousyFlavor';
import type { SparkJealousyEvent, SparkJealousyOutcome } from '@/contexts/game/types';

const TRIGGERS: SparkJealousyEvent['triggerType'][] = [
  'spotted_swiping',
  'rumored_affair',
  'multiple_dating',
  'flirty_dm',
];

const VALID_OUTCOMES: SparkJealousyOutcome[] = [
  'caught_cheating',
  'denied',
  'admitted',
  'confronted',
  'dismissed',
];

describe('getJealousyFlavor', () => {
  it('returns distinct copy per trigger type', () => {
    const titles = TRIGGERS.map((t) => getJealousyFlavor(t).title);
    expect(new Set(titles).size).toBe(TRIGGERS.length);
    TRIGGERS.forEach((t) => {
      const f = getJealousyFlavor(t);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.accusation.length).toBeGreaterThan(0);
    });
  });

  it('falls back gracefully for an unknown trigger', () => {
    expect(getJealousyFlavor('mystery' as any)).toBe(getJealousyFlavor('spotted_swiping'));
  });
});

describe('getJealousyChoices', () => {
  it('offers the four base outcomes for a low-severity event (no affair confession)', () => {
    const outcomes = getJealousyChoices(40).map((c) => c.outcome);
    expect(outcomes).toEqual(expect.arrayContaining(['denied', 'admitted', 'dismissed', 'confronted']));
    expect(outcomes).not.toContain('caught_cheating');
  });

  it('adds the confess (caught_cheating) option at/above the confess threshold', () => {
    const outcomes = getJealousyChoices(JEALOUSY_CONFESS_SEVERITY).map((c) => c.outcome);
    expect(outcomes).toContain('caught_cheating');
  });

  it('every choice maps to a valid SparkJealousyOutcome with copy', () => {
    getJealousyChoices(90).forEach((c) => {
      expect(VALID_OUTCOMES).toContain(c.outcome);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
      expect(['neutral', 'soft', 'destructive']).toContain(c.tone);
    });
  });
});
