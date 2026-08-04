/**
 * F5-F8 — four places the interface said something the game did not do.
 *
 * F5. Food was the only purchasable in the app charged at its RAW price.
 * `market.tsx` printed `${food.price}` raw and `buyFood` charged raw — but the
 * button's disabled state ran through `canAfford`, which inflates. All three
 * disagreed, and the player-visible symptom was a greyed-out button on food
 * they could plainly afford at the price printed next to it. Resolved by
 * inflating rather than by dropping the gate: every other row on that screen is
 * inflated at display, gate and charge, `JailScreen` already inflates food
 * explicitly, and leaving food alone was an economy hole that widens all game
 * (inflation compounds at up to 50% annually).
 *
 * F6. Three Help answers described a hacks system that is not the one that
 * shipped: "purchase VPNs, exploits and other tools", "running hacks can earn
 * untraceable money". `buyHack`, `performHack` and `buyDarkWebItem` exist in
 * `ItemActionsContext` and have NO UI caller. What shipped is `OnionApp` —
 * Market/Jobs/Wallet, multi-stage contracts rolled against four dark-web
 * skills, heat instead of wanted level, and crypto laundering. The Help now
 * describes that.
 *
 * F7. Verified Pro sold "No ads in feed" for $20/week in-game. Pulse has no
 * in-feed ad — no ad unit, no sponsored row, no promoted post. The only ad in
 * Pulse is the opt-in rewarded video, which Verified Pro does not remove; it
 * triples the reward, and THAT perk is real. The line is removed rather than
 * delivered, because adding an in-feed ad so a subscription could take it away
 * would be inventing an ad placement to justify the copy.
 *
 * F8. Evicting a tenant fired on one tap of an icon-only button with no
 * confirmation, and it is not reversible — `kickTenant` clears the tenant and
 * resets `weeksVacant`, so rent stops and the unit re-lets from scratch.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { getInflatedPrice } from '@/lib/economy/inflation';

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('F5 — food is priced like everything else', () => {
  it('inflation actually moves a price (the premise)', () => {
    // If getInflatedPrice were a no-op, none of this would be observable.
    expect(getInflatedPrice(100, 1.5)).toBeGreaterThan(100);
    expect(getInflatedPrice(100, 1)).toBe(100);
  });

  it('the charge is inflated, not raw', () => {
    const src = read('contexts/game/ItemActionsContext.tsx');

    expect(src).toMatch(/const price = getInflatedPrice\(food\.price, state\.economy\?\.priceIndex \?\? 1\)/);
    expect(src).toMatch(/updateMoney\(-price, `Food purchase/);
    expect(src).not.toMatch(/updateMoney\(-food\.price/);
  });

  it('the displayed price is inflated too', () => {
    const src = read('app/(tabs)/market.tsx');

    expect(src).toMatch(/\$\{getInflatedPrice\(food\.price, gameState\.economy\?\.priceIndex \?\? 1\)/);
  });

  it('so the label, the gate and the charge finally agree', () => {
    // The bug was that these three used two different prices. `canAfford`
    // already inflated; it is the one that was right.
    const market = read('app/(tabs)/market.tsx');

    expect(market).toMatch(/const canAfford = useCallback\(\(price: number\) => gameState\.stats\.money >= getInflatedPrice/);
    expect(market).toMatch(/canAfford\(food\.price\)/);
  });

  it('the affordability check is not the real gate (the control)', () => {
    // `updateMoney` rejects an overdraw against `prev`, so the stale outer read
    // is a fast path. Removing that guarantee would reintroduce a worse bug.
    expect(read('contexts/game/MoneyActionsContext.tsx'))
      .toMatch(/Rejected purchase: insufficient funds/);
  });
});

describe('F6 — the Help describes the dark web that shipped', () => {
  // Comments stripped for the same reason as F7 below.
  const HELP = read('components/HelpModal.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('the hacks actions really have no UI caller (the premise)', () => {
    const uiDirs = ['components', 'app'];
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

    const callers = uiDirs
      .flatMap((d) => walk(path.join(ROOT, d)))
      .filter((f) => /\.tsx$/.test(f))
      .filter((f) => /\b(performHack|buyHack|buyDarkWebItem)\s*\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));

    expect(callers).toEqual([]);
  });

  it('no answer tells the player to buy VPNs or exploits', () => {
    expect(HELP).not.toMatch(/Purchase VPNs, exploits/);
    expect(HELP).not.toMatch(/VPNs reduce trace chance/);
    expect(HELP).not.toMatch(/Use VPNs and exploits to reduce detection/);
  });

  it('and the answers name the systems that do exist', () => {
    expect(HELP).toMatch(/Market, Jobs and Wallet/);
    expect(HELP).toMatch(/Hacking, Social Eng, OPSEC and Laundering/);
    expect(HELP).toMatch(/heat/);
  });

  it('those systems are really there (the control)', () => {
    // The new copy must not be a second fiction.
    const onion = read('components/computer/OnionApp.tsx');
    expect(onion).toMatch(/id: 'market'/);
    expect(onion).toMatch(/id: 'jobs'/);
    expect(onion).toMatch(/id: 'wallet'/);

    const jobs = read('lib/darkweb/jobs.ts');
    expect(jobs).toMatch(/'hacking' \| 'social' \| 'opsec' \| 'laundering'/);
    expect(jobs).toMatch(/heatOnFail/);
  });
});

describe('F7 — Verified Pro only advertises what it delivers', () => {
  const RAW = read('components/mobile/Pulse/modals/VerifiedProUpsellModal.tsx');
  /**
   * Comments STRIPPED. The first version of this test asserted against the raw
   * file and failed on the fix's own explanatory comment, which necessarily
   * quotes the removed strings to explain why they were removed. Asserting on
   * live copy is the point; a comment mentioning "No ads in feed" is not a
   * player-facing promise.
   */
  const MODAL = RAW
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('Pulse really has no in-feed ad (the premise)', () => {
    const feed = read('components/mobile/Pulse/PulseApp.tsx')
      + read('components/mobile/Pulse/components/PostCard.tsx');

    expect(feed).not.toMatch(/BannerAd|AdUnit|sponsoredPost|PromotedPost/);
  });

  it('the no-ads perk is gone from the sell copy', () => {
    expect(MODAL).not.toMatch(/No ads in feed/);
  });

  it('and from the cancellation copy', () => {
    expect(MODAL).not.toMatch(/ad-free feed/);
  });

  it('the remaining perks are all real (the control)', () => {
    // Removing a false perk must not have left the list padded with another.
    expect(MODAL).toMatch(/Blue checkmark/);
    expect(MODAL).toMatch(/\+25% post boost/);
    expect(MODAL).toMatch(/Slower follower decay/);
    expect(MODAL).toMatch(/500-character limit/);

    const tick = read('lib/social/pulseTick.ts');
    expect(tick).toMatch(/verifiedProActive \? 1\.25 : 1\.0/);
    expect(read('lib/social/socialMedia.ts'))
      .toMatch(/verifiedProActive \? 0\.0095 : 0\.01/);
  });

  it('the rewarded-ad perk is untouched — it was never the false one', () => {
    expect(read('components/mobile/Pulse/modals/RewardedAdModal.tsx'))
      .toMatch(/Verified Pro: ×3 reward/);
  });
});

