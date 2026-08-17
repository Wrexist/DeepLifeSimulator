# App Store Connect automation

Creates the App Store version record for a release and fills its **What's New**
from the repo, so the store copy is written once and sent to Apple verbatim.

Replaces the step in `docs/RELEASE_RUNBOOK.md` where release notes were retyped
into the App Store Connect UI, once per locale.

---

## Setup (once)

App Store Connect → **Users and Access → Integrations → App Store Connect API** →
generate a key with the **App Manager** role. Download the `.p8` — Apple only
offers it once.

```bash
export ASC_KEY_ID=XXXXXXXXXX          # the key ID
export ASC_ISSUER_ID=xxxxxxxx-xxxx-…  # shown above the key list
export ASC_KEY_P8_PATH=~/keys/AuthKey_XXXXXXXXXX.p8
```

`ASC_KEY_P8` also works and takes the PEM inline, base64-encoded or not — that
is how the same key already reaches CI as a single-line secret. The app id comes
from `eas.json` (`submit.production.ios.ascAppId`); `ASC_APP_ID` overrides it.

Check the setup without calling Apple:

```bash
node scripts/next-build-number.mjs --selftest
```

## Use

```bash
npm run asc:status          # what Apple has right now — read-only
npm run asc:release         # plan the release — writes NOTHING
npm run asc:release:apply   # perform the plan
```

A normal release is: read the plan, then apply it.

```
$ npm run asc:release

App Store Connect · app 6749675615 · version record 1.5.0 (IOS)
Mode: PLAN — nothing will be written

Existing versions (1)
  1.3.5      READY_FOR_SALE

CREATE version record 1.5.0 (beats released 1.3.5)

What's New
  CREATE    en-US  New faces, real conversations, and nothing left locked.
  CREATE    es-MX  Caras nuevas, conversaciones de verdad y nada que te deje fuera.

Planned writes (3)
  POST /v1/appStoreVersions
  POST /v1/appStoreVersionLocalizations
  POST /v1/appStoreVersionLocalizations

Nothing was written. Re-run with --apply to perform this plan.
```

### Other flags

| Flag | Effect |
|---|---|
| `--version 1.6.0` | override the record to create (default: `APPLE.storeVersion`) |
| `--build 1234` | attach that `CFBundleVersion` to the version record |
| `--submit` | submit for review. **Requires `--apply`.** |
| `--json` | machine-readable plan on stdout |

## Where the copy lives

`marketing/aso/metadata.mjs` — `APPLE.storeVersion`, `APPLE.whatsNew`, and
`APPLE.localized['es-MX'].whatsNew`. `npm run check:aso` validates them (4000
chars, and a shipped locale missing its release notes is an error, since its
store page would otherwise show English notes under translated copy).

Locales marked `shipped: false` (en-GB) are never created — those storefronts
already fall back to en-US.

Keep the three descriptions of a release in step, in the same commit:

| File | Audience |
|---|---|
| `marketing/aso/metadata.mjs` | the App Store product page |
| `lib/config/changelog.ts` | the in-app What's New feed |
| `WHATS_NEW.md` | the prose write-up, and why |

## What it will not do

**It will not write without `--apply`.** Dry run is the default, and the plan
lists the exact requests it would send. The plan is complete: creating a version
and its two localizations reports three writes, not one.

**It will not submit unless you ask twice.** `--submit` needs `--apply` as well.
Creating a record is reversible in the UI; putting the app in front of Apple is
not, and a metadata rejection comes back with every attached IAP marked
"Rejected" too (CLAUDE.md §9).

**It will not touch a version that is in review or live.** Only
`PREPARE_FOR_SUBMISSION`, `METADATA_REJECTED`, `DEVELOPER_REJECTED`, `REJECTED`
and `INVALID_BINARY` are editable. Anything else stops the run.

**It will not create a version that does not climb.** Store version numbers can
only ever increase. If the target does not beat the highest RELEASED version, it
refuses and names the number it found.

**It will not delete a locale it does not manage.** A localization present on
the version but absent from `metadata.mjs` is reported and left alone.

**It will not confuse the two version numbers.** `APPLE.storeVersion` is the
1.x record on the product page; `package.json`'s version is the binary
(`CFBundleShortVersionString`, 2.9.0). They have deliberately differed since
1.2.7 — see CLAUDE.md §9 — and raising the store record to match the binary is a
one-way door that abandons the 1.x line.

**It does not upload builds.** EAS does that. `--build` only attaches one that
has already finished processing.

## Notes on the API

`whatsNew` is an attribute of `appStoreVersionLocalizations`. `appStoreVersions`
has no `releaseNotes` field, despite plausible-looking documentation summaries
that say otherwise — the payload shapes here were read off Apple's documentation
JSON and are pinned by `__tests__/tooling/ascRelease.test.ts`.

Submission uses the three-step flow (`reviewSubmissions` →
`reviewSubmissionItems` → `PATCH … {submitted: true}`).
`appStoreVersionSubmissions` is deprecated and gone from the current docs.

Auth is an ES256 JWT, `aud: 'appstoreconnect-v1'`, max 20-minute lifetime,
signed with the **raw r||s** signature rather than Node's default DER. Apple
answers every one of those mistakes with the same opaque 401, which is why they
live in one place (`scripts/lib/ascClient.mjs`) shared with
`scripts/next-build-number.mjs`.
