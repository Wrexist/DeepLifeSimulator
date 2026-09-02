/**
 * Progressive disclosure — a clean first session that opens up as you play.
 *
 * A brand-new player used to reach a 26-app grid with nothing gated: the whole
 * game presented at once to someone who has not yet earned $500 or taken a
 * job. Features now unlock along the five life chapters that already existed
 * in `lifeChapters.ts`, which had goals, ordering and rewards but only ever
 * fed a progress card.
 *
 * ── What these tests are really protecting ────────────────────────────────
 *
 * The gating itself is easy. The dangerous part is REGRESSION FOR EXISTING
 * PLAYERS: a 300-week veteran mid-career must not open the app and find their
 * apps missing. That is why unlock state is DERIVED and never stored, and why
 * `unlockTier` takes the MAX of three independent signals. Most of the file
 * below is that guarantee, from several directions, because it is the one
 * failure mode that would be reported as "the update deleted my game".
 *
 * 2026-08-01, product decision taken by the owner.
 */
import {
  FEATURE_UNLOCKS,
  isFeatureUnlocked,
  unlockRequirement,
  unlockTier,
  featuresUnlockedAtTier,
} from '@/lib/progress/featureUnlocks';
import { LIFE_CHAPTERS, getActiveChapter, getChapterProgress } from '@/lib/progress/lifeChapters';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const fresh = (): GameState => createTestGameState({
  weeksLived: 0,
  currentJob: undefined,
  completedChapters: [],
  stats: { ...createTestGameState().stats, money: 0 },
  bankSavings: 0,
  prestige: { totalPrestiges: 0 },
  generationNumber: 1,
});

const withChapters = (n: number): GameState => createTestGameState({
  ...fresh(),
  completedChapters: LIFE_CHAPTERS.slice(0, n).map((c) => c.id),
});

describe('a brand-new player sees a first session, not the whole game', () => {
  it('starts at tier 0', () => {
    expect(unlockTier(fresh())).toBe(0);
  });

  it('the four starting tabs are available', () => {
    for (const id of ['tab:home', 'tab:life', 'tab:work', 'tab:health']) {
      expect(`${id}: ${isFeatureUnlocked(fresh(), id)}`).toBe(`${id}: true`);
    }
  });

  it('the MARKET is available too - food and the gym live there', () => {
    // The one genuinely unsafe gate. Health decays from week 1, so locking
    // the only source of food could strand a player with no way to recover.
    expect(isFeatureUnlocked(fresh(), 'tab:market')).toBe(true);
  });

  it('but the deep end is not', () => {
    for (const id of ['app:onion', 'app:political', 'app:luxury', 'app:company']) {
      expect(`${id}: ${isFeatureUnlocked(fresh(), id)}`).toBe(`${id}: false`);
    }
  });

  it('and a locked feature explains itself', () => {
    // A padlock with no reason is worse than no padlock.
    const reason = unlockRequirement(fresh(), 'app:onion');
    expect(reason.length).toBeGreaterThan(0);
    expect(reason).toMatch(/Chapter/);
  });

  it('an unlocked feature has no requirement text', () => {
    expect(unlockRequirement(fresh(), 'tab:home')).toBe('');
  });
});

describe('finishing a chapter opens the next layer', () => {
  it('each chapter completion raises the tier by exactly one', () => {
    for (let n = 0; n <= LIFE_CHAPTERS.length; n++) {
      expect(`${n} chapters: tier ${unlockTier(withChapters(n))}`)
        .toBe(`${n} chapters: tier ${Math.min(5, n)}`);
    }
  });

  it('chapter 1 brings the phone and the progress screen', () => {
    const after = withChapters(1);

    for (const id of ['tab:mobile', 'tab:apps', 'tab:progression', 'app:bank']) {
      expect(`${id}: ${isFeatureUnlocked(after, id)}`).toBe(`${id}: true`);
    }
  });

  it('chapter 2 brings investing - chapter 3 is what investing is FOR', () => {
    // Stocks and Real Estate deliberately open one tier below the chapter
    // whose goal requires them. See "no chapter needs an app it unlocks".
    expect(isFeatureUnlocked(withChapters(1), 'app:stocks')).toBe(false);
    expect(isFeatureUnlocked(withChapters(2), 'app:stocks')).toBe(true);
    expect(isFeatureUnlocked(withChapters(2), 'app:realestate')).toBe(true);
  });

  it('chapter 3 brings crypto, travel and the company desk', () => {
    for (const id of ['app:bitcoin', 'app:travel', 'app:vehicle', 'app:company']) {
      expect(`${id} at 2: ${isFeatureUnlocked(withChapters(2), id)}`).toBe(`${id} at 2: false`);
      expect(`${id} at 3: ${isFeatureUnlocked(withChapters(3), id)}`).toBe(`${id} at 3: true`);
    }
  });

  it('the last chapter opens everything', () => {
    const done = withChapters(5);

    for (const feature of FEATURE_UNLOCKS) {
      expect(`${feature.id}: ${isFeatureUnlocked(done, feature.id)}`)
        .toBe(`${feature.id}: true`);
    }
  });

  it('out-of-order chapter flags cannot skip a tier', () => {
    // Completing chapter 3 without 1 and 2 must not jump to tier 3 - the
    // chapter count is read IN ORDER.
    const skipped = createTestGameState({
      ...fresh(),
      completedChapters: [LIFE_CHAPTERS[2].id],
    });

    expect(unlockTier(skipped)).toBe(0);
  });
});

