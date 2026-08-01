import React, { useMemo, useState, lazy, Suspense } from 'react';
import { View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import DailyGemClaim from '@/components/DailyGemClaim';
import { ChevronRight, DollarSign, Star, Heart, TrendingUp, Crown, Brain, History, X, Flame, Home, Building2, Smartphone, FlaskConical, Sparkles, Landmark, Gamepad2, CreditCard, Zap, Car, Utensils, Activity, AlertTriangle } from 'lucide-react-native';
import { MINDSET_TRAITS } from '@/lib/mindset/config';
import { getCosmetic } from '@/lib/cosmetics/cosmetics';
// Rarely-opened modals — lazy-loaded and only mounted when open, so their
// code + element tree isn't built on every home-tab render.
const YouthPillModal = lazy(() => import('./YouthPillModal'));
const LegacyTimeline = lazy(() => import('./LegacyTimeline'));
const NetWorthBreakdownModal = lazy(() => import('./NetWorthBreakdownModal'));
import {
  responsiveSpacing,
  scale,
  fontScale,
} from '@/utils/scaling';
import { styles } from '@/components/IdentityCardStyles';
import DeepLifePlusUpsell from '@/components/DeepLifePlusUpsell';
import { PLAYER_RENT_RATE_WEEKLY } from '@/lib/economy/constants';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { netWorth as canonicalNetWorth } from '@/lib/progress/achievements';
import { perks as allPerks } from '@/src/features/onboarding/perksData';
import { useTranslation } from '@/hooks/useTranslation';
import { getAvatarPortrait } from '@/utils/facePool';
import AutoSaveIndicator from './AutoSaveIndicator';
import { formatMoney } from '@/utils/moneyFormatting';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { getReputationStanding } from '@/lib/reputation/reputationTier';
import type { Loan } from '@/contexts/game/types';
const LinearGradient = LinearGradientFallback;

// Type guard helpers for Loan properties
function hasLoanName(loan: Loan | unknown): loan is Loan & { name: string } {
  return typeof loan === 'object' && loan !== null && 'name' in loan && typeof (loan as { name?: unknown }).name === 'string';
}

function hasLoanRemaining(loan: Loan | unknown): loan is Loan & { remaining: number } {
  return typeof loan === 'object' && loan !== null && 'remaining' in loan && typeof (loan as { remaining?: unknown }).remaining === 'number' && isFinite((loan as { remaining: number }).remaining) && (loan as { remaining: number }).remaining >= 0;
}

function hasLoanPrincipal(loan: Loan | unknown): loan is Loan & { principal: number } {
  return typeof loan === 'object' && loan !== null && 'principal' in loan && typeof (loan as { principal?: unknown }).principal === 'number' && isFinite((loan as { principal: number }).principal) && (loan as { principal: number }).principal >= 0;
}

function hasLoanInterestRate(loan: Loan | unknown): loan is Loan & { interestRate: number } {
  return typeof loan === 'object' && loan !== null && 'interestRate' in loan && typeof (loan as { interestRate?: unknown }).interestRate === 'number' && isFinite((loan as { interestRate: number }).interestRate);
}

// Using the utility function from utils/characterImages.ts

interface InfoModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  darkMode: boolean;
  children: React.ReactNode;
  t: (key: string) => string;
}

