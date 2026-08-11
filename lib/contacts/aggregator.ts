/**
 * Contact aggregator — collects every "person" the player tracks across
 * disparate game systems into one unified ContactView shape.
 *
 * Before this lib, each app showed its own slice in isolation:
 *   - ContactsApp → only `relationships`
 *   - PoliticalApp → only `politics.lobbyists` + `politics.alliances`
 *   - OnionApp → only `darkWeb.vendors`
 *   - TravelApp → only `travel.businessOpportunities`
 *   - CompanyApp → only company employee count
 *
 * The remake's ContactsApp is the network spine — it surfaces all of them.
 *
 * Pure function. Caller filters / sorts.
 */

import { GameState } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type ContactKind =
  | 'family'        // parent, child
  | 'partner'       // partner, spouse
  | 'friend'
  | 'lobbyist'
  | 'alliance'     // political alliance
  | 'vendor'       // dark-web vendor
  | 'business'     // unlocked travel business contact
  | 'employee';    // company employees (rolled up per company)

export interface ContactView {
  id: string;
  /** Canonical kind for filtering. */
  kind: ContactKind;
  /** Display name. */
  name: string;
  /** Optional one-line subtitle ("Tech lobbyist", "Vendor · 87 reputation"). */
  subtitle?: string;
  /** Strength of relationship — meaning depends on kind, normalized 0..100. */
  strength: number;
  /** Optional cost or value tag (lobbyist cost, vendor markup, etc). */
  costPerWeek?: number;
  /** Weeks since last meaningful contact (undefined if never). */
  weeksSinceContact?: number;
  /** Free-form tags for UI rendering (e.g. ['active', 'married', 'flagged']). */
  tags: string[];
  /** Source system — lets the UI link back. */
  sourceApp: 'contacts' | 'politics' | 'darkweb' | 'travel' | 'company';
  /** Stable raw reference for callers that need the original record. */
  raw: unknown;
}

export interface AggregateContactsOptions {
  currentWeek?: number;
  /** Include vendors flagged as scams (default: false). */
  includeFlaggedVendors?: boolean;
  /** Cap on results per kind (default: no cap). */
  perKindLimit?: number;
}

/**
 * Walk the GameState and produce a unified contact list.
 */
export function aggregateContacts(
  state: GameState,
  opts: AggregateContactsOptions = {}
): ContactView[] {
  const week = safe(opts.currentWeek, state.weeksLived);
  const out: ContactView[] = [];

  // 1) Relationships — family, partners, friends.
  for (const r of state.relationships ?? []) {
    const kind: ContactKind = r.type === 'parent' || r.type === 'child'
      ? 'family'
      : r.type === 'partner' || r.type === 'spouse'
        ? 'partner'
        : 'friend';
    // `lastInteractionWeek` is now the single source of truth for recency —
    // stamped by every Contacts interaction (Call / Hang Out / Ask / date /
    // gift). The legacy `lastCall` fallback is retired (it was never written).
    // NOTE: use an explicit guard rather than `safe(..., undefined)` — that idiom
    // silently coerces to 0 (an explicit `undefined` triggers the `fb = 0`
    // default), which would make a never-contacted person read as "contacted in
    // week 0" and wrongly flag them for Attention. A genuine `undefined` keeps
    // never-stamped contacts out of the triage until they've actually lapsed.
    const lastContact =
      typeof r.lastInteractionWeek === 'number' && isFinite(r.lastInteractionWeek)
        ? r.lastInteractionWeek
        : undefined;
    out.push({
      id: r.id,
      kind,
      name: r.name,
      // Stage-aware: an engaged partner shows as Fiancé(e), not plain Partner.
      subtitle: r.type === 'spouse' ? 'Spouse' : r.type === 'partner' ? (r.engagementWeek != null ? 'Fiancé(e)' : 'Partner') : r.type === 'parent' ? 'Parent' : r.type === 'child' ? 'Child' : 'Friend',
      strength: Math.max(0, Math.min(100, safe(r.relationshipScore, 0))),
      weeksSinceContact: lastContact !== undefined ? Math.max(0, week - lastContact) : undefined,
      tags: [
        r.livingTogether ? 'living-together' : '',
        r.isPregnant ? 'expecting' : '',
        r.engagementWeek ? 'engaged' : '',
      ].filter(Boolean),
      sourceApp: 'contacts',
      raw: r,
    });
  }

  // 2) Politics — lobbyists + alliances.
  const politics = state.politics;
  if (politics?.lobbyists) {
    for (const l of politics.lobbyists) {
      if (!l.active) continue;
      out.push({
        id: `lobbyist:${l.id}`,
        kind: 'lobbyist',
        name: l.name,
        subtitle: `Lobbyist · ${l.influence} influence`,
        strength: Math.max(0, Math.min(100, safe(l.influence, 0))),
        costPerWeek: safe(l.cost, 0),
        tags: ['active'],
        sourceApp: 'politics',
        raw: l,
      });
    }
  }
  if (politics?.alliances) {
    for (const a of politics.alliances) {
      const formed = safe(a.formedWeek, week);
      out.push({
        id: `alliance:${a.id}`,
        kind: 'alliance',
        name: a.name,
        subtitle: `Ally · since week ${formed}`,
        strength: Math.max(0, Math.min(100, safe(a.influence, 0))),
        weeksSinceContact: Math.max(0, week - formed),
        tags: ['political'],
        sourceApp: 'politics',
        raw: a,
      });
    }
  }

  // 3) Dark-web vendors with whom the player has done business.
  const dw = state.darkWeb;
  if (dw?.vendors) {
    for (const v of dw.vendors) {
      if (v.flaggedScam && !opts.includeFlaggedVendors) continue;
      if (safe(v.reviewCount, 0) === 0) continue; // never bought from them = not a contact
      out.push({
        id: `vendor:${v.id}`,
        kind: 'vendor',
        name: v.handle,
        subtitle: `Vendor · ${Math.round(safe(v.reputation, 0))} rep · ${safe(v.reviewCount, 0)} reviews`,
        strength: Math.max(0, Math.min(100, safe(v.reputation, 0))),
        tags: [
          v.flaggedScam ? 'flagged' : '',
          safe(v.reputation, 0) >= 80 ? 'trusted' : '',
        ].filter(Boolean),
        sourceApp: 'darkweb',
        raw: v,
      });
    }
  }

  // 4) Travel business contacts (only invested-in ones count as people you know).
  const travel = state.travel;
  if (travel?.businessOpportunities) {
    for (const opp of Object.values(travel.businessOpportunities)) {
      if (!opp.unlocked) continue;
      out.push({
        id: `biz:${opp.id}`,
        kind: 'business',
        name: opp.name,
        subtitle: opp.invested
          ? `Partner · $${safe(opp.weeklyIncome, 0).toLocaleString()}/wk`
          : `Prospect · ${opp.destinationId}`,
        strength: opp.invested ? 80 : 30,
        tags: [opp.invested ? 'partner' : 'prospect'],
        sourceApp: 'travel',
        raw: opp,
      });
    }
  }

  // 5) Company employees — collapsed to one row per company.
  for (const c of state.companies ?? []) {
    const headcount = safe(c.employees, 0);
    if (headcount <= 0) continue;
    out.push({
      id: `company:${c.id}`,
      kind: 'employee',
      name: `${c.name} team`,
      subtitle: `${headcount} ${headcount === 1 ? 'employee' : 'employees'} · $${safe(c.workerSalary, 0).toLocaleString()}/wk each`,
      strength: Math.max(0, Math.min(100, 50 + Math.round(safe(c.workerMultiplier, 1) * 10))),
      costPerWeek: safe(c.workerSalary, 0) * headcount,
      tags: ['company'],
      sourceApp: 'company',
      raw: c,
    });
  }

  // Cap per kind if requested.
  if (opts.perKindLimit && opts.perKindLimit > 0) {
    const counts: Record<string, number> = {};
    return out.filter((c) => {
      counts[c.kind] = (counts[c.kind] || 0) + 1;
      return counts[c.kind] <= opts.perKindLimit!;
    });
  }

  return out;
}

