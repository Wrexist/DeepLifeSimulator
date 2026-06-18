# DeepLife Simulator — Consolidated Master Punchlist (2026-06-18)

**Sources merged:** three deep audits (crash/stability, game-state/save, exploit/balance) salvaged from
orphaned background agents → `tasks/salvaged-audits/*.md`; the `roadmap-2026-06-15.md` P0 launch blockers;
and the fixes already landed this session (git log).

---

## ⚠️ Headline finding — CORRECTED 2026-06-18 after source verification

> **Original claim (WRONG):** the audits surfaced "9 new P0 _code_ bugs" contradicting the roadmap's
> "code-ready" assessment.
>
> **Source verification of all 9 found 0 genuine P0s** (per-item analysis in `tasks/todo.md` → ACTIVE
> SPRINT). The audit reasoned abstractly about React semantics (StrictMode double-invoke, "async setState
> races", `MAX_SAFE_INTEGER`) **without accounting for the codebase's existing mitigations** — pre-rolled
> RNG (`GameActionsContext.tsx:359`), id-deduped notifications (`:1599`), and in-place `repairGameState`
> copy-back (`saveValidation.ts:894`) — or realistic value ranges.
>
> **The 2026-06-15 roadmap's "code-ready; every release blocker is ops/config" assessment STANDS.** The real
> launch blockers are the L1–L6 ops items in **§B**. The §A "P0" list below is retained as the audit's *raw
> leads* but is **re-graded to P2/P3**: Batch 1 (C2/C3/C4) hardening is done (commit `efd3e3b`); the rest are
> optional polish (C8 `totalMoneyEarned`, C5 fold-XP-into-updater, C9 unify-with-`acceptAcquisition`, B2
> stable notif ids). Original §A text left intact below for traceability.

---

## A. P0 — NEW code bugs (must fix or consciously accept before ship) — *I can fix these*

| # | Bug | File:Line | Audit | Impact |
|---|-----|-----------|-------|--------|
| P0-C1 | `nextWeek` mutates outer-scope `deathTriggered` / `stateUpdateError` / `applied` / `pendingNotifications` **inside** the `setGameState` updater → StrictMode double-invoke | `GameActionsContext.tsx:349–1577` | Crash A1 | **Spurious double-deaths, duplicate toasts, swallowed errors.** The systemic one. |
| P0-C2 | Relationship `.map().filter(rel => rel !== null)` still leaks nulls downstream | `GameActionsContext.tsx:890` | Crash A2 | `Cannot read properties of null` crash mid-week-tick |
| P0-C3 | `vehicleAccident[vehIdx]` out-of-bounds when player owns >10 vehicles | `weekly/applyVehicles.ts:57–59` | Crash A3 | `NaN` permanently poisons health/stats; UI shows "NaN" |
| P0-C4 | `diseaseComplication[index]` out-of-bounds (pre-roll sized 20) | `weekly/applyDiseases.ts:181,210` | Crash A4 | Same NaN-poisoning class |
| P0-C5 | `gainCriminalXp`/`gainCrimeSkillXp` are non-atomic separate `setGameState` calls **and the caught path still grants XP** | `actions/JobActions.ts:387–392` | GameState P0-1 (+Exploit B-4/E-1) | Caught criminals gain XP; double-fire on double-tap |
| P0-C6 | `autoFixStats` mutates the live state object in-place (no clone) | `utils/saveValidation.ts:277,287` | GameState P0-2 | Corrupts React state without a re-render |
| P0-C7 | `saveGame` re-validates `gameStateRef.current` **after** an async `setGameState` repair → reads stale state | `GameActionsContext.tsx:205–215` | GameState P0-3 (+Crash C7) | False "cannot be repaired"; persists stale state |
| P0-C8 | Lucky/streak weekly bonuses bypass `updateMoney` → skip `MONEY_CEILING` + `totalMoneyEarned` | `GameActionsContext.tsx:1113,1126` | Exploit A-1 | Can exceed money ceiling (save-corruption vector); wrong lifetime stats |
| P0-C9 | `launchIPO` uses 3 separate `setGameState` calls (overlay / cash / reputation) | `actions/HustleActions.ts:558–584` | Exploit A-2 | IPO raise can be lost or double-applied |

> **§A trio source-verified 2026-06-18 — the only code-column items left after the P1/P2/§D sweeps.**
> All three are GENUINE-but-low-priority and entangled with refactors, so they're deferred (not auto-fixed):
> - **C5** (`JobActions.ts:393-396`) — minor: `deps.gainCriminalXp(10)` / `gainCrimeSkillXp` run OUTSIDE
>   `doStreetJob`'s updater (which closes at :390), so they're NOT covered by the P1-1 energy guard — a
>   same-batch double-tap double-grants XP, and the caught path still grants it. Fix = fold both dep
>   callbacks into the main updater (duplicates the leveling logic). XP-only, not money. Polish.
> - **C8** (`GameActionsContext.tsx:1113,1126`) — extreme-edge: the weekly tick adds lucky/streak bonuses
>   with `Math.max(0, …)` and NO `MONEY_CEILING` clamp (the file imports no ceiling). Same class as the
>   P1-2 fix, but reachable only near the ceiling (bonuses scale off weekly income). A correct fix is ONE
>   final-money clamp after ALL the tick's money mutations — entangled with the 1,475-line monolith (H3);
>   a local lucky/streak clamp would be only partial (false confidence). Defer with H3.
> - **C9** (`HustleActions.ts:559`) — `launchIPO` uses separate setState calls; assessed during P1-14 and
>   left as-is: an IPO only RAISES money so its updater never bails → no lost/partial-raise window in
>   practice. StrictMode-atomicity polish.

---

## B. P0 — Ops/config launch blockers (L1–L6) — *needs YOU (accounts/secrets/ops)*

| # | Blocker | File:Line | Action |
|---|---------|-----------|--------|
| L1 | IAP verify backend missing — `verifyReceiptWithServer` fails closed when `EXPO_PUBLIC_IAP_VERIFY_URL` unset → **every purchase refused** | `services/IAPService.ts:279-287` | Stand up RevenueCat or a verify endpoint; set URL+token as EAS secrets |
| L2 | AdMob ships Google **TEST** ad-unit IDs → $0 revenue + likely store rejection | `services/AdMobService.ts:102-122` | Set 6 `EXPO_PUBLIC_ADMOB_*_{IOS,ANDROID}` EAS secrets |
| L3 | `EXPO_PUBLIC_SAVE_HMAC_KEY` must exist and **never rotate** post-launch | `utils/saveValidation.ts:111-122` | Generate once, set as EAS secret, document as prod-critical |
| L4 | Leaked Google Play service-account key in git history | backlog:101 | Rotate in GCP IAM, purge via `git filter-repo`, force-push |
| L5 | Privacy policy says AdMob "Currently disabled" while builds can ship ads | `UPDATED_PRIVACY_POLICY.md:31,152` | Launch ads-off OR update policy first |
| L6 | CI preflight non-blocking (`continue-on-error: true`) + missing Android ad-unit vars | `.github/workflows/eas-build.yml:61-69` | Mirror secrets to GH Actions, add Android vars, flip to hard gate |

> **Verified 2026-06-18 (code-assistable parts):**
> - **L1** — no code change needed: `verifyReceiptWithServer` (`IAPService.ts:415`) **already fails closed**
>   in production when the URL is unset. Pure ops: deploy a verify endpoint + set `EXPO_PUBLIC_IAP_VERIFY_URL`.
> - **L2** — ✅ **code-hardened** (commit below): production no longer falls back to Google test ad IDs
>   (unset env → no ad). You STILL must set the 6 `EXPO_PUBLIC_ADMOB_*` EAS secrets for ads to actually serve.
> - **L6** — the 3 Android ad-unit vars are **already in the workflow** (`eas-build.yml:82-84`); only the
>   `continue-on-error: true` → hard-gate flip remains, and it must happen AFTER you mirror the EAS secrets
>   into GitHub Actions secrets (else every CI run fails). One-line change, ops-gated — not safe to do now.
> - **L3/L4/L5** — ops only (HMAC key generation, leaked-key rotation, privacy-policy alignment).

---

## C. P1 — code (de-duplicated across audits) — *I can fix these*

| # | Bug | File:Line | Audit |
|---|-----|-----------|-------|
| P1-1 | Energy check on stale snapshot, not re-checked in updater → double-tap runs 2 jobs for 1 energy | `actions/JobActions.ts:59–64,377` | GameState P1-1 = Exploit B-2 |
| P1-2 | `batchUpdateMoney` missing `MONEY_CEILING` clamp | `actions/MoneyActions.ts:163` | Exploit B-1 |
| P1-3 | `cancelEngagement`/`checkAnniversary` apply happiness via separate `setGameState` (double-penalty under StrictMode) | `actions/DatingActions.ts:1006,1060` | GameState P1-2 |
| P1-4 | Jail-activity success uses bare `Math.random()` outside updater | `JobActionsContext.tsx:270` | GameState P1-3 |
| P1-5 | Legacy `startWeek` cyclic value can inflate staking payout massively on first claim | `actions/MiningActions.ts:464–466` | GameState P1-4 |
| P1-6 | `crimeSkills` missing `?.` guard → crash on legacy saves pre-repair | `actions/JobActions.ts:119,458` | Crash B3,B4 |
| P1-7 | `stateUpdateError` checked synchronously after async `setGameState` → real errors swallowed | `GameActionsContext.tsx:1587` | Crash B1 (P0-C1 family) |
| P1-8 | `pendingNotifications` length-based IDs survive dedup → duplicate toasts | `GameActionsContext.tsx:355–1582` | Crash B2 |
| P1-9 | `IAPService.initialize()` busy-wait spin loop with no timeout | `services/IAPService.ts:552–555` | Crash B6 |
| P1-10 | Out-of-range stats are warnings (not errors) when `autoFix=false` → tampered saves load clean | `utils/saveValidation.ts:986–1009` | Exploit C-1 |
| P1-11 | `batchUpdateMoney` concatenates reasons → `NON_INCOME_REASON` regex mis-fires on combined string | `MoneyActionsContext.tsx:141–151` | Exploit C-2 |
| P1-12 | `repairGameState` shallow-merge preserves tampered numeric fields (e.g. credit score 850) | `utils/saveValidation.ts:457–467` | Exploit C-4 |
| P1-13 | `unemployedBonus` (1.5×) farmable via quit→8 jobs→rehire, no cooldown | `actions/JobActions.ts:156–159` | Exploit B-5 (balance) |
| P1-14 | `resolveScandal`/`fireNamedHire` reputation grant fires even when money updater returns `prev` | `actions/HustleActions.ts:514,307` | Exploit D-5 |
| P1-15 | Periodic relationship repair re-renders / risks infinite repair loop every 10 weeks | `GameActionsContext.tsx:1667–1683` | Crash B7 |
| P1-16 | `applied` achievement flag mutated in updater → possible double gold-claim record | `GameActionsContext.tsx:2238` | Crash B5 (P0-C1 family) |

> **Verified 2026-06-18 — all 16 source-checked (3 parallel agents + orchestrator confirmation).** Same
> over-grade pattern as §A: only **2 genuine** bugs, now FIXED.
> - ✅ **P1-14** (FIXED) — reputation granted outside the bailing money updater. Extended to
>   **acceptAcquisition:630** (`+3`, audit missed it); folded resolveScandal/fireNamedHire/acceptAcquisition
>   reputation into the atomic updater via `withReputationDelta`. Regression test added. `launchIPO` left
>   as-is (an IPO raises money → its updater never bails).
> - ✅ **P1-9** (FIXED) — unbounded IAP-init spin-wait now capped at 15s, then proceeds with current state.
> - ✅ **P1-8** — already fixed (the lone length-based notif id, commit `6705853`).
> - **MITIGATED (not genuine):** P1-3 (dead code + pure-updater commit-once), P1-4 (event handler, not
>   render-phase), P1-5 (week-vs-weeksLived guard present), P1-6 (load-merge populates `crimeSkills`), P1-7
>   (synchronous updater), P1-10 (load uses `autoFix=true`), P1-15 (idempotent guarded repair), P1-16
>   (idempotent in-updater dedupe).
> - **NEEDS-DECISION (balance/policy) — RESOLVED 2026-06-18:**
>   - ✅ **P1-1** (FIXED) — energy is now re-checked against fresh `prev` inside BOTH street-job updater
>     branches (caught + not-caught), so a same-batch double-tap can't run two jobs on one job's energy; the
>     2nd same-batch tap no-ops (mirrors the existing in-updater weekly-cap re-check). Regression test added.
>   - ✅ **P1-2** (FIXED, prior commit) — `batchUpdateMoney` module form clamps to `MONEY_CEILING`.
>   - ✅ **P1-11** (FIXED) — hook `batchUpdateMoney` now classifies each leg individually (income vs
>     non-income groups) instead of joining all reasons into one string, so `totalMoneyEarned` only counts
>     genuine income and a non-income keyword in one leg no longer poisons the whole batch. Test added.
>   - ✅ **P1-13** (NO CHANGE — working as designed) — the quit→farm→rehire "exploit" is net-negative:
>     `quitJob` clears `currentJob` immediately (forfeiting career salary) and `applyForJob` only marks the
>     career *pending* — `applyCareerApplications` re-accepts it 1–2 weeks later and ONLY while unemployed.
>     The farmer loses 1–2 weeks of (much larger) career salary to gain `8 × 0.5 × street-base-pay`. The
>     1.5× is intended poverty-relief for the genuinely unemployed (capped 8/week); a cooldown would harm it.
>   - ✅ **P1-12** (FIXED, bounded) — `repairGameState` now clamps `banking.creditScore.score` to the real
>     FICO range [300, 850] (NaN→650). The broader "clamp every nested numeric" is DECLINED: the credit-score
>     *effect* is already clamped at consumption (`amortization.ts:84`) and the eligibility gates gain nothing
>     above a legit 850, so the exploit was already neutralized — this just keeps the persisted value honest.

> **C-3 (security):** `EXPO_PUBLIC_SAVE_SIGNATURE_KEY` is inlined into the client bundle (any `EXPO_PUBLIC_*`
> is), defeating the signature scheme; keyed-CRC32 is not cryptographic. Part-code, part-ops — see §G.

---

## D. P2 — code (notable; full lists in salvaged audits) — *I can fix these*

- **Dead-player guards missing** on stocks/crypto/banking/dark-web actions — a dead player can keep trading. `StockActions.ts`, `CryptoTradingActions.ts`, `BankingActions.ts`, `CrimeActions.ts` (Exploit E-2)
- **Poverty soft-lock** — zero energy + zero money + no career = no viable action. `JobActions.ts:59` (Exploit F-2)
- `date.week` validated as `>=0` instead of `1–4`; diverges from `stateInvariants.ts`. `saveValidation.ts:1044` (GameState P2-2)
- `sparkApp.lifetimeStats` partial object not deep-merged on repair → runtime crash. `saveMigrations.ts:327` (GameState P2-3)
- Lucky-bonus week + streak cap are deterministic/predictable; `hireCandidate` 50–70 roll brute-forceable by salary. (Exploit D-1/D-2/D-4)
- `acquireNewIdentity` BTC=0 waives entire debt-settlement fee. `CrimeActions.ts:240` (Exploit D-3)
- Multiple `require()` calls inside `setGameState`/weekly tick (uncaught throw kills the tick). `applyIncome.ts:101`, `JobActions.ts:122`, `applyMiningCryptos.ts:28`, `haptics` in `loadGame:2913` (Crash C1/C2/C3, Exploit E-3)
- `severities[Math.floor(r*len)]` can index out-of-bounds when r=1.0. `applyVehicles.ts:59` (Crash C6)
- v19 no-op migration not in `NO_OP_MIGRATION_VERSIONS`; redundant `state.version` assign. `saveMigrations.ts:30,517` (GameState P2-5)
- Crypto tick `Math.random()` inside updater → phantom orders under StrictMode. `GameActionsContext.tsx:1227` (Crash C9)
- Post-tick `setTimeout(50ms)` state-settle hack. `GameActionsContext.tsx:1637` (Crash C5)
- AdMob/IAP listener-leak + module-level timer edge cases. `AdMobService.ts:341`, `IAPService.ts:80` (Crash C4/C8)

**Counts:** Crash audit 9×P2 · GameState audit 5×P2 · Exploit audit ~9×P2.

> **Spot-verified 2026-06-18 (highest-value items) — same over-grade pattern; all MITIGATED / non-issues:**
> - **E-2** dead-player trading — MITIGATED: `showDeathPopup` is a blocking full-screen modal
>   (`DeathPopup.tsx:266`), tab content gated (`(tabs)/_layout.tsx:180`), only exits are new-life/revive
>   (both make you alive again). No dead-but-trading window (same class as P1-1).
> - **D-3** acquireNewIdentity fee waiver — NON-ISSUE: `CrimeActions.ts:242` `btcPrice > 0 ? … : 0` is a
>   div-by-zero guard; BTC price is market-driven, never 0 in play → the waiver branch is unreachable.
> - **C1/C2/C3/E-3** require()-in-tick — NON-ISSUES: `applyIncome.ts:101` is a static-data require (can't
>   throw; the try/catch rule is for *native* modules), `applyMiningCryptos.ts:28` is module-level (not
>   tick-time at all).
> - **P2-3** sparkApp.lifetimeStats — MOSTLY MITIGATED: real file is `utils/saveMigrations.ts:327`, which
>   replaces a missing/non-object lifetimeStats with a full default; the partial-object edge yields
>   undefined reads (tampered saves only), not the claimed crash. Over-graded.
>
> Remaining §D items un-swept, but the cumulative genuine-rate (0/9 §A, 2/16 §C, 0/4 §D-spot) makes further
> grinding low-value.
>
> ✅ **Defensive-hardening bundle LANDED** (commit below; all tested, 594 passing):
> - **E-2** — 13 action-level death guards (`if (prev.showDeathPopup) return prev;`) across the immediate
>   money-movers in stocks/crypto/banking/dark-web (buy/sell, deposit/withdraw/transfer/card, listing/mixer/
>   cashout/new-identity). Defense-in-depth; UI was already gated.
> - **P2-3** — `saveMigrations` v15 now deep-merges `sparkApp.lifetimeStats` (backfills partial objects).
> - **P1-2** — `batchUpdateMoney` (module form) now clamps to `MONEY_CEILING` (parity with the sibling paths).
>
> ✅ **Final remaining-code sweep 2026-06-18 — verified & closed (evidence-based; same over-grade pattern):**
> - **P1-12** (FIXED) — credit-score clamp on repair (above); broader clamp-all DECLINED (effect already
>   clamped at consumption, gates gain nothing above 850).
> - **Crash C6 / P0-C3** (vehicle-accident OOB) — ALREADY FIXED: `applyVehicles.ts:61-65` wraps the index
>   (`vehIdx % len`) and clamps the severity pick (`Math.min(len-1, …)`).
> - **Crash C4** (disease-complication index) — NON-ISSUE: scalar `complicationRoll` + the R4-G compounding
>   cap (`applyDiseases.ts:182-198`); no array-index OOB.
> - **P2-5** (v19 in `NO_OP_MIGRATION_VERSIONS`) — BY DESIGN: v19 is a deliberately *registered* migration
>   (HMAC-key rotation boundary, `saveMigrations.ts:502-521`), not a no-op version; moving it would break the
>   legacy-signature fallback loader.
> - **P2-2** (date.week 1–4) — NO CHANGE: `week` is UI-only and self-heals each tick (`weeksLived` is the
>   authoritative counter); tightening the load validator risks mishandling edge saves for ~zero value.
> - **C-3** (signature key in bundle) — NO MEANINGFUL CLIENT FIX: the exploitable weak-migration window is
>   already closed in prod by default (`ALLOW_WEAK_SAVE_MIGRATION = isDev || env==='true'`,
>   `saveSigningConfig.ts:46`); client-side signing is inherently in-bundle (Expo has no non-public runtime
>   var) and the legacy `SAVE_SIGNATURE_KEY` is load-bearing for the v19 rotation. Accepted design
>   (tamper-evidence, not cryptographic); real integrity = server-side validation (ops, same class as L1).

---

## E. Already FIXED this session (git log on `claude/awesome-euler-jaf2z2`)

| Fix | Commit | Roadmap ref |
|-----|--------|-------------|
| Premium Pack money multiplier was inert ("paid upgrade does nothing") → sets `goldUpgrades.multiplier` | `de87081` | H7 |
| Three divergent IAP entitlement-apply paths consolidated onto one helper (drift = root cause of H7) | `91c9164`,`222d8d7` | H6 |
| Instant money/stat display + removed intrusive blue action modal | `4e8b609` | — |

(Plus test additions: UI render-test suite `ba6d285` (H2 start), save-durability stress tests `554dd29` (H4/H5).)

---

## F. Root-cause theme (why this matters)

At least **7** of the new findings (P0-C1, P0-C5, P0-C7, P0-C8, P0-C9, P1-1, P1-3, P1-4, P1-7, P1-8, P1-16)
are the **same anti-pattern**: state, side-effects, RNG, or error flags computed/mutated **outside** the
one atomic `setGameState(prev => …)` updater. React 19 / StrictMode invokes updaters twice and batches
state, so anything outside the updater double-fires, reads stale `prev`, or is silently discarded.

**Implication:** the earlier 6 audits passed the economy/save layers as "hardened," but they didn't model
the React-19 double-invoke semantics — which is exactly where these bugs live. A single disciplined sweep
("fold every side-effect into the updater; pre-roll all RNG; derive flags from returned state") closes most
of P0/P1 at once.

---

## G. Split — who does what

**I can do in code (no accounts needed):**
- All of §A (9 P0 code), §C (16 P1), §D (P2) — bounded, file-local fixes.
- The code half of C-3: stop using `EXPO_PUBLIC_SAVE_SIGNATURE_KEY`; move to a non-public HMAC path.

**Needs YOU (accounts / secrets / ops):**
- §B L1–L6 entirely: RevenueCat/verify endpoint, AdMob IDs, HMAC key, leaked-key rotation+purge, privacy
  policy, CI secret mirroring + hard gate.
- The ops half of C-3: confirm which keys are exposed in the bundle and rotate.

---

## H. Recommended next step

1. **Me, now:** start a P0-code fix sprint, sequenced by the §F root cause — lead with **P0-C1** (the
   `nextWeek` side-effect-in-updater bug; fixes double-death + duplicate toasts + swallowed errors), then
   the out-of-bounds NaN crashes (P0-C3/C4), then the save-path P0s (P0-C6/C7), then the economy P0s
   (P0-C5/C8/C9). Plan-mode + `tasks/todo.md`, per CLAUDE.md. Run `npm run preflight:quick` between batches.
2. **You, in parallel:** the L1–L6 ops checklist — these gate a monetizing, store-compliant build and I
   can't do them.

> **Revised launch read:** *not* "code-ready, ops-only." It's "**~9 P0 code fixes + the L1–L6 ops
> checklist** stand between here and a safe monetizing build." The code half is mine; the ops half is yours.
