/**
 * Late-game / wealth-tier event pack — wiring, gating, `moneyPct` bounds, and
 * exploit safety.
 *
 * The pack in `lib/events/wealthEvents.ts` is the FIRST content in the repo to
 * declare `EventChoiceEffects.moneyPct`, so these tests cover two things that
 * have both burned this repo before:
 *
 *  1. **Reachability.** An unreachable template is this directory's recurring
 *     failure mode (secretEvents' achievement gate, the enhancedEvents payoff
 *     ids). It is not enough that the array exists — the templates must be
 *     registered in `eventTemplates` AND actually come out of
 *     `rollWeeklyEvents` for a player who qualifies.
 *  2. **Sign and bound handling.** `resolveEventMoney` takes its sign from
 *     `money` when that is non-zero and only falls back to `moneyPct`, so
 *     `{ money: -5_000, moneyPct: 0.01 }` is a LOSS despite the positive
 *     percentage. Every choice is checked for sign agreement, for staying
 *     within `MAX_EVENT_NET_WORTH_FRACTION`, and for never producing NaN or a
 *     negative money balance at any net worth from $0 to $10B.
 */
import type { GameState, Company, RealEstate, ChildInfo, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { eventTemplates, rollWeeklyEvents, type EventChoice, type EventTemplate } from '@/lib/events/engine';
import {
  wealthEventTemplates,
  AFFLUENT_NET_WORTH,
  WEALTHY_NET_WORTH,
  TYCOON_NET_WORTH,
  DYNASTY_NET_WORTH,
  MIN_WEEKS_LIVED,
} from '@/lib/events/wealthEvents';
import { resolveEventMoney, MAX_EVENT_NET_WORTH_FRACTION, MAX_EVENT_MONEY } from '@/lib/events/moneyScaling';
import { netWorth } from '@/lib/progress/achievements';

const VALID_CATEGORIES = new Set(['economy', 'health', 'relationship', 'general']);

// ── Fixtures ───────────────────────────────────────────────────────────────

/**
 * Extras that satisfy every SECONDARY condition in the pack (a company, a
 * child, a partner, an owned property, a luxury item), so a gating test is
 * measuring the NET WORTH tier and nothing else.
 *
 * Each carries zero balance-sheet value of its own where possible; whatever
 * value they do add is subtracted back out by `stateAt` below, which measures
 * the fixture's own net worth before topping it up.
 */
function extras(): Partial<GameState> {
  const company: Company = {
    id: 'co-1',
    name: 'Holdings Ltd',
    type: 'factory',
    weeklyIncome: 0,
    baseWeeklyIncome: 0,
    upgrades: [],
    employees: 0,
    workerSalary: 0,
    workerMultiplier: 1,
    marketingLevel: 0,
    miners: {},
    warehouseLevel: 0,
  };
  const property: RealEstate = {
    id: 're-1',
    name: 'The Estate',
    price: 0,
    currentValue: 0,
    weeklyHappiness: 0,
    weeklyEnergy: 0,
    owned: true,
    interior: [],
    upgradeLevel: 0,
  };
  const partner: Relationship = {
    id: 'rel-partner',
    name: 'Sam',
    type: 'partner',
    relationshipScore: 70,
    personality: 'warm',
    gender: 'female',
    age: 40,
  };
  const child: ChildInfo = {
    id: 'kid-1',
    name: 'Alex',
    type: 'child',
    relationshipScore: 70,
    personality: 'curious',
    gender: 'male',
    age: 20,
  };
  return {
    companies: [company],
    realEstate: [property],
    relationships: [partner],
    family: { children: [child] },
    luxuryItems: ['rare_watch_collection'],
  };
}

/**
 * A state whose canonical `netWorth()` is exactly `worth`.
 *
 * Built in two passes: measure what the fixture is worth with an empty bank,
 * then top the bank up by the difference. Hard-coding a bank balance would
 * drift the moment the luxury catalogue reprices.
 */
function stateAt(worth: number, weeksLived = 200): GameState {
  const base = createTestGameState({
    ...extras(),
    weeksLived,
    lastEventWeeksLived: Math.max(0, weeksLived - 30),
    bankSavings: 0,
    stats: { money: 0 },
  });
  const floor = netWorth(base);
  return createTestGameState({
    ...extras(),
    weeksLived,
    lastEventWeeksLived: Math.max(0, weeksLived - 30),
    bankSavings: Math.max(0, worth - floor),
    stats: { money: 0 },
  });
}

/** A brand-new, broke player. */
function earlyState(): GameState {
  return createTestGameState({
    weeksLived: 6,
    stats: { money: 120 },
    bankSavings: 0,
  });
}

/** Every choice in the pack, generated against a very wealthy state. */
function allChoices(state: GameState): { template: EventTemplate; choice: EventChoice }[] {
  const out: { template: EventTemplate; choice: EventChoice }[] = [];
  for (const template of wealthEventTemplates) {
    for (const choice of template.generate(state).choices) {
      out.push({ template, choice });
    }
  }
  return out;
}

// ── Wiring / reachability ──────────────────────────────────────────────────

describe('wealth events — wiring', () => {
  it('ships a substantial pack (35-45 templates)', () => {
    expect(wealthEventTemplates.length).toBeGreaterThanOrEqual(35);
    expect(wealthEventTemplates.length).toBeLessThanOrEqual(45);
  });

  it('every wealth template is registered exactly once in the master pool', () => {
    const counts = new Map<string, number>();
    for (const e of eventTemplates) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
    for (const t of wealthEventTemplates) {
      expect(counts.get(t.id)).toBe(1);
    }
  });

  it('all ids are unique, prefixed, and collide with nothing pre-existing', () => {
    const ids = wealthEventTemplates.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('wealth_')).toBe(true);
  });

  it('the generated event id always matches the template id (the resolver looks it up by id)', () => {
    const rich = stateAt(TYCOON_NET_WORTH * 2);
    for (const t of wealthEventTemplates) {
      expect(t.generate(rich).id).toBe(t.id);
    }
  });
});