describe('NO EXISTING PLAYER LOSES ANYTHING', () => {
  /**
   * The failure mode this whole design is arranged around. `completedChapters`
   * is only written when the player opens the chapter card, so almost every
   * save that predates this feature has an EMPTY array while being deep into
   * the game. Counting chapters alone would strip their apps.
   */
  it('a 300-week veteran with no chapter flags has everything', () => {
    const veteran = createTestGameState({
      ...fresh(),
      weeksLived: 300,
      completedChapters: [],
    });

    expect(unlockTier(veteran)).toBe(5);
    for (const feature of FEATURE_UNLOCKS) {
      expect(`${feature.id}: ${isFeatureUnlocked(veteran, feature.id)}`)
        .toBe(`${feature.id}: true`);
    }
  });

  it('a player who has prestiged has everything, however few weeks they show', () => {
    const prestiged = createTestGameState({
      ...fresh(),
      weeksLived: 2,
      prestige: { totalPrestiges: 1 },
    });

    expect(unlockTier(prestiged)).toBe(5);
  });

  it('an heir in generation 2 has everything', () => {
    const heir = createTestGameState({ ...fresh(), generationNumber: 2 });

    expect(unlockTier(heir)).toBe(5);
  });

  it('a wealthy mid-game save is tiered by its money, not stripped', () => {
    const rich = createTestGameState({
      ...fresh(),
      weeksLived: 40,
      stats: { ...createTestGameState().stats, money: 60_000 },
    });

    expect(unlockTier(rich)).toBeGreaterThanOrEqual(4);
    expect(isFeatureUnlocked(rich, 'app:company')).toBe(true);
  });

  it('savings count toward that, not just cash', () => {
    const saver = createTestGameState({
      ...fresh(), weeksLived: 20, bankSavings: 12_000,
    });

    expect(unlockTier(saver)).toBeGreaterThanOrEqual(3);
  });

  it('the tier is the MAX of the signals - a rich player with no chapters keeps it', () => {
    const rich = createTestGameState({
      ...fresh(), weeksLived: 30, stats: { ...createTestGameState().stats, money: 250_000 },
    });

    expect(unlockTier(rich)).toBe(5);
  });

  it('and losing money never takes a tab away', () => {
    // Monotonicity in the one direction that matters: a player who goes broke
    // still has their chapters.
    const brokeButExperienced = createTestGameState({
      ...withChapters(4),
      stats: { ...createTestGameState().stats, money: 0 },
      bankSavings: 0,
    });

    expect(unlockTier(brokeButExperienced)).toBe(4);
    expect(isFeatureUnlocked(brokeButExperienced, 'app:company')).toBe(true);
  });
});

