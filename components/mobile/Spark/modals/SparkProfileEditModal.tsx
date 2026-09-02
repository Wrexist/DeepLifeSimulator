/**
 * SparkProfileEditModal - edit the player's own Spark dating profile.
 *
 * Wires the Profile tab's "Add a bio to attract more matches" hint (which had no
 * tap target) to the previously UI-less `updateMyProfile` action. The player can
 * write a bio and pick interests; a live "Profile strength" meter (scorePlayerProfile)
 * shows the improvement before they save. Photos are asset-driven elsewhere, so
 * they're intentionally omitted here.
 *
 * Shell is the shared `BaseModal` bottom sheet, with Save in its footer slot -
 * the sheet bounds and scrolls its own body, so the button cannot be pushed off
 * a short screen (the bug the hand-rolled sheet needed maxHeight for).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import ProgressBar from '@/components/ui/ProgressBar';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { updateMyProfile } from '@/contexts/game/actions/SparkActions';
import { scorePlayerProfile } from '@/lib/dating/sparkLogic';
import type { GameState } from '@/contexts/game/types';
import { SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

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

  // Live attractiveness preview - recompute scorePlayerProfile against a state
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

  return (
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title="Edit profile"
      footer={
        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          style={[styles.saveBtn, { backgroundColor: SPARK_COLORS.accent }]}
        >
          <Text style={styles.saveBtnText}>Save profile</Text>
        </Pressable>
      }
    >
      {/* Live profile-strength meter - the visible payoff of a fuller profile. */}
      <View style={[styles.scoreCard, { backgroundColor: theme.surfaceElevated }]}>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>Profile strength</Text>
          <Text style={[styles.scoreValue, { color: SPARK_COLORS.accent }]}>{previewScore}/100</Text>
        </View>
        <ProgressBar
          value={Math.max(0, Math.min(100, previewScore)) / 100}
          color={SPARK_COLORS.accent}
          label={`Profile strength ${previewScore} of 100`}
        />
        <Text style={[styles.scoreHint, { color: theme.textMuted }]}>
          A stronger profile attracts more incoming likes.
        </Text>
      </View>

      {/* Bio */}
      <SectionTitle title="Bio" />
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
      <SectionTitle
        title="Interests"
        subtitle={interests.length > 0 ? `${interests.length} of ${MAX_INTERESTS} picked` : undefined}
      />
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
              accessibilityState={{ selected, disabled: atCap }}
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
    </BaseModal>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  scoreHint: {
    fontSize: fontScale(11),
    marginTop: responsiveSpacing.xs,
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
    minHeight: touchTargets.minimum,
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
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '600',
  },
});
