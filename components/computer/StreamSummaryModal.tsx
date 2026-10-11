/**
 * StreamSummaryModal - the end-of-broadcast recap.
 *
 * Ending a stream used to be a plain two-line alert ("Stream ended - 12
 * viewers, $34."), the same weight as a "not enough money" warning, for the
 * moment a streamer most wants to see how it went (tester request,
 * 2026-10-11). This is a recap card instead: the box art, a verdict line, the
 * money counting up, and the five numbers a broadcast actually moved - with
 * confetti only when something genuinely special happened (hype train, new
 * best, level up), so it stays a reward rather than wallpaper.
 *
 * Presentation only: everything it shows was already credited by
 * `finalizeLiveStream` before this mounts.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Clock, DollarSign, Eye, Gift, Heart, Star, Trophy, Zap } from 'lucide-react-native';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptic } from '@/utils/haptics';
import { playSound } from '@/utils/soundManager';
import { formatMoney } from '@/utils/moneyFormatting';
import { beginCelebration, endCelebration } from '@/utils/celebrationGate';
import { accent, uiPalette, withAlpha } from '@/lib/config/theme';
import { fontScale, scale } from '@/utils/scaling';

const LIVE_RED = accent.danger;
const PURPLE = '#A78BFA';

export interface StreamSummary {
  game: string;
  art: ImageSourcePropType;
  /** Real seconds the broadcast ran. */
  seconds: number;
  viewers: number;
  newFollowers: number;
  newSubs: number;
  donations: number;
  earnings: number;
  hypeTrain: boolean;
  autoStopped: boolean;
  /** Beat the channel's previous best peak. */
  newBest: boolean;
  levelBefore: number;
  levelAfter: number;
}

interface Props {
  summary: StreamSummary | null;
  onClose: () => void;
  /** Offered only when another stream is actually possible right now. */
  onGoAgain?: () => void;
}

const fmt = (n: number) => formatMoney(Math.round(n || 0), false);

