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

## Phase 3 — Give the player the recovery surface *(next)*

- **BRC-1** — backups are write-only. `restoreFromBackup`, `createManualBackup`,
  `listAllBackups` have zero callers. The one UI state literally labelled
  "Recovery Needed" offers only Delete. Add a restore picker to `SaveSlots`.
- **BRC-6** — the anti-exploit gate refuses every pre-prestige and pre-death
  restore and fails closed on its own exception, so it would block the restores
  a recovering player most needs. Must land with BRC-1.
- **BRC-14** — a restore is itself irreversible; snapshot under `before_restore`
  (already a protected reason) first.
- **BRC-7** — the protected-state layer can never bootstrap.

## Phase 4 — Stop conflating "unreadable" with "empty" at the source

Phase 1 fixed the three *callers*. The root cause is still in
`doubleBufferLoad`, which returns `{data: null, source: 'none'}` for four
different outcomes.

- **PIPE-1 / SEC-1 (root)** — widen the return with `blobPresent` and
  `source: 'unverified' | 'unknown'`; add `readSaveSlotDetailed`. Leave
  `readSaveSlot` untouched so its ~10 callers keep their meaning.
- **SAVE-OW-3** — when the `_active` pointer is missing, still try `_A` then
  `_B` before the legacy fallback. A lost pointer must not read as "no data".
- **PIPE-8** — `validateSaveSlot` can never report `exists: true` for an
  unreadable slot, so its corruption messaging is dead.
- **SAVE-OW-8** — `purgeSlotIfPhantom` clears slot markers when the blob is
  merely unreadable.

## Phase 5 — The write pipeline

- **PIPE-2** — the save/load mutex covers the enqueue, not the write.
- **PIPE-3** — `release()` has no ownership token; after the 30s watchdog
  force-release the original holder releases someone else's lock.
- **PIPE-5** — `persistQueue` writes the whole multi-MB state on every queued
  save.
- **SAVE-OW-7** — the persisted queue is replayed at startup with no staleness
  check and outside the mutex. Closes the upgrade hole where a pristine op
  written by a ≤2.5.6 build replays after the user updates.
- **PIPE-4** — the storage-quota recovery path is unreachable on device.
- **PIPE-6 / PIPE-7 / PIPE-9**.
- **SAVE-OW-5 / SAVE-OW-6** — `currentSlot` is stomped to 1 on every launch;
  four invalid-slot guards default to slot 1 instead of aborting the write.

## Phase 6 — Migration & repair

**MR-3** (a halted migration chain loads silently), MR-2, MR-4, MR-5, MR-6.

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
