# Deep Life presentation system

The existing Expo / React Native / Expo Router architecture remains canonical.
All presentation work starts with these shared owners:

| Concern | Owner | Contract |
| --- | --- | --- |
| Semantic materials and text | `lib/config/theme.ts` | `useTheme()` for adaptive surfaces; `uiPalette` for deliberately fixed navy game surfaces and fictional app branding. |
| Vitals | `lib/config/statIdentity.ts` | Health coral, happiness amber, energy blue. Existing fitness identity remains; no invented focus stat. |
| Financial categories | `financeColors` in theme | Cash green, investment violet, property pink, vehicle orange, premium blue/violet, debt red. |
| Geometry | `utils/scaling.ts` | Reuse responsiveSpacing and responsiveBorderRadius. Tablet enlargement is capped at 1.2; text at 1.15. System font accessibility scaling is separate. |
| Text hierarchy | `lib/config/hierarchy.ts` | Display/headings/body/caption/numeric aliases, shared tiers, scaled line height and tabular headline numbers. |
| Cards and sections | `Card`, `ScreenHeader`, `SectionHeader`, existing list primitives | Solid navy surfaces, subtle borders, predictable padding. Avoid a new component for every screen. |
| Selection/actions | `SegmentedControl`, `GradientButton`, `MotionPressable` | Clear selected/pressed/disabled states; labelled controls; restrained movement. |
| Progress | `ProgressBar`, `ProgressRing` | Actual values, accessible progress labels; reduced-motion support. |
| Modals | `BaseModal` and existing modal owners | Scrollable content; preserve existing priority/ownership. |
| Chrome | `(tabs)/_layout.tsx`, `TopStatsBar` | Home, Work, Apps, Life, Profile. Approved HUD information architecture and canonical weekly action remain intact. |

The main tab bar is stable. Existing simulated applications retain their fullscreen
mode and explicit back navigation; purchase, device and feature gates stay with
their existing owners. Do not create fake app data to fill the layout.

## Character identity

`CharacterAvatar` accepts existing vector identities plus six optional
`portrait-v1:*` IDs. A curated portrait is a static illustration; it does not
pretend to age or provide independently editable hair/clothing. The Custom mode
retains all existing editable features, genetic inheritance and aging. Existing
`avatarId` is already an optional string, so no state schema change is needed.
The underlying encoded vector identity is preserved for family inheritance.
Unknown portrait IDs fall back to vector rendering. All artwork is bundled.

The creator supports curated selection, previous/next, randomization and live
preview, alongside existing custom feature categories. Profile's Your look sheet
applies cosmetics through the current state updater and canonical save action.
Cancel does not write. Identity, sex, currency and progression are unaffected.

## Motion and sound

`SceneCard` renders original GLB scenes as local WebP. Slow, subtle depth movement
uses the native driver and pauses for reduced motion, background and blur.
Presses and progress changes use brief feedback. The week toast and sound bridge
observe committed `weeksLived` changes; neither runs or duplicates simulation.
They suppress feedback across a different lineage/generation.

Seven original synthesized WAV cues are reproducible with
`node scripts/build-game-audio.mjs`. No licensed samples, recording permission or
background music are required. `expo-audio ~1.1.1` matches SDK 54. Settings and app
lifecycle control playback; the iOS silent switch is respected. Lazy backend
loading degrades safely on older native binaries. The new audio plugin requires
a new native build and signed-device playback/interruption verification before
release; browser playback is insufficient. OTA remains disabled.

## Asset provenance

- `art/portraits-v1/manifest.json`: GPT prompts, dimensions, optimized file hashes.
- `art/game-assets-v1/manifest.json`: editable geometry, GLB checks, render coverage.
- `assets/audio/manifest.json`: original deterministic synthesis and file hashes.

Native acceptance must cover compact iPhone and iPad, Larger Text, VoiceOver,
Reduce Motion, silent switch/audio interruptions, keyboard, modal priorities,
old-save/relaunch, purchases/restore and ads on the exact signed build.
