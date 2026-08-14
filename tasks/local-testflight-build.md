# Local TestFlight Build Runbook (EAS cloud quota exhausted)

> Use this when the monthly EAS Build cloud quota is used up (15/15). The cloud
> build *queue* is the only thing that's capped — `eas build --local` compiles
> on your Mac and does **not** consume build credits. `eas submit` never
> consumes build credits either.
>
> **Requires macOS + Xcode + CocoaPods.** iOS cannot be built on Linux.

App: `com.deeplife.simulator` · version `2.5.0` · `STATE_VERSION = 18`
ASC App ID `6749675615` · Apple Team `S3U8B8HH96` (from `eas.json`)

---

## 0. Prerequisites (one-time)

```bash
# macOS with Xcode + command line tools installed
xcode-select --install            # if not already
sudo gem install cocoapods        # or: brew install cocoapods
npm i -g eas-cli                  # or use npx eas-cli@latest
eas login                         # authenticate to your Expo account
eas whoami                        # confirm
```

---

## 1. Required production secrets

The iOS preflight gate (`npm run preflight`) **fails** without these three secret
groups (five env vars total — the AdMob row covers three IDs).
`eas.json` `production` env sets `ENABLE_ADMOB=true`, `ENABLE_IAP=true`,
`ENABLE_ATT=true`, which is what makes them mandatory.

| Variable | Why it's required | Format constraint |
|---|---|---|
| `EXPO_PUBLIC_SAVE_HMAC_KEY` | Signed-save integrity (`REQUIRE_SIGNED_SAVES` defaults true). Without it the build can't sign/verify saves. | Long random secret. **Must stay STABLE across releases** — changing it invalidates every existing user's save signature. |
| `EXPO_PUBLIC_IAP_VERIFY_URL` | `IAPService.verifyReceiptWithServer` returns `true` (every purchase passes unverified) when unset → revenue leak + App Store rejection. | Must start with `https://` |
| `EXPO_PUBLIC_ADMOB_BANNER_IOS`<br>`EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS`<br>`EXPO_PUBLIC_ADMOB_REWARDED_IOS` | Without them AdMob falls back to Google **test** ad units (zero revenue) in release. | Must match `ca-app-pub-<digits>/<digits>` |

Also keep these at their safe production defaults (preflight FAILS otherwise):
`EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION=false`,
`EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES=false`,
`EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS=false`.

### Where to put them

- **For the EAS build** (`--local` still resolves EAS project secrets when logged in):
  set them once as project secrets so any build picks them up:
  ```bash
  eas secret:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY      --value '<long-random-secret>'
  eas secret:create --scope project --name EXPO_PUBLIC_IAP_VERIFY_URL     --value 'https://your-verify-endpoint'
  eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_BANNER_IOS       --value 'ca-app-pub-XXXX/XXXX'
  eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS --value 'ca-app-pub-XXXX/XXXX'
  eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_REWARDED_IOS     --value 'ca-app-pub-XXXX/XXXX'
  eas secret:list   # verify the five names exist
  ```
- **For local preflight** (`npm run preflight` only reads your shell / `.env.local`,
  not EAS secrets): mirror the same values into `.env.local` (Expo auto-loads it)
  so the gate can validate before you build. `.env.local` is gitignored — never commit real secrets.

---

## 2. Verify before building

```bash
npm ci
npm run preflight        # MUST print "PREFLIGHT CHECK PASSED" — do not bypass (CLAUDE.md rule #6)
```
If preflight still flags those vars (five env vars across the three groups above),
they aren't visible to your shell —
re-check `.env.local`. Code-level checks (routes, type-check, lint, 2344 tests)
already pass on this branch as of this runbook.

---

## 3. Build locally (no cloud credits)

```bash
# CFBundleVersion must be UNIQUE per upload — Apple rejects a duplicate with
# "You've already submitted this build of the app." `eas build --local` does NOT
# auto-increment, so resolve the next number explicitly. The resolver returns one
# higher than App Store Connect's latest build when the ASC_* env vars are set
# (see "Accurate build numbers" below), otherwise a monotonic epoch fallback.
# `--ask` lets you confirm/override the number (auto-skipped when non-interactive).
# eas.json uses appVersionSource:"remote", but app.config.js still reads BUILD_NUMBER
# and that is what gets baked (verified: TestFlight accepts each local build).
# Do not flip eas.json to "local" — the cloud workflow depends on remote+autoIncrement.
# into ios.buildNumber / android.versionCode.
BUILD_NUMBER=$(node scripts/next-build-number.mjs --ask) eas build --platform ios --profile production --local
```
This produces an `.ipa` in the project directory (e.g. `build-XXXXXXXXXXX.ipa`).
First run is slow (pod install + native compile).

