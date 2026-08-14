/**
 * The wealth high-water mark — the floor under progressive disclosure.
 *
 * ── The report these tests are written from ───────────────────────────────
 *
 * 2026-08-14, a player at age 19 with $2,522: "Can't access apps, can't claim
 * reward." The screenshots timestamp the answer. At 23:04 the home screen shows
 * $2,522; at 23:05 the app grid shows $1,747 and a desktop launcher, so a
 * computer was bought in between. In that later grid exactly two apps are open —
 * Contacts and Bank, the only tier-1 rows in `FEATURE_UNLOCKS` — and everything
 * else is padlocked. At $2,522 the save was at tier 2.
 *
 * Buying something took the app grid away. `featureUnlocks.ts` rule 2 says that
 * cannot happen ("NOTHING IS EVER TAKEN AWAY... the rule holds by
 * construction"), and the construction was `wealthMark`'s `peakNetWorth` term —
 * a persisted high-water mark that only the WEEK TICK ever stamped, from the
 * balance at the start of that tick. Money earned and spent between two Next
 * Week presses was never sampled, so the floor sat below the balance and
 * `Math.max(liquid, live, peak)` slid down the moment the player spent.
 *
 * So these tests are about one property, from several directions: **the tier is
 * monotonic under spending**. That is the failure mode that gets reported as
 * "the game took my apps away", and it has now been reported twice
 * (2026-08-13, 2026-08-14).
 */
import { ratchetWealthPeak } from '@/lib/progress/wealthRatchet';
import { isFeatureUnlocked, unlockTier } from '@/lib/progress/featureUnlocks';
import { LIFE_CHAPTERS, wealthMark } from '@/lib/progress/lifeChapters';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, LifetimeStatistics } from '@/contexts/game/types';

/**
 * The default statistics slice, as a COMPLETE `LifetimeStatistics`.
 *
 * `GameState.lifetimeStatistics` is optional, so spreading it straight from the
 * factory widens every field to `| undefined` and no longer satisfies the type.
 * Checked rather than cast: a factory that stopped carrying the slice would make
 * every ratchet assertion below vacuous, and this says so out loud.
 */
const baseLifetimeStatistics = (): LifetimeStatistics => {
  const stats = createTestGameState().lifetimeStatistics;
  if (!stats) throw new Error('createTestGameState must carry lifetimeStatistics');
  return stats;
};

/**
 * One state write, exactly as `GameStateContext.wrappedSetGameState` performs
 * it: the updater's result, then the mark. Everything the player does — buying,
 * earning, a week tick — is one of these.
 *
 * `Pick<GameState, K>` rather than `Partial<GameState>`: spreading a Partial
 * widens every key it names to `| undefined`, which is what made the first
 * version of this helper reach for `as GameState` — the cast Hard Rule #3 bans,
 * and for exactly this reason. Keyed on the fields actually passed, the spread
 * IS a `GameState` and the compiler checks the fixture instead of being told.
 */
const write = <K extends keyof GameState>(
  state: GameState,
  patch: Pick<GameState, K>,
): GameState => ratchetWealthPeak({ ...state, ...patch });

const withMoney = (money: number, overrides: Partial<GameState> = {}): GameState =>
  createTestGameState({
    weeksLived: 8,
    currentJob: 'retail_associate',
    completedChapters: [],
    bankSavings: 0,
    prestige: { totalPrestiges: 0 },
    generationNumber: 1,
    ...overrides,
    stats: { ...createTestGameState().stats, money },
  });

const spend = (state: GameState, amount: number): GameState =>
  write(state, { stats: { ...state.stats, money: state.stats.money - amount } });

