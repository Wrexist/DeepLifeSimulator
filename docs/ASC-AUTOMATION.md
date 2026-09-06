# App Store Connect automation

Writes the **whole App Store product page** from the repo — name, subtitle,
keyword field, description, promotional text, What's New and the support /
marketing / privacy links — for every locale the repo ships. The copy is
written once, validated by `npm run check:aso`, and sent to Apple verbatim.

Replaces the part of `docs/RELEASE_RUNBOOK.md` where the whole listing was
printed by `npm run aso` and typed into the App Store Connect UI, field by
field, once per locale.

## What lands where

A listing is split across two App Store Connect resources, and the split is not
where you would guess. Anything that can differ per RELEASE belongs to the
version; anything that belongs to the APP does not.

| Field | Resource | Notes |
|---|---|---|
| Description · Keywords · Promotional text · What's New | `appStoreVersionLocalizations` | per version, per locale |
| Support URL · Marketing URL | `appStoreVersionLocalizations` | per version — Apple requires support |
| **Name · Subtitle · Privacy policy URL** | `appInfoLocalizations` | per APP, on its *editable* record |

Getting that split wrong is a 4xx from Apple rather than a wrong value anyone
could see, which is why the resource each field lands on is pinned by
`__tests__/tooling/ascReleaseCli.test.ts` against a fake API.

Not written by this script: **IAP display names** (product records, not listing
copy — a rename changes a live purchase sheet), screenshots, pricing, age
ratings, and anything else in `metadata.mjs` that is not in the table above.

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
npm run asc:status          # what Apple has right now, and what would change — read-only
npm run asc:release         # plan the release — writes NOTHING
npm run asc:release:apply   # perform the plan
```

A normal release is: read the plan, then apply it. `asc:status` answers the
question the runbook used to answer by opening a browser — it reads the live
listing and diffs it against the repo without writing anything.

```
$ npm run asc:release

App Store Connect · app 6749675615 · version record 1.6.0 (IOS)
Mode: PLAN — nothing will be written
Locales: en-US, es-MX

Existing versions (2)
  1.3.5      READY_FOR_SALE
  1.6.0      PREPARE_FOR_SUBMISSION

REUSE  version record 1.6.0 (state PREPARE_FOR_SUBMISSION)

Description · keywords · promo · What's New · URLs (appStoreVersionLocalizations)
  UPDATE    en-US
      keywords: old,keywords → mafia,prison,stock,invest,empire,dating,…
      whatsNew: 11 chars → 2075 chars · The same life every time, and the fixes…
      supportUrl: https://old.example/support → https://wrexist.github.io/…
  CREATE    es-MX
      description: unset → 1715 chars · Toda vida empieza igual: sin dinero,…

Name · subtitle · privacy URL (appInfoLocalizations)
  UPDATE    en-US
      name: Deep Life Simulator → Deep Life Simulator: Tycoon
      subtitle: Rags to riches money life sim → Careers, crime, crypto, heirs

Planned writes (4)
  PATCH /v1/appStoreVersionLocalizations/vloc-en
  POST /v1/appStoreVersionLocalizations
  PATCH /v1/appInfoLocalizations/iloc-en
  POST /v1/appInfoLocalizations

Nothing was written. Re-run with --apply to perform this plan.
```

### Other flags

| Flag | Effect |
|---|---|
| `--version 1.6.0` | override the record to create (default: `APPLE.storeVersion`) |
| `--build 1234` | attach that `CFBundleVersion` to the version record |
| `--submit` | submit for review. **Requires `--apply`.** |
| `--retarget` | renumber an existing editable draft to `--version` (see below) |
| `--only whatsNew` | write only these fields, comma-separated. See below |
| `--json` | machine-readable plan on stdout |

## Where the copy lives

`marketing/aso/metadata.mjs`, all of it — `storeVersion`, `name`, `subtitle`,
`keywords`, `description`, `promotionalText`, `whatsNew`, `urls`, and the same
fields again under `localized['es-MX']`. `npm run check:aso` validates every
character count, the cross-field keyword rules, the URLs (https, present, and
pinned to the app's own `PRIVACY_POLICY_URL`), and refuses a shipped locale
missing its release notes, since its store page would otherwise show English
notes under translated copy.

`scripts/lib/ascRelease.mjs`'s `desiredListing()` is the one function that turns
that file into per-locale attributes. The CLI never decides what the copy is.

Locales marked `shipped: false` (en-GB) are never created — those storefronts
already fall back to en-US.

Keep the three descriptions of a release in step, in the same commit:

| File | Audience |
|---|---|
| `marketing/aso/metadata.mjs` | the App Store product page |
| `lib/config/changelog.ts` | the in-app What's New feed |
| `WHATS_NEW.md` | the prose write-up, and why |

## Sending one field, not the listing

```bash
npm run asc:release -- --only whatsNew --apply
```

Not every change is a release. Release notes ship with every build; the app
NAME costs a review cycle and dilutes a brand; promotional text is the one
field Apple lets you change any time, with no review at all. Sending all three
because you wanted one of them is how an unrelated decision rides along with a
routine push, so `--only` narrows the run and reports the rest as `NOT IN
SCOPE`.

Valid names are exactly the fields in the table at the top. A misspelling
(`--only whatsnew`) is refused rather than quietly narrowing to nothing and
reporting success.

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
refuses and names the number it found. `--retarget` is a convenience, not an
exemption: renumbering a draft is checked against the same rule.

**It will not create a SECOND editable version.** App Store Connect holds one at
a time, so asking for 1.6.0 while a 1.5.0 draft is open is a 409 from Apple and
a trip to the UI. The plan refuses first and names both ways out: release
against the number it found (`--version 1.5.0`), or renumber that draft
(`--retarget`).

**It will not write to a live app record.** Name and subtitle can only be
changed on the *editable* `appInfo`. If none exists — no version is being
prepared — it says so rather than picking the live one.

**It will not blank a field it has no opinion about.** A field absent from
`metadata.mjs` is omitted from the payload, never sent as an empty string,
which to Apple is a real value that would erase whatever is there.

**It will not write a field that already matches.** A locale whose stored
attributes equal the intended ones produces no request at all, so a second run
is a genuine no-op.

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

**Do not name attributes in a sparse fieldset unless you need to.** The reads
here fetch `appStoreVersions` and `appInfos` with no `fields[…]` parameter, and
that is deliberate. The script previously asked for
`fields[appStoreVersions]=versionString,appStoreVersionState,createdDate` and
Apple answered every single run with

```
HTTP 400: A parameter has an invalid value: 'appStoreVersionState' is not a valid field name
```

before the plan printed a line. `appStoreVersionState` is the name of the
deprecated *enum type*; the attribute is `appVersionState`, with `appStoreState`
as the deprecated one older records still carry. The reader had a `??` fallback
across both, so the mistake was invisible in code review and in the tests —
whose fixtures were written from the same wrong belief. The default attribute
set costs a few hundred bytes and cannot be invalidated by a rename. The fake
API in `__tests__/tooling/fixtures/ascFakeApi.mjs` now returns that exact 400
for any request that names one of those fieldsets.

The same rename runs through the state values: `READY_FOR_SALE` became
`READY_FOR_DISTRIBUTION` and `PROCESSING_FOR_APP_STORE` became
`PROCESSING_FOR_DISTRIBUTION`. `RELEASED_STATES` lists both spellings, because
reading only the modern one under-reads the version floor — which is precisely
how a store version number walks backwards.

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
