/**
 * Voting "Yes" on a bill must actually enact it (2026-08-23).
 *
 * The `policy_voting` weekly event promised "Vote Yes (Will Pass)" and set
 * `effects.policy` — the one politics effect the DROPPED-effects fix in
 * resolveEvent missed. The bill was never appended to `policiesEnacted`, so
 * its ongoing effects (inflation, education cost, healthcare, transportation)
 * never applied: a one-off approval bump and a dead law, forever.
 */
import fs from 'fs';
import path from 'path';
import { POLICIES } from '@/lib/politics/policies';
import { eventTemplates } from '@/lib/events/engine';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const repoRoot = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repoRoot, 'contexts/game/GameActionsContext.tsx'), 'utf8');

describe('resolveEvent handles effects.policy', () => {
  it('appends the bill and recomputes the aggregate with the shared helper', () => {
    expect(src).toMatch(/effects\.policy && effectsAffordable/);
    expect(src).toMatch(/policiesEnacted: enacted/);
    expect(src).toMatch(/activePolicyEffects: calculateActivePolicyEffects\(enacted\)/);
  });

  it('dedups - a bill cannot be enacted twice by the same event', () => {
    expect(src).toMatch(/!\(politicsBase\.policiesEnacted \|\| \[\]\)\.includes\(effects\.policy\)/);
  });
});

describe('the event producer still emits real policy ids', () => {
  it('every POLICIES id is non-empty (the enactment target must resolve)', () => {
    expect(POLICIES.length).toBeGreaterThan(0);
    for (const p of POLICIES) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The vote's RESULT decides the law, not the player's button (2026-10-17).
 *
 * `policy` rode on Vote Yes unconditionally, so "Vote Yes (Will Fail)" enacted
 * the bill anyway, and a bill the copy said would "Pass Anyway" over a No vote
 * or an abstention never reached `policiesEnacted`.
 */
describe('policy_voting: the outcome follows willPass', () => {
  const template = eventTemplates.find((t) => t.id === 'policy_voting')!;

  const votes = Array.from({ length: 120 }, (_, i) => {
    const base = createTestGameState({});
    const state = createTestGameState({
      weeksLived: 200 + i,
      politics: { ...base.politics!, careerLevel: 6, party: 'democratic', policiesEnacted: [] },
    });
    return template.generate(state);
  });
  const passing = votes.filter((e) => e.choices.find((c) => c.id === 'vote_yes')!.text.includes('(Will Pass)'));
  const failing = votes.filter((e) => e.choices.find((c) => c.id === 'vote_yes')!.text.includes('(Will Fail)'));

  it('the sample sees both outcomes (so neither branch is vacuous)', () => {
    expect(passing.length).toBeGreaterThan(0);
    expect(failing.length).toBeGreaterThan(0);
  });

  it('a failing bill is never enacted, whatever the vote', () => {
    for (const e of failing) {
      for (const c of e.choices) expect(c.effects.policy).toBeUndefined();
    }
  });

  it('a passing bill is enacted on every choice; only Yes earns party standing', () => {
    for (const e of passing) {
      const yes = e.choices.find((c) => c.id === 'vote_yes')!;
      expect(yes.effects.policy).toBeTruthy();
      expect(yes.effects.policyPassedWithoutPlayer).toBeUndefined();
      for (const id of ['vote_no', 'abstain']) {
        const c = e.choices.find((x) => x.id === id)!;
        expect(c.effects.policy).toBe(yes.effects.policy);
        expect(c.effects.policyPassedWithoutPlayer).toBe(true);
        expect(c.text).toContain('(Will Pass Anyway)');
      }
    }
  });

  it('the resolver withholds party standing for a bill the player did not back', () => {
    expect(src).toMatch(/hasPartyMachine\(politicsBase\.party\) && !effects\.policyPassedWithoutPlayer/);
  });
});
