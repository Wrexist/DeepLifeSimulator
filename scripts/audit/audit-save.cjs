/**
 * AUDIT 3 — Save & State Integrity
 *
 * Guards the save schema against the two failure modes that lock players out of their
 * progress: version drift (docs/migrations out of sync with STATE_VERSION) and test
 * GameState drift (manual construction that hides real schema gaps).
 *
 * Invariants:
 *   V1  STATE_VERSION is parseable from the canonical source (initialState.ts).
 *   V2  CLAUDE.md and AGENTS.md document the same STATE_VERSION (no doc drift — lessons.md).
 *   V3  Every version in [2..STATE_VERSION] is migration-covered (registry or no-op set).
 *   V4  CURRENT_STATE_VERSION tracks STATE_VERSION (no hardcoded fork).
 *   V5  Checksum + tamper verification primitives exist in saveValidation.ts.
 *   V6  Tests don't construct GameState manually (`as GameState`) — must use the factory.
 *   V7  createTestGameState factory exists.
 *   V8  Migration/repair parity: every field a migration backfills with a CONCRETE
 *       default is also mirrored in repairGameState (CLAUDE.md save-format rule (b)).
 *   V9  No repair branch writes a backfill without setting `repaired = true` — the
 *       repaired clone is discarded otherwise (2026-07-28 audit save-3).
 *   V10 A new life can never guess its save slot: no numeric slot fallback, every
 *       entry into onboarding assigns one, and the write itself re-checks
 *       occupancy (2026-07-29 player save-loss report).
 *   V11 The INVERSE of V8 (Hard Rule #3, the direction that was never machine-checked):
 *       every top-level `initialGameState` field with a CONCRETE stored default is
 *       migration- or repair-covered, or is an explicitly grandfathered legacy field.
 */
'use strict';

const L = require('./_lib.cjs');

// Tests legitimately allowed to touch raw GameState shape (the factory + its own tests).
const FACTORY_ALLOWLIST = [
  '__tests__/helpers/createTestGameState.ts',
  // Contains the literal `as GameState` inside FIXTURE STRINGS — it is the test
  // for the marker mechanism itself, so it must be able to write examples of
  // both a marked and an unmarked cast. Nothing here constructs a real
  // GameState; the token is data, not a type assertion.
  '__tests__/tooling/deliberateCastMarker.test.ts',
];

/**
 * Per-cast opt-out for a deliberate corruption fixture.
 *
 * Hard Rule #3 bans hand-built GameState because a cast hides drift, but a test
 * proving the code SURVIVES garbage must be able to construct garbage. Those
 * casts carry a `DELIBERATE-CORRUPTION` marker, and the decision of whether a
 * given cast is covered lives in `scripts/lib/deliberateCast.js` so it can be
 * tested directly — see `__tests__/tooling/deliberateCastMarker.test.ts`.
 *
 * Deliberately NOT the per-file FACTORY_ALLOWLIST above: exempting a whole file
 * would also hide an ACCIDENTAL cast added to it later.
 */
const { isDeliberateCast } = require('../lib/deliberateCast');

/**
 * V11 grandfather list — top-level `initialGameState` fields that carry a
 * CONCRETE stored default and have neither a migration nor a `repairGameState`
 * mirror.
 *
 * They are one class, not a grab-bag: every one of them predates the v22+
 * discipline in CLAUDE.md §7 ("a field added to initialState ships its migration
 * and its repair mirror in the SAME change"). They are not live bugs, because
 * the primary load path reconstitutes a save as `{ ...initialGameState, ...parsed }`
 * — an absent key is filled from the defaults object before anything reads it.
 * What they lack is the SECOND line of defence the rule exists to provide: a
 * save that arrives partial through a path that does not spread (a CloudSync
 * field-merge, a hand-edited or truncated blob) is healed by neither the version
 * ladder nor repair.
 *
 * The list is a RATCHET, exactly like the coverage floors and the test-type
 * baseline: it is seeded with what was already there so the audit is green
 * today, and it must only ever SHRINK.
 *
 * **Never add a field here.** A NEW field without a migration and a repair
 * mirror is precisely the GameState drift Hard Rule #3 exists to catch — fix it
 * by writing the migration and the mirror, not by widening this set. Removing an
 * entry (by giving that field its coverage) is always welcome; V11b flags stale
 * entries so the list cannot silently rot.
 */
