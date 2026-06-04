# Release Secrets & Production Config (R9 P2-17)

Revenue-critical and integrity-critical configuration is supplied via environment
variables (never committed — `.env` is gitignored). Missing values fail **closed**
at runtime (purchases refused, test ads, unsigned saves), so they must be present
for production builds.

`npm run preflight` (and the CI `Preflight (production config)` step) verify these.
The route-conflict guard (`npm run check:routes`) runs first and needs no secrets.

## Where they live
- **EAS builds** read from the EAS-hosted environment named in `eas.json`
  (`build.production.environment = "production"`). Set them with
  `eas env:create --environment production --name NAME --value ...` (or the
  EAS dashboard).
- **GitHub Actions CI** (`.github/workflows/eas-build.yml`) reads them from
  GitHub Actions **secrets** for the non-blocking preflight step. Mirror the
  values there and remove `continue-on-error` on that step to make it a hard gate.

## Required for production

| Variable | Purpose | Fail-closed behavior if missing |
|---|---|---|
| `EXPO_PUBLIC_IAP_VERIFY_URL` | Server receipt-verification endpoint (https) | Every purchase refused (`IAPService.verifyReceiptWithServer`) |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` / `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | AdMob app IDs | Falls back to a hardcoded ID / test path |
| `EXPO_PUBLIC_ADMOB_BANNER_IOS` / `_INTERSTITIAL_IOS` / `_REWARDED_IOS` (+ android) | Real ad unit IDs | Google **test** unit IDs → zero ad revenue |
| Save-signing / HMAC key (see `evaluateSaveSigningEnv`) | Tamper-evident saves | Unsigned saves / weakened integrity |

## Must be UNSET (or false) for production
| Variable | Why |
|---|---|
| `EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS` | `true` re-enables reading **unsigned** local entitlements — a "grant yourself perks" tamper vector. Preflight §8b blocks it. |
| `EXPO_PUBLIC_REQUIRE_SIGNED_SAVES=false` | Disables signed-save enforcement (preflight warns). |

## Enable flags (set in `eas.json` production env)
`EXPO_PUBLIC_ENABLE_ADMOB=true`, `EXPO_PUBLIC_ENABLE_IAP=true`, `EXPO_PUBLIC_ENABLE_ATT=true`.

> Keep `UPDATED_PRIVACY_POLICY.md` and the Play Data Safety form in sync with the
> shipped `EXPO_PUBLIC_ENABLE_ADMOB` + Android `AD_ID` permission.
