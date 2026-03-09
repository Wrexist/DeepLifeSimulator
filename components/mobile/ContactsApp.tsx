import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { ArrowLeft, Users, Heart, Phone, Gift, DollarSign, Home, Gem, X, Baby, Star, ChevronDown, Coffee, Calendar, MessageCircle, Target } from 'lucide-react-native';
import { goOnDate, giveGift, calculateDivorceCosts } from '@/contexts/game/actions/DatingActions';
import { useGame } from '@/contexts/GameContext';
import { getRelationshipImage } from '@/utils/characterImages';
import WeddingPlanningModal from '@/components/mobile/WeddingPlanningModal';
import DivorceConfirmModal from '@/components/mobile/DivorceConfirmModal';
import EmptyState from '@/components/ui/EmptyState';

interface ContactsAppProps {
  onBack: () => void;
}

export default function ContactsApp({ onBack }: ContactsAppProps) {
  const {
    gameState,
    updateRelationship,
    setGameState,
    updateMoney,
    updateStats,
    breakUpWithPartner,
    proposeToPartner,
    moveInTogether,
    fileDivorce,
    haveChild,
    recordRelationshipAction,
    saveGame,
  } = useGame();
  
  const { settings } = gameState;
  
  // DEBUG: Log relationships when component renders
  React.useEffect(() => {
    const relationships = gameState.relationships || [];
    const children = relationships.filter(r => r.type === 'child');
    const logger = require('@/utils/logger').logger;
    logger.info('[CONTACTS_APP] Relationships loaded', {
      totalRelationships: relationships.length,
      childrenCount: children.length,
      childIds: children.map(c => c.id),
      childNames: children.map(c => c.name),
      allRelationshipTypes: relationships.map(r => r.type),
    });
  }, [gameState.relationships]);
  const [actionFeedback, setActionFeedback] = useState<{ [key: string]: string }>({});
  const [moneyFeedback, setMoneyFeedback] = useState<{ [key: string]: string }>({});
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [showWeddingModal, setShowWeddingModal] = useState<string | null>(null);
  const [showDivorceConfirm, setShowDivorceConfirm] = useState<string | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Wrapper functions to match DatingActions expected signatures
  const updateMoneyWrapper = useCallback((_setGameState: any, amount: number, reason: string) => {
    updateMoney(amount, reason);
  }, [updateMoney]);

  const updateStatsWrapper = useCallback((setGameState: any, stats: any) => {
    updateStats(stats);
  }, [updateStats]);

  // Cleanup timers when component unmounts
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      timersRef.current.clear();
    };
  }, []);

  const getRelationshipColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#EF4444';
    return '#6B7280';
  };

  const performAction = (relationshipId: string, action: string, cost?: number, relationBonus?: number) => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) return;

    if (relationship.actions?.[action] === gameState.weeksLived) {
      setActionFeedback({ [relationshipId]: 'Action already used this week' });
      const timer = setTimeout(() => {
        setActionFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
        timersRef.current.delete(timer);
      }, 3000);
      timersRef.current.add(timer);
      return;
    }

    if (cost && gameState.stats.money < cost) return;

    if (cost) {
      updateMoney(-cost, `${action} with ${relationship.name}`, false);
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
      case 'divorce':
        // Show confirmation modal instead of directly divorcing
        setShowDivorceConfirm(relationshipId);
        return;
      case 'propose':
        result = proposeToPartner(relationshipId);
        break;
      case 'movein':
        result = moveInTogether(relationshipId);
        break;
      case 'child':
        result = haveChild(relationshipId);
        break;
      case 'play':
        // Play with child - costs money but increases relationship
        if (gameState.stats.money >= 20) {
          updateMoney(-20, `Playing with child: ${gameState.relationships?.find(r => r.id === relationshipId)?.name}`);
          updateRelationship(relationshipId, 10);
          result = { success: true, message: 'You played with your child! They loved it! 🎈' };
        } else {
          result = { success: false, message: 'You need $20 to play with your child.' };
        }
        break;
      default:
        return;
    }

    if (result) {
      setActionFeedback({ [relationshipId]: result.message });
      const timer = setTimeout(() => {
        setActionFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
        timersRef.current.delete(timer);
      }, 3000);
      timersRef.current.add(timer);
    }
  };

  const handleAskMoney = (relationshipId: string) => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) return;

    if (relationship.relationshipScore < 35) {
      setMoneyFeedback({ [relationshipId]: 'Relationship too low. Need at least 35 points to ask for money.' });
      const timer = setTimeout(() => {
        setMoneyFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[relationshipId];
          return newFeedback;
        });
        timersRef.current.delete(timer);
      }, 3000);
      timersRef.current.add(timer);
      return;
    }

    // Calculate money amount based on relationship closeness
    const baseAmount = Math.floor(50 + (relationship.relationshipScore - 35) * 3);
    const amount = Math.max(20, Math.min(baseAmount, 500));
    // 60% success chance, higher with better relationship
    const successChance = 0.4 + (relationship.relationshipScore / 200);

    if (Math.random() < successChance) {
      updateMoney(amount, `Gift from ${relationship.name}`);
      updateRelationship(relationshipId, -5); // Costs some relationship points
      setMoneyFeedback({ [relationshipId]: `${relationship.name} gave you $${amount}!` });
    } else {
      updateRelationship(relationshipId, -8); // Rejected = bigger hit
      setMoneyFeedback({ [relationshipId]: `${relationship.name} said no.` });
    }

    const timer = setTimeout(() => {
      setMoneyFeedback(prev => {
        const newFeedback = { ...prev };
        delete newFeedback[relationshipId];
        return newFeedback;
      });
      timersRef.current.delete(timer);
    }, 3000);
    timersRef.current.add(timer);
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
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.relationshipsContainer}>
          {(gameState.relationships || []).map((relationship, index) => (
            <View key={relationship.id} style={styles.relationshipCard}>
              <View style={styles.relationshipHeader}>
                <View style={styles.relationshipImageContainer}>
                  <Image 
                    source={getRelationshipImage(relationship.age || 25, relationship.gender || 'male', relationship.type)} 
                    style={styles.relationshipImage} 
                  />
                </View>
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

              {/* NPC Depth — Mood, Opinion, Goals, Life Events */}
              {relationship.npcOpinion && (
                <View style={styles.npcDepthSection}>
                  {/* Mood & Life Event Row */}
                  <View style={styles.npcMoodRow}>
                    {relationship.npcMood && (
                      <View style={[styles.moodBadge, styles[`mood_${relationship.npcMood}` as keyof typeof styles] as any || {}]}>
                        <Text style={styles.moodEmoji}>
                          {relationship.npcMood === 'happy' ? '😊' : relationship.npcMood === 'stressed' ? '😰' : relationship.npcMood === 'sad' ? '😢' : relationship.npcMood === 'angry' ? '😠' : '😐'}
                        </Text>
                        <Text style={styles.moodLabel}>{(relationship.npcMood || 'neutral').charAt(0).toUpperCase() + (relationship.npcMood || 'neutral').slice(1)}</Text>
                      </View>
                    )}
                    {relationship.lastLifeEvent && (
                      <Text style={styles.lifeEventText} numberOfLines={1}>
                        {relationship.lastLifeEvent.event}
                      </Text>
                    )}
                  </View>

                  {/* Opinion Bars (Trust / Attraction / Respect) */}
                  <View style={styles.opinionBars}>
                    <View style={styles.opinionBar}>
                      <Text style={styles.opinionLabel}>Trust</Text>
                      <View style={styles.opinionTrack}>
                        <View style={[styles.opinionFill, { width: `${relationship.npcOpinion.trust}%`, backgroundColor: '#3B82F6' }]} />
                      </View>
                      <Text style={styles.opinionValue}>{Math.round(relationship.npcOpinion.trust)}</Text>
                    </View>
                    {relationship.type !== 'child' && relationship.type !== 'parent' && (
                      <View style={styles.opinionBar}>
                        <Text style={styles.opinionLabel}>Attract</Text>
                        <View style={styles.opinionTrack}>
                          <View style={[styles.opinionFill, { width: `${relationship.npcOpinion.attraction}%`, backgroundColor: '#EC4899' }]} />
                        </View>
                        <Text style={styles.opinionValue}>{Math.round(relationship.npcOpinion.attraction)}</Text>
                      </View>
                    )}
                    <View style={styles.opinionBar}>
                      <Text style={styles.opinionLabel}>Respect</Text>
                      <View style={styles.opinionTrack}>
                        <View style={[styles.opinionFill, { width: `${relationship.npcOpinion.respect}%`, backgroundColor: '#F59E0B' }]} />
                      </View>
                      <Text style={styles.opinionValue}>{Math.round(relationship.npcOpinion.respect)}</Text>
                    </View>
                  </View>

                  {/* NPC Goals */}
                  {relationship.npcGoals && relationship.npcGoals.length > 0 && (
                    <View style={styles.npcGoals}>
                      <View style={styles.npcGoalsHeader}>
                        <Target size={12} color="#9FA4B3" />
                        <Text style={styles.npcGoalsTitle}>Goals</Text>
                      </View>
                      <View style={styles.npcGoalChips}>
                        {relationship.npcGoals.map(goal => (
                          <View key={goal.id} style={[styles.npcGoalChip, goal.fulfilled && styles.npcGoalFulfilled]}>
                            <Text style={[styles.npcGoalText, goal.fulfilled && styles.npcGoalTextFulfilled]}>
                              {goal.fulfilled ? '✓ ' : ''}{goal.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Recent Memory */}
                  {relationship.npcMemories && relationship.npcMemories.length > 0 && (
                    <View style={styles.npcMemoryRow}>
                      <MessageCircle size={12} color="#6B7280" />
                      <Text style={styles.npcMemoryText} numberOfLines={1}>
                        {relationship.npcMemories[relationship.npcMemories.length - 1].description}
                      </Text>
                    </View>
                  )}
                </View>
              )}

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

                {relationship.type !== 'child' ? (
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
                ) : (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => performAction(relationship.id, 'allowance', 20, 12)}
                    disabled={gameState.stats.money < 20}
                  >
                    <DollarSign size={16} color={gameState.stats.money < 20 ? '#6B7280' : '#F59E0B'} />
                    <Text style={[styles.actionText, gameState.stats.money < 20 && styles.disabledText]}>Allowance ($20)</Text>
                  </TouchableOpacity>
                )}

                {relationship.type === 'partner' && (
                  <>
                    {/* Expand/Collapse Partner Actions Button */}
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => setExpandedPartner(expandedPartner === relationship.id ? null : relationship.id)}
                    >
                      <View style={{ transform: [{ rotate: expandedPartner === relationship.id ? '180deg' : '0deg' }] }}>
                      <ChevronDown size={16} color="#EC4899" />
                    </View>
                      <Text style={styles.expandText}>
                        {expandedPartner === relationship.id ? 'Hide Actions' : 'Partner Actions'}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* Collapsible Partner Actions */}
                    {expandedPartner === relationship.id && (
                      <View style={styles.expandedActions}>
                        {/* Dating Section */}
                        <Text style={styles.actionSectionTitle}>❤️ Dating</Text>
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.datingButton]}
                            onPress={() => {
                              const result = goOnDate(gameState, setGameState, relationship.id, 'coffee', { updateMoney: updateMoneyWrapper, updateStats: updateStatsWrapper });
                              if (result.success) {
                                saveGame();
                                Alert.alert('Coffee Date!', result.message);
                              } else {
                                Alert.alert('Cannot Go Out', result.message);
                              }
                            }}
                            disabled={gameState.stats.money < 30}
                          >
                            <Coffee size={16} color="#EC4899" />
                            <Text style={[styles.actionText, gameState.stats.money < 30 && styles.disabledText]}>Coffee ($30)</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.datingButton]}
                            onPress={() => {
                              const result = goOnDate(gameState, setGameState, relationship.id, 'dinner', { updateMoney: updateMoneyWrapper, updateStats: updateStatsWrapper });
                              if (result.success) {
                                saveGame();
                                Alert.alert('Dinner Date!', result.message);
                              } else {
                                Alert.alert('Cannot Go Out', result.message);
                              }
                            }}
                            disabled={gameState.stats.money < 150}
                          >
                            <Heart size={16} color="#EC4899" />
                            <Text style={[styles.actionText, gameState.stats.money < 150 && styles.disabledText]}>Dinner ($150)</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.datingButton]}
                            onPress={() => {
                              const result = goOnDate(gameState, setGameState, relationship.id, 'luxury', { updateMoney: updateMoneyWrapper, updateStats: updateStatsWrapper });
                              if (result.success) {
                                saveGame();
                                Alert.alert('Luxury Date!', result.message);
                              } else {
                                Alert.alert('Cannot Go Out', result.message);
                              }
                            }}
                            disabled={gameState.stats.money < 500}
                          >
                            <Star size={16} color="#EC4899" />
                            <Text style={[styles.actionText, gameState.stats.money < 500 && styles.disabledText]}>Luxury ($500)</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Gifts Section */}
                        <Text style={styles.actionSectionTitle}>🎁 Gifts</Text>
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.giftButton]}
                            onPress={() => {
                              const result = giveGift(gameState, setGameState, relationship.id, 'flowers', { updateMoney: updateMoneyWrapper, updateStats: updateStatsWrapper });
                              if (result.success) {
                                saveGame();
                                Alert.alert('Gift Given!', result.message);
                              } else {
                                Alert.alert('Cannot Give Gift', result.message);
                              }
                            }}
                            disabled={gameState.stats.money < 50}
                          >
                            <Gift size={16} color="#8B5CF6" />
                            <Text style={[styles.actionText, gameState.stats.money < 50 && styles.disabledText]}>Flowers ($50)</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.giftButton]}
                            onPress={() => {
                              const result = giveGift(gameState, setGameState, relationship.id, 'jewelry', { updateMoney: updateMoneyWrapper, updateStats: updateStatsWrapper });
                              if (result.success) {
                                saveGame();
                                Alert.alert('Gift Given!', result.message);
                              } else {
                                Alert.alert('Cannot Give Gift', result.message);
                              }
                            }}
                            disabled={gameState.stats.money < 500}
                          >
                            <Gem size={16} color="#8B5CF6" />
                            <Text style={[styles.actionText, gameState.stats.money < 500 && styles.disabledText]}>Jewelry ($500)</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.giftButton]}
                            onPress={() => {
                              const result = giveGift(gameState, setGameState, relationship.id, 'luxury', { updateMoney: updateMoneyWrapper, updateStats: updateStatsWrapper });
                              if (result.success) {
                                saveGame();
                                Alert.alert('Gift Given!', result.message);
                              } else {
                                Alert.alert('Cannot Give Gift', result.message);
                              }
                            }}
                            disabled={gameState.stats.money < 2000}
                          >
                            <Star size={16} color="#8B5CF6" />
                            <Text style={[styles.actionText, gameState.stats.money < 2000 && styles.disabledText]}>Luxury ($2K)</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Relationship Section */}
                        <Text style={styles.actionSectionTitle}>💕 Relationship</Text>
                        <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSpecialAction(relationship.id, 'movein')}
                    >
                            <Home size={16} color="#10B981" />
                      <Text style={styles.actionText}>Move In</Text>
                    </TouchableOpacity>
                          
                    {/* Only show propose button if not engaged */}
                    {!relationship.engagementWeek && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleSpecialAction(relationship.id, 'propose')}
                        disabled={gameState.stats.money < 5000}
                      >
                        <Gem size={16} color="#F59E0B" />
                        <Text style={[styles.actionText, gameState.stats.money < 5000 && styles.disabledText]}>Propose ($5K)</Text>
                      </TouchableOpacity>
                    )}
                          
                    {/* Show Plan Wedding button if engaged but wedding not planned */}
                    {relationship.engagementWeek && !relationship.weddingPlanned && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setShowWeddingModal(relationship.id)}
                      >
                        <Calendar size={16} color="#22C55E" />
                        <Text style={styles.actionText}>Plan Wedding</Text>
                      </TouchableOpacity>
                    )}
                          
                    {/* Show wedding countdown if wedding is planned */}
                    {relationship.weddingPlanned && (
                      <View style={[styles.actionButton, { opacity: 0.8, backgroundColor: '#3B82F6' }]}>
                        <Calendar size={16} color="#FFFFFF" />
                        <Text style={[styles.actionText, { color: '#FFFFFF' }]}>
                          Wedding in {Math.max(0, (relationship.weddingPlanned.scheduledWeek || 0) - (gameState.weeksLived || 0))} weeks
                        </Text>
                      </View>
                    )}
                          
                    <TouchableOpacity
                      style={styles.actionButton}
                            onPress={() => handleSpecialAction(relationship.id, 'child')}
                          >
                            <Baby size={16} color="#3B82F6" />
                            <Text style={styles.actionText}>Have Child</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.dangerButton]}
                            onPress={() => {
                              Alert.alert(
                                'Break Up',
                                `Are you sure you want to break up with ${relationship.name}?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Break Up', style: 'destructive', onPress: () => handleSpecialAction(relationship.id, 'breakup') }
                                ]
                              );
                            }}
                    >
                      <X size={16} color="#EF4444" />
                            <Text style={[styles.actionText, { color: '#EF4444' }]}>Break Up</Text>
                    </TouchableOpacity>
                        </View>
                      </View>
                    )}
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
                      onPress={() => handleSpecialAction(relationship.id, 'divorce')}
                    >
                      <X size={16} color="#EF4444" />
                      <Text style={[styles.actionText, { color: '#EF4444' }]}>Divorce</Text>
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
                  <Text style={styles.partnerLabel}>Child - Age {Math.floor(relationship.age || 0)}</Text>
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
            <EmptyState
              icon="👥"
              title="No Contacts Yet"
              description="Meet people, make friends, and build relationships through social activities."
              darkMode={settings?.darkMode}
            />
          )}
        </View>
      </ScrollView>
      
      {/* Wedding Planning Modal */}
      {showWeddingModal && (() => {
        const relationship = gameState.relationships?.find(r => r.id === showWeddingModal);
        if (!relationship) return null;
        return (
          <WeddingPlanningModal
            visible={!!showWeddingModal}
            onClose={() => setShowWeddingModal(null)}
            partnerId={showWeddingModal}
            partnerName={relationship.name}
          />
        );
      })()}
      
      {/* Divorce Confirmation Modal */}
      {showDivorceConfirm && (() => {
        const relationship = gameState.relationships?.find(r => r.id === showDivorceConfirm);
        if (!relationship) return null;
        
        const costs = calculateDivorceCosts(gameState, showDivorceConfirm);
        if (!costs) return null;
        
        return (
          <DivorceConfirmModal
            visible={!!showDivorceConfirm}
            onClose={() => setShowDivorceConfirm(null)}
            onConfirm={(lawyerId) => {
              const result = fileDivorce(showDivorceConfirm, lawyerId);
              setShowDivorceConfirm(null);
              if (result?.success) {
                Alert.alert('Divorce Finalized', result.message);
                saveGame();
              } else if (result?.message) {
                Alert.alert('Cannot Divorce', result.message);
              }
            }}
            spouseName={relationship.name}
            estimatedSettlement={costs.settlement}
            lawyerFees={costs.lawyerFees}
            currentMoney={gameState.stats.money}
            currentGems={gameState.stats.gems || 0}
            netWorth={costs.netWorth}
            isDarkMode={settings?.darkMode ?? false}
          />
        );
      })()}
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
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
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
  relationshipImageContainer: {
    marginRight: 12,
  },
  relationshipImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#23283B',
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
  // Collapsible partner actions styles
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    marginTop: 8,
  },
  expandText: {
    color: '#EC4899',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  expandedActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#23283B',
  },
  actionSectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  datingButton: {
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderColor: 'rgba(236, 72, 153, 0.2)',
  },
  giftButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  // ─── NPC Depth Section ────────────────────────────
  npcDepthSection: {
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2230',
  },
  npcMoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A1D29',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mood_happy: {
    backgroundColor: '#10B98120',
  },
  mood_stressed: {
    backgroundColor: '#F59E0B20',
  },
  mood_sad: {
    backgroundColor: '#3B82F620',
  },
  mood_angry: {
    backgroundColor: '#EF444420',
  },
  mood_neutral: {
    backgroundColor: '#1A1D29',
  },
  moodEmoji: {
    fontSize: 14,
  },
  moodLabel: {
    color: '#9FA4B3',
    fontSize: 11,
    fontWeight: '600',
  },
  lifeEventText: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  opinionBars: {
    gap: 4,
    marginBottom: 8,
  },
  opinionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opinionLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    width: 42,
  },
  opinionTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#1A1D29',
    borderRadius: 2,
    overflow: 'hidden',
  },
  opinionFill: {
    height: '100%',
    borderRadius: 2,
  },
  opinionValue: {
    color: '#9FA4B3',
    fontSize: 10,
    fontWeight: '600',
    width: 22,
    textAlign: 'right',
  },
  npcGoals: {
    marginBottom: 6,
  },
  npcGoalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  npcGoalsTitle: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  npcGoalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  npcGoalChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  npcGoalFulfilled: {
    borderColor: '#10B981',
    backgroundColor: '#10B98115',
  },
  npcGoalText: {
    color: '#9FA4B3',
    fontSize: 10,
    fontWeight: '600',
  },
  npcGoalTextFulfilled: {
    color: '#10B981',
  },
  npcMemoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  npcMemoryText: {
    color: '#6B7280',
    fontSize: 10,
    fontStyle: 'italic',
    flex: 1,
  },
});
