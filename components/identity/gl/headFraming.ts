/**
 * How a head is placed in frame. Shared by both heads, and deliberately free of
 * three so the agreement between them can be asserted in a unit test.
 *
 * ## Why this matters more than it looks
 *
 * The procedural head is not a rare fallback. `createFaceScene` draws it
 * immediately on every open of the creator so the canvas is never blank, then
 * swaps in the scanned head once ~1 MB of glTF has parsed. Every player sees it,
 * every time, for as long as that parse takes — and permanently when the GLB
 * cannot be loaded at all.
 *
 * Until this was shared, the two were framed differently and the swap popped.
 * Measured: the scanned head scales its longest axis to 2.45 and pins the crown
 * at 1.10; the procedural head was added to the scene raw, which put it at about
 * 80% of the size and lower down. Worse, its crown drifted between 0.93 and 1.07
 * with the face morphs, so the head moved up and down in frame while the player
 * dragged sliders.
 *
 * ## Why the crown and not the centre
 *
 * At fov 28 and z 6.2 the frame is ~3.09 units tall, so its top edge is at
 * y = 1.545. Biasing a centred head upward put the crown at 1.60 with the hair
 * above that, and every render sliced the top of the skull off — a haircut whose
 * upper half is never visible reads as a beret. Pinning the crown keeps the face
 * high in frame AND leaves room for the tallest style, and it is what stops the
 * head drifting when a morph changes its height.
 */

/** The span the longest axis of the head is scaled to. */
export const FRAME_SPAN = 2.45;

/** Where the top of the skull sits, in world units. */
export const CROWN_Y = 1.10;

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Framing {
  scale: number;
  position: [number, number, number];
}

/**
 * Where to put a head, given the bounds of its SKIN.
 *
 * The skin's bounds, not the whole object's: including the hair shell would make
 * framing depend on the hairstyle, and by a different amount per cut.
 */
export function frameHead(box: Bounds, rootY: number): Framing {
  const size: [number, number, number] = [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2],
  ];
  const centre: [number, number, number] = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
  const scale = FRAME_SPAN / (Math.max(size[0], size[1], size[2]) || 1);
  return {
    scale,
    position: [
      -centre[0] * scale,
      // `CROWN_Y - box.max * scale`, NOT `CROWN_Y - (box.max - centre) * scale`.
      //
      // The second is what the scanned head used, and it is only correct when
      // the box is vertically centred on the origin — which that head happens to
      // be, so it worked and nobody noticed the dependency. The procedural head
      // is not: its centre sits at -0.06, and reusing the formula put its crown
      // at 1.026 instead of 1.10. Written this way it holds for any box.
      CROWN_Y - box.max[1] * scale - rootY,
      -centre[2] * scale,
    ],
  };
}

/** Where the crown lands on screen for a given framing — what a viewer sees. */
export function crownAfterFraming(box: Bounds, rootY: number): number {
  const f = frameHead(box, rootY);
  return rootY + f.position[1] + box.max[1] * f.scale;
}
