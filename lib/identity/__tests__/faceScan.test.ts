/**
 * Measuring a face out of pixels.
 *
 * ## Why synthetic faces
 *
 * The thing under test is "does the measured geometry track the real geometry",
 * and that needs images whose real geometry is KNOWN. A photo of a person
 * cannot answer it — nobody can say what the true `jawWidth` percentile of a
 * particular face is, so a test against one degenerates into asserting whatever
 * the code currently returns.
 *
 * So these draw faces with the anchors placed exactly where the test put them,
 * and assert the detector finds them there. A synthetic face is not a real one —
 * no hair, no glasses, no hard shadow, and lighting a phone never produces — so
 * these prove the MEASUREMENT is sound, not that the detector is robust in a
 * bathroom mirror. That second question needs a device and real photographs, and
 * is called out as unverified rather than implied by a green test.
 *
 * ## The property that matters
 *
 * `landmarksToMorphs` measures RATIOS, so a similarity transform of the mean
 * face reproduces the mean face's morphs exactly — every slider at 0.5. The
 * test that actually protects the feature is therefore not "does it find a
 * face" but "do two DIFFERENT faces produce different morphs, in the direction
 * the difference went".
 */
import {
  detectFaceAnchors,
  fitLandmarksToAnchors,
  isSkinPixel,
  scanFaceLandmarks,
} from '@/lib/identity/faceScan';
import { landmarksToMorphs } from '@/lib/identity/faceMeasures';
import MEAN_SHAPE from '@/assets/models/mean-face-landmarks.json';

interface FaceSpec {
  /** Face ellipse. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  eyeGap: number;
  eyeY: number;
  eyeR: number;
  mouthY: number;
  mouthW: number;
  mouthH: number;
  noseY: number;
  noseW: number;
  browDrop: number;
  skin: [number, number, number];
}

const BASE: FaceSpec = {
  cx: 128, cy: 132, rx: 65, ry: 84,
  eyeGap: 52, eyeY: 108, eyeR: 8,
  mouthY: 186, mouthW: 46, mouthH: 10,
  noseY: 152, noseW: 14,
  browDrop: 20,
  skin: [214, 168, 140],
};

const W = 256;
const H = 256;

/** Draw a crude but anatomically-placed face into an RGBA buffer. */
function render(spec: FaceSpec): Uint8Array {
  const buf = new Uint8Array(W * H * 4);
  // Background: a flat blue-grey that fails the skin test decisively.
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = 40; buf[i * 4 + 1] = 48; buf[i * 4 + 2] = 70; buf[i * 4 + 3] = 255;
  }
  const put = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - spec.cx) / spec.rx;
      const dy = (y - spec.cy) / spec.ry;
      if (dx * dx + dy * dy <= 1) put(x, y, spec.skin[0], spec.skin[1], spec.skin[2]);
    }
  }
  // Eyes — dark discs.
  for (const sx of [-1, 1]) {
    const ex = spec.cx + sx * spec.eyeGap / 2;
    for (let y = -spec.eyeR; y <= spec.eyeR; y++) {
      for (let x = -spec.eyeR; x <= spec.eyeR; x++) {
        if (x * x + y * y <= spec.eyeR * spec.eyeR) put(ex + x, spec.eyeY + y, 28, 26, 30);
      }
    }
    // Brow — a dark bar above.
    for (let x = -spec.eyeR - 3; x <= spec.eyeR + 3; x++) {
      for (let y = 0; y < 4; y++) put(ex + x, spec.eyeY - spec.browDrop + y, 46, 34, 26);
    }
  }
  // Nostrils — two dark marks at the nose base, which is what the detector
  // looks for rather than the nose itself.
  for (const sx of [-1, 1]) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 5; x++) {
        put(spec.cx + sx * spec.noseW / 2 - 2 + x, spec.noseY + y, 96, 70, 60);
      }
    }
  }
  // Mouth — redder than skin, so it separates on R-G.
  for (let y = -spec.mouthH / 2; y <= spec.mouthH / 2; y++) {
    for (let x = -spec.mouthW / 2; x <= spec.mouthW / 2; x++) {
      const t = x / (spec.mouthW / 2);
      if (Math.abs(y) <= (spec.mouthH / 2) * (1 - t * t)) {
        put(spec.cx + x, spec.mouthY + y, 196, 92, 96);
      }
    }
  }
  return buf;
}

describe('the skin test', () => {
  it('accepts skin across the tonal range', () => {
    // Every entry has to pass, or the mask finds no face on a dark-skinned
    // player — a failure mode that is invisible to anyone testing on themselves.
    const tones: [number, number, number][] = [
      [255, 224, 196], [232, 190, 160], [198, 150, 118],
      [150, 104, 76], [104, 68, 50], [70, 46, 36],
    ];
    for (const [r, g, b] of tones) {
      expect({ tone: [r, g, b], skin: isSkinPixel({ r, g, b }) })
        .toEqual({ tone: [r, g, b], skin: true });
    }
  });

  it('rejects the things a fixed RGB box lets through', () => {
    for (const [r, g, b] of [[40, 48, 70], [120, 120, 120], [30, 90, 40], [20, 20, 20], [250, 250, 250]]) {
      expect({ c: [r, g, b], skin: isSkinPixel({ r, g, b }) })
        .toEqual({ c: [r, g, b], skin: false });
    }
  });
});

