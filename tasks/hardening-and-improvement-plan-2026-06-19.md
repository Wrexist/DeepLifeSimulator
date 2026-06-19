# Hardening & Improvement Plan — Retention/Premium Systems

**Date:** 2026-06-19
**Scope:** Everything added this effort — Analytics, Legacy Pass, DeepLife+.
**Basis:** Two deep code reviews (game-state correctness + save-system audit) using
the project's own criteria, plus a self-audit. This doc records what was **fixed**
and the prioritized **plan** for what's next.

---

## A. Fixed in this hardening pass ✅

All verified: type-check clean, 0 lint errors, **176 tests green** across 12 suites.

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | MED | **Daily reward didn't `saveGame()`** — a kill before autosave let players re-earn daily gems/XP (CLAUDE.md "save after state-changing actions"). | `home.tsx` now `saveGame(false)` right after the grant. |
| 2 | MED | **Stale-closure deps** in the daily-reward effect (read `loginStreak`/`lastLoginDate`, not in deps). | Added them (+ `setGameState`/`saveGame`) to the dep array. |
| 3 | LOW | **Welcome gems re-granted on resubscribe**, contradicting the "one-time" copy + a small farmable loop. | New **sticky** `settings.deepLifePlusWelcomeClaimed` (never cleared on lapse) gates the gems. New test covers lapse→resubscribe. |
| 4 | LOW | **`ensureCurrentSeason` didn't normalize arrays** on the same-season path (a partial pass from CloudSync/hand-edit could carry `undefined` arrays). | Defensive `Array.isArray` normalization, allocation-free when already well-formed. |
| 5 | LOW | **`repairGameState` had no `legacyPass` branch** (belt-and-suspenders parity with banking/darkWeb). | Added `'legacyPass'` to `subsystemObjects`. |
| 6 | MED | **`STATE_VERSION` doc drift** — CLAUDE.md said 19, AGENTS.md said 10. | Both corrected to 20. |
| 7 | LOW | **`reconcileSubscriptionBenefits` ad-free revoke** keyed only on the two known entitlements. | Clarifying comment: `ownsRemoveAds` must be the authoritative union of all non-sub ad-free grants. |

**Polish shipped alongside (completeness + professionalism):**
- Wired previously-unused analytics funnel events: **`achievement_unlocked`** (on genuine claim), **`paywall_viewed`** (DeepLife+ modal open).
- **Flush analytics on background/inactive** so a kill doesn't drop the session tail (interval flush alone could).

---

## B. Conscious architectural decision — the seasonal reset (review H1/H2)

**Finding:** `awardLegacyPassXp` reconciles the season via `ensureCurrentSeason`,
which **resets the pass when the wall clock crosses a 6-week boundary**. So the
first XP-earning action after a season rollover silently wipes the prior season's
pass (xp, premium flag, unclaimed rewards), with no UI.

**Assessment:** Within a season this is correct and lossless (deterministic
`seasonId` from the clock; all timestamps in a 6-week window map to the same
season). Across a boundary, a reset is **the intended seasonal behavior**. The real
gaps are **UX**, not data corruption:
1. The reset is invisible (no "new season" moment).
2. Unclaimed rewards are lost on rollover with no grace.
3. A paying subscriber's `premiumOwned` resets until they reopen the pass (it
   self-heals via the modal's subscription sync, so minor).

**Decision:** Do **not** refactor the (tested, green) season engine in a hardening
pass with no live seasons yet. Instead, build the proper feature below (B-plan)
when seasons go live. Determinism is a non-issue in practice (ms differences never
cross a 6-week boundary), so no clock-threading change was made.

---

## C. Prioritized improvement plan

### P1 — Make seasons first-class (the real fix for B) — ✅ CORE DONE (2026-06-19)
- [x] **End-of-season reward delivery (no silent loss).** `awardLegacyPassXp` and
      `reconcileLegacyPassSeason` now auto-collect every earned-but-unclaimed reward
      on rollover: gems/youth pills/traits granted account-level, **cosmetics carried
      forward** into the new pass (fixed a latent bug where seasonal-slice cosmetics
      were wiped). Engine: `getUnclaimedEarnedRewards`. The true fix for H1/H2.
