/**
 * Parenting action loop — pure logic.
 *
 * No React, no ctx, no side effects: every function takes plain values and
 * returns plain values, so the UI can fold the result into a single atomic
 * `setGameState` updater and the tests can exercise it directly.
 */
import type { ChildInfo, ChildParentingState } from '@/contexts/game/types';
import type {
  NurtureStatKey,
  ParentingAction,
  ParentingActionOutcome,
  ParentingAgeBand,
  ParentingRejectReason,
} from './types';
import {
  AGE_BANDS,
  MAX_PARENTING_ACTIONS_PER_WEEK,
  NURTURE_DEFAULT,
  NURTURE_MAX,
  NURTURE_MIN,
  PARENTING_ACTIONS,
  PARENTING_MAX_AGE,
} from './catalog';

/**
 * Bond a newly-arrived child starts with.
 *
 * Deliberately below `NURTURE_MAX`: a child created at the ceiling made every
 * positive parenting action clamp to nothing on arrival, which is what made the
 * whole Bond half of the parenting loop inert (R3-F5). 75 leaves real headroom
 * while still reading as a close new family member.
 */
export const NEWBORN_BOND = 75;

const clampNurture = (v: number): number =>
  Math.max(NURTURE_MIN, Math.min(NURTURE_MAX, Math.round(v)));

/** Resolve a child's age (in years) to a parenting band, or null if grown/invalid. */
export function getAgeBand(age: number | undefined): ParentingAgeBand | null {
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) return null;
  const years = Math.floor(age);
  if (years >= PARENTING_MAX_AGE + 1) return null; // 19+ is fully grown
  for (const band of Object.keys(AGE_BANDS) as ParentingAgeBand[]) {
    const { min, max } = AGE_BANDS[band];
    if (years >= min && years <= max) return band;
  }
  return null;
}

/** Actions valid for a child of the given age (empty once grown). */
export function getActionsForAge(age: number | undefined): ParentingAction[] {
  const band = getAgeBand(age);
  if (!band) return [];
  return PARENTING_ACTIONS.filter(a => a.bands.includes(band));
}

export function getActionById(id: string): ParentingAction | undefined {
  return PARENTING_ACTIONS.find(a => a.id === id);
}

/**
 * Read a child's nurture stat, defaulting to NURTURE_DEFAULT when absent.
 * `relationship` maps to the existing `relationshipScore` (bond with parent).
 */
