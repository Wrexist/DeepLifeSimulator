#!/usr/bin/env node
// scripts/wait-for-eas-submission.mjs
//
// Watch an EAS submission that was scheduled with `eas submit --no-wait`, and
// report what it is actually doing.
//
//   node scripts/wait-for-eas-submission.mjs --id <submission-uuid>
//   node scripts/wait-for-eas-submission.mjs --platform ios     (latest one)
//   npm run submit:watch -- --platform ios
//
// Flags:
//   --id <uuid>          the submission to watch. Preferred: exact, and immune
//                        to a second submission starting alongside this one.
//   --from-log <file>    read the id out of a saved `eas submit` transcript.
//                        This is how CI passes it: `eas submit` has no --json,
//                        but it prints `Submission details: <url>` before the
//                        wait would have begun, so the id is in the log.
//   --platform ios|android   watch the project's most recent submission for the
//                        platform. Used when no id could be resolved.
//   --url <url>          submission web page, echoed into every report.
//                        Defaults to the URL found by --from-log.
//   --timeout-minutes N  stop watching after N minutes (default 60).
//   --link-only          resolve and print the submission link, then exit 0
//                        without polling. For the run that deliberately does
//                        not wait: it still records WHERE the answer will be.
//
// Exit codes: 0 the submission FINISHED. 1 it ERRORED/CANCELED, or the watch
// timed out, or the status could not be read at all. A timeout says plainly
// that the submission may still be running - see formatWatchTimeout.
//
// Why this exists rather than plain `eas submit` (which waits by default):
// while waiting, eas-cli prints one spinner line for the entire submission. A
// 22-minute queue wait and a wedged submission produce byte-identical logs, so
// the only way to tell them apart was to give up and look at the website. This
// polls `eas submit:view --json`, which is where the state actually lives, and
// prints every transition plus a two-minute heartbeat.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import {
  formatElapsed,
  formatFailure,
  formatProgressLine,
  formatWatchTimeout,
  isTerminal,
  parseSubmissionDetails,
  parseSubmissionJson,
  pollDelayMs,
  shouldLog,
  succeeded,
} from './lib/easSubmission.mjs';

const ARGS = process.argv.slice(2);
const has = (flag) => ARGS.includes(flag);
const valueOf = (flag, fallback = null) => {
  const i = ARGS.indexOf(flag);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith('--') ? ARGS[i + 1] : fallback;
};

