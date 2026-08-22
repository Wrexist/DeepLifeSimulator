/**
 * Two things bought in the same millisecond get two different ids.
 *
 * Four call sites minted ids as `${prefix}_${Date.now()}_${rand(0..999)}` — a
 * millisecond plus one of a THOUSAND suffixes. At 1/1000 per same-millisecond
 * pair this is not a theoretical collision; it reproduced as a flaky failure in
 * `rdLabPetDoubleCharge.test.ts`, whose "two separate taps DO buy two pets"
 * control drew a colliding suffix and got one pet.
 *
 * The pet case is the destructive one. `buyPet` rejects a duplicate id inside
 * its updater ON PURPOSE, so a re-invoked updater cannot append the same pet
 * twice. A collision between two GENUINE purchases hits that same guard: the
 * second pet vanishes, no money is taken, and the caller still returns
 * `{ success: true, message: 'Welcome Rex!' }` — the player is told they bought
 * a pet they do not have.
 *
 * Both properties have to hold at once, which is what makes this worth pinning:
 * the same-call double invoke must still dedupe, and two separate calls must
 * still produce two pets.
 */

import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { mintId, mintUniqueId } from '@/utils/uniqueId';
import { buyPet } from '@/contexts/game/actions/PetActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';

describe('the minter', () => {
  it('never repeats, even for thousands of ids in the same millisecond', () => {
    const ids = Array.from({ length: 5_000 }, () => mintId('pet'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the prefix, so a future `startsWith` works on old and new ids', () => {
    expect(mintId('vid').startsWith('vid_')).toBe(true);
    expect(mintUniqueId('pet', []).startsWith('pet_')).toBe(true);
  });

  it('avoids ids already taken', () => {
    // Simulates the only case `mintId` alone cannot cover: a previous session,
    // whose counter started at 0 again.
    const taken = Array.from({ length: 200 }, () => mintId('pet'));
    const fresh = mintUniqueId('pet', taken);
    expect(taken).not.toContain(fresh);
  });

  it('tolerates a corrupt id list without throwing', () => {
    // Runs on a purchase path — a throw here costs the player the item.
    const messy = [undefined, null, '', 'pet_ok'] as (string | undefined | null)[];
    expect(() => mintUniqueId('pet', messy)).not.toThrow();
    expect(mintUniqueId('pet', messy)).not.toBe('pet_ok');
  });
});

describe('buyPet keeps both properties', () => {
  function harness(state: GameState) {
    let current = state;
    const updaters: ((prev: GameState) => GameState)[] = [];
    const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
      if (typeof u === 'function') updaters.push(u as (prev: GameState) => GameState);
    };
    return {
      setGameState,
      commit() {
        current = updaters.reduce((acc, u) => u(acc), current);
        return current;
      },
      /** Re-run the LAST updater against the committed state — a double invoke. */
      replayLast() {
        current = updaters[updaters.length - 1](current);
        return current;
      },
    };
  }

  const rich = () => createTestGameState({ stats: { money: 5_000_000 }, pets: [] });

  it('two separate purchases produce two pets with two ids', () => {
    const state = rich();
    const h = harness(state);
    buyPet(state, h.setGameState, 'dog', 'Rex', { updateMoney });
    const afterFirst = h.commit();
    buyPet(afterFirst, h.setGameState, 'dog', 'Bella', { updateMoney });
    const afterSecond = h.commit();

    const pets = afterSecond.pets ?? [];
    expect(pets).toHaveLength(2);
    expect(new Set(pets.map((p) => p.id)).size).toBe(2);
  });

  it('and 50 back-to-back purchases produce 50 distinct pets', () => {
    // The volume that makes a same-millisecond collision likely. Under the old
    // 1-of-1000 suffix this loses a pet roughly once every few runs.
    let state = rich();
    for (let i = 0; i < 50; i++) {
      const h = harness(state);
      buyPet(state, h.setGameState, 'dog', `Dog ${i}`, { updateMoney });
      state = h.commit();
    }
    const pets = state.pets ?? [];
    expect(pets).toHaveLength(50);
    expect(new Set(pets.map((p) => p.id)).size).toBe(50);
  });

  it('a re-invoked updater still cannot append the same pet twice (the control)', () => {
    // The property the duplicate-id guard exists for. Unique ids must not
    // weaken it.
    const state = rich();
    const h = harness(state);
    buyPet(state, h.setGameState, 'dog', 'Rex', { updateMoney });
    h.commit();
    const afterReplay = h.replayLast();
    expect(afterReplay.pets).toHaveLength(1);
  });
});
