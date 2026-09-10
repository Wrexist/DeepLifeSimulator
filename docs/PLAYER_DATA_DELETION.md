# Player data deletion — proposed operating procedure

Prepared 10 September 2026 for DeepLife (project name Molin Inc.). **Not yet confirmed as current
practice.** Do not publish this as an existing promise or execute deletions from
an audit request. The owner must establish retention decisions
and actual access, then validate the process with a designated test account.

Confirmed by the owner: they personally monitor and manage
`DeepLifeSimulator@gmail.com`; no player has requested deletion so far. They do
not know of an existing procedure. They operate in Sweden and confirmed that
Molin Inc. is not a registered legal name. They confirmed **Isac Molin** as the
individual legal operator and person responsible for privacy requests. Use
Molin Inc. only as the project name, not an incorporated company.

1. Receive the request through the published support mailbox. Record a private
   case reference and requested scope. Keep player details out of Git, build logs
   and public issues. Assign a responsible operator and track completion.
2. Establish which records belong to the requester using the minimum sufficient
   evidence. DeepLife uses anonymous RevenueCat identifiers; a character name or
   an unverified email alone does not prove ownership. Do not request passwords,
   payment-card details or full identity documents by default. A safe way for the
   player to provide the app's relevant provider identifiers still needs to be
   verified in the signed app.
3. Explain the scope before execution: local saves, operator-held support data
   and each provider's records are different. Provider deletion is not a refund,
   subscription cancellation, or deletion of Apple's own transaction records.
   Identify any actual retention exception and its owner; do not invent one.
4. Find the matching customer in the DeepLife RevenueCat project, inspect aliases
   and purchase links, and use the provider's customer-deletion operation. Record
   the result privately. An asynchronous accepted request is pending until its
   completion is verified. Do not delete another installation merely because a
   display name matches. RevenueCat documents customer deletion in its
   [customer profile guide](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile)
   and [API reference](https://www.revenuecat.com/docs/api-v2/customer).
5. For Firebase/GA4 records that can be attributed to the requester, use the
   correct property's user-deletion procedure and verify its status. Google
   distinguishes [user deletion](https://support.google.com/analytics/answer/9283607?hl=en)
   from [event-parameter data-deletion requests](https://support.google.com/analytics/answer/9940393?hl=en).
   Do not select a broad property/date-range operation for a single player.
   For any future automation, use the current Analytics Admin API
   `properties:submitUserDeletion`, not legacy v3 `userDeletionRequests:upsert`.
   Google documents that v3 has been sunset and the replacement uses the
   `analytics.edit` scope in its
   [migration guide](https://developers.google.com/analytics/devguides/config/userdeletion/migration).
6. Assess any configured telemetry endpoint, support correspondence, exports
   and processors. Record whether records existed, the verified deletion action,
   any provider-controlled limitation and outstanding follow-up. AdMob/Expo
   request handling and the actual retention settings still need confirmation;
   absence of a visible customer button is not proof of deletion.
7. Provide the tested local-save deletion steps separately. Verify interruption,
   backup and relaunch behavior on the signed candidate before promising that
   every local copy is removed. Continued use or purchase restoration may create
   new provider records; explain the observed behavior accurately.
8. Confirm completion to the requester only for actions actually completed.
   Distinguish pending provider work and records outside Molin Inc.'s control.
   Retain a minimal private completion record under an owner-approved schedule.

## Facts still required before adoption

- Backup/escalation coverage for the owner-monitored mailbox.
- Actual provider retention settings and any applicable retention exceptions.
- Verified Analytics settings: property 545257707 retains event data for two
  months and user data for fourteen months, with reset on new user activity on.
  This does not define retention for all aggregated data or other providers.
- Reliable player-to-provider identity matching and available deletion access.
- Test-account execution evidence, failure/retry handling and completion checks.
- Approved response and completion timing; none is asserted in this draft.

## Timing and reply templates

For requests covered by GDPR, IMY explains that the normal response deadline is
one month; a justified extension requires notice within that initial month.
This is an applicable-law requirement to assess, not a measured Molin Inc.
turnaround time. Track the receipt date immediately and do not silently reset
the deadline while researching a request. See
[IMY's deadline guidance](https://www.imy.se/privatperson/dataskydd/dina-rattigheter/galler-for-alla-rattigheterna/tidsfrister/).

Suggested acknowledgement, to adapt and send manually:

> We received your DeepLife data-deletion request on [date], reference [case].
> We are checking which records we can identify and delete. Please do not send
> passwords or payment-card details. [If needed: explain the minimum specific
> information required to match the player's records.] We will update you by
> [applicable response date].

Suggested completion reply, only after verification:

> For request [case], we completed [specific actions and providers] on [date].
> [List anything still pending, any justified retention, and records outside
> our control.] This does not cancel an App Store subscription or delete Apple's
> transaction records. [Give tested local-save steps if requested.] Contact us
> with the case reference if you have questions.

## App implementation gap discovered

The current Settings support report does not expose the RevenueCat app-user ID
or Firebase Analytics app-instance ID. RevenueCat's recovery snapshot contains
an original customer ID internally, but it is not a player privacy-request flow.
The installed RevenueCat SDK offers `getAppUserID()`. A future minimal request
screen should read only already-configured identifiers, let the player review
the message, and report unavailable identifiers honestly. It must not enable
analytics, initialize unused providers, emit an analytics event, attach a full
save/error log or send the request automatically. An identifier is a lookup
aid; sensitive deletion still requires appropriate ownership checks.

Do not reset identifiers before recording the identifiers needed for server-side
deletion. Firebase distinguishes Analytics identifiers from installation IDs;
deleting a Firebase app/project or only resetting local analytics data is not
a substitute for deleting the identified player's server records. See
[Firebase identifier guidance](https://firebase.google.com/support/privacy/manage-iids)
and [Analytics privacy controls](https://support.google.com/analytics/answer/9019185?hl=en).

The release record is [R11 privacy evidence](../tasks/release/evidence/R11-privacy.md).
