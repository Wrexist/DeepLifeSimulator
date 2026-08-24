import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import CloudBackupRow, { restoreAlertTitle } from '@/components/settings/CloudBackupRow';
import type { CloudRestoreOutcome } from '@/services/cloudBackup';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * The Settings "Cloud backup" row.
 *
 * Two halves, and the second one is why the first is not enough: with the flag
 * OFF the row must render NOTHING (a row that cannot do anything is worse than
 * no row, because the player will press it and get silence) — but a suite that
 * only ever asserts absence passes just as happily on a component that crashed,
 * was renamed, or renders nothing in EVERY configuration. So the ON case is
 * pinned too.
 *
 * The flag is read at module-init of `lib/config/featureFlags`, and this suite
 * runs with no EXPO_PUBLIC_CLOUD_SAVE_* set, so the plain import is the
 * default-build case; the ON case re-requires the module graph under a fresh
 * registry with both vars set.
 */

// The row's status line calls `getLastCloudBackupAt` on mount. Stubbed so the
// mount never reaches the real sync service (network, NetInfo listeners, a
// persisted timestamp) — this file is about what the row draws.
jest.mock('@/services/CloudSyncService', () => ({
  getCloudSyncService: () => ({
    queueSync: jest.fn(async () => {}),
    backupNow: jest.fn(async () => ({ success: true })),
    downloadState: jest.fn(async () => null),
    getLastBackupAt: jest.fn(async () => null),
  }),
}));

const CLOUD_ENV = {
  EXPO_PUBLIC_ENABLE_CLOUD_SAVE: 'true',
  EXPO_PUBLIC_CLOUD_SAVE_URL: 'https://example.test/functions/v1',
  // The flag needs all three; the token comes from the EAS env store in a
  // real build (see lib/config/featureFlags.ts).
  EXPO_PUBLIC_CLOUD_AUTH_TOKEN: 'test-token',
};

describe('render - Settings cloud backup row', () => {
  it('renders nothing while the cloudSave flag is off', () => {
    // `json` is the serialized PROVIDER tree, so it is never empty — what must
    // be absent is anything this row would draw.
    const { json, unmount } = renderWithProviders(<CloudBackupRow />);
    expect(json).not.toContain('Cloud backup');
    expect(json).not.toContain('Back up now');
    expect(json).not.toContain('Restore from cloud');
    // The destructive and transfer actions must be absent too. A delete button
    // in a build with no cloud configured has nothing to delete, and a code
    // minted against no backend cannot be claimed anywhere.
    expect(json).not.toContain('Delete cloud backup');
    expect(json).not.toContain('Move to a new phone');
    expect(json).not.toContain('I have a code');
    unmount();
  });

  it('renders the row and EVERY action when the flag is on', () => {
    const previous = { ...process.env };
    Object.assign(process.env, CLOUD_ENV);
    try {
      jest.isolateModules(() => {
        // The helper is re-required INSIDE the isolated registry on purpose: it
        // mounts `AppProviders`, and a provider from the outer registry would be
        // a different context object than the one the freshly required row
        // subscribes to, so `useGameActions` would throw.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { renderWithProviders: render } = require('./helpers/renderWithProviders');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Row = require('@/components/settings/CloudBackupRow').default;

        const { json, unmount } = render(React.createElement(Row));
        expect(json).toContain('Cloud backup');
        expect(json).toContain('Back up now');
        expect(json).toContain('Restore from cloud');
        // The cross-device pair. Without both halves visible the feature is
        // unreachable: a code minted on the old phone needs somewhere to be
        // typed on the new one.
        expect(json).toContain('Move to a new phone');
        expect(json).toContain('I have a code');
        // Erasure is the GDPR article 17 path. An endpoint no player can reach
        // is not a right, so its presence in the row is the thing under test.
        expect(json).toContain('Delete cloud backup');
        // The status line is part of the row, not decoration: it is the only
        // thing telling the player whether a backup exists at all.
        expect(json).toContain('Not backed up yet');
        unmount();
      });
    } finally {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('EXPO_PUBLIC_')) delete process.env[key];
      }
      Object.assign(process.env, previous);
    }
  });
});

describe('restore alert title', () => {
  const applied = (persisted: boolean): CloudRestoreOutcome => ({
    status: 'applied',
    state: createTestGameState({ weeksLived: 500 }),
    localWeeks: 400,
    remoteWeeks: 500,
    message: 'x',
    persisted,
  });

  it('claims a restore only when the restored state reached DISK', () => {
    expect(restoreAlertTitle(applied(true))).toBe('Backup Restored');
  });

  it('says so when the restore is live but unsaved', () => {
    // The state IS applied — the player is looking at it — but the slot still
    // holds what it replaced, so the next load undoes it. "Backup Restored"
    // over that is the half-truth that gets the save lost.
    const title = restoreAlertTitle(applied(false));
    expect(title).not.toBe('Backup Restored');
    expect(title).toMatch(/not saved/i);
  });

  it('keeps the weeksLived-regression refusal separate from a plain failure', () => {
    expect(restoreAlertTitle({ status: 'older', localWeeks: 500, remoteWeeks: 400, message: 'x' })).toBe(
      'Cloud Save Is Older'
    );
    expect(restoreAlertTitle({ status: 'error', message: 'x' })).toBe('Nothing Restored');
    expect(restoreAlertTitle({ status: 'empty', message: 'x' })).toBe('Nothing Restored');
  });
});
