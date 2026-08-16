/**
 * Progressive disclosure — what a player can see, and when.
 *
 * A brand-new player used to land on NINE tabs and twenty-six apps, none of
 * them gated. That is the whole game presented at once to someone who has not
 * yet earned $500 or taken a job, and it is the single biggest thing making a
 * first session feel unreadable.
 *
 * Features now unlock along the five life chapters that already existed in
 * `lifeChapters.ts` — Fresh Start, Settling In, On The Rise, Building Empire,
 * Legacy. Those chapters had goals, ordering and rewards but only ever fed a
 * progress card; making them the unlock spine gives that system a job and
 * means the pacing is already play-tested content rather than invented gates.
 * Chapter 2's goal is literally "buy a phone", which is exactly when the phone
 * should appear.
 *
 * ── Two rules that matter more than the table ─────────────────────────────
 *
 * 1. UNLOCK STATE IS DERIVED, NEVER STORED. There is no `unlockedFeatures`
 *    field and there must not be one. It is computed from progress the player
 *    already has, so an existing save — mid-career, with money and completed
 *    chapters — opens with everything it had yesterday. Storing it would mean
 *    a migration that has to guess, and guessing wrong takes features away
 *    from someone who already had them. That is the failure mode this design
 *    exists to avoid.
 *
 * 2. NOTHING IS EVER TAKEN AWAY. `unlockTier` is monotonic in progress:
 *    completed chapters only accumulate, and the fallbacks below only ever
 *    raise the tier. A player cannot lose a tab by losing money.
 *
 *    This was a claim before it was true, and it took two reports to make it
 *    true. The milestone fallback read `stats.money + bankSavings` — the
 *    current liquid balance — so spending LOWERED the tier and padlocked apps
 *    the player already had. Buying a $200k property at tier 3 re-locked the
 *    Real Estate app that manages it; a player holding $1M in stocks with an
 *    empty current account read as broke. Reported 2026-08-13, 52 weeks in.
 *
 *    The first fix pointed this at `wealthMark()` — `max(liquid, live, peak)`,
 *    where `peak` is the persisted `lifetimeStatistics.peakNetWorth` — and
 *    declared the rule held by construction. It did not. A `max()` containing
 *    two non-monotonic terms is not monotonic; the floor only stops the fall
 *    going below `peak`, and `peak` was stamped once per week tick from the
 *    balance at the START of the tick, so it never saw money earned and spent
 *    between two Next Week presses. Reported again 2026-08-14 by a player who
 *    bought a computer and watched the grid padlock behind them.
 *
 *    `peak` is now stamped on every state write (`lib/progress/wealthRatchet.ts`,
 *    applied in `GameStateContext.wrappedSetGameState`), so it tracks the
 *    balance rather than sampling it, and the floor is real. The property is
 *    tested as a WALK of earns and spends in
 *    `__tests__/onboarding/wealthRatchet.test.ts` — a table of tiers at fixed
 *    states passes under every broken version of this code.
 *
 * 3. A CHAPTER'S GOAL MUST NOT NEED AN APP THAT CHAPTER UNLOCKS. Chapter 3's
 *    goal is "buy your first stock or property" while Stocks and Real Estate
 *    sat at tier 3 = "Finish Chapter 3", and chapter 4's is "own a company"
 *    while Company sat at tier 4. Neither chapter could be completed through
 *    the chapter path at all — only the cash milestone let anyone past, which
 *    is why defect 2 above was load-bearing rather than cosmetic. An app a
 *    chapter goal depends on belongs one tier BELOW that chapter; the test
 *    suite enforces it from the goal table.
 *
 * Locked features are shown with a padlock and their requirement rather than
 * hidden, so the shape of the game is legible from week 1 and the tab bar does
 * not reshuffle underneath the player as things unlock.
 */
import type { GameState } from '@/contexts/game/types';
import { LIFE_CHAPTERS, wealthMark, weeksInThisLife } from './lifeChapters';

/**
 * Tier 0 is "before you have finished anything" — the state a brand-new
 * character is in. Tier N means chapter N has been completed.
 */
export type UnlockTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface FeatureUnlock {
  /** `tab:<route>` or `app:<appKey>`, matching the router / app-grid keys. */
  id: string;
  /** Chapter completions required. 0 = available from the first screen. */
  tier: UnlockTier;
  /** Shown on the padlock. Written for a player, not a developer. */
  requirement: string;
}

