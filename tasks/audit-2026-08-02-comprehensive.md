# Comprehensive audit — 2026-08-02

Everything worth checking, everything still vulnerable, everything I was unsure
about. Each line is backed by a sweep I ran, not by reading code and guessing.

The organising insight comes from the seven player reports fixed earlier today:
**five of them were features that worked, whose effect nothing displayed.** So
this audit weights "state the player cannot see" as heavily as "state that is
wrong", because in practice they produce the same bug report.

---

## Part 0 — dimensions that came back CLEAN (verified, no work)

Recording these so the next pass does not re-run them, and so "no findings" is
distinguishable from "not checked".

| Dimension | Method | Result |
|---|---|---|
| Orphaned exports | every `export const/function` in `lib/` + `contexts/game/actions` grepped for a non-test caller | **0** |
| Non-atomic spends (§4.4) | every `setGameState(prev => …)` block that debits money/gems, checked for an in-updater re-check | **0** |
| Device-clock farmable grants | clock reads intersected with claim/reward/streak/grant | **0** — the daily claim goes through the v27 `lastLoginRewardAt` high-water mark |
| Migration ↔ repair parity | weekly audit S3 | **43/43** concrete defaults mirrored |
| Every repair sets `repaired` | weekly audit S3 | pass |
| Migration ladder coverage | weekly audit S3 | all versions `[2..30]` covered |
| Test-tree types | ratchet | **0 errors** |
| `as GameState` (Hard Rule #3) | weekly audit S3 | **2**, both deliberate corruption fixtures |
| `as any` in core logic | weekly audit S2 | 5 / budget 40 |
| Deep clone in week tick | weekly audit S5 | none unexempted |

### One audit FALSE POSITIVE to fix

`audit-stability` reports *"Weekly tick subsystems mostly guarded (61/63) —
unwrapped: applyRelationshipGain, applyMoneyDelta"*. Both call sites are at
`GameActionsContext.tsx:4309` and `:4408` — a karma-adjusted relationship change
and an engagement-ring purchase. **Neither is in the week loop.** The check
name-matches known helpers anywhere in the file rather than inside the tick
block, so it will keep reporting two phantom gaps forever.

---

## Phase 1 — dead stored fields (16)

Every one of these is declared on `GameState`, defaulted in `initialState`, and
read by **nothing**. This is not cosmetic: it is the exact shape of two bugs
already fixed today.

- `company.money` — rendered as "Cash $0" on every company for its entire life.
- `revivalPack` — a $2.99 product's entire state, dead since day one.

Both looked like working features from the outside. So the standing risk is not
the wasted bytes, it is that a dead field is indistinguishable from a broken
one, and the next person to wire something to it inherits a silent no-op.

### 1A — seven tutorial flags, zero references anywhere

`hasSeenInvestmentTutorial`, `hasSeenDatingTutorial`, `hasSeenHealthWarning`,
`hasSeenEnergyWarning`, `hasSeenMoneyManagementTutorial`,
`hasSeenSocialMediaTutorial`, `hasSeenRealEstateTutorial`

Zero refs outside `types.ts` / `initialState.ts`. No tutorial reads them, no
migration writes them.

### 1B — four save-metadata fields, zero references anywhere

`_checksum`, `_saveVersion`, `_buildNumber` (0 refs each), `_appVersion` (2).

The real integrity primitives (CRC32, HMAC) live in `saveValidation` and do not
touch these. `_checksum` in particular reads as though saves are verified
through it; they are not.

### 1C — five fields the SAVE PIPELINE maintains for no reader

`perfectWeeks`, `debtWeeks`, `goalProgress`, `challengeStreak`,
`activeChapterId`, `completedTutorialSteps`

Worse than 1A/1B: `saveMigrations` backfills them and `repairGameState` mirrors
them, so every load pays for state nothing consumes. `activeChapterId` is the
clearest — `getCurrentChapter()` **derives** the active chapter from
`completedChapters`, so the stored field was superseded and never removed.

**Decision needed per group: delete, or wire.** Deleting a `GameState` field is
a schema change under Hard Rule #3 and §7. Leaving them is the status quo that
has already cost two bug reports.

---

## Phase 2 — invisible gameplay (32 fields with logic and no UI)

The class that produced five of today's seven reports. Ordered by how much the
player is affected by something they cannot see.

### 2A — HIGH: `wantedLevel` — DONE 2026-08-02

38 references in logic, **0 in any component**. It gates police/crisis events
(`engine.ts:196,211`) and it **quadruples** the personal-crisis rate:
`personalCrises.ts:432` returns `0.2` when wanted, `0.05` when not.

A 4× swing in how often bad things happen, with no indicator anywhere. Note the
dark web has a *separate*, visible `heat` stat (`lib/darkweb/heat.ts` says it
"replaces the binary wantedLevel"), so a player reasonably assumes heat is the
whole picture. It is not.

**Resolved without needing the owner.** The game already displays the direct
analogue: `lib/darkweb/heat.ts` says in its own header that heat "replaces the
binary wantedLevel ticker", and heat has a band, a label and a meter. Heat only
ever covered dark-web work, so street crime kept feeding a meter nothing showed.
Consistency settles it — display it.

Shipped: `lib/crime/criminalRecord.ts` owns the arithmetic, `JobActions` reads it
instead of three inline expressions, and the Street Jobs tab states all three
costs (and shows nothing for a clean player). The worst of the three was the
least guessable — a background check costing up to 30% on LEGITIMATE career
applications, caused by a stat on another screen.

### 2B — HIGH: `criminalXp` / `criminalLevel` progression — DONE 2026-08-02

18 refs, 0 in UI. The player levels up a criminal track with no progress
display.

### 2C — MEDIUM: protection the player cannot check — DONE 2026-08-02

`diseaseImmunities` (8 refs), `vaccinations` (13 refs) — both drive real
outcomes; neither is visible. A player who paid for a vaccination has no way to
confirm they have it.

### 2D — MEDIUM: `legacyBuffs` — DONE 2026-08-02 · `dynastyStats` — no change

`legacyBuffs` holds two TIMED buffs — `mentor` (+50% career progress) and
`luckyCharm` (+10% luck) — each just an expiry week, displayed nowhere. A timed
buff nobody can see is worse than a permanent one: you cannot tell it is
running, when it lapses, or plan around either. Now shown as chips on the Work
tab (which is what `mentor` accelerates), sharing the tick's own `>` comparison
so a buff the tick no longer applies is never advertised.

`dynastyStats` left alone: it is a rich prestige record, but it is carried and
aggregated rather than acted on per-week, and building a dynasty screen is a
feature rather than an audit fix.

### 2E — LOW: status flags with no surface

`weeksInPoverty`, `bankruptcyTriggered`, `totalHappiness`, `healthWeeks`,
`zeroStatType`, `discoveredSecrets`, `retiredAtWeek`, `escapedFromJail`,
`computerPreviouslyOwned`, `lastDivorceWeek`, `socialPosts`, `seasonalEvents`

**TRIAGED 2026-08-02 — deliberately NO code change.** Eleven are internal
bookkeeping a player has no reason to see: event gates (`weeksInPoverty`,
`computerPreviouslyOwned`), milestone timing (`retiredAtWeek`), simulator-only
(`zeroStatType`), scheduling data (`socialPosts`, `seasonalEvents`), and
prestige carry (`discoveredSecrets`).

The twelfth, `lastDivorceWeek`, enforces a 26-week cooldown and WOULD be the
UX-4 "discovered by being refused" problem — except the refusal already states
the remaining wait. Verified by assertion rather than by prose, because "I
checked and it was fine" is worth exactly as much as the check behind it.

Recording the no-change matters: without it the next audit re-derives the same
twelve names and cannot tell "not looked at" from "looked at and left alone".

---

## Phase 3 — stop the class from recurring

The reason today's reports existed is that nothing detects "gameplay input with
no display". Two guards, both cheap:

1. **A UI-truth test** — for a named list of player-facing multipliers
   (company income factors, raise multiplier, …), assert that at least one
   component reads the same helper the payout uses. This is what would have
   caught the hustle bug before a player did.
2. **A dead-field guard** — fail when a `GameState` field has zero readers
   outside `types` / `initialState` / save plumbing. Ratcheted like the
   test-type gate so the existing 16 do not block, but no NEW one appears.

---

## Phase 4 — fix the audit's own false positive

Scope the week-tick guard check to the tick block instead of the whole file, so
it stops reporting `applyRelationshipGain` / `applyMoneyDelta` as unguarded.

---

## Execution order

1. **Phase 4** (smallest; makes the audit trustworthy for everything after it)
2. **Phase 3** (the guards — so Phases 1-2 land against a ratchet that holds)
3. **Phase 1** (dead fields — mechanical once the guard exists)
4. **Phase 2** (invisible gameplay — largest, needs judgement per field, and
   2A carries an owner question)

---

## Round 2 — the "advertised ≠ actual" sweep (2026-08-02, later)

Phase 3's UI-truth guard was planned as a registry over `*Multiplier`-shaped
helpers. **That shape was abandoned after measuring it:** a name-pattern scan
returns 29 helpers and ~25 are internal computation with no reason to be shown.
A guard firing 25 false positives is the phantom-finding trap, not a guard.

The tractable invariant is narrower: **a component renders a stored field that
the payout adjusts.** Sweeping for that found five real defects.

| # | Defect | Status |
|---|---|---|
| 1 | Company income — UI showed stored base, payout applied brand/share/hires | fixed (earlier) |
| 2 | `raiseMultiplier` — FOUR different clamps across writer/payout/UI | fixed `a3a54e3` |
| 3 | Savings APR — displayed `baseAPR`, paid `effectiveDepositAPR` (65% in a crash) | fixed `4226f28` |
| 4 | Asking rent — over-ask accepted then silently clamped | fixed `4efcc6e` |
| 5 | Prestige income cap — 3.35x advertised, 1.50x granted | fixed `c96932b` |
| 6 | `legacy_business` — 30,000 pts, wired to NOTHING | flagged `a985a97`, **owner decision open** |

Guard shipped for #6's class: `__tests__/tooling/prestigeBonusReaders.test.ts`
(`f9bf97e`). Scoped to prestige bonuses ONLY — see below for why.

### Dimensions verified CLEAN this round (do not re-derive)

| Dimension | Method | Result |
|---|---|---|
| Gold upgrades (9, 5k–150k gems) | each id traced to a reader | **all wired**; uncapped, stack multiplicatively, descriptions accurate |
| Onboarding perks (20; 9 income) | cap reachability computed | `MAX_PERK_INCOME_BONUS` 2.0 is **unreachable** — all nine active product to 1.5614. No perk purchase is ever wasted |
| Luxury items (12) | unread-id scan | 0 unread |
| Loan APR | traced origination | `effectiveLoanAPR` applied at origination and STORED, so displaying `loan.rateAPR` raw is correct. Pattern-matched the bug class; is not one |
| `applyBreakthroughEffects` | read the writer | WRITES the stored field, so the UI reading it is right. Not an instance |

### Scans that DO NOT generalise (recorded so nobody rebuilds them)

The unread-id scan works on prestige bonuses because `applyBonuses` consumes
each by name. It is useless elsewhere:

- **ambitions** 40 ids, 38 "unread" — milestones are iterated generically
  (`ambition.milestones.map(...)`), so an id is never a literal. All false.
- **achievements** 21 ids, 19 "unread" — the evaluator is a
  `switch (achievement.id)` in the SAME file as the catalogue, which the scan
  excluded wholesale. A bug in the scan, not a finding.

Comment-stripping is mandatory for this scan and was nearly missed: the
explanatory comment added alongside the fix wraps `legacy_business` in
backticks, which the scan would have counted as a reader — silently passing on
the exact bug it exists to catch. Prose must never satisfy a wiring check;
that is *how* #6 survived an earlier pass in the first place.

### Open for the owner

**`legacy_business` needs a product decision.** Every option changes design:
gating inheritance removes behaviour players have today and undoes a
deliberate bug fix; deleting the bonus strands spent points; giving it a new
effect is designing a feature. The shop now states it has no effect, so no
further player is charged for nothing while the decision is open.
