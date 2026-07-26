/**
 * Face studio — the character creation screen, rebuilt to the approved design.
 *
 * ## What this screen is, and what it is waiting for
 *
 * The layout, controls and chrome here are final. The PORTRAIT is not: it
 * currently renders from the existing `assets/images/Face/pool` artwork, and is
 * designed to be swapped for the layered portrait pipeline (a base portrait per
 * skin-tone x sex x age band, plus tinted hair/beard layers composited on top)
 * without this file changing shape. `renderPortrait` is the single seam.
 *
 * That pipeline is the only route to the reference design's quality. Real-time
 * procedural geometry cannot produce a photoreal head on a phone — the earlier
 * three.js head is a different category of object, not a worse version of one —
 * so the visual target is met with pre-rendered art, exactly as
 * `docs/avatar-redesign-proposal.md` recommended in Direction 1.
 *
 * ## Why the sliders are live even though the portrait does not react yet
 *
 * They are not decoration. Every control writes to the stored `FaceGenome`, and
 * `facialHarmony` reads that genome to produce the `looks` term in
 * `computePresence` — which already feeds dating match odds and interview
 * callbacks. So shaping the face changes how the character is treated today;
 * the portrait simply is not drawn from it yet.
 *
 * The screen sits behind `FEATURE_FLAGS.faceCreator3D` until the art lands.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Check, ChevronDown, ChevronUp, Dices, RotateCcw } from 'lucide-react-native';
import MorphSlider from './MorphSlider';
import {
  EYE_COLORS,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  randomizeFace,
  type FaceGenome,
  type FaceMorphKey,
  type FacialHairStyle,
  type HairStyle,
} from '@/lib/identity';
import { listStarterAvatars } from '@/utils/facePool';
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
 * "Facial structure" is expanded and Nose/Eyes are collapsed — the point being
 * that the screen must not open as a wall of twenty sliders.
 */
const GROUPS: { title: string; morphs: { key: FaceMorphKey; label: string }[] }[] = [
  {
    title: 'Facial structure',
    morphs: [
      { key: 'jawWidth', label: 'Jaw width' },
      { key: 'jawAngle', label: 'Jaw angle' },
      { key: 'chinLength', label: 'Chin length' },
      { key: 'faceWidth', label: 'Face width' },
      { key: 'cheekboneHeight', label: 'Cheekbones' },
    ],
  },
  {
    title: 'Nose',
    morphs: [
      { key: 'noseLength', label: 'Length' },
      { key: 'noseWidth', label: 'Width' },
      { key: 'noseBridge', label: 'Bridge' },
      { key: 'noseTip', label: 'Tip' },
    ],
  },
  {
    title: 'Eyes',
    morphs: [
      { key: 'eyeSize', label: 'Size' },
      { key: 'eyeSpacing', label: 'Spacing' },
      { key: 'eyeDepth', label: 'Depth' },
      { key: 'eyeTilt', label: 'Tilt' },
      { key: 'browHeight', label: 'Brow height' },
    ],
  },
  {
    title: 'Mouth & more',
    morphs: [
      { key: 'mouthWidth', label: 'Mouth width' },
      { key: 'lipFullness', label: 'Lip fullness' },
      { key: 'earSize', label: 'Ears' },
      { key: 'foreheadSlope', label: 'Forehead' },
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
}

export default function FaceStudio({
  genome,
  onChange,
  onDone,
  sex = 'random',
  age = 18,
  binding,
  presets,
  selectedPresetId,
  onSelectPreset,
  step,
  totalSteps = 4,
  title = 'Build your face',
  subtitle = "Create a face that's uniquely yours.",
  doneLabel = 'Use this face',
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

  const randomize = useCallback(() => {
    haptic.medium();
    rollRef.current += 1;
    onChange(randomizeFace(`studio-${rollRef.current}-${Date.now()}`, { sex }));
    setPortraitIndex((i) => i + 1);
  }, [onChange, sex]);

  const reset = useCallback(() => {
    haptic.light();
    const morphs = { ...genome.morphs };
    for (const key of Object.keys(morphs) as FaceMorphKey[]) morphs[key] = 0.5;
    onChange({ ...genome, morphs });
  }, [genome, onChange]);

  const setMorph = useCallback(
    (key: FaceMorphKey, value: number) => {
      onChange({ ...genome, morphs: { ...genome.morphs, [key]: value } });
    },
    [genome, onChange],
  );

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
        <View style={styles.frame}>
          {portrait ? (
            <Image source={portrait} style={styles.portrait} resizeMode="contain" />
          ) : (
            <View style={styles.portrait} />
          )}
          <View style={styles.actions}>
            <RoundAction icon={Dices} label="Randomize" onPress={randomize} accent />
            <RoundAction icon={RotateCcw} label="Reset" onPress={reset} />
          </View>
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
            selected={genome.hairColor}
            onSelect={(i) => { haptic.light(); onChange({ ...genome, hairColor: i }); }}
          />
        </Card>

        <Card title="Eye color">
          <Swatches
            colors={EYE_COLORS}
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
  icon: Icon, label, onPress, accent,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.actionWrap}>
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.roundBtn, accent ? styles.roundBtnAccent : null]}
      >
        <Icon size={scale(19)} color={accent ? C.gold : C.sub} />
      </TouchableOpacity>
      <Text style={styles.actionLabel}>{label}</Text>
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
  colors, selected, onSelect,
}: { colors: readonly string[]; selected: number; onSelect: (i: number) => void }): React.JSX.Element {
  return (
    <View style={styles.swatchRow}>
      {colors.map((c, i) => (
        <TouchableOpacity
          key={`${c}-${i}`}
          onPress={() => onSelect(i)}
          accessibilityRole="button"
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
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: scale(16), paddingBottom: scale(110) },
  stepRow: { alignItems: 'flex-end', marginBottom: scale(10) },
  dashes: { flexDirection: 'row', gap: scale(5) },
  dash: { width: scale(22), height: scale(3.5), borderRadius: 99 },
  stepText: { color: C.sub, fontSize: fontScale(12), marginTop: scale(7), fontWeight: '600' },
  title: { color: C.text, fontSize: fontScale(28), fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.sub, fontSize: fontScale(14), marginTop: scale(5) },
  frame: {
    marginTop: scale(15),
    height: scale(330),
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
