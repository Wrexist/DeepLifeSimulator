/**
 * Lobbyist specialty is a real mechanic, not a label.
 *
 * FINDING (2026-08-12): three facts, each verified against source.
 *
 *   1. `calculateTotalLobbyistInfluence` was the ONLY reader of
 *      `Lobbyist.specialty` in the repo, and it had **zero call sites**.
 *   2. `PoliticalApp` advertised the specialty in three places — the roster row,
 *      the hire picker and the detail screen — so a player choosing the
 *      Environmental Advocate over the Criminal Justice Expert for a green bill
 *      was choosing on a distinction the game did not implement.
 *   3. `PolicyType` was declared TWICE and the two diverged: five members in
 *      `lobbyists.ts`, eleven in `policies.ts`.
 *
 * (3) is the root cause of (1). Seven policy types — `stock`, `realestate`,
 * `education`, `crypto`, `technology`, `healthcare`, `transportation` — could
 * not even be NAMED as a specialty, so targeting could never have priced them
 * and the function sat uncalled while the UI kept promising it worked.
 *
 * The coverage test below is the one that matters long-term: it is what makes a
 * new policy type fail here instead of silently becoming the eighth orphan.
 */
import {
  AVAILABLE_LOBBYISTS,
  calculateTotalLobbyistInfluence,
  describeSpecialties,
  lobbyistCovers,
  policyDiscountFraction,
  getLobbyistById,
  BASE_INFLUENCE_DISCOUNT_CAP,
  TARGETED_LOBBYIST_DISCOUNT_CAP,
  TOTAL_POLICY_DISCOUNT_CAP,
} from '@/lib/politics/lobbyists';
import type { PolicyType } from '@/lib/politics/policies';
import { POLICIES } from '@/lib/politics/policies';

/** Every policy type the policy catalogue actually ships. */
const POLICY_TYPES_IN_USE = [...new Set(POLICIES.map((p) => p.type))] as PolicyType[];

describe('the two PolicyType declarations are now one', () => {
  it('every policy type in the catalogue has at least one specialist', () => {
    // THE invariant. Before this change, 7 of 11 types had no possible
    // specialist because the lobbyist file's own `PolicyType` did not contain
    // them. A type with no specialist is a policy the player can only discount
    // by buying a $50k generalist.
    for (const type of POLICY_TYPES_IN_USE) {
      const specialists = AVAILABLE_LOBBYISTS.filter(
        (l) => !l.specialties.includes('all') && l.specialties.includes(type),
      );
      expect(`${type}: ${specialists.length} specialist(s)`).not.toBe(`${type}: 0 specialist(s)`);
    }
  });

  it('no lobbyist claims a specialty that is not a real policy type', () => {
    // The other direction: a typo'd or retired specialty would silently never
    // match, which is the failure mode that produced this finding.
    const valid = new Set<string>([...POLICY_TYPES_IN_USE, 'all']);
    for (const lob of AVAILABLE_LOBBYISTS) {
      for (const s of lob.specialties) {
        expect(`${lob.id} → ${s}: ${valid.has(s)}`).toBe(`${lob.id} → ${s}: true`);
      }
    }
  });

  it('every lobbyist declares at least one specialty', () => {
    for (const lob of AVAILABLE_LOBBYISTS) {
      expect(`${lob.id}: ${lob.specialties.length}`).not.toBe(`${lob.id}: 0`);
    }
  });
});

describe('targeting decides who counts', () => {
  it('a matching specialist contributes, an unrelated one does not', () => {
    const green = calculateTotalLobbyistInfluence(['environmental_advocate'], 'environmental');
    const offTarget = calculateTotalLobbyistInfluence(['environmental_advocate'], 'criminal');

    expect(green).toBe(10);
    expect(offTarget).toBe(0);
  });

  it('a generalist counts for every type', () => {
    for (const type of POLICY_TYPES_IN_USE) {
      expect(`${type}: ${calculateTotalLobbyistInfluence(['retired_politician'], type)}`).toBe(`${type}: 50`);
    }
  });

  it('a multi-type lobbyist counts on each of its types', () => {
    // The Union Representative's description has always read "Great for social
    // and economic policies" — the singular `specialty` field could not say so.
    expect(calculateTotalLobbyistInfluence(['union_representative'], 'social')).toBe(12);
    expect(calculateTotalLobbyistInfluence(['union_representative'], 'economic')).toBe(12);
    expect(calculateTotalLobbyistInfluence(['union_representative'], 'criminal')).toBe(0);
  });

  it('with no policy type, only generalists count', () => {
    // Nothing to be on-target FOR, so a specialist has no claim.
    expect(calculateTotalLobbyistInfluence(['economic_expert'])).toBe(0);
    expect(calculateTotalLobbyistInfluence(['local_lobbyist'])).toBe(5);
  });

  it('ignores ids that are not in the catalogue', () => {
    expect(calculateTotalLobbyistInfluence(['not_a_lobbyist'], 'social')).toBe(0);
  });

  it('degrades rather than throwing on a malformed entry', () => {
    // `lobbyistCovers` is reached from the week-adjacent enact path; one bad
    // shape must not abort it.
    const malformed = { id: 'x', name: 'x', cost: 0, influence: 1, description: '' } as never;
    expect(lobbyistCovers(malformed, 'social')).toBe(false);
  });
});

