/**
 * The face creator — live 3D head plus the controls that shape it.
 *
 * ## Randomize-first, not slider-first
 *
 * The layout deliberately leads with a big Randomize button and puts the 24
 * morphs behind collapsed groups. That follows the finding in
 * `docs/avatar-redesign-proposal.md`: a life sim's creation screen has to stay
 * FAST, because the player is about to start a new life and the creator is the
 * thing standing between them and it. BitLife-style restraint beats a full
 * character-creator wall — the depth is there for the player who wants it, and
 * invisible to the one who does not.
 *
 * ## One GL context
 *
 * The canvas here is the app's only live 3D surface. On Done the head is
 * snapshotted to a PNG data URI and stored on the identity, and every other
 * screen renders that flat image.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Dice5, RotateCcw } from 'lucide-react-native';
import FaceCanvas, { type FaceCanvasHandle } from './FaceCanvas';
import MorphSlider from './MorphSlider';
import {
  EYE_COLORS,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_COLOR_NAMES,
  SKIN_TONE_NAMES,
  EYE_COLOR_NAMES,
  styleLabel,
  swatchName,
  SKIN_TONES,
  randomizeFace,
  type BodyProfile,
  type FaceGenome,
  type FaceMorphKey,
  type FacialHairStyle,
  type HairStyle,
} from '@/lib/identity';
import { accent, getThemeColors, radii, spacing } from '@/lib/config/theme';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';

/**
 * Morph groups, in the order a person actually thinks about a face.
 *
 * Grouping is not decoration — 24 flat sliders is a wall nobody reads. Each
 * group is small enough to scan, and the labels are plain English rather than
 * the morph keys, because "Jaw angle" means something and `jawAngle` does not.
 */
