# DeepLife Simulator — Round 11 Master Audit & Remediation Plan — 2026-06-09

Five parallel deep-dive audits (type-safety, performance/memory, monetization,
architecture/decomposition, UX/design-system+a11y). This is the complete findings
catalogue and a sequenced plan to fix everything. Companion to
`tasks/round11-roadmap-2026-06-09.md` (the tier overview) — this is the detail.

## Verified baseline (run 2026-06-09 on `claude/app-audit-roadmap-f5ukvy`)

- `npx jest --ci` → **2344 passed / 145 suites / 308 snapshots — all green**.
- `npm run type-check` → **0 errors** (fully clean — making CI strict is now feasible).
- 500-week real-provider stress → **~84ms mean / 101ms p95 per weekly tick**, **+318 MB heap (~0.6 MB/week)**.

Claims below were spot-verified against source (per `lessons.md`: never trust an audit claim
without re-reading). Two highest-stakes new findings confirmed by direct grep:
the production-bundle simulation chain, and the three dead bank IAPs.

---

# PART 1 — COMPLETE FINDINGS CATALOGUE

Severity: **P0** release/revenue/store blocker · **P1** high (exploit/broken/compliance) ·
**P2** medium · **P3** low/polish.

## A. Monetization (services/IAPService.ts, AdMobService.ts, BannerAd.tsx)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| MON-1 | **P0** | **IAP is OFF in production.** `verifyReceiptWithServer` fails closed when `EXPO_PUBLIC_IAP_VERIFY_URL` unset — every purchase denied. No verify backend exists. | `IAPService.ts:278-286` |
| MON-2 | **P0** | **Three bank IAPs deliver nothing** (confirmed: 0 reads anywhere). Private Banking $9.99 ("3% APR loans"), Business Banking $3.99, Premium Credit Card $4.99 ("10% cashback") set `settings.privateBanking/businessBanking/premiumCreditCard` — nothing reads them. Loan APR uses creditScore+politics; cashback is generic. **Apple 2.3.1 rejection + refund-fraud risk.** | `IAPService.ts:1159,1167,1171`; grep: 0 consumers |
| MON-3 | **P0** | **Bundle-flag sub-features dead:** `settings.moneyMultiplier` (Premium Pack $24.99), `settings.everythingUnlocked` (Mega $99.99), `settings.unlimitedYouthPills` set flags nothing reads. (Money mult is delivered via the *different* `goldUpgrades.multiplier`; pill count 999999 works — only the flags are dead.) | `IAPService.ts:1082,1101,1118` |
| MON-4 | P1 | **Remove-Ads not honored after relaunch.** `BannerAd` gates on in-memory `iapService.hasPurchased()`, not persisted `settings.adsRemoved`/`lifetimePremium`. Ads can reappear for payers. | `BannerAd.tsx:32-33` |
| MON-5 | P1 | **Android serves personalized ads with no consent.** `isTrackingAllowed()` returns `true` unconditionally on Android → AdMob requests personalized ads, no UMP/GDPR flow. | `trackingTransparency.ts:197-199` |
| MON-6 | P1 | **AdMob ships test ad unit IDs** by default (real IDs unset). Preflight §10 blocks prod, but the 6 EAS secrets aren't configured. | `AdMobService.ts:102-122` |
| MON-7 | P1 | **Privacy policy says ads "currently disabled"** while prod ships them enabled — App Store privacy-label mismatch. | `UPDATED_PRIVACY_POLICY.md:31,152` |
| MON-8 | P2 | Dead duplicate reads: `goldUpgrades.work_boost/fast_learner/mindset` are read but never written (IAP writes `perks.*`). Vestigial OR-branches. | `MoneyActionsContext.tsx:161-170` |
| MON-9 | P2 | **Three divergent entitlement-apply paths** (`applyBenefitToDisk`, `applyProductToState`, `ShopModal.applyPurchaseBenefits`) — drift risk. Consolidate to one. | IAPService + ShopModal |
| MON-10 | P2 | `EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS` tamper hatch (preflight-blocked in prod; keep unset). | `IAPService.ts:28-30` |
| — | OK | **Confirmed FIXED** (prior audits): Mindset 50%-faster-promotions, Time Machine, Immortality, the four $1.99 perks, gem gold-upgrades, rewarded-ad gating (grants only on EARNED_REWARD), restore dedup. |

## B. Type-safety (Hard Rule #2: no `as any`, no unguarded unions)

