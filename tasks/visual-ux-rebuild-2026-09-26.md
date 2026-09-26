# Visual and UX rebuild — 26 September 2026

Base: main `9e729ac2`, 2.15.0, schema 51. Branch:
`codex/visual-ux-rebuild-2026-09-26`. No open PRs at start. Prior local work
remains in `pre-sync-local-work-2026-09-26`; do not pop it into this branch.

## Inventory and implementation checklist

- [x] Inspect repository, navigation, presentation primitives, avatar codec,
  onboarding builder, state defaults, save constraints and asset toolchain.
- [x] Unify semantic surface, text, finance and interaction tokens. Keep scaled
  geometry in utils/scaling; reuse existing Card, ScreenHeader, AppHeader,
  SegmentedControl, ProgressRing, EmptyState and BaseModal families.
- [x] Preserve the two-column TopStatsBar and canonical week handler. Establish
  stable Home / Work / Apps / Life / Profile navigation and shared screen chrome.
- [x] Improve Home identity/goals, Work opportunities, app tiles, Life vitals,
  finance overview and long-term Profile using authoritative selectors/actions.
- [x] Create and integrate a curated GPT portrait family; improve creator preview,
  selection and randomization, with no network rendering or save migration.
- [x] Migrate remaining presentation literals to canonical tokens; verify both
  dark/light contrast and preserve distinctive fictional app branding.
- [x] Run type, route, lint/UI/content gates and relevant rendering, onboarding,
  avatar, save, weekly, purchase and navigation tests. Inspect phone/tablet web UI.
- [x] Record exact results, native acceptance gaps and PR checks; no production
  merge, OTA, paid build or store submission is authorized.

## Findings and boundaries

Initial inventory: onboarding MainMenu, SaveSlots, Scenarios, Customize and Perks; playable
Home, Work, Apps, Life (Profile is now the fifth destination). Hidden routes mobile/computer host the same launcher;
health/market/progression are embedded by Life and remain deep-linkable. Apps
uses a common launcher with eager app imports and real device/unlock gates.
The long-term progression route can become Profile without duplicating state.

Phone/computer apps include Spark, Contacts, Pulse, Bank, Education, Hustle,
Stocks, Pets, Crypto, Real Estate, Dark Web, YouVideo, Streaming, Travel,
Politics, Statistics and Garage. Preserve their action owners and navigation.
AppHeader already supplies common back navigation; themed cards and segmented
controls should be fixed centrally rather than forked per app.

Theme color ownership exists in lib/config/theme.ts but literal navy/slate
colors remain widespread. Geometry lives in utils/scaling.ts; stat identity in
lib/config/statIdentity.ts; text hierarchy in lib/config/hierarchy.ts. Do not
introduce a competing unscaled ladder. Existing glass helpers overuse translucent
surfaces and shadows. Adopt solid navy materials behind their compatible APIs.

Avatar: a1 codec, 11 ordered fields; deterministic NPC fallback, aging and family
inheritance. Existing saves must retain their faces. Use optional precomposed
portraits in the existing avatarId string, namespaced `portrait-v1:`; retain a1
config for genetics and vector mode. Portraits are static curated illustrations,
not aging or independently swappable face/hair layers. Make that distinction clear
in the creator. Unknown IDs fall back to the existing vector renderer.

Assets to retain: local AppIcons WebP family, property/vehicle art, editable
game-assets-v1 GLBs and local renders. Missing: cohesive player portraits. Generate
one locked studio portrait family first, not hundreds of incompatible parts.
Functional UI remains Lucide. No generated text, licensed game characters or
branded career logos. Local images only; no realtime 3D dependency.

Save schema remains 51. Do not modify save mutexes, purchase fulfillment,
money/item updaters, feature gates or the weekly simulation. Financial cards use
canonical net worth and existing history, not fabricated charts or weekly returns.
Focus is not an existing general vital; do not invent a persisted stat.

Tests: __tests__/avatar, save/avatarMigration, onboarding, render, components,
startup, navigation/tooling, save/integration, simulation and monetization.
Native StoreKit, ads, VoiceOver, kill/relaunch and signed old-save acceptance
require a device/build and are not established by browser screenshots.

## Art bible / initial manifest

Family `portrait-v1`: six square head-and-shoulders portraits, identical camera,
head scale, shoulder crop, soft key light from upper left, subtle cool rim light,
navy studio background. Premium stylized 2.5D / soft 3D, friendly adult faces,
clean forms, restrained contemporary outfits. No text, watermark or logo.
IDs: ember (warm brown swept hair), cedar (deep skin, short curls), river
(East Asian appearance, straight dark hair), dawn (medium brown skin, dark curls),
sage (fair skin, auburn bob), indigo (brown skin, short hair and glasses).
Inclusive presentation; portrait selection does not set gameplay sex or sexuality.
Normalize to 512px WebP; retain prompts and hashes in art/portraits-v1.


## Implementation delivered

- Canonical surface/text palette migration across the existing app and mini-apps;
  shared card, segmented selection, header and progress polish. Existing stat
  identity remains authoritative; financial category colors are named tokens.
- Stable five-tab navigation, identity-first Home, art-backed lead opportunities,
  responsive app tiles, Life destination art, real Bank valuations/history and
  Profile appearance/settings/help access. Fullscreen app back navigation stays.
- Six GPT-generated curated portraits, offline assets and profile personalization.
  Existing custom creator, aging, vector codec and inheritance are retained.
- Six original editable 3D destinations, optimized WebP renders and pause-aware
  ambient movement; fast press/progress feedback with reduced-motion handling.
- Seven original reproducible sound cues via Expo SDK 54-compatible expo-audio;
  sound settings, silent-switch/background behavior and optional-backend fallback.
- Nonmodal Next Week feedback observes the committed canonical transition.
- Tablet scaling cap corrected after visual inspection; portrait/frame dimensions
  now track the same scale. No horizontal overflow in the five main destinations
  at 375 x 667 or 768 x 1024 browser viewports.

Reference: `docs/PRESENTATION_SYSTEM.md`. Final measured results and native gaps:
`tasks/release/evidence/visual-ux-rebuild-2026-09-26.md`.
