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
- Full suite and final preflight: running; final totals will be recorded below.

During verification, fixed duplicate Contacts list headers, portrait/frame
scaling on tablet, excessive tablet enlargement, stale static navigation tests,
unused imports from the token migration and six explicit simulation-parameter
types. A documentation BOM caught by the encoding test was removed. No test or
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
