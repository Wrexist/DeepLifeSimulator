/**
 * No modal list may be capped at a fixed height.
 *
 * The player report was "the credit card list won't scroll". The cause was a
 * shape, not one screen:
 *
 *     <ScrollView style={{ maxHeight: scale(360) }}>
 *
 * inside a sheet holding a header, that list, and a footer button. A fixed cap
 * cannot give space back. When the column is taller than the sheet allows, the
 * overflow — including the button — goes outside the sheet, and nothing can be
 * scrolled to reach it, because only the inner list scrolls and the sheet does
 * not. To the player that is indistinguishable from "it won't scroll".
 *
 * NINE modals shipped that shape, and six of them additionally had NO height
 * bound on the sheet at all, which is worse: the sheet grows to fit its content
 * and the footer lands off the bottom of the SCREEN.
 *
 * The fix has two halves and only works as a pair — `flexShrink: 1` on the list
 * needs a bounded parent to shrink within, so the sheet gets `maxHeight` too.
 * This test pins both halves across the whole class rather than one file at a
 * time, because the shape spread by copy-paste and would spread again.
 *
 * A file-scan rather than a render test: reproducing the overflow needs a real
 * viewport and a real layout pass, and the react-native test mock has neither.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');

/** Every .tsx under components/, so a NEW modal cannot dodge this by location. */
function allComponentFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) allComponentFiles(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const FILES = allComponentFiles(path.join(repoRoot, 'components'));
const rel = (f: string) => path.relative(repoRoot, f);
const code = (f: string) =>
  fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no ScrollView is capped at a scaled fixed height', () => {
  it('across every component file', () => {
    // Inline `style={{ maxHeight: scale(N) }}` on a ScrollView is the exact
    // shape that shipped the bug. Named styles are left alone — several are
    // TextInput caps (`maxHeight: scale(100)` on a chat composer), which is a
    // different thing and legitimate.
    const offenders = FILES.filter((f) =>
      /<ScrollView[^>]*style=\{\{[^}]*maxHeight: (scale|verticalScale)\(/.test(code(f)),
    ).map(rel);

    expect(offenders).toEqual([]);
  });
});

describe('every sheet holding a shrinking list is itself bounded', () => {
  // The other half. `flexShrink: 1` is a no-op without a bounded parent, so a
  // file that has the first half and not the second is only half fixed — and
  // looks fixed to a reader.
  const withShrinkingList = FILES.filter((f) =>
    /<ScrollView[^>]*style=\{\{ flexShrink: 1 \}\}/.test(code(f)),
  );

  it('the sweep actually found the converted modals (the control)', () => {
    // Guards the whole suite against passing because the regex matched nothing.
    expect(withShrinkingList.length).toBeGreaterThanOrEqual(9);
  });

  it.each(withShrinkingList.map((f) => [rel(f), f]))(
    '%s bounds its sheet',
    (_name, file) => {
      // A percentage bound, `flex: 1`, or an explicit height — any real bound.
      // Percentage is what these sheets use.
      expect(code(file as string)).toMatch(/maxHeight: '\d+%'|flex: 1,/);
    },
  );
});

describe('the two banking modals that started this', () => {
  const apply = code(path.join(repoRoot, 'components/banking/ApplyCardModal.tsx'));
  const open = code(path.join(repoRoot, 'components/banking/OpenAccountModal.tsx'));

  it('ApplyCardModal shrinks its product list', () => {
    expect(apply).toMatch(/<ScrollView style=\{\{ flexShrink: 1 \}\}/);
    expect(apply).toMatch(/maxHeight: '90%'/);
  });

  it('OpenAccountModal does too — same flow, same defect, no percentage bound at all', () => {
    // This one is the reason the fix was widened. It is byte-for-byte the same
    // sheet as ApplyCardModal, in the same banking flow, with the same
    // `scale(360)` cap — and unlike ApplyCardModal its sheet had no bound, so
    // it could grow straight past the screen.
    expect(open).toMatch(/<ScrollView style=\{\{ flexShrink: 1 \}\}/);
    expect(open).toMatch(/maxHeight: '90%'/);
  });

  it('and both still render their full product list (the control)', () => {
    // Guards against the tempting "fix" of showing fewer rows so they fit.
    expect(apply).toMatch(/\{PRODUCTS\.map\(/);
    expect(open).toMatch(/\{PRODUCTS\.map\(/);
  });
});
