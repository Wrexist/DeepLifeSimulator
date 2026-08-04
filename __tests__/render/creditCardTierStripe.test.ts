/**
 * Player report, 2026-08-01: "The UI for credit cards is broken."
 *
 * Both credit-card surfaces painted the card tier as a `scale(6)` coloured bar
 * down the left edge of the card. That is the decorative side accent bar Hard
 * Rule #7 bans app-wide — the product owner rejected the look, and RN curls it
 * into a crescent artifact where it meets a `borderRadius`. `CreditCardRow`
 * clipped its stripe with `borderRadius.xl` + `overflow: 'hidden'`, which is
 * exactly the combination the rule warns about.
 *
 * The rule's permitted alternatives are a full `borderWidth: 1` + `borderColor`
 * on all four sides (keeping the colour for meaning) or a tinted background
 * with no border. Both files now take the first, so the tier is still readable
 * at a glance.
 *
 * Source assertions rather than render ones: this is a styling rule about which
 * declarations may exist, and the rendered tree cannot tell a banned stripe
 * from a legitimate divider.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

/** Strip comments so an explanation of the fix cannot satisfy the fix. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ROW = code(read('components/banking/CreditCardRow.tsx'));
const MODAL = code(read('components/banking/ApplyCardModal.tsx'));

describe('the credit-card tier is not a side accent bar', () => {
  it('CreditCardRow has no tier stripe element or style', () => {
    expect(ROW).not.toMatch(/tierStripe/);
    expect(ROW).not.toMatch(/tierStripeAccent/);
  });

  it('ApplyCardModal has no tier stripe either', () => {
    // The Apply sheet is one tap from the card list — the reporter was on the
    // screen with the "+ Apply" button — so fixing only the list would have
    // left the same look one tap away.
    expect(MODAL).not.toMatch(/tierStripe/);
  });

  it('neither file introduces a one-sided coloured border instead', () => {
    // The other half of Hard Rule #7: swapping the sibling View for
    // `borderLeftWidth` would be the same banned look by another route.
    for (const [name, src] of [['CreditCardRow', ROW], ['ApplyCardModal', MODAL]] as const) {
      expect(`${name}: ${/border(Left|Right|Top|Bottom)Width/.test(src)}`)
        .toBe(`${name}: false`);
    }
  });

  it('the tier colour survives, on a full four-sided border', () => {
    // Removing the stripe must not remove the MEANING. Losing the tier cue
    // would be a different regression, not a fix.
    expect(ROW).toMatch(/borderColor: c1, borderWidth: 1/);
    expect(MODAL).toMatch(/borderColor: p\.color/);
  });

  it('and on the card icon, as before (the control)', () => {
    expect(ROW).toMatch(/<CardIcon size=\{scale\(16\)\} color=\{c1\} \/>/);
    expect(MODAL).toMatch(/<CreditCard size=\{scale\(16\)\} color=\{p\.color\} \/>/);
  });

  it('no tier resolves to a near-black colour (the control)', () => {
    // A tier colour that was only ever an icon tint could get away with
    // #0f172a; as a border on a dark surface it reads as no colour at all.
    for (const [name, src] of [['CreditCardRow', ROW], ['ApplyCardModal', MODAL]] as const) {
      expect(`${name}: ${/#0f172a/i.test(src)}`).toBe(`${name}: false`);
    }
  });

  it('every tier still has a colour (the control)', () => {
    for (const tier of ['starter', 'standard', 'gold', 'platinum']) {
      expect(ROW).toMatch(new RegExp(`${tier}:`));
    }
  });
});
