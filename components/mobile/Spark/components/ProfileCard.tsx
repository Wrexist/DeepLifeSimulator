/**
 * ProfileCard - single swipeable dating profile card.
 *
 * Used inside SwipeScreen's card stack. Renders one DatingProfile with photo,
 * name + age, distance, bio, interests pills, and "LIKE" / "NOPE" / "SUPER"
 * watermark stamps that fade in as the user drags.
 *
 * The drag/swipe gesture is handled by the parent (SwipeScreen) - this card
 * just renders.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapPin, Briefcase, GraduationCap, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { SPARK_COLORS } from '../styles/sparkTheme';
import type { DatingProfile } from '@/lib/dating/datingProfiles';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';

// Scrim fade steps, top→bottom. Alphas stay small where the step edge crosses
// the photo's midsection and only grow near the identity text, so the stacked
// flat layers read as a fade rather than horizontal bands.
const SCRIM_STEPS = [
  { height: '64%', alpha: 0.1 },
  { height: '50%', alpha: 0.12 },
  { height: '38%', alpha: 0.16 },
  { height: '28%', alpha: 0.2 },
  { height: '19%', alpha: 0.26 },
  { height: '13%', alpha: 0.34 },
  { height: '8%', alpha: 0.44 },
] as const;

interface ProfileCardProps {
  profile: DatingProfile;
  /** Visible 'like' watermark opacity (0-1) when the user is dragging right. */
  likeOpacity?: number;
  /** Visible 'nope' watermark opacity (0-1) when the user is dragging left. */
  nopeOpacity?: number;
  /** Visible 'super' watermark opacity (0-1) when the user is dragging up. */
  superOpacity?: number;
  /** True when this profile is flagged as a likely catfish. */
  catfishSuspected?: boolean;
}

const WEALTH_LABEL: Record<string, string> = {
  poor: 'Working class',
  average: 'Comfortable',
  wealthy: 'Wealthy',
  millionaire: 'Millionaire',
};

export default function ProfileCard({
  profile, likeOpacity = 0, nopeOpacity = 0, superOpacity = 0, catfishSuspected,
}: ProfileCardProps) {
  const { theme, isDark } = useTheme();

  return (
    // Anatomy: outer carries the L2 glass shadow + radius + border + solid fill;
    // inner clips the photo/overlays (never put overflow:hidden on the shadow view).
    <View
      style={[
        getGlassCard(isDark, 12),
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isDark ? theme.glassBorder : theme.border,
        },
      ]}
    >
      <View style={styles.cardInner}>
        {/* The card used to be a full-bleed portrait. A vector face is square
            and circular, so it is centred on the card's own field instead of
            stretched to fill - and sits high enough to clear the text scrim. */}
        <View style={styles.photo}>
          <CharacterAvatar
            seed={profile.id}
            sex={profile.gender}
            age={profile.age}
            size={scale(196)}
          />
        </View>

        {/* Bottom scrim so identity text stays legible on any photo. Stacked
            translucent steps rather than a gradient - gentle alpha jumps up top
            (over the face), heavier ones only near the text so no single edge
            reads as a band, and the Gradient fallback (which renders colors[0]
            flat) can never turn the scrim into a solid slab. */}
        {SCRIM_STEPS.map((s) => (
          <View
            key={s.height}
            pointerEvents="none"
            style={[styles.scrimStep, { height: s.height, backgroundColor: `rgba(0,0,0,${s.alpha})` }]}
          />
        ))}
        {/* Lit top edge - hero-only highlight (dark mode). */}
        {isDark ? <View pointerEvents="none" style={styles.topHairline} /> : null}

        {/* Catfish suspicion chip */}
        {catfishSuspected ? (
          <View style={styles.catfishChip}>
            <AlertCircle size={fontScale(12)} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.catfishChipText}>Suspicious profile</Text>
          </View>
        ) : null}

        {/* LIKE stamp */}
        {likeOpacity > 0 ? (
          <View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
            <Text style={[styles.stampText, { color: SPARK_COLORS.success }]}>LIKE</Text>
          </View>
        ) : null}
        {/* NOPE stamp */}
        {nopeOpacity > 0 ? (
          <View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
            <Text style={[styles.stampText, { color: SPARK_COLORS.danger }]}>NOPE</Text>
          </View>
        ) : null}
        {/* SUPER stamp */}
        {superOpacity > 0 ? (
          <View style={[styles.stamp, styles.stampSuper, { opacity: superOpacity }]}>
            <Text style={[styles.stampText, { color: SPARK_COLORS.superLike }]}>SUPER</Text>
          </View>
        ) : null}

        {/* Identity */}
        <View style={styles.identityBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.age}>{profile.age}</Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MapPin size={fontScale(12)} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaText}>{profile.distance} mi</Text>
            </View>
            <View style={styles.metaItem}>
              <Briefcase size={fontScale(12)} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaText} numberOfLines={1}>{profile.job}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <GraduationCap size={fontScale(12)} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaText} numberOfLines={1}>{profile.education}</Text>
            </View>
            <View style={styles.wealthChip}>
              <Text style={styles.wealthChipText}>{WEALTH_LABEL[profile.wealth] ?? profile.wealth}</Text>
            </View>
          </View>

          <Text style={styles.bio} numberOfLines={3}>
            {profile.bio}
          </Text>

          <View style={styles.interests}>
            {profile.interests.slice(0, 4).map((interest) => (
              <View key={interest} style={styles.interestPill}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
  },
  cardInner: {
    flex: 1,
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    // Sits above centre so the identity text and its scrim do not cover the face.
    justifyContent: 'flex-start',
    paddingTop: '14%',
  },
  // Stacked scrim layers (fallback gradient renders flat, so we fake the fade).
  scrimStep: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  catfishChip: {
    position: 'absolute',
    top: scale(16),
    left: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
  },
  catfishChipText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '600',
  },
  stamp: {
    position: 'absolute',
    top: scale(40),
    paddingHorizontal: scale(20),
    paddingVertical: scale(8),
    borderRadius: scale(8),
    borderWidth: 4,
  },
  stampLike: {
    right: scale(24),
    transform: [{ rotate: '-15deg' }],
    borderColor: SPARK_COLORS.success,
  },
  stampNope: {
    left: scale(24),
    transform: [{ rotate: '15deg' }],
    borderColor: SPARK_COLORS.danger,
  },
  stampSuper: {
    alignSelf: 'center',
    left: '50%',
    marginLeft: scale(-50),
    borderColor: SPARK_COLORS.superLike,
  },
  stampText: {
    fontSize: fontScale(28),
    fontWeight: '600',
    letterSpacing: 2,
  },
  identityBlock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: responsiveSpacing.lg,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  // The card's one headline.
  name: {
    color: '#FFFFFF',
    fontSize: fontScale(28),
    fontWeight: '700',
    flexShrink: 1,
  },
  age: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontScale(22),
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontScale(12),
  },
  wealthChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  wealthChipText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '600',
  },
  bio: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontScale(13),
    marginTop: 8,
    lineHeight: fontScale(18),
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  interestPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  interestText: {
    color: '#FFFFFF',
    fontSize: fontScale(11),
    fontWeight: '500',
  },
});