describe('wealth events — shape', () => {
  const rich = stateAt(DYNASTY_NET_WORTH * 2);

  it('each template has a valid category and a positive weight', () => {
    for (const t of wealthEventTemplates) {
      expect(VALID_CATEGORIES.has(t.category)).toBe(true);
      const w = typeof t.weight === 'function' ? t.weight(rich) : t.weight;
      expect(typeof w).toBe('number');
      expect(w).toBeGreaterThan(0);
      // Deliberately above a typical template (see the weight note in
      // wealthEvents.ts) but capped so the pack can never monopolize the week.
      expect(w).toBeLessThanOrEqual(2);
    }
  });

  it('each event offers 2-4 distinct, well-formed choices', () => {
    for (const t of wealthEventTemplates) {
      const ev = t.generate(rich);
      expect(ev.choices.length).toBeGreaterThanOrEqual(2);
      expect(ev.choices.length).toBeLessThanOrEqual(4);
      const ids = ev.choices.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of ev.choices) {
        expect(typeof c.id).toBe('string');
        expect(c.text.length).toBeGreaterThan(0);
        expect(typeof c.effects).toBe('object');
      }
    }
  });

  it('no choice is a pure no-op — declining always costs or gains something', () => {
    // The brief for this pack: not "accept / decline" where declining does
    // nothing. Every choice must move money, a stat, a relationship or karma.
    for (const { template, choice } of allChoices(rich)) {
      const e = choice.effects;
      const moves =
        (e.money ?? 0) !== 0 ||
        (e.moneyPct ?? 0) !== 0 ||
        Object.keys(e.stats ?? {}).length > 0 ||
        (e.relationship ?? 0) !== 0 ||
        e.karma !== undefined;
      expect(`${template.id}/${choice.id}:${moves}`).toBe(`${template.id}/${choice.id}:true`);
    }
  });

  it('stat deltas stay in-band (|delta| <= 25)', () => {
    for (const { template, choice } of allChoices(rich)) {
      for (const [k, v] of Object.entries(choice.effects.stats ?? {})) {
        expect(`${template.id}/${choice.id}/${k}:${Math.abs(v as number) <= 25}`)
          .toBe(`${template.id}/${choice.id}/${k}:true`);
      }
    }
  });
});

