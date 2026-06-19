# DeepLife Simulator — Master Execution Plan

**Date:** 2026-06-19
**Companion to:** `tasks/retention-and-content-strategy-2026-06-19.md` (the "why")
**This doc:** the "how" — every initiative broken into phases with tasks, files,
dependencies, acceptance criteria, verification, and risks.
**Status:** Proposal for review — nothing built yet.

---

## How to use this plan

- Work **top to bottom** — waves are ordered by dependency, not preference.
- Each initiative follows the same template:
  **Goal → Phases (with tasks) → Files → Dependencies → Definition of Done (DoD) → Verification → Risks.**
- `[ ]` = checkable task. Don't tick a phase done until its **Verification** passes.
- **Hard rule for every phase:** run `npm run preflight:quick` (type check) during
  work and `npm run preflight` before merge. Any change to `contexts/`, actions, or
  state logic must pass the **Game State Reviewer** subagent; any change to
  `types.ts` / `initialState.ts` / `saveValidation.ts` must pass the **Save System
  Auditor** subagent (per `CLAUDE.md`).
- **Every state change uses `setGameState(prev => …)`**, never mutation, and calls
  `saveGame()` after. **All time comparisons use `weeksLived`, never `week`.**

### Effort key
`S` = ≤2 days · `M` = 3–5 days · `L` = 1–2 sprints · `XL` = multi-sprint

### Wave map

| Wave | Theme | Gate to exit wave |
|------|-------|-------------------|
| 0 | See & Stabilize | Analytics live; purchases work; daily-login UI shipped |
| 1 | Daily Loop | D1/D7 instrumented and trending up |
| 2 | Live-Ops Engine | One season shipped via remote pipeline without an app update |
| 3 | Social & Share | Leaderboards live; Legacy Card shareable |
| 4 | Differentiate | Living Story arc shipping in a season |

---

# WAVE 0 — SEE & STABILIZE

> Nothing else is trustworthy until we can measure and until purchases work.

## 0.1 Analytics & Telemetry Foundation `S→M` 🔁💰 **(build this first)**

**Goal:** Stop flying blind. Capture the events needed to measure D1/D7/D30,
funnels, and churn points — privacy-compliant and crash-safe (note: `analytics`
flag is currently `false` due to a past Sentry/TurboModule crash; we must avoid
re-introducing that).

**Phase 0.1.1 — Event schema & guardrails — ✅ DONE (2026-06-19)**
- [x] Define a typed event schema (`lib/analytics/events.ts`): 19 events incl.
      `session_start/end`, `week_advanced`, `challenge_completed`, `streak_changed`,
      `purchase_started/succeeded/failed`, `ad_shown/rewarded`, `prestige`,
      `death`, `screen_view`, `tutorial_step`, `onboarding_step`,
      `first_week_completed`, `daily_reward_claimed`, `achievement_unlocked`,
      `paywall_viewed`. Unknown names are rejected at runtime.
- [x] Add a thin `track(event, props)` wrapper (`lib/analytics/AnalyticsService.ts`)
      that is **a hard no-op** unless enabled+consented, never throws, and lazy-loads
      AsyncStorage in try/catch (mirrors `RemoteLoggingService`).
- [x] Gate behind a **new** flag `FEATURE_FLAGS.telemetry` driven by
      `EXPO_PUBLIC_ENABLE_ANALYTICS === 'true'` (opt-in; left the disabled Sentry
      `analytics` flag untouched so we never re-trigger that crash).

**Phase 0.1.2 — Provider integration — ✅ DONE (custom endpoint)**
- [x] Chose a **pure-JS HTTPS batcher** (no 3rd-party native SDK) → cannot reproduce
      the Sentry/TurboModule iOS 26 crash. Batched queue, 60s flush interval,
      AbortController timeout, silent-fail, anonymous install id (not device/ad id),
      sensitive-key redaction. Endpoint via `EXPO_PUBLIC_ANALYTICS_URL`.
- [x] Consent gating: `track()` no-op until `setConsent(true)`; wired after startup.
- [x] 10 unit tests (gating, schema, transport success/failure, privacy) — all pass.
- [x] Booted via `startupOrchestrator` telemetry task in `app/_layout.tsx`
      (flag-gated, 3s timeout, non-critical) + fires `session_start`.

**Phase 0.1.3 — Instrument the funnel — ⏳ NEXT (foundation ready)**
- [x] `session_start` wired at boot.
- [ ] Fire events at: onboarding steps, first `nextWeek()`, first challenge claim,
      paywall view, purchase outcome, prestige, death. *(call sites — next PR)*
- [ ] Set up the receiving endpoint + dashboard / saved queries for D1/D7/D30
      cohorts and "last screen before quit." *(ops)*

