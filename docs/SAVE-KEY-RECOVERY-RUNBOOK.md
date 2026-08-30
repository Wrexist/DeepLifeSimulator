# Fixing the Save Key — A Beginner's Guide

**The short version:** a setting called `EXPO_PUBLIC_SAVE_HMAC_KEY` was changed.
That setting is the "signature" the app uses to recognise its own files. When it
changed, the app stopped recognising players' saves and their purchases — even
though both are still sitting on their phones, completely intact.

**Nothing has been deleted.** You are not restoring a backup. You are putting the
old signature back so the app can read its own files again.

You do not need to understand any of it to fix it. Follow the steps in order.

---

## Before you start

**Three rules. These matter more than anything else in this document.**

1. **Never delete a key. Only ever add one.**
   The setting holds a *list* of signatures. Everything in the list is accepted.
   Deleting one is what caused this.

2. **Do not tell players to reinstall or start a new game.**
   That is the only thing that actually destroys a save. Right now their data is
   safe. Tell them "we're fixing it, don't start over."

3. **Do not change the key again while fixing this.**
   Every change adds another group of players who can't read their files.

---

## What you'll need

- A terminal (the black window — Terminal on Mac).
- The `eas` command. Check it works by typing `eas whoami` and pressing Enter.
  If it says you're logged in, you're ready.
- About 30 minutes.

Words you'll see:

| Word | What it means |
|---|---|
| **key** | The secret text used as a signature. Looks like a long random string. |
| **EAS** | Expo's service that builds and ships your app. It stores your settings. |
| **OTA update** | A way to push new code to players' phones in minutes, without Apple review. |
| **bundle** | The file inside your app that contains all your JavaScript code. |

---

# Step 1 — Find out what's configured now

Open your terminal and run:

```bash
eas env:list --environment production
```

**What you should see:** a list of setting names. Look for
`EXPO_PUBLIC_SAVE_HMAC_KEY`.

- ✅ **It's there** → good, a key is active. Go to Step 2.
- ❌ **It's missing** → the app can't save at all. Still go to Step 2; you need
  the old value either way.

---

# Step 2 — Find the OLD key

This is the important step. The old key is **not lost** — it's stored in plain
text inside every version of the app you've ever built. Try these in order and
**stop as soon as you find it**.

### 2a. Check if it's still in EAS

```bash
eas env:get --environment production --name EXPO_PUBLIC_SAVE_HMAC_KEY
```

If this prints a long random string, **copy it somewhere safe right now**. That
may be the current key, the old one, or both separated by a comma.

### 2b. Check your own computer

```bash
grep -r "EXPO_PUBLIC_SAVE_HMAC_KEY" ~/.zsh_history ~/.bash_history 2>/dev/null
```

You originally created this key by typing a command with the value in it, so
your terminal history is a very good place to look. Also check your password
manager and any `.env` file.

### 2c. Pull it out of an old app build

This works even if everything else failed.

**First, find a bundle file:**

```bash
find ~/Library/Developer/Xcode/Archives -name "main.jsbundle" 2>/dev/null
```

You build the app on your own Mac, so there is very likely one there. It will
print one or more file paths.

**Then read the key out of it.** Copy one of those paths and use it here:

```bash
grep -o -E '.{400}dev-local-save-hmac-key' "PASTE_THE_PATH_HERE"
```

**What you should see:** a wall of messy code. Somewhere in it will be a long
random-looking string in quotes — that's your key. `dev-local-save-hmac-key` is
just a landmark that sits right next to it in the file.

> **Tip:** if you have builds from before *and* after the change, run this on
> both. The string that's different between them is the old key.

### ⚠️ If you truly can't find it

Stop and tell someone rather than guessing. Purchases can still be fixed
(Step 6) without it — only saves need the old key. **Do not** try to fix it by
turning off signature checking; that removes the protection for everyone,
permanently.

---

# Step 3 — Put the old key back

You are **adding** the old key next to the current one, separated by a comma.
Current key first.

```bash
eas env:update \
  --environment production \
  --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value "CURRENT_KEY_HERE,OLD_KEY_HERE" \
  --visibility sensitive
```

Replace `CURRENT_KEY_HERE` and `OLD_KEY_HERE` with the real values. Keep the
quotes. Keep the comma. No spaces around the comma.

If the setting doesn't exist at all, use `eas env:create` instead of
`eas env:update`, with the same options plus `--scope project`.

**Why this works:** the first key in the list is used to sign new files; *every*
key in the list is accepted when reading. So new saves keep working AND old
saves start working again.

**Check it:**

```bash
eas env:get --environment production --name EXPO_PUBLIC_SAVE_HMAC_KEY
```

You should see both values with a comma between them.

---

# Step 4 — Send it to players

This pushes the fix to everyone's phone in a few minutes. No Apple review.

```bash
eas update --channel production --environment production \
  --message "Restore previous save-signing key"
```

**⚠️ Do not leave out `--environment production`.** Without it, this command
ignores all your EAS settings and ships an app with *no* key — which is what
caused this whole problem in the first place.

**What you should see:** a progress output ending with a link to the update.

---

# Step 5 — Check it actually worked

Don't trust the terminal. Check on a real phone:

1. Open the app on a device that had the problem. Wait a few seconds on the
   loading screen so it can fetch the update, then close and reopen it.
