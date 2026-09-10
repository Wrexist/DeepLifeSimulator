# R11 privacy reconciliation — 10 September 2026

Status: HOLD. Inspected PR #209 at `4552f6d08219161298047bda3134672c1cce20ec`
plus the consent changes in this working branch. This is an evidence record,
not certification that the signed app or live policy matches the candidate.

## Confirmed operator and operating facts

The owner initially supplied **Molin Inc.**, then clarified that they operate in
**Sweden** and that this is **not a registered legal name**. It is a project/trading
name, not a verified corporate operator. The draft no longer presents it as a
legal company. The owner subsequently confirmed **Isac Molin** as the individual
legal operator in Sweden. The candidate policy now identifies Isac Molin and
labels Molin Inc. only as the project name. These are owner-confirmed facts,
not a claim of company registration.
Candidate policy revision 3 has not been published. The actual deletion-request
procedure, other providers' retention settings and completion records remain unconfirmed. No
provider-wide deletion promise has been invented. The owner also confirmed
they monitor/manage the support mailbox and have received no deletion requests.
They do not know of an existing procedure. A researched
[proposed runbook](../../../docs/PLAYER_DATA_DELETION.md) now covers matching,
provider operations, completion checks and reply templates; it is not yet an
adopted or tested process.

## Source data and consent map

| Surface/provider | Source trigger and data | Permission and outstanding evidence |
|---|---|---|
| Local saves | AsyncStorage save slots, game state, preferences and recovery journals | Local deletion does not remove provider or Apple purchase records. Device deletion/relaunch acceptance remains required. |
| RevenueCat / Apple | Purchase configuration, anonymous app-user identifier, transactions, entitlements, restoration; ad-revenue event forwarding | Purchase functionality is separate from ATT. RevenueCat's Apple AdServices attribution collection also runs on iOS. Provider retention, customer lookup/deletion and optional measurement purposes need reconciliation. |
| AdMob | Native initialization, banner/rewarded/interstitial requests, device/ad data, impression revenue | Candidate now waits for UMP `canRequestAds === true` before SDK initialization and requests. ATT separately restricts personalization. Neither non-personalized ads nor ATT establishes regional consent. |
| Firebase Analytics | Native SDK plus optional product/session funnel; automatic collection and native consent defaults off in `firebase.json` | Candidate requires a separate usage-analytics opt-in plus tracking permission. It sends explicit analytics consent and denies all three advertising purposes. Native behavior still needs validation. |
| Optional telemetry | Same separate usage choice gates gameplay funnel and configured HTTP sink | Withdrawal clears queued events, serializes persistence and aborts a pending upload. Actual endpoint/configuration and retention still need confirmation; an enabled flag alone does not prove collection. |
| Expo | Distribution and update requests | Network/update data are separate from local saves; provider retention not established here. |
| Support email | Voluntary support correspondence | Actual request handling, identity verification and mailbox retention await owner confirmation. |

## Read-only provider observations

App Store Connect, AdMob, RevenueCat and Firebase were available through the
authenticated browser. No dashboard settings, store answers or messages were
changed; no customer records were exported.

### App Store Connect — DeepLife, app 6749675615

The App Privacy page displays a publication age of a year and these selections:

| Category | Selected purposes | Linked / tracking |
|---|---|---|
| Name | Third-party advertising, functionality, analytics | Linked |
| Email address | Functionality, analytics | Linked |
| Payment information | Functionality | Linked |
| Coarse location | Developer advertising/marketing | Linked |
| User ID | Developer advertising/marketing, analytics, functionality | Linked; tracking |
| Device ID | Third-party advertising, analytics, functionality | Linked; tracking |
| Purchase history | Analytics, functionality | Linked |
| Product interaction | Analytics, developer advertising/marketing, functionality | Linked; tracking |
| Advertising data | Developer advertising/marketing, analytics, functionality | Linked; tracking |
| Other usage data | Analytics, functionality | Linked |
| Crash data | Analytics | Not linked |
| Performance data | Analytics | Not linked |
| Other data types | Functionality, analytics | Linked |

These are observed selections, not approved answers. Name, email and payment
information require particular reconciliation with actual SDK/support collection
and Apple's definitions. Do not replace them with blanket 'no data collected'.

### AdMob

The European-message tab displays the creation empty state: no configured message
was shown. Automatic maximum coverage is enabled; this is not native evidence of
a correctly displayed consent flow. Settings show 198 common partners, automatic
addition of ad-source partners off, RTB creative consent checking off, legitimate
interest controls on, advertising consent mode off, special feature 2 off and
zero selected publisher-own purposes. A reviewed app-specific message and
measurement-purpose configuration remain necessary before native validation.

### RevenueCat

DeepLife project `467799e3`: restore behavior is **Transfer to new App User ID**;
separate sandbox restore behavior is off; sandbox entitlement access is
**Anybody**. These observations do not verify interrupted purchase fulfillment,
cross-install restoration or deletion. No customer identifiers are recorded here.

### Firebase

DeepLife project `deep-life-simulator-2779c` has iOS and Android apps and shows
analytics activity. Browser access recovered through a fresh task tab. The
linked Analytics property **545257707** was then inspected read-only:

- Event retention: **2 months**. User retention: **14 months**. **Reset on new
  user activity is on**. These controls do not define all aggregate/provider
  retention; do not advertise universal deletion after two months.
- The iOS stream, identified by its icon in the selector, has one reported issue:
  missing EEA consent information. `analytics_storage`, `ad_storage`,
  `ad_user_data` and `ad_personalization` signals are reported inactive. The
  page's general 'Good' heading does not override these explicit warnings.
- Default labels: **No, do not automatically mark this data as consented**,
  verified visually and in loaded panel text. No settings were changed.
- Firebase has no assigned privacy representative. This observation alone does
  not establish a requirement to appoint a DPO or EU representative.

Provider deletion execution remains untested; no deletion request was submitted.

## Candidate corrections and verification

- ATT module/method failures, invalid results and rejected native calls now deny
  tracking rather than grant it. Explicit granted outcomes still work.
- AdMob waits for UMP, deduplicates concurrent startup and only uses the SDK's
  current permission after a refresh error. Missing/failed permission blocks ads.
- Settings includes Ad Privacy Choices on enabled native builds. Changing choices
  clears cached loads/listeners and prevents new ads while the form is open.
- The support contact is explicit in the candidate policy; the supplied trading
  name is not represented as a registered legal entity.
- A separate **Usage analytics (optional)** choice is off by default, persists
  explicitly and can be withdrawn in Settings. ATT alone no longer grants
  measurement. Storage/native failures cannot grant it; queued consent changes
  prevent a delayed grant from winning over withdrawal.
- Firebase explicitly sends `analytics_storage` and keeps `ad_storage`,
  `ad_user_data` and `ad_personalization` false. Native default keys are denied.
  **A new native build is required** to include these Firebase defaults; a web
  export or OTA cannot establish that the installed binary contains them.

Behavioral regressions exercise native failure paths, pending consent, cached
permission, request cancellation, late load events and changed choices.
`npm test -- --runInBand --watchAll=false` completed with exit 0: **787 suites,
9,822 tests and 308 snapshots passed** in 641.64 seconds; 17 suites / 32 tests
were skipped. The new ATT suite has 11 cases; ad-load/consent has 17 cases.
`npm run preflight`
completed with exit 0: source/test types clean, lint zero errors and 700 warnings
under the unchanged 715 ceiling; UI/content/liveops gates passed. The preflight
success text was corrected to distinguish static checks from native release
acceptance (`node --check scripts/preflight-check.js`, exit 0).
The follow-up analytics implementation passed another preflight (exit 0,
unchanged floors). Its full local run had 788 suites / 9,834 tests passing and
one failure: the startup guard caught an eager native AsyncStorage import in
the new permission reader. This was corrected to lazy loading without changing
the guard. Final focused verification passed **six suites / 40 tests**, exit 0,
including that startup guard and the consent/withdrawal regressions. The failed
full run is not a pass; final-head CI must supersede it. The 9,822 count above
belongs to the preceding ad-consent implementation.

Production-style web export: exit 0 with Firebase feature enabled, no telemetry
endpoint, and native SDKs unavailable on web. This isolated preview used port
8092 and created no life/save. Main Menu → Settings reached the new control:

| Case | Result |
|---|---|
| 375×812 initial state | OFF, explanation readable, switch and modal Close reachable |
| Opt in → reload → reopen Settings | ON retained |
| Withdraw → reload → reopen Settings | OFF retained |
| 820×1180 layout | Explanation and switch visible within scrollable modal |

Captures: [phone](R11-analytics-phone-2026-09-10.png) and
[tablet](R11-analytics-tablet-2026-09-10.png). Temporary viewport override reset.
These are after-change web captures, not matched native before/after evidence.
The later storage-loading correction and extra switch hit padding do not change
the displayed layout; native startup and touch behavior remain separate checks.
Native UMP form presentation, regional simulation, purpose signals, ATT revocation
while backgrounded, old-binary upgrade and lifecycle acceptance remain UNREACHED.

The existing browser gameplay session reached Save Slots at 375×812 with slot 1
preserved and slots 2/3 empty. Clicking slot 2 timed out. No completed new-life
journey or visual-layout pass is inferred from that accessibility snapshot.

## Current guidance consulted

- [Google iOS privacy integration](https://developers.google.com/admob/ios/privacy)
- [Installed React Native library's UMP integration guidance](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent)
- [Google personalized and non-personalized ads](https://support.google.com/admob/answer/7676680?hl=en)
- [RevenueCat Apple privacy disclosure guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
- [Firebase collection controls](https://firebase.google.com/docs/analytics/ios/configure-data-collection)

## Next acceptance steps

1. Confirm actual deletion operations and provider retention; prepare a procedure
   if none exists, explicitly distinguishing a proposal from current practice.
2. Validate the separate usage choice and native purpose signals against provider
   configuration. Review exact consent-message/store-answer changes. Check system
   ATT revocation during background/return as well as the in-app withdrawal path.
3. Test those choices on the exact signed candidate, including offline failure,
   prior consent, revocation, reinstall and Settings modal presentation.
4. Inspect phone/tablet policy and support pages, then publish only through an
   authorized workflow and verify the live revision. Record run and binary IDs.