describe('the reported save: buying a computer must not padlock the grid', () => {
  /** The 23:04 screenshot: $2,522, employed, chapter flags never written. */
  const atHome = (): GameState => ratchetWealthPeak(withMoney(2_522));

  it('starts where the screenshot does — tier 2, grid open', () => {
    expect(unlockTier(atHome())).toBe(2);
    expect(isFeatureUnlocked(atHome(), 'app:stocks')).toBe(true);
  });

  it('and stays there after the $775 purchase — the regression', () => {
    // The 23:05 screenshot. Before the ratchet this dropped to tier 1 and left
    // Contacts and Bank as the only two open apps, which is exactly what the
    // player photographed.
    const afterBuying = spend(atHome(), 775);

    expect(afterBuying.stats.money).toBe(1_747);
    expect(unlockTier(afterBuying)).toBe(2);
  });

  it('every app they had stays open, one by one', () => {
    const afterBuying = spend(atHome(), 775);

    for (const id of ['app:stocks', 'app:tinder', 'app:social', 'app:education',
      'app:pet', 'app:realestate', 'app:contacts', 'app:bank']) {
      expect(`${id} after buying: ${isFeatureUnlocked(afterBuying, id)}`)
        .toBe(`${id} after buying: true`);
    }
  });

  it('and the chapter goal they had met stays met', () => {
    // `applyChapterProgress` needs EVERY goal true in the same tick, so a goal
    // that flips back to false is not a display bug — it is a chapter that can
    // never complete, and its reward is one the player can never be paid.
    const saveGoal = LIFE_CHAPTERS
      .find((c) => c.id === 'ch2_settling_in')!.goals
      .find((g) => g.id === 'ch2_save_2k')!;

    expect(saveGoal.checkComplete(atHome())).toBe(true);
    expect(saveGoal.checkComplete(spend(atHome(), 775))).toBe(true);
  });
});

describe('the tier is monotonic under spending', () => {
  it('a full earn-and-spend life never gives a tier back', () => {
    // The property, walked rather than asserted at one point: whatever the
    // player does with their money, the tier they reached is theirs.
    const moves = [+400, +1_800, -900, +9_000, -8_500, +45_000, -44_000, +210_000, -209_000];

    let state = ratchetWealthPeak(withMoney(0));
    let highestTier: number = unlockTier(state);

    for (const delta of moves) {
      state = write(state, { stats: { ...state.stats, money: state.stats.money + delta } });
      const tier = unlockTier(state);

      expect(`after ${delta}: tier ${tier} >= ${highestTier}`)
        .toBe(`after ${delta}: tier ${tier} >= ${tier < highestTier ? tier : highestTier}`);
      highestTier = Math.max(highestTier, tier);
    }

    // And the walk actually exercised the ladder rather than sitting at 1.
    expect(highestTier).toBe(5);
  });

  it('spending everything down to zero still keeps the grid', () => {
    const broke = spend(ratchetWealthPeak(withMoney(12_000)), 12_000);

    expect(broke.stats.money).toBe(0);
    expect(unlockTier(broke)).toBe(3);
    expect(isFeatureUnlocked(broke, 'app:bitcoin')).toBe(true);
  });

  it('money moved into the bank is not a fall (the control)', () => {
    // `wealthMark`'s liquid term is money + savings, so a deposit is flat, not
    // a drop. Worth pinning: a mark that only watched `stats.money` would stamp
    // a high on every deposit and read as working while doing nothing.
    const banked = write(ratchetWealthPeak(withMoney(3_000)), {
      stats: { ...withMoney(3_000).stats, money: 0 },
      bankSavings: 3_000,
    });

    expect(wealthMark(banked)).toBeGreaterThanOrEqual(3_000);
    expect(unlockTier(banked)).toBe(2);
  });
});

