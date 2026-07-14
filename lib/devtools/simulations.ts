/**
 * DEV-ONLY runnable feature simulations / self-tests.
 * ===========================================================================
 *
 * Each simulation is a PURE function of a base `GameState`:
 *   1. deep-CLONES the base (never mutates live state),
 *   2. seeds a ready-to-test scenario ON THE CLONE,
 *   3. drives the REAL game reducers / action creators (never mocks),
 *   4. asserts the feature actually works,
 *   5. returns a `SimResult` — never throws (any throw is caught → fail result).
 *
 * HOW THE REAL LOGIC IS DRIVEN
 * ----------------------------
 * Most game actions are `(gameState, setGameState, …args) => Result` where the
 * real mutation lives inside a `setGameState(prev => …)` updater. `makeHarness`
 * supplies a SYNCHRONOUS `setGameState` that folds the updater into a captured
 * clone, so the sims call the SAME reducers the app calls — no reimplementation.
 *
 * THE WEEKLY TICK
 * ---------------
 * The app's `nextWeek` is a React `useCallback` bound to `setGameState` with a
 * ~1500-line inline reducer and a global stock-singleton dependency
 * (`simulateWeek`/`getStockInfo`); it is NOT headless-invocable and extracting
 * it would be a risky refactor of the game's most critical path. Instead,
 * `advanceOneWeekHeadless` composes the ALREADY-EXTRACTED, real, pure weekly
 * reducers — `computeDecayInputs` (real decay rate), `computeWeeklyIncome` (real
 * income), `calcWeeklyPassiveIncome` (real passive), `applyLuxuryItemsForWeek`
 * (real upkeep) — plus the same date/age/week advancement `nextWeek` performs.
 * It exercises real subsystem logic; it is a faithful composition, not the
 * literal callback. (Documented honestly for the 52-week / money-integrity sims.)
 *
 * Nothing here is imported by production screens — see the DEV_TOOLS gate in
 * components/SettingsModal.tsx. This module is additive and bumps no save version.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Career, Company, ChildInfo } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// --- Real money paths -------------------------------------------------------
import { updateMoney, MONEY_CEILING } from '@/contexts/game/actions/MoneyActions';
// --- Real feature actions ---------------------------------------------------
import { purchaseLuxuryItem, sellLuxuryItem } from '@/contexts/game/actions/LuxuryActions';
import { practicePursuit } from '@/contexts/game/actions/PursuitActions';
import { promoteCareer } from '@/contexts/game/actions/JobActions';
import { buildRDLab, startResearch, advanceResearch } from '@/contexts/game/actions/RDActions';
// --- Real pure reducers / helpers ------------------------------------------
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { retirePlayer, computePension, getRetirementIncomeWeekly } from '@/lib/retirement/pension';
import { applyParentingAction, getActionsForAge } from '@/lib/parenting/parentingLogic';
import { grantAmbitionPayout, getAmbitionCompletion } from '@/lib/ambitions/progress';
import { LIFE_AMBITIONS } from '@/lib/ambitions/catalog';
import { purchaseLifeSkill, getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { applyAutoReinvest } from '@/contexts/game/actions/weekly/applyAutoReinvest';
import { runWeeklyBankingTick } from '@/lib/banking/weeklyTick';
import {
  transferBetweenAccounts,
  depositToAccount,
  findAccount,
} from '@/lib/banking/operations';
import { netWorth } from '@/lib/progress/achievements';
// --- Luxury / pursuit catalogs ---------------------------------------------
import {
  LUXURY_CATALOG,
  getLuxuryItem,
  getTotalLuxuryValue,
  getTotalLuxuryResaleValue,
  getOwnedLuxuryCount,
  ownsLuxuryItem,
  LUXURY_LIFE_MIN_ITEMS,
  LUXURY_LIFE_VALUE_THRESHOLD,
} from '@/lib/luxury';
import { PURSUITS, MAX_PURSUIT_LEVEL, tierForLevel } from '@/lib/pursuits/pursuitMastery';
// --- Headless weekly-tick composition (real pure reducers) ------------------
import { computeDecayInputs, buildPreRolls } from '@/contexts/game/actions/weekly/preTick';
import { getStatDecayMultiplier } from '@/lib/prestige/applyBonuses';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { applyLuxuryItemsForWeek } from '@/contexts/game/actions/weekly/applyLuxuryItems';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';

// ===========================================================================
// Result + registry types
// ===========================================================================

export interface SimResult {
  id: string;
  name: string;
  pass: boolean;
  message: string;
  details?: string[];
}

export interface Simulation {
  id: string;
  name: string;
  description: string;
  /** Deep-clones `base`, runs the real logic, returns a result. Never throws. */
  run: (base: GameState) => SimResult;
}

// ===========================================================================
// Harness + utilities
// ===========================================================================

type SetGameState = Dispatch<SetStateAction<GameState>>;

/** Deep clone that fully detaches from live state (mirrors save/load semantics). */
function deepClone(base: GameState): GameState {
  try {
    if (typeof structuredClone === 'function') return structuredClone(base);
  } catch {
    /* fall through to JSON clone */
  }
  return JSON.parse(JSON.stringify(base)) as GameState;
}

interface Harness {
  getState: () => GameState;
  setGameState: SetGameState;
}

