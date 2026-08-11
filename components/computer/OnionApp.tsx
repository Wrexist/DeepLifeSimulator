/**
 * OnionApp — Dark Web screen.
 *
 * Terminal DNA (differentiation pass). A full aesthetic break from the shared
 * "eyebrow hero + uniform rows" template while keeping the Slate Glass crash-safe
 * primitives (getGlassCard / getPlatformShadows elevation, the gradient wrapper
 * is intentionally NOT used — the terminal look is flat phosphor, purple only as
 * cursor/accent glints). Everything reads as a monospace console: near-black
 * panels, "> "/"$ " prompts, ASCII dividers/bars, hex-dump wallet block, and every
 * action is a visible bracket-button like [ BUY ].
 *
 * ZERO REMOVAL: every action (buy / start job / run stage / launder / cash out /
 * new identity) and every data readout from the previous version is preserved and
 * re-homed, and MORE existing state is surfaced (vendor directory, per-stage odds,
 * mixer rate table, raid-risk + heat-decay, laundering ledger) via local list→detail
 * sub-views. No new game mechanics.
 *
 * Heat decay, marketplace rotation, laundering settlement, and police events
 * all happen in lib/darkweb/weeklyTick.ts (called from GameActionsContext.nextWeek).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ArrowLeft, ShoppingBag, Target, Wallet, Wrench } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useItemActions } from '@/contexts/game/ItemActionsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  getGlassCard,
  getGlassCategoryTabsContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import { initialGameState } from '@/contexts/game/initialState';
import {
  DarkWebMixerTier,
  DarkWebSkillId,
  DarkWebMarketListing,
  DarkWebVendor,
  DarkWebActiveJob,
  DarkWebLaunderingTx,
} from '@/contexts/game/types';
import { heatBand, heatBandLabel, policeEventProbability, decayHeat } from '@/lib/darkweb/heat';
import { vendorScamProbability } from '@/lib/darkweb/marketplace';

import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import StartJobModal from '@/components/darkweb/StartJobModal';
import LaunderModal from '@/components/darkweb/LaunderModal';
import AmountInputModal from '@/components/banking/AmountInputModal';

import {
  buyMarketListing,
  beginDarkWebJob,
  runJobStage,
  submitMixerTransaction,
  cashOutCleanBtc,
  acquireNewIdentity,
  NEW_IDENTITY_COST_BTC,
  countLaunderingFronts,
} from '@/contexts/game/actions/CrimeActions';
import { JOB_TEMPLATES, stageSuccessProbability } from '@/lib/darkweb/jobs';
import { MIXER_TIERS, effectiveMixerParams } from '@/lib/darkweb/laundering';
import { RAID_SHARE_OF_POLICE_EVENTS } from '@/lib/darkweb/weeklyTick';

// ---------------------------------------------------------------------------
// Terminal design language (local — a deliberate single-look dark console
// surface; the Slate Glass canvas/theme still branches on darkMode behind it,
// and every hairline/divider lives inside a dark panel so light mode has no
// white-on-white artifacts).
// ---------------------------------------------------------------------------

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

const TERM = {
  bg: '#0A0F0B',          // near-black panel
  bgChrome: '#0B120D',    // top bar / tab strip
  bgDeep: '#060907',      // insets / hex-dump wells
  border: 'rgba(34,197,94,0.22)',
  borderDim: 'rgba(34,197,94,0.12)',
  green: '#22C55E',       // phosphor — data / prompts / values
  greenDim: 'rgba(34,197,94,0.66)',
  text: '#CFE3D6',        // soft terminal foreground
  muted: 'rgba(207,227,214,0.55)',
  faint: 'rgba(207,227,214,0.32)',
  purple: '#A855F7',      // identity — cursor / accent glints only
  purpleGlow: 'rgba(168,85,247,0.12)',
} as const;

type BtnTone = 'phosphor' | 'purple' | 'solid' | 'danger' | 'neutral';

const TONE: Record<BtnTone, { fill: string; border: string; text: string }> = {
  phosphor: { fill: 'rgba(34,197,94,0.13)', border: 'rgba(34,197,94,0.50)', text: TERM.green },
  purple: { fill: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.55)', text: TERM.purple },
  solid: { fill: TERM.purple, border: TERM.purple, text: '#FFFFFF' },
  danger: { fill: 'rgba(239,68,68,0.13)', border: 'rgba(239,68,68,0.50)', text: accent.danger },
  neutral: { fill: 'rgba(207,227,214,0.06)', border: 'rgba(207,227,214,0.20)', text: TERM.greenDim },
};

const CATEGORY_LABEL: Record<string, string> = {
  stolenAccounts: 'accounts',
  cardedItems: 'carded',
  fakeIds: 'fake_id',
  hackingTools: 'tools',
  services: 'services',
  data: 'data',
  gear: 'gear',
};

const TIER_META: Record<string, { color: string; glyph: string }> = {
  common: { color: TERM.greenDim, glyph: '·' },
  pro: { color: accent.info, glyph: '+' },
  elite: { color: TERM.purple, glyph: '*' },
};

const MIX_META: Record<string, string> = {
  cheap: accent.warning,
  standard: accent.info,
  premium: TERM.purple,
};

const LAUNDER_STATUS: Record<string, string> = {
  pending: accent.info,
  completed: TERM.green,
  failed: accent.danger,
};

const HISTORY_STATUS: Record<string, string> = {
  completed: TERM.green,
  failed: accent.danger,
  expired: accent.warning,
  'in-progress': accent.info,
};

const STAGE_LABEL: Record<string, string> = {
  recon: 'recon',
  social: 'social',
  exploit: 'exploit',
  exfiltrate: 'exfil',
  fence: 'fence',
};

const SKILL_LABEL: Record<DarkWebSkillId, string> = {
  hacking: 'Hacking',
  social: 'Social Eng',
  opsec: 'OPSEC',
  laundering: 'Laundering',
};

// Heat is a risk indicator — coloured by band (data), never recoloured to the
// purple identity accent. Mirrors HeatGauge's own band map.
const HEAT_BAND_COLOR: Record<string, string> = {
  cold: accent.info,
  warm: accent.warning,
  hot: accent.amber,
  burning: accent.danger,
};

const repColor = (r: number): string => (r >= 60 ? TERM.green : r >= 30 ? accent.warning : accent.danger);

/** Deterministic monospace bar, e.g. asciiBar(0.4) → "████░░░░░░░░". */
function asciiBar(pct: number, width = 12): string {
  const p = Math.max(0, Math.min(1, isFinite(pct) ? pct : 0));
  const filled = Math.round(p * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

// ---------------------------------------------------------------------------
// Terminal primitives
// ---------------------------------------------------------------------------

function AsciiDivider({ color = TERM.border, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.dividerWrap, style]} pointerEvents="none">
      <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.dividerText, { color }]}>
        ────────────────────────────────────────────────────────────────────────
      </Text>
    </View>
  );
}

function TermTitleBar({ title, accentColor = TERM.purple }: { title: string; accentColor?: string }) {
  return (
    <View style={styles.titleBar}>
      <View style={[styles.tdot, { backgroundColor: 'rgba(239,68,68,0.65)' }]} />
      <View style={[styles.tdot, { backgroundColor: 'rgba(245,158,11,0.65)' }]} />
      <View style={[styles.tdot, { backgroundColor: 'rgba(34,197,94,0.65)' }]} />
      <Text style={styles.titleBarText} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.titleCursor, { color: accentColor }]}>▊</Text>
    </View>
  );
}

function PromptRow({
  prompt = '>',
  promptColor = TERM.purple,
  color = TERM.text,
  children,
  style,
}: {
  prompt?: string;
  promptColor?: string;
  color?: string;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[styles.mono, { color }, style]}>
      <Text style={{ color: promptColor }}>{prompt} </Text>
      {children}
    </Text>
  );
}

function BracketButton({
  label,
  onPress,
  tone = 'phosphor',
  disabled = false,
  loud = false,
  full = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: BtnTone;
  disabled?: boolean;
  loud?: boolean;
  full?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONE[tone];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[
        styles.bracketBtn,
        { backgroundColor: t.fill, borderColor: t.border },
        full && styles.bracketBtnFull,
        loud && !disabled ? getPlatformShadows(5, 0.3, 2, 8) : null,
        disabled && styles.bracketBtnDisabled,
        style,
      ]}
    >
      <Text style={[styles.bracketLabel, { color: disabled ? TERM.muted : t.text }]} numberOfLines={1}>
        [ {label} ]
      </Text>
    </TouchableOpacity>
  );
}