describe('the table itself', () => {
  it('an UNREGISTERED id is unlocked, not hidden', () => {
    // Forgetting to register a new app should make it visible. A feature
    // nobody can see is a bug nobody reports.
    expect(isFeatureUnlocked(fresh(), 'app:some_future_thing')).toBe(true);
    expect(unlockRequirement(fresh(), 'app:some_future_thing')).toBe('');
  });

  it('every locked entry has a requirement, and every tier-0 entry has none', () => {
    for (const f of FEATURE_UNLOCKS) {
      const hasText = f.requirement.length > 0;
      expect(`${f.id} tier ${f.tier} hasText ${hasText}`)
        .toBe(`${f.id} tier ${f.tier} hasText ${f.tier > 0}`);
    }
  });

  it('ids are unique', () => {
    const ids = FEATURE_UNLOCKS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every tier from 0 to 5 actually unlocks something', () => {
    // A tier that grants nothing is a chapter completion with no reward,
    // which reads as the game ignoring you.
    for (const tier of [0, 1, 2, 3, 4, 5] as const) {
      expect(`tier ${tier}: ${featuresUnlockedAtTier(tier).length > 0}`)
        .toBe(`tier ${tier}: true`);
    }
  });

  it('the requirement text names a real chapter', () => {
    const titles = LIFE_CHAPTERS.map((c) => c.subtitle);
    for (const f of FEATURE_UNLOCKS.filter((x) => x.tier > 0)) {
      expect(`${f.id}: ${titles.some((t) => f.requirement.includes(t))}`)
        .toBe(`${f.id}: true`);
    }
  });

  it('survives a null or corrupt state without throwing (the control)', () => {
    expect(unlockTier(undefined)).toBe(0);
    expect(unlockTier(null)).toBe(0);
    expect(isFeatureUnlocked(undefined, 'tab:home')).toBe(true);
    expect(isFeatureUnlocked(null, 'app:onion')).toBe(false);

    const corrupt = createTestGameState({
      ...fresh(),
      weeksLived: NaN,
      completedChapters: undefined,
      stats: { ...createTestGameState().stats, money: NaN },
    });
    expect(unlockTier(corrupt)).toBe(0);
  });
});

/**
 * The deadlock a player walked into on 2026-08-13: 52 weeks lived, $3,000, and
 * most of the phone and PC grid padlocked with no route to open it.
 *
 * Chapter 3's goal is "buy your first stock or property" and chapter 4's is
 * "own a company" - but Stocks, Real Estate and Company were gated on
 * FINISHING those very chapters. The chapter spine could not advance through
 * its own gate. The only way past was the cash milestone, which is why the
 * non-monotonic balance read below mattered so much: it was carrying the
 * entire progression, and it slid backwards every time the player spent.
 */
describe('no chapter goal needs an app that chapter unlocks', () => {
  /**
   * Which app a goal cannot be completed without. Hand-authored, because the
   * dependency lives in `checkComplete`'s closure and cannot be read off the
   * table - which is exactly how it went unnoticed.
   *
   * Only goals with a HARD single-surface dependency are listed. `ch2_save_2k`
   * is not here: cash counts as well as bank savings, so the Bank app is not
   * required. `ch2_buy_bed` is not here: the Market tab is tier 0.
   */
  const GOAL_REQUIRES_APP: Record<string, string[]> = {
    // Market rents homes but does not sell them, and sells no securities.
    ch3_invest: ['app:stocks', 'app:realestate'],
    ch4_business: ['app:company'],
    ch4_education: ['app:education'],
  };

  const tierOfChapter = (chapterId: string): number =>
    LIFE_CHAPTERS.findIndex((c) => c.id === chapterId) + 1;

  /**
   * The map is hand-authored against two tables it does not own, so BOTH of its
   * key spaces can rot silently and leave the guard below passing vacuously:
   *
   *   - a renamed GOAL id stops matching, and the walk simply skips it;
   *   - a renamed APP id stops resolving, and an unresolved id would otherwise
   *     read as tier 0 - permanently "reachable".
   *
   * A guard that quietly stops guarding is worse than no guard, so both are
   * asserted before the walk runs.
   */
  it('the map itself still refers to real goals and real apps', () => {
    const everyGoalId = LIFE_CHAPTERS.flatMap((c) => c.goals.map((g) => g.id));

    for (const goalId of Object.keys(GOAL_REQUIRES_APP)) {
      expect(`${goalId} is a real goal: ${everyGoalId.includes(goalId)}`)
        .toBe(`${goalId} is a real goal: true`);
    }

    for (const appId of Object.values(GOAL_REQUIRES_APP).flat()) {
      expect(`${appId} is registered: ${FEATURE_UNLOCKS.some((f) => f.id === appId)}`)
        .toBe(`${appId} is registered: true`);
    }
  });

  it('every such app is open at least one tier below its chapter', () => {
    for (const chapter of LIFE_CHAPTERS) {
      for (const goal of chapter.goals) {
        const needed = GOAL_REQUIRES_APP[goal.id];
        if (!needed) continue;

        // The tier a player is at while WORKING on this chapter: the chapter's
        // own completion tier, minus one.
        const workingTier = tierOfChapter(chapter.id) - 1;
        // A goal satisfiable by any ONE of several apps only needs one of them.
        // An id that does not resolve is NOT treated as tier 0 - that would let
        // a typo pass as reachable. The test above proves they all resolve; this
        // keeps the property local so the two cannot drift apart.
        const reachable = needed.filter((id) => {
          const feature = FEATURE_UNLOCKS.find((f) => f.id === id);
          return feature !== undefined && feature.tier <= workingTier;
        });

        expect(`${goal.id} (working at tier ${workingTier}) reachable: ${reachable.length > 0}`)
          .toBe(`${goal.id} (working at tier ${workingTier}) reachable: true`);
      }
    }
  });

  it('the reported save can actually finish chapter 3 - the regression', () => {
    // Week 52, $3,000, employed, no chapter flags past 2. Before the fix this
    // save sat at tier 2 with Stocks and Real Estate padlocked, so `ch3_invest`
    // was unsatisfiable and tier 2 was terminal short of saving $10,000.
    const stuck = createTestGameState({
      ...fresh(),
      weeksLived: 52,
      currentJob: 'graphic_designer',
      stats: { ...createTestGameState().stats, money: 3_000 },
      bankSavings: 0,
    });

    expect(unlockTier(stuck)).toBe(2);
    expect(isFeatureUnlocked(stuck, 'app:stocks')).toBe(true);
    expect(isFeatureUnlocked(stuck, 'app:realestate')).toBe(true);
  });
});