/** Synchronous fake dispatch — folds updaters into a captured state variable. */
function makeHarness(initial: GameState): Harness {
  let state = initial;
  const setGameState: SetGameState = (updater) => {
    state = typeof updater === 'function' ? (updater as (p: GameState) => GameState)(state) : updater;
  };
  return { getState: () => state, setGameState };
}

/** Small assertion accumulator → tidy PASS/FAIL details + rollup message. */
class Checks {
  readonly details: string[] = [];
  private failures = 0;
  ok(cond: boolean, label: string): boolean {
    this.details.push(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
    if (!cond) this.failures += 1;
    return cond;
  }
  note(label: string): void {
    this.details.push(`·     ${label}`);
  }
  get passed(): boolean {
    return this.failures === 0;
  }
  message(okMsg: string): string {
    return this.passed ? okMsg : `${this.failures} assertion(s) failed`;
  }
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n);
const inRange = (n: number, lo: number, hi: number): boolean => isFiniteNum(n) && n >= lo && n <= hi;
const approx = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol;

/** Wrap a sim body with clone + try/catch so it can never throw or mutate `base`. */
function defineSim(
  id: string,
  name: string,
  description: string,
  body: (clone: GameState, c: Checks) => string,
): Simulation {
  return {
    id,
    name,
    description,
    run(base: GameState): SimResult {
      let clone: GameState;
      try {
        clone = deepClone(base);
      } catch (e) {
        return { id, name, pass: false, message: `Could not clone base state: ${errMsg(e)}` };
      }
      const c = new Checks();
      try {
        const okMsg = body(clone, c);
        return { id, name, pass: c.passed, message: c.message(okMsg), details: c.details };
      } catch (e) {
        return {
          id,
          name,
          pass: false,
          message: `Threw: ${errMsg(e)}`,
          details: [...c.details, `THREW — ${errMsg(e)}`],
        };
      }
    },
  };
}

// ===========================================================================
// Faithful headless weekly tick (composition of REAL pure reducers)
// ===========================================================================

const clamp100 = (n: number): number => Math.max(0, Math.min(100, isFiniteNum(n) ? n : 0));

/** Salary of the player's currently-accepted career at its current level (real data). */
function currentCareerSalary(state: GameState): number {
  const job = state.currentJob;
  const career = (state.careers || []).find((cc) => cc && cc.accepted && (!job || cc.id === job));
  if (!career) return 0;
  const lvl = career.levels?.[career.level];
  const salary = lvl?.salary;
  return isFiniteNum(salary) && salary > 0 ? salary : 0;
}

/**
 * Advance ONE week using the real, extracted weekly reducers. See the file
 * header for why this composes reducers rather than calling the React callback.
 */
export function advanceOneWeekHeadless(state: GameState): GameState {
  const currentWeeksLived = isFiniteNum(state.weeksLived) && state.weeksLived >= 0 ? state.weeksLived : 0;
  const nextWeeksLived = currentWeeksLived + 1;
  const currentAge = isFiniteNum(state.date?.age) && state.date.age >= 0 ? state.date.age : 18;
  const nextAge = currentAge + 1 / WEEKS_PER_YEAR;

  const newStats: GameState['stats'] = { ...state.stats };

  // 1. REAL stat-decay rate (prestige-aware, wealth-scaled, grace-period aware).
  const prestigeMult = getStatDecayMultiplier(state.prestige?.unlockedBonuses || []);
  const { effectiveDecayRate } = computeDecayInputs(state, {
    baseDecayRate: 4,
    prestigeMultiplier: prestigeMult,
  });
  newStats.health = clamp100((newStats.health ?? 100) - effectiveDecayRate);
  newStats.happiness = clamp100((newStats.happiness ?? 100) - effectiveDecayRate);
  newStats.energy = clamp100((newStats.energy ?? 100) - effectiveDecayRate);
  newStats.fitness = clamp100((newStats.fitness ?? 100) - effectiveDecayRate);

  // 2. REAL income aggregation (career + passive + partner + perks + pension…).
  const passive = calcWeeklyPassiveIncome(state, { excludeRealEstate: true }).total || 0;
  const income = computeWeeklyIncome({
    prevState: state,
    careerSalary: currentCareerSalary(state),
    passiveIncome: passive,
    pulseEarnings: 0,
    weeksLivedNow: currentWeeksLived,
    unlockedBonuses: state.prestige?.unlockedBonuses || [],
    retirementIncome: getRetirementIncomeWeekly(state),
  }).totalIncome;
  newStats.money = Math.min(MONEY_CEILING, Math.max(0, (newStats.money ?? 0) + (isFiniteNum(income) ? income : 0)));

  // 3. REAL luxury upkeep + happiness/reputation drift (mutates newStats).
  const ctx: WeekContext = {
    newStats,
    notifications: [],
    preRolls: buildPreRolls(),
    nextWeeksLived,
  };
  applyLuxuryItemsForWeek(state.luxuryItems, ctx);

  return {
    ...state,
    stats: newStats,
    weeksLived: nextWeeksLived,
    week: (nextWeeksLived % 4) + 1,
    date: {
      ...state.date,
      age: nextAge,
      year: state.date?.year ?? 2025,
    },
  };
}

function advanceWeeksHeadless(state: GameState, weeks: number): GameState {
  let s = state;
  for (let i = 0; i < weeks; i++) s = advanceOneWeekHeadless(s);
  return s;
}

// ===========================================================================
// Scenario seed helpers (used to make each sim self-contained + idempotent)
// ===========================================================================

function makeTestCompany(id: string, weeklyIncome = 5000): Company {
  return {
    id,
    name: `DevTest Co ${id}`,
    type: 'factory',
    weeklyIncome,
    baseWeeklyIncome: weeklyIncome,
    upgrades: [],
    employees: 0,
    workerSalary: 0,
    workerMultiplier: 1,
    marketingLevel: 0,
    miners: {},
    warehouseLevel: 0,
    unlockedTechnologies: [],
  };
}

/** Six-rung career ladder with strictly-rising salaries + no tenure gate. */
function makeSyntheticCareer(id: string): Career {
  const levels = [1000, 1800, 2800, 4200, 6500, 10000].map((salary, i) => ({
    name: `Level ${i + 1}`,
    salary,
    // experienceRequired 0 → promotion tenure gate is a no-op (still exercises
    // the accepted/progress/performance gates, which is what we assert on).
    experienceRequired: 0,
  }));
  return {
    id,
    name: 'DevTest Career',
    accepted: true,
    applied: true,
    level: 0,
    progress: 100,
    performance: 100,
    levels,
    // startedWeeksLived omitted → tenure treated as Infinity (no gate).
  } as unknown as Career;
}

function makeTestChild(id: string, age: number): ChildInfo {
  return {
    id,
    name: 'DevTest Child',
    type: 'child',
    relationshipScore: 50,
    age,
  } as unknown as ChildInfo;
}

/** A clean, well-formed base state for tests and for the default UI base. */
export function getBaseSimState(): GameState {
  return deepClone(initialGameState);
}

// ===========================================================================
// SIMULATIONS
// ===========================================================================

// --- 1. 52-week tick -------------------------------------------------------
const sim52WeekTick = defineSim(
  'tick_52_weeks',
  '52-Week Tick',
  'Runs the real weekly reducers 52× on a clone: no throw, age +~1yr, money finite, stats in [0,100].',
  (s, c) => {
    s.weeksLived = s.weeksLived ?? 0;
    s.date = { ...s.date, age: s.date?.age ?? 18 };
    const startAge = s.date.age;
    const startWeeks = s.weeksLived;

    const end = advanceWeeksHeadless(s, 52);

    c.ok(end.weeksLived === startWeeks + 52, `weeksLived advanced 52 (${startWeeks} → ${end.weeksLived})`);
    c.ok(approx(end.date.age - startAge, 1, 0.05), `age advanced ~1 year (${startAge.toFixed(2)} → ${end.date.age.toFixed(2)})`);
    c.ok(isFiniteNum(end.stats.money) && end.stats.money >= 0, `money finite & non-negative ($${Math.round(end.stats.money)})`);
    c.ok(inRange(end.stats.health, 0, 100), `health in [0,100] (${end.stats.health.toFixed(1)})`);
    c.ok(inRange(end.stats.happiness, 0, 100), `happiness in [0,100] (${end.stats.happiness.toFixed(1)})`);
    c.ok(inRange(end.stats.energy, 0, 100), `energy in [0,100] (${end.stats.energy.toFixed(1)})`);
    c.ok(inRange(end.stats.fitness, 0, 100), `fitness in [0,100] (${end.stats.fitness.toFixed(1)})`);
    return 'Survived 52 weeks — time, money and stats all stayed valid.';
  },
);

// --- 2. Full prestige cycle ------------------------------------------------
const simPrestigeCycle = defineSim(
  'prestige_cycle',
  'Full Prestige Cycle',
  'Meets the net-worth threshold, runs executePrestige → points up, life reset, previousLives appended.',
  (s, c) => {
    const level = s.prestige?.prestigeLevel ?? 0;
    const threshold = getPrestigeThreshold(level);
    // Cash is counted 1:1 by netWorth, so this clears the gate.
    s.stats = { ...s.stats, money: threshold + 100_000 };

    const pointsBefore = s.prestige?.prestigePoints ?? 0;
    const prestigesBefore = s.prestige?.totalPrestiges ?? 0;
    const livesBefore = s.previousLives?.length ?? 0;
    const weeksBefore = s.weeksLived ?? 0;
    c.note(`threshold $${threshold.toLocaleString()}, seeded net worth $${Math.round(netWorth(s)).toLocaleString()}`);

    const after = executePrestige(s, 'reset');

    c.ok((after.prestige?.prestigePoints ?? 0) > pointsBefore, `prestige points increased (${pointsBefore} → ${after.prestige?.prestigePoints ?? 0})`);
    c.ok((after.prestige?.totalPrestiges ?? 0) === prestigesBefore + 1, `totalPrestiges +1 (${prestigesBefore} → ${after.prestige?.totalPrestiges ?? 0})`);
    c.ok((after.prestige?.prestigeLevel ?? 0) === level + 1, `prestige level +1 (${level} → ${after.prestige?.prestigeLevel ?? 0})`);
    c.ok((after.previousLives?.length ?? 0) > livesBefore, `previousLives appended (${livesBefore} → ${after.previousLives?.length ?? 0})`);
    c.ok((after.weeksLived ?? 0) < weeksBefore + 1 && (after.weeksLived ?? 0) === 0, `life reset (weeksLived → ${after.weeksLived ?? 0})`);
    return 'Prestige executed: points granted, level advanced, life reset, lineage recorded.';
  },
);

// --- 3. Buy every luxury ---------------------------------------------------
const simBuyEveryLuxury = defineSim(
  'luxury_buy_all',
  'Buy Every Luxury',
  'Funds a clone and purchases all 12 trophies via the real action: each owned, cash spent, net worth reflects resale, luxury_life met.',
  (s, c) => {
    const allIds = LUXURY_CATALOG.map((it) => it.id);
    const totalPrice = getTotalLuxuryValue(allIds);
    const h = makeHarness(s);
    // Fund generously (well over the catalog total).
    updateMoney(h.setGameState, totalPrice + 1_000_000, 'devtools: fund luxury');
    const moneyBefore = h.getState().stats.money;

    let allBought = true;
    for (const item of LUXURY_CATALOG) {
      const r = purchaseLuxuryItem(h.getState(), h.setGameState, item.id);
      if (!r.success || !ownsLuxuryItem(h.getState().luxuryItems, item.id)) allBought = false;
    }
    const st = h.getState();
    const owned = st.luxuryItems || [];
    const spent = moneyBefore - st.stats.money;

    c.ok(allBought && owned.length === LUXURY_CATALOG.length, `all ${LUXURY_CATALOG.length} luxuries owned (${owned.length})`);
    c.ok(approx(spent, totalPrice, Math.max(1, totalPrice * 0.001)), `cash decreased by ~catalog sum ($${Math.round(spent).toLocaleString()} vs $${totalPrice.toLocaleString()})`);
    c.ok(isFiniteNum(st.stats.money) && st.stats.money >= 0, `money still finite & non-negative ($${Math.round(st.stats.money).toLocaleString()})`);

    // Net worth reflects the owned trophies' resale value (on TOP of remaining cash).
    const nw = netWorth(st);
    const resale = getTotalLuxuryResaleValue(owned);
    const luxuryContribution = nw - st.stats.money;
    c.ok(luxuryContribution > 0, `net worth counts luxury beyond cash (+$${Math.round(luxuryContribution).toLocaleString()})`);
    c.ok(approx(luxuryContribution, resale, Math.max(1, resale * 0.02)), `luxury net-worth contribution ≈ resale value ($${Math.round(resale).toLocaleString()})`);

    // luxury_life predicate (real constants): ≥3 trophies AND value ≥ threshold.
    const luxuryLife = getOwnedLuxuryCount(owned) >= LUXURY_LIFE_MIN_ITEMS && getTotalLuxuryValue(owned) >= LUXURY_LIFE_VALUE_THRESHOLD;
    c.ok(luxuryLife, `luxury_life predicate true (count ${getOwnedLuxuryCount(owned)}≥${LUXURY_LIFE_MIN_ITEMS}, value $${getTotalLuxuryValue(owned).toLocaleString()}≥$${LUXURY_LIFE_VALUE_THRESHOLD.toLocaleString()})`);
    return 'Bought the entire trophy catalog — ownership, spend, net worth and luxury_life all check out.';
  },
);

// --- 4. Career hire → top --------------------------------------------------
const simCareerToTop = defineSim(
  'career_to_top',
  'Career: Hire → Top',
  'Promotes a real accepted career to max level: gating blocks the unqualified, salary rises each level.',
  (s, c) => {
    const careerId = 'devtest_career';
    s.careers = [makeSyntheticCareer(careerId)];
    s.weeksLived = 200;
    s.currentJob = careerId;
    const h = makeHarness(s);

    // Gating: an unqualified promote (progress < 100) is blocked by the real gate.
    h.setGameState((prev) => ({
      ...prev,
      careers: prev.careers.map((cc) => (cc.id === careerId ? { ...cc, progress: 40 } : cc)),
    }));
    const blocked = promoteCareer(h.getState(), h.setGameState, careerId);
    c.ok(!blocked.success, `unqualified promotion blocked ("${blocked.message.slice(0, 48)}…")`);

    // Promote to the top, re-satisfying the review each cycle.
    const maxLevel = (h.getState().careers[0].levels.length ?? 1) - 1;
    let salaryRisesMonotonic = true;
    let promotions = 0;
    for (let guard = 0; guard < 12; guard++) {
      const cur = h.getState().careers.find((cc) => cc.id === careerId)!;
      if (cur.level >= maxLevel) break;
      const salaryBefore = cur.levels[cur.level].salary;
      // Re-reach 100% progress + a strong review (real weekly loop would do this).
      h.setGameState((prev) => ({
        ...prev,
        careers: prev.careers.map((cc) => (cc.id === careerId ? { ...cc, progress: 100, performance: 100 } : cc)),
      }));
      const r = promoteCareer(h.getState(), h.setGameState, careerId);
      if (!r.success) {
        c.ok(false, `promotion to level ${cur.level + 1} succeeded ("${r.message.slice(0, 40)}")`);
        break;
      }
      promotions += 1;
      const now = h.getState().careers.find((cc) => cc.id === careerId)!;
      const salaryAfter = now.levels[now.level].salary;
      if (!(salaryAfter > salaryBefore)) salaryRisesMonotonic = false;
    }

    const finalCareer = h.getState().careers.find((cc) => cc.id === careerId)!;
    c.ok(finalCareer.level === maxLevel, `reached top level (${finalCareer.level}/${maxLevel})`);
    c.ok(promotions === maxLevel, `promoted through every rung (${promotions})`);
    c.ok(salaryRisesMonotonic, 'salary rose at every promotion');
    // At the top, the real gate now reports max-level.
    const atTop = promoteCareer(h.getState(), h.setGameState, careerId);
    c.ok(!atTop.success, `further promotion blocked at max ("${atTop.message.slice(0, 40)}…")`);
    return 'Climbed from hire to the top rung — gating enforced, salary rose each level.';
  },
);

// --- 5. Hobby → Master -----------------------------------------------------
const simHobbyToMaster = defineSim(
  'hobby_to_master',
  'Hobby → Master',
  'Practices a real pursuit until Master: xp/level rise, top tier reached, a tier-up spike is paid.',
  (s, c) => {
    const pursuit = PURSUITS[0];
    const id = pursuit.id;
    s.pursuits = { ...(s.pursuits || {}) };
    s.weeklyPursuitPractice = {};
    const h = makeHarness(s);

    // Reward stats a pursuit can pay into. We reset these to 0 before EACH
    // practice so the reward lands clamp-free and the tier-up spike is
    // measurable (fitness/happiness/etc. would otherwise pin at 100). money is
    // measured via its own delta (it never clamps at 100).
    const rewardStats = ['health', 'happiness', 'fitness', 'reputation'] as const;
    const practiceGain = (before: GameState['stats'], after: GameState['stats']): number => {
      let g = (after.money ?? 0) - (before.money ?? 0);
      for (const k of rewardStats) g += (after[k] ?? 0) - (before[k] ?? 0);
      return g;
    };

    let sawTierUp = false;
    let normalGain = -Infinity; // best plain-practice reward
    let tierUpGain = -Infinity; // best tier-up-practice reward (should exceed it)
    let practices = 0;
    for (let guard = 0; guard < 60; guard++) {
      const cur = h.getState().pursuits?.[id]?.level ?? 0;
      if (cur >= MAX_PURSUIT_LEVEL) break;
      // Fresh week: reset the weekly cap, top up energy, and give reward-stat headroom.
      h.setGameState((prev) => ({
        ...prev,
        stats: { ...prev.stats, energy: 100, health: 0, happiness: 0, fitness: 0, reputation: 0 },
        weeklyPursuitPractice: { ...(prev.weeklyPursuitPractice || {}), [id]: 0 },
      }));
      const before = { ...h.getState().stats };
      const r = practicePursuit(h.getState(), h.setGameState, id);
      if (!r.success) {
        c.ok(false, `practice #${practices + 1} succeeded ("${r.message.slice(0, 40)}")`);
        break;
      }
      practices += 1;
      const gain = practiceGain(before, h.getState().stats);
      if (r.tierUp) {
        sawTierUp = true;
        tierUpGain = Math.max(tierUpGain, gain);
      } else if (!r.leveledUp) {
        normalGain = Math.max(normalGain, gain);
      }
    }

    const finalLevel = h.getState().pursuits?.[id]?.level ?? 0;
    const finalXp = h.getState().pursuits?.[id]?.xp ?? 0;
    c.ok(finalXp > 0, `xp accumulated (${finalXp})`);
    c.ok(finalLevel === MAX_PURSUIT_LEVEL, `reached max level ${MAX_PURSUIT_LEVEL} (${finalLevel})`);
    c.ok(sawTierUp, `crossed into a new mastery tier ("${tierForLevel(finalLevel).name}")`);
    c.ok(
      isFiniteNum(tierUpGain) && isFiniteNum(normalGain) && tierUpGain > normalGain,
      `tier-up spike exceeds a normal practice (${Math.round(tierUpGain)} > ${Math.round(normalGain)})`,
    );
    return `Mastered ${pursuit.name} in ${practices} practices — top tier "${tierForLevel(finalLevel).name}" reached.`;
  },
);

// --- 6. Retire → pension ---------------------------------------------------
const simRetireToPension = defineSim(
  'retire_pension',
  'Retire → Pension',
  'Retires an eligible senior: isRetired latched, pension bounded (< peak salary), weekly income flows.',
  (s, c) => {
    const peakSalary = 2000; // weekly $
    s.date = { ...s.date, age: 66 };
    // A 66-year-old has a long life behind them — keep weeksLived realistic so
    // the tick's beginner-luck window (weeks < 20) does not spike the paycheck.
    s.weeksLived = Math.round((66 - 18) * WEEKS_PER_YEAR);
    s.isRetired = false;
    s.lifetimeStatistics = {
      ...(s.lifetimeStatistics || {}),
      highestSalary: peakSalary,
      totalWeeksWorked: 35 * WEEKS_PER_YEAR, // full service
    } as GameState['lifetimeStatistics'];

    const expectedPension = computePension(s).weekly;
    const result = retirePlayer(s);

    c.ok(result.ok, `retirement accepted (reason: ${result.reason})`);
    c.ok(result.state.isRetired === true, 'isRetired latched true');
    c.ok(result.pensionWeekly > 0, `pension is positive ($${result.pensionWeekly}/wk)`);
    c.ok(result.pensionWeekly < peakSalary, `pension < peak salary ($${result.pensionWeekly} < $${peakSalary})`);
    c.ok(result.pensionWeekly === expectedPension, `pension matches computePension ($${expectedPension})`);

    // Weekly income actually flows: a headless tick credits ~the pension.
    const before = result.state.stats.money;
    const ticked = advanceOneWeekHeadless(result.state);
    const credited = ticked.stats.money - before;
    c.ok(getRetirementIncomeWeekly(result.state) === result.pensionWeekly, 'retirement income helper reports the pension');
    c.ok(approx(credited, result.pensionWeekly, 1), `tick credited the pension (+$${Math.round(credited)})`);
    return `Retired at 66 on a $${result.pensionWeekly}/wk pension that flows each week.`;
  },
);

// --- 7. Parenting → heir ---------------------------------------------------
const simParentingToHeir = defineSim(
  'parenting_heir',
  'Parenting → Heir',
  'Runs real parenting actions on a child: nurture stats rise (capped), bookkeeping advances.',
  (s, c) => {
    const child = makeTestChild('devtest_child', 6);
    const actions = getActionsForAge(child.age);
    c.ok(actions.length > 0, `age-appropriate actions exist for age ${child.age} (${actions.length})`);
    if (actions.length === 0) return 'no actions for age';

    const action = actions[0];
    const effectKeys = Object.keys(action.effects || {});
    c.note(`action "${action.id}" effects: ${effectKeys.join(', ') || 'none'}`);

    let cur = child;
    let applied = 0;
    let anyStatRose = false;
    let week = 100;
    // Apply the action a few times across "weeks" (respecting its real cooldown).
    for (let i = 0; i < 3; i++) {
      const before: Record<string, number> = {};
      for (const k of effectKeys) before[k] = (cur as unknown as Record<string, number>)[k] ?? 50;
      const beforeRel = cur.relationshipScore ?? 50;
      const outcome = applyParentingAction(cur, action.id, week, 1_000_000, 100);
      if (!outcome.ok || !outcome.child) {
        c.note(`apply #${i + 1} rejected: ${outcome.reason}`);
        week += 8;
        continue;
      }
      applied += 1;
      cur = outcome.child;
      for (const k of effectKeys) {
        const delta = (action.effects as Record<string, number>)[k] ?? 0;
        const after = k === 'relationship' ? (cur.relationshipScore ?? 50) : ((cur as unknown as Record<string, number>)[k] ?? 50);
        const start = k === 'relationship' ? beforeRel : before[k];
        if (delta > 0 && after > start) anyStatRose = true;
        c.ok(inRange(after, 0, 100), `${k} stays capped [0,100] (${after})`);
      }
      week += 8; // advance past the action cooldown
    }

    c.ok(applied > 0, `parenting action applied (${applied}×)`);
    c.ok(anyStatRose, 'at least one nurture/heir stat rose');
    c.ok((cur.parenting?.totalActions ?? 0) >= applied, `parenting bookkeeping advanced (${cur.parenting?.totalActions ?? 0} total)`);
    return `Nurtured the heir ${applied}× — child-development stats improved and stayed capped.`;
  },
);

// --- 8. Fulfill ambition ---------------------------------------------------
const simFulfillAmbition = defineSim(
  'ambition_fulfill',
  'Fulfill Ambition',
  'Assigns an ambition, satisfies every milestone (real predicates), claims once — idempotent on a 2nd claim.',
  (s, c) => {
    // business_empire: milestones = own ≥1 & ≥3 companies, net worth ≥$5M & ≥$25M.
    const ambition = LIFE_AMBITIONS.find((a) => a.id === 'business_empire') ?? LIFE_AMBITIONS[0];
    s.ambitionId = ambition.id;
    s.ambitionCompletedMilestones = [];
    s.ambitionRewardClaimed = false;
    s.companies = [makeTestCompany('c1'), makeTestCompany('c2'), makeTestCompany('c3')];
    s.stats = { ...s.stats, money: 30_000_000, gems: s.stats?.gems ?? 0 };

    const completion = getAmbitionCompletion(s);
    c.ok(!!completion, 'ambition completion resolves');
    c.ok(!!completion && completion.allComplete, `all ${completion?.totalCount ?? '?'} milestones satisfied (real predicates)`);
    c.ok(!!completion && completion.readyToClaim, 'ready to claim');

    const payoff = ambition.payoff;
    const moneyBefore = s.stats.money;
    const gemsBefore = s.stats.gems ?? 0;

    const granted = grantAmbitionPayout(s);
    c.ok(granted.ambitionRewardClaimed === true, 'reward marked claimed');
    c.ok(granted.stats.money === moneyBefore + (payoff.money ?? 0), `money payoff granted (+$${(payoff.money ?? 0).toLocaleString()})`);
    c.ok((granted.stats.gems ?? 0) === gemsBefore + (payoff.gems ?? 0), `gem payoff granted (+${payoff.gems ?? 0})`);

    // Idempotent: a 2nd claim grants nothing.
    const grantedTwice = grantAmbitionPayout(granted);
    c.ok(grantedTwice.stats.money === granted.stats.money, 'second claim does not re-grant money');
    c.ok((grantedTwice.stats.gems ?? 0) === (granted.stats.gems ?? 0), 'second claim does not re-grant gems');
    return `Completed "${ambition.name}" — payoff granted once and idempotent on re-claim.`;
  },
);

// --- 9. autoInvest / DCA ---------------------------------------------------
const simAutoInvestDca = defineSim(
  'auto_invest_dca',
  'Auto-Invest / DCA',
  'Runs the real stock auto-reinvest reducer: shares actually bought, spend bounded by the amount (no overspend).',
  (s, c) => {
    // The real recurring stock-buy path is applyAutoReinvest (dividends → shares).
    // Budget chosen well above any single share price so ≥1 share always fills.
    const reinvestAmount = 500_000;
    const result = applyAutoReinvest({
      prevHoldings: [],
      reinvestedAmount: reinvestAmount,
      stockPickRoll: 0.5,
    });
    const holdings = result.reinvestedStocks;

    c.ok(holdings.length > 0, `real shares were bought (${holdings.length} holding)`);
    const bought = holdings[0];
    c.ok(!!bought && bought.shares > 0, `positive share count (${bought?.shares ?? 0} × ${bought?.symbol ?? '?'})`);
    const spent = (bought?.shares ?? 0) * (bought?.currentPrice ?? bought?.averagePrice ?? 0);
    c.ok(isFiniteNum(spent) && spent > 0, `cash outlay is real & finite ($${Math.round(spent)})`);
    c.ok(spent <= reinvestAmount + 1e-6, `no overspend: outlay $${Math.round(spent)} ≤ budget $${reinvestAmount}`);
    // A rule that fires with $0 must buy nothing (no minting).
    const zero = applyAutoReinvest({ prevHoldings: [], reinvestedAmount: 0, stockPickRoll: 0.5 });
    c.ok(zero.reinvestedStocks.length === 0, 'a $0 rule buys nothing (no minting)');
    return `Auto-invest bought ${bought?.shares ?? 0} share(s) of ${bought?.symbol ?? '?'} within the $${reinvestAmount} budget.`;
  },
);

// --- 10. R&D research → complete -------------------------------------------
const simResearchComplete = defineSim(
  'rd_research_complete',
  'R&D → Complete',
  'Builds a lab, starts research, advances weeks: completeResearch fires and the technology unlocks.',
  (s, c) => {
    const companyId = 'devtest_rd_co';
    const techId = 'automation_lvl1'; // tier-1 tech, valid on a basic lab
    s.companies = [makeTestCompany(companyId)];
    s.stats = { ...s.stats, money: 5_000_000 };
    const h = makeHarness(s);
    const deps = { updateMoney };

    const lab = buildRDLab(h.getState(), h.setGameState, companyId, 'basic', deps);
    c.ok(lab.success, `basic lab built ("${lab.message.slice(0, 40)}")`);
    c.ok(!!h.getState().companies.find((cc) => cc.id === companyId)?.rdLab, 'company now has an rdLab');

    const started = startResearch(h.getState(), h.setGameState, companyId, techId, deps);
    c.ok(started.success, `research started ("${started.message.slice(0, 40)}")`);

    // Advance weeks (advanceResearch is a real weekly reducer) until it completes.
    let completed = false;
    for (let wk = 0; wk < 60; wk++) {
      advanceResearch(h.getState(), h.setGameState);
      const co = h.getState().companies.find((cc) => cc.id === companyId);
      const proj = co?.rdLab?.researchProjects.find((p) => p.technologyId === techId);
      if (proj?.completed) {
        completed = true;
        break;
      }
    }
    const co = h.getState().companies.find((cc) => cc.id === companyId);
    const proj = co?.rdLab?.researchProjects.find((p) => p.technologyId === techId);
    c.ok(completed && !!proj?.completed, 'research project reached completed=true');
    c.ok((co?.unlockedTechnologies || []).includes(techId), `technology unlocked (${techId})`);
    return 'Built a lab, ran research to completion, and unlocked the technology.';
  },
);

// --- 11. MONEY INTEGRITY (critical) ----------------------------------------
const simMoneyIntegrity = defineSim(
  'money_integrity',
  'Money Integrity',
  'Earn/buy/sell/transfer/bill-pay/upkeep/tick on a clone: money never negative/NaN, checking mirror stays synced, no minting on a no-op tick.',
  (s, c) => {
    const h = makeHarness(s);
    const check = (label: string) => {
      const m = h.getState().stats.money;
      c.ok(isFiniteNum(m) && m >= 0, `money valid after ${label} ($${Math.round(m).toLocaleString()})`);
    };

    // Earn (canonical path).
    updateMoney(h.setGameState, 1_000_000, 'devtools: seed');
    updateMoney(h.setGameState, 50_000, 'salary');
    check('earn');

    // Buy then sell a luxury (real actions, mirror-safe stats.money only).
    purchaseLuxuryItem(h.getState(), h.setGameState, 'supercar');
    check('buy');
    sellLuxuryItem(h.getState(), h.setGameState, 'supercar');
    check('sell');

    // Overdraft attempt: spending more than on hand must be rejected (not negative).
    const beforeOverdraft = h.getState().stats.money;
    updateMoney(h.setGameState, -(beforeOverdraft + 5_000_000), 'devtools: overdraft attempt');
    c.ok(h.getState().stats.money === beforeOverdraft, 'overdraft rejected — balance unchanged');
    check('overdraft-reject');

    // Transfer between two real accounts conserves the account total.
    let banking = h.getState().banking;
    if (banking && findAccount(banking, 'savings-default') && findAccount(banking, 'checking-default')) {
      const dep = depositToAccount(banking, 'savings-default', 20_000);
      banking = dep.banking;
      const fromBefore = findAccount(banking, 'savings-default')?.balance ?? 0;
      const toBefore = findAccount(banking, 'checking-default')?.balance ?? 0;
      const tr = transferBetweenAccounts(banking, 'savings-default', 'checking-default', 5_000, s.weeksLived ?? 0);
      c.ok(tr.ok, 'account-to-account transfer succeeded');
      const fromAfter = findAccount(tr.banking, 'savings-default')?.balance ?? 0;
      const toAfter = findAccount(tr.banking, 'checking-default')?.balance ?? 0;
      c.ok(approx(fromBefore + toBefore, fromAfter + toAfter, 0.001), 'transfer conserved the two account balances');
      h.setGameState((prev) => ({ ...prev, banking: tr.banking }));
    } else {
      c.note('no default accounts present — transfer leg skipped');
    }

    // Bill-pay + mirror sync: run the REAL banking weekly tick and assert the
    // checking-default mirror equals stats.money afterward (no desync).
    const st = h.getState();
    if (st.banking) {
      const tick = runWeeklyBankingTick({
        banking: st.banking,
        prevLoans: st.loans || [],
        processedLoans: st.loans || [],
        newBankSavings: st.bankSavings ?? 0,
        newMoney: st.stats.money,
        currentWeek: st.weeksLived ?? 0,
      });
      const checking = findAccount(tick.banking, 'checking-default');
      c.ok(!!checking, 'checking-default account exists');
      c.ok(!!checking && approx(checking.balance, st.stats.money, 0.001), `checking mirror equals stats.money ($${Math.round(checking?.balance ?? -1).toLocaleString()})`);
    } else {
      c.note('no banking slice present — mirror-sync leg skipped');
    }

    // Conservation: a no-op tick for an established life with NO income sources
    // must NOT mint money.
    const noop = deepClone(h.getState());
    noop.weeksLived = 30; // past the beginner-luck window (weeks < 20)
    noop.currentJob = undefined;
    noop.careers = [];
    noop.luxuryItems = [];
    noop.isRetired = false;
    noop.realEstate = [];
    noop.companies = [];
    noop.relationships = [];
    const moneyPreNoop = noop.stats.money;
    const afterNoop = advanceOneWeekHeadless(noop);
    c.ok(afterNoop.stats.money === moneyPreNoop, `no money minted on a no-op tick ($${Math.round(afterNoop.stats.money).toLocaleString()})`);
    c.ok(isFiniteNum(afterNoop.stats.money) && afterNoop.stats.money >= 0, 'money finite & non-negative after tick');
    return 'Money survived earn/buy/sell/overdraft/transfer/bill-pay/tick — no desync, no negative, no minting.';
  },
);

// --- 12. Skill effects -----------------------------------------------------
const simSkillEffects = defineSim(
  'skill_effects',
  'Skill Effects',
  'Unlocks a salary + a relationship life-skill via the real purchase path: the target computations change vs baseline.',
  (s, c) => {
    s.stats = { ...s.stats, money: 500_000 };
    s.date = { ...s.date, age: 40 };
    s.unlockedLifeSkills = [];

    const baseline = getLifeSkillModifiers(s);
    c.note(`baseline salaryMult=${baseline.salaryMult}, relationshipGainMult=${baseline.relationshipGainMult}`);

    // Salary skill (negotiation → +15% salaryMult) via the real reducer.
    const buyNeg = purchaseLifeSkill(s, { id: 'negotiation', cost: 5000, levelRequired: 0 });
    c.ok(buyNeg.purchased, `negotiation purchased (${buyNeg.reason ?? 'ok'})`);
    c.ok(buyNeg.state.stats.money === s.stats.money - 5000, `purchase charged real cash ($${(s.stats.money - 5000).toLocaleString()})`);
    const afterNeg = getLifeSkillModifiers(buyNeg.state);
    c.ok(afterNeg.salaryMult > baseline.salaryMult, `salaryMult increased (${baseline.salaryMult} → ${afterNeg.salaryMult})`);

    // Relationship skill (charisma → +10% relationshipGainMult).
    const buyCha = purchaseLifeSkill(buyNeg.state, { id: 'charisma', cost: 5000, levelRequired: 0 });
    c.ok(buyCha.purchased, `charisma purchased (${buyCha.reason ?? 'ok'})`);
    const afterCha = getLifeSkillModifiers(buyCha.state);
    c.ok(afterCha.relationshipGainMult > baseline.relationshipGainMult, `relationshipGainMult increased (${baseline.relationshipGainMult} → ${afterCha.relationshipGainMult})`);

    // Re-purchase is a no-op (already unlocked) — no double charge.
    const dup = purchaseLifeSkill(buyCha.state, { id: 'negotiation', cost: 5000, levelRequired: 0 });
    c.ok(!dup.purchased && dup.reason === 'already-unlocked', 'already-unlocked skill is not re-charged');
    return 'Unlocked negotiation + charisma — salary and relationship modifiers changed as designed.';
  },
);

// ===========================================================================
// Registry
// ===========================================================================

export const ALL_SIMULATIONS: Simulation[] = [
  sim52WeekTick,
  simPrestigeCycle,
  simBuyEveryLuxury,
  simCareerToTop,
  simHobbyToMaster,
  simRetireToPension,
  simParentingToHeir,
  simFulfillAmbition,
  simAutoInvestDca,
  simResearchComplete,
  simMoneyIntegrity,
  simSkillEffects,
];

export interface RunAllSummary {
  total: number;
  passed: number;
  failed: number;
  results: SimResult[];
}

/** Run every simulation against a base state (each deep-clones internally). */
export function runAllSimulations(base: GameState): RunAllSummary {
  const results = ALL_SIMULATIONS.map((sim) => sim.run(base));
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}
