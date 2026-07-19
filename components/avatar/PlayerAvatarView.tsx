/**
 * PlayerAvatarView — the one way to draw the player's face.
 *
 * New layered avatars (a `dl1:` config in avatarId) render as an SVG that ages
 * with the character (utils/playerAvatar). Legacy face-pool ids and profiles
 * with no avatar keep the exact old behavior via utils/facePool, so existing
 * saves are untouched.
 */
import React, { useMemo } from 'react';
import { Image, StyleProp, View, ViewStyle, ImageStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { buildPlayerAvatarSvg, decodePlayerAvatarConfig } from '@/utils/playerAvatar';
import { getAvatarPortrait } from '@/utils/facePool';

interface PlayerAvatarViewProps {
  /** userProfile.avatarId — layered config, legacy pool id, or absent. */
  avatarId?: string | null;
  /** Current age — drives the aging layers / age band. */
  age: number;
  /** Fallback sex for the legacy path. */
  sex: string;
  /** Fallback seed (player name) for the legacy path. */
  seed?: string | null;
  /** Rendered square size in px. */
  size: number;
  /** Extra styling (border, shadow…) — applied to the outer element. */
  style?: StyleProp<ViewStyle & ImageStyle>;
}

export default function PlayerAvatarView({ avatarId, age, sex, seed, size, style }: PlayerAvatarViewProps) {
  const cfg = useMemo(() => decodePlayerAvatarConfig(avatarId), [avatarId]);

  // Regenerate only when the config or the aging thresholds change — the SVG
  // is a pure function of (config, age bracket), not of every re-render.
  const ageKey = !Number.isFinite(age) ? 'ad' : age >= 65 ? 'sr' : age >= 50 ? 'mid' : age < 18 ? 'yng' : 'ad';
  const xml = useMemo(
    () => (cfg ? buildPlayerAvatarSvg(cfg, age, size) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, ageKey, size]
  );

  if (cfg && xml) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: '#1E293B',
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <SvgXml xml={xml} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <Image
      source={getAvatarPortrait(avatarId, age, seed, sex)}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}
