/**
 * Parenting action catalog + tuning constants.
 *
 * Design intent: parenting is a LONG investment, not an instant power spike.
 * Effects are small (mostly +1..+4 to a 0-100 nurture stat) and cumulative;
 * per-action cooldowns + a per-child weekly cap keep it from being farmed.
 */
import type { ParentingAction, ParentingAgeBand } from './types';

/** Neutral baseline for a nurture stat that has never been touched. */
export const NURTURE_DEFAULT = 50;
export const NURTURE_MIN = 0;
export const NURTURE_MAX = 100;

/** Max parenting actions per child per game-week (anti-farm cap). */
export const MAX_PARENTING_ACTIONS_PER_WEEK = 3;

/** Parenting only applies to minors; at/after this age the child is grown. */
export const PARENTING_MAX_AGE = 18;

/** Inclusive age ranges for each band. */
export const AGE_BANDS: Record<ParentingAgeBand, { min: number; max: number; label: string }> = {
  baby: { min: 0, max: 2, label: 'Baby' },
  toddler: { min: 3, max: 5, label: 'Toddler' },
  child: { min: 6, max: 12, label: 'Child' },
  teen: { min: 13, max: 18, label: 'Teen' },
};

/**
 * The action catalog. Ordered baby → teen; the UI filters by the child's band.
 * Every id is unique (asserted in tests) and every action lists at least one band.
 */
export const PARENTING_ACTIONS: ParentingAction[] = [
  // ── Baby (0-2) ──────────────────────────────────────────────────────────
  {
    id: 'bedtime_story',
    label: 'Read a Bedtime Story',
    description: 'Wind down together with a picture book.',
    bands: ['baby', 'toddler'],
    moneyCost: 0,
    energyCost: 4,
    cooldownWeeks: 1,
    effects: { intelligence: 1, happiness: 2, relationship: 1 },
    icon: 'BookOpen',
  },
  {
    id: 'playtime',
    label: 'Playtime & Tummy Time',
    description: 'Giggles, blocks and motor-skill play.',
    bands: ['baby'],
    moneyCost: 0,
    energyCost: 5,
    cooldownWeeks: 1,
    effects: { health: 1, happiness: 2, relationship: 1 },
    icon: 'Baby',
  },
  {
    id: 'pediatric_checkup',
    label: 'Pediatric Checkup',
    description: 'Routine wellness visit and vaccinations.',
    bands: ['baby', 'toddler'],
    moneyCost: 200,
    energyCost: 2,
    cooldownWeeks: 4,
    effects: { health: 3 },
    icon: 'Stethoscope',
  },

  // ── Toddler (3-5) ───────────────────────────────────────────────────────
  {
    id: 'park_playdate',
    label: 'Park Playdate',
    description: 'Fresh air, running around and new friends.',
    bands: ['toddler', 'child'],
    moneyCost: 20,
    energyCost: 5,
    cooldownWeeks: 1,
    effects: { health: 1, happiness: 2, relationship: 1 },
    icon: 'Trees',
  },
  {
    id: 'preschool_activity',
    label: 'Enroll in Preschool Activity',
    description: 'Structured play that builds early skills.',
    bands: ['toddler'],
    moneyCost: 300,
    energyCost: 3,
    cooldownWeeks: 3,
    effects: { intelligence: 2, discipline: 1 },
    icon: 'Blocks',
  },

  // ── Child (6-12) ────────────────────────────────────────────────────────
  {
    id: 'help_homework',
    label: 'Help with Homework',
    description: 'Sit down and work through the tricky questions.',
    bands: ['child', 'teen'],
    moneyCost: 0,
    energyCost: 6,
    cooldownWeeks: 1,
    effects: { intelligence: 2, discipline: 1 },
    icon: 'PencilRuler',
  },
  {
    id: 'sports_club',
    label: 'Enroll in a Sports Club',
    description: 'Team sport for fitness and grit.',
    bands: ['child', 'teen'],
    moneyCost: 250,
    energyCost: 4,
    cooldownWeeks: 2,
    effects: { health: 2, discipline: 1, happiness: 1 },
    icon: 'Trophy',
  },
  {
    id: 'music_lessons',
    label: 'Music Lessons',
    description: 'An instrument to grow focus and joy.',
    bands: ['child', 'teen'],
    moneyCost: 300,
    energyCost: 3,
    cooldownWeeks: 2,
    effects: { intelligence: 1, happiness: 2, discipline: 1 },
    icon: 'Music',
  },
  {
    id: 'teach_values',
    label: 'Teach Values',
    description: 'Talk through honesty, kindness and responsibility.',
    bands: ['child', 'teen'],
    moneyCost: 0,
    energyCost: 5,
    cooldownWeeks: 1,
    effects: { discipline: 2, relationship: 1 },
    icon: 'HeartHandshake',
  },
  {
    id: 'family_trip',
    label: 'Plan a Family Trip',
    description: 'A memorable getaway together.',
    bands: ['child', 'teen'],
    moneyCost: 1500,
    energyCost: 8,
    cooldownWeeks: 8,
    effects: { happiness: 4, relationship: 3, health: 1 },
    icon: 'Plane',
  },

  // ── Teen (13-18) ────────────────────────────────────────────────────────
  {
    id: 'fund_tutoring',
    label: 'Fund Tutoring',
    description: 'Private tutoring to lift grades.',
    bands: ['teen'],
    moneyCost: 500,
    energyCost: 2,
    cooldownWeeks: 2,
    effects: { intelligence: 3 },
    icon: 'GraduationCap',
  },
  {
    id: 'heart_to_heart',
    label: 'Have a Heart-to-Heart',
    description: 'Really listen about what is going on.',
    bands: ['teen'],
    moneyCost: 0,
    energyCost: 6,
    cooldownWeeks: 1,
    effects: { happiness: 2, discipline: 1, relationship: 3 },
    icon: 'MessageCircleHeart',
  },
  {
    id: 'give_allowance',
    label: 'Give an Allowance',
    description: 'Teach budgeting with a weekly allowance.',
    bands: ['teen'],
    moneyCost: 200,
    energyCost: 0,
    cooldownWeeks: 1,
    effects: { discipline: 2, happiness: 1 },
    icon: 'Wallet',
  },
  {
    id: 'set_boundaries',
    label: 'Set Boundaries',
    description: 'Firm but fair discipline. Not always popular.',
    bands: ['teen'],
    moneyCost: 0,
    energyCost: 5,
    cooldownWeeks: 1,
    // Intentional trade-off: builds discipline at a small cost to mood & bond.
    effects: { discipline: 3, happiness: -1, relationship: -1 },
    icon: 'ShieldAlert',
  },
  {
    id: 'driving_lessons',
    label: 'Driving Lessons',
    description: 'Independence, responsibility and a rite of passage.',
    bands: ['teen'],
    moneyCost: 600,
    energyCost: 4,
    cooldownWeeks: 4,
    effects: { discipline: 2, happiness: 1, relationship: 1 },
    icon: 'Car',
  },
];
