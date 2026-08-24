/**
 * SKILL_BOOST ($12.99) — a real-money no-op until 2026-08-23.
 *
 * The grant looped `gameState.hobbies`, the REMOVED skill system: deprecated
 * in types, seeded `[]`, written by nothing in production. Zero loop
 * iterations for every real save, repeatedly purchasable (consumable, no
 * ownership flag). The live skill system is pursuits; the grant now pays
 * `skillBoost` LEVELS of XP to all 18, and the copy says what the 0-10 system
 * can actually deliver.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { IAP_PRODUCTS, PRODUCT_CONFIGS } from '@/utils/iapConfig';
import { PURSUITS, XP_PER_LEVEL, MAX_PURSUIT_LEVEL, levelFromXp } from '@/lib/pursuits/pursuitMastery';
import { iapService } from '@/services/IAPService';

const config = PRODUCT_CONFIGS[IAP_PRODUCTS.SKILL_BOOST] as { skillBoost: number; description: string };

describe('the grant', () => {
  it('levels every pursuit, not the dead hobbies array', () => {
    const state: GameState = createTestGameState();
    expect(state.hobbies || []).toEqual([]); // the precondition that made the old grant a no-op

    iapService.applyProductToState(state, IAP_PRODUCTS.SKILL_BOOST);

    for (const def of PURSUITS) {
      const p = state.pursuits?.[def.id];
      expect(p).toBeDefined();
      expect(p!.level).toBe(config.skillBoost);
      expect(p!.xp).toBe(config.skillBoost * XP_PER_LEVEL);
    }
  });

  it('adds on top of existing progress and respects the level cap', () => {
    const state: GameState = createTestGameState();
    const first = PURSUITS[0].id;
    state.pursuits = {
      [first]: { xp: (MAX_PURSUIT_LEVEL - 1) * XP_PER_LEVEL, level: MAX_PURSUIT_LEVEL - 1 },
    };

    iapService.applyProductToState(state, IAP_PRODUCTS.SKILL_BOOST);

    const boosted = state.pursuits[first];
    expect(boosted.level).toBe(MAX_PURSUIT_LEVEL);
    expect(boosted.xp).toBe(MAX_PURSUIT_LEVEL * XP_PER_LEVEL);
    expect(levelFromXp(boosted.xp)).toBe(MAX_PURSUIT_LEVEL);
  });
});

describe('the copy', () => {
  it('promises only what the 0-10 pursuit system can deliver', () => {
    // The old "+50 levels" was written for the deleted hobby system and was
    // unfulfillable in a 10-level system — a paid promise nothing could keep.
    expect(config.description).not.toMatch(/\+50/);
    expect(config.skillBoost).toBeLessThanOrEqual(MAX_PURSUIT_LEVEL);
    expect(config.description).toContain(`+${config.skillBoost}`);
  });
});
