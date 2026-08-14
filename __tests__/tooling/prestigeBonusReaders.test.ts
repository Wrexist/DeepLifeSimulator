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
    // If someone wires up `legacy_business`, this fails and the warning in the
    // shop must come off. An inert entry that quietly goes stale would keep
    // telling players a working purchase does nothing.
    for (const id of INERT_BONUS_IDS) {
      expect(blob.includes(`'${id}'`) || blob.includes(`"${id}"`)).toBe(false);
    }
  });
});
