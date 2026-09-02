/**
 * Early-game persona simulator — Master Program 7.
 *
 * Drives the REAL production `nextWeek()` (GameProvider-mounted, the
 * `tickTiming.bench` / `economyStrategySim` pattern) on the REAL onboarding
 * seed (`buildNewGameState` over a scenario from `scenarioData`), with a
 * scripted "player" that acts each week through the REAL action functions —
 * `applyForJob`, `performHealthActivity`, `rentHome`, `performStreetJob`,
 * `buyFood`, `promoteCareer`. Nothing is written to state by hand, so what a
 * persona "does" is exactly what a thumb on the screen can do.
 *
 * Deterministic: `Math.random` is replaced by a seeded PRNG for the run and
 * restored afterwards, so a persona + seed reproduces the same 20 weeks every
 * time, and "unlucky" is a matter of running more seeds, not of guessing.
 *
 * Shared by the manual soak (`__tests__/simulation/earlyGamePersonas.sim.test.ts`)
 * and the CI survivability gates (`__tests__/simulation/earlyGameSurvivability.test.ts`).
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions, useItemActions, useJobActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import * as scenarioData from '@/src/features/onboarding/scenarioData';
import { rentHome as rentHomeAction } from '@/contexts/game/actions/RentalActions';
import { getJobBoard } from '@/lib/careers/jobMarket';
import { getPromotionEligibility } from '@/lib/careers/promotionGating';
import { netWorth } from '@/lib/progress/achievements';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const h = React.createElement;

export interface SimActionResult {
  success?: boolean;
  message?: string;
}

/** What a persona can do in a week. Every call goes through a real action. */
export interface SimActions {
  applyForJob: (careerId: string) => Promise<SimActionResult | undefined>;
  promoteCareer: (careerId: string) => Promise<SimActionResult | undefined>;
  performStreetJob: (jobId: string) => Promise<SimActionResult | undefined>;
  performHealthActivity: (activityId: string) => Promise<SimActionResult | undefined>;
  buyFood: (foodId: string) => Promise<SimActionResult | undefined>;
  rentHome: (tierId: string) => Promise<SimActionResult | undefined>;
}

export interface SimWeekContext {
  /** The state at the START of this week's actions (refreshed after each action). */
  state: () => GameState;
  /** Weeks into this life (0 on the first frame). */
  week: number;
  actions: SimActions;
  /** Free-text note that lands in the row for this week. */
  note: (text: string) => void;
  /** Every notification the last tick pushed (titles), for "did the game tell me". */
  lastNotifications: string[];
}

export type SimPolicy = (ctx: SimWeekContext) => Promise<void> | void;

export interface SimRow {
  week: number;
  cash: number;
  /** Cash change produced by the TICK alone (income − bills), not by the persona's spending. */
  tickDelta: number;
  /** Cash the persona spent on actions this week. */
  spent: number;
  netWorth: number;
  health: number;
  happiness: number;
  energy: number;
  fitness: number;
  housing: string;
  job: string;
  level: number;
  diseases: string[];
  overdue: number;
  notes: string[];
}

export interface SimResult {
  name: string;
  scenarioId: string;
  seed: number;
  rows: SimRow[];
  died: boolean;
  deathWeek: number | null;
  deathReason: string | null;
  finalState: GameState;
  /** Lowest health / happiness seen at any week boundary. */
  minHealth: number;
  minHappiness: number;
}

export interface SimSpec {
  name: string;
  scenarioId?: string;
  seed?: number;
  weeks?: number;
  policy: SimPolicy;
  /** Optional tweak applied to the seeded state before the first frame. */
  mutateSeed?: (state: GameState) => GameState;
}