> If a submit fails with "already submitted this build", you must **rebuild** with
> a new `BUILD_NUMBER` — the existing `.ipa` can never be re-submitted as-is.

### Accurate build numbers (optional)

By default the resolver uses **epoch seconds** — always unique and always higher
than the last build, but not sequential. To make it return exactly **one more
than App Store Connect's latest build**, expose an App Store Connect API key to
`scripts/next-build-number.mjs` (locally as env vars; in CI as repo secrets of
the same names, already wired into `eas-build-local-ios.yml`):

| Variable | Where to find it |
|---|---|
| `ASC_KEY_ID` | App Store Connect ▸ Users and Access ▸ Integrations ▸ Keys (the Key ID, e.g. `68Z3A533XY`) |
| `ASC_ISSUER_ID` | same page — the Issuer ID (a UUID) |
| `ASC_KEY_P8` | contents of the downloaded `AuthKey_<KeyID>.p8` (raw PEM or base64) |

```bash
export ASC_KEY_ID=68Z3A533XY
export ASC_ISSUER_ID=00000000-0000-0000-0000-000000000000
export ASC_KEY_P8="$(cat ~/Downloads/AuthKey_68Z3A533XY.p8)"
node scripts/next-build-number.mjs           # e.g. prints 53 when ASC's latest is 52
node scripts/next-build-number.mjs --selftest # debug: prints the signed JWT, no API call
```

The App ID is read automatically from `eas.json` (`submit.production.ios.ascAppId`).

---

## 4. Submit to TestFlight (free)

```bash
eas submit --platform ios --profile production --path ./build-XXXXXXXXXXX.ipa
```
Uses the `submit.production.ios` config already in `eas.json` (ascAppId + teamId).
Alternative: upload the `.ipa` with Apple's **Transporter** app, or archive
directly in Xcode (`npx expo prebuild --platform ios --clean` → open the
`.xcworkspace` → Product ▸ Archive ▸ Distribute ▸ TestFlight).

---

## CI option — build on a GitHub macOS runner (no Mac needed, no cloud credits)

Workflow: `.github/workflows/eas-build-local-ios.yml` — manual trigger
(Actions ▸ "iOS TestFlight (local build · no cloud credits)" ▸ Run workflow). It runs
the cheap gates on ubuntu, then `eas build --local` + TestFlight submit on
`macos-latest`. macOS minutes bill ~10x, so the gates fail fast on ubuntu first.

Required **GitHub Actions repo secrets** (Settings ▸ Secrets and variables ▸ Actions):

| Secret | Notes |
|---|---|
| `EXPO_TOKEN` | Expo access token (expo.dev ▸ Account ▸ Access Tokens). Authenticates eas-cli. |
| `EXPO_PUBLIC_SAVE_HMAC_KEY` | long random, stable across releases |
| `EXPO_PUBLIC_IAP_VERIFY_URL` | `https://…` |
| `EXPO_PUBLIC_IAP_VERIFY_TOKEN` | optional auth token for the verify endpoint |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | `ca-app-pub-…~…` |
| `EXPO_PUBLIC_ADMOB_BANNER_IOS` | `ca-app-pub-…/…` |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` | `ca-app-pub-…/…` |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS` | `ca-app-pub-…/…` |

The preflight step is a **hard gate** in this workflow — missing any of the above
fails the run before macOS time is spent. The `submit` step needs an **App Store
Connect API key stored as EAS credentials** (set once via `eas credentials` or an
interactive `eas submit`) so `--non-interactive` can reuse it. The `.ipa` is also
uploaded as a build artifact for manual Transporter upload if submit is skipped.

## Other fallbacks if you have no Mac

iOS binaries cannot be built on Linux/Windows. Options:
1. **Upgrade the EAS plan** (Production tier raises/removes the monthly cloud build cap) — then the original `eas build --platform ios --profile production --auto-submit` works.
2. **Wait for the rolling monthly quota to reset.**
