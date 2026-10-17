/**
 * A Mindset shapes a whole life - the table, the generated copy, and the street
 * half of it.
 *
 * History, because it explains the rules below. A Mindset is a headline choice
 * (onboarding Perks, inherited by an heir). For most of its life the only code
 * that read it was one street-job toast, so five Mindsets did nothing and six
 * changed street pay while their cards promised savings, careers, stocks,
 * travel and friendships. PR #239 made every Mindset act on street work and
 * rewrote the copy to say so. This round (owner: "do the bigger design job")
 * gives each Mindset its ORIGINAL promise in the system its name names, with
 * one table (`MINDSET_EFFECTS`, lib/mindset/effects.ts) and copy GENERATED from
 * it. The per-system behaviour is proved in
 * `__tests__/mindset/mindsetLifeSeams.test.ts`; this file pins the table, the
 * copy and street work.
 */
import fs from 'fs';
import path from 'path';
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { MINDSET_TRAITS, type MindsetId } from '@/lib/mindset/config';
import {
  MINDSET_EFFECTS,
  MINDSET_MULTIPLIER_MAX,
  MINDSET_MULTIPLIER_MIN,
  activeMindsetIds,
  describeMindsetEffects,
  mindsetEffectLines,
  mindsetEffectSentence,
  mindsetEffects,
} from '@/lib/mindset/effects';
import { MINDSET_STREET_EFFECTS } from '@/lib/mindset/streetWork';
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
const STREET_MINDSETS: MindsetId[] = ['optimist', 'gambler', 'riskAverse', 'hustler'];

describe('the table', () => {
  it('covers every Mindset on the picker, once', () => {
    expect(Object.keys(MINDSET_EFFECTS).sort()).toEqual([...ALL_IDS].sort());
    expect(Object.keys(MINDSET_STREET_EFFECTS).sort()).toEqual([...ALL_IDS].sort());
  });

  it.each(ALL_IDS)('%s has at least one upside AND at least one downside', (id) => {
    const lines = mindsetEffectLines(id);
    expect(`${id}: ${lines.some((l) => l.upside)}`).toBe(`${id}: true`);
    expect(`${id}: ${lines.some((l) => !l.upside)}`).toBe(`${id}: true`);
  });

  it.each(ALL_IDS)('%s is modest - no multiplier moves a system by more than half', (id) => {
    const life = MINDSET_EFFECTS[id].life as Record<string, number | undefined>;
    for (const [key, value] of Object.entries(life)) {
      if (key === 'restlessAfterWeeks' || typeof value !== 'number') continue;
      expect(`${id}.${key}: ${value >= 0.75 && value <= 1.5}`).toBe(`${id}.${key}: true`);
    }
  });
});

describe('the copy is generated from the table', () => {
  it.each(ALL_IDS)('%s card shows the generated lines, and the tagline states no numbers', (id) => {
    const trait = MINDSET_TRAITS.find((t) => t.id === id)!;
    expect(trait.effects).toEqual(describeMindsetEffects(id));
    expect(trait.description).toBe(mindsetEffectSentence(id));
    expect(trait.effects.length).toBeGreaterThanOrEqual(2);
    expect(trait.tagline).not.toMatch(/\d/);
  });

  it('upsides come first on every card', () => {
    for (const id of ALL_IDS) {
      const flags = mindsetEffectLines(id).map((l) => l.upside);
      const firstDown = flags.indexOf(false);
      expect(`${id}: ${flags.slice(firstDown).every((f) => !f)}`).toBe(`${id}: true`);
    }
  });

  it('reads as the promise each Mindset was named for', () => {
    const lines = (id: MindsetId) => describeMindsetEffects(id).join(' | ');
    expect(lines('frugal')).toBe('Market items and food cost 10% less | Luxury items give 25% less happiness');
    expect(lines('workaholic')).toBe('Career pay +10% | Health wears down 20% faster');
    expect(lines('socialite')).toBe('Calls, hangouts and dates build 25% more bond | Hangouts, dates and gifts cost 25% more');
    expect(lines('optimist')).toBe('Happiness gains are 15% bigger | Street jobs succeed 5% less often');
    expect(lines('perfectionist')).toBe('Promotions come 15% faster | Happiness wears down 20% faster');
    expect(lines('adventurous')).toBe(
      'Trips cost 15% less | Trips give 25% more happiness | Restless: after 26 weeks without a trip, happiness wears down 25% faster',
    );
    expect(lines('gambler')).toBe('Illegal street jobs pay 25% more | +5% arrest risk on illegal jobs');
    expect(lines('riskAverse')).toBe('25% less arrest risk on illegal jobs | Street jobs pay 5% less');
    expect(lines('investor')).toBe('Stock dividends +15% | Rent from tenants +15% | Property costs 5% more to buy');
    expect(lines('spender')).toBe('Luxury items give 25% more happiness | Market items and food cost 10% more');
    expect(lines('hustler')).toBe('Street jobs pay 15% more | A contact whose wish you ignore loses 3 bond instead of 2');
  });

  it('no copy uses an em dash (owner rule for game copy)', () => {
    for (const t of MINDSET_TRAITS) {
      expect(`${t.id}: ${/—/.test([t.tagline, ...t.effects].join(' '))}`).toBe(`${t.id}: false`);
    }
  });
});

