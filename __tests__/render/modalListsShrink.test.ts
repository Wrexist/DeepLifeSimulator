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

/**
 * The same rule, enforced by SHAPE rather than by spelling.
 *
 * The two sweeps above match `style={{ … }}` written inline. That is one of
 * three ways to spell this list, and the other two shipped the bug again:
 *
 *   <ScrollView style={styles.modalBody}>   — the cap hid in a named style
 *   <ScrollView contentContainerStyle={…}>  — no `style` prop at all
 *
 * Sixteen more sites carried one of those two spellings, in every corner of the
 * app: buy a property, buy a vehicle, enrol in a course, take a loan quote,
 * place a crypto order, enact a policy, restore a backup, open a child's
 * profile. Each is a sheet bounded only by a percentage `maxHeight` holding a
 * scrolling list with no `flexShrink`, and RN defaults `flexShrink` to 0 — so
 * the list keeps its full content height, the column overflows the sheet, and
 * the confirm button below it lands outside, unreachable, with only the sheet's
 * `overflow: 'hidden'` deciding whether the player sees it disabled or not at
 * all.
 *
 * So this block resolves containment instead of pattern-matching a line: parse
 * the StyleSheet, find sheets bounded ONLY by a percentage `maxHeight`, walk to
 * the matching closing tag of each element that wears one, and require every
 * vertical scroller inside it to declare `flexShrink: 1`.
 */
type StyleBlocks = Record<string, string[]>;

/** Top-level `name: { … }` entries of every StyleSheet.create in a file. */
function parseStyleBlocks(src: string): StyleBlocks {
  const out: StyleBlocks = {};
  let from = src.indexOf('StyleSheet.create(');
  while (from !== -1) {
    const open = src.indexOf('{', from);
    const close = matchBrace(src, open);
    const block = src.slice(open + 1, close);
    const entry = /(\w+):\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = entry.exec(block)) !== null) {
      const b = block.indexOf('{', m.index);
      const e = matchBrace(block, b);
      if (e <= b) break;
      (out[m[1]] ||= []).push(block.slice(b + 1, e));
      entry.lastIndex = e + 1;
    }
    from = src.indexOf('StyleSheet.create(', close);
  }
  return out;
}

function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return src.length - 1;
}

/** End index of a JSX opening tag, ignoring `>` inside `{…}` expressions. */
function tagEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    else if (src[i] === '>' && depth === 0) return i;
  }
  return src.length - 1;
}

/** `[start, end)` of the element opening at `start`, closing tag included. */
function elementSpan(src: string, start: number): [number, number] {
  const name = /^<([\w.]+)/.exec(src.slice(start))?.[1];
  const end = tagEnd(src, start);
  if (!name || src[end - 1] === '/') return [start, end];
  const tag = new RegExp(`<(/?)${name.replace('.', '\\.')}(?=[\\s/>])`, 'g');
  tag.lastIndex = end + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(src)) !== null) {
    if (m[1] === '/') {
      if (--depth === 0) return [start, m.index + m[0].length];
    } else if (src[tagEnd(src, m.index) - 1] !== '/') depth++;
  }
  return [start, src.length];
}

interface Site {
  file: string;
  line: number;
  sheet: string;
}

function unshrinkableScrollers(): { sites: Site[]; sheetsSeen: number } {
  const sites: Site[] = [];
  let sheetsSeen = 0;

  for (const file of FILES) {
    const src = code(file);
    if (!src.includes('<Modal')) continue;
    const blocks = parseStyleBlocks(src);

    // A sheet: percentage `maxHeight` and NO definite height of its own. With a
    // definite height (`flex: 1`, `height:`) a `flex: 1` child is correct and
    // this whole class does not apply.
    const sheets = Object.keys(blocks).filter((name) =>
      blocks[name].some(
        (b) =>
          /maxHeight: '\d+%'/.test(b) &&
          !/\bflex: 1\b/.test(b) &&
          !/(?:^|[\s,{])height:/.test(b),
      ),
    );

    for (const sheet of sheets) {
      const usage = new RegExp(`<[\\w.]+[^>]*?style=\\{\\[?styles\\.${sheet}\\b`, 'g');
      let u: RegExpExecArray | null;
      while ((u = usage.exec(src)) !== null) {
        sheetsSeen++;
        const [a, b] = elementSpan(src, u.index);
        const inner = src.slice(a, b);
        const scroller = /<(ScrollView|FlatList)\b/g;
        let s: RegExpExecArray | null;
        while ((s = scroller.exec(inner)) !== null) {
          const tag = inner.slice(s.index, tagEnd(inner, s.index) + 1);
          if (tag.includes('horizontal')) continue; // a horizontal list has no vertical overflow
          const named = /\bstyle=\{\[?styles\.(\w+)/.exec(tag)?.[1];
          const inline = /\bstyle=\{(?:\[[^\]]*)?\{([^}]*)\}/.exec(tag)?.[1] ?? '';
          const declared = (named ? (blocks[named] ?? []).join(' ') : '') + ' ' + inline;
          if (declared.includes('flexShrink: 1')) continue;
          sites.push({
            file: rel(file),
            line: src.slice(0, a + s.index).split('\n').length,
            sheet,
          });
        }
      }
    }
  }
  return { sites, sheetsSeen };
}

describe('every scroller inside a maxHeight-only sheet can shrink', () => {
  const { sites, sheetsSeen } = unshrinkableScrollers();

  it('the sweep resolved real sheets (the control)', () => {
    // Without this, a parser that silently stopped matching would report a
    // clean app — the exact way the previous sweep let sixteen sites through.
    expect(sheetsSeen).toBeGreaterThanOrEqual(15);
  });

  it('and none of their scrollers is missing flexShrink', () => {
    expect(sites.map((s) => `${s.file}:${s.line} (in styles.${s.sheet})`)).toEqual([]);
  });
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