/**
 * ── What the navigation actually looks like ───────────────────────────────
 *
 * Worth stating, because it is not what the route files suggest. There are
 * only FOUR bottom-bar entries — Home, Work, Life, Apps. The other five route
 * files (`mobile`, `computer`, `market`, `health`, `progression`) are
 * registered with `href: null` in `(tabs)/_layout.tsx`: reachable by router
 * and deep link, never rendered as a tab button. Market, Health and
 * Progression are the three segments of Life's sub-menu; mobile and computer
 * are the two launchers inside Apps.
 *
 * So a `tab:` row here means "a navigable surface", not "a bar button", and a
 * tier on one of them only does something once a screen reads it.
 *
 * ── Why the device surfaces are tier 0 ────────────────────────────────────
 *
 * `apps`, `mobile` and `computer` were originally written here at tiers 1/1/2
 * and that was a trap. The Apps tab's real gate is already in the layout, and
 * it is a better one: `ownsAnyDevice`. Chapter 1 is "earn $500, get hired,
 * survive 4 weeks", none of which is buying a phone — so a player who bought a
 * phone in week 2 would have been locked out of the device they had just paid
 * for. An ownership gate cannot desynchronise from the fiction the way a
 * chapter tier can. The tier gating that matters for devices is on the app
 * GRID inside them, which is where it already is.
 *
 * `market` is tier 0 for a related reason. Food and the gym live there and
 * health decays from week 1, so gating it behind a chapter could strand a
 * player with no way to eat — the one genuinely unsafe gate in this table.
 */
