/**
 * GamingApp (YouVideo) — YouTube DNA pass (Remake 13).
 *
 * Was "eyebrow hero + uniform rows". Now reads like a creator channel:
 *   • Channel tab   — YouTube channel header (avatar + subs · videos · watch-time),
 *                     a big FEATURED thumbnail, monetization + analytics grids,
 *                     recent-video thumbnail rows.
 *   • Record tab    — an upload composer with a live thumbnail PREVIEW, projected
 *                     reach, weekly-upload meter and energy readout.
 *   • Videos tab    — thumbnail-led video cards (Games art) with sort chips; each
 *                     card opens a video DETAIL sub-page (list → detail routing).
 *   • Studio tab    — a gear score ring + an owned/next-tier upgrade GRID using
 *                     the YouVideo/Upgrades art.
 *
 * Still Slate Glass: LinearGradientFallback only (colors[0] flat), elevation via
 * getGlass* / getPlatformShadows, no expo-blur, no raw boxShadow, no `as any`.
 * ZERO REMOVAL — every prior action/stat is re-homed and still reachable.
 *
 * Tabs: Channel / Record / Videos / Studio
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ImageBackground,
  ImageSourcePropType,
} from 'react-native';
import {
  ArrowLeft,
  Video as VideoIcon,
  Sparkles,
  Users,
  Eye,
  TrendingUp,
  Cpu,
  Activity,
  Star,
  Play,
  Clock,
  ChevronRight,
  Radio,
  Award,
  Gauge,
  Heart,
  MessageCircle,
  Flame,
  Wifi,
  HardDrive,
  MemoryStick,
  Monitor,
  Mic,
  Camera,
  Lightbulb,
  Armchair,
  Clapperboard,
  Fan,
  PlugZap,
  Box,
  CircuitBoard,
  Coins,
  Upload,
  Zap,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimerManager } from '@/hooks/useTimerManager';
import { computeQuality } from '@/lib/content/quality';
import { monetizationSummary } from '@/lib/content/monetization';
import { projectVideoOutcome } from '@/lib/content/algorithm';
import { trendingTopicForWeek, trendBonusForTopic } from '@/lib/content/trending';
import {
  publishVideo,
  buyAccessory,
  upgradePCComponent,
  ACCESSORY_PRICES,
  PC_BASE_PRICES,
} from '@/contexts/game/actions/ContentActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import {
  getGlassCard,
  getGlassIconContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import ProgressRing from '@/components/ui/ProgressRing';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { GamingStreamingState, Video } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

// Slate Glass identity accent for the Gaming app: violet #8B5CF6.
const IDENTITY = '#8B5CF6';
const IDENTITY_PAIR = '#7C3AED';
const tint = (alpha: number) => `rgba(139, 92, 246, ${alpha})`;

type TabType = 'channel' | 'record' | 'videos' | 'studio';
type SortType = 'recent' | 'views' | 'earnings';
type IconType = React.ComponentType<{ size: number; color: string }>;

// Mirrors MAX_VIDEOS_PER_WEEK inside ContentActions (display only).
const WEEKLY_VIDEO_CAP = 5;

const ACCESSORY_LABELS: Record<keyof GamingStreamingState['equipment'], string> = {
  microphone: 'Microphone',
  webcam: 'Webcam',
  gamingChair: 'Gaming chair',
  greenScreen: 'Green screen',
  lighting: 'Studio lights',
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

// Gear icons — always crisp + correct even where a photo stand-in is used.
const ACCESSORY_ICON: Record<keyof GamingStreamingState['equipment'], IconType> = {
  microphone: Mic,
  webcam: Camera,
  gamingChair: Armchair,
  greenScreen: Clapperboard,
  lighting: Lightbulb,
};
const PC_ICON: Record<keyof GamingStreamingState['pcUpgradeLevels'], IconType> = {
  cpu: Cpu,
  gpu: Monitor,
  ram: MemoryStick,
  ssd: HardDrive,
  motherboard: CircuitBoard,
  cooling: Fan,
  psu: PlugZap,
  case: Box,
  network: Wifi,
};

// Real gear art (require needs static literals). Keys without a clean photo
// fall through to a tinted icon panel — no misleading stand-ins.
const ACCESSORY_ART: Partial<Record<keyof GamingStreamingState['equipment'], ImageSourcePropType>> = {
  microphone: require('@/assets/images/YouVideo/Upgrades/microphone.png'),
  webcam: require('@/assets/images/YouVideo/Upgrades/webcam.png'),
  gamingChair: require('@/assets/images/YouVideo/Upgrades/video_editing.png'),
  greenScreen: require('@/assets/images/YouVideo/Upgrades/thumbnails.png'),
  lighting: require('@/assets/images/YouVideo/Upgrades/lightning.png'),
};
const PC_ART: Partial<Record<keyof GamingStreamingState['pcUpgradeLevels'], ImageSourcePropType>> = {
  cpu: require('@/assets/images/YouVideo/Upgrades/cpu.png'),
  gpu: require('@/assets/images/YouVideo/Upgrades/gpu.png'),
  ram: require('@/assets/images/YouVideo/Upgrades/ram.png'),
  ssd: require('@/assets/images/YouVideo/Upgrades/storage.png'),
  motherboard: require('@/assets/images/YouVideo/Upgrades/capture_card.png'),
  network: require('@/assets/images/YouVideo/Upgrades/seo.png'),
};

// Thumbnail art pool — matched by keyword, else a stable per-video hash so each
// video keeps ONE consistent cover (presentational, like an avatar color).
const GAME_THUMBS: { keys: string[]; src: ImageSourcePropType; label: string }[] = [
  { keys: ['fortnite'], src: require('@/assets/images/Games/Fortnite.png'), label: 'Fortnite' },
  { keys: ['minecraft'], src: require('@/assets/images/Games/Minecraft.png'), label: 'Minecraft' },
  { keys: ['valorant'], src: require('@/assets/images/Games/Valorant.png'), label: 'Valorant' },
  { keys: ['league', 'legends', 'lol'], src: require('@/assets/images/Games/League of Legends.png'), label: 'League of Legends' },
  { keys: ['among'], src: require('@/assets/images/Games/Among us.png'), label: 'Among Us' },
];

const GAME_OPTIONS = [
  'Tutorial',
  'Speedrun',
  'Boss Fight',
  'Lore Deep Dive',
  'Top 10 List',
  'Reaction',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function thumbIndexFor(v: Video): number {
  const hay = `${v.title ?? ''} ${v.game ?? ''} ${v.gameId ?? ''}`.toLowerCase();
  for (let i = 0; i < GAME_THUMBS.length; i++) {
    if (GAME_THUMBS[i].keys.some((k) => hay.includes(k))) return i;
  }
  return hashStr(v.id || v.title || 'x') % GAME_THUMBS.length;
}

function videoThumb(v: Video): ImageSourcePropType {
  return GAME_THUMBS[thumbIndexFor(v)].src;
}

function compact(n: number): string {
  const x = Math.max(0, Math.round(n || 0));
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(x >= 10_000 ? 0 : 1)}K`;
  return `${x}`;
}

interface Props {
  onBack: () => void;
}

export default function GamingApp({ onBack }: Props) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  // Auto-cleaned timers so the feedback-clear flash can't setState after unmount.
  const timers = useTimerManager();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('channel');
  const [title, setTitle] = useState('');
  const [selectedGame, setSelectedGame] = useState(GAME_OPTIONS[0]);
  const [feedback, setFeedback] = useState<string | null>(null);
  // list → detail routing (presentational; no new mechanics).
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoSort, setVideoSort] = useState<SortType>('recent');

  const channel = gameState.gamingStreaming;
  const videos = channel?.videos ?? [];
  const quality = useMemo(
    () => computeQuality(channel?.equipment, channel?.pcUpgradeLevels),
    [channel]
  );
  const monetization = useMemo(
    () => monetizationSummary(quality, channel?.paidMembers ?? 0, channel?.membershipRate),
    [quality, channel?.paidMembers, channel?.membershipRate]
  );

  const week = gameState.weeksLived || 0;
  // This week's trending topic (deterministic from the week). A matching upload
  // earns the already-wired, pre-clamped trendBonus reach boost.
  const trendingTopic = useMemo(() => trendingTopicForWeek(week, GAME_OPTIONS), [week]);
  const money = gameState.stats?.money ?? 0;
  const energy = gameState.stats?.energy ?? 0;

  // Previously-hidden channel aggregates — now surfaced.
  const subscribers = channel?.subscribers ?? 0;
  const totalViews = channel?.totalViews ?? 0;
  const followers = channel?.followers ?? 0;
  const streamHours = channel?.streamHours ?? 0;
  const avgViewers = channel?.averageViewers ?? 0;
  const totalDonations = channel?.totalDonations ?? 0;
  const totalSubEarnings = channel?.totalSubEarnings ?? 0;
  const totalEarnings = channel?.totalEarnings ?? 0;
  const level = channel?.level ?? 1;
  const experience = channel?.experience ?? 0;
  const paidMembers = channel?.paidMembers ?? 0;

  const ownedAccessories = useMemo(
    () =>
      (Object.keys(ACCESSORY_LABELS) as (keyof GamingStreamingState['equipment'])[]).filter(
        (k) => !!channel?.equipment?.[k]
      ).length,
    [channel?.equipment]
  );
  const pcTierSum = useMemo(
    () =>
      (Object.keys(PC_LABELS) as (keyof GamingStreamingState['pcUpgradeLevels'])[]).reduce(
        (s, k) => s + (channel?.pcUpgradeLevels?.[k] ?? 0),
        0
      ),
    [channel?.pcUpgradeLevels]
  );

  const uploadsThisWeek = channel?.lastVideoWeek === week ? channel?.videosThisWeek ?? 0 : 0;

  // Deterministic non-viral baseline projection using the real algorithm lib.
  // Includes this week's trend bonus when the chosen topic is hot, so the
  // preview reflects the reach the upload will actually get.
  const selectedTrendBonus = useMemo(
    () => trendBonusForTopic(selectedGame, week, GAME_OPTIONS),
    [selectedGame, week]
  );
  // Neutral (organic 1.0×, non-viral) baseline — the CENTRE of the estimate.
  const projected = useMemo(
    () => projectVideoOutcome({ quality, subscribers, rollViral: 1, trendBonus: selectedTrendBonus }),
    [quality, subscribers, selectedTrendBonus]
  );
  // Views now carry per-post organic variance, so the preview shows a plausible
  // RANGE rather than a fixed promise. The band mirrors the algorithm's typical
  // organic spread (~0.7×–1.6× of the neutral centre), excluding the rare viral
  // spike and the deepest flops.
  const projectedRange = useMemo(() => {
    // Guard against NaN/Infinity leaking into the displayed range from a
    // corrupt projection (would otherwise render "NaN–NaN").
    const views = isFinite(projected.views) ? Math.max(0, projected.views) : 0;
    const subs = isFinite(projected.subscribersGained) ? Math.max(0, projected.subscribersGained) : 0;
    const lowViews = Math.round(views * 0.7);
    const highViews = Math.round(views * 1.6);
    const lowSubs = Math.round(subs * 0.7);
    const highSubs = Math.round(subs * 1.6);
    return { lowViews, highViews, lowSubs, highSubs };
  }, [projected]);

  const sortedVideos = useMemo(() => {
    const arr = [...videos];
    if (videoSort === 'views') arr.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (videoSort === 'earnings') arr.sort((a, b) => (b.earnings || 0) - (a.earnings || 0));
    return arr; // 'recent' keeps publish order (newest-first)
  }, [videos, videoSort]);

  const avgVideoViews = videos.length ? Math.round(totalViews / videos.length) : 0;

  const selectedVideo = useMemo<Video | null>(
    () => (selectedVideoId ? videos.find((v) => v.id === selectedVideoId) ?? null : null),
    [selectedVideoId, videos]
  );
  const inDetail = !!selectedVideo;

  const flash = useCallback((message: string) => {
    setFeedback(message);
    timers.setTimeout(() => setFeedback(null), 2800);
  }, [timers]);

  const goBack = useCallback(() => {
    if (inDetail) setSelectedVideoId(null);
    else onBack();
  }, [inDetail, onBack]);

  const goTab = useCallback((tab: TabType) => {
    setSelectedVideoId(null);
    setActiveTab(tab);
  }, []);

  const openVideo = useCallback((id: string) => setSelectedVideoId(id), []);

  const handlePublish = useCallback(() => {
    if (!title.trim()) {
      flash('Enter a video title first.');
      return;
    }
    const r = publishVideo(
      gameState,
      setGameState,
      {
        title: title.trim(),
        game: selectedGame,
        trendBonus: trendBonusForTopic(selectedGame, week, GAME_OPTIONS),
      },
      { updateMoney },
      week
    );
    if (r.success) {
      saveGame();
      setTitle('');
      Alert.alert(r.outcome?.viral ? 'Viral hit!' : 'Uploaded', r.message);
    } else {
      flash(r.message);
    }
  }, [gameState, setGameState, saveGame, title, selectedGame, week, flash]);

  const handleAccessory = useCallback(
    (id: keyof GamingStreamingState['equipment']) => {
      const r = buyAccessory(gameState, setGameState, id, ACCESSORY_PRICES[id], { updateMoney });
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handlePCUpgrade = useCallback(
    (id: keyof GamingStreamingState['pcUpgradeLevels']) => {
      const r = upgradePCComponent(gameState, setGameState, id, PC_BASE_PRICES[id], { updateMoney });
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  // ── Channel tab (YouTube channel page) ─────────────────────────────────────
  const renderChannel = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* Recipe B hero — the channel header. */}
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
            colors={[tint(0.14), tint(0.03)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroBlob} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

          <View style={styles.chIdentityRow}>
            <View style={[styles.chAvatar, getPlatformShadows(5, 0.28, 2, 8)]}>
              <LinearGradient
                colors={[IDENTITY, IDENTITY_PAIR]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chAvatarInner}
              >
                <Play size={scale(22)} color="#fff" />
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>YOUVIDEO CHANNEL</Text>
              <Text style={[styles.chName, { color: theme.text }]} numberOfLines={1}>
                Your Channel
              </Text>
              <View style={styles.chMetaLine}>
                <Text style={[styles.chMetaText, { color: theme.textSecondary }]}>
                  {compact(subscribers)} subs
                </Text>
                <View style={[styles.chDot, { backgroundColor: theme.textMuted }]} />
                <Text style={[styles.chMetaText, { color: theme.textSecondary }]}>
                  {videos.length} videos
                </Text>
                <View style={[styles.chDot, { backgroundColor: theme.textMuted }]} />
                <Text style={[styles.chMetaText, { color: theme.textSecondary }]}>
                  {streamHours.toFixed(streamHours >= 100 ? 0 : 1)} watch hrs
                </Text>
              </View>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: tint(0.16), borderColor: tint(0.30) }]}>
              <Award size={scale(12)} color={IDENTITY} />
              <Text style={[styles.badgeText, { color: IDENTITY }]}>Lv {level}</Text>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Subscribers</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{subscribers.toLocaleString()}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Total views</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{totalViews.toLocaleString()}</Text>
            </View>
          </View>

          {/* Gear/quality bar — re-homed unchanged. */}
          <View style={[styles.qualityBar, { backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : theme.surfaceElevated }]}>
            <View style={[styles.qualityFill, { width: `${quality.total}%`, backgroundColor: qualityColor(quality.tier) }]} />
          </View>
          <Text style={[styles.qualityLabel, { color: qualityColor(quality.tier) }]}>
            Gear: {quality.total}/100 · {quality.tier.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Featured video — the big YouTube cover slot. */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Featured</Text>
        <QuietChip label="All videos" Icon={ChevronRight} onPress={() => goTab('videos')} />
      </View>
      {videos.length === 0 ? (
        <TouchableOpacity
          onPress={() => goTab('record')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Record your first video"
          style={[getGlassCard(darkMode, 6), styles.featuredEmpty, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[getGlassIconContainer(darkMode, 48), { backgroundColor: tint(0.15), borderColor: tint(0.30), borderWidth: 1 }]}>
            <VideoIcon size={scale(22)} color={IDENTITY} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No videos yet</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>Tap to record your first upload.</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => openVideo(videos[0].id)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Featured video ${videos[0].title}`}
          style={[getGlassCard(darkMode, 6), styles.featuredCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <VideoThumb v={videos[0]} style={styles.featuredThumb} scrim showPlay overlayTitle />
          <View style={styles.featuredBody}>
            <Text style={[styles.videoMeta, { color: theme.textSecondary }]} numberOfLines={1}>
              {videos[0].game ?? 'General'} · {videos[0].views.toLocaleString()} views · +{(videos[0].subscribersGained ?? 0).toLocaleString()} subs
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Monetization — KEEP RPM / Members / Total, densified with more rates. */}
      <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Monetization</Text>
        <View style={styles.statsRow}>
          <MoneyStat label="RPM" value={`$${monetization.rpm}`} color={accent.success} theme={theme} />
          <MoneyStat label="Members" value={paidMembers.toString()} color={accent.purple} theme={theme} />
          <MoneyStat label="Total $" value={`$${totalEarnings.toLocaleString()}`} color={accent.info} theme={theme} />
          <MoneyStat label="$/viewer" value={`$${monetization.viewerPay}`} color={accent.success} theme={theme} />
          <MoneyStat label="Members/wk" value={`$${monetization.membershipWeekly.toLocaleString()}`} color={accent.success} theme={theme} />
          <MoneyStat label="Donations" value={`$${totalDonations.toLocaleString()}`} color={accent.info} theme={theme} />
        </View>
      </View>

      {/* Channel analytics — previously-hidden aggregates. */}
      <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Channel analytics</Text>
        <View style={styles.aGrid}>
          <AnalyticStat Icon={Radio} label="Followers" value={compact(followers)} theme={theme} darkMode={darkMode} />
          <AnalyticStat Icon={Clock} label="Watch hrs" value={streamHours.toFixed(streamHours >= 100 ? 0 : 1)} theme={theme} darkMode={darkMode} />
          <AnalyticStat Icon={Eye} label="Avg viewers" value={compact(avgViewers)} theme={theme} darkMode={darkMode} />
          <AnalyticStat Icon={Coins} label="Sub earn" value={`$${compact(totalSubEarnings)}`} valueColor={accent.success} theme={theme} darkMode={darkMode} />
          <AnalyticStat Icon={Award} label="Level" value={`${level}`} theme={theme} darkMode={darkMode} />
          <AnalyticStat Icon={Zap} label="XP" value={compact(experience)} theme={theme} darkMode={darkMode} />
        </View>
      </View>

      {/* Recent videos — KEEP (up to 5), now thumbnail rows → detail. */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent videos</Text>
        {videos.length > 0 ? (
          <QuietChip label="See all" Icon={ChevronRight} onPress={() => goTab('videos')} />
        ) : null}
      </View>
      {videos.length === 0 ? (
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.emptySub, { color: theme.textMuted, textAlign: 'left' }]}>
            No videos yet — record one in the Record tab.
          </Text>
        </View>
      ) : (
        videos.slice(0, 5).map((v) => (
          <VideoRow key={v.id} v={v} week={week} onPress={() => openVideo(v.id)} theme={theme} darkMode={darkMode} />
        ))
      )}
    </ScrollView>
  );

  // ── Record tab (upload composer) ───────────────────────────────────────────
  const renderRecord = () => {
    const capped = uploadsThisWeek >= WEEKLY_VIDEO_CAP;
    const publishDisabled = !title.trim() || energy < 15 || capped;
    // Live preview stand-in so the composer is thumbnail-led like the real feed.
    // Cover keys off the topic (stable) but a game name typed in the title still
    // wins via VideoThumb's keyword match.
    const previewVideo: Video = { id: `preview_${selectedGame}`, title: title.trim() || 'Untitled video', game: selectedGame, views: projected.views, earnings: 0 };
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Recipe B hero — the composer. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <LinearGradient pointerEvents="none" colors={[tint(0.12), tint(0.03)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.heroBlob} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            <View style={styles.composerHeadRow}>
              <View style={[getGlassIconContainer(darkMode, 34), { backgroundColor: tint(0.15), borderColor: tint(0.30), borderWidth: 1 }]}>
                <Upload size={scale(15)} color={IDENTITY} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text, flex: 1 }]}>New video</Text>
              <View style={[styles.badgeChip, { backgroundColor: tint(0.16), borderColor: tint(0.30) }]}>
                <Gauge size={scale(12)} color={IDENTITY} />
                <Text style={[styles.badgeText, { color: IDENTITY }]}>{quality.tier.toUpperCase()}</Text>
              </View>
            </View>

            {/* Thumbnail preview — updates live from title + topic. */}
            <VideoThumb v={previewVideo} style={styles.previewThumb} scrim showPlay overlayTitle badge="PREVIEW" />

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Video title…"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <View style={styles.topicHeadRow}>
              <Text style={[styles.label, { color: theme.textMuted, marginTop: 0 }]}>Topic</Text>
              {trendingTopic ? (
                <View style={[styles.trendChip, { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.35)' }]}>
                  <Flame size={scale(11)} color={accent.warning} />
                  <Text style={[styles.trendChipText, { color: accent.warning }]} numberOfLines={1}>
                    Trending: {trendingTopic}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.chipsRow}>
              {GAME_OPTIONS.map((g) => {
                const active = selectedGame === g;
                const hot = g === trendingTopic;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setSelectedGame(g)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={hot ? `${g} (trending, boosted reach)` : g}
                    style={[styles.chip, { backgroundColor: active ? tint(0.16) : 'transparent', borderColor: active ? tint(0.30) : hot ? 'rgba(245,158,11,0.35)' : theme.border }]}
                  >
                    {hot ? <Flame size={scale(11)} color={accent.warning} /> : null}
                    <Text style={[styles.chipText, { color: active ? IDENTITY : hot ? accent.warning : theme.textSecondary }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={handlePublish}
              disabled={publishDisabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Record and upload"
              accessibilityState={{ disabled: publishDisabled }}
              style={[styles.publishBtn, { backgroundColor: publishDisabled ? theme.surfaceElevated : IDENTITY }, !publishDisabled && getPlatformShadows(5, 0.3, 2, 8)]}
            >
              <LinearGradient
                colors={publishDisabled ? [theme.surfaceElevated, theme.surfaceElevated] : [IDENTITY, IDENTITY_PAIR]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.publishBtnInner}
              >
                <Sparkles size={scale(16)} color={publishDisabled ? theme.textMuted : 'white'} />
                <Text style={[styles.publishBtnText, { color: publishDisabled ? theme.textMuted : 'white' }]}>{capped ? 'Weekly cap reached' : 'Record & upload'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Projected performance — real algorithm baseline (non-viral). */}
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Projected reach</Text>
          <View style={styles.aGrid}>
            <AnalyticStat Icon={Eye} label="Est. views" value={`${compact(projectedRange.lowViews)}–${compact(projectedRange.highViews)}`} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={Users} label="Est. subs" value={`+${compact(projectedRange.lowSubs)}–${compact(projectedRange.highSubs)}`} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={TrendingUp} label="At tier" value={quality.tier.toUpperCase()} valueColor={qualityColor(quality.tier)} theme={theme} darkMode={darkMode} />
          </View>
          <Text style={[styles.recordHint, { color: theme.textMuted }]}>
            Recording costs 15 energy. Every upload performs a little differently — most land in this range, a lucky few go viral. Revenue scales with your {quality.tier.toUpperCase()} gear.
          </Text>
        </View>

        {/* Weekly upload meter + energy — anti-exploit cap made visible. */}
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.meterHeadRow}>
            <Text style={[styles.meterLabel, { color: theme.textSecondary }]}>Uploads this week</Text>
            <Text style={[styles.meterValue, { color: capped ? accent.warning : theme.text }]}>{uploadsThisWeek}/{WEEKLY_VIDEO_CAP}</Text>
          </View>
          <View style={[styles.meterBar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : theme.surfaceElevated }]}>
            <View style={[styles.meterFill, { width: `${Math.min(100, (uploadsThisWeek / WEEKLY_VIDEO_CAP) * 100)}%`, backgroundColor: capped ? accent.warning : IDENTITY }]} />
          </View>
          <View style={styles.energyRow}>
            <Zap size={scale(13)} color={energy < 15 ? accent.danger : accent.warning} />
            <Text style={[styles.energyText, { color: theme.textSecondary }]}>
              Energy {Math.round(energy)} <Text style={{ color: theme.textMuted }}>/ 15 needed</Text>
            </Text>
            <View style={{ flex: 1 }} />
            <QuietChip label="Upgrade gear" Icon={Cpu} onPress={() => goTab('studio')} />
          </View>
        </View>
      </ScrollView>
    );
  };

  // ── Videos tab (thumbnail grid + sort) ─────────────────────────────────────
  const renderVideos = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {videos.length === 0 ? (
        <View style={styles.empty}>
          <View style={[getGlassIconContainer(darkMode, 64), { backgroundColor: tint(0.15), borderColor: tint(0.30), borderWidth: 1 }]}>
            <VideoIcon size={scale(28)} color={IDENTITY} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Catalog empty</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>Upload your first video to start building income.</Text>
          <QuietChip label="Go to Record" Icon={VideoIcon} onPress={() => goTab('record')} />
        </View>
      ) : (
        <>
          {/* Recipe B hero — catalog summary. */}
          <View style={[getGlassCard(darkMode, 12), styles.heroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
            <View style={[styles.heroInner, { gap: sp.md }]}>
              <LinearGradient pointerEvents="none" colors={[tint(0.12), tint(0.03)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={styles.heroBlob} />
              {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>YOUR CATALOG</Text>
              <View style={styles.heroRow}>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Videos</Text>
                  <Text style={[styles.heroValue, { color: theme.text }]}>{videos.length}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Total views</Text>
                  <Text style={[styles.heroValue, { color: theme.text }]}>{compact(totalViews)}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Earned</Text>
                  <Text style={[styles.heroValue, { color: accent.success }]}>${compact(totalEarnings)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Sort chips. */}
          <View style={styles.sortRow}>
            <SortChip label="Recent" Icon={Clock} active={videoSort === 'recent'} onPress={() => setVideoSort('recent')} theme={theme} />
            <SortChip label="Most viewed" Icon={Eye} active={videoSort === 'views'} onPress={() => setVideoSort('views')} theme={theme} />
            <SortChip label="Top earning" Icon={Flame} active={videoSort === 'earnings'} onPress={() => setVideoSort('earnings')} theme={theme} />
          </View>

          {sortedVideos.map((v) => (
            <VideoCard key={v.id} v={v} week={week} onPress={() => openVideo(v.id)} theme={theme} darkMode={darkMode} />
          ))}
        </>
      )}
    </ScrollView>
  );

  // ── Video detail sub-page ──────────────────────────────────────────────────
  const renderDetail = (v: Video) => {
    const delta = avgVideoViews > 0 ? Math.round(((v.views - avgVideoViews) / avgVideoViews) * 100) : 0;
    const up = delta >= 0;
    const age = v.uploadedAt != null ? Math.max(0, week - v.uploadedAt) : null;
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <View style={[getGlassCard(darkMode, 12), styles.detailHeroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <VideoThumb v={v} style={styles.detailThumb} scrim showPlay />
        </View>

        <Text style={[styles.detailTitle, { color: theme.text }]}>{v.title}</Text>
        <View style={styles.detailMetaRow}>
          <View style={[styles.miniChip, { backgroundColor: tint(0.14), borderColor: tint(0.30) }]}>
            <Text style={[styles.miniChipText, { color: IDENTITY }]}>{v.game ?? 'General'}</Text>
          </View>
          {age != null ? (
            <View style={[styles.miniChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Clock size={scale(11)} color={theme.textMuted} />
              <Text style={[styles.miniChipText, { color: theme.textMuted }]}>{age === 0 ? 'This week' : `${age}w ago`}</Text>
            </View>
          ) : null}
          <View style={[styles.miniChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Gauge size={scale(11)} color={qualityColor(quality.tier)} />
            <Text style={[styles.miniChipText, { color: theme.textMuted }]}>Quality {v.quality ?? '?'}/100</Text>
          </View>
        </View>

        {/* Full per-video readout — surfaces fields the list never showed. */}
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Performance</Text>
          <View style={styles.aGrid}>
            <AnalyticStat Icon={Eye} label="Views" value={v.views.toLocaleString()} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={TrendingUp} label="Earned" value={`$${v.earnings.toLocaleString()}`} valueColor={accent.success} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={Users} label="Subs" value={`+${(v.subscribersGained ?? 0).toLocaleString()}`} theme={theme} darkMode={darkMode} />
            {v.rpm != null ? <AnalyticStat Icon={Coins} label="RPM ×" value={`${v.rpm}`} theme={theme} darkMode={darkMode} /> : null}
            {v.likes != null ? <AnalyticStat Icon={Heart} label="Likes" value={compact(v.likes)} theme={theme} darkMode={darkMode} /> : null}
            {v.comments != null ? <AnalyticStat Icon={MessageCircle} label="Comments" value={compact(v.comments)} theme={theme} darkMode={darkMode} /> : null}
          </View>
          <View style={[styles.perfBanner, { backgroundColor: up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
            <TrendingUp size={scale(14)} color={up ? accent.success : accent.danger} />
            <Text style={[styles.perfText, { color: up ? accent.success : accent.danger }]}>
              {up ? '+' : ''}{delta}% vs channel average ({compact(avgVideoViews)} views)
            </Text>
          </View>
        </View>

        <QuietChip label="Back to all videos" Icon={ChevronRight} onPress={() => setSelectedVideoId(null)} block />
      </ScrollView>
    );
  };

  // ── Studio tab (gear grid) ─────────────────────────────────────────────────
  const renderStudio = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* Recipe B hero — gear score ring + breakdown. */}
      <View style={[getGlassCard(darkMode, 12), styles.heroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
        <View style={[styles.heroInner, styles.studioHeroInner]}>
          <LinearGradient pointerEvents="none" colors={[tint(0.14), tint(0.03)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.heroBlob} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
          <ProgressRing
            value={quality.total}
            size={96}
            strokeWidth={8}
            accentColor={IDENTITY}
            trackColor={darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(148,163,184,0.25)'}
            surfaceColor={theme.surface}
            borderColor={darkMode ? theme.glassBorder : theme.border}
            inkColor={theme.text}
            ambient={false}
            label={`Gear score ${quality.total} of 100`}
          >
            <Gauge size={scale(22)} color={IDENTITY} />
          </ProgressRing>
          <View style={styles.studioHeroBody}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>GEAR SCORE</Text>
            <Text style={[styles.chName, { color: qualityColor(quality.tier) }]}>{quality.tier.toUpperCase()} rig</Text>
            <View style={styles.studioBreakdown}>
              <View style={[styles.miniChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.miniChipText, { color: theme.textSecondary }]}>Accessories {ownedAccessories}/5</Text>
              </View>
              <View style={[styles.miniChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.miniChipText, { color: theme.textSecondary }]}>PC tiers {pcTierSum}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Accessories grid. */}
      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: sp.xs }]}>Accessories</Text>
      <View style={styles.gearGrid}>
        {(Object.keys(ACCESSORY_LABELS) as (keyof GamingStreamingState['equipment'])[]).map((k) => {
          const owned = !!channel?.equipment?.[k];
          return (
            <GearTile
              key={k}
              title={ACCESSORY_LABELS[k]}
              price={ACCESSORY_PRICES[k] ?? 0}
              art={ACCESSORY_ART[k]}
              Icon={ACCESSORY_ICON[k]}
              owned={owned}
              actionLabel={owned ? 'Owned' : 'Buy'}
              onPress={() => handleAccessory(k)}
              disabled={owned}
              theme={theme}
              darkMode={darkMode}
            />
          );
        })}
      </View>

      {/* PC components grid. */}
      <Text style={[styles.sectionTitle, { color: theme.text, marginTop: sp.sm }]}>PC components</Text>
      <View style={styles.gearGrid}>
        {(Object.keys(PC_LABELS) as (keyof GamingStreamingState['pcUpgradeLevels'])[]).map((k) => {
          const tier = channel?.pcUpgradeLevels?.[k] ?? 0;
          const cost = Math.round(PC_BASE_PRICES[k] * Math.pow(2, tier));
          return (
            <GearTile
              key={k}
              title={PC_LABELS[k]}
              price={cost}
              art={PC_ART[k]}
              Icon={PC_ICON[k]}
              tier={tier}
              actionLabel={tier > 0 ? `Tier ${tier + 1}` : 'Upgrade'}
              onPress={() => handlePCUpgrade(k)}
              theme={theme}
              darkMode={darkMode}
            />
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerBtn}
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{inDetail ? 'Video' : 'YouVideo'}</Text>
        <View style={[styles.cashChip, { backgroundColor: tint(0.14), borderColor: tint(0.30) }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>${money.toLocaleString()}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, { borderColor: theme.border }]}>
        {[
          { id: 'channel' as TabType, label: 'Channel', Icon: Activity },
          { id: 'record' as TabType, label: 'Record', Icon: VideoIcon },
          { id: 'videos' as TabType, label: 'Videos', Icon: Star },
          { id: 'studio' as TabType, label: 'Studio', Icon: Cpu },
        ].map(({ id, label, Icon }) => {
          const active = !inDetail && activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => goTab(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tabBtn, active && { borderBottomColor: IDENTITY, borderBottomWidth: 2 }]}
            >
              <Icon size={scale(14)} color={active ? IDENTITY : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? IDENTITY : theme.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {inDetail && selectedVideo
        ? renderDetail(selectedVideo)
        : activeTab === 'channel'
        ? renderChannel()
        : activeTab === 'record'
        ? renderRecord()
        : activeTab === 'videos'
        ? renderVideos()
        : renderStudio()}

      {feedback ? (
        <View style={[styles.toast, getPlatformShadows(8, 0.2, 0, 16), { backgroundColor: theme.surface, borderColor: tint(0.30), bottom: getAppScreenBottomPadding(insets.bottom) }]}>
          <Text style={[styles.toastText, { color: theme.text }]}>{feedback}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Presentational building blocks ───────────────────────────────────────────

function VideoThumb({
  v,
  style,
  scrim,
  showPlay,
  overlayTitle,
  badge,
}: {
  v: Video;
  style: any;
  scrim?: boolean;
  showPlay?: boolean;
  overlayTitle?: boolean;
  badge?: string;
}) {
  const durStr = typeof v.duration === 'string' && v.duration.trim() ? v.duration.trim() : null;
  return (
    <ImageBackground source={videoThumb(v)} style={[styles.thumbBase, style]} imageStyle={styles.thumbImg} resizeMode="cover">
      {scrim ? <View pointerEvents="none" style={styles.thumbScrim} /> : null}
      {badge ? (
        <View pointerEvents="none" style={[styles.thumbBadge, { backgroundColor: tint(0.92) }]}>
          <Text style={styles.thumbBadgeText}>{badge}</Text>
        </View>
      ) : null}
      {showPlay ? (
        <View pointerEvents="none" style={styles.thumbPlayWrap}>
          <View style={styles.thumbPlayBtn}>
            <Play size={scale(18)} color="#fff" />
          </View>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.thumbChipRow}>
        <View style={styles.thumbChip}>
          <Eye size={scale(10)} color="#fff" />
          <Text style={styles.thumbChipText}>{compact(v.views)}</Text>
        </View>
        {durStr ? (
          <View style={styles.thumbChip}>
            <Clock size={scale(10)} color="#fff" />
            <Text style={styles.thumbChipText}>{durStr}</Text>
          </View>
        ) : v.game ? (
          <View style={styles.thumbChip}>
            <Text style={styles.thumbChipText}>{v.game}</Text>
          </View>
        ) : null}
      </View>
      {overlayTitle ? (
        <View pointerEvents="none" style={styles.thumbTitleWrap}>
          <Text style={styles.thumbTitleText} numberOfLines={2}>{v.title}</Text>
        </View>
      ) : null}
    </ImageBackground>
  );
}

function VideoRow({
  v,
  week,
  onPress,
  theme,
  darkMode,
}: {
  v: Video;
  week: number;
  onPress: () => void;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  const age = v.uploadedAt != null ? Math.max(0, week - v.uploadedAt) : null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open video ${v.title}`}
      style={[getGlassCard(darkMode, 6), styles.vRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <VideoThumb v={v} style={styles.rowThumb} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={2}>{v.title}</Text>
        <Text style={[styles.videoMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {v.views.toLocaleString()} views · ${v.earnings.toLocaleString()}
          {age != null ? ` · ${age === 0 ? 'new' : `${age}w`}` : ''}
        </Text>
      </View>
      <ChevronRight size={scale(18)} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

function VideoCard({
  v,
  week,
  onPress,
  theme,
  darkMode,
}: {
  v: Video;
  week: number;
  onPress: () => void;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  const age = v.uploadedAt != null ? Math.max(0, week - v.uploadedAt) : null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Open video ${v.title}`}
      style={[getGlassCard(darkMode, 6), styles.vCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <VideoThumb v={v} style={styles.cardThumb} scrim showPlay />
      <View style={styles.vCardBody}>
        <Text style={[styles.bigVideoTitle, { color: theme.text }]} numberOfLines={2}>{v.title}</Text>
        <Text style={[styles.videoMeta, { color: theme.textSecondary }]} numberOfLines={1}>
          {v.game ?? 'General'} · quality {v.quality ?? '?'}/100{age != null ? ` · ${age === 0 ? 'this week' : `${age}w ago`}` : ''}
        </Text>
        <View style={styles.videoStatRow}>
          <VideoStat Icon={Eye} value={v.views.toLocaleString()} color={accent.info} theme={theme} />
          <VideoStat Icon={Users} value={`+${(v.subscribersGained ?? 0).toLocaleString()}`} color={accent.purple} theme={theme} />
          <VideoStat Icon={TrendingUp} value={`$${v.earnings.toLocaleString()}`} color={accent.success} theme={theme} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GearTile({
  title,
  price,
  art,
  Icon,
  owned,
  tier,
  actionLabel,
  onPress,
  disabled,
  theme,
  darkMode,
}: {
  title: string;
  price: number;
  art?: ImageSourcePropType;
  Icon: IconType;
  owned?: boolean;
  tier?: number;
  actionLabel: string;
  onPress: () => void;
  disabled?: boolean;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${owned ? 'owned' : `$${price.toLocaleString()}`}`}
      accessibilityState={{ disabled: !!disabled, selected: !!owned }}
      style={[getGlassCard(darkMode, 6), styles.gearTile, { backgroundColor: theme.surface, borderColor: owned ? 'rgba(16,185,129,0.35)' : theme.border }]}
    >
      <View style={styles.gearMediaClip}>
        {art ? (
          <Image source={art} style={styles.gearMediaImg} resizeMode="cover" />
        ) : (
          <View style={[styles.gearIconPanel, { backgroundColor: tint(0.14) }]}>
            <Icon size={scale(30)} color={IDENTITY} />
          </View>
        )}
        <View style={[styles.gearIconBadge, getGlassIconContainer(darkMode, 26), { backgroundColor: tint(0.16), borderColor: tint(0.30), borderWidth: 1 }]}>
          <Icon size={scale(12)} color={IDENTITY} />
        </View>
        {tier != null && tier > 0 ? (
          <View style={[styles.gearTierBadge, { backgroundColor: tint(0.92) }]}>
            <Text style={styles.gearTierText}>T{tier}</Text>
          </View>
        ) : null}
        {owned ? (
          <View style={[styles.gearTierBadge, { backgroundColor: 'rgba(16,185,129,0.95)' }]}>
            <Text style={styles.gearTierText}>Owned</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.gearTileName, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.gearTileFooter}>
        <Text style={[styles.gearTilePrice, { color: owned ? accent.success : theme.textSecondary }]} numberOfLines={1}>
          {owned ? 'In your kit' : `$${price.toLocaleString()}`}
        </Text>
        <View style={[styles.gearAction, { backgroundColor: owned ? 'rgba(16,185,129,0.16)' : tint(0.16) }]}>
          <Text style={[styles.gearActionText, { color: owned ? accent.success : IDENTITY }]}>{actionLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SortChip({
  label,
  Icon,
  active,
  onPress,
  theme,
}: {
  label: string;
  Icon: IconType;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Sort by ${label}`}
      style={[styles.sortChip, { backgroundColor: active ? tint(0.16) : 'transparent', borderColor: active ? tint(0.30) : theme.border }]}
    >
      <Icon size={scale(13)} color={active ? IDENTITY : theme.textMuted} />
      <Text style={[styles.sortChipText, { color: active ? IDENTITY : theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuietChip({
  label,
  Icon,
  onPress,
  block,
}: {
  label: string;
  Icon: IconType;
  onPress: () => void;
  block?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.quietChip, { backgroundColor: tint(0.14) }, block && styles.quietChipBlock]}
    >
      <Icon size={scale(13)} color={IDENTITY} />
      <Text style={[styles.quietChipText, { color: IDENTITY }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AnalyticStat({
  Icon,
  label,
  value,
  valueColor,
  theme,
  darkMode,
}: {
  Icon: IconType;
  label: string;
  value: string;
  valueColor?: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  return (
    <View style={styles.aStat}>
      <View style={[getGlassIconContainer(darkMode, 30), { backgroundColor: tint(0.15), borderColor: tint(0.30), borderWidth: 1 }]}>
        <Icon size={scale(13)} color={IDENTITY} />
      </View>
      <Text style={[styles.aValue, { color: valueColor ?? theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={[styles.aLabel, { color: theme.textSecondary }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function MoneyStat({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.moneyStat}>
      <Text style={[styles.moneyValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
        {value}
      </Text>
      <Text style={[styles.moneyLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function VideoStat({
  Icon,
  value,
  color,
  theme,
}: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  value: string;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.videoStat}>
      <Icon size={scale(14)} color={color} />
      <Text style={[styles.videoStatText, { color: theme.text }]}>{value}</Text>
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
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    gap: sp.sm,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: fs.lg, fontWeight: '700' },
  cashChip: { paddingHorizontal: sp.sm, paddingVertical: scale(4), borderRadius: br.full, borderWidth: 1 },
  cashChipText: { fontSize: fs.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: sp.xs },
  tabText: { fontSize: fs.sm, fontWeight: '700' },

  // Recipe B hero.
  heroCard: { borderRadius: br['2xl'], borderWidth: 1 },
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.sm },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(139, 92, 246, 0.10)',
  },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  heroEyebrow: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: sp.md },
  heroStat: { gap: scale(2) },
  heroLabel: { fontSize: fs.xs },
  heroValue: { fontSize: fs['2xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  qualityBar: { height: scale(8), borderRadius: br.full, overflow: 'hidden', marginTop: sp.xs },
  qualityFill: { height: '100%', borderRadius: br.full },
  qualityLabel: { fontSize: fs.xs, fontWeight: '700' },

  // Channel header identity.
  chIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  chAvatar: { width: scale(52), height: scale(52), borderRadius: br.lg },
  chAvatarInner: { flex: 1, borderRadius: br.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chName: { fontSize: fs.lg, fontWeight: '800' },
  chMetaLine: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, flexWrap: 'wrap', marginTop: scale(2) },
  chMetaText: { fontSize: fs.xs, fontWeight: '600' },
  chDot: { width: scale(3), height: scale(3), borderRadius: scale(1.5) },
  badgeChip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: sp.sm, paddingVertical: scale(5), borderRadius: br.full, borderWidth: 1 },
  badgeText: { fontSize: fs.xs, fontWeight: '800', letterSpacing: 0.3 },

  // Section headers with an action chip.
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.sm },
  sectionTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },

  // Featured cover.
  featuredCard: { borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  featuredThumb: { width: '100%', aspectRatio: 16 / 9 },
  featuredBody: { padding: sp.md },
  featuredEmpty: { borderRadius: br.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.xs },

  // Thumbnail primitive.
  thumbBase: { backgroundColor: '#0B1220', justifyContent: 'flex-end' },
  thumbImg: { borderRadius: 0 },
  thumbScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%', backgroundColor: 'rgba(0,0,0,0.35)' },
  thumbPlayWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  thumbPlayBtn: {
    width: scale(44), height: scale(44), borderRadius: scale(22),
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  thumbChipRow: { position: 'absolute', top: sp.sm, right: sp.sm, flexDirection: 'row', gap: sp.xs },
  thumbChip: {
    flexDirection: 'row', alignItems: 'center', gap: scale(3),
    backgroundColor: 'rgba(0,0,0,0.66)', paddingHorizontal: scale(7), paddingVertical: scale(3), borderRadius: br.sm,
  },
  thumbChipText: { color: '#fff', fontSize: fs.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  thumbBadge: { position: 'absolute', top: sp.sm, left: sp.sm, paddingHorizontal: scale(7), paddingVertical: scale(3), borderRadius: br.sm },
  thumbBadgeText: { color: '#fff', fontSize: fs.xs, fontWeight: '800', letterSpacing: 0.6 },
  thumbTitleWrap: { padding: sp.md },
  thumbTitleText: { color: '#fff', fontSize: fs.md, fontWeight: '800' },

  // Recent-video rows.
  vRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.xl, borderWidth: 1 },
  rowThumb: { width: scale(112), height: scale(64), borderRadius: br.md, overflow: 'hidden' },
  videoTitle: { fontSize: fs.sm, fontWeight: '700' },
  videoMeta: { fontSize: fs.xs },

  // Video cards (Videos tab).
  vCard: { borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  cardThumb: { width: '100%', aspectRatio: 16 / 9 },
  vCardBody: { padding: sp.md, gap: sp.xs },
  bigVideoTitle: { fontSize: fs.md, fontWeight: '800' },
  videoStatRow: { flexDirection: 'row', gap: sp.md, marginTop: sp.xs, flexWrap: 'wrap' },
  videoStat: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  videoStatText: { fontSize: fs.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Sort chips.
  sortRow: { flexDirection: 'row', gap: sp.xs, flexWrap: 'wrap' },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: scale(5),
    minHeight: scale(36), paddingHorizontal: sp.md, borderRadius: br.full, borderWidth: 1,
  },
  sortChipText: { fontSize: fs.xs, fontWeight: '700' },

  // Quiet tinted action chips.
  quietChip: {
    flexDirection: 'row', alignItems: 'center', gap: scale(5),
    minHeight: scale(36), paddingHorizontal: sp.md, borderRadius: br.full,
  },
  quietChipBlock: { justifyContent: 'center' },
  quietChipText: { fontSize: fs.xs, fontWeight: '800' },

  // Stat cards / grids.
  statsCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: sp.xs },
  moneyStat: { alignItems: 'center', flexBasis: '30%', flexGrow: 1, minWidth: scale(96) },
  moneyValue: { fontSize: fs.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  moneyLabel: { fontSize: fs.xs, marginTop: 2 },
  aGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  aStat: { alignItems: 'center', gap: scale(3), flexBasis: '30%', flexGrow: 1, minWidth: scale(92), paddingVertical: sp.xs },
  aValue: { fontSize: fs.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  aLabel: { fontSize: fs.xs, fontWeight: '600' },

  // Record composer.
  composerHeadRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  previewThumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: br.lg, overflow: 'hidden', marginTop: sp.xs },
  input: { borderWidth: 1, borderRadius: br.lg, paddingHorizontal: sp.md, paddingVertical: sp.sm, fontSize: fs.md },
  label: { fontSize: fs.xs, fontWeight: '700', textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), minHeight: scale(36), justifyContent: 'center', paddingHorizontal: sp.md, borderRadius: br.full, borderWidth: 1 },
  chipText: { fontSize: fs.xs, fontWeight: '700' },
  topicHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.xs, marginTop: sp.sm },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: sp.sm, paddingVertical: scale(4), borderRadius: br.full, borderWidth: 1, maxWidth: '62%' },
  trendChipText: { fontSize: fs.xs, fontWeight: '800' },
  recordHint: { fontSize: fs.xs, fontStyle: 'italic' },

  // Meters.
  meterHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: { fontSize: fs.sm, fontWeight: '600' },
  meterValue: { fontSize: fs.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meterBar: { height: scale(8), borderRadius: br.full, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: br.full },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
  energyText: { fontSize: fs.xs, fontWeight: '700' },

  // Recipe D CTA.
  publishBtn: { borderRadius: br.full, marginTop: sp.xs },
  publishBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.sm,
    minHeight: touchTargets.minimum, paddingHorizontal: sp.md, borderRadius: br.full, overflow: 'hidden',
  },
  publishBtnText: { fontSize: fs.md, fontWeight: '800' },

  // Video detail.
  detailHeroCard: { borderRadius: br['2xl'], borderWidth: 1, overflow: 'hidden' },
  detailThumb: { width: '100%', aspectRatio: 16 / 9 },
  detailTitle: { fontSize: fs.xl, fontWeight: '800' },
  detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: sp.sm, paddingVertical: scale(5), borderRadius: br.full, borderWidth: 1 },
  miniChipText: { fontSize: fs.xs, fontWeight: '700' },
  perfBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.lg, marginTop: sp.xs },
  perfText: { fontSize: fs.xs, fontWeight: '700' },

  // Studio hero + gear grid.
  studioHeroInner: { flexDirection: 'row', alignItems: 'center', gap: sp.lg },
  studioHeroBody: { flex: 1, gap: scale(3) },
  studioBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginTop: sp.xs },
  gearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  gearTile: { flexBasis: '47%', flexGrow: 1, minWidth: scale(150), borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  gearMediaClip: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#0B1220' },
  gearMediaImg: { width: '100%', height: '100%' },
  gearIconPanel: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gearIconBadge: { position: 'absolute', top: sp.sm, left: sp.sm, alignItems: 'center', justifyContent: 'center' },
  gearTierBadge: { position: 'absolute', top: sp.sm, right: sp.sm, paddingHorizontal: scale(7), paddingVertical: scale(3), borderRadius: br.sm },
  gearTierText: { color: '#fff', fontSize: fs.xs, fontWeight: '800' },
  gearTileName: { fontSize: fs.sm, fontWeight: '800', paddingHorizontal: sp.md, paddingTop: sp.sm },
  gearTileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.xs, paddingHorizontal: sp.md, paddingBottom: sp.md, paddingTop: sp.xs },
  gearTilePrice: { fontSize: fs.xs, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  gearAction: { minHeight: scale(36), justifyContent: 'center', paddingHorizontal: sp.md, borderRadius: br.full },
  gearActionText: { fontSize: fs.xs, fontWeight: '800' },

  // Empty states.
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },

  // Toast.
  toast: { position: 'absolute', bottom: sp.lg, left: sp.md, right: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  toastText: { fontSize: fs.sm, fontWeight: '600' },
});
