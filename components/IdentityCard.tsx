import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, DollarSign, Star, Heart, TrendingUp, Crown, Brain } from 'lucide-react-native';
import { MINDSET_TRAITS, MindsetId } from '@/lib/mindset/config';
import YouthPillModal from './YouthPillModal';
import LegacyTimeline from './LegacyTimeline';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
} from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { Asset, Liability, computeNetWorth } from '@/utils/netWorth';
import { perks as allPerks } from '@/src/features/onboarding/perksData';
import { useTranslation } from '@/hooks/useTranslation';
import { getCharacterImage } from '@/utils/characterImages';
import AutoSaveIndicator from './AutoSaveIndicator';
import { formatMoney } from '@/utils/formatMoney';

const MINER_PRICES = {
  basic: 500,
  advanced: 2000,
  pro: 8000,
  industrial: 25000,
  quantum: 100000,
} as const;

// Using the utility function from utils/characterImages.ts

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
  const [showYouthPillModal, setShowYouthPillModal] = useState(false);
  
  const {
    stats,
    bankSavings,
    items,
    companies,
    realEstate,
    userProfile,
    relationships,
    careers,
    currentJob,
    perks,
    scenarioId,
    dietPlans,
    date,
    settings,
    youthPills
  } = gameState;

  const scenario = (scenarios || []).find(s => s.id === scenarioId);

  const sex = userProfile.sex || userProfile.gender || 'male';
  const name =
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') ||
    userProfile?.name;
  const partner = (relationships || []).find(r => r.type === 'spouse' || r.type === 'partner');
  const relationshipStatus = partner
    ? partner.type === 'spouse'
      ? 'Married'
      : 'In Relationship'
    : 'Single';
  const currentCareer = (careers || []).find(c => c.id === currentJob);
  const job = currentCareer && currentCareer.levels && currentCareer.levels[currentCareer.level]
    ? currentCareer.levels[currentCareer.level].name
    : 'Unemployed';

  const netWorth = useMemo(() => {
    const assets: Asset[] = [
      { id: 'cash', type: 'cash', baseValue: stats.money },
      { id: 'savings', type: 'cash', baseValue: bankSavings || 0 },
    ];
    (items || [])
      .filter(i => i?.owned)
      .forEach(item => assets.push({ id: item.id, type: 'item', baseValue: item.price }));
    companies?.forEach(company => {
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
    (realEstate || [])
      .filter(p => p?.owned)
      .forEach(p => assets.push({ id: p.id, type: 'property', baseValue: p.price }));
    // Add vehicles (depreciated value)
    (gameState.vehicles || []).forEach(vehicle => {
      const baseSellPercent = 0.8;
      const conditionMultiplier = 0.2 + (vehicle.condition / 100) * 0.8;
      const mileagePenalty = Math.min(0.3, (vehicle.mileage || 0) / 500000);
      const depreciatedValue = vehicle.price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
      assets.push({ id: vehicle.id, type: 'vehicle', baseValue: Math.floor(depreciatedValue) });
    });
    const liabilities: Liability[] = [];
    return computeNetWorth(assets, liabilities).netWorth;
  }, [stats.money, bankSavings, items, companies, realEstate, gameState.vehicles]);

  const passiveInfo = useMemo(() => calcWeeklyPassiveIncome(gameState), [gameState]);
  const expenseInfo = useMemo(() => calcWeeklyExpenses(gameState), [gameState]);
  const passive = passiveInfo.total;
  const jobIncome = currentCareer ? currentCareer.levels[currentCareer.level].salary : 0;

  // Partner / spouse weekly income (counts even after marriage) - nerfed to 1/3
  const partnerIncome = useMemo(() => (relationships || [])
    .filter(rel => (rel.type === 'partner' || rel.type === 'spouse') && rel.income && rel.relationshipScore >= 50)
    .reduce((sum, rel) => sum + Math.floor((rel.income || 0) / 3), 0), [relationships]);

  const expenses = expenseInfo.total;
  const cashFlow = jobIncome + passive + partnerIncome - expenses;

  const [showCash, setShowCash] = useState(false);
  const [showPerks, setShowPerks] = useState(false);
  const [showTraits, setShowTraits] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);
  const [showMindset, setShowMindset] = useState(false);
  const [showLegacyTimeline, setShowLegacyTimeline] = useState(false);

  const activePerks = useMemo(() => allPerks.filter(p => perks?.[p.id as keyof typeof perks]), [perks]);
  
  const derivedTraits = useMemo(() => {
    const dt: string[] = [];
    if (stats.happiness >= 70) dt.push('happy');
    else if (stats.happiness <= 30) dt.push('sad');
    if (stats.health >= 70) dt.push('healthy');
    else if (stats.health <= 30) dt.push('sick');
    if (stats.energy >= 70) dt.push('energetic');
    else if (stats.energy <= 30) dt.push('tired');
    return dt;
  }, [stats.happiness, stats.health, stats.energy]);

  const traits = useMemo(() => [...(scenario?.start.traits || []), ...derivedTraits], [scenario, derivedTraits]);

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
      'tough': ['+15 health starting bonus', '+10% reduced damage from dangerous activities', '+5% better street job success rate'],
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

    if (stats.health <= 30) {
      modifiers.push({
        label: 'Sickness',
        changes: { health: -10, energy: -15, happiness: -10 },
      });
    }

    const activeDietPlan = (dietPlans || []).find(plan => plan.active);
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
  }, [stats.health, dietPlans]);

  const perksCount = activePerks.length;
  const traitsCount = traits.length;

  const avatar = getCharacterImage(date.age, sex);
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.avatarContainer}>
          <Image source={avatar} style={styles.avatar} />
          <View style={styles.avatarGlow} />
          {gameState.prestige?.prestigeLevel !== undefined && gameState.prestige.prestigeLevel > 0 && (
            <TouchableOpacity
              style={styles.prestigeBadge}
              onPress={() => {
                // Open prestige shop - this would need to be passed as a prop or accessed via context
                // For now, just show the badge
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FCD34D', '#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.prestigeBadgeGradient}
              >
                <Crown size={14} color="#FFFFFF" />
                <Text style={styles.prestigeBadgeText}>P{gameState.prestige.prestigeLevel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, settings.darkMode && styles.nameDark]}>{name}</Text>
        </View>
        <Text style={[styles.scenarioText, settings.darkMode && styles.scenarioTextDark]}>
          {scenario?.title || t('common.unknown')}
        </Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <View style={styles.statWithButton}>
              <View>
                <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
                  {t('game.age')}
                </Text>
                <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
                  {Math.floor(date.age)}
                </Text>
              </View>
              {youthPills > 0 && (
                <TouchableOpacity 
                  style={styles.youthPillButton}
                  onPress={() => setShowYouthPillModal(true)}
                >
                  <Image 
                    source={require('@/assets/images/iap/items/youth_pill_single.png')} 
                    style={styles.youthPillIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.youthPillButtonText}>{youthPills}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
              {t('game.sex')}
            </Text>
            <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
              {capitalize(sex)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
              {t('game.relationshipStatus')}
            </Text>
            <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
              {relationshipStatus}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, settings.darkMode && styles.statLabelDark]}>
              {t('game.job')}
            </Text>
            <Text style={[styles.statValue, settings.darkMode && styles.statValueDark]}>
              {job}
            </Text>
          </View>
        </View>
        
        <View style={styles.netWorthContainer}>
          <DollarSign size={20} color={settings.darkMode ? '#10B981' : '#059669'} />
          <Text style={[styles.netWorthText, settings.darkMode && styles.netWorthTextDark]}>
            {t('game.netWorth')}: {formatMoney(netWorth)}
          </Text>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.list}
      >
        <TouchableOpacity style={styles.listItem} onPress={() => setShowCash(true)}>
          <View style={styles.listItemContent}>
            <DollarSign size={20} color={settings.darkMode ? '#10B981' : '#059669'} />
            <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
              {t('game.weeklyCashFlow')}: {formatMoney(cashFlow)}
            </Text>
          </View>
          <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowPerks(true)}>
          <View style={styles.listItemContent}>
            <Star size={20} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
            <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
              {perksCount} {t('game.perks')}
            </Text>
          </View>
          <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowTraits(true)}>
          <View style={styles.listItemContent}>
            <Heart size={20} color={settings.darkMode ? '#EF4444' : '#DC2626'} />
            <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
              {traitsCount} {t('game.traits')}
            </Text>
          </View>
          <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
        {gameState.mindset?.activeTraitId && (
          <TouchableOpacity style={styles.listItem} onPress={() => setShowMindset(true)}>
            <View style={styles.listItemContent}>
              <Brain size={20} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
              <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
                Mindset: {MINDSET_TRAITS.find(t => t.id === gameState.mindset?.activeTraitId)?.name || 'Unknown'}
              </Text>
            </View>
            <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        )}
        {(gameState.previousLives && gameState.previousLives.length > 0) && (
          <TouchableOpacity style={styles.listItem} onPress={() => setShowLegacyTimeline(true)}>
            <View style={styles.listItemContent}>
              <History size={20} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
              <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
                Legacy Timeline ({gameState.previousLives.length} generation{gameState.previousLives.length !== 1 ? 's' : ''})
              </Text>
            </View>
            <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        )}
        {(gameState.previousLives && gameState.previousLives.length > 0) && (
          <TouchableOpacity style={styles.listItem} onPress={() => setShowLegacyTimeline(true)}>
            <View style={styles.listItemContent}>
              <History size={20} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
              <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
                Legacy Timeline ({gameState.previousLives.length} generation{gameState.previousLives.length !== 1 ? 's' : ''})
              </Text>
            </View>
            <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.listItem} onPress={() => setShowModifiers(true)}>
          <View style={styles.listItemContent}>
            <TrendingUp size={20} color={settings.darkMode ? '#3B82F6' : '#2563EB'} />
            <Text style={[styles.listLabel, settings.darkMode && styles.listLabelDark]}>
              {t('game.weeklyModifiers')}
            </Text>
          </View>
          <ChevronRight size={20} color={settings.darkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </LinearGradient>
      
      <AutoSaveIndicator position="relative" />

      <LegacyTimeline
        visible={showLegacyTimeline}
        onClose={() => setShowLegacyTimeline(false)}
      />

      <InfoModal
        visible={showCash}
        title={t('game.weeklyCashFlow')}
        onClose={() => setShowCash(false)}
        darkMode={settings.darkMode}
        t={t}
      >
        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
            Income Sources
          </Text>
          <View style={styles.modalItem}>
            <DollarSign size={16} color={settings.darkMode ? '#10B981' : '#059669'} />
            <Text style={[styles.modalText, settings.darkMode && styles.modalTextDark]}>
              Job Income: {formatMoney(jobIncome)}
            </Text>
          </View>
          {partnerIncome > 0 && (
            <View style={styles.modalItem}>
              <DollarSign size={16} color={settings.darkMode ? '#10B981' : '#059669'} />
              <Text style={[styles.modalText, settings.darkMode && styles.modalTextDark]}>
                Partner Income: {formatMoney(partnerIncome)}
              </Text>
            </View>
          )}
          <View style={styles.modalItem}>
            <DollarSign size={16} color={settings.darkMode ? '#10B981' : '#059669'} />
            <Text style={[styles.modalText, settings.darkMode && styles.modalTextDark]}>
              Passive Income: {formatMoney(passive)}
            </Text>
          </View>
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
            Passive Breakdown
          </Text>
          {passiveInfo.breakdown.stocks > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                📈 Stocks: {formatMoney(passiveInfo.breakdown.stocks)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.realEstate > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🏠 Real Estate: {formatMoney(passiveInfo.breakdown.realEstate)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.companies > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🏢 Companies: {formatMoney(passiveInfo.breakdown.companies)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.cryptoMining > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                ₿ Crypto Mining: {formatMoney(passiveInfo.breakdown.cryptoMining)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.songs > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🎵 Songs: {formatMoney(passiveInfo.breakdown.songs)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.art > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🎨 Art: {formatMoney(passiveInfo.breakdown.art)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.contracts > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                📋 Contracts: {formatMoney(passiveInfo.breakdown.contracts)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.sponsors > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🤝 Sponsors: {formatMoney(passiveInfo.breakdown.sponsors)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.socialMedia > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                📱 Social Media: {formatMoney(passiveInfo.breakdown.socialMedia)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.patents > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🔬 Patents: {formatMoney(passiveInfo.breakdown.patents)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.businessOpportunities > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                ✈️ Business Opportunities: {formatMoney(passiveInfo.breakdown.businessOpportunities)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.political > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🏛️ Political: {formatMoney(passiveInfo.breakdown.political)}
              </Text>
            </View>
          )}
          {passiveInfo.breakdown.gamingStreaming > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🎮 Gaming/Streaming: {formatMoney(passiveInfo.breakdown.gamingStreaming)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
            Expenses
          </Text>
          <View style={styles.modalItem}>
            <DollarSign size={16} color={settings.darkMode ? '#EF4444' : '#DC2626'} />
            <Text style={[styles.modalText, settings.darkMode && styles.modalTextDark]}>
              Total Expenses: {formatMoney(expenses)}
            </Text>
          </View>
          {expenseInfo.breakdown.upkeep > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🏠 Upkeep: {formatMoney(expenseInfo.breakdown.upkeep)}
              </Text>
            </View>
          )}
          {expenseInfo.breakdown.loans > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                💳 Loans: {formatMoney(expenseInfo.breakdown.loans)}
              </Text>
            </View>
          )}
          {expenseInfo.breakdown.miningPower > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                ⚡ Mining Power: {formatMoney(expenseInfo.breakdown.miningPower)}
              </Text>
            </View>
          )}
          {expenseInfo.breakdown.vehicles > 0 && (
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                🚗 Vehicles: {formatMoney(expenseInfo.breakdown.vehicles)}
              </Text>
            </View>
          )}
        </View>
      </InfoModal>

      <InfoModal
        visible={showPerks}
        title={t('game.perks')}
        onClose={() => setShowPerks(false)}
        darkMode={settings.darkMode}
        t={t}
      >
        {activePerks.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              Active Perks ({activePerks.length})
            </Text>
            {activePerks.map(p => (
              <View key={p.id} style={styles.modalItem}>
                <Star size={16} color={settings.darkMode ? '#F59E0B' : '#D97706'} />
                <Text style={[styles.modalText, settings.darkMode && styles.modalTextDark]}>
                  {p.title}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              No Active Perks
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
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
        darkMode={settings.darkMode}
        t={t}
      >
        {traits.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              Character Traits ({traits.length})
            </Text>
            {traits.map(t => (
              <View key={t} style={styles.traitContainer}>
                <View style={styles.traitHeader}>
                  <Heart size={16} color={settings.darkMode ? '#EF4444' : '#DC2626'} />
                  <Text style={[styles.traitName, settings.darkMode && styles.traitNameDark]}>
                    {capitalize(t)}
                  </Text>
                </View>
                <View style={styles.traitBonuses}>
                  {getTraitBonuses(t).map((bonus, index) => (
                    <View key={index} style={styles.bonusItem}>
                      <Text style={[
                        styles.bonusText, 
                        settings.darkMode && styles.bonusTextDark,
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
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              No Character Traits
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                No traits acquired yet
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showMindset}
        title="Mindset"
        onClose={() => setShowMindset(false)}
        darkMode={settings.darkMode}
        t={t}
      >
        {gameState.mindset?.activeTraitId ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              Active Mindset
            </Text>
            {(() => {
              const activeMindset = MINDSET_TRAITS.find(t => t.id === gameState.mindset?.activeTraitId);
              if (!activeMindset) return null;
              
              return (
                <View style={styles.traitContainer}>
                  <View style={styles.traitHeader}>
                    <Brain size={16} color={settings.darkMode ? '#8B5CF6' : '#6366F1'} />
                    <Text style={[styles.traitName, settings.darkMode && styles.traitNameDark]}>
                      {activeMindset.name}
                    </Text>
                  </View>
                  <View style={styles.traitBonuses}>
                    <View style={styles.bonusItem}>
                      <Text style={[styles.bonusText, settings.darkMode && styles.bonusTextDark]}>
                        {activeMindset.description}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              No Active Mindset
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                No mindset trait is currently active. You can select one during character creation or when continuing your legacy.
              </Text>
            </View>
          </View>
        )}
      </InfoModal>

      <InfoModal
        visible={showModifiers}
        title={t('game.weeklyModifiers')}
        onClose={() => setShowModifiers(false)}
        darkMode={settings.darkMode}
        t={t}
      >
        {weeklyModifiers.length > 0 ? (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              Active Modifiers ({weeklyModifiers.length})
            </Text>
            {weeklyModifiers.map(mod => (
              <View key={mod.label} style={styles.modalItem}>
                <TrendingUp size={16} color={settings.darkMode ? '#3B82F6' : '#2563EB'} />
                <Text style={[styles.modalText, settings.darkMode && styles.modalTextDark]}>
                  {mod.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              No Active Modifiers
            </Text>
            <View style={styles.modalItem}>
              <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                No modifiers this week
              </Text>
            </View>
          </View>
        )}
        
        {weeklyModifiers.length > 0 && (
          <View style={styles.modalSection}>
            <Text style={[styles.modalSectionTitle, settings.darkMode && styles.modalSectionTitleDark]}>
              Effects Breakdown
            </Text>
            {weeklyModifiers.map(mod => (
              <View key={`${mod.label}-effects`} style={styles.modalItem}>
                <Text style={[styles.modalSubText, settings.darkMode && styles.modalSubTextDark]}>
                  <Text style={{ fontWeight: '600' }}>{mod.label}:</Text>
                </Text>
                {Object.entries(mod.changes).map(([stat, value]) => {
                  const formattedValue =
                    stat === 'money'
                      ? formatMoney(Math.abs(value))
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

      {/* Youth Pill Modal */}
      <YouthPillModal 
        visible={showYouthPillModal}
        onClose={() => setShowYouthPillModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
    width: '100%',
  },
  card: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    marginBottom: responsiveSpacing.lg,
    alignItems: 'center',
    width: '100%',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
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
    marginBottom: responsiveSpacing.lg,
    width: '100%',
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
    fontSize: responsiveFontSize.base,
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
  statWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  youthPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.sm,
    gap: 4,
  },
  youthPillIcon: {
    width: 20,
    height: 20,
  },
  youthPillButtonText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  nameContainer: {
    alignItems: 'center',
    width: '100%',
  },
  prestigeBadge: {
    position: 'absolute',
    top: -responsiveSpacing.xs,
    right: -responsiveSpacing.xs,
    zIndex: 10,
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  prestigeBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    gap: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  prestigeBadgeText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
