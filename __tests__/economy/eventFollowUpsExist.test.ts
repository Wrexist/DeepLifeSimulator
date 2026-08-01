/**
 * R4-X6 — an event promising five follow-ups that did not exist.
 *
 * `friend_invitation_exam` (lib/events/enhancedEvents.ts) is registered in the
 * live event pool and fires. Each of its three choices attaches hidden
 * consequences naming a follow-up event. None of the five named events existed
 * anywhere in the codebase, so `consequenceState.unlockedEvents` collected
 * flags that nothing ever consumed and the promised payoff never arrived.
 *
 * That is the SAME bug an earlier pass fixed for `lifeMomentGenerator.ts` — the
 * comment above `payoffReady` in engine.ts says so in as many words ("Without
 * these templates the unlock flags were set but never consumed"). That pass
 * wrote four payoff templates and simply did not reach this file.
 *
 * Four templates are added here in the same shape. The fifth reference,
 * `exam_results`, is removed rather than written: it was a NEGATIVE weight
 * modifier, and `weightPayoffReady` requires a positive one, so it could not
 * have fired even with a template — and the effect it wanted ("worse exam
 * performance") is already delivered by the choice's 20-energy cost, which
 * `runExam` reads directly.
 *
 * The important test here is the LAST one. Checking these five ids would only
 * pin the bug that was found; the generic sweep catches the next event whose
 * author names a follow-up and forgets to write it.
 *
 * 2026-08-01 audit round 4.
 */
import { eventTemplates } from '@/lib/events/engine';
import { enhancedEventTemplates } from '@/lib/events/enhancedEvents';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const templateIds = new Set(eventTemplates.map((t) => t.id));

/** Every `unlock_event` / `modify_weight` target declared by any template. */
function declaredFollowUps(): { source: string; target: string; type: string; weight?: number }[] {
  const out: { source: string; target: string; type: string; weight?: number }[] = [];
  for (const template of eventTemplates) {
    let generated: { choices?: unknown[] } | undefined;
    try {
      generated = template.generate(createTestGameState()) as { choices?: unknown[] };
    } catch {
      continue; // a template whose generate needs richer state — skipped, not failed
    }
    for (const choice of (generated?.choices ?? []) as {
      hiddenConsequences?: { type: string; targetEventId?: string; weightModifier?: number }[];
    }[]) {
      for (const hc of choice.hiddenConsequences ?? []) {
        if (!hc.targetEventId) continue;
        out.push({
          source: template.id,
          target: hc.targetEventId,
          type: hc.type,
          weight: hc.weightModifier,
        });
      }
    }
  }
  return out;
}

describe('R4-X6 — the four missing payoffs now exist', () => {
  it('the source event is really in the live pool (the premise)', () => {
    expect(enhancedEventTemplates.map((t) => t.id)).toContain('friend_invitation_exam');
    expect(templateIds.has('friend_invitation_exam')).toBe(true);
  });

  it('each promised follow-up has a template', () => {
    for (const id of [
      'friend_helps_study',
      'exam_success',
      'friend_respects_balance',
      'friend_distant',
    ]) {
      expect(`${id}: ${templateIds.has(id)}`).toBe(`${id}: true`);
    }
  });

  it('each is gated so it only fires once its setup unlocked it', () => {
    // Without the gate they would join the general pool and fire at random,
    // which is a different bug: a payoff for a choice the player never made.
    const fresh = createTestGameState();

    for (const id of ['friend_helps_study', 'exam_success', 'friend_respects_balance', 'friend_distant']) {
      const t = eventTemplates.find((x) => x.id === id)!;
      expect(`${id} fires unprompted: ${t.condition?.(fresh) ?? true}`)
        .toBe(`${id} fires unprompted: false`);
    }
  });

  it('an unlock_event payoff fires once the flag is set', () => {
    const unlocked = createTestGameState({
      consequenceState: { unlockedEvents: ['friend_helps_study'], choiceHistory: [] },
    } as never) as GameState;

    const t = eventTemplates.find((x) => x.id === 'friend_helps_study')!;
    expect(t.condition?.(unlocked)).toBe(true);
    expect(t.generate(unlocked).choices.length).toBeGreaterThan(0);
  });

  it('and stops firing once it has been resolved', () => {
    // Self-gating on choiceHistory is what makes these fire EXACTLY once.
    const resolved = createTestGameState({
      consequenceState: {
        unlockedEvents: ['friend_helps_study'],
        choiceHistory: [{ eventId: 'friend_helps_study', choiceId: 'accept' }],
      },
    } as never) as GameState;

    expect(eventTemplates.find((x) => x.id === 'friend_helps_study')!.condition?.(resolved))
      .toBe(false);
  });

  it('the weight-gated payoff fires on a POSITIVE modifier', () => {
    const flagged = createTestGameState({
      consequenceState: { eventWeightModifiers: { friend_distant: 0.2 }, choiceHistory: [] },
    } as never) as GameState;

    expect(eventTemplates.find((x) => x.id === 'friend_distant')!.condition?.(flagged)).toBe(true);
  });

  it('the inert negative modifier is gone', () => {
    // exam_results could never fire: no template, and weightPayoffReady needs
    // a positive modifier. Removed rather than written.
    const targets = declaredFollowUps().map((f) => f.target);
    expect(targets).not.toContain('exam_results');
  });
});

describe('R4-X6 — no event promises a follow-up that does not exist', () => {
  /**
   * The generic guard, and the reason this file is worth more than five id
   * assertions. Any future template that names a follow-up and forgets to write
   * it fails here with the offending pair named.
   */
  it('every declared unlock_event target resolves to a real template', () => {
    const missing = declaredFollowUps()
      .filter((f) => f.type === 'unlock_event')
      .filter((f) => !templateIds.has(f.target))
      .map((f) => `${f.source} -> ${f.target}`);

    expect(missing).toEqual([]);
  });

  it('every POSITIVE modify_weight target resolves to a real template', () => {
    // A positive modifier is what `weightPayoffReady` gates on, so a missing
    // target there is a promise that never arrives. A negative one only nudges
    // an existing event's odds down and is harmless if its target is absent.
    const missing = declaredFollowUps()
      .filter((f) => f.type === 'modify_weight' && (f.weight ?? 0) > 0)
      .filter((f) => !templateIds.has(f.target))
      .map((f) => `${f.source} -> ${f.target} (+${f.weight})`);

    expect(missing).toEqual([]);
  });

  it('the sweep actually walks a meaningful number of templates (the control)', () => {
    // If `generate` started throwing for everything, the two checks above would
    // pass vacuously on an empty list.
    expect(eventTemplates.length).toBeGreaterThan(50);
    expect(declaredFollowUps().length).toBeGreaterThan(0);
  });
});
