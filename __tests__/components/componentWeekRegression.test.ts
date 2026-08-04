/**
 * Week-counter regressions, tested against the code that actually ships.
 *
 * This file used to import `@/utils/bankMarketAPR` and
 * `@/utils/realEstateWeekly` — two modules with ZERO production importers. Its
 * describe blocks were named "BankApp week counter regression" and
 * "RealEstateApp weekly maintenance regression", but neither screen used those
 * modules: `components/mobile/BankApp.tsx` reads `account.baseAPR` directly and
 * has no APR-by-week path at all, and real-estate tenancy lives in
 * `lib/realEstate/tenancy.ts` / `housing.ts`. `utils/realEstateWeekly.ts` even
 * documented itself as "Matches RealEstateApp weekly tenant satisfaction rules"
 * — a hand-maintained shadow copy that had since diverged.
 *
 * So a real week-counter regression in either screen would have passed CI green
 * while two confidently-named suites went on passing. The repo's own orphan
 * detector missed it because `scripts/audit/audit-perf.cjs` counts `__tests__`
 * in the reference corpus, so a test-only importer reads as "referenced".
 * 2026-07-30 audit PERF-5.
 *
 * Both orphan modules are deleted. What remains here is the one week-counter
 * concern that genuinely exists in shipped code: `processWeeklyHousing`
 * normalizes a property's `lastMaintenance` onto the ABSOLUTE `weeksLived`
 * counter, not the cyclic 1-4 `week` (CLAUDE.md §4.2, and `types.ts` documents
 * the field as "weeksLived of last maintenance").
 */
import fs from 'fs';
import path from 'path';
import { processWeeklyHousing } from '@/lib/realEstate/housing';
import type { RealEstate } from '@/contexts/game/types';

function ownedProperty(over: Partial<RealEstate> = {}): RealEstate {
  return {
    id: 'house-1',
    name: 'Starter House',
    price: 200_000,
    owned: true,
    ...over,
  } as RealEstate;
}

describe('maintenance is stamped on the absolute week counter', () => {
  it('initialises lastMaintenance to weeksLived, not the 1-4 display week', () => {
    const [updated] = processWeeklyHousing([ownedProperty()], 53).properties;

    // 53 is deliberately past a year boundary: the cyclic `week` would be 1
    // here, and storing that would make every later age comparison wrong.
    expect(updated.lastMaintenance).toBe(53);
  });

  it('does not overwrite a lastMaintenance the property already has', () => {
    const [updated] = processWeeklyHousing(
      [ownedProperty({ lastMaintenance: 40 })],
      53,
    ).properties;

    expect(updated.lastMaintenance).toBe(40);
  });

  it('leaves unowned properties alone', () => {
    const [updated] = processWeeklyHousing(
      [ownedProperty({ owned: false })],
      53,
    ).properties;

    expect(updated.lastMaintenance).toBeUndefined();
  });

  it('is fed the absolute counter by its only caller', () => {
    // The assertions above pin the function's own contract; this pins the one
    // thing that could actually regress — the week loop handing it the cyclic
    // `week` instead. `applyRentAndHousing` is the sole production caller.
    const caller = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts/game/actions/weekly/applyRentAndHousing.ts'),
      'utf8',
    );

    expect(caller).toMatch(/processWeeklyHousing\([^)]*,\s*nextWeeksLived\s*\)/);
  });

  it('keeps the stamp monotonic across successive weeks', () => {
    // A stamp taken from the cyclic counter would go BACKWARDS every month.
    let properties = processWeeklyHousing([ownedProperty()], 53).properties;
    const first = properties[0].lastMaintenance;

    for (let week = 54; week <= 60; week += 1) {
      properties = processWeeklyHousing(properties, week).properties;
    }

    expect(properties[0].lastMaintenance).toBe(first);
    expect(properties[0].lastMaintenance).toBeGreaterThan(4);
  });
});
