/**
 * PoliticalApp — Remake 5.
 *
 * Replaces the 1,909-LOC bureaucratic-grind version with a 3-tab loop:
 *
 *   - Office: approval gauge, career level, election countdown, lobbyists + alliances summary
 *   - Policies: enact / lobby (delegated to existing legacy actions)
 *   - Influence: PAC pool + scandals list (the new Remake 5 mechanics)
 *
 * New systems that ship with this remake:
 *   - PAC pool (clean + dirty USD buckets). Funnel BTC for higher conversion
 *     but raises lifetimeDirtyUSD which permanently feeds scandal risk.
 *   - Scandal engine. Drivers: dark-web heat, dirty PAC money, negative karma,
 *     contentious policies, careerLevel. Severity 1-4. Suppress with cash;
 *     unsupressed majors can force resignation.
 *   - Approval drift toward 50 (out of sight, out of mind).
 *
 * Weekly tick lives in lib/politics/weeklyTick.ts, wired into nextWeek.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  TrendingUp,
  Vote,
  Handshake,
  Calendar,
  Trophy,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getTabBarSafePadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ApprovalGauge from '@/components/politics/ApprovalGauge';
import ScandalRow from '@/components/politics/ScandalRow';
import PACCard from '@/components/politics/PACCard';
import AmountInputModal from '@/components/banking/AmountInputModal';

import {
  raisePACClean,
  raisePACDirty,
  spendPACOnCampaign,
  suppressPoliticalScandal,
  enactPolicy,
} from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { ensurePoliticsHasNewFields } from '@/lib/politics/operations';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import EnactPolicyModal from '@/components/politics/EnactPolicyModal';

interface PoliticalAppProps {
  onBack: () => void;
}

type Tab = 'office' | 'policies' | 'influence';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'office',     label: 'Office',    icon: Briefcase },
  { id: 'policies',   label: 'Policies',  icon: ClipboardList },
  { id: 'influence',  label: 'Influence', icon: TrendingUp },
];

const OFFICE_NAME: Record<number, string> = {
  0: 'Citizen',
  1: 'Council Member',
  2: 'Mayor',
  3: 'State Representative',
  4: 'Governor',
  5: 'Senator',
  6: 'President',
};

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function PoliticalAppInner({ onBack }: PoliticalAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const politics = useMemo(
    () => ensurePoliticsHasNewFields(gameState.politics ?? ({} as any)),
    [gameState.politics]
  );

  const [activeTab, setActiveTab] = useState<Tab>('office');
  const [showRaiseClean, setShowRaiseClean] = useState(false);
  const [showRaiseDirty, setShowRaiseDirty] = useState(false);
  const [showPACSpend, setShowPACSpend] = useState(false);
  const [suppressTargetId, setSuppressTargetId] = useState<string | null>(null);
  const [showEnactPolicy, setShowEnactPolicy] = useState(false);

  const cash = gameState.stats?.money ?? 0;
  const btcOwned = useMemo(
    () => gameState.cryptos.find((c) => c.id === 'btc')?.owned ?? 0,
    [gameState.cryptos]
  );
  const btcPrice = useMemo(
    () => gameState.cryptos.find((c) => c.id === 'btc')?.price ?? 0,
    [gameState.cryptos]
  );

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const activeScandals = (politics.scandals ?? []).filter((s) => s.active);
  const pastScandals = (politics.scandals ?? []).filter((s) => !s.active);

  const careerLevel = politics.careerLevel ?? 0;
  const officeName = OFFICE_NAME[careerLevel] ?? `Office Lv ${careerLevel}`;
  const weeksToElection = politics.nextElectionWeek != null
    ? Math.max(0, politics.nextElectionWeek - gameState.weeksLived)
    : null;

  // --- Render helpers ----------------------------------------------------
  const renderOffice = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <EconomyEventBanner context="generic" />

      <ApprovalGauge approval={politics.approvalRating ?? 50} darkMode={darkMode} />

      <View style={[styles.statusCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[styles.iconBubble, { backgroundColor: careerLevel > 0 ? accent.info : theme.surface }]}>
          <Vote size={scale(20)} color={careerLevel > 0 ? 'white' : theme.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.officeLabel, { color: theme.textMuted }]}>Current office</Text>
          <Text style={[styles.officeName, { color: theme.text }]}>{officeName}</Text>
          {politics.party && (
            <Text style={[styles.party, { color: theme.textSecondary }]}>
              {politics.party.charAt(0).toUpperCase() + politics.party.slice(1)} Party
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.statBig, { color: theme.text }]}>{politics.electionsWon ?? 0}</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Elections won</Text>
        </View>
      </View>

      {weeksToElection != null && (
        <View style={[styles.electionCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Calendar size={scale(16)} color={accent.warning} />
          <Text style={[styles.electionText, { color: theme.text }]}>
            Next election in {weeksToElection} {weeksToElection === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
      )}

      <View style={styles.statGrid}>
        <StatCard theme={theme} icon={Handshake} label="Lobbyists" value={String((politics.lobbyists ?? []).length)} />
        <StatCard theme={theme} icon={Trophy} label="Influence" value={String(Math.round(politics.policyInfluence ?? 0))} />
        <StatCard theme={theme} icon={ClipboardList} label="Policies" value={String((politics.policiesEnacted ?? []).length)} />
      </View>

      <Text style={[styles.helperText, { color: theme.textMuted }]}>
        Use the legacy career/lobby/alliance flows from the original app for now; running for office, joining a party, hiring lobbyists, and enacting policies remain on the existing surface.
      </Text>
    </View>
  );

  const renderPolicies = () => {
    const enacted = politics.policiesEnacted ?? [];
    return (
      <View style={{ gap: responsiveSpacing.md }}>
        <View style={[styles.statusCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <View style={[styles.iconBubble, { backgroundColor: accent.info }]}>
            <ClipboardList size={scale(18)} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.officeLabel, { color: theme.textMuted }]}>Policies enacted</Text>
            <Text style={[styles.officeName, { color: theme.text }]}>{enacted.length}</Text>
          </View>
        </View>

        {/* Primary action: enact a new policy. Disabled while a citizen (level 0)
            since the modal will explain why anyway, but cheaper for the player
            to see the gate at this level. */}
        <TouchableOpacity
          onPress={() => setShowEnactPolicy(true)}
          disabled={careerLevel === 0}
          style={[
            styles.enactCta,
            { backgroundColor: careerLevel === 0 ? theme.border : accent.info },
          ]}
        >
          <Text style={styles.enactCtaText}>
            {careerLevel === 0 ? 'Win an election to enact policies' : 'Enact a policy'}
          </Text>
        </TouchableOpacity>

        {enacted.length === 0 ? (
          <EmptyText theme={theme}>
            No policies enacted yet.
          </EmptyText>
        ) : (
          enacted.map((pid: string) => (
            <View key={pid} style={[styles.policyRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[styles.policyLabel, { color: theme.text }]}>{pid}</Text>
            </View>
          ))
        )}
        <Text style={[styles.helperText, { color: theme.textMuted }]}>
          Each contentious policy you enact slightly raises your scandal risk. Look in Influence tab to see suppression options.
        </Text>
      </View>
    );
  };

  const handleEnactPolicy = useCallback((policyId: string) => {
    const result = enactPolicy(gameState, setGameState, policyId, { updateMoney, updateStats });
    Alert.alert(result.success ? 'Policy enacted' : 'Could not enact', result.message);
    if (result.success) {
      setShowEnactPolicy(false);
      queueSave();
    }
  }, [gameState, setGameState, queueSave]);

  const renderInfluence = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <PACCard
        pac={politics.pac ?? { cleanUSD: 0, dirtyUSD: 0, lifetimeDirtyUSD: 0 }}
        darkMode={darkMode}
        onRaiseClean={() => setShowRaiseClean(true)}
        onRaiseDirty={btcOwned > 0 ? () => setShowRaiseDirty(true) : undefined}
        onSpend={() => setShowPACSpend(true)}
      />

      <SectionTitle theme={theme}>Active Scandals</SectionTitle>
      {activeScandals.length === 0 ? (
        <EmptyText theme={theme}>No active scandals. Keep it clean.</EmptyText>
      ) : (
        activeScandals.map((s) => (
          <ScandalRow
            key={s.id}
            scandal={s}
            darkMode={darkMode}
            onSuppress={() => setSuppressTargetId(s.id)}
          />
        ))
      )}

      {pastScandals.length > 0 && (
        <>
          <SectionTitle theme={theme}>Past Scandals</SectionTitle>
          {pastScandals.slice(0, 5).map((s) => (
            <ScandalRow key={s.id} scandal={s} darkMode={darkMode} />
          ))}
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Politics</Text>
        <View style={[styles.cashChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
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
              style={[styles.tab, active && { borderBottomColor: accent.info }]}
            >
              <Icon size={scale(16)} color={active ? accent.info : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.info : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getTabBarSafePadding(insets.bottom) }}
      >
        {activeTab === 'office' && renderOffice()}
        {activeTab === 'policies' && renderPolicies()}
        {activeTab === 'influence' && renderInfluence()}
      </ScrollView>

      <AmountInputModal
        visible={showRaiseClean}
        title="Raise PAC funds"
        subtitle={`Clean donation from cash. Cash on hand: ${formatMoney(cash)}`}
        confirmLabel="Donate"
        maxAmount={cash}
        presets={[5_000, 25_000, 100_000]}
        darkMode={darkMode}
        onClose={() => setShowRaiseClean(false)}
        onConfirm={(amt) => {
          raisePACClean(setGameState, amt);
          queueSave();
          setShowRaiseClean(false);
        }}
      />

      <AmountInputModal
        visible={showRaiseDirty}
        title="Funnel BTC through PAC"
        subtitle={`Higher conversion than direct campaign. Permanently raises scandal risk. BTC owned: ${btcOwned.toFixed(4)} (~${formatMoney(btcOwned * btcPrice)})`}
        confirmLabel="Funnel"
        maxAmount={btcOwned}
        presets={[0.1, 0.5, 1]}
        darkMode={darkMode}
        onClose={() => setShowRaiseDirty(false)}
        onConfirm={(amt) => {
          Alert.alert(
            'Confirm dirty funnel',
            `This adds ~${formatMoney(amt * btcPrice)} to the PAC, but ${formatMoney(amt * btcPrice)} of dirty money gets logged against you forever. Continue?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Funnel',
                style: 'destructive',
                onPress: () => {
                  raisePACDirty(setGameState, amt);
                  queueSave();
                  setShowRaiseDirty(false);
                },
              },
            ]
          );
        }}
      />

      <AmountInputModal
        visible={showPACSpend}
        title="Spend PAC on campaign"
        subtitle={`Pulls from clean first, then dirty. PAC pool: ${formatMoney((politics.pac?.cleanUSD ?? 0) + (politics.pac?.dirtyUSD ?? 0))}`}
        confirmLabel="Push"
        maxAmount={(politics.pac?.cleanUSD ?? 0) + (politics.pac?.dirtyUSD ?? 0)}
        presets={[10_000, 50_000, 250_000]}
        darkMode={darkMode}
        onClose={() => setShowPACSpend(false)}
        onConfirm={(amt) => {
          spendPACOnCampaign(setGameState, amt);
          queueSave();
          setShowPACSpend(false);
        }}
      />

      <AmountInputModal
        visible={!!suppressTargetId}
        title="Suppress scandal"
        subtitle={`PR + legal + opp research. Cash on hand: ${formatMoney(cash)}`}
        confirmLabel="Spend"
        maxAmount={cash}
        presets={[5_000, 25_000, 100_000]}
        darkMode={darkMode}
        onClose={() => setSuppressTargetId(null)}
        onConfirm={(amt) => {
          if (suppressTargetId) {
            suppressPoliticalScandal(setGameState, suppressTargetId, amt);
            queueSave();
          }
          setSuppressTargetId(null);
        }}
      />

      <EnactPolicyModal
        visible={showEnactPolicy}
        darkMode={darkMode}
        careerLevel={careerLevel}
        enactedIds={politics.policiesEnacted ?? []}
        cash={cash}
        onClose={() => setShowEnactPolicy(false)}
        onEnact={handleEnactPolicy}
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

function StatCard({
  theme,
  icon: Icon,
  label,
  value,
}: {
  theme: ReturnType<typeof getThemeColors>;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Icon size={scale(14)} color={theme.textMuted} />
      <Text style={[styles.statSmallLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statSmallValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export default function PoliticalApp(props: PoliticalAppProps) {
  return (
    <ErrorBoundary>
      <PoliticalAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  enactCta: {
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
  },
  enactCtaText: {
    color: 'white',
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
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
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  officeName: { fontSize: responsiveFontSize.lg, fontWeight: '800' },
  party: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  statBig: { fontSize: responsiveFontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: responsiveFontSize.xs },
  electionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  electionText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  statGrid: { flexDirection: 'row', gap: responsiveSpacing.sm },
  statCard: {
    flex: 1,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statSmallLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statSmallValue: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  policyRow: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  policyLabel: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  helperText: { fontSize: responsiveFontSize.xs, fontStyle: 'italic' },
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
});