**Files:** new `lib/analytics/*`, hooks into `GameActionsContext.tsx` (week/death/prestige), `services/IAPService.ts` (purchase events), `app/_layout.tsx` (session lifecycle), `lib/config/featureFlags.ts`.
**Dependencies:** none — start immediately.
**DoD:** with the flag on in a dev build, all core events appear in the dashboard; with it off, zero network calls and zero crashes.
**Verification:** unit test the `track` no-op path; manual session in dev build → confirm events; run `npm run preflight`.
**Risks:** repeating the Sentry crash → **mitigate** by avoiding TurboModule-based SDKs and keeping everything in try/catch with a circuit breaker (mirror `AdMobService` pattern).

---

## 0.2 Launch Blockers (revenue + security) `S→M` 💰

**Goal:** Make purchases actually work and close security holes. From the roadmap
these are config/ops, mostly **not** code.

**Phase 0.2.1 — Payments**
- [ ] Stand up **IAP verification backend** (RevenueCat recommended for speed) and
      set `EXPO_PUBLIC_IAP_VERIFY_URL`. *Until this exists every purchase is refused.*
- [ ] Server-side receipt validation for both App Store & Play.
- [ ] End-to-end sandbox purchase test for each product family (gems, bundles, perks, subscription placeholder).

**Phase 0.2.2 — Ads**
- [ ] Replace Google **test** AdMob unit IDs with production IDs (env/EAS secret).
- [ ] Implement **Android UMP/GDPR consent** before any personalized ad request.

**Phase 0.2.3 — Security & policy**
- [ ] Generate the **HMAC key once**, store as EAS secret (non-rotatable — get it right).
- [ ] **Purge the leaked Play service-account key** from git history (BFG/filter-repo) and rotate the key.
- [ ] Update **privacy policy** to match actual ad/data behavior (currently says ads disabled).
- [ ] Make the **preflight CI gate blocking**, not a warning.

**Files:** `services/IAPService.ts`, `utils/iapConfig.ts`, `services/AdMobService.ts`, `app.config.js`, EAS secrets, CI config, legal docs.
**Dependencies:** 0.1 not required but ideally land together so purchase analytics work day one.
**DoD:** a real sandbox purchase completes and grants gems; ads serve with consent on a test device; CI fails on preflight errors; secret-scanning clean.
**Verification:** sandbox purchase receipts validated server-side; `mcp__github__run_secret_scanning` clean; preflight blocking proven by a deliberate failing commit on a throwaway branch.
**Risks:** non-rotatable HMAC key — **mitigate** with a documented generation runbook + four-eyes review before first prod build.

---

## 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**

**Goal:** Surface the already-coded 7-day reward ladder `[25,50,75,100,150,200,500]`.

**Phase 0.3.1 — State**
- [ ] Add `dailyLogin: { lastClaimWeekReal, currentDay, claimed: boolean }` to GameState (Save System Auditor review; bump `STATE_VERSION` to 20 with a migration in `saveValidation.ts`).
- [ ] Use the **authoritative game-time clock** already used by daily challenges (immune to device-clock abuse), with the existing 48h grace.

**Phase 0.3.2 — UI**
- [ ] 7-day calendar modal (use `BaseModal`, theme tokens, `scale()`/`fontScale()`), highlight today, "Claim" CTA, claimed/locked states.
- [ ] Auto-present on first app open of a new day; reward animation + toast.

**Phase 0.3.3 — Wire-up & analytics**
- [ ] Grant gems via existing gem-grant path; fire `daily_login_claimed` event.
- [ ] Reset to day 1 after a missed window (past grace); roll to day 1 after day 7.

**Files:** `contexts/game/types.ts`, `initialState.ts`, `utils/saveValidation.ts`, new `components/DailyLoginModal.tsx`, claim action in `actions/StatsActions.ts` or a new `actions/DailyRewardActions.ts`.
**Dependencies:** reuse daily-challenge clock; analytics (0.1) optional but ideal.
**DoD:** new day → modal appears → claim grants correct escalating gems → streak advances → save persists across reload.
**Verification:** test factory `createTestGameState()`; unit tests for day rollover, grace window, day-7 reset; migration test old save → v20.
**Risks:** save-schema drift → **mitigate** via Save System Auditor + migration test (mandatory).

---

## 0.4 Day-1 Gem Curve Fix `S` 🔁

**Goal:** New players feel generous early progress *before* the tutorial gate (roadmap M5: day-1 login reward is currently gated behind the tutorial, and FirstWeek guide reward is declared but never applied).

**Phase 0.4.1**
- [ ] Front-load first-session gem grant so it lands on first open, not post-tutorial.
- [ ] Fix the **FirstWeek guide reward** that is declared but never distributed (roadmap P2).
- [ ] A/B the starting grant size once bucketing exists (0.4 ships a sensible default now; optimize in Wave 2).

**Files:** onboarding flow, `utils/dailyChallenges.ts` / first-week guide logic, gem-grant path.
**DoD:** brand-new install receives the intended starter gems on first open; FirstWeek reward actually credited.
**Verification:** fresh-install run-through; unit test reward distribution.

