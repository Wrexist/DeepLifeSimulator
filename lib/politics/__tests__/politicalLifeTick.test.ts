/**
 * The Political Life expansion inside the weekly tick.
 *
 * The pure modules are pinned in `politicalLife.test.ts` and the action layer
 * in `__tests__/politics/politicalLifeActions.test.ts`. What is left — and what
 * matters most, because it runs 52 times a game year on every save — is the
 * tick itself:
 *
 *   - it must never throw, whatever a corrupt save hands it (§4.3: an unguarded
 *     throw in a week-loop subsystem costs the WHOLE week);
 *   - out of office must no longer mean out of politics, because an appointed
 *     ambassador and a retired senator both have state that keeps moving;
 *   - embezzlement heat must reach the scandal roll that already exists, rather
 *     than sitting in the save doing nothing.
 */
import { runPoliticsWeeklyTick } from '../weeklyTick';
import type { PoliticsState } from '@/contexts/game/types';
import { ENDORSEMENT_THRESHOLD, isEndorsed, readPartySupport, switchParty } from '../parties';
import { HEAT_DECAY_PER_WEEK } from '../embezzlement';

function politics(over: Partial<PoliticsState> = {}): PoliticsState {
  return {
    careerLevel: 1, approvalRating: 60, policyInfluence: 0, electionsWon: 1,
    policiesEnacted: [], lobbyists: [], alliances: [], campaignFunds: 0,
    ...over,
  } as PoliticsState;
}

const tick = (p: PoliticsState, week: number, roll = 0.99) =>
  runPoliticsWeeklyTick({ politics: p, currentWeek: week, rollFor: () => roll });

describe('party standing moves every week', () => {
  it('drifts toward neutral for an office-holder', () => {
    const r = tick(politics({ party: 'democratic', partySupport: 80, lastScandalCheckWeek: 99 }), 40);
    expect(r.politics.partySupport).toBe(79);
  });

  it('keeps drifting for a member who holds no seat', () => {
    // The old tick returned early at careerLevel 0, so a party member out of
    // office was frozen: standing never moved, funding never arrived, and
    // embezzlement heat never cooled.
    const r = tick(politics({ careerLevel: 0, party: 'republican', partySupport: 20 }), 40);
    expect(r.politics.partySupport).toBe(21);
  });

  it('leaves a true citizen slice untouched (the control)', () => {
    const citizen = politics({ careerLevel: 0 });
    const r = tick(citizen, 40);
    expect(r.politics).toBe(citizen); // same reference — nothing to do
  });

  it('never gives an independent standing to draw on, whatever is stored', () => {
    // The tick does not rewrite a stale stored value — every READER normalizes
    // instead (`readPartySupport` returns 0 for a party with no machine), which
    // is what stops a player banking support, going independent and still
    // drawing on an organisation that does not exist.
    const r = tick(politics({ careerLevel: 6, party: 'independent', partySupport: 90, lastScandalCheckWeek: 99 }), 40);
    expect(readPartySupport(r.politics.party, r.politics.partySupport)).toBe(0);
    expect(isEndorsed(r.politics.party, r.politics.partySupport)).toBe(false);
    expect(r.politics.campaignFunds).toBe(0); // no machine, no money
  });

  it('and a defection to a machine party does not inherit that stale number', () => {
    const after = switchParty({ currentParty: 'independent', currentSupport: 90, target: 'democratic' });
    expect(after.support).toBeLessThan(ENDORSEMENT_THRESHOLD);
  });
});

describe('the party pays an endorsed office-holder', () => {
  it('adds to the war chest, not to cash', () => {
    // Funding lands in `campaignFunds` so it can only be spent on politics — or
    // skimmed, which is the point.
    const r = tick(politics({ party: 'democratic', partySupport: 90, careerLevel: 6, lastScandalCheckWeek: 99 }), 40);
    expect(r.politics.campaignFunds).toBeGreaterThan(0);
  });

  it('pays nothing to a member below the endorsement threshold', () => {
    const r = tick(
      politics({ party: 'democratic', partySupport: ENDORSEMENT_THRESHOLD - 20, careerLevel: 6, lastScandalCheckWeek: 99 }),
      40,
    );
    expect(r.politics.campaignFunds).toBe(0);
  });
});

