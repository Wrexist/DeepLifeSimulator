/**
 * Travel App.
 *
 * Four tabs on the shared primitives (AppHeader, SegmentedControl, StatStrip,
 * Chip, SectionTitle, EmptyState, BaseModal):
 *   - Destinations = a departures summary + a grid of destination tiles, each
 *     opening a rich detail page (list→detail sub-view).
 *   - My Trip = where you are, when you get back, and the Return home button.
 *   - Business = storefront cards with a passive-income summary.
 *   - Passport = the stamps of every trip taken, plus frequent-flyer milestones.
 *
 * It shows what the old UI hid: stress-relief + reputation benefits, the full
 * per-destination event pool, fare/duration breakdowns, trip progress, absolute
 * depart/return weeks, times-visited counts, passive-income totals.
 *
 * What this screen deliberately no longer does is pretend to be an airline. My
 * Trip was a literal boarding pass - an SVG barcode, a dashed perforation with
 * punched notches, an airline brand line, and a FLIGHT / GATE / SEAT grid whose
 * values were hashes of the destination id. None of it could change, none of it
 * could be acted on, and it sat above the one control on the screen. Its
 * companion was a 17-hue per-destination palette: colour that could be noticed
 * but never read, since nothing about Paris is rose. The emoji stays, because
 * it is the one piece of per-destination character that is about the place.
 *
 * ZERO REMOVAL of behaviour - every prior action stays reachable.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ArrowRight,
  Plane,
  Ticket,
  MapPin,
  Heart,
  Zap,
  Battery,
  Globe,
  Clock,
  CheckCircle,
  ChevronRight,
  Store,
  Stamp,
  Compass,
  Star,
  Award,
  DollarSign,
  Sparkles,
  Car,
  Vote,
  Skull,
  Coins,
  AlertTriangle,
  TrendingUp,
  Utensils,
  Mountain,
  Landmark,
  Music,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import { transportationMods } from '@/lib/travel/transportation';
import { quoteTrip, deriveExperienceStats } from '@/lib/travel/operations';
import { TravelEventDef, eligibleTripEvents } from '@/lib/travel/events';
import { TRAVEL_MILESTONE_TIERS } from '@/lib/travel/milestones';
import {
  activitiesForDestination,
  quoteActivity,
  netActivityEnergy,
  TravelActivity,
  TravelActivityCategory,
} from '@/lib/travel/activities';
import {
  travelTo,
  returnFromTrip,
  purchasePassport,
  investInBusinessOpportunity,
  doTravelActivity,
  TripReturnResult,
} from '@/contexts/game/actions/TravelActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ProgressRing from '@/components/ui/ProgressRing';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import BaseModal from '@/components/ui/BaseModal';
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
import {
  getGlassCard,
  getGlassIconContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import { gameAlert } from '@/utils/gameAlert';

/**
 * ONE identity colour, from the shared `accent` scale.
 *
 * This app used to carry a private palette - a teal `#14B8A6` plus a darker
 * `IDENTITY_PAIR` for gradients, a `tint()` helper, an 8-digit-hex
 * `softFill`/`softRim` pair, and `vibeTint`, which coloured each of the 17
 * destinations its own hue. Seventeen categorical colours means colour carries
 * no meaning: nothing about Paris is rose and nothing about Tokyo is purple, so
 * the tint could not be read, only noticed. Semantic colour (visited = success,
 * passport missing = warning, milestones = gold) is kept, because that colour
 * IS the information. `withAlpha` is the one tint helper.
 */
const IDENTITY = accent.info;

const HOME_CODE = 'HOM';

// Per-destination boarding-pass flavor + vibe. IATA codes and vibe hues are
// presentation only (deterministic, no game state). Missing entries fall back
// to a derived 3-letter code / identity teal.
const DEST_META: Record<string, { code: string; emoji: string }> = {
  local_resort: { code: 'RST', emoji: '🏖️' },
  paris: { code: 'CDG', emoji: '🗼' },
  tokyo: { code: 'HND', emoji: '🏯' },
  bali: { code: 'DPS', emoji: '🏝️' },
  new_york: { code: 'JFK', emoji: '🗽' },
  swiss_alps: { code: 'ZRH', emoji: '🏔️' },
  london: { code: 'LHR', emoji: '🎡' },
  dubai: { code: 'DXB', emoji: '🏙️' },
  rome: { code: 'FCO', emoji: '🏛️' },
  thailand: { code: 'BKK', emoji: '🛕' },
  sydney: { code: 'SYD', emoji: '🌊' },
  cancun: { code: 'CUN', emoji: '🐚' },
  iceland: { code: 'KEF', emoji: '🌋' },
  safari: { code: 'NBO', emoji: '🦁' },
  maldives: { code: 'MLE', emoji: '🐠' },
  camping_trip: { code: 'CMP', emoji: '🏕️' },
  road_trip: { code: 'RTR', emoji: '🚗' },
};
const metaFor = (id: string) =>
  DEST_META[id] || { code: id.slice(0, 3).toUpperCase(), emoji: '🌍' };

// Per-category glyph + semantic hue for the in-trip activities list. Colors are
// categorical Recipe-C accents (not the teal identity) so each activity type
// reads distinctly; identity teal is reserved for the CTA.
const ACTIVITY_META: Record<
  TravelActivityCategory,
  { Icon: React.ComponentType<{ size: number; color: string }>; hue: string }
> = {
  sightseeing: { Icon: Compass, hue: accent.info },
  cuisine: { Icon: Utensils, hue: accent.warning },
  adventure: { Icon: Mountain, hue: accent.success },
  culture: { Icon: Landmark, hue: accent.purple },
  nightlife: { Icon: Music, hue: accent.danger },
  shopping: { Icon: ShoppingBag, hue: accent.amber },
  relaxation: { Icon: Sparkles, hue: IDENTITY },
};

// The flight number, gate, seat, booking reference and barcode were all hashes
// of the destination id: stable-looking noise that carried no state, could not
// change, and told the player nothing. They are gone, and the FNV-1a hash that
// generated them with them.
const classForCost = (c: number) => (c >= 5000 ? 'FIRST' : c >= 2500 ? 'BUSINESS' : 'ECONOMY');

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Non-zero benefit descriptors - shows exactly what `returnFromTrip` applies.
// GameStats has no `stress`/`intelligence` field: those advertised benefits are
// folded into happiness/energy by deriveExperienceStats on return, so the
// preview folds them the same way rather than showing phantom stat chips.
// `core` limits to the four headline stats for compact grid tiles.
function benefitDescriptors(
  b: TravelDestination['benefits'],
  core = false
): { Icon: React.ComponentType<{ size: number; color: string }>; color: string; value: string; key: string }[] {
  const out = [] as { Icon: React.ComponentType<{ size: number; color: string }>; color: string; value: string; key: string }[];
  // Fold stress-relief + intelligence enrichment into the concrete happiness/
  // energy deltas the game actually models (matches deriveExperienceStats).
  const experience = deriveExperienceStats(b);
  const happiness = (b?.happiness ?? 0) + experience.happiness;
  const energy = (b?.energy ?? 0) + experience.energy;
  if (happiness) out.push({ Icon: Heart, color: accent.danger, value: `${happiness > 0 ? '+' : ''}${happiness}`, key: 'hap' });
  if (b.health) out.push({ Icon: Battery, color: accent.success, value: `${b.health > 0 ? '+' : ''}${b.health}`, key: 'hp' });
  if (energy) out.push({ Icon: Zap, color: accent.warning, value: `${energy > 0 ? '+' : ''}${energy}`, key: 'en' });
  if (core) return out;
  if (b.reputation) out.push({ Icon: Star, color: accent.gold, value: `+${b.reputation} rep`, key: 'rep' });
  return out;
}

