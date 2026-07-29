/**
 * The procedural head's skin shader patch — brows, freckles, undertone, makeup.
 *
 * ## Why it is not inline in `FaceRenderer`
 *
 * Because nothing had ever rendered it. The preview harness draws this head's
 * GEOMETRY with a hand-written software rasteriser and reimplements the brow
 * tint in its own shading code, so the app's actual GLSL for this path had never
 * been through a compiler, let alone looked at. That is the same gap that let
 * the scanned head's hair table lose twenty-three styles: the thing that
 * verifies was not the thing that ships.
 *
 * Kept as strings with no three import so `scripts/procedural-harness.html` can
 * be handed exactly what the app installs, the way the hair table and the
 * proportion transform already are.
 *
 * ## Freckles
 *
 * `blemishes` is randomised, inherited from both parents and increased with age,
 * and on this head it did nothing at all — it was read only by the scanned
 * head's shader. The reason recorded for leaving it that way was that a 9.4k
 * mesh cannot carry freckle-frequency detail in a per-vertex weight, which is
 * true and was the wrong conclusion: eyebrows needed a per-vertex weight because
 * their SHAPE is geometry, and freckles need none because their shape is noise.
 *
 * Hashed on position rather than UV — this mesh has none — and cut to the front
 * of the face, since freckles land on the cheeks and nose rather than the nape.
 */

/** Declared at `#include <common>` in the vertex shader. */
export const SKIN_VERT_COMMON =
  'attribute float brow;\nvarying float vBrow;\nvarying vec3 vSkinPos;\n'
  + 'attribute float lip;\nattribute float lid;\nattribute float cheek;\n'
  + 'varying float vLip;\nvarying float vLid;\nvarying float vCheek;\n';

/** Appended to `#include <begin_vertex>`. */
export const SKIN_VERT_BODY =
  '\nvBrow = brow;\nvSkinPos = position;\nvLip = lip;\nvLid = lid;\nvCheek = cheek;\n';

/** Declared at `#include <common>` in the fragment shader. */
export const SKIN_FRAG_COMMON = [
  'uniform vec3 uBrowColor;',
  'uniform float uBlemish;',
  // 0.5 neutral on both. Thickness scales the baked brow field before it is
  // used as a mix weight; undertone tilts the skin between pink and gold.
  'uniform float uBrowThickness;',
  'uniform float uUndertone;',
  // Makeup. Each strength is 0 by default, so a character wearing none costs
  // three multiplies by zero and looks exactly as they did before makeup
  // existed.
  'uniform vec3 uLipColor;',
  'uniform float uLipStrength;',
  'uniform vec3 uShadowColor;',
  'uniform float uShadowStrength;',
  'uniform float uBlush;',
  'varying float vBrow;',
  'varying vec3 vSkinPos;',
  'varying float vLip;',
  'varying float vLid;',
  'varying float vCheek;',
  // A hash, not a product of sines. Every attempt at scattered detail in this
  // project that used trigonometry came out as a lattice, a corduroy or a
  // herringbone before it was replaced with one of these.
  'float skinHash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }',
].join('\n') + '\n';

/** Appended to `#include <color_fragment>`. */
export const SKIN_FRAG_BODY = [
  '',
  // UNDERTONE, before anything is drawn on top of the skin. A second axis on
  // `skinTone`, which is only a lightness ladder: cool lifts blue and drops
  // red, warm does the reverse.
  //
  // These started at a third of their current size, on the reasoning that this
  // is the difference between two people of the same complexion rather than
  // between two complexions. Rendered as a sweep it was invisible — the three
  // frames were the same face — and an invisible control is not a subtle one,
  // it is a dead one. Blue moves furthest because that is where the pink/gold
  // axis actually lives; green barely moves at all, because it carries most of
  // the perceived lightness and shifting it changes the TONE rather than the
  // undertone.
  'float utone = clamp(uUndertone, 0.0, 1.0) - 0.5;',
  'diffuseColor.r *= 1.0 + utone * 0.17;',
  'diffuseColor.g *= 1.0 + utone * 0.05;',
  'diffuseColor.b *= 1.0 - utone * 0.22;',
  // Eyebrows: a tint toward the hair colour, weighted by the baked brow field.
  //
  // Thickness is a POWER on the field, not a multiply. The field falls off
  // toward the edges of the brow, so raising it to a power moves the contour at
  // which the tint fades out — a thin brow keeps its arch and loses its
  // outside, which is what plucking does. A multiply would instead fade the
  // whole brow toward the skin colour uniformly, which reads as a brow drawn in
  // the wrong colour rather than a thinner one.
  'float bthick = clamp(uBrowThickness, 0.0, 1.0);',
  'float brow = pow(clamp(vBrow, 0.0, 1.0), mix(2.6, 0.45, bthick));',
  'diffuseColor.rgb = mix(diffuseColor.rgb, uBrowColor, brow);',
  // Freckles. Cell noise: one candidate per cell, most cells empty, so they
  // scatter instead of forming a texture. Front of the face only, and never on
  // the brows — a freckle drawn over an eyebrow reads as a gap in it.
  'vec3 fcell = floor(vSkinPos * 26.0);',
  'vec3 flocal = fract(vSkinPos * 26.0) - 0.5;',
  'float fjit = skinHash(fcell) - 0.5;',
  'float fd = length(flocal - fjit * 0.5);',
  'float freckle = smoothstep(0.42, 0.12, fd) * step(0.82, skinHash(fcell + 11.0));',
  'float onFace = smoothstep(-0.1, 0.5, vSkinPos.z) * (1.0 - brow);',
  'diffuseColor.rgb *= 1.0 - 0.30 * clamp(uBlemish, 0.0, 1.0) * freckle * onFace;',
  // MAKEUP, last — it goes on top of the skin, the freckles and the brows, in
  // that order, because that is the order it goes on a face. Painting lipstick
  // before the freckle pass would put freckles on the lipstick.
  //
  // Blush is MULTIPLIED toward its colour rather than mixed to it. Blush is
  // pigment on skin, not paint: mixing at full strength replaces the cheek with
  // a flat disc of colour and loses every bit of shading underneath, which is
  // the single most obvious way to make makeup look like a sticker.
  'float blushW = clamp(uBlush, 0.0, 1.0) * clamp(vCheek, 0.0, 1.0);',
  'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.80, 0.82), blushW * 0.85);',
  // Eyeshadow and lipstick DO mix toward their colour — both are opaque
  // products and a lipstick that only tinted would make every colour in the
  // palette look like the same pale wash on a dark skin tone.
  'diffuseColor.rgb = mix(diffuseColor.rgb, uShadowColor, clamp(uShadowStrength, 0.0, 1.0) * clamp(vLid, 0.0, 1.0) * 0.80);',
  'diffuseColor.rgb = mix(diffuseColor.rgb, uLipColor, clamp(uLipStrength, 0.0, 1.0) * clamp(vLip, 0.0, 1.0));',
].join('\n') + '\n';
