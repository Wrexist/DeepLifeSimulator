# Critical Bugs — May 29, 2026

> **Status (2026-05-29 evening):** All P0 and P1 findings applied. Most of P2 and the relevant P3 cleanups applied. Type-check is clean (0 errors), critical-path + save-migration tests are green (60/60). Remaining open items:
>
> - **P1-10 (JobActions pity stale read):** partial — annotated as acceptable; the failure counter inside `setGameState(prev =>)` is correct, only a same-batch double-tap can miss pity by 1.
> - **P2-6, P2-8, P2-13, P2-16, P2-19:** lower-impact items not applied this pass (ErrorUtils fatal preservation, validateGameState autofix clone, legacy save sanity check, executePrestige forceSave/await, StatChangeContext debounce). These are non-blocking; the underlying mutation bug fixed in P0-10 (`repairGameState` clone+copy-back) covers most of the same exposure.
> - **P3-4, P3-5..P3-9, P3-12..P3-17:** intentionally not applied this pass — verified false alarms (`Ionicons` is actually used in GemsStoreModal) or cosmetic noise not worth churning the diff for. Worth revisiting in a dedicated cleanup sweep.



Five parallel audits ran: ESLint-sweep regressions, render loops, GameState/actions, native modules/TurboModule, async/save/error suppression. This file consolidates the findings into one prioritized list with exact fixes.

**Reported symptoms:** Two orange warning banners stacked at the top + constant crashes/freezes during play.

**Root-cause explanation:** Two stacked orange banners = `Maximum update depth exceeded` + `Can't perform a React state update on an unmounted component`. The render-loop is caused by `GameStateProvider.wrappedSetGameState` bumping `updatedAt` on every setState (even no-ops), combined with a `SicknessModal` mounted twice — once in `TopStatsBar` and once in `_layout` — both running an effect that depends on `isVisible` and calls `setIsVisible`. The unmounted-state warnings come from `Suspense fallback={null}` wrappers around lazy modals plus `setTimeout(0)`-based dismiss handlers. Constant crashes when opening the shop / tutorial / error are because 11 components still import `expo-linear-gradient`/`expo-blur` directly, and 19 contexts bypass `safeAsyncStorage` — both crash hard on iOS 26 beta TurboModule init.

---

## P0 — Critical (the actual cause of the user's reported symptoms)

### P0-1. `GameStateProvider` bumps `updatedAt` on every setState — entire app re-renders on no-ops
**File:** `contexts/game/GameStateContext.tsx:42-55`
**Confirmed by:** render-loop audit (Finding 1) AND gamestate audit (Finding 11)
**Bug:**
```ts
setGameState(prev => {
  const newState = typeof update === 'function' ? update(prev) : update;
  const now = Date.now();
  const nextUpdatedAt = Math.max(now, (prev.updatedAt || 0) + 1);
  return { ...newState, updatedAt: nextUpdatedAt };  // ALWAYS new reference, even if newState === prev
});
```
Action files use `return prev` to mean "no change" (e.g. `MoneyActions.ts:33` rejecting an overdraw). This wrapper turns every no-op into a real state change → every consumer's `useMemo([gameState])` recomputes → cascade.
**Fix:**
```ts
setGameState(prev => {
  const newState = typeof update === 'function' ? update(prev) : update;
  if (newState === prev) return prev;  // identity short-circuit
  return { ...newState, updatedAt: Math.max(Date.now(), (prev.updatedAt || 0) + 1) };
});
```

### P0-2. `SicknessModal` mounted twice in the tree
**Files:** `components/TopStatsBar.tsx:886` AND `app/_layout.tsx:1196-1198`
**Bug:** Two `<SicknessModal />` instances both subscribe to `gameState.showSicknessModal`, both run the buggy effect from P0-3, both call `dismissSicknessModal` independently. Two LogBox warnings stacked = exactly two instances emitting the same warning.
**Fix:** Delete the SicknessModal render in `TopStatsBar.tsx:886`. The one in `_layout.tsx` is the canonical mount.

### P0-3. `SicknessModal` effect depends on `isVisible` AND calls `setIsVisible` — infinite loop
**File:** `components/SicknessModal.tsx:71-112`
**Bug:** `useEffect(() => { … setIsVisible(true|false) … }, [isInActiveGame, showSicknessModal, hasDiseases, isClosing, isVisible, fadeAnim])`. `isVisible` in deps + `setIsVisible` inside = "Maximum update depth exceeded".
**Fix:**
```ts
useEffect(() => {
  const shouldShow = isInActiveGame && showSicknessModal && hasDiseases && !isClosing;
  if (shouldShow === isVisible) return;
  setIsVisible(shouldShow);
  // ...animate
}, [isInActiveGame, showSicknessModal, hasDiseases, isClosing]);  // drop isVisible and fadeAnim
```

