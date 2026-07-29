# Save-system hardening — phased plan (2026-07-29)

Companion to `save-system-audit-2026-07-29-findings.md` (42 confirmed findings).
Ordered by *what stops a player losing a save*, not by severity label.

## Verdict on the reported incident, first

The player's report (2.5.3 build 141, prestiged save replaced by a Week 1 /
Age 18 / Gen 1 character that validated clean) is **SAVE-OW-1**, and it was
**already fixed in 2.5.7** — after their build.

The evidence is a fingerprint match: money 200, age 18, week 1, weeksLived 0,
generation 1, careers 30, items 8, relationships 2 are `initialGameState`
field-for-field. It cannot be an onboarding-built state — no scenario starts at
age 18 with cash 200, and `buildNewGameState` always writes a name and a
scenario id. The 2-minute autosave and the AppState background save both ran
while the player sat on MainMenu with the untouched boot state, wrote it to
slot 1, and repointed `lastSlot`. `isPristineUnstartedState` (commit `669c334`)
now refuses exactly that write.

So the incident is closed — but the audit found **41 still-present** ways to
lose or fail to recover a save. Those are the work below.

---

## Phase 1 — A new life can never overwrite a save *(done)*

Independently found before the audit landed and corroborated by **SAVE-OW-2**.

| Finding | Fix |
|---|---|
| SAVE-OW-2 | Death screen navigated into onboarding setting no slot; `Perks` closed the gap with `state.slot \|\| 1` |
| SEC-1 / PIPE-1 / SAVE-OW-3 | `readSaveSlot` flattens *empty*, *failed verification* and *read threw* into one `null`; three occupancy guards read that as "free" |

Shipped:

- `src/features/onboarding/slotSafety.ts` (new) — the write's own occupancy
  check. Refuses rather than defaults; `free` only on positive evidence.
- `gameInitializer` Step 0 — gated before the backup *and* the save, so a
  refused run cannot even pollute the occupant's backup ring.
- `flowGuard` requires a chosen slot for Customize / Ambitions / Perks.
- `OnboardingContext.slot` defaults to `NEW_LIFE_SLOT_UNSET` (0), not 1.
- `DeathPopup` sets the slot it just freed; falls back to the picker.
- `findFirstEmptySlot` / `checkIfAllSlotsFull` / `inspectSlotForNewLife` all
  decide emptiness from `probeSaveSlotBlob`, never from a flattened null.
- `audit-save.cjs` V10 — three static checks so a new navigation path cannot
  reintroduce any of it.

## Phase 2 — Recovery actually works *(done)*

| Finding | Fix |
|---|---|
| BRC-1b | `restoreFromBackup` wrote the legacy key the loader never reads — every restore was a silent no-op. Now writes through `doubleBufferSave`. |
| BRC-2 | 5-deep ring + unthrottled autosave = ~10 minutes of history. Now: auto_save rate-limited, generational retention, protected reasons exempt from rotation. |
| BRC-3 / SAVE-OW-4 | The "pre-save backup" snapshotted the state being *written*. New `snapshotOutgoingSave()` captures the outgoing envelope verbatim (no decode, so an unverifiable save is still captured) — wired into onboarding and the death-screen slot wipe. |

## Phase 3 — Give the player the recovery surface *(done)*

| Finding | Fix |
|---|---|
| BRC-1 | Backups were write-only — `restoreFromBackup` / `createManualBackup` / `listAllBackups` had zero callers, and the slot state labelled "Recovery Needed" offered only Delete. New `RestoreBackupSheet`, reachable from every slot with data or in recovery. It is a *restore point picker*, not a file list: each entry leads with who the character was and how far they got. |
| BRC-6 | The gate was written for an in-run rewind and applied to every restore. `restoreFromBackup` now takes an `intent`; a `'recovery'` skips the death, generation and criminal-record checks, and the generation check is off-by-one even for a rewind so the life you just finished stays restorable. The catch now fails **open** — refusing a restore because the check crashed is strictly worse than the single-player exploit it guards. |
| BRC-14 | The restore read the outgoing save only to feed the exploit check, then overwrote it. It is now snapshotted under `before_restore` first, so picking the wrong entry is undoable. |
| BRC-7 | The protected-state layer was a closed loop — nothing wrote the keys, so nothing was ever embedded, so nothing wrote the keys. `performSave` now bootstraps it after a successful write. Landed after BRC-6, or switching it on would have started refusing legitimate recoveries. |

## Phase 4 — Stop conflating "unreadable" with "empty" at the source *(done)*

Phase 1 fixed the three *callers*. This fixes the cause.

