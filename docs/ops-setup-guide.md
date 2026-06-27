# DeepLife — Ops Setup Guide (the things only you can do)

This is the step-by-step for the items the build agent can't do (they need your
accounts, consoles, secrets, or a real device). Ordered cheapest-first. Every env
var here is read by the app via `process.env.EXPO_PUBLIC_*` and **inlined at build
time**, so any change requires a **new build** to take effect.

> Your setup: EAS `production` build profile uses `"environment": "production"`,
> so production env vars live in the **EAS "production" environment** (dashboard or
> `eas env:*`), in addition to the inline `env` block already in `eas.json`.
> Bundle id `com.deeplife.simulator` · Apple Team `S3U8B8HH96` · ASC app `6749675615`.

---

## 1. Turn ON analytics (NOW-1) — ~10 min, do this first
The backend is already live (Supabase project `deeplife-backend`). You just set two
env vars and rebuild.

1. Add the vars to the EAS **production** environment (CLI shown; the dashboard
   Project → Environment variables → production works too):
   ```bash
   eas env:create --environment production \
     --name EXPO_PUBLIC_ANALYTICS_URL \
     --value "https://gyxmoqanjdvvllwjfsst.supabase.co/functions/v1/analytics" \
     --visibility plaintext

   eas env:create --environment production \
     --name EXPO_PUBLIC_ENABLE_ANALYTICS --value "true" --visibility plaintext
   ```
   (Use `plaintext` — `EXPO_PUBLIC_*` vars are baked into the client bundle and are
   not secret by design.)
2. **Gotcha:** telemetry is force-OFF when `BORING_BUILD_MODE` is true, and that is
   true under `__DEV__`. A real **production** build is not `__DEV__`, so you're fine —
   just don't expect analytics to fire in `expo start`/dev builds.
3. Build + ship a production build (see §5). After it's on a device:
4. **Verify** rows arrive — in the Supabase SQL editor for `deeplife-backend`:
   ```sql
   select name, count(*) from analytics_events group by 1 order by 2 desc;
   -- D1/D7/D30 base:
   select date_trunc('day', ts) d, count(distinct install_id) dau
   from analytics_events where name='session_start' group by 1 order by 1;
   ```
**Acceptance:** the `paywall_viewed → purchase_started → purchase_succeeded` funnel and
DAU show up from real traffic.

---

## 2. Confirm ads live + ARPDAU baseline (NOW-2) — depends on §1
`EXPO_PUBLIC_ENABLE_ADMOB` is already `true` in the production profile, and
`app.config.js` has AdMob **app** IDs. What remains:

1. **Confirm real (non-test) AdMob *unit* IDs ship in prod.** App IDs ≠ unit IDs.
   Check where unit IDs are read (search `AdMobService.ts` for the ad-unit IDs / any
   `EXPO_PUBLIC_ADMOB_*_UNIT` env). If they're still Google's test IDs, set the real
   ones from your AdMob console as EAS production env vars and rebuild. **Never ship
   test unit IDs to production** (no revenue + policy risk), and never tap your own
   live ads (AdMob bans for that).
2. In the **AdMob console**, confirm the app is approved and ad units are active.
3. After ≥7 days of prod data, compute the baseline from analytics:
   ```sql
   -- impressions/DAU and a rough ARPDAU proxy (needs ad revenue joined from AdMob)
   select date_trunc('day', ts) d,
          count(*) filter (where name='ad_shown')    as impressions,
          count(*) filter (where name='ad_rewarded') as rewarded,
          count(distinct install_id)                 as dau
   from analytics_events group by 1 order by 1;
   ```
   Pull revenue from the AdMob dashboard; ARPDAU = ad revenue ÷ DAU.
**Do NOT change ad frequency yet** — record the 7-day baseline first.

---

## 3. Backend routes 2–4 + accounts (NEXT-0) — the big one
Live cloud save / leaderboards / receipt-verify all hang off a **real account layer**.
Build it in this order. (Full request/response contracts: `docs/backend-api-spec.md`.)

### 3a. Accounts / auth (do first — gates the rest)
- **Sign in with Apple:** enable the capability in the Apple Developer portal for
  `com.deeplife.simulator`; add `expo-apple-authentication`.
- **Google sign-in:** create an OAuth client in Google Cloud Console (iOS + Android +
  Web client IDs); add `@react-native-google-signin/google-signin` or Expo AuthSession.
- **Backend session:** on sign-in, verify the Apple/Google identity token server-side,
  then mint your own **session token** + a stable **`userId`** (≥3 chars, not in the
  reserved set: `local_player, guest, anonymous, unknown, null, undefined`).
  - Supabase Auth can do most of this: enable Apple + Google providers in the
    `deeplife-backend` project (Authentication → Providers), and use the Supabase
    user `id` as `userId`. The Supabase access token becomes the Bearer token.