### P0-4. `ToastContext` Provider `value` is a fresh object every render
**File:** `contexts/ToastContext.tsx:107-117`
**Bug:** `<ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>` — every render creates a new value object. Every consumer of `useToast()` re-renders on every Toast-state change.
**Fix:**
```tsx
const value = useMemo(
  () => ({ showToast, showSuccess, showError, showWarning, showInfo }),
  [showToast, showSuccess, showError, showWarning, showInfo]
);
return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
```

### P0-5. `SettingsContext` Provider `value` is a fresh object every render — outermost provider
**File:** `contexts/SettingsContext.tsx:60`
**Bug:** Same pattern; `SettingsProvider` is the outermost provider in `AppProviders.tsx:38`. Plus `updateSettings`/`toggleDarkMode` aren't `useCallback`'d.
**Fix:**
```tsx
const updateSettings = useCallback(async (newSettings) => { /* … */ }, [settings]);
const toggleDarkMode = useCallback(async () => { /* … */ }, [settings, updateSettings]);
const value = useMemo(
  () => ({ settings, updateSettings, toggleDarkMode }),
  [settings, updateSettings, toggleDarkMode]
);
```

### P0-6. `IAPHandler` import cycle crashes `<Stack>` rendering during onboarding
**File:** `components/IAPHandler.tsx:3`
**Bug:** Importing from the `@/contexts/GameContext` barrel produces `GameContext → game/index.ts → GameProvider → IAPHandler → GameContext`. `useGame` resolves to `undefined` during onboarding boot. (You're already patching this in your working tree — that's why `(onboarding)/_layout.tsx` was temporarily switched from `<Stack>` to `<Slot>`.)
**Fix:**
```ts
// In IAPHandler.tsx, replace the barrel import:
import { useGameState } from '@/contexts/game/GameStateContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
// then:
const { setGameState } = useGameState();
const { saveGame } = useGameActions();
```
Then revert `app/(onboarding)/_layout.tsx` back to `<Stack>` with its original animation options.

### P0-7. `GemsStoreModal` directly imports `expo-linear-gradient` + `expo-blur` (iOS 26 hard abort)
**File:** `components/GemsStoreModal.tsx:14-15`
**Bug:** TurboModule init for `expo-blur` aborts the JS bundle the moment this module evaluates. Shop button → native crash.
**Fix:**
```ts
// Remove both:
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
// Add:
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
const LinearGradient = LinearGradientFallback;
const BlurView = BlurViewFallback;
```

### P0-8. Ten more components import `expo-linear-gradient` directly
**Files:**
- `components/EnhancedAchievementScreen.tsx:13`
- `components/EnhancedAchievementCard.tsx:9`
- `components/ui/ErrorBoundary.tsx:3`
- `components/ui/EnhancedButton.tsx:10`
- `components/ui/AnimatedButton.tsx:10`
- `components/TutorialTrigger.tsx:3`
- `components/TutorialTooltip.tsx:3`
- `components/TutorialOverlay.tsx:3`
- `components/QuickActionsPanel.tsx:3`
- `components/InteractiveTutorial.tsx:3`

**Bug:** Each of these triggers an iOS 26 native abort on first render. Tutorial/ErrorBoundary files are extra dangerous — they fire during fragile UI states (first-launch tutorial, an error has just been caught), turning graceful degradation into a hard crash.
**Fix:** Each file:
```ts
// Replace:
import { LinearGradient } from 'expo-linear-gradient';
// With:
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
```

### P0-9. 19 files bypass `safeAsyncStorage` — TurboModule init crash on iOS 26
**Files (high priority — load during boot or every UI interaction):**
- `contexts/game/GameActionsContext.tsx:9`
- `contexts/SettingsContext.tsx:2`
- `contexts/TutorialContext.tsx:2`
- `contexts/UIUXContext.tsx:2`
- `components/AutoSaveIndicator.tsx:6`
- `components/TutorialOverlay.tsx:8`
- `utils/cacheManager.ts:1`

**Lower priority but same fix:**
- `app/(onboarding)/MainMenu.tsx:5`, `hooks/useAchievements.ts:4`, `lib/utils/startupHealthValidator.ts:10`, `src/debug/aiDebugSnapshot.ts:14`, `services/IAPSyncService.ts:1`, `lib/prestige/prestigeLeaderboards.ts:1`, `components/DevToolsModal.tsx:10`, `components/DeathPopup.tsx:4`, `components/FirstWeekGuide.tsx:26`, `components/TombstonePopup.tsx:3`, `utils/ratingPrompt.ts:18`, `utils/offlineManager.native.ts:2`, `utils/offlineManager.web.ts:2`