describe('detectFaceAnchors finds what was drawn', () => {
  const a = detectFaceAnchors(render(BASE), W, H)!;

  it('finds a face at all', () => {
    expect(a).toBeTruthy();
  });

  it('puts the axis down the middle', () => {
    expect(Math.abs(a.axisX - BASE.cx)).toBeLessThan(4);
  });

  it('finds both eyes, at the drawn height and separation', () => {
    expect(Math.abs((a.eyeLeft.y + a.eyeRight.y) / 2 - BASE.eyeY)).toBeLessThan(5);
    expect(Math.abs(Math.abs(a.eyeRight.x - a.eyeLeft.x) - BASE.eyeGap)).toBeLessThan(8);
    expect(a.eyeLeft.x).toBeLessThan(a.axisX);
    expect(a.eyeRight.x).toBeGreaterThan(a.axisX);
  });

  it('finds the mouth below the eyes and above the chin', () => {
    expect(a.mouthY).toBeGreaterThan(a.eyeLeft.y);
    expect(Math.abs(a.mouthY - BASE.mouthY)).toBeLessThan(8);
    expect(a.mouthY).toBeLessThan(a.chinY);
  });

  it('finds the chin near the bottom of the face, not the neck', () => {
    expect(Math.abs(a.chinY - (BASE.cy + BASE.ry))).toBeLessThan(14);
  });

  it('finds the brow above the eyes', () => {
    expect(a.browY).toBeLessThan((a.eyeLeft.y + a.eyeRight.y) / 2);
  });

  it('scores a well-formed face as consistent', () => {
    expect(a.quality).toBeGreaterThan(0.6);
  });
});

describe('it declines rather than inventing a face', () => {
  it('returns null on a blank frame', () => {
    const blank = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      blank[i * 4] = 40; blank[i * 4 + 1] = 48; blank[i * 4 + 2] = 70; blank[i * 4 + 3] = 255;
    }
    expect(scanFaceLandmarks(blank, W, H)).toBeNull();
  });

  it('returns null on a frame that is entirely skin-coloured', () => {
    // A close-up of a palm, or a wall the mask happens to like. There is no
    // face here and a confident fit would be worse than none.
    const flat = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      flat[i * 4] = 214; flat[i * 4 + 1] = 168; flat[i * 4 + 2] = 140; flat[i * 4 + 3] = 255;
    }
    expect(scanFaceLandmarks(flat, W, H)).toBeNull();
  });

  it('returns null on a frame too small to resolve anything', () => {
    expect(scanFaceLandmarks(new Uint8Array(16 * 16 * 4), 16, 16)).toBeNull();
  });
});

