/**
 * Face studio — the character creation screen.
 *
 * ## The preview is live
 *
 * `FaceCanvas` renders the scan-derived head from the genome, so every slider
 * moves the face while the player drags it. This was NOT always true: the screen
 * shipped for a while with a static pool portrait, which meant the player worked
 * 21 real controls while watching an image that could not respond to any of
 * them. The pool artwork survives as the FALLBACK only, for devices that cannot
 * open a GL context — a face beats an empty frame.
 *
 * An earlier note here argued that real-time geometry could not reach the
 * reference design's quality and that pre-rendered layered art was the only
 * route. That call was reversed: the head is now ICT-FaceKit geometry with baked
 * albedo, roughness and normal maps, driven by 21 morphs derived from the scan
 * basis. It is not photoreal and does not claim to be, but it is a real face
 * that answers the controls, which pre-rendered layers never could.
 *
 * ## The sliders drive more than the picture
 *
 * Every control writes to the stored `FaceGenome`, and `facialHarmony` reads
 * that genome to produce the `looks` term in `computePresence` — which feeds
 * dating match odds and interview callbacks. Shaping the face changes how the
 * character is treated, not just how they look.
 *
 * Sliders whose morph the loaded rig cannot drive are HIDDEN rather than shown
 * dead: `binding.unbound` is what makes that possible, and a control that moves
 * nothing is worse than a control that is absent.
 *
 * The screen sits behind `FEATURE_FLAGS.faceCreator3D` until the head ships.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  useWindowDimensions,
  type ViewStyle,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Check, ChevronDown, ChevronUp, Dices, Eye, RotateCcw, Undo2 } from 'lucide-react-native';
import MorphSlider from './MorphSlider';
import FaceCanvas, { type FaceCanvasHandle } from './FaceCanvas';
import {
  EYE_COLORS,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_COLOR_NAMES,
  LIP_COLORS,
  LIP_COLOR_NAMES,
  SKIN_TONE_NAMES,
  EYE_COLOR_NAMES,
  swatchName,
  HAIR_STYLES,
  styleLabel,
  SKIN_TONES,
  randomizeFace,
  type FaceGenome,
  type FaceMorphKey,
  type BodyProfile,
  type FacialHairStyle,
  type HairStyle,
} from '@/lib/identity';
import { listStarterAvatars } from '@/utils/facePool';
import { frameHeightFor, railLayout } from './studioLayout';
import type { RigBinding } from '@/lib/identity';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';

/**
 * Palette — the exact values from the character-creator spec (§2), not the
 * generic app theme.
 *
 * This screen is deliberately its own visual island: the spec calls for a
 * darker background and cooler cards than the rest of the app so the portrait
 * reads as lit, and borrowing the shared theme tokens would quietly drift it
 * back. `docs/character-creator-spec.md` is the source of truth.
 */
const C = {
  bg: '#070A10',
  card: '#121827',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  frame: '#0B111C',
  text: '#FFFFFF',
  sub: 'rgba(255, 255, 255, 0.65)',
  muted: 'rgba(255, 255, 255, 0.38)',
  accent: '#4C8DFF',
  accentSoft: 'rgba(76, 141, 255, 0.16)',
  /** Reserved for premium/randomize affordances (spec §7). */
  gold: '#FFD76B',
  chip: 'rgba(255, 255, 255, 0.05)',
} as const;

/**
 * Slider groups. The first is always open, matching the reference where
 * "Facial structure" is expanded and the rest are collapsed — the point being
 * that the screen must not open as a wall of twenty-four sliders.
 *
 * EVERY morph the rig drives has a home here. Six of them did not: `faceLength`,
 * `chinProtrusion`, `cheekFullness`, `browProtrusion`, `mouthHeight` and
 * `neckThickness` were bound, baked into the asset and reachable by the
 * randomiser and the photo fitter, but had no control — so a player could be
 * handed a face they were unable to adjust. `covers every morph` in
 * sliderGroups.test.ts fails if that happens again.
 *
 * Groups are anatomical rather than balanced by size. "Mouth & more" — a
 * catch-all holding ears and forehead next to lip fullness — is what let the
 * gap hide: a bucket named "more" absorbs anything, including nothing.
 */
