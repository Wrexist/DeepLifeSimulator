import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import RedeemCodeModal from '@/components/RedeemCodeModal';

/**
 * Render smoke test for the Settings "Redeem Code" sheet. Mounts inside the real
 * provider tree (it reads game state/actions via useGameState/useGameActions) and
 * proves: (1) it mounts + commits without throwing and shows the Redeem button;
 * (2) typing a well-shaped but bogus code and submitting surfaces the invalid
 * state (no real code is ever used — 'DEEP-TEST-TEST-TEST' is an obvious fake);
 * (3) a hidden mount doesn't throw.
 *
 * Uses only icons present in the shared jest.setup lucide allow-list
 * (Gift / X / CheckCircle / AlertCircle), so no local lucide mock is needed.
 */
describe('render — RedeemCodeModal', () => {
  it('mounts (visible) and shows the Redeem button', () => {
    const { renderer, json, unmount } = renderWithProviders(
      <RedeemCodeModal visible onClose={() => {}} />,
    );
    expect(renderer.toJSON()).not.toBeNull();
    expect(json).toContain('Redeem');
    unmount();
  });

  it('typing a garbage code and submitting shows the invalid state', async () => {
    const { renderer, unmount } = renderWithProviders(
      <RedeemCodeModal visible onClose={() => {}} />,
    );

    const input = renderer.root.findAll((n) => n.props?.testID === 'redeem-code-input')[0];
    expect(input).toBeDefined();
    act(() => {
      input.props.onChangeText('DEEP-TEST-TEST-TEST');
    });

    const button = renderer.root.findAll((n) => n.props?.testID === 'redeem-submit')[0];
    expect(button).toBeDefined();
    await act(async () => {
      await button.props.onPress();
    });

    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('recognize'); // the invalid-code message
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <RedeemCodeModal visible={false} onClose={() => {}} />,
    );
    unmount();
  });
});
