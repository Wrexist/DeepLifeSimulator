# Immersive Home and modular 3D assets

The owner rejected photographic generated art for the game and requested
transparent assets or actual Three.js models. This change implements that
direction with original parametric geometry and a limited Home integration.

## Delivered

- 18 editable GLB models, matching transparent PNGs, and a local model viewer.
- Three compact transparent WebP environments on Home, selected by canonical
  housing state. Cash and investment properties cannot invent a residence.
- First-job guidance beside the environment and the existing weekly result
  immediately below it. Identity, goals, Shop navigation and simulation actions
  remain available.
- A single environment transition, two coach attention pulses, and reduced-motion
  handling. Dark text makes the gold completion button legible.

See `art/game-assets-v1/README.md` for rebuilding, coordinates and asset limits.
Business models and standalone props are delivered for further integration;
they are not yet wired into the corresponding game screens.

## Verification

- 13 Jest suites, 151 tests passed: startup, housing scene/provider transitions,
  state-driven hierarchy, first-session coaching and weekly recap completeness.
- App and test TypeScript checks passed; quick preflight routes passed.
- Scoped ESLint: zero errors, one existing internal-require warning in Home.
- UI ratchet passed without raising any ceilings.
- Production Expo web export succeeded using an ephemeral local preview key.
- Browser review at 390×844, 375×667 and 768×1024. Real Play → Find a job →
  Apply → advance week → Home flow succeeded. One observed life earned $142,
  and both coach and recap agreed with the change from $1,500 to $1,642.
- All 18 delivered GLBs passed header/length checks and GLTFLoader round-trip
  rendering. PNG alpha coverage and per-category triangle budgets passed.

The smaller viewport scrolls to the weekly recap and completion action. The
existing floating decision notification remains part of the app. Review PNGs
are browser captures, not App Store exports or native-device verification.
Native iPhone performance, VoiceOver/Dynamic Type and Unity/Unreal imports have
not been verified. There is no release build or live 3D renderer added to the app.

An additional fresh-life run earned $30 while its application remained pending.
The existing coach treats any income as its paid step, so it can show the work/pay
copy for non-wage income. This predates this presentation change; the images in
`art/game-assets-v1/review/` capture that second run. A separate coaching logic
follow-up should distinguish wages from other receipts.