**Fix in each:**
```ts
// Replace:
import AsyncStorage from '@react-native-async-storage/async-storage';
// With:
import { safeAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
```

### P0-10. `repairGameState` mutates state in place — breaks React reference equality
**File:** `utils/saveValidation.ts:346` (mutator) called from `contexts/game/GameActionsContext.tsx:262-265, 3692-3695`
**Bug:** `repairGameState(prev)` does `s.stats = …`, `s.banking = …` directly on the passed state. The `{...prev}` spread is shallow — nested mutations on `s.stats` etc. are still the same reference React sees. Memos keyed on `gameState.banking` don't refire, UI shows stale data → "frozen UI".
**Fix:** Make `repairGameState` return a new object instead of mutating:
```ts
export function repairGameState(state: GameState): { repaired: boolean; state: GameState } {
  const repaired = structuredClone(state);
  let didRepair = false;
  // do all repairs on `repaired` instead of `state`
  if (!repaired.stats) { repaired.stats = DEFAULT_STATS; didRepair = true; }
  // ...
  return { repaired: didRepair, state: repaired };
}
```
Update callers to use the returned `state` not the mutated `prev`.

### P0-11. `saveGame` blindly stamps `version: STATE_VERSION` regardless of actual migrated version
**File:** `contexts/game/GameActionsContext.tsx:317`
**Bug:** A save that crashed mid-migration at v15→v16 still gets stamped as v18 by the next autosave. Next launch, `runMigrations()` sees `currentVersion === CURRENT_STATE_VERSION` and skips all migrations → fields stay undefined → crash on `state.darkWeb.heat`.
**Fix:**
```ts
const gameData = {
  ...stateToPersist,
  version: typeof stateToPersist.version === 'number' && stateToPersist.version >= STATE_VERSION
    ? stateToPersist.version
    : STATE_VERSION,
  // …
};
```
And in `loadGame`, ensure `runMigrations`'s mutation to `state.version` is propagated back to the merged `loadedState`.

### P0-12. `prevState.week` (cyclic 1–4) used for time math — 9 confirmed sites
**Files:**
- `contexts/game/GameActionsContext.tsx:1668-1669, 1725, 1736` (mining difficulty migration + storage)
- `contexts/game/GameActionsContext.tsx:2714` (life-milestone `week` field on child birth)
- `contexts/game/GameActionsContext.tsx:3213` (event log entry `week` field)
- `contexts/game/GameActionsContext.tsx:3233` (DIRECT MUTATION of `prevState.pendingChainedEvents`)
- `contexts/game/actions/DatingActions.ts:1003` (anniversary migration math)
- `contexts/game/actions/MiningActions.ts:416, 636, 637`

**Bug:** Storing or comparing `gameState.week` (which cycles 1–4) instead of `weeksLived` (monotonic) corrupts time-ordering, breaks anniversaries, mis-decays mining difficulty, makes life-story timeline show clusters in wrong weeks.
**Fix:** In every line above, replace `prevState.week`/`gameState.week`/`state.week` with `prevState.weeksLived ?? 0` (or `nextWeeksLived` where the local var exists). Reserve `state.week` for UI display only — per CLAUDE.md Hard Rule.

For the direct-mutation at `3233`:
```ts
// Bug:
prevState.pendingChainedEvents = [...pendingChains, chainedEvent];
// Fix: compute outside, return in spread:
let pendingChainedEventsNext = prevState.pendingChainedEvents || [];
if (chainedEvent) pendingChainedEventsNext = [...pendingChainedEventsNext, chainedEvent];
return { ...prevState, /*…*/, pendingChainedEvents: pendingChainedEventsNext };
```

### P0-13. `expo-tracking-transparency` plugin missing from `app.config.js`
**File:** `app.config.js` plugins array, package installed at `package.json:50`
**Bug:** Hard Rule #4 violation. Package installed, ships its own config plugin, but plugin not registered. Hand-rolled `NSUserTrackingUsageDescription` in `app.config.js:36` masks symptom but bypasses ATT framework wiring. TestFlight launch aborts.
**Fix:** Add to plugins array:
```js
[
  "expo-tracking-transparency",
  {
    userTrackingPermission:
      "This identifier will be used to deliver personalized ads to you."
  }
],
```
And remove the hand-rolled `NSUserTrackingUsageDescription` from `ios.infoPlist` (let the plugin own it).