describe('embezzlement heat', () => {
  it('cools in a week the player kept their hands out of the pot', () => {
    const r = tick(
      politics({ embezzlement: { totalUSD: 100_000, heat: 40, lastWeek: 30 }, lastScandalCheckWeek: 99 }),
      40,
    );
    expect(r.politics.embezzlement!.heat).toBe(40 - HEAT_DECAY_PER_WEEK);
  });

  it('does not cool in the week the money was taken', () => {
    const r = tick(
      politics({ embezzlement: { totalUSD: 100_000, heat: 40, lastWeek: 40 }, lastScandalCheckWeek: 99 }),
      40,
    );
    expect(r.politics.embezzlement!.heat).toBe(40);
  });

  it('cools for a player who has left office', () => {
    const r = tick(
      politics({ careerLevel: 0, embezzlement: { totalUSD: 100_000, heat: 40, lastWeek: 30 } }),
      40,
    );
    expect(r.politics.embezzlement!.heat).toBe(38);
  });

  it('reaches the scandal roll that already exists', () => {
    // `rollScandal` fires when `rollFor('politics.scandal.fire') < probability`.
    // A clean official at this roll is safe; a maximally-exposed one is not —
    // which is only true if the heat actually feeds the driver.
    const clean = runPoliticsWeeklyTick({
      politics: politics({ careerLevel: 1 }), currentWeek: 40, rollFor: () => 0.05,
    });
    const dirty = runPoliticsWeeklyTick({
      politics: politics({ careerLevel: 1, embezzlement: { totalUSD: 5_000_000, heat: 100, lastWeek: 30 } }),
      currentWeek: 40,
      rollFor: () => 0.05,
    });
    expect(clean.notifications.some(n => /Scandal/i.test(n.title))).toBe(false);
    expect(dirty.notifications.some(n => /Scandal/i.test(n.title))).toBe(true);
  });
});

describe('the endorsement moves an election it should not decide', () => {
  it('saves a marginal incumbent the party is behind', () => {
    // approval 30 → base ≈ 45 + 13.5 + 1 = 59.5. Roll 62% loses without the
    // party, wins with a full endorsement (+12).
    const alone = tick(politics({ approvalRating: 30, nextElectionWeek: 52, lastScandalCheckWeek: 99 }), 52, 0.62);
    const backed = tick(
      politics({ approvalRating: 30, nextElectionWeek: 52, party: 'democratic', partySupport: 100, lastScandalCheckWeek: 99 }),
      52,
      0.62,
    );
    expect(alone.lostOffice).toBe(true);
    expect(backed.lostOffice).toBe(false);
  });

  it('cannot save an incumbent the voters have abandoned', () => {
    // The [25, 92] clamp still binds: no endorsement makes a seat safe.
    const doomed = tick(
      politics({ approvalRating: 0, electionsWon: 0, nextElectionWeek: 52, party: 'democratic', partySupport: 100, lastScandalCheckWeek: 99 }),
      52,
      0.99,
    );
    expect(doomed.lostOffice).toBe(true);
  });
});

describe('the tick survives a corrupt save', () => {
  const GARBAGE: unknown[] = [undefined, null, NaN, Infinity, -1, 'nope', {}, []];

  it('never throws on a malformed embezzlement slice', () => {
    for (const bad of GARBAGE) {
      expect(() =>
        tick(politics({ embezzlement: bad as never, lastScandalCheckWeek: 99 }), 40),
      ).not.toThrow();
    }
  });

  it('never throws on a malformed party standing or appointment', () => {
    for (const bad of GARBAGE) {
      expect(() =>
        tick(politics({ party: 'democratic', partySupport: bad as never, lastScandalCheckWeek: 99 }), 40),
      ).not.toThrow();
      expect(() =>
        tick(politics({ appointment: bad as never, party: 'democratic', lastScandalCheckWeek: 99 }), 40),
      ).not.toThrow();
    }
  });

  it('keeps party standing inside 0..100 whatever it started at', () => {
    for (const start of [-500, 0, 50, 100, 5_000, NaN]) {
      const r = tick(politics({ party: 'democratic', partySupport: start, lastScandalCheckWeek: 99 }), 40);
      const v = r.politics.partySupport ?? 0;
      expect(`${start}: ${v >= 0 && v <= 100}`).toBe(`${start}: true`);
    }
  });

  it('never lets the war chest go non-finite through party funding', () => {
    for (const funds of [NaN, Infinity, -100]) {
      const r = tick(
        politics({ campaignFunds: funds as number, party: 'democratic', partySupport: 90, careerLevel: 6, lastScandalCheckWeek: 99 }),
        40,
      );
      expect(Number.isFinite(r.politics.campaignFunds)).toBe(true);
    }
  });
});