322 `as any` total. **185 are RN-web style casts (noise)**; the real debt:

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| TS-1 | P1 | **~58 gameplay/state casts** — `(state as any).field` on fields *already typed* in types.ts; reproduces the `.totalKarma` bug class across net-worth/lifetime-stats/finance money rollups. | `crossSystemSummary.ts:50-262`, `StatisticsApp.tsx:76-155`, `milestones.ts:100-125` |
| TS-2 | P1 | **23 `useGame() as any`** — every state write in Spark/Pulse/Hustle screens runs through an `any` context; `setGameState` updaters get zero field-checking. | `Spark/SwipeScreen.tsx:50`, `Pulse/PulseApp.tsx:52`, +21 |
| TS-3 | P1 | **`as any[]` income loops** — net-worth/weekly-income summation iterates typed arrays as `any[]`; renamed field silently drops from money total. | `AdvancedBankApp.tsx:128-145`, `RealEstateApp.tsx:137`, `VehicleApp.tsx:94`, `mobile/BankApp.tsx:97` |
| TS-4 | P1 | **Hard-Rule-2 violation:** `travel/operations.ts` casts `destination.requirements as any` instead of using the existing `TravelDestinationRequirements` guards in `requirements.ts`. | `lib/travel/operations.ts:61,71,72` |
| TS-5 | P2 | **`{} as any` state fallbacks** defeat checking on whole branches in mutation paths. | `EducationActions.ts:215`, `PoliticalActions.ts:797-875`, `PulseActions.ts:187-191` |
| TS-6 | P2 | **~95 internal `require()` of code modules** degrade types to any/never (the recurring root cause in lessons.md), concentrated in `contexts/game/actions/*`, `lib/economy/*`, `lib/prestige/*`. | grep |
| TS-7 | P2 | `(gameState as any).loans` though `loans?: Loan[]` is typed. | `IdentityCard.tsx:210`, `FinanceOverview.tsx:63` |
| — | OK | IAPService, MoneyActions, saveValidation, initialState, requirements.ts itself are **clean** of `as any`. |

## C. Performance & memory (contexts/game/*)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| PERF-1 | **P1** | **Single `gameState` atom → 137 consumers re-render every tick.** `useGame()` subscribes to all 9 contexts; `useGameState` changes identity each tick → `useGame` memo recomputes for everyone. | `index.ts:102-124`; 137 `useGame(` callers |
| PERF-2 | P1 | **`updatedAt` bumped in the setter** guarantees a new top-level identity every change. | `GameStateContext.tsx:44-58` |
| PERF-3 | P1 | **`memories[]` has no write-time cap** (only capped at save) — primary driver of ~0.6 MB/week growth. | `GameActionsContext.tsx:2005` |
| PERF-4 | P1 | **~9 history arrays capped nowhere** (live or save): `sparkApp.messages`, `sparkApp.jealousyHistory`, `darkWeb.recentEvents`, `hustleApp.notifications`, `travelHistory`, `warehouse.miningHistory`, `competitionHistory`, `politics.recentEarnings`. Plus `journal`/`lifeMilestones` have no live cap. | types.ts + `saveQueue.ts:604-703` |
| PERF-5 | P2 | **Weekly tick = one ~1,474-line updater** running ~25 subsystems synchronously incl. full-asset `calculateNetWorth` walk + per-symbol `getStockInfo` loop; StrictMode double-invokes in dev. | `GameActionsContext.tsx:285-1759`, `preTick.ts:37-157` |
| PERF-6 | P2 | **Fixed `setTimeout(50ms)` post-tick** — pure latency tax, no compute purpose. | `GameActionsContext.tsx:1620` |
| PERF-7 | P2 | `work.tsx` re-renders fully each tick (memo useless because `useGame()` returns new object); `streetJobs` filtered twice per render, unmemoized. | `work.tsx:110-125` |
| PERF-8 | P2 | Always-mounted `TopStatsBar`/`IdentityCard` consume broad `useGame()` + unmemoized `.find()` in render. | `TopStatsBar.tsx:337,359` |
| — | OK | No timer/listener leaks (autosave, live-stream, app/index all clean up). |

