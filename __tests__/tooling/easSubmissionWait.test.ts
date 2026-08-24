/**
 * The submission watcher (scripts/lib/easSubmission.mjs).
 *
 * Context: `eas submit` waits for the submission by default and, while waiting,
 * prints ONE spinner line for the whole thing. A run that sat 22 minutes in
 * EAS's queue was byte-identical in the log to a wedged one. The release
 * workflows now schedule with `--no-wait` and poll `eas submit:view --json`,
 * which means two things have to hold or a release goes out unverified:
 *
 *  1. The submission id must survive being read back out of the `eas submit`
 *     transcript — including its ANSI escapes, which is where a naive parse
 *     falls over. No id, no watch, and the watch is the whole pass/fail signal
 *     (tasks/lessons.md, 2026-08-05: bare `--no-wait` reports a REJECTED
 *     binary as a green release).
 *  2. Only FINISHED may be treated as success. A status the enum does not
 *     name must never read as "fine" by omission.
 *
 * The status strings are pinned against eas-cli's SubmissionStatus GraphQL
 * enum rather than recalled — an invented value here would silently classify a
 * real failure as "still running" until the watch timed out.
 */

type EasSubmission = typeof import('../../scripts/lib/easSubmission.mjs');

let S: EasSubmission;

beforeAll(async () => {
  S = await import('../../scripts/lib/easSubmission.mjs');
});

const ESC = '\u001B';
const ID = '5b36c89f-90f7-4c12-833c-d825d634f7a3';
const URL = `https://expo.dev/accounts/isacm/projects/deeplife-simulator/submissions/${ID}`;

describe('reading the submission id back out of the eas submit transcript', () => {
  it('finds the id in the plain line eas-cli prints before the wait', () => {
    const log = ['Uploaded to EAS Submit', '', `Submission details: ${URL}`].join('\n');
    expect(S.parseSubmissionDetails(log)).toEqual({ id: ID, url: URL });
  });

  it('finds it through the colour codes the CI log actually carries', () => {
    // eas-cli dims + underlines URLs; the runner is colour-capable, so the raw
    // escape bytes end up in the piped log this is parsed from.
    const log = `Submission details: ${ESC}[2m${ESC}[4m${URL}${ESC}[24m${ESC}[22m\n`;
    expect(S.parseSubmissionDetails(log)?.id).toBe(ID);
  });

  it('does not mistake the BUILD url for the submission url', () => {
    const log = [
      'Build details: https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      `Submission details: ${URL}`,
    ].join('\n');
    expect(S.parseSubmissionDetails(log)?.id).toBe(ID);
  });

  it('returns null rather than a wrong id when the line is absent', () => {
    // The workflow falls back to --platform here. A confident wrong answer
    // would watch some other submission and report ITS outcome as this one's.
    expect(S.parseSubmissionDetails('Uploaded to EAS Submit')).toBeNull();
    expect(S.parseSubmissionDetails('')).toBeNull();
    expect(S.parseSubmissionDetails(undefined as unknown as string)).toBeNull();
  });
});

describe('stripAnsi', () => {
  it('leaves text after a literal ] alone', () => {
    // An ANSI regex whose OSC arm is not anchored on the ESC byte eats
    // everything after the first `]` in the log - which in this repo is the
    // line the submission id is on.
    expect(S.stripAnsi(`[eas] done: ${URL}`)).toBe(`[eas] done: ${URL}`);
  });

  it('removes colour sequences', () => {
    expect(S.stripAnsi(`${ESC}[32mfinished${ESC}[39m`)).toBe('finished');
  });
});

describe('status classification', () => {
  it('pins the eas-cli SubmissionStatus enum', () => {
    expect(Object.values(S.SUBMISSION_STATUS).sort()).toEqual([
      'AWAITING_BUILD',
      'CANCELED',
      'ERRORED',
      'FINISHED',
      'IN_PROGRESS',
      'IN_QUEUE',
    ]);
  });

  it('treats only FINISHED, ERRORED and CANCELED as terminal', () => {
    expect(S.isTerminal('FINISHED')).toBe(true);
    expect(S.isTerminal('ERRORED')).toBe(true);
    expect(S.isTerminal('CANCELED')).toBe(true);
    expect(S.isTerminal('IN_QUEUE')).toBe(false);
    expect(S.isTerminal('IN_PROGRESS')).toBe(false);
    expect(S.isTerminal('AWAITING_BUILD')).toBe(false);
  });

  it('calls nothing but FINISHED a success', () => {
    // The one assertion that decides whether a rejected binary can ship as a
    // green release.
    for (const status of Object.values(S.SUBMISSION_STATUS)) {
      expect(S.succeeded(status)).toBe(status === 'FINISHED');
    }
    expect(S.succeeded('SOMETHING_NEW')).toBe(false);
    expect(S.succeeded(undefined as unknown as string)).toBe(false);
  });

  it('never silently accepts a status it does not recognize', () => {
    // A future enum value must read as unknown-and-still-running, not as done.
    expect(S.isTerminal('SOMETHING_NEW')).toBe(false);
    expect(S.describeStatus('SOMETHING_NEW')).toContain('unrecognized');
  });
});

