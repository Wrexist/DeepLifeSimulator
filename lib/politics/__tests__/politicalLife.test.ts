/**
 * The Political Life expansion — parties that cost something, appointments that
 * pay, money that can be stolen, and a way to stand down.
 *
 * Player request (support email, 2026-08-21): "make one that focus more on being
 * a president … there should be campaign retirement and other positions you can
 * have that pay, you can choose to steal stake money, join political parties or
 * other things that concern with government."
 *
 * Three of those four were absent outright. The fourth — parties — technically
 * existed: `politics.party` was set by `joinParty`, granted +5 approval once,
 * and was read by nothing else in the game. This suite pins the properties that
 * make each of them a decision rather than a label.
 */

import {
  ENDORSEMENT_THRESHOLD,
  PRIMARY_CHALLENGE_THRESHOLD,
  driftPartySupport,
  electionSupportModifier,
  facesPrimaryChallenge,
  findParty,
  hasPartyMachine,
  isEndorsed,
  policySupportDelta,
  readPartySupport,
  switchParty,
  weeklyPartyFunding,
} from '@/lib/politics/parties';
import {
  POLITICAL_APPOINTMENTS,
  appointmentBarsOffice,
  appointmentBlocker,
  appointmentWeeklySalary,
  findAppointment,
} from '@/lib/politics/appointments';
import {
  EMPTY_EMBEZZLEMENT,
  HEAT_DECAY_PER_WEEK,
  MAX_WEEKLY_SKIM_FRACTION,
  MIN_SKIM_USD,
  decayHeat,
  embezzlementScandalPressureUSD,
  maxWeeklySkim,
  planSkim,
  readEmbezzlement,
  skimmablePot,
} from '@/lib/politics/embezzlement';
import {
  MAX_WEEKLY_PENSION,
  buildRetirement,
  calculatePension,
  readPensionWeekly,
  retirementBlocker,
  retiredTitle,
} from '@/lib/politics/retirement';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

describe('party standing', () => {
  it('is always 0 for an independent, whatever the save stores', () => {
    // Otherwise a player banks support inside a machine party, goes
    // independent, and still draws on an organisation that does not exist.
    expect(readPartySupport('independent', 95)).toBe(0);
    expect(isEndorsed('independent', 95)).toBe(false);
    expect(weeklyPartyFunding({ party: 'independent', support: 95, careerLevel: 6 })).toBe(0);
    expect(hasPartyMachine('independent')).toBe(false);
  });

  it('clamps and rounds a corrupt stored value instead of propagating it', () => {
    for (const bad of [undefined, null, NaN, Infinity, -40, 900]) {
      const v = readPartySupport('democratic', bad as number);
      expect(`${bad}: ${v >= 0 && v <= 100 && Number.isInteger(v)}`).toBe(`${bad}: true`);
    }
  });

  it('endorses at the threshold and challenges below the floor', () => {
    expect(isEndorsed('democratic', ENDORSEMENT_THRESHOLD)).toBe(true);
    expect(isEndorsed('democratic', ENDORSEMENT_THRESHOLD - 1)).toBe(false);
    expect(facesPrimaryChallenge('democratic', PRIMARY_CHALLENGE_THRESHOLD - 1)).toBe(true);
    expect(facesPrimaryChallenge('democratic', PRIMARY_CHALLENGE_THRESHOLD)).toBe(false);
  });

  it('tilts an election without ever deciding one', () => {
    // The whole point of the bound: an endorsement should win a close race, not
    // make a seat safe regardless of approval.
    const best = electionSupportModifier('democratic', 100);
    const worst = electionSupportModifier('democratic', 0);
    expect(best).toBeLessThanOrEqual(12);
    expect(worst).toBeGreaterThanOrEqual(-10);
    expect(electionSupportModifier('democratic', 45)).toBe(0); // the neutral band
  });

  it('rewards the platform and punishes the other side', () => {
    expect(policySupportDelta('democratic', 'healthcare')).toBeGreaterThan(0);
    expect(policySupportDelta('democratic', 'crypto')).toBeLessThan(0);
    expect(policySupportDelta('republican', 'crypto')).toBeGreaterThan(0);
    // An independent answers to nobody — no bonus, and no penalty either.
    expect(policySupportDelta('independent', 'crypto')).toBe(0);
    expect(policySupportDelta('democratic', undefined)).toBe(0);
  });

  it('funds an endorsed office-holder and nobody else', () => {
    expect(weeklyPartyFunding({ party: 'democratic', support: 80, careerLevel: 6 })).toBeGreaterThan(0);
    // Endorsed but holding no seat — a party spends on races, not on members.
    expect(weeklyPartyFunding({ party: 'democratic', support: 80, careerLevel: 0 })).toBe(0);
    // In office but out of favour.
    expect(weeklyPartyFunding({ party: 'democratic', support: 30, careerLevel: 6 })).toBe(0);
  });

  it('drifts toward neutral and is dragged down by live scandals', () => {
    expect(driftPartySupport({ party: 'democratic', support: 80 })).toBe(79);
    expect(driftPartySupport({ party: 'democratic', support: 20 })).toBe(21);
    expect(driftPartySupport({ party: 'democratic', support: 50 })).toBe(50);
    expect(driftPartySupport({ party: 'democratic', support: 50, activeScandals: 2 })).toBe(44);
    expect(driftPartySupport({ party: 'democratic', support: 1, activeScandals: 9 })).toBe(0);
  });
});

