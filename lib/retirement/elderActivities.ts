/**
 * Elder activities — age-appropriate things a retiree/elder can do for modest,
 * bounded happiness / health / reputation / legacy effects, each with a money
 * cost and a per-activity cooldown.
 *
 * All logic is pure. `applyElderActivity` deducts money through the canonical
 * `applyMoneyDelta` helper (overdraft-rejecting, NaN-guarded, mirror-safe — it
 * only moves `stats.money`), so an activity can never push money negative and no
 * money is minted. Stat effects are clamped 0–100.
 *
 * These are the elder chapter's answer to "health in old age": they let a player
 * shore up happiness/health — there is no new punishing decay model; the existing
 * natural stat decay + old-age death roll are reused unchanged.
 */
import type { GameState, GameStats } from '@/contexts/game/types';
import { applyMoneyDelta } from '@/lib/economy/moneyDelta';
import { getAge, isRetired } from './pension';
import { RETIREMENT_AGE, EARLY_RETIRE_MIN_AGE } from './constants';

export type ElderActivityId =
  | 'write_memoir'
  | 'mentor_youth'
  | 'spoil_grandchildren'
  | 'bucket_list_trip'
  | 'volunteer'
  | 'reconnect_friends'
  // Suited to early (FIRE) retirees who still have decades of energy.
  | 'coach_sports'
  | 'travel_club'
  | 'part_time_consulting'
  | 'lifelong_learning';

export interface ElderActivity {
  id: ElderActivityId;
  label: string;
  description: string;
  /** lucide-react-native icon name hint for the UI. */
  icon: string;
  emoji: string;
  /** Money cost in dollars (>= 0). Deducted via the canonical money path. */
  moneyCost: number;
  /** Weeks that must elapse before this activity can be repeated. */
  cooldownWeeks: number;
  /** Minimum age required (all default to the elder threshold). */
  minAge: number;
  /** When true, needs at least one child in the family (grandchildren flavour). */
  requiresChildren?: boolean;
  /** Modest, bounded stat effects (each clamped into 0–100 on apply). */
  effects: Partial<Pick<GameStats, 'happiness' | 'health' | 'reputation' | 'energy'>>;
  /** Optional mini-prestige "legacy points" granted (bounded, additive). */
  legacyPoints?: number;
  /** Success-toast flavour text. */
  toast: string;
}

/**
 * The catalog. Effects are deliberately small — these are a gentle late-game
 * loop, not a stat farm. Cooldowns + costs keep them from being spammed.
 */
