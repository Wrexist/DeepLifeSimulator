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

The iOS preflight gate (`npm run preflight`) **fails** without these three.
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
If preflight still flags the three vars, they aren't visible to your shell —
re-check `.env.local`. Code-level checks (routes, type-check, lint, 2344 tests)
already pass on this branch as of this runbook.

---

## 3. Build locally (no cloud credits)

```bash
eas build --platform ios --profile production --local
```
This produces an `.ipa` in the project directory (e.g. `build-XXXXXXXXXXX.ipa`).
First run is slow (pod install + native compile).

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

## Fallbacks if you have no Mac

iOS binaries cannot be built on Linux/Windows. Options:
1. **Upgrade the EAS plan** (Production tier raises/removes the monthly cloud build cap) — then the original `eas build --platform ios --profile production --auto-submit` works.
2. **Wait for the rolling monthly quota to reset.**
3. Use a CI macOS runner (e.g. GitHub Actions `macos-latest`) to run `eas build --local`.
