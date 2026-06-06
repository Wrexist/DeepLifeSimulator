import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, Clock, Shield, CheckCircle2, XCircle } from 'lucide-react-native';
import { PoliticalScandalEntry } from '@/contexts/game/types';
import { SEVERITY_PARAMS } from '@/lib/politics/scandals';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  scandal: PoliticalScandalEntry;
  darkMode: boolean;
  onSuppress?: () => void;
}

const SEVERITY_COLOR: Record<PoliticalScandalEntry['severity'], string> = {
  minor: accent.warning,
  moderate: accent.amber,
  major: accent.danger,
  'career-ending': accent.purple,
};

const CATEGORY_LABEL: Record<PoliticalScandalEntry['category'], string> = {
  corruption: 'Corruption',
  extramarital: 'Personal',
  'tax-evasion': 'Tax evasion',
  'criminal-ties': 'Criminal ties',
  'policy-flip': 'Policy flip',
  'donor-fraud': 'Donor fraud',
};

export default function ScandalRow({ scandal, darkMode, onSuppress }: Props) {
  const theme = getThemeColors(darkMode);
  const color = SEVERITY_COLOR[scandal.severity];
  const cost = SEVERITY_PARAMS[scandal.severity]?.suppressionCost ?? 1;
  const suppressionFraction = cost > 0 ? Math.min(1, scandal.suppressedUSD / cost) : 0;

  let StatusIcon = AlertTriangle;
  if (!scandal.active) {
    if (scandal.resolution === 'image-restored') StatusIcon = CheckCircle2;
    else if (scandal.resolution === 'forced-resignation') StatusIcon = XCircle;
    else StatusIcon = Shield;
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: scandal.active ? color : theme.border }]}>
      <View style={[styles.severityStripe, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <StatusIcon size={scale(14)} color={color} />
          <Text style={[styles.headline, { color: theme.text }]} numberOfLines={2}>
            {scandal.headline}
          </Text>
        </View>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          {CATEGORY_LABEL[scandal.category]} · {scandal.severity}
          {scandal.active ? ` · ${scandal.weeksRemaining}w left` : ` · ${scandal.resolution ?? 'faded'}`}
        </Text>
        {scandal.active && (
          <>
            <View style={[styles.suppressTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.suppressFill, { width: `${suppressionFraction * 100}%`, backgroundColor: color }]} />
            </View>
            <View style={styles.footRow}>
              <View style={styles.footLeft}>
                <Clock size={scale(10)} color={theme.textMuted} />
                <Text style={[styles.footText, { color: theme.textMuted }]}>
                  Suppressed: ${Math.round(scandal.suppressedUSD).toLocaleString()} / ${cost.toLocaleString()}
                </Text>
              </View>
              {onSuppress && (
                <TouchableOpacity onPress={onSuppress} style={[styles.suppressBtn, { backgroundColor: color }]}>
                  <Text style={styles.suppressBtnText}>Suppress</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  severityStripe: { width: scale(4) },
  body: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  headline: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '700' },
  meta: { fontSize: responsiveFontSize.xs },
  suppressTrack: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  suppressFill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footText: { fontSize: responsiveFontSize.xs },
  suppressBtn: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  suppressBtnText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
});