2. Tap **Continue**.
3. ✅ **It loads the game** → fixed.
4. ❌ **It still says something's wrong** → read the message and check this
   table:

| Message | What it means | What to do |
|---|---|---|
| "Save Could Not Be Read" | The key still isn't right | The old key you found was wrong. Back to Step 2. |
| "Newer Save Found" | Save is from a newer app version | Nothing's broken. Update the app. |
| "No save data found" | That slot is genuinely empty | Nothing to recover here. |

Also open **Save Slots** — that screen is the most reliable way to see whether a
save exists, and it will never offer to overwrite one that's recoverable.

---

# Step 6 — Fix players' purchases

**Good news: this does not need the old key.** Apple remembers what people
bought, so the app can just ask again.

Tell affected players:

> Go to **Settings → Restore Purchases**.

Once the current fixes ship, the app notices this by itself and offers the
restore on launch, so most players won't need telling.

### ⚠️ Watch for double charges

- **Subscriptions and permanent items** — restore for free. Fine.
- **Gem packs** — do NOT restore. If a player re-bought gems because theirs
  disappeared, **they were charged real money again.**

Keep an eye on support messages and refund requests for the next few days, and
refund proactively where it's obviously this problem.

---

# Step 7 — Make sure it can't happen again

Already done in code (commit `d31eae6`) — you don't need to do anything:

- CI now refuses to ship an update if the key is missing.
- The publish command now always passes `--environment`.
- The app no longer tells players to "start a new game" when a save is
  unreadable — that advice was destroying the very data we're recovering here.

**What you still need to remember, forever:**

- ✅ Adding a key is always safe.
- ❌ Removing one throws away everyone's saves and purchases from that era.
- ⚠️ Every push to `main` automatically ships an update to all players. That's a
  real release — treat it like one.

---

<details>
<summary><strong>The technical explanation (optional)</strong></summary>

### Why one key broke two different things

Saves and permanent IAP entitlements share **one envelope format and one key**.
`IAPService.loadPermanentPerks` calls the same `createSaveEnvelope` /
`decodePersistedSaveEnvelope` the save pipeline uses (`utils/saveValidation.ts`).
So one key change produces both symptoms at once:

| Player sees | Cause |
|---|---|
| "No save data found… or start a new game" | `doubleBufferLoad` read the bytes, couldn't verify the signature, returned no data |
| "You have no purchases" | `loadPermanentPerks` failed verification and **failed closed to `[]`** |

The code predicted this exactly. From `resolveSaveHmacKeys` in
`utils/saveSigningConfig.ts`:

> a rotation did not degrade anything gracefully: it invalidated every save on
> every device at once… the blast radius is not only saves — paid permanent
> entitlements are signed with the same key and fail closed to `[]`, so a key
> change also presents a paying player as never having purchased.

The multi-key list exists precisely so this *can* degrade gracefully.

### Why the key is extractable from a bundle

`EXPO_PUBLIC_*` variables are inlined into the JavaScript bundle in plain text at
build time — that's how Metro works. So this key was **never secret from the
client**. It's an anti-tamper measure against casual save editing, not a
cryptographic secret protecting a server.

That's also why a *leak* of this key is a very different (and much smaller)
problem than a rotation. If you ever do need to rotate it: add the new key to the
front, never remove the old one, and let saves re-sign themselves as people play.

For a real server credential in git history — a genuinely serious leak — see
`tasks/leaked-key-rotation-runbook.md`.

### Why `--environment` matters

`eas update` builds a fresh JavaScript bundle. Without `--environment`, it uses
whatever variables happen to be in your shell — which is nothing — so the key
inlines as `undefined` even though EAS has it configured correctly. Combined
with the workflow publishing to production on every push to `main`, that was a
review-free path to shipping a keyless app to every device.
`scripts/check-update-signing.js` now blocks it.

### Reading the code

| File | Role |
|---|---|
| `utils/saveSigningConfig.ts` | Resolves the key list; `resolveSaveHmacKeys` documents the append-only rule |
| `utils/saveValidation.ts` | `createSaveEnvelope` / `decodePersistedSaveEnvelope` / `doubleBufferLoad` |
| `services/IAPService.ts` | `loadPermanentPerks` — same envelope, same key |
| `scripts/check-update-signing.js` | The CI gate |

</details>

---

## Copy-paste summary

```bash
# 1. What's configured now?
eas env:list --environment production

# 2. Find the old key (try in order)
eas env:get --environment production --name EXPO_PUBLIC_SAVE_HMAC_KEY
grep -r "EXPO_PUBLIC_SAVE_HMAC_KEY" ~/.zsh_history 2>/dev/null
find ~/Library/Developer/Xcode/Archives -name "main.jsbundle" 2>/dev/null
grep -o -E '.{400}dev-local-save-hmac-key' "PATH_TO_BUNDLE"

# 3. Add it back (current key FIRST, comma, no spaces)
eas env:update --environment production --name EXPO_PUBLIC_SAVE_HMAC_KEY \
  --value "CURRENT_KEY,OLD_KEY" --visibility sensitive

# 4. Ship it (do NOT omit --environment)
eas update --channel production --environment production \
  --message "Restore previous save-signing key"

# 5. Check on a real phone, then tell players: Settings → Restore Purchases
```

**If you remember one thing:** the key list is add-only. Every key you remove is
a group of players whose saves and purchases you've thrown away.
