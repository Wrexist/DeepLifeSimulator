/**
 * Offer personalisation — which offers are most relevant to THIS player.
 *
 * WHAT IS PERSONALISED AND WHAT IS NOT. The weekly rotation is identical for
 * everybody: the same offer is featured in the same week for every player, and
 * `docs/IAP-PRICE-ROTATION.md` is the only thing that changes what it costs.
 * Personalisation reorders the SECONDARY list in the Offer Center so a
 * business owner sees the business-shaped packs first. Price is never a
 * function of the player — per-user pricing is the exact practice the brief
 * rules out, and the app has no mechanism for it anyway.
 */
import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import { weeksInThisLife } from '@/lib/progress/lifeChapters';

import { OFFER_ROTATION } from './catalogue';
import type { OfferAudience, OfferDefinition } from './types';

/**
 * Which audience this player currently falls into.
 *
 * Ordered most-specific first: a wealthy business owner is 'wealthy', because
 * that is the narrower and more useful description of what they need.
 */
export function audienceFor(state: GameState | undefined | null): OfferAudience {
  if (!state) return 'everyone';
  const worth = netWorth(state);
  if (worth >= 1_000_000) return 'wealthy';
  if ((state.companies ?? []).length > 0) return 'business_owner';
  if (weeksInThisLife(state) <= 10) return 'new_player';
  return 'established';
}

/**
 * The catalogue ordered by relevance, best match first.
 *
 * A stable sort over a numeric score, with the catalogue's own order as the
 * tie-break, so the list does not reshuffle between renders on a state that has
 * not changed.
 */
export function rankOffersForPlayer(state: GameState | undefined | null): OfferDefinition[] {
  const audience = audienceFor(state);
  const score = (o: OfferDefinition): number => {
    if (o.audience === audience) return 2;
    if (o.audience === 'everyone') return 1;
    return 0;
  };
  return OFFER_ROTATION.map((offer, index) => ({ offer, index }))
    .sort((a, b) => score(b.offer) - score(a.offer) || a.index - b.index)
    .map((entry) => entry.offer);
}
