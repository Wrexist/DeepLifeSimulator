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
import { useGame } from '@/contexts/GameContext';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { Asset, Liability, computeNetWorth } from '@/utils/netWorth';
import { perks as allPerks } from '@/src/features/onboarding/perksData';

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
}

function InfoModal({ visible, title, onClose, darkMode, children }: InfoModalProps) {
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modal, darkMode && styles.modalDark]}>
          <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>{title}</Text>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function IdentityCard() {
  const { gameState } = useGame();
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
      ? `Married to ${partner.name}`
      : `In Relationship with ${partner.name}`
    : 'Single';
  const currentCareer = gameState.careers.find(c => c.id === gameState.currentJob);
  const job = currentCareer
    ? `${currentCareer.levels[currentCareer.level].name} (${currentCareer.name})`
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

  const activePerks = allPerks.filter(p => gameState.perks?.[p.id]);
  const derivedTraits: string[] = [];
  if (gameState.stats.happiness >= 70) derivedTraits.push('happy');
  else if (gameState.stats.happiness <= 30) derivedTraits.push('sad');
  if (gameState.stats.health >= 70) derivedTraits.push('healthy');
  else if (gameState.stats.health <= 30) derivedTraits.push('sick');
  if (gameState.stats.energy >= 70) derivedTraits.push('energetic');
  else if (gameState.stats.energy <= 30) derivedTraits.push('tired');
  const traits = [...(scenario?.start.traits || []), ...derivedTraits];

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
      <View style={[styles.card, gameState.settings.darkMode && styles.cardDark]}>
        <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>◆ {name} ◆</Text>
        <Image source={avatar} style={styles.avatar} />
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>
          Life Scenario: {scenario?.title || 'Unknown'}
        </Text>
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>
          Age: {Math.floor(gameState.date.age)}
        </Text>
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>
          Sex: {capitalize(sex)}
        </Text>
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>
          Sexuality: {capitalize(sexuality)}
        </Text>
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>
          Relationship Status: {relationshipStatus}
        </Text>
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>Job: {job}</Text>
        <Text style={[styles.text, gameState.settings.darkMode && styles.textDark]}>
          Net Worth: ${netWorth.toLocaleString()}
        </Text>
      </View>

      <View style={[styles.list, gameState.settings.darkMode && styles.cardDark]}>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowCash(true)}>
          <Text style={[styles.listLabel, gameState.settings.darkMode && styles.textDark]}>
            Weekly Cash Flow: ${cashFlow.toFixed(0)}
          </Text>
          <Text style={[styles.arrow, gameState.settings.darkMode && styles.textDark]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowPerks(true)}>
          <Text style={[styles.listLabel, gameState.settings.darkMode && styles.textDark]}>
            {perksCount} Perks
          </Text>
          <Text style={[styles.arrow, gameState.settings.darkMode && styles.textDark]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowTraits(true)}>
          <Text style={[styles.listLabel, gameState.settings.darkMode && styles.textDark]}>
            {traitsCount} Traits
          </Text>
          <Text style={[styles.arrow, gameState.settings.darkMode && styles.textDark]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => setShowModifiers(true)}>
          <Text style={[styles.listLabel, gameState.settings.darkMode && styles.textDark]}>Weekly Modifiers</Text>
          <Text style={[styles.arrow, gameState.settings.darkMode && styles.textDark]}>›</Text>
        </TouchableOpacity>
      </View>

      <InfoModal
        visible={showCash}
        title="Weekly Cash Flow"
        onClose={() => setShowCash(false)}
        darkMode={gameState.settings.darkMode}
      >
        <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
          Job Income: ${jobIncome.toFixed(0)}
        </Text>
        <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
          Passive Income: ${passive.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Stocks: ${passiveInfo.breakdown.stocks.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Real Estate: ${passiveInfo.breakdown.realEstate.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Songs: ${passiveInfo.breakdown.songs.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Art: ${passiveInfo.breakdown.art.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Contracts: ${passiveInfo.breakdown.contracts.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Sponsors: ${passiveInfo.breakdown.sponsors.toFixed(0)}
        </Text>
        <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
          Expenses: ${expenses.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Upkeep: ${expenseInfo.breakdown.upkeep.toFixed(0)}
        </Text>
        <Text style={[styles.modalSubText, gameState.settings.darkMode && styles.modalTextDark]}>
          Loans: ${expenseInfo.breakdown.loans.toFixed(0)}
        </Text>
      </InfoModal>

      <InfoModal
        visible={showPerks}
        title="Perks"
        onClose={() => setShowPerks(false)}
        darkMode={gameState.settings.darkMode}
      >
        {activePerks.length > 0 ? (
          activePerks.map(p => (
            <Text
              key={p.id}
              style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}
            >
              {p.title}
            </Text>
          ))
        ) : (
          <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
            No perks
          </Text>
        )}
      </InfoModal>

      <InfoModal
        visible={showTraits}
        title="Traits"
        onClose={() => setShowTraits(false)}
        darkMode={gameState.settings.darkMode}
      >
        {traits.length > 0 ? (
          traits.map(t => (
            <Text
              key={t}
              style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}
            >
              {capitalize(t)}
            </Text>
          ))
        ) : (
          <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
            No traits
          </Text>
        )}
      </InfoModal>

      <InfoModal
        visible={showModifiers}
        title="Weekly Modifiers"
        onClose={() => setShowModifiers(false)}
        darkMode={gameState.settings.darkMode}
      >
        {weeklyModifiers.length > 0 ? (
          weeklyModifiers.map(mod => (
            <View key={mod.label} style={styles.modifierItem}>
              <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
                {mod.label}
              </Text>
              {Object.entries(mod.changes).map(([stat, value]) => {
                const formattedValue =
                  stat === 'money'
                    ? `$${Math.abs(value).toLocaleString()}`
                    : Math.abs(value);
                return (
                  <Text
                    key={stat}
                    style={[
                      styles.modalSubText,
                      value >= 0 ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {`${stat.charAt(0).toUpperCase() + stat.slice(1)}: ${
                      value > 0 ? '+' : ''
                    }${formattedValue}`}
                  </Text>
                );
              })}
            </View>
          ))
        ) : (
          <Text style={[styles.modalText, gameState.settings.darkMode && styles.modalTextDark]}>
            No modifiers this week
          </Text>
        )}
      </InfoModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  avatar: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 2,
  },
  textDark: {
    color: '#D1D5DB',
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  listLabel: {
    fontSize: 16,
    color: '#374151',
  },
  arrow: {
    fontSize: 16,
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '80%',
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalContent: {
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  modalTextDark: {
    color: '#D1D5DB',
  },
  modalSubText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    marginBottom: 2,
  },
  modifierItem: {
    marginBottom: 8,
  },
  positiveText: {
    color: '#059669',
  },
  negativeText: {
    color: '#DC2626',
  },
  closeButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#3B82F6',
  },
});
