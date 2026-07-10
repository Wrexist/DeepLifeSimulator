# DeepLife IAP verification endpoint

This is the backend the app calls at `EXPO_PUBLIC_IAP_VERIFY_URL`. Until it's
live, the app **refuses to grant any purchase in production** (fail-closed).

It returns `{ "verified": true }` only for a genuine App Store / Google Play
receipt. Deploy it once, point the app at it, done.

---

## What the app sends

```
POST <your url>
Authorization: Bearer <EXPO_PUBLIC_IAP_VERIFY_TOKEN>
Content-Type: application/json

{ "receipt": "<store token>", "productId": "deeplife_premium_monthly", "transactionId": "..." }
```

It grants the purchase only if the reply is `200 { "verified": true }`.

---

## Fastest path (Vercel, free)

1. **Install the CLI & deps**
   ```bash
   npm i -g vercel
   cd server/iap-verify
   npm install
   ```

2. **Set the environment variables** (Vercel dashboard → your project → Settings → Environment Variables, or `vercel env add`):
   - `IAP_SHARED_SECRET` — any long random string. **Must equal** the app's `EXPO_PUBLIC_IAP_VERIFY_TOKEN`.
   - `APPLE_BUNDLE_ID` — e.g. `com.you.deeplife`
   - `APPLE_APP_APPLE_ID` — the numeric App Store id (App Store Connect → App → App Information)
   - `GOOGLE_PACKAGE_NAME` — e.g. `com.you.deeplife`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the full service-account JSON, pasted as one string (see below)

3. **Apple root certs** (for iOS verification): download Apple's root CAs from
   <https://www.apple.com/certificateauthority/> (the "Apple Root CA - G3" and
   "Apple Inc. Root Certificate" .cer files) and drop them into
   `server/iap-verify/certs/`. They're public — safe to commit.

4. **Google service account** (for Android verification):
   - Google Play Console → Setup → API access → create/link a Google Cloud project.
   - Create a service account, grant it **View financial data** + **Manage orders** on your app.
   - Download its JSON key → paste the whole file into `GOOGLE_SERVICE_ACCOUNT_JSON`.

5. **Deploy**
   ```bash
   vercel --prod
   ```
   Your endpoint is `https://<project>.vercel.app/verify`.

6. **Point the app at it** — add two EAS secrets and rebuild:
   ```bash
   eas secret:create --name EXPO_PUBLIC_IAP_VERIFY_URL   --value "https://<project>.vercel.app/verify"
   eas secret:create --name EXPO_PUBLIC_IAP_VERIFY_TOKEN --value "<the same IAP_SHARED_SECRET>"
   eas build --platform all --profile production
   ```

7. **Test** with a Sandbox tester (iOS) / license tester (Android): buy premium,
   confirm it unlocks. Check the endpoint logs — a real receipt logs a grant.
   Note iOS TestFlight / App Review purchases are **sandbox** transactions — the
   production endpoint rejects those by default (see "Sandbox receipts" below), so
   test them against a staging deploy with `IAP_ALLOW_SANDBOX=true`.

---

## Sandbox receipts (iOS) — production rejects them by default

A StoreKit **sandbox** transaction is free to obtain on a production build (sign a
Sandbox Apple ID into device Settings) and its signed JWS verifies cleanly under
the sandbox environment. Accepting it in production would be a free-premium hole.
So the endpoint verifies against the **production** Apple environment only, unless
you explicitly set `IAP_ALLOW_SANDBOX=true`.

- **Production deploy:** leave `IAP_ALLOW_SANDBOX` unset. Real App Store purchases
  are production receipts and verify normally.
- **Staging / TestFlight / App Review deploy:** set `IAP_ALLOW_SANDBOX=true` and
  point those builds at that staging URL, so sandbox purchases verify there.
  **Never set this on the production deployment.**

---

## Soft launch (optional, less secure)

If you want to ship before wiring Apple/Google credentials, set
`ALLOW_SOFT_LAUNCH=true`. The endpoint then accepts any well-formed receipt for a
known product id after a basic sanity check. **Turn this off** and configure the
real credentials as soon as you can — it does not stop forged receipts.

**Fail-closed in production:** if `NODE_ENV=production`, soft-launch will **not**
grant unless you ALSO set `ALLOW_SOFT_LAUNCH_IN_PROD=true` — a deliberate second
flag so a stray `ALLOW_SOFT_LAUNCH` left in the environment can't silently hand
out paid content on the live endpoint.
