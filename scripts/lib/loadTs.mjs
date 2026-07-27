/**
 * Run a TypeScript module from a build script.
 *
 * ## Why this exists
 *
 * The rendering harnesses drive the head by setting morph influences directly,
 * which is fine for "does this slider move the jaw" and useless for anything the
 * APP computes on the way to those influences. `applyAging` is the case that
 * forced it: it rewrites eleven morphs, the hair colour and the hairline, it is
 * numerically tested, and until now nobody had ever LOOKED at a character at
 * sixty. A harness that cannot call it can only check the half of the pipeline
 * that lives in the shader.
 *
 * Duplicating the logic in JS was the alternative and is worse than no check at
 * all: a copy of the aging curve in a screenshot script would drift from the
 * real one and then quietly certify the wrong face.
 *
 * ## How
 *
 * TypeScript's own compiler is already a dependency, so this transpiles on
 * demand — types stripped, no type CHECKING, which is `tsc`'s job and not
 * something a screenshot needs. Relative imports are resolved and transpiled
 * recursively; anything else (react-native, three) is passed to the real
 * `require`, which is what makes this usable only for the app's PURE modules.
 * That is the intended limit: `lib/identity` is pure by design, and a harness
 * reaching into a React component would be a harness testing the wrong thing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);
const cache = new Map();

/** Resolve a relative or `@/`-aliased import to a real .ts file. */
function resolveTs(fromFile, spec, projectRoot) {
  const base = spec.startsWith('@/')
    ? join(projectRoot, spec.slice(2))
    : resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Load a TypeScript module and return its exports.
 *
 * `projectRoot` is where `@/` points — the repo root.
 */
export function loadTs(file, projectRoot = process.cwd()) {
  const abs = resolve(file);
  const cached = cache.get(abs);
  if (cached) return cached;

  const source = readFileSync(abs, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: abs,
  });

  const module = { exports: {} };
  // Seeded BEFORE evaluation so an import cycle resolves to the partial module
  // rather than recursing forever — the same contract Node's own loader gives.
  cache.set(abs, module.exports);

  const localRequire = (spec) => {
    const target = resolveTs(abs, spec, projectRoot);
    if (target) return loadTs(target, projectRoot);
    // JSON is imported by lib/identity for the measurement statistics.
    if (spec.endsWith('.json')) {
      const p = spec.startsWith('@/') ? join(projectRoot, spec.slice(2)) : resolve(dirname(abs), spec);
      return JSON.parse(readFileSync(p, 'utf8'));
    }
    return nodeRequire(spec);
  };

  new Function('exports', 'require', 'module', '__filename', '__dirname', outputText)(
    module.exports, localRequire, module, abs, dirname(abs),
  );
  cache.set(abs, module.exports);
  return module.exports;
}
