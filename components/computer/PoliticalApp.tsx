/**
 * Political App Component
 * 
 * Clean, organized political office management
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import {
  ArrowLeft,
  Vote,
  FileText,
  Handshake,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  HelpCircle,
  Target,
  BarChart3,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { POLITICAL_CAREER, POLITICAL_CAREER_REQUIREMENTS } from '@/lib/careers/political';
import { getAvailablePolicies, Policy, PolicyType } from '@/lib/politics/policies';
import { getWeeksUntilElection, getElectionType } from '@/lib/politics/elections';
import {
  runForOffice,
  enactPolicy,
  lobby,
  joinParty,
  formAlliance,
  campaign,
  hireLobbyist,
  fireLobbyist,
} from '@/contexts/game/actions/PoliticalActions';
import { getAvailableLobbyists, getHiredLobbyists, calculateTotalLobbyistInfluence } from '@/lib/politics/lobbyists';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { getActivePerks } from '@/lib/politics/perks';
import { scale, fontScale } from '@/utils/scaling';

type TabType = 'overview' | 'career' | 'policies' | 'support';

interface PoliticalAppProps {
  onBack: () => void;
}

export default function PoliticalApp({ onBack }: PoliticalAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPolicyType, setSelectedPolicyType] = useState<PolicyType | 'all'>('all');
  const [lobbyAmount, setLobbyAmount] = useState('');
  const [selectedLobbyPolicy, setSelectedLobbyPolicy] = useState<string | null>(null);
  const [campaignAmount, setCampaignAmount] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const { settings } = gameState;

  const politics = gameState.politics || {
    careerLevel: 0,
    approvalRating: 50,
    policyInfluence: 0,
    electionsWon: 0,
    policiesEnacted: [],
    lobbyists: [],
    alliances: [],
    campaignFunds: 0,
    party: undefined,
  };

  // Ensure political career exists
  useEffect(() => {
    const career = gameState.careers.find(c => c.id === 'political');
    if (!career) {
      const newCareer = {
        ...POLITICAL_CAREER,
        level: 0,
        progress: 0,
        applied: false,
        accepted: false,
      };
      setGameState(prev => ({
        ...prev,
        careers: [...(prev.careers || []), newCareer],
      }));
    }
  }, [gameState.careers, setGameState]);

  const career = gameState.careers.find(c => c.id === 'political');
  const currentLevel = career?.level || 0;
  const currentOffice = POLITICAL_CAREER.levels[currentLevel]?.name || 'Not in Office';

  const availablePolicies = useMemo(() => {
    const careerLevel = politics.careerLevel ?? 0;
    const policies = getAvailablePolicies(careerLevel);
    if (selectedPolicyType === 'all') return policies;
    return policies.filter(p => p.type === selectedPolicyType);
  }, [politics.careerLevel, selectedPolicyType]);

  // Get next office to run for
  const getNextOffice = () => {
    const offices = Object.keys(POLITICAL_CAREER_REQUIREMENTS) as (keyof typeof POLITICAL_CAREER_REQUIREMENTS)[];
    const officeLevels: Record<keyof typeof POLITICAL_CAREER_REQUIREMENTS, number> = {
      council_member: 0,
      mayor: 1,
      state_representative: 2,
      governor: 3,
      senator: 4,
      president: 5,
    };
    
    for (const office of offices) {
      const level = officeLevels[office as keyof typeof POLITICAL_CAREER_REQUIREMENTS];
      if (currentLevel < level) {
        const requirements = POLITICAL_CAREER_REQUIREMENTS[office];
        const hasEducation = (id: string) => 
          (gameState.educations || []).some(e => e.id === id && e.completed);
        const hasRequiredEducation = ('education' in requirements && requirements.education && Array.isArray(requirements.education)) 
          ? requirements.education.every(edu => hasEducation(edu))
          : true;
        
        const canRun = gameState.date.age >= requirements.minAge &&
          gameState.stats.reputation >= requirements.minReputation &&
          hasRequiredEducation;
        
        if (canRun) {
          return { office, requirements, canRun: true };
        }
        return { office, requirements, canRun: false };
      }
    }
    return null;
  };

  const nextOffice = getNextOffice();

  const handleRunForOffice = useCallback((office: keyof typeof POLITICAL_CAREER_REQUIREMENTS) => {
    const officeKey = office as 'council_member' | 'mayor' | 'state_representative' | 'governor' | 'senator' | 'president';
    const result = runForOffice(gameState, setGameState, officeKey, { updateMoney });
    if (result.success) {
      saveGame();
      Alert.alert('Success', result.message);
    } else {
      Alert.alert('Failed', result.message);
    }
  }, [gameState, setGameState, saveGame]);

  const handleEnactPolicy = useCallback((policy: Policy) => {
    if (politics.policiesEnacted.includes(policy.id)) {
      Alert.alert('Already Enacted', 'This policy is already in effect.');
      return;
    }

    Alert.alert(
      `Enact ${policy.name}?`,
      `${policy.description}\n\nCost: $${policy.implementationCost.toLocaleString()}\nApproval Impact: ${policy.approvalImpact > 0 ? '+' : ''}${policy.approvalImpact}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enact',
          onPress: () => {
            const result = enactPolicy(gameState, setGameState, policy.id, { updateMoney, updateStats });
            if (result.success) {
              saveGame();
              Alert.alert('Success', result.message);
            } else {
              Alert.alert('Failed', result.message);
            }
          },
        },
      ]
    );
  }, [gameState, setGameState, politics.policiesEnacted, saveGame]);

  const handleLobby = useCallback(() => {
    if (!selectedLobbyPolicy) {
      Alert.alert('No Policy Selected', 'Please select a policy to lobby for first.');
      return;
    }

    const amount = parseInt(lobbyAmount);
    if (isNaN(amount) || amount < 1000) {
      Alert.alert('Invalid Amount', 'Please enter at least $1,000');
      return;
    }

    const result = lobby(gameState, setGameState, selectedLobbyPolicy, amount, { updateMoney });
    if (result.success) {
      saveGame();
      Alert.alert('Success', result.message);
      setLobbyAmount('');
      setSelectedLobbyPolicy(null);
    } else {
      Alert.alert('Failed', result.message);
    }
  }, [gameState, setGameState, lobbyAmount, selectedLobbyPolicy, saveGame]);

  const handleFormAlliance = useCallback((relationshipId: string) => {
    const relationship = gameState.relationships.find(r => r.id === relationshipId);
    if (!relationship) {
      Alert.alert('Error', 'Relationship not found');
      return;
    }
    const result = formAlliance(gameState, setGameState, relationship.id, relationship.name);
    if (result.success) {
      saveGame();
      Alert.alert('Success', result.message);
    } else {
      Alert.alert('Failed', result.message);
    }
  }, [gameState, setGameState, saveGame]);

  const handleJoinParty = useCallback((party: 'democratic' | 'republican' | 'independent') => {
    const partyNames: Record<'democratic' | 'republican' | 'independent', string> = {
      democratic: 'Democratic Party',
      republican: 'Republican Party',
      independent: 'Independent',
    };

    if (politics.party === party) {
      Alert.alert('Already Member', `You are already a member of the ${partyNames[party]}.`);
      return;
    }

    const result = joinParty(gameState, setGameState, party);
    if (result.success) {
      saveGame();
      Alert.alert('Success', result.message);
    } else {
      Alert.alert('Failed', result.message);
    }
  }, [gameState, setGameState, politics.party, saveGame]);

  const handleCampaign = useCallback(() => {
    const amount = parseInt(campaignAmount);
    if (isNaN(amount) || amount < 500) {
      Alert.alert('Invalid Amount', 'Please enter at least $500');
      return;
    }

    const result = campaign(gameState, setGameState, amount, { updateMoney });
    if (result.success) {
      saveGame();
      Alert.alert('Success', result.message);
      setCampaignAmount('');
    } else {
      Alert.alert('Failed', result.message);
    }
  }, [gameState, setGameState, campaignAmount, saveGame]);

  const handleHireLobbyist = useCallback((lobbyistId: string) => {
    const result = hireLobbyist(gameState, setGameState, lobbyistId, { updateMoney });
    if (result.success) {
      saveGame();
      Alert.alert('Success', result.message);
    } else {
      Alert.alert('Failed', result.message);
    }
  }, [gameState, setGameState, saveGame]);

  const handleFireLobbyist = useCallback((lobbyistId: string) => {
    Alert.alert(
      'Fire Lobbyist?',
      'Are you sure you want to fire this lobbyist? You will lose their influence bonus.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fire',
          onPress: () => {
            const result = fireLobbyist(gameState, setGameState, lobbyistId);
            if (result.success) {
              saveGame();
            }
            Alert.alert(result.success ? 'Success' : 'Failed', result.message);
          },
        },
      ]
    );
  }, [gameState, setGameState, saveGame]);

  // Overview Tab - Dashboard with goals and status
  const renderOverview = () => {
    const hiredLobbyistIds = politics.lobbyists.map(l => l.id);
    const totalInfluence = calculateTotalLobbyistInfluence(hiredLobbyistIds);
    const allianceInfluence = (politics.alliances || []).length * 10;

    // Calculate political income
    const { calcWeeklyPassiveIncome } = require('@/lib/economy/passiveIncome');
    const passiveIncome = calcWeeklyPassiveIncome(gameState);
    const weeklyPoliticalSalary = passiveIncome.breakdown.political || 0;

    // Get active perks
    const { getCombinedPerkEffects } = require('@/lib/politics/perks');
    const activePerks = currentLevel > 0 ? getActivePerks(currentLevel) : [];
    const perkEffects = currentLevel > 0 ? getCombinedPerkEffects(currentLevel) : {
      loanInterestReduction: 0,
      businessIncomeBonus: 0,
      realEstateTaxBreak: 0,
      socialMediaFollowerBonus: 0,
      unlockExclusiveOpportunities: false,
      governmentContracts: false,
    };

    // Calculate government contract income
    const { getTotalGovernmentContractBonus } = require('@/lib/politics/governmentContracts');
    const governmentContractIncome = currentLevel > 0 ? getTotalGovernmentContractBonus(gameState) : 0;

    return (
      <ScrollView style={styles.tabContent}>
        {/* Current Status Card */}
        <View style={[styles.infoCard, settings.darkMode && styles.infoCardDark]}>
          <LinearGradient
            colors={settings.darkMode ? ['#1E40AF', '#1E3A8A'] : ['#3B82F6', '#2563EB']}
            style={styles.infoGradient}
          >
            <View style={styles.infoHeader}>
              <Award size={24} color="#FFF" />
              <Text style={styles.infoTitle}>Current Status</Text>
            </View>
            <Text style={styles.currentOffice}>{currentOffice}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Approval</Text>
                <Text style={styles.statValue}>{politics.approvalRating}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Influence</Text>
                <Text style={styles.statValue}>{politics.policyInfluence + totalInfluence + allianceInfluence}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Elections</Text>
                <Text style={styles.statValue}>{politics.electionsWon}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Income Breakdown */}
        {currentLevel > 0 && (
          <View style={[styles.infoCard, settings.darkMode && styles.infoCardDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#059669', '#047857'] : ['#10B981', '#059669']}
              style={styles.infoGradient}
            >
              <View style={styles.infoHeader}>
                <DollarSign size={24} color="#FFF" />
                <Text style={styles.infoTitle}>Weekly Income</Text>
              </View>
              <View style={styles.incomeRow}>
                <Text style={styles.incomeLabel}>Political Salary:</Text>
                <Text style={styles.incomeValue}>${weeklyPoliticalSalary.toLocaleString()}/week</Text>
              </View>
              {governmentContractIncome > 0 && (
                <View style={styles.incomeRow}>
                  <Text style={styles.incomeLabel}>Government Contracts:</Text>
                  <Text style={styles.incomeValue}>+${governmentContractIncome.toLocaleString()}/week</Text>
                </View>
              )}
              <View style={styles.incomeTotal}>
                <Text style={styles.incomeLabel}>Total Political Income:</Text>
                <Text style={styles.incomeValue}>${(weeklyPoliticalSalary + governmentContractIncome).toLocaleString()}/week</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Active Perks */}
        {currentLevel > 0 && activePerks.length > 0 && (
          <View style={[styles.infoCard, settings.darkMode && styles.infoCardDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#7C3AED', '#6D28D9'] : ['#8B5CF6', '#7C3AED']}
              style={styles.infoGradient}
            >
              <View style={styles.infoHeader}>
                <Award size={24} color="#FFF" />
                <Text style={styles.infoTitle}>Active Perks</Text>
              </View>
              <ScrollView style={styles.perksList} nestedScrollEnabled>
                {activePerks.map(perk => (
                  <View key={perk.id} style={styles.perkItem}>
                    <Text style={styles.perkName}>{perk.name}</Text>
                    <Text style={styles.perkDescription}>{perk.description}</Text>
                    {perk.effects.loanInterestReduction && (
                      <Text style={styles.perkEffect}>• {perk.effects.loanInterestReduction}% loan interest reduction</Text>
                    )}
                    {perk.effects.businessIncomeBonus && (
                      <Text style={styles.perkEffect}>• {perk.effects.businessIncomeBonus}% business income bonus</Text>
                    )}
                    {perk.effects.realEstateTaxBreak && (
                      <Text style={styles.perkEffect}>• {perk.effects.realEstateTaxBreak}% real estate tax break</Text>
                    )}
                    {perk.effects.socialMediaFollowerBonus && (
                      <Text style={styles.perkEffect}>• {perk.effects.socialMediaFollowerBonus}% social media follower bonus</Text>
                    )}
                    {perk.effects.governmentContracts && (
                      <Text style={styles.perkEffect}>• Government contracts available</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
              <View style={styles.perksSummary}>
                <Text style={styles.perksSummaryText}>
                  Combined: {perkEffects.loanInterestReduction}% loan reduction, {perkEffects.businessIncomeBonus}% business bonus, {perkEffects.realEstateTaxBreak}% tax break, {perkEffects.socialMediaFollowerBonus}% social bonus
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Goals Section */}
        <View style={[styles.goalsCard, settings.darkMode && styles.goalsCardDark]}>
          <View style={styles.goalsHeader}>
            <Target size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.goalsTitle, settings.darkMode && styles.goalsTitleDark]}>
              Your Goals
            </Text>
          </View>
          
          {currentLevel === 0 ? (
            <View style={styles.goalItem}>
              <Text style={[styles.goalText, settings.darkMode && styles.goalTextDark]}>
                1. Run for Local Council Member
              </Text>
              <Text style={[styles.goalSubtext, settings.darkMode && styles.goalSubtextDark]}>
                Requirements: Age 25+, Reputation 30+, Business Degree
              </Text>
              {nextOffice && (
                <TouchableOpacity
                  style={styles.goalButton}
                  onPress={() => {
                    setActiveTab('career');
                  }}
                >
                  <LinearGradient colors={['#10B981', '#059669'] as const} style={styles.goalButtonGradient}>
                    <Text style={styles.goalButtonText}>View Requirements</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={styles.goalItem}>
                <Text style={[styles.goalText, settings.darkMode && styles.goalTextDark]}>
                  ✓ In Office: {currentOffice}
                </Text>
              </View>
              {nextOffice && (
                <View style={styles.goalItem}>
                  <Text style={[styles.goalText, settings.darkMode && styles.goalTextDark]}>
                    Next: {POLITICAL_CAREER.levels[Object.keys(POLITICAL_CAREER_REQUIREMENTS).indexOf(nextOffice.office as string)]?.name}
                  </Text>
                  {!nextOffice.canRun && (
                    <Text style={[styles.goalSubtext, settings.darkMode && styles.goalSubtextDark]}>
                      Work on meeting requirements
                    </Text>
                  )}
                </View>
              )}
              <View style={styles.goalItem}>
                <Text style={[styles.goalText, settings.darkMode && styles.goalTextDark]}>
                  Maintain approval rating above 50%
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${Math.min(100, politics.approvalRating)}%`, backgroundColor: politics.approvalRating >= 50 ? '#10B981' : '#EF4444' }
                    ]} 
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Quick Actions
        </Text>
        
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionCard, settings.darkMode && styles.quickActionCardDark]}
            onPress={() => setActiveTab('career')}
          >
            <Vote size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.quickActionText, settings.darkMode && styles.quickActionTextDark]}>
              Career
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionCard, settings.darkMode && styles.quickActionCardDark]}
            onPress={() => setActiveTab('policies')}
          >
            <FileText size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.quickActionText, settings.darkMode && styles.quickActionTextDark]}>
              Policies
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionCard, settings.darkMode && styles.quickActionCardDark]}
            onPress={() => setActiveTab('support')}
          >
            <Users size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
            <Text style={[styles.quickActionText, settings.darkMode && styles.quickActionTextDark]}>
              Support
            </Text>
          </TouchableOpacity>
        </View>

        {/* Election Info */}
        {politics.nextElectionWeek && (
          <View style={[styles.infoCard, settings.darkMode && styles.infoCardDark, { marginTop: scale(16) }]}>
            <LinearGradient
              colors={settings.darkMode ? ['#059669', '#047857'] : ['#10B981', '#059669']}
              style={styles.infoGradient}
            >
              <View style={styles.infoHeader}>
                <Clock size={24} color="#FFF" />
                <Text style={styles.infoTitle}>Next Election</Text>
              </View>
              <Text style={[styles.electionText, { color: '#FFF', marginTop: scale(8) }]}>
                {getElectionType(politics.careerLevel as 0 | 1 | 2 | 3 | 4 | 5)}
              </Text>
              <Text style={[styles.electionText, { color: '#FFF', marginTop: scale(4), fontWeight: '600' }]}>
                {getWeeksUntilElection(gameState.weeksLived, politics.nextElectionWeek)} weeks away
              </Text>
            </LinearGradient>
          </View>
        )}
      </ScrollView>
    );
  };

  // Career Tab - Run for office
  const renderCareer = () => {
    return (
      <ScrollView style={styles.tabContent}>
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Run for Office
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Progress through political offices by meeting requirements and winning elections.
        </Text>

        {(Object.keys(POLITICAL_CAREER_REQUIREMENTS) as (keyof typeof POLITICAL_CAREER_REQUIREMENTS)[]).map((office) => {
          const requirements = POLITICAL_CAREER_REQUIREMENTS[office];
          const officeLevel = {
            council_member: 0,
            mayor: 1,
            state_representative: 2,
            governor: 3,
            senator: 4,
            president: 5,
          }[office] || 0;

          const hasEducation = (id: string) => 
            (gameState.educations || []).some(e => e.id === id && e.completed);
          const hasRequiredEducation = ('education' in requirements && requirements.education && Array.isArray(requirements.education)) 
            ? requirements.education.every(edu => hasEducation(edu))
            : true;

          const meetsPreviousLevel = ('previousLevel' in requirements && requirements.previousLevel) 
            ? (() => {
                const previousLevel = requirements.previousLevel;
                if (!previousLevel) return false;
                const previousLevelIndex = POLITICAL_CAREER.levels.findIndex(
                  l => l.name.toLowerCase().includes(previousLevel.split('_')[0])
                );
                const career = gameState.careers.find(c => c.id === 'political');
                const weeksInCurrentLevel = career && career.level !== undefined && career.level > 0 ? career.progress : 0;
                return currentLevel > previousLevelIndex && 
                       weeksInCurrentLevel >= (requirements.minWeeksInPrevious || 0);
              })()
            : true;

          const canRun = (officeLevel === 0 ? currentLevel === 0 : currentLevel < officeLevel) && 
            gameState.date.age >= requirements.minAge &&
            gameState.stats.reputation >= requirements.minReputation &&
            hasRequiredEducation &&
            meetsPreviousLevel;

          const officeName = POLITICAL_CAREER.levels[officeLevel]?.name || office;

          return (
            <TouchableOpacity
              key={office}
              style={[styles.officeCard, settings.darkMode && styles.officeCardDark]}
              onPress={() => {
                const officeKey = office as keyof typeof POLITICAL_CAREER_REQUIREMENTS;
                handleRunForOffice(officeKey);
              }}
              disabled={!canRun}
            >
              <LinearGradient
                colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                style={styles.cardGradient}
              >
                <View style={styles.officeHeader}>
                  <Vote size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                  <Text style={[styles.officeName, settings.darkMode && styles.officeNameDark]}>
                    {officeName}
                  </Text>
                  {currentLevel >= officeLevel && (
                    <CheckCircle size={16} color="#10B981" style={{ marginLeft: 8 }} />
                  )}
                </View>
                <Text style={[styles.officeDescription, settings.darkMode && styles.officeDescriptionDark]}>
                  Age {requirements.minAge}+ • Reputation {requirements.minReputation}+
                  {'education' in requirements && requirements.education && Array.isArray(requirements.education) && ` • ${requirements.education.map(e => e === 'business_degree' ? 'Business Degree' : e).join(', ')}`}
                </Text>
                {!canRun && currentLevel < officeLevel && (
                  <View style={{ marginTop: scale(8) }}>
                    {gameState.date.age < requirements.minAge && (
                      <Text style={[styles.requirementText, settings.darkMode && styles.requirementTextDark]}>
                        ❌Œ Age: {Math.floor(gameState.date.age)}/{requirements.minAge}
                      </Text>
                    )}
                    {gameState.stats.reputation < requirements.minReputation && (
                      <Text style={[styles.requirementText, settings.darkMode && styles.requirementTextDark]}>
                        ❌Œ Reputation: {gameState.stats.reputation}/{requirements.minReputation}
                      </Text>
                    )}
                    {'education' in requirements && requirements.education && Array.isArray(requirements.education) && !hasRequiredEducation && (
                      <Text style={[styles.requirementText, settings.darkMode && styles.requirementTextDark]}>
                        ❌Œ Education: Missing {requirements.education.filter(e => !hasEducation(e)).map(e => e === 'business_degree' ? 'Business Degree' : e).join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Policies Tab - Enact policies and lobby
  const renderPolicies = () => {
    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.filterRow}>
          {(['all', 'economic', 'social', 'environmental', 'criminal'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                selectedPolicyType === type && styles.filterButtonActive,
                settings.darkMode && styles.filterButtonDark,
              ]}
              onPress={() => setSelectedPolicyType(type)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedPolicyType === type && styles.filterButtonTextActive,
                  settings.darkMode && styles.filterButtonTextDark,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {availablePolicies.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={settings.darkMode ? '#FFFFFF' : '#FFFFFF'} />
            <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
              No policies available
            </Text>
            <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
              {politics.careerLevel === 0 
                ? 'Run for office to unlock policies'
                : 'No policies match the selected filter'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark, { marginTop: scale(16) }]}>
              Enact Policies
            </Text>
            {availablePolicies.map(policy => {
              const isEnacted = (politics.policiesEnacted || []).includes(policy.id);
              return (
                <TouchableOpacity
                  key={policy.id}
                  style={[styles.policyCard, settings.darkMode && styles.policyCardDark]}
                  onPress={() => !isEnacted && handleEnactPolicy(policy)}
                  disabled={isEnacted}
                >
                  <LinearGradient
                    colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                    style={styles.cardGradient}
                  >
                    <View style={styles.policyHeader}>
                      <FileText size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                      <Text style={[styles.policyName, settings.darkMode && styles.policyNameDark]}>
                        {policy.name}
                      </Text>
                      {isEnacted && (
                        <CheckCircle size={16} color="#10B981" style={{ marginLeft: 8 }} />
                      )}
                    </View>
                    <Text style={[styles.policyDescription, settings.darkMode && styles.policyDescriptionDark]}>
                      {policy.description}
                    </Text>
                    <View style={styles.policyStats}>
                      <View style={styles.policyStat}>
                        <Text style={[styles.policyStatLabel, settings.darkMode && styles.policyStatLabelDark]}>
                          Approval:
                        </Text>
                        <Text
                          style={[
                            styles.policyStatValue,
                            policy.approvalImpact > 0 ? styles.positive : styles.negative,
                          ]}
                        >
                          {policy.approvalImpact > 0 ? '+' : ''}{policy.approvalImpact}
                        </Text>
                      </View>
                      <View style={styles.policyStat}>
                        <Text style={[styles.policyStatLabel, settings.darkMode && styles.policyStatLabelDark]}>
                          Cost:
                        </Text>
                        <Text style={[styles.policyStatValue, settings.darkMode && styles.policyStatValueDark]}>
                          ${policy.implementationCost.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    {isEnacted && (
                      <Text style={[styles.enactedText, settings.darkMode && styles.enactedTextDark]}>
                        ✓ Enacted
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            {/* Lobbying Section */}
            <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark, { marginTop: scale(24) }]}>
              Lobby for Policies
            </Text>
            <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
              Spend money to increase policy influence and make policies easier to pass.
            </Text>

            {availablePolicies.map(policy => (
              <TouchableOpacity
                key={policy.id}
                style={[
                  styles.policyCard,
                  settings.darkMode && styles.policyCardDark,
                  selectedLobbyPolicy === policy.id && styles.policyCardSelected
                ]}
                onPress={() => setSelectedLobbyPolicy(policy.id)}
              >
                <LinearGradient
                  colors={selectedLobbyPolicy === policy.id
                    ? (settings.darkMode ? ['#1E40AF', '#1E3A8A'] : ['#DBEAFE', '#BFDBFE'])
                    : (settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6'])
                  }
                  style={styles.cardGradient}
                >
                  <View style={styles.policyHeader}>
                    <Handshake size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.policyName, settings.darkMode && styles.policyNameDark]}>
                      {policy.name}
                    </Text>
                    {selectedLobbyPolicy === policy.id && (
                      <CheckCircle size={16} color="#10B981" style={{ marginLeft: 8 }} />
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}

            {selectedLobbyPolicy && (
              <View style={[styles.inputCard, settings.darkMode && styles.inputCardDark, { marginTop: scale(16) }]}>
                <Text style={[styles.inputLabel, settings.darkMode && styles.inputLabelDark]}>
                  Lobbying Amount (min $1,000)
                </Text>
                <TextInput
                  style={[styles.input, settings.darkMode && styles.inputDark]}
                  value={lobbyAmount}
                  onChangeText={setLobbyAmount}
                  placeholder="Enter amount"
                  placeholderTextColor={settings.darkMode ? '#FFFFFF80' : '#00000060'}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.campaignButton, { marginTop: scale(12) }]}
                  onPress={handleLobby}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    style={styles.campaignButtonGradient}
                  >
                    <Text style={styles.campaignButtonText}>Lobby for {availablePolicies.find(p => p.id === selectedLobbyPolicy)?.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  // Support Tab - Parties, Alliances, Lobbyists, Campaign
  const renderSupport = () => {
    const hiredLobbyistIds = politics.lobbyists.map(l => l.id);
    const availableLobbyists = getAvailableLobbyists(hiredLobbyistIds);
    const hiredLobbyistsFull = getHiredLobbyists(hiredLobbyistIds);
    const totalInfluence = calculateTotalLobbyistInfluence(hiredLobbyistIds);

    return (
      <ScrollView style={styles.tabContent}>
        {/* Parties */}
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark]}>
          Join a Party
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Join a political party to align with like-minded politicians.
        </Text>

        {(['democratic', 'republican', 'independent'] as const).map(partyId => {
          const partyNames = {
            democratic: 'Democratic Party',
            republican: 'Republican Party',
            independent: 'Independent',
          };
          const partyColors: Record<string, readonly [string, string]> = {
            democratic: ['#3B82F6', '#2563EB'] as const,
            republican: ['#EF4444', '#DC2626'] as const,
            independent: ['#6B7280', '#4B5563'] as const,
          };

          return (
            <TouchableOpacity
              key={partyId}
              style={[styles.partyCard, settings.darkMode && styles.partyCardDark]}
              onPress={() => handleJoinParty(partyId)}
            >
              <LinearGradient colors={partyColors[partyId]} style={styles.partyGradient}>
                <View style={styles.partyHeader}>
                  <Users size={24} color="#FFF" />
                  <Text style={styles.partyName}>{partyNames[partyId]}</Text>
                  {politics.party === partyId && (
                    <CheckCircle size={20} color="#FFF" style={{ marginLeft: 8 }} />
                  )}
                </View>
                {politics.party === partyId && (
                  <Text style={styles.partyMember}>Current Party</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        {/* Alliances */}
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark, { marginTop: scale(24) }]}>
          Alliances
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Form alliances with friends, partners, or spouse to gain +10% policy influence each.
        </Text>

        {politics.alliances.length > 0 && (
          <>
            {politics.alliances.map(alliance => (
              <View
                key={alliance.id}
                style={[styles.allianceCard, settings.darkMode && styles.allianceCardDark]}
              >
                <LinearGradient
                  colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                  style={styles.cardGradient}
                >
                  <View style={styles.allianceHeader}>
                    <Handshake size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.allianceName, settings.darkMode && styles.allianceNameDark]}>
                      {alliance.name}
                    </Text>
                  </View>
                  <Text style={[styles.allianceInfluence, settings.darkMode && styles.allianceInfluenceDark]}>
                    +{alliance.influence}% influence
                  </Text>
                </LinearGradient>
              </View>
            ))}
          </>
        )}

        {(() => {
          const availableRelationships = (gameState.relationships || []).filter(
            rel => rel.type === 'friend' || rel.type === 'partner' || rel.type === 'spouse'
          );

          if (availableRelationships.length > 0) {
            return (
              <>
                {availableRelationships.map(relationship => {
                  const alreadyAllied = (politics.alliances || []).some(a => a.characterId === relationship.id);
                  return (
                    <TouchableOpacity
                      key={relationship.id}
                      style={[styles.allianceCard, settings.darkMode && styles.allianceCardDark]}
                      onPress={() => !alreadyAllied && handleFormAlliance(relationship.id)}
                      disabled={alreadyAllied}
                    >
                      <LinearGradient
                        colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                        style={styles.cardGradient}
                      >
                        <View style={styles.allianceHeader}>
                          <Users size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                          <Text style={[styles.allianceName, settings.darkMode && styles.allianceNameDark]}>
                            {relationship.name}
                          </Text>
                          {alreadyAllied && (
                            <CheckCircle size={16} color="#10B981" style={{ marginLeft: 8 }} />
                          )}
                        </View>
                        <Text style={[styles.allianceInfluence, settings.darkMode && styles.allianceInfluenceDark]}>
                          {alreadyAllied ? '✓ Allied' : 'Tap to form alliance (+10% influence)'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          } else if ((politics.alliances || []).length === 0) {
            return (
              <View style={styles.emptyState}>
                <Handshake size={48} color={settings.darkMode ? '#FFFFFF' : '#FFFFFF'} />
                <Text style={[styles.emptyStateText, settings.darkMode && styles.emptyStateTextDark]}>
                  No relationships available
                </Text>
                <Text style={[styles.emptyStateSubtext, settings.darkMode && styles.emptyStateSubtextDark]}>
                  Build relationships in the Social app to form alliances
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* Lobbyists */}
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark, { marginTop: scale(24) }]}>
          Lobbyists
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Hire lobbyists to increase your policy influence. Total: +{totalInfluence}%
        </Text>

        {hiredLobbyistsFull.length > 0 && (
          <>
            {hiredLobbyistsFull.map(lobbyist => (
              <View
                key={lobbyist.id}
                style={[styles.policyCard, settings.darkMode && styles.policyCardDark]}
              >
                <LinearGradient
                  colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                  style={styles.cardGradient}
                >
                  <View style={styles.policyHeader}>
                    <Handshake size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.policyName, settings.darkMode && styles.policyNameDark]}>
                      {lobbyist.name}
                    </Text>
                  </View>
                  <Text style={[styles.policyDescription, settings.darkMode && styles.policyDescriptionDark]}>
                    +{lobbyist.influence}% influence • {lobbyist.specialty === 'all' ? 'All Policies' : lobbyist.specialty}
                  </Text>
                  <TouchableOpacity
                    style={[styles.campaignButton, { marginTop: scale(12) }]}
                    onPress={() => handleFireLobbyist(lobbyist.id)}
                  >
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      style={styles.campaignButtonGradient}
                    >
                      <Text style={styles.campaignButtonText}>Fire</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ))}
          </>
        )}

        {availableLobbyists.length > 0 && (
          <>
            {availableLobbyists.map(lobbyist => (
              <TouchableOpacity
                key={lobbyist.id}
                style={[styles.policyCard, settings.darkMode && styles.policyCardDark]}
                onPress={() => handleHireLobbyist(lobbyist.id)}
              >
                <LinearGradient
                  colors={settings.darkMode ? ['#374151', '#1F2937'] : ['#F9FAFB', '#F3F4F6']}
                  style={styles.cardGradient}
                >
                  <View style={styles.policyHeader}>
                    <Handshake size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                    <Text style={[styles.policyName, settings.darkMode && styles.policyNameDark]}>
                      {lobbyist.name}
                    </Text>
                  </View>
                  <Text style={[styles.policyDescription, settings.darkMode && styles.policyDescriptionDark]}>
                    {lobbyist.description}
                  </Text>
                  <View style={styles.policyStats}>
                    <View style={styles.policyStat}>
                      <Text style={[styles.policyStatLabel, settings.darkMode && styles.policyStatLabelDark]}>
                        Influence:
                      </Text>
                      <Text style={[styles.policyStatValue, styles.positive]}>
                        +{lobbyist.influence}%
                      </Text>
                    </View>
                    <View style={styles.policyStat}>
                      <Text style={[styles.policyStatLabel, settings.darkMode && styles.policyStatLabelDark]}>
                        Cost:
                      </Text>
                      <Text style={[styles.policyStatValue, settings.darkMode && styles.policyStatValueDark]}>
                        ${lobbyist.cost.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Campaign */}
        <Text style={[styles.sectionTitle, settings.darkMode && styles.sectionTitleDark, { marginTop: scale(24) }]}>
          Campaign Spending
        </Text>
        <Text style={[styles.sectionDescription, settings.darkMode && styles.sectionDescriptionDark]}>
          Spend money to increase approval rating. Minimum $500.
        </Text>

        <View style={[styles.inputCard, settings.darkMode && styles.inputCardDark]}>
          <Text style={[styles.inputLabel, settings.darkMode && styles.inputLabelDark]}>
            Campaign Amount (min $500)
          </Text>
          <TextInput
            style={[styles.input, settings.darkMode && styles.inputDark]}
            value={campaignAmount}
            onChangeText={setCampaignAmount}
            placeholder="Enter amount"
            placeholderTextColor={settings.darkMode ? '#FFFFFF80' : '#00000060'}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={styles.campaignButton}
            onPress={handleCampaign}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.campaignButtonGradient}
            >
              <Text style={styles.campaignButtonText}>Spend on Campaign</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
          <Vote size={28} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
          <Text style={[styles.headerTitle, settings.darkMode && styles.headerTitleDark]}>
            Political Office
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowHelpModal(true)} style={styles.helpButton}>
          <HelpCircle size={24} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} color={activeTab === 'overview' ? '#3B82F6' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'overview' && (settings.darkMode ? styles.activeTabTextDark : styles.activeTabText),
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'career' && styles.activeTab]}
          onPress={() => setActiveTab('career')}
        >
          <Award size={18} color={activeTab === 'career' ? '#3B82F6' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'career' && (settings.darkMode ? styles.activeTabTextDark : styles.activeTabText),
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            Career
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'policies' && styles.activeTab]}
          onPress={() => setActiveTab('policies')}
        >
          <FileText size={18} color={activeTab === 'policies' ? '#3B82F6' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'policies' && (settings.darkMode ? styles.activeTabTextDark : styles.activeTabText),
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            Policies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'support' && styles.activeTab]}
          onPress={() => setActiveTab('support')}
        >
          <Users size={18} color={activeTab === 'support' ? '#3B82F6' : (settings.darkMode ? '#9CA3AF' : '#6B7280')} />
          <Text
            style={[
              styles.tabText,
              activeTab === 'support' && (settings.darkMode ? styles.activeTabTextDark : styles.activeTabText),
              settings.darkMode && styles.tabTextDark,
            ]}
          >
            Support
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'career' && renderCareer()}
      {activeTab === 'policies' && renderPolicies()}
      {activeTab === 'support' && renderSupport()}

      <Modal
        visible={showHelpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
            <LinearGradient
              colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
              style={styles.modalGradient}
            >
              <View style={[styles.modalHeader, settings.darkMode && styles.modalHeaderDark]}>
                <View style={styles.modalHeaderLeft}>
                  <HelpCircle size={28} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
                  <Text style={[styles.modalTitle, settings.darkMode && styles.modalTitleDark]}>
                    Political Office Guide
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowHelpModal(false)}>
                  <XCircle size={24} color={settings.darkMode ? '#FFFFFF' : '#FFFFFF'} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.helpSection}>
                  <Text style={[styles.helpSectionTitle, settings.darkMode && styles.helpSectionTitleDark]}>
                    🎯 Goal
                  </Text>
                  <Text style={[styles.helpText, settings.darkMode && styles.helpTextDark]}>
                    Progress through political offices from Local Council Member to President. Win elections, enact policies, and build your political influence.
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={[styles.helpSectionTitle, settings.darkMode && styles.helpSectionTitleDark]}>
                    📄 Overview Tab
                  </Text>
                  <Text style={[styles.helpText, settings.darkMode && styles.helpTextDark]}>
                    See your current status, goals, and quick actions. Check your approval rating and next election date.
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={[styles.helpSectionTitle, settings.darkMode && styles.helpSectionTitleDark]}>
                    🏛️ Career Tab
                  </Text>
                  <Text style={[styles.helpText, settings.darkMode && styles.helpTextDark]}>
                    Run for political offices. Each office has requirements (age, reputation, education). Meet them to unlock the next level.
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={[styles.helpSectionTitle, settings.darkMode && styles.helpSectionTitleDark]}>
                    📜 Policies Tab
                  </Text>
                  <Text style={[styles.helpText, settings.darkMode && styles.helpTextDark]}>
                    Enact policies to affect your stats and approval rating. Lobby for policies by spending money to increase your influence.
                  </Text>
                </View>

                <View style={styles.helpSection}>
                  <Text style={[styles.helpSectionTitle, settings.darkMode && styles.helpSectionTitleDark]}>
                    🤝 Support Tab
                  </Text>
                  <Text style={[styles.helpText, settings.darkMode && styles.helpTextDark]}>
                    Join a party, form alliances with relationships, hire lobbyists, and spend on campaigns to boost your political power.
                  </Text>
                </View>
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    padding: scale(16),
    paddingTop: scale(48),
  },
  backButton: {
    padding: scale(8),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleDark: {
    color: '#F9FAFB',
  },
  helpButton: {
    padding: scale(8),
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    paddingBottom: scale(8),
    gap: scale(8),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: scale(10),
    borderRadius: scale(8),
  },
  activeTab: {
    backgroundColor: '#DBEAFE',
  },
  tabText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextDark: {
    color: '#FFFFFF',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  activeTabTextDark: {
    color: '#3B82F6',
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabContent: {
    flex: 1,
    padding: scale(16),
  },
  infoCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(16),
  },
  infoCardDark: {
    // Same styling
  },
  infoGradient: {
    padding: scale(16),
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  infoTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFF',
  },
  currentOffice: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: scale(12),
  },
  statsRow: {
    flexDirection: 'row',
    gap: scale(16),
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: fontScale(12),
    color: '#DBEAFE',
    marginBottom: scale(4),
  },
  statValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#FFF',
  },
  goalsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(16),
  },
  goalsCardDark: {
    backgroundColor: '#374151',
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  goalsTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
  },
  goalsTitleDark: {
    color: '#F9FAFB',
  },
  goalItem: {
    marginBottom: scale(12),
  },
  goalText: {
    fontSize: fontScale(14),
    fontWeight: '500',
    color: '#111827',
    marginBottom: scale(4),
  },
  goalTextDark: {
    color: '#F9FAFB',
  },
  goalSubtext: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  goalSubtextDark: {
    color: '#FFFFFF',
  },
  goalButton: {
    borderRadius: scale(8),
    overflow: 'hidden',
    marginTop: scale(4),
  },
  goalButtonGradient: {
    padding: scale(12),
    alignItems: 'center',
  },
  goalButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: fontScale(14),
  },
  progressBar: {
    height: scale(8),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(4),
    overflow: 'hidden',
    marginTop: scale(8),
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  quickActions: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(16),
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(16),
    alignItems: 'center',
    gap: scale(8),
  },
  quickActionCardDark: {
    backgroundColor: '#374151',
  },
  quickActionText: {
    fontSize: fontScale(12),
    fontWeight: '500',
    color: '#111827',
  },
  quickActionTextDark: {
    color: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '600',
    color: '#111827',
    marginBottom: scale(8),
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  sectionDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(16),
  },
  sectionDescriptionDark: {
    color: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginBottom: scale(16),
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(8),
    backgroundColor: '#F3F4F6',
  },
  filterButtonDark: {
    backgroundColor: '#374151',
  },
  filterButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  filterButtonText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextDark: {
    color: '#FFFFFF',
  },
  filterButtonTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  officeCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(12),
  },
  officeCardDark: {
    // Same styling
  },
  cardGradient: {
    padding: scale(16),
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  officeName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  officeNameDark: {
    color: '#F9FAFB',
  },
  officeDescription: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  officeDescriptionDark: {
    color: '#FFFFFF',
  },
  requirementText: {
    fontSize: fontScale(12),
    color: '#EF4444',
    marginTop: scale(4),
  },
  requirementTextDark: {
    color: '#FFFFFF',
  },
  policyCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(12),
  },
  policyCardDark: {
    // Same styling
  },
  policyCardSelected: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  policyName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  policyNameDark: {
    color: '#F9FAFB',
  },
  policyDescription: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  policyDescriptionDark: {
    color: '#FFFFFF',
  },
  policyStats: {
    flexDirection: 'row',
    gap: scale(16),
    marginTop: scale(8),
  },
  policyStat: {
    flex: 1,
  },
  policyStatLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  policyStatLabelDark: {
    color: '#FFFFFF',
  },
  policyStatValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  policyStatValueDark: {
    color: '#F9FAFB',
  },
  positive: {
    color: '#10B981',
  },
  negative: {
    color: '#EF4444',
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  incomeLabel: {
    fontSize: fontScale(14),
    color: '#DBEAFE',
  },
  incomeValue: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFF',
  },
  incomeTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(8),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  perksList: {
    maxHeight: scale(200),
    marginBottom: scale(12),
  },
  perkItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: scale(8),
    padding: scale(12),
    marginBottom: scale(8),
  },
  perkName: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#FFF',
    marginBottom: scale(4),
  },
  perkDescription: {
    fontSize: fontScale(12),
    color: '#DBEAFE',
    marginBottom: scale(4),
  },
  perkEffect: {
    fontSize: fontScale(11),
    color: '#DBEAFE',
    marginTop: scale(2),
  },
  perksSummary: {
    marginTop: scale(8),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  perksSummaryText: {
    fontSize: fontScale(11),
    color: '#DBEAFE',
    fontStyle: 'italic',
  },
  enactedText: {
    fontSize: fontScale(12),
    color: '#10B981',
    fontWeight: '600',
    marginTop: scale(8),
  },
  enactedTextDark: {
    color: '#10B981',
  },
  inputCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(16),
  },
  inputCardDark: {
    backgroundColor: '#374151',
  },
  inputLabel: {
    fontSize: fontScale(14),
    fontWeight: '500',
    color: '#111827',
    marginBottom: scale(8),
  },
  inputLabelDark: {
    color: '#F9FAFB',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(8),
    padding: scale(12),
    fontSize: fontScale(16),
    color: '#111827',
    marginBottom: scale(12),
  },
  inputDark: {
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
  },
  campaignButton: {
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  campaignButtonGradient: {
    padding: scale(14),
    alignItems: 'center',
  },
  campaignButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: fontScale(14),
  },
  partyCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(12),
  },
  partyCardDark: {
    // Same styling
  },
  partyGradient: {
    padding: scale(16),
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  partyName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  partyMember: {
    fontSize: fontScale(12),
    color: '#FFF',
    marginTop: scale(8),
  },
  allianceCard: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(12),
  },
  allianceCardDark: {
    // Same styling
  },
  allianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  allianceName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  allianceNameDark: {
    color: '#F9FAFB',
  },
  allianceInfluence: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  allianceInfluenceDark: {
    color: '#FFFFFF',
  },
  allianceDate: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginTop: scale(4),
  },
  allianceDateDark: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: scale(32),
  },
  emptyStateText: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptyStateTextDark: {
    color: '#F9FAFB',
  },
  emptyStateSubtext: {
    fontSize: fontScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyStateSubtextDark: {
    color: '#FFFFFF',
  },
  electionText: {
    fontSize: fontScale(14),
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  modalContentDark: {
    // Same styling
  },
  modalGradient: {
    padding: scale(20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  modalHeaderDark: {
    // Same styling
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  modalTitle: {
    fontSize: fontScale(20),
    fontWeight: 'bold',
    color: '#111827',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalBody: {
    maxHeight: scale(400),
  },
  helpSection: {
    marginBottom: scale(20),
  },
  helpSectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#111827',
    marginBottom: scale(8),
  },
  helpSectionTitleDark: {
    color: '#F9FAFB',
  },
  helpText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    lineHeight: scale(20),
  },
  helpTextDark: {
    color: '#FFFFFF',
  },
  requirementList: {
    marginTop: scale(8),
  },
  requirementItem: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(4),
  },
  requirementItemDark: {
    color: '#FFFFFF',
  },
});

