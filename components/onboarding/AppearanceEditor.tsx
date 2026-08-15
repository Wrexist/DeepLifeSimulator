/**
 * The appearance editor — the part of character creation where you choose a face.
 *
 * ── What was wrong ────────────────────────────────────────────────────────
 *
 * It was a list of WORDS. Hair had 28 options and each one was a chip reading
 * "Fro", "Long Bob", "Shaggy Mullet" — so choosing a hairstyle meant tapping a
 * word, looking up at the hero avatar to see what it did, and tapping the next
 * word. Twenty-eight times. The one screen in the game whose entire job is
 * visual was driven by a vocabulary test.
 *
 * The categories had the same problem in miniature: eleven of them in a
 * single-line horizontal `ScrollView`, so most were off-screen with nothing to
 * say they existed. You cannot choose from options you cannot see, and you
 * cannot navigate a list you do not know the shape of.
 *
 * And the option area was whatever height its contents happened to be — 28 hair
 * chips or 4 mouth chips — so switching category reflowed the page under the
 * player's thumb.
 *
 * ── What it is now ────────────────────────────────────────────────────────
 *
 * 1. SHAPE OPTIONS ARE FACES. Each one renders the player's own avatar with a
 *    single field swapped, so the thumbnail IS the answer to "what does this
 *    look like on me". Skin tone, hair colour and outfit colour stay as
 *    swatches: a colour chip already shows exactly what it does, and 15 of them
 *    read faster as a palette than as 15 near-identical heads.
 *
 * 2. EVERY CATEGORY IS VISIBLE. The chips wrap instead of scrolling, so the
 *    whole shape of the editor is on screen at once.
 *
 * 3. THE OPTIONS ARE A RAIL, NOT A PAGE. One horizontal row at a fixed height.
 *    The hero avatar and the category chips stay put while you browse, which is
 *    what makes comparing options possible — a wrapped grid of 28 faces would
 *    push the very avatar you are judging them against off the top of the
 *    screen. It also means the section is the same height for Mouth (4) as for
 *    Hair (28), so nothing jumps.
 *
 * 4. ONE SELECTED TREATMENT. A blue ring and a check, on swatches and faces
 *    alike. Before, a chosen colour was a thicker border and a chosen shape was
 *    a tinted fill, and neither was unambiguous at a glance.
 *
 * ── Cost ──────────────────────────────────────────────────────────────────
 *
 * A thumbnail is a real `VectorAvatar`, so a category mounts up to 28 of them.
 * That is affordable because only the ACTIVE category is mounted, each preview
 * is memoized on the exact config it draws, and `alive` is off — the blink and
 * breathe timers are for the hero avatar alone (see `VectorAvatar`'s own note
 * about mounting dozens). Switching category unmounts the previous rail.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import VectorAvatar from '@/components/avatar/VectorAvatar';
import { haptic } from '@/utils/haptics';
import type { PickerCategory } from '@/lib/avatar/pickers';
import type { AvatarConfig, AvatarSex } from '@/lib/avatar/types';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

/** Rendered size of one preview face. Big enough to read a hairline on. */
const THUMB = scale(58);
/**
 * How far the OUTFIT previews pull back.
 *
 * The default framing centres the head, so a circular thumbnail of a clothing
 * option shows a sliver of collar — four different outfits render as four
 * identical headshots, which is the same "cannot see what you are choosing"
 * problem in a new costume. Verified against the running app: at this zoom the
 * shoulders and chest are in frame and the outfits are told apart at a glance.
 */
const OUTFIT_ZOOM = 0.62;
/** The categories whose subject is below the neck. */
const TORSO_FIELDS = new Set(['clothing', 'clothingColor']);
/** Width of a rail cell — the face plus room for its label. */
const CELL = scale(70);

export interface AppearanceEditorProps {
  avatar: AvatarConfig;
  sex: AvatarSex;
  /** The character's starting age, so previews match the hero avatar. */
  age: number;
  categories: PickerCategory[];
  activeIndex: number;
  onChangeCategory: (index: number) => void;
  onSelectOption: (index: number) => void;
  /** Writes the category's paired colour (hair colour, outfit colour). */
  onSelectTint: (index: number) => void;
}

