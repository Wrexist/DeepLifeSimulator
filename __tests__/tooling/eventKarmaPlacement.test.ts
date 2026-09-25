/**
 * Karma on an event choice only lands when it sits INSIDE `effects`.
 *
 * The resolver reads `effects.karma` (GameActionsContext) and the event screen
 * shows `effects.karma` (WeeklyEventModal). Eleven choices in careerEvents and
 * travelEvents put `karma` on the choice itself, beside `effects`, so the
 * player's honesty / loyalty / generosity never moved for any of them - and
 * TypeScript could not say so, because an object literal returned from a
 * contextually typed `generate()` arrow skips the excess-property check.
 *
 * So this is a source scan: every `karma:` key in an event file must be opened
 * inside an `effects: {` object.
 */
import fs from 'fs';
import path from 'path';

const EVENTS_DIR = path.join(__dirname, '..', '..', 'lib', 'events');

/** Walk back from `karma:` to the line that opens its enclosing object. */
function enclosingOpener(src: string, index: number): string {
  let depth = 0;
  for (let i = index - 1; i >= 0; i--) {
    const ch = src[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        const lineStart = src.lastIndexOf('\n', i) + 1;
        return src.slice(lineStart, i + 1);
      }
      depth--;
    }
  }
  return '';
}

function misplacedKarma(): string[] {
  const hits: string[] = [];
  for (const file of fs.readdirSync(EVENTS_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const src = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf8');
    const re = /\bkarma:\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const opener = enclosingOpener(src, m.index);
      if (!/\beffects:\s*\{$/.test(opener.trim())) {
        const line = src.slice(0, m.index).split('\n').length;
        hits.push(`${file}:${line}  (enclosing: ${opener.trim() || '<none>'})`);
      }
    }
  }
  return hits;
}

describe('event karma placement', () => {
  it('finds karma keys at all (the control)', () => {
    const count = fs
      .readdirSync(EVENTS_DIR)
      .filter((f) => f.endsWith('.ts'))
      .reduce((n, f) => n + (fs.readFileSync(path.join(EVENTS_DIR, f), 'utf8').match(/\bkarma:\s*\{/g)?.length ?? 0), 0);
    expect(count).toBeGreaterThan(20);
  });

  it('puts every choice karma inside effects, where the resolver reads it', () => {
    expect(misplacedKarma()).toEqual([]);
  });
});
