/**
 * The crime and dark-web subsystems, which were largely decorative.
 *
 * R3-C1 18 of 19 illegal street jobs gate on `darkWebRequirements` items whose
 * ONLY writer is `buyDarkWebItem` — a function with zero call sites anywhere in
 * the app. The `items` catalogue cannot cover them either. So the whole
 * illegal-crime ladder was permanently greyed out and `criminalXp` could only
 * come from the one unlocked job plus jail activities; the repo's own stress
 * test already worked around it by filtering to jobs with no requirements.
 *
 * R3-C2 all 15 crime talent nodes were inert. They cost cash AND a
 * permanently-limited skill point, and promised up to "+50% stealth success
 * rate"; the job math read `level` alone and never touched `.upgrades`.
 *
 * R3-C4 "Legal Appeal" required education id `law_degree`; the real template id
 * is `law_school`, so it was unrunnable by anyone and leaked the raw id.
 *
 * R3-C5 "Acquire New Identity" gated its button and wrote its confirm dialog
 * off the BASE cost while charging base + debt settlement, so it silently did
 * nothing — the action returns void, so there was no alert either.
 *
 * R3-C6 `unlockCrimeSkillUpgrade` had no already-unlocked re-check inside the
 * updater, so a double tap burned TWO points out of a lifetime budget of
 * `skillLevel - 1`, unrecoverably.
 *
 * R3-C8 `raid_risk` printed P(any police event) rather than P(raid), a ~4x
 * overstatement of the number players manage heat around.
 *
 * R3-C10 a successful market purchase delivered no item at all.
 * 2026-07-31 audit round 3.
 */
import fs from 'fs';
import path from 'path';
import { RAID_SHARE_OF_POLICE_EVENTS } from '@/lib/darkweb/weeklyTick';
import { initialGameState } from '@/contexts/game/initialState';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('R3-C1 + R3-C10 — a gear purchase delivers gear', () => {
  const source = read('contexts/game/actions/CrimeActions.ts');

  /**
   * MECHANISM REPLACED 2026-08-11 (BBQ report, D-4).
   *
   * R3-C10 shipped the grant as "the next unowned entry in CATALOGUE order":
   *
   *     const nextIdx = items.findIndex((it) => it && !it.owned);
   *
   * which delivered *an* item but never *the* item — buying "Night Vision"
   * handed over a "Special USB", because `usb` is index 0. The three assertions
   * here pinned that literal code, so they had to move with it.
   *
   * The grant now resolves through `listingItemId`, backed by
   * `LISTING_TITLE_TO_ITEM_ID` in `lib/darkweb/marketplace.ts`. Behaviour is
   * covered properly — by driving the real action rather than by regex — in
   * `__tests__/economy/darkWebDelivery.test.ts`. What stays here is the
   * structural intent R3-C10 was protecting.
   */
  it('grants the LISTED catalogue item on a successful gear purchase', () => {
    expect(source).toMatch(/result\.result\.outcome === 'success' && deliveredId/);
    // Resolved from the listing, not from catalogue position.
    expect(source).toMatch(/const deliveredId = listingItemId\(listing\)/);
    expect(source).toMatch(/items\.findIndex\(\(it\) => it\?\.id === deliveredId\)/);
    // The positional grant must not come back.
    expect(source).not.toMatch(/findIndex\(\(it\) => it && !it\.owned\)/);
  });

  it('only gear and hacking-tool categories deliver', () => {
    // Stolen accounts, carded items, fake IDs, services and data stay the pure
    // reputation/heat plays they already were. The category gate moved into
    // `listingItemId`, which is the single place that decides.
    const marketplace = read('lib/darkweb/marketplace.ts');
    expect(marketplace).toMatch(
      /if \(listing\.category !== 'gear' && listing\.category !== 'hackingTools'\) return undefined;/
    );
  });

  it('does not grant on a scam', () => {
    // A scam is the vendor taking the money and vanishing; delivering anyway
    // would remove the entire downside.
    // Anchor first: a renamed const would make indexOf return -1, slice from
    // the end, and pass on an empty string.
    const at = source.indexOf('const deliveredId');
    expect(`deliveredId anchor found: ${at > -1}`).toBe('deliveredId anchor found: true');
    const block = source.slice(at);
    expect(block.slice(0, 400)).not.toMatch(/outcome === 'scam'/);
  });

  it('the gear catalogue it unlocks actually exists', () => {
    // Guards the whole mechanism: granting into an empty array would be a no-op.
    expect((initialGameState.darkWebItems ?? []).length).toBeGreaterThan(0);
  });

  it('street jobs really do gate on those ids (the reason this matters)', () => {
    const jobsWithGear = (initialGameState.streetJobs ?? []).filter(
      (j) => Array.isArray((j as { darkWebRequirements?: string[] }).darkWebRequirements)
        && ((j as { darkWebRequirements?: string[] }).darkWebRequirements?.length ?? 0) > 0,
    );

    expect(jobsWithGear.length).toBeGreaterThan(10);
  });
});

