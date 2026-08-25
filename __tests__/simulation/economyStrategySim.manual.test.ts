/**
 * ECONOMY STRATEGY SIMULATOR — long-horizon balance probe (2026-08-25 economy audit).
 *
 * Drives the REAL production `nextWeek()` (GameProvider-mounted, the
 * tickTiming.bench pattern) for several strategy archetypes over multi-year
 * horizons, and prints yearly trajectories: cash, savings, net worth, stats,
 * arrears and deaths. This is the measurement layer behind the economy audit's
 * inflation-control / dominant-strategy / snowball questions — the numbers in
 * `tasks/economy-audit-<date>.md` come from this harness.
 *
 * WHAT IT MEASURES: the PASSIVE compounding core of the economy — salary,
 * passive income, taxes, lifestyle sinks, interest, appreciation, decay,
 * death — with capital deployed in different asset classes. It deliberately
 * plays no active verbs (no hustles, events auto-dismissed by absence of UI),
 * so results are a floor for active play, not a ceiling.
 *
 * RUN:  RUN_ECONOMY_SIM=1 npx jest economyStrategySim --silent=false
 * Skipped otherwise — this is a diagnostic soak, not a CI gate. The always-on
 * invariants (no NaN money / no negative-infinite spiral) live in the cheap
 * assertions at the bottom of each run and DO fail the manual run if broken.
 *
 * READ THE NUMBERS WITH THE tickTiming CAVEAT: Node + react-test-renderer, not
 * Hermes on device — timings are pessimistic, economics are identical.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

// Below the imports on purpose — see the note in tickTiming.bench.test.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  nextWeek: () => Promise<void> | void;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const actions = useGameActions();
  captured = {
    state: gameState,
    setGameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
  };
  return null;
}

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

/** Tick one week; if the character died, revive (full stats) and count it. */
async function tick(deaths: { count: number }) {
  if (!captured) throw new Error('Probe not initialized');
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
  if (captured!.state.showDeathPopup) {
    deaths.count++;
    await act(async () => {
      captured!.setGameState((prev) => ({
        ...prev,
        showDeathPopup: false,
        diseases: [],
        stats: { ...prev.stats, health: 100, happiness: 80, energy: 80 },
      }));
      await Promise.resolve();
    });
  }
}

async function seed(mutate: (prev: GameState) => GameState) {
  await act(async () => {
    captured!.setGameState(mutate);
    await Promise.resolve();
  });
}

/** Accept a catalog career at a given level (salaries in careerData are weekly).
 *  `currentJob` is what the paycheck path reads (applyCareerSalaryAndPenalty). */
function withCareer(prev: GameState, careerId: string, level: number): GameState {
  return {
    ...prev,
    currentJob: careerId,
    careers: prev.careers.map((c) =>
      c.id === careerId
        ? { ...c, accepted: true, applied: true, level, currentLevel: level, performance: 75 }
        : c
    ),
  };
}

interface YearRow {
  year: number;
  cash: number;
  savings: number;
  netWorth: number;
  health: number;
  happiness: number;
  energy: number;
  overdue: number;
  deaths: number;
}

interface RunResult {
  name: string;
  deployedCapital: number;
  rows: YearRow[];
  finalState: GameState;
}

async function runArchetype(
  name: string,
  years: number,
  deployedCapital: number,
  setup: (prev: GameState) => GameState
): Promise<RunResult> {
  const mounted = mountGame();
  const deaths = { count: 0 };
  await seed(setup);

  const rows: YearRow[] = [];
  const snap = (year: number) => {
    const s = captured!.state;
    rows.push({
      year,
      cash: Math.round(s.stats.money),
      savings: Math.round(s.bankSavings ?? 0),
      netWorth: Math.round(netWorth(s)),
      health: Math.round(s.stats.health),
      happiness: Math.round(s.stats.happiness),
      energy: Math.round(s.stats.energy),
      overdue: Math.round(s.overdueBalance ?? 0),
      deaths: deaths.count,
    });
  };

  snap(0);
  for (let y = 1; y <= years; y++) {
    for (let w = 0; w < 52; w++) await tick(deaths);
    snap(y);
  }

  const finalState = captured!.state;

  // Always-on invariants — a manual soak that finds NaN/∞ must scream.
  for (const row of rows) {
    expect(Number.isFinite(row.cash)).toBe(true);
    expect(Number.isFinite(row.savings)).toBe(true);
    expect(Number.isFinite(row.netWorth)).toBe(true);
  }

  act(() => mounted.root.unmount());
  captured = null;
  return { name, deployedCapital, rows, finalState };
}

