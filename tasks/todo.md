# Plan — cloud save: version the backend, add erasure, durable guest identity

Owner decisions taken 2026-08-20:

- **Identity model: guest + transfer code.** Anonymous, account-free, but the id
  survives reinstall AND a player can move a save to a new phone with a code.
  No Sign in with Apple / Google — which keeps us clear of App Store guideline
  4.8 (offering Google obliges offering Apple) and 5.1.1(v) (accounts oblige
  in-app account deletion).
- **Next Apple production build ships with cloud save OFF.** Already true —
  `eas.json`'s `production` profile sets none of the three required vars. No
  work, and nothing untested reaches users.

Sequencing note: A is a prerequisite for B (can't diff a change onto source we
don't have). C2 depends on C1. C is native and cannot ship over OTA.

---

## A. Version the deployed edge functions  ✅ no runtime change

- [x] A1. Capture deployed `save` (v2) and `leaderboard` (v2) verbatim into
      `server/cloud-save/save/index.ts` and `server/cloud-save/leaderboard/index.ts`.
      **Byte-for-byte as deployed** — this step captures, it does not refactor.
- [x] A2. Reconstruct `server/cloud-save/schema.sql` from live introspection
      (`cloud_saves`, `leaderboard_entries`, `backend_config` + PKs, CHECKs, RLS).
      Introspected, not guessed.
- [x] A3. `server/cloud-save/README.md` pointing at `docs/CLOUD-SAVE-BACKEND.md`
      as the contract, and recording the redeploy-from-repo procedure.
- [x] A4. Note in the README that both functions bumped v1→v2 at
      2026-08-20T16:48:06Z with identical timestamps (a platform rebundle, not
      an edit) — and that from this commit on, any change is diffable.

## B. Erasure + retention  ⚠️ changes live function behaviour

- [x] B1. `DELETE /save?userId=&slotId=` — erase one slot.
- [x] B2. `DELETE /save?userId=` (no slot) — erase **every** slot for that user.
      This is the GDPR article 17 path.
- [x] B3. Both return `200 {success, deleted:<n>}`; `400` malformed id;
      `401` bad token. Deleting nothing is `200 {deleted:0}`, not an error —
      erasure is idempotent.
- [ ] B4. Client: a "Delete my cloud backup" action in
      `components/settings/CloudBackupRow.tsx`, behind a confirm. A server
      endpoint no player can reach is not a right.
- [x] B5. Retention prune for abandoned rows — **needs the window decided**
      (see Open questions).
- [ ] B6. Update `docs/CLOUD-SAVE-BACKEND.md`: move item 3 of *Future work*
      into the contract, document the DELETE routes.

## C. Durable guest identity + transfer code  ⚠️ native, needs a new build

### C1. Move `cloud_user_id` to expo-secure-store
- [ ] C1a. Install `expo-secure-store`; if it needs a config-plugin entry, add it
      to `app.config.js` in the SAME change (**Hard Rule #4** — never let plugin
      and package.json drift).
- [ ] C1b. `resolveUserId`: read secure-store → else read the legacy
      AsyncStorage `cloud_user_id` and promote it into secure-store → else mint.
      **Never mint when a legacy id exists**, or every existing preview install
      orphans its backup.
- [ ] C1c. Preserve the existing guarantee that a device which cannot PERSIST a
      freshly minted id does not upload (there is a test pinning this;
      `cloudSyncInert.test.ts`). Secure-store can throw on some devices — fall
      back to AsyncStorage rather than disabling backup outright.
- [ ] C1d. Tests: legacy-id promotion, mint-and-persist, persist-failure,
      secure-store-unavailable fallback.

### C2. Transfer code (cross-device without accounts)
- [x] C2a. Table `save_transfer_codes(code pk, user_id, created_at, expires_at,
      claimed_at, claimed_by)`, RLS on, no policies (matches house posture).
- [x] C2b. `POST /save/transfer` → mint a single-use, short-TTL code for the
      caller's userId.
- [x] C2c. `POST /save/claim` {code, newUserId} → **copy** every `cloud_saves`
      row from the source user to the claiming device's own id.
      **Copy, not repoint**: repointing would leave two devices writing to one
      id, clobbering each other. Copying leaves the old phone working and the
      two diverging independently.
- [x] C2d. The claim must be **atomic** — one `update … where claimed_at is null
      returning …` (or a `security definer` function), so two devices racing the
      same code cannot both win. This is CLAUDE.md §4.4's gate→grant rule in
      server form; the same double-tap bug class, over HTTP.
- [x] C2e. Rate-limit claim attempts. A code is a bearer credential: anyone
      holding it gets the save.
- [ ] C2f. UI: reveal-code on the old device, enter-code on the new one.
- [ ] C2g. Document the whole flow in `docs/CLOUD-SAVE-BACKEND.md`.

---

## Decisions taken (2026-08-20) — questions above are CLOSED

1. **Retention: 18 months** from `received_at`. Goes in the privacy policy.
2. **Deploy: I deploy, after showing the diff.** Applies to B and C2, which
   change the live `save` function and the live schema.
3. **Sequencing: build A, B, C1 and C2 in one pass.** Accepted risk: C2 sits on
   C1's identity layer, so a hardware surprise in C1 reworks part of C2.

## Deployed and verified end-to-end (2026-08-20)

`save` edge function is live at **v3**, `verify_jwt` still false. Exercised
through the real HTTPS endpoint (via the database's `http` extension, since the
sandbox cannot reach `*.supabase.co`):

| Case | Result |
|---|---|
| Unauthenticated GET | `401` |
| POST upload x2, GET readback | `200`, state round-trips intact |
| Mint code | `200`, 10 chars, alphabet as specified |
| Claim | `{success:true, slots:2}`, copies verified row by row |
| **Same code, second device** | `Code is invalid, expired or already used` |
| DELETE one slot | `{deleted:1}` |
| DELETE same slot again | `{deleted:0, success:true}` — idempotent |
| DELETE bad slotId | `400` |
| DELETE whole device | `{deleted:2, leaderboardDeleted:1}` |
| Advisors after | 16 INFO (the 2 new tables), no warnings, no errors |

All test rows removed; `http` extension dropped. Counts back to 0/0/0/0.

Two results needed a second pass to read correctly, both MVCC rather than bugs:
a subquery in the same statement as a volatile function cannot see that
function's writes, and the edge function runs on a different connection so it
cannot see an uncommitted row. Re-tested against committed data in both cases.

## Still open

- [ ] B4/C2f. The UI: delete button, reveal-code, enter-code. **No player can
      reach any of this yet** — the endpoints exist, the screens do not.
- [ ] B6/C2g. Update `docs/CLOUD-SAVE-BACKEND.md` with the four new routes.
- [ ] C1. expo-secure-store. **Native dependency — no OTA, needs a new build.**

## Constraints carried into every step

- `node_modules` is ABSENT in this container — `npm install` before any
  test/type-check claim, or a cold-container failure reads as a real one.
- Never mark a step done without showing the output.
- No lowering the coverage or type-check ratchets.
- Branch `claude/backend-supabase-issue-9pdttv`; never push to `main`.
