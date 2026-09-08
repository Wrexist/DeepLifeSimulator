# Program 18 continuation: recovery and continuity

Date: September 8, 2026. Starting commit: `71766bc94829efa6863a8aec6b86962441090752`.
PR #197 remained open when work resumed. Its previous GitHub EAS Update check
completed successfully. Main remained `1824b9c`.

The owner authorized continuing the remaining work. This increment implements
purchase recovery within an existing installation, recurring journal events,
and live-event continuity across generations. Native purchase acceptance and
the broader feature roadmap are distinct remaining work.

## Purchase recovery contract

A pending transaction ID is insufficient after the store SDK has finished a
purchase. Before opening a non-subscription purchase, the app must persist a
record of the product, original slot/life, RevenueCat customer, and existing
receipts. Only a verified matching transaction can deliver its quantities.

The installed SDK exposes `CustomerInfo.nonSubscriptionTransactions`, real
transaction identifiers, product identifiers and purchase dates. RevenueCat's
[non-subscription documentation](https://www.revenuecat.com/docs/platform-resources/non-subscriptions)
confirms that the app remains responsible for tracking whether consumables
were delivered. Its [restore documentation](https://www.revenuecat.com/docs/getting-started/restoring-purchases)
explains why recovery after reinstall is a separate identity problem.

Acceptance cases for this increment:

- A rejected journal write prevents the store purchase from starting.
- A real transaction is persisted before its grant is applied.
- An interrupted callback can recover only the eligible new transaction for
  the saved intent, never arbitrary historical consumables.
- An unavailable receipt, changed customer or ambiguous result stays pending.
- Returning to the original life or explicitly using Restore can retry a
  pending delivery without charging again.
- State quantity markers prevent a second grant after autosave or a failure
  between successful delivery and journal cleanup.
- Verified completed transactions can clear a leftover journal after a slot
  switch or generation change, without delivering another benefit.
- A different slot or replacement life cannot receive the old purchase.
- Known pre-charge failure and confirmed cancellation are distinguished from
  an unknown outcome after opening the store flow.
- Overlapping purchase taps are refused while a purchase is in flight. They
  cannot queue a second store sheet behind the first one. A regression test
  reproduced two SDK purchase calls before this guard was added.

A stable slot getter is added to the existing selector store. It observes an
explicit slot selection immediately, including before React commits a batched
switch. This lets delayed purchase work check slot identity without making the
handler subscribe to every state update. GameState snapshots still publish at
commit, preserving the existing selector consistency rule.

### Boundaries that must stay explicit

This is recovery for an intent created by this version in the same installation.
It cannot infer lost intents from older versions, revive a deleted character,
or establish fulfillment on another installation. Reinstallation and account
transfer require a recoverable identity and a server-side redemption policy.
An ambiguous transaction is retained instead of guessed. Support reconciliation
is still needed if the receipt cannot establish what happened, including a kill
between persisting the intent and invoking the store sheet. Clock discrepancies
greater than five minutes also prevent a receipt snapshot being treated as fresh.

Subscription access remains on the existing entitlement/Restore path because
non-subscription receipt history is not a subscription-renewal ledger. No native
SDK behavior is established by Jest mocks. TestFlight verification remains
required before this payment change is merged or released.

Subscription-specific local bonuses after a lost purchase callback are not
covered by this new non-subscription recovery path. Historical live-event
claims missing from older transitioned saves also cannot be reconstructed.

## Journal identity

The old writer assumed every notification ID encoded a unique occurrence. Real
producers reuse IDs for births, police encounters and education completions.
Consequently an older journal entry suppressed a later event while retained in
the 50-entry journal.

Entries now use a deterministic tuple of week, notification ID, title and
message. The same event replay produces the same ID. Different weeks and
distinct same-week messages survive. Existing raw-ID entries remain recognized
when their week and text match, so loading an older journal does not duplicate
its last event. The journal remains bounded at 50 entries.

Two events with exactly the same ID, week, title and message are still
indistinguishable. A future producer needing to distinguish those must supply
an occurrence or entity-specific ID. No random ID is introduced into the
weekly updater.

## Live-event rewards across lives

Prestige reset, prestige as an heir, and death-to-heir all use the shared dynasty
transition. That transition now copies claimed event instances and the real-time
reward budget to the new life. It also retains seen-instance badges and resets
life-relative notification cooldown weeks.

This prevents a new life from reopening the same reward or refunding the budget
spent by the previous life. Tests apply real claims, perform each real
transition, serialize/reload and retry. They also cover a rewound clock, budget
expiry, an affordable new claim, and immutable outgoing state.

### Additional objective defect

The live-event `achievements_unlocked` objective read the deprecated
`achievements[].unlocked` field. Changing it to `completed` would also be wrong
for normal gameplay. The actual achievement system uses progress conditions
and claimed IDs.

The objective now calls the existing `getSatisfiedAchievementIds` reader,
matching the achievement screen's earned state. Its test earns a real first-gig
achievement, then claims it and proves it is counted exactly once.

## Validation

The full configured run passed **769 suites, 9,707 tests and 308 snapshots**,
exit 0. Existing skips remain 17 suites/32 tests. Its known
`socialBoundaries.test.ts` late-import/worker teardown warning remains documented
in the previous report, not hidden with `--forceExit`.

After that run had already executed the recovery tests, the overlapping-tap
regression exposed two SDK calls. The final guard was verified by rerunning the
entire monetization directory: **29 suites, 245 tests passed, exit 0**. That
focused rerun initially reported a pending-handle notice, then exited naturally.

- Stable slot getter and interruption fixtures: 2 suites, 15 tests passed.
- Journal, prestige and live-ops: 33 suites, 473 tests passed.
- Purchase recovery, actual handler boundaries and SDK receipt wrapper:
  3 suites, 39 tests passed, exit 0.
- Static weekly audit: exit 0, no blockers and the same three maintenance
  warning groups as the prior slice.
- Final source and test-tree type checks after the tap guard: zero errors, exit 0.
- iOS JavaScript export: exit 0, 3,999 modules, 13.6 MB Hermes bundle. This is
  a bundle export, not a native build or physical-device test.
- `npm run preflight`: exit 0, including source/test type gates, lint,
  UI/content ratchets and combined live-event runway. Lint measured zero errors
  and 715 warnings against the then-loaded 716 ceiling. The ceiling was lowered
  to 715 to bank the removed unused import. The final tap guard also passes
  scoped lint with only the two pre-existing IAPService warnings.
- Post-guard iOS JavaScript export: exit 0. Lowered-ceiling unit checks: all six
  pass, exit 0. `git diff --check` passes.

No save-schema bump is required for these changes because they reuse existing
GameState fields. The recovery journal is separate persistence with its own
format version. App version must be bumped before the next native release build.
