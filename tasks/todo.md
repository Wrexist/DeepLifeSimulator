# Audit 2026-08-14 — the progression spine, after the wealth-ratchet fix (#127)

Follow-up to #127. Scope: everything the unlock spine touches — `unlockTier`'s
inputs, `wealthMark`, the chapter ladder and its rewards, the two app launchers,
and the reward-claim surfaces on the home screen.

Automated layer first: `npm run audit:weekly` is **clean**, all five domains
green (🔴0 🟠0 🟡0 across Economy, Stability, Save/State, Game Logic,
Week-Loop Perf). Everything below came out of the deep read, which is the point
— the static analyzers cannot see a monotonicity property or a button that is
not a button.

## Fixed

### 1. `AmbitionCard` has the identical fake-CTA the bug report was about

`components/AmbitionCard.tsx:105` renders a full-width **solid `#FBBF24` bar
with bold `#0F172A` text** — the app's primary CTA — reading "Fulfilled ·
$120,000 · 250 gems · 3 prestige next week", on a `View` with no handler. The
exact defect fixed in `LifeChapterCard` in #127, on the card **directly below
it on the same screen**, carrying the largest reward in the game.

The reporter's own home screenshot shows both cards stacked. Fixing one and
leaving the other is how the same ticket comes back. `tasks/lessons.md`
2026-08-13 already wrote the rule: when you close a defect, grep for every
other instance of the same pattern.

Swept all of `components/` for the pattern — `AmbitionCard` is the only other
one. `WeeklyChallengeCard` gets it right (a plain footer line, no CTA styling)
and is the model both now follow.

### 2. `unlockTier`'s employment term is not monotonic

`featureUnlocks.ts:216` — `if (state.currentJob || wealth >= 500 || weeksLived >= 4)`.
`currentJob` is the one input that can go BACKWARDS: quit or get fired and it
becomes `undefined`. A player hired in week 1 who leaves the job before week 4,
while still under $500 (they start with $200), drops tier 1 → 0 and loses the
Progression tab, Contacts and Bank — apps they had a moment earlier.

Narrow window, same bug class as the report: the tier went down. Now backed by
monotonic evidence of employment from `lifetimeStatistics` — `totalWeeksWorked`
and `careerHistory`, both append-only — so leaving a job cannot take the tier
back. `currentJob` stays as an immediate grant on hire.

Residual, stated honestly rather than papered over: hired and quit inside a
single week, before any tick pays out, records no weeks worked and no career
history, so that flicker is still possible. Closing it needs a stored
"has ever been employed" flag — a new field and a migration — for a case where
the player also has no earnings and under four weeks lived. Not worth a
STATE_VERSION bump.

### 3. A loan permanently inflated the tier — a regression from #127

`LoanActions.ts:263` credits the full principal to `stats.money`, so the
ratchet stamped borrowed cash as a wealth high. Before #127 that unlock was
self-correcting (spend the principal, lose the tier); the ratchet made it
**permanent**. Loan size is capped by a 43% debt-to-income rule rather than a
flat limit, so a newly-employed player servicing ~$67/week can carry roughly
$10k of principal — enough to bank tier 3 (crypto, travel, vehicles, the
company desk) in week 5 and skip three chapters of disclosure for good.

The mark now measures `money + bankSavings − outstanding loan principal`.
Borrowed cash is matched by a liability, so it is not a new high. For a player
with no loans — the overwhelming majority, and every fresh save — this is
identical to before.

Credit-card balances are deliberately NOT subtracted: card spending never
credits `stats.money`, so it cannot inflate the mark, and subtracting it would
suppress a legitimate mark for someone who simply pays with a card.

## Verified sound, no change needed

- **App-id coverage.** All 19 desktop ids and all 9 phone ids resolve to a row
  in `FEATURE_UNLOCKS`. An unregistered id silently defaults to UNLOCKED, so a
  gap here is invisible; there is none. Now pinned by a test.
- **Rule 3 (no chapter goal needs an app that chapter unlocks)** holds for
  every chapter, including the goals the hand-authored map in
  `featureUnlocks.test.ts` does not list.
- **The ratchet has no bypass.** `GameStateContext` calls the raw `useState`
  setter exactly once, inside `wrappedSetGameState`. Every writer goes through
  the mark.
- **The load path stamps it too** — `loadGame` ends in `setGameState(safeState)`
  on the wrapped setter, so opening a save can only raise the mark.
- **The weekly stamp and the ratchet cannot fight.** `applyLifetimeStatistics`
  writes `max(prevPeak, safeNetWorth)`; both are maxes over the same field.
- **`applyChapterProgress` is reachable.** Confirmed by AST, not by eye — the
  block's only ancestors are the tick's own `try` and its guard `try`, no
  conditional. The file's indentation is unreliable, so this was worth proving.

## Flagged for the owner — deliberate product calls, not fixed unattended

### A. "Make a Friend" — RESOLVED during the audit: it must stay as it is

`ch2_make_friend` is `relationships.length > 0`, and `initialState` seeds Mom and
Dad, so chapter 2's fourth goal is ticked at week 0 on every default life. My
first read had this as a defect to flag, and the sibling ambition system makes it
look like an open-and-shut one: `lib/ambitions/catalog.ts` tightened the
equivalent check with a comment saying exactly why — "Exclude the starting
parents ... so 'Make a Connection' doesn't auto-complete at birth".

Tracing the routes to a non-family relationship inverted the conclusion.
**Tightening this would deadlock chapter 2.** A chosen relationship has two
sources: Spark (tier 2) and a network-favour introduction, which
`FAVOR_KIND_BY_CONTACT` offers only on a `business` contact — personal kinds are
excluded on purpose. A player working on chapter 2 is at tier 1 with two parents
and no business contacts, so Spark is the only route, and chapter 2 is what
unlocks Spark. That is rule 3 in `featureUnlocks.ts`, and the exact deadlock a
player was stranded in on 2026-08-13.

The permissive check is load-bearing, so it stays, and it is now pinned by a test
that spells out the argument so the next reader does not "fix" it. If the goal
should become real, it needs a visible tier-1 way to meet someone shipped in the
same change — that is a feature, not a correction.

### B. The chapter ladder re-pays on every prestige

Prestige rebuilds from `initialGameState`, so `completedChapters` resets and
all five chapters are re-earned each life — roughly **$42,500 and ~700 gems per
prestige cycle**. Gems are IAP currency.

Defensible as designed (a new life re-lives its chapters, and $10M of prestige
is a steep price), and unlocks are unaffected because `unlockTier` returns 5 for
any prestiged save. But note the precedent directly next door: `legacyContracts`
reset the same way and that WAS treated as a bug in v36, because the ladder was
re-claimable. The difference is that contracts are explicitly multi-life and
chapters are per-life. Your call — I did not want to remove a reward players
currently receive on a reading of intent.