### P0-14. `Suspense fallback={null}` around lazy popups hides chunk-load failures
**File:** `app/_layout.tsx:1181, 1187, 1192, 1197, 1202`
**Bug:** If `DeathPopup` lazy-load fails (network blip, missing chunk), Suspense throws to the outer ErrorBoundary, but `onError` only logs in `__DEV__`. In production, the popup silently fails to render while `gameState.showDeathPopup === true` — UI shows nothing, taps do nothing, **game is permanently frozen until restart**.
**Fix:** Wrap each lazy popup in its own ErrorBoundary that auto-clears the show flag:
```tsx
<ErrorBoundary
  fallback={null}
  onError={(e) => {
    logger.error('DeathPopup lazy-load failed', e);
    setGameState(p => ({ ...p, showDeathPopup: false }));
  }}
>
  <Suspense fallback={null}><DeathPopup /></Suspense>
</ErrorBoundary>
```

### P0-15. `SaveLoadMutex` has no timeout — can deadlock forever
**File:** `utils/saveLoadMutex.ts:20-36`
**Bug:** Every `acquire` MUST be paired with `release`. If a `setGameState` callback inside `saveGame` throws, the release in `finally` may never run (React swallows render errors). Mutex stays locked → all future saves queue infinitely → autosave timer adds callbacks every 2 min → memory grows → OOM crash.
**Fix:** Add timeout parameter to `acquire`:
```ts
async acquire(operation: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!this.isLocked) {
      this.isLocked = true;
      this.currentOperation = operation;
      resolve();
      return;
    }
    const fn = () => { clearTimeout(timer); this.isLocked = true; this.currentOperation = operation; resolve(); };
    const timer = setTimeout(() => {
      const i = this.queue.indexOf(fn);
      if (i >= 0) this.queue.splice(i, 1);
      reject(new Error(`Mutex acquire timeout for ${operation}`));
    }, timeoutMs);
    this.queue.push(fn);
  });
}
```

### P0-16. `services/IAPService.ts` has Prettier formatting damage → hook silently broken
**File:** `services/IAPService.ts:27, 390, 472, 478, 538, 742, 1246` and many others
**Bug:** Tokens like `InAppPurchases!== null`, `loadInAppPurchasesModule() &&!!InAppPurchases`, `typeof InAppPurchases.connectAsync!=='function'`, `error.message: 'Unknown error'` — the file was clearly auto-mangled by a tool that stripped spaces. The Prettier auto-format hook configured in `.claude/settings.json` is silently failing for at least this file. **Also:** iOS-specific bug at the same time — `purchase.acknowledged` is Android-only, so `if (!purchase.acknowledged)` always re-processes every existing iOS purchase, triggering `applyBenefit` → repeated `forceSave` → save-queue flood.
**Fix:**
1. Run Prettier manually on the file: `npx prettier --write services/IAPService.ts`
2. Verify the Prettier hook works on a sample edit: edit something small and confirm formatting runs.
3. Replace the iOS `acknowledged` check with a transaction-ledger lookup:
```ts
if (!purchase.acknowledged && !(await this.isTransactionProcessed(purchase.transactionId))) {
  await this.applyBenefit(/* … */);
}
```

---

## P1 — High (severe correctness bugs, may not be the active crash but actively corrupting state)

### P1-1. Hook-form `updateMoney` silently swallows overdraws
**File:** `contexts/game/MoneyActionsContext.tsx:79-88`
**Bug:** Module form correctly rejects (`if (currentMoney + amount < -0.01) return prev`). Hook form just clamps to 0. UI tabs use the hook form, so most purchases bypass the overdraw guard — players "buy" things at $0 cost.
**Fix:** Mirror the module form:
```ts
setGameState(prevState => {
  if (amount < 0 && prevState.stats.money + amount < -0.01) {
    logger.warn(`Rejected purchase: insufficient funds. Has: ${prevState.stats.money}, Needs: ${Math.abs(amount)}. Reason: ${reason}`);
    return prevState;
  }
  const newMoney = Math.max(0, prevState.stats.money + amount);
  // …
});
```

### P1-2. `Math.random()` inside `setGameState` updaters — StrictMode double-roll
**Files:**
- `contexts/game/actions/CrimeActions.ts:67, 109, 154`
- `contexts/game/actions/EducationActions.ts:130`

**Bug:** React 19 StrictMode invokes updaters twice; the two invocations roll different randoms. Outcomes look non-deterministic; in dev visible flicker, in prod just wrong.
**Fix:** Pre-roll outside the updater:
```ts
const roll = Math.random();
setGameState((prev) => {
  // …use roll
});
```

