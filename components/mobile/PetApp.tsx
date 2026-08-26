/**
 * PetApp - Tamagotchi / Fitness DNA pass (Remake 12).
 *
 * Skeleton (deliberately NOT "eyebrow hero + uniform rows"):
 *   - Pets tab   → a portrait STAGE: the active companion's emoji on a soft
 *                  radial mat flanked by TWO ProgressRings (Health / Happiness),
 *                  bond-level stars, a chunky care pad (Feed/Play/Sleep/Vet),
 *                  and a Stories-style avatar RAIL for every other companion.
 *                  Tapping "View full profile" drills into a rich per-pet PAGE
 *                  that surfaces breed traits, life-stage math, bond
 *                  contribution, a care log, and the toy chest.
 *   - Shop tab   → a GRID of item tiles (food / toys / breeds) with price
 *                  buttons.
 *   - Vet tab    → a clinic patient-chart (Health ring + status chips) over
 *                  service cards with benefit chips.
 *   - Compete tab→ an arena: a wins medallion over competition cards, each with
 *                  its own win-probability dial.
 *
 * All logic still delegates to the pure libs in `lib/pets/`. No new mechanics -
 * every drill-down is presentation of state that already exists.
 *
 * Visual system: "Slate Glass". Identity accent = gold #EAB308 (identity chrome
 * only). Pet health/happiness/hunger/energy keep their semantic colors as data.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import {
  ArrowLeft,
  Heart,
  HeartPulse,
  Zap,
  Moon,
  Bone,
  Stethoscope,
  Trophy,
  Medal,
  ShoppingBag,
  Skull,
  PawPrint,
  Star,
  Shield,
  ChevronRight,
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
  findToy,
  findSickness,
  vetServicePrice,
} from '@/lib/pets/catalog';
import { ageInYears, lifeStage, bandFor, isPastLifespan } from '@/lib/pets/lifecycle';
import { effectiveHungerDecay } from '@/lib/pets/decay';
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
import { formatMoney } from '@/utils/moneyFormatting';
import {
  getGlassCard,
  getGlassIconContainer,
  getGlassCategoryTabsContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import ProgressRing from '@/components/ui/ProgressRing';
import { Pet } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

const WEEKS_PER_YEAR = 52; // display constant only - mirrors lib/pets/lifecycle

// Identity accent - gold. Solid hex only lands on small CTAs / badges; every
// larger surface uses the translucent tints below.
const GOLD = '#EAB308';
// Dark ink for text on solid gold (white on gold fails contrast).
const GOLD_INK = '#0F172A';
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

const clampPct = (n: number): number => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

// Vital → semantic color (kept as data encoding across the whole app).
const HEALTH_C = accent.success;
const HAPPY_C = accent.danger;
const HUNGER_C = accent.warning;
const ENERGY_C = accent.info;

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
  const [detailPetId, setDetailPetId] = useState<string | null>(null); // Pets-tab drill-down
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

  // Tab switch also exits any pet-profile drill-down so the Pets tab returns to
  // the roster instead of re-opening a stale profile.
  const goTab = useCallback((id: TabType) => {
    setDetailPetId(null);
    setActiveTab(id);
  }, []);

  const handleBuy = useCallback(
    (breedId: string, name: string) => {
      const r = buyPet(gameState, setGameState, breedId, name, { updateMoney });
      if (r.success) {
        saveGame();
        setSelectedPetId(r.petId ?? null);
        setBuyModal(null);
        setPetName('');
        setDetailPetId(null);
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

  // BUG FIX: the care-pad "Feed" button only switched to the Shop tab - it never
  // fed the pet, unlike Play/Sleep which act directly. Feed with the cheapest
  // food the player actually owns; only route to the shop when the pantry is empty.
  const handleFeedFromInventory = useCallback(
    (petId: string) => {
      const inventory = gameState.petFood ?? {};
      // Search the FULL catalog cheapest-first (a hardcoded 3-id list here
      // ignored organic/gourmet/treats and falsely reported "Out of food").
      const ownedFoodId = [...PET_FOODS]
        .sort((a, b) => a.price - b.price)
        .map((f) => f.id)
        .find((id) => (inventory[id] ?? 0) > 0);
      if (!ownedFoodId) {
        flash('Out of food - buy some from the shop.');
        goTab('shop');
        return;
      }
      handleFeed(petId, ownedFoodId);
    },
    [gameState, flash, goTab, handleFeed]
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
        Math.random()
      );
      if (r.success) {
        saveGame();
        gameAlert(r.won ? '🏆 Victory!' : 'Better luck next time', r.message);
      } else {
        flash(r.message);
      }
    },
    [gameState, setGameState, saveGame, flash]
  );

  const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0];
  const detailPet = detailPetId ? pets.find((p) => p.id === detailPetId) ?? null : null;

  // A week-stamp → human readout for the care log ("Week 12 · 3w ago").
  const fmtWeek = (w: number | undefined): string => {
    if (typeof w !== 'number') return 'Never';
    const delta = week - w;
    if (delta <= 0) return `Week ${w} · this week`;
    return `Week ${w} · ${delta}w ago`;
  };

  // The chunky care pad - reused by the stage and the profile page.
  const renderCarePad = (p: Pet) => (
    <View style={styles.carePad}>
      <CareBtn label="Feed" Icon={Bone} color={HUNGER_C} theme={theme} onPress={() => handleFeedFromInventory(p.id)} />
      <CareBtn label="Play" Icon={Heart} color={HAPPY_C} theme={theme} onPress={() => handlePlay(p.id)} />
      <CareBtn label="Sleep" Icon={Moon} color={ENERGY_C} theme={theme} onPress={() => handleSleep(p.id)} />
      <CareBtn label="Vet" Icon={Stethoscope} color={HEALTH_C} theme={theme} onPress={() => goTab('vet')} />
    </View>
  );

  // Status chips shared by the stage and the profile identity block.
  const renderStatusChips = (p: Pet, stage: string, past: boolean) => {
    const sick = p.isSick && p.sickness ? findSickness(p.sickness) : null;
    return (
      <View style={styles.chipWrap}>
        <InfoChip label={stage} color={GOLD} theme={theme} />
        {p.vaccinated ? (
          <InfoChip label="Vaccinated" Icon={Shield} color={accent.success} theme={theme} />
        ) : (
          <InfoChip label="Unvaccinated" Icon={Shield} color={accent.warning} theme={theme} />
        )}
        {p.isSick ? (
          <InfoChip label={sick ? sick.name : (p.sickness ?? 'Sick')} Icon={Skull} color={accent.danger} theme={theme} />
        ) : null}
        {past ? <InfoChip label="Past lifespan" color={accent.warning} theme={theme} /> : null}
      </View>
    );
  };

  // Recipe B hero - the ONE focal gold surface of the Pets tab: the STAGE.
  const renderPetStage = (p: Pet) => {
    const breed = findBreed(p.type);
    const stage = lifeStage(p, breed);
    const past = isPastLifespan(p, breed);
    const health = p.health ?? 0;
    const happiness = p.happiness ?? 0;
    // Bond level (0–5 stars) derived from happiness + health - presentation of
    // existing state, not a new stat.
    const bond = Math.max(0, Math.min(5, Math.round((health + happiness) / 2 / 20)));
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
          <View pointerEvents="none" style={styles.heroGlow} />
          {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

          <Text style={[styles.heroEyebrow, styles.centerText, { color: theme.textMuted }]}>ACTIVE COMPANION</Text>
          <StageCore health={health} happiness={happiness} emoji={breed?.emoji ?? '🐾'} theme={theme} darkMode={darkMode} />

          <Text style={[styles.stageName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
          <Text style={[styles.stageSub, { color: theme.textSecondary }]}>
            {breed?.name ?? 'Unknown'} · {ageInYears(p)}y old
          </Text>
          {renderStatusChips(p, stage, past)}

          <View style={styles.bondRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={scale(15)}
                color={i < bond ? GOLD : theme.textMuted}
                fill={i < bond ? GOLD : 'transparent'}
              />
            ))}
            <Text style={[styles.bondLabelInline, { color: theme.textSecondary }]}>Bond</Text>
          </View>

          <View style={styles.vitalsRow}>
            <MiniMeter label="Hunger" value={p.hunger ?? 0} color={HUNGER_C} Icon={Bone} theme={theme} />
            <MiniMeter label="Energy" value={p.energy ?? 0} color={ENERGY_C} Icon={Zap} theme={theme} />
          </View>

          {renderCarePad(p)}

          <TouchableOpacity
            style={[styles.profileBtn, { borderColor: GOLD_RIM }]}
            onPress={() => setDetailPetId(p.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View ${p.name}'s full profile`}
          >
            <Text style={[styles.profileBtnText, { color: theme.text }]}>View full profile</Text>
            <ChevronRight size={scale(16)} color={GOLD} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Recipe B "adopt your first pet" state - the hero when there are no pets.
  const renderAdoptHero = () => (
    <View
      style={[
        getGlassCard(darkMode, 12),
        styles.heroCard,
        { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
      ]}
    >
      <View style={styles.heroInner}>
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
        <TouchableOpacity
          style={[styles.chipBase, styles.primaryGold, styles.adoptCta, getPlatformShadows(5, 0.3, 2, 8)]}
          onPress={() => goTab('shop')}
          accessibilityRole="button"
          accessibilityLabel="Browse the pet shop"
        >
          <ShoppingBag size={scale(16)} color={GOLD_INK} />
          <Text style={[styles.chipText, { color: GOLD_INK }]}>Browse the shop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPets = () => {
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {pets.length === 0 ? renderAdoptHero() : renderPetStage(selectedPet)}

        {pets.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your companions</Text>
              <Text style={[styles.sectionCount, { color: theme.textMuted }]}>{pets.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railScroll}
            >
              {pets.map((p) => (
                <RailAvatar
                  key={p.id}
                  pet={p}
                  breed={findBreed(p.type)}
                  active={selectedPet?.id === p.id}
                  theme={theme}
                  darkMode={darkMode}
                  onPress={() => setSelectedPetId(p.id)}
                />
              ))}
              <TouchableOpacity
                style={styles.railItem}
                onPress={() => goTab('shop')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Adopt a pet"
              >
                <View style={[getGlassIconContainer(darkMode, 56), styles.railAdopt]}>
                  <PawPrint size={scale(22)} color={GOLD} />
                </View>
                <Text style={[styles.railName, { color: theme.textSecondary }]} numberOfLines={1}>Adopt</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : null}

        <View style={[getGlassCard(darkMode, 6), styles.bondCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.bondTitle, { color: theme.text }]}>Companion bonus</Text>
          <View style={styles.bondRowStats}>
            <BondStat label="Happiness" value={bonding.playerHappinessDelta} color={HAPPY_C} theme={theme} />
            <BondStat label="Health" value={bonding.playerHealthDelta} color={HEALTH_C} theme={theme} />
            <BondStat label="Healthy pets" value={bonding.healthyPetCount} color={ENERGY_C} theme={theme} />
          </View>
          <View style={styles.chipWrap}>
            <InfoChip label={`${pets.length} companions`} Icon={PawPrint} color={GOLD} theme={theme} />
            <InfoChip label={`${pets.filter((p) => p.isSick).length} sick`} Icon={Skull} color={accent.danger} theme={theme} />
            <InfoChip label={`${pets.filter((p) => p.vaccinated).length} vaccinated`} Icon={Shield} color={accent.success} theme={theme} />
          </View>
          {bonding.hasCriticalPet ? (
            <View style={[styles.warningBanner, { backgroundColor: DANGER_FILL, borderColor: DANGER_RIM }]}>
              <Skull size={scale(14)} color={accent.danger} />
              <Text style={[styles.warningText, { color: accent.danger }]}>
                A pet is in critical condition - feed or visit the vet.
              </Text>
            </View>
          ) : null}
        </View>

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

  // ── Pet profile PAGE (list → detail) ──────────────────────────────────────
  const renderDetail = (p: Pet) => {
    const breed = findBreed(p.type);
    const stage = lifeStage(p, breed);
    const past = isPastLifespan(p, breed);
    const ageW = p.age ?? 0;
    const lifespanW = (breed?.lifespan ?? 1) * WEEKS_PER_YEAR;
    const ageFraction = lifespanW > 0 ? ageW / lifespanW : 0;
    const lifeProgress = clampPct(ageFraction * 100);
    const band = bandFor(ageFraction);
    const effHunger = breed ? effectiveHungerDecay(breed, ageFraction) : 0;
    const contrib = bonding.perPet.find((x) => x.petId === p.id);
    const ownedToyIds = p.toys ?? p.ownedToys ?? [];
    const ownedToys = ownedToyIds.map(findToy).filter((t): t is NonNullable<typeof t> => !!t);

    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        <TouchableOpacity
          style={[styles.detailBack, { backgroundColor: theme.surfaceElevated }]}
          onPress={() => setDetailPetId(null)}
          hitSlop={8}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Back to roster"
        >
          <ArrowLeft size={scale(18)} color={theme.text} />
          <Text style={[styles.detailBackText, { color: theme.text }]}>Roster</Text>
        </TouchableOpacity>

        {/* Identity hero */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <View pointerEvents="none" style={styles.heroGlow} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
            <StageCore health={p.health ?? 0} happiness={p.happiness ?? 0} emoji={breed?.emoji ?? '🐾'} theme={theme} darkMode={darkMode} />
            <Text style={[styles.stageName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[styles.stageSub, { color: theme.textSecondary }]}>
              {breed?.name ?? 'Unknown'} · {stage} · {ageInYears(p)}y ({ageW}w)
            </Text>
            {renderStatusChips(p, stage, past)}
          </View>
        </View>

        {/* Vitals (all four, full width) */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Vitals</Text>
          <StatBar label="Hunger" value={p.hunger ?? 0} color={HUNGER_C} theme={theme} />
          <StatBar label="Happiness" value={p.happiness ?? 0} color={HAPPY_C} theme={theme} />
          <StatBar label="Health" value={p.health ?? 0} color={HEALTH_C} theme={theme} />
          <StatBar label="Energy" value={p.energy ?? 0} color={ENERGY_C} theme={theme} />
        </View>

        {/* Life stage */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Life stage</Text>
          <StatBar label="Lifespan" value={lifeProgress} color={GOLD} theme={theme} />
          <View style={styles.chipWrap}>
            <InfoChip label={stage} color={GOLD} theme={theme} />
            <InfoChip label={`${ageInYears(p)} / ${breed?.lifespan ?? '?'} yrs`} color={ENERGY_C} theme={theme} />
            <InfoChip label={`${Math.round(lifeProgress)}% of life`} color={accent.success} theme={theme} />
            {past ? <InfoChip label="Living on borrowed time" Icon={Skull} color={accent.danger} theme={theme} /> : null}
          </View>
        </View>

        {/* Breed traits */}
        {breed ? (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{breed.name} traits</Text>
            <View style={styles.chipWrap}>
              <InfoChip label={`Base hunger -${breed.hungerDecayPerWeek}/wk`} Icon={Bone} color={HUNGER_C} theme={theme} />
              <InfoChip label={`Now -${Math.round(effHunger)}/wk`} color={HUNGER_C} theme={theme} />
              <InfoChip label={`Rest +${breed.energyRecoveryPerWeek}/wk`} Icon={Zap} color={ENERGY_C} theme={theme} />
              <InfoChip label={`Illness ${(breed.illnessChancePerWeek * 100).toFixed(1)}%/wk`} color={accent.warning} theme={theme} />
              <InfoChip label={`Age illness ×${band.illnessMultiplier}`} color={accent.warning} theme={theme} />
            </View>
          </View>
        ) : null}

        {/* Bond contribution */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bond with you</Text>
          <View style={styles.bondRowStats}>
            <BondStat label="Happiness / wk" value={contrib?.happinessContribution ?? 0} color={HAPPY_C} theme={theme} />
            <BondStat label="Health / wk" value={contrib?.healthContribution ?? 0} color={HEALTH_C} theme={theme} />
          </View>
        </View>

        {/* Care log */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Care log</Text>
          <KV label="Competition wins" value={`${p.competitionWins ?? 0}`} theme={theme} />
          <KV label="Last vet visit" value={fmtWeek(p.lastVetVisit)} theme={theme} />
          <KV label="Last slept" value={fmtWeek(p.lastSleepWeek)} theme={theme} />
          <KV label="Last competed" value={fmtWeek(p.lastCompetitionWeek)} theme={theme} />
          {p.weeksAtZeroHealth ? (
            <KV label="Weeks at 0 HP" value={`${p.weeksAtZeroHealth}`} theme={theme} danger />
          ) : null}
        </View>

        {/* Toy chest */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Toy chest</Text>
            <Text style={[styles.sectionCount, { color: theme.textMuted }]}>{ownedToys.length}</Text>
          </View>
          {ownedToys.length > 0 ? (
            <View style={styles.chipWrap}>
              {ownedToys.map((t) => (
                <InfoChip key={t.id} label={`${t.emoji} ${t.name} +${t.fun}`} color={GOLD} theme={theme} />
              ))}
            </View>
          ) : (
            <Text style={[styles.cardSub, { color: theme.textMuted }]}>No toys yet - buy some in the Shop.</Text>
          )}
        </View>

        {renderCarePad(p)}
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
        <View style={styles.grid}>
          {PET_FOODS.map((f) => {
            const owned = gameState.petFood?.[f.id] ?? 0;
            return (
              <View
                key={f.id}
                style={[getGlassCard(darkMode, 6), styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.tileTop}>
                  <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                    <Text style={styles.shopEmoji}>{f.emoji}</Text>
                  </View>
                  <Text style={[styles.tilePrice, { color: theme.text }]}>{formatMoney(f.price)}</Text>
                </View>
                <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{f.name}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={2}>
                  +{f.nutrition} hunger{f.healthBonus ? ` · +${f.healthBonus} health` : ''}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.textMuted }]}>In pantry: {owned}</Text>
                <View style={styles.tileBtns}>
                  <TouchableOpacity
                    style={[styles.tileBtn, styles.goldChip]}
                    onPress={() => handleBuyFood(f.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Buy ${f.name}`}
                  >
                    <Text style={[styles.chipText, { color: theme.text }]}>Buy</Text>
                  </TouchableOpacity>
                  {selectedPet && owned > 0 ? (
                    <TouchableOpacity
                      style={[styles.tileBtn, styles.goldChip]}
                      onPress={() => handleFeed(selectedPet.id, f.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Feed ${f.name} to ${selectedPet.name}`}
                    >
                      <Bone size={scale(13)} color={HUNGER_C} />
                      <Text style={[styles.chipText, { color: theme.text }]}>Feed</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {selectedPet ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Toys for {selectedPet.name}</Text>
          <View style={styles.grid}>
            {PET_TOYS.map((toy) => {
              const owned = (selectedPet.toys ?? selectedPet.ownedToys ?? []).includes(toy.id);
              return (
                <View
                  key={toy.id}
                  style={[getGlassCard(darkMode, 6), styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.tileTop}>
                    <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                      <Text style={styles.shopEmoji}>{toy.emoji}</Text>
                    </View>
                    <Text style={[styles.tilePrice, { color: theme.text }]}>{formatMoney(toy.price)}</Text>
                  </View>
                  <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{toy.name}</Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>+{toy.fun} fun on play</Text>
                  <View style={styles.tileBtns}>
                    <TouchableOpacity
                      disabled={owned}
                      style={[styles.tileBtn, owned ? { backgroundColor: theme.surfaceElevated } : styles.goldChip]}
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
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Adopt a pet</Text>
        <View style={styles.grid}>
          {PET_BREEDS.map((b) => (
            <View
              key={b.id}
              style={[getGlassCard(darkMode, 6), styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.tileTop}>
                <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                  <Text style={styles.shopEmoji}>{b.emoji}</Text>
                </View>
                <Text style={[styles.tilePrice, { color: theme.text }]}>{formatMoney(b.price)}</Text>
              </View>
              <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{b.name}</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{b.lifespan}y lifespan</Text>
              <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
                Illness {(b.illnessChancePerWeek * 100).toFixed(1)}%/wk
              </Text>
              <View style={styles.tileBtns}>
                <TouchableOpacity
                  style={[styles.tileBtn, styles.goldChip]}
                  onPress={() => setBuyModal(b.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Adopt ${b.name}`}
                >
                  <PawPrint size={scale(13)} color={GOLD} />
                  <Text style={[styles.chipText, { color: theme.text }]}>Adopt</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderVet = () => {
    const p = selectedPet;
    const breed = p ? findBreed(p.type) : undefined;
    const stage = p ? lifeStage(p, breed) : '';
    const sick = p?.isSick && p.sickness ? findSickness(p.sickness) : null;
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {/* Clinic patient chart (distinct hero: Health ring + status chips) */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <View pointerEvents="none" style={styles.heroGlow} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
            {p ? (
              <View style={styles.clinicRow}>
                <VitalRing value={p.health ?? 0} color={HEALTH_C} Icon={HeartPulse} label="HEALTH" theme={theme} darkMode={darkMode} size={72} />
                <View style={styles.clinicInfo}>
                  <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>VET CLINIC</Text>
                  <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.heroSub, { color: theme.textSecondary }]}>{breed?.name ?? 'Unknown'} · {stage}</Text>
                  <View style={styles.chipWrap}>
                    {p.vaccinated ? (
                      <InfoChip label="Vaccinated" Icon={Shield} color={accent.success} theme={theme} />
                    ) : (
                      <InfoChip label="Unvaccinated" Icon={Shield} color={accent.warning} theme={theme} />
                    )}
                    {p.isSick ? (
                      <InfoChip label={sick ? `${sick.name} (${sick.severity})` : 'Sick'} Icon={Skull} color={accent.danger} theme={theme} />
                    ) : (
                      <InfoChip label="No illness" color={accent.success} theme={theme} />
                    )}
                    <InfoChip label={`Visit ${fmtWeek(p.lastVetVisit)}`} Icon={Stethoscope} color={ENERGY_C} theme={theme} />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.heroContent}>
                <View style={[getGlassIconContainer(darkMode, 48), styles.goldBubble]}>
                  <Stethoscope size={scale(22)} color={GOLD} />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>VET CLINIC</Text>
                  <Text style={[styles.heroTitle, { color: theme.text }]}>No patient</Text>
                  <Text style={[styles.heroSub, { color: theme.textSecondary }]}>Adopt a pet first to visit the vet.</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {p ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Clinic services</Text>
            {VET_SERVICES.map((s) => {
              // Treatment services bill the pet's active sickness's own cost
              // (e.g. a mild cold is cheaper than a severe infection); other
              // services keep the flat price.
              const price = vetServicePrice(s, sick);
              const scaled = price !== s.price;
              return (
              <View
                key={s.id}
                style={[getGlassCard(darkMode, 6), styles.svcCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.svcHead}>
                  <View style={[getGlassIconContainer(darkMode, 44), styles.goldBubbleSoft]}>
                    <Text style={styles.shopEmoji}>{s.emoji}</Text>
                  </View>
                  <View style={styles.headerText}>
                    <Text style={[styles.cardName, { color: theme.text }]}>{s.name}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{s.description}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.tileBtn, styles.svcBtn, styles.goldChip]}
                    onPress={() => handleVet(p.id, s.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Book ${s.name} for ${formatMoney(price)}`}
                  >
                    <Text style={[styles.chipText, { color: theme.text }]}>Book {formatMoney(price)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.chipWrap}>
                  {s.healthBonus ? <InfoChip label={`+${s.healthBonus} health`} Icon={HeartPulse} color={accent.success} theme={theme} /> : null}
                  {s.happinessBonus ? <InfoChip label={`+${s.happinessBonus} happy`} Icon={Heart} color={accent.danger} theme={theme} /> : null}
                  {s.vaccinates ? <InfoChip label="Vaccinates" Icon={Shield} color={ENERGY_C} theme={theme} /> : null}
                  {s.treatsSickness ? <InfoChip label="Treats illness" color={accent.warning} theme={theme} /> : null}
                  {scaled && sick ? <InfoChip label={`${sick.name} rate`} color={accent.info} theme={theme} /> : null}
                </View>
              </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const renderCompete = () => {
    const p = selectedPet;
    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {/* Arena hero (distinct: wins medallion + gating-stat chips) */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <View pointerEvents="none" style={styles.heroGlow} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
            <View style={styles.heroContent}>
              <View style={[getGlassIconContainer(darkMode, 56), styles.goldBubble]}>
                <Medal size={scale(26)} color={GOLD} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>COMPETITION ARENA</Text>
                <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{p ? p.name : 'No competitor'}</Text>
                <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
                  {p ? 'Enter shows to win prize money.' : 'Adopt a pet first to enter competitions.'}
                </Text>
              </View>
              {p ? (
                <View style={styles.winsBadge}>
                  <Text style={[styles.winsNum, { color: GOLD }]}>{p.competitionWins ?? 0}</Text>
                  <Text style={[styles.winsLabel, { color: theme.textMuted }]}>WINS</Text>
                </View>
              ) : null}
            </View>
            {p ? (
              <View style={styles.chipWrap}>
                <InfoChip label={`Happiness ${p.happiness ?? 0}`} Icon={Heart} color={HAPPY_C} theme={theme} />
                <InfoChip label={`Health ${p.health ?? 0}`} Icon={HeartPulse} color={HEALTH_C} theme={theme} />
                <InfoChip label={`Energy ${p.energy ?? 0}`} Icon={Zap} color={ENERGY_C} theme={theme} />
                {p.lastCompetitionWeek === week ? (
                  <InfoChip label="Competed this week" color={accent.warning} theme={theme} />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {p ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming shows</Text>
            {PET_COMPETITIONS.map((c) => {
              const evalResult = evaluatePetForCompetition(p, c.id);
              if (!evalResult) return null;
              const winPct = Math.round(evalResult.winProbability * 100);
              // One competition per pet per week (enterCompetition rejects
              // re-entry) - grey the button out instead of letting the tap
              // fall through to an "already competed" flash.
              const competedThisWeek = p.lastCompetitionWeek === week;
              const eligible = evalResult.meetsRequirement && !competedThisWeek;
              return (
                <View
                  key={c.id}
                  style={[getGlassCard(darkMode, 6), styles.compCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <ProgressRing
                    value={winPct}
                    size={56}
                    strokeWidth={6}
                    accentColor={eligible ? GOLD : accent.warning}
                    trackColor={darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.20)'}
                    surfaceColor={theme.surface}
                    borderColor={theme.border}
                    inkColor={theme.text}
                    ambient={false}
                    showPill={false}
                    label={`${c.name} win odds ${winPct}%`}
                  >
                    <Text style={[styles.compRingPct, { color: theme.text }]}>{winPct}%</Text>
                  </ProgressRing>
                  <View style={styles.headerText}>
                    <Text style={[styles.cardName, { color: theme.text }]}>{c.emoji} {c.name}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                      Prize {formatMoney(c.prize)} · Entry {formatMoney(c.entryFee)}
                    </Text>
                    <Text style={[styles.cardMeta, { color: evalResult.meetsRequirement ? accent.success : accent.warning }]}>
                      {evalResult.meetsRequirement
                        ? `Meets ${c.requirement} ≥ ${c.minValue} (have ${evalResult.gatingValue})`
                        : `Need ${c.requirement} ≥ ${c.minValue} · have ${evalResult.gatingValue}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.tileBtn, styles.svcBtn, eligible ? styles.goldChip : { backgroundColor: theme.surfaceElevated }]}
                    onPress={() => handleCompete(p.id, c.id)}
                    disabled={!eligible}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !eligible }}
                    accessibilityLabel={`Enter ${c.name}`}
                  >
                    <Text style={[styles.chipText, { color: eligible ? theme.text : theme.textMuted }]}>{competedThisWeek ? 'Done' : 'Enter'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    );
  };

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
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(money)}</Text>
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
              onPress={() => goTab(id)}
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

      {activeTab === 'pets' && (detailPet ? renderDetail(detailPet) : renderPets())}
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
              // Unbounded, and the name renders in every pet card and event
              // line afterwards. 20 matches the character-name cap.
              maxLength={20}
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

// The dual-ring + emoji-mat core of the stage - reused by the active-pet stage
// and the pet-profile page's identity hero.
function StageCore({
  health,
  happiness,
  emoji,
  theme,
  darkMode,
}: {
  health: number;
  happiness: number;
  emoji: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  return (
    <View style={styles.stageRow}>
      <VitalRing value={health} color={HEALTH_C} Icon={HeartPulse} label="HEALTH" theme={theme} darkMode={darkMode} />
      <View style={styles.stageMat}>
        <View pointerEvents="none" style={styles.stageMatGlow} />
        <Text style={styles.stageEmoji}>{emoji}</Text>
      </View>
      <VitalRing value={happiness} color={HAPPY_C} Icon={Heart} label="HAPPY" theme={theme} darkMode={darkMode} />
    </View>
  );
}

// A labeled ProgressRing column (Health / Happiness / patient health).
function VitalRing({
  value,
  color,
  Icon,
  label,
  theme,
  darkMode,
  size = 76,
}: {
  value: number;
  color: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  size?: number;
}) {
  const v = clampPct(value);
  return (
    <View style={styles.ringCol}>
      <ProgressRing
        value={v}
        size={size}
        strokeWidth={7}
        accentColor={color}
        trackColor={darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.20)'}
        surfaceColor={theme.surface}
        borderColor={theme.border}
        inkColor={theme.text}
        ambient={false}
        label={`${label} ${Math.round(v)}%`}
      >
        <Icon size={scale(18)} color={color} />
      </ProgressRing>
      <Text style={[styles.ringLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

// Compact vital meter (Hunger / Energy) for the stage - the two vitals not
// shown as rings.
function MiniMeter({
  label,
  value,
  color,
  Icon,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  theme: ReturnType<typeof getThemeColors>;
}) {
  const v = clampPct(value);
  return (
    <View style={styles.miniMeter}>
      <View style={styles.miniMeterHead}>
        <Icon size={scale(12)} color={color} />
        <Text style={[styles.miniMeterLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.miniMeterVal, { color: theme.text }]}>{Math.round(v)}</Text>
      </View>
      <View style={[styles.miniTrack, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[styles.miniFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// Chunky, obviously-tappable care-pad button (icon over label, gold-framed).
function CareBtn({
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
      style={styles.careBtn}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={scale(20)} color={color} />
      <Text style={[styles.careBtnText, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Stories-style roster avatar with a health dot.
function RailAvatar({
  pet,
  breed,
  active,
  theme,
  darkMode,
  onPress,
}: {
  pet: Pet;
  breed: ReturnType<typeof findBreed>;
  active: boolean;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  onPress: () => void;
}) {
  const health = pet.health ?? 0;
  const dot = health >= 50 ? accent.success : health >= 25 ? accent.warning : accent.danger;
  return (
    <TouchableOpacity
      style={styles.railItem}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Select ${pet.name}`}
      accessibilityState={{ selected: active }}
    >
      <View style={[getGlassIconContainer(darkMode, 56), styles.goldBubbleSoft, active && styles.railActive]}>
        <Text style={styles.railEmoji}>{breed?.emoji ?? '🐾'}</Text>
        <View style={[styles.railDot, { backgroundColor: dot, borderColor: theme.surface }]} />
        {pet.isSick ? <View style={[styles.railSick, { borderColor: theme.surface }]} /> : null}
      </View>
      <Text style={[styles.railName, { color: active ? theme.text : theme.textSecondary }]} numberOfLines={1}>
        {pet.name}
      </Text>
    </TouchableOpacity>
  );
}

// A small status / trait chip. `color` is a solid hex; fill/rim derive via
// #RRGGBBAA alpha suffixes (RN supports 8-digit hex).
function InfoChip({
  label,
  color,
  Icon,
  theme,
}: {
  label: string;
  color: string;
  Icon?: React.ComponentType<{ size: number; color: string }>;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={[styles.infoChip, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      {Icon ? <Icon size={scale(11)} color={color} /> : null}
      <Text style={[styles.infoChipText, { color: theme.text }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// Key/value row for the care log.
function KV({
  label,
  value,
  theme,
  danger,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
  danger?: boolean;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: danger ? accent.danger : theme.text }]}>{value}</Text>
    </View>
  );
}

// Recipe B context hero for the Shop tab - one gold focal surface carrying the
// active-pet context.
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
            { width: `${clampPct(value)}%`, backgroundColor: color },
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.lg },
  centerText: { textAlign: 'center' },

  // Top bar - no bottom border; the segmented tab strip below anchors the screen.
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

  // Stage - dual rings flanking the emoji mat.
  stageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: sp.xs },
  stageMat: {
    width: scale(96),
    height: scale(96),
    borderRadius: scale(48),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD_FILL_SOFT,
    borderWidth: 1,
    borderColor: GOLD_RIM_SOFT,
  },
  stageMatGlow: {
    position: 'absolute',
    width: scale(76),
    height: scale(76),
    borderRadius: scale(38),
    backgroundColor: GOLD_GLOW,
  },
  stageEmoji: { fontSize: scale(56) },
  stageName: { fontSize: fs['2xl'], fontWeight: '800', textAlign: 'center', marginTop: sp.xs },
  stageSub: { fontSize: fs.sm, textAlign: 'center', marginTop: 2 },

  ringCol: { alignItems: 'center' },
  ringLabel: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.6, marginTop: scale(16) },

  bondRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(3), marginTop: sp.xs },
  bondLabelInline: { fontSize: fs.xs, fontWeight: '600', marginLeft: sp.xs },

  vitalsRow: { flexDirection: 'row', gap: sp.sm, marginTop: sp.sm },
  miniMeter: { flex: 1, gap: 4 },
  miniMeterHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniMeterLabel: { fontSize: fs.xs, flex: 1 },
  miniMeterVal: { fontSize: fs.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  miniTrack: { height: scale(6), borderRadius: br.full, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: br.full },

  // Care pad.
  carePad: { flexDirection: 'row', gap: sp.xs, marginTop: sp.sm },
  careBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: sp.sm,
    minHeight: scale(58),
    borderRadius: br.md,
    backgroundColor: GOLD_FILL_SOFT,
    borderWidth: 1,
    borderColor: GOLD_RIM_SOFT,
  },
  careBtnText: { fontSize: fs.xs, fontWeight: '700' },

  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
    marginTop: sp.sm,
    paddingVertical: sp.sm,
    minHeight: scale(40),
    borderRadius: br.md,
    borderWidth: 1,
    backgroundColor: GOLD_CHIP,
  },
  profileBtnText: { fontSize: fs.sm, fontWeight: '700' },

  // Tinted icon bubbles (Recipe C).
  goldBubble: { backgroundColor: GOLD_FILL, borderWidth: 1, borderColor: GOLD_RIM },
  goldBubbleSoft: { backgroundColor: GOLD_FILL_SOFT, borderWidth: 1, borderColor: GOLD_RIM_SOFT },

  // Roster rail.
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCount: { fontSize: fs.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  railScroll: { gap: sp.md, paddingVertical: sp.xs, paddingRight: sp.sm },
  railItem: { alignItems: 'center', width: scale(64), gap: 4 },
  railEmoji: { fontSize: scale(26) },
  railActive: { borderWidth: 2, borderColor: GOLD },
  railAdopt: { backgroundColor: GOLD_FILL, borderWidth: 1, borderColor: GOLD_RIM },
  railDot: { position: 'absolute', bottom: 0, right: scale(2), width: scale(12), height: scale(12), borderRadius: scale(6), borderWidth: 2 },
  railSick: { position: 'absolute', top: 0, right: scale(2), width: scale(10), height: scale(10), borderRadius: scale(5), borderWidth: 2, backgroundColor: '#EF4444' },
  railName: { fontSize: fs.xs, textAlign: 'center', fontWeight: '600' },

  // Cards / rows.
  card: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.xs },
  headerText: { flex: 1 },
  cardName: { fontSize: fs.md, fontWeight: '800' },
  cardSub: { fontSize: fs.xs, marginTop: 2 },
  cardMeta: { fontSize: fs.xs, marginTop: 2 },

  statBarRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.xs },
  statBarLabel: { fontSize: fs.xs, width: scale(78) },
  statBar: { flex: 1, height: scale(6), borderRadius: br.full, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: br.full },
  statBarValue: { fontSize: fs.xs, fontWeight: '700', width: scale(28), textAlign: 'right', fontVariant: ['tabular-nums'] },

  // Info / trait chips.
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs, marginTop: sp.xs, justifyContent: 'center' },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: br.full,
    borderWidth: 1,
    maxWidth: '100%',
  },
  infoChipText: { fontSize: fs.xs, fontWeight: '700' },

  // Key/value rows.
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: sp.xs },
  kvLabel: { fontSize: fs.sm },
  kvValue: { fontSize: fs.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Companion-bonus + warning.
  bondCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  bondTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },
  bondRowStats: { flexDirection: 'row', justifyContent: 'space-around' },
  bondStat: { alignItems: 'center' },
  bondValue: { fontSize: fs.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bondLabel: { fontSize: fs.xs },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.md, borderWidth: 1 },
  warningText: { fontSize: fs.xs, fontWeight: '700', flex: 1 },

  // Shop tile grid.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: sp.sm },
  tile: { width: '48%', padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.xs },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tilePrice: { fontSize: fs.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileBtns: { gap: sp.xs, marginTop: sp.xs },
  tileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderRadius: br.md,
    minHeight: scale(38),
  },
  shopEmoji: { fontSize: scale(22) },

  // Vet clinic.
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  clinicInfo: { flex: 1 },
  svcCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  svcHead: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  svcBtn: { paddingHorizontal: sp.md, alignSelf: 'center' },

  // Competition arena.
  compCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  compRingPct: { fontSize: fs.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  winsBadge: { alignItems: 'center', minWidth: scale(44) },
  winsNum: { fontSize: fs['2xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  winsLabel: { fontSize: fs.xs, fontWeight: '700', letterSpacing: 0.6 },

  // Chips: base geometry, plus a gold-tinted or solid-gold variant.
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: br.md,
    minHeight: scale(34),
    justifyContent: 'center',
  },
  goldChip: { backgroundColor: GOLD_CHIP, borderWidth: 1, borderColor: GOLD_RIM },
  chipText: { fontSize: fs.sm, fontWeight: '700' },
  primaryGold: { backgroundColor: GOLD },
  adoptCta: { marginTop: sp.sm },

  section: { gap: sp.sm },
  sectionTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },

  // Detail-page in-content back.
  detailBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    minHeight: scale(40),
    borderRadius: br.full,
  },
  detailBackText: { fontSize: fs.sm, fontWeight: '700' },

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
