/**
 * Limited-time gem-pack promo — an HONEST, opt-in mechanism.
 *
 * This ships DISABLED. Nothing is shown to players until a real, matching
 * storefront offer exists (an App Store / Play promotional price or a bonus SKU)
 * and an owner flips `enabled` on with a genuine end time. We never render a fake
 * countdown or a discount the store won't actually honor — the whole point is
 * urgency that's TRUE.
 *
 * To run a promo:
 *   1. Configure the real offer in App Store Connect / Play Console.
 *   2. Set `enabled: true`, point `productId` at the promoted gem-pack SKU, set a
 *      real `endsAtIso`, and write the `headline` (+ optional `subtext`).
 */
export interface GemPackPromo {
  /** Master switch. Ships false so no promo UI renders. */
  enabled: boolean;
  /** The gem-pack SKU the promo applies to (must be a real, loadable product). */
  productId: string;
  /** Marketing headline, e.g. "Weekend Gem Rush". */
  headline: string;
  /** Optional supporting line, e.g. "+50% bonus gems, this weekend only". */
  subtext?: string;
  /** ISO timestamp when the offer ends. Omit for an open-ended promo. */
  endsAtIso?: string;
}

/** Default: no promo. Do not fabricate a countdown — configure a real one here. */
export const GEM_PACK_PROMO: GemPackPromo = {
  enabled: false,
  productId: '',
  headline: '',
};

/**
 * The promo to show right now, or null. Returns null when disabled, misconfigured
 * (no product id), or already past its end time — so a stale config never shows a
 * dead offer.
 */
export function activeGemPromo(now: Date, promo: GemPackPromo = GEM_PACK_PROMO): GemPackPromo | null {
  if (!promo.enabled || !promo.productId) return null;
  if (promo.endsAtIso) {
    const end = Date.parse(promo.endsAtIso);
    if (Number.isFinite(end) && now.getTime() > end) return null;
  }
  return promo;
}

/**
 * Honest "Ends in 2d 4h" / "Ends in 3h" countdown from a real end time, or an
 * empty string if there's no valid future end (so an open-ended promo shows no
 * fake timer). Never counts down toward a fabricated deadline.
 */
export function formatPromoCountdown(now: Date, endsAtIso?: string): string {
  if (!endsAtIso) return '';
  const end = Date.parse(endsAtIso);
  if (!Number.isFinite(end)) return '';
  const ms = end - now.getTime();
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
  return `Ends in ${minutes}m`;
}