const LEGACY_PRE_MIGRATION_FIELDS = new Set([
  'activityCommitments', 'ancestors', 'activeTraits', 'claimedProgressAchievements',
  'completedGoals', 'computerPreviouslyOwned', 'criminalLevel', 'criminalXp',
  'curedDiseases', 'discoveredSystems', 'dmConversations', 'dynastyStats',
  'escapedFromJail', 'generationNumber', 'happinessZeroWeeks', 'hasDriversLicense',
  'hasPhone', 'hasSeenJobTutorial', 'healthWeeks', 'healthZeroWeeks', 'journal',
  'karma', 'lastDiseaseWeek', 'lastLogin', 'legacyBonuses', 'lifeMilestones',
  'lifeMoments', 'lifeStage', 'lifetimeStatistics', 'lineageId', 'memories',
  'mindset', 'pendingChainedEvents', 'pendingEvents', 'petFood', 'politics',
  'prestigeAvailable', 'previousLives', 'revealedDMClues', 'seasonalEvents',
  'showCureSuccessModal', 'showDeathPopup', 'showSicknessModal', 'showWeddingPopup',
  'showWelcomePopup', 'showZeroStatPopup', 'socialPosts', 'streetJobsCompleted',
  'totalHappiness', 'unlockedLifeSkills', 'updatedAt', 'vaccinations', 'vehicles',
  'weeklyJailActivities', 'weeklyStreetJobs', 'weeklyStudySessions', 'youthPills',
]);

