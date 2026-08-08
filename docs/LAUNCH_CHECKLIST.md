# Launch checklist — iOS App Store + Android Play Store

A pre-launch audit of what's already handled **in code/config** vs. what still
needs doing **in the consoles**. Code-side items were verified against the repo
at the time of writing; console-side items can't be checked from the repo, so
they're left as boxes for you.

> Secrets/keystore setup lives in [`RELEASE_SECRETS.md`](./RELEASE_SECRETS.md).
> Build steps live in the two workflows under `.github/workflows/`.

## ✅ Handled in code / config (verified)

- **App identity** — bundle id / package `com.deeplife.simulator`
  (`app.config.js`), version from `package.json` (single source of truth),
  iOS `buildNumber` / Android `versionCode` from the `BUILD_NUMBER` env at build
  time (auto-incremented in the workflows, so no duplicate-`versionCode`
  rejection).
- **Android permissions** — `INTERNET`, `ACCESS_NETWORK_STATE`,
  `com.google.android.gms.permission.AD_ID` (AdMob + Data-safety), and
  `com.android.vending.BILLING` (IAP) (`app.config.js`).
- **iOS ATT** — `expo-tracking-transparency` plugin provides
  `NSUserTrackingUsageDescription`; `ITSAppUsesNonExemptEncryption:false` set.
  The purpose string must state how the data is used **and** give a concrete
  example — Expo's boilerplate ("This identifier will be used to deliver
  personalized ads to you.") was rejected by App Review's automated scan as a
  placeholder. `scripts/preflight-check.js` §5c fails the build on that shape.
- **AdMob** — plugin wired with `iosAppId` / `androidAppId`; Firebase
  (`@react-native-firebase/app`) configured for revenue attribution.
- **IAP product IDs** — consistent between app and stores (`utils/iapConfig.ts`,
  `lib/subscription/`): gems `deeplife_gems_{100,500,1000,5000,15000}`,
  subscriptions `deeplife_premium_{monthly,yearly}`, one-time
  `deeplife_lifetime_premium`, plus Remove-Ads.
- **Config gate** — `scripts/preflight-check.js` runs in both build workflows and
  fails closed on missing save-signing / IAP-verification / malformed ad-unit
  config.
- **Support/legal URLs** — privacy policy + support email set in
  `lib/config/appConfig.ts`.

## ☐ Do in Google Play Console (Android)

> Full step-by-step runbook (with the exact console answers, the product table,
> the tester-recruitment playbook and the production-access application):
> [`GOOGLE_PLAY_RELEASE_PLAN.md`](./GOOGLE_PLAY_RELEASE_PLAN.md). The list below
> is the short status view.

- [ ] **First `.aab` uploaded manually** — Google requires the very first upload
      by hand; the workflow's auto-submit only works afterward.
- [ ] **14-day closed testing** — if this is a **personal** developer account
      created after **November 13, 2023**, Google requires a closed test with
      **at least 12 testers opted in continuously for 14 days** before you can
      request production access. Start early; internal testing does **not**
      count toward it.
- [ ] **Android AdMob ad units** — not created yet. The Android build runs with
      `--warn-missing-android-admob`, so **ads won't serve on Android** until you
      create the units, set `EXPO_PUBLIC_ADMOB_{BANNER,INTERSTITIAL,REWARDED}_ANDROID`
      + `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` repo secrets, and drop that flag.
      (Fine to launch Android ad-free first.)
- [ ] **IAP products created & Active** in Play Console with the exact IDs above,
      or purchases fail in the live build.
- [ ] **Store listing** — title, description, screenshots, **1024×500 feature
      graphic** (see the DeepLife+ asset prompts), icon.
- [ ] **Declarations** — Data safety, Content rating, Target audience & content,
      App access, Privacy policy URL, Ads declaration.

## ☐ Do in App Store Connect (iOS)

- [ ] **IAP products created & Active** with matching IDs (and subscriptions in a
      subscription group), submitted for review with the build.
- [ ] **App Privacy** questionnaire (tracking = yes, since ATT/AdMob).
- [ ] **Store listing** — screenshots, description, keywords, support/marketing
      URLs, age rating.

## 🧪 Verifying the DeepLife+ upsell before launch

The banner/badge/pill **hide for premium accounts** by design. To verify them on
your own (premium) account in an internal build, run the Android workflow with
**`force_banner` ticked** (bakes `EXPO_PUBLIC_FORCE_DEEPLIFE_UPSELL=true`). That
build is **QA-only** — the workflow refuses to submit it to Play. Ship real
releases with the flag off.