---

## 0.5 Re-engagement Push Notifications `S→M` 🔁

**Goal:** Bring lapsed players back. `notifications` flag already exists.

**Phase 0.5.1 — Plumbing**
- [ ] Request notification permission at a non-intrusive moment (after first reward, not on launch).
- [ ] Local-notification scheduler (Expo Notifications), all native calls lazy-loaded in try/catch.

**Phase 0.5.2 — Triggers (start with 3)**
- [ ] (a) Daily challenge reset ("New challenges await").
- [ ] (b) Streak about to break ("Your N-day streak ends in 6 hours").
- [ ] (c) Passive income earned while away ("Your businesses earned $X").

**Phase 0.5.3 — Hygiene**
- [ ] Cap frequency (≤1/day default), respect quiet hours, honor opt-out, deep-link into the relevant screen.

**Files:** new `services/NotificationService.ts`, schedule hooks in `GameActionsContext.tsx` (post-week), `app/_layout.tsx`.
**Dependencies:** passive-income figures from the weekly tick (already computed).
**DoD:** scheduled notifications fire on a device, deep-link correctly, and respect opt-out + frequency cap.
**Verification:** device test each trigger; confirm no notification when permission denied.
**Risks:** over-notifying → churn. **Mitigate** with conservative caps + analytics on notification-driven opens.

**Wave 0 exit gate:** analytics dashboard shows live D1; a sandbox purchase succeeds; daily-login modal ships.

---

# WAVE 1 — DAILY LOOP

> Make returning every day feel great. Low risk, fastest D1/D7 movers.

## 1.1 "While You Were Away" Summary `S` 🔁

**Goal:** Convert already-accruing passive income (companies, crypto/mining, real estate, stocks dividends) into a dopamine moment on app open.

**Phases**
- [ ] **1.1.1** Aggregate per-source earnings since last session (data already produced by `actions/weekly/applyIncome.ts`, `applyMiningCryptos.ts`, `applySavingsInterest.ts`, `applyAutoReinvest.ts`).
- [ ] **1.1.2** "Welcome back" modal with itemized gains + collect animation.
- [ ] **1.1.3** Fire analytics; deep-link from push trigger (c).

**Files:** new `components/WelcomeBackModal.tsx`, read from `dailySummary` in GameState.
**DoD:** reopening after time away shows accurate itemized passive income.
**Verification:** simulate elapsed weeks in a test, assert summary matches ledger.
**Risk:** double-counting income → **mitigate** by reading the existing ledger, never re-rolling.

## 1.2 Streak-Save Messaging + Toast Dedup `S` 🔁

**Phases**
- [ ] **1.2.1** Surface the existing 48h grace as proactive copy ("Your 6-day streak is safe until tomorrow") — weaponize loss aversion.
- [ ] **1.2.2** Implement toast pile-up dedup (roadmap P2) so reward moments aren't buried.

**Files:** `utils/dailyChallenges.ts` (streak state), toast system.
**DoD:** streak-risk message appears at the right time; duplicate toasts collapse.
**Verification:** unit test dedup; manual streak-edge test.

## 1.3 Weekly Goals `M` 🔁

**Goal:** Bridge daily → seasonal with a mid-horizon objective (e.g. "earn $50k this week," "reach a new career tier").

**Phases**
- [ ] **1.3.1** Extend the daily-challenge engine (`utils/dailyChallenges.ts`) with a weekly tier using the same seeded, game-time clock.
- [ ] **1.3.2** 3 rotating weekly goals; rewards scale above daily (gems + a youth pill at top tier).
- [ ] **1.3.3** UI section in the challenges screen; analytics on completion.

**Dependencies:** a **single canonical income ledger** (roadmap P2 "earn $X" challenges currently lack one) — **build the ledger here** so daily + weekly + season all read one source.
**DoD:** weekly goals generate deterministically, track via the ledger, and reward correctly.
**Verification:** seed-based test ensures same week = same goals; ledger reconciliation test.
**Risk:** ledger drift across systems → Game State Reviewer sign-off required.

## 1.4 Comeback Bonus `S` 🔁

**Phases**
- [ ] **1.4.1** Detect 7+ day absence via game-time clock.
- [ ] **1.4.2** One-time "welcome back" grant (gems + youth pill) with its own modal; cooldown so it can't be farmed.

**Files:** new flag in GameState (`lastComebackGrantWeekReal`), `actions/DailyRewardActions.ts`.
**DoD:** returning lapsed player gets the bonus once per absence, not repeatedly.
**Verification:** test absence detection + cooldown.

## 1.5 Milestone Celebration Moments `S→M` 🔁

**Goal:** Turn the existing milestone tracker (net-worth `[$100…$1M]`, weeks `[4,10,26,52,104]`, relationships, fitness; with 85% proximity alerts) into full-screen shareable celebrations.

