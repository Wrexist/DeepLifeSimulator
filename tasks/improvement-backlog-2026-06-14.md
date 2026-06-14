# DeepLife Simulator — Consolidated Improvement Backlog (2026-06-14)

> A complete, **source-verified** list of everything that still needs to be improved or changed.
> Built by re-reading current code on `claude/improvement-backlog-xhmook`, not by trusting
> the older round-10/11 audit docs. Items those docs flagged that are now **fixed in code**
> are listed at the bottom so the backlog stays honest.
>
> Verification note: `node_modules` is not installed in this environment, so the test suite
> and type-check were **not** re-run here. Last recorded green baseline (2026-06-11):
> **2356 tests pass, `type-check` 0 errors**. Findings below are from direct source reads.
>
> Severity: **P0** release/revenue/store blocker · **P1** high · **P2** medium · **P3** low/polish.

---

## 1. Release & revenue blockers (P0 — mostly ops, small code surface)

| # | Sev | Item | Evidence / action |
|---|-----|------|-------------------|
| 1 | P0 | **IAP verification backend missing.** `verifyReceiptWithServer` correctly *fails closed* when `EXPO_PUBLIC_IAP_VERIFY_URL` is unset — so **every real purchase is refused**. No backend exists. | `services/IAPService.ts:275-321`. Stand up RevenueCat (~½ day) or a verify endpoint (`{receipt,productId,transactionId}` → `{verified:bool}`); set `EXPO_PUBLIC_IAP_VERIFY_URL` + token as EAS secrets. |
| 2 | P0 | **AdMob ships Google *test* ad unit IDs** by default → zero ad revenue. | `services/AdMobService.ts:102-122`. Set the 6 `EXPO_PUBLIC_ADMOB_*` EAS secrets. |
| 3 | P0 | **`EXPO_PUBLIC_SAVE_HMAC_KEY` must exist as an EAS secret** and never change post-launch (or every existing save invalidates). | Preflight blocker — confirm it's set. |
| 4 | P0 | **Rotate + purge the leaked Google Play service-account key** (history rewrite on `main`, owner-only). | Ops/security. |
| 5 | P0 | **Privacy policy says AdMob is "Currently disabled in this version"** while a build that ships ads contradicts it → App Store privacy-label mismatch. | `UPDATED_PRIVACY_POLICY.md:31,152`. Either keep ads off at launch or update the policy before enabling. |
| 6 | P0 | **CI preflight is non-blocking** (`continue-on-error: true`) — a missing secret, test-ad ID, or type regression can silently ship. Android matrix leg also missing 3 `*_ANDROID` ad-unit env vars. | `.github/workflows/eas-build.yml:61-69`. Make preflight a hard gate ahead of `eas build --profile production`. |

---

## 2. Monetization correctness (P1/P2)

| # | Sev | Item | Evidence |
|---|-----|------|----------|
| 7 | P1 | **Remove-Ads not honored after relaunch.** `BannerAd` gates on in-memory `iapService.hasPurchased()`, not persisted `settings.adsRemoved`/`lifetimePremium` → ads can reappear for payers. | `components/BannerAd.tsx:32-35` |
| 8 | P1 | **Android serves personalized ads with no consent.** `isTrackingAllowed()` returns `true` unconditionally on Android; no UMP/GDPR flow. | `utils/trackingTransparency.ts:78` |
| 9 | P2 | **Three divergent entitlement-apply paths** (`applyBenefitToDisk`, `applyProductToState`, `ShopModal.applyPurchaseBenefits`) — drift risk; consolidate to one. | IAPService + ShopModal |
| 10 | P2 | **Vestigial reads:** `goldUpgrades.work_boost/fast_learner/mindset` are read but written nowhere (IAP writes `perks.*`). Dead OR-branches. | `MoneyActionsContext.tsx:161-170` |
| 11 | P2 | **`settings.moneyMultiplier` flag** is set by the Premium Pack but income reads `goldUpgrades.multiplier`, not the flag — confirm the Premium Pack actually sets `goldUpgrades.multiplier` or the flag is dead. | `contexts/game/actions/weekly/applyIncome.ts:85` |

---

## 3. Economy / exploit leftovers (P1–P3)

