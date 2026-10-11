/**
 * CreatorRecapModal - the end-of-content recap card shared by Streaming and
 * YouVideo.
 *
 * Both apps ended their main action with a plain two-line alert, the same
 * weight as a "not enough money" warning, at the moment a creator most wants
 * to see how it went (tester, 2026-10-11). This card shows the artwork, a
 * verdict, the money counting up and the numbers the content moved, with
 * confetti only when something genuinely special happened so it stays a
 * reward rather than wallpaper.
 *
 * Presentation only: everything it shows was already credited before it
 * mounts. The two app-specific wrappers (`StreamSummaryModal`,
 * `VideoSummaryModal`) decide the words and the numbers.
 */
import React, { useEffect, useRef } from 'react';
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
import { DollarSign, Star, Trophy, Zap } from 'lucide-react-native';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import AnimatedMoney from '@/components/ui/AnimatedMoney';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptic } from '@/utils/haptics';
import { playSound } from '@/utils/soundManager';
import { beginCelebration, endCelebration } from '@/utils/celebrationGate';
import { accent, uiPalette, withAlpha } from '@/lib/config/theme';
import { fontScale, scale } from '@/utils/scaling';

export interface RecapStat {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
  tint: string;
}

export interface CreatorRecap {
  art: ImageSourcePropType;
  /** Name shown over the artwork (game, video title). */
  subject: string;
  /** Pill over the artwork, e.g. "STREAM ENDED" / "UPLOADED". */
  badge: string;
  /** Pill colour and the card's accent. */
  tint: string;
  /** True for the special variant pill (hype train, viral) with a bolt. */
  hot?: boolean;
  newBest?: boolean;
  title: string;
  line: string;
  earnings: number;
  stats: RecapStat[];
  levelBefore: number;
  levelAfter: number;
  /** Confetti + success haptic. */
  celebrate: boolean;
}

interface Props {
  recap: CreatorRecap | null;
  onClose: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function CreatorRecapModal({ recap, onClose, secondaryLabel, onSecondary }: Props) {
  const reducedMotion = useReducedMotion();
  const card = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recap) return undefined;
    beginCelebration();
    if (recap.celebrate) {
      haptic.success();
      void playSound('level_up');
    } else {
      haptic.light();
    }
    if (reducedMotion) card.setValue(1);
    else {
      card.setValue(0);
      Animated.timing(card, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    return () => endCelebration();
  }, [recap, reducedMotion, card]);

  if (!recap) return null;
  const leveled = recap.levelAfter > recap.levelBefore;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {recap.celebrate && !reducedMotion ? <ConfettiBurst play count={22} /> : null}
        <Animated.View
          style={[
            styles.card,
            { borderColor: withAlpha(recap.tint, 0.4) },
            { opacity: card, transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.hero}>
            <Image source={recap.art} style={styles.heroImage} resizeMode="cover" accessible={false} />
            <View style={styles.heroScrim} pointerEvents="none" />
            <View style={styles.heroTop}>
              <View style={[styles.pill, { backgroundColor: recap.hot ? recap.tint : 'rgba(15,23,42,0.78)' }]}>
                {recap.hot ? <Zap size={scale(11)} color={uiPalette.white} /> : null}
                <Text style={styles.pillText}>{recap.badge}</Text>
              </View>
              {recap.newBest ? (
                <View style={[styles.pill, { backgroundColor: withAlpha(accent.gold, 0.9) }]}>
                  <Trophy size={scale(11)} color={uiPalette.navy} />
                  <Text style={[styles.pillText, { color: uiPalette.navy }]}>NEW BEST</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroGame} numberOfLines={1}>{recap.subject}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.title} accessibilityRole="header">{recap.title}</Text>
            <Text style={styles.line}>{recap.line}</Text>

            <View style={styles.earnedBox}>
              <DollarSign size={scale(16)} color={accent.success} />
              <Text style={styles.earnedLabel}>Earned</Text>
              <AnimatedMoney value={recap.earnings} prefix="+$" duration={reducedMotion ? 0 : 900} style={styles.earnedValue} />
            </View>

            <View style={styles.grid}>
              {recap.stats.map(({ icon: Icon, label, value, tint }) => (
                <View key={label} style={styles.tile} accessible accessibilityLabel={`${label} ${value}`}>
                  <Icon size={scale(14)} color={tint} />
                  <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
                  <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>

            {leveled ? (
              <View style={styles.levelRow}>
                <Star size={scale(14)} color={accent.gold} />
                <Text style={styles.levelText}>Channel level {recap.levelBefore} → {recap.levelAfter}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {onSecondary && secondaryLabel ? (
                <TouchableOpacity
                  style={[styles.button, styles.secondary, { borderColor: withAlpha(recap.tint, 0.5) }]}
                  onPress={onSecondary}
                  accessibilityRole="button"
                  accessibilityLabel={secondaryLabel}
                >
                  <Text style={[styles.secondaryText, { color: recap.tint }]}>{secondaryLabel}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: recap.tint }]}
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
  primaryText: { color: uiPalette.navy, fontSize: fontScale(15), fontWeight: '600' },
  secondary: { borderWidth: 1 },
  secondaryText: { fontSize: fontScale(15), fontWeight: '600' },
});
