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

## The two that block preflight today — step by step

A fresh clone fails `npm run preflight` on §9 and §8 with these two absent.
Both are environment, not code: `eas.json`'s production profile already sets
`EXPO_PUBLIC_USE_REVENUECAT=true`, and neither key may be committed.

They are **opposite in kind**, and that is the thing to hold on to:

| | `EXPO_PUBLIC_RC_IOS_KEY` | `EXPO_PUBLIC_SAVE_HMAC_KEY` |
|---|---|---|
| Where it comes from | **Fetched** from RevenueCat's dashboard | **Generated** by you, once, from nothing |
| Can it be re-fetched if lost? | Yes — it is always on that page | **No.** Losing it is unrecoverable; see the rotation warning below |
| Is it secret? | No. It is publishable and ships inside the app binary | Also ships in the binary (it is `EXPO_PUBLIC_*`), but treat it as secret anyway — see below |
| Cost of getting it wrong | Every purchase refused | Every existing save fails its signature |

---

### 1 · `EXPO_PUBLIC_RC_IOS_KEY` — fetch it from RevenueCat

This is RevenueCat's **public SDK key** for the iOS app. It begins `appl_`. It
is *not* the secret API key (`sk_...`), which must never go near the app.

RevenueCat reorganises its dashboard from time to time, so treat the **`appl_`
prefix** as the identifying feature rather than the menu path below.

1. Sign in at <https://app.revenuecat.com>.
2. Pick the project for DeepLife Simulator in the project switcher (top left).
   If there is no project yet, `docs/REVENUECAT-SETUP.md` covers creating one
   and attaching the App Store app — do that first, because the key does not
   exist until an app is attached.
3. In the left sidebar open **Project settings → API keys**.
4. Find the **App specific keys** table. Each row is one platform's app.
5. Copy the key on the **App Store** row. It starts `appl_`.
   - The row labelled *secret* (`sk_...`) is the server key. Do not use it.
   - If you also ship Android, the Play Store row gives you
     `EXPO_PUBLIC_RC_ANDROID_KEY`, which `apiKey()` in
     `services/RevenueCatService.ts` selects per platform.
6. Store it on EAS:

   ```bash
   eas env:create --scope project \
     --name EXPO_PUBLIC_RC_IOS_KEY --value appl_XXXXXXXXXXXX \
     --environment production --visibility sensitive
   ```

**Why preflight blocks without it.** `revenueCatService.isEnabled()` requires a
key. With `EXPO_PUBLIC_USE_REVENUECAT=true` and no key it returns false, so the
build silently falls back to the self-hosted verification path — where a
missing `EXPO_PUBLIC_IAP_VERIFY_URL` makes `verifyReceiptWithServer` return
`false` and **every purchase is refused**. Paying players would receive nothing,
with no error anywhere. That is why §9 is a hard failure rather than a warning.

---

### 2 · `EXPO_PUBLIC_SAVE_HMAC_KEY` — generate it yourself

Nobody issues this one. It is the secret the app signs its own save files with,
so a tampered save can be detected on load. Any sufficiently long random string
works; what matters is that it is generated once and then **never changes**.

1. Generate 32 random bytes as hex:

   ```bash
   openssl rand -hex 32
   ```

   That is 64 hex characters. `head -c 32 /dev/urandom | xxd -p -c 64` works
   the same if `openssl` is unavailable.

2. Put it somewhere you will still have it in two years — a password manager
   entry for the project, not a note and not a chat message. If this key is
   lost, it cannot be recovered or re-derived, and see step 4 for why that
   matters.

3. Store it on EAS:

   ```bash
   eas env:create --scope project \
     --name EXPO_PUBLIC_SAVE_HMAC_KEY --value <the 64 hex chars> \
     --environment production --visibility sensitive
   ```

4. **Never rotate it on a live app without a plan.** Every save already on a
   player's device is signed with the old key. Change it and each of those saves
   fails verification on the next load. `utils/saveSigningConfig.ts` decides
   what happens then, and `tasks/leaked-key-rotation-runbook.md` is the
   procedure if the key ever leaks and rotation is forced.

**A caveat worth knowing.** Because the variable is `EXPO_PUBLIC_*`, Metro
inlines it into the JS bundle — so it is extractable from a shipped app by
anyone who looks. It raises the cost of casual save editing; it is not a
defence against a determined attacker, and it should not be reused for anything
else. Preflight §8 also only checks that the key is **present**, not that it is
strong: a value of `x` passes. The generator above is what makes it real.

---

### Verify locally without storing anything

Supply both for a single command, so nothing lands in a shell profile or a
`.env`:

```bash
EXPO_PUBLIC_USE_REVENUECAT=true \
EXPO_PUBLIC_RC_IOS_KEY=appl_placeholder \
EXPO_PUBLIC_SAVE_HMAC_KEY=placeholder_not_a_real_key \
  npm run preflight
```

That run checks the *gate logic*, not the real keys — it proves preflight passes
once the environment is populated. The build itself must use the real values
from EAS.

> **Do not run preflight in a shell that still has the screenshot-capture
> variables exported.** `EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION=true` and
> `EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES=true` (see
> `screenshots/appstore-2026/README.md`) are hard §8 failures, and the message
> names the variable rather than the shell, which is a confusing five minutes.

### Confirming they took

```bash
eas env:list --environment production
```

Sensitive values are masked, so this confirms the NAME exists — it cannot
confirm the value is right. The real confirmation for RevenueCat is a sandbox
purchase completing on a TestFlight build; for the HMAC key it is a save
written by that build re-loading cleanly.

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
