'use strict';
/**
 * Which `as GameState` casts in a test are DELIBERATE corruption fixtures.
 *
 * Hard Rule #3 bans hand-built GameState because a cast hides schema drift. But
 * a test proving the code SURVIVES garbage has to construct garbage — `null` is
 * not assignable to `string[]`, and that is exactly what a truncated save
 * carries. Those casts are the point of the test, not a shortcut.
 *
 * Before this, `audit:save` simply counted them, so the number climbed every
 * time somebody wrote a correct corruption test (2 → 4 when the rental fixtures
 * landed). A warning that fires on good work is one people learn to skim, which
 * is how a real drift cast eventually gets waved through.
 *
 * ── Why the marker binds to the cast's OWN comment block ──────────────────
 *
 * The first version of this scanned a flat 12-line window above the cast. Review
 * caught that this is strictly broader than the per-line opt-out the comments
 * advertised: one fixture's marker could authorise an unrelated cast that merely
 * happened to sit within twelve lines of it, letting the audit pass with an
 * unmarked cast present. The guard would have been quietly weaker than it
 * claimed — the exact defect class it exists to catch.
 *
 * So authorisation walks upward through the cast's own CONTIGUOUS comment block
 * and stops at the first line that is not a comment. Anything above a line of
 * real code belongs to a different statement and cannot vouch for this one.
 */

const DELIBERATE_MARKER = 'DELIBERATE-CORRUPTION';

/** A line that can carry a marker for the statement below it. */
function isCommentLine(line) {
  const t = String(line).trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/**
 * Is the cast on `lineNo` (1-based) authorised as a deliberate fixture?
 *
 * True when the marker is on the cast line itself, or anywhere in the unbroken
 * run of comment lines directly above it. A blank line or any code between the
 * marker and the cast breaks the association — deliberately, so the marker
 * cannot drift onto a statement it was never written for.
 *
 * @param {string} src full file source
 * @param {number} lineNo 1-based line of the cast
 * @returns {boolean}
 */
function isDeliberateCast(src, lineNo) {
  if (typeof src !== 'string' || !Number.isInteger(lineNo) || lineNo < 1) return false;
  const lines = src.split('\n');
  const self = lines[lineNo - 1];
  if (self === undefined) return false;
  if (self.includes(DELIBERATE_MARKER)) return true;

  for (let i = lineNo - 2; i >= 0; i--) {
    if (!isCommentLine(lines[i])) return false;
    if (lines[i].includes(DELIBERATE_MARKER)) return true;
  }
  return false;
}

module.exports = { DELIBERATE_MARKER, isCommentLine, isDeliberateCast };
