# UI/UX Polish Master Pass — plan (branch claude/deep-life-ui-ux-polish-y7nbgw)

Grounded in four audits (design tokens, screens/UX states, game feel, accessibility).
Principle: fix root causes by wiring up the good infrastructure that already exists,
not by inventing a parallel one.

## Phase 1 — Game feel foundation (highest impact:effort)
- [x] 1.1 Install `expo-haptics` (SDK-54 matched). All 107 `haptic.*` call sites are
      currently dead code because the package was never a dependency. `utils/haptics.ts`
      already lazy-requires it in try/catch, so builds without it stay safe.
- [x] 1.2 Flip `settings.hapticFeedback` default to `true` (initialState, safeGameState,
      saveValidation repair) — `utils/haptics.ts` already defaults `_enabled = true`;
      the two systems currently disagree and haptics-on is the genre default.
- [x] 1.3 Unify the two haptic systems: `utils/feedbackSystem.ts` uses raw
      `Vibration.vibrate` (flat buzz) and reconfigures a global singleton during render.
      Route its haptic path through `utils/haptics.ts` intents.
- [x] 1.4 Stat-change pills work on every tab, not just Home: move
      `useStatChangeTracker(gameState)` from `app/(tabs)/home.tsx` to the tabs layout;
      delete the shadowing dead duplicate hook in `components/ui/StatChangeIndicator.tsx`.
- [x] 1.5 Adopt the dead `theme.animation` tokens: wire into `MotiStub` default duration
      and `usePressableScale`.
- [x] 1.6 Prestige celebration parity with PromotionCelebrationModal: ConfettiBurst,
      haptic, `useReducedMotion`, `celebrationGate` registration in `PrestigeModal`.

## Phase 2 — UX primitives + the empty/loading holes
- [x] 2.1 Create `components/ui/EmptyState.tsx` (promote the identical Pulse/Spark/Hustle
      API: observation + nudge + optional CTA), themed, accessible.
- [x] 2.2 Wire it into the tab-screen holes: work street jobs + career board,
      health activities + diet plans; market food/housing if cheap.
- [x] 2.3 Device empty states get a CTA: "no computer / no phone" screens link to Market
      instead of dead-ending.
- [x] 2.4 SaveSlots loading: show themed loading placeholders instead of an empty list
      while slots load (highest-anxiety blank screen in the app).
- [x] 2.5 Screen chrome parity: `computer.tsx` gets the same titled header as
      `mobile.tsx` (same tab swaps chrome today when a computer is bought).

## Phase 3 — Accessibility (concentrated, audit-verified gaps)
- [x] 3.1 `BaseModal`: `accessibilityViewIsModal`, labelled backdrop, neutralized
      propagation-stop wrapper.
- [x] 3.2 `maxFontSizeMultiplier` caps on chrome text: tab bar labels, TopStatsBar pills,
      BaseModal title/subtitle (fixed-height containers clip at accessibility type sizes).
- [x] 3.3 Touch-target rollout: apply `utils/touchTargets.ts` helpers to the 8 undersized
      close buttons found (PrestigeShopModal, SicknessModal, MemoryBookModal,
      LegacyTimeline, ShareLifeCard, WeddingPlanningModal, CloudTransferModal,
      IdentityCard styles).
- [x] 3.4 `app/(tabs)/work.tsx`: fix raw `paddingVertical: 4` on "Quit instead"
      (~22pt destructive target), label the Manage Job action sheet, label home CTAs.
- [x] 3.5 `StatChangeIndicator`: announce stat changes to screen readers (the game's
      primary feedback channel is currently silent for VoiceOver).
- [x] 3.6 Fix `accent.muted` contrast (the ~3.0:1 survivor of the documented contrast
      pass) after checking its 12 usages' surfaces.

## Phase 4 — Visual consistency + debt removal
- [x] 4.1 Kill the second neutral ramp: mechanical gray→slate hex normalization across
      app/ components/ src/ (650 occurrences, perceptually near-identical mapping).
- [x] 4.2 Theme `app/+not-found.tsx` (stock white Expo template today).
- [x] 4.3 Translate `app/preview.tsx` Swedish strings to English.
- [x] 4.4 Delete dead components: `components/onboarding/OnboardingScreenShell.tsx` (v1,
      0 importers); decide `components/anim/Skeleton.tsx` (0 importers — use in 2.4 or delete).

## Phase 5 — Validation
- [x] 5.1 `npm run preflight:quick` + `type-check:tests` + `lint:errors`
- [ ] 5.2 Targeted suites: startup (screenImports), save (settings default change),
      render, any suites touching edited files
- [ ] 5.3 Full `npm test`
- [ ] 5.4 Second independent visual/consistency audit pass
- [ ] 5.5 Final report + push
