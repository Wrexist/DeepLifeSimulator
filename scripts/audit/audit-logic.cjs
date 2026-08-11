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
 *   G5  Hand-written charges inside an updater have a refusal path (gate→grant ratchet).
 */
'use strict';

const L = require('./_lib.cjs');

/**
 * G5 — the "gate → grant" budget.
 *
 * CLAUDE.md §4.4 calls this the single most repeated bug class in the repo, and
 * a full audit found THREE live instances the other 53 invariants could not
 * see: a dark-web hack that minted money, a gym session that paid out free
 * stats, and a warehouse upgrade that stored a negative balance while skipping
 * its own level ceiling.
 *
 * What they shared: affordability checked OUTSIDE a `setGameState` updater, the
 * effect applied inside, and the balance written BY HAND rather than through a
 * helper that can refuse. Two taps in one React batch both read the same stale
 * snapshot and both pass.
 *
 * So this counts hand-written balance charges whose enclosing updater has no
 * refusal path at all. It is a RATCHET, not a threshold — the repo's own
 * lesson (see the coverage note in CLAUDE.md §8) is that a gate which cannot
 * pass trains you to skim the failure. The number may only go DOWN; raise it
 * to get a build unstuck and the next real one walks in behind it.
 *
 * The two sites still counted are both DEAD exports, kept for their tests and
 * marked as superseded — neither is reachable by a tap:
 *
 *   · `VehicleActions.processVehicleWeekly`  (@deprecated; the live weekly
 *     vehicle tick is `applyVehiclesForWeek`)
 *   · `contexts/game/company.ts::createCompany`  (the UI calls the canonical
 *     `actions/CompanyActions.ts::createCompany`, which charges via
 *     `updateMoney`)
 *
 * Delete either and this drops to 1 — lower the budget in the same commit.
 */
const GATE_GRANT_BUDGET = 2;

/** Charging through any of these is safe — each re-checks `prev` and rejects. */
const GUARDED_HELPERS = /updateMoney|applyMoneyDelta|batchUpdateMoney|chargeOrDefer|spendMoney/;

function countUnguardedCharges(files) {
  const hits = [];
  for (const file of files) {
    const src = L.read(file);
    if (!src || !/setGameState/.test(src)) continue;
    const lines = src.split('\n');

    lines.forEach((line, i) => {
      // A hand-written charge: money/gems reduced by something.
      //
      // The operand may be a named cost OR a numeric literal. Only identifiers
      // were matched at first, which silently exempted `money: prev.money - 100`
      // and `gems: prev.gems - 5` — the same stale-gate failure mode, invisible
      // to the budget. A detector with a blind spot reports a number that means
      // less than it looks like it means.
      if (!/\b(money|gems)\s*:/.test(line)) return;
      if (!/-\s*(?:[A-Za-z_$][\w$.]*|\d)/.test(line)) return;

      // Walk back to the enclosing updater, capturing its PARAMETER NAME.
      // Binding the real name matters: this codebase uses `prev`, `prevState`
      // and `state` interchangeably, and a detector hard-coded to `return prev`
      // reports every `return prevState;` refusal as a bug. A check that fires
      // on correct code is worse than no check — it trains you to skim it.
      let start = -1;
      let param = null;
      for (let j = i; j >= 0 && j > i - 60; j--) {
        const m = lines[j].match(/setGameState\s*\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*(?::[^=]+)?=>/);
        if (m) { start = j; param = m[1]; break; }
      }
      if (start === -1 || !param) return;

      const body = lines.slice(start, i + 20).join('\n');
      // A refusal path anywhere in the updater, or a guarded helper, is enough.
      if (new RegExp(`return\\s+${param}\\s*[;,)]`).test(body)) return;
      if (GUARDED_HELPERS.test(body)) return;

      hits.push(`${file}:${i + 1}`);
    });
  }
  return hits;
}

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

  // --- G5: gate→grant ratchet ---------------------------------------------
  // Player-facing code only: the debug and simulation trees drive state on
  // purpose and are not reachable by a double-tap.
  const chargeFiles = L
    .walk(['contexts', 'components', 'app', 'lib', 'hooks', 'src'], L.isProductionSource)
    .filter((f) => !/[\\/](debug|simulation)[\\/]/.test(f));
  const unguarded = countUnguardedCharges(chargeFiles);

  a.assert(unguarded.length <= GATE_GRANT_BUDGET, 'high',
    `Hand-written charges all have a refusal path (${unguarded.length}/${GATE_GRANT_BUDGET})`,
    `${unguarded.length} hand-written balance charge(s) with NO refusal in the enclosing updater — budget is ${GATE_GRANT_BUDGET}`,
    unguarded.slice(0, 8).join(', ') + (unguarded.length > 8 ? ' …' : ''),
    'CLAUDE.md §4.4 — charge inside the SAME updater that applies the effect, re-checking against `prev`');

  if (unguarded.length < GATE_GRANT_BUDGET) {
    a.info(`Gate→grant budget can be lowered to ${unguarded.length}`,
      'Tighten GATE_GRANT_BUDGET in scripts/audit/audit-logic.cjs to lock the win in.',
      'scripts/audit/audit-logic.cjs');
  }

  return a;
}

module.exports = { build };
if (require.main === module) L.runStandalone(build);
