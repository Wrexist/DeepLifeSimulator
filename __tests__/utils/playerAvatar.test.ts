/**
 * Layered player avatar — config codec, sex carry, and the aging layer swap.
 */
import {
  AVATAR_HAIRS,
  AVATAR_HAIR_COLORS,
  AVATAR_SKIN_TONES,
  buildPlayerAvatarSvg,
  decodePlayerAvatarConfig,
  encodePlayerAvatarConfig,
  playerAvatarOptions,
  playerAvatarSexFromId,
  randomPlayerAvatarConfig,
  type PlayerAvatarConfig,
} from '@/utils/playerAvatar';
import { avatarSexFromId } from '@/utils/facePool';

const CFG: PlayerAvatarConfig = {
  v: 1,
  sex: 'female',
  skin: 'ecad80',
  hair: AVATAR_HAIRS[0],
  hairColor: '562306',
  glasses: false,
};

describe('playerAvatar codec', () => {
  it('round-trips a config through encode/decode', () => {
    expect(decodePlayerAvatarConfig(encodePlayerAvatarConfig(CFG))).toEqual(CFG);
  });

  it('returns null for legacy face-pool ids and garbage', () => {
    expect(decodePlayerAvatarConfig('m3')).toBeNull();
    expect(decodePlayerAvatarConfig('f12')).toBeNull();
    expect(decodePlayerAvatarConfig(undefined)).toBeNull();
    expect(decodePlayerAvatarConfig(null)).toBeNull();
    expect(decodePlayerAvatarConfig('dl1:not-json')).toBeNull();
    expect(decodePlayerAvatarConfig('dl1:{"v":2}')).toBeNull();
  });

  it('carries sex through the id (and facePool delegates to it)', () => {
    const id = encodePlayerAvatarConfig(CFG);
    expect(playerAvatarSexFromId(id)).toBe('female');
    expect(avatarSexFromId(id)).toBe('female');
    // Legacy ids still resolve through the old path.
    expect(avatarSexFromId('m3')).toBe('male');
    expect(playerAvatarSexFromId('m3')).toBeUndefined();
  });
});

describe('randomPlayerAvatarConfig', () => {
  it('produces valid configs from the palettes', () => {
    for (const sex of ['male', 'female', 'random'] as const) {
      const cfg = randomPlayerAvatarConfig(sex);
      expect(['male', 'female']).toContain(cfg.sex);
      if (sex !== 'random') expect(cfg.sex).toBe(sex);
      expect(AVATAR_SKIN_TONES).toContain(cfg.skin);
      expect(AVATAR_HAIRS).toContain(cfg.hair);
      expect(AVATAR_HAIR_COLORS).toContain(cfg.hairColor);
    }
  });
});

describe('aging layer swap', () => {
  it('keeps the chosen hair color through mid-life', () => {
    expect(playerAvatarOptions(CFG, 30).hairColor).toEqual(['562306']);
    expect(playerAvatarOptions(CFG, 49).hairColor).toEqual(['562306']);
  });

  it('greys hair at 50 and goes white with glasses at 65', () => {
    expect(playerAvatarOptions(CFG, 50).hairColor).toEqual(['afafaf']);
    const senior = playerAvatarOptions(CFG, 65);
    expect(senior.hairColor).toEqual(['e8e6e1']);
    expect(senior.glassesProbability).toBe(100);
  });

  it('respects the player-chosen glasses at any age', () => {
    expect(playerAvatarOptions({ ...CFG, glasses: true }, 25).glassesProbability).toBe(100);
    expect(playerAvatarOptions(CFG, 25).glassesProbability).toBe(0);
  });

  it('never crashes on a non-finite age', () => {
    expect(playerAvatarOptions(CFG, NaN).hairColor).toEqual(['562306']);
  });
});

describe('buildPlayerAvatarSvg', () => {
  it('renders deterministic SVG for the same inputs', () => {
    const a = buildPlayerAvatarSvg(CFG, 25, 96);
    const b = buildPlayerAvatarSvg(CFG, 25, 96);
    expect(a).toBe(b);
    expect(a.startsWith('<svg')).toBe(true);
  });

  it('changes output as the character ages across a threshold', () => {
    expect(buildPlayerAvatarSvg(CFG, 25)).not.toBe(buildPlayerAvatarSvg(CFG, 70));
  });
});
