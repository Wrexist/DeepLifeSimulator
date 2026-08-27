/**
 * A collapsible section must fill its parent's width, not its own contents'.
 *
 * `IdentityCardStyles.card` centres its children (`alignItems: 'center'`). A
 * child with no width of its own then shrinks to its CONTENT width, and every
 * symptom follows from that one fact: the header collapses until the title
 * truncates ("DETAILS" -> "DETA..."), and `statsGrid`'s `width: '100%'`
 * resolves against that narrow box, so tiles with `minWidth: '47%'` no longer
 * fit two per row and stack one per line. Reported from TestFlight as a
 * squashed identity card.
 *
 * A section is a block. It should never be sized by what is inside it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { styles as identityCardStyles } from '@/components/IdentityCardStyles';

const ROOT = path.resolve(__dirname, '../..');
const readSource = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('CollapsibleSection fills its parent', () => {
  it('stretches across the parent cross axis', () => {
    const src = readSource('components/ui/CollapsibleSection.tsx');
    const section = /\n {2}section: \{([\s\S]*?)\n {2}\},/.exec(src)?.[1];
    expect(section).toBeDefined();
    expect(section).toMatch(/alignSelf: 'stretch'/);
  });

  it('the identity card really does centre its children (why the fix is needed)', () => {
    // If this ever stops being true the fix above is still right, but the
    // reason recorded beside it would have gone stale.
    expect((identityCardStyles.card as { alignItems?: string }).alignItems).toBe('center');
  });

  it('the stat tiles are still sized for two per row', () => {
    // The bug made the ROW narrow; the tiles themselves were always correct.
    const item = identityCardStyles.statItem as { minWidth?: string };
    const grid = identityCardStyles.statsGrid as { flexWrap?: string; width?: string };
    expect(item.minWidth).toBe('47%');
    expect(grid.flexWrap).toBe('wrap');
    expect(grid.width).toBe('100%');
  });
});
