/**
 * Life Skills — gameplay effect accessor (task #70).
 *
 * The Life Skills tree (components/SkillTreeModal.tsx) stores purchased node ids
 * in `gameState.unlockedLifeSkills`. Those nodes advertise concrete bonuses
 * ("+15% salary", "-10% tax", …) but for a long time the effect strings were
 * DISPLAY-ONLY — no system read them, so purchasing was gated behind a
 * "Coming Soon" alert to avoid charging the player for a no-op.
 *
 * This module is the single, pure, null-safe place that turns the set of
 * unlocked node ids into a bounded `LifeSkillModifiers` object. Every gameplay
 * system (career salary/progress, education, relationships, passive income,
 * tax, expenses, aging, disease recovery, …) reads its modifier from here, so
 * balance is centralized and testable — mirroring the prestige-bonus pattern in
 * `lib/prestige/applyBonuses.ts`.
 *
 * DESIGN NOTES / balance:
 *   - Each node is a meaningful-but-modest edge; the whole tree is intentionally
 *     not game-breaking. Every multiplier is clamped to a hard band so no stack
 *     (or a corrupted save with junk ids) can push a value out of range, go
 *     negative, or NaN.
 *   - Modifiers ADJUST an existing computation; nothing here mints money or
 *     writes cash directly. Money-facing skills (tax, expenses, passive income,
 *     stock returns, salary) only scale a value the canonical path already
 *     computes.
 *
 * REINTERPRETED nodes (no literal engine hook existed — closest sensible real
 * effect applied instead, so no node ships inert):
 *   - `executive` "Unlock C-suite positions": career positions aren't gated
 *     behind a flag, so this becomes an executive-presence capstone — extra
 *     career-progress speed + salary premium (stacks with leadership/negotiation).
 *   - `socialMaster` "+5 max relationships": the engine enforces no hard
 *     relationship-count cap, so this becomes a social capstone — extra
 *     relationship-gain (stacks with charisma).
 *   - `stamina` "+10 max energy": the energy ceiling is a hard 100 everywhere,
 *     so this becomes a weekly energy-regen bonus (reach the cap faster).
 *   - `memory_palace` "Skills decay -50%": there is no skill-decay system, so
 *     this becomes exam retention — a bonus to exam pass chance.
 *   - `polymath` "Unlock all education paths": education paths aren't locked, so
 *     this becomes an intellectual capstone — extra education-time reduction +
 *     exam pass bonus.
 */

import type { GameState } from '@/contexts/game/types';
import { trackMoneySpent, getDefaultStatistics } from '@/lib/statistics/statisticsTracker';
import { getRelationshipGainMultiplier } from '@/lib/prestige/applyBonuses';

/** Canonical list of Life Skill node ids — must match SkillTreeModal's catalog. */
export const LIFE_SKILL_IDS = [
  // Career Mastery
  'networking', 'leadership', 'negotiation', 'executive',
  // Social Intelligence
  'charisma', 'empathy', 'persuasion', 'socialMaster',
  // Physical Wellness
  'stamina', 'resilience', 'peak_performance', 'vitality',
  // Financial Acumen
  'budgeting', 'investing', 'tax_strategy', 'wealth_master',
  // Intellectual Growth
  'quick_learner', 'critical_thinking', 'memory_palace', 'polymath',
] as const;

export type LifeSkillId = typeof LIFE_SKILL_IDS[number];

