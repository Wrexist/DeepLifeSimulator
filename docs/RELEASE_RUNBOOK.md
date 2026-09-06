# Release runbook — follow this top to bottom

**One file, in order. Do not skip ahead** — several steps fail in confusing ways
if an earlier one was missed, and each of those is called out where it happens.

Tick as you go. Anything marked 🔴 will break the release if it is wrong;
anything marked 🟡 costs you reach or money but will not break anything.

| | |
|---|---|
| **Time** | ~35 min of work, plus ~40 min of waiting on builds, plus 24–48 h of Apple review |
| **You need** | Apple Developer account, App Store Connect access, a RevenueCat login, a terminal in this repo |
| **Repo state** | Verified below. Everything code-side is done |

---

## Part 0 · Confirm the repo is green (2 min)

Run this first. If anything fails, stop — the rest of the runbook assumes it passes.

```bash
npm install          # a fresh clone has no node_modules; a "failing" suite is usually just this
npx jest --ci
npm run type-check && npm run type-check:tests:ratchet
node scripts/check-lint.js
npm run check:routes
npm run check:aso
```

Verified on this branch:

| Gate | Result |
|---|---|
| `npx jest --ci` | 777 suites (760 passed, 17 `RUN_*`-gated soaks skipped), **9 587 tests passed**, 0 failed (2026-09-04) |
| `npm run type-check` | clean |
| `type-check:tests:ratchet` | 0 errors, baseline 0 |
| `check-lint.js` | 0 errors, 716 warnings (ceiling 716) |
| `check:routes` | 17 routes, no conflicts |
| `check:aso` | all checks pass |
| **Real iOS production bundle** | `expo export --platform ios` succeeds — **3 998 modules**, 13.5 MB Hermes bytecode (2026-09-04) |

> The bundle line matters more than usual. Preflight §4 is a syntax check that
> explicitly defers real bundling, and this repo has shipped a production-only
> bundle crash before (the `React.lazy` incident, CLAUDE.md §5). The avatar work
> added a runtime dependency, so the full export was run rather than trusted.

---

## Part 1 · Bump the version 🔴 (1 min)

Apple **rejects a duplicate build number at submit**, after you have waited for
the build. Doing this now costs one minute; forgetting it costs a full cycle.