/**
 * Bucket counts for quick stat headers.
 */
export function contactCountsByKind(contacts: ContactView[]): Record<ContactKind, number> {
  const acc: Record<ContactKind, number> = {
    family: 0, partner: 0, friend: 0, lobbyist: 0,
    alliance: 0, vendor: 0, business: 0, employee: 0,
  };
  for (const c of contacts) acc[c.kind] += 1;
  return acc;
}

/**
/**
 * Strength below which the UI flags a contact as "at risk".
 *
 * Exported because it is a CONTRACT with the weekly neglect mechanic, not just a
 * default: `NEGLECT_THRESHOLD` must sit below it so the Attention tab warns well
 * before anything actually happens to a relationship. A test pins that ordering,
 * and it can only track this value if the value has a name.
 */
export const DEFAULT_ATTENTION_STRENGTH_THRESHOLD = 50;

/** Weeks without contact before a contact is considered stale. */
export const DEFAULT_ATTENTION_STALE_WEEKS = 8;

/** Overrides for the at-risk filter. Both fall back to the exported defaults. */
export interface AttentionOptions {
  staleWeeks?: number;
  strengthThreshold?: number;
}

/**
 * Identify contacts at risk of decay — not contacted in N weeks AND strength below threshold.
 */
export function contactsNeedingAttention(
  contacts: ContactView[],
  opts: AttentionOptions = {}
): ContactView[] {
  // Validated and clamped: a NaN threshold makes every `<` comparison false and
  // silently empties the Attention tab, which reads as "nothing needs attention"
  // — the most misleading possible failure for a warning surface.
  const staleInput = opts.staleWeeks ?? DEFAULT_ATTENTION_STALE_WEEKS;
  const strengthInput = opts.strengthThreshold ?? DEFAULT_ATTENTION_STRENGTH_THRESHOLD;
  const stale =
    typeof staleInput === 'number' && isFinite(staleInput)
      ? Math.max(0, staleInput)
      : DEFAULT_ATTENTION_STALE_WEEKS;
  const strengthMin =
    typeof strengthInput === 'number' && isFinite(strengthInput)
      ? Math.max(0, Math.min(100, strengthInput))
      : DEFAULT_ATTENTION_STRENGTH_THRESHOLD;
  return contacts.filter((c) => {
    if (c.weeksSinceContact === undefined) return false;
    return c.weeksSinceContact >= stale && c.strength < strengthMin;
  });
}
