import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { Crown } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';
// expo-linear-gradient is a TurboModule that has crashed on iOS 26 — use the safe fallback.
const LinearGradient = Gradient;

interface CrimeSkillCardProps {
  /** Lucide icon component, e.g. `Eye`, `Brain`, `Target`. */
  icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Skill key label (e.g. "Stealth"). */
  name: string;
  /** Tree display name (e.g. "Shadow Arts"). */
  treeName: string;
  level: number;
  xp: number;
  xpThreshold: number;
  /** Unspent talent points available. */
  pointsAvailable: number;
  /** Number of unlocked talents. */
  unlockedCount: number;
  totalCount: number;
  /** Two hex values used for the XP fill gradient. */
  accent: [string, string];
  onPress: () => void;
}

export default function CrimeSkillCard({
  icon: Icon,
  name,
  treeName,
  level,
  xp,
  xpThreshold,
  pointsAvailable,
  unlockedCount,
  totalCount,
  accent,
  onPress,
}: CrimeSkillCardProps) {
  const percent = xpThreshold > 0 ? Math.min(100, Math.round((xp / xpThreshold) * 100)) : 0;
  const isMaxed = level >= 5;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${name}, level ${level}`}
      accessibilityHint="Open talent tree"
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.card}
    >
      <BlurViewFallback intensity={28} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { borderColor: accent[1] + '55' }]}>
            <Icon size={scale(22)} color={accent[1]} />
            {isMaxed ? (
              <View style={styles.crownBadge}>
                <Crown size={scale(11)} color="#FBBF24" />
              </View>
            ) : null}
          </View>

          <View style={styles.titleColumn}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.treeName} numberOfLines={1}>{treeName}</Text>
          </View>

          <View style={styles.headerMeta}>
            <Text style={styles.levelText}>Lv {level}</Text>
            {pointsAvailable > 0 ? (
              <View style={[styles.pointsPill, { borderColor: accent[1] + '55' }]}>
                <View style={[styles.pointsDot, { backgroundColor: accent[1] }]} />
                <Text style={[styles.pointsText, { color: accent[1] }]}>{pointsAvailable}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.progressBg}>
          <LinearGradient
            colors={[accent[0], accent[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${percent}%` }]}
          />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.xpText}>
            {isMaxed && percent >= 100 ? 'Max level reached' : `${xp} / ${xpThreshold} XP`}
          </Text>
          <Text style={styles.unlockedText}>{unlockedCount} / {totalCount} unlocked</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: verticalScale(10),
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  body: {
    padding: responsiveSpacing.md,
    gap: verticalScale(10),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  iconWrap: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownBadge: {
    position: 'absolute',
    top: -scale(4),
    right: -scale(4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  name: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  treeName: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.62)',
    marginTop: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  levelText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: 'rgba(226, 232, 240, 0.85)',
    fontVariant: ['tabular-nums'],
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(999),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  pointsDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  pointsText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBg: {
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(3),
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.62)',
    fontVariant: ['tabular-nums'],
  },
  unlockedText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.62)',
    fontVariant: ['tabular-nums'],
  },
});