describe('poll pacing', () => {
  it('polls tightly at first, then backs off', () => {
    expect(S.pollDelayMs(0)).toBe(10_000);
    expect(S.pollDelayMs(90_000)).toBe(10_000);
    expect(S.pollDelayMs(3 * 60_000)).toBe(30_000);
    expect(S.pollDelayMs(30 * 60_000)).toBe(60_000);
  });

  it('never returns a zero or negative delay', () => {
    for (const elapsed of [-1, 0, 1, 59_999, 10 * 60_000, 6 * 60 * 60_000]) {
      expect(S.pollDelayMs(elapsed)).toBeGreaterThan(0);
    }
  });
});

describe('log throttling', () => {
  const base = { status: 'IN_QUEUE', previousStatus: 'IN_QUEUE', elapsedMs: 0, lastLoggedAtMs: 0 };

  it('logs every state change immediately', () => {
    expect(S.shouldLog({ ...base, status: 'IN_PROGRESS' })).toBe(true);
  });

  it('logs the first observation, when there is no previous status', () => {
    expect(S.shouldLog({ ...base, previousStatus: null, lastLoggedAtMs: -Infinity })).toBe(true);
  });

  it('heartbeats an unchanged state every two minutes', () => {
    // This is the actual fix for "22 minutes, 28 rows": the log must keep
    // advancing even when the status does not, or a slow submission is
    // indistinguishable from a hung runner.
    expect(S.shouldLog({ ...base, elapsedMs: 60_000, lastLoggedAtMs: 0 })).toBe(false);
    expect(S.shouldLog({ ...base, elapsedMs: 120_000, lastLoggedAtMs: 0 })).toBe(true);
  });

  it('produces a line naming both the state and what it means', () => {
    const line = S.formatProgressLine({ status: 'IN_QUEUE', elapsedMs: 8 * 60_000 + 5_000 });
    expect(line).toContain('8m05s');
    expect(line).toContain('IN_QUEUE');
    expect(line).toContain('EAS');
  });
});

describe('formatElapsed', () => {
  it('zero-pads seconds so the column stays readable', () => {
    expect(S.formatElapsed(0)).toBe('0m00s');
    expect(S.formatElapsed(65_000)).toBe('1m05s');
    expect(S.formatElapsed(22 * 60_000 + 44_000)).toBe('22m44s');
  });
});

describe('failure reporting', () => {
  it('surfaces the error code and message so the log says WHY', () => {
    const text = S.formatFailure(
      {
        status: 'ERRORED',
        error: { errorCode: 'SUBMISSION_SERVICE_IOS_UNKNOWN_ERROR', message: 'Invalid build number' },
      },
      URL
    );
    expect(text).toContain('SUBMISSION_SERVICE_IOS_UNKNOWN_ERROR');
    expect(text).toContain('Invalid build number');
    // Platform-neutral: this watcher also runs on the Android workflow, where
    // "Apple said" would be a lie.
    expect(text).not.toContain('Apple');
    expect(text).toContain(URL);
  });

  it('still names the submission when EAS reports no error detail', () => {
    const text = S.formatFailure({ status: 'CANCELED' }, URL);
    expect(text).toContain('canceled');
    expect(text).toContain(URL);
  });
});

describe('watch timeout wording', () => {
  it('says explicitly that a timeout is not a rejection', () => {
    // A red job read as "Apple rejected it" costs a rebuild, and a rebuild is
    // never free here: it mints a new CFBundleVersion.
    const text = S.formatWatchTimeout({ elapsedMs: 60 * 60_000, status: 'IN_PROGRESS', url: URL });
    expect(text).toContain('does NOT mean the submission failed');
    expect(text).toContain('60m00s');
    expect(text).toContain(URL);
  });
});

