/** Release tools must fail closed when evidence is incomplete. */
import { readFileSync } from 'fs';
import { join } from 'path';
const { validateQueue, nextPackage, browserGateFailures, REQUIRED_BROWSER_CHECKS } = require('../../scripts/lib/releaseWorkflow.cjs');

const evidence = [{ commit: '1e8c0fdf', result: 'Verified behavioral regression', references: ['tasks/release/AUDIT.md'] }];
const packet = (id: string, status = 'pending', dependsOn: string[] = []) => ({
  id, title: id, priority: 'P2', status, dependsOn, blocker: '', prompt: `tasks/release/${id}.md`, evidence: status === 'verified' ? evidence : [],
});
const queue = (packages: ReturnType<typeof packet>[]) => ({ schemaVersion: 1, repository: 'Wrexist/DeepLifeSimulator', packages });

describe('release work selection', () => {
  it('resumes active work and never selects an unmet prerequisite', () => {
    const q = queue([packet('R00', 'verified'), packet('R01', 'active', ['R00']), packet('R02', 'pending', ['R01'])]);
    expect(validateQueue(q)).toEqual([]);
    expect(nextPackage(q).id).toBe('R01');
    q.packages[1].status = 'pending';
    expect(nextPackage(q).id).toBe('R01');
  });
  it('prioritizes an eligible urgent finding over later improvements', () => {
    const q = queue([packet('R00'), { ...packet('R01'), priority: 'P1' }]);
    expect(nextPackage(q).id).toBe('R01');
  });
  it('requires proof and satisfied dependencies before calling a package verified', () => {
    const q = queue([packet('R00'), { ...packet('R01', 'verified', ['R00']), evidence: [] }]);
    expect(validateQueue(q).join(' ')).toMatch(/requires commit/);
    expect(validateQueue(q).join(' ')).toMatch(/prerequisite/);
  });
  it('rejects duplicate IDs, dependency cycles, concurrent active work and empty queues', () => {
    expect(validateQueue(queue([packet('R00'), packet('R00')])).join(' ')).toMatch(/Duplicate/);
    expect(validateQueue(queue([packet('R00', 'pending', ['R01']), packet('R01', 'pending', ['R00'])])).join(' ')).toMatch(/cycle/);
    expect(validateQueue(queue([packet('R00', 'active'), packet('R01', 'active')])).join(' ')).toMatch(/Only one/);
    expect(validateQueue(queue([]))).not.toEqual([]);
  });
  it('requires blocker details and leaves blocked work unselected', () => {
    const p = { ...packet('R00', 'blocked'), blocker: 'Native SDK evidence unavailable' };
    expect(nextPackage(queue([p]))).toBeNull();
    expect(validateQueue(queue([{ ...p, blocker: '' }]))).not.toEqual([]);
  });
  it('validates the actual committed queue and prompt files', () => {
    const root = join(__dirname, '../..');
    const q = JSON.parse(readFileSync(join(root, 'tasks/release/queue.json'), 'utf8'));
    expect(validateQueue(q)).toEqual([]);
    for (const p of q.packages) expect(readFileSync(join(root, p.prompt), 'utf8')).toContain('Acceptance criteria');
  });
});

describe('browser release evidence', () => {
  const complete = () => REQUIRED_BROWSER_CHECKS.map((id: string) => ({ id, status: 'PASS' }));
  it('accepts fully reached required checks', () => expect(browserGateFailures(complete())).toEqual([]));
  it('rejects empty evidence, missing branches and unreached checks', () => {
    expect(browserGateFailures([])).not.toEqual([]);
    expect(browserGateFailures(complete().slice(1))).not.toEqual([]);
    const results = complete(); results[0].status = 'UNREACHED';
    expect(browserGateFailures(results)).toContain('A1-startup: UNREACHED');
  });
  it('rejects malformed, failed and duplicate checks', () => {
    expect(browserGateFailures([...complete(), null])).not.toEqual([]);
    expect(browserGateFailures([...complete(), complete()[0]])).not.toEqual([]);
    const results = complete(); results[0].status = 'FAIL';
    expect(browserGateFailures(results)).not.toEqual([]);
  });
  it('allows only the documented diagnostic console warning', () => {
    const results = complete(); results.find((r: { id: string }) => r.id === 'G2-console-errors').status = 'WARN';
    expect(browserGateFailures(results)).toEqual([]);
    results[0].status = 'WARN';
    expect(browserGateFailures(results)).not.toEqual([]);
  });
});
