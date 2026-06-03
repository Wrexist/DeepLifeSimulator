import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { DarkWebActiveJob } from '@/contexts/game/types';
import { DarkWebJobTemplate } from '@/lib/darkweb/jobs';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  job: DarkWebActiveJob;
  template: DarkWebJobTemplate;
  currentWeek: number;
  darkMode: boolean;
  onRun?: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  recon: 'Recon',
  social: 'Social Eng',
  exploit: 'Exploit',
  exfiltrate: 'Exfiltrate',
  fence: 'Fence',
};

export default function JobRow({ job, template, currentWeek, darkMode, onRun }: Props) {
  const theme = getThemeColors(darkMode);
  const totalStages = template.stages.length;
  const progressPct = (job.currentStage / totalStages) * 100;
  const weeksLeft = Math.max(0, job.expiresWeek - currentWeek);

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: theme.surface }]}>
          <Target size={scale(16)} color={theme.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{template.name}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Payout {template.payoutBtc.toFixed(3)} â‚¿ Â· {weeksLeft}w left
          </Text>
        </View>
      </View>

      <View style={styles.stages}>
        {template.stages.map((stage, idx) => {
          const completedSuccess = job.completedStages.some(
            (cs) => cs.stage === idx && cs.outcome === 'success'
          );
          const isCurrent = idx === job.currentStage;
          const color = completedSuccess ? accent.success : isCurrent ? accent.info : theme.textMuted;
          return (
            <View key={idx} style={styles.stage}>
              <View style={[styles.stageBubble, { backgroundColor: color }]}>
                {completedSuccess ? (
                  <CheckCircle2 size={scale(10)} color="white" />
                ) : isCurrent ? (
                  <AlertCircle size={scale(10)} color="white" />
                ) : (
                  <Text style={styles.stageNum}>{idx + 1}</Text>
                )}
              </View>
              <Text style={[styles.stageLabel, { color }]}>{STAGE_LABEL[stage.kind] ?? stage.kind}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${progressPct}%`, backgroundColor: accent.info }]} />
      </View>

      {onRun && job.currentStage < totalStages && (
        <TouchableOpacity onPress={onRun} style={[styles.runBtn, { backgroundColor: accent.info }]}>
          <Text style={styles.runBtnText}>Run Stage {job.currentStage + 1}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  iconBubble: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  sub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  stages: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: responsiveSpacing.xs,
  },
  stage: { alignItems: 'center', flex: 1, gap: 4 },
  stageBubble: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNum: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  stageLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  track: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  runBtn: {
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  runBtnText: { color: 'white', fontSize: responsiveFontSize.sm, fontWeight: '700' },
});