function printResults(results: RunResult[], years: number) {
  const fmt = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${(n / 1000).toFixed(1)}k`;
  process.stdout.write(`\n\n===== ECONOMY STRATEGY SIM (${years} years, passive core) =====\n`);
  for (const r of results) {
    process.stdout.write(`\n--- ${r.name} (deployed $${fmt(r.deployedCapital)}) ---\n`);
    process.stdout.write(
      'year |     cash |  savings | networth | hp/ha/en | overdue | deaths\n'
    );
    for (const row of r.rows) {
      process.stdout.write(
        `${String(row.year).padStart(4)} | ${fmt(row.cash).padStart(8)} | ${fmt(row.savings).padStart(8)} | ${fmt(row.netWorth).padStart(8)} | ${String(row.health).padStart(2)}/${String(row.happiness).padStart(2)}/${String(row.energy).padStart(2)} | ${fmt(row.overdue).padStart(7)} | ${row.deaths}\n`
      );
    }
    const first = r.rows[0];
    const last = r.rows[r.rows.length - 1];
    const gain = last.netWorth - first.netWorth;
    process.stdout.write(
      `net-worth gain: $${fmt(gain)} over ${years}y (${((gain / Math.max(1, years)) / 52).toFixed(0)} $/wk avg)\n`
    );
  }
  process.stdout.write('=============================================================\n\n');
}

const describeSim = process.env.RUN_ECONOMY_SIM ? describe : describe.skip;

describeSim('Economy strategy simulation (manual soak)', () => {
  jest.setTimeout(3_600_000);

  it('compares passive strategy archetypes over a 10-year horizon', async () => {
    const YEARS = 10;
    const CAPITAL = 500_000; // same deployable capital for every funded archetype

    const results: RunResult[] = [];

    // 1. Idle baseline — no job, no assets: pure sink pressure + decay.
    results.push(await runArchetype('idle (no job, no assets)', YEARS, 0, (p) => p));

    // 2. Entry worker — junior developer, $1,100/wk, nothing else.
    results.push(
      await runArchetype('worker (software L0, $1.1k/wk)', YEARS, 0, (p) =>
        withCareer(p, 'software', 0)
      )
    );

    // 3. Top worker — engineering manager, $3,000/wk.
    results.push(
      await runArchetype('top worker (software L5, $3k/wk)', YEARS, 0, (p) =>
        withCareer(p, 'software', 5)
      )
    );

    // 4. Saver — worker + $500k parked in savings (soft cap sits exactly here).
    results.push(
      await runArchetype('saver (worker + $500k savings)', YEARS, CAPITAL, (p) => ({
        ...withCareer(p, 'software', 0),
        bankSavings: CAPITAL,
      }))
    );

    // 5. Investor — worker + $500k in blue-chip dividend stocks at catalog prices.
    results.push(
      await runArchetype('investor (worker + $500k stocks)', YEARS, CAPITAL, (p) => ({
        ...withCareer(p, 'software', 0),
        stocks: {
          ...(p.stocks ?? { holdings: [], watchlist: [] }),
          holdings: [
            { symbol: 'JPM', shares: 1200, averagePrice: 142.85, currentPrice: 142.85 }, // ~$171k
            { symbol: 'JNJ', shares: 1000, averagePrice: 158.9, currentPrice: 158.9 }, // ~$159k
            { symbol: 'IBM', shares: 1200, averagePrice: 142.3, currentPrice: 142.3 }, // ~$171k
          ],
          watchlist: [],
        },
      }))
    );

    // 6. Landlord — worker + duplex ($320k) + city apartment ($180k), both let
    //    long-term at the RENT_INCOME_RATE market rent (0.0015/wk of value).
    results.push(
      await runArchetype('landlord (worker + $500k property)', YEARS, CAPITAL, (p) => ({
        ...withCareer(p, 'software', 0),
        realEstate: [
          {
            id: 'duplex',
            name: 'Duplex',
            price: 320_000,
            weeklyHappiness: 6,
            weeklyEnergy: 3,
            owned: true,
            interior: [],
            upgradeLevel: 0,
            status: 'rented' as const,
            rentMode: 'longTerm' as const,
            purchasePrice: 320_000,
            purchasedWeek: p.weeksLived,
            currentValue: 320_000,
            condition: 90,
            rent: 480,
            upkeep: 60,
            tenant: {
              id: 'sim-tenant-1',
              name: 'Sim Tenant',
              satisfaction: 80,
              movedInWeek: p.weeksLived,
              weeklyRent: 480,
            },
          },
          {
            id: 'city-apt',
            name: 'City Apartment',
            price: 180_000,
            weeklyHappiness: 5,
            weeklyEnergy: 2,
            owned: true,
            interior: [],
            upgradeLevel: 0,
            status: 'rented' as const,
            rentMode: 'longTerm' as const,
            purchasePrice: 180_000,
            purchasedWeek: p.weeksLived,
            currentValue: 180_000,
            condition: 90,
            rent: 270,
            upkeep: 40,
            tenant: {
              id: 'sim-tenant-2',
              name: 'Sim Tenant 2',
              satisfaction: 80,
              movedInWeek: p.weeksLived,
              weeklyRent: 270,
            },
          },
        ],
      }))
    );

    // 7. Business owner — worker + two companies bought at catalog-ish scale
    //    (~$500k total entry): weeklyIncome as createCompany would set it.
    results.push(
      await runArchetype('tycoon (worker + 2 companies)', YEARS, CAPITAL, (p) => ({
        ...withCareer(p, 'software', 0),
        companies: [
          {
            id: 'sim-restaurant',
            name: 'Sim Restaurant',
            type: 'restaurant' as const,
            weeklyIncome: 1500,
            baseWeeklyIncome: 1500,
            upgrades: [],
            employees: 2,
            workerSalary: 200,
            workerMultiplier: 1,
            marketingLevel: 0,
            miners: {},
            warehouseLevel: 0,
          },
          {
            id: 'sim-factory',
            name: 'Sim Factory',
            type: 'factory' as const,
            weeklyIncome: 2000,
            baseWeeklyIncome: 2000,
            upgrades: [],
            employees: 3,
            workerSalary: 250,
            workerMultiplier: 1,
            marketingLevel: 0,
            miners: {},
            warehouseLevel: 0,
          },
        ],
      }))
    );

    printResults(results, YEARS);

    // Soft cross-checks (diagnostic, generous bounds — the printout is the
    // deliverable; these only catch a broken sim or a runaway economy):
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    const last = (r: RunResult) => r.rows[r.rows.length - 1];

    // Working must beat idling.
    expect(last(byName['worker (software L0, $1.1k/wk)']).netWorth).toBeGreaterThan(
      last(byName['idle (no job, no assets)']).netWorth
    );
    // No archetype's net worth may go non-finite or catastrophically negative.
    for (const r of results) {
      expect(last(r).netWorth).toBeGreaterThan(-1_000_000);
    }
  });
});
