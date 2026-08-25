/**
 * Attribute identity - the HUD's colour/icon pairings, shared.
 *
 * The point of `lib/config/statIdentity.ts` is recognition: a player who
 * learned "yellow face = happiness" from the HUD must meet the same pairing on
 * every popup. That only holds while ONE table feeds both, so these tests pin
 * the table itself and the two properties that make it useful - every stat a
 * life moment can move has an entry, and nothing unknown can render blank.
 */
import {
  STAT_IDENTITY,
  FALLBACK_STAT_IDENTITY,
  statIdentity,
  DIRECTION_COLOR,
  withAlpha,
} from '@/lib/config/statIdentity';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('stat identity table', () => {
  it('carries the HUD pairings players already learned', () => {
    expect(STAT_IDENTITY.health.color).toBe('#EF4444');    // red heart
    expect(STAT_IDENTITY.happiness.color).toBe('#F59E0B'); // yellow face
    expect(STAT_IDENTITY.energy.color).toBe('#3B82F6');    // blue bolt
    expect(STAT_IDENTITY.money.color).toBe('#22C55E');     // green wallet
    expect(STAT_IDENTITY.gems.color).toBe('#6366F1');      // indigo gem
  });

  it('gives every stat a distinct colour - two stats that look alike teach nothing', () => {
    const colors = Object.values(STAT_IDENTITY).map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('covers every stat a life moment can move', () => {
    // The generator is the producer; if it grows a stat this table must too,
    // or that effect renders as an anonymous grey sparkle.
    const src = readFileSync(
      join(process.cwd(), 'lib/lifeMoments/lifeMomentGenerator.ts'),
      'utf8',
    );
    const used = new Set(
      [...src.matchAll(/stat:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const stat of used) {
      expect(Object.keys(STAT_IDENTITY)).toContain(stat);
    }
  });

  it('never renders an unknown stat blank', () => {
    expect(statIdentity('not_a_stat')).toBe(FALLBACK_STAT_IDENTITY);
    expect(statIdentity(undefined)).toBe(FALLBACK_STAT_IDENTITY);
    expect(statIdentity('')).toBe(FALLBACK_STAT_IDENTITY);
    expect(FALLBACK_STAT_IDENTITY.Icon).toBeTruthy();
  });

  it('keeps direction colours separate from identity colours', () => {
    // The arrow answers "good or bad", the chip answers "which stat". Reusing
    // one colour for both readings is what made the old rows ambiguous.
    expect(DIRECTION_COLOR.positive).toBe('#10B981');
    expect(DIRECTION_COLOR.negative).toBe('#EF4444');
    // Green direction must not be mistaken for the money identity green.
    expect(DIRECTION_COLOR.positive).not.toBe(STAT_IDENTITY.money.color);
  });
});

describe('withAlpha', () => {
  it('tints a hex colour', () => {
    expect(withAlpha('#F59E0B', 0.12)).toBe('rgba(245, 158, 11, 0.12)');
  });
  it('accepts shorthand hex', () => {
    expect(withAlpha('#FFF', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
});

describe('the HUD reads the shared table', () => {
  it('TopStatsBar takes its stat colours/icons from statIdentity, not literals', () => {
    const src = readFileSync(join(process.cwd(), 'components/TopStatsBar.tsx'), 'utf8');
    expect(src).toContain("from '@/lib/config/statIdentity'");
    // The three literals that used to carry "to match bar color" comments.
    expect(src).toContain('STAT_IDENTITY.happiness.color');
    expect(src).toContain('STAT_IDENTITY.energy.color');
    expect(src).toContain('STAT_IDENTITY.health.color');
  });

  it('LifeMomentModal colours effects by stat and keeps the direction arrow', () => {
    const src = readFileSync(join(process.cwd(), 'components/LifeMomentModal.tsx'), 'utf8');
    expect(src).toContain('statIdentity(effect.stat)');
    expect(src).toContain('DIRECTION_COLOR.positive');
    expect(src).toContain('DIRECTION_COLOR.negative');
  });
});
