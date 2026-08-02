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

### 2A — HIGH: `wantedLevel`

38 references in logic, **0 in any component**. It gates police/crisis events
(`engine.ts:196,211`) and it **quadruples** the personal-crisis rate:
`personalCrises.ts:432` returns `0.2` when wanted, `0.05` when not.

A 4× swing in how often bad things happen, with no indicator anywhere. Note the
dark web has a *separate*, visible `heat` stat (`lib/darkweb/heat.ts` says it
"replaces the binary wantedLevel"), so a player reasonably assumes heat is the
whole picture. It is not.

**Open question for the owner:** is a hidden wanted level deliberate (you should
not know how hot you are)? If so it needs no fix — but then the 4× crisis swing
should probably be softened, because an unknowable modifier that large reads as
random bad luck.

### 2B — HIGH: `criminalXp` / `criminalLevel` progression

18 refs, 0 in UI. The player levels up a criminal track with no progress
display.

### 2C — MEDIUM: protection the player cannot check

`diseaseImmunities` (8 refs), `vaccinations` (13 refs) — both drive real
outcomes; neither is visible. A player who paid for a vaccination has no way to
confirm they have it.

### 2D — MEDIUM: `legacyBuffs` (8), `dynastyStats` (6)

Heir bonuses and dynasty totals, invisible. This is the prestige loop's payoff.

### 2E — LOW: status flags with no surface

`weeksInPoverty`, `bankruptcyTriggered`, `totalHappiness`, `healthWeeks`,
`zeroStatType`, `discoveredSecrets`, `retiredAtWeek`, `escapedFromJail`,
`computerPreviouslyOwned`, `lastDivorceWeek`, `socialPosts`, `seasonalEvents`

Several are internal bookkeeping and correctly invisible. Each needs a one-line
judgement rather than a blanket fix.

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
