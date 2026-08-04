/**
 * SparkProfileEditModal — edit the player's own Spark dating profile.
 *
 * Wires the Profile tab's "Add a bio to attract more matches" hint (which had no
 * tap target) to the previously UI-less `updateMyProfile` action. The player can
 * write a bio and pick interests; a live "Profile strength" meter (scorePlayerProfile)
 * shows the improvement before they save. Photos are asset-driven elsewhere, so
 * they're intentionally omitted here.
 *
 * Styling mirrors SparkPremiumUpsellModal: a bottom sheet over a dim backdrop,
 * theme-aware, crash-safe LinearGradientFallback.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { updateMyProfile } from '@/contexts/game/actions/SparkActions';
import { scorePlayerProfile } from '@/lib/dating/sparkLogic';
import type { GameState } from '@/contexts/game/types';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = LinearGradientFallback;

const BIO_MAX = 150;
const MAX_INTERESTS = 8;

/** Curated, proper-cased interest catalog (mirrors the tone of DATING_PROFILES). */
const SPARK_INTERESTS = [
  'Travel', 'Music', 'Fitness', 'Foodie', 'Movies', 'Art', 'Reading',
  'Gaming', 'Hiking', 'Coffee', 'Cooking', 'Photography', 'Fashion',
  'Dancing', 'Pets', 'Yoga', 'Technology', 'Nightlife', 'Wine', 'Sports',
] as const;

interface SparkProfileEditModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function SparkProfileEditModal({ visible, onDismiss }: SparkProfileEditModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const profile = gameState.sparkApp?.profile;
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);

  // Re-sync local draft from the saved profile each time the sheet opens so a
  // dismiss-without-save doesn't leak into the next edit session.
  useEffect(() => {
    if (visible) {
      setBio(gameState.sparkApp?.profile?.bio ?? '');
      setInterests(gameState.sparkApp?.profile?.interests ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Live attractiveness preview — recompute scorePlayerProfile against a state
  // that has the DRAFT profile folded in, so the meter moves as they type/select
  // (before saving). Safe on legacy saves: scorePlayerProfile optional-chains.
  const previewScore = useMemo(() => {
    const sp = gameState.sparkApp;
    const draftState = {
      ...gameState,
      sparkApp: {
        ...(sp ?? {}),
        profile: { ...(sp?.profile ?? {}), bio: bio.trim(), interests },
      },
    } as GameState;
    return scorePlayerProfile(draftState);
  }, [gameState, bio, interests]);

  const toggleInterest = useCallback((interest: string) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= MAX_INTERESTS) return prev; // cap selections
      return [...prev, interest];
    });
  }, []);

  const handleSave = useCallback(() => {
    updateMyProfile(setGameState, { bio: bio.trim(), interests });
    sparkHaptics.boost();
    saveGame();
    onDismiss();
  }, [setGameState, bio, interests, saveGame, onDismiss]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Edit profile</Text>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          {/* Live profile-strength meter — the visible payoff of a fuller profile. */}
          <View style={[styles.scoreCard, { backgroundColor: theme.surfaceElevated }]}>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>Profile strength</Text>
              <Text style={[styles.scoreValue, { color: SPARK_COLORS.accent }]}>{previewScore}/100</Text>
            </View>
            <View style={[styles.scoreTrack, { backgroundColor: theme.border }]}>
              <LinearGradient
                colors={SPARK_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.scoreFill, { width: `${Math.max(0, Math.min(100, previewScore))}%` }]}
              />
            </View>
            <Text style={[styles.scoreHint, { color: theme.textMuted }]}>
              A stronger profile attracts more incoming likes.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            {/* Bio */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Say something that makes you stand out…"
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={BIO_MAX}
              accessibilityLabel="Profile bio"
              style={[styles.bioInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <Text style={[styles.charCount, { color: theme.textMuted }]}>{bio.length}/{BIO_MAX}</Text>

            {/* Interests */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              Interests {interests.length > 0 ? `· ${interests.length}/${MAX_INTERESTS}` : ''}
            </Text>
            <View style={styles.chipWrap}>
              {SPARK_INTERESTS.map((interest) => {
                const selected = interests.includes(interest);
                const atCap = !selected && interests.length >= MAX_INTERESTS;
                return (
                  <Pressable
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    disabled={atCap}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${interest}${selected ? ', selected' : ''}`}
                    style={[
                      styles.chip,
                      selected
                        ? { backgroundColor: SPARK_COLORS.accent, borderColor: SPARK_COLORS.accent }
                        : { borderColor: theme.border, opacity: atCap ? 0.4 : 1 },
                    ]}
                  >
                    {selected ? <Check size={fontScale(12)} color="#FFFFFF" strokeWidth={3} /> : null}
                    <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.textSecondary }]}>
                      {interest}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            style={styles.saveBtn}
          >
            <LinearGradient
              colors={SPARK_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnInner}
            >
              <Text style={styles.saveBtnText}>Save profile</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  // `maxHeight` + `flexShrink` on the list below, together. A bottom sheet with
  // no height bound grows to fit its content, so on a short screen its footer
  // button lands off the bottom of the SCREEN — and the sheet itself does not
  // scroll, so nothing can reach it. Bounding the sheet is what gives the list
  // something to shrink within. Same fix as ApplyCardModal (2026-08-02).
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: '800',
  },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scoreCard: {
    borderRadius: scale(14),
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.xs,
  },
  scoreLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreValue: {
    fontSize: fontScale(18),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scoreTrack: {
    height: scale(8),
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 999,
  },
  scoreHint: {
    fontSize: fontScale(11),
    marginTop: responsiveSpacing.xs,
  },
  sectionLabel: {
    fontSize: fontScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
  },
  bioInput: {
    minHeight: scale(88),
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    fontSize: fontScale(14),
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: fontScale(11),
    textAlign: 'right',
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(12),
    paddingVertical: scale(7),
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  saveBtn: {
    borderRadius: scale(14),
    overflow: 'hidden',
    marginTop: responsiveSpacing.md,
  },
  saveBtnInner: {
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '800',
  },
});