- [x] **Explicit reconciliation at session start/foreground + on pass-open.** Folded
      into `SubscriptionReconciler` (it already runs at those moments and knows the
      subscription tier); the `LegacyPassModal` also reconciles on open.
- [x] **New-season UI.** A `legacyPassSeasonSummary` (one-shot, optional, no
      migration) is stamped at rollover and shown as a dismissible banner in the pass
      ("New season started! Auto-collected N rewards (+X gems)"). `premiumOwned` is
      re-derived from the subscription on rollover so subscribers keep premium.
- [x] Rollover is now **atomic** inside `awardLegacyPassXp` (collect → reset → add
      XP), so no XP path can lose rewards regardless of which fires first; the
      determinism concern is moot (collection is order-independent + idempotent).
- [ ] *Follow-up:* a global "new season" toast/indicator outside the modal (today
      the summary surfaces when the pass is opened).

### P2 — Finish the analytics funnel & insight
- [ ] Wire remaining defined events: `onboarding_step`, `tutorial_step`,
      `first_week_completed`, `screen_view` (expo-router listener), `ad_shown`/
      `ad_rewarded` (AdMobService).
- [ ] Validate queued-event schema on `loadQueue` (drop malformed cached events).
- [ ] Stand up the receiving endpoint + D1/D7/D30 cohort dashboards (ops).

### P3 — Legacy Pass UX polish — ✅ CORE DONE (2026-06-19)
- [x] **"Claim all"** button in the pass (`claimAllLegacyPassRewards` action +
      engine `getClaimableCount`/`getUnclaimedEarnedRewards`) — claims every earned
      tier across both tracks in one tap, with a totals toast.
- [x] **Claimable-count badge** on the Progression "Legacy Pass" entry (red badge,
      99+ cap) — loss-aversion nudge to return.
- [x] **Reduced-motion** on both new modals (`useReducedMotion` → fade instead of
      slide).
- [x] Reward-claim toast feedback (per-claim + claim-all totals).
- [ ] *Follow-up:* XP-gain animation/celebration; surface owned **cosmetics**
      (themes/frames) in a profile/apartment surface (`legacyPass.ownedCosmetics`
      is populated + carried across seasons, just not rendered yet).

### P4 — DeepLife+ depth
- [ ] **Recurring monthly gem stipend** (needs a monthly tick keyed to renewal),
      then add it to the benefit list (keep the list truthful until then).
- [ ] Run the reconcile **after** save-load (not only mount/foreground) to remove
      the first-launch race where the loaded save can briefly precede reconciliation.
- [ ] A/B price test ($4.99/mo vs alternatives) once analytics + store are live.

### P5 — Ops / launch (already documented, not code)
- [ ] IAP-verify backend + real store products (Legacy Pass premium + DeepLife+).
- [ ] Rotate the leaked Play key + purge history (`leaked-key-rotation-runbook.md`).
- [ ] Real AdMob IDs, HMAC secret, privacy policy, UMP — see `launch-blocker-audit`.

---

## D. What was confirmed sound (no action)
- Migration[20]: idempotent, registered, backfills `ownedCosmetics`; every version
  in [2,20] covered; future-version saves handled non-destructively.
- Default/type alignment exact; prestige preserves the pass (deep-copied, tested).
- Analytics: no native import, never throws, hard no-op when disabled, abort-timed
  fetch, capped queue, sensitive-key scrubbing.
- All gem/XP/youth-pill math floors + rejects NaN/negative; tier math clamps.
- AnalyticsTracker edge detection seeds refs from current value → no spurious
  death/prestige/week fires on load.
- `optional` settings fields (`deepLifePlusActivated`, `deepLifePlusWelcomeClaimed`)
  correctly need no migration.
