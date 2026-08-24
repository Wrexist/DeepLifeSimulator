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