**Phases**
- [ ] **1.5.1** Full-screen celebration component triggered on milestone cross.
- [ ] **1.5.2** "Share" hook (stub now; wires to Legacy Card in Wave 3).
- [ ] **1.5.3** Keep proximity nudges; add gem micro-rewards at major milestones.

**Files:** `lib/progress/achievements.ts`, new `components/MilestoneCelebration.tsx`.
**DoD:** crossing a milestone shows a celebration once; proximity alerts unchanged.
**Verification:** test each milestone fires exactly once (no re-fire on reload).

## 1.6 Achievement Expansion `M` 🔁

**Goal:** Grow from 7 hardcoded achievements to **40–60** across every system for long-tail completionism.

**Phases**
- [ ] **1.6.1** Author achievement definitions per system: crime/dark web, crypto/mining, stocks, real estate, politics, parenting/family, education, pets, prestige/lineage, travel.
- [ ] **1.6.2** Ensure each maps to an existing trackable stat (no new tracking where avoidable); gem rewards balanced against the economy soft-cap.
- [ ] **1.6.3** Achievements screen with categories, progress bars, locked/unlocked.

**Files:** `lib/progress/achievements.ts` (extend data-driven list), achievements UI.
**Dependencies:** ideally data-driven so Wave 2's remote pipeline can later hot-add achievements.
**DoD:** 40+ achievements unlock correctly off real gameplay; no double-grants.
**Verification:** unit test a representative sample across systems; economy check that total gem payout is bounded.

**Wave 1 exit gate:** D1/D7 instrumented and trending up vs. Wave 0 baseline.

---

# WAVE 2 — LIVE-OPS ENGINE

> The capability that unlocks BitLife-style cadence. This is the strategic core.

## 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**

**Goal:** Move hardcoded scenarios/careers/diseases/events into a **versioned,
signed manifest** the app fetches — ship events with **no app-store update**.

**Phase 2.1.1 — Content model**
- [ ] Define a versioned content schema (`content/schema/*`) for events, seasonal scenarios, achievements, balance tweaks. Each entry carries `id`, `version`, `minAppVersion`, `weight`, `conditions` (NPC/stat/season gates).
- [ ] Extract a first slice (weekly events from `actions/weekly/applyWeeklyEvents.ts`) into manifest form as the proof-of-concept; keep hardcoded fallback.

**Phase 2.1.2 — Fetch, verify, cache**
- [ ] Manifest fetcher with **signature/checksum verification** (reuse the CRC32/HMAC discipline already used for saves).
- [ ] **Cache last-good manifest**; if fetch fails or signature invalid → fall back to cached, then to bundled defaults. **Never break offline play.**
- [ ] Respect `minAppVersion` so new content can't crash old clients (honors the "native config runs before JS" caution — content is JS-data only, no native).

**Phase 2.1.3 — Runtime integration**
- [ ] Content resolver that merges remote + bundled, filters by conditions/season, and feeds the existing event/scenario engine.
- [ ] Kill-switch flag per content entry (disable a broken event remotely).

**Files:** new `lib/content/*` (schema, fetcher, verifier, resolver, cache), hook into `actions/weekly/applyWeeklyEvents.ts` and the scenario engine, `lib/config/featureFlags.ts` (new `remoteContent` flag).
**Dependencies:** none hard, but **must** land before 2.2/2.3.
**DoD:** flipping a value in a hosted manifest changes in-game event weighting on next launch **without** an app update; offline launch still works on cached/bundled content; tampered manifest is rejected.
**Verification:** integration test for fetch→verify→resolve→fallback; offline test; tampered-signature test; old-client `minAppVersion` rejection test. Save System Auditor review (content can influence state).
**Risks:** remote content corrupting saves or crashing → **mitigate** with strict schema validation, sandboxed effects (whitelist of allowed state mutations), kill-switch, and deterministic replay (Wave 4 cross-cutting).

## 2.2 A/B Bucketing `M`

**Goal:** Consistent-hash players into cohorts to test events/balance/paywalls (roadmap N3).

**Phases**
- [ ] **2.2.1** Stable hash of an anonymous install ID → bucket; deterministic, offline, no PII.
- [ ] **2.2.2** Experiment config delivered via the content manifest (2.1); each experiment has variants + analytics tag.
- [ ] **2.2.3** `useExperiment(key)` hook; all variant exposures logged to analytics (0.1).

**Files:** `lib/experiments/*`, manifest schema extension, analytics events.
**Dependencies:** 2.1 (delivery) + 0.1 (measurement).
**DoD:** the same install always lands in the same bucket; exposure + outcome are queryable.
**Verification:** hash-stability test; exposure-logging test.

## 2.3 Season 1 — "Living Legacy" `L` 🔁💰

**Goal:** First themed 6-week season delivered entirely via the pipeline.

