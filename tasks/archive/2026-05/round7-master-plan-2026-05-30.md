# Round 7 — Master Plan (2026-05-30)

> **Approach this round:** 7 parallel audits + verification + phased plan. **No code changes applied this turn.** After the Round 6 lazy-load crash, the rule is: present the plan, get sign-off, then ship in small testable batches with a smoke test at each step.

---

## Audit roster

| # | Focus | Status |
|---|---|---|
| 1 | IAP + monetization correctness | 20 findings (5 CRITICAL, 5 HIGH, 5 MEDIUM, 5 LOW) |
| 2 | `nextWeek()` 1,500-line refactor plan | Architectural design (10 migration steps) |
| 3 | Sub-app completeness scorecard | 8 findings; 17/20 apps at 100%, 3 at 75-95% |
| 4 | Hooks / contexts / re-render perf | 30 findings (6 HIGH, 9 MEDIUM, 15 LOW) |
| 5 | Network / sync / offline | 15 findings (3 CRITICAL, 4 HIGH, 5 MEDIUM, 3 LOW) |
| 6 | Bundle size + dead code | 30 findings; potential **150-200 MB asset reduction** |
| 7 | Onboarding flow E2E | 17 findings (3 CRITICAL, 5 HIGH, 4 MEDIUM, 5 LOW) |

**Verified before believing:** the items in **bold** below are direct-read confirmed. Items in *italics* contradict the agent and are **REJECTED** so we don't re-litigate them. Plain text are unverified-but-plausible — verify before fixing.

---

## ⚠️ Top 6 ship-blockers (do these before next TestFlight)

These are the items where I VERIFIED the code and the bug is real. Everything else in this plan waits behind these.

### SB-1. HMAC signing key committed to `.env` — VERIFIED CRITICAL
- **File:** [.env](.env) (line 2: `EXPO_PUBLIC_SAVE_HMAC_KEY=<actual secret>`)
- **Evidence:** `cat .env` shows the literal key value. `.env.example` (line 8-11) explicitly says "Configure this as an EAS secret" — the project's own docs say don't commit it, but it's committed.
- **Impact:** Anyone with repo access (including `git log`/old commits) can forge valid saves. Even if you rotate now, the old key is forever public in git history.
- **Fix:**
  1. Generate a new random key.
  2. Set as EAS secret: `eas secret:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY --value <new>`.
  3. Remove the literal from `.env` and replace with a comment pointing to the EAS secret.
  4. `git filter-repo --replace-text` or `bfg --replace-text` to scrub the old value from git history, then force-push (coordinate with collaborators — destructive).
  5. Bump `STATE_VERSION` so old saves signed with the leaked key get re-signed with the new one on first load (migration path).
- **Risk:** Force-push to `main` rewrites history. Coordinate with anyone who has the repo cloned.
- **Time:** 2 hours including history-scrub coordination.

