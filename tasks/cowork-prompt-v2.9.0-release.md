# Cowork prompt — ship 2.9.0 as App Store version 1.5.0

Paste everything inside the fence below into a fresh Cowork session on this
repo. It is written to be self-contained: it names the two blockers that are
actually real today, the numbers to hit, and the one footgun that is a one-way
door if it gets it wrong.

Facts it encodes, measured on 2026-08-17 at `17191ab`:

- `npm run preflight` — all 11 sections **PASS**. The only failing gate is
  `lint:ratchet`: **931 warnings against a ceiling of 860**.
- `expo-doctor` drift (three SDK 54 patch versions) is already fixed on this
  branch. If the agent sees it again, Expo published newer patches.
- Store metadata ships **two** locales: `en-US` and `es-MX`. `en-GB` is
  reference-only (`shipped: false`).
- `marketing/aso/metadata.mjs` has **no** release-notes field. The 2.9.0 copy
  lives in `WHATS_NEW.md` and nothing validates it.
- `scripts/next-build-number.mjs` already contains a dependency-free App Store
  Connect API client (ES256 JWT). It is the reference implementation if the
  agent is asked to automate the version record.

---

```text
Ship DeepLife Simulator 2.9.0 to the App Store as version record 1.5.0.

Work on a branch off main named `claude/release-1.5.0`. Read CLAUDE.md first
and follow it — especially §9 (releases), §8 (testing) and §11 (working
agreements). Write a plan to tasks/todo.md before you write code.

## The one thing you must not get wrong

There are TWO version numbers and they are deliberately different.

  package.json version = 2.9.0  -> the BINARY. TestFlight, crash reports,
                                   the in-app version display. Already bumped;
                                   do not touch it unless 2.9.0 has already
                                   been uploaded to TestFlight, in which case
                                   raise it to 2.9.1.
  App Store Connect     = 1.5.0  -> the VERSION RECORD users see on the store
                                   page. This is what you are creating.

Do NOT set the App Store Connect record to 2.9.0 "to match". Store version
numbers can only ever increase, so that is a one-way door that permanently
abandons the 1.x line. Apple never compares the two. CLAUDE.md §9 explains
this; docs/LAUNCH-v2.8.0-STEP-BY-STEP.md notes that two committed docs
disagreed about whether the next record was 1.4.0 or 1.5.0 — the owner has
settled it: it is 1.5.0. Correct CLAUDE.md §9 and
docs/RELEASE-2.7.0-SUBMISSION.md so they agree, and say so in the PR.

## Phase 1 — Make `npm run preflight` pass (this is the only real blocker)

All 11 preflight sections already pass. `lint:ratchet` does not:

  931 warnings, ceiling 860, 0 errors.

Get to 860 or below by DELETING warnings, never by raising the ceiling —
scripts/lib/ ratchets are a one-way gate and CLAUDE.md is explicit that you
fix what is there rather than move the bound. Then LOWER the ceiling to
whatever you actually land on, in the same commit, to lock the win in.

Current breakdown (`npx eslint . --ext .ts,.tsx -f json`):

   246  @typescript-eslint/no-unused-vars      <- start here, safest
   223  no-restricted-syntax
   151  @typescript-eslint/no-require-imports
   146  react-hooks/exhaustive-deps
    45  import/first
    34  @typescript-eslint/array-type
    26  no-unused-vars
    10  import/no-duplicates

  Worst files: lib/simulation/BugHunterSimulator.ts (48),
  contexts/game/MoneyActionsContext.tsx (39),
  contexts/game/GameActionsContext.tsx (32),
  lib/simulation/runComprehensiveTests.ts (20),
  components/work/workScreenStyles.ts (18), components/ErrorBoundary.tsx (17),
  contexts/game/CompanyActionsContext.tsx (17)

You only need to remove 71 to clear the ceiling, so take the mechanical wins
first — unused vars, array-type, import/first, import/no-duplicates — and stop
when you are comfortably under. Two warnings need judgment, not a bulk edit:

- `no-require-imports` on internal modules degrades types to any/never, and
  clearing a directory of them has TWICE turned up a real player-facing bug
  (CLAUDE.md §5). If you clear any, read what the erased types were hiding
  rather than just converting the syntax. "It's a cycle-breaker" is a claim to
  CHECK against the static import graph, not to inherit — and `import type`
  edges cannot form a runtime cycle.
- `react-hooks/exhaustive-deps`: a previous pass read all 98 of these and
  found exactly 1 real. Do not bulk-add dependencies; that is how render loops
  and the whole-state re-subscription regression in tasks/lessons.md happen.

Anything you cannot fix safely, leave and say why.

## Phase 2 — Put the release notes where the tooling can see them

The 2.9.0 player-facing copy is already written and reviewed:

- lib/config/changelog.ts  -> the in-app What's New feed (10 change groups)
- WHATS_NEW.md             -> the store block, plus a "what changed and why"

But marketing/aso/metadata.mjs has NO release-notes field, so the store copy
lives in a doc that `npm run check:aso` never validates. Fix that:

- Add a `whatsNew` field to APPLE for `en-US`, sourced from the store block in
  WHATS_NEW.md, and a Spanish `whatsNew` under `localized['es-MX']` matching
  the register of the existing es-MX description (it is a real translation
  already, not machine output — match it).
- en-GB is `shipped: false` and must stay that way. Do not create it.
- Extend scripts/check-aso.mjs to validate `whatsNew` the way it validates the
  other fields: Apple's limit is 4000 characters, and `--emit` should print it
  paste-ready per shipped locale.
- Keep the three files consistent. If you change wording, change it in all of
  them; __tests__/render/whatsNewFeed.test.ts guards the in-app copy against
  jargon and over-long bullets, and it must stay green.

## Phase 3 — Set up 1.5.0 in App Store Connect

Check whether App Store Connect API credentials are available in this
environment (ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 — the same three the iOS
build workflows use). Then take ONE of these two paths and tell me which.

PATH A — credentials available. Automate it.
  scripts/next-build-number.mjs already signs an ES256 JWT and calls
  api.appstoreconnect.apple.com with no external dependency. Extract that
  client into something reusable and write `scripts/asc-version.mjs` that:
    1. reads the app by ascAppId 6749675615 (it is in eas.json submit config)
    2. finds the highest RELEASED version record and refuses to continue if
       1.5.0 does not beat it — print what it found, do not guess
    3. creates the 1.5.0 version record (platform IOS) if absent
    4. writes appStoreVersionLocalizations `whatsNew` for en-US and es-MX from
       marketing/aso/metadata.mjs — one source of truth, no copy-paste
    5. runs read-only by default and only writes under an explicit --apply
       flag, printing the exact diff it would send first
  Do NOT submit for review from a script. Creating the record and filling the
  copy is the automatable part; attaching a build and hitting Submit is the
  owner's call.

PATH B — no credentials. Produce the checklist instead.
  Write docs/RELEASE-1.5.0-SUBMISSION.md following the shape of the existing
  docs/RELEASE-2.7.0-SUBMISSION.md and docs/LAUNCH-v2.8.0-STEP-BY-STEP.md:
  every App Store Connect field with its exact final value, in the order the
  UI presents them, so it can be worked top to bottom without a decision.
  Include the en-US and es-MX What's New text in full, ready to paste.

Either way, carry forward the two known submission traps from CLAUDE.md §9:
  - A metadata rejection returns EVERY attached IAP and subscription marked
    "Rejected" even when nothing is wrong with them. That is normal; they get
    resubmitted with the next build. Say so in the doc so it does not cause
    a panic.
  - The privacy manifest and NSUserTrackingUsageDescription are both already
    guarded by preflight §5b/§5c, so they should pass — but they fail AFTER
    upload, which costs a full round trip.

## Phase 4 — Verify, and be honest about what you did not do

Run and paste the real output:
  npm run type-check
  npm run type-check:tests
  npm run lint:errors && npm run lint:ratchet
  npm run check:routes
  npm run check:aso
  npm test
  npm run preflight        <- the gate; it must pass end to end now

Do not report anything as done without showing the output. If a suite fails in
a cold container, run npm install before believing it — that false red is
recorded twice in tasks/lessons.md.

Two preflight WARNINGS are non-blocking and are NOT in scope unless they are
trivial. Report them, do not silently fix them:
  - iOS interstitial ad unit not configured, so interstitials earn nothing
    (EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS is unset)
  - 18 images in assets/ are referenced by nothing (repo weight, not download
    size — they do not ship)

## Done means

  - npm run preflight passes end to end, with the lint ceiling LOWERED to the
    number you actually achieved
  - the store copy for 2.9.0 lives in marketing/aso/metadata.mjs for both
    shipped locales and check:aso validates it
  - CLAUDE.md §9 and docs/RELEASE-2.7.0-SUBMISSION.md agree that the next
    store record is 1.5.0
  - either scripts/asc-version.mjs exists and has been run in read-only mode
    against the real app, or docs/RELEASE-1.5.0-SUBMISSION.md is complete
  - one PR, with the verification output in the body, and an explicit list of
    anything you left undone and why

Do not trigger an EAS build. The owner triggers builds.
```