describe('street work: the risk Mindsets act here, the rest leave it alone', () => {
  function successfulRun(state: GameState, jobId: string): { next: GameState; message: string } {
    // Pity forces the success roll, so this is independent of the seed.
    const s = { ...state, streetJobFailureCount: { [jobId]: 5 } };
    const c = capture();
    const r = performStreetJob(s, c.set, jobId, deps);
    expect(r.success).toBe(true);
    expect(c.updaters).toHaveLength(1);
    return { next: c.updaters[0](s), message: String(r.message) };
  }

  it.each(ALL_IDS.filter((id) => !STREET_MINDSETS.includes(id)))('%s does not change a street job', (id) => {
    const base = withMindset(null);
    const mind = withMindset(id);
    for (const jobId of [LEGAL, ILLEGAL]) {
      const a = getStreetJobTerms(base, job(base, jobId));
      const b = getStreetJobTerms(mind, job(mind, jobId));
      expect([b.pay, b.successChance, b.caughtChance, b.happinessCost, b.healthCost]).toEqual(
        [a.pay, a.successChance, a.caughtChance, a.happinessCost, a.healthCost],
      );
    }
  });

  it('Hustler: the credited cash is 15% above the no-Mindset run, and the toast says why', () => {
    const plain = successfulRun(withMindset(null), LEGAL);
    const hustler = successfulRun(withMindset('hustler'), LEGAL);
    expect(hustler.next.stats.money - 1_000).toBe(Math.round((plain.next.stats.money - 1_000) * 1.15));
    expect(hustler.message).toMatch(/Hustler \+15%/);
  });

  it('Optimist: street jobs succeed 5 points less often', () => {
    const plain = withMindset(null);
    const optimist = withMindset('optimist');
    expect(getStreetJobTerms(optimist, job(optimist, LEGAL)).successChance)
      .toBe(getStreetJobTerms(plain, job(plain, LEGAL)).successChance - 5);
  });

  it('Gambler: illegal pay +25% and +5 points of arrest risk; legal work unchanged', () => {
    const plain = withMindset(null);
    const gambler = withMindset('gambler');
    const a = getStreetJobTerms(plain, job(plain, ILLEGAL));
    const b = getStreetJobTerms(gambler, job(gambler, ILLEGAL));
    // The payout rounds once, after every multiplier, so allow the rounding.
    expect(Math.abs(b.pay - a.pay * 1.25)).toBeLessThanOrEqual(1);
    expect(b.caughtChance).toBeCloseTo(a.caughtChance + 5, 6);
    expect(getStreetJobTerms(gambler, job(gambler, LEGAL)).pay).toBe(getStreetJobTerms(plain, job(plain, LEGAL)).pay);
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
    const s = { ...withMindset('hustler'), streetJobFailureCount: { [LEGAL]: 5 } };
    const c = capture();
    performStreetJob(s, c.set, LEGAL, deps);
    const drained = { ...s, stats: { ...s.stats, energy: 0 } };
    expect(c.updaters[0](drained)).toBe(drained);
  });

  it('is deterministic', () => {
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

describe('which Mindset is active, and the resolver', () => {
  it('reads mindset.traits, falling back to the displayed activeTraitId', () => {
    expect(activeMindsetIds(createTestGameState({ mindset: { traits: ['gambler'], activeTraitId: 'gambler' } }))).toEqual(['gambler']);
    expect(activeMindsetIds(createTestGameState({ mindset: { traits: [], activeTraitId: 'frugal' } }))).toEqual(['frugal']);
    expect(activeMindsetIds(createTestGameState())).toEqual([]);
    expect(activeMindsetIds(createTestGameState({ mindset: { traits: ['not_a_mindset'] } }))).toEqual([]);
  });

  it('no Mindset is a strict no-op everywhere', () => {
    const none = mindsetEffects(withMindset(null));
    for (const [key, value] of Object.entries(none)) {
      expect(`${key}: ${value}`).toBe(`${key}: ${key === 'restless' ? false : 1}`);
    }
    const s = withMindset(null);
    expect(getStreetJobTerms(s, job(s, LEGAL)).mindset.payNote).toBeNull();
  });

  it('even all eleven stacked stay bounded and never turn a cost into a gain', () => {
    const s = createTestGameState({ mindset: { traits: ALL_IDS, activeTraitId: ALL_IDS[0] } });
    for (const [key, value] of Object.entries(mindsetEffects(s))) {
      if (key === 'restless') continue;
      expect(value as number).toBeGreaterThanOrEqual(MINDSET_MULTIPLIER_MIN);
      expect(value as number).toBeLessThanOrEqual(MINDSET_MULTIPLIER_MAX);
    }
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

describe('no second, unguarded Mindset grant', () => {
  const code = (rel: string) =>
    fs.readFileSync(path.join(ROOT, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('work.tsx credits nothing itself after a street job', () => {
    const work = code('app/(tabs)/work.tsx');
    expect(work).not.toMatch(/getMindsetAdjustment|getMindsetFeedback|applyMindsetEffects/);
    expect(work).not.toMatch(/mindset\.moneyAdjustment/);
  });

  it('no production file calls the deleted Mindset engine', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) return;
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { walk(rel); continue; }
        if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
        if (/\b(applyMindsetEffects|getMindsetAdjustment|getMindsetFeedback)\s*\(/.test(code(rel))) offenders.push(rel);
      }
    };
    ['app', 'lib', 'contexts', 'components', 'utils', 'src', 'services', 'hooks'].forEach(walk);
    expect(offenders).toEqual([]);
  });
});