## D. Architecture / decomposition / CI

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| ARCH-1 | **P1** | **~10,293 lines of `lib/simulation/*` ship in the production bundle** via static chain `TopStatsBar:45 → SettingsModal:18 → DevToolsModal:13 → TestRunner:9 → ComprehensiveGameSimulator`. No lazy/`__DEV__` gate; TopStatsBar is on every screen. **Confirmed by grep.** | chain verified |
| ARCH-2 | P1 | **53 component files have zero importers** (dead code). todo.md's "removed" ledger is **wrong**: `NetWorthDisplay` and `TombstonePopup` still present. | import-grep |
| ARCH-3 | P1 | **CI preflight is `continue-on-error: true`** (non-blocking); EAS build runs regardless → misconfigured revenue config can ship. Android matrix leg missing 3 `*_ANDROID` ad-unit env vars. | `eas-build.yml:67-69,75-79` |
| ARCH-4 | P2 | Mega-files: `work.tsx` 4,577 (74% is a 3,370-line stylesheet), `GameActionsContext` 3,182 (`nextWeek` ~1,474), `types.ts` 2,709, `SettingsModal` 1,902, `DeathPopup` 1,901, `IdentityCard` 1,783, `_layout.tsx` 1,413. | wc -l |
| ARCH-5 | P2 | Constants drift: `100000`/`1000000` cost literals across company/political/family-business actions; time-ms formulas duplicated in ~15 files (no `MS_PER_DAY`/`MS_PER_WEEK`). | gameConstants gaps |
| ARCH-6 | P3 | 11-level provider pyramid — flattenable via `composeProviders` (keep the per-provider boundaries). Low priority. | `GameProvider.tsx` |
| — | OK | `entry.ts` 17 lines compliant; `check-route-conflicts.cjs` wired into CI+preflight; `gameConstants.ts` well-adopted (72 importers). |

## E. UX / design system / accessibility

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| UX-1 | P1 | **5,814 hex literals / 204 files**; only 62 import theme.ts. Glass primitives exist only in onboarding. | grep |
| UX-2 | P1 | **`BaseModal` adopted in 7 files; 102 render `<Modal>` directly.** Its docstring claims a 43-modal migration that never happened. | grep |
| UX-3 | P1 | **~16% a11y coverage** (163 `accessibilityLabel` / 1,020 `onPress`); `accessible=` used 0×. IdentityCard rows, LoanManager (27 onPress/0 labels), work.tsx, market, FamilyTab, DeathPopup unlabeled. | grep |
| UX-4 | P1 | **5 files import `expo-blur` directly** (no fallback) despite documented iOS 26+ TurboModule crash risk + existing `BlurViewFallback`: SettingsModal, PremiumLoadingScreen, SmartNotificationCenter, EnhancedDataVisualization, SkillTreeModal. | grep |
| UX-5 | P2 | theme.ts color layer not SSOT: no elevation scale, no interactive-state tokens, glass colors string-interpolated. **Likely contrast bug:** light-mode `textSecondary`/`textMuted` ordering inverted vs dark. Parallel `onboardingTheme.ts` duplicates tokens. | `theme.ts:93-94` |
| UX-6 | P2 | **561 raw `fontSize:<number>`** bypass `fontScale()`; 142 `LinearGradient` use inline hex not `palette.gradient*`. | grep |
| UX-7 | P2 | Reduced-motion respected in only 7 files (all Pulse/Spark); no shared `useReducedMotion()` hook. | grep |
| UX-8 | P3 | **Phase F priority list in todo.md is stale** — listed files (BitcoinMiningApp, GamingApp…) now have 0–1 hex. Real offenders: work.tsx (269), SettingsModal (148), LoanManager (118), DeathPopup (117). | grep |

---

# PART 2 — MASTER REMEDIATION PLAN (sequenced)

Each phase ends with a verification gate. Owner=ops/account action; Dev=in-repo.

## SPRINT 0 — Release unblock & cheap regression guards (days)

**0.1 (Dev, P0) — Pull or wire the dead IAPs (MON-2, MON-3).** Decision per product:
either implement consumers (privateBanking→cap loan APR at 3% in `LoanActions.ts:285`;
premiumCreditCard→10% cashback in `lib/banking/operations.ts`; businessBanking→gate company
loans; moneyMultiplier→read in `applyIncome.ts`) **or remove the products from the store +
UI.** Shipping them as-is is a guaranteed App Store rejection. Consolidate the 3 apply paths
(MON-9) while here.

