/**
 * DashboardScreen — multi-company overview.
 *
 * Top: hero KPI strip (total weekly revenue, employees, market share, brand avg).
 * Below: a list of CompanyTile cards. FAB to create a new company.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Briefcase, DollarSign, Plus, TrendingUp, Users } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import KPICard from '../components/KPICard';
import CompanyTile from '../components/CompanyTile';
import EmptyState from '../components/EmptyState';
import { HUSTLE_GRADIENT, HUSTLE_GRADIENT_SOFT } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

const LinearGradient = LinearGradientFallback;

interface DashboardScreenProps {
  onOpenCompany: (companyId: string) => void;
  onCreateCompany: () => void;
}

export default function DashboardScreen({ onOpenCompany, onCreateCompany }: DashboardScreenProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();

  const companies = gameState.companies ?? [];
  const overlays = gameState.hustleApp?.companies ?? {};

  const totals = useMemo(() => {
    let weekly = 0;
    let employees = 0;
    let brandSum = 0;
    let shareSum = 0;
    for (const c of companies) {
      weekly += c.weeklyIncome ?? 0;
      employees += c.employees ?? 0;
      const o = overlays[c.id];
      if (o) {
        brandSum += o.brand?.score ?? 50;
        shareSum += o.marketSharePercent ?? 5;
      } else {
        brandSum += 50;
        shareSum += 5;
      }
    }
    return {
      weekly,
      employees,
      brand: companies.length > 0 ? Math.round(brandSum / companies.length) : 0,
      share: companies.length > 0 ? +(shareSum / companies.length).toFixed(1) : 0,
    };
  }, [companies, overlays]);

  const handleTilePress = useCallback((id: string) => {
    hustleHaptics.tap();
    onOpenCompany(id);
  }, [onOpenCompany]);

  const handleCreatePress = useCallback(() => {
    hustleHaptics.commit();
    onCreateCompany();
  }, [onCreateCompany]);

  if (companies.length === 0) {
    return (
      <View style={styles.emptyRoot}>
        <EmptyState
          observation="No companies yet."
          nudge="Found your first company to start building an empire."
        >
          <Pressable
            onPress={handleCreatePress}
            accessibilityRole="button"
            accessibilityLabel="Found a company"
          >
            <Text style={[styles.cta, { color: HUSTLE_GRADIENT[0] }]}>Found a company →</Text>
          </Pressable>
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero strip */}
        <LinearGradient
          colors={HUSTLE_GRADIENT_SOFT as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: theme.border }]}
        >
          <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Empire snapshot</Text>
          <Text style={[styles.heroValue, { color: theme.text }]}>
            ${totals.weekly.toLocaleString()}<Text style={[styles.heroSuffix, { color: theme.textSecondary }]}> / wk</Text>
          </Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
            {companies.length} {companies.length === 1 ? 'company' : 'companies'} · {totals.employees} employees
          </Text>
        </LinearGradient>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KPICard icon={DollarSign} label="Weekly" value={`$${(totals.weekly / 1000).toFixed(1)}K`} />
          <KPICard icon={Users} label="Employees" value={String(totals.employees)} />
          <KPICard icon={TrendingUp} label="Market" value={`${totals.share}%`} />
          <KPICard icon={Briefcase} label="Brand" value={String(totals.brand)} />
        </View>

        {/* Company list */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Your companies</Text>
        {companies.map((c) => (
          <CompanyTile key={c.id} company={c} overlay={overlays[c.id]} onPress={() => handleTilePress(c.id)} />
        ))}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={handleCreatePress}
        accessibilityRole="button"
        accessibilityLabel="Create new company"
        hitSlop={8}
        style={({ pressed }) => [styles.fabTouch, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <LinearGradient
          colors={HUSTLE_GRADIENT as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Plus size={fontScale(24)} color="#FFFFFF" strokeWidth={2.6} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  cta: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: scale(120),
  },
  hero: {
    borderRadius: scale(16),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.lg,
    marginBottom: responsiveSpacing.md,
  },
  heroLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: fontScale(36),
    fontWeight: '800',
    marginTop: 4,
  },
  heroSuffix: {
    fontSize: fontScale(18),
    fontWeight: '500',
  },
  heroSub: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  sectionLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: responsiveSpacing.sm,
    marginTop: responsiveSpacing.sm,
  },
  fabTouch: {
    position: 'absolute',
    bottom: scale(20),
    right: scale(20),
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    shadowColor: HUSTLE_GRADIENT[0],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: Z_INDEX.DROPDOWN,
  },
  fab: {
    flex: 1,
    borderRadius: touchTargets.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
