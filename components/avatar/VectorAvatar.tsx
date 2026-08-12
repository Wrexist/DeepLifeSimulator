/**
 * The avatar renderer.
 *
 * ── How the 2.5D look is built ────────────────────────────────────────────
 * There is one key light, fixed at the upper left, and every technique below
 * exists to serve it consistently:
 *
 *   1. Form shading   — each mass (head, hair, neck, clothing) is filled with
 *                       a gradient running light → base → shadow along the
 *                       light direction, never a flat colour.
 *   2. Contact shadow — where one layer sits on another (hair on forehead,
 *                       jaw on neck) a soft band is drawn at the seam. This is
 *                       what separates the layers into depth instead of
 *                       reading as a sticker collage.
 *   3. Rim light      — a thin crescent on the lower-right edge, opposite the
 *                       key. It is the single cheapest cue that the head is a
 *                       volume, and it is what stops a flat vector face from
 *                       looking like clip art.
 *   4. Plane breaks   — the nose is drawn as a shaded side plane plus a lit
 *                       ridge rather than an outline, so it reads as
 *                       projecting rather than as a line on a surface.
 *
 * ── No SVG filters ────────────────────────────────────────────────────────
 * `react-native-svg` filter support differs across iOS, Android and the web
 * target, so nothing here uses `feGaussianBlur`. Every soft edge is a gradient
 * whose outer stop fades to zero opacity, which renders identically everywhere.
 *
 * ── Gradient ids must be unique per instance ──────────────────────────────
 * On the web target `<Defs>` ids land in one shared document scope, so two
 * avatars on screen with the same id would silently share the first one's
 * gradients — the family tree and the contacts list both render many at once.
 * `useId()` namespaces every id per component instance.
 */
import React, { useId, useMemo } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  ACCESSORIES,
  BROW_SHAPES,
  FACE_SHAPES,
  FACIAL_HAIR,
  HAIR_STYLES,
  MOUTH_SHAPES,
  NOSE_SHAPES,
  EYE_SHAPES,
  ANCHORS,
  VIEWBOX,
} from '@/lib/avatar/features';
import {
  CLOTHING,
  EYE_COLORS,
  HAIR_COLORS,
  LIP_TINTS,
  SCLERA,
  SKIN_TONES,
  darken,
  greyRamp,
  lighten,
  lineColorFor,
} from '@/lib/avatar/palette';
import { ageEffects, recessionOffset } from '@/lib/avatar/aging';
import { normalizeAvatar } from '@/lib/avatar/random';
import type { AvatarConfig, AvatarSex } from '@/lib/avatar/types';

export interface VectorAvatarProps {
  config: AvatarConfig;
  sex: AvatarSex;
  /** Drives greying, recession, wrinkles and child proportions. */
  age?: number;
  /** Rendered width and height in px. */
  size?: number;
  /** Draws the soft circular backdrop plate behind the head. */
  backdrop?: boolean;
  /** Clips the whole avatar to a circle — for list rows and small chips. */
  circular?: boolean;
}

