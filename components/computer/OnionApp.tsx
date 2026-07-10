/**
 * OnionApp — Dark Web screen.
 *
 * Remake (STATE_VERSION 18). Replaces the 1,331-LOC shop/forum/terminal app
 * with a marketplace + multi-stage jobs + laundering chain + skills loop:
 *
 *   - Market: rotating listings from rep-scored vendors (scam risk surfaced).
 *   - Jobs: multi-stage operations (Recon → Social → Exploit → Exfil → Fence).
 *   - Wallet: dirty BTC, mixer queue, clean BTC, cash-out into the regular wallet.
 *
 * Heat decay, marketplace rotation, laundering settlement, and police events
 * all happen in lib/darkweb/weeklyTick.ts (called from GameActionsContext.nextWeek).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  ArrowLeft,
  ShoppingBag,
  Target,
  Wallet,
  Plus,
  Star,
  Activity,
  Shield,
  Bitcoin,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  getGlassCard,
  getGlassIconContainer,
  getGlassCategoryTabsContainer,
  getGlassButton,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { initialGameState } from '@/contexts/game/initialState';
import { DarkWebMixerTier, DarkWebSkillId } from '@/contexts/game/types';
import { heatBand } from '@/lib/darkweb/heat';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import HeatGauge from '@/components/darkweb/HeatGauge';
import MarketListingRow from '@/components/darkweb/MarketListingRow';
import JobRow from '@/components/darkweb/JobRow';
import LaunderingTxRow from '@/components/darkweb/LaunderingTxRow';
import StartJobModal from '@/components/darkweb/StartJobModal';
import LaunderModal from '@/components/darkweb/LaunderModal';
import AmountInputModal from '@/components/banking/AmountInputModal';

import {
  buyMarketListing,
  beginDarkWebJob,
  runJobStage,
  submitMixerTransaction,
  cashOutCleanBtc,
  acquireNewIdentity,
  NEW_IDENTITY_COST_BTC,
  countLaunderingFronts,
} from '@/contexts/game/actions/CrimeActions';
import { JOB_TEMPLATES } from '@/lib/darkweb/jobs';

const LinearGradient = LinearGradientFallback;

interface OnionAppProps {
  onBack: () => void;
}

type Tab = 'market' | 'jobs' | 'wallet';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'market', label: 'Market', icon: ShoppingBag },
  { id: 'jobs',   label: 'Jobs',   icon: Target },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

const SKILL_LABEL: Record<DarkWebSkillId, string> = {
  hacking: 'Hacking',
  social: 'Social Eng',
  opsec: 'OPSEC',
  laundering: 'Laundering',
};

// Heat is a risk indicator — its chip/gauge stay coloured by band (data), never
// recoloured to the purple identity accent. Mirrors HeatGauge's own band map.
const HEAT_BAND_COLOR: Record<string, string> = {
  cold: accent.info,
  warm: accent.warning,
  hot: accent.amber,
  burning: accent.danger,
};

// Purple identity accent (A855F7) as translucent tints — see Slate Glass system.
const PURPLE_FILL = 'rgba(168,85,247,0.15)';
const PURPLE_RIM = 'rgba(168,85,247,0.30)';

function OnionAppInner({ onBack }: OnionAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const dw = gameState.darkWeb ?? initialGameState.darkWeb!;

  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [showStartJob, setShowStartJob] = useState(false);
  const [showLaunder, setShowLaunder] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);

  const btcOwned = useMemo(
    () => (gameState.cryptos ?? []).find((c) => c.id === 'btc')?.owned ?? 0,
    [gameState.cryptos]
  );

  const heatColor = HEAT_BAND_COLOR[heatBand(dw.heat ?? 0)] ?? accent.info;

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  // --- Render helpers -----------------------------------------------------
  const renderMarket = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <EconomyEventBanner context="darkweb" />

      {/* Recipe B hero — the ONE focal gradient of this screen: the marketplace /
          anonymity status headline (purple identity). Heat stays in HeatGauge. */}
      <View
        style={[
          getGlassCard(darkMode, 12),
          {
            backgroundColor: theme.surface,
            borderColor: darkMode ? theme.glassBorder : theme.border,
            borderWidth: 1,
            borderRadius: responsiveBorderRadius['2xl'],
          },
        ]}
      >
        <View style={styles.heroInner}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(168,85,247,0.14)', 'rgba(168,85,247,0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -scale(48),
              right: -scale(36),
              width: scale(150),
              height: scale(150),
              borderRadius: scale(75),
              backgroundColor: 'rgba(168,85,247,0.10)',
            }}
          />
          {darkMode && (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }}
            />
          )}
          <View style={styles.heroContent}>
            <View
              style={[
                getGlassIconContainer(darkMode, 44),
                { backgroundColor: PURPLE_FILL, borderWidth: 1, borderColor: PURPLE_RIM },
              ]}
            >
              <Shield size={scale(22)} color={accent.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Marketplace standing</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>
                {dw.playerReputation ?? 0}
                <Text style={[styles.heroValueUnit, { color: theme.textMuted }]}>/100</Text>
              </Text>
              <Text style={[styles.heroSub, { color: theme.textSecondary }]} numberOfLines={1}>
                Buyer reputation · {btcOwned.toFixed(4)} ₿ buying power
              </Text>
            </View>
          </View>
        </View>
      </View>

      <HeatGauge heat={dw.heat ?? 0} darkMode={darkMode} />

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Listings</SectionTitle>
        {(dw.listings ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            No listings yet. New listings rotate in each week from active vendors.
          </EmptyText>
        ) : (
          (dw.listings ?? []).map((listing) => {
            const vendor = (dw.vendors ?? []).find((v) => v.id === listing.vendorId);
            if (!vendor) return null;
            const affordable = btcOwned >= listing.costBtc;
            const meetsRep = (dw.playerReputation ?? 0) >= listing.minBuyerRep;
            return (
              <MarketListingRow
                key={listing.id}
                listing={listing}
                vendor={vendor}
                darkMode={darkMode}
                affordable={affordable}
                meetsRep={meetsRep}
                onPress={() => {
                  Alert.alert(
                    'Confirm purchase',
                    `Buy "${listing.title}" from ${vendor.handle} for ${listing.costBtc.toFixed(4)} ₿?\n\nVendor rep ${vendor.reputation}/100.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Buy',
                        onPress: () => {
                          buyMarketListing(setGameState, listing.id);
                          queueSave();
                        },
                      },
                    ]
                  );
                }}
              />
            );
          })
        )}
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Recent Activity</SectionTitle>
        {(dw.recentEvents ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>Forum log empty.</EmptyText>
        ) : (
          (dw.recentEvents ?? []).slice(0, 6).map((evt) => (
            <View
              key={evt.id}
              style={[getGlassCard(darkMode, 6), styles.eventRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Activity size={scale(12)} color={theme.textMuted} />
              <Text style={[styles.eventText, { color: theme.textSecondary }]} numberOfLines={2}>
                <Text style={{ color: theme.textMuted }}>w{evt.week}: </Text>
                {evt.text}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderJobs = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <View style={{ gap: responsiveSpacing.sm }}>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Jobs</Text>
          <TouchableOpacity
            onPress={() => setShowStartJob(true)}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Start a job"
          >
            <Plus size={scale(14)} color={accent.purple} />
            <Text style={[styles.addBtnText, { color: accent.purple }]}>Start</Text>
          </TouchableOpacity>
        </View>

        {(dw.activeJobs ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No active jobs.</EmptyText>
        ) : (
          (dw.activeJobs ?? []).map((job) => {
            const template = JOB_TEMPLATES.find((t) => t.id === job.templateId);
            if (!template) return null;
            return (
              <JobRow
                key={job.id}
                job={job}
                template={template}
                currentWeek={gameState.weeksLived}
                darkMode={darkMode}
                onRun={() => {
                  const res = runJobStage(gameState, setGameState, job.id);
                  queueSave();
                  if (!res.success) {
                    Alert.alert('Cannot Run Stage', res.message);
                  } else if (res.outcome === 'completed') {
                    Alert.alert('Job Complete', res.message);
                  } else if (res.outcome === 'fail') {
                    Alert.alert('Stage Failed', res.message);
                  }
                }}
              />
            );
          })
        )}
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Skills</SectionTitle>
        <View style={styles.skillsGrid}>
          {(Object.keys(dw.skills) as DarkWebSkillId[]).map((id) => {
            const s = dw.skills[id];
            const pct = Math.max(0, Math.min(1, s.xp / (s.nextLevelXp || 1)));
            return (
              <View
                key={id}
                style={[getGlassCard(darkMode, 6), styles.skillCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.skillHeader}>
                  <Star size={scale(12)} color={accent.gold} fill={accent.gold} />
                  <Text style={[styles.skillName, { color: theme.text }]}>{SKILL_LABEL[id]}</Text>
                  <Text style={[styles.skillLevel, { color: theme.textSecondary }]}>Lv {s.level}</Text>
                </View>
                <View style={[styles.skillTrack, { backgroundColor: theme.surfaceElevated }]}>
                  <View style={[styles.skillFill, { width: `${pct * 100}%`, backgroundColor: accent.purple }]} />
                </View>
                <Text style={[styles.skillXp, { color: theme.textMuted }]}>
                  {Math.round(s.xp)}/{s.nextLevelXp} XP
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Job History</SectionTitle>
        {(dw.jobHistory ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No completed or failed jobs yet.</EmptyText>
        ) : (
          (dw.jobHistory ?? []).slice(0, 5).map((j) => {
            const tpl = JOB_TEMPLATES.find((t) => t.id === j.templateId);
            const statusColor =
              j.status === 'completed' ? accent.success : j.status === 'failed' ? accent.danger : theme.textMuted;
            return (
              <View
                key={j.id}
                style={[getGlassCard(darkMode, 6), styles.historyRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.historyInner}>
                  <View style={[styles.historyStripe, { backgroundColor: statusColor }]} />
                  <View style={styles.historyBody}>
                    <Text style={[styles.historyName, { color: theme.text }]}>{tpl?.name ?? j.templateId}</Text>
                    <Text style={[styles.historyStatus, { color: statusColor }]}>{j.status}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const renderWallet = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <View style={[getGlassCard(darkMode, 6), styles.walletCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View
          style={[
            getGlassIconContainer(darkMode, 40),
            { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)' },
          ]}
        >
          <Bitcoin size={scale(20)} color={accent.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.walletLabel, { color: theme.textMuted }]}>Dirty BTC</Text>
          <Text style={[styles.walletValue, { color: accent.warning }]}>{(dw.dirtyBtc ?? 0).toFixed(4)} ₿</Text>
        </View>
        <TouchableOpacity
          disabled={(dw.dirtyBtc ?? 0) <= 0}
          onPress={() => setShowLaunder(true)}
          style={[getGlassButton(darkMode), styles.walletBtn, (dw.dirtyBtc ?? 0) <= 0 && styles.btnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Launder dirty BTC"
        >
          <Text style={[styles.walletBtnText, { color: (dw.dirtyBtc ?? 0) > 0 ? accent.purple : theme.textMuted }]}>Launder</Text>
        </TouchableOpacity>
      </View>

      <View style={[getGlassCard(darkMode, 6), styles.walletCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View
          style={[
            getGlassIconContainer(darkMode, 40),
            { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.30)' },
          ]}
        >
          <Bitcoin size={scale(20)} color={accent.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.walletLabel, { color: theme.textMuted }]}>Clean BTC</Text>
          <Text style={[styles.walletValue, { color: accent.success }]}>{(dw.cleanBtc ?? 0).toFixed(4)} ₿</Text>
        </View>
        <TouchableOpacity
          disabled={(dw.cleanBtc ?? 0) <= 0}
          onPress={() => setShowCashOut(true)}
          style={[getGlassButton(darkMode), styles.walletBtn, (dw.cleanBtc ?? 0) <= 0 && styles.btnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Cash out clean BTC"
        >
          <Text style={[styles.walletBtnText, { color: (dw.cleanBtc ?? 0) > 0 ? accent.success : theme.textMuted }]}>Cash Out</Text>
        </TouchableOpacity>
      </View>

      <View style={[getGlassCard(darkMode, 6), styles.identityCard, { backgroundColor: theme.surface, borderColor: PURPLE_RIM }]}>
        <View style={styles.identityHeader}>
          <View
            style={[
              getGlassIconContainer(darkMode, 40),
              { backgroundColor: PURPLE_FILL, borderWidth: 1, borderColor: PURPLE_RIM },
            ]}
          >
            <Shield size={scale(20)} color={accent.purple} />
          </View>
          <Text style={[styles.identityTitle, { color: theme.text }]}>New Identity</Text>
        </View>
        <Text style={[styles.identitySub, { color: theme.textMuted }]}>
          Burn this persona. Cost: {NEW_IDENTITY_COST_BTC.toFixed(2)} ₿. Heat → 0, buyer rep → 0,
          credit score → 580 (thin file), open loans + cards close, active jobs dropped.
        </Text>
        <TouchableOpacity
          disabled={btcOwned < NEW_IDENTITY_COST_BTC}
          onPress={() => {
            Alert.alert(
              'Burn this identity?',
              `This is permanent. ${NEW_IDENTITY_COST_BTC.toFixed(2)} BTC will be spent. ` +
                `Heat resets, buyer rep resets, all loans + credit cards close, ` +
                `credit score drops to 580, and ${dw.activeJobs.length} active job${dw.activeJobs.length === 1 ? '' : 's'} will be dropped.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Burn it',
                  style: 'destructive',
                  onPress: () => {
                    acquireNewIdentity(setGameState);
                    queueSave();
                  },
                },
              ]
            );
          }}
          style={[
            styles.identityBtn,
            btcOwned >= NEW_IDENTITY_COST_BTC ? getPlatformShadows(5, 0.3, 2, 8) : null,
            { backgroundColor: btcOwned >= NEW_IDENTITY_COST_BTC ? accent.purple : theme.surfaceElevated },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Acquire new identity"
        >
          <Text style={[styles.identityBtnText, { color: btcOwned >= NEW_IDENTITY_COST_BTC ? 'white' : theme.textMuted }]}>
            {btcOwned >= NEW_IDENTITY_COST_BTC ? 'Acquire New Identity' : `Need ${NEW_IDENTITY_COST_BTC.toFixed(2)} BTC`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Mixer Queue</SectionTitle>
        {(dw.laundering ?? []).length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            No laundering activity. Submit dirty BTC to a mixer to convert it to clean BTC.
          </EmptyText>
        ) : (
          (dw.laundering ?? [])
            .slice()
            .sort((a, b) => b.startedWeek - a.startedWeek)
            .slice(0, 10)
            .map((tx) => (
              <LaunderingTxRow
                key={tx.id}
                tx={tx}
                currentWeek={gameState.weeksLived}
                darkMode={darkMode}
              />
            ))
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Onion</Text>
        <View style={[styles.heatChip, { backgroundColor: heatColor + '24', borderColor: heatColor + '4D' }]}>
          <Text style={[styles.heatChipText, { color: theme.text }]}>Heat {Math.round(dw.heat ?? 0)}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, getGlassCategoryTabsContainer(darkMode)]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, active && { backgroundColor: 'rgba(168,85,247,0.16)' }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <Icon size={scale(16)} color={active ? accent.purple : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.purple : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        // Clear the floating tab bar — a short padding left the bottom
        // buttons (Run Stage, cash-out) untappable underneath it.
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'wallet' && renderWallet()}
      </ScrollView>

      <StartJobModal
        visible={showStartJob}
        darkWeb={dw}
        darkMode={darkMode}
        onClose={() => setShowStartJob(false)}
        onStart={(templateId) => {
          beginDarkWebJob(setGameState, templateId);
          queueSave();
          setShowStartJob(false);
        }}
      />

      <LaunderModal
        visible={showLaunder}
        dirtyBtc={dw.dirtyBtc}
        launderingSkillLevel={dw.skills.laundering?.level ?? 1}
        frontCount={countLaunderingFronts(gameState)}
        darkMode={darkMode}
        onClose={() => setShowLaunder(false)}
        onSubmit={(tier: DarkWebMixerTier, amountBtc) => {
          submitMixerTransaction(setGameState, tier, amountBtc);
          queueSave();
          setShowLaunder(false);
        }}
      />

      <AmountInputModal
        visible={showCashOut}
        title="Cash out clean BTC"
        subtitle={`Clean wallet: ${dw.cleanBtc.toFixed(4)} ₿. Moves into your regular BTC holdings.`}
        confirmLabel="Cash Out"
        maxAmount={dw.cleanBtc}
        presets={[0.1, 0.5, 1]}
        darkMode={darkMode}
        onClose={() => setShowCashOut(false)}
        onConfirm={(amt) => {
          cashOutCleanBtc(setGameState, amt);
          queueSave();
          setShowCashOut(false);
        }}
      />
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function EmptyText({ theme, darkMode, children }: { theme: ReturnType<typeof getThemeColors>; darkMode: boolean; children: React.ReactNode }) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{children}</Text>
    </View>
  );
}

export default function OnionApp(props: OnionAppProps) {
  return (
    <ErrorBoundary>
      <OnionAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Top bar drops its bottom border — the segmented tab container below anchors
  // the screen (Slate Glass §6).
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  // >=40pt touch target for the always-present back affordance.
  backBtn: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  heatChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  heatChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyText: { fontSize: responsiveFontSize.sm, textAlign: 'center', opacity: 0.7 },
  emptyCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    alignItems: 'center',
  },
  // Recipe B hero.
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  heroLabel: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroValue: { fontSize: responsiveFontSize['3xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroValueUnit: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Quiet identity-tinted add chip (Slate Glass §6) — no border, one loud CTA max.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  addBtnText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  eventText: { flex: 1, fontSize: responsiveFontSize.xs },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  skillCard: {
    flex: 1,
    minWidth: '46%',
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: 4,
  },
  skillHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skillName: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '700' },
  skillLevel: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  skillTrack: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  skillFill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  skillXp: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  // Recipe A anatomy: outer carries shadow + radius + solid fill + border (no
  // clip so the shadow isn't cut); inner clips the status stripe to the radius.
  historyRow: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  historyInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
  },
  historyStripe: { width: scale(4) },
  historyBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  historyName: { fontSize: responsiveFontSize.sm, fontWeight: '600', flex: 1 },
  historyStatus: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  walletLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  walletValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  walletBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
  },
  walletBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  identityCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  identityHeader: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  identityTitle: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  identitySub: { fontSize: responsiveFontSize.xs },
  // The one loud CTA on the Wallet tab — solid purple, white label, >=44pt.
  identityBtn: {
    minHeight: touchTargets.minimum,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
});
