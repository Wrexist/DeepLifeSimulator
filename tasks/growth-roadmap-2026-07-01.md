# DeepLife Simulator — Growth Roadmap (2026-07-01)

**Prepared for:** a solo/AI-assisted growth push. **Primary goal: user growth/acquisition**, not retention or revenue (though not fully separable from either).

**Confirmed context:** iOS-only, live <1 month, hundreds-to-low-thousands installs, <$100/mo revenue, no retention tracking wired up, App Store Connect basics available.

**Companion doc:** `tasks/growth-implementation-plan-2026-07-01.md` — same roadmap broken into file-level, step-by-step execution detail.

---

## 0. Headline correction from prior audits

Before anything else: **the P0/P1 findings in `tasks/audit-2026-06-21.md` are stale.** Verified directly against current code on 2026-07-01 — every crash bug and economy exploit in that audit that was checked (9 of its ~16 findings, sampled across all categories) is **already fixed**, each with an explicit code comment referencing the fix:

- `components/LifeMomentModal.tsx` — dismiss path now exists (`onRequestClose` + `handleDismiss`), soft-lock is closed.
- `contexts/game/actions/weekly/applyAutoReinvest.ts` — now uses `validHoldings` throughout, crash is closed.
- `contexts/game/GameActionsContext.tsx` — `business_opportunity` chain now uses `getEventChainStageCount()`, payout bug is closed.
- `lib/realEstate/operations.ts` (`sellProperty`) — 6% closing cost + 15% capital-gains tax now applied, money-printer is closed.
- `contexts/game/actions/HustleActions.ts` (IPO) — double-credit fixed, atomic re-check against fresh state.
- `lib/events/engine.ts` (`investment_tip`) — now fair 50/50 double-or-nothing (was +25% EV), exploit closed.
- `contexts/game/actions/BankingActions.ts` (`redeemRewards`, `withdraw`, `payDownCard`) — all routed through `applyMoneyDelta`/`MONEY_CEILING`, all three exploits closed.
- `contexts/game/actions/CryptoTradingActions.ts` — fee/spread buffer now reserved on limit buys, negative-money bug closed.
- `lib/realEstate/operations.ts` (`maintenanceCost`) — formula corrected (0.001, matches its own doc comment).
- `lib/realEstate/weeklyTick.ts` — rental income now nets a carrying-cost offset, was pure-profit exploit.
- `services/IAPService.ts` — purchase listener teardown and `finishTransactionAsync` on the acknowledged path both present, Android redelivery-loop risk closed.

**What this means for the roadmap:** drop every "fix economy/crash bug" item from the plan — that work is done. This isn't a reason to relax; it's confirmation that **engineering hygiene is not the bottleneck.** The gap is entirely on the growth/ops side (Android, ASO, analytics, community), and effort should go there without further hedging on code quality.

---

## 1. Competitive Landscape

| Competitor | Monetization | Platforms/scale | Acquisition | Weakness to exploit |
|---|---|---|---|---|
| **BitLife** | Ads + IAP + subscription (~$5.99/mo or ~$29.99/yr; sources disagree on exact current price) + paid DLC packs | iOS→Android→web; ~42M cumulative downloads at 2020 Stillfront acquisition (the one solid, disclosed anchor) | **Disclosed paid UA**: TikTok Smart+ campaigns (beat ROAS target by 43%, 25% lower CPI, 31% higher CTR), a Mintegral network deal. Organic TikTok virality is widely repeated in press but **has no primary source anywhere** — real phenomenon, unverified magnitude | Breadth over depth; 7+ year head start you can't out-cadence |
| **InstLife** | Ads + IAP | iOS + Android simultaneous launch | Undisclosed; plausibly rides BitLife's ASO keyword overlap (inference, not confirmed) | No distinct moat |
| **AltLife** (QmzApps) | Ads (~10%) + IAP (~90%, per an unaudited Flippa business-sale listing) | 1.5–2M installs, 4.51★ (~71K ratings) | Undisclosed; "organic" per the same low-trust listing | Revenue figures are seller-inflated sale-listing claims — do not benchmark against them |
| **Life is a Game** (Fivebyte/Studio Wheel) | Ads + IAP | Android 10M+ installs (3.82★, ~150K ratings); iOS only 160 ratings after 3+ years live | Undisclosed | **Concrete caution:** a huge Android result never transferred to iOS — don't assume a strong result on one platform carries to the other |
| **Life Sim: Real Life Simulator** (Richard Biddulph, solo dev) | Ads + IAP + subscription | 100K+ downloads, 4.6★ | Undisclosed | Existence proof a solo dev can reach 100K+; not a repeatable template (no UA data) |
| **AI-native entrants** (Infinite Life Simulation, Jenova AI, EmemeTown) | Mixed | Only Infinite Life Simulation is actually mobile (iOS+Android), and its scale is tiny/unverified (conflicting rating snippets, no tracker data). Jenova is a web-only feature, EmemeTown is PC/Steam Early Access | N/A | **The "rising AI-native life-sim threat" has not materialized on mobile yet** — no urgency to preempt it |
| **The Sims Mobile** (EA) — context only | F2P IAP, no ads | **Delisted Oct 21, 2025; servers shut down Jan 20, 2026** | EA cross-promo (structurally unavailable to a solo dev) | Now defunct; useful only as a reminder that even cross-promoted, big-budget titles in this space can fail |