describe('spending money never takes an app away', () => {
  const at = (money: number, extra: Partial<GameState> = {}): GameState =>
    createTestGameState({
      ...fresh(),
      weeksLived: 40,
      currentJob: 'job-1',
      stats: { ...createTestGameState().stats, money },
      bankSavings: 0,
      ...extra,
    });

  it('a player who converts cash into net worth keeps their tier', () => {
    // The acute case: buy a property and the Real Estate app that manages it
    // used to padlock itself, because the tier read the current balance.
    const beforePurchase = at(60_000);
    const afterPurchase = at(1_000, {
      lifetimeStatistics: {
        ...createTestGameState().lifetimeStatistics!,
        peakNetWorth: 60_000,
      },
    });

    expect(unlockTier(beforePurchase)).toBeGreaterThanOrEqual(4);
    expect(unlockTier(afterPurchase)).toBe(unlockTier(beforePurchase));
    expect(isFeatureUnlocked(afterPurchase, 'app:company')).toBe(true);
  });

  it('and a player who simply goes broke keeps it too', () => {
    const wasRich = at(0, {
      lifetimeStatistics: {
        ...createTestGameState().lifetimeStatistics!,
        peakNetWorth: 250_000,
      },
    });

    expect(unlockTier(wasRich)).toBe(5);
  });

  it('the peak is only a FLOOR - it never outranks live wealth (the control)', () => {
    const climbing = at(250_000, {
      lifetimeStatistics: {
        ...createTestGameState().lifetimeStatistics!,
        peakNetWorth: 0,
      },
    });

    expect(unlockTier(climbing)).toBe(5);
  });

  it('a corrupt peak cannot poison the signal', () => {
    // `Math.max` propagates NaN, so each term is sanitised independently.
    const corruptPeak = at(60_000, {
      lifetimeStatistics: {
        ...createTestGameState().lifetimeStatistics!,
        peakNetWorth: NaN,
      },
    });

    expect(unlockTier(corruptPeak)).toBeGreaterThanOrEqual(4);
  });

  it('and a chapter goal reads a monotonic signal too', () => {
    // `applyChapterProgress` needs every goal true in the SAME tick. With a
    // balance read, a player who spends as they earn passes each money goal in
    // a different week and completes the chapter in none of them.
    //
    // The goal now reads `totalMoneyEarned` rather than the `peakNetWorth`
    // high-water mark. Same property - it only ever increases, so spending
    // cannot un-complete it - and it is monotonic by construction rather than
    // by being a computed maximum. It also fixes what the balance read got
    // wrong in the other direction: STARTING cash used to satisfy it, so the
    // goal was complete before the player earned anything.
    const [chapterOne] = LIFE_CHAPTERS;
    const earnedThenSpent = at(0, {
      weeksLived: 6,
      lifeStartWeek: 0,
      lifetimeStatistics: {
        ...createTestGameState().lifetimeStatistics!,
        peakNetWorth: 900,
        totalMoneyEarned: 900,
      },
    });

    const earn500 = chapterOne.goals.find((g) => g.id === 'ch1_earn_500')!;
    expect(earn500.checkComplete(earnedThenSpent)).toBe(true);
    expect(getChapterProgress(chapterOne, earnedThenSpent).isComplete).toBe(true);
  });
});

