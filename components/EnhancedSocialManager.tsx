import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
} from 'react-native';
import {
  Users,
  Heart,
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Zap,
  Star,
  Plus,
  Filter,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  MessageCircle,
  Gift,
  HandHeart,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame } from '@/contexts/GameContext';
import {
  SocialEvent,
  SocialEventCategory,
  SocialGroup,
  SocialInteraction,
  SOCIAL_EVENTS,
  SOCIAL_GROUPS,
  SOCIAL_INTERACTIONS,
  getSocialEventOutcome,
  canParticipateInEvent,
  getEventCooldownRemaining,
  formatCooldownTime,
} from '@/utils/enhancedSocial';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

interface EnhancedSocialManagerProps {
  visible: boolean;
  onClose: () => void;
}

export default function EnhancedSocialManager({ visible, onClose }: EnhancedSocialManagerProps) {
  const { gameState, setGameState } = useGame();
  const [activeTab, setActiveTab] = useState<'events' | 'groups' | 'interactions'>('events');
  const [selectedCategory, setSelectedCategory] = useState<SocialEventCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SocialEvent | null>(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState<any>(null);

  // Get relationships and social data from game state
  const relationships = gameState.relationships || [];
  const socialEvents = (gameState as any).socialEvents || [];
  const socialGroups = (gameState as any).socialGroups || SOCIAL_GROUPS;
  const socialInteractions = (gameState as any).socialInteractions || [];

  const filteredEvents = useMemo(() => {
    let filtered = SOCIAL_EVENTS.filter(event => {
      const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           event.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return filtered.sort((a, b) => {
      // Sort by cost (cheaper first) and then by relationship requirements
      if (a.cost !== b.cost) return a.cost - b.cost;
      return (a.requirements.minRelationshipLevel || 0) - (b.requirements.minRelationshipLevel || 0);
    });
  }, [selectedCategory, searchQuery]);

  const availableRelationships = useMemo(() => {
    return relationships.filter(rel => rel.relationshipLevel >= 10);
  }, [relationships]);

  const participateInEvent = (event: SocialEvent, selectedParticipants: any[]) => {
    if (selectedParticipants.length < event.requirements.minParticipants) {
      Alert.alert('Not Enough Participants', `This event requires at least ${event.requirements.minParticipants} participants.`);
      return;
    }

    if (selectedParticipants.length > (event.requirements.maxParticipants || 10)) {
      Alert.alert('Too Many Participants', `This event can only have up to ${event.requirements.maxParticipants} participants.`);
      return;
    }

    // Check if player has enough money and energy
    if (gameState.stats.money < event.cost) {
      Alert.alert('Insufficient Funds', `You need $${event.cost} to participate in this event.`);
      return;
    }

    if (gameState.stats.energy < event.energyCost) {
      Alert.alert('Not Enough Energy', `You need ${event.energyCost} energy to participate in this event.`);
      return;
    }

    // Check cooldowns
    const lastEventTime = (gameState as any).lastEventTimes?.[event.id] || 0;
    const cooldownRemaining = getEventCooldownRemaining(event, lastEventTime);
    if (cooldownRemaining > 0) {
      Alert.alert('Event on Cooldown', `This event is on cooldown for ${formatCooldownTime(cooldownRemaining)}.`);
      return;
    }

    // Execute event
    const outcome = getSocialEventOutcome(event, selectedParticipants);
    
    setGameState((prev: any) => {
      const newState = { ...prev };
      
      // Update stats
      newState.stats = {
        ...newState.stats,
        money: newState.stats.money - event.cost,
        energy: Math.max(0, newState.stats.energy - event.energyCost),
        happiness: Math.min(100, newState.stats.happiness + outcome.happinessChange),
        reputation: Math.min(100, newState.stats.reputation + (outcome.reputationChange || 0)),
      };

      // Update relationships
      newState.relationships = newState.relationships.map((rel: any) => {
        const participant = selectedParticipants.find(p => p.id === rel.id);
        if (participant) {
          return {
            ...rel,
            relationshipLevel: Math.min(100, rel.relationshipLevel + outcome.relationshipChange),
            lastInteraction: Date.now(),
          };
        }
        return rel;
      });

      // Record event
      newState.socialEvents = [...(newState.socialEvents || []), {
        id: `${event.id}_${Date.now()}`,
        eventId: event.id,
        participants: selectedParticipants.map(p => p.id),
        outcome: outcome,
        timestamp: Date.now(),
      }];

      // Update last event time
      newState.lastEventTimes = {
        ...(newState.lastEventTimes || {}),
        [event.id]: Date.now(),
      };

      return newState;
    });

    setShowEventModal(false);
    setSelectedEvent(null);
    
    Alert.alert(
      'Event Completed!',
      outcome.description,
      [{ text: 'OK' }]
    );
  };

  const performInteraction = (relationship: any, interactionType: string, mood: 'positive' | 'neutral' | 'negative') => {
    const interactions = SOCIAL_INTERACTIONS[interactionType as keyof typeof SOCIAL_INTERACTIONS];
    if (!interactions || !interactions[mood]) return;

    const interaction = interactions[mood][Math.floor(Math.random() * interactions[mood].length)];
    
    setGameState((prev: any) => {
      const newState = { ...prev };
      
      // Update relationship
      newState.relationships = newState.relationships.map((rel: any) => {
        if (rel.id === relationship.id) {
          return {
            ...rel,
            relationshipLevel: Math.min(100, rel.relationshipLevel + interaction.relationshipChange),
            happiness: Math.min(100, (rel.happiness || 50) + interaction.happinessChange),
            lastInteraction: Date.now(),
          };
        }
        return rel;
      });

      // Update player stats
      newState.stats = {
        ...newState.stats,
        money: newState.stats.money - (interaction.moneyCost || 0),
        energy: Math.max(0, newState.stats.energy - (interaction.energyCost || 0)),
        happiness: Math.min(100, newState.stats.happiness + (interaction.happinessChange || 0)),
      };

      // Record interaction
      newState.socialInteractions = [...(newState.socialInteractions || []), {
        id: `interaction_${Date.now()}`,
        relationshipId: relationship.id,
        type: interactionType,
        action: interaction.action,
        response: interaction.response,
        relationshipChange: interaction.relationshipChange,
        happinessChange: interaction.happinessChange,
        energyCost: interaction.energyCost || 0,
        moneyCost: interaction.moneyCost || 0,
        timestamp: Date.now(),
        context: `${interactionType} with ${relationship.name}`,
        mood: mood,
      }];

      return newState;
    });

    setShowInteractionModal(false);
    setSelectedRelationship(null);
    
    Alert.alert(
      'Interaction Complete!',
      `${interaction.action}\n\n${interaction.response}`,
      [{ text: 'OK' }]
    );
  };

  const renderEventCard = (event: SocialEvent) => {
    const lastEventTime = (gameState as any).lastEventTimes?.[event.id] || 0;
    const cooldownRemaining = getEventCooldownRemaining(event, lastEventTime);
    const canParticipate = cooldownRemaining === 0 && 
                          gameState.stats.money >= event.cost && 
                          gameState.stats.energy >= event.energyCost;

    return (
      <TouchableOpacity
        key={event.id}
        style={[styles.eventCard, gameState.settings.darkMode && styles.eventCardDark]}
        onPress={() => {
          if (canParticipate) {
            setSelectedEvent(event);
            setShowEventModal(true);
          }
        }}
        disabled={!canParticipate}
      >
        <View style={styles.eventHeader}>
          <View style={styles.eventTitleRow}>
            <Text style={[styles.eventCategory, { color: getCategoryColor(event.category) }]}>
              {getCategoryIcon(event.category)} {event.category.toUpperCase()}
            </Text>
            <View style={[styles.eventTypeBadge, { backgroundColor: getCategoryColor(event.category) }]}>
              <Text style={styles.eventTypeText}>{event.type.toUpperCase()}</Text>
            </View>
          </View>
          
          <Text style={[styles.eventTitle, gameState.settings.darkMode && styles.eventTitleDark]}>
            {event.title}
          </Text>
          <Text style={[styles.eventDescription, gameState.settings.darkMode && styles.eventDescriptionDark]}>
            {event.description}
          </Text>
        </View>

        <View style={styles.eventDetails}>
          <View style={styles.eventDetail}>
            <MapPin size={14} color="#6B7280" />
            <Text style={[styles.eventDetailText, gameState.settings.darkMode && styles.eventDetailTextDark]}>
              {event.location}
            </Text>
          </View>
          
          <View style={styles.eventDetail}>
            <Clock size={14} color="#6B7280" />
            <Text style={[styles.eventDetailText, gameState.settings.darkMode && styles.eventDetailTextDark]}>
              {event.duration}h
            </Text>
          </View>
          
          <View style={styles.eventDetail}>
            <DollarSign size={14} color="#6B7280" />
            <Text style={[styles.eventDetailText, gameState.settings.darkMode && styles.eventDetailTextDark]}>
              ${event.cost}
            </Text>
          </View>
          
          <View style={styles.eventDetail}>
            <Zap size={14} color="#6B7280" />
            <Text style={[styles.eventDetailText, gameState.settings.darkMode && styles.eventDetailTextDark]}>
              {event.energyCost} energy
            </Text>
          </View>
        </View>

        <View style={styles.eventFooter}>
          <View style={styles.eventRequirements}>
            <Text style={[styles.requirementText, gameState.settings.darkMode && styles.requirementTextDark]}>
              Min Level: {event.requirements.minRelationshipLevel || 0}
            </Text>
            <Text style={[styles.requirementText, gameState.settings.darkMode && styles.requirementTextDark]}>
              Participants: {event.requirements.minParticipants}-{event.requirements.maxParticipants || '∞'}
            </Text>
          </View>

          {cooldownRemaining > 0 ? (
            <View style={styles.cooldownBadge}>
              <Clock size={14} color="#F59E0B" />
              <Text style={styles.cooldownText}>
                {formatCooldownTime(cooldownRemaining)}
              </Text>
            </View>
          ) : canParticipate ? (
            <View style={[styles.participateButton, { backgroundColor: getCategoryColor(event.category) }]}>
              <Text style={styles.participateButtonText}>Participate</Text>
            </View>
          ) : (
            <View style={styles.cannotParticipateBadge}>
              <AlertCircle size={14} color="#EF4444" />
              <Text style={styles.cannotParticipateText}>Cannot Participate</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRelationshipCard = (relationship: any) => {
    const recentInteractions = socialInteractions.filter((interaction: any) => 
      interaction.relationshipId === relationship.id && 
      Date.now() - interaction.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    return (
      <TouchableOpacity
        key={relationship.id}
        style={[styles.relationshipCard, gameState.settings.darkMode && styles.relationshipCardDark]}
        onPress={() => {
          setSelectedRelationship(relationship);
          setShowInteractionModal(true);
        }}
      >
        <View style={styles.relationshipHeader}>
          <View style={styles.relationshipInfo}>
            <Text style={[styles.relationshipName, gameState.settings.darkMode && styles.relationshipNameDark]}>
              {relationship.name}
            </Text>
            <Text style={[styles.relationshipType, gameState.settings.darkMode && styles.relationshipTypeDark]}>
              {relationship.type || 'Friend'}
            </Text>
          </View>
          
          <View style={styles.relationshipLevel}>
            <Text style={[styles.levelText, gameState.settings.darkMode && styles.levelTextDark]}>
              Level {relationship.relationshipLevel}
            </Text>
            <View style={styles.levelBar}>
              <View 
                style={[
                  styles.levelFill, 
                  { width: `${relationship.relationshipLevel}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        <View style={styles.relationshipStats}>
          <View style={styles.statItem}>
            <Heart size={14} color="#EF4444" />
            <Text style={[styles.statText, gameState.settings.darkMode && styles.statTextDark]}>
              {relationship.happiness || 50}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <MessageCircle size={14} color="#3B82F6" />
            <Text style={[styles.statText, gameState.settings.darkMode && styles.statTextDark]}>
              {recentInteractions.length} interactions
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getCategoryColor = (category: SocialEventCategory): string => {
    const colors = {
      romantic: '#EC4899',
      friendship: '#3B82F6',
      family: '#84CC16',
      professional: '#F59E0B',
      casual: '#6B7280',
      adventure: '#10B981',
      cultural: '#8B5CF6',
      sports: '#EF4444',
      entertainment: '#06B6D4',
    };
    return colors[category] || '#6B7280';
  };

  const getCategoryIcon = (category: SocialEventCategory): string => {
    const icons = {
      romantic: '💕',
      friendship: '👥',
      family: '👨‍👩‍👧‍👦',
      professional: '💼',
      casual: '😊',
      adventure: '🏔️',
      cultural: '🎭',
      sports: '⚽',
      entertainment: '🎬',
    };
    return icons[category] || '🎉';
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, gameState.settings.darkMode && styles.containerDark]}>
        <View style={[styles.header, gameState.settings.darkMode && styles.headerDark]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Social Life</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.activeTab]}
            onPress={() => setActiveTab('events')}
          >
            <Calendar size={20} color={activeTab === 'events' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
              Events
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
            onPress={() => setActiveTab('groups')}
          >
            <Users size={20} color={activeTab === 'groups' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
              Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'interactions' && styles.activeTab]}
            onPress={() => setActiveTab('interactions')}
          >
            <MessageCircle size={20} color={activeTab === 'interactions' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'interactions' && styles.activeTabText]}>
              Relationships
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'events' && (
          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
              <TouchableOpacity
                style={[styles.categoryChip, selectedCategory === 'all' && styles.activeCategoryChip]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.activeCategoryChipText]}>
                  All
                </Text>
              </TouchableOpacity>
              {['romantic', 'friendship', 'family', 'professional', 'adventure', 'entertainment'].map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryChip, selectedCategory === category && styles.activeCategoryChip]}
                  onPress={() => setSelectedCategory(category as SocialEventCategory)}
                >
                  <Text style={[styles.categoryChipText, selectedCategory === category && styles.activeCategoryChipText]}>
                    {getCategoryIcon(category as SocialEventCategory)} {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {activeTab === 'events' && (
            <View style={styles.eventsList}>
              {filteredEvents.map(renderEventCard)}
            </View>
          )}

          {activeTab === 'groups' && (
            <View style={styles.groupsList}>
              {socialGroups.map((group: SocialGroup) => (
                <View key={group.id} style={[styles.groupCard, gameState.settings.darkMode && styles.groupCardDark]}>
                  <Text style={[styles.groupName, gameState.settings.darkMode && styles.groupNameDark]}>
                    {group.name}
                  </Text>
                  <Text style={[styles.groupDescription, gameState.settings.darkMode && styles.groupDescriptionDark]}>
                    {group.description}
                  </Text>
                  <Text style={[styles.groupMembers, gameState.settings.darkMode && styles.groupMembersDark]}>
                    {group.members.length} members
                  </Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'interactions' && (
            <View style={styles.relationshipsList}>
              {availableRelationships.map(renderRelationshipCard)}
            </View>
          )}
        </ScrollView>

        {/* Event Participation Modal */}
        <Modal visible={showEventModal} transparent animationType="fade" onRequestClose={() => setShowEventModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, gameState.settings.darkMode && styles.modalContentDark]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, gameState.settings.darkMode && styles.modalTitleDark]}>
                  {selectedEvent?.title}
                </Text>
                <TouchableOpacity onPress={() => setShowEventModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalDescription, gameState.settings.darkMode && styles.modalDescriptionDark]}>
                {selectedEvent?.description}
              </Text>

              <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
                Select participants for this event:
              </Text>

              <ScrollView style={styles.participantsList}>
                {availableRelationships.map((relationship: any) => (
                  <TouchableOpacity
                    key={relationship.id}
                    style={[styles.participantItem, gameState.settings.darkMode && styles.participantItemDark]}
                    onPress={() => {
                      // Toggle participant selection
                      // This would need to be implemented with proper state management
                    }}
                  >
                    <Text style={[styles.participantName, gameState.settings.darkMode && styles.participantNameDark]}>
                      {relationship.name}
                    </Text>
                    <Text style={[styles.participantLevel, gameState.settings.darkMode && styles.participantLevelDark]}>
                      Level {relationship.relationshipLevel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowEventModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.participateButton, { backgroundColor: selectedEvent ? getCategoryColor(selectedEvent.category) : '#3B82F6' }]}
                  onPress={() => {
                    if (selectedEvent) {
                      // This would need proper participant selection logic
                      participateInEvent(selectedEvent, availableRelationships.slice(0, 2));
                    }
                  }}
                >
                  <Text style={styles.participateButtonText}>Participate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Interaction Modal */}
        <Modal visible={showInteractionModal} transparent animationType="fade" onRequestClose={() => setShowInteractionModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, gameState.settings.darkMode && styles.modalContentDark]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, gameState.settings.darkMode && styles.modalTitleDark]}>
                  Interact with {selectedRelationship?.name}
                </Text>
                <TouchableOpacity onPress={() => setShowInteractionModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.interactionButtons}>
                <TouchableOpacity
                  style={[styles.interactionButton, { backgroundColor: '#3B82F6' }]}
                  onPress={() => performInteraction(selectedRelationship, 'conversation', 'positive')}
                >
                  <MessageCircle size={20} color="#FFFFFF" />
                  <Text style={styles.interactionButtonText}>Talk</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.interactionButton, { backgroundColor: '#EC4899' }]}
                  onPress={() => performInteraction(selectedRelationship, 'gift', 'positive')}
                >
                  <Gift size={20} color="#FFFFFF" />
                  <Text style={styles.interactionButtonText}>Give Gift</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.interactionButton, { backgroundColor: '#10B981' }]}
                  onPress={() => performInteraction(selectedRelationship, 'support', 'positive')}
                >
                  <HandHeart size={20} color="#FFFFFF" />
                  <Text style={styles.interactionButtonText}>Support</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowInteractionModal(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.md,
    backgroundColor: '#3B82F6',
  },
  headerDark: {
    backgroundColor: '#1F2937',
  },
  closeButton: {
    padding: responsiveSpacing.sm,
  },
  headerTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  filters: {
    padding: responsiveSpacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryFilter: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.full,
    marginRight: responsiveSpacing.sm,
  },
  activeCategoryChip: {
    backgroundColor: '#3B82F6',
  },
  categoryChipText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeCategoryChipText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: responsiveSpacing.md,
  },
  eventsList: {
    gap: responsiveSpacing.md,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventCardDark: {
    backgroundColor: '#1F2937',
  },
  eventHeader: {
    marginBottom: responsiveSpacing.md,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.sm,
  },
  eventCategory: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  eventTypeBadge: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
  },
  eventTypeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  eventTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
    marginBottom: responsiveSpacing.xs,
  },
  eventTitleDark: {
    color: '#F9FAFB',
  },
  eventDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
  },
  eventDescriptionDark: {
    color: '#9CA3AF',
  },
  eventDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  eventDetailText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
  },
  eventDetailTextDark: {
    color: '#9CA3AF',
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventRequirements: {
    flex: 1,
  },
  requirementText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
  },
  requirementTextDark: {
    color: '#9CA3AF',
  },
  cooldownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
    gap: responsiveSpacing.xs,
  },
  cooldownText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#F59E0B',
  },
  participateButton: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
  },
  participateButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cannotParticipateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.sm,
    gap: responsiveSpacing.xs,
  },
  cannotParticipateText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#EF4444',
  },
  groupsList: {
    gap: responsiveSpacing.md,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  groupCardDark: {
    backgroundColor: '#1F2937',
  },
  groupName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
    marginBottom: responsiveSpacing.xs,
  },
  groupNameDark: {
    color: '#F9FAFB',
  },
  groupDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: responsiveSpacing.sm,
  },
  groupDescriptionDark: {
    color: '#9CA3AF',
  },
  groupMembers: {
    fontSize: responsiveFontSize.xs,
    color: '#374151',
    fontWeight: '500',
  },
  groupMembersDark: {
    color: '#D1D5DB',
  },
  relationshipsList: {
    gap: responsiveSpacing.md,
  },
  relationshipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  relationshipCardDark: {
    backgroundColor: '#1F2937',
  },
  relationshipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.md,
  },
  relationshipInfo: {
    flex: 1,
  },
  relationshipName: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
    marginBottom: responsiveSpacing.xs,
  },
  relationshipNameDark: {
    color: '#F9FAFB',
  },
  relationshipType: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
  },
  relationshipTypeDark: {
    color: '#9CA3AF',
  },
  relationshipLevel: {
    alignItems: 'flex-end',
  },
  levelText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginBottom: responsiveSpacing.xs,
  },
  levelTextDark: {
    color: '#D1D5DB',
  },
  levelBar: {
    width: 80,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: responsiveBorderRadius.sm,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: responsiveBorderRadius.sm,
  },
  relationshipStats: {
    flexDirection: 'row',
    gap: responsiveSpacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  statText: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    fontWeight: '500',
  },
  statTextDark: {
    color: '#D1D5DB',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.lg,
    padding: responsiveSpacing.lg,
    margin: responsiveSpacing.lg,
    maxWidth: 400,
    width: '90%',
    maxHeight: '80%',
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.lg,
  },
  modalTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#111827',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: responsiveSpacing.md,
  },
  modalDescriptionDark: {
    color: '#9CA3AF',
  },
  modalText: {
    fontSize: responsiveFontSize.sm,
    color: '#374151',
    marginBottom: responsiveSpacing.md,
  },
  modalTextDark: {
    color: '#D1D5DB',
  },
  participantsList: {
    maxHeight: 200,
    marginBottom: responsiveSpacing.lg,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    backgroundColor: '#F3F4F6',
    borderRadius: responsiveBorderRadius.md,
    marginBottom: responsiveSpacing.sm,
  },
  participantItemDark: {
    backgroundColor: '#374151',
  },
  participantName: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#374151',
  },
  participantNameDark: {
    color: '#D1D5DB',
  },
  participantLevel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
  },
  participantLevelDark: {
    color: '#9CA3AF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#374151',
  },
  interactionButtons: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
    marginBottom: responsiveSpacing.lg,
  },
  interactionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    gap: responsiveSpacing.sm,
  },
  interactionButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