// ── moneyPct authoring rules ───────────────────────────────────────────────

describe('wealth events — moneyPct declarations', () => {
  const rich = stateAt(DYNASTY_NET_WORTH * 2);

  it('the pack actually adopts moneyPct (the mechanism is no longer a no-op)', () => {
    const scaled = allChoices(rich).filter(({ choice }) => (choice.effects.moneyPct ?? 0) !== 0);
    expect(scaled.length).toBeGreaterThanOrEqual(40);
    // And at least a quarter of them are LOSSES — a rich player must be able to
    // lose meaningfully, not only win.
    const losses = scaled.filter(({ choice }) => (choice.effects.moneyPct ?? 0) < 0);
    expect(losses.length / scaled.length).toBeGreaterThanOrEqual(0.25);
  });

  it('never declares more than MAX_EVENT_NET_WORTH_FRACTION', () => {
    for (const { template, choice } of allChoices(rich)) {
      const pct = choice.effects.moneyPct ?? 0;
      expect(`${template.id}/${choice.id}:${Math.abs(pct) <= MAX_EVENT_NET_WORTH_FRACTION}`)
        .toBe(`${template.id}/${choice.id}:true`);
    }
  });

  it('money and moneyPct always agree in sign (the resolver takes its sign from money)', () => {
    for (const { template, choice } of allChoices(rich)) {
      const { money = 0, moneyPct = 0 } = choice.effects;
      if (moneyPct === 0) continue;
      expect(`${template.id}/${choice.id}:${Math.sign(money) === Math.sign(moneyPct)}`)
        .toBe(`${template.id}/${choice.id}:true`);
    }
  });

  it('every scaled choice carries a non-zero flat FLOOR so the number still reads at the gate', () => {
    for (const { template, choice } of allChoices(rich)) {
      if ((choice.effects.moneyPct ?? 0) === 0) continue;
      expect(`${template.id}/${choice.id}:${(choice.effects.money ?? 0) !== 0}`)
        .toBe(`${template.id}/${choice.id}:true`);
    }
  });

  it('the printed figure equals the applied figure', () => {
    // The choice text is built from resolveEventMoney against the same net
    // worth, so a template that over-declared its percentage (printing one
    // number and applying a clamped one) would fail here.
    const worth = netWorth(rich);
    for (const { choice } of allChoices(rich)) {
      const resolved = resolveEventMoney(choice.effects, worth);
      if (Math.abs(resolved) < 1_000_000) continue; // only the $Xm labels are exact
      const millions = Math.round(Math.abs(resolved) / 1_000_000);
      if (Math.abs(resolved) >= 10_000_000 && /\$(\d+)M/.test(choice.text)) {
        expect(choice.text).toContain(`$${millions}M`);
      }
    }
  });
});

// ── Gating ─────────────────────────────────────────────────────────────────