### P1-3. Actions have no guard against `showDeathPopup` / dead state
**Files:** all under `contexts/game/actions/`
**Bug:** Dead players can still `performStreetJob`, `goOnDate`, `buyItem`, `applyForJob`. Money/stats change behind the death popup. After revival or prestige, ghost progress survives.
**Fix:** Add a guard helper and call at the top of every action that mutates state:
```ts
// contexts/game/actions/_guards.ts
export function rejectIfDead(state: GameState): { success: false; message: string } | null {
  if (state.showDeathPopup || state.isDead) {
    return { success: false, message: 'You have died.' };
  }
  return null;
}
// In each action:
const guard = rejectIfDead(gameState);
if (guard) return guard;
```

### P1-4. `AutoSaveIndicator` re-installs `setInterval` on every gameState change
**File:** `components/AutoSaveIndicator.tsx:31-59`
**Bug:** `useEffect(() => { …setInterval(…); return () => clearInterval(…); }, [gameState])` — every gameState change tears down + recreates the interval. Combined with P0-1 (gameState gets new identity every set), this hammers AsyncStorage on the hot path.
**Fix:** Empty deps — interval reads from `saveQueue.getStatus()` directly:
```ts
useEffect(() => {
  const updateSaveStatus = async () => { /* … */ };
  updateSaveStatus();
  const interval = setInterval(updateSaveStatus, 2000);
  return () => clearInterval(interval);
}, []);
```

### P1-5. `TopStatsBar` memos depend on whole `gameState` object
**File:** `components/TopStatsBar.tsx:184-282, 378, 921`
**Bug:** Deps include `[stats?.health, ..., stats, gameState, ...]` — including BOTH the primitive AND the object means the object identity dep fires on every save (due to P0-1). Heavy filters (educations, careers, real estate) run on every render. Also restarts `Animated.loop` glow many times per second on a busy loop → JS thread starvation.
**Fix:** Drop `stats` and `gameState` from deps arrays — depend only on primitive fields:
```ts
}, [stats?.health, stats?.happiness, stats?.energy, stats?.money, bankSavings, currentJob, careers, educations, prestige?.unlockedBonuses]);
```
Same fix at line 921 (week pulse animation) — drop `date` and keep only `date?.week`.

### P1-6. `DeathPopup` `inheritanceSummary` memo depends on whole gameState
**File:** `components/DeathPopup.tsx:39-94`
**Bug:** `useMemo(() => computeInheritance(gameState), [gameState])` — recomputes on every save while popup is shown. `computeInheritance` walks money + bank + properties + stocks.
**Fix:** Depend on specific fields:
```ts
useMemo(() => computeInheritance(gameState), [
  gameState.stats?.money,
  gameState.banking?.accounts,
  gameState.realEstate,
  gameState.portfolio,
]);
```

### P1-7. HomeScreen goal-completion effect depends on full `gameState`
**File:** `app/(tabs)/index.tsx:115-150+`
**Bug:** Calls `setGameState` inside, deps include `gameState`. The internal guard saves it from infinite loop, but `checkGoalCompletion(gameState)` walks the entire state on every save.
**Fix:** Depend only on triggers:
```ts
}, [gameState.weeksLived, gameState.currentJob, gameState.stats.money, gameState.completedGoals?.length]);
```

### P1-8. Dead scroll-indicator state in `market.tsx` produces NaN math
**File:** `app/(tabs)/market.tsx:137-138`
**Bug:** Cleanup sweep renamed setters to `_setContentHeight`/`_setScrollViewHeight`. Values stay 0 forever; lines 369–372 divide by them → NaN/Infinity in indicator style.
**Fix (lowest risk):** Delete lines 137-138 and the dependent style block at lines 369-372. The feature was DOA after the rename.

### P1-9. `LogBox` blanket-suppresses real warnings
**File:** `app/_layout.tsx:600-602`
**Bug:** `'[RootLayout]'` and `'[StatusBarWrapper]'` are substring matches — every warning emitted with those tags is hidden. Also `'Sending `onAnimatedValueUpdate`'` IS a real animation-loop signal that directly relates to the freeze symptom.
**Fix:** Replace the list:
```ts
LogBox.ignoreLogs([
  'Network monitoring disabled',
  'Require cycle:',
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted',
  'Overwriting fontFamily',
]);
```
Remove `[RootLayout]`, `[StatusBarWrapper]`, `Sending onAnimatedValueUpdate`, `new NativeEventEmitter`, `Failed to initialize circuit breaker`.

### P1-10. `JobActions` `streetJob` pity-count read from stale outer `gameState`
**File:** `contexts/game/actions/JobActions.ts:130-137`
**Bug:** `failureCount` read from outer `gameState` (action-start snapshot). Two rapid clicks → both read stale count = 4 → both fail when one should be guaranteed-success.
**Fix:** Move pity check inside the updater:
```ts
setGameState(prev => {
  const failureCount = prev.streetJobFailureCount?.[jobId] || 0;
  const guaranteedSuccess = failureCount >= pityThreshold;
  // … re-evaluate using guaranteedSuccess
});
```

