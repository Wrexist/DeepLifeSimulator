/**
 * The appearance editor, and the four things the redesign is FOR.
 *
 * The screen whose entire job is visual used to be driven by words: Hair had 28
 * options and each was a chip reading "Fro" or "Long Bob", so choosing a
 * hairstyle meant tapping a word, glancing up at the hero avatar, and tapping
 * the next word. The categories had the same problem — eleven of them in a
 * single-line horizontal scroller, most off-screen with nothing to say they
 * existed.
 *
 * These are structural assertions rather than pixel ones. A snapshot of this
 * component would lock in the layout and tell you nothing about whether a
 * player can see what they are choosing; what matters is that shape options
 * render FACES, that no category is hidden, and that the rail cannot reflow the
 * page. Each of those survives a restyle and is the actual requirement.
 */
import { AVATAR_PICKERS, pickersFor } from '@/lib/avatar/pickers';
import { ART_ZOOM } from '@/lib/avatar/depth';
import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

/**
 * Comments stripped. These assertions describe CODE, and this file's prose
 * explains the very props it is asserting are absent — matching the raw source
 * would let the explanation satisfy the check.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const EDITOR = stripComments(read('components/onboarding/AppearanceEditor.tsx'));
const SCREEN = read('app/(onboarding)/Customize.tsx');
const AVATAR = stripComments(read('components/avatar/VectorAvatar.tsx'));

describe('shape options are faces, not vocabulary', () => {
  it('every non-colour option renders the avatar itself', () => {
    // The whole point. A thumbnail answers "what does this look like on me";
    // the word "Fro" does not.
    expect(EDITOR).toMatch(/<VectorAvatar/);
    expect(EDITOR).toMatch(/category\.kind === 'color'/);
  });

  it('each preview swaps exactly ONE field on the player’s own face', () => {
    // Previewing against a generic head would show the hairstyle on somebody
    // else — wrong skin, wrong outfit — which is worse than a word.
    expect(EDITOR).toMatch(/\{ \.\.\.avatar, \[category\.field\]: index \}/);
  });

  it('previews are memoized on the config they draw', () => {
    // A category mounts up to 28 avatars. Without the memo, changing the
    // selection regenerates every face in the rail instead of two rings.
    expect(EDITOR).toMatch(/const OptionFace = React\.memo/);
    expect(EDITOR).toMatch(/const previewConfigs = useMemo/);
  });

  it('and they do not blink — that is the hero avatar’s job', () => {
    // `VectorAvatar` defaults `alive` to false precisely because a screen can
    // mount dozens; passing it here would start 28 blink timers.
    expect(EDITOR).not.toMatch(/\balive\b/);
  });

  it('colours stay swatches (the deliberate exception)', () => {
    // 15 near-identical heads read worse than 15 colour chips, and a swatch
    // already shows exactly what it does.
    expect(EDITOR).toMatch(/styles\.swatchFill/);
    const colourCategories = AVATAR_PICKERS.filter((c) => c.kind === 'color').map((c) => c.field);
    expect(colourCategories).toEqual(['skinTone', 'hairColor', 'clothingColor']);
  });
});

describe('outfit previews pull back far enough to show the outfit', () => {
  /**
   * Found by running the app, not by reading it. The default framing centres
   * the HEAD, so the first version rendered clothing options as four identical
   * headshots with a sliver of collar — the same "cannot see what you are
   * choosing" defect the whole redesign exists to remove, wearing a new hat.
   */
  it('the torso categories are named, and are the colour+shape pair', () => {
    expect(EDITOR).toMatch(/TORSO_FIELDS = new Set\(\['clothing', 'clothingColor'\]\)/);
  });

  it('and they are the only ones that override the framing', () => {
    expect(EDITOR).toMatch(
      /zoom=\{TORSO_FIELDS\.has\(category\.field\) \? OUTFIT_ZOOM : undefined\}/);
  });

  it('the override actually pulls back', () => {
    // A zoom at or above the portrait default would leave the bug in place
    // while looking, in the diff, exactly like the fix.
    const m = EDITOR.match(/const OUTFIT_ZOOM = ([0-9.]+);/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThan(ART_ZOOM);
  });

  it('VectorAvatar still defaults to the portrait framing for everyone else', () => {
    // The prop is additive. Every other avatar in the game — the hero, the
    // contacts list, the family tree — must be untouched by this.
    expect(AVATAR).toMatch(/zoom = ART_ZOOM,/);
  });
});

