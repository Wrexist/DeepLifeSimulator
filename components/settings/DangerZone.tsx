/**
 * DangerZone — Restart game and bug report buttons with confirmation modal.
 * Extracted from SettingsModal to reduce its size.
 */

import React, { useState } from 'react';
import { CLOSE_BUTTON_A11Y, hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { View, Text, TouchableOpacity, Modal, Alert, StyleSheet } from 'react-native';
import { Shield, Bug, RotateCcw, X } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { useGame } from '@/contexts/GameContext';
import { initialGameState } from '@/contexts/game/initialState';
import { carryAccountLevelEntitlements } from '@/lib/prestige/accountEntitlements';
import { logger } from '@/utils/logger';
import { safeRemoveItem } from '@/utils/safeStorage';
import { suspendLifeAutosave } from '@/utils/autosaveSuspension';
import { responsivePadding, responsiveFontSize, responsiveBorderRadius, responsiveSpacing, scale, fontScale } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
const LinearGradient = Gradient;

interface Props {
  onShowBugReport: () => void;
  onModalClose: () => void;
}

export default function DangerZone({ onShowBugReport, onModalClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { setGameState, currentSlot } = useGame();
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const confirmRestart = async () => {
    try {
      // Restart is the THIRD builder that starts from `initialGameState`, and
      // it was the one that never carried purchases. `accountEntitlements.ts`
      // says to call this from every such builder; prestige and the heir flow
      // do, this did not. So "Restart Game" silently destroyed Remove Ads,
      // Lifetime Premium, all nine gem-bought permanent gold upgrades, every
      // purchased perk, unspent Youth Pills, the Revival Pack and the four
      // banking unlocks — and the 2-minute autosave then wrote the wipe to
      // disk. The confirm dialog only ever warned about "progress".
      // 2026-07-30 audit MON-2.
      // Deep-clone FIRST. `carryAccountLevelEntitlements` mutates its second
      // argument (its own docstring says so), so handing it the exported
      // `initialGameState` singleton would write this life's purchases onto the
      // shared template — permanently, for the rest of the process, so every
      // later new game would start with them. The two prestige callers pass a
      // freshly built object; this one had the singleton itself to hand.
      setGameState((prev) =>
        carryAccountLevelEntitlements(prev, JSON.parse(JSON.stringify(initialGameState)) as typeof initialGameState),
      );
      setShowRestartConfirm(false);
      onModalClose();

      /**
       * R3-S3 (round 3): the reset can never be SAVED, so it must be DELETED.
       *
       * The previous version awaited `saveGame(true)` here, with a comment
       * explaining that an app exit right after Restart would otherwise leave
       * the old life on disk. That is exactly what happened anyway: the state
       * this handler builds comes from `initialGameState`, so it has no
       * `scenarioId` and an empty `userProfile.firstName`/`lastName`, and
       * `carryAccountLevelEntitlements` copies only settings, gold upgrades,
       * perks and youth pills — never a name or a scenario. So
       * `isPristineUnstartedState` returns true and `saveGame` bails before
       * writing. The 2-minute autosave bails on the same guard.
       *
       * The wipe was therefore memory-only: `lastSlot` and the slot blob still
       * held the old character, MainMenu's Continue card still showed their
       * name and age, and tapping it reloaded the life the player had just
       * confirmed destroying. With all three slots full, "New Game" also still
       * reported "All Save Slots Full".
       *
       * Deleting is the correct operation and needs no pristine exemption: a
       * pristine state must never be written (that is the phantom-save rule
       * `isPristineUnstartedState` exists to enforce), and "restart" means the
       * old life is gone. Same sequence as DeathPopup's new-game path.
       */
      const slot = typeof currentSlot === 'number' && currentSlot > 0 ? currentSlot : null;
      if (slot != null) {
        const { snapshotOutgoingSave } = await import('@/utils/saveBackup');
        await snapshotOutgoingSave(slot, 'before_overwrite').catch(() => {});
        const { deleteSaveSlot } = await import('@/utils/saveValidation');
        await deleteSaveSlot(slot);
        await import('@/utils/saveSlotMeta')
          .then((m) => m.deleteSaveSlotMeta(slot))
          .catch(() => {});
      }
      await safeRemoveItem('lastSlot');

      // The player is heading to the menus with a pristine state in memory;
      // stop the ambient autosave from writing anything back (R3-S1).
      suspendLifeAutosave('settings -> restart game');

      const mainMenuPath: Href = '/(onboarding)/MainMenu';
      router.push(mainMenuPath);
    } catch (error) {
      logger.error('Failed to restart game:', error);
      Alert.alert('Error', 'Failed to restart game. Please try again.');
    }
  };

  return (
    <>
      <View style={styles.section}>
        <View style={[styles.sectionBlur, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
          <LinearGradient
            colors={['rgba(127, 29, 29, 0.3)', 'rgba(95, 21, 21, 0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sectionGradient}
          >
            <View style={styles.header}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dangerIconContainer}
              >
                <Shield size={20} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.dangerTitle}>{t('settings.dangerZone')}</Text>
            </View>

            <TouchableOpacity
              style={styles.buttonContainer}
              onPress={onShowBugReport}
              accessibilityLabel={t('settings.reportBug')}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <Bug size={18} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>{t('settings.reportBug')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonContainer}
              onPress={() => setShowRestartConfirm(true)}
              accessibilityLabel={t('settings.restartGame')}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <RotateCcw size={18} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>{t('settings.restartGame')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>

      {/* Restart Confirmation Modal */}
      <Modal
        visible={showRestartConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestartConfirm(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmTitle}>Restart Game</Text>
              <TouchableOpacity
                onPress={() => setShowRestartConfirm(false)}
                style={[styles.closeButton, minTouchTargetStyle]}
                hitSlop={hitSlopToMinTarget(scale(24))}
                {...CLOSE_BUTTON_A11Y}
              >
                <X size={24} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <View style={styles.confirmContent}>
              <Text style={styles.confirmDescription}>
                Are you sure you want to restart? All progress will be lost. Purchases you have paid for are kept.
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowRestartConfirm(false)}
                >
                  <Text style={styles.cancelButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={confirmRestart}>
                  <Text style={styles.confirmButtonText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  sectionBlur: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  sectionGradient: {
    padding: responsivePadding.large,
    borderRadius: responsiveBorderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
  },
  dangerIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FCA5A5',
  },
  buttonContainer: {
    marginBottom: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
  },
  buttonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  buttonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  confirmModal: {
    backgroundColor: '#1E293B',
    borderRadius: responsiveBorderRadius.xl,
    maxWidth: 450,
    width: '90%',
    overflow: 'hidden',
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  confirmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.large,
    paddingBottom: responsivePadding.medium,
  },
  confirmTitle: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  closeButton: {
    borderRadius: scale(20),
  },
  confirmContent: {
    padding: responsivePadding.large,
  },
  confirmDescription: {
    fontSize: responsiveFontSize.base,
    color: '#94A3B8',
    marginBottom: responsiveSpacing.lg,
    // Scaled font in a raw line box clips on a tablet; scale it at the same ratio.
    lineHeight: fontScale(22),
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  cancelButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#EF4444',
  },
  confirmButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
