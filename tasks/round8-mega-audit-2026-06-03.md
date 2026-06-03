# Round 8 — Mega-Audit & Remediation Plan (2026-06-03)

> **Method:** 11 parallel domain audits (save/persistence, core loop, actions/exploits, contexts/perf,
> tab UI, onboarding, sub-app completeness, monetization, iOS-26 crash safety, security/CI/network,
> balance/content). Every prior-round claim was **re-verified against current `main`** — many are
> already fixed; only open items are listed. **No code changed this round** — this is the plan.
>
> **Objective health (verified this session):**
> - `npm run type-check` → **0 errors, exit 0** (CI type gate is green).
> - iOS-26 crash classes (expo-linear-gradient / expo-blur / direct AsyncStorage / frozen Suspense popups) — **all closed.**
> - IAP receipt verification fails closed in prod; ATT plugin present; native config aligned.
>
> **Two corrections to prior rounds (important):**
> 1. **`STATE_VERSION` is 19**, not 18 (canonical at `contexts/game/initialState.ts:6`). CLAUDE.md is stale.
> 2. **The HMAC key is NOT committed to git.** `.env` is gitignored and was never tracked; a full
>    history scan finds nothing. Prior rounds (SB-1) mischaracterized this as a committed-secret CRITICAL.
>    Real status: a local at-rest dev secret, and since it's `EXPO_PUBLIC_*` it ships in the bundle by
>    design anyway → it's an anti-tamper checksum, not a confidential key. Downgraded to LOW.

---

## Severity tally

| Sev | Count | Theme |
|-----|-------|-------|
| CRITICAL | 1 | IAP save-path mutex deadlock + lock corruption |
| HIGH | 16 | economy exploits, compliance, save integrity, a dead game pillar, fake UI affordances |
| MEDIUM | ~22 | correctness, balance, half-wired features, perf |
| LOW / cleanup | ~30 | dead code, theming, schema drift, CI hardening |

The single most urgent item is **C-1** (corrupts slot writes on every purchase). After that, the
economy-exploit cluster (Phase 1) and the compliance cluster (Phase 0) are the gating concerns for a
healthy, submittable build.

---

## ✅ Execution log — fixes applied & verified (2026-06-03)

