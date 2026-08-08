# Google Play release runbook — DeepLife Simulator

**From zero to a live, downloadable product.** Every step, in order, with the exact
values to type, the exact words to send testers, and the traps that cost a rebuild.

- **Owner of this doc:** whoever is shipping Android. Tick boxes as you go.
- **Legend:** 👤 = only you can do it (console, payments, devices) · 🤖 = a repo task
  a Claude coworker can do · ⏱️ = has a waiting period you cannot compress.
- **Scope:** Google Play only. iOS lives in `LAUNCH_CHECKLIST.md` / `IAP-SETUP.md`.
- **Supersedes** the Android half of `LAUNCH_PLAN.md` (kept for the iOS track).

> **How to read this:** Phases A–K are sequential *milestones*, but several run in
> parallel — see the critical path in §2. If you only read one section before
> starting, read **§1 (hard deadlines)** and **§9 (testers)**, because those are the
> only two things in this document that a late start cannot fix.

---

## 0. Where this project actually stands

Verified by reading the repo on 2026-08-08 (not assumed):

| Thing | State | Where |
|---|---|---|
| Package name | `com.deeplife.simulator` | `app.config.js` |
| Marketing version | `2.6.0` | `package.json` (single source of truth) |
| Expo SDK / RN | 54.0.36 / 0.81.5 → **compileSdk 36, targetSdk 36, minSdk 24** | Expo SDK 54 defaults |
| Android native folder | `android/` is committed **but `.easignore` excludes it** — EAS regenerates it from `app.config.js` via prebuild | `.easignore` |
| Build pipeline | GitHub Actions → `eas build --local` → `.aab`, zero EAS credits | `.github/workflows/eas-build-local-android.yml` |
| Auto-submit to Play | Wired, opt-in via a `Submit` checkbox + track picker | same workflow |
| Play submit config | `track: internal`, `releaseStatus: completed`, key at `./play-service-account.json` (gitignored) | `eas.json` |
| versionCode strategy | Epoch seconds via `scripts/next-build-number.mjs` — strictly increasing | workflow "Compute unique versionCode" |
| IAP | `expo-iap` 4.3.5 + RevenueCat `react-native-purchases` 10.4.4; production runs **RevenueCat on** | `eas.json` `EXPO_PUBLIC_USE_REVENUECAT=true` |
| Receipt verification | `server/iap-verify` supports Google (`androidpublisher` v3); **production fails closed without `EXPO_PUBLIC_IAP_VERIFY_URL`** | `scripts/preflight-check.js` §9 |
| Ads on Android | **Not configured** — no Android ad units; the workflow passes `--warn-missing-android-admob`, so ad-unit IDs fail closed → **Android launches ad-free** | workflow preflight step |
| Store copy | Written, EN + SV | `docs/STORE_LISTING.md` |
| Data safety answers | Written, needs your confirmation | `docs/DATA_SAFETY.md` |
| Privacy policy | Live at `https://wrexist.github.io/deeplife-sim-support/privacy.html` | `lib/config/appConfig.ts` |
| Support email | `deeplifesimulator@gmail.com` | `lib/config/appConfig.ts` |
| Discord | `https://discord.gg/rzktazdX8v` | `lib/config/appConfig.ts` — **your warm tester pool** |

**Still unknown (you must check):** whether the Play developer account exists, and
whether it is a **personal** or **organization** account. That single fact decides
whether launch is ~1 week or ~3–4 weeks away. See §9.

---

## 1. Hard deadlines — read this first ⚠️

Three Google gates. Two of them land **23 days from today**; the third is 2027.

| Deadline | Requirement | This app | Action |
|---|---|---|---|
| **Aug 31, 2026** | New apps + updates must **target Android 16 (API 36)**. Extension to Nov 1, 2026 on request. | ✅ Expo SDK 54 already targets 36 | Verify once (§4.4), then nothing |
| **Aug 31, 2026** | New apps + updates must use **Play Billing Library 8+**. Extension to Nov 1, 2026 on request. | ⚠️ RevenueCat 10.4.4 ships Billing **8.3.0**; `expo-iap` 4.3.5 pulls billing through the `openiap-google` wrapper — version **unverified** | **Verify before first upload** (§4.4). Gradle resolves to the highest requested version, so RC 8.3.0 should win — but confirm, don't assume |
| **Feb 1, 2027** | Apps targeting Android 15+ (API 35+) must support **16 KB memory page sizes** on 64-bit devices | Expected fine (RN 0.81 / AGP in SDK 54 align natively) — but **dependency versions do not prove alignment** | Verify the **artifact**, not the deps: Play Console reports it on upload, and `alignment` / `zipalign -c -P 16` over the `.so` files in the `.aab` checks it locally |

**Why this matters for sequencing:** the closed test (§9) takes a **minimum of 14
days**, and both gates above are publishing gates on *every* upload. If a build you
upload after Aug 31 is non-compliant, the upload is rejected and the 14-day clock
you already burned still ticks — but you have nothing live to test. **Verify Billing
8 before the first upload, not after.**

---

## 2. The critical path

The long pole is the 14-day closed test. Everything else fits inside it.

```
Day 0    Account + app record          ──┐
Day 0-2  Repo prep, secrets, verify BL8  ├─ do in parallel
Day 1    First .aab built + uploaded ────┘
Day 1-2  App content declarations (blocks tester installs — do it FIRST)
Day 2    Internal testing → smoke test on a real device
Day 3    Store listing + assets + IAP products live
Day 3    ── CLOSED TEST STARTS ── recruit 12 testers, all opted in ⏱️
         │
Day 17   ── 14 continuous days elapsed ──
Day 17   Apply for production access ⏱️ (Google review: typically days)
Day 20+  Production release, staged rollout 20% → 50% → 100%
```

**Anchored to today (2026-08-08), a clean run lands production access around
Aug 25–28 and a full rollout in early September.** Every day you delay recruiting
testers pushes the launch by exactly one day — the clock does not start until 12
testers are opted in *and* a build is live on the closed track.

**If the account is an organization account, delete Day 3–17 from the plan** — you
can go straight to production once the listing and declarations are done.

---

## 3. Phase A — Google Play developer account 👤

Skip to §4 if the account already exists and is verified.

### A.1 Create the account
1. Go to `https://play.google.com/console/signup`.
2. Sign in with the Google account you want to own the app **forever**. This account
   owns the app, the payments profile, and the signing keys. Use a dedicated account
   you control (not a personal address you might lose), and **turn on 2FA**.
