/**
 * Childhood & Teen event pack — age-gated "growing up" moments.
 *
 * Most lives start at 18 (adult) or older, and the player ages UP over a life,
 * so these can ONLY fire for a life that actually begins young (e.g. the age-16
 * scenario, or any young-start path). The gate lives entirely in each template's
 * `condition`, keyed strictly on `state.date.age`:
 *   - child : age 5-12
 *   - teen  : age 13-17
 * A 40-year-old will never see any of these.
 *
 * Contract: these reuse the standard EventTemplate shape (id/category/weight/
 * condition/generate) and are spread into `eventTemplates` in engine.ts, so they
 * roll through the exact same weighted + pity pipeline as every other event —
 * no new engine, no new reward path. All payoffs flow through the normal
 * EventChoiceEffects (money/stats), applied by the resolver when the player picks
 * a choice. `generate()` is pure: it returns a fresh event object and never
 * mutates module-level or game state.
 *
 * Balance: effects are deliberately tiny and age-fitting (allowance-scale money,
 * small happiness/energy swings). With one event/week + cooldown + the fact that
 * the player can't choose which event fires, none of these is farmable.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

const playerAge = (state: GameState): number => state.date?.age ?? ADULTHOOD_AGE;

/** True when the player themself is within an (inclusive) age band. */
const inAgeBand = (state: GameState, min: number, max: number): boolean => {
  const age = playerAge(state);
  return age >= min && age <= max;
};

// ── Childhood (age 5-12) ──────────────────────────────────────────────────

const childShowAndTell: EventTemplate = {
  id: 'child_show_and_tell',
  category: 'general',
  weight: 0.22,
  condition: state => inAgeBand(state, 5, 12),
  generate: () => ({
    id: 'child_show_and_tell',
    description: "It's show-and-tell day at school. What do you bring in?",
    choices: [
      { id: 'treasure', text: 'Your most treasured toy', effects: { stats: { happiness: 8, reputation: 2 } } },
      { id: 'rock', text: 'A cool rock you found', effects: { stats: { happiness: 5 } } },
      { id: 'nothing', text: 'Stay quiet at the back', effects: { stats: { happiness: 2 } } },
    ],
  }),
};

const childPlaygroundFriend: EventTemplate = {
  id: 'child_playground_friend',
  category: 'general',
  weight: 0.22,
  condition: state => inAgeBand(state, 5, 12),
  generate: () => ({
    id: 'child_playground_friend',
    description: 'A new kid at the playground looks a little lonely by the swings.',
    choices: [
      { id: 'befriend', text: 'Go say hi and share the swings', effects: { stats: { happiness: 10, energy: -3 }, karma: { dimension: 'generosity', amount: 2, reason: 'Welcomed a lonely kid' } } },
      { id: 'shy', text: 'Play by yourself', effects: { stats: { happiness: 3 } } },
    ],
  }),
};

const childDiscoverTalent: EventTemplate = {
  id: 'child_discover_talent',
  category: 'general',
  weight: 0.2,
  condition: state => inAgeBand(state, 8, 12),
  generate: () => ({
    id: 'child_discover_talent',
    description: 'A teacher notices you have a real knack for something — art, music, or numbers.',
    choices: [
      { id: 'lean_in', text: 'Practice it every chance you get', effects: { stats: { happiness: 8, reputation: 3 } } },
      { id: 'shrug', text: 'Eh, maybe later', effects: { stats: { happiness: 3 } } },
    ],
  }),
};

const childFirstAllowance: EventTemplate = {
  id: 'child_first_allowance',
  category: 'economy',
  weight: 0.2,
  condition: state => inAgeBand(state, 8, 12),
  generate: () => ({
    id: 'child_first_allowance',
    description: 'You earned your very first allowance for helping with chores. What do you do with it?',
    choices: [
      { id: 'save', text: 'Put it in your piggy bank', effects: { money: 15, stats: { happiness: 3 } } },
      { id: 'sweets', text: 'Blow it all on candy', effects: { money: 5, stats: { happiness: 8 } } },
    ],
  }),
};

const childFamilyTrip: EventTemplate = {
  id: 'child_family_trip',
  category: 'general',
  weight: 0.2,
  condition: state => inAgeBand(state, 5, 15),
  generate: () => ({
    id: 'child_family_trip',
    description: 'The whole family piles into the car for a weekend road trip.',
    choices: [
      { id: 'enjoy', text: 'Sing along the whole way', effects: { stats: { happiness: 10 } } },
      { id: 'sulk', text: 'Sulk in the back seat', effects: { stats: { happiness: 2, energy: 3 } } },
    ],
  }),
};

// ── Teen (age 13-17) ──────────────────────────────────────────────────────

const teenFirstCrush: EventTemplate = {
  id: 'teen_first_crush',
  category: 'relationship',
  weight: 0.22,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'teen_first_crush',
    description: 'Your heart does a flip every time a certain classmate walks by. Your very first crush.',
    choices: [
      { id: 'say_hi', text: 'Work up the nerve to say hi', effects: { stats: { happiness: 10, energy: -3 } } },
      { id: 'note', text: 'Slip them a note', effects: { stats: { happiness: 7 } } },
      { id: 'secret', text: 'Keep it your secret', effects: { stats: { happiness: 3 } } },
    ],
  }),
};

const teenRebellion: EventTemplate = {
  id: 'teen_rebellion',
  category: 'general',
  weight: 0.22,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'teen_rebellion',
    description: 'A restless, rebellious streak is building. You need to let some of it out.',
    choices: [
      { id: 'sneak_out', text: 'Sneak out to meet friends', effects: { stats: { happiness: 8, energy: -8, reputation: -3 } } },
      { id: 'argue', text: 'Argue with your parents', effects: { stats: { happiness: -3, energy: -3 } } },
      { id: 'channel', text: 'Channel it into music or art', effects: { stats: { happiness: 7, reputation: 2 } } },
    ],
  }),
};

const teenFirstJob: EventTemplate = {
  id: 'teen_first_job',
  category: 'economy',
  weight: 0.2,
  condition: state => inAgeBand(state, 15, 17),
  generate: () => ({
    id: 'teen_first_job',
    description: 'The corner store is hiring for weekend shifts — your first real job.',
    choices: [
      { id: 'take_it', text: 'Take the shifts', effects: { money: 40, stats: { energy: -10, happiness: 3 } } },
      { id: 'studies', text: 'Focus on your studies instead', effects: { stats: { happiness: 5, reputation: 2 } } },
    ],
  }),
};

const teenExamWeek: EventTemplate = {
  id: 'teen_exam_week',
  category: 'general',
  weight: 0.2,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'teen_exam_week',
    description: 'Big exams are coming up and the pressure is on.',
    choices: [
      { id: 'study', text: 'Study hard all week', effects: { stats: { happiness: -3, energy: -8, reputation: 4 } } },
      { id: 'cram', text: 'Cram the night before', effects: { stats: { energy: -10, happiness: -2 } } },
      { id: 'blow_off', text: 'Blow it off with friends', effects: { stats: { happiness: 5, reputation: -4 } } },
    ],
  }),
};

export const childhoodEventTemplates: EventTemplate[] = [
  // Childhood (5-12)
  childShowAndTell,
  childPlaygroundFriend,
  childDiscoverTalent,
  childFirstAllowance,
  childFamilyTrip,
  // Teen (13-17)
  teenFirstCrush,
  teenRebellion,
  teenFirstJob,
  teenExamWeek,
];
