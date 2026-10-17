/**
 * The Lobbyist appointment, measured on the path that pays it.
 *
 * OWNER CALL (2026-10-17): "Lobbyist post: $9k/wk (~5x the President) gated
 * only on office rank 2." Measured before the fix, on `getPoliticalWeeklySalary`
 * (the one political income path, taxed with the rest of the week's income):
 *
 *   - $9,000/wk to any former Mayor - two years into a political life - with no
 *     reputation floor and nothing that ever ends the post;
 *   - 4.7x the President's salary ($1,923/wk), 1.5x the CEO rung ($6,000), 3.75x
 *     the Ambassador at the SAME rank-2 gate, and 1.6x the board seat ($5,500),
 *     which needs a HIGHER office - so the cheaper gate paid more;
 *   - its one price, -15 reputation, handed back on resigning - and at the 0
 *     floor it was handed back without ever having been charged: a player at 0
 *     reputation went to 15 by taking the post and resigning it.
 *
 * Every number below is read from the live catalogues, so a later rebalance of
 * a career or a post re-runs these rules rather than a frozen copy of them.
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { isAnnualSalaryCareer } from '@/lib/careers/weeklySalary';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';
import {
  POLITICAL_APPOINTMENTS,
  appointmentBlocker,
  appointmentPriceSummary,
  findAppointment,
} from '@/lib/politics/appointments';
import {
  highestOfficeHeld,
  resolveResignAppointment,
  resolveTakeAppointment,
} from '@/lib/politics/lifeOperations';
import { availableAppointments } from '@/contexts/game/actions/PoliticalActions';

/**
 * A Mayor who retired after a year in office - the shortest real route to the
 * rank-2 gate (one Council term, one Mayoral term, then the voluntary exit,
 * which resets `careers.political.level` and keeps the rank on the record).
 */
function retiredMayor(reputation: number, appointmentId?: string): GameState {
  const base = createTestGameState({
    weeksLived: 3_000,
    stats: { money: 100_000, reputation },
  } as never);
  return {
    ...base,
    careers: [{ ...POLITICAL_CAREER, level: 0, accepted: false, applied: false }],
    politics: {
      careerLevel: 0,
      approvalRating: 60,
      policyInfluence: 0,
      electionsWon: 2,
      policiesEnacted: [],
      lobbyists: [],
      alliances: [],
      campaignFunds: 0,
      retirement: { retiredWeek: 2_990, officeLevel: 2, title: 'Mayor', termsServed: 2, weeklyPension: 0 },
      appointment: appointmentId ? { id: appointmentId, startedWeek: 2_995 } : undefined,
    },
  };
}

/** The top rung of the best-paid civilian ladder, per week. */
function bestCareerTopRung(): number {
  let best = 0;
  for (const career of initialGameState.careers ?? []) {
    if (!career || isAnnualSalaryCareer(career.id)) continue;
    const top = career.levels[career.levels.length - 1]?.salary ?? 0;
    if (top > best) best = top;
  }
  return best;
}

const PRESIDENT_WEEKLY = Math.round(
  POLITICAL_CAREER.levels[POLITICAL_CAREER.levels.length - 1].salary / WEEKS_PER_YEAR,
);

describe('the Lobbyist is attractive, not the best job in the game', () => {
  const mayor = retiredMayor(60);
  const taken = resolveTakeAppointment(mayor, 'lobbyist');
  const paid = getPoliticalWeeklySalary(taken.next);

  it('is still open to a former Mayor', () => {
    expect(highestOfficeHeld(mayor)).toBe(2);
    expect(taken.ok).toBe(true);
    expect(paid).toBe(findAppointment('lobbyist')!.weeklySalary);
  });

  it('pays better than any office the player ever held (the blurb\'s promise)', () => {
    expect(paid).toBeGreaterThan(PRESIDENT_WEEKLY);
  });

  it('pays more than the Ambassador, the reputation-POSITIVE post at the same gate', () => {
    const ambassador = findAppointment('ambassador')!;
    expect(ambassador.requirements.minOfficeHeld).toBe(findAppointment('lobbyist')!.requirements.minOfficeHeld);
    expect(paid).toBeGreaterThan(ambassador.weeklySalary);
  });

  it('pays less than the board seat, which needs a higher office', () => {
    // $9,000 vs $5,500 before the fix: the cheaper gate paid 64% more.
    expect(paid).toBeLessThan(findAppointment('board_seat')!.weeklySalary);
  });

  it('pays less than the top rung of the best civilian career', () => {
    // $9,000 vs the CEO's $6,000 before the fix - and stackable with it.
    expect(paid).toBeLessThan(bestCareerTopRung());
  });
});

describe('the appointment catalogue as a whole', () => {
  it('no post out-earns the top rung of the best civilian career', () => {
    const ceiling = bestCareerTopRung();
    for (const post of POLITICAL_APPOINTMENTS) {
      expect(`${post.id}:${post.weeklySalary < ceiling}`).toBe(`${post.id}:true`);
    }
  });

  it('among posts paid for in reputation, a higher office gate never pays less', () => {
    const priced = POLITICAL_APPOINTMENTS
      .filter((p) => p.reputationOnTake < 0 && typeof p.requirements.minOfficeHeld === 'number')
      .sort((a, b) => (a.requirements.minOfficeHeld ?? 0) - (b.requirements.minOfficeHeld ?? 0));
    expect(priced.map((p) => p.id)).toEqual(['lobbyist', 'board_seat']);
    for (let i = 1; i < priced.length; i++) {
      expect(priced[i].weeklySalary).toBeGreaterThanOrEqual(priced[i - 1].weeklySalary);
    }
  });
});

