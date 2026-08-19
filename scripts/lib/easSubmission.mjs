// scripts/lib/easSubmission.mjs
//
// Pure helpers for watching an EAS submission from CI. No I/O, no process, no
// network - everything here is a function of its arguments so the CI-only path
// is testable (__tests__/tooling/easSubmissionWait.test.ts).
//
// Why this file exists: `eas submit` waits for the submission by default and,
// while waiting, prints a SINGLE spinner line for the whole thing. A submission
// that spends 20 minutes in EAS's queue therefore looks identical to one that
// is wedged - same 28 log rows, same last line. The fix is to schedule with
// `--no-wait` and poll `eas submit:view <id> --json` ourselves, which is the
// only place the actual state is visible.
//
// The status strings are the SubmissionStatus GraphQL enum as shipped in
// eas-cli 22 (build/graphql/generated.js), not a guess.

export const SUBMISSION_STATUS = {
  AWAITING_BUILD: 'AWAITING_BUILD',
  IN_QUEUE: 'IN_QUEUE',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
  ERRORED: 'ERRORED',
  CANCELED: 'CANCELED',
};

const TERMINAL = new Set([
  SUBMISSION_STATUS.FINISHED,
  SUBMISSION_STATUS.ERRORED,
  SUBMISSION_STATUS.CANCELED,
]);

/** One place that turns a platform into the store it submits to. */
export function storeName(platform) {
  return String(platform).toLowerCase() === 'android' ? 'Google Play' : 'App Store Connect';
}

// What each state actually means for someone staring at the job, so the log
// says "waiting for a worker" rather than repeating an enum name. Two of them
// name the store, so this watcher reads correctly on the Android workflow too.
const DESCRIPTIONS = {
  [SUBMISSION_STATUS.AWAITING_BUILD]: () => 'waiting for the binary to finish uploading to EAS',
  [SUBMISSION_STATUS.IN_QUEUE]: () =>
    'queued at EAS - waiting for a submission worker, not for our runner',
  [SUBMISSION_STATUS.IN_PROGRESS]: (store) => `EAS is uploading the binary to ${store}`,
  [SUBMISSION_STATUS.FINISHED]: (store) => `${store} accepted the upload`,
  [SUBMISSION_STATUS.ERRORED]: () => 'the submission failed',
  [SUBMISSION_STATUS.CANCELED]: () => 'the submission was canceled',
};

// CSI sequences (colour, cursor) and OSC sequences (terminal hyperlinks). Both
// arms are anchored on the ESC byte: an unanchored `\]...` arm would swallow
// every character after the first literal ] in the log.
const ANSI = /\u001B\[[0-9;]*[A-Za-z]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

/**
 * Drop terminal escapes. eas-cli dims and underlines URLs, and the runner is
 * colour-capable enough that the raw bytes reach a piped log.
 */
export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI, '');
}

const SUBMISSION_URL = /https?:\/\/\S*?\/submissions\/([0-9a-fA-F-]{36})/;

/**
 * Pull the submission id + web URL out of `eas submit --no-wait` output.
 * `printSubmissionDetailsUrls` runs BEFORE the wait in eas-cli, so the line is
 * printed whether or not `--wait` was passed - which is what makes scheduling
 * and watching separable at all.
 */
export function parseSubmissionDetails(stdout) {
  const match = SUBMISSION_URL.exec(stripAnsi(stdout));
  if (!match) return null;
  return { id: match[1], url: match[0] };
}

/**
 * Rebuild the submission's web URL from the payload itself, mirroring eas-cli's
 * getSubmissionDetailsUrl. This is what keeps the `--platform` fallback path
 * useful: when the transcript could not be parsed there is no URL to pass in,
 * and a failure report with no link is a failure report nobody can act on.
 */
export function submissionUrlFrom(submission) {
  const id = submission?.id;
  const account = submission?.app?.ownerAccount?.name;
  const slug = submission?.app?.slug;
  if (!id || !account || !slug) return null;
  return `https://expo.dev/accounts/${account}/projects/${slug}/submissions/${id}`;
}

export function isTerminal(status) {
  return TERMINAL.has(status);
}

export function succeeded(status) {
  return status === SUBMISSION_STATUS.FINISHED;
}

export function describeStatus(status, platform = 'ios') {
  const describe = DESCRIPTIONS[status];
  return describe ? describe(storeName(platform)) : `unrecognized status ${String(status)}`;
}

/**
 * Poll interval, widening with elapsed time. Tight at the start so a fast
 * submission - or an immediate credential rejection - is reported promptly,
 * then loose, because after ten minutes the answer is "still in someone else's
 * queue" and a 10s poll only spends API calls to say so.
 */
