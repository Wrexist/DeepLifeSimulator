/**
 * A partner is a household contribution, not a cheat code — Master Program 11.
 *
 * `Relationship.income` is populated from exactly one place: `DATING_PROFILES`,
 * copied at promotion. Every one of those 52 numbers is an ANNUAL salary
 * written as such — Student 15,000, Elementary Teacher 45,000, Software
 * Engineer 75,000, CEO & Founder 250,000. `householdPartnerIncome` nonetheless
 * added a quarter of it to a WEEKLY total, beside a career salary that runs
 * $110 at the bottom rung to $6,000 at the top of the best ladder in the game.
 *
 * Measured on the real tick (Program 11 social personas): the romance persona's
 * weekly tick delta went from $110 to $15,580 the week it promoted a match, and
 * it finished 250 weeks on $3.36M against the loner's $53k — having taken no
 * economic action at all.
 *
 * These tests pin the UNIT, not the balance number, so a future tune of
 * `PARTNER_INCOME_SHARE` cannot silently reintroduce the mismatch.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';
import {
  householdPartnerIncome,
  PARTNER_INCOME_SHARE,
  PARTNER_INCOME_THRESHOLD,
} from '@/contexts/game/actions/weekly/applyIncome';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';

const partner = (income: number, over: Partial<Relationship> = {}): Relationship => ({
  id: 'p1',
  name: 'Pat',
  type: 'partner',
  relationshipScore: 70,
  personality: 'friendly',
  gender: 'female',
  age: 30,
  income,
  ...over,
});

/** Every weekly salary the career ladders can pay. */
const CAREER_WEEKLY = INITIAL_CAREERS.flatMap((c) =>
  (c.levels ?? []).map((l) => l.salary).filter((n): n is number => typeof n === 'number'),
);

describe('the partner contribution is a weekly number derived from an annual one', () => {
  it('is a quarter of the annual salary, spread over the year', () => {
    expect(householdPartnerIncome([partner(52_000)])).toBe(
      Math.round((52_000 * PARTNER_INCOME_SHARE) / WEEKS_PER_YEAR),
    );
  });

  it('the richest profile in the catalogue does not out-earn the best career in the game', () => {
    const richest = Math.max(...DATING_PROFILES.map((p) => p.income));
    const best = Math.max(...CAREER_WEEKLY);
    const weekly = householdPartnerIncome([partner(richest)]);

    // The regression this exists for: before the fix this was `richest * 0.25`
    // = $62,500 a week, ten times the best career rung in the game.
    expect(weekly).toBeLessThan(best);
    expect(weekly).toBeGreaterThan(0);
  });

  it('and the whole catalogue lands in the band a second earner belongs in', () => {
    const entry = Math.min(...CAREER_WEEKLY);
    for (const p of DATING_PROFILES) {
      const weekly = householdPartnerIncome([partner(p.income)]);
      expect(weekly).toBeGreaterThan(0);
      // Nobody's partner is worth more than the top career rung…
      expect(weekly).toBeLessThan(Math.max(...CAREER_WEEKLY));
      // …and the poorest (a student) is still under an entry-level wage.
      if (p.income === Math.min(...DATING_PROFILES.map((x) => x.income))) {
        expect(weekly).toBeLessThan(entry);
      }
    }
  });

  it('only the top earner contributes, and only above the bond threshold', () => {
    const below = partner(100_000, { id: 'p2', relationshipScore: PARTNER_INCOME_THRESHOLD - 1 });
    const above = partner(52_000, { id: 'p3', type: 'spouse' });
    expect(householdPartnerIncome([below])).toBe(0);
    // Not the sum — the maximum of the qualifying ones.
    expect(householdPartnerIncome([below, above])).toBe(householdPartnerIncome([above]));
  });

  it('a friend never contributes, however well paid', () => {
    expect(householdPartnerIncome([partner(250_000, { type: 'friend' })])).toBe(0);
  });

  it('survives a malformed stored income without producing NaN', () => {
    const bad = { ...partner(0), income: Number.NaN } as Relationship;
    expect(householdPartnerIncome([bad])).toBe(0);
    expect(householdPartnerIncome(undefined)).toBe(0);
  });
});

describe('the labels and the tick agree', () => {
  it('the Contacts card says /yr, because the stored number is annual', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src: string = require('fs').readFileSync('components/mobile/ContactsApp.tsx', 'utf8');
    expect(src).toContain('Income · $${r.income.toLocaleString()}/yr');
    expect(src).not.toContain('Income · $${r.income.toLocaleString()}/wk');
  });

  it('the Bank app reads the tick’s own function rather than re-deriving it', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src: string = require('fs').readFileSync('components/computer/AdvancedBankApp.tsx', 'utf8');
    expect(src).toContain('householdPartnerIncome(gameState.relationships)');
    // The copy that was there: `income += Math.round(rel.income * 0.25)`.
    // Matched on the STATEMENT, not the phrase — the comment above the call
    // quotes the old expression on purpose, and a test that forbids naming a
    // bug forbids explaining it.
    expect(src).not.toMatch(/income\s*\+=\s*Math\.round\(rel\.income/);
  });
});

describe('the tick pays what the function says', () => {
  it('a promoted partner is worth hundreds a week, not tens of thousands', () => {
    const base = createTestGameState();
    const withPartner: GameState = { ...base, relationships: [partner(62_000)] };
    const weekly = householdPartnerIncome(withPartner.relationships);

    expect(weekly).toBeGreaterThan(200);
    expect(weekly).toBeLessThan(400);
  });
});
