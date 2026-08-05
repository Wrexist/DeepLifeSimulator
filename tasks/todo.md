# Active plan — the save-signing key incident, and three bugs it exposed

Owner report (2026-08-05): downloading the live App Store build showed a
Continue card reading "Edward Hall · 21 yrs · $50.49K" and then said **"No save
data found. Please try loading from Save Slots or start a new game."** — and no
IAP purchases or subscriptions since the `EXPO_PUBLIC_SAVE_HMAC_KEY` was
deleted.

---

## Root cause

One key signs **two** things through the same envelope: every save, and every
permanent IAP entitlement. `IAPService.loadPermanentPerks` calls the same
`createSaveEnvelope` / `decodePersistedSaveEnvelope` the save pipeline uses. So
one key change produces both symptoms at once:

- saves stop verifying → `doubleBufferLoad` returns no data;
- `loadPermanentPerks` fails closed to `[]` → a paying player presents as never
  having purchased.

`resolveSaveHmacKeys` predicted this in its own docstring: a rotation
"invalidated every save on every device at once", and "the blast radius is not
only saves". The multi-key list exists precisely so this degrades gracefully:

```
EXPO_PUBLIC_SAVE_HMAC_KEY="current-key,previous-key"
```

First entry signs; **all** of them verify; old data re-signs onto the current
key the next time it is written. Every previously shipped key must stay in that
list forever.

The key itself is recoverable: `EXPO_PUBLIC_*` is inlined into the JS bundle in
plaintext at build time, so it sits readable inside every build ever shipped.

---

## Fixed

- [x] **A successful spend reported as unaffordable** (`manageFamilyBusiness`).
      A player report showed `Need $10,000 for "marketing" — you have $1.54M.`
      `didManage` was assigned inside the `setGameState` updater and read on the
      next line; React defers the second functional update of a batch, so it read
      `false` while the updater went on to charge the money and apply the gain.
      The same report showed the balance down from $1.54M to $214,884 — roughly
      133 taps, every one charged, every one reported as a failure. Converted to
      the C-10 pure resolver the ratchet's own header prescribes.
- [x] **"Present but unreadable" reported as "no save"** (`loadGame`).
      `doubleBufferLoad` distinguishes `'none'` / `'unverified'` / `'unknown'`
      and carries `blobPresent` so callers can tell "nothing stored" from
      "stored and unreadable"; `loadGame` collapsed all three into `null`. The
      resulting advice — start a new game — is the one action that destroys the
      data being reported as absent. Now throws `SaveUnreadableError`, handled in
      both MainMenu and SaveSlots with copy that never offers a new game.
- [x] **The entitlement restore prompt that was detected and never offered.**
      `loadPermanentPerks` already set `entitlementsUnreadable` and persisted a
      marker, with a comment saying the point was "so the app can offer a restore
      instead of silently presenting a paying player as never having bought
      anything" — and nothing anywhere read either one. `IAPHandler` (mounted
      once in `GameProvider`) now offers the restore. Restore works without the
      old key: the App Store is the source of truth and the re-grant re-signs
      under the current key.
- [x] **The OTA path could ship a keyless bundle to every device.**
      `eas-update.yml` published to the **production channel on every push to
      `main`** with no preflight and no `--environment`, so `eas update` bundled
      from the CI shell — which holds none of the EAS project variables — and the
      signing key inlined as `undefined` even though it was configured correctly.
      preflight §8 guards `eas build`; nothing guarded the faster, review-free
      path. Now `--environment` is passed and `scripts/check-update-signing.js`
      fails the job before publishing if the key is not configured (and fails if
      it cannot ask, rather than assuming the best).

---

## Two test-harness traps recorded

Both make a broken test look like a passing one:

- `createSetGameStateStub` applies updaters **synchronously**, which is the one
  timing where the read-out-of-updater bug works. A unit test written against it
  passes on the bug. `familyBusinessManage.test.ts` uses a deferring stub that
  queues updaters, which is the honest model.
- Pinning an exact source line in a wiring test (`saveFlowRound3`) failed on a
  change that *strengthened* the property it protects — the re-throw guard
  growing a second typed error. Match on intent.

---

## Still open — owner action, not code

1. **Restore the old key** as a later entry in `EXPO_PUBLIC_SAVE_HMAC_KEY`.
   Until then, saves written under it stay unreadable. Extract it from a
   previously shipped bundle if it is not in EAS or a password manager.
2. **Never delete or replace a key** — only prepend. The list is append-only by
   design.
3. Affected players can recover purchases now via **Restore Purchases**; the
   app will also offer it on launch after this ships.
