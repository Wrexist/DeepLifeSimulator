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

## The two that block preflight today — exact commands

A fresh clone fails `npm run preflight` on §9 and §8 with these two absent. Both
are environment, not code: `eas.json`'s production profile already sets
`EXPO_PUBLIC_USE_REVENUECAT=true`, and neither key may be committed.

```bash
# 1. RevenueCat iOS public SDK key — satisfies preflight §9 (receipt verification).
#    This is RevenueCat's *public* app key (starts `appl_`), not the secret API
#    key. Copy it from RevenueCat → Project → API keys → App-specific.
eas env:create --scope project \
  --name EXPO_PUBLIC_RC_IOS_KEY --value appl_XXXXXXXXXXXX \
  --environment production --visibility sensitive

# 2. Save-signing HMAC key — satisfies preflight §8 (signed saves).
#    Generate a fresh one; never reuse a key that has been in a repo or a chat.
#    openssl rand -hex 32
eas env:create --scope project \
  --name EXPO_PUBLIC_SAVE_HMAC_KEY --value <64-hex-chars> \
  --environment production --visibility sensitive
```

**Verify locally without storing anything** — supply them for one command only,
so nothing lands in a shell profile or a `.env`:

```bash
EXPO_PUBLIC_USE_REVENUECAT=true \
EXPO_PUBLIC_RC_IOS_KEY=appl_placeholder \
EXPO_PUBLIC_SAVE_HMAC_KEY=placeholder_not_a_real_key \
  npm run preflight
```

That run is a check of the *gate logic*, not of the real keys — it proves
preflight passes once the environment is populated. The build itself must use
the real values from EAS.

> **Rotating `EXPO_PUBLIC_SAVE_HMAC_KEY` invalidates the signature on every save
> already in the field.** Confirm the load path's behaviour for an
> unverifiable-but-uncorrupted save before rotating on a live app; see
> `utils/saveSigningConfig.ts` and `tasks/leaked-key-rotation-runbook.md`.


## Must be UNSET (or false) for production
| Variable | Why |
|---|---|
| `EXPO_PUBLIC_ALLOW_LEGACY_LOCAL_IAP_ENTITLEMENTS` | `true` re-enables reading **unsigned** local entitlements — a "grant yourself perks" tamper vector. Preflight §8b blocks it. |
| `EXPO_PUBLIC_REQUIRE_SIGNED_SAVES=false` | Disables signed-save enforcement (preflight warns). |

## Enable flags (set in `eas.json` production env)
`EXPO_PUBLIC_ENABLE_ADMOB=true`, `EXPO_PUBLIC_ENABLE_IAP=true`, `EXPO_PUBLIC_ENABLE_ATT=true`.

## CI release workflows (GitHub Actions ▸ Run workflow)

Two credit-free "local build" workflows compile the native binary on the runner
(`eas build --local`) and optionally submit — **zero EAS Build credits**:

| Workflow | Runner | Output | Submits to | Extra secrets |
|---|---|---|---|---|
| `eas-build-local-ios.yml` | macOS (10x) | `.ipa` | TestFlight | ASC API key stored as EAS credentials |
| `eas-build-local-android.yml` | ubuntu (1x) | `.aab` | Google Play | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |

Both need **`EXPO_TOKEN`** (EAS auth) and an EAS-registered signing key
(iOS distribution cert / Android upload keystore — created once via
`eas credentials`, then reused by `--local` builds).

### Android → Google Play (`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`)
Paste the full JSON of a Google Play **service-account key** into this repo secret.
To create it once:
1. Google Play Console ▸ **Users & permissions** ▸ invite a service account (or
   create one in Google Cloud Console under the linked project) and grant it
   **"Release apps to testing tracks and manage releases"**.
2. In Google Cloud Console, enable the **Google Play Android Developer API** and
   download a **JSON key** for that service account.
3. Add it as the repo secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (Settings ▸
   Secrets ▸ Actions). The workflow writes it to `./play-service-account.json`
   (gitignored) which `eas.json`'s `submit.production.android.serviceAccountKeyPath`
   points at.

> **First upload must be manual.** Google rejects the very first `.aab` for a new
> app over the API — upload one build by hand in the Play Console once, then every
> future run of this workflow can upload automatically. The workflow's Play
> **track** is chosen per-run (default `internal`).
>
> Keep `UPDATED_PRIVACY_POLICY.md` and the Play Data Safety form in sync with the
> shipped `EXPO_PUBLIC_ENABLE_ADMOB` + Android `AD_ID` permission.
