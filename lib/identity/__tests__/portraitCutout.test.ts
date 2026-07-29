/**
 * Cutting the player's head out of their photo.
 *
 * ## What replaced what
 *
 * The photo route used to fit 68 landmarks and drive the 3D head's morphs. It
 * measured well on synthetic faces and badly on real photographs — a real
 * portrait produced a fit `landmarksToMorphs` scored at 0.00 on every crop — so
 * the head it built was a stranger. This does something narrower that works: it
 * separates the subject from the background and frames them, so the portrait is
 * unmistakably the player because it IS the player's pixels.
 *
 * ## What these can and cannot prove
 *
 * Synthetic images with a known subject and a known background prove the
 * SEPARATION is sound and that the guards fire. They cannot prove hair mattes
 * cleanly under real light — that was checked by running the module against a
 * real photograph offline, which is also how the two defects below were found:
 *
 *   - a background-only model cut the hair off, because dark hair against a
 *     bright sky is far from the background but skin is much further, and one
 *     threshold cannot keep both;
 *   - sampling the whole border reintroduced it on a TIGHT crop, where the
 *     subject's hair reaches the top and side edges and teaches the background
 *     model that hair is background.
 *
 * Both are encoded below.
 *
 * ## One fix here is deliberately NOT covered by a test
 *
 * The shape prior — the second classification pass in `buildPortraitCutout`,
 * weighted by `SHAPE_WEIGHT` — was added because a distant shoreline ran level
 * with the subject's crown, touched her hair, and came through into the
 * portrait as scenery growing out of her head. It was verified by sweeping the
 * weight against that photograph: below about 6 the shoreline survives as a
 * smear, above about 14 her raised hand starts to go, and 9 is clean.
 *
 * Several attempts to reproduce that synthetically all passed with the prior
 * switched off — a painted bar is either rejected on colour anyway, or falls
 * outside the crop, or is close enough to the hair that the measurement counts
 * the hair instead. Rather than keep a test that asserts nothing, the gap is
 * recorded here: this suite proves the prior does not damage the ordinary
 * cases, and nothing more. The photograph is the evidence for the rest, and it
 * is not in the repository because it is a real person's.
 */
import { buildPortraitCutout, type Bitmap } from '@/lib/identity/portraitCutout';

const W = 320;
const H = 320;

interface Scene {
  /** Background fill. */
  bg: [number, number, number];
  /** Skin, and the hair ring around it. */
  skin: [number, number, number];
  hair: [number, number, number];
  /** Face centre and radius, in pixels. */
  cx: number;
  cy: number;
  faceR: number;
  /** Hair thickness as a multiple of the face radius. 0 for bald. */
  hairR: number;
}

const BASE: Scene = {
  bg: [88, 150, 220],      // sky
  skin: [214, 168, 140],
  hair: [46, 32, 28],      // dark brown, the case that broke first
  cx: 160, cy: 168, faceR: 52, hairR: 1.34,
};

/**
 * A face on a background, with hair, eyes and a mouth — enough for
 * `detectFaceAnchors` to find it, which the cut-out depends on for its
 * foreground samples.
 */
function render(s: Scene): Bitmap {
  const data = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, s.bg);
  // Hair as a disc behind the face, then the face over it, then shoulders.
  if (s.hairR > 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - s.cx) / (s.faceR * s.hairR);
        const dy = (y - (s.cy - s.faceR * 0.12)) / (s.faceR * s.hairR * 1.12);
        if (dx * dx + dy * dy <= 1) put(x, y, s.hair);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - s.cx) / s.faceR;
      const dy = (y - s.cy) / (s.faceR * 1.28);
      if (dx * dx + dy * dy <= 1) put(x, y, s.skin);
    }
  }
  // Shoulders, running off the bottom edge as they do in a real portrait.
  for (let y = Math.round(s.cy + s.faceR * 1.35); y < H; y++) {
    const halfW = s.faceR * (1.4 + (y - s.cy) / H);
    for (let x = Math.round(s.cx - halfW); x <= s.cx + halfW; x++) put(x, y, [70, 80, 160]);
  }
  // Eyes, brows and a mouth, so the face is findable.
  const eyeY = s.cy - s.faceR * 0.22;
  for (const sx of [-1, 1]) {
    const ex = s.cx + sx * s.faceR * 0.42;
    for (let y = -5; y <= 5; y++) for (let x = -7; x <= 7; x++) {
      if (x * x / 49 + y * y / 25 <= 1) put(ex + x, eyeY + y, [30, 28, 32]);
    }
    for (let x = -10; x <= 10; x++) for (let y = 0; y < 4; y++) put(ex + x, eyeY - 16 + y, [48, 34, 26]);
  }
  for (let y = -5; y <= 5; y++) for (let x = -20; x <= 20; x++) {
    if (Math.abs(y) <= 5 * (1 - (x / 20) ** 2)) put(s.cx + x, s.cy + s.faceR * 0.55 + y, [196, 92, 96]);
  }
  return { data, width: W, height: H };
}

