# DeepLife Simulator — Round 9 Mega Audit (2026-06-04)

Full parallel audit across 7 domains, run **after** the production launch-crash fix
(the expo-router route conflict: `app/index.tsx` + `app/(tabs)/index.tsx` both at `/`,
production silently dropped the loader — fixed by moving game home to `app/(tabs)/home.tsx`).

Severity legend: **CRITICAL** (crash / data-loss / store-rejection / money-printer),
**HIGH** (exploit / broken feature / regression risk), **MEDIUM**, **LOW**.

Cross-confirmed = found independently by 2 agents (higher confidence).

---

## ✅ RESOLUTION STATUS (all actionable items fixed)

- **Phase 0 (7 CRITICAL):** all fixed — commit `45df1a2`.
- **Phase 1 (11 HIGH):** all fixed + route-conflict CI guard — commit `428c64f`.
- **Phase 2 (MEDIUM):** P2-1,2,3,4,6,7,10,11,12,13,14,15,16 fixed — commit `aa19f26`;
  P2-8 (market jank) + P2-9 (migration field tests) + P2-17 (secrets doc) fixed in the
  follow-up commit. **P2-5 = working-as-intended** after P0-1 (paying out on early
  delivery is an efficiency reward, no longer an exploit since the total is 100%).
- **Phase 3 (LOW):** crash-safety/correctness items fixed (TopStatsBar NaN, null-safety,
  disease keys, SaveSlots back-nav, work debug text, preview.tsx native guard).
- **Intentionally not done (cosmetic/a11y, noted):** progression default-theme nuance,
  DeathPopup memo narrowing, IdentityCard accessibility labels, FTUE spacer magic number.

Verification: type-check clean, route guard passing, full suite green. Shipped in
build 115 (Phase 0–3 core) and build 116 (+ P2-8/9/17 + LOW polish).

---

## Executive summary

| Domain | CRIT | HIGH | MED | LOW |
|---|---|---|---|---|
| Core loop & state | 0 | 2 | 3 | 2 |
| Save / data integrity | 1 | 3 | 3 | 3 |
| Navigation / routing | 0 | 1 | 0 | 3 |
| Tab screens & UI | 2 | 4 | 5 | 5 |
| Economy / events | 1 | 2 | 3 | 2 |
| Social / mini-apps | 2 | 2 | 3 | 3 |
| Monetization / config | 2 | 3 | 4 | 5 |

**The launch path itself is now structurally sound** (navigation agent verified 0 remaining
route conflicts, all default exports present). The remaining work is correctness, economy
integrity, store compliance, and release-pipeline hardening.

---

## PHASE 0 — CRITICAL (fix before the next public release)

### P0-1. Brand deals pay 125% of contract value  **[CROSS-CONFIRMED ×2]**
`contexts/game/actions/PulseActions.ts:592-644,695-744` + `lib/social/pulseTick.ts:315-319`
A 25% signing bonus is paid on accept, but the **full** `payment` is still streamed weekly
(`weeklyPayment = payment/duration`) and early-completion pays the full remainder. Net = 125%
of every deal; a 1-week deal pays 125% in one week. A test even asserts the buggy total
(`__tests__/actions/brandDealPayout.test.ts`). This is the biggest money faucet in the game.
**Fix:** stream `floor(payment*0.75)` over the duration (treat bonus as an advance); make
`deliverBrandDealPost` completion payout consistent; update the test expectations.

### P0-2. Hustle money actions are non-atomic → free hires / campaigns / acquisitions
`contexts/game/actions/HustleActions.ts` — `hireCandidate` (174), `launchCampaign` (303),
`fireNamedHire` (262), `resolveScandal` (424), `acceptAcquisition` (573).
Each adds the entity in one `setGameState`, then charges via a **separate** `updateMoney`,
which atomically *rejects* overdrafts. Double-tap / low-cash race → entity granted, charge
rejected → free. Same class already fixed in Pet/Spark/Pulse but Hustle was missed.
**Fix:** fold the debit into the same updater with `applyMoneyDelta(prev, -cost, reason)`,
`return prev` when it returns null (mirror `buyPet`).

### P0-3. Achievement gem reward double-claim
`components/EnhancedAchievementScreen.tsx:142-188`
The "already claimed" guard reads `gameState.claimedEnhancedAchievements` from the **closure**
(outside the updater); the updater grants `gemReward` unconditionally. Two rapid taps both
pass the stale gate → gems credited twice. Same class as the fixed `boostProfile` bug.
**Fix:** move the guard inside the updater (`if (prev.claimedEnhancedAchievements?.includes(id)) return prev;`)
and grant in the same updater.

