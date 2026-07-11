import {
  aggregateContacts,
  contactCountsByKind,
  contactsNeedingAttention,
} from '../aggregator';
import { GameState } from '@/contexts/game/types';

function base(over: Partial<any> = {}): GameState {
  return {
    weeksLived: 50,
    relationships: [],
    travel: { businessOpportunities: {}, visitedDestinations: [], passportOwned: false, travelHistory: [] },
    politics: { lobbyists: [], alliances: [], careerLevel: 0, approvalRating: 50, policyInfluence: 0, electionsWon: 0, policiesEnacted: [], campaignFunds: 0 },
    darkWeb: { vendors: [] },
    companies: [],
    ...over,
  } as any;
}

describe('aggregateContacts', () => {
  it('returns empty list when no contacts anywhere', () => {
    expect(aggregateContacts(base())).toEqual([]);
  });

  it('includes family / partner / friend rows from relationships', () => {
    const s = base({
      relationships: [
        { id: 'r1', name: 'Dad', type: 'parent', relationshipScore: 80, personality: 'kind', gender: 'male', age: 60 },
        { id: 'r2', name: 'Alice', type: 'spouse', relationshipScore: 90, personality: 'loving', gender: 'female', age: 30, livingTogether: true },
        { id: 'r3', name: 'Bob', type: 'friend', relationshipScore: 50, personality: 'fun', gender: 'male', age: 28 },
      ],
    });
    const contacts = aggregateContacts(s);
    expect(contacts.length).toBe(3);
    const kinds = contacts.map((c) => c.kind);
    expect(kinds).toContain('family');
    expect(kinds).toContain('partner');
    expect(kinds).toContain('friend');
    // Living-together tag should be present
    const partner = contacts.find((c) => c.kind === 'partner');
    expect(partner?.tags).toContain('living-together');
  });

  it('pulls only active lobbyists from politics', () => {
    const s = base({
      politics: {
        lobbyists: [
          { id: 'l1', name: 'Active Lob', cost: 5000, influence: 40, active: true },
          { id: 'l2', name: 'Inactive Lob', cost: 1000, influence: 20, active: false },
        ],
        alliances: [],
        careerLevel: 1,
        approvalRating: 50,
        policyInfluence: 0,
        electionsWon: 0,
        policiesEnacted: [],
        campaignFunds: 0,
      },
    });
    const lobbyists = aggregateContacts(s).filter((c) => c.kind === 'lobbyist');
    expect(lobbyists.length).toBe(1);
    expect(lobbyists[0].name).toBe('Active Lob');
    expect(lobbyists[0].costPerWeek).toBe(5000);
  });

  it('skips vendors with zero reviews (never bought from)', () => {
    const s = base({
      darkWeb: {
        vendors: [
          { id: 'v1', handle: 'CipherX', reputation: 85, reviewCount: 5 },
          { id: 'v2', handle: 'NewVendor', reputation: 50, reviewCount: 0 },
        ],
      },
    });
    const vendors = aggregateContacts(s).filter((c) => c.kind === 'vendor');
    expect(vendors.length).toBe(1);
    expect(vendors[0].name).toBe('CipherX');
    expect(vendors[0].tags).toContain('trusted');
  });

  it('excludes scam-flagged vendors by default but includes when option set', () => {
    const s = base({
      darkWeb: {
        vendors: [{ id: 'v1', handle: 'ScamLord', reputation: 10, reviewCount: 3, flaggedScam: true }],
      },
    });
    expect(aggregateContacts(s).length).toBe(0);
    expect(aggregateContacts(s, { includeFlaggedVendors: true }).length).toBe(1);
  });

  it('includes business contacts and tags invested partners', () => {
    const s = base({
      travel: {
        businessOpportunities: {
          biz_paris: { id: 'biz_paris', destinationId: 'paris', name: 'Paris cafe', description: '', cost: 5000, weeklyIncome: 500, unlocked: true, invested: true },
          biz_bali: { id: 'biz_bali', destinationId: 'bali', name: 'Bali villa', description: '', cost: 8000, weeklyIncome: 1000, unlocked: true, invested: false },
        },
        visitedDestinations: [],
        passportOwned: true,
        travelHistory: [],
      },
    });
    const biz = aggregateContacts(s).filter((c) => c.kind === 'business');
    expect(biz.length).toBe(2);
    expect(biz.find((b) => b.name === 'Paris cafe')?.tags).toContain('partner');
    expect(biz.find((b) => b.name === 'Bali villa')?.tags).toContain('prospect');
  });

  it('rolls up company employees into one row per company', () => {
    const s = base({
      companies: [
        { id: 'c1', name: 'Acme', type: 'factory', employees: 12, workerSalary: 400, workerMultiplier: 1.2, weeklyIncome: 5000, baseWeeklyIncome: 5000, upgrades: [], marketingLevel: 0, miners: {}, warehouseLevel: 0 },
        { id: 'c2', name: 'NoStaff', type: 'ai', employees: 0, workerSalary: 0, workerMultiplier: 1, weeklyIncome: 0, baseWeeklyIncome: 0, upgrades: [], marketingLevel: 0, miners: {}, warehouseLevel: 0 },
      ],
    });
    const teams = aggregateContacts(s).filter((c) => c.kind === 'employee');
    expect(teams.length).toBe(1);
    expect(teams[0].name).toBe('Acme team');
    expect(teams[0].costPerWeek).toBe(12 * 400);
  });

  it('honors perKindLimit', () => {
    const s = base({
      relationships: Array.from({ length: 5 }, (_, i) => ({
        id: `f${i}`,
        name: `Friend ${i}`,
        type: 'friend',
        relationshipScore: 50,
        personality: 'fun',
        gender: 'male',
        age: 30,
      })) as any,
    });
    const capped = aggregateContacts(s, { perKindLimit: 2 });
    expect(capped.length).toBe(2);
  });
});

