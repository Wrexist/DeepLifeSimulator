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
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle, ArrowLeft, Briefcase, Building2, ChevronRight,
  DollarSign, Megaphone, Rocket, TrendingUp, UserMinus, UserPlus, Users, Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getGlassButton, getPlatformShadows } from '@/utils/glassmorphismStyles';
import KPICard from '../components/KPICard';
import { HUSTLE_GRADIENT, HUSTLE_COLORS, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import { addWorker, removeWorker } from '@/contexts/game/company';
import { buyCompanyUpgrade } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { COMPANY_UPGRADES, COMPANY_UPGRADE_COST_MULTIPLIER } from '@/contexts/game/companyUpgradeCatalog';
import { getInflatedPrice } from '@/lib/economy/inflation';
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
  const { gameState, setGameState, saveGame } = useGame();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const company = useMemo(
    () => (gameState.companies ?? []).find((c) => c.id === companyId),
    [gameState.companies, companyId],
  );
  const overlay: HustleCompanyOverlay | undefined = gameState.hustleApp?.companies?.[companyId];

  // Generic staff management — canonical addWorker/removeWorker mutators
  // (contexts/game/company.ts). Hiring charges one week's salary up front and
  // recomputes weeklyIncome with the diminishing-returns headcount multiplier.
  const handleHireWorker = useCallback(() => {
    hustleHaptics.tap();
    addWorker(gameState, setGameState, companyId);
    saveGame?.();
  }, [gameState, setGameState, companyId, saveGame]);

  const handleRemoveWorker = useCallback(() => {
    hustleHaptics.tap();
    removeWorker(gameState, setGameState, companyId);
    saveGame?.();
  }, [gameState, setGameState, companyId, saveGame]);

  const handleBuyUpgrade = useCallback((upgradeId: string) => {
    const r = buyCompanyUpgrade(gameState, setGameState, upgradeId, { updateMoney }, companyId);
    if (r.success) {
      hustleHaptics.success();
      saveGame?.();
    } else {
      hustleHaptics.error();
      Alert.alert('Upgrade', r.message);
    }
  }, [gameState, setGameState, companyId, saveGame]);

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

  // Staff + upgrade derived state
  const money = gameState.stats?.money ?? 0;
  const STAFF_CAP = 30; // matches addWorker's hard cap
  const canHireWorker = company.employees < STAFF_CAP && money >= company.workerSalary;
  const canRemoveWorker = company.employees > 0;
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0
    ? gameState.economy.priceIndex
    : 1;
  const upgradeDiscount = gameState.settings?.businessBanking ? 0.15 : 0;
  const upgradeDefs = COMPANY_UPGRADES[company.type] ?? [];

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
          style={[styles.scandalBanner, { backgroundColor: HUSTLE_COLORS.danger + '26', borderLeftColor: HUSTLE_COLORS.danger }]}
        >
          <AlertTriangle size={fontScale(16)} color={HUSTLE_COLORS.danger} />
          <View style={styles.scandalText}>
            <Text style={[styles.scandalTitle, { color: HUSTLE_COLORS.danger }]}>Active scandal · severity {scandal.severity}</Text>
            <Text style={[styles.scandalHead, { color: theme.text }]} numberOfLines={1}>{scandal.headline}</Text>
          </View>
          <ChevronRight size={fontScale(16)} color={theme.textMuted} />
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {/* Hero — Recipe B (industry-tinted, translucent) */}
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
              colors={[accent + '24', accent + '08']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: accent + '17' }]} />
            {isDark && <View pointerEvents="none" style={styles.heroHairline} />}
            <Text style={[styles.heroIndustry, { color: theme.textMuted }]}>
              {company.type.toUpperCase()} {isPublic ? '· PUBLIC' : ''}
            </Text>
            <Text style={[styles.heroRevenue, { color: theme.text }]}>
              ${(company.weeklyIncome ?? 0).toLocaleString()}
              <Text style={[styles.heroRevenueSuffix, { color: theme.textSecondary }]}> / week</Text>
            </Text>
            <Text style={[styles.heroEmployees, { color: theme.textSecondary }]}>
              {/* employees already INCLUDES named hires — do not sum them */}
              {company.employees} employees{namedHires.length > 0 ? ` (incl. ${namedHires.length} key ${namedHires.length === 1 ? 'hire' : 'hires'})` : ''}
            </Text>
          </View>
        </View>

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

        {/* Staff — generic employees via canonical addWorker/removeWorker */}
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Staff</Text>
        <View style={[getGlassCard(isDark, 6), styles.staffCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.staffCount, { color: theme.text }]}>
            {company.employees} / {STAFF_CAP} employees
          </Text>
          <Text style={[styles.staffHint, { color: theme.textSecondary }]}>
            Hiring costs ${company.workerSalary.toLocaleString()} up front. Each employee compounds weekly income:
            +10% each for the first 5, then smaller gains (+5%, +2%, +1%) up to {STAFF_CAP}. Removing staff is free but lowers income.
          </Text>
          <View style={styles.staffBtnRow}>
            <Pressable
              onPress={handleHireWorker}
              disabled={!canHireWorker}
              accessibilityRole="button"
              accessibilityLabel={`Hire employee for $${company.workerSalary.toLocaleString()}`}
              accessibilityState={{ disabled: !canHireWorker }}
              style={[styles.staffBtn, canHireWorker && getPlatformShadows(5, 0.3, 2, 8), { backgroundColor: HUSTLE_COLORS.accent, opacity: canHireWorker ? 1 : 0.5 }]}
            >
              <UserPlus size={fontScale(16)} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.staffBtnText}>Hire · ${company.workerSalary.toLocaleString()}</Text>
            </Pressable>
            <Pressable
              onPress={handleRemoveWorker}
              disabled={!canRemoveWorker}
              accessibilityRole="button"
              accessibilityLabel="Remove employee"
              accessibilityState={{ disabled: !canRemoveWorker }}
              style={[getGlassButton(isDark), styles.staffBtnOutline, { opacity: canRemoveWorker ? 1 : 0.5 }]}
            >
              <UserMinus size={fontScale(16)} color={HUSTLE_COLORS.danger} strokeWidth={2.2} />
              <Text style={[styles.staffBtnOutlineText, { color: HUSTLE_COLORS.danger }]}>Remove</Text>
            </Pressable>
          </View>
        </View>

        {/* Action cards */}
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Actions</Text>

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

        {/* Upgrades — canonical buyCompanyUpgrade catalog */}
        {upgradeDefs.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Upgrades</Text>
            {upgradeDefs.map((def) => {
              const owned = (company.upgrades ?? []).find((u) => u.id === def.id);
              const level = owned?.level ?? 0;
              const maxed = level >= def.maxLevel;
              const nextLevelCost = level === 0
                ? def.cost
                : Math.round(def.cost * Math.pow(COMPANY_UPGRADE_COST_MULTIPLIER, level));
              const cost = Math.round(getInflatedPrice(nextLevelCost, priceIndex) * (1 - upgradeDiscount));
              const affordable = money >= cost;
              return (
                <View key={def.id} style={[getGlassCard(isDark, 6), styles.upgradeRow, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                  <View style={[styles.actionIconSquare, { backgroundColor: HUSTLE_COLORS.warning + '26', borderColor: HUSTLE_COLORS.warning + '4D' }]}>
                    <Zap size={fontScale(18)} color={HUSTLE_COLORS.warning} strokeWidth={2.2} />
                  </View>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: theme.text }]}>
                      {def.name} · Lv {level}/{def.maxLevel}
                    </Text>
                    <Text style={[styles.actionSub, { color: theme.textSecondary }]} numberOfLines={2}>
                      {def.description} · +${def.weeklyIncomeBonus.toLocaleString()}/wk base (reduced at higher levels)
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleBuyUpgrade(def.id)}
                    disabled={maxed || !affordable}
                    accessibilityRole="button"
                    accessibilityLabel={maxed ? `${def.name} is at max level` : `Buy ${def.name} for $${cost.toLocaleString()}`}
                    accessibilityState={{ disabled: maxed || !affordable }}
                    style={[
                      styles.upgradeBuyBtn,
                      {
                        backgroundColor: maxed ? theme.surfaceElevated : HUSTLE_COLORS.accent + '24',
                        opacity: maxed || !affordable ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.upgradeBuyText, { color: maxed ? theme.textMuted : HUSTLE_COLORS.accent }]}>{maxed ? 'MAX' : `$${cost.toLocaleString()}`}</Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}

        {/* Notifications list */}
        {overlay && overlay.notifications.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Recent alerts</Text>
            <View style={[getGlassCard(isDark, 6), styles.notifCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              {overlay.notifications.slice(0, 5).map((n, i) => (
                <View
                  key={n.id}
                  style={[styles.notifRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  {!n.read ? <View style={[styles.unreadDot, { backgroundColor: HUSTLE_COLORS.accent }]} /> : <View style={styles.unreadSpacer} />}
                  <Text style={[styles.notifText, { color: theme.text }]} numberOfLines={2}>
                    {n.text}
                  </Text>
                </View>
              ))}
            </View>
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
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        getGlassCard(isDark, 6),
        styles.actionRow,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.actionIconSquare, { backgroundColor: color + '26', borderColor: color + '4D' }]}>
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
      <ChevronRight size={fontScale(18)} color={theme.textMuted} />
    </Pressable>
  );
}

function Header({ theme, title, onBack }: { theme: any; title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
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
    borderLeftWidth: 3,
  },
  scandalText: { flex: 1 },
  scandalTitle: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  scandalHead: {
    fontSize: fontScale(13),
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: scale(40),
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
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroIndustry: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroRevenue: {
    fontSize: fontScale(32),
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroRevenueSuffix: {
    fontSize: fontScale(16),
    fontWeight: '500',
  },
  heroEmployees: {
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.sm,
  },
  actionIconSquare: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(8),
    borderWidth: 1,
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
    fontVariant: ['tabular-nums'],
  },
  staffCard: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  staffCount: {
    fontSize: fontScale(14),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  staffHint: {
    fontSize: fontScale(11),
    lineHeight: fontScale(15),
  },
  staffBtnRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  staffBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: responsiveBorderRadius.full,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
  },
  staffBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  staffBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: responsiveBorderRadius.full,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
  },
  staffBtnOutlineText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.sm,
  },
  upgradeBuyBtn: {
    borderRadius: responsiveBorderRadius.full,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: 8,
    minWidth: scale(72),
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBuyText: {
    fontSize: fontScale(11),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  notifCard: {
    borderRadius: responsiveBorderRadius.xl,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.sm,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
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
