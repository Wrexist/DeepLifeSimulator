/**
 * LIFE-3 (owner decision 2026-10-22): the first prestige pays challenge gems
 * ONLY for the challenge the life chose (`getScenario(state.scenarioId)`).
 *
 * It used to walk every SCENARIOS entry and pay each one whose conditions
 * happened to hold, so a life-path player who never picked a challenge
 * collected premium gems for runs they never started.
 */
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getScenario, isScenarioCompleted, SCENARIOS } from '@/lib/scenarios/scenarioDefinitions';
import { projectScenarioState } from '@/lib/scenarios/progress';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const WORLD_TRAVELER = getScenario('world_traveler');

/** A $10M+ life with $250k cash and rep 60: clears several challenges at once. */
function richLife(scenarioId: string | undefined): GameState {
  const base = createTestGameState();
  return createTestGameState({
    scenarioId,
    stats: { ...base.stats, money: 250_000, reputation: 60, gems: 0 },
    bankSavings: 0,
    stocks: {
      ...base.stocks!,
      holdings: [{ symbol: 'ACME', shares: 1_000, currentPrice: 12_000, averagePrice: 10_000 }] as never,
    },
    realEstate: [],
    companies: [],
    prestige: { ...base.prestige!, totalPrestiges: 0, prestigeLevel: 0 },
  });
}

const gemsFrom = (state: GameState): number => executePrestige(state, 'reset').stats.gems ?? 0;

describe('LIFE-3 - only the chosen challenge pays at first prestige', () => {
  it('premise: the rich life clears more than one challenge at once', () => {
    const projected = projectScenarioState(richLife(undefined));
    const cleared = SCENARIOS.filter((s) => isScenarioCompleted(s.id, projected));
    expect(cleared.length).toBeGreaterThan(1);
    expect(cleared.map((s) => s.id)).toContain('world_traveler');
  });

  it('a life with no challenge earns no challenge gems', () => {
    expect(executePrestige(richLife(undefined), 'reset').prestige?.totalPrestiges).toBe(1);
    expect(gemsFrom(richLife(undefined))).toBe(0);
  });

  it('a life-path scenario id (not a challenge) earns no challenge gems', () => {
    expect(getScenario('not_a_challenge_id')).toBeUndefined();
    expect(gemsFrom(richLife('not_a_challenge_id'))).toBe(0);
  });

  it('the chosen, completed challenge pays exactly its own reward', () => {
    expect(WORLD_TRAVELER?.rewards?.gems).toBeGreaterThan(0);
    expect(gemsFrom(richLife('world_traveler'))).toBe(WORLD_TRAVELER?.rewards?.gems);
  });

  it('a chosen challenge that was NOT completed pays nothing, even when others were', () => {
    const projected = projectScenarioState(richLife(undefined));
    const unmet = SCENARIOS.find((s) => !isScenarioCompleted(s.id, projected) && (s.rewards?.gems ?? 0) > 0);
    if (!unmet) throw new Error('every challenge is met by the fixture - pick a poorer one');
    expect(gemsFrom(richLife(unmet.id))).toBe(0);
  });
});
