/**
 * The Life Skills detail panel must not clip its own Unlock button.
 *
 * The panel that appears when you tap a skill node was one `<View>` holding
 * description → effect → requirements → Unlock button, inside a container
 * capped at a flat `maxHeight: scale(200)`. Measured at the base scale that
 * column is ~218px with a one-line description and ~235px with two, so the cap
 * cut the bottom off the button — and a `View` does not scroll, while the modal
 * shell is `overflow: 'hidden'`. The primary action of the screen was clipped,
 * and on the tighter cases gone: a skill you could afford, with no way to buy
 * it.
 *
 * It is the same defect as the banking `scale(360)` list caps — a fixed cap
 * cannot give space back, so the overflow leaves the box — with the difference
 * that here the thing pushed out is the button itself rather than a row of a
 * list.
 *
 * Layout is not assertable here (the react-native test mock has no viewport and
 * runs no layout pass), so this pins the structure the fix depends on, in the
 * same file-scan style as __tests__/render/modalListsShrink.test.ts.
 */
import fs from 'fs';
import path from 'path';

const FILE = path.join(__dirname, '..', '..', 'components', 'SkillTreeModal.tsx');
const SOURCE = fs.readFileSync(FILE, 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Body of a named StyleSheet entry, comments already stripped. */
function style(name: string): string {
  const m = new RegExp(`\\n {2}${name}: \\{([^}]*)\\}`).exec(CODE);
  expect(m).not.toBeNull();
  return (m as RegExpExecArray)[1];
}

describe('SkillTreeModal - the detail panel', () => {
  it('is bounded by a share of the shell, not a fixed pixel cap', () => {
    const panel = style('detailsPanel');
    expect(panel).toMatch(/maxHeight: '\d+%'/);
    // The exact shape that clipped the button. `scale(N)`/`verticalScale(N)`
    // cannot give space back when the content grows.
    expect(panel).not.toMatch(/maxHeight: (?:scale|verticalScale)\(/);
  });

  it('scrolls its prose, and that scroller can shrink', () => {
    expect(CODE).toMatch(/<ScrollView style=\{styles\.detailsScroll\}/);
    expect(style('detailsScroll')).toMatch(/flexShrink: 1/);
  });

  it('keeps the Unlock button OUT of the scrolling body', () => {
    // The whole point: prose that grows must not be able to push the action
    // out of the panel. If the button is inside the scroller again, a long
    // description puts it below the fold - better than clipped, still wrong.
    const body = /<ScrollView style=\{styles\.detailsScroll\}[\s\S]*?<\/ScrollView>/.exec(CODE);
    expect(body).not.toBeNull();
    expect((body as RegExpExecArray)[0]).not.toContain('Unlock Skill');

    // And it is still rendered, after the scroller, in its own footer.
    const afterBody = CODE.slice((body as RegExpExecArray).index + (body as RegExpExecArray)[0].length);
    expect(afterBody).toContain('styles.detailsFooter');
    expect(afterBody).toContain('Unlock Skill');
  });

  it('still gates the button on availability (the control)', () => {
    // Guards against the tempting "fix" of always showing the button.
    expect(CODE).toMatch(/status === 'available' && \(\s*<View style=\{styles\.detailsFooter\}/);
  });

  it('and the shell it takes a percentage of still has a definite height', () => {
    // `maxHeight: '45%'` only resolves against a parent with a real height.
    expect(style('container')).toMatch(/height: screenHeight \* 0\.9/);
  });
});

/**
 * The header must never push its own close button off the card.
 *
 * Reported 2026-08-31: "the UI for showing the X does not properly show up on
 * the screen. When leaving the page the screen freezes and nothing works."
 * Both halves are one defect. The header is a fixed-width row holding the
 * title, two stat badges and the close target; RN defaults `flexShrink: 0`, so
 * all of them were rigid, their intrinsic widths exceeded the card, and
 * `container`'s `overflow: 'hidden'` clipped the last child — the X — off the
 * edge. Photographed at 390pt before the fix: no X in the header at all.
 *
 * Losing it is a soft-lock rather than a cosmetic bug, because it was the ONLY
 * exit: `onRequestClose` is the Android back gesture, and the backdrop was a
 * plain View. On iOS the player was sealed inside the sheet.
 *
 * So this pins both halves — the row can give, and there is a second way out.
 */
describe('SkillTreeModal - the header keeps its close button', () => {
  it('lets the title and the stat badges shrink', () => {
    for (const name of ['headerContent', 'headerStats', 'statBadge', 'statBadgeText']) {
      expect(`${name}: ${style(name)}`).toMatch(/flexShrink: 1/);
      expect(`${name}: ${style(name)}`).toMatch(/minWidth: 0/);
    }
  });

  it('and never lets the close button be the one that gives', () => {
    expect(style('closeButton')).toMatch(/flexShrink: 0/);
  });

  it('caps the header text to one line so Dynamic Type cannot widen it', () => {
    // Three texts live in the header: the title and the two badge labels.
    // Anchored on CODE, not on the comments — `CODE` has them stripped.
    const header = /<View style=\{styles\.header\}>[\s\S]*?styles\.closeButton/.exec(CODE);
    expect(header).not.toBeNull();
    const block = (header as RegExpExecArray)[0];
    expect(block.match(/numberOfLines=\{1\}/g)).toHaveLength(3);
    expect(block.match(/maxFontSizeMultiplier=\{1\.3\}/g)).toHaveLength(3);
  });

  it('gives the sheet a second exit, so no header regression can strand a player', () => {
    // The backdrop closes, and the card claims the responder so taps inside it
    // do not fall through to it.
    expect(CODE).toMatch(/style=\{styles\.overlay\}[\s\S]{0,200}onPress=\{onClose\}/);
    expect(CODE).toMatch(/onStartShouldSetResponder=\{\(\) => true\}/);
  });
});
