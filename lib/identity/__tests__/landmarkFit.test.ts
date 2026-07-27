/**
 * Fitting a face from photo landmarks.
 *
 * The fixture is the ICT MEAN FACE's own 68 landmarks, projected to image
 * space. That makes the central assertion available: feed the fitter the exact
 * face the population statistics were measured from, and every slider must come
 * back at its midpoint. Nothing else pins the sign conventions — a flipped
 * vertical axis or a mean subtracted the wrong way round still produces a
 * face-shaped result, just not the right one, and there is no photograph in a
 * unit test to notice.
 */

import fixture from './fixtures/meanFaceLandmarks.json';
import {
  FACE_MEASURES,
  PHOTO_FITTABLE,
  PHOTO_UNFITTABLE,
  applyFitToGenome,
  landmarksToMorphs,
  type Landmark2D,
} from '@/lib/identity/faceMeasures';
import { FACE_MORPH_KEYS, neutralMorphs, randomizeFace } from '@/lib/identity';

const MEAN_FACE = fixture.points as Landmark2D[];

const move = (points: Landmark2D[], fn: (p: Landmark2D) => Landmark2D): Landmark2D[] =>
  points.map(fn);

describe('landmarksToMorphs', () => {
  it('returns the neutral face for the population mean face', () => {
    const { morphs, fitted, confidence } = landmarksToMorphs(MEAN_FACE);
    expect(fitted.length).toBeGreaterThanOrEqual(14);
    expect(confidence).toBeGreaterThan(0.9);
    for (const key of fitted) {
      // Two decimals: the fixture is rounded to 0.01px and projected, so exact
      // equality would be pinning float noise rather than the convention.
      expect(morphs[key]).toBeCloseTo(0.5, 2);
    }
  });

  it('is invariant to where the face sits in the frame and how big it is', () => {
    // A selfie's face is never the same size or in the same place twice. If the
    // fitter were not scale- and translation-invariant, standing closer to the
    // camera would change the shape of the player's jaw.
    const base = landmarksToMorphs(MEAN_FACE).morphs;
    const shifted = landmarksToMorphs(move(MEAN_FACE, (p) => ({ x: p.x + 137, y: p.y - 42 })));
    const scaled = landmarksToMorphs(move(MEAN_FACE, (p) => ({ x: p.x * 2.4, y: p.y * 2.4 })));
    for (const key of PHOTO_FITTABLE) {
      expect(shifted.morphs[key]).toBeCloseTo(base[key], 6);
      expect(scaled.morphs[key]).toBeCloseTo(base[key], 6);
    }
  });

  it('reads a stretched face as wider, and a stretched one as longer', () => {
    // The only face-shape signal a flat photo carries is the aspect ratio, so
    // faceWidth and faceLength necessarily move against each other. Asserted
    // rather than left implicit, because it looks like a bug until you know.
    const wide = landmarksToMorphs(move(MEAN_FACE, (p) => ({ x: p.x * 1.25, y: p.y })));
    expect(wide.morphs.faceWidth).toBeGreaterThan(0.6);
    expect(wide.morphs.faceLength).toBeLessThan(0.4);

    const tall = landmarksToMorphs(move(MEAN_FACE, (p) => ({ x: p.x, y: p.y * 1.25 })));
    expect(tall.morphs.faceLength).toBeGreaterThan(0.6);
    expect(tall.morphs.faceWidth).toBeLessThan(0.4);
  });

  it('reads a widened jaw as a wider jaw', () => {
    // Landmarks 4 and 12 are the mid-jaw; 0 and 16 are the ends, and they are
    // also the face-width denominator — widening the WHOLE contour scales
    // numerator and denominator together and changes nothing, which is the
    // point of measuring a ratio. So only the middle of the jaw moves here.
    const centre = MEAN_FACE.reduce((s, p) => s + p.x, 0) / MEAN_FACE.length;
    const jawed = MEAN_FACE.map((p, i) =>
      i >= 3 && i <= 13 ? { x: centre + (p.x - centre) * 1.14, y: p.y } : p);
    const fit = landmarksToMorphs(jawed);
    expect(fit.morphs.jawWidth).toBeGreaterThan(0.62);
    expect(fit.morphs.mouthWidth).toBeCloseTo(landmarksToMorphs(MEAN_FACE).morphs.mouthWidth, 1);
  });

  it('never sets a morph a flat photo cannot measure', () => {
    // The five depth axes and the three with no landmarks at all. Leaving them
    // neutral is the promise; guessing them is what makes a scan look wrong in
    // a way the player cannot name.
    const { morphs, fitted } = landmarksToMorphs(MEAN_FACE);
    const neutral = neutralMorphs();
    for (const key of PHOTO_UNFITTABLE) {
      expect(fitted).not.toContain(key);
      expect(morphs[key]).toBe(neutral[key]);
    }
  });

  it('keeps every value in range for wildly bad landmarks', () => {
    // A failed detection returns points, just not sensible ones. Out-of-range
    // morphs deform the head into something horrifying, so the clamp matters
    // more here than anywhere the values are authored.
    const noise = MEAN_FACE.map((_, i) => ({ x: ((i * 7919) % 500) - 250, y: ((i * 104729) % 500) - 250 }));
    const { morphs } = landmarksToMorphs(noise);
    for (const key of FACE_MORPH_KEYS) {
      expect(morphs[key]).toBeGreaterThanOrEqual(0);
      expect(morphs[key]).toBeLessThanOrEqual(1);
      expect(Number.isFinite(morphs[key])).toBe(true);
    }
  });

  it('declines rather than guesses when there are too few points', () => {
    const { fitted, confidence, morphs } = landmarksToMorphs(MEAN_FACE.slice(0, 40));
    expect(fitted).toEqual([]);
    expect(confidence).toBe(0);
    expect(morphs).toEqual(neutralMorphs());
  });

  it('scores a plausible face high and a scrambled one low', () => {
    const good = landmarksToMorphs(MEAN_FACE).confidence;
    const scrambled = landmarksToMorphs(
      MEAN_FACE.map((p, i) => ({ x: p.x + (i % 5) * 40, y: p.y + (i % 3) * 55 })),
    ).confidence;
    expect(good).toBeGreaterThan(scrambled);
  });
});