export function getNurtureStat(child: ChildInfo, key: NurtureStatKey): number {
  if (key === 'relationship') {
    const v = child.relationshipScore;
    return typeof v === 'number' && Number.isFinite(v) ? v : NURTURE_DEFAULT;
  }
  const v = child[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : NURTURE_DEFAULT;
}

/**
 * Composite 0-100 "how well-raised is this child" score — the average of the
 * four nurture stats plus the parent bond. Used by the UI and as a convenient
 * summary of heir quality gained through parenting.
 */
export function getNurtureQuality(child: ChildInfo): number {
  const keys: NurtureStatKey[] = ['intelligence', 'health', 'happiness', 'discipline', 'relationship'];
  const sum = keys.reduce((acc, k) => acc + getNurtureStat(child, k), 0);
  return Math.round(sum / keys.length);
}

/** A fresh, empty bookkeeping record. */
export function emptyParentingState(): ChildParentingState {
  return { weekStamp: -1, actionsThisWeek: 0, lastUsedWeek: {}, totalActions: 0 };
}

/**
 * The effective bookkeeping state for the current week: if the stored week
 * stamp is stale (or missing), the weekly action count is treated as 0.
 * Never mutates the input.
 */
export function normalizeParentingState(
  child: ChildInfo,
  weeksLived: number,
): ChildParentingState {
  const stored = child.parenting;
  if (!stored) return { ...emptyParentingState(), weekStamp: weeksLived };
  const sameWeek = stored.weekStamp === weeksLived;
  return {
    weekStamp: weeksLived,
    actionsThisWeek: sameWeek ? stored.actionsThisWeek || 0 : 0,
    lastUsedWeek: stored.lastUsedWeek || {},
    totalActions: stored.totalActions || 0,
  };
}

/** weeksLived at which `action` becomes usable again for `child` (0 if never used). */
export function cooldownUntilWeek(child: ChildInfo, action: ParentingAction): number {
  const last = child.parenting?.lastUsedWeek?.[action.id];
  if (typeof last !== 'number' || !Number.isFinite(last)) return 0;
  return last + action.cooldownWeeks;
}

export interface ParentingEligibility {
  ok: boolean;
  reason?: ParentingRejectReason;
  /** weeksLived at which a cooldown-blocked action frees up. */
  cooldownUntilWeek?: number;
  /** Remaining parenting actions allowed for the child this week. */
  weeklyRemaining: number;
}

/**
 * Can this action be performed on this child right now? Checks age band,
 * cooldown, the weekly cap, then affordability (money then energy). Pure.
 */
export function canPerformParentingAction(
  child: ChildInfo,
  actionOrId: string | ParentingAction,
  weeksLived: number,
  money: number,
  energy: number,
): ParentingEligibility {
  const action = typeof actionOrId === 'string' ? getActionById(actionOrId) : actionOrId;
  const state = normalizeParentingState(child, weeksLived);
  const weeklyRemaining = Math.max(0, MAX_PARENTING_ACTIONS_PER_WEEK - state.actionsThisWeek);

  if (!action) return { ok: false, reason: 'unknown-action', weeklyRemaining };

  const band = getAgeBand(child.age);
  if (!band || !action.bands.includes(band)) {
    return { ok: false, reason: 'wrong-age', weeklyRemaining };
  }

  const availableAt = cooldownUntilWeek(child, action);
  if (weeksLived < availableAt) {
    return { ok: false, reason: 'cooldown', cooldownUntilWeek: availableAt, weeklyRemaining };
  }

  if (state.actionsThisWeek >= MAX_PARENTING_ACTIONS_PER_WEEK) {
    return { ok: false, reason: 'weekly-cap', weeklyRemaining: 0 };
  }

  if (action.moneyCost > 0 && money < action.moneyCost) {
    return { ok: false, reason: 'insufficient-money', weeklyRemaining };
  }
  if (action.energyCost > 0 && energy < action.energyCost) {
    return { ok: false, reason: 'insufficient-energy', weeklyRemaining };
  }

  return { ok: true, weeklyRemaining };
}

/**
 * Apply a parenting action to a child. Returns an updated ChildInfo (nurture
 * stats + refreshed bookkeeping) plus the money/energy deltas for the caller to
 * charge through the canonical paths. On rejection returns `{ ok: false }` with
 * a reason and no deltas. Never mutates the input child.
 */
export function applyParentingAction(
  child: ChildInfo,
  actionId: string,
  weeksLived: number,
  money: number,
  energy: number,
): ParentingActionOutcome {
  const action = getActionById(actionId);
  const eligibility = canPerformParentingAction(child, action ?? actionId, weeksLived, money, energy);
  if (!eligibility.ok || !action) {
    return { ok: false, reason: eligibility.reason, cooldownUntilWeek: eligibility.cooldownUntilWeek };
  }

  // Apply nurture effects (clamped, cumulative). `relationship` folds into the
  // child's existing relationshipScore so the bond and the parenting bond stay
  // one number.
  const updated: ChildInfo = { ...child };
  const effectsApplied = action.effects;
  (Object.entries(effectsApplied) as [NurtureStatKey, number][]).forEach(([key, delta]) => {
    if (typeof delta !== 'number' || delta === 0) return;
    const next = clampNurture(getNurtureStat(child, key) + delta);
    if (key === 'relationship') {
      updated.relationshipScore = next;
    } else {
      updated[key] = next;
    }
  });

  // Refresh bookkeeping.
  const state = normalizeParentingState(child, weeksLived);
  updated.parenting = {
    weekStamp: weeksLived,
    actionsThisWeek: state.actionsThisWeek + 1,
    lastUsedWeek: { ...state.lastUsedWeek, [action.id]: weeksLived },
    totalActions: state.totalActions + 1,
  };

  return {
    ok: true,
    child: updated,
    moneyDelta: action.moneyCost > 0 ? -action.moneyCost : 0,
    energyDelta: action.energyCost > 0 ? -action.energyCost : 0,
    cooldownUntilWeek: weeksLived + action.cooldownWeeks,
    effectsApplied,
  };
}

/** Human-readable one-liner for a rejection reason (UI feedback). */
export function describeRejectReason(
  reason: ParentingRejectReason | undefined,
  ctx?: { cooldownUntilWeek?: number; weeksLived?: number },
): string {
  switch (reason) {
    case 'wrong-age':
      return 'This activity is not right for your child’s age.';
    case 'cooldown': {
      const wait =
        ctx?.cooldownUntilWeek != null && ctx?.weeksLived != null
          ? Math.max(1, ctx.cooldownUntilWeek - ctx.weeksLived)
          : null;
      return wait != null
        ? `You did this recently - try again in ${wait} week${wait === 1 ? '' : 's'}.`
        : 'You did this recently - give it some time.';
    }
    case 'weekly-cap':
      return 'You have spent enough quality time this week. Try again next week.';
    case 'insufficient-money':
      return 'You cannot afford this right now.';
    case 'insufficient-energy':
      return 'You are too worn out for this right now.';
    case 'unknown-action':
    default:
      return 'That activity is not available.';
  }
}

/**
 * SOC-2: keep the child's `relationships` entry in step with a parenting action.
 *
 * A child is TWO records: `family.children[]` (whose `relationshipScore` is the
 * Family tab's Bond and the parenting stat - the tick deliberately keeps it
 * authoritative) and `relationships[]` (what Contacts shows, and what the
 * neglect drag and the want cycle read). Parenting only ever wrote the first,
 * so the second never saw contact: a child parented every week lost -2 per
 * want cycle, read ~40 on Contacts beside a 95% Bond on the Family tab, and
 * eventually raised "Things are strained with <toddler>" plus a weekly
 * happiness drag.
 *
 * A parenting action IS contact: stamp the recency and mirror the Bond, so the
 * two screens agree and the neglect / want passes see the parent who showed up.
 * Pure; returns an unchanged copy when there is no matching child entry.
 */
export function syncChildContactAfterParenting<R extends {
  id: string;
  type: string;
  relationshipScore: number;
  lastInteractionWeek?: number;
  weeklyInteractions?: number;
}>(relationships: readonly R[], child: Pick<ChildInfo, 'id' | 'relationshipScore'>, weeksLived: number): R[] {
  return relationships.map((r) => {
    if (!r || r.id !== child.id || r.type !== 'child') return r;
    const bond = typeof child.relationshipScore === 'number' && Number.isFinite(child.relationshipScore)
      ? Math.max(0, Math.min(100, child.relationshipScore))
      : r.relationshipScore;
    return {
      ...r,
      relationshipScore: bond,
      lastInteractionWeek: weeksLived,
      weeklyInteractions: r.lastInteractionWeek === weeksLived ? (r.weeklyInteractions ?? 0) + 1 : 1,
    };
  });
}

/**
 * SOC2-5: the other direction of `syncChildContactAfterParenting`.
 *
 * The Family Bond (`family.children[].relationshipScore`) is the authoritative
 * number - the weekly tick never lets the Contacts copy overwrite it - and a
 * parenting action copies it ONTO the Contacts record. So anything the
 * Contacts app did to a child's bond (Call, Hang out, and the paid "bond"
 * gesture at $400 + $60 per point) moved only the copy: the Family tab never
 * showed it, and the next parenting action silently reverted it. A player who
 * paid for a gesture toward their child lost both the money's effect and the
 * screen agreement SOC-2 set out to fix.
 *
 * Called by the Contacts writers after they move a child's Contacts bond, so
 * one number holds on both screens. Pure; returns the SAME family object when
 * `rel` is not a child or has no Family record, so callers can spread it
 * unconditionally.
 */
export function mirrorChildContactBondToFamily<F extends { children?: ChildInfo[] } | undefined>(
  family: F,
  rel: { id: string; type: string; relationshipScore: number } | null | undefined,
): F {
  if (!family || !rel || rel.type !== 'child') return family;
  const children = Array.isArray(family.children) ? family.children : [];
  const bond = typeof rel.relationshipScore === 'number' && Number.isFinite(rel.relationshipScore)
    ? clampNurture(rel.relationshipScore)
    : null;
  if (bond == null || !children.some((c) => c?.id === rel.id && c.relationshipScore !== bond)) return family;
  return {
    ...family,
    children: children.map((c) => (c?.id === rel.id ? { ...c, relationshipScore: bond } : c)),
  };
}
