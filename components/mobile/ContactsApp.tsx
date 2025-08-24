import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Users, Heart, Phone, Gift, DollarSign, Home, Gem, X, Baby, Star } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';

interface ContactsAppProps {
  onBack: () => void;
}

export default function ContactsApp({ onBack }: ContactsAppProps) {
  const {
    gameState,
    updateRelationship,
    updateStats,
    breakUpWithPartner,
    proposeToPartner,
    moveInTogether,
    haveChild,
    recordRelationshipAction,
    askForMoney,
  } = useGame();
  
  const [actionFeedback, setActionFeedback] = useState<{ [key: string]: string }>({});
  const [moneyFeedback, setMoneyFeedback] = useState<{ [key: string]: string }>({});

  const getRelationshipColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#EF4444';
    return '#6B7280';
  };

  const performAction = (relationshipId: string, action: string, cost?: number, relationBonus?: number) => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) return;

    if (relationship.actions?.[action] === gameState.day) {
      setActionFeedback({ [relationshipId]: 'Action already used this week' });
      setTimeout(() => {
        setActionFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
      }, 3000);
      return;
    }

    if (cost && gameState.stats.money < cost) return;

    if (cost) {
      updateStats({ money: gameState.stats.money - cost });
    }

    if (relationBonus) {
      updateRelationship(relationshipId, relationBonus);
    }

    recordRelationshipAction(relationshipId, action);
  };

  const handleSpecialAction = (relationshipId: string, action: string) => {
    let result;
    switch (action) {
      case 'breakup':
        result = breakUpWithPartner(relationshipId);
        break;
      case 'propose':
        result = proposeToPartner(relationshipId);
        break;
      case 'movein':
        result = moveInTogether(relationshipId);
        break;
      case 'child':
        result = haveChild(relationshipId);
        break;
      default:
        return;
    }

    if (result) {
      setActionFeedback({ [relationshipId]: result.message });
      setTimeout(() => {
        setActionFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
      }, 3000);
    }
  };

  const handleAskMoney = (relationshipId: string) => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) return;

    if (relationship.relationshipScore < 35) {
      setMoneyFeedback({ [relationshipId]: 'Relationship too low. Need at least 35 points to ask for money.' });
      setTimeout(() => {
        setMoneyFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
      }, 3000);
      return;
    }

    const result = askForMoney(relationshipId);
    if (result) {
      setMoneyFeedback({ [relationshipId]: result.message });
      setTimeout(() => {
        setMoneyFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
      }, 3000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relationships</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.relationshipsContainer}>
          {gameState.relationships.map((relationship, index) => (
            <View key={relationship.id} style={styles.relationshipCard}>
              <View style={styles.relationshipHeader}>
                <View style={styles.relationshipInfo}>
                  <Text style={styles.relationshipName}>{relationship.name}</Text>
                  <Text style={styles.relationshipType}>
                    {relationship.type} • {relationship.personality}
                  </Text>
                  {relationship.income && relationship.type === 'partner' && (
                    <Text style={styles.relationshipIncome}>
                      Income: ${relationship.income}/day
                    </Text>
                  )}
                </View>
                <View style={styles.relationshipScore}>
                  <Text style={[
                    styles.scoreText,
                    { color: getRelationshipColor(relationship.relationshipScore) }
                  ]}>
                    {relationship.relationshipScore}
                  </Text>
                  <Text style={styles.scoreLabel}>Relation</Text>
                </View>
              </View>

              <View style={styles.scoreBar}>
                <View 
                  style={[
                    styles.scoreFill, 
                    { 
                      width: `${relationship.relationshipScore}%`,
                      backgroundColor: getRelationshipColor(relationship.relationshipScore)
                    }
                  ]} 
                />
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => performAction(relationship.id, 'call', 0, 5)}
                >
                  <Phone size={16} color="#3B82F6" />
                  <Text style={styles.actionText}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => performAction(relationship.id, 'hangout', 20, 10)}
                  disabled={gameState.stats.money < 20}
                >
                  <Users size={16} color="#10B981" />
                  <Text style={[styles.actionText, gameState.stats.money < 20 && styles.disabledText]}>
                    Hang Out ($20)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => performAction(relationship.id, 'gift', 50, 15)}
                  disabled={gameState.stats.money < 50}
                >
                  <Gift size={16} color="#EF4444" />
                  <Text style={[styles.actionText, gameState.stats.money < 50 && styles.disabledText]}>
                    Gift ($50)
                  </Text>
                </TouchableOpacity>

                <View style={styles.moneyButtonContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, relationship.relationshipScore < 35 && styles.disabledButton]}
                    onPress={() => handleAskMoney(relationship.id)}
                    disabled={relationship.relationshipScore < 35}
                  >
                    <DollarSign size={16} color={relationship.relationshipScore < 35 ? "#6B7280" : "#F59E0B"} />
                    <Text style={[styles.actionText, relationship.relationshipScore < 35 && styles.disabledText]}>
                      Ask Money {relationship.relationshipScore < 35 && `(${relationship.relationshipScore}/35)`}
                    </Text>
                  </TouchableOpacity>
                  {moneyFeedback[relationship.id] && (
                    <View style={styles.feedbackPopup}>
                      <Text style={styles.feedbackPopupText}>{moneyFeedback[relationship.id]}</Text>
                    </View>
                  )}
                </View>

                {relationship.type === 'partner' && (
                  <>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => performAction(relationship.id, 'romance', 30, 20)}
                      disabled={gameState.stats.money < 30}
                    >
                      <Heart size={16} color="#EF4444" />
                      <Text style={[styles.actionText, gameState.stats.money < 30 && styles.disabledText]}>Romance ($30)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSpecialAction(relationship.id, 'movein')}
                    >
                      <Home size={16} color="#8B5CF6" />
                      <Text style={styles.actionText}>Move In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSpecialAction(relationship.id, 'propose')}
                    >
                      <Gem size={16} color="#F59E0B" />
                      <Text style={styles.actionText}>Propose ($5,000)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSpecialAction(relationship.id, 'breakup')}
                    >
                      <X size={16} color="#EF4444" />
                      <Text style={styles.actionText}>Break Up</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {actionFeedback[relationship.id] && (
                <Text style={styles.actionFeedback}>{actionFeedback[relationship.id]}</Text>
              )}

              {relationship.type === 'spouse' && (
                <View style={styles.partnerActions}>
                  <Text style={styles.partnerLabel}>Spouse Actions</Text>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => performAction(relationship.id, 'romance', 50, 25)}
                      disabled={gameState.stats.money < 50}
                    >
                      <Heart size={16} color="#EF4444" />
                      <Text style={[styles.actionText, gameState.stats.money < 50 && styles.disabledText]}>
                        Romantic Evening ($50)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSpecialAction(relationship.id, 'child')}
                      disabled={gameState.stats.money < 10000}
                    >
                      <Baby size={16} color="#10B981" />
                      <Text
                        style={[styles.actionText, gameState.stats.money < 10000 && styles.disabledText]}
                      >
                        Have a Child ($10,000)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSpecialAction(relationship.id, 'breakup')}
                    >
                      <X size={16} color="#EF4444" />
                      <Text style={styles.actionText}>Divorce</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

                              {relationship.type === 'friend' && (
                  <View style={styles.partnerActions}>
                    <Text style={styles.partnerLabel}>Friend Actions</Text>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => performAction(relationship.id, 'hangout', 15, 15)}
                        disabled={gameState.stats.money < 15}
                      >
                        <Users size={16} color="#3B82F6" />
                        <Text style={[styles.actionText, gameState.stats.money < 15 && styles.disabledText]}>
                          Hang Out ($15)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => performAction(relationship.id, 'movie', 25, 20)}
                        disabled={gameState.stats.money < 25}
                      >
                        <Star size={16} color="#F59E0B" />
                        <Text style={[styles.actionText, gameState.stats.money < 25 && styles.disabledText]}>
                          Watch Movie ($25)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => performAction(relationship.id, 'dinner', 40, 25)}
                        disabled={gameState.stats.money < 40}
                      >
                        <Users size={16} color="#10B981" />
                        <Text style={[styles.actionText, gameState.stats.money < 40 && styles.disabledText]}>
                          Dinner Together ($40)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => performAction(relationship.id, 'party', 60, 30)}
                        disabled={gameState.stats.money < 60}
                      >
                        <Star size={16} color="#8B5CF6" />
                        <Text style={[styles.actionText, gameState.stats.money < 60 && styles.disabledText]}>
                          Throw Party ($60)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {relationship.type === 'child' && (
                <View style={styles.partnerActions}>
                  <Text style={styles.partnerLabel}>Child - Age {relationship.age || 0}</Text>
                  <TouchableOpacity
                    style={[styles.specialActionButton, { backgroundColor: '#8B5CF6' }]}
                    onPress={() => performAction(relationship.id, 'play', 20, 10)}
                    disabled={gameState.stats.money < 20}
                  >
                    <Text style={styles.specialActionText}>Play Together ($20)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {gameState.relationships.length === 0 && (
            <View style={styles.emptyState}>
              <Users size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No Relationships Yet</Text>
              <Text style={styles.emptyMessage}>
                Use the Hinder app to find matches or meet people through social media!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#11131A',
    borderBottomColor: '#1F2230',
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1D29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  relationshipsContainer: {
    gap: 16,
    paddingBottom: 20,
    paddingTop: 16,
  },
  relationshipCard: {
    backgroundColor: '#0F1220',
    borderRadius: 14,
    padding: 16,
    borderColor: '#23283B',
    borderWidth: 1,
  },
  relationshipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  relationshipInfo: {
    flex: 1,
  },
  relationshipName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  relationshipType: {
    fontSize: 14,
    color: '#9FA4B3',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  relationshipIncome: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  relationshipScore: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#9FA4B3',
  },
  scoreBar: {
    height: 4,
    backgroundColor: '#1A1D29',
    borderRadius: 2,
    marginBottom: 15,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D29',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#23283B',
  },
  actionText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  disabledText: {
    color: '#6B7280',
  },
  disabledButton: {
    backgroundColor: '#1A1D29',
    borderColor: '#6B7280',
  },
  partnerActions: {
    borderTopWidth: 1,
    borderTopColor: '#23283B',
    paddingTop: 15,
    alignItems: 'center',
  },
  partnerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  specialActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 8,
    minWidth: 200,
    justifyContent: 'center',
    borderRadius: 8,
  },
  actionFeedback: {
    fontSize: 12,
    color: '#10B981',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  specialActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    textAlign: 'center',
  },
  moneyButtonContainer: {
    position: 'relative',
  },
  feedbackPopup: {
    position: 'absolute',
    right: 0,
    bottom: '100%',
    marginBottom: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    zIndex: 1,
  },
  feedbackPopupText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#9FA4B3',
    textAlign: 'center',
    lineHeight: 20,
  },
});