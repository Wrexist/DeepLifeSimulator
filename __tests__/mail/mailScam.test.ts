/**
 * The fraud mechanic: earned risk, atomic loss, and a badge that stays honest.
 *
 * The double-tap test is the one that matters most. The button being tapped is
 * designed to be tapped in a panic — "confirm within 24 hours" — which is
 * exactly the interaction most likely to be double-fired into one React batch.
 * Every other gate→grant bug in this repo's history was found in a calmer place
 * than this one.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import {
  generateScam,
  scamRisk,
  scamLossFor,
  scamWindowOpen,
  SCAM_LOSS_CAP_FRACTION,
  SCAM_WINDOW_WEEKS,
} from '@/lib/mail/scam';
import {
  actOnScamMail,
  disputeMailCharge,
  reportMailPhishing,
  DISPUTE_RECOVERY_FRACTION,
} from '@/contexts/game/actions/MailActions';
import { getMailState } from '@/lib/mail/state';
import type { GameState, MailMessage } from '@/contexts/game/types';

/** Minimal setGameState harness that applies updaters against a held state. */
function harness(initial: GameState) {
  let state = initial;
  const snap = () => ({ mail: state.mail, money: state.stats?.money ?? 0 });
  const setGameState = (updater: (prev: GameState) => GameState) => {
    state = updater(state);
  };
  return { setGameState, get: () => state, snap };
}

const vendor = (over: Partial<{ reputation: number; reviewCount: number; flaggedScam: boolean }>) => ({
  id: 'v1',
  handle: 'ghostmarket',
  reputation: 20,
  reviewCount: 3,
  ...over,
});

/**
 * A save that has never touched the dark web.
 *
 * `createTestGameState` inherits `initialGameState`'s SEEDED vendor directory,
 * which already contains two low-reputation vendors with review counts. Those
 * reviews belong to the community, not to this player — the distinction that an
 * earlier version of `scamRisk` got wrong, opening every new save at four times
 * the base risk. Keeping the seeded directory here (rather than blanking it) is
 * the point: this fixture is a REAL fresh save, and it must read as clean.
 */
const freshSave = (money: number): GameState => {
  const s = createTestGameState({});
  s.stats.money = money;
  return s;
};

const withScamMessage = (money: number, over: Partial<MailMessage> = {}): GameState => {
  const state = createTestGameState({});
  state.stats.money = money;
  state.mail = {
    messages: [
      {
        id: 'mail-scam-bank-verify-100',
        senderName: 'DeepLife Bank Security',
        senderEmail: 'security@deeplifebank-verify.com',
        subject: 'Confirm your account',
        preview: '',
        body: '',
        atWeek: 100,
        read: false,
        starred: false,
        folder: 'inbox',
        category: 'finance',
        action: { id: 'bank-verify', label: 'Confirm account', kind: 'danger' },
        scam: { lossFraction: 0.18, tells: ['lookalike domain'] },
        ...over,
      },
    ],
  };
  return state;
};

