/**
 * SparkApp — root shell for the in-game Spark dating platform.
 *
 * Mounts when the player taps the dating tile from the phone shell. Owns:
 *   - Internal nav state machine (no React Navigation nested container)
 *   - 3-tab bottom bar (Swipe / Matches / Profile)
 *   - Modal host (boost, premium upsell)
 *   - Match celebration banner overlay
 *   - Chat overlay route (full-screen above the tab bar)
 *
 * The existing DatingActions (goOnDate, giveGift, proposeMarriage, planWedding,
 * fileDivorce) remain canonical for relationship progression — Spark surfaces
 * a match → promotes it to a Relationship → and the rest of the dating flow
 * uses DatingActions via the existing WeddingPlanningModal etc.
 */
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Crown, Flame, Heart, MessageCircle, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { SPARK_GRADIENT, SPARK_COLORS } from './styles/sparkTheme';
import SwipeScreen from './screens/SwipeScreen';
import MatchesScreen from './screens/MatchesScreen';
import ChatScreen from './screens/ChatScreen';
import PartnerProfileScreen from './screens/PartnerProfileScreen';
import BoostModal from './modals/BoostModal';
import SparkPremiumUpsellModal from './modals/SparkPremiumUpsellModal';
import MatchBanner from './components/MatchBanner';
import { getDatingProfileImage, type DatingProfile } from '@/lib/dating/datingProfiles';

const LinearGradient = LinearGradientFallback;

