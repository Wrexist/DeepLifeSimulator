/**
 * The inert-bonus mechanism, and the defect it was built for.
 *
 * `legacy_business` — legendary, 30,000 points — was purchasable while no code
 * read its id at all. Its card promised "Future generations inherit family
 * businesses", which happens UNCONDITIONALLY in `prestigeExecution`, so the
 * purchase was consumed and changed nothing.
 *
 * That is now FIXED: the bonus pays +10% family-business income per generation
 * held, capped at +50% (`lib/business/familyBusinessEffects.ts`), and its
 * description says so. The behavioural proof lives in
 * `__tests__/economy/legacyBusinessBonus.test.ts`.
 *
 * This suite keeps the surrounding invariants, because the fix depends on all
 * of them staying true:
 *
 *   - Inheritance is still unconditional. The bonus was made ADDITIVE
 *     specifically so no existing player lost anything; if someone later gates
 *     inheritance on it, that promise is broken and this fails.
 *   - The registry still reports nothing for working bonuses, so a warning
 *     never appears on a card that functions.
 *   - The misleading comment that hid the defect stays gone.
 *
 * The registry itself is deliberately kept with an EMPTY list rather than
 * deleted. `__tests__/tooling/prestigeBonusReaders.test.ts` still requires every
 * catalogue id to have a reader or be declared inert, so the next dead bonus
 * has a documented home instead of needing this mechanism invented again under
 * pressure.
 */
import { PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import { INERT_BONUS_IDS, inertBonusReason, isInertBonus } from '@/lib/prestige/inertBonuses';
import fs from 'fs';
import path from 'path';
import { realCallersOf, sourceFiles } from '@/__tests__/helpers/sourceCallers';

/**
 * Files that MENTION a bonus id without being its implementation.
 *
 * The catalogue declares it, this registry records it, and the two prestige
 * modals RENDER its description — counting any of them would make the check
 * circular: the advertised claim would satisfy the search for the code that
 * delivers it. That confusion is what all four dead bonuses had in common.
 */
const NOT_IMPLEMENTATIONS = [
  'lib/prestige/prestigeBonuses.ts',
  'lib/prestige/inertBonuses.ts',
  'components/PrestigeInfoModal.tsx',
  'components/PrestigeShopModal.tsx',
];

/** Gameplay files that reference the bonus id at all. */
function gameplayReferences(id: string): string[] {
  return sourceFiles()
    .filter(([file, src]) =>
      !NOT_IMPLEMENTATIONS.some((n) => file.replace(/\\/g, '/').endsWith(n))
      && (src.includes(`'${id}'`) || src.includes(`"${id}"`)))
    .map(([file]) => file);
}

const repoRoot = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('legacy_business is wired now, and honestly described', () => {
  it('still exists at the same price - nobody was refunded or stranded', () => {
    const b = PRESTIGE_BONUSES.find((x) => x.id === 'legacy_business');

    expect(b).toBeDefined();
    expect(b!.cost).toBe(30_000);
  });

  it('no longer sells inheritance, which was always free', () => {
    const b = PRESTIGE_BONUSES.find((x) => x.id === 'legacy_business')!;

    expect(b.description).not.toMatch(/^Future generations inherit family businesses$/);
    expect(b.description).toMatch(/income/i);
  });

  it('is not flagged as inert any more', () => {
    expect(INERT_BONUS_IDS).not.toContain('legacy_business');
    expect(isInertBonus('legacy_business')).toBe(false);
    expect(inertBonusReason('legacy_business')).toBeNull();
  });
});

describe('the promise the fix rests on: nothing was taken away', () => {
  it('family businesses still pass to the heir unconditionally', () => {
    // The bonus is additive precisely so this stays true. Gating inheritance on
    // it would make the ORIGINAL description accurate while silently removing
    // behaviour every existing player has today, and undoing a deliberate
    // "BUG FIX: Preserve family businesses on prestige".
    const src = code('lib/prestige/prestigeExecution.ts');

    expect(src).toMatch(/if \(oldState\.familyBusinesses && oldState\.familyBusinesses\.length > 0\)/);
    expect(src).not.toMatch(/legacy_business/);
  });

  it('the misleading comment stays gone', () => {
    // "The live legacy_business path is familyBusinesses[]" read as though the
    // bonus was wired through that path. It was not wired at all, and that
    // sentence is why the gap survived an earlier pass. Asserted against RAW
    // source — this one is about a comment, so stripping them is vacuous.
    expect(read('lib/prestige/applyBonuses.ts'))
      .not.toMatch(/The live legacy_business path is familyBusinesses/);
  });
});

describe('the registry still behaves, for the next dead bonus', () => {
  it('reports nothing for bonuses that work (the control)', () => {
    // A registry that over-reports would flag good purchases as broken, which
    // is worse than the silence it replaced.
    for (const id of ['income_multiplier_1', 'wealth_magnet', 'genius', 'legacy_reputation', 'legacy_business']) {
      expect(inertBonusReason(id)).toBeNull();
    }
  });

  it('is EMPTY - every dead bonus found so far has been wired (2026-08-23)', () => {
    // A ratchet, not a snapshot: an id LEAVING this list must be a deliberate
    // wiring, and one arriving must be a deliberate finding. Both should fail
    // here first. The three 2026-08-21 entries left when the owner resolved
    // the open product question to RE-PURPOSE: all three now have real effects
    // in lib/prestige/purchaseDiscounts.ts (items −15%, properties −10%,
    // rent +15%), covered by __tests__/prestige/purchaseDiscounts.test.ts.
    expect([...INERT_BONUS_IDS]).toEqual([]);
  });

  it('each one is dead for the reason recorded, not by assertion', () => {
    // The claims, re-derived from source, so an entry cannot go stale by
    // someone quietly wiring a bonus and leaving the warning up.

    // No gameplay file consumes any of the three. `hasConsumingReader` in
    // `__tests__/tooling/prestigeBonusReaders.test.ts` is the general form of
    // this; here it is the direct statement, since the whole registry rests on
    // it being true.
    for (const id of INERT_BONUS_IDS) {
      expect(`${id}: ${gameplayReferences(id).length}`).toBe(`${id}: 0`);
    }

    // And the predicates that used to front them are gone, rather than sitting
    // there uncalled - a predicate named for a bonus reads as its wiring, which
    // is why two of these survived a previous audit.
    for (const fn of ['hasEarlyItemAccess', 'hasEarlyRealEstateAccess', 'shouldAutoCollectRent']) {
      expect(`${fn}: ${realCallersOf(fn).length}`).toBe(`${fn}: 0`);
      expect(`${fn} declared: ${sourceFiles().some(([, src]) => src.includes(`function ${fn}`))}`)
        .toBe(`${fn} declared: false`);
    }

    // Rent really is collected for everyone, which is what makes wiring
    // `auto_manage_properties` a product decision rather than a fix.
    expect(code('contexts/game/actions/weekly/applyRentAndHousing.ts'))
      .toMatch(/rentalIncome/);
  });

  it('every listed id still exists in the catalogue', () => {
    // The guard that stops a stale entry warning about a bonus nobody can buy.
    for (const id of INERT_BONUS_IDS) {
      expect(PRESTIGE_BONUSES.some((b) => b.id === id)).toBe(true);
    }
  });

  it('and each carries a reason the player can read', () => {
    for (const id of INERT_BONUS_IDS) {
      const reason = inertBonusReason(id);
      expect(`${id}: ${typeof reason === 'string' && reason.length > 30}`).toBe(`${id}: true`);
    }
  });

  it('the shop still reads the registry rather than hardcoding ids (the control)', () => {
    const src = code('components/PrestigeShopModal.tsx');

    expect(src).toMatch(/inertBonusReason/);
    expect(src).not.toMatch(/'legacy_business'/);
  });
});
