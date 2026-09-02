/**
 * LiveStreamScreen - 3-phase state machine: setup → live → summary.
 *
 * Setup: pick a topic + go-live CTA. Live: pulsing avatar, viewer/earning
 * counters, end-stream button. Summary: recap of donations + new followers.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Square, Sparkles } from 'lucide-react-native';
import AppHeader from '@/components/ui/AppHeader';
import StatStrip from '@/components/ui/StatStrip';
import Chip from '@/components/ui/Chip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { PULSE_COLORS, PULSE_MOTION } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import { startLiveStream, tickLiveStream, endLiveStream } from '@/contexts/game/actions/PulseActions';
import { formatPulseNumber } from '../utils/formatPulseNumber';

type Phase = 'setup' | 'live' | 'summary';

interface LiveStreamScreenProps {
  onClose: () => void;
}

interface SummaryData {
  totalDonations: number;
  newFollowers: number;
  peakViewers: number;
  minutesElapsed: number;
}

export default function LiveStreamScreen({ onClose }: LiveStreamScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>(gameState.socialMedia?.liveSession?.active ? 'live' : 'setup');
  const [topic, setTopic] = useState('Just chatting');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing ring animation
  const ringScale = useRef(new Animated.Value(1)).current;

  const reduced = useReducedMotion();
  useEffect(() => {
    if (phase !== 'live' || reduced) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, { toValue: 1.05, duration: PULSE_MOTION.liveRingLoop / 2, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1, duration: PULSE_MOTION.liveRingLoop / 2, useNativeDriver: true }),
      ]),
    ).start();
    return () => {
      ringScale.stopAnimation();
    };
  }, [phase, ringScale, reduced]);

  // Drive the live session tick every 30 real seconds
  useEffect(() => {
    if (phase !== 'live') return;
    tickInterval.current = setInterval(() => {
      tickLiveStream(setGameState, 30);
    }, 30_000);
    return () => {
      if (tickInterval.current) {
        clearInterval(tickInterval.current);
        tickInterval.current = null;
      }
    };
  }, [phase, setGameState]);

  const handleGoLive = useCallback(() => {
    const result = startLiveStream(setGameState, gameState, topic);
    if (result.success) {
      pulseHaptics.goLive();
      setPhase('live');
    } else {
      pulseHaptics.error();
    }
  }, [setGameState, gameState, topic]);

  const handleEnd = useCallback(() => {
    const result = endLiveStream(setGameState, gameState);
    if (result.success) {
      // Persist tips + follower gains now - this is the moment the whole
      // stream's accumulated value lands in state.
      setTimeout(() => { void saveGame?.(); }, 0);
      setSummary({
        totalDonations: result.totalDonations,
        newFollowers: result.newFollowers,
        peakViewers: result.peakViewers,
        minutesElapsed: result.minutesElapsed,
      });
      setPhase('summary');
    }
  }, [setGameState, gameState, saveGame]);

  const live = gameState.socialMedia?.liveSession;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader title="Live" onBack={onClose} backLabel="Back to feed" />

      {phase === 'setup' && (
        <View style={styles.center}>
          <Text style={[styles.title, { color: theme.text }]}>Go Live on Pulse</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Stream live to your followers. Donations + new followers based on peak viewers.
          </Text>
          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="What's the stream about?"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              maxLength={60}
            />
          </View>
          <Pressable
            onPress={handleGoLive}
            accessibilityRole="button"
            accessibilityLabel="Start live stream"
            style={[styles.cta, { backgroundColor: PULSE_COLORS.accent }]}
          >
            <Text style={styles.ctaText}>Go live</Text>
          </Pressable>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            Requires 100 followers and 30 energy.
          </Text>
        </View>
      )}

      {phase === 'live' && live && (
        <View style={styles.center}>
          <Chip label="Live" tone="danger" size="md" accessibilityLabel="You are live" />
          <Animated.View
            style={[
              styles.ringOuter,
              { transform: [{ scale: ringScale }] },
            ]}
          >
            <View style={[styles.ringInner, { backgroundColor: PULSE_COLORS.accent }]}>
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.background }]}>
                <Text style={[styles.avatarLetter, { color: theme.text }]}>
                  {(gameState.userProfile?.handle ?? 'P').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
          </Animated.View>
          <Text style={[styles.topic, { color: theme.text }]} numberOfLines={1}>
            {live.topic}
          </Text>

          <StatStrip
            style={styles.statsRow}
            items={[
              {
                label: 'Watching',
                value: formatPulseNumber(live.currentViewers),
                tint: PULSE_COLORS.info,
                sub: `peak ${formatPulseNumber(live.peakViewers)}`,
              },
              {
                label: 'Tips',
                value: `$${live.donationsEarned.toFixed(2)}`,
                tint: PULSE_COLORS.success,
                sub: `${Math.floor(live.minutesElapsed)}m elapsed`,
              },
            ]}
          />

          <Pressable
            onPress={handleEnd}
            accessibilityRole="button"
            accessibilityLabel="End live stream"
            style={[styles.endBtn, { borderColor: PULSE_COLORS.danger }]}
          >
            <Square size={fontScale(16)} color={PULSE_COLORS.danger} fill={PULSE_COLORS.danger} />
            <Text style={[styles.endBtnText, { color: PULSE_COLORS.danger }]}>End Stream</Text>
          </Pressable>
        </View>
      )}

      {phase === 'summary' && summary && (
        <View style={styles.center}>
          <Sparkles size={48} color={PULSE_COLORS.success ?? '#10B981'} />
          <Text style={[styles.title, { color: theme.text, marginTop: 8 }]}>Great show!</Text>
          <View style={[styles.recapCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <RecapRow label="Duration" value={`${Math.floor(summary.minutesElapsed)} min`} theme={theme} />
            <RecapRow label="Peak viewers" value={formatPulseNumber(summary.peakViewers)} theme={theme} />
            <RecapRow label="New followers" value={`+${summary.newFollowers.toLocaleString()}`} theme={theme} color={PULSE_COLORS.success} />
            <RecapRow label="Tips earned" value={`$${summary.totalDonations.toFixed(2)}`} theme={theme} color={PULSE_COLORS.success} />
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.cta, { backgroundColor: PULSE_COLORS.accent }]}
          >
            <Text style={styles.ctaText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function RecapRow({ label, value, theme, color }: { label: string; value: string; theme: any; color?: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={[styles.recapLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.recapValue, { color: color || theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.xl,
    gap: responsiveSpacing.md,
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontScale(13),
    textAlign: 'center',
    marginBottom: responsiveSpacing.md,
  },
  inputWrap: {
    width: '100%',
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
  },
  input: {
    fontSize: fontScale(14),
  },
  cta: {
    width: '100%',
    marginTop: responsiveSpacing.md,
    borderRadius: scale(14),
    paddingVertical: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  note: {
    fontSize: fontScale(11),
    marginTop: responsiveSpacing.sm,
  },
  ringOuter: {
    width: scale(160),
    height: scale(160),
    borderRadius: scale(80),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  avatarPlaceholder: {
    flex: 1,
    width: '100%',
    borderRadius: scale(75),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: fontScale(48),
    fontWeight: '600',
  },
  topic: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginTop: responsiveSpacing.sm,
  },
  statsRow: {
    alignSelf: 'stretch',
    marginTop: responsiveSpacing.md,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(999),
    borderWidth: 1.5,
    marginTop: responsiveSpacing.lg,
  },
  endBtnText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  recapCard: {
    width: '100%',
    borderRadius: scale(16),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.lg,
    marginTop: responsiveSpacing.md,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: responsiveSpacing.sm,
  },
  recapLabel: {
    fontSize: fontScale(13),
  },
  recapValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});