**0.2 (Ops, P0) — Stand up IAP verification (MON-1).** Decide **RevenueCat** (recommended,
~½ day, replaces the verify backend + dedup) vs self-hosted endpoint to the contract the
client already expects:
- `POST {URL}` · headers `Content-Type: application/json` + `Authorization: Bearer {TOKEN}`
- body `{ receipt, productId, transactionId }` · 8s timeout
- responds `{ "verified": true|false }`; server does Apple verifyReceipt (21007→sandbox retry)
  / Google `purchases.products.get`, validates bundle `com.deeplife.simulator`, dedups by transactionId.
Set `EXPO_PUBLIC_IAP_VERIFY_URL` (+token) as EAS secrets.

**0.3 (Dev, ARCH-1) — Stop shipping the simulator suite in prod.** Convert `DevToolsModal`
(and `TestRunner`) to `React.lazy`/dynamic `import()` and `__DEV__`-gate so ~10K lines tree-shake
out of release. Biggest single bundle-size win.

**0.4 (Dev, ARCH-3) — Make CI preflight blocking.** Mirror EAS secrets into GitHub Actions
secrets; remove `continue-on-error: true` (eas-build.yml:68); add the 3 missing `*_ANDROID`
ad-unit vars to the android matrix env. Type-check is already 0 errors, so this is safe now.

**0.5 (Dev, regression guards) — Add ESLint rules** (start `warn`, flip to `error` after Sprint 1):
ban `as any` (`@typescript-eslint/no-explicit-any` + TSAsExpression>TSAnyKeyword selector),
ban internal code `require()` (`@/lib|utils|contexts`), `ban-ts-comment` with description.
Add `npm run lint` to `preflight`.

**0.6 (Dev, PERF quick wins) — Cap arrays at write time** (PERF-3, PERF-4): `memories`(200),
`journal`(50), `lifeMilestones`(200), `sparkApp.messages`(50/thread + thread-count cap),
`jealousyHistory`(50), `darkWeb.recentEvents`(50), `hustleApp.notifications`(100),
`travelHistory`(100), `warehouse.miningHistory`(100), `competitionHistory`(100). Add the
missed arrays to `pruneSaveData`. Remove the fixed `setTimeout(50)` (PERF-6).

**Gate:** `npm test` green, `npm run type-check` 0, `npm run preflight` passes with secrets set.

## SPRINT 1 — Type-safety burndown & store compliance (1–2 weeks)

