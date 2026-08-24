import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import SubscriptionModal from '@/components/SubscriptionModal';

jest.mock('@/hooks/useReducedMotion', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  default: () => false,
}));

// Any lucide icon → a host stub named after the icon, so an icon added to the
// paywall later cannot break this smoke (same approach as the GemShop test).
jest.mock('lucide-react-native', () => new Proxy(
  { __esModule: true } as Record<string, unknown>,
  { get: (target, prop) => (prop in target ? target[prop as string] : prop) },
));

/**
 * Render + honesty smoke for the DeepLife+ paywall.
 *
 * The interesting assertions here are NEGATIVE. In the node/ts-jest environment
 * there is no store: no product loads, so `useSubscriptionPrices` resolves to
 * `store-disabled`. That is the exact state the paywall used to handle by
 * printing the static config USD prices next to a live "Start for $0.00 Today"
 * button — a price the player would never be charged, and a trial promise made
 * to a player whose eligibility was never checked.
 *
 * So this suite pins the two rules that replaced that behaviour:
 *   1. no purchase CTA is presented when the price could not be proven, and
 *   2. no unconditional free-trial promise is made without store confirmation.
 */
describe('render - SubscriptionModal (DeepLife+ paywall)', () => {
  it('mounts and shows the value stack', () => {
    const { renderer, json, unmount } = renderWithProviders(
      <SubscriptionModal visible onClose={() => {}} />,
    );
    expect(renderer.toJSON()).not.toBeNull();
    // The benefits are the reason to subscribe and must always render.
    expect(json).toContain('Ad-Free Forever');
    expect(json).toContain('Daily Gem Drop');
    expect(json).toContain('Bigger Paychecks');
    expect(json).toContain('Legacy Pass Premium');
    expect(json).toContain('Exclusive Cosmetics');
    unmount();
  });

  it('keeps the pitch to five primary benefits, folding the rest into one line', () => {
    // The 2026-08 redesign cut the pitch from seven rows to five so the plan
    // selector and price stay on screen. Welcome gems and VIP support are still
    // granted (and still listed on the post-purchase welcome panel) but must
    // not reappear as full rows in the sales view.
    const { json, unmount } = renderWithProviders(
      <SubscriptionModal visible onClose={() => {}} />,
    );
    expect(json).not.toContain('500 Welcome Gems');
    expect(json).not.toContain('VIP Priority Support');
    // ...their value is carried by the single quiet "Plus..." line instead.
    expect(json).toContain('welcome gems and VIP support');
    unmount();
  });

  it('does NOT present a purchase CTA when no store price could be loaded', () => {
    const { json, unmount } = renderWithProviders(
      <SubscriptionModal visible onClose={() => {}} />,
    );
    // With no store in this environment the CTA degrades to an explicit
    // unavailable/loading state rather than a buy button beside a config price.
    const offersPurchase =
      json.includes('Start for $0.00 Today') || json.includes('Unlock Forever ·');
    expect(offersPurchase).toBe(false);
    unmount();
  });

  it('never makes an unconditional "$0.00 today" promise without store confirmation', () => {
    const { json, unmount } = renderWithProviders(
      <SubscriptionModal visible onClose={() => {}} />,
    );
    // The hard promise is reserved for a store-confirmed eligible trial. Nothing
    // in this environment can confirm one, so it must not appear anywhere —
    // neither in the CTA nor in the legal disclosure.
    expect(json).not.toContain('Start for $0.00 Today');
    expect(json).not.toContain('no charge');
    unmount();
  });

  it('keeps Restore and the legal terms reachable in every state', () => {
    // A player must always be able to recover an existing purchase and read the
    // terms, including when the store is unreachable — otherwise an unreachable
    // store becomes a dead end for someone who has already paid.
    const { json, unmount } = renderWithProviders(
      <SubscriptionModal visible onClose={() => {}} />,
    );
    expect(json).toContain('Restore');
    expect(json).toContain('Terms of Use');
    expect(json).toContain('Privacy');
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <SubscriptionModal visible={false} onClose={() => {}} />,
    );
    unmount();
  });
});
