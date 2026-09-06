/**
 * GamingStreamingApp - "Streaming", the live half of the creator career.
 *
 * Shares the sibling GamingApp's monetization via `lib/content/` +
 * `ContentActions.ts`, and now its identity colour and its vocabulary: the
 * shared AppHeader/CashChip, SegmentedControl, StatStrip, Chip, SectionTitle,
 * ProgressBar, EmptyState, CollapsibleSection and useToast.
 *
 * Two things were said twice and are now said once. "Go Live" appeared in four
 * places; it lives on the Go Live console (the control) and on a past
 * broadcast ("Stream this again" - a different intent), while the dashboard
 * hero carries one button that opens the console. The five-category box-art
 * grid appeared on both Dashboard and Go Live; it is the SELECTION control, so
 * it belongs to Go Live alone and the dashboard shows the best stream instead.
 *
 * The dashboard reads "current activity + history" (Program 5): while a
 * broadcast is running the live console leads it in place of the box-art hero,
 * so the one thing the channel is doing right now is never a tab away.
 *
 * ONE gradient in the file: the Go Live console's primary action (the
 * dashboard's "Go live" is the shared GradientButton primitive). The real-time
 * drain loop and the stale-session resolver are untouched.
 *
 * Tabs: Dashboard / Go Live / History / Shop   (+ category & broadcast pages)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from 'react-native';
import {
  Radio,
  Activity,
  History,
  ShoppingBag,
  Zap,
  Sparkles,
  Trophy,
  Eye,
  ChevronRight,
  Clock,
  MessageCircle,
  Award,
  Cpu,
  Flame,
  Play,
  Square,
  Calendar,
  Gamepad2,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { computeQuality } from '@/lib/content/quality';
import { monetizationSummary } from '@/lib/content/monetization';
import { nextHypeStreak, hypeChanceForStreak, HYPE_MAX_CHANCE } from '@/lib/content/streamMeta';
import {
  startLiveStream,
  tickLiveStream,
  finalizeLiveStream,
  buyAccessory,
  upgradePCComponent,
  ACCESSORY_PRICES,
  PC_BASE_PRICES,
  MAX_PC_TIER,
  LIVE_ENERGY_DRAIN_PER_SEC,
  LIVE_MIN_ENERGY,
  LIVE_TICK_MS,
  isLiveSessionFromThisRuntime,
} from '@/contexts/game/actions/ContentActions';
import { formatMoney } from '@/utils/moneyFormatting';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import {
  getGlassCard,
  getGlassIconContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import Gradient from '@/components/ui/Gradient';
import GradientButton from '@/components/ui/GradientButton';
import ProgressRing from '@/components/ui/ProgressRing';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import Chip from '@/components/ui/Chip';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import KeyValueRow from '@/components/ui/KeyValueRow';
import { useToast } from '@/contexts/ToastContext';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { GamingStreamingState, StreamHistoryItem, StreamSession } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

const LinearGradient = Gradient;

// One identity colour, shared with the sibling YouVideo app - the two are the
// halves of one creator career, and a private fuchsia palette only made them
// look like different products. The deep stop below is the second colour of
// the ONE gradient in this file (the Go Live action).
const IDENTITY = accent.purple;
const IDENTITY_DEEP = '#7C3AED';
const LIVE_RED = accent.danger; // live indicator (semantic red)

type IconCmp = React.ComponentType<{ size?: number; color?: string }>;
type TabType = 'dashboard' | 'live' | 'history' | 'shop';
type Route =
  | { kind: 'main' }
  | { kind: 'category'; id: string }
  | { kind: 'broadcast'; id: string };

const ACCESSORY_LABELS: Record<keyof GamingStreamingState['equipment'], string> = {
  microphone: 'Microphone',
  webcam: 'Webcam',
  gamingChair: 'Gaming chair',
  greenScreen: 'Green screen',
  lighting: 'Studio lights',
};

// Presentation-only mirror of lib/content/quality's accessory weights, so gear
// rows can advertise their setup-score contribution (no logic, display text).
const ACCESSORY_QUALITY: Record<keyof GamingStreamingState['equipment'], number> = {
  microphone: 5,
  webcam: 4,
  gamingChair: 2,
  greenScreen: 3,
  lighting: 4,
};

const PC_LABELS: Record<keyof GamingStreamingState['pcUpgradeLevels'], string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  ssd: 'SSD',
  motherboard: 'Motherboard',
  cooling: 'Cooling',
  psu: 'Power supply',
  case: 'Case',
  network: 'Network',
};

const TABS: { key: TabType; label: string; icon: IconCmp }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Activity },
  { key: 'live', label: 'Go Live', icon: Radio },
  { key: 'history', label: 'History', icon: History },
  { key: 'shop', label: 'Shop', icon: ShoppingBag },
];

const GAME_OPTIONS = [
  { id: 'fps', name: 'Just Chatting', viewersHint: 'Wide audience' },
  { id: 'rpg', name: 'RPG Marathon', viewersHint: 'Loyal core' },
  { id: 'esports', name: 'Competitive', viewersHint: 'Skill-based hype' },
  { id: 'creative', name: 'Creative / Art', viewersHint: 'Niche, sticky' },
  { id: 'speedrun', name: 'Speedrun', viewersHint: 'Big spikes if PB' },
];

// Real box art for each category. require() needs static literals (Metro), so
// every asset is spelled out. Each of the five categories maps to one game.
const GAME_ART: Record<string, ImageSourcePropType> = {
  fps: require('@/assets/images/Games/Among us.webp'),
  rpg: require('@/assets/images/Games/League of Legends.webp'),
  esports: require('@/assets/images/Games/Valorant.webp'),
  creative: require('@/assets/images/Games/Minecraft.webp'),
  speedrun: require('@/assets/images/Games/Fortnite.webp'),
};

// Resolve box art from a stored stream's game string (matches the category
// name first, then keyword-falls-back so legacy history still gets a thumbnail).
function gameArtFor(name: string): ImageSourcePropType {
  const opt = GAME_OPTIONS.find((o) => o.name === name);
  if (opt && GAME_ART[opt.id]) return GAME_ART[opt.id];
  const n = (name || '').toLowerCase();
  if (n.includes('valorant') || n.includes('compet') || n.includes('fps') || n.includes('esport')) return GAME_ART.esports;
  if (n.includes('among') || n.includes('chat')) return GAME_ART.fps;
  if (n.includes('mine') || n.includes('craft') || n.includes('creat') || n.includes('art')) return GAME_ART.creative;
  if (n.includes('league') || n.includes('rpg') || n.includes('moba')) return GAME_ART.rpg;
  if (n.includes('fortnite') || n.includes('speed') || n.includes('run') || n.includes('race')) return GAME_ART.speedrun;
  return GAME_ART.esports;
}

// "Quick (30 min)" -> ["Quick", "30 min"] (still used by the broadcast detail
// header to split a stored label).
function splitDur(label: string): [string, string] {
  const m = label.match(/^(.*?)\s*\((.*)\)$/);
  return m ? [m[1], m[2]] : [label, ''];
}

const fmt = (n?: number) => Math.round(n ?? 0).toLocaleString();

interface Props {
  onBack: () => void;
}

export default function GamingStreamingApp({ onBack }: Props) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [route, setRoute] = useState<Route>({ kind: 'main' });
  const [selectedGame, setSelectedGame] = useState(GAME_OPTIONS[0]);

  const channel = gameState.gamingStreaming;
  const streamHistory = useMemo(() => channel?.streamHistory ?? [], [channel?.streamHistory]);
  const quality = useMemo(
    () => computeQuality(channel?.equipment, channel?.pcUpgradeLevels),
    [channel]
  );
  const monetization = useMemo(
    () => monetizationSummary(quality, channel?.paidMembers ?? 0, channel?.membershipRate),
    [quality, channel?.paidMembers, channel?.membershipRate]
  );

  const week = gameState.weeksLived || 0;
  const money = gameState.stats?.money ?? 0;
  const energy = gameState.stats?.energy ?? 0;

  const level = channel?.level ?? 1;
  const experience = channel?.experience ?? 0;
  const ownedAccessories = channel?.equipment
    ? Object.values(channel.equipment).filter(Boolean).length
    : 0;
  const streamsThisWeek =
    channel?.lastStreamWeek === week ? channel?.streamsThisWeek ?? 0 : 0;
  // The in-progress real-time broadcast, if any (null-guarded - absent on old
  // saves and whenever offline).
  const liveSession = channel?.currentStream?.live ? channel.currentStream : null;
  const isLiveNow = !!liveSession;
  // "LIVE" pill: actively broadcasting now, OR broadcast at least once this
  // in-game week (so the dashboard doesn't read OFFLINE right after a stream).
  const isLive = isLiveNow || streamsThisWeek > 0;
  // Hype-train chance the NEXT stream would roll, given the streak it would be
  // on (consecutive-week streak → higher, bounded at HYPE_MAX_CHANCE).
  const projectedStreak = nextHypeStreak(channel?.hypeStreak, channel?.lastStreamWeek, week);
  const projectedHypeChance = hypeChanceForStreak(projectedStreak);

  // Group history by category so tiles / detail pages can aggregate cheaply.
  const historyByGame = useMemo(() => {
    const m: Record<string, StreamHistoryItem[]> = {};
    for (const s of streamHistory) (m[s.game] ||= []).push(s);
    return m;
  }, [streamHistory]);

  const statsFor = useCallback(
    (name: string) => {
      const list = historyByGame[name] ?? [];
      let viewers = 0, peak = 0, earnings = 0, subs = 0, followers = 0, donations = 0, chat = 0;
      for (const s of list) {
        viewers += s.viewers;
        peak = Math.max(peak, s.viewers);
        earnings += s.earnings;
        subs += s.subscribers ?? 0;
        followers += s.followers ?? 0;
        donations += s.donations ?? 0;
        chat += s.chatMessages ?? 0;
      }
      const count = list.length;
      return {
        count, viewers, peak, earnings, subs, followers, donations, chat,
        avg: count ? Math.round(viewers / count) : 0,
        list,
      };
    },
    [historyByGame]
  );

  const detailCategory = useMemo(
    () => (route.kind === 'category' ? GAME_OPTIONS.find((o) => o.id === route.id) ?? null : null),
    [route]
  );
  const detailBroadcast = useMemo(
    () => (route.kind === 'broadcast' ? streamHistory.find((s) => s.id === route.id) ?? null : null),
    [route, streamHistory]
  );

  const flash = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  const goBack = useCallback(() => {
    if (route.kind !== 'main') setRoute({ kind: 'main' });
    else onBack();
  }, [route.kind, onBack]);

  const goLiveWith = useCallback((name: string) => {
    const opt = GAME_OPTIONS.find((o) => o.name === name);
    if (opt) setSelectedGame(opt);
    setActiveTab('live');
    setRoute({ kind: 'main' });
  }, []);

  // Refs so the interval closure and the ref-stable Stop handler always read the
  // freshest state/week without re-subscribing the drain loop every render.
  const gameStateRef = useRef(gameState);
  const weekRef = useRef(week);
  // Sync refs AFTER commit (not during render): React may replay or discard a
  // render, so mutating a ref in the render body can leak an uncommitted
  // snapshot into the drain interval / Stop handler that read these refs.
  useEffect(() => {
    gameStateRef.current = gameState;
    weekRef.current = week;
  }, [gameState, week]);

  const handleGoLive = useCallback(() => {
    const r = startLiveStream(gameState, setGameState, { game: selectedGame.name }, week);
    if (r.success) saveGame();
    else flash(r.message);
  }, [gameState, setGameState, saveGame, selectedGame, week, flash]);

  // Stop (manual or auto). Ref-stable: reads live state via refs so the drain
  // effect can depend on it without re-subscribing. Idempotent - finalize is a
  // no-op once the session is cleared, so a manual Stop racing an auto-stop
  // can't double-pay.
  const handleStopStream = useCallback(
    (autoStopped: boolean) => {
      const r = finalizeLiveStream(
        gameStateRef.current,
        setGameState,
        { autoStopped },
          weekRef.current
      );
      if (r.success) {
        saveGame();
        if (autoStopped) flash(r.message);
        else gameAlert(r.outcome?.hypeTrain ? 'HYPE TRAIN' : 'Stream ended', r.message);
      }
    },
    [setGameState, saveGame, flash]
  );

  // Real-time drain loop: while live, every LIVE_TICK_MS drain energy + accrue
  // viewers; when energy hits 0 the stream auto-stops. The interval is cleared
  // on Stop, on auto-stop (isLiveNow flips false), AND on unmount - so no leaked
  // timers and no setState-after-unmount.
  useEffect(() => {
    if (!isLiveNow) return;
    let ticksSinceSave = 0;
    const interval = setInterval(() => {
      const gs = gameStateRef.current;
      if (!gs.gamingStreaming?.currentStream?.live) return;
      const energyNow = gs.stats?.energy ?? 0;
      if (energyNow <= 0) {
        handleStopStream(true);
        return;
      }
      tickLiveStream(setGameState, LIVE_TICK_MS / 1000);
      // Checkpoint accrued progress ~every 10s so a crash/kill mid-stream can't
      // make the stale-session resolver finalize from an older snapshot and
      // under-pay the player. Throttled (saveGame validates + writes) - not
      // every tick.
      if (++ticksSinceSave >= 10) {
        ticksSinceSave = 0;
        saveGame();
      }
    }, LIVE_TICK_MS);
    return () => clearInterval(interval);
  }, [isLiveNow, setGameState, handleStopStream, saveGame]);

  // Safety: if a live session survived a save/reload (app closed mid-stream),
  // resolve it once on mount instead of letting it stream forever - but ONLY
  // when it really did come from a previous app launch.
  //
  // This used to finalize ANY live session it found on mount, and a remount is
  // indistinguishable from a relaunch by inspection: the player switching to
  // another tab for two seconds unmounts this screen exactly as an app kill
  // does. So tabbing away ENDED the broadcast, and coming back showed a stream
  // that "never goes all the way through on its own" (tester report, 2026-09-06).
  // `isLiveSessionFromThisRuntime` supplies the missing distinction from the
  // session's existing `startedAtMs`; nothing is added to the save format.
  const resolvedStaleRef = useRef(false);
  useEffect(() => {
    if (resolvedStaleRef.current) return;
    resolvedStaleRef.current = true;
    const ch = gameStateRef.current.gamingStreaming;
    if (ch?.currentStream?.live && !isLiveSessionFromThisRuntime(ch)) {
      const r = finalizeLiveStream(
        gameStateRef.current,
        setGameState,
        { autoStopped: true },
          weekRef.current
      );
      if (r.success) saveGame();
    }
  }, [setGameState, saveGame]);

  const handleAccessory = useCallback(
    (id: keyof GamingStreamingState['equipment']) => {
      const r = buyAccessory(gameState, setGameState, id, ACCESSORY_PRICES[id]);
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handlePCUpgrade = useCallback(
    (id: keyof GamingStreamingState['pcUpgradeLevels']) => {
      const r = upgradePCComponent(gameState, setGameState, id, PC_BASE_PRICES[id]);
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  // ── Shared building blocks ────────────────────────────────────────────────

  // Twitch VOD row: box-art thumb + duration badge + peak viewers + metrics.
  const renderVodCard = (s: StreamHistoryItem) => (
    <TouchableOpacity
      key={s.id}
      onPress={() => setRoute({ kind: 'broadcast', id: s.id })}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${s.game} broadcast, ${fmt(s.viewers)} peak viewers, view details`}
      style={[getGlassCard(darkMode, 6), styles.vodCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.vodThumbWrap}>
        <Image source={gameArtFor(s.game)} style={styles.vodThumb} resizeMode="cover" />
        <View pointerEvents="none" style={styles.thumbScrim} />
        <View pointerEvents="none" style={styles.vodDurBadge}>
          <Clock size={scale(9)} color="#fff" />
          <Text style={styles.vodDurText}>{s.duration}m</Text>
        </View>
      </View>
      <View style={styles.vodBody}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.vodGame, { color: theme.text }]} numberOfLines={1}>{s.game}</Text>
          <ChevronRight size={scale(15)} color={theme.textMuted} />
        </View>
        <View style={styles.vodPeakRow}>
          <View style={styles.peakPill}>
            <Eye size={scale(11)} color={LIVE_RED} />
            <Text style={[styles.peakVal, { color: theme.text }]}>{fmt(s.viewers)}</Text>
            <Text style={[styles.peakLabel, { color: theme.textMuted }]}>peak</Text>
          </View>
          {s.uploadedAt != null ? (
            <View style={[styles.weekChip, { borderColor: theme.border }]}>
              <Calendar size={scale(10)} color={theme.textMuted} />
              <Text style={[styles.weekChipText, { color: theme.textSecondary }]}>Wk {s.uploadedAt}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.vodMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          +{s.subscribers} subs · +{s.followers} followers ·{' '}
          <Text style={{ color: accent.success }}>{formatMoney(s.earnings ?? 0)}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ── Dashboard (Twitch channel home) ───────────────────────────────────────

  const renderDashboard = () => {
    const lastGame = streamHistory[0]?.game ?? selectedGame.name;
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {liveSession ? (
          // A running broadcast IS the current activity, so the live console
          // takes the hero's slot rather than sitting behind the Go Live tab
          // while the dashboard shows a red pill over a stale preview. Same
          // console as the tab (one Stop handler, one drain loop).
          renderLiveConsole(liveSession)
        ) : (
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] },
          ]}
        >
          {/* Recipe B hero - channel preview over real box art (ONE per view). */}
          <View style={styles.heroInner}>
            <View style={styles.heroMedia}>
              <Image source={gameArtFor(lastGame)} style={styles.mediaFill} resizeMode="cover" />
              <View pointerEvents="none" style={styles.mediaScrim} />

              <View style={styles.mediaTopRow}>
                <View style={[styles.statusPill, { backgroundColor: isLive ? LIVE_RED : 'rgba(15,23,42,0.72)' }]}>
                  <Text style={styles.statusPillText}>{isLive ? 'LIVE' : 'OFFLINE'}</Text>
                </View>
                <View style={styles.viewersPill}>
                  <Eye size={scale(12)} color="#fff" />
                  <Text style={styles.viewersPillText}>{fmt(channel?.averageViewers)} avg</Text>
                </View>
              </View>

              <View style={styles.mediaBottom}>
                <View style={styles.heroIdRow}>
                  <View style={styles.heroAvatar}>
                    <Radio size={scale(18)} color="#fff" />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.heroChannelName} numberOfLines={1}>Your Channel</Text>
                    <View style={styles.heroLevelChip}>
                      <Award size={scale(11)} color={IDENTITY} />
                      <Text style={styles.heroLevelText}>Level {level} Partner</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.heroFooter}>
              {/* The dashboard's one saturated action. It only opens the
                  console (category + energy gate live there), which is why it
                  is never disabled here - the gate would be a lie this far
                  from the control. */}
              <GradientButton
                label="Go live"
                onPress={() => setActiveTab('live')}
                colors={[IDENTITY, IDENTITY, IDENTITY_DEEP]}
                glow={IDENTITY}
                icon={<Play size={scale(15)} color="#fff" />}
                accessibilityLabel="Open the Go Live console"
              />
            </View>
          </View>
        </View>
        )}

        {/* The three numbers a streamer decides on. The rest of the revenue
            readout is a record of what happened - it lives behind the fold. */}
        <StatStrip
          items={[
            { label: 'Followers', value: fmt(channel?.followers) },
            { label: 'Subs', value: fmt(channel?.subscribers) },
            { label: '$ / wk', value: formatMoney(monetization.membershipWeekly ?? 0), tint: accent.success },
          ]}
        />

        {/* Stream health - setup ring + partner level + gear/rig sub-scores. */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle
            title="Stream health"
            right={<Chip label="Upgrade" tint={IDENTITY} onPress={() => setActiveTab('shop')} />}
          />
          <View style={styles.healthRow}>
            <ProgressRing
              value={quality.total}
              size={78}
              strokeWidth={7}
              ambient={false}
              accentColor={qualityColor(quality.tier)}
              trackColor={darkMode ? 'rgba(148,163,184,0.20)' : 'rgba(15,23,42,0.10)'}
              surfaceColor={theme.surface}
              borderColor={theme.border}
              inkColor={theme.text}
              label={`Setup quality ${quality.total} of 100`}
            >
              <Text style={[styles.ringTier, { color: qualityColor(quality.tier) }]}>{quality.tier.toUpperCase()}</Text>
              <Text style={[styles.ringTierSub, { color: theme.textMuted }]}>setup</Text>
            </ProgressRing>
            <View style={styles.healthMeta}>
              <View style={styles.levelLine}>
                <Award size={scale(13)} color={IDENTITY} />
                <Text style={[styles.levelText, { color: theme.text }]}>Level {level}</Text>
                <Text style={[styles.xpText, { color: theme.textMuted }]}>{fmt(experience)} XP</Text>
              </View>
              <MeterRow label="Gear" value={quality.accessories} max={18} theme={theme} />
              <MeterRow label="Rig" value={Math.min(100, quality.pc)} max={100} theme={theme} />
            </View>
          </View>
        </View>

        <CollapsibleSection
          id="streaming-all-revenue"
          title="All revenue"
          defaultCollapsed
          tint={IDENTITY}
          summary={`${formatMoney(channel?.totalEarnings ?? 0)} lifetime`}
        >
          <KeyValueRow label="$ / viewer" value={`$${monetization.viewerPay.toFixed(3)}`} />
          <KeyValueRow label="RPM" value={`$${monetization.rpm.toFixed(2)}`} />
          <KeyValueRow label="Members" value={fmt(channel?.paidMembers)} />
          <KeyValueRow label="Total views" value={fmt(channel?.totalViews)} />
          <KeyValueRow label="Watch hours" value={fmt(Math.round(channel?.streamHours ?? 0))} />
          <KeyValueRow label="Donations" value={formatMoney(channel?.totalDonations ?? 0)} />
          <KeyValueRow label="Sub earnings" value={formatMoney(channel?.totalSubEarnings ?? 0)} />
          <KeyValueRow label="Total earned" value={formatMoney(channel?.totalEarnings ?? 0)} />
        </CollapsibleSection>

        {/* Best stream. */}
        {channel?.bestStream ? (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="Best stream" />
            <View style={styles.bestRow}>
              <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: withAlpha(accent.gold, 0.15), borderWidth: 1, borderColor: withAlpha(accent.gold, 0.3) }]}>
                <Trophy size={scale(20)} color={accent.gold} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.bestTitle, { color: theme.text }]} numberOfLines={1}>{channel.bestStream.game}</Text>
                <Text style={[styles.bestSub, { color: theme.textSecondary }]}>
                  {fmt(channel.bestStream.viewers)} peak · {channel.bestStream.duration}m · {formatMoney(channel.bestStream.earnings ?? 0)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  // ── Go Live (broadcast console) ───────────────────────────────────────────

  // Format elapsed seconds as mm:ss for the live timer.
  const fmtElapsed = (secs: number): string => {
    const s = Math.max(0, Math.floor(secs));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
  };

  // ── LIVE console - the monitor, energy runway, session stats and Stop. ────
  // A fragment, not a screen: the Go Live tab wraps it in its own ScrollView
  // (`renderLiveActive`) and the dashboard hosts it inside ITS ScrollView in
  // the hero's slot - nesting two scroll views would break the outer scroll.
  const renderLiveConsole = (session: StreamSession) => {
    const elapsed = session.elapsedSeconds ?? 0;
    const liveViewers = session.viewers ?? 0;
    const energyPct = Math.max(0, Math.min(100, energy));
    // Seconds of stream left at the current drain rate (rough runway readout).
    const secondsLeft = Math.max(0, Math.floor(energy / LIVE_ENERGY_DRAIN_PER_SEC));
    return (
      <>
        {/* Live monitor. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] },
          ]}
        >
          <View style={styles.monitorInner}>
            <View style={styles.heroMedia}>
              <Image source={gameArtFor(session.game)} style={styles.mediaFill} resizeMode="cover" />
              <View pointerEvents="none" style={styles.mediaScrim} />
              <View style={styles.mediaTopRow}>
                <View style={[styles.statusPill, { backgroundColor: LIVE_RED }]}>
                  <Text style={styles.statusPillText}>LIVE</Text>
                </View>
                <View style={styles.viewersPill}>
                  <Eye size={scale(12)} color="#fff" />
                  <Text style={styles.viewersPillText}>{fmt(liveViewers)} watching</Text>
                </View>
              </View>
              <View style={styles.mediaBottom}>
                <Text style={styles.monitorGame} numberOfLines={1}>{session.game}</Text>
                <View style={styles.monitorMetaRow}>
                  <View style={styles.monitorMeta}>
                    <Clock size={scale(12)} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.monitorMetaText}>{fmtElapsed(elapsed)} elapsed</Text>
                  </View>
                  <View style={styles.monitorMeta}>
                    <MessageCircle size={scale(12)} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.monitorMetaText}>{fmt(session.chatMessages)} chat</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Energy bar - drains in real time; empties → auto-stop. */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.capRow}>
            <View style={styles.hintRow}>
              <Zap size={scale(13)} color={energy < 20 ? accent.danger : accent.warning} />
              <Text style={[styles.capLabel, { color: theme.textSecondary }]}>Energy</Text>
            </View>
            <Text style={[styles.capValue, { color: energy < 20 ? accent.danger : theme.text }]}>{Math.round(energy)} / 100</Text>
          </View>
          <ProgressBar value={energyPct / 100} color={energy < 20 ? accent.danger : IDENTITY} height={scale(7)} label="Energy" />
          <Text style={[styles.recordHint, { color: theme.textMuted, marginTop: sp.xs }]}>
            Streaming drains energy live - about {fmtElapsed(secondsLeft)} left before you run out.
          </Text>
        </View>

        {/* Live session stats. */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Live session" />
          <StatStrip
            items={[
              { label: 'Viewers', value: fmt(liveViewers) },
              { label: 'Elapsed', value: fmtElapsed(elapsed) },
              { label: 'Chat', value: fmt(session.chatMessages) },
              { label: 'Setup', value: quality.tier.toUpperCase(), tint: qualityColor(quality.tier) },
            ]}
          />
        </View>

        {/* Stop Stream - end + finalise the broadcast. */}
        <TouchableOpacity
          onPress={() => handleStopStream(false)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Stop stream"
          style={[styles.publishBtn, { backgroundColor: LIVE_RED }]}
        >
          <Square size={scale(14)} color="#fff" />
          <Text style={styles.publishBtnText}>Stop stream</Text>
        </TouchableOpacity>
      </>
    );
  };

  // ── LIVE view - the Go Live tab while a real-time broadcast is running. ────
  const renderLiveActive = (session: StreamSession) => (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      {renderLiveConsole(session)}
    </ScrollView>
  );

  // ── Go Live (broadcast console) ───────────────────────────────────────────

  const renderLive = () => {
    if (liveSession) return renderLiveActive(liveSession);
    const canGo = energy >= LIVE_MIN_ENERGY;
    const capped = streamsThisWeek >= 5;
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {/* Broadcast monitor - the scene preview of the selected category. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] },
          ]}
        >
          <View style={styles.monitorInner}>
            <View style={styles.heroMedia}>
              <Image source={GAME_ART[selectedGame.id]} style={styles.mediaFill} resizeMode="cover" />
              <View pointerEvents="none" style={styles.mediaScrim} />
              <View style={styles.mediaTopRow}>
                <View style={[styles.statusPill, { backgroundColor: 'rgba(15,23,42,0.72)' }]}>
                  <Text style={styles.statusPillText}>PREVIEW</Text>
                </View>
                <View style={styles.monitorTierChip}>
                  <Cpu size={scale(11)} color={qualityColor(quality.tier)} />
                  <Text style={styles.monitorTierText}>{quality.tier.toUpperCase()} · {quality.total}</Text>
                </View>
              </View>
              <View style={styles.mediaBottom}>
                <Text style={styles.monitorGame} numberOfLines={1}>{selectedGame.name}</Text>
                <View style={styles.monitorMetaRow}>
                  <View style={styles.monitorMeta}>
                    <Zap size={scale(12)} color={accent.warning} />
                    <Text style={styles.monitorMetaText}>Drains ~{LIVE_ENERGY_DRAIN_PER_SEC}/s live</Text>
                  </View>
                  <View style={styles.monitorMeta}>
                    <Eye size={scale(12)} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.monitorMetaText}>{selectedGame.viewersHint}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Category - the SELECTION control, so it lives here and nowhere else. */}
        <View style={styles.section}>
          <SectionTitle title="Category" subtitle="Pick what you are streaming." />
          <View style={styles.tileGrid}>
            {GAME_OPTIONS.map((g) => {
              const selected = selectedGame.id === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setSelectedGame(g)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Stream ${g.name}`}
                  style={[
                    getGlassCard(darkMode, 6),
                    styles.gameTile,
                    { backgroundColor: theme.surface, borderColor: selected ? IDENTITY : theme.border, borderWidth: selected ? 2 : 1 },
                  ]}
                >
                  <View style={styles.gameTileClip}>
                    <Image source={GAME_ART[g.id]} style={styles.gameTileImg} resizeMode="cover" />
                    <View pointerEvents="none" style={styles.gameTileScrim} />
                    {selected ? (
                      <View style={styles.gameTileCheck}>
                        <Radio size={scale(12)} color="#fff" />
                      </View>
                    ) : null}
                    <View pointerEvents="none" style={styles.gameTileLabel}>
                      <Text style={styles.gameTileName} numberOfLines={1}>{g.name}</Text>
                      <Text style={styles.gameTileHint} numberOfLines={1}>{g.viewersHint}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Broadcast console - weekly cap + hype + the one loud Go Live CTA. */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.capRow}>
            <Text style={[styles.capLabel, { color: theme.textSecondary }]}>Streams this week</Text>
            <Text style={[styles.capValue, { color: capped ? accent.warning : theme.text }]}>{streamsThisWeek} / 5</Text>
          </View>
          <ProgressBar value={streamsThisWeek / 5} color={capped ? accent.warning : IDENTITY} height={scale(7)} label="Streams this week" />
          <View style={styles.hypeHeadRow}>
            <View style={[styles.hintRow, { flex: 1 }]}>
              <Flame size={scale(12)} color={accent.warning} />
              <Text style={[styles.recordHint, { color: theme.textMuted }]}>
                Hype-train chance {Math.round(projectedHypeChance * 100)}%
                {projectedStreak > 1 ? ` · ${projectedStreak}-week streak` : ''}
              </Text>
            </View>
            <Text style={[styles.hypeMax, { color: theme.textMuted }]}>max {Math.round(HYPE_MAX_CHANCE * 100)}%</Text>
          </View>
          <ProgressBar
            value={projectedHypeChance / HYPE_MAX_CHANCE}
            color={accent.warning}
            height={scale(7)}
            label="Hype-train chance"
            style={styles.hypeBar}
          />
          <View style={[styles.hintRow, { marginTop: sp.sm }]}>
            <Zap size={scale(13)} color={canGo ? accent.warning : accent.danger} />
            <Text style={[styles.recordHint, { color: theme.textMuted, marginTop: 0 }]}>
              Energy {Math.round(energy)} · streaming drains it live. Tap Stop any time to bank your earnings.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleGoLive}
            disabled={!canGo || capped}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go live"
            accessibilityState={{ disabled: !canGo || capped }}
            style={[styles.publishBtnWrap, canGo && !capped && getPlatformShadows(5, 0.3, 2, 8)]}
          >
            <LinearGradient
              colors={canGo && !capped ? [IDENTITY, IDENTITY_DEEP] : [theme.surfaceElevated, theme.surfaceElevated]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.publishBtn}
            >
              <Play size={scale(15)} color={canGo && !capped ? 'white' : theme.textMuted} />
              <Text style={[styles.publishBtnText, { color: canGo && !capped ? 'white' : theme.textMuted }]}>
                {capped ? 'Weekly cap reached' : canGo ? 'Go live' : `Need ${LIVE_MIN_ENERGY} energy`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ── History (past broadcasts) ─────────────────────────────────────────────

  const renderHistory = () => (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      {streamHistory.length === 0 ? (
        <EmptyState
          icon={<History size={scale(26)} color={IDENTITY} />}
          observation="No broadcasts yet."
          nudge="Every stream you finish is banked here with its peak viewers and what it paid."
          ctaLabel="Go live"
          onCtaPress={() => setActiveTab('live')}
        />
      ) : (
        <>
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="Broadcast summary" />
            <StatStrip
              items={[
                { label: 'Broadcasts', value: fmt(streamHistory.length) },
                { label: 'Avg viewers', value: fmt(channel?.averageViewers) },
                { label: 'Hours', value: fmt(Math.round(channel?.streamHours ?? 0)) },
                { label: 'Peak', value: fmt(channel?.bestStream?.viewers) },
              ]}
            />
          </View>
          {streamHistory.slice(0, 50).map(renderVodCard)}
        </>
      )}
    </ScrollView>
  );

  // ── Shop (studio gear) ────────────────────────────────────────────────────

  const renderShop = () => (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      {/* Setup summary - links gear spend to the quality score. */}
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.bestRow}>
          <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: withAlpha(IDENTITY, 0.15), borderWidth: 1, borderColor: withAlpha(IDENTITY, 0.30) }]}>
            <Cpu size={scale(20)} color={IDENTITY} />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.bestTitle, { color: theme.text }]}>{quality.tier.toUpperCase()} setup · {quality.total}/100</Text>
            <Text style={[styles.bestSub, { color: theme.textSecondary }]}>{ownedAccessories}/5 gear owned · rig {quality.pc} pts</Text>
          </View>
        </View>
        <ProgressBar value={quality.total / 100} color={qualityColor(quality.tier)} height={scale(7)} label="Setup quality" />
      </View>

      {/* Accessories. */}
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SectionTitle title="Accessories" />
        {(Object.keys(ACCESSORY_LABELS) as (keyof GamingStreamingState['equipment'])[]).map((k) => {
          const owned = !!channel?.equipment?.[k];
          return (
            <View key={k} style={styles.gearRow}>
              <View
                style={[
                  getGlassIconContainer(darkMode, 36),
                  owned
                    ? { backgroundColor: withAlpha(accent.success, 0.15), borderWidth: 1, borderColor: withAlpha(accent.success, 0.3) }
                    : { backgroundColor: withAlpha(IDENTITY, 0.15), borderWidth: 1, borderColor: withAlpha(IDENTITY, 0.30) },
                ]}
              >
                <Sparkles size={scale(15)} color={owned ? accent.success : IDENTITY} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.gearName, { color: theme.text }]}>{ACCESSORY_LABELS[k]}</Text>
                <Text style={[styles.gearMeta, { color: theme.textMuted }]}>
                  {owned ? 'Owned' : `${formatMoney(ACCESSORY_PRICES[k] ?? 0)} · +${ACCESSORY_QUALITY[k]} quality`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleAccessory(k)}
                disabled={owned}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={owned ? `${ACCESSORY_LABELS[k]} owned` : `Buy ${ACCESSORY_LABELS[k]}`}
                style={[styles.gearBtn, owned ? { backgroundColor: theme.surfaceElevated } : { backgroundColor: withAlpha(IDENTITY, 0.14) }]}
              >
                <Text style={[styles.gearBtnText, { color: owned ? theme.textMuted : IDENTITY }]}>{owned ? 'Owned' : 'Buy'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* PC components. */}
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SectionTitle title="PC components" />
        {(Object.keys(PC_LABELS) as (keyof GamingStreamingState['pcUpgradeLevels'])[]).map((k) => {
          const tier = channel?.pcUpgradeLevels?.[k] ?? 0;
          const maxed = tier >= MAX_PC_TIER;
          const cost = Math.round(PC_BASE_PRICES[k] * Math.pow(2, tier));
          return (
            <View key={k} style={styles.gearRow}>
              <View style={[getGlassIconContainer(darkMode, 36), { backgroundColor: withAlpha(IDENTITY, 0.15), borderWidth: 1, borderColor: withAlpha(IDENTITY, 0.30) }]}>
                <Cpu size={scale(15)} color={IDENTITY} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.gearName, { color: theme.text }]}>{PC_LABELS[k]}</Text>
                <View style={styles.gearTierRow}>
                  <Chip label={`T${tier}`} tint={maxed ? accent.success : IDENTITY} accessibilityLabel={`Tier ${tier}`} />
                </View>
              </View>
              <View style={styles.gearRight}>
                <Text style={[styles.gearPrice, { color: theme.textMuted }]}>
                  {maxed ? 'Max tier' : formatMoney(cost)}
                </Text>
                <TouchableOpacity
                  onPress={() => handlePCUpgrade(k)}
                  activeOpacity={0.85}
                  disabled={maxed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: maxed }}
                  accessibilityLabel={maxed
                    ? `${PC_LABELS[k]} is at max tier`
                    : `Upgrade ${PC_LABELS[k]} to tier ${tier + 1} for ${formatMoney(cost)}`}
                  style={[styles.gearBtn, { backgroundColor: maxed ? withAlpha(accent.muted, 0.18) : withAlpha(IDENTITY, 0.14) }]}
                >
                  <Text style={[styles.gearBtnText, { color: maxed ? theme.textMuted : IDENTITY }]}>
                    {maxed ? 'Maxed' : 'Upgrade'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  // ── Category detail (sub-view) ────────────────────────────────────────────

  const renderCategoryDetail = () => {
    const g = detailCategory!;
    const st = statsFor(g.name);
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] },
          ]}
        >
          <View style={styles.monitorInner}>
            <View style={styles.heroMedia}>
              <Image source={GAME_ART[g.id]} style={styles.mediaFill} resizeMode="cover" />
              <View pointerEvents="none" style={styles.mediaScrim} />
              <View style={styles.mediaTopRow}>
                <View style={styles.catBadge}>
                  <Gamepad2 size={scale(11)} color="#fff" />
                  <Text style={styles.statusPillText}>CATEGORY</Text>
                </View>
                <View style={styles.viewersPill}>
                  <Eye size={scale(12)} color="#fff" />
                  <Text style={styles.viewersPillText}>{st.count ? `${fmt(st.avg)} avg` : 'New'}</Text>
                </View>
              </View>
              <View style={styles.mediaBottom}>
                <Text style={styles.monitorGame} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.detailSub}>{g.viewersHint}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Your performance" />
          <StatStrip
            items={[
              { label: 'Broadcasts', value: fmt(st.count) },
              { label: 'Peak', value: fmt(st.peak) },
              { label: 'Avg', value: fmt(st.avg) },
              { label: 'Earned', value: formatMoney(st.earnings ?? 0), tint: accent.success },
            ]}
          />
          <View style={styles.rowGroup}>
            <KeyValueRow label="Subs gained" value={fmt(st.subs)} />
            <KeyValueRow label="Followers gained" value={fmt(st.followers)} />
            <KeyValueRow label="Chat messages" value={fmt(st.chat)} />
            <KeyValueRow label="Donations" value={formatMoney(st.donations ?? 0)} />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => goLiveWith(g.name)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Go live with ${g.name}`}
          style={[styles.publishBtn, { backgroundColor: IDENTITY }]}
        >
          <Play size={scale(15)} color="white" />
          <Text style={styles.publishBtnText}>Go live with {g.name}</Text>
        </TouchableOpacity>

        {st.list.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="Recent broadcasts" />
            {st.list.slice(0, 20).map(renderVodCard)}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  // ── Broadcast detail (sub-view) ───────────────────────────────────────────

  const renderBroadcastDetail = () => {
    const s = detailBroadcast!;
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        <View
          style={[
            getGlassCard(darkMode, 12),
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] },
          ]}
        >
          <View style={styles.monitorInner}>
            <View style={styles.heroMedia}>
              <Image source={gameArtFor(s.game)} style={styles.mediaFill} resizeMode="cover" />
              <View pointerEvents="none" style={styles.mediaScrim} />
              <View style={styles.mediaTopRow}>
                <View style={[styles.statusPill, { backgroundColor: LIVE_RED }]}>
                  <Text style={styles.statusPillText}>BROADCAST</Text>
                </View>
                {s.uploadedAt != null ? (
                  <View style={styles.viewersPill}>
                    <Calendar size={scale(11)} color="#fff" />
                    <Text style={styles.viewersPillText}>Week {s.uploadedAt}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.mediaBottom}>
                <Text style={styles.monitorGame} numberOfLines={1}>{s.game}</Text>
                <View style={styles.bigPeakRow}>
                  <Eye size={scale(16)} color={LIVE_RED} />
                  <Text style={styles.bigPeakVal}>{fmt(s.viewers)}</Text>
                  <Text style={styles.bigPeakLabel}>peak viewers</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Session details" />
          <StatStrip
            items={[
              { label: 'Duration', value: `${s.duration}m` },
              { label: 'Peak', value: fmt(s.viewers) },
              { label: 'Earnings', value: formatMoney(s.earnings ?? 0), tint: accent.success },
            ]}
          />
          <View style={styles.rowGroup}>
            <KeyValueRow label="Category" value={splitDur(s.game)[0] || s.game} />
            <KeyValueRow label="Subs gained" value={`+${fmt(s.subscribers)}`} />
            <KeyValueRow label="Followers gained" value={`+${fmt(s.followers)}`} />
            <KeyValueRow label="Chat messages" value={fmt(s.chatMessages)} />
            <KeyValueRow label="Donations" value={formatMoney(s.donations ?? 0)} />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => goLiveWith(s.game)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Stream ${s.game} again`}
          style={[styles.publishBtn, { backgroundColor: IDENTITY }]}
        >
          <Play size={scale(15)} color="white" />
          <Text style={styles.publishBtnText}>Stream this again</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const inCategory = route.kind === 'category' && !!detailCategory;
  const inBroadcast = route.kind === 'broadcast' && !!detailBroadcast;
  const inDetail = inCategory || inBroadcast;
  const headerTitle = inCategory ? detailCategory!.name : inBroadcast ? 'Broadcast' : 'Streaming';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        title={headerTitle}
        onBack={goBack}
        backLabel={inDetail ? 'Back to Streaming' : 'Back'}
        right={<CashChip value={formatMoney(money)} tint={IDENTITY} />}
      />

      {inCategory ? (
        renderCategoryDetail()
      ) : inBroadcast ? (
        renderBroadcastDetail()
      ) : (
        <>
          <SegmentedControl
            segments={TABS}
            value={activeTab}
            onChange={setActiveTab}
            activeColor={IDENTITY}
            style={styles.tabs}
          />

          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'live' && renderLive()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'shop' && renderShop()}
        </>
      )}

    </View>
  );
}

function MeterRow({ label, value, max, theme }: { label: string; value: number; max: number; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.meterRow}>
      <Text style={[styles.meterLabel, { color: theme.textSecondary }]}>{label}</Text>
      <ProgressBar value={max > 0 ? value / max : 0} color={IDENTITY} height={scale(7)} label={label} style={styles.meterBar} />
      <Text style={[styles.meterVal, { color: theme.text }]}>{Math.round(value)}</Text>
    </View>
  );
}

function qualityColor(tier: string): string {
  switch (tier) {
    case 'elite': return accent.gold;
    case 'pro': return accent.purple;
    case 'budget': return accent.info;
    default: return accent.muted;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.lg, paddingBottom: sp['3xl'] },
  tabs: { marginHorizontal: sp.md, marginTop: sp.sm, marginBottom: sp.sm },
  // Segmented control directly under the top bar; it has its own container
  // (glass tabs), so the top bar drops its bottom border.

  // ── Sections & cards ──
  section: { gap: sp.sm },
  card: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },

  // Key/value rows - the readout behind a strip's three headline numbers.
  rowGroup: { marginTop: sp.xs },

  // ── Media (hero / monitor / detail) ──
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden' },
  monitorInner: { borderRadius: br['2xl'], overflow: 'hidden' },
  // Fixed clamped height (not aspectRatio) so the hero can't balloon on wide
  // frames; scale() caps at 1.8x, preserving the ~16:9 look on phones.
  heroMedia: { width: '100%', height: scale(210), position: 'relative', justifyContent: 'space-between' },
  mediaFill: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  mediaScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.42)' },
  mediaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: sp.sm },
  mediaBottom: { padding: sp.md, gap: sp.xs },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: scale(5), paddingHorizontal: sp.sm, paddingVertical: 4, borderRadius: br.sm },
  statusPillText: { fontSize: fs.xs, fontWeight: '700', color: '#fff', letterSpacing: 0.6 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: sp.sm, paddingVertical: 4, borderRadius: br.sm, backgroundColor: withAlpha(IDENTITY, 0.85) },
  viewersPill: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: sp.sm, paddingVertical: 4, borderRadius: br.full, backgroundColor: 'rgba(2,6,23,0.55)' },
  viewersPillText: { fontSize: fs.xs, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },

  // Hero identity + stat strip (over media).
  heroIdRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  heroAvatar: { width: scale(38), height: scale(38), borderRadius: scale(19), alignItems: 'center', justifyContent: 'center', backgroundColor: IDENTITY, borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
  heroChannelName: { fontSize: fs.lg, fontWeight: '700', color: '#fff' },
  heroLevelChip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full, backgroundColor: 'rgba(2,6,23,0.5)' },
  heroLevelText: { fontSize: fs.xs, fontWeight: '700', color: '#fff' },
  heroFooter: { padding: sp.md },

  // ── Stream health card ──
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, paddingTop: sp.xs },
  ringTier: { fontSize: fs.sm, fontWeight: '600' },
  ringTierSub: { fontSize: fs.xs, fontWeight: '600' },
  healthMeta: { flex: 1, gap: sp.sm },
  levelLine: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  levelText: { fontSize: fs.md, fontWeight: '600' },
  xpText: { fontSize: fs.xs, fontWeight: '600', marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  meterLabel: { fontSize: fs.xs, fontWeight: '600', width: scale(34) },
  meterBar: { flex: 1 },
  meterVal: { fontSize: fs.xs, fontWeight: '600', width: scale(28), textAlign: 'right', fontVariant: ['tabular-nums'] },

  // ── Revenue grid ──

  // ── Category tiles (Twitch directory) ──
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  thumbScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.28)' },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.xs },

  // ── Go Live monitor ──
  monitorTierChip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: sp.sm, paddingVertical: 4, borderRadius: br.full, backgroundColor: 'rgba(2,6,23,0.55)' },
  monitorTierText: { fontSize: fs.xs, fontWeight: '700', color: '#fff', letterSpacing: 0.4 },
  monitorGame: { fontSize: fs['2xl'], fontWeight: '800', color: '#fff' },
  monitorMetaRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, marginTop: 2 },
  monitorMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  monitorMetaText: { fontSize: fs.sm, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  // ── Game picker tiles ──
  gameTile: { width: '47.5%', flexGrow: 1, borderRadius: br.xl, overflow: 'hidden' },
  gameTileClip: { width: '100%', height: scale(88), position: 'relative', justifyContent: 'flex-end' },
  gameTileImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  gameTileScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.4)' },
  gameTileCheck: { position: 'absolute', top: sp.xs, right: sp.xs, width: scale(22), height: scale(22), borderRadius: scale(11), alignItems: 'center', justifyContent: 'center', backgroundColor: IDENTITY },
  gameTileLabel: { padding: sp.sm, gap: 1 },
  gameTileName: { fontSize: fs.sm, fontWeight: '700', color: '#fff' },
  gameTileHint: { fontSize: fs.xs, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // ── Duration tiles ──

  // ── Publish console ──
  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capLabel: { fontSize: fs.sm, fontWeight: '600' },
  capValue: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  recordHint: { fontSize: fs.xs, fontStyle: 'italic', flex: 1 },
  hypeHeadRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.sm },
  hypeMax: { fontSize: fs.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hypeBar: { marginTop: sp.xs },
  publishBtnWrap: { borderRadius: br.full },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingVertical: sp.md, paddingHorizontal: sp.md, borderRadius: br.full, justifyContent: 'center', minHeight: scale(48) },
  publishBtnText: { fontSize: fs.md, fontWeight: '600', color: '#fff' },

  // ── History summary + VOD cards ──
  vodCard: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.xl, borderWidth: 1 },
  vodThumbWrap: { width: scale(104), height: scale(72), borderRadius: br.lg, overflow: 'hidden', position: 'relative' },
  vodThumb: { width: '100%', height: '100%' },
  vodDurBadge: { position: 'absolute', right: scale(4), bottom: scale(4), flexDirection: 'row', alignItems: 'center', gap: scale(3), paddingHorizontal: scale(5), paddingVertical: 2, borderRadius: br.sm, backgroundColor: 'rgba(2,6,23,0.72)' },
  vodDurText: { fontSize: fs.xs, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  vodBody: { flex: 1, gap: sp.xs },
  vodMeta: { fontSize: fs.xs, fontVariant: ['tabular-nums'] },
  vodGame: { fontSize: fs.md, fontWeight: '600', flex: 1 },
  vodPeakRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  peakPill: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  peakVal: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  peakLabel: { fontSize: fs.xs, fontWeight: '600' },
  weekChip: { flexDirection: 'row', alignItems: 'center', gap: scale(3), paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full, borderWidth: 1 },
  weekChipText: { fontSize: fs.xs, fontWeight: '600' },

  // ── Detail sub-views ──
  detailSub: { fontSize: fs.sm, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  bigPeakRow: { flexDirection: 'row', alignItems: 'baseline', gap: sp.xs, marginTop: 2 },
  bigPeakVal: { fontSize: fs['3xl'], fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
  bigPeakLabel: { fontSize: fs.xs, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  // ── Best stream ──
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  bestTitle: { fontSize: fs.md, fontWeight: '600' },
  bestSub: { fontSize: fs.xs },

  // ── Shop gear rows ──
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingVertical: sp.xs },
  gearName: { fontSize: fs.sm, fontWeight: '600' },
  gearMeta: { fontSize: fs.xs },
  gearRight: { alignItems: 'flex-end', gap: 2 },
  gearTierRow: { flexDirection: 'row', marginTop: 2 },
  gearPrice: { fontSize: fs.xs, fontVariant: ['tabular-nums'] },
  gearBtn: { paddingHorizontal: sp.md, minHeight: scale(36), minWidth: scale(64), borderRadius: br.full, alignItems: 'center', justifyContent: 'center' },
  gearBtnText: { fontSize: fs.sm, fontWeight: '600' },

  // ── Empty state ──

});
