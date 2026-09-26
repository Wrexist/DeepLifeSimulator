# Whole-game polish follow-through

Baseline: draft PR #229 at b7f3d12e; remote main 9e729ac2. Preserve HUD,
schema 51, game rules and existing saves. No publishing in this task.

- [x] Reproduce and fix Settings -> save-slot switching losing unsaved actions.
- [x] Improve shared modal responsiveness, reduced motion and accessible controls.
- [x] Align secondary-app headers, buttons and empty states with the navy identity.
- [x] Make locked apps explain their requirements without misleading disabled semantics.
- [x] Review primary tabs, Settings and all unlocked secondary-app entry screens at phone/tablet sizes.
- [x] Run focused regressions, full suite for save changes, and preflight; record exits.
- [x] Publish review screenshots and update the per-screen acceptance inventory.

Native-only cases remain UNREACHED until an exact signed candidate is available:
VoiceOver, Larger Text, audio interruptions, purchases/restore, ads, kill/relaunch.

All 38 secondary-app entry checks passed. Nested player journeys remain in the acceptance inventory; no claim of exhaustive gameplay/device acceptance.