describe('ratchetWealthPeak', () => {
  it('raises the mark to the liquid balance', () => {
    const stamped = ratchetWealthPeak(withMoney(2_522));
    expect(stamped.lifetimeStatistics?.peakNetWorth).toBe(2_522);
  });

  it('counts savings alongside cash', () => {
    const stamped = ratchetWealthPeak(withMoney(500, { bankSavings: 2_000 }));
    expect(stamped.lifetimeStatistics?.peakNetWorth).toBe(2_500);
  });

  it('credits the new peak to the week it happened in', () => {
    // `peakNetWorthWeek` is printed under the peak in the Statistics app, so a
    // raised mark with a stale week credits the new high to the old week.
    const stamped = ratchetWealthPeak(withMoney(2_522, { weeksLived: 31 }));
    expect(stamped.lifetimeStatistics?.peakNetWorthWeek).toBe(31);
  });

  it('never lowers a mark set by the week tick', () => {
    const rich = withMoney(100, {
      lifetimeStatistics: {
        ...baseLifetimeStatistics(),
        peakNetWorth: 90_000,
        peakNetWorthWeek: 40,
      },
    });

    expect(ratchetWealthPeak(rich).lifetimeStatistics?.peakNetWorth).toBe(90_000);
    expect(ratchetWealthPeak(rich).lifetimeStatistics?.peakNetWorthWeek).toBe(40);
  });

  it('returns the SAME object when there is nothing to raise', () => {
    // This runs on every single state write. The no-op path must not allocate,
    // and it must not break the identity checks callers rely on.
    const settled = ratchetWealthPeak(withMoney(2_522));
    expect(ratchetWealthPeak(settled)).toBe(settled);
  });

  it('passes a save with no lifetimeStatistics through untouched', () => {
    const legacy = withMoney(5_000, { lifetimeStatistics: undefined });
    expect(ratchetWealthPeak(legacy)).toBe(legacy);
  });

  it('survives a corrupt balance without writing NaN into the save', () => {
    const corrupt = withMoney(Number.NaN);
    expect(ratchetWealthPeak(corrupt).lifetimeStatistics?.peakNetWorth).toBe(0);
  });

  it('reads only the NEW state, so a new life does not inherit the mark', () => {
    // Prestige rebuilds the save from `initialGameState`: money and
    // lifetimeStatistics reset together. Comparing against the PREVIOUS state
    // would hand a fresh character the whole app grid on their first week.
    const heir = ratchetWealthPeak(withMoney(250, {
      lifetimeStatistics: {
        ...baseLifetimeStatistics(),
        peakNetWorth: 0,
      },
    }));

    expect(heir.lifetimeStatistics?.peakNetWorth).toBe(250);
    expect(unlockTier(heir)).toBe(1);
  });
});

describe('the mark is taken where every writer passes through', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the provider stamps it on the wrapped setter', () => {
    // NOT in MoneyActions. `buyItem`, `sellItem` and many other actions write
    // `stats.money` inside their own updater — correctly, for atomicity — so a
    // hook in `updateMoney`/`applyMoneyDelta` would have missed the very
    // purchase in the bug report.
    const provider = read('contexts/game/GameStateContext.tsx');

    expect(provider).toMatch(/ratchetWealthPeak\(\{\s*\n\s*\.\.\.newState,/);
  });

  it('and only after the no-change short-circuit', () => {
    // Actions use `return prev` to mean "nothing happened". Stamping before that
    // check would turn every rejected purchase into a state change and cascade
    // a whole-app re-render.
    const provider = read('contexts/game/GameStateContext.tsx');
    const shortCircuit = provider.indexOf('if (newState === prev) return prev;');
    const stamp = provider.indexOf('ratchetWealthPeak({');

    expect(shortCircuit).toBeGreaterThan(-1);
    expect(stamp).toBeGreaterThan(shortCircuit);
  });
});

describe('the completed chapter no longer renders a button that does nothing', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const CARD = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components/LifeChapterCard.tsx'), 'utf8',
  );

  it('the complete state is not a solid CTA', () => {
    // It was a full-width solid-amber bar with bold dark text — the app's
    // primary button, on a `View` with no handler. "Can't claim reward".
    expect(CARD).not.toMatch(/backgroundColor: '#FBBF24'/);
    expect(CARD).toMatch(/completeBanner/);
  });

  it('and it still has no handler (the control)', () => {
    // The fix is to stop looking tappable, NOT to add the second granting path
    // the week tick was built to remove.
    expect(CARD).not.toMatch(/onPress=\{/);
    expect(CARD).not.toMatch(/<TouchableOpacity/);
  });

  it('it says when the reward actually lands', () => {
    expect(CARD).toMatch(/arrive when you end the week/);
  });
});
