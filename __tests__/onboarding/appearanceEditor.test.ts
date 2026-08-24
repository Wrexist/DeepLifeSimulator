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
import { AVATAR_PICKERS, EDITABLE_AVATAR_FIELDS, pickersFor } from '@/lib/avatar/pickers';
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

  it('and they do not blink - that is the hero avatar’s job', () => {
    // `VectorAvatar` defaults `alive` to false precisely because a screen can
    // mount dozens; passing it here would start 28 blink timers.
    expect(EDITOR).not.toMatch(/\balive\b/);
  });

  it('colours stay swatches (the deliberate exception)', () => {
    // 15 near-identical heads read worse than 15 colour chips, and a swatch
    // already shows exactly what it does.
    expect(EDITOR).toMatch(/styles\.swatchFill/);
  });

  it('skin is the only colour that is still a category of its own', () => {
    // Hair colour and outfit colour became TINTS on the categories they belong
    // to. Skin has no shape to pair with, so it stays standalone.
    const colourCategories = AVATAR_PICKERS.filter((c) => c.kind === 'color').map((c) => c.field);
    expect(colourCategories).toEqual(['skinTone']);
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

describe('one owner for feedback, and previews that survive a tap', () => {
  /** Both found in review, both invisible to every test above. */
  it('the editor does not fire its own selection haptic', () => {
    // `Customize.handleSelectOption` already fires one. Two owners for one piece
    // of feedback is two buzzes per tap.
    expect(EDITOR).not.toMatch(/haptic\.selection\(\);\s*\n\s*onSelectOption/);
  });

  it('but the category chips keep theirs (the control)', () => {
    // The screen has no handler of its own for a category change, so this one
    // has no second owner to collide with.
    expect(EDITOR).toMatch(/haptic\.selection\(\);\s*\n\s*onChangeCategory/);
  });

  it('picking an option does not rebuild every preview in the rail', () => {
    // Every config here OVERRIDES `category.field`, so a selection change
    // produces value-identical previews — but depending on `avatar` rebuilt the
    // array anyway, broke `OptionFace`'s memo and regenerated all 28 SVGs on
    // every tap. The memo depends on the fields that actually reach the output.
    expect(EDITOR).toMatch(/\}, \[avatarRest, category\]\);/);
    expect(EDITOR).toMatch(/const avatarRest = useMemo/);
    expect(EDITOR).toMatch(/delete rest\[category\.field\]/);
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
    //
    // Down from 11/10: pairing hair colour and outfit colour onto the
    // categories they belong to removed two chips whose only job was to colour
    // another chip. Still comfortably a wrapping row.
    expect(pickersFor('male').length).toBeGreaterThanOrEqual(8);
    expect(pickersFor('female').length).toBeGreaterThanOrEqual(7);
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

describe('a colour lives with the thing it colours', () => {
  /**
   * Hair colour and outfit colour used to be categories of their own, so
   * colouring a hairstyle you had just picked meant finding a second chip among
   * nine others. Two of the eleven chips existed only to colour other chips,
   * which is also what forced the category row onto four lines.
   */
  it('hair and outfit carry their colour; nothing else does', () => {
    const paired = AVATAR_PICKERS.filter((c) => c.tint).map((c) => [c.field, c.tint!.field]);
    expect(paired).toEqual([
      ['hairStyle', 'hairColor'],
      ['clothing', 'clothingColor'],
    ]);
  });

  it('the paired colours are gone from the category list, not duplicated', () => {
    // Leaving them in BOTH places would be the worst outcome: two controls
    // writing one field, disagreeing about which is selected.
    const fields = AVATAR_PICKERS.map((c) => c.field);
    expect(fields).not.toContain('hairColor');
    expect(fields).not.toContain('clothingColor');
  });

  it('every editable field is still reachable', () => {
    // The point of the refactor is fewer chips, NOT fewer choices. If a field
    // stopped being editable this is what would say so.
    expect(EDITABLE_AVATAR_FIELDS).toEqual(expect.arrayContaining([
      'skinTone', 'hairStyle', 'hairColor', 'facialHair', 'eyeShape',
      'browShape', 'mouthShape', 'accessory', 'clothing', 'clothingColor', 'headwear',
    ]));
  });

  it('the editor renders the strip and writes the tint field, not the shape one', () => {
    // A tint tap that wrote `category.field` would change the hairSTYLE while
    // the player was picking a colour.
    expect(EDITOR).toMatch(/category\.tint && \(/);
    expect(EDITOR).toMatch(/onPress=\{\(\) => handleTint\(index\)\}/);
    expect(SCREEN).toMatch(/onSelectTint=\{handleSelectTint\}/);
    expect(SCREEN).toMatch(/const field = category\.tint\?\.field;/);
  });

  it('the strip is smaller than the option rail, and wraps', () => {
    // It is a secondary control for the open category, not a category itself;
    // sizing it the same would say otherwise. And a second horizontal scroller
    // stacked under the first is a trap for the thumb.
    expect(EDITOR).toMatch(/tintRow: \{[\s\S]*?flexWrap: 'wrap'/);
    const dot = EDITOR.match(/tintDot: \{[\s\S]*?width: scale\((\d+)\)/);
    expect(dot).not.toBeNull();
    expect(Number(dot![1])).toBeLessThan(58); // THUMB
  });
});
