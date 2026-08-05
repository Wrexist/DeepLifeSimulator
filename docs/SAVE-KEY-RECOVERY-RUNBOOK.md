# Save-Signing Key Incident — Recovery Runbook

**Incident (2026-08-05):** `EXPO_PUBLIC_SAVE_HMAC_KEY` was changed. Players
opened the app to *"No save data found. Please try loading from Save Slots or
start a new game"* over saves that were still on their devices, and their paid
purchases read as though they had never bought anything.

**Repo:** `Wrexist/DeepLifeSimulator` · **Bundle ID:** `com.deeplife.simulator`

Written for someone who has never touched this system. Follow it in order.

---

## ⚠️ Read this first

**Nothing is deleted. The data is intact and unreadable.** Every affected save
and entitlement is still byte-for-byte on the player's device. Recovering it
means putting the old key back — not restoring a backup, not asking players to
do anything clever.

**The only way to actually lose this data is to overwrite it.** A player who
follows the old on-screen advice and starts a new game destroys their save for
good. That is why Step 1 is urgent and Step 5 exists.

**Never delete or replace a key. Only ever add.** The variable is a
comma-separated list and it is append-only by design.

---

## Why one key broke two different things

Saves and permanent IAP entitlements share **one envelope format and one key**.
`IAPService.loadPermanentPerks` calls the same `createSaveEnvelope` /
`decodePersistedSaveEnvelope` that the save pipeline uses
(`utils/saveValidation.ts`). So a single key change produces both symptoms at
once:

| What the player sees | What actually happened |
|---|---|
| "No save data found… or start a new game" | `doubleBufferLoad` read the bytes, could not verify the signature, returned no data |
| "You have no purchases" | `loadPermanentPerks` failed verification and **failed closed to `[]`** |

The code predicted this. From `resolveSaveHmacKeys` in
`utils/saveSigningConfig.ts`:

> a rotation did not degrade anything gracefully: it invalidated every save on
> every device at once… the blast radius is not only saves — paid permanent
> entitlements are signed with the same key and fail closed to `[]`, so a key
> change also presents a paying player as never having purchased.

The multi-key list exists precisely so this **can** degrade gracefully. It was
not used.

---

## Step 0 — Do not make it worse (5 minutes)

Before touching anything:

- [ ] **Do not rotate the key again.** Each additional change adds another
      generation of unreadable data.
- [ ] **Do not remove any key that has ever shipped**, now or later.
- [ ] **Do not tell players to start a new game, reinstall, or delete the app.**
      Reinstalling wipes the container and destroys the recoverable save. Say
      "we're fixing it, don't start over" and nothing else.
- [ ] **Pause merges to `main`** until Step 6 is in, if updates publish
      automatically. Every push to `main` publishes an OTA to production.

---

## Step 1 — Recover the old key value (URGENT)

The old key is **not lost**. `EXPO_PUBLIC_*` variables are inlined into the
JavaScript bundle in plaintext at build time — that is how Metro works, and it
is why `saveSigningConfig.ts` carries a comment about Metro only rewriting
direct `process.env.X` reads. So the value sits readable inside **every build
you have ever shipped**.

Try these in order and stop at the first that works.

### 1.1 — Is it still in EAS?

```bash
eas env:list --environment production
```

If `EXPO_PUBLIC_SAVE_HMAC_KEY` is listed, check whether the value is one entry
or already a comma-separated list:

```bash
eas env:get --environment production --name EXPO_PUBLIC_SAVE_HMAC_KEY
```

### 1.2 — Local `.env`, password manager, shell history

```bash
grep -r "EXPO_PUBLIC_SAVE_HMAC_KEY" ~/.zsh_history ~/.bash_history 2>/dev/null
grep -rn "EXPO_PUBLIC_SAVE_HMAC_KEY" ~/Desktop ~/Documents 2>/dev/null
```

The original was created with `eas env:create --value "<the key>"`, so shell
history is a strong lead.

### 1.3 — Extract it from a shipped build (this almost always works)

You build locally — the crash report in this incident came from
`eas-build-local-nodejs/…` — so an archive is very likely still on the Mac that
produced it.

**Find a bundle:**

```bash
# Xcode archives (iOS)
find ~/Library/Developer/Xcode/Archives -name "main.jsbundle" 2>/dev/null

# Or unzip an .ipa you still have
unzip -o DeepLifeSimulator.ipa -d /tmp/ipa
find /tmp/ipa -name "main.jsbundle"
```

**Read the key out of it.** The dev fallback string `dev-local-save-hmac-key`
lives in `resolveSaveHmacKeys`, immediately after the place the real key is
inlined — so it is a reliable anchor to search around:

```bash
BUNDLE=/path/to/main.jsbundle
grep -o -E '.{400}dev-local-save-hmac-key' "$BUNDLE"
```

The production key appears in that window as a plain string literal, next to the
other `EXPO_PUBLIC_SAVE_*` reads. Pick the build **from before the key changed** —
compare against a build made after, and the differing literal is the old key.

> This also tells you something worth internalising: **this key was never secret
> from the client.** It is an anti-tamper measure, not a cryptographic secret.
> Treat "leaked" and "rotated" as very different problems — see Step 7.

### 1.4 — If you genuinely cannot find it

Stop and say so rather than guessing. Options at that point are (a) accept that
pre-change saves are lost and communicate honestly, and (b) recover purchases
via Step 5, which works **without** the old key. Do not ship
`EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES=true` to production as a workaround —
the preflight refuses it for good reason, and it disables the tamper protection
for everyone permanently.

