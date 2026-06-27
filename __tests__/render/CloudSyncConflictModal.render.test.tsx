import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import CloudSyncConflictModal from '@/components/CloudSyncConflictModal';
import {
  requestConflictResolution,
  resolvePendingConflict,
} from '@/lib/cloudSync/conflictBridge';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const makeConflict = () => ({
  localVersion: 5,
  remoteVersion: 7,
  localTimestamp: 1700000000000,
  remoteTimestamp: 1700000500000,
  localState: createTestGameState(),
  remoteState: createTestGameState(),
});

describe('render — CloudSyncConflictModal', () => {
  afterEach(() => {
    // Clear any pending conflict so tests don't leak the singleton across cases.
    act(() => {
      resolvePendingConflict(null);
    });
  });

  it('renders nothing when there is no pending conflict', () => {
    const { renderer, unmount } = renderWithProviders(<CloudSyncConflictModal />);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Cloud Sync Conflict');
    unmount();
  });

  it('shows device + cloud versions and all three choices when pending', () => {
    const { renderer, unmount } = renderWithProviders(<CloudSyncConflictModal />);
    act(() => {
      void requestConflictResolution(makeConflict());
    });
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Cloud Sync Conflict');
    expect(json).toContain('This device');
    expect(json).toContain('Cloud');
    expect(json).toContain('v5 ·');
    expect(json).toContain('v7 ·');
    expect(json).toContain('Keep This Device');
    expect(json).toContain('Merge Both');
    expect(json).toContain('Use Cloud Version');
    unmount();
  });

  it('a choice resolves the awaiting promise and hides the modal', async () => {
    const { renderer, unmount } = renderWithProviders(<CloudSyncConflictModal />);
    let result: string | null | undefined;
    act(() => {
      requestConflictResolution(makeConflict()).then((r) => {
        result = r;
      });
    });
    const mergeBtn = renderer.root.findAll(
      (n) =>
        !!n.props &&
        n.props.accessibilityLabel === 'Merge both saves' &&
        typeof n.props.onPress === 'function'
    )[0];
    expect(mergeBtn).toBeTruthy();
    await act(async () => {
      mergeBtn.props.onPress();
    });
    expect(result).toBe('merge');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Cloud Sync Conflict');
    unmount();
  });

  it('dismiss resolves as null → caller keeps local (non-destructive default)', async () => {
    const { renderer, unmount } = renderWithProviders(<CloudSyncConflictModal />);
    let result: string | null | undefined = 'unset' as unknown as string;
    act(() => {
      requestConflictResolution(makeConflict()).then((r) => {
        result = r;
      });
    });
    await act(async () => {
      resolvePendingConflict(null);
    });
    expect(result).toBeNull();
    unmount();
  });
});
