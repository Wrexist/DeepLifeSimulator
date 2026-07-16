/**
 * Hobby Mastery — practice grants XP + reward, levels up, respects the weekly
 * cap, and a same-batch double-tap can only practice once (atomicity).
 */
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { practicePursuit } from '@/contexts/game/actions/PursuitActions';
import { getPursuitDef, PRACTICE_XP, levelFromXp } from '@/lib/pursuits/pursuitMastery';

function harness(initial: GameState) {
  const ref = { state: initial };
  const setGameState = ((u: GameState | ((p: GameState) => GameState)) => {
    ref.state = typeof u === 'function' ? u(ref.state) : u;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { ref, setGameState };
}

describe('practicePursuit (hobby mastery)', () => {
  it('practicing grants XP, spends energy, and applies the reward', () => {
    const running = getPursuitDef('running')!;
    const state = createTestGameState({ stats: { ...createTestGameState().stats, energy: 100, fitness: 10, health: 50 } });
    const { ref, setGameState } = harness(state);

    const r = practicePursuit(ref.state, setGameState, 'running');
    expect(r.success).toBe(true);
    expect(ref.state.pursuits?.running?.xp).toBe(PRACTICE_XP);
    expect(ref.state.stats.energy).toBe(100 - running.energyCost);
    expect(ref.state.stats.fitness).toBeGreaterThan(10); // running rewards fitness
    expect(ref.state.weeklyPursuitPractice?.running).toBe(1);
  });

  it('accumulates XP into a level-up with a bonus', () => {
    // Seed near a level boundary so one practice crosses it.
    const base = createTestGameState();
    let state = createTestGameState({
      stats: { ...base.stats, energy: 100, happiness: 40 },
      pursuits: { guitar: { xp: 90, level: 0 } },
    });
    const { ref, setGameState } = harness(state);
    const r = practicePursuit(ref.state, setGameState, 'guitar');
    expect(r.leveledUp).toBe(true);
    expect(r.newLevel).toBe(levelFromXp(90 + PRACTICE_XP)); // should be 1
    expect(ref.state.pursuits?.guitar?.level).toBe(1);
    // Level-up doubles the reward on top of the practice reward → bigger happiness gain.
    expect(ref.state.stats.happiness).toBeGreaterThan(40 + 4);
  });

  it('rejects practice past the weekly cap', () => {
    const cooking = getPursuitDef('cooking')!;
    let state = createTestGameState({
      stats: { ...createTestGameState().stats, energy: 100 },
      weeklyPursuitPractice: { cooking: cooking.weeklyCap },
    });
    const { ref, setGameState } = harness(state);
    const r = practicePursuit(ref.state, setGameState, 'cooking');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/this week/i);
    expect(ref.state.pursuits?.cooking).toBeUndefined();
  });

  it('rejects when too tired', () => {
    const state = createTestGameState({ stats: { ...createTestGameState().stats, energy: 3 } });
    const { ref, setGameState } = harness(state);
    const r = practicePursuit(ref.state, setGameState, 'coding');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/energy/i);
  });

  it('a same-batch double-tap cannot exceed the weekly cap', () => {
    // Practicing is repeatable, but the cap must hold across a batch: with one
    // practice left, two taps on the same stale snapshot yield exactly one more.
    const chess = getPursuitDef('chess')!;
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, energy: 100 },
      weeklyPursuitPractice: { chess: chess.weeklyCap - 1 },
      pursuits: { chess: { xp: PRACTICE_XP, level: 0 } },
    });
    const { ref, setGameState } = harness(state);
    const stale = state;
    practicePursuit(stale, setGameState, 'chess');
    practicePursuit(stale, setGameState, 'chess');
    expect(ref.state.weeklyPursuitPractice?.chess).toBe(chess.weeklyCap); // capped
    expect(ref.state.pursuits?.chess?.xp).toBe(PRACTICE_XP * 2); // only one more practice landed
  });

  it('a same-batch double-tap cannot overdraft energy', () => {
    // Only enough energy for one chess session (cost 8).
    const state = createTestGameState({ stats: { ...createTestGameState().stats, energy: 10 } });
    const { ref, setGameState } = harness(state);
    const stale = state;
    practicePursuit(stale, setGameState, 'chess');
    practicePursuit(stale, setGameState, 'chess');
    expect(ref.state.stats.energy).toBeGreaterThanOrEqual(0);
    expect(ref.state.weeklyPursuitPractice?.chess).toBe(1); // second tap blocked by energy
  });

  it('practicing a hobby raises the "hobbies" activity-commitment level (Fix 5b)', () => {
    const base = createTestGameState();
    const state = createTestGameState({
      stats: { ...base.stats, energy: 100 },
      activityCommitments: {
        primary: undefined, secondary: undefined,
        commitmentLevels: { career: 0, hobbies: 0, relationships: 0, health: 0 },
      },
    });
    const { ref, setGameState } = harness(state);
    practicePursuit(ref.state, setGameState, 'running');
    // Uncommitted hobbies grow +1 per practice (updateCommitmentLevel), so the
    // ActivityCommitmentModal bar finally moves.
    expect(ref.state.activityCommitments?.commitmentLevels?.hobbies).toBe(1);
    // A hobby practice does not touch the other three axes.
    expect(ref.state.activityCommitments?.commitmentLevels?.career).toBe(0);
    expect(ref.state.activityCommitments?.commitmentLevels?.relationships).toBe(0);
    expect(ref.state.activityCommitments?.commitmentLevels?.health).toBe(0);
  });

  it('a committed hobby grows faster (+2) than an uncommitted one', () => {
    const base = createTestGameState();
    const state = createTestGameState({
      stats: { ...base.stats, energy: 100 },
      activityCommitments: {
        primary: 'hobbies', secondary: undefined,
        commitmentLevels: { career: 0, hobbies: 10, relationships: 0, health: 0 },
      },
    });
    const { ref, setGameState } = harness(state);
    practicePursuit(ref.state, setGameState, 'running');
    expect(ref.state.activityCommitments?.commitmentLevels?.hobbies).toBe(12); // +2 committed
  });
});
