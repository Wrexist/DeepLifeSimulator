/** Immutable IDs stored in the existing avatarId field. Never reuse an ID. */
export const PORTRAITS = [
  { id: 'portrait-v1:ember', name: 'Ember', description: 'Wavy brown hair · charcoal hoodie', presents: 'male' },
  { id: 'portrait-v1:cedar', name: 'Cedar', description: 'Short curls · green sweater', presents: 'male' },
  { id: 'portrait-v1:river', name: 'River', description: 'Swept dark hair · blue crewneck', presents: 'male' },
  { id: 'portrait-v1:dawn', name: 'Dawn', description: 'Natural curls · dark blazer', presents: 'female' },
  { id: 'portrait-v1:sage', name: 'Sage', description: 'Auburn bob · coral sweater', presents: 'female' },
  { id: 'portrait-v1:indigo', name: 'Indigo', description: 'Short textured hair · round glasses', presents: 'male' },
] as const;

export type PortraitId = typeof PORTRAITS[number]['id'];
export function isPortraitId(id: unknown): id is PortraitId {
  return typeof id === 'string' && PORTRAITS.some(p => p.id === id);
}

/**
 * Cosmetic randomization only. Does not change sex, name, genetics or game RNG.
 *
 * With `sex`, the pick comes from the portraits that read as that sex. Without
 * it, a fresh character opened as "Justin Martin" under a feminine portrait
 * about half the time (tester pass, 2026-10-10). The player can still choose
 * ANY portrait by hand - this only stops the dice from contradicting the name.
 */
export function randomPortrait(previous?: string, roll = Math.random(), sex?: 'male' | 'female'): PortraitId {
  const matching = sex ? PORTRAITS.filter(p => p.presents === sex && p.id !== previous) : [];
  const candidates = matching.length ? matching : PORTRAITS.filter(p => p.id !== previous);
  const safe = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
  return candidates[Math.floor(safe * candidates.length)].id;
}
