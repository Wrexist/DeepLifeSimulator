/**
 * The life archive — remembered lives outside any save slot.
 *
 * ## Why (2026-08-24, brief §52)
 *
 * Death WITH an heir (or a prestige) appends the finished life to
 * `previousLives` and the dynasty carries the memory forward. Death WITHOUT
 * one hit "Start New Game", which deletes the slot outright — the whole life,
 * quality score, ribbon and all, erased with no record anywhere. The player
 * memory the legacy systems are built around had a hole exactly where the
 * saddest ending goes.
 *
 * ── WHY ASYNCSTORAGE AND NOT THE SAVE ──────────────────────────────────────
 * The save is gone — that is the scenario. And writing ghosts into the NEXT
 * game's `previousLives` would make a fresh start carry another lineage's
 * records into `secret_full_circle`, the generations counter and the prestige
 * achievements. A device-local list is the right weight (the
 * `premiumValueTracking` pattern): memory only, no mechanics, no save-format
 * change, no migration. Trade-off accepted: a reinstall forgets the archive.
 *
 * NOT an economy gate (§4.4 does not apply) — nothing is granted from here.
 */
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { logger } from '@/utils/logger';
import type { PreviousLifeRecord } from '@/lib/legacy/lifeRecord';

const ARCHIVE_KEY = 'deeplife_life_archive_v1';

/** Newest-first cap — a memorial wall, not a database. */
export const MAX_ARCHIVED_LIVES = 50;

export async function readLifeArchive(): Promise<PreviousLifeRecord[]> {
  try {
    const raw = await safeGetItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PreviousLifeRecord[]) : [];
  } catch (err) {
    logger.warn('[lifeArchive] unreadable archive; treating as empty', { error: err });
    return [];
  }
}

/**
 * Remember a finished life. Newest first, capped. Never throws — a failed
 * write must not block starting the new life (the caller sits on the
 * death-screen path).
 */
export async function appendToLifeArchive(record: PreviousLifeRecord): Promise<void> {
  try {
    const existing = await readLifeArchive();
    const next = [record, ...existing].slice(0, MAX_ARCHIVED_LIVES);
    await safeSetItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch (err) {
    logger.warn('[lifeArchive] failed to append', { error: err });
  }
}
