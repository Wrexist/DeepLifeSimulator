/**
 * "YOU'RE MARRIED! ... won't let me scroll or do anything."
 *
 * A bug report arrived with a screenshot of `WeddingPopup` whose card ended at
 * the closing line: the "Continue Your Love Story" button — the ONLY control
 * that clears `showWeddingPopup` — was off the bottom of the card and there was
 * nothing to scroll to reach it. The popup renders above every tab
 * (`app/_layout.tsx` gates the whole HUD behind it), so a clipped button is not
 * a cosmetic overflow: it is a save the player cannot get back into.
 *
 * The shape is always the same, and `ApplyCardModal` hit it first
 * (`applyCardModalScroll.test.ts`): a card with a real height bound, a column
 * taller than that bound, and no scroll surface. The cure is the same too —
 * a `flexShrink: 1` scroller inside the bound, with the dismiss control pinned
 * outside it where it cannot scroll away.
 *
 * `flexShrink: 1` and not `flex: 1` is the load-bearing detail. `flex: 1` is
 * flexBasis 0 + grow with shrink still 0, so a footer taller than the left-over
 * space takes ALL of it and the scroll area resolves to zero height — the
 * failure `DeathPopup` documents at length. That is why the assertions below
 * reject `flex: 1` on the scroll area explicitly rather than just looking for a
 * ScrollView.
 *
 * Source-contract assertions, for the reason `applyCardModalScroll.test.ts`
 * gives: reproducing the overflow needs a real viewport and a real layout pass,
 * and the react-native test mock provides neither.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');

const read = (rel: string) => {
  const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
  // Strip comments so prose ABOUT the pattern can never satisfy an assertion.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
};

/**
 * Each entry: the file, and the string that proves the card is bounded. A
 * scroller only shrinks if something above it has a height to shrink within —
 * without the bound, `flexShrink: 1` is a no-op and the card grows off-screen
 * exactly as it did before. So the bound is asserted as a control on every one.
 */
const POPUPS: ReadonlyArray<{ file: string; bound: RegExp; label: string }> = [
  {
    file: 'components/WeddingPopup.tsx',
    bound: /maxHeight: height \* 0\.85/,
    label: 'WeddingPopup (the reported bug)',
  },
  {
    file: 'components/WelcomeBackPopup.tsx',
    bound: /maxHeight: '100%'/,
    label: 'WelcomeBackPopup',
  },
  {
    file: 'components/LifeMomentModal.tsx',
    bound: /maxHeight: '100%'/,
    label: 'LifeMomentModal',
  },
];

describe.each(POPUPS)('$label - a blocking popup must be escapable', ({ file, bound }) => {
  const CODE = read(file);

  it('has a scroll surface', () => {
    expect(CODE).toMatch(/<ScrollView/);
    expect(CODE).toMatch(/from 'react-native'/);
    // The import has to be real, not just the element — a missing import is a
    // runtime crash inside a modal that is already blocking the screen.
    expect(CODE).toMatch(/import \{[\s\S]*?\bScrollView\b[\s\S]*?\} from 'react-native'/);
  });

  it('the scroll area shrinks rather than growing', () => {
    expect(CODE).toMatch(/scrollArea: \{\s*flexShrink: 1,\s*\}/);
  });

  it('the scroll area is never flex: 1', () => {
    // `flex: 1` is grow-with-no-shrink: a footer taller than the left-over
    // space collapses the scroller to zero height, which is this same bug
    // wearing a different hat.
    expect(CODE).not.toMatch(/scrollArea: \{[^}]*flex: 1/);
  });

  it('the card is still bounded (the control)', () => {
    expect(CODE).toMatch(bound);
  });
});

describe('WeddingPopup - the dismiss control stays pinned and reachable', () => {
  const CODE = read('components/WeddingPopup.tsx');

  it('the Continue button is a sibling of the scroller, not inside it', () => {
    // Pinned on purpose: the button is the only way out of the popup, so it
    // must be on screen the moment it opens rather than waiting at the end of
    // a scroll the player has no reason to expect.
    const scrollEnd = CODE.indexOf('</ScrollView>');
    const button = CODE.indexOf('Continue Your Love Story');

    expect(scrollEnd).toBeGreaterThan(0);
    expect(button).toBeGreaterThan(scrollEnd);
  });

  it('closing the popup clears both wedding fields (the control)', () => {
    // Guards the other half of "stuck": a button that renders but leaves
    // `showWeddingPopup` true re-opens the modal on the next render.
    expect(CODE).toMatch(/showWeddingPopup: false/);
    expect(CODE).toMatch(/weddingPartnerName: undefined/);
  });
});

describe('WelcomeBackPopup - the dismiss control stays pinned and reachable', () => {
  const CODE = read('components/WelcomeBackPopup.tsx');

  it('Continue Playing is a sibling of the scroller, not inside it', () => {
    const scrollEnd = CODE.indexOf('</ScrollView>');
    const button = CODE.indexOf('Continue Playing');

    expect(scrollEnd).toBeGreaterThan(0);
    expect(button).toBeGreaterThan(scrollEnd);
  });
});

describe('LifeMomentModal - the choices ARE the dismiss control', () => {
  const CODE = read('components/LifeMomentModal.tsx');

  it('the choice list is inside the scroller, not pinned below it', () => {
    // The opposite call from the popups above, and deliberately so: this modal
    // has no single CTA to pin. Every choice dismisses it, the list is
    // unbounded, so all of them have to be scrollable rather than one being
    // pinned and the rest clipped.
    const scrollStart = CODE.indexOf('<ScrollView');
    const scrollEnd = CODE.indexOf('</ScrollView>');
    const choices = CODE.indexOf('moment.choices.map(');

    expect(scrollStart).toBeGreaterThan(0);
    expect(choices).toBeGreaterThan(scrollStart);
    expect(choices).toBeLessThan(scrollEnd);
  });
});
