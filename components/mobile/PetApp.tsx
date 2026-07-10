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
 *
 * Visual system: "Slate Glass". Identity accent = gold #EAB308, used only for
 * identity chrome (hero washes, icon bubbles, value chips, the single modal
 * CTA). Pet health/happiness meters keep their semantic colors as data.
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
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import {
  getGlassCard,
  getGlassIconContainer,
  getGlassCategoryTabsContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { Pet } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

// Identity accent — gold. Solid hex only lands on small CTAs / badges; every
// larger surface uses the translucent tints below.
const GOLD = '#EAB308';
// Dark ink for text on solid gold (white on gold fails contrast).
const GOLD_INK = '#0F172A';
const GOLD_WASH = 'rgba(234, 179, 8, 0.14)';
const GOLD_WASH_TRAIL = 'rgba(234, 179, 8, 0.03)';
const GOLD_GLOW = 'rgba(234, 179, 8, 0.10)';
const GOLD_FILL = 'rgba(234, 179, 8, 0.15)';
const GOLD_FILL_SOFT = 'rgba(234, 179, 8, 0.12)';
const GOLD_RIM = 'rgba(234, 179, 8, 0.30)';
const GOLD_RIM_SOFT = 'rgba(234, 179, 8, 0.28)';
const GOLD_CHIP = 'rgba(234, 179, 8, 0.14)';
const GOLD_TAB = 'rgba(234, 179, 8, 0.16)';
const HAIRLINE = 'rgba(255, 255, 255, 0.08)';
const DANGER_FILL = 'rgba(239, 68, 68, 0.12)';
const DANGER_RIM = 'rgba(239, 68, 68, 0.30)';

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

  // Shared pet-card body — reused by the hero (active pet) and the calmer
  // Recipe A rows for every other pet. `hero` only changes typography + avatar
  // scale; the data/handlers are identical.
  const petBody = (p: Pet, breed: ReturnType<typeof findBreed>, stage: string, hero: boolean) => (
    <>
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setSelectedPetId(p.id)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Select ${p.name}`}
      >
        <View style={[getGlassIconContainer(darkMode, hero ? 60 : 48), styles.goldBubble]}>
          <Text style={hero ? styles.petEmojiHero : styles.petEmojiRow}>{breed?.emoji ?? '🐾'}</Text>
        </View>
        <View style={styles.headerText}>
          {hero ? (
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>ACTIVE COMPANION</Text>
          ) : null}
          <Text
            style={[hero ? styles.heroTitle : styles.cardName, { color: theme.text }]}
            numberOfLines={1}
          >
            {p.name}
          </Text>
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
        <ActionBtn label="Food" Icon={Sparkles} color={accent.warning} theme={theme} onPress={() => setActiveTab('shop')} />
        <ActionBtn label="Play" Icon={Heart} color={accent.danger} theme={theme} onPress={() => handlePlay(p.id)} />
        <ActionBtn label="Sleep" Icon={Activity} color={accent.info} theme={theme} onPress={() => handleSleep(p.id)} />
      </View>
    </>
  );

  // Recipe B hero — the ONE focal gold surface of the Pets tab: the active pet.
  const renderPetHero = (p: Pet) => {
    const breed = findBreed(p.type);
    const stage = lifeStage(p, breed);
    return (
      <View
        key={p.id}
        style={[
          getGlassCard(darkMode, 12),
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
        ]}
      >
        <View style={styles.heroInner}>
          <LinearGradient
            pointerEvents="none"
            colors={[GOLD_WASH, GOLD_WASH_TRAIL]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroGlow} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
          {petBody(p, breed, stage, true)}
        </View>
      </View>
    );
  };

  // Recipe B "adopt your first pet" state — the hero when there are no pets.
  const renderAdoptHero = () => (
    <View
      style={[
        getGlassCard(darkMode, 12),
        styles.heroCard,
        { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
      ]}
    >
      <View style={styles.heroInner}>
        <LinearGradient
          pointerEvents="none"
          colors={[GOLD_WASH, GOLD_WASH_TRAIL]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.heroGlow} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
        <View style={styles.heroContent}>
          <View style={[getGlassIconContainer(darkMode, 56), styles.goldBubble]}>
            <PawPrint size={scale(28)} color={GOLD} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>YOUR FIRST COMPANION</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>No pets yet</Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
              Head to the Shop to adopt your first companion.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Recipe A — calmer card for every non-active pet.
  const renderPetRow = (p: Pet) => {
    const breed = findBreed(p.type);
    const stage = lifeStage(p, breed);
    return (
      <View
        key={p.id}
        style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        {petBody(p, breed, stage, false)}
      </View>
    );
  };

  const renderPets = () => {
    const heroPet = selectedPet;
    const otherPets = heroPet ? pets.filter((p) => p.id !== heroPet.id) : pets;
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {pets.length === 0 ? renderAdoptHero() : renderPetHero(heroPet)}

        <View style={[getGlassCard(darkMode, 6), styles.bondCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.bondTitle, { color: theme.text }]}>Companion bonus</Text>
          <View style={styles.bondRow}>
            <BondStat label="Happiness" value={bonding.playerHappinessDelta} color={accent.danger} theme={theme} />
            <BondStat label="Health" value={bonding.playerHealthDelta} color={accent.success} theme={theme} />
            <BondStat label="Healthy pets" value={bonding.healthyPetCount} color={accent.info} theme={theme} />
          </View>
          {bonding.hasCriticalPet ? (
            <View style={[styles.warningBanner, { backgroundColor: DANGER_FILL, borderColor: DANGER_RIM }]}>
              <Skull size={scale(14)} color={accent.danger} />
              <Text style={[styles.warningText, { color: accent.danger }]}>
                A pet is in critical condition — feed or visit the vet.
              </Text>
            </View>
          ) : null}
        </View>

        {otherPets.length > 0 ? (
          <View style={styles.section}>{otherPets.map((p) => renderPetRow(p))}</View>
        ) : null}

        {deadPets.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>In memoriam</Text>
            {deadPets.map((p) => (
              <View
                key={p.id}
                style={[getGlassCard(darkMode, 6), styles.memoryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[getGlassIconContainer(darkMode, 40), styles.goldBubbleSoft]}>
                  <Text style={styles.memoryEmoji}>{findBreed(p.type)?.emoji ?? '🐾'}</Text>
                </View>
                <View style={styles.headerText}>
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
  };

  const renderShop = () => (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      <TabHero
        theme={theme}
        darkMode={darkMode}
        eyebrow="PET SHOP"
        title={selectedPet ? `Shopping for ${selectedPet.name}` : 'Browse & adopt'}
        sub={selectedPet ? 'Stock up on food and toys, or adopt a new friend.' : 'Adopt a companion to start caring for it.'}
        Icon={ShoppingBag}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Feed your pets</Text>
        {PET_FOODS.map((f) => {
          const owned = gameState.petFood?.[f.id] ?? 0;
          return (
            <View
              key={f.id}
              style={[getGlassCard(darkMode, 6), styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                <Text style={styles.shopEmoji}>{f.emoji}</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.cardName, { color: theme.text }]}>{f.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  +{f.nutrition} hunger {f.healthBonus ? `· +${f.healthBonus} health` : ''} · ${f.price.toLocaleString()}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>Have: {owned}</Text>
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.chipBase, styles.goldChip]}
                  onPress={() => handleBuyFood(f.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Buy ${f.name}`}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>Buy</Text>
                </TouchableOpacity>
                {selectedPet && owned > 0 ? (
                  <TouchableOpacity
                    style={[styles.chipBase, styles.goldChip]}
                    onPress={() => handleFeed(selectedPet.id, f.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Feed ${f.name} to ${selectedPet.name}`}
                  >
                    <Text style={[styles.chipText, { color: theme.text }]}>Feed</Text>
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
                style={[getGlassCard(darkMode, 6), styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                  <Text style={styles.shopEmoji}>{toy.emoji}</Text>
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.cardName, { color: theme.text }]}>{toy.name}</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    +{toy.fun} fun · ${toy.price.toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={owned}
                  style={[styles.chipBase, owned ? { backgroundColor: theme.surfaceElevated } : styles.goldChip]}
                  onPress={() => handleBuyToy(selectedPet.id, toy.id)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: owned }}
                  accessibilityLabel={owned ? `${toy.name} already owned` : `Buy ${toy.name}`}
                >
                  <Text style={[styles.chipText, { color: owned ? theme.textMuted : theme.text }]}>
                    {owned ? 'Owned' : 'Buy'}
                  </Text>
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
            style={[getGlassCard(darkMode, 6), styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
              <Text style={styles.shopEmoji}>{b.emoji}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.cardName, { color: theme.text }]}>{b.name}</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                {b.lifespan}y lifespan · ${b.price.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.chipBase, styles.goldChip]}
              onPress={() => setBuyModal(b.id)}
              accessibilityRole="button"
              accessibilityLabel={`Adopt ${b.name}`}
            >
              <Text style={[styles.chipText, { color: theme.text }]}>Adopt</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderVet = () => (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      <TabHero
        theme={theme}
        darkMode={darkMode}
        eyebrow="VET CLINIC"
        title={selectedPet ? selectedPet.name : 'No patient'}
        sub={
          selectedPet
            ? `Health ${selectedPet.health ?? 0}/100${selectedPet.isSick ? ` · sick: ${selectedPet.sickness}` : ''}${selectedPet.vaccinated ? ' · vaccinated' : ''}`
            : 'Adopt a pet first to visit the vet.'
        }
        Icon={Stethoscope}
      />
      {selectedPet ? (
        <View style={styles.section}>
          {VET_SERVICES.map((s) => (
            <View
              key={s.id}
              style={[getGlassCard(darkMode, 6), styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                <Text style={styles.shopEmoji}>{s.emoji}</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.cardName, { color: theme.text }]}>{s.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {s.description} · ${s.price.toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.chipBase, styles.goldChip]}
                onPress={() => handleVet(selectedPet.id, s.id)}
                accessibilityRole="button"
                accessibilityLabel={`Book ${s.name}`}
              >
                <Text style={[styles.chipText, { color: theme.text }]}>Book</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );

  const renderCompete = () => (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      <TabHero
        theme={theme}
        darkMode={darkMode}
        eyebrow="COMPETITION ARENA"
        title={selectedPet ? selectedPet.name : 'No competitor'}
        sub={
          selectedPet
            ? `${selectedPet.competitionWins ?? 0} wins so far`
            : 'Adopt a pet first to enter competitions.'
        }
        Icon={Trophy}
      />
      {selectedPet ? (
        <View style={styles.section}>
          {PET_COMPETITIONS.map((c) => {
            const evalResult = evaluatePetForCompetition(selectedPet, c.id);
            if (!evalResult) return null;
            const winPct = Math.round(evalResult.winProbability * 100);
            const eligible = evalResult.meetsRequirement;
            return (
              <View
                key={c.id}
                style={[getGlassCard(darkMode, 6), styles.shopRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                  <Text style={styles.shopEmoji}>{c.emoji}</Text>
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Entry ${c.entryFee.toLocaleString()} · Prize ${c.prize.toLocaleString()}
                  </Text>
                  <Text style={[styles.cardMeta, { color: eligible ? accent.success : accent.warning }]}>
                    {eligible ? `Win chance: ${winPct}%` : `Need ${c.requirement} ≥ ${c.minValue} (have ${evalResult.gatingValue})`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.chipBase, eligible ? styles.goldChip : { backgroundColor: theme.surfaceElevated }]}
                  onPress={() => handleCompete(selectedPet.id, c.id)}
                  disabled={!eligible}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !eligible }}
                  accessibilityLabel={`Enter ${c.name}`}
                >
                  <Text style={[styles.chipText, { color: eligible ? theme.text : theme.textMuted }]}>Enter</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Pets</Text>
        <View style={[styles.cashChip, { backgroundColor: GOLD_CHIP, borderColor: GOLD_RIM }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>${money.toLocaleString()}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, getGlassCategoryTabsContainer(darkMode)]}>
        {[
          { id: 'pets' as TabType, label: 'Pets', Icon: PawPrint },
          { id: 'shop' as TabType, label: 'Shop', Icon: ShoppingBag },
          { id: 'vet' as TabType, label: 'Vet', Icon: Stethoscope },
          { id: 'compete' as TabType, label: 'Compete', Icon: Trophy },
        ].map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setActiveTab(id)}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <Icon size={scale(16)} color={active ? GOLD : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? theme.text : theme.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'pets' && renderPets()}
      {activeTab === 'shop' && renderShop()}
      {activeTab === 'vet' && renderVet()}
      {activeTab === 'compete' && renderCompete()}

      <Modal visible={!!buyModal} transparent animationType="fade" onRequestClose={() => setBuyModal(null)}>
        <View style={styles.modalScrim}>
          <View
            style={[
              getGlassCard(darkMode, 12),
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Name your new companion</Text>
            <TextInput
              value={petName}
              onChangeText={setPetName}
              placeholder="e.g. Rex"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.chipBase, { backgroundColor: theme.surfaceElevated }]}
                onPress={() => setBuyModal(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.chipText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chipBase, styles.primaryGold, getPlatformShadows(5, 0.3, 2, 8)]}
                onPress={() => buyModal && handleBuy(buyModal, petName.trim())}
                accessibilityRole="button"
                accessibilityLabel="Adopt"
              >
                <Text style={[styles.chipText, { color: GOLD_INK }]}>Adopt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {feedback ? (
        <View
          style={[
            styles.toast,
            getPlatformShadows(6, 0.2, 3, 16),
            { bottom: getAppScreenBottomPadding(insets.bottom), backgroundColor: theme.surface, borderColor: GOLD_RIM },
          ]}
        >
          <Text style={{ color: theme.text }}>{feedback}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Recipe B context hero for the Shop / Vet / Compete tabs — one gold focal
// surface per tab, carrying the active-pet context.
function TabHero({
  theme,
  darkMode,
  eyebrow,
  title,
  sub,
  Icon,
}: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  eyebrow: string;
  title: string;
  sub: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}) {
  return (
    <View
      style={[
        getGlassCard(darkMode, 12),
        styles.heroCard,
        { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
      ]}
    >
      <View style={styles.heroInner}>
        <LinearGradient
          pointerEvents="none"
          colors={[GOLD_WASH, GOLD_WASH_TRAIL]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.heroGlow} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
        <View style={styles.heroContent}>
          <View style={[getGlassIconContainer(darkMode, 48), styles.goldBubble]}>
            <Icon size={scale(22)} color={GOLD} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>{eyebrow}</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            {sub ? <Text style={[styles.heroSub, { color: theme.textSecondary }]}>{sub}</Text> : null}
          </View>
        </View>
      </View>
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
  theme,
  onPress,
}: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={scale(16)} color={color} />
      <Text style={[styles.actionBtnText, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.lg },

  // Top bar — no bottom border; the segmented tab strip below anchors the screen.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    gap: sp.sm,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: fs.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: br.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: fs.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Segmented tab control.
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: sp.md,
    marginTop: sp.sm,
    marginBottom: sp.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: sp.sm,
    borderRadius: br.lg,
  },
  tabBtnActive: { backgroundColor: GOLD_TAB },
  tabText: { fontSize: fs.sm, fontWeight: '600' },

  // Hero (Recipe B) anatomy: outer carries shadow+radius+border+fill (no clip);
  // heroInner clips the gold wash / glow / hairline to the radius.
  heroCard: { borderWidth: 1, borderRadius: br['2xl'] },
  heroInner: {
    borderRadius: br['2xl'],
    overflow: 'hidden',
    padding: sp.md,
    gap: sp.xs,
  },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  heroGlow: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: GOLD_GLOW,
  },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: HAIRLINE },
  heroEyebrow: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: 2 },
  heroTitle: { fontSize: fs['2xl'], fontWeight: '800' },
  heroSub: { fontSize: fs.sm, marginTop: 2 },

  // Tinted icon bubbles (Recipe C).
  goldBubble: { backgroundColor: GOLD_FILL, borderWidth: 1, borderColor: GOLD_RIM },
  goldBubbleSoft: { backgroundColor: GOLD_FILL_SOFT, borderWidth: 1, borderColor: GOLD_RIM_SOFT },

  // Cards / rows.
  card: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  headerText: { flex: 1 },
  cardName: { fontSize: fs.md, fontWeight: '800' },
  cardSub: { fontSize: fs.xs, marginTop: 2 },
  cardMeta: { fontSize: fs.xs, marginTop: 2 },
  petEmojiHero: { fontSize: scale(34) },
  petEmojiRow: { fontSize: scale(26) },

  statBarRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.xs },
  statBarLabel: { fontSize: fs.xs, width: scale(70) },
  statBar: { flex: 1, height: scale(6), borderRadius: br.full, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: br.full },
  statBarValue: { fontSize: fs.xs, fontWeight: '700', width: scale(28), textAlign: 'right', fontVariant: ['tabular-nums'] },

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
  actionBtnText: { fontSize: fs.sm, fontWeight: '700' },

  badge: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full },
  badgeText: { color: 'white', fontSize: fs.xs, fontWeight: '800' },

  bondCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  bondTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },
  bondRow: { flexDirection: 'row', justifyContent: 'space-around' },
  bondStat: { alignItems: 'center' },
  bondValue: { fontSize: fs.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bondLabel: { fontSize: fs.xs },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.md, borderWidth: 1 },
  warningText: { fontSize: fs.xs, fontWeight: '700', flex: 1 },

  shopRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  shopEmoji: { fontSize: scale(22) },
  rowActions: { gap: sp.xs },

  // Chips: base geometry, plus a gold-tinted or solid-gold variant.
  chipBase: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: br.md,
    minHeight: scale(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldChip: { backgroundColor: GOLD_CHIP, borderWidth: 1, borderColor: GOLD_RIM },
  chipText: { fontSize: fs.sm, fontWeight: '700' },
  primaryGold: { backgroundColor: GOLD },

  section: { gap: sp.sm },
  sectionTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },

  memoryCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1, opacity: 0.75 },
  memoryEmoji: { fontSize: scale(20), opacity: 0.8 },

  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: sp.md },
  modalCard: { width: '100%', maxWidth: 420, padding: sp.lg, borderRadius: br['2xl'], borderWidth: 1, gap: sp.md },
  modalTitle: { fontSize: fs.lg, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: br.md, paddingHorizontal: sp.md, paddingVertical: sp.sm, fontSize: fs.md },
  modalActions: { flexDirection: 'row', gap: sp.sm, justifyContent: 'flex-end' },

  toast: {
    position: 'absolute',
    left: sp.md,
    right: sp.md,
    padding: sp.md,
    borderRadius: br.xl,
    borderWidth: 1,
  },
});
