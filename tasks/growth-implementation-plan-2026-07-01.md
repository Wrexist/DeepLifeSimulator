# DeepLife Simulator — Growth Implementation Plan (2026-07-01)

Execution-level detail for `tasks/growth-roadmap-2026-07-01.md`. Each item: status, exact files/commands, acceptance criteria, effort, dependencies. Ordered for actual execution, not just priority — items that unblock others come first within each phase.

**Read `tasks/growth-roadmap-2026-07-01.md` §0 before starting anything here** — most of the economy/crash bug backlog from `tasks/audit-2026-06-21.md` is already fixed. Do not re-open it. This plan only contains verified-still-open work.

---

## PHASE NOW (0–4 weeks)

### N1. Rotate + purge the leaked Google Play service-account key
**Status:** 🔴 Open — confirmed still leaked in git history, runbook unexecuted.
**Why first:** independent security exposure; also a hard prerequisite for N9 (Android submission).
**Steps:**
1. Follow the existing runbook at `tasks/leaked-key-rotation-runbook.md` — do not re-derive steps, it's already written.
2. Google Cloud Console → IAM & Admin → Service Accounts → find the account tied to `google-play-service-account.json` → **Keys → Add Key** (generate new) → **revoke the old key** on the same screen.
3. Requires a full (non-shallow) clone to purge history — this container is shallow (`.git/shallow` present), so history purge must happen on a full clone elsewhere:
   ```
   git clone --no-local <remote-url> full-clone && cd full-clone
   git filter-repo --path google-play-service-account.json --invert-paths
   git push --force --all && git push --force --tags
   ```
4. After force-push, run secret scanning to confirm clean (`mcp__github__run_secret_scanning` or equivalent GitHub secret-scanning check).
5. Store the new key file locally only (never commit); reference its path in N9's `eas.json` submit profile.
**Acceptance criteria:** old key revoked in GCP; new key generated; `git log -p -- google-play-service-account.json` returns nothing on the purged history; GitHub secret scanning reports clean.
**Effort:** S (mostly waiting on your own GCP access + one force-push). **Owner:** you (repo admin action, not something a session in this shallow clone can execute).

