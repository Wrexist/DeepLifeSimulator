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
import { LIFE_CHAPTERS } from '@/lib/progress/lifeChapters';
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

  it('the MARKET is available too — food and the gym live there', () => {
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

  it('chapter 3 brings investing, which chapter 2 did not', () => {
    expect(isFeatureUnlocked(withChapters(2), 'app:stocks')).toBe(false);
    expect(isFeatureUnlocked(withChapters(3), 'app:stocks')).toBe(true);
  });

  it('the last chapter opens everything', () => {
    const done = withChapters(5);

    for (const feature of FEATURE_UNLOCKS) {
      expect(`${feature.id}: ${isFeatureUnlocked(done, feature.id)}`)
        .toBe(`${feature.id}: true`);
    }
  });

  it('out-of-order chapter flags cannot skip a tier', () => {
    // Completing chapter 3 without 1 and 2 must not jump to tier 3 — the
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

  it('the tier is the MAX of the signals — a rich player with no chapters keeps it', () => {
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

describe('the grid shows locked apps rather than hiding them', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app/(tabs)/computer.tsx'), 'utf8',
  );

  it('each card carries its lock state', () => {
    expect(SRC).toMatch(/locked: !isFeatureUnlocked\(gameState, `app:\$\{app\.id\}`\)/);
    expect(SRC).toMatch(/lockReason: unlockRequirement\(gameState, `app:\$\{app\.id\}`\)/);
  });

  it('a locked card is dimmed and badged, not removed', () => {
    expect(SRC).toMatch(/app\.locked && \{ opacity: 0\.45 \}/);
    expect(SRC).toMatch(/app\.locked && \(\s*<View style=\{styles\.appLockBadge\}>/);
  });

  it('tapping a locked app explains itself instead of doing nothing', () => {
    // A dead tap reads as a bug, not as a gate.
    expect(SRC).toMatch(/if \(app\.locked\) \{[\s\S]{0,300}Alert\.alert\(app\.name, app\.lockReason/);
  });

  it('and a screen reader is told it is locked', () => {
    expect(SRC).toMatch(/accessibilityLabel=\{app\.locked \? `\$\{app\.name\}, locked`/);
    expect(SRC).toMatch(/accessibilityState=\{\{ disabled: !!app\.locked \}\}/);
  });

  it('`available: false` still removes an app outright (the control)', () => {
    // "Does not exist for this save" is a different thing from "not yet", and
    // the lock must not have swallowed it.
    expect(SRC).toMatch(/\.filter\(app => app\.available !== false\)/);
  });
});

/**
 * The unlock spine has to run without the player's help.
 *
 * Chapter completion used to live ONLY in `LifeChapterCard`, behind a Claim
 * button. Since `completedChapters` is what `unlockTier` reads, that meant the
 * whole progressive-disclosure system depended on a screen the player might
 * never open — and the milestone fallbacks were quietly carrying it.
 */
describe('the week tick completes chapters, not a button', () => {
  const { applyChapterProgress, unlockAnnouncement } =
    require('@/contexts/game/actions/weekly/applyChapterProgress');

  /** A state that satisfies every goal of chapter 1. */
  const chapterOneDone = (): GameState => createTestGameState({
    ...fresh(),
    weeksLived: 6,
    currentJob: 'job-1',
    stats: { ...createTestGameState().stats, money: 5_000 },
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

  it('the notification names what was unlocked, not just the money', () => {
    // The unlock is the real reward; money and gems are the garnish.
    const [note] = applyChapterProgress({ state: chapterOneDone() }).notifications;

    expect(note.title).toMatch(/Fresh Start/);
    expect(note.message).toMatch(/available|unlocked/i);
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
    // CLAUDE.md §4.3 — an unguarded subsystem turns one throw into a lost week.
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
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const PHONE = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app/(tabs)/mobile.tsx'), 'utf8',
  );

  it('a phone-only save sees locks', () => {
    // The first pass gated only computer.tsx, so a player who had not bought a
    // computer still saw every app unlocked.
    expect(PHONE).toMatch(/const locked = !isFeatureUnlocked\(gameState, `app:\$\{app\.id\}`\)/);
    expect(PHONE).toMatch(/const lockReason = unlockRequirement\(gameState, `app:\$\{app\.id\}`\)/);
  });

  it('with the same dim, badge and explain-on-tap as the computer', () => {
    expect(PHONE).toMatch(/locked && \{ opacity: 0\.45 \}/);
    expect(PHONE).toMatch(/locked && \(\s*<View style=\{styles\.appLockBadge\}>/);
    expect(PHONE).toMatch(/if \(locked\) \{[\s\S]{0,200}Alert\.alert\(app\.name, lockReason/);
    expect(PHONE).toMatch(/accessibilityState=\{\{ disabled: locked \}\}/);
  });
});

describe('the device surfaces are gated on OWNERSHIP, not on a chapter', () => {
  // These three shipped in the first pass at tiers 1/1/2, which was a trap.
  // Nothing read them, so no player was ever affected — but the moment
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

  it('and the table says so — tier 0, no requirement text', () => {
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
    expect(LIFE).toMatch(/onLockedPress=\{\([\s\S]{0,120}Alert\.alert\('Stats', reason/);
  });

  it('a fresh player cannot reach it; a chapter-1 player can', () => {
    const fresh = createTestGameState({
      weeksLived: 1, completedChapters: [], currentJob: undefined,
      stats: { ...createTestGameState().stats, money: 0 },
      bankSavings: 0,
    });
    // Deliberately identical to `fresh` EXCEPT the chapter flag — otherwise a
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
    // strand a player with no way to recover — the one unsafe gate here.
    expect(LIFE).not.toMatch(/key: 'health'[^}]*locked/);
    expect(LIFE).not.toMatch(/key: 'shop'[^}]*locked/);

    const fresh = createTestGameState({ weeksLived: 1, completedChapters: [] });
    expect(isFeatureUnlocked(fresh, 'tab:health')).toBe(true);
    expect(isFeatureUnlocked(fresh, 'tab:market')).toBe(true);
  });
});
