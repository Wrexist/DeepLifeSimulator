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
