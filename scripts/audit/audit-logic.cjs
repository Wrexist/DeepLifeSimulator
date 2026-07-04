/**
 * AUDIT 4 — Game Logic Correctness
 *
 * Catches the two correctness traps documented in CLAUDE.md that type-checking can't see:
 * the `week` (1–4 display cycle) vs `weeksLived` (absolute counter) trap, and the
 * DatingActions money-signature trap. Also flags direct state mutation in action modules.
 *
 * Invariants:
 *   G1  No `.week` used in time/duration arithmetic or comparisons (must be `weeksLived`).
 *   G2  DatingActions uses the functional updateMoney(setGameState,…), not the hook.
 *   G3  Action modules don't mutate state in place (push/splice/sort/assign on prev/state).
 *   G4  Weekly reducers use the immutable setGameState(prev => ({...prev})) idiom upstream.
 */
'use strict';

const L = require('./_lib.cjs');

function build() {
  const a = new L.Audit(4, 'Game Logic Correctness');

  const actionFiles = L.walk(['contexts/game/actions', 'contexts/game'], L.isProductionSource);

  // --- G1: week vs weeksLived ---------------------------------------------
  // Flag `.week` adjacent to a comparison/arithmetic operator, but NOT `.weeksLived`,
  // not `week:` object keys, and not `weekResult`/`weekContext`/`weekOf` identifiers.
  // Patterns: `.week <`, `.week >`, `.week ===`, `.week -`, `- .week`, `.week +`.
  const weekRe = /(?<![A-Za-z])\.week\s*(?:[<>]=?|===|!==|==|!=|-|\+(?!\+))|(?:[-+]\s*)\w*\.week(?![A-Za-z])/;
  const weekHits = L.grep(actionFiles, weekRe, { skipComments: true })
    .filter((h) => !/\bweeksLived\b/.test(h.text))           // weeksLived math is correct
    .filter((h) => !/week\s*:/.test(h.text))                 // object literal key
    .filter((h) => !/weekResult|weekContext|weekOf|weekly|weekday|weekend/i.test(h.text));
  a.assert(weekHits.length === 0, 'high',
    'No `.week` used in time comparisons (uses `weeksLived`)',
    `${weekHits.length} possible \`.week\`-in-comparison site(s) — should likely be \`weeksLived\``,
    weekHits.slice(0, 6).map((h) => `${h.file}:${h.line}`).join(', ') + (weekHits.length > 6 ? ' …' : ''),
    'DEV.md: week is display-only; weeksLived is the absolute clock');

  // --- G2: DatingActions signature trap -----------------------------------
  const dating = L.read('contexts/game/actions/DatingActions.ts');
  if (dating == null) {
    a.low('DatingActions.ts not found', 'Skipping signature-trap check.', 'contexts/game/actions/DatingActions.ts');
  } else {
    const usesHook = /\buseMoneyActions\b/.test(dating);
    a.assert(!usesHook, 'high',
      'DatingActions uses functional updateMoney(setGameState,…)',
      'DatingActions imports useMoneyActions (hook) — wrong signature',
      'Hard Rule #5: DatingActions must call updateMoney(setGameState, amount, reason), not the hook (amount, reason).',
      'contexts/game/actions/DatingActions.ts');
    if (!usesHook && /\bupdateMoney\s*\(/.test(dating)) {
      a.pass('DatingActions calls updateMoney directly', '', 'contexts/game/actions/DatingActions.ts');
    }
  }

  // --- G3: direct state mutation in actions -------------------------------
  // In-place mutation of `prev`/`state`/`gameState` arrays or fields defeats React change
  // detection and corrupts the immutable save. Heuristic — reported as medium (review).
  const mutationRe = /\b(prev|state|gameState|newState|draft)\.[A-Za-z0-9_.]+\.(push|pop|shift|unshift|splice|sort|reverse)\s*\(/;
  const mutHits = L.grep(actionFiles, mutationRe, { skipComments: true })
    // allow on locally-cloned copies (common idiom: `const x = [...prev.x]; x.push(...)`)
    .filter((h) => !/const\s|let\s|=\s*\[/.test(h.text));
  a.assert(mutHits.length === 0, 'medium',
    'No in-place array mutation of state in action modules',
    `${mutHits.length} possible in-place mutation(s) of state arrays`,
    mutHits.slice(0, 6).map((h) => `${h.file}:${h.line}`).join(', ') + (mutHits.length > 6 ? ' …' : ''),
    'Never mutate state directly — clone then setGameState(prev => ({...prev}))');

  // --- G4: immutable update idiom present ---------------------------------
  const ctx = L.read('contexts/game/GameActionsContext.tsx') || '';
  a.assert(/setGameState\(\s*\(?\s*\w+\s*\)?\s*=>\s*\(\{\s*\.\.\./.test(ctx) || /\.\.\.prev(State)?\b/.test(ctx), 'low',
    'Functional immutable setGameState idiom present in game loop',
    'Could not confirm functional setGameState(prev => ({...prev})) idiom',
    'State updates should spread the previous state, never mutate it.', 'contexts/game/GameActionsContext.tsx');

  return a;
}

module.exports = { build };
if (require.main === module) L.runStandalone(build);