describe('scam risk is earned, not sprinkled', () => {
  it('is low on a fresh save, despite the seeded low-reputation vendors', () => {
    // The regression this test exists for: the marketplace ships populated, and
    // reading its review counts as the PLAYER's dealings put every new save at
    // four times base risk for something they had not done.
    const risk = scamRisk(freshSave(1000));
    // Read per ATTEMPT WINDOW, not per week — see SCAM_WINDOW_WEEKS. At this
    // value a clean player meets the mechanic roughly once a game-year.
    expect(risk.chance).toBeLessThanOrEqual(0.15);
    expect(risk.reasons.join(' ')).toMatch(/generic/i);
  });

  it('rises once the player has actually traded', () => {
    const traded = freshSave(1000);
    traded.darkWeb = { ...(traded.darkWeb ?? {}), playerReputation: 12 } as never;

    expect(scamRisk(traded).chance).toBeGreaterThan(scamRisk(freshSave(1000)).chance);
    expect(scamRisk(traded).reasons.join(' ')).toMatch(/traded on the dark web/i);
  });

  it('rises further once a vendor has actually scammed them', () => {
    const burned = freshSave(1000);
    burned.darkWeb = {
      ...(burned.darkWeb ?? {}),
      playerReputation: 12,
      vendors: [vendor({ flaggedScam: true })],
    } as never;

    const traded = freshSave(1000);
    traded.darkWeb = { ...(traded.darkWeb ?? {}), playerReputation: 12 } as never;

    expect(scamRisk(burned).chance).toBeGreaterThan(scamRisk(traded).chance);
    expect(scamRisk(burned).reasons.join(' ')).toMatch(/scammed you/i);
  });

  it('does NOT rise for a directory the player only browsed', () => {
    // Browsing writes nothing. A model that punished it would punish looking.
    const browsed = freshSave(1000);
    browsed.darkWeb = {
      ...(browsed.darkWeb ?? {}),
      vendors: [
        vendor({ reviewCount: 40 }),
        { ...vendor({ reviewCount: 200 }), id: 'v2' },
      ],
    } as never;

    expect(scamRisk(browsed).chance).toBe(scamRisk(freshSave(1000)).chance);
  });

  it('is capped, so no combination makes it every week', () => {
    const worst = freshSave(50_000_000);
    worst.bankSavings = 50_000_000;
    worst.darkWeb = {
      ...(worst.darkWeb ?? {}),
      heat: 100,
      playerReputation: 90,
      dirtyBtc: 40,
      jobHistory: Array.from({ length: 30 }, (_, i) => ({ id: `j${i}` })),
      vendors: Array.from({ length: 12 }, (_, i) => ({
        ...vendor({ flaggedScam: true }),
        id: `v${i}`,
      })),
    } as never;
    expect(scamRisk(worst).chance).toBeLessThanOrEqual(0.4);
  });

  it('always explains itself', () => {
    expect(scamRisk(freshSave(0)).reasons.length).toBeGreaterThan(0);
  });
});

/**
 * The spacing guarantee.
 *
 * Lowering the probability alone would not have fixed "scams every other week":
 * an independent per-week roll clusters, so two in three weeks stays possible
 * however low it goes. These assert the property that a probability cannot
 * give - a hard floor on the gap between attempts, holding for the WORST
 * possible save.
 */
describe('scams are spaced by a window, not just made rarer', () => {
  const alwaysFires = (week: number) => ({
    state: (() => {
      const s = freshSave(1000);
      s.darkWeb = { ...(s.darkWeb ?? {}), playerReputation: 90, heat: 100 } as never;
      return s;
    })(),
    week,
    facts: {},
    // Below any risk value, so the ONLY thing that can stop a scam here is the
    // window gate.
    rand: () => 0,
  });

  it('opens exactly once per window', () => {
    for (let start = 0; start < 240; start += SCAM_WINDOW_WEEKS) {
      const open: number[] = [];
      for (let w = start; w < start + SCAM_WINDOW_WEEKS; w += 1) {
        if (scamWindowOpen(w)) open.push(w);
      }
      expect(open).toHaveLength(1);
    }
  });

  it('never delivers two scams inside one window, even at maximum risk', () => {
    const weeks: number[] = [];
    for (let w = 0; w < 300; w += 1) {
      if (generateScam(alwaysFires(w))) weeks.push(w);
    }

    expect(weeks.length).toBeGreaterThan(0);
    for (let i = 1; i < weeks.length; i += 1) {
      expect(weeks[i] - weeks[i - 1]).toBeGreaterThanOrEqual(1);
      // Consecutive windows can be adjacent at the boundary (last week of one,
      // first of the next), so the guarantee is one PER WINDOW rather than a
      // flat gap - assert that directly.
      expect(Math.floor(weeks[i] / SCAM_WINDOW_WEEKS)).not.toBe(
        Math.floor(weeks[i - 1] / SCAM_WINDOW_WEEKS)
      );
    }
  });

  it('is stable for a given week - a replayed tick decides the same way', () => {
    for (let w = 0; w < 60; w += 1) {
      expect(scamWindowOpen(w)).toBe(scamWindowOpen(w));
      expect(!!generateScam(alwaysFires(w))).toBe(!!generateScam(alwaysFires(w)));
    }
  });
});

