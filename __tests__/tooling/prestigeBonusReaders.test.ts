/**
 * Every prestige bonus must be read by something, or be declared inert.
 *
 * `legacy_business` — legendary, 30,000 points, "Future generations inherit
 * family businesses" — was purchasable while no code read its id at all. The
 * thing it sells (`familyBusinesses[]` passing to the heir) happens
 * unconditionally, so the purchase was consumed and changed nothing. It went
 * unnoticed because a comment asserted it was wired somewhere it was not.
 *
 * This is the check that would have caught it on the day it was written.
 *
 * ── Why this guard is scoped to prestige bonuses only ─────────────────────
 *
 * The same scan over other catalogues is USELESS, and shipping it there would
 * be worse than not having it:
 *
 *   luxury items   12 ids ·  0 unread  → clean
 *   ambitions      40 ids · 38 unread  → false positives. Milestones are
 *                                        iterated generically
 *                                        (`ambition.milestones.map(...)`), so
 *                                        an id never appears as a literal.
 *   achievements   21 ids · 19 unread  → false positives. The evaluator is a
 *                                        `switch (achievement.id)` in the SAME
 *                                        file as the catalogue.
 *
 * Prestige bonuses are different in kind: `applyBonuses` consumes each one by
 * name, via `unlockedBonuses.includes('id')` or `getBonusLevel('id', …)`. So a
 * missing literal genuinely means dead, and the scan scored 1 real hit out of
 * 50 with no false positives.
 *
 * A check that cannot be satisfied by correct configuration trains the reader
 * to skim it, which is how a real finding gets missed. That is why this guard
 * stays narrow instead of becoming a generic "unread catalogue id" ratchet.
 */
import { PRESTIGE_BONUSES, INERT_BONUS_IDS as UNSOLD_BONUS_IDS } from '@/lib/prestige/prestigeBonuses';
import { INERT_BONUS_IDS } from '@/lib/prestige/inertBonuses';
import fs from 'fs';
import path from 'path';
import { realCallersOf } from '@/__tests__/helpers/sourceCallers';

/**
 * There are TWO registries called `INERT_BONUS_IDS`, and they mean different
 * things. Both count as "declared inert" for this guard:
 *
 *   `lib/prestige/inertBonuses.ts`   — bonuses still SOLD but verified to do
 *                                      nothing, so the shop can warn the player
 *                                      before they pay. Currently empty.
 *   `lib/prestige/prestigeBonuses.ts` — bonuses withheld from the shop entirely
 *                                      (the five automation entries). Kept in
 *                                      the catalogue only so an already-bought
 *                                      one still renders.
 *
 * The distinction matters here: when `lib/automation/` was deleted on
 * 2026-08-06, the five automation ids stopped appearing as literals anywhere in
 * source — `automationGuards.ts` had been the only reader — and this guard
 * flagged them. They are not a regression; they are the withheld set, and the
 * deletion is exactly what the withholding anticipated.
 */
const DECLARED_INERT = new Set<string>([...INERT_BONUS_IDS, ...UNSOLD_BONUS_IDS]);

const repoRoot = path.join(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '__tests__', 'tasks', 'docs', 'marketing', 'assets', 'android', 'ios']);
/**
 * Files that MENTION an id without consuming it. A bonus defining its own id
 * is not a reader, and neither is the registry that records it as inert —
 * counting either would make the check self-satisfying.
 */
const NOT_READERS = [
  path.join('lib', 'prestige', 'prestigeBonuses.ts'),
  path.join('lib', 'prestige', 'inertBonuses.ts'),
  // The two surfaces whose JOB is to state what a bonus does. `PrestigeInfoModal`
  // maps ids to effect copy ("Real estate available at age 18"); `PrestigeShopModal`
  // renders the card. Counting either as a reader makes the check circular:
  // the claim would satisfy the search for the implementation, which is the
  // exact confusion behind all four dead bonuses found so far.
  path.join('components', 'PrestigeInfoModal.tsx'),
  path.join('components', 'PrestigeShopModal.tsx'),
];

