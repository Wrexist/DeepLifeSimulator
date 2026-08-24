import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { ANTICIPATION_HORIZON_WEEKS, upcomingEvents } from '@/lib/anticipation/engine';
import { PREGNANCY_DURATION_WEEKS } from '@/lib/config/gameConstants';

describe('upcomingEvents', () => {
  it('is empty for a state with nothing scheduled', () => {
    expect(upcomingEvents(createTestGameState())).toEqual([]);
  });

  it('degrades to empty rather than throwing on a partial state', () => {
    expect(upcomingEvents(null)).toEqual([]);
    expect(upcomingEvents(undefined)).toEqual([]);
    expect(() => upcomingEvents({} as never)).not.toThrow();
  });

  it('reports a degree by the weeks the tick actually has left', () => {
    const state = createTestGameState({
      educations: [
        { id: 'cs', name: 'Computer Science', description: '', cost: 20_000,
          duration: 40, completed: false, weeksRemaining: 6 },
      ],
    });
    const [event] = upcomingEvents(state);
    expect(event.kind).toBe('education');
    expect(event.weeksAway).toBe(6);
    expect(event.title).toContain('Computer Science');
  });

  it('counts a birth from the pregnancy start week, not the device clock', () => {
    const state = createTestGameState({
      weeksLived: 300,
      relationships: [
        { id: 'r1', name: 'Alex', type: 'partner', relationshipScore: 80,
          personality: 'kind', age: 30, datesCount: 5,
          isPregnant: true, pregnancyStartWeek: 296 } as never,
      ],
    });
    const birth = upcomingEvents(state).find((e) => e.kind === 'birth');
    expect(birth?.weeksAway).toBe(PREGNANCY_DURATION_WEEKS - 4);
    expect(birth?.dueWeeksLived).toBe(300 + PREGNANCY_DURATION_WEEKS - 4);
  });

  it('never reports a negative horizon for an overdue pregnancy', () => {
    // A save can sit past term if the tick was interrupted. "Due -3 weeks ago"
    // is not anticipation; it clamps to "next week".
    const state = createTestGameState({
      weeksLived: 400,
      relationships: [
        { id: 'r1', name: 'Alex', type: 'partner', relationshipScore: 80,
          personality: 'kind', age: 30, datesCount: 5,
          isPregnant: true, pregnancyStartWeek: 100 } as never,
      ],
    });
    const birth = upcomingEvents(state).find((e) => e.kind === 'birth');
    expect(birth?.weeksAway).toBe(0);
  });

  it('puts a caution ahead of good news landing the same week', () => {
    const state = createTestGameState({
      weeksLived: 200,
      overdueBalance: 1_200,
      careers: [
        { id: 'tech', levels: [{ name: 'Junior', salary: 900 }, { name: 'Senior', salary: 2000 }],
          level: 0, description: '', requirements: {} as never,
          progress: 85, applied: true, accepted: true },
      ],
      currentJob: 'tech',
    });
    const events = upcomingEvents(state);
    expect(events[0].kind).toBe('debt');
    expect(events.some((e) => e.kind === 'career')).toBe(true);
  });

  it('sorts soonest first and is stable across calls', () => {
    const state = createTestGameState({
      weeksLived: 200,
      educations: [
        { id: 'cs', name: 'CS', description: '', cost: 1, duration: 40,
          completed: false, weeksRemaining: 9 },
      ],
      loans: [
        { id: 'l1', name: 'Car loan', principal: 10_000, remaining: 4_000, rateAPR: 5,
          termWeeks: 100, weeklyPayment: 120, startWeek: 100, autoPay: true,
          type: 'auto', weeksRemaining: 3, interestRate: 5 },
      ],
    });
    const first = upcomingEvents(state).map((e) => e.id);
    const second = upcomingEvents(state).map((e) => e.id);
    expect(first).toEqual(second);
    expect(first[0]).toBe('loan:l1');
  });

  it('drops anything past the horizon and honours a limit', () => {
    const state = createTestGameState({
      educations: [
        { id: 'phd', name: 'PhD', description: '', cost: 1, duration: 200,
          completed: false, weeksRemaining: ANTICIPATION_HORIZON_WEEKS + 5 },
      ],
    });
    expect(upcomingEvents(state)).toEqual([]);
    expect(upcomingEvents(state, { horizonWeeks: 100 })).toHaveLength(1);
    expect(upcomingEvents(state, { horizonWeeks: 100, limit: 0 })).toHaveLength(0);
  });

  it('holds back a promotion that is not close yet', () => {
    // A "promotion in reach" line every single week from day one is the
    // repetitive spam this engine is supposed to avoid.
    const far = createTestGameState({
      careers: [
        { id: 'tech', levels: [{ name: 'Junior', salary: 900 }, { name: 'Senior', salary: 2000 }],
          level: 0, description: '', requirements: {} as never,
          progress: 20, applied: true, accepted: true },
      ],
      currentJob: 'tech',
    });
    expect(upcomingEvents(far).some((e) => e.kind === 'career')).toBe(false);
  });

  describe('elections (2026-08-24 - a tick-enforced date that landed as a surprise)', () => {
    const politician = (overrides: Record<string, unknown> = {}) =>
      createTestGameState({
        weeksLived: 200,
        politics: {
          ...createTestGameState().politics!,
          careerLevel: 2,
          approvalRating: 60,
          nextElectionWeek: 208,
          ...overrides,
        },
      });

    it('reports the next election with its real horizon', () => {
      const election = upcomingEvents(politician()).find((e) => e.kind === 'election');
      expect(election?.weeksAway).toBe(8);
      expect(election?.dueWeeksLived).toBe(208);
      expect(election?.tone).toBe('neutral');
    });

    it('turns cautionary when approval is genuinely in trouble', () => {
      const election = upcomingEvents(politician({ approvalRating: 30 })).find(
        (e) => e.kind === 'election'
      );
      expect(election?.tone).toBe('caution');
      expect(election?.detail).toContain('30%');
    });

    it('is silent for a player with no political career', () => {
      const state = createTestGameState({ weeksLived: 200 });
      expect(upcomingEvents(state).some((e) => e.kind === 'election')).toBe(false);
    });

    it('is silent once the election week has passed', () => {
      const state = politician({ nextElectionWeek: 190 });
      expect(upcomingEvents(state).some((e) => e.kind === 'election')).toBe(false);
    });
  });

  describe('unanswered letters (2026-08-24 - the mail-lapse deadline made visible)', () => {
    it('reports a mail-routed event by the week it lapses', () => {
      const state = createTestGameState({
        weeksLived: 100,
        pendingEvents: [
          { id: 'jury_duty', description: 'A summons.', choices: [],
            channel: 'mail', expiresAtWeek: 103 } as never,
        ],
      });
      const letter = upcomingEvents(state).find((e) => e.kind === 'letter');
      expect(letter?.weeksAway).toBe(3);
      expect(letter?.tone).toBe('caution');
      expect(letter?.dueWeeksLived).toBe(103);
    });

    it('ignores modal events and letters already past their deadline', () => {
      const state = createTestGameState({
        weeksLived: 100,
        pendingEvents: [
          { id: 'modal_evt', description: 'x', choices: [] } as never,
          { id: 'lapsed', description: 'x', choices: [],
            channel: 'mail', expiresAtWeek: 99 } as never,
        ],
      });
      expect(upcomingEvents(state).some((e) => e.kind === 'letter')).toBe(false);
    });
  });
});
