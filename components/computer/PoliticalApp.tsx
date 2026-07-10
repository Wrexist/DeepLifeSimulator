/**
 * PoliticalApp — Remake 5 · Campaign-HQ DNA pass.
 *
 * Same 3-tab loop + mechanics as before, re-skinned into a campaign
 * headquarters rather than a generic "eyebrow hero + rows" template:
 *
 *   - Office: an APPROVAL GAUGE RING masthead, a vertical OFFICE TIMELINE
 *     (held → current → next) with a drill-down to the full career ladder,
 *     a term stat cluster, and the run/campaign/party levers.
 *   - Policies: enacted policies as BILL VOTE CARDS with FOR/AGAINST split
 *     bars (derived from each policy's approvalImpact) that open a full
 *     effect-breakdown page. Enact / lobby delegated to existing actions.
 *   - Influence: PAC pool + LOBBYIST & ALLIANCE ROSTER rows with influence
 *     meters + the scandal list (the Remake 5 mechanics).
 *
 * All game mechanics are unchanged — this pass only re-presents existing
 * PoliticsState data more densely and adds local list→detail sub-views.
 * Weekly tick still lives in lib/politics/weeklyTick.ts.
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
  Users,
  Check,
  Lock,
  ChevronRight,
  Scale,
  ThumbsUp,
  ThumbsDown,
  Award,
  DollarSign,
  Landmark,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { getGlassCard, getGlassButton, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ScandalRow from '@/components/politics/ScandalRow';
import PACCard from '@/components/politics/PACCard';
import AmountInputModal from '@/components/banking/AmountInputModal';
import ProgressRing from '@/components/ui/ProgressRing';

import {
  raisePACClean,
  raisePACDirty,
  spendPACOnCampaign,
  suppressPoliticalScandal,
  enactPolicy,
  runForOffice,
  campaign,
  joinParty,
} from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { ensurePoliticsHasNewFields } from '@/lib/politics/operations';
import { POLITICAL_CAREER, POLITICAL_CAREER_REQUIREMENTS } from '@/lib/careers/political';
import { getPolicyById, calculatePolicyEffects } from '@/lib/politics/policies';
import type { Policy } from '@/lib/politics/policies';
import { getLobbyistById } from '@/lib/politics/lobbyists';
import type { Lobbyist, PoliticalAlliance } from '@/contexts/game/types';
import EnactPolicyModal from '@/components/politics/EnactPolicyModal';

const LinearGradient = LinearGradientFallback;

// Identity accent — sky #60A5FA. Solid only on small CTAs / badges / dots;
// everywhere else it appears as a translucent tint (fills 0.12–0.18, rims
// 0.28–0.36, hero wash 0.10–0.16 flat). rgb = 96,165,250.
const SKY = '#60A5FA';
const sky = (a: number) => `rgba(96, 165, 250, ${a})`;

// Office rank (careerLevel) → the office you run for NEXT. careerLevel is the
// 1-based rank (0=Citizen … 6=President); index N is the next step up.
const NEXT_OFFICE_KEYS = [
  'council_member', 'mayor', 'state_representative', 'governor', 'senator', 'president',
] as const;
const OFFICE_TITLE: Record<string, string> = {
  council_member: 'Council Member',
  mayor: 'Mayor',
  state_representative: 'State Representative',
  governor: 'Governor',
  senator: 'Senator',
  president: 'President',
};
const CAMPAIGN_COST: Record<string, number> = {
  council_member: 5_000,
  mayor: 20_000,
  state_representative: 50_000,
  governor: 200_000,
  senator: 500_000,
  president: 2_000_000,
};
const PARTIES: { id: 'democratic' | 'republican' | 'independent'; label: string }[] = [
  { id: 'democratic', label: 'Democratic' },
  { id: 'republican', label: 'Republican' },
  { id: 'independent', label: 'Independent' },
];

interface PoliticalAppProps {
  onBack: () => void;
}

type Tab = 'office' | 'policies' | 'influence';

// Local list→detail routing. `null` = the tabbed home; anything else takes
// over the scroll body (presentational pages over existing data only).
type SubView =
  | { kind: 'ladder' }
  | { kind: 'policy'; id: string }
  | { kind: 'lobbyist'; id: string }
  | null;

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

// Rung of the career ladder — one office, its status relative to the player,
// its weekly salary, and the cost + requirement key to run for it.
interface Rung {
  index: number;
  name: string;
  status: 'held' | 'current' | 'next' | 'locked';
  salaryWeekly: number;
  cost: number;
  key: string | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

// Approval band → color + label (mirrors components/politics/ApprovalGauge).
function bandColor(a: number): string {
  if (a >= 75) return accent.success;
  if (a >= 55) return accent.info;
  if (a >= 35) return accent.warning;
  return accent.danger;
}
function bandLabel(a: number): string {
  if (a >= 75) return 'Beloved';
  if (a >= 55) return 'Popular';
  if (a >= 35) return 'Divisive';
  if (a >= 15) return 'Unpopular';
  return 'Reviled';
}

// Presentational FOR/AGAINST split derived from a policy's approvalImpact.
// approvalImpact is the policy's real approval effect; framing it as a public
// support split is honest re-presentation, not a new mechanic.
function forAgainst(approvalImpact: number): { forPct: number; againstPct: number } {
  const forPct = Math.round(clamp(50 + approvalImpact, 6, 94));
  return { forPct, againstPct: 100 - forPct };
}

// Flatten a policy's rich effects object into labeled rows for the detail page.
function describeEffects(policy: Policy): { label: string; value: string; tone: 'pos' | 'neg' | 'neutral' }[] {
  const out: { label: string; value: string; tone: 'pos' | 'neg' | 'neutral' }[] = [];
  const e = policy.effects;
  const sign = (n: number) => (n > 0 ? '+' : '');
  const push = (label: string, value: string, tone: 'pos' | 'neg' | 'neutral' = 'neutral') => out.push({ label, value, tone });

  if (e.money) push('Weekly income', `${sign(e.money)}${formatMoney(e.money)}`, e.money > 0 ? 'pos' : 'neg');
  if (e.happiness) push('Happiness', `${sign(e.happiness)}${e.happiness}`, e.happiness > 0 ? 'pos' : 'neg');
  if (e.health) push('Health', `${sign(e.health)}${e.health}`, e.health > 0 ? 'pos' : 'neg');
  if (e.reputation) push('Reputation', `${sign(e.reputation)}${e.reputation}`, e.reputation > 0 ? 'pos' : 'neg');
  if (e.economy?.inflationRate) push('Inflation', `${sign(e.economy.inflationRate)}${(e.economy.inflationRate * 100).toFixed(1)}%`, e.economy.inflationRate > 0 ? 'neg' : 'pos');
  if (e.economy?.priceIndex) push('Price index', `${sign(e.economy.priceIndex)}${(e.economy.priceIndex * 100).toFixed(1)}%`, e.economy.priceIndex > 0 ? 'neg' : 'pos');

  const s = e.stocks;
  if (s?.volatilityModifier) push('Stock volatility', `×${s.volatilityModifier}`, s.volatilityModifier < 1 ? 'pos' : 'neg');
  if (s?.dividendBonus) push('Dividend bonus', `+${(s.dividendBonus * 100).toFixed(1)}%`, 'pos');
  if (s?.companyBoost?.length) push('Boosts', s.companyBoost.join(', '), 'pos');

  const re = e.realEstate;
  if (re?.priceModifier) push('Property prices', `×${re.priceModifier}`, 'neutral');
  if (re?.rentModifier) push('Rental income', `×${re.rentModifier}`, re.rentModifier >= 1 ? 'pos' : 'neg');
  if (re?.propertyTaxRate) push('Property tax', `${sign(re.propertyTaxRate)}${(re.propertyTaxRate * 100).toFixed(0)}%`, re.propertyTaxRate < 0 ? 'pos' : 'neg');

  const ed = e.education;
  if (ed?.weeksReduction) push('Education time', `−${ed.weeksReduction} wks`, 'pos');
  if (ed?.costReduction) push('Tuition', `−${ed.costReduction}%`, 'pos');
  if (ed?.scholarshipAmount) push('Scholarship', formatMoney(ed.scholarshipAmount), 'pos');

  const c = e.crypto;
  if (c?.miningBonus) push('Mining rate', `+${c.miningBonus}%`, 'pos');
  if (c?.priceStability) push('Crypto stability', `+${(c.priceStability * 100).toFixed(0)}%`, 'pos');
  if (c?.regulationLevel) push('Regulation', `Lvl ${c.regulationLevel}`, 'neutral');

  const t = e.technology;
  if (t?.rdBonus) push('R&D efficiency', `+${t.rdBonus}%`, 'pos');
  if (t?.patentBonus) push('Patent success', `+${t.patentBonus}%`, 'pos');
  if (t?.innovationGrants) push('Innovation grants', formatMoney(t.innovationGrants), 'pos');

  const h = e.healthcare;
  if (h?.healthBonus) push('Health / week', `+${h.healthBonus}`, 'pos');
  if (h?.medicalCostReduction) push('Medical costs', `−${h.medicalCostReduction}%`, 'pos');

  const tr = e.transportation;
  if (tr?.travelCostReduction) push('Travel costs', `−${tr.travelCostReduction}%`, 'pos');
  if (tr?.commuteTimeReduction) push('Commute time', `−${tr.commuteTimeReduction}%`, 'pos');

  return out;
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
  const [subView, setSubView] = useState<SubView>(null);
  const [showRaiseClean, setShowRaiseClean] = useState(false);
  const [showRaiseDirty, setShowRaiseDirty] = useState(false);
  const [showPACSpend, setShowPACSpend] = useState(false);
  const [suppressTargetId, setSuppressTargetId] = useState<string | null>(null);
  const [showEnactPolicy, setShowEnactPolicy] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);

  const cash = gameState.stats?.money ?? 0;
  const btcOwned = useMemo(
    () => (gameState.cryptos ?? []).find((c) => c.id === 'btc')?.owned ?? 0,
    [gameState.cryptos]
  );
  const btcPrice = useMemo(
    () => (gameState.cryptos ?? []).find((c) => c.id === 'btc')?.price ?? 0,
    [gameState.cryptos]
  );

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const activeScandals = (politics.scandals ?? []).filter((s) => s.active);
  const pastScandals = (politics.scandals ?? []).filter((s) => !s.active);
  const lobbyists = politics.lobbyists ?? [];
  const alliances = politics.alliances ?? [];
  const lobbyistInfluence = lobbyists.reduce((t, l) => t + (l.active ? (l.influence ?? 0) : 0), 0);

  const careerLevel = politics.careerLevel ?? 0;
  const officeName = OFFICE_NAME[careerLevel] ?? `Office Lv ${careerLevel}`;
  const salaryWeekly = careerLevel >= 1 ? (POLITICAL_CAREER.levels[careerLevel - 1]?.salary ?? 0) : 0;
  const weeksToElection = politics.nextElectionWeek != null
    ? Math.max(0, politics.nextElectionWeek - gameState.weeksLived)
    : null;
  // Next office up: careerLevel is the 1-based rank, indexing directly into the
  // "run for" list (0 → council, 5 → president). At rank 6 there's nothing higher.
  const nextOfficeKey: string | null = careerLevel < NEXT_OFFICE_KEYS.length
    ? NEXT_OFFICE_KEYS[careerLevel]
    : null;

  // Full 7-rung career ladder (Citizen → President), each rung tagged with its
  // status, weekly salary and campaign cost. Powers both the compact Office
  // timeline and the full ladder detail page.
  const ladder = useMemo<Rung[]>(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((index): Rung => {
      const key = index >= 1 ? NEXT_OFFICE_KEYS[index - 1] : null;
      const status: Rung['status'] =
        index < careerLevel ? 'held'
        : index === careerLevel ? 'current'
        : index === careerLevel + 1 ? 'next'
        : 'locked';
      return {
        index,
        name: OFFICE_NAME[index] ?? `Office Lv ${index}`,
        status,
        salaryWeekly: index >= 1 ? (POLITICAL_CAREER.levels[index - 1]?.salary ?? 0) : 0,
        cost: key ? (CAMPAIGN_COST[key] ?? 0) : 0,
        key,
      };
    });
  }, [careerLevel]);

  // Compact 3-rung window around the current office (held → current → next).
  const compactRungs = useMemo(() => {
    const lo = Math.max(0, careerLevel - 1);
    const hi = Math.min(6, careerLevel + 1);
    return ladder.filter((r) => r.index >= lo && r.index <= hi);
  }, [ladder, careerLevel]);

  const handleRunForOffice = useCallback(() => {
    if (!nextOfficeKey) return;
    const result = runForOffice(gameState, setGameState, nextOfficeKey as Parameters<typeof runForOffice>[2], { updateMoney });
    Alert.alert(result.success ? '🗳️ Election Night' : 'Cannot run yet', result.message);
    if (result.success) queueSave();
  }, [gameState, setGameState, nextOfficeKey, queueSave]);

  const handleJoinParty = useCallback((party: 'democratic' | 'republican' | 'independent') => {
    const result = joinParty(gameState, setGameState, party);
    if (result.success) queueSave();
  }, [gameState, setGameState, queueSave]);

  const handleEnactPolicy = useCallback((policyId: string) => {
    const result = enactPolicy(gameState, setGameState, policyId, { updateMoney, updateStats });
    Alert.alert(result.success ? 'Policy enacted' : 'Could not enact', result.message);
    if (result.success) {
      setShowEnactPolicy(false);
      queueSave();
    }
  }, [gameState, setGameState, queueSave]);

  // --- Office tab --------------------------------------------------------
  const renderOffice = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <EconomyEventBanner context="generic" />

      {/* Recipe B hero — the campaign-HQ masthead: approval gauge RING beside
          the current-office identity. This is the app's signature surface. */}
      <View
        style={[
          getGlassCard(darkMode, 12),
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
        ]}
      >
        <View style={styles.heroInner}>
          <LinearGradient
            pointerEvents="none"
            colors={[sky(0.14), sky(0.03)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroBlob} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

          <View style={styles.heroTopRow}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>CAMPAIGN HEADQUARTERS</Text>
            {politics.party && (
              <View style={[styles.partyChip, { backgroundColor: sky(0.14), borderColor: sky(0.3) }]}>
                <Text style={[styles.partyChipText, { color: SKY }]}>
                  {politics.party.charAt(0).toUpperCase() + politics.party.slice(1)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroMainRow}>
            <ApprovalRing approval={politics.approvalRating ?? 50} theme={theme} darkMode={darkMode} />
            <View style={styles.identityCol}>
              <Text style={[styles.miniEyebrow, { color: theme.textMuted }]}>CURRENT OFFICE</Text>
              <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={2} adjustsFontSizeToFit>
                {officeName}
              </Text>
              <View style={styles.heroChipRow}>
                {salaryWeekly > 0 && (
                  <View style={[styles.metaChip, { backgroundColor: sky(0.14), borderColor: sky(0.3) }]}>
                    <DollarSign size={scale(11)} color={SKY} />
                    <Text style={[styles.metaChipText, { color: theme.text }]}>{formatMoney(salaryWeekly)}/wk</Text>
                  </View>
                )}
                <View style={[styles.metaChip, { backgroundColor: sky(0.14), borderColor: sky(0.3) }]}>
                  <Trophy size={scale(11)} color={SKY} />
                  <Text style={[styles.metaChipText, { color: theme.text }]}>{politics.electionsWon ?? 0} won</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {weeksToElection != null && (
        <View style={[getGlassCard(darkMode, 6), styles.electionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[getGlassIconContainer(darkMode, 30), styles.inlineBubble, { backgroundColor: `rgba(245,158,11,0.15)`, borderColor: `rgba(245,158,11,0.3)` }]}>
            <Calendar size={scale(15)} color={accent.warning} />
          </View>
          <Text style={[styles.electionText, { color: theme.text }]}>
            Next election in {weeksToElection} {weeksToElection === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
      )}

      {/* Signature office timeline: held → current → next, with a drill-down. */}
      <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeadRow}>
          <Landmark size={scale(15)} color={SKY} />
          <Text style={[styles.cardHeadText, { color: theme.text }]}>Career ladder</Text>
        </View>
        <OfficeTimeline rungs={compactRungs} theme={theme} renderContent={(r) => (
          <View>
            <Text style={[styles.rungName, { color: r.status === 'current' ? SKY : theme.text }]} numberOfLines={1}>
              {r.name}
            </Text>
            <Text style={[styles.rungMeta, { color: theme.textMuted }]} numberOfLines={1}>
              {r.status === 'held' && 'Previously held'}
              {r.status === 'current' && (r.salaryWeekly > 0 ? `In office · ${formatMoney(r.salaryWeekly)}/wk` : 'In office')}
              {r.status === 'next' && (r.cost > 0 ? `Next office · ${formatMoney(r.cost)} to run` : 'Next office')}
              {r.status === 'locked' && 'Requires higher office first'}
            </Text>
          </View>
        )} />
        <TouchableOpacity
          onPress={() => setSubView({ kind: 'ladder' })}
          activeOpacity={0.85}
          style={[getGlassButton(darkMode), styles.linkBtn]}
          accessibilityRole="button"
          accessibilityLabel="View the full career ladder"
        >
          <Landmark size={scale(14)} color={SKY} />
          <Text style={[styles.linkBtnText, { color: SKY }]}>View full career ladder</Text>
          <ChevronRight size={scale(15)} color={SKY} />
        </TouchableOpacity>
      </View>

      {/* Term stat cluster — 2×2, densified with the alliance count. */}
      <View style={styles.statGrid}>
        <StatCard theme={theme} darkMode={darkMode} icon={Handshake} label="Lobbyists" value={String(lobbyists.length)} />
        <StatCard theme={theme} darkMode={darkMode} icon={Users} label="Alliances" value={String(alliances.length)} />
        <StatCard theme={theme} darkMode={darkMode} icon={Award} label="Influence" value={String(Math.round(politics.policyInfluence ?? 0))} />
        <StatCard theme={theme} darkMode={darkMode} icon={ClipboardList} label="Policies" value={String((politics.policiesEnacted ?? []).length)} />
      </View>

      {/* Primary action: run for the next office up (or the first office as a
          citizen). runForOffice enforces age / reputation / education / cash and
          rolls the election; its message explains any gate. */}
      {nextOfficeKey ? (
        <TouchableOpacity
          onPress={handleRunForOffice}
          activeOpacity={0.85}
          style={[styles.ctaShadow, getPlatformShadows(5, 0.3, 2, 8)]}
          accessibilityRole="button"
          accessibilityLabel={`Run for ${OFFICE_TITLE[nextOfficeKey]}`}
        >
          <LinearGradient
            colors={[SKY, accent.info]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaFill}
          >
            <Vote size={scale(16)} color="white" />
            <Text style={styles.enactCtaText}>
              Run for {OFFICE_TITLE[nextOfficeKey]} · {formatMoney(CAMPAIGN_COST[nextOfficeKey])}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={[getGlassCard(darkMode, 6), styles.electionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[getGlassIconContainer(darkMode, 30), styles.inlineBubble, { backgroundColor: `rgba(245,158,11,0.15)`, borderColor: `rgba(245,158,11,0.3)` }]}>
            <Trophy size={scale(15)} color={accent.warning} />
          </View>
          <Text style={[styles.electionText, { color: theme.text }]}>You hold the highest office in the land.</Text>
        </View>
      )}

      {/* Campaign: spend cash to lift approval between elections — the lever that
          protects your seat when re-election comes around. */}
      <TouchableOpacity
        onPress={() => setShowCampaign(true)}
        activeOpacity={0.85}
        style={[getGlassButton(darkMode), styles.secondaryCta]}
        accessibilityRole="button"
        accessibilityLabel="Fund a campaign push to raise approval"
      >
        <TrendingUp size={scale(15)} color={SKY} />
        <Text style={[styles.secondaryCtaText, { color: SKY }]}>Fund a campaign push (raise approval)</Text>
      </TouchableOpacity>

      {/* Party affiliation — unlocks party events and a small approval bump. */}
      {politics.party ? (
        <Text style={[styles.helperText, { color: theme.textMuted }]}>
          Registered with the {politics.party.charAt(0).toUpperCase() + politics.party.slice(1)} Party.
        </Text>
      ) : (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Choose a party</SectionTitle>
          <View style={styles.partyRow}>
            {PARTIES.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleJoinParty(p.id)}
                activeOpacity={0.85}
                style={[getGlassButton(darkMode), styles.partyBtn]}
                accessibilityRole="button"
                accessibilityLabel={`Join ${p.label} Party`}
              >
                <Text style={[styles.partyBtnText, { color: theme.text }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // --- Policies tab ------------------------------------------------------
  const renderPolicies = () => {
    const enacted = politics.policiesEnacted ?? [];
    const agg = calculatePolicyEffects(enacted);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Recipe B hero — legislative record with aggregate policy effects. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <LinearGradient
              pointerEvents="none"
              colors={[sky(0.14), sky(0.03)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.heroBlob} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
            <View style={styles.heroCountRow}>
              <View
                style={[
                  getGlassIconContainer(darkMode, 44),
                  styles.heroBubble,
                  { backgroundColor: sky(0.15), borderColor: sky(0.3) },
                ]}
              >
                <Scale size={scale(22)} color={SKY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>LEGISLATIVE RECORD</Text>
                <Text style={[styles.heroName, { color: theme.text }]}>{enacted.length} bills passed</Text>
              </View>
            </View>
            <View style={styles.aggRow}>
              <AggStat label="Weekly income" value={`${agg.money > 0 ? '+' : ''}${formatMoney(agg.money)}`} theme={theme} />
              <AggStat label="Reputation" value={`${agg.reputation > 0 ? '+' : ''}${agg.reputation}`} theme={theme} />
              <AggStat label="Happiness" value={`${agg.happiness > 0 ? '+' : ''}${agg.happiness}`} theme={theme} />
            </View>
          </View>
        </View>

        {/* Primary action: enact a new policy (gate explained at level 0). */}
        <TouchableOpacity
          onPress={() => setShowEnactPolicy(true)}
          disabled={careerLevel === 0}
          activeOpacity={0.85}
          style={[styles.ctaShadow, careerLevel !== 0 && getPlatformShadows(5, 0.3, 2, 8)]}
          accessibilityRole="button"
          accessibilityState={{ disabled: careerLevel === 0 }}
          accessibilityLabel={careerLevel === 0 ? 'Win an election to enact policies' : 'Enact a policy'}
        >
          <LinearGradient
            colors={careerLevel === 0 ? [theme.surfaceElevated, theme.surfaceElevated] : [SKY, accent.info]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaFill}
          >
            {careerLevel !== 0 && <ClipboardList size={scale(16)} color="white" />}
            <Text style={[styles.enactCtaText, careerLevel === 0 && { color: theme.textMuted }]}>
              {careerLevel === 0 ? 'Win an election to enact policies' : 'Enact a policy'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <SectionTitle theme={theme}>Bills on the books</SectionTitle>
        {enacted.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            No policies enacted yet. Win an office, then push your first bill.
          </EmptyText>
        ) : (
          enacted.map((pid: string) => (
            <VoteCard
              key={pid}
              policyId={pid}
              theme={theme}
              darkMode={darkMode}
              onPress={() => setSubView({ kind: 'policy', id: pid })}
            />
          ))
        )}
        <Text style={[styles.helperText, { color: theme.textMuted }]}>
          Each contentious policy you enact slightly raises your scandal risk. See the Influence tab for suppression options.
        </Text>
      </View>
    );
  };

  // --- Influence tab -----------------------------------------------------
  const renderInfluence = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <PACCard
        pac={politics.pac ?? { cleanUSD: 0, dirtyUSD: 0, lifetimeDirtyUSD: 0 }}
        darkMode={darkMode}
        onRaiseClean={() => setShowRaiseClean(true)}
        onRaiseDirty={btcOwned > 0 ? () => setShowRaiseDirty(true) : undefined}
        onSpend={() => setShowPACSpend(true)}
      />

      <View style={{ gap: responsiveSpacing.sm }}>
        <View style={styles.rosterHeadRow}>
          <SectionTitle theme={theme}>Lobbyist roster</SectionTitle>
          {lobbyists.length > 0 && (
            <View style={[styles.countPill, { backgroundColor: sky(0.14), borderColor: sky(0.3) }]}>
              <Text style={[styles.countPillText, { color: SKY }]}>+{lobbyistInfluence} influence</Text>
            </View>
          )}
        </View>
        {lobbyists.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No lobbyists on retainer.</EmptyText>
        ) : (
          lobbyists.map((l) => (
            <LobbyistRow
              key={l.id}
              lobbyist={l}
              theme={theme}
              darkMode={darkMode}
              onPress={() => setSubView({ kind: 'lobbyist', id: l.id })}
            />
          ))
        )}
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Alliances</SectionTitle>
        {alliances.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No political alliances formed.</EmptyText>
        ) : (
          alliances.map((a) => <AllyRow key={a.id} ally={a} theme={theme} darkMode={darkMode} />)
        )}
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Active scandals</SectionTitle>
        {activeScandals.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No active scandals. Keep it clean.</EmptyText>
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
      </View>

      {pastScandals.length > 0 && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Past scandals</SectionTitle>
          {pastScandals.slice(0, 5).map((s) => (
            <ScandalRow key={s.id} scandal={s} darkMode={darkMode} />
          ))}
        </View>
      )}
    </View>
  );

  // --- Detail sub-views (presentational pages over existing data) --------
  const renderLadderDetail = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeadRow}>
          <Landmark size={scale(15)} color={SKY} />
          <Text style={[styles.cardHeadText, { color: theme.text }]}>The full ladder</Text>
        </View>
        <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
          From local council to the White House. Each office lists its weekly salary and what it takes to run.
        </Text>
        <OfficeTimeline rungs={ladder} theme={theme} renderContent={(r) => {
          const reqs = r.key ? POLITICAL_CAREER_REQUIREMENTS[r.key] : undefined;
          return (
            <View style={{ gap: responsiveSpacing.xs }}>
              <View style={styles.ladderTitleRow}>
                <Text style={[styles.rungName, { color: r.status === 'current' ? SKY : theme.text }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <View style={[styles.statusChip, statusChipStyle(r.status, theme)]}>
                  <Text style={[styles.statusChipText, { color: statusChipColor(r.status, theme) }]}>
                    {r.status === 'held' ? 'Held' : r.status === 'current' ? 'In office' : r.status === 'next' ? 'Next' : 'Locked'}
                  </Text>
                </View>
              </View>
              <View style={styles.reqChipRow}>
                {r.salaryWeekly > 0 && <ReqChip theme={theme} text={`${formatMoney(r.salaryWeekly)}/wk`} />}
                {r.cost > 0 && <ReqChip theme={theme} text={`${formatMoney(r.cost)} to run`} />}
                {reqs?.minAge != null && <ReqChip theme={theme} text={`Age ${reqs.minAge}+`} />}
                {reqs?.minReputation != null && <ReqChip theme={theme} text={`Rep ${reqs.minReputation}+`} />}
                {reqs?.education?.length ? <ReqChip theme={theme} text={reqs.education.map((e) => e.replace(/_/g, ' ')).join(', ')} /> : null}
                {reqs?.minWeeksInPrevious != null && <ReqChip theme={theme} text={`${Math.round(reqs.minWeeksInPrevious / 52)}yr in prev`} />}
                {reqs?.specialEvent && <ReqChip theme={theme} text="Special election" />}
              </View>
              {r.status === 'next' && r.key && (
                <TouchableOpacity
                  onPress={handleRunForOffice}
                  activeOpacity={0.85}
                  style={[styles.ctaShadow, styles.ladderRunBtn, getPlatformShadows(5, 0.3, 2, 8)]}
                  accessibilityRole="button"
                  accessibilityLabel={`Run for ${OFFICE_TITLE[r.key]}`}
                >
                  <LinearGradient
                    colors={[SKY, accent.info]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaFill}
                  >
                    <Vote size={scale(15)} color="white" />
                    <Text style={styles.enactCtaText}>Run for {OFFICE_TITLE[r.key]}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          );
        }} />
      </View>
    </View>
  );

  const renderPolicyDetail = (id: string) => {
    const policy = getPolicyById(id);
    if (!policy) {
      return (
        <EmptyText theme={theme} darkMode={darkMode}>Details unavailable for this policy.</EmptyText>
      );
    }
    const { forPct, againstPct } = forAgainst(policy.approvalImpact);
    const effects = describeEffects(policy);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Bill header */}
        <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeadRow}>
            <View style={[getGlassIconContainer(darkMode, 40), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
              <Scale size={scale(18)} color={SKY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>{policy.name}</Text>
              <View style={[styles.typeTag, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[styles.typeTagText, { color: theme.textSecondary }]}>{policy.type}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.detailDesc, { color: theme.textSecondary }]}>{policy.description}</Text>
        </View>

        {/* FOR / AGAINST public support split */}
        <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardHeadText, { color: theme.text }]}>Projected public support</Text>
          <View style={styles.voteLabelRow}>
            <View style={styles.voteSide}>
              <ThumbsUp size={scale(14)} color={accent.success} />
              <Text style={[styles.voteBig, { color: accent.success }]}>{forPct}%</Text>
              <Text style={[styles.voteSideLabel, { color: theme.textMuted }]}>For</Text>
            </View>
            <View style={[styles.voteSide, { alignItems: 'flex-end' }]}>
              <Text style={[styles.voteSideLabel, { color: theme.textMuted }]}>Against</Text>
              <Text style={[styles.voteBig, { color: accent.danger }]}>{againstPct}%</Text>
              <ThumbsDown size={scale(14)} color={accent.danger} />
            </View>
          </View>
          <View style={[styles.splitTrack, { backgroundColor: theme.border }]}>
            <View style={{ flex: forPct, backgroundColor: accent.success }} />
            <View style={{ flex: againstPct, backgroundColor: accent.danger }} />
          </View>
          <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
            Approval impact {policy.approvalImpact > 0 ? '+' : ''}{policy.approvalImpact} · {policy.duration ? `${policy.duration} wks` : 'Permanent'} · Cost {formatMoney(policy.implementationCost)}
          </Text>
        </View>

        {/* Full effect breakdown */}
        <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardHeadText, { color: theme.text }]}>Effects</Text>
          {effects.length === 0 ? (
            <Text style={[styles.cardSubText, { color: theme.textMuted }]}>No measurable ongoing effects.</Text>
          ) : (
            effects.map((eff, i) => (
              <View key={`${eff.label}-${i}`} style={[styles.effectRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <Text style={[styles.effectLabel, { color: theme.textSecondary }]}>{eff.label}</Text>
                <Text style={[styles.effectValue, { color: eff.tone === 'pos' ? accent.success : eff.tone === 'neg' ? accent.danger : theme.text }]}>
                  {eff.value}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderLobbyistDetail = (id: string) => {
    const cat = getLobbyistById(id);
    const held = lobbyists.find((l) => l.id === id);
    const name = held?.name ?? cat?.name ?? 'Lobbyist';
    const influence = held?.influence ?? cat?.influence ?? 0;
    const cost = held?.cost ?? cat?.cost ?? 0;
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeadRow}>
            <View style={[getGlassIconContainer(darkMode, 40), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
              <Handshake size={scale(18)} color={SKY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>{name}</Text>
              {cat?.specialty && (
                <View style={[styles.typeTag, { backgroundColor: theme.surfaceElevated }]}>
                  <Text style={[styles.typeTagText, { color: theme.textSecondary }]}>{cat.specialty} specialist</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusChip, { backgroundColor: held?.active ? `rgba(16,185,129,0.15)` : theme.surfaceElevated, borderColor: held?.active ? `rgba(16,185,129,0.3)` : theme.border }]}>
              <Text style={[styles.statusChipText, { color: held?.active ? accent.success : theme.textMuted }]}>
                {held?.active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          {cat?.description && <Text style={[styles.detailDesc, { color: theme.textSecondary }]}>{cat.description}</Text>}
        </View>

        <View style={styles.statGrid}>
          <StatCard theme={theme} darkMode={darkMode} icon={Award} label="Influence" value={`+${influence}`} />
          <StatCard theme={theme} darkMode={darkMode} icon={DollarSign} label="Retainer" value={formatMoney(cost)} />
        </View>
      </View>
    );
  };

  const renderDetail = () => {
    if (!subView) return null;
    if (subView.kind === 'ladder') return renderLadderDetail();
    if (subView.kind === 'policy') return renderPolicyDetail(subView.id);
    if (subView.kind === 'lobbyist') return renderLobbyistDetail(subView.id);
    return null;
  };

  const detailTitle =
    subView?.kind === 'ladder' ? 'Career Ladder'
    : subView?.kind === 'policy' ? 'Bill Detail'
    : subView?.kind === 'lobbyist' ? 'Lobbyist'
    : 'Politics';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (subView ? setSubView(null) : onBack())}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>{detailTitle}</Text>
        <View style={[styles.cashChip, { backgroundColor: sky(0.14), borderColor: sky(0.3) }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      {!subView && (
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                style={[styles.tab, active && { borderBottomColor: SKY }]}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
              >
                <Icon size={scale(16)} color={active ? SKY : theme.textMuted} />
                <Text style={[styles.tabText, { color: active ? SKY : theme.textMuted }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {subView
          ? renderDetail()
          : (
            <>
              {activeTab === 'office' && renderOffice()}
              {activeTab === 'policies' && renderPolicies()}
              {activeTab === 'influence' && renderInfluence()}
            </>
          )}
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

      <AmountInputModal
        visible={showCampaign}
        title="Fund a campaign push"
        subtitle={`Spend from cash to raise your approval rating (diminishing returns). Cash on hand: ${formatMoney(cash)}`}
        confirmLabel="Spend"
        maxAmount={cash}
        presets={[5_000, 25_000, 100_000]}
        darkMode={darkMode}
        onClose={() => setShowCampaign(false)}
        onConfirm={(amt) => {
          const result = campaign(gameState, setGameState, amt, { updateMoney });
          if (result.success) queueSave();
          else Alert.alert('Campaign', result.message);
          setShowCampaign(false);
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

// ---------------------------------------------------------------------------
// Presentational sub-components
// ---------------------------------------------------------------------------

// Approval gauge RING — the signature campaign-HQ metric. Uses the shared
// ProgressRing (react-native-svg), color-banded by approval level, with the
// band label in the center and the NN% pill on the ring's edge.
function ApprovalRing({ approval, theme, darkMode }: { approval: number; theme: ReturnType<typeof getThemeColors>; darkMode: boolean }) {
  const color = bandColor(approval);
  return (
    <ProgressRing
      value={approval}
      size={110}
      strokeWidth={9}
      accentColor={color}
      surfaceColor={theme.surface}
      borderColor={theme.border}
      inkColor={theme.text}
      trackColor={darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.30)'}
      label={`Approval rating ${Math.round(approval)} percent`}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.ringEyebrow, { color: theme.textMuted }]}>APPROVAL</Text>
        <Text style={[styles.ringBand, { color }]} numberOfLines={1}>{bandLabel(approval)}</Text>
      </View>
    </ProgressRing>
  );
}

// Vertical office timeline with node dots + auto-connecting segments. The
// `renderContent` prop lets the same skeleton drive both the compact Office
// card and the full ladder detail page.
function OfficeTimeline({
  rungs,
  theme,
  renderContent,
}: {
  rungs: Rung[];
  theme: ReturnType<typeof getThemeColors>;
  renderContent: (r: Rung) => React.ReactNode;
}) {
  return (
    <View style={styles.timeline}>
      {rungs.map((r, i) => {
        const isFirst = i === 0;
        const isLast = i === rungs.length - 1;
        const topReached = r.status === 'held' || r.status === 'current';
        const bottomReached = r.status === 'held';
        return (
          <View key={r.index} style={styles.rungRow}>
            <View style={styles.nodeCol}>
              <View style={[styles.connector, { backgroundColor: topReached ? sky(0.5) : theme.border }, isFirst && styles.connectorHidden]} />
              <View style={[styles.node, nodeStyle(r.status, theme)]}>
                {r.status === 'held' && <Check size={scale(13)} color="#FFFFFF" />}
                {r.status === 'current' && <Landmark size={scale(13)} color="#FFFFFF" />}
                {r.status === 'next' && <Vote size={scale(12)} color={SKY} />}
                {r.status === 'locked' && <Lock size={scale(12)} color={theme.textMuted} />}
              </View>
              <View style={[styles.connector, { backgroundColor: bottomReached ? sky(0.5) : theme.border }, isLast && styles.connectorHidden]} />
            </View>
            <View style={styles.rungContent}>{renderContent(r)}</View>
          </View>
        );
      })}
    </View>
  );
}

function nodeStyle(status: Rung['status'], theme: ReturnType<typeof getThemeColors>) {
  if (status === 'held') return { backgroundColor: sky(0.85), borderColor: sky(0.85) };
  if (status === 'current') return { backgroundColor: SKY, borderColor: sky(0.4) };
  if (status === 'next') return { backgroundColor: 'transparent', borderColor: SKY };
  return { backgroundColor: theme.surfaceElevated, borderColor: theme.border };
}

function statusChipStyle(status: Rung['status'], theme: ReturnType<typeof getThemeColors>) {
  if (status === 'current') return { backgroundColor: sky(0.15), borderColor: sky(0.3) };
  if (status === 'held') return { backgroundColor: `rgba(16,185,129,0.15)`, borderColor: `rgba(16,185,129,0.3)` };
  return { backgroundColor: theme.surfaceElevated, borderColor: theme.border };
}
function statusChipColor(status: Rung['status'], theme: ReturnType<typeof getThemeColors>) {
  if (status === 'current') return SKY;
  if (status === 'held') return accent.success;
  return theme.textMuted;
}

// A single enacted bill as a vote card with a FOR/AGAINST split bar.
function VoteCard({
  policyId,
  theme,
  darkMode,
  onPress,
}: {
  policyId: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  onPress: () => void;
}) {
  const policy = getPolicyById(policyId);
  const name = policy?.name ?? policyId;
  const impact = policy?.approvalImpact ?? 0;
  const { forPct, againstPct } = forAgainst(impact);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[getGlassCard(darkMode, 6), styles.voteCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`View ${name} details`}
    >
      <View style={styles.voteHeadRow}>
        <View style={[getGlassIconContainer(darkMode, 34), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
          <Scale size={scale(15)} color={SKY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.voteName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
          <View style={styles.voteMetaRow}>
            {policy?.type && (
              <View style={[styles.typeTag, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[styles.typeTagText, { color: theme.textSecondary }]}>{policy.type}</Text>
              </View>
            )}
            <Text style={[styles.voteMetaText, { color: theme.textMuted }]}>
              {policy ? formatMoney(policy.implementationCost) : ''}
            </Text>
          </View>
        </View>
        <ChevronRight size={scale(18)} color={theme.textMuted} />
      </View>

      <View style={styles.voteSplitLabels}>
        <View style={styles.voteInline}>
          <ThumbsUp size={scale(11)} color={accent.success} />
          <Text style={[styles.voteSplitText, { color: accent.success }]}>{forPct}%</Text>
        </View>
        <View style={styles.voteInline}>
          <Text style={[styles.voteSplitText, { color: accent.danger }]}>{againstPct}%</Text>
          <ThumbsDown size={scale(11)} color={accent.danger} />
        </View>
      </View>
      <View style={[styles.splitTrack, { backgroundColor: theme.border }]}>
        <View style={{ flex: forPct, backgroundColor: accent.success }} />
        <View style={{ flex: againstPct, backgroundColor: accent.danger }} />
      </View>
    </TouchableOpacity>
  );
}

// A hired lobbyist as a roster row with an influence meter. Enriched with the
// catalog's specialty via getLobbyistById. Tappable → lobbyist detail page.
function LobbyistRow({
  lobbyist,
  theme,
  darkMode,
  onPress,
}: {
  lobbyist: Lobbyist;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  onPress: () => void;
}) {
  const cat = getLobbyistById(lobbyist.id);
  const meterPct = clamp((lobbyist.influence / 50) * 100, 6, 100);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[getGlassCard(darkMode, 6), styles.rosterRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`View ${lobbyist.name}`}
    >
      <View style={[getGlassIconContainer(darkMode, 38), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
        <Handshake size={scale(17)} color={SKY} />
      </View>
      <View style={{ flex: 1, gap: scale(4) }}>
        <View style={styles.rosterNameRow}>
          <Text style={[styles.rosterName, { color: theme.text }]} numberOfLines={1}>{lobbyist.name}</Text>
          {lobbyist.active && <View style={[styles.liveDot, { backgroundColor: accent.success }]} />}
        </View>
        <Text style={[styles.rosterMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {(cat?.specialty ?? 'all')} · {formatMoney(lobbyist.cost)}
        </Text>
        <View style={[styles.meterTrack, { backgroundColor: theme.surfaceElevated }]}>
          <View style={[styles.meterFill, { width: `${meterPct}%`, backgroundColor: SKY }]} />
        </View>
      </View>
      <View style={styles.rosterRight}>
        <Text style={[styles.rosterInfluence, { color: SKY }]}>+{lobbyist.influence}</Text>
        <Text style={[styles.rosterInfluenceLabel, { color: theme.textMuted }]}>infl.</Text>
        <ChevronRight size={scale(16)} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// A political alliance as a roster row with an influence meter.
function AllyRow({
  ally,
  theme,
  darkMode,
}: {
  ally: PoliticalAlliance;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  const meterPct = clamp((ally.influence / 50) * 100, 6, 100);
  return (
    <View style={[getGlassCard(darkMode, 6), styles.rosterRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[getGlassIconContainer(darkMode, 38), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
        <Users size={scale(17)} color={SKY} />
      </View>
      <View style={{ flex: 1, gap: scale(4) }}>
        <Text style={[styles.rosterName, { color: theme.text }]} numberOfLines={1}>{ally.name}</Text>
        <Text style={[styles.rosterMeta, { color: theme.textMuted }]} numberOfLines={1}>
          Ally since week {ally.formedWeek}
        </Text>
        <View style={[styles.meterTrack, { backgroundColor: theme.surfaceElevated }]}>
          <View style={[styles.meterFill, { width: `${meterPct}%`, backgroundColor: SKY }]} />
        </View>
      </View>
      <View style={styles.rosterRight}>
        <Text style={[styles.rosterInfluence, { color: SKY }]}>+{ally.influence}</Text>
        <Text style={[styles.rosterInfluenceLabel, { color: theme.textMuted }]}>infl.</Text>
      </View>
    </View>
  );
}

function ReqChip({ theme, text }: { theme: ReturnType<typeof getThemeColors>; text: string }) {
  return (
    <View style={[styles.reqChip, { backgroundColor: theme.surfaceElevated }]}>
      <Text style={[styles.reqChipText, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );
}

function AggStat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.aggStat}>
      <Text style={[styles.aggValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.aggLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function EmptyText({ theme, darkMode, children }: { theme: ReturnType<typeof getThemeColors>; darkMode: boolean; children: React.ReactNode }) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>
    </View>
  );
}

function StatCard({
  theme,
  darkMode,
  icon: Icon,
  label,
  value,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
}) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[getGlassIconContainer(darkMode, 30), styles.statBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
        <Icon size={scale(14)} color={SKY} />
      </View>
      <Text style={[styles.statSmallValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statSmallLabel, { color: theme.textMuted }]}>{label}</Text>
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

  // --- Hero (Recipe B) ---------------------------------------------------
  heroCard: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius['2xl'],
  },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
  },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(96, 165, 250, 0.10)',
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.lg,
  },
  identityCol: { flex: 1, gap: responsiveSpacing.xs },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  heroBubble: { borderWidth: 1 },
  heroEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  miniEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  heroName: {
    fontSize: responsiveFontSize['3xl'],
    fontWeight: '800',
    marginTop: 2,
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  metaChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  partyChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  partyChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },

  // --- Approval ring center ----------------------------------------------
  ringEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ringBand: {
    fontSize: responsiveFontSize.md,
    fontWeight: '800',
    marginTop: 1,
  },

  // --- Aggregate policy effect strip -------------------------------------
  aggRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  aggStat: {
    flex: 1,
    gap: 2,
  },
  aggValue: { fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  aggLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },

  // --- Primary CTA (Recipe D) --------------------------------------------
  ctaShadow: {
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: SKY,
  },
  ctaFill: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  enactCtaText: {
    color: 'white',
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },

  // --- Secondary CTA (glass button) --------------------------------------
  secondaryCta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  secondaryCtaText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.xs,
  },
  linkBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  partyRow: { flexDirection: 'row', gap: responsiveSpacing.sm },
  partyBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
  },
  partyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // --- Section cards -----------------------------------------------------
  sectionCard: {
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
    gap: responsiveSpacing.sm,
  },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  cardHeadText: { fontSize: responsiveFontSize.md, fontWeight: '700', letterSpacing: 0.2 },
  cardSubText: { fontSize: responsiveFontSize.xs, lineHeight: responsiveFontSize.lg },

  // --- Office timeline ---------------------------------------------------
  timeline: { marginTop: responsiveSpacing.xs },
  rungRow: { flexDirection: 'row', gap: responsiveSpacing.sm },
  nodeCol: { width: scale(30), alignItems: 'center' },
  connector: { width: scale(2), flex: 1, minHeight: scale(8) },
  connectorHidden: { backgroundColor: 'transparent' },
  node: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rungContent: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    justifyContent: 'center',
  },
  rungName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  rungMeta: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  ladderTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing.sm },
  statusChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  statusChipText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  reqChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  reqChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.md,
  },
  reqChipText: { fontSize: responsiveFontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  ladderRunBtn: { marginTop: responsiveSpacing.xs },

  // --- Top bar + tabs ----------------------------------------------------
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  backBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
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

  inlineBubble: { borderWidth: 1 },
  electionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
  },
  electionText: { flex: 1, fontSize: responsiveFontSize.sm, fontWeight: '700' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
    gap: responsiveSpacing.xs,
    alignItems: 'flex-start',
  },
  statBubble: { borderWidth: 1 },
  statSmallLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statSmallValue: { fontSize: responsiveFontSize.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },

  // --- Vote card ---------------------------------------------------------
  voteCard: {
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
    gap: responsiveSpacing.sm,
  },
  voteHeadRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  voteName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  voteMetaRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs, marginTop: 3 },
  voteMetaText: { fontSize: responsiveFontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
  voteSplitLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voteInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteSplitText: { fontSize: responsiveFontSize.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  splitTrack: {
    flexDirection: 'row',
    height: scale(8),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },

  // --- Vote / policy detail ----------------------------------------------
  detailTitle: { fontSize: responsiveFontSize.lg, fontWeight: '800' },
  detailDesc: { fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.xl },
  typeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.full,
    marginTop: 3,
  },
  typeTagText: { fontSize: responsiveFontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  voteLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  voteSide: { gap: 2 },
  voteBig: { fontSize: responsiveFontSize['2xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  voteSideLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
  },
  effectLabel: { fontSize: responsiveFontSize.sm, flex: 1 },
  effectValue: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // --- Roster rows -------------------------------------------------------
  rosterHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing.sm },
  countPill: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  countPillText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
  },
  rosterNameRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  rosterName: { fontSize: responsiveFontSize.md, fontWeight: '700', flexShrink: 1 },
  rosterMeta: { fontSize: responsiveFontSize.xs, textTransform: 'capitalize' },
  liveDot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
  meterTrack: {
    height: scale(5),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginTop: 2,
  },
  meterFill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  rosterRight: { alignItems: 'flex-end', gap: 1 },
  rosterInfluence: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rosterInfluenceLabel: { fontSize: responsiveFontSize.xs },

  policyDesc: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  helperText: { fontSize: responsiveFontSize.xs, fontStyle: 'italic', lineHeight: responsiveFontSize.lg },

  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: responsiveSpacing.xs,
  },
  emptyCard: {
    padding: responsiveSpacing.md,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    opacity: 0.7,
  },
});
