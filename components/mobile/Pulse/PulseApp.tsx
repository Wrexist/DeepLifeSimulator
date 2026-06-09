/**
 * PulseApp — root shell for the in-game Pulse social platform.
 *
 * Mounts when the player taps the Pulse tile from the phone shell. Owns:
 *   - Internal nav state machine (no React Navigation nested container)
 *   - Bottom 5-tab bar (Home / Trending / Compose-FAB / Alerts / DMs)
 *   - The modal host (composer, scandal recovery, verified-pro upsell)
 *   - The persistent ScandalBanner when a scandal is active
 *   - Profile + BrandDeals + LiveStream as overlay routes (no tab slot)
 */
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Bell, Briefcase, Flame, Home, Mail, Radio } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, touchTargets } from '@/utils/scaling';
import { PULSE_GRADIENT } from './styles/pulseTheme';
import PulseFAB from './components/PulseFAB';
import ScandalBanner from './components/ScandalBanner';
import FeedScreen from './screens/FeedScreen';
import TrendingScreen from './screens/TrendingScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MessagesScreen from './screens/MessagesScreen';
import ProfileScreen from './screens/ProfileScreen';
import BrandDealsScreen from './screens/BrandDealsScreen';
import LiveStreamScreen from './screens/LiveStreamScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import ComposeModal from './modals/ComposeModal';
import ScandalRecoveryModal from './modals/ScandalRecoveryModal';
import VerifiedProUpsellModal from './modals/VerifiedProUpsellModal';
import ProfileEditModal from './modals/ProfileEditModal';
import BoostPostModal from './modals/BoostPostModal';
import RewardedAdModal from './modals/RewardedAdModal';
import { formatPulseNumber } from './utils/formatPulseNumber';
import { subscribeVerifiedPro } from '@/contexts/game/actions/PulseActions';
import { iapService } from '@/services/IAPService';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';

const LinearGradient = LinearGradientFallback;

type PulseTab = 'home' | 'trending' | 'alerts' | 'dms';
/** Overlay routes — full-screen pushed above the tab bar. */
type PulseOverlay = 'profile' | 'brandDeals' | 'liveStream' | null;

interface PulseAppProps {
  onBack: () => void;
}