describe('the fit produces a usable landmark set', () => {
  // Direct, for the same reason `morphsOf` is: the shipped entry point gates on
  // population plausibility and a synthetic ellipse does not pass it.
  const scan = { landmarks: fitLandmarksToAnchors(detectFaceAnchors(render(BASE), W, H)!) };

  it('produces all 68 points, all finite', () => {
    expect(scan.landmarks).toHaveLength(68);
    for (const p of scan.landmarks) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it('keeps the anatomy in order', () => {
    const L = scan.landmarks;
    const eyeY = (L[36].y + L[45].y) / 2;
    expect(eyeY).toBeLessThan(L[33].y);      // eyes above the nose base
    expect(L[33].y).toBeLessThan(L[51].y);   // nose base above the upper lip
    expect(L[51].y).toBeLessThan(L[57].y);   // upper lip above the lower
    expect(L[57].y).toBeLessThan(L[8].y);    // lower lip above the chin
    expect(L[48].x).toBeLessThan(L[54].x);   // mouth corners in order
    expect(L[0].x).toBeLessThan(L[16].x);    // jaw contour left to right
  });

  it('feeds landmarksToMorphs without producing anything out of range', () => {
    const fit = landmarksToMorphs(scan.landmarks);
    for (const [key, value] of Object.entries(fit.morphs)) {
      expect({ key, ok: value >= 0 && value <= 1 }).toEqual({ key, ok: true });
    }
    expect(fit.fitted.length).toBeGreaterThan(8);
  });
});

describe('THE PROPERTY THAT MATTERS — different faces produce different morphs', () => {
  // A similarity transform of the mean shape reproduces the mean face's morphs
  // exactly: every slider 0.5, every scanned character identical. These assert
  // the fit is anisotropic and per-region, which is the only reason the feature
  // does anything at all.

  // Fits DIRECTLY rather than through `scanFaceLandmarks`, which gates on the
  // population plausibility of the result — and a crude ellipse with disc eyes
  // is not a plausible human face, so the gate rejects every fixture in this
  // file. That is the gate behaving correctly (see its own tests below); it
  // just means the directional property has to be measured on the fit itself.
  const morphsOf = (spec: FaceSpec) => {
    const anchors = detectFaceAnchors(render(spec), W, H);
    expect(anchors).toBeTruthy();
    return landmarksToMorphs(fitLandmarksToAnchors(anchors!)).morphs;
  };

  const base = morphsOf(BASE);

  it('a wider face reads as a wider face', () => {
    const wide = morphsOf({ ...BASE, rx: BASE.rx * 1.15 });
    expect(wide.faceWidth).toBeGreaterThan(base.faceWidth);
  });

  it('a longer face reads as a longer face', () => {
    const long = morphsOf({ ...BASE, ry: BASE.ry * 1.25, cy: BASE.cy + 8 });
    expect(long.faceLength).toBeGreaterThan(base.faceLength);
  });

  it('wider-set eyes read as wider-set eyes', () => {
    const wide = morphsOf({ ...BASE, eyeGap: BASE.eyeGap * 1.35 });
    expect(wide.eyeSpacing).toBeGreaterThan(base.eyeSpacing);
  });

  it('a wider mouth reads as a wider mouth', () => {
    const wide = morphsOf({ ...BASE, mouthW: BASE.mouthW * 1.5 });
    expect(wide.mouthWidth).toBeGreaterThan(base.mouthWidth);
  });

  it('fuller lips read as fuller lips', () => {
    const full = morphsOf({ ...BASE, mouthH: BASE.mouthH * 2.2 });
    expect(full.lipFullness).toBeGreaterThan(base.lipFullness);
  });

  it('a wider nose reads as a wider nose', () => {
    const wide = morphsOf({ ...BASE, noseW: BASE.noseW * 1.4 });
    expect(wide.noseWidth).toBeGreaterThan(base.noseWidth);
  });

  it('two different faces do not collapse to the same character', () => {
    // The end-to-end statement of the bug this fixes: the old provider returned
    // colour only, so any two people with similar colouring got the same head.
    const other = morphsOf({
      ...BASE, rx: BASE.rx * 1.22, ry: BASE.ry * 0.88,
      eyeGap: BASE.eyeGap * 1.25, mouthW: BASE.mouthW * 1.4, noseW: BASE.noseW * 1.5,
    });
    const moved = Object.keys(base).filter(
      (k) => Math.abs((other as Record<string, number>)[k] - (base as Record<string, number>)[k]) > 0.05,
    );
    expect(moved.length).toBeGreaterThanOrEqual(4);
  });
});

describe('it works on faces that are not centred or not average', () => {
  it('finds an off-centre face', () => {
    const a = detectFaceAnchors(render({ ...BASE, cx: 96 }), W, H);
    expect(a).toBeTruthy();
    expect(Math.abs(a!.axisX - 96)).toBeLessThan(5);
  });

  it('finds a dark-skinned face', () => {
    // The mask, the eye detector and the brow detector all threshold RELATIVE
    // to the face's own skin level for this reason. An absolute cut finds a
    // pupil on a pale face and the whole cheek on a dark one.
    const a = detectFaceAnchors(render({ ...BASE, skin: [92, 60, 46] }), W, H);
    expect(a).toBeTruthy();
    expect(a!.quality).toBeGreaterThan(0.5);
  });
});

describe('the fit is checked against the population before it is accepted', () => {
  /**
   * THE GATE A REAL PHOTOGRAPH FORCED.
   *
   * `anchors.quality` asks whether what was found is SHAPED like a face. On a
   * sunlit portrait with hair framing the face it answered 0.93 — confidently
   * consistent — while `landmarksToMorphs` scored the resulting fit at 0.00,
   * having put fifteen of sixteen morphs on their rails. The anchors agreed
   * with each other and disagreed with every face in the reference population.
   *
   * Only the statistics can catch that, so the fit is now measured against them
   * before it is accepted.
   */
  const MEAN: { x: number; y: number }[] = MEAN_SHAPE.points;

  it('accepts a fit that sits near the population it was measured from', () => {
    // The mean face is, by construction, the most ordinary face there is.
    const fit = landmarksToMorphs(MEAN);
    expect(fit.confidence).toBeGreaterThan(0.25);
  });

  it('rejects a landmark set that describes no real face', () => {
    // Every measurement far out at once is what a bad detection looks like, and
    // what a real face — however unusual — does not.
    const scrambled = MEAN.map((p, i) => ({
      x: p.x * (i % 2 ? 0.35 : 1.9),
      y: p.y * (i % 3 ? 1.7 : 0.4),
    }));
    expect(landmarksToMorphs(scrambled).confidence).toBeLessThan(0.25);
  });

  it('declines the synthetic fixtures, which are not plausible faces either', () => {
    // Stated rather than hidden: an ellipse with disc eyes measures nothing like
    // a human, so the shipped entry point refuses it. The fixtures exercise the
    // MEASUREMENT, which is what they are for; they cannot exercise the gate.
    expect(scanFaceLandmarks(render(BASE), W, H)).toBeNull();
  });
});
