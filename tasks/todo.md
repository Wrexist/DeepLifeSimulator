# TestFlight submit: 22 minutes of a silent step (2026-08-19)

Symptom: `eas-build-local-ios.yml` → **Submit to TestFlight** sat at 22m44s with
28 log rows, the last one `- Submitting`, no way to tell stuck from working.

## Ground truth established first

- The step is not slow, it is **blocked**. `eas submit` uploads the archive and
  schedules the submission in ~90 s (rows 10–25 of the log), then row 27 —
  `Waiting for submission to complete` — blocks on EAS's submission queue and
  EAS's Transporter upload to App Store Connect. Nothing in this repo makes
  Apple's side faster.
- `--wait` is the eas-cli default (`allowNo: true`, so `--no-wait` turns it off).
  While waiting, the CLI prints ONE spinner line for the whole submission — it
  never reports which state the submission is in, which is why 22 minutes
  produced no rows.
- The 2026-08-05 lesson already rejected bare `--no-wait`: it makes the job
  green the instant the submission is *scheduled*, so a rejected binary reads as
  a passing release. That objection is about losing the signal, not about
  waiting, and eas-cli **22** ships the piece that was missing then:
  `eas submit:view <id> --json` returns `status` +`error`, and the status enum is
  `AWAITING_BUILD | IN_QUEUE | IN_PROGRESS | FINISHED | ERRORED | CANCELED`
  (verified against the published tarball, not recalled).
- `printSubmissionDetailsUrls` runs BEFORE the wait, so `--no-wait` still prints
  `Submission details: …/submissions/<uuid>` — the id the poller needs.

## Steps

- [x] 1. `scripts/lib/easSubmission.mjs` — pure: id/URL parsing (ANSI-tolerant),
      status classification, poll backoff, log-throttle, failure formatting
- [x] 2. `scripts/wait-for-eas-submission.mjs` — polls `eas submit:view --json`,
      prints every state change plus a heartbeat, bounded, red on ERRORED/CANCELED
- [x] 3. `eas-build-local-ios.yml` — `--no-wait` + capture id, then the watch step
      behind a `wait_for_submission` input (default true)
- [x] 4. Same in `eas-build-local-android.yml` and the iOS diagnostics twin
- [x] 5. `npm run submit:watch` for the same check from a laptop
- [x] 6. `__tests__/tooling/easSubmissionWait.test.ts`
- [x] 7. Amend the 2026-08-05 lesson in place — its `--no-wait` verdict is now
      half-stale, and a stale absolute is a trap for the next reader

## Result

- `Submit to TestFlight` now ends when the .ipa has actually reached EAS (~90 s)
  and the waiting moved into `Watch the TestFlight submission`, which prints
  `IN_QUEUE → IN_PROGRESS → FINISHED` plus a 2-minute heartbeat. Same wall clock,
  same red-on-rejection signal, but "working" and "stuck" are now distinguishable.
- `wait_for_submission: false` ends the run at "handed to EAS" and records the
  link; the submission still completes.
- Applied to all three local-build workflows (iOS, iOS diagnostics, Android).

## Verification

- `npx jest __tests__/tooling --ci` — **14 suites, 185 tests, all passed** (10.8 s),
  23 of them the new `easSubmissionWait` suite
- `npm run type-check` and `npm run type-check:tests` — both clean
- `npx eslint` on the three new/changed source files — clean
- `python3 -c "yaml.safe_load(...)"` over all 8 workflows — all parse
- End-to-end smoke of the watcher against a stubbed `eas` on PATH: FINISHED
  exits 0 with a step summary; ERRORED exits 1 carrying the error code and
  message; `--link-only` exits 0 with the URL; five unreadable polls in a row
  exit 1 rather than hanging to the timeout. The id was parsed out of a
  transcript carrying real ANSI escapes, which is the case that decides whether
  the watch runs at all.

## Not done, and why

- `eas submit` in `scripts/build-and-submit-testflight.{sh,ps1}` still waits
  inline. A human running those is already watching the terminal, so the silent
  step is not the same problem there.
