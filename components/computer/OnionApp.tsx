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
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getTabBarSafePadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { initialGameState } from '@/contexts/game/initialState';
import { DarkWebMixerTier, DarkWebSkillId } from '@/contexts/game/types';

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

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  // --- Render helpers -----------------------------------------------------
  const renderMarket = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <EconomyEventBanner context="darkweb" />
      <HeatGauge heat={dw.heat} darkMode={darkMode} />

      <View style={[styles.statRow, { gap: responsiveSpacing.sm }]}>
        <Stat theme={theme} label="BTC" value={`${btcOwned.toFixed(4)} ₿`} />
        <Stat theme={theme} label="Buyer rep" value={`${dw.playerReputation}/100`} />
      </View>

      <SectionTitle theme={theme}>Listings</SectionTitle>
      {dw.listings.length === 0 ? (
        <EmptyText theme={theme}>
          No listings yet. New listings rotate in each week from active vendors.
        </EmptyText>
      ) : (
        dw.listings.map((listing) => {
          const vendor = dw.vendors.find((v) => v.id === listing.vendorId);
          if (!vendor) return null;
          const affordable = btcOwned >= listing.costBtc;
          const meetsRep = dw.playerReputation >= listing.minBuyerRep;
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

      <SectionTitle theme={theme}>Recent Activity</SectionTitle>
      {dw.recentEvents.length === 0 ? (
        <EmptyText theme={theme}>Forum log empty.</EmptyText>
      ) : (
        dw.recentEvents.slice(0, 6).map((evt) => (
          <View
            key={evt.id}
            style={[styles.eventRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
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
  );

  const renderJobs = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Jobs</Text>
        <TouchableOpacity
          onPress={() => setShowStartJob(true)}
          style={[styles.addBtn, { backgroundColor: accent.info }]}
        >
          <Plus size={scale(14)} color="white" />
          <Text style={styles.addBtnText}>Start</Text>
        </TouchableOpacity>
      </View>

      {dw.activeJobs.length === 0 ? (
        <EmptyText theme={theme}>No active jobs.</EmptyText>
      ) : (
        dw.activeJobs.map((job) => {
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

      <SectionTitle theme={theme}>Skills</SectionTitle>
      <View style={styles.skillsGrid}>
        {(Object.keys(dw.skills) as DarkWebSkillId[]).map((id) => {
          const s = dw.skills[id];
          const pct = Math.max(0, Math.min(1, s.xp / s.nextLevelXp));
          return (
            <View
              key={id}
              style={[styles.skillCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <View style={styles.skillHeader}>
                <Star size={scale(12)} color="#facc15" />
                <Text style={[styles.skillName, { color: theme.text }]}>{SKILL_LABEL[id]}</Text>
                <Text style={[styles.skillLevel, { color: theme.textSecondary }]}>Lv {s.level}</Text>
              </View>
              <View style={[styles.skillTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.skillFill, { width: `${pct * 100}%`, backgroundColor: accent.info }]} />
              </View>
              <Text style={[styles.skillXp, { color: theme.textMuted }]}>
                {Math.round(s.xp)}/{s.nextLevelXp} XP
              </Text>
            </View>
          );
        })}
      </View>

      <SectionTitle theme={theme}>Job History</SectionTitle>
      {dw.jobHistory.length === 0 ? (
        <EmptyText theme={theme}>No completed or failed jobs yet.</EmptyText>
      ) : (
        dw.jobHistory.slice(0, 5).map((j) => {
          const tpl = JOB_TEMPLATES.find((t) => t.id === j.templateId);
          return (
            <View
              key={j.id}
              style={[styles.historyRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <Text style={[styles.historyName, { color: theme.text }]}>{tpl?.name ?? j.templateId}</Text>
              <Text
                style={[
                  styles.historyStatus,
                  {
                    color:
                      j.status === 'completed' ? accent.success : j.status === 'failed' ? accent.danger : theme.textMuted,
                  },
                ]}
              >
                {j.status}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );

  const renderWallet = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={[styles.walletCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.walletLabel, { color: theme.textMuted }]}>Dirty BTC</Text>
          <Text style={[styles.walletValue, { color: '#f59e0b' }]}>{dw.dirtyBtc.toFixed(4)} ₿</Text>
        </View>
        <TouchableOpacity
          disabled={dw.dirtyBtc <= 0}
          onPress={() => setShowLaunder(true)}
          style={[
            styles.walletBtn,
            { backgroundColor: dw.dirtyBtc > 0 ? accent.info : theme.border },
          ]}
        >
          <Text style={styles.walletBtnText}>Launder</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.walletCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.walletLabel, { color: theme.textMuted }]}>Clean BTC</Text>
          <Text style={[styles.walletValue, { color: accent.success }]}>{dw.cleanBtc.toFixed(4)} ₿</Text>
        </View>
        <TouchableOpacity
          disabled={dw.cleanBtc <= 0}
          onPress={() => setShowCashOut(true)}
          style={[
            styles.walletBtn,
            { backgroundColor: dw.cleanBtc > 0 ? accent.success : theme.border },
          ]}
        >
          <Text style={styles.walletBtnText}>Cash Out</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.identityCard, { backgroundColor: theme.surfaceElevated, borderColor: accent.purple }]}>
        <Text style={[styles.identityTitle, { color: accent.purple }]}>🪪 New Identity</Text>
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
            {
              backgroundColor: btcOwned >= NEW_IDENTITY_COST_BTC ? accent.purple : theme.border,
            },
          ]}
        >
          <Text style={styles.identityBtnText}>
            {btcOwned >= NEW_IDENTITY_COST_BTC ? 'Acquire New Identity' : `Need ${NEW_IDENTITY_COST_BTC.toFixed(2)} BTC`}
          </Text>
        </TouchableOpacity>
      </View>

      <SectionTitle theme={theme}>Mixer Queue</SectionTitle>
      {dw.laundering.length === 0 ? (
        <EmptyText theme={theme}>
          No laundering activity. Submit dirty BTC to a mixer to convert it to clean BTC.
        </EmptyText>
      ) : (
        dw.laundering
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
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Onion</Text>
        <View style={[styles.heatChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.heatChipText, { color: theme.text }]}>Heat {Math.round(dw.heat)}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, active && { borderBottomColor: accent.purple }]}
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
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getTabBarSafePadding(insets.bottom) }}
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

function EmptyText({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>;
}

function Stat({ theme, label, value }: { theme: ReturnType<typeof getThemeColors>; label: string; value: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 1,
    gap: responsiveSpacing.sm,
  },
  backBtn: { padding: responsiveSpacing.xs },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  heatChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  heatChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    marginTop: responsiveSpacing.xs,
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  statRow: { flexDirection: 'row' },
  statCard: {
    flex: 1,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  addBtnText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  eventText: { flex: 1, fontSize: responsiveFontSize.xs },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  skillCard: {
    flex: 1,
    minWidth: '46%',
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
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
  skillXp: { fontSize: responsiveFontSize.xs },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  historyName: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  historyStatus: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  walletLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  walletValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800' },
  walletBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
  },
  walletBtnText: { color: 'white', fontSize: responsiveFontSize.sm, fontWeight: '700' },
  identityCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  identityTitle: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  identitySub: { fontSize: responsiveFontSize.xs },
  identityBtn: {
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  identityBtnText: { color: 'white', fontSize: responsiveFontSize.sm, fontWeight: '700' },
});
