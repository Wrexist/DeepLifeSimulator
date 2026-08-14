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


---

# Audit round 2 — 2026-08-14, four passes beyond the progression spine

Three scripted sweeps plus a read. `npm run audit:weekly` was clean before and
after; none of the below is something its analyzers look for.

## Pass 1 — dead GameState fields (185 top-level fields walked)

Script: extract every top-level field from the `GameState` interface, then count
references outside the save/type plumbing. Two categories are interesting — a
field nothing writes, and a field nothing reads.

**FOUND: `weeksInPoverty` has no writer, and one whole feature depended on it.**

`scholarshipOpportunity` is the game's safety net for a stuck player: under the
poverty line, no education, no way out. It is registered in `eventTemplates`,
its `grant_free_education` special effect is handled in the week loop and has a
stress test — and it **could never fire**, because its condition reads
`weeksInPoverty >= 12` and nothing in the repo had ever written that field. The
rescue was dead for exactly the player it was written for.

What makes it worth the write-up: the field HAD been reviewed.
`__tests__/progression/invisibleStateP2.test.ts` triages it in a list of twelve
under "logic, no UI", noting "gates one event at >= 12 weeks". That review asked
whether the player needs to SEE the number and correctly said no. It never asked
whether the number moves — and a recorded no-change against one question reads
as clearance against every other one.

Fixed with `applyPovertyTracking` in the week tick (consecutive weeks under
`POVERTY_MONEY_THRESHOLD`, reset on solvency, guarded per §4.3, folded into the
returned state, verified reachable by AST). No migration: the field is already
on `GameState`, absent from `initialGameState`, and every reader treats absent
as 0 — a §7 carve-out that stays one.

Cleared as false positives (the script misses `x.f = v` assignments):
`timeMachineUsesThisLife`, `dynastyStats`, `familyTreeData`, `socialPosts`,
`seasonalEvents`, `retiredAtWeek`. `lastEventWeek` is genuinely unused but is
marked DEPRECATED in favour of `lastEventWeeksLived`, which is written.
`gameMode` is the documented retired field (§7 v38).

## Pass 2 — constants that exist as the single source of truth and are not used

**FOUND: seven duplicated magic numbers, including the death threshold.**

`ZERO_STAT_DEATH_WEEKS = 4` had ZERO code consumers — both death checks in the
week loop used a bare `4` — while `lib/realEstate/rentals.ts` cited the constant
BY NAME in its own reasoning, as though it were authoritative. Tuning the most
consequential number in the game would have done nothing. Same shape:
`ITEM_SELL_RATE`, `WEDDING_DEPOSIT_RATE`, `WEDDING_REMAINDER_RATE`,
`DIVORCE_SETTLEMENT_BASE`, `STUDENT_LOAN_APR`, `BASE_LIFE_EXPECTANCY`.

Every value matched its literal, so wiring them is behaviour-neutral; the point
is that editing the named copy is now not a silent no-op. `JobActions` already
carries the warning for this exact failure mode ("two copies of this number
would let one path call a bluff the other path rewarded").

`ZERO_STAT_WARNING_WEEKS = [1, 3]` is retired rather than wired: it scheduled a
popup that was removed from the week advance, and had no consumer anywhere.

The suite caught its own pin — `weeklyModifiersHonesty.test.ts` asserted the
literal `>= 4`. It now asserts the loop reads the constant AND that the constant
is 4, which is strictly stronger than either half.

## Pass 3 — dead taps (every pressable element in the app)

Script: parse every `TouchableOpacity` / `Pressable` / `TouchableHighlight`
opening tag and flag those with no handler. Three hits, two intentional (the
standard stop-propagation wrappers in `BaseModal` and `MailApp`, both commented
as such).

**FOUND: `ProgressOverview` achievement cards.** Every card was wrapped in a
`TouchableOpacity` with `activeOpacity={0.7}` and no `onPress` — it dimmed under
your finger and did nothing. The same defect class as the reward banners in the
original report: press feedback is a promise. Now a `View`; give it a handler
before making it pressable again.

## Pass 4 — read: the App Store review guard

**FOUND: the money arm of the sour-moment guard was dead.**
`reviewMoments.ts` avoids asking for a rating just after something bad — death,
jail, bankruptcy. The bankruptcy arm reads `bankruptcyTriggered`, which nothing
writes; `types.ts` says so outright ("`BANKRUPTCY_FLOOR` names a bankruptcy the
game cannot reach"). So the money axis had no guard here at all, and a player
who had just fallen behind on their bills could be asked for five stars.

`overdueBalance` (v31) is the failure state the money axis actually got. Both
`detectSourMoment` and `isCalmEnoughToAsk` now read it. The flag check stays —
it costs nothing and starts working the day something writes it.

## Noted, not changed

- `settings.musicEnabled` has no reader and no writer. Removing a field from
  `initialState` is a save-format change (§7) for a dead boolean — not worth a
  STATE_VERSION bump. Recorded so the next audit can tell "looked at" from
  "not looked at".
- `bankruptcyTriggered` itself still has no writer. Whether the game should have
  a reachable bankruptcy state is a design question, not a defect; the arrears
  system covers the player-facing consequence today.
