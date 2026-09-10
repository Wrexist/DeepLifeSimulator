# Save replay audit — 2026-09-10

Baseline: `ea9880d0`, with the existing local death/wedding popup change left untouched. Reviewed save/purchase changes documented by PRs #197, #203 and #206 against current implementation. No native purchase verification was performed.

## Reproduced defect and fix

**P1: Startup replay bypassed mutex ownership after an acquisition timeout.**

`utils/saveQueue.ts` previously appended persisted operations to the live queue before acquiring the save/load mutex. On timeout it logged `draining unlocked` and called `kickProcessing()` anyway. PR #203 correctly made the mutex retain ownership until uncancellable storage I/O settles, so that timeout was not permission for another writer. Double-buffer writes have no independent mutex or generation fence.

An isolated temporary reproduction on the unmodified baseline used the real queue, mutex, signed envelopes and double-buffer implementation over stateful AsyncStorage. A separate `load` holder remained locked while startup replay timed out, wrote a real slot buffer, changed its active pointer and removed the persisted queue. The reproduction passed its assertions of the unsafe behavior (1 case, 40 ms; suite 4.166 s). The first harness run used an unstarted fixture and was correctly rejected by the pristine-save guard; adding the started scenario made the intended race reachable. The temporary file was removed after replacing it with permanent regression coverage.

The fix acquires the mutex before reading, validating or publishing replay entries. Acquisition timeouts retain the journal and retry through the mutex waiter queue. It holds ownership until the drain settles, then releases its token in `finally`. Duplicate startup calls share one pending operation. Reading the journal only after obtaining ownership also prevents replaying a stale snapshot captured while another writer was changing it.

If a native storage operation never settles, replay remains pending and retries acquisition every normal timeout interval. It does not forcibly release the writer or claim success; a relaunch can retry from the retained journal. This is the same uncancellable-I/O safety limitation as the mutex itself.

Startup restoration is invoked without awaiting it from the provider's mount effect (`GameActionsContext.tsx`, baseline line 4833). Waiting therefore does not block boot rendering. No separate retry timer or second replay worker is created. A current writer can finish and change/remove the journal; replay then reads that current durable value under ownership.

**P1: Backup restore bypassed an outstanding save.** `restoreFromBackup` called `doubleBufferSave` without the shared mutex, and its sole application caller (`RestoreBackupSheet.tsx:143`) did not own the mutex either. Autosave suspension only stops new calls; it cannot cancel a write already in progress. The new regression paused an actual double-buffer write while its caller held the mutex, then requested backup restore. Before the fix the restore incorrectly resolved while the first write was still outstanding (1 failing case, 4.167 s suite). On resumption that earlier write can replace the restored payload.

Backup restoration now owns the mutex across reading the slot, making the safety snapshot, writing the backup and updating bookkeeping. A timeout returns the existing failure result without writing or releasing another holder's token. Call tracing found no lock-owning caller or nested lock acquisition in the helper chain. This change leaves normal backup creation independent of the main save mutex.

## Verification

- Final focused run: `npx jest --runInBand --runTestsByPath __tests__/save/backupRestoreMutex.test.ts __tests__/save/backupRestoreRoundTrip.test.ts __tests__/save/saveBackupProduction.test.ts __tests__/save/queueReplayLockTimeout.test.ts __tests__/save/queueReplayGuards.test.ts __tests__/save/saveQueueCompletion.test.ts __tests__/save/saveLoadMutexOwnership.test.ts __tests__/save/stalledWriter.test.ts`: **8 suites, 44 tests passed**, 9.553 s.
- New behavioral cases verify that timeout leaves the active holder intact, exposes no replay entries to the live drain, performs no slot write, retains the durable journal, shares duplicate registration, retries after release and reads a journal changed during the wait.
- Backup regressions verify waiting for a paused writer, the restored payload remaining active afterward, and timeout failure without writes or an unowned release.
- Focused ESLint: zero errors; 11 existing warnings in the two runtime files remain. New tests have no warnings.
- Scoped `git diff --check`: no whitespace errors.
- `npm run type-check:tests:ratchet`: zero errors (baseline zero), after the concurrent recap test correction.
- Full save/stress and release checks remain the integrating agent's responsibility after all concurrent fixes settle.

## Other inspected behavior and remaining evidence

- Save/load token acquisition failures now follow their false/null failure contracts and never release an unowned lock (#206).
- Double-buffer save verifies payload and pointer writes; load verifies envelopes, falls back to the other buffer/legacy key and treats unreadable data as occupied rather than empty.
- Migration chains stop on failure, preserve the last successful version and flag future-version saves for refusal. Malformed legacy item filtering from #197 is present.
- Purchase intent persistence, product/customer/slot/life binding, receipt baseline matching, same-envelope quantity markers, checkpoint reattachment and permanent entitlement persistence are present. Historical consumables, reinstall/cross-device grants, and subscription local bonuses after a lost callback are outside the same-installation recovery guarantee.
- Native StoreKit/RevenueCat purchase, forced save failure, app termination, relaunch, Restore, wrong-life recovery and checkpoint retention must pass the signed-candidate matrix in `tasks/release/R06.md`. Existing mock tests and this queue fix do not close that gate.