const GROUPS: { title: string; morphs: { key: FaceMorphKey; label: string }[] }[] = [
  {
    title: 'Face shape',
    morphs: [
      { key: 'faceWidth', label: 'Width' },
      { key: 'faceLength', label: 'Length' },
      { key: 'jawWidth', label: 'Jaw width' },
      { key: 'jawAngle', label: 'Jaw taper' },
      { key: 'chinLength', label: 'Chin length' },
      { key: 'chinProtrusion', label: 'Chin projection' },
      { key: 'chinCleft', label: 'Chin cleft' },
      { key: 'templeWidth', label: 'Temple width' },
    ],
  },
  {
    title: 'Cheeks & brow',
    morphs: [
      { key: 'cheekboneHeight', label: 'Cheekbone height' },
      { key: 'cheekFullness', label: 'Cheek fullness' },
      { key: 'cheekHollow', label: 'Cheek hollow' },
      { key: 'browHeight', label: 'Brow height' },
      { key: 'browProtrusion', label: 'Brow ridge' },
      { key: 'foreheadSlope', label: 'Forehead slope' },
    ],
  },
  {
    title: 'Eyes',
    morphs: [
      { key: 'eyeSize', label: 'Size' },
      { key: 'eyeSpacing', label: 'Spacing' },
      { key: 'eyeDepth', label: 'Depth' },
      { key: 'eyeTilt', label: 'Tilt' },
    ],
  },
  {
    title: 'Nose',
    morphs: [
      { key: 'noseLength', label: 'Length' },
      { key: 'noseWidth', label: 'Width' },
      { key: 'noseBridge', label: 'Bridge' },
      { key: 'noseTip', label: 'Tip' },
      { key: 'nostrilFlare', label: 'Nostril flare' },
    ],
  },
  {
    title: 'Mouth',
    morphs: [
      { key: 'mouthWidth', label: 'Width' },
      // Measures nose-base to upper-lip, so it is the PHILTRUM, not the
      // opening. Labelled for what it moves rather than for the morph's name:
      // a control called "Mouth height" that shortens the space above the lip
      // is a control the player fights.
      { key: 'mouthHeight', label: 'Upper lip height' },
      { key: 'lipFullness', label: 'Lip fullness' },
      { key: 'lipRatio', label: 'Upper / lower lip' },
      { key: 'philtrumDepth', label: 'Philtrum depth' },
    ],
  },
  {
    title: 'Ears & neck',
    morphs: [
      { key: 'earSize', label: 'Ear size' },
      { key: 'earAngle', label: 'Ear angle' },
      { key: 'neckThickness', label: 'Neck thickness' },
    ],
  },
];


export interface FaceStudioProps {
  genome: FaceGenome;
  onChange: (genome: FaceGenome) => void;
  onDone?: () => void;
  sex?: string;
  age?: number;
  /**
   * Body composition, which the head shader reads for facial fullness.
   *
   * Threaded through because the same character rendered here and rendered in
   * the game should be the same character: without it the creator shows a face
   * at neutral weight and the profile screen shows one that is not.
   */
  body?: BodyProfile;
  /**
   * The rig this creator is driving, from `bindGenomeToRig`.
   *
   * Route A (preset heads) binds almost nothing, because a preset's shape is
   * baked in — so every facial-structure slider would be a control the player
   * drags while nothing moves. Passing the binding lets the screen HIDE those
   * rather than ship them dead, which is the whole reason `morphBinding`
   * reports `unbound` instead of failing silently.
   *
   * Omit it and every slider shows — correct for route B, where an artist has
   * authored a shape key for each one.
   */
  binding?: RigBinding;
  /** Route A: the preset faces the player chooses between. */
  presets?: { id: string; source: ImageSourcePropType }[];
  selectedPresetId?: string;
  onSelectPreset?: (id: string) => void;
  /** Shown as "Step N of total" when provided. */
  step?: number;
  totalSteps?: number;
  title?: string;
  subtitle?: string;
  doneLabel?: string;
  /**
   * Rendered inside the preview frame when GL is unavailable.
   *
   * Callers that already have a portrait for this character should pass it —
   * `FaceCreatorModal` accepted a `fallback` for months and dropped it on the
   * floor, so a device without GL fell back to a random pool face instead of
   * the avatar the player had picked two screens earlier.
   */
  fallback?: React.ReactNode;
  /**
   * Handle on the live preview, so the caller can snapshot the head the player
   * actually built.
   *
   * The studio owns the canvas but not the decision about what gets persisted —
   * `FaceCreatorModal` does. Without this the modal had no way to reach the
   * framebuffer, and it passed `null` unconditionally: the preview was live, the
   * sliders worked, and the portrait was never captured.
   */
  canvasRef?: React.Ref<FaceCanvasHandle>;
}

