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
import { FEATURE_UNLOCKS, isFeatureUnlocked, unlockTier } from '@/lib/progress/featureUnlocks';
import { LIFE_CHAPTERS, wealthMark } from '@/lib/progress/lifeChapters';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, LifetimeStatistics } from '@/contexts/game/types';
import { meetSomeone } from '@/contexts/game/actions/ContactsActions';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import fs from 'fs';
import path from 'path';

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

  it('starts where the screenshot does - tier 2, grid open', () => {
    expect(unlockTier(atHome())).toBe(2);
    expect(isFeatureUnlocked(atHome(), 'app:stocks')).toBe(true);
  });

  it('and stays there after the $775 purchase - the regression', () => {
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
    // that flips back to false is not a display bug - it is a chapter that can
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

describe('borrowed money is not a wealth high', () => {
  /**
   * `LoanActions` credits the FULL principal to `stats.money`, so without the
   * debt subtraction the mark stamped borrowed cash - and because the mark is
   * permanent, so was the tier it bought. A 43% debt-to-income cap rather than
   * a flat limit means a newly-employed character can carry ~$10k of principal:
   * tier 3 in week 5, three chapters of disclosure skipped for good. Before the
   * mark existed that unlock at least went away when the principal was spent,
   * so this is a regression the ratchet itself introduced.
   */
  const withLoan = (cash: number, remaining: number): GameState =>
    ratchetWealthPeak(withMoney(cash, {
      loans: [{
        id: 'loan-personal-1', name: 'Personal loan', principal: remaining,
        remaining, rateAPR: 0.12, termWeeks: 260, weeklyPayment: 60,
        startWeek: 4, autoPay: true, type: 'personal', weeksRemaining: 260,
        interestRate: 0.12,
      }],
    }));

  it('a $10k loan does not bank a tier', () => {
    const borrowed = withLoan(10_200, 10_000);
    expect(borrowed.lifetimeStatistics?.peakNetWorth).toBe(200);
  });

  it('and spending the principal leaves no permanent unlock behind', () => {
    const spent = spend(withLoan(10_200, 10_000), 10_000);
    expect(unlockTier(spent)).toBe(1);
    expect(isFeatureUnlocked(spent, 'app:bitcoin')).toBe(false);
  });

  it('but money earned on top of a loan still marks', () => {
    // The subtraction must not punish a borrower who genuinely gets ahead.
    const ahead = withLoan(13_000, 10_000);
    expect(ahead.lifetimeStatistics?.peakNetWorth).toBe(3_000);
    expect(unlockTier(ahead)).toBe(2);
  });

  it('and the borrowed cash does not buy a tier even while it is in hand', () => {
    // The half-fix: subtracting debt in the ratchet alone still left
    // `wealthMark`'s own liquid term reading the raw balance, so a $10k loan
    // bought tier 3 for as long as the principal sat in the account. All three
    // of its terms are net now, so borrowing moves nothing at all.
    const borrowed = withLoan(10_200, 10_000);

    expect(wealthMark(borrowed)).toBe(200);
    expect(unlockTier(borrowed)).toBe(1);
  });

  it('repaying a loan raises the mark rather than lowering it', () => {
    const owing = withLoan(5_000, 4_000);
    const repaid = write(owing, { loans: [] });

    expect(owing.lifetimeStatistics?.peakNetWorth).toBe(1_000);
    expect(repaid.lifetimeStatistics?.peakNetWorth).toBe(5_000);
  });

  it('debt deeper than the balance records no mark, not a negative one', () => {
    const underwater = withLoan(500, 40_000);
    expect(underwater.lifetimeStatistics?.peakNetWorth).toBe(0);
  });

  it('a repaid loan still in the array is NOT counted', () => {
    // `remaining: 0` with the record retained. The first version fell back to
    // `principal` on any falsy `remaining`, so a paid-off loan was subtracted at
    // its full original value - permanently suppressing the mark and the tier it
    // holds up. `??` and a truthiness test differ at exactly one value, and this
    // is it. Caught by review, not by the tests above.
    const repaid = withLoan(6_000, 0);

    expect(repaid.lifetimeStatistics?.peakNetWorth).toBe(6_000);
    expect(unlockTier(repaid)).toBe(2);
  });

  it('a loan with no `remaining` at all still falls back to principal', () => {
    // The legacy-save path the fallback exists for must survive the fix.
    const legacy = ratchetWealthPeak(withMoney(9_000, {
      loans: [{
        id: 'loan-legacy', name: 'Old loan', principal: 8_000,
        rateAPR: 0.1, termWeeks: 100, weeklyPayment: 100, startWeek: 1,
        autoPay: true, type: 'personal', weeksRemaining: 100, interestRate: 0.1,
      } as never],
    }));

    expect(legacy.lifetimeStatistics?.peakNetWorth).toBe(1_000);
  });

  it('no loans is identical to before the subtraction (the control)', () => {
    expect(ratchetWealthPeak(withMoney(2_522)).lifetimeStatistics?.peakNetWorth)
      .toBe(2_522);
  });
});

describe('losing a job does not take the tier back', () => {
  /**
   * `currentJob` was the last input to `unlockTier` that could go backwards. A
   * life starts with $200, so a player hired in week 1 who leaves before week 4
   * had nothing else holding tier 1 up - and lost the Progression tab, Contacts
   * and Bank with it.
   */
  const employed = (): GameState => ratchetWealthPeak(withMoney(300, {
    weeksLived: 2,
    currentJob: 'retail_associate',
    lifetimeStatistics: { ...baseLifetimeStatistics(), totalWeeksWorked: 1 },
  }));

  it('is tier 1 while employed', () => {
    expect(unlockTier(employed())).toBe(1);
  });

  it('and still tier 1 after quitting', () => {
    const quit = write(employed(), { currentJob: undefined });

    expect(unlockTier(quit)).toBe(1);
    for (const id of ['tab:progression', 'app:contacts', 'app:bank']) {
      expect(`${id} after quitting: ${isFeatureUnlocked(quit, id)}`)
        .toBe(`${id} after quitting: true`);
    }
  });

  it('career history alone is enough to hold it', () => {
    // A politician accrues careerHistory; `totalWeeksWorked` gates on salary.
    const exPolitician = ratchetWealthPeak(withMoney(300, {
      weeksLived: 2,
      currentJob: undefined,
      lifetimeStatistics: {
        ...baseLifetimeStatistics(),
        totalWeeksWorked: 0,
        careerHistory: [{ job: 'political', weeks: 3, earnings: 900, startWeek: 1 }],
      },
    }));

    expect(unlockTier(exPolitician)).toBe(1);
  });

  it('someone who never worked at all is still tier 0 (the control)', () => {
    const neverWorked = ratchetWealthPeak(withMoney(200, {
      weeksLived: 2,
      currentJob: undefined,
      lifetimeStatistics: { ...baseLifetimeStatistics(), totalWeeksWorked: 0 },
    }));

    expect(unlockTier(neverWorked)).toBe(0);
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
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the provider stamps it on the wrapped setter', () => {
    // NOT in MoneyActions. `buyItem`, `sellItem` and many other actions write
    // `stats.money` inside their own updater - correctly, for atomicity - so a
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
  const CARD = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components/LifeChapterCard.tsx'), 'utf8',
  );

  it('the complete state is not a solid CTA', () => {
    // It was a full-width solid-amber bar with bold dark text - the app's
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

describe('every app in both launchers is registered in the table', () => {
  /**
   * `isFeatureUnlocked` returns TRUE for an id it does not recognise. That
   * default is deliberate and right - forgetting to register a new app should
   * make it visible, not invisible - but it means a typo or a new app added to
   * a grid without a row here is silently ungated, and an ungated app is a bug
   * nobody reports. The two grids and the table are three hand-maintained lists
   * that have to agree, so the agreement is checked rather than assumed.
   */
  // Both grids now read ONE catalog (components/launcher/appCatalog.ts), so
  // there are two hand-maintained lists left to reconcile instead of three.
  const idsIn = (rel: string): string[] => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
    return [...src.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);
  };

  it.each([
    ['components/launcher/appCatalog.ts', 19],
  ])('%s - every id resolves to a row', (file, expectedCount) => {
    const ids = idsIn(file);
    // Guard the guard: a refactor that renames the field or reshapes the list
    // would otherwise leave this walking an empty array and passing vacuously.
    expect(`${file} app count: ${ids.length}`).toBe(`${file} app count: ${expectedCount}`);

    for (const id of ids) {
      const registered = FEATURE_UNLOCKS.some((f) => f.id === `app:${id}`);
      expect(`app:${id} registered: ${registered}`).toBe(`app:${id} registered: true`);
    }
  });
});

describe('the ambition reward reads as status too, not as a button', () => {
  /**
   * The card directly BELOW LifeChapterCard on the home screen, carrying the
   * largest reward in the game, had the identical defect: a solid-amber
   * full-width bar with bold dark text, on a `View` with no handler. Fixing one
   * and leaving the other is how the same ticket comes back.
   */
  const CARD = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components/AmbitionCard.tsx'), 'utf8',
  );

  it('the fulfilled state is not a solid CTA', () => {
    expect(CARD).not.toMatch(/backgroundColor: '#FBBF24'/);
    expect(CARD).toMatch(/completeBanner/);
  });

  it('and still has no handler (the control)', () => {
    // Read-only is the point: this card once held the ONLY call to
    // `grantAmbitionPayout` in the app, behind a button, so the payout went
    // unpaid for anyone who never scrolled to it.
    expect(CARD).not.toMatch(/onPress=\{/);
    expect(CARD).not.toMatch(/<TouchableOpacity/);
  });

  it('it says when the reward actually lands', () => {
    expect(CARD).toMatch(/arrives when you end the week/);
  });
});

describe('chapter 2 stays completable at tier 1, for everyone including a loner', () => {
  /**
   * This block used to say "do not fix the friend goal" and pinned
   * `ch2_make_friend` as ALREADY COMPLETE on a fresh life, because the seeded
   * Mom and Dad satisfied `relationships.length > 0`.
   *
   * The reason was sound and is worth restating: a chosen relationship had
   * exactly two sources - Spark, which is tier 2, and the network `intro`
   * favour, which `FAVOR_KIND_BY_CONTACT` offers only on a `business` contact
   * (tier 3). A player working on chapter 2 sits at tier 1 with two parents and
   * no business contacts, so tightening the goal would have made chapter 2 need
   * the app chapter 2 unlocks - rule 3 in `featureUnlocks.ts`, and the deadlock
   * a player was stranded in on 2026-08-13.
   *
   * Program 11 added the third source at TIER 1 (`lib/social/meetPeople.ts`,
   * surfaced on the Contacts app) — and then measured what requiring it costs:
   * a LONER, an archetype the brief explicitly supports, never completes
   * chapter 2 and the chapter spine freezes behind it. So the goal asks for a
   * bond of 60 with ANYONE, which a player who never meets a soul can satisfy
   * by calling their mother.
   *
   * What has to stay true is the PROPERTY the permissive check was standing in
   * for, and that is what this block pins now: a tier-1 player must have a
   * reachable way to satisfy it, without a tier-2 app and without being
   * required to want a social life. That is a stronger guarantee than "the goal
   * is pre-ticked", and it fails just as loudly if either route is removed.
   */
  const friendGoal = LIFE_CHAPTERS
    .find((c) => c.id === 'ch2_settling_in')!.goals
    .find((g) => g.id === 'ch2_someone_close')!;

  it('is NOT satisfied by the family a life starts with', () => {
    const fresh = createTestGameState({ weeksLived: 1 });

    expect((fresh.relationships ?? []).length).toBeGreaterThan(0);
    expect(friendGoal.checkComplete(fresh)).toBe(false);
  });

  it('but a LONER can satisfy it without meeting anyone - by calling their mother', () => {
    const fresh = createTestGameState({ weeksLived: 8 });
    const mum = (fresh.relationships ?? [])[0];
    expect(mum?.type).toBe('parent');

    const cared: GameState = {
      ...fresh,
      relationships: (fresh.relationships ?? []).map((r) =>
        r.id === mum.id ? { ...r, relationshipScore: 60 } : r,
      ),
    };
    expect(friendGoal.checkComplete(cared)).toBe(true);
  });

  it('the tier-1 player working on chapter 2 still cannot reach Spark', () => {
    const workingOnChapter2 = ratchetWealthPeak(withMoney(1_200, {
      weeksLived: 8,
      completedChapters: ['ch1_fresh_start'],
    }));

    expect(unlockTier(workingOnChapter2)).toBe(1);
    expect(isFeatureUnlocked(workingOnChapter2, 'app:tinder')).toBe(false);
  });

  it('but the app carrying the tier-1 door IS open to them', () => {
    const workingOnChapter2 = ratchetWealthPeak(withMoney(1_200, {
      weeksLived: 8,
      completedChapters: ['ch1_fresh_start'],
    }));

    // `meetSomeone` lives in the Contacts app. If this ever goes above tier 1,
    // the friend goal needs an app chapter 2 unlocks and rule 3 is broken.
    expect(isFeatureUnlocked(workingOnChapter2, 'app:contacts')).toBe(true);
  });

  it('and the tier-1 door puts a real person in reach of it', () => {
    // The other route, at the tier that used to have none: take the tier-1
    // state, take the introduction the game offers it, and a chosen
    // relationship exists - with no hand-written state and no tier-2 app.
    const base = ratchetWealthPeak(withMoney(1_200, {
      weeksLived: 8,
      lifeStartWeek: 0,
      completedChapters: ['ch1_fresh_start'],
    }));
    const stub = createSetGameStateStub(base);
    const r = meetSomeone(base, stub.setGameState);

    expect(r.success).toBe(true);
    const met = (stub.current().relationships ?? []).filter((x) => x.type === 'friend');
    expect(met).toHaveLength(1);
  });
});
