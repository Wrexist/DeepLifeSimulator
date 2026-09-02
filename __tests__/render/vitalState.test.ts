/**
 * Program 5 - ONE answer to "when is a vital low".
 *
 * Nine different thresholds lived in the app (25 in the tips, 30 in the
 * issues card, 40 in a dead HUD grader, 50 on the pet rail...), so the same
 * number could be silent on Home, amber on Health and red in the HUD. Every
 * surface now reads `vitalState`; this pins the ladder and the rule that
 * identity colours never double as state colours.
 */
import { vitalState, CRITICAL_VITAL, LOW_VITAL, GOOD_VITAL } from '@/lib/config/hierarchy';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
import { accent } from '@/lib/config/theme';
import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('vitalState - the one ladder', () => {
  it('bands at 20 / 40 / 80, inclusive at the low edges', () => {
    expect(vitalState(0).level).toBe('critical');
    expect(vitalState(CRITICAL_VITAL).level).toBe('critical');
    expect(vitalState(CRITICAL_VITAL + 1).level).toBe('low');
    expect(vitalState(LOW_VITAL).level).toBe('low');
    expect(vitalState(LOW_VITAL + 1).level).toBe('fair');
    expect(vitalState(GOOD_VITAL - 1).level).toBe('fair');
    expect(vitalState(GOOD_VITAL).level).toBe('good');
    expect(vitalState(100).level).toBe('good');
  });

  it('paints only a PROBLEM: danger / warning; fair and good stay quiet like the HUD', () => {
    // Note the palette shares hues between identity and state on purpose
    // (health's identity IS the danger red): the disambiguation is the RULE -
    // identity paints the icon and ring, state paints only the number - not
    // a second red. `fair` has no colour so a normal reading stays quiet.
    expect(vitalState(10).color).toBe(accent.danger);
    expect(vitalState(30).color).toBe(accent.warning);
    expect(vitalState(60).color).toBeUndefined();
    expect(vitalState(95).color).toBeUndefined();
    expect(STAT_IDENTITY.health.color).toBe(accent.danger);
  });

  it('treats a missing or broken value as fine, not as a crisis', () => {
    expect(vitalState(undefined).level).toBe('good');
    expect(vitalState(Number.NaN).level).toBe('good');
  });

  it('every surface that grades a vital reads this ladder, not its own', () => {
    for (const rel of [
      'components/health/HealthIssuesCard.tsx',
      'components/ContextualTip.tsx',
      'app/(tabs)/health.tsx',
      'components/mobile/PetApp.tsx',
    ]) {
      const src = read(rel);
      expect(src).toMatch(/vitalState|CRITICAL_VITAL/);
    }
    // The HUD's dead grader is gone; only the shared critical line remains.
    const hud = read('components/TopStatsBar.tsx');
    expect(hud).not.toMatch(/getStatColor/);
    expect(hud).toMatch(/CRITICAL_VITAL/);
  });

  it('the Health screen and its cards wear the HUD identity colours', () => {
    expect(read('app/(tabs)/health.tsx')).toMatch(/STAT_IDENTITY\.health\.color/);
    expect(read('components/health/HealthCard.tsx')).toMatch(/STAT_IDENTITY\.health/);
    expect(read('components/SicknessModal.tsx')).toMatch(/STAT_IDENTITY\.energy/);
    expect(read('components/computer/StatisticsApp.tsx')).not.toMatch(/label: 'Mood'/);
  });
});