describe('F8 — eviction asks first', () => {
  const APP = read('components/computer/RealEstateApp.tsx');

  it('eviction is irreversible (the premise)', () => {
    expect(read('lib/realEstate/operations.ts'))
      .toMatch(/tenant: undefined, weeksVacant: 0/);
  });

  it('the handler confirms before evicting', () => {
    expect(APP).toMatch(/Alert\.alert\(\s*'Evict tenant\?'/);
    expect(APP).toMatch(/\{ text: 'Cancel', style: 'cancel' \}/);
    expect(APP).toMatch(/style: 'destructive'/);
  });

  it('and the eviction only happens from the confirm branch', () => {
    // The whole point: `evictTenant` must not still be reachable from the
    // bare tap.
    const handler = APP.slice(APP.indexOf('onEvict={()'), APP.indexOf('onMaintain={()'));

    expect(handler).toMatch(/onPress: \(\) => \{\s*evictTenant\(setGameState, manageTarget\.id\);/);
    expect(handler.match(/evictTenant\(/g)).toHaveLength(1);
  });

  it('the message names what is lost', () => {
    expect(APP).toMatch(/the rent stops immediately/);
  });

  it('the non-destructive actions did NOT gain a prompt (the control)', () => {
    // Confirmation is for the irreversible one; adding it everywhere would be
    // its own UX regression.
    const maintain = APP.slice(APP.indexOf('onMaintain={()'), APP.indexOf('onSell={()'));

    expect(maintain).not.toMatch(/Alert\.alert/);
  });
});
