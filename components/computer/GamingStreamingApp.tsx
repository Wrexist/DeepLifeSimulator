/**
 * GamingStreamingApp — full rewrite (Remake 13).
 *
 * Was 3,946 LOC with a divergent monetization formula from the sibling
 * GamingApp. Now both pull from `lib/content/` + `ContentActions.ts`.
 *
 * Tabs: Dashboard / Go Live / History / Shop
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Radio,
  Activity,
  Users,
  Heart,
  History,
  ShoppingBag,
  Zap,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimerManager } from '@/hooks/useTimerManager';
import { computeQuality } from '@/lib/content/quality';
import { monetizationSummary } from '@/lib/content/monetization';
import {
  runStream,
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
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { GamingStreamingState } from '@/contexts/game/types';

type TabType = 'dashboard' | 'live' | 'history' | 'shop';

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
  { id: 'fps', name: 'Just Chatting', viewersHint: 'Wide audience' },
  { id: 'rpg', name: 'RPG Marathon', viewersHint: 'Loyal core' },
  { id: 'esports', name: 'Competitive', viewersHint: 'Skill-based hype' },
  { id: 'creative', name: 'Creative / Art', viewersHint: 'Niche, sticky' },
  { id: 'speedrun', name: 'Speedrun', viewersHint: 'Big spikes if PB' },
];

const DURATIONS: { label: string; minutes: number; energy: number }[] = [
  { label: 'Quick (30 min)',  minutes: 30,  energy: 15 },
  { label: 'Standard (60 min)', minutes: 60, energy: 25 },
  { label: 'Marathon (180 min)', minutes: 180, energy: 60 },
];

interface Props {
  onBack: () => void;
}

export default function GamingStreamingApp({ onBack }: Props) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  // Auto-cleaned timers so the feedback-clear flash can't setState after unmount.
  const timers = useTimerManager();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedGame, setSelectedGame] = useState(GAME_OPTIONS[0]);
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[1]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const channel = gameState.gamingStreaming;
  const streamHistory = channel?.streamHistory ?? [];
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
    timers.setTimeout(() => setFeedback(null), 2800);
  }, [timers]);

  const handleStream = useCallback(() => {
    const r = runStream(
      gameState,
      setGameState,
      {
        game: selectedGame.name,
        duration: selectedDuration.minutes,
        energyCost: selectedDuration.energy,
      },
      { updateMoney },
      week
    );
    if (r.success) {
      saveGame();
      Alert.alert(r.outcome?.hypeTrain ? 'HYPE TRAIN' : 'Stream ended', r.message);
    } else {
      flash(r.message);
    }
  }, [gameState, setGameState, saveGame, selectedGame, selectedDuration, week, flash]);

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

  const renderDashboard = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Followers</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {(channel?.followers ?? 0).toLocaleString()}
            </Text>
          </View>
          <View>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Subs</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {(channel?.subscribers ?? 0).toLocaleString()}
            </Text>
          </View>
          <View>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Hours</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              {Math.round(channel?.streamHours ?? 0)}
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
          Setup: {quality.total}/100 · {quality.tier.toUpperCase()}
        </Text>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Monetization</Text>
        <View style={styles.statsRow}>
          <MoneyStat label="$/viewer" value={`$${monetization.viewerPay.toFixed(3)}`} color={accent.success} theme={theme} />
          <MoneyStat label="Donations" value={`$${(channel?.totalDonations ?? 0).toLocaleString()}`} color={accent.purple} theme={theme} />
          <MoneyStat label="Total $" value={`$${(channel?.totalEarnings ?? 0).toLocaleString()}`} color={accent.info} theme={theme} />
        </View>
      </View>

      {channel?.bestStream ? (
        <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Best stream</Text>
          <View style={styles.bestRow}>
            <Trophy size={scale(18)} color={accent.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bestTitle, { color: theme.text }]}>{channel.bestStream.game}</Text>
              <Text style={[styles.bestSub, { color: theme.textSecondary }]}>
                {channel.bestStream.viewers.toLocaleString()} peak · ${channel.bestStream.earnings.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderLive = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Pick a stream</Text>
        {GAME_OPTIONS.map((g) => (
          <TouchableOpacity
            key={g.id}
            onPress={() => setSelectedGame(g)}
            style={[
              styles.gameRow,
              {
                borderColor: selectedGame.id === g.id ? accent.info : theme.border,
                backgroundColor: selectedGame.id === g.id ? `${accent.info}22` : 'transparent',
              },
            ]}
          >
            <Radio size={scale(14)} color={accent.info} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.gameName, { color: theme.text }]}>{g.name}</Text>
              <Text style={[styles.gameHint, { color: theme.textSecondary }]}>{g.viewersHint}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Session length</Text>
        {DURATIONS.map((d) => (
          <TouchableOpacity
            key={d.label}
            onPress={() => setSelectedDuration(d)}
            style={[
              styles.durationRow,
              {
                borderColor: selectedDuration.label === d.label ? accent.info : theme.border,
                backgroundColor: selectedDuration.label === d.label ? `${accent.info}22` : 'transparent',
              },
            ]}
          >
            <Text style={[styles.durationLabel, { color: theme.text }]}>{d.label}</Text>
            <View style={styles.durationMeta}>
              <Zap size={scale(11)} color={accent.warning} />
              <Text style={[styles.gameHint, { color: theme.textSecondary }]}>{d.energy} energy</Text>
            </View>
          </TouchableOpacity>
        ))}
        <Text style={[styles.recordHint, { color: theme.textSecondary }]}>
          Longer streams get diminishing returns past 90 minutes. Hype-train chance ~8%.
        </Text>
        <TouchableOpacity
          onPress={handleStream}
          disabled={energy < selectedDuration.energy}
          style={[
            styles.publishBtn,
            { backgroundColor: energy < selectedDuration.energy ? accent.muted : accent.purple },
          ]}
        >
          <Sparkles size={scale(14)} color="white" />
          <Text style={styles.publishBtnText}>Go live</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {streamHistory.length === 0 ? (
        <View style={styles.empty}>
          <History size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No streams yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Go live to start your history.
          </Text>
        </View>
      ) : (
        streamHistory.slice(0, 50).map((s) => (
          <View
            key={s.id}
            style={[styles.streamRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Radio size={scale(14)} color={accent.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.streamGame, { color: theme.text }]}>{s.game}</Text>
              <View style={styles.streamMetricsRow}>
                <View style={styles.metric}>
                  <Users size={scale(11)} color={accent.info} />
                  <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                    {s.viewers.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Heart size={scale(11)} color={accent.purple} />
                  <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                    +{s.subscribers}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricText, { color: accent.success }]}>
                    ${s.earnings.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderShop = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Streaming</Text>
        <Text style={[styles.headerCash, { color: accent.success }]}>${money.toLocaleString()}</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {[
          { id: 'dashboard' as TabType, label: 'Dashboard', Icon: Activity },
          { id: 'live' as TabType, label: 'Go Live', Icon: Radio },
          { id: 'history' as TabType, label: 'History', Icon: History },
          { id: 'shop' as TabType, label: 'Shop', Icon: ShoppingBag },
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

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'live' && renderLive()}
      {activeTab === 'history' && renderHistory()}
      {activeTab === 'shop' && renderShop()}

      {feedback ? (
        <View style={[styles.toast, { backgroundColor: theme.surface, borderColor: accent.info, bottom: getAppScreenBottomPadding(insets.bottom) }]}>
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
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.md, borderWidth: 1 },
  gameName: { fontSize: fs.sm, fontWeight: '700' },
  gameHint: { fontSize: fs.xs },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.md, borderWidth: 1, justifyContent: 'space-between' },
  durationLabel: { fontSize: fs.sm, fontWeight: '700' },
  durationMeta: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  recordHint: { fontSize: fs.xs, fontStyle: 'italic' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.md, borderRadius: br.md, justifyContent: 'center' },
  publishBtnText: { color: 'white', fontSize: fs.md, fontWeight: '800' },
  streamRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  streamGame: { fontSize: fs.sm, fontWeight: '800' },
  streamMetricsRow: { flexDirection: 'row', gap: sp.md, marginTop: sp.xs },
  metric: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  metricText: { fontSize: fs.xs, fontWeight: '700' },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  bestTitle: { fontSize: fs.sm, fontWeight: '800' },
  bestSub: { fontSize: fs.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
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
