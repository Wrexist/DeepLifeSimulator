/**
 * The tax surface is REACHABLE, and the field behind it has a writer.
 *
 * "Is it called?" is not the same question as "does it work?" — recorded three
 * times in `tasks/lessons.md`, and `banking.taxDueThisYear` is the textbook
 * case. It had two readers and zero writers, so both UI rows sat behind a
 * `> 0` gate that could never open, on every save ever made.
 *
 * These tests pin the writer, the tab, and the shape of the answer to the
 * question that prompted this work: *"how do I pay tax each year, and where is
 * the tab in the bank app?"*
 */

import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

const TICK = read('contexts/game/GameActionsContext.tsx');
const BANK = read('components/computer/AdvancedBankApp.tsx');
const PHONE = read('components/mobile/BankApp.tsx');
const STATEMENT = read('components/banking/TaxStatement.tsx');

describe('taxDueThisYear finally has a writer', () => {
  it('the week loop accrues into it', () => {
    expect(TICK).toMatch(/taxDueThisYear: accrueYearlyTax\(/);
  });

  it('the accrued figure covers every stream, not just the weekly withholding', () => {
    expect(TICK).toMatch(/const taxPaidThisWeek =/);
    expect(TICK).toMatch(/incomeTax \+/);
    expect(TICK).toMatch(/cryptoCapitalGainsTax \+/);
    expect(TICK).toMatch(/stocksTickResult\?\.capitalGainsTaxUSD/);
  });

  it('reads the PREVIOUS value off prevState, not the post-tick slice', () => {
    // Reading the mid-tick banking slice would compound whatever another
    // subsystem had already written there.
    expect(TICK).toMatch(/prevState\.banking\?\.taxDueThisYear/);
  });
});

describe('the Bank app has a Tax tab', () => {
  it('is registered in the tab bar', () => {
    expect(BANK).toMatch(/\{ key: 'tax', label: 'Tax', icon: Percent \}/);
  });

  it('renders when selected - a tab that routes nowhere is the Discovery Center trap', () => {
    expect(BANK).toMatch(/activeTab === 'tax' && renderTax\(\)/);
    expect(BANK).toMatch(/const renderTax = \(\) => \(/);
    expect(BANK).toMatch(/<TaxStatement/);
  });

  it('the statement links to the tab rather than relying on the player finding it', () => {
    expect(BANK).toMatch(/setActiveTab\('tax'\)/);
    expect(BANK).toMatch(/See where your tax goes/);
  });
});

describe('the phone bank carries tax too - it is not a desktop-only system', () => {
  // The tab shipped on `AdvancedBankApp`, registered in the DESKTOP category, so
  // the whole tax system sat behind a $5,000 computer. A player crosses their
  // first bracket around week 10. Exactly the trap renting was in.
  it('has a tax sub-view', () => {
    expect(PHONE).toMatch(/\{ kind: 'tax' \}/);
    expect(PHONE).toMatch(/subView\?\.kind === 'tax'/);
    expect(PHONE).toMatch(/renderTaxDetail/);
  });

  it('offers the entry point even before any tax has been paid', () => {
    // Gating the link on `taxDueThisYear > 0` would hide it from the one player
    // who most needs to see the bands: the one who has not crossed a band yet.
    const at = PHONE.indexOf("setSubView({ kind: 'tax' })");
    expect(at).toBeGreaterThan(-1);
    const entry = PHONE.slice(at, at + 700);
    expect(entry).toMatch(
      /banking\.taxDueThisYear > 0 \? 'See where your tax goes' : 'How tax works'/
    );
    // The TouchableOpacity itself must not be conditionally rendered. Scoped to
    // the element's own opening tag — the ledger CHIP a few lines above is
    // legitimately gated on `> 0` and is a different control.
    const openTag = PHONE.slice(PHONE.lastIndexOf('<TouchableOpacity', at), at);
    expect(openTag).not.toMatch(/taxDueThisYear/);
  });

  it('renders the SHARED statement, not a second copy of the numbers', () => {
    expect(PHONE).toMatch(/<TaxStatement/);
    expect(PHONE).toMatch(/from '@\/components\/banking\/TaxStatement'/);
  });
});

describe('one implementation, two hosts', () => {
  it("answers 'when do I file?' explicitly", () => {
    // The mechanic is the ABSENCE of one, which is exactly why it has to be
    // stated rather than left to be inferred from a number going down.
    expect(STATEMENT).toMatch(/Nothing to file/);
    expect(STATEMENT).toMatch(/withheld automatically every week/);
  });

  it('surfaces all four of the taxes that are not the weekly withholding', () => {
    expect(STATEMENT).toMatch(/Stock gains \+ dividends/);
    expect(STATEMENT).toMatch(/Crypto gains/);
    expect(STATEMENT).toMatch(/Property gains/);
    expect(STATEMENT).toMatch(/Property tax/);
  });

  it('shows the year-to-date total and the Tax Strategy discount', () => {
    expect(STATEMENT).toMatch(/banking\.taxDueThisYear/);
    expect(STATEMENT).toMatch(/Tax Strategy/);
  });

  it('uses ONE derivation for the effective rate', () => {
    // It previously switched between "last week's real bill / income" and a
    // computed estimate depending on whether the budget ring buffer had an
    // entry, so the headline number jumped for no player-visible reason.
    expect(STATEMENT).toMatch(/const effective = effectiveTaxRate\(weeklyIncome, taxMult\);/);
  });

  it('obeys Hard Rule #7 - no decorative one-sided colour bar', () => {
    const sheet = STATEMENT.slice(STATEMENT.indexOf('const styles = StyleSheet.create('));
    expect(sheet.length).toBeGreaterThan(500);
    expect(sheet).not.toMatch(/borderLeftColor|borderRightColor|borderTopColor/);
  });

  it('neither host keeps a private copy of the bracket math', () => {
    expect(BANK).not.toMatch(/bracketBreakdown\(/);
    expect(PHONE).not.toMatch(/bracketBreakdown\(/);
    expect(STATEMENT).toMatch(/bracketBreakdown\(weeklyIncome\)/);
  });
});

describe('the five-tab bar fits', () => {
  // The hand-rolled bar (which stacked the icon over the label so five tabs
  // shared a 375pt row) is gone: Bank Pro now renders the shared
  // `SegmentedControl`, which solves the same problem the other way - the row
  // scrolls and each segment keeps its natural width, so no label truncates.
  // The primitive owns `numberOfLines={1}`, the 40pt tap target and role=tab.
  it('renders the shared control rather than a private tab bar', () => {
    expect(BANK).toMatch(/from '@\/components\/ui\/SegmentedControl'/);
    expect(BANK).toMatch(/<SegmentedControl/);
    expect(BANK).not.toMatch(/\{TABS\.map\(\(t\) => \{/);
  });

  it('is scrollable, because five segments do not share a phone-width row', () => {
    const at = BANK.indexOf('<SegmentedControl');
    expect(at).toBeGreaterThan(-1);
    const control = BANK.slice(at, BANK.indexOf('/>', at));
    expect(control).toMatch(/segments=\{TABS\}/);
    expect(control).toMatch(/scrollable/);
  });
});

describe('both dead rows are alive and correctly labelled', () => {
  it('the desktop statement row says PAID, not accrued/due', () => {
    expect(BANK).toMatch(/label: 'Tax paid this year'/);
    expect(BANK).not.toMatch(/Tax accrued this year/);
  });

  it('the phone ledger row says PAID, not due', () => {
    // The five overview ledger chips became `StatStrip` items on the tax
    // sub-page (shared-primitives conversion), so the label is an object
    // property now rather than a JSX attribute. The assertion is the same one:
    // the row must name tax PAID.
    expect(PHONE).toMatch(/label: 'Tax paid'/);
    expect(PHONE).not.toMatch(/'Tax due'/);
  });
});

describe('unaffordable investment tax is debt, not a write-off', () => {
  it('the stocks tick reports the shortfall', () => {
    expect(read('lib/stocks/weeklyTick.ts')).toMatch(/capitalGainsTaxUnpaid = Math\.max\(0, tax - capitalGainsTaxUSD\)/);
  });

  it('the caller folds it into the same arrears bucket the income tax uses', () => {
    expect(TICK).toMatch(/stocksTickResult\.capitalGainsTaxUnpaid > 0/);
    expect(TICK).toMatch(/weeklyCtx\.deferredCharges = \(weeklyCtx\.deferredCharges \?\? 0\) \+ stocksTickResult\.capitalGainsTaxUnpaid/);
  });

  it('deferredCharges still reaches overdueBalance', () => {
    expect(TICK).toMatch(/overdueBalance: arrears\.overdueBalance \+ Math\.max\(0, weeklyCtx\.deferredCharges \?\? 0\)/);
  });
});

describe('Tax Strategy reaches capital gains', () => {
  it('both investment ticks receive the multiplier', () => {
    const passes = TICK.match(/taxMult: lifeSkillMods\.taxMult/g) ?? [];
    expect(passes.length).toBe(2);
  });
});

describe('yearly tax notifications survive into the journal', () => {
  // The journal writer keys entries by notification id. A fixed id records the
  // first occurrence and then dedupes every one after it — so a yearly event
  // with a constant id would appear exactly once in a 60-year life.
  const CRYPTO = read('lib/crypto/weeklyTick.ts');

  it('crypto tax and DCA notes carry the week', () => {
    expect(CRYPTO).toMatch(/id: `crypto-tax-\$\{input\.currentWeek\}`/);
    expect(CRYPTO).toMatch(/id: `crypto-dca-\$\{input\.currentWeek\}`/);
    expect(CRYPTO).not.toMatch(/id: 'crypto-tax-paid'/);
    expect(CRYPTO).not.toMatch(/id: 'crypto-dca-tick'/);
  });
});
