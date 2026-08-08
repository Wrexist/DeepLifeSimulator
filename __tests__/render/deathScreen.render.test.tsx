/**
 * The death screen.
 *
 * Two things here have teeth. The screen must MOUNT — its close handler is
 * gated, so a render error leaves the player staring at a crash screen with a
 * dead save behind it and no way forward, which is the worst failure mode in
 * the app. And it must use the character's NAME: it read `userProfile.name`,
 * the handle, which defaults to `"player"` — so a character someone had named
 * and lived sixty years as was eulogised as "Player".
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import DeathHero from '@/components/death/DeathHero';
import LifeQualityGauge from '@/components/death/LifeQualityGauge';
import { lifeQuality } from '@/lib/legacy/lifeQuality';
import { characterName } from '@/utils/characterName';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function renderToText(node: React.ReactElement): string {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    tree = TestRenderer.create(node);
  });
  const text = JSON.stringify(tree!.toJSON());
  act(() => tree!.unmount());
  return text;
}

const named = (over: Record<string, unknown>): GameState => {
  const s = createTestGameState({});
  s.userProfile = { ...(s.userProfile ?? {}), ...over } as never;
  return s;
};

// ---------------------------------------------------------------------------

describe('the character is named, not "player"', () => {
  it('resolves first + last name', () => {
    expect(characterName(named({ firstName: 'Thomas', lastName: 'White', name: 'player' }))).toBe(
      'Thomas White'
    );
  });

  it('never returns the handle when a real name exists', () => {
    // The whole bug in one assertion: `name` is a handle that defaults to
    // "player", and it was the field being rendered.
    expect(characterName(named({ firstName: 'Donna', lastName: 'Collins', name: 'player' }))).not.toMatch(
      /player/i
    );
  });

  it('copes with only a first name', () => {
    expect(characterName(named({ firstName: 'Ada', name: 'player' }))).toBe('Ada');
  });

  it('falls back to the handle only when there is nothing to build from', () => {
    expect(characterName(named({ firstName: undefined, lastName: undefined, name: 'ghost' }))).toBe(
      'ghost'
    );
  });

  it('returns an empty string on a nameless save, so callers pick their own fallback', () => {
    // Mail wants an address, the death screen wants "Unknown Soul" — the
    // resolver must not decide that for them.
    expect(characterName(named({ firstName: undefined, lastName: undefined, name: undefined }))).toBe('');
    expect(characterName(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------

describe('render — the hero', () => {
  it('mounts without an image asset, because none exists yet', () => {
    // Metro resolves `require()` at BUILD time, so a component reaching for a
    // file that is not there does not degrade — it fails to bundle. The drawn
    // hero is what makes "ship the layout now, add the art later" possible.
    expect(renderToText(<DeathHero height={180} mood="poor" />).length).toBeGreaterThan(0);
  });

  it('mounts at every mood', () => {
    for (const mood of ['bleak', 'poor', 'fair', 'good', 'great'] as const) {
      expect(renderToText(<DeathHero height={180} mood={mood} />).length).toBeGreaterThan(0);
    }
  });

  it('draws nothing random — two renders are byte-identical', () => {
    // A death screen must not roll dice to render: the embers are fixed
    // positions precisely so a re-render does not reshuffle the artwork.
    expect(renderToText(<DeathHero height={180} mood="fair" />)).toBe(
      renderToText(<DeathHero height={180} mood="fair" />)
    );
  });

  it('uses the supplied artwork when one is given, so the asset is a drop-in', () => {
    const text = renderToText(
      <DeathHero height={180} mood="fair" source={{ uri: 'painted-grave.png' }} />
    );
    expect(text).toContain('painted-grave.png');
  });
});

// ---------------------------------------------------------------------------

describe('render — the Life Quality arc', () => {
  const at = (score: number) => ({
    score,
    verdict: 'Test',
    mood: 'fair' as const,
    bands: [],
  });

  it('shows the percentage', () => {
    expect(renderToText(<LifeQualityGauge quality={at(28)} darkMode />)).toContain('28%');
  });

  it('mounts at 0 and at 100 — the two ends the masking gets wrong', () => {
    expect(renderToText(<LifeQualityGauge quality={at(0)} darkMode />)).toContain('0%');
    expect(renderToText(<LifeQualityGauge quality={at(100)} darkMode />)).toContain('100%');
  });

  it('sweeps the two quadrants through exactly the right angles', () => {
    // The arc is two 90° border-wedges, each rotated into its own quadrant
    // mask. Getting a sign wrong here does not throw — it draws most of a
    // circle for a terrible life, or an empty ring for a great one. So the
    // angles are asserted directly at the three points that pin the mapping.
    //
    // CSS/RN `rotate` is CLOCKWISE, and `borderTopColor` paints the wedge
    // centred on 12 o'clock. Left quadrant full at -45deg, empty at -135deg;
    // right quadrant empty at -45deg, full at +45deg.
    const angles = (score: number) =>
      (renderToText(<LifeQualityGauge quality={at(score)} darkMode />).match(
        /"rotate":"(-?[\d.]+)deg"/g
      ) ?? []).join(' ');

    expect(angles(0)).toBe('"rotate":"-135deg" "rotate":"-45deg"');
    expect(angles(50)).toBe('"rotate":"-45deg" "rotate":"-45deg"');
    expect(angles(100)).toBe('"rotate":"-45deg" "rotate":"45deg"');
  });

  it('moves the arc monotonically — more score is never less arc', () => {
    const leftAngle = (score: number) =>
      Number(
        /"rotate":"(-?[\d.]+)deg"/.exec(
          renderToText(<LifeQualityGauge quality={at(score)} darkMode />)
        )![1]
      );
    const angles = [0, 10, 25, 40, 50].map(leftAngle);
    expect([...angles].sort((a, b) => a - b)).toEqual(angles);
  });

  it('renders in light mode too', () => {
    expect(renderToText(<LifeQualityGauge quality={at(50)} darkMode={false} />)).toContain('50%');
  });

  it('is driven by the real score, not a placeholder', () => {
    const state = createTestGameState({});
    const q = lifeQuality(state);
    expect(renderToText(<LifeQualityGauge quality={q} darkMode />)).toContain(`${q.score}%`);
  });
});