describe('R3-C2 — crime talent nodes affect the job math', () => {
  const source = read('contexts/game/actions/JobActions.ts');

  it('reads the unlocked talents', () => {
    expect(source).toMatch(/gameState\.crimeSkills\?\.\[job\.skill\]\?\.upgrades \|\| \[\]/);
  });

  it('adds them to the success chance', () => {
    expect(source).toMatch(/baseSuccess \+ skillBonus \+ talentSuccessBonus \+ karmaBonus/);
  });

  it('adds them to the payment', () => {
    expect(source).toMatch(/\* talentPayMultiplier/);
  });

  it('bounds the pay multiplier so a full tree is not unbounded', () => {
    expect(source).toMatch(/Math\.min\(\s*TALENT_PAY_MULTIPLIER_MAX,/);
  });

  it('implements the tree RULE, not the per-node display strings', () => {
    // `TALENT_TREES[*].description` says "+5% success rate and +10% payment"
    // per talent; the per-node `effect` strings say +10%…+50% and would stack
    // to +150% on one tree.
    expect(source).toMatch(/const TALENT_SUCCESS_BONUS_PCT = 5;/);
    expect(source).toMatch(/const TALENT_PAY_BONUS_PCT = 0\.10;/);
  });
});

describe('R3-C4 — Legal Appeal names a real education', () => {
  it('requires law_school, the actual template id', () => {
    const activity = (initialGameState.jailActivities ?? []).find(
      (a) => (a as { requiresEducation?: string }).requiresEducation,
    ) as { requiresEducation?: string } | undefined;

    expect(activity?.requiresEducation).toBe('law_school');
  });

  it('no jail activity requires an id that is not law_school', () => {
    for (const a of initialGameState.jailActivities ?? []) {
      const req = (a as { requiresEducation?: string }).requiresEducation;
      if (req) expect(req).toBe('law_school');
    }
  });
});

describe('R3-C5 — New Identity is gated on what it charges', () => {
  const source = read('components/computer/OnionApp.tsx');

  it('gates the button on the TOTAL, not the base cost', () => {
    expect(source).toMatch(/const canId = btcOwned >= idInfo\.total;/);
  });

  it('quotes the total in the confirm dialog', () => {
    expect(source).toMatch(/\$\{idInfo\.total\.toFixed\(2\)\} BTC will be spent/);
  });

  it('the disabled label names the real requirement', () => {
    expect(source).toMatch(/NEED \$\{idInfo\.total\.toFixed\(2\)\} BTC/);
  });
});

describe('R3-C6 — a double tap cannot burn two skill points', () => {
  it('re-checks already-unlocked inside the updater', () => {
    const source = read('contexts/game/JobActionsContext.tsx');

    expect(source).toMatch(/if \(\(skill\.upgrades \|\| \[\]\)\.includes\(upgradeId\)\) \{\s*\n\s*return prevState;/);
  });
});

describe('R3-C8 — raid_risk states the raid chance', () => {
  it('the raid is a slice of police events, not all of them', () => {
    expect(RAID_SHARE_OF_POLICE_EVENTS).toBeGreaterThan(0);
    expect(RAID_SHARE_OF_POLICE_EVENTS).toBeLessThan(1);
  });

  it('the display scales by that share', () => {
    expect(read('components/computer/OnionApp.tsx')).toMatch(
      /policeEventProbability\(dw\.heat \?\? 0\) \* RAID_SHARE_OF_POLICE_EVENTS \* 100/,
    );
  });
});

describe('R3-C7 + R3-C9 — the UI stops promising systems that do not exist', () => {
  it('the dark-web banner no longer claims heat or raid-risk effects', () => {
    const source = read('components/shared/EconomyEventBanner.tsx');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/heat decays a touch faster/);
    expect(code).not.toMatch(/Higher police-event risk/);
    expect(code).not.toMatch(/Marketplace traffic high/);
  });

  it('the surveillance event no longer promises a decay stall', () => {
    const code = read('lib/darkweb/weeklyTick.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/expect decay to stall/);
  });
});

describe('R3-C11 — jail-activity XP cannot be dropped', () => {
  const source = read('contexts/game/JobActionsContext.tsx');

  it('applies the XP inside the same updater', () => {
    expect(source).toMatch(/\.\.\.\(success && criminalXpToGain > 0 \? applyCriminalXp\(prevState, criminalXpToGain\) : \{\}\)/);
  });

  it('no longer calls the action after the updater', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/if \(success && criminalXpToGain > 0\) \{\s*\n\s*gainCriminalXp/);
  });

  it('the shared helper still carries a level-up', () => {
    expect(source).toMatch(/criminalLevel: \(state\.criminalLevel \|\| 1\) \+ 1/);
  });
});
