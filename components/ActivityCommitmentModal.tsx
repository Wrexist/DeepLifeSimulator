import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur'; // Removed - TurboModule crash fix
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { X, Target, Briefcase, Heart, Dumbbell, Music, Clock, TrendingUp, Zap, AlertCircle } from 'lucide-react-native';
import { scale, fontScale, responsivePadding, responsiveSpacing } from '@/utils/scaling';
import { getCommitmentBonuses, getCommitmentPenalties, canChangeCommitments, type CommitmentArea } from '@/lib/commitments/commitmentSystem';

interface ActivityCommitmentModalProps {
  visible: boolean;
  onClose: () => void;
}

const AREA_CONFIG: Record<CommitmentArea, { label: string; icon: typeof Briefcase; color: string; description: string }> = {
  career: {
    label: 'Career',
    icon: Briefcase,
    color: '#3B82F6',
    description: 'Focus on work and career advancement',
  },
  hobbies: {
    label: 'Hobbies',
    icon: Music,
    color: '#8B5CF6',
    description: 'Focus on hobbies and creative pursuits',
  },
  relationships: {
    label: 'Relationships',
    icon: Heart,
    color: '#EF4444',
    description: 'Focus on social connections and relationships',
  },
  health: {
    label: 'Health',
    icon: Dumbbell,
    color: '#10B981',
    description: 'Focus on fitness and health activities',
  },
};