function TerminalPanel({
  darkMode,
  children,
  elevation = 6,
  glow = false,
  tone = 'green',
  style,
}: {
  darkMode: boolean;
  children: React.ReactNode;
  elevation?: number;
  glow?: boolean;
  tone?: 'green' | 'purple' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const borderColor =
    tone === 'purple' ? 'rgba(168,85,247,0.30)' : tone === 'danger' ? 'rgba(239,68,68,0.30)' : TERM.border;
  return (
    <View style={[getGlassCard(darkMode, elevation), styles.panel, { backgroundColor: TERM.bg, borderColor }, style]}>
      <View style={styles.panelInner}>
        {glow && <View pointerEvents="none" style={styles.glowBlob} />}
        {children}
      </View>
    </View>
  );
}

function CmdLine({ cmd, count }: { cmd: string; count?: number }) {
  return (
    <Text style={styles.cmdLine} numberOfLines={1}>
      <Text style={{ color: TERM.purple }}>$ </Text>
      <Text style={{ color: TERM.text }}>{cmd}</Text>
      {typeof count === 'number' ? <Text style={{ color: TERM.greenDim }}>{`  [${count}]`}</Text> : null}
    </Text>
  );
}

function TermEmpty({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.emptyLine}>
      <Text style={{ color: TERM.faint }}>{'// '}</Text>
      {children}
    </Text>
  );
}

interface OnionAppProps {
  onBack: () => void;
}

type Tab = 'market' | 'gear' | 'jobs' | 'wallet';

type SubView =
  | { kind: 'listing'; id: string }
  | { kind: 'vendors' }
  | { kind: 'vendor'; id: string }
  | { kind: 'job'; id: string }
  | { kind: 'ledger' }
  | null;

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'market', label: 'Market', icon: ShoppingBag },
  // The gear store. `buyDarkWebItem` has existed and worked since the Onion tab
  // shipped, with ZERO call sites anywhere in `components/` or `app/` — so the
  // 20-item catalogue in `initialState.darkWebItems` was unreachable, and with
  // it 18 of the 19 illegal street jobs that gate on `darkWebRequirements`.
  // Reported as "Crime tools were removed… making only job available Find Lost
  // Items" (BBQ, 2026-08-11), which is exactly what a store with no door looks
  // like from the player's side. This tab is the door.
  { id: 'gear', label: 'Gear', icon: Wrench },
  { id: 'jobs', label: 'Jobs', icon: Target },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

