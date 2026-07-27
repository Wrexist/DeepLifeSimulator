/**
 * The two heads have to land in the same place.
 *
 * `createFaceScene` draws the procedural head immediately on every open of the
 * creator so the canvas is never blank, then swaps in the scanned head once
 * ~1 MB of glTF has parsed. That makes the procedural head something every
 * player sees every time, not a rare fallback — and if the two are framed
 * differently, the swap is a visible pop on the most-viewed screen in the
 * chapter.
 *
 * They were. The scanned head scaled its longest axis to 2.45 and pinned the
 * crown at 1.10; the procedural head was added to the scene raw, landing at
 * about 80% of the size and lower down, with a crown that drifted between 0.93
 * and 1.07 as the face morphs changed its height.
 */
import { CROWN_Y, FRAME_SPAN, crownAfterFraming, frameHead, type Bounds } from '../gl/headFraming';

const ROOT_Y = 0.12;

/** Roughly the procedural head at neutral: 1.32 x 1.92 x 1.98. */
const procedural: Bounds = { min: [-0.66, -1.02, -0.98], max: [0.66, 0.90, 1.00] };
/** Roughly the scanned head in its own units — an order of magnitude larger. */
const scanned: Bounds = { min: [-12.4, -16.9, -11.2], max: [12.4, 16.9, 11.2] };

describe('frameHead', () => {
  it('puts the crown at the same height whatever the head', () => {
    expect(crownAfterFraming(procedural, ROOT_Y)).toBeCloseTo(CROWN_Y, 6);
    expect(crownAfterFraming(scanned, ROOT_Y)).toBeCloseTo(CROWN_Y, 6);
  });

  it('scales both heads to the same span', () => {
    const span = (b: Bounds) => {
      const f = frameHead(b, ROOT_Y);
      return Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * f.scale;
    };
    expect(span(procedural)).toBeCloseTo(FRAME_SPAN, 6);
    expect(span(scanned)).toBeCloseTo(FRAME_SPAN, 6);
  });

  it('holds the crown still when a morph changes the head\'s height', () => {
    // The drift that made the head bob up and down under the sliders. A face
    // half a unit taller must not sit half a unit higher in frame.
    const taller: Bounds = { min: procedural.min, max: [0.66, 1.40, 1.00] };
    const shorter: Bounds = { min: procedural.min, max: [0.66, 0.60, 1.00] };
    expect(crownAfterFraming(taller, ROOT_Y)).toBeCloseTo(CROWN_Y, 6);
    expect(crownAfterFraming(shorter, ROOT_Y)).toBeCloseTo(CROWN_Y, 6);
  });

  it('centres horizontally and in depth', () => {
    const offset: Bounds = { min: [-0.2, -1.0, 0.4], max: [1.1, 0.9, 1.6] };
    const f = frameHead(offset, ROOT_Y);
    const centreX = (offset.min[0] + offset.max[0]) / 2;
    const centreZ = (offset.min[2] + offset.max[2]) / 2;
    expect(f.position[0] + centreX * f.scale).toBeCloseTo(0, 6);
    expect(f.position[2] + centreZ * f.scale).toBeCloseTo(0, 6);
  });

  it('survives a degenerate box instead of dividing by zero', () => {
    const f = frameHead({ min: [0, 0, 0], max: [0, 0, 0] }, ROOT_Y);
    expect(Number.isFinite(f.scale)).toBe(true);
    expect(f.position.every(Number.isFinite)).toBe(true);
  });
});
