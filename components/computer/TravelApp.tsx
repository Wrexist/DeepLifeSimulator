/**
 * Travel App Component - Beautiful Modern Redesign
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
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { MotiView, MotiText } from '@/components/anim/MotiStub';
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
  Sparkles,
  TrendingUp,
  Star,
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
  const currentAbsoluteWeek = gameState.weeksLived || 0;
  const weeksUntilReturn = currentTrip ? Math.max(0, (currentTrip.returnWeek || 0) - currentAbsoluteWeek) : 0;

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
        if ('items' in dest.requirements && dest.requirements.items?.includes('passport') && !ownsPassport) {
          return false;
        }
        if ('money' in dest.requirements && dest.requirements.money && gameState.stats.money < dest.requirements.money) {
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
  }, [gameState, setGameState, currentTrip, getAdjustedTravelCost, saveGame]);

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
  }, [gameState, setGameState, currentTrip, saveGame]);

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
      <ScrollView 
        style={styles.tabContent} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!ownsPassport && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <TouchableOpacity
              style={styles.passportCard}
              onPress={handlePurchasePassport}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.passportGradient}
              >
                <View style={styles.passportIconContainer}>
                  <Globe size={32} color="#FFF" />
                  <Sparkles size={20} color="#FCD34D" style={styles.sparkleIcon} />
                </View>
                <View style={styles.passportContent}>
                  <Text style={styles.passportTitle}>Unlock World Travel</Text>
                  <Text style={styles.passportDescription}>
                    Purchase a passport for $500 to access international destinations
                  </Text>
                  <View style={styles.passportPrice}>
                    <Text style={styles.passportPriceText}>$500</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
            Explore Destinations
          </Text>
          <Text style={[styles.sectionSubtitle, settings.darkMode && styles.sectionSubtitleDark]}>
            {availableDestinations.length} destinations available
          </Text>
        </View>

        {availableDestinations.map((dest, index) => {
          const isVisited = travel.visitedDestinations.includes(dest.id);
          const adjustedCost = getAdjustedTravelCost(dest.cost);
          const hasDiscount = adjustedCost < dest.cost;
          
          return (
            <MotiView
              key={dest.id}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: index * 50 }}
            >
              <TouchableOpacity
                style={[styles.destinationCard, settings.darkMode && styles.destinationCardDark]}
                onPress={() => handleTravel(dest)}
                disabled={!!currentTrip}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={settings.darkMode 
                    ? ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']
                    : ['rgba(255, 255, 255, 0.95)', 'rgba(249, 250, 251, 0.95)']
                  }
                  style={styles.cardGradient}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.destNameRow}>
                        <Text style={[styles.destName, settings.darkMode && styles.destNameDark]}>
                          {dest.name}
                        </Text>
                        {isVisited && (
                          <View style={styles.visitedBadge}>
                            <CheckCircle size={14} color="#10B981" />
                            <Text style={styles.visitedText}>Visited</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.locationRow}>
                        <MapPin size={14} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                        <Text style={[styles.destCountry, settings.darkMode && styles.destCountryDark]}>
                          {dest.country}
                        </Text>
                        {dest.requirements?.items?.includes('passport') && !ownsPassport && (
                          <View style={styles.passportRequired}>
                            <Globe size={12} color="#F59E0B" />
                            <Text style={styles.passportRequiredText}>Passport</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[styles.priceTag, hasDiscount && styles.priceTagDiscount]}>
                      <Text style={styles.priceText}>
                        ${adjustedCost.toLocaleString()}
                      </Text>
                      {hasDiscount && (
                        <Text style={styles.discountBadge}>SAVE</Text>
                      )}
                    </View>
                  </View>

                  <Text style={[styles.description, settings.darkMode && styles.descriptionDark]}>
                    {dest.description}
                  </Text>

                  <View style={styles.benefitsContainer}>
                    {dest.benefits.happiness > 0 && (
                      <View style={[styles.benefitBadge, styles.benefitHappiness]}>
                        <Heart size={12} color="#EF4444" />
                        <Text style={styles.benefitText}>+{dest.benefits.happiness}</Text>
                      </View>
                    )}
                    {dest.benefits.health > 0 && (
                      <View style={[styles.benefitBadge, styles.benefitHealth]}>
                        <Battery size={12} color="#10B981" />
                        <Text style={styles.benefitText}>+{dest.benefits.health}</Text>
                      </View>
                    )}
                    {dest.benefits.energy > 0 && (
                      <View style={[styles.benefitBadge, styles.benefitEnergy]}>
                        <Zap size={12} color="#F59E0B" />
                        <Text style={styles.benefitText}>+{dest.benefits.energy}</Text>
                      </View>
                    )}
                    {dest.benefits.intelligence && dest.benefits.intelligence > 0 && (
                      <View style={[styles.benefitBadge, styles.benefitIntelligence]}>
                        <Brain size={12} color="#8B5CF6" />
                        <Text style={styles.benefitText}>+{dest.benefits.intelligence}</Text>
                      </View>
                    )}
                    {dest.benefits.stress && dest.benefits.stress < 0 && (
                      <View style={[styles.benefitBadge, styles.benefitStress]}>
                        <Wind size={12} color="#06B6D4" />
                        <Text style={styles.benefitText}>{dest.benefits.stress}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.durationBadge}>
                      <Clock size={12} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
                      <Text style={[styles.durationText, settings.darkMode && styles.durationTextDark]}>
                        {dest.duration} week{dest.duration > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.bookButton}>
                      <Text style={styles.bookButtonText}>Book Now</Text>
                      <Plane size={14} color="#FFF" style={{ marginLeft: 6 }} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>
          );
        })}
      </ScrollView>
    );
  };

  const renderTrips = () => {
    if (!currentTrip) {
      return (
        <View style={styles.emptyState}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <View style={styles.emptyIconContainer}>
              <Plane size={64} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            </View>
          </MotiView>
          <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
            No Active Trips
          </Text>
          <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
            Book a destination to start your journey!
          </Text>
        </View>
      );
    }

    const destination = DESTINATIONS.find(d => d.id === currentTrip.destinationId);

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          <View style={styles.tripCard}>
            <LinearGradient
              colors={['#6366F1', '#4F46E5', '#4338CA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tripGradient}
            >
              <View style={styles.tripHeader}>
                <View style={styles.tripIconContainer}>
                  <Plane size={40} color="#FFF" />
                </View>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripDestination}>{destination?.name || 'Unknown'}</Text>
                  <View style={styles.tripLocationRow}>
                    <MapPin size={14} color="#E0E7FF" />
                    <Text style={styles.tripLocation}>{destination?.country || ''}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tripDetails}>
                <View style={styles.tripDetailCard}>
                  <Clock size={20} color="#E0E7FF" />
                  <View style={styles.tripDetailContent}>
                    <Text style={styles.tripDetailLabel}>Time Remaining</Text>
                    <Text style={styles.tripDetailValue}>
                      {weeksUntilReturn} week{weeksUntilReturn !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.tripDetailCard}>
                  <Star size={20} color="#FCD34D" />
                  <View style={styles.tripDetailContent}>
                    <Text style={styles.tripDetailLabel}>Started</Text>
                    <Text style={styles.tripDetailValue}>Week {currentTrip.startWeek}</Text>
                  </View>
                </View>
                <View style={styles.tripDetailCard}>
                  <TrendingUp size={20} color="#10B981" />
                  <View style={styles.tripDetailContent}>
                    <Text style={styles.tripDetailLabel}>Returns</Text>
                    <Text style={styles.tripDetailValue}>Week {currentTrip.returnWeek}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.returnButton}
                onPress={handleReturn}
                activeOpacity={0.8}
              >
                <Text style={styles.returnButtonText}>Return Early</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </MotiView>
      </ScrollView>
    );
  };

  const renderBusiness = () => {
    const opportunities = Object.values(travel.businessOpportunities || {}).filter(opp => opp.unlocked);

    if (opportunities.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <View style={styles.emptyIconContainer}>
              <Briefcase size={64} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            </View>
          </MotiView>
          <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
            No Business Opportunities Yet
          </Text>
          <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
            Visit destinations to unlock business opportunities!
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
        {opportunities.map((opp, index) => (
          <MotiView
            key={opp.id}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: index * 100 }}
          >
            <View style={[styles.businessCard, settings.darkMode && styles.businessCardDark]}>
              <LinearGradient
                colors={settings.darkMode 
                  ? ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(249, 250, 251, 0.95)']
                }
                style={styles.cardGradient}
              >
                <View style={styles.businessHeader}>
                  <View style={styles.businessIconContainer}>
                    <Briefcase size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.businessHeaderText}>
                    <Text style={[styles.businessName, settings.darkMode && styles.businessNameDark]}>
                      {opp.name}
                    </Text>
                    {opp.invested && (
                      <View style={styles.investedBadge}>
                        <CheckCircle size={14} color="#10B981" />
                        <Text style={styles.investedText}>Invested</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.businessDescription, settings.darkMode && styles.businessDescriptionDark]}>
                  {opp.description}
                </Text>
                <View style={styles.businessStats}>
                  <View style={styles.businessStatCard}>
                    <Text style={[styles.businessStatLabel, settings.darkMode && styles.businessStatLabelDark]}>
                      Investment
                    </Text>
                    <Text style={[styles.businessStatValue, settings.darkMode && styles.businessStatValueDark]}>
                      ${opp.cost.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.businessStatCard}>
                    <Text style={[styles.businessStatLabel, settings.darkMode && styles.businessStatLabelDark]}>
                      Weekly Income
                    </Text>
                    <Text style={[styles.businessStatValue, styles.businessStatValueIncome, settings.darkMode && styles.businessStatValueDark]}>
                      ${opp.weeklyIncome.toLocaleString()}
                    </Text>
                  </View>
                </View>
                {opp.invested ? (
                  <View style={styles.investedContainer}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.investedContainerGradient}
                    >
                      <CheckCircle size={20} color="#FFF" />
                      <Text style={styles.investedContainerText}>Already Invested</Text>
                    </LinearGradient>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.investButton, gameState.stats.money < opp.cost && styles.investButtonDisabled]}
                    onPress={() => handleInvestInOpportunity(opp.id)}
                    disabled={gameState.stats.money < opp.cost}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={gameState.stats.money < opp.cost ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
                      style={styles.investButtonGradient}
                    >
                      <Text style={styles.investButtonText}>
                        Invest ${opp.cost.toLocaleString()}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </LinearGradient>
            </View>
          </MotiView>
        ))}
      </ScrollView>
    );
  };

  const renderHistory = () => {
    if (travel.travelHistory.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <View style={styles.emptyIconContainer}>
              <History size={64} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            </View>
          </MotiView>
          <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
            No Travel History
          </Text>
          <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
            Your travel history will appear here after you visit destinations.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
        {travel.travelHistory
          .slice()
          .reverse()
          .map((trip, index) => {
            const destination = DESTINATIONS.find(d => d.id === trip.destinationId);
            return (
              <MotiView
                key={`${trip.destinationId}-${trip.week}-${index}`}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 400, delay: index * 50 }}
              >
                <View style={[styles.historyCard, settings.darkMode && styles.historyCardDark]}>
                  <LinearGradient
                    colors={settings.darkMode 
                      ? ['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']
                      : ['rgba(255, 255, 255, 0.95)', 'rgba(249, 250, 251, 0.95)']
                    }
                    style={styles.cardGradient}
                  >
                    <View style={styles.historyHeader}>
                      <View style={styles.historyIconContainer}>
                        <MapPin size={20} color="#3B82F6" />
                      </View>
                      <View style={styles.historyContent}>
                        <Text style={[styles.historyDestination, settings.darkMode && styles.historyDestinationDark]}>
                          {destination?.name || 'Unknown'}
                        </Text>
                        <Text style={[styles.historyLocation, settings.darkMode && styles.historyLocationDark]}>
                          {destination?.country || ''}
                        </Text>
                        <Text style={[styles.historyDate, settings.darkMode && styles.historyDateDark]}>
                          Week {trip.week}, {trip.year}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </MotiView>
            );
          })}
      </ScrollView>
    );
  };

  return (
    <LinearGradient
      colors={settings.darkMode ? ['#0F172A', '#1E293B', '#334155'] : ['#F8FAFC', '#FFFFFF', '#F1F5F9']}
      style={styles.container}
    >
      <View style={[styles.header, settings.darkMode && styles.headerDark]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <ArrowLeft size={24} color={settings.darkMode ? '#F9FAFB' : '#111827'} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Plane size={28} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
          </View>
          <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
            Travel Agency
          </Text>
        </View>
      </View>

      <View style={[styles.tabs, settings.darkMode && styles.tabsDark]}>
        {(['destinations', 'trips', 'business', 'history'] as TabType[]).map((tab) => {
          const icons = {
            destinations: Globe,
            trips: Plane,
            business: Briefcase,
            history: History,
          };
          const Icon = icons[tab];
          const isActive = activeTab === tab;
          
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Icon 
                size={24} 
                color={isActive 
                  ? '#3B82F6' 
                  : (settings.darkMode ? '#9CA3AF' : '#6B7280')
                } 
              />
            </TouchableOpacity>
          );
        })}
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
    paddingHorizontal: scale(20),
    paddingTop: scale(16),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    marginRight: scale(12),
    padding: scale(4),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  headerTitle: {
    fontSize: fontScale(28),
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    gap: scale(8),
  },
  tabsDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    paddingHorizontal: scale(16),
    borderRadius: scale(12),
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  tabText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextDark: {
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingTop: scale(20),
    paddingBottom: scale(32),
  },
  passportCard: {
    borderRadius: scale(16),
    marginBottom: scale(24),
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  passportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(20),
  },
  passportIconContainer: {
    position: 'relative',
    marginRight: scale(16),
  },
  sparkleIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  passportContent: {
    flex: 1,
  },
  passportTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#FFF',
    marginBottom: scale(6),
  },
  passportDescription: {
    fontSize: fontScale(14),
    color: '#E0E7FF',
    marginBottom: scale(12),
    lineHeight: fontScale(20),
  },
  passportPrice: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(8),
  },
  passportPriceText: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFF',
  },
  sectionHeader: {
    marginBottom: scale(20),
  },
  sectionTitle: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  sectionSubtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  sectionSubtitleDark: {
    color: '#9CA3AF',
  },
  destinationCard: {
    borderRadius: scale(16),
    marginBottom: scale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  destinationCardDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardGradient: {
    padding: scale(20),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(12),
  },
  cardHeaderLeft: {
    flex: 1,
  },
  destNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(6),
  },
  destName: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
  },
  destNameDark: {
    color: '#F9FAFB',
  },
  visitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    gap: scale(4),
  },
  visitedText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#10B981',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  destCountry: {
    fontSize: fontScale(14),
    color: '#6B7280',
    fontWeight: '500',
  },
  destCountryDark: {
    color: '#9CA3AF',
  },
  passportRequired: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    gap: scale(4),
  },
  passportRequiredText: {
    fontSize: fontScale(10),
    fontWeight: '600',
    color: '#F59E0B',
  },
  priceTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(10),
    alignItems: 'center',
  },
  priceTagDiscount: {
    backgroundColor: '#F59E0B',
  },
  priceText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: fontScale(16),
  },
  discountBadge: {
    fontSize: fontScale(9),
    fontWeight: '700',
    color: '#FFF',
    marginTop: scale(2),
  },
  description: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(16),
    lineHeight: fontScale(20),
  },
  descriptionDark: {
    color: '#D1D5DB',
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: scale(16),
  },
  benefitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    gap: scale(6),
  },
  benefitHappiness: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  benefitHealth: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  benefitEnergy: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  benefitIntelligence: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  benefitStress: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  benefitText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#374151',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    gap: scale(6),
  },
  durationText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
  },
  durationTextDark: {
    color: '#9CA3AF',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scale(80),
    paddingHorizontal: scale(32),
  },
  emptyIconContainer: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(24),
  },
  emptyStateText: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(8),
    textAlign: 'center',
  },
  emptyStateTextDark: {
    color: '#F9FAFB',
  },
  emptyStateSubtext: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: fontScale(20),
  },
  emptyStateSubtextDark: {
    color: '#9CA3AF',
  },
  tripCard: {
    borderRadius: scale(20),
    overflow: 'hidden',
    marginBottom: scale(16),
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  tripGradient: {
    padding: scale(24),
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(24),
  },
  tripIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(16),
  },
  tripInfo: {
    flex: 1,
  },
  tripDestination: {
    fontSize: fontScale(28),
    fontWeight: '700',
    color: '#FFF',
    marginBottom: scale(6),
  },
  tripLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  tripLocation: {
    fontSize: fontScale(16),
    color: '#E0E7FF',
    fontWeight: '500',
  },
  tripDetails: {
    gap: scale(12),
    marginBottom: scale(24),
  },
  tripDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: scale(16),
    borderRadius: scale(12),
    gap: scale(12),
  },
  tripDetailContent: {
    flex: 1,
  },
  tripDetailLabel: {
    fontSize: fontScale(12),
    color: '#E0E7FF',
    marginBottom: scale(4),
  },
  tripDetailValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFF',
  },
  returnButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: scale(16),
    borderRadius: scale(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  returnButtonText: {
    color: '#FFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  businessCard: {
    borderRadius: scale(16),
    marginBottom: scale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  businessCardDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scale(12),
  },
  businessIconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  businessHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  businessName: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
  },
  businessNameDark: {
    color: '#F9FAFB',
  },
  businessDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(16),
    lineHeight: fontScale(20),
  },
  businessDescriptionDark: {
    color: '#D1D5DB',
  },
  businessStats: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(16),
  },
  businessStatCard: {
    flex: 1,
    backgroundColor: 'rgba(107, 114, 128, 0.05)',
    padding: scale(12),
    borderRadius: scale(10),
  },
  businessStatLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: scale(4),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  businessStatLabelDark: {
    color: '#9CA3AF',
  },
  businessStatValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  businessStatValueIncome: {
    color: '#10B981',
  },
  businessStatValueDark: {
    color: '#F9FAFB',
  },
  investedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    gap: scale(4),
  },
  investedText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#10B981',
  },
  investedContainer: {
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  investedContainerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(14),
    gap: scale(8),
  },
  investedContainerText: {
    color: '#FFF',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  investButton: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginTop: scale(4),
  },
  investButtonDisabled: {
    opacity: 0.5,
  },
  investButtonGradient: {
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    alignItems: 'center',
  },
  investButtonText: {
    color: '#FFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  historyCard: {
    borderRadius: scale(16),
    marginBottom: scale(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  historyCardDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  historyContent: {
    flex: 1,
  },
  historyDestination: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  historyDestinationDark: {
    color: '#F9FAFB',
  },
  historyLocation: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(4),
    fontWeight: '500',
  },
  historyLocationDark: {
    color: '#9CA3AF',
  },
  historyDate: {
    fontSize: fontScale(12),
    color: '#9CA3AF',
  },
  historyDateDark: {
    color: '#6B7280',
  },
});
