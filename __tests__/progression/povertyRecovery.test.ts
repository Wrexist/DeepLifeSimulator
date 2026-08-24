/**
 * The poverty recovery path — a feature that was fully built and unreachable.
 *
 * `scholarshipOpportunity` is the game's safety net for a player who is stuck:
 * under the poverty line, no education, no route out. It is registered in
 * `eventTemplates`, its `grant_free_education` special effect is handled in the
 * week loop and covered by a stress test — and it could never fire. Its
 * condition reads `state.weeksInPoverty >= 12`, and NOTHING in the repo wrote
 * that field. One missing counter, and the whole rescue was dead for exactly
 * the player it was written for.
 *
 * The field had even been reviewed. `invisibleStateP2.test.ts` triages it under
 * "logic, no UI" with the note "gates one event at >= 12 weeks" — a review that
 * asked whether the player needs to SEE the number and correctly said no, while
 * never asking whether it moves.
 */
import { applyPovertyTracking } from '@/contexts/game/actions/weekly/applyPovertyTracking';
import { POVERTY_MONEY_THRESHOLD, SCHOLARSHIP_AWARD_USD } from '@/lib/config/gameConstants';
import { quoteScholarship } from '@/lib/education/scholarships';
import { eventTemplates } from '@/lib/events/engine';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import fs from 'fs';
import path from 'path';
import { detectSourMoment, isCalmEnoughToAsk } from '@/utils/reviewMoments';

const BROKE = POVERTY_MONEY_THRESHOLD - 100;

describe('applyPovertyTracking', () => {
  it('counts a week spent under the line', () => {
    expect(applyPovertyTracking({ money: BROKE, previous: 3 })).toBe(4);
  });

  it('starts from zero when the field has never been written', () => {
    // Every existing save is in this state — the field is absent, not 0.
    expect(applyPovertyTracking({ money: BROKE })).toBe(1);
  });

  it('resets the moment the player is back above the line', () => {
    expect(applyPovertyTracking({ money: POVERTY_MONEY_THRESHOLD, previous: 11 })).toBe(0);
  });

  it('is CONSECUTIVE, not cumulative', () => {
    // Twelve bad weeks spread across a life is not the situation the event
    // describes ("in poverty for an extended period"), and a cumulative counter
    // would eventually fire it for everyone.
    let weeks = 0;
    for (const money of [BROKE, BROKE, 5_000, BROKE, BROKE]) {
      weeks = applyPovertyTracking({ money, previous: weeks });
    }
    expect(weeks).toBe(2);
  });

  it('counts savings, so a full bank account is not poverty', () => {
    expect(applyPovertyTracking({ money: 0, bankSavings: 5_000, previous: 8 })).toBe(0);
  });

  it('survives a corrupt balance without producing NaN', () => {
    const weeks = applyPovertyTracking({ money: Number.NaN, previous: Number.NaN });
    expect(Number.isFinite(weeks)).toBe(true);
    expect(weeks).toBe(1);
  });
});

