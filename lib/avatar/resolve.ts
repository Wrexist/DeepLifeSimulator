/**
 * Turning whatever a save happens to hold into a face.
 *
 * Three generations of data have to resolve here without a migration writing
 * anything:
 *
 *   1. `userProfile.avatar` — an encoded `AvatarConfig`. The new format.
 *   2. `userProfile.avatarId` — the legacy `<m|f><index>` pick from the
 *      portrait pool. Still on every save written before this shipped.
 *   3. Neither — an NPC, or a save old enough to predate the picker.
 *
 * Cases 2 and 3 both fall through to a face seeded from a stable string, which
 * is why `userProfile.avatar` needs no backfill: an absent key already produces
 * a stable, sensible face, and it produces the SAME one on every load.
 *
 * Deriving rather than backfilling also keeps the catalogs free to grow. A
 * migration that stamped today's indices into every save would freeze this
 * catalog order into them forever, and appending a hair style later would
 * silently re-roll every character that had been stamped.
 */
import { decodeAvatar } from './encode';
import { avatarFromSeed, normalizeAvatar } from './random';
import type { AvatarConfig, AvatarSex } from './types';

/** The subset of a profile this needs. Deliberately structural, not `UserProfile`. */
export interface AvatarSource {
  avatar?: string;
  avatarId?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  sex?: string;
}

/** Normalizes anything the save calls a sex down to the two the renderer draws. */
export function toAvatarSex(sex: string | undefined | null, fallback: AvatarSex = 'male'): AvatarSex {
  if (sex === 'female' || sex === 'f') return 'female';
  if (sex === 'male' || sex === 'm') return 'male';
  return fallback;
}

/**
 * A stable seed for a character with no stored config.
 *
 * The legacy `avatarId` is folded in when present so a player who picked the
 * fourth face keeps a face derived from that pick rather than from their name
 * alone — two characters called Alex Smith who picked different portraits stay
 * different people.
 */
export function avatarSeedFor(source: AvatarSource | undefined | null): string {
  const s = source ?? {};
  const name = s.name ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  return `${name || 'anon'}|${s.avatarId ?? ''}`;
}

/** The face for a character. Never throws and never returns undefined. */
export function resolveAvatar(
  source: AvatarSource | undefined | null,
  fallbackSex: AvatarSex = 'male'
): AvatarConfig {
  const stored = decodeAvatar(source?.avatar);
  if (stored) return stored;
  return avatarFromSeed(avatarSeedFor(source), toAvatarSex(source?.sex, fallbackSex));
}

/** The face for an NPC identified only by a seed string. */
export function resolveNpcAvatar(
  seed: string | undefined | null,
  sex: string | undefined | null,
  fallbackSex: AvatarSex = 'female'
): AvatarConfig {
  return avatarFromSeed(seed || 'anon', toAvatarSex(sex, fallbackSex));
}

/** Re-exported so callers need one import to get a usable, clamped config. */
export { normalizeAvatar };
