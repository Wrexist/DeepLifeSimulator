/**
 * Midlife event pack — the ~50-64 chapter. Reflection, a health wake-up, the
 * career peak/plateau, caring for aging parents, reconnecting with old friends,
 * and reinvention. Gated strictly on `state.date.age` (50-64) so they only fire
 * in that window; the career beat additionally needs an active job.
 *
 * Contract: standard EventTemplate shape spread into `eventTemplates` in
 * engine.ts — same weighted + pity pipeline, same EventChoiceEffects reward path.
 * `generate()` is pure (returns a fresh object, no mutation). None of these carry
 * a `relationship` delta, so they never misroute onto a random relationship.
 *
 * Balance: modest, in-band with existing age events (midlife_crisis,
 * retirement_thoughts). One event/week + cooldown keeps them non-farmable.
 * Complements — does not duplicate — midlife_crisis (age 40-50) and
 * retirement_thoughts (age 55+) in lifeMilestoneEvents.ts.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

const MIDLIFE_MIN = 50;
const MIDLIFE_MAX = 64;

const inMidlife = (state: GameState): boolean => {
  const age = state.date?.age ?? ADULTHOOD_AGE;
  return age >= MIDLIFE_MIN && age <= MIDLIFE_MAX;
};

const reflection: EventTemplate = {
  id: 'midlife_reflection',
  category: 'general',
  weight: 0.2,
  condition: inMidlife,
  generate: () => ({
    id: 'midlife_reflection',
    description: 'Halfway through the story, you catch yourself wondering what the rest should be about.',
    choices: [
      { id: 'journal', text: 'Journal and set fresh goals', effects: { stats: { happiness: 8, energy: 3 } } },
      { id: 'bold', text: 'Sketch out a bold change', effects: { stats: { happiness: 6, energy: 5 } } },
      { id: 'gratitude', text: 'Sit with quiet gratitude', effects: { stats: { happiness: 10 } } },
    ],
  }),
};

const healthWakeup: EventTemplate = {
  id: 'midlife_health_wakeup',
  category: 'health',
  weight: 0.22,
  condition: inMidlife,
  generate: () => ({
    id: 'midlife_health_wakeup',
    description: 'A routine check-up comes back with a gentle warning: time to take your health seriously.',
    choices: [
      { id: 'diet', text: 'Overhaul your diet', effects: { money: -40, stats: { health: 10, happiness: 3 } } },
      { id: 'walk', text: 'Start walking every day', effects: { stats: { health: 7, energy: 5, fitness: 6 } } },
      { id: 'ignore', text: 'Ignore it for now', effects: { stats: { health: -8, happiness: -3 } } },
    ],
  }),
};

const careerPeak: EventTemplate = {
  id: 'midlife_career_peak',
  category: 'general',
  weight: 0.2,
  condition: state => inMidlife(state) && !!state.currentJob,
  generate: () => ({
    id: 'midlife_career_peak',
    description: "You're at the top of your game at work. Do you climb higher or share the view?",
    choices: [
      { id: 'mentor', text: 'Mentor the juniors', effects: { stats: { reputation: 8, happiness: 6, energy: -5 }, karma: { dimension: 'generosity', amount: 2, reason: 'Mentored younger colleagues' } } },
      { id: 'promotion', text: 'Push for one more promotion', effects: { money: 150, stats: { reputation: 5, energy: -12, happiness: -3 } } },
      { id: 'coast', text: 'Coast comfortably', effects: { stats: { happiness: 5, reputation: -3 } } },
    ],
  }),
};

const agingParents: EventTemplate = {
  id: 'midlife_aging_parents',
  category: 'relationship',
  weight: 0.2,
  condition: inMidlife,
  generate: () => ({
    id: 'midlife_aging_parents',
    description: 'Your parents are getting on in years and starting to need more help around the house.',
    choices: [
      { id: 'take_in', text: 'Have them move in with you', effects: { money: -50, stats: { happiness: 5, energy: -8 }, karma: { dimension: 'loyalty', amount: 4, reason: 'Took in aging parents' } } },
      { id: 'hire_help', text: 'Hire some in-home help', effects: { money: -150, stats: { happiness: 3 }, karma: { dimension: 'generosity', amount: 2, reason: 'Arranged care for parents' } } },
      { id: 'visit', text: 'Visit and pitch in every week', effects: { stats: { happiness: 6, energy: -5 }, karma: { dimension: 'loyalty', amount: 3, reason: 'Cared for aging parents' } } },
    ],
  }),
};

const reconnectFriend: EventTemplate = {
  id: 'midlife_reconnect_friend',
  category: 'relationship',
  weight: 0.2,
  condition: inMidlife,
  generate: () => ({
    id: 'midlife_reconnect_friend',
    description: 'An old friend from way back pops into your head. You still have their number.',
    choices: [
      { id: 'reunion', text: 'Plan a proper reunion', effects: { stats: { happiness: 10, reputation: 3, energy: -4 } } },
      { id: 'text', text: 'Send a quick message', effects: { stats: { happiness: 6 } } },
      { id: 'later', text: "Maybe later - you're busy", effects: { stats: { happiness: -2 } } },
    ],
  }),
};

const reinvention: EventTemplate = {
  id: 'midlife_reinvention',
  category: 'general',
  weight: 0.2,
  condition: inMidlife,
  generate: () => ({
    id: 'midlife_reinvention',
    description: 'It occurs to you that it is not too late to become someone a little new.',
    choices: [
      { id: 'class', text: 'Enroll in a night class', effects: { money: -60, stats: { happiness: 8, energy: -5, reputation: 3 } } },
      { id: 'passion', text: 'Start a long-shelved passion project', effects: { stats: { happiness: 9, energy: -4 } } },
      { id: 'steady', text: 'Stay the course you know', effects: { stats: { happiness: 3 } } },
    ],
  }),
};

export const midlifeEventTemplates: EventTemplate[] = [
  reflection,
  healthWakeup,
  careerPeak,
  agingParents,
  reconnectFriend,
  reinvention,
  // Fix 6: tag so the weighted picker lifts these out of the generic pool while
  // the player is in the 50-64 midlife band.
].map(t => ({ ...t, lifeStageTag: 'midlife' as const }));
