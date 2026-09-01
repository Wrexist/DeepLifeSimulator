/**
 * SparkApp - root shell for the in-game Spark dating platform.
 *
 * Mounts when the player taps the dating tile from the phone shell. Owns:
 *   - Internal nav state machine (no React Navigation nested container)
 *   - 4-tab bottom bar (Swipe / Matches / Likes / Profile)
 *   - Modal host (boost, premium upsell)
 *   - Match celebration banner overlay
 *   - Chat overlay route (full-screen above the tab bar)
 *
 * The existing DatingActions (goOnDate, giveGift, proposeMarriage, planWedding,
 * fileDivorce) remain canonical for relationship progression - Spark surfaces
 * a match → promotes it to a Relationship → and the rest of the dating flow
 * uses DatingActions via the existing WeddingPlanningModal etc.
 */
import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Crown, Flame, Heart, MessageCircle, Pencil, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { HeaderChip } from '@/components/ui/AppHeader';
import Chip from '@/components/ui/Chip';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import StatStrip from '@/components/ui/StatStrip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, responsiveIconSize, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { SPARK_COLORS } from './styles/sparkTheme';
import SwipeScreen from './screens/SwipeScreen';
import MatchesScreen from './screens/MatchesScreen';
import LikesScreen from './screens/LikesScreen';
import ChatScreen from './screens/ChatScreen';
import PartnerProfileScreen from './screens/PartnerProfileScreen';
import BoostModal from './modals/BoostModal';
import JealousyModal from './modals/JealousyModal';
import SparkPremiumUpsellModal from './modals/SparkPremiumUpsellModal';
import SparkProfileEditModal from './modals/SparkProfileEditModal';
import MatchBanner from './components/MatchBanner';
import { type DatingProfile } from '@/lib/dating/datingProfiles';
import { scorePlayerProfile } from '@/lib/dating/sparkLogic';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';

type SparkTab = 'swipe' | 'matches' | 'likes' | 'profile';

interface SparkAppProps {
  onBack: () => void;
}

export default function SparkApp({ onBack }: SparkAppProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SparkTab>('swipe');
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [showBoost, setShowBoost] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [jealousyDismissed, setJealousyDismissed] = useState(false);
  const [matchBanner, setMatchBanner] = useState<{ matchId: string; profile: DatingProfile } | null>(null);

  const sp = gameState.sparkApp;
  const isPremium = sp?.premium?.active === true;
  const unreadCount = (sp?.matches ?? []).reduce((sum, m) => sum + (m.unreadByPlayer ?? 0), 0);
  const likesCount = (sp?.likedYou ?? []).length;
  // Surface an unresolved jealousy event on open. Resolving it clears
  // activeJealousy (and un-sticks the tick's permanent-block bug); the local
  // dismiss just hides the sheet for this session without resolving.
  const activeJealousy = sp?.activeJealousy ?? null;

  const handleMatch = useCallback((matchId: string, profile: DatingProfile) => {
    setMatchBanner({ matchId, profile });
  }, []);

  const openChat = useCallback((id: string) => {
    setOpenChatId(id);
    setMatchBanner(null);
  }, []);

  // Partner profile overlay intercepts the entire body when active (sits
  // above chat - opened FROM chat via the header profile button).
  if (openProfileId) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <PartnerProfileScreen
          matchId={openProfileId}
          onBack={() => setOpenProfileId(null)}
          onClosed={() => {
            // After unmatch/report the match is gone - return to matches tab.
            setOpenProfileId(null);
            setOpenChatId(null);
            setActiveTab('matches');
          }}
        />
      </View>
    );
  }

  // Chat overlay intercepts the entire body when active.
  if (openChatId) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ChatScreen
          matchId={openChatId}
          onBack={() => setOpenChatId(null)}
          onOpenPartnerProfile={(relId) => setOpenProfileId(relId)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        title="spark"
        onBack={onBack}
        backLabel="Back to phone home"
        right={
          <HeaderChip
            label={isPremium ? 'Spark plan' : 'Spark Premium'}
            value={isPremium ? (sp?.premium?.tier === 'ultra' ? 'Ultra' : 'Plus') : 'Upgrade'}
            tint={isPremium ? SPARK_COLORS.tierUltra : SPARK_COLORS.accent}
            icon={
              <Crown
                size={fontScale(13)}
                color={isPremium ? SPARK_COLORS.tierUltra : SPARK_COLORS.accent}
              />
            }
            onPress={() => setShowPremium(true)}
          />
        }
      />

      {/* Body */}
      <View style={styles.body}>
        {activeTab === 'swipe' && (
          <SwipeScreen
            onMatch={handleMatch}
            onOpenBoost={() => setShowBoost(true)}
            onOpenPremium={() => setShowPremium(true)}
          />
        )}
        {activeTab === 'matches' && (
          <MatchesScreen
            onOpenChat={openChat}
            onOpenSwipe={() => setActiveTab('swipe')}
          />
        )}
        {activeTab === 'likes' && (
          <LikesScreen
            onOpenChat={openChat}
            onOpenPremium={() => setShowPremium(true)}
          />
        )}
        {activeTab === 'profile' && <ProfileTab onEditProfile={() => setShowProfileEdit(true)} />}
      </View>

      {/* Bottom tab bar - padded so it clears the floating phone tab bar. */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <TabBtn
          icon={Flame}
          label="Swipe"
          active={activeTab === 'swipe'}
          onPress={() => setActiveTab('swipe')}
          color={SPARK_COLORS.accent}
          mutedColor={theme.textMuted}
        />
        {/* The count lives on the badge only - repeating it in the label made
            every screen reader say the number twice. */}
        <TabBtn
          icon={MessageCircle}
          label="Matches"
          active={activeTab === 'matches'}
          onPress={() => setActiveTab('matches')}
          color={SPARK_COLORS.accent}
          mutedColor={theme.textMuted}
          badge={unreadCount > 0 ? unreadCount : undefined}
          badgeLabel="unread"
        />
        <TabBtn
          icon={Heart}
          label="Likes"
          active={activeTab === 'likes'}
          onPress={() => setActiveTab('likes')}
          color={SPARK_COLORS.accent}
          mutedColor={theme.textMuted}
          badge={likesCount > 0 ? likesCount : undefined}
          badgeLabel="new"
        />
        <TabBtn
          icon={User}
          label="Profile"
          active={activeTab === 'profile'}
          onPress={() => setActiveTab('profile')}
          color={SPARK_COLORS.accent}
          mutedColor={theme.textMuted}
        />
      </View>

      {/* Modals */}
      <BoostModal visible={showBoost} onDismiss={() => setShowBoost(false)} />
      <SparkPremiumUpsellModal visible={showPremium} onDismiss={() => setShowPremium(false)} />
      <SparkProfileEditModal visible={showProfileEdit} onDismiss={() => setShowProfileEdit(false)} />
      <JealousyModal
        visible={!!activeJealousy && !jealousyDismissed}
        onDismiss={() => setJealousyDismissed(true)}
      />

      {/* Match celebration overlay */}
      {matchBanner ? (
        <MatchBanner
          visible
          partnerName={matchBanner.profile.name}
          partnerFace={matchBanner.profile}
          playerPhoto={gameState.userProfile?.profilePhoto}
          onMessage={() => openChat(matchBanner.matchId)}
          onDismiss={() => setMatchBanner(null)}
        />
      ) : null}
    </View>
  );
}

type TabIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function TabBtn({
  icon: Icon, label, active, onPress, color, mutedColor, badge, badgeLabel,
}: {
  icon: TabIcon;
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
  mutedColor: string;
  badge?: number;
  /** What the badge counts, for screen readers ("unread", "new"). */
  badgeLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badge && badgeLabel ? `${label}, ${badge} ${badgeLabel}` : label}
      style={styles.tabBtn}
      hitSlop={4}
    >
      <View>
        <Icon size={responsiveIconSize.md} color={active ? color : mutedColor} strokeWidth={active ? 2.4 : 2} />
        {badge !== undefined && badge > 0 ? (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, { color: active ? color : mutedColor, fontWeight: active ? '600' : '400' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProfileTab({ onEditProfile }: { onEditProfile: () => void }) {
  const { gameState } = useGame();
  const { theme, isDark } = useTheme();
  const sp = gameState.sparkApp;
  const stats = sp?.lifetimeStats;
  const profile = gameState.userProfile ?? {};
  const sparkProfile = sp?.profile;
  const profileScore = scorePlayerProfile(gameState);
  // R6-A: track image load failure separately from missing-uri.
  const [sparkProfileAvatarErrored, setSparkProfileAvatarErrored] = useState(false);
  const premiumTier = sp?.premium?.active ? (sp.premium.tier === 'ultra' ? 'Ultra' : 'Plus') : 'Free';

  return (
    <ScrollView contentContainerStyle={styles.profileWrap} showsVerticalScrollIndicator={false}>
      <View
        style={[
          getGlassCard(isDark, 12),
          styles.profileHeroCard,
          { backgroundColor: theme.surface, borderColor: isDark ? theme.glassBorder : theme.border },
        ]}
      >
        <View style={styles.profileHeroInner}>
          <View style={[styles.profileAvatar, { backgroundColor: withAlpha(SPARK_COLORS.accent, 0.16) }]}>
            {/* R6-A: also fall back on Image load failure. */}
            {profile.profilePhoto && !sparkProfileAvatarErrored ? (
              <Image
                source={{ uri: profile.profilePhoto }}
                style={styles.profileAvatarImg}
                onError={() => setSparkProfileAvatarErrored(true)}
              />
            ) : (
              /* No `profile.gender` guard: it used to drop the player to a
                 letter whenever gender was unset, and `toAvatarSex` already
                 has a safe default. A face is always better than an initial. */
              <CharacterAvatar
                source={profile}
                seed={profile.name ?? profile.displayName}
                sex={profile.gender}
                age={gameState.date?.age ?? 25}
                size={scale(96)}
              />
            )}
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>
            {profile.displayName || profile.name || 'You'}
            {gameState.date?.age ? `, ${Math.floor(gameState.date.age)}` : ''}
          </Text>
          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel="Edit your Spark profile"
            style={styles.bioPressable}
          >
            {sparkProfile?.bio ? (
              <Text style={[styles.profileBio, { color: theme.textSecondary }]}>{sparkProfile.bio}</Text>
            ) : (
              <Text style={[styles.profileBio, { color: theme.textMuted, fontStyle: 'italic' }]}>
                Add a bio to attract more matches
              </Text>
            )}
            {sparkProfile?.interests && sparkProfile.interests.length > 0 ? (
              <View style={styles.interestRow}>
                {sparkProfile.interests.slice(0, 6).map((interest) => (
                  <Chip key={interest} label={interest} />
                ))}
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={[styles.editProfileBtn, { borderColor: theme.border }]}
          >
            <Pencil size={fontScale(13)} color={theme.text} />
            <Text style={[styles.editProfileText, { color: theme.text }]}>Edit profile</Text>
          </Pressable>
        </View>
      </View>

      {/* The four numbers a player actually decides on. The other seven are a
          record of what happened, not an input - they live behind "All stats". */}
      <StatStrip
        items={[
          { label: 'Matches', value: stats?.totalMatches ?? 0 },
          { label: 'Dates', value: stats?.totalDatesGoneOn ?? 0 },
          { label: 'Marriages', value: stats?.totalMarriages ?? 0 },
          { label: 'Profile', value: `${profileScore}/100`, sub: 'strength', tint: SPARK_COLORS.accent },
        ]}
      />

      <CollapsibleSection
        id="spark-all-stats"
        title="All stats"
        defaultCollapsed
        tint={SPARK_COLORS.accent}
        summary={`${stats?.totalSwipes ?? 0} swipes · ${premiumTier}`}
      >
        <StatRow label="Profile strength" value={`${profileScore}/100`} theme={theme} />
        <StatRow label="Total swipes" value={String(stats?.totalSwipes ?? 0)} theme={theme} />
        <StatRow label="Matches" value={String(stats?.totalMatches ?? 0)} theme={theme} />
        <StatRow label="Super-likes used" value={String(stats?.totalSuperLikes ?? 0)} theme={theme} />
        <StatRow label="Dates gone on" value={String(stats?.totalDatesGoneOn ?? 0)} theme={theme} />
        <StatRow label="Gifts given" value={String(stats?.totalGiftsGiven ?? 0)} theme={theme} />
        <StatRow label="Proposals" value={String(stats?.totalProposals ?? 0)} theme={theme} />
        <StatRow label="Marriages" value={String(stats?.totalMarriages ?? 0)} theme={theme} />
        <StatRow label="Divorces" value={String(stats?.totalDivorces ?? 0)} theme={theme} />
        <StatRow label="Catfish exposed" value={String(stats?.totalCatfishExposed ?? 0)} theme={theme} />
        <StatRow label="Premium tier" value={premiumTier} theme={theme} />
      </CollapsibleSection>
    </ScrollView>
  );
}

function StatRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.xs,
    paddingBottom: responsiveSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: fontScale(10),
    marginTop: 2,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: SPARK_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: fontScale(9),
    fontWeight: '600',
  },
  profileWrap: {
    paddingHorizontal: responsiveSpacing.lg,
    paddingTop: responsiveSpacing.lg,
    paddingBottom: scale(120),
    gap: responsiveSpacing.lg,
  },
  profileHeroCard: {
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
  },
  profileHeroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    alignItems: 'center',
  },
  profileAvatar: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: scale(48),
  },
  profileName: {
    fontSize: fontScale(20),
    fontWeight: '600',
    marginTop: responsiveSpacing.sm,
  },
  profileBio: {
    fontSize: fontScale(13),
    textAlign: 'center',
    marginTop: 4,
  },
  bioPressable: {
    alignItems: 'center',
    marginTop: 2,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(6),
    marginTop: responsiveSpacing.sm,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: responsiveSpacing.md,
  },
  editProfileText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: { fontSize: fontScale(13) },
  statValue: { fontSize: fontScale(14), fontWeight: '600', fontVariant: ['tabular-nums'] },
});
