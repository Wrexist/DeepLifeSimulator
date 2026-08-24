/**
 * The release workflows' submit steps, pinned.
 *
 * `eas submit` waits for the submission by default. The three local-build
 * workflows deliberately turn that off (`--no-wait`) and replace it with
 * scripts/wait-for-eas-submission.mjs, which polls `eas submit:view --json` and
 * fails the job on ERRORED/CANCELED. That trade is only safe as a PAIR:
 *
 *   --no-wait WITHOUT the watch = the job goes green the instant the submission
 *   is SCHEDULED, so a binary Apple rejects reports as a passing release. That
 *   is the exact failure tasks/lessons.md (2026-08-05) argued against, and it
 *   is one deleted step away at any time.
 *
 * A comment saying "these must stay together" is not a guarantee; this file is.
 * It reads the workflows as text rather than through a YAML parser on purpose —
 * js-yaml is only present transitively here, and a test that a dependency
 * hoist can silently break is not a gate.
 */

import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW_DIR = path.join(__dirname, '../../.github/workflows');
const WATCHER = 'scripts/wait-for-eas-submission.mjs';

const workflows = fs
  .readdirSync(WORKFLOW_DIR)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => ({ name, text: fs.readFileSync(path.join(WORKFLOW_DIR, name), 'utf8') }));

/**
 * Split a workflow into its jobs by indentation: a job header is the only thing
 * at exactly two spaces under `jobs:`. Steps of a job all live inside its block,
 * which is what "the same job" has to mean for the pairing rule below.
 */
function jobsOf(text: string): { name: string; body: string }[] {
  // Comment lines are dropped first, for two reasons that both bite: these
  // workflows discuss `eas submit` at length in prose (a comment is not an
  // invocation), and a job's leading comment block indents at the same level as
  // the previous job's steps, so it would otherwise be attributed to the job
  // above it.
  const lines = text.split('\n').filter((line) => !/^\s*#/.test(line));
  const start = lines.findIndex((line) => line === 'jobs:');
  if (start === -1) return [];
  const jobs: { name: string; body: string[] }[] = [];
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      jobs.push({ name: header[1], body: [] });
      continue;
    }
    if (/^\S/.test(line) && line.trim() !== '') break; // back to top level
    jobs[jobs.length - 1]?.body.push(line);
  }
  return jobs.map((job) => ({ name: job.name, body: job.body.join('\n') }));
}

const submitJobs = workflows.flatMap(({ name, text }) =>
  jobsOf(text)
    .filter((job) => /\beas submit\b/.test(job.body))
    .map((job) => ({ workflow: name, job: job.name, body: job.body }))
);

describe('the workflows that submit builds', () => {
  it('finds the submit jobs at all (a rename must not quietly empty this suite)', () => {
    // Without this, deleting every submit step would make the suite below pass
    // vacuously — the classic way a guard stops guarding.
    expect(submitJobs.length).toBeGreaterThanOrEqual(3);
    expect(new Set(submitJobs.map((entry) => entry.workflow)).size).toBeGreaterThanOrEqual(3);
  });

  it.each(submitJobs.map((entry) => [`${entry.workflow} :: ${entry.job}`, entry] as const))(
    '%s schedules with --no-wait and watches the result',
    (_label, entry) => {
      expect(entry.body).toContain('--no-wait');
      // The pairing. Removing the watch step leaves a release that reports
      // green on "scheduled" and says nothing about "rejected".
      expect(entry.body).toContain(WATCHER);
    }
  );

  it.each(submitJobs.map((entry) => [`${entry.workflow} :: ${entry.job}`, entry] as const))(
    '%s does not let tee swallow a failed submit',
    (_label, entry) => {
      // `eas submit ... | tee log` exits with tee's status, which is 0 even
      // when eas failed. GitHub's default shell for `run:` is `bash -e`, NOT
      // `-o pipefail`, so this has to be set explicitly.
      if (!/\|\s*tee\b/.test(entry.body)) return;
      expect(entry.body).toContain('set -o pipefail');
    }
  );
});

/** Split a job body into its steps. A step starts at `      - ` and owns every
 *  line until the next one, so a step's `if:` can be read as ITS OWN. */
function stepsOf(jobBody: string): string[] {
  const steps: string[][] = [];
  for (const line of jobBody.split('\n')) {
    if (/^ {6}- /.test(line)) steps.push([line]);
    else if (steps.length) steps[steps.length - 1].push(line);
  }
  return steps.map((step) => step.join('\n'));
}

const watcherSteps = submitJobs.flatMap((entry) =>
  stepsOf(entry.body)
    .filter((step) => step.includes(WATCHER) && !step.includes('--link-only'))
    .map((step) => ({ ...entry, step }))
);

describe('the watch step that carries the release signal', () => {
  it('is present once per submitting job', () => {
    expect(watcherSteps.length).toBe(submitJobs.length);
  });

  it.each(watcherSteps.map((entry) => [`${entry.workflow} :: ${entry.job}`, entry] as const))(
    '%s guards the watch on its OWN if:, with both conditions',
    (_label, entry) => {
      const condition = entry.step.split('\n').find((line) => /^\s*if:/.test(line));
      expect(condition).toBeDefined();
      // A custom `if:` REPLACES the implicit success() check on a step. Without
      // it, a FAILED submit is still followed by the watch - which then finds
      // the previous run's submission and reports its outcome as this one's.
      expect(condition).toContain('success()');
      // Read off the step itself rather than off any matching line in the file:
      // the condition that matters is the one attached to THIS step.
      expect(condition).toContain('inputs.wait_for_submission');
    }
  );
});

describe('the wait_for_submission input', () => {
  /** The input's own block: from its key to the start of the next key at the same indent. */
  const inputBlock = (text: string): string | null => {
    const start = text.indexOf('      wait_for_submission:');
    if (start === -1) return null;
    const rest = text.slice(start + 1);
    const end = rest.search(/\n {6}[A-Za-z_]+:/);
    return end === -1 ? rest : rest.slice(0, end);
  };

  const submittingWorkflows = [...new Set(submitJobs.map((entry) => entry.workflow))];

  it.each(submittingWorkflows)('%s declares it, defaulting to true', (name) => {
    // The gap the rest of this file did not cover: every step above can stay
    // exactly as written while `default: false` quietly turns the watch - and
    // with it the whole red-on-rejection signal - off for every release.
    const block = inputBlock(workflows.find((workflow) => workflow.name === name)!.text);
    expect(block).not.toBeNull();
    expect(block).toMatch(/default:\s*true/);
  });
});

describe('the watcher the workflows call', () => {
  it('exists at the path they name', () => {
    expect(fs.existsSync(path.join(__dirname, '../..', WATCHER))).toBe(true);
  });

  it('is invoked with a platform, so its store-specific wording is right', () => {
    for (const entry of submitJobs) {
      const invocations = entry.body.split(WATCHER).slice(1);
      for (const invocation of invocations) {
        expect(invocation).toMatch(/--platform (ios|android)/);
      }
    }
  });
});