- [ ] Open `package.json` and raise `version`.
- [ ] Add the matching entry at the TOP of `lib/config/changelog.ts` (the in-app
      What's New feed). `__tests__/render/whatsNewFeed.test.ts` pins its first
      entry to `package.json`, so a bump without an entry fails `npx jest`, not
      preflight.

```bash
grep '"version"' package.json
```

Read the number off the file rather than off this page — earlier revisions of
this runbook carried a hard-coded "currently" value that went stale within a
release. **If the version in the file has already been uploaded to TestFlight,
raise it.** The Actions tab for `eas-build-local-ios.yml` shows which commit
each upload was cut from; if you are not sure, raise it anyway — the number
only has to climb.

That one field is the single source of truth: `app.config.js` derives the
displayed version and iOS `CFBundleShortVersionString` from it. The iOS build
number comes from `BUILD_NUMBER` at build time, so there is nothing else to edit.

> 🔴 **Do NOT raise the App Store Connect version record to match.** The store
> record (1.x) and `package.json` (2.x) have been deliberately different since
> 1.2.7. Apple never compares them — the only rule is that each store version
> beats the last released one. But store versions can only ever increase, so
> setting the record to 2.x permanently abandons the 1.x line. CLAUDE.md §9.

---

## Part 1b · Check the live events calendar 🟡 (2 min)

Skippable only if you have checked it. The live-events card renders **nothing**
when no event window is open, and a shipped build with a stale calendar looks
completely healthy while showing every player an empty space.

- [ ] Confirm the published calendar still covers the months ahead.

```bash
npm run check:liveops             # runway per stage, both calendars
npx jest __tests__/liveops        # validates the published payload
```

`npm run preflight` runs the first of these, so Part 3 will stop you shipping a
calendar with under 14 days left in it. A weekly `Live ops calendar watch` job
warns at 60 days and blocks nothing.

Two files, and the difference matters:

| File | Reaches players | Fix requires |
|---|---|---|
| `lib/liveops/catalogue.ts` | Compiled into the binary. The offline floor. | A new build |
| `support-site/liveops.json` | Fetched at runtime from GitHub Pages | A push to `main` |

`EXPO_PUBLIC_LIVEOPS_URL` in `eas.json` is what connects the two, and like every
`EXPO_PUBLIC_*` value it is **frozen at build time** — the content at that URL
stays editable forever, the address does not. It is public config, not a secret,
so it belongs in `eas.json` and NOT in `eas env:create` alongside the two keys in
Part 2.

> After release, adding an event is: edit `support-site/liveops.json`, push to
> `main`, and GitHub Pages redeploys in about a minute. Players get it on their
> next launch. `"paused": true` in that file is the kill switch for the whole
> system; `"disabledEventIds"` kills one event. Full contract in
> [`LIVEOPS.md`](./LIVEOPS.md).

---

## Part 2 · Set the two EAS secrets 🔴 (5 min)

Without these the build **refuses every purchase and every save**. They are
opposite in kind, which is the thing to keep straight:

### 2a · `EXPO_PUBLIC_RC_IOS_KEY` — fetch it

- [ ] Sign in at <https://app.revenuecat.com>
- [ ] Pick the DeepLife project (top-left switcher). No project yet?
      `docs/REVENUECAT-SETUP.md` covers creating one first — the key does not
      exist until an app is attached.
- [ ] **Project settings → API keys → App specific keys**
- [ ] Copy the **App Store** row. It starts `appl_`.
      🔴 The `sk_...` row is the *secret* server key. It must never go in the app.

RevenueCat moves its dashboard around, so trust the **`appl_` prefix** over the
menu path above.

```bash
eas env:create --scope project --name EXPO_PUBLIC_RC_IOS_KEY \
  --value appl_XXXXXXXXXXXX --environment production --visibility sensitive
```

### 2b · `EXPO_PUBLIC_SAVE_HMAC_KEY` — generate it

Nobody issues this one. It is the secret the app signs its own saves with.

```bash
openssl rand -hex 32          # 64 hex characters
```

- [ ] Save it in a password manager **before** you paste it anywhere. It cannot
      be recovered or re-derived.

```bash
eas env:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value <the 64 hex chars> --environment production --visibility sensitive
```

> 🔴 **Never rotate this on a live app.** Every save already on a player's device
> is signed with the old key and will fail verification.
> `tasks/leaked-key-rotation-runbook.md` is the procedure if it ever leaks.

Confirm both names exist (values are masked, so this proves the name, not the value):

```bash
eas env:list --environment production
```

Full detail: [`RELEASE_SECRETS.md`](./RELEASE_SECRETS.md).

---

## Part 3 · Preflight 🔴 (3 min)

```bash
npm run preflight; echo "EXIT: $?"
```

- [ ] **Check `EXIT: 0`, not the green banner.**

`npm run preflight` is five commands chained. The cheerful
`✅ ALL PREFLIGHT CHECKS PASSED` box belongs to the *second* of them, so a later
step can fail underneath a green banner. That happened during v2.7.0 and went
unnoticed for several commits. Only `EXIT: 0` means the whole chain passed.

> 🔴 **Do not run this in a shell that still has the screenshot-capture
> variables exported.** `EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION=true` and
> `EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES=true` are hard §8 failures, and the
> message names the variable rather than the shell — a confusing five minutes.
> Open a clean terminal if in doubt.

---

## Part 4 · Build and upload to TestFlight (~40 min, mostly waiting)

- [ ] Commit and push the version bump first.
- [ ] Trigger the build (owner runs this; it is not automatic).

```bash
eas build --platform ios --profile production
```

- [ ] Wait for it to finish, then submit to TestFlight.
- [ ] Install from TestFlight and check three things the emulator cannot:
  - [ ] the app **saves and reloads** (proves the HMAC key was inlined correctly)
  - [ ] a **sandbox purchase completes** (proves the RevenueCat key is right)
  - [ ] character creation renders faces (proves the avatar bundle shipped)

> `eas build --local` never auto-increments the build number. If you build
> locally, set `BUILD_NUMBER` yourself or the submit is rejected as a duplicate.

> **The submission itself takes 10–25 minutes and that is normal.** The
> `iOS TestFlight (local build)` workflow uploads the .ipa to EAS in ~90 s, then
> waits while EAS queues a worker and uploads to App Store Connect. Its
> `Watch the TestFlight submission` step names which of the two it is on and
> heartbeats every two minutes, so a quiet log is not a stuck one — do not
> cancel and rebuild, a rebuild mints a new `CFBundleVersion` for nothing.
> Untick **Watch the submission until App Store Connect accepts it** to end the
> run as soon as the binary reaches EAS; the submission still completes, and
> `npm run submit:watch -- --platform ios` reports how it went afterwards.

> 🟡 **A green watch step means Apple HAS the build, not that Apple accepted
> it.** EAS reports `FINISHED` when the upload lands; validation runs afterwards
> and is where ITMS-91064 and the other privacy-manifest / purpose-string
> rejections surface, by email and as **Invalid Binary** in App Store Connect
> (see §"Privacy manifest" in CLAUDE.md §9). Confirm the build appears in
> TestFlight before you treat the release as shipped.

---

## Part 5 · App Store Connect — metadata (3 min)

**Nothing in this part is typed into App Store Connect.** The listing lives in
`marketing/aso/metadata.mjs`, is validated by `npm run check:aso`, and is
pushed:

```bash
npm run asc:status          # what Apple has now, and what would change
npm run asc:release         # the full plan — writes NOTHING
npm run asc:release:apply   # perform it
```

Or, with the API key already in place: GitHub → **Actions** → **App Store
Connect — release** → mode `plan`, read the summary, then re-run with `apply`.

One pass covers, for **en-US and es-MX**: the version record, What's New, the
description, the keyword field, the promotional text, the support and marketing
URLs, and — on the app record, which is a different Apple resource — the name,
subtitle and privacy policy URL.

- [ ] `npm run asc:release` and read the plan. Every write it would perform is
      listed; a field whose value already matches is reported `UNCHANGED` and
      not written.
- [ ] `npm run asc:release:apply`.

> If the plan refuses with *"an editable version record already exists"*, that
> is App Store Connect's one-editable-version rule, not a bug. Either release
> against the number it names (`--version 1.5.0`) or renumber that draft
> (`--retarget`), which still has to clear the climb rule.

`npm run aso` still prints the paste-ready block with live character counts. It
is now a way to eyeball a field, not the procedure.

Everything below is the reasoning behind the copy, and the one decision in this
part. Change any of it by editing `marketing/aso/metadata.mjs` and re-running
the push — never in the console, or the repo and the store disagree and nothing
tells you which is live.

### 5a · Name 🔴 — this is a decision

The pushed name is:

```
Deep Life Simulator: Tycoon
```

`27/30`. The old name used 19 of 30 characters, and the name field carries the
**highest search weight of any field** — eleven of the most valuable characters
in the listing were empty.

**The trade-off, stated plainly:** this needs a review cycle and slightly dilutes
a brand that already ranks for "deep life". It is the only item in this runbook
that feels irreversible. If you would rather not, edit
`marketing/aso/metadata.mjs` **before** the push: set `name` back to
`Deep Life Simulator`, move `tycoon` into the `keywords` array and remove
`money` to stay under 100. `npm run check:aso` will confirm it still fits, and
everything else in this part still works.

> The on-device app name stays `DeepLife Simulator` (`app.config.js`). That is
> deliberate — changing it would relabel the home-screen icon, which is a
> product decision, not an ASO one. Apple does not require the two to match.

### 5b · Subtitle 🟡

```
Careers, crime, crypto, heirs
```

`29/30`. The subtitle is **indexed for search** — it is a keyword slot that has
to read well, not a tagline slot. The previous one spent eight of its thirty
characters re-indexing "life" and "sim", both already in the app name and
therefore already indexed.

### 5c · Keywords 🟡

The field is built from the `keywords` array and joined with no spaces after the
commas — a space costs a character and buys nothing. No term repeats the name or
subtitle: Apple matches **across** those fields, so a second copy of a word is a
slot thrown away, and `check:aso` fails on one.

> 🟡 The field deliberately runs **under** 100 characters. The unspent room is
> there because every term in it now has a measured popularity score, and
> filling the remainder with unpriced guesses is what put five dead terms in the
> previous version. Price the next candidates in Apple Ads first — the comment
> above `keywords` in `marketing/aso/metadata.mjs` lists them.

> 🟡 `bitlife` is deliberately absent. It is the obvious high-volume term and it
> is a competitor trademark: App Store Review 5.2.5, and a takedown risk on Play.
> It would also bring traffic expecting a different game.

### 5d · Promotional text 🟡

This is the **only field that updates without a review cycle**. Change it in
`metadata.mjs` and run `npm run asc:release:apply` on its own for a seasonal
hook, with no build.

### 5e · Description 🟡

Apple does **not** index this field — it is pure conversion. Only the first three
lines show before the "more" tap, which is why the hook is front-loaded.

> Two claims were removed from the old copy because they are **not true of this
> build**: "no forced ads" (`lib/ads/interstitial.ts` shows full-screen ads at
> in-game year boundaries) and "no pay-to-win" (`utils/iapConfig.ts` sells a
> +50% earnings perk for $1.99). `npm run check:aso` now fails if either comes
> back. Do not re-add them by hand — a player who installs on a promise the app
> breaks leaves a one-star review, and rating feeds the ranking this whole
> section exists to raise.

### 5f · The three links 🟡

Support, marketing and privacy are `APPLE.urls` in `metadata.mjs` and go out
with the same push. The privacy link is pinned to `PRIVACY_POLICY_URL` in
`lib/config/appConfig.ts` — the page the app itself opens from Settings — and
`check:aso` fails if the two ever differ, because two spellings of the same
promise is how one of them goes stale. A link into this repo's own
`support-site/` is checked against the file tree too, so a deleted page fails
the audit rather than the listing.

---

## Part 6 · Screenshots (10 min)

All three sets are built and committed. Nothing to generate.

| Set | Upload to | Path |
|---|---|---|
| iPhone 6.9" **(required)** | iPhone 6.9" Display | `screenshots/appstore-2026/iphone-6.9/` |
| iPhone 6.5" | iPhone 6.5" Display | `screenshots/appstore-2026/iphone-6.5/` |
| iPad Pro 13" | iPad 13" Display | `screenshots/appstore-2026/ipad-13/` |

- [ ] Upload all ten from each folder **in filename order** — `01…` first. The
      first two are the only ones most visitors see.

They are composed from 34 real gameplay captures of the shipping UI, each one
sitting inside one of the game's own shipped art plates, so they satisfy
Guideline 2.3.3 for this build. Two checks back that up rather than a promise:
every caption is verified against the text of the screenshot it sits on by
`__tests__/tooling/storeFrameClaims.test.ts` — which also asserts the real
capture never drops below 55% of canvas height, the way an art-led set turns
into an advert — and `npm run check:store-contrast` measures the headline
against the plate behind it. The caption check exists because an earlier set
captioned "PhD unlocked" over a course catalogue and "Rare collection" over a
screen reading `Collection (0)`.

- [ ] If the UI has changed since the last capture, **re-capture before
      uploading** — do not re-compose from stale frames. Procedure:
      [`../screenshots/appstore-2026/README.md`](../screenshots/appstore-2026/README.md).
      Run `npx jest __tests__/tooling/storeFrameClaims.test.ts` and
      `npm run check:store-contrast` afterwards.

Design rationale, and the list of what was removed for reading as machine-made,
is in [`store-screenshot-design.md`](./store-screenshot-design.md).

- [ ] 🟡 **App preview video is NOT done.** It needs a real device or simulator —
      the web build runs a weekly tick far slower than native, so it is fine for
      stills and useless for video. Shot list:
      [`../marketing/app-preview-video-script.md`](../marketing/app-preview-video-script.md).

---

## Part 7 · The Spanish (Mexico) localisation 🟡 (0 min — already pushed)

**This is the single highest-leverage item in the runbook**, and Part 5 already
did it: `asc-release` creates and fills es-MX alongside en-US, subtitle,
keywords, description, promotional text and What's New together. There is
nothing to add in the language dropdown.

Why it is worth having: the US storefront indexes an app's es-MX metadata
*alongside* its en-US metadata, so this is effectively a second 100-character
keyword field aimed at the same US searchers — while also serving
Spanish-speaking users properly.

- [ ] Confirm the plan in Part 5 listed `es-MX` (as `CREATE` the first time,
      `UNCHANGED` on later runs).

> 🟡 Two honest caveats. Apple does not document the cross-locale indexing, so
> treat it as well-established practice rather than a guarantee — confirm it with
> a before/after on impressions in App Analytics. And ship the **whole**
> localisation: a Spanish keyword field bolted to an English page is a bad
> experience for everyone it reaches, which is why the description is translated
> too and `check:aso` fails if it is missing.

**English (U.K.) is deliberately skipped**, and the script will not create it.
UK, Australian, Canadian and Irish storefronts fall back to en-US when it is
absent, so unlike es-MX it adds nothing unless the terms genuinely differ for
those markets. It is `shipped: false` in the metadata, which is the one place
that decision lives.

---

## Part 8 · Rename the in-app purchases 🟡 (10 min)

Apple **indexes IAP display names**. Ours currently say "100 Gems" and "Starter
Pack" — no search value at all. Each rename below still accurately describes what
is sold, which Apple requires.

**This is the one part of the listing that is still typed by hand.** IAP display
names are product records rather than listing copy — a rename changes what
appears on a live purchase sheet — so they are deliberately outside what
`asc-release` writes. `APPLE.iapRenames` in `metadata.mjs` is the list; length
is audited, the edit is yours.

In **App Store Connect → Features → In-App Purchases**, edit the *display name*:

| Current | Change to |
|---|---|
| Starter Pack | `Millionaire Starter Pack` |
| Premium Pack | `Tycoon Premium Pack` |
| Ultimate Pack | `Empire Ultimate Pack` |
| Mega Pack | `Billionaire Mega Pack` |
| Lifetime Premium | `DeepLife+ Lifetime` |

- [ ] Done, or consciously skipped.

> This is a console-only change. The names inside the game come from
> `utils/iapConfig.ts` and are separate — **do not edit that file for this**, it
> would change the in-game shop UI.

---

## Part 9 · Submit for review

- [ ] Attach the build from Part 4.
- [ ] Answer the export-compliance and content questions.
- [ ] 🔴 Re-attach every IAP and subscription to the version. A rejection returns
      each attached purchase marked "Rejected" even when nothing is wrong with
      them — they have to be resubmitted with the next build.
- [ ] Submit.

**If it is rejected**, the two most likely causes for this app, both pre-checked:

- *Guideline 2.3.1, inaccurate metadata* — the description no longer claims
  anything the build does not do. `npm run check:aso` enforces that.
- *ITMS-91064, privacy manifest* — `NSPrivacyTracking: true` with an empty
  `NSPrivacyTrackingDomains` is rejected, and an empty array is not a fix.
  Preflight §5b already blocks this before a build starts. CLAUDE.md §9.

---

## Part 10 · After it is approved

- [ ] 🟡 **Start a Product Page Optimization test.** Apple A/B-tests the
      subtitle, icon and screenshots for free, up to three treatments. The
      subtitle in Part 5b is a considered guess; PPO is how it becomes a measured
      one. App Store Connect → your app → Product Page Optimization.
- [ ] 🟡 **Replace the placeholder social preview image.** Every share of the App
      Store link currently renders an Apple placeholder — on Discord, iMessage, X
      and Reddit alike. Cheapest fix on this list.
- [ ] 🟡 **Submit a featuring nomination.** Solo developer, rebuilt the in-game
      economy from player feedback. Free, ~15 minutes, and Apple editorial
      actively looks for that story.
- [ ] 🟡 Watch **App Analytics → impressions** for a week to see whether Part 7
      moved anything.

---

## Part 11 · Google Play (Android)

Play differs from Apple in one way that changes the copy: **it indexes the long
description.** That is why the Play text is written separately rather than reused.

- [ ] Title: `Deep Life Simulator: Tycoon`
- [ ] Short description (80): `Career, crime, stocks and property. Build a fortune, then pass it on.`
- [ ] Long description: the `[Play · Long]` block from `npm run aso`
- [ ] Screenshots: upload the **iPhone 6.9"** set — Play accepts them
- [ ] Data safety form: [`DATA_SAFETY.md`](./DATA_SAFETY.md)
- [ ] Content rating questionnaire (the game contains crime and gambling themes —
      answer honestly; an inaccurate rating is a takedown risk)

---

## If you change any copy later

Do not edit the store consoles from memory, and do not edit the old
`marketing/aso-v2.7.0-paste-ready.md` — it is superseded and wrong.

```bash
# 1. edit the copy
$EDITOR marketing/aso/metadata.mjs
# 2. this fails on anything over a limit, duplicated across fields, or untrue
npm run check:aso
# 3. reprint
npm run aso
```

The audit exists because every one of these failures is **silent**: Apple
truncates an over-long subtitle mid-word without telling anyone, and a term
repeated between the name and the keyword field is simply a slot thrown away —
no error, no warning, just a listing that ranks for less than it could.
