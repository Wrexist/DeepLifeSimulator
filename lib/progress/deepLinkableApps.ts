/**
 * Which app ids a `?app=<id>` deep link is allowed to open.
 *
 * The Apps tab accepts an app id from another screen (the Family tab's "Open
 * the dating app", for one) and hands it to whichever launcher is mounted,
 * which opens it directly. That path skips the grid entirely — and the grid
 * tile is where the padlock lives. Without this check `?app=onion` opens a
 * tier-5 app on a week-1 save, and `?app=nonsense` reaches the launcher's
 * component lookup, where an unknown id resolves to `undefined` and throws
 * "Element type is invalid".
 *
 * So a deep link has to pass the same three tests a tile does:
 *   1. the id is a real app in the launcher that is mounted,
 *   2. it is available for this save (`available: false` means "does not exist
 *      here", which is different from "not yet"), and
 *   3. it is unlocked — the same `app:<id>` gate `featureUnlocks` applies.
 *
 * Both launchers call this so the rule cannot drift between them.
 */
import type { GameState } from '@/contexts/game/types';
import { isFeatureUnlocked } from './featureUnlocks';

/** The shape both launchers' app lists share — only the fields the gate reads. */
export interface DeepLinkableApp {
  id: string;
  available?: boolean;
}

export function canOpenAppId(
  state: GameState | undefined | null,
  appId: string | undefined | null,
  apps: readonly DeepLinkableApp[],
): boolean {
  if (!appId) return false;
  const app = apps.find((a) => a.id === appId);
  if (!app || app.available === false) return false;
  return isFeatureUnlocked(state, `app:${appId}`);
}
