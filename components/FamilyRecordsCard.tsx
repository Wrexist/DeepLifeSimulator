/**
 * FamilyRecordsCard - the dynasty's personal bests, and where this life
 * stands against them.
 *
 * "Beat your own best life" is the cheapest durable goal a life-sim has, and
 * until this card the only self-comparison in the game was one line inside a
 * modal behind IdentityCard (2026-08-25 retention audit). Read-only over
 * `familyRecords` (derived from previousLives + the live life - nothing
 * stored, nothing granted); renders null on a first life, where a board of
 * empty records would be noise.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Medal } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { safeSettings } from '@/utils/safeGameState';
import { familyRecords, type FamilyRecordRow } from '@/lib/legacy/records';
import { formatMoney } from '@/utils/moneyFormatting';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

function valueLabel(row: FamilyRecordRow, value: number): string {
  switch (row.kind) {
    case 'money':
      return formatMoney(value);
    case 'age':
      return `age ${Math.floor(value)}`;
    case 'score':
      return `${Math.round(value)}/100`;
    default:
      return String(Math.round(value));
  }
}

function FamilyRecordsCard() {
  // Records read net worth, life quality, family and companies - arbitrary
  // state - so select the whole snapshot, the WeeklyChallengeCard trade-off.
  const state = useGameSelector((s) => s) as GameState;
  const darkMode = useGameSelector((s) => safeSettings(s).darkMode);
  const rows = useMemo(() => familyRecords(state), [state]);

  if (rows.length === 0) return null;

  return (
    <View style={[styles.card, !darkMode && styles.cardLight]}>
      <View style={styles.header}>
        <Medal size={scale(15)} color="#FBBF24" />
        <Text style={[styles.title, !darkMode && styles.titleLight]}>Family Records</Text>
      </View>
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, !darkMode && styles.rowLabelLight]}>{row.label}</Text>
            <Text style={styles.rowHolder} numberOfLines={1}>
              {row.currentLeads ? 'This life - new record!' : row.bestHolder}
            </Text>
          </View>
          <View style={styles.rowValues}>
            <Text
              style={[
                styles.rowBest,
                !darkMode && styles.rowBestLight,
                row.currentLeads && styles.rowBeaten,
              ]}
            >
              {valueLabel(row, row.currentLeads ? row.current : row.best)}
            </Text>
            {!row.currentLeads && row.current > 0 && (
              <Text style={styles.rowCurrent}>you: {valueLabel(row, row.current)}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.28)',
    gap: scale(10),
  },
  cardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(217, 119, 6, 0.3)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
  title: { color: '#F8FAFC', fontSize: fontScale(13.5), fontWeight: '800', letterSpacing: 0.3 },
  titleLight: { color: '#1E293B' },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  rowLabel: { color: '#E2E8F0', fontSize: fontScale(12), fontWeight: '600' },
  rowLabelLight: { color: '#334155' },
  rowHolder: { color: '#94A3B8', fontSize: fontScale(10.5), marginTop: scale(1) },
  rowValues: { alignItems: 'flex-end' },
  rowBest: { color: '#F8FAFC', fontSize: fontScale(12.5), fontWeight: '700' },
  rowBestLight: { color: '#1E293B' },
  rowBeaten: { color: '#34D399' },
  rowCurrent: { color: '#64748B', fontSize: fontScale(10), marginTop: scale(1) },
});

export default React.memo(FamilyRecordsCard);
