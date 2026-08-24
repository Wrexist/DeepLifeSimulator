/**
 * Developable luxury — items that are LAND.
 *
 * Buying a private island used to append a string to an array. It now mints a
 * real `RealEstate`, which hands the player the entire existing property stack
 * (upgrade tiers, room additions, decor, condition, appreciation) instead of an
 * inert line item that only ever costs money.
 *
 * These tests pin the wiring between the two systems and, most importantly, the
 * things that must NOT happen: no double-charging, no orphan property, no
 * silently relocating the player onto their island.
 */

import {
  LUXURY_CATALOG,
  createLuxuryProperty,
  findLuxuryProperty,
  isDevelopable,
  luxuryPropertyId,
  getLuxuryItem,
} from '../index';
import { ROOM_ADDITIONS } from '@/lib/realEstate/housing';
import type { RealEstate } from '@/contexts/game/types';

const ISLAND = getLuxuryItem('private_island')!;

describe('developable catalog data', () => {
  it('marks the private island as land', () => {
    expect(isDevelopable(ISLAND)).toBe(true);
    expect(ISLAND.developable?.propertyName).toBeTruthy();
  });

  it('gives the minted property no market value of its own', () => {
    // The land's worth is already counted through the luxury item's resale
    // contribution to net worth. Valuing the property too would count one
    // island twice and make buying it a free net-worth gain.
    const property = createLuxuryProperty(ISLAND, 0)!;
    expect(property.currentValue).toBe(0);
    expect(property.price).toBe(0);
  });

  it('leaves ordinary collectibles alone', () => {
    expect(isDevelopable(getLuxuryItem('rare_watch_collection'))).toBe(false);
    expect(isDevelopable(getLuxuryItem('museum_diamond'))).toBe(false);
    expect(isDevelopable(undefined)).toBe(false);
  });

  it('gives every developable item everything the minting needs', () => {
    for (const item of LUXURY_CATALOG.filter((i) => i.developable)) {
      const d = item.developable!;
      expect(typeof d.propertyName).toBe('string');
      expect(d.propertyName.length).toBeGreaterThan(3);
      expect(d.baseHappiness).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('createLuxuryProperty', () => {
  it('mints an owned, undeveloped property', () => {
    const property = createLuxuryProperty(ISLAND, 300)!;

    expect(property.id).toBe(luxuryPropertyId('private_island'));
    expect(property.owned).toBe(true);
    // Undeveloped on purpose — everything on the island is something you build.
    expect(property.upgradeLevel).toBe(0);
    expect(property.rooms).toEqual([]);
    expect(property.interior).toEqual([]);
    expect(property.condition).toBe(100);
    expect(property.purchasedWeek).toBe(300);
  });

  it('does not move the player onto their island', () => {
    // Owning an island must never silently relocate the player out of the home
    // their happiness and housing costs are computed against.
    const property = createLuxuryProperty(ISLAND, 10)!;
    expect(property.currentResidence).toBe(false);
    expect(property.status).toBe('owner');
  });

  it('charges no property upkeep - the luxury item already bills weekly', () => {
    // The island's $60,000/wk lives on the luxury item. A property upkeep on top
    // would bill the player twice for one asset.
    expect(createLuxuryProperty(ISLAND, 0)!.upkeep).toBe(0);
  });

  it('returns null for a non-developable item', () => {
    expect(createLuxuryProperty(getLuxuryItem('supercar')!, 0)).toBeNull();
  });

  it('tolerates a nonsense week', () => {
    const property = createLuxuryProperty(ISLAND, NaN)!;
    expect(property.purchasedWeek).toBe(0);
  });

  it('produces a stable id, so a re-buy can never mint a duplicate', () => {
    const a = createLuxuryProperty(ISLAND, 5)!;
    const b = createLuxuryProperty(ISLAND, 900)!;
    expect(a.id).toBe(b.id);
  });
});

describe('findLuxuryProperty', () => {
  it('finds the minted property among ordinary ones', () => {
    const properties = [
      { id: 'starter_apartment', name: 'Apartment' },
      createLuxuryProperty(ISLAND, 12)!,
    ] as RealEstate[];

    expect(findLuxuryProperty(properties, 'private_island')?.name).toBe(
      ISLAND.developable!.propertyName,
    );
    expect(findLuxuryProperty(properties, 'supercar')).toBeUndefined();
    expect(findLuxuryProperty(undefined, 'private_island')).toBeUndefined();
  });
});

describe('estate-scale room additions', () => {
  const byId = new Map(ROOM_ADDITIONS.map((r) => [r.id, r]));

  it('adds a helipad and an airstrip for aircraft to be based on', () => {
    // These are the hooks Phase 3 needs: somewhere for a helicopter and a jet.
    expect(byId.get('helipad')).toBeTruthy();
    expect(byId.get('airstrip')).toBeTruthy();
  });

  it('prices an airstrip above a helipad - a jet needs far more runway', () => {
    expect(byId.get('airstrip')!.cost).toBeGreaterThan(byId.get('helipad')!.cost);
  });

  it('keeps starter-home rooms affordable next to estate builds', () => {
    // A $15k guest room and a $18M airstrip live in the same list; the cheap end
    // must stay reachable for an ordinary house.
    expect(byId.get('guest_room')!.cost).toBeLessThan(100_000);
    expect(byId.get('airstrip')!.cost).toBeGreaterThan(1_000_000);
  });

  it('keeps every room addition well-formed', () => {
    for (const room of ROOM_ADDITIONS) {
      expect(room.id).toBeTruthy();
      expect(room.name).toBeTruthy();
      expect(room.cost).toBeGreaterThan(0);
      expect(room.roomsAdded).toBeGreaterThan(0);
      expect(room.description.length).toBeGreaterThan(10);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(ROOM_ADDITIONS.map((r) => r.id)).size).toBe(ROOM_ADDITIONS.length);
  });
});
