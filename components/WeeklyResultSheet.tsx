import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MotiView } from '@/components/anim/MotiStub';
import { scale, fontScale } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

interface WeeklyResultSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  gameState?: GameState;
}

/**
 * Rich weekly result sheet — shows income, expenses, lucky bonuses,
 * streak info, and career progress after each week advance.
 *
 * Falls back to children-only rendering if no gameState is provided,
 * preserving backward compatibility with existing callers.
 */
export default function WeeklyResultSheet({ visible, onClose, children, gameState }: WeeklyResultSheetProps) {
  if (!visible) return null;

  const weekResult = gameState?.weekResult;
  const playStreak = gameState?.playStreak;
  const isDarkMode = gameState?.settings?.darkMode;

  const showRichContent = !!weekResult;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 150 }}
        style={styles.backdrop}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </MotiView>
      <MotiView
        from={{ translateY: 40, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 18 }}
        style={styles.sheet}
      >
        {showRichContent ? (
          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            {/* Header */}
            <Text style={[styles.title, isDarkMode && styles.textLight]}>
              Week Summary
            </Text>

            {/* Income */}
            {(weekResult.incomeEarned ?? 0) > 0 && (
              <View style={styles.row}>
                <Text style={[styles.label, isDarkMode && styles.textMuted]}>Income</Text>
                <Text style={[styles.valuePositive]}>
                  +${(weekResult.incomeEarned ?? 0).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Expenses */}
            {(weekResult.expensesPaid ?? 0) > 0 && (
              <View style={styles.row}>
                <Text style={[styles.label, isDarkMode && styles.textMuted]}>Expenses</Text>
                <Text style={[styles.valueNegative]}>
                  -${(weekResult.expensesPaid ?? 0).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Lucky Bonus */}
            {weekResult.luckyBonus && weekResult.luckyBonus > 0 && (
              <View style={[styles.row, styles.luckyRow]}>
                <Text style={styles.luckyLabel}>
                  {weekResult.luckyTier === 'rare' ? '*** ' : weekResult.luckyTier === 'medium' ? '** ' : '* '}
                  Lucky Bonus!
                </Text>
                <Text style={styles.luckyValue}>
                  +${weekResult.luckyBonus.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Streak Bonus */}
            {weekResult.streakBonus && weekResult.streakBonus > 0 && (
              <View style={styles.row}>
                <Text style={[styles.label, isDarkMode && styles.textMuted]}>Streak Bonus</Text>
                <Text style={styles.streakValue}>
                  +${weekResult.streakBonus.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Divider */}
            <View style={[styles.divider, isDarkMode && styles.dividerDark]} />

            {/* Net Change */}
            <View style={styles.row}>
              <Text style={[styles.netLabel, isDarkMode && styles.textLight]}>Net Change</Text>
              <Text style={[
                styles.netValue,
                (weekResult.netChange ?? 0) >= 0 ? styles.valuePositive : styles.valueNegative,
              ]}>
                {(weekResult.netChange ?? 0) >= 0 ? '+' : ''}${(weekResult.netChange ?? 0).toLocaleString()}
              </Text>
            </View>

            {/* Career Progress */}
            {(weekResult.careerProgressPercent ?? 0) > 0 && (
              <View style={styles.progressSection}>
                <Text style={[styles.progressLabel, isDarkMode && styles.textMuted]}>
                  Career Progress
                </Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${weekResult.careerProgressPercent ?? 0}%` as `${number}%` }]} />
                </View>
                <Text style={[styles.progressText, isDarkMode && styles.textMuted]}>
                  {weekResult.careerProgressPercent}% to next promotion
                </Text>
              </View>
            )}

            {/* Play Streak */}
            {playStreak && playStreak.count > 1 && (
              <View style={styles.streakSection}>
                <Text style={styles.streakText}>
                  {playStreak.count} day streak (+{Math.min(playStreak.count * 2, 20)}% income)
                </Text>
              </View>
            )}

            {/* Cliffhanger Teaser */}
            {weekResult?.cliffhangerTeaser && (
              <View style={styles.cliffhangerSection}>
                <Text style={[styles.cliffhangerText, isDarkMode && styles.textLight]}>
                  {weekResult.cliffhangerTeaser}
                </Text>
              </View>
            )}

            {/* Continue Button */}
            <TouchableOpacity style={styles.continueBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.continueBtnText}>
                {weekResult?.cliffhangerTeaser ? 'What happens next?' : 'Next Week'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          children
        )}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 16,
    zIndex: 1000,
  },
  card: {
    width: '100%',
    maxWidth: scale(380),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: scale(16),
  },
  textLight: { color: '#F9FAFB' },
  textMuted: { color: '#9CA3AF' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(6),
  },
  label: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  valuePositive: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#10B981',
  },
  valueNegative: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#EF4444',
  },
  luckyRow: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: scale(8),
    paddingHorizontal: scale(8),
    marginVertical: scale(4),
  },
  luckyLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#F59E0B',
  },
  luckyValue: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#F59E0B',
  },
  streakValue: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#8B5CF6',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: scale(10),
  },
  dividerDark: {
    backgroundColor: '#374151',
  },
  netLabel: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  netValue: {
    fontSize: fontScale(18),
    fontWeight: '800',
  },
  progressSection: {
    marginTop: scale(12),
  },
  progressLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  progressBarBg: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: scale(4),
  },
  progressText: {
    fontSize: fontScale(11),
    color: '#9CA3AF',
    marginTop: scale(2),
    textAlign: 'right',
  },
  streakSection: {
    marginTop: scale(10),
    alignItems: 'center',
  },
  streakText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#F59E0B',
  },
  continueBtn: {
    marginTop: scale(16),
    backgroundColor: '#3B82F6',
    borderRadius: scale(10),
    paddingVertical: scale(12),
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cliffhangerSection: {
    marginTop: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: scale(8),
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  cliffhangerText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#6D28D9',
    lineHeight: fontScale(20),
  },
});