describe('the scholarship event can now actually fire', () => {
  const scholarship = eventTemplates.find((t) => t.id === 'scholarship_opportunity');

  /**
   * The event's gate, resolved once and checked rather than asserted away with
   * `!`. `EventTemplate.condition` is optional, and a template that lost its
   * condition would be permanently ALWAYS-on — the mirror image of the bug this
   * file is about, and the kind a non-null assertion would hide.
   */
  const condition = (state: GameState): boolean => {
    if (!scholarship?.condition) throw new Error('scholarship_opportunity has no condition');
    return scholarship.condition(state);
  };

  /** Stuck: broke, uneducated, and twelve weeks into it. */
  const stuck = (weeksInPoverty: number | undefined): GameState =>
    createTestGameState({
      weeksLived: 30,
      weeksInPoverty,
      educations: [],
      bankSavings: 0,
      stats: { ...createTestGameState().stats, money: BROKE },
    });

  it('is registered in the pool at all (the control)', () => {
    expect(scholarship).toBeDefined();
  });

  it('was unreachable while the counter was never written - the bug', () => {
    // `undefined` is what every save carried, because nothing wrote the field.
    expect(condition(stuck(undefined))).toBe(false);
  });

  it('fires once twelve consecutive weeks have been counted', () => {
    expect(condition(stuck(12))).toBe(true);
  });

  it('and the counter the tick produces reaches that threshold', () => {
    // End to end: run the tick's helper for twelve broke weeks and feed the
    // result to the real event condition. Asserting the helper and the gate
    // separately would not catch the two disagreeing about the threshold.
    let weeks = 0;
    for (let i = 0; i < 12; i++) weeks = applyPovertyTracking({ money: BROKE, previous: weeks });

    expect(weeks).toBe(12);
    expect(condition(stuck(weeks))).toBe(true);
  });

  it('does not fire for a player who is merely uneducated (the control)', () => {
    const solvent = createTestGameState({
      weeksLived: 30,
      weeksInPoverty: 12,
      educations: [],
      stats: { ...createTestGameState().stats, money: 50_000 },
    });

    expect(condition(solvent)).toBe(false);
  });

  it('does not fire for someone who already finished a degree (the control)', () => {
    const graduate = createTestGameState({
      weeksLived: 30,
      weeksInPoverty: 40,
      educations: [{ id: 'ged', name: 'GED', completed: true } as never],
      stats: { ...createTestGameState().stats, money: BROKE },
    });

    expect(condition(graduate)).toBe(false);
  });
});

describe('the counter and the gate read one threshold', () => {
  it('the event condition uses the shared constant, not a literal', () => {
    // The counter and the gate disagreeing would be invisible: the event would
    // simply never fire, which is the exact state this path was already in.
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib/events/engine.ts'), 'utf8');

    expect(src).toMatch(/hasLowMoney = state\.stats\.money < POVERTY_MONEY_THRESHOLD/);
  });
});