export default function FaceStudio({
  genome,
  onChange,
  onDone,
  sex = 'random',
  age = 18,
  body,
  binding,
  presets,
  selectedPresetId,
  onSelectPreset,
  step,
  canvasRef,
  totalSteps = 4,
  title = 'Build your face',
  subtitle = "Create a face that's uniquely yours.",
  doneLabel = 'Use this face',
  fallback,
}: FaceStudioProps): React.JSX.Element {
  // Only offer sliders the rig can actually move. A group whose every morph is
  // unbound is dropped entirely rather than rendered with dead controls — an
  // inert slider is worse than an absent one, because the player assumes their
  // input did something and cannot tell that it did not.
  const groups = useMemo(() => {
    if (!binding) return GROUPS;
    const dead = new Set<string>(binding.unbound);
    return GROUPS
      .map((g) => ({ ...g, morphs: g.morphs.filter((m) => !dead.has(m.key)) }))
      .filter((g) => g.morphs.length > 0);
  }, [binding]);

  const [openGroup, setOpenGroup] = useState<string | null>(GROUPS[0].title);
  const rollRef = useRef(0);
  const [portraitIndex, setPortraitIndex] = useState(0);

  const portraits = useMemo(() => listStarterAvatars(sex, age), [sex, age]);

  /**
   * THE SEAM. Everything else on this screen is final; only this changes when
   * the layered portrait pipeline lands. It will become a stack of <Image>
   * layers (base skin-tone portrait + tinted hair + facial hair) driven by the
   * genome, rather than a single pool image.
   */
  const portrait: ImageSourcePropType | undefined =
    portraits[portraitIndex % Math.max(1, portraits.length)]?.source;

  /**
   * Undo history.
   *
   * Randomize replaces the WHOLE genome, so without this a player who liked
   * their face and tapped the dice once more had no way back to it — the single
   * most likely way to lose work on this screen.
   *
   * A ref plus a counter rather than state holding the array: the array is only
   * ever read inside callbacks, and keeping it in state would re-render every
   * slider on every push.
   */
  const historyRef = useRef<FaceGenome[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const pushHistory = useCallback(() => {
    // Bounded. An unbounded stack on a screen the player can sit on for minutes
    // holds every intermediate genome alive for the session.
    historyRef.current = [...historyRef.current.slice(-19), genome];
    setUndoDepth(historyRef.current.length);
  }, [genome]);

  const undo = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    haptic.light();
    historyRef.current = historyRef.current.slice(0, -1);
    setUndoDepth(historyRef.current.length);
    onChange(prev);
  }, [onChange]);

  /**
   * The face as it was when this screen opened, for hold-to-compare.
   *
   * Captured once. Comparing against the previous *edit* would be useless —
   * after a slider drag that is a face a hair's breadth away.
   */
  const baselineRef = useRef<FaceGenome>(genome);
  const [comparing, setComparing] = useState(false);

  const randomize = useCallback(() => {
    haptic.medium();
    pushHistory();
    rollRef.current += 1;
    onChange(randomizeFace(`studio-${rollRef.current}-${Date.now()}`, { sex }));
    setPortraitIndex((i) => i + 1);
  }, [onChange, sex, pushHistory]);

  const reset = useCallback(() => {
    haptic.light();
    pushHistory();
    const morphs = { ...genome.morphs };
    for (const key of Object.keys(morphs) as FaceMorphKey[]) morphs[key] = 0.5;
    onChange({ ...genome, morphs });
  }, [genome, onChange, pushHistory]);

  const setMorph = useCallback(
    (key: FaceMorphKey, value: number) => {
      onChange({ ...genome, morphs: { ...genome.morphs, [key]: value } });
    },
    [genome, onChange],
  );

  // THE PREVIEW IS SIZED OFF SCREEN HEIGHT, NOT WIDTH, and the rail inside it is
  // sized off the frame. Both rules live in `studioLayout.ts` — see the file for
  // why they are arithmetic rather than the two guessed thresholds they replaced,
  // and why the screenshot harness imports them instead of copying them.
  const { height: windowHeight } = useWindowDimensions();
  const frameHeight = frameHeightFor(windowHeight);
  // `scale()` is width-based and the frame is height-based, so the rail's own
  // scaling has to enter the comparison or a wide short screen breaks it.
  const rail = railLayout(frameHeight, scale(100) / 100);
  const railStyle = { gap: scale(rail.gap) };
  const btnStyle = {
    width: scale(rail.button),
    height: scale(rail.button),
    borderRadius: scale(rail.button / 2),
  };
  // Glyph inside the circle, kept at the proportion the full-size button uses
  // (19 of 46) so a compact control reads as the same button, smaller.
  const iconSize = scale(Math.round(rail.button * 0.42));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Step indicator — the reference's progress dashes, which tell the
            player this screen is one stop rather than an open-ended editor. */}
        {typeof step === 'number' ? (
          <View style={styles.stepRow}>
            <View style={styles.dashes}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dash, { backgroundColor: i < step ? C.accent : '#232C3B' }]}
                />
              ))}
            </View>
            <Text style={styles.stepText}>{`Step ${step} of ${totalSteps}`}</Text>
          </View>
        ) : null}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Portrait frame with the actions floated over it, as in the design —
            this keeps Randomize reachable without pushing the face down. */}
        <View style={[styles.frame, { height: frameHeight }]}>
          {/* THE LIVE HEAD.
              This was a static pool portrait, which meant the player dragged
              21 sliders while watching an image that could not respond to any
              of them — the controls were real and the preview was not. The
              pool image survives as the fallback, so a device that cannot open
              a GL context still shows a face rather than an empty frame. */}
          <FaceCanvas
            ref={canvasRef}
            genome={comparing ? baselineRef.current : genome}
            age={age ?? 22}
            body={body}
            interactive
            style={styles.portrait}
            fallback={
              fallback ?? (portrait ? (
                <Image source={portrait} style={styles.portrait} resizeMode="contain" />
              ) : (
                <View style={styles.portrait} />
              ))
            }
          />
          <View style={[styles.actions, railStyle]}>
            <RoundAction icon={Dices} label="Randomize" onPress={randomize} accent size={btnStyle} iconSize={iconSize} showLabel={rail.labels} />
            <RoundAction icon={Undo2} label="Undo" onPress={undo} disabled={undoDepth === 0} size={btnStyle} iconSize={iconSize} showLabel={rail.labels} />
            {/* Press and HOLD. A toggle would need two taps to answer the one
                question it exists for — "is this better than what I started
                with?" — and the answer is only legible while both are in mind. */}
            <RoundAction
              icon={Eye}
              label={comparing ? 'Original' : 'Compare'}
              onPressIn={() => { haptic.light(); setComparing(true); }}
              onPressOut={() => setComparing(false)}
              active={comparing}
              size={btnStyle}
              iconSize={iconSize}
              showLabel={rail.labels}
            />
            <RoundAction icon={RotateCcw} label="Reset" onPress={reset} size={btnStyle} iconSize={iconSize} showLabel={rail.labels} />
          </View>
          {/* The head turns, and nothing said so. A 3D preview that looks like a
              picture gets treated like one — the player never finds the profile
              view, which is where half the sliders (chin projection, nose
              bridge, brow ridge) actually show what they do.

              It also teaches the direction, which is now load-bearing: a
              sideways drag turns the head, a vertical one scrolls the page. It
              is permanent rather than dismiss-on-first-drag for the same reason
              the action buttons keep their labels — and it costs nothing in the
              portrait, since `capture()` snapshots the GL buffer, not this. */}
          <Text style={styles.spinHint}>Drag ↔ to turn</Text>
        </View>

        {presets && presets.length > 0 ? (
          <Card title="Face">
            {/* Route A's primary control. Horizontal, because a grid of ten
                faces would push every other control below the fold on a phone. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.presetRow}>
                {presets.map((preset) => {
                  const active = preset.id === selectedPresetId;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => { haptic.light(); onSelectPreset?.(preset.id); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Face ${preset.id}`}
                      accessibilityState={{ selected: active }}
                      style={[styles.presetTile, active ? styles.presetTileOn : null]}
                    >
                      <Image source={preset.source} style={styles.presetImg} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Card>
        ) : null}

        <Card title="Skin tone">
          <Swatches
            colors={SKIN_TONES}
            names={SKIN_TONE_NAMES}
            selected={genome.skinTone}
            onSelect={(i) => { haptic.light(); onChange({ ...genome, skinTone: i }); }}
          />
        </Card>

        <Card title="Hair style">
          <Chips
            options={HAIR_STYLES as readonly string[]}
            selected={genome.hairStyle}
            onSelect={(v) => { haptic.light(); onChange({ ...genome, hairStyle: v as HairStyle }); }}
          />
        </Card>

        <Card title="Hair color">
          <Swatches
            colors={HAIR_COLORS}
            names={HAIR_COLOR_NAMES}
            selected={genome.hairColor}
            onSelect={(i) => { haptic.light(); onChange({ ...genome, hairColor: i }); }}
          />
        </Card>

        <Card title="Eye color">
          <Swatches
            colors={EYE_COLORS}
            names={EYE_COLOR_NAMES}
            selected={genome.eyeColor}
            onSelect={(i) => { haptic.light(); onChange({ ...genome, eyeColor: i }); }}
          />
        </Card>

        <Card title="Facial hair">
          <Chips
            options={FACIAL_HAIR_STYLES as readonly string[]}
            selected={genome.facialHair}
            onSelect={(v) => { haptic.light(); onChange({ ...genome, facialHair: v as FacialHairStyle }); }}
          />
          {/* Only once there is facial hair to colour. A colour picker and a
              density slider above a character who has chosen "none" are two
              controls that visibly do nothing, which is the thing this screen
              already refuses to ship for the morph sliders. */}
          {genome.facialHair !== 'none' ? (
            <View style={styles.subSection}>
              <Text style={styles.subLabel}>Colour</Text>
              <OptionalSwatches
                colors={HAIR_COLORS}
                names={HAIR_COLOR_NAMES}
                selected={genome.beardColor}
                onSelect={(i) => { haptic.light(); onChange(withOptional(genome, 'beardColor', i)); }}
              />
              <MorphSlider
                label="Density"
                value={genome.beardDensity}
                onChange={(v) => onChange({ ...genome, beardDensity: v })}
                onEditStart={pushHistory}
              />
            </View>
          ) : null}
        </Card>

        {/* DETAILS. Everything here is a material property rather than
            geometry, so it works on every route — including the preset heads,
            where the structure sliders are hidden because a preset's shape is
            baked in and nothing would move. */}
        <Card title="Eyebrows">
          <MorphSlider
            label="Thickness"
            value={genome.browThickness}
            onChange={(v) => onChange({ ...genome, browThickness: v })}
            onEditStart={pushHistory}
          />
          <View style={styles.subSection}>
            <Text style={styles.subLabel}>Colour</Text>
            <OptionalSwatches
              colors={HAIR_COLORS}
              names={HAIR_COLOR_NAMES}
              selected={genome.browColor}
              onSelect={(i) => { haptic.light(); onChange(withOptional(genome, 'browColor', i)); }}
            />
          </View>
        </Card>

        {/* MAKEUP. Off by default, so this card opens showing three sliders at
            zero and nothing on the face — which is correct: makeup is a choice,
            and a creator that arrives with lipstick already on has made it for
            the player. The colour rows only appear once there is something to
            colour, for the same reason the facial-hair colour does. */}
        <Card title="Makeup">
          <MorphSlider
            label="Lipstick"
            value={genome.lipStrength}
            onChange={(v) => onChange({ ...genome, lipStrength: v })}
            onEditStart={pushHistory}
          />
          {genome.lipStrength > 0.02 ? (
            <View style={styles.subSection}>
              <Swatches
                colors={LIP_COLORS}
                names={LIP_COLOR_NAMES}
                selected={genome.lipColor ?? 0}
                onSelect={(i) => { haptic.light(); onChange({ ...genome, lipColor: i }); }}
              />
            </View>
          ) : null}
          <MorphSlider
            label="Eyeshadow"
            value={genome.eyeshadowStrength}
            onChange={(v) => onChange({ ...genome, eyeshadowStrength: v })}
            onEditStart={pushHistory}
          />
          {genome.eyeshadowStrength > 0.02 ? (
            <View style={styles.subSection}>
              <Swatches
                colors={LIP_COLORS}
                names={LIP_COLOR_NAMES}
                selected={genome.eyeshadowColor ?? 0}
                onSelect={(i) => { haptic.light(); onChange({ ...genome, eyeshadowColor: i }); }}
              />
            </View>
          ) : null}
          <MorphSlider
            label="Blush"
            value={genome.blush}
            onChange={(v) => onChange({ ...genome, blush: v })}
            onEditStart={pushHistory}
          />
        </Card>

        <Card title="Complexion">
          {/* `blemishes` was stored, randomised, inherited from both parents,
              drifted upward with age and RENDERED on both heads, with no
              control anywhere in the app. */}
          <MorphSlider
            label="Freckles"
            value={genome.blemishes}
            onChange={(v) => onChange({ ...genome, blemishes: v })}
            onEditStart={pushHistory}
          />
          <MorphSlider
            label="Undertone"
            value={genome.skinUndertone}
            onChange={(v) => onChange({ ...genome, skinUndertone: v })}
            onEditStart={pushHistory}
          />
          <MorphSlider
            label="Finish"
            value={genome.skinShine}
            onChange={(v) => onChange({ ...genome, skinShine: v })}
            onEditStart={pushHistory}
          />
        </Card>

        {groups.map((group) => {
          const open = openGroup === group.title;
          const Chevron = open ? ChevronUp : ChevronDown;
          return (
            <View key={group.title} style={styles.card}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => { haptic.light(); setOpenGroup(open ? null : group.title); }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Text style={styles.cardTitle}>{group.title}</Text>
                <Chevron size={scale(18)} color={C.muted} />
              </TouchableOpacity>
              {open ? (
                <View style={styles.groupBody}>
                  {group.morphs.map((m) => (
                    <MorphSlider
                      key={m.key}
                      label={m.label}
                      value={genome.morphs[m.key]}
                      onChange={(v) => setMorph(m.key, v)}
                      onEditStart={pushHistory}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {onDone ? (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.primary} onPress={() => { haptic.success(); onDone(); }} accessibilityRole="button">
            <Check size={scale(18)} color="#FFFFFF" />
            <Text style={styles.primaryText}>{doneLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function RoundAction({
  icon: Icon, label, onPress, onPressIn, onPressOut, accent, disabled, active, size, iconSize, showLabel,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accent?: boolean;
  disabled?: boolean;
  active?: boolean;
  /** Diameter for this frame, from `railLayout`. */
  size: ViewStyle;
  /** Glyph size, already scaled. */
  iconSize: number;
  /**
   * False on the shortest frames, where four labelled controls do not fit.
   *
   * The button keeps its `accessibilityLabel` either way, so this costs a
   * sighted player a word and costs a screen-reader user nothing.
   */
  showLabel: boolean;
}): React.JSX.Element {
  const tint = disabled ? C.muted : active ? C.accent : accent ? C.gold : C.sub;
  return (
    <View style={styles.actionWrap}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, selected: !!active }}
        style={[
          styles.roundBtn,
          accent ? styles.roundBtnAccent : null,
          active ? styles.roundBtnActive : null,
          disabled ? styles.roundBtnDisabled : null,
          size,
        ]}
      >
        <Icon size={iconSize} color={tint} />
      </TouchableOpacity>
      {showLabel ? (
        <Text style={[styles.actionLabel, disabled ? { color: C.muted } : null]}>{label}</Text>
      ) : null}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ marginTop: scale(11) }}>{children}</View>
    </View>
  );
}

function Swatches({
  colors, names, selected, onSelect,
}: {
  colors: readonly string[];
  /** Index-aligned names — a colour button has no text to announce. */
  names: readonly string[];
  selected: number;
  onSelect: (i: number) => void;
}): React.JSX.Element {
  return (
    <View style={styles.swatchRow}>
      {colors.map((c, i) => (
        <TouchableOpacity
          key={`${c}-${i}`}
          onPress={() => onSelect(i)}
          accessibilityRole="button"
          accessibilityLabel={swatchName(names, i)}
          accessibilityState={{ selected: i === selected }}
          style={[styles.swatchRing, i === selected ? styles.swatchRingOn : null]}
        >
          <View style={[styles.swatch, { backgroundColor: c }]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Swatches with a "same as hair" option in front of the palette.
 *
 * `browColor` and `beardColor` are OVERRIDES: absent means follow the hair,
 * which is what almost everybody's do and what a randomised face gets. The
 * picker has to be able to express that, and it has to be able to get BACK to
 * it — a colour picker with no way to undo a choice is one the player only ever
 * uses once, by accident.
 */
/**
 * Set or CLEAR an optional field.
 *
 * `{ ...genome, browColor: undefined }` is not the same object as one without
 * the key, and the renderer asks `typeof aged.browColor === 'number'` — which
 * happens to give the right answer either way, but `normalizeGenome` spreads
 * the key in only when it is real, so a genome carrying an explicit
 * `undefined` would round-trip through a save into a different shape than the
 * one in memory. Deleting keeps them identical.
 */
function withOptional(
  genome: FaceGenome, key: 'browColor' | 'beardColor', value: number | undefined,
): FaceGenome {
  const next = { ...genome };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function OptionalSwatches({
  colors, names, selected, onSelect,
}: {
  colors: readonly string[];
  names: readonly string[];
  /** undefined = follow the hair. */
  selected: number | undefined;
  onSelect: (i: number | undefined) => void;
}): React.JSX.Element {
  return (
    <View style={styles.swatchRow}>
      <TouchableOpacity
        onPress={() => onSelect(undefined)}
        accessibilityRole="button"
        accessibilityLabel="Same as hair"
        accessibilityState={{ selected: selected === undefined }}
        style={[styles.autoChip, selected === undefined ? styles.autoChipOn : null]}
      >
        <Text style={[styles.autoChipText, selected === undefined ? styles.autoChipTextOn : null]}>
          Same as hair
        </Text>
      </TouchableOpacity>
      {colors.map((c, i) => (
        <TouchableOpacity
          key={`${c}-${i}`}
          onPress={() => onSelect(i)}
          accessibilityRole="button"
          accessibilityLabel={swatchName(names, i)}
          accessibilityState={{ selected: i === selected }}
          style={[styles.swatchRing, i === selected ? styles.swatchRingOn : null]}
        >
          <View style={[styles.swatch, { backgroundColor: c }]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Chips({
  options, selected, onSelect,
}: { options: readonly string[]; selected: string; onSelect: (v: string) => void }): React.JSX.Element {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active ? styles.chipOn : null]}
          >
            <Text style={[styles.chipText, active ? styles.chipTextOn : null]}>
              {styleLabel(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  autoChip: {
    paddingHorizontal: scale(11),
    height: scale(30),
    justifyContent: 'center',
    borderRadius: scale(9),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  autoChipOn: { borderColor: C.accent, backgroundColor: 'rgba(76,141,255,0.16)' },
  autoChipText: { color: C.sub, fontSize: fontScale(12), fontWeight: '700' },
  subSection: { marginTop: scale(12), gap: scale(6) },
  subLabel: { color: C.sub, fontSize: fontScale(12), fontWeight: '700' },
  autoChipTextOn: { color: C.text },
  scroll: { padding: scale(16), paddingBottom: scale(110) },
  stepRow: { alignItems: 'flex-end', marginBottom: scale(10) },
  dashes: { flexDirection: 'row', gap: scale(5) },
  dash: { width: scale(22), height: scale(3.5), borderRadius: 99 },
  stepText: { color: C.sub, fontSize: fontScale(12), marginTop: scale(7), fontWeight: '600' },
  title: { color: C.text, fontSize: fontScale(28), fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.sub, fontSize: fontScale(14), marginTop: scale(5) },
  frame: {
    marginTop: scale(15),
    // Overridden per-render from the window height — see `frameHeight`. This
    // stays as a floor for the one frame before layout settles.
    height: scale(280),
    borderRadius: scale(18),
    backgroundColor: C.frame,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  portrait: { width: '100%', height: '100%' },
  actions: { position: 'absolute', right: scale(12), top: scale(14), alignItems: 'center', gap: scale(14) },
  actionWrap: { alignItems: 'center' },
  roundBtn: {
    width: scale(46), height: scale(46), borderRadius: scale(23),
    backgroundColor: 'rgba(12, 18, 28, 0.72)',
    borderWidth: 1, borderColor: '#26303F',
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnActive: {
    borderColor: C.accent,
    backgroundColor: C.accentSoft,
  },
  roundBtnDisabled: {
    opacity: 0.4,
  },
  roundBtnAccent: { borderColor: 'rgba(255, 215, 107, 0.55)' },
  // The label sits ON the portrait, whose art can be anything from near-black
  // to a bright orange glow. Plain text was unreadable over the light ones, so
  // it gets its own dark pill rather than relying on the image behind it.
  actionLabel: {
    color: '#DCE4F0',
    fontSize: fontScale(10.5),
    marginTop: scale(5),
    fontWeight: '700',
    backgroundColor: 'rgba(7, 10, 16, 0.85)',
    paddingHorizontal: scale(7),
    paddingVertical: scale(2.5),
    borderRadius: 99,
    overflow: 'hidden',
  },
  // Bottom-LEFT: the action rail owns the right edge, and the chin sits centre.
  spinHint: {
    position: 'absolute',
    left: scale(12),
    bottom: scale(12),
    color: '#DCE4F0',
    fontSize: fontScale(10.5),
    fontWeight: '700',
    backgroundColor: 'rgba(7, 10, 16, 0.85)',
    paddingHorizontal: scale(9),
    paddingVertical: scale(4),
    borderRadius: 99,
    overflow: 'hidden',
  },
  card: {
    marginTop: scale(11),
    backgroundColor: C.card,
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: scale(14),
  },
  cardTitle: { color: C.text, fontSize: fontScale(15), fontWeight: '700' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupBody: { marginTop: scale(13) },
  presetRow: { flexDirection: 'row', gap: scale(9), paddingRight: scale(4) },
  presetTile: {
    width: scale(66), height: scale(84), borderRadius: scale(12),
    borderWidth: 2, borderColor: 'transparent', overflow: 'hidden',
    backgroundColor: C.frame,
  },
  presetTileOn: { borderColor: C.accent },
  presetImg: { width: '100%', height: '100%' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(9) },
  swatchRing: {
    width: scale(38), height: scale(38), borderRadius: scale(19),
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  swatchRingOn: { borderColor: C.accent },
  swatch: { width: scale(30), height: scale(30), borderRadius: scale(15) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  chip: {
    paddingHorizontal: scale(15), paddingVertical: scale(9),
    borderRadius: 99, backgroundColor: C.chip,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipText: { color: C.sub, fontSize: fontScale(13), fontWeight: '600' },
  chipTextOn: { color: '#BBD4FF' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: scale(16), paddingTop: scale(10),
    backgroundColor: 'rgba(7, 10, 16, 0.97)',
    borderTopWidth: 1, borderTopColor: C.cardBorder,
  },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(9),
    backgroundColor: C.accent, borderRadius: scale(15), paddingVertical: scale(16),
  },
  primaryText: { color: '#FFFFFF', fontSize: fontScale(16), fontWeight: '800' },
});
