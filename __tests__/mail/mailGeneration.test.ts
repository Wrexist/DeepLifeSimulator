/**
 * The mail generator: determinism, boundedness, and figures that match the save.
 *
 * The determinism tests are the load-bearing ones. This runs inside a
 * `setGameState` updater that React 19 may invoke twice, so a generator that
 * rolled fresh randomness would deliver a different inbox on the second pass —
 * and, because the scam is the highest-stakes message in the game, would give
 * the player a second roll at being robbed for one press of Next Week.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import { generateWeeklyMail, MAX_MESSAGES_PER_WEEK } from '@/lib/mail/generate';
import { applyMail } from '@/contexts/game/actions/weekly/applyMail';
import { appendMessages, deriveAddress, getMailState, MAX_MAIL_MESSAGES } from '@/lib/mail/state';
import type { GameState, MailMessage } from '@/contexts/game/types';

const salariedAt = (week: number): GameState =>
  createTestGameState({
    weeksLived: week,
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
      },
    ],
  });

describe('mail — determinism', () => {
  it('produces an identical inbox when the same week is generated twice', () => {
    const state = salariedAt(104);
    const facts = { careerSalary: 1200, incomeTax: 180 };

    const a = generateWeeklyMail({ state, week: 104, facts });
    const b = generateWeeklyMail({ state, week: 104, facts });

    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('gives every message an id that encodes its week', () => {
    const messages = generateWeeklyMail({
      state: salariedAt(52),
      week: 52,
      facts: { careerSalary: 900, incomeTax: 120 },
    });
    expect(messages.length).toBeGreaterThan(0);
    for (const m of messages) {
      expect(m.id.endsWith('-52')).toBe(true);
      expect(m.atWeek).toBe(52);
    }
  });

  it('never uses Math.random — a re-rolled scam would be a second chance to rob the player', () => {
    const spy = jest.spyOn(Math, 'random');
    generateWeeklyMail({
      state: salariedAt(88),
      week: 88,
      facts: { careerSalary: 1000, incomeTax: 140 },
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('mail — boundedness', () => {
  it('caps routine messages per week', () => {
    // Week 0 lines every 4-week cycle up at once, which is the collision the
    // cap exists for.
    const state = createTestGameState({
      weeksLived: 0,
      overdueBalance: 5000,
      bankSavings: 20000,
    });
    const messages = generateWeeklyMail({
      state,
      week: 0,
      facts: { careerSalary: 2000, incomeTax: 300, weeklyRent: 400 },
    });
    // The scam is deliberately outside the cap, so allow one over.
    expect(messages.filter((m) => !m.scam).length).toBeLessThanOrEqual(MAX_MESSAGES_PER_WEEK);
  });

  it('prunes the oldest messages past the ceiling', () => {
    const make = (i: number): MailMessage => ({
      id: `m-${i}`,
      senderName: 'S',
      senderEmail: 's@x.com',
      subject: `Subject ${i}`,
      preview: '',
      body: '',
      atWeek: i,
      read: false,
      starred: false,
      folder: 'inbox',
      category: 'primary',
    });

    const existing = Array.from({ length: MAX_MAIL_MESSAGES }, (_, i) => make(i));
    const next = appendMessages(existing, [make(999)]);

    expect(next).toHaveLength(MAX_MAIL_MESSAGES);
    expect(next[next.length - 1].id).toBe('m-999');
    // The oldest went, not the newest.
    expect(next.find((m) => m.id === 'm-0')).toBeUndefined();
  });

  it('returns the same array reference when nothing is added', () => {
    const existing: MailMessage[] = [];
    expect(appendMessages(existing, [])).toBe(existing);
  });
});

/**
 * `applyMail` returns `GameState | null` — null meaning "nothing changed".
 * Narrowing that with `as GameState` is what Hard Rule #3 bans and what the
 * weekly audit flagged, so this asserts the delivery happened and narrows off
 * the assertion instead. It also reads better: a null here is a real failure of
 * the test's premise, not a type inconvenience to be cast away.
 */
function deliveredState(result: { state: GameState | null }): GameState {
  if (!result.state) throw new Error('expected applyMail to deliver, got no state');
  return result.state;
}

describe('mail — the weekly subsystem', () => {
  it('is idempotent across a repeated tick', () => {
    const state = salariedAt(60);
    const first = deliveredState(
      applyMail({ state, week: 60, facts: { careerSalary: 1200, incomeTax: 180 } })
    );

    const second = applyMail({
      state: first,
      week: 60,
      facts: { careerSalary: 1200, incomeTax: 180 },
    });

    // Short-circuited by `lastGeneratedWeek` — no second delivery.
    expect(second.state).toBeNull();
    expect(second.delivered).toBe(0);
  });

  it('is idempotent even if the week marker is lost', () => {
    const state = salariedAt(60);
    const first = deliveredState(
      applyMail({ state, week: 60, facts: { careerSalary: 1200, incomeTax: 180 } })
    );
    const delivered = getMailState(first).messages.length;

    // Simulate a save that kept the messages but lost the marker: the id-keyed
    // append is the second, independent guard.
    const withoutMarker: GameState = {
      ...first,
      mail: { messages: getMailState(first).messages },
    };

    const again = applyMail({
      state: withoutMarker,
      week: 60,
      facts: { careerSalary: 1200, incomeTax: 180 },
    });

    expect(getMailState(again.state ?? withoutMarker).messages).toHaveLength(delivered);
  });

  it('leaves state alone on a week with nothing to send', () => {
    // No job, no rent, no savings, no education — and a week that hits no cycle.
    const state = createTestGameState({ weeksLived: 501, bankSavings: 0 });
    state.stats.money = 0;
    const result = applyMail({ state, week: 501, facts: {} });
    // Either nothing changed, or only the marker moved — never a phantom message.
    const delivered = result.state ? getMailState(result.state).messages.length : 0;
    expect(delivered).toBeLessThanOrEqual(1);
  });
});