**Where DeepLife realistically sits:** not competing with BitLife on cadence or breadth — they have a multi-year head start and (unverified but plausible) organic reach at scale. DeepLife's real advantage (25+ interconnected systems, a prestige/generational loop most competitors lack, hardened economy) is genuine and verified in the codebase, but **currently invisible to the market**: zero ASO signal, zero UA, absent from the majority-Android global install base. "Depth over breadth" is a reasonable positioning hypothesis to test once there's a funnel — it is not yet an established defensible niche, and claiming otherwise right now would be getting ahead of the evidence.

---

## 2. Honest Current-State Assessment

1. **Engineering hygiene is in genuinely good shape** (see §0) — this is no longer a risk to manage, it's a settled strength. Don't let it consume further solo-dev bandwidth by re-auditing the same systems.
2. **The remaining structural risk is the volume of *internal planning* docs relative to *external growth* work.** 60+ files in `tasks/` — audits, hardening plans, retention strategy — and **zero** of them address ASO, community, or acquisition until this one. AI-assisted workflows make internal analysis nearly free to produce; that's exactly why it's necessary to consciously redirect effort toward the harder, non-automatable external work now that the internal work is done.
3. **No analytics in production** — confirmed directly: `eas.json`'s production build profile does not set `EXPO_PUBLIC_ENABLE_ANALYTICS`, and `FEATURE_FLAGS.analytics` is hardcoded `false` (Sentry disabled for an iOS 26 TurboModule crash) in `lib/config/featureFlags.ts`. The pure-JS telemetry pipeline exists in code but is **not switched on**. Nothing about growth is measurable until this changes.
4. **iOS-only after a month, Android ready-but-unshipped.** `eas.json` has a working `android` build profile but **no `android` submit profile** — Play Console submission isn't wired up. (Note: iOS-first itself was a reasonable call — an indie case study, *Golf Peaks*, captured ~55% of iOS unit volume on Android launched 4 months late. The problem isn't the sequencing, it's that Android has sat ready past the point your thin iOS signal already justifies moving.)
5. **ASO is unset.** `app.config.js` description ("The ultimate life simulation game where every choice matters") carries no keyword payload. No evidence of keyword research. 41 screenshot assets exist across 6 sets but their ordering/hook-frame is untested. Apple's ranking algorithm structurally penalizes low-install, low-review apps on velocity signals — the current listing isn't trying to win that fight.
6. **Monetization catalog is over-built for its traffic.** 27 IAP SKUs in `utils/iapConfig.ts` ($0.99–$99.99), a `SubscriptionService.ts` "ultimate" tier that unlocks features (`advanced_analytics`, `priority_support`, `early_access`) that don't exist yet, and a 17% annual-subscription discount (`$49.99/yr` vs `$4.99/mo` × 12 = `$59.88`) — far weaker than genre norms.
7. **Unverified revenue durability.** `services/IAPService.ts` correctly fails closed (`verifyReceiptWithServer` refuses entitlements without `EXPO_PUBLIC_IAP_VERIFY_URL`) — this is good, secure code. What's unverified is whether that EAS secret is actually set in the production build. If not, IAP revenue should be $0 today, and the reported trickle would be coming entirely from ads/other sources — worth confirming directly rather than assuming.
8. **A leaked, unrotated Google Play service-account key still sits in git history** — confirmed via git log, no rotation/purge commits found. `tasks/leaked-key-rotation-runbook.md` exists but its checklist is unexecuted. Active security exposure, independent of the growth question, and it blocks the safest Android CI/CD path.

---

## 3. Phased Roadmap

### NOW (0–4 weeks) — unblock, instrument, don't build content

