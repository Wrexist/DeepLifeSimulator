/** Immutable IDs stored in the existing avatarId field. Never reuse an ID. */
export const PORTRAITS = [
  { id: 'portrait-v1:ember', name: 'Ember', description: 'Wavy brown hair · charcoal hoodie' },
  { id: 'portrait-v1:cedar', name: 'Cedar', description: 'Short curls · olive overshirt' },
  { id: 'portrait-v1:river', name: 'River', description: 'Swept dark hair · blue crewneck' },
  { id: 'portrait-v1:dawn', name: 'Dawn', description: 'Natural curls · teal jacket' },
  { id: 'portrait-v1:sage', name: 'Sage', description: 'Auburn bob · rust cardigan' },
  { id: 'portrait-v1:indigo', name: 'Indigo', description: 'Short textured hair · round glasses' },
] as const;

export type PortraitId = typeof PORTRAITS[number]['id'];
export function isPortraitId(id: unknown): id is PortraitId {
  return typeof id === 'string' && PORTRAITS.some(p => p.id === id);
}

/** Cosmetic randomization only. Does not change sex, name, genetics or game RNG. */
export function randomPortrait(previous?: string, roll = Math.random()): PortraitId {
  const candidates = PORTRAITS.filter(p => p.id !== previous);
  const safe = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
  return candidates[Math.floor(safe * candidates.length)].id;
}