describe('wealth events — gating', () => {
  it('an early-game player sees NONE of them', () => {
    const early = earlyState();
    for (const t of wealthEventTemplates) {
      expect(`${t.id}:${t.condition?.(early)}`).toBe(`${t.id}:false`);
    }
  });

  it('money alone is not enough — the weeksLived floor also holds', () => {
    const richButNew = stateAt(DYNASTY_NET_WORTH * 4, MIN_WEEKS_LIVED - 1);
    for (const t of wealthEventTemplates) {
      expect(`${t.id}:${t.condition?.(richButNew)}`).toBe(`${t.id}:false`);
    }
    // One week later the same balance sheet opens the whole pack.
    const richAndSettled = stateAt(DYNASTY_NET_WORTH * 4, MIN_WEEKS_LIVED);
    const open = wealthEventTemplates.filter(t => t.condition?.(richAndSettled));
    expect(open.length).toBe(wealthEventTemplates.length);
  });

  it('nothing fires just below the lowest tier', () => {
    const nearlyAffluent = stateAt(AFFLUENT_NET_WORTH - 1);
    for (const t of wealthEventTemplates) {
      expect(`${t.id}:${t.condition?.(nearlyAffluent)}`).toBe(`${t.id}:false`);
    }
  });

  it('the four tiers open strictly monotonically', () => {
    const openAt = (worth: number) =>
      wealthEventTemplates.filter(t => !t.condition || t.condition(stateAt(worth))).length;

    const affluent = openAt(AFFLUENT_NET_WORTH);
    const wealthy = openAt(WEALTHY_NET_WORTH);
    const tycoon = openAt(TYCOON_NET_WORTH);
    const dynasty = openAt(DYNASTY_NET_WORTH);

    expect(affluent).toBeGreaterThan(0);
    expect(wealthy).toBeGreaterThan(affluent);
    expect(tycoon).toBeGreaterThan(wealthy);
    expect(dynasty).toBeGreaterThan(tycoon);
    expect(dynasty).toBe(wealthEventTemplates.length);
  });

  it('secondary conditions really gate (no company / child / partner / property / luxury)', () => {
    const bare = createTestGameState({
      weeksLived: 200,
      bankSavings: DYNASTY_NET_WORTH * 4,
      stats: { money: 0 },
      companies: [],
      realEstate: [],
      relationships: [],
      family: { children: [] },
      luxuryItems: [],
    });
    const openBare = wealthEventTemplates.filter(t => t.condition?.(bare)).length;
    expect(openBare).toBeGreaterThan(0);
    // Strictly fewer than with every prerequisite satisfied.
    expect(openBare).toBeLessThan(wealthEventTemplates.length);
  });
});

// ── Resolution bounds / exploit safety ─────────────────────────────────────

describe('wealth events — resolution at several net-worth levels', () => {
  const LEVELS = [0, 1, 1_000, AFFLUENT_NET_WORTH, WEALTHY_NET_WORTH, TYCOON_NET_WORTH, DYNASTY_NET_WORTH, 10_000_000_000];

  it('resolves finite, bounded money at every level', () => {
    const rich = stateAt(DYNASTY_NET_WORTH * 2);
    for (const { template, choice } of allChoices(rich)) {
      for (const worth of LEVELS) {
        const resolved = resolveEventMoney(choice.effects, worth);
        const label = `${template.id}/${choice.id}@${worth}`;
        expect(`${label}:${Number.isFinite(resolved)}`).toBe(`${label}:true`);
        expect(`${label}:${Number.isNaN(resolved)}`).toBe(`${label}:false`);
        // Never more than the documented fraction of net worth, and never more
        // than the absolute ceiling.
        const bound = Math.max(Math.abs(choice.effects.money ?? 0), worth * MAX_EVENT_NET_WORTH_FRACTION);
        expect(`${label}:${Math.abs(resolved) <= bound + 1}`).toBe(`${label}:true`);
        expect(`${label}:${Math.abs(resolved) <= MAX_EVENT_MONEY}`).toBe(`${label}:true`);
      }
    }
  });

  it('the flat figure is a floor: a scaled choice is never worth less than it', () => {
    const rich = stateAt(DYNASTY_NET_WORTH * 2);
    for (const { template, choice } of allChoices(rich)) {
      const flat = Math.abs(choice.effects.money ?? 0);
      if (flat === 0) continue;
      for (const worth of LEVELS) {
        const resolved = Math.abs(resolveEventMoney(choice.effects, worth));
        expect(`${template.id}/${choice.id}@${worth}:${resolved >= flat}`)
          .toBe(`${template.id}/${choice.id}@${worth}:true`);
      }
    }
  });

  it('a wealthy player feels it: every scaled choice grows with net worth', () => {
    const rich = stateAt(TYCOON_NET_WORTH);
    for (const { template, choice } of allChoices(rich)) {
      if ((choice.effects.moneyPct ?? 0) === 0) continue;
      const atGate = Math.abs(resolveEventMoney(choice.effects, AFFLUENT_NET_WORTH));
      const atTycoon = Math.abs(resolveEventMoney(choice.effects, TYCOON_NET_WORTH));
      expect(`${template.id}/${choice.id}:${atTycoon > atGate}`)
        .toBe(`${template.id}/${choice.id}:true`);
    }
  });

  it('cannot drive money negative or produce NaN through the resolver clamp', () => {
    // Mirrors GameActionsContext: money = max(0, money + resolved).
    const rich = stateAt(DYNASTY_NET_WORTH * 2);
    for (const { template, choice } of allChoices(rich)) {
      for (const worth of LEVELS) {
        for (const wallet of [0, 5, 1_000, 50_000_000]) {
          const resolved = resolveEventMoney(choice.effects, worth);
          const after = Math.max(0, wallet + resolved);
          const label = `${template.id}/${choice.id}@${worth}/$${wallet}`;
          expect(`${label}:${Number.isFinite(after) && after >= 0}`).toBe(`${label}:true`);
        }
      }
    }
  });

  it('a negative-worth (deep debt) state cannot flip a loss into a payout', () => {
    const rich = stateAt(DYNASTY_NET_WORTH * 2);
    for (const { template, choice } of allChoices(rich)) {
      const resolved = resolveEventMoney(choice.effects, -500_000_000);
      const expectedSign = Math.sign(choice.effects.money ?? choice.effects.moneyPct ?? 0);
      if (expectedSign === 0) continue;
      expect(`${template.id}/${choice.id}:${Math.sign(resolved)}`)
        .toBe(`${template.id}/${choice.id}:${expectedSign}`);
    }
  });
});

