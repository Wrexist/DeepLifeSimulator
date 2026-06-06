/**
 * GamingApp (YouVideo) — full rewrite (Remake 12).
 *
 * Was 3,762 LOC with its own divergent monetization formula. Now delegates
 * to the shared `lib/content/` libs and `ContentActions.ts`. Sibling
 * GamingStreamingApp uses the same foundation.
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
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { computeQuality } from '@/lib/content/quality';
import { monetizationSummary } from '@/lib/content/monetization';
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
} from '@/utils/scaling';
import { GamingStreamingState } from '@/contexts/game/types';

type TabType = 'channel' | 'record' | 'videos' | 'studio';

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

const GAME_OPTIONS = [
  'Tutorial',
  'Speedrun',
  'Boss Fight',
  'Lore Deep Dive',
  'Top 10 List',
  'Reaction',
];

interface Props {
  onBack: () => void;
}

export default function GamingApp({ onBack }: Props) {
  const { gameState, setGameState, saveGame } = useGame();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('channel');
  const [title, setTitle] = useState('');
  const [selectedGame, setSelectedGame] = useState(GAME_OPTIONS[0]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const channel = gameState.gamingStreaming;
  const videos = channel?.videos ?? [];
  const quality = useMemo(
    () => computeQuality(channel?.equipment, channel?.pcUpgradeLevels),
    [channel]
  );
  const monetization = useMemo(
    () => monetizationSummary(quality, channel?.paidMembers ?? 0),
    [quality, channel?.paidMembers]
  );

  const week = gameState.weeksLived || 0;
  const money = gameState.stats?.money ?? 0;
  const energy = gameState.stats?.energy ?? 0;

  const flash = useCallback((message: string) => {
    setFeedback(message);
    setTimeout(() => setFeedback(null), 2800);
  }, []);

  const handlePublish = useCallback(() => {
    if (!title.trim()) {
      flash('Enter a video title first.');
      return;
    }
    const r = publishVideo(
      gameState,
      setGameState,
      { title: title.trim(), game: selectedGame },
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

  const renderChannel = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Subscribers</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {(channel?.subscribers ?? 0).toLocaleString()}
            </Text>
          </View>
          <View>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Total views</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {(channel?.totalViews ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={[styles.qualityBar, { backgroundColor: theme.surfaceElevated }]}>
          <View
            style={[
              styles.qualityFill,
              { width: `${quality.total}%`, backgroundColor: qualityColor(quality.tier) },
            ]}
          />
        </View>
        <Text style={[styles.qualityLabel, { color: qualityColor(quality.tier) }]}>
          Gear: {quality.total}/100 · {quality.tier.toUpperCase()}
        </Text>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Monetization</Text>
        <View style={styles.statsRow}>
          <MoneyStat label="RPM" value={`$${monetization.rpm}`} color={accent.success} theme={theme} />
          <MoneyStat label="Members" value={(channel?.paidMembers ?? 0).toString()} color={accent.purple} theme={theme} />
          <MoneyStat label="Total $" value={`$${(channel?.totalEarnings ?? 0).toLocaleString()}`} color={accent.info} theme={theme} />
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent videos</Text>
        {videos.length === 0 ? (
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            No videos yet — record one in the Record tab.
          </Text>
        ) : (
          videos.slice(0, 5).map((v) => (
            <View key={v.id} style={styles.videoRow}>
              <VideoIcon size={scale(14)} color={accent.info} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={1}>
                  {v.title}
                </Text>
                <Text style={[styles.videoMeta, { color: theme.textSecondary }]}>
                  {v.views.toLocaleString()} views · ${v.earnings.toLocaleString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderRecord = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>New video</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Video title…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Topic</Text>
        <View style={styles.chipsRow}>
          {GAME_OPTIONS.map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => setSelectedGame(g)}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedGame === g ? accent.info : 'transparent',
                  borderColor: selectedGame === g ? accent.info : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selectedGame === g ? 'white' : theme.textSecondary },
                ]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.recordHint, { color: theme.textSecondary }]}>
          Recording uses 15 energy. Expected views and revenue scale with gear tier ({quality.tier.toUpperCase()}).
        </Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={!title.trim() || energy < 15}
          style={[
            styles.publishBtn,
            { backgroundColor: !title.trim() || energy < 15 ? accent.muted : accent.success },
          ]}
        >
          <Sparkles size={scale(14)} color="white" />
          <Text style={styles.publishBtnText}>Record &amp; upload</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderVideos = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      {videos.length === 0 ? (
        <View style={styles.empty}>
          <VideoIcon size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Catalog empty</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Upload your first video to start building income.
          </Text>
        </View>
      ) : (
        videos.map((v) => (
          <View
            key={v.id}
            style={[styles.bigVideoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.bigVideoTitle, { color: theme.text }]}>{v.title}</Text>
            <Text style={[styles.videoMeta, { color: theme.textSecondary }]}>
              {v.game ?? 'General'} · quality {v.quality ?? '?'}/100
            </Text>
            <View style={styles.videoStatRow}>
              <VideoStat Icon={Eye} value={v.views.toLocaleString()} color={accent.info} theme={theme} />
              <VideoStat Icon={Users} value={`+${(v.subscribersGained ?? 0).toLocaleString()}`} color={accent.purple} theme={theme} />
              <VideoStat Icon={TrendingUp} value={`$${v.earnings.toLocaleString()}`} color={accent.success} theme={theme} />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderStudio = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Accessories</Text>
        {(Object.keys(ACCESSORY_LABELS) as (keyof GamingStreamingState['equipment'])[]).map((k) => {
          const owned = !!channel?.equipment?.[k];
          return (
            <View key={k} style={styles.gearRow}>
              <Text style={[styles.gearName, { color: theme.text, flex: 1 }]}>{ACCESSORY_LABELS[k]}</Text>
              <Text style={[styles.gearPrice, { color: theme.textSecondary }]}>
                ${(ACCESSORY_PRICES[k] ?? 0).toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={() => handleAccessory(k)}
                disabled={owned}
                style={[
                  styles.smallBtn,
                  { backgroundColor: owned ? accent.success : accent.info },
                ]}
              >
                <Text style={styles.smallBtnText}>{owned ? 'Owned' : 'Buy'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>PC components</Text>
        {(Object.keys(PC_LABELS) as (keyof GamingStreamingState['pcUpgradeLevels'])[]).map((k) => {
          const tier = channel?.pcUpgradeLevels?.[k] ?? 0;
          const cost = Math.round(PC_BASE_PRICES[k] * Math.pow(2, tier));
          return (
            <View key={k} style={styles.gearRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gearName, { color: theme.text }]}>{PC_LABELS[k]}</Text>
                <Text style={[styles.gearMeta, { color: theme.textSecondary }]}>Tier {tier}</Text>
              </View>
              <Text style={[styles.gearPrice, { color: theme.textSecondary }]}>
                ${cost.toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={() => handlePCUpgrade(k)}
                style={[styles.smallBtn, { backgroundColor: accent.purple }]}
              >
                <Text style={styles.smallBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <ArrowLeft size={scale(18)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>YouVideo</Text>
        <Text style={[styles.headerCash, { color: accent.success }]}>${money.toLocaleString()}</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {[
          { id: 'channel' as TabType, label: 'Channel', Icon: Activity },
          { id: 'record' as TabType, label: 'Record', Icon: VideoIcon },
          { id: 'videos' as TabType, label: 'Videos', Icon: Star },
          { id: 'studio' as TabType, label: 'Studio', Icon: Cpu },
        ].map(({ id, label, Icon }) => (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            style={[
              styles.tabBtn,
              activeTab === id && { borderBottomColor: accent.info, borderBottomWidth: 2 },
            ]}
          >
            <Icon size={scale(14)} color={activeTab === id ? accent.info : theme.textSecondary} />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === id ? accent.info : theme.textSecondary },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'channel' && renderChannel()}
      {activeTab === 'record' && renderRecord()}
      {activeTab === 'videos' && renderVideos()}
      {activeTab === 'studio' && renderStudio()}

      {feedback ? (
        <View style={[styles.toast, { backgroundColor: theme.surface, borderColor: accent.info }]}>
          <Text style={{ color: theme.text }}>{feedback}</Text>
        </View>
      ) : null}
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
      <Text
        style={[styles.moneyValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
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
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs.xl, fontWeight: '800' },
  headerCash: { fontSize: fs.md, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: sp.xs },
  tabText: { fontSize: fs.sm, fontWeight: '700' },
  heroCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.sm },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroLabel: { fontSize: fs.xs },
  heroValue: { fontSize: fs['2xl'], fontWeight: '800' },
  qualityBar: { height: scale(8), borderRadius: br.full, overflow: 'hidden' },
  qualityFill: { height: '100%', borderRadius: br.full },
  qualityLabel: { fontSize: fs.xs, fontWeight: '700' },
  statsCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.sm },
  sectionTitle: { fontSize: fs.sm, fontWeight: '800', textTransform: 'uppercase' },
  // Wrap so 3-up rows of money values drop cleanly to 2-per-row when needed.
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: sp.xs },
  moneyStat: { alignItems: 'center', flexBasis: '30%', flexGrow: 1, minWidth: scale(96) },
  moneyValue: { fontSize: fs.lg, fontWeight: '800' },
  moneyLabel: { fontSize: fs.xs, marginTop: 2 },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  videoTitle: { fontSize: fs.sm, fontWeight: '700' },
  videoMeta: { fontSize: fs.xs },
  bigVideoCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.xs },
  bigVideoTitle: { fontSize: fs.md, fontWeight: '800' },
  videoStatRow: { flexDirection: 'row', gap: sp.md, marginTop: sp.sm },
  videoStat: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  videoStatText: { fontSize: fs.xs, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: br.md, paddingHorizontal: sp.md, paddingVertical: sp.sm, fontSize: fs.md },
  label: { fontSize: fs.xs, fontWeight: '700', textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  chip: { paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.full, borderWidth: 1 },
  chipText: { fontSize: fs.xs, fontWeight: '700' },
  recordHint: { fontSize: fs.xs, fontStyle: 'italic' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.md, borderRadius: br.md, justifyContent: 'center' },
  publishBtnText: { color: 'white', fontSize: fs.md, fontWeight: '800' },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingVertical: sp.xs },
  gearName: { fontSize: fs.sm, fontWeight: '700' },
  gearMeta: { fontSize: fs.xs },
  gearPrice: { fontSize: fs.xs },
  smallBtn: { paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.md },
  smallBtnText: { color: 'white', fontSize: fs.xs, fontWeight: '700' },
  toast: {
    position: 'absolute',
    bottom: sp.lg,
    left: sp.md,
    right: sp.md,
    padding: sp.md,
    borderRadius: br.lg,
    borderWidth: 1,
  },
});