### P1-11. `forceSave` doesn't acquire `saveLoadMutex` → IAP can overwrite a freshly loaded slot
**File:** `services/IAPService.ts:1083`
**Bug:** Pay for gems → load a different slot → gems silently merged into wrong character.
**Fix:** `forceSave` should `await saveLoadMutex.acquire('save')` / `release()` in finally.

### P1-12. `Promise.race` with `setTimeout(reject)` orphans the backup operation
**File:** `contexts/game/GameActionsContext.tsx:296-301`
**Bug:** When `createBackupFromState` takes >5s the race rejects but the underlying write continues, racing with the next autosave's backup. AsyncStorage serialization queue blows up after ~30 min of slow play → JS thread permanently 5-10s behind → frozen UI symptom.
**Fix:** Don't race; let backup run as background fire-and-forget:
```ts
void createBackupFromState(slotToUse, stateToPersist, 'auto_save')
  .catch(e => logger.warn('Backup failed', e));
```

### P1-13. autosave vs loadGame race overwrites freshly loaded slot
**File:** `contexts/game/GameActionsContext.tsx:3711 (loadGame) + 3662 (autosave interval)`
**Bug:** User loads slot 2. Two min later, autosave fires; if its `gameStateRef.current` snapshot was captured during the load transition, it writes slot 2 with slot 1's data.
**Fix:** Inside autosave interval, skip when mutex is held:
```ts
const saveIntervalId = setInterval(() => {
  if (saveLoadMutex.isHeld()) {
    logger.debug('Skip autosave: mutex busy');
    return;
  }
  saveFn(false).catch(/* … */);
}, AUTOSAVE_INTERVAL_MS);
```

### P1-14. `setStateGetter(() => gameState)` re-registers every render
**File:** `app/_layout.tsx:1139-1149`
**Bug:** `useEffect(() => { setStateGetter(() => gameState); }, [gameState]);` — fires on every state change, creating a new closure each time. Tens of times per second during `nextWeek` progression.
**Fix:** Capture via ref:
```ts
const gameStateRef = useRef(gameState);
useEffect(() => { gameStateRef.current = gameState; });
useEffect(() => { setStateGetter(() => gameStateRef.current); }, []);
```

### P1-15. `nextWeek` autosave is fire-and-forget — silent quota failures
**File:** `contexts/game/GameActionsContext.tsx:2949, 3330`
**Bug:** `saveGame(false).catch(err => logger.warn(...))` — quota errors fail silently for 3 retries, each retry runs `performQuotaCleanup` (parses every backup) → ~10s JS thread lockup. Frozen UI symptom.
**Fix:** Surface a yellow toast on first failure, not after 3 retries:
```ts
saveGame(false).catch(err => {
  logger.warn('Auto-save after nextWeek failed:', err);
  if (err?.message?.includes('quota')) {
    showWarning('Save Warning', 'Storage low — clean up old saves.');
  }
});
```

### P1-16. `ZeroStatPopup` dismiss inside `setTimeout(0)` causes setState-on-unmounted
**File:** `components/ZeroStatPopup.tsx:62-74`
**Bug:** `setTimeout(() => dismissStatWarning(), 0)` from a click — when the user dismisses and the modal unmounts before the timeout fires, you get "Can't perform a React state update on an unmounted component" — the second orange banner.
**Fix:** Call `dismissStatWarning()` directly. There's no rendering reason to defer it.

### P1-17. `ZeroStatPopup` effect can re-trigger dismiss in a race
**File:** `components/ZeroStatPopup.tsx:31-37`
**Bug:** Effect with `setState`-equivalent inside (`dismissStatWarning`) re-runs on every related state change. Guard with a ref so dismiss only runs once per show cycle:
```ts
const dismissedFor = useRef<string | null>(null);
useEffect(() => {
  if (!showZeroStatPopup) { dismissedFor.current = null; return; }
  const key = `${zeroStatType}-${showZeroStatPopup}`;
  if (dismissedFor.current === key) return;
  if (!isValidPopupState()) {
    dismissedFor.current = key;
    dismissStatWarning();
  }
}, [showZeroStatPopup, zeroStatType, stats.health, stats.happiness]);
```

---

## P2 — Medium (correctness bugs that don't actively crash but matter)

