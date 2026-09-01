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
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import {
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
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { getGlassCard, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import ProgressRing from '@/components/ui/ProgressRing';
import ProgressBar from '@/components/ui/ProgressBar';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import Chip from '@/components/ui/Chip';
import KeyValueRow from '@/components/ui/KeyValueRow';
import EmptyState from '@/components/ui/EmptyState';
import BaseModal from '@/components/ui/BaseModal';
import { useToast } from '@/contexts/ToastContext';
import { Pet } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

const WEEKS_PER_YEAR = 52; // display constant only - mirrors lib/pets/lifecycle

// Identity accent - the shared gold token. The twelve private GOLD_*/DANGER_*
// constants this file used to carry were one colour at a dozen slightly
// different opacities; `withAlpha` derives them from the one token instead.
const GOLD = accent.gold;
// Dark ink for text on solid gold (white on gold fails contrast).
const GOLD_INK = '#0F172A';
const GOLD_FILL = withAlpha(GOLD, 0.15);
const GOLD_FILL_SOFT = withAlpha(GOLD, 0.12);
const GOLD_RIM = withAlpha(GOLD, 0.3);

const clampPct = (n: number): number => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

/** "+3" / "0" / "-2" - the bond deltas read as movement, so the sign is kept. */
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

// Vital → semantic color (kept as data encoding across the whole app).
const HEALTH_C = accent.success;
const HAPPY_C = accent.danger;
const HUNGER_C = accent.warning;
const ENERGY_C = accent.info;

type TabType = 'pets' | 'shop' | 'vet' | 'compete';

const TABS: { key: TabType; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'pets', label: 'Pets', icon: PawPrint },
  { key: 'shop', label: 'Shop', icon: ShoppingBag },
  { key: 'vet', label: 'Vet', icon: Stethoscope },
  { key: 'compete', label: 'Compete', icon: Trophy },
];

interface PetAppProps {
  onBack: () => void;
}

export default function PetApp({ onBack }: PetAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('pets');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [detailPetId, setDetailPetId] = useState<string | null>(null); // Pets-tab drill-down
  const [buyModal, setBuyModal] = useState<string | null>(null); // breed id
  const [petName, setPetName] = useState('');

  const pets = useMemo(() => (gameState.pets ?? []).filter((p) => !p.isDead), [gameState.pets]);
  const deadPets = useMemo(() => (gameState.pets ?? []).filter((p) => p.isDead), [gameState.pets]);
  const bonding = useMemo(() => bondingSummary(pets), [pets]);
  const week = gameState.weeksLived || 0;
  const money = gameState.stats?.money ?? 0;

  // The hand-rolled `styles.toast` + timer pair is now the app-wide toast.
  const flash = useCallback((message: string) => {
    showToast(message, 'info');
  }, [showToast]);

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
        gameAlert(r.won ? 'Victory!' : 'Better luck next time', r.message);
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
        <Chip label={stage} tint={GOLD} />
        {p.vaccinated ? (
          <Chip label="Vaccinated" tone="success" icon={<Shield size={scale(11)} color={accent.success} />} />
        ) : (
          <Chip label="Unvaccinated" tone="warning" icon={<Shield size={scale(11)} color={accent.warning} />} />
        )}
        {p.isSick ? (
          <Chip label={sick ? sick.name : (p.sickness ?? 'Sick')} tone="danger" icon={<Skull size={scale(11)} color={accent.danger} />} />
        ) : null}
        {past ? <Chip label="Past lifespan" tone="warning" /> : null}
      </View>
    );
  };

  // Recipe B hero - the ONE focal gold surface of the Pets tab: the STAGE.
  const renderPetStage = (p: Pet) => {
    const breed = findBreed(p.type);
    const stage = lifeStage(p, breed);
    const health = p.health ?? 0;
    const happiness = p.happiness ?? 0;
    return (
      <View
        key={p.id}
        style={[
          getGlassCard(darkMode, 12),
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
        ]}
      >
        {/* Six elements, not fifteen. The bond stars, the four status chips and
            the two mini-meters moved to the profile page, which already repeats
            every vital in full - they are what you read when you go looking,
            not what you decide the next tap on. */}
        <View style={styles.heroInner}>
          <StageCore health={health} happiness={happiness} emoji={breed?.emoji ?? '🐾'} theme={theme} darkMode={darkMode} />

          <Text style={[styles.stageName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
          <Text style={[styles.stageSub, { color: theme.textSecondary }]}>
            {breed?.name ?? 'Unknown'} · {stage} · {ageInYears(p)}y old
          </Text>

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

  // "No pets yet" - the shared empty-state primitive.
  const renderAdoptHero = () => (
    <EmptyState
      icon={<PawPrint size={scale(26)} color={GOLD} />}
      observation="You don't have a companion yet"
      nudge="Adopt one in the Shop - a healthy pet lifts your happiness and health every week."
      ctaLabel="Browse the shop"
      onCtaPress={() => goTab('shop')}
    />
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
            <SectionTitle title="Your companions" right={<Chip label={`${pets.length}`} />} />
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
          <SectionTitle title="Companion bonus" />
          <StatStrip
            items={[
              { label: 'Happiness / wk', value: signed(bonding.playerHappinessDelta), tint: HAPPY_C },
              { label: 'Health / wk', value: signed(bonding.playerHealthDelta), tint: HEALTH_C },
              { label: 'Healthy pets', value: bonding.healthyPetCount },
            ]}
          />
          <View style={styles.chipWrap}>
            <Chip label={`${pets.length} companions`} tint={GOLD} icon={<PawPrint size={scale(11)} color={GOLD} />} />
            <Chip label={`${pets.filter((p) => p.isSick).length} sick`} tone="danger" icon={<Skull size={scale(11)} color={accent.danger} />} />
            <Chip label={`${pets.filter((p) => p.vaccinated).length} vaccinated`} tone="success" icon={<Shield size={scale(11)} color={accent.success} />} />
          </View>
          {bonding.hasCriticalPet ? (
            <View style={[styles.warningBanner, { backgroundColor: withAlpha(accent.danger, 0.12), borderColor: withAlpha(accent.danger, 0.3) }]}>
              <Skull size={scale(14)} color={accent.danger} />
              <Text style={[styles.warningText, { color: accent.danger }]}>
                A pet is in critical condition - feed or visit the vet.
              </Text>
            </View>
          ) : null}
        </View>

        {deadPets.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title="In memoriam" />
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
    const bond = Math.max(0, Math.min(5, Math.round(((p.health ?? 0) + (p.happiness ?? 0)) / 2 / 20)));

    return (
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
      >
        {/* Identity hero */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <StageCore health={p.health ?? 0} happiness={p.happiness ?? 0} emoji={breed?.emoji ?? '🐾'} theme={theme} darkMode={darkMode} />
            <Text style={[styles.stageName, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
            <Text style={[styles.stageSub, { color: theme.textSecondary }]}>
              {breed?.name ?? 'Unknown'} · {stage} · {ageInYears(p)}y ({ageW}w)
            </Text>
            {/* Bond level (0-5 stars) derived from happiness + health -
                presentation of existing state, not a new stat. It lives here
                rather than on the stage: it is a thing you look up. */}
            <View
              style={styles.bondRow}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Bond ${bond} of 5`}
            >
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
            {renderStatusChips(p, stage, past)}
          </View>
        </View>

        {/* Vitals (all four, full width) */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Vitals" />
          <StatBar label="Hunger" value={p.hunger ?? 0} color={HUNGER_C} theme={theme} />
          <StatBar label="Happiness" value={p.happiness ?? 0} color={HAPPY_C} theme={theme} />
          <StatBar label="Health" value={p.health ?? 0} color={HEALTH_C} theme={theme} />
          <StatBar label="Energy" value={p.energy ?? 0} color={ENERGY_C} theme={theme} />
          <View style={styles.vitalsRow}>
            <MiniMeter label="Hunger" value={p.hunger ?? 0} color={HUNGER_C} Icon={Bone} theme={theme} />
            <MiniMeter label="Energy" value={p.energy ?? 0} color={ENERGY_C} Icon={Zap} theme={theme} />
          </View>
        </View>

        {/* Life stage */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Life stage" />
          <StatBar label="Lifespan" value={lifeProgress} color={GOLD} theme={theme} />
          <View style={styles.chipWrap}>
            <Chip label={stage} tint={GOLD} />
            <Chip label={`${ageInYears(p)} / ${breed?.lifespan ?? '?'} yrs`} tone="info" />
            <Chip label={`${Math.round(lifeProgress)}% of life`} tone="success" />
            {past ? <Chip label="Living on borrowed time" tone="danger" icon={<Skull size={scale(11)} color={accent.danger} />} /> : null}
          </View>
        </View>

        {/* Breed traits */}
        {breed ? (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title={`${breed.name} traits`} />
            <View style={styles.chipWrap}>
              <Chip label={`Base hunger -${breed.hungerDecayPerWeek}/wk`} tone="warning" icon={<Bone size={scale(11)} color={HUNGER_C} />} />
              <Chip label={`Now -${Math.round(effHunger)}/wk`} tone="warning" />
              <Chip label={`Rest +${breed.energyRecoveryPerWeek}/wk`} tone="info" icon={<Zap size={scale(11)} color={ENERGY_C} />} />
              <Chip label={`Illness ${(breed.illnessChancePerWeek * 100).toFixed(1)}%/wk`} tone="warning" />
              <Chip label={`Age illness ×${band.illnessMultiplier}`} tone="warning" />
            </View>
          </View>
        ) : null}

        {/* Bond contribution */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Bond with you" />
          <View style={styles.bondRowStats}>
            <StatStrip
              items={[
                { label: 'Happiness / wk', value: signed(contrib?.happinessContribution ?? 0), tint: HAPPY_C },
                { label: 'Health / wk', value: signed(contrib?.healthContribution ?? 0), tint: HEALTH_C },
              ]}
            />
          </View>
        </View>

        {/* Care log */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Care log" />
          <KeyValueRow label="Competition wins" value={p.competitionWins ?? 0} />
          <KeyValueRow label="Last vet visit" value={fmtWeek(p.lastVetVisit)} />
          <KeyValueRow label="Last slept" value={fmtWeek(p.lastSleepWeek)} />
          <KeyValueRow
            label="Last competed"
            value={fmtWeek(p.lastCompetitionWeek)}
            divider={!p.weeksAtZeroHealth}
          />
          {p.weeksAtZeroHealth ? (
            <KeyValueRow label="Weeks at 0 HP" value={p.weeksAtZeroHealth} tint={accent.danger} divider={false} />
          ) : null}
        </View>

        {/* Toy chest */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Toy chest" right={<Chip label={`${ownedToys.length}`} />} />
          {ownedToys.length > 0 ? (
            <View style={styles.chipWrap}>
              {ownedToys.map((t) => (
                <Chip key={t.id} label={`${t.name} +${t.fun}`} tint={GOLD} />
              ))}
            </View>
          ) : (
            <EmptyState
              compact
              observation={`${p.name} has no toys`}
              nudge="A toy adds fun on every play, which is what keeps happiness up."
              ctaLabel="Browse the shop"
              onCtaPress={() => goTab('shop')}
            />
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
        <SectionTitle title="Feed your pets" />
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
          <SectionTitle title={`Toys for ${selectedPet.name}`} />
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
        <SectionTitle title="Adopt a pet" />
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
            {p ? (
              <View style={styles.clinicRow}>
                <VitalRing value={p.health ?? 0} color={HEALTH_C} Icon={HeartPulse} label="HEALTH" theme={theme} darkMode={darkMode} size={72} />
                <View style={styles.clinicInfo}>
                  <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>VET CLINIC</Text>
                  <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.heroSub, { color: theme.textSecondary }]}>{breed?.name ?? 'Unknown'} · {stage}</Text>
                  <View style={styles.chipWrap}>
                    {p.vaccinated ? (
                      <Chip label="Vaccinated" tone="success" icon={<Shield size={scale(11)} color={accent.success} />} />
                    ) : (
                      <Chip label="Unvaccinated" tone="warning" icon={<Shield size={scale(11)} color={accent.warning} />} />
                    )}
                    {p.isSick ? (
                      <Chip label={sick ? `${sick.name} (${sick.severity})` : 'Sick'} tone="danger" icon={<Skull size={scale(11)} color={accent.danger} />} />
                    ) : (
                      <Chip label="No illness" tone="success" />
                    )}
                    <Chip label={`Visit ${fmtWeek(p.lastVetVisit)}`} tone="info" icon={<Stethoscope size={scale(11)} color={ENERGY_C} />} />
                  </View>
                </View>
              </View>
            ) : (
              <EmptyState
                compact
                icon={<Stethoscope size={scale(22)} color={GOLD} />}
                observation="The clinic has no patient"
                nudge="Adopt a companion first - vaccinations and treatment are what keep it alive."
                ctaLabel="Browse the shop"
                onCtaPress={() => goTab('shop')}
              />
            )}
          </View>
        </View>

        {p ? (
          <View style={styles.section}>
            <SectionTitle title="Clinic services" />
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
                  {s.healthBonus ? <Chip label={`+${s.healthBonus} health`} tone="success" icon={<HeartPulse size={scale(11)} color={accent.success} />} /> : null}
                  {s.happinessBonus ? <Chip label={`+${s.happinessBonus} happy`} tone="danger" icon={<Heart size={scale(11)} color={accent.danger} />} /> : null}
                  {s.vaccinates ? <Chip label="Vaccinates" tone="info" icon={<Shield size={scale(11)} color={ENERGY_C} />} /> : null}
                  {s.treatsSickness ? <Chip label="Treats illness" tone="warning" /> : null}
                  {scaled && sick ? <Chip label={`${sick.name} rate`} tone="info" /> : null}
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
            {p ? (
              <>
                <View style={styles.heroContent}>
                  <View style={[getGlassIconContainer(darkMode, 56), styles.goldBubble]}>
                    <Medal size={scale(26)} color={GOLD} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.heroSub, { color: theme.textSecondary }]}>Enter shows to win prize money.</Text>
                  </View>
                </View>
                <StatStrip
                  items={[
                    { label: 'Wins', value: p.competitionWins ?? 0, tint: GOLD },
                    { label: 'Happiness', value: p.happiness ?? 0, tint: HAPPY_C },
                    { label: 'Health', value: p.health ?? 0, tint: HEALTH_C },
                    { label: 'Energy', value: p.energy ?? 0, tint: ENERGY_C },
                  ]}
                />
                {p.lastCompetitionWeek === week ? (
                  <View style={styles.chipWrap}>
                    <Chip label="Competed this week" tone="warning" />
                  </View>
                ) : null}
              </>
            ) : (
              <EmptyState
                compact
                icon={<Medal size={scale(22)} color={GOLD} />}
                observation="You have no competitor"
                nudge="Adopt a companion first - shows pay prize money on top of the bond bonus."
                ctaLabel="Browse the shop"
                onCtaPress={() => goTab('shop')}
              />
            )}
          </View>
        </View>

        {p ? (
          <View style={styles.section}>
            <SectionTitle title="Upcoming shows" />
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
                    <Text style={[styles.cardName, { color: theme.text }]}>{c.name}</Text>
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
      {/* One bar for both levels: the title names where you are - the app, or
          the pet whose profile is open - and the arrow pops the profile before
          it leaves the app, which is why the in-body "Roster" button is gone. */}
      <AppHeader
        title={detailPet ? detailPet.name : 'Pets'}
        onBack={detailPet ? () => setDetailPetId(null) : onBack}
        backLabel={detailPet ? 'Back to pets' : 'Back'}
        right={<CashChip value={formatMoney(money)} tint={GOLD} />}
      />

      <SegmentedControl
        segments={TABS}
        value={activeTab}
        onChange={goTab}
        activeColor={GOLD}
        style={styles.tabBar}
      />

      {activeTab === 'pets' && (detailPet ? renderDetail(detailPet) : renderPets())}
      {activeTab === 'shop' && renderShop()}
      {activeTab === 'vet' && renderVet()}
      {activeTab === 'compete' && renderCompete()}

      <BaseModal
        visible={!!buyModal}
        onClose={() => setBuyModal(null)}
        title="Name your new companion"
        variant="center"
        scrollable={false}
        footer={
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
        }
      >
        <TextInput
          value={petName}
          onChangeText={setPetName}
          placeholder="e.g. Rex"
          placeholderTextColor={theme.textMuted}
          // Unbounded, and the name renders in every pet card and event line
          // afterwards. 20 matches the character-name cap.
          maxLength={20}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
        />
      </BaseModal>
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
      <ProgressBar value={v / 100} color={color} label={label} height={scale(5)} />
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
      <ProgressBar value={clampPct(value) / 100} color={color} label={label} style={styles.statBar} />
      <Text style={[styles.statBarValue, { color: theme.text }]}>{Math.round(clampPct(value))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.lg },

  // Top bar - no bottom border; the segmented tab strip below anchors the screen.

  // Segmented tab control.
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: sp.md,
    marginTop: sp.sm,
    marginBottom: sp.sm,
  },

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
  heroEyebrow: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: 2 },
  heroTitle: { fontSize: fs['2xl'], fontWeight: '600' },
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
    borderColor: GOLD_RIM,
  },
  stageEmoji: { fontSize: scale(56) },
  stageName: { fontSize: fs['2xl'], fontWeight: '600', textAlign: 'center', marginTop: sp.xs },
  stageSub: { fontSize: fs.sm, textAlign: 'center', marginTop: 2 },

  ringCol: { alignItems: 'center' },
  ringLabel: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.6, marginTop: scale(16) },

  bondRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(3), marginTop: sp.xs },
  bondLabelInline: { fontSize: fs.xs, fontWeight: '600', marginLeft: sp.xs },

  vitalsRow: { flexDirection: 'row', gap: sp.sm, marginTop: sp.sm },
  miniMeter: { flex: 1, gap: 4 },
  miniMeterHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniMeterLabel: { fontSize: fs.xs, flex: 1 },
  miniMeterVal: { fontSize: fs.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },

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
    borderColor: GOLD_RIM,
  },
  careBtnText: { fontSize: fs.xs, fontWeight: '600' },

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
    backgroundColor: GOLD_FILL_SOFT,
  },
  profileBtnText: { fontSize: fs.sm, fontWeight: '600' },

  // Tinted icon bubbles (Recipe C).
  goldBubble: { backgroundColor: GOLD_FILL, borderWidth: 1, borderColor: GOLD_RIM },
  goldBubbleSoft: { backgroundColor: GOLD_FILL_SOFT, borderWidth: 1, borderColor: GOLD_RIM },

  // Roster rail.
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
  cardName: { fontSize: fs.md, fontWeight: '600' },
  cardSub: { fontSize: fs.xs, marginTop: 2 },
  cardMeta: { fontSize: fs.xs, marginTop: 2 },

  statBarRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.xs },
  statBarLabel: { fontSize: fs.xs, width: scale(78) },
  statBar: { flex: 1, height: scale(6), borderRadius: br.full, overflow: 'hidden' },
  statBarValue: { fontSize: fs.xs, fontWeight: '600', width: scale(28), textAlign: 'right', fontVariant: ['tabular-nums'] },

  // Info / trait chips.
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs, marginTop: sp.xs, justifyContent: 'center' },

  // Key/value rows.

  // Companion-bonus + warning.
  bondCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  bondRowStats: { flexDirection: 'row', justifyContent: 'space-around' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.md, borderWidth: 1 },
  warningText: { fontSize: fs.xs, fontWeight: '600', flex: 1 },

  // Shop tile grid.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: sp.sm },
  tile: { width: '48%', padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.xs },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tilePrice: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileBtns: { gap: sp.xs, marginTop: sp.xs },
  tileBtn: {
    // 34pt was under the 44pt minimum; these are the Buy / Feed / Adopt taps.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderRadius: br.md,
    minHeight: touchTargets.minimum,
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
  compRingPct: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Chips: base geometry, plus a gold-tinted or solid-gold variant. Every
  // remaining user is an interactive button (Cancel / Adopt), so the base
  // carries the 44pt minimum rather than the old 34.
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: br.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  goldChip: { backgroundColor: GOLD_FILL_SOFT, borderWidth: 1, borderColor: GOLD_RIM },
  chipText: { fontSize: fs.sm, fontWeight: '600' },
  primaryGold: { backgroundColor: GOLD },

  section: { gap: sp.sm },

  // Detail-page in-content back.

  memoryCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1, opacity: 0.75 },
  memoryEmoji: { fontSize: scale(20), opacity: 0.8 },

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
