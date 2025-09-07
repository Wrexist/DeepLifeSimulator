import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Heart, Zap, Smile, Dumbbell, AlertTriangle, Stethoscope, Pill } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

export default function SicknessModal() {
  const { gameState, dismissSicknessModal } = useGame();
  const { showSicknessModal, diseases, settings } = gameState;
  const darkMode = settings.darkMode;
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return '#F59E0B';
      case 'serious': return '#EF4444';
      case 'critical': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'mild': return '⚠️';
      case 'serious': return '🚨';
      case 'critical': return '💀';
      default: return '❓';
    }
  };

  const getEffectIcon = (stat: string) => {
    switch (stat) {
      case 'health': return <Heart size={16} color="#EF4444" />;
      case 'energy': return <Zap size={16} color="#F59E0B" />;
      case 'happiness': return <Smile size={16} color="#10B981" />;
      case 'fitness': return <Dumbbell size={16} color="#8B5CF6" />;
      default: return <AlertTriangle size={16} color="#6B7280" />;
    }
  };

  const getCureMethod = (disease: Disease) => {
    if (disease.curable) {
      if (disease.severity === 'critical') {
        return 'Hospital treatment required';
      } else if (disease.severity === 'serious') {
        return 'Doctor visit or hospital treatment';
      } else {
        return 'Doctor visit, rest, or medication';
      }
    } else {
      return 'No known cure - manage symptoms';
    }
  };

  const getCureIcon = (disease: Disease) => {
    if (disease.curable) {
      if (disease.severity === 'critical') {
        return <Stethoscope size={20} color="#EF4444" />;
      } else {
        return <Pill size={20} color="#10B981" />;
      }
    } else {
      return <AlertTriangle size={20} color="#6B7280" />;
    }
  };

  const totalEffects = diseases.reduce((acc, disease) => {
    Object.entries(disease.effects).forEach(([stat, effect]) => {
      if (effect !== undefined) {
        acc[stat] = (acc[stat] || 0) + effect;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  // Don't show modal if no diseases or modal is not set to show
  if (!showSicknessModal || diseases.length === 0) {
    return null;
  }

  return (
    <Modal visible={showSicknessModal} transparent animationType="fade">
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
                <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>
                  🏥 Health Status
                </Text>
                <Text style={[styles.modalSubtitle, darkMode && styles.modalSubtitleDark]}>
                  {diseases.length === 1 ? 'You have contracted a disease' : `You have ${diseases.length} active conditions`}
                </Text>
              </View>
              <TouchableOpacity onPress={dismissSicknessModal} style={styles.closeButton}>
                <X size={24} color={darkMode ? '#FFFFFF' : '#374151'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Total Effects Summary */}
              {Object.keys(totalEffects).length > 0 && (
                <View style={[styles.effectsSummary, darkMode && styles.effectsSummaryDark]}>
                  <Text style={[styles.effectsTitle, darkMode && styles.effectsTitleDark]}>
                    📊 Total Effects
                  </Text>
                  <View style={styles.effectsList}>
                    {Object.entries(totalEffects).map(([stat, effect]) => (
                      <View key={stat} style={styles.effectItem}>
                        {getEffectIcon(stat)}
                        <Text style={[styles.effectText, darkMode && styles.effectTextDark]}>
                          {stat.charAt(0).toUpperCase() + stat.slice(1)}: {effect > 0 ? '+' : ''}{effect}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Individual Diseases */}
              {diseases.map((disease, index) => (
                <View key={disease.id} style={[styles.diseaseCard, darkMode && styles.diseaseCardDark]}>
                  <View style={styles.diseaseHeader}>
                    <View style={styles.diseaseTitleContainer}>
                      <Text style={styles.severityIcon}>
                        {getSeverityIcon(disease.severity)}
                      </Text>
                      <Text style={[styles.diseaseName, darkMode && styles.diseaseNameDark]}>
                        {disease.name}
                      </Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(disease.severity) }]}>
                      <Text style={styles.severityText}>
                        {disease.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Disease Effects */}
                  <View style={styles.diseaseEffects}>
                    <Text style={[styles.effectsLabel, darkMode && styles.effectsLabelDark]}>
                      Effects:
                    </Text>
                    <View style={styles.effectsGrid}>
                      {Object.entries(disease.effects).map(([stat, effect]) => (
                        effect !== undefined && (
                          <View key={stat} style={styles.effectItem}>
                            {getEffectIcon(stat)}
                            <Text style={[styles.effectText, darkMode && styles.effectTextDark]}>
                              {effect > 0 ? '+' : ''}{effect}
                            </Text>
                          </View>
                        )
                      ))}
                    </View>
                  </View>

                  {/* Cure Information */}
                  <View style={styles.cureInfo}>
                    <View style={styles.cureHeader}>
                      {getCureIcon(disease)}
                      <Text style={[styles.cureLabel, darkMode && styles.cureLabelDark]}>
                        Treatment:
                      </Text>
                    </View>
                    <Text style={[styles.cureText, darkMode && styles.cureTextDark]}>
                      {getCureMethod(disease)}
                    </Text>
                  </View>

                  {/* Special Information */}
                  {disease.weeksUntilDeath && (
                    <View style={[styles.warningBox, darkMode && styles.warningBoxDark]}>
                      <Text style={[styles.warningText, darkMode && styles.warningTextDark]}>
                        ⚠️ Critical: {disease.weeksUntilDeath} weeks remaining
                      </Text>
                    </View>
                  )}

                  {disease.treatmentRequired && (
                    <View style={[styles.treatmentBox, darkMode && styles.treatmentBoxDark]}>
                      <Text style={[styles.treatmentText, darkMode && styles.treatmentTextDark]}>
                        🏥 Immediate treatment required
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Treatment Recommendations */}
              <View style={[styles.recommendations, darkMode && styles.recommendationsDark]}>
                <Text style={[styles.recommendationsTitle, darkMode && styles.recommendationsTitleDark]}>
                  💡 Treatment Recommendations
                </Text>
                <View style={styles.recommendationsList}>
                  <Text style={[styles.recommendationItem, darkMode && styles.recommendationItemDark]}>
                    • Visit a doctor for mild conditions
                  </Text>
                  <Text style={[styles.recommendationItem, darkMode && styles.recommendationItemDark]}>
                    • Go to hospital for serious conditions
                  </Text>
                  <Text style={[styles.recommendationItem, darkMode && styles.recommendationItemDark]}>
                    • Rest and eat healthy food to recover faster
                  </Text>
                  <Text style={[styles.recommendationItem, darkMode && styles.recommendationItemDark]}>
                    • Some conditions may resolve naturally over time
                  </Text>
                </View>
              </View>

              {/* Death Warning */}
              <View style={[styles.deathWarning, darkMode && styles.deathWarningDark]}>
                <Text style={[styles.deathWarningTitle, darkMode && styles.deathWarningTitleDark]}>
                  ⚠️ Critical Warning
                </Text>
                <Text style={[styles.deathWarningText, darkMode && styles.deathWarningTextDark]}>
                  If your health or happiness drops to 0 and stays there for 4 weeks without improvement, your character will die. Seek treatment immediately!
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={dismissSicknessModal}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>I Understand</Text>
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
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
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
    padding: 24,
    borderRadius: 16,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalSubtitleDark: {
    color: '#9CA3AF',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    marginBottom: 20,
  },
  effectsSummary: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  effectsSummaryDark: {
    backgroundColor: '#374151',
  },
  effectsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  effectsTitleDark: {
    color: '#FFFFFF',
  },
  effectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  effectText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  effectTextDark: {
    color: '#D1D5DB',
  },
  diseaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  diseaseCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  diseaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  diseaseTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityIcon: {
    fontSize: 20,
  },
  diseaseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  diseaseNameDark: {
    color: '#FFFFFF',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  diseaseEffects: {
    marginBottom: 12,
  },
  effectsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  effectsLabelDark: {
    color: '#D1D5DB',
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cureInfo: {
    marginBottom: 8,
  },
  cureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cureLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  cureLabelDark: {
    color: '#D1D5DB',
  },
  cureText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  cureTextDark: {
    color: '#9CA3AF',
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  warningBoxDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#DC2626',
  },
  warningText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  warningTextDark: {
    color: '#FCA5A5',
  },
  treatmentBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  treatmentBoxDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  treatmentText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '500',
  },
  treatmentTextDark: {
    color: '#93C5FD',
  },
  recommendations: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  recommendationsDark: {
    backgroundColor: '#14532D',
    borderColor: '#10B981',
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 12,
  },
  recommendationsTitleDark: {
    color: '#6EE7B7',
  },
  recommendationsList: {
    gap: 6,
  },
  recommendationItem: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  recommendationItemDark: {
    color: '#A7F3D0',
  },
  deathWarning: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  deathWarningDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#DC2626',
  },
  deathWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 6,
  },
  deathWarningTitleDark: {
    color: '#FCA5A5',
  },
  deathWarningText: {
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
  deathWarningTextDark: {
    color: '#FCA5A5',
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
