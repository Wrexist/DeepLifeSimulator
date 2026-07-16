/**
 * Parent event pack — gated on the player actually having a child in the right
 * age band. These are warm, light "moments" from the parenting side of life; the
 * per-child parenting ACTION loop (lib parenting actions) stays canonical for
 * raising nurture stats — this pack only adds flavor beats and never touches that
 * bookkeeping.
 *
 * Contract: standard EventTemplate shape (id/category/weight/condition/generate),
 * spread into `eventTemplates` in engine.ts, so they roll through the same
 * weighted + pity pipeline. Each event references a real child by name and sets
 * `relationId` to that child's id, so any `relationship` delta in a choice lands
 * on the correct child via the resolver. Payoffs flow through the normal
 * EventChoiceEffects; `generate()` is pure (fresh object, no mutation) and picks
 * the referenced child deterministically by week so a given week is stable across
 * resumes.
 *
 * Balance: modest effects, in-band with existing child/family events. One
 * event/week + cooldown + non-forceable selection means none of these is a
 * farmable reward.
 *
 * Complements (does NOT duplicate) the existing child events in
 * lifeMilestoneEvents.ts: child_first_words, child_school_trouble,
 * child_graduation, child_asks_money, empty_nest.
 */
import type { EventTemplate, WeeklyEvent } from './engine';
import type { GameState, ChildInfo } from '@/contexts/game/types';

/** Children within an inclusive age band. */
const childrenInBand = (state: GameState, min: number, max: number): ChildInfo[] =>
  (state.family?.children ?? []).filter(c => typeof c.age === 'number' && c.age >= min && c.age <= max);

/** Deterministic pick keyed on the week so a given week is stable across resumes. */
const seededPick = <T>(items: T[], seed: number): T | undefined => {
  if (items.length === 0) return undefined;
  const x = Math.sin(seed) * 10000;
  const roll = x - Math.floor(x);
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))];
};

const seedFor = (state: GameState, salt: number): number => (state.weeksLived || 0) * 100 + salt;

/** Trivial fallback so generate() always returns a valid event (never crashes). */
const noopEvent = (id: string): WeeklyEvent => ({
  id,
  description: 'You spend a quiet moment thinking about your family.',
  choices: [{ id: 'ok', text: 'Continue', effects: {} }],
});

const firstSteps: EventTemplate = {
  id: 'parent_first_steps',
  category: 'relationship',
  weight: 0.2,
  condition: state => childrenInBand(state, 0, 2).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 0, 2), seedFor(state, 1));
    if (!child) return noopEvent('parent_first_steps');
    return {
      id: 'parent_first_steps',
      description: `${child.name} lets go of the couch and takes their very first wobbly steps!`,
      relationId: child.id,
      choices: [
        { id: 'cheer', text: 'Cheer them on with open arms', effects: { relationship: 4, stats: { happiness: 12 } } },
        { id: 'film', text: 'Scramble for the camera', effects: { relationship: 2, stats: { happiness: 9 } } },
      ],
    };
  },
};

const toothFairy: EventTemplate = {
  id: 'parent_tooth_fairy',
  category: 'relationship',
  weight: 0.2,
  condition: state => childrenInBand(state, 4, 8).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 4, 8), seedFor(state, 2));
    if (!child) return noopEvent('parent_tooth_fairy');
    return {
      id: 'parent_tooth_fairy',
      description: `${child.name} lost their first tooth and left it under the pillow, wide-eyed with hope.`,
      relationId: child.id,
      choices: [
        { id: 'fairy', text: 'Play tooth fairy (leave a coin)', effects: { money: -5, relationship: 4, stats: { happiness: 8 } } },
        { id: 'truth', text: 'Gently tell them the truth', effects: { relationship: 2, stats: { happiness: 4 } } },
      ],
    };
  },
};

const schoolPlay: EventTemplate = {
  id: 'parent_school_play',
  category: 'relationship',
  weight: 0.22,
  condition: state => childrenInBand(state, 5, 12).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 5, 12), seedFor(state, 3));
    if (!child) return noopEvent('parent_school_play');
    return {
      id: 'parent_school_play',
      description: `${child.name} has a part in the school play and keeps asking if you'll be there.`,
      relationId: child.id,
      choices: [
        { id: 'front_row', text: 'Take the afternoon off, front row', effects: { relationship: 6, stats: { happiness: 10, energy: -3 } } },
        { id: 'sneak_late', text: 'Slip in for the second half', effects: { relationship: 2, stats: { happiness: 4 } } },
        { id: 'work', text: 'Stay at work — pick up a shift', effects: { money: 80, relationship: -8, stats: { happiness: -4 }, karma: { dimension: 'loyalty', amount: -2, reason: 'Missed the school play for work' } } },
      ],
    };
  },
};

