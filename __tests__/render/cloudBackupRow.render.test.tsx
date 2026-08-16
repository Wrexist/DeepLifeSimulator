import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import CloudBackupRow from '@/components/settings/CloudBackupRow';

/**
 * The Settings "Cloud backup" row must render NOTHING when the `cloudSave`
 * flag is off — which is every build except `preview` today. A row that cannot
 * do anything is worse than no row, because the player will press it and get
 * silence.
 *
 * The flag is read at module-init of `lib/config/featureFlags`, and this suite
 * runs with no EXPO_PUBLIC_CLOUD_SAVE_* set, so this is the default-build case.
 */
describe('render — Settings cloud backup row', () => {
  it('renders nothing while the cloudSave flag is off', () => {
    // `json` is the serialized PROVIDER tree, so it is never empty — what must
    // be absent is anything this row would draw.
    const { json, unmount } = renderWithProviders(<CloudBackupRow />);
    expect(json).not.toContain('Cloud backup');
    expect(json).not.toContain('Back up now');
    expect(json).not.toContain('Restore from cloud');
    unmount();
  });
});
