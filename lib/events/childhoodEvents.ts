/**
 * Teen event pack — age-gated "growing up" moments (age 13-17).
 *
 * Most lives start at 18 (adult) or older and the player only ages UP, so these
 * can ONLY fire for a life that begins young — e.g. an age-16 start, which reaches
 * the top of this 13-17 band. The gate lives entirely in each template's
 * `condition`, keyed strictly on `state.date.age` (13-17). A 40-year-old never
 * sees any of these.
 *
 * HISTORY: the first five templates below were originally banded 5-12 (childhood).
 * Because no start scenario begins below 16, that band was UNREACHABLE, so they
 * were re-banded to 13-17 (teen) with age-appropriate copy — a class presentation
 * instead of show-and-tell, the cafeteria instead of the playground, etc. A true
 * childhood-start scenario (begin the sim at ~5 and grow up through these years)
 * is left as FUTURE WORK — deliberately not built here.
 *
 * Contract: these reuse the standard EventTemplate shape (id/category/weight/
 * condition/generate) and are spread into `eventTemplates` in engine.ts, so they
 * roll through the exact same weighted + pity pipeline as every other event —
 * no new engine, no new reward path. All payoffs flow through the normal
 * EventChoiceEffects (money/stats), applied by the resolver when the player picks
 * a choice. `generate()` is pure: it returns a fresh event object and never
 * mutates module-level or game state.
 *
 * Every template is tagged `lifeStageTag: 'teen'` (via the export map) so the
 * engine's weighted picker lifts them out of the ~150-template generic pool while
 * the player is actually in this chapter.
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

// ── Early teen (re-banded from the old 5-12 childhood set to 13-17) ─────────

const childShowAndTell: EventTemplate = {
  id: 'child_show_and_tell',
  category: 'general',
  weight: 0.22,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'child_show_and_tell',
    description: "It's your turn to give a class presentation. How do you play it?",
    choices: [
      { id: 'treasure', text: 'Present a passion project you care about', effects: { stats: { happiness: 8, reputation: 2 } } },
      { id: 'rock', text: 'Wing it with a cool fact you know', effects: { stats: { happiness: 5 } } },
      { id: 'nothing', text: 'Mumble through it from the back', effects: { stats: { happiness: 2 } } },
    ],
  }),
};

const childPlaygroundFriend: EventTemplate = {
  id: 'child_playground_friend',
  category: 'general',
  weight: 0.22,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'child_playground_friend',
    description: 'A new kid is sitting alone in the cafeteria, looking a little lost.',
    choices: [
      { id: 'befriend', text: 'Wave them over to your table', effects: { stats: { happiness: 10, energy: -3 }, karma: { dimension: 'generosity', amount: 2, reason: 'Welcomed the new kid' } } },
      { id: 'shy', text: 'Keep to yourself', effects: { stats: { happiness: 3 } } },
    ],
  }),
};

const childDiscoverTalent: EventTemplate = {
  id: 'child_discover_talent',
  category: 'general',
  weight: 0.2,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'child_discover_talent',
    description: 'A teacher pulls you aside — you have a real knack for something: art, music, or numbers.',
    choices: [
      { id: 'lean_in', text: 'Throw yourself into it after school', effects: { stats: { happiness: 8, reputation: 3 } } },
      { id: 'shrug', text: 'Eh, maybe later', effects: { stats: { happiness: 3 } } },
    ],
  }),
};

const childFirstAllowance: EventTemplate = {
  id: 'child_first_allowance',
  category: 'economy',
  weight: 0.2,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'child_first_allowance',
    description: 'Your parents bump up your allowance now that you\'re older — real pocket money at last. What do you do with it?',
    choices: [
      { id: 'save', text: 'Stash it in your savings', effects: { money: 15, stats: { happiness: 3 } } },
      { id: 'sweets', text: 'Blow it on snacks and games', effects: { money: 5, stats: { happiness: 8 } } },
    ],
  }),
};

const childFamilyTrip: EventTemplate = {
  id: 'child_family_trip',
  category: 'general',
  weight: 0.2,
  condition: state => inAgeBand(state, 13, 17),
  generate: () => ({
    id: 'child_family_trip',
    description: 'The whole family piles into the car for a weekend road trip.',
    choices: [
      { id: 'enjoy', text: 'Take over as the road-trip DJ', effects: { stats: { happiness: 10 } } },
      { id: 'sulk', text: 'Sulk in the back with your headphones on', effects: { stats: { happiness: 2, energy: 3 } } },
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
  // Early teen (re-banded from the old 5-12 childhood set)
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
  // Fix 6: tag the whole pack so the engine's weighted picker lifts these teen
  // beats out of the generic pool while the player is in the 13-17 band.
].map(t => ({ ...t, lifeStageTag: 'teen' as const }));
