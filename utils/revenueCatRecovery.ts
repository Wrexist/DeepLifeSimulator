import type { GameState } from '@/contexts/game/types';

export const RC_PENDING_GRANT_KEY = 'iap_rc_pending_grant_v1';
export interface PurchaseTarget {
  slot: number;
  life: string;
}
export interface ReceiptSnapshot {
  customerId: string;
  requestDate: number;
  transactions: { id: string; productId: string; purchaseDate: number }[];
}
export interface PendingRcGrant {
  version: 1;
  productId: string;
  target: PurchaseTarget;
  customerId: string;
  baseline: string[];
  baselineDate: number;
  transactionId?: string;
}

/** No anonymous fallback: an unknown life cannot safely receive a paid grant. */
export function purchaseLife(state: Pick<GameState, 'lineageId' | 'generationNumber' | 'lifeStartWeek'>): string | null {
  if (!state.lineageId || !Number.isFinite(state.generationNumber)) return null;
  return JSON.stringify([state.lineageId, state.generationNumber, state.lifeStartWeek ?? 0]);
}

export function matchesPurchaseTarget(target: PurchaseTarget, slot: number | null, state: GameState): boolean {
  return slot === target.slot && purchaseLife(state) === target.life;
}

/** Throw on unreadable/malformed storage. Treating it as empty could charge twice. */
export async function readPendingRcGrant(): Promise<PendingRcGrant | null> {
  const { default: storage } = await import('@react-native-async-storage/async-storage');
  const { decodePersistedSaveEnvelope } = await import('@/utils/saveValidation');
  const raw = await storage.getItem(RC_PENDING_GRANT_KEY);
  if (raw === null) return null;
  const envelope = decodePersistedSaveEnvelope(raw, { allowLegacy: false });
  if (!envelope.valid || typeof envelope.data !== 'string') throw new Error('Purchase recovery record failed verification');
  const value: unknown = JSON.parse(envelope.data);
  if (!value || typeof value !== 'object') throw new Error('Purchase recovery record is unreadable');
  const p = value as Partial<PendingRcGrant>;
  if (p.version !== 1 || typeof p.productId !== 'string' || !p.productId ||
      typeof p.customerId !== 'string' || !p.customerId || !Number.isFinite(p.baselineDate) ||
      !p.target || !Number.isInteger(p.target.slot) || p.target.slot < 1 || p.target.slot > 3 ||
      typeof p.target.life !== 'string' || !p.target.life ||
      !Array.isArray(p.baseline) || p.baseline.some(id => typeof id !== 'string') ||
      (p.transactionId !== undefined && (typeof p.transactionId !== 'string' || !p.transactionId))) {
    throw new Error('Purchase recovery record is unreadable');
  }
  return p as PendingRcGrant;
}

export async function writePendingRcGrant(pending: PendingRcGrant): Promise<void> {
  const { default: storage } = await import('@react-native-async-storage/async-storage');
  const { createSaveEnvelope } = await import('@/utils/saveValidation');
  const raw = createSaveEnvelope(JSON.stringify(pending));
  await storage.setItem(RC_PENDING_GRANT_KEY, raw);
  if (await storage.getItem(RC_PENDING_GRANT_KEY) !== raw) throw new Error('Purchase recovery record did not persist');
}

export async function clearPendingRcGrant(): Promise<void> {
  const { default: storage } = await import('@react-native-async-storage/async-storage');
  await storage.removeItem(RC_PENDING_GRANT_KEY);
  if (await storage.getItem(RC_PENDING_GRANT_KEY) !== null) throw new Error('Purchase recovery record could not be cleared');
}

/** Only a single NEW receipt for this intent/account is eligible. Never history replay. */
export function resolvePendingReceipt(pending: PendingRcGrant, snapshot: ReceiptSnapshot): string | null {
  if (snapshot.customerId !== pending.customerId || snapshot.requestDate < pending.baselineDate) return null;
  const candidates = [...new Set(snapshot.transactions
    .filter(t => t.productId === pending.productId && !pending.baseline.includes(t.id) &&
      (pending.transactionId ? t.id === pending.transactionId : t.purchaseDate > pending.baselineDate))
    .map(t => t.id))];
  if (pending.transactionId) return candidates.includes(pending.transactionId) ? pending.transactionId : null;
  return candidates.length === 1 ? candidates[0] : null;
}