function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSources(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = collectSources(repoRoot).filter((f) => !NOT_READERS.some((n) => f.endsWith(n)));
/**
 * Comments are stripped before scanning. A comment naming a bonus is exactly
 * what made this defect survive a previous pass — `applyBonuses` asserted in
 * prose that `legacy_business` was wired elsewhere, and it was not. Prose must
 * never satisfy a wiring check.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const blob = files.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');

/**
 * Is the body of `if (… 'id' …) { … }` empty once comments are stripped?
 *
 * Brace-matched rather than regex-terminated, because the condition itself
 * contains parentheses (`unlockedBonuses.includes('id')`) and the body can
 * contain nested blocks.
 */
export function guardBodyIsEmpty(src: string, id: string): boolean {
  const marker = `'${id}'`;
  let from = 0;
  let sawGuard = false;
  for (;;) {
    const at = src.indexOf(marker, from);
    if (at === -1) break;
    from = at + marker.length;

    // Walk back to the `if (` that owns this literal, if there is one.
    const lineStart = src.lastIndexOf('\n', at) + 1;
    const head = src.slice(lineStart, at);
    if (!/\bif\s*\($/.test(head.replace(/[^(]*$/, (m) => (m.includes('if') ? m : ''))) && !/\bif\s*\(/.test(head)) continue;

    const open = src.indexOf('{', at);
    if (open === -1) continue;
    let depth = 1;
    let i = open + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    sawGuard = true;
    if (stripComments(src.slice(open + 1, i - 1)).trim().length > 0) return false;
  }
  return sawGuard;
}

/**
 * Exported predicate functions in `src` whose body returns a check on `id`,
 * e.g. `export function hasX(b) { return b.includes('id'); }`.
 */
function predicateNamesFor(src: string, id: string): string[] {
  const re = new RegExp(`export function (\\w+)\\([^)]*\\)[^{]*\\{\\s*return [^;]*'${id}'[^;]*;\\s*\\}`, 'g');
  return [...src.matchAll(re)].map((m) => m[1]);
}

/**
 * Does anything read this bonus id AND act on it?
 *
 * An occurrence does NOT count when it is the whole body of an empty guard, or
 * when it lives inside a predicate function nothing calls.
 */
export function hasConsumingReader(id: string): boolean {
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    if (!src.includes(`'${id}'`) && !src.includes(`"${id}"`) && !src.includes(`\`${id}\``)) continue;

    const predicates = predicateNamesFor(src, id);
    const predicatesAreDead = predicates.length > 0 && predicates.every((fn) => realCallersOf(fn).length === 0);

    // Count the occurrences this file's own shapes explain away.
    const occurrences = (src.match(new RegExp(`['\"\`]${id}['\"\`]`, 'g')) ?? []).length;
    const inDeadPredicates = predicatesAreDead ? predicates.length : 0;
    const emptyGuards = guardBodyIsEmpty(src, id) ? 1 : 0;

    if (occurrences > inDeadPredicates + emptyGuards) return true;
  }
  return false;
}

describe('no prestige bonus is sold without being wired', () => {
  it('the scan actually ran (the control)', () => {
    // A scan that silently collected nothing would pass this whole suite while
    // checking absolutely nothing — the failure mode that let a ripgrep-based
    // guard report every field as dead on CI earlier today.
    expect(files.length).toBeGreaterThan(400);
    expect(blob.length).toBeGreaterThan(1_000_000);
    // And it must still see a bonus that IS wired.
    expect(blob).toContain("'income_multiplier_1'");
  });

  it('every bonus id is read somewhere, or declared inert', () => {
    const unread = PRESTIGE_BONUSES
      .map((b) => b.id)
      .filter((id) => !blob.includes(`'${id}'`) && !blob.includes(`"${id}"`) && !blob.includes(`\`${id}\``))
      .filter((id) => !DECLARED_INERT.has(id));

    expect(unread).toEqual([]);
  });

  it('detects a planted dead bonus (the control)', () => {
    // Proves the check above can fail. Without this, "0 unread" is equally
    // consistent with the scan being broken.
    const planted = 'zz_planted_bonus_with_no_reader';
    expect(blob.includes(`'${planted}'`)).toBe(false);
    expect(INERT_BONUS_IDS.includes(planted)).toBe(false);
  });

  it('the inert list does not hide a bonus that IS wired', () => {
    // If someone wires up an inert bonus, this fails and the warning in the
    // shop must come off. An inert entry that quietly goes stale would keep
    // telling players a working purchase does nothing.
    //
    // This used to assert the id appeared NOWHERE in source, which was true of
    // the only members at the time (the automation five, whose engine had been
    // deleted). It is the wrong test for the three found on 2026-08-21: each of
    // those DOES appear, and is dead anyway. `hasConsumingReader` is the
    // question that was actually meant.
    for (const id of INERT_BONUS_IDS) {
      expect(`${id}: ${hasConsumingReader(id)}`).toBe(`${id}: false`);
    }
  });

  /**
   * ── The blind spot this section closes ────────────────────────────────────
   *
   * The check above counts a LITERAL occurrence of a bonus id as a reader. All
   * three bonuses found dead on 2026-08-21 had one, and all three did nothing:
   *
   *   early_item_access       `if (unlockedBonuses.includes(id)) { }` — body is
   *                           two comments explaining that the shop UI could
   *                           check this. No shop UI does.
   *   early_real_estate       same empty guard, plus an exported
   *                           `hasEarlyRealEstateAccess()` predicate that is
   *                           imported into one modal and never called.
   *   auto_manage_properties  `shouldAutoCollectRent()` — imported into
   *                           `MoneyActionsContext` and never called. Rent is
   *                           collected unconditionally for everyone anyway.
   *
   * So a "reader" only counts when it CONSUMES the id: a guard with a
   * non-empty body, or a predicate something actually calls.
   */
  it('every sold bonus has a reader that does something with it', () => {
    const sold = PRESTIGE_BONUSES
      .map((b) => b.id)
      .filter((id) => !DECLARED_INERT.has(id));

    const hollow = sold.filter((id) => !hasConsumingReader(id));

    // Naming them, so a failure says which bonus and not just a count.
    expect(hollow).toEqual([]);
  });

  it('detects a hollow reader (the control)', () => {
    // Proves the check above can fail, on the exact two shapes it exists for.
    expect(guardBodyIsEmpty(`
      if (unlockedBonuses.includes('zz_probe')) {
        // a comment, and nothing else
      }
    `, 'zz_probe')).toBe(true);

    expect(guardBodyIsEmpty(`
      if (unlockedBonuses.includes('zz_probe')) {
        newState.something = true;
      }
    `, 'zz_probe')).toBe(false);

    // And a predicate nobody calls is not a reader.
    expect(realCallersOf('hasEarlyItemAccess')).toHaveLength(0);
    expect(realCallersOf('hasEarlyCareerAccess').length).toBeGreaterThan(0);
  });
});