const MORPH_GROUPS: { title: string; morphs: { key: FaceMorphKey; label: string }[] }[] = [
  {
    title: 'Face shape',
    morphs: [
      { key: 'faceWidth', label: 'Width' },
      { key: 'faceLength', label: 'Length' },
      { key: 'cheekboneHeight', label: 'Cheekbones' },
      { key: 'cheekFullness', label: 'Cheek fullness' },
      { key: 'foreheadSlope', label: 'Forehead' },
      { key: 'cheekHollow', label: 'Cheek hollow' },
      { key: 'templeWidth', label: 'Temple width' },
    ],
  },
  {
    title: 'Jaw & chin',
    morphs: [
      { key: 'jawWidth', label: 'Jaw width' },
      { key: 'jawAngle', label: 'Jaw angle' },
      { key: 'chinLength', label: 'Chin length' },
      { key: 'chinProtrusion', label: 'Chin projection' },
      { key: 'chinCleft', label: 'Chin cleft' },
    ],
  },
  {
    title: 'Eyes & brow',
    morphs: [
      { key: 'eyeSize', label: 'Eye size' },
      { key: 'eyeSpacing', label: 'Eye spacing' },
      { key: 'eyeDepth', label: 'Eye depth' },
      { key: 'eyeTilt', label: 'Eye tilt' },
      { key: 'browHeight', label: 'Brow height' },
      { key: 'browProtrusion', label: 'Brow ridge' },
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
    title: 'Mouth & more',
    morphs: [
      { key: 'mouthWidth', label: 'Mouth width' },
      { key: 'lipFullness', label: 'Lip fullness' },
      // Nose-base to upper-lip — the philtrum, not the opening.
      { key: 'mouthHeight', label: 'Upper lip height' },
      { key: 'lipRatio', label: 'Upper / lower lip' },
      { key: 'philtrumDepth', label: 'Philtrum depth' },
      { key: 'earSize', label: 'Ears' },
      { key: 'earAngle', label: 'Ear angle' },
      { key: 'neckThickness', label: 'Neck' },
    ],
  },
];

export interface FaceCreatorProps {
  genome: FaceGenome;
  onChange: (genome: FaceGenome) => void;
  /** Called with the baked portrait (or null if GL was unavailable). */
  onDone?: (portraitUri: string | null) => void;
  age?: number;
  body?: BodyProfile;
  sex?: string;
  darkMode?: boolean;
  /** Rendered inside the canvas when GL is unavailable. */
  fallback?: React.ReactNode;
  doneLabel?: string;
}

export default function FaceCreator({
  genome,
  onChange,
  onDone,
  age = 18,
  body,
  sex = 'random',
  darkMode = true,
  fallback,
  doneLabel = 'Use this face',
}: FaceCreatorProps): React.JSX.Element {
  const theme = getThemeColors(darkMode);
  const canvasRef = useRef<FaceCanvasHandle>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Monotonic counter so Randomize always produces a NEW face. Seeding from
  // Math.random() directly would be non-deterministic under React 19's
  // double-invoked updaters; a counter is stable within a render pass.
  const rollRef = useRef(0);

  const randomize = useCallback(() => {
    haptic.medium();
    rollRef.current += 1;
    onChange(randomizeFace(`creator-${rollRef.current}-${Date.now()}`, { sex }));
  }, [onChange, sex]);

  const setMorph = useCallback(
    (key: FaceMorphKey, value: number) => {
      onChange({ ...genome, morphs: { ...genome.morphs, [key]: value } });
    },
    [genome, onChange],
  );

  const resetGroup = useCallback(
    (keys: FaceMorphKey[]) => {
      haptic.light();
      const morphs = { ...genome.morphs };
      for (const key of keys) morphs[key] = 0.5;
      onChange({ ...genome, morphs });
    },
    [genome, onChange],
  );

  const done = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    haptic.success();
    try {
      const uri = await canvasRef.current?.capture();
      onDone?.(uri ?? null);
    } finally {
      setBusy(false);
    }
  }, [busy, onDone]);

  // Referentially stable so the canvas effect does not rebuild the head on
  // every unrelated re-render (a new object literal each time would).
  const canvasBody = useMemo(() => body, [body]);

  return (
    <View style={styles.root}>
      <FaceCanvas
        ref={canvasRef}
        genome={genome}
        age={age}
        body={canvasBody}
        fallback={fallback}
        style={styles.canvas}
      />

      <View style={styles.hintRow}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>Drag the face to turn it</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.randomize, { borderColor: accent.info }]}
          onPress={randomize}
          accessibilityRole="button"
          accessibilityLabel="Randomize face"
        >
          <Dice5 size={scale(18)} color={accent.info} />
          <Text style={[styles.randomizeText, { color: accent.info }]}>Randomize</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        <Swatches
          title="Skin tone"
          colors={SKIN_TONES}
          names={SKIN_TONE_NAMES}
          selected={genome.skinTone}
          onSelect={(i) => onChange({ ...genome, skinTone: i })}
          darkMode={darkMode}
        />
        <Swatches
          title="Hair colour"
          colors={HAIR_COLORS}
          names={HAIR_COLOR_NAMES}
          selected={genome.hairColor}
          onSelect={(i) => onChange({ ...genome, hairColor: i })}
          darkMode={darkMode}
        />
        <Swatches
          title="Eye colour"
          colors={EYE_COLORS}
          names={EYE_COLOR_NAMES}
          selected={genome.eyeColor}
          onSelect={(i) => onChange({ ...genome, eyeColor: i })}
          darkMode={darkMode}
        />

        <Chips
          title="Hair"
          options={HAIR_STYLES as readonly string[]}
          selected={genome.hairStyle}
          onSelect={(v) => onChange({ ...genome, hairStyle: v as HairStyle })}
          darkMode={darkMode}
        />
        <Chips
          title="Facial hair"
          options={FACIAL_HAIR_STYLES as readonly string[]}
          selected={genome.facialHair}
          onSelect={(v) => onChange({ ...genome, facialHair: v as FacialHairStyle })}
          darkMode={darkMode}
        />

        {MORPH_GROUPS.map((group) => {
          const open = openGroup === group.title;
          return (
            <View key={group.title} style={[styles.group, { borderColor: theme.surfaceElevated }]}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => {
                  haptic.light();
                  setOpenGroup(open ? null : group.title);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.groupTitle, { color: theme.text }]}>{group.title}</Text>
                <View style={styles.groupHeaderRight}>
                  {open ? (
                    <TouchableOpacity
                      onPress={() => resetGroup(group.morphs.map((m) => m.key))}
                      accessibilityRole="button"
                      accessibilityLabel={`Reset ${group.title}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <RotateCcw size={scale(15)} color={theme.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={[styles.groupChevron, { color: theme.textMuted }]}>{open ? '−' : '+'}</Text>
                </View>
              </TouchableOpacity>
              {open ? (
                <View style={styles.groupBody}>
                  {group.morphs.map((m) => (
                    <MorphSlider
                      key={m.key}
                      label={m.label}
                      value={genome.morphs[m.key]}
                      onChange={(v) => setMorph(m.key, v)}
                      darkMode={darkMode}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {onDone ? (
        <TouchableOpacity
          style={[styles.done, { backgroundColor: accent.info, opacity: busy ? 0.6 : 1 }]}
          onPress={done}
          disabled={busy}
          accessibilityRole="button"
        >
          <Check size={scale(18)} color="#FFFFFF" />
          <Text style={styles.doneText}>{busy ? 'Saving…' : doneLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Swatches({
  title, colors, names, selected, onSelect, darkMode,
}: {
  title: string;
  colors: readonly string[];
  /** Index-aligned names. "Skin tone option 7" tells a screen-reader user
   *  nothing they can choose with; "Bronze" does. */
  names: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
  darkMode: boolean;
}): React.JSX.Element {
  const theme = getThemeColors(darkMode);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={styles.swatchRow}>
        {colors.map((c, i) => (
          <TouchableOpacity
            key={`${title}-${i}`}
            onPress={() => { haptic.light(); onSelect(i); }}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${swatchName(names, i)}`}
            accessibilityState={{ selected: i === selected }}
            style={[
              styles.swatch,
              { backgroundColor: c, borderColor: i === selected ? accent.info : 'transparent' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Chips({
  title, options, selected, onSelect, darkMode,
}: {
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
  darkMode: boolean;
}): React.JSX.Element {
  const theme = getThemeColors(darkMode);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => { haptic.light(); onSelect(option); }}
              accessibilityRole="button"
              style={[
                styles.chip,
                {
                  backgroundColor: active ? accent.info : theme.surfaceElevated,
                  borderColor: active ? accent.info : theme.surfaceElevated,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
                {styleLabel(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvas: { height: scale(260), width: '100%' },
  hintRow: { alignItems: 'center', marginTop: spacing.xxs },
  hint: { fontSize: fontScale(11) },
  actionRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: spacing.sm },
  randomize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
  },
  randomizeText: { fontSize: fontScale(14), fontWeight: '600' },
  controls: { flex: 1 },
  controlsContent: { paddingBottom: spacing.xl },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontScale(12), fontWeight: '600', marginBottom: spacing.xs },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: scale(28), height: scale(28), borderRadius: scale(14), borderWidth: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    borderWidth: 1,
  },
  chipText: { fontSize: fontScale(12), fontWeight: '500' },
  group: {
    borderWidth: 1,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupTitle: { fontSize: fontScale(14), fontWeight: '600' },
  groupChevron: { fontSize: fontScale(18), fontWeight: '600' },
  groupBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    marginTop: spacing.sm,
  },
  doneText: { color: '#FFFFFF', fontSize: fontScale(15), fontWeight: '700' },
});