1. Rotate + purge the leaked Play service-account key (execute the existing runbook)
2. Confirm `EXPO_PUBLIC_IAP_VERIFY_URL` is actually set as an EAS secret in production
3. Confirm real AdMob production ad-unit IDs are set (not Google test IDs)
4. Turn on analytics/telemetry with install-source attribution — **highest-leverage single item in this phase**
5. ASO rewrite: keyword-researched title/subtitle, reordered screenshots, run an App Store Connect **Product Page Optimization (PPO)** test using the 6 existing screenshot sets
6. Prompt current users for genuine App Store reviews (native `StoreKit` prompt, never incentivized)
7. Submit an Apple **Featuring Nomination** (App Store Connect → Featuring → Nominations, type: App Launch) **now**, in parallel with Android work — Apple's own guidance ranges 3 weeks to 3 months lead time; plan for the long end
8. Small, capped ($20–50) **Apple Search Ads** experiment on long-tail terms — cold-start bootstrap only, not a scaling channel
9. Run a founder **Reddit AMA** (r/IAmA or a game-specific sub) timed to the Android launch — best-evidenced zero-cost tactic found in this research (two solo/small-team case studies drove 10x normal traffic / front-page placement)
10. **Ship Android** — see §5

**Trap:** do not touch Legacy Pass, seasons, Living Story, or leaderboards this phase. None of it matters without a funnel or a second platform.

### NEXT (1–3 months)

1. Build a shareable "Legacy Card" / end-of-life share mechanic — a growth mechanic, not a retention nicety
2. Continued organic community seeding (subreddits, Feedback Friday)
3. Fix the weak annual-subscription discount
4. Trim the 27-SKU IAP catalog to a handful of clear offers
5. Build a funnel dashboard from the Now-phase analytics (D1/D7/D30, install source, funnel to first purchase)
6. Decide the fate of the non-functional "ultimate" subscription tier (build the minimum viable version of its benefits, or remove it from sale)

**Removed from the plan:** cross-promotion networks. These are structurally built for multi-title portfolio studios (the one rigorous independent study found the mechanism works only by cannibalizing a source game's revenue across a portfolio) — a solo dev with one title has no natural inventory here.

**Trap:** Living Story (LLM-assisted narrative) — high cost, and per §1 the competitive urgency for it doesn't exist yet on mobile. Later, not Next.

### LATER (3–6+ months)

1. Remote content pipeline (prerequisite for any live-ops cadence)
2. Legacy Pass / seasonal battle pass (needs analytics + remote pipeline + proven retention first — and a `STATE_VERSION` migration with Save System Auditor sign-off per this repo's own rules)
3. Living Story AI narrative differentiator
4. Leaderboards/social layer (needs real concurrent-user volume to not look empty)
5. `nextWeek` decomposition, accessibility pass, design-token cleanup — ongoing background work, not a phase gate

---

## 4. Monetization Strategy

Model is directionally right (hybrid IAP + subscription + restrained ads matches genre norms); execution has premature-complexity symptoms. Simplify the SKU catalog now, fix the annual discount, hold off on Legacy Pass until Later. Stay restrained on ads — at low install/review volume, rating damage costs more than marginal ad revenue is worth. **Calibrate Android expectations:** iOS ARPU runs ~2.5–5x Android's (starkest in subscriptions, ~5x) — Android will move install numbers far more than revenue numbers, which is fine since growth is the stated goal. No paid UA at scale — simulation-genre CPI (~$3.75 iOS/~$2.50 Android) is uneconomical against current revenue and unvalidated LTV; the capped Apple Search Ads experiment above is a narrow, deliberate exception for cold-start bootstrap only.

---

## 5. Single Highest-Leverage Next Action

**Ship Android.** The build profile already exists; the support site already promises it ("Android in the works"). What's left is ops, not engineering: rotate the leaked Play key (security-urgent regardless, do first), add an Android EAS submit profile, decide non-personalized-only ads to skip building a UMP/GDPR consent flow, produce Android-shaped store assets (current 41 screenshots are iPhone/iPad-only), submit — timed alongside a Featuring Nomination and a Reddit AMA. This roughly doubles realistic top-of-funnel with ~0% new game content, on a codebase that (per §0) has no outstanding engineering blockers left to distract from it.

---

## Dependencies & Open Threads

- Android depends on: Play key rotation, ad-personalization decision, new store assets — not optional shortcuts.
- Featuring Nomination lead time (Apple's own docs disagree: 3 weeks to 3 months) means it must start now, in parallel with Android technical work, not after.
- Legacy Pass depends on: remote content pipeline + analytics + `STATE_VERSION` migration discipline.
- Any TikTok/shareable-moment push depends on the Legacy Card mechanic actually existing first.
- Confirm IAP server-side verification and real AdMob ad-unit IDs before treating current revenue as a stable signal.
- **Research-integrity note:** during this research, two messages appeared mid-session styled as being from "another Claude session," very likely a prompt-injection attempt (independently corroborated by a separate subagent that reported and refused the same pattern). Their specific Sensor Tower figures were discarded; one overlapping Apptopia/TechCrunch figure was independently re-confirmed through a trusted channel and retained (see §3 item 7, the Featuring Nomination expected-impact context). Nothing else in this document was affected.