const teacherConference: EventTemplate = {
  id: 'parent_teacher_conference',
  category: 'general',
  weight: 0.2,
  condition: state => childrenInBand(state, 6, 17).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 6, 17), seedFor(state, 4));
    if (!child) return noopEvent('parent_teacher_conference');
    return {
      id: 'parent_teacher_conference',
      description: `It's parent-teacher conference night for ${child.name}.`,
      relationId: child.id,
      choices: [
        { id: 'engage', text: 'Go and really listen', effects: { relationship: 6, stats: { happiness: 3, energy: -3 }, karma: { dimension: 'loyalty', amount: 2, reason: 'Engaged parent' } } },
        { id: 'brief', text: 'Drop in for five minutes', effects: { relationship: 2 } },
        { id: 'skip', text: 'Skip it this time', effects: { relationship: -3 } },
      ],
    };
  },
};

const bondingDay: EventTemplate = {
  id: 'parent_bonding_day',
  category: 'relationship',
  weight: 0.2,
  condition: state => childrenInBand(state, 3, 12).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 3, 12), seedFor(state, 5));
    if (!child) return noopEvent('parent_bonding_day');
    return {
      id: 'parent_bonding_day',
      description: `A rare free Saturday with ${child.name}. How do you spend it?`,
      relationId: child.id,
      choices: [
        { id: 'park', text: 'A whole day at the park', effects: { relationship: 6, stats: { happiness: 9, energy: -5 } } },
        { id: 'errands', text: 'Run errands together', effects: { relationship: 2, stats: { happiness: 4 } } },
        { id: 'screens', text: 'Everyone on their own screens', effects: { relationship: -2, stats: { happiness: 2 }, karma: { dimension: 'loyalty', amount: -2, reason: 'Missed a chance to connect' } } },
      ],
    };
  },
};

const teenCurfew: EventTemplate = {
  id: 'parent_teen_curfew',
  category: 'relationship',
  weight: 0.22,
  condition: state => childrenInBand(state, 13, 17).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 13, 17), seedFor(state, 6));
    if (!child) return noopEvent('parent_teen_curfew');
    return {
      id: 'parent_teen_curfew',
      description: `${child.name} rolls in two hours past curfew, bracing for a fight.`,
      relationId: child.id,
      choices: [
        { id: 'talk', text: 'Sit down for a calm talk', effects: { relationship: 5, stats: { happiness: -2 }, karma: { dimension: 'loyalty', amount: 2, reason: 'Patient parenting' } } },
        { id: 'ground', text: 'Ground them on the spot', effects: { relationship: -6, stats: { happiness: -2 } } },
        { id: 'slide', text: 'Let it slide', effects: { relationship: 2, karma: { dimension: 'loyalty', amount: -2, reason: 'Let a curfew slide' } } },
      ],
    };
  },
};

const proudMilestone: EventTemplate = {
  id: 'parent_proud_milestone',
  category: 'relationship',
  weight: 0.2,
  condition: state => childrenInBand(state, 10, 18).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 10, 18), seedFor(state, 7));
    if (!child) return noopEvent('parent_proud_milestone');
    return {
      id: 'parent_proud_milestone',
      description: `${child.name} just won an award and comes running home beaming.`,
      relationId: child.id,
      choices: [
        { id: 'celebrate', text: 'Throw a little celebration', effects: { money: -60, relationship: 8, stats: { happiness: 14 } } },
        { id: 'quiet_pride', text: 'Tell them how proud you are', effects: { relationship: 5, stats: { happiness: 10 } } },
      ],
    };
  },
};

const grownChildVisit: EventTemplate = {
  id: 'parent_grown_child_visit',
  category: 'relationship',
  weight: 0.2,
  condition: state => childrenInBand(state, 18, 200).length > 0,
  generate: state => {
    const child = seededPick(childrenInBand(state, 18, 200), seedFor(state, 8));
    if (!child) return noopEvent('parent_grown_child_visit');
    return {
      id: 'parent_grown_child_visit',
      description: `${child.name}, all grown up now, is coming home to visit for the weekend.`,
      relationId: child.id,
      choices: [
        { id: 'big_dinner', text: 'Cook their favorite big dinner', effects: { money: -80, relationship: 6, stats: { happiness: 12 } } },
        { id: 'low_key', text: 'Keep it easy and low-key', effects: { relationship: 4, stats: { happiness: 8 } } },
      ],
    };
  },
};

export const parentEventTemplates: EventTemplate[] = [
  firstSteps,
  toothFairy,
  schoolPlay,
  teacherConference,
  bondingDay,
  teenCurfew,
  proudMilestone,
  grownChildVisit,
  // Fix 6: tag so the weighted picker lifts these out of the generic pool while
  // the player actually has a child in the relevant age band.
].map(t => ({ ...t, lifeStageTag: 'parent' as const }));
