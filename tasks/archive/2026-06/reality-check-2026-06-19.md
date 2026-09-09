# Reality Check — DeepLife is Near-Launch, Not Greenfield

**Date:** 2026-06-19
**Why this exists:** I verified the codebase directly (not via the earlier
inventory). **Most of what the strategy doc listed as "gaps" already exists and is
substantial.** Building those again would duplicate code and risk save corruption
in a 19-version, heavily-audited save system. This document corrects the record so
the plan is accurate.

---

## What the strategy doc got WRONG (already built, verified)

| Strategy "gap" | Reality | Evidence |
|----------------|---------|----------|
| "Only 7 achievements" | **148 achievements** in the canonical system | `src/features/onboarding/achievementsData.ts` (148 `id:` entries). The 7 in `lib/progress/achievements.ts` are **deprecated** legacy. |
| "No daily login rewards UI" | **Fully built** — streak, 48h grace, escalating gems, popup | `app/(tabs)/home.tsx:168-209`, `DAILY_LOGIN_REWARDS` wired |
| "No social / leaderboards" | **Built** — leaderboard modal + service + prestige boards | `components/LeaderboardModal.tsx` (513 lines), `lib/progress/leaderboard.ts`, `lib/prestige/prestigeLeaderboards.ts`, `lib/progress/cloud.ts` |
| "No subscription" | **Built** — free/premium/ultimate tiers | `services/SubscriptionService.ts` (275 lines) |
| "No seasonal / live events" | **Built and large** | `lib/events/engine.ts` (3,247 lines), `lib/events/seasonalEvents.ts` (825), `lib/events/seasonal.ts` (280), `components/SeasonalIndicator.tsx` |
| "No weekly goals" | **Built** | `lib/challenges/weeklyChallenges.ts` |
| "While you were away" | **Built** — welcome-back popup | `app/(tabs)/home.tsx:212-225` |
| "Achievement expansion needed 7→40" | Already at **148** | as above |

**Conclusion:** DeepLife is a **feature-complete, near-launch** product, not a
greenfield one. The earlier inventory significantly under-counted maturity. I will
not re-build systems that already exist.

---

## What is GENUINELY missing (verified absent)

1. **Battle Pass / "Legacy Pass"** — `grep` for `battlePass|legacyPass|seasonPass|rewardTrack` → **none**. A seasonal dual-track reward pass keyed to the existing prestige + challenge systems is the one net-new monetization/retention feature that fits and doesn't already exist.
2. **Remote content pipeline** — no manifest/remote-config delivery; content ships with the app. (Seasonal *events* exist, but they're bundled, not hot-swappable.)
3. **Analytics** — still disabled (`FEATURE_FLAGS.analytics === false`); the game can't measure retention. (This part of the strategy was correct.)

Everything else in the strategy is **polish/expansion of existing systems**, not new builds.

---

## What actually stands between DeepLife and "best game ever"

It is **not more features. It is shipping + measuring.** The blockers are ops/QA:

### Launch blockers (verified real)
- [ ] **IAP verification backend** — `EXPO_PUBLIC_IAP_VERIFY_URL` is unset, so `verifyReceiptWithServer()` **refuses all entitlements** (`services/IAPService.ts:425`). No revenue until this exists. **This is the #1 blocker.**
- [ ] **Real AdMob unit IDs** (test IDs → $0).
- [ ] **HMAC signing key** as EAS secret (non-rotatable).
- [ ] **Purge leaked Play service-account key** from git history + rotate.
- [ ] **Privacy policy** aligned to real ad/data behavior.
- [ ] **Android UMP/GDPR consent** before personalized ads.

### The one safe, high-value feature build
- [ ] **Analytics foundation** (Wave 0.1) — genuinely missing, unblocks measuring everything, and is additive/low-risk. Strong candidate for the first real code I write.

### The one net-new feature that fits the vision
- [ ] **Legacy Pass / Battle Pass** — genuinely missing, on-strategy, monetizable. But it's a **large** feature that touches GameState (needs a `STATE_VERSION` 19→20 bump + registered migration + Save System Auditor sign-off). Should be built deliberately, not rushed.

---

## Recommendation

**Stop adding features speculatively.** The strategy's "Waves 1–3" are mostly
already done. Re-point effort to:

1. **Ship it** — clear the 6 launch blockers (ops/config, low code).
2. **Measure it** — build the analytics foundation (the real, safe feature gap).
3. **Then** build the **Legacy Pass** as the marquee post-launch update — the only
   major net-new feature that the game doesn't already have.

I did not write feature code this round **on purpose**: in a near-launch app with a
19-version save system, the correct move was to verify reality first rather than
duplicate or destabilize. Tell me which of (1)/(2)/(3) to start, and I'll do it
properly with full tests and migrations.