export const ELDER_ACTIVITIES: readonly ElderActivity[] = [
  {
    id: 'write_memoir',
    label: 'Write your memoir',
    description: 'Set your life story down for the generations that follow.',
    icon: 'BookOpen',
    emoji: '📖',
    moneyCost: 0,
    cooldownWeeks: 8,
    minAge: RETIREMENT_AGE,
    effects: { happiness: 6, reputation: 3 },
    legacyPoints: 1,
    toast: 'Another chapter of your memoir is done. Your story will outlast you.',
  },
  {
    id: 'mentor_youth',
    label: 'Mentor a young person',
    description: 'Pass your hard-won wisdom to someone just starting out.',
    icon: 'GraduationCap',
    emoji: '🧑‍🏫',
    moneyCost: 0,
    cooldownWeeks: 4,
    minAge: RETIREMENT_AGE,
    effects: { happiness: 5, reputation: 5 },
    toast: 'Your mentee is thriving thanks to you. A quiet, lasting good.',
  },
  {
    id: 'spoil_grandchildren',
    label: 'Spoil the grandchildren',
    description: 'Toys, treats, and undivided attention - the elder’s privilege.',
    icon: 'Baby',
    emoji: '🧸',
    moneyCost: 500,
    cooldownWeeks: 6,
    minAge: RETIREMENT_AGE,
    requiresChildren: true,
    effects: { happiness: 10, health: 2 },
    toast: 'A day of spoiling the little ones - pure joy on every face.',
  },
  {
    id: 'bucket_list_trip',
    label: 'Bucket-list trip',
    description: 'That one journey you always promised yourself. Now is the time.',
    icon: 'Plane',
    emoji: '✈️',
    moneyCost: 8000,
    cooldownWeeks: 20,
    minAge: RETIREMENT_AGE,
    effects: { happiness: 18, health: 4 },
    legacyPoints: 1,
    toast: 'You finally took the trip of a lifetime. Unforgettable.',
  },
  {
    id: 'volunteer',
    label: 'Volunteer in the community',
    description: 'Give your time where it is needed. Purpose keeps you young.',
    icon: 'HeartHandshake',
    emoji: '🤝',
    moneyCost: 0,
    cooldownWeeks: 3,
    minAge: RETIREMENT_AGE,
    effects: { happiness: 4, health: 1, reputation: 4 },
    toast: 'A rewarding shift volunteering - the community is grateful.',
  },
  {
    id: 'reconnect_friends',
    label: 'Reconnect with old friends',
    description: 'Track down the friends of your youth and share old stories.',
    icon: 'Users',
    emoji: '☕',
    moneyCost: 150,
    cooldownWeeks: 5,
    minAge: RETIREMENT_AGE,
    effects: { happiness: 7, health: 2 },
    toast: 'An afternoon of laughter with old friends. Time melted away.',
  },
  // ── Early-retiree activities (FIRE path retires at 45 — these fill the
  // decades a 65-only gate used to leave empty). Available to anyone retired
  // (age gate bypassed) or elder. ──
  {
    id: 'coach_sports',
    label: 'Volunteer coaching',
    description: 'Coach a youth team on weekends - energy you still have plenty of.',
    icon: 'Whistle',
    emoji: '🏅',
    moneyCost: 0,
    cooldownWeeks: 3,
    minAge: EARLY_RETIRE_MIN_AGE,
    effects: { happiness: 6, health: 3, reputation: 4 },
    toast: 'The team is fired up - coaching keeps you as sharp as they are.',
  },
  {
    id: 'travel_club',
    label: 'Join a travel club',
    description: 'Regular trips with a club of fellow early retirees. See the world slowly.',
    icon: 'Globe',
    emoji: '🧳',
    moneyCost: 2500,
    cooldownWeeks: 10,
    minAge: EARLY_RETIRE_MIN_AGE,
    effects: { happiness: 12, health: 3 },
    legacyPoints: 1,
    toast: 'Another stamp in the passport with the travel club. What a life.',
  },
  {
    id: 'part_time_consulting',
    label: 'Part-time consulting',
    description: 'Take the occasional advisory gig - keep your skills and network warm.',
    icon: 'Briefcase',
    emoji: '💼',
    moneyCost: 0,
    cooldownWeeks: 4,
    minAge: EARLY_RETIRE_MIN_AGE,
    effects: { happiness: 4, reputation: 6 },
    legacyPoints: 1,
    toast: 'A well-received consulting engagement - your reputation grows.',
  },
  {
    id: 'lifelong_learning',
    label: 'Take up a new skill',
    description: 'Enroll in a class you never had time for - painting, coding, a language.',
    icon: 'BookOpen',
    emoji: '🎓',
    moneyCost: 400,
    cooldownWeeks: 6,
    minAge: EARLY_RETIRE_MIN_AGE,
    effects: { happiness: 8, energy: 3 },
    toast: 'A rewarding class - turns out you can teach an old dog new tricks.',
  },
] as const;

export type ElderActivityRejectReason =
  | 'unknown-activity'
  | 'not-elder'
  | 'requires-children'
  | 'cooldown'
  | 'insufficient-money';

