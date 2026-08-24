/**
 * The defensive half: threads, the breach notice, and the two levers that push
 * fraud risk DOWN.
 *
 * Until this existed every input to `scamRisk` pushed it up — dark-web trading,
 * heat, wealth — so the drawer reported a number the player could read and
 * never touch. A risk you can see and cannot act on is a status bar, not a
 * mechanic. These assert that the levers exist, cost something, and are visible.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import { scamRisk } from '@/lib/mail/scam';
import {
  REPORTS_FOR_VIGILANCE,
  SHIELD_WEEKS,
  breachNotice,
  extortionDemand,
  protections,
  riskMultiplier,
  shieldActive,
  shieldCost,
} from '@/lib/mail/security';
import {
  applyExtortion,
  applyRecruiterLeverage,
  applySecurityShield,
} from '@/lib/mail/resolve';
import { chooseMailDecision, reportMailPhishing } from '@/contexts/game/actions/MailActions';
import { getMailState } from '@/lib/mail/state';
import { RAISE_PREMIUM_CAP } from '@/lib/careers/raisePremium';
import type { GameState, MailMessage } from '@/contexts/game/types';

function harness(initial: GameState) {
  let state = initial;
  return {
    setGameState: (u: (prev: GameState) => GameState) => {
      state = u(state);
    },
    get: () => state,
  };
}

/** A player who has actually used the dark web — the only one who gets warned. */
const exposed = (cash = 20_000): GameState => {
  const s = createTestGameState({ weeksLived: 200 });
  s.stats.money = cash;
  s.darkWeb = { ...(s.darkWeb ?? {}), playerReputation: 25, heat: 20 } as never;
  return s;
};

describe('the breach notice - a warning, not a trap', () => {
  it('reaches someone who has used the dark web', () => {
    const notice = breachNotice(exposed(), 197);
    expect(notice).not.toBeNull();
    expect(notice!.decision!.resolver.kind).toBe('securityShield');
  });

  it('is NEVER sent to someone who has not', () => {
    const clean = createTestGameState({ weeksLived: 200 });
    expect(breachNotice(clean, 197)).toBeNull();
  });

  it('comes from a verified sender', () => {
    // Deliberate. The shape of this message is identical to a phish, so if the
    // only offer of protection were fraudulent the lesson would be "never act"
    // — the opposite of a mechanic. The fraudulent lookalike lives in scam.ts.
    expect(breachNotice(exposed(), 197)!.verified).toBe(true);
  });

  it('is not sent to someone already protected', () => {
    const shielded = exposed();
    shielded.mail = { messages: [], shieldUntilWeek: 300 };
    expect(breachNotice(shielded, 197)).toBeNull();
  });
});

describe('rotating credentials', () => {
  it('charges, and holds for the stated window', () => {
    const state = exposed(20_000);
    const cost = shieldCost(state);
    const { state: next } = applySecurityShield(state, 'rotate', cost, SHIELD_WEEKS, 200);

    expect(next.stats.money).toBe(20_000 - cost);
    expect(shieldActive(next, 200)).toBe(true);
    expect(shieldActive(next, 200 + SHIELD_WEEKS)).toBe(true);
    expect(shieldActive(next, 200 + SHIELD_WEEKS + 1)).toBe(false);
  });

  it('is refused when it cannot be afforded, and charges nothing', () => {
    const broke = exposed(10);
    const { state, outcome } = applySecurityShield(broke, 'rotate', 500, SHIELD_WEEKS, 200);
    expect(state).toBe(broke);
    expect(outcome).toMatch(/costs/i);
  });

  it('actually lowers the risk the drawer reports', () => {
    const before = scamRisk(exposed(), 200).chance;

    const shielded = exposed();
    shielded.mail = { messages: [], shieldUntilWeek: 212 };
    const after = scamRisk(shielded, 200).chance;

    expect(after).toBeLessThan(before);
    expect(protections(shielded, 200).join(' ')).toMatch(/rotated/i);
  });

  it('stops helping once it expires', () => {
    const expired = exposed();
    expired.mail = { messages: [], shieldUntilWeek: 199 };
    expect(riskMultiplier(expired, 200)).toBe(1);
  });
});

describe('reporting phishing is the free lever', () => {
  it('counts every report, and pays off at the threshold', () => {
    const state = exposed();
    const messages: MailMessage[] = Array.from({ length: REPORTS_FOR_VIGILANCE }, (_, i) => ({
      id: `m${i}`,
      senderName: 'X',
      senderEmail: 'x@y.com',
      subject: 'S',
      preview: '',
      body: '',
      atWeek: 200,
      read: false,
      starred: false,
      folder: 'inbox' as const,
      category: 'primary' as const,
    }));
    state.mail = { messages };
    const h = harness(state);

    for (let i = 0; i < REPORTS_FOR_VIGILANCE; i += 1) {
      reportMailPhishing(h.setGameState, `m${i}`);
    }

    expect(getMailState(h.get()).reportsMade).toBe(REPORTS_FOR_VIGILANCE);
    expect(riskMultiplier(h.get(), 200)).toBeLessThan(1);
    expect(protections(h.get(), 200).join(' ')).toMatch(/reports filed/i);
  });

  it('never counts the same message twice', () => {
    const state = exposed();
    state.mail = {
      messages: [
        {
          id: 'm1',
          senderName: 'X',
          senderEmail: 'x@y.com',
          subject: 'S',
          preview: '',
          body: '',
          atWeek: 200,
          read: false,
          starred: false,
          folder: 'inbox',
          category: 'primary',
        },
      ],
    };
    const h = harness(state);

    reportMailPhishing(h.setGameState, 'm1');
    reportMailPhishing(h.setGameState, 'm1');

    // The second call is a no-op because the message is already in Spam, so the
    // patch returns `prev` and the counter is not touched.
    expect(getMailState(h.get()).reportsMade).toBe(1);
  });
});

