/**
 * DangerZone — Restart game and bug report buttons with confirmation modal.
 * Extracted from SettingsModal to reduce its size.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert, StyleSheet } from 'react-native';
import { Shield, Bug, RotateCcw, X } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { useGame } from '@/contexts/GameContext';
import { initialGameState } from '@/contexts/game/initialState';
import { logger } from '@/utils/logger';
import { responsivePadding, responsiveFontSize, responsiveBorderRadius, responsiveSpacing, scale, fontScale } from '@/utils/scaling';

interface Props {
  onShowBugReport: () => void;
  onModalClose: () => void;
}

export default function DangerZone({ onShowBugReport, onModalClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { setGameState } = useGame();
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const confirmRestart = async () => {
    try {
      setGameState(initialGameState);
      setShowRestartConfirm(false);
      onModalClose();
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
              <TouchableOpacity onPress={() => setShowRestartConfirm(false)} style={styles.closeButton}>
                <X size={24} color="#D1D5DB" />
              </TouchableOpacity>
            </View>

            <View style={styles.confirmContent}>
              <Text style={styles.confirmDescription}>
                Are you sure you want to restart? All progress will be lost.
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
    backgroundColor: '#1F2937',
    borderRadius: responsiveBorderRadius.xl,
    maxWidth: 450,
    width: '90%',
    overflow: 'hidden',
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
    color: '#9CA3AF',
    marginBottom: responsiveSpacing.lg,
    lineHeight: 22,
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
    color: '#D1D5DB',
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