- **`EXPO_PUBLIC_CLOUD_AUTH_TOKEN` becomes per-user** (the signed-in session token),
  not a static value. Note: a static `EXPO_PUBLIC_*` token would ship in the bundle and
  is not secret — another reason to use the per-user session token.
- **Mandatory:** an in-app **account-deletion** flow (App Store Guideline 5.1.1(v))
  that purges cloud saves + leaderboard rows server-side.
- On first sign-in, **adopt the local save** into the account (claim `slot_1..3`).

### 3b. The data routes (deploy as Supabase Edge Functions in `deeplife-backend`)
Tables already exist (`cloud_saves`, `leaderboard_entries`, RLS on). Implement per the
spec, all requiring `Authorization: Bearer` and `verify_jwt=true`:
- `POST /save`, `GET /save?userId=&slotId=` — mirror client validation
  (`^slot_[1-3]$`, revision ≥1, hash ≥8, signature ≥16); **verify the HMAC `signature`
  server-side**; last-write-wins by `revision`.
- `POST /leaderboard/:category`, `GET /leaderboard/:category` — **ship-blocking
  anti-cheat:** `runSignature` is forgeable, so sanity-bound scores server-side
  (max plausible net-worth/age per revision) and reject impossible values.
- Then set `EXPO_PUBLIC_CLOUD_SAVE_URL` (base URL of these functions) in EAS prod.

### 3c. Receipt verification (NEXT-3 — protect revenue)
- **Apple:** create an **App Store Connect API key** (Users & Access → Integrations →
  In-App Purchase key); use the App Store Server API to validate.
- **Google:** enable the **Google Play Developer API**, create a service account with
  Play access; validate purchases/subscriptions.
- Deploy a `POST /verify` edge function: body `{ receipt, productId, transactionId }`
  → returns `{ "verified": true|false }`; grant idempotently once per `transactionId`.
- Set `EXPO_PUBLIC_IAP_VERIFY_URL` (+ optional `EXPO_PUBLIC_IAP_VERIFY_TOKEN`) in EAS
  prod. **Until this is set, production grants NOTHING** (the client fails closed) — so
  do this before relying on IAP in a release.

---

## 4. Re-enable notifications (NOW-4) — needs a real iOS 26 device
This re-introduces the native module that previously crashed; treat carefully.
1. `npx expo install expo-notifications` (pins the version to your Expo SDK 54).
2. **Hard Rule #4:** add the config plugin in `app.config.js` `plugins: [...]`
   (`"expo-notifications"` with your icon/color) — a package in `package.json` with no
   plugin will crash native init that runs before JS.
3. Replace the `utils/notifications.ts` stub with a crash-safe lazy wrapper (now that
   the package exists, `require('expo-notifications')` will resolve at bundle time);
   gate every real call behind `FEATURE_FLAGS.notifications`, **disabled by default**.
4. Wire `utils/smartNotifications.ts` copy → `scheduleNotification`; cap at **3** local
   types (streak-at-risk, pending-event, "your character is waiting").
5. `npm run preflight` → `eas build --profile production` (or `preview` for TestFlight).
6. **Verify on a real iOS 26 device** (TestFlight): cold-start the app 5–10× and confirm
   **zero** startup crashes. Only after that, flip `EXPO_PUBLIC_ENABLE_NOTIFICATIONS`
   on. Do **not** enable from a simulator-only test.
   *(I can do steps 1–4 in a future session; 5–6 are yours.)*

---

## 5. Release build (Hard Rule #6) — how to ship any of the above
```bash
npm run preflight                       # type-check + lint + tests; do NOT skip / no --force
eas build --profile production --platform ios      # and/or --platform android
eas submit --profile production --platform ios     # uses ascAppId 6749675615 / team S3U8B8HH96
```
- `autoIncrement` + `appVersionSource: remote` handle the build number on EAS cloud builds.
- After install, re-run the §1/§2 verification queries against `deeplife-backend`.

---

## Do-this-in-order checklist
- [ ] §1 set `EXPO_PUBLIC_ANALYTICS_URL` + `EXPO_PUBLIC_ENABLE_ANALYTICS=true` (EAS prod)
- [ ] §5 cut a production build; confirm rows land in `analytics_events`
- [ ] §2 confirm real AdMob **unit** IDs; start the 7-day ARPDAU baseline
- [ ] §3a accounts/auth (Apple + Google + Supabase Auth) → session token + `userId`
- [ ] §3c receipt-verify endpoint + `EXPO_PUBLIC_IAP_VERIFY_URL` (protect revenue)
- [ ] §3b cloud-save + leaderboard functions + `EXPO_PUBLIC_CLOUD_SAVE_URL`; build the
      `CloudSyncConflictModal` (missing — see `docs/backend-api-spec.md` findings)
- [ ] §4 notifications last, behind the flag, verified on a real iOS 26 build