describe('recruiter leverage - an existing lever, reached a different way', () => {
  const employed = (performance: number): GameState =>
    createTestGameState({
      weeksLived: 300,
      currentJob: 'tech',
      careers: [
        {
          id: 'tech',
          levels: [{ name: 'Engineer', salary: 1200 }],
          level: 0,
          description: '',
          requirements: {} as never,
          progress: 0,
          applied: true,
          accepted: true,
          performance,
        },
      ],
    });

  it('is a certainty when you are worth keeping, and spends the raise window', () => {
    const { state, outcome } = applyRecruiterLeverage(employed(70), 'tech', 'leverage', 300);
    const career = state.careers.find((c) => c.id === 'tech')!;

    expect(career.raiseMultiplier).toBeGreaterThan(1);
    // Same ceiling as the raise ladder - this must not be a second pay lever
    // that can stack past the cap.
    expect(career.raiseMultiplier).toBeLessThanOrEqual(RAISE_PREMIUM_CAP);
    // The cooldown is consumed: you cannot leverage AND ask in the same window.
    expect(career.lastRaiseWeeksLived).toBe(300);
    expect(outcome).toMatch(/matched/i);
  });

  it('is called as a bluff below the performance floor, and draws a warning', () => {
    const { state, outcome } = applyRecruiterLeverage(employed(20), 'tech', 'leverage', 300);
    const career = state.careers.find((c) => c.id === 'tech')!;

    expect(career.warningsReceived).toBe(1);
    expect(career.raiseMultiplier).toBeUndefined();
    expect(outcome).toMatch(/called it/i);
  });

  it('replies in the thread either way, so the conversation is visible', () => {
    const won = applyRecruiterLeverage(employed(70), 'tech', 'leverage', 300);
    const lost = applyRecruiterLeverage(employed(20), 'tech', 'leverage', 300);

    for (const result of [won, lost]) {
      const replies = getMailState(result.state).messages;
      expect(replies).toHaveLength(1);
      expect(replies[0].threadId).toBe('recruiter-tech');
      expect(replies[0].subject).toMatch(/^Re:/);
    }
  });

  it('does nothing for someone who no longer works there', () => {
    const gone = employed(70);
    gone.currentJob = undefined;
    const { state } = applyRecruiterLeverage(gone, 'tech', 'leverage', 300);
    expect(state).toBe(gone);
  });
});

describe('extortion - a real threat, not a scam', () => {
  it('is only sent at high heat', () => {
    const cool = exposed();
    cool.darkWeb = { ...(cool.darkWeb ?? {}), heat: 10 } as never;
    expect(extortionDemand(cool, 191)).toBeNull();

    const hot = exposed();
    hot.darkWeb = { ...(hot.darkWeb ?? {}), heat: 60 } as never;
    expect(extortionDemand(hot, 191)).not.toBeNull();
  });

  it('carries no scam metadata - refusing it has real consequences', () => {
    const hot = exposed();
    hot.darkWeb = { ...(hot.darkWeb ?? {}), heat: 60 } as never;
    const demand = extortionDemand(hot, 191)!;
    expect(demand.scam).toBeUndefined();
    expect(demand.decision!.lapseChoiceId).toBe('refuse');
  });

  it('paying costs money; refusing costs reputation and adds heat', () => {
    const hot = exposed(50_000);
    hot.darkWeb = { ...(hot.darkWeb ?? {}), heat: 60 } as never;
    hot.stats.reputation = 40;

    const paid = applyExtortion(hot, 'pay', 4000);
    expect(paid.state.stats.money).toBe(46_000);

    const refused = applyExtortion(hot, 'refuse', 4000);
    expect(refused.state.stats.money).toBe(50_000);
    expect(refused.state.stats.reputation).toBeLessThan(40);
    expect(refused.state.darkWeb!.heat).toBeGreaterThan(60);
  });

  it('charges once when the pay button is double-tapped', () => {
    const hot = exposed(50_000);
    hot.darkWeb = { ...(hot.darkWeb ?? {}), heat: 60 } as never;
    const demand = extortionDemand(hot, 191)!;
    hot.mail = { messages: [demand] };
    const h = harness(hot);

    chooseMailDecision(h.get(), h.setGameState, demand.id, 'pay', () => undefined);
    const afterFirst = h.get().stats.money;
    chooseMailDecision(h.get(), h.setGameState, demand.id, 'pay', () => undefined);

    expect(h.get().stats.money).toBe(afterFirst);
    expect(afterFirst).toBeLessThan(50_000);
  });
});
