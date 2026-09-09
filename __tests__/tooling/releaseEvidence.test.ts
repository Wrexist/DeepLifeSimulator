import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { validateEvidenceHistory } = require('../../scripts/lib/releaseEvidence.cjs');

describe('release evidence provenance', () => {
  let cwd: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const queue = (commit: string) => ({ packages: [{ id: 'R01', evidence: [{ commit }] }] });
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'release-evidence-'));
    git('init');
    git('config', 'user.name', 'Evidence test');
    git('config', 'user.email', 'test@example.invalid');
    git('commit', '--allow-empty', '-m', 'baseline');
  });
  afterEach(() => rmSync(cwd, { recursive: true, force: true }));
  it('accepts candidate and ancestor evidence', () => {
    const ancestor = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'candidate');
    expect(validateEvidenceHistory(queue(ancestor), { cwd })).toEqual([]);
    expect(validateEvidenceHistory(queue(git('rev-parse', 'HEAD')), { cwd })).toEqual([]);
  });
  it('rejects a plausible hash that was never published', () => {
    expect(validateEvidenceHistory(queue('14858aa'), { cwd }).join(' ')).toMatch(/unavailable/);
  });
  it('rejects real commits from an unrelated branch', () => {
    const candidate = git('rev-parse', 'HEAD');
    git('checkout', '--orphan', 'unrelated');
    git('commit', '--allow-empty', '-m', 'foreign');
    expect(validateEvidenceHistory(queue(git('rev-parse', 'HEAD')), { cwd, candidate }).join(' ')).toMatch(/not a proven ancestor/);
  });
  it('does not treat absent shallow history as verified', () => {
    const ancestor = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'candidate');
    const shallow = join(cwd, 'shallow');
    git('clone', '--depth=1', `file://${cwd}`, shallow);
    expect(validateEvidenceHistory(queue(ancestor), { cwd: shallow }).join(' ')).toMatch(/fetch full history/);
  });
  it('rejects invalid references and an unavailable candidate', () => {
    expect(validateEvidenceHistory(queue('--help'), { cwd }).join(' ')).toMatch(/invalid evidence/);
    expect(validateEvidenceHistory(queue('14858aa'), { cwd, candidate: 'missing' }).join(' ')).toMatch(/Candidate commit unavailable/);
  });
});
