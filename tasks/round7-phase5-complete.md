# R7 Phase 5 — log sanitizer + verification (complete)

> Audit verification pass with a defense-in-depth code fix. Three of four
> Phase 5 items REJECTED as already done or premise-wrong. The fourth
> (sensitive-data leak audit) ratified by adding a sanitizer to
> RemoteLoggingService.

---

## Item-by-item results

### 5.1 — Verify `onConflictDetected` is wired to UI → REJECTED

**Audit claim**: `setConflictCallback` is never called by UI code; need to build a conflict modal.

**Verification**: `setConflictCallback` IS wired at [contexts/game/GameActionsContext.tsx:2355](contexts/game/GameActionsContext.tsx#L2355). It registers a native `Alert.alert(...)` handler with "Keep This Device" / "Keep Cloud Version" buttons. The "Keep Cloud" path validates + repairs remote state before applying it.

Per the audit's own instructions ("verify first; if wired, reject"), this item is **rejected** as a false positive from the original agent claim.

### 5.2 — Add AbortController timeout to `RemoteLoggingService.sync()` → ALREADY DONE

**Audit claim**: `fetch` has no timeout, could hang indefinitely.

**Verification**: AbortController + 10s `abortController.abort()` + 15s safety `isSyncing` reset already implemented at [services/RemoteLoggingService.ts:264-268](services/RemoteLoggingService.ts#L264). Includes a "R7 Phase 5" comment explaining the dual-timeout rationale.

**Already shipped in a prior Phase 5 partial.** No action needed.

### 5.3 — Replace fixed 500ms backoff with exponential in `lib/progress/cloud.ts` → REJECTED

**Audit claim**: `{ maxRetries: 2, initialDelayMs: 500 }` is a flat 500ms backoff.

**Verification**: `withErrorRecovery` calls `retryWithCircuitBreaker` → `retryWithBackoff`, which at [utils/errorRecovery.ts:121](utils/errorRecovery.ts#L121) does:

```ts
delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelayMs);
```

`DEFAULT_RETRY_CONFIG.backoffMultiplier = 2`. So cloud.ts gets exponential 500ms → 1000ms → cap. The audit misread `initialDelayMs` as a fixed value when it's actually the starting value of an exponential ramp.

**Rejected — backoff is already exponential.**

### 5.4 — Audit logger calls for sensitive-data leaks → DONE (defense-in-depth)

**Audit findings**:

| Category | Result |
|---|---|
| HMAC keys | Never logged. Only `{ error }` objects passed (caught exceptions). |
| IAP receipts | Never logged. Only `receiptLength`, `productId`, HTTP `status`. |
| User identifiers (email, deviceId, cloudUserId, advertisingId) | Never logged. |
| Save signatures | Never logged. |
| Auth tokens (access/refresh) | Never logged. |
| Game money / gems amounts | Sometimes logged in template literals. **NOT sensitive PII** — these are gameplay state, not real money. |

**Additional finding**: `remoteLogger.configure(url)` is **never called** in production code (only a commented-out example in [utils/logger.ts:47](utils/logger.ts#L47)). So `remoteUrl` is null and `sync()` always early-returns. Logs never leave the device today.

**Defense-in-depth fix landed**:

Added `sanitizeLogContext()` to [services/RemoteLoggingService.ts](services/RemoteLoggingService.ts) — a recursive (depth-capped at 4) sanitizer that replaces values for known-sensitive context keys with `'[REDACTED]'` BEFORE the log entry is queued or persisted. Sensitive keys covered:

```
hmac, signature, saveKey, saveHmacKey, hmacKey,
receipt, receiptData, purchaseToken, verificationData,
apiKey, secret, token, accessToken, refreshToken,
password, credential,
email, phoneNumber, address,
cloudUserId, deviceId, installationId, advertisingId
```

Applied inside `log()` to both `context` and `error` fields. The wrap is depth-limited at 4 to avoid infinite recursion on cyclic structures.

**Why ship the sanitizer despite no current leak**:
1. Defense-in-depth: protects against future regressions when someone adds a sensitive log without thinking.
2. AsyncStorage exfiltration: today's logs DO persist to AsyncStorage; a rooted/jailbroken device or device-backup leak would expose them.
3. In-app log viewer: end-users sharing screenshots for support get pre-sanitized output.
4. Zero callsite churn: one helper protects every existing and future callsite.

**Tests**: 11 new unit tests in [__tests__/utils/remoteLoggingSanitizer.test.ts](__tests__/utils/remoteLoggingSanitizer.test.ts) cover:
- Top-level + nested + array-of-objects redaction.
- All declared sensitive keys.
- Depth cap on deep structures.
- Non-sensitive keys preserved.
- No input mutation.
- null/undefined/primitive pass-through.
- The full key list assertion (regression guard if the SET shrinks).

The test file uses `jest.unmock` + `jest.requireActual` to bypass the global mock of `RemoteLoggingService` that's set in `jest.setup.js`.

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json    → exit 0, 0 errors
npx jest __tests__/utils __tests__/refactor __tests__/startup __tests__/integration
   → 626 passed across 21 suites, 308 snapshots, zero drift
```

---

## Phase 5 status

| Item | Status |
|---|---|
| 5.1 — CloudSync onConflictDetected | REJECTED (already wired) |
| 5.2 — RemoteLogger AbortController | ALREADY DONE |
| 5.3 — Exponential backoff | REJECTED (already exponential) |
| 5.4 — Sensitive-data scrub | DONE (defense-in-depth sanitizer) |

**Phase 5 complete.** Three items confirmed not needed; one ratified
with a guardrail.

---

## What's left in the master plan

- **SB-1 HMAC key rotation** — user-action (Path A: rotate only, or Path B: rotate + git history scrub). Deferred to user.
- **SB-2 IAP verify URL deployment** — user infra. Verifies receipts server-side. Currently fail-closed in production until URL is configured.
- **SB-5 SVG-initials avatar replacement** — design + code work.
- **Phase 3 sub-app gaps** — decisions on PoliticalApp / SparkApp / EducationApp (implement vs hide).
- **Phase 6 polish + bundle size** — asset compression, dead code, lowest priority.

The remaining queue is mostly user-decisions or user-infra. Recommend
pausing extraction work and turning to one of those, or to a TODO
sweep in `tasks/` to consolidate the inventory of open items.
