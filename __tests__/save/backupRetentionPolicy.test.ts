/**
 * SAVE-4 (v57): ONE retention policy for rotation and quota cleanup.
 *
 * Rotation never evicted a protected backup ("kept regardless of age or
 * count"), so every overwrite, prestige and restore added one forever. When the
 * resulting growth hit the storage quota, both quota cleanups did the opposite:
 * `createBackup` kept the single newest backup of ANY kind and the save queue
 * kept the newest two - deleting exactly the pre-prestige / pre-overwrite
 * copies rotation had promised to keep. Now: the newest three of each protected
 * reason survive both paths; the rest go.
 */
import { backupsToEvict, KEEP_PROTECTED_PER_REASON } from '@/utils/saveBackup';
import type { BackupReason } from '@/utils/saveBackup';
import fs from 'fs';
import path from 'path';

const NOW = 1_800_000_000_000;
const MIN = 60 * 1000;

function b(id: string, minutesAgo: number, reason: BackupReason) {
  return { id, timestamp: NOW - minutesAgo * MIN, reason };
}

describe('backupsToEvict - protected backups', () => {
  const prestiges = Array.from({ length: 6 }, (_, i) => b(`p${i}`, 10 + i * 100, 'before_prestige'));
  const overwrites = Array.from({ length: 5 }, (_, i) => b(`o${i}`, 5 + i * 100, 'before_overwrite'));

  it.each(['rotate', 'quota'] as const)('%s keeps the newest %s of each protected reason, no more', (mode) => {
    const evicted = backupsToEvict([...prestiges, ...overwrites], NOW, mode);
    expect(KEEP_PROTECTED_PER_REASON).toBe(3);
    expect(evicted.sort()).toEqual(['o3', 'o4', 'p3', 'p4', 'p5']);
  });

  it('is order-independent (does not trust the caller to sort)', () => {
    const shuffled = [...prestiges].reverse();
    expect(backupsToEvict(shuffled, NOW, 'rotate').sort()).toEqual(['p3', 'p4', 'p5']);
  });

  it('a protected backup is never evicted to make room for an autosave', () => {
    const autos = Array.from({ length: 10 }, (_, i) => b(`a${i}`, i, 'auto_save'));
    const evicted = backupsToEvict([b('m', 500, 'manual'), ...autos], NOW, 'quota');
    expect(evicted).not.toContain('m');
  });
});

describe('backupsToEvict - rotatable backups', () => {
  it('rotate keeps the newest three plus one per age band', () => {
    const autos = [
      b('a0', 0, 'auto_save'),
      b('a1', 2, 'auto_save'),
      b('a2', 4, 'auto_save'),
      b('a3', 6, 'auto_save'),
      b('h', 61, 'auto_save'), // > 1 hour
      b('h2', 90, 'auto_save'),
      b('d', 60 * 25, 'auto_save'), // > 1 day
      b('w', 60 * 24 * 8, 'auto_save'), // > 1 week
    ];
    expect(backupsToEvict(autos, NOW, 'rotate').sort()).toEqual(['a3', 'h2']);
  });

  it('quota keeps only the newest rotatable one', () => {
    const autos = [b('a0', 0, 'auto_save'), b('a1', 2, 'before_week'), b('a2', 4, 'app_resume')];
    expect(backupsToEvict(autos, NOW, 'quota').sort()).toEqual(['a1', 'a2']);
  });

  it('nothing to evict from an empty slot', () => {
    expect(backupsToEvict([], NOW, 'quota')).toEqual([]);
  });
});

describe('every cleanup path uses the shared policy', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

  it('rotation and both quota cleanups call backupsToEvict, none slices by count', () => {
    const backup = read('utils/saveBackup.ts');
    const rotate = backup.slice(backup.indexOf('async function rotateBackups'), backup.indexOf('export async function createManualBackup'));
    expect(rotate).toMatch(/backupsToEvict\(backups, Date\.now\(\), 'rotate'\)/);
    const create = backup.slice(backup.indexOf('export async function createBackup('), backup.indexOf('export function stripSidecarCheckpointsForAutoBackup'));
    expect(create.match(/backupsToEvict\(/g)?.length).toBe(2);
    expect(create).not.toMatch(/\.slice\(1\)/);

    const queue = read('utils/saveQueue.ts');
    const cleanup = queue.slice(queue.indexOf('private async cleanupOldBackups'), queue.indexOf('private async cleanupCacheData'));
    expect(cleanup).toMatch(/backupsToEvict\(backups, Date\.now\(\), 'quota'\)/);
    expect(cleanup).not.toMatch(/\.slice\(2\)/);
  });
});
