/**
 * Travel App Component
 * 
 * Complete travel booking platform with destinations, trips, business opportunities, and travel history
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Plane,
  MapPin,
  Heart,
  Zap,
  Battery,
  Clock,
  Briefcase,
  History,
  Globe,
  CheckCircle,
  XCircle,
  Brain,
  Wind,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import { travelTo, returnFromTrip, purchasePassport, unlockBusinessOpportunity, investInBusinessOpportunity } from '@/contexts/game/actions/TravelActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { scale, fontScale } from '@/utils/scaling';

const { width: screenWidth } = Dimensions.get('window');

interface TravelAppProps {
  onBack: () => void;
}

type TabType = 'destinations' | 'trips' | 'business' | 'history';

export default function TravelApp({ onBack }: TravelAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const [activeTab, setActiveTab] = useState<TabType>('destinations');
  const { settings } = gameState;
  const travel = gameState.travel || {
    visitedDestinations: [],
    passportOwned: false,
    businessOpportunities: {},
    travelHistory: [],
  };
  
  // Check if passport is owned (either via items or travel state)
  const passportItem = gameState.items?.find(i => i.id === 'passport');
  const ownsPassport = travel.passportOwned || passportItem?.owned || false;

  const currentTrip = travel.currentTrip;
  const weeksUntilReturn = currentTrip ? Math.max(0, currentTrip.returnWeek - gameState.week) : 0;

  // Get transportation policy effects
  const transportPolicyEffects = gameState.politics?.activePolicyEffects?.transportation;
  const travelCostReduction = transportPolicyEffects?.travelCostReduction || 0;
  
  // Helper function to get adjusted travel cost
  const getAdjustedTravelCost = useCallback((cost: number) => {
    return Math.max(0, Math.floor(cost * (1 - travelCostReduction / 100)));
  }, [travelCostReduction]);

  // Filter destinations based on requirements
  const availableDestinations = useMemo(() => {
    return DESTINATIONS.filter(dest => {
      if (dest.requirements) {
        if (dest.requirements.items?.includes('passport') && !ownsPassport) {
          return false;
        }
        if (dest.requirements.money && gameState.stats.money < dest.requirements.money) {
          return false;
        }
        if (dest.requirements.happiness && gameState.stats.happiness < dest.requirements.happiness) {
          return false;
        }
      }
      return true;
    });
  }, [ownsPassport, gameState.stats.money, gameState.stats.happiness]);

  const handleTravel = useCallback((destination: TravelDestination) => {
    if (currentTrip) {
      Alert.alert('Already Traveling', 'You are already on a trip. Please wait until you return.');
      return;
    }

    const adjustedCost = getAdjustedTravelCost(destination.cost);
    if (gameState.stats.money < adjustedCost) {
      Alert.alert('Insufficient Funds', `You need $${adjustedCost.toLocaleString()} to travel to ${destination.name}.`);
      return;
    }

    Alert.alert(
      `Travel to ${destination.name}`,
      `Are you sure you want to spend $${adjustedCost.toLocaleString()} to visit ${destination.name} for ${destination.duration} week(s)?${adjustedCost < destination.cost ? ` (was $${destination.cost.toLocaleString()})` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Let\'s Go!',
          onPress: () => {
            const result = travelTo(
              gameState,
              setGameState,
              destination.id,
              { updateMoney, updateStats }
            );
            if (result.success) {
              saveGame();
              Alert.alert('Bon Voyage!', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, currentTrip]);

  const handleReturn = useCallback(() => {
    if (!currentTrip) return;

    Alert.alert(
      'Return Early?',
      'Are you sure you want to return early from your trip? You will still receive the travel benefits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Return',
          onPress: () => {
            const result = returnFromTrip(
              gameState,
              setGameState,
              { updateStats }
            );
            if (result.success) {
              saveGame();
              Alert.alert('Welcome Back!', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, currentTrip]);

  const handlePurchasePassport = useCallback(() => {
    if (ownsPassport) {
      Alert.alert('Already Owned', 'You already own a passport.');
      return;
    }

    Alert.alert(
      'Purchase Passport',
      'Purchase a passport for $500 to unlock international travel destinations?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            const result = purchasePassport(gameState, setGameState, { updateMoney });
            if (result.success) {
              saveGame();
              Alert.alert('Success', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, ownsPassport, saveGame]);

  const handleInvestInOpportunity = useCallback((opportunityId: string) => {
    const opportunity = travel.businessOpportunities?.[opportunityId];
    if (!opportunity) return;

    if (opportunity.invested) {
      Alert.alert('Already Invested', 'You have already invested in this opportunity.');
      return;
    }

    if (gameState.stats.money < opportunity.cost) {
      Alert.alert('Insufficient Funds', `You need $${opportunity.cost.toLocaleString()} to invest in this opportunity.`);
      return;
    }

    Alert.alert(
      `Invest in ${opportunity.name}?`,
      `Invest $${opportunity.cost.toLocaleString()} to earn $${opportunity.weeklyIncome.toLocaleString()} per week?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Invest',
          onPress: () => {
            const result = investInBusinessOpportunity(gameState, setGameState, opportunityId, { updateMoney });
            if (result.success) {
              saveGame();
              Alert.alert('Success', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, travel.businessOpportunities, saveGame]);

  const renderDestinations = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={true}>
        {!ownsPassport && (
          <TouchableOpacity
            style={[styles.passportCard, settings.darkMode && styles.passportCardDark]}
            onPress={handlePurchasePassport}
          >
            <LinearGradient
              colors={settings.darkMode ? ['#1E40AF', '#1E3A8A'] : ['#3B82F6', '#2563EB']}
              style={styles.passportGradient}
            >
              <Globe size={24} color="#FFF" />
              <View style={styles.passportContent}>
                <Text style={styles.passportTitle}>Purchase Passport</Text>
                <Text style={styles.passportDescription}>
                  Unlock international destinations for $500
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Available Destinations
        </Text>

        {availableDestinations.map((dest) => {
          const isVisited = travel.visitedDestinations.includes(dest.id);
          return (
            <TouchableOpacity
              key={dest.id}
              style={[styles.destinationCard, settings.darkMode && styles.destinationCardDark]}
              onPress={() => handleTravel(dest)}
              disabled={!!currentTrip}
            >
              <LinearGradient
                colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={[styles.destName, settings.darkMode && styles.destNameDark]}>
                      {dest.name}
                    </Text>
                    <View style={styles.locationRow}>
                      <MapPin size={14} color={settings.darkMode ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.destCountry, settings.darkMode && styles.destCountryDark]}>
                        {dest.country}
                      </Text>
                      {dest.requirements?.items?.includes('passport') && !ownsPassport && (
                        <Globe size={14} color="#F59E0B" style={{ marginLeft: 8 }} />
                      )}
                      {isVisited && (
                        <CheckCircle size={14} color="#10B981" style={{ marginLeft: 8 }} />
                      )}
                    </View>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>
                      ${getAdjustedTravelCost(dest.cost).toLocaleString()}
                      {getAdjustedTravelCost(dest.cost) < dest.cost && (
                        <Text style={styles.discountText}> (was ${dest.cost.toLocaleString()})</Text>
                      )}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.description, settings.darkMode && styles.descriptionDark]}>
                  {dest.description}
                </Text>

                <View style={styles.benefitsRow}>
                  {dest.benefits.happiness > 0 && (
                    <View style={styles.benefit}>
                      <Heart size={14} color="#EF4444" />
                      <Text style={styles.benefitText}>+{dest.benefits.happiness}</Text>
                    </View>
                  )}
                  {dest.benefits.health > 0 && (
                    <View style={styles.benefit}>
                      <Battery size={14} color="#10B981" />
                      <Text style={styles.benefitText}>+{dest.benefits.health}</Text>
                    </View>
                  )}
                  {dest.benefits.energy > 0 && (
                    <View style={styles.benefit}>
                      <Zap size={14} color="#F59E0B" />
                      <Text style={styles.benefitText}>+{dest.benefits.energy}</Text>
                    </View>
                  )}
                  {dest.benefits.intelligence && dest.benefits.intelligence > 0 && (
                    <View style={styles.benefit}>
                      <Brain size={14} color="#8B5CF6" />
                      <Text style={styles.benefitText}>+{dest.benefits.intelligence}</Text>
                    </View>
                  )}
                  {dest.benefits.stress && dest.benefits.stress < 0 && (
                    <View style={styles.benefit}>
                      <Wind size={14} color="#06B6D4" />
                      <Text style={styles.benefitText}>Stress: {dest.benefits.stress}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.durationRow}>
                  <Clock size={12} color={settings.darkMode ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.durationText, settings.darkMode && styles.durationTextDark]}>
                    {dest.duration} week{dest.duration > 1 ? 's' : ''}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderTrips = () => {
    if (!currentTrip) {
      return (
        <View style={styles.emptyState}>
          <Plane size={48} color={settings.darkMode ? '#FFFFFF' : '#9CA3AF'} />
          <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
            No active trips
          </Text>
          <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
            Book a destination to start your journey!
          </Text>
        </View>
      );
    }

    const destination = DESTINATIONS.find(d => d.id === currentTrip.destinationId);

    return (
      <ScrollView style={styles.tabContent}>
        <View style={[styles.tripCard, settings.darkMode && styles.tripCardDark]}>
          <LinearGradient
            colors={settings.darkMode ? ['#1E40AF', '#1E3A8A'] : ['#3B82F6', '#2563EB']}
            style={styles.tripGradient}
          >
            <View style={styles.tripHeader}>
              <Plane size={32} color="#FFF" />
              <View style={styles.tripInfo}>
                <Text style={styles.tripDestination}>{destination?.name || 'Unknown'}</Text>
                <Text style={styles.tripLocation}>{destination?.country || ''}</Text>
              </View>
            </View>

            <View style={styles.tripDetails}>
              <View style={styles.tripDetailRow}>
                <Clock size={16} color="#FFF" />
                <Text style={styles.tripDetailText}>
                  {weeksUntilReturn} week{weeksUntilReturn !== 1 ? 's' : ''} until return
                </Text>
              </View>
              <View style={styles.tripDetailRow}>
                <Text style={styles.tripDetailLabel}>Started:</Text>
                <Text style={styles.tripDetailText}>Week {currentTrip.startWeek}</Text>
              </View>
              <View style={styles.tripDetailRow}>
                <Text style={styles.tripDetailLabel}>Returns:</Text>
                <Text style={styles.tripDetailText}>Week {currentTrip.returnWeek}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.returnButton}
              onPress={handleReturn}
            >
              <Text style={styles.returnButtonText}>Return Early</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>
    );
  };

  const renderBusiness = () => {
    const opportunities = Object.values(travel.businessOpportunities || {}).filter(opp => opp.unlocked);

    if (opportunities.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Briefcase size={48} color={settings.darkMode ? '#FFFFFF' : '#9CA3AF'} />
          <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
            No business opportunities yet
          </Text>
          <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
            Visit destinations to unlock business opportunities!
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent}>
        {opportunities.map((opp) => (
          <View
            key={opp.id}
            style={[styles.businessCard, settings.darkMode && styles.businessCardDark]}
          >
            <LinearGradient
              colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
              style={styles.cardGradient}
            >
              <View style={styles.businessHeader}>
                <Briefcase size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                <Text style={[styles.businessName, settings.darkMode && styles.businessNameDark]}>
                  {opp.name}
                </Text>
              </View>
              <Text style={[styles.businessDescription, settings.darkMode && styles.businessDescriptionDark]}>
                {opp.description}
              </Text>
              <View style={styles.businessStats}>
                <View style={styles.businessStat}>
                  <Text style={[styles.businessStatLabel, settings.darkMode && styles.businessStatLabelDark]}>
                    Investment:
                  </Text>
                  <Text style={[styles.businessStatValue, settings.darkMode && styles.businessStatValueDark]}>
                    ${opp.cost.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.businessStat}>
                  <Text style={[styles.businessStatLabel, settings.darkMode && styles.businessStatLabelDark]}>
                    Weekly Income:
                  </Text>
                  <Text style={[styles.businessStatValue, settings.darkMode && styles.businessStatValueDark]}>
                    ${opp.weeklyIncome.toLocaleString()}
                  </Text>
                </View>
              </View>
              {opp.invested ? (
                <View style={styles.investedBadge}>
                  <CheckCircle size={16} color="#10B981" />
                  <Text style={styles.investedText}>Invested</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.investButton, gameState.stats.money < opp.cost && styles.investButtonDisabled]}
                  onPress={() => handleInvestInOpportunity(opp.id)}
                  disabled={gameState.stats.money < opp.cost}
                >
                  <LinearGradient
                    colors={gameState.stats.money < opp.cost ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
                    style={styles.investButtonGradient}
                  >
                    <Text style={styles.investButtonText}>Invest ${opp.cost.toLocaleString()}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderHistory = () => {
    if (travel.travelHistory.length === 0) {
      return (
        <View style={styles.emptyState}>
          <History size={48} color={settings.darkMode ? '#FFFFFF' : '#9CA3AF'} />
          <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
            No travel history
          </Text>
          <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
            Your travel history will appear here after you visit destinations.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent}>
        {travel.travelHistory
          .slice()
          .reverse()
          .map((trip, index) => {
            const destination = DESTINATIONS.find(d => d.id === trip.destinationId);
            return (
              <View
                key={`${trip.destinationId}-${trip.week}-${index}`}
                style={[styles.historyCard, settings.darkMode && styles.historyCardDark]}
              >
                <LinearGradient
                  colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                  style={styles.cardGradient}
                >
                  <View style={styles.historyHeader}>
                    <MapPin size={16} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.historyDestination, settings.darkMode && styles.historyDestinationDark]}>
                      {destination?.name || 'Unknown'}
                    </Text>
                  </View>
                  <Text style={[styles.historyLocation, settings.darkMode && styles.historyLocationDark]}>
                    {destination?.country || ''}
                  </Text>
                  <Text style={[styles.historyDate, settings.darkMode && styles.historyDateDark]}>
                    Week {trip.week}, {trip.year}
                  </Text>
                </LinearGradient>
              </View>
            );
          })}
      </ScrollView>
    );
  };

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#1E3A8A', '#1F2937'] : ['#FFFFFF', '#F8FAFC']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Plane size={28} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
          <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
            Travel Agency
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'destinations' && styles.activeTab]}
          onPress={() => setActiveTab('destinations')}
        >
          <Globe size={18} color={activeTab === 'destinations' ? '#3B82F6' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'destinations' && styles.activeTabText,
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            Destinations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'trips' && styles.activeTab]}
          onPress={() => setActiveTab('trips')}
        >
          <Plane size={18} color={activeTab === 'trips' ? '#3B82F6' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'trips' && styles.activeTabText,
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            My Trips
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'business' && styles.activeTab]}
          onPress={() => setActiveTab('business')}
        >
          <Briefcase size={18} color={activeTab === 'business' ? '#3B82F6' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'business' && styles.activeTabText,
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            Business
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <History size={18} color={activeTab === 'history' ? '#3B82F6' : (settings.darkMode ? '#FFFFFF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'history' && styles.activeTabText,
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'destinations' && renderDestinations()}
      {activeTab === 'trips' && renderTrips()}
      {activeTab === 'business' && renderBusiness()}
      {activeTab === 'history' && renderHistory()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingTop: scale(16),
    paddingBottom: scale(12),
  },
  backButton: {
    marginRight: scale(12),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: fontScale(24),
    fontWeight: 'bold',
    marginLeft: scale(12),
    color: '#111827',
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(8),
    paddingHorizontal: scale(8),
    borderRadius: scale(8),
    marginHorizontal: scale(4),
  },
  activeTab: {
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: fontScale(12),
    marginLeft: scale(4),
    color: '#6B7280',
  },
  tabTextDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingTop: scale(16),
  },
  passportCard: {
    borderRadius: scale(12),
    marginBottom: scale(16),
    overflow: 'hidden',
  },
  passportCardDark: {
    // Dark mode handled by gradient
  },
  passportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(16),
  },
  passportContent: {
    marginLeft: scale(12),
    flex: 1,
  },
  passportTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFF',
    marginBottom: scale(4),
  },
  passportDescription: {
    fontSize: fontScale(12),
    color: '#E0E7FF',
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    marginBottom: scale(12),
    color: '#111827',
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  destinationCard: {
    borderRadius: scale(12),
    marginBottom: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  destinationCardDark: {
    borderColor: '#374151',
  },
  cardGradient: {
    padding: scale(16),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(8),
  },
  cardHeaderLeft: {
    flex: 1,
  },
  destName: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginBottom: scale(4),
  },
  destNameDark: {
    color: '#F9FAFB',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destCountry: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginLeft: scale(4),
  },
  destCountryDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  priceTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(8),
  },
  discountText: {
    fontSize: fontScale(10),
    color: '#10B981',
    fontStyle: 'italic',
    marginLeft: scale(4),
  },
  priceText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: fontScale(14),
  },
  description: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(12),
    lineHeight: fontScale(20),
  },
  descriptionDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginBottom: scale(8),
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
  },
  benefitText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
    marginLeft: scale(4),
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(4),
  },
  durationText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginLeft: scale(4),
  },
  durationTextDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scale(64),
  },
  emptyStateText: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(16),
  },
  emptyStateTextDark: {
    color: '#F9FAFB',
  },
  emptyStateSubtext: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(8),
    textAlign: 'center',
    paddingHorizontal: scale(32),
  },
  emptyStateSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tripCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(16),
  },
  tripCardDark: {
    // Dark mode handled by gradient
  },
  tripGradient: {
    padding: scale(20),
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  tripInfo: {
    marginLeft: scale(12),
    flex: 1,
  },
  tripDestination: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: scale(4),
  },
  tripLocation: {
    fontSize: fontScale(14),
    color: '#E0E7FF',
  },
  tripDetails: {
    marginBottom: scale(16),
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  tripDetailLabel: {
    fontSize: fontScale(14),
    color: '#E0E7FF',
    marginRight: scale(8),
  },
  tripDetailText: {
    fontSize: fontScale(14),
    color: '#FFF',
    fontWeight: '600',
  },
  returnButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  returnButtonText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  businessCard: {
    borderRadius: scale(12),
    marginBottom: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  businessCardDark: {
    borderColor: '#374151',
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  businessName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginLeft: scale(8),
  },
  businessNameDark: {
    color: '#F9FAFB',
  },
  businessDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(12),
  },
  businessDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  businessStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  businessStat: {
    flex: 1,
  },
  businessStatLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  businessStatLabelDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  businessStatValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
  },
  businessStatValueDark: {
    color: '#F9FAFB',
  },
  historyCard: {
    borderRadius: scale(12),
    marginBottom: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCardDark: {
    borderColor: '#374151',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  historyDestination: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginLeft: scale(8),
  },
  historyDestinationDark: {
    color: '#F9FAFB',
  },
  historyLocation: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(4),
    marginLeft: scale(28),
  },
  historyLocationDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  historyDate: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginLeft: scale(28),
  },
  historyDateDark: {
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  investButton: {
    borderRadius: scale(8),
    overflow: 'hidden',
    marginTop: scale(12),
  },
  investButtonDisabled: {
    opacity: 0.5,
  },
  investButtonGradient: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    alignItems: 'center',
  },
  investButtonText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  investedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(12),
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: scale(8),
  },
  investedText: {
    color: '#10B981',
    fontSize: fontScale(14),
    fontWeight: '600',
    marginLeft: scale(6),
  },
});

