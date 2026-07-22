# RevenueCat Launch Checklist — Manual Steps

Everything in the code has been wired up. The tasks below **cannot be done in code** — they require dashboard access, store consoles, or secret management. Work through them in order before submitting a production build.

---

## 1. RevenueCat Dashboard Setup

Go to [app.revenuecat.com](https://app.revenuecat.com) and complete the following.

### 1a. Create the Project — ✅ DONE

- [x] Project "Deep Life Simulator" created (`app.revenuecat.com/projects/467799e3`)
- [x] iOS public SDK key noted (`appl_...`) — set as `EXPO_PUBLIC_RC_IOS_KEY`
- [x] Android public SDK key noted (`goog_BrIGxOTsfwxfgaSOOMsEkVhWTWa`) — still needs to be set as `EXPO_PUBLIC_RC_ANDROID_KEY` (see §4)

### 1b. Connect App Store Connect (iOS) — ✅ DONE

- [x] iOS app added in RC → Apps (Bundle ID: `com.deeplife.simulator`, matches `app.config.js` — the old doc reference to `com.isakmolin.deeplifesimulator` was stale/wrong)
- [x] App Store Connect API Key uploaded, credentials show "Valid"

### 1c. Connect Google Play (Android) — ✅ DONE, pending Google propagation

- [x] Android app added in RC → Apps (package `com.deeplife.simulator`)
- [x] Reused the existing `revenuecat-validator@dynasty-manager-491122.iam.gserviceaccount.com` service account (previously only scoped to another app) and granted it **Deep Life Simulator** app permissions in Play Console → Users and permissions: "View app information (read-only)" + "View financial data" — saved and confirmed (shows 3 permissions).
- [x] Generated a fresh JSON private key for that service account via Google Cloud Console → IAM & Admin → Service Accounts → Keys → Add key → Create new key (JSON).
- [x] Uploaded that JSON file to app.revenuecat.com → Apps → Deep Life Simulator (Play Store) → Service Account Credentials JSON — saved successfully.
- [x] Confirmed the Google Play Android Developer API (`androidpublisher.googleapis.com`) is Enabled on the `dynasty-manager-491122` Google Cloud project (required alongside the Play Console permissions).
- [ ] RC currently shows "Credentials need attention" on this app — expected right after a fresh permission grant + key upload. RC's own tip: **wait up to 36 hours for Google to propagate the permission change**, then it should self-resolve (verify by retrying with a recent sandbox purchase once a build exists). No further action needed unless it's still failing after that window — if so, re-check the exact permission names in Play Console match "View app information and download bulk reports (read-only)" and "View financial data, orders, and cancellation survey responses".
- [ ] (Optional, not blocking) RC also flagged **Google developer notifications (real-time purchase events)** as unconfigured — needs separate Pub/Sub API access for this same service account if you want real-time webhooks instead of polling. Not required for purchases to validate.

### 1d. Create Entitlements — ✅ DONE

Both entitlements exist exactly as below (casing matters — the code checks them by name):

| Identifier | Display Name | Purpose |
|---|---|---|
| `premium` | DeepLife+ / Premium | Grants `hasPremiumAccess()` → unlocks all premium game content |
| `ads_removed` | Remove Ads | Drives `settings.adsRemoved` → hides all ads |

### 1e. Create Products in RevenueCat (iOS) — ✅ DONE

Verified directly in the RevenueCat dashboard: the `premium` and `ads_removed` entitlements are already attached to the real App Store Connect products (`deeplife_premium_monthly`, `deeplife_premium_yearly`, `deeplife_remove_ads`, `deeplife_lifetime_premium`, etc.) — no manual product creation needed here for iOS.

Note: the RC project also has a leftover "Deep Life Simulator Pro" **Test Store** entitlement and ~10 Test-Store-only packages in the `default` offering from earlier experimentation. These are harmless (the app's purchase code looks up non-subscription products directly by store ID, bypassing the offering entirely — see `RevenueCatService.ts`), but they're dashboard clutter worth deleting eventually.

Android products still need to be created in Play Console (§3) and then imported/attached here (§3d) — that part remains outstanding.

### 1f. Create the Default Offering — ✅ DONE for iOS, ⚠️ Android pending

- [x] `default` offering exists with Monthly/Annual packages correctly attached to the real iOS subscription products, with 7-day free trials configured in App Store Connect.
- [ ] Once Android subscription products exist (§3a) and are imported (§3d), add Android Monthly/Annual packages to this same `default` offering alongside the iOS ones.

---

## 2. App Store Connect Setup (iOS)

### 2a. Create All IAP Products — ✅ DONE (verified July 2026)

Confirmed directly in App Store Connect → Deep Life Simulator → Distribution → Monetization:
- **24 In-App Purchase products already Approved**, covering the consumables/non-consumables list below.
- **2 drafts still need finishing and submitting**: `deeplife_gems_50000` and `deeplife_mindset_perk`.
- A **"DeepLife+" subscription group already exists** with both `deeplife_premium_monthly` and `deeplife_premium_yearly` configured.

Full reference list (for confirming nothing was missed / for the Android equivalents in §3b):

**Subscriptions** (Auto-Renewable):
- `deeplife_premium_monthly` — $4.99/month, 7-day free trial
- `deeplife_premium_yearly` — $49.99/year, 7-day free trial

**Non-Consumables** (one-time):
- `deeplife_remove_ads`
- `deeplife_lifetime_premium`
- `deeplife_mindset_perk` ← iOS-only name (Android uses `deeplife_mindset`)
- `deeplife_fast_learner`
- `deeplife_good_credit`
- `deeplife_unlock_all_perks`
- `deeplife_premium_credit_card`
- `deeplife_financial_planning`
- `deeplife_business_banking`
- `deeplife_private_banking`
- `revival_pack` ← the actual ID used in `iapConfig.ts`

**Consumables**:
- `deeplife_gems_100`
- `deeplife_gems_500`
- `deeplife_gems_1000`
- `deeplife_gems_5000`
- `deeplife_gems_15000`
- `deeplife_gems_50000`
- `deeplife_gems_starter`
- `deeplife_gems_premium`
- `deeplife_gems_ultimate`
- `deeplife_gems_mega`
- `deeplife_youth_pill_single`
- `deeplife_youth_pill_pack`
- `deeplife_money_boost`
- `deeplife_skill_boost`
- `deeplife_work_boost`

### 2b. Submit Products for Review — ⚠️ OUTSTANDING

- [ ] Finish and submit the 2 draft IAP products (`deeplife_gems_50000`, `deeplife_mindset_perk`).
- [ ] Submit the "DeepLife+" subscription group for review. App Store Connect flags: **"Your first subscription group must be submitted with a new app version"** — meaning this can't be done as an IAP-only action from the IAP screen; it needs to be bundled with an app binary submission (i.e. your next `eas build --platform ios` + App Store submission). Plan for this when you do your next iOS release.

---

## 3. Google Play Console Setup (Android)

**Store listing is already done** — checked Play Console → Öka antalet
användare → Butiksuppgifter → Standardbutiksuppgifter: app name, short/full
description, icon, feature graphic, and 5 phone screenshots are all filled in
and the listing shows "Klar att skickas för granskning" (ready to submit for
review). Nothing to do there. (A 7" tablet screenshot slot is empty and shows
as required — optional to fill; the listing reports itself ready without it.)

### 3.0. ⚠️ HARD BLOCKER — upload a build before anything else

As of this check (July 2026), the app **"Deep Life Simulator"** exists in Play
Console (Delta Inc. developer account) but has **zero builds uploaded to any
track** — Production, Open/Closed/Internal testing are all "Sätt igång" (not
started). Google Play's **Subscriptions** and **Engångsprodukter** (one-time
products) screens both refuse to let you create a single product until an
AAB/APK containing the billing permission (`com.android.vending.BILLING` —
already declared in `app.config.js`) has been uploaded to at least one track.

This is not something I can do from here — it needs your authenticated EAS
session and (for signing) your Android keystore. Do this first:

```bash
# From the project directory, with node_modules installed:
eas build --platform android --profile production
```

Once the build finishes, either:
- Run `eas submit --platform android` to push it straight to a Play Console track, or
- Download the `.aab` from the EAS build page and upload it manually in
**Play Console → Testa och lansera (Test and release) → Internal testing → Create new release**.

Only *after* a build lands on a track will the Subscriptions/one-time-products
screens unlock. Come back to §3a/§3b below once that's done.

**Also discovered while investigating this:** this Play Console developer
account ("Delta Inc.", personal account) has **no production access yet** for
this app ("Du har inte åkomst till produktionskanalen ännu"). Google requires
new/personal accounts to run a **closed test with at least 12 opted-in
testers for a continuous 14 days** before Production unlocks. That clock only
starts once a build is live on a closed-test track — so factor ~2+ weeks of
lead time after your first upload before you can submit to Production, not
just "upload and go."

**Also found — a second, separate action item (not launch-blocking today, but time-sensitive):**
Google's new **Android Developer Verification** program requires every
package name to be registered under a verified developer identity, enforced
from **September 2026** for installs on certified Android devices. Your other
app (`com.dynastymanager`) was already registered; `com.deeplife.simulator`
was not, so I registered it — it's sitting as **Draft** under Play Console →
(account home) → **Verifiering av Android-utvecklare**. To finish it, Google
needs the **SHA-256 fingerprint of your app's signing certificate**, which
only exists once you've built/signed the app. After your first
`eas build --platform android`, get it via `eas credentials` (Android →
production → keystore) or from **Play Console → Testa och lansera → Appintegritet → App-signering**
once Play App Signing is enrolled, then paste it into that Draft entry to
complete registration before September 2026.

### 3a. Create Subscription Products

Go to **Play Console → Your App → Generera intäkter med Play (Monetize) → Produkter → Prenumerationer**:

- `deeplife_premium_monthly` — $4.99/month base plan, 7-day free trial phase
- `deeplife_premium_yearly` — $49.99/year base plan, 7-day free trial phase

### 3b. Create In-App Products

Go to **Generera intäkter med Play → Produkter → Engångsprodukter** (Google
merged consumable and non-consumable "in-app products" into one
"one-time products" screen — pick the consumption type per product when
creating it):

Create all the same non-consumables and consumables as in §2a above, **except** use `deeplife_mindset` (not `deeplife_mindset_perk`) for the Mindset perk on Android.

### 3c. Activate Products

Products must be in **Active** state before they appear in production. Make sure to activate each one after creation.

### 3d. Import into RevenueCat + wire entitlements/offering

Same as the iOS flow in §1e/§1f: once products exist in Play Console, go to
**app.revenuecat.com → Deep Life Simulator (Play Store) app → Products** and
they should auto-import (or use "Attach products"). Then:
- Attach `deeplife_remove_ads` → `ads_removed`
- Attach `deeplife_lifetime_premium` → `premium` AND `ads_removed`
- Attach `deeplife_premium_monthly` / `deeplife_premium_yearly` → `premium`
- Add Android packages (Monthly / Annual) to the existing **default** offering
alongside the iOS packages already there.

---

## 4. EAS Secrets (API Keys)

`eas secret:create` / `eas secret:list` are **deprecated** — the CLI now uses
`eas env:create` / `eas env:list`. Run `npm install` first if you hit
"Failed to resolve plugin ... Do you have node modules installed?".

Run these commands in your project directory. Never commit the actual key values to source control.

```bash
# iOS public SDK key from RevenueCat → Apps → iOS app → API keys
eas env:create --scope project --name EXPO_PUBLIC_RC_IOS_KEY --value "appl_xxxxxxxxxxxxxxxxxxxx" --environment production --visibility plaintext

# Android public SDK key from RevenueCat → Apps → Android app → API keys
eas env:create --scope project --name EXPO_PUBLIC_RC_ANDROID_KEY --value "goog_xxxxxxxxxxxxxxxxxxxx" --environment production --visibility plaintext

# Save integrity HMAC key (generate a long random secret, keep it stable across releases)
# Already set? Skip this — changing it invalidates all existing saves.
eas env:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY --value "$(openssl rand -hex 64)" --environment production --visibility sensitive
```

If you also build `preview`/`development` profiles with these vars, repeat with
`--environment preview` / `--environment development` (or pass multiple
`--environment` flags in one command — check `eas env:create --help` for your
installed CLI version).

After creating the variables, verify them:
```bash
eas env:list --environment production
```

You should see `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, and `EXPO_PUBLIC_SAVE_HMAC_KEY` in the list.

**Status: `EXPO_PUBLIC_RC_IOS_KEY` is confirmed set on the EAS project (`@isacm/deeplife-simulator`).**

The Android public key already exists (RC → Apps → Deep Life Simulator (Play Store) → Show key) — run this yourself the same way you did the iOS one:

```bash
eas env:create --scope project --name EXPO_PUBLIC_RC_ANDROID_KEY --value "goog_BrIGxOTsfwxfgaSOOMsEkVhWTWa" --environment production --visibility plaintext
```

`EXPO_PUBLIC_SAVE_HMAC_KEY` still needs to be created if not already set.

---

## 5. Local `.env.local` for Development / Preview Builds

Copy `.env.example` to `.env.local` and fill in:

```env
EXPO_PUBLIC_USE_REVENUECAT=true
EXPO_PUBLIC_RC_IOS_KEY=appl_xxxx # your iOS key
EXPO_PUBLIC_RC_ANDROID_KEY=goog_xxxx # your Android key
EXPO_PUBLIC_RC_ENTITLEMENT_PRO=premium
```

For preview builds, the `eas.json` preview profile doesn't set `EXPO_PUBLIC_USE_REVENUECAT`, so RevenueCat is off by default in preview. If you want to test RC in a preview build, temporarily add `"EXPO_PUBLIC_USE_REVENUECAT": "true"` to the preview env in `eas.json` (and remove it after testing).

---

## 6. Testing Checklist

Work through this before submitting to the App Store / Google Play.

### Sandbox / TestFlight (iOS)
- [ ] Create a Sandbox tester account in App Store Connect
- [ ] Install the TestFlight build
- [ ] Purchase `deeplife_premium_monthly` — confirm 7-day trial, then confirm entitlement appears in-game
- [ ] Purchase `deeplife_gems_500` (consumable) — confirm gems are granted
- [ ] Restore purchases — confirm entitlements restore correctly
- [ ] Open the in-game subscription settings → "Manage" — confirm RevenueCat Customer Center opens

### Internal Testing Track (Android)
- [ ] Add a test account to the internal testing track in Play Console
- [ ] Install the build
- [ ] Purchase `deeplife_premium_monthly` — confirm subscription goes through via offering context
- [ ] Purchase `deeplife_gems_500` — confirm consumable grant
- [ ] Test restore

### RevenueCat Dashboard Verification
- [ ] After each test purchase, check **RevenueCat → Customers** to confirm the transaction and entitlement appear
- [ ] Confirm `premium` entitlement is active for the subscription tester
- [ ] Confirm no errors in the RC event feed

---

## 7. Pre-Launch Checklist

- [ ] All store products created, reviewed, and active
- [ ] RC dashboard: entitlements, products, and default offering fully configured
- [ ] EAS secrets set for both iOS and Android keys
- [ ] TestFlight + Android internal track testing complete
- [ ] `EXPO_PUBLIC_ENABLE_DEVTOOLS` removed from the `production` profile in `eas.json` (or intentionally kept — see note in `.env.example`)
- [ ] Production EAS build triggers with `EXPO_PUBLIC_USE_REVENUECAT=true` confirmed (check `eas.json` production env ✅ already set by code fix)