export const FEATURE_UNLOCKS: FeatureUnlock[] = [
  // ── Tier 0 — the first session ──────────────────────────────────────────
  { id: 'tab:home', tier: 0, requirement: '' },
  { id: 'tab:life', tier: 0, requirement: '' },
  { id: 'tab:work', tier: 0, requirement: '' },
  { id: 'tab:health', tier: 0, requirement: '' },
  { id: 'tab:market', tier: 0, requirement: '' },
  // Gated on owning the device, in `(tabs)/_layout.tsx` — see the note above.
  { id: 'tab:apps', tier: 0, requirement: '' },
  { id: 'tab:mobile', tier: 0, requirement: '' },
  { id: 'tab:computer', tier: 0, requirement: '' },
  // DeepMail is tier 0 on purpose, alongside the tabs rather than with the
  // other apps. It is where the game explains itself in documents — the first
  // payslip, the first statement, the first rent invoice — and gating it behind
  // Chapter 1 would withhold the paperwork for exactly the weeks a new player
  // most needs to see where their money went. It also has to be reachable
  // before the first phishing attempt can arrive, or the mechanic would fire at
  // a player with no way to look at it.
  { id: 'app:mail', tier: 0, requirement: '' },

  // ── Tier 1 — Fresh Start done: earned $500, got hired, survived 4 weeks ──
  // Life → Stats: achievements, prestige and legacy. Dense, and none of it is
  // actionable in week 1. The only tier-gated surface outside the app grids.
  { id: 'tab:progression', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },
  { id: 'app:contacts', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },
  { id: 'app:bank', tier: 1, requirement: 'Finish Chapter 1: Fresh Start' },

  // ── Tier 2 — Settling In done: promotion, $2k saved, a phone, a friend ───
  { id: 'app:social', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:tinder', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:education', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:paw', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:pet', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  // Stocks and Real Estate are the ONLY ways to satisfy chapter 3's "buy your
  // first stock or property", so they open at the tier chapter 3 starts from —
  // see rule 3 in the header. Market sells no securities and rents rather than
  // sells homes, so there is no third route.
  { id: 'app:stocks', tier: 2, requirement: 'Finish Chapter 2: Settling In' },
  { id: 'app:realestate', tier: 2, requirement: 'Finish Chapter 2: Settling In' },

  // ── Tier 3 — On The Rise done: $10k, a partner, an investment ───────────
  { id: 'app:bitcoin', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  { id: 'app:vehicle', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  { id: 'app:travel', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },
  // Same rule: chapter 4's "own a company" needs this app, so it cannot be
  // gated behind chapter 4's own completion.
  { id: 'app:company', tier: 3, requirement: 'Finish Chapter 3: On the Rise' },

  // ── Tier 4 — Building Empire done: $50k net, a business, a degree ───────
  { id: 'app:gaming', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },
  { id: 'app:streaming', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },
  { id: 'app:statistics', tier: 4, requirement: 'Finish Chapter 4: Building an Empire' },

  // ── Tier 5 — Legacy: the deep end ───────────────────────────────────────
  { id: 'app:onion', tier: 5, requirement: 'Finish Chapter 5: Legacy' },
  { id: 'app:political', tier: 5, requirement: 'Finish Chapter 5: Legacy' },
  { id: 'app:luxury', tier: 5, requirement: 'Finish Chapter 5: Legacy' },
];

const BY_ID = new Map(FEATURE_UNLOCKS.map((f) => [f.id, f]));

/**
 * How far along a save is, as a tier.
 *
 * DERIVED, never stored — see the header. Three sources, and the highest wins
 * so the result can only ever go up:
 *
 *   - completed chapters, the intended signal
 *   - a save that has prestiged, or lived long enough to be well past the
 *     chapter arc, is unconditionally at the top. This is the safety net for
 *     every save that existed before this feature: they never had chapter
 *     completions written, so counting only chapters would strip tabs from a
 *     300-week veteran.
 *   - concrete milestones, for a save mid-arc whose chapter flags never landed
 *     (`completedChapters` is only written when the player opens the card).
 */
export function unlockTier(state: GameState | undefined | null): UnlockTier {
  if (!state) return 0;

  const completed = Array.isArray(state.completedChapters) ? state.completedChapters : [];
  const chapterIds = LIFE_CHAPTERS.map((c) => c.id);
  // Count completions in ORDER, so an out-of-order flag cannot skip a tier.
  let byChapters = 0;
  for (const id of chapterIds) {
    if (!completed.includes(id)) break;
    byChapters += 1;
  }

  // Weeks into THIS life, not the absolute counter. `weeksLived` is seeded from
  // the starting age (`(age - 18) * 52`), so an age-25 scenario begins at 364 and
  // an age-40 one at 1,144 — both sailed past the 120-week hatch below on frame
  // one and opened the entire game, padlocks and chapter ladder skipped, for a
  // character who had not lived a week. CLAUDE.md §4.2.
  //
  // The hatch is per-LIFE on purpose. Its job is "do not re-teach the game to a
  // save that is past the chapter arc", and the two ways to be past it are
  // covered separately: a player who has prestiged is caught by `prestiged`
  // (which survives every life), and a player deep into the current life is
  // caught by the week count. A pre-v43 save has no `lifeStartWeek`, so
  // `weeksInThisLife` returns the absolute counter and those saves keep exactly
  // the tier they have today.
  const weeksThisLife = num(weeksInThisLife(state));
  const prestiged = num(state.prestige?.totalPrestiges) > 0
    || num(state.generationNumber) > 1;

  // The veteran escape hatch. Anything past the chapter arc gets everything.
  if (prestiged || weeksThisLife >= 120) return 5;

  // Milestone fallbacks, for saves whose chapter flags never got written.
  //
  // The thresholds mirror the money goal of each chapter, and they read the
  // same `wealthMark` those goals read — a high-water mark, not a balance, so
  // this axis can only ever climb (rule 2 in the header).
  const wealth = wealthMark(state);
  let byMilestone = 0;
  // `currentJob` alone was the last input to this function that could go
  // BACKWARDS. Quit or get fired and it becomes undefined, so a player hired in
  // week 1 who left the job before week 4 — still under $500, since a life
  // starts with $200 — dropped from tier 1 to tier 0 and lost the Progression
  // tab, Contacts and Bank. Same class as the 2026-08-14 report: the tier went
  // down. `totalWeeksWorked` and `careerHistory` are append-only records of
  // having held a job, so employment now leaves a mark that quitting cannot
  // erase; `currentJob` stays so the tier still lands the moment you are hired.
  const everEmployed =
    num(state.lifetimeStatistics?.totalWeeksWorked) > 0
    || (state.lifetimeStatistics?.careerHistory?.length ?? 0) > 0;
  if (state.currentJob || everEmployed || wealth >= 500 || weeksThisLife >= 4) byMilestone = 1;
  if (wealth >= 2_000) byMilestone = 2;
  if (wealth >= 10_000) byMilestone = 3;
  if (wealth >= 50_000) byMilestone = 4;
  if (wealth >= 200_000) byMilestone = 5;

  return Math.min(5, Math.max(byChapters, byMilestone)) as UnlockTier;
}

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * Is this feature available yet?
 *
 * An id with no entry in the table is UNLOCKED. That default is deliberate:
 * forgetting to register a new app should make it visible, not invisible. A
 * missing feature is a bug nobody reports.
 */
export function isFeatureUnlocked(state: GameState | undefined | null, id: string): boolean {
  const feature = BY_ID.get(id);
  if (!feature) return true;
  return unlockTier(state) >= feature.tier;
}

/** What the padlock should say. Empty string when it is already unlocked. */
export function unlockRequirement(state: GameState | undefined | null, id: string): string {
  const feature = BY_ID.get(id);
  if (!feature || isFeatureUnlocked(state, id)) return '';
  return feature.requirement;
}

/** Everything at a given tier — used to tell the player what they just earned. */
export function featuresUnlockedAtTier(tier: UnlockTier): FeatureUnlock[] {
  return FEATURE_UNLOCKS.filter((f) => f.tier === tier);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prestige tiers — the ladder ABOVE the chapter spine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why this is a separate axis rather than tiers 6–10 on `UnlockTier`.
 *
 * The chapter spine hard-stops: `unlockTier` returns 5 for anyone who has
 * prestiged at all, or simply lived 120 weeks in this life. That escape hatch is
 * correct — a veteran should not be re-taught the game — but it means the
 * chapter scale is *saturated* long before the late game, and extending it to
 * 10 would make the veteran shortcut skip five tiers at once.
 *
 * So progression past the chapter arc keys on `prestige.totalPrestiges`
 * instead, which is already persisted and only ever increases.
 *
 * **The gap this closes:** before this, a repo-wide grep for `prestigeLevel >=`
 * found only cosmetic UI checks. NOTHING in the game was gated on having
 * prestiged more than once, so prestige #5 was mechanically identical to
 * prestige #2 and the question "why prestige again?" had no answer.
 *
 * **Rule for anything added here: NEW content only.** Moving a feature players
 * already have behind a prestige wall is a takeaway, not a reward.
 */
export type PrestigeTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface PrestigeUnlock {
  /** `feature:<name>` — a capability, not a route. */
  id: string;
  /** Completed prestiges required. */
  tier: PrestigeTier;
  /** Shown on the padlock. Written for a player. */
  requirement: string;
}

/**
 * ── Tiers 2–5 ─────────────────────────────────────────────────────────────
 *
 * For a long time this table had exactly one row, which meant tiers 2–5 did
 * nothing and the gap documented above was only half closed: prestige #5 was
 * still mechanically identical to prestige #2.
 *
 * The four capabilities below all obey the NEW-content rule at the top of this
 * block, and it is worth spelling out how, because "is this new?" is the only
 * question that matters when adding a row here:
 *
 *   Vault      — no material object had EVER survived a life. Prestige rebuilds
 *                the save from `initialGameState`; the luxury collection was
 *                simply deleted. Preserving one is a thing nobody could do.
 *   Endowment  — money had no cross-life use at all. Legacy Points were earned
 *                by TIME alone, so a 900-week pauper funded the Dynasty Tree at
 *                the same rate as a 900-week trillionaire.
 *   Trials     — nothing anywhere let a player make a life HARDER. Every meta
 *                system in the game moved in one direction: more head start.
 *   Seat       — money could not outlive the character. There was no permanent,
 *                cross-life structure to spend a late-game fortune on.
 *
 * None of them takes anything away from a player who never prestiges again.
 * They also compose deliberately: each Seat wing deepens one of the three tiers
 * beneath it, which is what makes tier 5 a capstone rather than a fifth menu.
 */
export const PRESTIGE_UNLOCKS: PrestigeUnlock[] = [
  {
    // Founding a SECOND company of a type. New in the same change that added
    // this table, so nothing is being taken away from anyone.
    id: 'feature:conglomerate',
    tier: 1,
    requirement: 'Prestige once to start building a conglomerate',
  },
  {
    // The Vault — carry a luxury piece across death. `lib/dynasty/vault.ts`.
    id: 'feature:vault',
    tier: 2,
    requirement: 'Prestige twice to open the Vault',
  },
  {
    // The Endowment — turn money into Legacy Points. `lib/dynasty/endowment.ts`.
    id: 'feature:endowment',
    tier: 3,
    requirement: 'Prestige three times to endow your family',
  },
  {
    // Dynasty Trials — opt-in handicaps. `lib/dynasty/trials.ts`.
    id: 'feature:trials',
    tier: 4,
    requirement: 'Prestige four times to swear a Trial',
  },
  {
    // The Dynasty Seat — the capstone estate. `lib/dynasty/seat.ts`.
    id: 'feature:dynasty_seat',
    tier: 5,
    requirement: 'Prestige five times to claim the Dynasty Seat',
  },
];

const PRESTIGE_BY_ID = new Map(PRESTIGE_UNLOCKS.map((f) => [f.id, f]));

/** Completed prestiges, clamped to the tier ceiling. */
export function prestigeTier(state: GameState | undefined | null): PrestigeTier {
  const total = state?.prestige?.totalPrestiges;
  const n = typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  return Math.min(5, n) as PrestigeTier;
}

/**
 * Is this prestige-gated capability available?
 *
 * Same default as `isFeatureUnlocked`: an unregistered id is UNLOCKED, so
 * forgetting to register something makes it visible rather than invisible.
 */
export function isPrestigeFeatureUnlocked(
  state: GameState | undefined | null,
  id: string
): boolean {
  const feature = PRESTIGE_BY_ID.get(id);
  if (!feature) return true;
  return prestigeTier(state) >= feature.tier;
}

/** What the padlock should say. Empty string when already unlocked. */
export function prestigeUnlockRequirement(
  state: GameState | undefined | null,
  id: string
): string {
  const feature = PRESTIGE_BY_ID.get(id);
  if (!feature || isPrestigeFeatureUnlocked(state, id)) return '';
  return feature.requirement;
}