**Phase 2.3.1 — Season framework**
- [ ] Season state in GameState: `season: { id, startWeekReal, endWeekReal, progress, claimedTiers }` (Save System Auditor; `STATE_VERSION` bump + migration).
- [ ] Season clock on the authoritative game-time/real-time hybrid; graceful end-of-season rollover.

**Phase 2.3.2 — Season content (via manifest)**
- [ ] Themed scenario arcs (reuse scenario/cliffhanger engine), seasonal job rotation (reuse `JobActions`), exclusive **heritable trait** as marquee reward (ties to prestige).
- [ ] Seasonal cosmetics (apartment theme / vehicle skin / profile frame) — data only.

**Phase 2.3.3 — Season UI**
- [ ] Season hub screen: theme banner, progress, time remaining, reward track preview.

**Files:** `types.ts`/`initialState.ts`/`saveValidation.ts`, `lib/content` (season manifests), new `app/(tabs)/season` screen, scenario/job hooks.
**Dependencies:** 2.1 (delivery), 2.2 (optional for tuning), 2.4 (rewards live in the pass).
**DoD:** a complete season runs start→finish from the manifest; the heritable trait actually passes to the next generation on prestige.
**Verification:** simulate a full 6-week season in tests; prestige-inheritance test for the seasonal trait; offline/cached-season test.
**Risks:** season + prestige interaction bugs → Game State Reviewer mandatory.

## 2.4 The Legacy Pass (battle pass) `L` 💰🔁

**Goal:** Free + premium reward track keyed to prestige progress + challenge streaks. **No pay-to-win** — rewards are cosmetics, youth pills, gems, heritable traits.

**Phases**
- [ ] **2.4.1** Pass state (`pass: { tier, xp, premiumOwned, claimed[] }`) + XP sources mapped to existing signals (daily/weekly challenges, milestones, prestige). Migration + auditor review.
- [ ] **2.4.2** Reward tiers defined in the manifest (so seasons swap rewards without an update); free track kept genuinely rewarding (retention research).
- [ ] **2.4.3** Premium unlock as an IAP product (~$7.99/season) through the verified backend (0.2).
- [ ] **2.4.4** Pass UI: dual-track ladder, claim states, "upgrade" CTA, time left.

**Files:** state + migration, `lib/content` (reward tables), `services/IAPService.ts` (+ `utils/iapConfig.ts` new product), new `components/LegacyPass*`.
**Dependencies:** 0.2 (payments), 2.1 (reward delivery), 2.3 (season clock).
**DoD:** XP accrues from real play; free + premium rewards claim correctly; purchasing premium retroactively unlocks earned premium tiers; nothing grants power beyond the 2.0× soft-cap.
**Verification:** XP-accrual tests; retro-unlock test; economy audit that pass payouts respect caps; sandbox purchase of premium.
**Risks:** pay-to-win creep → **mitigate** by policy (cosmetics/convenience only) + economy review.

## 2.5 Seasonal/Holiday & Flash Events `M` (recurring) 🔁

**Goal:** BitLife's proven playbook, on our systems, via the manifest.

**Phases**
- [ ] **2.5.1** Holiday templates: Halloween (spooky careers/diseases via `applyDiseases`), Winter (gifting/family via `DatingActions`/family), Summer (travel via `TravelActions`).
- [ ] **2.5.2** Flash economic events reusing `actions/weekly/applyEconomicEvent.ts`: crypto bull-run weekend, market crash, IPO window — time-boxed, urgency-driven.
- [ ] **2.5.3** Forward **3-month content calendar** doc so cadence is intentional.

**Files:** `lib/content` manifests, `actions/weekly/applyEconomicEvent.ts`, `applyWeeklyEvents.ts`.
**Dependencies:** 2.1.
**DoD:** a holiday event can be turned on/off remotely on a date window; flash events apply and expire cleanly.
**Verification:** date-window activation test; expiry/cleanup test; economy bounds check on flash events.

**Wave 2 exit gate:** one full season shipped and toggled live **without an app-store release.**

---

# WAVE 3 — SOCIAL & SHARE

> Organic growth + D30 identity. Keep servers light (async, not real-time).

## 3.1 Leaderboards `L` 🔁

**Goal:** Net worth, longevity (weeks lived), generations reached, composite "Best Life Score." Weekly + all-time + seasonal.

**Phases**
- [ ] **3.1.1** Define **"Best Life Score"** formula (weighted net worth + longevity + relationships + achievements + prestige) — documented and versioned.
- [ ] **3.1.2** Backend leaderboard service (managed: Supabase/Firebase) with anti-cheat: server-side score validation, rate limits, anomaly flags (our saves are HMAC-signed — submit signed score payloads).
- [ ] **3.1.3** Leaderboard UI (tabs: weekly/all-time/season; friends filter later).