describe('crossing the floor', () => {
  it('is free the first time', () => {
    const r = switchParty({ currentParty: undefined, target: 'democratic' });
    expect(r.support).toBe(findParty('democratic')!.startingSupport);
    expect(r.approvalDelta).toBe(5);
    expect(r.switches).toBe(0);
  });

  it('costs more approval every time after that', () => {
    const first = switchParty({ currentParty: 'democratic', switches: 0, target: 'republican' });
    const second = switchParty({ currentParty: 'republican', switches: 1, target: 'democratic' });
    expect(first.approvalDelta).toBeLessThan(0);
    expect(second.approvalDelta).toBeLessThan(first.approvalDelta);
    expect(second.switches).toBe(2);
  });

  it('drops a defector to the bottom of the new pecking order', () => {
    const r = switchParty({ currentParty: 'democratic', currentSupport: 95, target: 'republican' });
    expect(r.support).toBeLessThan(ENDORSEMENT_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

describe('appointed positions', () => {
  const anyone = { reputation: 100, highestOfficeHeld: 6, hasEducation: () => true };

  it('every catalog entry has a positive salary and a unique id', () => {
    const ids = POLITICAL_APPOINTMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of POLITICAL_APPOINTMENTS) {
      expect(`${a.id}:${a.weeklySalary > 0}`).toBe(`${a.id}:true`);
    }
  });

  it('pays 0 for an unknown or missing id rather than throwing', () => {
    // A save carrying a post removed in a later build must stop paying, not
    // crash the week loop.
    for (const bad of [undefined, null, '', 'no_such_post']) {
      expect(appointmentWeeklySalary(bad as string)).toBe(0);
    }
  });

  it('names the reason it is refused instead of returning a bare false', () => {
    const judge = findAppointment('federal_judge');
    expect(appointmentBlocker(judge, { ...anyone, hasEducation: () => false }))
      // 2026-08-23: the gate now names the REAL programme (law_school) — the
      // old 'law_degree' id existed in no catalogue, so the post was
      // permanently unobtainable.
      .toMatch(/Law School/);
    expect(appointmentBlocker(findAppointment('ambassador'), { ...anyone, highestOfficeHeld: 0 }))
      .toMatch(/served as/);
    expect(appointmentBlocker(findAppointment('cabinet_secretary'), { ...anyone, party: undefined }))
      .toMatch(/party/i);
    expect(appointmentBlocker(undefined, anyone)).toBe('Unknown appointment.');
  });

  it('bars the conflicted posts while the player sits in office', () => {
    for (const id of ['federal_judge', 'lobbyist', 'board_seat']) {
      expect(`${id}:${appointmentBarsOffice(id)}`).toBe(`${id}:true`);
      expect(appointmentBlocker(findAppointment(id), { ...anyone, inOffice: true, party: 'democratic', partySupport: 100 }))
        .toMatch(/leave elected office/);
    }
    expect(appointmentBarsOffice('ambassador')).toBe(false);
  });

  it('lets a qualified candidate through', () => {
    expect(appointmentBlocker(findAppointment('ambassador'), {
      ...anyone, inOffice: false, party: 'democratic', partySupport: 100,
    })).toBeNull();
  });

  it('prices the private posts above the public ones, and charges reputation for them', () => {
    const lobbyist = findAppointment('lobbyist')!;
    const ambassador = findAppointment('ambassador')!;
    expect(lobbyist.weeklySalary).toBeGreaterThan(ambassador.weeklySalary);
    expect(lobbyist.reputationOnTake).toBeLessThan(0);
    expect(ambassador.reputationOnTake).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Embezzlement
// ---------------------------------------------------------------------------

describe('taking the money', () => {
  const pot = { campaignFunds: 400_000, pacCleanUSD: 100_000 };

  it('counts campaign funds and CLEAN pac money, never the dirty balance', () => {
    // Dirty money is laundered crypto the player put in themselves; letting it
    // round-trip back out would make the PAC a free laundromat.
    expect(skimmablePot(pot)).toBe(500_000);
    expect(skimmablePot({ campaignFunds: -5, pacCleanUSD: NaN })).toBe(0);
  });

  it('caps a single week at a fraction of the pot', () => {
    expect(maxWeeklySkim(500_000)).toBe(500_000 * MAX_WEEKLY_SKIM_FRACTION);
    // Too small to be worth hiding.
    expect(maxWeeklySkim(1_000)).toBe(0);
  });

  it('refuses a second dip in the same game week', () => {
    const first = planSkim({ ...pot, state: EMPTY_EMBEZZLEMENT, requested: 50_000, weeksLived: 3_000 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = planSkim({ ...pot, state: first.next, requested: 50_000, weeksLived: 3_000 });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toMatch(/already moved money this week/i);

    // The NEXT week is fine again.
    expect(planSkim({ ...pot, state: first.next, requested: 50_000, weeksLived: 3_001 }).ok).toBe(true);
  });

  it('refuses more than the weekly allowance, and less than the floor', () => {
    const over = planSkim({ ...pot, state: EMPTY_EMBEZZLEMENT, requested: 200_000, weeksLived: 1 });
    expect(over.ok).toBe(false);
    const under = planSkim({ ...pot, state: EMPTY_EMBEZZLEMENT, requested: MIN_SKIM_USD - 1, weeksLived: 1 });
    expect(under.ok).toBe(false);
  });

  it('drains campaign funds before the PAC', () => {
    const plan = planSkim({
      campaignFunds: 30_000, pacCleanUSD: 470_000,
      state: EMPTY_EMBEZZLEMENT, requested: 100_000, weeksLived: 1,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.fromCampaign).toBe(30_000);
    expect(plan.fromPAC).toBe(70_000);
    expect(plan.fromCampaign + plan.fromPAC).toBe(plan.amount);
  });

  it('charges more heat for taking more of the allowance, and for higher office', () => {
    const small = planSkim({ ...pot, state: EMPTY_EMBEZZLEMENT, requested: MIN_SKIM_USD, weeksLived: 1 });
    const big = planSkim({ ...pot, state: EMPTY_EMBEZZLEMENT, requested: 125_000, weeksLived: 1 });
    const president = planSkim({ ...pot, state: EMPTY_EMBEZZLEMENT, requested: 125_000, weeksLived: 1, careerLevel: 6 });
    expect(small.ok && big.ok && president.ok).toBe(true);
    if (!small.ok || !big.ok || !president.ok) return;
    expect(big.next.heat).toBeGreaterThan(small.next.heat);
    expect(president.next.heat).toBeGreaterThan(big.next.heat);
    expect(president.next.heat).toBeLessThanOrEqual(100);
  });

  it('only cools off in a week the player kept their hands out of the pot', () => {
    const hot = { totalUSD: 1, heat: 40, lastWeek: 3_000 };
    // Same week as the last dip — no decay.
    expect(decayHeat(hot, 3_000).heat).toBe(40);
    expect(decayHeat(hot, 3_001).heat).toBe(40 - HEAT_DECAY_PER_WEEK);
    expect(decayHeat({ ...hot, heat: 0 }, 9_999).heat).toBe(0);
  });

  it('expresses heat in the same currency the scandal roll already understands', () => {
    // One tuning point for corruption risk, not two curves to keep in step.
    expect(embezzlementScandalPressureUSD({ totalUSD: 0, heat: 0, lastWeek: -1 })).toBe(0);
    expect(embezzlementScandalPressureUSD({ totalUSD: 0, heat: 100, lastWeek: -1 })).toBe(5_000_000);
  });

  it('degrades a malformed stored slice to the empty answer', () => {
    for (const bad of [undefined, null, 'nope', 42, { heat: 'hot' }]) {
      const r = readEmbezzlement(bad);
      expect(`${JSON.stringify(bad)}: ${r.heat}/${r.totalUSD}`).toBe(`${JSON.stringify(bad)}: 0/0`);
    }
  });
});

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

describe('standing down', () => {
  it('refuses a player who is not in office, or who never won an election', () => {
    expect(retirementBlocker({ careerLevel: 0, termsServed: 5 })).toMatch(/not currently holding office/);
    expect(retirementBlocker({ careerLevel: 3, termsServed: 0 })).toMatch(/win at least one election/);
  });

  it('requires a full year in the seat', () => {
    expect(retirementBlocker({ careerLevel: 3, termsServed: 1, weeksInOffice: 10 })).toMatch(/full year/);
    expect(retirementBlocker({ careerLevel: 3, termsServed: 1, weeksInOffice: WEEKS_PER_YEAR })).toBeNull();
  });

  it('pays more for higher office, more terms and better approval', () => {
    const base = { officeLevel: 3, termsServed: 2, approvalRating: 50 };
    expect(calculatePension({ ...base, officeLevel: 6 })).toBeGreaterThan(calculatePension(base));
    expect(calculatePension({ ...base, termsServed: 5 })).toBeGreaterThan(calculatePension(base));
    expect(calculatePension({ ...base, approvalRating: 100 })).toBeGreaterThan(calculatePension(base));
    // Approval matters least: a hated President still out-earns a loved councillor.
    expect(calculatePension({ officeLevel: 6, termsServed: 1, approvalRating: 0 }))
      .toBeGreaterThan(calculatePension({ officeLevel: 1, termsServed: 1, approvalRating: 100 }));
  });

  it('pays nothing without an office or a term, and never breaks the ceiling', () => {
    expect(calculatePension({ officeLevel: 0, termsServed: 9 })).toBe(0);
    expect(calculatePension({ officeLevel: 6, termsServed: 0 })).toBe(0);
    expect(calculatePension({ officeLevel: 6, termsServed: 999, approvalRating: 100 }))
      .toBeLessThanOrEqual(MAX_WEEKLY_PENSION);
  });

  it('captures the title while it is still true', () => {
    // The v42 reasoning: retiring resets careers.political.level to 0, so a
    // title derived afterwards would name whatever level 0 is called.
    const record = buildRetirement({ careerLevel: 6, termsServed: 3, approvalRating: 70, weeksLived: 3_000 });
    expect(record.title).toBe('President');
    expect(record.officeLevel).toBe(6);
    expect(record.retiredWeek).toBe(3_000);
    expect(record.weeklyPension).toBeGreaterThan(0);
    expect(retiredTitle(record)).toBe('President');
  });

  it('reads $0 and no title off a missing or malformed record', () => {
    for (const bad of [undefined, null, 'nope', {}, { weeklyPension: NaN }]) {
      expect(readPensionWeekly(bad)).toBe(0);
      expect(retiredTitle(bad)).toBeUndefined();
    }
  });
});
