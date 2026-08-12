/**
 * The convenience wrapper most screens should use.
 *
 * `VectorAvatar` takes a resolved `AvatarConfig`; almost every call site
 * instead has whatever the save happens to hold — a profile with an encoded
 * config, a legacy `avatarId`, or nothing but a name. This resolves that once
 * and renders, so a screen never has to know which of the three it got.
 *
 * Use `VectorAvatar` directly only where the config is being EDITED and has to
 * update live, as in the character creator.
 */
import React, { useMemo } from 'react';
import VectorAvatar from './VectorAvatar';
import { resolveAvatar, resolveNpcAvatar, toAvatarSex, type AvatarSource } from '@/lib/avatar/resolve';
import type { AvatarSex } from '@/lib/avatar/types';

export interface CharacterAvatarProps {
  /** A profile-shaped object. Prefer this — it can carry a stored config. */
  source?: AvatarSource | null;
  /**
   * Fallback identity for characters with no profile object (NPCs, relatives).
   * Ignored when `source` carries a stored config.
   */
  seed?: string | null;
  sex?: string | null;
  age?: number;
  size?: number;
  backdrop?: boolean;
  circular?: boolean;
  /** Used when neither the source nor `sex` names one. */
  fallbackSex?: AvatarSex;
}

function CharacterAvatarImpl({
  source,
  seed,
  sex,
  age = 25,
  size = 64,
  backdrop = true,
  circular = true,
  fallbackSex = 'male',
}: CharacterAvatarProps) {
  const config = useMemo(() => {
    if (source) return resolveAvatar(source, fallbackSex);
    return resolveNpcAvatar(seed, sex, fallbackSex);
  }, [source, seed, sex, fallbackSex]);

  const drawnSex = toAvatarSex(source?.sex ?? sex, fallbackSex);

  return (
    <VectorAvatar
      config={config}
      sex={drawnSex}
      age={age}
      size={size}
      backdrop={backdrop}
      circular={circular}
    />
  );
}

const CharacterAvatar = React.memo(CharacterAvatarImpl);
CharacterAvatar.displayName = 'CharacterAvatar';

export default CharacterAvatar;