describe('the reputation price cannot be skipped at the 0 floor', () => {
  it('take-then-resign never ends with more reputation than it started with', () => {
    for (let rep = 0; rep <= 100; rep++) {
      const start = retiredMayor(rep);
      const take = resolveTakeAppointment(start, 'lobbyist');
      const end = resolveResignAppointment(take.next).next;
      // Before the fix: 0 → 0 → 15, 10 → 0 → 15. Every start under 15 gained.
      expect(`rep ${rep}: ${end.stats.reputation <= rep}`).toBe(`rep ${rep}: true`);
    }
  });

  it('refuses the post, with the cost, when reputation cannot cover it', () => {
    const broke = retiredMayor(10);
    const take = resolveTakeAppointment(broke, 'lobbyist');
    expect(take.ok).toBe(false);
    expect(take.next).toBe(broke); // a refusal churns nothing
    expect(take.message).toBe('Taking this position costs 15 reputation. You have 10.');

    // Exactly enough is enough: 15 → 0 → resign → 15.
    const exact = resolveTakeAppointment(retiredMayor(15), 'lobbyist');
    expect(exact.ok).toBe(true);
    expect(exact.next.stats.reputation).toBe(0);
    expect(resolveResignAppointment(exact.next).next.stats.reputation).toBe(15);
  });

  it('measures the step a SWAP actually takes - the old post\'s bump goes back first', () => {
    // Holding Ambassador (+5): swapping to Lobbyist is a -20 step. Before the
    // fix, at 16 reputation it charged 16, the resign refunded 15, and the
    // player ended on 15 instead of the 11 they had without either post.
    for (let rep = 5; rep <= 100; rep++) {
      const holding = retiredMayor(rep, 'ambassador');
      const swap = resolveTakeAppointment(holding, 'lobbyist');
      if (!swap.ok) {
        expect(swap.next).toBe(holding);
        expect(swap.message).toMatch(/costs 20 reputation/);
        continue;
      }
      const end = resolveResignAppointment(swap.next).next;
      expect(`rep ${rep}: ${end.stats.reputation}`).toBe(`rep ${rep}: ${rep - 5}`);
    }
  });

  it('shows the same refusal on the offer list the card renders', () => {
    const offer = availableAppointments(retiredMayor(10)).find((o) => o.id === 'lobbyist')!;
    expect(offer.blocker).toBe('Taking this position costs 15 reputation. You have 10.');
    expect(availableAppointments(retiredMayor(15)).find((o) => o.id === 'lobbyist')!.blocker).toBeNull();
  });

  it('prices a SWAP on the offer list the way the tap does', () => {
    // Holding Ambassador (+5) at 18 reputation: the swap is a -20 step. The
    // list used to omit the held post, priced -15, showed the row open, and
    // the tap then refused it.
    const holding = retiredMayor(18, 'ambassador');
    const offer = availableAppointments(holding).find((o) => o.id === 'lobbyist')!;
    expect(offer.blocker).toBe('Taking this position costs 20 reputation. You have 18.');
    expect(resolveTakeAppointment(holding, 'lobbyist').message).toBe(offer.blocker);
  });

  it('leaves reputation-positive posts alone however low reputation is', () => {
    // The floor is about a step DOWN; a +5 post can never hit 0.
    const blocker = appointmentBlocker(findAppointment('party_chair'), {
      highestOfficeHeld: 2, inOffice: false, reputation: 0, party: 'democratic', partySupport: 100,
    });
    expect(blocker).toBeNull();
  });
});

describe('the offer card states the price the game charges', () => {
  it('quotes each post\'s reputation step and party drift from the catalogue itself', () => {
    for (const post of POLITICAL_APPOINTMENTS) {
      const line = appointmentPriceSummary(post, { partyMachine: true }) ?? '';
      if (post.reputationOnTake !== 0) {
        const signed = `${post.reputationOnTake > 0 ? '+' : ''}${post.reputationOnTake}`;
        expect(line).toContain(`Reputation ${signed} while you hold it`);
      }
      if (post.partySupportPerWeek !== 0) {
        const signed = `${post.partySupportPerWeek > 0 ? '+' : ''}${post.partySupportPerWeek}`;
        expect(line).toContain(`party standing ${signed}/wk`);
      }
    }
  });

  it('only mentions party standing to a member of a party that has one', () => {
    const lobbyist = findAppointment('lobbyist');
    expect(appointmentPriceSummary(lobbyist, { partyMachine: true }))
      .toBe('Reputation -15 while you hold it · party standing -2/wk');
    expect(appointmentPriceSummary(lobbyist)).toBe('Reputation -15 while you hold it');
    expect(appointmentPriceSummary(undefined)).toBeNull();
  });
});
