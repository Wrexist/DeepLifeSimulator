/**
 * PetApp — full rewrite (Remake 11).
 *
 * Previous app was 17.7k LOC of decoration sitting on shallow toggles. The
 * new app delegates all logic to pure libs in `lib/pets/`:
 *   - catalog.ts   → breeds, foods, toys, vet services, competitions
 *   - lifecycle.ts → life-stage classification
 *   - decay.ts     → weekly hunger/energy/health drift (NEW — pets now decay)
 *   - bonding.ts   → player happiness/health buff from owning healthy pets
 *   - competition.ts → win-probability math players can see and react to
 *
 * UI is four tabs: Pets / Shop / Vet / Compete. Each one is small and reads
 * the pure libs for display.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import {
  ArrowLeft,
  Heart,
  Activity,
  Stethoscope,
  Trophy,
  ShoppingBag,
  Skull,
  Sparkles,
  PawPrint,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTimerManager } from '@/hooks/useTimerManager';
import {
  PET_BREEDS,
  PET_FOODS,
  PET_TOYS,
  VET_SERVICES,
  PET_COMPETITIONS,
  findBreed,
} from '@/lib/pets/catalog';
import { ageInYears, lifeStage } from '@/lib/pets/lifecycle';
import { bondingSummary } from '@/lib/pets/bonding';
import { evaluatePetForCompetition } from '@/lib/pets/competition';
import {
  buyPet,
  feedPet,
  buyFood,
  buyToy,
  playWithPet,
  petSleep,
  payForVet,
  enterCompetition,
} from '@/contexts/game/actions/PetActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  getTabBarSafePadding,
} from '@/utils/scaling';
import { Pet } from '@/contexts/game/types';

type TabType = 'pets' | 'shop' | 'vet' | 'compete';

interface PetAppProps {
  onBack: () => void;
}

export default function PetApp({ onBack }: PetAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  // Auto-cleaned timers so the feedback-clear flash can't setState after unmount.
  const timers = useTimerManager();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('pets');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [buyModal, setBuyModal] = useState<string | null>(null); // breed id
  const [petName, setPetName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const pets = useMemo(() => (gameState.pets ?? []).filter((p) => !p.isDead), [gameState.pets]);
  const deadPets = useMemo(() => (gameState.pets ?? []).filter((p) => p.isDead), [gameState.pets]);
  const bonding = useMemo(() => bondingSummary(pets), [pets]);
  const week = gameState.weeksLived || 0;
  const money = gameState.stats?.money ?? 0;

  const flash = useCallback((message: string) => {
    setFeedback(message);
    timers.setTimeout(() => setFeedback(null), 2500);
  }, [timers]);

  const handleBuy = useCallback(
    (breedId: string, name: string) => {
      const r = buyPet(gameState, setGameState, breedId, name, { updateMoney });
      if (r.success) {
        saveGame();
        setSelectedPetId(r.petId ?? null);
        setBuyModal(null);
        setPetName('');
        setActiveTab('pets');
      }
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleFeed = useCallback(
    (petId: string, foodId: string) => {
      const r = feedPet(gameState, setGameState, petId, foodId);
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleBuyFood = useCallback(
    (foodId: string) => {
      const r = buyFood(gameState, setGameState, foodId, 1, { updateMoney });
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleBuyToy = useCallback(
    (petId: string, toyId: string) => {
      const r = buyToy(gameState, setGameState, petId, toyId, { updateMoney });
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handlePlay = useCallback(
    (petId: string) => {
      const r = playWithPet(gameState, setGameState, petId);
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleSleep = useCallback(
    (petId: string) => {
      const r = petSleep(gameState, setGameState, petId);
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash]
  );

  const handleVet = useCallback(
    (petId: string, serviceId: string) => {
      const r = payForVet(gameState, setGameState, petId, serviceId, { updateMoney }, week);
      if (r.success) saveGame();
      flash(r.message);
    },
    [gameState, setGameState, saveGame, flash, week]
  );

  const handleCompete = useCallback(
    (petId: string, compId: string) => {
      const r = enterCompetition(
        gameState,
        setGameState,
        petId,
        compId,
        { updateMoney },
        Math.random()
      );
      if (r.success) {
        saveGame();
        Alert.alert(r.won ? '🏆 Victory!' : 'Better luck next time', r.message);
      } else {
        flash(r.message);
      }
    },
    [gameState, setGameState, saveGame, flash]
  );

  const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0];

  const renderPets = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      <View style={[styles.bondCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.bondTitle, { color: theme.text }]}>Companion bonus</Text>
        <View style={styles.bondRow}>
          <BondStat label="Happiness" value={bonding.playerHappinessDelta} color={accent.danger} theme={theme} />
          <BondStat label="Health" value={bonding.playerHealthDelta} color={accent.success} theme={theme} />
          <BondStat label="Healthy pets" value={bonding.healthyPetCount} color={accent.info} theme={theme} />
        </View>
        {bonding.hasCriticalPet ? (
          <View style={[styles.warningBanner, { borderColor: accent.danger }]}>
            <Skull size={scale(14)} color={accent.danger} />
            <Text style={[styles.warningText, { color: accent.danger }]}>
              A pet is in critical condition — feed or visit the vet.
            </Text>
          </View>
        ) : null}
      </View>

      {pets.length === 0 ? (
        <View style={styles.empty}>
          <PawPrint size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No pets yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Head to the Shop to adopt your first companion.
          </Text>
        </View>
      ) : (
        pets.map((p) => renderPetCard(p))
      )}

      {deadPets.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>In memoriam</Text>
          {deadPets.map((p) => (
            <View
              key={p.id}
              style={[styles.memoryCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            >
              <Text style={[styles.memoryEmoji]}>{findBreed(p.type)?.emoji ?? '🐾'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>{p.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {findBreed(p.type)?.name} · lived {ageInYears(p)} years
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );

  const renderPetCard = (p: Pet) => {
    const breed = findBreed(p.type);
    const stage = lifeStage(p, breed);
    const isSelected = selectedPetId === p.id || (!selectedPetId && pets[0]?.id === p.id);
    return (
      <View
        key={p.id}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: isSelected ? accent.info : theme.border },
        ]}
      >
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setSelectedPetId(p.id)}
          activeOpacity={0.85}
        >
          <Text style={styles.petEmoji}>{breed?.emoji ?? '🐾'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]}>{p.name}</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              {breed?.name ?? 'Unknown'} · {stage} · {ageInYears(p)}y
            </Text>
            {p.isSick ? (
              <Text style={[styles.cardSub, { color: accent.danger }]}>Sick: {p.sickness}</Text>
            ) : null}
          </View>
          {p.vaccinated ? (
            <View style={[styles.badge, { backgroundColor: accent.success }]}>
              <Text style={styles.badgeText}>VAX</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <StatBar label="Hunger" value={p.hunger ?? 0} color={accent.warning} theme={theme} />
        <StatBar label="Happiness" value={p.happiness ?? 0} color={accent.danger} theme={theme} />
        <StatBar label="Health" value={p.health ?? 0} color={accent.success} theme={theme} />
        <StatBar label="Energy" value={p.energy ?? 0} color={accent.info} theme={theme} />

        <View style={styles.actionsRow}>
          <ActionBtn label="Feed" Icon={Sparkles} color={accent.warning} onPress={() => setActiveTab('shop')} />
          <ActionBtn label="Play" Icon={Heart} color={accent.danger} onPress={() => handlePlay(p.id)} />
          <ActionBtn label="Sleep" Icon={Activity} color={accent.info} onPress={() => handleSleep(p.id)} />
        </View>
      </View>
    );
  };

  const renderShop = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Feed your pets</Text>
        {selectedPet ? (
          <View style={[styles.miniCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              Feeding: {selectedPet.name}
            </Text>
          </View>
        ) : (
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Adopt a pet first.</Text>
        )}
        {PET_FOODS.map((f) => {
          const owned = gameState.petFood?.[f.id] ?? 0;
          return (
            <View
              key={f.id}
              style={[styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={styles.shopEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>{f.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  +{f.nutrition} hunger {f.healthBonus ? `· +${f.healthBonus} health` : ''} · ${f.price.toLocaleString()}
                </Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  Have: {owned}
                </Text>
              </View>
              <View style={{ gap: sp.xs }}>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: accent.success }]}
                  onPress={() => handleBuyFood(f.id)}
                >
                  <Text style={styles.smallBtnText}>Buy</Text>
                </TouchableOpacity>
                {selectedPet && owned > 0 ? (
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: accent.info }]}
                    onPress={() => handleFeed(selectedPet.id, f.id)}
                  >
                    <Text style={styles.smallBtnText}>Feed</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {selectedPet ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Toys for {selectedPet.name}</Text>
          {PET_TOYS.map((toy) => {
            const owned = (selectedPet.toys ?? []).includes(toy.id);
            return (
              <View
                key={toy.id}
                style={[styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={styles.shopEmoji}>{toy.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: theme.text }]}>{toy.name}</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    +{toy.fun} fun · ${toy.price.toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={owned}
                  style={[
                    styles.smallBtn,
                    { backgroundColor: owned ? accent.muted : accent.success },
                  ]}
                  onPress={() => handleBuyToy(selectedPet.id, toy.id)}
                >
                  <Text style={styles.smallBtnText}>{owned ? 'Owned' : 'Buy'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Adopt a pet</Text>
        {PET_BREEDS.map((b) => (
          <View
            key={b.id}
            style={[styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={styles.shopEmoji}>{b.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: theme.text }]}>{b.name}</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                {b.lifespan}y lifespan · ${b.price.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: accent.info }]}
              onPress={() => setBuyModal(b.id)}
            >
              <Text style={styles.smallBtnText}>Adopt</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderVet = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      {selectedPet ? (
        <View style={[styles.miniCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Patient: {selectedPet.name} · health {selectedPet.health}/100
            {selectedPet.isSick ? ` · sick: ${selectedPet.sickness}` : ''}
            {selectedPet.vaccinated ? ' · vaccinated' : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <Stethoscope size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Adopt a pet first.</Text>
        </View>
      )}
      {selectedPet
        ? VET_SERVICES.map((s) => (
            <View
              key={s.id}
              style={[styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={styles.shopEmoji}>{s.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>{s.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {s.description} · ${s.price.toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: accent.danger }]}
                onPress={() => handleVet(selectedPet.id, s.id)}
              >
                <Text style={styles.smallBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          ))
        : null}
    </ScrollView>
  );

  const renderCompete = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      {selectedPet ? (
        <View style={[styles.miniCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Entering: {selectedPet.name} · {selectedPet.competitionWins ?? 0} wins
          </Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <Trophy size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Adopt a pet first.</Text>
        </View>
      )}
      {selectedPet
        ? PET_COMPETITIONS.map((c) => {
            const evalResult = evaluatePetForCompetition(selectedPet, c.id);
            if (!evalResult) return null;
            const winPct = Math.round(evalResult.winProbability * 100);
            return (
              <View
                key={c.id}
                style={[styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={styles.shopEmoji}>{c.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Entry ${c.entryFee.toLocaleString()} · Prize ${c.prize.toLocaleString()}
                  </Text>
                  <Text
                    style={[
                      styles.cardSub,
                      { color: evalResult.meetsRequirement ? accent.success : accent.warning },
                    ]}
                  >
                    {evalResult.meetsRequirement ? `Win chance: ${winPct}%` : `Need ${c.requirement} ≥ ${c.minValue} (have ${evalResult.gatingValue})`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.smallBtn,
                    { backgroundColor: evalResult.meetsRequirement ? accent.gold : accent.muted },
                  ]}
                  onPress={() => handleCompete(selectedPet.id, c.id)}
                  disabled={!evalResult.meetsRequirement}
                >
                  <Text style={styles.smallBtnText}>Enter</Text>
                </TouchableOpacity>
              </View>
            );
          })
        : null}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <ArrowLeft size={scale(18)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Pets</Text>
        <Text style={[styles.headerCash, { color: accent.success }]}>${money.toLocaleString()}</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {[
          { id: 'pets' as TabType, label: 'Pets', Icon: PawPrint },
          { id: 'shop' as TabType, label: 'Shop', Icon: ShoppingBag },
          { id: 'vet' as TabType, label: 'Vet', Icon: Stethoscope },
          { id: 'compete' as TabType, label: 'Compete', Icon: Trophy },
        ].map(({ id, label, Icon }) => (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            style={[
              styles.tabBtn,
              activeTab === id && { borderBottomColor: accent.info, borderBottomWidth: 2 },
            ]}
          >
            <Icon size={scale(14)} color={activeTab === id ? accent.info : theme.textSecondary} />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === id ? accent.info : theme.textSecondary },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'pets' && renderPets()}
      {activeTab === 'shop' && renderShop()}
      {activeTab === 'vet' && renderVet()}
      {activeTab === 'compete' && renderCompete()}

      <Modal visible={!!buyModal} transparent animationType="fade" onRequestClose={() => setBuyModal(null)}>
        <View style={styles.modalScrim}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Name your new companion</Text>
            <TextInput
              value={petName}
              onChangeText={setPetName}
              placeholder="e.g. Rex"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: accent.muted }]}
                onPress={() => setBuyModal(null)}
              >
                <Text style={styles.smallBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: accent.success }]}
                onPress={() => buyModal && handleBuy(buyModal, petName.trim())}
              >
                <Text style={styles.smallBtnText}>Adopt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {feedback ? (
        <View style={[styles.toast, { bottom: getTabBarSafePadding(insets.bottom), backgroundColor: theme.surface, borderColor: accent.info }]}>
          <Text style={{ color: theme.text }}>{feedback}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StatBar({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.statBarRow}>
      <Text style={[styles.statBarLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={[styles.statBar, { backgroundColor: theme.surfaceElevated }]}>
        <View
          style={[
            styles.statBarFill,
            { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.statBarValue, { color: theme.text }]}>{Math.round(value)}</Text>
    </View>
  );
}

function BondStat({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  const display = typeof value === 'number' && value > 0 ? `+${value}` : `${value}`;
  return (
    <View style={styles.bondStat}>
      <Text style={[styles.bondValue, { color }]}>{display}</Text>
      <Text style={[styles.bondLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ActionBtn({
  label,
  Icon,
  color,
  onPress,
}: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionBtn, { backgroundColor: color }]}
      activeOpacity={0.85}
    >
      <Icon size={scale(14)} color="white" />
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs.xl, fontWeight: '800' },
  headerCash: { fontSize: fs.md, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: sp.xs },
  tabText: { fontSize: fs.sm, fontWeight: '700' },
  card: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  cardName: { fontSize: fs.md, fontWeight: '800' },
  cardSub: { fontSize: fs.xs, marginTop: 2 },
  petEmoji: { fontSize: scale(40) },
  statBarRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.xs },
  statBarLabel: { fontSize: fs.xs, width: scale(70) },
  statBar: { flex: 1, height: scale(6), borderRadius: br.full, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: br.full },
  statBarValue: { fontSize: fs.xs, fontWeight: '700', width: scale(28), textAlign: 'right' },
  actionsRow: { flexDirection: 'row', gap: sp.xs, marginTop: sp.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: br.md,
    flex: 1,
    justifyContent: 'center',
  },
  actionBtnText: { color: 'white', fontSize: fs.sm, fontWeight: '700' },
  badge: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full },
  badgeText: { color: 'white', fontSize: fs.xs, fontWeight: '800' },
  bondCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.sm },
  bondTitle: { fontSize: fs.sm, fontWeight: '800' },
  bondRow: { flexDirection: 'row', justifyContent: 'space-around' },
  bondStat: { alignItems: 'center' },
  bondValue: { fontSize: fs.lg, fontWeight: '800' },
  bondLabel: { fontSize: fs.xs },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.md, borderWidth: 1 },
  warningText: { fontSize: fs.xs, fontWeight: '700', flex: 1 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  shopEmoji: { fontSize: scale(28) },
  smallBtn: { paddingHorizontal: sp.md, paddingVertical: sp.sm, borderRadius: br.md, alignItems: 'center' },
  smallBtnText: { color: 'white', fontSize: fs.sm, fontWeight: '700' },
  miniCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  section: { gap: sp.sm },
  sectionTitle: { fontSize: fs.sm, fontWeight: '800', textTransform: 'uppercase' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  memoryCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  memoryEmoji: { fontSize: scale(24), opacity: 0.6 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: sp.md },
  modalCard: { width: '100%', maxWidth: 420, padding: sp.lg, borderRadius: br.lg, borderWidth: 1, gap: sp.md },
  modalTitle: { fontSize: fs.lg, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: br.md, paddingHorizontal: sp.md, paddingVertical: sp.sm, fontSize: fs.md },
  modalActions: { flexDirection: 'row', gap: sp.sm, justifyContent: 'flex-end' },
  toast: {
    position: 'absolute',
    bottom: sp.lg,
    left: sp.md,
    right: sp.md,
    padding: sp.md,
    borderRadius: br.lg,
    borderWidth: 1,
  },
});