type TabType = 'destinations' | 'trip' | 'business' | 'history';

const TABS: { key: TabType; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'destinations', label: 'Destinations', icon: Compass },
  { key: 'trip', label: 'My Trip', icon: Ticket },
  { key: 'business', label: 'Business', icon: Store },
  { key: 'history', label: 'Passport', icon: Stamp },
];

interface TravelAppProps {
  onBack: () => void;
}

export default function TravelApp({ onBack }: TravelAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  // A trip in flight is the one thing happening; land on it rather than on
  // the board of places to go next (Program 4).
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    gameState.travel?.currentTrip ? 'trip' : 'destinations'
  );
  const [returnEvents, setReturnEvents] = useState<TripReturnResult | null>(null);
  // list → detail sub-view: presents existing destination data on its own page.
  const [detailId, setDetailId] = useState<string | null>(null);

  const travel = gameState.travel || {
    visitedDestinations: [],
    passportOwned: false,
    businessOpportunities: {},
    travelHistory: [],
  };
  const currentTrip = travel.currentTrip;
  const week = gameState.weeksLived || 0;
  const money = gameState.stats?.money ?? 0;

  const passportItem = gameState.items?.find((i) => i.id === 'passport');
  const ownsPassport = !!(travel.passportOwned || passportItem?.owned);

  const mods = useMemo(() => transportationMods(gameState), [gameState]);
  const activeVehicle = (gameState.vehicles || []).find((v) => v.id === gameState.activeVehicleId);

  const visitedCount = travel.visitedDestinations?.length || 0;
  const historyCount = travel.travelHistory?.length || 0;

  const handleBook = useCallback(
    (dest: TravelDestination) => {
      const quote = quoteTrip(dest.id, gameState, week);
      if (!quote.ok) {
        gameAlert('Cannot book', quote.message);
        return;
      }
      gameAlert(
        `Travel to ${dest.name}?`,
        `Cost ${formatMoney(quote.adjustedCost)} • ${quote.adjustedDuration} week${quote.adjustedDuration > 1 ? 's' : ''}` +
          (quote.adjustedCost !== quote.baseCost
            ? `\n(base ${formatMoney(quote.baseCost)} - policy savings)`
            : ''),
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: "Let's go",
            onPress: () => {
              const r = travelTo(gameState, setGameState, dest.id, { updateMoney, updateStats });
              if (r.success) {
                saveGame();
                setDetailId(null);
                setActiveTab('trip');
              } else {
                gameAlert('Error', r.message);
              }
            },
          },
        ]
      );
    },
    [gameState, setGameState, saveGame, week]
  );

  const handleReturn = useCallback(() => {
    if (!currentTrip) return;
    const r = returnFromTrip(gameState, setGameState, { updateStats, updateMoney });
    if (r.success) {
      saveGame();
      setReturnEvents(r);
    } else {
      gameAlert('Still traveling', r.message);
    }
  }, [currentTrip, gameState, setGameState, saveGame]);

  const handlePassport = useCallback(() => {
    gameAlert('Purchase passport?', 'Costs $500 and unlocks international destinations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Buy',
        onPress: () => {
          const r = purchasePassport(gameState, setGameState, { updateMoney });
          if (r.success) saveGame();
          else gameAlert('Error', r.message);
        },
      },
    ]);
  }, [gameState, setGameState, saveGame]);

  const handleInvest = useCallback(
    (opportunityId: string) => {
      const opp = travel.businessOpportunities?.[opportunityId];
      if (!opp) return;
      gameAlert(
        `Invest in ${opp.name}?`,
        `${formatMoney(opp.cost)} for ${formatMoney(opp.weeklyIncome)}/week passive.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Invest',
            onPress: () => {
              const r = investInBusinessOpportunity(gameState, setGameState, opportunityId, {
                updateMoney,
              });
              if (r.success) saveGame();
              else gameAlert('Error', r.message);
            },
          },
        ]
      );
    },
    [gameState, setGameState, saveGame, travel.businessOpportunities]
  );

  const handleActivity = useCallback(
    (activity: TravelActivity) => {
      const q = quoteActivity(activity.id, gameState);
      if (!q.ok) {
        gameAlert('Cannot do this yet', q.message);
        return;
      }
      const costLine = activity.cost > 0 ? formatMoney(activity.cost) : 'Free';
      const energyLine = activity.energyCost > 0 ? ` • −${activity.energyCost} energy` : '';
      gameAlert(
        activity.name,
        `${activity.description}\n\n${costLine}${energyLine}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Do it',
            onPress: () => {
              const r = doTravelActivity(gameState, setGameState, activity.id, {
                updateStats,
                updateMoney,
              });
              if (r.success) {
                saveGame();
                if (r.souvenir) gameAlert(r.activityName || 'Nice!', r.souvenir);
              } else {
                gameAlert('Error', r.message);
              }
            },
          },
        ]
      );
    },
    [gameState, setGameState, saveGame]
  );

  // ---- In-trip activities: things to DO at the destination (list on My Trip). --
  const renderActivities = (destinationId: string) => {
    const list = activitiesForDestination(destinationId);
    if (list.length === 0) return null;
    const doneIds = new Set(currentTrip?.activitiesDone ?? []);
    const dest = DESTINATIONS.find((d) => d.id === destinationId);
    return (
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.edgeTitleRow}>
          <View style={[getGlassIconContainer(darkMode, 30), styles.edgeGlyph, { backgroundColor: withAlpha(IDENTITY, 0.15), borderColor: withAlpha(IDENTITY, 0.3) }]}>
            <Sparkles size={scale(14)} color={IDENTITY} />
          </View>
          <Text style={[styles.edgeTitle, { color: theme.text }]}>
            Things to do{dest ? ` in ${dest.name}` : ''}
          </Text>
        </View>
        <Text style={[styles.cardHint, { color: theme.textMuted }]}>
          One of each per trip. A fun spend of cash + energy for a memory.
        </Text>
        {list.map((a) => {
          const meta = ACTIVITY_META[a.category];
          const q = quoteActivity(a.id, gameState);
          const done = doneIds.has(a.id);
          const disabled = done || !q.ok;
          const netEnergy = netActivityEnergy(a);
          const payoff = [
            a.effects.happiness ? `+${a.effects.happiness} happiness` : null,
            a.effects.health ? `${a.effects.health > 0 ? '+' : ''}${a.effects.health} health` : null,
            netEnergy > 0 ? `+${netEnergy} energy` : null,
            a.effects.reputation ? `+${a.effects.reputation} rep` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          // Reason label when it can't be done (and isn't already done).
          const blockedLabel =
            !q.ok && !done
              ? q.reason === 'needs-money'
                ? 'Need cash'
                : q.reason === 'needs-energy'
                ? 'Low energy'
                : 'Unavailable'
              : null;
          return (
            <View key={a.id} style={[styles.actRow, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.actGlyph, { backgroundColor: withAlpha(IDENTITY, 0.15), borderColor: withAlpha(IDENTITY, 0.3) }]}>
                <meta.Icon size={scale(16)} color={IDENTITY} />
              </View>
              <View style={styles.actBody}>
                <Text style={[styles.actName, { color: theme.text }]} numberOfLines={1}>{a.name}</Text>
                <Text style={[styles.actDesc, { color: theme.textSecondary }]} numberOfLines={2}>{a.description}</Text>
                {/* Price and energy are the two numbers this row is decided on, so
                    they get chips; the stat payoff is a sentence, because six chips
                    on one row is a wall a player reads as texture, not as figures. */}
                <View style={styles.actChips}>
                  {a.cost > 0 ? (
                    <Chip label={formatMoney(a.cost)} icon={<DollarSign size={scale(11)} color={theme.textSecondary} />} />
                  ) : null}
                  {a.energyCost > 0 ? (
                    <Chip label={`−${a.energyCost} energy`} tone="warning" icon={<Zap size={scale(11)} color={accent.warning} />} />
                  ) : null}
                </View>
                {payoff ? (
                  <Text style={[styles.actDesc, { color: theme.textMuted }]} numberOfLines={1}>{payoff}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => handleActivity(a)}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={done ? `${a.name} already done` : `Do ${a.name}`}
                accessibilityState={{ disabled }}
                style={[
                  styles.actBtn,
                  done
                    ? { backgroundColor: withAlpha(accent.success, 0.15), borderColor: withAlpha(accent.success, 0.3) }
                    : q.ok
                    ? { backgroundColor: withAlpha(IDENTITY, 0.16), borderColor: withAlpha(IDENTITY, 0.3) }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {done ? (
                  <>
                    <CheckCircle2 size={scale(13)} color={accent.success} />
                    <Text style={[styles.actBtnText, { color: accent.success }]}>Done</Text>
                  </>
                ) : q.ok ? (
                  <Text style={[styles.actBtnText, { color: IDENTITY }]}>Do it</Text>
                ) : (
                  <Text style={[styles.actBtnText, { color: theme.textMuted }]}>{blockedLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  // ---- Travel-edge card (was "transportation"): keeps every readout, adds the
  // applied fare/speed multipliers as chips. Renders unconditionally now so the
  // multipliers are always visible (density). ----------------------------------
  const renderTravelEdge = () => {
    const vBonus = mods.breakdown.vehicleSpeedBonusPct;
    const pCost = mods.breakdown.politicsCostReductionPct;
    const pCommute = mods.breakdown.politicsCommuteReductionPct;
    const farePct = Math.round((1 - mods.costMultiplier) * 100);
    const speedPct = Math.round((1 - mods.durationMultiplier) * 100);
    const hasEdge = vBonus > 0 || pCost > 0 || pCommute > 0;
    return (
      <View style={[getGlassCard(darkMode, 6), styles.edgeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.edgeTitleRow}>
          <View style={[getGlassIconContainer(darkMode, 30), styles.edgeGlyph, { backgroundColor: withAlpha(IDENTITY, 0.15), borderColor: withAlpha(IDENTITY, 0.3) }]}>
            <TrendingUp size={scale(14)} color={IDENTITY} />
          </View>
          <Text style={[styles.edgeTitle, { color: theme.text }]}>Your travel edge</Text>
        </View>
        <View style={styles.edgeChipsRow}>
          <View style={[styles.edgeChip, { backgroundColor: farePct > 0 ? withAlpha(accent.success, 0.15) : theme.surfaceElevated, borderColor: farePct > 0 ? withAlpha(accent.success, 0.3) : theme.border }]}>
            <DollarSign size={scale(12)} color={farePct > 0 ? accent.success : theme.textMuted} />
            <Text style={[styles.edgeChipLabel, { color: theme.textSecondary }]}>Fares</Text>
            <Text style={[styles.edgeChipValue, { color: farePct > 0 ? accent.success : theme.text }]}>
              {farePct > 0 ? `${farePct}% off` : 'Standard'}
            </Text>
          </View>
          <View style={[styles.edgeChip, { backgroundColor: speedPct > 0 ? withAlpha(IDENTITY, 0.16) : theme.surfaceElevated, borderColor: speedPct > 0 ? withAlpha(IDENTITY, 0.3) : theme.border }]}>
            <Clock size={scale(12)} color={speedPct > 0 ? IDENTITY : theme.textMuted} />
            <Text style={[styles.edgeChipLabel, { color: theme.textSecondary }]}>Trip speed</Text>
            <Text style={[styles.edgeChipValue, { color: speedPct > 0 ? IDENTITY : theme.text }]}>
              {speedPct > 0 ? `${speedPct}% faster` : 'Standard'}
            </Text>
          </View>
        </View>
        {hasEdge ? (
          <View style={styles.edgeSources}>
            {vBonus > 0 && activeVehicle ? (
              <View style={styles.edgeRow}>
                <Car size={scale(13)} color={accent.success} />
                <Text style={[styles.edgeLine, { color: theme.textSecondary }]} numberOfLines={1}>
                  {activeVehicle.name || 'Vehicle'}: {vBonus}% faster trips
                </Text>
              </View>
            ) : null}
            {pCost > 0 ? (
              <View style={styles.edgeRow}>
                <Vote size={scale(13)} color={accent.purple} />
                <Text style={[styles.edgeLine, { color: theme.textSecondary }]} numberOfLines={1}>
                  Transport policy: {Math.round(pCost)}% off all fares
                </Text>
              </View>
            ) : null}
            {pCommute > 0 ? (
              <View style={styles.edgeRow}>
                <Vote size={scale(13)} color={accent.purple} />
                <Text style={[styles.edgeLine, { color: theme.textSecondary }]} numberOfLines={1}>
                  Transport policy: {Math.round(pCommute)}% shorter trips
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.edgeLine, { color: theme.textMuted }]}>
            Own a vehicle or pass a transport policy to unlock cheaper, faster trips.
          </Text>
        )}
      </View>
    );
  };

  // ---- Destinations: departures board + vibe grid --------------------------
  const renderDestinations = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      <EconomyEventBanner context="travel" />

      {/* Departures board - plain Recipe A (EconomyEventBanner owns the screen's
          color moment, so no gradient hero here). */}
      <View style={[getGlassCard(darkMode, 6), styles.boardCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.boardHead}>
          <Compass size={scale(15)} color={IDENTITY} />
          <Text style={[styles.boardEyebrow, { color: theme.textMuted }]}>DEPARTURES</Text>
        </View>
        <StatStrip
          items={[
            { label: 'Destinations', value: DESTINATIONS.length },
            { label: 'Visited', value: visitedCount, tint: IDENTITY },
            { label: 'Trips taken', value: historyCount },
          ]}
        />
        <View style={styles.chipRow}>
          <Chip
            label={ownsPassport ? 'Passport active' : 'No passport · domestic only'}
            tone={ownsPassport ? 'success' : 'warning'}
            icon={<Globe size={scale(11)} color={ownsPassport ? accent.success : accent.warning} />}
          />
        </View>
      </View>

      {renderTravelEdge()}

      {!ownsPassport && (
        <TouchableOpacity
          onPress={handlePassport}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Purchase passport for $500"
          style={[getGlassCard(darkMode, 6), styles.passportCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: withAlpha(IDENTITY, 0.15), borderColor: withAlpha(IDENTITY, 0.3), borderWidth: 1 }]}>
            <Globe size={scale(22)} color={IDENTITY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passportTitle, { color: theme.text }]}>Buy a passport</Text>
            <Text style={[styles.passportSub, { color: theme.textSecondary }]}>$500 for a passport · international destinations</Text>
          </View>
          <View style={[styles.passportBadge, { backgroundColor: IDENTITY }]}>
            <Sparkles size={scale(14)} color="white" />
          </View>
        </TouchableOpacity>
      )}

      <SectionTitle title="Where to next" subtitle="Tap a destination for fares, effects and what can happen." />

      <View style={styles.grid}>
        {DESTINATIONS.map((dest) => {
          const quote = quoteTrip(dest.id, gameState, week);
          const meta = metaFor(dest.id);
          const visited = travel.visitedDestinations?.includes(dest.id);
          const adjusted = quote.ok ? quote.adjustedCost : Math.max(0, Math.floor(dest.cost * mods.costMultiplier));
          const adjustedDuration = quote.ok ? quote.adjustedDuration : Math.max(1, Math.ceil(dest.duration * mods.durationMultiplier));
          const hasDiscount = adjusted < dest.cost;
          const passportRequired = dest.requirements?.items?.includes('passport');
          const locked = passportRequired && !ownsPassport;

          return (
            <TouchableOpacity
              key={dest.id}
              onPress={() => setDetailId(dest.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${dest.name}, ${dest.country}. View details`}
              // Hard Rule #7: the vibe hue used to be a 3px bar pinned across
              // the tile's TOP edge - the same banned one-sided accent the rule
              // names as borderTopWidth, just built from a positioned View. It
              // moves onto the full border. The hue was already carried by the
              // tile wash and the airport-code chip, so this is the third place
              // it appears, not the only one.
              style={[getGlassCard(darkMode, 6), styles.tile, { backgroundColor: theme.surface, borderColor: IDENTITY }]}
            >
              <View pointerEvents="none" style={[styles.tileWash, { backgroundColor: withAlpha(IDENTITY, darkMode ? 0.1 : 0.07) }]} />

              <View style={styles.tileTop}>
                <Text style={styles.tileEmoji}>{meta.emoji}</Text>
                <View style={[styles.tileCode, { backgroundColor: withAlpha(IDENTITY, 0.16), borderColor: withAlpha(IDENTITY, 0.32) }]}>
                  <Text style={[styles.tileCodeText, { color: IDENTITY }]}>{meta.code}</Text>
                </View>
              </View>

              <Text style={[styles.tileName, { color: theme.text }]} numberOfLines={1}>{dest.name}</Text>
              <View style={styles.tileRow}>
                <MapPin size={scale(10)} color={theme.textMuted} />
                <Text style={[styles.tileCountry, { color: theme.textSecondary }]} numberOfLines={1}>{dest.country}</Text>
              </View>

              <View style={styles.tileBadges}>
                {visited && (
                  <Chip label="Visited" tone="success" icon={<CheckCircle size={scale(10)} color={accent.success} />} />
                )}
                {locked && (
                  <Chip label="Passport" tone="warning" icon={<Globe size={scale(10)} color={accent.warning} />} />
                )}
              </View>

              <View style={styles.tileFooter}>
                <View>
                  <Text style={[styles.tilePrice, { color: hasDiscount ? accent.success : theme.text }]}>
                    {formatMoney(adjusted)}
                  </Text>
                  <View style={styles.tileRow}>
                    <Clock size={scale(9)} color={theme.textMuted} />
                    <Text style={[styles.tileMeta, { color: theme.textMuted }]}>
                      {adjustedDuration} wk{adjustedDuration > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {/* The tile itself opens the destination; a "View ›" pill inside
                    it was a button for the thing the whole tile already does. */}
                <ChevronRight size={scale(14)} color={theme.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  // ---- Destination detail (sub-view page) ----------------------------------
  const renderDetail = (dest: TravelDestination) => {
    const meta = metaFor(dest.id);
    const quote = quoteTrip(dest.id, gameState, week);
    const baseCost = dest.cost;
    const adjustedCost = Math.max(0, Math.floor(baseCost * mods.costMultiplier));
    const baseDuration = Math.max(1, dest.duration);
    const adjustedDuration = Math.max(1, Math.ceil(baseDuration * mods.durationMultiplier));
    const savings = baseCost - adjustedCost;
    const visited = travel.visitedDestinations?.includes(dest.id);
    const visits = (travel.travelHistory || []).filter((h) => h.destinationId === dest.id);
    const lastVisit = visits[visits.length - 1];
    const opp = travel.businessOpportunities?.[`business_${dest.id}`];
    // Same pool the on-return roll draws from (generic cost-tier + this
    // destination's curated events), so the preview can't drift from the outcome.
    const events = eligibleTripEvents(baseCost, dest.id);
    const passportRequired = dest.requirements?.items?.includes('passport');

    // Book CTA state mirrors quoteTrip so no feature is lost.
    let ctaLabel = `Book this trip · ${formatMoney(adjustedCost)}`;
    if (!quote.ok) {
      ctaLabel =
        quote.reason === 'already-traveling'
          ? 'Already on a trip'
          : quote.reason === 'needs-passport'
          ? 'Passport required'
          : quote.reason === 'needs-money'
          ? 'Not enough cash'
          : 'Unavailable';
    }

    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Detail hero - ticket-style route header, vibe hue is this screen's one focal gradient. */}
        <View style={[getGlassCard(darkMode, 12), styles.heroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={styles.heroInner}>
            <View pointerEvents="none" style={[styles.detailBlob, { backgroundColor: withAlpha(IDENTITY, 0.1) }]} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            <View style={styles.detailRouteRow}>
              <View style={styles.routeEnd}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{HOME_CODE}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]}>Home</Text>
              </View>
              <View style={styles.routeMid}>
                <ArrowRight size={scale(18)} color={IDENTITY} />
              </View>
              <View style={[styles.routeEnd, { alignItems: 'flex-end' }]}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{meta.code}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]} numberOfLines={1}>{dest.country}</Text>
              </View>
            </View>
            <Text style={[styles.detailName, { color: theme.text }]}>{dest.name}</Text>
            <View style={styles.detailTagRow}>
              <Chip label={classForCost(baseCost)} tint={IDENTITY} />
              {visited && (
                <Chip label={`Visited ${visits.length}×`} tone="success" icon={<CheckCircle size={scale(10)} color={accent.success} />} />
              )}
              {passportRequired && (
                <Chip
                  label={ownsPassport ? 'Passport OK' : 'Passport needed'}
                  tone={ownsPassport ? 'success' : 'warning'}
                  icon={<Globe size={scale(10)} color={ownsPassport ? accent.success : accent.warning} />}
                />
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.detailDesc, { color: theme.textSecondary }]}>{dest.description}</Text>

        {/* Fare breakdown */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Fare and duration" />
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: theme.textSecondary }]}>Base fare</Text>
            <Text style={[styles.fareValue, { color: savings > 0 ? theme.textMuted : theme.text }, savings > 0 && styles.strike]}>
              {formatMoney(baseCost)}
            </Text>
          </View>
          {savings > 0 && (
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: accent.success }]}>Policy savings</Text>
              <Text style={[styles.fareValue, { color: accent.success }]}>−{formatMoney(savings)}</Text>
            </View>
          )}
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: theme.text, fontWeight: '600' }]}>You pay</Text>
            <Text style={[styles.fareValue, { color: IDENTITY, fontWeight: '600' }]}>{formatMoney(adjustedCost)}</Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: theme.border }]} />
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: theme.textSecondary }]}>Duration</Text>
            <Text style={[styles.fareValue, { color: theme.text }]}>
              {adjustedDuration} wk{adjustedDuration > 1 ? 's' : ''}
              {adjustedDuration < baseDuration ? `  (base ${baseDuration})` : ''}
            </Text>
          </View>
        </View>

        {/* Stat effects - all benefits incl. stress + reputation */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Stat effects" />
          <View style={styles.benefitRow}>
            {benefitDescriptors(dest.benefits).map((d) => (
              <BenefitChip key={d.key} Icon={d.Icon} color={d.color} value={d.value} />
            ))}
          </View>
        </View>

        {/* Event pool - what the engine can roll for this trip (cost-eligible). */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="What could happen" />
          <Text style={[styles.cardHint, { color: theme.textMuted }]}>
            0–2 of these may fire on your return ({events.length} possible)
          </Text>
          {events.map((e) => {
            const { Icon, color } = eventIcon(e.category);
            return (
              <View key={e.id} style={[styles.eventRow, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : theme.surfaceElevated }]}>
                <View style={[styles.eventIcon, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.3), borderWidth: 1 }]}>
                  <Icon size={scale(13)} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventHeadline, { color: theme.text }]}>{e.headline}</Text>
                  <Text style={[styles.eventDesc, { color: theme.textSecondary }]} numberOfLines={2}>{e.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Visit history for this destination */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle
            title="Your record"
            right={<Chip label={`${visits.length} visit${visits.length === 1 ? '' : 's'}`} tint={IDENTITY} icon={<Stamp size={scale(11)} color={IDENTITY} />} />}
          />
          <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
            {lastVisit
              ? `Last stamped Week ${lastVisit.week}, Year ${lastVisit.year}.`
              : 'No stamps yet - this would be a first visit.'}
          </Text>
          {!visited && (
            <View style={[styles.firstVisitRow, { backgroundColor: withAlpha(accent.gold, 0.15), borderColor: withAlpha(accent.gold, 0.3) }]}>
              <Award size={scale(13)} color={accent.gold} />
              <Text style={[styles.firstVisitText, { color: accent.gold }]}>First visit unlocks a local business deal</Text>
            </View>
          )}
        </View>

        {/* Business opportunity from this destination (if unlocked) */}
        {opp && (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="Local business" />
            <StorefrontBody
              name={opp.name}
              locLabel={`${dest.name} · ${meta.code}`}
              description={opp.description}
              weeklyIncome={opp.weeklyIncome}
              cost={opp.cost}
              invested={!!opp.invested}
              hue={IDENTITY}
              theme={theme}
              onInvest={() => handleInvest(opp.id)}
            />
          </View>
        )}

        {/* Book CTA - the one loud action on this screen */}
        <TouchableOpacity
          onPress={() => handleBook(dest)}
          disabled={!quote.ok}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !quote.ok }}
          style={[
            styles.bookCta,
            { backgroundColor: quote.ok ? IDENTITY : theme.surfaceElevated },
            quote.ok && getPlatformShadows(5, 0.3, 2, 8),
          ]}
        >
          <Plane size={scale(16)} color={quote.ok ? 'white' : theme.textMuted} />
          <Text style={[styles.bookCtaText, { color: quote.ok ? 'white' : theme.textMuted }]}>{ctaLabel}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ---- My Trip: the BOARDING PASS ------------------------------------------
  const renderTripTab = () => {
    if (!currentTrip) {
      return (
        <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, styles.emptyPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
          <EmptyState
            icon={<Ticket size={scale(28)} color={IDENTITY} />}
            observation="You are not on a trip."
            nudge="Book a destination and this becomes your trip card."
            ctaLabel="Browse destinations"
            onCtaPress={() => setActiveTab('destinations')}
          />
        </ScrollView>
      );
    }

    const dest = DESTINATIONS.find((d) => d.id === currentTrip.destinationId);
    if (!dest) return null;
    const meta = metaFor(dest.id);
    const startWeek = currentTrip.startWeek || 0;
    const returnWeek = currentTrip.returnWeek || 0;
    const effectiveReturn = returnWeek <= 8 && week > 8 ? week : returnWeek;
    const remaining = Math.max(0, effectiveReturn - week);
    const canReturn = remaining <= 0;
    const totalWeeks = Math.max(1, effectiveReturn - startWeek);
    const elapsed = clamp(week - startWeek, 0, totalWeeks);
    const progressPct = clamp((elapsed / totalWeeks) * 100, 0, 100);
    const fare = Math.max(0, Math.floor(dest.cost * mods.costMultiplier));

    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* The trip card. This was a literal boarding pass: an airline brand
            line, an SVG barcode, a dashed perforation with punched notches, and
            a FLIGHT / GATE / SEAT grid whose three values were hashes of the
            destination id - stable-looking noise that no action could change.
            What a player on a trip actually needs is where they are, when they
            get back, and the button home. */}
        <View style={[getGlassCard(darkMode, 12), styles.passCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={styles.passInner}>
            <View pointerEvents="none" style={styles.passBlob} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            <View style={styles.passRouteRow}>
              <View style={styles.routeEnd}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{HOME_CODE}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]}>Home</Text>
              </View>
              <View style={styles.passRouteMid}>
                <Plane size={scale(15)} color={IDENTITY} />
              </View>
              <View style={[styles.routeEnd, { alignItems: 'flex-end' }]}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{meta.code}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]} numberOfLines={1}>{dest.name}</Text>
              </View>
            </View>

            <StatStrip
              items={[
                { label: 'Departed', value: `Wk ${startWeek}` },
                { label: 'Returns', value: `Wk ${effectiveReturn}` },
                { label: 'Fare', value: formatMoney(fare) },
              ]}
            />

            {/* Progress ring + status */}
            <View style={styles.passProgressRow}>
              <ProgressRing
                value={progressPct}
                size={58}
                strokeWidth={6}
                ambient={false}
                state={canReturn ? 'done' : 'active'}
                accentColor={IDENTITY}
                positiveColor={accent.success}
                surfaceColor={theme.surface}
                borderColor={theme.border}
                inkColor={theme.text}
                label="Trip progress"
              >
                <Plane size={scale(16)} color={canReturn ? accent.success : IDENTITY} />
              </ProgressRing>
              <View style={styles.passProgressText}>
                <Text style={[styles.passStatLabel, { color: theme.textMuted }]}>{classForCost(dest.cost)} · {dest.country}</Text>
                <Text style={[styles.passRemainValue, { color: canReturn ? accent.success : theme.text }]}>
                  {canReturn ? 'Ready to return' : `Returning in ${remaining} week${remaining === 1 ? '' : 's'}`}
                </Text>
                <Text style={[styles.passStatLabel, { color: theme.textMuted }]}>
                  {totalWeeks} week trip · {Math.round(progressPct)}% elapsed
                </Text>
              </View>
            </View>

            {/* Return CTA */}
            <TouchableOpacity
              onPress={handleReturn}
              disabled={remaining > 0}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Return home"
              accessibilityState={{ disabled: remaining > 0 }}
              style={[
                styles.returnBtn,
                { backgroundColor: canReturn ? IDENTITY : theme.surfaceElevated },
                canReturn && getPlatformShadows(5, 0.3, 2, 8),
              ]}
            >
              <Text style={[styles.returnBtnText, { color: canReturn ? 'white' : theme.textMuted }]}>
                {canReturn ? 'Return home' : 'Trip in progress…'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* In-trip activities - the things you can DO while at the destination. */}
        {renderActivities(currentTrip.destinationId)}

        {/* Trip-edge context stays visible on the pass screen too. */}
        {renderTravelEdge()}
      </ScrollView>
    );
  };

  // ---- Business: storefront cards ------------------------------------------
  const renderBusiness = () => {
    const opps = Object.values(travel.businessOpportunities || {});
    if (opps.length === 0) {
      return (
        <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, styles.emptyPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
          <EmptyState
            icon={<Store size={scale(28)} color={IDENTITY} />}
            observation="You have no businesses abroad."
            nudge="The first visit to a destination unlocks a local deal you can buy into."
            ctaLabel="Browse destinations"
            onCtaPress={() => setActiveTab('destinations')}
          />
        </ScrollView>
      );
    }

    const investedOpps = opps.filter((o) => o.invested);
    const weeklyPassive = investedOpps.reduce((s, o) => s + (o.weeklyIncome || 0), 0);

    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Portfolio summary */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatStrip
            items={[
              { label: 'Weekly passive income', value: `+${formatMoney(weeklyPassive)}`, tint: accent.success },
              { label: 'Storefronts owned', value: `${investedOpps.length}/${opps.length}` },
            ]}
          />
        </View>

        {opps.map((opp) => {
          const meta = metaFor(opp.destinationId);
          const destName = DESTINATIONS.find((d) => d.id === opp.destinationId)?.name || opp.name;
          return (
            <View key={opp.id} style={[getGlassCard(darkMode, 6), styles.storeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Awning */}
              <View style={[styles.storeAwning, { backgroundColor: withAlpha(IDENTITY, darkMode ? 0.18 : 0.14) }]}>
                <Store size={scale(14)} color={IDENTITY} />
                <Text style={[styles.storeAwningText, { color: theme.text }]} numberOfLines={1}>{destName}</Text>
                <View style={[styles.storeCode, { backgroundColor: withAlpha(IDENTITY, 0.2) }]}>
                  <Text style={[styles.storeCodeText, { color: IDENTITY }]}>{meta.code}</Text>
                </View>
              </View>
              <View style={styles.storeBodyWrap}>
                <StorefrontBody
                  name={opp.name}
                  locLabel={`${destName} · ${meta.code}`}
                  description={opp.description}
                  weeklyIncome={opp.weeklyIncome}
                  cost={opp.cost}
                  invested={!!opp.invested}
                  hue={IDENTITY}
                  theme={theme}
                  onInvest={() => handleInvest(opp.id)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ---- History: passport of rubber stamps ----------------------------------
  const renderHistory = () => {
    const history = travel.travelHistory || [];
    if (history.length === 0) {
      return (
        <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, styles.emptyPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
          <EmptyState
            icon={<Stamp size={scale(28)} color={IDENTITY} />}
            observation="Your passport has no stamps."
            nudge="Every trip you come back from is recorded here."
            ctaLabel="Browse destinations"
            onCtaPress={() => setActiveTab('destinations')}
          />
        </ScrollView>
      );
    }
    const stamps = [...history].reverse();
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Passport cover */}
        <View style={[getGlassCard(darkMode, 6), styles.coverCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.coverHead}>
            <Stamp size={scale(15)} color={IDENTITY} />
            <Text style={[styles.boardEyebrow, { color: theme.textMuted }]}>PASSPORT</Text>
          </View>
          <StatStrip
            items={[
              { label: 'Stamps', value: history.length, tint: IDENTITY },
              { label: 'Countries', value: visitedCount },
              { label: 'Passport', value: ownsPassport ? 'Yes' : 'No', tint: ownsPassport ? accent.success : accent.warning },
            ]}
          />
        </View>

        {/* Frequent-flyer milestones - a bounded one-off progression to aim for.
            Tiers are earned by distinct destinations visited; rewards apply on return. */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Frequent flyer" right={<Chip label={`${visitedCount} visited`} tint={IDENTITY} />} />
          <View style={styles.milestoneRow}>
            {TRAVEL_MILESTONE_TIERS.map((t) => {
              const earned = visitedCount >= t.threshold;
              return (
                <Chip
                  key={t.id}
                  label={`${t.label} · ${t.threshold}`}
                  tint={earned ? accent.gold : undefined}
                  icon={earned ? <Award size={scale(11)} color={accent.gold} /> : <Globe size={scale(11)} color={theme.textMuted} />}
                  accessibilityLabel={`${t.label}, ${t.threshold} destinations${earned ? ', earned' : ''}`}
                />
              );
            })}
          </View>
          {(() => {
            const next = TRAVEL_MILESTONE_TIERS.find((t) => visitedCount < t.threshold);
            if (!next) {
              return <Text style={[styles.cardHint, { color: accent.gold }]}>Every frequent-flyer tier unlocked.</Text>;
            }
            const remaining = next.threshold - visitedCount;
            return (
              <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
                {remaining} more destination{remaining === 1 ? '' : 's'} to reach {next.label} (+{next.happiness} happiness{next.reputation ? `, +${next.reputation} rep` : ''}).
              </Text>
            );
          })()}
        </View>

        <View style={styles.stampsWrap}>
          {stamps.map((entry, idx) => {
            const dest = DESTINATIONS.find((d) => d.id === entry.destinationId);
            if (!dest) return null;
            const meta = metaFor(dest.id);
            return (
              <TouchableOpacity
                key={`${entry.destinationId}-${entry.week}-${idx}`}
                onPress={() => setDetailId(dest.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${dest.name} stamp, Week ${entry.week} Year ${entry.year}. View details`}
                style={styles.stamp}
              >
                <View style={[styles.stampInner, { borderColor: withAlpha(IDENTITY, 0.55) }]}>
                  <View pointerEvents="none" style={[styles.stampWash, { backgroundColor: withAlpha(IDENTITY, darkMode ? 0.12 : 0.08) }]} />
                  <Text style={[styles.stampCode, { color: IDENTITY }]}>{meta.code}</Text>
                  <Text style={[styles.stampName, { color: theme.text }]} numberOfLines={1}>{dest.name}</Text>
                  <View style={[styles.stampDivider, { backgroundColor: withAlpha(IDENTITY, 0.4) }]} />
                  <Text style={[styles.stampMeta, { color: theme.textSecondary }]}>WK {entry.week} · YR {entry.year}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const detailDest = detailId ? DESTINATIONS.find((d) => d.id === detailId) : undefined;
  const headerTitle = detailDest ? detailDest.name : 'Travel';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        title={headerTitle}
        onBack={() => (detailId ? setDetailId(null) : onBack())}
        backLabel={detailId ? 'Back to destinations' : 'Back'}
        right={<CashChip value={formatMoney(money)} tint={IDENTITY} />}
      />

      {detailDest ? (
        renderDetail(detailDest)
      ) : (
        <>
          {/* The old bar was four underlined text buttons with no label and no
              tab role - unreachable by name to a screen reader. */}
          <SegmentedControl
            segments={TABS}
            value={activeTab}
            onChange={setActiveTab}
            activeColor={IDENTITY}
            style={styles.tabs}
          />

          {activeTab === 'destinations' && renderDestinations()}
          {activeTab === 'trip' && renderTripTab()}
          {activeTab === 'business' && renderBusiness()}
          {activeTab === 'history' && renderHistory()}
        </>
      )}

      <TripReturnModal
        result={returnEvents}
        onClose={() => setReturnEvents(null)}
        theme={theme}
        darkMode={darkMode}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function StorefrontBody({
  name,
  locLabel,
  description,
  weeklyIncome,
  cost,
  invested,
  hue,
  theme,
  onInvest,
}: {
  name: string;
  locLabel: string;
  description: string;
  weeklyIncome: number;
  cost: number;
  invested: boolean;
  hue: string;
  theme: ReturnType<typeof getThemeColors>;
  onInvest: () => void;
}) {
  return (
    <View>
      <Text style={[styles.storeName, { color: theme.text }]}>{name}</Text>
      <View style={styles.tileRow}>
        <MapPin size={scale(10)} color={hue} />
        <Text style={[styles.storeLoc, { color: theme.textSecondary }]} numberOfLines={1}>{locLabel}</Text>
      </View>
      <Text style={[styles.storeDesc, { color: theme.textSecondary }]} numberOfLines={2}>{description}</Text>
      <View style={styles.storeMetrics}>
        <Chip label={`+${formatMoney(weeklyIncome)}/wk`} tone="success" icon={<TrendingUp size={scale(11)} color={accent.success} />} />
        <Chip label={`Cost ${formatMoney(cost)}`} icon={<DollarSign size={scale(11)} color={theme.textSecondary} />} />
      </View>
      <TouchableOpacity
        onPress={onInvest}
        disabled={invested}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={invested ? 'Already invested' : `Invest ${formatMoney(cost)}`}
        accessibilityState={{ disabled: invested }}
        style={[styles.investBtn, { backgroundColor: invested ? withAlpha(accent.success, 0.15) : withAlpha(IDENTITY, 0.16), borderColor: invested ? withAlpha(accent.success, 0.3) : withAlpha(IDENTITY, 0.3) }]}
      >
        {invested ? <CheckCircle size={scale(14)} color={accent.success} /> : <Store size={scale(14)} color={IDENTITY} />}
        <Text style={[styles.investBtnText, { color: invested ? accent.success : IDENTITY }]}>{invested ? 'Invested - earning' : 'Invest'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BenefitChip({
  Icon,
  color,
  value,
}: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  value: string;
}) {
  return <Chip label={value} tint={color} icon={<Icon size={scale(11)} color={color} />} />;
}

function eventIcon(category: TravelEventDef['category']) {
  switch (category) {
    case 'positive':
      return { Icon: Sparkles, color: accent.success };
    case 'opportunity':
      return { Icon: TrendingUp, color: accent.info };
    case 'expense':
      return { Icon: Coins, color: accent.warning };
    case 'health':
      return { Icon: Skull, color: accent.danger };
    default:
      return { Icon: AlertTriangle, color: accent.muted };
  }
}

function TripReturnModal({
  result,
  onClose,
  theme,
  darkMode,
}: {
  result: TripReturnResult | null;
  onClose: () => void;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
}) {
  if (!result) return null;
  const events = result.events || [];
  return (
    <BaseModal
      visible={!!result}
      onClose={onClose}
      title={`Welcome back from ${result.destinationName}`}
      footer={
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={[styles.modalBtn, { backgroundColor: IDENTITY }]}
        >
          <Text style={styles.modalBtnText}>Done</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.modalBody}>
          {events.length === 0 ? (
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              A smooth, uneventful trip. Stat benefits applied.
            </Text>
          ) : (
            <View style={{ width: '100%' }}>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Some things happened along the way:
              </Text>
              {events.map((e) => {
                const { Icon, color } = eventIcon(e.category);
                return (
                  <View
                    key={e.id}
                    style={[styles.eventRow, { backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : theme.surfaceElevated }]}
                  >
                    <View style={[styles.eventIcon, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.3), borderWidth: 1 }]}>
                      <Icon size={scale(14)} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eventHeadline, { color: theme.text }]}>{e.headline}</Text>
                      <Text style={[styles.eventDesc, { color: theme.textSecondary }]}>{e.description}</Text>
                      <View style={styles.eventDeltas}>
                        {e.moneyDelta ? (
                          <Text style={{ color: e.moneyDelta < 0 ? accent.danger : accent.success, fontSize: fs.xs, fontWeight: '600' }}>
                            {e.moneyDelta < 0 ? '−' : '+'}{formatMoney(Math.abs(e.moneyDelta))}
                          </Text>
                        ) : null}
                        {e.happinessDelta ? <Text style={{ color: accent.danger, fontSize: fs.xs }}>♥ {e.happinessDelta > 0 ? '+' : ''}{e.happinessDelta}</Text> : null}
                        {e.healthDelta ? <Text style={{ color: accent.success, fontSize: fs.xs }}>HP {e.healthDelta > 0 ? '+' : ''}{e.healthDelta}</Text> : null}
                        {e.energyDelta ? <Text style={{ color: accent.warning, fontSize: fs.xs }}>EN {e.energyDelta > 0 ? '+' : ''}{e.energyDelta}</Text> : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {result.milestonesEarned && result.milestonesEarned.length > 0 ? (
            <View style={{ width: '100%' }}>
              {result.milestonesEarned.map((m) => (
                <View
                  key={m.id}
                  style={[styles.eventRow, { backgroundColor: withAlpha(accent.gold, 0.1), borderColor: withAlpha(accent.gold, 0.3), borderWidth: 1 }]}
                >
                  <View style={[styles.eventIcon, { backgroundColor: withAlpha(accent.gold, 0.15), borderColor: withAlpha(accent.gold, 0.3), borderWidth: 1 }]}>
                    <Award size={scale(14)} color={accent.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventHeadline, { color: theme.text }]}>Milestone unlocked · {m.label}</Text>
                    <Text style={[styles.eventDesc, { color: theme.textSecondary }]}>{m.description}</Text>
                    <View style={styles.eventDeltas}>
                      {m.happiness ? <Text style={{ color: accent.danger, fontSize: fs.xs }}>♥ +{m.happiness}</Text> : null}
                      {m.reputation ? <Text style={{ color: accent.gold, fontSize: fs.xs }}>★ +{m.reputation} rep</Text> : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { marginHorizontal: sp.md, marginBottom: sp.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },
  emptyPad: { flexGrow: 1, justifyContent: 'center' },

  // Departures board / passport cover
  boardCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  boardHead: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  boardEyebrow: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 1.2 },

  // Travel edge
  edgeCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  edgeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  edgeGlyph: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  edgeTitle: { fontSize: fs.md, fontWeight: '600', letterSpacing: 0.2 },
  edgeChipsRow: { flexDirection: 'row', gap: sp.sm },
  edgeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.lg, borderWidth: 1 },
  edgeChipLabel: { fontSize: fs.xs, flex: 1 },
  edgeChipValue: { fontSize: fs.xs, fontWeight: '600' },
  edgeSources: { gap: sp.xs },
  edgeRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  edgeLine: { fontSize: fs.xs, flex: 1 },

  // Passport (purchase) card
  passportCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  passportTitle: { fontWeight: '600', fontSize: fs.md },
  passportSub: { fontSize: fs.xs, marginTop: 2 },
  passportBadge: { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },

  // Section headers

  // Vibe grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  tile: { flexGrow: 1, flexBasis: '46%', minWidth: scale(150), padding: sp.md, borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  tileWash: { ...StyleSheet.absoluteFillObject },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.xs },
  tileEmoji: { fontSize: scale(26) },
  tileCode: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.sm, borderWidth: 1 },
  tileCodeText: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 1 },
  tileName: { fontSize: fs.md, fontWeight: '600' },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  tileCountry: { fontSize: fs.xs },
  tileBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginTop: sp.xs, minHeight: scale(16) },
  tileFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: sp.sm },
  tilePrice: { fontSize: fs.lg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileMeta: { fontSize: fs.xs },

  // Detail hero
  heroCard: { borderRadius: br['2xl'], borderWidth: 1 },
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.sm },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  detailBlob: { position: 'absolute', top: -scale(48), right: -scale(36), width: scale(150), height: scale(150), borderRadius: scale(75) },
  detailRouteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeEnd: { minWidth: scale(64) },
  routeCode: { fontSize: fs['3xl'], fontWeight: '700', letterSpacing: 1 },
  routeCity: { fontSize: fs.xs },
  routeMid: { flex: 1, alignItems: 'center', gap: 2 },
  detailName: { fontSize: fs.xl, fontWeight: '700' },
  detailTagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs },
  detailDesc: { fontSize: fs.sm, lineHeight: fs.lg },

  // Generic detail card
  card: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  cardHint: { fontSize: fs.xs },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareLabel: { fontSize: fs.sm },
  fareValue: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  fareDivider: { height: 1, marginVertical: 2 },
  strike: { textDecorationLine: 'line-through' },
  firstVisitRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.lg, borderWidth: 1 },
  firstVisitText: { fontSize: fs.xs, fontWeight: '600', flex: 1 },

  // In-trip activities
  actRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.sm, borderRadius: br.lg, borderWidth: 1 },
  actGlyph: { width: scale(34), height: scale(34), borderRadius: br.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actBody: { flex: 1, gap: 2 },
  actName: { fontSize: fs.sm, fontWeight: '600' },
  actDesc: { fontSize: fs.xs },
  actChips: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginTop: 2 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: sp.sm, minHeight: touchTargets.minimum, borderRadius: br.full, borderWidth: 1, minWidth: scale(56), justifyContent: 'center' },
  actBtnText: { fontSize: fs.xs, fontWeight: '600' },

  // Benefits
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },

  // Book CTA
  bookCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, minHeight: touchTargets.minimum, borderRadius: br.full, paddingHorizontal: sp.md },
  bookCtaText: { fontSize: fs.md, fontWeight: '600' },

  // Boarding pass
  passCard: { borderRadius: br['2xl'], borderWidth: 1 },
  passInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.md },
  passBlob: { position: 'absolute', top: -scale(48), right: -scale(36), width: scale(150), height: scale(150), borderRadius: scale(75), backgroundColor: 'rgba(20, 184, 166, 0.10)' },
  passRouteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passRouteMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm },
  passProgressRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, paddingRight: sp.xs },
  passProgressText: { flex: 1, gap: 2 },
  passStatLabel: { fontSize: fs.xs },
  passRemainValue: { fontSize: fs.lg, fontWeight: '600' },



  // Return CTA
  returnBtn: { width: '100%', minHeight: touchTargets.minimum, borderRadius: br.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sp.md },
  returnBtnText: { fontSize: fs.md, fontWeight: '600' },


  storeCard: { borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  storeAwning: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.md, paddingVertical: sp.sm },
  storeAwningText: { fontSize: fs.sm, fontWeight: '600', flex: 1 },
  storeCode: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.sm },
  storeCodeText: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 1 },
  storeBodyWrap: { padding: sp.md, gap: sp.xs },
  storeName: { fontSize: fs.md, fontWeight: '600' },
  storeLoc: { fontSize: fs.xs },
  storeDesc: { fontSize: fs.xs, marginTop: 2 },
  storeMetrics: { flexDirection: 'row', gap: sp.xs, marginTop: sp.xs, flexWrap: 'wrap' },
  investBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, paddingVertical: sp.sm, borderRadius: br.full, borderWidth: 1, marginTop: sp.sm, minHeight: touchTargets.minimum },
  investBtnText: { fontSize: fs.sm, fontWeight: '600' },

  // Passport stamps
  coverCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  coverHead: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },

  // Frequent-flyer milestone strip
  milestoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  stampsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.md, paddingVertical: sp.xs },
  stamp: { flexGrow: 1, flexBasis: '44%', minWidth: scale(140) },
  stampInner: { borderRadius: br.lg, borderWidth: 2, borderStyle: 'dashed', padding: sp.sm, alignItems: 'center', gap: 2, overflow: 'hidden' },
  stampWash: { ...StyleSheet.absoluteFillObject },
  stampCode: { fontSize: fs.lg, fontWeight: '600', letterSpacing: 2 },
  stampName: { fontSize: fs.xs, fontWeight: '600' },
  stampDivider: { width: '60%', height: 1, marginVertical: 2 },
  stampMeta: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },

  // Return modal
  modalSub: { fontSize: fs.sm, textAlign: 'center', marginBottom: sp.sm },
  eventRow: { flexDirection: 'row', gap: sp.sm, padding: sp.sm, borderRadius: br.lg, marginBottom: sp.xs },
  eventIcon: { width: scale(30), height: scale(30), borderRadius: scale(15), alignItems: 'center', justifyContent: 'center' },
  eventHeadline: { fontSize: fs.sm, fontWeight: '600' },
  eventDesc: { fontSize: fs.xs, marginTop: 2 },
  eventDeltas: { flexDirection: 'row', gap: sp.sm, marginTop: sp.xs, flexWrap: 'wrap' },
  modalBody: { gap: sp.sm },
  modalBtn: { minHeight: touchTargets.minimum, alignItems: 'center', justifyContent: 'center', borderRadius: br.full },
  modalBtnText: { color: 'white', fontSize: fs.md, fontWeight: '600' },
});
