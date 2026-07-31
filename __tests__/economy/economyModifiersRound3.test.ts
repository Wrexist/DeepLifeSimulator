/**
 * The last three Round 3 items: two displayed-but-unread economy modifiers, a
 * gift system that was dead for two thirds of NPCs, and a latent money printer.
 *
 * R3-M9 `economyEvents.modifiers.stockVolatility` and `jobAvailability` were
 * rendered in the weekly event modal ("Stock Volatility: +150%", "Jobs: -20%")
 * and read by NOTHING. `simulateWeek` only ever received the political policy
 * modifier, and the job acceptance roll had no economy term — so during a crash
 * the market's price walk and the player's hiring odds were identical to a boom.
 * The crash did have some teeth via `macroDriftFor`'s directional drift, just
 * not the two effects the modal named.
 *
 * R3-F7 `getGiftPreferences` fell back to `{ likes: ['surprise'] }` for any
 * personality outside its 10-key map — and `surprise` has no call site, because
 * ContactsApp renders exactly two gift buttons. 33 of the 51 dating profiles
 * (plus the starting Dad) fall outside that map, so for roughly two thirds of
 * NPCs the only gift they "liked" could not be bought and `getGiftMultiplier`
 * returned exactly 1.0 for both purchasable options.
 *
 * R3-M10 `MoneyActionsContext`'s crypto trio gated on stale state and floored
 * with `Math.max(0, …)` instead of rejecting. Not player-reachable — the only
 * non-test callers are behind the `__DEV__` devtools gate — but it sits on the
 * public context surface with no warning. 2026-07-31 audit round 3.
 */
import fs from 'fs';
import path from 'path';
import { getGiftPreferences, getGiftMultiplier } from '@/lib/social/npcDepth';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import type { Relationship } from '@/contexts/game/types';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

/** The gift ids ContactsApp actually renders a button for. */
const PURCHASABLE_GIFTS = ['flowers', 'jewelry'];

describe('R3-M9 — the economy modifiers reach the systems they name', () => {
  it('stock volatility is folded into the market simulation', () => {
    const source = read('contexts/game/GameActionsContext.tsx');

    expect(source).toMatch(/gameState\.economy\?\.economyEvents\?\.modifiers\?\.stockVolatility/);
    expect(source).toMatch(/volatilityModifier: \(policyEffects\?\.volatilityModifier \?\? 1\) \* safeEventVolatility/);
    expect(source).toMatch(/simulateWeek\(combinedEffects, currentWeeksLived\)/);
  });

  it('does not discard the political modifier while adding the event one', () => {
    // The control: overwriting rather than combining would fix one inert
    // modifier by making another inert.
    expect(read('contexts/game/GameActionsContext.tsx')).toMatch(
      /\.\.\.\(policyEffects \?\? \{\}\),/,
    );
  });

  it('job availability scales the acceptance base', () => {
    const source = read('contexts/game/actions/JobActions.ts');

    expect(source).toMatch(/gameState\.economy\?\.economyEvents\?\.modifiers\?\.jobAvailability/);
    expect(source).toMatch(/baseAcceptanceChance \* safeGpaMultiplier \* safeJobAvailability/);
  });

  it('both fall back to 1 rather than to NaN or 0', () => {
    // A missing or corrupt modifier must leave the system neutral, not delete
    // the market's volatility or make every job application impossible.
    expect(read('contexts/game/GameActionsContext.tsx')).toMatch(
      /Number\.isFinite\(eventVolatility\) && eventVolatility > 0 \? eventVolatility : 1/,
    );
    expect(read('contexts/game/actions/JobActions.ts')).toMatch(
      /Number\.isFinite\(jobAvailability\) && jobAvailability > 0 \? jobAvailability : 1/,
    );
  });
});

describe('R3-F7 — the default gift preference is one the player can give', () => {
  it('falls back to a purchasable gift', () => {
    const fallback = getGiftPreferences('a-personality-that-is-not-in-the-map');

    expect(fallback.likes.length).toBeGreaterThan(0);
    for (const gift of fallback.likes) {
      expect(PURCHASABLE_GIFTS).toContain(gift);
    }
  });

  it('the fallback actually moves the multiplier', () => {
    // The point of the fix: for the ~2/3 of NPCs outside the map, both
    // purchasable gifts used to return exactly 1.0.
    const npc = { id: 'n1', name: 'X', type: 'friend', relationshipScore: 50,
      personality: 'analytical' } as unknown as Relationship;

    expect(getGiftMultiplier(npc, 'flowers')).toBeGreaterThan(1);
  });

  it('a mapped personality is unaffected', () => {
    // The control: the map must still win over the fallback.
    const mapped = getGiftPreferences('romantic');
    const fallback = getGiftPreferences('not-a-real-personality');

    expect(mapped).not.toEqual(fallback);
  });

  it('the catalogue really does have personalities outside the map', () => {
    // Guards the whole finding: if every profile were mapped, the fallback
    // would be unreachable and this would not matter.
    const unmapped = DATING_PROFILES.filter((p) => {
      const prefs = getGiftPreferences((p as { personality?: string }).personality || '');
      return prefs.likes.length === 1 && PURCHASABLE_GIFTS.includes(prefs.likes[0]);
    });

    expect(unmapped.length).toBeGreaterThan(10);
  });
});

describe('R3-M10 — the dev crypto path rejects instead of flooring', () => {
  const source = read('contexts/game/MoneyActionsContext.tsx');

  it('buyCrypto returns prev when the player cannot afford it', () => {
    expect(source).toMatch(/if \(\(prev\.stats\?\.money \?\? 0\) < amount\) return prev;/);
  });

  it('no longer floors the debit', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/Math\.max\(0, prev\.stats\.money - amount\)/);
  });

  it('sellCrypto re-checks the holding against prev', () => {
    expect(source).toMatch(/const prevOwned = prev\.cryptos\?\.find\(c => c\.id === cryptoId\)\?\.owned \?\? 0;/);
    expect(source).toMatch(/if \(prevOwned < amount\) return prev;/);
  });
});