**Files:** new `services/LeaderboardService.ts`, score calc in `lib/progress/*`, new screen.
**Dependencies:** 0.1 (identity), backend infra decision.
**DoD:** scores submit on death/prestige, validate server-side, and rank correctly; obvious cheats rejected.
**Verification:** score-formula unit tests; tampered-score rejection test; load test.
**Risks:** cheating/leaderboard pollution → **mitigate** with server validation + HMAC-signed submissions + anomaly flags.

## 3.2 Legacy Card (shareable image) `M` 🔁 **(highest-ROI virality)**

**Goal:** Auto-generate a stylized end-of-life summary card (career, net worth, family tree, cause of death, score) for one-tap share. Build on existing strong screen visuals (`SCREENSHOT_GUIDE.md`).

**Phases**
- [ ] **3.2.1** Card layout component (themeable, dark-mode aware, uses `scale()`).
- [ ] **3.2.2** Capture to image (`react-native-view-shot`) + native share sheet; include app store deep-link / referral tag.
- [ ] **3.2.3** Trigger on death and on major milestones (wires up the 1.5 share stub).

**Files:** new `components/LegacyCard.tsx`, share util, hook into death flow in `GameActionsContext.tsx`.
**Dependencies:** 1.5 (share stub), 3.1 (score on card).
**DoD:** death produces a shareable card with correct stats; share sheet opens; link carries a referral tag.
**Verification:** snapshot test of card render; manual share on device; verify deep-link/referral attribution in analytics.
**Risks:** PII on shared image → only show in-game data, never device/account info.

## 3.3 Friend Codes / Async Compare `M` 🔁

