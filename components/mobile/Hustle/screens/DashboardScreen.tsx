/**
 * DashboardScreen — multi-company overview.
 *
 * Top: hero KPI strip (total weekly revenue, employees, market share, brand avg).
 * Below: a list of CompanyTile cards. FAB to create a new company.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Briefcase, DollarSign, Plus, TrendingUp, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { Z_INDEX } from '@/utils/zIndexConstants';
import KPICard from '../components/KPICard';
import CompanyTile from '../components/CompanyTile';
import EmptyState from '../components/EmptyState';
import { HUSTLE_GRADIENT } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

const LinearGradient = LinearGradientFallback;

interface DashboardScreenProps {
  onOpenCompany: (companyId: string) => void;
  onCreateCompany: () => void;
}

export default function DashboardScreen({ onOpenCompany, onCreateCompany }: DashboardScreenProps) {
  const { gameState } = useGame();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const companies = gameState.companies ?? [];
  const overlays = gameState.hustleApp?.companies ?? {};

  const totals = useMemo(() => {
    let weekly = 0;
    let employees = 0;
    let brandSum = 0;
    let shareSum = 0;
    for (const c of companies) {
      weekly += c.weeklyIncome ?? 0;
      // c.employees is the canonical headcount and already INCLUDES named
      // hires (hireCandidate/fireNamedHire keep it in sync) — never add
      // overlay.hiringPipeline.namedHires.length on top of this.
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
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {/* Hero strip — Recipe B (identity indigo) */}
        <View
          style={[
            getGlassCard(isDark, 12),
            styles.hero,
            {
              backgroundColor: theme.surface,
              borderColor: isDark ? theme.glassBorder : theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.heroInner}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(99, 102, 241, 0.14)', 'rgba(99, 102, 241, 0.03)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.heroGlow} />
            {isDark && <View pointerEvents="none" style={styles.heroHairline} />}
            <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Empire snapshot</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              ${totals.weekly.toLocaleString()}<Text style={[styles.heroSuffix, { color: theme.textSecondary }]}> / wk</Text>
            </Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
              {companies.length} {companies.length === 1 ? 'company' : 'companies'} · {totals.employees} employees
            </Text>
          </View>
        </View>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KPICard icon={DollarSign} label="Weekly" value={`$${(totals.weekly / 1000).toFixed(1)}K`} />
          <KPICard icon={Users} label="Employees" value={String(totals.employees)} />
          <KPICard icon={TrendingUp} label="Market" value={`${totals.share}%`} />
          <KPICard icon={Briefcase} label="Brand" value={String(totals.brand)} />
        </View>

        {/* Company list */}
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Your companies</Text>
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
        style={({ pressed }) => [
          styles.fabTouch,
          // Lift the FAB above the floating phone tab bar (was hidden under it).
          { bottom: getAppScreenBottomPadding(insets.bottom) },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
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
    borderRadius: responsiveBorderRadius['2xl'],
    marginBottom: responsiveSpacing.md,
  },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroGlow: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: fontScale(36),
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
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
    fontSize: fontScale(15),
    fontWeight: '700',
    letterSpacing: 0.2,
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
    zIndex: Z_INDEX.DROPDOWN,
    ...getPlatformShadows(5, 0.3, 2, 8),
  },
  fab: {
    flex: 1,
    borderRadius: touchTargets.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