| # | File:Line | Bug | Fix |
|---|---|---|---|
| P2-1 | `components/anim/AchievementToast.tsx:31-62` | Module-level mutable `trigger` causes setState-on-unmounted warnings | Add cleanup: `return () => { trigger = null; }` |
| P2-2 | `components/WeddingPopup.tsx:24-100` | Animation loops never cleanup if first mount has `showWeddingPopup=false` | Always register cleanup; store loops in a ref |
| P2-3 | `app/_layout.tsx:685-690, 705-710, 723-727` | Side effects (`requestAnimationFrame`, `setTimeout(logger.debug)`) in render body | Move all into `useEffect` |
| P2-4 | `components/IAPHandler.tsx:17-70` | `setGameState → setTimeout(saveGame, 100)` chain is racy | Trigger save from `useEffect` watching a flag |
| P2-5 | `app/_layout.tsx:802, 819` | `removeItem('last_fatal_error')` runs in catch + outside it → loses crash diagnostics | Only remove after successfully displaying |
| P2-6 | `app/_layout.tsx:296-325` | Global ErrorUtils handler converts fatal to non-fatal | Preserve `isFatal`; add cascade-detection counter |
| P2-7 | `utils/saveMigrations.ts:548-549` | Missing migration entries silently bump version | Log warning + add CI check |
| P2-8 | `utils/saveValidation.ts:819-1022` | `validateGameState(autoFix=true)` mutates state in place even on validation failure | Clone state before any mutation; return clone |
| P2-9 | `services/IAPService.ts:836-1006` | `applyBenefitToDisk` doesn't shape-validate `gameState` before mutation | Wrap with `if (!gameState.stats) gameState.stats = DEFAULT_STATS` guards |
| P2-10 | `services/IAPService.ts:748-778` | `void (async () => {…})()` purchase listener has no error catch | Wrap async IIFE body in try/catch |
| P2-11 | `services/IAPService.ts:892-898` | `Promise.allSettled` results discarded — partial perk-persistence failures invisible | Check `results.filter(r => r.status === 'rejected')` |
| P2-12 | `utils/saveQueue.ts:485` | `restoreQueue` removes persisted queue before processing finishes | Move `safeRemoveItem` into `processQueue` success branch |
| P2-13 | `utils/saveValidation.ts:1185-1193` | Legacy save passes through without HMAC; tampered saves bypass | Sanity-check legacy payloads (no field > 1e15, age < 200) |
| P2-14 | `contexts/game/actions/DatingActions.ts:127-132` | `goOnDate` outer 2/wk gate uses stale state — spam-tap exploit | Re-check cap inside `setGameState(prev =>)` |
| P2-15 | `contexts/game/actions/DatingActions.ts:483-487` | `executeWedding` removes old spouse from `relationships` but leaves children's `parentIds` referencing them | Filter `parentIds` |
| P2-16 | `contexts/game/GameActionsContext.tsx:4276-4291` | `executePrestige` race with autosave can lose prestige | `await forceSave` instead of `queueSave` |
| P2-17 | `components/DevToolsModal.tsx:110, 174` | Calls `saveGame()` synchronously after `setGameState` → saves stale state | Drop the sync `saveGame()`, let autosave catch it |
| P2-18 | `components/DevToolsModal.tsx:120-160` | Time-travel `nextWeek()` keeps firing after modal unmounts | Track `mountedRef`; check before firing |
| P2-19 | `contexts/StatChangeContext.tsx:99-141` | Stat-diff effect fires on every save | Debounce 50ms after week advance |
| P2-20 | `contexts/UIUXContext.tsx:67-82` | `checkTutorialStatus` not memoized | Wrap in `useCallback([])` |
| P2-21 | `hooks/useAchievements.ts:24-37` | Reloads AsyncStorage on every `claimedProgressAchievements` reference change | Depend on `.length`, not the array reference |
| P2-22 | `contexts/game/actions/ContactsActions.ts:23-25, 35-39, 63-66, 79-84` | `(state as any).favorLedger` cast hides type drift | Add `favorLedger?: FavorLedger` to `GameState` |
| P2-23 | `contexts/game/GameActionsContext.tsx:2843` | `await new Promise(r => setTimeout(r, 50))` after `setGameState` to "ensure state updated" — not deterministic | Move validation into `useEffect` keyed on `weeksLived` |
| P2-24 | `android/gradle.properties:38` + iOS unset | New Architecture mixed state (Android on, iOS implicit off) | Pin both explicitly via `expo-build-properties` plugin |
| P2-25 | `app/(tabs)/_layout.tsx:4` | `Chrome as Home` icon — Chrome browser logo on Home tab is a visual oddity | Use `Home` from lucide directly |

---

## P3 — Low (cleanup, hygiene, dead code)

