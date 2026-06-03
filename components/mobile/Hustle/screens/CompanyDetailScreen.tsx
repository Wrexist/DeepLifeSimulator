/**
 * CompanyDetailScreen — single-company deep view.
 *
 * Header: name + industry + key metrics.
 * Body: tabs for Overview / Hire / Marketing / Scandals / Acquisitions.
 * Footer actions: hire, launch campaign, IPO, accept acquisition (gated by state).
 *
 * Existing CompanyActions (createCompany, buyCompanyUpgrade) remain canonical
 * for the upgrade economy — Hustle layers premium systems on top.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle, ArrowLeft, Briefcase, Building2, ChevronRight,
  DollarSign, Megaphone, Rocket, TrendingUp, Users, Zap,
} from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import KPICard from '../components/KPICard';
import { HUSTLE_GRADIENT, HUSTLE_COLORS, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import type { HustleCompanyOverlay } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

interface CompanyDetailScreenProps {
  companyId: string;
  onBack: () => void;
  onOpenHire: () => void;
  onOpenCampaign: () => void;
  onOpenScandal: () => void;
  onOpenIPO: () => void;
  onOpenAcquisitions: () => void;
}

export default function CompanyDetailScreen({
  companyId, onBack, onOpenHire, onOpenCampaign, onOpenScandal, onOpenIPO, onOpenAcquisitions,
}: CompanyDetailScreenProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();

  const company = useMemo(
    () => (gameState.companies ?? []).find((c) => c.id === companyId),
    [gameState.companies, companyId],
  );
  const overlay: HustleCompanyOverlay | undefined = gameState.hustleApp?.companies?.[companyId];

  if (!company) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Header theme={theme} title="Company" onBack={onBack} />
        <View style={styles.missingWrap}>
          <Text style={[styles.missingText, { color: theme.textSecondary }]}>
            This company is no longer in your portfolio.
          </Text>
        </View>
      </View>
    );
  }

  const accent = industryColor(company.type);
  const brand = overlay?.brand?.score ?? 50;
  const share = overlay?.marketSharePercent ?? 5;
  const scandal = overlay?.activeScandal;
  const activeCampaignsCount = overlay?.activeCampaigns?.length ?? 0;
  const pendingAcqCount = overlay?.pendingAcquisitions?.length ?? 0;
  const namedHires = overlay?.hiringPipeline?.namedHires ?? [];
  const isPublic = overlay?.ipo?.status === 'public';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Header theme={theme} title={company.name} onBack={onBack} />

      {/* Sticky scandal banner */}
      {scandal ? (
        <Pressable
          onPress={() => {
            hustleHaptics.tap();
            onOpenScandal();
          }}
          accessibilityRole="alert"
          accessibilityLabel={`Active scandal: ${scandal.headline}, severity ${scandal.severity}, tap to respond`}
          style={[styles.scandalBanner, { backgroundColor: HUSTLE_COLORS.danger }]}
        >
          <AlertTriangle size={fontScale(16)} color="#FFFFFF" />
          <View style={styles.scandalText}>
            <Text style={styles.scandalTitle}>Active scandal · severity {scandal.severity}</Text>
            <Text style={styles.scandalHead} numberOfLines={1}>{scandal.headline}</Text>
          </View>
          <ChevronRight size={fontScale(16)} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={[accent + 'BB', accent + '66']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroIndustry}>
            {company.type.toUpperCase()} {isPublic ? '· PUBLIC' : ''}
          </Text>
          <Text style={styles.heroRevenue}>
            ${(company.weeklyIncome ?? 0).toLocaleString()}
            <Text style={styles.heroRevenueSuffix}> / week</Text>
          </Text>
          <Text style={styles.heroEmployees}>
            {company.employees} employees · {namedHires.length} key hires
          </Text>
        </LinearGradient>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KPICard icon={Briefcase} label="Brand" value={String(brand)} trend={overlay?.brand?.trend === 'rising' ? 'up' : overlay?.brand?.trend === 'declining' ? 'down' : 'flat'} trendValue={overlay?.brand?.trend ?? 'flat'} />
          <KPICard icon={TrendingUp} label="Share" value={`${share}%`} />
          <KPICard icon={DollarSign} label="Cash" value={`$${Math.round((company.money ?? 0) / 1000)}K`} />
          {isPublic && overlay?.ipo ? (
            <KPICard icon={Rocket} label="Share $" value={`$${overlay.ipo.sharePrice.toFixed(2)}`} />
          ) : (
            <KPICard icon={Users} label="Employees" value={String(company.employees)} />
          )}
        </View>

        {/* Action cards */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Actions</Text>

        <ActionRow
          icon={Users}
          color={HUSTLE_COLORS.accent}
          title="Hiring pipeline"
          subtitle={`${overlay?.hiringPipeline?.candidates?.length ?? 0} candidates · ${namedHires.length} hired`}
          theme={theme}
          onPress={() => { hustleHaptics.tap(); onOpenHire(); }}
        />
        <ActionRow
          icon={Megaphone}
          color={HUSTLE_COLORS.accentSecondary}
          title="Marketing campaigns"
          subtitle={activeCampaignsCount > 0 ? `${activeCampaignsCount} running` : 'No active campaigns'}
          theme={theme}
          onPress={() => { hustleHaptics.tap(); onOpenCampaign(); }}
        />
        {!isPublic ? (
          <ActionRow
            icon={Rocket}
            color={HUSTLE_COLORS.success}
            title="Take public (IPO)"
            subtitle={(company.weeklyIncome ?? 0) >= 10_000 ? 'Eligible — raise capital, dilute ownership' : 'Need $10K/week revenue'}
            theme={theme}
            onPress={() => { hustleHaptics.tap(); onOpenIPO(); }}
            disabled={(company.weeklyIncome ?? 0) < 10_000 || !!scandal}
          />
        ) : (
          <ActionRow
            icon={Rocket}
            color={HUSTLE_COLORS.success}
            title="Quarterly earnings"
            subtitle={`Share price $${overlay!.ipo.sharePrice.toFixed(2)} · ${overlay!.ipo.recentEarnings.length} reports`}
            theme={theme}
            onPress={() => { hustleHaptics.tap(); onOpenIPO(); }}
          />
        )}
        <ActionRow
          icon={Building2}
          color={HUSTLE_COLORS.factory}
          title="Acquisitions"
          subtitle={pendingAcqCount > 0 ? `${pendingAcqCount} open offers` : 'No pending offers'}
          theme={theme}
          onPress={() => { hustleHaptics.tap(); onOpenAcquisitions(); }}
          badge={pendingAcqCount}
        />

        {/* Notifications list */}
        {overlay && overlay.notifications.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Recent alerts</Text>
            {overlay.notifications.slice(0, 5).map((n) => (
              <View
                key={n.id}
                style={[styles.notifRow, { borderBottomColor: theme.border }]}
              >
                {!n.read ? <View style={[styles.unreadDot, { backgroundColor: HUSTLE_COLORS.accent }]} /> : <View style={styles.unreadSpacer} />}
                <Text style={[styles.notifText, { color: theme.text }]} numberOfLines={2}>
                  {n.text}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActionRow({
  icon: Icon, color, title, subtitle, theme, onPress, disabled, badge,
}: {
  icon: any;
  color: string;
  title: string;
  subtitle: string;
  theme: any;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.actionIconSquare, { backgroundColor: color + '22' }]}>
        <Icon size={fontScale(20)} color={color} strokeWidth={2.2} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.actionSub, { color: theme.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {badge !== undefined && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: HUSTLE_COLORS.accent }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={fontScale(18)} color={theme.textSecondary} />
    </Pressable>
  );
}

function Header({ theme, title, onBack }: { theme: any; title: string; onBack: () => void }) {
  return (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
        <ArrowLeft size={fontScale(22)} color={theme.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.headerBtn} />
    </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.xl,
  },
  missingText: {
    fontSize: fontScale(14),
    textAlign: 'center',
  },
  scandalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
  },
  scandalText: { flex: 1 },
  scandalTitle: {
    color: '#FFFFFF',
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  scandalHead: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: scale(40),
  },
  hero: {
    borderRadius: scale(16),
    padding: responsiveSpacing.lg,
    marginBottom: responsiveSpacing.md,
  },
  heroIndustry: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroRevenue: {
    color: '#FFFFFF',
    fontSize: fontScale(32),
    fontWeight: '800',
    marginTop: 4,
  },
  heroRevenueSuffix: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontScale(16),
    fontWeight: '500',
  },
  heroEmployees: {
    color: 'rgba(255,255,255,0.92)',
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: responsiveSpacing.sm,
  },
  actionIconSquare: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  actionSub: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '800',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  unreadSpacer: { width: 6 },
  notifText: {
    flex: 1,
    fontSize: fontScale(13),
  },
});