type SparkTab = 'swipe' | 'matches' | 'profile';

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
  const [matchBanner, setMatchBanner] = useState<{ matchId: string; profile: DatingProfile } | null>(null);

  const sp = gameState.sparkApp;
  const isPremium = sp?.premium?.active === true;
  const unreadCount = (sp?.matches ?? []).reduce((sum, m) => sum + (m.unreadByPlayer ?? 0), 0);

  const handleMatch = useCallback((matchId: string, profile: DatingProfile) => {
    setMatchBanner({ matchId, profile });
  }, []);

  const openChat = useCallback((id: string) => {
    setOpenChatId(id);
    setMatchBanner(null);
  }, []);

  // Partner profile overlay intercepts the entire body when active (sits
  // above chat — opened FROM chat via the header avatar button).
  if (openProfileId) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <PartnerProfileScreen
          matchId={openProfileId}
          onBack={() => setOpenProfileId(null)}
          onClosed={() => {
            // After unmatch/report the match is gone — return to matches tab.
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
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to phone home"
          hitSlop={8}
          style={styles.headerBtn}
        >
          <ArrowLeft size={responsiveIconSize.md} color={theme.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <LinearGradient
            colors={SPARK_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.wordmarkPill}
          >
            <Flame size={fontScale(12)} color="#FFFFFF" strokeWidth={2.6} fill="#FFFFFF" />
            <Text style={styles.wordmarkText}>spark</Text>
          </LinearGradient>
        </View>

        <Pressable
          onPress={() => setShowPremium(true)}
          accessibilityRole="button"
          accessibilityLabel={isPremium ? `Spark ${sp!.premium.tier}` : 'Upgrade to Spark Premium'}
          hitSlop={8}
          style={styles.headerBtn}
        >
          {isPremium ? (
            <Crown size={responsiveIconSize.md} color={SPARK_COLORS.tierUltra} fill={SPARK_COLORS.tierUltra} />
          ) : (
            <Crown size={responsiveIconSize.md} color={theme.textSecondary} />
          )}
        </Pressable>
      </View>

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
        {activeTab === 'profile' && <ProfileTab />}
      </View>

      {/* Bottom tab bar — padded so it clears the floating phone tab bar. */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <TabBtn
          icon={Flame}
          label="Swipe"
          active={activeTab === 'swipe'}
          onPress={() => setActiveTab('swipe')}
          color={theme.text}
          mutedColor={theme.textSecondary}
        />
        <TabBtn
          icon={MessageCircle}
          label={`Matches${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          active={activeTab === 'matches'}
          onPress={() => setActiveTab('matches')}
          color={theme.text}
          mutedColor={theme.textSecondary}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
        <TabBtn
          icon={User}
          label="Profile"
          active={activeTab === 'profile'}
          onPress={() => setActiveTab('profile')}
          color={theme.text}
          mutedColor={theme.textSecondary}
        />
      </View>

      {/* Modals */}
      <BoostModal visible={showBoost} onDismiss={() => setShowBoost(false)} />
      <SparkPremiumUpsellModal visible={showPremium} onDismiss={() => setShowPremium(false)} />

      {/* Match celebration overlay */}
      {matchBanner ? (
        <MatchBanner
          visible
          partnerName={matchBanner.profile.name}
          partnerPhoto={undefined}
          playerPhoto={gameState.userProfile?.profilePhoto}
          onMessage={() => openChat(matchBanner.matchId)}
          onDismiss={() => setMatchBanner(null)}
        />
      ) : null}
    </View>
  );
}

function TabBtn({
  icon: Icon, label, active, onPress, color, mutedColor, badge,
}: {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
  mutedColor: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
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

function ProfileTab() {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const sp = gameState.sparkApp;
  const stats = sp?.lifetimeStats;
  const profile = gameState.userProfile ?? {};
  const sparkProfile = sp?.profile;
  // R6-A: track image load failure separately from missing-uri.
  const [sparkProfileAvatarErrored, setSparkProfileAvatarErrored] = useState(false);

  return (
    <View style={styles.profileWrap}>
      <View style={styles.profileHero}>
        <LinearGradient
          colors={SPARK_GRADIENT as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileAvatar}
        >
          {/* R6-A: also fall back on Image load failure. */}
          {profile.profilePhoto && !sparkProfileAvatarErrored ? (
            <Image
              source={{ uri: profile.profilePhoto }}
              style={styles.profileAvatarImg}
              onError={() => setSparkProfileAvatarErrored(true)}
            />
          ) : profile.gender ? (
            <Image source={getDatingProfileImage(profile.gender)} style={styles.profileAvatarImg} />
          ) : (
            <Text style={styles.profileAvatarInitial}>
              {(profile.displayName || profile.name || 'Y').slice(0, 1).toUpperCase()}
            </Text>
          )}
        </LinearGradient>
        <Text style={[styles.profileName, { color: theme.text }]}>
          {profile.displayName || profile.name || 'You'}
          {gameState.date?.age ? `, ${Math.floor(gameState.date.age)}` : ''}
        </Text>
        {sparkProfile?.bio ? (
          <Text style={[styles.profileBio, { color: theme.textSecondary }]}>{sparkProfile.bio}</Text>
        ) : (
          <Text style={[styles.profileBio, { color: theme.textMuted, fontStyle: 'italic' }]}>
            Add a bio to attract more matches
          </Text>
        )}
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <StatRow label="Total swipes" value={String(stats?.totalSwipes ?? 0)} theme={theme} />
        <StatRow label="Matches" value={String(stats?.totalMatches ?? 0)} theme={theme} />
        <StatRow label="Super-likes used" value={String(stats?.totalSuperLikes ?? 0)} theme={theme} />
        <StatRow label="Catfish exposed" value={String(stats?.totalCatfishExposed ?? 0)} theme={theme} />
        <StatRow
          label="Premium tier"
          value={
            sp?.premium?.active
              ? sp.premium.tier === 'ultra'
                ? 'Ultra'
                : 'Plus'
              : 'Free'
          }
          theme={theme}
        />
      </View>
    </View>
  );
}

function StatRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  wordmarkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: scale(12),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  wordmarkText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '700',
    letterSpacing: 0.4,
  },
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
    fontWeight: '800',
  },
  profileWrap: {
    flex: 1,
    paddingHorizontal: responsiveSpacing.lg,
    paddingTop: responsiveSpacing.lg,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
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
  profileAvatarInitial: {
    color: '#FFFFFF',
    fontSize: fontScale(36),
    fontWeight: '800',
  },
  profileName: {
    fontSize: fontScale(20),
    fontWeight: '700',
    marginTop: responsiveSpacing.sm,
  },
  profileBio: {
    fontSize: fontScale(13),
    textAlign: 'center',
    marginTop: 4,
  },
  statsCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: { fontSize: fontScale(13) },
  statValue: { fontSize: fontScale(14), fontWeight: '600' },
});