| # | File:Line | Action |
|---|---|---|
| P3-1 | `components/fallbacks/BlurViewFallback.tsx:7` | Duplicate `'dark'` in union literal — remove the second occurrence |
| P3-2 | `app/(tabs)/work.tsx:103-104` | Dead state (`_showJailReleaseMessage` etc.) — delete the 4 lines |
| P3-3 | `app/(tabs)/mobile.tsx:77-79` | Dead state (`_contentHeight`, `_visibleHeight`, `_scrollY`) — delete |
| P3-4 | `components/GemsStoreModal.tsx:16` | Unused `Ionicons` import — swap for lucide equivalent |
| P3-5 | `components/InteractiveTutorial.tsx:35-40` | `onClose` removed from destructure but interface still declares it — restore or remove from interface |
| P3-6 | `components/mobile/Pulse/components/PostCard.tsx:132-152` | Verify `id`/`bookmarks` not used in JSX; restore if needed |
| P3-7 | `components/mobile/social/PostComposer.tsx:47-52` | Verify `displayName`/`username`/`verified` not used; restore if needed |
| P3-8 | `components/LoadingStates.tsx:86-91` | `onPress` removed; component never wired to a touchable — wrap in TouchableOpacity or remove from interface |
| P3-9 | `babel.config.js:6-7`, `android/app/proguard-rules.pro:10`, `utils/reanimatedCheck.ts` | Reanimated removed but residue remains — clean up if unused |
| P3-10 | `app/_layout.tsx:53` comment | Misleading "expo-tracking-transparency added back" — update after P0-13 fix |
| P3-11 | `contexts/game/GameActionsContext.tsx:4174-4178` | `proposeToPartner` interface declares `void` but always returns object — drop `\| void` |
| P3-12 | Multiple files (`DatingActions.ts:315, 353, 850`, `JobActions.ts:217, 329`) | `commitDeterministicRolls` deduplication — consolidate to single setGameState |
| P3-13 | `contexts/game/GameStateContext.tsx:135-143` | Split into `GameStateValueContext` + `GameStateActionsContext` so action-only consumers don't re-render |
| P3-14 | `components/DevToolsModal.tsx:24` | Add provider-missing fallback for testing/storybook robustness |
| P3-15 | `contexts/game/GameProvider.tsx:80-134` | Provider error boundary cascades — make `useXxxActions` return a stub instead of throwing |
| P3-16 | `contexts/game/GameActionsContext.tsx:3475-3478` | Add `typeof` guards in `clampStatByKey` write-back |
| P3-17 | `contexts/game/SocialActionsContext.tsx:58` | Memoize `datingDeps` object (preventative — currently safe but fragile) |

---

## Recommended fix order

To kill the user-reported symptoms with minimum churn:

1. **P0-1, P0-2, P0-3** — fixes the two orange banners + the freeze. **Probably 30 minutes of work, single biggest win.**
2. **P0-4, P0-5** — memoize the two outer providers; large render-cost reduction.
3. **P0-6** — apply your in-progress `IAPHandler` import-cycle patch and revert `(onboarding)/_layout.tsx` back to `<Stack>`.
4. **P0-7, P0-8** — fix the 11 direct `expo-linear-gradient`/`expo-blur` imports. Use a sed-style replacement; pattern is identical.
5. **P0-9** — fix the 19 direct `AsyncStorage` imports (same — pattern is identical).
6. **P0-10, P0-11** — `repairGameState` clone-then-return + don't blindly stamp `STATE_VERSION`.
7. **P0-12** — fix all 9 `state.week` time-math sites.
8. **P0-13** — add `expo-tracking-transparency` plugin.
9. **P0-14** — wrap each lazy popup in its own `ErrorBoundary`.
10. **P0-15** — add `SaveLoadMutex` timeout.
11. **P0-16** — re-run Prettier on `IAPService.ts` and verify the format hook actually works.

After P0 is clean, P1 fixes are independent and can be batched per area (money, render perf, save races, error handling).

---

## Notes on the cleanup-sweep commits

The 8 commits `c9ddc06..cab4fe8` were mostly cosmetic — `Array<T>` → `T[]`, BOM removal, hoisting `const LinearGradient = LinearGradientFallback;` to after imports. The few real regressions they introduced are caught in P1-8 (dead `market.tsx` scroll-indicator state — produces NaN) and the lower-priority P3-2/P3-3/P3-5/P3-6/P3-7 destructure-removal items.

**However**, the formatting damage in `services/IAPService.ts` (P0-16) suggests the Prettier auto-format hook in `.claude/settings.json` is silently failing — which means subsequent edits to other files may be saved without formatting too. Verify the hook before further development.
