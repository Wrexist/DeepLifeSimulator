# Independent save/state and purchase audit ? 2026-09-26

Revision: `9a4422c6`. Audit only; no production source changes.

## Confirmed current defect

### SAVE-01 ? High: prestige writes a save without owning the save/load mutex

- Source: `contexts/game/GameActionsContext.tsx:5644-5648` chains `snapshotOutgoingSave` to `queueSave(slotToUse, gameData)` without acquiring `saveLoadMutex`. `utils/saveQueue.ts:113-125` explicitly requires the caller to own the mutex; its write path does not acquire it. `utils/saveBackup.ts:954-967` also does not wrap `snapshotOutgoingSave` in that mutex.
- Reproduced through the real `GameProvider`, production prestige action, real save queue, signed envelopes and stateful AsyncStorage: seed slot 1 with a started $1B life, acquire mutex as `load`, execute prestige reset, then read disk. The disk prestige level increases while `getCurrentOperation()` is still `load`. Thus the prestige writer demonstrably ignores another operation's ownership.
- Scratch reproducer: `tmp-bugaudit/audit-prestige.test.ts`; config `tmp-bugaudit/audit-jest.cjs`; log `tmp-bugaudit/audit-prestige.log`. Command: `node node_modules/jest/bin/jest.js --config tmp-bugaudit/audit-jest.cjs --runInBand`. Exit 0, 1 reproduction test passed, 56.021 s total, 764 ms test body. Passing means the test reproduced the undesirable behavior, not that the product is safe.
- Player impact: overlapping load/restore/purchase persistence can race prestige's destructive save. Actual end-user lost-save outcome was not simulated; violation of serialization was.
- Related failure UX: state changes immediately at `GameActionsContext.tsx:5568`, but this asynchronous write failure only logs at `5647`; the caller cannot await durability. Treat as part of the same persistence correction, not a separate duplicate finding.
- Fix next: make prestige persistence own one coordinated snapshot/write transaction, await completion and expose a recoverable failure to the player; regression should assert no slot write until the competing owner releases. Preserve newer state and original-life snapshot during retries. No fix applied in this audit.

## Verified existing protections; do not list these as open historical bugs

- Same-handler action/save now waits for a React commit (`GameActionsContext.tsx:316-322`). Real provider regression confirms purchases survive save-slot switch/reload.
- Settings slot exit awaits `saveBeforeLeaving(saveGame,...)` and handles rejection (`SettingsModal.tsx:149-178`).
- Mutex stalled-holder watchdog retains ownership (`saveLoadMutex.ts:99-108`); timeout is not permission for another writer.
- Startup replay retries without dropping durable pending entries after lock acquisition timeout (`saveQueue.ts:879-899`).
- IAP disk read-modify-write owns the mutex (`IAPService.ts:1735-1743`), purchase target is checked, durable receipt markers and pending transactions support safe retry (`IAPService.ts:2571-2634`).

Focused command: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/save/saveInSameHandlerPersistsAction.test.ts __tests__/save/saveBeforeLeaving.test.ts __tests__/save/queueReplayLockTimeout.test.ts __tests__/save/stalledWriter.test.ts __tests__/monetization/iapDurableFulfillment.test.ts __tests__/monetization/iapNoDoubleGrant.test.ts`.

Result: exit 0; 6 suites, 23 tests passed, 12.398 s. Log: `tmp-bugaudit/audit-save-tests.log`.

## Separate acceptance gaps (not confirmed code defects)

- Exact signed iOS build: background/kill during save, restore and journal replay; low-storage and OS termination behavior.
- Old installed-version saves upgraded on device, slot selection and generation transition after relaunch.
- StoreKit/RevenueCat real purchase/restore, interrupted and pending fulfillment, switching characters while recovery is pending, consumable non-regrant and permanent entitlement restore.
- Real offline/slow cloud account restoration and cross-device conflicts. Mocked persistence tests cannot certify provider behavior.

No full suite, provider calls, paid builds or production publication performed by this review.
