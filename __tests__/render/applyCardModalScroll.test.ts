/**
 * "Can't scroll the credit card list."
 *
 * `ApplyCardModal` is a bounded sheet — `maxHeight: '90%'` — holding a column:
 * header, subtitle, the product list, a conditional rejection notice, and the
 * Apply button. The list was `<ScrollView style={{ maxHeight: scale(360) }}>`.
 *
 * A fixed max-height cannot give space back. When the column is taller than the
 * sheet allows, flex has nothing to take from, so the overflow goes off the
 * bottom of the sheet — and the Apply button goes with it. Nothing can be
 * scrolled to reach it, because only the inner list scrolls and the sheet
 * itself does not. From the player's side that reads exactly as "it won't
 * scroll": you can see there is more, and dragging does nothing useful.
 *
 * `flexShrink: 1` makes the list take whatever is left after the header and the
 * button at any screen size, so the button is always reachable and the list
 * scrolls precisely when it needs to.
 *
 * Source-contract assertions. A render test cannot see this: it would need a
 * real viewport height and a real layout pass to reproduce the overflow, and
 * the react-native test mock provides neither.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(
  path.join(repoRoot, 'components/banking/ApplyCardModal.tsx'), 'utf8',
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('ApplyCardModal - the product list must not be fixed-height', () => {
  it('the list shrinks rather than capping at a fixed height', () => {
    expect(CODE).toMatch(/<ScrollView style=\{\{ flexShrink: 1 \}\}/);
  });

  it('no scaled max-height survives anywhere in the file', () => {
    // Stated separately from the assertion above so a future edit that ADDS a
    // second capped list is caught too, not just a revert of this one.
    expect(CODE).not.toMatch(/maxHeight: (scale|verticalScale)\(/);
  });

  it('the sheet is still the bounded element (the control)', () => {
    // The fix only works because something above the list has a real bound to
    // shrink within. Remove this and `flexShrink` becomes a no-op — the sheet
    // would grow past the screen instead, which is the same bug wearing a
    // different hat.
    expect(CODE).toMatch(/maxHeight: '90%'/);
  });

  it('the Apply button is a sibling of the list, not inside it (the control)', () => {
    // If the button were inside the ScrollView the overflow would be
    // scrollable and none of this would matter — but it would also scroll away
    // from the player, which is a different UX. It is deliberately a sibling,
    // so it must stay pinned and reachable.
    const body = CODE.slice(CODE.indexOf('<ScrollView'));
    const listEnd = body.indexOf('</ScrollView>');
    const applyIdx = body.indexOf('Apply Now');

    expect(listEnd).toBeGreaterThan(0);
    expect(applyIdx).toBeGreaterThan(listEnd);
  });

  it('every card product is still rendered from one list (the control)', () => {
    // Guards against the tempting "fix" of showing fewer products so they fit.
    expect(CODE).toMatch(/\{PRODUCTS\.map\(/);
    expect((SRC.match(/^\s{4}tier: '/gm) ?? []).length).toBe(4);
  });
});
