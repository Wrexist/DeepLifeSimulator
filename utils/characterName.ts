/**
 * The character's display name.
 *
 * ## Why this is not `userProfile.name`
 *
 * `userProfile.name` is a HANDLE, and it defaults to `"player"`. The name the
 * game actually shows a player is `firstName` + `lastName`, which is what the
 * identity card, the save-slot list and the main menu all render.
 *
 * Reading the wrong one is not a cosmetic slip. It shipped on the death
 * screen — the most emotionally loaded moment in the game — where a character
 * the player had named and lived sixty years as was eulogised as "Player". It
 * shipped in mail, where every document was addressed to `player@deepmail.com`.
 * Both surfaces looked finished and neither was, because the wrong field is
 * still a string and still renders.
 *
 * So it lives here, once, and both callers import it. That is the entire point:
 * the bug was never that the resolution is hard, it is that it was written
 * twice and one copy read the wrong key.
 */

import type { GameState } from '@/contexts/game/types';

/**
 * `"Thomas White"`, or `''` when the save genuinely has no name yet.
 *
 * Falls back to the handle only when there is no first or last name to build
 * from — a degraded or mid-migration save. Callers decide what an empty string
 * should read as, because the right answer differs: mail derives an address
 * from it, the death screen wants "Unknown Soul".
 */
export function characterName(state: GameState | null | undefined): string {
  const profile = state?.userProfile;
  return (
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    profile?.name ||
    ''
  ).trim();
}
