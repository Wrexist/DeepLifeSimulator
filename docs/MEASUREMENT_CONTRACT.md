# Measurement contract after the September follow-up

## Separate populations and meanings

App Store Connect owns iOS downloads and proceeds. RevenueCat production charts
own subscription trial starts, conversions, expirations and transaction revenue.
Firebase measures the consenting, instrumented subset of gameplay. Do not divide
one provider's users by another provider's users and call it conversion or coverage.
Use completed UTC days and matched periods; mark partial days and immature trials.

`purchase_started` / `purchase_succeeded` describe the client purchase flow.
`catalog_price` is an optional numeric store offer price, never charged revenue.
`displayPrice` is display-only; never parse it as money. A successful free trial
must not become a list-price revenue event. Do not duplicate automatic
`in_app_purchase` with a manual purchase event. Reconcile actual transaction
revenue in RevenueCat/App Store Connect; Firebase revenue remains unverified until
the native SDK's coverage and deduplication are demonstrated on the signed build.

## Gameplay

- Routes use native `logScreenView`, with bounded `screen_name` and
  `screen_class=DeepLife_<route>`. Unknown routes use `other`.
- Automatic native class-only screen reporting is disabled in firebase.json.
  This native setting needs a rebuilt binary; OTA alone is insufficient.
- The game's session identifier is `ctx_session_id`; it must not overwrite
  Firebase's reserved/session semantics. Old `session_id` event data is a
  different schema and must be handled explicitly in historical reports.
- `session_end` is a client background observation, not GA's session definition.
- `week_advanced` observes committed absolute-week increases during gameplay,
  including the weekly loading overlay, but excludes save hydration.
- `save_repair_checked` is emitted at the repair check in hydration, for clean
  and repaired saves. It is NOT confirmation of successful load/save completion.
  It supplies the denominator missing from the older `save_repaired` event.
  `sourceSaveVersion` is the pre-migration version when the caller knows it;
  missing means unknown. No repair strings, slot IDs or save contents are sent.

## Acceptance

On an opted-in fresh signed build: visit Home → Work → Home, advance one week,
load an old save, and verify the named screen/weekly/repair events in DebugView.
Verify denied/withdrawn analytics emits none. Use one sandbox trial, one sandbox
paid item and restore to check flow events against store transactions without
counting restore or free trial as new paid revenue. Do not mix sandbox evidence
into production KPI charts.

For retention compare mature D1/D7 cohorts by build and platform, include sample
sizes, and keep Apple's opt-in device population separate. For trials report
starts, converted, expired and pending together. Return CTA and premium-copy
changes are hypotheses; no retention or conversion improvement is claimed from
render tests.

References: https://rnfirebase.io/analytics/screen-tracking and
https://support.google.com/analytics/answer/9234069 document screen tracking and
the duplicate-purchase risk.
