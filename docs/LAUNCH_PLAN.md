# DeepLife Simulator — complete launch plan (coworker handoff)

Everything left to ship to the **Google Play Store** and **Apple App Store**,
written so a Claude coworker can execute the repo/prep tasks and hand the rest to
the owner.

**Legend:** 🤖 = a Claude coworker can do this in the repo / draft it ·
👤 = owner-only (console, device, legal, payments)

Companion docs:
- [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) — quick code-vs-console status.
- [`DATA_SAFETY.md`](./DATA_SAFETY.md) — ready-to-enter Play Data safety + iOS App Privacy answers.
- [`STORE_LISTING.md`](./STORE_LISTING.md) — listing copy + release notes (EN + SV).
- [`privacy-policy.html`](./privacy-policy.html) — updated policy to copy to the support site.
- [`RELEASE_SECRETS.md`](./RELEASE_SECRETS.md) — secrets/keystore setup.

Facts (verified in repo): app **DeepLife Simulator**, package/bundle
`com.deeplife.simulator`, current version **2.5.9**, support
`deeplifesimulator@gmail.com`, privacy
`https://wrexist.github.io/deeplife-sim-support/privacy.html`.

---

## Google Play "App content" — do these in order (Policy ▸ App content)

| # | Item | Answer for this app |
|---|---|---|
| 1 | Privacy policy | Paste the support-site URL (ensure it covers AdMob, Firebase Analytics, Sentry, purchases, cloud saves — see `privacy-policy.html`). |
| 2 | App access | "All functionality available without special access" (CloudSync uses an auto ID, no login). If any part needs credentials, provide test creds. |
| 3 | Ads | **Yes, contains ads** (AdMob). |
| 4 | Content rating | Complete IARC questionnaire. Answer honestly re: simulated gambling/stock market, loans, and "underground economy" → likely Teen/Mature. This clears the "no age rating" state that blocks tester installs. |
| 5 | Target audience & content | Target **18+ (or 16+)**, not children — avoids Families policy. |
| 6 | Data safety | Enter the table from `DATA_SAFETY.md`. |
| 7 | Financial features | "My app doesn't provide any financial features" — the economy is simulated gameplay. |
| 8 | Government / Health / News / COVID | No to all. |
| 9 | Advertising ID | Yes, uses Advertising ID (AdMob); purpose Advertising + Analytics. |

---

## Phase 0 — Accounts & agreements (👤, one-time)
- [ ] 👤 Play developer account active; Developer agreement + payments profile signed.
- [ ] 👤 Play app created for `com.deeplife.simulator`.
- [ ] 👤 Apple Developer account + App Store Connect record (same bundle id).
- [ ] 👤 Determine if the Play account is **personal, created after Nov 13, 2023** → if so, the **12-tester / 14-day closed test** is mandatory before production. Start it early (long pole).

## Phase 1 — Unblock internal testing (current blocker)
- [ ] 👤 Complete **all App content items** above (Content rating is the key one).
- [ ] 👤 Internal testing ▸ Countries/regions → include **Sweden** + tester locations.
- [ ] 👤 Confirm release status = "Available to internal testers."
- [ ] 🤖 Provide the Data safety answer set → `DATA_SAFETY.md`. 👤 confirm each row before submitting.
- [ ] 🤖 Update the privacy policy to cover AdMob/Firebase/Sentry/CloudSync/IAP → `privacy-policy.html`; 👤 copy to the `deeplife-sim-support` repo's `privacy.html`.

## Phase 2 — In-app purchases
- [ ] 🤖 Re-diff store product IDs vs. code on request (verified: `deeplife_gems_{100,500,1000,5000,15000}`, `deeplife_premium_monthly`, `deeplife_premium_yearly`, `deeplife_lifetime_premium`, Remove-Ads).
- [ ] 👤 Play → Monetize → Products: create in-app products + subscriptions (monthly/yearly in one group), set prices, set **Active**.
- [ ] 👤 App Store Connect: create matching IAPs/subscriptions; submit **with** the first build.
- [ ] 👤 Add **license testers** (Play) / **sandbox testers** (Apple) so test purchases are free.

## Phase 3 — Build, verify banner, internal test
- [ ] 🤖 Bump `version` in `package.json` for each build.
- [ ] 👤 Run **"Android Play Store (local build · no cloud credits)"** → set version, **Submit off**. Tick **`force_banner`** to verify the DeepLife+ banner on a premium account (QA build — the workflow refuses to submit it to Play).
- [ ] 👤 Download the `.aab` artifact → Internal testing → upload (first upload manual) → Start rollout.
- [ ] 👤 Install as tester → verify: banner shows, IAP purchase flow (license tester), ads, saves/cloud sync.

## Phase 4 — Closed testing (if the 14-day rule applies)
- [ ] 👤 Create Closed testing track; recruit **12+ testers**; keep them opted in **14 continuous days**.
- [ ] 🤖 Draft tester recruitment + opt-in/install instructions (EN + SV).
- [ ] 👤 After 14 days, apply for production access.

## Phase 5 — Store listing & assets
- [ ] 🤖 Listing copy + release notes (EN + SV) → `STORE_LISTING.md`.
- [ ] 🤖 Feature graphic (1024×500) + screenshot-framing specs/prompts (DeepLife+ gold theme); WebP/PNG-optimize generated art.
- [ ] 👤 Capture screenshots (phone + tablet); upload icon, feature graphic, screenshots to both consoles.

## Phase 6 — iOS parallel track
- [ ] 🤖 iOS config confirmed (ATT plugin, IAP IDs, version) in `app.config.js`.
- [ ] 👤 Build iOS via the EAS/TestFlight workflow; complete **App Privacy** (tracking = yes); submit IAPs; fill listing; submit for review.

## Phase 7 — Android ads (optional; Android currently ad-free)
- [ ] 👤 Create Android AdMob app + banner/interstitial/rewarded units.
- [ ] 👤 Add secrets: `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `..._BANNER_ANDROID`, `..._INTERSTITIAL_ANDROID`, `..._REWARDED_ANDROID`.
- [ ] 🤖 Remove `--warn-missing-android-admob` from the Android workflow so Android ads become a blocking preflight check (PR once units exist).

## Phase 8 — Production
- [ ] 👤 Promote tested build to Production (Play) / submit for App Review (Apple).
- [ ] 🤖 Final release notes + post-launch monitoring note (Sentry crash-free rate to watch).

---

## Quick "coworker, do the next repo task" index
- Bump version → `package.json` `version`.
- Store copy tweaks → `STORE_LISTING.md`.
- Data safety changes when SDKs change → `DATA_SAFETY.md`.
- Enable Android ads → drop `--warn-missing-android-admob` in `.github/workflows/eas-build-local-android.yml`.
- Banner QA → run the Android workflow with `force_banner` on.