/**
 * One preview face.
 *
 * Split out and memoized so that changing the SELECTION re-renders only the two
 * cells whose ring changed, rather than regenerating every face in the rail.
 * `config` is built by the parent with a stable identity per option.
 */
const OptionFace = React.memo(function OptionFace({
  config,
  sex,
  age,
  zoom,
}: {
  config: AvatarConfig;
  sex: AvatarSex;
  age: number;
  zoom?: number;
}) {
  return <VectorAvatar config={config} sex={sex} age={age} size={THUMB} zoom={zoom} circular />;
});

function AppearanceEditorImpl({
  avatar,
  sex,
  age,
  categories,
  activeIndex,
  onChangeCategory,
  onSelectOption,
  onSelectTint,
}: AppearanceEditorProps) {
  const railRef = useRef<ScrollView | null>(null);
  const category = categories[Math.min(activeIndex, categories.length - 1)];
  const selected = (avatar[category.field] as number) ?? 0;
  const tintSelected = category.tint ? ((avatar[category.tint.field] as number) ?? 0) : 0;

  /**
   * The avatar WITHOUT the field currently being edited, as a stable key.
   * See `previewConfigs` — this is what stops a selection change rebuilding
   * every preview in the rail.
   */
  const avatarRest = useMemo(() => {
    const rest: Record<string, unknown> = { ...avatar };
    delete rest[category.field];
    return JSON.stringify(rest);
  }, [avatar, category.field]);

  /**
   * Bring the current choice into view when the category changes.
   *
   * Without this, opening a category you have already edited starts at option 1
   * with your actual choice somewhere off to the right — the player has to hunt
   * for their own selection. Guarded because the ref is null on first paint and
   * the method is absent under the render-test mock.
   */
  useEffect(() => {
    const x = Math.max(0, (selected - 1) * (CELL + responsiveSpacing.xs));
    railRef.current?.scrollTo?.({ x, animated: false });
    // Only on a category change — re-running on every selection would fight the
    // player's own scrolling as they tap along the rail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.field]);

  const handleCategory = useCallback(
    (index: number) => {
      haptic.selection();
      onChangeCategory(index);
    },
    [onChangeCategory]
  );

  // No haptic here: `Customize.handleSelectOption` already fires one, and two
  // owners for one piece of feedback is two buzzes per tap. Category changes
  // keep theirs above, because the screen has no handler of its own for those.
  const handleOption = useCallback(
    (index: number) => {
      onSelectOption(index);
    },
    [onSelectOption]
  );

  // Same no-haptic reasoning as `handleOption`: the screen's own handler fires
  // one, and two owners for one buzz is two buzzes.
  const handleTint = useCallback(
    (index: number) => {
      onSelectTint(index);
    },
    [onSelectTint]
  );

  /**
   * The config each preview draws: the player's face with exactly one field
   * swapped. Built here rather than inline so the objects are stable across
   * re-renders and `OptionFace`'s memo actually holds.
   */
  const previewConfigs = useMemo(() => {
    if (category.kind === 'color') return null;
    return category.options.map((_, index) => ({ ...avatar, [category.field]: index }));
    // `avatarRest`, not `avatar`. Every config here OVERRIDES `category.field`,
    // so picking a different option produces value-identical previews — but a
    // new `avatar` object each time, which rebuilt the array, broke
    // `OptionFace`'s memo and regenerated all 28 SVGs on every tap. Depending on
    // the fields that actually appear in the output keeps them stable, so a tap
    // re-renders two rings instead of the whole rail. Caught in review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarRest, category]);

  return (
    <View style={styles.root}>
      {/* Categories — wrapped, so all eleven are visible at once. */}
      <View style={styles.categoryWrap}>
        {categories.map((entry, index) => {
          const isSelected = entry.field === category.field;
          return (
            <TouchableOpacity
              activeOpacity={0.75}
              key={entry.field}
              accessibilityRole="button"
              accessibilityLabel={`${entry.label} options`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleCategory(index)}
              style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
            >
              <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Where you are in the category you opened. */}
      <View style={styles.railHeader}>
        <Text style={styles.railTitle}>{category.label}</Text>
        <Text style={styles.railCount}>
          {selected + 1} of {category.options.length}
        </Text>
      </View>

      <ScrollView
        ref={railRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        style={styles.railScroll}
      >
        {category.options.map((option, index) => {
          const isSelected = selected === index;
          const label = `${category.label} ${option.label}`;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              key={`${category.field}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleOption(index)}
              style={styles.cell}
            >
              <View style={[styles.tile, isSelected && styles.tileSelected]}>
                {category.kind === 'color' ? (
                  <View style={[styles.swatchFill, { backgroundColor: option.color }]} />
                ) : (
                  <OptionFace
                    config={previewConfigs![index]}
                    sex={sex}
                    age={age}
                    zoom={TORSO_FIELDS.has(category.field) ? OUTFIT_ZOOM : undefined}
                  />
                )}

                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Check size={scale(11)} color="#0B1220" strokeWidth={3} />
                  </View>
                )}
              </View>

              {/* Colour swatches are their own label — a name under a shade of
                  brown adds nothing but noise. Shapes keep theirs, because two
                  hairstyles can look similar at thumbnail size. */}
              {category.kind !== 'color' && (
                <Text
                  style={[styles.cellLabel, isSelected && styles.cellLabelSelected]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* The colour for this same feature, under the shapes it applies to.
          Hair colour used to be a category of its own, so picking a hairstyle
          and then colouring it meant finding a second chip among nine — one
          decision split across two places, and two of the eleven chips existed
          only to colour other chips. */}
      {category.tint && (
        <View style={styles.tintRow}>
          {category.tint.options.map((option, index) => {
            const isSelected = tintSelected === index;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                key={`${category.tint!.field}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${category.tint!.label} ${option.label}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleTint(index)}
                style={[styles.tintDot, isSelected && styles.tintDotSelected]}
              >
                <View style={[styles.tintFill, { backgroundColor: option.color }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: responsiveSpacing.sm },

  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
  },
  categoryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(7),
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderColor: 'rgba(96, 165, 250, 0.85)',
  },
  categoryLabel: { fontSize: fontScale(12), fontWeight: '700', color: '#CBD5E1' },
  categoryLabelSelected: { color: '#FFFFFF' },

  /**
   * The paired colour strip. Deliberately smaller than the option rail and
   * un-labelled: it is a secondary control for the category already open, not a
   * category of its own, and sizing it the same would say otherwise. Wraps
   * rather than scrolls — there are at most 15, and a second horizontal
   * scroller under the first one is a trap for the thumb.
   */
  tintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
    marginTop: verticalScale(2),
  },
  tintDot: {
    width: scale(26),
    height: scale(26),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: scale(2),
  },
  tintDotSelected: { borderColor: 'rgba(96, 165, 250, 0.95)' },
  tintFill: { flex: 1, borderRadius: responsiveBorderRadius.full },

  railHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: verticalScale(2),
  },
  railTitle: { fontSize: fontScale(13), fontWeight: '800', color: '#F8FAFC' },
  railCount: { fontSize: fontScale(11), fontWeight: '600', color: '#94A3B8' },

  // A fixed height is what stops the page reflowing when you switch from Hair
  // (28 options) to Mouth (4).
  railScroll: { height: THUMB + verticalScale(34) },
  rail: { gap: responsiveSpacing.xs, paddingVertical: verticalScale(2) },

  cell: { width: CELL, alignItems: 'center', gap: verticalScale(4) },
  tile: {
    width: THUMB + scale(6),
    height: THUMB + scale(6),
    borderRadius: (THUMB + scale(6)) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'visible',
  },
  tileSelected: { borderColor: '#60A5FA', backgroundColor: 'rgba(59, 130, 246, 0.16)' },

  swatchFill: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },

  checkBadge: {
    position: 'absolute',
    right: scale(-1),
    bottom: scale(-1),
    width: scale(19),
    height: scale(19),
    borderRadius: scale(10),
    backgroundColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },

  cellLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  cellLabelSelected: { color: '#E2E8F0' },
});

const AppearanceEditor = React.memo(AppearanceEditorImpl);
AppearanceEditor.displayName = 'AppearanceEditor';

export default AppearanceEditor;
