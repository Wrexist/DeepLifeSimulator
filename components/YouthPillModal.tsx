import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Zap } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';

interface YouthPillModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function YouthPillModal({ visible, onClose }: YouthPillModalProps) {
  const { gameState, setGameState } = useGame();
  const { settings } = gameState;
  const youthPills = gameState.youthPills || 0;
  const currentAge = gameState.userProfile?.age || 18;

  const handleUseYouthPill = () => {
    if (youthPills <= 0) return;

    // Use one youth pill and reset age to 18
    setGameState(prev => ({
      ...prev,
      youthPills: Math.max(0, prev.youthPills - 1),
      userProfile: {
        ...prev.userProfile,
        age: 18,
      }
    }));

    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          <LinearGradient
            colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                  <Image 
                    source={require('@/assets/images/iap/items/youth_pill_single.png')} 
                    style={styles.headerIcon}
                    resizeMode="contain"
                  />
                </View>
                <View>
                  <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Youth Pill</Text>
                  <Text style={[styles.subtitle, settings.darkMode && styles.subtitleDark]}>
                    Reset your age to 18
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#D1D5DB' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.infoCard}>
                <LinearGradient
                  colors={['rgba(139, 92, 246, 0.1)', 'rgba(124, 58, 237, 0.05)']}
                  style={styles.infoCardGradient}
                >
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, settings.darkMode && styles.infoLabelDark]}>
                      Youth Pills Available:
                    </Text>
                    <View style={styles.pillCountContainer}>
                      <Image 
                        source={require('@/assets/images/iap/items/youth_pill_single.png')} 
                        style={styles.countIcon}
                        resizeMode="contain"
                      />
                      <Text style={[styles.pillCount, { color: youthPills > 0 ? '#8B5CF6' : '#EF4444' }]}>
                        {youthPills}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, settings.darkMode && styles.infoLabelDark]}>
                      Current Age:
                    </Text>
                    <Text style={[styles.infoValue, settings.darkMode && styles.infoValueDark]}>
                      {currentAge} years
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.description}>
                <Text style={[styles.descriptionText, settings.darkMode && styles.descriptionTextDark]}>
                  Using a Youth Pill will instantly reset your age to 18 years old, giving you a fresh start with extended lifespan.
                </Text>
              </View>

              {youthPills <= 0 && (
                <View style={styles.warningCard}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.05)']}
                    style={styles.warningCardGradient}
                  >
                    <Text style={styles.warningText}>
                      You don't have any Youth Pills! Purchase them from the Gem Shop.
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelButton, settings.darkMode && styles.cancelButtonDark]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, settings.darkMode && styles.cancelButtonTextDark]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.useButton, youthPills <= 0 && styles.useButtonDisabled]}
                onPress={handleUseYouthPill}
                disabled={youthPills <= 0}
              >
                <LinearGradient
                  colors={youthPills > 0 ? ['#8B5CF6', '#7C3AED'] : ['#9CA3AF', '#6B7280']}
                  style={styles.useButtonGradient}
                >
                  <Image 
                    source={require('@/assets/images/iap/items/youth_pill_single.png')} 
                    style={styles.buttonIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.useButtonText}>Use</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    width: '90%',
    maxWidth: scale(400),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  modalGradient: {
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  content: {
    marginBottom: responsiveSpacing.lg,
  },
  infoCard: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginBottom: responsiveSpacing.md,
  },
  infoCardGradient: {
    padding: responsiveSpacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  infoLabel: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    fontWeight: '600',
  },
  infoLabelDark: {
    color: '#9CA3AF',
  },
  pillCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
  },
  pillCount: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    marginLeft: responsiveSpacing.xs,
  },
  infoValue: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoValueDark: {
    color: '#FFFFFF',
  },
  description: {
    marginBottom: responsiveSpacing.md,
  },
  descriptionText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: responsiveFontSize.sm * 1.5,
  },
  descriptionTextDark: {
    color: '#9CA3AF',
  },
  warningCard: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  warningCardGradient: {
    padding: responsiveSpacing.md,
  },
  warningText: {
    fontSize: responsiveFontSize.sm,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonDark: {
    borderColor: '#374151',
  },
  cancelButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#6B7280',
  },
  cancelButtonTextDark: {
    color: '#9CA3AF',
  },
  useButton: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
    marginRight: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  useButtonDisabled: {
    opacity: 0.5,
  },
  useButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  useButtonText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerIcon: {
    width: 24,
    height: 24,
  },
  buttonIcon: {
    width: 20,
    height: 20,
  },
  countIcon: {
    width: 20,
    height: 20,
  },
});

