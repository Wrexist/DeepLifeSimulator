# Audit inventory: main before cleanup

Historical snapshot at `811cfc2cec03f9cae1f0b0bb4e55298dcadf06c5`. Paths and checkboxes below are historical records, not the active queue.

## Appendix A: complete tracked Markdown checkbox inventory

Scanned **250 tracked Markdown files** on main. Found **908 unchecked boxes** and **340 checked boxes**. Neither count is a count of unique features, current bugs or verified completed work. Includes templates, historical checklists and marketing plans. Read failures: 0.

### .github/PULL_REQUEST_TEMPLATE.md

- Line 9: Touches `app/` (router-loaded screens) — **MUST** run `npm test -- __tests__/startup` _(section: Risk)_
- Line 10: Touches `app/_layout.tsx` or `app/entry.ts` — verify with a TestFlight build before merging _(section: Risk)_
- Line 11: Touches `contexts/game/` (state/provider/actions) — run full stress test suite (`npm test -- __tests__/stress`) _(section: Risk)_
- Line 12: Touches `utils/saveValidation.ts`, `utils/saveQueue.ts`, `utils/saveBackup.ts`, or `contexts/game/initialState.ts` — run save-system tests _(section: Risk)_
- Line 13: Touches `services/IAPService.ts` or `services/AdMobService.ts` — verify with the relevant SDK in a TestFlight build _(section: Risk)_
- Line 14: Adds or modifies a native module dependency — verify `app.config.js` plugin entry matches `package.json` _(section: Risk)_
- Line 15: Touches `.github/workflows/*.yml` — parse locally and confirm in GitHub's Actions tab _(section: Risk)_
- Line 16: Touches `.env`, `eas.json`, or any secret-bearing config — confirm no secret values committed _(section: Risk)_
- Line 17: Uses `React.lazy()` or `import()` inside a screen file — high risk of Hermes minification crash (see R6 lesson) _(section: Risk)_
- Line 23: `npm run type-check` — 0 errors _(section: Verification done locally)_
- Line 24: `npm test -- __tests__/startup` — all green _(section: Verification done locally)_
- Line 25: `npm run lint` — no new warnings _(section: Verification done locally)_
- Line 26: `npm run preflight` (if shipping to TestFlight) — all sections green _(section: Verification done locally)_
- Line 27: Manual smoke test on at least one device/sim if UI changed _(section: Verification done locally)_
### SCREENSHOT_GUIDE.md

- Line 71: All three device classes populated, ten images each, `01` first _(section: Before submitting)_
- Line 72: Images show the version being submitted, not an older build _(section: Before submitting)_
- Line 73: No placeholder or dev-tools state visible in any frame _(section: Before submitting)_
- Line 74: Store metadata matches what the screenshots show (`marketing/aso/metadata.mjs`) _(section: Before submitting)_
- Line 75: `docs/RELEASE_RUNBOOK.md` followed top to bottom for the rest of the release _(section: Before submitting)_
### docs/GOOGLE_PLAY_RELEASE_PLAN.md