| Item | Sev | Fix | Verification |
|------|-----|-----|--------------|
| **C-1** | CRITICAL | `forceSave` now takes `manageMutex` (default `true`); `saveGame` passes `false` since it already holds the lock — kills the nested-acquire deadlock + watchdog double-release. (`utils/saveQueue.ts`, `contexts/game/GameActionsContext.tsx:263`) | new `__tests__/utils/forceSaveMutex.test.ts` 4/4 · IAP+save stress 32/32 · type-check 0 |
| **H-7** | HIGH | Perks "Start Your Life" wrapped in synchronous `startInFlightRef` guard + `disabled={isStarting}` (mirrors SaveSlots). (`app/(onboarding)/Perks.tsx`) | onboarding stress 18/18 · type-check 0 |
| **H-8** | HIGH | Gem-spend exploit: folded the gem debit INTO each granting updater with an atomic reject across 4 sites — `boostProfile`, `rewindLastSwipe` (Spark), `boostPostWithGems`, `recoverFromScandal` gems path (Pulse). Root cause = `clampStatByKey` clamps gems instead of rejecting. | new `__tests__/actions/gemSpendExploits.test.ts` 3/3 · social 83-suite green |
| **H-9** | HIGH | `sellItem` double-sell printer — added in-updater ownership re-check + dead-state guard. (`ItemActions.ts`) | new `__tests__/actions/itemActionExploits.test.ts` 3/3 |
| **H-10** | HIGH | `performHack` spam — in-updater energy re-check + dead-state guard (RNG kept outside the updater). (`ItemActions.ts`) | same test ✓ |
| **M-1** | MED | Disease death now sets `deathTriggered` (skips post-death automation/save) + stops clobbering an earlier death reason. (`GameActionsContext.tsx:1001`) | type-check · realProviderLoop soak 7/7 |
| **M-2** | MED | `nextWeek` refuses to advance while `showDeathPopup` is up. (`GameActionsContext.tsx:286`) | exposed advance-through-death in the soak test → updated `realProviderLoop.stress.test.ts` to keep the character alive; 7/7 green |
| **M-batch-B** | MED | Pulse brand deals now pay real money: `acceptBrandDeal` credits the 25% signing bonus (was a `prev=>prev` no-op); `deliverBrandDealPost` pays the remaining installments on early completion (was removing the deal and stopping the tick's weekly pay). (`PulseActions.ts`) | new `__tests__/actions/brandDealPayout.test.ts` 2/2 · social+lib/social+actions 94-suite green |
| **H-12** | HIGH | Old-age death roll moved OUT of the `nextWeek` updater (pre-rolled before `setGameState`) so React StrictMode can't double-fire the death decision. (`GameActionsContext.tsx:349,806`) | type-check 0 · realProviderLoop soak (covered) |
| **H-2** | HIGH | Migration chain no longer silently stamps the version forward for an unregistered version — `NO_OP_MIGRATION_VERSIONS` allowlist (2–9, pre-baseline) preserves existing upgrades; a future forgotten migration HALTS (recoverable) instead of permanently corrupting. Added `isMigrationVersionCovered` CI guard. (`utils/saveMigrations.ts`) | new `__tests__/utils/migrationRegistry.test.ts` 4/4 · longRunSaveLoad+lib/progress 30/30 (incl. version-migration test) |

| **M-batch-A** (PetActions) | MED | Added pure `applyMoneyDelta` helper to `MoneyActions` (overdraft-reject + daily-summary, foldable into one updater). Converted all 5 PetActions purchases (`buyPet`/`buyFood`/`buyToy`/`payForVet`/`enterCompetition`) to atomic debit+grant — a double-tap can no longer get free pets/goods. | new `__tests__/actions/petPurchaseRace.test.ts` 3/3 · petSystemFlow stress 19/19 |

**Tally so far: 1 CRITICAL + 6 HIGH + 4 MEDIUM fixed, all with regression tests. Type-check stays at 0 errors.**
M-batch-A remaining modules (ContentActions, FamilyBusinessActions, HustleActions, TravelActions, RDActions) are now fast to convert with `applyMoneyDelta` in place.

### Self-review pass (2026-06-03)
- **Fixed a latent React bug in the M-batch-A/B code:** the first draft read a flag (`bought`/`paidBonus`/`completionPayout`) synchronously right after `setGameState`, which React does not reliably run synchronously. Rewrote PetActions to return optimistically (matching `buyItem`/`feedPet`) and folded the brand-deal credits INSIDE their updaters via `applyMoneyDelta` — now fully atomic, no post-`setState` read. Tidied 2 pre-existing dead type imports in PulseActions.
- **Caught + fixed a test regression:** the full suite surfaced `educationFlow.stress.test.ts` failing — M-2 working correctly (60 weeks of unmanaged education stress drives health to 0; a dead character no longer ticks, so fewer exams fire than the hardcoded count). Applied the same keep-alive fix used for `realProviderLoop`. Verified the pattern is contained: only progression-count tick-loop tests are affected (realProviderLoop + educationFlow, both fixed); validity/finiteness tests (diseaseLifecycle, achievementsFlow, …) are death-tolerant.
- **Verification (final):** `tsc` type-check **0 errors** · eslint **0 errors** on changed files · **full test suite 2341/2341 passing (145 suites, jest exit 0)** · 7 new regression test files. Clean.
Remaining unblocked: **H-1** (block NaN/Infinity/age-overflow saves — touches Protected `saveValidation.ts`), rest of **M-batch-A**. Decision-gated (answers captured): Political wiring, ads compliance, quick-actions.

**Product decisions (2026-06-03):** ads DO ship → do H-3/H-5/H-4 (policy + ATT consent + wire rewarded ad); TopStatsBar quick-actions → **wire to real effects** (H-15); Political app → **wire into Office tab** (H-13).

Still open & unblocked (no product decision needed): H-1/H-2 (save-validation NaN-block + migration-bump guard), M-batch-A (grant-then-charge purchases), the Phase 2 determinism (`Math.random` in tick H-12), Phase 6 cleanups.
Decision-gated items above are now unblocked too (answers captured); queued behind the remaining correctness fixes per the "keep fixing unblocked bugs" directive.

---

# PHASE 0 — Release-blockers: data integrity + store compliance
*Goal: nothing that corrupts saves or risks an App Store / Play / privacy rejection. Do first.*

### C-1 [CRITICAL] Re-entrant mutex deadlock on every IAP, then lock corruption — **VERIFIED**
- **Files:** `contexts/game/GameActionsContext.tsx:186` (outer acquire) → `:263` (`await forceSave` while held); `utils/saveQueue.ts:297` (inner acquire of the **same** singleton); `utils/saveLoadMutex.ts:66-102` (watchdog force-release → `queue.shift()` re-grants while original holder's `finally` at `GameActionsContext.tsx:273` still calls `release()`).
- **Reached by:** `components/IAPHandler.tsx:58` → `saveGame(true)` on every gem/remove-ads/premium purchase.
- **Impact:** Purchase save blocks 30 s on the watchdog; the forced release then hands the lock to the queued `forceSave` while `saveGame`'s `finally` double-releases it → a concurrent autosave/load can write the same `save_slot_N` buffers unguarded → torn double-buffer flips, cross-character contamination, "purchase didn't save."
- **Fix (pick one):**
  1. **Make `saveGame` not hold the lock across `forceSave`** — when `force`, release the mutex before `await forceSave(...)` (forceSave self-guards), OR
  2. **Make the mutex re-entrant** — `acquire()` returns an owner token; `release(token)` is a no-op unless the token matches; the watchdog invalidates the token so the stale `finally` release is ignored; on a *forced* release, reject queued waiters with the timeout error instead of silently granting them the lock.
- **Verify:** unit test that calls `saveGame(true)` and asserts it resolves in <100 ms (not 30 s) and that `saveLoadMutex.isHeld()` is false afterward; integration test: purchase + concurrent autosave, assert slot content matches the merged result.
- **Effort:** 2–3 h. **Do this first.**

### H-1 [HIGH] `validateGameState` lets NaN/Infinity/impossible-age saves load; load path ignores invalid anyway
- **Files:** `utils/saveValidation.ts:1043-1055` (critical-error substring filter excludes NaN/Infinity/age-overflow); `contexts/game/GameActionsContext.tsx:2594-2599` & `:2810` (sets state even when `validation.valid === false`).
- **Impact:** `weeksLived = Infinity`, `gems = NaN`, `age = 9999` are detected but not blocked and not clamped; they load into the live game and propagate NaN through money/age math → soft-lock.
- **Fix:** (1) add NaN/Infinity/age-overflow patterns to the `criticalErrors` filter so they actually block; (2) on load, when validation fails after repair, fall back to a backup (the parse-failure backup path already exists — extend it to validation failure) instead of `setGameState(badState)`.
- **Verify:** load-fixture test with NaN gems / Infinity weeksLived → asserts backup restore, not corrupted live state.
- **Effort:** 2 h.

### H-2 [HIGH] `runMigrations` silently version-bumps unregistered versions (masks a forgotten migration forever)
- **File:** `utils/saveMigrations.ts:569-578` (`state.version = targetVersion` with only a `logger.warn` when `migrations[targetVersion]` is missing).
- **Impact:** If a future `STATE_VERSION = 20` ships without `migrations[20]`, every upgrading save is stamped v20 with v20 fields unpopulated; reloads then skip the missing migration permanently → undetectable corrupted saves to all upgraders.
- **Fix:** In production, an unregistered intermediate version must NOT silently bump — keep the version at the last successfully-migrated value (so a later build with the real migration can finish it) or hard-stop; gate any silent bump behind `__DEV__`; emit to telemetry, not a debug warn. Add a CI check that every integer in `[2, STATE_VERSION]` has a registered migration.
- **Effort:** 1.5 h.

### H-3 [HIGH] Privacy policy says "AdMob disabled" while production enables it — compliance gap
- **Files:** `eas.json:9` (`EXPO_PUBLIC_ENABLE_ADMOB: "true"`) vs `UPDATED_PRIVACY_POLICY.md:31,152` ("Currently disabled", last updated Oct 2025); enable logic `lib/config/featureFlags.ts:18`.
- **Impact:** Published policy materially misrepresents data collection → App Store 5.1.1/5.1.2 + GDPR/CCPA actionable.
- **Fix:** Decide whether ads ship. If yes: update the policy + App Store privacy nutrition labels to declare AdMob + AD_ID + tracking, bump the date. If no: set `EXPO_PUBLIC_ENABLE_ADMOB:"false"` in `eas.json` prod.
- **Effort:** 1 h (+ legal review of copy).

### H-4 [HIGH] AdMob requests never honor ATT / consent (always personalized)
- **File:** `services/AdMobService.ts:205,260` — `createForAdRequest(adUnitId)` with no `RequestOptions`; file never reads ATT status (requested at `app/_layout.tsx:1026` then discarded).
- **Impact:** When the user denies ATT (iOS) or withholds GDPR consent (EU), the app still requests personalized ads → textbook 5.1.2 / GDPR violation, common enforcement reason.
- **Fix:** Read ATT/consent and pass `createForAdRequest(adUnitId, { requestNonPersonalizedAds: true })` when not granted; ideally wire Google UMP / `setRequestConfiguration`. Gate `BannerAd` the same way.
- **Effort:** 3–4 h.

### H-5 [HIGH] Rewarded "Watch a video ad" grants the reward without showing any ad
- **Files:** `components/mobile/Pulse/modals/RewardedAdModal.tsx:33-41`; reward `contexts/game/actions/PulseActions.ts:1001-1023` (no `adMobService.showRewardedAd` call anywhere).
- **Impact:** UI explicitly promises a video ad, shows none → deceptive-UX / 2.3.1 rejection risk; also forfeits the rewarded-ad revenue the screen is built to earn.
- **Fix:** Route the CTA through `adMobService.showRewardedAd(() => watchAdForFollowerBoost(...))` and grant only on the SDK's `EARNED_REWARD` callback (already gated correctly in `AdMobService.showRewardedAd:299-331`). If ads aren't wired here intentionally, remove the "watch a video ad" copy + play icon.
- **Effort:** 2 h.

### H-6 [HIGH] CI never runs `preflight` → production env enforcement is bypassed in automation
- **Files:** `.github/workflows/eas-build.yml` (no preflight step); `scripts/preflight-check.js` sections 8/9/10 are the only guards for HMAC key / IAP verify URL+https / real AdMob IDs.
- **Impact:** A prod build can ship from `main` with test ad IDs (zero ad revenue), no IAP verify URL (purchases silently refused), or no HMAC key — none caught before EAS Build.
- **Fix:** Add a `Preflight (production env)` step to `eas-build.yml` *before* `eas build`, sourcing prod env from GitHub/EAS secrets; fail the job on non-zero exit. Also add `npm test -- __tests__/startup --ci` to `eas-update.yml` before the production OTA push (it currently pushes to live users with no smoke gate — see M-batch).
- **Effort:** 2 h.

### H-7 [HIGH] Perks "Start Your Life" has no double-tap guard → duplicate game build + save/load race
- **File:** `app/(onboarding)/Perks.tsx:167` (`start`), button `:716` (no `disabled`, no ref lock). `SaveSlots.tsx:72` already has the correct `continueInFlightRef` pattern — never back-ported here.
- **Impact:** Two rapid taps run the full build→`forceSave`→`loadGame` pipeline twice against the same slot with two different random states → racing double-buffer writes can corrupt the brand-new slot.
- **Fix:** Add the synchronous `startInFlightRef` guard + `disabled={isStarting}` (mirror SaveSlots).
- **Effort:** 30 min.

**Phase 0 exit criteria:** C-1 fixed & tested; saves can't load NaN/Infinity; no silent migration bump; CI runs preflight + startup smoke before build/OTA; policy matches config; ATT honored; no fake-ad copy; onboarding start is tap-safe.

---

# PHASE 1 — Economy exploits & money/gem correctness
*Goal: close every repeatable money/gem printer. Root cause = "grant then charge" split transactions + a gem clamp that never rejects.*

### H-8 [HIGH] Gem-spend grants the reward even when the charge clamps to 0 (gem duplication / free premium) — **root cause VERIFIED**
- **Files:** `utils/statUtils.ts:45` (`clampStatByKey` does `Math.max(0, value)` for gems/money — clamps, never rejects); exploited by `SparkActions.ts:534-554` (`boostProfile`), `:235-268` (`rewindLastSwipe`), `PulseActions.ts:898-939` (`boostPostWithGems`), `:474-560` (`recoverFromScandal`).
- **Impact:** Two rapid taps both pass the stale outer gem check, both grant the boost, gems just floor at 0 → 2+ boosts for one payment, or free if balance < cost but > 0.
- **Fix:** Add an `updateGems(setGameState, -cost)` helper that mirrors hardened `updateMoney`: inside the updater, `if (prev.stats.gems < cost) return prev;` then debit. Move the debit into the same `setGameState` that grants the reward. Audit all `gems: -` sites and retire `updateStats({gems:-x})` for purchases.
- **Effort:** 3 h (one helper + ~6 call sites).

### H-9 [HIGH] `sellItem` has no in-updater ownership re-check → double-sell money duplication
- **File:** `contexts/game/actions/ItemActions.ts:164-237` (outer `!item.owned` check only; updater credits `sellPrice` and flips `owned:false` unconditionally). Note `buyItem` *was* patched with an in-updater re-check at `:62-73`; `sellItem` was missed.
- **Impact:** Two same-batch Sell taps both read `owned:true`, both credit `sellPrice`, item flips once → paid twice. Repeatable.
- **Fix:** Inside the updater, `const prevItem = prev.items.find(i=>i.id===itemId); if (!prevItem?.owned) return prev;` (mirror `buyItem`).
- **Effort:** 30 min.

### H-10 [HIGH] `performHack` rolls outside updater, no energy re-check, no dead-state guard
- **File:** `contexts/game/actions/ItemActions.ts:115-162`.
- **Impact:** Spam-tap fires the hack reward repeatedly off a stale energy read (energy only floors at 0); also runs while the death popup is up.
- **Fix:** Re-read `prev.stats.energy` inside the updater and `return prev` if below cost; add `rejectIfBlocked(gameState)` at the top (as `buyItem`/`sellItem` already do).
- **Effort:** 45 min.

### M-batch-A [MEDIUM] "Grant then charge" split transactions give free goods when the charge rejects
- **Files (representative):** `PetActions.ts:36-63,108-147,203-264`; `ContentActions.ts:221-271`; `FamilyBusinessActions.ts:9-107`; `HustleActions.ts:247,295,357,494,607`; `RDActions.ts:404`; `TravelActions.ts:51,229,275`.
- **Impact:** `updateMoney` rejects overdrafts (good — no negative money), but the goods are still added in the separate unconditional `setGameState` → free pet/passport/campaign/acquisition/business under a same-batch double-tap or concurrent spend.
- **Fix:** Fold the debit into the same updater that grants the good, with `if (prev.stats.money < cost) return prev;` — the correct pattern already exists in `buyItem`, `purchaseVehicle`, `createCompany`, `RealEstateActions`. Retire the `updateMoney`-then-grant idiom project-wide.
- **Effort:** ~4 h across modules.

### H-11 [HIGH] Stock dividends paid twice (weekly drip + quarterly lump) — weekly drip **VERIFIED**
- **Files:** `lib/economy/passiveIncome.ts:51-97` pays `annualDividend/52` **every week** into `totalIncome`; `lib/stocks/weeklyTick.ts:93-104` (`computePayouts`) also pays a **quarterly** lump via `cashDelta` (called from `GameActionsContext.tsx:1257-1268`). Both run on the same holdings.
- **Impact:** Dividend stocks yield ~2× nominal → inflates the dominant late-game passive strategy and the dividend displays.
- **Fix:** Pick one system (quarterly-only reads better and is more realistic): remove the stock branch from `passiveIncome.ts:51-147`, let `runStocksWeeklyTick` own dividends.
- **Effort:** 1 h + balance retest.

### M-batch-B [MEDIUM] Pulse brand-deal payments never credit `stats.money`
- **File:** `contexts/game/actions/PulseActions.ts:585-638` (`acceptBrandDeal` adds bonus to `totalEarnings` display only, with a `prev => prev` no-op "pay"); same gap in `deliverBrandDealPost`.
- **Fix:** Call the already-imported `updateMoney(setGameState, bonus, 'Brand deal …')` instead of the no-op.
- **Effort:** 30 min.

**Phase 1 exit:** no action can produce money/gems/goods it wasn't charged for; a stress "spam-tap every purchase 50×" test shows balances conserved.

---

# PHASE 2 — Core loop correctness & determinism

### H-12 [HIGH] 5 `Math.random()` calls inside the `nextWeek` updater (incl. the old-age death roll) — **VERIFIED**
- **File:** `contexts/game/GameActionsContext.tsx:793` (old-age death), `:1189` (crypto), `:1232` (dark-web), `:1265` (stocks), `:1295` (politics).
- **Impact:** React 19 StrictMode double-invokes the updater → these roll differently each pass; the death roll can "die" on the discarded pass, and subsystem outcomes become non-deterministic / save-scummable — contradicting the `buildPreRolls()` determinism used everywhere else.
- **Fix:** Pre-roll these in `actions/weekly/preTick.ts buildPreRolls()` (open index signature already supports it) and thread them in. Minimum: move `:793` to a pre-rolled `preRolls.oldAgeDeath`.
- **Effort:** 2 h.

### M-1 [MEDIUM] Disease death doesn't set the `deathTriggered` flag → post-death processing still runs
- **File:** `contexts/game/GameActionsContext.tsx:997-1000` (sets `newShowDeathPopup` but not the outer `deathTriggered` that gates the early-return at `:1623`).
- **Impact:** A disease-killed player still runs `processAutomationRules` (can spend money) and an extra save cycle that tick.
- **Fix:** add `deathTriggered = true;` in the disease-death block. (Also fixes the cosmetic old-age-vs-disease reason overwrite.)
- **Effort:** 10 min.

### M-2 [MEDIUM] `nextWeek` has no death guard at entry — dead players can keep ticking
- **File:** `contexts/game/GameActionsContext.tsx:281-287` (only guards `nextWeekInProgressRef`).
- **Impact:** If the death modal is bypassed (programmatic/automation/AppState-resume race), a dead character accrues another full week.
- **Fix:** `if (gameStateRef.current.showDeathPopup) return;` at the top, plus a defensive bail inside the updater.
- **Effort:** 20 min.

### M-3 [MEDIUM] Career salary & promotion accrue while jailed
- **Files:** `applyCareerSalaryAndPenalty.ts:46-69`, `applyCareerProgress.ts:61-110`, `applyIncome.ts:56-105` (no `jailWeeks` check; only street jobs are locked out).
- **Impact:** White-collar careers have no jail penalty — collect salary and get promoted from prison.
- **Fix:** Gate salary/career-progress on `!(prevState.jailWeeks > 0)` or apply a jail income penalty.
- **Effort:** 45 min.

### M-4 [MEDIUM] `repairGameState` runs twice on the save path (double deep-clone + stale ref read)
- **File:** `contexts/game/GameActionsContext.tsx:196-206`.
- **Impact:** When any repair triggers, two full `structuredClone`s (30–160 ms hitch) plus a re-validation that reads `gameStateRef.current` synchronously after an async `setGameState` (wrong object).
- **Fix:** Repair once; push the captured repaired object through `setGameState(() => repaired)`; re-validate that captured object.
- **Effort:** 45 min.

### Low-batch-loop
- **Pre-roll arrays cap mechanics** (`preTick.ts:296-310`): 11th+ vehicle never crashes, 21st+ partner never breaks up, etc. Size arrays to collection length. *(LOW)*
- **`loadGame` ignores `runMigrations(parsed).state`** (`GameActionsContext.tsx:2575`) — works by luck today; use the return value. *(LOW, latent)*
- **`repairGameState` stamps `STATE_VERSION` on a version-less save** (`saveValidation.ts:800`) — stamp `1` instead so the next load runs the full chain. *(LOW)*
- **Schema drift:** `lastSaved` written every save (`GameActionsContext.tsx:256`) but absent from `GameState` types. Add `lastSaved?: string`. *(LOW)*

---

# PHASE 3 — Feature completeness (wire the orphaned features)
*Goal: every built-but-unreachable system gets a UI entry point or is explicitly hidden. Sub-app audit: 13/17 apps are 100%; these are the gaps.*

### H-13 [HIGH/MAJOR] Political career progression is completely unreachable from the UI
- **File:** `components/computer/PoliticalApp.tsx:170-172` (Office tab renders a stat summary + dead "use the legacy app" text); actions exist and are imported by **no component** — `PoliticalActions.ts:145` `runForOffice`, `:522` `joinParty`, `:549` `formAlliance`, `:650` `hireLobbyist`. `lib/politics/weeklyTick.ts:43` early-returns while `careerLevel === 0`, so the level never advances on its own.
- **Impact:** Accept the political career → permanent dead end. A whole tested pillar (`lib/politics/*`: elections, parties, PACs, government contracts) is inaccessible.
- **Fix (pure wiring — backend is done):** add Office-tab buttons "Run for office / Join a party / Hire lobbyist / Form alliance" gated by the existing requirement checks; delete the deferral text.
- **Effort:** ~1 day. **Highest-ROI feature fix in the audit.**

### M-5 [MEDIUM] Bank account withdrawal is unreachable (both bank apps)
- **Files:** `components/mobile/BankApp.tsx:145` + dead `{false && …}` block `:371`; `components/computer/AdvancedBankApp.tsx:219` + dead block `:544`. A full withdraw modal exists; `setWithdrawTarget` is never called from any button.
- **Impact:** Money put into checking/savings is one-way (can't manually withdraw to cash).
- **Fix:** Add a withdraw affordance to `AccountRow` (second tap target or deposit/withdraw choice) → `setWithdrawTarget(acct)`; remove the lint-silencer block.
- **Effort:** 2–3 h.

### M-6 [MEDIUM] Education campus events are set in state but never surfaced
- **Files:** flag written `applyEducationProgression.ts:138` / `GameActionsContext.tsx:1498`; cleared by `EducationActions.ts:238` (`clearCampusEvent`) referenced only in a dead `{false && …}` block at `EducationApp.tsx:267`.
- **Fix:** Render a campus-event card/modal when `pendingCampusEventEducationId` is set and call `clearCampusEvent` on dismiss — or cut the feature (remove the flag write + dead block).
- **Effort:** 2 h (as a small study-vs-party choice modal) or 20 min to cut.

### Low-batch-completeness
- **IdentityCard prestige badge is a dead button** (`IdentityCard.tsx:331-350`, empty `onPress`) — wire to the prestige modal or make it a plain `View`. *(MEDIUM-UX)*
- **Orphaned gaming panels** — `components/computer/gaming/{EquipmentPanel,PCBuildPanel,StreamingPanel,VideoPanel}.tsx` imported by nothing; delete or wire. *(LOW)*
- **Contacts Favors tab shows raw `f.contactId`** instead of a resolved name (`ContactsApp.tsx`) — map through `aggregateContacts`. *(LOW)*
- **BTC halving** is a countdown with no mechanical effect (`BitcoinMiningApp.tsx`) — hook to mining yield or hide the countdown. *(LOW)*

---

# PHASE 4 — Economy balance & engagement tuning
*Theme: strong anti-exploit caps exist, but the two biggest intended sinks are computed-for-display-only while one income source is double-paid → the late game drifts into a frictionless idle accumulator.*

### H-14 [HIGH] Lifestyle / cost-of-living maintenance is never charged
- **File:** `lib/economy/lifestyle.ts` (`calculateLifestyleCosts` imported only by display components; zero deductions in the weekly tick).
- **Impact:** The single largest intended late-game money sink does nothing — a $50M player should bleed ~$500k/wk and pays $0.
- **Fix:** Add an `applyLifestyleCosts` weekly reducer that deducts `calculateLifestyleCosts(prevState)` and applies its reputation/relationship effects; wire into the `nextWeek` pipeline.
- **Effort:** ~0.5 day.

### M-7 [MEDIUM] Mining electricity costs are display-only
- **Files:** `lib/economy/expenses.ts:100-176` computes power bills shown in UI; `applyMiningCryptos.ts` never deducts USD electricity; mining yield capped at $100k/wk with no power cost subtracted.
- **Fix:** Subtract per-miner power × $/unit from net mining income (in `passiveIncome.ts` before the cap) or deduct `miningPowerCosts` in a real reducer.
- **Effort:** 2 h.

### M-8 [MEDIUM] Stocks have zero expected return (pure random walk) → crypto strictly dominates
- **File:** `lib/economy/stockMarket.ts:122-193` (`changePercent = z * volatility`, zero drift; crypto has +120%/yr bull drift).
- **Fix:** Add small positive drift, e.g. `changePercent = 0.0015 + z * volatility` (~8%/yr), so buy-and-hold growth stocks have a distinct risk/reward from crypto.
- **Effort:** 30 min + retest.

### M-9 [MEDIUM] Company base income is flat regardless of price (factory dominance)
- **File:** `contexts/game/actions/CompanyActions.ts:25-31` (costs $50k–$2M) vs `:92` (every company starts `weeklyIncome: 2000`).
- **Fix:** Scale `baseWeeklyIncome` ~4% of cost so paybacks are comparable.
- **Effort:** 30 min.

### M-10 [MEDIUM] Careers go irrelevant mid-game; M-11 prestige is a one-shot wall
- **Careers** (`lib/careers/careerData.ts`, weekly reducers): fully passive, top salary ~$6k/wk vs $100k+/wk assets. Fix: scale exec comp with tenure/performance, or gate exclusive late content; add an optional weekly "work shift" interaction.
- **Prestige** (`lib/prestige/prestigeTypes.ts:71`): first prestige needs $10M and +25%/prestige threshold growth offsets the multipliers → most players prestige 0–1×. Fix: lower first threshold to ~$2–3M, make early prestiges feel powerful, add prestige-gated content unlocks (not just stat multipliers).
- **Effort:** careers ~1–2 days; prestige tuning ~0.5 day.

### Low-batch-balance
- **Late-game event frequency floors at 6%/wk with a thin, repeatable general pool** (`lib/events/engine.ts:3138`) — add wealth/age/legacy-gated late pools + a recently-fired cooldown.
- **Daily challenges thin & crime-skewed** (`utils/dailyChallenges.ts:50-280`, 5/6/6 templates) — expand to ~10+/tier, add non-crime variety.
- **`utils/gameBalance.ts` is dead/parallel config** (`DEFAULT_BALANCE` unused; live config is `lib/config/gameConstants.ts` + `lib/economy/*`) — annotate as legacy or delete.

---

# PHASE 5 — UI/UX polish & accessibility

### H-15 [HIGH] TopStatsBar quick-actions are fake (claim effects, change nothing)
- **File:** `components/TopStatsBar.tsx:137-159` (handler), `:399-428` (wiring) — long-press "Eat Healthy / Rest / Socialize / Exercise" each show a toast via `feedbackSystem.success()` but never touch `gameState.stats`.
- **Impact:** A core interactive affordance is purely cosmetic and misleading.
- **Fix:** Wire each to a real `updateStats` (with an energy/money cost), or remove the long-press quick-actions menu entirely.
- **Effort:** 2–3 h to wire; 30 min to remove.

### M-12 [MEDIUM] Home tab icon is the Chrome (browser) logo
- **File:** `app/(tabs)/_layout.tsx:4,105` (`import { Chrome as Home }` → concentric-circle glyph).
- **Fix:** `import { Home }` (drop the `Chrome as` alias) for the house icon.
- **Effort:** 5 min.

### M-13 [MEDIUM] `computer.tsx` sold-redirect effect has a stale/missing dep
- **File:** `app/(tabs)/computer.tsx:114-121` (`currentRoute` read but not in deps).
- **Fix:** add `currentRoute` to deps or drop the clause (the `_layout` `href:null` + render guard already cover it).
- **Effort:** 10 min.

### Low-batch-ui
- **Work tab ships debug text** ("Total jobs / Jobs with illegal=true") in the crime empty-state (`work.tsx:960-965`) — replace with a player hint. *(MEDIUM — visible to players)*
- **`market.tsx` hardcodes colors/sizes** and renders dark item cards in light mode (`itemCard`/`itemCardDark` identical, `:909-923`); also a dead `flatListRef` so tutorial scroll-to-item silently fails (`:179-185`). Route through `useTheme()`/`scale()`/`fontScale()`; switch the list to `FlatList` and attach the ref or drop it.
- **`progression.tsx`** is hardcoded light-mode + unscaled — align with the rest.
- **Disease list uses index keys** (`health.tsx:148`) — use `disease.id`.
- **`QuickActionsPanel.tsx:71`** routes to nonexistent `/(tabs)/bank` — component is unused; delete or fix.
- **Empty states inconsistent** — add `EmptyState` to Home/Work/Market lists (Progression already does).
- **Accessibility:** sweep touchables for `accessibilityLabel/role` (tabs/computer/mobile cards + TopStatsBar are already good — extend the pattern).

---

# PHASE 6 — Perf, cleanup, dead code, CI hardening

### M-14 [MEDIUM] `useAchievements` recomputes the whole achievement list every tick
- **File:** `hooks/useAchievements.ts:106` (memo deps `[gameState, …]`; body does per-achievement `.met()/.current()` + two O(n²·log n) sorts), rendered on Home via `AchievementsProgress.tsx:36`.
- **Fix:** depend on specific fields (esp. `claimedProgressAchievements`); precompute a `Map<id,index>` at module scope so sorts are O(n log n). Pattern model: `useContextualTip` (`FirstWeekGuide.tsx:382`).
- **Effort:** 1 h.

### M-15 [MEDIUM] IAP benefit application is a non-atomic read-modify-write on the slot (TOCTOU)
- **File:** `services/IAPService.ts:959` (read) → `:1265` (`forceSave`) — an autosave that commits between read and write is clobbered by the IAP write carrying the older snapshot.
- **Fix:** do the read+mutate+write under the save mutex (expose `saveQueue.mutate(slot, fn)`), or re-read under the lock and merge only entitlement fields.
- **Effort:** 2 h. *(Coordinate with C-1's mutex change.)*

### EAS-update smoke gate [MEDIUM]
- **File:** `.github/workflows/eas-update.yml:57-61` pushes prod OTA on every `main` push with no `__tests__/startup` smoke step. Add it before the update (and consider tag/manual gating for prod OTA). *(Folded into H-6.)*

### Low-batch-cleanup / perf
- **Context provider values not memoized:** `StatChangeContext.tsx:75`, `TutorialHighlightContext.tsx:19-38`, `TutorialRefContext.tsx:38-44` (the last is an unmounted/dead provider — delete or memoize). Wrap in `useMemo`/`useCallback`. *(LOW)*
- **Selector-hook adoption** — `useGame()` is used in 146 files; migrate read-only leaf components (badges, breakdown modals, indicators) to the granular selectors already in `contexts/game/index.ts:60-96` to cut per-tick render fan-out. *(improvement)*
- **Dead `insets`/`topStatsBarHeight`** in `computer.tsx:96-97` & `mobile.tsx:74-75` — remove. *(LOW)*
- **`SubscriptionService` ignores `expiresAt`** (`:102-152`) — treats any historical purchase as active (subscription churn leak). Drive `isActive` from verified expiry. Confirm if it gates anything live; if dead, delete it + `IAPSyncService`. *(LOW→MEDIUM if live)*
- **`BannerAd`** not gated against active subscribers (`:32-35`); `showInterstitialAd` has no frequency cap (currently uncalled). Gate on `hasFeature('ad_free')`; add a min-interval before wiring interstitials. *(LOW)*
- **Quota cleanup hits dead keys** (`safeStorage.ts:57-63` removes nonexistent `cache_data`/`temp_data`) while real bloat is `save_backup_*`; backup rotation can wipe all backups during jail (`saveBackup.ts:234-249,496-507`). Point cleanup at reclaimable keys; exempt recovery/auto backups from the jail gate; keep ≥2 backups/slot. *(LOW-MEDIUM data-safety)*
- **Secret hygiene:** add gitleaks/trufflehog to CI; remove the literal HMAC key from `tasks/round7-sb1-path-a-checklist.md`; note in `.env.example` that prod IDs live in EAS secrets; verify `eas secret:list` has HMAC/IAP-verify/AdMob. *(LOW)*
- **`expo-constants` eager import** in the most boot-critical file (`app/_layout.tsx:28`) — lazy-load like `versionCheck.ts` does. **iOS New-Arch flag unpinned** — set `expo.newArchEnabled` explicitly in `app.config.js`. *(LOW/INFO)*
- **Financial values interpolated into log message strings** (`RemoteLoggingService.ts` sanitizer only inspects `context`, not the message) — keep money/gems in `context`. *(LOW, latent until a remote endpoint is configured)*

---

# PHASE 7 — New features / content roadmap (missing features)
*From the balance/content audit — prioritized by value/effort. These are net-new, not bug fixes.*

**High value**
- **Mid/late-game goal chains** — `GOAL_TEMPLATES` cap at "Billionaire"; add tiered sequential lines (dynasty, philanthropy, monopoly, political dynasty) with escalating rewards. ~1 day (data).
- **Active "work shift" interaction** — make the deepest content tree (careers) interactive with a weekly optional skill-check/choice that boosts performance/salary. ~1–2 days.
- **Online/async leaderboards** — `lib/progress/leaderboard.ts` + `lib/prestige/prestigeLeaderboards.ts` exist; surface net-worth/prestige/speedrun boards for retention. ~1–2 days.

**Medium value**
- **Narrative storylines / multi-week quest arcs** — `cliffhangerEvents.ts` hints at this; add branching arcs (rags-to-riches, criminal empire, political ascent). ~2–3 days.
- **Difficulty / scenario scaling** — make scenarios mechanically distinct (starting debt, harder odds, faster decay, ironman/no-revive) tied to higher rewards. ~1 day.
- **Relationship depth beyond income** — partners currently just contribute 25% income; add events, anniversaries, conflict, prenups feeding the existing divorce system. ~2 days.
- **Pension/retirement endgame** — `lib/statistics/retirementCalculator.ts` computes `requiredNetWorth` but there's no retire win-state. Add a capstone. ~1 day.
- **Achievement late-game tiers** — only ~29 in `enhancedAchievements.ts`; add prestige/dynasty/wealth tiers. ~0.5 day.
- **Real skill/perk tree** — `lib/skillTrees/` is empty except tests. ~3+ days.

**Lower value**
- Mini-games / casino loop (scratch tickets already partially modeled), avatar/house cosmetics as a gem sink, New-Game+ seeds (events already deterministic). ~1–2 days each.

---

## Recommended sequencing

1. **Phase 0** (C-1 first, then H-1…H-7) — one PR per item, all behind preflight + a TestFlight smoke build. C-1 + M-15 share the mutex change — do together.
2. **Phase 1** — economy exploits; ship the `updateGems` helper first (unblocks H-8), then the per-action fixes; add a spam-tap conservation stress test.
3. **Phase 2** — determinism + death-guard correctness (small, low-risk, high-confidence).
4. **Phase 3** — wire Political (H-13) first (biggest player-facing unlock), then bank withdraw + campus events.
5. **Phase 4** — balance, in this order: dedupe dividends → charge lifestyle → mining power → company scaling → stock drift → prestige/careers. Retest the economy after each.
6. **Phase 5–6** interleave (independent files, low conflict).
7. **Phase 7** — content roadmap, scheduled separately.

## Approval checkpoints before any code
- C-1 fix approach: **release-before-forceSave** vs **re-entrant token mutex**?
- H-3/H-5: are ads actually shipping (update policy) or not (disable flag / strip ad copy)?
- H-15 TopStatsBar quick-actions: **wire to real effects** or **remove**?
- H-13 Political: confirm "wire the four actions into the Office tab" (vs hide the app).
- Phase 4 balance: confirm appetite for difficulty (these make the late game harder/less idle).

## What's already solid (verified-OK, do NOT re-litigate)
iOS-26 crash vectors (gradient/blur/AsyncStorage/Suspense popups) all closed · P0-1 render-loop short-circuit present · IAP receipt verify fails closed + iOS re-process fixed + ATT plugin present + native config aligned · double-buffer crash-safe save/load + HMAC+CRC envelopes · `week`-vs-`weeksLived` discipline correct in the weekly tick · most action modules (Money/Banking/Stock/Crypto/Loan/Dating/Vehicle/Company/Mining/Job/Hobby/Crime) atomic & overdraft-safe · no committed secrets · all `fetch` calls have timeouts · type-check clean · onboarding has no render-phase `<Redirect>`, entry.ts dumb, perk stat-clamp at builder boundary.
