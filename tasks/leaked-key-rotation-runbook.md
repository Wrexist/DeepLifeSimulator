# Leaked Google Play Service-Account Key — Rotation & History Purge Runbook

**Incident:** `google-play-service-account.json` (a Google Play / Google Cloud service-account key used by EAS for automated Play Console publishing) was committed to git history. It appears in **3 commits** (including PR merge commits), then was removed from the working tree and added to `.gitignore` (line 47). The **blob still exists in git history** and is extractable by anyone with repo (or fork/PR) access.

**Repo:** `Wrexist/DeepLifeSimulator` · **Bundle ID:** `com.deeplife.simulator`

---

## ⚠️ Read this first — Rotate first, scrub second

**Assume the key is already compromised.** Treat this as a live leak, not a cleanup task.

- **Key rotation in Google Cloud / Play Console is the ONLY real mitigation.** Once a secret has been pushed to a remote, you must assume it has been cloned, cached, scraped, or indexed. Anyone who pulled, forked, or opened a PR before the purge may still hold a copy of the blob.
- **History scrubbing alone is insufficient.** Rewriting git history removes the blob from *your* history, but does **nothing** to a copy that already left your control. Scrubbing reduces future exposure; it does not undo the leak.
- **Therefore: do Step 1 (rotate) FIRST and independently.** Do not wait for, or block on, the history purge. The purge (Step 2) is important hygiene but is lower urgency than killing the live credential.

**Order of operations:** Step 1 (rotate — urgent, do now) → Step 2 (purge history — do on a full clone elsewhere) → Step 3 (verify & prevent recurrence).

---

## Step 1 — Rotate the key (URGENT — do this first)

### 1.1 Identify the leaked key

You need the service-account email and the leaked key's **Key ID**. The leaked JSON contains both:

```bash
# On a machine that still has a copy of the leaked file (or extract from history — see Step 2.1):
#   "client_email": "...@<project>.iam.gserviceaccount.com"
#   "private_key_id": "<KEY_ID>"   <-- this is the key ID to disable/delete
```

### 1.2 Disable / delete the leaked key in Google Cloud Console

1. Go to **Google Cloud Console** → https://console.cloud.google.com
2. Select the **project** that owns the service account (matches `project_id` in the leaked JSON).
3. Navigate: **IAM & Admin** → **Service Accounts** (`/iam-admin/serviceaccounts`).
4. Click the service account whose email matches `client_email` from the leaked JSON.
5. Open the **Keys** tab.
6. Find the key whose ID matches `private_key_id` from the leaked JSON.
7. Click the **trash / Delete** icon for that key → confirm **Delete**.
   - Deleting immediately invalidates the credential. There is no separate "disable" for user-managed keys — deletion is the revocation.
8. (Recommended) While here, audit the **Keys** list and delete any other stale/unknown keys.

> If you are unsure which key is leaked and cannot match the ID, the safe move is to delete **all** existing user-managed keys for that service account and issue exactly one new key (1.3). Any automation using an old key will then fail loudly, which is the desired signal.

### 1.3 Create a new key

1. Same **Service Accounts** → select the same service account → **Keys** tab.
2. **Add Key** → **Create new key** → **JSON** → **Create**.
3. A new JSON file downloads. **Treat it as a secret.** Do NOT place it in the repo working tree, do NOT commit it, do NOT paste it into chat/issues/Slack.
4. Store it only in a secrets manager (see 1.4). Delete the local download once uploaded.

> Optional hardening: instead of reissuing the same SA, create a fresh service account with least-privilege Play Console access and migrate to it. Same console path; grant it the **Service Account User** role and the appropriate Play Console API access (1.5).

### 1.4 Update EAS to use the new key (as an EAS secret — never committed)

This repo submits Android via EAS (`eas.json` → `submit.production`). The new key must be supplied to EAS **without** living in the repo. Two supported approaches:

**Option A — EAS-managed credentials (recommended).** Let EAS store the key in its credentials service:

```bash
eas credentials            # interactive
# Platform: Android  →  Profile: production
# → "Google Service Account" → "Manage your Google Service Account Key"
# → upload the new JSON. EAS stores it server-side; nothing lands in the repo.
```

**Option B — EAS secret / env file reference.** Store the JSON as an EAS secret and reference its path:

```bash
# Store the new key as a project-scoped EAS secret (file type):
eas secret:create \
  --scope project \
  --name GOOGLE_PLAY_SERVICE_ACCOUNT_KEY \
  --type file \
  --value /absolute/path/to/new-service-account.json

# Verify it was stored (value is not printed):
eas secret:list
```

Then wire the submit profile to read the key from a path that is provided at build time (kept out of git). In `eas.json` under `submit.production`, add an `android` block:

```jsonc
"submit": {
  "production": {
    "android": {
      // Path is resolved on the EAS builder; the file is supplied via the
      // EAS secret above, NOT committed to the repo. Keep this path in .gitignore.
      "serviceAccountKeyPath": "./google-play-service-account.json",
      "track": "production"
    },
    "ios": { "appleTeamId": "S3U8B8HH96", "ascAppId": "6749675615", "language": "en-US" }
  }
}
```