| # | Sev | Item | Evidence |
|---|-----|------|----------|
| 12 | P1 | **Uncapped perk income multiplier stacking.** `perkIncomeBonus` is an unbounded product of perk `incomeMultiplier`s — stacks to arbitrary multipliers. Add a cap. | `contexts/game/actions/weekly/applyIncome.ts:91-105` |
| 13 | P1 | **SicknessModal shows "manageable" treatment text for *terminal* diseases.** `getTreatmentRecommendations` only checks `disease.curable`; it doesn't distinguish manageable-chronic (`chronic:true`) from scripted-death (`curable:false` + `weeksUntilDeath`). Player is told to "seek treatment" for a futile condition. | `components/SicknessModal.tsx:203-228`; `lib/diseases/diseaseDefinitions.ts:274-327` |
| 14 | P2 | **Dark-web raid trusts its caller for jail time.** `weeklyTick` returns `jailWeeksAdded` with no internal `inJail` guard (the crime tick has one) — inconsistent; raids can extend jail while already jailed depending on the integration point. | `lib/darkweb/weeklyTick.ts:114-122` vs `applyCrimeTick.ts:46-53` |
| 15 | P3 | **No capital-gains tax** on crypto/stock round-trips (likely intentional / not implemented — confirm as a design decision). | not found in `lib/crypto`/`lib/stocks` |
| 16 | P3 | **Airbnb/real-estate income variance hard-capped at 2.0×** — design decision, revisit if desired. | `lib/realEstate/tenancy.ts:130` |

---

## 4. Structural safety nets (P1 — each kills a *class* of recurring bugs)

| # | Sev | Item | Status |
|---|-----|------|--------|
| 17 | P1 | **`applyGemDelta(prev, amount, reason)`** with idempotency keys, beside `applyMoneyDelta` — route every gem grant (achievements, prestige, scenario, IAP, rewards) through it to end the "guard read outside the updater → double-claim" class. | Does not exist (only `applyMoneyDelta`). |
| 18 | P1 | **Single income ledger (`incomeThisWeek`)** fed only by genuine income; daily challenges / achievements / "earn $X" goals read it. Ends transfer/loan/sale farming. | Does not exist. |
| 19 | P1 | **Money-conservation invariant test** (Σ deltas == end−start) in the stress suite — auto-catches future money-printer/sink regressions. | Missing (no such test in `__tests__`). |
| 20 | P2 | **Lint rules.** `as any` + internal-`require()` are already wired as **warnings** in burndown mode — good. Next: (a) promote to `error` once burned down; (b) add a raw-hex-literal ban outside theme files. | Partial (`eslint.config.js:61-91`). |

---

## 5. Type-safety debt (P1/P2 — CLAUDE.md Hard Rule #2)

| # | Sev | Item | Evidence |
|---|-----|------|----------|
| 21 | P1 | **~299 `as any` across 123 files** (down from 322/139). Real gameplay/state casts remain — e.g. `IdentityCard.tsx` (5), `FinanceOverview.tsx` (3), plus net-worth/lifetime-stats rollups. This is where the next `.totalKarma`-class silent bug hides. Burn down per-directory with type-check after each batch. | grep |
| — | — | *Already fixed: `useGame() as any` now 0 (was 23); `travel/operations.ts` no longer casts requirements; `StatisticsApp.tsx` clean; internal `require()` down to ~6.* | — |

---

## 6. Performance & memory (P1/P2)

| # | Sev | Item | Evidence |
|---|-----|------|----------|
| 22 | P1 | **History arrays capped only at save, not at write** (grow unbounded between saves → heap creep): `competitionHistory`, `travelHistory`, `lifeMilestones`, `netWorthHistory`. Add write-time caps. | `RDActions.ts:426`; `saveQueue.ts:619,652,697` |
| 23 | P1 | **Monolithic weekly tick.** `nextWeek` is a single **1,474-line** synchronous updater (lines 297–1770) running ~25 subsystems incl. full `calculateNetWorth` asset walk. ~84ms mean / 101ms p95 per tick. Decompose; set a p95 budget (<50ms). | `contexts/game/GameActionsContext.tsx:297-1770` |
| 24 | P2 | **Fixed `setTimeout(50ms)` post-tick** — pure latency tax; replace with a real state-settled signal. | `GameActionsContext.tsx:1636` |
| 25 | P2 | **102 `useGame()` callers** still subscribe to all 9 contexts. Focused selector hooks (`useGameStats`, `useGameMoney`, …) now exist — migrate hot consumers to cut per-tick re-renders. | `contexts/game/index.ts:102-124` |
| 26 | P2 | **Unmemoized derived data in hot render paths** — `work.tsx` `streetJobs` double-filter; `TopStatsBar` inline `.find()`/`.filter()`. Mitigated by memo boundaries but still recompute. | `work.tsx:127`; `TopStatsBar.tsx:295+` |
| — | — | *Already fixed: PERF-1 (selector hooks + memoized combined hook), PERF-2 (no-op identity short-circuit), and write-time caps on `memories`, `eventLog`, spark messages/jealousy, dark-web events, hustle notifications, mining/crypto/stock history.* | — |

---

## 7. Architecture / maintainability (P2/P3)

