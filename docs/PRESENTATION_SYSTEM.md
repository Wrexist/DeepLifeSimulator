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

## Approved design baseline - 27 September 2026

The user explicitly approved the creator UI cleanup as the design to preserve.
Reference: `tasks/release/evidence/creator-ui-cleanup-2026-09-27/gallery.html`.
Keep solid navy surfaces, restrained semantic accents, compact artwork, readable
labels, stable selection geometry and primary actions visible on compact phones.
Show meaningful choices directly; disclose secondary detail instead of repeating
status panels. Use the canonical spacing/radius tokens and 44-point minimum
interactive targets. Preserve the recognizable HUD. Extend this direction to
other screens rather than replacing it with a new visual theme.

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
background music are required. `expo-audio ~1.1.1` and its direct `expo-asset ~12.0.13` peer match SDK 54. Settings and app
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

## Follow-through: shared controls and Settings

HUD utility buttons use one circular surface; the settings/season glyph has no
inner bloom, and the store keeps a steady circular footprint. Shared dialogs use
live window dimensions and reduced-motion preferences. Button labels may wrap,
secondary actions use paired theme text/surfaces, and actionable controls target
at least 44 points. Locked-app explanation buttons remain operable and announce
the lock through their label and requirement hint.

Settings leads with player preferences. Save-slot exit must await a successful
canonical durable save before suspending life autosave and navigating. A failed
write leaves the player in the active life; a pending exit cannot be double-tapped.

Current evidence: `tasks/release/evidence/game-polish-2026-09-26.md`.

## In-screen tab overflow

Use `SegmentedControl` for in-screen tabs. Short fixed groups share the row and allow labels to wrap; every tab is at least 44 points high. Use `scrollable` for long names or larger groups (Bank Pro, Travel, luxury categories). Scrolling groups keep natural label widths, expose previous/more controls only when content overflows, and reveal the selected tab after selection or resize. Arrow scrolling never changes selection. Scroll movement respects reduced motion; locked-tab semantics stay with the existing unlock handler. Native Larger Text and VoiceOver acceptance must still be checked on device.

## Currency and cadence

Use `utils/moneyFormatting.formatMoney` for summary money, catalogue prices, reward ranges and monetary deltas. Keep the sign before the dollar symbol. Show `/wk` for weekly amounts and `per job` for one-off Work rewards; both ends of a reward range carry the currency symbol. Diet prices, affordability explanations and active-plan summaries must share the same weekly value and formatter. Statistics highest salary is weekly, not annual.

Keep precise stock/crypto quotes, per-viewer rates and exact banking/transaction confirmations at their required precision. Do not round or abbreviate the underlying amount, alter economy formulas, or use formatting as input to a transaction.

## Education decisions

Use `formatStudyDuration` for exact weeks in the catalogue, enrollment quote and course progress. The quote may shorten the duration for policy benefits; show that reduction explicitly. A zero net quote uses `Enroll free` and omits cash/loan choices. Paid enrollment names both the payment and enrollment action, keeps cash-after-tuition/non-refund information, and discloses loan repayment before confirmation. Name automatic classes before the picker; manual selection replaces the fallback. Preserve canonical quote and enrollment actions.

## Personal contact actions

Call, Hang out, borrowing, lending and non-family bond building use `PersonalContactActions` decision rows. Show money/effect explanations before tapping, with readable reasons for weekly cooldown, insufficient cash or a maximum bond. Explain borrowing as debt and direct both repayment and collection to Favors. These actions have no energy charge; do not invent one. Mood-dependent bond gains must not be presented as a guaranteed flat gain. Keep family eligibility and the canonical atomic handlers intact.

## Pulse authored feed

Ambient public copy draws without replacement from a local authored pool; a different post ID does not make repeated text distinct. Known-contact posts prefer recent recorded life events and interactions, then mood/personality copy. Future or stale records must not be presented as current news. Keep posting eligibility, engagement/reward rules, player posts and saved history with their existing owners. New feed writing must not create notifications, rewards or invented player milestones, and requires no AI/network service.

## App navigation headers

AppHeader uses one leading Back/title arrangement, with optional trailing status or actions. Do not opt individual apps into centered title geometry. Branded search/toolbars may keep their specialized layout but must use AppBackButton as the leading control; secondary tools stay trailing. Back retains the existing parent-screen callback and an accurate destination label. Overlay Close remains a dismiss action rather than being conflated with Back. The persistent HUD and primary navigation are unchanged.
