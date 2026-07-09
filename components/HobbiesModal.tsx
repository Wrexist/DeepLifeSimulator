/**
 * HobbiesModal — the Hobby Mastery screen (v21). Practice hobbies weekly to
 * level them up; each level grants a stronger reward + perk. Refills the gap
 * left when the old hobbies were removed.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { X, Zap } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useToast } from '@/contexts/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/utils/haptics';
import { practicePursuit } from '@/contexts/game/actions/PursuitActions';
import {
  PURSUITS,
  getPlayerPursuit,
  xpIntoLevel,
  XP_PER_LEVEL,
  MAX_PURSUIT_LEVEL,
} from '@/lib/pursuits/pursuitMastery';
import { getThemeColors } from '@/lib/config/theme';
import { fontScale, scale, responsiveBorderRadius, responsiveSpacing, getTabBarSafePadding } from '@/utils/scaling';

interface HobbiesModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HobbiesModal({ visible, onClose }: HobbiesModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { showSuccess, showInfo } = useToast();
  const insets = useSafeAreaInsets();
  const darkMode = gameState.settings?.darkMode !== false;
  const theme = getThemeColors(darkMode);
  const energy = gameState.stats?.energy ?? 0;

  const handlePractice = (pursuitId: string) => {
    const result = practicePursuit(gameState, setGameState, pursuitId);
    if (result.leveledUp) {
      haptic.success();
      showSuccess(result.message);
    } else if (result.success) {
      haptic.light();
      showInfo(result.message);
    } else {
      showInfo(result.message);
    }
    if (result.success) void saveGame?.(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay]}>
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Hobbies</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Practice to master — each level pays off more
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={scale(22)} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.energyRow]}>
            <Zap size={scale(15)} color="#3B82F6" />
            <Text style={[styles.energyText, { color: theme.textSecondary }]}>{Math.round(energy)} energy available</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: responsiveSpacing.md, gap: responsiveSpacing.md }}>
            {PURSUITS.map((p) => {
              const pursuit = getPlayerPursuit(gameState, p.id);
              const practicedThisWeek = gameState.weeklyPursuitPractice?.[p.id] ?? 0;
              const capped = practicedThisWeek >= p.weeklyCap;
              const tooTired = energy < p.energyCost;
              const disabled = capped || tooTired;
              const atMax = pursuit.level >= MAX_PURSUIT_LEVEL;
              const into = xpIntoLevel(pursuit.xp);

              return (
                <View key={p.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: p.color + '55' }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.emoji}>{p.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: theme.text }]}>
                        {p.name} <Text style={{ color: p.color }}>· Lv {pursuit.level}{atMax ? ' (Max)' : ''}</Text>
                      </Text>
                      <Text style={[styles.tagline, { color: theme.textSecondary }]}>{p.tagline}</Text>
                    </View>
                  </View>

                  {/* XP bar */}
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${Math.round((into / XP_PER_LEVEL) * 100)}%`, backgroundColor: p.color }]} />
                  </View>

                  <Text style={[styles.perk, { color: theme.textSecondary }]}>{p.perk(pursuit.level)}</Text>

                  <TouchableOpacity
                    onPress={() => handlePractice(p.id)}
                    disabled={disabled}
                    style={[styles.practiceBtn, { backgroundColor: disabled ? theme.surfaceElevated : p.color }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.practiceText, { color: disabled ? theme.textMuted : '#0F172A' }]}>
                      {capped
                        ? `Practiced ${p.weeklyCap}/${p.weeklyCap} this week`
                        : tooTired
                          ? `Need ${p.energyCost} energy`
                          : `Practice (−${p.energyCost} energy) · ${practicedThisWeek}/${p.weeklyCap}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: scale(20), borderTopRightRadius: scale(20) },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.md, paddingTop: responsiveSpacing.md, paddingBottom: responsiveSpacing.sm,
    borderBottomWidth: 1,
  },
  title: { fontSize: fontScale(20), fontWeight: '800' },
  subtitle: { fontSize: fontScale(12), marginTop: scale(2) },
  closeBtn: { padding: scale(4) },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), paddingHorizontal: responsiveSpacing.md, paddingTop: responsiveSpacing.sm },
  energyText: { fontSize: fontScale(12), fontWeight: '600' },
  card: { padding: scale(14), borderRadius: responsiveBorderRadius.lg, borderWidth: 1, gap: scale(10) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  emoji: { fontSize: fontScale(30) },
  name: { fontSize: fontScale(16), fontWeight: '700' },
  tagline: { fontSize: fontScale(12), marginTop: scale(2) },
  barBg: { height: scale(6), borderRadius: scale(3), backgroundColor: 'rgba(148,163,184,0.2)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: scale(3) },
  perk: { fontSize: fontScale(12), fontWeight: '600' },
  practiceBtn: { paddingVertical: scale(11), borderRadius: responsiveBorderRadius.md, alignItems: 'center' },
  practiceText: { fontSize: fontScale(13.5), fontWeight: '800' },
});
