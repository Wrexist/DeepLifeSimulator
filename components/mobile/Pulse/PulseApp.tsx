/**
 * PulseApp - root shell for the in-game Pulse social platform.
 *
 * Mounts when the player taps the Pulse tile from the phone shell. Owns:
 *   - Internal nav state machine (no React Navigation nested container)
 *   - Bottom 4-tab bar (Home / Trending / Alerts / DMs)
 *   - The modal host (composer, scandal recovery, verified-pro upsell)
 *   - The persistent ScandalBanner when a scandal is active
 *   - Profile + BrandDeals + LiveStream as overlay routes (no tab slot)
 *
 * Every top bar here - the home bar and the three overlay bars - is the shared
 * `AppHeader`. Five hand-rolled copies of the same three slots used to live in
 * this file and in PostDetailScreen / LiveStreamScreen.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Briefcase, Flame, Home, Mail, Radio } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { HeaderChip } from '@/components/ui/AppHeader';
import { useGame } from '@/contexts/GameContext';
import { areAdsRemoved } from '@/lib/ads/rewardedAd';
import { useTheme } from '@/hooks/useTheme';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, touchTargets, getTabBarSafePadding } from '@/utils/scaling';
import { useFullscreenApp } from '@/utils/fullscreenAppStore';
import { PULSE_COLORS } from './styles/pulseTheme';
import ScandalBanner from './components/ScandalBanner';
import FeedScreen from './screens/FeedScreen';
import TrendingScreen from './screens/TrendingScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MessagesScreen from './screens/MessagesScreen';
import ProfileScreen from './screens/ProfileScreen';
import BrandDealsScreen from './screens/BrandDealsScreen';
import LiveStreamScreen from './screens/LiveStreamScreen';
import InsightsScreen from './screens/InsightsScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import ComposeModal from './modals/ComposeModal';
import ScandalRecoveryModal from './modals/ScandalRecoveryModal';
import VerifiedProUpsellModal from './modals/VerifiedProUpsellModal';
import ProfileEditModal from './modals/ProfileEditModal';
import BoostPostModal from './modals/BoostPostModal';
import RewardedAdModal from './modals/RewardedAdModal';
import NpcProfileSheet, { type NpcStoryTarget } from './modals/NpcProfileSheet';
import { formatPulseNumber } from './utils/formatPulseNumber';

type PulseTab = 'home' | 'trending' | 'alerts' | 'dms';
/** Overlay routes - full-screen pushed above the tab bar. */
type PulseOverlay = 'profile' | 'brandDeals' | 'liveStream' | 'insights' | null;

interface PulseAppProps {
  onBack: () => void;
}