> **Prefer Option A.** With Option A you do not need `serviceAccountKeyPath` in `eas.json` at all, and there is no key file path to leak. Whichever you choose, the new key JSON must **never** re-enter the working tree of a tracked path. `.gitignore` line 47 already protects the literal filename `google-play-service-account.json` — keep that protection (Step 3.1).

### 1.5 Confirm Play Console linkage

If you created a *new* service account (rather than reissuing a key for the existing one):

1. **Google Play Console** → https://play.google.com/console → **Users and permissions**.
2. **Invite new users** → enter the new service-account email → grant **Admin (or scoped release)** access with at least: *Releases — manage production releases* (and other tracks you publish to).
3. In **Google Cloud Console** → **APIs & Services**, ensure the **Google Play Android Developer API** is enabled for the project.

### 1.6 Verify the old key no longer works and the new one does

```bash
# (a) Prove the OLD key is dead. With a copy of the leaked JSON, mint a token:
gcloud auth activate-service-account --key-file=/path/to/LEAKED-key.json
gcloud auth print-access-token        # EXPECTED: fails / "invalid_grant" / key not found
# (Delete the leaked file afterward; it must not persist anywhere.)

# (b) Prove the NEW key works end-to-end via a real submit dry run:
eas build --platform android --profile production   # build a fresh AAB if needed
eas submit --platform android --profile production --latest
# EXPECTED: authenticates and uploads to Play (use an internal/closed track first if cautious).
```

If (a) still returns a token, the wrong key was deleted — return to 1.2 and delete the correct Key ID (or all keys).

---

## Step 2 — Purge the blob from git history (do this on a FULL clone, NOT in this container)

### 2.1 ⚠️ Shallow-clone limitation

This container is a **shallow clone** — `.git/shallow` exists, so most history is absent and a full rewrite **cannot** be performed here. Attempting `filter-repo`/BFG here will silently miss commits and produce a corrupt/incomplete rewrite.

**Do the purge on a separate machine with a full, fresh mirror clone:**

```bash
# On an operator machine (NOT this container):
git clone --mirror https://github.com/Wrexist/DeepLifeSimulator.git deeplife-mirror.git
cd deeplife-mirror.git

# Confirm it is NOT shallow (must print "false"):
git rev-parse --is-shallow-repository

# (Optional) Confirm the blob really is in history and see which commits touched it:
git log --all --oneline -- google-play-service-account.json
```

### 2.2 Option A — `git filter-repo` (preferred)

```bash
# Install once:  pipx install git-filter-repo   (or: brew install git-filter-repo)

# From inside the mirror clone:
git filter-repo --force --invert-paths --path google-play-service-account.json

# Verify the blob is gone from ALL history (should print nothing):
git log --all --oneline -- google-play-service-account.json
```

`git filter-repo` strips the path from every commit, all branches, and all tags in one pass, and removes the original refs automatically.

### 2.3 Option B — BFG Repo-Cleaner (alternative)

```bash
# Requires Java + bfg.jar from https://rtyley.github.io/bfg-repo-cleaner/
# From inside the mirror clone:
java -jar bfg.jar --delete-files google-play-service-account.json .

# BFG leaves refs to clean up; finish with:
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify (should print nothing):
git log --all --oneline -- google-play-service-account.json
```

> BFG does not rewrite the most recent commit on a branch tip by default; since the file was already removed from the working tree this is fine, but confirm the verify command returns empty regardless.

### 2.4 Force-push the rewritten history (all branches + tags)

```bash
# From inside the mirror clone — this overwrites remote history:
git push --force --mirror origin
# (--mirror pushes ALL refs: every branch and every tag, and deletes refs removed by the rewrite.)
```

**⚠️ This rewrites shared history.** Before pushing, and immediately after:

- **Coordinate with every collaborator.** Announce a freeze; have open work pushed/backed up first.
- **Everyone must re-clone (or hard-reset) after the push.** Old local clones still contain the blob and will re-introduce it on the next push if merged. Do not let anyone `git pull` an old clone onto the rewritten history.
- Rewriting changes **all commit SHAs** after the first affected commit — open PRs/branches referencing old SHAs will need rebasing or recreation.

### 2.5 Invalidate cached / unreachable copies

Rewriting + force-push does **not** fully erase the blob from GitHub:

- **GitHub retains unreachable commits** in its internal storage and may still serve the blob by its commit/blob SHA for some time, and through the API/caches.
- **Forks and the PR "merge" refs** (the 3 commits include PR merges) can retain their own copy of the blob independent of your branches.

Actions:

1. **Delete or coordinate cleanup of any forks** that may carry the blob.
2. **Close/clean affected PRs** if their refs still expose the file.
3. **Open a GitHub Support request** ("remove cached views of sensitive data") referencing the specific commit SHA(s) and blob, asking them to purge unreachable commits and cached views. This is the only way to clear GitHub-side caches and the `?w=` / raw blob endpoints.
4. Re-run secret scanning afterward (Step 3.2) to confirm GitHub no longer surfaces it.

