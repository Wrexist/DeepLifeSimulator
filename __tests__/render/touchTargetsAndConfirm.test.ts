/**
 * PLAYER REPORTS (1.4 bug-reports) — close buttons you cannot hit, and a
 * skill point spent before you know what you bought.
 *
 *   "Entering the Life Skills UI - the X is slightly hidden"
 *   "The family UI X is also misaligned somewhere. This one is actually hard to
 *    click sometimes."
 *   "A QoL I would like to see is an option to see what it is I'm clicking
 *    before accepting it. Right now clicking any unlocks what it is using a
 *    point."
 *
 * An accessibility pass measured the close controls and found one shape
 * everywhere: a `scale()`d icon in a container with no minimum size and — where
 * a `hitSlop` existed at all — a RAW numeric literal beside the scaled icon.
 *
 * That last detail is why nothing reached 44pt. `scale()` clamps at 1.3 on
 * non-tablets and no shipping iPhone reaches the clamp (a 440pt Pro Max is
 * 1.173), so `scale(20)` is 23 and a raw `hitSlop={10}` gives 43 — one point
 * short on the widest phone Apple sells, and worse on every narrower one.
 *
 * Measured before this: the Restart Game confirm's close was 24x24, the
 * delete-bill button 22x22, the family-tree close 34x34.
 *
 * 2026-08-01, from live player reports.
 */
