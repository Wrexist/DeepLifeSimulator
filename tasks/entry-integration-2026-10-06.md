# Entry integration — 6 October 2026

User authorized continuing the reviewed opening into the app and requested the
real app icon instead of the placeholder monogram.

- [x] Replace placeholder brand in source and portable prototype.
- [x] Integrate interactive chapters into Custom life; preserve Quick Start,
  Continue, slot safety, scenario selection and creator controls.
- [x] Run focused onboarding tests, types, lint and browser checks.
- [x] Update todo and record remaining artwork/native acceptance work.

Scope is the next entry-flow implementation task. Historical release/build
items do not authorize publishing, a paid build or changes to production.

## Implemented

`app/(onboarding)/Intro.tsx` is a registered React Native route. Custom life
still checks for a free slot before navigating; Intro replaces itself with
Scenarios on Skip or completion. Quick Start/Continue are unchanged. Direction,
story moment and legacy selections are local UI state, never game rewards or
save edits. Back retains selections within the opening. Android back, safe-area
insets, scrollable text, reduced-motion transitions and localized copy are used.

Actual `assets/images/icon.png` is verified against `app.config.js` and appears
in the app and both preview forms. Existing portraits/props remain bundled.
The portable HTML is now 2,421,581 bytes because it embeds the original icon.

## Evidence

- Five focused onboarding suites: **74/74 passed**, exit 0, 7.272 seconds.
  Updated the obsolete direct-to-Scenarios expectation to verify Intro then
  Scenarios and no save pipeline in Intro. Slot safety/flow/quick-start checks pass.
- Source TypeScript and changed-file ESLint: exit 0. Route guard: exit 0.
- Live Expo web: 320x568, 375x667 and 768x1024, no page errors. Choice/reveal,
  Back retains story state, completion to Scenarios and Corporate Intern to
  Identity pass; separate Skip-to-Scenarios case passes.
- Revised offline prototype: six layout cases and keyboard/reduced-motion
  checks pass, exit 0. All bundled images including the real icon load.
- Raw results and screenshots: `release/evidence/entry-integration-2026-10-06/`.
- Main refreshed to `fc7e17a46f785ba012f8b358bd2e3d36e5b91c4d`; no open PRs.
  No push, merge, build or deployment performed.

Native VoiceOver focus, Larger Text, device safe areas and signed-device
acceptance remain unverified. Browser evidence is not native acceptance.
Remaining todo is explicit: entry illustration batch and SaveSlots framing,
then Profile/celebrations and catalogue review. Original asset Group D/E exports
are not made complete by integrating this interactive UI.
