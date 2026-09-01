import React, { useState, useEffect, useCallback } from 'react';
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
import YourStoryModal, { type StorySurface } from '@/components/story/YourStoryModal';
import SmartNotificationCenter from '@/components/SmartNotificationCenter';
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
import CollapsibleSection from '@/components/ui/CollapsibleSection';

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

  // ONE modal at a time, one piece of state. This screen used to carry twelve
  // independent `useState` booleans - twelve ways for two modals to be open at
  // once, and twelve things to reset - while TopStatsBar in this same codebase
  // already did it correctly with a single union. 2026-09-01 UI audit.
  type ModalName =
    | 'notifications'
    | 'prestigeHistory'
    | 'prestigeShop'
    | 'prestige'
    | 'commitments'
    | 'story'
    | 'lifeStory'
    | 'lifeTimeline'
    | 'journal'
    | 'shareCard'
    | 'skillTree'
    | 'hobbies'
    | 'legacyPass'
    | 'subscription'
    | null;
  const [openModal, setOpenModal] = useState<ModalName>(null);
  const closeModal = useCallback(() => setOpenModal(null), []);
  /** A Your Story row: swap the hub for the surface it names. */
  const openStorySurface = useCallback((surface: StorySurface) => {
    setOpenModal(
      surface === 'story' ? 'lifeStory'
        : surface === 'timeline' ? 'lifeTimeline'
          : surface === 'journal' ? 'journal'
            : 'shareCard'
    );
  }, []);

  // Deep link: the premium-pass promo popup routes here with ?openPass=1 to open
  // the Legacy Pass directly, so the upsell is a single tap, not a scavenger hunt.
  const params = useLocalSearchParams<{ openPass?: string }>();
  useEffect(() => {
    if (params?.openPass === '1') setOpenModal('legacyPass');
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

  /**
   * Where the Prestige hero card goes, and the line that says so. Resolved
   * once so the tap and the label can never disagree.
   */
  const prestigeDestination: { modal: 'prestige' | 'prestigeShop' | 'prestigeHistory'; meta: string } =
    prestigeAvailable && prestigeLevel === 0
      ? { modal: 'prestige', meta: 'Ready to prestige' }
      : contractsClaimable > 0
        ? { modal: 'prestigeShop', meta: `${contractsClaimable} contract${contractsClaimable === 1 ? '' : 's'} ready` }
        : prestigeLevel > 0
          ? { modal: 'prestigeHistory', meta: `${prestigePoints} points · history` }
          : { modal: 'prestigeShop', meta: `${prestigePoints} points · shop` };

  const legacyXp = gameState.legacyPass?.xp ?? 0;
  const legacyTier = getTierForXp(legacyXp);
  const legacyInto = xpIntoCurrentTier(legacyXp);
  const legacyTierPct = legacyTier >= MAX_TIER ? 100 : Math.round((legacyInto / XP_PER_TIER) * 100);

  // Compact launcher entries. NINE tiles once lived here - including two
  // paywalls sitting between a diary and a hobby list, and four separate
  // launchers (Life Story / Timeline / Journal / Share) for the one question
  // "what happened in my life?". The paywalls moved to where their systems
  // live (the Legacy Pass hero card above; the store button in the HUD), the
  // four became one "Your Story" hub, and what is left is a short list of
  // tools that are actually tools. 2026-09-01 UI audit §2 item 6.
  //
  // Notifications stays despite reading like a duplicate of the tabs-layer
  // ticker: this screen is `SmartNotificationCenter`'s ONLY mount, so removing
  // the tile would orphan the feature rather than de-duplicate it.
  const tools: { key: string; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string; onPress: () => void; badge?: number }[] = [
    { key: 'skills', label: 'Life Skills', icon: Brain, color: accent.success, onPress: () => setOpenModal('skillTree') },
    { key: 'hobbies', label: 'Hobbies', icon: Palette, color: accent.purple, onPress: () => setOpenModal('hobbies') },
    { key: 'story', label: 'Your Story', icon: BookOpen, color: '#8B5CF6', onPress: () => setOpenModal('story') },
    { key: 'commit', label: 'Commitments', icon: Target, color: accent.warning, onPress: () => setOpenModal('commitments') },
    { key: 'notif', label: 'Notifications', icon: Bell, color: accent.info, onPress: () => setOpenModal('notifications') },
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
            // ONE destination, and the meta line under the value NAMES it.
            // This tap used to fan out to four different modals depending on
            // invisible state while the card said only "N points" - the same
            // gesture doing four undiscoverable things (2026-09-01 UI audit).
            // The order is unchanged, because it was right: the card whose meta
            // reads "Ready to prestige" must be the card that starts one, and a
            // badge must lead to the thing it counts.
            onPress={() => setOpenModal(prestigeDestination.modal)}
            style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={styles.heroCardHead}>
              <Sparkles size={scale(14)} color={accent.purple} />
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Prestige</Text>
              <ClaimableBadge count={contractsClaimable} />
            </View>
            <Text style={[styles.heroValue, { color: theme.text }]}>Lv {prestigeLevel}</Text>
            <Text style={[styles.heroMeta, { color: theme.textMuted }]}>
              {prestigeDestination.meta}
            </Text>
          </TouchableOpacity>

          {/* Legacy Pass */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setOpenModal('legacyPass')}
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

        {/* No PrestigeStatsCard here. Prestige was rendered up to three times
            on this one screen (hero card, full card, contract badges); the
            full card already lives on Home, and the hero card above links to
            the history and the shop where the detail is. 2026-09-01 UI audit. */}

        {/* Family records - the dynasty's personal bests and where this life
            stands. Derived from previousLives; renders null on a first life. */}
        <FamilyRecordsCard />

        {/* No achievements summary card: ProgressOverview below is the
            achievements surface on this screen, and the summary said the same
            thing one card earlier. (A third copy lives on Home behind
            "Show more".) 2026-09-01 UI audit. */}

        {/* Life Stats */}
        <CollapsibleSection
          id="progression.lifeStats"
          title="Life Stats"
          compact
          summary={`Age ${Math.floor(gameState.date?.age ?? 18)} · ${gameState.weeksLived} weeks`}
        >
        <View style={styles.statsGrid}>
          <StatCard theme={theme} icon={TrendingUp} color={accent.info} value={String(Math.floor(gameState.date?.age ?? 18))} label="Age" />
          <StatCard theme={theme} icon={CalendarDays} color={accent.success} value={String(gameState.weeksLived)} label="Weeks Lived" />
          <StatCard theme={theme} icon={Star} color={accent.purple} value={String((gameState.relationships || []).length)} label="Relationships" />
          <StatCard theme={theme} icon={Zap} color={accent.gold} value={String((gameState.items || []).filter(i => i.owned).length)} label="Items Owned" />
        </View>
        </CollapsibleSection>

        {/* Achievement browser (searchable, by category) */}
        <ProgressOverview />

        {/* The Journal is no longer inline: it is one of the four surfaces
            behind the "Your Story" tile, so the diary and the three things
            like it are found in one place instead of four. */}

        {/* Tools & More - compact launcher tiles */}
        <View style={styles.toolsSection}>
          <CollapsibleSection
            id="progression.tools"
            title="Tools & More"
            compact
            summary={`${tools.length} tools`}
          >
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
          </CollapsibleSection>
        </View>
      </ScrollView>

      {/* Modals - one at a time, mounted only while open. */}
      <SmartNotificationCenter visible={openModal === 'notifications'} onClose={closeModal} />
      <ActivityCommitmentModal visible={openModal === 'commitments'} onClose={closeModal} />
      <YourStoryModal
        visible={openModal === 'story'}
        onClose={closeModal}
        onOpen={openStorySurface}
      />
      <LifeStoryModal visible={openModal === 'lifeStory'} onClose={closeModal} />
      <LifeTimelineModal visible={openModal === 'lifeTimeline'} onClose={closeModal} />
      {/* Journal renders inline (it is a View, not a Modal), so it gets a
          wrapper here - the same treatment ShareLifeCard below already needed. */}
      <Modal
        visible={openModal === 'journal'}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <View style={[styles.journalSheet, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.journalSheetHead}>
            <Text style={[styles.journalSheetTitle, { color: theme.text }]}>Journal</Text>
            <TouchableOpacity
              onPress={closeModal}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close journal"
            >
              <Text style={[styles.journalSheetClose, { color: theme.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + scale(24) }}>
            <Journal />
          </ScrollView>
        </View>
      </Modal>
      {/* ShareLifeCard renders a full-bleed card rather than its own Modal, so it
          gets wrapped here. It covers the gap the death-screen obituary does
          not: sharing a life while it is still being lived. */}
      <Modal
        visible={openModal === 'shareCard'}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <ShareLifeCard gameState={gameState} onClose={closeModal} />
      </Modal>
      <SkillTreeModal visible={openModal === 'skillTree'} onClose={closeModal} />
      <HobbiesModal visible={openModal === 'hobbies'} onClose={closeModal} />
      <LegacyPassModal
        visible={openModal === 'legacyPass'}
        onClose={closeModal}
        onSubscribe={() => setOpenModal('subscription')}
      />
      <SubscriptionModal visible={openModal === 'subscription'} onClose={closeModal} />
      <PrestigeHistoryModal visible={openModal === 'prestigeHistory'} onClose={closeModal} />
      <PrestigeShopModal visible={openModal === 'prestigeShop'} onClose={closeModal} />
      <PrestigeModal visible={openModal === 'prestige'} onClose={closeModal} />
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
  journalSheet: {
    flex: 1,
  },
  journalSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
  },
  journalSheetTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
  },
  journalSheetClose: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
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
