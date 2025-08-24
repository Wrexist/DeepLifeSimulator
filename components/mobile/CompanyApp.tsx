import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Building2, Users, TrendingUp, DollarSign, Settings, Plus, Minus, Lock, GraduationCap } from 'lucide-react-native';
import { useGame, Company } from '@/contexts/GameContext';
import { createCompany, buyCompanyUpgrade, addWorker, removeWorker, sellCompany } from '@/contexts/game/company';

interface CompanyAppProps {
  onBack: () => void;
}

const companyTypes = [
  { id: 'factory', name: 'Factory', emoji: '🏭', baseIncome: 500, workerSalary: 100, cost: 25000 },
  { id: 'ai', name: 'AI Company', emoji: '🤖', baseIncome: 800, workerSalary: 150, cost: 45000 },
  { id: 'restaurant', name: 'Restaurant', emoji: '🍽️', baseIncome: 300, workerSalary: 80, cost: 65000 },
  { id: 'realestate', name: 'Real Estate', emoji: '🏢', baseIncome: 1000, workerSalary: 200, cost: 100000 },
  { id: 'bank', name: 'Bank', emoji: '🏦', baseIncome: 1200, workerSalary: 250, cost: 1000000 },
];

const getAllCompanyUpgrades = () => {
  const upgrades = [
    { 
      id: 'marketing', 
      name: 'Marketing Campaign', 
      description: 'Boost brand awareness and customer acquisition', 
      cost: 1000, 
      weeklyIncomeBonus: 100, 
      icon: '📢',
      maxLevel: 3,
      costMultiplier: 1.5
    },
    { 
      id: 'automation', 
      name: 'Process Automation', 
      description: 'Streamline operations and reduce costs', 
      cost: 2000, 
      weeklyIncomeBonus: 200, 
      icon: '⚙️',
      maxLevel: 2,
      costMultiplier: 2.0
    },
    { 
      id: 'assembly_line', 
      name: 'Assembly Line', 
      description: 'Automated production line for mass manufacturing', 
      cost: 3000, 
      weeklyIncomeBonus: 300, 
      icon: '🏭',
      maxLevel: 5,
      costMultiplier: 1.3
    },
    { 
      id: 'quality_control', 
      name: 'Quality Control System', 
      description: 'Advanced quality assurance and testing', 
      cost: 4000, 
      weeklyIncomeBonus: 400, 
      icon: '✅',
      maxLevel: 3,
      costMultiplier: 1.4
    },
    { 
      id: 'expansion', 
      name: 'Business Expansion', 
      description: 'Open new locations and markets', 
      cost: 5000, 
      weeklyIncomeBonus: 500, 
      icon: '🏢',
      maxLevel: 1,
      costMultiplier: 1.0
    },
    { 
      id: 'machine_learning', 
      name: 'Machine Learning Engine', 
      description: 'AI-powered decision making and optimization', 
      cost: 5000, 
      weeklyIncomeBonus: 500, 
      icon: '🧠',
      maxLevel: 4,
      costMultiplier: 1.6
    },
    { 
      id: 'warehouse', 
      name: 'Smart Warehouse', 
      description: 'Automated inventory management system', 
      cost: 6000, 
      weeklyIncomeBonus: 600, 
      icon: '📦',
      maxLevel: 2,
      costMultiplier: 1.8
    },
    { 
      id: 'cybersecurity', 
      name: 'Cybersecurity Suite', 
      description: 'Advanced security and data protection', 
      cost: 7000, 
      weeklyIncomeBonus: 700, 
      icon: '🔒',
      maxLevel: 2,
      costMultiplier: 1.9
    },
    { 
      id: 'cloud_infrastructure', 
      name: 'Cloud Infrastructure', 
      description: 'Scalable cloud computing resources', 
      cost: 8000, 
      weeklyIncomeBonus: 800, 
      icon: '☁️',
      maxLevel: 3,
      costMultiplier: 1.7
    },
    { 
      id: 'supply_chain', 
      name: 'Supply Chain Optimization', 
      description: 'Streamlined logistics and distribution', 
      cost: 9000, 
      weeklyIncomeBonus: 900, 
      icon: '🚚',
      maxLevel: 2,
      costMultiplier: 2.1
    },
    { 
      id: 'market_expansion', 
      name: 'Market Expansion', 
      description: 'Enter new markets and territories', 
      cost: 10000, 
      weeklyIncomeBonus: 1000, 
      icon: '🌍',
      maxLevel: 2,
      costMultiplier: 2.2
    },
    { 
      id: 'research_development', 
      name: 'Research & Development', 
      description: 'Innovation and product development', 
      cost: 12000, 
      weeklyIncomeBonus: 1200, 
      icon: '🔬',
      maxLevel: 3,
      costMultiplier: 1.8
    },
    { 
      id: 'data_analytics', 
      name: 'Data Analytics Platform', 
      description: 'Advanced business intelligence and insights', 
      cost: 13000, 
      weeklyIncomeBonus: 1300, 
      icon: '📊',
      maxLevel: 3,
      costMultiplier: 1.9
    },
    { 
      id: 'robotics', 
      name: 'Industrial Robotics', 
      description: 'Advanced robotics for maximum efficiency', 
      cost: 15000, 
      weeklyIncomeBonus: 1500, 
      icon: '🤖',
      maxLevel: 1,
      costMultiplier: 1.0
    },
    { 
      id: 'digital_transformation', 
      name: 'Digital Transformation', 
      description: 'Complete digital overhaul of operations', 
      cost: 15000, 
      weeklyIncomeBonus: 1500, 
      icon: '💻',
      maxLevel: 2,
      costMultiplier: 2.0
    },
    { 
      id: 'customer_service', 
      name: 'Customer Service Excellence', 
      description: 'Enhanced customer support and satisfaction', 
      cost: 2500, 
      weeklyIncomeBonus: 250, 
      icon: '🎧',
      maxLevel: 4,
      costMultiplier: 1.4
    },
    { 
      id: 'brand_recognition', 
      name: 'Brand Recognition', 
      description: 'Build strong brand identity and loyalty', 
      cost: 3500, 
      weeklyIncomeBonus: 350, 
      icon: '🏆',
      maxLevel: 3,
      costMultiplier: 1.6
    },
    { 
      id: 'efficiency_optimization', 
      name: 'Efficiency Optimization', 
      description: 'Streamline processes and reduce waste', 
      cost: 4500, 
      weeklyIncomeBonus: 450, 
      icon: '⚡',
      maxLevel: 3,
      costMultiplier: 1.5
    },
    { 
      id: 'product_innovation', 
      name: 'Product Innovation', 
      description: 'Develop cutting-edge products and services', 
      cost: 8000, 
      weeklyIncomeBonus: 800, 
      icon: '💡',
      maxLevel: 3,
      costMultiplier: 1.7
    },
    { 
      id: 'operational_excellence', 
      name: 'Operational Excellence', 
      description: 'Achieve world-class operational standards', 
      cost: 6000, 
      weeklyIncomeBonus: 600, 
      icon: '⭐',
      maxLevel: 3,
      costMultiplier: 1.6
    },
    { 
      id: 'sustainability_initiative', 
      name: 'Sustainability Initiative', 
      description: 'Implement eco-friendly business practices', 
      cost: 7000, 
      weeklyIncomeBonus: 700, 
      icon: '🌱',
      maxLevel: 3,
      costMultiplier: 1.8
    },
    { 
      id: 'talent_development', 
      name: 'Talent Development', 
      description: 'Invest in employee training and growth', 
      cost: 5000, 
      weeklyIncomeBonus: 500, 
      icon: '👥',
      maxLevel: 4,
      costMultiplier: 1.5
    },
    { 
      id: 'risk_management', 
      name: 'Risk Management', 
      description: 'Comprehensive risk assessment and mitigation', 
      cost: 9000, 
      weeklyIncomeBonus: 900, 
      icon: '🛡️',
      maxLevel: 2,
      costMultiplier: 2.1
    },
    { 
      id: 'compliance_system', 
      name: 'Compliance System', 
      description: 'Ensure regulatory compliance and standards', 
      cost: 11000, 
      weeklyIncomeBonus: 1100, 
      icon: '📋',
      maxLevel: 2,
      costMultiplier: 2.3
    },
  ];
  
  // Sort upgrades by cost from cheapest to most expensive
  return upgrades.sort((a, b) => a.cost - b.cost);
};