// An unreadable transcript is not fatal: --platform still finds the project's
// most recent submission, which under this repo's `concurrency` group is the
// one we just scheduled.
const fromLog = (() => {
  const path = valueOf('--from-log');
  if (!path) return null;
  try {
    return parseSubmissionDetails(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    console.log(`Could not read ${path} (${err?.message ?? err}); falling back to --platform.`);
    return null;
  }
})();

const submissionId = valueOf('--id') ?? fromLog?.id ?? null;
const platform = valueOf('--platform');
const submissionUrl = valueOf('--url') ?? fromLog?.url ?? null;
const linkOnly = has('--link-only');
const timeoutMs = Number(valueOf('--timeout-minutes', '60')) * 60_000;

// Consecutive read failures tolerated before giving up. A single failed poll is
// a network blip and must not fail a release; a run of them means the CLI is
// not going to answer and continuing would only burn the timeout.
const MAX_CONSECUTIVE_READ_FAILURES = 5;

if (!submissionId && !platform && !linkOnly) {
  console.error('Pass --id <submission-uuid>, --from-log <file>, or --platform <ios|android>.');
  process.exit(1);
}
if (!linkOnly && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
  console.error('--timeout-minutes must be a positive number.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `eas submit:view` and hand back its stdout. Never throws. */
function readSubmission() {
  const args = ['submit:view', '--json'];
  if (submissionId) args.push(submissionId);
  else args.push('--platform', platform);

  return new Promise((resolve) => {
    // No shell: the id/platform reach the CLI as argv entries, so nothing here
    // is interpretable as shell syntax.
    const child = spawn('eas', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => resolve({ submission: null, stderr: String(err) }));
    child.on('close', () => resolve({ submission: parseSubmissionJson(stdout), stderr }));
  });
}

function summary(text) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  try {
    fs.appendFileSync(path, `${text}\n`);
  } catch {
    // A summary is a nicety; never let it decide the outcome of a release.
  }
}

/** GitHub renders ::error:: / ::notice:: as annotations; %0A keeps them multiline. */
const annotate = (level, text) => `::${level}::${text.replace(/\n/g, '%0A')}`;

async function main() {
  if (linkOnly) {
    const where =
      submissionUrl ??
      `run \`npm run submit:watch -- --platform ${platform ?? 'ios'}\` to see how it went`;
    const text =
      'Submission scheduled at EAS; this run is not waiting for it. ' +
      'It keeps going without us, and a rejection will NOT show up here.\n' +
      where;
    console.log(annotate('notice', text));
    summary(`### Submission scheduled (not watched)\n\n${text}`);
    return;
  }

  const startedAt = Date.now();
  const target = submissionId ? `submission ${submissionId}` : `the latest ${platform} submission`;
  const timeoutMinutes = Math.round(timeoutMs / 60_000);
  console.log(
    `Watching ${target}. Giving up after ${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}.`
  );
  if (submissionUrl) console.log(`Submission details: ${submissionUrl}`);
  console.log(
    'The wait below is EAS queueing the job and uploading the binary to App Store\n' +
      'Connect. It is not this runner doing work, and nothing here can make it faster -\n' +
      'what it can do is say which of those two it is currently stuck on.'
  );

  let previousStatus = null;
  let lastLoggedAtMs = -Infinity;
  let consecutiveFailures = 0;

  for (;;) {
    const elapsedMs = Date.now() - startedAt;
    const { submission, stderr } = await readSubmission();
    const status = submission?.status ?? null;

    if (!status) {
      consecutiveFailures += 1;
      console.log(
        `[watch] could not read the submission status ` +
          `(${consecutiveFailures}/${MAX_CONSECUTIVE_READ_FAILURES}). ${stderr.trim().split('\n').pop() ?? ''}`
      );
      if (consecutiveFailures >= MAX_CONSECUTIVE_READ_FAILURES) {
        console.log(
          annotate(
            'error',
            `Gave up reading the submission status after ${MAX_CONSECUTIVE_READ_FAILURES} attempts.\n` +
              `The submission itself may be fine - check ${submissionUrl ?? 'https://expo.dev'}.`
          )
        );
        process.exit(1);
      }
    } else {
      consecutiveFailures = 0;
      if (shouldLog({ status, previousStatus, elapsedMs, lastLoggedAtMs })) {
        console.log(formatProgressLine({ status, elapsedMs }));
        lastLoggedAtMs = elapsedMs;
      }
      previousStatus = status;

      if (isTerminal(status)) {
        const url = submissionUrl ?? null;
        if (succeeded(status)) {
          const done = `Submission finished in ${formatElapsed(elapsedMs)} - the store has the binary.`;
          console.log(annotate('notice', done));
          summary(`### Submission finished\n\n${done}${url ? `\n\n${url}` : ''}`);
          return;
        }
        const failure = formatFailure(submission, url);
        console.log(annotate('error', failure));
        summary(`### Submission ${status.toLowerCase()}\n\n\`\`\`\n${failure}\n\`\`\``);
        process.exit(1);
      }
    }

    if (elapsedMs >= timeoutMs) {
      const message = formatWatchTimeout({
        elapsedMs,
        status: previousStatus ?? 'unknown',
        url: submissionUrl,
      });
      console.log(annotate('error', message));
      summary(`### Stopped watching\n\n${message}`);
      process.exit(1);
    }

    await sleep(pollDelayMs(elapsedMs));
  }
}

main().catch((err) => {
  console.log(annotate('error', `Submission watch crashed: ${err?.message ?? err}`));
  process.exit(1);
});
