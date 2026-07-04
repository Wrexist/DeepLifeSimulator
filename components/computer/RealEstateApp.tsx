/**
 * RealEstateApp — desktop real-estate screen.
 *
 * Remake 4 (no STATE_VERSION bump — extends RealEstate type with optional fields).
 * Replaces the 2,800-LOC modal-heavy version with a 3-tab loop:
 *   - Portfolio: properties you own, equity, total rental income, mortgage status
 *   - Browse: catalog of buyable properties with the new mortgage flow
 *   - Activity: cycle changes, tenant moves, maintenance alerts (read from notifications)
 *
 * Pulls in the mortgage system I built in the banking remake — every catalog
 * property can be financed at a real APR derived from credit score, with PMI
 * for low-down deals and a discount for high-down. Tenant lifecycle + Airbnb
 * variance + neighborhood cycles all run in lib/realEstate/weeklyTick.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ArrowLeft,
  Home,
  ShoppingBag,
  Activity,
  TrendingUp,
  Building,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { RealEstate } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getTabBarSafePadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import PropertyRow from '@/components/realEstate/PropertyRow';
import BuyPropertyModal from '@/components/realEstate/BuyPropertyModal';
import ManagePropertyModal from '@/components/realEstate/ManagePropertyModal';

import {
  buyPropertyWithMortgage,
  sellOwnedProperty,
  setPropertyRentMode,
  stopRenting,
  evictTenant,
  maintainProperty,
  toggleLaunderingFront,
} from '@/contexts/game/actions/RealEstateActions';
import { RentMode } from '@/lib/realEstate/tenancy';

interface RealEstateAppProps {
  onBack: () => void;
}

type Tab = 'portfolio' | 'browse' | 'activity';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: Home },
  { id: 'browse',    label: 'Browse',    icon: ShoppingBag },
  { id: 'activity',  label: 'Activity',  icon: Activity },
];

/**
 * Catalog of buyable properties. Kept inline so the rewrite stays self-contained.
 * The legacy app had 20+ properties; we ship a coherent 8-tier ladder here. Players
 * who already own catalog entries from the legacy app see them in Portfolio.
 */
