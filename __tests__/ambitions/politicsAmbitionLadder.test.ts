/**
 * A sitting President should not be told they have not entered politics.
 *
 * There are two political careers. `POLITICAL_CAREER` (id `'political'`,
 * Council Member → Mayor → State Rep → Governor → Senator → President) is the
 * one the Politics app drives: `runForOffice` finds or creates it, levels it,
 * and sets `currentJob: 'political'`. Separately, `INITIAL_CAREERS` has a
 * job-board entry with id `'politician'` (Campaign Volunteer → National Party
 * Leader).
 *
 * The `rule_politics` ambition's three career milestones all checked
 * `'politician'`. So a player who ran the entire election ladder and became
 * PRESIDENT scored zero progress on all three, and forfeited $120,000 + 240
 * gems + 750 prestige points + the "Head of State" badge — while the milestone
 * text read "Reach the top of the political ladder".
 * 2026-07-30 audit GP-5.
 */
import { getAmbitionCompletion } from '@/lib/ambitions';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const TOP_LEVEL = POLITICAL_CAREER.levels.length - 1;

/** A player on the Politics-app ladder (`'political'`) at `level`. */
function politicalCareerAt(level: number): GameState {
  return createTestGameState({
    ambitionId: 'rule_politics',
    currentJob: 'political' as never,
    careers: [{ ...POLITICAL_CAREER, level, unlocked: true }] as never,
    stats: { ...createTestGameState().stats, reputation: 80 },
  });
}

/** A player on the job-board ladder (`'politician'`) at `level`. */
function jobBoardPoliticianAt(level: number, levelCount = 6): GameState {
  return createTestGameState({
    ambitionId: 'rule_politics',
    currentJob: 'politician' as never,
    careers: [
      {
        id: 'politician',
        levels: Array.from({ length: levelCount }, (_, i) => ({ name: `Tier ${i}`, salary: 1000 * (i + 1) })),
        level,
        unlocked: true,
      },
    ] as never,
    stats: { ...createTestGameState().stats, reputation: 80 },
  });
}

const milestone = (state: GameState, id: string) =>
  getAmbitionCompletion(state)?.milestones.find((m) => m.id === id);

describe('the Politics-app ladder counts toward the politics ambition', () => {
  it('credits entering office', () => {
    expect(milestone(politicalCareerAt(0), 'po_enter')?.complete).toBe(true);
  });

  it('credits a career politician at level 3', () => {
    expect(milestone(politicalCareerAt(3), 'po_rising')?.complete).toBe(true);
  });

  it('credits the PRESIDENT with reaching the highest office', () => {
    // The headline case: the top of the ladder the Politics app actually drives.
    expect(milestone(politicalCareerAt(TOP_LEVEL), 'po_top_office')?.complete).toBe(true);
  });

  it('gives a President all three career milestones at once', () => {
    const completion = getAmbitionCompletion(politicalCareerAt(TOP_LEVEL));

    for (const id of ['po_enter', 'po_rising', 'po_top_office']) {
      expect(completion?.milestones.find((m) => m.id === id)?.complete).toBe(true);
    }
  });
});

describe('the job-board ladder still counts — this is additive, not a swap', () => {
  it('credits entering the job-board politician career', () => {
    expect(milestone(jobBoardPoliticianAt(0), 'po_enter')?.complete).toBe(true);
  });

  it('credits level 3 on the job-board ladder', () => {
    expect(milestone(jobBoardPoliticianAt(3), 'po_rising')?.complete).toBe(true);
  });

  it('credits the top of the job-board ladder', () => {
    expect(milestone(jobBoardPoliticianAt(5, 6), 'po_top_office')?.complete).toBe(true);
  });
});

describe('it does not credit a player who is not in politics at all', () => {
  it('leaves all three incomplete for an unrelated career', () => {
    const doctor = createTestGameState({
      ambitionId: 'rule_politics',
      currentJob: 'medicine' as never,
      careers: [{ id: 'medicine', levels: [{ name: 'Intern', salary: 900 }], level: 0, unlocked: true }] as never,
    });

    for (const id of ['po_enter', 'po_rising', 'po_top_office']) {
      expect(milestone(doctor, id)?.complete).toBe(false);
    }
  });

  it('does not treat a junior politician as top office', () => {
    expect(milestone(politicalCareerAt(1), 'po_top_office')?.complete).toBe(false);
    expect(milestone(politicalCareerAt(1), 'po_rising')?.complete).toBe(false);
  });
});
