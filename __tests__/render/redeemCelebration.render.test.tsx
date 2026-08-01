/**
 * The redeem-code payoff moment.
 *
 * Owner request: make the reward popup exciting. It was a static check circle,
 * a line of text, a pill and a button — the same shape as an error dialog, for
 * the one moment in the flow that is pure good news.
 *
 * It now uses the vocabulary the promotion celebration already established:
 * a staged reveal, confetti, a success haptic and sound, and a cash reward that
 * COUNTS UP rather than appearing at its value.
 *
 * Two things here are bug fixes rather than polish, and both are asserted:
 *
 * 1. The "Done" button collapsed to a tiny square around its label, because
 *    `successBody` centres its children and the button carried no width. The
 *    identical style rendered full-width in the input branch, where the card
 *    stretches it — which is why it survived review.
 * 2. `useReducedMotion` guarded only a REJECTED accessibility query, not an
 *    ABSENT one. Mounting any animated component under the react-native test
 *    mock threw a synchronous TypeError and took the whole provider tree into
 *    the error boundary.
 */
import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import RedeemCodeModal from '@/components/RedeemCodeModal';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Structural stand-in for a react-test-renderer instance. The package ships no
 * declarations, so annotating predicates with its own types would add
 * TS7016/TS7006 to the test-tree ratchet.
 */
type RTNode = { props: { pointerEvents?: unknown; style?: Record<string, unknown> } };

const isFlake = (n: RTNode) =>
  n.props?.pointerEvents === 'none' && (n.props?.style as { position?: unknown })?.position === 'absolute';

const flakeStyle = (n: RTNode) => n.props.style as Record<string, unknown>;

describe('the celebration mounts at all', () => {
  it('an animated component no longer crashes the provider tree', () => {
    // The regression: AccessibilityInfo.isReduceMotionEnabled is absent under
    // the RN mock, so calling it threw before any promise existed. The old
    // `.catch()` could not see that. A crash renders the boundary instead.
    const { json, unmount } = renderWithProviders(
      <RedeemCodeModal visible onClose={() => {}} />,
    );

    expect(json).not.toContain('Game Initialization Error');
    expect(json).toContain('Redeem');
    unmount();
  });

  it('and the hook still reports "not reduced" (the control)', () => {
    // Not-known must read as not-reduced — the same answer it starts with.
    //
    // A control, NOT the catcher: this value is captured during render, and the
    // old hook threw from its EFFECT, which runs afterwards and is swallowed by
    // the provider boundary. It passes against the broken hook too. The test
    // above is the one that actually fails pre-fix.
    let seen: boolean | undefined;
    function Probe() {
      seen = useReducedMotion();
      return null;
    }

    const { unmount } = renderWithProviders(<Probe />);
    expect(seen).toBe(false);
    unmount();
  });
});

describe('ConfettiBurst', () => {
  const flakesIn = (renderer: import('./helpers/renderWithProviders').RenderResult['renderer']) =>
    renderer.root.findAll(isFlake);

  it('mounts nothing at all when not playing', () => {
    // Reduce Motion is expressed by passing play={false}, so "off" has to mean
    // zero mounted flakes, not invisible ones. Counted rather than asserting a
    // null tree: the provider harness always renders its own toast host, so the
    // tree is never empty regardless of what this component does.
    const { renderer, unmount } = renderWithProviders(<ConfettiBurst play={false} />);
    expect(flakesIn(renderer).length).toBe(0);
    unmount();
  });

  it('renders one flake per requested count', () => {
    const { renderer, unmount } = renderWithProviders(
      <ConfettiBurst play count={7} colors={['#fff']} />,
    );
    const flakes = flakesIn(renderer);
    expect(flakes.length).toBe(7);
    unmount();
  });

  it('scatters deterministically — no Math.random', () => {
    // A random scatter re-rolls on every parent render and makes the flakes
    // jump. Two independent mounts must produce identical geometry.
    const geometry = () => {
      const { renderer, unmount } = renderWithProviders(
        <ConfettiBurst play count={6} colors={['#a', '#b']} />,
      );
      const out = flakesIn(renderer).map((n: RTNode) => {
        const st = flakeStyle(n);
        return `${st.left}:${st.width}:${st.backgroundColor}`;
      });
      unmount();
      return out.join('|');
    };

    expect(geometry()).toBe(geometry());
  });

  it('cycles the palette it is given (the control)', () => {
    // Proves `colors` is actually read, so the redeem sheet's blues are not
    // silently rendering as the promotion gold.
    const { renderer, unmount } = renderWithProviders(
      <ConfettiBurst play count={4} colors={['#111111', '#222222']} />,
    );
    const used = new Set(flakesIn(renderer).map((n: RTNode) => flakeStyle(n).backgroundColor));

    expect(used).toEqual(new Set(['#111111', '#222222']));
    unmount();
  });
});