3. Choose the account type — **this is the most consequential choice in this doc**:

| | Personal account | Organization account |
|---|---|---|
| Cost | $25 one-time | $25 one-time |
| Extra requirement | — | **D-U-N-S number** (free, but takes up to ~30 days to obtain if you don't have one) |
| Closed testing | **12 testers × 14 continuous days required** before production access (accounts created after **Nov 13, 2023**) | **Exempt** — publish straight to production |
| Verification | Identity: legal name, address, phone; Google may ask for ID | Business: D-U-N-S, legal entity name, website, org email |

   → If you already have a registered company **and** a D-U-N-S number, the
   organization account saves you 14+ days. If you don't, don't start a D-U-N-S
   application now to save 14 days — it can take longer than the test itself.
4. Pay the **$25 one-time** registration fee.
5. Complete **identity verification**. The app cannot be published until this
   clears. It is usually fast but can take days — do it on Day 0.

### A.2 Payments profile (required before any paid product)
1. Play Console → **Setup → Payments profile** → create/link a Google payments profile.
2. Enter tax information and a bank account for payouts.
3. **This is a hard blocker for IAP**: gems, DeepLife+, and Remove Ads will not load
   on any device — not even for license testers — until the merchant account is
   active. Do it before Phase F.

### A.3 Checklist
- [ ] 👤 Account created and $25 paid
- [ ] 👤 Identity/business verification **completed** (not just submitted)
- [ ] 👤 Account type recorded here: `personal` / `organization` → decides §9
- [ ] 👤 Payments profile active, tax + bank details submitted
- [ ] 👤 2FA on the owner Google account

---

## 4. Phase B — Repo and build readiness 🤖 + 👤

Everything here is doable today, in parallel with Phase A.

### 4.1 Secrets that must exist before a build

GitHub → **Settings → Secrets and variables → Actions**:

| Secret | Required? | What it is | Consequence if missing |
|---|---|---|---|
| `EXPO_TOKEN` | **Yes** | Expo access token (expo.dev → Account → Access tokens) | Workflow fails at the first gate |
| `EXPO_PUBLIC_SAVE_HMAC_KEY` | **Yes** | Save-signing key | Build is blocked, so unsigned saves cannot ship — preflight fails closed |
| `EXPO_PUBLIC_IAP_VERIFY_URL` | **Yes** | `https://<project>.vercel.app/verify` | Preflight §9 fails the build; without it production grants nothing |
| `EXPO_PUBLIC_IAP_VERIFY_TOKEN` | **Yes** | Bearer token matching the server's `IAP_SHARED_SECRET` | Verification calls rejected |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | For auto-upload | Full JSON of a Play service-account key | Only needed when you tick **Submit**; upload by hand otherwise |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | No (ad-free launch) | AdMob app ID | Ads stay off (intended for v1) |
| `EXPO_PUBLIC_ADMOB_{BANNER,INTERSTITIAL,REWARDED}_ANDROID` | No (ad-free launch) | Ad unit IDs | Ads stay off; `--warn-missing-android-admob` downgrades this to a warning |

> **Do not put real secret values in `.env`, in this doc, or in any tracked file.**
> `EXPO_PUBLIC_*` values are compiled into the JS bundle and readable by anyone who
> unzips the app — that is why the verify token is explicitly a low-value bearer
> token and the real security is server-side receipt validation. See the security
> note in `docs/IAP-SETUP.md` Part 4.

### 4.2 The Android upload keystore ⚠️ one-way door

Google signs your app with a key you can never change casually. Two keys exist:

- **App signing key** — held by Google (Play App Signing). Enrolled automatically on
  your first upload. You never touch it.
- **Upload key** — the key *you* sign the `.aab` with. **EAS holds this one.**

Steps:
1. 👤 Run `eas credentials` locally once → select **Android** → **production** →
   let EAS **generate a new keystore** (or upload an existing one).
2. `eas build --local` in CI downloads that keystore from EAS to sign the bundle,
   exactly like a cloud build would.
3. 👤 **Back it up.** `eas credentials` → Android → *Download credentials*. Store the
   `.jks` + passwords in a password manager. If you lose it and Play App Signing is
   enabled, you can request an upload-key reset from Google (annoying but survivable).
   If Play App Signing is *not* enabled, losing it means you can never update the app.
   → **Always accept Play App Signing on the first upload.**

> **Trap, specific to this repo:** the committed `android/app/build.gradle` hardcodes
> `versionCode 100`, `versionName "2.4.0"`, and signs **release with the debug
> keystore**. That folder is excluded by `.easignore`, so EAS never sees it — but
> `npm run android` (`expo run:android`) and any local `./gradlew bundleRelease`
> **do** use it. **Never produce a Play upload from the committed `android/` folder.**
> Only ship `.aab` files produced by the workflow.

### 4.3 Version bump 🤖

`package.json` `version` is the single source of truth (`app.config.js` reads it).
`versionCode` comes from the `BUILD_NUMBER` env at build time via
`scripts/next-build-number.mjs` (epoch seconds — strictly increasing, always above
any historical value, under Google's 2.1 B ceiling). You never edit a versionCode.

- [ ] 🤖 Bump `package.json` `version` for **every** build you upload (`2.6.0` →
      `2.6.1` → …). The workflow takes the version as an input and stamps it, so a
      stale `package.json` can't ship by accident — but keep them in sync anyway.

### 4.4 Verify the two Aug 31 gates ⚠️

```bash
npm install                      # a fresh clone has no node_modules
npx expo prebuild --platform android --clean   # regenerate the folder EAS will use
cd android && ./gradlew :app:dependencies --configuration releaseRuntimeClasspath \
  | grep -i billingclient
```
- [ ] 👤/🤖 Confirm the resolved `com.android.billingclient:billing` is **8.x**.
      Gradle resolves conflicts to the highest requested version, so RevenueCat's
      8.3.0 should win over anything `expo-iap`'s `openiap-google` requests.
- [ ] If it resolves **below 8**, fix it in a way that survives the build. ⚠️
      **Do not edit `android/app/build.gradle` to force it** — `.easignore`
      excludes `/android`, so EAS regenerates the whole folder via prebuild and
      your edit is discarded before compilation. It would appear to work locally
      and silently vanish in CI. Use one of these instead, in preference order:
      1. **Bump `expo-iap`** to a version whose `openiap-google` pulls Billing 8 —
         no native plumbing at all.
      2. **A config plugin** (`withAppBuildGradle`) writing the resolution
         strategy at prebuild time. The repo already has a `plugins/` directory
         for exactly this, so it is source-controlled and reruns on every build.
      Then re-verify against the **final `.aab`**, not the local tree.
- [ ] Confirm `targetSdkVersion 36` in the generated `android/build.gradle` ext block.
- [ ] **Put the folder back afterward — both commands, in this order:**
      ```bash
      git restore android && git clean -fd android
      ```
      `android/` has **44 tracked files**, and prebuild *rewrites* them (Gradle
      files, the manifest, `MainApplication.kt`, resources). `git clean` only
      deletes **untracked** files, so on its own it leaves every one of those
      rewrites staged in your working tree — exactly the accidental commit this
      step exists to prevent. `git restore` reverts the tracked edits; `git clean`
      removes the newly generated extras.

### 4.5 Green gates before you build

```bash
npm install
npm run check:routes        # expo-router collision guard — this shipped a launch crash once
npm run type-check
npm run lint:errors
npm test -- --ci
npm run preflight:android   # NOT `npm run preflight -- --platform android` (arg-order trap)
```

The workflow runs all of these itself and fails fast before the ~15-minute native
build, so a red gate costs you a minute, not an hour.

### 4.6 Receipt-verification server (Google side) 👤

`server/iap-verify` already speaks `androidpublisher` v3. For Android it needs:

```
GOOGLE_PACKAGE_NAME        = com.deeplife.simulator
GOOGLE_SERVICE_ACCOUNT_JSON = <full JSON string of the Play service-account key>
IAP_SHARED_SECRET          = <same value as EXPO_PUBLIC_IAP_VERIFY_TOKEN>
```

- [ ] 👤 Deploy (`cd server/iap-verify && vercel --prod`) and set those env vars.
- [ ] 👤 **Exercise the contract, not just the hostname.** `api/verify.js` expects a
      POST with `receipt`, `productId`, and `transactionId`, so a bare `curl` proves
      only that DNS resolves — it misses body parsing, auth, and Google
      verification. Post a deliberately bogus payload and confirm you get a
      structured `verified: false` rather than a 404/500:
      ```bash
      curl -sS -X POST "$VERIFY_URL" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $VERIFY_TOKEN" \
        -d '{"platform":"android","receipt":"REDACTED","productId":"deeplife_gems_100","transactionId":"test-000"}'
      ```
      A well-formed rejection means the endpoint is wired end to end. A 500 means
      the Google service-account env vars are wrong — find that out now, not on
      a paying customer.

### 4.7 Phase B checklist
- [ ] All required secrets set
- [ ] EAS Android keystore created **and backed up**
- [ ] Billing Library resolves to 8.x; targetSdk 36 confirmed
- [ ] Local gates green
- [ ] Verify server live with the three Google env vars

---

## 5. Phase C — Create the app in Play Console 👤

1. Play Console → **All apps → Create app**.
2. Fill in:
   - **App name:** `DeepLife Simulator` (≤30 chars — this is what users see)
   - **Default language:** English (United States) — add Swedish later (§7.4)
   - **App or game:** **Game**
   - **Free or paid:** **Free** (monetized by IAP)
   - Tick the Developer Program Policies and US export law declarations.
3. **Do not** create the app under a different package name to "test" — the package
   name is permanent and `com.deeplife.simulator` must match `app.config.js` exactly.

### 5.1 Upload the first `.aab` by hand
This repo's workflow treats the first upload as manual, and its own comments say
Google requires it. Expo's current docs disagree: `eas submit --platform android`
can create the first release directly (it lands on the internal track as a draft),
provided the app record and service-account key already exist.

Either way, **do the first one by hand** — not because the API forbids it, but
because the first upload is where you accept Play App Signing (§5.2) and where a
package-name or signing mismatch is cheapest to catch. That is why §9.1 has you
build with **Submit off** the first time. Every upload after that can auto-submit.

### 5.2 Play App Signing
On the first release Play Console asks you to configure app signing. **Accept
Google-generated app signing key** (the default). Your EAS keystore becomes the
*upload* key. This is what makes a lost upload key recoverable.

- [ ] 👤 App created with the exact package name
- [ ] 👤 Play App Signing accepted on first upload

---

## 6. Phase D — "App content" declarations 👤

**Do this before anything else in the Console.** An incomplete App content section
blocks *tester* installs, not just production — people will opt in and get "item not
found". Play Console → **Policy → App content**.

Answers for this app, derived from what it actually ships:

| # | Item | Answer | Why |
|---|---|---|---|
| 1 | **Privacy policy** | `https://wrexist.github.io/deeplife-sim-support/privacy.html` | Must cover AdMob, Firebase Analytics, Sentry, Play Billing, cloud saves. Confirm the live page does before pasting |
| 2 | **App access** | "All functionality is available without special access" | Cloud sync uses an app-generated ID; there is no login |
| 3 | **Ads** | **Yes, my app contains ads** | Answer for the build you are actually uploading, and revise it whenever that changes. For this build "Yes" is the accurate answer even though no ad units serve yet: the AdMob SDK ships and initializes, and Play auto-detects ad SDKs and may apply the "Contains ads" label regardless of what you declare. The `AD_ID` permission is in the manifest either way. If you ever ship a genuinely AdMob-free Android build, flip this to No — and flip it back before re-enabling ads (§13) |
| 4 | **Content rating** | Complete the IARC questionnaire (see §6.1) | Until this is done the app has "no rating" and **cannot be distributed to testers** |
| 5 | **Target audience and content** | Target age **18+ only** — tick no younger bracket. Answer **No** to "appeals to children" | One answer, not a range: the dark-web/crime content and the ad + IAP setup make 18+ the defensible call, and it keeps the app clear of Families policy |
| 6 | **Data safety** | Enter the table in `docs/DATA_SAFETY.md` verbatim, after confirming each row | You are attesting to accuracy; mismatches get apps suspended |
| 7 | **Financial features** | "My app doesn't provide any financial features" | The loans/stocks/crypto are simulated gameplay with no real money |
| 8 | **Government apps / Health / News** | No to all | — |
| 9 | **Advertising ID** | **Yes** — purposes: *Advertising or marketing* + *Analytics* | The manifest declares `com.google.android.gms.permission.AD_ID` |
| 10 | **Data deletion** | Provide the support email as the deletion request channel | Must match the privacy policy |

### 6.1 Content rating (IARC) — answer these honestly

The questionnaire is a legal declaration. This game contains:
- **Crime / illegal activity themes** — a dark-web marketplace (stolen accounts,
  carded items, fake IDs, hacking tools), money laundering, "heat" and police risk.
  All fictional and text-based; no instructions that work in reality.
- **Simulated gambling-adjacent content** — a stock market, crypto, lottery events.
  There is **no casino and no wagering minigame**, and **no real-money gambling**.
- **Alcohol/drug references** — check the current content before answering; if any
  exist, declare them.
- **In-app purchases** — yes. **Ads** — yes.
- **No** user-to-user communication, **no** user-generated content sharing, **no**
  location sharing, **no** unrestricted internet browser.

**You do not choose the rating — IARC derives it from the answers above**, so the
only decision you actually make is to answer honestly. Given the crime content,
expect it to land at the mature end (ESRB Teen or Mature; PEGI 12–16), which is
consistent with the 18+ target audience and the 17+ posture in
`UPDATED_PRIVACY_POLICY.md`. **Do not soften answers to chase a lower rating** — a
misdeclared rating is a suspension risk, and a higher rating costs you nothing when
you are targeting 18+ anyway. If the questionnaire returns something that looks
wrong, re-read your answers rather than re-running it until you like the result.

- [ ] 👤 All 10 App content items show **Complete** (green) on the dashboard

---

## 7. Phase E — Store listing and assets 👤 + 🤖

Play Console → **Grow → Store presence → Main store listing**.

### 7.1 Copy (already written — `docs/STORE_LISTING.md`)

| Field | Limit | Source |
|---|---|---|
| App name | 30 | `DeepLife Simulator` |
| Short description | 80 | "Start at 18 with nothing. Take loans, invest, build an empire — or go broke." |
| Full description | 4000 | The EN block in `STORE_LISTING.md` |
| Release notes | 500 | Per-release; keep the version's real changes |

Keep the DeepLife+ pitch honest ("the whole game is free; DeepLife+ is optional") —
Play's Deceptive Behavior policy covers store copy, and the in-app stance already
matches.

### 7.2 Graphic assets — exact specs

| Asset | Spec | Required |
|---|---|---|
| **App icon** | 512 × 512 px, 32-bit PNG with alpha, sRGB, ≤1 MB. Google adds rounded corners + shadow — **do not bake them in** | Yes |
| **Feature graphic** | 1024 × 500 px, JPEG or 24-bit PNG, **no alpha channel** | Yes — the listing cannot publish without it |
| **Phone screenshots** | Min **2**, max **8**. 16:9 or 9:16, min 320 px, max 3840 px on the long side, ≤8 MB each, JPEG or 24-bit PNG | Yes. For Play's promotional surfaces a **game** needs **3+ in one orientation at ≥1080 px** (apps need 4) — so 3 portrait shots clear the bar; 4–6 is still the better listing |
| **7" + 10" tablet screenshots** | Min **4** each, same format rules | **Optional.** The Android manifest declares no tablet support (the app is portrait-locked; `supportsTablet` is an iOS-only key), so skip these unless you add Android tablet support deliberately |
| **Promo video** | YouTube URL | Optional. Skip for v1 |

You already have a screenshot library under `screenshots/` and a
`SCREENSHOT_GUIDE.md`. 🤖 A coworker can frame/resize existing captures and generate
the 1024 × 500 feature graphic; 👤 you upload them.

### 7.3 Categorization
- **App category:** Games ▸ **Simulation**
- **Tags:** life sim, tycoon, economy/business (pick from Play's fixed tag list)
- **Contact details:** support email `deeplifesimulator@gmail.com`; website = the
  support site; phone optional
- **External marketing:** leave the default unless you have a reason

### 7.4 Swedish localization (optional, recommended)
The SV copy is already written in `STORE_LISTING.md`. Add **Swedish** under the
listing's language selector and paste it. Costs 10 minutes, and Sweden is your
home market and first tester pool.

- [ ] 👤 Listing text (EN) entered
- [ ] 👤 Icon + feature graphic + ≥3 phone screenshots (4–6 recommended) uploaded
- [ ] 👤 Tablet screenshots — skip unless Android tablet support is added
- [ ] 👤 Category + contact details set
- [ ] 👤 SV localization added

---

## 8. Phase F — Monetization setup 👤

**Prerequisite:** payments profile active (§A.2). Products will not load without it.

### 8.1 One-time products
Play Console → **Monetize → Products → In-app products → Create product**.

Product IDs must match the code **exactly** (`utils/iapConfig.ts`). Play does not
distinguish consumable from non-consumable at creation — the app consumes or doesn't.

**Gems and boosts (consumed in-app):**

| Product ID | Name | Price (USD) |
|---|---|---|
| `deeplife_gems_100` | 100 Gems | 0.99 |
| `deeplife_gems_500` | 500 Gems | 4.99 |
| `deeplife_gems_1000` | 1,000 Gems | 9.99 |
| `deeplife_gems_5000` | 5,000 Gems | 19.99 |
| `deeplife_gems_15000` | 15,000 Gems | 49.99 |
| `deeplife_gems_50000` | 50,000 Gems | 99.99 |
| `deeplife_gems_starter` | Starter Pack | 9.99 |
| `deeplife_gems_premium` | Premium Pack | 24.99 |
| `deeplife_gems_ultimate` | Ultimate Pack | 49.99 |
| `deeplife_gems_mega` | Mega Pack | 99.99 |
| `deeplife_youth_pill_single` | Youth Pill (Single) | 4.99 |
| `deeplife_youth_pill_pack` | Youth Pill Pack | 19.99 |
| `deeplife_money_boost` | Money Boost | 7.99 |
| `deeplife_skill_boost` | Skill Boost | 12.99 |
| `deeplife_work_boost` | Work Pay Boost | 1.99 |

**Permanent unlocks (never consumed):**

| Product ID | Name | Price (USD) |
|---|---|---|
| `deeplife_remove_ads` | Remove Ads | 2.99 |
| `deeplife_lifetime_premium` | Lifetime Premium | 79.99 |
| `deeplife_mindset` | Mindset | 1.99 |
| `deeplife_fast_learner` | Fast Learner | 1.99 |
| `deeplife_good_credit` | Good Credit Score | 1.99 |
| `deeplife_unlock_all_perks` | Unlock All Perks | 6.99 |
| `deeplife_premium_credit_card` | Premium Credit Card | 4.99 |
| `deeplife_financial_planning` | Financial Planning | 2.99 |
| `deeplife_business_banking` | Business Banking | 3.99 |
| `deeplife_private_banking` | Private Banking | 9.99 |
| `revival_pack` | Revival Pack | 2.99 |

> **Two ID traps — read twice:**
> - **`deeplife_mindset`** on Play, **not** `deeplife_mindset_perk`. The `_perk`
>   suffix is an iOS-only workaround (Apple permanently reserves deleted product
>   IDs). The code resolves the right one per platform via `Platform.select`.
> - **`revival_pack`** has **no `deeplife_` prefix**. Create it exactly as written.

Each product needs: ID, name, description, price, and status **Active**.

### 8.2 Subscriptions (DeepLife+)
Play Console → **Monetize → Subscriptions → Create subscription**.

Play's model is *subscription → base plan → offer*, which is different from Apple's:

| Subscription ID | Name | Base plan ID | Billing period | Price |
|---|---|---|---|---|
| `deeplife_premium_monthly` | DeepLife+ Monthly | `monthly` | 1 month, auto-renewing | $4.99 |
| `deeplife_premium_yearly` | DeepLife+ Yearly | `yearly` | 1 year, auto-renewing | $49.99 |

- Add a **free trial offer** (7 days) on each base plan if you offer one on iOS —
  RevenueCat reads trial eligibility from the store, not from its own dashboard.
- Set each base plan and offer to **Active**. A subscription with no active base
  plan silently returns nothing to the app.

### 8.3 Wire RevenueCat for Android ⚠️ blocker
Production runs with `EXPO_PUBLIC_USE_REVENUECAT=true`. From `docs/REVENUECAT-TODO.md`,
the Android side is **partially done**:
- [x] Android app added in RevenueCat (package `com.deeplife.simulator`)
- [x] Android public SDK key exists (`goog_…`)
- [ ] 👤 **Upload the Play service-account JSON to RevenueCat** → RC → Apps → Play
      Store app → *Service Account Credentials JSON*. **Without this, RevenueCat
      cannot validate a single Android purchase**, even with products live.
- [ ] 👤 Set `EXPO_PUBLIC_RC_ANDROID_KEY` as a build secret
- [ ] 👤 Create every product in RC → Products with the exact store IDs above
- [ ] 👤 Attach entitlements: `deeplife_remove_ads` → `ads_removed`;
      `deeplife_lifetime_premium` → `premium` **and** `ads_removed`;
      `deeplife_premium_monthly` / `_yearly` → `premium`
- [ ] 👤 Create the `default` Offering with monthly + yearly packages

### 8.4 The Play service account (used in three places)
One service account, three consumers — create it once:
1. Google Cloud Console → IAM & Admin → **Service Accounts → Create**.
2. Play Console → **Setup → API access** → link the Cloud project → **Grant access**
   to that service account. Permissions needed:
   - *Release apps to testing tracks* (for the workflow's auto-upload to
     internal/closed)
   - *View app information* and *View financial data* (for RevenueCat + verification)
   - *Release apps to production, exclude devices, and use Play App Signing* —
     **only if you intend to publish to production through the workflow.** Play
     treats this as a **separate** right from the testing-tracks one, so a service
     account holding only "release to testing tracks" builds the `.aab` fine and
     then **fails at the upload step** when §12.1 is run with `track: production`.
     Grant it up front, or deliberately withhold it and promote to production from
     the Console instead (§12.2) — withholding is the safer default, since it makes
     an accidental production push impossible.
3. Cloud Console → the service account → **Keys → Add key → JSON** → download.
4. Use that one JSON for:
   - GitHub secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (auto-upload)
   - RevenueCat's Play credentials upload (§8.3)
   - Vercel env `GOOGLE_SERVICE_ACCOUNT_JSON` (receipt verification, §4.6)
5. **Never commit it.** `.gitignore` already blocks `play-service-account.json`.

> **The one-key shortcut has a real cost — know what you're accepting.** Copying a
> single key into GitHub, RevenueCat, and Vercel means any one of those three being
> compromised hands an attacker *all* its rights, including release upload and
> financial data, and a rotation forces you to update all three at once. The
> hardened alternative is **three service accounts**, each with only what it needs:
>
> | Consumer | Needs | Doesn't need |
> |---|---|---|
> | CI auto-upload | Release to testing tracks (+ production, if used) | Financial data |
> | RevenueCat | View financial data, view app information | Any release right |
> | Receipt verification | View financial data (`androidpublisher` read) | Any release right |
>
> For a solo developer, one key is a defensible tradeoff for the reduced admin —
> just make it a *decision* rather than an accident, and split them the moment
> anyone else gets access to any of the three systems.

### 8.5 License testers (free test purchases)
Play Console → **Setup → License testing** → add the Google account emails of
everyone who will test purchases. License testers:
- see real purchase dialogs but are **never charged**,
- get renewals compressed (a monthly sub renews in minutes),
- must be the *same* Google account signed into the Play Store on the test device.

- [ ] 👤 All 26 one-time products created and **Active**
- [ ] 👤 Both subscriptions with active base plans
- [ ] 👤 RevenueCat Android credentials uploaded + products/entitlements/offering
- [ ] 👤 License testers added (include yourself)

---

## 9. Phase G — First build, internal testing, and the device smoke test

### 9.1 Build the first `.aab` 👤
GitHub → **Actions** → **"Android Play Store (local build · no cloud credits)"** →
**Run workflow**:

| Input | First build | Later builds |
|---|---|---|
| `version` | `2.6.1` (full `MAJOR.MINOR.PATCH`; bump every run) | bump each time |
| `submit` | **off** — Google requires the first upload by hand | on |
| `track` | (ignored when submit is off) | `internal` → later `alpha` (= closed) |
| `force_banner` | **off** for anything you upload | on only for local upsell QA |

The job runs routes → type-check → lint → tests → preflight → build (~15–25 min),
then publishes the `.aab` as a downloadable artifact. The workflow **refuses** to
submit a `force_banner` build to Play — that guard exists on purpose.

### 9.2 Upload it 👤
Play Console → **Testing → Internal testing → Create new release** → upload the
`.aab` → accept Play App Signing → paste release notes → **Save → Review release →
Start rollout to Internal testing**.

Internal testing is live within minutes and supports up to 100 testers. It does
**not** count toward the 14-day closed-testing requirement — it is purely your own
smoke-test lane.

### 9.3 The smoke test — do this on a real Android device before recruiting anyone

Add your own account to the internal testers list, open the opt-in link, install
from Play, then verify:

- [ ] App launches — no white screen, no crash on cold start
- [ ] Onboarding → create a character → play 10+ weeks
- [ ] **Save/load:** force-quit mid-life, relaunch, save restores intact
- [ ] Cloud sync round-trips
- [ ] **Store opens** from every entry point (HUD Shop pill, gem chip, death popup,
      Settings) and **shows real prices in your local currency**
- [ ] Buy `deeplife_gems_100` as a license tester → gems credited **once**
- [ ] Buy `deeplife_remove_ads` → ads/upsells stop
- [ ] Subscribe to `deeplife_premium_monthly` → DeepLife+ unlocks
- [ ] **Restore Purchases** after a reinstall → non-consumables return, gem packs
      correctly do **not**
- [ ] Kill the app mid-purchase, relaunch → the transaction completes **exactly once**
- [ ] **Ads are absent and nothing breaks** — Android ships ad-free; confirm the ad
      orb degrades gracefully (the no-fill courtesy grant path) instead of hanging
- [ ] **Android back button** behaves on every modal
- [ ] Rotate/resize checks on a tablet if you claim tablet support

If the store shows "Store unavailable" or products are missing: payments profile
inactive (§A.2), products not Active (§8.1), the account isn't a license tester
(§8.5), or RevenueCat has no Play credentials (§8.3). Those four cover ~95% of cases.

---

## 10. Phase H — Closed testing: 12 testers × 14 days ⏱️

**Applies only if the account is personal and was created after Nov 13, 2023.**
Check Play Console → Dashboard; if the requirement applies, there's a card telling
you so, and "Production" stays locked.

### 10.1 The rule, precisely
- **12 testers minimum**, opted in **continuously for at least 14 days**.
- The clock starts when a build is **live on a closed track** *and* the testers are
  opted in — not when you create the track.
- **Internal testing does not count.** It must be a **closed** track.
- **Treat a drop below 12 as breaking the streak.** Google's wording is 12 testers
  opted in "for the last 14 days continuously", and a tester who opts out does not
  carry their earlier days into a later stretch. Community reports differ on whether
  a brief dip merely pauses the count or resets it — which is exactly why you should
  not find out. Keep **15–18** opted in, and re-check the live count in the Console
  immediately before you apply.
- Google looks at whether testing was *real*. Opted-in accounts that never open the
  app are the most common reason production access gets denied.

### 10.2 Set up the track (do this once)
1. Create a **Google Group** (e.g. `deeplife-android-testers@googlegroups.com`).
   Use a group, not a raw email list — you can add/remove testers **without a new
   release**, which matters when someone drops on day 9.
2. Play Console → **Testing → Closed testing → Create track** (or use the default
   "Alpha") → **Testers** tab → add the Google Group address.
3. Create a release on that track with the same `.aab` (or promote the internal one).
4. **Countries/regions:** include Sweden, the US, the UK, and anywhere your testers
   live. A tester in an excluded country gets "item not found" and silently never
   counts.
5. Copy the **opt-in URL** (Testers tab → "Copy link"). It looks like
   `https://play.google.com/apps/testing/com.deeplife.simulator`.

### 10.3 Where to actually find 12 testers

Ranked by how well they work in practice:

| Source | Realistic yield | Notes |
|---|---|---|
| **Your existing iOS TestFlight testers** | 3–6 | Warmest list you have — they already play the game. Ask who owns an Android phone. `docs/testflight_feedback/` is your contact trail |
| **Your Discord** (`discord.gg/rzktazdX8v`) | 3–8 | Already-engaged players. Highest-quality feedback of any source |
| **Friends, family, coworkers** | 4–8 | Each needs their **own Google account** and an Android device (an emulator with Play Services works but gives you nothing useful) |
| **Reddit** — r/AlphaandBetaUsers, r/androidapps, r/playtesters, r/lifesimulators | 2–6 | Post genuinely, not as an ad. Offer to test theirs back |
| **Mutual-testing groups** (Discord/Telegram "closed testing exchange" servers) | 8–12 | Reliable for *numbers*. You test their app, they test yours. Feedback quality is low |
| **Paid tester services** | 12+ | Fast and it works, but Google has denied production access when testing looks purchased and unengaged. If you use one, **also** recruit real players, and answer §11's questions honestly |
| **Local university / gaming groups / Twitter-X, TikTok followers** | varies | Slow, but real players |

**Recommendation for this app:** Discord + iOS testers + friends gets you to ~12 with
people who will actually give you feedback worth reading. Top up with one mutual-
testing group if you're short. Aim for **15–18** so a dropout never puts you under.

### 10.4 What to say — copy/paste templates

**A. Discord announcement (pin it):**

> **📱 DeepLife Simulator is coming to Android — I need 12 testers**
>
> The Android version is ready for closed testing, and Google requires 12 people
> opted in for 14 straight days before I can publish it. If you've got an Android
> phone and 10 minutes, you'd genuinely unblock the launch.
>
> **What you need to do:**
> 1. **DM me** (please don't post it in the channel) with the **Google account
>    email** you use on your phone — it has to be the exact account signed into the
>    Play Store. I'll only use it to add you as a tester, and I delete it when the
>    test ends.
> 2. I'll add you, then send you a link. Tap **"Become a tester"**, then install.
> 3. Play for a bit whenever you feel like it over the next two weeks. Please don't
>    uninstall or leave the tester program before **[DATE = start + 15 days]** — that
>    resets things on my side.
>
> **What you get:** the full game free, early access to everything, your name in the
> credits if you want it, and my genuine thanks. Bugs and "this bit is confusing"
> notes are worth more to me than compliments.

**B. Personal DM / email:**

> Hey [name] — I'm launching DeepLife Simulator on Android and Google makes you run
> a 14-day test with 12 people before you're allowed to publish. Would you be one of
> them?
>
> It's about 3 minutes of setup: send me the Google account email on your Android
> phone, I add you, you tap a link, and install from the Play Store like any app.
> Then just play whenever — and stay opted in for two weeks so the count holds.
>
> Totally free, no charges of any kind. Really appreciate it.

**C. Reddit post (r/AlphaandBetaUsers style — include a screenshot):**

> **[Android] DeepLife Simulator — life sim with a real economy. Need closed testers
> (14 days), happy to test yours back.**
>
> I've spent [X] months building a life simulator where the economy actually
> simulates: you start at 18 broke, take loans with real interest, work careers,
> invest, build a family and a multi-generation legacy. It's live on iOS; Android is
> the last step, and I need 12 testers for Google's 14-day requirement.
>
> Free, no ads on Android right now, and everything is unlocked for testers.
> **DM me your Google account email** (don't post it publicly — comment "in" and
> I'll message you) and I'll add you. Used only to add you as a tester, deleted
> when the test ends. **I'll opt into your test too** — just link it.

**D. The instructions you send after adding someone** (this is the message that
actually determines whether they succeed — be this explicit):

> You're added! Three steps:
>
> 1. On your Android phone, make sure you're signed into the Play Store with
>    **[their email]**.
> 2. Open this link and tap **"Become a tester"**:
>    `https://play.google.com/apps/testing/com.deeplife.simulator`
> 3. Tap **"Download it on Google Play"** on the same page and install.
>
> If it says "item not found", wait ~15 minutes (Google's propagation) and try again;
> if it still fails, tell me — it's usually a country setting on my end.
>
> Please stay opted in until **[DATE]**. After that, uninstall freely — it won't
> affect anything.
>
> Anything you notice — crashes, confusing screens, prices that look wrong, anything
> boring — send it to me here or to deeplifesimulator@gmail.com. Screenshots welcome.

**E. Day-7 nudge (send it — this is what keeps your count from decaying):**

> Halfway through the test 🎉 Quick check: are you still opted in? (Play Store →
> your app → it should still show under the tester program.) One week left.
>
> If you've played at all: what's the single most confusing thing you hit? That's
> the most useful sentence you can send me.

**F. Swedish version of D** (your home market):

> Du är tillagd! Tre steg:
> 1. Se till att du är inloggad i Play Store med **[deras e-post]** på din Android.
> 2. Öppna länken och tryck **"Bli testare"**:
>    `https://play.google.com/apps/testing/com.deeplife.simulator`
> 3. Tryck **"Ladda ner på Google Play"** och installera.
>
> Stanna kvar som testare till **[DATUM]**. Hör av dig om något kraschar, känns
> förvirrande eller bara tråkigt — det är det mest värdefulla du kan skicka mig.

### 10.5 Track your testers

These are real people's account identifiers, so treat the sheet accordingly:
**collect only the email Play needs** (never phone numbers or addresses), keep it
in a **private, access-restricted** doc rather than a shared channel, and **delete
the emails once the test ends** or a tester asks to be removed. Collect them by DM
or a private form — never in a public Discord or Reddit thread.

Keep a simple sheet — you will need these facts for the production-access
application in §11:

| Name | Google account | Source | Opted in (date) | Installed? | Feedback given | Still in on day 14? |
|---|---|---|---|---|---|---|

### 10.6 During the 14 days
- [ ] 👤 **Recommended, not required:** ship at least one update to the closed track
      that fixes something a tester reported. Eligibility is only the 12 testers ×
      14 continuous days — but the production-access form asks what feedback you got
      and what you changed, and a real answer there is often the difference between
      approval and "more testing required". Pushing updates does **not** restart the
      14-day clock, as long as the tester count holds.
- [ ] 👤 Reply to every tester who reports something. Retention of testers is the
      whole game here.
- [ ] 👤 Watch **Play Console → Quality → Android vitals** for crashes and ANRs.
- [ ] 👤 Do **not** let the track go empty or the release become inactive.
- [ ] 🤖 Fix reported bugs, bump the version, rebuild, and this time tick **Submit**
      with track `alpha` — the auto-upload works now that the first build was manual.

---

## 11. Phase I — Apply for production access 👤 ⏱️

After 14 continuous days with 12+ testers, Play Console → **Dashboard** (or the
testing requirement card) → **Apply for production access**.

Google asks roughly 10 questions. Answer each in ~250–300 characters, specific and
truthful. Vague answers are the most common denial reason.

**The questions, and how to answer them for this app:**

| Question | What to write |
|---|---|
| *How did you recruit testers?* | Name the real channels: "Existing players from our Discord community and our iOS TestFlight testers, plus friends who play life-sim games. I messaged each personally with install instructions and stayed in contact through the test." |
| *What feedback did you get?* | Concrete, quoted examples. "Testers reported [X] was confusing on first launch, that the [Y] screen's text was too small on smaller phones, and one crash when [Z]." Have 3 real items ready — this is why §10.5 exists |
| *How did you act on it?* | Name the change and the version. "We shipped 2.6.2 to the closed track fixing the [Z] crash and enlarging the [Y] text after tester reports." |
| *What did you change as a result of testing?* | Same as above, one level broader — UX changes, bug fixes, balance changes |
| *How was your app tested?* | Devices/Android versions covered, what areas were exercised (onboarding, save/load, purchases, long sessions) |
| *Is your app ready for production?* | Yes, with a one-line reason: stable on the closed track, no outstanding crashes in Android vitals, store listing and purchases verified |
| *How easy was it to recruit testers?* | Answer honestly — this one is Google gathering data on its own policy, not grading you |
| *Anything else?* | Mention the app is already live on iOS and this is the Android port, if true. It signals a real product |

**Review time:** typically a few days; Google says it can take up to about a week.
If denied, the message names what was insufficient — usually "testers weren't
sufficiently engaged". The fix is another test period with more genuine activity,
so build engagement in from day 1 rather than hoping.

- [ ] 👤 Applied
- [ ] 👤 Approved (production track unlocks)

---

## 12. Phase J — Production release 👤

### 12.1 Pre-flight for the release build
- [ ] 🤖 Bump `package.json` version (e.g. `2.7.0`)
- [ ] 🤖 `npm run preflight:android` green
- [ ] 🤖 Release notes written (≤500 chars) — update `RELEASE_NOTES.md` / `WHATS_NEW.md`
- [ ] 👤 Run the workflow with **Submit on**, track `production`, `force_banner`
      **off** — this requires the *Release apps to production…* permission on the
      service account (§8.4); without it the build succeeds and the upload fails.
      **Safer alternative:** run it with track `internal` (or download the artifact)
      and **promote to production from the Console**, which needs no extra API right

### 12.2 Configure the release
Play Console → **Production → Create new release**:
- **Countries/regions:** start with all countries, or Sweden + US + UK + EU if you
  want a soft launch you can react to
- **Release notes:** per language (EN + SV)
- **Staged rollout:** start at **20%**. Watch Android vitals for 24–48 h → **50%** →
  **100%**. A staged rollout is the only way to halt a bad release before it reaches
  everyone

### 12.3 First-review expectation
The first production release of a new app goes through Google review — plan for
**up to 7 days**, sometimes hours. Subsequent updates are usually much faster.

### 12.4 Launch-day checks
- [ ] Store listing renders correctly on the live page (`PLAY_STORE_URL` in
      `lib/config/appConfig.ts` already points at it)
- [ ] Install from the public listing on a device that was never a tester
- [ ] Make one **real** (not license-tester) purchase and confirm it grants, then
      refund yourself from Play Console if you want the money back
- [ ] Confirm the privacy policy URL resolves
- [ ] Announce on Discord, and to your iOS players

---

## 13. Phase K — After launch

### 13.1 Watch these numbers, in this order
| Metric | Where | Threshold that means "act now" |
|---|---|---|
| **Crash rate** | Play Console → Android vitals | >1.09% user-perceived crashes = "bad behavior" threshold; Play can demote your listing |
| **ANR rate** | Android vitals | >0.47% user-perceived ANRs = same |
| Ratings & reviews | Play Console → Ratings | Reply to every 1–2★ review; it measurably lifts the score |
| Sentry crash-free rate | Sentry | Your earlier warning system than Play's |
| IAP conversion | RevenueCat | Compare with iOS to spot a broken Android purchase path |

### 13.2 Turn on Android ads (deliberately deferred)
Android launches **ad-free** because no Android ad units exist. When you want ads:
1. 👤 AdMob → create the Android app (App ID already referenced:
   `ca-app-pub-2286247955186424~3290819490`) → create **banner**, **interstitial**,
   and **rewarded** units.
2. 👤 Add secrets `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`,
   `EXPO_PUBLIC_ADMOB_{BANNER,INTERSTITIAL,REWARDED}_ANDROID`.
3. 🤖 Remove `--warn-missing-android-admob` from the workflow's preflight step so
   missing Android ad units become a **blocking** check again (PR it once the units
   exist — not before, or every build fails).
4. 👤 AdMob → app settings → set the **maximum ad content rating** to match your
   IARC rating, so ad content never exceeds what the store says.
5. Ship it as a normal versioned update. Your Data safety and Ads declarations
   already say "contains ads", so nothing in the Console changes.

### 13.3 Update cadence
- Keep shipping. Play's algorithm rewards recency, and the store listing shows the
  last-updated date.
- Every update: bump `package.json`, run the workflow, staged rollout.
- **Every upload after Aug 31, 2026 must target API 36 and use Billing 8+** — this is
  a permanent condition now, not a one-time gate.

---

## 14. Troubleshooting — the failures that actually happen

| Symptom | Cause | Fix |
|---|---|---|
| Tester link says "item not found" | App content incomplete (esp. content rating), tester's country excluded, wrong Google account, or <15 min since rollout | §6, §10.2 step 4 |
| Store shows "Store unavailable" / no products | Payments profile inactive, products not Active, or RevenueCat missing Play credentials | §A.2, §8.1, §8.3 |
| Purchases don't grant in production | `EXPO_PUBLIC_IAP_VERIFY_URL` unset or the server lacks `GOOGLE_SERVICE_ACCOUNT_JSON` — the app fails **closed** by design | §4.6 |
| Upload rejected: "versionCode already used" | Reused build number | Nothing to do — `next-build-number.mjs` uses epoch seconds; just rebuild |
| Upload rejected: target API level | Built from the stale committed `android/` folder | Build only via the workflow (§4.2 trap) |
| Upload rejected: Billing Library version | `expo-iap`'s billing transitive resolved below 8 | §4.4 |
| Upload rejected: 16 KB page size | A native dep not rebuilt for 16 KB | Update the dep; RN 0.81 itself is fine |
| Release blocked: "declaration required" | An App content item is incomplete | §6 — all 10 must be green |
| Production access denied | Testers looked unengaged | More genuine testers, real feedback loop, honest answers (§11) |
| Build succeeds, then the **production** upload fails with a permission error | The service account has *Release to testing tracks* but not *Release apps to production…* — Play treats them as separate rights | §8.4, or promote from the Console instead |
| Regenerated native files show up in `git status` after a prebuild check | `git clean` only removes untracked files; prebuild **rewrites** the 44 tracked ones | `git restore android && git clean -fd android` (§4.4) |
| Workflow fails at "Require EXPO_TOKEN" | Secret missing | §4.1 |
| Workflow refuses to submit | `force_banner` + `submit` both ticked | Untick one — the guard is intentional |
| App suspended after launch | Data safety mismatch, or a declaration that doesn't match shipped behavior | Re-audit §6 against the actual build |

---

## 15. Master checklist (one screen)

**Account** — [ ] created · [ ] verified · [ ] payments profile active · [ ] type known
**Repo** — [ ] secrets set · [ ] keystore created + backed up · [ ] Billing 8 verified · [ ] targetSdk 36 verified · [ ] gates green · [ ] verify server live
**Console setup** — [ ] app created · [ ] Play App Signing accepted
**Declarations** — [ ] all 10 App content items green
**Listing** — [ ] copy · [ ] icon · [ ] feature graphic · [ ] ≥3 portrait screenshots at ≥1080 px · [ ] category · [ ] SV
**Monetization** — [ ] 26 products Active · [ ] 2 subscriptions with base plans · [ ] RevenueCat Play credentials · [ ] license testers
**Internal test** — [ ] build uploaded · [ ] smoke test passed on a real device
**Closed test** — [ ] Google Group · [ ] track live · [ ] countries set · [ ] 12+ testers opted in · [ ] day-7 nudge sent · [ ] a tester-driven fix shipped · [ ] 14 days elapsed
**Production access** — [ ] applied with specific answers · [ ] approved
**Launch** — [ ] release created · [ ] staged 20% → 50% → 100% · [ ] verified on a clean device · [ ] announced
**After** — [ ] vitals watched · [ ] reviews answered · [ ] ads enabled (optional)

---

## 16. Related docs

| File | What it has |
|---|---|
| `docs/STORE_LISTING.md` | Listing copy, EN + SV |
| `docs/DATA_SAFETY.md` | The exact Data safety answer set |
| `docs/IAP-SETUP.md` | Product catalog + verify-server deployment |
| `docs/REVENUECAT-TODO.md` | RevenueCat manual steps (Android is the open one) |
| `docs/RELEASE_SECRETS.md` | Secret and keystore handling |
| `docs/LAUNCH_CHECKLIST.md` | Cross-platform code-vs-console status |
| `SCREENSHOT_GUIDE.md` | Capturing and framing store screenshots |
| `.github/workflows/eas-build-local-android.yml` | The build+submit pipeline |