import fs from 'fs';
import path from 'path';
import { MIN_TOUCH_TARGET, hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { scale } from '@/utils/scaling';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every control the player named or the pass measured below 44pt. */
const FIXED_CONTROLS = [
  'components/ActivityCommitmentModal.tsx',
  'components/SkillTreeModal.tsx',
  'components/FamilyTreeModal.tsx',
  'components/FamilyTab.tsx',
  'components/settings/DangerZone.tsx',
  'components/banking/BillPayRow.tsx',
  'components/realEstate/ManagePropertyModal.tsx',
  'components/crypto/DCARuleRow.tsx',
  'components/crypto/OrderRow.tsx',
];

describe('the helper produces a real 44pt target', () => {
  it('brings a 24pt icon up to the minimum', () => {
    const slop = hitSlopToMinTarget(scale(24));
    const total = scale(24) + slop.left + slop.right;

    expect(total).toBeGreaterThanOrEqual(scale(MIN_TOUCH_TARGET));
  });

  it('brings the smallest measured control (14pt) up too', () => {
    const slop = hitSlopToMinTarget(scale(14));

    expect(scale(14) + slop.left + slop.right).toBeGreaterThanOrEqual(scale(MIN_TOUCH_TARGET));
  });

  it('adds nothing to a control that is already big enough', () => {
    // The control: it must not inflate a button that is already fine, which
    // would start overlapping its neighbours.
    expect(hitSlopToMinTarget(scale(60))).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });

  it('SCALES, unlike the raw literals it replaces', () => {
    // The whole reason `hitSlop={10}` never reached 44: the icon scaled and the
    // slop did not.
    expect(minTouchTargetStyle.minWidth).toBe(scale(MIN_TOUCH_TARGET));
    expect(minTouchTargetStyle.minHeight).toBe(scale(MIN_TOUCH_TARGET));
  });

  it('44 is the documented minimum', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});

describe('every reported control uses it', () => {
  it('no fixed control still carries a raw hitSlop literal', () => {
    for (const rel of FIXED_CONTROLS) {
      const code = strip(read(rel));

      expect(`${rel}: ${/hitSlop=\{\d+\}/.test(code)}`).toBe(`${rel}: false`);
    }
  });

  it('each applies the shared minimum-size style', () => {
    for (const rel of FIXED_CONTROLS) {
      expect(`${rel}: ${strip(read(rel)).includes('minTouchTargetStyle')}`)
        .toBe(`${rel}: true`);
    }
  });
});

describe('a screen reader can name the controls', () => {
  it('the close buttons the player named announce themselves', () => {
    for (const rel of [
      'components/ActivityCommitmentModal.tsx',
      'components/SkillTreeModal.tsx',
      'components/FamilyTreeModal.tsx',
      'components/FamilyTab.tsx',
      'components/settings/DangerZone.tsx',
    ]) {
      expect(`${rel}: ${strip(read(rel)).includes('CLOSE_BUTTON_A11Y')}`)
        .toBe(`${rel}: true`);
    }
  });

  it('the four DESTRUCTIVE icon-only buttons say what they destroy', () => {
    // "Delete" is not enough when the row is one of several identical icons —
    // a screen-reader user could not tell evict from cancel.
    const cases: [string, RegExp][] = [
      ['components/realEstate/ManagePropertyModal.tsx', /accessibilityLabel="Evict the tenant"/],
      ['components/banking/BillPayRow.tsx', /accessibilityLabel=\{`Delete the recurring bill/],
      ['components/crypto/DCARuleRow.tsx', /accessibilityLabel="Delete this recurring buy rule"/],
      ['components/crypto/OrderRow.tsx', /accessibilityLabel="Cancel this open order"/],
    ];

    for (const [rel, pattern] of cases) {
      expect(`${rel}: ${pattern.test(read(rel))}`).toBe(`${rel}: true`);
    }
  });
});

describe('a life skill is confirmed before the point is spent', () => {
  const CODE = strip(read('components/SkillTreeModal.tsx'));

  it('asks before buying, quoting the effect and the cost', () => {
    // The effect string always existed — it was shown in the SUCCESS alert,
    // after the unrecoverable spend.
    expect(CODE).toMatch(/Unlock \$\{node\.name\}\?/);
    expect(CODE).toMatch(/\$\{node\.effect\}/);
    expect(CODE).toMatch(/Cost: \$\$\{node\.cost\.toLocaleString\(\)\}/);
  });

  it('offers a way out', () => {
    expect(CODE).toMatch(/text: 'Cancel', style: 'cancel'/);
  });

  it('the purchase happens only from the confirm handler', () => {
    expect(CODE).toMatch(/onPress: \(\) => commitUnlock\(node\)/);
    expect(CODE).toMatch(/const commitUnlock = useCallback/);
  });

  it('no longer reads the outcome out of the updater (C-10)', () => {
    // CLAUDE.md §4.1 — a value assigned inside an updater is not reliably
    // visible outside it, so the confirmation alert could be skipped for a
    // purchase that had in fact landed.
    expect(CODE).not.toMatch(/let purchased = false/);
    expect(CODE).not.toMatch(/purchased = result\.purchased/);
  });

  it('still reports success (the control)', () => {
    // Moving the report out of the updater must not have deleted it. WP-A: the
    // Alert and the haptic fire from a PREVIEW run of the same pure reducer on
    // the snapshot — inside the updater they were double-fired by StrictMode's
    // double-invoke (two buzzes, two stacked alerts, one purchase).
    expect(CODE).toMatch(/Alert\.alert\('Skill Unlocked'/);
    expect(CODE).toMatch(/if \(preview\.purchased\)/);
  });

  it('the atomic reducer is still what performs the purchase', () => {
    // The confirm step must not have reintroduced a gate-then-grant.
    expect(CODE).toMatch(/purchaseLifeSkill\(prev, args\)\.state/);
  });
});

/**
 * A1 — the 15 transaction sheets where BOTH escapes were unnamed.
 *
 * Each pairs a full-screen backdrop `TouchableOpacity` (self-closing, no label)
 * with a header X (icon-only, no label). `TouchableOpacity` defaults to
 * `accessible={true}`, so VoiceOver focused a full-screen element that
 * announced nothing, then a button that announced nothing — and iOS has no
 * `onRequestClose`, so a screen-reader user had no named way out of a sheet
 * that spends money.
 *
 * The X is now labelled and sized; the backdrop is taken OUT of the
 * accessibility tree rather than labelled, because it is a redundant affordance
 * and a full-screen focus target is worse than none.
 */
describe('A1 — the transaction sheets have one named way out', () => {
  const SHEETS = [
    'components/banking/AddBillModal.tsx',
    'components/banking/AmountInputModal.tsx',
    'components/banking/ApplyCardModal.tsx',
    'components/banking/LoanQuoteModal.tsx',
    'components/banking/OpenAccountModal.tsx',
    'components/stocks/StockTradeModal.tsx',
    'components/crypto/PlaceOrderModal.tsx',
    'components/crypto/DCAModal.tsx',
    'components/realEstate/BuyPropertyModal.tsx',
    'components/realEstate/ManagePropertyModal.tsx',
    'components/vehicles/BuyVehicleModal.tsx',
    'components/education/EnrollModal.tsx',
    'components/politics/EnactPolicyModal.tsx',
    'components/darkweb/LaunderModal.tsx',
    'components/darkweb/StartJobModal.tsx',
  ];

  it('covers every sheet the pass measured', () => {
    // Guards the list: a renamed or deleted file would silently shrink it.
    expect(SHEETS).toHaveLength(15);
    for (const rel of SHEETS) {
      expect(`${rel} exists: ${fs.existsSync(path.join(__dirname, '..', '..', rel))}`)
        .toBe(`${rel} exists: true`);
    }
  });

  it('each close button announces itself', () => {
    for (const rel of SHEETS) {
      expect(`${rel}: ${read(rel).includes('accessibilityLabel="Close"')}`)
        .toBe(`${rel}: true`);
    }
  });

  it('each close button reaches the minimum target', () => {
    for (const rel of SHEETS) {
      const code = strip(read(rel));

      expect(`${rel} scaled slop: ${code.includes('hitSlopToMinTarget')}`)
        .toBe(`${rel} scaled slop: true`);
      expect(`${rel} raw slop: ${/hitSlop=\{\d+\}/.test(code)}`)
        .toBe(`${rel} raw slop: false`);
    }
  });

  it('no backdrop is left as an unnamed full-screen focus target', () => {
    for (const rel of SHEETS) {
      const code = strip(read(rel));
      if (!code.includes('backdropTouch')) continue;

      expect(`${rel}: ${code.includes('accessibilityElementsHidden')}`)
        .toBe(`${rel}: true`);
    }
  });
});
