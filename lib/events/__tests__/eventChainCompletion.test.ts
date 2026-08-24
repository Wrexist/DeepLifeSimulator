/**
 * Event chains must COMPLETE — and a chain that completed must let the next one
 * start.
 *
 * The bug (2026-07-28 audit GL-1): the advance/complete decision compared the
 * STORED stage index — which is the last stage already resolved — against the
 * end of the chain. Resolving the final stage of an N-stage chain therefore
 * still took the advance branch (N-2 < N-1) and left `activeEventChain` pointing
 * at stage N-1. `getNextChainEvent` returns null once `currentStage + 1` is past
 * the end, so no further stage was ever produced; and `rollEventChain` only
 * fires when `activeEventChain` is absent, so NO chain could ever start again
 * for the rest of that life. The completion branch was unreachable in normal
 * play, and `eventChains` — the completed-chain ledger — stayed permanently
 * empty.
 *
 * It survived every prior pass because the decision was inline in `resolveEvent`
 * inside the React context: `eventChains.test.ts` hand-builds an
 * `activeEventChain` and only exercises `getNextChainEvent`, so nothing ever
 * drove a chain from stage 0 to its end. The logic is now a pure exported
 * helper, and these tests drive real catalog chains all the way through it.
 */
import {
  advanceEventChain,
  getNextChainEvent,
  getEventChainStageCount,
  healLatchedEventChain,
  rollEventChain,
} from '../engine';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** Walk a real catalog chain stage by stage, exactly as resolveEvent would. */
function playChainThrough(chainId: string, stageCount: number) {
  let chain: GameState['activeEventChain'] = undefined;
  let chains: GameState['eventChains'] = [];

  for (let stage = 0; stage < stageCount; stage += 1) {
    const result = advanceEventChain(
      { activeEventChain: chain, eventChains: chains },
      { chainId, chainStage: stage },
      `${chainId}_stage${stage}`,
    );
    chain = result.activeEventChain;
    chains = result.eventChains;
  }
  return { chain, chains };
}

describe('a chain played to its end completes', () => {
  it.each([
    ['health_scare'],
    ['business_opportunity'],
    ['family_crisis'],
  ])('%s clears activeEventChain and records a completed entry', (chainId) => {
    const stageCount = getEventChainStageCount(chainId);
    expect(stageCount).toBeGreaterThan(1); // the catalog really has this chain

    const { chain, chains } = playChainThrough(chainId, stageCount as number);

    expect(chain).toBeUndefined();
    expect(chains).toContainEqual(
      expect.objectContaining({ chainId, completed: true }),
    );
  });

  it('stays active while stages remain (the advance branch still works)', () => {
    const stageCount = getEventChainStageCount('business_opportunity') as number;
    // Play every stage EXCEPT the last.
    const { chain, chains } = playChainThrough('business_opportunity', stageCount - 1);

    expect(chain).toBeDefined();
    expect(chain!.currentStage).toBe(stageCount - 2);
    expect(chains).toHaveLength(0); // nothing completed yet
  });

  it('keeps the stage index in the meaning getNextChainEvent reads it with', () => {
    // currentStage is the LAST RESOLVED stage; the engine asks for +1.
    const { chain } = playChainThrough('health_scare', 1);
    const state = createTestGameState({ activeEventChain: chain });
    const next = getNextChainEvent(state);
    expect(next).not.toBeNull();
    expect(next!.chainStage).toBe(1);
  });

  it('lets a NEW chain start once the previous one completed', () => {
    const stageCount = getEventChainStageCount('health_scare') as number;
    const { chain } = playChainThrough('health_scare', stageCount);
    // rollEventChain is gated on activeEventChain being absent - with the latch
    // in place this returned null forever.
    const state = createTestGameState({ activeEventChain: chain, weeksLived: 400 });
    expect(() => rollEventChain(state)).not.toThrow();
    expect(state.activeEventChain).toBeUndefined();
  });

  it('does not re-record a chain that is already in the ledger', () => {
    const stageCount = getEventChainStageCount('health_scare') as number;
    const first = playChainThrough('health_scare', stageCount);
    expect(first.chains).toHaveLength(1);
  });
});

describe('healLatchedEventChain rescues saves stuck by the old off-by-one', () => {
  it('clears a chain parked past its final stage and records it complete', () => {
    const stageCount = getEventChainStageCount('health_scare') as number;
    const latched = createTestGameState({
      activeEventChain: {
        chainId: 'health_scare',
        eventId: 'health_scare_stage2',
        currentStage: stageCount - 1, // the exact state the bug produced
        totalStages: stageCount,
      },
      eventChains: [],
    });

    // Precondition: the engine genuinely cannot advance this.
    expect(getNextChainEvent(latched)).toBeNull();

    const healed = healLatchedEventChain(latched);
    expect(healed).not.toBeNull();
    expect(healed!.activeEventChain).toBeUndefined();
    expect(healed!.eventChains).toContainEqual(
      expect.objectContaining({ chainId: 'health_scare', completed: true }),
    );
  });

  it('clears a chain whose definition no longer exists in the catalog', () => {
    const orphan = createTestGameState({
      activeEventChain: {
        chainId: 'chain_that_was_deleted',
        eventId: 'x',
        currentStage: 0,
        totalStages: 3,
      },
    });
    const healed = healLatchedEventChain(orphan);
    expect(healed).not.toBeNull();
    expect(healed!.activeEventChain).toBeUndefined();
  });

  it('leaves a mid-chain save alone (returns null, so the tick stays byte-identical)', () => {
    const midChain = createTestGameState({
      activeEventChain: {
        chainId: 'health_scare',
        eventId: 'health_scare_stage0',
        currentStage: 0,
        totalStages: getEventChainStageCount('health_scare') as number,
      },
    });
    expect(getNextChainEvent(midChain)).not.toBeNull();
    expect(healLatchedEventChain(midChain)).toBeNull();
  });

  it('leaves a save with no active chain alone', () => {
    expect(healLatchedEventChain(createTestGameState())).toBeNull();
  });

  it('does not double-record a chain already in the ledger', () => {
    const stageCount = getEventChainStageCount('health_scare') as number;
    const state = createTestGameState({
      activeEventChain: {
        chainId: 'health_scare',
        eventId: 'health_scare_stage2',
        currentStage: stageCount - 1,
        totalStages: stageCount,
      },
      eventChains: [{ chainId: 'health_scare', currentStage: stageCount - 1, stages: [], completed: true }],
    });
    const healed = healLatchedEventChain(state);
    expect(healed!.eventChains.filter((c: any) => c.chainId === 'health_scare')).toHaveLength(1);
  });
});