### P0-4. Rewarded "watch a video ad" grants the reward without showing any ad  **[CROSS-CONFIRMED ×2]**
`components/mobile/Pulse/modals/RewardedAdModal.tsx:33-41` → `PulseActions.ts:1033-1044`
CTA says "watch a short video ad" but calls `watchAdForFollowerBoost` directly — `adMobService.showRewardedAd`
is never invoked (dead code). **Apple 2.3.1 deceptive-UX rejection risk** + lost ad revenue.
**Fix:** route through `adMobService.showRewardedAd(() => watchAdForFollowerBoost(...))`, grant
only in the reward callback; do not grant if the ad is unavailable. If ads aren't wired here,
remove the "watch a video ad" copy + play icon.

### P0-5. AdMob ignores ATT / GDPR consent — always requests personalized ads
`services/AdMobService.ts:205,260,346` (uses `createForAdRequest(adUnitId)` with no options)
ATT is requested at `app/_layout.tsx:1090` but the result is discarded; no UMP/consent wiring.
Denied-ATT users still get personalized ads → **Apple 5.1.2 + GDPR violation** (common rejection).
**Fix:** read `isTrackingAllowed()` and pass `{ requestNonPersonalizedAds: true }` to all three
request paths when not granted; ideally integrate Google UMP + `setRequestConfiguration`. Task
ordering already runs ATT before AdMob init, so only the request-options plumbing is missing.

### P0-6. NaN/Infinity stats pass load validation → save becomes permanently unplayable
`utils/saveValidation.ts:1043-1054` + `GameActionsContext.tsx:2615-2626`
`validateGameState` decides `valid` from a keyword filter that **excludes** the NaN/Infinity
error strings, and the load path never auto-fixes top-level stats. A save with `stats.health = NaN`
loads as "valid", but `gameEntryValidation` then blocks entry (isFinite check) → save exists,
can never be played.
**Fix:** treat NaN/Infinity errors as critical in `validateGameState`; call `repairGameState`
+ `autoFixStats` (or `validateGameState(parsed, true)`) in `loadGame` before building `safeState`.

### P0-7. `IdentityCard` crashes the home tab on missing `userProfile`
`components/IdentityCard.tsx:139` (`userProfile.sex` raw, `date` raw at 134/317)
`TopStatsBar` early-returns on `!gameState?.userProfile`, proving missing-profile is a real state,
but `IdentityCard` (rendered unconditionally on home) destructures raw → `Cannot read property
'sex' of undefined` → home tab falls to its ErrorBoundary.
**Fix:** `const sex = userProfile?.sex || userProfile?.gender || 'male';` and guard `date.age`.

---

## PHASE 1 — HIGH

### P1-1. `proposeToPartner` (context) non-atomic → free engagement
`contexts/game/GameActionsContext.tsx:2946-2980` — affordability checked on stale snapshot, charge
in a separate `updateMoney` that can be rejected after engagement is already granted; no in-updater
re-check of partner type / `engagementWeek == null`. `DatingActions.proposeMarriage:335-376` does it
correctly. **Fix:** fold the −5000 into the same updater via `applyMoneyDelta`; or route UI to
`proposeMarriage` and delete this weaker duplicate.

### P1-2. Wedding can be charged twice (manual `executeWedding` + auto weekly tick)
`DatingActions.ts:487-589` + `actions/weekly/applyScheduledWedding.ts:51-71` — the tick charges the
remaining 75% keyed only on `scheduledWeek`, without checking `type !== 'spouse'`; the `resolveEvent`
wedding branch (line ~1805) sets `type='spouse'` but leaves `weddingPlanned` intact. **Fix:** add
`if (rel.type === 'spouse') return null;` to `applyScheduledWedding`; clear `weddingPlanned`/`engagementWeek`
in the resolveEvent marry branch.

### P1-3. Live-stream tips = uncapped AFK money farm
`PulseActions.ts:833-915` + `components/mobile/Pulse/screens/LiveStreamScreen.tsx:37,64-75` — `tickLiveStream`
adds donations every 30s with no cap; the screen resumes `live` on remount, so leaving it running for
hours harvests unbounded cash. **Fix:** cap donations per session (multiple of followers), decay viewers,
clamp background time, charge energy per tick.

### P1-4. Daily "earn $X" challenges farmable by transfers, not earnings
`utils/dailyChallenges.ts:57,125,207` — progress = raw `stats.money` delta, so bank withdrawals, asset
sales, loans, inheritance all count; with the up-to-5× streak multiplier this is the top gem faucet.
**Fix:** track a dedicated `moneyEarnedToday` ledger fed only by genuine income; diff that.

