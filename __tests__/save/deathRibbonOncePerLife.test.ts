/**
 * LATE-13 (v57): one death ribbon and one capstone Legacy Point payout per life.
 *
 * `applyDeathRibbon` fired on every rising edge of `showDeathPopup`. A revive
 * (`reviveCharacter` / `reviveWithPack`) clears the popup but keeps
 * `legacyPoints` and the ribbon collection, so the same life's next death paid
 * the capstone again and appended a second ribbon. A Time Machine rewind had the
 * same hole, because the collection is carried from the live state while the
 * snapshot predates the death.
 */
import { applyDeathRibbon } from '@/contexts/game/actions/weekly/applyDeathRibbon';
import { createCheckpoint, rewindToCheckpoint } from '@/lib/timeMachine/checkpointSystem';
import { lifeSalt } from '@/utils/seededRoll';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** A family life: completes a capstone, so the death pays Legacy Points. */
function familyLife(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState({ lineageId: 'life_late13', generationNumber: 1, weeksLived: 2_000, ...overrides });
  return {
    ...s,
    family: {
      ...s.family,
      spouse: { id: 'sp', name: 'Alex', type: 'spouse', relationshipScore: 80, personality: 'kind', gender: 'female', age: 40 },
      children: [1, 2, 3].map((n) => ({
        id: `c${n}`, name: `Kid ${n}`, type: 'child' as const, relationshipScore: 70, personality: 'curious', gender: 'female' as const, age: 10,
      })),
    },
  };
}

const die = (prevState: GameState) =>
  applyDeathRibbon({ prevState, newStats: prevState.stats, nextWeeksLived: prevState.weeksLived, newShowDeathPopup: true });

/** Apply a death's results the way the tick does, then revive. */
function deathThenRevive(life: GameState): GameState {
  const death = die(life);
  return {
    ...life,
    ...death.partial,
    legacyPoints: (life.legacyPoints ?? 0) + death.legacyBonus,
    showDeathPopup: false, // the revive
  };
}

describe('a life is paid its death ribbon once (LATE-13)', () => {
  it('control: the first death pays the capstone and records the ribbon, stamped with the life', () => {
    const life = familyLife();
    const death = die(life);
    expect(death.legacyBonus).toBeGreaterThan(0);
    expect(death.partial.ribbonCollection?.earned.length).toBe((life.ribbonCollection?.earned.length ?? 0) + 1);
    expect(death.partial.deathRibbonPaidForLife).toBe(lifeSalt(life));
  });

  it('a revive and a second death of the SAME life pays nothing and adds no ribbon', () => {
    const revived = deathThenRevive(familyLife());
    const second = die(revived);
    expect(second.legacyBonus).toBe(0);
    expect(second.partial).toEqual({});
  });

  it('a NEW life (an heir, or a prestige reset with a fresh lineage) is paid again', () => {
    const revived = deathThenRevive(familyLife());
    const heir = { ...revived, generationNumber: 2 };
    expect(die(heir).legacyBonus).toBeGreaterThan(0);
    const reset = { ...revived, lineageId: 'life_after_prestige' };
    expect(die(reset).legacyBonus).toBeGreaterThan(0);
  });

  it('absent marker (every pre-v57 save) pays, as it always did', () => {
    const life = familyLife();
    expect(life.deathRibbonPaidForLife).toBeUndefined();
    expect(die(life).legacyBonus).toBeGreaterThan(0);
  });

  it('a Time Machine rewind to before the death carries the marker from the live state', () => {
    const before = familyLife({ stats: { ...familyLife().stats, gems: 10_000 } });
    const checkpoint = createCheckpoint(before, 'Age 56');
    const afterDeath: GameState = { ...deathThenRevive(before), checkpoints: [checkpoint] };
    expect(afterDeath.deathRibbonPaidForLife).toBe(lifeSalt(before));

    const restored = rewindToCheckpoint(afterDeath, checkpoint.id);
    expect(restored).not.toBeNull();
    expect(restored!.deathRibbonPaidForLife).toBe(lifeSalt(before));
    const again = die({ ...restored!, showDeathPopup: false });
    expect(again.legacyBonus).toBe(0);
    expect(again.partial).toEqual({});
  });
});
