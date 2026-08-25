import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { useAchievements } from '@/hooks/useAchievements';
import {
  Trophy,
  Target,
  Star,
  TrendingUp,
  Crown,
  Zap,
  Bell,
  BookOpen,
  Brain,
  Palette,
  ChevronRight,
  Sparkles,
  CalendarDays,
  CalendarClock,
  Share2,
} from 'lucide-react-native';
import ProgressOverview from '@/components/ProgressOverview';
import Journal from '@/components/Journal';
import SmartNotificationCenter from '@/components/SmartNotificationCenter';
import PrestigeStatsCard from '@/components/PrestigeStatsCard';
import FamilyRecordsCard from '@/components/FamilyRecordsCard';
import { isPrestigeAvailable } from '@/lib/prestige/prestigeTypes';
import PrestigeHistoryModal from '@/components/PrestigeHistoryModal';
import PrestigeShopModal from '@/components/PrestigeShopModal';
import PrestigeModal from '@/components/PrestigeModal';
import ActivityCommitmentModal from '@/components/ActivityCommitmentModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import LifeStoryModal from '@/components/LifeStoryModal';
import LifeTimelineModal from '@/components/LifeTimelineModal';
import ShareLifeCard from '@/components/ShareLifeCard';
import SkillTreeModal from '@/components/SkillTreeModal';
import HobbiesModal from '@/components/HobbiesModal';
import LegacyPassModal from '@/components/LegacyPassModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import { ClaimableBadge } from '@/components/ClaimableBadge';
import { getClaimableContracts } from '@/lib/legacy/contracts';
import {
  getClaimableCount,
  getTierForXp,
  xpIntoCurrentTier,
  XP_PER_TIER,
  MAX_TIER,
} from '@/lib/legacyPass/legacyPass';
import { getThemeColors, accent } from '@/lib/config/theme';
import { fontScale, scale, verticalScale, responsiveSpacing, responsiveBorderRadius, getTabBarSafePadding } from '@/utils/scaling';
import ScreenHeader from '@/components/ui/ScreenHeader';

function ProgressionScreen() {
  return (
    <ErrorBoundary>
      <ProgressionScreenContent />
    </ErrorBoundary>
  );
}

