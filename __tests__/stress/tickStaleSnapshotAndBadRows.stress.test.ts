/**
 * TICK-A2 and TICK-A3 — the week loop's two structural hazards.
 *
 * TICK-A2. The weekly-challenge evaluator was handed a snapshot that refreshed
 * only `stats` and `weeksLived`, while the objectives in
 * `lib/challenges/weeklyChallenges.ts` read `family.spouse` (three separate
 * challenges), `family.children`, `currentJob`, `realEstate`, `date.age` and
 * `getNetWorth`. A player who married, got hired, closed on a property or
 * turned 60 on that tick was not credited for it.
 *
 * Usually that costs a week. On a ROTATION tick it is permanent: the salvage
 * block is the last chance to pay the outgoing challenge, it evaluates against
 * the same snapshot, and a stale read there loses a 150-300 gem reward for
 * good.
 *
 * TICK-A3. Five `.map`/`.filter` loops in the updater read fields off entries
 * assumed non-null, or off a subsystem result assumed to be an array. They sit
 * inside the updater's OUTERMOST try, and its catch returns `prevState` and
 * shows "Progression Error" — so a throw there does not degrade the week, it
 * cancels it. And because the malformed row is persisted, the next tap does the
 * same thing: one bad holding permanently stuck the save. CLAUDE.md §4.3 — a
 * single bad entry must not abort the tick.
 *
 * The behavioural half is tested where it can be: the stock-holding guard is
 * reproduced against the real catalogue lookup, because a numeric symbol from a
 * legacy save is the concrete way this fired. The rest is pinned structurally,
 * since reaching those lines needs the whole provider stack.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { getStockInfo } from '@/lib/economy/stockMarket';
import { evaluateChallengeProgress, WEEKLY_CHALLENGES } from '@/lib/challenges/weeklyChallenges';
import { createTestGameState } from '../helpers/createTestGameState';

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'), 'utf8',
);

// ───────────────────────────── TICK-A2 ─────────────────────────────

describe('TICK-A2 - the challenge snapshot carries this tick\'s changes', () => {
  it('objectives really do read beyond stats and weeksLived (the premise)', () => {
    // If they only read stats, the old snapshot would have been fine and this
    // whole fix is noise. They do not.
    const all = JSON.stringify(
      WEEKLY_CHALLENGES.map((c) => c.objectives.map((o) => String(o.checkCurrent))),
    );

    expect(all).toMatch(/family\?*\.spouse/);
    expect(all).toMatch(/currentJob/);
    expect(all).toMatch(/realEstate/);
  });

  it('a spouse the evaluator can see scores, one it cannot does not (the premise)', () => {
    // Passes on both trees by design — it does not test the fix, it establishes
    // that the objective is sensitive to exactly the field the old snapshot was
    // leaving stale. Without this, "refresh family" is an assertion about code
    // shape with no stated consequence.
    const married = WEEKLY_CHALLENGES.find((c) =>
      c.objectives.some((o) => /family\?*\.spouse/.test(String(o.checkCurrent))),
    )!;
    expect(married).toBeTruthy();

    const spouse = { id: 'r1', name: 'Sam', type: 'spouse' } as never;
    const without = createTestGameState();
    const withSpouse = createTestGameState({
      family: { ...without.family, spouse },
    });

    const before = evaluateChallengeProgress(married.id, without);
    const after = evaluateChallengeProgress(married.id, withSpouse);
    const spouseObjective = (rows: typeof before) =>
      rows.find((r) => married.objectives.find((o) =>
        o.id === r.id && /family\?*\.spouse/.test(String(o.checkCurrent))));

    expect(spouseObjective(before)?.current).toBe(0);
    expect(spouseObjective(after)?.current).toBe(1);
  });

  it('the snapshot refreshes every field the tick has already recomputed', () => {
    const i = SRC.indexOf('const evalState = {');
    expect(i).toBeGreaterThan(-1);
    const end = SRC.indexOf('} as typeof prevState;', i);
    // Assert the terminator EXISTS. Without this the first version of the test
    // was vacuous: indexOf returned -1, `slice(i, -1)` ran to the end of a
    // 4,100-line file, and every field name below matched somewhere unrelated.
    expect(end).toBeGreaterThan(i);
    const block = SRC.slice(i, end);

    for (const field of [
      'stats: newStats',
      'weeksLived: nextWeeksLived',
      'age: nextAge',
      'currentJob: newCurrentJob',
      'careers: updatedCareers',
      'realEstate: updatedRealEstate',
      'relationships: processedRelationships',
    ]) {
      expect(`${field}: ${block.includes(field)}`).toBe(`${field}: true`);
    }
  });

  it('and derives the spouse the SAME way the returned state does', () => {
    // The denormalized `prevState.family.spouse` survives a marriage ended by
    // the health pass (GL-5), so copying it would reintroduce that bug inside
    // the evaluator. Both call sites must use the shared resolver.
    const calls = SRC.match(/resolveFamilySpouse\(\{/g) ?? [];

    expect(calls.length).toBe(2);
    const i = SRC.indexOf('const evalState = {');
    expect(SRC.slice(i, SRC.indexOf('} as typeof prevState;', i)))
      .toMatch(/spouse: resolveFamilySpouse\(\{/);
  });

  it('the remaining staleness is documented, not silent (the control)', () => {
    // Stocks/crypto/banking are computed hundreds of lines below this point and
    // are still stale. That limit is stated at the site rather than left for
    // the next audit to re-find.
    expect(SRC).toMatch(/STILL STALE, deliberately/);
  });
});

// ───────────────────────────── TICK-A3 ─────────────────────────────

describe('TICK-A3 - one malformed row cannot cancel the week', () => {
  it('the outer catch really does cancel the week (the premise)', () => {
    // This is what makes an unguarded throw expensive rather than cosmetic.
    expect(SRC).toMatch(/return prevState;\s*\n\s*\}\s*catch|Return previous state unchanged to prevent corruption/);
    expect(SRC).toMatch(/State update failed, aborting week progression/);
  });

  it('a numeric symbol from a legacy save no longer reaches toUpperCase', () => {
    // The concrete failure: `.filter(h => h.symbol)` passed a number, and
    // `(5).toUpperCase` is not a function.
    const rows = [
      { symbol: 'AAPL', currentPrice: 10 },
      { symbol: 5 as unknown as string, currentPrice: 20 },
      { symbol: '', currentPrice: 30 },
      null,
    ];

    const valid = rows.filter(
      (h) => h && typeof h === 'object' && typeof h.symbol === 'string' && h.symbol.length > 0,
    );

    expect(valid).toHaveLength(1);
    expect(() => valid.map((h) => h!.symbol.toUpperCase())).not.toThrow();
  });

  it('an unknown symbol does not throw on the price read', () => {
    // getStockInfo may not have a row for every persisted symbol.
    const info = getStockInfo('NOT_A_REAL_TICKER_XYZ');
    const livePrice = typeof info?.price === 'number' && isFinite(info.price) ? info.price : 0;

    expect(() => (livePrice > 0 ? livePrice : 123)).not.toThrow();
    expect(Number.isFinite(livePrice)).toBe(true);
  });

  it('a real symbol still gets its live price (the control)', () => {
    // The guard must not have turned every holding into a stale-price row.
    const info = getStockInfo('AAPL');

    expect(typeof info?.price).toBe('number');
    expect(info!.price).toBeGreaterThan(0);
  });

  it('the holding filter checks the TYPE, not just truthiness', () => {
    expect(SRC).toMatch(/typeof h\.symbol === 'string' && h\.symbol\.length > 0/);
    expect(SRC).toMatch(/typeof stockInfo\?\.price === 'number' && isFinite\(stockInfo\.price\)/);
  });

  it('the child and newborn loops skip null rows instead of throwing', () => {
    expect(SRC).toMatch(/processedRelationships\.filter\(\(r\) => !!r && r\.type === 'child'\)/);
    expect(SRC).toMatch(/\.filter\(\(c\): c is NonNullable<typeof c> => !!c && c\.id != null\)/);
    expect(SRC).toMatch(/const bornThisTick = newBornChildren\.filter\(\(c\) => !!c && c\.id != null\)/);
  });

  it('the dark-web deltas are checked for array-ness before being walked', () => {
    expect(SRC).toMatch(/Array\.isArray\(darkWebTick\.relationshipDeltas\)/);
  });

  it('no bare .map survives on those five rows (the structural guard)', () => {
    // The exact expressions that used to throw.
    expect(SRC).not.toMatch(/darkWebTick\.relationshipDeltas\.map\(/);
    expect(SRC).not.toMatch(/\.\.\.newBornChildren\.map\(child =>/);
    expect(SRC).not.toMatch(/processedRelationships\.filter\(\(r\) => r\.type === 'child'\)/);
  });
});