### P1-5. Spark first match opens wrong / missing chat
`components/mobile/Spark/screens/SwipeScreen.tsx:91-95` — reads new match from stale closure; `swipeOnProfile`
(`SparkActions.ts:142-229`) never returns the generated match id, so first match → "Conversation not found".
**Fix:** return `matchId` from `swipeOnProfile`; pass it to `onMatch`.

### P1-6. `health.tsx` reads `gameState.stats.money/.energy` with no optional chaining
`app/(tabs)/health.tsx:80,83,84` (also `dietPlans` at 113,215) — outlier vs every other tab's
`stats?.money ?? 0`; throws on degraded state. **Fix:** add optional chaining + `?? 0`/`?? []`.

### P1-7. Save-from-future is loaded & can be overwritten (downgrade data loss)
`utils/saveMigrations.ts:549-557` + `GameActionsContext.tsx:2720-2729` — `runMigrations` returns
future-version state unmodified; `loadGame` ignores `migrationResult.errors`. Entry is blocked, but
autosave can re-persist the merged older shape over the newer save. **Fix:** treat future-version as a
hard load failure that returns `null` without persisting.

### P1-8. Unbounded array growth → 4 MB save cap → player can never save again
`utils/saveQueue.ts:600-637` — `pruneSaveData` caps only 5 arrays; `netWorthHistory`, crypto
`priceHistory`/`orderHistory`, `scandalHistory`, `recentPosts`, `socialPosts`, `streamHistory`, etc. grow
forever. The "more aggressive" retry re-runs the *same* function (no-op). **Fix:** add explicit caps for
all history arrays; make the 2nd pass actually lower the caps.

### P1-9. Backup verification is weaker than primary saves
`utils/saveBackup.ts:614-639` — `loadBackup` uses `verifySaveData` (CRC-only acceptable under
`ALLOW_WEAK_SAVE_MIGRATION`, required during the v19 window) instead of the strict envelope path.
**Fix:** route `loadBackup` through `verifySaveEnvelopeData`/`decodePersistedSaveEnvelope`.

### P1-10. CI ships production builds without running preflight
`.github/workflows/eas-build.yml:53-54` — `eas build --profile production` runs without `npm run preflight`,
so IAP-verify-URL / real-AdMob-ID / save-signing enforcement (only in `scripts/preflight-check.js`) never
runs. A missing EAS secret → purchases refused at runtime, or test ad IDs (zero revenue), silently shipped.
**Fix:** add a preflight step (with prod secrets in job env) before `eas build`.

### P1-11. Dead code with broken routes: `components/QuickActionsPanel.tsx`
Lines 71/81 push to `/(tabs)/bank` and `/(tabs)/` (neither resolves now); already TS errors; component
is unreferenced. **Fix:** delete it (clears 6 TS errors, zero behavior change).

---

## PHASE 2 — MEDIUM (selected; full list in agent notes)

- **P2-1.** Automation weekly cost deducted with `Math.max(0, money-cost)` (no affordability) — `GameActionsContext.tsx:1677-1700`. Use `applyMoneyDelta`.
- **P2-2.** `updateStats({ money/gems })` is a 2nd money path bypassing overdraft + daily-summary — `StatsActions.ts:20-30`. Reject money/gems keys; route to `updateMoney`.
- **P2-3.** `reviveCharacter` doesn't clear the lethal disease/age cause → re-kills next tick, burning 15k gems — `GameStateContext.tsx:111-136`. Add `clearLethalConditions`.
- **P2-4.** Event choices with negative money are absorbed (free benefits when broke) — `GameActionsContext.tsx:1777-1780`. Gate affordable-only choices.
- **P2-5.** Brand-deal early completion bypasses time-gating (full payout week 1) — `PulseActions.ts:695-742`. Pay proportional / keep weekly schedule.
- **P2-6.** Modal stacking: tabs-layer LifeMoment/WeeklyEvent not suppressed under root DeathPopup — `(tabs)/_layout.tsx:177` vs `_layout.tsx:1267`. Suppress when `showDeathPopup`.
- **P2-7.** `progression.tsx` re-runs `checkAchievements()` on object-identity dep changes (every tick) — `progression.tsx:37-46`. Depend on primitives.
- **P2-8.** `market.tsx` purchase/sell driven by fixed `setTimeout` instead of action return values — `market.tsx:97,110`. Return result objects.
- **P2-9.** Migration registry has no per-field structural tests for v11–v19 — `__tests__/utils/migrationRegistry.test.ts`. Add field-level fixtures.
- **P2-10.** `MIN_SUPPORTED_VERSION=5` but migrations cover from v2 (v2–v4 migrate then get rejected) — `gameEntryValidation.ts:24`. Align the floor.
- **P2-11.** `detectSandboxEnvironment` substring-matches receipts; `validateReceipt` is a no-op — `IAPService.ts:133,186`. Trust server environment; keep as structural pre-check only.
- **P2-12.** ATT usage string duplicated across two config plugins — `app.config.js:88` & `104`. Keep on expo-tracking-transparency only.
- **P2-13.** `EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS` (public bundle var) can re-enable unsigned local entitlements — `IAPService.ts:28`. Preflight-assert false for prod.
- **P2-14.** `work.tsx renderJobCard` runs `getSystemInterconnections(gameState)` synchronously per card per render — `work.tsx:391`. Memoize.
- **P2-15.** `computer.tsx`/`mobile.tsx` `AppComponent = apps[activeApp]` can be undefined → "Element type is invalid" — add `if (!AppComponent) { setActiveApp(null); return null; }`.
- **P2-16.** Rewarded-ad reward read synchronously after `show()` (race; dropped rewards) — `AdMobService.ts:299-324`. Resolve on CLOSED/EARNED_REWARD event.
- **P2-17.** `eas.json` doesn't declare/verify the revenue-critical env vars (IAP URL, ad unit IDs, signing) — document required EAS secrets + enforce via preflight.

