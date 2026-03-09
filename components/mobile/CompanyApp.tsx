import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { ArrowLeft, Building2, Users, DollarSign, Settings, Plus, Minus, Lock, GraduationCap, X, Star, Zap, FlaskConical } from 'lucide-react-native';
import { useGame, Company } from '@/contexts/GameContext';
import { createCompany, buyCompanyUpgrade, addWorker, removeWorker, sellCompany } from '@/contexts/game/company';
import * as RDActions from '@/contexts/game/actions/RDActions';
import { LAB_TYPES, LabType } from '@/lib/rd/labs';
import { getAvailableTechnologies, getTechnologyById } from '@/lib/rd/technologyTree';
import { getActiveCompetitions, canEnterCompetition } from '@/lib/rd/competitions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { getShadow } from '@/utils/shadow';

interface CompanyAppProps {
  onBack: () => void;
}

const companyTypes = [
  { 
    id: 'factory', 
    name: 'Factory', 
    emoji: 'ðŸ­', 
    baseIncome: 2000, 
    workerSalary: 500, 
    cost: 50000,
    description: 'Manufacturing and production facility',
    color: ['#1F2937', '#111827']
  },
  { 
    id: 'ai', 
    name: 'AI Company', 
    emoji: 'ðŸ¤–', 
    baseIncome: 2000, 
    workerSalary: 2000, 
    cost: 90000,
    description: 'Artificial intelligence and machine learning',
    color: ['#1F2937', '#111827']
  },
  { 
    id: 'restaurant', 
    name: 'Restaurant', 
    emoji: 'ðŸ½ï¸', 
    baseIncome: 2000, 
    workerSalary: 400, 
    cost: 130000,
    description: 'Fine dining and culinary excellence',
    color: ['#1F2937', '#111827']
  },
  { 
    id: 'realestate', 
    name: 'Real Estate', 
    emoji: 'ðŸ¢', 
    baseIncome: 2000, 
    workerSalary: 1500, 
    cost: 200000,
    description: 'Property development and management',
    color: ['#1F2937', '#111827']
  },
  { 
    id: 'bank', 
    name: 'Bank', 
    emoji: 'ðŸ¦', 
    baseIncome: 2000, 
    workerSalary: 5000, 
    cost: 2000000,
    description: 'Financial services and banking',
    color: ['#1F2937', '#111827']
  },
];

// Company-specific upgrades that match the logic
const getCompanyUpgrades = (companyType: string) => {
  const upgrades = {
    factory: [
      {
        id: 'machinery',
        name: 'Better Machinery',
        description: 'Increase production efficiency',
        cost: 10000,
        weeklyIncomeBonus: 500,
        maxLevel: 5,
        icon: 'âš™ï¸',
        color: ['#F59E0B', '#D97706']
      },
      {
        id: 'workers',
        name: 'More Workers',
        description: 'Hire additional staff',
        cost: 15000,
        weeklyIncomeBonus: 800,
        maxLevel: 3,
        icon: 'ðŸ‘¥',
        color: ['#10B981', '#059669']
      },
      {
        id: 'automation',
        name: 'Assembly Line',
        description: 'Automated production line',
        cost: 25000,
        weeklyIncomeBonus: 1200,
        maxLevel: 4,
        icon: 'ðŸ­',
        color: ['#6B7280', '#4B5563']
      },
      {
        id: 'quality_control',
        name: 'Quality Control',
        description: 'Advanced quality assurance',
        cost: 20000,
        weeklyIncomeBonus: 1000,
        maxLevel: 3,
        icon: 'âœ…',
        color: ['#10B981', '#059669']
      },
      {
        id: 'warehouse',
        name: 'Smart Warehouse',
        description: 'Automated inventory management',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        maxLevel: 3,
        icon: 'ðŸ“¦',
        color: ['#8B5CF6', '#7C3AED']
      },
      {
        id: 'safety',
        name: 'Safety Systems',
        description: 'Workplace safety improvements',
        cost: 18000,
        weeklyIncomeBonus: 800,
        maxLevel: 4,
        icon: 'ðŸ›¡ï¸',
        color: ['#EF4444', '#DC2626']
      }
    ],
    ai: [
      {
        id: 'servers',
        name: 'Better Servers',
        description: 'Upgrade computing power',
        cost: 25000,
        weeklyIncomeBonus: 1200,
        maxLevel: 4,
        icon: 'ðŸ–¥ï¸',
        color: ['#8B5CF6', '#7C3AED']
      },
      {
        id: 'algorithms',
        name: 'Advanced Algorithms',
        description: 'Improve AI capabilities',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        maxLevel: 3,
        icon: 'ðŸ§ ',
        color: ['#3B82F6', '#1D4ED8']
      },
      {
        id: 'gpu_cluster',
        name: 'GPU Cluster',
        description: 'Faster AI training',
        cost: 50000,
        weeklyIncomeBonus: 2500,
        maxLevel: 3,
        icon: 'ðŸŽ®',
        color: ['#F59E0B', '#D97706']
      },
      {
        id: 'data_center',
        name: 'Data Center',
        description: 'Scale operations',
        cost: 75000,
        weeklyIncomeBonus: 3500,
        maxLevel: 2,
        icon: 'ðŸ¢',
        color: ['#10B981', '#059669']
      },
      {
        id: 'ai_researchers',
        name: 'AI Researchers',
        description: 'Cutting-edge research team',
        cost: 40000,
        weeklyIncomeBonus: 2000,
        maxLevel: 4,
        icon: 'ðŸ‘¨â€ðŸ”¬',
        color: ['#EF4444', '#DC2626']
      },
      {
        id: 'machine_learning',
        name: 'ML Platform',
        description: 'Machine learning infrastructure',
        cost: 60000,
        weeklyIncomeBonus: 3000,
        maxLevel: 3,
        icon: 'ðŸ¤–',
        color: ['#8B5CF6', '#7C3AED']
      }
    ],
    restaurant: [
      {
        id: 'kitchen',
        name: 'Kitchen Upgrade',
        description: 'Modernize kitchen equipment',
        cost: 20000,
        weeklyIncomeBonus: 1000,
        maxLevel: 4,
        icon: 'ðŸ³',
        color: ['#EF4444', '#DC2626']
      },
      {
        id: 'staff',
        name: 'Professional Staff',
        description: 'Hire experienced chefs',
        cost: 18000,
        weeklyIncomeBonus: 900,
        maxLevel: 3,
        icon: 'ðŸ‘¨â€ðŸ³',
        color: ['#F59E0B', '#D97706']
      },
      {
        id: 'delivery_service',
        name: 'Delivery Service',
        description: 'Expand customer reach',
        cost: 25000,
        weeklyIncomeBonus: 1200,
        maxLevel: 3,
        icon: 'ðŸšš',
        color: ['#10B981', '#059669']
      },
      {
        id: 'michelin_chef',
        name: 'Michelin Chef',
        description: 'Premium dining experience',
        cost: 40000,
        weeklyIncomeBonus: 2000,
        maxLevel: 2,
        icon: 'ðŸ‘¨â€ðŸ³',
        color: ['#8B5CF6', '#7C3AED']
      },
      {
        id: 'interior_design',
        name: 'Interior Design',
        description: 'Upscale dining atmosphere',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        maxLevel: 3,
        icon: 'ðŸŽ¨',
        color: ['#F59E0B', '#D97706']
      },
      {
        id: 'wine_cellar',
        name: 'Wine Cellar',
        description: 'Premium wine selection',
        cost: 35000,
        weeklyIncomeBonus: 1800,
        maxLevel: 2,
        icon: 'ðŸ·',
        color: ['#EF4444', '#DC2626']
      }
    ],
    realestate: [
      {
        id: 'properties',
        name: 'More Properties',
        description: 'Expand property portfolio',
        cost: 50000,
        weeklyIncomeBonus: 2000,
        maxLevel: 5,
        icon: 'ðŸ˜ï¸',
        color: ['#10B981', '#059669']
      },
      {
        id: 'management',
        name: 'Property Management',
        description: 'Improve property management',
        cost: 30000,
        weeklyIncomeBonus: 1500,
        maxLevel: 3,
        icon: 'ðŸ“‹',
        color: ['#3B82F6', '#1D4ED8']
      },
      {
        id: 'property_portfolio',
        name: 'Property Portfolio',
        description: 'More rental properties',
        cost: 75000,
        weeklyIncomeBonus: 3000,
        maxLevel: 4,
        icon: 'ðŸ¢',
        color: ['#F59E0B', '#D97706']
      },
      {
        id: 'commercial_real_estate',
        name: 'Commercial Properties',
        description: 'Higher value investments',
        cost: 100000,
        weeklyIncomeBonus: 4000,
        maxLevel: 3,
        icon: 'ðŸ¬',
        color: ['#8B5CF6', '#7C3AED']
      },
      {
        id: 'property_management',
        name: 'Property Management',
        description: 'Professional management',
        cost: 40000,
        weeklyIncomeBonus: 2000,
        maxLevel: 3,
        icon: 'ðŸ‘¥',
        color: ['#10B981', '#059669']
      },
      {
        id: 'luxury_developments',
        name: 'Luxury Developments',
        description: 'High-end property development',
        cost: 150000,
        weeklyIncomeBonus: 6000,
        maxLevel: 2,
        icon: 'ðŸ°',
        color: ['#EF4444', '#DC2626']
      }
    ],
    bank: [
      {
        id: 'technology',
        name: 'Banking Technology',
        description: 'Upgrade banking systems',
        cost: 100000,
        weeklyIncomeBonus: 5000,
        maxLevel: 4,
        icon: 'ðŸ’»',
        color: ['#3B82F6', '#1D4ED8']
      },
      {
        id: 'services',
        name: 'Financial Services',
        description: 'Expand financial services',
        cost: 80000,
        weeklyIncomeBonus: 4000,
        maxLevel: 3,
        icon: 'ðŸ’°',
        color: ['#10B981', '#059669']
      },
      {
        id: 'investment_division',
        name: 'Investment Division',
        description: 'Wealth management services',
        cost: 200000,
        weeklyIncomeBonus: 10000,
        maxLevel: 3,
        icon: 'ðŸ“ˆ',
        color: ['#F59E0B', '#D97706']
      },
      {
        id: 'international_banking',
        name: 'International Banking',
        description: 'Global operations',
        cost: 300000,
        weeklyIncomeBonus: 15000,
        maxLevel: 2,
        icon: 'ðŸŒ',
        color: ['#8B5CF6', '#7C3AED']
      },
      {
        id: 'fintech_integration',
        name: 'FinTech Integration',
        description: 'Digital banking solutions',
        cost: 150000,
        weeklyIncomeBonus: 7500,
        maxLevel: 3,
        icon: 'ðŸ“±',
        color: ['#EF4444', '#DC2626']
      },
      {
        id: 'private_banking',
        name: 'Private Banking',
        description: 'Exclusive client services',
        cost: 250000,
        weeklyIncomeBonus: 12000,
        maxLevel: 2,
        icon: 'ðŸ‘”',
        color: ['#10B981', '#059669']
      }
    ]
  };
  
  return upgrades[companyType as keyof typeof upgrades] || [];
};