describe('the grid shows locked apps rather than hiding them', () => {
  // Both launcher screens are thin wrappers around the shared AppLauncher,
  // so the lock treatment is asserted against the one real implementation.
  // Locked apps are no longer dimmed inline (a wall of 0.45-opacity cards for
  // a new player) - they fold into a "Locked (N)" shelf that expands on tap,
  // where every tile still shows its padlock and requirement.
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components/launcher/AppLauncher.tsx'), 'utf8',
  );

  it('each card carries its lock state', () => {
    expect(SRC).toMatch(/locked: !isFeatureUnlocked\(gameState, `app:\$\{app\.id\}`\)/);
    expect(SRC).toMatch(/lockReason: unlockRequirement\(gameState, `app:\$\{app\.id\}`\)/);
  });

  it('a locked card is disclosed and badged, not removed', () => {
    expect(SRC).toMatch(/Locked \(\{locked\.length\}\)/);
    expect(SRC).toMatch(/app\.locked && \(\s*<View style=\{styles\.appLockBadge\}>/);
  });

  it('tapping a locked app explains itself instead of doing nothing', () => {
    // A dead tap reads as a bug, not as a gate.
    // Channel note: these asserted the OS `Alert.alert`. The game's alerts are
    // now `gameAlert` (themed, in-app) - see
    // __tests__/tooling/noNativeAlertInGameUI.test.ts.
    expect(SRC).toMatch(/if \(app\.locked\) \{[\s\S]{0,300}gameAlert\(name, app\.lockReason/);
  });

  it('and a screen reader is told it is locked', () => {
    expect(SRC).toMatch(/accessibilityLabel=\{app\.locked \? `\$\{name\}, locked`/);
    expect(SRC).toMatch(/accessibilityState=\{\{ disabled: app\.locked \}\}/);
  });
});

/**
 * The unlock spine has to run without the player's help.
 *
 * Chapter completion used to live ONLY in `LifeChapterCard`, behind a Claim
 * button. Since `completedChapters` is what `unlockTier` reads, that meant the
 * whole progressive-disclosure system depended on a screen the player might
 * never open - and the milestone fallbacks were quietly carrying it.
 */
describe('the week tick completes chapters, not a button', () => {
  const { applyChapterProgress, unlockAnnouncement } =
    require('@/contexts/game/actions/weekly/applyChapterProgress');

  /**
   * A state that satisfies every goal of chapter 1.
   *
   * `totalMoneyEarned` rather than a balance, and an explicit `lifeStartWeek`:
   * chapter 1 now measures money EARNED and weeks lived IN THIS LIFE, because
   * both of the old readings were already true for a brand-new character -
   * every scenario starts with cash, and `weeksLived` is seeded from the
   * starting age. See `__tests__/progression/chapterOneNotPrePaid.test.ts`.
   */
  const chapterOneDone = (): GameState => createTestGameState({
    ...fresh(),
    weeksLived: 6,
    lifeStartWeek: 0,
    currentJob: 'job-1',
    stats: { ...createTestGameState().stats, money: 5_000 },
    lifetimeStatistics: {
      ...createTestGameState().lifetimeStatistics!,
      totalMoneyEarned: 5_000,
    },
  });

  it('a finished chapter completes on the tick', () => {
    const result = applyChapterProgress({ state: chapterOneDone() });

    expect(result.newlyCompleted).toHaveLength(1);
    expect(result.newlyCompleted[0]).toBe(LIFE_CHAPTERS[0].id);
  });

  it('and pays its reward', () => {
    const result = applyChapterProgress({ state: chapterOneDone() });

    expect(result.moneyReward).toBeGreaterThan(0);
    expect(result.gemReward).toBeGreaterThan(0);
  });

  it('the notification names the money and gems, and does not claim an unlock the player already held', () => {
    // `chapterOneDone` is hired with $5,000, which is tier 2 by milestone
    // before the chapter completes - so "Progression and Contacts are now
    // available" would describe apps the player had been using for weeks.
    // A reward message that describes an unlock that never happened teaches
    // the player to skim rewards (Program 6). The unlock sentence is only
    // written when the completion is what opens the tier.
    const [note] = applyChapterProgress({ state: chapterOneDone() }).notifications;

    expect(note.title).toMatch(/Fresh Start/);
    expect(note.message).toMatch(/\+\$[\d,]+, \+\d+ gems/);
    expect(note.message).not.toMatch(/available|unlocked/i);
  });

  it('an unfinished chapter completes nothing (the control)', () => {
    const result = applyChapterProgress({ state: fresh() });

    expect(result.newlyCompleted).toEqual([]);
    expect(result.moneyReward).toBe(0);
    expect(result.gemReward).toBe(0);
    expect(result.notifications).toEqual([]);
  });

  it('an already-completed chapter is not paid twice', () => {
    const paid = createTestGameState({
      ...chapterOneDone(),
      completedChapters: [LIFE_CHAPTERS[0].id],
    });

    expect(applyChapterProgress({ state: paid }).newlyCompleted).toEqual([]);
  });

  it('at most ONE chapter completes per tick', () => {
    // A returning player crossing several thresholds at once must not dump
    // four chapters of rewards and notifications into one Next Week.
    const veryRich = createTestGameState({
      ...fresh(),
      weeksLived: 30,
      currentJob: 'job-1',
      stats: { ...createTestGameState().stats, money: 5_000_000 },
    });

    expect(applyChapterProgress({ state: veryRich }).newlyCompleted.length)
      .toBeLessThanOrEqual(1);
  });

  it('survives a null state without throwing (the control)', () => {
    expect(applyChapterProgress({ state: undefined as never }).newlyCompleted).toEqual([]);
  });

  it('the announcement only promises what the grid actually unlocks', () => {
    // Reads the same table the gating reads, so the copy cannot drift.
    for (const tier of [1, 2, 3, 4, 5] as const) {
      expect(`tier ${tier}: ${unlockAnnouncement(tier).length > 0}`)
        .toBe(`tier ${tier}: true`);
    }
  });
});

describe('the tick owns completion, and the card no longer does', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the week loop calls it, inside a try/catch', () => {
    // CLAUDE.md §4.3 - an unguarded subsystem turns one throw into a lost week.
    const loop = read('contexts/game/GameActionsContext.tsx');

    expect(loop).toMatch(/try \{\s*\n\s*const chapterResult = applyChapterProgress\(\{/);
    expect(loop).toMatch(/catch \(chapterErr\)/);
  });

  it('and folds the completions into the returned state', () => {
    expect(read('contexts/game/GameActionsContext.tsx'))
      .toMatch(/completedChapters: newlyCompletedChapters\.length > 0/);
  });

  it('the card has NO second granting path', () => {
    // Leaving a claim handler in the component would be one re-wire away from
    // paying the reward twice.
    const card = read('components/LifeChapterCard.tsx');

    expect(card).not.toMatch(/const claim = \(\) =>/);
    expect(card).not.toMatch(/completedChapters: \[\.\.\./);
    expect(card).not.toMatch(/applyMoneyDelta/);
  });

  it('but still shows the goals and their progress (the control)', () => {
    // Read-only is the point; blank is not.
    const card = read('components/LifeChapterCard.tsx');

    expect(card).toMatch(/getChapterProgress/);
    expect(card).toMatch(/getActiveChapter/);
  });
});

describe('the phone grid gates too, not just the computer', () => {
  // The first pass gated only computer.tsx, so a player who had not bought a
  // computer still saw every app unlocked. Both screens now render the SAME
  // shared AppLauncher (asserted above), so the phone grid cannot drift out
  // of the gate again - the only phone-specific fact left to pin is that the
  // wrapper actually mounts that launcher.
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const PHONE = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app/(tabs)/mobile.tsx'), 'utf8',
  );

  it('a phone-only save renders the shared, gated launcher', () => {
    expect(PHONE).toMatch(/<AppLauncher\s+host="phone"/);
    expect(PHONE).not.toMatch(/isFeatureUnlocked/); // no second, forkable gate
  });
});

describe('the device surfaces are gated on OWNERSHIP, not on a chapter', () => {
  // These three shipped in the first pass at tiers 1/1/2, which was a trap.
  // Nothing read them, so no player was ever affected - but the moment
  // anything did, a player who bought a phone in week 2 would have been locked
  // out of the device they had just paid for. Chapter 1 is "earn $500, get
  // hired, survive 4 weeks"; none of that is buying a phone.
  const fresh = () => createTestGameState({
    weeksLived: 1, completedChapters: [], currentJob: undefined,
    stats: { ...createTestGameState().stats, money: 0 },
    bankSavings: 0,
  });

  it('a brand-new player who somehow owns a phone can open it', () => {
    for (const id of ['tab:apps', 'tab:mobile', 'tab:computer']) {
      expect(`${id}: ${isFeatureUnlocked(fresh(), id)}`).toBe(`${id}: true`);
    }
  });

  it('and the table says so - tier 0, no requirement text', () => {
    for (const id of ['tab:apps', 'tab:mobile', 'tab:computer']) {
      const row = FEATURE_UNLOCKS.find((f) => f.id === id);
      expect(`${id}: ${row?.tier} ${JSON.stringify(row?.requirement)}`).toBe(`${id}: 0 ""`);
    }
  });

  it('the real gate still lives in the layout (the control)', () => {
    // If this ever disappears, the Apps tab becomes ungated entirely and the
    // tier-0 rows above stop being safe.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const layout = fs.readFileSync(
      path.join(__dirname, '..', '..', 'app/(tabs)/_layout.tsx'), 'utf8',
    );

    expect(layout).toMatch(/const ownsAnyDevice = ownsSmartphone \|\| ownsComputer;/);
    expect(layout).toMatch(/href: \(isInPrison \|\| !ownsAnyDevice\) \? null : undefined/);
  });

  it('the app GRID inside them is still tier-gated (the control)', () => {
    // Moving the tab to tier 0 must not have unlocked its contents.
    expect(isFeatureUnlocked(fresh(), 'app:onion')).toBe(false);
    expect(isFeatureUnlocked(fresh(), 'app:stocks')).toBe(false);
    expect(isFeatureUnlocked(fresh(), 'app:bank')).toBe(false);
  });
});

describe("Life's Stats segment is the one gated surface outside the grids", () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const LIFE = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app/(tabs)/life.tsx'), 'utf8',
  );

  it('it reads the same table everything else reads', () => {
    expect(LIFE).toMatch(/isFeatureUnlocked\(gameState, 'tab:progression'\)/);
    expect(LIFE).toMatch(/unlockRequirement\(gameState, 'tab:progression'\)/);
    expect(LIFE).toMatch(/locked: statsLocked, lockReason: statsReason/);
  });

  it('and explains itself on tap rather than dying quietly', () => {
    expect(LIFE).toMatch(/onLockedPress=\{\([\s\S]{0,120}gameAlert\('Stats', reason/);
  });

  it('a fresh player cannot reach it; a chapter-1 player can', () => {
    const fresh = createTestGameState({
      weeksLived: 1, completedChapters: [], currentJob: undefined,
      stats: { ...createTestGameState().stats, money: 0 },
      bankSavings: 0,
    });
    // Deliberately identical to `fresh` EXCEPT the chapter flag - otherwise a
    // weeksLived of 6 alone clears the milestone fallback and this would pass
    // without the chapter signal ever being read.
    const settled = createTestGameState({
      weeksLived: 1, completedChapters: ['ch1_fresh_start'], currentJob: undefined,
      stats: { ...createTestGameState().stats, money: 0 },
      bankSavings: 0,
    });

    expect(isFeatureUnlocked(fresh, 'tab:progression')).toBe(false);
    expect(unlockRequirement(fresh, 'tab:progression')).toBe('Finish Chapter 1: Fresh Start');
    expect(isFeatureUnlocked(settled, 'tab:progression')).toBe(true);
  });

  it('Health and Market are NEVER gated (the control)', () => {
    // Health decays from week 1 and food is in Market. Locking either could
    // strand a player with no way to recover - the one unsafe gate here.
    expect(LIFE).not.toMatch(/key: 'health'[^}]*locked/);
    expect(LIFE).not.toMatch(/key: 'shop'[^}]*locked/);

    const fresh = createTestGameState({ weeksLived: 1, completedChapters: [] });
    expect(isFeatureUnlocked(fresh, 'tab:health')).toBe(true);
    expect(isFeatureUnlocked(fresh, 'tab:market')).toBe(true);
  });
});

/**
 * ── The seeded-`weeksLived` trap ──────────────────────────────────────────
 *
 * `weeksLived` is ABSOLUTE and seeded from the starting age
 * (`computeWeeksLived` = `(age - 18) * 52`), so an age-25 scenario begins at
 * 364 and the age-40 one at 1,144. `unlockTier` compared that raw counter to
 * 120 ("this save is past the chapter arc") and to 4 ("this player has lived a
 * month"), so EVERY scenario that does not start at 18 - and the shipped set
 * starts at 19, 20, 22, 25, 28, 30 and 40 - opened tier 5 on frame one: every
 * app unlocked, the padlocks gone, and the whole chapter onboarding ladder
 * skipped for a character who had not lived a week.
 *
 * The fix is `weeksInThisLife`, which subtracts the v43 `lifeStartWeek`
 * baseline. This is the fourth time this class has shipped; see CLAUDE.md §4.2.
 */
describe('a fresh life is tier 0 whatever age it starts at', () => {
  /** A brand-new life, seeded the way `gameStateBuilder` seeds one. */
  const freshAtAge = (age: number): GameState => {
    const start = (age - 18) * 52;
    return createTestGameState({
      ...fresh(),
      weeksLived: start,
      lifeStartWeek: start,
    });
  };

  it.each([18, 19, 20, 22, 25, 28, 30, 40])(
    'an age-%i start opens at tier 0, not tier 5',
    (age) => {
      expect(unlockTier(freshAtAge(age))).toBe(0);
    }
  );

  it('the deep end really is padlocked for an age-25 start', () => {
    const state = freshAtAge(25);
    for (const id of ['app:onion', 'app:political', 'app:luxury', 'tab:progression']) {
      expect(`${id}: ${isFeatureUnlocked(state, id)}`).toBe(`${id}: false`);
    }
    expect(unlockRequirement(state, 'tab:progression'))
      .toBe('Finish Chapter 1: Fresh Start');
  });

  it('the age-40 start - 1,144 absolute weeks - is not a veteran either', () => {
    const state = freshAtAge(40);
    expect(state.weeksLived).toBe(1144);
    expect(unlockTier(state)).toBe(0);
    expect(isFeatureUnlocked(state, 'app:onion')).toBe(false);
  });

  it('the 4-week milestone measures weeks PLAYED, not weeks since 18', () => {
    // `byMilestone = 1` on `weeksLived >= 4`. An age-25 start cleared it at
    // birth, handing out the Progression tab, Contacts and Bank for nothing.
    const start = (25 - 18) * 52;
    const week3 = createTestGameState({
      ...fresh(), weeksLived: start + 3, lifeStartWeek: start,
    });
    const week4 = createTestGameState({
      ...fresh(), weeksLived: start + 4, lifeStartWeek: start,
    });

    expect(unlockTier(week3)).toBe(0);
    expect(unlockTier(week4)).toBe(1);
    expect(isFeatureUnlocked(week4, 'app:bank')).toBe(true);
  });

  it('and the veteran hatch still opens - 120 weeks INTO the life', () => {
    const start = (25 - 18) * 52;
    const justShort = createTestGameState({
      ...fresh(), weeksLived: start + 119, lifeStartWeek: start,
    });
    const veteran = createTestGameState({
      ...fresh(), weeksLived: start + 120, lifeStartWeek: start,
    });

    expect(unlockTier(justShort)).toBeLessThan(5);
    expect(unlockTier(veteran)).toBe(5);
    for (const feature of FEATURE_UNLOCKS) {
      expect(`${feature.id}: ${isFeatureUnlocked(veteran, feature.id)}`)
        .toBe(`${feature.id}: true`);
    }
  });

  it('a pre-v43 save has no baseline and keeps EXACTLY the tier it has today', () => {
    // The carve-out reasoning (CLAUDE.md §7, v43): a save written before this
    // cannot grow a `lifeStartWeek`, so `weeksInThisLife` falls back to the
    // absolute counter and nothing is taken away from an existing player.
    const legacyVeteran = createTestGameState({
      ...fresh(), weeksLived: 300, lifeStartWeek: undefined,
    });
    expect(unlockTier(legacyVeteran)).toBe(5);
  });

  it('an age-18 start is unchanged - the baseline is 0', () => {
    const state = freshAtAge(18);
    expect(state.lifeStartWeek).toBe(0);
    expect(unlockTier(state)).toBe(0);
    expect(unlockTier(createTestGameState({
      ...fresh(), weeksLived: 130, lifeStartWeek: 0,
    }))).toBe(5);
  });

  it('the chapter card opens on Chapter 1, not Chapter 5', () => {
    // `getActiveChapter` walks `weekRange`, which is measured in weeks into the
    // life: chapter 5 starts at 60. Against the raw counter an age-25 start
    // cleared every range at birth and was handed the Legacy chapter.
    expect(getActiveChapter(freshAtAge(25))?.id).toBe('ch1_fresh_start');
    expect(getActiveChapter(freshAtAge(40))?.id).toBe('ch1_fresh_start');
    expect(getActiveChapter(freshAtAge(18))?.id).toBe('ch1_fresh_start');
  });
});
