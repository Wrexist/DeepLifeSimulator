# SB-1 Path A — HMAC key rotation user-action checklist

> Code work for SB-1 is done (STATE_VERSION bumped 18 → 19, migration 19
> wired). Remaining steps **require you to run commands on your machine
> and configure EAS secrets**; I can't generate or store secrets in this
> repo.

---

## Why this exists

The repo's `.env` file currently contains a literal value for
`EXPO_PUBLIC_SAVE_HMAC_KEY`:

```
EXPO_PUBLIC_SAVE_HMAC_KEY=3eB0RGvCUWKmtk8XfvvqDBRJSjz7wzkz3D6PnfeA5YnjESt_F_FpqpEV4wDMXk8p
```

Anyone with access to this commit (or any past commit on this branch)
can read that key and forge valid HMAC signatures for tampered save data.
Path A rotates the runtime key and leaves the leaked one in git history —
quick fix, accepts that the old key is still in history. Path B (not
taken per your choice) would also scrub history with `git-filter-repo`.

---

## What you need to do

Run these from your local clone, in order.

### Step 1 — Generate the new key

```bash
# 64-char base64 — same shape as the leaked one but new bytes.
NEW_KEY="$(openssl rand -base64 48 | tr -d '\n')"
echo "$NEW_KEY"
```

Save the output. **Never commit it.**

### Step 2 — Store as EAS secret

```bash
# Replaces the old key at build time. The EAS secret takes precedence
# over .env for `eas build`.
eas secret:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY --value "$NEW_KEY" --force
```

The `--force` flag overwrites the existing secret if one was already
set. If you'd rather rotate via the dashboard, the same value lands at
**Project → Secrets → EXPO_PUBLIC_SAVE_HMAC_KEY**.

### Step 3 — Enable the one-release migration escape hatch

```bash
# Allows existing saves (signed with the leaked key) to still load in
# this build via the legacy signature fallback. Without this, players
# who installed an older build can't load their saves.
eas secret:create --scope project --name EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION --value "true" --force
```

**Plan to remove this flag in the NEXT release** (one cycle after this
build ships). By then, anyone who launched the new build will have
re-signed their save with the new HMAC. Players who skipped the cycle
will start fresh — there's no second migration window without paying
the security cost the rotation was meant to fix.

### Step 4 — Remove the literal from `.env`

Open [.env](.env) and either delete the line or replace the value with
an empty placeholder:

```
# EXPO_PUBLIC_SAVE_HMAC_KEY is now set via EAS secrets — do NOT commit a value here.
EXPO_PUBLIC_SAVE_HMAC_KEY=
```

Save the file. Do NOT replace the value with the new key — `.env` is
checked into git.

### Step 5 — Commit

```bash
git add .env contexts/game/initialState.ts utils/saveMigrations.ts \
       __tests__/stress/saveMigrationAudit.stress.test.ts \
       tasks/round7-sb1-path-a-checklist.md

git commit -m "$(cat <<'EOF'
SB-1 Path A: rotate save HMAC key (STATE_VERSION 18 -> 19)

- STATE_VERSION bumped, migration 19 added (no schema change; the bump
  exists so saves last signed under the old key can be re-signed on
  next persist).
- .env literal removed; new value lives in EAS secrets.
- Test asserts now compute the migration list dynamically so future
  bumps don't need test edits.

Build requirements (see tasks/round7-sb1-path-a-checklist.md):
  EXPO_PUBLIC_SAVE_HMAC_KEY               = <newly rotated key>
  EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION   = true  (drop next release)
  EXPO_PUBLIC_SAVE_SIGNATURE_KEY          = (unchanged - legacy fallback)
EOF
)"
```

**Do NOT** include the new key in the commit message, log output, or
anywhere else — only in EAS secrets.

### Step 6 — Verify the build picks up the new key

```bash
npm run preflight
```

If preflight passes (and the other release blockers — IAP verify URL,
AdMob unit IDs — are also resolved), proceed to `eas build`.

---

## What happens at runtime

| Build phase | Action |
|---|---|
| EAS resolves env | `EXPO_PUBLIC_SAVE_HMAC_KEY` reads the new key from the EAS secret store, NOT from `.env`. |
| App starts | `saveValidation.ts` loads the new key into `saveSigningRuntime`. |
| Load existing save (signed with old key) | HMAC verification fails → `ALLOW_WEAK_SAVE_MIGRATION=true` lets the legacy `SAVE_SIGNATURE_KEY` fallback succeed. |
| Migrations | Version bumps from 18 → 19. No schema changes. |
| Next save persist | `createSaveEnvelope()` signs with the new HMAC. The save is now fully transitioned. |
| Subsequent loads | HMAC matches with the new key; legacy fallback unused. |

---

## What you need to verify in TestFlight / Internal Test

1. **Pre-existing save loads cleanly.** Install a build that came BEFORE
   the rotation, play a few weeks, save. Then install the rotated build
   over it. The save should load without prompting the user.
2. **Fresh install works.** Wipe the app, install the rotated build,
   start a new save, advance a week, kill the app, reopen. Save reloads.
3. **No `[SAVE_SECURITY]` errors in the in-app log viewer** on either
   path. A `[SAVE_SECURITY] Failed to generate HMAC` line means the env
   var didn't reach the build — check the EAS secret name spelling.

---

## Reminder for next release

Drop `EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION` once this build has had a
full release cycle on the major stores. Leaving it set permanently
weakens the rotation's security gain.

```bash
eas secret:delete EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION
```

Or unset via the EAS dashboard.

---

## If you want to upgrade to Path B later

Path B scrubs the leaked key from every commit in history (preferred
when the key is sensitive enough that public-history exposure is
unacceptable). Step-by-step is in
[tasks/round7-phase1-action-items.md](tasks/round7-phase1-action-items.md#path-b-—-rotate-+-scrub-history)
under "Path B".

Path B is destructive — coordinate with collaborators first; everyone
will need to re-clone after the force-push.