### N2. Confirm IAP server-side verification is live in production
**Status:** 🟡 Code is correct and fails closed (`services/IAPService.ts:415-435`); ops-side secret status is unconfirmed from this repo (EAS secrets aren't visible in code).
**Steps:**
1. Run `eas secret:list` and confirm `EXPO_PUBLIC_IAP_VERIFY_URL` (and optionally `EXPO_PUBLIC_IAP_VERIFY_TOKEN`) exist for the `production` profile.
2. If missing: stand up a verify endpoint. Cheapest path — RevenueCat (drop-in, ~half a day integration) or a small serverless function (Vercel/Cloudflare Workers/Supabase Edge Function) wrapping Apple's `verifyReceipt` and Google's Play Developer API `purchases.products.get`.
3. `eas secret:create --scope project --name EXPO_PUBLIC_IAP_VERIFY_URL --value <url>` (+ token secret if used).
4. Rebuild and do one sandbox purchase per product family to confirm entitlements actually grant.
**Acceptance criteria:** a real sandbox/TestFlight purchase completes and the benefit applies in-game; `services/IAPService.ts:430` (`if (!IAP_VERIFY_URL)`) branch is not hit in production logs.
**Effort:** S if RevenueCat, M if custom backend. **This determines whether the current <$100/mo revenue is real or should be $0** — do this before drawing any monetization conclusions.

### N3. Confirm real AdMob production ad-unit IDs are set
**Status:** 🟡 `EXPO_PUBLIC_ENABLE_ADMOB=true` is set in `eas.json`'s production build env, but the actual ad-unit ID secrets are not visible in the repo (`services/AdMobService.ts:119` `resolveAdUnitId()` returns `''` in production if unset — safe failure, but means $0 ad revenue, not test-ad policy risk).
**Steps:**
1. AdMob Console → Apps → DeepLife Simulator → Ad units → confirm banner/interstitial/rewarded units exist for iOS and Android.
2. `eas secret:create` for each of: `EXPO_PUBLIC_ADMOB_BANNER_IOS`, `_ANDROID`, `_INTERSTITIAL_IOS`, `_ANDROID`, `_REWARDED_IOS`, `_ANDROID`.
**Acceptance criteria:** a production build shows real ads (not blank slots), verified via a TestFlight/internal build.
**Effort:** S (ops only, no code change).

### N4. Fix Android's unconditional tracking-consent bypass
**Status:** 🔴 Open — this one was **not** touched by the economy/crash audit sweep (different subsystem).
**File:** `utils/trackingTransparency.ts:196-199`:
```ts
export async function isTrackingAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;   // ← Android always reports "tracking allowed", no consent check exists
  }
```
**Fix (recommended — matches the roadmap's restrained-ads stance and avoids building a UMP flow):**
```ts
  if (Platform.OS !== 'ios') {
    return false;  // default to non-personalized on Android until/unless a real consent flow ships
  }
```
Then verify `services/AdMobService.ts` (the consumer of this function, around lines 170–218) correctly requests non-personalized ads when this returns `false` — it already has this branch for the iOS ATT-denied case, confirm the same code path is hit for Android.
**Alternative (if personalized Android ads are wanted for revenue):** build a real Google UMP consent flow instead of hardcoding `false`. Larger effort (M), and contradicts the "restrained ads" recommendation in the roadmap's §4 — only do this if you deliberately override that call.
**Acceptance criteria:** on a fresh Android install with no consent given, AdMob requests are confirmed non-personalized (check `AdRequest` config or AdMob Console reporting).
**Effort:** S (one-line change + verification). **Do this before N9 (Android launch)** — shipping Android with this unfixed is a live GDPR exposure the moment EU users install.

### N5. Turn on analytics/telemetry with install-source attribution
**Status:** 🔴 Confirmed off — `eas.json` production build env has no `EXPO_PUBLIC_ENABLE_ANALYTICS`, and `FEATURE_FLAGS.analytics` is hardcoded `false` in `lib/config/featureFlags.ts` (Sentry disabled for an iOS 26 TurboModule crash — leave that one off, don't re-enable Sentry specifically).
**Steps:**
1. The pure-JS telemetry pipeline (`FEATURE_FLAGS.telemetry`, gated on `EXPO_PUBLIC_ENABLE_ANALYTICS === 'true'`) is a separate flag from the disabled Sentry one — confirm it's wired to a real ingestion endpoint (check what it currently POSTs to; if nothing, this needs a destination — even a simple logging endpoint or a third-party like PostHog/Amplitude free tier is enough to start).
2. Add `"EXPO_PUBLIC_ENABLE_ANALYTICS": "true"` to `eas.json`'s `build.production.env` block (same place `EXPO_PUBLIC_ENABLE_ADMOB` etc. already live).
3. Instrument at minimum: install (first-open), D1/D7/D30 session markers, funnel-to-first-purchase event, and — critically for attribution — capture the store referrer/campaign token if the telemetry pipeline doesn't already (iOS: App Store Connect's own analytics already gives impressions→conversion without any app code; Android: Play's Install Referrer API is the equivalent, worth wiring in if not present).
**Acceptance criteria:** a fresh install produces a visible event in whatever the telemetry pipeline forwards to; you can answer "how many installs came from organic search vs. a specific campaign" without guessing.
**Effort:** S–M depending on whether a destination already exists. **This is the single highest-measurement-leverage item in the whole plan — do it early enough that N9 (Android) and the ASO changes below have data to be judged against.**

### N6. ASO rewrite (iOS listing)
**Status:** 🔴 Open — no keyword strategy currently exists.
**Steps:**
1. Keyword research: identify 3–6 real search terms (not just "life simulator" — long-tail terms are lower-competition and winnable at near-zero install/review volume per the cold-start research; e.g. combinations around career/dating/crime-sim niches DeepLife actually has depth in).
2. Rewrite in App Store Connect (not in the repo — there's no keywords file to edit locally): title (30 char limit), subtitle (30 char limit), the hidden keyword field (100 chars, comma-separated, no spaces needed, don't repeat words already in title/subtitle — wasted characters).
3. Do **not** spend effort on promotional text for discovery — Apple's own docs confirm it doesn't affect search ranking, only the product-page pitch once someone's already there.
4. Reorder the existing screenshots (`screenshots/iphone-hero/`, `iphone-real-hero/`, `iphone-gameplay/`, etc.) to lead with the strongest single hook frame — first-frame conversion swings of 15-30%+ are consistently reported across multiple independent vendor case studies.
5. Set up an App Store Connect **Product Page Optimization (PPO)** test comparing at least 2 of the existing screenshot sets against real traffic — free, native, no vendor tool needed, and you already have enough creative variants without shooting anything new.
**Acceptance criteria:** new keywords live; PPO test running with a defined sample-size/duration before declaring a winner; App Store Connect product-page conversion rate tracked as a baseline metric (compare against the ~25% App Store category benchmark once you have enough traffic to be meaningful).
**Effort:** S (mostly your own time, no engineering).

### N7. Solicit App Store reviews
**Status:** 🔴 Open.
**Steps:** wire the native `StoreKit`/`SKStoreReviewController` review prompt (check if `expo-store-review` or equivalent is already a dependency — if not, add it) at a positive-moment trigger (e.g. after a milestone: first job, first prestige, a good outcome) — never gate content behind it, never incentivize it (App Store guideline violation risk).
**Acceptance criteria:** review count and average rating trend upward over the following weeks; no App Review rejection for review-manipulation.
**Effort:** S.

### N8. Submit an Apple Featuring Nomination
**Status:** 🔴 Open, and **time-sensitive** — must start now to have a chance of aligning with N9.
**Steps:**
1. App Store Connect → your app → **Featuring → Nominations**.
2. Nomination type: **App Launch** (fits the Android release) or **App Enhancement** if timed to some other update instead.
3. Fill in: nomination name, description (<1,000 chars, focus on what's genuinely new/different — the depth-of-systems angle from §1), publish date, target countries, up to 5 supplemental URLs (a TestFlight link or a short press-kit works), "Helpful Details" (<500 chars — call out anything genuinely distinctive).
4. Submit at least 3 weeks before the target date; Apple's own docs are inconsistent (some pages say 6–8 weeks, one says up to 3 months for "wider consideration") — the safe read is to submit as early as possible and not treat 3 weeks as safe, treat it as the absolute floor.
**Acceptance criteria:** nomination submitted with a real publish-date target tied to N9's Android launch date.
**Effort:** S (under an hour). **No guaranteed outcome — this is a lottery ticket with asymmetric upside, not a plannable channel.**

### N9. Ship Android — the highest-leverage item in the plan
**Status:** 🟡 ~80% done. Build profile exists; submission plumbing doesn't.
**Depends on:** N1 (key rotation — do not wire a submit profile to the leaked key), N4 (tracking-consent fix, or accept the compliance risk knowingly).
**Steps:**
1. **Add an Android submit profile to `eas.json`** (currently only `submit.production.ios` exists):
   ```json
   "submit": {
     "production": {
       "ios": { "appleTeamId": "S3U8B8HH96", "ascAppId": "6749675615", "language": "en-US" },
       "android": {
         "serviceAccountKeyPath": "./<new-rotated-key-filename>.json",
         "track": "internal"
       }
     }
   }
   ```
   Start `track` at `"internal"` for a first smoke-test submission, then move to `"production"` once confirmed working. **Never commit the service-account key file itself** — reference it by path, keep it gitignored (it already is, per `.gitignore:47`), and store the real file only in your local/CI secret storage.
2. **Produce Android-shaped store assets** — the existing 41 screenshots (`screenshots/iphone-*`, `screenshots/ipad-13/`) are iPhone/iPad aspect ratios only. Google Play needs: phone screenshots (own aspect ratio), a feature graphic (1024×500), and the existing app icon adapted if it isn't already an adaptive icon. Reuse the same hero shots reframed rather than reshooting from scratch.
3. **Update the Play Store listing copy** — same keyword-research pass as N6, adapted for Play's different ranking signals (title/short description/long description weighted differently than iOS).
4. **Privacy policy alignment** — `UPDATED_PRIVACY_POLICY.md` reportedly still describes AdMob as "currently disabled." If ads are live on Android at launch, update this before submitting (Play and Apple both check privacy-policy/data-behavior consistency).
5. Build: `eas build --platform android --profile production`.
6. Submit: `eas submit --platform android --profile production`.
7. Google Play review typically takes longer than Apple's for a first submission — budget for it; use the wait time for N5/N6/N7/N8, not idle time.
**Acceptance criteria:** app live and installable from Google Play; first Android install shows up in the N5 analytics pipeline; N4's tracking-consent fix confirmed live before any EU installs.
**Effort:** M (ops-heavy, not code-heavy — most of the underlying engineering already exists). **Expected impact: roughly doubles realistic top-of-funnel.** Calibrate revenue expectations per the roadmap's §4 (iOS ARPU ~2.5–5x Android's) — this is an installs lever, not primarily a revenue lever.

### N10. Small capped Apple Search Ads experiment
**Status:** 🔴 Open, optional but cheap.
**Steps:** Apple Search Ads Basic (simplest tier) → target long-tail terms adjacent to the N6 keyword list → cap spend at $20–50 total → goal is manufacturing an initial download-velocity signal to help bootstrap organic ranking, not a scaling UA channel.
**Acceptance criteria:** spend cap respected; resulting installs show up in N5's attribution data so you know it worked (or didn't).
**Effort:** S.

### N11. Founder Reddit AMA
**Status:** 🔴 Open.
**Steps:** pick r/IAmA or a game/indie-dev-adjacent subreddit; frame it personally ("I've been building a deep life-sim solo for N months, AMA") rather than promotionally; time it to the N9 Android launch as a real news hook; reply heavily and personally to every comment; respect the informal ~10% self-promotion norm across your Reddit history to avoid a shadowban.
**Acceptance criteria:** thread posted, meaningfully engaged with (not a drive-by post), timed within the same week as the Android launch.
**Effort:** S (your time, no code).

---

## PHASE NEXT (1–3 months)

### X1. Trim the IAP catalog
**Status:** 🟡 Product decision, not a bug — current catalog in `utils/iapConfig.ts` has 27 SKUs (gem packs, bundles, individual perks, banking services, ad removal, subscriptions) ranging $0.99–$99.99.
**Recommendation:** keep a minimal, legible set until conversion data justifies more:
- 2 gem packs (small + large) instead of 5
- 1 bundle (the starter bundle) instead of 4
- `deeplife_unlock_all_perks` only — retire the 4 individual $1.99 perk SKUs it already supersedes
- `deeplife_remove_ads` — keep, cheap and clear
- The two subscription SKUs (`deeplife_premium_monthly`/`_yearly`) — keep, but see X2
- Cut or shelve: banking-service SKUs (`premium_credit_card`, `financial_planning`, `business_banking`, `private_banking`), `revival_pack`, `lifetime_premium` ($79.99) until there's enough traffic to A/B test whether they convert at all
**Acceptance criteria:** reduced SKU list live in App Store Connect/Play Console and `utils/iapConfig.ts`; no player-visible regression (anything already purchased/owned must keep working — check `services/IAPService.ts` entitlement logic doesn't assume a SKU is still purchasable to remain valid for existing owners).
**Effort:** S–M (mostly store-listing and config changes; verify no consumable/entitlement logic breaks for existing owners).

### X2. Fix the weak annual-subscription discount
**File:** `utils/iapConfig.ts:452-455` (`deeplife_premium_yearly`, currently $49.99 vs. $4.99/mo × 12 = $59.88 → 17% discount).
**Recommendation:** move toward a genre-typical ~40–50% annual discount (e.g. ~$34.99/yr) to actually create commitment pressure — 17% doesn't meaningfully beat monthly.
**Acceptance criteria:** new price live in App Store Connect/Play Console + `iapConfig.ts` constant updated to match.
**Effort:** S.

### X3. Resolve the non-functional "ultimate" subscription tier
**File:** `services/SubscriptionService.ts:196-198` — "ultimate" tier is defined to unlock `advanced_analytics`, `priority_support`, `early_access`, none of which are implemented.
**Options:**
- (a) Remove "ultimate" from sale until real benefits exist — avoids selling something intangible (this is the same class of problem as the previously-flagged unwired perks in `tasks/release-readiness.md` S-4).
- (b) Ship minimum-viable versions fast: `early_access` = a TestFlight/internal-track group invite (near-zero engineering), `priority_support` = a tagged support-email queue (near-zero engineering), `advanced_analytics` = a simple in-app stats screen surfacing data the game already tracks (small effort).
**Recommendation:** (b) is cheap enough to just ship rather than pull the tier.
**Acceptance criteria:** every tier a player can pay for delivers a real, testable effect.
**Effort:** S if going with option (b)'s cheapest interpretations.

### X4. Build the Legacy Card shareable mechanic
**Status:** 🔴 Not built — exists only as a proposal in `tasks/retention-and-content-strategy-2026-06-19.md` §7.
**Scope:** auto-generate a stylized end-of-life summary image (career, net worth, family tree, cause of death, a composite score) with a one-tap share sheet to socials. Reuse existing death/end-of-life state (`gameState` already tracks all the needed fields per the prestige/lineage systems).
**Frame this as a growth mechanic first** (shareable, absurd/notable outcomes are what plausibly drives organic reach in this genre), retention second.
**Acceptance criteria:** share sheet produces a real image with correct data for at least the common death paths; manually verified across a few different end-of-life scenarios (natural death, prestige/heir handoff, etc.) before shipping broadly.
**Effort:** M.

### X5. Build the funnel dashboard from N5's telemetry
**Status:** depends on N5.
**Scope:** D1/D7/D30 retention cohorts, install-source breakdown, funnel to first purchase. Doesn't need to be fancy — a simple aggregation view (even a spreadsheet pulling from the telemetry destination) beats nothing.
**Acceptance criteria:** you can answer "did the Android launch / ASO changes / AMA actually move any number" without guessing.
**Effort:** M.

### X6. Continued organic community seeding
**Scope:** ongoing, not a one-shot — genre-adjacent subreddits, r/gamedev Feedback Friday threads, sharing real development/absurd-gameplay moments. Time-cost, not engineering-cost.
**Effort:** ongoing, low-but-nonzero weekly time.

---

## PHASE LATER (3–6+ months) — do not start until NOW/NEXT are validated with real data

### L1. Remote content pipeline
Versioned, signed content manifest (scenarios/careers/diseases/perks currently hardcoded `.ts` arrays) fetched at boot. Prerequisite for L2 and any live-ops cadence. **Large effort — only justified once there's a retained audience worth running live-ops for.**

### L2. Legacy Pass / seasonal battle pass
Free + premium track keyed to the existing prestige/daily-challenge systems. **Hard dependency chain:** needs L1 (remote content) + N5/X5 (working analytics/funnel) + a `STATE_VERSION` bump with a registered migration, which per this repo's own hard rules requires Save System Auditor sign-off before merging (`contexts/game/types.ts` is a protected file; `STATE_VERSION` is canonical in `contexts/game/initialState.ts`). Do not shortcut this sequencing — this repo has a 20-version save-migration history specifically because state-shape changes are treated with real caution.

### L3. Living Story (AI-assisted narrative differentiator)
Per the roadmap's §1, the competitive urgency for this hasn't materialized on mobile yet. If pursued: Tier 1 (authored branching arcs, deterministic, offline, cheap) before Tier 2 (LLM-assisted generation, which needs cost controls, moderation, and an offline fallback — real engineering, not a weekend project).

### L4. Leaderboards / social layer
Needs a real backend and enough concurrent users to not look empty — premature at current scale regardless of engineering readiness.

### L5. Ongoing technical debt (background work, not a gate)
`nextWeek` decomposition (`contexts/game/GameActionsContext.tsx`, ~1,475-line updater), accessibility pass (~21% label coverage currently), `BaseModal` migration completion, design-token consolidation. None of this blocks growth — schedule as background work between the items above, not as a phase of its own.

---

## Sequencing summary

```
Week 0:    N1 (key rotation) ─┬─→ N9 (Android submit profile can now be wired safely)
           N4 (tracking fix) ─┘
           N2, N3 (confirm ops secrets) — parallel, independent
           N5 (analytics on) — parallel, do early so N9/N6 have data to be judged against
           N8 (Featuring Nomination) — parallel, time-sensitive, start now regardless of N9's exact date

Week 1-3:  N6 (ASO rewrite + PPO test) — parallel with N9's review wait time
           N9 (Android build → submit → review)
           N10 (Apple Search Ads experiment) — parallel
           N7 (review prompt) — parallel

Android live:
           N11 (Reddit AMA, timed to launch)
           → begin X1-X6 (Next phase)

Only after Now/Next show real data:
           → L1-L5 (Later phase)
```
