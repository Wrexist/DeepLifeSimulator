/**
 * Senior / Retirement event pack — the 65+ (and/or retired) chapter. Gentle,
 * dignified beats: wisdom moments, a graceful health check-in, grandchildren
 * milestones, community-elder roles, reflecting on a legacy, and bucket-list
 * nudges. Nothing here is punishing.
 *
 * Gates live in each `condition`: age >= 65 for most, plus one retired-only beat
 * (`state.isRetired`) and one that also needs at least one child (grandchildren).
 *
 * Contract: standard EventTemplate shape spread into `eventTemplates` in
 * engine.ts — same weighted + pity pipeline, same EventChoiceEffects reward path.
 * `generate()` is pure (fresh object, no mutation).
 *
 * Complements — does NOT duplicate — the retirement/elder events already in
 * lifeMilestoneEvents.ts: retirement_party, pension_milestone, elder_health_scare
 * (a scare — this pack's check-in is a calm routine one), grandchild_visit (a
 * weekend stay — this pack's is a milestone like a graduation), retirement_thoughts.
 *
 * Balance: modest effects; the bucket-list trip trades real money for a one-off
 * happiness lift (in-band with romantic_getaway). One event/week + cooldown +
 * non-forceable selection means none is farmable.
 */
import type { EventTemplate } from './engine';
import type { GameState } from '@/contexts/game/types';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

const SENIOR_AGE = 65;

const isSenior = (state: GameState): boolean => (state.date?.age ?? ADULTHOOD_AGE) >= SENIOR_AGE;

const hasChildren = (state: GameState): boolean =>
  Array.isArray(state.family?.children) && state.family.children.length > 0;

const wisdomMoment: EventTemplate = {
  id: 'senior_wisdom_moment',
  category: 'general',
  weight: 0.22,
  condition: isSenior,
  generate: () => ({
    id: 'senior_wisdom_moment',
    description: 'A young person asks you, quite sincerely, what you have learned about life.',
    choices: [
      { id: 'advise', text: 'Share your hard-won advice', effects: { stats: { happiness: 8, reputation: 4 }, karma: { dimension: 'generosity', amount: 2, reason: 'Passed on wisdom' } } },
      { id: 'memoir', text: 'Start writing your memoirs', effects: { stats: { happiness: 9, energy: -3 } } },
    ],
  }),
};

const healthCheckin: EventTemplate = {
  id: 'senior_health_checkin',
  category: 'health',
  weight: 0.22,
  condition: isSenior,
  generate: () => ({
    id: 'senior_health_checkin',
    description: 'Time for your regular check-up. Staying ahead of things keeps you spry.',
    choices: [
      { id: 'checkup', text: 'Go for the full check-up', effects: { money: -60, stats: { health: 8, happiness: 3 } } },
      { id: 'walks', text: 'Keep up your daily walks', effects: { stats: { health: 6, energy: 4, fitness: 5 } } },
    ],
  }),
};

const grandchildMilestone: EventTemplate = {
  id: 'senior_grandchild_milestone',
  category: 'relationship',
  weight: 0.22,
  condition: state => isSenior(state) && hasChildren(state),
  generate: () => ({
    id: 'senior_grandchild_milestone',
    description: 'A grandchild has a big day coming up — a graduation, a recital, a first game.',
    choices: [
      { id: 'attend', text: 'Be there in the front row', effects: { stats: { happiness: 12, energy: -4 } } },
      { id: 'gift', text: 'Send a generous gift', effects: { money: -80, stats: { happiness: 9 }, karma: { dimension: 'generosity', amount: 2, reason: 'Spoiled a grandchild' } } },
    ],
  }),
};

const communityElder: EventTemplate = {
  id: 'senior_community_elder',
  category: 'general',
  weight: 0.2,
  condition: isSenior,
  generate: () => ({
    id: 'senior_community_elder',
    description: 'The neighborhood has come to see you as one of its wise old hands. They could use your time.',
    choices: [
      { id: 'lead', text: 'Lead a community group', effects: { stats: { reputation: 8, happiness: 6, energy: -6 }, karma: { dimension: 'generosity', amount: 2, reason: 'Served the community' } } },
      { id: 'library', text: 'Volunteer at the local library', effects: { stats: { happiness: 7, reputation: 4 }, karma: { dimension: 'generosity', amount: 3, reason: 'Volunteered as an elder' } } },
      { id: 'quiet', text: 'Enjoy the quiet life instead', effects: { stats: { happiness: 5 } } },
    ],
  }),
};

const legacyReflection: EventTemplate = {
  id: 'senior_legacy_reflection',
  category: 'general',
  weight: 0.2,
  condition: isSenior,
  generate: () => ({
    id: 'senior_legacy_reflection',
    description: 'On a slow afternoon you find yourself thinking about what you will leave behind.',
    choices: [
      { id: 'photos', text: 'Organize a lifetime of photos', effects: { stats: { happiness: 9 } } },
      { id: 'stories', text: 'Record the family stories', effects: { stats: { happiness: 8, reputation: 3 } } },
      { id: 'call', text: 'Call everyone you love', effects: { stats: { happiness: 11 } } },
    ],
  }),
};

const bucketList: EventTemplate = {
  id: 'senior_bucket_list',
  category: 'general',
  weight: 0.18,
  condition: isSenior,
  generate: () => ({
    id: 'senior_bucket_list',
    description: 'One item on your bucket list has been waiting a very long time. Maybe now is the moment.',
    choices: [
      { id: 'dream_trip', text: 'Finally take the dream trip', effects: { money: -400, stats: { happiness: 18, energy: -6 } } },
      { id: 'small', text: 'A smaller local adventure', effects: { money: -60, stats: { happiness: 10 } } },
      { id: 'someday', text: 'Someday — not yet', effects: { stats: { happiness: 2 } } },
    ],
  }),
};

const retirementDays: EventTemplate = {
  id: 'senior_retirement_days',
  category: 'general',
  weight: 0.2,
  condition: state => !!state.isRetired,
  generate: () => ({
    id: 'senior_retirement_days',
    description: 'The days are wide open now. How do you like to fill them?',
    choices: [
      { id: 'garden', text: 'Take up gardening', effects: { stats: { happiness: 8, health: 4, energy: 3 } } },
      { id: 'woodwork', text: 'Woodworking in the garage', effects: { stats: { happiness: 7, energy: -3 } } },
      { id: 'cards', text: 'Cards with old friends', effects: { stats: { happiness: 9, reputation: 2 } } },
    ],
  }),
};

export const seniorEventTemplates: EventTemplate[] = [
  wisdomMoment,
  healthCheckin,
  grandchildMilestone,
  communityElder,
  legacyReflection,
  bucketList,
  retirementDays,
  // Fix 6: tag so the weighted picker lifts these out of the generic pool while
  // the player is a senior (age >= 65 and/or retired).
].map(t => ({ ...t, lifeStageTag: 'senior' as const }));
