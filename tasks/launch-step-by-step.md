# DeepLife Simulator - launch step-by-step (Android first, then iOS)

Do the parts in order. Every value you need to paste is in this repo. Nothing
here needs code changes - the app is already built and verified.

**Already done (do NOT redo):** merged #215, production OTA live, both-platform
preflight PASS, `expo-doctor` 18/18, full suite green, Play icon + feature
graphic + 8 designed 3D screenshots, listing copy. See
`tasks/mobile-launch-readiness-2026-09-19.md`.

You are logged into EAS as `isacm`. Keep that terminal handy.

---

## PART 1 - AdMob Android ad units — ✅ DONE (2026-09-19)

Set in the EAS production env and in `app.config.js`:
`EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_BANNER_ANDROID`,
`EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID`, `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`.
Kept below for reference / if the units ever need recreating.

1. Open https://admob.google.com → **Apps**. Android app App ID:
   `ca-app-pub-2286247955186424~9052280895`.
2. **Ad units → Add ad unit**. Create exactly three, for that Android app:
   - **Banner** → copy its Ad unit ID (`ca-app-pub-…/…`)
   - **Interstitial** → copy its ID
   - **Rewarded** → copy its ID
3. In the repo, set them in EAS production (paste the three IDs):

   ```bash
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_BANNER_ANDROID --value ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID --value ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID --value ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY --visibility plaintext
   ```

   Verify: `npx eas-cli env:list --environment production` should now show all
   three, next to the existing iOS values.

> Alternative: send me the three IDs and I will run the commands.

---

## PART 2 - Service account so EAS can upload to Play

1. Google Cloud Console → create/select a project.
2. **APIs & Services → Enable APIs → Google Play Android Developer API → Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (name: `eas-play`).
4. Open it → **Keys → Add key → Create new key → JSON** → download.
5. In Play Console: **Users and permissions → Invite new users**, paste the
   service-account email, grant **Release to testing tracks** and **Admin
   (all apps)** for now.
6. Save the downloaded JSON as `play-service-account.json` in the repo root.
   It is already gitignored - **never commit it**.

---

## PART 3 - Play Console: app content + listing

Open your app: https://play.google.com/console/u/0/developers/5339927053323856680/app/4974474595211064429

**3a. Policy → App content** (answer each; drafts in
`marketing/play-store/listing.md` §Compliance):
- Privacy policy URL: `https://wrexist.github.io/DeepLifeSimulator/privacy.html`
- **Ads:** yes, app contains ads
- **App access:** no login; reviewers tap **Play** on the menu
- **Content rating (IARC):** complete the questionnaire (crime, simulated
  gambling from stocks/crypto, mild dating/alcohol are all present)
- **Target audience:** 13+ (not designed for children)
- **Data safety:** declare App activity + Device/other IDs (analytics + ads),
  encrypted in transit, deletion via the in-app request flow
- **Government apps:** no · **Financial features:** no (it only simulates money)

**3b. Store presence → Main store listing**
- App name: `DeepLife Simulator`
- Short description: `Live a thousand lives: career, love, money, legacy. Every choice compounds.`
- Full description: copy from `marketing/play-store/listing.md`
- Graphics: upload
  - `marketing/play-store/icon-512.png`
  - `marketing/play-store/feature-graphic-1024x500.png`
  - the 8 PNGs in `marketing/play-store/screenshots/` (1080x1920)
- Category: Simulation · Website/Support/Privacy URLs from `listing.md`

**3c. Monetize → Products → In-app products** - create each ID below (one-time):

```
deeplife_gems_100      deeplife_gems_500     deeplife_gems_1000
deeplife_gems_5000     deeplife_gems_15000   deeplife_gems_50000
deeplife_gems_starter  deeplife_gems_premium deeplife_gems_ultimate
deeplife_gems_mega     deeplife_youth_pill_single  deeplife_youth_pill_pack
deeplife_money_boost   deeplife_skill_boost  deeplife_lifetime_premium
deeplife_work_boost    deeplife_mindset      deeplife_fast_learner
deeplife_good_credit   deeplife_unlock_all_perks   deeplife_remove_ads
deeplife_premium_credit_card  deeplife_financial_planning
deeplife_business_banking     deeplife_private_banking
revival_pack           deeplife_revive_now
```

**3d. Monetize → Products → Subscriptions** - create two base plans:
`deeplife_premium_monthly`, `deeplife_premium_yearly`.

**3e. Test → Internal testing → add yourself as a tester.** (You can upload the
AAB here before the full listing is approved.)

**3f. Release → Setup → App signing:** accept **Play App Signing** (default).

---

## PART 4 - Build the signed Android App Bundle

```bash
npx eas-cli build --platform android --profile production
```

Wait for it to finish; note the build URL. `versionCode` auto-increments from
the remote counter (`appVersionSource: remote`).

---

## PART 5 - Upload + test

```bash
npx eas-cli submit --platform android --profile production
```

This uploads to the **internal testing** track (per `eas.json`). Then:
1. Play Console → **Test → Internal testing** → opt in with your tester email.
2. Open the install link on a **real Android phone** and check:
   - app launches, no crash
   - top bar / HUD, tabs, advancing a week
   - **ads** (rewarded orb + banner) actually load
   - **a purchase** (use a license tester) and **Restore**
   - back button closes every sheet; safe areas fine on Android 15/16
   - an old save upgrades without loss
3. Fix anything found, repeat Part 4-5.

---

## PART 6 - Go live

1. Play Console → **Production → Create new release** → promote the tested AAB.
2. Roll out **staged** (e.g. 20%), watch crashes/ANRs in **Quality → Android
   vitals** for a day, then 100%.

---

## PART 7 - iOS (after Android is calm)

1. Confirm the App Store version to ship. Live record is `1.5.5`; last upload
   was `2.14.0 (186)`. Do NOT reuse stale 2.13.0 instructions.
2. Update `marketing/aso/metadata.mjs` `storeVersion` + What's New.
3. Build + submit:

   ```bash
   npx eas-cli build --platform ios --profile production
   npx eas-cli submit --platform ios --profile production
   ```

4. TestFlight → device checks for ATT consent, purchases, VoiceOver/Larger
   Text/reduced motion, kill/relaunch.

---

## Quick checklist

- [ ] 3 AdMob Android units created + set in EAS
- [ ] `play-service-account.json` saved locally (gitignored)
- [ ] App content forms complete (privacy, ads, content rating, audience, data safety)
- [ ] Main store listing complete (text + icon + feature graphic + 8 screenshots)
- [ ] 27 in-app products + 2 subscriptions created
- [ ] Play App Signing accepted
- [ ] `eas build -p android --profile production`
- [ ] `eas submit -p android --profile production`
- [ ] Tested on a real Android device (ads, purchase, restore, back, old save)
- [ ] Staged production rollout
- [ ] iOS version confirmed, built, TestFlight-tested
