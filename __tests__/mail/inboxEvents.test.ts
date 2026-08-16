/**
 * The inbox pack — post that is not a bill, a summons or a scam.
 *
 * The pack exists to fix a RATIO, not a rate: every decision the mail app could
 * previously put in front of the player wanted money or wanted an answer to
 * something unpleasant. So the assertions here are mostly about the pack being
 * genuinely reachable and genuinely different, because a pack that is authored,
 * registered, and then never selected is the failure mode this repo keeps
 * producing.
 *
 * Four things have to hold together for one of these to reach the player, and
 * they live in four different files: the template is registered in the engine,
 * its id is in `LETTER_EVENT_IDS`, `letterFromEvent` has an envelope for it,
 * and its passive choice is last (that is the one a lapsed letter takes). Any
 * one of them missing degrades silently — the letter simply never arrives, or
 * arrives from "Correspondence", or resolves to the wrong choice when ignored.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import { eventTemplates } from '@/lib/events/engine';
import { inboxEventTemplates } from '@/lib/events/inboxEvents';
import { LETTER_EVENT_IDS, routeEvents } from '@/lib/events/routing';
import { letterFromEvent } from '@/lib/mail/letters';
import type { GameState } from '@/contexts/game/types';

const INBOX_IDS = inboxEventTemplates.map((t) => t.id);

/** A well-off, well-known adult — passes every condition in the pack. */
function eligible(): GameState {
  const s = createTestGameState({ weeksLived: 1200 });
  s.stats.money = 60_000;
  s.stats.reputation = 60;
  s.bankSavings = 40_000;
  s.date = { ...s.date, age: 42 };
  return s;
}

describe('the inbox pack is wired end to end', () => {
  it('registers every template with the engine', () => {
    const registered = new Set(eventTemplates.map((t) => t.id));
    expect(INBOX_IDS.filter((id) => !registered.has(id))).toEqual([]);
  });

  it('routes every one of them to mail rather than the blocking modal', () => {
    expect(INBOX_IDS.filter((id) => !LETTER_EVENT_IDS.has(id))).toEqual([]);
  });

  it('gives every one of them a real envelope, not the generic fallback', () => {
    for (const template of inboxEventTemplates) {
      const event = routeEvents([template.generate(eligible())], 300)[0];
      const letter = letterFromEvent(event, 300)!;

      expect(letter).not.toBeNull();
      // 'Correspondence' is the FALLBACK sender in lib/mail/letters.ts — a
      // letter arriving from it means the frame table was never updated.
      expect(letter.senderName).not.toBe('Correspondence');
      expect(letter.senderEmail).toMatch(/@/);
      expect(letter.subject.length).toBeGreaterThan(0);
      expect(letter.preview.length).toBeGreaterThan(0);
    }
  });

  it('never claims the verified badge — that is reserved for the bank, employer and state', () => {
    for (const template of inboxEventTemplates) {
      const event = routeEvents([template.generate(eligible())], 300)[0];
      expect(letterFromEvent(event, 300)!.verified).toBeUndefined();
    }
  });

  it('carries a decision with a deadline, and lapses to the passive choice', () => {
    for (const template of inboxEventTemplates) {
      const generated = template.generate(eligible());
      const event = routeEvents([generated], 300)[0];
      const decision = letterFromEvent(event, 300)!.decision!;

      expect(decision.choices.length).toBeGreaterThanOrEqual(2);
      expect(decision.expiresAtWeek).toBeGreaterThan(300);
      // Convention `letterFromEvent` depends on: the do-nothing option is last.
      const last = generated.choices[generated.choices.length - 1];
      expect(decision.lapseChoiceId).toBe(last.id);
      expect(decision.resolver).toEqual({ kind: 'event', eventId: template.id });
    }
  });
});

describe('the pack is the non-adversarial half, by construction', () => {
  it('leaves the player better off on at least one axis in every letter', () => {
    // The point of the pack. A letter whose every option is a cost is a bill,
    // and the mail app already had plenty of those.
    for (const template of inboxEventTemplates) {
      const choices = template.generate(eligible()).choices;
      const hasUpside = choices.some((c) => {
        const stats = c.effects.stats ?? {};
        return (
          (c.effects.money ?? 0) > 0 ||
          Object.values(stats).some((v) => typeof v === 'number' && v > 0) ||
          (c.effects.karma?.amount ?? 0) > 0
        );
      });
      expect({ id: template.id, hasUpside }).toEqual({ id: template.id, hasUpside: true });
    }
  });

  it('makes doing nothing a real choice rather than the best one', () => {
    // Every lapse option is neutral or slightly negative — never the biggest
    // upside on the letter, or the whole decision is theatre.
    for (const template of inboxEventTemplates) {
      const choices = template.generate(eligible()).choices;
      const passive = choices[choices.length - 1];
      const passiveHappiness = passive.effects.stats?.happiness ?? 0;

      expect({ id: template.id, money: passive.effects.money ?? 0 }).toEqual({
        id: template.id,
        money: 0,
      });
      expect(passiveHappiness).toBeLessThanOrEqual(0);
    }
  });

  it('is deterministic — the same state generates the same letter twice', () => {
    // These templates take no rolls, so this is a guard against someone adding
    // Math.random() to one later: the mail generator runs inside a
    // setGameState updater React 19 may invoke twice.
    for (const template of inboxEventTemplates) {
      const state = eligible();
      expect(template.generate(state)).toEqual(template.generate(state));
    }
  });
});