// ── Reachability from the engine ───────────────────────────────────────────

describe('wealth events — reachable from rollWeeklyEvents', () => {
  it('a wealthy late-game player actually receives them', () => {
    const seen = new Set<string>();
    let total = 0;
    let wealth = 0;
    for (let i = 0; i < 240; i++) {
      const week = 3000 + i;
      const state = stateAt(TYCOON_NET_WORTH * 2, week);
      for (const e of rollWeeklyEvents(state)) {
        total++;
        if (e.id.startsWith('wealth_')) {
          wealth++;
          seen.add(e.id);
        }
      }
    }
    expect(total).toBeGreaterThan(0);
    // Not one lucky hit: many DISTINCT wealth templates must surface...
    expect(seen.size).toBeGreaterThanOrEqual(12);
    // ...and they must be a real share of the late-game week, not a rounding
    // error buried under the ~80-template generic pool. This is the assertion
    // that fails first if the pack's weights are ever tuned down.
    expect(wealth / total).toBeGreaterThanOrEqual(0.15);
    // But never so dominant that ordinary life stops happening.
    expect(wealth / total).toBeLessThanOrEqual(0.6);
  });

  it('a poor player never receives one', () => {
    for (let i = 0; i < 240; i++) {
      const week = 3000 + i;
      const state = createTestGameState({
        weeksLived: week,
        lastEventWeeksLived: week - 30,
        stats: { money: 400 },
        bankSavings: 0,
      });
      for (const e of rollWeeklyEvents(state)) {
        expect(e.id.startsWith('wealth_')).toBe(false);
      }
    }
  });
});

// ── Purity ─────────────────────────────────────────────────────────────────

describe('wealth events — generate() purity', () => {
  it('is deterministic and never throws, even for a broke default state', () => {
    const poor = earlyState();
    for (const t of wealthEventTemplates) {
      const a = t.generate(poor);
      const b = t.generate(poor);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('does not mutate the state it is passed', () => {
    const state = stateAt(TYCOON_NET_WORTH);
    const before = JSON.stringify(state);
    for (const t of wealthEventTemplates) t.generate(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
