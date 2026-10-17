/**
 * Every Mindset does what its card says - 2026-10-17 owner call.
 *
 * A Mindset is a headline choice: picked on the onboarding Perks screen and
 * inherited at heir selection. Its only consumer was one toast in the street-job
 * handler, which passed `(job.basePayment, 0, 0)` - a positive payout and
 * nothing else - so the five Mindsets whose rules only fire on a cost or live
 * "elsewhere" (socialite, optimist, adventurous, investor, spender) changed
 * nothing at all, and the other six changed street-job pay while their copy
 * promised savings, career income, stock returns, travel and shopping.
 *
 * The fix makes the street-job payout the place every Mindset acts, applied
 * inside `performStreetJob`'s ONE updater via `getStreetJobTerms`, and rewrites
 * every description to state exactly that effect. (R4-X1, the earlier round,
 * made the old toast credit what it narrated; this round removes the second
 * write altogether - see the last describe block for why.)
 */
import fs from 'fs';
import path from 'path';
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { MINDSET_TRAITS, type MindsetId } from '@/lib/mindset/config';
import {
  MINDSET_STREET_EFFECTS,
  activeMindsetIds,
  mindsetStreetTerms,
} from '@/lib/mindset/streetWork';
import { getStreetJobTerms, performStreetJob } from '@/contexts/game/actions/JobActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import type { GameState, StreetJob } from '@/contexts/game/types';

const ROOT = path.resolve(__dirname, '..', '..');

const deps = {
  updateMoney,
  updateStats,
  gainCriminalXp: jest.fn(),
  gainCrimeSkillXp: jest.fn(),
};

function capture(): { set: Dispatch<SetStateAction<GameState>>; updaters: ((s: GameState) => GameState)[] } {
  const updaters: ((s: GameState) => GameState)[] = [];
  const set: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updaters.push(u);
  };
  return { set, updaters };
}

function withMindset(id: MindsetId | null, over: Parameters<typeof createTestGameState>[0] = {}): GameState {
  return createTestGameState({
    weeksLived: 200,
    stats: { money: 1_000, energy: 100, health: 80, happiness: 80 },
    weeklyStreetJobs: {},
    wantedLevel: 0,
    jailWeeks: 0,
    ...(id ? { mindset: { activeTraitId: id, traits: [id] } } : {}),
    ...over,
  });
}

function job(state: GameState, id: string): StreetJob {
  const found = state.streetJobs.find((j) => j.id === id);
  if (!found) throw new Error(`no street job ${id}`);
  return found;
}

const LEGAL = 'wash_cars'; // legal, 90% success, -5 happiness / -2 health
const ILLEGAL = 'steal_from_cars'; // illegal, no gear, -7 happiness / -3 health

const ALL_IDS = MINDSET_TRAITS.map((t) => t.id);

describe('every Mindset has a real effect', () => {
  it('the table covers every Mindset on the picker', () => {
    expect(Object.keys(MINDSET_STREET_EFFECTS).sort()).toEqual([...ALL_IDS].sort());
  });

  it.each(ALL_IDS)('%s changes a legal or an illegal street job', (id) => {
    const changed = [false, true].some((illegal) => {
      const t = mindsetStreetTerms([id], illegal);
      return (
        t.payMultiplier !== 1 ||
        t.successBonus !== 0 ||
        t.arrestBonus !== 0 ||
        t.arrestMultiplier !== 1 ||
        t.halveHappinessCost ||
        t.happinessDelta !== 0 ||
        t.healthDelta !== 0 ||
        t.runsPerRank !== 3
      );
    });
    expect(changed).toBe(true);
  });

  it.each(ALL_IDS)('%s changes what the street job actually pays, risks or costs', (id) => {
    // Through the SAME helper the payout charges from - not the table.
    const base = withMindset(null);
    const mind = withMindset(id);
    const differs = [LEGAL, ILLEGAL].some((jobId) => {
      const a = getStreetJobTerms(base, job(base, jobId));
      const b = getStreetJobTerms(mind, job(mind, jobId));
      return (
        a.pay !== b.pay ||
        a.successChance !== b.successChance ||
        a.caughtChance !== b.caughtChance ||
        a.happinessCost !== b.happinessCost ||
        a.healthCost !== b.healthCost ||
        a.runsPerRank !== b.runsPerRank
      );
    });
    expect(`${id}: ${differs}`).toBe(`${id}: true`);
  });
});