describe('mail — documents quote the tick, not a recomputation', () => {
  it('puts the salary the tick actually paid on the payslip', () => {
    // The career level says $1,200. The tick paid $1,800 (a raise premium plus
    // a boost). The payslip must show what landed, or it is worse than useless.
    const messages = generateWeeklyMail({
      state: salariedAt(104),
      week: 104,
      facts: { careerSalary: 1800, incomeTax: 250 },
    });

    const payslip = messages.find((m) => m.id.startsWith('mail-payslip'));
    expect(payslip).toBeDefined();
    const rows = payslip!.attachment!.rows;
    expect(rows[0].label).toContain('$1,800.00');
    // Gross for the 4-week period.
    expect(rows[0].value).toBe('$7,200.00');
    // Net = gross - withheld, and the total must agree with the rows above it.
    expect(payslip!.attachment!.total!.value).toBe('$6,200.00');
  });

  it('does not send a payslip to someone who was not paid', () => {
    const messages = generateWeeklyMail({
      state: createTestGameState({ weeksLived: 104 }),
      week: 104,
      facts: { careerSalary: 0 },
    });
    expect(messages.find((m) => m.id.startsWith('mail-payslip'))).toBeUndefined();
  });
});

describe('mail — gates that must not be dead', () => {
  /**
   * The welcome message shipped with `if (week > 2) return null`, which looked
   * obviously right and was obviously wrong: `computeWeeksLived(age)` is
   * `(startingAge - 18) * 52`, so a new game starts at week 104 for a
   * 20-year-old and 624 for a 30-year-old. The gate fired for exactly the three
   * scenarios that begin at 18 and silently never fired for the other twelve.
   *
   * It was found by opening the app, not by a test — every test had picked its
   * own convenient week. This is that test, written from the real starting
   * weeks rather than from a round number.
   */
  const STARTING_WEEKS_BY_SCENARIO_AGE = [18, 19, 20, 21, 22, 25, 28, 30].map(
    (age) => (age - 18) * 52
  );

  it.each(STARTING_WEEKS_BY_SCENARIO_AGE)(
    'sends the welcome on the first tick of a life starting at week %i',
    (startWeek) => {
      const state = createTestGameState({ weeksLived: startWeek });
      const messages = generateWeeklyMail({ state, week: startWeek + 1, facts: {} });
      expect(messages.some((m) => m.id.startsWith('mail-welcome'))).toBe(true);
    }
  );

  it('sends it exactly once, however many weeks pass', () => {
    let state = createTestGameState({ weeksLived: 104 });
    const first = applyMail({ state, week: 105, facts: {} });
    state = first.state ?? state;
    expect(getMailState(state).messages.filter((m) => m.id.startsWith('mail-welcome'))).toHaveLength(1);

    for (let w = 106; w < 130; w += 1) {
      const next = applyMail({ state, week: w, facts: {} });
      state = next.state ?? state;
    }
    expect(getMailState(state).messages.filter((m) => m.id.startsWith('mail-welcome'))).toHaveLength(1);
  });
});

describe('mail — addressed to the right person', () => {
  /**
   * `userProfile.name` is a HANDLE and defaults to "player". The character's
   * name is `firstName` + `lastName`, which is what `IdentityCard` shows. Both
   * the address and the greeting read the wrong one, so every message went to
   * `player@deepmail.com` and the welcome opened "Hi player". Found by opening
   * the drawer and reading the From line.
   */
  it('derives the address from the character, not the handle', () => {
    const state = createTestGameState({});
    state.userProfile = {
      ...state.userProfile,
      name: 'player',
      firstName: 'Thomas',
      lastName: 'White',
    };
    expect(deriveAddress(state)).toBe('thomas.white@deepmail.com');
  });

  it('greets the character by their first name', () => {
    const state = createTestGameState({ weeksLived: 104 });
    state.userProfile = {
      ...state.userProfile,
      name: 'player',
      firstName: 'Thomas',
      lastName: 'White',
    };
    const welcome = generateWeeklyMail({ state, week: 105, facts: {} }).find((m) =>
      m.id.startsWith('mail-welcome')
    );
    expect(welcome!.body).toContain('Hi Thomas');
    expect(welcome!.body).not.toContain('Hi player');
  });

  it('falls back to the handle when no character name is set', () => {
    const state = createTestGameState({});
    state.userProfile = { ...state.userProfile, name: 'nova', firstName: undefined, lastName: undefined };
    expect(deriveAddress(state)).toBe('nova@deepmail.com');
  });
});