describe('parsing eas submit:view --json', () => {
  it('reads the payload', () => {
    expect(S.parseSubmissionJson('{"id":"x","status":"FINISHED"}')).toEqual({
      id: 'x',
      status: 'FINISHED',
    });
  });

  it('tolerates chatter around the payload', () => {
    const stdout = `Fetching the submission\n{"status":"IN_QUEUE"}\n`;
    expect(S.parseSubmissionJson(stdout)).toEqual({ status: 'IN_QUEUE' });
  });

  it('returns null on unparseable output instead of throwing mid-release', () => {
    expect(S.parseSubmissionJson('')).toBeNull();
    expect(S.parseSubmissionJson('not json at all')).toBeNull();
    expect(S.parseSubmissionJson('{ broken')).toBeNull();
  });
});

describe('recovering the submission link from the payload', () => {
  // The --platform fallback path has no transcript to read a URL from, and a
  // failure report with no link is one nobody can act on.
  const payload = {
    id: ID,
    app: { slug: 'deeplife-simulator', ownerAccount: { name: 'isacm' } },
  };

  it('rebuilds the same URL eas-cli prints', () => {
    expect(S.submissionUrlFrom(payload)).toBe(URL);
  });

  it('returns null rather than a broken URL when a piece is missing', () => {
    expect(S.submissionUrlFrom({ ...payload, app: undefined })).toBeNull();
    expect(S.submissionUrlFrom({ ...payload, id: undefined })).toBeNull();
    expect(S.submissionUrlFrom(null)).toBeNull();
  });
});

describe('store-specific wording', () => {
  it('names the right store per platform', () => {
    expect(S.storeName('ios')).toBe('App Store Connect');
    expect(S.storeName('IOS')).toBe('App Store Connect');
    expect(S.storeName('android')).toBe('Google Play');
    expect(S.storeName('ANDROID')).toBe('Google Play');
  });

  it('reads correctly on the Android workflow too', () => {
    // The watcher is shared with eas-build-local-android.yml; a progress line
    // telling an Android release about App Store Connect is just wrong.
    expect(S.describeStatus('IN_PROGRESS', 'android')).toContain('Google Play');
    expect(S.describeStatus('IN_PROGRESS', 'ios')).toContain('App Store Connect');
    expect(S.formatProgressLine({ status: 'FINISHED', elapsedMs: 0, platform: 'android' })).toContain(
      'Google Play'
    );
  });
});

describe('what FINISHED is allowed to claim', () => {
  it('says the upload was accepted, not the review', () => {
    // EAS finishes when the store accepts the UPLOAD. Apple validates
    // afterwards, which is where ITMS-91064 and friends surface as Invalid
    // Binary (CLAUDE.md section 9) - reading green as "shipped" is how a build
    // sits in Invalid Binary for a day.
    const text = S.formatSuccess({ elapsedMs: 12 * 60_000, url: URL, platform: 'ios' });
    expect(text).toContain('12m00s');
    expect(text).toContain('UPLOAD, not the review');
    expect(text).toContain('Invalid Binary');
    expect(text).toContain(URL);
  });

  it('uses Play wording for Android', () => {
    const text = S.formatSuccess({ elapsedMs: 0, url: null, platform: 'android' });
    expect(text).toContain('Google Play');
    expect(text).not.toContain('Invalid Binary');
  });
});

describe('the unreadable-status grace', () => {
  it('is long enough to outlast a network blip at the tightest poll cadence', () => {
    // Bounding this by ATTEMPTS instead of time is the trap: at the 10s early
    // cadence, "5 attempts" is 40 seconds, so a one-minute blip would fail a
    // release that was fine. Assert it survives at least ten of the widest
    // polls' worth of tight ones.
    expect(S.READ_FAILURE_GRACE_MS).toBeGreaterThanOrEqual(10 * S.pollDelayMs(0));
    expect(S.READ_FAILURE_GRACE_MS).toBeGreaterThanOrEqual(4 * S.pollDelayMs(30 * 60_000));
  });

  it('is shorter than a sane watch timeout, so it reports the real reason', () => {
    // If the grace outlived the timeout, an outage would be reported as "the
    // submission is taking a long time" instead of "we cannot see it".
    expect(S.READ_FAILURE_GRACE_MS).toBeLessThan(60 * 60_000);
  });

  it('leaves room for several stalled reads inside one grace period', () => {
    // A single `eas submit:view` is killed at READ_DEADLINE_MS and counted as
    // an unreadable poll. If one stalled read could consume the whole grace,
    // one hung process would fail a release; the grace is meant to absorb
    // several. Without the deadline the loop would not turn at all - no
    // heartbeat, and the watch timeout never even evaluated.
    expect(S.READ_DEADLINE_MS).toBeLessThan(S.READ_FAILURE_GRACE_MS / 2);
    // And long enough that a merely slow API call is not mistaken for a hang.
    expect(S.READ_DEADLINE_MS).toBeGreaterThanOrEqual(30_000);
  });
});