describe('the copy states exactly the numbers the game applies', () => {
  const pct = (m: number) => `${Math.round(Math.abs(m - 1) * 100)}%`;

  it.each(ALL_IDS)('%s description quotes every number in its row', (id) => {
    const copy = MINDSET_TRAITS.find((t) => t.id === id)!.description;
    const e = MINDSET_STREET_EFFECTS[id];
    const expected: string[] = [];
    if (e.pay) expected.push(pct(e.pay));
    if (e.legalPay) expected.push(pct(e.legalPay));
    if (e.illegalPay) expected.push(pct(e.illegalPay));
    if (e.success) expected.push(`${Math.abs(e.success)}%`);
    if (e.arrestPoints) expected.push(`+${e.arrestPoints}% arrest risk`);
    if (e.arrestMultiplier) expected.push(`${pct(e.arrestMultiplier)} less arrest risk`);
    if (e.halveHappinessCost) expected.push('half the happiness');
    if (e.happiness) expected.push(`${Math.abs(e.happiness)} ${e.happiness < 0 ? 'extra' : 'less'} happiness`);
    if (e.legalHappiness) expected.push(`${Math.abs(e.legalHappiness)} extra happiness`);
    if (e.health) expected.push(`${Math.abs(e.health)} extra health`);
    if (e.runsPerRank) expected.push(`${e.runsPerRank} successful runs instead of 3`);
    expect(expected.length).toBeGreaterThan(0);
    for (const fragment of expected) {
      expect(`${id}: ${copy}`).toContain(fragment);
    }
    // Every Mindset acts on street jobs and nowhere else - the copy says so.
    expect(copy).toMatch(/street jobs/i);
  });

  it('no description still promises a system that never reads the Mindset', () => {
    const banned = /stocks|real estate|travel|relationships grow|shopping|recovers faster|reputation/i;
    for (const t of MINDSET_TRAITS) expect(`${t.id}: ${banned.test(t.description)}`).toBe(`${t.id}: false`);
  });
});

describe('performStreetJob applies the Mindset inside its own updater', () => {
  function successfulRun(state: GameState, jobId: string): { next: GameState; message: string } {
    // Pity forces the success roll, so this is independent of the seed.
    const s = { ...state, streetJobFailureCount: { [jobId]: 5 } };
    const c = capture();
    const r = performStreetJob(s, c.set, jobId, deps);
    expect(r.success).toBe(true);
    expect(c.updaters).toHaveLength(1);
    return { next: c.updaters[0](s), message: String(r.message) };
  }

  it('Frugal: the credited cash is 10% above the no-Mindset run, and the toast says why', () => {
    const plain = successfulRun(withMindset(null), LEGAL);
    const frugal = successfulRun(withMindset('frugal'), LEGAL);
    const plainPay = plain.next.stats.money - 1_000;
    const frugalPay = frugal.next.stats.money - 1_000;
    expect(frugalPay).toBe(Math.round(plainPay * 1.1));
    expect(frugal.message).toMatch(/Frugal \+10%/);
  });

  it('Optimist: the happiness actually charged is halved (-5 -> -2)', () => {
    const plain = successfulRun(withMindset(null), LEGAL);
    const optimist = successfulRun(withMindset('optimist'), LEGAL);
    expect(plain.next.stats.happiness).toBe(80 - 5);
    expect(optimist.next.stats.happiness).toBe(80 - 2);
  });

  it('Spender: a street job costs 2 less happiness and pays 10% less', () => {
    const plain = successfulRun(withMindset(null), LEGAL);
    const spender = successfulRun(withMindset('spender'), LEGAL);
    expect(spender.next.stats.happiness).toBe(80 - 3);
    expect(spender.next.stats.money - 1_000).toBe(Math.round((plain.next.stats.money - 1_000) * 0.9));
  });

  it('Workaholic: +20% pay, one extra health and one extra happiness per job', () => {
    const plain = successfulRun(withMindset(null), LEGAL);
    const work = successfulRun(withMindset('workaholic'), LEGAL);
    expect(work.next.stats.money - 1_000).toBe(Math.round((plain.next.stats.money - 1_000) * 1.2));
    expect(work.next.stats.health).toBe(plain.next.stats.health - 1);
    expect(work.next.stats.happiness).toBe(plain.next.stats.happiness - 1);
  });

  it('Investor: a job ranks up after 2 successful runs, not 3', () => {
    const base = withMindset('investor');
    const primed = {
      ...base,
      streetJobs: base.streetJobs.map((j) => (j.id === LEGAL ? { ...j, progress: 1 } : j)),
    };
    const { next } = successfulRun(primed, LEGAL);
    expect(job(next, LEGAL).rank).toBe(2);

    const plainBase = withMindset(null);
    const plainPrimed = {
      ...plainBase,
      streetJobs: plainBase.streetJobs.map((j) => (j.id === LEGAL ? { ...j, progress: 1 } : j)),
    };
    expect(job(successfulRun(plainPrimed, LEGAL).next, LEGAL).rank).toBe(1);
  });

  it('Risk Averse: illegal arrest risk is a quarter lower, at every wanted level', () => {
    for (const wantedLevel of [0, 5, 40]) {
      const plain = withMindset(null, { wantedLevel });
      const averse = withMindset('riskAverse', { wantedLevel });
      const a = getStreetJobTerms(plain, job(plain, ILLEGAL)).caughtChance;
      const b = getStreetJobTerms(averse, job(averse, ILLEGAL)).caughtChance;
      expect(b).toBeCloseTo(a * 0.75, 6);
    }
  });

  it('a tap the updater refuses collects no Mindset bonus', () => {
    // The old screen-side adjustment ran after ANY `result.success`, including
    // a same-batch double tap the action's own energy re-check had refused.
    const s = { ...withMindset('hustler'), streetJobFailureCount: { [LEGAL]: 5 } };
    const c = capture();
    performStreetJob(s, c.set, LEGAL, deps);
    const drained = { ...s, stats: { ...s.stats, energy: 0 } };
    expect(c.updaters[0](drained)).toBe(drained);
  });

  it('is deterministic - Gambler no longer rolls Math.random()', () => {
    const run = () => {
      const s = withMindset('gambler');
      const c = capture();
      const r = performStreetJob(s, c.set, ILLEGAL, deps);
      return { r, next: c.updaters[0]?.(s) };
    };
    const first = run();
    const second = run();
    expect(second.r).toEqual(first.r);
    expect(second.next?.stats).toEqual(first.next?.stats);
  });
});