function OnionAppInner({ onBack }: OnionAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  // The gear store's buy path. Already handles the BTC debit, the already-owned
  // guard and the insufficient-funds message — it simply had no caller.
  const { buyDarkWebItem } = useItemActions();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const dw = gameState.darkWeb ?? initialGameState.darkWeb!;

  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [view, setView] = useState<SubView>(null);
  const [showStartJob, setShowStartJob] = useState(false);
  const [showLaunder, setShowLaunder] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);

  const btcOwned = useMemo(
    () => (gameState.cryptos ?? []).find((c) => c.id === 'btc')?.owned ?? 0,
    [gameState.cryptos]
  );

  // New-identity cost preview (read-only mirror of acquireNewIdentity's settlement
  // math): base cost + 80% of walked-away unsecured-loan principal, priced in BTC.
  const idInfo = useMemo(() => {
    const btcPrice = (gameState.cryptos ?? []).find((c) => c.id === 'btc')?.price ?? 0;
    const dropped = (gameState.loans ?? []).filter(
      (l: { type?: string }) => l?.type !== 'mortgage' && l?.type !== 'auto'
    );
    const principal = dropped.reduce(
      (s: number, l: { remaining?: number }) =>
        s + (typeof l?.remaining === 'number' && isFinite(l.remaining) ? Math.max(0, l.remaining) : 0),
      0
    );
    const settle = btcPrice > 0 ? (principal * 0.8) / btcPrice : 0;
    return { principal, settle, dropped: dropped.length, total: NEW_IDENTITY_COST_BTC + settle };
  }, [gameState.cryptos, gameState.loans]);

  const heatColor = HEAT_BAND_COLOR[heatBand(dw.heat ?? 0)] ?? accent.info;

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const goBack = () => {
    if (view) setView(null);
    else onBack();
  };

  const selectTab = (t: Tab) => {
    setView(null);
    setActiveTab(t);
  };

  const pathLabel =
    view?.kind === 'listing'
      ? '~/market/listing'
      : view?.kind === 'vendors'
      ? '~/market/vendors'
      : view?.kind === 'vendor'
      ? '~/market/vendor'
      : view?.kind === 'job'
      ? '~/jobs/op'
      : view?.kind === 'ledger'
      ? '~/wallet/ledger'
      : `~/${activeTab}`;

  // --- Shared action handlers (unchanged behaviour) -----------------------
  const confirmBuy = (listing: DarkWebMarketListing, vendor: DarkWebVendor) => {
    /**
     * Name the scam risk as a NUMBER, at the moment the BTC is committed.
     *
     * The dialog used to show "Vendor rep 15/100" and nothing else. Rep is not a
     * linear scale — `vendorScamProbability` is a sigmoid, so rep 15 means a 95%
     * chance of losing the whole payment and rep 35 means 82%. A bare "15/100"
     * reads as "poor but worth a punt", and because low-rep vendors also price
     * cheapest (`priceMultiplierForReputation`), the game was steering a
     * cash-poor new player straight at its worst odds — then flagging the vendor
     * so their listings vanished for tens of weeks. That compounding is what
     * produced "buyer rep is too slow to gain" and "listings do not shuffle"
     * (BBQ, 2026-08-11).
     *
     * The burn-out itself is deliberate and covered by
     * `__tests__/economy/darkWebVendorRecovery.test.ts`, so it stays. What
     * changes is that the player can now see it coming.
     */
    const scamPct = Math.round(vendorScamProbability(vendor.reputation) * 100);
    const verdict =
      scamPct >= 60 ? 'Very likely a scam.' : scamPct >= 30 ? 'Risky.' : scamPct >= 10 ? 'Fairly safe.' : 'Trusted.';
    Alert.alert(
      'Confirm purchase',
      `Buy "${listing.title}" from ${vendor.handle} for ${listing.costBtc.toFixed(4)} ₿?\n\n` +
        `Vendor rep ${vendor.reputation}/100 · scam risk ${scamPct}% — ${verdict}\n` +
        `A scam costs the full ${listing.costBtc.toFixed(4)} ₿ and delivers nothing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: () => {
            const res = buyMarketListing(gameState, setGameState, listing.id);
            queueSave();
            // Surface the outcome — a scam debits the full cost and grants
            // nothing, which read as a silent BTC drain without this.
            Alert.alert(res.outcome === 'scam' ? 'Scammed!' : res.success ? 'Purchase Complete' : 'Purchase Failed', res.message);
          },
        },
      ]
    );
  };

  const runStage = (job: DarkWebActiveJob) => {
    const res = runJobStage(gameState, setGameState, job.id);
    queueSave();
    if (!res.success) {
      Alert.alert('Cannot Run Stage', res.message);
    } else if (res.outcome === 'completed') {
      Alert.alert('Job Complete', res.message);
    } else if (res.outcome === 'fail') {
      Alert.alert('Stage Failed', res.message);
    }
  };

  const confirmIdentity = () => {
    Alert.alert(
      'Burn this identity?',
      // R3-C5: quote what will actually be spent, including the debt
      // settlement, rather than the base cost the player cannot act on.
      `This is permanent. ${idInfo.total.toFixed(2)} BTC will be spent` +
        (idInfo.settle > 0 ? ` (${NEW_IDENTITY_COST_BTC.toFixed(2)} base + ${idInfo.settle.toFixed(2)} to settle ${idInfo.dropped} loan${idInfo.dropped === 1 ? '' : 's'})` : '') +
        `. ` +
        `Heat resets, buyer rep resets, all loans + credit cards close, ` +
        `credit score drops to 580, and ${(dw.activeJobs ?? []).length} active job${(dw.activeJobs ?? []).length === 1 ? '' : 's'} will be dropped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Burn it',
          style: 'destructive',
          onPress: () => {
            acquireNewIdentity(setGameState);
            queueSave();
          },
        },
      ]
    );
  };

  // --- Reusable terminal rows ---------------------------------------------
  const renderListingRow = (listing: DarkWebMarketListing, vendor: DarkWebVendor) => {
    const affordable = btcOwned >= listing.costBtc;
    const meetsRep = (dw.playerReputation ?? 0) >= listing.minBuyerRep;
    const tm = TIER_META[listing.tier] ?? TIER_META.common;
    const scamPct = vendorScamProbability(vendor.reputation) * 100;
    return (
      <TerminalPanel key={listing.id} darkMode={darkMode}>
        <View style={styles.rowHead}>
          <Text style={[styles.entryTitle, { color: tm.color }]} numberOfLines={1}>
            <Text style={{ color: TERM.faint }}>[{tm.glyph}] </Text>
            {listing.title}
          </Text>
          <Text style={styles.entryPrice} numberOfLines={1}>
            {listing.costBtc.toFixed(4)} ₿
          </Text>
        </View>
        <PromptRow>
          <Text style={{ color: TERM.greenDim }}>vendor </Text>
          <Text style={{ color: TERM.text }}>{vendor.handle}</Text>
          <Text style={{ color: TERM.muted }}>{'  rep '}</Text>
          <Text style={{ color: repColor(vendor.reputation) }}>{vendor.reputation}/100</Text>
        </PromptRow>
        <Text style={styles.monoXs} numberOfLines={1}>
          <Text style={{ color: TERM.muted }}>cat=</Text>
          <Text style={{ color: TERM.greenDim }}>{CATEGORY_LABEL[listing.category] ?? listing.category}</Text>
          <Text style={{ color: TERM.muted }}>{'  heat='}</Text>
          <Text style={{ color: accent.warning }}>+{listing.heatCost}</Text>
          <Text style={{ color: TERM.muted }}>{'  tier='}</Text>
          <Text style={{ color: tm.color }}>{listing.tier}</Text>
          {listing.minBuyerRep > 0 ? (
            <Text style={{ color: meetsRep ? TERM.greenDim : accent.danger }}>{`  rep≥${listing.minBuyerRep}`}</Text>
          ) : null}
        </Text>
        {/* Scam risk shows on EVERY row, not only above 20%. Hiding it on safe
            listings made its absence ambiguous — a player could not tell a low
            risk from an unmeasured one, so the number never became something to
            shop on. It is the single most important figure on this card. */}
        <Text style={styles.monoXs} numberOfLines={1}>
          <Text
            style={{
              color: scamPct >= 60 ? accent.danger : scamPct >= 30 ? accent.warning : TERM.greenDim,
            }}
          >
            {`${scamPct >= 30 ? '! ' : ''}scam_risk=${Math.round(scamPct)}%`}
          </Text>
          {listing.xpReward ? (
            <Text style={{ color: TERM.purple }}>{`  xp+${listing.xpReward.amount} ${listing.xpReward.skill}`}</Text>
          ) : null}
        </Text>
        <View style={styles.actionRow}>
          <BracketButton
            label="BUY"
            tone="phosphor"
            disabled={!affordable || !meetsRep}
            onPress={() => confirmBuy(listing, vendor)}
            accessibilityLabel={`Buy ${listing.title}`}
          />
          <BracketButton
            label="VIEW"
            tone="purple"
            onPress={() => setView({ kind: 'listing', id: listing.id })}
            accessibilityLabel={`View ${listing.title} details`}
          />
          {!affordable ? <Text style={styles.gate}>insufficient_funds</Text> : null}
          {affordable && !meetsRep ? <Text style={styles.gate}>rep_locked</Text> : null}
        </View>
      </TerminalPanel>
    );
  };

  const renderOpRow = (job: DarkWebActiveJob) => {
    const template = JOB_TEMPLATES.find((t) => t.id === job.templateId);
    if (!template) return null;
    const totalStages = template.stages.length;
    const weeksLeft = Math.max(0, job.expiresWeek - gameState.weeksLived);
    const stage = template.stages[job.currentStage];
    const stageLvl = stage ? dw.skills[stage.skill]?.level ?? 1 : 1;
    const stageP = stage ? Math.round(stageSuccessProbability(stageLvl, stage.difficulty) * 100) : 0;
    return (
      <TerminalPanel key={job.id} darkMode={darkMode}>
        <View style={styles.rowHead}>
          <Text style={[styles.entryTitle, { color: TERM.text }]} numberOfLines={1}>
            {template.name}
          </Text>
          <Text style={[styles.entryPrice, { color: TERM.green }]} numberOfLines={1}>
            {template.payoutBtc.toFixed(3)} ₿
          </Text>
        </View>
        <View style={styles.stageWrap}>
          {template.stages.map((st, idx) => {
            const done = job.completedStages.some((cs) => cs.stage === idx && cs.outcome === 'success');
            const cur = idx === job.currentStage;
            const c = done ? TERM.green : cur ? TERM.purple : TERM.faint;
            const g = done ? '[x]' : cur ? '[>]' : '[ ]';
            return (
              <Text key={idx} style={[styles.stageTok, { color: c }]} numberOfLines={1}>
                {g}
                {STAGE_LABEL[st.kind] ?? st.kind}
              </Text>
            );
          })}
        </View>
        <Text style={styles.mono} numberOfLines={1}>
          <Text style={{ color: accent.info }}>{asciiBar(job.currentStage / totalStages, 12)}</Text>
          <Text style={{ color: TERM.muted }}>{`  ${job.currentStage}/${totalStages}  ${weeksLeft}w left`}</Text>
        </Text>
        {stage ? (
          <Text style={styles.monoXs} numberOfLines={1}>
            <Text style={{ color: TERM.muted }}>next=</Text>
            <Text style={{ color: TERM.greenDim }}>{STAGE_LABEL[stage.kind] ?? stage.kind}</Text>
            <Text style={{ color: TERM.muted }}>{'  p='}</Text>
            <Text style={{ color: stageP >= 60 ? TERM.green : stageP >= 35 ? accent.warning : accent.danger }}>
              {stageP}%
            </Text>
            <Text style={{ color: TERM.muted }}>{'  en='}</Text>
            <Text style={{ color: accent.info }}>{stage.energyCost}</Text>
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          {job.currentStage < totalStages ? (
            <BracketButton
              label={`RUN STAGE ${job.currentStage + 1}`}
              tone="phosphor"
              onPress={() => runStage(job)}
              accessibilityLabel={`Run stage ${job.currentStage + 1} of ${template.name}`}
            />
          ) : null}
          <BracketButton
            label="VIEW"
            tone="purple"
            onPress={() => setView({ kind: 'job', id: job.id })}
            accessibilityLabel={`View ${template.name} details`}
          />
        </View>
      </TerminalPanel>
    );
  };

  const renderLaunderRow = (tx: DarkWebLaunderingTx) => {
    const weeksLeft = Math.max(0, tx.readyWeek - gameState.weeksLived);
    const feePct = tx.dirtyAmountBtc > 0 ? (1 - tx.netAmountBtc / tx.dirtyAmountBtc) * 100 : 0;
    return (
      <View key={tx.id} style={styles.launderRow}>
        <Text style={styles.mono} numberOfLines={1}>
          <Text style={{ color: MIX_META[tx.tier] ?? TERM.greenDim }}>{tx.tier.padEnd(9)}</Text>
          <Text style={{ color: LAUNDER_STATUS[tx.status] ?? TERM.muted }}>{tx.status}</Text>
        </Text>
        <Text style={styles.monoXs} numberOfLines={1}>
          <Text style={{ color: TERM.muted }}>in </Text>
          <Text style={{ color: accent.warning }}>{tx.dirtyAmountBtc.toFixed(4)}</Text>
          <Text style={{ color: TERM.muted }}>{' → out '}</Text>
          <Text style={{ color: tx.status === 'failed' ? accent.danger : TERM.green }}>
            {tx.status === 'failed' ? '0.0000' : tx.netAmountBtc.toFixed(4)}
          </Text>
          <Text style={{ color: TERM.muted }}>{`  fee=${feePct.toFixed(1)}%`}</Text>
          {tx.status === 'pending' ? <Text style={{ color: TERM.muted }}>{`  ready ${weeksLeft}w`}</Text> : null}
        </Text>
      </View>
    );
  };

  // --- Tab: MARKET --------------------------------------------------------
  const renderMarket = () => {
    const rep = dw.playerReputation ?? 0;
    const access = rep >= 35 ? 'common+pro+elite' : rep >= 10 ? 'common+pro' : 'common';
    const band = heatBand(dw.heat ?? 0);
    // R3-C8: this printed P(any police event), but the raid — the only branch
    // that jails you — is a sub-roll worth `RAID_SHARE_OF_POLICE_EVENTS` of
    // them. At heat 80+ the label read 40%/wk against a real ~10%, so a player
    // managing heat was working from a number 4x too high.
    const raidRisk = policeEventProbability(dw.heat ?? 0) * RAID_SHARE_OF_POLICE_EVENTS * 100;
    const opsecLvl = dw.skills.opsec?.level ?? 1;
    const weeklyDecay = Math.max(0, Math.round((dw.heat ?? 0) - decayHeat(dw.heat ?? 0, opsecLvl)));
    const listings = dw.listings ?? [];
    const events = dw.recentEvents ?? [];
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <EconomyEventBanner context="darkweb" />

        {/* Console header — buyer standing / balance / vendors (EconomyEventBanner
            is this screen's colour moment, so this panel stays flat). */}
        <TerminalPanel darkMode={darkMode} elevation={12} glow>
          <TermTitleBar title="market@onion" />
          <AsciiDivider />
          <PromptRow prompt="$" promptColor={TERM.greenDim}>
            whoami
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>buyer_rep = </Text>
            <Text style={{ color: TERM.green, fontWeight: '700' }}>{rep}</Text>
            <Text style={{ color: TERM.muted }}>/100  </Text>
            <Text style={{ color: TERM.purple }}>{asciiBar(rep / 100, 10)}</Text>
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>access = </Text>
            <Text style={{ color: TERM.greenDim }}>{access}</Text>
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>balance = </Text>
            <Text style={{ color: TERM.text, fontWeight: '700' }}>{btcOwned.toFixed(4)} ₿</Text>
          </PromptRow>
          <View style={styles.actionRow}>
            <BracketButton
              label="VENDORS"
              tone="purple"
              onPress={() => setView({ kind: 'vendors' })}
              accessibilityLabel="Browse vendor directory"
            />
          </View>
        </TerminalPanel>

        {/* Threat monitor (replaces + densifies HeatGauge). */}
        <TerminalPanel darkMode={darkMode} glow>
          <TermTitleBar title="threat.monitor" accentColor={heatColor} />
          <AsciiDivider />
          <View style={styles.threatRow}>
            <Text style={[styles.threatValue, { color: heatColor }]}>{Math.round(dw.heat ?? 0)}</Text>
            <View style={{ flex: 1, gap: scale(4) }}>
              <Text style={styles.mono} numberOfLines={1}>
                <Text style={{ color: TERM.muted }}>band=</Text>
                <Text style={{ color: heatColor, fontWeight: '700' }}>{heatBandLabel(band)}</Text>
              </Text>
              <Text style={styles.mono} numberOfLines={1}>
                <Text style={{ color: heatColor }}>{asciiBar((dw.heat ?? 0) / 100, 16)}</Text>
              </Text>
            </View>
          </View>
          <AsciiDivider />
          <PromptRow>
            <Text style={{ color: TERM.muted }}>raid_risk = </Text>
            <Text style={{ color: raidRisk >= 18 ? accent.danger : raidRisk > 0 ? accent.warning : TERM.greenDim }}>
              {raidRisk.toFixed(0)}%
            </Text>
            <Text style={{ color: TERM.muted }}> / wk</Text>
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>decay = </Text>
            <Text style={{ color: TERM.green }}>-{weeklyDecay}</Text>
            <Text style={{ color: TERM.muted }}>{` / wk (opsec Lv${opsecLvl})`}</Text>
          </PromptRow>
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="ls -la ./listings" count={listings.length} />
          {listings.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>no listings — vendors rotate stock each week</TermEmpty>
            </TerminalPanel>
          ) : (
            listings.map((listing) => {
              const vendor = (dw.vendors ?? []).find((v) => v.id === listing.vendorId);
              if (!vendor) return null;
              return renderListingRow(listing, vendor);
            })
          )}
        </View>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="tail -f forum.log" />
          {events.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>log empty</TermEmpty>
            </TerminalPanel>
          ) : (
            <TerminalPanel darkMode={darkMode}>
              {events.slice(0, 6).map((evt, i) => (
                <React.Fragment key={evt.id}>
                  {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  <Text style={styles.logLine} numberOfLines={2}>
                    <Text style={{ color: TERM.purple }}>{'> '}</Text>
                    <Text style={{ color: TERM.faint }}>{`w${evt.week} `}</Text>
                    <Text style={{ color: TERM.text }}>{evt.text}</Text>
                  </Text>
                </React.Fragment>
              ))}
            </TerminalPanel>
          )}
        </View>
      </View>
    );
  };

  // --- Tab: GEAR ----------------------------------------------------------
  /**
   * The crime-tool store.
   *
   * Buys straight from `initialState.darkWebItems` through the long-orphaned
   * `buyDarkWebItem`, which already debits `cryptos.btc` and flips `owned` — so
   * this screen adds a door, not a system. `riskReduction` / `rewardBonus` are
   * both live (summed in `ItemActionsContext` when a street job resolves), and
   * are surfaced per row so the ladder reads as a progression rather than a
   * price list.
   */
  const renderGear = () => {
    const catalogue = gameState.darkWebItems ?? [];
    const owned = catalogue.filter((i) => i?.owned);
    // Cheapest-first among what's still unowned: the affordable next step is the
    // one the player is deciding about, and the catalogue's own order is a
    // content order, not a progression.
    const unowned = catalogue
      .filter((i) => i && !i.owned)
      .sort((a, b) => (a.costBtc ?? 0) - (b.costBtc ?? 0));

    const buy = (item: { id: string; name: string; costBtc: number }) => {
      Alert.alert(
        'Confirm purchase',
        `Buy "${item.name}" for ${item.costBtc.toFixed(4)} ₿?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy',
            onPress: () => {
              buyDarkWebItem(item.id);
              queueSave();
            },
          },
        ]
      );
    };

    const renderGearRow = (item: (typeof catalogue)[number]) => {
      const affordable = btcOwned >= (item.costBtc ?? 0);
      return (
        <TerminalPanel key={item.id} darkMode={darkMode}>
          <View style={styles.rowHead}>
            <Text style={[styles.entryTitle, { color: item.owned ? TERM.greenDim : TERM.green }]} numberOfLines={1}>
              <Text style={{ color: TERM.faint }}>[{item.owned ? '✓' : '+'}] </Text>
              {item.name}
            </Text>
            <Text style={styles.entryPrice} numberOfLines={1}>
              {item.owned ? 'owned' : `${(item.costBtc ?? 0).toFixed(4)} ₿`}
            </Text>
          </View>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>{item.description}</Text>
          </PromptRow>
          {item.riskReduction || item.rewardBonus ? (
            <Text style={styles.monoXs} numberOfLines={1}>
              {item.riskReduction ? (
                <Text style={{ color: TERM.green }}>{`risk-${Math.round(item.riskReduction * 100)}%`}</Text>
              ) : null}
              {item.rewardBonus ? (
                <Text style={{ color: TERM.purple }}>
                  {`${item.riskReduction ? '  ' : ''}payout+${Math.round(item.rewardBonus * 100)}%`}
                </Text>
              ) : null}
            </Text>
          ) : null}
          {!item.owned ? (
            <View style={styles.actionRow}>
              <BracketButton
                label="BUY"
                tone="phosphor"
                disabled={!affordable}
                onPress={() => buy(item)}
                accessibilityLabel={`Buy ${item.name} for ${(item.costBtc ?? 0).toFixed(4)} bitcoin`}
              />
              {!affordable ? <Text style={styles.gate}>insufficient_funds</Text> : null}
            </View>
          ) : null}
        </TerminalPanel>
      );
    };

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <TerminalPanel darkMode={darkMode} elevation={12} glow>
          <TermTitleBar title="gear@onion" />
          <AsciiDivider />
          <PromptRow prompt="$" promptColor={TERM.greenDim}>
            ls ~/kit
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>owned = </Text>
            <Text style={{ color: TERM.green, fontWeight: '700' }}>{owned.length}</Text>
            <Text style={{ color: TERM.muted }}>/{catalogue.length}  </Text>
            <Text style={{ color: TERM.purple }}>
              {asciiBar(catalogue.length ? owned.length / catalogue.length : 0, 10)}
            </Text>
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>balance = </Text>
            <Text style={{ color: TERM.text, fontWeight: '700' }}>{btcOwned.toFixed(4)} ₿</Text>
          </PromptRow>
          <AsciiDivider color={TERM.borderDim} />
          <Text style={styles.monoXs}>
            <Text style={{ color: TERM.faint }}>{'// '}</Text>
            <Text style={{ color: TERM.muted }}>
              tools unlock the illegal jobs on the Work tab that list them as requirements
            </Text>
          </Text>
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="./shop --available" count={unowned.length} />
          {unowned.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>full kit — every tool acquired</TermEmpty>
            </TerminalPanel>
          ) : (
            unowned.map(renderGearRow)
          )}
        </View>

        {owned.length > 0 ? (
          <View style={{ gap: responsiveSpacing.sm }}>
            <CmdLine cmd="./shop --owned" count={owned.length} />
            {owned.map(renderGearRow)}
          </View>
        ) : null}
      </View>
    );
  };

  // --- Tab: JOBS ----------------------------------------------------------
  const renderJobs = () => {
    const activeJobs = dw.activeJobs ?? [];
    const history = dw.jobHistory ?? [];
    const energy = Math.round(gameState.stats?.energy ?? 0);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <TerminalPanel darkMode={darkMode} elevation={12} glow tone="purple">
          <TermTitleBar title="jobs@onion" />
          <AsciiDivider />
          <PromptRow>
            <Text style={{ color: TERM.muted }}>ops = </Text>
            <Text style={{ color: TERM.green, fontWeight: '700' }}>{activeJobs.length}</Text>
            <Text style={{ color: TERM.muted }}> running · </Text>
            <Text style={{ color: TERM.greenDim }}>{history.length}</Text>
            <Text style={{ color: TERM.muted }}> archived</Text>
          </PromptRow>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>energy = </Text>
            <Text
              style={{
                color: energy >= 30 ? TERM.green : energy > 0 ? accent.warning : accent.danger,
                fontWeight: '700',
              }}
            >
              {energy}
            </Text>
          </PromptRow>
          <View style={styles.actionRow}>
            <BracketButton
              label="+ START OP"
              tone="purple"
              onPress={() => setShowStartJob(true)}
              accessibilityLabel="Start a job"
            />
          </View>
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="./run --active" count={activeJobs.length} />
          {activeJobs.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>no active operations — start one above</TermEmpty>
            </TerminalPanel>
          ) : (
            activeJobs.map((job) => renderOpRow(job))
          )}
        </View>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="skills --list" />
          <TerminalPanel darkMode={darkMode}>
            {(Object.keys(dw.skills) as DarkWebSkillId[]).map((id, i) => {
              const s = dw.skills[id];
              const pct = Math.max(0, Math.min(1, s.xp / (s.nextLevelXp || 1)));
              return (
                <React.Fragment key={id}>
                  {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  <Text style={styles.mono} numberOfLines={1}>
                    <Text style={{ color: TERM.greenDim }}>{SKILL_LABEL[id].padEnd(11)}</Text>
                    <Text style={{ color: TERM.text }}>{`Lv${String(s.level).padStart(2)} `}</Text>
                    <Text style={{ color: TERM.green }}>{asciiBar(pct, 10)}</Text>
                  </Text>
                  <Text style={styles.monoXs} numberOfLines={1}>
                    <Text style={{ color: TERM.muted }}>{`${Math.round(s.xp)}/${s.nextLevelXp} xp`}</Text>
                  </Text>
                </React.Fragment>
              );
            })}
          </TerminalPanel>
        </View>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="cat ops.history" count={history.length} />
          {history.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>no archived operations yet</TermEmpty>
            </TerminalPanel>
          ) : (
            <TerminalPanel darkMode={darkMode}>
              {history.slice(0, 5).map((j, i) => {
                const tpl = JOB_TEMPLATES.find((t) => t.id === j.templateId);
                const total = tpl?.stages.length ?? 0;
                const okStages = j.completedStages.filter((cs) => cs.outcome === 'success').length;
                return (
                  <React.Fragment key={j.id}>
                    {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                    <Text style={styles.mono} numberOfLines={1}>
                      <Text style={{ color: HISTORY_STATUS[j.status] ?? TERM.muted }}>{'● '}</Text>
                      <Text style={{ color: TERM.text }}>{tpl?.name ?? j.templateId}</Text>
                    </Text>
                    <Text style={styles.monoXs} numberOfLines={1}>
                      <Text style={{ color: HISTORY_STATUS[j.status] ?? TERM.muted }}>{j.status}</Text>
                      <Text style={{ color: TERM.muted }}>{`  w${j.startedWeek}  stages ${okStages}/${total}`}</Text>
                      {tpl ? <Text style={{ color: TERM.greenDim }}>{`  ${tpl.payoutBtc.toFixed(3)}₿`}</Text> : null}
                    </Text>
                  </React.Fragment>
                );
              })}
            </TerminalPanel>
          )}
        </View>
      </View>
    );
  };

  // --- Tab: WALLET --------------------------------------------------------
  const renderWallet = () => {
    const laundering = dw.laundering ?? [];
    const pendingCount = laundering.filter((t) => t.status === 'pending').length;
    const launderLvl = dw.skills.laundering?.level ?? 1;
    const fronts = countLaunderingFronts(gameState);
    // R3-C5: gate on the TOTAL, not the base cost. `acquireNewIdentity`
    // charges `NEW_IDENTITY_COST_BTC + (dischargedUnsecuredPrincipal * 0.8) /
    // btcPrice` and returns `prev` (log-only) when the player cannot cover it —
    // and it returns void, so nothing surfaced the refusal. With the button
    // gated on the base cost alone, a player carrying student debt (typed
    // 'personal', so it counts as discharged principal) tapped "Burn it" and
    // nothing at all happened: no alert, no state change. `idInfo.total` is
    // computed a few hundred lines up and already rendered in the panel.
    const canId = btcOwned >= idInfo.total;

    const hexRow = (offset: string, label: string, value: string, tag: string, valueColor: string) => (
      <Text key={offset} style={styles.hexLine} numberOfLines={1}>
        <Text style={{ color: TERM.faint }}>{offset}  </Text>
        <Text style={{ color: TERM.greenDim }}>{label.padEnd(7)}</Text>
        <Text style={{ color: valueColor, fontWeight: '700' }}>{value.padStart(12)}</Text>
        <Text style={{ color: TERM.muted }}>{'  '}{tag}</Text>
      </Text>
    );

    const queue = laundering
      .slice()
      .sort((a, b) => b.startedWeek - a.startedWeek)
      .slice(0, 10);

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Hex-dump wallet block. */}
        <TerminalPanel darkMode={darkMode} elevation={12} glow tone="purple">
          <TermTitleBar title="wallet@onion" />
          <AsciiDivider />
          <View style={styles.hexBlock}>
            {hexRow('0x00', 'DIRTY', `${(dw.dirtyBtc ?? 0).toFixed(4)} ₿`, 'unlaundered', accent.warning)}
            {hexRow('0x01', 'CLEAN', `${(dw.cleanBtc ?? 0).toFixed(4)} ₿`, 'spendable', TERM.green)}
            {hexRow('0x02', 'WALLET', `${btcOwned.toFixed(4)} ₿`, 'holdings', TERM.text)}
            {hexRow('0x03', 'MIXQ', String(pendingCount), 'in_transit', TERM.purple)}
          </View>
          <View style={styles.actionRow}>
            <BracketButton
              label="LAUNDER"
              tone="phosphor"
              disabled={(dw.dirtyBtc ?? 0) <= 0}
              onPress={() => setShowLaunder(true)}
              accessibilityLabel="Launder dirty BTC"
            />
            <BracketButton
              label="CASH OUT"
              tone="phosphor"
              disabled={(dw.cleanBtc ?? 0) <= 0}
              onPress={() => setShowCashOut(true)}
              accessibilityLabel="Cash out clean BTC"
            />
            <BracketButton
              label="LEDGER"
              tone="purple"
              onPress={() => setView({ kind: 'ledger' })}
              accessibilityLabel="View laundering ledger"
            />
          </View>
        </TerminalPanel>

        {/* Mixer rate table (surfaces MIXER_TIERS + effective params + fronts). */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="mixer --rates" />
          <TerminalPanel darkMode={darkMode}>
            {(Object.keys(MIXER_TIERS) as DarkWebMixerTier[]).map((t, i) => {
              const base = MIXER_TIERS[t];
              const eff = effectiveMixerParams(t, launderLvl, fronts);
              return (
                <React.Fragment key={t}>
                  {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  <Text style={styles.monoXs} numberOfLines={1}>
                    <Text style={{ color: MIX_META[t] ?? TERM.greenDim }}>{t.padEnd(9)}</Text>
                    <Text style={{ color: TERM.muted }}>fee </Text>
                    <Text style={{ color: TERM.text }}>{(base.feePct * 100).toFixed(0)}%</Text>
                    <Text style={{ color: TERM.muted }}>→</Text>
                    <Text style={{ color: TERM.green }}>{(eff.feePct * 100).toFixed(1)}%</Text>
                    <Text style={{ color: TERM.muted }}>{'  delay '}</Text>
                    <Text style={{ color: TERM.text }}>{base.delayWeeks}w</Text>
                    <Text style={{ color: TERM.muted }}>→</Text>
                    <Text style={{ color: TERM.green }}>{eff.delayWeeks}w</Text>
                    <Text style={{ color: TERM.muted }}>{'  fail '}</Text>
                    <Text style={{ color: base.failProbability > 0.1 ? accent.danger : accent.warning }}>
                      {(base.failProbability * 100).toFixed(1)}%
                    </Text>
                  </Text>
                </React.Fragment>
              );
            })}
            <AsciiDivider color={TERM.borderDim} />
            <PromptRow>
              <Text style={{ color: TERM.greenDim }}>launder</Text>
              <Text style={{ color: TERM.text }}> Lv{launderLvl}</Text>
              <Text style={{ color: TERM.muted }}>{'  fronts='}</Text>
              <Text style={{ color: fronts > 0 ? TERM.green : TERM.muted }}>{fronts}</Text>
              <Text style={{ color: TERM.muted }}>/4</Text>
            </PromptRow>
          </TerminalPanel>
        </View>

        {/* New identity — the one loud CTA of this view. */}
        <TerminalPanel darkMode={darkMode} tone="danger">
          <TermTitleBar title="identity.burn" accentColor={accent.danger} />
          <AsciiDivider color="rgba(239,68,68,0.25)" />
          <Text style={styles.mono}>
            <Text style={{ color: accent.danger }}>! </Text>
            <Text style={{ color: TERM.text }}>Burn this persona. The trade-off is permanent.</Text>
          </Text>
          <View style={styles.hexBlock}>
            <Text style={styles.hexLine} numberOfLines={1}>
              <Text style={{ color: TERM.muted }}>{'cost_base   '}</Text>
              <Text style={{ color: TERM.text }}>{NEW_IDENTITY_COST_BTC.toFixed(2)} ₿</Text>
            </Text>
            {idInfo.principal > 0 ? (
              <Text style={styles.hexLine} numberOfLines={1}>
                <Text style={{ color: TERM.muted }}>{'debt_settle '}</Text>
                <Text style={{ color: accent.warning }}>{`≈ ${idInfo.settle.toFixed(4)} ₿ (${idInfo.dropped} loans)`}</Text>
              </Text>
            ) : null}
            <Text style={styles.hexLine} numberOfLines={1}>
              <Text style={{ color: TERM.muted }}>{'total_est   '}</Text>
              <Text style={{ color: btcOwned >= idInfo.total ? TERM.green : accent.danger, fontWeight: '700' }}>
                {idInfo.total.toFixed(4)} ₿
              </Text>
            </Text>
            <Text style={styles.hexLine} numberOfLines={1}>
              <Text style={{ color: TERM.muted }}>{'resets      '}</Text>
              <Text style={{ color: TERM.greenDim }}>heat→0 rep→0 credit→580</Text>
            </Text>
            <Text style={styles.hexLine} numberOfLines={1}>
              <Text style={{ color: TERM.muted }}>{'jobs_drop   '}</Text>
              <Text style={{ color: accent.warning }}>{(dw.activeJobs ?? []).length}</Text>
            </Text>
          </View>
          <BracketButton
            label={canId ? 'ACQUIRE NEW IDENTITY' : `NEED ${idInfo.total.toFixed(2)} BTC`}
            tone="solid"
            loud
            full
            disabled={!canId}
            onPress={confirmIdentity}
            accessibilityLabel="Acquire new identity"
          />
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="jobs mixer" count={laundering.length} />
          {queue.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>mixer idle — submit dirty BTC to convert it to clean BTC</TermEmpty>
            </TerminalPanel>
          ) : (
            <TerminalPanel darkMode={darkMode}>
              {queue.map((tx, i) => (
                <React.Fragment key={tx.id}>
                  {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  {renderLaunderRow(tx)}
                </React.Fragment>
              ))}
            </TerminalPanel>
          )}
        </View>
      </View>
    );
  };

  // --- Sub-view: listing detail ------------------------------------------
  const renderListingDetail = (id: string) => {
    const listing = (dw.listings ?? []).find((l) => l.id === id);
    const vendor = listing ? (dw.vendors ?? []).find((v) => v.id === listing.vendorId) : undefined;
    if (!listing || !vendor) {
      return (
        <TerminalPanel darkMode={darkMode}>
          <TermEmpty>listing expired or unavailable</TermEmpty>
        </TerminalPanel>
      );
    }
    const affordable = btcOwned >= listing.costBtc;
    const meetsRep = (dw.playerReputation ?? 0) >= listing.minBuyerRep;
    const tm = TIER_META[listing.tier] ?? TIER_META.common;
    const scamPct = vendorScamProbability(vendor.reputation) * 100;
    const expiresIn = Math.max(0, listing.postedWeek + listing.lifetimeWeeks - gameState.weeksLived);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={styles.actionRow}>
          <BracketButton label="../ back" tone="neutral" onPress={() => setView(null)} accessibilityLabel="Back to market" />
        </View>
        <TerminalPanel darkMode={darkMode} elevation={12} glow>
          <TermTitleBar title={`listing://${listing.id}`} accentColor={tm.color} />
          <AsciiDivider />
          <Text style={[styles.detailTitle, { color: tm.color }]}>
            <Text style={{ color: TERM.faint }}>[{tm.glyph}] </Text>
            {listing.title}
          </Text>
          <Text style={styles.mono}>
            <Text style={{ color: TERM.text }}>{listing.description}</Text>
          </Text>
          <AsciiDivider />
          <View style={styles.hexBlock}>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'price   '}</Text>
              <Text style={{ color: TERM.text, fontWeight: '700' }}>{listing.costBtc.toFixed(4)} ₿</Text>
            </Text>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'tier    '}</Text>
              <Text style={{ color: tm.color }}>{listing.tier}</Text>
              <Text style={{ color: TERM.muted }}>{'   cat '}</Text>
              <Text style={{ color: TERM.greenDim }}>{CATEGORY_LABEL[listing.category] ?? listing.category}</Text>
            </Text>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'heat    '}</Text>
              <Text style={{ color: accent.warning }}>+{listing.heatCost}</Text>
              <Text style={{ color: TERM.muted }}>{'   rep_gate '}</Text>
              <Text style={{ color: meetsRep ? TERM.green : accent.danger }}>{listing.minBuyerRep}</Text>
            </Text>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'expires '}</Text>
              <Text style={{ color: expiresIn <= 1 ? accent.danger : TERM.text }}>{expiresIn}w</Text>
              {listing.xpReward ? (
                <Text style={{ color: TERM.purple }}>{`   xp+${listing.xpReward.amount} ${listing.xpReward.skill}`}</Text>
              ) : null}
            </Text>
          </View>
          <AsciiDivider />
          <PromptRow>
            <Text style={{ color: TERM.greenDim }}>vendor </Text>
            <Text style={{ color: TERM.text }}>{vendor.handle}</Text>
            {vendor.flaggedScam ? <Text style={{ color: accent.danger }}>{'  [SCAM]'}</Text> : null}
          </PromptRow>
          <Text style={styles.monoXs} numberOfLines={1}>
            <Text style={{ color: TERM.muted }}>rep </Text>
            <Text style={{ color: repColor(vendor.reputation) }}>{vendor.reputation}/100 </Text>
            <Text style={{ color: repColor(vendor.reputation) }}>{asciiBar(vendor.reputation / 100, 10)}</Text>
          </Text>
          <Text style={styles.monoXs} numberOfLines={1}>
            <Text style={{ color: TERM.muted }}>reviews=</Text>
            <Text style={{ color: TERM.greenDim }}>{vendor.reviewCount}</Text>
            <Text style={{ color: TERM.muted }}>{'  scam_risk='}</Text>
            <Text style={{ color: scamPct > 20 ? accent.danger : TERM.greenDim }}>{Math.round(scamPct)}%</Text>
          </Text>
          <AsciiDivider />
          <BracketButton
            label={affordable && meetsRep ? 'BUY' : !affordable ? 'INSUFFICIENT FUNDS' : 'REP LOCKED'}
            tone="phosphor"
            loud
            full
            disabled={!affordable || !meetsRep}
            onPress={() => confirmBuy(listing, vendor)}
            accessibilityLabel={`Buy ${listing.title}`}
          />
          <BracketButton
            label="VENDOR PROFILE"
            tone="purple"
            full
            onPress={() => setView({ kind: 'vendor', id: vendor.id })}
            accessibilityLabel={`View vendor ${vendor.handle}`}
          />
        </TerminalPanel>
      </View>
    );
  };

  // --- Sub-view: vendor directory ----------------------------------------
  const renderVendors = () => {
    const vendors = (dw.vendors ?? []).slice().sort((a, b) => b.reputation - a.reputation);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={styles.actionRow}>
          <BracketButton label="../ back" tone="neutral" onPress={() => setView(null)} accessibilityLabel="Back to market" />
        </View>
        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="cat vendors.db" count={vendors.length} />
          {vendors.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>no vendors online</TermEmpty>
            </TerminalPanel>
          ) : (
            vendors.map((vendor) => {
              const listingCount = (dw.listings ?? []).filter((l) => l.vendorId === vendor.id).length;
              const scamPct = vendorScamProbability(vendor.reputation) * 100;
              return (
                <TerminalPanel key={vendor.id} darkMode={darkMode}>
                  <View style={styles.rowHead}>
                    <Text style={[styles.entryTitle, { color: TERM.green }]} numberOfLines={1}>
                      {vendor.handle}
                    </Text>
                    {vendor.flaggedScam ? (
                      <Text style={[styles.scamTag, { color: accent.danger }]}>[SCAM]</Text>
                    ) : null}
                  </View>
                  <Text style={styles.mono} numberOfLines={1}>
                    <Text style={{ color: TERM.muted }}>rep </Text>
                    <Text style={{ color: repColor(vendor.reputation) }}>{`${vendor.reputation}/100 `}</Text>
                    <Text style={{ color: repColor(vendor.reputation) }}>{asciiBar(vendor.reputation / 100, 10)}</Text>
                  </Text>
                  <Text style={styles.monoXs} numberOfLines={1}>
                    <Text style={{ color: TERM.muted }}>reviews=</Text>
                    <Text style={{ color: TERM.greenDim }}>{vendor.reviewCount}</Text>
                    <Text style={{ color: TERM.muted }}>{'  scam='}</Text>
                    <Text style={{ color: scamPct > 20 ? accent.danger : TERM.greenDim }}>{Math.round(scamPct)}%</Text>
                    <Text style={{ color: TERM.muted }}>{'  listings='}</Text>
                    <Text style={{ color: TERM.text }}>{listingCount}</Text>
                  </Text>
                  <View style={styles.actionRow}>
                    <BracketButton
                      label="VIEW"
                      tone="purple"
                      onPress={() => setView({ kind: 'vendor', id: vendor.id })}
                      accessibilityLabel={`View vendor ${vendor.handle}`}
                    />
                  </View>
                </TerminalPanel>
              );
            })
          )}
        </View>
      </View>
    );
  };

  // --- Sub-view: vendor detail -------------------------------------------
  const renderVendorDetail = (id: string) => {
    const vendor = (dw.vendors ?? []).find((v) => v.id === id);
    if (!vendor) {
      return (
        <TerminalPanel darkMode={darkMode}>
          <TermEmpty>vendor not found</TermEmpty>
        </TerminalPanel>
      );
    }
    const scamPct = vendorScamProbability(vendor.reputation) * 100;
    const vendorListings = (dw.listings ?? []).filter((l) => l.vendorId === vendor.id);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={styles.actionRow}>
          <BracketButton
            label="../ back"
            tone="neutral"
            onPress={() => setView({ kind: 'vendors' })}
            accessibilityLabel="Back to vendors"
          />
        </View>
        <TerminalPanel darkMode={darkMode} elevation={12} glow>
          <TermTitleBar title={`vendor://${vendor.handle}`} />
          <AsciiDivider />
          <Text style={[styles.detailTitle, { color: TERM.green }]}>
            {vendor.handle}
            {vendor.flaggedScam ? <Text style={{ color: accent.danger }}>{'  [SCAM]'}</Text> : null}
          </Text>
          <Text style={styles.mono} numberOfLines={1}>
            <Text style={{ color: TERM.muted }}>rep </Text>
            <Text style={{ color: repColor(vendor.reputation) }}>{`${vendor.reputation}/100 `}</Text>
            <Text style={{ color: repColor(vendor.reputation) }}>{asciiBar(vendor.reputation / 100, 14)}</Text>
          </Text>
          <PromptRow>
            <Text style={{ color: TERM.muted }}>reviews = </Text>
            <Text style={{ color: TERM.greenDim }}>{vendor.reviewCount}</Text>
            <Text style={{ color: TERM.muted }}>{'   scam_risk = '}</Text>
            <Text style={{ color: scamPct > 20 ? accent.danger : TERM.greenDim }}>{Math.round(scamPct)}%</Text>
          </PromptRow>
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd={`ls ./${vendor.handle}`} count={vendorListings.length} />
          {vendorListings.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>no active listings from this vendor</TermEmpty>
            </TerminalPanel>
          ) : (
            vendorListings.map((listing) => renderListingRow(listing, vendor))
          )}
        </View>
      </View>
    );
  };

  // --- Sub-view: job detail ----------------------------------------------
  const renderJobDetail = (id: string) => {
    const job = (dw.activeJobs ?? []).find((j) => j.id === id);
    const template = job ? JOB_TEMPLATES.find((t) => t.id === job.templateId) : undefined;
    if (!job || !template) {
      return (
        <TerminalPanel darkMode={darkMode}>
          <TermEmpty>operation no longer active</TermEmpty>
        </TerminalPanel>
      );
    }
    const totalStages = template.stages.length;
    const weeksLeft = Math.max(0, job.expiresWeek - gameState.weeksLived);
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={styles.actionRow}>
          <BracketButton label="../ back" tone="neutral" onPress={() => setView(null)} accessibilityLabel="Back to jobs" />
        </View>
        <TerminalPanel darkMode={darkMode} elevation={12} glow tone="purple">
          <TermTitleBar title={`op://${template.id}`} />
          <AsciiDivider />
          <Text style={[styles.detailTitle, { color: TERM.text }]}>{template.name}</Text>
          <Text style={styles.mono}>
            <Text style={{ color: TERM.text }}>{template.description}</Text>
          </Text>
          <View style={styles.hexBlock}>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'payout   '}</Text>
              <Text style={{ color: TERM.green, fontWeight: '700' }}>{template.payoutBtc.toFixed(3)} ₿</Text>
            </Text>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'progress '}</Text>
              <Text style={{ color: accent.info }}>{job.currentStage}/{totalStages}</Text>
              <Text style={{ color: TERM.muted }}>{'   expires '}</Text>
              <Text style={{ color: weeksLeft <= 1 ? accent.danger : TERM.text }}>{weeksLeft}w</Text>
            </Text>
          </View>
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="stages --plan" count={totalStages} />
          <TerminalPanel darkMode={darkMode}>
            {template.stages.map((st, idx) => {
              const done = job.completedStages.some((cs) => cs.stage === idx && cs.outcome === 'success');
              const cur = idx === job.currentStage;
              const lvl = dw.skills[st.skill]?.level ?? 1;
              const p = Math.round(stageSuccessProbability(lvl, st.difficulty) * 100);
              const glyph = done ? '[x]' : cur ? '[>]' : '[ ]';
              const glyphColor = done ? TERM.green : cur ? TERM.purple : TERM.faint;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  <Text style={styles.mono} numberOfLines={1}>
                    <Text style={{ color: glyphColor }}>{glyph} </Text>
                    <Text style={{ color: done ? TERM.greenDim : TERM.text }}>{`#${idx + 1} ${STAGE_LABEL[st.kind] ?? st.kind}`}</Text>
                  </Text>
                  <Text style={styles.monoXs} numberOfLines={1}>
                    <Text style={{ color: TERM.muted }}>skill=</Text>
                    <Text style={{ color: TERM.greenDim }}>{`${st.skill} Lv${lvl}`}</Text>
                    <Text style={{ color: TERM.muted }}>{'  diff='}</Text>
                    <Text style={{ color: TERM.text }}>{st.difficulty}</Text>
                    <Text style={{ color: TERM.muted }}>{'  p='}</Text>
                    <Text style={{ color: p >= 60 ? TERM.green : p >= 35 ? accent.warning : accent.danger }}>{p}%</Text>
                    <Text style={{ color: TERM.muted }}>{'  en='}</Text>
                    <Text style={{ color: accent.info }}>{st.energyCost}</Text>
                    <Text style={{ color: TERM.muted }}>{'  heat+'}</Text>
                    <Text style={{ color: accent.warning }}>{st.heatOnFail}</Text>
                  </Text>
                </React.Fragment>
              );
            })}
          </TerminalPanel>
        </View>

        {job.completedStages.length > 0 ? (
          <View style={{ gap: responsiveSpacing.sm }}>
            <CmdLine cmd="tail attempts.log" count={job.completedStages.length} />
            <TerminalPanel darkMode={darkMode}>
              {job.completedStages.map((cs, i) => (
                <React.Fragment key={`${cs.stage}-${cs.week}-${i}`}>
                  {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  <Text style={styles.monoXs} numberOfLines={1}>
                    <Text style={{ color: TERM.purple }}>{'> '}</Text>
                    <Text style={{ color: TERM.faint }}>{`w${cs.week} `}</Text>
                    <Text style={{ color: TERM.greenDim }}>{`stage#${cs.stage + 1} `}</Text>
                    <Text style={{ color: cs.outcome === 'success' ? TERM.green : accent.danger }}>{cs.outcome}</Text>
                  </Text>
                </React.Fragment>
              ))}
            </TerminalPanel>
          </View>
        ) : null}

        {job.currentStage < totalStages ? (
          <BracketButton
            label={`RUN STAGE ${job.currentStage + 1}`}
            tone="phosphor"
            loud
            full
            onPress={() => runStage(job)}
            accessibilityLabel={`Run stage ${job.currentStage + 1} of ${template.name}`}
          />
        ) : null}
      </View>
    );
  };

  // --- Sub-view: laundering ledger ---------------------------------------
  const renderLedger = () => {
    const all = (dw.laundering ?? []).slice().sort((a, b) => b.startedWeek - a.startedWeek);
    const totalIn = all.reduce((s, t) => s + t.dirtyAmountBtc, 0);
    const totalOut = all.reduce((s, t) => s + (t.status === 'failed' ? 0 : t.netAmountBtc), 0);
    const failed = all.filter((t) => t.status === 'failed').length;
    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        <View style={styles.actionRow}>
          <BracketButton label="../ back" tone="neutral" onPress={() => setView(null)} accessibilityLabel="Back to wallet" />
        </View>
        <TerminalPanel darkMode={darkMode} elevation={12} glow>
          <TermTitleBar title="ledger.full" />
          <AsciiDivider />
          <View style={styles.hexBlock}>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'total_in  '}</Text>
              <Text style={{ color: accent.warning, fontWeight: '700' }}>{totalIn.toFixed(4)} ₿</Text>
            </Text>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'total_out '}</Text>
              <Text style={{ color: TERM.green, fontWeight: '700' }}>{totalOut.toFixed(4)} ₿</Text>
            </Text>
            <Text style={styles.hexLine}>
              <Text style={{ color: TERM.muted }}>{'runs      '}</Text>
              <Text style={{ color: TERM.text }}>{all.length}</Text>
              <Text style={{ color: TERM.muted }}>{'   failed '}</Text>
              <Text style={{ color: failed > 0 ? accent.danger : TERM.greenDim }}>{failed}</Text>
            </Text>
          </View>
        </TerminalPanel>

        <View style={{ gap: responsiveSpacing.sm }}>
          <CmdLine cmd="cat mixer.ledger" count={all.length} />
          {all.length === 0 ? (
            <TerminalPanel darkMode={darkMode}>
              <TermEmpty>ledger empty</TermEmpty>
            </TerminalPanel>
          ) : (
            <TerminalPanel darkMode={darkMode}>
              {all.map((tx, i) => (
                <React.Fragment key={tx.id}>
                  {i > 0 ? <AsciiDivider color={TERM.borderDim} /> : null}
                  {renderLaunderRow(tx)}
                </React.Fragment>
              ))}
            </TerminalPanel>
          )}
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (view?.kind === 'listing') return renderListingDetail(view.id);
    if (view?.kind === 'vendors') return renderVendors();
    if (view?.kind === 'vendor') return renderVendorDetail(view.id);
    if (view?.kind === 'job') return renderJobDetail(view.id);
    if (view?.kind === 'ledger') return renderLedger();
    if (activeTab === 'market') return renderMarket();
    if (activeTab === 'gear') return renderGear();
    if (activeTab === 'jobs') return renderJobs();
    return renderWallet();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      {/* Terminal window chrome — renders unconditionally; back is always top-left. */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={TERM.text} />
        </TouchableOpacity>
        <Text style={styles.appTitle} numberOfLines={1}>
          <Text style={{ color: TERM.green }}>onion</Text>
          <Text style={{ color: TERM.purple }}>@</Text>
          <Text style={{ color: TERM.greenDim }}>darknet</Text>
          <Text style={{ color: TERM.muted }}>:{pathLabel}</Text>
          <Text style={{ color: TERM.purple }}>▊</Text>
        </Text>
        <View style={[styles.heatToken, { borderColor: heatColor + '66', backgroundColor: heatColor + '1F' }]}>
          <Text style={[styles.heatTokenText, { color: heatColor }]}>HEAT {Math.round(dw.heat ?? 0)}</Text>
        </View>
      </View>

      {/* Command tabs — hidden inside detail sub-views (full-page). */}
      {view === null && (
        <View style={[getGlassCategoryTabsContainer(darkMode), styles.tabBar, { backgroundColor: TERM.bg, borderColor: TERM.border }]}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => selectTab(t.id)}
                style={[
                  styles.tab,
                  { borderColor: active ? 'rgba(168,85,247,0.45)' : 'transparent' },
                  active && { backgroundColor: 'rgba(168,85,247,0.16)' },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
              >
                <Icon size={scale(15)} color={active ? TERM.purple : TERM.greenDim} />
                <Text style={[styles.tabText, { color: active ? TERM.purple : TERM.greenDim }]}>{t.label.toLowerCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        // Clear the tab strip / floating chrome — a short padding left the bottom
        // buttons (Run Stage, cash-out) untappable underneath it.
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {renderBody()}
      </ScrollView>

      <StartJobModal
        visible={showStartJob}
        darkWeb={dw}
        darkMode={darkMode}
        onClose={() => setShowStartJob(false)}
        onStart={(templateId) => {
          beginDarkWebJob(setGameState, templateId);
          queueSave();
          setShowStartJob(false);
        }}
      />

      <LaunderModal
        visible={showLaunder}
        dirtyBtc={dw.dirtyBtc ?? 0}
        launderingSkillLevel={dw.skills.laundering?.level ?? 1}
        frontCount={countLaunderingFronts(gameState)}
        darkMode={darkMode}
        onClose={() => setShowLaunder(false)}
        onSubmit={(tier: DarkWebMixerTier, amountBtc) => {
          submitMixerTransaction(setGameState, tier, amountBtc);
          queueSave();
          setShowLaunder(false);
        }}
      />

      {/* `?? 0` guards: a partial darkWeb save can lack cleanBtc/dirtyBtc, and
          this modal is always mounted — an unguarded .toFixed threw in render. */}
      <AmountInputModal
        visible={showCashOut}
        title="Cash out clean BTC"
        subtitle={`Clean wallet: ${(dw.cleanBtc ?? 0).toFixed(4)} ₿. Moves into your regular BTC holdings.`}
        confirmLabel="Cash Out"
        maxAmount={dw.cleanBtc ?? 0}
        currency="btc"
        presets={[0.1, 0.5, 1]}
        darkMode={darkMode}
        onClose={() => setShowCashOut(false)}
        onConfirm={(amt) => {
          cashOutCleanBtc(setGameState, amt);
          queueSave();
          setShowCashOut(false);
        }}
      />
    </View>
  );
}

export default function OnionApp(props: OnionAppProps) {
  return (
    <ErrorBoundary>
      <OnionAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Terminal window title bar — dark chrome in both modes (a deliberate single-look
  // console surface). The canvas behind still branches on darkMode.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
    backgroundColor: TERM.bgChrome,
    borderBottomWidth: 1,
    borderBottomColor: TERM.border,
  },
  backBtn: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { flex: 1, fontFamily: MONO, fontSize: responsiveFontSize.md, fontWeight: '700' },
  heatToken: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.sm,
    borderWidth: 1,
  },
  heatTokenText: { fontFamily: MONO, fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    borderWidth: 1,
  },
  tabText: { fontFamily: MONO, fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // Panels
  panel: {
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
  },
  panelInner: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  glowBlob: {
    position: 'absolute',
    top: -scale(40),
    right: -scale(30),
    width: scale(130),
    height: scale(130),
    borderRadius: scale(65),
    backgroundColor: TERM.purpleGlow,
  },

  // Title bar
  titleBar: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
  tdot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
  titleBarText: { flex: 1, fontFamily: MONO, fontSize: responsiveFontSize.xs, color: TERM.greenDim, letterSpacing: 0.3, marginLeft: scale(4) },
  titleCursor: { fontFamily: MONO, fontSize: responsiveFontSize.sm },

  // Dividers
  dividerWrap: { overflow: 'hidden', alignSelf: 'stretch' },
  dividerText: { fontFamily: MONO, fontSize: responsiveFontSize.xs, lineHeight: scale(10) },

  // Mono text
  mono: { fontFamily: MONO, fontSize: responsiveFontSize.sm, lineHeight: scale(18), color: TERM.text },
  monoXs: { fontFamily: MONO, fontSize: responsiveFontSize.xs, lineHeight: scale(15), color: TERM.muted },
  cmdLine: { fontFamily: MONO, fontSize: responsiveFontSize.sm, fontWeight: '700', paddingHorizontal: scale(2) },
  emptyLine: { fontFamily: MONO, fontSize: responsiveFontSize.xs, color: TERM.muted },
  logLine: { fontFamily: MONO, fontSize: responsiveFontSize.xs, lineHeight: scale(16) },

  // Entry rows
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: responsiveSpacing.sm },
  entryTitle: { flex: 1, fontFamily: MONO, fontSize: responsiveFontSize.md, fontWeight: '700' },
  entryPrice: { fontFamily: MONO, fontSize: responsiveFontSize.md, fontWeight: '800', color: TERM.text, fontVariant: ['tabular-nums'] },
  detailTitle: { fontFamily: MONO, fontSize: responsiveFontSize.lg, fontWeight: '800' },
  scamTag: { fontFamily: MONO, fontSize: responsiveFontSize.xs, fontWeight: '700' },

  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    flexWrap: 'wrap',
    marginTop: scale(2),
  },
  bracketBtn: {
    minHeight: scale(40),
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracketBtnFull: { alignSelf: 'stretch' },
  bracketBtnDisabled: { opacity: 0.5 },
  bracketLabel: { fontFamily: MONO, fontSize: responsiveFontSize.sm, fontWeight: '700', letterSpacing: 0.3 },
  gate: { fontFamily: MONO, fontSize: responsiveFontSize.xs, color: accent.danger },

  // Threat monitor
  threatRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  threatValue: { fontFamily: MONO, fontSize: responsiveFontSize['4xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },

  // Hex-dump block
  hexBlock: {
    backgroundColor: TERM.bgDeep,
    borderColor: TERM.borderDim,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.sm,
    gap: scale(3),
  },
  hexLine: { fontFamily: MONO, fontSize: responsiveFontSize.xs, lineHeight: scale(16) },

  // Skills / stages / laundering
  stageWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(6) },
  stageTok: { fontFamily: MONO, fontSize: responsiveFontSize.xs },
  launderRow: { gap: scale(2) },
});