export function pollDelayMs(elapsedMs) {
  if (elapsedMs < 2 * 60_000) return 10_000;
  if (elapsedMs < 10 * 60_000) return 30_000;
  return 60_000;
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

/**
 * Log throttle. Every state CHANGE prints immediately; an unchanged state
 * prints a heartbeat every two minutes. The point is that the log must always
 * be advancing - a step that has printed nothing for 20 minutes is
 * indistinguishable from a hung one, which is the bug being fixed.
 */
export const HEARTBEAT_MS = 2 * 60_000;

/**
 * How long `eas submit:view` may stay unreadable before the watcher gives up.
 * Bounded by TIME rather than attempt count on purpose: the poll tightens to
 * 10s early on, so "five failed attempts" is a 40-second sample of transient
 * and a one-minute network blip would fail a release that was perfectly fine.
 * It must stay comfortably larger than several pollDelayMs intervals - the
 * accompanying test asserts that, because shrinking it silently converts blips
 * into red releases.
 */
export const READ_FAILURE_GRACE_MS = 5 * 60_000;

/**
 * How long ONE `eas submit:view` call may run before it is killed and counted
 * as an unreadable poll.
 *
 * Without this the watcher has the very defect it was built to remove: a child
 * process that never exits means the poll promise never resolves, so no
 * heartbeat prints, the elapsed-time check at the bottom of the loop is never
 * reached, and the step sits silent until the workflow job timeout. Bounding
 * the read keeps the loop turning, which is what makes every other guarantee
 * here - heartbeat, grace, watch timeout - actually reachable.
 *
 * Must stay well under READ_FAILURE_GRACE_MS so that several stalled reads in
 * a row are what exhausts the grace, not a single one.
 */
export const READ_DEADLINE_MS = 90_000;

export function shouldLog({ status, previousStatus, elapsedMs, lastLoggedAtMs }) {
  if (status !== previousStatus) return true;
  return elapsedMs - lastLoggedAtMs >= HEARTBEAT_MS;
}

export function formatProgressLine({ status, elapsedMs, platform = 'ios' }) {
  return `[${formatElapsed(elapsedMs)}] ${status} - ${describeStatus(status, platform)}`;
}

/**
 * Failure text for a terminal non-FINISHED submission. The reason arrives as
 * `error.errorCode` + `error.message`; both are optional, and a failure with
 * neither still has to name the submission, so the URL is always included.
 */
export function formatFailure(submission, url) {
  const lines = [`Submission ${String(submission?.status ?? 'unknown').toLowerCase()}.`];
  const code = submission?.error?.errorCode;
  const message = submission?.error?.message;
  if (code) lines.push(`Error code: ${code}`);
  if (message) lines.push(`Reason reported by EAS: ${message}`);
  if (url) lines.push(`Submission details: ${url}`);
  return lines.join('\n');
}

/**
 * A watch timeout is NOT a failed submission - the binary is still on its way,
 * we simply stopped holding a runner open for it. Say so, or the next reader
 * treats a red job as a rejected build and rebuilds for nothing (and a rebuild
 * is the one thing that is never free here: it mints a new CFBundleVersion).
 */
export function formatWatchTimeout({ elapsedMs, status, url, platform = 'ios' }) {
  return [
    `Stopped watching after ${formatElapsed(elapsedMs)} - last status ${status}.`,
    'This does NOT mean the submission failed: it is still running at EAS and',
    'may yet finish. Do not rebuild on the strength of this alone.',
    url ? `Check it here: ${url}` : `Check it with: npm run submit:watch -- --platform ${platform}`,
  ].join('\n');
}

/**
 * What FINISHED does and does not mean. EAS reports finished when App Store
 * Connect ACCEPTS THE UPLOAD; Apple then validates the binary asynchronously,
 * which is where ITMS-91064 (privacy manifest) and friends surface, minutes
 * later, by email and as "Invalid Binary" in App Store Connect (CLAUDE.md 9).
 * A green watch step is therefore "Apple has it", not "Apple accepted it" —
 * worth spelling out, because reading it as the latter is how a build sits in
 * Invalid Binary for a day while everyone believes the release went out.
 */
export function formatSuccess({ elapsedMs, url, platform = 'ios' }) {
  const store = storeName(platform);
  const afterwards =
    String(platform).toLowerCase() === 'android'
      ? 'Play still processes the bundle afterwards and can reject it there.'
      : 'Apple still validates the binary afterwards and can return it as Invalid Binary.';
  return [
    `Submission finished in ${formatElapsed(elapsedMs)} - ${store} accepted the upload.`,
    `That is the UPLOAD, not the review. ${afterwards}`,
    `Check the build in ${store} before calling the release done.`,
    url ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The `eas submit:view --json` payload goes to stdout and its chatter to
 * stderr, but a login/proxy notice can still reach stdout. Take the outermost
 * JSON object in the stream rather than assuming the whole of stdout parses.
 */
export function parseSubmissionJson(stdout) {
  const text = stripAnsi(stdout).trim();
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
