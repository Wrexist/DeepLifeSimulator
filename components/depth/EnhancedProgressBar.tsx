/**
 * Enhanced Progress Bar
 * Multi-layered progress bars with milestones and detailed information
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Target,
  Clock,
  TrendingUp,
  Award,
} from 'lucide-react-native';
import { scale, fontScale, responsivePadding, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface Milestone {
  position: number; // 0-100
  label: string;
  icon?: React.ElementType;
  color?: string;
}

interface EnhancedProgressBarProps {
  progress: number; // 0-100
  label?: string;
  color?: string;
  secondaryProgress?: number; // Progress to next level
  milestones?: Milestone[];
  timeToCompletion?: number; // Estimated weeks
  comparisonValue?: number; // Previous performance for comparison
  commitmentBonus?: number; // Commitment bonus percentage
  showDetails?: boolean;
  darkMode?: boolean;
  onPress?: () => void;
}

export default function EnhancedProgressBar({
  progress,
  label,
  color = '#3B82F6',
  secondaryProgress,
  milestones = [],
  timeToCompletion,
  comparisonValue,
  commitmentBonus,
  showDetails = false,
  darkMode = false,
  onPress,
}: EnhancedProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const clampedSecondary = secondaryProgress !== undefined
    ? Math.max(0, Math.min(100, secondaryProgress))
    : undefined;

  const progressComparison = useMemo(() => {
    if (comparisonValue === undefined) return null;
    const diff = clampedProgress - comparisonValue;
    return {
      value: diff,
      isImproving: diff > 0,
      percentage: Math.abs(diff),
    };
  }, [clampedProgress, comparisonValue]);

  const nextMilestone = useMemo(() => {
    return milestones.find(m => m.position > clampedProgress);
  }, [milestones, clampedProgress]);

  const reachedMilestones = useMemo(() => {
    return milestones.filter(m => m.position <= clampedProgress);
  }, [milestones, clampedProgress]);

  const content = (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {/* Header */}
      {label && (
        <View style={styles.header}>
          <Text style={[styles.label, darkMode && styles.labelDark]}>{label}</Text>
          <Text style={[styles.progressText, darkMode && styles.progressTextDark]}>
            {Math.round(clampedProgress)}%
          </Text>
        </View>
      )}

      {/* Primary Progress Bar */}
      <View style={[styles.progressBarContainer, darkMode && styles.progressBarContainerDark]}>
        <LinearGradient
          colors={[color, `${color}CC`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${clampedProgress}%` }]}
        />
        
        {/* Milestone Markers */}
        {milestones.map((milestone, index) => {
          const isReached = milestone.position <= clampedProgress;
          const MilestoneIcon = milestone.icon || Award;
          
          return (
            <View
              key={index}
              style={[
                styles.milestoneMarker,
                { left: `${milestone.position}%` },
                isReached && styles.milestoneMarkerReached,
              ]}
            >
              <View style={[
                styles.milestoneIcon,
                { backgroundColor: isReached ? (milestone.color || color) : (darkMode ? '#4B5563' : '#E5E7EB') },
              ]}>
                <MilestoneIcon size={scale(10)} color={isReached ? '#FFFFFF' : (darkMode ? '#9CA3AF' : '#6B7280')} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Secondary Progress Bar (for next level) */}
      {clampedSecondary !== undefined && (
        <View style={styles.secondaryContainer}>
          <Text style={[styles.secondaryLabel, darkMode && styles.secondaryLabelDark]}>
            Next Level
          </Text>
          <View style={[styles.progressBarContainer, styles.secondaryProgressBar, darkMode && styles.progressBarContainerDark]}>
            <LinearGradient
              colors={[`${color}80`, `${color}40`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${clampedSecondary}%` }]}
            />
          </View>
          <Text style={[styles.secondaryProgressText, darkMode && styles.secondaryProgressTextDark]}>
            {Math.round(clampedSecondary)}%
          </Text>
        </View>
      )}

      {/* Details Section */}
      {showDetails && (
        <View style={styles.details}>
          {/* Time to Completion */}
          {timeToCompletion !== undefined && timeToCompletion > 0 && (
            <View style={styles.detailItem}>
              <Clock size={scale(12)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.detailText, darkMode && styles.detailTextDark]}>
                ~{timeToCompletion} week{timeToCompletion !== 1 ? 's' : ''} to completion
              </Text>
            </View>
          )}

          {/* Next Milestone */}
          {nextMilestone && (
            <View style={styles.detailItem}>
              <Target size={scale(12)} color={darkMode ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.detailText, darkMode && styles.detailTextDark]}>
                Next: {nextMilestone.label} ({Math.round(nextMilestone.position)}%)
              </Text>
            </View>
          )}

          {/* Comparison */}
          {progressComparison && (
            <View style={styles.detailItem}>
              <TrendingUp
                size={scale(12)}
                color={progressComparison.isImproving ? '#10B981' : '#EF4444'}
              />
              <Text style={[
                styles.detailText,
                darkMode && styles.detailTextDark,
                progressComparison.isImproving ? styles.improvingText : styles.decliningText,
              ]}>
                {progressComparison.isImproving ? '+' : ''}{progressComparison.percentage.toFixed(1)}% vs previous
              </Text>
            </View>
          )}

          {/* Commitment Bonus */}
          {commitmentBonus && commitmentBonus > 0 && (
            <View style={styles.detailItem}>
              <Award size={scale(12)} color="#F59E0B" />
              <Text style={[styles.detailText, styles.bonusText]}>
                +{commitmentBonus}% commitment bonus
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginVertical: responsiveSpacing.xs,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  label: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  labelDark: {
    color: '#F9FAFB',
  },
  progressText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#3B82F6',
  },
  progressTextDark: {
    color: '#60A5FA',
  },
  progressBarContainer: {
    height: scale(20),
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: responsiveSpacing.xs,
  },
  progressBarContainerDark: {
    backgroundColor: '#374151',
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  milestoneMarker: {
    position: 'absolute',
    top: -scale(6),
    transform: [{ translateX: -scale(5) }],
  },
  milestoneMarkerReached: {
    zIndex: 1,
  },
  milestoneIcon: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  secondaryContainer: {
    marginTop: responsiveSpacing.sm,
  },
  secondaryLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
  },
  secondaryLabelDark: {
    color: '#9CA3AF',
  },
  secondaryProgressBar: {
    height: scale(12),
    marginBottom: responsiveSpacing.xs,
  },
  secondaryProgressText: {
    fontSize: fontScale(10),
    color: '#6B7280',
    textAlign: 'right',
  },
  secondaryProgressTextDark: {
    color: '#9CA3AF',
  },
  details: {
    marginTop: responsiveSpacing.sm,
    gap: responsiveSpacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  detailText: {
    fontSize: fontScale(11),
    color: '#6B7280',
  },
  detailTextDark: {
    color: '#9CA3AF',
  },
  improvingText: {
    color: '#10B981',
  },
  decliningText: {
    color: '#EF4444',
  },
  bonusText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
});

