/**
 * Family Tab Component
 * 
 * Comprehensive family management with spouse, children, and family activities
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Heart,
  Baby,
  Ring,
  Home,
  GraduationCap,
  DollarSign,
  Gift,
  Calendar,
  Star,
  Crown,
  Sparkles,
  X,
  ChevronRight,
  Activity,
  TrendingUp,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale, responsivePadding } from '@/utils/scaling';
import { getCharacterImage, getRelationshipImage } from '@/utils/characterImages';

interface FamilyTabProps {
  onClose?: () => void;
}

export default function FamilyTab({ onClose }: FamilyTabProps) {
  const { 
    gameState, 
    proposeToPartner, 
    haveChild, 
    moveInTogether,
    saveGame 
  } = useGame();
  
  const { settings } = gameState;
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [showChildModal, setShowChildModal] = useState(false);
  
  const partner = gameState.relationships?.find(r => r.type === 'partner');
  const spouse = gameState.family?.spouse;
  const children = gameState.family?.children || [];
  const lifeStage = gameState.lifeStage;

  // Calculate family happiness
  const familyHappiness = useMemo(() => {
    let happiness = 0;
    if (spouse) {
      happiness += Math.floor(spouse.relationshipScore / 10);
    }
    children.forEach(child => {
      happiness += Math.floor((child.familyHappiness || 50) / 20);
    });
    return happiness;
  }, [spouse, children]);

  // Calculate total family income
  const familyIncome = useMemo(() => {
    let income = 0;
    if (spouse?.income) {
      income += spouse.income * 7; // Weekly income
    }
    children.forEach(child => {
      if (child.savings && child.age >= 18) {
        income += Math.floor(child.savings * 0.01); // Small contribution
      }
    });
    return income;
  }, [spouse, children]);

  const handlePropose = useCallback(() => {
    if (!partner) return;
    
    if (partner.relationshipScore < 80) {
      Alert.alert(
        'Not Ready',
        `Your relationship with ${partner.name} needs to be stronger before proposing. Current: ${partner.relationshipScore}/100`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Propose Marriage',
      `Are you ready to ask ${partner.name} to marry you? This is a big step!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Propose',
          onPress: () => {
            const result = proposeToPartner(partner.id);
            if (result?.success) {
              saveGame();
              Alert.alert('Congratulations! 💍', result.message);
            } else {
              Alert.alert('Response', result?.message || 'They need more time to think...');
            }
          },
        },
      ]
    );
  }, [partner, proposeToPartner, saveGame]);

  const handleMoveIn = useCallback(() => {
    if (!partner) return;

    if (partner.relationshipScore < 60) {
      Alert.alert(
        'Not Ready',
        `You should strengthen your relationship before moving in together. Current: ${partner.relationshipScore}/100`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Move In Together',
      `Would you like to move in with ${partner.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move In',
          onPress: () => {
            const result = moveInTogether(partner.id);
            if (result?.success) {
              saveGame();
              Alert.alert('New Home! 🏠', result.message);
            } else {
              Alert.alert('Cannot Move In', result?.message || 'Something went wrong.');
            }
          },
        },
      ]
    );
  }, [partner, moveInTogether, saveGame]);

  const handleHaveChild = useCallback(() => {
    if (!spouse) {
      Alert.alert('Marriage Required', 'You need to be married before having children.');
      return;
    }

    if (gameState.date.age < 18) {
      Alert.alert('Too Young', 'You must be at least 18 years old to have children.');
      return;
    }

    Alert.alert(
      'Have a Child',
      `Are you and ${spouse.name} ready to start or expand your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Try for Baby',
          onPress: () => {
            const result = haveChild(spouse.id);
            if (result?.success) {
              saveGame();
              Alert.alert('Wonderful News! 👶', result.message);
            } else {
              Alert.alert('Not This Time', result?.message || 'Maybe next time...');
            }
          },
        },
      ]
    );
  }, [spouse, gameState.date.age, haveChild, saveGame]);

  const getLifeStageColor = (stage: string) => {
    switch (stage) {
      case 'child': return ['#60A5FA', '#3B82F6'];
      case 'teen': return ['#A78BFA', '#8B5CF6'];
      case 'adult': return ['#34D399', '#10B981'];
      case 'senior': return ['#FBBF24', '#F59E0B'];
      default: return ['#6B7280', '#4B5563'];
    }
  };

  const getRelationshipStatusColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#EF4444';
    return '#6B7280';
  };

  const renderSpouseCard = () => {
    if (!spouse) return null;

    return (
      <View style={[styles.card, settings.darkMode && styles.cardDark]}>
        <LinearGradient
          colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#FDF2F8', '#FCE7F3']}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              <Image
                source={getRelationshipImage(spouse.age || 25, spouse.gender || 'female', 'spouse')}
                style={styles.avatar}
              />
              <View style={styles.statusBadge}>
                <Ring size={12} color="#FFD700" />
              </View>
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.cardName, settings.darkMode && styles.textDark]}>
                  {spouse.name}
                </Text>
                <Heart size={16} color="#EF4444" fill="#EF4444" />
              </View>
              <Text style={[styles.cardSubtitle, settings.darkMode && styles.textMuted]}>
                Your Spouse • {spouse.personality}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Heart size={14} color={getRelationshipStatusColor(spouse.relationshipScore)} />
                  <Text style={[styles.statText, { color: getRelationshipStatusColor(spouse.relationshipScore) }]}>
                    {spouse.relationshipScore}%
                  </Text>
                </View>
                {spouse.income && (
                  <View style={styles.statItem}>
                    <DollarSign size={14} color="#10B981" />
                    <Text style={styles.incomeText}>${spouse.income}/week</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleHaveChild}
          >
            <LinearGradient
              colors={['#EC4899', '#DB2777']}
              style={styles.actionButtonGradient}
            >
              <Baby size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>Try for Baby</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  const renderPartnerCard = () => {
    if (!partner || spouse) return null;

    const canPropose = partner.relationshipScore >= 80;
    const canMoveIn = partner.relationshipScore >= 60 && !partner.livingTogether;

    return (
      <View style={[styles.card, settings.darkMode && styles.cardDark]}>
        <LinearGradient
          colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#FEF3C7', '#FDE68A']}
          style={styles.cardGradient}
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              <Image
                source={getRelationshipImage(partner.age || 25, partner.gender || 'female', 'partner')}
                style={styles.avatar}
              />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.cardName, settings.darkMode && styles.textDark]}>
                  {partner.name}
                </Text>
                <Heart size={16} color="#F59E0B" />
              </View>
              <Text style={[styles.cardSubtitle, settings.darkMode && styles.textMuted]}>
                Your Partner • {partner.personality}
                {partner.livingTogether && ' • Living Together'}
              </Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${partner.relationshipScore}%`,
                        backgroundColor: getRelationshipStatusColor(partner.relationshipScore),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, settings.darkMode && styles.textMuted]}>
                  {partner.relationshipScore}% • {partner.relationshipScore >= 80 ? 'Ready for proposal!' : 'Building relationship...'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            {canMoveIn && (
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1, marginRight: scale(8) }]}
                onPress={handleMoveIn}
              >
                <Home size={16} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                <Text style={[styles.secondaryButtonText, settings.darkMode && { color: '#60A5FA' }]}>
                  Move In
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1, opacity: canPropose ? 1 : 0.5 }]}
              onPress={handlePropose}
              disabled={!canPropose}
            >
              <LinearGradient
                colors={canPropose ? ['#8B5CF6', '#7C3AED'] : ['#6B7280', '#4B5563']}
                style={styles.actionButtonGradient}
              >
                <Ring size={18} color="#FFF" />
                <Text style={styles.actionButtonText}>Propose</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderChildCard = (child: any) => {
    const childAge = Math.floor(child.age);
    const isAdult = childAge >= 18;

    return (
      <TouchableOpacity
        key={child.id}
        style={[styles.childCard, settings.darkMode && styles.childCardDark]}
        onPress={() => {
          setSelectedChild(child.id);
          setShowChildModal(true);
        }}
      >
        <View style={styles.childAvatarContainer}>
          <Image
            source={getCharacterImage(childAge, child.gender || 'male')}
            style={styles.childAvatar}
          />
          {isAdult && (
            <View style={styles.adultBadge}>
              <Star size={10} color="#FFD700" fill="#FFD700" />
            </View>
          )}
        </View>
        <View style={styles.childInfo}>
          <Text style={[styles.childName, settings.darkMode && styles.textDark]}>
            {child.name}
          </Text>
          <Text style={[styles.childAge, settings.darkMode && styles.textMuted]}>
            Age {childAge} • {isAdult ? 'Adult' : childAge >= 13 ? 'Teen' : 'Child'}
          </Text>
          {child.educationLevel && (
            <View style={styles.childBadge}>
              <GraduationCap size={10} color="#3B82F6" />
              <Text style={styles.childBadgeText}>{child.educationLevel}</Text>
            </View>
          )}
        </View>
        <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
      </TouchableOpacity>
    );
  };

  const renderChildModal = () => {
    const child = children.find(c => c.id === selectedChild);
    if (!child) return null;

    const childAge = Math.floor(child.age);

    return (
      <Modal
        visible={showChildModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChildModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, settings.darkMode && styles.textDark]}>
                {child.name}
              </Text>
              <TouchableOpacity onPress={() => setShowChildModal(false)}>
                <X size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.childProfileHeader}>
                <Image
                  source={getCharacterImage(childAge, child.gender || 'male')}
                  style={styles.childProfileAvatar}
                />
                <View style={styles.childProfileInfo}>
                  <Text style={[styles.childProfileName, settings.darkMode && styles.textDark]}>
                    {child.name}
                  </Text>
                  <Text style={[styles.childProfileAge, settings.darkMode && styles.textMuted]}>
                    Age {childAge} • {child.gender === 'male' ? 'Son' : 'Daughter'}
                  </Text>
                </View>
              </View>

              <View style={styles.childStatsGrid}>
                <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
                  <Heart size={20} color="#EF4444" />
                  <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
                    {child.familyHappiness || 50}%
                  </Text>
                  <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
                    Happiness
                  </Text>
                </View>
                <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
                  <GraduationCap size={20} color="#3B82F6" />
                  <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
                    {child.educationLevel || 'None'}
                  </Text>
                  <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
                    Education
                  </Text>
                </View>
                {childAge >= 18 && (
                  <>
                    <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
                      <DollarSign size={20} color="#10B981" />
                      <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
                        ${(child.savings || 0).toLocaleString()}
                      </Text>
                      <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
                        Savings
                      </Text>
                    </View>
                    <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
                      <TrendingUp size={20} color="#8B5CF6" />
                      <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
                        {child.careerPath || 'Seeking'}
                      </Text>
                      <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
                        Career
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {child.geneticTraits && child.geneticTraits.length > 0 && (
                <View style={[styles.traitsSection, settings.darkMode && styles.traitsSectionDark]}>
                  <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
                    Genetic Traits
                  </Text>
                  <View style={styles.traitsContainer}>
                    {child.geneticTraits.map((trait: string, index: number) => (
                      <View key={index} style={styles.traitBadge}>
                        <Sparkles size={12} color="#F59E0B" />
                        <Text style={styles.traitText}>{trait}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {child.isHeirEligible && (
                <View style={styles.heirBanner}>
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.heirBannerGradient}
                  >
                    <Crown size={24} color="#FFF" />
                    <Text style={styles.heirBannerText}>Eligible Heir</Text>
                  </LinearGradient>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, settings.darkMode && styles.containerDark]}>
      <LinearGradient
        colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F8FAFC']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Users size={28} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.headerTitle, settings.darkMode && styles.textDark]}>
              Family
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Life Stage Badge */}
        <View style={styles.lifeStageBadge}>
          <LinearGradient
            colors={getLifeStageColor(lifeStage)}
            style={styles.lifeStageBadgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Activity size={16} color="#FFF" />
            <Text style={styles.lifeStageText}>
              {lifeStage.charAt(0).toUpperCase() + lifeStage.slice(1)} • Age {gameState.date.age}
            </Text>
          </LinearGradient>
        </View>

        {/* Family Stats Summary */}
        <View style={[styles.statsCard, settings.darkMode && styles.statsCardDark]}>
          <View style={styles.statsItem}>
            <Heart size={20} color="#EF4444" />
            <Text style={[styles.statsValue, settings.darkMode && styles.textDark]}>
              +{familyHappiness}
            </Text>
            <Text style={[styles.statsLabel, settings.darkMode && styles.textMuted]}>
              Family Happiness
            </Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsItem}>
            <Users size={20} color="#3B82F6" />
            <Text style={[styles.statsValue, settings.darkMode && styles.textDark]}>
              {children.length}
            </Text>
            <Text style={[styles.statsLabel, settings.darkMode && styles.textMuted]}>
              Children
            </Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsItem}>
            <DollarSign size={20} color="#10B981" />
            <Text style={[styles.statsValue, settings.darkMode && styles.textDark]}>
              ${familyIncome}
            </Text>
            <Text style={[styles.statsLabel, settings.darkMode && styles.textMuted]}>
              Family Income/wk
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {/* Spouse Section */}
          {spouse && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
                Spouse
              </Text>
              {renderSpouseCard()}
            </View>
          )}

          {/* Partner Section */}
          {partner && !spouse && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
                Partner
              </Text>
              {renderPartnerCard()}
            </View>
          )}

          {/* No Relationship State */}
          {!partner && !spouse && (
            <View style={[styles.emptyState, settings.darkMode && styles.emptyStateDark]}>
              <Heart size={48} color={settings.darkMode ? '#4B5563' : '#D1D5DB'} />
              <Text style={[styles.emptyStateTitle, settings.darkMode && styles.textDark]}>
                No Partner Yet
              </Text>
              <Text style={[styles.emptyStateText, settings.darkMode && styles.textMuted]}>
                Use the Dating app to find someone special!
              </Text>
            </View>
          )}

          {/* Children Section */}
          {children.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
                Children ({children.length})
              </Text>
              {children.map(renderChildCard)}
            </View>
          )}

          {/* Empty Children State */}
          {spouse && children.length === 0 && (
            <View style={[styles.emptyChildrenState, settings.darkMode && styles.emptyChildrenStateDark]}>
              <Baby size={32} color={settings.darkMode ? '#4B5563' : '#D1D5DB'} />
              <Text style={[styles.emptyChildrenText, settings.darkMode && styles.textMuted]}>
                No children yet. Start your family!
              </Text>
            </View>
          )}
        </ScrollView>

        {renderChildModal()}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingTop: scale(16),
    paddingBottom: scale(12),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    marginLeft: scale(12),
    color: '#111827',
  },
  closeButton: {
    padding: scale(8),
  },
  lifeStageBadge: {
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  lifeStageBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
  },
  lifeStageText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '600',
    marginLeft: scale(8),
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: scale(16),
    marginBottom: scale(16),
    backgroundColor: '#FFF',
    borderRadius: scale(12),
    padding: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsCardDark: {
    backgroundColor: '#1F2937',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: scale(8),
  },
  statsValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#111827',
    marginTop: scale(4),
  },
  statsLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(16),
  },
  section: {
    marginBottom: scale(20),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginBottom: scale(12),
  },
  card: {
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDark: {
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardGradient: {
    padding: scale(16),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    borderWidth: 3,
    borderColor: '#FFF',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: scale(10),
    padding: scale(4),
  },
  cardInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#111827',
    marginRight: scale(8),
  },
  cardSubtitle: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: scale(2),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(8),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(16),
  },
  statText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    marginLeft: scale(4),
  },
  incomeText: {
    fontSize: fontScale(13),
    color: '#10B981',
    fontWeight: '600',
    marginLeft: scale(4),
  },
  progressContainer: {
    marginTop: scale(8),
  },
  progressBar: {
    height: scale(6),
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(3),
  },
  progressText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionButton: {
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(20),
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '600',
    marginLeft: scale(8),
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: fontScale(14),
    fontWeight: '600',
    marginLeft: scale(6),
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  childCardDark: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  childAvatarContainer: {
    position: 'relative',
  },
  childAvatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
  },
  adultBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: scale(8),
    padding: scale(2),
  },
  childInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  childName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  childAge: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginTop: scale(2),
  },
  childBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    marginTop: scale(4),
    alignSelf: 'flex-start',
  },
  childBadgeText: {
    fontSize: fontScale(10),
    color: '#3B82F6',
    marginLeft: scale(4),
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(40),
    backgroundColor: '#F9FAFB',
    borderRadius: scale(16),
    marginVertical: scale(20),
  },
  emptyStateDark: {
    backgroundColor: '#1F2937',
  },
  emptyStateTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(16),
  },
  emptyStateText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(8),
    textAlign: 'center',
  },
  emptyChildrenState: {
    alignItems: 'center',
    padding: scale(24),
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
  },
  emptyChildrenStateDark: {
    backgroundColor: '#1F2937',
  },
  emptyChildrenText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(8),
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalContent: {
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '80%',
    backgroundColor: '#FFF',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
  },
  modalScroll: {
    padding: scale(16),
  },
  childProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  childProfileAvatar: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  childProfileInfo: {
    marginLeft: scale(16),
  },
  childProfileName: {
    fontSize: fontScale(22),
    fontWeight: 'bold',
    color: '#111827',
  },
  childProfileAge: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(4),
  },
  childStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: scale(-4),
  },
  childStatCard: {
    width: '48%',
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    padding: scale(12),
    alignItems: 'center',
    margin: scale(4),
  },
  childStatCardDark: {
    backgroundColor: '#374151',
  },
  childStatValue: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: '#111827',
    marginTop: scale(6),
    textAlign: 'center',
  },
  childStatLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(2),
    textAlign: 'center',
  },
  traitsSection: {
    marginTop: scale(16),
    padding: scale(12),
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
  },
  traitsSectionDark: {
    backgroundColor: '#374151',
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: scale(8),
  },
  traitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    marginRight: scale(8),
    marginBottom: scale(4),
  },
  traitText: {
    fontSize: fontScale(12),
    color: '#92400E',
    marginLeft: scale(4),
    fontWeight: '500',
  },
  heirBanner: {
    marginTop: scale(16),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  heirBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(14),
  },
  heirBannerText: {
    color: '#FFF',
    fontSize: fontScale(16),
    fontWeight: 'bold',
    marginLeft: scale(8),
  },
  textDark: {
    color: '#F9FAFB',
  },
  textMuted: {
    color: '#9CA3AF',
  },
});
