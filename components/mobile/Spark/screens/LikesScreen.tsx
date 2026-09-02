/**
 * LikesScreen - the "who liked you" inbox that finally delivers the Ultra
 * "See who liked you" perk.
 *
 * - Ultra (premium.perks.seeWhoLikedYou): full reveal of each profile that
 *   liked the player, with tap-to-instant-match (Like back) and Dismiss.
 * - Free / Plus: a blurred count teaser + upsell CTA (the identities stay
 *   hidden), so the accruing `likedYou` state stops being invisible.
 */
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Heart, Star, X, Crown } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { likeBackFromLikedYou, dismissLikedYou } from '@/contexts/game/actions/SparkActions';
import EmptyState from '../components/EmptyState';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = Gradient;

interface LikesScreenProps {
  onOpenChat: (matchId: string) => void;
  onOpenPremium: () => void;
}

export default function LikesScreen({ onOpenChat, onOpenPremium }: LikesScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme, isDark } = useTheme();

  const sp = gameState.sparkApp;
  const likedYou = sp?.likedYou ?? [];
  const canSee = sp?.premium?.perks?.seeWhoLikedYou === true;

  const findProfile = useCallback((id: string) => DATING_PROFILES.find((p) => p.id === id), []);

  const handleLikeBack = useCallback(
    (profileId: string) => {
      const r = likeBackFromLikedYou(setGameState, gameState, profileId);
      if (r.success) {
        sparkHaptics.match();
        saveGame();
        if (r.matchId) onOpenChat(r.matchId);
      } else {
        sparkHaptics.error();
      }
    },
    [setGameState, gameState, saveGame, onOpenChat],
  );

  const handleDismiss = useCallback(
    (profileId: string) => {
      dismissLikedYou(setGameState, profileId);
      sparkHaptics.tap();
      saveGame();
    },
    [setGameState, saveGame],
  );

  if (likedYou.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          observation="Nobody in your Likes yet."
          nudge="Keep an active profile and boost to draw more likes your way."
        />
      </View>
    );
  }

  // ── Locked teaser (free / Plus) ──
  if (!canSee) {
    return (
      <View style={styles.lockedWrap}>
        <View
          style={[
            getGlassCard(isDark, 12),
            styles.lockedCard,
            { backgroundColor: theme.surface, borderColor: isDark ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.lockedInner}>
            <View style={[styles.lockedBadge, { backgroundColor: withAlpha(SPARK_COLORS.accent, 0.16) }]}>
              <Heart size={scale(30)} color={SPARK_COLORS.accent} fill={SPARK_COLORS.accent} strokeWidth={2} />
            </View>
            <Text style={[styles.lockedCount, { color: theme.text }]}>
              {likedYou.length} {likedYou.length === 1 ? 'person likes' : 'people like'} you
            </Text>
            <Text style={[styles.lockedSub, { color: theme.textSecondary }]}>
              Upgrade to Spark Ultra to see exactly who liked you - and match instantly.
            </Text>

            {/* Blurred avatar rail teaser. */}
            <View style={styles.blurRail}>
              {likedYou.slice(0, 5).map((entry) => {
                const profile = findProfile(entry.profileId);
                if (!profile) return null;
                return (
                  <View key={entry.profileId} style={[styles.blurAvatarRing, { borderColor: theme.glassBorder }]}>
                    {/* The face is deliberately obscured - this rail teases who
                        liked you behind the paywall. `blurRadius` is an Image-only
                        prop and does nothing to an SVG, so the identity is hidden
                        by the scrim over it rather than by a blur. */}
                    <CharacterAvatar
                      seed={profile.id}
                      sex={profile.gender}
                      age={profile.age}
                      size={scale(48)}
                    />
                    <View style={styles.blurScrim} />
                  </View>
                );
              })}
            </View>

            <Pressable
              onPress={onOpenPremium}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Spark Ultra"
              style={styles.upsellCta}
            >
              <LinearGradient
                colors={SPARK_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upsellFill}
              >
                <Crown size={fontScale(16)} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.upsellText}>See who liked you</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Full reveal (Ultra) ──
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <SectionTitle
        title={`${likedYou.length} ${likedYou.length === 1 ? 'like' : 'likes'}`}
        subtitle="Tap the heart to match instantly."
        style={styles.revealHeader}
      />
      {likedYou.map((entry) => {
        const profile = findProfile(entry.profileId);
        if (!profile) return null;
        return (
          <View
            key={entry.profileId}
            style={[
              getGlassCard(isDark, 6),
              styles.likeRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.likeAvatarWrap}>
              <View style={[styles.likeAvatar, { borderColor: theme.glassBorder }]}>
                <CharacterAvatar
                  seed={profile.id}
                  sex={profile.gender}
                  age={profile.age}
                  size={scale(50)}
                />
              </View>
              {entry.superLiked ? (
                <View style={styles.superBadge}>
                  <Star size={fontScale(10)} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <View style={styles.likeBody}>
              <Text style={[styles.likeName, { color: theme.text }]} numberOfLines={1}>
                {profile.name}
                {profile.age ? `, ${profile.age}` : ''}
              </Text>
              <Text style={[styles.likeJob, { color: theme.textSecondary }]} numberOfLines={1}>
                {entry.superLiked ? 'Super liked you · ' : ''}{profile.job}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDismiss(entry.profileId)}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${profile.name}`}
              hitSlop={8}
              style={[styles.iconBtn, { borderColor: theme.border }]}
            >
              <X size={fontScale(18)} color={theme.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => handleLikeBack(entry.profileId)}
              accessibilityRole="button"
              accessibilityLabel={`Like ${profile.name} back and match`}
              hitSlop={8}
              style={[styles.likeBackBtn, { backgroundColor: SPARK_COLORS.accent }]}
            >
              <Heart size={fontScale(18)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: responsiveSpacing.sm,
    paddingBottom: scale(120),
    paddingHorizontal: responsiveSpacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  revealHeader: {
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.xs,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.sm,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  likeAvatarWrap: {},
  likeAvatar: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    borderWidth: 1,
  },
  superBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: SPARK_COLORS.superLike,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  likeBody: { flex: 1 },
  likeName: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  likeJob: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  iconBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBackBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: touchTargets.minimum / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.lg,
  },
  lockedCard: {
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
  },
  lockedInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    alignItems: 'center',
  },
  lockedBadge: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  // The locked screen's one headline.
  lockedCount: {
    fontSize: fontScale(20),
    fontWeight: '700',
    textAlign: 'center',
  },
  lockedSub: {
    fontSize: fontScale(13),
    textAlign: 'center',
    marginTop: 6,
    marginBottom: responsiveSpacing.md,
    lineHeight: fontScale(19),
  },
  blurRail: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.lg,
  },
  blurAvatarRing: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: 1,
    overflow: 'hidden',
  },
  blurScrim: {
    ...StyleSheet.absoluteFillObject,
    // Raised from 0.18: this used to sit over an already-blurred Image and only
    // needed to tint it. It is now the ONLY thing hiding the face, so it has to
    // actually obscure - at 0.18 the paywalled identity was legible.
    backgroundColor: 'rgba(136, 32, 66, 0.82)',
  },
  upsellCta: {
    alignSelf: 'stretch',
    borderRadius: scale(14),
    overflow: 'hidden',
    minHeight: touchTargets.minimum,
  },
  upsellFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: responsiveSpacing.md,
  },
  upsellText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '600',
  },
});
