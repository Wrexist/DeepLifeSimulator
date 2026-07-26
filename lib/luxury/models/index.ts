/**
 * Procedural showcase models for the luxury catalogue.
 *
 * Code-only 3D: every model is generated arithmetic, so the whole feature adds
 * **zero bytes of assets**. That matters here specifically — the catalogue's
 * flat artwork was already re-encoded from 25.1 MB down to 3.7 MB to protect the
 * app download, and shipping GLB meshes for a dozen trophies would have undone
 * that several times over.
 *
 * The existing JPEGs stay: they remain the list/card art. These models are for
 * the detail view, where a trophy should be something you can turn around.
 *
 * ## Scope, stated plainly
 *
 * Only the items listed below are built. The rest of the catalogue still uses
 * its flat artwork and is untouched — `buildLuxuryModel` returns null for them
 * and every caller falls back. Items were chosen for where procedural
 * reconstruction genuinely wins: hard-surface objects and surfaces of
 * revolution. Organic subjects (the racehorse) and sprawling scenes (the
 * private island, the vineyard) are deliberately NOT attempted, because
 * code-only reconstruction of those reads as a toy rather than a trophy.
 */

import { buildDiamondModel } from './diamond';
import { buildWatchModel } from './watch';
import { buildYachtModel } from './yacht';
import type { ProceduralModel } from './types';

export * from './types';
export { buildDiamondModel } from './diamond';
export { buildWatchModel } from './watch';
export { buildYachtModel } from './yacht';

/** Catalogue ids that have a 3D showcase model. */
export const LUXURY_MODEL_IDS = ['museum_diamond', 'rare_watch_collection', 'luxury_yacht', 'mega_yacht'] as const;

export type LuxuryModelId = (typeof LUXURY_MODEL_IDS)[number];

const BUILDERS: Record<string, () => ProceduralModel> = {
  museum_diamond: buildDiamondModel,
  rare_watch_collection: buildWatchModel,
  // Both yachts share a builder at different scales — the mega-yacht is the same
  // naval architecture with another deck, which is also true of the real thing.
  luxury_yacht: () => buildYachtModel('luxury'),
  mega_yacht: () => buildYachtModel('mega'),
};

/** True when this catalogue id can be shown in 3D. */
export function hasLuxuryModel(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILDERS, id);
}

/**
 * Build the showcase model for a catalogue id, or null when there isn't one.
 *
 * NOT cached: models are built on demand when a detail view opens and dropped
 * when it closes. Caching would pin several megabytes of typed arrays for
 * trophies the player looked at once, which is the wrong trade on a phone —
 * building one takes single-digit milliseconds.
 */
export function buildLuxuryModel(id: string): ProceduralModel | null {
  const builder = BUILDERS[id];
  if (!builder) return null;
  try {
    return builder();
  } catch {
    // A model that throws must never take down a purchase screen.
    return null;
  }
}
