/**
 * Renting a home must be reachable in week 1.
 *
 * Rent shipped as tab 2 of the Real Estate app — which is registered in the
 * DESKTOP category only (so it needs the $5,000 computer) and gated at tier 3
 * ("Finish Chapter 3: On the Rise" — $10k net worth, a partner, an investment).
 * Path: Home → Apps → Real Estate → Rent → Rent. Five taps, plus a $5,000
 * purchase, plus three chapter completions.
 *
 * That is a survival need behind an investment paywall. A tenancy grants weekly
 * health, happiness and energy, and carries an eviction failure state that the
 * v31 arrears work and the v32 `rental` field exist to serve — so the player who
 * most needs it (first 30 weeks, bleeding vitals, nowhere to live) was the one
 * player who could not see that housing existed.
 *
 * It now also lives on Life → Market, which needs no device and has no tier gate.
 */

import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

const MARKET = read('app/(tabs)/market.tsx');

describe('Market carries a Housing surface', () => {
  it('has a housing segment', () => {
    expect(MARKET).toMatch(/key: 'housing'/);
    expect(MARKET).toMatch(/label: 'Housing'/);
  });

  it('lists the real rental options rather than a hardcoded copy', () => {
    expect(MARKET).toMatch(/listRentalOptions\(/);
  });

  it('can actually sign and end a tenancy', () => {
    // A read-only list would be the same trap as the Discovery Center: it shows
    // the thing and takes you nowhere.
    expect(MARKET).toMatch(/rentHome\(/);
    expect(MARKET).toMatch(/endRental\(/);
  });

  it('distinguishes "cannot afford yet" from "already renting"', () => {
    expect(MARKET).toMatch(/option\.current/);
    expect(MARKET).toMatch(/option\.allowed/);
    expect(MARKET).toMatch(/option\.reason/);
  });
});

describe('the surface is not gated', () => {
  it('the housing branch has no device or tier gate', () => {
    // Scoped to the branch on purpose. Market DOES reference `ownsComputer`
    // elsewhere — it is the item-purchase validator (you cannot buy a second
    // computer), which has nothing to do with renting.
    const housingBranch = MARKET.slice(
      MARKET.indexOf("activeTab === 'housing'"),
      MARKET.indexOf('<View style={styles.gymCard}>')
    );
    expect(housingBranch.length).toBeGreaterThan(200);
    expect(housingBranch).not.toMatch(/isFeatureUnlocked/);
    expect(housingBranch).not.toMatch(/ownsComputer/);
    expect(housingBranch).not.toMatch(/ownsSmartphone/);
  });

  it('market is registered as a route the Life tab can reach', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    expect(layout).toMatch(/name="market"/);
  });
});

describe('the Real Estate app keeps its own rent surface', () => {
  it('is not removed — buying property is still an investment flow', () => {
    // This adds a path, it does not take one away. A player who found rent in
    // the Real Estate app should keep finding it there.
    const app = read('components/computer/RealEstateApp.tsx');
    expect(app).toMatch(/rentHome\(/);
  });
});
