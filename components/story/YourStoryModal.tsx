/**
 * YourStoryModal - one door to the four surfaces that answer "what happened in
 * my life?".
 *
 * The 2026-09-01 UI audit found Life Story, Timeline, Journal and Share Life
 * sitting as four separate tiles in the Progress screen's nine-tile "Tools &
 * More" grid - four launchers for one concept, which is how a drawer of
 * unrelated things gets built one feature at a time (blueprint §2 item 6,
 * §10). This is a HUB, not a rewrite: each row opens the existing component
 * untouched, so nothing about those surfaces changed except how many tiles it
 * takes to find them.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BookOpen, CalendarClock, ChevronRight, NotebookPen, Share2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';
import { fontScale, scale } from '@/utils/scaling';

/** Which surface a row opens. The parent owns the actual modals. */
export type StorySurface = 'story' | 'timeline' | 'journal' | 'share';

interface YourStoryModalProps {
  visible: boolean;
  onClose: () => void;
  onOpen: (surface: StorySurface) => void;
}

const ROWS: { id: StorySurface; label: string; blurb: string; icon: LucideIcon; color: string }[] = [
  {
    id: 'story',
    label: 'Life Story',
    blurb: 'The narrative of this life, written as you live it',
    icon: BookOpen,
    color: '#8B5CF6',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    blurb: 'Careers, births, marriages and windfalls, by age',
    icon: CalendarClock,
    color: '#A78BFA',
  },
  {
    id: 'journal',
    label: 'Journal',
    blurb: 'Your diary, searchable by category',
    icon: NotebookPen,
    color: '#38BDF8',
  },
  {
    id: 'share',
    label: 'Share',
    blurb: 'A card of this life, ready to send',
    icon: Share2,
    color: '#34D399',
  },
];

export default function YourStoryModal({ visible, onClose, onOpen }: YourStoryModalProps) {
  const { theme } = useTheme();

  return (
    <BaseModal visible={visible} onClose={onClose} title="Your Story">
      <View style={styles.list}>
        {ROWS.map((row) => {
          const Icon = row.icon;
          return (
            <TouchableOpacity
              key={row.id}
              activeOpacity={0.8}
              onPress={() => onOpen(row.id)}
              style={[styles.row, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              accessibilityHint={row.blurb}
            >
              <View style={[styles.iconBubble, { backgroundColor: `${row.color}21`, borderColor: `${row.color}66` }]}>
                <Icon size={scale(16)} color={row.color} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={[styles.rowBlurb, { color: theme.textSecondary }]} numberOfLines={2}>
                  {row.blurb}
                </Text>
              </View>
              <ChevronRight size={scale(15)} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: scale(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(12),
    borderRadius: scale(14),
    borderWidth: 1,
  },
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  rowBlurb: {
    fontSize: fontScale(12),
    marginTop: scale(1),
  },
});
