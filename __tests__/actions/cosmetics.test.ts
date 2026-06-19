import { createTestGameState } from '../helpers/createTestGameState';
import { equipCosmetic, unequipCosmetic, toggleCosmetic } from '@/contexts/game/actions/CosmeticActions';
import { getCosmetic, resolveOwnedCosmetics } from '@/lib/cosmetics/cosmetics';

describe('cosmetics catalog', () => {
  it('resolves known ids from the registry', () => {
    expect(getCosmetic('legacy_frame_s_free')).toMatchObject({ type: 'frame' });
    expect(getCosmetic('legacy_theme_s_10')).toMatchObject({ type: 'theme' });
  });

  it('falls back by pattern for unregistered legacy ids', () => {
    expect(getCosmetic('legacy_theme_s_99')).toMatchObject({ type: 'theme' });
    expect(getCosmetic('legacy_frame_x')).toMatchObject({ type: 'frame' });
  });

  it('returns undefined for unknown ids', () => {
    expect(getCosmetic('not_a_cosmetic')).toBeUndefined();
  });

  it('resolveOwnedCosmetics drops unknown ids', () => {
    const resolved = resolveOwnedCosmetics(['legacy_frame_s_free', 'garbage', 'legacy_theme_s_10']);
    expect(resolved.map((c) => c.id)).toEqual(['legacy_frame_s_free', 'legacy_theme_s_10']);
    expect(resolveOwnedCosmetics(undefined)).toEqual([]);
  });
});

const withOwned = (...ids: string[]) =>
  createTestGameState({
    legacyPass: {
      seasonId: 's', xp: 0, premiumOwned: false,
      claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: ids,
    },
  });

describe('CosmeticActions', () => {
  it('equips an owned cosmetic into its slot', () => {
    const next = equipCosmetic(withOwned('legacy_frame_s_free'), 'legacy_frame_s_free');
    expect(next.equippedCosmetics?.frame).toBe('legacy_frame_s_free');
  });

  it('refuses to equip a cosmetic the player does not own', () => {
    const s = withOwned();
    expect(equipCosmetic(s, 'legacy_frame_s_free')).toBe(s);
  });

  it('refuses to equip an unknown id', () => {
    const s = withOwned('whatever');
    expect(equipCosmetic(s, 'not_a_cosmetic')).toBe(s);
  });

  it('replaces the same-slot cosmetic when equipping another of the same type', () => {
    let s = withOwned('legacy_theme_s_10', 'legacy_theme_s_20');
    s = equipCosmetic(s, 'legacy_theme_s_10');
    s = equipCosmetic(s, 'legacy_theme_s_20');
    expect(s.equippedCosmetics?.theme).toBe('legacy_theme_s_20');
  });

  it('keeps frame and theme in independent slots', () => {
    let s = withOwned('legacy_frame_s_free', 'legacy_theme_s_10');
    s = equipCosmetic(s, 'legacy_frame_s_free');
    s = equipCosmetic(s, 'legacy_theme_s_10');
    expect(s.equippedCosmetics).toEqual({ frame: 'legacy_frame_s_free', theme: 'legacy_theme_s_10' });
  });

  it('unequips a slot', () => {
    let s = equipCosmetic(withOwned('legacy_frame_s_free'), 'legacy_frame_s_free');
    s = unequipCosmetic(s, 'frame');
    expect(s.equippedCosmetics?.frame).toBeUndefined();
  });

  it('toggle equips then unequips the same cosmetic', () => {
    const owned = withOwned('legacy_theme_s_10');
    const equipped = toggleCosmetic(owned, 'legacy_theme_s_10');
    expect(equipped.equippedCosmetics?.theme).toBe('legacy_theme_s_10');
    const cleared = toggleCosmetic(equipped, 'legacy_theme_s_10');
    expect(cleared.equippedCosmetics?.theme).toBeUndefined();
  });

  it('does not mutate the input state', () => {
    const s = withOwned('legacy_frame_s_free');
    equipCosmetic(s, 'legacy_frame_s_free');
    expect(s.equippedCosmetics).toBeUndefined();
  });
});