### SB-2. IAP receipt validation returns `true` by default — VERIFIED CRITICAL
- **File:** [services/IAPService.ts:247](services/IAPService.ts#L247) and [services/IAPService.ts:268-272](services/IAPService.ts#L268)
- **Evidence:** `validateReceipt` returns `true` after structural checks (line 247). `verifyReceiptWithServer` returns `true` if `IAP_VERIFY_URL` env var is unset (line 272). With no verify URL set in `eas.json`, EVERY purchase passes.
- **Impact:** Jailbroken devices can fake purchases. Apple may reject the app. Revenue leak.
- **Fix options:**
  - **A (recommended):** Set up a tiny serverless verify endpoint (Cloudflare Worker, Vercel Function, or Apple's verifyReceipt API directly). Set `EXPO_PUBLIC_IAP_VERIFY_URL` in EAS production env. Tighten `verifyReceiptWithServer` to throw (not return `true`) when URL is missing in prod.
  - **B (minimum):** At least make the missing-URL path throw in production: change `return true` to `if (__DEV__) return true; throw new Error('IAP verify URL not configured')`. Forces ops to set it up before any release.
- **Risk:** Apple's `verifyReceipt` is deprecated as of iOS 17. Use `App Store Server API` (newer) if building from scratch.
- **Time:** Option A 4-8 hours (server deploy). Option B 30 minutes.

### SB-3. Production env-var enforcement (HMAC, IAP verify URL, AdMob real IDs) — VERIFIED
- **Files:** [services/AdMobService.ts:108-121](services/AdMobService.ts#L108), [utils/saveValidation.ts:120-122](utils/saveValidation.ts#L120) (the HMAC logger.error path)
- **Evidence:** AdMob fallback to test IDs when env var unset; HMAC fall-through path logs an error but doesn't throw. There's no preflight assertion that a release build has all required env vars.
- **Fix:** Add a `scripts/preflight-env.js` that runs as part of `npm run preflight` and **fails the build** if any of `EXPO_PUBLIC_SAVE_HMAC_KEY`, `EXPO_PUBLIC_IAP_VERIFY_URL`, `EXPO_PUBLIC_ADMOB_*_IOS`, `EXPO_PUBLIC_ADMOB_*_ANDROID` are missing for a `--platform ios` or `--platform android` production build. Already partially exists in [`scripts/preflight-check.js`](scripts/preflight-check.js) — extend it.
- **Risk:** None — fails locally, not in users' hands.
- **Time:** 1 hour.

### SB-4. The R6 regression guardrail must be in CI — VERIFIED
- **File:** [.github/workflows/eas-build.yml](.github/workflows/eas-build.yml)
- **Evidence:** R6 added `npm run type-check` and `npm test -- --ci` to CI. The new [__tests__/startup/screenImports.test.ts](__tests__/startup/screenImports.test.ts) runs as part of the test suite. **Verify it actually runs in CI** — there's no proof yet that the workflow runs this specific file under `--ci`.
- **Fix:** Add an explicit `npm test -- __tests__/startup --ci` step BEFORE `eas build` so screen-import failure can't go to TestFlight. Also document in the PR template that any `app/(tabs)/*` or `app/(onboarding)/*` change requires the smoke test to pass locally.
- **Risk:** None.
- **Time:** 30 minutes.

### SB-5. `pravatar.cc` / `ui-avatars.com` / external avatar URLs — VERIFIED  HIGH
- **Files:** [lib/social/randomProfiles.ts:124](lib/social/randomProfiles.ts) (`ui-avatars.com`), plus other social/dating mock data
- **Evidence:** Mock NPC profiles fetch avatars from public services at runtime. Apple's review guidelines 5.1.1 / 5.2.3 disfavor fetching user-resembling content from third parties, and the service going down breaks UI.
- **Fix:** Generate local SVG/canvas avatars from a deterministic seed (e.g., `react-native-color-svg` or hand-rolled circle-with-initial). Pre-bundle 20-30 stock avatars and pick by hash.
- **Risk:** Visual change to mock NPCs. Test that no UI assumes specific URLs.
- **Time:** 4-6 hours including new avatar generator.

### SB-6. Onboarding race condition on rapid slot tap — UNVERIFIED but plausible
- **File:** [app/(onboarding)/SaveSlots.tsx:150-153](app/(onboarding)/SaveSlots.tsx#L150) (per agent claim)
- **Need to verify:** Open the file, confirm the `isBusy` state-based check vs synchronous `ref` debounce.
- **Fix if verified:** Replace state-based debounce with `useRef`-based synchronous short-circuit (state-based has a render-cycle delay; ref-based is instant).
- **Risk:** Touches onboarding entry path. Add a test that simulates two rapid taps.
- **Time:** 1 hour + verification.

---

## REJECTED on verification (agents got these wrong)

Don't waste fix slots on these — direct code reads show they're already correct:

1. **"GameStateContext `useMemo` recreates value on every gameState change"** — that's the correct behavior; the value MUST update when the state changes. Removing `gameState` from deps would freeze the context.
2. **"AdMob test/prod ID switch has no logic"** — [services/AdMobService.ts:204](services/AdMobService.ts#L204) correctly gates with `__DEV__ && NativeTestIds`. The real bug here is the **missing prod-build assertion** (covered by SB-3), not the switching logic.
3. **"Customize is missing non-binary sex option"** — VERIFIED that grep finds no "non-binary" in Customize.tsx, but this is a product/design decision, not a bug. The audit framed it as CRITICAL; it's a feature request. Mark as MEDIUM product backlog item, not a ship-blocker.
4. **"Offline manager is broken because NetInfo is disabled"** — VERIFIED that NetInfo is intentionally stubbed (file comment line 7-8: "Network monitoring disabled for iOS 26 compatibility"). This is a known trade-off documented in `tasks/lessons.md`. Not a fix target unless someone resolves the iOS 26 native crash.
5. **"`wrappedSetGameState` regresses R5 lesson"** — already verified rejected in R6.
6. **"`CompanyActions.ts` in-place mutation at line 300"** — array is freshly spread (`const companies = [...prev.companies]`); index assignment on the spread copy is safe. R6 already rejected.

---

## Phase plan (proposed)

Six phases, each independently shippable, each with a clear definition of done.

### PHASE 0 — Safety nets (1 day)
**Goal:** Lock down the test/release pipeline so nothing else regresses.

| Step | Action | File | Verify |
|---|---|---|---|
| 0.1 | Add `npm test -- __tests__/startup --ci` to `eas-build.yml` BEFORE `eas build` | `.github/workflows/eas-build.yml` | Inspect workflow run logs after PR merge |
| 0.2 | Extend `scripts/preflight-check.js` to fail when prod env vars missing | `scripts/preflight-check.js` | Run with empty env → expect non-zero exit |
| 0.3 | Add a smoke test that requires every `app/(tabs)/*.tsx` AND every `app/(onboarding)/*.tsx` file in Node and asserts `default` is a function | Extend `__tests__/startup/screenImports.test.ts` | Tests pass after extension |
| 0.4 | Add a PR template (`.github/PULL_REQUEST_TEMPLATE.md`) reminding contributors to run preflight + startup tests for any `app/` or `services/` change | new file | n/a |

**Approval gate:** confirm with you these are right before opening the PR.

### PHASE 1 — Ship-blockers (1-2 days)
**Goal:** Apply SB-1 through SB-5 above. SB-6 verified-and-fixed if confirmed.

Each ships as a separate PR, all verified locally with `npm run preflight` AND a TestFlight build to a private group BEFORE App Store submit. **Never `--no-verify`**.

**Approval gate:** for the HMAC key rotation (SB-1) — this is destructive (force-push to main). Get explicit go-ahead.

### PHASE 2 — `nextWeek()` refactor (2-3 weeks)
**Goal:** Eliminate the 200ms-2s freeze on "Next Week" tap. The audit produced a 10-step migration plan (Round 7 audit #2).

**Sub-plan:**

| Step | Concern extracted | Expected speedup | Risk |
|---|---|---|---|
| 2.0 | **Test infrastructure first.** Add `__tests__/refactor/nextWeek-equivalence.test.ts` with 8-12 fixture states. Run old + new pipeline. Deep-equal output. | n/a | None — pure test addition |
| 2.1 | Pre-roll & decay helpers → `actions/weekly/preTick.ts` | ~0% (architecture) | Lowest |
| 2.2 | Pets + Vehicles reducers (leaf, isolated) | ~5% | Low |
| 2.3 | Diseases reducer | 5-15% | Medium (death-flag cross-cuts) |
| 2.4 | Finance pipeline (income/auto-reinvest/rent/banking/loans) | 10-20% | Medium |
| 2.5 | Careers + Education + Diet | 5-10% | Medium |
| 2.6 | Relationships + Crime + Mining | 10-15% | Medium-High |
| 2.7 | Events + Engagement | 2-5% | Low |
| 2.8 | Already-pure subsystem ticks (crypto/banking/darkweb/stocks/politics) | 0-3% | Lowest |
| 2.9 | Meta + automation (last, gnarliest) | 2-5% | High |

**Cumulative target:** 40-60% reduction (200-2000ms → 100-800ms).

**Approval gate:** review the architecture proposal in detail before step 2.0 (the equivalence test) so we agree on the WeekReducer signature shape.

**Out of scope (separately tracked):**
- `validateGameState` / `repairGameState` cloning cost
- `saveGame` JSON.stringify cost (R6 already added `setImmediate` yield; the actual stringify is still synchronous)
- Provider-tree depth (Phase 4)

### PHASE 3 — Sub-app completeness (3-5 days)
**Goal:** Bring the 3 incomplete apps to 100%.

| Sub-app | Action | Verify |
|---|---|---|
| **PoliticalApp (75%)** | [components/computer/PoliticalApp.tsx:184-194](components/computer/PoliticalApp.tsx#L184) — "Policy" tab renders the array but has no enact-policy action. Either implement enact-policy modal wired to a new `raisePolicyInfluence` action, OR remove the tab (hide until ready). Pick one with you. | Manual play-test: open Political tab, enact a policy, verify state changes |
| **SparkApp (90%)** | [components/mobile/Spark/SparkApp.tsx:69-74](components/mobile/Spark/SparkApp.tsx#L69) — `onOpenPartnerProfile` returns to matches tab instead of opening a profile view. Implement `PartnerProfileScreen` OR document the deferred state in code. | Open Spark, tap match, expect profile view |
| **EducationApp (95%)** | [components/mobile/EducationApp.tsx:99-103](components/mobile/EducationApp.tsx#L99) — `pendingCampusEventEducationId` effect does nothing. Either clear the flag (one-line fix) or remove the dead effect entirely. | Verify no campus-event-related console warnings |
| Work tab (95%) | Remove unused `_showJailReleaseMessage`, `_previousJailWeeks` state ([app/(tabs)/work.tsx:103-104](app/(tabs)/work.tsx#L103)) | Type-check clean |
| Mobile BankApp (95%) | Remove unused `setWithdrawTarget` ([components/mobile/BankApp.tsx:370](components/mobile/BankApp.tsx#L370)) OR implement withdraw flow | Type-check clean |

### PHASE 4 — Hooks / context perf (1-2 weeks)
**Goal:** Reduce whole-tree re-renders. The 8-provider nesting causes cascade rerenders on every state tick.

| Step | Action | Risk |
|---|---|---|
| 4.1 | **Add render-count instrumentation** (dev-only) to top-level providers to MEASURE re-renders per tick before changing anything. Without measurement, "optimization" is guesswork. | None — dev-only |
| 4.2 | Split `GameUIContext` into `GameLoadingContext` + `GameProgressContext`. Consumers of `isLoading` won't rerender when `loadingMessage` changes. | Low — opt-in via selector hooks |
| 4.3 | Audit `useEffect` deps in [contexts/UIUXContext.tsx:67-82](contexts/UIUXContext.tsx#L67) — `checkTutorialStatus` defined inside render body, `[]` deps, stale closure. Add `isMounted` guard. | Low |
| 4.4 | Wrap callback-only context values in `useMemo` keyed on the callbacks, not on `gameState`. This affects 5 contexts. | **Medium-high** — touches every action context. **NEEDS the equivalence-test infrastructure from Phase 2 first** so we can verify behavior is unchanged. |
| 4.5 | Add `try/finally` to `processingActivities` ref tracker ([contexts/game/ItemActionsContext.tsx:235-274](contexts/game/ItemActionsContext.tsx#L235)) and `nextWeekInProgressRef` ([contexts/game/GameActionsContext.tsx:371-372](contexts/game/GameActionsContext.tsx#L371)) so flags clear even if the callback throws. | Low |

**Out of scope:** the agent's recommendation to remove `gameState` from `GameStateContext`'s `useMemo` deps — verified WRONG, would freeze the context. The agent confused "data dep" with "callback dep". Skip.

### PHASE 5 — Network / sync / offline (1 week)
**Goal:** Address verified items from the network audit.

| Step | Action | Verify |
|---|---|---|
| 5.1 | **VERIFY then fix:** [services/CloudSyncService.ts:254-279](services/CloudSyncService.ts#L254) — agent claims `onConflictDetected` is never wired to UI. Verify by grepping `setConflictCallback` callers. If wired (likely is, per R6 audit context), reject. If not, build a conflict modal. | Grep + manual test with two devices |
| 5.2 | Add timeout/`AbortController` to [services/RemoteLoggingService.ts:267](services/RemoteLoggingService.ts#L267) (fetch with no timeout) | Test with `--proxy http://1.2.3.4:1234` (unreachable) — expect 10s abort |
| 5.3 | Replace fixed 500ms backoff with exponential in [lib/progress/cloud.ts:217](lib/progress/cloud.ts#L217) | Unit test simulating 429 + retry |
| 5.4 | Audit logger calls for sensitive-data leaks (money, gems, HMAC keys). Replace `logger.warn('...', { money, gems })` with `{ money: '[REDACTED]' }` in production builds. | Manual log inspection |

### PHASE 6 — Polish + bundle size (ongoing)
**Goal:** Asset compression and dead-code removal. Lowest priority but biggest user-facing app-size win.

| Step | Action | Expected savings |
|---|---|---|
| 6.1 | Run TinyPNG / ImageOptim on `assets/images/IAP/`, `assets/images/Real Estate/`, `assets/images/Perks/`, `assets/images/Scenarios/`, `assets/images/YouVideo/`. Convert to WebP where possible. | 150-200 MB → 50-80 MB app download |
| 6.2 | Remove `@lucide/lab` (`npm remove @lucide/lab`) — 0 imports, 5MB node_modules savings | 5 MB node_modules |
| 6.3 | Remove `react-native-url-polyfill` after confirming Expo SDK 54 doesn't need it | 1 MB node_modules |
| 6.4 | Consolidate `LoadingSpinner.tsx` + `ui/EnhancedLoadingSpinner.tsx` into one | 15 KB bundle |
| 6.5 | Sweep remaining `zIndex: 999/1000/10000` literals (R6 cleared 11; there may be more in deeper components) | Z-index sanity |
| 6.6 | Wrap `AIDebugMenu` in `__DEV__` gate so it doesn't ship to production | 45 KB |

---

## What's explicitly NOT in this plan

- **Adding non-binary sex option** — product decision, not engineering. Flag for product backlog.
- **Splitting the 8-level provider tree into selector-based architecture** — that's a multi-week refactor and the wins are uncertain until Phase 4.1 measures actual re-render cost.
- **Reanimated reintroduction** — blocked on iOS 26 TurboModule crash; out of scope.
- **Cloud sync rebuild** — deeper architectural concern; address narrowly via SB items and Phase 5 only.
- **i18n / localization gaps** — needs its own audit pass.
- **Push notifications, background fetch, deep linking** — not in current scope.

---

## Sequencing recommendation

1. **THIS PR:** Phase 0 only (safety nets). Small, fast, no app-behavior changes. Land before everything else so the rest is protected.
2. **Next PR:** SB-1 + SB-3 + SB-4 (security/release gates). SB-1 needs your explicit go-ahead because of the force-push.
3. **Then:** SB-2 (IAP verify) — option B (minimum) immediately, option A (server) when you have time to deploy infra.
4. **Then:** Phase 2 step 2.0 (equivalence test infrastructure) + steps 2.1-2.3 in one batch (lowest risk extractions).
5. **Then:** Iterate Phase 2 (one extraction PR at a time).
6. **In parallel** (different files, won't conflict): Phase 3 sub-app completeness — pick PoliticalApp first.
7. **After Phase 2 is done:** Phase 4 (hooks/context perf) with the equivalence test as backstop.
8. **Bundle / polish:** Phase 6 can interleave with anything — image compression has no code conflicts.

---

## Approval checkpoints

Before I touch any code, I need a green light on:

1. **Phase 0 sequence** — agreed?
2. **SB-1 force-push** — willing to coordinate with collaborators? Or skip the history-scrub and just rotate (less secure but no destructive op)?
3. **SB-2 option** — server (A) or minimum-throw (B)?
4. **SB-5 avatars** — okay to ship a visual change to mock NPCs?
5. **PoliticalApp Phase 3** — implement policy tab or hide it?

I won't make any code edits this turn until you sign off on at least the first batch.