export default function PulseApp({ onBack }: PulseAppProps) {
  const { gameState, setGameState } = useGame();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<PulseTab>('home');
  const [overlay, setOverlay] = useState<PulseOverlay>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  // R6-A: error flag so the gradient fallback covers BOTH "no photo" and
  // "photo URL failed to load" cases.
  const [headerAvatarErrored, setHeaderAvatarErrored] = useState(false);
  const [showScandalRecovery, setShowScandalRecovery] = useState(false);
  const [showProUpsell, setShowProUpsell] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [boostPostId, setBoostPostId] = useState<string | null>(null);
  const [showRewardedAd, setShowRewardedAd] = useState(false);

  const sm = gameState.socialMedia;
  const followers = sm?.followers ?? 0;
  const activeScandal = sm?.activeScandal ?? null;
  const profile = gameState.userProfile ?? {};

  const handleComposePress = useCallback(() => setShowComposer(true), []);
  const openPostDetail = useCallback((postId: string) => setDetailPostId(postId), []);
  const dismissPostDetail = useCallback(() => setDetailPostId(null), []);
  const openProfile = useCallback(() => setOverlay('profile'), []);
  const openBrandDeals = useCallback(() => setOverlay('brandDeals'), []);
  const openLive = useCallback(() => setOverlay('liveStream'), []);
  const dismissOverlay = useCallback(() => setOverlay(null), []);
  const openProUpsell = useCallback(() => setShowProUpsell(true), []);
  const dismissProUpsell = useCallback(() => setShowProUpsell(false), []);

  const handleSubscribePro = useCallback(
    async (plan: 'monthly' | 'yearly') => {
      // Real IAP path: route through the store. The IAPService fulfillment
      // chain (services/IAPService.ts) writes the Verified Pro entitlement
      // into socialMedia.verifiedPro on successful purchase.
      const productId = plan === 'monthly'
        ? SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY
        : SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY;
      try {
        const result = await iapService.purchaseProduct(productId);
        if (result.success) {
          setShowProUpsell(false);
        } else {
          logger.warn('[Pulse] Verified Pro purchase failed', { productId, message: result.message });
          // Fall back to local-grant in __DEV__ so the perks can be demoed
          // without store config; production builds skip this branch.
          if (__DEV__) {
            const ms = (plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000;
            subscribeVerifiedPro(setGameState, productId, Date.now() + ms);
            setShowProUpsell(false);
          }
        }
      } catch (err) {
        logger.error('[Pulse] Verified Pro purchase threw', err);
        if (__DEV__) {
          const ms = (plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000;
          subscribeVerifiedPro(setGameState, productId, Date.now() + ms);
          setShowProUpsell(false);
        }
      }
    },
    [setGameState],
  );

  // ── Overlay routes intercept the entire body when active ──────────────────
  if (detailPostId) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <PostDetailScreen postId={detailPostId} onClose={dismissPostDetail} />
      </View>
    );
  }
  if (overlay === 'liveStream') {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <LiveStreamScreen onClose={dismissOverlay} />
      </View>
    );
  }
  if (overlay === 'profile') {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={dismissOverlay} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
            <ArrowLeft size={responsiveIconSize.md} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          </View>
          <Pressable onPress={openLive} accessibilityRole="button" accessibilityLabel="Go live" hitSlop={8} style={styles.headerBtn}>
            <Radio size={responsiveIconSize.md} color={PULSE_GRADIENT[0]} />
          </Pressable>
        </View>
        <ProfileScreen
          onUpgradePro={openProUpsell}
          onOpenPostDetail={openPostDetail}
          onBoostPost={(postId) => setBoostPostId(postId)}
          onEditProfile={() => setShowProfileEdit(true)}
        />
        <VerifiedProUpsellModal visible={showProUpsell} onDismiss={dismissProUpsell} onSubscribe={handleSubscribePro} />
        <ProfileEditModal visible={showProfileEdit} onDismiss={() => setShowProfileEdit(false)} />
      </View>
    );
  }
  if (overlay === 'brandDeals') {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={dismissOverlay} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
            <ArrowLeft size={responsiveIconSize.md} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Brand Deals</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>
        <BrandDealsScreen />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* ── Header ──────────────────────────────────────────── */}
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
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.wordmarkPill}
          >
            <Text style={styles.wordmarkText}>pulse</Text>
          </LinearGradient>
        </View>

        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={`Profile, ${followers} followers`}
          hitSlop={8}
          style={styles.headerProfileBtn}
        >
          {/* R6-A: also render the gradient fallback on Image load failure,
              not just missing-uri. Previously a 404 left a transparent gap. */}
          {profile.profilePhoto && !headerAvatarErrored ? (
            <Image
              source={{ uri: profile.profilePhoto }}
              style={styles.headerAvatar}
              onError={() => setHeaderAvatarErrored(true)}
            />
          ) : (
            <LinearGradient
              colors={PULSE_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.headerAvatar, styles.headerAvatarFallback]}
            >
              <Text style={styles.headerAvatarLetter}>
                {((profile as any).displayName || profile.name || profile.handle || 'Y')
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <Text style={[styles.followerCount, { color: theme.text }]}>
            {formatPulseNumber(followers)}
          </Text>
        </Pressable>
      </View>

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
          />
        )}
        {activeTab === 'trending' && <TrendingScreen />}
        {activeTab === 'alerts' && (
          <NotificationsScreen
            onOpenBrandDeals={openBrandDeals}
            onOpenPostDetail={openPostDetail}
            onOpenScandalRecovery={() => setShowScandalRecovery(true)}
            onWatchAd={() => setShowRewardedAd(true)}
          />
        )}
        {activeTab === 'dms' && <MessagesScreen onBack={() => setActiveTab('home')} />}
      </View>

      {/* ── Compose FAB ──────────────────────────────────────── */}
      <PulseFAB onPress={handleComposePress} />

      {/* ── Bottom tab bar ──────────────────────────────────── */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TabButton tab="home" Icon={Home} label="Home" active={activeTab === 'home'} onPress={() => setActiveTab('home')} color={theme.text} mutedColor={theme.textSecondary} />
        <TabButton tab="trending" Icon={Flame} label="Trending" active={activeTab === 'trending'} onPress={() => setActiveTab('trending')} color={theme.text} mutedColor={theme.textSecondary} />
        <View style={styles.tabSpacer} />{/* room for the raised FAB */}
        <TabButton tab="alerts" Icon={Bell} label="Alerts" active={activeTab === 'alerts'} onPress={() => setActiveTab('alerts')} color={theme.text} mutedColor={theme.textSecondary} />
        <TabButton tab="dms" Icon={Mail} label="DMs" active={activeTab === 'dms'} onPress={() => setActiveTab('dms')} color={theme.text} mutedColor={theme.textSecondary} />
      </View>

      {/* Quick access: brand deals link in header when offers/active exist */}
      {(sm?.brandInbox?.pending?.length ?? 0) + (sm?.activeBrandDeals?.length ?? 0) > 0 ? (
        <Pressable
          onPress={openBrandDeals}
          accessibilityRole="button"
          accessibilityLabel={`Brand deals, ${sm.brandInbox?.pending?.length ?? 0} pending`}
          style={[styles.dealChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Briefcase size={fontScale(14)} color={PULSE_GRADIENT[0]} />
          <Text style={[styles.dealChipText, { color: theme.text }]}>
            Brand deals · {(sm.brandInbox?.pending?.length ?? 0) + (sm.activeBrandDeals?.length ?? 0)}
          </Text>
        </Pressable>
      ) : null}

      {/* ── Modal host ───────────────────────────────────────── */}
      <ComposeModal visible={showComposer} onDismiss={() => setShowComposer(false)} />
      <ScandalRecoveryModal
        visible={showScandalRecovery && !!activeScandal}
        scandal={activeScandal}
        onDismiss={() => setShowScandalRecovery(false)}
      />
      <VerifiedProUpsellModal
        visible={showProUpsell}
        onDismiss={dismissProUpsell}
        onSubscribe={handleSubscribePro}
      />
      <BoostPostModal
        visible={!!boostPostId}
        postId={boostPostId}
        onDismiss={() => setBoostPostId(null)}
      />
      <RewardedAdModal visible={showRewardedAd} onDismiss={() => setShowRewardedAd(false)} />
    </View>
  );
}

function TabButton({
  tab, Icon, label, active, onPress, color, mutedColor,
}: {
  tab: PulseTab;
  Icon: any;
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
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  wordmarkPill: {
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
  headerProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: touchTargets.minimum,
    paddingLeft: 4,
  },
  headerAvatar: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
  },
  headerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  followerCount: {
    fontSize: fontScale(13),
    fontWeight: '700',
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
  tabSpacer: {
    width: scale(56),
  },
  tabLabel: {
    fontSize: fontScale(10),
    marginTop: 2,
  },
  dealChip: {
    position: 'absolute',
    bottom: scale(80),
    left: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dealChipText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
});
