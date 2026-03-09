import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, CheckCircle, Heart, Zap, Smile, Dumbbell } from 'lucide-react-native';
import { useGame } from '@/contexts/game';
import { useFeedback } from '@/utils/feedbackSystem';

export default function CureSuccessModal() {
  const { gameState, dismissCureSuccessModal } = useGame();
  const { showCureSuccessModal, curedDiseases, settings, week } = gameState;
  const darkMode = settings.darkMode;
  const { buttonPress, haptic } = useFeedback(gameState.settings.hapticFeedback);

  // Only show modal when in an active game (week > 0 indicates active game)
  const isInActiveGame = week > 0;

  // Auto-dismiss the modal after 8 seconds (increased from 2 seconds)
  useEffect(() => {
    if (isInActiveGame && showCureSuccessModal && curedDiseases.length > 0) {
      const timer = setTimeout(() => {
        dismissCureSuccessModal();
      }, 8000); // 8 seconds

      return () => clearTimeout(timer);
    }
  }, [isInActiveGame, showCureSuccessModal, curedDiseases.length, dismissCureSuccessModal]);

  // Don't render if not in active game or if conditions aren't met
  if (!isInActiveGame || !showCureSuccessModal || curedDiseases.length === 0) {
    return null;
  }

  return (
    <Modal visible={showCureSuccessModal} transparent animationType="fade" onRequestClose={dismissCureSuccessModal}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
          <LinearGradient
            colors={darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <View style={styles.titleContainer}>
                <View style={styles.successIconContainer}>
                  <CheckCircle size={32} color="#10B981" />
                </View>
                <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                  Treatment Successful!
                </Text>
                <Text style={[styles.modalSubtitle, darkMode && styles.modalSubtitleDark]}>
                  Your health conditions have been cured
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  buttonPress();
                  haptic('light');
                  dismissCureSuccessModal();
                }} 
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <X size={24} color={darkMode ? '#FFFFFF' : '#374151'} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={true}
            >
              <View style={[styles.curedDiseasesContainer, darkMode && styles.curedDiseasesContainerDark]}>
                <View style={styles.curedTitleRow}>
                  <CheckCircle size={18} color={darkMode ? '#6EE7B7' : '#166534'} />
                  <Text style={[styles.curedTitle, darkMode && styles.curedTitleDark]}>
                    Cured Conditions:
                  </Text>
                </View>
                {curedDiseases.map((diseaseName, index) => (
                  <View key={index} style={styles.curedDiseaseItem}>
                    <CheckCircle size={16} color="#10B981" />
                    <Text style={[styles.curedDiseaseText, darkMode && styles.curedDiseaseTextDark]}>
                      {diseaseName}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.benefitsContainer, darkMode && styles.benefitsContainerDark]}>
                <Text style={[styles.benefitsTitle, darkMode && styles.benefitsTitleDark]}>
                  Health Benefits:
                </Text>
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <Heart size={16} color="#EF4444" />
                    <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
                      No more health penalties
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Zap size={16} color="#F59E0B" />
                    <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
                      Energy levels restored
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Smile size={16} color="#10B981" />
                    <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
                      Happiness improved
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Dumbbell size={16} color="#8B5CF6" />
                    <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
                      Fitness penalties removed
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.tipContainer, darkMode && styles.tipContainerDark]}>
                <Text style={[styles.tipTitle, darkMode && styles.tipTitleDark]}>
                  Health Tips:
                </Text>
                <Text style={[styles.tipText, darkMode && styles.tipTextDark]}>
                  � Maintain good health with regular doctor visits
                </Text>
                <Text style={[styles.tipText, darkMode && styles.tipTextDark]}>
                  � Eat healthy food and exercise regularly
                </Text>
                <Text style={[styles.tipText, darkMode && styles.tipTextDark]}>
                  � Visit hospitals for serious conditions
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  buttonPress();
                  haptic('success');
                  dismissCureSuccessModal();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Great!</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '95%',
    maxWidth: 600,
    maxHeight: '95%',
    borderRadius: 16,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainerDark: {
    backgroundColor: '#1F2937',
  },
  modalGradient: {
    padding: 28,
    borderRadius: 16,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalSubtitleDark: {
    color: '#9CA3AF',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    maxHeight: 600,
  },
  modalContentContainer: {
    paddingBottom: 20,
  },
  curedDiseasesContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  curedDiseasesContainerDark: {
    backgroundColor: '#14532D',
    borderColor: '#10B981',
  },
  curedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  curedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
  },
  curedTitleDark: {
    color: '#6EE7B7',
  },
  curedDiseaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  curedDiseaseText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
  },
  curedDiseaseTextDark: {
    color: '#A7F3D0',
  },
  benefitsContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  benefitsContainerDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 12,
  },
  benefitsTitleDark: {
    color: '#93C5FD',
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#0284C7',
  },
  benefitTextDark: {
    color: '#93C5FD',
  },
  tipContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  tipContainerDark: {
    backgroundColor: '#92400E',
    borderColor: '#F59E0B',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 8,
  },
  tipTitleDark: {
    color: '#FCD34D',
  },
  tipText: {
    fontSize: 13,
    color: '#D97706',
    lineHeight: 18,
    marginBottom: 4,
  },
  tipTextDark: {
    color: '#FDE68A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