describe('which Mindset is active', () => {
  it('reads mindset.traits, falling back to the displayed activeTraitId', () => {
    expect(activeMindsetIds(createTestGameState({ mindset: { traits: ['gambler'], activeTraitId: 'gambler' } }))).toEqual(['gambler']);
    // A save whose list was emptied still applies the Mindset the Home card shows.
    expect(activeMindsetIds(createTestGameState({ mindset: { traits: [], activeTraitId: 'frugal' } }))).toEqual(['frugal']);
    expect(activeMindsetIds(createTestGameState())).toEqual([]);
    expect(activeMindsetIds(createTestGameState({ mindset: { traits: ['not_a_mindset'] } }))).toEqual([]);
  });

  it('no Mindset is a strict no-op', () => {
    const s = withMindset(null);
    const t = getStreetJobTerms(s, job(s, LEGAL));
    expect(t.mindset.payNote).toBeNull();
    expect(t.mindset.payMultiplier).toBe(1);
  });

  it('even all eleven stacked stay bounded and never turn a cost into a gain', () => {
    const s = createTestGameState({ mindset: { traits: ALL_IDS, activeTraitId: ALL_IDS[0] } });
    for (const jobId of [LEGAL, ILLEGAL]) {
      const t = getStreetJobTerms(s, job(s, jobId));
      expect(Number.isFinite(t.pay)).toBe(true);
      expect(t.happinessCost).toBeLessThanOrEqual(0);
      expect(t.healthCost).toBeLessThanOrEqual(0);
      expect(t.successChance).toBeGreaterThanOrEqual(0);
      expect(t.successChance).toBeLessThanOrEqual(95);
      expect(t.caughtChance).toBeLessThanOrEqual(80);
    }
  });
});

describe('the screen no longer writes a second, unguarded Mindset grant', () => {
  const code = (rel: string) =>
    fs.readFileSync(path.join(ROOT, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('work.tsx credits nothing itself after a street job', () => {
    const work = code('app/(tabs)/work.tsx');
    expect(work).not.toMatch(/getMindsetAdjustment|getMindsetFeedback|applyMindsetEffects/);
    expect(work).not.toMatch(/mindset\.moneyAdjustment/);
  });

  it('no production file calls the deprecated Mindset engine', () => {
    // The OLD engine (`applyMindsetEffects`, and `utils/mindsetFeedback.ts`
    // over it) is deleted; this keeps a revival from reaching production.
    const offenders: string[] = [];
    const allowed = new Set<string>();
    const walk = (dir: string) => {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) return;
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { walk(rel); continue; }
        if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name) || allowed.has(rel)) continue;
        if (/\b(applyMindsetEffects|getMindsetAdjustment|getMindsetFeedback)\s*\(/.test(code(rel))) offenders.push(rel);
      }
    };
    ['app', 'lib', 'contexts', 'components', 'utils', 'src', 'services', 'hooks'].forEach(walk);
    expect(offenders).toEqual([]);
  });
});