**1.1 (Dev, TS-1/TS-4) — High-risk gameplay casts, per-file, type-check after each:**
`crossSystemSummary.ts`, `milestones.ts`, `travel/operations.ts`+`transportation.ts` (adopt
the `requirements.ts` guards — closes the Hard-Rule-2 violation), `contacts/aggregator.ts`,
`consequenceTracker.ts`, `legacy/inheritance.ts`. Removing each cast lets the compiler surface
any *real* schema gap (fix at source, don't re-cast).

**1.2 (Dev, TS-2/TS-3) — Context-write casts:** delete the 23 `useGame() as any` (per app-folder
batches) and the `as any[]` income loops. Replace `{} as any` fallbacks (TS-5) with typed defaults.

**1.3 (Dev, MON-4/5/6/7) — AdMob + compliance:** gate `BannerAd` on persisted `adsRemoved`/
`lifetimePremium`; integrate Google UMP consent for Android/EU; set the 6 ad-unit EAS secrets;
update `UPDATED_PRIVACY_POLICY.md` + App Store privacy labels to match shipped ad state.

**Gate:** `as any` count down to style-casts only; UMP consent verified on Android; `npm test` green.

## SPRINT 2 — Performance: context split & tick budget (2–3 weeks)

**2.1 (Dev, PERF-1/2/7/8) — Selective subscription.** Migrate always-mounted hot components
(`TopStatsBar`, `IdentityCard`, tab roots, `work.tsx`) off `useGame()` onto the existing narrow
selector hooks (`useGameStats`, `useGameMoney`, `useGameAge`). Introduce
`useGameSelector(selector, eq)` backed by `useSyncExternalStore`; deprecate `useGame()` for live
components. Stop stamping `updatedAt` in the setter — stamp at save time.

**2.2 (Dev, PERF-5) — Tick hot path.** Compute `calculateNetWorth` and stock price/yield maps
once per tick and thread through; gate low-frequency subsystems (politics, dark web, NPC depth)
to every-N-weeks; move automation off the interaction frame.

**2.3 (Dev, tests) — Performance budget.** Extend `realProviderLoop.stress.test.ts` with p95
timing (`expect(p95).toBeLessThan(70)`) and a heap-slope probe (≤0.1 MB/week). Tighten
`stateGrowthAudit.stress.test.ts` to 1.5 MB at 1000 weeks + per-array length invariants. Add a
render-counter regression test for `TopStatsBar`. **Budget targets:** tick mean ≤50ms / p95 ≤70ms;
heap ≤0.1 MB/week; save ≤1.5 MB @1000 weeks.

**Gate:** new perf assertions pass; full suite green.

## SPRINT 3 — Architecture decomposition & dead-code (1–2 weeks, can parallel Sprint 2)

**3.1 (Dev, ARCH-2) — Delete the 53 orphaned files** after a fresh re-scan (don't trust the
stale ledger). Update todo.md's dead-code section to reality.

**3.2 (Dev, ARCH-4) — Decompose mega-files** (extract stylesheets first — biggest, safest win):
`work.tsx`→`work.styles.ts` + `components/work/{JobCard,CareerCard,StreetJobsTab,CareerTab,CrimeSkillsTab,NegativeStatsModal}.tsx`;
`nextWeek`→`actions/weekly/runWeeklyTick.ts`; `resolveEvent`→`actions/events/resolveEvent.ts`;
SettingsModal/DeathPopup/IdentityCard styles + sub-components; `_layout.tsx` startup helpers→`app/startup/*`.
Split `types.ts` into domain barrels **last** (protected file, careful).

**3.3 (Dev, ARCH-5) — Extract constants:** `MS_PER_HOUR/DAY/WEEK` + the `100000`/`1000000`
cost literals into `gameConstants.ts`.

**Gate:** Game State Reviewer + Save System Auditor subagents on any context/type changes; suite green.

## SPRINT 4+ — Liquid Glass design system rollout (3–5 weeks, the big visible UX upgrade)

**4.1 (Dev, UX-5) — Token foundation (no UI change):** extend `theme.ts` with surface-elevation
scale, interactive-state tokens (`selected/pressed/disabled/focus`), tokenized glass, text-on-color;
fix the light-mode `textSecondary`/`textMuted` inversion; fold `onboardingTheme.ts` in; refactor
`glassmorphismStyles.ts` to read tokens. Add ESLint rule blocking new hex outside `lib/config/`.

**4.2 (Dev, UX-4) — Shared glass primitives:** build `components/ui/glass/{GlassSurface,GlassButton,
GlassCard,GlassSegmentedControl,GlassHeader}` from the onboarding components (switch `darkMode`
source to `useTheme()`, always import `BlurViewFallback`). Migrate the 5 direct `expo-blur`
importers first (crash risk).

**4.3 (Dev, UX-2) — Modal unification:** migrate top hand-rolled modals (DeathPopup, SicknessModal,
WeddingPlanningModal, DivorceConfirmModal, MemoryBookModal, SettingsModal) to `BaseModal`; build
shared `<LoadingState>` + `<EmptyState>`.

**4.4 (Dev, UX-1/6/8) — Per-screen hex migration** in offender order (work.tsx 269 → SettingsModal
148 → LoanManager 118 → DeathPopup 117 → …); replace raw font sizes with `fontScale()`. Update
todo.md's stale Phase F list.

**4.5 (Dev, UX-3/7) — Accessibility pass:** shared `useReducedMotion()` hook gating all animation;
`accessibilityRole/Label/Hint` + `accessible` grouping on the gap-list files. Target ≥90% label coverage.

**4.6 (Dev) — Visual regression:** snapshot key screens light/dark + reduce-motion on/off; CI diff per migration PR.

**Gate:** VR snapshots stable; a11y coverage ≥90%; suite green.

## PARALLEL TRACK — Product depth & live-ops (months)
Vertical-slice quality bar, narrative content packs, economy telemetry, deterministic sim tests,
per-release quality scorecard. Gated on Sprints 0–2 landing.

---

# PART 3 — NEW PERMANENT SAFETY NETS (force-multipliers)

1. **ESLint rules** (Sprint 0.5): ban `as any`, ban internal `require()`, `ban-ts-comment`. Add lint to preflight.
2. **`applyGemDelta` + idempotency keys** beside `applyMoneyDelta` — route every gem grant through it (kills the double-claim class).
3. **Single income ledger** (`incomeThisWeek` fed only by genuine income) — kills transfer-farming of "earn $X" goals.
4. **Money-conservation invariant test** (Σ deltas == end−start) in the stress suite.
5. **Performance budget tests** (Sprint 2.3) — tick p95 + heap slope + per-array caps + render-count.
6. **CI preflight blocking** (Sprint 0.4) — the gate that stops misconfigured revenue config shipping.
7. **Hex-literal lint rule** (Sprint 4.1) + **VR snapshots** (Sprint 4.6).

---

# IMPLEMENTATION LOG

## Sprint 0.3 + 0.6 — shipped 2026-06-09 (`claude/app-audit-roadmap-f5ukvy`)

**0.3 — Simulator suite no longer ships in production (ARCH-1).** Traced the chain to a
single live entry edge: `TopStatsBar → SettingsModal:18 (static import) → DevToolsModal →
{TestRunner→ComprehensiveGameSimulator, AIDebugMenu→SimulationRunner→RealActionSimulator}`.
`AppSimulationMenu` (the other SimulationRunner importer) is orphaned, so cutting the one edge
strips the whole ~10k-LOC graph. Replaced the static import with a build-time-gated conditional
require: `DEV_TOOLS_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEVTOOLS === 'true'`
(matches the codebase's existing `EXPO_PUBLIC_*` flag convention; statically foldable so Metro
drops the branch from App Store builds). Gated the Dev Tools button + modal mount on the same
flag (so they're dev/QA-only, with an env opt-in for TestFlight). Added an a11y label on the
button while there. Files: `components/SettingsModal.tsx`.

**0.6 — Memory caps (PERF-3/4).** Write-site caps added for the two arrays confirmed to grow
unbounded per real reading: `memories` (GameActionsContext.tsx, cap 200, mirrors the adjacent
`EVENT_LOG_CAP` idiom — this was the primary heap driver) and `sparkApp.jealousyHistory`
(SparkActions.ts, cap 50). Save-time safety net (`pruneSaveData`) extended for `darkWeb.recentEvents`
(50), `sparkApp.jealousyHistory` (50), `travelHistory` (100). Regression invariants added to the
state-growth stress test (organic post-loop assertions, not re-implemented caps).

**Audit corrections found while implementing** (verified by direct reading — the auditors
over-reported "capped nowhere"): `sparkApp.messages` is already capped per-thread on BOTH paths
(`MESSAGE_HISTORY_CAP=100`, SparkActions:348,420); `lifeMilestones` only grows on child births
(bounded); `recentEarnings` is under `HustleIPO` (write-capped at 3), not `politics`;
`hustleApp.notifications` is nested under `HustleCompanyOverlay` (per-company, low growth — skipped);
`competitionHistory`/`miningHistory` are deeply nested (per-company / MiningStatistics — skipped as
low-growth/high-risk). The remaining live state grower is `checkpoints` (time-machine, +73KB/1000wk
in the serialized audit) — out of 0.6 scope; total serialized payload at 1000 weeks is ~143 KB.

**PERF-6 (remove `setTimeout(50)`) — NOT done, deliberately.** The audit called it a "pure
latency tax," but direct reading shows it's load-bearing: `nextWeek` awaits it so React flushes
the `setGameState` and `gameStateRef.current` (synced in render at GameActionsContext:2341)
reflects the new state before validation + save run. Removing it would validate/save STALE state.
It can only be removed safely when `nextWeek` is refactored to return its computed next-state
directly (Sprint 2.2). Flagged there.

**Verification:** `npm run type-check` 0 errors; `npx jest --ci` → **2344 passed / 145 suites /
308 snapshots** (zero regressions); state-growth invariants green; no test referenced DevToolsModal.

## Sprint 0.5 (ESLint guardrails) + 1.1 (high-risk as-any burndown, clean subset) — shipped 2026-06-09

**0.5 — Type-safety guardrails (`eslint.config.js`, `package.json`).** Added three rules,
scoped to `**/*.{ts,tsx}` (TS-only so the `@typescript-eslint` plugin is registered and plain
`.js` config files don't break): (1) ban `as any` via `no-restricted-syntax`
`TSAsExpression > TSAnyKeyword`; (2) ban internal `require('@/lib|@/utils|@/contexts')` via
`no-restricted-syntax`; (3) `@typescript-eslint/ban-ts-comment` (bare `@ts-ignore`/`@ts-nocheck`
banned, `@ts-expect-error` needs a ≥5-char description). Globally `'warn'` during the burndown
(~320 `as any` + ~95 internal requires remain — visibility without blocking); ratcheted to
`'error'` for `lib/travel/**` (the first fully-clean dir). Tests opt out (they legitimately use
`as any`/`require`). Added `lint:errors` (`eslint --quiet`, errors-only) and wired it into
`preflight` so the ratchet + ban-ts-comment block locally; CI's existing `npm run lint` step
already blocks on errors.

**Guardrail immediately paid off:** caught 3 bare `@ts-ignore`s in `src/dev/animatedDriverGuard.ts`
(missed by manual greps) — converted to documented `@ts-expect-error` (they suppress real
read-only-`Animated.*` monkey-patch errors; type-check confirms no unused-directive).

**1.1 — High-risk `as any` burndown (clean, behavior-preserving subset).**
- **TS-4 (Hard-Rule-2 violation):** `lib/travel/operations.ts` (5 casts) + `transportation.ts`
  (1 cast) → 0. `destination.requirements` is already `TravelDestinationRequirements`
  (money/happiness/items typed); `Item` has `id`/`owned`; `politics.activePolicyEffects.transportation`
  is typed. All removals behavior-identical; dir now enforced at `error`.
- **TS-7:** `IdentityCard.tsx` `(gameState as any).loans` → `gameState.loans` (typed `Loan[]`).

**Deliberately deferred (investigative, NOT mechanical).** `lib/statistics/crossSystemSummary.ts`
(~13 casts) and `StatisticsApp.tsx` look like easy `(state as any).X → state.X` removals, but
direct reading shows the card readers reference legacy/mismatched sub-shapes — e.g. `realEstateCard`
reads `realEstate.properties` though `realEstate` is now `RealEstate[]` (a latent display bug).
Removing those casts type-checks ~15 child-field reads and would force behavior changes / protected
`types.ts` edits per field. That is per-field schema reconciliation, not a cast sweep, so it's queued
as a focused task rather than risked in a type-safety pass on money-display code. The 23
`useGame() as any` sites (TS-2) are similarly per-component (each surfaces whatever fields that
screen reads) — next batch. The 185 RN-web `boxShadow … as any` casts (Phase 5) await the
`webShadow` typed helper.

**Verification:** `npm run type-check` 0 errors; `npx eslint . --quiet` (errors-only) **0 errors**
repo-wide; `lib/travel` clean at `error`; rules fire as `warn` on remaining offenders.

## MON-2 — Wire the 3 dead bank IAPs to deliver value — shipped 2026-06-09

User decision: **wire them** (IAP verify backend MON-1 deferred). Each flag was set on purchase
but read nowhere ("paid, delivers nothing" — App Store 2.3.1 risk). Now each delivers its
advertised value, with copy aligned to what actually ships:

- **Private Banking ($9.99) → "VIP 3% APR loans."** Added an `aprCap` to `quoteLoan`
  (`lib/banking/operations.ts`) and thread `privateBankingAprCap(state)` (0.03) through both
  new-loan quotes and refinance (`contexts/game/actions/LoanActions.ts`). Caps the offered rate at
  3%, never below the 0.025 floor. Regression test added (`lib/banking/__tests__/operations.test.ts`).
- **Premium Credit Card ($4.99) → "10% cashback."** Added a `minRewardsRate` floor to
  `chargeCreditCard`; `spendOnCard` passes 0.10 when owned (`BankingActions.ts`). Effective rate =
  `max(card.rewardsRate, 0.10)`. Not a faucet — cashback is a fraction of money the player spends.
- **Business Banking ($3.99) → "15% off all company upgrades."** Applied a 15% discount to the
  upgrade cost in **both** `buyCompanyUpgrade` implementations (`company.ts` and
  `actions/CompanyActions.ts` — the live path was ambiguous, so both get it consistently). Chose a
  value-add discount over *gating* `buyCompanyUpgrade` (gating would remove existing functionality
  from non-payers — a dark pattern). Updated the advertised copy in `utils/iapConfig.ts` to "15%
  off all company upgrades" (the old "Company loans" claim described a feature that does not exist).

**Verification:** type-check 0 errors; `eslint --quiet` 0 errors; `jest` 2344 passed / 145 suites;
new Private Banking APR-cap test green; zero regressions.

**Note for the IAP backend (MON-1, when revisited):** these effects are gated only on
`settings.*` flags. Until the verify backend (RevenueCat or endpoint) exists, the flags can't be
purchased in production (verifyReceiptWithServer fails closed) — so the wiring is dormant but
correct, and activates the moment MON-1 lands.

## TS-2 — Remove all `useGame() as any` casts — shipped 2026-06-09

`useGame()` already returns a fully-typed merged context value; the 23 `as any` casts across
Spark/Pulse/Hustle screens + modals disabled type-checking for no reason. Stripped all 23 — type-check
clean with **zero masked errors** surfacing, full suite 2345 passed. (Broader scattered `as any`
left alone — those are investigative, not mechanical.)

## QUAL-1 — Consolidate the duplicated company-upgrade catalog — shipped 2026-06-09

While wiring Business Banking (MON-2) I hit the catalog duplicated **5×**: `createCompany` (typed),
`buyCompanyUpgrade` (×2 — `company.ts` + `actions/CompanyActions.ts`), `sellCompany`, and the
simulator. The copies had already drifted into different field projections (some carried
`costMultiplier`, some `weeklyIncomeBonus`, etc.) though the underlying cost/maxLevel values still
matched — a cost change would have needed edits in five places to stay consistent.

Extracted the rich typed table to a single source — `contexts/game/companyUpgradeCatalog.ts`
(`COMPANY_UPGRADES` + `COMPANY_UPGRADE_COST_MULTIPLIER`) — and repointed all five sites at it.
Diffed every copy first to prove values were identical, so the change is behavior-preserving (also
fixed `sellCompany`, which read a now-absent `costMultiplier` field → routed to the shared const).
Removed 4 `Record<string, any[]>` casts in the process. Type-check + lint clean; full suite 2345
passed; zero regressions.

## TS-3 — Type the statistics layer + fix two bugs the `as any` masked — shipped 2026-06-09

Removing the `as any` here surfaced two real latent bugs (this is why the earlier pass flagged it
as investigative, not mechanical):

1. **Net-worth & earnings trends were always flat/0.** `StatisticsApp` passed
   `lifetimeStatistics.netWorthHistory` (a `NetWorthSnapshot[]` of `{week,value}` objects) straight
   into `trendOf(series: number[])`. `trendOf` filters `typeof v === 'number'`, so every snapshot
   was discarded → empty series → flat. Fixed by mapping to `.value`. Typed `lifetime` as
   `Partial<LifetimeStatistics>` and removed ~15 `(lifetime as any)` / `(gameState as any)` casts;
   all accessed fields are real members of the type.
2. **The real-estate cross-system card never rendered.** `crossSystemSummary` read
   `state.realEstate?.properties` — a stale schema where `realEstate` was an object. Today
   `state.realEstate` is `RealEstate[]`, so `?.properties` was always `undefined` → `props = []` →
   card skipped. Fixed to read the typed array filtered to `owned` (matching
   `lib/economy/expenses.ts`), valuing each at `currentValue ?? price`. Added two regression tests.

Then fully typed the cross-system cards (removed every `: any` local), which the compiler used to
surface **four more silent-data bugs** of the same class — each card read a field name that does
not exist on the real type, so the `as any` made them quietly render 0 / '—':

- **Banking card** read `creditScore` as a number (real: `creditScore.score`),
  `lifetimeInterestPaid`/`lifetimeInterestEarned`/`lifetimeLateFees` (real: `total*`), and
  `banking.loans` (real: `state.loans`) — every detail was wrong. Fixed + updated the test, which
  had encoded the same stale shape.
- **Crypto card** read `cryptoMarket.realizedGains` (real: `totalRealizedGains`) → always $0.
- **Stocks card** read `stocks.lifetimeDividends` (real: `totalDividends`) → always $0.
- **Vehicles card** read a non-existent `accidentCount` → always 0; replaced with average condition.

Added regression tests for the realEstate, crypto, and stocks fixes. `milestones.ts` typed cleanly
(no stale fields there). Type-check + lint clean; statistics suite 28 passed; full suite 2349
passed / 145 suites.

Net for TS-3: **6 latent display bugs fixed** (2 trends + 4 cards), the whole statistics layer typed,
and ~25 `as any`/`: any` removed — all caught by *removing* casts, not by reading the UI.

---

# PART 4 — VERIFICATION CHECKLIST (per the project's gates)

- [ ] `npm test` green after every sprint (currently 2344/2344).
- [ ] `npm run type-check` stays at 0 errors.
- [ ] `npm run preflight` passes (and is blocking in CI).
- [ ] Game State Reviewer subagent on any contexts/actions/state change.
- [ ] Save System Auditor subagent on any types.ts/initialState/saveValidation change.
- [ ] No new `as any` / internal `require()` / hex-literal (enforced by lint).
- [ ] Perf budget assertions pass (tick p95 ≤70ms, heap ≤0.1 MB/week).
</content>
