/**
 * A life-moment choice is ONE atomic transition (2026-10-17 audit, CLAUDE.md
 * §4.4). The modal used to apply money, stats, karma and consequences as
 * separate dispatches with only the money leg able to refuse, so a refused
 * "Go all in" (-$5,000) still granted +6 happiness and queued the
 * `startup_payout` unlock.
 */
import {
  resolveLifeMomentChoice,
  dismissLifeMoment,
  canAffordLifeMomentChoice,
  lifeMomentChoiceCost,
  lifeMomentEffectLabel,
} from '../lifeMomentResolution';
import { INITIAL_KARMA } from '@/lib/karma/karmaSystem';
import type { GameState } from '@/contexts/game/types';
import type { LifeMoment } from '@/lib/lifeMoments/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const windfall: LifeMoment = {
  id: 'moment-windfall-1',
  situation: 'An old investment quietly matured into a $5,000 windfall.',
  category: 'money',
  createdAt: 0,
  choices: [
    {
      id: 'gamble',
      text: 'Go all in on the startup',
      quickEffect: [
        { stat: 'money', amount: -5000, label: '-$5,000' },
        { stat: 'happiness', amount: 6, label: '+6 Happiness' },
      ],
      karma: { dimension: 'honesty', amount: 2, reason: 'test' },
      hiddenConsequences: [
        { type: 'unlock_event', targetEventId: 'startup_payout', weeksUntilActive: 8, description: 'pays off or busts' },
      ],
    },
    { id: 'bank', text: 'Bank the windfall', quickEffect: [{ stat: 'money', amount: 5000, label: '+$5,000' }] },
  ],
};

const withMoment = (cash: number): GameState =>
  createTestGameState({
    weeksLived: 300,
    stats: { money: cash, happiness: 40 },
    bankSavings: 200_000,
    karma: INITIAL_KARMA,
    lifeMoments: { lastMomentWeek: 300, momentsThisWeek: 1, totalMoments: 3, pendingMoment: windfall },
  });

describe('resolveLifeMomentChoice', () => {
  it('an unaffordable choice changes NOTHING - no happiness, no karma, no unlock, moment still up', () => {
    const prev = withMoment(1_000);
    const next = resolveLifeMomentChoice(prev, windfall.id, 'gamble');
    expect(next).toBe(prev);
    expect(next.lifeMoments?.pendingMoment?.id).toBe(windfall.id);
  });

  it('an affordable choice applies every leg and clears the moment in the same transition', () => {
    const prev = withMoment(10_000);
    const next = resolveLifeMomentChoice(prev, windfall.id, 'gamble');
    expect(next.stats.money).toBe(5_000);
    expect(next.stats.happiness).toBeGreaterThan(40);
    expect(next.karma).not.toBe(prev.karma);
    expect(next.consequenceState?.consequences.some((c) => c.targetEventId === 'startup_payout')).toBe(true);
    expect(next.lifeMoments?.pendingMoment).toBeUndefined();
    // Resolving does not re-count the moment (it was counted at generation).
    expect(next.lifeMoments?.totalMoments).toBe(3);
  });

  it('a same-batch double tap pays once: the second updater finds no pending moment', () => {
    const once = resolveLifeMomentChoice(withMoment(0), windfall.id, 'bank');
    const twice = resolveLifeMomentChoice(once, windfall.id, 'bank');
    expect(once.stats.money).toBe(5_000);
    expect(twice).toBe(once);
  });

  it('an unknown choice or a stale moment id is a no-op', () => {
    const prev = withMoment(10_000);
    expect(resolveLifeMomentChoice(prev, windfall.id, 'nope')).toBe(prev);
    expect(resolveLifeMomentChoice(prev, 'some-other-moment', 'bank')).toBe(prev);
  });
});

describe('affordability helpers the modal disables buttons with', () => {
  it('cost is the net cash taken; gains cost nothing', () => {
    expect(lifeMomentChoiceCost(windfall.choices[0])).toBe(5_000);
    expect(lifeMomentChoiceCost(windfall.choices[1])).toBe(0);
    expect(canAffordLifeMomentChoice(windfall.choices[0], 4_999)).toBe(false);
    expect(canAffordLifeMomentChoice(windfall.choices[0], 5_000)).toBe(true);
  });
});

describe('dismissLifeMoment', () => {
  it('clears only the moment it was asked to clear', () => {
    const prev = withMoment(0);
    expect(dismissLifeMoment(prev, windfall.id).lifeMoments?.pendingMoment).toBeUndefined();
    expect(dismissLifeMoment(prev, 'a-newer-moment')).toBe(prev);
  });
});

describe('lifeMomentEffectLabel - the chip states what the resolver applies', () => {
  const party: LifeMoment = {
    id: 'moment-party-1',
    situation: 'A friend throws you a party.',
    category: 'social',
    createdAt: 0,
    choices: [{ id: 'go', text: 'Go', quickEffect: [{ stat: 'happiness', amount: 10, label: '+10 Happiness' }] }],
  };
  const gain = party.choices[0].quickEffect[0];
  const at = (happiness: number): GameState =>
    createTestGameState({
      weeksLived: 300,
      stats: { money: 0, happiness },
      lifeMoments: { lastMomentWeek: 300, momentsThisWeek: 1, totalMoments: 1, pendingMoment: party },
    });

  it('a happy life sees the scaled gain - the number that actually lands, not the authored +10', () => {
    const prev = at(90);
    const next = resolveLifeMomentChoice(prev, party.id, 'go');
    const landed = Math.round(next.stats.happiness - prev.stats.happiness);
    expect(lifeMomentEffectLabel(gain, prev.stats.happiness)).toBe(`+${landed} Happiness`);
    expect(landed).toBeLessThan(10);
  });

  it('a low-happiness life sees the full authored gain', () => {
    expect(lifeMomentEffectLabel(gain, 30)).toBe('+10 Happiness');
  });

  it('losses and other stats keep their authored label', () => {
    expect(lifeMomentEffectLabel({ stat: 'happiness', amount: -3, label: '-3 Happiness' }, 95)).toBe('-3 Happiness');
    expect(lifeMomentEffectLabel({ stat: 'money', amount: 500, label: '+$500' }, 95)).toBe('+$500');
  });
});