export default function CompanyApp({ onBack }: CompanyAppProps) {
  const { gameState, setGameState, saveGame, createFamilyBusiness, enterCompetition } = useGame();
  const [activeTab, setActiveTab] = useState<'companies' | 'create'>('companies');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [pendingSelectCompanyId, setPendingSelectCompanyId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [companyModalTab, setCompanyModalTab] = useState<'upgrades' | 'workers' | 'rd'>('upgrades');
  
  // Modal states
  const [showEducationRequiredModal, setShowEducationRequiredModal] = useState(false);
  const [showCompanyCreatedModal, setShowCompanyCreatedModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showInsufficientFundsModal, setShowInsufficientFundsModal] = useState(false);
  const [showWorkerHiredModal, setShowWorkerHiredModal] = useState(false);
  const [showNoWorkersModal, setShowNoWorkersModal] = useState(false);
  const [showWorkerFiredModal, setShowWorkerFiredModal] = useState(false);
  const [showMaxLevelModal, setShowMaxLevelModal] = useState(false);
  const [showUpgradeCompleteModal, setShowUpgradeCompleteModal] = useState(false);
  const [showSellCompanyModal, setShowSellCompanyModal] = useState(false);
  const [showCompanySoldModal, setShowCompanySoldModal] = useState(false);
  const [modalData, setModalData] = useState<any>({});

  const companies: Company[] = gameState.companies || [];
  const cash = gameState.stats?.money || 0;

  // Keep selectedCompany in sync with GameContext updates without mutating during provider updates
  const selectedCompanyId = selectedCompany?.id;
  useEffect(() => {
    if (!selectedCompanyId) return;
    const updated = (gameState.companies || []).find(c => c.id === selectedCompanyId);
    if (updated && updated !== selectedCompany) {
      setSelectedCompany(updated);
    }
  }, [gameState.companies, selectedCompanyId]);

  // Select newly created company after state updates
  useEffect(() => {
    if (!pendingSelectCompanyId) return;
    const newCompany = (gameState.companies || []).find(c => c.id === pendingSelectCompanyId);
    if (newCompany) {
      setSelectedCompany(newCompany);
      setPendingSelectCompanyId(null);
    }
  }, [gameState.companies, pendingSelectCompanyId]);

  // Check if user has completed Entrepreneurship Course
  const hasEntrepreneurshipEducation = gameState.educations?.find(
    e => e.id === 'entrepreneurship'
  )?.completed;

  const totalWeeklyIncome = companies.reduce((total, company) => total + company.weeklyIncome, 0);
  const totalEmployees = companies.reduce((total, company) => total + company.employees, 0);

  const handleCreateCompany = useCallback((typeId: string) => {
    if (!hasEntrepreneurshipEducation) {
      setShowEducationRequiredModal(true);
      return;
    }

    // Check if this is the first company ever created
    const isFirstCompany = (gameState.companies || []).length === 0;

    const result = createCompany(gameState, setGameState, typeId);

    if (result.success) {
      saveGame();
      // Switch to companies tab and select the new company
      setActiveTab('companies');
      // Store the company ID to select it - the actual company object will be available in state after re-render
      setPendingSelectCompanyId(typeId);
      setModalData({ companyName: companyTypes.find(t => t.id === typeId)?.name });
      // Only show modal on first company creation
      if (isFirstCompany) {
        setShowCompanyCreatedModal(true);
      }
    } else {
      setModalData({ errorMessage: result.message || 'Failed to create company' });
      setShowErrorModal(true);
    }
  }, [gameState, setGameState, saveGame, hasEntrepreneurshipEducation]);

  const handleHireWorker = useCallback((company: Company) => {
    if (gameState.stats.money < company.workerSalary) {
      setModalData({ requiredAmount: company.workerSalary });
      setShowInsufficientFundsModal(true);
      return;
    }
    
    // Check if this is the first worker for this company
    const isFirstWorker = company.employees === 0;
    
    addWorker(gameState, setGameState, company.id);
    saveGame();
    setModalData({ companyName: company.name, newEmployeeCount: company.employees + 1 });
    // Only show modal on first worker hire
    if (isFirstWorker) {
      setShowWorkerHiredModal(true);
    }
  }, [gameState, setGameState, saveGame]);

  const handleFireWorker = useCallback((company: Company) => {
    if (company.employees <= 0) {
      setShowNoWorkersModal(true);
      return;
    }

    removeWorker(gameState, setGameState, company.id);
    saveGame();
    setModalData({ companyName: company.name, newEmployeeCount: company.employees - 1 });
    setShowWorkerFiredModal(true);
  }, [gameState, setGameState, saveGame]);

  const handleUpgrade = useCallback((company: Company, upgradeId: string) => {
    const companyUpgrades = getCompanyUpgrades(company.type);
    const upgradeDef = companyUpgrades.find(u => u.id === upgradeId);
    if (!upgradeDef) return;

    const existingUpgrade = company.upgrades.find(u => u.id === upgradeId);
    const currentLevel = existingUpgrade?.level || 0;
    
    if (currentLevel >= upgradeDef.maxLevel) {
      setShowMaxLevelModal(true);
      return;
    }

    const costMultiplier = 1.5;
    const nextLevelCost = currentLevel === 0 
      ? upgradeDef.cost 
      : Math.round(upgradeDef.cost * Math.pow(costMultiplier, currentLevel));
    
    if (gameState.stats.money < nextLevelCost) {
      setModalData({ requiredAmount: nextLevelCost, upgradeName: upgradeDef.name });
      setShowInsufficientFundsModal(true);
      return;
    }

    buyCompanyUpgrade(gameState, setGameState, upgradeId, company.id);
    saveGame();
    // selectedCompany is synced via useEffect above once GameContext updates
  }, [gameState, setGameState, saveGame]);

  const handleSellCompany = useCallback((company: Company) => {
    setModalData({ 
      companyName: company.name,
      onConfirm: () => {
        const result = sellCompany(gameState, setGameState, company.id);
        if (result.success) {
          saveGame();
          setModalData({ 
            companyName: company.name, 
            sellValue: result.sellValue 
          });
          setShowCompanySoldModal(true);
        } else {
          setModalData({ errorMessage: result.message || 'Failed to sell company' });
          setShowErrorModal(true);
        }
      }
    });
    setShowSellCompanyModal(true);
  }, [gameState, setGameState, saveGame]);

  const handleCreateFamilyBusiness = useCallback((company: Company) => {
    const cost = 1000000;
    if (gameState.stats.money < cost) {
      setModalData({ requiredAmount: cost, upgradeName: 'Family Business Status' });
      setShowInsufficientFundsModal(true);
      return;
    }
    
    createFamilyBusiness(company.id);
    saveGame();
    Alert.alert('Success', `${company.name} is now a Family Business! It will be passed down to future generations.`);
  }, [gameState.stats.money, createFamilyBusiness, saveGame]);

  const getCompanyEmoji = (type: string) => {
    const companyType = companyTypes.find(t => t.id === type);
    return companyType?.emoji || 'ðŸ¢';
  };

  const getCompanyTypeName = (type: string) => {
    const companyType = companyTypes.find(t => t.id === type);
    return companyType?.name || 'Company';
  };


  const renderNoEducationState = () => (
    <View style={styles.noEducationContainer}>
      <LinearGradient
        colors={['#1F2937', '#111827']}
        style={styles.noEducationCard}
      >
        <View style={styles.lockIconContainer}>
          <Lock size={48} color={gameState.settings?.darkMode ? "#FFFFFF" : "#9CA3AF"} />
        </View>
        <Text style={styles.noEducationTitle}>Education Required</Text>
        <Text style={styles.noEducationMessage}>
          You need to complete the Entrepreneurship Course before you can start your own company.
        </Text>
        <View style={styles.educationInfo}>
          <GraduationCap size={20} color="#3B82F6" />
          <Text style={styles.educationInfoText}>
            Visit the Education app to enroll in the Entrepreneurship Course
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderRDLabTab = (company: Company) => {
    const rdLab = company.rdLab;
    const unlockedTechs = company.unlockedTechnologies || [];
    const patents = company.patents || [];
    const activePatents = patents.filter(p => p.duration > 0);
    const availableTechs = getAvailableTechnologies(company.type, unlockedTechs);
    const activeProjects = rdLab?.researchProjects.filter(p => !p.completed) || [];

    return (
      <View>
        {/* Lab Status */}
        {!rdLab ? (
          <View style={styles.rdLabCard}>
            <Text style={[styles.rdLabTitle, gameState.settings.darkMode && styles.textDark]}>No R&D Lab</Text>
            <Text style={[styles.rdLabDescription, gameState.settings.darkMode && styles.rdLabDescriptionDark]}>
              Build an R&D lab to start researching new technologies
            </Text>
            {(['basic', 'advanced', 'cutting_edge'] as LabType[]).map((labType) => {
              const cost = LAB_TYPES[labType].cost;
              const canAfford = gameState.stats.money >= cost;
              return (
                <TouchableOpacity
                  key={labType}
                  style={[styles.rdLabBuildButton, !canAfford && styles.rdLabBuildButtonDisabled]}
                  onPress={() => {
                    const result = RDActions.buildRDLab(gameState, setGameState, company.id, labType, { updateMoney });
                    if (result.success) {
                      Alert.alert('Success', result.message);
                      saveGame();
                    } else {
                      Alert.alert('Error', result.message);
                    }
                  }}
                  disabled={!canAfford}
                >
                  <Text style={styles.rdLabBuildButtonText}>
                    Build {LAB_TYPES[labType].name} - ${cost.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <>
            <View style={styles.rdLabCard}>
              <Text style={[styles.rdLabTitle, gameState.settings.darkMode && styles.textDark]}>
                {LAB_TYPES[rdLab.type].name}
              </Text>
              <Text style={[styles.rdLabDescription, gameState.settings.darkMode && styles.rdLabDescriptionDark]}>
                Max Projects: {LAB_TYPES[rdLab.type].maxConcurrentProjects} | 
                Speed: {LAB_TYPES[rdLab.type].researchSpeedMultiplier}x
              </Text>
            </View>

            {/* Active Research Projects */}
            {activeProjects.length > 0 && (
              <>
                <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.textDark]}>Active Research</Text>
                {activeProjects.map((project) => {
                  const tech = getTechnologyById(project.technologyId);
                  const weeksRemaining = project.duration - ((gameState.weeksLived || 0) - project.startWeek);
                  const progress = Math.min(100, (((gameState.weeksLived || 0) - project.startWeek) / project.duration) * 100);
                  return (
                    <View key={project.id} style={styles.rdProjectCard}>
                      <Text style={[styles.rdProjectName, gameState.settings.darkMode && styles.textDark]}>
                        {tech?.name || project.technologyId}
                      </Text>
                      <Text style={[styles.rdProjectProgress, gameState.settings.darkMode && styles.rdProjectProgressDark]}>
                        {weeksRemaining} weeks remaining ({Math.round(progress)}%)
                      </Text>
                      {weeksRemaining <= 0 && (
                        <TouchableOpacity
                          style={styles.rdCompleteButton}
                          onPress={() => {
                            const result = RDActions.completeResearch(gameState, setGameState, company.id, project.id);
                            if (result.success) {
                              Alert.alert('Success', result.message);
                              if (result.patentOpportunity) {
                                Alert.alert('Patent Opportunity!', 'You can file a patent for this technology!');
                              }
                              saveGame();
                            } else {
                              Alert.alert('Error', result.message);
                            }
                          }}
                        >
                          <Text style={styles.rdCompleteButtonText}>Complete Research</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Available Technologies */}
            {availableTechs.length > 0 && (
              <>
                <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.textDark]}>Available Technologies</Text>
                {availableTechs.map((tech) => {
                  const canStart = activeProjects.length < LAB_TYPES[rdLab.type].maxConcurrentProjects;
                  const canAfford = gameState.stats.money >= tech.researchCost;
                  return (
                    <View key={tech.id} style={styles.rdTechCard}>
                      <Text style={[styles.rdTechName, gameState.settings.darkMode && styles.textDark]}>{tech.name}</Text>
                      <Text style={[styles.rdTechDescription, gameState.settings.darkMode && styles.rdTechDescriptionDark]}>
                        {tech.description}
                      </Text>
                      <Text style={[styles.rdTechCost, gameState.settings.darkMode && styles.rdTechCostDark]}>
                        Cost: ${tech.researchCost.toLocaleString()} | Duration: {tech.researchTime} weeks
                      </Text>
                      <TouchableOpacity
                        style={[styles.rdStartButton, (!canStart || !canAfford) && styles.rdStartButtonDisabled]}
                        onPress={() => {
                          const result = RDActions.startResearch(gameState, setGameState, company.id, tech.id, { updateMoney });
                          if (result.success) {
                            Alert.alert('Success', result.message);
                            saveGame();
                          } else {
                            Alert.alert('Error', result.message);
                          }
                        }}
                        disabled={!canStart || !canAfford}
                      >
                        <Text style={styles.rdStartButtonText}>Start Research</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            {/* Active Patents */}
            {activePatents.length > 0 && (
              <>
                <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.textDark]}>Active Patents</Text>
                {activePatents.map((patent) => (
                  <View key={patent.id} style={styles.rdPatentCard}>
                    <Text style={[styles.rdPatentName, gameState.settings.darkMode && styles.textDark]}>{patent.name}</Text>
                    <Text style={[styles.rdPatentIncome, gameState.settings.darkMode && styles.rdPatentIncomeDark]}>
                      ${patent.weeklyIncome.toLocaleString()}/week | {patent.duration} weeks remaining
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Unlocked Technologies */}
            {unlockedTechs.length > 0 && (
              <>
                <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.textDark]}>Unlocked Technologies</Text>
                {unlockedTechs.map((techId) => {
                  const tech = getTechnologyById(techId);
                  const hasPatent = activePatents.some(p => p.technologyId === techId);
                  return (
                    <View key={techId} style={styles.rdUnlockedCard}>
                      <Text style={[styles.rdUnlockedName, gameState.settings.darkMode && styles.textDark]}>
                        {tech?.name || techId}
                      </Text>
                      {!hasPatent && (
                        <TouchableOpacity
                          style={styles.rdPatentButton}
                          onPress={() => {
                            const result = RDActions.filePatent(gameState, setGameState, company.id, techId, { updateMoney });
                            if (result.success) {
                              Alert.alert('Success', result.message);
                              saveGame();
                            } else {
                              Alert.alert('Error', result.message);
                            }
                          }}
                        >
                          <Text style={styles.rdPatentButtonText}>File Patent</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Competitions */}
            {rdLab && (
              <>
                <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.textDark]}>Innovation Competitions</Text>
                {(() => {
                  const activeCompetitions = getActiveCompetitions(gameState.weeksLived || 0);
                  const competitionHistory = company.competitionHistory || [];

                  return activeCompetitions.map((competition) => {
                    const canEnter = canEnterCompetition(competition, company);
                    const alreadyEntered = competitionHistory.some(
                      entry => entry.competitionId === competition.id &&
                               entry.entryWeek === (gameState.weeksLived || 0) &&
                               !entry.completed
                    );
                    const currentEntry = competitionHistory.find(
                      entry => entry.competitionId === competition.id && !entry.completed
                    );
                    const completedEntries = competitionHistory.filter(
                      entry => entry.competitionId === competition.id && entry.completed
                    );

                    return (
                      <View key={competition.id} style={styles.rdCompetitionCard}>
                        <Text style={[styles.rdCompetitionName, gameState.settings.darkMode && styles.textDark]}>
                          {competition.name}
                        </Text>
                        <Text style={[styles.rdCompetitionDescription, gameState.settings.darkMode && styles.rdCompetitionDescriptionDark]}>
                          {competition.description}
                        </Text>
                        <Text style={[styles.rdCompetitionPrizes, gameState.settings.darkMode && styles.textDark]}>
                          Prizes: 1st ${competition.prizes.first.toLocaleString()} | 
                          2nd ${competition.prizes.second.toLocaleString()} | 
                          3rd ${competition.prizes.third.toLocaleString()}
                        </Text>
                        <Text style={[styles.rdCompetitionCost, gameState.settings.darkMode && styles.textDark]}>
                          Entry Cost: ${competition.entryCost.toLocaleString()}
                        </Text>
                        
                        {currentEntry && (
                          <View style={styles.rdCompetitionStatus}>
                            <Text style={[styles.rdCompetitionStatusText, gameState.settings.darkMode && styles.textDark]}>
                              Entered! Results at week {currentEntry.endWeek} (Current: {gameState.week})
                            </Text>
                            <Text style={[styles.rdCompetitionScore, gameState.settings.darkMode && styles.rdCompetitionScoreDark]}>
                              Your Score: {currentEntry.score}
                            </Text>
                          </View>
                        )}

                        {completedEntries.length > 0 && (
                          <View style={styles.rdCompetitionHistory}>
                            <Text style={[styles.rdCompetitionHistoryTitle, gameState.settings.darkMode && styles.textDark]}>
                              Previous Results:
                            </Text>
                            {completedEntries.map((entry, idx) => (
                              <Text key={idx} style={[styles.rdCompetitionHistoryText, gameState.settings.darkMode && styles.rdCompetitionHistoryTextDark]}>
                                Week {entry.entryWeek}: Rank {entry.rank} 
                                {entry.prize ? ` - Won $${entry.prize.toLocaleString()}` : ''}
                              </Text>
                            ))}
                          </View>
                        )}

                        {!currentEntry && !alreadyEntered && (
                          <TouchableOpacity
                            style={[
                              styles.rdCompetitionButton, 
                              (!canEnter || gameState.stats.money < competition.entryCost) && styles.rdCompetitionButtonDisabled
                            ]}
                            onPress={() => {
                              const result = enterCompetition(company.id, competition.id);
                              if (result.success) {
                                Alert.alert('Success', result.message);
                                saveGame();
                              } else {
                                Alert.alert('Error', result.message);
                              }
                            }}
                            disabled={!canEnter || gameState.stats.money < competition.entryCost}
                          >
                            <Text style={styles.rdCompetitionButtonText}>
                              {!canEnter ? 'Requirements Not Met' : 
                               gameState.stats.money < competition.entryCost ? 'Insufficient Funds' : 
                               'Enter Competition'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  });
                })()}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  const renderCompanyCard = (company: Company) => {
    return (
      <View key={company.id} style={styles.companyCard}>
        <View style={styles.companyCardContent}>
          <View style={styles.companyHeader}>
            <View style={styles.companyInfo}>
              <View style={styles.companyEmojiContainer}>
                <Text style={styles.companyEmoji}>{getCompanyEmoji(company.type)}</Text>
              </View>
              <View style={styles.companyDetails}>
                <Text style={styles.companyName}>{company.name}</Text>
                <Text style={[styles.companyType, gameState.settings?.darkMode && styles.companyTypeDark]}>{getCompanyTypeName(company.type)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => {
                setSelectedCompany(company);
                setShowUpgradeModal(true);
              }}
            >
              <Settings size={18} color={gameState.settings?.darkMode ? "#FFFFFF" : "#9CA3AF"} />
            </TouchableOpacity>
          </View>

          <View style={styles.companyStats}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <DollarSign size={14} color="#10B981" />
              </View>
              <Text style={styles.statText}>${company.weeklyIncome.toLocaleString()}/week</Text>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Users size={14} color="#3B82F6" />
              </View>
              <Text style={styles.statText}>{company.employees} employees</Text>
            </View>
          </View>

          <View style={styles.companyActions}>
            <TouchableOpacity 
              style={[styles.actionButton, gameState.stats.money < company.workerSalary && styles.actionButtonDisabled]} 
              onPress={() => handleHireWorker(company)}
              disabled={gameState.stats.money < company.workerSalary}
            >
              <Plus size={14} color={gameState.stats.money >= company.workerSalary ? "#10B981" : (gameState.settings?.darkMode ? "#FFFFFF" : "#6B7280")} />
              <Text style={[styles.actionButtonText, gameState.stats.money < company.workerSalary && (gameState.settings?.darkMode ? styles.actionButtonTextDisabledDark : styles.actionButtonTextDisabled)]}>
                Hire (${company.workerSalary.toLocaleString()})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, company.employees <= 0 && styles.actionButtonDisabled]} 
              onPress={() => handleFireWorker(company)}
              disabled={company.employees <= 0}
            >
              <Minus size={14} color={company.employees > 0 ? "#F59E0B" : (gameState.settings?.darkMode ? "#FFFFFF" : "#6B7280")} />
              <Text style={[styles.actionButtonText, company.employees <= 0 && (gameState.settings?.darkMode ? styles.actionButtonTextDisabledDark : styles.actionButtonTextDisabled)]}>Fire</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButtonSecondary} 
              onPress={() => handleSellCompany(company)}
            >
              <DollarSign size={14} color="#EF4444" />
              <Text style={styles.actionButtonTextSecondary}>Sell</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Companies</Text>
        <TouchableOpacity 
          style={[styles.createButton, !hasEntrepreneurshipEducation && styles.disabledButton]} 
          onPress={() => setActiveTab('create')}
          disabled={!hasEntrepreneurshipEducation}
        >
          <Plus size={24} color={hasEntrepreneurshipEducation ? "#FFFFFF" : "#6B7280"} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Stats Summary */}
        <View style={styles.summaryContainer}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.summaryCard}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Building2 size={20} color="#3B82F6" />
                <Text style={styles.summaryLabel}>Companies</Text>
                <Text style={styles.summaryValue}>{companies.length}</Text>
              </View>
              <View style={styles.summaryItem}>
                <DollarSign size={20} color="#10B981" />
                <Text style={styles.summaryLabel}>Weekly Income</Text>
                <Text style={styles.summaryValue}>${totalWeeklyIncome.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Users size={20} color="#F59E0B" />
                <Text style={styles.summaryLabel}>Employees</Text>
                <Text style={styles.summaryValue}>{totalEmployees}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'companies' && styles.activeTab]}
            onPress={() => setActiveTab('companies')}
          >
            <Text style={[styles.tabText, gameState.settings?.darkMode && styles.tabTextDark, activeTab === 'companies' && styles.activeTabText]}>
              My Companies
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'create' && styles.activeTab]}
            onPress={() => setActiveTab('create')}
          >
            <Text style={[styles.tabText, gameState.settings?.darkMode && styles.tabTextDark, activeTab === 'create' && styles.activeTabText]}>
              Create New
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'companies' ? (
          <View style={styles.companiesContainer}>
            {companies.length === 0 ? (
              <View style={styles.emptyState}>
                <Building2 size={48} color={gameState.settings?.darkMode ? "#FFFFFF" : "#6B7280"} />
                <Text style={styles.emptyStateTitle}>No Companies Yet</Text>
                <Text style={[styles.emptyStateMessage, gameState.settings?.darkMode && styles.emptyStateMessageDark]}>
                  {hasEntrepreneurshipEducation 
                    ? "Create your first company to start earning passive income!"
                    : "Complete the Entrepreneurship Course to unlock company creation."
                  }
                </Text>
              </View>
            ) : (
              companies.map(renderCompanyCard)
            )}
          </View>
        ) : (
          <View style={styles.createContainer}>
            {!hasEntrepreneurshipEducation ? (
              renderNoEducationState()
            ) : (
              <View style={styles.companyTypesContainer}>
                {companyTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={styles.companyTypeCard}
                    onPress={() => handleCreateCompany(type.id)}
                  >
                    <View style={styles.companyTypeCardContent}>
                      <View style={styles.companyTypeEmojiContainer}>
                        <Text style={styles.companyTypeEmoji}>{type.emoji}</Text>
                      </View>
                      <Text style={styles.companyTypeName}>{type.name}</Text>
                      <Text style={[styles.companyTypeDescription, gameState.settings?.darkMode && styles.companyTypeDescriptionDark]}>{type.description}</Text>
                      <View style={styles.companyTypeStats}>
                        <View style={styles.companyTypeStat}>
                          <View style={styles.companyTypeStatIconContainer}>
                            <DollarSign size={14} color="#10B981" />
                          </View>
                          <Text style={styles.companyTypeStatText}>${type.baseIncome.toLocaleString()}/week</Text>
                        </View>
                        <View style={styles.companyTypeStat}>
                          <View style={styles.companyTypeStatIconContainer}>
                            <Users size={14} color="#3B82F6" />
                          </View>
                          <Text style={styles.companyTypeStatText}>${type.workerSalary.toLocaleString()}/worker</Text>
                        </View>
                      </View>
                      <View style={styles.companyTypePrice}>
                        <Text style={[styles.companyTypePriceLabel, gameState.settings?.darkMode && styles.companyTypePriceLabelDark]}>Cost:</Text>
                        <Text style={styles.companyTypePriceValue}>${type.cost.toLocaleString()}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Company Management Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitleEmoji}>{selectedCompany && getCompanyEmoji(selectedCompany.type)}</Text>
                <Text style={styles.modalTitle}>
                  {selectedCompany?.name} Management
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowUpgradeModal(false)}
                accessibilityLabel="Close management modal"
                accessibilityRole="button"
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {selectedCompany && (
                <>
                  {/* Company Stats */}
                  <View style={styles.modalStatsContainer}>
                    <View style={styles.modalStatsCard}>
                      <View style={styles.modalStatsRow}>
                        <View style={styles.modalStatItem}>
                          <View style={styles.modalStatIconWrapper}>
                            <DollarSign size={18} color="#10B981" />
                          </View>
                          <Text style={styles.modalStatLabel}>Weekly Income</Text>
                          <Text style={styles.modalStatValue}>${selectedCompany.weeklyIncome.toLocaleString()}</Text>
                        </View>
                        <View style={styles.modalStatItem}>
                          <View style={styles.modalStatIconWrapper}>
                            <Users size={18} color="#3B82F6" />
                          </View>
                          <Text style={styles.modalStatLabel}>Employees</Text>
                          <Text style={styles.modalStatValue}>{selectedCompany.employees}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Family Business Status */}
                  {!(gameState.familyBusinesses?.some(fb => fb.companyId === selectedCompany.id)) ? (
                    <TouchableOpacity
                      style={{
                        backgroundColor: 'rgba(124, 58, 237, 0.2)',
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: '#8B5CF6',
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8
                      }}
                      onPress={() => handleCreateFamilyBusiness(selectedCompany)}
                      accessibilityLabel="Make this a family business"
                      accessibilityHint="Costs $1,000,000. Provides legacy benefits."
                      accessibilityRole="button"
                    >
                      <Star size={20} color="#A78BFA" />
                      <Text style={{ color: '#A78BFA', fontWeight: '600', fontSize: 14 }}>
                        Make Family Business ($1M)
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 20,
                      borderWidth: 1,
                      borderColor: '#10B981',
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8
                    }}>
                      <Star size={16} color="#10B981" />
                      <Text style={{ color: '#10B981', fontWeight: '600', fontSize: 14 }}>
                        Family Business
                      </Text>
                    </View>
                  )}

                  {/* Modal Tabs */}
                  <View style={styles.modalTabsContainer}>
                    <TouchableOpacity
                      style={[styles.modalTab, companyModalTab === 'upgrades' && styles.modalTabActive]}
                      onPress={() => setCompanyModalTab('upgrades')}
                    >
                      <Settings size={16} color={companyModalTab === 'upgrades' ? '#3B82F6' : (gameState.settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
                      <Text style={[styles.modalTabText, gameState.settings?.darkMode && styles.modalTabTextDark, companyModalTab === 'upgrades' && styles.modalTabTextActive]}>
                        Upgrades
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalTab, companyModalTab === 'workers' && styles.modalTabActive]}
                      onPress={() => setCompanyModalTab('workers')}
                    >
                      <Users size={16} color={companyModalTab === 'workers' ? '#3B82F6' : (gameState.settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
                      <Text style={[styles.modalTabText, gameState.settings?.darkMode && styles.modalTabTextDark, companyModalTab === 'workers' && styles.modalTabTextActive]}>
                        Workers
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalTab, companyModalTab === 'rd' && styles.modalTabActive]}
                      onPress={() => setCompanyModalTab('rd')}
                    >
                      <FlaskConical size={16} color={companyModalTab === 'rd' ? '#3B82F6' : (gameState.settings?.darkMode ? '#FFFFFF' : '#6B7280')} />
                      <Text style={[styles.modalTabText, gameState.settings?.darkMode && styles.modalTabTextDark, companyModalTab === 'rd' && styles.modalTabTextActive]}>
                        R&D Lab
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {companyModalTab === 'upgrades' && (
                    <>
                      {/* Upgrades */}
                      <Text style={styles.modalSectionTitle}>Available Upgrades</Text>
                      {getCompanyUpgrades(selectedCompany.type).map((upgrade) => {
                    const companyUpgrade = selectedCompany.upgrades.find(u => u.id === upgrade.id);
                    const currentLevel = companyUpgrade?.level || 0;
                    const isMaxLevel = currentLevel >= upgrade.maxLevel;
                    const costMultiplier = 1.5;
                    const nextLevelCost = currentLevel === 0 
                      ? upgrade.cost 
                      : Math.round(upgrade.cost * Math.pow(costMultiplier, currentLevel));
                    const canAfford = gameState.stats.money >= nextLevelCost;
                    
                    return (
                      <View key={upgrade.id} style={styles.modalUpgradeCard}>
                        <View style={[styles.modalUpgradeCardContent, isMaxLevel && styles.modalUpgradeCardMaxLevel]}>
                          <View style={styles.modalUpgradeHeader}>
                            <View style={styles.modalUpgradeIconContainer}>
                              <Text style={styles.modalUpgradeIcon}>{upgrade.icon}</Text>
                            </View>
                            <View style={styles.modalUpgradeInfo}>
                              <View style={styles.modalUpgradeTitleRow}>
                                <Text style={styles.modalUpgradeName}>{upgrade.name}</Text>
                                <View style={[styles.modalUpgradeLevel, isMaxLevel && styles.modalUpgradeLevelMax]}>
                                  <Text style={styles.modalUpgradeLevelText}>{currentLevel}/{upgrade.maxLevel}</Text>
                                </View>
                              </View>
                              <Text style={styles.modalUpgradeDescription}>{upgrade.description}</Text>
                            </View>
                          </View>

                          <View style={styles.modalUpgradeStats}>
                            <View style={styles.modalUpgradeStat}>
                              <Star size={12} color="#F59E0B" />
                              <Text style={styles.modalUpgradeStatText}>
                                +${upgrade.weeklyIncomeBonus * currentLevel}/week
                              </Text>
                            </View>
                            <View style={styles.modalUpgradeStat}>
                              <Zap size={12} color="#3B82F6" />
                              <Text style={styles.modalUpgradeStatText}>
                                Level {currentLevel}
                              </Text>
                            </View>
                          </View>

                          {!isMaxLevel && (
                            <TouchableOpacity
                              style={[styles.modalUpgradeButton, !canAfford && styles.modalUpgradeButtonDisabled]}
                              onPress={() => handleUpgrade(selectedCompany, upgrade.id)}
                              disabled={!canAfford}
                              accessibilityLabel={`${currentLevel === 0 ? 'Purchase' : 'Upgrade'} ${upgrade.name}`}
                              accessibilityHint={`Cost $${nextLevelCost}. Increases weekly income by $${upgrade.weeklyIncomeBonus}.`}
                              accessibilityRole="button"
                              accessibilityState={{ disabled: !canAfford }}
                            >
                              <Text style={[styles.modalUpgradeButtonText, !canAfford && (gameState.settings?.darkMode ? styles.modalUpgradeButtonTextDisabledDark : styles.modalUpgradeButtonTextDisabled)]}>
                                {currentLevel === 0 ? 'Purchase' : 'Upgrade'} - ${nextLevelCost.toLocaleString()}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {isMaxLevel && (
                            <View style={styles.modalMaxLevelBadge}>
                              <Text style={styles.modalMaxLevelText}>MAX LEVEL</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                    </>
                  )}

                  {companyModalTab === 'workers' && (
                    <>
                      {/* Workers section */}
                      <Text style={styles.modalSectionTitle}>Workers</Text>
                      <View style={styles.modalStatsCard}>
                        <View style={styles.modalStatsRow}>
                          <View style={styles.modalStatItem}>
                            <View style={styles.modalStatIconWrapper}>
                              <Users size={18} color="#3B82F6" />
                            </View>
                            <Text style={styles.modalStatLabel}>Current Employees</Text>
                            <Text style={styles.modalStatValue}>{selectedCompany.employees}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.modalUpgradeCard}>
                        <View style={styles.modalUpgradeCardContent}>
                          <View style={styles.modalUpgradeHeader}>
                            <View style={styles.modalUpgradeIconContainer}>
                              <Text style={styles.modalUpgradeIcon}>ðŸ‘¥</Text>
                            </View>
                            <View style={styles.modalUpgradeInfo}>
                              <Text style={styles.modalUpgradeName}>Hire Worker</Text>
                              <Text style={styles.modalUpgradeDescription}>
                                Add a worker to increase production
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[styles.modalUpgradeButton, gameState.stats.money < selectedCompany.workerSalary && styles.modalUpgradeButtonDisabled]}
                            onPress={() => handleHireWorker(selectedCompany)}
                            disabled={gameState.stats.money < selectedCompany.workerSalary || selectedCompany.employees >= 10}
                          >
                            <Text style={[styles.modalUpgradeButtonText, gameState.stats.money < selectedCompany.workerSalary && (gameState.settings?.darkMode ? styles.modalUpgradeButtonTextDisabledDark : styles.modalUpgradeButtonTextDisabled)]}>
                              Hire - ${selectedCompany.workerSalary.toLocaleString()}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {selectedCompany.employees > 0 && (
                        <View style={styles.modalUpgradeCard}>
                          <View style={styles.modalUpgradeCardContent}>
                            <View style={styles.modalUpgradeHeader}>
                              <View style={styles.modalUpgradeIconContainer}>
                                <Text style={styles.modalUpgradeIcon}>âž–</Text>
                              </View>
                              <View style={styles.modalUpgradeInfo}>
                                <Text style={styles.modalUpgradeName}>Fire Worker</Text>
                                <Text style={styles.modalUpgradeDescription}>
                                  Remove a worker (saves salary costs)
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.modalUpgradeButton}
                              onPress={() => handleFireWorker(selectedCompany)}
                            >
                              <Text style={styles.modalUpgradeButtonText}>
                                Fire Worker
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </>
                  )}

                  {companyModalTab === 'rd' && selectedCompany && (
                    <>
                      {renderRDLabTab(selectedCompany)}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Education Required Modal */}
      <Modal visible={showEducationRequiredModal} transparent animationType="fade" onRequestClose={() => setShowEducationRequiredModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#F8FAFC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.richModalGradient}
            >
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>
                  ðŸŽ“ Education Required
                </Text>
              </View>
              
              <View style={styles.richModalContent}>
                <Text style={styles.richModalSubtitle}>
                  You need to complete the Entrepreneurship Course before you can start a company. Visit the Education app to enroll!
                </Text>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowEducationRequiredModal(false)}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>OK</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Company Created Modal */}
      <Modal visible={showCompanyCreatedModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={styles.successAnimationContainer}>
                <View style={styles.successIconContainer}>
                  <Text style={styles.successIcon}>ðŸŽ‰</Text>
                </View>
                <View style={styles.successRipple} />
                <View style={[styles.successRipple, styles.successRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Company Created!</Text>
                <Text style={[styles.richModalSubtitle, gameState.settings?.darkMode && styles.richModalSubtitleDark]}>Your business empire begins</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.companyInfoCard}>
                  <View style={styles.companyIconContainer}>
                    <Text style={styles.companyIcon}>{getCompanyEmoji(modalData.companyName?.toLowerCase() || '')}</Text>
                  </View>
                  <View style={styles.companyDetails}>
                    <Text style={styles.companyName}>{modalData.companyName}</Text>
                    <Text style={styles.companyStatus}>Now Operational</Text>
                  </View>
                </View>
                
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>ðŸ’°</Text>
                    <Text style={styles.benefitText}>Weekly income generation</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>ðŸ‘¥</Text>
                    <Text style={styles.benefitText}>Hire employees to scale</Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>âš¡</Text>
                    <Text style={styles.benefitText}>Upgrade for better performance</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowCompanyCreatedModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Let&apos;s Build!</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸš€</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal visible={showErrorModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Error Animation Container */}
              <View style={styles.errorAnimationContainer}>
                <View style={styles.errorIconContainer}>
                  <Text style={styles.errorIcon}>âš ï¸</Text>
                </View>
                <View style={styles.errorRipple} />
                <View style={[styles.errorRipple, styles.errorRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Something Went Wrong</Text>
                <Text style={styles.richModalSubtitle}>Please try again</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.errorInfoCard}>
                  <View style={styles.errorIconContainer}>
                    <Text style={styles.errorIcon}>âŒ</Text>
                  </View>
                  <View style={styles.errorDetails}>
                    <Text style={styles.errorMessage}>{modalData.errorMessage}</Text>
                  </View>
                </View>
                
                <View style={styles.errorTipsList}>
                  <View style={styles.errorTipItem}>
                    <Text style={styles.errorTipIcon}>ðŸ’¡</Text>
                    <Text style={styles.errorTipText}>Check your internet connection</Text>
                  </View>
                  <View style={styles.errorTipItem}>
                    <Text style={styles.errorTipIcon}>ðŸ”„</Text>
                    <Text style={styles.errorTipText}>Try the action again</Text>
                  </View>
                  <View style={styles.errorTipItem}>
                    <Text style={styles.errorTipIcon}>ðŸ“ž</Text>
                    <Text style={styles.errorTipText}>Contact support if issue persists</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowErrorModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Got It</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸ‘</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Insufficient Funds Modal */}
      <Modal visible={showInsufficientFundsModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Money Animation Container */}
              <View style={styles.moneyAnimationContainer}>
                <View style={styles.moneyIconContainer}>
                  <Text style={styles.moneyIcon}>ðŸ’°</Text>
                </View>
                <View style={styles.moneyRipple} />
                <View style={[styles.moneyRipple, styles.moneyRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Insufficient Funds</Text>
                <Text style={styles.richModalSubtitle}>You need more money for this action</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.moneyInfoCard}>
                  <View style={styles.moneyIconContainer}>
                    <Text style={styles.moneyIcon}>ðŸ’¸</Text>
                  </View>
                  <View style={styles.moneyDetails}>
                    <Text style={styles.moneyRequired}>
                      {modalData.upgradeName ? 
                        `Need $${modalData.requiredAmount?.toLocaleString()} to upgrade ${modalData.upgradeName}` :
                        `Need $${modalData.requiredAmount?.toLocaleString()} to hire a worker`
                      }
                    </Text>
                    <Text style={[styles.moneyCurrent, gameState.settings?.darkMode && styles.moneyCurrentDark]}>Current: ${cash.toLocaleString()}</Text>
                  </View>
                </View>
                
                <View style={styles.moneyTipsList}>
                  <View style={styles.moneyTipItem}>
                    <Text style={styles.moneyTipIcon}>ðŸ’¼</Text>
                    <Text style={styles.moneyTipText}>Work to earn more money</Text>
                  </View>
                  <View style={styles.moneyTipItem}>
                    <Text style={styles.moneyTipIcon}>ðŸ¦</Text>
                    <Text style={styles.moneyTipText}>Take out a loan if needed</Text>
                  </View>
                  <View style={styles.moneyTipItem}>
                    <Text style={styles.moneyTipIcon}>â°</Text>
                    <Text style={styles.moneyTipText}>Wait for weekly income</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowInsufficientFundsModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>I&apos;ll Earn More</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸ’ª</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Worker Hired Modal */}
      <Modal visible={showWorkerHiredModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={styles.successAnimationContainer}>
                <View style={styles.successIconContainer}>
                  <Text style={styles.successIcon}>ðŸ‘¥</Text>
                </View>
                <View style={styles.successRipple} />
                <View style={[styles.successRipple, styles.successRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Worker Hired!</Text>
                <Text style={styles.richModalSubtitle}>Your team is growing stronger</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.workerInfoCard}>
                  <View style={styles.workerIconContainer}>
                    <Text style={styles.workerIcon}>ðŸ‘¨â€ðŸ’¼</Text>
                  </View>
                  <View style={styles.workerDetails}>
                    <Text style={styles.workerCompanyName}>{modalData.companyName}</Text>
                    <Text style={styles.workerCount}>Now has {modalData.newEmployeeCount} employees</Text>
                  </View>
                </View>
                
                <View style={styles.workerBenefitsList}>
                  <View style={styles.workerBenefitItem}>
                    <Text style={styles.workerBenefitIcon}>ðŸ’¼</Text>
                    <Text style={styles.workerBenefitText}>Increased productivity</Text>
                  </View>
                  <View style={styles.workerBenefitItem}>
                    <Text style={styles.workerBenefitIcon}>ðŸ“Š</Text>
                    <Text style={styles.workerBenefitText}>Higher weekly income</Text>
                  </View>
                  <View style={styles.workerBenefitItem}>
                    <Text style={styles.workerBenefitIcon}>ðŸŽ¯</Text>
                    <Text style={styles.workerBenefitText}>Better business performance</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowWorkerHiredModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Great!</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸŽ‰</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* No Workers Modal */}
      <Modal visible={showNoWorkersModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* No Workers Animation Container */}
              <View style={styles.noWorkersAnimationContainer}>
                <View style={styles.noWorkersIconContainer}>
                  <Text style={styles.noWorkersIcon}>ðŸ‘¥</Text>
                </View>
                <View style={styles.noWorkersRipple} />
                <View style={[styles.noWorkersRipple, styles.noWorkersRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>No Workers Available</Text>
                <Text style={styles.richModalSubtitle}>Hire some employees first</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.noWorkersInfoCard}>
                  <View style={styles.noWorkersIconContainer}>
                    <Text style={styles.noWorkersIcon}>ðŸš«</Text>
                  </View>
                  <View style={styles.noWorkersDetails}>
                    <Text style={styles.noWorkersMessage}>There are no workers to fire</Text>
                    <Text style={[styles.noWorkersSubtext, gameState.settings?.darkMode && styles.noWorkersSubtextDark]}>Your company has no employees yet</Text>
                  </View>
                </View>
                
                <View style={styles.noWorkersTipsList}>
                  <View style={styles.noWorkersTipItem}>
                    <Text style={styles.noWorkersTipIcon}>ðŸ’¼</Text>
                    <Text style={styles.noWorkersTipText}>Hire workers to grow your business</Text>
                  </View>
                  <View style={styles.noWorkersTipItem}>
                    <Text style={styles.noWorkersTipIcon}>ðŸ’°</Text>
                    <Text style={styles.noWorkersTipText}>Workers increase your weekly income</Text>
                  </View>
                  <View style={styles.noWorkersTipItem}>
                    <Text style={styles.noWorkersTipIcon}>ðŸ“ˆ</Text>
                    <Text style={styles.noWorkersTipText}>More workers = better performance</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowNoWorkersModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Got It</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸ‘</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Worker Fired Modal */}
      <Modal visible={showWorkerFiredModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Fired Animation Container */}
              <View style={styles.firedAnimationContainer}>
                <View style={styles.firedIconContainer}>
                  <Text style={styles.firedIcon}>ðŸ‘‹</Text>
                </View>
                <View style={styles.firedRipple} />
                <View style={[styles.firedRipple, styles.firedRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Worker Fired</Text>
                <Text style={styles.richModalSubtitle}>Team size adjusted</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.firedInfoCard}>
                  <View style={styles.firedIconContainer}>
                    <Text style={styles.firedIcon}>ðŸ‘¨â€ðŸ’¼</Text>
                  </View>
                  <View style={styles.firedDetails}>
                    <Text style={styles.firedCompanyName}>{modalData.companyName}</Text>
                    <Text style={[styles.firedCount, gameState.settings?.darkMode && styles.firedCountDark]}>Now has {modalData.newEmployeeCount} employees</Text>
                  </View>
                </View>
                
                <View style={styles.firedImpactList}>
                  <View style={styles.firedImpactItem}>
                    <Text style={styles.firedImpactIcon}>ðŸ“‰</Text>
                    <Text style={styles.firedImpactText}>Reduced weekly costs</Text>
                  </View>
                  <View style={styles.firedImpactItem}>
                    <Text style={styles.firedImpactIcon}>âš–ï¸</Text>
                    <Text style={styles.firedImpactText}>Lower productivity</Text>
                  </View>
                  <View style={styles.firedImpactItem}>
                    <Text style={styles.firedImpactIcon}>ðŸ’¡</Text>
                    <Text style={styles.firedImpactText}>Hire more when needed</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowWorkerFiredModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#6B7280', '#4B5563']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Understood</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸ‘</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Max Level Modal */}
      <Modal visible={showMaxLevelModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Max Level Animation Container */}
              <View style={styles.maxLevelAnimationContainer}>
                <View style={styles.maxLevelIconContainer}>
                  <Text style={styles.maxLevelIcon}>ðŸ†</Text>
                </View>
                <View style={styles.maxLevelRipple} />
                <View style={[styles.maxLevelRipple, styles.maxLevelRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Maximum Level Reached!</Text>
                <Text style={styles.richModalSubtitle}>This upgrade is fully optimized</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.maxLevelInfoCard}>
                  <View style={styles.maxLevelIconContainer}>
                    <Text style={styles.maxLevelIcon}>â­</Text>
                  </View>
                  <View style={styles.maxLevelDetails}>
                    <Text style={styles.maxLevelMessage}>This upgrade is already at maximum level</Text>
                    <Text style={[styles.maxLevelSubtext, gameState.settings?.darkMode && styles.maxLevelSubtextDark]}>No further improvements available</Text>
                  </View>
                </View>
                
                <View style={styles.maxLevelAchievementsList}>
                  <View style={styles.maxLevelAchievementItem}>
                    <Text style={styles.maxLevelAchievementIcon}>ðŸŽ¯</Text>
                    <Text style={styles.maxLevelAchievementText}>Peak performance achieved</Text>
                  </View>
                  <View style={styles.maxLevelAchievementItem}>
                    <Text style={styles.maxLevelAchievementIcon}>ðŸ’Ž</Text>
                    <Text style={styles.maxLevelAchievementText}>Maximum efficiency unlocked</Text>
                  </View>
                  <View style={styles.maxLevelAchievementItem}>
                    <Text style={styles.maxLevelAchievementIcon}>ðŸš€</Text>
                    <Text style={styles.maxLevelAchievementText}>Focus on other upgrades</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowMaxLevelModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Excellent!</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸŽ‰</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Upgrade Complete Modal */}
      <Modal visible={showUpgradeCompleteModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={styles.successAnimationContainer}>
                <View style={styles.successIconContainer}>
                  <Text style={styles.successIcon}>ðŸš€</Text>
                </View>
                <View style={styles.successRipple} />
                <View style={[styles.successRipple, styles.successRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Upgrade Complete!</Text>
                <Text style={styles.richModalSubtitle}>Your business is now stronger</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.upgradeInfoCard}>
                  <View style={styles.upgradeIconContainer}>
                    <Text style={styles.upgradeIcon}>âš¡</Text>
                  </View>
                  <View style={styles.upgradeDetails}>
                    <Text style={styles.upgradeCompanyName}>{modalData.companyName}</Text>
                    <Text style={styles.upgradeStatus}>Successfully Upgraded</Text>
                  </View>
                </View>
                
                <View style={styles.upgradeBenefitsList}>
                  <View style={styles.upgradeBenefitItem}>
                    <Text style={styles.upgradeBenefitIcon}>ðŸ“ˆ</Text>
                    <Text style={styles.upgradeBenefitText}>Increased weekly income</Text>
                  </View>
                  <View style={styles.upgradeBenefitItem}>
                    <Text style={styles.upgradeBenefitIcon}>ðŸŽ¯</Text>
                    <Text style={styles.upgradeBenefitText}>Enhanced efficiency</Text>
                  </View>
                  <View style={styles.upgradeBenefitItem}>
                    <Text style={styles.upgradeBenefitIcon}>ðŸ’Ž</Text>
                    <Text style={styles.upgradeBenefitText}>Competitive advantage</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowUpgradeCompleteModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Awesome!</Text>
                    <Text style={styles.richModalButtonIcon}>âœ¨</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Sell Company Modal */}
      <Modal visible={showSellCompanyModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Warning Animation Container */}
              <View style={styles.sellWarningAnimationContainer}>
                <View style={styles.sellWarningIconContainer}>
                  <Text style={styles.sellWarningIcon}>âš ï¸</Text>
                </View>
                <View style={styles.sellWarningRipple} />
                <View style={[styles.sellWarningRipple, styles.sellWarningRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Sell Company</Text>
                <Text style={styles.richModalSubtitle}>This action cannot be undone</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.sellCompanyInfoCard}>
                  <View style={styles.sellCompanyIconContainer}>
                    <Text style={styles.sellCompanyIcon}>ðŸ¢</Text>
                  </View>
                  <View style={styles.sellCompanyDetails}>
                    <Text style={styles.sellCompanyName}>{modalData.companyName}</Text>
                    <Text style={styles.sellCompanyWarning}>Are you sure you want to sell this company?</Text>
                  </View>
                </View>
                
                <View style={styles.sellCompanyDetailsList}>
                  <View style={styles.sellCompanyDetailItem}>
                    <Text style={styles.sellCompanyDetailIcon}>ðŸ’°</Text>
                    <Text style={styles.sellCompanyDetailText}>You will receive 50% of your total investment</Text>
                  </View>
                  <View style={styles.sellCompanyDetailItem}>
                    <Text style={styles.sellCompanyDetailIcon}>ðŸ“‰</Text>
                    <Text style={styles.sellCompanyDetailText}>You will lose all weekly income from this company</Text>
                  </View>
                  <View style={styles.sellCompanyDetailItem}>
                    <Text style={styles.sellCompanyDetailIcon}>ðŸ”„</Text>
                    <Text style={styles.sellCompanyDetailText}>You can create a new company later if needed</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <View style={styles.sellModalButtonRow}>
                  <TouchableOpacity
                    style={styles.sellModalButton}
                    onPress={() => setShowSellCompanyModal(false)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#6B7280', '#4B5563']}
                      style={styles.richModalButtonGradient}
                    >
                      <Text style={styles.richModalButtonText}>Keep Company</Text>
                      <Text style={styles.richModalButtonIcon}>âœ…</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.sellModalButton}
                    onPress={() => {
                      setShowSellCompanyModal(false);
                      modalData.onConfirm?.();
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      style={styles.richModalButtonGradient}
                    >
                      <Text style={styles.richModalButtonText}>Sell Company</Text>
                      <Text style={styles.richModalButtonIcon}>ðŸ’¸</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Company Sold Modal */}
      <Modal visible={showCompanySoldModal} transparent animationType="slide">
        <View style={styles.richModalOverlay}>
          <View style={styles.richModalContainer}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.richModalGradient}
            >
              {/* Success Animation Container */}
              <View style={styles.soldSuccessAnimationContainer}>
                <View style={styles.soldSuccessIconContainer}>
                  <Text style={styles.soldSuccessIcon}>ðŸ’°</Text>
                </View>
                <View style={styles.soldSuccessRipple} />
                <View style={[styles.soldSuccessRipple, styles.soldSuccessRipple2]} />
              </View>
              
              <View style={styles.richModalHeader}>
                <Text style={styles.richModalTitle}>Company Sold!</Text>
                <Text style={styles.richModalSubtitle}>Transaction completed successfully</Text>
              </View>
              
              <View style={styles.richModalContent}>
                <View style={styles.soldCompanyInfoCard}>
                  <View style={styles.soldCompanyIconContainer}>
                    <Text style={styles.soldCompanyIcon}>ðŸ¢</Text>
                  </View>
                  <View style={styles.soldCompanyDetails}>
                    <Text style={styles.soldCompanyName}>{modalData.companyName}</Text>
                    <Text style={styles.soldCompanyValue}>Sold for ${modalData.sellValue?.toLocaleString()}</Text>
                  </View>
                </View>
                
                <View style={styles.soldCompanySummaryList}>
                  <View style={styles.soldCompanySummaryItem}>
                    <Text style={styles.soldCompanySummaryIcon}>ðŸ’µ</Text>
                    <Text style={styles.soldCompanySummaryText}>Cash received: ${modalData.sellValue?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.soldCompanySummaryItem}>
                    <Text style={styles.soldCompanySummaryIcon}>ðŸ“Š</Text>
                    <Text style={styles.soldCompanySummaryText}>This represents 50% of your total investment</Text>
                  </View>
                  <View style={styles.soldCompanySummaryItem}>
                    <Text style={styles.soldCompanySummaryIcon}>ðŸŽ¯</Text>
                    <Text style={styles.soldCompanySummaryText}>You can create a new company anytime</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.richModalActions}>
                <TouchableOpacity
                  style={styles.richModalButton}
                  onPress={() => setShowCompanySoldModal(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.richModalButtonGradient}
                  >
                    <Text style={styles.richModalButtonText}>Excellent!</Text>
                    <Text style={styles.richModalButtonIcon}>ðŸŽ‰</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(55, 65, 81, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.8)',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    ...getShadow(8, '#000'),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  tabTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  companiesContainer: {
    paddingHorizontal: 20,
  },
  createContainer: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  emptyStateMessageDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  noEducationContainer: {
    paddingVertical: 20,
  },
  noEducationCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    ...getShadow(8, '#000'),
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noEducationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  noEducationMessage: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  educationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  educationInfoText: {
    fontSize: 12,
    color: '#3B82F6',
    flex: 1,
  },
  companyTypesContainer: {
    gap: 16,
  },
  companyTypeCard: {
    borderRadius: 16,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
    marginBottom: 16,
  },
  companyTypeCardContent: {
    padding: 20,
    alignItems: 'center',
  },
  companyTypeEmojiContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  companyTypeEmoji: {
    fontSize: 32,
  },
  companyTypeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  companyTypeDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  companyTypeDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  companyTypeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#374151',
    width: '100%',
    justifyContent: 'center',
  },
  companyTypeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyTypeStatIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyTypeStatText: {
    fontSize: 13,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  companyTypePrice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#374151',
    width: '100%',
  },
  companyTypePriceLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  companyTypePriceLabelDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  companyTypePriceValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  companyCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  companyCardContent: {
    padding: 20,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companyEmojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  companyEmoji: {
    fontSize: 24,
  },
  companyDetails: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  companyType: {
    fontSize: 13,
    color: '#9CA3AF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  companyTypeDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  manageButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#374151',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  companyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E5E7EB',
  },
  actionButtonTextDisabled: {
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  actionButtonTextDisabledDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 6,
  },
  actionButtonTextSecondary: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    ...getShadow(8, '#000'),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitleEmoji: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalStatsContainer: {
    marginBottom: 20,
  },
  modalStatsCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalStatIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalUpgradeCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalUpgradeCardContent: {
    padding: 16,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalUpgradeCardMaxLevel: {
    borderColor: '#10B981',
    backgroundColor: '#111827',
  },
  modalUpgradeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalUpgradeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalUpgradeIcon: {
    fontSize: 20,
  },
  modalUpgradeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalUpgradeInfo: {
    flex: 1,
  },
  modalUpgradeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalUpgradeDescription: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 16,
  },
  modalUpgradeLevel: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalUpgradeLevelMax: {
    backgroundColor: '#10B981',
  },
  modalUpgradeLevelText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalUpgradeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#374151',
  },
  modalUpgradeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalUpgradeStatText: {
    fontSize: 12,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  modalUpgradeButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  modalUpgradeButtonDisabled: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  modalUpgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalUpgradeButtonTextDisabled: {
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalUpgradeButtonTextDisabledDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalMaxLevelBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  modalMaxLevelText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Rich Modal Styles
  richModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  richModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    ...getShadow(20, '#000'),
  },
  richModalGradient: {
    padding: 24,
  },
  
  // Success Animation
  successAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  successIcon: {
    fontSize: 40,
  },
  successRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    top: -10,
    left: -10,
  },
  successRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  
  // Rich Modal Header
  richModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  richModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  richModalSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  richModalSubtitleDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Rich Modal Content
  richModalContent: {
    marginBottom: 24,
  },
  
  // Company Info Card
  companyInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  companyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  companyIcon: {
    fontSize: 30,
  },
  companyStatus: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  
  // Benefits List
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  
  // Upgrade Info Card
  upgradeInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  upgradeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  upgradeIcon: {
    fontSize: 30,
  },
  upgradeDetails: {
    flex: 1,
  },
  upgradeCompanyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  upgradeStatus: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  
  // Upgrade Benefits List
  upgradeBenefitsList: {
    gap: 12,
  },
  upgradeBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  upgradeBenefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  upgradeBenefitText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  
  // Worker Info Card
  workerInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  workerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  workerIcon: {
    fontSize: 30,
  },
  workerDetails: {
    flex: 1,
  },
  workerCompanyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  workerCount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  
  // Worker Benefits List
  workerBenefitsList: {
    gap: 12,
  },
  workerBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workerBenefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  workerBenefitText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  
  // Rich Modal Actions
  richModalActions: {
    alignItems: 'center',
  },
  richModalButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...getShadow(8, '#000'),
  },
  richModalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  richModalButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  richModalButtonIcon: {
    fontSize: 18,
  },

  // Basic Modal Styles (for compatibility)
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
  },
  modalMessage: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Error Modal Styles
  errorAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  errorIcon: {
    fontSize: 40,
  },
  errorRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    top: -10,
    left: -10,
  },
  errorRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorDetails: {
    flex: 1,
  },
  errorMessage: {
    fontSize: 16,
    color: '#FCA5A5',
    fontWeight: '500',
    lineHeight: 22,
  },
  errorTipsList: {
    gap: 12,
  },
  errorTipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorTipIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  errorTipText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },

  // Money Modal Styles
  moneyAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  moneyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F59E0B',
  },
  moneyIcon: {
    fontSize: 40,
  },
  moneyRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    top: -10,
    left: -10,
  },
  moneyRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  moneyInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  moneyDetails: {
    flex: 1,
  },
  moneyRequired: {
    fontSize: 16,
    color: '#FCD34D',
    fontWeight: '600',
    marginBottom: 4,
  },
  moneyCurrent: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  moneyCurrentDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  moneyTipsList: {
    gap: 12,
  },
  moneyTipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  moneyTipIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  moneyTipText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },

  // Fired Modal Styles
  firedAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  firedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6B7280',
  },
  firedIcon: {
    fontSize: 40,
  },
  firedRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(107, 114, 128, 0.3)',
    top: -10,
    left: -10,
  },
  firedRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
  firedInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  firedDetails: {
    flex: 1,
  },
  firedCompanyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  firedCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  firedCountDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  firedImpactList: {
    gap: 12,
  },
  firedImpactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  firedImpactIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  firedImpactText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },

  // No Workers Modal Styles
  noWorkersAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  noWorkersIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  noWorkersIcon: {
    fontSize: 40,
  },
  noWorkersRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    top: -10,
    left: -10,
  },
  noWorkersRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  noWorkersInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  noWorkersDetails: {
    flex: 1,
  },
  noWorkersMessage: {
    fontSize: 16,
    color: '#93C5FD',
    fontWeight: '600',
    marginBottom: 4,
  },
  noWorkersSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  noWorkersSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  noWorkersTipsList: {
    gap: 12,
  },
  noWorkersTipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noWorkersTipIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noWorkersTipText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },

  // Max Level Modal Styles
  maxLevelAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  maxLevelIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  maxLevelIcon: {
    fontSize: 40,
  },
  maxLevelRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    top: -10,
    left: -10,
  },
  maxLevelRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  maxLevelInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  maxLevelDetails: {
    flex: 1,
  },
  maxLevelMessage: {
    fontSize: 16,
    color: '#C4B5FD',
    fontWeight: '600',
    marginBottom: 4,
  },
  maxLevelSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  maxLevelSubtextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  maxLevelAchievementsList: {
    gap: 12,
  },
  maxLevelAchievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  maxLevelAchievementIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  maxLevelAchievementText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },

  // Sell Company Modal Styles
  sellWarningAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  sellWarningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F59E0B',
  },
  sellWarningIcon: {
    fontSize: 40,
  },
  sellWarningRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    top: -10,
    left: -10,
  },
  sellWarningRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  sellCompanyInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sellCompanyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sellCompanyIcon: {
    fontSize: 30,
  },
  sellCompanyDetails: {
    flex: 1,
  },
  sellCompanyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sellCompanyWarning: {
    fontSize: 14,
    color: '#FCD34D',
    fontWeight: '500',
  },
  sellCompanyDetailsList: {
    gap: 12,
  },
  sellCompanyDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sellCompanyDetailIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  sellCompanyDetailText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  sellModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  sellModalButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    ...getShadow(8, '#000'),
  },

  // Company Sold Modal Styles
  soldSuccessAnimationContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  soldSuccessIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  soldSuccessIcon: {
    fontSize: 40,
  },
  soldSuccessRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    top: -10,
    left: -10,
  },
  soldSuccessRipple2: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -20,
    left: -20,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  soldCompanyInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  soldCompanyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  soldCompanyIcon: {
    fontSize: 30,
  },
  soldCompanyDetails: {
    flex: 1,
  },
  soldCompanyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  soldCompanyValue: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  soldCompanySummaryList: {
    gap: 12,
  },
  soldCompanySummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  soldCompanySummaryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  soldCompanySummaryText: {
    fontSize: 14,
    color: '#D1D5DB',
    fontWeight: '500',
  },

  // R&D Lab Styles
  modalTabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  modalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  modalTabActive: {
    backgroundColor: '#3B82F6',
  },
  modalTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalTabTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  modalTabTextActive: {
    color: '#FFFFFF',
  },
  rdLabCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  rdLabTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  rdLabDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdLabDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdLabBuildButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  rdLabBuildButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  rdLabBuildButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  rdProjectCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rdProjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  rdProjectProgress: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdProjectProgressDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompleteButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  rdCompleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  rdTechCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  rdTechName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  rdTechDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdTechDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdTechCost: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdTechCostDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdStartButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  rdStartButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  rdStartButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  rdPatentCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  rdPatentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  rdPatentIncome: {
    fontSize: 14,
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdPatentIncomeDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdUnlockedCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rdUnlockedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  rdPatentButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 12,
  },
  rdPatentButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  rdCompetitionCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  rdCompetitionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  rdCompetitionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompetitionDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompetitionPrizes: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 4,
  },
  rdCompetitionCost: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 12,
  },
  rdCompetitionStatus: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rdCompetitionStatusText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600',
    marginBottom: 4,
  },
  rdCompetitionScore: {
    fontSize: 13,
    color: '#6B7280',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompetitionScoreDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompetitionHistory: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rdCompetitionHistoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  rdCompetitionHistoryText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompetitionHistoryTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  rdCompetitionButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rdCompetitionButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  rdCompetitionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  textDark: {
    color: '#F9FAFB',
  },
});
