/**
 * GamingApp (YouVideo) - the video half of the creator career.
 *
 *   • Record tab    - the LANDING tab, because it holds the primary action: an
 *                     upload composer with a live thumbnail preview, projected
 *                     reach, the weekly-upload meter and the energy readout.
 *   • Channel tab   - the channel header, the featured video, three numbers a
 *                     creator decides on (followers / total earned / RPM) and
 *                     the remaining twelve behind "All channel stats".
 *   • Videos tab    - thumbnail-led video cards with sort chips; each opens a
 *                     video DETAIL sub-page (list → detail routing).
 *   • Studio tab    - the gear-score ring plus the gear as plain buy rows.
 *
 * Built on the shared app primitives (AppHeader/CashChip, SegmentedControl,
 * StatStrip, Chip, SectionTitle, EmptyState, CollapsibleSection, useToast) so
 * it reads the same as every other launcher-hosted app. One identity colour
 * (accent.purple, shared with Streaming - the two halves of one career) and
 * ONE gradient in the file: the "Record & upload" primary action.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ImageBackground,
  ImageSourcePropType,
} from 'react-native';
import {
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
  Check,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  MAX_PC_TIER,
} from '@/contexts/game/actions/ContentActions';
import { formatMoney } from '@/utils/moneyFormatting';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
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
import ImageScrim from '@/components/ui/ImageScrim';
import Gradient from '@/components/ui/Gradient';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import KeyValueRow from '@/components/ui/KeyValueRow';
import { useToast } from '@/contexts/ToastContext';
import { GamingStreamingState, Video } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

const LinearGradient = Gradient;

// The deep stop of the ONE gradient in this file (the upload CTA). Everything
// else tints accent.purple through withAlpha.
const IDENTITY_DEEP = '#7C3AED';

type TabType = 'channel' | 'record' | 'videos' | 'studio';
type SortType = 'recent' | 'views' | 'earnings';
type IconType = React.ComponentType<{ size?: number; color?: string }>;

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

// Gear icons - always crisp + correct even where a photo stand-in is used.
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

// Thumbnail art pool - matched by keyword, else a stable per-video hash so each
// video keeps ONE consistent cover (presentational, like an avatar color).
const GAME_THUMBS: { keys: string[]; src: ImageSourcePropType; label: string }[] = [
  { keys: ['fortnite'], src: require('@/assets/images/Games/Fortnite.webp'), label: 'Fortnite' },
  { keys: ['minecraft'], src: require('@/assets/images/Games/Minecraft.webp'), label: 'Minecraft' },
  { keys: ['valorant'], src: require('@/assets/images/Games/Valorant.webp'), label: 'Valorant' },
  { keys: ['league', 'legends', 'lol'], src: require('@/assets/images/Games/League of Legends.webp'), label: 'League of Legends' },
  { keys: ['among'], src: require('@/assets/images/Games/Among us.webp'), label: 'Among Us' },
];

const SORTS: { key: SortType; label: string; icon: IconType }[] = [
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'views', label: 'Most viewed', icon: Eye },
  { key: 'earnings', label: 'Top earning', icon: Flame },
];

const TABS: { key: TabType; label: string; icon: IconType }[] = [
  { key: 'record', label: 'Record', icon: VideoIcon },
  { key: 'channel', label: 'Channel', icon: Activity },
  { key: 'videos', label: 'Videos', icon: Star },
  { key: 'studio', label: 'Studio', icon: Cpu },
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
  const { showToast } = useToast();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  // Lands on Record: the tab that holds the primary action.
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [title, setTitle] = useState('');
  const [selectedGame, setSelectedGame] = useState(GAME_OPTIONS[0]);
  // list → detail routing (presentational; no new mechanics).
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [videoSort, setVideoSort] = useState<SortType>('recent');

  const channel = gameState.gamingStreaming;
  const videos = useMemo(() => channel?.videos ?? [], [channel?.videos]);
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

  // Previously-hidden channel aggregates - now surfaced.
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
  // Neutral (organic 1.0×, non-viral) baseline - the CENTRE of the estimate.
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

  const flash = useCallback((message: string) => showToast(message, 'info'), [showToast]);

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
      week
    );
    if (r.success) {
      saveGame();
      setTitle('');
      gameAlert(r.outcome?.viral ? 'Viral hit!' : 'Uploaded', r.message);
    } else {
      flash(r.message);
    }
  }, [gameState, setGameState, saveGame, title, selectedGame, week, flash]);

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

  // ── Channel tab (YouTube channel page) ─────────────────────────────────────
  const renderChannel = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* Recipe B hero - the channel header. */}
      <View
        style={[
          getGlassCard(darkMode, 12),
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
        ]}
      >
        <View style={styles.heroInner}>

          <View style={styles.chIdentityRow}>
            <View style={[styles.chAvatar, { backgroundColor: withAlpha(accent.purple, 0.18), borderColor: withAlpha(accent.purple, 0.35) }]}>
              <Play size={scale(22)} color={accent.purple} />
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
            <Chip label={`Lv ${level}`} icon={<Award size={scale(12)} color={accent.purple} />} tint={accent.purple} accessibilityLabel={`Channel level ${level}`} />
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

          <ProgressBar value={quality.total / 100} color={qualityColor(quality.tier)} height={scale(8)} label="Gear score" style={styles.qualityBar} />
          <Text style={[styles.qualityLabel, { color: qualityColor(quality.tier) }]}>
            Gear: {quality.total}/100 · {quality.tier.toUpperCase()}
          </Text>
        </View>
      </View>

      {videos.length === 0 ? (
        <EmptyState
          icon={<VideoIcon size={scale(24)} color={accent.purple} />}
          observation="Your channel has no videos yet."
          nudge="One upload starts the earnings, the subscribers and the catalog."
          ctaLabel="Record your first video"
          onCtaPress={() => goTab('record')}
        />
      ) : (
        <>
          <SectionTitle
            title="Featured"
            right={<Chip label="All videos" icon={<ChevronRight size={scale(12)} color={accent.purple} />} tint={accent.purple} onPress={() => goTab('videos')} />}
          />
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
        </>
      )}

      {/* The three numbers a creator actually decides on. The other twelve are
          a record of what happened, not an input - they live behind the fold. */}
      <StatStrip
        items={[
          { label: 'Followers', value: compact(followers) },
          { label: 'Total $', value: formatMoney(totalEarnings), tint: accent.success },
          { label: 'RPM', value: `$${monetization.rpm}` },
        ]}
      />

      <CollapsibleSection
        id="youvideo-all-stats"
        title="All channel stats"
        defaultCollapsed
        tint={accent.purple}
        summary={`${paidMembers} members · ${compact(totalViews)} views`}
      >
        <KeyValueRow label="Members" value={paidMembers.toLocaleString()} />
        <KeyValueRow label="$ / viewer" value={`$${monetization.viewerPay}`} />
        <KeyValueRow label="Members / wk" value={formatMoney(monetization.membershipWeekly)} />
        <KeyValueRow label="Donations" value={formatMoney(totalDonations)} />
        <KeyValueRow label="Sub earnings" value={formatMoney(totalSubEarnings)} />
        <KeyValueRow label="Total views" value={totalViews.toLocaleString()} />
        <KeyValueRow label="Watch hours" value={streamHours.toFixed(streamHours >= 100 ? 0 : 1)} />
        <KeyValueRow label="Average viewers" value={compact(avgViewers)} />
        <KeyValueRow label="Level" value={`${level}`} />
        <KeyValueRow label="Experience" value={compact(experience)} />
      </CollapsibleSection>

      {videos.length > 0 ? (
        <>
          <SectionTitle
            title="Recent videos"
            right={<Chip label="See all" icon={<ChevronRight size={scale(12)} color={accent.purple} />} tint={accent.purple} onPress={() => goTab('videos')} />}
          />
          {videos.slice(0, 5).map((v) => (
            <VideoRow key={v.id} v={v} week={week} onPress={() => openVideo(v.id)} theme={theme} darkMode={darkMode} />
          ))}
        </>
      ) : null}
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
        {/* Recipe B hero - the composer. */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>

            <View style={styles.composerHeadRow}>
              <View style={[getGlassIconContainer(darkMode, 34), { backgroundColor: withAlpha(accent.purple, 0.15), borderColor: withAlpha(accent.purple, 0.30), borderWidth: 1 }]}>
                <Upload size={scale(15)} color={accent.purple} />
              </View>
              <Text style={[styles.composerTitle, { color: theme.text }]}>New video</Text>
              <Chip label={quality.tier.toUpperCase()} icon={<Gauge size={scale(12)} color={accent.purple} />} tint={accent.purple} accessibilityLabel={`Gear tier ${quality.tier}`} />
            </View>

            {/* Thumbnail preview - updates live from title + topic. */}
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
                <Chip label={`Trending: ${trendingTopic}`} icon={<Flame size={scale(11)} color={accent.warning} />} tone="warning" />
              ) : null}
            </View>
            <View style={styles.chipsRow}>
              {GAME_OPTIONS.map((g) => {
                const active = selectedGame === g;
                const hot = g === trendingTopic;
                return (
                  <Chip
                    key={g}
                    label={g}
                    size="md"
                    icon={hot ? <Flame size={scale(11)} color={accent.warning} /> : undefined}
                    tint={active ? accent.purple : hot ? accent.warning : undefined}
                    selected={active}
                    onPress={() => setSelectedGame(g)}
                    accessibilityLabel={hot ? `${g} (trending, boosted reach)` : g}
                  />
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
              style={[styles.publishBtn, { backgroundColor: publishDisabled ? theme.surfaceElevated : accent.purple }, !publishDisabled && getPlatformShadows(5, 0.3, 2, 8)]}
            >
              <LinearGradient
                colors={publishDisabled ? [theme.surfaceElevated, theme.surfaceElevated] : [accent.purple, IDENTITY_DEEP]}
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

        {/* Projected performance - real algorithm baseline (non-viral). */}
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Projected reach</Text>
          <View style={styles.aGrid}>
            <AnalyticStat Icon={Eye} label="Est. views" value={`${compact(projectedRange.lowViews)}–${compact(projectedRange.highViews)}`} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={Users} label="Est. subs" value={`+${compact(projectedRange.lowSubs)}–${compact(projectedRange.highSubs)}`} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={TrendingUp} label="At tier" value={quality.tier.toUpperCase()} valueColor={qualityColor(quality.tier)} theme={theme} darkMode={darkMode} />
          </View>
          <Text style={[styles.recordHint, { color: theme.textMuted }]}>
            Recording costs 15 energy. Every upload performs a little differently - most land in this range, a lucky few go viral. Revenue scales with your {quality.tier.toUpperCase()} gear.
          </Text>
        </View>

        {/* Weekly upload meter + energy - anti-exploit cap made visible. */}
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.meterHeadRow}>
            <Text style={[styles.meterLabel, { color: theme.textSecondary }]}>Uploads this week</Text>
            <Text style={[styles.meterValue, { color: capped ? accent.warning : theme.text }]}>{uploadsThisWeek}/{WEEKLY_VIDEO_CAP}</Text>
          </View>
          <ProgressBar
            value={uploadsThisWeek / WEEKLY_VIDEO_CAP}
            color={capped ? accent.warning : accent.purple}
            height={scale(8)}
            label="Uploads this week"
          />
          <View style={styles.energyRow}>
            <Zap size={scale(13)} color={energy < 15 ? accent.danger : accent.warning} />
            <Text style={[styles.energyText, { color: theme.textSecondary }]}>
              Energy {Math.round(energy)} <Text style={{ color: theme.textMuted }}>/ 15 needed</Text>
            </Text>
            <View style={{ flex: 1 }} />
            <Chip label="Upgrade gear" icon={<Cpu size={scale(12)} color={accent.purple} />} tint={accent.purple} onPress={() => goTab('studio')} />
          </View>
        </View>
      </ScrollView>
    );
  };

  // ── Videos tab (thumbnail grid + sort) ─────────────────────────────────────
  const renderVideos = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {videos.length === 0 ? (
        <EmptyState
          icon={<VideoIcon size={scale(28)} color={accent.purple} />}
          observation="Your catalog is empty."
          nudge="Every video keeps earning after it lands, so the first one is the one that compounds."
          ctaLabel="Go to Record"
          onCtaPress={() => goTab('record')}
        />
      ) : (
        <>
          {/* Recipe B hero - catalog summary. */}
          <View style={[getGlassCard(darkMode, 12), styles.heroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
            <View style={[styles.heroInner, { gap: sp.md }]}>
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
            {SORTS.map(({ key, label, icon: Icon }) => (
              <Chip
                key={key}
                label={label}
                size="md"
                icon={<Icon size={scale(13)} color={videoSort === key ? accent.purple : theme.textMuted} />}
                tint={videoSort === key ? accent.purple : undefined}
                selected={videoSort === key}
                onPress={() => setVideoSort(key)}
                accessibilityLabel={`Sort by ${label}`}
              />
            ))}
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
          <Chip label={v.game ?? 'General'} tint={accent.purple} />
          {age != null ? (
            <Chip label={age === 0 ? 'This week' : `${age}w ago`} icon={<Clock size={scale(11)} color={theme.textMuted} />} />
          ) : null}
          <Chip label={`Quality ${v.quality ?? '?'}/100`} icon={<Gauge size={scale(11)} color={qualityColor(quality.tier)} />} />
        </View>

        {/* Full per-video readout - surfaces fields the list never showed. */}
        <View style={[getGlassCard(darkMode, 6), styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Performance</Text>
          <View style={styles.aGrid}>
            <AnalyticStat Icon={Eye} label="Views" value={v.views.toLocaleString()} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={TrendingUp} label="Earned" value={formatMoney(v.earnings)} valueColor={accent.success} theme={theme} darkMode={darkMode} />
            <AnalyticStat Icon={Users} label="Subs" value={`+${(v.subscribersGained ?? 0).toLocaleString()}`} theme={theme} darkMode={darkMode} />
            {v.rpm != null ? <AnalyticStat Icon={Coins} label="RPM ×" value={`${v.rpm}`} theme={theme} darkMode={darkMode} /> : null}
            {v.likes != null ? <AnalyticStat Icon={Heart} label="Likes" value={compact(v.likes)} theme={theme} darkMode={darkMode} /> : null}
            {v.comments != null ? <AnalyticStat Icon={MessageCircle} label="Comments" value={compact(v.comments)} theme={theme} darkMode={darkMode} /> : null}
          </View>
          <View style={[styles.perfBanner, { backgroundColor: withAlpha(up ? accent.success : accent.danger, 0.12) }]}>
            <TrendingUp size={scale(14)} color={up ? accent.success : accent.danger} />
            <Text style={[styles.perfText, { color: up ? accent.success : accent.danger }]}>
              {up ? '+' : ''}{delta}% vs channel average ({compact(avgVideoViews)} views)
            </Text>
          </View>
        </View>

        <View style={styles.detailBackRow}>
          <Chip
            label="Back to all videos"
            size="md"
            icon={<ChevronRight size={scale(13)} color={accent.purple} />}
            tint={accent.purple}
            onPress={() => setSelectedVideoId(null)}
          />
        </View>
      </ScrollView>
    );
  };

  // ── Studio tab (gear grid) ─────────────────────────────────────────────────
  const renderStudio = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* Recipe B hero - gear score ring + breakdown. */}
      <View style={[getGlassCard(darkMode, 12), styles.heroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
        <View style={[styles.heroInner, styles.studioHeroInner]}>
          <ProgressRing
            value={quality.total}
            size={96}
            strokeWidth={8}
            accentColor={accent.purple}
            trackColor={darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(148,163,184,0.25)'}
            surfaceColor={theme.surface}
            borderColor={darkMode ? theme.glassBorder : theme.border}
            inkColor={theme.text}
            ambient={false}
            label={`Gear score ${quality.total} of 100`}
          >
            <Gauge size={scale(22)} color={accent.purple} />
          </ProgressRing>
          <View style={styles.studioHeroBody}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>GEAR SCORE</Text>
            <Text style={[styles.chName, { color: qualityColor(quality.tier) }]}>{quality.tier.toUpperCase()} rig</Text>
            <View style={styles.studioBreakdown}>
              <Chip label={`Accessories ${ownedAccessories}/5`} />
              <Chip label={`PC tiers ${pcTierSum}`} />
            </View>
          </View>
        </View>
      </View>

      <SectionTitle title="Studio kit" subtitle="One-time buys that lift your gear score." />
      <View style={styles.gearList}>
        {(Object.keys(ACCESSORY_LABELS) as (keyof GamingStreamingState['equipment'])[]).map((k) => {
          const owned = !!channel?.equipment?.[k];
          return (
            <GearRow
              key={k}
              title={ACCESSORY_LABELS[k]}
              Icon={ACCESSORY_ICON[k]}
              priceLabel={owned ? 'In your kit' : formatMoney(ACCESSORY_PRICES[k] ?? 0)}
              actionLabel={owned ? 'Owned' : 'Buy'}
              done={owned}
              onPress={() => handleAccessory(k)}
              accessibilityLabel={owned ? `${ACCESSORY_LABELS[k]}, owned` : `${ACCESSORY_LABELS[k]}, ${formatMoney(ACCESSORY_PRICES[k] ?? 0)}`}
              theme={theme}
              darkMode={darkMode}
            />
          );
        })}
      </View>

      <SectionTitle title="PC components" subtitle={`Upgrade tiers up to T${MAX_PC_TIER} - each tier adds gear score.`} />
      <View style={styles.gearList}>
        {(Object.keys(PC_LABELS) as (keyof GamingStreamingState['pcUpgradeLevels'])[]).map((k) => {
          const tier = channel?.pcUpgradeLevels?.[k] ?? 0;
          const maxed = tier >= MAX_PC_TIER;
          const cost = Math.round(PC_BASE_PRICES[k] * Math.pow(2, tier));
          return (
            <GearRow
              key={k}
              title={PC_LABELS[k]}
              Icon={PC_ICON[k]}
              tier={tier}
              // The tier chip shows what you OWN; the action names the TARGET,
              // so the two can never be read as the same number.
              priceLabel={maxed ? 'Max tier' : formatMoney(cost)}
              actionLabel={maxed ? 'Maxed' : `→ T${tier + 1}`}
              done={maxed}
              onPress={() => handlePCUpgrade(k)}
              accessibilityLabel={
                maxed
                  ? `${PC_LABELS[k]}, maxed at tier ${tier}`
                  : `${PC_LABELS[k]}, tier ${tier}, upgrade to tier ${tier + 1} for ${formatMoney(cost)}`
              }
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
      <AppHeader
        title={inDetail ? 'Video' : 'YouVideo'}
        onBack={goBack}
        backLabel={inDetail ? 'Back to videos' : 'Back'}
        right={<CashChip value={formatMoney(money)} tint={accent.purple} />}
      />

      <SegmentedControl
        segments={TABS}
        value={activeTab}
        onChange={goTab}
        activeColor={accent.purple}
        style={styles.tabs}
      />

      {inDetail && selectedVideo
        ? renderDetail(selectedVideo)
        : activeTab === 'channel'
        ? renderChannel()
        : activeTab === 'record'
        ? renderRecord()
        : activeTab === 'videos'
        ? renderVideos()
        : renderStudio()}
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
      {scrim ? <ImageScrim height={0.55} strength={0.5} color="#000000" /> : null}
      {badge ? (
        <View pointerEvents="none" style={[styles.thumbBadge, { backgroundColor: withAlpha(accent.purple, 0.92) }]}>
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
          {v.views.toLocaleString()} views · {formatMoney(v.earnings)}
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
          <VideoStat Icon={TrendingUp} value={formatMoney(v.earnings)} color={accent.success} theme={theme} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function GearRow({
  title,
  Icon,
  tier,
  priceLabel,
  actionLabel,
  done,
  onPress,
  accessibilityLabel,
  theme,
  darkMode,
}: {
  title: string;
  Icon: IconType;
  tier?: number;
  priceLabel: string;
  actionLabel: string;
  done: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={done}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: done, selected: done }}
      style={[getGlassCard(darkMode, 6), styles.gearRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View
        style={[
          getGlassIconContainer(darkMode, 36),
          { backgroundColor: withAlpha(accent.purple, 0.15), borderColor: withAlpha(accent.purple, 0.3), borderWidth: 1 },
        ]}
      >
        <Icon size={scale(16)} color={accent.purple} />
      </View>
      <View style={styles.gearRowBody}>
        <Text style={[styles.gearRowName, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.gearRowPrice, { color: done ? accent.success : theme.textSecondary }]} numberOfLines={1}>
          {priceLabel}
        </Text>
      </View>
      {tier != null && tier > 0 ? <Chip label={`T${tier}`} tint={done ? accent.success : accent.purple} /> : null}
      <View style={[styles.gearAction, { backgroundColor: done ? withAlpha(accent.success, 0.16) : withAlpha(accent.purple, 0.16) }]}>
        {done ? <Check size={scale(12)} color={accent.success} /> : null}
        <Text style={[styles.gearActionText, { color: done ? accent.success : accent.purple }]}>{actionLabel}</Text>
      </View>
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
      <View style={[getGlassIconContainer(darkMode, 30), { backgroundColor: withAlpha(accent.purple, 0.15), borderColor: withAlpha(accent.purple, 0.30), borderWidth: 1 }]}>
        <Icon size={scale(13)} color={accent.purple} />
      </View>
      <Text style={[styles.aValue, { color: valueColor ?? theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={[styles.aLabel, { color: theme.textSecondary }]} numberOfLines={1}>{label}</Text>
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
  tabs: { marginHorizontal: sp.md, marginBottom: sp.sm },

  // Recipe B hero.
  heroCard: { borderRadius: br['2xl'], borderWidth: 1 },
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.sm },
  heroEyebrow: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: sp.md },
  heroStat: { gap: scale(2) },
  heroLabel: { fontSize: fs.xs },
  heroValue: { fontSize: fs['2xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  qualityBar: { marginTop: sp.xs },
  qualityLabel: { fontSize: fs.xs, fontWeight: '600' },

  // Channel header identity.
  chIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  chAvatar: { width: scale(52), height: scale(52), borderRadius: br.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chName: { fontSize: fs.lg, fontWeight: '600' },
  chMetaLine: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, flexWrap: 'wrap', marginTop: scale(2) },
  chMetaText: { fontSize: fs.xs, fontWeight: '600' },
  chDot: { width: scale(3), height: scale(3), borderRadius: scale(1.5) },

  // Section headers with an action chip.

  // Featured cover.
  featuredCard: { borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  featuredThumb: { width: '100%', height: scale(200) },
  featuredBody: { padding: sp.md },

  // Thumbnail primitive.
  thumbBase: { backgroundColor: '#0B1220', justifyContent: 'flex-end' },
  thumbImg: { borderRadius: 0 },
  // (the flat `thumbScrim` band is gone - VideoThumb renders ImageScrim)
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
  thumbChipText: { color: '#fff', fontSize: fs.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },
  thumbBadge: { position: 'absolute', top: sp.sm, left: sp.sm, paddingHorizontal: scale(7), paddingVertical: scale(3), borderRadius: br.sm },
  thumbBadgeText: { color: '#fff', fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.6 },
  thumbTitleWrap: { padding: sp.md },
  thumbTitleText: { color: '#fff', fontSize: fs.md, fontWeight: '700' },

  // Recent-video rows.
  vRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.xl, borderWidth: 1 },
  rowThumb: { width: scale(112), height: scale(64), borderRadius: br.md, overflow: 'hidden' },
  videoTitle: { fontSize: fs.sm, fontWeight: '600' },
  videoMeta: { fontSize: fs.xs },

  // Video cards (Videos tab).
  vCard: { borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  cardThumb: { width: '100%', height: scale(170) },
  vCardBody: { padding: sp.md, gap: sp.xs },
  bigVideoTitle: { fontSize: fs.md, fontWeight: '600' },
  videoStatRow: { flexDirection: 'row', gap: sp.md, marginTop: sp.xs, flexWrap: 'wrap' },
  videoStat: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  videoStatText: { fontSize: fs.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Sort chips.
  sortRow: { flexDirection: 'row', gap: sp.xs, flexWrap: 'wrap' },

  // Quiet tinted action chips.

  // Stat cards / grids.
  statsCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  aGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  aStat: { alignItems: 'center', gap: scale(3), flexBasis: '30%', flexGrow: 1, minWidth: scale(92), paddingVertical: sp.xs },
  aValue: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
  aLabel: { fontSize: fs.xs, fontWeight: '600' },

  // Record composer.
  composerTitle: { flex: 1, fontSize: fs.md, fontWeight: '600', letterSpacing: 0.2 },
  cardTitle: { fontSize: fs.md, fontWeight: '600', letterSpacing: 0.2 },
  composerHeadRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  previewThumb: { width: '100%', height: scale(160), borderRadius: br.lg, overflow: 'hidden', marginTop: sp.xs },
  input: { borderWidth: 1, borderRadius: br.lg, paddingHorizontal: sp.md, paddingVertical: sp.sm, fontSize: fs.md },
  label: { fontSize: fs.xs, fontWeight: '600', textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  topicHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.xs, marginTop: sp.sm },
  recordHint: { fontSize: fs.xs, fontStyle: 'italic' },

  // Meters.
  meterHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: { fontSize: fs.sm, fontWeight: '600' },
  meterValue: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, marginTop: sp.xs },
  energyText: { fontSize: fs.xs, fontWeight: '600' },

  // Recipe D CTA.
  publishBtn: { borderRadius: br.full, marginTop: sp.xs },
  publishBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.sm,
    minHeight: touchTargets.minimum, paddingHorizontal: sp.md, borderRadius: br.full, overflow: 'hidden',
  },
  publishBtnText: { fontSize: fs.md, fontWeight: '600' },

  // Video detail.
  detailHeroCard: { borderRadius: br['2xl'], borderWidth: 1, overflow: 'hidden' },
  detailThumb: { width: '100%', height: scale(200) },
  detailTitle: { fontSize: fs.xl, fontWeight: '800' },
  detailBackRow: { flexDirection: 'row', justifyContent: 'center', marginTop: sp.xs },
  detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  perfBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.lg, marginTop: sp.xs },
  perfText: { fontSize: fs.xs, fontWeight: '600' },

  // Key/value rows behind "All channel stats".

  // Studio hero + gear rows.
  studioHeroInner: { flexDirection: 'row', alignItems: 'center', gap: sp.lg },
  studioHeroBody: { flex: 1, gap: scale(3) },
  studioBreakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginTop: sp.xs },
  gearList: { gap: sp.sm },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.xl, borderWidth: 1, minHeight: touchTargets.minimum },
  gearRowBody: { flex: 1, gap: scale(2) },
  gearRowName: { fontSize: fs.sm, fontWeight: '600' },
  gearRowPrice: { fontSize: fs.xs, fontVariant: ['tabular-nums'] },
  gearAction: { minHeight: scale(36), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(4), paddingHorizontal: sp.md, borderRadius: br.full },
  gearActionText: { fontSize: fs.xs, fontWeight: '600' },

  // Empty states.

  // Toast.
});
