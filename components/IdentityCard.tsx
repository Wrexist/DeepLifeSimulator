import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, DollarSign, Star, Heart, TrendingUp } from 'lucide-react-native';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  verticalScale,
} from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { Asset, Liability, computeNetWorth } from '@/utils/netWorth';
import { perks as allPerks } from '@/src/features/onboarding/perksData';
import { useTranslation } from '@/hooks/useTranslation';

const MINER_PRICES = {
  basic: 500,
  advanced: 2000,
  pro: 8000,
  industrial: 25000,
  quantum: 100000,
} as const;

function getAvatar(age: number, sex: string) {
  if (age < 13) return require('@/assets/images/Face/Baby.png');
  if (age >= 60) {
    return sex === 'female'
      ? require('@/assets/images/Face/Old_Female.png')
      : require('@/assets/images/Face/Old_Male.png');
  }
  return sex === 'female'
    ? require('@/assets/images/Face/Female.png')
    : require('@/assets/images/Face/Male.png');
}

interface InfoModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  darkMode: boolean;
  children: React.ReactNode;
  t: (key: string) => string;
}

function InfoModal({ visible, title, onClose, darkMode, children, t }: InfoModalProps) {
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>{title}</Text>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={true}>
            {children}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <LinearGradient
              colors={darkMode ? ['#3B82F6', '#2563EB'] : ['#3B82F6', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.closeButtonGradient}
            >
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

export default function IdentityCard() {
  const { gameState } = useGame();
  const { t } = useTranslation();
  const scenario = scenarios.find(s => s.id === gameState.scenarioId);

  const sex = gameState.userProfile.sex || gameState.userProfile.gender || 'male';
  const name =
    [gameState.userProfile.firstName, gameState.userProfile.lastName].filter(Boolean).join(' ') ||
    gameState.userProfile.name;
  const sexuality = (gameState.userProfile.sexuality ||
    (gameState.userProfile.seekingGender === sex ? 'gay' : 'straight')) as string;
  const partner = gameState.relationships.find(r => r.type === 'spouse' || r.type === 'partner');
  const relationshipStatus = partner
    ? partner.type === 'spouse'
      ? 'Married'
      : 'In Relationship'
    : 'Single';
  const currentCareer = gameState.careers.find(c => c.id === gameState.currentJob);
  const job = currentCareer
    ? `${currentCareer.levels[currentCareer.level].name} (${currentCareer.id})`
    : 'Unemployed';

  const netWorth = useMemo(() => {
    const assets: Asset[] = [
      { id: 'cash', type: 'cash', baseValue: gameState.stats.money },
      { id: 'savings', type: 'cash', baseValue: gameState.bankSavings || 0 },
    ];
    gameState.items
      .filter(i => i.owned)
      .forEach(item => assets.push({ id: item.id, type: 'item', baseValue: item.price }));
    gameState.companies.forEach(company => {
      assets.push({
        id: company.id,
        type: 'business',
        baseValue: 0,
        trailingWeeklyProfit: company.weeklyIncome,
        valuationMultiple: 10,
      });
      Object.entries(company.miners || {}).forEach(([id, count]) => {
        const price = MINER_PRICES[id as keyof typeof MINER_PRICES];
        if (price && (count as number) > 0) {
          assets.push({
            id: `${company.id}_miner_${id}`,
            type: 'hardware',
            baseValue: price * (count as number),
          });
        }
      });
    });
    gameState.realEstate
      .filter(p => p.owned)
      .forEach(p => assets.push({ id: p.id, type: 'property', baseValue: p.price }));
    const liabilities: Liability[] = [];
    return computeNetWorth(assets, liabilities).netWorth;
  }, [gameState]);

  const passiveInfo = calcWeeklyPassiveIncome(gameState);
  const expenseInfo = calcWeeklyExpenses(gameState);
  const passive = passiveInfo.total;
  const jobIncome = currentCareer ? currentCareer.levels[currentCareer.level].salary : 0;
  const expenses = expenseInfo.total;
  const cashFlow = jobIncome + passive - expenses;

  const [showCash, setShowCash] = useState(false);
  const [showPerks, setShowPerks] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);

  const activePerks = allPerks.filter(p => gameState.perks?.[p.id as keyof typeof gameState.perks]);
  const derivedTraits: string[] = [];
  if (gameState.stats.happiness >= 70) derivedTraits.push('happy');
  else if (gameState.stats.happiness <= 30) derivedTraits.push('sad');
  if (gameState.stats.health >= 70) derivedTraits.push('healthy');
  else if (gameState.stats.health <= 30) derivedTraits.push('sick');
  if (gameState.stats.energy >= 70) derivedTraits.push('energetic');
  else if (gameState.stats.energy <= 30) derivedTraits.push('tired');
  const traits = [...(scenario?.start.traits || []), ...derivedTraits];

  // Function to get trait bonuses
  const getTraitBonuses = (trait: string) => {
    const traitBonuses: Record<string, string[]> = {
      'happy': ['+10% salary bonus', '+5 energy per week', '+2 reputation gain'],
      'sad': ['-5% salary penalty', '-3 energy per week', '-1 reputation loss'],
      'healthy': ['+15% salary bonus', '+8 energy per week', '+3 reputation gain', 'Immunity to sickness'],
      'sick': ['-10% salary penalty', '-8 energy per week', '-2 reputation loss', 'Higher sickness risk'],
      'energetic': ['+20% energy efficiency', '+5% faster promotions', '+1 bonus action per week'],
      'tired': ['-15% energy efficiency', '-3% slower promotions', '-1 action penalty per week'],
      'fit': ['+10 fitness starting bonus', '+5% faster fitness gains', '+2 health per week'],
      'smart': ['+25% faster education progress', '+10% higher starting salary', '+3 reputation gain'],
      'charismatic': ['+15% relationship success rate', '+10% faster career advancement', '+5 reputation gain'],
      'lucky': ['+20% chance for positive events', '+10% bonus income from random events', '+5% better deals'],
      'ambitious': ['+15% faster career progression', '+10% higher salary negotiations', '+2 bonus energy for work'],
      'creative': ['+20% faster skill learning', '+15% bonus from creative activities', '+3 happiness gain'],
      'analytical': ['+25% better investment returns', '+10% faster problem-solving', '+2 bonus energy for education'],
      'social': ['+20% faster relationship building', '+15% bonus from social activities', '+5 reputation gain'],
      'introverted': ['+10% energy efficiency when alone', '+5% bonus from solo activities', '-5% social penalty'],
      'extroverted': ['+15% bonus from group activities', '+10% faster team projects', '+3 energy from socializing'],
      'risk_taker': ['+20% higher rewards from risky activities', '+15% chance for big wins', '-10% penalty for failures'],
      'conservative': ['+15% reduced risk penalties', '+10% safer investment returns', '+5% energy savings'],
      'optimistic': ['+10% happiness gain', '+5% faster recovery from setbacks', '+2 bonus energy'],
      'pessimistic': ['+10% preparation for failures', '+5% reduced surprise penalties', '-3 happiness penalty'],
      'patient': ['+20% bonus from long-term activities', '+10% better compound effects', '+5 energy efficiency'],
      'impatient': ['+15% faster short-term gains', '+10% immediate rewards', '-5% penalty for waiting'],
      'generous': ['+15% reputation gain', '+10% relationship bonuses', '+5% karma rewards'],
      'selfish': ['+10% personal gain bonus', '+5% resource efficiency', '-5% reputation penalty'],
      'honest': ['+20% reputation gain', '+15% trust bonuses', '+10% long-term relationship benefits'],
      'deceptive': ['+15% short-term gains', '+10% immediate advantages', '-10% long-term penalties'],
      'organized': ['+15% efficiency bonus', '+10% energy savings', '+5% better planning results'],
      'disorganized': ['+10% creative bonuses', '+5% spontaneous rewards', '-5% efficiency penalty'],
      'confident': ['+15% success rate bonus', '+10% faster advancement', '+3 energy gain'],
      'anxious': ['+10% preparation bonus', '+5% risk awareness', '-8% energy penalty'],
      'brave': ['+20% bonus from dangerous activities', '+15% courage rewards', '+5% respect gain'],
      'cautious': ['+15% safety bonuses', '+10% reduced penalties', '+5% energy savings'],
      'leader': ['+20% team bonuses', '+15% management rewards', '+10% respect gain'],
      'follower': ['+15% team efficiency', '+10% support bonuses', '+5% energy savings'],
    };
    return traitBonuses[trait] || ['No specific bonuses defined'];
  };

  const weeklyModifiers = useMemo(() => {
    const modifiers: { label: string; changes: Record<string, number> }[] = [];

    if (gameState.stats.health <= 30) {
      modifiers.push({
        label: 'Sickness',
        changes: { health: -10, energy: -15, happiness: -10 },
      });
    }

    const activeDietPlan = gameState.dietPlans.find(plan => plan.active);
    if (activeDietPlan) {
      const changes: Record<string, number> = {
        money: -activeDietPlan.dailyCost * 7,
        health: activeDietPlan.healthGain * 7,
        energy: activeDietPlan.energyGain * 7,
      };
      if (activeDietPlan.happinessGain) {
        changes.happiness = activeDietPlan.happinessGain * 7;
      }
      modifiers.push({
        label: `${activeDietPlan.name} Diet`,
        changes,
      });
    }

    return modifiers;
  }, [gameState]);

  const perksCount = activePerks.length;
  const traitsCount = traits.length;

  const avatar = getAvatar(gameState.date.age, sex);
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  return (
    <View>
      <LinearGradient
        colors={gameState.settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.avatarContainer}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.avatarGlow} />
        </View>
        <Text style={[styles.name, gameState.settings.darkMode && styles.nameDark]}>{name}</Text>
        <Text style={[styles.scenarioText, gameState.settings.darkMode && styles.scenarioTextDark]}>
          {scenario?.title || t('common.unknown')}
        </Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              {t('game.age')}
            </Text>
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {Math.floor(gameState.date.age)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              {t('game.sex')}
            </Text>
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {capitalize(sex)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              {t('game.relationshipStatus')}
            </Text>
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {relationshipStatus}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              {t('game.job')}
            </Text>
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {job}
            </Text>
          </View>
        </View>
        
        <View style={styles.netWorthContainer}>
          <DollarSign size={20} color={gameState.settings.darkMode ? '#10B981' : '#059669'} />
          <Text style={[styles.netWorthText, gameState.settings.darkMode && styles.netWorthTextDark]}>
            {t('game.netWorth')}: ${netWorth.toLocaleString()}
          </Text>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={gameState.settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.list}
      >
        <TouchableOpacity style={styles.listItem} onPress={() => setShowCash(true)}>
          <View style={styles.listItemContent}>
            <DollarSign size={20} color={gameState.settings.darkMode ? '#10B981' : '#059669'} />
            <Text style={[styles.listLabel, gameState.settings.darkMode && styles.listLabelDark]}>
              {t('game.weeklyCashFlow')}: ${cashFlow.toFixed(0)}
            </Text>
          </View>
          <ChevronRight size={20} color={gameState.settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowPerks(true)}>
          <View style={styles.listItemContent}>
            <Star size={20} color={gameState.settings.darkMode ? '#F59E0B' : '#D97706'} />
            <Text style={[styles.listLabel, gameState.settings.darkMode && styles.listLabelDark]}>
              {perksCount} {t('game.perks')}
            </Text>
          </View>
          <ChevronRight size={20} color={gameState.settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowTraits(true)}>
          <View style={styles.listItemContent}>
            <Heart size={20} color={gameState.settings.darkMode ? '#EF4444' : '#DC2626'} />
            <Text style={[styles.listLabel, gameState.settings.darkMode && styles.listLabelDark]}>
              {traitsCount} {t('game.traits')}
            </Text>
          </View>
          <ChevronRight size={20} color={gameState.settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowModifiers(true)}>
          <View style={styles.listItemContent}>
            <TrendingUp size={20} color={gameState.settings.darkMode ? '#3B82F6' : '#2563EB'} />
            <Text style={[styles.listLabel, gameState.settings.darkMode && styles.listLabelDark]}>
              {t('game.weeklyModifiers')}
            </Text>
          </View>
          <ChevronRight size={20} color={gameState.settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </LinearGradient>

      <InfoModal
        visible={showCash}
        title={t('game.weeklyCashFlow')}
        onClose={() => setShowCash(false)}
        darkMode={gameState.settings.darkMode}
        t={t}
      >
        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
            Income Sources
          </Text>
          <View style={styles.modalItem}>
            <DollarSign size={16} color={gameState.settings.darkMode ? '#10B981' : '#059669'} />
            <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
              Job Income: ${jobIncome.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <DollarSign size={16} color={gameState.settings.darkMode ? '#10B981' : '#059669'} />
            <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
              Passive Income: ${passive.toFixed(0)}
            </Text>
          </View>
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
            Passive Breakdown
          </Text>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              📈 Stocks: ${passiveInfo.breakdown.stocks.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              🏠 Real Estate: ${passiveInfo.breakdown.realEstate.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              🎵 Songs: ${passiveInfo.breakdown.songs.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              🎨 Art: ${passiveInfo.breakdown.art.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              📋 Contracts: ${passiveInfo.breakdown.contracts.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              🤝 Sponsors: ${passiveInfo.breakdown.sponsors.toFixed(0)}
            </Text>
          </View>
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
            Expenses
          </Text>
          <View style={styles.modalItem}>
            <DollarSign size={16} color={gameState.settings.darkMode ? '#EF4444' : '#DC2626'} />
            <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
              Total Expenses: ${expenses.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              🏠 Upkeep: ${expenseInfo.breakdown.upkeep.toFixed(0)}
            </Text>
          </View>
          <View style={styles.modalItem}>
            <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
              💳 Loans: ${expenseInfo.breakdown.loans.toFixed(0)}
            </Text>
          </View>
        </View>
      </InfoModal>

      <InfoModal
        visible={showPerks}
        title={t('game.perks')}
        onClose={() => setShowPerks(false)}
        darkMode={gameState.settings.darkMode}
        t={t}
      >
        {activePerks.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              Active Perks ({activePerks.length})
            </Text>
            {activePerks.map(p => (
              <View key={p.id} style={styles.modalItem}>
                <Star size={16} color={gameState.settings.darkMode ? '#F59E0B' : '#D97706'} />
                <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
                  {p.title}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              No Active Perks
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
                {t('game.noPerks')}
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showTraits}
        title={t('game.traits')}
        onClose={() => setShowTraits(false)}
        darkMode={gameState.settings.darkMode}
        t={t}
      >
        {traits.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              Character Traits ({traits.length})
            </Text>
            {traits.map(t => (
              <View key={t} style={styles.traitContainer}>
                <View style={styles.traitHeader}>
                  <Heart size={16} color={gameState.settings.darkMode ? '#EF4444' : '#DC2626'} />
                  <Text style={[styles.traitName, gameState.settings.darkMode && styles.traitNameDark]}>
                    {capitalize(t)}
                  </Text>
                </View>
                <View style={styles.traitBonuses}>
                  {getTraitBonuses(t).map((bonus, index) => (
                    <View key={index} style={styles.bonusItem}>
                      <Text style={[
                        styles.bonusText, 
                        gameState.settings.darkMode && styles.bonusTextDark,
                        bonus.startsWith('+') && styles.positiveBonus,
                        bonus.startsWith('-') && styles.negativeBonus
                      ]}>
                        {bonus}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              No Character Traits
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
                No traits acquired yet
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showModifiers}
        title={t('game.weeklyModifiers')}
        onClose={() => setShowModifiers(false)}
        darkMode={gameState.settings.darkMode}
        t={t}
      >
        {weeklyModifiers.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              Active Modifiers ({weeklyModifiers.length})
            </Text>
            {weeklyModifiers.map(mod => (
              <View key={mod.label} style={styles.modalItem}>
                <TrendingUp size={16} color={gameState.settings.darkMode ? '#3B82F6' : '#2563EB'} />
                <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
                  {mod.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              No Active Modifiers
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
                No modifiers this week
              </Text>
            </View>
          </View>
        )}
        
        {weeklyModifiers.length > 0 && (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, gameState.settings.darkMode && styles.modalSectionTitleDark]}>
              Effects Breakdown
            </Text>
            {weeklyModifiers.map(mod => (
              <View key={`${mod.label}-effects`} style={styles.modalItem}>
                <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalSubTextDark]}>
                  <Text style={{ fontWeight: '600' }}>{mod.label}:</Text>
                </Text>
                {Object.entries(mod.changes).map(([stat, value]) => {
                  const formattedValue =
                    stat === 'money'
                      ? `$${Math.abs(value).toLocaleString()}`
                      : Math.abs(value);
                  return (
                    <View key={stat} style={styles.modalItem}>
                      <Text
                        style={[
                          styles.modalSubText,
                          value >= 0 ? styles.positiveText : styles.negativeText,
                        ]}
                      >
                        {`${stat.charAt(0).toUpperCase() + stat.slice(1)}: ${
                          value > 0 ? '+' : ''
                        }${formattedValue}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </InfoModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    marginHorizontal: responsivePadding.large,
    marginBottom: responsiveSpacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  avatar: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarGlow: {
    position: 'absolute',
    width: scale(86),
    height: scale(86),
    borderRadius: scale(43),
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    top: -3,
    left: -3,
    zIndex: -1,
  },
  name: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  nameDark: {
    color: '#F9FAFB',
  },
  scenarioText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: responsiveSpacing.lg,
    fontStyle: 'italic',
  },
  scenarioTextDark: {
    color: '#9CA3AF',
  },
  text: {
    fontSize: responsiveFontSize.lg,
    color: '#374151',
    marginBottom: 2,
  },
  textDark: {
    color: '#D1D5DB',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.lg,
    width: '100%',
  },
  statItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
    textAlign: 'center',
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  statValueDark: {
    color: '#F9FAFB',
  },
  netWorthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    width: '100%',
  },
  netWorthText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#059669',
    marginLeft: responsiveSpacing.xs,
  },
  netWorthTextDark: {
    color: '#10B981',
  },
  list: {
    borderRadius: responsiveBorderRadius.xl,
    marginHorizontal: responsivePadding.large,
    marginBottom: responsiveSpacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listLabel: {
    fontSize: responsiveFontSize.lg,
    color: '#374151',
    marginLeft: responsiveSpacing.sm,
  },
  listLabelDark: {
    color: '#F9FAFB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalContent: {
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSectionTitleDark: {
    color: '#D1D5DB',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  modalText: {
    fontSize: responsiveFontSize.base,
    color: '#374151',
    flex: 1,
  },
  modalTextDark: {
    color: '#D1D5DB',
  },
  modalSubText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    flex: 1,
  },
  modalSubTextDark: {
    color: '#9CA3AF',
  },
  modifierItem: {
    marginBottom: responsiveSpacing.sm,
  },
  positiveText: {
    color: '#059669',
  },
  negativeText: {
    color: '#DC2626',
  },
  closeButton: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: responsiveFontSize.lg,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Trait bonus styles
  traitContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: responsiveBorderRadius.md,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  traitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  traitName: {
    fontSize: responsiveFontSize.md,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: responsiveSpacing.xs,
  },
  traitNameDark: {
    color: '#F9FAFB',
  },
  traitBonuses: {
    marginLeft: responsiveSpacing.lg,
  },
  bonusItem: {
    marginBottom: responsiveSpacing.xs,
  },
  bonusText: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    lineHeight: 18,
  },
  bonusTextDark: {
    color: '#9CA3AF',
  },
  positiveBonus: {
    color: '#10B981',
    fontWeight: '500',
  },
  negativeBonus: {
    color: '#EF4444',
    fontWeight: '500',
  },
});
