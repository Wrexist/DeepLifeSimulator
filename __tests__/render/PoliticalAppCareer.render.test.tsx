import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import PoliticalApp from '@/components/computer/PoliticalApp';

jest.mock('@/hooks/useReducedMotion', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  default: () => false,
}));

// The global lucide mock (jest.setup) defines a handful of glyphs; this screen
// uses many more (Landmark, Banknote, ShieldAlert, LogOut, …). Resolve EVERY
// icon to an inert host-tag string so no icon component is undefined at render.
jest.mock('lucide-react-native', () => {
  const overrides: Record<string, unknown> = { __esModule: true };
  return new Proxy(overrides, {
    get: (target, prop) => (typeof prop === 'string' && prop in target ? target[prop] : prop),
  });
});

/**
 * Mount smoke test for the Career tab added by the Political Life expansion.
 *
 * The pure modules, the actions and the weekly tick are all covered elsewhere.
 * What none of those reach is the screen itself — and a tab that throws on
 * mount is indistinguishable from a tab that does not exist, from the player's
 * side. Every one of the four systems reads optional save fields that are
 * `undefined` on every existing save (the v47 carve-out), so the case this
 * mounts is precisely the one every real player hits first: a citizen with no
 * party, no appointment, no war chest and no retirement record.
 */
describe('render - PoliticalApp Career tab', () => {
  it('mounts for a player with none of the v47 fields set', () => {
    const { renderer, json, unmount } = renderWithProviders(<PoliticalApp onBack={() => {}} />);
    expect(renderer.toJSON()).not.toBeNull();
    // The tab itself is reachable from the tab bar.
    expect(json).toContain('Career');
    unmount();
  });

  it('the Office tab points into it for a player with no party', () => {
    // The Office tab used to stack four full-width CTAs; the two that are not
    // "the seat you hold right now" are quiet chips under a "More" heading, so
    // the pointer into this tab is now the chip's label rather than a sentence.
    const { json, unmount } = renderWithProviders(<PoliticalApp onBack={() => {}} />);
    expect(json).toContain('Join a party');
    unmount();
  });

  it('renders all four systems once the tab is actually opened', () => {
    // Mounting the screen is not the same as rendering this tab: `activeTab`
    // starts on 'office', so the Career body is never evaluated until something
    // presses the tab. Asserting on the un-opened screen would pass against a
    // `renderCareer` that throws on its first line.
    const { renderer, unmount } = renderWithProviders(<PoliticalApp onBack={() => {}} />);

    const press = (label: string) => {
      const node = renderer.root.findAll(
        (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
        { deep: true },
      )[0];
      expect(node).toBeDefined();
      act(() => { node.props.onPress(); });
    };

    press('Career');

    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Choose a party');            // party
    expect(json).toContain('Appointed positions');       // appointments
    expect(json).toContain('The war chest');             // embezzlement
    expect(json).toContain('Retirement');                // the exit

    // The four systems are folding sections now: one carries the live decision
    // and opens (a citizen has no party, so that is the party section), the
    // rest render a title plus a summary until they are opened. Expanding the
    // appointments section is therefore part of asserting that its body - not
    // just its heading - renders.
    press('Appointed positions');
    const opened = JSON.stringify(renderer.toJSON());
    // Every appointment is refused for a citizen, and each refusal explains
    // itself rather than greying a row out with no reason.
    expect(opened).toContain('Ambassador');
    expect(opened).toContain('You need to have served as');
    unmount();
  });
});