> Reminder: none of 2.5 substitutes for Step 1. By the time you finish here, the rotated key (Step 1) is what actually protects you — the old credential is already dead.

---

## Step 3 — Verify & prevent recurrence

### 3.1 Keep the `.gitignore` protection

`.gitignore` already contains the entry (line 47):

```
# secrets
google-play-service-account.json
```

**Keep it.** Do not remove it. Consider broadening it to defend against variants:

```
# secrets
google-play-service-account.json
*service-account*.json
*-key.json
*.keystore
google-services.json
```

(Verify nothing currently tracked relies on these patterns before broadening: `git ls-files | grep -Ei 'service-account|\.keystore|-key\.json'`.)

### 3.2 Enable GitHub secret scanning + push protection

In **GitHub → repo Settings → Code security and analysis**:

- Enable **Secret scanning**.
- Enable **Push protection** (blocks future commits that contain recognized secrets at push time).
- Review the **Secret scanning alerts** tab and resolve/confirm the Google service-account finding once the purge + rotation are complete.

Run a scan to confirm it is clean (via API/CLI or the MCP `run_secret_scanning` tooling).

### 3.3 Add a local pre-commit guard

Stop secrets from ever reaching a commit:

```bash
# git-secrets (AWS Labs) — blocks commits matching secret patterns:
brew install git-secrets        # or build from source
git secrets --install           # installs the hooks into .git/hooks
git secrets --register-aws      # baseline patterns
git secrets --add 'private_key'                         # catches PEM/JSON keys
git secrets --add '"type": "service_account"'           # catches GCP SA JSON
```

Alternative: a `pre-commit` framework hook (e.g. `detect-private-key`, `detect-secrets`) committed to `.pre-commit-config.yaml` so every contributor gets it.

### 3.4 Store ALL secrets as EAS secrets only

- Service-account keys, signing secrets, API tokens → **EAS secrets / EAS-managed credentials only** (Step 1.4). Never in `eas.json`, `app.config.js`, `.env` (already gitignored), or any tracked file.
- `app.config.js`/`eas.json` may reference secret **names/paths**, never secret **values**.

### 3.5 Final verification checklist

- [ ] **Old key revoked** — leaked Key ID deleted in Cloud Console; `gcloud auth print-access-token` with the old key **fails** (Step 1.6a).
- [ ] **New key works** — `eas submit --platform android --profile production` authenticates and uploads (Step 1.6b).
- [ ] **New key stored as a secret** — present in EAS (`eas secret:list` / `eas credentials`), absent from every tracked file.
- [ ] **Blob gone from history** — on the full mirror, `git log --all --oneline -- google-play-service-account.json` prints nothing (Step 2.2/2.3).
- [ ] **Force-push done + team re-cloned** — collaborators notified; stale clones discarded (Step 2.4).
- [ ] **Caches invalidated** — forks/PRs cleaned, GitHub Support request filed for unreachable-commit purge (Step 2.5).
- [ ] **Secret scanning clean** — GitHub secret scanning + push protection enabled; no open alert for the key (Step 3.2).
- [ ] **`.gitignore` intact** — line 47 entry present; pre-commit guard installed (Step 3.1, 3.3).

---

## Appendix — Copy-pasteable command reference

```bash
# ── STEP 1: ROTATE (do first; rotation/deletion happens in the Cloud Console UI) ──
# Console path:  IAM & Admin → Service Accounts → <SA matching client_email> → Keys
#   • Delete the key whose ID == private_key_id from the leaked JSON
#   • Add Key → Create new key → JSON

# Store the NEW key in EAS (never in the repo):
eas credentials                       # Option A (recommended): Android → production → upload key
# — or —
eas secret:create --scope project --name GOOGLE_PLAY_SERVICE_ACCOUNT_KEY \
  --type file --value /abs/path/to/new-service-account.json   # Option B
eas secret:list

# Verify OLD key is dead (expect failure):
gcloud auth activate-service-account --key-file=/path/to/LEAKED-key.json
gcloud auth print-access-token        # EXPECTED: invalid_grant / failure

# Verify NEW key works:
eas submit --platform android --profile production --latest


# ── STEP 2: PURGE HISTORY (on a FULL mirror clone — NOT this shallow container) ──
git clone --mirror https://github.com/Wrexist/DeepLifeSimulator.git deeplife-mirror.git
cd deeplife-mirror.git
git rev-parse --is-shallow-repository                              # must print: false
git log --all --oneline -- google-play-service-account.json       # see offending commits

# Option A — git filter-repo (preferred):
git filter-repo --force --invert-paths --path google-play-service-account.json

# Option B — BFG:
# java -jar bfg.jar --delete-files google-play-service-account.json .
# git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Verify gone (expect empty output):
git log --all --oneline -- google-play-service-account.json

# Force-push ALL branches + tags (rewrites shared history — coordinate first!):
git push --force --mirror origin


# ── STEP 3: PREVENT RECURRENCE ──
# Keep .gitignore line 47 (google-play-service-account.json).
# GitHub → Settings → Code security: enable Secret scanning + Push protection.
git secrets --install && git secrets --register-aws
git secrets --add 'private_key'
git secrets --add '"type": "service_account"'
```