const CATALOG: RealEstate[] = [
  { id: 'studio-apt', name: 'Studio Apartment', price: 95_000,    weeklyHappiness: 3, weeklyEnergy: 2, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'city-apt',   name: 'City Apartment',   price: 180_000,   weeklyHappiness: 5, weeklyEnergy: 2, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'duplex',     name: 'Duplex',           price: 320_000,   weeklyHappiness: 6, weeklyEnergy: 3, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'sub-house',  name: 'Suburban House',   price: 480_000,   weeklyHappiness: 8, weeklyEnergy: 4, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'lux-condo',  name: 'Luxury Condo',     price: 850_000,   weeklyHappiness: 10, weeklyEnergy: 5, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'townhouse',  name: 'Brownstone',       price: 1_200_000, weeklyHappiness: 11, weeklyEnergy: 5, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'mansion',    name: 'Mansion',          price: 3_500_000, weeklyHappiness: 15, weeklyEnergy: 7, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
  { id: 'penthouse',  name: 'Penthouse',        price: 8_000_000, weeklyHappiness: 20, weeklyEnergy: 10, owned: false, interior: [], upgradeLevel: 0, status: 'vacant' },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function RealEstateAppInner({ onBack }: RealEstateAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [buyTarget, setBuyTarget] = useState<RealEstate | null>(null);
  const [manageTarget, setManageTarget] = useState<RealEstate | null>(null);

  const cash = gameState.stats?.money ?? 0;
  const ownedProperties = useMemo(
    () => (gameState.realEstate ?? []).filter((p) => p.owned),
    [gameState.realEstate]
  );
  const mortgageById = useMemo(() => {
    const map = new Map<string, number>();
    for (const loan of gameState.loans ?? []) {
      if (loan.type === 'mortgage') map.set(loan.id, loan.remaining);
    }
    return map;
  }, [gameState.loans]);

  const totalValue = useMemo(
    () => ownedProperties.reduce((s, p) => s + (p.currentValue ?? p.price), 0),
    [ownedProperties]
  );
  const totalMortgages = useMemo(
    () =>
      ownedProperties.reduce((s, p) => {
        const m = p.mortgageId ? mortgageById.get(p.mortgageId) ?? 0 : 0;
        return s + m;
      }, 0),
    [ownedProperties, mortgageById]
  );
  const totalEquity = Math.max(0, totalValue - totalMortgages);

  // Approximate weekly income from owned-and-rented properties (using last week's rent).
  const weeklyRentEstimate = useMemo(() => {
    return ownedProperties
      .filter((p) => p.status === 'rented' && p.tenant)
      .reduce((s, p) => s + (p.tenant?.weeklyRent ?? 0), 0);
  }, [ownedProperties]);

  // Weekly income for loan DTI gating — approximation that mirrors AdvancedBankApp.
  const weeklyIncome = useMemo(() => {
    let income = 0;
    const job = (gameState.careers ?? []).find((c: any) => c?.id === gameState.currentJob && c?.accepted);
    if (job?.levels && job.level != null) {
      const safeLevel = Math.max(0, Math.min(job.level, job.levels.length - 1));
      income += job.levels[safeLevel]?.salary ?? 0;
    }
    for (const co of (gameState.companies ?? []) as any[]) income += co.weeklyIncome ?? 0;
    income += weeklyRentEstimate;
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies, weeklyRentEstimate]);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  // Catalog filtered to properties NOT yet owned.
  const browseList = useMemo(
    () => CATALOG.filter((c) => !ownedProperties.some((o) => o.id === c.id)),
    [ownedProperties]
  );

  // Most recent property-related notifications (from the weekly tick).
  // Best-effort: read from gameState.eventLog if it exists; otherwise show a hint.
  const activity = useMemo(() => {
    const log = (gameState.eventLog ?? []).filter((e: any) =>
      typeof e?.description === 'string' && /property|tenant|neighborhood|maintenance|mortgage/i.test(e.description)
    );
    return log.slice(0, 10);
  }, [gameState.eventLog]);

  // --- Render helpers -----------------------------------------------------
  const renderPortfolio = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <EconomyEventBanner context="generic" />

      <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent.info }]}>
          <Building size={scale(20)} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Portfolio equity</Text>
          <Text style={[styles.heroValue, { color: theme.text }]}>{formatMoney(totalEquity)}</Text>
          <Text style={[styles.heroSub, { color: theme.textMuted }]}>
            {ownedProperties.length} {ownedProperties.length === 1 ? 'property' : 'properties'} · Value{' '}
            {formatMoney(totalValue)} − Mortgage {formatMoney(totalMortgages)}
          </Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard theme={theme} icon={TrendingUp} label="Weekly rent" value={formatMoney(weeklyRentEstimate)} />
        <StatCard theme={theme} icon={Home} label="Owned" value={String(ownedProperties.length)} />
      </View>

      <SectionTitle theme={theme}>Your Properties</SectionTitle>
      {ownedProperties.length === 0 ? (
        <EmptyText theme={theme}>
          You don&apos;t own any property yet. Browse the catalog to buy your first home.
        </EmptyText>
      ) : (
        ownedProperties.map((p) => (
          <PropertyRow
            key={p.id}
            property={p}
            mortgageRemaining={p.mortgageId ? mortgageById.get(p.mortgageId) : undefined}
            darkMode={darkMode}
            detailed
            onPress={() => setManageTarget(p)}
          />
        ))
      )}
    </View>
  );

  const renderBrowse = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <SectionTitle theme={theme}>Available Properties</SectionTitle>
      {browseList.length === 0 ? (
        <EmptyText theme={theme}>You already own every property in the catalog!</EmptyText>
      ) : (
        browseList.map((p) => (
          <PropertyRow
            key={p.id}
            property={p}
            darkMode={darkMode}
            onPress={() => setBuyTarget(p)}
          />
        ))
      )}
    </View>
  );

  const renderActivity = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      <SectionTitle theme={theme}>Recent Activity</SectionTitle>
      {activity.length === 0 ? (
        <EmptyText theme={theme}>
          No recent real-estate events. Cycle shifts, tenant moves, and maintenance alerts will appear here.
        </EmptyText>
      ) : (
        activity.map((e: any, idx: number) => (
          <View
            key={`re-act-${idx}`}
            style={[styles.activityRow, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          >
            <Text style={[styles.activityWeek, { color: theme.textMuted }]}>w{e.weeksLived ?? e.week ?? '?'}</Text>
            <Text style={[styles.activityText, { color: theme.textSecondary }]} numberOfLines={2}>
              {e.description}
            </Text>
          </View>
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
        <Text style={[styles.appTitle, { color: theme.text }]}>Real Estate</Text>
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
        {activeTab === 'portfolio' && renderPortfolio()}
        {activeTab === 'browse' && renderBrowse()}
        {activeTab === 'activity' && renderActivity()}
      </ScrollView>

      <BuyPropertyModal
        visible={!!buyTarget}
        property={buyTarget}
        gameState={gameState}
        weeklyIncome={weeklyIncome}
        darkMode={darkMode}
        onClose={() => setBuyTarget(null)}
        onConfirm={(spec) => {
          if (buyTarget) {
            buyPropertyWithMortgage(setGameState, {
              property: buyTarget,
              tier: spec.tier,
              term: spec.term,
              weeklyIncome,
              asResidence: spec.asResidence,
            });
            queueSave();
          }
          setBuyTarget(null);
        }}
      />

      <ManagePropertyModal
        visible={!!manageTarget}
        property={manageTarget}
        mortgageRemaining={
          manageTarget?.mortgageId ? mortgageById.get(manageTarget.mortgageId) : undefined
        }
        availableCash={cash}
        darkMode={darkMode}
        onClose={() => setManageTarget(null)}
        onSetRentMode={(mode: RentMode, weeklyRent) => {
          if (manageTarget) {
            setPropertyRentMode(setGameState, manageTarget.id, mode, weeklyRent);
            queueSave();
          }
          setManageTarget(null);
        }}
        onStopRenting={() => {
          if (manageTarget) {
            stopRenting(setGameState, manageTarget.id);
            queueSave();
          }
          setManageTarget(null);
        }}
        onEvict={() => {
          if (manageTarget) {
            evictTenant(setGameState, manageTarget.id);
            queueSave();
          }
        }}
        onMaintain={() => {
          if (manageTarget) {
            maintainProperty(setGameState, manageTarget.id);
            queueSave();
          }
        }}
        onSell={() => {
          if (manageTarget) {
            sellOwnedProperty(setGameState, manageTarget.id);
            queueSave();
          }
          setManageTarget(null);
        }}
        onToggleLaunderingFront={() => {
          if (manageTarget) {
            toggleLaunderingFront(setGameState, manageTarget.id);
            queueSave();
          }
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

function StatCard({
  icon: Icon,
  label,
  value,
  theme,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Icon size={scale(14)} color={theme.textMuted} />
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export default function RealEstateApp(props: RealEstateAppProps) {
  return (
    <ErrorBoundary>
      <RealEstateAppInner {...props} />
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  heroIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  heroValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800' },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  statGrid: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  statCard: {
    flex: 1,
    padding: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statValue: { fontSize: responsiveFontSize.md, fontWeight: '800' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  activityWeek: { fontSize: responsiveFontSize.xs, fontWeight: '700', minWidth: scale(28) },
  activityText: { flex: 1, fontSize: responsiveFontSize.xs },
});
