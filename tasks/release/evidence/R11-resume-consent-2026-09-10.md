# R11: analytics consent after returning to the app

Base: main `4046365eefbe9af09c2c744460b5b7918cd51855` (PR #209 merged by owner).
Status: implementation under verification; native acceptance UNREACHED.

## Observed gap and change

At this base, the root layout reads usage/ATT consent during startup and Settings
updates it explicitly. There is no analytics AppState subscription. The HTTP
queue and Firebase wrapper retain their consent booleans after the player leaves
for iOS Settings, so a running process has no corresponding revocation refresh.
This is source evidence, not a claim that a particular device transmitted data.

The new lifecycle observer immediately blocks dispatch, clears/aborts queued
telemetry through the existing withdrawal boundary, and suspends an already
loaded Firebase sink on inactive/background. It does not load Firebase merely
to suspend it. Returning active rechecks saved usage consent and current ATT,
applies native consent, then rechecks before granting the JS sink. A generation
counter rejects results from old transitions and unmounted listeners. Saved
player preferences are not rewritten by temporary lifecycle suspension.

AdMob cached-request refresh is a separate unresolved acceptance case: ad
presentation itself can make iOS inactive, so blindly destroying ad listeners
on every transition could lose an earned reward. This change does not claim to
solve that case or prove native SDK behavior.

## Verification

- Focused Jest: 5 suites / 40 tests, exit 0. Revocation, read failure, older
  granted results, cleanup, withdrawal during native work, no eager Firebase
  startup, background event/flush gates and lazy AsyncStorage covered.
- Focused ESLint on new lifecycle code and affected consent services: exit 0,
  no warnings. Full preflight completed with exit 0, zero source/test type and
  lint errors; 700 existing warnings under unchanged ceiling 715. Subsequent
  generation-check and Settings recheck refinements passed the focused suite;
  final source/test checks and iOS export are recorded in the PR handoff.
- Final source and test TypeScript checks: exit 0. iOS Hermes export: exit 0,
  4,004 modules, 13.6 MB bytecode. This is a local bundle, not a signed binary.
- No UI changes; no new native library, dependency or save schema change.
- Native ATT prompts/revocation, SDK network signals, termination and actual
  device performance remain UNREACHED. Browser evidence cannot close them.

React Native 0.81.5 is installed. The implementation uses the documented
[AppState change subscription and removal](https://reactnative.dev/docs/appstate.html).
Unknown initial native state is treated as suspended until an active transition.

## Merge and publication facts

PR #209 final tests, preflight, coverage and quality checks all passed.
Its support deployment [34525101289](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34525101289)
succeeded. A direct HTTPS fetch with Cache-Control: no-cache returned policy
revision 3 and the Isac Molin operator line. The search renderer still served
revision 2; direct response is the publication evidence. No provider or store
settings were changed by this follow-up. The main EAS update workflow
[34525101221](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34525101221)
was still running at inspection; do not infer OTA delivery from merge alone.

## Signed-device rehearsal to run next

The owner confirmed they can test on an iPhone using a fresh installation with
no real purchases. This provides a tester, not evidence that any test has run.
No specific record has yet been designated for provider deletion.

1. Record the exact source SHA, native app version/build and OTA update ID.
   Confirm the binary includes the denied Firebase native defaults. The
   previously observed 2.14.0 (186) predates those defaults and cannot prove them.
2. Use a designated fresh test installation with no real purchases. Leave usage
   analytics OFF. Confirm no measurement events with provider/native diagnostics.
3. If testing opt-in, grant the optional usage choice and ATT, then verify one
   controlled gameplay event and denied Firebase advertising purposes.
4. Background, revoke ATT in iOS Settings, return and perform another event.
   Verify no new measurement event/upload, including any formerly queued event.
   Repeat with slow/offline permission reads and rapid inactive/active changes.
5. Restore ATT without changing the saved usage choice and verify fresh consent
   evaluation. Turn usage OFF, background/return and confirm it remains OFF.
6. In Settings prepare a privacy request. Match available IDs against the correct
   provider project privately. Verify unavailable-ID and no-mail-client paths,
   text selection, VoiceOver, Larger Text and reachable Close on iPhone/iPad.
7. Follow docs/PLAYER_DATA_DELETION.md with that designated test record. Review
   the exact deletion targets before destructive provider actions. Record private
   completion evidence; an accepted asynchronous request is not completion.

Never put real player IDs, receipts or support emails into repository evidence.
Keep the release HOLD until actual native/provider evidence is recorded.