- Line 127: 👤 Account created and $25 paid _(section: A.3 Checklist)_
- Line 128: 👤 Identity/business verification **completed** (not just submitted) _(section: A.3 Checklist)_
- Line 129: 👤 Account type recorded here: `personal` / `organization` → decides §9 _(section: A.3 Checklist)_
- Line 130: 👤 Payments profile active, tax + bank details submitted _(section: A.3 Checklist)_
- Line 131: 👤 2FA on the owner Google account _(section: A.3 Checklist)_
- Line 192: 🤖 Bump `package.json` `version` for **every** build you upload (`2.6.0` → _(section: 4.3 Version bump 🤖)_
- Line 204: 👤/🤖 Confirm the resolved `com.android.billingclient:billing` is **8.x**. _(section: 4.4 Verify the two Aug 31 gates ⚠️)_
- Line 207: If it resolves **below 8**, fix it in a way that survives the build. ⚠️ _(section: 4.4 Verify the two Aug 31 gates ⚠️)_
- Line 218: Confirm `targetSdkVersion 36` in the generated `android/build.gradle` ext block. _(section: 4.4 Verify the two Aug 31 gates ⚠️)_
- Line 219: **Put the folder back afterward — both commands, in this order:** _(section: 4.4 Verify the two Aug 31 gates ⚠️)_
- Line 254: 👤 Deploy (`cd server/iap-verify && vercel --prod`) and set those env vars. _(section: 4.6 Receipt-verification server (Google side) 👤)_
- Line 255: 👤 **Exercise the contract, not just the hostname.** `api/verify.js` expects a _(section: 4.6 Receipt-verification server (Google side) 👤)_
- Line 271: All required secrets set _(section: 4.7 Phase B checklist)_
- Line 272: EAS Android keystore created **and backed up** _(section: 4.7 Phase B checklist)_
- Line 273: Billing Library resolves to 8.x; targetSdk 36 confirmed _(section: 4.7 Phase B checklist)_
- Line 274: Local gates green _(section: 4.7 Phase B checklist)_
- Line 275: Verify server live with the three Google env vars _(section: 4.7 Phase B checklist)_
- Line 307: 👤 App created with the exact package name _(section: 5.2 Play App Signing)_
- Line 308: 👤 Play App Signing accepted on first upload _(section: 5.2 Play App Signing)_
- Line 356: 👤 All 10 App content items show **Complete** (green) on the dashboard _(section: 6.1 Content rating (IARC) — answer these honestly)_
- Line 403: 👤 Listing text (EN) entered _(section: 7.4 Swedish localization (optional, recommended))_
- Line 404: 👤 Icon + feature graphic + ≥3 phone screenshots (4–6 recommended) uploaded _(section: 7.4 Swedish localization (optional, recommended))_
- Line 405: 👤 Tablet screenshots — skip unless Android tablet support is added _(section: 7.4 Swedish localization (optional, recommended))_
- Line 406: 👤 Category + contact details set _(section: 7.4 Swedish localization (optional, recommended))_
- Line 407: 👤 SV localization added _(section: 7.4 Swedish localization (optional, recommended))_
- Line 485: 👤 **Upload the Play service-account JSON to RevenueCat** → RC → Apps → Play _(section: 8.3 Wire RevenueCat for Android ⚠️ blocker)_
- Line 488: 👤 Set `EXPO_PUBLIC_RC_ANDROID_KEY` as a build secret _(section: 8.3 Wire RevenueCat for Android ⚠️ blocker)_
- Line 489: 👤 Create every product in RC → Products with the exact store IDs above _(section: 8.3 Wire RevenueCat for Android ⚠️ blocker)_
- Line 490: 👤 Attach entitlements: `deeplife_remove_ads` → `ads_removed`; _(section: 8.3 Wire RevenueCat for Android ⚠️ blocker)_
- Line 493: 👤 Create the `default` Offering with monthly + yearly packages _(section: 8.3 Wire RevenueCat for Android ⚠️ blocker)_
- Line 541: 👤 All 26 one-time products created and **Active** _(section: 8.5 License testers (free test purchases))_
- Line 542: 👤 Both subscriptions with active base plans _(section: 8.5 License testers (free test purchases))_
- Line 543: 👤 RevenueCat Android credentials uploaded + products/entitlements/offering _(section: 8.5 License testers (free test purchases))_
- Line 544: 👤 License testers added (include yourself) _(section: 8.5 License testers (free test purchases))_
- Line 579: App launches — no white screen, no crash on cold start _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 580: Onboarding → create a character → play 10+ weeks _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 581: **Save/load:** force-quit mid-life, relaunch, save restores intact _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 582: Cloud sync round-trips _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 583: **Store opens** from every entry point (HUD Shop pill, gem chip, death popup, _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 585: Buy `deeplife_gems_100` as a license tester → gems credited **once** _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 586: Buy `deeplife_remove_ads` → ads/upsells stop _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 587: Subscribe to `deeplife_premium_monthly` → DeepLife+ unlocks _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 588: **Restore Purchases** after a reinstall → non-consumables return, gem packs _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 590: Kill the app mid-purchase, relaunch → the transaction completes **exactly once** _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 591: **Ads are absent and nothing breaks** — Android ships ad-free; confirm the ad _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 593: **Android back button** behaves on every modal _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 594: Rotate/resize checks on a tablet if you claim tablet support _(section: 9.3 The smoke test — do this on a real Android device before recruiting anyone)_
- Line 758: 👤 **Recommended, not required:** ship at least one update to the closed track _(section: 10.6 During the 14 days)_
- Line 764: 👤 Reply to every tester who reports something. Retention of testers is the _(section: 10.6 During the 14 days)_
- Line 766: 👤 Watch **Play Console → Quality → Android vitals** for crashes and ANRs. _(section: 10.6 During the 14 days)_
- Line 767: 👤 Do **not** let the track go empty or the release become inactive. _(section: 10.6 During the 14 days)_
- Line 768: 🤖 Fix reported bugs, bump the version, rebuild, and this time tick **Submit** _(section: 10.6 During the 14 days)_
- Line 799: 👤 Applied _(section: 11. Phase I — Apply for production access 👤 ⏱️)_
- Line 800: 👤 Approved (production track unlocks) _(section: 11. Phase I — Apply for production access 👤 ⏱️)_
- Line 807: 🤖 Bump `package.json` version (e.g. `2.7.0`) _(section: 12.1 Pre-flight for the release build)_
- Line 808: 🤖 `npm run preflight:android` green _(section: 12.1 Pre-flight for the release build)_
- Line 809: 🤖 Release notes written (≤500 chars) — update `RELEASE_NOTES.md` / `WHATS_NEW.md` _(section: 12.1 Pre-flight for the release build)_
- Line 810: 👤 Run the workflow with **Submit on**, track `production`, `force_banner` _(section: 12.1 Pre-flight for the release build)_
- Line 830: Store listing renders correctly on the live page (`PLAY_STORE_URL` in _(section: 12.4 Launch-day checks)_
- Line 832: Install from the public listing on a device that was never a tester _(section: 12.4 Launch-day checks)_
- Line 833: Make one **real** (not license-tester) purchase and confirm it grants, then _(section: 12.4 Launch-day checks)_
- Line 835: Confirm the privacy policy URL resolves _(section: 12.4 Launch-day checks)_
- Line 836: Announce on Discord, and to your iOS players _(section: 12.4 Launch-day checks)_
### docs/LAUNCH_CHECKLIST.md

- Line 59: **First `.aab` uploaded manually** — Google requires the very first upload _(section: ☐ Do in Google Play Console (Android))_
- Line 61: **14-day closed testing** — if this is a **personal** developer account _(section: ☐ Do in Google Play Console (Android))_
- Line 66: **Android AdMob ad units** — not created yet. The Android build runs with _(section: ☐ Do in Google Play Console (Android))_
- Line 71: **IAP products created & Active** in Play Console with the exact IDs above, _(section: ☐ Do in Google Play Console (Android))_
- Line 73: **Store listing** — title, description, screenshots, **1024×500 feature _(section: ☐ Do in Google Play Console (Android))_
- Line 75: **Declarations** — Data safety, Content rating, Target audience & content, _(section: ☐ Do in Google Play Console (Android))_
- Line 80: **IAP products created & Active** with matching IDs (and subscriptions in a _(section: ☐ Do in App Store Connect (iOS))_
- Line 82: **App Privacy** questionnaire (tracking = yes, since ATT/AdMob). _(section: ☐ Do in App Store Connect (iOS))_
- Line 83: **Store listing** — screenshots, description, keywords, support/marketing _(section: ☐ Do in App Store Connect (iOS))_
### docs/LAUNCH_PLAN.md

- Line 47: 👤 Play developer account active; Developer agreement + payments profile signed. _(section: Phase 0 — Accounts & agreements (👤, one-time))_
- Line 48: 👤 Play app created for `com.deeplife.simulator`. _(section: Phase 0 — Accounts & agreements (👤, one-time))_
- Line 49: 👤 Apple Developer account + App Store Connect record (same bundle id). _(section: Phase 0 — Accounts & agreements (👤, one-time))_
- Line 50: 👤 Determine if the Play account is **personal, created after Nov 13, 2023** → if so, the **12-tester / 14-day closed test** is mandatory before production. Start it early (long pole). _(section: Phase 0 — Accounts & agreements (👤, one-time))_
- Line 53: 👤 Complete **all App content items** above (Content rating is the key one). _(section: Phase 1 — Unblock internal testing (current blocker))_
- Line 54: 👤 Internal testing ▸ Countries/regions → include **Sweden** + tester locations. _(section: Phase 1 — Unblock internal testing (current blocker))_
- Line 55: 👤 Confirm release status = "Available to internal testers." _(section: Phase 1 — Unblock internal testing (current blocker))_
- Line 56: 🤖 Provide the Data safety answer set → `DATA_SAFETY.md`. 👤 confirm each row before submitting. _(section: Phase 1 — Unblock internal testing (current blocker))_
- Line 57: 🤖 Update the privacy policy to cover AdMob/Firebase/Sentry/CloudSync/IAP → `privacy-policy.html`; 👤 copy to the `deeplife-sim-support` repo's `privacy.html`. _(section: Phase 1 — Unblock internal testing (current blocker))_
- Line 60: 🤖 Re-diff store product IDs vs. code on request (verified: `deeplife_gems_{100,500,1000,5000,15000}`, `deeplife_premium_monthly`, `deeplife_premium_yearly`, `deeplife_lifetime_premium`, Remove-Ads). _(section: Phase 2 — In-app purchases)_
- Line 61: 👤 Play → Monetize → Products: create in-app products + subscriptions (monthly/yearly in one group), set prices, set **Active**. _(section: Phase 2 — In-app purchases)_
- Line 62: 👤 App Store Connect: create matching IAPs/subscriptions; submit **with** the first build. _(section: Phase 2 — In-app purchases)_
- Line 63: 👤 Add **license testers** (Play) / **sandbox testers** (Apple) so test purchases are free. _(section: Phase 2 — In-app purchases)_
- Line 66: 🤖 Bump `version` in `package.json` for each build. _(section: Phase 3 — Build, verify banner, internal test)_
- Line 67: 👤 Run **"Android Play Store (local build · no cloud credits)"** → set version, **Submit off**. Tick **`force_banner`** to verify the DeepLife+ banner on a premium account (QA build — the workflow refuses to submit it to Play). _(section: Phase 3 — Build, verify banner, internal test)_
- Line 68: 👤 Download the `.aab` artifact → Internal testing → upload (first upload manual) → Start rollout. _(section: Phase 3 — Build, verify banner, internal test)_
- Line 69: 👤 Install as tester → verify: banner shows, IAP purchase flow (license tester), ads, saves/cloud sync. _(section: Phase 3 — Build, verify banner, internal test)_
- Line 72: 👤 Create Closed testing track; recruit **12+ testers**; keep them opted in **14 continuous days**. _(section: Phase 4 — Closed testing (if the 14-day rule applies))_
- Line 73: 🤖 Draft tester recruitment + opt-in/install instructions (EN + SV). _(section: Phase 4 — Closed testing (if the 14-day rule applies))_
- Line 74: 👤 After 14 days, apply for production access. _(section: Phase 4 — Closed testing (if the 14-day rule applies))_
- Line 77: 🤖 Listing copy + release notes (EN + SV) → `STORE_LISTING.md`. _(section: Phase 5 — Store listing & assets)_
- Line 78: 🤖 Feature graphic (1024×500) + screenshot-framing specs/prompts (DeepLife+ gold theme); WebP/PNG-optimize generated art. _(section: Phase 5 — Store listing & assets)_
- Line 79: 👤 Capture screenshots (phone + tablet); upload icon, feature graphic, screenshots to both consoles. _(section: Phase 5 — Store listing & assets)_
- Line 82: 🤖 iOS config confirmed (ATT plugin, IAP IDs, version) in `app.config.js`. _(section: Phase 6 — iOS parallel track)_
- Line 83: 👤 Build iOS via the EAS/TestFlight workflow; complete **App Privacy** (tracking = yes); submit IAPs; fill listing; submit for review. _(section: Phase 6 — iOS parallel track)_
- Line 86: 👤 Create Android AdMob app + banner/interstitial/rewarded units. _(section: Phase 7 — Android ads (optional; Android currently ad-free))_
- Line 87: 👤 Add secrets: `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `..._BANNER_ANDROID`, `..._INTERSTITIAL_ANDROID`, `..._REWARDED_ANDROID`. _(section: Phase 7 — Android ads (optional; Android currently ad-free))_
- Line 88: 🤖 Remove `--warn-missing-android-admob` from the Android workflow so Android ads become a blocking preflight check (PR once units exist). _(section: Phase 7 — Android ads (optional; Android currently ad-free))_
- Line 91: 👤 Promote tested build to Production (Play) / submit for App Review (Apple). _(section: Phase 8 — Production)_
- Line 92: 🤖 Final release notes + post-launch monitoring note (Sentry crash-free rate to watch). _(section: Phase 8 — Production)_
### docs/RELEASE-2.7.0-SUBMISSION.md

- Line 67: `EXPO_PUBLIC_RC_IOS_KEY` — RevenueCat *public* app key (`appl_…`). _(section: ☐ Needs an EAS login — 2 commands, blocks the build)_
- Line 69: `EXPO_PUBLIC_SAVE_HMAC_KEY` — 64 hex chars, freshly generated. _(section: ☐ Needs an EAS login — 2 commands, blocks the build)_
- Line 85: **Upload the App Preview video.** Shot script with timings, captions and _(section: ☐ Needs App Store Connect — the highest-value hour available)_
- Line 89: **Upload screenshots.** Already generated and submission-ready: _(section: ☐ Needs App Store Connect — the highest-value hour available)_
- Line 92: **Paste the new subtitle, keyword field, promotional text and What's New** _(section: ☐ Needs App Store Connect — the highest-value hour available)_
- Line 94: **Replace the placeholder social preview image.** The App Store link _(section: ☐ Needs App Store Connect — the highest-value hour available)_
- Line 98: **Submit a Featuring nomination.** Solo dev, rebuilt economy from player _(section: ☐ Needs App Store Connect — the highest-value hour available)_
- Line 100: **Set the App Store Connect version record.** Next is **1.5.0** — do NOT _(section: ☐ Needs App Store Connect — the highest-value hour available)_
- Line 112: **Keep everything paused** until page conversion ≥ 55% **and** D1 ≥ 30%. _(section: ☐ Needs the Apple Ads console — after the page work, not before)_
- Line 114: **Kill `DLS-US-Competitor-Exact`.** 4.66% tap-through against a 7.72% _(section: ☐ Needs the Apple Ads console — after the page work, not before)_
- Line 117: **Restart `DLS-US-Category-Exact` first**, same $12/day. Raise to $20 only _(section: ☐ Needs the Apple Ads console — after the page work, not before)_
- Line 119: **Keep `DLS-US-Discovery-Broad` at minimum** as a keyword harvester. _(section: ☐ Needs the Apple Ads console — after the page work, not before)_
- Line 126: TestFlight smoke: create a life in **each** mode, confirm classic is _(section: ☐ Needs a device — before submitting)_
- Line 128: Confirm an **existing** save loads and still advances one week per tap — _(section: ☐ Needs a device — before submitting)_
- Line 130: Confirm the obituary share sheet shows the App Store link. _(section: ☐ Needs a device — before submitting)_
- Line 131: Bump `BUILD_NUMBER` at EAS build time. `eas build --local` never _(section: ☐ Needs a device — before submitting)_
### docs/RELEASE_RUNBOOK.md

- Line 54: Open `package.json` and raise `version`. _(section: Part 1 · Bump the version 🔴 (1 min))_
- Line 55: Add the matching entry at the TOP of `lib/config/changelog.ts` (the in-app _(section: Part 1 · Bump the version 🔴 (1 min))_
- Line 89: Confirm the published calendar still covers the months ahead. _(section: Part 1b · Check the live events calendar 🟡 (2 min))_
- Line 128: Sign in at <https://app.revenuecat.com> _(section: 2a · `EXPO_PUBLIC_RC_IOS_KEY` — fetch it)_
- Line 129: Pick the DeepLife project (top-left switcher). No project yet? _(section: 2a · `EXPO_PUBLIC_RC_IOS_KEY` — fetch it)_
- Line 132: **Project settings → API keys → App specific keys** _(section: 2a · `EXPO_PUBLIC_RC_IOS_KEY` — fetch it)_
- Line 133: Copy the **App Store** row. It starts `appl_`. _(section: 2a · `EXPO_PUBLIC_RC_IOS_KEY` — fetch it)_
- Line 152: Save it in a password manager **before** you paste it anywhere. It cannot _(section: 2b · `EXPO_PUBLIC_SAVE_HMAC_KEY` — generate it)_
- Line 180: **Check `EXIT: 0`, not the green banner.** _(section: Part 3 · Preflight 🔴 (3 min))_
- Line 197: Commit and push the version bump first. _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 198: Trigger the build (owner runs this; it is not automatic). _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 204: Wait for it to finish, then submit to TestFlight. _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 205: Install from TestFlight and check three things the emulator cannot: _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 206: the app **saves and reloads** (proves the HMAC key was inlined correctly) _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 207: a **sandbox purchase completes** (proves the RevenueCat key is right) _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 208: character creation renders faces (proves the avatar bundle shipped) _(section: Part 4 · Build and upload to TestFlight (~40 min, mostly waiting))_
- Line 248: Change the app name to: _(section: 5a · Name 🔴 — this is a decision)_
- Line 271: Set the subtitle to: _(section: 5b · Subtitle 🔴)_
- Line 284: Copy the `[Apple · Keywords]` block from `npm run aso`, exactly, including _(section: 5c · Keywords 🔴)_
- Line 308: Copy the `[Apple · Promotional text]` block from `npm run aso`. _(section: 5d · Promotional text 🟡)_
- Line 315: Copy the `[Apple · Description]` block from `npm run aso`. _(section: 5e · Description 🟡)_
- Line 340: Upload all ten from each folder **in filename order** — `01…` first. The _(section: Part 6 · Screenshots (10 min))_
- Line 354: If the UI has changed since the last capture, **re-capture before _(section: Part 6 · Screenshots (10 min))_
- Line 363: 🟡 **App preview video is NOT done.** It needs a real device or simulator — _(section: Part 6 · Screenshots (10 min))_
- Line 379: Subtitle: _(section: Part 7 · Add the Spanish (Mexico) localisation 🟡 (10 min))_
- Line 385: Keywords: _(section: Part 7 · Add the Spanish (Mexico) localisation 🟡 (10 min))_
- Line 391: Description and promotional text: copy the `es-MX` blocks from _(section: Part 7 · Add the Spanish (Mexico) localisation 🟡 (10 min))_
- Line 423: Done, or consciously skipped. _(section: Part 8 · Rename the in-app purchases 🟡 (10 min))_
- Line 433: Attach the build from Part 4. _(section: Part 9 · Submit for review)_
- Line 434: Answer the export-compliance and content questions. _(section: Part 9 · Submit for review)_
- Line 435: 🔴 Re-attach every IAP and subscription to the version. A rejection returns _(section: Part 9 · Submit for review)_
- Line 438: Submit. _(section: Part 9 · Submit for review)_
- Line 452: 🟡 **Start a Product Page Optimization test.** Apple A/B-tests the _(section: Part 10 · After it is approved)_
- Line 456: 🟡 **Replace the placeholder social preview image.** Every share of the App _(section: Part 10 · After it is approved)_
- Line 459: 🟡 **Submit a featuring nomination.** Solo developer, rebuilt the in-game _(section: Part 10 · After it is approved)_
- Line 462: 🟡 Watch **App Analytics → impressions** for a week to see whether Part 7 _(section: Part 10 · After it is approved)_
- Line 472: Title: `Deep Life Simulator: Tycoon` _(section: Part 11 · Google Play (Android))_
- Line 473: Short description (80): `Career, crime, stocks and property. Build a fortune, then pass it on.` _(section: Part 11 · Google Play (Android))_
- Line 474: Long description: the `[Play · Long]` block from `npm run aso` _(section: Part 11 · Google Play (Android))_
- Line 475: Screenshots: upload the **iPhone 6.9"** set — Play accepts them _(section: Part 11 · Google Play (Android))_
- Line 476: Data safety form: [`DATA_SAFETY.md`](./DATA_SAFETY.md) _(section: Part 11 · Google Play (Android))_
- Line 477: Content rating questionnaire (the game contains crime and gambling themes — _(section: Part 11 · Google Play (Android))_
### docs/REVENUECAT-SETUP.md

- Line 33: **Apple Developer Program** membership (paid), with **App Manager/Admin** access to App Store Connect for `com.deeplife.simulator` (App Store app id `6749675615`, Team `S3U8B8HH96`). _(section: Part 0 — Prerequisites)_
- Line 34: **Paid Applications Agreement** signed in App Store Connect → *Business* → *Agreements*, and **banking + tax** filled in. **IAP will silently fail until this is "Active".** This is the #1 cause of "products won't load". _(section: Part 0 — Prerequisites)_
- Line 35: A **RevenueCat account** (free up to ~$2.5k/mo tracked revenue): <https://app.revenuecat.com/signup>. _(section: Part 0 — Prerequisites)_
- Line 36: (Android only) **Google Play Console** access + a **service account** with the Play Developer API enabled. _(section: Part 0 — Prerequisites)_
- Line 37: The app's product IDs (already defined in `utils/iapConfig.ts` — see the [Product reference](#appendix-a--product-reference) at the bottom). **Use these exact IDs everywhere.** _(section: Part 0 — Prerequisites)_
- Line 289: Store screen loads with **real localized prices** (not the `$x.xx` fallbacks) → catalog + agreements are correct. _(section: Part 6 — Testing)_
- Line 290: Buy `deeplife_gems_100` → gems credited; RevenueCat dashboard → **Customer History** shows the transaction. _(section: Part 6 — Testing)_
- Line 291: Buy `deeplife_remove_ads` → banners/interstitials stop, reward orb disappears, `ads_removed` entitlement active in RC. _(section: Part 6 — Testing)_
- Line 292: Start the **DeepLife+ annual** flow → the **7-day free trial** is offered by the system sheet; after purchase `premium` + `ads_removed` are active. _(section: Part 6 — Testing)_
- Line 293: **Restore Purchases** on a reinstall → non-consumables + subscription come back; consumable gem balances correctly do **not**. _(section: Part 6 — Testing)_
- Line 294: Kill the app mid-purchase → relaunch → entitlement reconciles (RevenueCat handles this) and gems grant exactly once. _(section: Part 6 — Testing)_
- Line 301: Paid Applications Agreement **Active**; banking + tax complete. _(section: Part 7 — Go-live checklist)_
- Line 302: All product IDs from Appendix A created in App Store Connect (+ Play if Android), status ≥ "Ready to Submit". _(section: Part 7 — Go-live checklist)_
- Line 303: 7-day free trial added to **both** subscriptions (or `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS` set to `0`). _(section: Part 7 — Go-live checklist)_
- Line 304: RevenueCat apps configured with shared secret / IAP key (iOS) and service account (Android). _(section: Part 7 — Go-live checklist)_
- Line 305: `premium` + `ads_removed` entitlements attached to the right products. _(section: Part 7 — Go-live checklist)_
- Line 306: `default` offering with annual/monthly/lifetime packages. _(section: Part 7 — Go-live checklist)_
- Line 307: App configured with the RC public keys; verify-server gate removed. _(section: Part 7 — Go-live checklist)_
- Line 308: Full sandbox test pass (Part 6) green on a TestFlight build. _(section: Part 7 — Go-live checklist)_
- Line 309: Submit the IAPs/subscriptions **with** the app binary for review (first-time IAPs are reviewed alongside the app). _(section: Part 7 — Go-live checklist)_
### docs/REVENUECAT-TODO.md

- Line 25: **Upload a Google Play Service Account JSON key** — this is a credential file, so it has to be done by you directly, not by me. Steps: _(section: 1c. Connect Google Play (Android) — ⚠️ PARTIALLY DONE, blocked on you)_
- Line 31: **This step is a hard prerequisite for real purchases to validate on Android** — RC can't verify Android transactions without it, even after products exist. _(section: 1c. Connect Google Play (Android) — ⚠️ PARTIALLY DONE, blocked on you)_
- Line 54: Go to **Offerings** → Create offering (identifier: `default`) _(section: 1f. Create the Default Offering)_
- Line 55: Add packages: _(section: 1f. Create the Default Offering)_
- Line 59: Set 7-day free trial on both subscription products in App Store Connect (see §2 below) — RC reads trial eligibility from the store, not the RC dashboard _(section: 1f. Create the Default Offering)_
- Line 265: Create a Sandbox tester account in App Store Connect _(section: Sandbox / TestFlight (iOS))_
- Line 266: Install the TestFlight build _(section: Sandbox / TestFlight (iOS))_
- Line 267: Purchase `deeplife_premium_monthly` — confirm 7-day trial, then confirm entitlement appears in-game _(section: Sandbox / TestFlight (iOS))_
- Line 268: Purchase `deeplife_gems_500` (consumable) — confirm gems are granted _(section: Sandbox / TestFlight (iOS))_
- Line 269: Restore purchases — confirm entitlements restore correctly _(section: Sandbox / TestFlight (iOS))_
- Line 270: Open the in-game subscription settings → "Manage" — confirm RevenueCat Customer Center opens _(section: Sandbox / TestFlight (iOS))_
- Line 273: Add a test account to the internal testing track in Play Console _(section: Internal Testing Track (Android))_
- Line 274: Install the build _(section: Internal Testing Track (Android))_
- Line 275: Purchase `deeplife_premium_monthly` — confirm subscription goes through via offering context _(section: Internal Testing Track (Android))_
- Line 276: Purchase `deeplife_gems_500` — confirm consumable grant _(section: Internal Testing Track (Android))_
- Line 277: Test restore _(section: Internal Testing Track (Android))_
- Line 280: After each test purchase, check **RevenueCat → Customers** to confirm the transaction and entitlement appear _(section: RevenueCat Dashboard Verification)_
- Line 281: Confirm `premium` entitlement is active for the subscription tester _(section: RevenueCat Dashboard Verification)_
- Line 282: Confirm no errors in the RC event feed _(section: RevenueCat Dashboard Verification)_
- Line 288: All store products created, reviewed, and active _(section: 7. Pre-Launch Checklist)_
- Line 289: RC dashboard: entitlements, products, and default offering fully configured _(section: 7. Pre-Launch Checklist)_
- Line 290: EAS secrets set for both iOS and Android keys _(section: 7. Pre-Launch Checklist)_
- Line 291: TestFlight + Android internal track testing complete _(section: 7. Pre-Launch Checklist)_
- Line 292: `EXPO_PUBLIC_ENABLE_DEVTOOLS` removed from the `production` profile in `eas.json` (or intentionally kept — see note in `.env.example`) _(section: 7. Pre-Launch Checklist)_
- Line 293: Production EAS build triggers with `EXPO_PUBLIC_USE_REVENUECAT=true` confirmed (check `eas.json` production env ✅ already set by code fix) _(section: 7. Pre-Launch Checklist)_
### docs/SHIPPING-THE-RETENTION-WORK.md

- Line 17: Review and merge **[PR #148](https://github.com/Wrexist/DeepLifeSimulator/pull/148)** _(section: Step 1 · Merge the PR)_
- Line 42: Edit `version` in `package.json`: **`2.9.0` → `2.10.0`** _(section: Step 2 · Bump the version)_
- Line 43: Commit and push to `main` _(section: Step 2 · Bump the version)_
- Line 60: GitHub → **Actions** → **iOS TestFlight (local build · no cloud credits)** → **Run workflow** _(section: Step 3 · Build to TestFlight)_
- Line 61: `version`: **`2.10.0`** (must match what you set in Step 2) _(section: Step 3 · Build to TestFlight)_
- Line 62: Leave **Submit the build to TestFlight** ticked _(section: Step 3 · Build to TestFlight)_
- Line 63: Leave **Watch the submission** ticked _(section: Step 3 · Build to TestFlight)_
- Line 89: The app **saves and reloads** — proves the HMAC key inlined correctly _(section: 4a · The standing three (any release))_
- Line 90: A **sandbox purchase completes** — proves the RevenueCat key is right _(section: 4a · The standing three (any release))_
- Line 91: **Character creation renders faces** — proves the avatar bundle shipped _(section: 4a · The standing three (any release))_
- Line 95: **Home screen** shows a "WHAT NEXT / Your next moves" card with NOW / SOON / DREAM _(section: 4b · New in this release)_
- Line 96: Tapping a goal **navigates to the right tab** _(section: 4b · New in this release)_
- Line 97: The **shop button in the HUD is gold** and shines about every 5 seconds _(section: 4b · New in this release)_
- Line 98: Open the shop → **"This week: <pack name>"** row is visible on the tab you land on (Featured) _(section: 4b · New in this release)_
- Line 99: Tap it → the **Offer Center** opens showing last / this / next week _(section: 4b · New in this release)_
- Line 100: The featured offer shows **pack art, three benefit lines, and a value line** _(section: 4b · New in this release)_
- Line 101: **The price appears ONCE per card** — on the button only, e.g. `BUY · $9.99` _(section: 4b · New in this release)_
- Line 102: On the **Upgrades** tab, gem costs still appear on the left (their buttons say "Redeem" / "Not enough gems") _(section: 4b · New in this release)_
- Line 128: On the TestFlight device, **allow tracking** when the ATT prompt appears _(section: Step 5 · Confirm analytics is actually recording 🔴)_
- Line 130: Firebase Console → **Analytics → DebugView** _(section: Step 5 · Confirm analytics is actually recording 🔴)_
- Line 131: Confirm you see **`session_start`** with properties `dayIndex`, _(section: Step 5 · Confirm analytics is actually recording 🔴)_
- Line 133: Confirm you see **`retention_day`** on the first launch _(section: Step 5 · Confirm analytics is actually recording 🔴)_
- Line 134: Advance a week and confirm **`week_advanced`** _(section: Step 5 · Confirm analytics is actually recording 🔴)_
- Line 135: Open the Offer Center and confirm **`offer_center_opened`** and _(section: Step 5 · Confirm analytics is actually recording 🔴)_
- Line 156: Decide which week to run. Offers rotate **Monday 00:00 UTC**; the Offer _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 158: App Store Connect → your app → **Monetization → In-App Purchases** _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 159: Open the SKU for that week _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 160: Next to **Price Schedule** → **+** → **Temporary Price Change** → Next _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 161: **Start date** = that Monday · **End date** = the following Monday _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 162: Pick the reduced price and the countries _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 163: Save (allow up to 24h to propagate) _(section: Step 6 · Schedule the first offer price change 💰)_
- Line 183: Bump the **store version record**: `storeVersion` in _(section: Step 7 · Release to the App Store)_
- Line 185: Write the "What's New" copy in the same file _(section: Step 7 · Release to the App Store)_
- Line 186: GitHub → Actions → **App Store Connect — release** to apply it _(section: Step 7 · Release to the App Store)_
### marketing/DELIVERABLES_INDEX.md

- Line 170: Read `QUICK_REFERENCE.md` _(section: Immediate (This Session))_
- Line 171: Review `IMPLEMENTATION_SUMMARY.md` _(section: Immediate (This Session))_
- Line 172: Share files with team _(section: Immediate (This Session))_
- Line 173: Schedule integration session _(section: Immediate (This Session))_
- Line 176: Team review of design _(section: Before Integration)_
- Line 177: Verify project structure _(section: Before Integration)_
- Line 178: Set up testing environment _(section: Before Integration)_
- Line 179: Create feature branch _(section: Before Integration)_
- Line 182: Install `expo-store-review` package _(section: During Integration (Follow `INTEGRATION_POINTS.md`))_
- Line 183: Add rating prompt to 4 locations _(section: During Integration (Follow `INTEGRATION_POINTS.md`))_
- Line 184: Add share card to 2-3 screens _(section: During Integration (Follow `INTEGRATION_POINTS.md`))_
- Line 185: Run type check and lint _(section: During Integration (Follow `INTEGRATION_POINTS.md`))_
- Line 188: Run full test suite _(section: After Integration)_
- Line 189: Code review (check `IMPLEMENTATION_SUMMARY.md`) _(section: After Integration)_
- Line 190: QA testing (follow `PRE_INTEGRATION_CHECKLIST.md`) _(section: After Integration)_
- Line 191: Beta testing on TestFlight/Play Store _(section: After Integration)_
- Line 194: Verify on physical devices _(section: Before Release)_
- Line 195: Get product approval _(section: Before Release)_
- Line 196: Update release notes _(section: Before Release)_
- Line 197: Deploy to production _(section: Before Release)_
- Line 222: `utils/ratingPrompt.ts` ✓ (4.8 KB) _(section: Verification Checklist)_
- Line 223: `components/ShareLifeCard.tsx` ✓ (12 KB) _(section: Verification Checklist)_
- Line 224: `marketing/INTEGRATION.md` ✓ (15 KB) _(section: Verification Checklist)_
- Line 227: `QUICK_REFERENCE.md` ✓ (4.8 KB) _(section: Verification Checklist)_
- Line 228: `IMPLEMENTATION_SUMMARY.md` ✓ (12 KB) _(section: Verification Checklist)_
- Line 229: `INTEGRATION_POINTS.md` ✓ (8.3 KB) _(section: Verification Checklist)_
- Line 230: `PRE_INTEGRATION_CHECKLIST.md` ✓ (12 KB) _(section: Verification Checklist)_
- Line 231: `DELIVERABLES_INDEX.md` ✓ (this file) _(section: Verification Checklist)_
- Line 234: All imports/exports valid _(section: Verification Checklist)_
- Line 235: No syntax errors _(section: Verification Checklist)_
- Line 236: All code follows project conventions _(section: Verification Checklist)_
- Line 237: Comprehensive documentation _(section: Verification Checklist)_
- Line 238: Clear integration path _(section: Verification Checklist)_
- Line 239: Complete testing guide _(section: Verification Checklist)_
### marketing/INTEGRATION.md

- Line 332: Player with <20 weeks lived doesn't see prompt (wait until week 21+) _(section: Rating Prompt Testing)_
- Line 333: Player sees prompt after a promotion _(section: Rating Prompt Testing)_
- Line 334: Player sees prompt after planning a wedding _(section: Rating Prompt Testing)_
- Line 335: After first prompt, cooldown prevents second prompt within 60 weeks _(section: Rating Prompt Testing)_
- Line 336: After 60 weeks, next positive event triggers prompt again _(section: Rating Prompt Testing)_
- Line 337: `resetRatingPromptCooldown()` allows immediate re-testing _(section: Rating Prompt Testing)_
- Line 338: App doesn't crash if expo-store-review is missing _(section: Rating Prompt Testing)_
- Line 339: AsyncStorage properly tracks last prompt week _(section: Rating Prompt Testing)_
- Line 343: Card displays correctly on light and dark mode _(section: Share Card Testing)_
- Line 344: All fields populate correctly (name, age, career, salary, net worth) _(section: Share Card Testing)_
- Line 345: Spouse name shows only if married _(section: Share Card Testing)_
- Line 346: Children count shows only if has kids _(section: Share Card Testing)_
- Line 347: Generation level always displays _(section: Share Card Testing)_
- Line 348: Tagline changes appropriately for different player situations _(section: Share Card Testing)_
- Line 349: Share button opens native share sheet _(section: Share Card Testing)_
- Line 350: Copy button copies text to clipboard _(section: Share Card Testing)_
- Line 351: Copy button shows "Copied" confirmation for 2 seconds _(section: Share Card Testing)_
- Line 352: Card closes when onClose is called _(section: Share Card Testing)_
- Line 353: Close button (×) works properly _(section: Share Card Testing)_
- Line 354: Loading state shows during share operation _(section: Share Card Testing)_
- Line 355: Card scales responsively on different device sizes _(section: Share Card Testing)_
- Line 356: Glassmorphic styling is visible with proper transparency _(section: Share Card Testing)_
### marketing/INTEGRATION_POINTS.md

- Line 293: Added imports to all modified files _(section: Before Committing)_
- Line 294: Added one call per integration point (4 total) _(section: Before Committing)_
- Line 295: Used correct logger pattern for each file _(section: Before Committing)_
- Line 296: Used `.catch()` error handling _(section: Before Committing)_
- Line 297: Code formatting matches existing style _(section: Before Committing)_
- Line 298: No breaking changes to function signatures _(section: Before Committing)_
- Line 299: All tests pass: `npm test` _(section: Before Committing)_
- Line 300: Type check passes: `npm run type-check` _(section: Before Committing)_
- Line 301: Code compiles: `npm run preflight:quick` _(section: Before Committing)_
### marketing/PRE_INTEGRATION_CHECKLIST.md

- Line 10: `utils/ratingPrompt.ts` exists (4.8 KB) _(section: Core Implementation Files)_
- Line 15: `components/ShareLifeCard.tsx` exists (12 KB) _(section: Core Implementation Files)_
- Line 21: `marketing/INTEGRATION.md` exists (15 KB) _(section: Documentation Files)_
- Line 22: `IMPLEMENTATION_SUMMARY.md` exists (12 KB) _(section: Documentation Files)_
- Line 23: `QUICK_REFERENCE.md` exists (4.8 KB) _(section: Documentation Files)_
- Line 24: `INTEGRATION_POINTS.md` exists (8.3 KB) _(section: Documentation Files)_
- Line 37: Command completed without errors _(section: In project root)_
- Line 38: `package.json` has `expo-store-review` in dependencies _(section: In project root)_
- Line 39: No new warnings in `expo doctor` _(section: In project root)_
- Line 50: `/utils/` directory exists and is writable _(section: Task 2: Verify Project Structure)_
- Line 51: `/components/` directory exists and is writable _(section: Task 2: Verify Project Structure)_
- Line 52: `/contexts/game/actions/` directory exists _(section: Task 2: Verify Project Structure)_
- Line 53: `/marketing/` directory exists and is writable _(section: Task 2: Verify Project Structure)_
- Line 90: Open file in editor _(section: Step 1: Add Rating Prompt to JobActions)_
- Line 91: Find `promoteCareer()` function (around line 618) _(section: Step 1: Add Rating Prompt to JobActions)_
- Line 92: Locate the `setGameState` call (lines 653-668) _(section: Step 1: Add Rating Prompt to JobActions)_
- Line 93: After line 670, add the import and call _(section: Step 1: Add Rating Prompt to JobActions)_
- Line 94: Follow exact format from `INTEGRATION_POINTS.md` _(section: Step 1: Add Rating Prompt to JobActions)_
- Line 109: Open file in editor _(section: Step 2: Add Rating Prompt to DatingActions)_
- Line 110: Find `planWedding()` function (around line 368) _(section: Step 2: Add Rating Prompt to DatingActions)_
- Line 111: Locate the success return statement (lines 420-426) _(section: Step 2: Add Rating Prompt to DatingActions)_
- Line 112: After line 420, add the import and call _(section: Step 2: Add Rating Prompt to DatingActions)_
- Line 113: Follow exact format from `INTEGRATION_POINTS.md` _(section: Step 2: Add Rating Prompt to DatingActions)_
- Line 121: Open file in editor _(section: Step 3: Add Rating Prompt to GameActionsContext)_
- Line 122: Find `executePrestigeAction()` useCallback (around line 3738) _(section: Step 3: Add Rating Prompt to GameActionsContext)_
- Line 123: Locate the `setGameState(newGameState)` call (line 3750) _(section: Step 3: Add Rating Prompt to GameActionsContext)_
- Line 124: After that line, add the import and call _(section: Step 3: Add Rating Prompt to GameActionsContext)_
- Line 125: Follow exact format from `INTEGRATION_POINTS.md` _(section: Step 3: Add Rating Prompt to GameActionsContext)_
- Line 133: Search for where `realEstate` array is updated _(section: Step 4: (Optional) Add Rating Prompt to Real Estate)_
- Line 134: Look for: `[...prev.realEstate, newProperty]` _(section: Step 4: (Optional) Add Rating Prompt to Real Estate)_
- Line 135: Add call only if `isFirstProperty` (see INTEGRATION_POINTS.md) _(section: Step 4: (Optional) Add Rating Prompt to Real Estate)_
- Line 136: This is optional if feature doesn't exist yet _(section: Step 4: (Optional) Add Rating Prompt to Real Estate)_
- Line 142: Open home/dashboard screen _(section: Step 5: Add Share Card to Home Screen)_
- Line 143: Add state: `const [showShare, setShowShare] = useState(false);` _(section: Step 5: Add Share Card to Home Screen)_
- Line 144: Import: `import ShareLifeCard from '@/components/ShareLifeCard';` _(section: Step 5: Add Share Card to Home Screen)_
- Line 145: Add button: `<Button onPress={() => setShowShare(true)}>Share Life</Button>` _(section: Step 5: Add Share Card to Home Screen)_
- Line 146: Add component: _(section: Step 5: Add Share Card to Home Screen)_
- Line 160: Repeat Step 5 pattern in profile screen _(section: Step 6: (Optional) Add Share Card to Profile Screen)_
- Line 161: Consider adding to user profile editing area _(section: Step 6: (Optional) Add Share Card to Profile Screen)_
- Line 167: Find where weekly summary is displayed _(section: Step 7: (Optional) Add Share Card to Weekly Summary)_
- Line 168: Add Share button and component (same pattern as Step 5) _(section: Step 7: (Optional) Add Share Card to Weekly Summary)_
- Line 169: This makes sharing feel like celebrating achievement _(section: Step 7: (Optional) Add Share Card to Weekly Summary)_
- Line 181: No syntax errors in new files _(section: This might show module resolution errors (OK), but no syntax errors)_
- Line 182: No missing imports _(section: This might show module resolution errors (OK), but no syntax errors)_
- Line 183: No `any` types added _(section: This might show module resolution errors (OK), but no syntax errors)_
- Line 191: All files pass linting _(section: Check code style)_
- Line 192: No warnings about unused imports _(section: Check code style)_
- Line 200: Command completes without errors _(section: Quick type check only)_
- Line 201: No TypeScript errors introduced _(section: Quick type check only)_
- Line 217: Verify `weeksLived >= 20` _(section: Test 1: Rating Prompt - Minimum Weeks)_
- Line 218: If not, advance game to week 20+ _(section: Test 1: Rating Prompt - Minimum Weeks)_
- Line 232: Career promotion succeeds _(section: Test 2: Rating Prompt - Trigger After Promotion)_
- Line 233: No console errors _(section: Test 2: Rating Prompt - Trigger After Promotion)_
- Line 234: Rating prompt appears (if week >= 20 and >= 60 weeks since last) _(section: Test 2: Rating Prompt - Trigger After Promotion)_
- Line 250: First prompt shows _(section: Test 3: Rating Prompt - Cooldown Prevention)_
- Line 251: Second prompt blocked (in cooldown) _(section: Test 3: Rating Prompt - Cooldown Prevention)_
- Line 252: Third prompt shows (after cooldown expires) _(section: Test 3: Rating Prompt - Cooldown Prevention)_
- Line 269: Card renders in modal overlay _(section: Test 4: Share Card - Renders Correctly)_
- Line 270: All text visible and readable _(section: Test 4: Share Card - Renders Correctly)_
- Line 271: Colors appropriate for theme _(section: Test 4: Share Card - Renders Correctly)_
- Line 290: Share sheet opens _(section: Test 5: Share Card - Share Button)_
- Line 291: All text is formatted correctly _(section: Test 5: Share Card - Share Button)_
- Line 292: Can successfully share _(section: Test 5: Share Card - Share Button)_
- Line 306: Copy button shows confirmation _(section: Test 6: Share Card - Copy Button)_
- Line 307: Text actually gets copied to clipboard _(section: Test 6: Share Card - Copy Button)_
- Line 308: Confirmation shows for 2 seconds _(section: Test 6: Share Card - Copy Button)_
- Line 322: Card adapts to screen size _(section: Test 7: Share Card - Responsive Design)_
- Line 323: Text remains readable _(section: Test 7: Share Card - Responsive Design)_
- Line 324: Buttons remain tappable _(section: Test 7: Share Card - Responsive Design)_
- Line 325: No text overflow _(section: Test 7: Share Card - Responsive Design)_
- Line 336: No errors (or only existing errors) _(section: Full Type Check)_
- Line 337: New files don't introduce type issues _(section: Full Type Check)_
- Line 344: No errors on new files _(section: Full Lint Check)_
- Line 345: Style matches project conventions _(section: Full Lint Check)_
- Line 352: Type check passes _(section: Preflight Check)_
- Line 353: Lint passes _(section: Preflight Check)_
- Line 354: Tests pass (if any new ones added) _(section: Preflight Check)_
- Line 365: Both platforms build without errors _(section: Android)_
- Line 366: App launches successfully _(section: Android)_
- Line 367: Features work on both platforms _(section: Android)_
- Line 375: All 4 integration points complete _(section: Deployment Checklist)_
- Line 376: Share card added to 2-3 screens _(section: Deployment Checklist)_
- Line 377: All tests passing _(section: Deployment Checklist)_
- Line 378: No console errors _(section: Deployment Checklist)_
- Line 379: Both platforms tested _(section: Deployment Checklist)_
- Line 380: Dark and light modes tested _(section: Deployment Checklist)_
- Line 381: No breaking changes _(section: Deployment Checklist)_
- Line 385: Product review of features _(section: Deployment Checklist)_
- Line 386: Analytics setup (if needed) _(section: Deployment Checklist)_
- Line 387: User documentation updated (if needed) _(section: Deployment Checklist)_
- Line 388: Release notes include new features _(section: Deployment Checklist)_
- Line 389: Beta tested on TestFlight/Google Play _(section: Deployment Checklist)_
- Line 390: Customer support briefed _(section: Deployment Checklist)_
- Line 397: Verify file exists: `ls utils/ratingPrompt.ts` _(section: "Cannot find module '@/utils/ratingPrompt'")_
- Line 398: Check TypeScript path aliases in `tsconfig.json` _(section: "Cannot find module '@/utils/ratingPrompt'")_
- Line 399: Restart TypeScript server in IDE _(section: "Cannot find module '@/utils/ratingPrompt'")_
- Line 402: Verify file exists: `ls components/ShareLifeCard.tsx` _(section: "ShareLifeCard component not found")_
- Line 403: Check import path matches exactly _(section: "ShareLifeCard component not found")_
- Line 404: Verify no typos in component name _(section: "ShareLifeCard component not found")_
- Line 407: Run: `expo add expo-store-review` _(section: "expo-store-review not found")_
- Line 408: Check: `npm ls expo-store-review` _(section: "expo-store-review not found")_
- Line 409: Verify in `package.json` _(section: "expo-store-review not found")_
- Line 412: Check console for errors _(section: "Rating prompt crashes the app")_
- Line 413: Verify try/catch is present _(section: "Rating prompt crashes the app")_
- Line 414: Check that module is installed _(section: "Rating prompt crashes the app")_
- Line 415: Review error handling in INTEGRATION.md _(section: "Rating prompt crashes the app")_
- Line 418: Check for console errors _(section: "Share button doesn't work")_
- Line 419: Verify `Share.share()` API is available _(section: "Share button doesn't work")_
- Line 420: Test on physical device (simulator may not work) _(section: "Share button doesn't work")_
- Line 421: Check that gameState is being passed correctly _(section: "Share button doesn't work")_
- Line 429: ✓ Rating prompt installs and builds without errors _(section: Success Criteria)_
- Line 430: ✓ Share card renders and works on all devices _(section: Success Criteria)_
- Line 431: ✓ Promotion triggers review prompt (positive moment) _(section: Success Criteria)_
- Line 432: ✓ Wedding triggers review prompt (positive moment) _(section: Success Criteria)_
- Line 433: ✓ Prestige triggers review prompt (positive moment) _(section: Success Criteria)_
- Line 434: ✓ Rating prompt respects 60-week cooldown _(section: Success Criteria)_
- Line 435: ✓ Share button opens native share sheet _(section: Success Criteria)_
- Line 436: ✓ Copy button copies text to clipboard _(section: Success Criteria)_
- Line 437: ✓ Card displays correct player information _(section: Success Criteria)_
- Line 438: ✓ Tagline changes based on player status _(section: Success Criteria)_
- Line 439: ✓ Both dark and light modes work _(section: Success Criteria)_
- Line 440: ✓ All responsive sizes work _(section: Success Criteria)_
- Line 441: ✓ No console errors or warnings _(section: Success Criteria)_
- Line 442: ✓ Type check passes _(section: Success Criteria)_
- Line 443: ✓ Lint passes _(section: Success Criteria)_
- Line 444: ✓ Builds on iOS and Android _(section: Success Criteria)_
### marketing/QUICK_REFERENCE.md

- Line 146: Run `expo add expo-store-review` _(section: Before Release)_
- Line 147: Add plugin to `app.config.js` _(section: Before Release)_
- Line 148: Integrate rating prompt in 4 action functions _(section: Before Release)_
- Line 149: Add share card to 2-3 screens _(section: Before Release)_
- Line 150: Run `npm run preflight` _(section: Before Release)_
- Line 151: Test on iOS simulator _(section: Before Release)_
- Line 152: Test on Android simulator _(section: Before Release)_
- Line 153: Test light and dark modes _(section: Before Release)_
- Line 154: Verify on physical devices _(section: Before Release)_
### marketing/app_store_listing.md

- Line 369: Title contains "Life Simulator" (primary keyword) _(section: 12. Conversion Optimization Checklist)_
- Line 370: Subtitle addresses pain point (Building wealth, making choices) _(section: 12. Conversion Optimization Checklist)_
- Line 371: First 3 keywords match searchers' intent _(section: 12. Conversion Optimization Checklist)_
- Line 372: Description opens with differentiator (real economics) _(section: 12. Conversion Optimization Checklist)_
- Line 373: Screenshots have bold headlines _(section: 12. Conversion Optimization Checklist)_
- Line 374: "What's New" mentions user feedback ("We listened...") _(section: 12. Conversion Optimization Checklist)_
- Line 375: Rating prompt configured to trigger at right moments _(section: 12. Conversion Optimization Checklist)_
- Line 376: Discord/community link visible in description _(section: 12. Conversion Optimization Checklist)_
- Line 377: No forced ads language (emphasize optional removal) _(section: 12. Conversion Optimization Checklist)_
- Line 378: Call-to-action clear: "Download now" _(section: 12. Conversion Optimization Checklist)_
- Line 379: Economy framing as a feature, not a limitation _(section: 12. Conversion Optimization Checklist)_
- Line 398: Verify all text fits character limits (use tool, not manual count) _(section: Before Submission:)_
- Line 399: Test rating prompt on multiple devices _(section: Before Submission:)_
- Line 400: Verify IAP perks all work correctly _(section: Before Submission:)_
- Line 401: Check screenshots render correctly on all phone sizes _(section: Before Submission:)_
- Line 402: Ensure video preview auto-plays (test on App Store Connect preview) _(section: Before Submission:)_
- Line 403: Verify Discord invite link is current _(section: Before Submission:)_
- Line 404: Test cloud save on new device _(section: Before Submission:)_
- Line 405: Check all links in description (if any) _(section: Before Submission:)_
### marketing/apple-ads/01-SETUP.md

- Line 246: Apple Ads **Advanced** account, time zone + currency set deliberately _(section: Part 5 — Launch checklist)_
- Line 247: Go/no-go gate in [`README.md`](README.md) cleared (rating, app name, attribution, screenshots) _(section: Part 5 — Launch checklist)_
- Line 249: `Purchases.enableAdServicesAttributionTokenCollection()` live in a **released App Store build** (code shipped; TestFlight/sandbox results are non-production and do not prove it) _(section: Part 5 — Launch checklist)_
- Line 250: 4 campaigns created, Search Results placement, US only _(section: Part 5 — Launch checklist)_
- Line 251: 8 Category ad groups + 3 Competitor ad groups created with the bids above _(section: Part 5 — Launch checklist)_
- Line 252: Keywords imported from `keywords/*.csv`, all Exact, Search Match **off** _(section: Part 5 — Launch checklist)_
- Line 253: Discovery created with broad + Search Match **on**, max CPT below exact _(section: Part 5 — Launch checklist)_
- Line 254: All three negative lists applied at the right level, all Exact _(section: Part 5 — Launch checklist)_
- Line 255: 6 CPPs published in App Store Connect and attached as ad variations _(section: Part 5 — Launch checklist)_
- Line 256: Budgets: $3 / $12 / $6 / $9 = **$30/day** _(section: Part 5 — Launch checklist)_
- Line 257: Calendar reminder: no structural changes for **14 days** (Part 6) _(section: Part 5 — Launch checklist)_
### marketing/apple-ads/08-first-results-2026-08.md

- Line 90: **Page conversion ≥ 55%** — driven by the app preview video _(section: The gate — do not unpause yet)_
- Line 93: **D1 retention ≥ 30%** — the v2.7.0 Story Mode release is the change that _(section: The gate — do not unpause yet)_
### marketing/apple-ads/PASTE-BLOCKS.md

- Line 384: Match type is **Exact** everywhere except the Discovery seeds (Broad) _(section: Final check before you enable anything)_
- Line 385: **Search Match OFF** on Brand, Category, Competitor · **ON** on Discovery _(section: Final check before you enable anything)_
- Line 386: Every negative keyword is **Exact** _(section: Final check before you enable anything)_
- Line 387: Brand has **no** negative keywords _(section: Final check before you enable anything)_
- Line 388: Global negatives applied at **campaign** level on the three campaigns _(section: Final check before you enable anything)_
- Line 389: Crosslocks applied at **ad group** level, not campaign level _(section: Final check before you enable anything)_
- Line 390: Daily budgets: Brand $3 · Category $12 · Competitor $6 · Discovery $9 _(section: Final check before you enable anything)_
- Line 391: Countries = **United States** only _(section: Final check before you enable anything)_
- Line 392: Placement = **Search results** only _(section: Final check before you enable anything)_
- Line 393: No audience refinements set _(section: Final check before you enable anything)_
### marketing/content-calendar.md

- Line 14: **TikTok Account** _(section: BEFORE YOU START — Setup Checklist)_
- Line 21: **Reddit Accounts** _(section: BEFORE YOU START — Setup Checklist)_
- Line 27: **Discord Server** _(section: BEFORE YOU START — Setup Checklist)_
- Line 34: **YouTube Channel** _(section: BEFORE YOU START — Setup Checklist)_
- Line 41: **App Store Optimization** _(section: BEFORE YOU START — Setup Checklist)_
- Line 47: **Content Bank Prepared** _(section: BEFORE YOU START — Setup Checklist)_
- Line 52: **Analytics Setup** _(section: BEFORE YOU START — Setup Checklist)_
- Line 58: **Mobile Recording Setup** _(section: BEFORE YOU START — Setup Checklist)_
- Line 93: App Store listing updated _(section: Day 1: App Store Optimization & First Screenshot)_
- Line 94: Google Play listing updated _(section: Day 1: App Store Optimization & First Screenshot)_
- Line 95: Screenshot uploaded and visible _(section: Day 1: App Store Optimization & First Screenshot)_
- Line 118: 2 screenshots uploaded _(section: Day 2: App Store Screenshots Part 1)_
- Line 119: Both visible in store listings _(section: Day 2: App Store Screenshots Part 1)_
- Line 120: Captions match feature list _(section: Day 2: App Store Screenshots Part 1)_
- Line 142: 4 total screenshots now live _(section: Day 3: App Store Screenshots Part 2 + Relationship System)_
- Line 143: All captions written _(section: Day 3: App Store Screenshots Part 2 + Relationship System)_
- Line 144: Rotation visible in preview _(section: Day 3: App Store Screenshots Part 2 + Relationship System)_
- Line 164: 5 total screenshots live _(section: Day 4: App Store Screenshots Part 3 + Prestige System)_
- Line 165: App Store listing complete _(section: Day 4: App Store Screenshots Part 3 + Prestige System)_
- Line 166: Google Play listing complete _(section: Day 4: App Store Screenshots Part 3 + Prestige System)_
- Line 187: 2+ developer responses posted _(section: Day 5: First Review Response Day)_
- Line 188: Screenshot saved to folder _(section: Day 5: First Review Response Day)_
- Line 189: Note in tracker: "Week 1 day 5: First reviews responded to" _(section: Day 5: First Review Response Day)_
- Line 210: Gameplay tested _(section: Day 6: Bug Investigation + Hotfix Prep)_
- Line 211: Crash logs reviewed _(section: Day 6: Bug Investigation + Hotfix Prep)_
- Line 212: Bug list prepared (even if empty) _(section: Day 6: Bug Investigation + Hotfix Prep)_
- Line 230: Script 1: "I Tried to Become a Billionaire" — Filming time: 20 min _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 231: Script 2: "Every Bad Decision" — Filming time: 25 min _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 232: Script 3: [Choose from tiktok_scripts.md] — Filming time: __ min _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 233: Script 4: [Choose from tiktok_scripts.md] — Filming time: __ min _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 234: Script 5: [Choose from tiktok_scripts.md] — Filming time: __ min _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 238: 5 scripts selected _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 239: Audio tracks downloaded _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 240: Filming checklist created _(section: Day 7: Content Prep for Week 2 (TikTok Scripts Review))_
- Line 283: TikTok video published + pinned _(section: Day 8: TikTok Video #1 + Discord Launch)_
- Line 284: Discord announcements posted _(section: Day 8: TikTok Video #1 + Discord Launch)_
- Line 285: 5+ members invited to Discord _(section: Day 8: TikTok Video #1 + Discord Launch)_
- Line 308: Video 2 published _(section: Day 9: TikTok Video #2)_
- Line 309: Different audio than Video 1 _(section: Day 9: TikTok Video #2)_
- Line 310: Caption written _(section: Day 9: TikTok Video #2)_
- Line 332: 2+ tips posted _(section: Day 10: Discord Community Building + Engagement)_
- Line 333: Engagement question asked _(section: Day 10: Discord Community Building + Engagement)_
- Line 334: At least 1 community response to your question _(section: Day 10: Discord Community Building + Engagement)_
- Line 364: TikTok video 3 published _(section: Day 11: TikTok Video #3 + Reddit Preparation)_
- Line 365: Reddit post drafted (not submitted yet) _(section: Day 11: TikTok Video #3 + Reddit Preparation)_
- Line 366: Familiar with r/iosgaming rules _(section: Day 11: TikTok Video #3 + Reddit Preparation)_
- Line 391: Video 4 published _(section: Day 12: TikTok Video #4 + Analytics Check)_
- Line 392: Analytics reviewed and noted _(section: Day 12: TikTok Video #4 + Analytics Check)_
- Line 416: Reddit post published to r/iosgaming _(section: Day 13: Reddit Post #1 (Major Update Announcement))_
- Line 417: First comment added _(section: Day 13: Reddit Post #1 (Major Update Announcement))_
- Line 418: Screenshot saved (for motivation) _(section: Day 13: Reddit Post #1 (Major Update Announcement))_
- Line 448: Post 2: "r/incremental_games — Prestige Focus" (Day 15) _(section: Day 14: Week 2 Wrap-Up + Week 3 Planning)_
- Line 449: Post 3: "r/IndieGaming — Solo Dev Story" (Day 19) _(section: Day 14: Week 2 Wrap-Up + Week 3 Planning)_
- Line 450: Post 4: "r/Android — Google Play Launch" (Day 21) _(section: Day 14: Week 2 Wrap-Up + Week 3 Planning)_
- Line 453: 2-3 more TikTok videos (Days 16, 18, 20) _(section: Day 14: Week 2 Wrap-Up + Week 3 Planning)_
- Line 454: Script ideas: romance playthrough, fastest money path, worst ending _(section: Day 14: Week 2 Wrap-Up + Week 3 Planning)_
- Line 490: Post published to r/incremental_games _(section: Day 15: Reddit Post #2 (r/incremental_games))_
- Line 491: First comment added _(section: Day 15: Reddit Post #2 (r/incremental_games))_
- Line 511: Video 5 published _(section: Day 16: TikTok Video #5)_
- Line 534: Community post published _(section: Day 17: YouTube Community Post (No Video Required))_
- Line 559: Video 6 published _(section: Day 18: TikTok Video #6 OR Different Platform Experiment)_
- Line 586: Post published to r/IndieGaming _(section: Day 19: Reddit Post #3 (r/IndieGaming — Solo Dev Story))_
- Line 587: Authentic, personal tone (not sales-y) _(section: Day 19: Reddit Post #3 (r/IndieGaming — Solo Dev Story))_
- Line 618: 3 influencers identified _(section: Day 20: Influencer Outreach #1 (Email Prep))_
- Line 619: Tracking sheet created _(section: Day 20: Influencer Outreach #1 (Email Prep))_
- Line 620: Email drafted (not sent yet) _(section: Day 20: Influencer Outreach #1 (Email Prep))_
- Line 641: Post published _(section: Day 21: Reddit Post #4 (r/Android OR r/Games))_
- Line 642: Link provided _(section: Day 21: Reddit Post #4 (r/Android OR r/Games))_
- Line 643: Rules followed (no low-effort posts) _(section: Day 21: Reddit Post #4 (r/Android OR r/Games))_
- Line 668: 3 influencer emails sent _(section: Day 22: Influencer Outreach #2 (First 3 Emails Sent))_
- Line 669: Tracking sheet updated _(section: Day 22: Influencer Outreach #2 (First 3 Emails Sent))_
- Line 670: Follow-up reminders set _(section: Day 22: Influencer Outreach #2 (First 3 Emails Sent))_
- Line 704: Analytics compiled _(section: Day 23: Week 3 Analytics + Discord Milestone)_
- Line 705: Discord celebration posted _(section: Day 23: Week 3 Analytics + Discord Milestone)_
- Line 706: Lessons noted (what worked this week?) _(section: Day 23: Week 3 Analytics + Discord Milestone)_
- Line 748: 10-minute gameplay video recorded and edited _(section: Day 24: YouTube Video #1 — Gameplay Walkthrough (Part 1))_
- Line 749: Voiceover added _(section: Day 24: YouTube Video #1 — Gameplay Walkthrough (Part 1))_
- Line 750: Saved as unlisted draft _(section: Day 24: YouTube Video #1 — Gameplay Walkthrough (Part 1))_
- Line 798: Video published _(section: Day 25: YouTube Video #1 — Publish + Description Optimization)_
- Line 799: Description filled out _(section: Day 25: YouTube Video #1 — Publish + Description Optimization)_
- Line 800: Thumbnail created _(section: Day 25: YouTube Video #1 — Publish + Description Optimization)_
- Line 801: Link shared in Discord _(section: Day 25: YouTube Video #1 — Publish + Description Optimization)_
- Line 841: Challenge announced _(section: Day 26: First In-Game Challenge Event — Discord Announcement)_
- Line 842: Rules clear and achievable _(section: Day 26: First In-Game Challenge Event — Discord Announcement)_
- Line 843: First response/interest from community _(section: Day 26: First In-Game Challenge Event — Discord Announcement)_
- Line 868: Video 7 published _(section: Day 27: TikTok Video #7 + Cross-Promotion)_
- Line 869: Cross-promotion done _(section: Day 27: TikTok Video #7 + Cross-Promotion)_
- Line 901: Post published _(section: Day 28: Reddit Post #5 + Challenge Announcement)_
- Line 902: Challenge cross-promoted _(section: Day 28: Reddit Post #5 + Challenge Announcement)_
- Line 940: Metrics compiled in sheet _(section: Day 29: Analytics Deep Dive + Metrics Review)_
- Line 941: Analysis written _(section: Day 29: Analytics Deep Dive + Metrics Review)_
- Line 942: Results documented _(section: Day 29: Analytics Deep Dive + Metrics Review)_
- Line 966: New in-game feature (e.g., "New career path" or "New event type") _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 967: YouTube video series: 1 video per week (plan 4 videos) _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 968: TikTok: Increase to 5-7 videos per week _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 969: Reddit: Maintain 1-2 posts per week _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 970: Discord: Launch 2 new community challenges _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 971: Influencer follow-ups: Send 3 more outreach emails to new creators _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 978: Community thank-you posted _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 979: Challenge winner announced _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 980: Month 2 plan drafted _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 981: Files saved _(section: Day 30: Month 1 Wrap-Up + Planning Month 2)_
- Line 1253: All accounts created (TikTok, Reddit, Discord, YouTube, App Store updated) _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1254: This calendar downloaded/printed _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1255: `tiktok_scripts.md`, `reddit_and_outreach.md`, `app_store_listing.md` in easy-to-access tabs _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1256: Google Sheet created for tracking metrics _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1257: Phone has screen recording app installed _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1258: Sample gameplay video recorded (for testing edits) _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1259: 5+ trending audio tracks downloaded _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1260: App Store description updated _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1261: 5+ app screenshots ready to upload _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1262: Discord server created with 3+ channels _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1263: Email ready for influencer outreach (template drafted) _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1264: Calendar shared with you (print or phone reminder for daily tasks) _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
- Line 1265: Backup plan for each platform (if posting fails, you know what to do next) _(section: FINAL CHECKLIST — BEFORE STARTING DAY 1)_
### marketing/reddit_and_outreach.md

- Line 685: Create Discord server and post welcome + 5 announcements _(section: Before Launching Outreach:)_
- Line 686: Prepare 10-20 promo codes (reserve some for influencers) _(section: Before Launching Outreach:)_
- Line 687: Create press kit (if not done): screenshots, feature list, 2-3 short clips — lead with the economy/BitLife-comparison angle _(section: Before Launching Outreach:)_
- Line 688: List 20 small creators (1K-10K subs) in your niche (economy/tycoon/life-sim content) _(section: Before Launching Outreach:)_
- Line 689: List 10 mid-size creators (10K-50K subs) — prioritize based on content relevance _(section: Before Launching Outreach:)_
- Line 690: Set up email signature with App Store / Google Play links _(section: Before Launching Outreach:)_
- Line 691: Schedule Reddit posts (1 per week, rotate subreddits) _(section: Before Launching Outreach:)_
- Line 692: Prepare short TikTok/YouTube Shorts clips that show the economy hook explicitly (a market crash, a bankruptcy, a prestige reincarnation) — generic gameplay clips underperform _(section: Before Launching Outreach:)_
### tasks/execution-plan-2026-06-19.md

- Line 84: Remaining call sites (optional, lower value): onboarding steps, first _(section: 0.1 Analytics & Telemetry Foundation `S→M` 🔁💰 **(build this first)**)_
- Line 86: Set up the receiving endpoint + dashboard / saved queries for D1/D7/D30 _(section: 0.1 Analytics & Telemetry Foundation `S→M` 🔁💰 **(build this first)**)_
- Line 103: Stand up **IAP verification backend** (RevenueCat recommended for speed) and _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 105: Server-side receipt validation for both App Store & Play. _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 106: End-to-end sandbox purchase test for each product family (gems, bundles, perks, subscription placeholder). _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 109: Replace Google **test** AdMob unit IDs with production IDs (env/EAS secret). _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 110: Implement **Android UMP/GDPR consent** before any personalized ad request. _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 113: Generate the **HMAC key once**, store as EAS secret (non-rotatable — get it right). _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 114: **Purge the leaked Play service-account key** from git history (BFG/filter-repo) and rotate the key. _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 115: Update **privacy policy** to match actual ad/data behavior (currently says ads disabled). _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 116: Make the **preflight CI gate blocking**, not a warning. _(section: 0.2 Launch Blockers (revenue + security) `S→M` 💰)_
- Line 131: Add `dailyLogin: { lastClaimWeekReal, currentDay, claimed: boolean }` to GameState (Save System Auditor review; bump `STATE_VERSION` to 20 with a migration in `saveValidation.ts`). _(section: 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**)_
- Line 132: Use the **authoritative game-time clock** already used by daily challenges (immune to device-clock abuse), with the existing 48h grace. _(section: 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**)_
- Line 135: 7-day calendar modal (use `BaseModal`, theme tokens, `scale()`/`fontScale()`), highlight today, "Claim" CTA, claimed/locked states. _(section: 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**)_
- Line 136: Auto-present on first app open of a new day; reward animation + toast. _(section: 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**)_
- Line 139: Grant gems via existing gem-grant path; fire `daily_login_claimed` event. _(section: 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**)_
- Line 140: Reset to day 1 after a missed window (past grace); roll to day 1 after day 7. _(section: 0.3 Daily Login Rewards UI `S` 🔁 **(cheapest retention win)**)_
- Line 155: Front-load first-session gem grant so it lands on first open, not post-tutorial. _(section: 0.4 Day-1 Gem Curve Fix `S` 🔁)_
- Line 156: Fix the **FirstWeek guide reward** that is declared but never distributed (roadmap P2). _(section: 0.4 Day-1 Gem Curve Fix `S` 🔁)_
- Line 157: A/B the starting grant size once bucketing exists (0.4 ships a sensible default now; optimize in Wave 2). _(section: 0.4 Day-1 Gem Curve Fix `S` 🔁)_
- Line 170: Request notification permission at a non-intrusive moment (after first reward, not on launch). _(section: 0.5 Re-engagement Push Notifications `S→M` 🔁)_
- Line 171: Local-notification scheduler (Expo Notifications), all native calls lazy-loaded in try/catch. _(section: 0.5 Re-engagement Push Notifications `S→M` 🔁)_
- Line 174: (a) Daily challenge reset ("New challenges await"). _(section: 0.5 Re-engagement Push Notifications `S→M` 🔁)_
- Line 175: (b) Streak about to break ("Your N-day streak ends in 6 hours"). _(section: 0.5 Re-engagement Push Notifications `S→M` 🔁)_
- Line 176: (c) Passive income earned while away ("Your businesses earned $X"). _(section: 0.5 Re-engagement Push Notifications `S→M` 🔁)_
- Line 179: Cap frequency (≤1/day default), respect quiet hours, honor opt-out, deep-link into the relevant screen. _(section: 0.5 Re-engagement Push Notifications `S→M` 🔁)_
- Line 200: **1.1.1** Aggregate per-source earnings since last session (data already produced by `actions/weekly/applyIncome.ts`, `applyMiningCryptos.ts`, `applySavingsInterest.ts`, `applyAutoReinvest.ts`). _(section: 1.1 "While You Were Away" Summary `S` 🔁)_
- Line 201: **1.1.2** "Welcome back" modal with itemized gains + collect animation. _(section: 1.1 "While You Were Away" Summary `S` 🔁)_
- Line 202: **1.1.3** Fire analytics; deep-link from push trigger (c). _(section: 1.1 "While You Were Away" Summary `S` 🔁)_
- Line 212: **1.2.1** Surface the existing 48h grace as proactive copy ("Your 6-day streak is safe until tomorrow") — weaponize loss aversion. _(section: 1.2 Streak-Save Messaging + Toast Dedup `S` 🔁)_
- Line 213: **1.2.2** Implement toast pile-up dedup (roadmap P2) so reward moments aren't buried. _(section: 1.2 Streak-Save Messaging + Toast Dedup `S` 🔁)_
- Line 224: **1.3.1** Extend the daily-challenge engine (`utils/dailyChallenges.ts`) with a weekly tier using the same seeded, game-time clock. _(section: 1.3 Weekly Goals `M` 🔁)_
- Line 225: **1.3.2** 3 rotating weekly goals; rewards scale above daily (gems + a youth pill at top tier). _(section: 1.3 Weekly Goals `M` 🔁)_
- Line 226: **1.3.3** UI section in the challenges screen; analytics on completion. _(section: 1.3 Weekly Goals `M` 🔁)_
- Line 236: **1.4.1** Detect 7+ day absence via game-time clock. _(section: 1.4 Comeback Bonus `S` 🔁)_
- Line 237: **1.4.2** One-time "welcome back" grant (gems + youth pill) with its own modal; cooldown so it can't be farmed. _(section: 1.4 Comeback Bonus `S` 🔁)_
- Line 248: **1.5.1** Full-screen celebration component triggered on milestone cross. _(section: 1.5 Milestone Celebration Moments `S→M` 🔁)_
- Line 249: **1.5.2** "Share" hook (stub now; wires to Legacy Card in Wave 3). _(section: 1.5 Milestone Celebration Moments `S→M` 🔁)_
- Line 250: **1.5.3** Keep proximity nudges; add gem micro-rewards at major milestones. _(section: 1.5 Milestone Celebration Moments `S→M` 🔁)_
- Line 261: **1.6.1** Author achievement definitions per system: crime/dark web, crypto/mining, stocks, real estate, politics, parenting/family, education, pets, prestige/lineage, travel. _(section: 1.6 Achievement Expansion `M` 🔁)_
- Line 262: **1.6.2** Ensure each maps to an existing trackable stat (no new tracking where avoidable); gem rewards balanced against the economy soft-cap. _(section: 1.6 Achievement Expansion `M` 🔁)_
- Line 263: **1.6.3** Achievements screen with categories, progress bars, locked/unlocked. _(section: 1.6 Achievement Expansion `M` 🔁)_
- Line 284: Define a versioned content schema (`content/schema/*`) for events, seasonal scenarios, achievements, balance tweaks. Each entry carries `id`, `version`, `minAppVersion`, `weight`, `conditions` (NPC/stat/season gates). _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 285: Extract a first slice (weekly events from `actions/weekly/applyWeeklyEvents.ts`) into manifest form as the proof-of-concept; keep hardcoded fallback. _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 288: Manifest fetcher with **signature/checksum verification** (reuse the CRC32/HMAC discipline already used for saves). _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 289: **Cache last-good manifest**; if fetch fails or signature invalid → fall back to cached, then to bundled defaults. **Never break offline play.** _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 290: Respect `minAppVersion` so new content can't crash old clients (honors the "native config runs before JS" caution — content is JS-data only, no native). _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 293: Content resolver that merges remote + bundled, filters by conditions/season, and feeds the existing event/scenario engine. _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 294: Kill-switch flag per content entry (disable a broken event remotely). _(section: 2.1 Remote Content Pipeline `L` 🔁💰 **(prerequisite for everything below)**)_
- Line 307: **2.2.1** Stable hash of an anonymous install ID → bucket; deterministic, offline, no PII. _(section: 2.2 A/B Bucketing `M`)_
- Line 308: **2.2.2** Experiment config delivered via the content manifest (2.1); each experiment has variants + analytics tag. _(section: 2.2 A/B Bucketing `M`)_
- Line 309: **2.2.3** `useExperiment(key)` hook; all variant exposures logged to analytics (0.1). _(section: 2.2 A/B Bucketing `M`)_
- Line 321: Season state in GameState: `season: { id, startWeekReal, endWeekReal, progress, claimedTiers }` (Save System Auditor; `STATE_VERSION` bump + migration). _(section: 2.3 Season 1 — "Living Legacy" `L` 🔁💰)_
- Line 322: Season clock on the authoritative game-time/real-time hybrid; graceful end-of-season rollover. _(section: 2.3 Season 1 — "Living Legacy" `L` 🔁💰)_
- Line 325: Themed scenario arcs (reuse scenario/cliffhanger engine), seasonal job rotation (reuse `JobActions`), exclusive **heritable trait** as marquee reward (ties to prestige). _(section: 2.3 Season 1 — "Living Legacy" `L` 🔁💰)_
- Line 326: Seasonal cosmetics (apartment theme / vehicle skin / profile frame) — data only. _(section: 2.3 Season 1 — "Living Legacy" `L` 🔁💰)_
- Line 329: Season hub screen: theme banner, progress, time remaining, reward track preview. _(section: 2.3 Season 1 — "Living Legacy" `L` 🔁💰)_
- Line 412: **2.4.1** Pass state (`pass: { tier, xp, premiumOwned, claimed[] }`) + XP sources mapped to existing signals (daily/weekly challenges, milestones, prestige). Migration + auditor review. _(section: 2.4 The Legacy Pass (battle pass) `L` 💰🔁)_
- Line 413: **2.4.2** Reward tiers defined in the manifest (so seasons swap rewards without an update); free track kept genuinely rewarding (retention research). _(section: 2.4 The Legacy Pass (battle pass) `L` 💰🔁)_
- Line 414: **2.4.3** Premium unlock as an IAP product (~$7.99/season) through the verified backend (0.2). _(section: 2.4 The Legacy Pass (battle pass) `L` 💰🔁)_
- Line 415: **2.4.4** Pass UI: dual-track ladder, claim states, "upgrade" CTA, time left. _(section: 2.4 The Legacy Pass (battle pass) `L` 💰🔁)_
- Line 428: **2.5.1** Holiday templates: Halloween (spooky careers/diseases via `applyDiseases`), Winter (gifting/family via `DatingActions`/family), Summer (travel via `TravelActions`). _(section: 2.5 Seasonal/Holiday & Flash Events `M` (recurring) 🔁)_
- Line 429: **2.5.2** Flash economic events reusing `actions/weekly/applyEconomicEvent.ts`: crypto bull-run weekend, market crash, IPO window — time-boxed, urgency-driven. _(section: 2.5 Seasonal/Holiday & Flash Events `M` (recurring) 🔁)_
- Line 430: **2.5.3** Forward **3-month content calendar** doc so cadence is intentional. _(section: 2.5 Seasonal/Holiday & Flash Events `M` (recurring) 🔁)_
- Line 450: **3.1.1** Define **"Best Life Score"** formula (weighted net worth + longevity + relationships + achievements + prestige) — documented and versioned. _(section: 3.1 Leaderboards `L` 🔁)_
- Line 451: **3.1.2** Backend leaderboard service (managed: Supabase/Firebase) with anti-cheat: server-side score validation, rate limits, anomaly flags (our saves are HMAC-signed — submit signed score payloads). _(section: 3.1 Leaderboards `L` 🔁)_
- Line 452: **3.1.3** Leaderboard UI (tabs: weekly/all-time/season; friends filter later). _(section: 3.1 Leaderboards `L` 🔁)_
- Line 465: **3.2.1** Card layout component (themeable, dark-mode aware, uses `scale()`). _(section: 3.2 Legacy Card (shareable image) `M` 🔁 **(highest-ROI virality)**)_
- Line 466: **3.2.2** Capture to image (`react-native-view-shot`) + native share sheet; include app store deep-link / referral tag. _(section: 3.2 Legacy Card (shareable image) `M` 🔁 **(highest-ROI virality)**)_
- Line 467: **3.2.3** Trigger on death and on major milestones (wires up the 1.5 share stub). _(section: 3.2 Legacy Card (shareable image) `M` 🔁 **(highest-ROI virality)**)_
- Line 478: **3.3.1** Generate shareable friend code tied to anonymous ID. _(section: 3.3 Friend Codes / Async Compare `M` 🔁)_
- Line 479: **3.3.2** Async "compare lives" view (your current run vs. a friend's published snapshot) — no real-time multiplayer. _(section: 3.3 Friend Codes / Async Compare `M` 🔁)_
- Line 480: **3.3.3** Friends filter on leaderboards. _(section: 3.3 Friend Codes / Async Compare `M` 🔁)_
- Line 490: **3.4.1** Global aggregate counter (e.g. total net worth earned this season) on the backend. _(section: 3.4 Seasonal Community Goal `S→M` 🔁)_
- Line 491: **3.4.2** Threshold rewards to all participants; progress bar in the season hub. _(section: 3.4 Seasonal Community Goal `S→M` 🔁)_
- Line 522: Author multi-week arc templates per life path (rival resurfaces, child rebels, business betrayal, romance arc, crime investigation chain). _(section: Decision gate (resolve before building — see §Decisions))_
- Line 523: Arc selector weights by NPC opinion/memory/mood + player history; delivered via manifest (2.1); deterministic via seed for replay (cross-cutting 4.cc1). _(section: Decision gate (resolve before building — see §Decisions))_
- Line 524: Arc state machine integrated with the cliffhanger system so beats resolve across weeks. _(section: Decision gate (resolve before building — see §Decisions))_
- Line 527: Server endpoint that takes a **structured NPC/state seed** and returns bounded flavor text (never raw state mutation — effects stay in whitelisted, validated content ops, mirroring 2.1's sandbox). _(section: Decision gate (resolve before building — see §Decisions))_
- Line 528: Cost guardrails (per-user/day caps, caching of generations), moderation filter, **strict offline/timeout fallback to Tier 1**. _(section: Decision gate (resolve before building — see §Decisions))_
- Line 529: A/B (2.2) Tier 2 vs Tier 1 on retention + cost-per-retained-user before any wide rollout. _(section: Decision gate (resolve before building — see §Decisions))_
- Line 542: **4.2.1** Inheritance reveal sequence: estate passed, traits transferred, family tree grows (animate `ancestors[]`/lineage). _(section: 4.2 Prestige Cinematic Hand-off `M` 🔁 **(lean into the moat)**)_
- Line 543: **4.2.2** "Generational recap" card (shareable via 3.2): what this life achieved, what the heir inherits. _(section: 4.2 Prestige Cinematic Hand-off `M` 🔁 **(lean into the moat)**)_
- Line 544: **4.2.3** Reduced-motion variant (roadmap accessibility) and skip option. _(section: 4.2 Prestige Cinematic Hand-off `M` 🔁 **(lean into the moat)**)_
- Line 556: **4.3.1 Criminal Empire** — expand dark web/`CrimeActions` (new vendors, multi-stage heists, laundering tiers). _(section: 4.3 Content / DLC Packs `L` (recurring) 💰)_
- Line 557: **4.3.2 Hollywood** — expand streaming/content/celebrity (`ContentActions`, `HobbyActions`, `PulseActions`/`SparkActions`). _(section: 4.3 Content / DLC Packs `L` (recurring) 💰)_
- Line 558: **4.3.3 Tycoon** — expand companies/real estate/R&D (`FamilyBusinessActions`, `RealEstateActions`, `RDActions`). _(section: 4.3 Content / DLC Packs `L` (recurring) 💰)_
- Line 559: **4.3.4 Romance & Family** — deeper dating arcs, more wedding venues, parenting decisions (genre's most-requested; `DatingActions`). _(section: 4.3 Content / DLC Packs `L` (recurring) 💰)_
- Line 560: **4.3.5 Pets+** — more species, competitions, pet inheritance (`PetActions`). _(section: 4.3 Content / DLC Packs `L` (recurring) 💰)_
- Line 569: **4.4.1** Cosmetic inventory model (apartment themes, vehicle wraps, profile frames, lineage crests) — gems-only, no stat effect. _(section: 4.4 Cosmetics Store `M` 💰 **(pure-margin, zero controversy)**)_
- Line 570: **4.4.2** Store UI + preview; manifest-driven catalog (rotate featured items). _(section: 4.4 Cosmetics Store `M` 💰 **(pure-margin, zero controversy)**)_
- Line 571: **4.4.3** Equip/persist cosmetics in GameState (migration + auditor). _(section: 4.4 Cosmetics Store `M` 💰 **(pure-margin, zero controversy)**)_
- Line 582: **4.5.1** Subscription products (`$4.99/mo`, `$29.99/yr`) via verified backend (0.2); entitlement state in GameState. _(section: 4.5 DeepLife+ Subscription `L` 💰🔁 **(the recurring-revenue anchor)**)_
- Line 583: **4.5.2** Benefits wiring: ad-suppression (`AdMobService`), monthly gem grant, cosmetic entitlements, reroll token. _(section: 4.5 DeepLife+ Subscription `L` 💰🔁 **(the recurring-revenue anchor)**)_
- Line 584: **4.5.3** Restore-purchases + grace/lapse handling; paywall UI with clear value; A/B price (2.2). _(section: 4.5 DeepLife+ Subscription `L` 💰🔁 **(the recurring-revenue anchor)**)_
- Line 595: **4.6.1** Mode flag at new-life creation: permadeath, no youth pills, no revives. _(section: 4.6 Hardcore / Ironman Mode `M` 🔁)_
- Line 596: **4.6.2** Exclusive cosmetic + leaderboard board for hardcore runs. _(section: 4.6 Hardcore / Ironman Mode `M` 🔁)_
- Line 597: **4.6.3** Guard rails so IAP "revive"/youth items are disabled (and not sold) in this mode — fairness + store integrity. _(section: 4.6 Hardcore / Ironman Mode `M` 🔁)_
- Line 608: Transcript-record a life (seed + action log) and replay to identical end state. _(section: CC.1 Deterministic Sim Replay `L` (roadmap N5))_
- Line 609: Becomes the regression harness for every content drop (2.1) and Living Story (4.1). _(section: CC.1 Deterministic Sim Replay `L` (roadmap N5))_
- Line 613: Automated gate per release: tests pass, coverage threshold, type-check, lint, error-rate budget. Blocking in CI. _(section: CC.2 Quality Scorecard Gate `M` (roadmap N4))_
- Line 617: Finish extracting/instrumenting the weekly tick (already 34 helpers); target **p95 < 20ms/phase**; add late-game save-size stress (2,000+ weeks, < 3.5 MB). _(section: CC.3 `nextWeek()` Decomposition & Perf `L` (roadmap P1))_
- Line 621: 18+ render tests covering all tabs/screens (incl. every new modal/screen above) to catch mount crashes before release. _(section: CC.4 UI Render-Test Suite `M` (roadmap P1))_
- Line 625: Label key interactive rows (target 60%+); finish reduced-motion sweep across all new animated components (1.1, 1.5, 4.2). _(section: CC.5 Accessibility & Reduced-Motion `M` (roadmap P1/P3))_
### tasks/hardening-and-improvement-plan-2026-06-19.md

- Line 72: *Follow-up:* a global "new season" toast/indicator outside the modal (today _(section: P1 — Make seasons first-class (the real fix for B) — ✅ CORE DONE (2026-06-19))_
- Line 83: *Remaining (ops):* `onboarding_step` (pre-game flow), the receiving endpoint _(section: P2 — Finish the analytics funnel & insight — ✅ CORE DONE (2026-06-19))_
- Line 115: **Recurring monthly gem stipend** (needs a monthly tick keyed to renewal), _(section: P4 — DeepLife+ depth)_
- Line 117: A/B price test ($4.99/mo vs alternatives) once analytics + store are live. _(section: P4 — DeepLife+ depth)_
- Line 120: IAP-verify backend + real store products (Legacy Pass premium + DeepLife+). _(section: P5 — Ops / launch (already documented, not code))_
- Line 121: Rotate the leaked Play key + purge history (`leaked-key-rotation-runbook.md`). _(section: P5 — Ops / launch (already documented, not code))_
- Line 122: Real AdMob IDs, HMAC secret, privacy policy, UMP — see `launch-blocker-audit`. _(section: P5 — Ops / launch (already documented, not code))_
### tasks/leaked-key-rotation-runbook.md

- Line 266: **Old key revoked** — leaked Key ID deleted in Cloud Console; `gcloud auth print-access-token` with the old key **fails** (Step 1.6a). _(section: 3.5 Final verification checklist)_
- Line 267: **New key works** — `eas submit --platform android --profile production` authenticates and uploads (Step 1.6b). _(section: 3.5 Final verification checklist)_
- Line 268: **New key stored as a secret** — present in EAS (`eas secret:list` / `eas credentials`), absent from every tracked file. _(section: 3.5 Final verification checklist)_
- Line 269: **Blob gone from history** — on the full mirror, `git log --all --oneline -- google-play-service-account.json` prints nothing (Step 2.2/2.3). _(section: 3.5 Final verification checklist)_
- Line 270: **Force-push done + team re-cloned** — collaborators notified; stale clones discarded (Step 2.4). _(section: 3.5 Final verification checklist)_
- Line 271: **Caches invalidated** — forks/PRs cleaned, GitHub Support request filed for unreachable-commit purge (Step 2.5). _(section: 3.5 Final verification checklist)_
- Line 272: **Secret scanning clean** — GitHub secret scanning + push protection enabled; no open alert for the key (Step 3.2). _(section: 3.5 Final verification checklist)_
- Line 273: **`.gitignore` intact** — line 47 entry present; pre-commit guard installed (Step 3.1, 3.3). _(section: 3.5 Final verification checklist)_
### tasks/pr-checklist-2026-03-09.md

- Line 32: `scripts/check-import-integrity.js` (new) - Owner: `Tooling` - Effort: `3h` _(section: PR-03 - Import Integrity Guard)_
- Line 33: `package.json` add script hook - Owner: `Tooling` - Effort: `0.5h` _(section: PR-03 - Import Integrity Guard)_
- Line 34: CI/local invocation docs in `tasks/` - Owner: `Tooling` - Effort: `0.5h` _(section: PR-03 - Import Integrity Guard)_
- Line 36: Missing `@/` or broken relative imports fail fast before runtime _(section: PR-03 - Import Integrity Guard)_
- Line 39: `app/(tabs)/work.tsx` - Owner: `Core Gameplay` - Effort: `2h` _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 40: `app/(onboarding)/Perks.tsx` - Owner: `Core Gameplay` - Effort: `1.5h` _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 41: `contexts/game/GameActionsContext.tsx` - Owner: `Core Gameplay` - Effort: `3h` _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 42: `contexts/game/actions/DatingActions.ts` - Owner: `Core Gameplay` - Effort: `2h` _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 43: `utils/saveValidation.ts` - Owner: `Save/Platform` - Effort: `2h` _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 45: Remove high-risk `as any`/`@ts-ignore` in gameplay/save paths _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 46: Union accesses protected with explicit `'property' in object` guards _(section: PR-04 - Type Safety and Union Guards (High Risk Paths))_
- Line 49: `services/IAPService.ts` - Owner: `Save/Platform + Economy` - Effort: `4h` _(section: PR-05 - IAP Entitlement Flow Purification)_
- Line 50: `contexts/game/types.ts` (if needed for typed entitlement transforms) - Owner: `Core Gameplay` - Effort: `1h` _(section: PR-05 - IAP Entitlement Flow Purification)_
- Line 51: `__tests__/` coverage for entitlement apply/revoke paths - Owner: `QA` - Effort: `2h` _(section: PR-05 - IAP Entitlement Flow Purification)_
- Line 53: Entitlements applied by typed pure transforms; no mutation-heavy side effects _(section: PR-05 - IAP Entitlement Flow Purification)_
- Line 56: `__tests__/utils/saveValidation.test.ts` - Owner: `QA` - Effort: `1h` _(section: PR-06 - Test Factory Compliance for GameState)_
- Line 57: Related tests manually constructing `GameState` - Owner: `QA` - Effort: `2h` _(section: PR-06 - Test Factory Compliance for GameState)_
- Line 59: All tests use `createTestGameState()` and avoid `as GameState` _(section: PR-06 - Test Factory Compliance for GameState)_
- Line 68: `components/*` dormant flow asset references - Owner: `UI/UX` - Effort: `2h` _(section: PR-08 - Missing/Dormant Asset Integrity)_
- Line 70: No unresolved runtime image requires in shipping flows _(section: PR-08 - Missing/Dormant Asset Integrity)_
- Line 73: `lib/config/gameConstants.ts` - Owner: `Core Gameplay + Economy` - Effort: `2h` _(section: PR-09 - Hardcoded Constants Extraction)_
- Line 74: `services/IAPService.ts` - Owner: `Economy` - Effort: `1.5h` _(section: PR-09 - Hardcoded Constants Extraction)_
- Line 75: `utils/loan.ts` and finance call sites - Owner: `Economy` - Effort: `2h` _(section: PR-09 - Hardcoded Constants Extraction)_
- Line 76: Replace `999999`, repeated `100000`, raw day/week ms formulas across touched files - Owner: `Economy + Core Gameplay` - Effort: `3h` _(section: PR-09 - Hardcoded Constants Extraction)_
- Line 78: Gameplay/finance magic numbers replaced with named constants _(section: PR-09 - Hardcoded Constants Extraction)_
- Line 81: `components/mobile/TinderApp.tsx` - Owner: `UI/UX + Core Gameplay` - Effort: `1h` _(section: PR-10 - External URL Fixture Hardening)_
- Line 82: `lib/social/randomProfiles.ts` - Owner: `Core Gameplay` - Effort: `1h` _(section: PR-10 - External URL Fixture Hardening)_
- Line 83: `lib/social/npcPosts.ts` - Owner: `Core Gameplay` - Effort: `1h` _(section: PR-10 - External URL Fixture Hardening)_
- Line 85: Simulation UI does not depend on unstable third-party avatar URLs _(section: PR-10 - External URL Fixture Hardening)_
- Line 88: `components/computer/BitcoinMiningApp.tsx` - Owner: `UI/UX` - Effort: `2h` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 89: `app/(tabs)/work.tsx` - Owner: `UI/UX + Core Gameplay` - Effort: `2h` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 90: `components/mobile/CompanyApp.tsx` - Owner: `UI/UX` - Effort: `2h` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 91: `components/computer/GamingApp.tsx` - Owner: `UI/UX` - Effort: `2h` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 92: `components/computer/GamingStreamingApp.tsx` - Owner: `UI/UX` - Effort: `2h` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 93: `components/computer/AdvancedBankApp.tsx` - Owner: `UI/UX + Economy` - Effort: `2h` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 95: Color literals moved to tokens, major sizing uses `scale()`/`fontScale()` _(section: PR-11 - Theme and Scaling Compliance)_
- Line 98: Run `npm run preflight:quick` and capture delta from baseline - Owner: `QA` - Effort: `0.5h` _(section: PR-12 - Release Verification Gates)_
- Line 99: Run full `npm run preflight` before release build - Owner: `QA` - Effort: `1h` _(section: PR-12 - Release Verification Gates)_
- Line 100: Run focused regressions for save load, onboarding, real estate maintenance, APR progression, IAP entitlements - Owner: `QA` - Effort: `2h` _(section: PR-12 - Release Verification Gates)_
- Line 101: Game State Reviewer pass on state/actions touched PRs - Owner: `Core Gameplay` - Effort: `0.5h` _(section: PR-12 - Release Verification Gates)_
- Line 102: Save System Auditor pass on save/schema PRs - Owner: `Save/Platform` - Effort: `0.5h` _(section: PR-12 - Release Verification Gates)_
- Line 104: No new regressions relative to baseline and release gate checks pass _(section: PR-12 - Release Verification Gates)_
### tasks/reality-check-2026-06-19.md

- Line 46: **IAP verification backend** — `EXPO_PUBLIC_IAP_VERIFY_URL` is unset, so `verifyReceiptWithServer()` **refuses all entitlements** (`services/IAPService.ts:425`). No revenue until this exists. **This is the #1 blocker.** _(section: Launch blockers (verified real))_
- Line 47: **Real AdMob unit IDs** (test IDs → $0). _(section: Launch blockers (verified real))_
- Line 48: **HMAC signing key** as EAS secret (non-rotatable). _(section: Launch blockers (verified real))_
- Line 49: **Purge leaked Play service-account key** from git history + rotate. _(section: Launch blockers (verified real))_
- Line 50: **Privacy policy** aligned to real ad/data behavior. _(section: Launch blockers (verified real))_
- Line 51: **Android UMP/GDPR consent** before personalized ads. _(section: Launch blockers (verified real))_
- Line 54: **Analytics foundation** (Wave 0.1) — genuinely missing, unblocks measuring everything, and is additive/low-risk. Strong candidate for the first real code I write. _(section: The one safe, high-value feature build)_
- Line 57: **Legacy Pass / Battle Pass** — genuinely missing, on-strategy, monetizable. But it's a **large** feature that touches GameState (needs a `STATE_VERSION` 19→20 bump + registered migration + Save System Auditor sign-off). Should be built deliberately, not rushed. _(section: The one net-new feature that fits the vision)_
### tasks/retention-and-content-strategy-2026-06-19.md

- Line 127: **Deploy daily-login reward UI** — constants `[25,50,75,100,150,200,500]` already exist; build the 7-day claim modal + state. (Biggest effort:reward ratio in the codebase.) _(section: 5.1 Cheap wins — ship first `[NOW]` 🔁)_
- Line 128: **Fix day-1 gem curve** — front-load the first-session reward so a brand-new player feels generous progress before the tutorial gate (roadmap item M5). _(section: 5.1 Cheap wins — ship first `[NOW]` 🔁)_
- Line 129: **Push notifications for re-engagement** — feature flag `notifications` exists; wire 3 triggers: (a) daily challenge reset, (b) streak about to break, (c) "your business/crypto earned $X while away." _(section: 5.1 Cheap wins — ship first `[NOW]` 🔁)_
- Line 130: **Streak-save grace messaging** — we already forgive 48h; *tell the player* ("Your 6-day streak is safe until tomorrow") to weaponize loss aversion. _(section: 5.1 Cheap wins — ship first `[NOW]` 🔁)_
- Line 131: **"While you were away" summary** on app open — passive income from companies/crypto/real estate already accrues; surface it as a dopamine hit. _(section: 5.1 Cheap wins — ship first `[NOW]` 🔁)_
- Line 132: **Toast/notification dedup** (roadmap M-item) so the reward moments don't get buried. _(section: 5.1 Cheap wins — ship first `[NOW]` 🔁)_
- Line 135: **Daily login UI → 30-day cycle** (extend the 7-day to a monthly calendar with a marquee day-30 reward). _(section: 5.2 Session & mid-term retention `[NEXT]` 🔁)_
- Line 136: **Weekly goals** (in addition to daily): "Earn $50k this week," "Reach a new career tier" — bridges daily → seasonal. _(section: 5.2 Session & mid-term retention `[NEXT]` 🔁)_
- Line 137: **Comeback bonus** for lapsed players (7+ days away): a one-time gem + youth-pill "welcome back" grant. _(section: 5.2 Session & mid-term retention `[NEXT]` 🔁)_
- Line 138: **Milestone celebration moments** — we track net-worth/week/relationship milestones with 85% "proximity alerts"; turn hitting them into full-screen shareable moments. _(section: 5.2 Session & mid-term retention `[NEXT]` 🔁)_
- Line 139: **Achievement expansion** — only 7 hardcoded today; expand to 40–60 across all systems (crime, crypto, politics, parenting, prestige) for long-tail completionism. _(section: 5.2 Session & mid-term retention `[NEXT]` 🔁)_
- Line 142: **Seasons live** (see §6) — the core anti-churn engine. _(section: 5.3 Long-term / identity retention `[LATER]` 🔁)_
- Line 143: **Leaderboards + Legacy Card sharing** (see §7). _(section: 5.3 Long-term / identity retention `[LATER]` 🔁)_
- Line 144: **Collection / codex** — "Lives Lived" museum of past generations, careers tried, diseases survived, NPCs met. Completionist hook tied to prestige. _(section: 5.3 Long-term / identity retention `[LATER]` 🔁)_
- Line 145: **Hardcore / Ironman mode** — permadeath, no youth pills, exclusive cosmetic reward. Adds replay identity for veterans. _(section: 5.3 Long-term / identity retention `[LATER]` 🔁)_
- Line 154: **Remote content pipeline** — move hardcoded scenarios/careers/diseases/events into a **versioned, signed manifest** the app fetches. Ship events without an app-store update. *This unblocks everything else in this section.* _(section: 6.1 Infrastructure `[LATER]` (prerequisite — roadmap N1))_
- Line 155: **Manifest validation + offline fallback** — verify checksum/signature (we already do CRC32 on saves; reuse the discipline), cache last-good, never break offline play. _(section: 6.1 Infrastructure `[LATER]` (prerequisite — roadmap N1))_
- Line 156: **A/B bucketing** (roadmap N3) — consistent-hash players into cohorts so we can test event/balance variants. _(section: 6.1 Infrastructure `[LATER]` (prerequisite — roadmap N1))_
- Line 159: **Season 1: "Living Legacy"** — 6-week season, themed scenario arcs, seasonal job rotation, exclusive heritable trait as the marquee reward. _(section: 6.2 Seasonal content `[NEXT]` 💰🔁)_
- Line 160: **Holiday/seasonal events** (BitLife's proven playbook): Halloween (spooky careers/diseases), Winter (gifting, family events), Summer (travel-themed). Reuse our **Travel, Pets, Dating, Family** systems with seasonal skins. _(section: 6.2 Seasonal content `[NEXT]` 💰🔁)_
- Line 161: **Limited-time "flash" economic events** — reuse the existing `applyEconomicEvent` engine: a crypto bull run weekend, a stock-market crash event, a startup-IPO window. Creates urgency on systems we already have. _(section: 6.2 Seasonal content `[NEXT]` 💰🔁)_
- Line 162: **Event calendar doc** — maintain a forward 3-month content calendar so cadence is intentional, not ad-hoc. _(section: 6.2 Seasonal content `[NEXT]` 💰🔁)_
- Line 165: **Free + premium track**, 6-week duration, keyed to **prestige progress + daily-challenge streaks** (we already generate the engagement signal). _(section: 6.3 The Legacy Pass (battle pass) `[NEXT]` 💰🔁)_
- Line 166: **Rewards = no pay-to-win:** cosmetics (apartment themes, vehicle skins, profile frames), youth pills, gems, exclusive heritable traits. Power stays earnable. _(section: 6.3 The Legacy Pass (battle pass) `[NEXT]` 💰🔁)_
- Line 167: **Keep the free track genuinely rewarding** (retention research: free-track value is what makes non-payers stay and eventually convert). _(section: 6.3 The Legacy Pass (battle pass) `[NEXT]` 💰🔁)_
- Line 168: **Pass tied to the in-fiction "Legacy" theme** so it feels native, not bolted on. _(section: 6.3 The Legacy Pass (battle pass) `[NEXT]` 💰🔁)_
- Line 174: **Leaderboards:** net worth, longevity (weeks lived), generations reached, "Best Life Score" (a composite). Weekly + all-time + seasonal boards. _(section: 7. SOCIAL & VIRALITY — checklist `[NEXT]` 🔁)_
- Line 175: **"Legacy Card" shareable image** — auto-generate a stylized end-of-life summary card (career, net worth, family tree, cause of death, score) for one-tap share to socials. Cheapest organic-growth lever we have. (We already have `SCREENSHOT_GUIDE.md` / strong screen visuals to build on.) _(section: 7. SOCIAL & VIRALITY — checklist `[NEXT]` 🔁)_
- Line 176: **Friend codes / async compare** — compare your current life vs. a friend's without real-time multiplayer (avoids server complexity). _(section: 7. SOCIAL & VIRALITY — checklist `[NEXT]` 🔁)_
- Line 177: **Seasonal community goal** — global aggregate ("the DeepLife world collectively earned $1T this season → everyone gets a reward"). Cheap, fun, bonding. _(section: 7. SOCIAL & VIRALITY — checklist `[NEXT]` 🔁)_
- Line 178: **(LATER) Heir trading / lineage showcase** — let players publish a "famous lineage" others can view. Long-term social identity. _(section: 7. SOCIAL & VIRALITY — checklist `[NEXT]` 🔁)_
- Line 186: **Career/Life-path packs** `[NEXT]` 💰 — themed bundles reusing our job/hobby engine: *Criminal Empire* (expand dark web), *Hollywood* (expand streaming/content/celebrity), *Tycoon* (expand companies/real estate/R&D), *Politician* (expand the political ladder). _(section: 8. CONTENT / DLC EXPANSIONS — checklist)_
- Line 187: **Romance & Family expansion** `[NEXT]` 💰🔁 — players ask for this genre-wide: deeper dating arcs, more wedding venues, parenting mini-decisions, family drama events. Leverages NPC depth. _(section: 8. CONTENT / DLC EXPANSIONS — checklist)_
- Line 188: **Pets+ pack** `[LATER]` 💰 — more species, pet competitions, pet inheritance. (Pets are a top-3 requested life-sim feature.) _(section: 8. CONTENT / DLC EXPANSIONS — checklist)_
- Line 189: **Cosmetics store** `[NEXT]` 💰 — apartment themes, vehicle wraps, profile frames, "lineage crests." **Gems-only, zero pay-to-win.** Pure-margin, non-controversial revenue. _(section: 8. CONTENT / DLC EXPANSIONS — checklist)_
- Line 190: **"Season 2" narrative arcs** `[LATER]` — branching multi-week storylines per life path (career storylines, crime-investigation chains, romance arcs). Depth play. _(section: 8. CONTENT / DLC EXPANSIONS — checklist)_
- Line 191: **Rare collectibles / heritable traits** `[NEXT]` 🔁 — event-exclusive traits that auto-pass to heirs; ties content → prestige → retention. _(section: 8. CONTENT / DLC EXPANSIONS — checklist)_
- Line 200: **IAP verification backend** (RevenueCat or custom) — `EXPO_PUBLIC_IAP_VERIFY_URL` unset = **all purchases refused today.** Hard blocker. _(section: 9.1 Launch blockers (must clear before *any* revenue) `[NOW]`)_
- Line 201: **Real AdMob unit IDs** — test IDs currently → $0 ad revenue. _(section: 9.1 Launch blockers (must clear before *any* revenue) `[NOW]`)_
- Line 202: **HMAC key as EAS secret** (one-time, non-rotatable) + **purge leaked Play service-account key** from git history. _(section: 9.1 Launch blockers (must clear before *any* revenue) `[NOW]`)_
- Line 203: **Privacy policy aligned to actual ad delivery** (currently says ads disabled). _(section: 9.1 Launch blockers (must clear before *any* revenue) `[NOW]`)_
- Line 204: **Android UMP/GDPR consent** before personalized ads. _(section: 9.1 Launch blockers (must clear before *any* revenue) `[NOW]`)_
- Line 207: **DeepLife+ subscription** (the missing BitLife-Bitizen analog): removes ads, monthly gem stipend, exclusive seasonal cosmetics, "+1 daily challenge reroll." Recurring revenue >> one-shot IAPs. **Price test $4.99/mo, $29.99/yr.** _(section: 9.2 New revenue lines `[NEXT]` 💰)_
- Line 208: **Legacy Pass** (§6.3) — seasonal, ~$7.99/season. _(section: 9.2 New revenue lines `[NEXT]` 💰)_
- Line 209: **Cosmetics store** (§8) — gems-only, pure margin, no balance impact. _(section: 9.2 New revenue lines `[NEXT]` 💰)_
- Line 210: **Rewarded-ad expansion** (opt-in only): "watch to claim daily bonus," "watch to revive," "watch to reroll a challenge." Respectful, player-initiated, proven non-churning. _(section: 9.2 New revenue lines `[NEXT]` 💰)_
- Line 213: **Verify Premium Pack multipliers actually apply** (roadmap H-item: 1.5× income mapping unverified — we may be selling a boost that does nothing). _(section: 9.3 Hygiene & fairness `[NEXT]`)_
- Line 214: **Keep the 2.0× income soft-cap** — protects long-term economy from pay-to-win runaway; reassure players power is earnable. _(section: 9.3 Hygiene & fairness `[NEXT]`)_
- Line 215: **Decide stock vs. crypto capital-gains tax consistency** (crypto taxed 25%/yr, stocks untaxed) — fairness + economy integrity. _(section: 9.3 Hygiene & fairness `[NEXT]`)_
- Line 221: **Living Story (AI narrative)** `[LATER]` 🔁 — the genre is moving here (Infinite Life Simulation). We have the NPC-depth substrate; **this is our defensible differentiator.** Decide Tier 1 vs Tier 2 (§4 Pillar A). _(section: 10. NEW THINKING / BIG BETS — checklist)_
- Line 222: **Analytics first, everything else second** `[NOW]` — roadmap N2. We currently log only onboarding. **We cannot improve retention we can't measure.** Instrument: session length, where players quit, challenge completion, funnel to first purchase, D1/D7/D30 cohorts. *This should arguably be the very first thing built* — it makes every other item on this list measurable. _(section: 10. NEW THINKING / BIG BETS — checklist)_
- Line 223: **"One more generation" prestige polish** `[NEXT]` 🔁 — our prestige loop is the moat BitLife lacks. Make the Heir hand-off a *cinematic, emotional* moment (inheritance reveal, trait passing, family-tree growth). Lean into it as the brand signature. _(section: 10. NEW THINKING / BIG BETS — checklist)_
- Line 224: **Reduce decision fatigue** `[LATER]` — 25+ systems can overwhelm new players (AltLife wins on cleaner UX). Add a **"focus mode" / guided life goals** so newcomers aren't lost. Onboarding clarity = retention. _(section: 10. NEW THINKING / BIG BETS — checklist)_
- Line 225: **Deterministic sim replay** `[LATER]` — roadmap N5; lets us regression-test balance across content drops so live-ops never breaks economy. Quality moat. _(section: 10. NEW THINKING / BIG BETS — checklist)_
- Line 226: **Quality scorecard gate** `[LATER]` — roadmap N4; automated test/coverage/type/error-rate gate per release so cadence never sacrifices stability. _(section: 10. NEW THINKING / BIG BETS — checklist)_
- Line 244: **D1 retention** — target **35%+** (industry avg 26%). _(section: 12. KPIs — how we'll know it worked)_
- Line 245: **D7 retention** — target **12%+** (industry avg 10%; BitLife 15% even with heavy ads). _(section: 12. KPIs — how we'll know it worked)_
- Line 246: **D30 retention** — target **6%+** (industry avg <4%). _(section: 12. KPIs — how we'll know it worked)_
- Line 247: **Daily-challenge completion rate** & **avg streak length** (our core engagement signal). _(section: 12. KPIs — how we'll know it worked)_
- Line 248: **Sessions/day & session length** (BitLife benchmark: ~5 sessions, ~34 min/day). _(section: 12. KPIs — how we'll know it worked)_
- Line 249: **Prestige rate** — % of players who reach a 2nd generation (our moat metric). _(section: 12. KPIs — how we'll know it worked)_
- Line 250: **ARPDAU & conversion to first purchase**; **subscription attach rate**. _(section: 12. KPIs — how we'll know it worked)_
- Line 251: **Season pass attach rate** & **free-track completion** (health of the live-ops loop). _(section: 12. KPIs — how we'll know it worked)_
- Line 252: **K-factor / shares per death** (virality of the Legacy Card). _(section: 12. KPIs — how we'll know it worked)_
### tasks/round11-master-plan-2026-06-09.md

- Line 408: `npm test` green after every sprint (currently 2344/2344). _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
- Line 409: `npm run type-check` stays at 0 errors. _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
- Line 410: `npm run preflight` passes (and is blocking in CI). _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
- Line 411: Game State Reviewer subagent on any contexts/actions/state change. _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
- Line 412: Save System Auditor subagent on any types.ts/initialState/saveValidation change. _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
- Line 413: No new `as any` / internal `require()` / hex-literal (enforced by lint). _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
- Line 414: Perf budget assertions pass (tick p95 ≤70ms, heap ≤0.1 MB/week). _(section: PART 4 — VERIFICATION CHECKLIST (per the project's gates))_
### tasks/todo.md

- Line 16: Push the focused correction and verify remote CI. _(section: Active: PR CI recovery)_
- Line 42: Publish a separate PR with screenshots and explicit native-test limits. _(section: Active: Home first decisions (2026-09-08))_
- Line 140: Verify IAP changes with the SDK on TestFlight before merging, per the PR _(section: Next gates and implementation slices)_
- Line 144: Establish reinstall/cross-device recovery and resolve subscription-specific _(section: Next gates and implementation slices)_
- Line 148: Continue the ranked feature work in the audit report after trust gates. _(section: Next gates and implementation slices)_
- Line 171: Dispatch `eas-build-local-ios.yml` with version **2.13.0**, submit on. _(section: BEFORE THE BUILD)_
- Line 172: **Watch that run** — first since preflight moved inside _(section: BEFORE THE BUILD)_
- Line 179: **OWNER: trim the store block** in `WHATS_NEW.md` before submission. Eight _(section: BEFORE THE BUILD)_
- Line 215: **Watch the first workflow run after the `env:exec` change** in the Actions _(section: RELEASE BLOCKERS — closed by Programs 15/16, re-proved on 175efc4)_
- Line 223: Program 17 confirmed none of these can be done from a Linux container: _(section: RELEASE VERIFICATION (device / dashboard — cannot be done from the repo))_
- Line 230: Sandbox: buy a gem pack, buy the Revival Pack, subscribe, restore, relaunch mid-purchase (iOS + Play). _(section: RELEASE VERIFICATION (device / dashboard — cannot be done from the repo))_
- Line 231: RevenueCat dashboard: entitlement ids `ads_removed` / `premium`, intro offer on `deeplife_premium_*`. _(section: RELEASE VERIFICATION (device / dashboard — cannot be done from the repo))_
- Line 232: iOS: open Spark → Upgrade → Cancel subscription and Pulse → Verified Pro → Cancel; the confirm must appear. _(section: RELEASE VERIFICATION (device / dashboard — cannot be done from the repo))_
- Line 233: iOS: death → Start New Life, death → Revival Pack → return; wedding popup Continue. _(section: RELEASE VERIFICATION (device / dashboard — cannot be done from the repo))_
- Line 234: VoiceOver pass on Home / Apps / Bank Pro; largest Dynamic Type on the death screen. _(section: RELEASE VERIFICATION (device / dashboard — cannot be done from the repo))_
- Line 259: Ask the tester to re-verify on 2.13.0 — every report was filed against _(section: PLAYER BUG REPORTS (2026-09-05) — see tasks/player-bug-triage-2026-09-05.md)_
- Line 263: The `RUN_*` determinism soaks exit 1 although every assertion passes: the _(section: POST-RELEASE)_
- Line 269: Confirm on device whether the 8 interactive elements measuring under _(section: POST-RELEASE)_
- Line 272: IAP: persist a pending-consumable-grant record on the RC failure branch, so _(section: POST-RELEASE)_
- Line 275: Save: null-guard the v11/v13/v14 loops. **Re-proved (Program 16 §4.2): it _(section: POST-RELEASE)_
- Line 282: Save: the fresh-start carry-over ordering. **Do NOT simply move the stash _(section: POST-RELEASE)_
- Line 287: Live ops: honour a disable-only payload from cache; require a UTC offset in `parseInstant`; document "never change `startsAt` on a correction"; author the Q4 compiled-in on-ramp. _(section: POST-RELEASE)_
- Line 288: Events: add the interruption-budget / arc-completion decomposition to `eventTelemetry.sim`; consider a pity floor (one seed answered 6 events in 100 weeks). _(section: POST-RELEASE)_
- Line 291: Modal: make `AlertHost` defer a queued handler that tears down its own _(section: POST-RELEASE)_
- Line 296: Bank Pro: "Week 104" chips print the absolute counter — real, and more _(section: POST-RELEASE)_
- Line 310: Hack caught-roll: fold an attempt index into the key before any UI is wired. _(section: POST-RELEASE)_
- Line 326: Party "Standing" drifts toward 50, so above it the score decays 1/week _(section: OWNER DECISIONS)_
- Line 331: DeepLife+ benefits are cleared on a launch where RevenueCat has never _(section: OWNER DECISIONS)_
- Line 344: Happiness saturation. **Root cause found and the obvious fix disproved _(section: OWNER DECISIONS)_
- Line 358: `liveOps.claimedInstanceIds` across prestige: carry it, or document per-life claims. _(section: OWNER DECISIONS)_
- Line 359: Chapter gems re-earned every life (~145/life) — once per lineage instead? _(section: OWNER DECISIONS)_
- Line 360: Ad orb vitality grant: week-ungated, +100 to three stats, bypasses the happiness curve. _(section: OWNER DECISIONS)_
- Line 361: The social personas cannot measure wealth. `CAREER-OBSESSED` and _(section: OWNER DECISIONS)_
- Line 367: Free Call has no time cost; regular contacts still ratchet to bond 100 by week 250. _(section: OWNER DECISIONS)_
- Line 368: WHATS_NEW 2.11.0 "membership no longer switches off offline" is only true when RevenueCat has ever fetched; soften or accept. _(section: OWNER DECISIONS)_
- Line 369: `showStatsBar` route gate: the string-matched exclusion list would hide the death screen for a new tab named e.g. `perks`. _(section: OWNER DECISIONS)_
- Line 679: NOT done, owner decisions (report §19): a free Call has no time cost (the _(section: Phase 10 - implementation. STATUS: **done**, one commit:)_
- Line 731: NOT done, owner decisions (report §17): the `networking_opportunity` _(section: Phase 11 — implementation. STATUS: **done**, two commits:)_
- Line 930: NOT done, owner decisions: student-loan deferment (schema), Chapter 2 bundle scaling, play-streak tick counting, the tier-1 "meeting someone" path (per instruction). _(section: Phase 11 — fixes. STATUS: **done**, one commit:)_
- Line 1198: Gates after each phase; full `npm test` + `npm run preflight` at the end. _(section: Phase 3–12 — root causes → changes (each row is one commit; each has a test))_
- Line 1199: Red team (new / confused / impatient / text-skipping / fast-clicking / unlucky), five- and thirty-minute tests, scores, report in `tasks/ui-hierarchy.md` §Program 6, lessons appended. _(section: Phase 3–12 — root causes → changes (each row is one commit; each has a test))_
- Line 1392: Phase 13 — Regression: type-check, type-check:tests, lint:errors, lint:ratchet, check:routes, ui:ratchet, npm test, preflight; ratchets lowered where earned, never raised _(section: UI Overhaul Master Program 3 — THE 19 PHONE APPS — IN PROGRESS)_
- Line 1393: Phase 14 — Red team + 13-category scores + 21-item final report (audit doc §9–10) _(section: UI Overhaul Master Program 3 — THE 19 PHONE APPS — IN PROGRESS)_
- Line 1482: Push a non-force merge commit and verify latest GitHub checks and mergeability. _(section: PR #200 conflict resolution — 2026-09-08)_
### tasks/weekly-audit-setup-plan.md

- Line 24: Verify type-check unaffected, commit, push _(section: Deliverables)_

## Appendix B: literal production-source TODO markers

These markers are classified above. Matches are not automatically defects. AdMob’s “not a TODO” comment and the XXXXXXXXXX input placeholder are excluded.

- `contexts/game/actions/PoliticalActions.ts:681`: `// TODO(flawless-audit): weekly policy effects need a tick reducer.`
- `contexts/game/types.ts:2503`: `// TODO(flawless-audit): remove state.social entirely.`
- `lib/events/personalCrises.ts:86`: `// TODO(flawless-audit): there is no health-insurance system in state yet —`
- `lib/politics/policies.ts:183`: `// TODO(flawless-audit): effects.money is applied ONCE at enactment`
- `lib/progress/achievements.ts:17`: `* TODO(flawless-audit): remove with checkAchievements.`
- `lib/progress/achievements.ts:112`: `// - TODO: Consider using BigInt for net worth calculations if ultra-high precision is needed`
- `lib/progress/achievements.ts:224`: `// - TODO: Consider logging when net worth is clamped, so we can track if this happens`
- `lib/progress/achievements.ts:413`: `* TODO(flawless-audit): remove with checkAchievements.`

## Appendix C: existing detailed release briefs on #203

Preserved from the inspected commit for an immediately usable handoff. These describe existing scope and prior evidence, not newly executed work.

### R11: Privacy disclosures and operational reconciliation

Priority: P1. Dependency: R03. Status: source corrected, operational/live confirmation blocked.

#### Reproduced problem and correction

The public privacy page calls AdMob disabled, denies Firebase and omits RevenueCat despite production flags enabling those SDKs. The candidate source now discloses them and has a factual drift test. It also distinguishes local save deletion and permanent restoration from provider records and consumable replay. Source correction is not deployment or certification of unknown provider settings.

#### Inputs and source map

Read `support-site/privacy.html`, `support-site/support.html`, `eas.json`, `firebase.json`, `services/RevenueCatService.ts`, `services/FirebaseAnalyticsService.ts`, `services/AdMobService.ts`, `lib/config/featureFlags.ts`, `lib/config/appConfig.ts`, `app.config.js` and `__tests__/tooling/privacyDisclosures.test.ts`. Inspect owner-authorized RevenueCat/Firebase/AdMob configuration and current ASC privacy answers without copying credentials into git.

#### Work to execute

1. Build a data map: provider, enabled feature, data category, actual collection trigger, consent state, purpose, linkage/tracking use and deletion/retention behavior. Trace native manifests as well as app code. A production flag alone does not specify every collected field.
2. Verify ATT allow/deny and regional consent behavior on the R08/R09 candidate. Denied ATT is not equivalent to no ads or no SDK activity. Describe the implemented non-personalized ad request path accurately.
3. Confirm the operator/controller identity, contact and provider retention/deletion configuration with the owner or authorized dashboard evidence. A public developer name does not establish every legal/operational fact. Do not invent an address, fixed retention period or universal encryption/compliance guarantee.
4. Reconcile ASC App Privacy selections with observed SDK behavior and provider guidance. Mark uncertain selections as decisions requiring evidence rather than preselecting 'no data collected'. Do not enable analytics to make documentation easier.
5. Verify support instructions agree with transaction recovery, local data and consumable limitations. Source support copy has been reconciled in this continuation; native execution remains R06.
6. Visually inspect privacy/support pages at phone/tablet widths, then deploy the reviewed source through the authorized support-site workflow. Its main-branch push trigger and the separate production-OTA trigger must be considered before merging. Confirm the exact live pages serve the approved revision and links work.

#### Acceptance criteria and evidence

Write `tasks/release/evidence/R11-privacy.md` with the data/consent map, redacted operational confirmations, source SHA, current provider guidance, ASC answers, visual evidence, deployment run and post-deployment live URLs/revision. Run the disclosure regression. Close only when source, live policy and candidate behavior agree and required operational facts are resolved. Apply `CONTRACT.md`.


### R04: Player journeys and clarity

Priority: P2. Dependencies: R02, R03. Status: blocked on interactive/visual access.

#### Objective and current evidence

Prove that the current player can understand and complete the core life loop. Existing render, real-week and onboarding tests pass. This is not an observed native journey. The earlier incorrect age-13 event text is already fixed in `lib/events/secretEvents.ts`; verify it rather than rewriting it again.

#### Inputs and files

Read `app/(onboarding)/`, `app/(tabs)/`, `components/GoalsCard.tsx` if still present, `components/IdentityCard.tsx`, `components/DeathPopup.tsx`, `contexts/game/actions/`, and the current Home guidance components discovered from the Home route. Use `__tests__/render/firstSessionCoach.render.test.tsx`, `__tests__/render/cashFlowState.render.test.tsx`, `__tests__/onboarding/` and `scripts/validate-release-candidate.mjs` as existing evidence and a scenario map. Read the browser skill before executing browser checks in the current agent environment.

#### Work to execute

| Journey | Required actions | Acceptance |
| --- | --- | --- |
| First life | Choose scenario, customize, choose perks, enter Home | Starting age/stats/money agree, one immediate objective, no paid choice mistaken for free |
| First wage | Apply, inspect pending state, advance until accepted, work and inspect recap | Pending application is distinct from hiring, wage agrees with cash change, guidance updates once |
| Education | Compare cash and loan enrollment, inspect quote, enroll once, advance | Tuition, weekly payment and cash remaining agree, repeated tap cannot charge twice |
| Poverty recovery | Start low cash, follow paid work and care guidance | Costs are visible before committing and the player has an executable recovery path |
| Business | Start company, fund research, finish, load another slot | Only played weeks advance research, completion/bonus occurs once, feedback agrees with income |
| Family | Meet, date, develop relationship, inspect family actions | Requirements, costs and consequences visible, no dead-end navigation |
| Life end | Reach death, inspect revive options, decline/continue as heir, relaunch | No trapped modal, paid path clear, chosen life resumes without duplicate reward |
| Navigation | Visit every released tab/app, open/close layered modals, return Home | Back/close controls reachable, no overlapping guidance, no blank/error screen |

Record the source SHA, platform, viewport/device, starting scenario and actual actions reached. Capture before/after for every visible fix. Repeat on compact phone and tablet layouts. Never use seeded debug state as evidence that normal progression unlocks the same screen.

#### Master-prompt instruction

Exercise this matrix against current code, reproduce defects before edits, fix the smallest cause, and verify affected regressions plus visual captures. Preserve the accepted Home guidance, compact HUD and art direction. Do not add story systems, new currencies or speculative redesigns. A blocked browser is missing evidence, not a successful pass.

#### Acceptance criteria and evidence

A journey table with actual observed outcomes, linked screenshots for visible states/fixes, no unresolved in-scope P0/P1/P2, and honest web/native distinction. Save evidence under `tasks/release/evidence/R04-journeys.md`, then update the queue only when every acceptance case is reached. Apply `CONTRACT.md`.


### R08: Signed release candidate and production environment

Priority: P1. Dependencies: R03, R05. Status: local/remote code gates pass, signed candidate unverified.

#### Objective and available evidence

Produce one identifiable signed iOS candidate and prove it is processed in TestFlight. Current repository binary version is 2.13.0 and save schema is 51. Do not assume this binary version is unused. PR #203's 6d2346e implementation passed Preflight 34312514459 and EAS Update 34312514460. Any newer source needs its own current CI evidence.

#### Inputs and files

Requires authorized EAS/Apple build access, production environment and signing configuration. Read `docs/RELEASE_RUNBOOK.md`, `docs/RELEASE_SECRETS.md`, `eas.json`, `app.config.js`, `package.json`, `scripts/preflight-check.js`, `scripts/next-build-number.mjs`, `.github/workflows/eas-build-local-ios.yml`, `.github/workflows/eas-build.yml` and `.github/workflows/eas-update.yml`.

#### Execution order

1. Read current TestFlight/EAS history and source SHA. Record the highest used binary version/build and current editable ASC store record separately.
2. Choose the next binary version under CLAUDE.md's rule and prepare matching `package.json`/in-app changelog/release-note changes. Do not modify schema or store version simply to match numbers.
3. Verify latest PR head checks, install root and isolated asset dependencies, run applicable suite, source/test types, `npm run preflight` and an actual `npx expo export --platform ios` on the candidate. Preflight's syntax check is not an export.
4. Run the required production-environment preflight without printing secrets. Verify signing, receipt verification or RevenueCat production configuration, enabled ads/ATT/Firebase settings and absence of test/debug/mock flags. Record only presence/config verdicts and redacted errors. A missing value in this cloud checkout is not proof EAS lacks it.
5. Prepare the concrete owner-controlled native build action with ref, profile, binary version and fresh build number. A PR merge also publishes production OTA, so treat it as a release action.
6. After the authorized build, inspect logs/artifacts, upload outcome and TestFlight processing. Fix build/signing/upload errors, then verify the exact processed build and its source SHA. Successful JavaScript export or IPA upload alone does not close this gate.
7. Freeze candidate identity for R06/R09. If app/native code changes, record a new candidate and repeat affected acceptance, not just reuse old device screenshots.

#### Acceptance criteria and evidence

Create `tasks/release/evidence/R08-candidate.md` with source SHA, commit checks, production preflight result, export result, EAS/Actions run, binary version, CFBundleVersion, build profile and processed TestFlight status. No secrets. All fields must be observed rather than placeholders before verification. Apply `CONTRACT.md`.


### R06: Native purchases, subscriptions and recovery

Priority: P1. Dependencies: R01, R05, R08. Status: blocked on signed candidate and native store test access.

#### Objective and inputs

Prove that real store transactions grant exactly the advertised benefit, once, to the intended life. Requires the exact processed TestFlight build from R08, an iPhone/iPad and the appropriate sandbox tester. Use test transactions, not live charges. Record binary version, build number, source SHA, storefront and test-account category without saving credentials or full receipts in git.

#### Source map

`services/IAPService.ts`, `services/RevenueCatService.ts`, `services/SubscriptionService.ts`, `components/GemShopModal.tsx`, `components/SubscriptionModal.tsx`, `components/IAPHandler.tsx`, `components/SettingsModal.tsx`, `utils/iapConfig.ts`, `docs/IAP-SETUP.md`, `docs/REVENUECAT-SETUP.md`, and `__tests__/monetization/`. Trace `purchaseRecoverableRcProduct`, `recoverRcIntent` and `restorePurchases` before interpreting a recovery failure.

#### Native acceptance matrix

| Case | Verify |
| --- | --- |
| Catalog | All enabled products load with localized price, correct quantity and subscription duration |
| Gem/money pack | Before/after balance matches offer, repeated delivery/relaunch does not re-grant |
| Permanent unlock | Entitlement applies and survives relaunch, repeat restore repairs entitlement without quantity |
| Mixed pack | Initial purchase grants configured parts, restore recovers only eligible permanent parts |
| Revival | Native nested store/confirmation sheet opens from death, charge and revive occur at most once |
| DeepLife+ | Correct offer, duration, renewal text and price, active/expired access, restore and manage/cancel link |
| Cancel/failure | Cancel before charge, lose network, unavailable product, deferred store response produce truthful status |
| Interrupted purchase | Terminate before and after store completion, relaunch original life, recover one grant |
| Persistence failure | Controlled failed save leaves a recoverable pending state, no success claim before durable grant |
| Wrong slot/life | Switch slot or end life before recovery, no benefit goes to unrelated character |
| Repeat recovery | Tap restore/retry rapidly, replay store event, no second charge or duplicate grant |
| Reinstall | On disposable test data only, restore permanent entitlements/subscription, no replay of consumables or save slots |
| Ads removal | Paid entitlement disables the intended ads after purchase, restart and restore |

For pending rewards follow the actual support instructions: retain installation, load original character/slot, Restore Purchases, contact support before buying again. Check that each step is possible in the native UI. Reconcile any mismatch in the app and support page together.

#### Acceptance criteria and master-prompt instruction

Run every case on the candidate with real SDK callbacks. Add a behavioral regression for each reproduced code defect, then rebuild/retest affected native paths. Do not substitute mocks for StoreKit evidence, enable test purchase modes in production, or build an account backend to promise cross-device consumable recovery.

Write `tasks/release/evidence/R06-native-purchases.md`: case, product, build/device, expected/actual result, redacted evidence and unresolved defects. Close only after all required rows pass. Apply `CONTRACT.md`.


### R09: Device, lifecycle, ads and accessibility acceptance

Priority: P1. Dependency: R08. Status: blocked on native candidate and device session.

#### Inputs and source map

Use the R08 processed candidate on a supported compact iPhone and an iPad, including an older/lower-performance supported device where available. Record device model, OS version, binary/build and source SHA. Use disposable new-life data and a backed-up copy of a representative existing save.

Read `app/_layout.tsx`, `components/DeathPopup.tsx`, `components/SettingsModal.tsx`, current Home/HUD and avatar components, `services/AdMobService.ts`, `services/FirebaseAnalyticsService.ts`, `lib/ads/interstitial.ts`, and save/signing/migration code in `utils/`. Node simulator timings are not native performance measurements.

#### Required device matrix

| Area | Cases and proof |
| --- | --- |
| Startup | Cold start online/offline, background/resume, existing install upgrade, no startup/error boundary or missing native-module screen |
| Saves | Existing save migration, new slot, manual/autosave, background/terminate/relaunch, original character/cash/week retained, no cross-slot write |
| Life transitions | Death, decline, revive entry, heir continuation, relaunch after each committed transition |
| Native modals | Shop confirmation from death, stacked sheets, rapid close/reopen, keyboard inputs, safe areas and reachable primary/back buttons |
| Avatar | Child/adult/older faces, customization persistence, inherited family faces, images load in production bundle |
| ATT/ads | Allow/deny tracking, offline/no-fill, rewarded success/cancel, no reward before completion, no duplicate reward, entitlement removes intended ads |
| Analytics consent | Observe enabled SDK behavior for each consent state with approved diagnostics, reconcile actual collection with R11 |
| Accessibility | VoiceOver order/labels, Larger Text clipping, contrast, non-color status meaning, reduced motion and interactive target usability |
| Performance | Record cold-start time, week-tap responsiveness and modal latency on early and large late-life saves; compare candidate to prior build on same device |
| Stability | Repeat the above during an ordinary play session, inspect device crashes and memory-related termination evidence |

For measurements, record method, repetitions and observed distribution. Keep existing project budgets. If no device budget exists, report the measurement and observed usability rather than inventing a pass threshold after seeing the result.

#### Acceptance criteria and master-prompt instruction

Run every required case, capture visible defects before fixes and after rebuilding, and return reproduced issues to their owning package. Mocked IAP/ad callbacks and web screenshots cannot close native behavior. Missing devices/controls remain explicit unknowns. Do not label all accessibility supported from a single VoiceOver screenshot.

Write `tasks/release/evidence/R09-device.md` with per-case PASS/FAIL/UNREACHED, device/build, actions, observed result and evidence files. Close after no required case is unreached and no release blocker remains. Apply `CONTRACT.md`.


### R07: Store copy, release notes and screenshot parity

Priority: P1. Dependencies: R04, R11. Status: source preparation complete, native/store confirmation blocked.

#### Current facts and remaining problem

PR #202 is merged. Its ten-image campaign has 30 unique decoded RGB PNG exports with matching dimensions, source hashes and storyboard hashes. This structural check does not establish native parity. `marketing/aso/metadata.mjs` still targets historical store version 1.5.0, while the 9 September public audit observed 1.5.5. Its What's New text therefore must not be treated as the next release's final copy.

#### Inputs and files

- Current App Store Connect app/version/localization/build/product state, including the existing draft next version if one exists.
- `marketing/aso/metadata.mjs`, `scripts/check-aso.mjs`, `scripts/asc-release.mjs`, `WHATS_NEW.md`, `lib/config/changelog.ts`, `package.json`.
- `screenshots/player-stories-2026-09/README.md`, its `source/storyboard.json`, `source/manifest.json` and `source/verify.mjs`.
- `support-site/support.html`, `support-site/privacy.html`, `support-site/whats-new.html`, `lib/config/appConfig.ts` and `components/SubscriptionModal.tsx`.

#### Work to execute

1. Run read-only `npm run asc:status` in an environment with secure ASC credentials. Identify the live record and next editable record. Do not infer record/build identity from the public listing or set the store number equal to the binary number.
2. Diff the previously released code against the actual candidate. Write concise player-facing What's New for changes genuinely new in this release. Reconcile store copy, `WHATS_NEW.md`, in-app changelog and website release notes. Check locale-specific text too. Do not advertise already shipped fixes as new.
3. Reconcile each available locale's name, subtitle, keywords, promo text and description with the actual shipped feature/monetization behavior. Run `npm run check:aso`; generate paste-ready fields with `node scripts/check-aso.mjs --emit`. The emitter is a source snapshot, not proof of uploaded or approved fields.
4. Verify all 30 exports with `node screenshots/player-stories-2026-09/source/verify.mjs`. If Sharp is unavailable, install the locked screenshot dependencies in an appropriate tool environment. The exact locked isolated install and validator passed in this continuation.
5. Compare all ten story panels to the native candidate: Home, company, Spark, career, property/stocks, vehicles, events, creator, travel and family. Inspect the first three at actual phone viewing size and all tablet layouts. Recapture only panels that are outdated or misleading. Keep approved artwork/order unless evidence warrants a focused change.
6. Confirm screenshots upload to the accepted device slots with correct order: 6.9-inch 1320×2868, 6.5-inch 1284×2778, iPad 2064×2752. Recheck Apple's current specifications before uploading. Overview sheets are not uploads.
7. Check live support/privacy/EULA links, help and recovery text, copyright, review contact, age/content answers, encryption questions, required regional trader information and IAP attachments in ASC. Enter only owner-confirmed operational facts.

#### Acceptance criteria and master-prompt instruction

Resolve factual drift, prepare exact fields and images, then compare the resulting ASC record against the prepared packet when access is available. No new marketing-art campaign, competitor trademark stuffing or unmeasured conversion claims. Apple's Product Page Optimization tests icons, screenshots and previews, not subtitles.

Evidence: `tasks/release/evidence/R07-store.md` with actual version record, per-locale fields/counts, ten-row native parity table, uploaded order or explicit upload pending, link checks and remaining owner facts. Apply `CONTRACT.md`.


### R10: Submission packet and release decision

Priority: P1. Dependencies: R06, R07, R09. Status: blocked until candidate/device/store evidence is complete.

#### Objective and inputs

Assemble a submission-ready packet for the exact accepted build, then distinguish owner authorization, submitted status, Apple approval and publication. None of those states follows automatically from a green test suite.

Read the queue and every current evidence file, `docs/RELEASE_RUNBOOK.md`, `marketing/aso/metadata.mjs`, `WHATS_NEW.md`, `lib/config/changelog.ts`, `docs/IAP-SETUP.md`, the current ASC version record and native acceptance results.

#### Packet to complete

| Item | Required content |
| --- | --- |
| Candidate | Source SHA, binary version, build number, processed TestFlight/build record, matched latest checks |
| Release scope | Changes since last public build, known limitations, no unresolved release P0/P1 or in-scope P2 |
| Metadata | Exact store record and localized field text, aligned release notes, all required fields verified in ASC |
| Screenshots | Native-parity evidence for ten panels and correct ordered phone/tablet uploads |
| Review notes | Exact routes to Shop, DeepLife+, Restore Purchases and representative gameplay, factual purchase/recovery limits, any required test instructions |
| Contact/account | Owner-confirmed review contact, required agreements, tax/banking or regional trader status, no invented legal details |
| Privacy/content | Published policy matching candidate, recorded privacy labels/consent decisions, age/content and export-encryption answers |
| Monetization | Enabled products/entitlements, reviewed price/duration/renewal disclosures and required IAP/subscription attachments |
| Rollout | Owner-selected release method, support owner/contact, monitoring for crashes, failed saves and purchase delivery, incident response path |
| Recovery plan | Distinguish OTA-compatible JS rollback from native binary replacement, preserve save-schema compatibility and purchase ledgers |

Do not promise a review duration, a guaranteed recovery from reinstall or a guaranteed Apple approval. Do not include secrets or full customer receipts in the packet.

#### Acceptance criteria and final gate

Cross-check the packet against the actual candidate and live ASC fields. Run `npm run release:check`: it must be zero only when every package is truthfully verified. If a change invalidates prior evidence, reopen that package and repeat affected checks. Prepare the concrete submission/rollout action for the owner's decision under current authorization. Do not auto-merge solely to make the queue look finished because main publishes production OTA.

Save `tasks/release/evidence/R10-submission.md`. Report separate states: READY FOR SUBMISSION, SUBMITTED, APPLE APPROVED, PUBLISHED, each supported by its actual evidence. Stop adding optional features once the agreed release criteria pass. Apply `CONTRACT.md`.