function InfoModal({ visible, title, onClose, darkMode, children, t }: InfoModalProps) {
  if (!visible) return null;
  
  // Get appropriate icon based on title
  const getIcon = () => {
    if (title.includes('Cash Flow') || title.includes('cash')) return DollarSign;
    if (title.includes('Perk')) return Star;
    if (title.includes('Trait')) return Heart;
    if (title.includes('Modifier')) return TrendingUp;
    return DollarSign;
  };
  
  const Icon = getIcon();
  const iconColor = title.includes('Cash Flow') || title.includes('cash') ? '#10B981' :
                    title.includes('Perk') ? '#F59E0B' :
                    title.includes('Trait') ? '#EF4444' :
                    title.includes('Modifier') ? '#3B82F6' : '#10B981';
  
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modal, darkMode && styles.modalDark]}>
          {/* Header */}
          <View style={styles.modalHeaderNew}>
            <View style={styles.modalHeaderContent}>
              <Icon size={scale(24)} color={iconColor} />
              <Text style={[styles.modalTitleNew, darkMode && styles.modalTitleNewDark]} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <X size={scale(24)} color={darkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.modalContentContainer}
            nestedScrollEnabled={true}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function IdentityCard() {
  // Sprint 2 perf: subscribe only to the slices this card reads (directly,
  // through the destructure below, in the cash-flow modal JSX, and via the
  // economy helpers) instead of the whole gameState. One shallow-equal
  // composite means the card re-renders only when one of these top-level
  // slices changes identity — not on every stat-decay tick.
  const gameState = useGameSelector(
    (s) => ({
      stats: s?.stats,
      bankSavings: s?.bankSavings,
      items: s?.items,
      companies: s?.companies,
      realEstate: s?.realEstate,
      userProfile: s?.userProfile,
      relationships: s?.relationships,
      careers: s?.careers,
      currentJob: s?.currentJob,
      perks: s?.perks,
      scenarioId: s?.scenarioId,
      dietPlans: s?.dietPlans,
      date: s?.date,
      youthPills: s?.youthPills,
      settings: s?.settings,
      vehicles: s?.vehicles,
      loans: s?.loans,
      warehouse: s?.warehouse,
      activeVehicleId: s?.activeVehicleId,
      diseases: s?.diseases,
      healthZeroWeeks: s?.healthZeroWeeks,
      happinessZeroWeeks: s?.happinessZeroWeeks,
      equippedCosmetics: s?.equippedCosmetics,
      loginStreak: s?.loginStreak,
      mindset: s?.mindset,
      previousLives: s?.previousLives,
      prestige: s?.prestige,
      // Needed by calcWeeklyPassiveIncome (read via gameState below):
      stocks: s?.stocks,
      stocksOwned: s?.stocksOwned,
      socialMedia: s?.socialMedia,
      politics: s?.politics,
      travel: s?.travel,
      gamingStreaming: s?.gamingStreaming,
      economy: s?.economy,
      week: s?.week,
      weeksLived: s?.weeksLived,
      version: s?.version,
    }),
    shallowEqual
  ) as unknown as GameState;
  const isDarkMode = gameState.settings?.darkMode ?? false;
  const { t } = useTranslation();
  const [showYouthPillModal, setShowYouthPillModal] = useState(false);
  
  const {
    stats,
    userProfile,
    relationships,
    careers,
    currentJob,
    perks,
    scenarioId,
    dietPlans,
    date,
    youthPills
  } = gameState;

  const scenario = (scenarios || []).find(s => s.id === scenarioId);

  // P0-7: userProfile can be absent on degraded/migrating state (TopStatsBar
  // early-returns on the same condition). IdentityCard renders unconditionally on
  // the home tab, so raw access here crashed the whole tab. Guard every access.
  const sex = userProfile?.sex || userProfile?.gender || 'male';
  const name =
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') ||
    userProfile?.name;
  // Prefer the spouse: a partner earlier in the array must not mask a spouse.
  const partner =
    (relationships || []).find(r => r.type === 'spouse') ??
    (relationships || []).find(r => r.type === 'partner');
  const relationshipStatus = partner
    ? partner.type === 'spouse'
      ? 'Married'
      : partner.engagementWeek != null
        ? 'Engaged'
        : 'In Relationship'
    : 'Single';
  const currentCareer = (careers || []).find(c => c.id === currentJob);
  const job = currentCareer && currentCareer.levels && currentCareer.levels[currentCareer.level]
    ? currentCareer.levels[currentCareer.level].name
    : 'Unemployed';
  // Reputation standing (Unknown → Icon) — makes the hidden reputation stat legible.
  //
  // PLAYER REPORT (1.4): "Reputation stat is not viewable anywhere". The tier
  // word alone was not what they asked for and not what the game gates on:
  // the political ladder needs 30 for council, 50 for mayor, 95 for president,
  // and vehicles have their own thresholds. "Respected" cannot tell a player
  // whether the next office is one week away or forty, so the raw 0-100 value
  // is shown beside the word.
  const reputationValue = Math.max(0, Math.round(
    typeof stats?.reputation === 'number' && Number.isFinite(stats.reputation) ? stats.reputation : 0,
  ));
  const reputationStanding = getReputationStanding(reputationValue);

  // The CANONICAL net worth — the same figure prestige, the leaderboard,
  // ambitions, bail cost and the stats screen read.
  //
  // This card used to build its own asset list and run it through
  // computeNetWorth: no stocks, no luxury, property at PURCHASE price,
  // liabilities hardcoded to `[]` (so loans and mortgages simply did not
  // count), and a 1% "transaction fee" haircut that made a fresh $200 save
  // read $198. It was a sixth divergent basis on the most prominent number in
  // the game. 2026-07-28 audit UX-3.
  //
  // netWorth() is identity-key memoised internally, so calling it per render is
  // a pointer compare in the common case.
  const netWorth = canonicalNetWorth(gameState);

  // calcWeeklyPassiveIncome walks owned properties + companies. Only re-run
  // when those arrays actually change, not on every unrelated gameState
  // mutation (otherwise the home tab recomputes on every stat decay tick).
  const passiveInfo = useMemo(
    () => calcWeeklyPassiveIncome(gameState),
    // Key on the actual asset arrays that drive passive income, NOT stats.money
    // (which changes every decay tick and is not an input to passive income) —
    // otherwise this walk re-runs every tick on the home tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.realEstate, gameState.companies, gameState.stocks, gameState.socialMedia]
  );
  const expenseInfo = useMemo(
    () => calcWeeklyExpenses(gameState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameState.realEstate, gameState.vehicles, gameState.loans]
  );
  const passive = passiveInfo.total;
  // Guard the level index the same way `job` (line ~153) does: a stale/migrated
  // save can carry a `level` out of bounds for `levels`, making the lookup
  // undefined and crashing the home tab with `.salary of undefined`.
  const jobIncome = currentCareer?.levels?.[currentCareer.level]?.salary ?? 0;

  // Partner / spouse weekly income (counts even after marriage) — 25% of the
  // HIGHEST-earning qualifying partner. Mirrors computeWeeklyIncome (which caps
  // to the top earner, not a sum) so the displayed cash flow matches reality.
  const partnerIncome = useMemo(() => {
    const top = (relationships || [])
      .filter(rel => (rel.type === 'partner' || rel.type === 'spouse') && rel.income && rel.relationshipScore >= 50)
      .reduce((max, rel) => Math.max(max, rel.income || 0), 0);
    return Math.round(top * 0.25);
  }, [relationships]);

  const expenses = expenseInfo.total;
  const cashFlow = jobIncome + passive + partnerIncome - expenses;

  const [showCash, setShowCash] = useState(false);
  const [showPerks, setShowPerks] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);
  const [showMindset, setShowMindset] = useState(false);
  const [showLegacyTimeline, setShowLegacyTimeline] = useState(false);
  const [showNetWorth, setShowNetWorth] = useState(false);

  const activePerks = useMemo(() => allPerks.filter(p => perks?.[p.id as keyof typeof perks]), [perks]);
  
  const derivedTraits = useMemo(() => {
    const dt: string[] = [];
    // Optional-chain stats: it comes from a nullable selector and is guarded as
    // `stats?.health` elsewhere in this file. IdentityCard renders unconditionally
    // on the home tab, so a degraded/migrating save with missing stats would
    // otherwise white-screen the whole dashboard.
    const happiness = stats?.happiness ?? 0;
    const health = stats?.health ?? 0;
    const energy = stats?.energy ?? 0;
    if (happiness >= 70) dt.push('happy');
    else if (happiness <= 30) dt.push('sad');
    if (health >= 70) dt.push('healthy');
    else if (health <= 30) dt.push('sick');
    if (energy >= 70) dt.push('energetic');
    else if (energy <= 30) dt.push('tired');
    return dt;
  }, [stats?.happiness, stats?.health, stats?.energy]);

  const traits = useMemo(() => [...(scenario?.start.traits || []), ...derivedTraits], [scenario, derivedTraits]);

  // Function to get trait bonuses
  const getTraitBonuses = (trait: string) => {
    const traitBonuses: Record<string, string[]> = {
      'happy': ['+10% salary bonus', '+5 energy per week', '+2 reputation gain'],
      'sad': ['-5% salary penalty', '-3 energy per week', '-1 reputation loss'],
      'healthy': ['+15% salary bonus', '+8 energy per week', '+3 reputation gain', 'Immunity to sickness'],
      'sick': ['-10% salary penalty', '-8 energy per week', '-2 reputation loss', 'Higher sickness risk'],
      'energetic': ['+20% energy efficiency', '+5% faster promotions', '+1 bonus action per week'],
      'tired': ['-15% energy efficiency', '-3% slower promotions', '-1 action penalty per week'],
      'fit': ['+10 fitness starting bonus', '+5% faster fitness gains', '+2 health per week'],
      'tough': ['+15 health starting bonus', '+10% reduced damage from dangerous activities', '+5% better street job success rate'],
      'smart': ['+25% faster education progress', '+10% higher starting salary', '+3 reputation gain'],
      'charismatic': ['+15% relationship success rate', '+10% faster career advancement', '+5 reputation gain'],
      'lucky': ['+20% chance for positive events', '+10% bonus income from random events', '+5% better deals'],
      'ambitious': ['+15% faster career progression', '+10% higher salary negotiations', '+2 bonus energy for work'],
      'creative': ['+20% faster skill learning', '+15% bonus from creative activities', '+3 happiness gain'],
      'analytical': ['+25% better investment returns', '+10% faster problem-solving', '+2 bonus energy for education'],
      'social': ['+20% faster relationship building', '+15% bonus from social activities', '+5 reputation gain'],
      'introverted': ['+10% energy efficiency when alone', '+5% bonus from solo activities', '-5% social penalty'],
      'extroverted': ['+15% bonus from group activities', '+10% faster team projects', '+3 energy from socializing'],
      'risk_taker': ['+20% higher rewards from risky activities', '+15% chance for big wins', '-10% penalty for failures'],
      'conservative': ['+15% reduced risk penalties', '+10% safer investment returns', '+5% energy savings'],
      'optimistic': ['+10% happiness gain', '+5% faster recovery from setbacks', '+2 bonus energy'],
      'pessimistic': ['+10% preparation for failures', '+5% reduced surprise penalties', '-3 happiness penalty'],
      'patient': ['+20% bonus from long-term activities', '+10% better compound effects', '+5 energy efficiency'],
      'impatient': ['+15% faster short-term gains', '+10% immediate rewards', '-5% penalty for waiting'],
      'generous': ['+15% reputation gain', '+10% relationship bonuses', '+5% karma rewards'],
      'selfish': ['+10% personal gain bonus', '+5% resource efficiency', '-5% reputation penalty'],
      'honest': ['+20% reputation gain', '+15% trust bonuses', '+10% long-term relationship benefits'],
      'deceptive': ['+15% short-term gains', '+10% immediate advantages', '-10% long-term penalties'],
      'organized': ['+15% efficiency bonus', '+10% energy savings', '+5% better planning results'],
      'disorganized': ['+10% creative bonuses', '+5% spontaneous rewards', '-5% efficiency penalty'],
      'confident': ['+15% success rate bonus', '+10% faster advancement', '+3 energy gain'],
      'anxious': ['+10% preparation bonus', '+5% risk awareness', '-8% energy penalty'],
      'brave': ['+20% bonus from dangerous activities', '+15% courage rewards', '+5% respect gain'],
      'cautious': ['+15% safety bonuses', '+10% reduced penalties', '+5% energy savings'],
      'leader': ['+20% team bonuses', '+15% management rewards', '+10% respect gain'],
      'follower': ['+15% team efficiency', '+10% support bonuses', '+5% energy savings'],
    };
    return traitBonuses[trait] || ['No specific bonuses defined'];
  };

  const weeklyModifiers = useMemo(() => {
    const modifiers: { label: string; changes: Record<string, number> }[] = [];

    if (stats.health <= 30) {
      modifiers.push({
        label: 'Sickness',
        changes: { health: -10, energy: -15, happiness: -10 },
      });
    }

    const activeDietPlan = (dietPlans || []).find(plan => plan.active);
    if (activeDietPlan) {
      /**
       * The COST is per day and the tick charges seven of them; the GAINS are
       * already per week and the tick applies each exactly once
       * (`applyDietPlan.ts`, one call site per tick). Multiplying both by 7 was
       * right for one and wrong for the other three.
       *
       * The Athlete Diet ($10,000/day) advertised "+84 health, +56 energy, +35
       * happiness per week" against an actual +12 / +8 / +5 — a stat pump one
       * seventh the size of the number on the card, at a correctly-stated
       * price. Same shape as the Family Income x7 a player reported.
       */
      const changes: Record<string, number> = {
        money: -activeDietPlan.dailyCost * 7,
        health: activeDietPlan.healthGain,
        energy: activeDietPlan.energyGain,
      };
      if (activeDietPlan.happinessGain) {
        changes.happiness = activeDietPlan.happinessGain;
      }
      modifiers.push({
        label: `${activeDietPlan.name} Diet`,
        changes,
      });
    }

    return modifiers;
  }, [stats.health, dietPlans]);

  // Health issues surfaced passively on the player card. This replaces the
  // interruptive week-advance popups (sickness modal + zero-stat warning):
  // every active problem is listed here alongside how to fix it.
  const healthIssues = useMemo(() => {
    const issues: { id: string; title: string; fix: string; level: 'critical' | 'warning' | 'info' }[] = [];

    (gameState.diseases || []).forEach((d, i) => {
      if (!d || !d.name) return;
      const hasDeathCountdown = 'weeksUntilDeath' in d && typeof (d as { weeksUntilDeath?: unknown }).weeksUntilDeath === 'number';
      const level: 'critical' | 'warning' | 'info' =
        hasDeathCountdown || d.severity === 'critical'
          ? 'critical'
          : d.severity === 'serious'
            ? 'warning'
            : 'info';
      const sevLabel = d.severity ? d.severity.charAt(0).toUpperCase() + d.severity.slice(1) : 'Mild';
      const fix = (d.treatmentRequired || hasDeathCountdown)
        ? 'See a doctor or hospital in the Health tab to treat it.'
        : 'Rest and eat well — it should pass, or treat it in the Health tab.';
      issues.push({ id: `disease-${d.id}-${i}`, title: `${d.name} · ${sevLabel}`, fix, level });
    });

    const health = stats?.health ?? 100;
    if (health <= 0) {
      const weeksLeft = Math.max(1, 4 - (gameState.healthZeroWeeks || 0));
      issues.push({
        id: 'health-zero',
        title: `Health critical — ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} to recover`,
        fix: "Eat, rest and start a diet plan in the Health tab before it's too late.",
        level: 'critical',
      });
    } else if (health <= 30) {
      issues.push({
        id: 'health-low',
        title: 'Low health',
        fix: 'Improve your diet, rest, and exercise in the Health tab.',
        level: 'warning',
      });
    }

    const happiness = stats?.happiness ?? 100;
    if (happiness <= 0) {
      const weeksLeft = Math.max(1, 4 - (gameState.happinessZeroWeeks || 0));
      issues.push({
        id: 'happiness-zero',
        title: `Happiness critical — ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} to recover`,
        fix: 'Do something fun or spend time with people you care about.',
        level: 'critical',
      });
    } else if (happiness <= 30) {
      issues.push({
        id: 'happiness-low',
        title: 'Low happiness',
        fix: 'Spend on hobbies, socialize, or take a break to recover.',
        level: 'warning',
      });
    }

    const energy = stats?.energy ?? 100;
    if (energy <= 20) {
      issues.push({
        id: 'energy-low',
        title: 'Low energy',
        fix: 'Rest or sleep to recover energy before working.',
        level: 'info',
      });
    }

    return issues;
  }, [gameState.diseases, gameState.healthZeroWeeks, gameState.happinessZeroWeeks, stats?.health, stats?.happiness, stats?.energy]);

  const perksCount = activePerks.length;
  const traitsCount = traits.length;

  const avatar = getAvatarPortrait(userProfile?.avatarId, date?.age ?? 0, name, sex);
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // Equipped Legacy Pass cosmetics: frame → avatar ring color, theme → glow tint.
  const equippedFrame = gameState.equippedCosmetics?.frame
    ? getCosmetic(gameState.equippedCosmetics.frame)
    : undefined;
  const equippedTheme = gameState.equippedCosmetics?.theme
    ? getCosmetic(gameState.equippedCosmetics.theme)
    : undefined;

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={avatar}
            style={[styles.avatar, equippedFrame ? { borderColor: equippedFrame.color } : null]}
          />
          <View
            style={[styles.avatarGlow, equippedTheme ? { backgroundColor: `${equippedTheme.color}33` } : null]}
          />
          {/* DeepLife+ upsell — a glowing crown at the avatar's top-left corner
              (prestige badge owns the top-right). Self-hides for members. */}
          <DeepLifePlusUpsell variant="badge" surface="player_card" style={styles.premiumAvatarCrown} />
          {gameState?.prestige?.prestigeLevel !== undefined && (gameState?.prestige?.prestigeLevel ?? 0) > 0 && (
            <TouchableOpacity
              style={styles.prestigeBadge}
              onPress={() => {
                // Open prestige shop - this would need to be passed as a prop or accessed via context
                // For now, just show the badge
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FCD34D', '#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.prestigeBadgeGradient}
              >
                <Crown size={14} color="#FFFFFF" />
                <Text style={styles.prestigeBadgeText}>P{gameState?.prestige?.prestigeLevel ?? 0}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, styles.nameDark]}>{name}</Text>
          {/* Persistent login-streak badge — surfaces the daily-reward streak
              outside the popup so loss aversion can do its job. */}
          {(gameState?.loginStreak ?? 0) >= 2 && (
            <View style={styles.streakBadge}>
              <Flame size={fontScale(13)} color="#FB923C" />
              <Text style={styles.streakBadgeText}>
                {gameState.loginStreak} {t('game.dayStreak')}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.scenarioText, styles.scenarioTextDark]}>
          {scenario?.title || t('common.unknown')}
        </Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, styles.statLabelDark]}>
              {t('game.age')}
            </Text>
            <Text style={[styles.statValue, styles.statValueDark]} numberOfLines={1}>
              {Math.floor(date?.age ?? 18)}
            </Text>
            {youthPills > 0 && (
              <TouchableOpacity
                style={styles.youthPillButton}
                onPress={() => setShowYouthPillModal(true)}
                accessibilityLabel="Use Youth Pill"
              >
                <Image
                  source={require('@/assets/images/iap/items/youth_pill_single.png')}
                  style={styles.youthPillIcon}
                  resizeMode="contain"
                />
                <Text style={styles.youthPillButtonText}>{youthPills}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, styles.statLabelDark]}>
              {t('game.sex')}
            </Text>
            <Text style={[styles.statValue, styles.statValueDark]} numberOfLines={1}>
              {capitalize(sex)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, styles.statLabelDark]}>
              {t('game.relationshipStatus')}
            </Text>
            <Text style={[styles.statValue, styles.statValueDark]} numberOfLines={1}>
              {relationshipStatus}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, styles.statLabelDark]}>
              {t('game.job')}
            </Text>
            <Text style={[styles.statValue, styles.statValueDark]} numberOfLines={1}>
              {job}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, styles.statLabelDark]}>
              Reputation
            </Text>
            <Text
              style={[styles.statValue, styles.statValueDark, { color: reputationStanding.color }]}
              numberOfLines={1}
            >
              {reputationValue} · {reputationStanding.label}
            </Text>
          </View>
        </View>

        {/* Daily gem drop — 250 for DeepLife+ members, 20 for free players; nudges non-members to upgrade. */}
        <DailyGemClaim />

        <TouchableOpacity
          style={styles.netWorthContainer}
          onPress={() => setShowNetWorth(true)}
          activeOpacity={0.7}
        >
          <DollarSign size={20} color="#10B981" />
          <Text style={[styles.netWorthText, styles.netWorthTextDark]}>
            {t('game.netWorth')}: {formatMoney(netWorth)}
          </Text>
          <ChevronRight size={16} color="#10B981" style={{ marginLeft: responsiveSpacing.xs }} />
        </TouchableOpacity>
      </LinearGradient>

      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.list}
      >
        <TouchableOpacity style={styles.listItem} onPress={() => setShowCash(true)}>
          <View style={styles.listItemContent}>
            <DollarSign size={20} color="#10B981" />
            <Text style={[styles.listLabel, styles.listLabelDark]}>
              {t('game.weeklyCashFlow')}: {formatMoney(cashFlow)}
            </Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowPerks(true)}>
          <View style={styles.listItemContent}>
            <Star size={20} color="#F59E0B" />
            <Text style={[styles.listLabel, styles.listLabelDark]}>
              {perksCount} {t('game.perks')}
            </Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowTraits(true)}>
          <View style={styles.listItemContent}>
            <Heart size={20} color="#EF4444" />
            <Text style={[styles.listLabel, styles.listLabelDark]}>
              {traitsCount} {t('game.traits')}
            </Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>
        {gameState.mindset?.activeTraitId && (
          <TouchableOpacity style={styles.listItem} onPress={() => setShowMindset(true)}>
            <View style={styles.listItemContent}>
              <Brain size={20} color="#8B5CF6" />
              <Text style={[styles.listLabel, styles.listLabelDark]}>
                Mindset: {MINDSET_TRAITS.find(t => t.id === gameState.mindset?.activeTraitId)?.name || 'Unknown'}
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
        {(gameState.previousLives && gameState.previousLives.length > 0) && (
          <TouchableOpacity style={styles.listItem} onPress={() => setShowLegacyTimeline(true)}>
            <View style={styles.listItemContent}>
              <History size={20} color="#8B5CF6" />
              <Text style={[styles.listLabel, styles.listLabelDark]}>
                Legacy Timeline ({gameState.previousLives.length} generation{gameState.previousLives.length !== 1 ? 's' : ''})
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.listItem} onPress={() => setShowModifiers(true)}>
          <View style={styles.listItemContent}>
            <TrendingUp size={20} color="#3B82F6" />
            <Text style={[styles.listLabel, styles.listLabelDark]}>
              {t('game.weeklyModifiers')}
            </Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Health Issues — passive replacement for the week-advance health popups.
          Lists every active health problem and how to fix it. */}
      <View
        style={{
          marginTop: responsiveSpacing.sm,
          borderRadius: scale(16),
          padding: scale(14),
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderWidth: 1,
          borderColor: healthIssues.length > 0
            ? 'rgba(239,68,68,0.35)'
            : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(8) }}>
          {healthIssues.length > 0 ? (
            <AlertTriangle size={scale(18)} color="#EF4444" />
          ) : (
            <Activity size={scale(18)} color="#10B981" />
          )}
          <Text
            style={{
              marginLeft: scale(8),
              fontSize: fontScale(15),
              fontWeight: '700',
              color: isDarkMode ? '#F9FAFB' : '#0F172A',
            }}
          >
            {`Health Issues${healthIssues.length > 0 ? ` (${healthIssues.length})` : ''}`}
          </Text>
        </View>

        {healthIssues.length === 0 ? (
          <Text style={{ fontSize: fontScale(13), color: isDarkMode ? '#94A3B8' : '#6B7280' }}>
            You&apos;re in good shape — no health issues right now.
          </Text>
        ) : (
          healthIssues.map(issue => {
            const color =
              issue.level === 'critical' ? '#EF4444' : issue.level === 'warning' ? '#F59E0B' : '#3B82F6';
            return (
              <View
                key={issue.id}
                style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: scale(8) }}
              >
                <View
                  style={{
                    width: scale(8),
                    height: scale(8),
                    borderRadius: scale(4),
                    backgroundColor: color,
                    marginTop: scale(5),
                    marginRight: scale(8),
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontScale(13.5),
                      fontWeight: '600',
                      color: isDarkMode ? '#F3F4F6' : '#1E293B',
                    }}
                  >
                    {issue.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontScale(12),
                      color: isDarkMode ? '#94A3B8' : '#6B7280',
                      marginTop: scale(1),
                    }}
                  >
                    {issue.fix}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <AutoSaveIndicator position="relative" />

      {showLegacyTimeline && (
        <Suspense fallback={null}>
          <LegacyTimeline
            visible={showLegacyTimeline}
            onClose={() => setShowLegacyTimeline(false)}
          />
        </Suspense>
      )}

      {showNetWorth && (
        <Suspense fallback={null}>
          <NetWorthBreakdownModal
            visible={showNetWorth}
            onClose={() => setShowNetWorth(false)}
          />
        </Suspense>
      )}

      <InfoModal
        visible={showCash}
        title={t('game.weeklyCashFlow')}
        onClose={() => setShowCash(false)}
        darkMode={isDarkMode}
        t={t}
      >
        {/* Only BUILD the heavy cash-flow breakdown (these IIFEs walk every
            property/loan/vehicle/miner) when the modal is actually open —
            otherwise this whole subtree was computed on every home-tab render. */}
        {showCash && (
        <>
        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
            Income Sources
          </Text>
          <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
            <DollarSign size={scale(18)} color="#10B981" />
            <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
              Job Income: {formatMoney(jobIncome)}
            </Text>
          </View>
          {partnerIncome > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <DollarSign size={scale(18)} color="#10B981" />
              <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                Partner Income: {formatMoney(partnerIncome)}
              </Text>
            </View>
          )}
          <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
            <DollarSign size={scale(18)} color="#10B981" />
            <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
              Passive Income: {formatMoney(passive)}
            </Text>
          </View>
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
            Passive Breakdown
          </Text>
          {passiveInfo.breakdown.stocks > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <TrendingUp size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Stocks: {formatMoney(passiveInfo.breakdown.stocks)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.realEstate > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Home size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Real Estate: {formatMoney(passiveInfo.breakdown.realEstate)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.companies > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Building2 size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Companies: {formatMoney(passiveInfo.breakdown.companies)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.cryptoMining > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                ₿ Crypto Mining: {formatMoney(passiveInfo.breakdown.cryptoMining)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.socialMedia > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Smartphone size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Social Media: {formatMoney(passiveInfo.breakdown.socialMedia)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.patents > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <FlaskConical size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Patents: {formatMoney(passiveInfo.breakdown.patents)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.businessOpportunities > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Sparkles size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Business Opportunities: {formatMoney(passiveInfo.breakdown.businessOpportunities)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.political > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Landmark size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Political: {formatMoney(passiveInfo.breakdown.political)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.gamingStreaming > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Gamepad2 size={14} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                Gaming/Streaming: {formatMoney(passiveInfo.breakdown.gamingStreaming)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
            Expenses
          </Text>
          
          {/* Total Expenses */}
          <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
            <DollarSign size={scale(18)} color="#EF4444" />
            <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
              Total Expenses: {formatMoney(expenses)}
            </Text>
          </View>
          
          {/* Property Upkeep - Individual Properties */}
          {expenseInfo.breakdown.upkeep > 0 && (
            <>
              <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <Home size={scale(18)} color="#EF4444" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  Property Upkeep: {formatMoney(expenseInfo.breakdown.upkeep)}
                </Text>
              </View>
              {(() => {
                const propertyExpenses: { name: string; cost: number }[] = [];
                const realEstate = gameState.realEstate || [];

                realEstate.forEach(property => {
                  if (!property || !property.owned) return;
                  const upgradeLevel = typeof property.upgradeLevel === 'number' && isFinite(property.upgradeLevel) && property.upgradeLevel >= 0 ? property.upgradeLevel : 0;
                  const tier = getUpgradeTier(upgradeLevel) || getUpgradeTier(0);
                  if (!tier) return;
                  
                  const propertyUpkeep = typeof property.upkeep === 'number' && isFinite(property.upkeep) && property.upkeep >= 0 ? property.upkeep : 0;
                  const tierUpkeepBonus = typeof tier.upkeepBonus === 'number' && isFinite(tier.upkeepBonus) && tier.upkeepBonus >= 0 ? tier.upkeepBonus : 0;
                  const totalUpkeep = propertyUpkeep + tierUpkeepBonus;
                  
                  if (isFinite(totalUpkeep) && totalUpkeep > 0) {
                    propertyExpenses.push({
                      name: property.name || property.id,
                      cost: totalUpkeep,
                    });
                  }
                });
                
                return propertyExpenses.length > 0 ? (
                  <View style={styles.modalSubSection}>
                    {propertyExpenses.map((prop, idx) => {
                      const property = realEstate.find(p => (p.name || p.id) === prop.name);
                      const upgradeLevel = property ? (typeof property.upgradeLevel === 'number' && isFinite(property.upgradeLevel) && property.upgradeLevel >= 0 ? property.upgradeLevel : 0) : 0;
                      const propertyUpkeep = property ? (typeof property.upkeep === 'number' && isFinite(property.upkeep) && property.upkeep >= 0 ? property.upkeep : 0) : 0;
                      const tier = property ? (getUpgradeTier(upgradeLevel) || getUpgradeTier(0)) : null;
                      const tierUpkeepBonus = tier ? (typeof tier.upkeepBonus === 'number' && isFinite(tier.upkeepBonus) && tier.upkeepBonus >= 0 ? tier.upkeepBonus : 0) : 0;
                      
                      return (
                        <View key={idx} style={[styles.modalSubItem, isDarkMode && styles.modalSubItemDark]}>
                          <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                            • {prop.name}: {formatMoney(prop.cost)}/week
                          </Text>
                          {(propertyUpkeep > 0 || tierUpkeepBonus > 0) && (
                            <View style={styles.modalSubItemDetails}>
                              {propertyUpkeep > 0 && (
                                <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                  {'  '}Base upkeep: {formatMoney(propertyUpkeep)}/week
                                </Text>
                              )}
                              {tierUpkeepBonus > 0 && (
                                <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                  {'  '}Upgrade tier {upgradeLevel} bonus: {formatMoney(tierUpkeepBonus)}/week
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : null;
              })()}
            </>
          )}
          
          {/* Loan Payments - Individual Loans */}
          {expenseInfo.breakdown.loans > 0 && (
            <>
              <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <CreditCard size={scale(18)} color="#EF4444" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  Loan Payments: {formatMoney(expenseInfo.breakdown.loans)}
                </Text>
              </View>
              {(() => {
                const loanExpenses: { name: string; cost: number }[] = [];
                const loans: Loan[] = gameState.loans || [];
                
                loans.forEach(loan => {
                  if (!loan) return;
                  const weeklyPayment = typeof loan.weeklyPayment === 'number' && isFinite(loan.weeklyPayment) && loan.weeklyPayment >= 0 ? loan.weeklyPayment : 0;
                  
                  if (weeklyPayment > 0) {
                    loanExpenses.push({
                      name: hasLoanName(loan) ? loan.name : `Loan #${loanExpenses.length + 1}`,
                      cost: weeklyPayment,
                    });
                  } else {
                    // For loans with 0 weeklyPayment, calculate minimum payment
                    const remaining = loan.remaining || loan.principal || 0;
                    const weeksRemaining = loan.weeksRemaining || loan.termWeeks || 520;
                    
                    if (remaining > 0 && weeksRemaining > 0 && isFinite(remaining) && isFinite(weeksRemaining)) {
                      const minPayment = Math.max(remaining / weeksRemaining, remaining * 0.001);
                      if (isFinite(minPayment) && minPayment > 0) {
                        loanExpenses.push({
                          name: hasLoanName(loan) ? loan.name : `Loan #${loanExpenses.length + 1}`,
                          cost: minPayment,
                        });
                      }
                    }
                  }
                });
                
                return loanExpenses.length > 0 ? (
                  <View style={styles.modalSubSection}>
                    {loanExpenses.map((loan, idx) => {
                      const loanData = loans.find(l => (hasLoanName(l) ? l.name : `Loan #${idx + 1}`) === loan.name);
                      const principal = loanData && hasLoanPrincipal(loanData) ? loanData.principal : 0;
                      const remaining = loanData && hasLoanRemaining(loanData) ? loanData.remaining : principal;
                      const interestRate = loanData && hasLoanInterestRate(loanData) ? loanData.interestRate : 0;
                      
                      return (
                        <View key={idx} style={[styles.modalSubItem, isDarkMode && styles.modalSubItemDark]}>
                          <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                            • {loan.name}: {formatMoney(loan.cost)}/week
                          </Text>
                          {(remaining > 0 || interestRate > 0) && (
                            <View style={styles.modalSubItemDetails}>
                              {remaining > 0 && (
                                <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                  {'  '}Remaining balance: {formatMoney(remaining)}
                                </Text>
                              )}
                              {interestRate > 0 && (
                                <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                  {'  '}Interest rate: {interestRate.toFixed(2)}% APR
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : null;
              })()}
            </>
          )}
          
          {/* Mining Power Costs - Individual Sources */}
          {expenseInfo.breakdown.miningPower > 0 && (
            <>
              <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <Zap size={scale(18)} color="#EF4444" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  Mining Power Costs: {formatMoney(expenseInfo.breakdown.miningPower)}
                </Text>
              </View>
              {(() => {
                const miningExpenses: { name: string; cost: number; power?: number; miners?: { type: string; count: number; power: number }[] }[] = [];
                const companyMinerPower: Record<string, number> = {
                  basic: 10,
                  advanced: 35,
                  pro: 100,
                  industrial: 250,
                  quantum: 500,
                };
                
                // Company miners
                (gameState.companies || []).forEach(company => {
                  if (!company || !company.miners || Object.keys(company.miners).length === 0) return;
                  
                  const totalPower = Object.entries(company.miners).reduce(
                    (sum, [id, count]) => {
                      const minerPower = companyMinerPower[id] || 0;
                      const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
                      return sum + (minerPower * minerCount);
                    },
                    0
                  );
                  
                  if (totalPower > 0 && isFinite(totalPower)) {
                    const monthlyBill = totalPower * 0.20 * 30;
                    if (isFinite(monthlyBill) && monthlyBill > 0) {
                      const weeklyBill = Math.round(monthlyBill / 4);
                      if (weeklyBill > 0) {
                        // Count miners by type
                        const minerCounts: { type: string; count: number; power: number }[] = [];
                        Object.entries(company.miners).forEach(([id, count]) => {
                          const minerPower = companyMinerPower[id] || 0;
                          const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
                          if (minerCount > 0 && minerPower > 0) {
                            minerCounts.push({
                              type: id.charAt(0).toUpperCase() + id.slice(1),
                              count: minerCount,
                              power: minerPower * minerCount,
                            });
                          }
                        });
                        
                        miningExpenses.push({
                          name: `${company.name || company.id} (Company)`,
                          cost: weeklyBill,
                          power: totalPower,
                          miners: minerCounts,
                        });
                      }
                    }
                  }
                });
                
                // Warehouse miners
                const warehouseMinerPower: Record<string, number> = {
                  basic: 10,
                  advanced: 35,
                  pro: 100,
                  industrial: 250,
                  quantum: 500,
                  mega: 2000,
                  giga: 5000,
                  tera: 15000,
                };
                
                if (gameState.warehouse?.miners && Object.keys(gameState.warehouse.miners).length > 0) {
                  const totalPower = Object.entries(gameState.warehouse.miners).reduce(
                    (sum, [id, count]) => {
                      const minerPower = warehouseMinerPower[id] || 0;
                      const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
                      return sum + (minerPower * minerCount);
                    },
                    0
                  );
                  
                  if (totalPower > 0 && isFinite(totalPower)) {
                    const weeklyPowerCost = Math.round(totalPower * 0.60);
                    if (weeklyPowerCost > 0) {
                      // Count warehouse miners by type
                      const minerCounts: { type: string; count: number; power: number }[] = [];
                      Object.entries(gameState.warehouse.miners).forEach(([id, count]) => {
                        const minerPower = warehouseMinerPower[id] || 0;
                        const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
                        if (minerCount > 0 && minerPower > 0) {
                          minerCounts.push({
                            type: id.charAt(0).toUpperCase() + id.slice(1),
                            count: minerCount,
                            power: minerPower * minerCount,
                          });
                        }
                      });
                      
                      miningExpenses.push({
                        name: 'Warehouse Mining',
                        cost: weeklyPowerCost,
                        power: totalPower,
                        miners: minerCounts,
                      });
                    }
                  }
                }
                
                return miningExpenses.length > 0 ? (
                  <View style={styles.modalSubSection}>
                    {miningExpenses.map((mining, idx) => (
                      <View key={idx} style={[styles.modalSubItem, isDarkMode && styles.modalSubItemDark]}>
                        <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                          • {mining.name}: {formatMoney(mining.cost)}/week
                        </Text>
                        {mining.power && mining.power > 0 && (
                          <View style={styles.modalSubItemDetails}>
                            <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                              {'  '}Total power consumption: {mining.power.toLocaleString()} kW
                            </Text>
                            {mining.miners && mining.miners.length > 0 && (
                              <>
                                {mining.miners.map((miner, mIdx) => (
                                  <Text key={mIdx} style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                    {'  '}{miner.type} miners: {miner.count}x ({miner.power.toLocaleString()} kW each)
                                  </Text>
                                ))}
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null;
              })()}
            </>
          )}
          
          {/* Vehicle Costs - Individual Vehicles */}
          {expenseInfo.breakdown.vehicles > 0 && (
            <>
              <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <Car size={scale(18)} color="#EF4444" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  Vehicle Costs: {formatMoney(expenseInfo.breakdown.vehicles)}
                </Text>
              </View>
              {(() => {
                const vehicleExpenses: { name: string; maintenance: number; fuel: number; insurance: number; total: number }[] = [];
                const vehicles = gameState.vehicles || [];
                
                vehicles.forEach(vehicle => {
                  if (!vehicle) return;
                  
                  const maintenanceCost = typeof vehicle.weeklyMaintenanceCost === 'number' && isFinite(vehicle.weeklyMaintenanceCost) && vehicle.weeklyMaintenanceCost >= 0 ? vehicle.weeklyMaintenanceCost : 0;
                  const fuelCost = (gameState.activeVehicleId === vehicle.id && typeof vehicle.weeklyFuelCost === 'number' && isFinite(vehicle.weeklyFuelCost) && vehicle.weeklyFuelCost >= 0) ? vehicle.weeklyFuelCost : 0;
                  const insuranceCost = (vehicle.insurance?.active && typeof vehicle.insurance.monthlyCost === 'number' && isFinite(vehicle.insurance.monthlyCost) && vehicle.insurance.monthlyCost >= 0) ? Math.round(vehicle.insurance.monthlyCost / 4) : 0;
                  
                  const total = maintenanceCost + fuelCost + insuranceCost;
                  if (total > 0) {
                    vehicleExpenses.push({
                      name: vehicle.name || vehicle.id,
                      maintenance: maintenanceCost,
                      fuel: fuelCost,
                      insurance: insuranceCost,
                      total: total,
                    });
                  }
                });
                
                return vehicleExpenses.length > 0 ? (
                  <View style={styles.modalSubSection}>
                    {vehicleExpenses.map((vehicle, idx) => (
                      <View key={idx} style={[styles.modalSubItem, isDarkMode && styles.modalSubItemDark]}>
                        <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                          • {vehicle.name}: {formatMoney(vehicle.total)}/week
                        </Text>
                        {(vehicle.maintenance > 0 || vehicle.fuel > 0 || vehicle.insurance > 0) && (
                          <View style={styles.modalSubItemDetails}>
                            {vehicle.maintenance > 0 && (
                              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                {'  '}Weekly maintenance: {formatMoney(vehicle.maintenance)}/week
                              </Text>
                            )}
                            {vehicle.fuel > 0 && (
                              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                {'  '}Weekly fuel cost: {formatMoney(vehicle.fuel)}/week {gameState.activeVehicleId === vehicles.find(v => (v.name || v.id) === vehicle.name)?.id ? '(Active)' : ''}
                              </Text>
                            )}
                            {vehicle.insurance > 0 && (
                              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { fontSize: fontScale(13) }]}>
                                {'  '}Monthly insurance: {formatMoney(vehicle.insurance * 4)}/month ({formatMoney(vehicle.insurance)}/week)
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null;
              })()}
            </>
          )}
          
          {/* Diet Plan Costs */}
          {expenseInfo.breakdown.dietPlans > 0 && (
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Utensils size={scale(18)} color="#EF4444" />
              <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                Diet Plan: {formatMoney(expenseInfo.breakdown.dietPlans)}
              </Text>
              {(() => {
                const activeDietPlan = (gameState.dietPlans || []).find(plan => plan && plan.active);
                if (activeDietPlan) {
                  return (
                    <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark, { marginTop: scale(4), fontSize: fontScale(13) }]}>
                      {activeDietPlan.name} ({formatMoney(activeDietPlan.dailyCost)}/day × 7 = {formatMoney(activeDietPlan.dailyCost * 7)}/week)
                    </Text>
                  );
                }
                return null;
              })()}
            </View>
          )}
          
          {/* Rent Costs */}
          {expenseInfo.breakdown.rent > 0 && (
            <>
              <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <Home size={scale(18)} color="#EF4444" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  Rent: {formatMoney(expenseInfo.breakdown.rent)}
                </Text>
              </View>
              {(() => {
                const rentExpenses: { name: string; cost: number }[] = [];
                const realEstate = gameState.realEstate || [];
                
                realEstate.forEach(property => {
                  if (!property) return;
                  if ('status' in property && property.status === 'rented' && !property.owned) {
                    const propertyPrice = typeof property.price === 'number' && isFinite(property.price) && property.price >= 0 ? property.price : 0;
                    if (propertyPrice > 0) {
                      const rent = Math.round(propertyPrice * PLAYER_RENT_RATE_WEEKLY);
                      if (isFinite(rent) && rent > 0) {
                        rentExpenses.push({
                          name: property.name || property.id,
                          cost: rent,
                        });
                      }
                    }
                  }
                });
                
                return rentExpenses.length > 0 ? (
                  <View style={styles.modalSubSection}>
                    {rentExpenses.map((rent, idx) => (
                      <View key={idx} style={[styles.modalSubItem, isDarkMode && styles.modalSubItemDark]}>
                        <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                          • {rent.name}: {formatMoney(rent.cost)}/week
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null;
              })()}
            </>
          )}
        </View>
        </>
        )}
      </InfoModal>
      <InfoModal
        visible={showPerks}
        title={t('game.perks')}
        onClose={() => setShowPerks(false)}
        darkMode={isDarkMode}
        t={t}
      >
        {activePerks.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              Active Perks ({activePerks.length})
            </Text>
            {activePerks.map(p => (
              <View key={p.id} style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <Star size={scale(18)} color="#F59E0B" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  {p.title}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              No Active Perks
            </Text>
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                {t('game.noPerks')}
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showTraits}
        title={t('game.traits')}
        onClose={() => setShowTraits(false)}
        darkMode={isDarkMode}
        t={t}
      >
        {traits.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              Character Traits ({traits.length})
            </Text>
            {traits.map(t => (
              <View key={t} style={[styles.traitContainer, isDarkMode && styles.traitContainerDark]}>
                <View style={styles.traitHeader}>
                  <Heart size={scale(18)} color="#EF4444" />
                  <Text style={[styles.traitName, isDarkMode && styles.traitNameDark]}>
                    {capitalize(t)}
                  </Text>
                </View>
                <View style={styles.traitBonuses}>
                  {getTraitBonuses(t).map((bonus, index) => (
                    <View key={index} style={styles.bonusItem}>
                      <Text style={[
                        styles.bonusText, 
                        isDarkMode && styles.bonusTextDark,
                        bonus.startsWith('+') && styles.positiveBonus,
                        bonus.startsWith('-') && styles.negativeBonus
                      ]}>
                        {bonus}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              No Character Traits
            </Text>
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                No traits acquired yet
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showMindset}
        title="Mindset"
        onClose={() => setShowMindset(false)}
        darkMode={isDarkMode}
        t={t}
      >
        {gameState.mindset?.activeTraitId ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              Active Mindset
            </Text>
            {(() => {
              const activeMindset = MINDSET_TRAITS.find(t => t.id === gameState.mindset?.activeTraitId);
              if (!activeMindset) return null;
              
              return (
                <View style={[styles.traitContainer, isDarkMode && styles.traitContainerDark]}>
                  <View style={styles.traitHeader}>
                    <Brain size={scale(18)} color="#8B5CF6" />
                    <Text style={[styles.traitName, isDarkMode && styles.traitNameDark]}>
                      {activeMindset.name}
                    </Text>
                  </View>
                  <View style={styles.traitBonuses}>
                    <View style={styles.bonusItem}>
                      <Text style={[styles.bonusText, isDarkMode && styles.bonusTextDark]}>
                        {activeMindset.description}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              No Active Mindset
            </Text>
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                No mindset trait is currently active. You can select one during character creation or when continuing your legacy.
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showModifiers}
        title={t('game.weeklyModifiers')}
        onClose={() => setShowModifiers(false)}
        darkMode={isDarkMode}
        t={t}
      >
        {weeklyModifiers.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              Active Modifiers ({weeklyModifiers.length})
            </Text>
            {weeklyModifiers.map(mod => (
              <View key={mod.label} style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <TrendingUp size={scale(18)} color="#3B82F6" />
                <Text style={[styles.modalText, isDarkMode && styles.modalTextDark]}>
                  {mod.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              No Active Modifiers
            </Text>
            <View style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
              <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                No modifiers this week
              </Text>
            </View>
          </View>
        )}
        
        {weeklyModifiers.length > 0 && (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
              Effects Breakdown
            </Text>
            {weeklyModifiers.map(mod => (
              <View key={`${mod.label}-effects`} style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                <Text style={[styles.modalSubText, isDarkMode && styles.modalSubTextDark]}>
                  <Text style={{ fontWeight: '600' }}>{mod.label}:</Text>
                </Text>
                {Object.entries(mod.changes).map(([stat, value]) => {
                  const formattedValue =
                    stat === 'money'
                      ? formatMoney(Math.abs(value))
                      : Math.abs(value);
                  return (
                    <View key={stat} style={[styles.modalItem, isDarkMode && styles.modalItemDark]}>
                      <Text
                        style={[
                          styles.modalSubText,
                          isDarkMode && styles.modalSubTextDark,
                          value >= 0 ? styles.positiveText : styles.negativeText,
                        ]}
                      >
                        {`${stat.charAt(0).toUpperCase() + stat.slice(1)}: ${
                          value > 0 ? '+' : ''
                        }${formattedValue}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </InfoModal>

      {/* Youth Pill Modal */}
      {showYouthPillModal && (
        <Suspense fallback={null}>
          <YouthPillModal
            visible={showYouthPillModal}
            onClose={() => setShowYouthPillModal(false)}
          />
        </Suspense>
      )}
    </View>
  );
}


export default React.memo(IdentityCard);