describe('the week tick writes it', () => {
  const LOOP = fs.readFileSync(
    path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'), 'utf8');

  it('calls the helper inside a try/catch (§4.3)', () => {
    // An unguarded subsystem turns one throw into a lost week for the save.
    expect(LOOP).toMatch(/try \{\s*\n\s*nextWeeksInPoverty = applyPovertyTracking\(\{/);
    expect(LOOP).toMatch(/catch \(povertyErr\)/);
  });

  it('and folds the result into the returned state', () => {
    // Computing it and dropping it on the floor is how the field stayed unwritten.
    expect(LOOP).toMatch(/weeksInPoverty: nextWeeksInPoverty,/);
  });

  it('reads the POST-tick balance, not the opening one', () => {
    // A week that ends solvent must not count, so it has to run after every
    // subsystem has moved money.
    expect(LOOP).toMatch(/money: newStats\.money,\s*\n\s*bankSavings: newBankSavings,/);
  });
});

describe('the review prompt respects the money failure state that exists', () => {
  /**
   * `detectSourMoment` / `isCalmEnoughToAsk` guard the App Store review prompt
   * against death, jail and bankruptcy. The bankruptcy arm reads
   * `bankruptcyTriggered`, which NOTHING in the repo writes — `types.ts` says so
   * outright ("`BANKRUPTCY_FLOOR` names a bankruptcy the game cannot reach") —
   * so the money axis had no guard at all here. `overdueBalance` (v31) is the
   * failure state it actually got.
   */

  const solvent = (): GameState => createTestGameState({
    jailWeeks: 0,
    overdueBalance: 0,
    pendingEvents: [],
    showDeathPopup: false,
    stats: { ...createTestGameState().stats, money: 5_000, health: 80 },
  });

  it('falling into arrears is a sour moment', () => {
    const behind = createTestGameState({ ...solvent(), overdueBalance: 400 });
    expect(detectSourMoment(solvent(), behind)).toBe(true);
  });

  it('and owing money is not a calm moment to ask', () => {
    expect(isCalmEnoughToAsk(createTestGameState({ ...solvent(), overdueBalance: 400 }))).toBe(false);
  });

  it('a solvent, quiet week still qualifies (the control)', () => {
    // The guard must not swallow every prompt — that would be a different bug,
    // and a silent one.
    expect(isCalmEnoughToAsk(solvent())).toBe(true);
    expect(detectSourMoment(solvent(), solvent())).toBe(false);
  });

  it('clearing arrears is not itself a sour moment (the control)', () => {
    const behind = createTestGameState({ ...solvent(), overdueBalance: 400 });
    expect(detectSourMoment(behind, solvent())).toBe(false);
  });
});

describe('the scholarship covers tuition, which is what it promises', () => {
  /**
   * Making the event reachable exposed the other half of the same defect: its
   * `grant_free_education` effect granted +10 reputation, under a choice reading
   * "Accept the scholarship (Free education!)" and a description promising an
   * organisation will "cover your education costs". Nobody had noticed because
   * the event could not fire, so the empty promise had never been shown to a
   * player. A dead feature hides its own bugs.
   */
  const gpaLess = { bestGpa: 0 };

  it('a certificate is covered outright', () => {
    // Legal Studies at $18,000 is the most expensive certificate, and the award
    // is sized to it. Police Academy ($12k) is covered with change left over.
    const quote = quoteScholarship({
      ...gpaLess,
      tuitionCost: 18_000,
      awardScholarshipUSD: SCHOLARSHIP_AWARD_USD,
    });

    expect(quote.netCostUSD).toBe(0);
    expect(quote.breakdown.awardUSD).toBe(18_000);
    expect(quote.eligibility).toBe('full');
  });

  it('a degree is discounted, not bought', () => {
    // The ceiling is the point: this fires for a broke character, and it should
    // open the first door rather than hand over a $150k medical degree.
    const quote = quoteScholarship({
      ...gpaLess,
      tuitionCost: 150_000,
      awardScholarshipUSD: SCHOLARSHIP_AWARD_USD,
    });

    expect(quote.netCostUSD).toBe(132_000);
    expect(quote.eligibility).toBe('partial');
  });

  it('only the part that actually paid tuition is spent', () => {
    // A 4.0 student already has 80% covered. Charging the whole credit for a
    // bill it did not pay would be the same class of defect as a reward that
    // never arrives — quieter, and in the other direction.
    const quote = quoteScholarship({
      bestGpa: 4.0,
      tuitionCost: 12_000,
      awardScholarshipUSD: SCHOLARSHIP_AWARD_USD,
    });

    expect(quote.breakdown.meritUSD).toBeCloseTo(9_600, 5);
    expect(quote.breakdown.awardUSD).toBeCloseTo(2_400, 5);
    expect(quote.netCostUSD).toBe(0);
  });

  it('never exceeds the tuition it is applied to', () => {
    const quote = quoteScholarship({
      ...gpaLess,
      tuitionCost: 5_000,
      awardScholarshipUSD: SCHOLARSHIP_AWARD_USD,
    });

    expect(quote.totalUSD).toBe(5_000);
    expect(quote.breakdown.awardUSD).toBe(5_000);
  });

  it('no award behaves exactly as before (the control)', () => {
    // Every save before v41 is in this state, and every player who never sees
    // the event stays in it.
    const quote = quoteScholarship({ ...gpaLess, tuitionCost: 18_000 });

    expect(quote.netCostUSD).toBe(18_000);
    expect(quote.breakdown.awardUSD).toBe(0);
  });

  it('the event effect grants the credit rather than reputation alone', () => {
    const loop = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'), 'utf8');

    expect(loop).toMatch(/nextTuitionWaiverUSD = Math\.max\(/);
    expect(loop).toMatch(/SCHOLARSHIP_AWARD_USD,/);
    // `Math.max`, not `+=`: the event needs no completed education, so it can be
    // seen twice before enrolling. Taking the higher refuses to stack a windfall
    // while never reducing a credit the player already holds.
    expect(loop).not.toMatch(/tuitionWaiverUSD\s*\+=/);
  });

  it('and the enrolment spends it in the same updater that enrols', () => {
    // §4.4. The quote is computed from `prev`, so a second tap in one React
    // batch re-quotes against the decremented credit and cannot spend it twice.
    const actions = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts/game/actions/EducationActions.ts'), 'utf8');

    expect(actions).toMatch(/awardScholarshipUSD: tuitionWaiver\(state\)/);
    expect(actions).toMatch(/quote\.waiverSpentUSD > 0/);
  });
});