describe('contactCountsByKind', () => {
  it('counts each bucket', () => {
    const s = base({
      relationships: [
        { id: 'r1', name: 'Dad', type: 'parent', relationshipScore: 80, personality: 'k', gender: 'male', age: 60 },
        { id: 'r2', name: 'Alice', type: 'spouse', relationshipScore: 90, personality: 'l', gender: 'female', age: 30 },
        { id: 'r3', name: 'Bob', type: 'friend', relationshipScore: 50, personality: 'f', gender: 'male', age: 28 },
      ],
    });
    const counts = contactCountsByKind(aggregateContacts(s));
    expect(counts.family).toBe(1);
    expect(counts.partner).toBe(1);
    expect(counts.friend).toBe(1);
  });
});

describe('contactsNeedingAttention', () => {
  it('flags stale and weak contacts only', () => {
    const s = base({
      relationships: [
        // Stale + weak — should flag
        { id: 'r1', name: 'NeglectedPal', type: 'friend', relationshipScore: 30, lastInteractionWeek: 30, personality: 'f', gender: 'male', age: 30 },
        // Stale but strong — should NOT flag
        { id: 'r2', name: 'OldDad', type: 'parent', relationshipScore: 80, lastInteractionWeek: 30, personality: 'f', gender: 'male', age: 60 },
        // Recent — should NOT flag
        { id: 'r3', name: 'RecentFriend', type: 'friend', relationshipScore: 20, lastInteractionWeek: 49, personality: 'f', gender: 'male', age: 28 },
      ],
    });
    const need = contactsNeedingAttention(aggregateContacts(s));
    expect(need.length).toBe(1);
    expect(need[0].name).toBe('NeglectedPal');
  });

  it('derives recency ONLY from lastInteractionWeek (legacy lastCall is retired)', () => {
    const s = base({
      weeksLived: 50,
      relationships: [
        // Only the dead `lastCall` is set — recency must now be undefined so the
        // recency dot reads "No recent contact" rather than a stale value.
        { id: 'r1', name: 'LegacyCall', type: 'friend', relationshipScore: 40, lastCall: 30, personality: 'f', gender: 'male', age: 30 },
        // lastInteractionWeek IS the source of truth.
        { id: 'r2', name: 'Stamped', type: 'friend', relationshipScore: 40, lastInteractionWeek: 42, personality: 'f', gender: 'male', age: 30 },
      ],
    });
    const contacts = aggregateContacts(s);
    expect(contacts.find((c) => c.name === 'LegacyCall')?.weeksSinceContact).toBeUndefined();
    expect(contacts.find((c) => c.name === 'Stamped')?.weeksSinceContact).toBe(8);
  });
});
