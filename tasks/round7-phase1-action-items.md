# Round 7 — Phase 1 Action Items (for user/ops, not Claude)

This file lists the security/release items that require **human action or ops decisions** and can't be safely automated from this branch. Each one is short and self-contained.

---

## SB-1. Rotate the committed HMAC signing key

**Why now:** [.env](.env) contains a literal value for `EXPO_PUBLIC_SAVE_HMAC_KEY`. Anyone with repo access (or who clones an old commit) can forge valid save signatures. The project's own `.env.example` says "use EAS secrets" — the .env is the contradiction.

**Two paths — pick one:**

### Path A — Rotate only (5 minutes, less secure)
The old key is still in git history but at least new builds use a new one.

```bash
# 1. Generate a new key
NEW_KEY="$(openssl rand -base64 48 | tr -d '\n')"

# 2. Store as EAS secret (replaces the env var at build time)
eas secret:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY --value "$NEW_KEY"
# (Or use eas secret:push if you have a .env.production file)

# 3. Remove the literal from .env. Replace with a comment.
# (Manual edit — leave the key line blank or pointing to the EAS secret.)

# 4. Bump STATE_VERSION in contexts/game/initialState.ts (19 → 20)
#    and add a migration in utils/saveMigrations.ts that re-signs v19 saves
#    on first load. Players using the leaked key will be re-signed silently.

# 5. Commit the changes (NOT the new key).
git add .env contexts/game/initialState.ts utils/saveMigrations.ts
git commit -m "rotate save HMAC key; bump STATE_VERSION to 20 for re-sign migration"
```

### Path B — Rotate + scrub history (1-2 hours, more secure, destructive)
Removes the old key from every commit. Anyone with old clones must re-clone.

```bash
# Do everything in Path A first, then:

# 1. Coordinate with collaborators — they must stop pushing and re-clone after this.

# 2. Scrub the old key value from all of history. Replace with placeholder.
# Use git-filter-repo (preferred over the deprecated filter-branch):
echo "<OLD_KEY_VALUE_HERE>==>REDACTED" > /tmp/replace.txt
git filter-repo --replace-text /tmp/replace.txt --force

# 3. Force-push to main. THIS REWRITES MAIN HISTORY.
git push --force-with-lease origin main

# 4. All collaborators delete + re-clone the repo. Their local main is now invalid.
```

**Recommendation:** Start with Path A. Do Path B only if the leaked key is sensitive enough that public git history exposure is unacceptable. The migration step (re-sign on load) makes Path A workable for most cases.

---

## SB-2. IAP receipt verification — set up the server endpoint

**What R7 already did:** [services/IAPService.ts](services/IAPService.ts) now **returns `false`** when `EXPO_PUBLIC_IAP_VERIFY_URL` is unset in production (was `return true` — every purchase passed). This blocks the revenue leak immediately. **But it also means no IAP purchases will succeed in production until you configure the URL.**

**What you need to do:**

1. **Deploy a verify endpoint.** Two reasonable options:
   - **Cloudflare Worker** (~50 lines, free tier sufficient): receives `{receipt, productId, transactionId}`, calls Apple's `/verifyReceipt` (or App Store Server API for iOS 17+) and Google's `androidpublisher.purchases.products.get`, returns `{valid: true|false}`.
   - **Vercel Function / Lambda** (~80 lines, same logic).
2. **Set the env var:**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_IAP_VERIFY_URL --value "https://your-verify-worker.example.com/verify"
   ```
3. **Verify it works in TestFlight** — buy any IAP in sandbox, confirm the entitlement applies.
4. **Apple's `/verifyReceipt` is deprecated for new code.** If building fresh, use the App Store Server API: https://developer.apple.com/documentation/appstoreserverapi
5. **Google Play** uses Google Cloud OAuth — service-account JSON, then POST to the androidpublisher API. See https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get

**Until this is done:** IAP purchases will fail in production. To temporarily revert, set `EXPO_PUBLIC_ENABLE_IAP=false` in the EAS production env (disables the whole flow). Or change the runtime guard in [IAPService.ts:268-281](services/IAPService.ts#L268) back to `return true` — but that's the revenue-leak path.

---

## SB-5. Replace external avatar URLs (`ui-avatars.com`, `pravatar.cc`, etc.)

**Why:** Apple review guidelines 5.1.1 / 5.2.3 disfavor fetching user-resembling content from third-party services. The service going down also breaks the UI.

**Files known to use external avatar URLs** (from R7 audit):
- [lib/social/randomProfiles.ts:124](lib/social/randomProfiles.ts#L124) — `ui-avatars.com`
- Possibly others — grep for `ui-avatars.com`, `pravatar.cc`, `picsum.photos`, `i.pravatar`, `randomuser.me`.

**Options:**

1. **Bundle 20-30 stock avatars** as PNGs in `assets/images/avatars/` and pick deterministically by hash of the NPC name. Simplest, smallest visual change.
2. **Generate SVG initials avatars** on-device using a small util (`initials("Alex") + colorFromHash`). Zero asset weight; less visual variety.
3. **Use a local avatar library** like `react-native-avatar-generator` or write a 30-line `<InitialsAvatar />` component.

Recommendation: option 2 (initials avatars) for the simplest no-asset path. Implement as `components/ui/InitialsAvatar.tsx`, then replace the URL builder in `randomProfiles.ts` to populate `profilePhoto: undefined` so the existing `ImageWithFallback` placeholder path kicks in.

---

## Phase 3 sub-app completeness — design decisions

For each app, decide: **implement** or **hide until ready**.

### PoliticalApp (currently 75%)
[components/computer/PoliticalApp.tsx:184-194](components/computer/PoliticalApp.tsx#L184) — the "Policy" tab renders the array but has no enact-policy action.

- **Implement option:** ~2 days work. New modal for enacting a policy + a `raisePolicyInfluence` action in `contexts/game/actions/PoliticsActions.ts`. Wire to the existing `politics.policyInfluence` field.
- **Hide option:** 10 minutes. Remove the tab from the tab bar; keep the data structure for future use.

### SparkApp (currently 90%)
[components/mobile/Spark/SparkApp.tsx:69-74](components/mobile/Spark/SparkApp.tsx#L69) — `onOpenPartnerProfile` returns to matches tab instead of opening a profile view.

- **Implement option:** ~1 day. Add `PartnerProfileScreen.tsx` with the match's bio, photos, last messages, "unmatch" / "block" actions.
- **Hide option:** 5 minutes. Disable the tap-to-open behavior or replace with a `Alert.alert('Profile coming soon')`.

### EducationApp (currently 95%)
[components/mobile/EducationApp.tsx:99-103](components/mobile/EducationApp.tsx#L99) — `pendingCampusEventEducationId` useEffect does nothing.

- **Clean up option (recommended):** 5 minutes. Either clear the flag properly (one-line `setGameState(s => ({...s, pendingCampusEventEducationId: undefined}))`) or remove the dead effect entirely.

---

## Order of operations

When you have time:
1. **First**: SB-2 (IAP verify URL) — without this, no IAPs work in prod after R7's changes ship.
2. **Then**: SB-1 path A (key rotation). Path B if you want history-scrub.
3. **Then**: SB-5 avatars + Phase 3 decisions.