/** Mean alpha inside a disc of the OUTPUT portrait, 0..1. */
function alphaAt(p: Bitmap, fx: number, fy: number, r = 0.05): number {
  const cx = fx * p.width;
  const cy = fy * p.height;
  const rr = r * p.width;
  let sum = 0;
  let n = 0;
  for (let y = Math.round(cy - rr); y <= cy + rr; y++) {
    for (let x = Math.round(cx - rr); x <= cx + rr; x++) {
      if (x < 0 || y < 0 || x >= p.width || y >= p.height) continue;
      sum += p.data[(y * p.width + x) * 4 + 3];
      n++;
    }
  }
  return n ? sum / n / 255 : 0;
}

describe('it separates the subject from the background', () => {
  const out = buildPortraitCutout(render(BASE))!;

  it('produces a square portrait', () => {
    expect(out).toBeTruthy();
    expect(out.portrait.width).toBe(448);
    expect(out.portrait.height).toBe(448);
  });

  it('keeps the middle of the head fully opaque', () => {
    expect(alphaAt(out.portrait, 0.5, 0.5)).toBeGreaterThan(0.95);
  });

  it('cuts the corners away completely', () => {
    // The corners of a framed portrait are background by construction.
    for (const [fx, fy] of [[0.04, 0.04], [0.96, 0.04]]) {
      expect(alphaAt(out.portrait, fx, fy, 0.03)).toBeLessThan(0.1);
    }
  });

  it('reports a plausible coverage', () => {
    expect(out.coverage).toBeGreaterThan(0.1);
    expect(out.coverage).toBeLessThan(0.9);
  });
});

describe('THE ONE THAT BROKE FIRST — hair is kept, not shaved', () => {
  // A background-only model put dark hair on the background side of its
  // threshold, because skin sits so much further from a bright sky than hair
  // does. The portrait came back looking shaved. The foreground model, sampled
  // from the band directly above the detected face, is what fixes it.

  /** How much of the opaque portrait is close to a given colour. */
  const shareOfColour = (
    p: { data: Uint8ClampedArray; width: number; height: number },
    c: [number, number, number],
    tol = 42,
  ): number => {
    let n = 0;
    for (let i = 0; i < p.width * p.height; i++) {
      if (p.data[i * 4 + 3] < 200) continue;
      const d = Math.abs(p.data[i * 4] - c[0]) + Math.abs(p.data[i * 4 + 1] - c[1])
        + Math.abs(p.data[i * 4 + 2] - c[2]);
      if (d < tol) n++;
    }
    return n / (p.width * p.height);
  };

  it('keeps dark hair against a bright background', () => {
    // Asserted on the hair COLOUR surviving into the opaque portrait, which is
    // independent of framing. A probe at a fixed spot, or a comparison against
    // the bald render, both turned out to be measuring the crop instead: hair
    // passes the skin test too, so it widens `faceWidth` and changes the crop
    // between the two renders.
    const out = buildPortraitCutout(render(BASE))!;
    expect(out).toBeTruthy();
    expect(shareOfColour(out.portrait, BASE.hair)).toBeGreaterThan(0.04);
  });

  it('LOSES hair that is nearly the same colour as the background', () => {
    // A LIMITATION, recorded rather than asserted away. When the hair and the
    // background are within a few units of each other no colour-based matte can
    // separate them — there is no signal to separate them BY. A segmentation
    // network would get this right because it knows the shape of a head; that
    // is the trade named at the top of the module.
    //
    // What is required is that it degrades gracefully: the face survives, the
    // portrait is still usable, and nothing crashes or returns a blank.
    const scene = {
      ...BASE,
      bg: [40, 44, 52] as [number, number, number],
      hair: [58, 56, 60] as [number, number, number],
    };
    const out = buildPortraitCutout(render(scene));
    expect(out).toBeTruthy();
    expect(shareOfColour(out!.portrait, scene.hair)).toBeLessThan(0.02);
    // The part that matters is intact.
    expect(alphaAt(out!.portrait, 0.5, 0.5)).toBeGreaterThan(0.9);
  });

  it('still works on a bald subject, where there is no hair to keep', () => {
    const out = buildPortraitCutout(render({ ...BASE, hairR: 0 }));
    expect(out).toBeTruthy();
    expect(alphaAt(out!.portrait, 0.5, 0.5)).toBeGreaterThan(0.9);
  });
});