function fmtDuration(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${(s % 60).toString().padStart(2, '0')}s` : `${s}s`;
}

/** One line that tells the player how it went, in the order that matters most. */
function verdict(s: StreamSummary): { title: string; line: string } {
  if (s.hypeTrain) return { title: 'HYPE TRAIN!', line: 'Chat went wild - the subs kept rolling in.' };
  if (s.levelAfter > s.levelBefore) return { title: 'Level up!', line: `Your channel reached level ${s.levelAfter}.` };
  if (s.newBest) return { title: 'New personal best', line: 'Your biggest audience yet.' };
  if (s.autoStopped) return { title: 'Out of energy', line: 'You streamed until you dropped. Rest up and go again.' };
  if (s.viewers === 0) return { title: 'Quiet one', line: 'Nobody showed up this time - better gear and longer streams help.' };
  return { title: 'Stream complete', line: 'Every broadcast grows the channel a little more.' };
}

export default function StreamSummaryModal({ summary, onClose, onGoAgain }: Props) {
  const reducedMotion = useReducedMotion();
  const card = useRef(new Animated.Value(0)).current;
  const special = !!summary && (summary.hypeTrain || summary.newBest || summary.levelAfter > summary.levelBefore);

  useEffect(() => {
    if (!summary) return undefined;
    beginCelebration();
    if (special) {
      haptic.success();
      void playSound('level_up');
    } else {
      haptic.light();
    }
    if (reducedMotion) card.setValue(1);
    else {
      card.setValue(0);
      Animated.timing(card, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    return () => endCelebration();
  }, [summary, special, reducedMotion, card]);

  const v = useMemo(() => (summary ? verdict(summary) : null), [summary]);
  if (!summary || !v) return null;

  const stats = [
    { icon: Eye, label: 'Peak viewers', value: fmt(summary.viewers), tint: LIVE_RED },
    { icon: Clock, label: 'Time live', value: fmtDuration(summary.seconds), tint: uiPalette.blue },
    { icon: Heart, label: 'New followers', value: `+${fmt(summary.newFollowers)}`, tint: '#F472B6' },
    { icon: Star, label: 'New subs', value: `+${fmt(summary.newSubs)}`, tint: PURPLE },
    { icon: Gift, label: 'Donations', value: formatMoney(summary.donations), tint: accent.gold },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {special && !reducedMotion ? <ConfettiBurst play count={22} /> : null}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: card,
              transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.hero}>
            <Image source={summary.art} style={styles.heroImage} resizeMode="cover" accessible={false} />
            <View style={styles.heroScrim} pointerEvents="none" />
            <View style={styles.heroTop}>
              <View style={[styles.pill, { backgroundColor: summary.hypeTrain ? PURPLE : 'rgba(15,23,42,0.78)' }]}>
                {summary.hypeTrain ? <Zap size={scale(11)} color={uiPalette.white} /> : null}
                <Text style={styles.pillText}>{summary.hypeTrain ? 'HYPE TRAIN' : 'STREAM ENDED'}</Text>
              </View>
              {summary.newBest ? (
                <View style={[styles.pill, { backgroundColor: withAlpha(accent.gold, 0.9) }]}>
                  <Trophy size={scale(11)} color={uiPalette.navy} />
                  <Text style={[styles.pillText, { color: uiPalette.navy }]}>NEW BEST</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroGame} numberOfLines={1}>{summary.game}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.title} accessibilityRole="header">{v.title}</Text>
            <Text style={styles.line}>{v.line}</Text>

            <View style={styles.earnedBox}>
              <DollarSign size={scale(16)} color={accent.success} />
              <Text style={styles.earnedLabel}>Earned</Text>
              <AnimatedMoney
                value={summary.earnings}
                prefix="+$"
                duration={reducedMotion ? 0 : 900}
                style={styles.earnedValue}
              />
            </View>

            <View style={styles.grid}>
              {stats.map(({ icon: Icon, label, value, tint }) => (
                <View key={label} style={styles.tile} accessible accessibilityLabel={`${label} ${value}`}>
                  <Icon size={scale(14)} color={tint} />
                  <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {value}
                  </Text>
                  <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>

            {summary.levelAfter > summary.levelBefore ? (
              <View style={styles.levelRow}>
                <Star size={scale(14)} color={accent.gold} />
                <Text style={styles.levelText}>
                  Channel level {summary.levelBefore} → {summary.levelAfter}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {onGoAgain ? (
                <TouchableOpacity
                  style={[styles.button, styles.secondary]}
                  onPress={onGoAgain}
                  accessibilityRole="button"
                  accessibilityLabel="Go live again"
                >
                  <Text style={styles.secondaryText}>Go live again</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.button, styles.primary]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={styles.primaryText}>Nice!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(18),
  },
  card: {
    width: '100%',
    maxWidth: scale(360),
    borderRadius: scale(22),
    overflow: 'hidden',
    backgroundColor: uiPalette.navy,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  hero: { height: scale(130), justifyContent: 'space-between' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.45)' },
  heroTop: { flexDirection: 'row', gap: scale(6), padding: scale(12) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(999),
  },
  pillText: { color: uiPalette.white, fontSize: fontScale(10), fontWeight: '600', letterSpacing: 0.6 },
  heroGame: {
    color: uiPalette.white,
    fontSize: fontScale(18),
    fontWeight: '600',
    paddingHorizontal: scale(14),
    paddingBottom: scale(10),
  },
  body: { padding: scale(18), gap: scale(12) },
  title: { color: uiPalette.paper, fontSize: fontScale(24), fontWeight: '600', textAlign: 'center' },
  line: { color: uiPalette.muted, fontSize: fontScale(14), textAlign: 'center', lineHeight: fontScale(20) },
  earnedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    padding: scale(12),
    borderRadius: scale(14),
    backgroundColor: withAlpha(accent.success, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(accent.success, 0.35),
  },
  earnedLabel: { color: uiPalette.muted, fontSize: fontScale(13), flex: 1 },
  earnedValue: { color: accent.success, fontSize: fontScale(22), fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: scale(2),
    paddingVertical: scale(10),
    paddingHorizontal: scale(4),
    borderRadius: scale(12),
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
  },
  tileValue: { color: uiPalette.paper, fontSize: fontScale(16), fontWeight: '600' },
  tileLabel: { color: uiPalette.muted, fontSize: fontScale(10) },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6) },
  levelText: { color: accent.gold, fontSize: fontScale(13), fontWeight: '600' },
  actions: { flexDirection: 'row', gap: scale(10), marginTop: scale(4) },
  button: { flex: 1, minHeight: 48, borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: PURPLE },
  primaryText: { color: uiPalette.navy, fontSize: fontScale(15), fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.5)' },
  secondaryText: { color: PURPLE, fontSize: fontScale(15), fontWeight: '600' },
});