export default function CompanyApp({ onBack }: CompanyAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const [activeTab, setActiveTab] = useState<'companies' | 'create'>('companies');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');

  const companies: Company[] = gameState.companies || [];
  const cash = gameState.stats?.money || 0;

  // Check if user has completed Entrepreneurship Course
  const hasEntrepreneurshipEducation = gameState.educations?.find(
    e => e.id === 'entrepreneurship'
  )?.completed;

  const totalWeeklyIncome = companies.reduce((total, company) => total + company.weeklyIncome, 0);
  const totalEmployees = companies.reduce((total, company) => total + company.employees, 0);

  const handleCreateCompany = useCallback((typeId: string) => {
    if (!hasEntrepreneurshipEducation) {
      Alert.alert(
        'Education Required', 
        'You need to complete the Entrepreneurship Course before you can start a company. Visit the Education app to enroll!'
      );
      return;
    }

    const result = createCompany(gameState, setGameState, (stats) => {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, ...stats }
      }));
    }, typeId);

    if (result.success) {
      saveGame();
      Alert.alert('Company Created!', `Your ${companyTypes.find(t => t.id === typeId)?.name} is now operational!`);
      setShowCreateModal(false);
    } else {
      Alert.alert('Error', result.message || 'Failed to create company');
    }
  }, [gameState, setGameState, saveGame, hasEntrepreneurshipEducation]);

  const handleHireWorker = useCallback((company: Company) => {
    addWorker(gameState, setGameState, company.id);
    saveGame();
    Alert.alert('Worker Hired!', `Your ${company.name} now has ${company.employees + 1} employees.`);
  }, [gameState, setGameState, saveGame]);

  const handleFireWorker = useCallback((company: Company) => {
    if (company.employees <= 0) {
      Alert.alert('No Workers', 'There are no workers to fire.');
      return;
    }

    removeWorker(gameState, setGameState, company.id);
    saveGame();
    Alert.alert('Worker Fired', `Your ${company.name} now has ${company.employees - 1} employees.`);
  }, [gameState, setGameState, saveGame]);

  const handleUpgrade = useCallback((company: Company, upgradeId: string) => {
    buyCompanyUpgrade(gameState, setGameState, upgradeId, company.id);
    saveGame();
    
    const upgrade = company.upgrades.find(u => u.id === upgradeId);
    if (upgrade) {
      Alert.alert('Upgrade Complete!', `Your ${company.name} has been upgraded!`);
    }
  }, [gameState, setGameState, saveGame]);

  const handleSellCompany = useCallback((company: Company) => {
    Alert.alert(
      'Sell Company',
      `Are you sure you want to sell ${company.name}?\n\nYou will receive 50% of your total investment (company cost + upgrades).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          style: 'destructive',
          onPress: () => {
            const result = sellCompany(gameState, setGameState, company.id);
            if (result.success) {
              saveGame();
              Alert.alert(
                'Company Sold!', 
                `You sold ${company.name} for $${result.sellValue?.toLocaleString()}!\n\nThis represents 50% of your total investment.`
              );
            } else {
              Alert.alert('Error', result.message || 'Failed to sell company');
            }
          }
        }
      ]
    );
  }, [gameState, setGameState, saveGame]);

  const getCompanyEmoji = (type: string) => {
    const companyType = companyTypes.find(t => t.id === type);
    return companyType?.emoji || '🏢';
  };

  const getCompanyTypeName = (type: string) => {
    const companyType = companyTypes.find(t => t.id === type);
    return companyType?.name || 'Company';
  };

  const renderNoEducationState = () => (
    <View style={styles.noEducationContainer}>
      <View style={styles.noEducationCard}>
        <View style={styles.lockIconContainer}>
          <Lock size={48} color="#9CA3AF" />
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
      </View>
    </View>
  );

  const renderCompanyCard = (company: Company) => (
    <View key={company.id} style={styles.companyCard}>
      <LinearGradient
        colors={['#1F2937', '#111827']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.companyCardGradient}
      >
        <View style={styles.companyHeader}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyEmoji}>{getCompanyEmoji(company.type)}</Text>
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{company.name}</Text>
              <Text style={styles.companyType}>{getCompanyTypeName(company.type)}</Text>
            </View>
          </View>
          <View style={styles.companyStats}>
            <Text style={styles.weeklyIncome}>${company.weeklyIncome.toLocaleString()}/week</Text>
            <Text style={styles.employeeCount}>{company.employees} employees</Text>
          </View>
        </View>

        <View style={styles.companyActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleHireWorker(company)}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Hire Worker</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleFireWorker(company)}
            disabled={company.employees <= 0}
          >
            <LinearGradient
              colors={company.employees > 0 ? ['#F59E0B', '#D97706'] : ['#6B7280', '#4B5563']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <Minus size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Fire Worker</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleSellCompany(company)}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <DollarSign size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Sell</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {company.upgrades && company.upgrades.length > 0 && (
          <TouchableOpacity
            style={styles.upgradesButton}
            onPress={() => {
              setSelectedCompany(company);
              setShowUpgradeModal(true);
            }}
          >
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradesButtonGradient}
            >
              <TrendingUp size={20} color="#FFFFFF" />
              <Text style={styles.upgradesButtonText}>Manage Upgrades</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Companies</Text>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => setShowCreateModal(true)}
          disabled={!hasEntrepreneurshipEducation}
        >
          <Plus size={24} color={hasEntrepreneurshipEducation ? "#FFFFFF" : "#6B7280"} />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCardGradient}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Companies</Text>
                <Text style={styles.summaryValue}>{companies.length}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Weekly Income</Text>
                <Text style={styles.summaryValue}>${totalWeeklyIncome.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Employees</Text>
                <Text style={styles.summaryValue}>{totalEmployees}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'companies' && styles.activeTab]}
          onPress={() => setActiveTab('companies')}
        >
          <Text style={[styles.tabText, activeTab === 'companies' && styles.activeTabText]}>
            My Companies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.activeTab]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
            Create New
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'companies' ? (
          <View style={styles.companiesContainer}>
            {companies.length === 0 ? (
              <View style={styles.emptyState}>
                <Building2 size={48} color="#6B7280" />
                <Text style={styles.emptyStateTitle}>No Companies Yet</Text>
                <Text style={styles.emptyStateMessage}>
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
                    <LinearGradient
                      colors={['#1F2937', '#111827']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.companyTypeCardGradient}
                    >
                      <Text style={styles.companyTypeEmoji}>{type.emoji}</Text>
                      <Text style={styles.companyTypeName}>{type.name}</Text>
                      <Text style={styles.companyTypeCost}>${type.cost.toLocaleString()}</Text>
                      <Text style={styles.companyTypeIncome}>${type.baseIncome}/week base</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedCompany?.name} - Upgrades
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowUpgradeModal(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedCompany && getAllCompanyUpgrades().map((upgrade) => {
                const companyUpgrade = selectedCompany.upgrades.find(u => u.id === upgrade.id);
                const currentLevel = companyUpgrade?.level || 0;
                const isMaxLevel = currentLevel >= upgrade.maxLevel;
                const nextLevelCost = currentLevel === 0 ? upgrade.cost : Math.round(upgrade.cost * Math.pow(upgrade.costMultiplier, currentLevel));
                const canAfford = gameState.stats.money >= nextLevelCost;
                
                return (
                  <View key={upgrade.id} style={styles.modalUpgradeCard}>
                    <LinearGradient
                      colors={isMaxLevel ? ['#10B981', '#059669'] : canAfford ? ['#1F2937', '#111827'] : ['#374151', '#1F2937']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalUpgradeCardGradient}
                    >
                      <View style={styles.modalUpgradeHeader}>
                        <Text style={styles.modalUpgradeIcon}>{upgrade.icon}</Text>
                        <View style={styles.modalUpgradeInfo}>
                          <Text style={styles.modalUpgradeName}>{upgrade.name}</Text>
                          <Text style={styles.modalUpgradeDescription}>{upgrade.description}</Text>
                        </View>
                      </View>

                      <View style={styles.modalUpgradeStats}>
                        <View style={styles.modalUpgradeStat}>
                          <Text style={styles.modalUpgradeStatLabel}>Current Level:</Text>
                          <Text style={styles.modalUpgradeStatValue}>{currentLevel}/{upgrade.maxLevel}</Text>
                        </View>
                        <View style={styles.modalUpgradeStat}>
                          <Text style={styles.modalUpgradeStatLabel}>Weekly Bonus:</Text>
                          <Text style={styles.modalUpgradeStatValue}>+${upgrade.weeklyIncomeBonus * currentLevel}/week</Text>
                        </View>
                      </View>

                      {!isMaxLevel && (
                        <TouchableOpacity
                          style={styles.modalUpgradeButton}
                          onPress={() => {
                            if (!canAfford) {
                              Alert.alert(
                                'Insufficient Funds', 
                                `You need $${nextLevelCost.toLocaleString()} to upgrade ${upgrade.name}. You currently have $${gameState.stats.money.toLocaleString()}.`
                              );
                              return;
                            }
                            handleUpgrade(selectedCompany, upgrade.id);
                          }}
                        >
                          <LinearGradient
                            colors={canAfford ? ['#3B82F6', '#1D4ED8'] : ['#6B7280', '#4B5563']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.modalUpgradeButtonGradient}
                          >
                            <Text style={styles.modalUpgradeButtonText}>
                              {currentLevel === 0 ? 'Purchase' : 'Upgrade'} - ${nextLevelCost.toLocaleString()}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}

                      {isMaxLevel && (
                        <View style={styles.modalMaxLevelBadge}>
                          <Text style={styles.modalMaxLevelText}>MAX LEVEL</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </View>
                );
              })}
            </ScrollView>
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
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryCardGradient: {
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
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
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  companiesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  createContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  },
  noEducationContainer: {
    paddingVertical: 20,
  },
  noEducationCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  companyTypeCardGradient: {
    padding: 20,
    alignItems: 'center',
  },
  companyTypeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  companyTypeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  companyTypeCost: {
    fontSize: 16,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 4,
  },
  companyTypeIncome: {
    fontSize: 14,
    color: '#10B981',
  },
  companyCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  companyCardGradient: {
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
  companyEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  companyDetails: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  companyType: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  companyStats: {
    alignItems: 'flex-end',
  },
  weeklyIncome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 2,
  },
  employeeCount: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  companyActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  upgradesSection: {
    marginTop: 8,
  },
  upgradesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  upgradesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  upgradeButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 120,
  },
  upgradeButtonGradient: {
    padding: 12,
    minWidth: 160,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  upgradeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  upgradeInfo: {
    flex: 1,
  },
  upgradeName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  upgradeDescription: {
    fontSize: 10,
    color: '#D1D5DB',
    lineHeight: 12,
  },
  upgradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upgradeCost: {
    fontSize: 10,
    color: '#FBBF24',
    fontWeight: '600',
  },
  upgradeBonus: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  ownedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownedText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  upgradesButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
  },
  upgradesButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  upgradesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
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
  modalCloseText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  modalUpgradeCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalUpgradeCardGradient: {
    padding: 16,
  },
  modalUpgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalUpgradeIcon: {
    fontSize: 24,
    marginRight: 12,
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
  modalUpgradeStats: {
    marginBottom: 12,
  },
  modalUpgradeStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalUpgradeStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalUpgradeStatValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalUpgradeButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalUpgradeButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  modalUpgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalMaxLevelBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  modalMaxLevelText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