/** mulberry32 — small, fast, good enough to make a run reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function findScenario(id: string): any {
  const lists = Object.values(scenarioData).filter((v): v is any[] => Array.isArray(v));
  const scenario = lists.flat().find((s) => s?.id === id);
  if (!scenario) throw new Error(`scenario not found: ${id}`);
  return scenario;
}

/** The state "Play" actually seeds for a scenario. */
export function seedScenario(scenarioId = 'food_courier'): GameState {
  return buildNewGameState({
    initialGameState,
    stateVersion: STATE_VERSION,
    firstName: 'New',
    lastName: 'Player',
    sex: 'male',
    sexuality: 'straight',
    scenario: findScenario(scenarioId),
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
  }) as GameState;
}

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  nextWeek: () => Promise<void> | void;
  job: ReturnType<typeof useJobActions>;
  item: ReturnType<typeof useItemActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const actions = useGameActions();
  const job = useJobActions();
  const item = useItemActions();
  captured = {
    state: gameState,
    setGameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
    job,
    item,
  };
  return null;
}

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent))),
    );
  });
  return { root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function housingLabel(state: GameState): string {
  const hw = computeHousingWellbeing(state);
  if (hw.owned) return 'owned';
  if (hw.homeless) return 'homeless';
  return state.rental?.tierId ?? 'rented';
}

function jobLabel(state: GameState): { job: string; level: number } {
  if (!state.currentJob) return { job: 'none', level: 0 };
  const career = (state.careers ?? []).find((c) => c.id === state.currentJob);
  return { job: state.currentJob, level: career?.level ?? 0 };
}

/**
 * Run one persona for N weeks. Ticks stop at death (the row for the death week
 * is still recorded).
 */
export async function runPersona(spec: SimSpec): Promise<SimResult> {
  const scenarioId = spec.scenarioId ?? 'food_courier';
  const seed = spec.seed ?? 1;
  const weeks = spec.weeks ?? 20;
  const originalRandom = Math.random;
  Math.random = mulberry32(seed);

  const mounted = mountGame();
  try {
    let seeded = seedScenario(scenarioId);
    if (spec.mutateSeed) seeded = spec.mutateSeed(seeded);
    await act(async () => {
      captured!.setGameState(() => seeded);
      await Promise.resolve();
    });

    const rows: SimRow[] = [];
    let died = false;
    let deathWeek: number | null = null;
    let deathReason: string | null = null;
    let minHealth = 100;
    let minHappiness = 100;
    let lastNotifications: string[] = [];

    // Every action runs inside `act` so its updater is applied before the
    // persona reads the state again. `performHealthActivity` clears its
    // double-tap guard on a 50 ms timer (`ItemActionsContext`), which is a
    // debounce for thumbs, not a weekly cap - the simulator waits it out so
    // "meditate twice" means what it means on a phone.
    const wrap = async <T,>(fn: () => T, settleMs = 0): Promise<T> => {
      let out: T;
      await act(async () => {
        out = fn();
        await Promise.resolve();
      });
      if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
      return out!;
    };

    const actions: SimActions = {
      applyForJob: (id) => wrap(() => captured!.job.applyForJob(id) as SimActionResult | undefined),
      promoteCareer: (id) => wrap(() => captured!.job.promoteCareer(id) as SimActionResult | undefined),
      performStreetJob: (id) => wrap(() => captured!.job.performStreetJob(id) as SimActionResult | undefined),
      performHealthActivity: (id) =>
        wrap(() => captured!.item.performHealthActivity(id) as SimActionResult | undefined, 60),
      buyFood: (id) => wrap(() => captured!.item.buyFood(id) as SimActionResult | undefined),
      rentHome: (tierId) => wrap(() => rentHomeAction(captured!.setGameState, captured!.state, tierId)),
    };

    for (let w = 0; w < weeks; w++) {
      const notes: string[] = [];
      const before = captured!.state;
      const weekIndex = weeksInThisLife(before);
      const cashBeforeActions = before.stats.money;

      await spec.policy({
        state: () => captured!.state,
        week: weekIndex,
        actions,
        note: (t) => notes.push(t),
        lastNotifications,
      });
      await flush();

      const afterActions = captured!.state;
      const spent = Math.round(cashBeforeActions - afterActions.stats.money);
      const cashBeforeTick = afterActions.stats.money;
      const notificationsBefore = (afterActions.notifications ?? []).length;

      await act(async () => {
        await captured!.nextWeek();
        await Promise.resolve();
      });
      await flush();

      const s = captured!.state;
      lastNotifications = (s.notifications ?? [])
        .slice(notificationsBefore)
        .map((n: any) => `${n?.title ?? ''}`)
        .filter(Boolean);
      const { job, level } = jobLabel(s);
      const row: SimRow = {
        week: weeksInThisLife(s),
        cash: Math.round(s.stats.money),
        tickDelta: Math.round(s.stats.money - cashBeforeTick),
        spent,
        netWorth: Math.round(netWorth(s)),
        health: Math.round(s.stats.health),
        happiness: Math.round(s.stats.happiness),
        energy: Math.round(s.stats.energy),
        fitness: Math.round(s.stats.fitness),
        housing: housingLabel(s),
        job,
        level,
        diseases: (s.diseases ?? []).map((d: any) => d?.name ?? d?.id ?? '?'),
        overdue: Math.round(s.overdueBalance ?? 0),
        notes,
      };
      rows.push(row);
      minHealth = Math.min(minHealth, row.health);
      minHappiness = Math.min(minHappiness, row.happiness);

      if (s.showDeathPopup) {
        died = true;
        deathWeek = row.week;
        deathReason = s.deathReason ?? null;
        break;
      }
    }

    return {
      name: spec.name,
      scenarioId,
      seed,
      rows,
      died,
      deathWeek,
      deathReason,
      finalState: captured!.state,
      minHealth,
      minHappiness,
    };
  } finally {
    act(() => mounted.root.unmount());
    captured = null;
    Math.random = originalRandom;
  }
}

/** Format a run as a fixed-width table for the soak's stdout. */
export function formatRun(r: SimResult): string {
  const lines: string[] = [];
  lines.push(`--- ${r.name} · ${r.scenarioId} · seed ${r.seed} · ${r.died ? `DIED week ${r.deathWeek} (${r.deathReason})` : 'alive'} · min hp ${r.minHealth} / min hap ${r.minHappiness}`);
  lines.push('wk |  cash | tick | spent | hp | ha | en | fi | housing     | job/lvl        | notes');
  for (const row of r.rows) {
    lines.push(
      `${String(row.week).padStart(2)} | ${String(row.cash).padStart(5)} | ${String(row.tickDelta).padStart(4)} | ${String(row.spent).padStart(5)} | ${String(row.health).padStart(2)} | ${String(row.happiness).padStart(2)} | ${String(row.energy).padStart(2)} | ${String(row.fitness).padStart(2)} | ${row.housing.padEnd(11)} | ${`${row.job}/${row.level}`.padEnd(14)} | ${[...row.notes, ...(row.diseases.length ? [`sick: ${row.diseases.join(',')}`] : [])].join('; ')}`,
    );
  }
  return lines.join('\n');
}

// ── Policy building blocks ────────────────────────────────────────────────

/** Apply to the first eligible opening on the real job board. */
export async function takeFirstJob(ctx: SimWeekContext, prefer?: string[]): Promise<boolean> {
  const s = ctx.state();
  if (s.currentJob || (s.careers ?? []).some((c) => c.applied && !c.accepted)) return false;
  const board = getJobBoard(s);
  const eligible = board.filter((o) => o.verdict.eligible);
  const pick =
    (prefer ?? []).map((id) => eligible.find((o) => o.careerId === id)).find(Boolean) ?? eligible[0];
  if (!pick) return false;
  const r = await ctx.actions.applyForJob(pick.careerId);
  ctx.note(`apply ${pick.careerId}${r?.success ? '' : ` (${r?.message ?? 'refused'})`}`);
  return !!r?.success;
}

/** Take the promotion if the real gate says it is open. */
export async function promoteIfReady(ctx: SimWeekContext): Promise<boolean> {
  const s = ctx.state();
  if (!s.currentJob) return false;
  const career = (s.careers ?? []).find((c) => c.id === s.currentJob);
  const elig = getPromotionEligibility(career, s.weeksLived);
  if (!elig.eligible) return false;
  const r = await ctx.actions.promoteCareer(s.currentJob);
  if (r?.success) ctx.note('promoted');
  return !!r?.success;
}

/** Perform a free health activity up to `times`, stopping when the game refuses. */
export async function doFree(
  ctx: SimWeekContext,
  activityId: 'walk' | 'meditation',
  times: number,
): Promise<number> {
  let done = 0;
  let refused = '';
  for (let i = 0; i < times; i++) {
    const before = ctx.state().stats;
    const r = await ctx.actions.performHealthActivity(activityId);
    const after = ctx.state().stats;
    const changed = after.happiness !== before.happiness || after.health !== before.health || after.energy !== before.energy;
    if (!changed) {
      refused = r?.message ?? 'no change';
      break;
    }
    done++;
  }
  if (done) ctx.note(`${activityId}×${done}`);
  else if (refused) ctx.note(`${activityId} refused: ${refused.slice(0, 40)}`);
  return done;
}

export async function rentIfPossible(ctx: SimWeekContext, tierId: string): Promise<boolean> {
  const s = ctx.state();
  if (s.rental?.tierId === tierId) return false;
  const r = await ctx.actions.rentHome(tierId);
  ctx.note(r?.success ? `rent ${tierId}` : `rent ${tierId} refused: ${r?.message ?? ''}`);
  return !!r?.success;
}