function build() {
  const a = new L.Audit(3, 'Save & State Integrity');

  const initial = L.read('contexts/game/initialState.ts');
  const stateVersion = initial ? L.extractNumber(initial, 'STATE_VERSION') : null;

  // --- V1 ------------------------------------------------------------------
  if (stateVersion == null) {
    a.high('STATE_VERSION not parseable', 'Cannot anchor save-integrity checks.', 'contexts/game/initialState.ts:6');
    return a;
  }
  a.pass(`STATE_VERSION = ${stateVersion} (canonical)`, '', 'contexts/game/initialState.ts:6');

  // --- V2: doc drift -------------------------------------------------------
  // The dev docs were renamed (CLAUDE.md → DEV.md, AGENTS.md → WORKFLOW.md). The
  // current tree ships DEV.md/WORKFLOW.md and each must state the canonical
  // STATE_VERSION so drift is visible. Legacy names are still cross-checked when
  // present (older trees/worktrees) but their absence is expected and silent —
  // not a warning. This block previously hard-coded only the legacy names, so
  // after the rename the STATE_VERSION cross-check silently went dark.
  const CURRENT_DOCS = ['DEV.md', 'WORKFLOW.md'];
  const LEGACY_DOCS = ['CLAUDE.md', 'AGENTS.md'];
  let anyDocFound = false;
  for (const doc of [...CURRENT_DOCS, ...LEGACY_DOCS]) {
    const src = L.read(doc);
    if (src == null) {
      // A missing current doc is worth an INFO note; a missing legacy doc is
      // fully expected on the current tree, so stay silent.
      if (CURRENT_DOCS.includes(doc)) a.info(`${doc} not found`, 'Skipping doc-version check.', doc);
      continue;
    }
    anyDocFound = true;
    const m = src.match(/STATE_VERSION\s*=\s*(\d+)/);
    if (!m) {
      // A present-but-silent doc is already covered by this per-doc medium — the
      // aggregate below must NOT also fire for it (that would double-report one root cause).
      a.medium(`${doc} does not state STATE_VERSION`, 'Add the canonical version so drift is visible.', doc);
    } else {
      a.assert(Number(m[1]) === stateVersion, 'medium',
        `${doc} STATE_VERSION matches code (${stateVersion})`,
        `${doc} STATE_VERSION drift: doc says ${m[1]}, code is ${stateVersion}`,
        'Documented save-version drift has bitten this repo before (lessons.md).', doc);
    }
  }
  // Only escalate when NO dev doc was found at all; a doc that exists but omits
  // the version is handled by its own per-doc medium above.
  if (!anyDocFound) {
    a.medium('No dev doc states STATE_VERSION',
      'DEV.md/WORKFLOW.md must document the canonical save version so drift is visible.', 'DEV.md');
  }

  // --- V3/V4: migration coverage ------------------------------------------
  const mig = L.read('utils/saveMigrations.ts');
  if (mig == null) {
    a.high('utils/saveMigrations.ts missing', 'Cannot verify migration coverage.', 'utils/saveMigrations.ts');
  } else {
    const current = L.extractNumber(mig, 'CURRENT_STATE_VERSION');
    const hasCurrent = /\bCURRENT_STATE_VERSION\s*=/.test(mig);
    // CURRENT_STATE_VERSION = STATE_VERSION (alias) — extractNumber returns null for a
    // non-numeric RHS, which is the *correct* wiring, so only flag a numeric fork.
    // But null also means the symbol is entirely absent — that must NOT pass silently.
    if (!hasCurrent) {
      a.high('CURRENT_STATE_VERSION not defined in saveMigrations',
        'The migration loop has no version ceiling to drive from.', 'utils/saveMigrations.ts:15');
    } else if (current != null && current !== stateVersion) {
      a.high('CURRENT_STATE_VERSION forked from STATE_VERSION',
        `saveMigrations hardcodes ${current}, initialState is ${stateVersion}.`, 'utils/saveMigrations.ts:15');
    } else {
      a.pass('CURRENT_STATE_VERSION aliases STATE_VERSION (no fork)', '', 'utils/saveMigrations.ts:15');
    }

    const registered = parseMigrationKeys(mig);
    const noop = parseNoOpVersions(mig);
    const covered = new Set([...registered, ...noop]);
    const gaps = [];
    for (let v = 2; v <= stateVersion; v++) if (!covered.has(v)) gaps.push(v);

    a.assert(gaps.length === 0, 'critical',
      `All versions [2..${stateVersion}] migration-covered (${registered.length} migrations, ${noop.length} no-ops)`,
      `Migration gap: version(s) ${gaps.join(', ')} have no migration or no-op entry`,
      'runMigrations halts at the first uncovered version — saves built before then will not load.',
      'utils/saveMigrations.ts:32');
  }

  // --- V5: integrity primitives -------------------------------------------
  const sv = L.read('utils/saveValidation.ts');
  if (sv == null) {
    a.high('utils/saveValidation.ts missing', 'Cannot verify save integrity primitives.', 'utils/saveValidation.ts');
  } else {
    a.assert(/calculateChecksum|0xedb88320/.test(sv), 'medium',
      'CRC32 checksum primitive present', 'CRC32 checksum primitive missing',
      'Corruption detection on load relies on it.', 'utils/saveValidation.ts');
    a.assert(/hmac|HMAC|sha256|SHA-?256/i.test(sv), 'low',
      'Tamper-detection (HMAC/SHA-256) primitive present', 'No HMAC/SHA-256 tamper primitive found',
      'Checksums catch corruption, not tampering.', 'utils/saveValidation.ts');
    a.assert(/repairGameState/.test(sv), 'medium',
      'repairGameState present (backfills missing defaults)', 'repairGameState not found',
      'Partial/cloud-synced saves need default backfill on load.', 'utils/saveValidation.ts');
  }

  // --- V6/V7: test GameState drift ----------------------------------------
  const factory = '__tests__/helpers/createTestGameState.ts';
  a.assert(L.exists(factory), 'high', 'createTestGameState factory present',
    'createTestGameState factory missing', 'All suites must build state through one factory (Hard Rule #3).', factory);

  const testFiles = L.walk('__tests__', L.isTest)
    .filter((f) => !FACTORY_ALLOWLIST.includes(f));
  const drift = L.grep(testFiles, /\bas GameState\b/, { skipComments: true })
    // Keep only casts NOT authorised as deliberate corruption fixtures.
    .filter((d) => {
      const src = L.read(d.file);
      return src ? !isDeliberateCast(src, d.line) : true;
    });

  a.assert(drift.length === 0, 'medium',
    'No manual `as GameState` construction in tests',
    `${drift.length} \`as GameState\` assertion(s) in tests bypass the factory`,
    drift.slice(0, 5).map((d) => `${d.file}:${d.line}`).join(', ') + (drift.length > 5 ? ' …' : ''),
    'No GameState Drift (Hard Rule #3)');

  // --- V8: migration ↔ repair parity --------------------------------------
  // The asymmetry the 2026-07-22 weekly audit found by hand: a field can be
  // migration-covered, factory-covered (createTestGameState spreads
  // initialGameState, so (c) is auto-satisfied) and STILL never mirrored into
  // repairGameState. A partial save already stamped at the current version
  // (CloudSync merge / hand-edit) is then healed by neither path — the ladder
  // skips it and repair has no branch. Only fields the migration assigns a
  // CONCRETE default are owed a mirror; an `= undefined` assignment means the
  // absent key already equals the default (CLAUDE.md rule (b), `ambitionId`).
  if (mig != null && sv != null) {
    const backfilled = concreteBackfillPaths(mig)
      // initialState is the authority on what "the default" IS. A field the
      // migration derives or converts (legacy fixups like `challengeStreak`,
      // `lastEventWeeksLived`) but that carries no concrete default there owes
      // no mirror — repair's job is restoring defaults, not re-deriving history.
      .filter((p) => hasConcreteDefault(initial, p.split('.').pop()));
    const unmirrored = backfilled.filter((p) => !mentionsField(sv, p.split('.').pop()));
    a.assert(unmirrored.length === 0, 'medium',
      `All ${backfilled.length} migration-backfilled concrete defaults are mirrored in repairGameState`,
      `${unmirrored.length} migration-backfilled field(s) have no repairGameState mirror`,
      unmirrored.join(', ') + ' — a partial save stamped at the current version is healed by neither path (save-format rule (b)).',
      'utils/saveValidation.ts');
  }

  // --- V11: the INVERSE of V8 ---------------------------------------------
  // V8 walks the migrations and asks "is each backfill mirrored in repair?".
  // That only ever sees fields someone already remembered to migrate. The rule
  // CLAUDE.md §7 actually states runs the other way: EVERY field added to
  // `initialState` with a concrete stored default ships a migration AND a repair
  // mirror in the same change. Nothing checked that direction, so the only thing
  // standing between a forgotten pair and a player was the fact that the primary
  // load path spreads `initialGameState` first — which a partial/field-merged
  // save does not go through. This closes it: the grandfathered legacy set is
  // frozen in LEGACY_PRE_MIGRATION_FIELDS above, and anything NEW fails.
  if (mig != null && sv != null) {
    const concrete = topLevelInitialFields(initial).filter((f) => f.concrete).map((f) => f.name);
    const uncovered = uncoveredConcreteFields(initial, mig, sv);
    const undocumented = uncovered.filter((name) => !LEGACY_PRE_MIGRATION_FIELDS.has(name));

    a.assert(undocumented.length === 0, 'high',
      `All ${concrete.length} concrete-default initialState fields are migration/repair-covered `
        + `(${LEGACY_PRE_MIGRATION_FIELDS.size} grandfathered)`,
      `${undocumented.length} initialState field(s) with a concrete default have neither a migration nor a repairGameState mirror`,
      undocumented.join(', ')
        + ' — GameState drift (Hard Rule #3). Ship the migration (bumping STATE_VERSION) and the'
        + ' repairGameState mirror in the same change; do NOT add the field to'
        + ' LEGACY_PRE_MIGRATION_FIELDS, which is frozen and may only shrink.',
      'contexts/game/initialState.ts');

    // V11b: a grandfather entry that no longer describes reality. Either the
    // field gained its coverage (great — drop the entry so the ratchet locks the
    // win in) or it was renamed/removed. A stale baseline silently leaves room
    // for a regression to creep back up to it, the same failure mode the
    // test-type ratchet keeps a DOWN branch for.
    const uncoveredSet = new Set(uncovered);
    const stale = [...LEGACY_PRE_MIGRATION_FIELDS].filter((name) => !uncoveredSet.has(name));
    a.assert(stale.length === 0, 'low',
      'LEGACY_PRE_MIGRATION_FIELDS has no stale entries',
      `${stale.length} grandfathered field(s) no longer need the exemption`,
      stale.join(', ')
        + ' — each is now covered (or gone). Remove it from LEGACY_PRE_MIGRATION_FIELDS so the ratchet holds the ground.',
      'scripts/audit/audit-save.cjs');
  }

  // --- V9: a repair that never sets the flag is a repair that is discarded ---
  // repairGameState works on a CLONE and writes it back only when `repaired` is
  // true, so a branch that assigns a default but leaves the flag alone is
  // computed and thrown away — the save reaches gameplay exactly as broken as it
  // arrived, on every load. Fourteen Spark/Pulse backfills had that shape.
  if (sv != null) {
    const flagless = repairBranchesMissingFlag(sv);
    a.assert(flagless.length === 0, 'medium',
      'Every repairGameState backfill sets `repaired`',
      `${flagless.length} repair branch(es) assign a default without setting \`repaired\``,
      flagless.slice(0, 6).map((f) => `line ${f.line}: ${f.text}`).join(' · ')
        + (flagless.length > 6 ? ' …' : '')
        + ' — the repaired clone is only written back when the flag is set, so these are discarded.',
      'utils/saveValidation.ts');
  }

  // --- V10: a new life must never guess which slot to overwrite ------------
  // A player lost a prestiged run to a fresh Week 1 character that validated
  // clean — it WAS clean, just written to the wrong slot. `Perks` resolved the
  // target with `state.slot || 1`, so any route into onboarding that skipped the
  // slot picker (the death screen set no slot at all) inherited the context
  // default and clobbered slot 1 in silence. Three shapes brought that back, so
  // all three are checked.
  const onboardingSources = L.walk(
    ['app/(onboarding)', 'src/features/onboarding'],
    L.isProductionSource,
  );

  // V10a — no numeric fallback for a slot. "Unchosen" must stay unchosen.
  const slotFallbacks = L.grep(onboardingSources, /\bslot\s*(\|\||\?\?)\s*[1-9]\b/i, {
    skipComments: true,
  });
  a.assert(slotFallbacks.length === 0, 'high',
    'No onboarding module defaults an unchosen save slot to a number',
    `${slotFallbacks.length} slot fallback(s) would pick a slot for the player`,
    slotFallbacks.map((h) => `${h.file}:${h.line} — ${h.text}`).join(' · ')
      + ' — a write cannot tell a deliberate slot 1 from a defaulted one, so it must refuse instead (src/features/onboarding/slotSafety.ts).',
    'src/features/onboarding/slotSafety.ts');

  // V10b — every screen that pushes into the onboarding stack assigns a slot
  // first. DeathPopup navigated there setting nothing at all.
  const navigators = L.walk(['app', 'components'], L.isProductionSource).filter((f) => {
    const src = L.read(f);
    if (src == null) return false;
    if (!/router\.(push|replace|navigate)\(\s*['"]\/\(onboarding\)\/Scenarios/.test(src)) return false;
    // Screens already INSIDE the flow are exempt: their navigation to Scenarios
    // is the flow guard bouncing a player backwards, not a new entry, and the
    // guard itself now requires a slot before those screens render at all.
    if (/useOnboardingFlowGuard/.test(src)) return false;
    // Assigning a slot, or handing the player to the picker, both count.
    return !/\bslot\s*:/.test(L.stripNoise(src)) && !/\/\(onboarding\)\/SaveSlots/.test(src);
  });
  a.assert(navigators.length === 0, 'high',
    'Every entry into the onboarding stack sets the target save slot',
    `${navigators.length} screen(s) enter onboarding without choosing a slot`,
    navigators.join(', ')
      + ' — the write four screens later has nothing to go on and used to default to slot 1.',
    'components/DeathPopup.tsx');

  // V10c — the refusal lives at the write, not only in the UI. A guard on an
  // earlier screen is bypassed by the next navigation path someone adds.
  const initializer = L.read('src/features/onboarding/gameInitializer.ts');
  if (initializer) {
    const clean = L.stripNoise(initializer);
    const resolveAt = clean.indexOf('resolveNewLifeSlot(');
    const saveAt = clean.indexOf('forceSave(');
    a.assert(resolveAt !== -1 && saveAt !== -1 && resolveAt < saveAt, 'high',
      'initializeAndSaveGame resolves the slot before it writes',
      'The new-game write is not gated on a fresh slot check',
      'forceSave must be preceded by resolveNewLifeSlot in the same function — the occupancy read has to happen against the storage the save is about to overwrite.',
      'src/features/onboarding/gameInitializer.ts');
  }

  return a;
}

// --- helpers ---------------------------------------------------------------

/**
 * Single-line `if (…) s.x = <default>;` branches inside repairGameState that do
 * not set `repaired`. Deliberately narrow: only the one-line form, which is the
 * shape that hid the save-3 class. Multi-line blocks are brace-matched and
 * checked for the flag anywhere inside.
 */
function repairBranchesMissingFlag(src) {
  const clean = L.stripNoise(src);
  const fnStart = clean.indexOf('export function repairGameState');
  if (fnStart === -1) return [];
  const body = repairGameStateBody(src);
  const startLine = src.slice(0, fnStart).split('\n').length;

  const out = [];
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // `if (<cond>) <obj>.<field> = <value>;` all on one line, no `repaired`.
    const m = line.match(/^\s*if\s*\(.*\)\s*\{?\s*(s|sp|sm|dw|b|gs)\.[\w.[\]'"]+\s*=\s*[^=].*;/);
    if (!m) continue;
    if (/\brepaired\b/.test(line)) continue;
    // A one-line `if (…) {` that opens a block: the flag may be on a later line.
    if (/\{\s*$/.test(line)) continue;
    out.push({ line: startLine + i, text: line.trim().slice(0, 90) });
  }
  return out;
}
function parseMigrationKeys(src) {
  // Isolate ONLY the `migrations = { … }` object body via brace matching, so numeric
  // keys in unrelated objects later in the file aren't miscounted as covered versions
  // (which would hide a real migration gap).
  // Non-greedy to the first `= {`; this skips over the generic type annotation
  // `Record<number, (state: any) => any>` whose `=>` arrow would defeat a `[^>]*` match.
  const start = src.match(/const\s+migrations\b[\s\S]*?=\s*\{/);
  if (!start) return [];
  const open = start.index + start[0].length - 1; // index of the opening `{`
  let depth = 0;
  let end = src.length;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(open + 1, end);
  const keys = new Set();
  // Top-level keys only: `<digits>:` at the object's first indentation level. Matching
  // line-start keys within the object body is sufficient since nested handler bodies
  // don't define bare numeric keys.
  const re = /^\s*(\d+)\s*:/gm;
  let m;
  while ((m = re.exec(body))) keys.add(Number(m[1]));
  return [...keys];
}

/**
 * Every `state.<path> = <concrete value>` a migration performs, as dotted paths.
 * Assignments of `undefined` are skipped: an absent key already equals that
 * default, so no repair mirror is owed. Comments/strings are stripped first so a
 * documented example can't register as a real backfill.
 */
function concreteBackfillPaths(src) {
  const clean = L.stripNoise(src);
  const re = /\bstate\.((?:[A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*)\s*=\s*([^=;\n]*)/g;
  const paths = new Set();
  let m;
  while ((m = re.exec(clean))) {
    const [, path, rhs] = m;
    if (rhs.trim().startsWith('=')) continue; // `==` / `===` comparison, not an assignment
    if (/^\s*undefined\s*$/.test(rhs)) continue; // undefined default → no mirror owed
    if (path === 'version') continue; // the version stamp itself is not a data field
    paths.add(path);
  }
  return [...paths].sort();
}

/**
 * The comment/string-stripped body of `repairGameState`, or '' when absent.
 * Character offsets match the original source, so callers can still translate an
 * index back into a line number. Used both by the flag check (V9) and by V11,
 * which needs to ask about repair coverage WITHOUT matching the rest of
 * saveValidation.ts — `validateGameState` names many fields it never heals, and
 * counting those as covered would make V11 pass on fields repair never touches.
 * The `requiredArrays` / `catalogArrays` / `subsystemObjects` lists all live
 * inside this body, so table-driven backfills count exactly as they should.
 */
function repairGameStateBody(src) {
  const clean = L.stripNoise(src);
  const fnStart = clean.indexOf('export function repairGameState');
  if (fnStart === -1) return '';
  // BRACE-MATCHED, not "the first column-0 `}`". That older heuristic ended the
  // body ~400 lines early here, because `stripNoise` deletes `//` comments
  // outright (length is NOT preserved) so character offsets in the cleaned text
  // no longer line up with anything in the original — the search happened to
  // land mid-function. V11 reads this body as the authority on what repair
  // covers, so a short read would report healthy fields as uncovered.
  // The body's `{` is the first one that ENDS a line — the earlier braces on the
  // declaration belong to the return type (`: { repaired: boolean; … }`), and
  // matching those yields a "body" one signature long.
  const decl = clean.slice(fnStart).match(/^export function repairGameState[\s\S]*?\{[ \t]*\r?\n/);
  if (!decl) return clean.slice(fnStart);
  const open = fnStart + decl[0].lastIndexOf('{');
  let depth = 0;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}') {
      depth--;
      if (depth === 0) return clean.slice(fnStart, i);
    }
  }
  return clean.slice(fnStart);
}

/**
 * The V11 verdict as a PURE function of the three sources, so the rule can be
 * exercised against fixtures (`__tests__/tooling/initialStateFieldCoverage.test.ts`)
 * rather than only against whatever the repo happens to look like today — a
 * ratchet nobody can prove still bites is not a ratchet.
 *
 * Returns the top-level `initialGameState` fields that have a CONCRETE default
 * and are named by neither the migration registry nor `repairGameState`
 * (body or table). The grandfather list is applied by the CALLER, so this stays
 * a statement about the code rather than about the exemptions.
 */
function uncoveredConcreteFields(initialSrc, migSrc, repairSrc) {
  const repairBody = repairGameStateBody(repairSrc);
  const repairTables = repairTableFields(repairSrc);
  return topLevelInitialFields(initialSrc)
    .filter((f) => f.concrete)
    .map((f) => f.name)
    .filter((name) => !mentionsField(migSrc, name)
      && !mentionsField(repairBody, name)
      && !repairTables.has(name));
}

/**
 * Field names covered by repairGameState's TABLE-DRIVEN backfills.
 *
 * `repairGameStateBody` runs through `stripNoise`, which blanks string literals
 * — so the twenty-odd fields repair heals via a loop over a list of names
 * (`requiredArrays`, `catalogArrays`, `subsystemObjects`) are invisible to a
 * body scan and would be reported as uncovered. Read from the RAW source, and
 * only for those three known tables: scanning every quoted string in the
 * function would also match field names that merely appear inside a
 * `repairs.push('Created missing … object')` message, which proves nothing.
 */
function repairTableFields(src) {
  const names = new Set();
  for (const table of ['requiredArrays', 'catalogArrays', 'subsystemObjects']) {
    const m = src.match(new RegExp(`const\\s+${table}\\s*=\\s*\\[([^\\]]*)\\]`));
    if (!m) continue;
    for (const entry of m[1].matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g)) names.add(entry[1]);
  }
  return names;
}

/**
 * Every TOP-LEVEL key of the `initialGameState` object literal, with whether its
 * default is CONCRETE (anything but a literal `undefined`).
 *
 * Depth-tracked rather than indentation-matched: nested subsystem literals are
 * full of keys, and a two-space heuristic would break the moment the file is
 * reformatted. Comments and string/template literals are blanked first (length
 * preserved) so a brace inside either cannot skew the depth counter.
 */
function topLevelInitialFields(initialSrc) {
  if (initialSrc == null) return [];
  const clean = L.stripNoise(initialSrc);
  const decl = clean.match(/initialGameState\s*:\s*GameState\s*=\s*\{/);
  if (!decl) return [];
  const open = decl.index + decl[0].length - 1;

  let depth = 0;
  let end = clean.length;
  for (let i = open; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = clean.slice(open + 1, end);

  // Depth at each character of the body (an opener's own index is the OUTER depth).
  const depthAt = new Array(body.length);
  let d = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' || ch === '[' || ch === '(') { depthAt[i] = d; d++; }
    else if (ch === '}' || ch === ']' || ch === ')') { d--; depthAt[i] = d; }
    else depthAt[i] = d;
  }

  const out = [];
  const re = /([A-Za-z_$][\w$]*)\s*:/g;
  let m;
  while ((m = re.exec(body))) {
    if (depthAt[m.index] !== 0) continue;
    // Must START a property — only whitespace since the previous `,`/`{`/newline.
    // Keeps a `?:` ternary's colon or a type annotation from registering as a key.
    const before = body.slice(0, m.index);
    if (before.trim() !== '' && !/[,{\n]\s*$/.test(before)) continue;
    const rhs = body.slice(m.index + m[0].length).split('\n')[0].trim();
    out.push({ name: m[1], concrete: !/^undefined\s*,?$/.test(rhs) });
  }
  return out;
}

/** Does `src` reference this field name at all (property read, key, or index)? */
function mentionsField(src, leaf) {
  return new RegExp(`\\b${leaf}\\b`).test(src);
}

/**
 * True when `initialState.ts` declares `leaf:` with a CONCRETE stored default.
 * `leaf: undefined` (and an absent key) means the default is "no key", which
 * needs no migration backfill and no repair mirror.
 */
function hasConcreteDefault(initialSrc, leaf) {
  if (initialSrc == null) return false;
  const m = L.stripNoise(initialSrc).match(new RegExp(`^\\s*${leaf}\\s*:\\s*([^,\\n]*)`, 'm'));
  if (!m) return false;
  return !/^\s*undefined\s*$/.test(m[1]);
}

function parseNoOpVersions(src) {
  const m = src.match(/NO_OP_MIGRATION_VERSIONS\s*=\s*new Set<number>\(\s*\[([0-9,\s]*)\]/);
  if (!m) return [];
  return m[1].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
}

module.exports = {
  build,
  // Exported for `__tests__/tooling/initialStateFieldCoverage.test.ts`, which
  // proves the V11 ratchet still fires and that the grandfather list has not rotted.
  LEGACY_PRE_MIGRATION_FIELDS,
  topLevelInitialFields,
  uncoveredConcreteFields,
};
if (require.main === module) L.runStandalone(build);
