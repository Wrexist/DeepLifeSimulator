import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GraduationCap, Clock, Award, Pause, Play } from 'lucide-react-native';
import { Education } from '@/contexts/game/types';
import { gpaBand, gpaBandLabel, gpaLetter } from '@/lib/education/gpa';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  education: Education;
  darkMode: boolean;
  onPress?: () => void;
  onTogglePause?: () => void;
}

const BAND_COLOR: Record<string, string> = {
  failing: accent.danger,
  atRisk: accent.warning,
  average: accent.info,
  solid: accent.info,
  honors: accent.success,
  topOfClass: accent.purple,
};

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function EducationRow({ education, darkMode, onPress, onTogglePause }: Props) {
  const theme = getThemeColors(darkMode);
  const ed = education;
  // A completed degree with no recorded GPA (e.g. granted by a starting
  // scenario) has no grade on record — don't let the 0 default read as an F.
  const noRecordedGpa = ed.completed && ed.gpa == null;
  const gpa = ed.gpa ?? 0;
  const band = noRecordedGpa ? 'solid' : gpaBand(gpa);
  const bandColor = BAND_COLOR[band];
  const remaining = ed.weeksRemaining ?? ed.duration;
  const progress = ed.duration > 0 ? 1 - remaining / ed.duration : 0;
  const pct = Math.max(0, Math.min(1, progress));

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: bandColor }]}>
          <GraduationCap size={scale(18)} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {ed.name}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {ed.completed
              ? noRecordedGpa
                ? 'Completed'
                : `Completed · ${gpaLetter(gpa)} (${gpa.toFixed(2)})`
              : `${remaining}w left · GPA ${gpa.toFixed(2)}`}
          </Text>
        </View>

        {!ed.completed && onTogglePause && (
          <TouchableOpacity onPress={onTogglePause} hitSlop={10} style={styles.pauseBtn}>
            {ed.paused ? (
              <Play size={scale(14)} color={accent.success} />
            ) : (
              <Pause size={scale(14)} color={accent.warning} />
            )}
          </TouchableOpacity>
        )}

        <View style={{ alignItems: 'flex-end' }}>
          {ed.completed ? (
            <View style={styles.honorsBadge}>
              <Award size={scale(12)} color={bandColor} />
              <Text style={[styles.honorsText, { color: bandColor }]}>
                {noRecordedGpa ? 'Graduated' : gpaBandLabel(band)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.cost, { color: theme.textMuted }]}>{formatMoney(ed.cost)}</Text>
          )}
        </View>
      </View>

      {!ed.completed && (
        <>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: bandColor }]} />
          </View>
          <View style={styles.footRow}>
            <View style={styles.footChip}>
              <Clock size={scale(10)} color={theme.textMuted} />
              <Text style={[styles.footText, { color: theme.textMuted }]}>{Math.round(pct * 100)}% done</Text>
            </View>
            {(ed.examsPassed ?? 0) > 0 || (ed.examsFailed ?? 0) > 0 ? (
              <Text style={[styles.footText, { color: theme.textMuted }]}>
                Exams {ed.examsPassed ?? 0} ✓ / {ed.examsFailed ?? 0} ✗
              </Text>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  sub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  pauseBtn: { padding: responsiveSpacing.xs },
  cost: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  honorsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  honorsText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  track: {
    height: scale(6),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footText: { fontSize: responsiveFontSize.xs },
});