describe('applyFitToGenome', () => {
  it('changes only the morphs the photo measured', () => {
    // This is what "Improve match" relies on: refit the face, keep the hair,
    // skin tone and facial hair the player chose after the first attempt.
    const genome = randomizeFace('fit-merge', { spread: 1 });
    const fit = landmarksToMorphs(MEAN_FACE);
    const merged = applyFitToGenome(genome, fit);

    expect(merged.hairStyle).toBe(genome.hairStyle);
    expect(merged.skinTone).toBe(genome.skinTone);
    expect(merged.facialHair).toBe(genome.facialHair);
    for (const key of PHOTO_UNFITTABLE) {
      expect(merged.morphs[key]).toBe(genome.morphs[key]);
    }
    for (const key of fit.fitted) {
      expect(merged.morphs[key]).toBe(fit.morphs[key]);
    }
  });
});

describe('the measure table', () => {
  it('matches the definitions the head was built from', () => {
    // Pinned literals, copied from MEASURES in scripts/build-ict-head.mjs. The
    // build script derives what each morph MEANS from these indices; if the two
    // ever diverge, every photo fits to a face that is subtly not the one the
    // sliders would produce, and nothing else in the suite would notice.
    expect(FACE_MEASURES.jawWidth).toEqual({ a: 4, b: 12, axis: 'x', over: { a: 0, b: 16, axis: 'x' } });
    expect(FACE_MEASURES.noseLength).toEqual({ a: 27, b: 33, axis: 'y', over: { a: 27, b: 8, axis: 'y' } });
    expect(FACE_MEASURES.mouthWidth).toEqual({ a: 48, b: 54, axis: 'x', over: { a: 0, b: 16, axis: 'x' } });
    expect(FACE_MEASURES.eyeSpacing).toEqual({ a: 39, b: 42, axis: 'x', over: { a: 0, b: 16, axis: 'x' } });
    expect(FACE_MEASURES.chinLength).toEqual({ a: 57, b: 8, axis: 'y', over: { a: 27, b: 8, axis: 'y' } });
  });

  it('fits every morph that is neither a depth axis nor landmark-less', () => {
    expect([...PHOTO_FITTABLE].sort()).toEqual([
      'browHeight', 'cheekFullness', 'cheekboneHeight', 'chinLength', 'eyeSize',
      'eyeSpacing', 'eyeTilt', 'faceLength', 'faceWidth', 'jawAngle', 'jawWidth',
      'lipFullness', 'mouthHeight', 'mouthWidth', 'noseLength', 'noseWidth',
    ]);
  });
});