| # | Sev | Item | Evidence |
|---|-----|------|----------|
| 27 | P2 | **Mega-files** to decompose: `work.tsx` 4,601 (≈74% is a 3,370-line stylesheet), `lib/events/engine.ts` 3,247, `GameActionsContext` 3,207, `types.ts` 2,711, `initialState` 1,714, `SettingsModal` 1,919, `DeathPopup` 1,901, `IdentityCard` 1,783, `TopStatsBar` 1,609, `_layout.tsx` 1,413. | `wc -l` |
| 28 | P2 | **Dead code.** Zero-importer components still present (confirmed: `NetWorthDisplay`, `TombstonePopup`; round-11 counted ~53). Prune. | import-grep |
| 29 | P2 | **Constants drift.** `100000`/`1000000` cost literals across company/political/family-business actions; time-ms formulas duplicated across ~15 files (no `MS_PER_DAY`/`MS_PER_WEEK`). Centralize in `gameConstants`. | grep |
| 30 | P3 | **11-level provider pyramid** — optionally flatten via `composeProviders` (keep per-provider boundaries). | `GameProvider.tsx` |

---

## 8. UX / design system / accessibility (P1/P2)

| # | Sev | Item | Evidence |
|---|-----|------|----------|
| 31 | P1 | **~4,761 hex literals across 204 files; only 62 import `theme.ts`.** Glass primitives still onboarding-only. Promote `GlassSurface/Button/Card/SegmentedControl` to a shared `components/ui/glass/` layer backed by semantic tokens; migrate tab-by-tab with `expo-blur` + fallback. | grep |
| 32 | P1 | **`BaseModal` adopted in 7 files; 66 raw `<Modal>` renders remain** (down from 102). Finish the migration. | grep |
| 33 | P1 | **~21% a11y coverage** (167 `accessibilityLabel` / 786 `onPress`); `accessible=` used 0×. Add labels/roles to IdentityCard rows, LoanManager, `work.tsx`, market, DeathPopup. | grep |
| 34 | P1 | **5 files import `expo-blur` directly with no fallback** despite the documented iOS 26+ TurboModule crash risk and an existing `BlurViewFallback`: `SettingsModal`, `PremiumLoadingScreen`, `SmartNotificationCenter`, `EnhancedDataVisualization`, `SkillTreeModal`. | grep |
| 35 | P2 | **theme.ts contrast/SSOT gaps.** Light-mode `textSecondary`/`textMuted` ordering is **inverted vs dark** (`theme.ts:79-80` vs `93-94`) — likely contrast bug. No elevation/interactive-state tokens; parallel `onboardingTheme.ts` duplicates tokens. | `lib/config/theme.ts:79-94` |
| 36 | P2 | **559 raw `fontSize:<number>`** bypass `fontScale()`; ~142 `LinearGradient` use inline hex not `palette.gradient*`. | grep |
| 37 | P2 | **Reduced-motion respected in only 7 Pulse/Spark files**; add a shared `useReducedMotion()` hook and apply app-wide. | grep |

---

## 9. Product depth & content (design decisions / longer-term)

| # | Sev | Item |
|---|-----|------|
| 38 | P2 | **FirstWeekGuide rewards** (`money/gems/energy` step rewards) are declared in `components/FirstWeekGuide.tsx:49-110` — verify they're actually *granted*; the guide previously referenced a non-existent "Challenges tab" / unused `utils/dailyChallenges.ts`. Wire up or remove. |
| 39 | P2 | **Flat first-milestone gems** — `first_dollar/job/purchase` grant 0 gems; day-1 login gem gated behind tutorial completion. Revisit early-game reward curve. |
| 40 | P3 | **Long-term roadmap:** vertical-slice quality bar (one full premium life arc), live-ops content pipeline, deterministic simulation tests + per-release quality scorecard (retention, stability, economy fairness). |

---

## Recently FIXED (verified in code — no longer backlog)

- **Economy:** banking money printer (C-1/H-1), mining/staking printers (H-2/H-3), dark-web grinding (H-4), prestige farming (H-5), M-1/M-2/M-3/M-4/M-6/M-7, finite guards (L2/L3/L5/L8), crypto round-trip spread (L-1), quarterly dividends (L-3), $10k cashback cap (M-5).
- **Save/crash:** version re-stamp crash (C1), nested-subsystem backfill (H1), validator/repair array unification (H2), vaccinations vs immunities (H3), jail-screen partial-save crash, jailWeeks overshoot.
- **Stability/UX:** jail soft-lock escape, loading-screen revamp, warning-triangle removal, error→emailable bug reports, overlapping error banners, top-of-screen gap.
- **Monetization:** the 3 "dead" bank IAPs are now wired (`privateBankingAprCap`, `premiumCreditCard` cashback, `businessBanking` discount); `everythingUnlocked` unlocks gold upgrades.
- **Arch/perf/types:** simulator suite (~10K LOC) now `require()`-gated behind `DEV_TOOLS_ENABLED` (ARCH-1); iOS splash configured (`expo-splash-screen` plugin); PERF-1/PERF-2; `useGame() as any`→0; `travel/operations` guard cast; internal `require()`→~6; eslint `as any`/`require` warnings.
</content>
