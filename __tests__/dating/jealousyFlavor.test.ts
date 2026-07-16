/**
 * Jealousy confrontation content — copy + choice-set tests.
 */
import {
  getJealousyFlavor,
  getJealousyChoices,
  pickJealousyAccusation,
  JEALOUSY_CONFESS_SEVERITY,
  JEALOUSY_SEVERE_TONE_SEVERITY,
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

describe('pickJealousyAccusation', () => {
  it('offers multiple distinct variants per trigger (no single canned line)', () => {
    TRIGGERS.forEach((t) => {
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        seen.add(pickJealousyAccusation(t, { severity: 30, roll: i / 12, partnerName: 'Alex' }));
      }
      expect(seen.size).toBeGreaterThanOrEqual(3);
    });
  });

  it('interpolates the partner name and never leaves a raw {partner} token', () => {
    // Sweep rolls + both tone bands so the placeholder-bearing lines are hit.
    for (const severity of [10, 90]) {
      for (let i = 0; i < 20; i++) {
        const line = pickJealousyAccusation('spotted_swiping', { severity, roll: i / 20, partnerName: 'Sam' });
        expect(line).not.toContain('{partner}');
      }
    }
    // A line that carries the token resolves to the supplied name.
    const named = pickJealousyAccusation('multiple_dating', { severity: 90, roll: 0.5, partnerName: 'Riley' });
    const generic = pickJealousyAccusation('multiple_dating', { severity: 90, roll: 0.5 });
    expect(named).toContain('Riley');
    expect(generic).toContain('your partner');
  });

  it('uses a harsher tone band at/above the severe threshold', () => {
    // The mild and severe bands are disjoint sets, so a fixed roll flips lines
    // exactly at the threshold.
    const below = pickJealousyAccusation('flirty_dm', { severity: JEALOUSY_SEVERE_TONE_SEVERITY - 1, roll: 0, partnerName: 'X' });
    const at = pickJealousyAccusation('flirty_dm', { severity: JEALOUSY_SEVERE_TONE_SEVERITY, roll: 0, partnerName: 'X' });
    expect(below).not.toBe(at);
  });

  it('is deterministic for a fixed roll + severity + name', () => {
    const a = pickJealousyAccusation('rumored_affair', { severity: 50, roll: 0.33, partnerName: 'Jo' });
    const b = pickJealousyAccusation('rumored_affair', { severity: 50, roll: 0.33, partnerName: 'Jo' });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('falls back gracefully for an unknown trigger', () => {
    const line = pickJealousyAccusation('mystery' as any, { severity: 20, roll: 0.1, partnerName: 'Y' });
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain('{partner}');
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