export interface LifeSkillModifiers {
  /** Additive percentage points added to a job-application acceptance chance. */
  jobApplicationBonus: number;
  /** Multiplies weekly career promotion-progress rate. */
  careerProgressMult: number;
  /** Multiplies weekly career salary. */
  salaryMult: number;
  /** Multiplies positive relationship-score gains. */
  relationshipGainMult: number;
  /** Multiplies breakup/disappointment chance (lower = relationships decay slower). */
  relationshipDecayMult: number;
  /** Multiplies a date's relationship boost + proposal odds. */
  datingSuccessMult: number;
  /** Multiplies weekly energy regen. */
  energyRegenMult: number;
  /** Multiplies disease natural-recovery speed. */
  recoveryMult: number;
  /** Multiplies positive fitness gains (gym efficiency). */
  fitnessGainMult: number;
  /** Multiplies old-age death chance (lower = slower aging). */
  agingMult: number;
  /** Multiplies recurring housing expenses (lower = cheaper). */
  expenseMult: number;
  /** Multiplies stock dividend income. */
  stockReturnMult: number;
  /** Multiplies income tax owed (lower = less tax). */
  taxMult: number;
  /** Multiplies total passive income. */
  passiveIncomeMult: number;
  /** Fraction to trim off a NEW enrollment's duration (0.10 = -10% weeks). */
  educationTimeReductionPct: number;
  /** Additive bonus to exam pass chance (0-1 scale). */
  examPassBonus: number;
}

/** All-neutral modifier set (no unlocked skills). */
export const NEUTRAL_LIFE_SKILL_MODIFIERS: Readonly<LifeSkillModifiers> = Object.freeze({
  jobApplicationBonus: 0,
  careerProgressMult: 1,
  salaryMult: 1,
  relationshipGainMult: 1,
  relationshipDecayMult: 1,
  datingSuccessMult: 1,
  energyRegenMult: 1,
  recoveryMult: 1,
  fitnessGainMult: 1,
  agingMult: 1,
  expenseMult: 1,
  stockReturnMult: 1,
  taxMult: 1,
  passiveIncomeMult: 1,
  educationTimeReductionPct: 0,
  examPassBonus: 0,
});