export interface ElderActivityStatus {
  activity: ElderActivity;
  /** True when the activity can be performed right now. */
  available: boolean;
  reason?: ElderActivityRejectReason;
  affordable: boolean;
  onCooldown: boolean;
  /** Weeks remaining on the cooldown (0 when ready). */
  cooldownWeeksLeft: number;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && isFinite(v) ? v : fallback;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function getElderActivity(id: string): ElderActivity | undefined {
  return ELDER_ACTIVITIES.find((a) => a.id === id);
}

function hasChildren(state: GameState): boolean {
  return Array.isArray(state?.family?.children) && state.family.children.length > 0;
}

/**
 * Evaluate one activity's availability for the current state (no mutation).
 * Drives the UI (disabled state, cooldown countdown, affordability).
 */
export function getElderActivityStatus(state: GameState, id: string): ElderActivityStatus | null {
  const activity = getElderActivity(id);
  if (!activity) return null;

  const age = getAge(state);
  const weeksLived = Math.max(0, num(state?.weeksLived));
  const lastUsed = state?.elderActivity?.lastUsedWeek?.[activity.id];
  const cooldownWeeksLeft =
    typeof lastUsed === 'number' && isFinite(lastUsed)
      ? Math.max(0, activity.cooldownWeeks - (weeksLived - lastUsed))
      : 0;
  const onCooldown = cooldownWeeksLeft > 0;
  const money = num(state?.stats?.money);
  const affordable = money >= activity.moneyCost;

  // Age gate is bypassed for a RETIRED player: the FIRE path retires at 45, and
  // a retiree — however young — has earned the elder chapter's activities. Only a
  // still-working, below-threshold player is turned away with 'not-elder'.
  let reason: ElderActivityRejectReason | undefined;
  if (age < activity.minAge && !isRetired(state)) reason = 'not-elder';
  else if (activity.requiresChildren && !hasChildren(state)) reason = 'requires-children';
  else if (onCooldown) reason = 'cooldown';
  else if (!affordable) reason = 'insufficient-money';

  return {
    activity,
    available: reason === undefined,
    reason,
    affordable,
    onCooldown,
    cooldownWeeksLeft,
  };
}

/** All activity statuses (catalog order) — convenience for the UI list. */
export function getElderActivityStatuses(state: GameState): ElderActivityStatus[] {
  return ELDER_ACTIVITIES.map((a) => getElderActivityStatus(state, a.id)!).filter(Boolean);
}

export interface ElderActivityResult {
  ok: boolean;
  reason?: ElderActivityRejectReason;
  /** New state (same reference when rejected). */
  state: GameState;
  activity?: ElderActivity;
}

/**
 * Perform an elder activity (pure reducer). Rejects — returning the SAME state
 * reference — when the activity is unknown, the player is too young, a required
 * child is missing, it is on cooldown, or it is unaffordable. On success it:
 *   • charges `moneyCost` via `applyMoneyDelta` (overdraft-safe, mirror-safe),
 *   • applies the clamped stat effects and any legacy points,
 *   • stamps the cooldown (`elderActivity.lastUsedWeek[id] = weeksLived`).
 */
export function applyElderActivity(state: GameState, id: string): ElderActivityResult {
  const status = getElderActivityStatus(state, id);
  if (!status) return { ok: false, reason: 'unknown-activity', state };
  if (!status.available) return { ok: false, reason: status.reason, state, activity: status.activity };

  const activity = status.activity;

  // Money leg through the canonical helper (rejects if it can't be covered).
  let statsAfterSpend: GameStats = state.stats;
  let dailySummary = state.dailySummary;
  if (activity.moneyCost > 0) {
    const spend = applyMoneyDelta(state, -activity.moneyCost, `Elder activity: ${activity.label}`);
    if (!spend) return { ok: false, reason: 'insufficient-money', state, activity };
    statsAfterSpend = spend.stats;
    dailySummary = spend.dailySummary;
  }

  // Apply bounded stat effects on top of the post-charge stats.
  const eff = activity.effects;
  const newStats: GameStats = {
    ...statsAfterSpend,
    happiness: clamp(num(statsAfterSpend.happiness) + num(eff.happiness), 0, 100),
    health: clamp(num(statsAfterSpend.health) + num(eff.health), 0, 100),
    energy: clamp(num(statsAfterSpend.energy) + num(eff.energy), 0, 100),
    reputation: clamp(num(statsAfterSpend.reputation) + num(eff.reputation), 0, 100),
  };

  const weeksLived = Math.max(0, num(state.weeksLived));
  const prevElder = state.elderActivity ?? { lastUsedWeek: {}, totalActivities: 0 };
  const elderActivity = {
    lastUsedWeek: { ...prevElder.lastUsedWeek, [activity.id]: weeksLived },
    totalActivities: num(prevElder.totalActivities) + 1,
  };

  const legacyPoints = num(state.legacyPoints) + num(activity.legacyPoints);

  return {
    ok: true,
    state: {
      ...state,
      stats: newStats,
      dailySummary,
      elderActivity,
      legacyPoints,
    },
    activity,
  };
}