describe('no category is hidden', () => {
  it('the category chips wrap instead of scrolling sideways', () => {
    // They were a horizontal ScrollView. You cannot navigate a list whose
    // length you cannot see.
    expect(EDITOR).toMatch(/categoryWrap: \{[\s\S]*?flexWrap: 'wrap'/);
  });

  it('and there are enough of them for that to matter', () => {
    // If this ever drops to two or three the wrap is pointless — and if it
    // grows, the case for it gets stronger. Either way the number is the
    // premise of the layout, so it is asserted rather than assumed.
    expect(pickersFor('male').length).toBeGreaterThanOrEqual(10);
    expect(pickersFor('female').length).toBeGreaterThanOrEqual(9);
  });

  it('the rail says where you are inside the category you opened', () => {
    expect(EDITOR).toMatch(/\{selected \+ 1\} of \{category\.options\.length\}/);
  });

  it('and scrolls your existing choice into view when you open it', () => {
    // Otherwise a category you have already edited opens at option 1 with your
    // actual selection somewhere off to the right.
    expect(EDITOR).toMatch(/railRef\.current\?\.scrollTo\?\./);
  });
});

describe('the option area cannot reflow the page', () => {
  it('the rail is a fixed height', () => {
    // Hair has 28 options and Mouth has 4. As a wrapped grid that is a
    // seven-row section collapsing to one, which moved everything below it —
    // and pushed the hero avatar you are judging against off the screen.
    expect(EDITOR).toMatch(/railScroll: \{ height: THUMB \+ verticalScale\(34\) \}/);
  });

  it('it is one horizontal row', () => {
    expect(EDITOR).toMatch(/<ScrollView\s*\n\s*ref=\{railRef\}\s*\n\s*horizontal/);
  });

  it('the widest and narrowest categories really are that far apart', () => {
    const counts = AVATAR_PICKERS.map((c) => c.options.length);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(20);
    expect(Math.min(...counts)).toBeLessThanOrEqual(6);
  });
});

describe('one selected treatment, on both kinds of option', () => {
  it('a ring and a check, applied to the tile rather than per-kind', () => {
    // Before: a chosen colour was a thicker border, a chosen shape was a tinted
    // fill. Two vocabularies for one meaning, neither of them a tick.
    expect(EDITOR).toMatch(/isSelected && styles\.tileSelected/);
    expect(EDITOR).toMatch(/styles\.checkBadge/);
  });

  it('and selection is read from the avatar, not from local state', () => {
    // A second copy of "which option is chosen" is a copy that can disagree
    // with the face on screen.
    expect(EDITOR).toMatch(/const selected = \(avatar\[category\.field\] as number\) \?\? 0/);
  });
});

describe('the screen still owns the state', () => {
  it('Customize passes the avatar down and takes callbacks back', () => {
    // The editor is presentational. Giving it its own copy of the config would
    // be a second source of truth for the face.
    expect(SCREEN).toMatch(/<AppearanceEditor/);
    expect(SCREEN).toMatch(/onSelectOption=\{handleSelectOption\}/);
    expect(SCREEN).toMatch(/onChangeCategory=\{setActiveCategory\}/);
  });

  it('and the inline word-chip editor is gone, not just bypassed', () => {
    // Leaving it behind is how a "redesign" ends up shipping the old screen.
    expect(SCREEN).not.toMatch(/styles\.optionChip/);
    expect(SCREEN).not.toMatch(/styles\.categoryStrip/);
  });

  it('previews age with the character, like the hero does (the control)', () => {
    // Passing a different age here would show hairstyles on a face that is not
    // the one being created.
    expect(SCREEN).toMatch(/age=\{scenarioAge\}/);
  });
});
