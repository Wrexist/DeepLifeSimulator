/**
 * `legacy_business` sells something the game already does for free.
 *
 *   Family Business Legacy · legendary · 30,000 points
 *   "Future generations inherit family businesses"
 *
 * Family businesses are inherited UNCONDITIONALLY. `prestigeExecution.ts`
 * carries `familyBusinesses[]` (and their companies) to the heir under a
 * comment reading "BUG FIX: Preserve family businesses on prestige", with no
 * reference to the bonus. A repo-wide scan finds the id `legacy_business`
 * read by nothing outside the catalogue — it is the only one of the 50 bonus
 * ids with no reader at all.
 *
 * So the purchase is consumed and changes nothing. Same class as the MON
 * findings in this PR, and a larger sum than the capped-out Wealth Magnet:
 * that one at least does something until the cap is reached.
 *
 * The comment at `applyBonuses.ts` was actively misleading and is corrected in
 * the same change. It read "The live legacy_business path is familyBusinesses[]",
 * which parses as "the bonus works through that path" — whoever removed the
 * dead `hasFamilyBusinessLegacy` write reasonably assumed the mechanic was
 * wired somewhere else. It is not wired anywhere.
 *
 * What this suite does NOT do is change the balance. Gating inheritance on the
 * bonus would take away behaviour every existing player has today and undo a
 * deliberate bug fix; deleting the bonus would strand the points of anyone who
 * already bought it. Both are product decisions, escalated rather than assumed.
 * The code change is limited to telling the player the truth before they pay.
 */
import { PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { INERT_BONUS_IDS, inertBonusReason } from '@/lib/prestige/inertBonuses';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the inert bonus is real, and still costs 30,000', () => {
  it('exists in the catalogue at the price claimed', () => {
    const b = PRESTIGE_BONUSES.find((x) => x.id === 'legacy_business');

    expect(b).toBeDefined();
    expect(b!.cost).toBe(30_000);
    expect(b!.description).toMatch(/inherit family businesses/i);
  });

  it('is read by NOTHING in game logic', () => {
    // The specific check that would make it live. Its absence is the defect.
    for (const rel of [
      'lib/prestige/applyBonuses.ts',
      'lib/prestige/prestigeExecution.ts',
    ]) {
      expect(code(rel)).not.toMatch(/includes\('legacy_business'\)/);
    }
  });

  it('inheritance happens unconditionally, for everyone', () => {
    // If this ever becomes gated, the bonus stops being inert and this suite
    // should fail loudly rather than quietly keep warning about a live bonus.
    const src = code('lib/prestige/prestigeExecution.ts');
    expect(src).toMatch(/if \(oldState\.familyBusinesses && oldState\.familyBusinesses\.length > 0\)/);
    expect(src).not.toMatch(/legacy_business/);
  });

  it('the misleading comment is gone', () => {
    // "The live legacy_business path is familyBusinesses[]" reads as though the
    // bonus is wired through that path. It is not wired at all.
    expect(read('lib/prestige/applyBonuses.ts'))
      .not.toMatch(/The live legacy_business path is familyBusinesses/);
  });
});

describe('the registry names it, with a reason', () => {
  it('lists legacy_business', () => {
    expect(INERT_BONUS_IDS).toContain('legacy_business');
    expect(inertBonusReason('legacy_business')).toMatch(/already/i);
  });

  it('says nothing about a bonus that works (the control)', () => {
    // A registry that over-reports would flag working purchases as broken,
    // which is worse than the silence it replaces.
    for (const id of ['income_multiplier_1', 'wealth_magnet', 'genius', 'legacy_reputation']) {
      expect(inertBonusReason(id)).toBeNull();
    }
  });

  it('every listed id actually exists in the catalogue', () => {
    // A stale entry would warn about a bonus nobody can buy, and would hide a
    // rename rather than surface it.
    for (const id of INERT_BONUS_IDS) {
      expect(PRESTIGE_BONUSES.some((b) => b.id === id)).toBe(true);
    }
  });
});

describe('the shop warns before the player pays', () => {
  const src = code('components/PrestigeShopModal.tsx');

  it('reads the registry', () => {
    expect(src).toMatch(/inertBonusReason/);
  });

  it('does not hardcode the id (the control)', () => {
    expect(src).not.toMatch(/'legacy_business'/);
  });
});