function VectorAvatarImpl({
  config,
  sex,
  age = 25,
  size = 120,
  backdrop = true,
  circular = false,
}: VectorAvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${name}${uid}`;

  const safe = useMemo(() => normalizeAvatar(config), [config]);
  const effects = useMemo(() => ageEffects(age, sex), [age, sex]);

  const skin = SKIN_TONES[safe.skinTone];
  const hairBase = HAIR_COLORS[safe.hairColor];
  const hair = useMemo(() => greyRamp(hairBase, effects.greying), [hairBase, effects.greying]);
  const iris = EYE_COLORS[safe.eyeColor];
  const lips = LIP_TINTS[safe.skinTone];
  const cloth = CLOTHING[(safe.skinTone + safe.faceShape + safe.hairStyle) % CLOTHING.length];
  const line = lineColorFor(skin);

  const face = FACE_SHAPES[safe.faceShape];
  const hairStyle = HAIR_STYLES[safe.hairStyle];
  const brow = BROW_SHAPES[safe.browShape];
  const eye = EYE_SHAPES[safe.eyeShape];
  const nose = NOSE_SHAPES[safe.noseShape];
  const mouth = MOUTH_SHAPES[safe.mouthShape];

  // Facial hair is a grown-adult, masculine feature. Rendering it on a child
  // or a feminine face reads as a bug, not as customization.
  const beard =
    sex === 'male' && age >= 16 && safe.facialHair > 0 ? FACIAL_HAIR[safe.facialHair] : null;
  const accessory = safe.accessory > 0 ? ACCESSORIES[safe.accessory] : null;

  const recession = recessionOffset(effects, hairStyle.coverage, hairStyle.noRecede);

  // Children: a proportionally larger head on smaller shoulders, with the
  // features sitting lower on the face. Together these read as young without
  // needing a parallel catalog of child geometry.
  const headTransform = `translate(100 165) scale(${effects.headScale}) translate(-100 -165)`;
  const featureShift = effects.babyness * 11;
  const featureScale = 1 - effects.babyness * 0.11;
  const featureTransform = `translate(100 ${110 + featureShift}) scale(${featureScale}) translate(-100 -110)`;

  const wrinkleOpacity = effects.wrinkles * 0.32;

  const body = (
    <>
      <Defs>
        {/* Head form: key light from the upper left, falling off to the core
            shadow at the lower right. */}
        <RadialGradient id={id('skin')} cx="35%" cy="26%" r="82%">
          <Stop offset="0" stopColor={skin.light} />
          <Stop offset="0.45" stopColor={skin.base} />
          <Stop offset="1" stopColor={skin.shadow} />
        </RadialGradient>

        {/* Core shadow, fading to nothing so it has no visible edge. */}
        <LinearGradient id={id('core')} x1="0.15" y1="0.1" x2="0.95" y2="0.95">
          <Stop offset="0.35" stopColor={skin.shadow} stopOpacity="0" />
          <Stop offset="1" stopColor={darken(skin.shadow, 0.28)} stopOpacity="0.4" />
        </LinearGradient>

        {/* Rim light, opposite the key. */}
        <LinearGradient id={id('rim')} x1="1" y1="0.9" x2="0.35" y2="0.25">
          <Stop offset="0" stopColor={lighten(skin.light, 0.45)} stopOpacity="0.85" />
          <Stop offset="0.55" stopColor={lighten(skin.light, 0.3)} stopOpacity="0" />
        </LinearGradient>

        {/* Hair mass. */}
        <LinearGradient id={id('hair')} x1="0.18" y1="0.05" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor={hair.light} />
          <Stop offset="0.42" stopColor={hair.base} />
          <Stop offset="1" stopColor={hair.shadow} />
        </LinearGradient>
        <LinearGradient id={id('hairBack')} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={hair.base} />
          <Stop offset="1" stopColor={hair.shadow} />
        </LinearGradient>

        {/* The shadow the hair casts onto the forehead. */}
        <LinearGradient id={id('hairCast')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={darken(skin.shadow, 0.35)} stopOpacity="0.5" />
          <Stop offset="1" stopColor={darken(skin.shadow, 0.35)} stopOpacity="0" />
        </LinearGradient>

        {/* The shadow the jaw casts onto the neck — this is what puts the head
            in front of the body rather than beside it. */}
        <LinearGradient id={id('neckCast')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={darken(skin.shadow, 0.45)} stopOpacity="0.75" />
          <Stop offset="1" stopColor={darken(skin.shadow, 0.45)} stopOpacity="0" />
        </LinearGradient>

        <LinearGradient id={id('neck')} x1="0.2" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={skin.base} />
          <Stop offset="1" stopColor={skin.shadow} />
        </LinearGradient>

        <LinearGradient id={id('cloth')} x1="0.2" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={cloth.light} />
          <Stop offset="0.45" stopColor={cloth.base} />
          <Stop offset="1" stopColor={cloth.shadow} />
        </LinearGradient>

        {/* Iris: darker at the top where the lid shades it, lit at the bottom
            where light bounces through. Flat irises are a dead giveaway. */}
        <RadialGradient id={id('iris')} cx="50%" cy="68%" r="62%">
          <Stop offset="0" stopColor={iris.light} />
          <Stop offset="0.6" stopColor={iris.base} />
          <Stop offset="1" stopColor={iris.shadow} />
        </RadialGradient>

        <RadialGradient id={id('sclera')} cx="42%" cy="30%" r="80%">
          <Stop offset="0" stopColor={SCLERA.light} />
          <Stop offset="0.65" stopColor={SCLERA.base} />
          <Stop offset="1" stopColor={SCLERA.shadow} />
        </RadialGradient>

        <LinearGradient id={id('lower')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lips.base} />
          <Stop offset="1" stopColor={lips.light} />
        </LinearGradient>

        <RadialGradient id={id('backdrop')} cx="50%" cy="42%" r="62%">
          <Stop offset="0" stopColor="#243049" />
          <Stop offset="1" stopColor="#151C2C" />
        </RadialGradient>

        <ClipPath id={id('headClip')}>
          <Path d={face.path} />
        </ClipPath>
        {/* Both eyes clip against the same geometry; the right eye's group is
            mirrored, so the clip lands correctly in its local space. Hoisted
            here rather than declared inside the mirrored group because nested
            <Defs> under a transform resolves inconsistently on Android. */}
        <ClipPath id={id('eyeClipL')}>
          <Path d={eye.path} />
        </ClipPath>
        <ClipPath id={id('eyeClipR')}>
          <Path d={eye.path} />
        </ClipPath>
        <ClipPath id={id('circleClip')}>
          <Circle cx={100} cy={104} r={100} />
        </ClipPath>
      </Defs>

      {backdrop && (
        <Rect x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} fill={`url(#${id('backdrop')})`} />
      )}

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <G>
        {/* Shoulders. Drawn before the neck so the neck overlaps them. */}
        <Path
          d="M100 168 C128 168 152 178 164 196 C170 206 172 214 172 220 L28 220 C28 214 30 206 36 196 C48 178 72 168 100 168 Z"
          fill={`url(#${id('cloth')})`}
        />
        {/* Collar shadow, seating the neck into the clothing. */}
        <Path
          d="M78 170 C86 182 92 188 100 188 C108 188 114 182 122 170 C114 176 108 178 100 178 C92 178 86 176 78 170 Z"
          fill={darken(cloth.shadow, 0.35)}
          opacity={0.7}
        />
        <Path d="M83 136 L117 136 C117 152 120 165 129 174 L71 174 C80 165 83 152 83 136 Z" fill={`url(#${id('neck')})`} />
        {/* Jaw shadow on the neck. */}
        <Path d="M83 136 L117 136 L117 162 L83 162 Z" fill={`url(#${id('neckCast')})`} />
      </G>

      {/* ── Hair behind the head ─────────────────────────────────────────── */}
      {hairStyle.back ? (
        <G transform={headTransform}>
          <Path d={hairStyle.back} fill={`url(#${id('hairBack')})`} />
        </G>
      ) : null}

      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <G transform={headTransform}>
        {/* Ears, behind the head so only the outer part shows. */}
        <Ellipse cx={ANCHORS.earLeft.x} cy={ANCHORS.earLeft.y} rx="6.5" ry="9.5" fill={skin.base} />
        <Ellipse cx={ANCHORS.earLeft.x + 1} cy={ANCHORS.earLeft.y} rx="3.1" ry="4.8" fill={skin.shadow} opacity={0.55} />
        <Ellipse cx={ANCHORS.earRight.x} cy={ANCHORS.earRight.y} rx="6.5" ry="9.5" fill={skin.shadow} />
        <Ellipse cx={ANCHORS.earRight.x - 1} cy={ANCHORS.earRight.y} rx="3.1" ry="4.8" fill={darken(skin.shadow, 0.2)} opacity={0.5} />

        <Path d={face.path} fill={`url(#${id('skin')})`} />

        {/* Everything from here on is clipped to the head so no shading spills
            past the silhouette. */}
        <G clipPath={`url(#${id('headClip')})`}>
          <Rect x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} fill={`url(#${id('core')})`} />
          {/* Rim light along the lower-right edge. */}
          <Rect x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} fill={`url(#${id('rim')})`} />
          {/* Hair's cast shadow on the forehead, lifted with the hairline. */}
          {hairStyle.front ? (
            <Rect x="30" y={46 + recession} width="140" height="30" fill={`url(#${id('hairCast')})`} />
          ) : null}

          {/* ── Wrinkles ──────────────────────────────────────────────────
              Drawn as strokes at an opacity driven by age, so they fade in
              rather than appearing on a birthday. */}
          {wrinkleOpacity > 0.02 ? (
            <G stroke={line} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity={wrinkleOpacity}>
              {/* Forehead */}
              <Path d={`M74 ${74 + recession} C86 ${70 + recession} 114 ${70 + recession} 126 ${74 + recession}`} />
              <Path d={`M78 ${81 + recession} C88 ${77 + recession} 112 ${77 + recession} 122 ${81 + recession}`} />
              {/* Nasolabial folds — the fold that most reads as age. */}
              <Path d="M86 116 C82 124 82 132 86 138" />
              <Path d="M114 116 C118 124 118 132 114 138" />
              {/* Crow's feet */}
              <Path d="M58 92 L64 94 M58 97 L64 98 M58 102 L64 101" strokeWidth="0.9" />
              <Path d="M142 92 L136 94 M142 97 L136 98 M142 102 L136 101" strokeWidth="0.9" />
              {/* Under-eye */}
              <Path d="M66 108 C71 112 81 112 86 108" strokeWidth="0.9" />
              <Path d="M134 108 C129 112 119 112 114 108" strokeWidth="0.9" />
            </G>
          ) : null}

          <G transform={featureTransform}>
            {/* ── Brows ─────────────────────────────────────────────────── */}
            <G fill={hair.shadow} opacity={sex === 'male' ? 0.95 : 0.82}>
              <Path d={brow.path} />
              <Path d={brow.path} transform="translate(200 0) scale(-1 1)" />
            </G>

            {/* ── Eyes ──────────────────────────────────────────────────── */}
            {[false, true].map((mirrored) => {
              const t = mirrored ? 'translate(200 0) scale(-1 1)' : undefined;
              const cx = ANCHORS.eyeLeft.x;
              const cy = ANCHORS.eyeLeft.y;
              const clip = mirrored ? id('eyeClipR') : id('eyeClipL');
              return (
                <G key={mirrored ? 'r' : 'l'} transform={t}>
                  <Path d={eye.path} fill={`url(#${id('sclera')})`} />
                  <G clipPath={`url(#${clip})`}>
                    {/* Iris sits slightly high in the opening, as a real eye does. */}
                    <Circle cx={cx} cy={cy - 0.5} r={eye.iris} fill={`url(#${id('iris')})`} />
                    <Circle cx={cx} cy={cy - 0.5} r={eye.iris} fill="none" stroke={darken(iris.shadow, 0.4)} strokeWidth="0.9" />
                    <Circle cx={cx} cy={cy - 0.5} r={eye.iris * 0.45} fill="#120E14" />
                    {/* Specular highlight, upper-left to match the key light. */}
                    <Circle cx={cx - eye.iris * 0.38} cy={cy - eye.iris * 0.55} r={eye.iris * 0.28} fill="#FFFFFF" opacity="0.9" />
                    <Circle cx={cx + eye.iris * 0.3} cy={cy + eye.iris * 0.35} r={eye.iris * 0.14} fill="#FFFFFF" opacity="0.35" />
                    {/* Upper-lid shadow across the top of the eyeball. */}
                    <Rect
                      x={cx - 16}
                      y={cy - 14}
                      width="32"
                      height={10 + eye.lidDrop * 8}
                      fill={darken(skin.shadow, 0.3)}
                      opacity="0.3"
                    />
                  </G>
                  {/* Lash line — heavier on feminine faces. */}
                  <Path
                    d={eye.path}
                    fill="none"
                    stroke={line}
                    strokeWidth={sex === 'female' ? 1.9 : 1.4}
                    strokeLinecap="round"
                  />
                </G>
              );
            })}

            {/* ── Nose ──────────────────────────────────────────────────── */}
            <Path d={nose.shade} fill={darken(skin.shadow, 0.12)} opacity="0.85" />
            <Path d={nose.light} fill={skin.light} opacity="0.6" />
            <Path d={nose.nostrils} fill={darken(skin.shadow, 0.45)} opacity="0.75" />

            {/* ── Mouth ─────────────────────────────────────────────────── */}
            <Path d={mouth.upper} fill={lips.shadow} />
            <Path d={mouth.lower} fill={`url(#${id('lower')})`} />
            {/* Lower-lip highlight — the wettest point on the face. */}
            <Ellipse cx="100" cy="135" rx="6" ry="1.6" fill="#FFFFFF" opacity="0.18" />
          </G>

          {/* ── Facial hair ───────────────────────────────────────────────
              Inside the head clip so a full beard follows the jaw silhouette
              rather than hanging past it. */}
          {beard ? <Path d={beard.path} fill={hair.shadow} opacity={beard.opacity} /> : null}
        </G>

        {/* ── Hair over the skull ───────────────────────────────────────── */}
        {hairStyle.front ? (
          <G transform={recession ? `translate(0 ${-recession})` : undefined}>
            <Path d={hairStyle.front} fill={`url(#${id('hair')})`} />
            {/* Specular band. Without it the hair reads as a solid cap. */}
            <Path
              d="M62 58 C74 46 92 42 108 44"
              fill="none"
              stroke={hair.light}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.22"
            />
          </G>
        ) : null}

        {/* ── Accessory ─────────────────────────────────────────────────── */}
        {accessory ? (
          <G>
            {accessory.lens ? <Path d={accessory.lens} fill="#BFD8EA" opacity="0.16" /> : null}
            <Path
              d={accessory.path}
              fill="none"
              stroke="#2B3242"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={accessory.path}
              fill="none"
              stroke={lighten('#2B3242', 0.35)}
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.5"
            />
          </G>
        ) : null}
      </G>
    </>
  );

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}>
      {circular ? <G clipPath={`url(#${id('circleClip')})`}>{body}</G> : body}
    </Svg>
  );
}

/**
 * Memoized: the family tree and contacts list mount dozens of these at once,
 * and a re-render of the parent would otherwise rebuild every gradient.
 */
const VectorAvatar = React.memo(VectorAvatarImpl);
VectorAvatar.displayName = 'VectorAvatar';

export default VectorAvatar;
