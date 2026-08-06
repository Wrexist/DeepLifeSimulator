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
    expect(BANK).toMatch(/\{ id: 'tax', label: 'Tax', icon: Percent \}/);
  });

  it('renders when selected — a tab that routes nowhere is the Discovery Center trap', () => {
    expect(BANK).toMatch(/activeTab === 'tax' && renderTax\(\)/);
    expect(BANK).toMatch(/const renderTax = \(\) => \{/);
  });

  it("answers 'when do I file?' explicitly", () => {
    // The mechanic is the ABSENCE of one, which is exactly why it has to be
    // stated rather than left to be inferred.
    expect(BANK).toMatch(/Nothing to file/);
    expect(BANK).toMatch(/withheld automatically every week/);
  });

  it('surfaces all four of the taxes that are not the weekly withholding', () => {
    expect(BANK).toMatch(/Stock gains \+ dividends/);
    expect(BANK).toMatch(/Crypto gains/);
    expect(BANK).toMatch(/Property gains/);
    expect(BANK).toMatch(/Property tax/);
  });

  it('shows the year-to-date total and the Tax Strategy discount', () => {
    expect(BANK).toMatch(/banking\.taxDueThisYear/);
    expect(BANK).toMatch(/Tax Strategy/);
  });

  it('obeys Hard Rule #7 — no decorative one-sided colour bar in the tax styles', () => {
    const styles = BANK.slice(BANK.indexOf('taxBandRow: {'), BANK.indexOf('taxFootnote: {'));
    expect(styles.length).toBeGreaterThan(200);
    expect(styles).not.toMatch(/borderLeftColor|borderRightColor|borderBottomColor/);
  });
});

describe('both dead rows are alive and correctly labelled', () => {
  it('the desktop statement row says PAID, not accrued/due', () => {
    expect(BANK).toMatch(/label: 'Tax paid this year'/);
    expect(BANK).not.toMatch(/Tax accrued this year/);
  });

  it('the phone ledger chip says PAID, not due', () => {
    expect(PHONE).toMatch(/label="Tax paid"/);
    expect(PHONE).not.toMatch(/label="Tax due"/);
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
