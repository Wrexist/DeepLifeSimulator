/**
 * Reputation tiers — makes the top-level `stats.reputation` (0-100) legible.
 *
 * Reputation already gates careers, vehicles, dating attractiveness, and brand
 * deals, and feeds a dynasty income bonus — but the raw number told the player
 * nothing about where they stood. These helpers turn it into a named standing
 * (Unknown → Icon), mirroring the karma-tier pattern.
 */
export type ReputationTier = 'unknown' | 'known' | 'respected' | 'renowned' | 'icon';

export function getReputationTier(reputation: number): ReputationTier {
  const r = typeof reputation === 'number' && isFinite(reputation) ? reputation : 0;
  if (r >= 85) return 'icon';
  if (r >= 60) return 'renowned';
  if (r >= 35) return 'respected';
  if (r >= 15) return 'known';
  return 'unknown';
}

export function getReputationLabel(tier: ReputationTier): string {
  switch (tier) {
    case 'icon': return 'Icon';
    case 'renowned': return 'Renowned';
    case 'respected': return 'Respected';
    case 'known': return 'Known';
    case 'unknown': return 'Unknown';
  }
}

export function getReputationColor(tier: ReputationTier): string {
  switch (tier) {
    case 'icon': return '#FBBF24';       // gold
    case 'renowned': return '#A855F7';   // purple
    case 'respected': return '#60A5FA';  // blue
    case 'known': return '#34D399';      // emerald
    case 'unknown': return '#9CA3AF';    // gray
  }
}

/** Convenience: label directly from a reputation value. */
export function getReputationStanding(reputation: number): { tier: ReputationTier; label: string; color: string } {
  const tier = getReputationTier(reputation);
  return { tier, label: getReputationLabel(tier), color: getReputationColor(tier) };
}
