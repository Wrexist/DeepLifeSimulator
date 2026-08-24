/**
 * PoliticalApp - Remake 5 · Campaign-HQ DNA pass.
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
 * All game mechanics are unchanged - this pass only re-presents existing
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
  Banknote,
  ShieldAlert,
  LogOut,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import Gradient from '@/components/ui/Gradient';
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
  hireLobbyist,
  formAlliance,
  availableAppointments,
  takeAppointment,
  resignAppointment,
  embezzleCampaignFunds,
  retireFromPolitics,
} from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { ensurePoliticsHasNewFields } from '@/lib/politics/operations';
import {
  ENDORSEMENT_THRESHOLD,
  POLITICAL_PARTIES,
  facesPrimaryChallenge,
  findParty,
  hasPartyMachine,
  isEndorsed,
  readPartySupport,
} from '@/lib/politics/parties';
import { findAppointment } from '@/lib/politics/appointments';
import {
  maxWeeklySkim,
  readEmbezzlement,
  skimmablePot,
  skimmedThisWeek,
} from '@/lib/politics/embezzlement';
import { calculatePension, retirementBlocker } from '@/lib/politics/retirement';
import { POLITICAL_CAREER, POLITICAL_CAREER_REQUIREMENTS } from '@/lib/careers/political';
import { paidWeeklySalaryForLevel } from '@/lib/careers/weeklySalary';
import { getPolicyById, calculatePolicyEffects } from '@/lib/politics/policies';
import type { Policy } from '@/lib/politics/policies';
import {
  getLobbyistById,
  getAvailableLobbyists,
  describeSpecialties,
  policyDiscountFraction,
} from '@/lib/politics/lobbyists';
import type { Lobbyist, PoliticalAlliance } from '@/contexts/game/types';
import EnactPolicyModal from '@/components/politics/EnactPolicyModal';

import { formatMoney } from '@/utils/moneyFormatting';

const LinearGradient = Gradient;

// Identity accent - sky #60A5FA. Solid only on small CTAs / badges / dots;
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

type Tab = 'office' | 'career' | 'policies' | 'influence';

// Local list→detail routing. `null` = the tabbed home; anything else takes
// over the scroll body (presentational pages over existing data only).
type SubView =
  | { kind: 'ladder' }
  | { kind: 'policy'; id: string }
  | { kind: 'lobbyist'; id: string }
  | { kind: 'hireLobbyist' }
  | { kind: 'formAlliance' }
  | null;

// Alliance targets the formAlliance action supports (it accepts any
// characterId + name and grants a fixed +10 influence + a small approval bump).
// Defined locally like PARTIES - political blocs/figures the player can court.
const ALLIANCE_TARGETS: { id: string; name: string; role: string; description: string }[] = [
  { id: 'labor_union_coalition', name: 'Labor Union Coalition', role: 'Grassroots bloc', description: 'Organized labor turns out voters and volunteers for allied candidates.' },
  { id: 'business_roundtable', name: 'Business Roundtable', role: 'Corporate bloc', description: 'A coalition of major employers with deep campaign-finance reach.' },
  { id: 'progressive_caucus', name: 'Progressive Caucus', role: 'Legislative bloc', description: 'Reform-minded legislators who move social and environmental bills.' },
  { id: 'senator_blake', name: 'Senator Blake', role: 'Senate power broker', description: 'A senior senator whose endorsement carries weight across the aisle.' },
  { id: 'tech_donor_network', name: 'Tech Donor Network', role: 'Fundraising bloc', description: 'Silicon Valley donors who bankroll data-driven campaigns.' },
  { id: 'veterans_alliance', name: 'Veterans Alliance', role: 'Advocacy bloc', description: 'Veterans’ groups whose backing signals credibility on security.' },
  { id: 'faith_coalition', name: 'Faith Coalition', role: 'Community bloc', description: 'Congregational networks that mobilize values-driven voters.' },
  { id: 'farmers_federation', name: 'Farmers Federation', role: 'Rural bloc', description: 'Agricultural interests that anchor support across rural districts.' },
];

// Fixed alliance influence - mirrors the value formAlliance stamps on each ally.
const ALLIANCE_INFLUENCE = 10;

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'office',     label: 'Office',    icon: Briefcase },
  { id: 'career',     label: 'Career',    icon: Landmark },
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

// Rung of the career ladder - one office, its status relative to the player,
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

  // R4-X7: the rows below deliberately omit `INERT_POLICY_KEYS`
  // (lib/politics/policies.ts) - effects that are declared and priced but have
  // no system behind them. See that constant's note for the list and reasoning.
  //
  // effects.money is a ONE-TIME treasury delta applied at enactment
  // (PoliticalActions enactPolicy), never a weekly stream - label it honestly.
  if (e.money) push('One-time cash', `${sign(e.money)}${formatMoney(e.money)}`, e.money > 0 ? 'pos' : 'neg');
  if (e.happiness) push('Happiness', `${sign(e.happiness)}${e.happiness}`, e.happiness > 0 ? 'pos' : 'neg');
  if (e.health) push('Health', `${sign(e.health)}${e.health}`, e.health > 0 ? 'pos' : 'neg');
  if (e.reputation) push('Reputation', `${sign(e.reputation)}${e.reputation}`, e.reputation > 0 ? 'pos' : 'neg');
  // `inflationRate` now reaches `applyWeeklyInflation` (R4-X7). `priceIndex` is
  // NOT rendered: no policy in the catalogue carries it, and nothing consumes
  // it, so the row could only ever have been an empty promise.
  if (e.economy?.inflationRate) push('Inflation', `${sign(e.economy.inflationRate)}${(e.economy.inflationRate * 100).toFixed(1)}%`, e.economy.inflationRate > 0 ? 'neg' : 'pos');

  const s = e.stocks;
  if (s?.volatilityModifier) push('Stock volatility', `×${s.volatilityModifier}`, s.volatilityModifier < 1 ? 'pos' : 'neg');
  if (s?.dividendBonus) push('Dividend bonus', `+${(s.dividendBonus * 100).toFixed(1)}%`, 'pos');
  if (s?.companyBoost?.length) push('Boosts', s.companyBoost.join(', '), 'pos');

  const re = e.realEstate;
  // `rentModifier` is live (lib/economy/passiveIncome.ts). `priceModifier` and
  // `propertyTaxRate` are NOT rendered - see the note above `INERT_POLICY_KEYS`.
  if (re?.rentModifier) push('Rental income', `×${re.rentModifier}`, re.rentModifier >= 1 ? 'pos' : 'neg');

  const ed = e.education;
  if (ed?.weeksReduction) push('Education time', `−${ed.weeksReduction} wks`, 'pos');
  if (ed?.costReduction) push('Tuition', `−${ed.costReduction}%`, 'pos');
  if (ed?.scholarshipAmount) push('Scholarship', formatMoney(ed.scholarshipAmount), 'pos');

  const c = e.crypto;
  // `miningBonus` is live (lib/economy/passiveIncome.ts). `priceStability` and
  // `regulationLevel` are NOT rendered - see `INERT_POLICY_KEYS`.
  if (c?.miningBonus) push('Mining rate', `+${c.miningBonus}%`, 'pos');

  // The whole `technology` block is NOT rendered - see `INERT_POLICY_KEYS`.

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
  const [showEmbezzle, setShowEmbezzle] = useState(false);

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
  // `POLITICAL_CAREER.levels[].salary` is ANNUAL - 800 for a Local Council
  // Member up to 100,000 for a President - while every figure on this screen is
  // labelled "/wk". Reading it raw put "In office · $100K/wk" in front of a
  // President the tick actually pays $1,923, and it did the same to every rung
  // of the ladder below, which is the screen a player uses to decide whether an
  // office is worth its campaign cost: a 52x salary against a real cost.
  //
  // Third screen to fall into this field. `weeklyCareerSalary` closed it for the
  // four loan/DTI gates (2026-07-31) and `paidWeeklyCareerSalary` closed it for
  // the home tab's Cash Flow panel; both went looking for callers of the bug
  // rather than readers of the field. `paidWeeklySalaryForLevel` owns the
  // conversion - and deliberately applies no boosts to political pay, because
  // office money is credited by `calcWeeklyPassiveIncome`, which applies none.
  //
  // The `>= 1` guards stay: `careerLevel` is the 1-based office RANK (0 =
  // Citizen), and the helper CLAMPS an out-of-range index rather than returning
  // 0, so rank 0 would otherwise read as a council member's pay.
  const salaryWeekly = careerLevel >= 1
    ? paidWeeklySalaryForLevel(gameState, POLITICAL_CAREER, careerLevel - 1)
    : 0;
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
        salaryWeekly: index >= 1 ? paidWeeklySalaryForLevel(gameState, POLITICAL_CAREER, index - 1) : 0,
        cost: key ? (CAMPAIGN_COST[key] ?? 0) : 0,
        key,
      };
    });
  }, [careerLevel, gameState]);

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
    // Crossing the floor costs approval and standing, so the outcome is
    // reported either way rather than silently applied.
    Alert.alert(result.success ? 'Party membership' : 'Could not join', result.message);
    if (result.success) queueSave();
  }, [gameState, setGameState, queueSave]);

  const handleTakeAppointment = useCallback((appointmentId: string) => {
    const result = takeAppointment(gameState, setGameState, appointmentId);
    Alert.alert(result.success ? 'Appointment' : 'Not offered', result.message);
    if (result.success) queueSave();
  }, [gameState, setGameState, queueSave]);

  const handleResignAppointment = useCallback(() => {
    const result = resignAppointment(gameState, setGameState);
    if (result.success) queueSave();
    else Alert.alert('Appointment', result.message);
  }, [gameState, setGameState, queueSave]);

  /**
   * Retiring is irreversible - the seat is gone and only a new election gets it
   * back - so it asks first, with the pension named in the prompt.
   */
  const handleRetire = useCallback(() => {
    const politicalCareer = (gameState.careers ?? []).find((c) => c.id === 'political');
    const weeksInOffice = typeof politicalCareer?.startedWeeksLived === 'number'
      ? Math.max(0, (gameState.weeksLived ?? 0) - politicalCareer.startedWeeksLived)
      : (politicalCareer?.progress ?? 0);
    const blocker = retirementBlocker({
      careerLevel: gameState.politics?.careerLevel,
      termsServed: gameState.politics?.electionsWon,
      weeksInOffice,
    });
    if (blocker) {
      Alert.alert('Cannot retire yet', blocker);
      return;
    }
    const pension = calculatePension({
      officeLevel: gameState.politics?.careerLevel,
      termsServed: gameState.politics?.electionsWon,
      approvalRating: gameState.politics?.approvalRating,
    });
    Alert.alert(
      'Stand down?',
      `You will leave office for good and draw ${formatMoney(pension)}/wk for life. `
      + 'Getting the seat back means winning another election.',
      [
        { text: 'Stay in office', style: 'cancel' },
        {
          text: 'Retire',
          style: 'destructive',
          onPress: () => {
            const result = retireFromPolitics(gameState, setGameState);
            Alert.alert(result.success ? 'Retired' : 'Could not retire', result.message);
            if (result.success) queueSave();
          },
        },
      ],
    );
  }, [gameState, setGameState, queueSave]);

  const handleEnactPolicy = useCallback((policyId: string) => {
    const result = enactPolicy(gameState, setGameState, policyId, { updateMoney, updateStats });
    Alert.alert(result.success ? 'Policy enacted' : 'Could not enact', result.message);
    if (result.success) {
      setShowEnactPolicy(false);
      queueSave();
    }
  }, [gameState, setGameState, queueSave]);

  // Hire a lobbyist from the 15-strong catalog - the action charges the retainer
  // and raises policy influence by the lobbyist's rating (atomic, in one updater).
  const handleHireLobbyist = useCallback((lobbyistId: string) => {
    const result = hireLobbyist(gameState, setGameState, lobbyistId, { updateMoney });
    Alert.alert(result.success ? 'Lobbyist hired' : 'Cannot hire', result.message);
    if (result.success) {
      queueSave();
      setSubView(null);
    }
  }, [gameState, setGameState, queueSave]);

  // Form a political alliance - grants a fixed +10 influence ally + a small
  // approval bump (formAlliance). Targets come from the local ALLIANCE_TARGETS bloc.
  const handleFormAlliance = useCallback((characterId: string, characterName: string) => {
    const result = formAlliance(gameState, setGameState, characterId, characterName);
    Alert.alert(result.success ? 'Alliance formed' : 'Cannot form alliance', result.message);
    if (result.success) {
      queueSave();
      setSubView(null);
    }
  }, [gameState, setGameState, queueSave]);

  // --- Office tab --------------------------------------------------------
  const renderOffice = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <EconomyEventBanner context="generic" />

      {/* Recipe B hero - the campaign-HQ masthead: approval gauge RING beside
          the current-office identity. This is the app's signature surface. */}
      <View
        style={[
          getGlassCard(darkMode, 12),
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
        ]}
      >
        <View style={styles.heroInner}>
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

      {/* Term stat cluster - 2×2, densified with the alliance count. */}
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

      {/* Campaign: spend cash to lift approval between elections - the lever that
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

      {/* Party, appointments, the war chest and retirement all live on the
          Career tab - this tab is the seat you hold right now. */}
      <TouchableOpacity
        onPress={() => setActiveTab('career')}
        activeOpacity={0.85}
        style={[getGlassButton(darkMode), styles.secondaryCta]}
        accessibilityRole="button"
        accessibilityLabel="Open your political career: party, appointments and retirement"
      >
        <Landmark size={scale(15)} color={SKY} />
        <Text style={[styles.secondaryCtaText, { color: SKY }]}>
          {politics.party
            ? `${findParty(politics.party)?.name ?? politics.party} Party · career & appointments`
            : 'Join a party, take an appointment, plan your exit'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // --- Career tab --------------------------------------------------------
  //
  // Everything a political life is made of that is not the seat itself: the
  // party machine that backs you, the appointed posts that pay when you are out
  // of office, the war chest (and the temptation it represents), and the exit.
  const renderCareer = () => {
    const party = politics.party;
    const partyDef = findParty(party);
    const support = readPartySupport(party, politics.partySupport);
    const endorsed = isEndorsed(party, politics.partySupport);
    const challenged = facesPrimaryChallenge(party, politics.partySupport);

    const appointment = findAppointment(politics.appointment?.id);
    const offers = availableAppointments(gameState);

    const embezzlement = readEmbezzlement(politics.embezzlement);
    const pot = skimmablePot({ campaignFunds: politics.campaignFunds, pacCleanUSD: politics.pac?.cleanUSD });
    const skimAllowance = maxWeeklySkim(pot);
    const skimmedAlready = skimmedThisWeek(embezzlement, gameState.weeksLived);

    const politicalCareer = (gameState.careers ?? []).find((c) => c.id === 'political');
    const weeksInOffice = typeof politicalCareer?.startedWeeksLived === 'number'
      ? Math.max(0, (gameState.weeksLived ?? 0) - politicalCareer.startedWeeksLived)
      : (politicalCareer?.progress ?? 0);
    const retireBlocker = retirementBlocker({
      careerLevel,
      termsServed: politics.electionsWon,
      weeksInOffice,
    });
    const retired = politics.retirement;

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* ── Party ──────────────────────────────────────────────────── */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>{party ? 'Your party' : 'Choose a party'}</SectionTitle>

          {party ? (
            <View style={[getGlassCard(darkMode, 6), styles.lifeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.lifeCardTitle, { color: theme.text }]}>{partyDef?.name ?? party} Party</Text>
              {hasPartyMachine(party) ? (
                <>
                  <Text style={[styles.lifeCardMeta, { color: theme.textSecondary }]}>
                    Standing {support}/100 · {endorsed
                      ? 'endorsed - the machine is behind you'
                      : challenged
                        ? 'the party is shopping for another candidate'
                        : `${ENDORSEMENT_THRESHOLD - support} more for an endorsement`}
                  </Text>
                  <View style={[styles.meterTrack, { backgroundColor: theme.surfaceElevated }]}>
                    <View
                      style={[
                        styles.meterFill,
                        {
                          width: `${support}%`,
                          backgroundColor: endorsed ? accent.success : challenged ? accent.danger : SKY,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.helperText, { color: theme.textMuted }]}>
                    An endorsement moves election odds and pays into your war chest every week. Enacting
                    the platform raises standing; scandals cost it.
                  </Text>
                </>
              ) : (
                <Text style={[styles.lifeCardMeta, { color: theme.textSecondary }]}>
                  No platform to answer to, and nobody to call when you need money.
                </Text>
              )}
            </View>
          ) : null}

          <View style={styles.partyRow}>
            {POLITICAL_PARTIES.map((p) => {
              const isCurrent = party === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleJoinParty(p.id)}
                  disabled={isCurrent}
                  activeOpacity={0.85}
                  style={[getGlassButton(darkMode), styles.partyBtn, isCurrent && { opacity: 0.45 }]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isCurrent, selected: isCurrent }}
                  accessibilityLabel={isCurrent ? `Already in the ${p.name} Party` : `Join the ${p.name} Party`}
                >
                  <Text style={[styles.partyBtnText, { color: theme.text }]}>{p.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {party ? (
            <Text style={[styles.helperText, { color: theme.textMuted }]}>
              Crossing the floor costs public approval - more every time - and drops you to the bottom of
              the new party&apos;s pecking order.
            </Text>
          ) : null}
        </View>

        {/* ── Appointments ───────────────────────────────────────────── */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Appointed positions</SectionTitle>

          {appointment ? (
            <View style={[getGlassCard(darkMode, 6), styles.lifeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.lifeCardTitle, { color: theme.text }]}>{appointment.title}</Text>
              <Text style={[styles.lifeCardMeta, { color: theme.textSecondary }]}>
                {formatMoney(appointment.weeklySalary)}/wk · serving since week {politics.appointment?.startedWeek ?? 0}
              </Text>
              <TouchableOpacity
                onPress={handleResignAppointment}
                activeOpacity={0.85}
                style={[getGlassButton(darkMode), styles.secondaryCta]}
                accessibilityRole="button"
                accessibilityLabel={`Step down as ${appointment.title}`}
              >
                <LogOut size={scale(15)} color={theme.textSecondary} />
                <Text style={[styles.secondaryCtaText, { color: theme.textSecondary }]}>Step down</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {offers.map((offer) => {
            const held = politics.appointment?.id === offer.id;
            if (held) return null;
            return (
              <TouchableOpacity
                key={offer.id}
                onPress={() => handleTakeAppointment(offer.id)}
                disabled={!!offer.blocker}
                activeOpacity={0.85}
                style={[
                  getGlassCard(darkMode, 6),
                  styles.lifeCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  !!offer.blocker && { opacity: 0.55 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!offer.blocker }}
                accessibilityLabel={
                  offer.blocker
                    ? `${offer.title}, unavailable: ${offer.blocker}`
                    : `Accept the position of ${offer.title}, ${formatMoney(offer.weeklySalary)} per week`
                }
              >
                <View style={styles.lifeCardHeader}>
                  <Text style={[styles.lifeCardTitle, { color: theme.text }]}>{offer.title}</Text>
                  <Text style={[styles.lifeCardPay, { color: accent.success }]}>{formatMoney(offer.weeklySalary)}/wk</Text>
                </View>
                <Text style={[styles.lifeCardMeta, { color: theme.textSecondary }]}>{offer.blurb}</Text>
                {offer.blocker ? (
                  <Text style={[styles.helperText, { color: accent.warning }]}>{offer.blocker}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── The war chest ──────────────────────────────────────────── */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>The war chest</SectionTitle>
          <View style={[getGlassCard(darkMode, 6), styles.lifeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.lifeCardHeader}>
              <Text style={[styles.lifeCardTitle, { color: theme.text }]}>{formatMoney(pot)}</Text>
              <Text style={[styles.lifeCardPay, { color: embezzlement.heat > 50 ? accent.danger : theme.textSecondary }]}>
                Exposure {embezzlement.heat}%
              </Text>
            </View>
            <Text style={[styles.lifeCardMeta, { color: theme.textSecondary }]}>
              Campaign funds plus clean PAC money. Nobody audits it every week.
            </Text>
            {embezzlement.totalUSD > 0 ? (
              <Text style={[styles.helperText, { color: theme.textMuted }]}>
                {formatMoney(embezzlement.totalUSD)} diverted so far. Exposure feeds the scandal that ends careers -
                it only cools in a week you keep your hands out.
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => setShowEmbezzle(true)}
              disabled={skimAllowance <= 0 || skimmedAlready}
              activeOpacity={0.85}
              style={[
                getGlassButton(darkMode),
                styles.secondaryCta,
                (skimAllowance <= 0 || skimmedAlready) && { opacity: 0.45 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: skimAllowance <= 0 || skimmedAlready }}
              accessibilityLabel="Divert campaign funds into your personal accounts"
            >
              <Banknote size={scale(15)} color={accent.warning} />
              <Text style={[styles.secondaryCtaText, { color: accent.warning }]}>
                {skimmedAlready
                  ? 'Already moved money this week'
                  : skimAllowance > 0
                    ? `Divert funds (up to ${formatMoney(skimAllowance)} this week)`
                    : 'Not enough in the chest to be worth the risk'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── The exit ───────────────────────────────────────────────── */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Retirement</SectionTitle>
          {retired ? (
            <View style={[getGlassCard(darkMode, 6), styles.lifeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.lifeCardTitle, { color: theme.text }]}>Retired as {retired.title}</Text>
              <Text style={[styles.lifeCardMeta, { color: theme.textSecondary }]}>
                {retired.termsServed} election win{retired.termsServed === 1 ? '' : 's'} ·
                {' '}{formatMoney(retired.weeklyPension)}/wk pension for life
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={handleRetire}
            disabled={!!retireBlocker}
            activeOpacity={0.85}
            style={[getGlassButton(darkMode), styles.secondaryCta, !!retireBlocker && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!retireBlocker }}
            accessibilityLabel="Stand down from office with a pension"
          >
            <ShieldAlert size={scale(15)} color={theme.textSecondary} />
            <Text style={[styles.secondaryCtaText, { color: theme.textSecondary }]}>
              {retireBlocker ?? 'Stand down with a pension'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: theme.textMuted }]}>
            Retiring keeps your title and pays a pension scaled by the office you held, the elections you
            won and how the public saw you on the way out. You can still take appointments afterwards.
          </Text>
        </View>
      </View>
    );
  };

  // --- Policies tab ------------------------------------------------------
  const renderPolicies = () => {
    const enacted = politics.policiesEnacted ?? [];
    const agg = calculatePolicyEffects(enacted);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Recipe B hero - legislative record with aggregate policy effects. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
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
              <AggStat label="One-time cash" value={`${agg.money > 0 ? '+' : ''}${formatMoney(agg.money)}`} theme={theme} />
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
        <TouchableOpacity
          onPress={() => setSubView({ kind: 'hireLobbyist' })}
          activeOpacity={0.85}
          style={[getGlassButton(darkMode), styles.secondaryCta]}
          accessibilityRole="button"
          accessibilityLabel="Hire a lobbyist from the catalog"
        >
          <Handshake size={scale(15)} color={SKY} />
          <Text style={[styles.secondaryCtaText, { color: SKY }]}>Hire a lobbyist</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Alliances</SectionTitle>
        {alliances.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No political alliances formed.</EmptyText>
        ) : (
          alliances.map((a) => <AllyRow key={a.id} ally={a} theme={theme} darkMode={darkMode} />)
        )}
        <TouchableOpacity
          onPress={() => setSubView({ kind: 'formAlliance' })}
          activeOpacity={0.85}
          style={[getGlassButton(darkMode), styles.secondaryCta]}
          accessibilityRole="button"
          accessibilityLabel="Form a political alliance"
        >
          <Users size={scale(15)} color={SKY} />
          <Text style={[styles.secondaryCtaText, { color: SKY }]}>Form an alliance</Text>
        </TouchableOpacity>
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

    // The price the player will actually be charged, from the SAME helper
    // `enactPolicy` prices with - quoting the sticker cost here while charging a
    // discounted one is how a targeted discount stays invisible, which is the
    // defect this whole change is undoing. Now that a matching lobbyist is worth
    // a further 15%, the roster the player hired has to be legible on the screen
    // where they choose a bill.
    const discount = policyDiscountFraction(
      politics.policyInfluence,
      lobbyists.map((l) => l?.id).filter((lid): lid is string => typeof lid === 'string'),
      policy.type,
    );
    const sticker = policy.implementationCost || 0;
    const payable = Math.max(0, Math.round(sticker * (1 - discount)));
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
            Approval impact {policy.approvalImpact > 0 ? '+' : ''}{policy.approvalImpact} · {policy.duration ? `${policy.duration} wks` : 'Permanent'} · Cost {formatMoney(payable)}
          </Text>
          {discount > 0 && (
            <Text style={[styles.cardSubText, { color: accent.success }]}>
              {Math.round(discount * 100)}% off {formatMoney(sticker)} - your influence and lobbyists
            </Text>
          )}
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
              {cat?.specialties && (
                <View style={[styles.typeTag, { backgroundColor: theme.surfaceElevated }]}>
                  <Text style={[styles.typeTagText, { color: theme.textSecondary }]}>
                    {describeSpecialties(cat.specialties)}
                  </Text>
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

  // Hire-lobbyist picker - the full catalog minus already-hired, each with cost,
  // specialty, effect, and affordability-gated Hire. Delegates to hireLobbyist.
  const renderHireLobbyist = () => {
    const hiredIds = lobbyists.map((l) => l.id);
    const available = getAvailableLobbyists(hiredIds);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeadRow}>
            <Handshake size={scale(15)} color={SKY} />
            <Text style={[styles.cardHeadText, { color: theme.text }]}>Hire a lobbyist</Text>
          </View>
          <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
            Lobbyists raise your policy influence, making bills cheaper and easier to pass. Each charges a one-time retainer.
          </Text>
        </View>
        {available.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>You&apos;ve hired every lobbyist in the catalog.</EmptyText>
        ) : (
          available.map((lob) => {
            const affordable = cash >= lob.cost;
            return (
              <View key={lob.id} style={[getGlassCard(darkMode, 6), styles.rosterRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[getGlassIconContainer(darkMode, 38), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
                  <Handshake size={scale(17)} color={SKY} />
                </View>
                <View style={styles.pickerRowText}>
                  <Text style={[styles.rosterName, { color: theme.text }]} numberOfLines={1}>{lob.name}</Text>
                  <Text style={[styles.rosterMeta, { color: SKY }]} numberOfLines={1}>{describeSpecialties(lob.specialties)} · +{lob.influence} influence</Text>
                  <Text style={[styles.cardSubText, { color: theme.textMuted }]} numberOfLines={2}>{lob.description}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleHireLobbyist(lob.id)}
                  disabled={!affordable}
                  activeOpacity={0.85}
                  style={[
                    styles.pickerBtn,
                    affordable
                      ? { backgroundColor: sky(0.16), borderColor: sky(0.3) }
                      : { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Hire ${lob.name} for ${formatMoney(lob.cost)}`}
                  accessibilityState={{ disabled: !affordable }}
                >
                  <Text style={[styles.pickerBtnText, { color: affordable ? SKY : theme.textMuted }]}>{formatMoney(lob.cost)}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    );
  };

  // Form-alliance picker - political blocs the player can court (ALLIANCE_TARGETS),
  // minus any already allied. No cash cost; grants a fixed influence ally.
  const renderFormAlliance = () => {
    const alliedIds = new Set(alliances.map((a) => a.characterId));
    const available = ALLIANCE_TARGETS.filter((t) => !alliedIds.has(t.id));
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={[getGlassCard(darkMode, 6), styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeadRow}>
            <Users size={scale(15)} color={SKY} />
            <Text style={[styles.cardHeadText, { color: theme.text }]}>Form an alliance</Text>
          </View>
          <Text style={[styles.cardSubText, { color: theme.textMuted }]}>
            Allies lend you their influence (+{ALLIANCE_INFLUENCE} each) and a small approval bump. Court a bloc below.
          </Text>
        </View>
        {available.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>You&apos;ve allied with every available bloc.</EmptyText>
        ) : (
          available.map((t) => (
            <View key={t.id} style={[getGlassCard(darkMode, 6), styles.rosterRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[getGlassIconContainer(darkMode, 38), styles.inlineBubble, { backgroundColor: sky(0.15), borderColor: sky(0.3) }]}>
                <Users size={scale(17)} color={SKY} />
              </View>
              <View style={styles.pickerRowText}>
                <Text style={[styles.rosterName, { color: theme.text }]} numberOfLines={1}>{t.name}</Text>
                <Text style={[styles.rosterMeta, { color: SKY }]} numberOfLines={1}>{t.role} · +{ALLIANCE_INFLUENCE} influence</Text>
                <Text style={[styles.cardSubText, { color: theme.textMuted }]} numberOfLines={2}>{t.description}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleFormAlliance(t.id, t.name)}
                activeOpacity={0.85}
                style={[styles.pickerBtn, { backgroundColor: sky(0.16), borderColor: sky(0.3) }]}
                accessibilityRole="button"
                accessibilityLabel={`Form an alliance with ${t.name}`}
              >
                <Text style={[styles.pickerBtnText, { color: SKY }]}>Ally</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderDetail = () => {
    if (!subView) return null;
    if (subView.kind === 'ladder') return renderLadderDetail();
    if (subView.kind === 'policy') return renderPolicyDetail(subView.id);
    if (subView.kind === 'lobbyist') return renderLobbyistDetail(subView.id);
    if (subView.kind === 'hireLobbyist') return renderHireLobbyist();
    if (subView.kind === 'formAlliance') return renderFormAlliance();
    return null;
  };

  const detailTitle =
    subView?.kind === 'ladder' ? 'Career Ladder'
    : subView?.kind === 'policy' ? 'Bill Detail'
    : subView?.kind === 'lobbyist' ? 'Lobbyist'
    : subView?.kind === 'hireLobbyist' ? 'Hire Lobbyist'
    : subView?.kind === 'formAlliance' ? 'Form Alliance'
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
              {activeTab === 'career' && renderCareer()}
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
        // BTC-denominated input: ₿ prefix/presets and a decimal-preserving Max
        // (the default USD mode floored a sub-1 BTC Max to a useless 0).
        currency="btc"
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

      <AmountInputModal
        visible={showEmbezzle}
        title="Divert campaign funds"
        subtitle={
          `Move money out of the war chest and into your own accounts. Auditors notice - every dollar `
          + `raises your exposure, and exposure is what turns into the scandal that ends careers. `
          + `Available this week: ${formatMoney(maxWeeklySkim(skimmablePot({ campaignFunds: politics.campaignFunds, pacCleanUSD: politics.pac?.cleanUSD })))}`
        }
        confirmLabel="Move it"
        maxAmount={maxWeeklySkim(skimmablePot({ campaignFunds: politics.campaignFunds, pacCleanUSD: politics.pac?.cleanUSD }))}
        presets={[5_000, 25_000, 100_000]}
        darkMode={darkMode}
        onClose={() => setShowEmbezzle(false)}
        onConfirm={(amt) => {
          const result = embezzleCampaignFunds(gameState, setGameState, amt);
          if (result.success) queueSave();
          Alert.alert(result.success ? 'Funds moved' : 'Cannot move that', result.message);
          setShowEmbezzle(false);
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

// Approval gauge RING - the signature campaign-HQ metric. Uses the shared
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
          {describeSpecialties(cat?.specialties)} · {formatMoney(lobbyist.cost)}
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
  // Career-tab cards. Full four-sided hairline (Hard Rule #7 - no one-sided
  // decorative accent bars anywhere in the app).
  lifeCard: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  lifeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
  },
  lifeCardTitle: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  lifeCardPay: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lifeCardMeta: { fontSize: responsiveFontSize.sm, lineHeight: responsiveFontSize.lg },
  // The party-standing bar reuses the lobbyist roster's `meterTrack`/`meterFill`
  // further down rather than declaring a second pair at a different height.
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

  // --- Hire-lobbyist / form-alliance picker rows -------------------------
  pickerRowText: { flex: 1, gap: scale(3) },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  pickerBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

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