---

## PHASE 3 — LOW & polish (selected)

- Home FTUE `weeksLived` un-guarded (`home.tsx:345-346`); `mobile.tsx:88` raw `settings.hapticFeedback`;
  `TopStatsBar:529` no NaN guard on stock price; disease list `key={index}` (`health.tsx:148`);
  `SaveSlots.tsx:300` back→`/` re-mounts loader (use `replace` to MainMenu); `preview.tsx:98` nested
  `<Stack>` (web-only, gate with `Platform.OS==='web'`); `restoreFromBackup` writes legacy key only,
  not double-buffer (`saveValidation.ts:1321`); work.tsx ships debug counters in empty-state (`work.tsx:960`);
  StocksApp market vs holdings price divergence; BTC halving countdown is a dead indicator;
  privacy policy says "AdMob disabled" while prod ships it enabled (`UPDATED_PRIVACY_POLICY.md:31`);
  accessibility labels missing on IdentityCard tappable rows.

---

## Highest-value structural improvements (beyond individual fixes)

1. **Route-conflict CI guard** — add `scripts/check-route-conflicts.cjs` (enumerate `app/**`, strip
   group segments, fail if any resolved path maps to >1 file) wired into `preflight`/`preflight:quick`.
   This is exactly what would have caught the launch crash; dev throws, production silently drops.
2. **One atomic grant helper for everything** — add `applyGemDelta(prev, amount, reason)` beside
   `applyMoneyDelta`, route achievement claims, prestige/scenario gems, IAP grants, and all reward
   surfaces through it with idempotency keys. Eliminates the recurring "guard outside updater" class
   (P0-2, P0-3, P1-1).
3. **Single income ledger** — `incomeThisWeek`/`incomeToday` fed only by genuine income; daily
   challenges, achievements, and "earn $X" goals read it (closes P1-4 and future transfer-farming).
4. **Money-conservation invariant test** in the stress suite (sum of all deltas == end-start) — would
   catch P2-1/P2-2 automatically.
5. **Field-level migration fixtures** (P2-9) — cheapest insurance against a future migration silently
   producing empty data.
6. **Wire RewardedAdModal + fix the reward race together** (P0-4 + P2-16) and **add the preflight step
   to CI** (P1-10) — the two biggest release-readiness fixes.

---

## Verified-solid (do NOT re-investigate)

- Navigation: 0 remaining route conflicts; all route default exports present; `entry.ts` compliant;
  config plugins aligned with `package.json`; no render-phase `<Redirect/>`; TurboModule fallbacks in use.
- Money/gem atomicity in Pet/Spark/Pulse **gem** paths and Pet **money** paths (`applyMoneyDelta`).
- `week` vs `weeksLived` discipline correct throughout the weekly tick.
- IAP server-verify fails closed; dual transaction ledger + dedup; consumables excluded from restore;
  signed save envelopes; AdMob lazy-load + circuit breaker.
- StrictMode double-invoke handled (pre-rolled `oldAgeDeathRoll`); `nextWeekInProgressRef` released in `finally`.
