# Launch checklist — iOS App Store + Android Play Store

A pre-launch audit of what's already handled **in code/config** vs. what still
needs doing **in the consoles**. Code-side items were verified against the repo
at the time of writing; console-side items can't be checked from the repo, so
they're left as boxes for you.

> Secrets/keystore setup lives in [`RELEASE_SECRETS.md`](./RELEASE_SECRETS.md).
> Build steps live in the two workflows under `.github/workflows/`.

## 🚀 Releasing v2.8.0 (character revamp) — the exact remaining steps

Repo-side state, verified 2026-08-12:

| Gate | Result |
|---|---|
| `npm test` | 534 suites, **6 742 passed**, 1 skipped, 0 failed |
| `npm run type-check` | clean |
| `type-check:tests:ratchet` | 0 errors, baseline 0 |
| `lint:ratchet` | 0 errors, 1 191 warnings (ceiling 1 193) |
| `check:routes` | 17 routes, no conflicts |
| **Real iOS production bundle** | **`expo export:embed` succeeds — 3 901 modules, 8.97 MB** |
| `npm run preflight` | fails on §8 and §9 **only**, and only because the two secrets in step 1 are absent here |

The bundle line matters more than usual this release. Preflight §4 is a syntax
check that explicitly defers real bundling, and this repo has shipped a
production-only bundle crash before (the `React.lazy` incident, CLAUDE.md §5).
The avatar rewrite added a new runtime dependency, so the full export was run
rather than trusted — including a check that only `@dicebear/avataaars` is in
the bundle and not the 30-style barrel.

What is left needs credentials or hardware that do not live in the repository.
In order:

**1. Set the two EAS secrets** (~2 min) — without these the build refuses every
purchase and every save. Commands are in
[`RELEASE_SECRETS.md`](./RELEASE_SECRETS.md); values come from the RevenueCat
dashboard and `openssl rand -hex 32`.

```bash
eas env:create --scope project --name EXPO_PUBLIC_RC_IOS_KEY \
  --value appl_XXXX --environment production --visibility sensitive
eas env:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value <64-hex-chars> --environment production --visibility sensitive
```

> ⚠️ Rotating `EXPO_PUBLIC_SAVE_HMAC_KEY` invalidates the signature on every
> existing save. Set it once and never change it.

**2. Confirm preflight passes with the real environment** (~3 min)

```bash
npm run preflight; echo "EXIT: $?"
```

**Check the exit code, not the banner.** `npm run preflight` is five commands —
`check:routes && preflight-check.js && lint:errors && lint:ratchet &&
check:content` — and the cheerful `✅ ALL PREFLIGHT CHECKS PASSED` box belongs
to the *second* of them. A later step can fail underneath a green banner; that
happened during v2.7.0 development and went unnoticed for several commits. Only
`EXIT: 0` means the whole chain passed.

§9b now checks the analytics pipeline — `EXPO_PUBLIC_ENABLE_FIREBASE=true` is
already in `eas.json` production, so this release ships with a working funnel
and no server to run.

**3. Bump the version, then build and submit** (~40 min, mostly waiting).
`package.json` is at `2.8.0`. Per CLAUDE.md §9 the binary version must climb
before every TestFlight build, so raise it if `2.8.0` has already been uploaded.
The iOS build number comes from `BUILD_NUMBER` at build time, so nothing else
in code changes.

> ⚠️ **If you build LOCALLY (`eas build --local`), clear the Metro cache first.**
> Metro caches the *transformed* module, `EXPO_PUBLIC_*` inlining included. A
> build made after setting a secret can still bake in the value the variable had
> on a previous run — the bundle ends up with
> `EXPO_PUBLIC_SAVE_HMAC_KEY: void 0`, and the shipped app refuses **every save
> and every purchase** while the environment looks perfectly configured.
> Preflight cannot see this: it checks the environment, not the bundle.
>
> This bit us during v2.7.0 development and looked exactly like "Metro won't
> inline this variable" — it is not, the inlining works. Cloud EAS builds run in
> a fresh container and are not affected. To verify a local bundle actually
> carries the key:
>
> ```bash
> npx expo export --platform web --clear --output-dir /tmp/verify
> grep -rl "$EXPO_PUBLIC_SAVE_HMAC_KEY" /tmp/verify/_expo/static/js/web/ | head -1
> ```
>
> One matching file = inlined. No match = you are about to ship a build that
> cannot save.

**4. Paste the store metadata** (~10 min) — fields and verified counts are in
[`../marketing/aso-v2.7.0-paste-ready.md`](../marketing/aso-v2.7.0-paste-ready.md).
Re-read it first: it was written for v2.7.0 and its screenshot captions describe
Story Mode, which has since been retired.

> The subtitle change is the highest-value item on this list. It is **indexed
> for search**, and the current one contains zero searchable keywords. The
> funnel data says taps run at 2.4× the Games benchmark while the page converts
> at 0.6× — fixing the page is worth roughly **+65% installs at flat spend**.

**5. Recapture EVERY screenshot and the app preview on a device** (~30 min).

> **This is a release blocker for v2.8.0, not the usual nice-to-have.** Every
> character face in the app changed. The screenshots currently on the store
> show the old rendered portraits, which no build will ever produce again —
> that is a direct **App Store Guideline 2.3.3** violation ("screenshots must
> accurately reflect the current version"), and it is the kind Apple actually
> rejects for, because the difference is obvious at a glance.
>
> Both stores need it: App Store Connect and Google Play.

Shot list is in the same file. These need a real device or simulator — the web
build runs a weekly tick far slower than native.

**6. Replace the placeholder social preview image** in App Store Connect (~2 min)
— every share of the App Store link currently renders an Apple placeholder.

**7. Submit a featuring nomination** (~15 min) — solo developer, rebuilt the
in-game economy from player feedback, no forced ads, no pay-to-win. Free, and
Apple editorial actively looks for that story.

**Do NOT raise the App Store Connect version to match the binary.** Store
versions only ever increase, so setting the record to 2.7.x permanently
abandons the 1.x line. See `CLAUDE.md` §9.

---

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