describe('the success state — source contract', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components/RedeemCodeModal.tsx'), 'utf8',
  );
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the Done button is stretched, not shrink-wrapped', () => {
    // The reported bug. `doneWrap` is what gives it a width inside the
    // centre-aligned success column.
    expect(CODE).toMatch(/doneWrap: \{\s*alignSelf: 'stretch',\s*\}/);
    expect(CODE).toMatch(/<Animated\.View style=\{\[styles\.doneWrap/);
  });

  it('celebrates with haptics and sound', () => {
    expect(CODE).toMatch(/haptic\.success\(\)/);
    expect(CODE).toMatch(/playSound\('success'\)/);
  });

  it('holds the celebration gate so the review prompt waits its turn', () => {
    // Without this the store sheet can slam up mid-celebration — the exact
    // interruption utils/celebrationGate exists to prevent.
    expect(CODE).toMatch(/beginCelebration\(\)/);
    expect(CODE).toMatch(/return \(\) => endCelebration\(\)/);
  });

  it('gates every bit of motion on Reduce Motion', () => {
    // One derived flag drives the confetti AND the count-up, so the two cannot
    // disagree about whether motion is allowed.
    expect(CODE).toMatch(/const animate = celebrating && !reducedMotion;/);
    expect(CODE).toMatch(/<ConfettiBurst play=\{animate\}/);
    expect(CODE).toMatch(/animate=\{animate\}/);
  });

  it('reads the reward union through an `in` guard (Hard Rule #2)', () => {
    expect(CODE).toMatch(/'m' in reward/);
    expect(CODE).not.toMatch(/as \{ m: number \}/);
  });

  it('only cash rewards count up; product rewards show their label', () => {
    expect(CODE).toMatch(/setSuccessAmount\(hasCashAmount\(reward\) \? reward\.m : null\)/);
    expect(CODE).toMatch(/amount == null \? label : formatMoney/);
  });

  it('still runs the durable claim sequence unchanged (the control)', () => {
    // The celebration must not have reordered the load-bearing success path:
    // begin → one grant → entitlements → yield → force-save → finalize.
    //
    // Scoped to handleRedeem's BODY. Searching the whole file finds the import
    // block first, where these names are listed in a different order — the same
    // `indexOf` trap that makes a position check quietly meaningless.
    const body = CODE.slice(CODE.indexOf('const handleRedeem'), CODE.indexOf('const message ='));
    expect(body.length).toBeGreaterThan(500); // the slice actually found the function

    const order = [
      'beginRedeemClaim', 'applyRedeemReward', 'persistRedeemedPerkEntitlements',
      'saveGame(true)', 'finalizeRedeemClaim',
    ];
    const positions = order.map((k) => body.indexOf(k));

    expect(positions.every((p) => p > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('and finalizes only when BOTH durability steps confirm (the control)', () => {
    expect(CODE).toMatch(/if \(saved && entitlementsOk\)/);
  });
});