| Finding | Fix |
|---|---|
| PIPE-1 / SEC-1 (root) | `doubleBufferLoad` returned `{data: null, source: 'none'}` for four different outcomes. It now reports `none` / `unverified` / `unknown` plus a `blobPresent` flag that is never optimistic — a thrown read reports `true`. New `readSaveSlotDetailed`; `readSaveSlot` is untouched so its callers keep their meaning. |
| SAVE-OW-3 | The whole buffer-reading block sat inside `if (currentActive === 'A' \|\| 'B')`, so a slot whose `_active` pointer went missing never had `_A` or `_B` read at all — two intact saves reported as "no data". Both buffers are now tried in either case, and a wrong or missing pointer is healed on read. |
| PIPE-8 | `validateSaveSlot` hardcoded `exists: false` on the null path, so its own corruption messaging was unreachable for the case that produces it. |
| SAVE-OW-8 | `purgeSlotIfPhantom` wiped the summary and slot markers for a blob it merely could not read — the Continue card vanished while the save sat on disk, recoverable and unreachable. |

## Phase 5 — The write pipeline *(done)*

| Finding | Fix |
|---|---|
| SAVE-OW-6 | Four guards turned "I don't know which slot this is" into "write it to slot 1" — the one thing you must not do once you know the target is unknown. All four now refuse. The guard moved to `utils/slotNumber.ts`, a leaf with no imports, because living in `saveQueue` meant every suite mocking the queue silently lost it. |
| SAVE-OW-7 | The persisted queue holds whole GameStates and was replayed on the next launch with only a slot-number check — bypassing every guard that lives in `saveGame`. The replay boundary now drops operations older than 6 hours, pristine unstarted states, and anything that would move the slot backwards. |
| PIPE-3 | `release()` never checked that the caller was the holder, so after the 30s watchdog force-released A and handed the lock to B, A's own `finally` unlocked B and popped C — two writers, one slot. `acquire` now returns a token; a stale release is ignored, and the watchdog invalidates the token before releasing. Token-less release still works, so no call site can silently break. |
| SAVE-OW-5 | A mount effect wrote `currentSlot` on every change *including the first*, and `initialSlot` defaults to 1 with nothing passing it — so every launch overwrote the previous session's marker with "1" before any load. CloudSyncService uploaded under slot_1 and IAPService credited purchases to slot 1's save. `setCurrentSlotSafe` already persists on every real change; the effect only ever added the boot-time clobber. |
| PIPE-9 | The onboarding draft hydration landed with a whole-object replace, so on a cold start it could overwrite the slot New Game had just chosen. Hydration now yields to any live choice. |

## Phase 6 — Migration & repair *(done)*

| Finding | Fix |
|---|---|
| MR-3 | The diagnostic report printed `State version: ${STATE_VERSION}` — the compile-time constant, not the save's. A save frozen at v13 on a v25 app reported "25" in a support ticket, structurally unable to show the one gap that explains a halted migration chain. Now prints both. |
| MR-4 | A save from a newer build is refused on purpose, but the refusal returned a bare `null` — the same value an empty slot returns — so the menu said "No save data found. …start a new game" over an intact newer save. Now a typed `SaveFromFutureError` with honest copy at both entry points. |
| MR-2 | `runMigrations` has a return contract that two of its three call sites honour; the primary load path kept its own reference. Works today because every migration mutates in place — a future pure-style migration would have been silently dropped on the path that matters most. |
| MR-5 | The staking repair tested falsy instead of `undefined`, so a position legitimately staked at absolute week 0 was "migrated" on every load. |
| MR-6 | The invalid-hobby removal set no `repaired` flag, so the clone carrying it was discarded — the fix computed and thrown away on every load. Same class as the fourteen Spark/Pulse backfills. |

## Phase 7 — Signing & cloud

- **SEC-2** — one shared bundled HMAC key, no key id in the envelope, no
  previous-key verification list: any rotation invalidates every save at once.
  This is what makes SEC-1 a fleet-wide risk rather than a local one, and
  `tasks/leaked-key-rotation-runbook.md` shows rotation is a live plan.
- **SEC-3** — `doubleBufferLoad` gates reading the legacy *key* on the
  unsigned-legacy-*format* flag.
- **SEC-8** — the hand-rolled SHA-256 writes a wrong 64-bit length block for
  every message.
- **SEC-7**, SEC-4, SEC-6, BRC-8 through BRC-13.

---

### Method

Five Opus 5 audit domains, every finding adversarially verified by an
independent Opus 5 verifier, synthesised by Fable 5. 46 raw → 42 confirmed,
11 refuted — including four severity downgrades and one claim that this domain
explained the incident.

Every fix in Phases 1–2 shipped with a regression test **proved red against the
pre-fix tree** before being taken green, and the same for each new static check.