describe('the discount stacks instead of replacing', () => {
  it('an unchanged player keeps exactly the discount they had', () => {
    // The base term is byte-identical to the old formula. A save whose
    // influence came from enacting policies and lobbying — not from retainers —
    // must not lose a single point.
    for (const influence of [0, 10, 25, 50, 100]) {
      const expected = Math.min(BASE_INFLUENCE_DISCOUNT_CAP, influence / 100);
      expect(`${influence} → ${policyDiscountFraction(influence, [], 'social')}`).toBe(
        `${influence} → ${expected}`,
      );
    }
  });

  it('a matching lobbyist beats the same lobbyist on the wrong bill', () => {
    const onTarget = policyDiscountFraction(0, ['environmental_lawyer'], 'environmental');
    const offTarget = policyDiscountFraction(0, ['environmental_lawyer'], 'criminal');

    expect(onTarget).toBeGreaterThan(offTarget);
    expect(offTarget).toBe(0);
  });

  it('the targeted term is capped on its own', () => {
    // Every generalist hired at once — 5 + 25 + 35 + 50 = 115 influence.
    const all = ['local_lobbyist', 'top_tier_lobbyist', 'elite_lobbyist', 'retired_politician'];
    expect(policyDiscountFraction(0, all, 'social')).toBe(TARGETED_LOBBYIST_DISCOUNT_CAP);
  });

  it('and the total is capped so a bill is never free', () => {
    const all = AVAILABLE_LOBBYISTS.map((l) => l.id);
    expect(policyDiscountFraction(100, all, 'social')).toBe(TOTAL_POLICY_DISCOUNT_CAP);
    expect(TOTAL_POLICY_DISCOUNT_CAP).toBeLessThan(1);
  });

  it('a malformed policyInfluence contributes 0 rather than NaN', () => {
    // The value is arithmetic in a price; NaN here would render the whole cost
    // line as NaN and let `money < NaN` pass as false.
    for (const bad of [NaN, Infinity, undefined, -50]) {
      const d = policyDiscountFraction(bad as number, [], 'social');
      expect(`${String(bad)} → ${Number.isFinite(d)} / ${d}`).toBe(`${String(bad)} → true / 0`);
    }
  });
});

describe('the label the three UI sites print', () => {
  it('renders a generalist as covering everything', () => {
    expect(describeSpecialties(['all'])).toBe('all policies');
  });

  it('spells realestate as two words', () => {
    // The roster rendered the raw catalogue key.
    expect(describeSpecialties(['realestate'])).toContain('real estate');
  });

  it('lists every type a multi-type lobbyist covers', () => {
    const tech = getLobbyistById('tech_lobbyist');
    const label = describeSpecialties(tech?.specialties);

    for (const part of ['technology', 'crypto', 'economic']) {
      expect(`${part} in "${label}": ${label.includes(part)}`).toBe(`${part} in "${label}": true`);
    }
  });

  it('does not claim universal coverage for a missing catalogue entry', () => {
    /**
     * The roster row used to read `cat?.specialty ?? 'all'` — an unknown
     * lobbyist defaulted to the STRONGEST possible claim. Centralising the
     * three call sites in one helper did not fix that on its own: the helper
     * returned `'all policies'` for `undefined` too, so the defect simply moved
     * inside the function written to remove it.
     *
     * `LobbyistRow` passes `cat?.specialties`, so a hired id with no catalogue
     * entry — a retired lobbyist still sitting on an old save — lands here.
     * Absent must read as absent.
     */
    expect(describeSpecialties(undefined)).not.toBe('all policies');
    expect(describeSpecialties([])).not.toBe('all policies');
    expect(describeSpecialties(undefined)).toBe(describeSpecialties([]));
  });

  it('still says "all policies" for an actual generalist (the control)', () => {
    // The distinction only means something if the real wildcard still reads as
    // the wildcard.
    expect(describeSpecialties(['all'])).toBe('all policies');
  });
});