function clamp(v: number, lo: number, hi: number): number {
  if (typeof v !== 'number' || !isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** Null-safe read of the unlocked Life Skill id set. */
function unlockedList(state: GameState | null | undefined): string[] {
  const list = state?.unlockedLifeSkills;
  return Array.isArray(list) ? list : [];
}

/** True when the given Life Skill node is unlocked. Null/old-save safe. */
export function hasLifeSkill(state: GameState | null | undefined, id: LifeSkillId): boolean {
  return unlockedList(state).includes(id);
}

/**
 * Compute the full bounded modifier object from the player's unlocked skills.
 * Pure + deterministic + null-safe. Old saves without `unlockedLifeSkills`
 * (or with junk ids) return the neutral set / are simply ignored.
 */
export function getLifeSkillModifiers(state: GameState | null | undefined): LifeSkillModifiers {
  const list = unlockedList(state);
  if (list.length === 0) return { ...NEUTRAL_LIFE_SKILL_MODIFIERS };

  const has = (id: LifeSkillId): boolean => list.includes(id);
  const m: LifeSkillModifiers = { ...NEUTRAL_LIFE_SKILL_MODIFIERS };

  // ── Career Mastery ──────────────────────────────────────────────
  if (has('networking')) m.jobApplicationBonus += 5;          // +5% job application success
  if (has('leadership')) m.careerProgressMult += 0.10;        // +10% promotion (progress) speed
  if (has('negotiation')) m.salaryMult += 0.15;               // +15% salary
  if (has('executive')) { m.careerProgressMult += 0.15; m.salaryMult += 0.10; } // capstone (reinterpreted)

  // ── Social Intelligence ─────────────────────────────────────────
  if (has('charisma')) m.relationshipGainMult += 0.10;        // +10% relationship gains
  if (has('empathy')) m.relationshipDecayMult -= 0.25;        // relationship decay -25%
  if (has('persuasion')) m.datingSuccessMult += 0.20;         // +20% dating success
  if (has('socialMaster')) m.relationshipGainMult += 0.15;    // capstone (reinterpreted)

  // ── Physical Wellness ───────────────────────────────────────────
  if (has('stamina')) m.energyRegenMult += 0.15;              // +energy (reinterpreted → regen)
  if (has('resilience')) m.recoveryMult += 0.25;              // recovery speed +25%
  if (has('peak_performance')) m.fitnessGainMult += 0.15;     // +15% gym efficiency
  if (has('vitality')) m.agingMult -= 0.20;                   // slow aging

  // ── Financial Acumen ────────────────────────────────────────────
  if (has('budgeting')) m.expenseMult -= 0.05;               // -5% weekly expenses
  if (has('investing')) m.stockReturnMult += 0.05;           // +5% stock returns
  if (has('tax_strategy')) m.taxMult -= 0.10;                // -10% tax rate
  if (has('wealth_master')) m.passiveIncomeMult += 0.25;     // +25% passive income

  // ── Intellectual Growth ─────────────────────────────────────────
  if (has('quick_learner')) m.educationTimeReductionPct += 0.10; // -10% education time
  if (has('critical_thinking')) m.examPassBonus += 0.08;         // +10% study effectiveness
  if (has('memory_palace')) m.examPassBonus += 0.08;             // retention (reinterpreted)
  if (has('polymath')) { m.educationTimeReductionPct += 0.15; m.examPassBonus += 0.05; } // capstone (reinterpreted)

  // ── Bound every field to a hard band (anti-exploit / anti-NaN) ───
  m.jobApplicationBonus = clamp(m.jobApplicationBonus, 0, 15);
  m.careerProgressMult = clamp(m.careerProgressMult, 1, 1.5);
  m.salaryMult = clamp(m.salaryMult, 1, 1.5);
  m.relationshipGainMult = clamp(m.relationshipGainMult, 1, 1.5);
  m.relationshipDecayMult = clamp(m.relationshipDecayMult, 0.5, 1);
  m.datingSuccessMult = clamp(m.datingSuccessMult, 1, 1.5);
  m.energyRegenMult = clamp(m.energyRegenMult, 1, 1.5);
  m.recoveryMult = clamp(m.recoveryMult, 1, 1.5);
  m.fitnessGainMult = clamp(m.fitnessGainMult, 1, 1.5);
  m.agingMult = clamp(m.agingMult, 0.5, 1);
  m.expenseMult = clamp(m.expenseMult, 0.75, 1);
  m.stockReturnMult = clamp(m.stockReturnMult, 1, 1.5);
  m.taxMult = clamp(m.taxMult, 0.75, 1);
  m.passiveIncomeMult = clamp(m.passiveIncomeMult, 1, 1.5);
  m.educationTimeReductionPct = clamp(m.educationTimeReductionPct, 0, 0.4);
  m.examPassBonus = clamp(m.examPassBonus, 0, 0.3);

  return m;
}

/**
 * Apply the relationship-gain multiplier to a positive score delta and round.
 * Negative/zero deltas pass through untouched (skills never worsen a loss).
 *
 * Wired into `updateRelationship` in GameActionsContext — the single
 * relationship-gain path the Contacts app uses — alongside karma's
 * `npcTrustMultiplier`. Between the 2026-07-28 audit and that wiring this had NO
 * production consumer at all (its only caller was a zero-importer module), so a
 * player could buy the charisma node, read a description promising faster bonds,
 * and receive nothing (PERF-5).
 *
 * Gains only. Skills and standing make you better at BUILDING relationships;
 * they never soften a betrayal, so a negative delta passes through untouched.
 */
export function applyRelationshipGain(state: GameState | null | undefined, delta: number): number {
  if (typeof delta !== 'number' || !isFinite(delta) || delta <= 0) return delta;
  const mult = getLifeSkillModifiers(state).relationshipGainMult;

  /**
   * R3-P3: the prestige side of the same number.
   *
   * `social_master` (20,000 points, "+50% relationship gains") and
   * `reputation_gain_multiplier` (3,500 x2 levels) both feed
   * `getRelationshipGainMultiplier`, whose only occurrences in the repo were its
   * own definition, an unused import, and `PrestigeInfoModal` calling it to
   * render the very percentage the player was not receiving. This funnel — the
   * single path every positive relationship change goes through — applied only
   * the Life Skills multiplier, so 23,500 prestige points bought nothing.
   *
   * Multiplied with the skill multiplier rather than replacing it: they are
   * independent purchases and stacking is the intent. Guarded so a corrupt
   * bonus list cannot turn a gain into NaN or a reduction.
   */
  const prestigeMult = getRelationshipGainMultiplier(state?.prestige?.unlockedBonuses || []);
  const safePrestigeMult =
    Number.isFinite(prestigeMult) && prestigeMult > 1 ? prestigeMult : 1;

  return Math.round(delta * mult * safePrestigeMult);
}

// ─── Purchasing ────────────────────────────────────────────────────────
// The Life Skills modal buys nodes with MONEY (each node's `cost`). This pure
// reducer is the single authoritative purchase path so the flow is unit-testable
// without rendering, and so the modal's `setGameState(prev => …)` can apply it
// atomically (deduct + persist in one update) — no double-charge, no free skill.

export interface LifeSkillPurchaseSpec {
  /** Node id to unlock. */
  id: string;
  /** Money cost. */
  cost: number;
  /** Minimum player age required. */
  levelRequired: number;
  /** Prerequisite node ids that must already be unlocked. */
  requires?: string[];
}

export type LifeSkillPurchaseReason =
  | 'already-unlocked'
  | 'too-young'
  | 'missing-prereq'
  | 'insufficient-funds'
  | 'invalid';

export interface LifeSkillPurchaseResult {
  /** New state (unchanged reference-wise when `purchased` is false). */
  state: GameState;
  /** True only when the cost was charged and the node was persisted. */
  purchased: boolean;
  /** Why the purchase was rejected (absent on success). */
  reason?: LifeSkillPurchaseReason;
}

/**
 * Atomically buy one Life Skill node. Pure — returns a NEW state on success and
 * the SAME state (plus a reason) on any rejection. Guards, in order:
 * already-unlocked → age → prereqs → affordability. Money only ever decreases
 * (mirror-safe: no cash minted). `unlockedLifeSkills` is created if absent, so
 * old saves migrate on first purchase.
 */
export function purchaseLifeSkill(
  state: GameState,
  spec: LifeSkillPurchaseSpec,
): LifeSkillPurchaseResult {
  if (!state || !spec || typeof spec.id !== 'string' || typeof spec.cost !== 'number' || !isFinite(spec.cost) || spec.cost < 0) {
    return { state, purchased: false, reason: 'invalid' };
  }

  const list = Array.isArray(state.unlockedLifeSkills) ? state.unlockedLifeSkills : [];
  if (list.includes(spec.id)) {
    return { state, purchased: false, reason: 'already-unlocked' };
  }
  if ((state.date?.age ?? 0) < (spec.levelRequired ?? 0)) {
    return { state, purchased: false, reason: 'too-young' };
  }
  if (spec.requires && !spec.requires.every((req) => list.includes(req))) {
    return { state, purchased: false, reason: 'missing-prereq' };
  }
  const money = state.stats?.money ?? 0;
  if (money < spec.cost) {
    return { state, purchased: false, reason: 'insufficient-funds' };
  }

  const currentStats = state.lifetimeStatistics || getDefaultStatistics();
  const updatedStats = trackMoneySpent(currentStats, -spec.cost);
  const prevSpent = state.dailySummary?.totalMoneySpent || 0;

  const nextState: GameState = {
    ...state,
    stats: {
      ...state.stats,
      money: Math.max(0, money - spec.cost),
    },
    unlockedLifeSkills: [...list, spec.id],
    lifetimeStatistics: updatedStats,
    dailySummary: state.dailySummary
      ? { ...state.dailySummary, totalMoneySpent: prevSpent + spec.cost }
      : state.dailySummary,
    updatedAt: Date.now(),
  };

  return { state: nextState, purchased: true };
}
