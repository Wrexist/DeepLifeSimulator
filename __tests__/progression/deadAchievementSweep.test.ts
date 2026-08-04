/**
 * The Progression screen no longer runs a sweep that does nothing.
 *
 * GP-3 is fixed: the screen reads the LIVE achievement store via
 * `useAchievements()`, because `gameState.achievements[]` ships 52 entries all
 * `completed: false` and `evaluateAchievements` is an explicitly documented
 * no-op returning `[]`.
 *
 * What survived that fix was its scaffolding. `checkAchievements()` — which
 * calls `evaluateAchievements` and discards the empty result — was still being
 * fired from a `useEffect` keyed to an `achievementSignal` string rebuilt on
 * every render, on every money/happiness/health/relationship/item/education/
 * company/week change.
 *
 * The comment above it was the real cost. It read:
 *
 *   "P2-7: depend on PRIMITIVES, not object/array references … the object deps
 *    re-ran the full achievement sweep many times per second"
 *
 * That describes tuning a sweep which no longer exists. A performance note
 * defending an optimisation for dead code is worse than no note: it tells the
 * next reader the effect is load-bearing and expensive, so they leave it alone.
 * Same failure mode as the `legacy_business` comment that asserted a bonus was
 * wired somewhere it was not.
 *
 * `checkAchievements` stays ON the context — `featureGauntlet.stress` asserts
 * it survives a minimal state, and removing it from `GameActionsContext` would
 * be a refactor of the core provider for no player benefit. Only the dead call
 * site goes. The remaining removal is tracked by the existing
 * TODO(flawless-audit) in `lib/progress/achievements.ts`.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'app', '(tabs)', 'progression.tsx'),
  'utf8',
);
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no no-op achievement sweep on the progression screen', () => {
  it('does not call checkAchievements', () => {
    expect(code).not.toMatch(/checkAchievements\(\)/);
  });

  it('does not rebuild an achievementSignal for it', () => {
    expect(code).not.toMatch(/achievementSignal/);
  });

  it('and the stale P2-7 sweep comment is gone', () => {
    // Asserted against the RAW source: this one is specifically about a
    // comment, so stripping comments would make the check vacuous.
    // NB: the original comment wrapped between "full" and "achievement", so a
    // naive one-line regex passes whether or not the comment is there — it was
    // green before the removal. Match across the wrap.
    expect(SRC).not.toMatch(/re-ran the full\s*(\/\/)?\s*achievement sweep/);
    // The label "P2-7" is deliberately NOT banned. Naming the removed
    // optimisation while explaining why it went is useful history; what must
    // not survive is the CLAIM that a sweep is running and needs tuning.
    expect(SRC).not.toMatch(/depend on PRIMITIVES, not object\/array references/);
  });

  it('still reads the LIVE achievement store (the control)', () => {
    // The point of GP-3. If this ever regresses to
    // `gameState.achievements[].completed`, the headline returns to
    // "0/42 · 0% complete" forever.
    expect(code).toMatch(/useAchievements\(\)/);
    expect(code).toMatch(/liveAchievements\.filter\(\(?a\)? => a\.claimed\)/);
    expect(code).not.toMatch(/gameState\.achievements/);
  });

  it('checkAchievements is still exported by the context (the control)', () => {
    // Only the dead CALL is removed. `featureGauntlet.stress` exercises the
    // context method, and this suite must not be read as licence to delete it.
    const ctx = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts', 'game', 'GameActionsContext.tsx'),
      'utf8',
    );
    expect(ctx).toMatch(/checkAchievements/);
  });
});
