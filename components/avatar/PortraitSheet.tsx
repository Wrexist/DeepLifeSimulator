import { useTheme } from '@/hooks/useTheme';
import { gameAlert } from '@/utils/gameAlert';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useGameSelector, useSetGameState } from '@/contexts/game/useGameSelector';
import BaseModal from '@/components/ui/BaseModal';
import PortraitPicker from '@/components/onboarding/PortraitPicker';
import CharacterAvatar from './CharacterAvatar';
import MotionPressable from '@/components/ui/MotionPressable';
import { isPortraitId, type PortraitId } from '@/lib/avatar/portraits';
import { accent, colors } from '@/lib/config/theme';
import { scale, fontScale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';

/** Mounted only while open. A cancelled selection never writes to the save. */
export default function PortraitSheet({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const profile = useGameSelector(s => s.userProfile);
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const [selected, setSelected] = useState<PortraitId>(isPortraitId(profile?.avatarId) ? profile.avatarId : 'portrait-v1:ember');
  const [saving, setSaving] = useState(false);
  const apply = async (avatarId: PortraitId | undefined) => {
    if (saving) return;
    setSaving(true);
    setGameState(prev => ({ ...prev, userProfile: { ...prev.userProfile, avatarId } }));
    try { await saveGame(); haptic.success(); onClose(); } catch { gameAlert('Could not save your look', 'Your selection is visible in this session. Please try saving again.'); } finally { setSaving(false); }
  };
  return <BaseModal visible onClose={onClose} title="Your look" subtitle="A portrait for your story. Your identity and progress stay with you.">
    <View style={styles.preview}><CharacterAvatar source={{ ...profile, avatarId: selected }} size={scale(160)} circular={false} /></View>
    <PortraitPicker value={selected} onChange={setSelected} />
    <MotionPressable disabled={saving} onPress={() => { void apply(selected); }} style={styles.confirm} accessibilityLabel="Use this portrait">
      <Text style={styles.confirmText}>{saving ? 'Saving…' : 'Use this portrait'}</Text>
    </MotionPressable>
    <MotionPressable disabled={saving} onPress={() => { void apply(undefined); }} style={[styles.custom, { backgroundColor: theme.surfaceInteractive }]} accessibilityLabel="Use my custom avatar">
      <Text style={[styles.confirmText, { color: theme.text }]}>Use my custom avatar</Text>
    </MotionPressable>
  </BaseModal>;
}
const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginBottom: scale(16) },
  confirm: { backgroundColor: accent.info, borderRadius: scale(12), minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: scale(16) },
  custom: { backgroundColor: colors.dark.surfaceInteractive, borderRadius: scale(12), minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: scale(8) },
  confirmText: { color: colors.dark.text, fontSize: fontScale(14), fontWeight: '600' },
});
