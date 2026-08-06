/**
 * `autoContribute` finally has a writer.
 *
 * `contexts/game/actions/weekly/applySavingsGoals.ts` has swept
 * `goal.autoContribute` from a real source every week since it shipped, wired
 * into the tick, with its own suite proving asset conservation and idempotent
 * completion — and **nothing in the repo could ever set the field**.
 * `createSavingsGoal` did not accept it and neither goal-creation modal
 * collected it, so the sweep ran over `undefined` forever.
 *
 * Same reader-without-writer class as `banking.taxDueThisYear`, the journal,
 * and the legacy shop. No migration: the field is optional and an absent value
 * already means "manual only".
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const readCode = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

describe('the action accepts an auto-contribution', () => {
  const code = readCode('contexts/game/actions/BankingActions.ts');

  it('createSavingsGoal takes autoContribute', () => {
    expect(code).toMatch(/autoContribute\?: number;/);
  });

  it('passes it through to addSavingsGoal', () => {
    expect(code).toMatch(/autoContribute:/);
  });

  it('clamps a negative or non-finite value rather than storing it', () => {
    // The sweep floors at 0, but a negative would read as a withdrawal target
    // to any future consumer.
    expect(code).toMatch(/Math\.max\(0, Math\.round\(goal\.autoContribute\)\)/);
    expect(code).toMatch(/Number\.isFinite\(goal\.autoContribute\)/);
  });

  it('omits the field entirely when not supplied', () => {
    // Storing 0 instead of undefined would be harmless today but writes a value
    // into every save that never asked for one.
    expect(code).toMatch(/:\s*undefined/);
  });
});

describe('both banks collect it', () => {
  it.each([
    ['components/computer/AdvancedBankApp.tsx', 'Bank Pro'],
    ['components/mobile/BankApp.tsx', 'phone Bank'],
  ])('%s has the auto-contribute step', (rel) => {
    const code = readCode(rel);
    expect(code).toMatch(/autoGoalPick/);
    expect(code).toMatch(/autoContribute: weekly/);
  });

  it.each([
    'components/computer/AdvancedBankApp.tsx',
    'components/mobile/BankApp.tsx',
  ])('%s still allows a manual-only goal', (rel) => {
    // Closing the second step must CREATE the goal without a sweep — requiring
    // the player to type 0 to opt out would be a worse flow than before.
    const code = readCode(rel);
    const close = code.slice(code.indexOf('onClose={() => {', code.indexOf('autoGoalPick')));
    expect(close).toMatch(/createSavingsGoal\(setGameState, \{/);
    expect(close.slice(0, close.indexOf('}}'))).not.toMatch(/autoContribute/);
  });
});

describe('the sweep that consumes it is still wired', () => {
  it('the weekly tick still calls applySavingsGoals', () => {
    const tick = readCode('contexts/game/GameActionsContext.tsx');
    expect(tick).toMatch(/applySavingsGoals\(\{/);
  });

  it('and still reads the field', () => {
    const sweep = readCode('contexts/game/actions/weekly/applySavingsGoals.ts');
    expect(sweep).toMatch(/goal\.autoContribute/);
  });
});
