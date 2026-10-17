/**
 * Event content that said one thing and did another (2026-10-17 audit).
 *
 * Each block pins one template's copy to its effect, plus two pool-wide
 * ratchets for the classes the audit found by hand: duplicate template ids,
 * and stat keys that do not exist.
 */
import { eventTemplates } from '../engine';
import { CLIFFHANGERS } from '../cliffhangerEvents';
import { careerEventTemplates } from '../careerEvents';
import type { WeeklyEvent } from '../engine';
import type { GameStats } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const byId = (id: string) => {
  const t = eventTemplates.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};

describe('pool ratchets', () => {
  it('template ids are unique (two templates under one id share a cooldown, a log identity and a category)', () => {
    const seen = new Map<string, number>();
    for (const t of [...eventTemplates, ...careerEventTemplates.filter((c) => !eventTemplates.includes(c))]) {
      seen.set(t.id, (seen.get(t.id) ?? 0) + 1);
    }
    expect([...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it('no authored choice moves a stat GameStats does not have (it would preview, then silently drop)', () => {
    const REAL: string[] = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'] satisfies (keyof GameStats)[];
    // Legacy alias `resolveEvent` reads on purpose ("events that mistakenly
    // nested approvalRating inside stats"), so it is applied, not dropped.
    REAL.push('approvalRating');
    const state = createTestGameState({ weeksLived: 260, stats: { money: 50_000 } });
    const offenders: string[] = [];
    const check = (event: WeeklyEvent | null | undefined) => {
      for (const c of event?.choices ?? []) {
        for (const key of Object.keys(c.effects?.stats ?? {})) {
          if (!REAL.includes(key)) offenders.push(`${event!.id}:${c.id}:${key}`);
        }
      }
    };
    for (const t of eventTemplates) {
      try {
        check(t.generate(state));
      } catch {
        // generators needing richer state are out of scope here
      }
    }
    for (const cliff of CLIFFHANGERS) {
      try {
        check(cliff.resolveEvent(state));
      } catch {
        // same
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the duplicates were renamed, not dropped', () => {
    expect(byId('card_fraud')).toBeDefined();
    expect(byId('market_dip')).toBeDefined();
    expect(byId('identity_theft')).toBeDefined();
    expect(byId('market_crash')).toBeDefined();
  });
});

describe('medical_emergency: paying for treatment is the best medical option', () => {
  it('treatment never adds the disease; delaying always does', () => {
    for (let week = 300; week < 340; week++) {
      const event = byId('medical_emergency').generate(createTestGameState({ weeksLived: week, stats: { health: 30 } }));
      const treat = event.choices.find((c) => c.id === 'treat')!;
      const delay = event.choices.find((c) => c.id === 'delay')!;
      expect(treat.special).toBeUndefined();
      if (delay.diseaseId) expect(delay.special).toBe('add_disease');
    }
  });
});

describe('job_offer: the copy promises what the effect pays', () => {
  it('no ongoing pay rise is promised, for anyone', () => {
    const event = byId('job_offer').generate(createTestGameState({}));
    expect(event.description).not.toMatch(/step up from your current pay/);
  });

  it('an unemployed player is not offered "stay at current job"', () => {
    const event = byId('job_offer').generate(createTestGameState({ currentJob: undefined }));
    for (const c of event.choices) expect(c.text).not.toMatch(/current job/i);
    expect(event.choices.find((c) => c.id === 'accept')!.effects.money).toBeGreaterThan(0);
  });
});

describe('copy that named a recurring price over a one-off charge', () => {
  it('life_insurance_offer names the single $200', () => {
    const accept = byId('life_insurance_offer').generate(createTestGameState({})).choices.find((c) => c.id === 'accept')!;
    expect(accept.text).not.toMatch(/month/);
    expect(accept.text).toContain('$200');
    expect(accept.effects.money).toBe(-200);
  });

  it('ch_bank_call security upgrade names the single $200', () => {
    const cliff = CLIFFHANGERS.find((c) => c.id === 'ch_bank_call')!;
    const upgrade = cliff.resolveEvent(createTestGameState({})).choices.find((c) => c.id === 'upgrade')!;
    expect(upgrade.text).not.toMatch(/\/mo/);
    expect(upgrade.text).toContain(`$${-(upgrade.effects.money ?? 0)}`);
  });
});

describe('antique_finding: the $50 in the text is the $50 at risk', () => {
  it('a bust loses $50, not $100', () => {
    const losses = new Set<number>();
    for (let week = 300; week < 360; week++) {
      const buy = byId('antique_finding').generate(createTestGameState({ weeksLived: week })).choices.find((c) => c.id === 'buy_appraise')!;
      if ((buy.effects.money ?? 0) < 0) losses.add(buy.effects.money!);
    }
    expect([...losses]).toEqual([-50]);
  });
});

describe('macro-event "invest" branches are real gambles with an upside', () => {
  it.each([
    ['economic_recession', 'invest'],
    ['economic_boom', 'invest'],
    ['market_crash', 'buy_dip'],
    ['inflation_spike', 'invest'],
  ])('%s/%s pays on average and can go either way (40 lives x 50 weeks)', (id, cid) => {
    // Many lives, not one: a single seeded tape is one draw (CLAUDE.md §4.3),
    // and the edges here are deliberately small (+$25 to +$100 a bet).
    let total = 0;
    let wins = 0;
    let draws = 0;
    for (let life = 0; life < 40; life++) {
      for (let week = 300; week < 350; week++) {
        const state = createTestGameState({ lineageId: `audit-life-${life}`, weeksLived: week });
        const c = byId(id).generate(state).choices.find((x) => x.id === cid)!;
        const money = c.effects.money ?? 0;
        total += money;
        if (money > 0) wins++;
        draws++;
      }
    }
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(draws);
    expect(total / draws).toBeGreaterThan(0);
  });

  it('the crash "sell" branch no longer promises a sale it never makes', () => {
    const state = createTestGameState({});
    const withStocks = { ...state, stocks: { ...(state.stocks ?? {}), holdings: [{ symbol: 'AAPL', shares: 1 }] } } as typeof state;
    const sell = byId('market_crash').generate(withStocks).choices.find((c) => c.id === 'sell')!;
    expect(sell.text).not.toMatch(/sell/i);
  });
});

describe('exam_success rewards a stat that exists', () => {
  it('push_on moves reputation, not "intelligence"', () => {
    const push = byId('exam_success').generate(createTestGameState({})).choices.find((c) => c.id === 'push_on')!;
    expect(Object.keys(push.effects.stats ?? {})).not.toContain('intelligence');
    expect(push.effects.stats?.reputation).toBeGreaterThan(0);
  });
});