**Phases**
- [ ] **3.3.1** Generate shareable friend code tied to anonymous ID.
- [ ] **3.3.2** Async "compare lives" view (your current run vs. a friend's published snapshot) — no real-time multiplayer.
- [ ] **3.3.3** Friends filter on leaderboards.

**Files:** `services/LeaderboardService.ts` (friends), compare UI.
**Dependencies:** 3.1.
**DoD:** entering a friend code shows a side-by-side comparison.
**Verification:** code round-trip test; privacy review (published snapshots are opt-in).

## 3.4 Seasonal Community Goal `S→M` 🔁

**Phases**
- [ ] **3.4.1** Global aggregate counter (e.g. total net worth earned this season) on the backend.
- [ ] **3.4.2** Threshold rewards to all participants; progress bar in the season hub.

**Files:** backend counter, season hub UI.
**Dependencies:** 2.3, 3.1 infra.
**DoD:** community progress updates and pays out at thresholds.
**Verification:** aggregation correctness; reward-grant idempotency.

**Wave 3 exit gate:** leaderboards live; Legacy Card sharing measurably driving installs (K-factor tracked).

---

# WAVE 4 — DIFFERENTIATE

> The moat. One big bet (Living Story) plus depth that competitors can't copy fast.

## 4.1 Living Story — AI/Authored Narrative `L→XL` 🔁 **(flagship differentiator)**

**Goal:** Personalized, non-repeating narrative built on our **existing NPC-depth
engine** (goals, opinions, memories, moods) + scenario/cliffhanger system — our
answer to AI-native entrants (Infinite Life Simulation et al.).

### Decision gate (resolve before building — see §Decisions)
- **Tier 1 (authored, offline, ship-safe) — recommended first:** large branching
  arc library delivered via the content pipeline, **weighted by NPC state**.
  Deterministic, no server cost, no moderation risk, works offline.
- **Tier 2 (LLM-assisted):** server-side generation of flavor text / event framing
  seeded by NPC state, for "no two lives the same" wow. Requires cost controls,
  content moderation, latency handling, and an **offline fallback to Tier 1**. If
  pursued, use the latest Claude models.

**Phase 4.1.1 — Tier 1 foundation (do regardless)**
- [ ] Author multi-week arc templates per life path (rival resurfaces, child rebels, business betrayal, romance arc, crime investigation chain).
- [ ] Arc selector weights by NPC opinion/memory/mood + player history; delivered via manifest (2.1); deterministic via seed for replay (cross-cutting 4.cc1).
- [ ] Arc state machine integrated with the cliffhanger system so beats resolve across weeks.

**Phase 4.1.2 — Tier 2 (only if approved)**
- [ ] Server endpoint that takes a **structured NPC/state seed** and returns bounded flavor text (never raw state mutation — effects stay in whitelisted, validated content ops, mirroring 2.1's sandbox).
- [ ] Cost guardrails (per-user/day caps, caching of generations), moderation filter, **strict offline/timeout fallback to Tier 1**.
- [ ] A/B (2.2) Tier 2 vs Tier 1 on retention + cost-per-retained-user before any wide rollout.

**Files:** `lib/content` (arc library), NPC-depth read APIs in relationship code, scenario engine, optional `services/StoryService.ts` (Tier 2), analytics.
**Dependencies:** 2.1 (delivery), 2.2 (eval), 0.1 (measure), 4.cc1 (deterministic replay for safety).
**DoD (Tier 1):** arcs trigger based on NPC state, span multiple weeks, resolve coherently, and never repeat back-to-back; fully offline + deterministic.
**Verification:** seeded replay produces identical arcs; NPC-weighting tests; Save System + Game State Reviewer sign-off (narrative must not corrupt state); for Tier 2: fallback test (kill the server mid-arc → graceful Tier 1), moderation test, cost-cap test.
**Risks:** Tier 2 cost/latency/moderation/offline → **mitigate** by shipping Tier 1 first and treating Tier 2 as an *enhancement layer behind a flag with mandatory fallback.*

## 4.2 Prestige Cinematic Hand-off `M` 🔁 **(lean into the moat)**

**Goal:** Make the Heir hand-off an emotional, cinematic signature moment — our prestige loop is what BitLife lacks.

**Phases**
- [ ] **4.2.1** Inheritance reveal sequence: estate passed, traits transferred, family tree grows (animate `ancestors[]`/lineage).
- [ ] **4.2.2** "Generational recap" card (shareable via 3.2): what this life achieved, what the heir inherits.
- [ ] **4.2.3** Reduced-motion variant (roadmap accessibility) and skip option.

**Files:** prestige flow in `GameActionsContext.tsx`/prestige actions, new cinematic component, reuse Legacy Card.
**Dependencies:** 3.2 (share), respects reduced-motion sweep.
**DoD:** prestiging plays the sequence once, transfers everything correctly, and offers share + skip.
**Verification:** prestige state-transfer tests (already a sensitive area — Game State Reviewer mandatory); reduced-motion test.

## 4.3 Content / DLC Packs `L` (recurring) 💰

**Goal:** Themed expansions reusing existing engines; sold as packs or via subscription (see Decisions).

**Phases (one per pack, repeatable)**
- [ ] **4.3.1 Criminal Empire** — expand dark web/`CrimeActions` (new vendors, multi-stage heists, laundering tiers).
- [ ] **4.3.2 Hollywood** — expand streaming/content/celebrity (`ContentActions`, `HobbyActions`, `PulseActions`/`SparkActions`).
- [ ] **4.3.3 Tycoon** — expand companies/real estate/R&D (`FamilyBusinessActions`, `RealEstateActions`, `RDActions`).
- [ ] **4.3.4 Romance & Family** — deeper dating arcs, more wedding venues, parenting decisions (genre's most-requested; `DatingActions`).
- [ ] **4.3.5 Pets+** — more species, competitions, pet inheritance (`PetActions`).

**Each pack DoD:** ships via manifest (2.1), gated by entitlement (IAP or subscription), balanced against soft-caps, with its own achievements + season tie-in.
**Verification:** entitlement gating test; economy audit; per-pack save-compat test.
**Risk:** **Hard Rule #4** — if a pack ever needs a native module, the `app.config.js` plugin must align with `package.json`. Prefer JS-only/data-driven packs.

## 4.4 Cosmetics Store `M` 💰 **(pure-margin, zero controversy)**

**Phases**
- [ ] **4.4.1** Cosmetic inventory model (apartment themes, vehicle wraps, profile frames, lineage crests) — gems-only, no stat effect.
- [ ] **4.4.2** Store UI + preview; manifest-driven catalog (rotate featured items).
- [ ] **4.4.3** Equip/persist cosmetics in GameState (migration + auditor).

**Files:** `actions/ItemActions.ts` (cosmetic class), new store screen, `lib/content` catalog.
**DoD:** buying/equipping cosmetics persists, affects only visuals, and never gameplay power.
**Verification:** persistence test; assert zero stat impact.

## 4.5 DeepLife+ Subscription `L` 💰🔁 **(the recurring-revenue anchor)**

**Goal:** The missing Bitizen analog: removes ads, monthly gem stipend, exclusive seasonal cosmetics, +1 daily challenge reroll. Recurring revenue >> one-shots.

**Phases**
- [ ] **4.5.1** Subscription products (`$4.99/mo`, `$29.99/yr`) via verified backend (0.2); entitlement state in GameState.
- [ ] **4.5.2** Benefits wiring: ad-suppression (`AdMobService`), monthly gem grant, cosmetic entitlements, reroll token.
- [ ] **4.5.3** Restore-purchases + grace/lapse handling; paywall UI with clear value; A/B price (2.2).

**Files:** `services/IAPService.ts`, `utils/iapConfig.ts`, `services/AdMobService.ts`, entitlement state + migration, paywall screen.
**Dependencies:** 0.2 (must be solid), 2.2 (price testing), 4.4 (cosmetic benefits).
**DoD:** subscribing removes ads + grants stipend; lapse re-enables ads; restore works cross-device.
**Verification:** sandbox sub lifecycle (subscribe→renew→lapse→restore); entitlement persistence; ad-suppression test.
**Risks:** entitlement desync → server is source of truth; client caches with TTL.

## 4.6 Hardcore / Ironman Mode `M` 🔁

**Phases**
- [ ] **4.6.1** Mode flag at new-life creation: permadeath, no youth pills, no revives.
- [ ] **4.6.2** Exclusive cosmetic + leaderboard board for hardcore runs.
- [ ] **4.6.3** Guard rails so IAP "revive"/youth items are disabled (and not sold) in this mode — fairness + store integrity.

**Files:** new-life flow, `GameActionsContext.tsx` death handling, store gating.
**DoD:** hardcore runs cannot be revived by any means; exclusive rewards grant; appears on its own board.
**Verification:** assert revive/youth paths blocked; reward-grant test.

---

# CROSS-CUTTING (parallel, supports all waves)

## CC.1 Deterministic Sim Replay `L` (roadmap N5)
- [ ] Transcript-record a life (seed + action log) and replay to identical end state.
- [ ] Becomes the regression harness for every content drop (2.1) and Living Story (4.1).
**DoD:** replaying a recorded transcript reproduces the exact final GameState.

## CC.2 Quality Scorecard Gate `M` (roadmap N4)
- [ ] Automated gate per release: tests pass, coverage threshold, type-check, lint, error-rate budget. Blocking in CI.
**DoD:** a release that regresses any metric cannot merge.

## CC.3 `nextWeek()` Decomposition & Perf `L` (roadmap P1)
- [ ] Finish extracting/instrumenting the weekly tick (already 34 helpers); target **p95 < 20ms/phase**; add late-game save-size stress (2,000+ weeks, < 3.5 MB).
**DoD:** instrumented phases meet budget; large-save load validated + auto-repaired.

## CC.4 UI Render-Test Suite `M` (roadmap P1)
- [ ] 18+ render tests covering all tabs/screens (incl. every new modal/screen above) to catch mount crashes before release.
**DoD:** all screens mount in CI without error.

## CC.5 Accessibility & Reduced-Motion `M` (roadmap P1/P3)
- [ ] Label key interactive rows (target 60%+); finish reduced-motion sweep across all new animated components (1.1, 1.5, 4.2).
**DoD:** a11y audit target met; all new animations honor reduced-motion.

---

# Dependency graph (critical path)

```
0.1 Analytics ─┬─────────────────────────────────────────────► (measures everything)
0.2 Blockers  ─┤                                                 
0.3 Daily UI  ─┘                                                 
                 1.x Daily Loop ──► 2.1 Pipeline ─┬─► 2.3 Season ─┬─► 2.4 Pass
                                     2.2 A/B ──────┘                │
                                                                    ▼
                                   3.1 Leaderboards ─► 3.2 Card ─► 3.3 Friends
                                                                    │
                                   4.1 Living Story (needs 2.1,2.2,CC.1)
                                   4.5 Subscription (needs 0.2,2.2)
```

**The two true prerequisites everything leans on: `0.1 Analytics` and `2.1 Remote
Content Pipeline`. Protect those timelines.**

---

# Definition of "perfected & flawless" (the bar for every item)

A task is **not done** until all of the following hold:
1. ✅ `npm run preflight` passes (type-check + lint + tests).
2. ✅ New/changed state passes **Game State Reviewer**; schema changes pass **Save System Auditor**; `STATE_VERSION` bumped with a tested migration.
3. ✅ Unit/integration tests written and green, including the failure/fallback path.
4. ✅ Render test covers any new screen/modal (CC.4).
5. ✅ Analytics events fire (0.1) so the feature is measurable.
6. ✅ Offline + lapsed-player paths verified (no hard dependency on network).
7. ✅ Economy impact reviewed against the 2.0× soft-cap; no pay-to-win.
8. ✅ Accessibility labels + reduced-motion handled (CC.5).
9. ✅ Demonstrated working on a device build, not just in tests (per `CLAUDE.md`: "never mark complete without proving it works").

---

# Decisions still required before Wave 2/4

1. **Living Story tier:** Tier 1 only, or Tier 1 → Tier 2 enhancement? (Recommend Tier 1 first.)
2. **DLC model:** paid packs (~$5), all-in DeepLife+ subscription, or hybrid? (Recommend hybrid: subscription + a couple of premium packs.)
3. **Ad philosophy:** rewarded + light interstitial (our differentiator) vs. aggressive interstitial (more revenue, more churn). (Recommend the restrained model.)
4. **Backend choice** for leaderboards/seasons/subscription validation (RevenueCat + Supabase/Firebase?).
5. **Season 1 theme/length:** confirm "Living Legacy," 6 weeks.
6. **Build order:** confirm analytics + blockers before any visible content.
```
```

*This plan is intentionally exhaustive. If a wave feels too large, cut scope within
a wave (fewer achievements, fewer packs) but do not reorder waves — the dependency
graph is load-bearing.*