export default function PulseApp({ onBack }: PulseAppProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Remove Ads / DeepLife+ hides every "watch ad" affordance in Pulse.
  const adsRemoved = areAdsRemoved(gameState);
  // When the app runs full-screen the game tab bar is hidden, so only the home
  // indicator needs clearing at the bottom - not the (now absent) tab bar.
  const fullscreenApp = useFullscreenApp();
  const bottomInset = fullscreenApp ? insets.bottom : getTabBarSafePadding(insets.bottom);
  const [activeTab, setActiveTab] = useState<PulseTab>('home');
  const [overlay, setOverlay] = useState<PulseOverlay>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showScandalRecovery, setShowScandalRecovery] = useState(false);
  const [showProUpsell, setShowProUpsell] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [boostPostId, setBoostPostId] = useState<string | null>(null);
  const [showRewardedAd, setShowRewardedAd] = useState(false);
  // NPC tapped from the StoriesRail - drives the follow/unfollow sheet.
  const [sheetNpc, setSheetNpc] = useState<NpcStoryTarget | null>(null);

  const sm = gameState.socialMedia;
  const followers = sm?.followers ?? 0;
  const activeScandal = sm?.activeScandal ?? null;
  const profile = gameState.userProfile ?? {};
  const dealCount = (sm?.brandInbox?.pending?.length ?? 0) + (sm?.activeBrandDeals?.length ?? 0);

  const handleComposePress = useCallback(() => setShowComposer(true), []);
  const openPostDetail = useCallback((postId: string) => setDetailPostId(postId), []);
  const dismissPostDetail = useCallback(() => setDetailPostId(null), []);
  const openProfile = useCallback(() => setOverlay('profile'), []);
  const openBrandDeals = useCallback(() => setOverlay('brandDeals'), []);
  const openLive = useCallback(() => setOverlay('liveStream'), []);
  const openInsights = useCallback(() => setOverlay('insights'), []);
  const dismissOverlay = useCallback(() => setOverlay(null), []);
  const openProUpsell = useCallback(() => setShowProUpsell(true), []);
  const dismissProUpsell = useCallback(() => setShowProUpsell(false), []);
  const openNpcSheet = useCallback((npc: NpcStoryTarget) => setSheetNpc(npc), []);
  const dismissNpcSheet = useCallback(() => setSheetNpc(null), []);

  // Verified Pro is an IN-GAME cash subscription - the VerifiedProUpsellModal
  // owns the buy/cancel flow (charges stats.money via subscribeVerifiedPro). No
  // real-IAP path here anymore.

  // ── Route rendering ───────────────────────────────────────────────────────
  // One body, one modal host. The overlay routes used to be EARLY RETURNS, so
  // each of them had to re-declare the modals it needed - VerifiedProUpsellModal
  // and BoostPostModal were mounted twice, and a Boost tap on the profile
  // reached whichever copy happened to be mounted. Choosing the body instead of
  // returning early lets the host at the bottom serve every route once.
  let body: React.ReactNode;
  if (detailPostId) {
    body = <PostDetailScreen postId={detailPostId} onClose={dismissPostDetail} />;
  } else if (overlay === 'liveStream') {
    body = <LiveStreamScreen onClose={dismissOverlay} />;
  } else if (overlay === 'profile') {
    body = (
      <>
        <AppHeader
          title="Profile"
          onBack={dismissOverlay}
          backLabel="Back to feed"
          right={
            <View style={styles.headerActions}>
              <Pressable
                onPress={openBrandDeals}
                accessibilityRole="button"
                accessibilityLabel={dealCount > 0 ? `Brand deals, ${dealCount}` : 'Brand deals'}
                hitSlop={8}
                style={styles.headerBtnEnd}
              >
                <Briefcase size={responsiveIconSize.md} color={PULSE_COLORS.accent} />
              </Pressable>
              <Pressable
                onPress={openLive}
                accessibilityRole="button"
                accessibilityLabel="Go live"
                hitSlop={8}
                style={styles.headerBtnEnd}
              >
                <Radio size={responsiveIconSize.md} color={PULSE_COLORS.accent} />
              </Pressable>
            </View>
          }
        />
        <ProfileScreen
          onUpgradePro={openProUpsell}
          onOpenInsights={openInsights}
          onOpenPostDetail={openPostDetail}
          onBoostPost={(postId) => setBoostPostId(postId)}
          onEditProfile={() => setShowProfileEdit(true)}
        />
      </>
    );
  } else if (overlay === 'brandDeals') {
    body = (
      <>
        <AppHeader title="Brand Deals" onBack={dismissOverlay} backLabel="Back to feed" />
        <BrandDealsScreen />
      </>
    );
  } else if (overlay === 'insights') {
    body = (
      <>
        <AppHeader
          title="Creator Studio"
          onBack={dismissOverlay}
          backLabel="Back to feed"
          right={
            <HeaderChip label="Followers" value={formatPulseNumber(followers)} tint={PULSE_COLORS.accent} />
          }
        />
        <InsightsScreen onUpgradePro={openProUpsell} />
      </>
    );
  } else {
    body = (
      <>
        {/* ── Header ──────────────────────────────────────────── */}
        <AppHeader
          title="pulse"
          onBack={onBack}
          backLabel="Back to phone home"
          right={
            <HeaderChip
              label="Followers"
              value={formatPulseNumber(followers)}
              tint={PULSE_COLORS.accent}
              icon={
                profile.name ? (
                  /* The player's own face - the one place in the app where they
                     could not see themselves before. */
                  <CharacterAvatar
                    source={profile}
                    seed={profile.name}
                    sex={profile.sex}
                    age={gameState.date?.age ?? 25}
                    size={scale(20)}
                  />
                ) : undefined
              }
              onPress={openProfile}
            />
          }
        />

        {/* ── Sticky scandal banner ──────────────────────────── */}
        {activeScandal ? (
          <ScandalBanner scandal={activeScandal} onPress={() => setShowScandalRecovery(true)} />
        ) : null}

        {/* ── Tab body ─────────────────────────────────────────── */}
        <View style={styles.body}>
          {activeTab === 'home' && (
            <FeedScreen
              onCompose={handleComposePress}
              onOpenPostDetail={openPostDetail}
              onGoLive={openLive}
              onBoostPost={(postId) => setBoostPostId(postId)}
              onTapNpc={openNpcSheet}
            />
          )}
          {activeTab === 'trending' && <TrendingScreen />}
          {activeTab === 'alerts' && (
            <NotificationsScreen
              onOpenBrandDeals={openBrandDeals}
              onOpenPostDetail={openPostDetail}
              onOpenScandalRecovery={() => setShowScandalRecovery(true)}
              onWatchAd={adsRemoved ? undefined : () => setShowRewardedAd(true)}
            />
          )}
          {activeTab === 'dms' && <MessagesScreen onBack={() => setActiveTab('home')} />}
        </View>

        {/* ── Bottom tab bar ──────────────────────────────────── */}
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
              // Absorb the safe-area inset here so the bar reaches the screen edge.
              paddingBottom: responsiveSpacing.sm + bottomInset,
            },
          ]}
          accessibilityRole="tablist"
        >
          <TabButton Icon={Home} label="Home" active={activeTab === 'home'} onPress={() => setActiveTab('home')} color={theme.text} mutedColor={theme.textSecondary} />
          <TabButton Icon={Flame} label="Trending" active={activeTab === 'trending'} onPress={() => setActiveTab('trending')} color={theme.text} mutedColor={theme.textSecondary} />
          <TabButton Icon={Bell} label="Alerts" active={activeTab === 'alerts'} onPress={() => setActiveTab('alerts')} color={theme.text} mutedColor={theme.textSecondary} />
          <TabButton Icon={Mail} label="DMs" active={activeTab === 'dms'} onPress={() => setActiveTab('dms')} color={theme.text} mutedColor={theme.textSecondary} />
        </View>
      </>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {body}

      {/* ── Modal host - one mount each, for every route above ─── */}
      <ComposeModal visible={showComposer} onDismiss={() => setShowComposer(false)} />
      <ScandalRecoveryModal
        visible={showScandalRecovery && !!activeScandal}
        scandal={activeScandal}
        onDismiss={() => setShowScandalRecovery(false)}
      />
      <VerifiedProUpsellModal visible={showProUpsell} onDismiss={dismissProUpsell} />
      <ProfileEditModal visible={showProfileEdit} onDismiss={() => setShowProfileEdit(false)} />
      <BoostPostModal
        visible={!!boostPostId}
        postId={boostPostId}
        onDismiss={() => setBoostPostId(null)}
      />
      <RewardedAdModal visible={showRewardedAd} onDismiss={() => setShowRewardedAd(false)} />
      <NpcProfileSheet visible={!!sheetNpc} npc={sheetNpc} onDismiss={dismissNpcSheet} />
    </View>
  );
}

function TabButton({
  Icon, label, active, onPress, color, mutedColor,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
  mutedColor: string;
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
      <Icon size={responsiveIconSize.md} color={active ? color : mutedColor} strokeWidth={active ? 2.4 : 2} />
      <Text style={[styles.tabLabel, { color: active ? color : mutedColor, fontWeight: active ? '600' : '400' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  headerBtnEnd: {
    minWidth: touchTargets.minimum / 2,
    height: touchTargets.minimum,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});
