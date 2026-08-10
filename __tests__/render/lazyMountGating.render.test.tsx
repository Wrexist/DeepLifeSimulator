import fs from 'fs';
import path from 'path';

/**
 * Every `React.lazy()` component under `app/` must be MOUNTED behind a
 * condition — never mounted always and handed `visible={false}`.
 *
 * ## Why this is worth a gate
 *
 * An always-mounted lazy modal fires its dynamic `import()` on every mount of
 * the screen that hosts it, for a surface the player sees on almost no render.
 * That is the opposite of what `lazy()` is for: it defers the modal's *paint*
 * by a tick while still paying for its graph, so the screen carries the cost
 * and loses the benefit.
 *
 * It also livelocked `__tests__/render/screens.render.test.tsx`. Under ts-jest
 * an `import()` compiles down to `Promise.resolve().then(() => require(…))`, so
 * it can only settle on a microtask — and `renderWithProviders` renders inside
 * a SYNCHRONOUS `act()`, which never yields one. React responded by restarting
 * the render from the shell to retry the pending lazy, forever: ~1.4M
 * `beginWork` calls per pass with `scheduleUpdateOnFiber` never firing, so it
 * was not a re-render loop and React's own "too many re-renders" guard could
 * not see it. Because the spin blocks the event loop, jest's `testTimeout`
 * could not fire either — CI reported a worker killed by SIGTERM, with nothing
 * in the message pointing anywhere near the screen that caused it.
 *
 * The failure mode is silence, which is why this asserts on the SOURCE rather
 * than by rendering. A render-based guard would reproduce the hang instead of
 * reporting it, and a hang is precisely the signal that proved unreadable.
 *
 * `app/_layout.tsx`, `app/(tabs)/_layout.tsx` and `MainMenu.tsx` already held
 * this shape; `app/(tabs)/home.tsx` was the sole exception, mounting three
 * reward popups unconditionally.
 */

const APP_DIR = path.join(__dirname, '..', '..', 'app');

/** Comments are prose ABOUT the rule; matching them would assert nothing. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The gate that mounts a lazy component, or null if it is mounted always.
 *
 * Every lazy component in `app/` is wrapped in `<Suspense>`, so the question is
 * what sits immediately before that `<Suspense>`: `{flag && (`, `{cond ? (`, or
 * nothing. Brace-matching backwards from the tag does NOT answer this — with no
 * gate present the walk simply escapes past every balanced sibling expression
 * and lands on the component function's own opening brace, whose body is full
 * of `&&`. That version of this check passed on deliberately broken input.
 */
function mountGate(src: string, at: number): string | null {
  const suspense = src.lastIndexOf('<Suspense', at);
  if (suspense === -1) return null;

  let before = src.slice(0, suspense).trimEnd();
  // `app/_layout.tsx` puts an <ErrorBoundary> between the gate and the
  // <Suspense>; step over such wrappers. Not a regex over the tag body: one of
  // those boundaries passes an arrow function, and the `>` in `=>` ends any
  // "no angle brackets inside" match early — which read as an un-gated modal.
  for (let layer = 0; layer < 3 && before.endsWith('>'); layer += 1) {
    const open = before.lastIndexOf('<');
    // `</Foo>` is a preceding sibling closing, not a wrapper opening.
    if (open === -1 || !/[A-Z]/.test(before[open + 1] ?? '')) break;
    before = before.slice(0, open).trimEnd();
  }

  const open = before.lastIndexOf('{');
  if (open === -1) return null;
  return before.slice(open + 1);
}

/** `{flag && (`, `{cond ? (`, and the paren-less forms of both. */
const GATE = /(&&|\?)\s*\(?$/;

describe('app/ — lazy components are mounted conditionally', () => {
  const files = walk(APP_DIR).filter((f) => /\blazy\s*\(/.test(fs.readFileSync(f, 'utf8')));

  it('finds the files that use React.lazy (so a rename cannot empty this suite)', () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(files.map((f) => [path.relative(APP_DIR, f), f]))(
    '%s gates every lazy component behind a condition',
    (rel, full) => {
      const src = stripComments(fs.readFileSync(full, 'utf8'));
      const names = [...src.matchAll(/const\s+(\w+)\s*=\s*lazy\s*\(/g)].map((m) => m[1]);
      expect(names.length).toBeGreaterThan(0);

      for (const name of names) {
        const uses = [...src.matchAll(new RegExp(`<${name}[\\s/>]`, 'g'))];
        expect(uses.length).toBeGreaterThan(0);

        for (const use of uses) {
          const gate = mountGate(src, use.index as number);
          const gated = gate !== null && GATE.test(gate);
          if (!gated) {
            throw new Error(
              `${rel}: <${name}> is mounted unconditionally. A lazy modal must be ` +
                `wrapped in a condition ({flag && <Suspense>…</Suspense>}), not ` +
                `mounted always with visible={false} — see this file's header for ` +
                `what that costs and how it hangs the render suite.\n` +
                `  found before its <Suspense>: ${
                  gate === null ? '<none>' : JSON.stringify(gate.slice(-80))
                }`
            );
          }
          expect(gated).toBe(true);
        }
      }
    }
  );
});
