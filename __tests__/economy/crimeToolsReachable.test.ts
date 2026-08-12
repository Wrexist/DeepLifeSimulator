/**
 * Every crime tool a street job demands must be buyable somewhere.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "Crime tools were removed. There's no option
 * to buy Stealth Gloves, USB, lock pick etc. Making only job available Find Lost
 * Items."
 *
 * He was exactly right, and the shape of the bug is worth naming: `buyDarkWebItem`
 * existed, worked, debited BTC correctly and flipped `owned` — and had ZERO call
 * sites in `components/` or `app/`. A reader with no writer is caught by the
 * weekly audit; a WRITER WITH NO CALLER is not, because every unit test of the
 * action passes. The catalogue was reachable in principle and unreachable in
 * fact, so 18 of the 19 illegal street jobs sat permanently locked behind items
 * that had no storefront, and `criminalLevel` could not advance past the one job
 * that needs nothing.
 *
 * These are data + wiring assertions, deliberately not UI snapshots: the point
 * is the CHAIN — job requires id → id exists in catalogue → catalogue has a
 * screen → that screen calls the action.
 */
import fs from 'fs';
import path from 'path';
import { initialGameState } from '@/contexts/game/initialState';

const ROOT = path.join(__dirname, '../..');
const readCode = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const CATALOGUE = initialGameState.darkWebItems ?? [];
const CATALOGUE_IDS = new Set(CATALOGUE.map((i) => i.id));
const STREET_JOBS = initialGameState.streetJobs ?? [];

describe('the requirement data is sound', () => {
  it('ships a non-empty catalogue and job list (guards everything below)', () => {
    expect(CATALOGUE.length).toBeGreaterThan(0);
    expect(STREET_JOBS.length).toBeGreaterThan(0);
  });

  it('every darkWebRequirements id resolves to a real catalogue item', () => {
    const dangling: string[] = [];
    for (const job of STREET_JOBS) {
      for (const req of job.darkWebRequirements ?? []) {
        if (!CATALOGUE_IDS.has(req)) dangling.push(`${job.name} → ${req}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('the gated jobs are the bulk of the illegal ladder, not an edge case', () => {
    // Pins the stake. If this ever drops to ~0 the store matters less; while it
    // is this high, a storefront regression takes the whole crime system with it.
    const illegal = STREET_JOBS.filter((j) => j.illegal);
    const gated = illegal.filter((j) => (j.darkWebRequirements ?? []).length > 0);
    expect(illegal.length).toBeGreaterThan(10);
    expect(gated.length).toBeGreaterThan(illegal.length / 2);
  });
});

describe('the catalogue has a storefront', () => {
  const onion = readCode('components/computer/OnionApp.tsx');

  it('OnionApp calls buyDarkWebItem — the caller the action never had', () => {
    expect(onion).toMatch(/buyDarkWebItem/);
    expect(onion).toMatch(/useItemActions\(\)/);
  });

  it('the gear tab is registered in the tab strip, not just defined', () => {
    // A `renderGear` with no TABS entry and no route would be dead code that
    // still satisfies a naive grep — the exact failure mode being fixed.
    expect(onion).toMatch(/id:\s*'gear'/);
    expect(onion).toMatch(/activeTab === 'gear'/);
  });

  it('the store renders from darkWebItems, so the whole catalogue is offered', () => {
    expect(onion).toMatch(/gameState\.darkWebItems/);
  });
});

describe('the buy path is atomic now that it has a caller', () => {
  // `buyDarkWebItem` gated on `stateRef.current` and granted inside the updater —
  // the gate-outside/grant-inside shape from CLAUDE.md §4.4. It never bit because
  // nothing called it. The Gear tab is the first caller, so the re-check has to
  // be real: two taps in one React batch must not charge BTC twice.
  const source = readCode('contexts/game/ItemActionsContext.tsx');
  const body = source.slice(
    source.indexOf('const buyDarkWebItem'),
    source.indexOf('const buyHack')
  );

  it('isolated the right function (guards the assertions below)', () => {
    expect(body.length).toBeGreaterThan(200);
    expect(body).toMatch(/setGameState/);
  });

  it('refuses once the player is dead', () => {
    expect(body).toMatch(/prev\.showDeathPopup/);
  });

  it('re-checks ownership against prev, not the outer snapshot', () => {
    expect(body).toMatch(/prev\.darkWebItems/);
    expect(body).toMatch(/if \(!owned \|\| owned\.owned\) return prev;/);
  });

  it('re-checks the BTC balance against prev', () => {
    expect(body).toMatch(/prev\.cryptos\?\.find/);
    expect(body).toMatch(/btc < item\.costBtc\) return prev;/);
  });
});

describe('the removed Market-screen mapping is gone', () => {
  it('market.tsx no longer categorises dark-web ids it cannot sell', () => {
    // These are BTC-priced entries in `darkWebItems`; the Market screen renders
    // dollar-priced `items`. The mapping was a fossil that could never match and
    // pointed maintainers at the wrong screen.
    const market = readCode('app/(tabs)/market.tsx');
    // Anchor first. `indexOf` returns -1 for a renamed constant, which would
    // slice an empty/inverted region and let every assertion below pass on
    // nothing — the exact drift this ratchet exists to catch.
    const from = market.indexOf('const ITEM_CATEGORIES');
    const to = market.indexOf('const FILTER_CATEGORIES');
    expect(`ITEM_CATEGORIES found: ${from > -1}`).toBe('ITEM_CATEGORIES found: true');
    expect(`FILTER_CATEGORIES after it: ${to > from}`).toBe('FILTER_CATEGORIES after it: true');
    const categories = market.slice(from, to);
    for (const id of ['gloves', 'lockpick', 'slim_jim', 'drill_kit', 'explosives', 'crowbar', 'drug_supply']) {
      expect(`${id}: ${categories.includes(`${id}:`)}`).toBe(`${id}: false`);
    }
  });
});
