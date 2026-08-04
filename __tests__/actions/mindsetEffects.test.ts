/**
 * R4-X1 — the Mindset system narrated effects it never applied.
 *
 * A Mindset is a headline choice: the player picks one on the onboarding Perks
 * screen, and again for each heir in the death popup. `lib/mindset/config.ts`
 * defines eleven of them with real-sounding rules ("Frugal: you save a bit
 * more", "Gambler: ±20% on every payout").
 *
 * `applyMindsetEffects` implements those rules correctly and returns both the
 * adjusted deltas AND a feedback message. But `getMindsetFeedback` returned
 * `result.feedback` alone and discarded the deltas — and its ONLY caller, the
 * street-job handler in `app/(tabs)/work.tsx`, is the only place in the entire
 * app that touches the Mindset system.
 *
 * So the game said "Frugal: You saved a bit extra (+120)" and credited nothing.
 * "Gambler: Lucky! (+340)" and credited nothing. "Frugal: Big spending hurts
 * your happiness (-1)" and took nothing. Not merely inert — actively telling
 * the player something untrue about their own save.
 *
 * `getMindsetAdjustment` now returns the adjustment alongside the message, and
 * the handler applies it in one updater. 2026-07-31 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { getMindsetAdjustment } from '@/utils/mindsetFeedback';
import { applyMindsetEffects, MINDSET_TRAITS } from '@/lib/mindset/config';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function withMindset(traitId: string, money = 10_000): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money, happiness: 50 },
    mindset: { activeTraitId: traitId, traits: [traitId] } as never,
  });
}

describe('the engine itself was never the problem', () => {
  it('applyMindsetEffects really does change the deltas (the premise)', () => {
    // If it did not, the finding would be "the rules are unimplemented", which
    // is a different and much larger fix.
    const result = applyMindsetEffects(withMindset('frugal'), { moneyDelta: 1_000 });

    expect(result.moneyDelta).toBeGreaterThan(1_000);
  });

  it('the catalogue really is player-facing', () => {
    expect(MINDSET_TRAITS.length).toBeGreaterThan(5);
  });
});

describe('getMindsetAdjustment reports the change its message describes', () => {
  it('frugal returns a positive money adjustment on a payout', () => {
    const adj = getMindsetAdjustment(withMindset('frugal'), 1_000, 0, 0);

    expect(adj.moneyAdjustment).toBe(100); // +10%
    expect(adj.feedback?.message).toMatch(/Frugal/);
    expect(adj.feedback?.type).toBe('bonus');
  });

  it('the number in the message is the number returned', () => {
    // The whole point: the toast quoted a figure that was never credited.
    const adj = getMindsetAdjustment(withMindset('frugal'), 2_500, 0, 0);
    const quoted = adj.feedback?.message?.match(/\+([\d,]+)/)?.[1]?.replace(/,/g, '');

    expect(quoted).toBeDefined();
    expect(Number(quoted)).toBe(adj.moneyAdjustment);
  });

  it('a player with no mindset gets no adjustment and no message', () => {
    const adj = getMindsetAdjustment(createTestGameState(), 1_000, 0, 0);

    expect(adj.moneyAdjustment).toBe(0);
    expect(adj.happinessAdjustment).toBe(0);
    expect(adj.feedback).toBeNull();
  });

  it('a penalty comes back as a negative adjustment, not just a warning', () => {
    // Frugal docks 1 happiness when a spend exceeds 30% of cash on hand.
    const adj = getMindsetAdjustment(withMindset('frugal', 1_000), -900, 0, 0);

    expect(adj.happinessAdjustment).toBe(-1);
    expect(adj.feedback?.type).toBe('penalty');
  });

  it('never returns NaN, whatever the engine does', () => {
    for (const trait of MINDSET_TRAITS) {
      const adj = getMindsetAdjustment(withMindset(trait.id), 1_234, 5, -3);

      expect(`${trait.id}: ${Number.isFinite(adj.moneyAdjustment)}`).toBe(`${trait.id}: true`);
      expect(`${trait.id}: ${Number.isFinite(adj.happinessAdjustment)}`).toBe(`${trait.id}: true`);
      expect(`${trait.id}: ${Number.isFinite(adj.healthAdjustment)}`).toBe(`${trait.id}: true`);
    }
  });
});

describe('the only consumer applies the adjustment instead of narrating it', () => {
  const WORK = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app', '(tabs)', 'work.tsx'),
    'utf8',
  );
  const CODE = WORK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('no longer calls the message-only helper', () => {
    expect(CODE).not.toMatch(/getMindsetFeedback/);
    expect(CODE).toMatch(/getMindsetAdjustment/);
  });

  it('writes the money and the happiness in ONE updater', () => {
    // Two updaters could interleave with a concurrent write and lose one half
    // of an effect the toast has already promised.
    expect(CODE).toMatch(/mindset\.moneyAdjustment !== 0 \|\| mindset\.happinessAdjustment !== 0/);
    expect(CODE).toMatch(/money: Math\.max\(0, \(prev\.stats\.money \?\? 0\) \+ mindset\.moneyAdjustment\)/);
    expect(CODE).toMatch(/happiness: Math\.max\(\s*\n?\s*0,\s*\n?\s*Math\.min\(100, \(prev\.stats\.happiness \?\? 0\) \+ mindset\.happinessAdjustment\),/);
  });

  it('still shows the message', () => {
    // The control: applying the effect must not have removed the feedback.
    expect(CODE).toMatch(/mindset\.feedback\?\.message/);
    expect(CODE).toMatch(/mindsetPenalty = mindset\.feedback\.type === 'penalty'/);
  });

  it('skips the write entirely when there is nothing to apply', () => {
    // A no-op setGameState on every street job would re-render the whole tree
    // for nothing.
    expect(CODE).toMatch(/if \(mindset\.moneyAdjustment !== 0 \|\| mindset\.happinessAdjustment !== 0\) \{\s*\n\s*setGameState/);
  });
});