describe('a scam is never verified', () => {
  it('leaves the badge off, so the badge stays a usable signal', () => {
    const state = createTestGameState({ weeksLived: 40 });
    state.darkWeb = { ...(state.darkWeb ?? {}), playerReputation: 20 } as never;

    // Force the roll by sweeping weeks until one produces a scam.
    let found: MailMessage | null = null;
    for (let week = 1; week < 200 && !found; week += 1) {
      found = generateScam({
        state,
        week,
        facts: {},
        rand: (salt) => {
          const x = Math.sin(week * 2654435761 + salt.length) * 10000;
          return Math.abs(x - Math.floor(x)) * 0.05; // always inside the risk band
        },
      });
    }

    expect(found).not.toBeNull();
    expect(found!.verified).toBeUndefined();
    expect(found!.scam!.tells.length).toBeGreaterThan(0);
    expect(found!.action!.kind).toBe('danger');
  });
});

describe('acting on a scam - §4.4 atomicity', () => {
  it('charges once when the button is double-tapped in one batch', () => {
    const h = harness(withScamMessage(10_000));
    const seen: number[] = [];

    actOnScamMail(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', (r) => seen.push(r.lost));
    actOnScamMail(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', (r) => seen.push(r.lost));

    // First tap took money; the second was rejected against `prev`.
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[1]).toBe(0);
    expect(h.get().stats.money).toBe(10_000 - seen[0]);
  });

  it('never takes more than the cap', () => {
    const state = withScamMessage(10_000);
    const loss = scamLossFor(state, getMailState(state).messages[0]);
    expect(loss).toBeLessThanOrEqual(10_000 * SCAM_LOSS_CAP_FRACTION);
  });

  it('cannot push the player below zero', () => {
    const h = harness(withScamMessage(0));
    actOnScamMail(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', () => undefined);
    expect(h.get().stats.money).toBe(0);
  });

  it('takes nothing from a message that was merely received', () => {
    const state = withScamMessage(10_000);
    expect(state.stats.money).toBe(10_000);
    // No action taken - receiving and reading are free.
    expect(getMailState(state).messages[0].lostAmount).toBeUndefined();
  });

  it('is computed from the balance at the moment of the tap, not at delivery', () => {
    // A scam that arrives while rich cannot be banked and cashed later at the
    // old figure.
    const rich = withScamMessage(100_000);
    const poor = withScamMessage(1_000);
    expect(scamLossFor(rich, getMailState(rich).messages[0])).toBeGreaterThan(
      scamLossFor(poor, getMailState(poor).messages[0])
    );
  });
});

describe('reporting and disputing', () => {
  it('reporting costs nothing and files the message', () => {
    const h = harness(withScamMessage(10_000));
    reportMailPhishing(h.setGameState, 'mail-scam-bank-verify-100');

    const m = getMailState(h.get()).messages[0];
    expect(h.get().stats.money).toBe(10_000);
    expect(m.folder).toBe('spam');
    expect(m.actionTaken).toBe('reported');
  });

  it('recovers half a loss, once', () => {
    const h = harness(withScamMessage(10_000));
    let lost = 0;
    actOnScamMail(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', (r) => {
      lost = r.lost;
    });
    const afterLoss = h.get().stats.money;

    let first = 0;
    disputeMailCharge(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', (r) => {
      first = r.recovered;
    });
    expect(first).toBe(Math.floor(lost * DISPUTE_RECOVERY_FRACTION));
    expect(h.get().stats.money).toBe(afterLoss + first);

    // A second dispute is refused, not paid.
    let refused: string | undefined;
    let second = 0;
    disputeMailCharge(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', (r) => {
      second = r.recovered;
      refused = r.refused;
    });
    expect(second).toBe(0);
    expect(refused).toBeTruthy();
    expect(h.get().stats.money).toBe(afterLoss + first);
  });

  it('refuses a dispute on a message that cost nothing', () => {
    const h = harness(withScamMessage(10_000));
    let refused: string | undefined;
    disputeMailCharge(h.snap(), h.setGameState, 'mail-scam-bank-verify-100', (r) => {
      refused = r.refused;
    });
    expect(refused).toBeTruthy();
    expect(h.get().stats.money).toBe(10_000);
  });
});