- Nothing here makes the submission FASTER. The 22 minutes are EAS's queue plus
  the Transporter upload to App Store Connect; that is Apple's and Expo's side.

## Audit round (same day)

Re-read the change looking for what it got wrong. Five things, all fixed:

- [x] 8. **The pairing was only a comment.** `--no-wait` is safe only while a
      watch step follows it. Added `__tests__/tooling/submitWorkflowInvariants.test.ts`,
      which pins the pairing, the `success() &&` guards and `set -o pipefail`
      across all three workflows — and verified it by breaking each invariant
      and watching it go red.
- [x] 9. **The retry budget was measured in attempts.** Five failed polls is 40
      seconds at the tight early cadence, so a one-minute blip failed a release
      that was fine. Now a five-minute grace, with the relationship to
      `pollDelayMs` asserted.
- [x] 10. **`FINISHED` was reported as if it meant approved.** It means the
      store accepted the UPLOAD; Apple validates afterwards, which is where
      Invalid Binary comes from. Both the annotation and the runbook say so now.
- [x] 11. **The `--platform` fallback path had no link.** The payload carries
      `app.ownerAccount.name` + `app.slug`, so the URL is rebuilt from it —
      a failure report with no link is one nobody can act on.
- [x] 12. **Android was reading iOS wording.** The shared watcher said "App
      Store Connect" and "Apple said" on Play submissions. One
      `storeName(platform)` helper; failure line made platform-neutral.

## Verification (audit round)

- `npx jest __tests__/tooling --ci` — **15 suites, 209 tests, all passed** (8.7 s)
- Mutation-tested the new pin: dropping `--no-wait` fails it; dropping
  `success()` fails it; the workflow was restored and verified clean against HEAD
- Re-ran the watcher end to end against the stub for: transient read failures
  recovering into a FINISHED (URL rebuilt from the payload, no `--from-log`),
  an Android ERRORED (Play wording, exit 1), and a watch timeout (exit 1 with
  the "this is not a rejection" wording)

## Review round (CodeRabbit, #146)

Five findings. Three acted on, two skipped as contrary to this repo's conventions.

- [x] 13. **MAJOR, and correct: bound each `eas submit:view`.** A hung child
      meant `readSubmission()` never resolved - no heartbeat, and the watch
      timeout unreachable, i.e. the exact silence this whole change removes.
      Added a 90s read deadline (SIGTERM, then SIGKILL 5s later, unref'd),
      resolving as an unreadable poll so `READ_FAILURE_GRACE_MS` absorbs it.
      Verified against a stub that hangs forever: the loop keeps turning every
      ~12s and leaves zero orphan processes. `--read-timeout-seconds` makes the
      path exercisable in seconds.
- [x] 14. **Correct: the `eas-build` skill hardcoded iOS.** It accepts
      `ios|android` but told every user `--platform ios` and to check
      TestFlight. Now platform-specific, with the Play follow-up spelled out.
- [x] 15. **Partly correct: bind the guards to each watcher step.** The claim
      that unrelated conditions could satisfy the old assertion was wrong - it
      asserted `success()` on EVERY line mentioning the input, and dropping one
      was mutation-tested red. But the REAL gap it points at is untested:
      nothing asserted `wait_for_submission` defaults to **true**, so
      `default: false` would silently disable the release signal everywhere.
      Guards are now read off each watcher step, and the default is pinned
      (mutation-tested).
- [x] 16. **Skipped: "use interfaces, not inline object shapes" (nit).** Not
      this repo's convention - `initialStateFieldCoverage.test.ts` uses inline
      shapes in exactly this position, and there is no `.coderabbit.yaml`, so
      the cited "coding guidelines" are the bot's defaults, not ours.
- [x] 17. **Skipped: "annotate Jest callbacks with `void`/`Promise<void>`" (nit).**
      Contradicts the neighbouring file: `ascRelease.test.ts` uses bare
      `beforeAll(async () => {`. Across ~535 test files there are 4 such
      annotations and 3 of them are inside regexes asserting on source text.
