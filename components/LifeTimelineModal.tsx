/**
 * LifeTimelineModal — the chronological "This Life" view (2026-08-24, §11).
 *
 * The game has always stamped weeks on careers, births, marriages, notable
 * events and journal entries, and never assembled them into the one view the
 * life-sim fantasy is built on: "first job at 22, married at 29, first
 * million at 41". `buildLifeTimeline` (lib/progress/lifeTimeline.ts) is that
 * assembly; this modal renders it newest-first, so the scroll starts at "now"
 * and digs back into the life.
 */
import React, { useMemo } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { X, CalendarClock, Briefcase, Heart, Star, BookOpen, TrendingUp } from 'lucide-react-native';
import { useGameState } from '@/contexts/game/GameStateContext';
import { buildLifeTimeline, type TimelineKind } from '@/lib/progress/lifeTimeline';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const KIND_META: Record<TimelineKind, { icon: typeof Briefcase; color: string }> = {
  career: { icon: Briefcase, color: '#60A5FA' },
  family: { icon: Heart, color: '#EC4899' },
  event: { icon: Star, color: '#FBBF24' },
  journal: { icon: BookOpen, color: '#94A3B8' },
  wealth: { icon: TrendingUp, color: '#34D399' },
};

export default function LifeTimelineModal({ visible, onClose }: Props) {
  const { gameState } = useGameState();
  const darkMode = gameState?.settings?.darkMode ?? true;

  const entries = useMemo(
    () => (visible ? buildLifeTimeline(gameState) : []),
    [visible, gameState]
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: darkMode ? '#0F172A' : '#F8FAFC' }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <CalendarClock size={scale(20)} color="#A78BFA" />
              <Text style={[styles.title, { color: darkMode ? '#F8FAFC' : '#0F172A' }]}>
                This Life
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(22)} color={darkMode ? '#94A3B8' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
            {entries.length === 0 ? (
              <Text style={[styles.empty, { color: darkMode ? '#94A3B8' : '#6B7280' }]}>
                Nothing on the record yet — live a little.
              </Text>
            ) : (
              entries.map((entry, index) => {
                const meta = KIND_META[entry.kind];
                const Icon = meta.icon;
                return (
                  <View key={entry.id} style={styles.row}>
                    <View style={styles.railColumn}>
                      <View style={[styles.dot, { borderColor: meta.color }]}>
                        <Icon size={scale(12)} color={meta.color} />
                      </View>
                      {index < entries.length - 1 && (
                        <View style={[styles.rail, { backgroundColor: darkMode ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.15)' }]} />
                      )}
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.age, { color: meta.color }]}>
                        Age {entry.age}
                        {entry.repeats && entry.repeats > 1 ? `  ·  ${entry.repeats} weeks running` : ''}
                      </Text>
                      <Text style={[styles.rowTitle, { color: darkMode ? '#F1F5F9' : '#111827' }]}>
                        {entry.title}
                      </Text>
                      {!!entry.detail && (
                        <Text style={[styles.rowDetail, { color: darkMode ? '#94A3B8' : '#6B7280' }]} numberOfLines={2}>
                          {entry.detail}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: responsiveBorderRadius.xl,
    borderTopRightRadius: responsiveBorderRadius.xl,
    // Hard Rule #7 exception: the hairline wrapping a bottom sheet's rounded top.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    paddingHorizontal: scale(18),
    paddingTop: scale(14),
    paddingBottom: scale(24),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  title: { fontSize: fontScale(18), fontWeight: '800' },
  // flexShrink so the list actually bounds inside the maxHeight sheet — the
  // soft-lock class __tests__/render/modalListsShrink.test.ts ratchets.
  scroll: { flexGrow: 0, flexShrink: 1 },
  empty: { fontSize: fontScale(13), paddingVertical: scale(24), textAlign: 'center' },
  row: { flexDirection: 'row', gap: scale(12) },
  railColumn: { alignItems: 'center', width: scale(28) },
  dot: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  rail: { flex: 1, width: 1, marginVertical: scale(2) },
  rowBody: { flex: 1, paddingBottom: scale(16) },
  age: { fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.4 },
  rowTitle: { fontSize: fontScale(13.5), fontWeight: '700', marginTop: scale(2) },
  rowDetail: { fontSize: fontScale(11.5), marginTop: scale(2) },
});
