# Performance Master Pass — plan (branch claude/deep-life-perf-optimization-t5brac)

Principle: MEASURE → IDENTIFY → OPTIMIZE → MEASURE → VERIFY. Bit-identical
behavior everywhere; save reliability outranks speed.

## Phase 1 — Baseline
- [x] 1.1 Tick benchmark (`tickTiming.bench`): early mean 5.63ms / late mean 3.28ms
      (Node, pessimistic), state 469KB at week 600.
- [x] 1.2 State composition at week 600: checkpoints 291KB (62%), cryptoMarket 37.5KB,
      mail 37.5KB, careers 14KB — growth is bounded (mail cap 50, priceHistory capped,
      checkpoints capped at 3 and slimmed).
- [x] 1.3 Save-signing microbench on a 469KB payload: HMAC 129.8ms, CRC32 18.7ms,
      JSON.stringify 4.9ms (Node/JIT — Hermes interprets, so device cost is a multiple).
      Signing runs on EVERY save, EVERY load, queue persist, and backup creation.
- [x] 1.4 CPU profile of 600 ticks: top game-code self-time is fnv1a32 (~0.35ms/tick),
      the updater, rollWeeklyEvents (~0.17ms/tick) — tick itself is healthy.

## Phase 2 — Optimizations (highest impact first)
- [x] 2.1 P0: rewrite the pure-JS SHA-256/HMAC core onto typed arrays (one padded
      allocation, hoisted K, reused schedule; both padding modes + CESU-8 preserved).
      Result: 129.8ms → 8.9ms per signature (14.6×), bit-identical digests.
- [x] 2.2 P0: table-driven CRC32, preserving the signed-hex output exactly
      (half of all existing checksums serialize with a leading minus sign).
      Result: 18.7ms → 1.7ms (11×).
- [x] 2.3 P1: AutoSaveIndicator polled AsyncStorage every 2s forever; saveQueue now
      mirrors lastSaveTime in memory via getStatus(), indicator reads disk once.
- [x] 2.4 Equivalence pins: `__tests__/save/saveSigningEquivalence.test.ts` — reference
      copies of the old implementations vs new across adversarial corpus (byte ranges,
      >0xFF charCodes, astral/CESU-8, block boundaries, both paddings, legacy HMAC
      verification path, node:crypto cross-check, emoji round-trip).

## Phase 3 — Audited, no change needed (evidence recorded)
- [x] 3.1 Timers/intervals: all bounded or AppState-paused (prior crash-fix passes).
- [x] 3.2 Animations: HUD loops native-driver + bounded + cleaned up.
- [x] 3.3 Render subscriptions: 13 broad `useGameState()` users left, all rarely-mounted
      modals; hot paths on useGameSelector.
- [x] 3.4 Analytics/cloud-sync/remote-logging intervals: no-op when idle, pause on background.
- [x] 3.5 doubleBufferSave read-back verify: deliberate crash-safety, kept.
- [x] 3.6 Startup: staged init already in place; load-path verify got the 10×+ signing win.

## Phase 4 — Validation
- [x] 4.1 type-check + type-check:tests + lint:errors
- [x] 4.2 save + integration + stress + performance + unit suites
- [x] 4.3 Tick benchmark re-run: no regression (late mean 3.24ms vs 3.28ms baseline)
- [x] 4.4 Final report + push

## Phase 5 — Checkpoint sidecar (the deferred follow-up, owner-authorized)
- [x] 5.1 Map every path touching checkpoints: performSave/forceSave (+quota
      retries), loadGame (+backup fallback), createBackupFromState, CloudSync
      (both serialize in-memory state → stay self-contained), persistQueue,
      deleteSaveSlot callers (SaveSlots, DeathPopup, DangerZone, phantom
      cleanup, gameInitializer), quota/cache sweeps (key-name collision check).
- [x] 5.2 `utils/checkpointSidecar.ts`: per-slot signed envelope
      (`checkpoint_sidecar_slot_N`), fingerprint-gated writes (first save of a
      session, then only on change), verify-or-absent reads, wrong-life filter
      (`weeksLived` ≤ save's, snapshot `lifeStartWeek` match).
- [x] 5.3 Strip `checkpoints` from the serialized slot payload in performSave +
      forceSave (all four success branches persist the sidecar); reattach in
      loadGame ONLY when the parsed payload has no `checkpoints` key — inline
      (old saves, backups, cloud) always wins. Live state never touched.
- [x] 5.4 No STATE_VERSION bump — decision documented in CLAUDE.md §7
      (optional key, every reader defaults it; a bump would only break
      TestFlight downgrades). `deleteSaveSlot` removes the sidecar.
- [x] 5.5 14-test suite (`checkpointSidecar.test.ts`): strip+persist parity on
      both save paths, change-only writes, stale-sidecar clearing, reattach
      seam, inline precedence, tamper→absent, wrong-life filter, delete parity.
- [x] 5.6 Measured: weekly slot write 202KB → 62KB on the test state
      (469KB → ~178KB at bench week 600, −62%); sidecar (~167KB) written once
      per game-year instead of ~52×.
