/**
 * Whose face a family member inherits.
 *
 * The save has tracked genetic traits on children since v13 and on
 * grandchildren since v34, and none of it was ever visible — every child got an
 * unrelated portrait from the pool. This is the piece that makes the
 * inheritance in `./inherit` actually reach the screen: it works out which two
 * people a child descends from, so their face can be derived from both.
 *
 * Nothing here is stored. A child's face is recomputed from its id plus its
 * parents' configs, which means it is stable across loads AND stays correct if
 * the player later edits their own appearance.
 */
import { inheritAvatar } from './inherit';
import { resolveAvatar, toAvatarSex, type AvatarSource } from './resolve';
import type { AvatarConfig, AvatarSex } from './types';

/** The two people a child's face is derived from. Either may be unknown. */
export interface ParentSources {
  mother?: AvatarSource;
  father?: AvatarSource;
}

interface RelationshipLike {
  type?: string;
  name?: string;
  gender?: string;
  id?: string;
}

interface GameStateLike {
  userProfile?: AvatarSource & { sex?: string };
  relationships?: RelationshipLike[] | null;
}

/**
 * The player and their current partner, sorted into mother and father.
 *
 * A same-sex couple simply fills both slots in whatever order they land;
 * `inheritAvatar` treats the two symmetrically apart from which one it reads
 * first, so nothing here needs to encode who gave birth.
 */
export function childParentSources(state: GameStateLike | undefined | null): ParentSources {
  const profile = state?.userProfile;
  const relationships = Array.isArray(state?.relationships) ? state!.relationships! : [];

  // A spouse outranks a partner; both outrank nobody.
  const partner =
    relationships.find((r) => r?.type === 'spouse') ?? relationships.find((r) => r?.type === 'partner');

  const playerSex = toAvatarSex(profile?.sex, 'male');
  const partnerSource: AvatarSource | undefined = partner
    ? { name: partner.name, sex: partner.gender, avatarId: undefined }
    : undefined;

  if (playerSex === 'female') {
    return { mother: profile ?? undefined, father: partnerSource };
  }
  return { mother: partnerSource, father: profile ?? undefined };
}

/**
 * A child's face.
 *
 * `seed` must be the child's stable id — using their name would give siblings
 * with the same name identical faces, and would re-roll the face if a child is
 * ever renamed.
 */
export function resolveChildAvatar(
  seed: string,
  childSex: AvatarSex,
  parents: ParentSources | undefined
): AvatarConfig {
  const mother = parents?.mother ? resolveAvatar(parents.mother, 'female') : undefined;
  const father = parents?.father ? resolveAvatar(parents.father, 'male') : undefined;
  return inheritAvatar(mother, father, seed, childSex);
}
