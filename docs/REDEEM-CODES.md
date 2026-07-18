# Redeem Codes (Settings → "Redeem Code")

An owner-issued promo-code system. You hand out codes shaped `DEEP-XXXX-XXXX-XXXX`;
a player types one into **Settings → Redeem Code** and receives a reward (a gems
pack's contents, cash, a perk, Remove Ads, etc.). Each code is redeemable **once
per device**.

The whole engine is `utils/redeemCodes.ts`. The Settings entry point is
`components/RedeemCodeModal.tsx`, nested inside `components/SettingsModal.tsx`.

---

## Security model (read this first)

**The app ships ONLY salted SHA-256 hashes of the codes. The plaintext codes are
the secret and live exclusively with you (the owner). They must NEVER be committed
to this repository — not in code, tests, docs, or comments.**

- Each code's canonical plaintext is `DEEP-` + 12 characters from the alphabet
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/1/I/O`), shown grouped as
  `DEEP-XXXX-XXXX-XXXX`.
- The bundle contains a **salt** and a **hash table** (`REDEEM_SALT` +
  `REDEEM_HASHES` in `utils/redeemCodes.ts`). The table maps
  `sha256Hex(normalizedCode + REDEEM_SALT)` → reward.
- The **salt is not a secret** — it ships in the app bundle and only exists to
  make the hashes specific to this game (so a generic rainbow table doesn't apply).
  What protects the codes is that the 12-character body has enormous entropy
  (32^12 ≈ 1.15 × 10^18 possibilities); guessing a valid code is infeasible, and
  the in-app attempt throttle (below) makes online guessing pointless.
- Because only hashes ship, **nobody can read the codes out of the app** — not
  from the bundle, a decompile, or the source. You keep the plaintext list
  offline (a password manager / private sheet).

If you ever paste a real code into a file in this repo, treat it as burned:
rotate the whole batch (see below).

---

## How a redemption works

1. **Normalize** the typed input: `input.toUpperCase().replace(/[^A-Z2-9]/g, '')`
   — uppercase first, then strip everything that isn't `A–Z` or `2–9`. A valid
   code normalizes to 16 characters beginning with `DEEP` (the `DEEP` prefix is
   part of the hash input).
2. **Shape-check**: only strings matching `^DEEP[A-Z2-9]{12}$` are hashed.
3. **Hash**: `sha256Hex(normalized + REDEEM_SALT)` (lowercase hex, vendored
   pure-TypeScript SHA-256 — no native crypto dependency).
4. **Look up** the hash in `REDEEM_HASHES`. A hit yields the reward
   (`{ p: productId }` → that IAP product's benefits, granted through the exact
   same code path as a real purchase; or `{ m: amount }` → that much cash).
5. **Grant + record** in one atomic state update, then persist.

### Reward shapes

- `{ p: 'deeplife_gems_1000' }` — grants that IAP product's full benefits via the
  shared `applyProductBenefitsToState` helper, so a code grants **exactly** what
  buying the product grants (gems, youth pills, perks, Remove Ads, bundles, …).
  Permanent perks additionally run `iapService.persistPermanentPerks` — the same
  cross-slot persistence a real purchase performs — so a redeemed work boost /
  mindset / fast learner / good credit / unlock-all survives new lives and other
  save slots exactly like a bought one.
- `{ m: 100000 }` — grants that much cash via the canonical money mutator
  (`applyMoneyDelta`), so ledgers/daily-summary stay consistent.

---

## Exactly-once, per-device grant protocol

Mirrors the Discord-reward protocol in `utils/discordRewardClaim.ts`. There are
two halves that are always written together so a force-kill can neither drop a
reward nor pay it twice:

- **Durable ledger** — AsyncStorage key `redeemed_codes_v1`, a JSON value:
  `{ finalized: string[], pending: { hash, reward } | null }`. `finalized` is the
  list of hashes fully granted on this device; `pending` is a claim frozen at
  "begin" time. A malformed / unparseable value reads as "everything already
  redeemed" (withhold), never as an empty ledger — the safe no-double-grant
  direction.
- **In-state flag** — `gameState.redeemedCodeHashes: string[]`, set in the **same**
  `setGameState` update that grants the reward, so the reward and the flag are
  persisted together.

Claim flow on the success path (order matters):

1. `beginRedeemClaim(hash, reward)` — write the pending marker **before** granting.
2. one `setGameState(prev => applyRedeemReward(prev, hash, reward))` — grant + flag.
3. `persistRedeemedPerkEntitlements(reward)` — the same cross-slot permanent-perk
   persistence a real purchase runs (see "Reward shapes" above); idempotent.
4. a macrotask yield (`await new Promise(r => setTimeout(r, 0))`) — `saveGame`
   reads a post-commit ref synced in a passive effect, so it lags the commit by
   one cycle.
5. `const saved = await saveGame(true)` — **force-save** (the same durable path
   real IAP purchases use). A plain `saveGame()` only queues the write and
   swallows failures, so it cannot prove the post-grant state reached disk;
   `saveGame` returns `true` only when the write completed and verified.
6. `finalizeRedeemClaim(hash)` — **only when `saved === true`**. On `false` (or a
   throw) the pending marker is left in place, the player keeps the in-memory
   reward, and the reconciler completes the claim next launch.

The always-mounted **home reconciler** (`reconcileRedeemClaim`, invoked from the
same launch effect as the Discord reconciler in `app/(tabs)/home.tsx`) completes
any interrupted claim on the next launch:

- pending + hash already in `redeemedCodeHashes` → the reward is already on disk →
  **finalize only** (no duplicate grant; entitlement persistence re-run, it's
  idempotent).
- pending + hash not yet in state → **grant, save (durable, gated on `true`),
  finalize**.
- no pending / malformed pending → no-op.
- **The stored marker's `reward` copy is never trusted**: the reward is re-derived
  from `REDEEM_HASHES[pending.hash]`, so hand-editing the AsyncStorage ledger
  cannot mint arbitrary grants. A pending hash that isn't in the shipped table
  (tampered storage, or a table rotated by an update mid-claim) is discarded
  without granting.

### Attempt throttle

`utils/redeemCodes.ts` keeps an in-memory rolling window: **max 5 lookup attempts
per 60 seconds** (`canAttemptRedeem` / `recordRedeemAttempt`). This is a
UX/anti-hammer guard only (it resets when the app restarts); the real protection
against guessing is the code entropy above.

---

## Rotating / adding a batch of codes

Codes are **regenerated wholesale**: you produce a fresh salt + a fresh hash table
and replace `REDEEM_SALT` and `REDEEM_HASHES` in `utils/redeemCodes.ts` in one go.
Do this offline; keep the emitted plaintext list private.

Write a small Node script (kept OUT of the repo) that follows the recipe exactly —
it must match the app byte-for-byte:

1. Pick a fresh random salt (e.g. 16 random bytes as lowercase hex).
2. For each reward you want to hand out, generate one or more codes:
   - body = 12 characters drawn uniformly from
     `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
   - plaintext = `DEEP-` + body (display can group it `DEEP-XXXX-XXXX-XXXX`).
   - normalized = `('DEEP' + body)` — i.e. `plaintext.toUpperCase()` with
     non-`A–Z2–9` stripped (16 chars).
   - hash = `sha256(normalized + salt)` as lowercase hex (Node's
     `crypto.createHash('sha256')` — the vendored `sha256Hex` matches it exactly;
     the test suite cross-checks this).
3. Emit two artifacts:
   - **private**, kept offline: the mapping `plaintext → reward` (your master list).
   - **committed**: the salt line and the table entries
     (`'<hash>': { p:'<productId>' },` or `'<hash>': { m:<amount> },`), which you
     paste into `utils/redeemCodes.ts`. **Only hashes go into the repo.**
4. Valid `productId`s are the values in `IAP_PRODUCTS` (`utils/iapConfig.ts`);
   `amount` is a positive integer of in-game cash.

After pasting, run the gate: `npx tsc --noEmit -p tsconfig.typecheck.json`,
`npx eslint utils/redeemCodes.ts`, and
`npx jest __tests__/utils/redeemCodes.test.ts` (the shape-audit test verifies the
table stays well-formed). Never paste a real code anywhere in the repo; if you do,
rotate the batch.

---

## Known limitations

- **Per-device, not global.** "Once per device" is enforced by the local
  AsyncStorage ledger. The same code can be redeemed once on each device a player
  owns, and the ledger **resets if the app is uninstalled/reinstalled** (or app
  data is cleared). Truly global single-use (one redemption per code across all
  users/devices) would require a server that atomically marks a code spent — the
  same verify-server that `EXPO_PUBLIC_IAP_VERIFY_URL` points at for IAPs. This
  system is intentionally offline/client-only.
- **No expiry / usage caps.** A code is valid as long as its hash is in the table.
  To retire codes, ship a build with a regenerated table that omits them.
- **Cross-platform product ids.** The table is generated with the canonical
  (iOS/default) product ids. Every product uses the same id on both stores
  **except** the "Mindset" perk (`deeplife_mindset_perk` on iOS vs
  `deeplife_mindset` on Android). The engine resolves that rename at grant time
  (`resolveRedeemProductId` in `utils/redeemCodes.ts` maps the table id to the
  platform's catalog id), so mindset codes grant correctly on both platforms.
  When generating future batches, keep using the canonical iOS ids and extend the
  alias map if another per-platform rename is ever introduced.
- **Anyone with a code can redeem it once per device.** Codes are bearer tokens —
  treat a leaked code like a leaked coupon and rotate the batch if needed.
