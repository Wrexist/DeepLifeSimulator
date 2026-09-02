/**
 * CompanyDetailScreen - single-company deep view (business-dashboard DNA).
 *
 * Header: name + industry + key metrics.
 * Body reads as DEPARTMENTS, each surfacing existing overlay data the old UI
 * hid: a staff roster (Face avatars + morale/performance meters), a marketing
 * desk (live campaign rows), a growth desk (IPO + board seats + acquisition
 * offers), upgrade tracks as ProgressRings, suppliers, and a scandal ledger.
 * Every prior action (hire/remove, pipeline, campaign, IPO, acquisitions,
 * upgrade buys, notifications) stays reachable.
 *
 * Existing CompanyActions (createCompany, buyCompanyUpgrade) remain canonical
 * for the upgrade economy - Hustle layers premium systems on top.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle, Award, Building2, ChevronRight, Crown,
  FileText, FlaskConical, Gem, History, Megaphone, Package, Rocket, Star,
  UserMinus, UserPlus, Users, Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import Chip from '@/components/ui/Chip';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import KeyValueRow from '@/components/ui/KeyValueRow';
import ProgressBar from '@/components/ui/ProgressBar';
import ProgressRing from '@/components/ui/ProgressRing';
import StatStrip, { StatTile } from '@/components/ui/StatStrip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getGlassButton, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { HUSTLE_COLORS, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';
import { addWorker, removeWorker, quoteCompanySaleValue, sellCompany } from '@/contexts/game/company';
import { useCompanyActions } from '@/contexts/game/CompanyActionsContext';
import { buyCompanyUpgrade } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { formatMoney } from '@/utils/moneyFormatting';
import { buildRDLab, startResearch, filePatent, enterCompetition } from '@/contexts/game/actions/RDActions';
import { clearHustleNotifications, markHustleNotificationRead } from '@/contexts/game/actions/HustleActions';
import { LAB_TYPES, getLabUpgradeCost, type LabType } from '@/lib/rd/labs';
import { getAvailableTechnologies, getTechnologiesForCompany, getTechnologyById } from '@/lib/rd/technologyTree';
import { getActiveCompetitions, canEnterCompetition } from '@/lib/rd/competitions';
import { PATENT_COSTS } from '@/lib/config/gameConstants';
import { COMPANY_UPGRADES, COMPANY_UPGRADE_COST_MULTIPLIER } from '@/contexts/game/companyUpgradeCatalog';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { generateBoardSeats, generateSuppliers , companyIncomeFactors } from '@/lib/business/hustleLogic';
import { companyWeeklyIncomeFor } from '@/lib/economy/passiveIncome';
import type { HustleCompanyOverlay, HustleIndustry } from '@/contexts/game/types';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { gameAlert } from '@/utils/gameAlert';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const CAMPAIGN_LABEL: Record<string, string> = {
  tv: 'TV spots', social: 'Social ads', billboard: 'Billboards', influencer: 'Influencers', guerrilla: 'Guerrilla',
};
const BOARD_ROLE: Record<string, string> = {
  chair: 'Chair', cfo: 'CFO', cto: 'CTO', cmo: 'CMO', lead_investor: 'Lead investor', independent: 'Independent',
};
const scandalKindLabel = (k: string) => k.split('_').map(cap).join(' ');
const meterColor = (v: number) => (v >= 70 ? HUSTLE_COLORS.success : v >= 45 ? HUSTLE_COLORS.warning : HUSTLE_COLORS.danger);

// Family-business economy - costs + effects mirror createFamilyBusiness /
// manageFamilyBusiness in FamilyBusinessActions (those actions stay the source of
// truth; these are display-only labels for the buttons).
const FAMILY_BUSINESS_COST = 1_000_000; // one-time conversion cost in createFamilyBusiness
const FAMILY_MANAGE_OPTIONS: { action: 'marketing' | 'branding' | 'reputation'; label: string; cost: number; effect: string }[] = [
  { action: 'marketing', label: 'Marketing push', cost: 10_000, effect: '+5 brand value' },
  { action: 'reputation', label: 'Reputation drive', cost: 25_000, effect: '+10 reputation' },
  { action: 'branding', label: 'Full rebrand', cost: 50_000, effect: '+15 brand · +2 reputation' },
];

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
  const { createFamilyBusiness, manageFamilyBusiness } = useCompanyActions();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const weeksLived = gameState.weeksLived ?? 0;

  const company = useMemo(
    () => (gameState.companies ?? []).find((c) => c.id === companyId),
    [gameState.companies, companyId],
  );
  const overlay: HustleCompanyOverlay | undefined = gameState.hustleApp?.companies?.[companyId];

  // Generic staff management - canonical addWorker/removeWorker mutators
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

  // Exit path - the suite let you found/staff/IPO/acquire but never divest.
  // 50% of total (inflated) investment, quoted up front in the confirm.
  const handleSellCompany = useCallback(() => {
    const quote = quoteCompanySaleValue(gameState, companyId);
    if (quote == null) return;
    hustleHaptics.tap();
    gameAlert(
      'Sell company',
      `Sell for ${formatMoney(quote)} (50% of what you've invested)? Staff, upgrades, and any IPO position are gone for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          style: 'destructive',
          onPress: () => {
            const r = sellCompany(gameState, setGameState, companyId);
            if (r.success) {
              hustleHaptics.success();
              saveGame?.();
              onBack();
            } else {
              hustleHaptics.error();
              if (r.message) gameAlert('Sale failed', r.message);
            }
          },
        },
      ],
    );
  }, [gameState, setGameState, companyId, saveGame, onBack]);

  const handleBuyUpgrade = useCallback((upgradeId: string) => {
    const r = buyCompanyUpgrade(gameState, setGameState, upgradeId, { updateMoney }, companyId);
    if (r.success) {
      hustleHaptics.success();
      saveGame?.();
    } else {
      hustleHaptics.error();
      gameAlert('Upgrade', r.message);
    }
  }, [gameState, setGameState, companyId, saveGame]);

  // ───────── Notifications ─────────
  // `markHustleNotificationRead` / `clearHustleNotifications` existed in
  // HustleActions with no caller anywhere in the app, so `overlay.notifications`
  // accumulated and rendered permanently unread.
  const handleMarkNotificationRead = useCallback((notificationId: string) => {
    hustleHaptics.tap();
    markHustleNotificationRead(setGameState, companyId, notificationId);
    saveGame?.();
  }, [setGameState, companyId, saveGame]);

  const handleClearNotifications = useCallback(() => {
    hustleHaptics.tap();
    clearHustleNotifications(setGameState, companyId);
    saveGame?.();
  }, [setGameState, companyId, saveGame]);

  // ───────── R&D handlers - thin wrappers over the canonical RDActions ─────────
  // (buildRDLab / startResearch / filePatent / enterCompetition). The weekly
  // research tick + completion/breakthrough live in CompanyActionsContext.
  const handleBuildLab = useCallback((labType: LabType) => {
    const r = buildRDLab(gameState, setGameState, companyId, labType, { updateMoney });
    if (r.success) { hustleHaptics.success(); saveGame?.(); }
    else { hustleHaptics.error(); gameAlert('R&D Lab', r.message); }
  }, [gameState, setGameState, companyId, saveGame]);

  const handleStartResearch = useCallback((technologyId: string) => {
    const r = startResearch(gameState, setGameState, companyId, technologyId, { updateMoney });
    if (r.success) { hustleHaptics.success(); saveGame?.(); }
    else { hustleHaptics.error(); gameAlert('Research', r.message); }
  }, [gameState, setGameState, companyId, saveGame]);

  const handleFilePatent = useCallback((technologyId: string) => {
    const r = filePatent(gameState, setGameState, companyId, technologyId, { updateMoney });
    if (r.success) { hustleHaptics.success(); saveGame?.(); }
    else { hustleHaptics.error(); gameAlert('Patent', r.message); }
  }, [gameState, setGameState, companyId, saveGame]);

  const handleEnterCompetition = useCallback((competitionId: string) => {
    const r = enterCompetition(gameState, setGameState, companyId, competitionId, { updateMoney });
    if (r.success) { hustleHaptics.success(); saveGame?.(); }
    else { hustleHaptics.error(); gameAlert('Competition', r.message); }
  }, [gameState, setGameState, companyId, saveGame]);

  // ───────── Family-business handlers - canonical CompanyActionsContext actions ─────────
  // createFamilyBusiness converts this company into a multi-generation legacy
  // ($1M, atomic); manageFamilyBusiness spends to build brand + reputation (also
  // atomic - one charge, one benefit per tap). The button gating below keeps the
  // disabled states honest, so a press only fires when it can succeed.
  const handleConvertToFamilyBusiness = useCallback(() => {
    hustleHaptics.tap();
    createFamilyBusiness(companyId);
    saveGame?.();
  }, [createFamilyBusiness, companyId, saveGame]);

  const handleManageFamilyBusiness = useCallback((action: 'marketing' | 'branding' | 'reputation') => {
    const r = manageFamilyBusiness(companyId, action);
    if (r.success) { hustleHaptics.success(); saveGame?.(); }
    else { hustleHaptics.error(); gameAlert('Family Business', r.message); }
  }, [manageFamilyBusiness, companyId, saveGame]);

  if (!company) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AppHeader title="Company" onBack={onBack} backLabel="Back to portfolio" centered />
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
  const campaigns = overlay?.activeCampaigns ?? [];
  const activeCampaignsCount = campaigns.length;
  const pendingAcqs = overlay?.pendingAcquisitions ?? [];
  const pendingAcqCount = pendingAcqs.length;
  const namedHires = overlay?.hiringPipeline?.namedHires ?? [];
  const scandalHistory = overlay?.scandalHistory ?? [];
  const isPublic = overlay?.ipo?.status === 'public';

  // Board seats + suppliers were initialized [] and never written, so their
  // sections rendered as permanently dead. Derive a stable, deterministic roster
  // when the overlay carries none: a board once the company is public (post-IPO),
  // suppliers for every company. Seeded by company id (+ the stable IPO week for
  // the board) so the list is identical across renders and reloads - no
  // Math.random. Plain (non-hook) computation because it sits after the early
  // `if (!company)` return; the generators are pure and cheap. Stored data (if a
  // future tick ever writes real board/supplier records) always wins.
  const storedBoard = overlay?.boardSeats ?? [];
  const boardSeats = storedBoard.length > 0
    ? storedBoard
    : isPublic
      ? generateBoardSeats(companyId, overlay?.ipo?.listedWeek ?? weeksLived)
      : [];
  const storedSuppliers = overlay?.suppliers ?? [];
  const suppliers = storedSuppliers.length > 0
    ? storedSuppliers
    : generateSuppliers(companyId, company.type as HustleIndustry, company.weeklyIncome ?? 0);

  // Revenue composition (surfaces baseWeeklyIncome - previously hidden).
  // EFFECTIVE income, from the same helper the payout uses. See CompanyTile -
  // showing the raw stored field is what made brand / share / hires /
  // acquisitions look inert to players.
  const factors = companyIncomeFactors(overlay);
  // The tick's own per-company figure: the overlay multiplier `factors` covers
  // is only one step of the payout chain (family brand, legacy generations, the
  // political business perk and government contracts land there too).
  const weekly = companyWeeklyIncomeFor(gameState, company, 1);
  const payroll = (overlay?.hiringPipeline?.namedHires ?? []).reduce(
    (sum, h) => sum + (typeof h.salary === 'number' && isFinite(h.salary) && h.salary > 0 ? h.salary : 0),
    0,
  );
  const base = company.baseWeeklyIncome ?? 0;
  const lift = Math.max(0, weekly - base);
  const revTotal = Math.max(weekly, base, 1);
  const basePct = Math.max(0, Math.min(100, (Math.min(base, weekly) / revTotal) * 100));

  // Staff + upgrade derived state
  const money = gameState.stats?.money ?? 0;

  // Family-business (legacy) derived state. A company "qualifies" to convert when
  // it isn't already a family business (createFamilyBusiness's only precondition
  // besides the $1M cost); once converted, the manage panel takes over.
  const familyBusiness = (gameState.familyBusinesses ?? []).find((fb) => fb.companyId === companyId);
  const canConvertToFamilyBusiness = !familyBusiness && money >= FAMILY_BUSINESS_COST;

  const STAFF_CAP = 30; // matches addWorker's hard cap
  const canHireWorker = company.employees < STAFF_CAP && money >= company.workerSalary;
  const canRemoveWorker = company.employees > 0;
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0
    ? gameState.economy.priceIndex
    : 1;
  const upgradeDiscount = gameState.settings?.businessBanking ? 0.15 : 0;
  const upgradeDefs = COMPANY_UPGRADES[company.type] ?? [];

  // ───────── R&D derived state ─────────
  const rdAccent = HUSTLE_COLORS.accentSecondary;
  const rdLab = company.rdLab;
  const labInfo = rdLab ? LAB_TYPES[rdLab.type] : null;
  const hasTechTree = getTechnologiesForCompany(company.type).length > 0;
  const showRD = hasTechTree || !!rdLab; // hide for industries with no tech tree unless a lab already exists
  const unlockedTechIds = company.unlockedTechnologies ?? [];
  const availableTechs = rdLab ? getAvailableTechnologies(company.type, unlockedTechIds) : [];
  const activeProjects = (rdLab?.researchProjects ?? []).filter((p) => !p.completed);
  const canStartMore = labInfo ? activeProjects.length < labInfo.maxConcurrentProjects : false;
  const activePatents = (company.patents ?? []).filter((p) => p.duration > 0);
  const patentedTechIds = new Set(activePatents.map((p) => p.technologyId));
  const nextLabType: LabType | null = !rdLab
    ? null
    : rdLab.type === 'basic' ? 'advanced' : rdLab.type === 'advanced' ? 'cutting_edge' : null;
  const labUpgradeCost = rdLab && nextLabType ? getLabUpgradeCost(rdLab.type, nextLabType) : 0;
  const rdCompetitions = showRD
    ? getActiveCompetitions(weeksLived).filter(
        (comp) => !comp.requirements.companyType || comp.requirements.companyType === company.type,
      )
    : [];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        title={company.name}
        onBack={onBack}
        backLabel="Back to portfolio"
        centered
        right={<CashChip value={formatMoney(money)} tint={HUSTLE_COLORS.accent} />}
      />

      {/* Sticky scandal banner */}
      {scandal ? (
        <Pressable
          onPress={() => {
            hustleHaptics.tap();
            onOpenScandal();
          }}
          accessibilityRole="alert"
          accessibilityLabel={`Active scandal: ${scandal.headline}, severity ${scandal.severity}, tap to respond`}
          style={[styles.scandalBanner, { backgroundColor: withAlpha(HUSTLE_COLORS.danger, 0.15), borderColor: HUSTLE_COLORS.danger }]}
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
        {/* Hero - Recipe B (industry-tinted, translucent) */}
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
            <StatTile
              hero
              align="left"
              label={`${cap(company.type)}${isPublic ? ' · public' : ''} · per week`}
              value={`$${weekly.toLocaleString()}`}
              /* employees already INCLUDES named hires - do not sum them */
              sub={`${company.employees} employees${namedHires.length > 0 ? ` (incl. ${namedHires.length} key ${namedHires.length === 1 ? 'hire' : 'hires'})` : ''} · ×${factors.multiplier.toFixed(2)}`}
            />

            {/* Revenue composition - base vs lift from staff/upgrades */}
            <View style={styles.compBar} pointerEvents="none">
              <View style={[styles.compTrack, { backgroundColor: withAlpha(theme.textMuted, 0.2) }]}>
                <View style={[styles.compBase, { width: `${basePct}%`, backgroundColor: theme.textMuted }]} />
                <View style={[styles.compLift, { flex: 1, backgroundColor: accent }]} />
              </View>
            </View>
            <Text style={[styles.compCaption, { color: theme.textMuted }]}>
              Base ${base.toLocaleString()}{lift > 0 ? ` + $${lift.toLocaleString()} lift` : ''}
              {isPublic && overlay?.ipo ? ` · you own ${overlay.ipo.ownershipPercent.toFixed(0)}%` : ''}
            </Text>
          </View>
        </View>

        {/* The three numbers this screen is steered on. Brand's trend and the
            share price moved to the sections that act on them. */}
        <StatStrip
          items={[
            { label: 'Brand', value: brand, sub: overlay?.brand?.trend ?? 'flat' },
            { label: 'Market share', value: `${share}%`, tint: HUSTLE_COLORS.accentSecondary },
            /* Was "Cash", reading `company.money` - a field nothing ever writes,
               so it displayed $0 for every company forever. Payroll is real and
               it is the cost side of the hires that lift the multiplier. */
            { label: 'Payroll', value: payroll > 0 ? `-$${Math.round(payroll / 1000)}K` : '-' },
          ]}
        />

        {/* ───────── Staff department ─────────
            Ten sections used to stack in one scroll. Each is a fold now, keyed
            by a stable id so the shape a player arranges survives the trip.
            Staff and Marketing are the weekly decisions, so they open. */}
        <CollapsibleSection
          id="hustle-detail-staff"
          title="Staff"
          summary={`${company.employees} employees · ${namedHires.length} key`}
        >

        {/* Named-hire roster with Face avatars + morale/performance meters */}
        <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
          {namedHires.length > 0 ? (
            namedHires.map((h, i) => {
              const tenure = Math.max(0, weeksLived - (h.hiredWeek ?? weeksLived));
              return (
                <View key={h.candidateId} style={[styles.rosterRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  {/* Seeded from the candidate id, so a given hire keeps the
                      same face across renders and sessions. */}
                  <View style={[styles.avatar, { borderColor: theme.border }]}>
                    <CharacterAvatar seed={h.candidateId} age={30} size={scale(38)} />
                  </View>
                  <View style={styles.rosterText}>
                    <Text style={[styles.rosterName, { color: theme.text }]} numberOfLines={1}>
                      {cap(h.role)} · ${h.salary.toLocaleString()}/wk
                    </Text>
                    <View style={styles.rosterMeterRow}>
                      <Text style={[styles.rosterMeterLabel, { color: theme.textMuted }]}>Morale</Text>
                      <View style={styles.meterFlex}>
                        <ProgressBar value={h.morale / 100} color={meterColor(h.morale)} height={5} label="Morale" />
                      </View>
                      <Text style={[styles.rosterMeterVal, { color: theme.textSecondary }]}>{Math.round(h.morale)}</Text>
                    </View>
                    <View style={styles.rosterMeterRow}>
                      <Text style={[styles.rosterMeterLabel, { color: theme.textMuted }]}>Perf</Text>
                      <View style={styles.meterFlex}>
                        <ProgressBar value={h.performance / 100} color={meterColor(h.performance)} height={5} label="Performance" />
                      </View>
                      <Text style={[styles.rosterMeterVal, { color: theme.textSecondary }]}>{Math.round(h.performance)}</Text>
                    </View>
                  </View>
                  <Chip label={`${tenure}w`} accessibilityLabel={`${tenure} weeks tenure`} />
                </View>
              );
            })
          ) : (
            <Text style={[styles.deptEmpty, { color: theme.textMuted }]}>
              No key hires yet. Open the hiring pipeline to recruit named talent.
            </Text>
          )}
        </View>

        {/* Generic staff - canonical addWorker/removeWorker */}
        <View style={[getGlassCard(isDark, 6), styles.staffCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
          <Text style={[styles.staffCount, { color: theme.text }]}>
            {company.employees} / {STAFF_CAP} employees · payroll ${company.workerSalary.toLocaleString()}/hire
          </Text>
          <View style={styles.staffCapBar}>
            <ProgressBar value={company.employees / STAFF_CAP} color={HUSTLE_COLORS.accent} label="Headcount against the cap" />
          </View>
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

        <ActionRow
          icon={Users}
          color={HUSTLE_COLORS.accent}
          title="Hiring pipeline"
          subtitle={`${overlay?.hiringPipeline?.candidates?.length ?? 0} candidates · ${namedHires.length} hired`}
          theme={theme}
          onPress={() => { hustleHaptics.tap(); onOpenHire(); }}
        />

        </CollapsibleSection>

        {/* ───────── Marketing department ───────── */}
        <CollapsibleSection
          id="hustle-detail-marketing"
          title="Marketing"
          summary={activeCampaignsCount > 0 ? `${activeCampaignsCount} running` : 'No campaigns'}
        >
        {activeCampaignsCount > 0 ? (
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            {campaigns.map((camp, i) => {
              const elapsed = Math.max(0, weeksLived - (camp.startedWeek ?? weeksLived));
              const pct = camp.durationWeeks > 0 ? Math.max(0, Math.min(100, (elapsed / camp.durationWeeks) * 100)) : 0;
              const remaining = Math.max(0, (camp.durationWeeks ?? 0) - elapsed);
              // projectedROI is a revenue MULTIPLIER (e.g. 2.2 = 2.2× spend).
              // Percentage ROI = (multiplier − 1) × 100 (2.2× → +120%). Previously
              // this rendered the raw multiplier as a percent ("+2% ROI").
              const roiMult = camp.projectedROI ?? 0;
              const roiPct = roiMult > 0 ? Math.round((roiMult - 1) * 100) : 0;
              const roiColor = roiMult > 1 ? HUSTLE_COLORS.success : roiMult > 0 ? theme.textMuted : HUSTLE_COLORS.danger;
              return (
                <View key={camp.id} style={[styles.campaignRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.campaignIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.accentSecondary, 0.15), borderColor: withAlpha(HUSTLE_COLORS.accentSecondary, 0.3) }]}>
                    <Megaphone size={fontScale(15)} color={HUSTLE_COLORS.accentSecondary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.campaignText}>
                    <View style={styles.campaignTitleRow}>
                      <Text style={[styles.campaignTitle, { color: theme.text }]} numberOfLines={1}>
                        {CAMPAIGN_LABEL[camp.kind] ?? cap(camp.kind)}
                      </Text>
                      <Text style={[styles.campaignRoi, { color: roiColor }]}>{roiMult > 0 ? `${roiPct >= 0 ? '+' : ''}${roiPct}% ROI` : 'Below floor'}</Text>
                    </View>
                    <Text style={[styles.campaignMeta, { color: theme.textSecondary }]}>
                      ${camp.spendPerWeek.toLocaleString()}/wk · {remaining}w left{camp.active ? '' : ' · paused'}
                    </Text>
                    <View style={styles.campaignBar}>
                      <ProgressBar value={pct / 100} color={HUSTLE_COLORS.accentSecondary} height={5} label="Campaign run" />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
        <ActionRow
          icon={Megaphone}
          color={HUSTLE_COLORS.accentSecondary}
          title="Marketing campaigns"
          subtitle={activeCampaignsCount > 0 ? `${activeCampaignsCount} running · marketing Lv ${company.marketingLevel ?? 0}` : `No active campaigns · marketing Lv ${company.marketingLevel ?? 0}`}
          theme={theme}
          onPress={() => { hustleHaptics.tap(); onOpenCampaign(); }}
        />

        </CollapsibleSection>

        {/* ───────── Growth & markets department ───────── */}
        <CollapsibleSection
          id="hustle-detail-growth"
          title="Growth &amp; markets"
          defaultCollapsed
          summary={isPublic ? `Public · ${pendingAcqCount} offers` : `Private · ${pendingAcqCount} offers`}
        >
          {/* WHY the income multiplier is what it is. It used to be a caption
              under the hero number, where a four-clause formula competed with
              the headline; it belongs beside the levers that move it. */}
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Income multiplier ×{factors.multiplier.toFixed(2)}</Text>
            {[
              { label: 'Brand', value: `${factors.brand >= 0 ? '+' : ''}${Math.round(factors.brand * 100)}%` },
              { label: 'Market share', value: `+${Math.round(factors.share * 100)}%` },
              { label: 'Key hires', value: `${factors.hires >= 0 ? '+' : ''}${Math.round(factors.hires * 100)}%` },
              ...(factors.clamped ? [{ label: 'Capped', value: 'at the ceiling' }] : []),
            ].map((row, i, all) => (
              <KeyValueRow key={row.label} label={row.label} value={row.value} divider={i < all.length - 1} />
            ))}
          </View>

        {/* IPO summary (surfaces ownership / shares / earnings beats) */}
        {isPublic && overlay?.ipo ? (
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={styles.ipoStatRow}>
              <View style={styles.ipoStat}>
                <Text style={[styles.ipoStatLabel, { color: theme.textMuted }]}>Share price</Text>
                <Text style={[styles.ipoStatValue, { color: theme.text }]}>${overlay.ipo.sharePrice.toFixed(2)}</Text>
              </View>
              <View style={styles.ipoStat}>
                <Text style={[styles.ipoStatLabel, { color: theme.textMuted }]}>Your stake</Text>
                <Text style={[styles.ipoStatValue, { color: theme.text }]}>{overlay.ipo.ownershipPercent.toFixed(0)}%</Text>
              </View>
              <View style={styles.ipoStat}>
                <Text style={[styles.ipoStatLabel, { color: theme.textMuted }]}>Shares</Text>
                <Text style={[styles.ipoStatValue, { color: theme.text }]}>{overlay.ipo.sharesOutstandingK.toLocaleString()}K</Text>
              </View>
            </View>
            {overlay.ipo.recentEarnings.length > 0 ? (
              <View style={styles.earningsRow}>
                {overlay.ipo.recentEarnings.slice(-4).map((e, i) => (
                  <Chip
                    key={`${e.week}-${i}`}
                    label={`${e.beat ? 'Beat' : 'Miss'} $${Math.round(e.revenue / 1000)}K`}
                    tone={e.beat ? 'success' : 'danger'}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {!isPublic ? (
          <ActionRow
            icon={Rocket}
            color={HUSTLE_COLORS.success}
            title="Take public (IPO)"
            subtitle={weekly >= 10_000 ? 'Eligible - raise capital, dilute ownership' : 'Need $10K/week revenue'}
            theme={theme}
            onPress={() => { hustleHaptics.tap(); onOpenIPO(); }}
            disabled={weekly < 10_000 || !!scandal}
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

        {/* Board seats roster (surfaces boardSeats - unused by old UI) */}
        {boardSeats.length > 0 ? (
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Board of directors</Text>
            {boardSeats.map((b, i) => (
              <View key={b.id} style={[styles.boardRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.boardIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.accent, 0.13), borderColor: withAlpha(HUSTLE_COLORS.accent, 0.27) }]}>
                  <Star size={fontScale(13)} color={HUSTLE_COLORS.accent} strokeWidth={2.2} />
                </View>
                <View style={styles.boardText}>
                  <Text style={[styles.boardName, { color: theme.text }]} numberOfLines={1}>{b.name}</Text>
                  <Text style={[styles.boardMeta, { color: theme.textMuted }]} numberOfLines={1}>
                    {BOARD_ROLE[b.role] ?? cap(b.role)} · {b.votingShare.toFixed(0)}% vote
                  </Text>
                </View>
                <View style={styles.boardSat}>
                  <View style={styles.boardSatBar}>
                    <ProgressBar value={b.satisfaction / 100} color={meterColor(b.satisfaction)} height={5} label="Satisfaction" />
                  </View>
                  <Text style={[styles.boardSatVal, { color: theme.textMuted }]}>{Math.round(b.satisfaction)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Pending acquisition offers (surfaces offer detail inline) */}
        {pendingAcqCount > 0 ? (
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Open acquisition offers</Text>
            {pendingAcqs.map((a, i) => {
              const expiresIn = Math.max(0, (a.expiresWeek ?? weeksLived) - weeksLived);
              return (
                <View key={a.id} style={[styles.acqRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={styles.acqText}>
                    <Text style={[styles.acqName, { color: theme.text }]} numberOfLines={1}>{a.targetName}</Text>
                    <Text style={[styles.acqMeta, { color: theme.textMuted }]} numberOfLines={1}>
                      {cap(a.targetIndustry)} · +{a.synergyBonusPercent.toFixed(0)}% synergy · {expiresIn}w to decide
                    </Text>
                  </View>
                  <Text style={[styles.acqPrice, { color: theme.text }]}>${a.askingPrice.toLocaleString()}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
        <ActionRow
          icon={Building2}
          color={HUSTLE_COLORS.factory}
          title="Acquisitions"
          subtitle={pendingAcqCount > 0 ? `${pendingAcqCount} open offers` : 'No pending offers'}
          theme={theme}
          onPress={() => { hustleHaptics.tap(); onOpenAcquisitions(); }}
          badge={pendingAcqCount}
        />

        <ActionRow
          icon={AlertTriangle}
          color={HUSTLE_COLORS.danger}
          title="Sell company"
          subtitle={`Divest for ${formatMoney(quoteCompanySaleValue(gameState, companyId) ?? 0)} - 50% of invested`}
          theme={theme}
          onPress={handleSellCompany}
        />

        </CollapsibleSection>

        {/* ───────── Family legacy department ───────── */}
        <CollapsibleSection
          id="hustle-detail-family"
          title="Family legacy"
          defaultCollapsed
          summary={familyBusiness ? `Gen ${familyBusiness.foundedGeneration}` : 'Not converted'}
        >
        {familyBusiness ? (
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={styles.rdRow}>
              <View style={[styles.rdIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.warning, 0.13), borderColor: withAlpha(HUSTLE_COLORS.warning, 0.27) }]}>
                <Crown size={fontScale(15)} color={HUSTLE_COLORS.warning} strokeWidth={2.2} />
              </View>
              <View style={styles.rdText}>
                <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>Family business</Text>
                <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                  Founded gen {familyBusiness.foundedGeneration} · held {familyBusiness.generationsHeld} generation{familyBusiness.generationsHeld === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            {/* Brand + reputation meters (the two stats manageFamilyBusiness builds) */}
            <View style={[styles.rosterMeterRow, { marginTop: responsiveSpacing.xs }]}>
              <Text style={[styles.rosterMeterLabel, { color: theme.textMuted }]}>Brand</Text>
              <View style={styles.meterFlex}>
                <ProgressBar value={familyBusiness.brandValue / 100} color={meterColor(familyBusiness.brandValue)} height={5} label="Brand value" />
              </View>
              <Text style={[styles.rosterMeterVal, { color: theme.textSecondary }]}>{Math.round(familyBusiness.brandValue)}</Text>
            </View>
            <View style={styles.rosterMeterRow}>
              <Text style={[styles.rosterMeterLabel, { color: theme.textMuted }]}>Rep</Text>
              <View style={styles.meterFlex}>
                <ProgressBar value={familyBusiness.reputation / 100} color={meterColor(familyBusiness.reputation)} height={5} label="Reputation" />
              </View>
              <Text style={[styles.rosterMeterVal, { color: theme.textSecondary }]}>{Math.round(familyBusiness.reputation)}</Text>
            </View>

            <Text style={[styles.staffHint, { color: theme.textSecondary }]}>
              Invest in the family name to build brand value and reputation. Both compound across generations as the business passes to your heirs.
            </Text>

            {FAMILY_MANAGE_OPTIONS.map((opt, i) => {
              const affordable = money >= opt.cost;
              return (
                <View key={opt.action} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={styles.rdText}>
                    <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{opt.label}</Text>
                    <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>{opt.effect}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleManageFamilyBusiness(opt.action)}
                    disabled={!affordable}
                    accessibilityRole="button"
                    accessibilityLabel={`${opt.label} for $${opt.cost.toLocaleString()}`}
                    accessibilityState={{ disabled: !affordable }}
                    style={[styles.upgradeBuyBtn, { backgroundColor: withAlpha(HUSTLE_COLORS.warning, 0.14), opacity: affordable ? 1 : 0.5 }]}
                  >
                    <Text style={[styles.upgradeBuyText, { color: HUSTLE_COLORS.warning }]}>${opt.cost.toLocaleString()}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={styles.rdRow}>
              <View style={[styles.rdIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.warning, 0.13), borderColor: withAlpha(HUSTLE_COLORS.warning, 0.27) }]}>
                <Gem size={fontScale(15)} color={HUSTLE_COLORS.warning} strokeWidth={2.2} />
              </View>
              <View style={styles.rdText}>
                <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>Convert to family business</Text>
                <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={2}>
                  A ${FAMILY_BUSINESS_COST.toLocaleString()} legacy that passes to your heirs, compounding brand value and reputation across generations.
                </Text>
              </View>
            </View>
            <View style={styles.staffBtnRow}>
              <Pressable
                onPress={handleConvertToFamilyBusiness}
                disabled={!canConvertToFamilyBusiness}
                accessibilityRole="button"
                accessibilityLabel={`Convert ${company.name} to a family business for $${FAMILY_BUSINESS_COST.toLocaleString()}`}
                accessibilityState={{ disabled: !canConvertToFamilyBusiness }}
                style={[styles.staffBtn, canConvertToFamilyBusiness && getPlatformShadows(5, 0.3, 2, 8), { backgroundColor: HUSTLE_COLORS.warning, opacity: canConvertToFamilyBusiness ? 1 : 0.5 }]}
              >
                <Crown size={fontScale(16)} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.staffBtnText}>
                  {money < FAMILY_BUSINESS_COST ? `Need $${FAMILY_BUSINESS_COST.toLocaleString()}` : `Convert · $${FAMILY_BUSINESS_COST.toLocaleString()}`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        </CollapsibleSection>

        {/* ───────── Upgrades department - tracks as ProgressRings ───────── */}
        {upgradeDefs.length > 0 ? (
          <CollapsibleSection
            id="hustle-detail-upgrades"
            title="Upgrade tracks"
            defaultCollapsed
            summary={`${(company.upgrades ?? []).reduce((n, u) => n + (u.level ?? 0), 0)} levels bought`}
          >
            {upgradeDefs.map((def) => {
              const owned = (company.upgrades ?? []).find((u) => u.id === def.id);
              const level = owned?.level ?? 0;
              const maxed = level >= def.maxLevel;
              const ringPct = def.maxLevel > 0 ? (level / def.maxLevel) * 100 : 0;
              const nextLevelCost = level === 0
                ? def.cost
                : Math.round(def.cost * Math.pow(COMPANY_UPGRADE_COST_MULTIPLIER, level));
              const cost = Math.round(getInflatedPrice(nextLevelCost, priceIndex) * (1 - upgradeDiscount));
              const affordable = money >= cost;
              return (
                <View key={def.id} style={[getGlassCard(isDark, 6), styles.upgradeRow, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                  <ProgressRing
                    value={ringPct}
                    size={54}
                    strokeWidth={6}
                    ambient={false}
                    showPill={false}
                    state={maxed ? 'done' : 'active'}
                    accentColor={HUSTLE_COLORS.warning}
                    positiveColor={HUSTLE_COLORS.success}
                    trackColor={isDark ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.20)'}
                    label={`${def.name} level ${level} of ${def.maxLevel}`}
                    style={styles.upgradeRing}
                  >
                    <View style={styles.upgradeRingCenter}>
                      <Zap size={fontScale(13)} color={maxed ? HUSTLE_COLORS.success : HUSTLE_COLORS.warning} strokeWidth={2.4} />
                      <Text style={[styles.upgradeRingLvl, { color: theme.text }]}>{level}/{def.maxLevel}</Text>
                    </View>
                  </ProgressRing>
                  <View style={styles.actionText}>
                    <Text style={[styles.actionTitle, { color: theme.text }]} numberOfLines={1}>
                      {def.name}
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
                        backgroundColor: maxed ? theme.surfaceElevated : withAlpha(HUSTLE_COLORS.accent, 0.14),
                        opacity: maxed || !affordable ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.upgradeBuyText, { color: maxed ? theme.textMuted : HUSTLE_COLORS.accent }]}>{maxed ? 'MAX' : `$${cost.toLocaleString()}`}</Text>
                  </Pressable>
                </View>
              );
            })}
          </CollapsibleSection>
        ) : null}

        {/* ───────── R&D Lab department ───────── */}
        {showRD ? (
          <CollapsibleSection
            id="hustle-detail-rd"
            title="R&amp;D Lab"
            defaultCollapsed
            summary={rdLab ? `${labInfo?.name ?? 'Lab'} · ${activeProjects.length} active` : 'No lab'}
          >

            {!rdLab ? (
              /* No lab yet - build options */
              <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Build a lab</Text>
                <Text style={[styles.staffHint, { color: theme.textSecondary, marginBottom: responsiveSpacing.xs }]}>
                  Research technologies that permanently lift company income, file patents for weekly royalties, and enter innovation competitions. Research advances automatically each week.
                </Text>
                {(Object.keys(LAB_TYPES) as LabType[]).map((lt, i) => {
                  const info = LAB_TYPES[lt];
                  const cost = getLabUpgradeCost(null, lt);
                  const affordable = money >= cost;
                  return (
                    <View key={lt} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <View style={[styles.rdIcon, { backgroundColor: withAlpha(rdAccent, 0.13), borderColor: withAlpha(rdAccent, 0.27) }]}>
                        <FlaskConical size={fontScale(15)} color={rdAccent} strokeWidth={2.2} />
                      </View>
                      <View style={styles.rdText}>
                        <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{info.name}</Text>
                        <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                          {info.maxConcurrentProjects} project{info.maxConcurrentProjects === 1 ? '' : 's'} · {info.researchSpeedMultiplier}× speed
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleBuildLab(lt)}
                        disabled={!affordable}
                        accessibilityRole="button"
                        accessibilityLabel={`Build ${info.name} for $${cost.toLocaleString()}`}
                        accessibilityState={{ disabled: !affordable }}
                        style={[styles.upgradeBuyBtn, { backgroundColor: withAlpha(rdAccent, 0.14), opacity: affordable ? 1 : 0.5 }]}
                      >
                        <Text style={[styles.upgradeBuyText, { color: rdAccent }]}>${cost.toLocaleString()}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <>
                {/* Lab summary + upgrade */}
                <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                  <View style={styles.rdRow}>
                    <View style={[styles.rdIcon, { backgroundColor: withAlpha(rdAccent, 0.13), borderColor: withAlpha(rdAccent, 0.27) }]}>
                      <FlaskConical size={fontScale(15)} color={rdAccent} strokeWidth={2.2} />
                    </View>
                    <View style={styles.rdText}>
                      <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{labInfo!.name}</Text>
                      <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                        {activeProjects.length}/{labInfo!.maxConcurrentProjects} active · {labInfo!.researchSpeedMultiplier}× speed
                      </Text>
                    </View>
                    {nextLabType ? (
                      <Pressable
                        onPress={() => handleBuildLab(nextLabType)}
                        disabled={money < labUpgradeCost}
                        accessibilityRole="button"
                        accessibilityLabel={`Upgrade lab for $${labUpgradeCost.toLocaleString()}`}
                        accessibilityState={{ disabled: money < labUpgradeCost }}
                        style={[styles.upgradeBuyBtn, { backgroundColor: withAlpha(rdAccent, 0.14), opacity: money < labUpgradeCost ? 0.5 : 1 }]}
                      >
                        <Text style={[styles.upgradeBuyText, { color: rdAccent }]}>Upgrade ${labUpgradeCost.toLocaleString()}</Text>
                      </Pressable>
                    ) : (
                      <Chip label="Max" />
                    )}
                  </View>
                </View>

                {/* In-progress research */}
                {activeProjects.length > 0 ? (
                  <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                    <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>In progress</Text>
                    {activeProjects.map((p, i) => {
                      const tech = getTechnologyById(p.technologyId);
                      const pct = Math.max(0, Math.min(100, p.progress));
                      const perWeek = 100 / Math.max(1, p.duration || 1);
                      const weeksLeft = Math.max(1, Math.ceil((100 - pct) / perWeek));
                      return (
                        <View key={p.id} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                          <View style={styles.rdText}>
                            <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{tech?.name ?? p.technologyId}</Text>
                            <View style={styles.researchBar}>
                              <ProgressBar value={pct / 100} color={rdAccent} height={5} label="Research progress" />
                            </View>
                            <Text style={[styles.rdRowMeta, { color: theme.textMuted, marginTop: 3 }]}>
                              {pct >= 100 ? 'Finalizing…' : `~${weeksLeft} week${weeksLeft === 1 ? '' : 's'} left`}
                            </Text>
                          </View>
                          <Text style={[styles.rdPct, { color: theme.textSecondary }]}>{Math.round(pct)}%</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Available research */}
                <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                  <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Available research</Text>
                  {availableTechs.length > 0 ? (
                    availableTechs.map((tech, i) => {
                      const affordable = money >= tech.researchCost;
                      const disabled = !canStartMore || !affordable;
                      const incomePct = Math.round(((tech.unlocks.incomeMultiplier ?? 1) - 1) * 100);
                      return (
                        <View key={tech.id} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                          <View style={styles.rdText}>
                            <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{tech.name} · T{tech.tier}</Text>
                            <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                              {tech.researchTime}w base{incomePct > 0 ? ` · +${incomePct}% income` : ''}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => handleStartResearch(tech.id)}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityLabel={`Research ${tech.name} for $${tech.researchCost.toLocaleString()}`}
                            accessibilityState={{ disabled }}
                            style={[styles.upgradeBuyBtn, { backgroundColor: withAlpha(rdAccent, 0.14), opacity: disabled ? 0.5 : 1 }]}
                          >
                            <Text style={[styles.upgradeBuyText, { color: rdAccent }]}>${tech.researchCost.toLocaleString()}</Text>
                          </Pressable>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={[styles.deptEmpty, { color: theme.textMuted }]}>
                      {hasTechTree ? 'All available technologies researched.' : 'No technologies for this industry.'}
                    </Text>
                  )}
                  {!canStartMore && availableTechs.length > 0 ? (
                    <Text style={[styles.staffHint, { color: theme.textMuted }]}>
                      Lab at capacity ({labInfo!.maxConcurrentProjects}). Finish or upgrade to research more.
                    </Text>
                  ) : null}
                </View>

                {/* Unlocked technologies → file patents */}
                {unlockedTechIds.length > 0 ? (
                  <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                    <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Unlocked technologies</Text>
                    {unlockedTechIds.map((techId, i) => {
                      const tech = getTechnologyById(techId);
                      const patented = patentedTechIds.has(techId);
                      const patentCost = (tech && PATENT_COSTS[tech.tier]) || 100000;
                      const affordable = money >= patentCost;
                      return (
                        <View key={techId} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                          <View style={styles.rdText}>
                            <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{tech?.name ?? techId}</Text>
                            <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>{patented ? 'Patented' : 'Eligible for patent'}</Text>
                          </View>
                          {patented ? (
                            <Chip
                              label="Patented"
                              tone="success"
                              icon={<FileText size={fontScale(11)} color={HUSTLE_COLORS.success} />}
                            />
                          ) : (
                            <Pressable
                              onPress={() => handleFilePatent(techId)}
                              disabled={!affordable}
                              accessibilityRole="button"
                              accessibilityLabel={`File patent for ${tech?.name ?? techId} for $${patentCost.toLocaleString()}`}
                              accessibilityState={{ disabled: !affordable }}
                              style={[styles.upgradeBuyBtn, { backgroundColor: withAlpha(rdAccent, 0.14), opacity: affordable ? 1 : 0.5 }]}
                            >
                              <Text style={[styles.upgradeBuyText, { color: rdAccent }]}>Patent ${patentCost.toLocaleString()}</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Patent royalties */}
                {activePatents.length > 0 ? (
                  <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                    <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Patent royalties</Text>
                    {activePatents.map((pt, i) => (
                      <View key={pt.id} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        <View style={[styles.rdIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.success, 0.13), borderColor: withAlpha(HUSTLE_COLORS.success, 0.27) }]}>
                          <FileText size={fontScale(13)} color={HUSTLE_COLORS.success} strokeWidth={2.2} />
                        </View>
                        <View style={styles.rdText}>
                          <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{pt.name}</Text>
                          <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>{pt.duration}w remaining</Text>
                        </View>
                        <Text style={[styles.rdIncome, { color: HUSTLE_COLORS.success }]}>+${pt.weeklyIncome.toLocaleString()}/wk</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Innovation competitions */}
                <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                  <Text style={[styles.deptSubhead, { color: theme.textSecondary }]}>Innovation competitions</Text>
                  {rdCompetitions.length > 0 ? (
                    rdCompetitions.map((comp, i) => {
                      const entered = (company.competitionHistory ?? []).some((e) => e.competitionId === comp.id && !e.completed);
                      const eligible = canEnterCompetition(comp, company);
                      const affordable = money >= comp.entryCost;
                      const disabled = entered || !eligible || !affordable;
                      return (
                        <View key={comp.id} style={[styles.rdRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                          <View style={[styles.rdIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.warning, 0.13), borderColor: withAlpha(HUSTLE_COLORS.warning, 0.27) }]}>
                            <Award size={fontScale(14)} color={HUSTLE_COLORS.warning} strokeWidth={2.2} />
                          </View>
                          <View style={styles.rdText}>
                            <Text style={[styles.rdRowTitle, { color: theme.text }]} numberOfLines={1}>{comp.name}</Text>
                            <Text style={[styles.rdRowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                              1st ${comp.prizes.first.toLocaleString()} · entry ${comp.entryCost.toLocaleString()}
                            </Text>
                          </View>
                          {entered ? (
                            <Chip label="Entered" tint={rdAccent} />
                          ) : (
                            <Pressable
                              onPress={() => handleEnterCompetition(comp.id)}
                              disabled={disabled}
                              accessibilityRole="button"
                              accessibilityLabel={`Enter ${comp.name} for $${comp.entryCost.toLocaleString()}`}
                              accessibilityState={{ disabled }}
                              style={[styles.upgradeBuyBtn, { backgroundColor: withAlpha(rdAccent, 0.14), opacity: disabled ? 0.5 : 1 }]}
                            >
                              <Text style={[styles.upgradeBuyText, { color: rdAccent }]}>{eligible ? 'Enter' : 'Locked'}</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={[styles.deptEmpty, { color: theme.textMuted }]}>No active competitions right now.</Text>
                  )}
                </View>
              </>
            )}
          </CollapsibleSection>
        ) : null}

        {/* ───────── Suppliers (surfaces suppliers - unused by old UI) ───────── */}
        {suppliers.length > 0 ? (
          <CollapsibleSection
            id="hustle-detail-suppliers"
            title="Suppliers"
            defaultCollapsed
            summary={`${suppliers.length} contracted`}
          >
            <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              {suppliers.map((s, i) => {
                const contract = s.contractEndWeek ? `${Math.max(0, s.contractEndWeek - weeksLived)}w contract` : 'Month-to-month';
                return (
                  <View key={s.id} style={[styles.boardRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={[styles.boardIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.factory, 0.13), borderColor: withAlpha(HUSTLE_COLORS.factory, 0.27) }]}>
                      <Package size={fontScale(13)} color={HUSTLE_COLORS.factory} strokeWidth={2.2} />
                    </View>
                    <View style={styles.boardText}>
                      <Text style={[styles.boardName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[styles.boardMeta, { color: theme.textMuted }]} numberOfLines={1}>
                        ${s.costPerWeek.toLocaleString()}/wk · {contract}
                      </Text>
                    </View>
                    <View style={styles.boardSat}>
                      <View style={styles.boardSatBar}>
                        <ProgressBar value={s.reliability / 100} color={meterColor(s.reliability)} height={5} label="Reliability" />
                      </View>
                      <Text style={[styles.boardSatVal, { color: theme.textMuted }]}>{Math.round(s.reliability)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </CollapsibleSection>
        ) : null}

        {/* ───────── Scandal ledger (surfaces scandalHistory - unused) ───────── */}
        {scandalHistory.length > 0 ? (
          <CollapsibleSection
            id="hustle-detail-scandals"
            title="Scandal ledger"
            defaultCollapsed
            summary={`${scandalHistory.length} resolved`}
          >
            <View style={[getGlassCard(isDark, 6), styles.deptCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              {scandalHistory.slice(0, 6).map((s, i) => (
                <View key={s.id} style={[styles.ledgerRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.ledgerIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.warning, 0.13), borderColor: withAlpha(HUSTLE_COLORS.warning, 0.27) }]}>
                    <History size={fontScale(13)} color={HUSTLE_COLORS.warning} strokeWidth={2.2} />
                  </View>
                  <View style={styles.ledgerText}>
                    <Text style={[styles.ledgerTitle, { color: theme.text }]} numberOfLines={1}>
                      {scandalKindLabel(s.kind)} · {cap(s.resolutionMethod)}
                    </Text>
                    <Text style={[styles.ledgerMeta, { color: theme.textMuted }]} numberOfLines={1}>
                      severity {s.severity} · -${Math.round(s.totalRevenueLoss).toLocaleString()} lost
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </CollapsibleSection>
        ) : null}

        {/* Notifications list. `markHustleNotificationRead` /
            `clearHustleNotifications` both shipped with ZERO call sites, so
            every alert stayed unread forever and the list only ever grew -
            the unread dot was decoration. Tapping a row marks it read; the
            header carries a Clear-all. */}
        {overlay && overlay.notifications.length > 0 ? (
          <CollapsibleSection
            id="hustle-detail-alerts"
            title="Recent alerts"
            defaultCollapsed
            summary={`${overlay.notifications.filter((n) => !n.read).length} unread`}
          >
            <View style={styles.notifHeaderRow}>
              <Pressable
                onPress={handleClearNotifications}
                accessibilityRole="button"
                accessibilityLabel="Clear all alerts"
                hitSlop={8}
                style={({ pressed }) => [styles.notifClearBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.notifClearText, { color: HUSTLE_COLORS.accent }]}>Clear all</Text>
              </Pressable>
            </View>
            <View style={[getGlassCard(isDark, 6), styles.notifCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              {overlay.notifications.slice(0, 5).map((n, i) => (
                <Pressable
                  key={n.id}
                  onPress={n.read ? undefined : () => handleMarkNotificationRead(n.id)}
                  disabled={n.read}
                  accessibilityRole={n.read ? 'text' : 'button'}
                  accessibilityLabel={n.text}
                  accessibilityHint={n.read ? undefined : 'Marks this alert as read'}
                  style={({ pressed }) => [
                    styles.notifRow,
                    i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                    { opacity: pressed && !n.read ? 0.7 : 1 },
                  ]}
                >
                  {!n.read ? <View style={[styles.unreadDot, { backgroundColor: HUSTLE_COLORS.accent }]} /> : <View style={styles.unreadSpacer} />}
                  <Text style={[styles.notifText, { color: n.read ? theme.textSecondary : theme.text }]} numberOfLines={2}>
                    {n.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </CollapsibleSection>
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
      <View style={[styles.actionIconSquare, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.3) }]}>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  meterFlex: { flex: 1 },
  researchBar: { marginTop: 5 },
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
    // Full border, not a `borderLeftWidth: 3` accent stripe. Hard Rule #7 bans
    // a one-sided coloured border used decoratively - the product owner
    // rejected the look, and RN curls it into a crescent artifact against
    // `borderRadius`. The danger colour is kept, on all four sides, so the
    // meaning survives. 2026-07-30 audit UX-3.
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.md,
  },
  scandalText: { flex: 1 },
  scandalTitle: {
    fontSize: fontScale(11),
    fontWeight: '600',
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
  compBar: {
    marginTop: responsiveSpacing.sm,
  },
  compTrack: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compBase: {
    height: '100%',
  },
  compLift: {
    height: '100%',
  },
  compCaption: {
    fontSize: fontScale(10),
    fontWeight: '600',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  deptCard: {
    borderRadius: responsiveBorderRadius.xl,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.sm,
  },
  deptSubhead: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: responsiveSpacing.sm,
    marginBottom: 2,
  },
  deptEmpty: {
    fontSize: fontScale(12),
    lineHeight: fontScale(17),
    paddingVertical: responsiveSpacing.md,
  },
  // Roster
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: 1,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
  rosterText: { flex: 1, gap: 3 },
  rosterName: {
    fontSize: fontScale(13),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rosterMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rosterMeterLabel: {
    fontSize: fontScale(9),
    fontWeight: '600',
    width: scale(38),
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rosterMeterVal: {
    fontSize: fontScale(10),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    width: scale(20),
    textAlign: 'right',
  },
  // Generic staff
  staffCard: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  staffCount: {
    fontSize: fontScale(14),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  staffCapBar: {
    height: 6,
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  // Campaigns
  campaignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  campaignIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignText: { flex: 1, gap: 3 },
  campaignTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  campaignTitle: {
    flex: 1,
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  campaignRoi: {
    fontSize: fontScale(11),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  campaignMeta: {
    fontSize: fontScale(11),
    fontVariant: ['tabular-nums'],
  },
  campaignBar: {
    height: 5,
    marginTop: 1,
  },
  // IPO
  ipoStatRow: {
    flexDirection: 'row',
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  ipoStat: { flex: 1 },
  ipoStatLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  ipoStatValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  earningsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: responsiveSpacing.sm,
  },
  // Board / suppliers
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  boardIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardText: { flex: 1 },
  boardName: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  boardMeta: {
    fontSize: fontScale(11),
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  boardSat: {
    width: scale(56),
    alignItems: 'flex-end',
    gap: 3,
  },
  boardSatBar: {
    width: scale(56),
    height: 5,
  },
  boardSatVal: {
    fontSize: fontScale(10),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Acquisitions inline
  acqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  acqText: { flex: 1 },
  acqName: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  acqMeta: {
    fontSize: fontScale(11),
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  acqPrice: {
    fontSize: fontScale(14),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Ledger
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  ledgerIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerText: { flex: 1 },
  ledgerTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  ledgerMeta: {
    fontSize: fontScale(11),
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  // Action rows
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
    fontWeight: '600',
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
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Upgrades
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.sm,
  },
  upgradeRing: {
    marginRight: 2,
  },
  upgradeRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  upgradeRingLvl: {
    fontSize: fontScale(10),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  upgradeBuyBtn: {
    borderRadius: responsiveBorderRadius.full,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: 8,
    minWidth: scale(72),
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBuyText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // R&D
  rdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  rdIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rdText: { flex: 1 },
  rdRowTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  rdRowMeta: {
    fontSize: fontScale(11),
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  rdPct: {
    fontSize: fontScale(12),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: scale(34),
    textAlign: 'right',
  },
  rdIncome: {
    fontSize: fontScale(13),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifClearBtn: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.xs,
  },
  notifClearText: {
    fontSize: fontScale(12),
    fontWeight: '600',
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
