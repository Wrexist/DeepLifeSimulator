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