export default function ActivityCommitmentModal({ visible, onClose }: ActivityCommitmentModalProps) {
  const { gameState, changeActivityCommitment } = useGame();
  const insets = useSafeAreaInsets();
  const { settings } = gameState;
  const commitments = gameState.activityCommitments;
  
  const [selectedPrimary, setSelectedPrimary] = useState<CommitmentArea | undefined>(commitments?.primary);
  const [selectedSecondary, setSelectedSecondary] = useState<CommitmentArea | undefined>(commitments?.secondary);

  // Reset selections when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedPrimary(commitments?.primary);
      setSelectedSecondary(commitments?.secondary);
    }
  }, [visible, commitments]);

  const { canChange, weeksUntilChange } = useMemo(() => {
    return canChangeCommitments(gameState);
  }, [gameState]);

  const commitmentLevels = commitments?.commitmentLevels || {
    career: 0,
    hobbies: 0,
    relationships: 0,
    health: 0,
  };

  const handleSave = () => {
    // Validate: secondary cannot be same as primary
    if (selectedPrimary && selectedSecondary && selectedPrimary === selectedSecondary) {
      Alert.alert('Invalid Selection', 'Primary and secondary commitments must be different.');
      return;
    }

    const result = changeActivityCommitment(selectedPrimary, selectedSecondary);
    
    if (result.success) {
      Alert.alert('Success', result.message);
      onClose();
    } else {
      Alert.alert('Cannot Change', result.message);
    }
  };

  const getAreaBonuses = (area: CommitmentArea) => {
    const bonuses = getCommitmentBonuses(gameState, area);
    const penalties = getCommitmentPenalties(gameState, area);
    return { bonuses, penalties };
  };

  const renderAreaCard = (area: CommitmentArea) => {
    const config = AREA_CONFIG[area];
    const Icon = config.icon;
    const isPrimary = selectedPrimary === area;
    const isSecondary = selectedSecondary === area;
    const level = commitmentLevels[area] || 0;
    const { bonuses, penalties } = getAreaBonuses(area);

    return (
      <TouchableOpacity
        key={area}
        style={[
          styles.areaCard,
          settings.darkMode && styles.areaCardDark,
          isPrimary && { borderColor: config.color, borderWidth: 3 },
          isSecondary && !isPrimary && { borderColor: config.color, borderWidth: 2, borderStyle: 'dashed' },
        ]}
        onPress={() => {
          if (isPrimary) {
            setSelectedPrimary(undefined);
          } else if (isSecondary) {
            setSelectedSecondary(undefined);
          } else {
            // Set as primary if none selected, otherwise as secondary
            if (!selectedPrimary) {
              setSelectedPrimary(area);
            } else if (!selectedSecondary) {
              setSelectedSecondary(area);
            } else {
              // Replace secondary
              setSelectedSecondary(area);
            }
          }
        }}
      >
        <View style={styles.areaHeader}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
            <Icon size={24} color={config.color} />
          </View>
          <View style={styles.areaInfo}>
            <Text style={[styles.areaLabel, settings.darkMode && styles.textDark]}>
              {config.label}
            </Text>
            <Text style={[styles.areaDescription, settings.darkMode && styles.textDarkSecondary]}>
              {config.description}
            </Text>
          </View>
          {isPrimary && (
            <View style={[styles.badge, { backgroundColor: config.color }]}>
              <Text style={styles.badgeText}>PRIMARY</Text>
            </View>
          )}
          {isSecondary && !isPrimary && (
            <View style={[styles.badge, styles.badgeSecondary, { borderColor: config.color }]}>
              <Text style={[styles.badgeText, { color: config.color }]}>SECONDARY</Text>
            </View>
          )}
        </View>

        {/* Commitment Level */}
        <View style={styles.levelSection}>
          <Text style={[styles.levelLabel, settings.darkMode && styles.textDarkSecondary]}>
            Commitment Level: {level}/100
          </Text>
          <View style={styles.levelBar}>
            <View
              style={[
                styles.levelFill,
                { width: `${level}%`, backgroundColor: config.color },
              ]}
            />
          </View>
        </View>

        {/* Bonuses/Penalties */}
        <View style={styles.bonusSection}>
          {isPrimary && (
            <View style={styles.bonusRow}>
              <TrendingUp size={16} color="#10B981" />
              <Text style={[styles.bonusText, settings.darkMode && styles.textDark]}>
                +{Math.round(bonuses.progressBonus)}% progress, -{Math.round(bonuses.energyReduction)}% energy cost
              </Text>
            </View>
          )}
          {isSecondary && !isPrimary && (
            <View style={styles.bonusRow}>
              <TrendingUp size={16} color="#10B981" />
              <Text style={[styles.bonusText, settings.darkMode && styles.textDark]}>
                +{Math.round(bonuses.progressBonus)}% progress, -{Math.round(bonuses.energyReduction)}% energy cost
              </Text>
            </View>
          )}
          {!isPrimary && !isSecondary && penalties.progressPenalty > 0 && (
            <View style={styles.bonusRow}>
              <AlertCircle size={16} color="#EF4444" />
              <Text style={[styles.penaltyText, settings.darkMode && styles.textDark]}>
                -{Math.round(penalties.progressPenalty)}% progress, +{Math.round(penalties.energyIncrease)}% energy cost
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <BlurView intensity={20} style={styles.blurOverlay}>
          <LinearGradient
            colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
            style={styles.modal}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.headerIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Target size={24} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[styles.title, settings.darkMode && styles.textDark]}>
                    Activity Commitments
                  </Text>
                  <Text style={[styles.subtitle, settings.darkMode && styles.textDarkSecondary]}>
                    Focus on specific areas for bonuses
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={settings.darkMode ? '#FFFFFF' : '#1F2937'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
              {/* Cooldown Warning */}
              {!canChange && (
                <View style={[styles.warningCard, settings.darkMode && styles.warningCardDark]}>
                  <Clock size={20} color="#F59E0B" />
                  <Text style={[styles.warningText, settings.darkMode && styles.textDark]}>
                    You can change commitments in {weeksUntilChange} week(s)
                  </Text>
                </View>
              )}

              {/* Info Card */}
              <View style={[styles.infoCard, settings.darkMode && styles.infoCardDark]}>
                <Text style={[styles.infoTitle, settings.darkMode && styles.textDark]}>
                  How It Works
                </Text>
                <Text style={[styles.infoText, settings.darkMode && styles.textDarkSecondary]}>
                  • Choose up to 2 focus areas (Primary & Secondary){'\n'}
                  • Committed areas get bonuses: +30-50% progress, -20-30% energy cost{'\n'}
                  • Neglected areas get penalties: -15% progress, +15% energy cost{'\n'}
                  • Commitment levels increase with activity, decay when neglected{'\n'}
                  • You can change commitments once every 4 weeks
                </Text>
              </View>

              {/* Area Cards */}
              <View style={styles.areasContainer}>
                {(['career', 'hobbies', 'relationships', 'health'] as CommitmentArea[]).map(area =>
                  renderAreaCard(area)
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cancelButton, settings.darkMode && styles.cancelButtonDark]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, settings.darkMode && styles.textDark]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!canChange || (selectedPrimary === commitments?.primary && selectedSecondary === commitments?.secondary)) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!canChange || (selectedPrimary === commitments?.primary && selectedSecondary === commitments?.secondary)}
              >
                <LinearGradient
                  colors={(!canChange || (selectedPrimary === commitments?.primary && selectedSecondary === commitments?.secondary)) 
                    ? ['#9CA3AF', '#6B7280'] 
                    : ['#10B981', '#059669']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    width: '90%',
    maxWidth: 600,
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
    paddingTop: scale(20),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(2),
  },
  closeButton: {
    padding: scale(8),
  },
  content: {
    flex: 1,
    padding: responsivePadding.horizontal,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: scale(16),
    gap: scale(8),
  },
  warningCardDark: {
    backgroundColor: '#78350F',
  },
  warningText: {
    fontSize: fontScale(14),
    color: '#92400E',
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#F3F4F6',
    padding: scale(16),
    borderRadius: scale(12),
    marginBottom: scale(20),
  },
  infoCardDark: {
    backgroundColor: '#374151',
  },
  infoTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: scale(8),
  },
  infoText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    lineHeight: fontScale(20),
  },
  areasContainer: {
    gap: scale(12),
    marginBottom: scale(16),
  },
  areaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(16),
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  areaCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  iconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  areaInfo: {
    flex: 1,
  },
  areaLabel: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: scale(2),
  },
  areaDescription: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  badge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(4),
  },
  badgeSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  levelSection: {
    marginBottom: scale(12),
  },
  levelLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  levelBar: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  bonusSection: {
    gap: scale(4),
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  bonusText: {
    fontSize: fontScale(12),
    color: '#10B981',
    fontWeight: '500',
  },
  penaltyText: {
    fontSize: fontScale(12),
    color: '#EF4444',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: scale(12),
    padding: responsivePadding.horizontal,
    paddingTop: scale(16),
    paddingBottom: scale(20),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: scale(14),
    borderRadius: scale(12),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#374151',
  },
  cancelButtonText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    paddingVertical: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textDark: {
    color: '#F9FAFB',
  },
  textDarkSecondary: {
    color: '#D1D5DB',
  },
});