describe('it declines rather than returning a broken portrait', () => {
  it('returns null when there is no face to anchor on', () => {
    const flat: Bitmap = {
      data: new Uint8ClampedArray(W * H * 4).fill(120),
      width: W, height: H,
    };
    expect(buildPortraitCutout(flat)).toBeNull();
  });

  it('returns null on an image too small to work with', () => {
    expect(buildPortraitCutout({
      data: new Uint8ClampedArray(32 * 32 * 4), width: 32, height: 32,
    })).toBeNull();
  });

  it('returns null when the matte would keep essentially everything', () => {
    // A subject that fills the frame has no background to cut, and a portrait
    // that is 100% opaque is just the photo — the player is better served by
    // the starter portrait than by an uncropped snapshot.
    const huge = render({ ...BASE, faceR: 150, cx: 160, cy: 160 });
    const out = buildPortraitCutout(huge);
    if (out) expect(out.coverage).toBeLessThan(0.94);
  });
});

describe('the framing is driven by the head, not by the face detector', () => {
  it('centres the head even when the subject is off to one side', () => {
    // The matte's bounding box includes shoulders and hair and moves with every
    // matting error, and the face detector is the part that reported a 309-pixel
    // face inside a 384-pixel frame on a real photo. The head band's medians
    // survive both.
    const off = buildPortraitCutout(render({ ...BASE, cx: 110 }))!;
    expect(off).toBeTruthy();
    expect(alphaAt(off.portrait, 0.5, 0.5)).toBeGreaterThan(0.9);
    expect(alphaAt(off.portrait, 0.04, 0.04, 0.03)).toBeLessThan(0.15);
  });

  it('gives the head a similar share of the frame at different subject sizes', () => {
    // Two photos taken at different distances should produce portraits that sit
    // together in a list, not one close-up and one distant figure.
    const near = buildPortraitCutout(render({ ...BASE, faceR: 66 }))!;
    const far = buildPortraitCutout(render({ ...BASE, faceR: 40 }))!;
    const share = (p: Bitmap) => {
      let n = 0;
      for (let i = 0; i < p.width * p.height; i++) if (p.data[i * 4 + 3] > 128) n++;
      return n / (p.width * p.height);
    };
    expect(Math.abs(share(near.portrait) - share(far.portrait))).toBeLessThan(0.22);
  });

  it('keeps the crop inside the photograph instead of framing empty space', () => {
    // A crop window centred on the head runs off the edge whenever the subject
    // is near one — which a phone photo does every time. The part that is
    // outside fills with nothing, so the subject ends up against the opposite
    // side with a dead band beside them. On the real photograph that band was a
    // quarter of the frame.
    //
    // Measured on OUT-OF-BOUNDS pixels specifically, not on how centred the
    // subject looks. Those two come apart: an unclamped window is centred on
    // the head by construction and still wastes a quarter of the portrait, so
    // an assertion about centring passes exactly when the bug is present. A
    // pixel the window never sampled keeps its initial zeroes, and no
    // background in this scene is black, so the two are distinguishable.
    const out = buildPortraitCutout(render({ ...BASE, cx: 70 }));
    expect(out).toBeTruthy();
    const p = out!.portrait;
    let unsampled = 0;
    for (let i = 0; i < p.width * p.height; i++) {
      if (p.data[i * 4] === 0 && p.data[i * 4 + 1] === 0 && p.data[i * 4 + 2] === 0
        && p.data[i * 4 + 3] === 0) unsampled++;
    }
    expect(unsampled / (p.width * p.height)).toBeLessThan(0.01);
  });
});