---

## Step 2 — Put the old key back, without removing the new one

The variable is a **comma-separated list, newest first**. The first entry signs
new writes; **every** entry is accepted when verifying. Old saves verify again
and quietly re-sign onto the current key the next time they are written.

```bash
# Replace the values with the real ones. Current key FIRST.
eas env:update \
  --environment production \
  --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value "<current-key>,<old-key>" \
  --visibility sensitive
```

If the variable does not exist, create it instead:

```bash
eas env:create --scope project \
  --environment production \
  --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value "<current-key>,<old-key>" \
  --visibility sensitive
```

Repeat for any other environment you ship from (`preview`, if you use it).

**Rules for this list, forever:**

- Add to the front. Never remove an entry that has shipped.
- Order matters only for signing; verification tries all of them.
- If you are unsure whether a key ever shipped, keep it.

---

## Step 3 — Ship it

An **OTA update is the fast path** — minutes, no App Store review, reaches every
installed device:

```bash
eas update --channel production --environment production \
  --message "Restore previous save-signing key"
```

`--environment production` is **load-bearing, not cosmetic**. Without it,
`eas update` builds the bundle from your shell's environment — which has none of
the EAS project variables — and the key inlines as `undefined`. That is the
mechanism that caused this incident in CI. Step 6 makes that impossible to
repeat.

A native build is only needed if you also changed native config.

---

## Step 4 — Verify, on a real device

Do not declare this fixed from the CLI. Check the actual symptoms:

1. On a device that showed the problem, install/receive the update.
2. Open the app. The **Continue** card should show the character, and tapping it
   should now enter the game rather than showing "No save data found".
3. Open **Save Slots**. It should list the save, not an error state.
4. Check that previously purchased permanent items are present again.

If Continue still fails, read the message carefully — the app now distinguishes
the cases (see Step 8) instead of collapsing them all into "no save".

---

## Step 5 — Recover purchases (works without the old key)

Entitlements do **not** depend on recovering the key, because the App Store is
the source of truth and the local envelope is only a cache. Restoring re-grants
and re-signs under the **current** key.

- Tell affected players: **Settings → Restore Purchases** (also in the Gem Shop).
- After the fixes in `d31eae6` ship, the app detects this itself and offers the
  restore on launch (`IAPHandler` reads `IAPService.areEntitlementsUnreadable()`).

**Watch for money loss.** Subscriptions and non-consumables restore for free.
**Consumables — the gem packs — do not.** A player who re-buys gems because
their old ones vanished is charged again for real. Monitor support and refunds
for a few days, and refund proactively where it is clearly this incident.

---

## Step 6 — Prevent recurrence

Already in the repo as of `d31eae6`:

- `scripts/check-update-signing.js` fails the CI job **before** publishing if
  `EXPO_PUBLIC_SAVE_HMAC_KEY` is not configured for the target environment — and
  fails if it cannot check, rather than assuming the best.
- `.github/workflows/eas-update.yml` passes `--environment` on both channels, so
  the EAS project variables actually reach the bundle.
- `loadGame` no longer reports a present-but-unverifiable save as missing, and
  no screen suggests starting a new game over one.

Standing rules:

- [ ] Never delete an entry from `EXPO_PUBLIC_SAVE_HMAC_KEY`.
- [ ] Treat that variable as append-only in every environment.
- [ ] Remember every push to `main` publishes an OTA to production. That is a
      production deploy with no review — treat it like one.

---

## Step 7 — If the key was *leaked* rather than rotated

Different problem, different answer. Because the key is inlined in the client
bundle it was never secret, so a "leak" changes very little: it is an
anti-tamper measure whose threat model is a casual save editor, not a
cryptographic secret protecting a server.

If you still decide to rotate:

1. **Add** the new key to the front of the list. Never remove the old one.
2. Ship.
3. Existing saves keep verifying under the old entry and re-sign onto the new
   key as players play.
4. Only consider dropping the old entry once you are willing to abandon every
   save that has not been written since — which in practice is never.

See also `tasks/leaked-key-rotation-runbook.md`, which covers the very different
case of a real server credential (Google Play service account) in git history.

---

## Step 8 — Reading the symptoms

After `d31eae6` the app tells these apart. Use the message to decide what to do.

| Message | Meaning | Action |
|---|---|---|
| **"Save Could Not Be Read"** — *your save is still on this device…* | Bytes present, signature refused | This runbook. Recover the key. **Do not start a new game.** |
| **"Newer Save Found"** | Save written by a newer build than the one installed | Update the app. Nothing is wrong with the save. |
| **"No save data found"** | Slot genuinely empty | Nothing to recover. Safe to start fresh. |

Before `d31eae6`, all three showed the last message. If a player reports the old
wording, assume the first case until proven otherwise.

**Save Slots is the diagnostic screen.** It probes blob existence directly
(`probeSaveSlotBlob`) and marks a slot as recovery-needed rather than empty, so
it will not offer Start New Game over recoverable bytes. Send players there
before anything else.

---

## Quick reference

```bash
# What is configured right now?
eas env:list --environment production

# Put the old key back (current first, never remove)
eas env:update --environment production --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value "<current-key>,<old-key>" --visibility sensitive

# Ship it fast
eas update --channel production --environment production --message "Restore signing key"

# Prove the gate works before trusting it
node scripts/check-update-signing.js production
```

**One sentence to remember:** the key list is append-only, and every entry you
remove is a generation of players' saves and purchases you are throwing away.
