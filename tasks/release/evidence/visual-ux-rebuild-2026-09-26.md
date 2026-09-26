# Visual and UX rebuild evidence - 26 September 2026

Base main: `9e729ac2` (2.15.0). Branch: `codex/visual-ux-rebuild-2026-09-26`.
Save schema: 51, unchanged. No production merge, OTA, paid build or submission.
Original local work remains in `pre-sync-local-work-2026-09-26`.

## Implemented

See [checklist](../../visual-ux-rebuild-2026-09-26.md) and
[presentation contract](../../../docs/PRESENTATION_SYSTEM.md).
The shared navy presentation now spans the game and existing mini-apps, with
five primary destinations, curated portraits, optional custom avatars, six new
original 3D destinations, motion and real sound effects. The approved TopStatsBar
component and canonical state/save/weekly/purchase services have no code diff.

Runtime art: six 512px portraits (200,152 bytes combined) and six 720 x 540 alpha
scene renders (109,680 bytes combined). Original GLBs and generation manifests
are retained. Seven deterministic original WAV cues total 96,672 bytes.
No realtime 3D renderer or network avatar service is added to the app.

## Measured checks

- Lockfile installation: `npm ci`, exit 0. Art toolchain separately installed.
- Source type check and test-tree type ratchet: exit 0; zero type errors.
- Production iOS export: exit 0, 4,051 modules, 13.7 MB Hermes bytecode.
- Art validation: all six portrait dimensions/bytes/hashes pass; all six scene
  renders are 720 x 540 with alpha. New GLBs passed header, triangle-budget and
  imported-model render coverage checks in the existing build pipeline.
- Browser: 375 x 667 and 768 x 1024, all five main destinations, no document
  horizontal overflow. Also inspected 390 x 844, reduced motion, creator modes,
  the portrait sheet, Bank and weekly feedback. No page errors in final journeys.
- Portrait persistence: select Cedar in Profile, save with the canonical action,
  reopen the saved game from the menu, verify Cedar is rendered: pass.
- Bank: real $1,500 net worth and Assets & debts entry: pass. Empty history is
  explained; no fabricated financial chart is shown.
- Next Week: canonical tick advances $1,500 to $1,530, health 100 to 97 and
  happiness 100 to 95; toast reports +$30, -3 and -5: pass.
- Creator: curated portrait mode and custom age-aware mode both reachable: pass.
- Full suite: exit 1, 820 passed / 1 failed / 17 opt-in suites skipped;
  10,010 passed / 1 failed / 32 skipped tests, 308 snapshots passed, 1,304.82 s.
  The sole failure was the new documentation BOM. After removing it (and a BOM
  in the local scratch PR-body file), the entire encoding suite passes: 5/5,
  exit 0. No gameplay test failed and no cases were newly skipped.
- Lint after cleanup: exit 0, zero errors / 700 warnings (unchanged ceiling 701).
- Expo Doctor: exit 0, 18/18 checks. CI identified the required direct
  expo-asset peer; declaring SDK-matched ~12.0.13 fixes native linking metadata.
  The same version was already installed transitively. Repeated npm ci: exit 0.
- Final focused checks: 16 suites / 141 tests pass, exit 0, 28.928 s. Includes
  startup, shared rendering, navigation, curated-avatar migration, audio and encoding.
- Final combined source/test TypeScript check: exit 0. The adaptive portrait
  stylesheet uses the actual dark-or-light theme return type, rather than the
  existing dark-only ThemeColors alias.
- Route check: 17 routes, exit 0. UI ratchet: gradients 152, raw font sizes 94,
  heavy weights 652, all at unchanged ceilings. Content and calendar gates: exit 0.
- Earlier full preflight invocations correctly failed on the now-fixed test types,
  lint imports and final theme annotation. Final gate reruns above are clean;
  complete `npm run preflight` rerun on code revision `fe47c98f`: exit 0.
  GitHub preflight and quality are also green on that revision.

During verification, fixed duplicate Contacts list headers, portrait/frame
scaling on tablet, excessive tablet enlargement, stale static navigation tests,
unused imports from the token migration and six explicit simulation-parameter
types. A documentation BOM caught by the encoding test was removed. Fixed-navy feed
cards retain paired light text for old light-mode saves; new portrait controls
adapt to the modal theme. No test or
lint floors were lowered, and no failing cases were skipped.

## Visual evidence

Browser evidence only; these are not signed-device captures.

- [Compact Home](visual-ux-2026-09-26/visual-compact-home.png)
- [Tablet Work](visual-ux-2026-09-26/visual-tablet-work.png)
- [Character creator](visual-ux-2026-09-26/visual-creator-final.png)
- [Committed week feedback](visual-ux-2026-09-26/visual-week-feedback.png)
- [Bank overview](visual-ux-2026-09-26/visual-bank.png)

## Unreached native acceptance / next concrete task

The Expo SDK 54-compatible `expo-audio ~1.1.1` plugin requires a new native binary.
The next task is exact-build iOS acceptance: sound enabled/disabled, silent
switch, interruptions/background, compact iPhone/iPad, Dynamic Island/safe areas,
keyboard/modal priority, VoiceOver/Larger Text/Reduce Motion, old-save upgrade,
kill/relaunch, purchases/restore/interrupted fulfillment, cloud and ads.
Browser evidence and a Hermes export cannot establish those results.
Existing release gates R06/R08/R09 and production-provider verification stay open.

## Review

Draft PR: https://github.com/Wrexist/DeepLifeSimulator/pull/229. Initial CI
quality passed; update/preflight found the direct expo-asset peer and three
remaining lint warnings. Both causes are fixed in the follow-up. The subsequent theme annotation error
is also fixed and the combined source/test type check passes. Inspect the PR
checks for the final head; browser/unit evidence does not close native gates.

Handoff: all implementation and local verification are complete. GitHub full-test
and coverage jobs were still running at the last inspection; no failing result
was reported on `fe47c98f`. The final evidence-only commit does not change app
code. Next: confirm those checks, then arrange the explicitly authorized signed
build/device acceptance. No build dispatch or production release was performed.