export function ProgressionScreenContent({ embedded = false }: { embedded?: boolean }) {
  const { gameState } = useGame();
  const { achievements: liveAchievements } = useAchievements();
  const { settings } = gameState;
  const insets = useSafeAreaInsets();
  const legacyClaimable = getClaimableCount(gameState.legacyPass);
  // Legacy Contracts live on the Dynasty tab of the prestige shop - the sixth of
  // six scrolling tabs, below the Dynasty board. This card is the Progress
  // screen's door to that shop, so a completed contract gets counted here too;
  // without it `getClaimableContracts` was surfaced nowhere in the app.
  const contractsClaimable = getClaimableContracts(gameState).length;
  // Screen defaults to dark unless darkMode is explicitly false.
  const isDark = settings?.darkMode !== false;
  const theme = getThemeColors(isDark);

  const [showSmartNotifications, setShowSmartNotifications] = useState(false);
  const [showPrestigeHistory, setShowPrestigeHistory] = useState(false);
  const [showPrestigeShop, setShowPrestigeShop] = useState(false);
  const [showPrestige, setShowPrestige] = useState(false);
  const [showCommitments, setShowCommitments] = useState(false);
  const [showLifeStory, setShowLifeStory] = useState(false);
  const [showLifeTimeline, setShowLifeTimeline] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showHobbies, setShowHobbies] = useState(false);
  const [showLegacyPass, setShowLegacyPass] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  // Deep link: the premium-pass promo popup routes here with ?openPass=1 to open
  // the Legacy Pass directly, so the upsell is a single tap, not a scavenger hunt.
  const params = useLocalSearchParams<{ openPass?: string }>();
  useEffect(() => {
    if (params?.openPass === '1') setShowLegacyPass(true);
  }, [params?.openPass]);

  // (Removed: a `checkAchievements()` effect keyed to a per-render
  // `achievementSignal` string. It called `evaluateAchievements`, which is an
  // explicitly documented no-op returning [], and discarded the result - so it
  // fired on every money/health/relationship/item/week change to do nothing.
  //
  // Its P2-7 comment was the real cost: it defended tuning "the full
  // achievement sweep" that GP-3 had already replaced with the live store read
  // below, which tells the next reader the effect is load-bearing and
  // expensive. `checkAchievements` remains on the context - featureGauntlet
  // asserts it survives a minimal state - only this dead call site is gone.)

  // Read the LIVE achievement store, not `gameState.achievements[].completed`.
  //
  // That array ships 52 entries all `completed: false`, and the only writer of
  // `completed: true` anywhere in the repo is one `luxury_life` special case -
  // `evaluateAchievements` is an explicitly documented no-op. So this headline
  // read "0/42 · 0% complete" for the entire game, forever. Same defect and
  // same fix as lib/careers/advancedCareers.ts, whose comment records that
  // every achievement-gated career was permanently locked for the same reason.
  // 2026-07-30 audit GP-3.
  const completedAchievements = liveAchievements.filter(a => a.claimed).length;
  const totalAchievements = liveAchievements.length;
  const completionPct = totalAchievements > 0 ? Math.round((completedAchievements / totalAchievements) * 100) : 0;

  // Prestige + Legacy Pass hero data.
  const prestige = gameState.prestige;
  const prestigeLevel = prestige?.prestigeLevel ?? 0;
  const prestigePoints = prestige?.prestigePoints ?? 0;
  // Derived - the stored flag is never set true in normal play (UX-1).
  const prestigeAvailable = isPrestigeAvailable(gameState);

  const legacyXp = gameState.legacyPass?.xp ?? 0;
  const legacyTier = getTierForXp(legacyXp);
  const legacyInto = xpIntoCurrentTier(legacyXp);
  const legacyTierPct = legacyTier >= MAX_TIER ? 100 : Math.round((legacyInto / XP_PER_TIER) * 100);

  // Compact launcher entries (kept as clean glass tiles, not a wall of buttons).
  const tools: { key: string; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string; onPress: () => void; badge?: number }[] = [
    { key: 'skills', label: 'Life Skills', icon: Brain, color: accent.success, onPress: () => setShowSkillTree(true) },
    { key: 'hobbies', label: 'Hobbies', icon: Palette, color: accent.purple, onPress: () => setShowHobbies(true) },
    { key: 'story', label: 'Life Story', icon: BookOpen, color: '#8B5CF6', onPress: () => setShowLifeStory(true) },
    // The chronological record (2026-08-24) - the narrative Life Story's
    // factual sibling: careers, births, marriages, windfalls, by age.
    { key: 'timeline', label: 'Timeline', icon: CalendarClock, color: '#A78BFA', onPress: () => setShowLifeTimeline(true) },
    { key: 'share', label: 'Share Life', icon: Share2, color: accent.info, onPress: () => setShowShareCard(true) },
    { key: 'commit', label: 'Commitments', icon: Target, color: accent.warning, onPress: () => setShowCommitments(true) },
    { key: 'notif', label: 'Notifications', icon: Bell, color: accent.info, onPress: () => setShowSmartNotifications(true) },
    { key: 'legacy', label: 'Legacy Pass', icon: Crown, color: accent.gold, onPress: () => setShowLegacyPass(true), badge: legacyClaimable },
    { key: 'plus', label: 'DeepLife+', icon: Star, color: accent.gold, onPress: () => setShowSubscription(true) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: embedded ? 'transparent' : theme.background }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - hidden when embedded in the Life tab, which supplies its own
            title + segmented control above this content. */}
        {!embedded && (
          <ScreenHeader
            title="Your Progress"
            subtitle="Achievements, prestige & lifetime stats"
            icon={<Trophy size={scale(18)} color={accent.warning} />}
            tint={accent.warning}
            style={styles.embeddedHeaderReset}
          />
        )}

        {/* Hero: Prestige + Legacy Pass */}
        <View style={styles.heroRow}>
          {/* Prestige */}
          <TouchableOpacity
            activeOpacity={0.85}
            // The card whose own meta line reads "Ready to prestige" must be the
            // card that STARTS a prestige. It used to open the points shop, so
            // the one surface advertising the action was the one surface that
            // could not perform it - the real entry point is a button on Home
            // that only renders when prestige is already available.
            // A badge must lead to the thing it counts, so claimable Legacy
            // Contracts route to the shop (they are claimed on its Dynasty tab,
            // which the shop opens on when any are waiting). Prestige-ready
            // still wins: the card whose meta line says "Ready to prestige" has
            // to be the card that starts one.
            onPress={() => {
              if (prestigeAvailable && prestigeLevel === 0) setShowPrestige(true);
              else if (contractsClaimable > 0) setShowPrestigeShop(true);
              else if (prestigeLevel > 0) setShowPrestigeHistory(true);
              else setShowPrestigeShop(true);
            }}
            style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={styles.heroCardHead}>
              <Sparkles size={scale(14)} color={accent.purple} />
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Prestige</Text>
              <ClaimableBadge count={contractsClaimable} />
            </View>
            <Text style={[styles.heroValue, { color: theme.text }]}>Lv {prestigeLevel}</Text>
            <Text style={[styles.heroMeta, { color: theme.textMuted }]}>
              {prestigeAvailable && prestigeLevel === 0 ? 'Ready to prestige' : `${prestigePoints} points`}
            </Text>
          </TouchableOpacity>

          {/* Legacy Pass */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowLegacyPass(true)}
            style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={styles.heroCardHead}>
              <Crown size={scale(14)} color={accent.gold} />
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Legacy Pass</Text>
              <ClaimableBadge count={legacyClaimable} />
            </View>
            <Text style={[styles.heroValue, { color: theme.text }]}>Tier {legacyTier}<Text style={[styles.heroValueDim, { color: theme.textMuted }]}>/{MAX_TIER}</Text></Text>
            <View style={[styles.heroBar, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.heroBarFill, { width: `${legacyTierPct}%`, backgroundColor: accent.gold }]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Full prestige card when the player has prestiged. */}
        {prestigeLevel > 0 && (
          <PrestigeStatsCard
            onPress={() => setShowPrestigeHistory(true)}
            onShopPress={() => setShowPrestigeShop(true)}
          />
        )}

        {/* Family records - the dynasty's personal bests and where this life
            stands. Derived from previousLives; renders null on a first life. */}
        <FamilyRecordsCard />

        {/* Overall achievement progress */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.progressRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Achievements</Text>
            <Text style={[styles.progressCount, { color: theme.textSecondary }]}>
              {completedAchievements}/{totalAchievements}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.surfaceElevated }]}>
            <View style={[styles.progressFill, { width: `${completionPct}%`, backgroundColor: accent.warning }]} />
          </View>
          <Text style={[styles.progressPct, { color: accent.warning }]}>{completionPct}% complete</Text>
        </View>

        {/* Life Stats */}
        <View style={styles.statsGrid}>
          <StatCard theme={theme} icon={TrendingUp} color={accent.info} value={String(Math.floor(gameState.date?.age ?? 18))} label="Age" />
          <StatCard theme={theme} icon={CalendarDays} color={accent.success} value={String(gameState.weeksLived)} label="Weeks Lived" />
          <StatCard theme={theme} icon={Star} color={accent.purple} value={String((gameState.relationships || []).length)} label="Relationships" />
          <StatCard theme={theme} icon={Zap} color={accent.gold} value={String((gameState.items || []).filter(i => i.owned).length)} label="Items Owned" />
        </View>

        {/* Achievement browser (searchable, by category) */}
        <ProgressOverview />

        {/* Life diary */}
        <Journal />

        {/* Tools & More - compact launcher tiles */}
        <View style={styles.toolsSection}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Tools & More</Text>
          <View style={styles.toolsGrid}>
            {tools.map(tool => {
              const ToolIcon = tool.icon;
              return (
                <TouchableOpacity
                  key={tool.key}
                  activeOpacity={0.8}
                  onPress={tool.onPress}
                  style={[styles.toolTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.toolIcon, { backgroundColor: tool.color + '1F' }]}>
                    <ToolIcon size={scale(16)} color={tool.color} />
                    <ClaimableBadge count={tool.badge ?? 0} />
                  </View>
                  <Text style={[styles.toolLabel, { color: theme.text }]} numberOfLines={1}>{tool.label}</Text>
                  <ChevronRight size={scale(14)} color={theme.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <SmartNotificationCenter visible={showSmartNotifications} onClose={() => setShowSmartNotifications(false)} />
      <ActivityCommitmentModal visible={showCommitments} onClose={() => setShowCommitments(false)} />
      <LifeStoryModal visible={showLifeStory} onClose={() => setShowLifeStory(false)} />
      <LifeTimelineModal visible={showLifeTimeline} onClose={() => setShowLifeTimeline(false)} />
      {/* ShareLifeCard renders a full-bleed card rather than its own Modal, so it
          gets wrapped here. It covers the gap the death-screen obituary does
          not: sharing a life while it is still being lived. */}
      <Modal
        visible={showShareCard}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowShareCard(false)}
      >
        <ShareLifeCard gameState={gameState} onClose={() => setShowShareCard(false)} />
      </Modal>
      <SkillTreeModal visible={showSkillTree} onClose={() => setShowSkillTree(false)} />
      <HobbiesModal visible={showHobbies} onClose={() => setShowHobbies(false)} />
      <LegacyPassModal
        visible={showLegacyPass}
        onClose={() => setShowLegacyPass(false)}
        onSubscribe={() => {
          setShowLegacyPass(false);
          setShowSubscription(true);
        }}
      />
      <SubscriptionModal visible={showSubscription} onClose={() => setShowSubscription(false)} />
      <PrestigeHistoryModal visible={showPrestigeHistory} onClose={() => setShowPrestigeHistory(false)} />
      <PrestigeShopModal visible={showPrestigeShop} onClose={() => setShowPrestigeShop(false)} />
      <PrestigeModal visible={showPrestige} onClose={() => setShowPrestige(false)} />
    </View>
  );
}

function StatCard({
  theme,
  icon: Icon,
  color,
  value,
  label,
}: {
  theme: ReturnType<typeof getThemeColors>;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '1F' }]}>
        <Icon size={scale(16)} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: responsiveSpacing.md,
    gap: verticalScale(16),
  },
  embeddedHeaderReset: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  headerIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(11),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontScale(12),
    marginTop: scale(2),
  },
  // Hero
  heroRow: {
    flexDirection: 'row',
    gap: scale(12),
  },
  heroCard: {
    flex: 1,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    gap: verticalScale(6),
  },
  heroCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  heroLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    flex: 1,
  },
  heroValue: {
    fontSize: fontScale(22),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroValueDim: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  heroMeta: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  heroBar: {
    height: scale(6),
    borderRadius: scale(3),
    overflow: 'hidden',
    marginTop: scale(2),
  },
  heroBarFill: {
    height: '100%',
    borderRadius: scale(3),
  },
  // Generic card
  card: {
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    gap: verticalScale(8),
  },
  cardTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCount: {
    fontSize: fontScale(13),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    height: scale(8),
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  progressPct: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    alignItems: 'center',
    gap: verticalScale(6),
  },
  statIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: fontScale(22),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textAlign: 'center',
  },
  // Tools
  toolsSection: {
    gap: verticalScale(10),
  },
  sectionLabel: {
    fontSize: fontScale(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  toolsGrid: {
    gap: scale(8),
  },
  toolTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: verticalScale(11),
    paddingHorizontal: responsiveSpacing.md,
  },
  toolIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    flex: 1,
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});

export default React.memo(ProgressionScreen);
