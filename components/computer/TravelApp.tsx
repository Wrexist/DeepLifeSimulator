/**
 * Travel App — Boarding-Pass DNA (differentiation pass on top of Slate Glass).
 *
 * Skeleton is deliberately NOT "eyebrow hero + uniform rows":
 *   - My Trip tab = a real BOARDING PASS: HOM → route, airline header, a
 *     flight/gate/seat + depart/return/fare info grid, a trip-progress ring,
 *     a dashed PERFORATION with punched notches, and an SVG BARCODE stub.
 *   - Destinations tab = a DEPARTURES board + a vibe GRID of per-destination
 *     tinted panels (each opens a rich detail page — list→detail sub-view).
 *   - Business tab = STOREFRONT cards with awnings + a passive-income medal.
 *   - History tab = a PASSPORT book of rubber-stamp chips.
 *
 * Densifies with data the old UI hid: stress-relief + reputation benefits, the
 * full per-destination event pool, fare/duration breakdowns, trip progress,
 * absolute depart/return weeks, times-visited counts, passive-income totals.
 *
 * Slate Glass still binding: LinearGradientFallback only (colors[0] flat),
 * elevation via glass helpers + getPlatformShadows, no expo-blur, no raw boxShadow,
 * no `as any`. Identity accent = teal #14B8A6 (solid only on small
 * CTAs/badges/glyphs); per-destination vibe hues are categorical Recipe-C
 * tints. ZERO REMOVAL — every prior action stays reachable.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import {
  ArrowLeft,
  ArrowRight,
  Plane,
  Ticket,
  MapPin,
  Heart,
  Zap,
  Battery,
  Brain,
  Globe,
  Clock,
  Calendar,
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
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import { transportationMods } from '@/lib/travel/transportation';
import { quoteTrip } from '@/lib/travel/operations';
import { TravelEventDef, eligibleTripEvents } from '@/lib/travel/events';
import { TRAVEL_MILESTONE_TIERS } from '@/lib/travel/milestones';
import {
  travelTo,
  returnFromTrip,
  purchasePassport,
  investInBusinessOpportunity,
  TripReturnResult,
} from '@/contexts/game/actions/TravelActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ProgressRing from '@/components/ui/ProgressRing';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  touchTargets,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import {
  getGlassCard,
  getGlassIconContainer,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';

const LinearGradient = LinearGradientFallback;

// Slate Glass identity accent for the Travel app: teal #14B8A6.
// Solid only on small CTAs/badges/glyphs; elsewhere the translucent tints.
const IDENTITY = '#14B8A6';
const IDENTITY_PAIR = '#0D9488';
const tint = (alpha: number) => `rgba(20, 184, 166, ${alpha})`;
// 8-digit hex alpha for semantic (non-identity) Recipe C chips: ~15% fill / ~30% rim.
const softFill = (hex: string) => `${hex}26`;
const softRim = (hex: string) => `${hex}4D`;
// Same, from an rgb() base color for the per-destination vibe tints.
const vibeTint = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const HOME_CODE = 'HOM';

// Per-destination boarding-pass flavor + vibe. IATA codes and vibe hues are
// presentation only (deterministic, no game state). Missing entries fall back
// to a derived 3-letter code / identity teal.
const DEST_META: Record<string, { code: string; hue: string; emoji: string }> = {
  local_resort: { code: 'RST', hue: accent.success, emoji: '🏖️' },
  paris: { code: 'CDG', hue: '#F43F5E', emoji: '🗼' },
  tokyo: { code: 'HND', hue: accent.purple, emoji: '🏯' },
  bali: { code: 'DPS', hue: IDENTITY, emoji: '🏝️' },
  new_york: { code: 'JFK', hue: accent.info, emoji: '🗽' },
  swiss_alps: { code: 'ZRH', hue: '#60A5FA', emoji: '🏔️' },
  london: { code: 'LHR', hue: accent.info, emoji: '🎡' },
  dubai: { code: 'DXB', hue: accent.amber, emoji: '🏙️' },
  rome: { code: 'FCO', hue: accent.warning, emoji: '🏛️' },
  thailand: { code: 'BKK', hue: IDENTITY, emoji: '🛕' },
  sydney: { code: 'SYD', hue: '#06B6D4', emoji: '🌊' },
  cancun: { code: 'CUN', hue: IDENTITY, emoji: '🐚' },
  iceland: { code: 'KEF', hue: '#60A5FA', emoji: '🌋' },
  safari: { code: 'NBO', hue: accent.amber, emoji: '🦁' },
  maldives: { code: 'MLE', hue: '#06B6D4', emoji: '🐠' },
  camping_trip: { code: 'CMP', hue: accent.success, emoji: '🏕️' },
  road_trip: { code: 'RTR', hue: accent.warning, emoji: '🚗' },
};
const metaFor = (id: string) =>
  DEST_META[id] || { code: id.slice(0, 3).toUpperCase(), hue: IDENTITY, emoji: '🌍' };

// FNV-1a — stable pseudo values for boarding-pass flavor (gate/seat/flight/ref).
const hashStr = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const flightNo = (id: string) => `DL ${100 + (hashStr(id) % 900)}`;
const gateOf = (id: string) =>
  `${String.fromCharCode(65 + (hashStr(id + 'gate') % 6))}${1 + (hashStr(id + 'g2') % 30)}`;
const seatOf = (id: string) =>
  `${1 + (hashStr(id + 'seat') % 40)}${String.fromCharCode(65 + (hashStr(id + 's2') % 6))}`;
const bookingRef = (seed: string) => hashStr(seed).toString(36).toUpperCase().slice(0, 6).padEnd(6, 'X');
const classForCost = (c: number) => (c >= 5000 ? 'FIRST' : c >= 2500 ? 'BUSINESS' : 'ECONOMY');

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Non-zero benefit descriptors — surfaces stress-relief + reputation the old UI
// dropped. `core` limits to the four headline stats for compact grid tiles.
function benefitDescriptors(
  b: TravelDestination['benefits'],
  core = false
): { Icon: React.ComponentType<{ size: number; color: string }>; color: string; value: string; key: string }[] {
  const out = [] as { Icon: React.ComponentType<{ size: number; color: string }>; color: string; value: string; key: string }[];
  if (b.happiness) out.push({ Icon: Heart, color: accent.danger, value: `${b.happiness > 0 ? '+' : ''}${b.happiness}`, key: 'hap' });
  if (b.health) out.push({ Icon: Battery, color: accent.success, value: `${b.health > 0 ? '+' : ''}${b.health}`, key: 'hp' });
  if (b.energy) out.push({ Icon: Zap, color: accent.warning, value: `${b.energy > 0 ? '+' : ''}${b.energy}`, key: 'en' });
  if (b.intelligence) out.push({ Icon: Brain, color: accent.purple, value: `+${b.intelligence}`, key: 'iq' });
  if (core) return out;
  if (b.stress) {
    // Negative stress = relief (a benefit); positive stress = an increase (a
    // penalty, e.g. New York +5) — style it clearly so it can't read as relief.
    const stressUp = b.stress > 0;
    out.push({
      Icon: stressUp ? AlertTriangle : Sparkles,
      color: stressUp ? accent.danger : IDENTITY,
      value: `${stressUp ? '+' : ''}${b.stress} stress`,
      key: 'str',
    });
  }
  if (b.reputation) out.push({ Icon: Star, color: accent.gold, value: `+${b.reputation} rep`, key: 'rep' });
  return out;
}

type TabType = 'destinations' | 'trip' | 'business' | 'history';

interface TravelAppProps {
  onBack: () => void;
}

export default function TravelApp({ onBack }: TravelAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('destinations');
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
  const travelerName = (gameState.userProfile?.name || 'Traveler').toUpperCase();

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
        Alert.alert('Cannot book', quote.message);
        return;
      }
      Alert.alert(
        `Travel to ${dest.name}?`,
        `Cost $${quote.adjustedCost.toLocaleString()} • ${quote.adjustedDuration} week${quote.adjustedDuration > 1 ? 's' : ''}` +
          (quote.adjustedCost !== quote.baseCost
            ? `\n(base $${quote.baseCost.toLocaleString()} — policy savings)`
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
                Alert.alert('Error', r.message);
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
      Alert.alert('Still traveling', r.message);
    }
  }, [currentTrip, gameState, setGameState, saveGame]);

  const handlePassport = useCallback(() => {
    Alert.alert('Purchase passport?', 'Costs $500 and unlocks international destinations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Buy',
        onPress: () => {
          const r = purchasePassport(gameState, setGameState, { updateMoney });
          if (r.success) saveGame();
          else Alert.alert('Error', r.message);
        },
      },
    ]);
  }, [gameState, setGameState, saveGame]);

  const handleInvest = useCallback(
    (opportunityId: string) => {
      const opp = travel.businessOpportunities?.[opportunityId];
      if (!opp) return;
      Alert.alert(
        `Invest in ${opp.name}?`,
        `$${opp.cost.toLocaleString()} for $${opp.weeklyIncome.toLocaleString()}/week passive.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Invest',
            onPress: () => {
              const r = investInBusinessOpportunity(gameState, setGameState, opportunityId, {
                updateMoney,
              });
              if (r.success) saveGame();
              else Alert.alert('Error', r.message);
            },
          },
        ]
      );
    },
    [gameState, setGameState, saveGame, travel.businessOpportunities]
  );

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
          <View style={[getGlassIconContainer(darkMode, 30), styles.edgeGlyph, { backgroundColor: tint(0.15), borderColor: tint(0.3) }]}>
            <TrendingUp size={scale(14)} color={IDENTITY} />
          </View>
          <Text style={[styles.edgeTitle, { color: theme.text }]}>Your travel edge</Text>
        </View>
        <View style={styles.edgeChipsRow}>
          <View style={[styles.edgeChip, { backgroundColor: farePct > 0 ? softFill(accent.success) : theme.surfaceElevated, borderColor: farePct > 0 ? softRim(accent.success) : theme.border }]}>
            <DollarSign size={scale(12)} color={farePct > 0 ? accent.success : theme.textMuted} />
            <Text style={[styles.edgeChipLabel, { color: theme.textSecondary }]}>Fares</Text>
            <Text style={[styles.edgeChipValue, { color: farePct > 0 ? accent.success : theme.text }]}>
              {farePct > 0 ? `${farePct}% off` : 'Standard'}
            </Text>
          </View>
          <View style={[styles.edgeChip, { backgroundColor: speedPct > 0 ? tint(0.16) : theme.surfaceElevated, borderColor: speedPct > 0 ? tint(0.3) : theme.border }]}>
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

      {/* Departures board — plain Recipe A (EconomyEventBanner owns the screen's
          color moment, so no gradient hero here). */}
      <View style={[getGlassCard(darkMode, 6), styles.boardCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.boardHead}>
          <Compass size={scale(15)} color={IDENTITY} />
          <Text style={[styles.boardEyebrow, { color: theme.textMuted }]}>DEPARTURES</Text>
        </View>
        <View style={styles.boardStatsRow}>
          <BoardStat value={String(DESTINATIONS.length)} label="Destinations" theme={theme} />
          <View style={[styles.boardDivider, { backgroundColor: theme.border }]} />
          <BoardStat value={String(visitedCount)} label="Visited" theme={theme} color={IDENTITY} />
          <View style={[styles.boardDivider, { backgroundColor: theme.border }]} />
          <BoardStat value={String(historyCount)} label="Trips taken" theme={theme} />
        </View>
        <View style={[styles.boardPass, { backgroundColor: ownsPassport ? softFill(accent.success) : softFill(accent.warning), borderColor: ownsPassport ? softRim(accent.success) : softRim(accent.warning) }]}>
          <Globe size={scale(12)} color={ownsPassport ? accent.success : accent.warning} />
          <Text style={[styles.boardPassText, { color: ownsPassport ? accent.success : accent.warning }]}>
            {ownsPassport ? 'Passport active — world unlocked' : 'No passport — domestic only'}
          </Text>
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
          <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: tint(0.15), borderColor: tint(0.3), borderWidth: 1 }]}>
            <Globe size={scale(22)} color={IDENTITY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passportTitle, { color: theme.text }]}>Unlock world travel</Text>
            <Text style={[styles.passportSub, { color: theme.textSecondary }]}>$500 for a passport · international destinations</Text>
          </View>
          <View style={[styles.passportBadge, { backgroundColor: IDENTITY }]}>
            <Sparkles size={scale(14)} color="white" />
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeadRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Where to next</Text>
        <Text style={[styles.sectionCount, { color: theme.textMuted }]}>Tap a tile for details</Text>
      </View>

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
              style={[getGlassCard(darkMode, 6), styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View pointerEvents="none" style={[styles.tileWash, { backgroundColor: vibeTint(meta.hue, darkMode ? 0.1 : 0.07) }]} />
              <View pointerEvents="none" style={[styles.tileStripe, { backgroundColor: meta.hue }]} />

              <View style={styles.tileTop}>
                <Text style={styles.tileEmoji}>{meta.emoji}</Text>
                <View style={[styles.tileCode, { backgroundColor: vibeTint(meta.hue, 0.16), borderColor: vibeTint(meta.hue, 0.32) }]}>
                  <Text style={[styles.tileCodeText, { color: meta.hue }]}>{meta.code}</Text>
                </View>
              </View>

              <Text style={[styles.tileName, { color: theme.text }]} numberOfLines={1}>{dest.name}</Text>
              <View style={styles.tileRow}>
                <MapPin size={scale(10)} color={theme.textMuted} />
                <Text style={[styles.tileCountry, { color: theme.textSecondary }]} numberOfLines={1}>{dest.country}</Text>
              </View>

              <View style={styles.tileBadges}>
                {visited && (
                  <View style={[styles.tinyPill, { backgroundColor: softFill(accent.success) }]}>
                    <CheckCircle size={scale(9)} color={accent.success} />
                    <Text style={[styles.tinyPillText, { color: accent.success }]}>Visited</Text>
                  </View>
                )}
                {locked && (
                  <View style={[styles.tinyPill, { backgroundColor: softFill(accent.warning) }]}>
                    <Globe size={scale(9)} color={accent.warning} />
                    <Text style={[styles.tinyPillText, { color: accent.warning }]}>Passport</Text>
                  </View>
                )}
              </View>

              <View style={styles.tileFooter}>
                <View>
                  <Text style={[styles.tilePrice, { color: hasDiscount ? accent.success : theme.text }]}>
                    ${adjusted.toLocaleString()}
                  </Text>
                  <View style={styles.tileRow}>
                    <Clock size={scale(9)} color={theme.textMuted} />
                    <Text style={[styles.tileMeta, { color: theme.textMuted }]}>
                      {adjustedDuration} wk{adjustedDuration > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <View style={[styles.tileView, { backgroundColor: tint(0.16) }]}>
                  <Text style={[styles.tileViewText, { color: IDENTITY }]}>View</Text>
                  <ChevronRight size={scale(12)} color={IDENTITY} />
                </View>
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
    let ctaLabel = `Book this trip · $${adjustedCost.toLocaleString()}`;
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
        {/* Detail hero — ticket-style route header, vibe hue is this screen's one focal gradient. */}
        <View style={[getGlassCard(darkMode, 12), styles.heroCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={styles.heroInner}>
            <LinearGradient
              pointerEvents="none"
              colors={[vibeTint(meta.hue, 0.16), vibeTint(meta.hue, 0.03)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={[styles.detailBlob, { backgroundColor: vibeTint(meta.hue, 0.1) }]} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            <View style={styles.detailRouteRow}>
              <View style={styles.routeEnd}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{HOME_CODE}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]}>Home</Text>
              </View>
              <View style={styles.routeMid}>
                <Text style={styles.routeEmoji}>{meta.emoji}</Text>
                <ArrowRight size={scale(18)} color={meta.hue} />
              </View>
              <View style={[styles.routeEnd, { alignItems: 'flex-end' }]}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{meta.code}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]} numberOfLines={1}>{dest.country}</Text>
              </View>
            </View>
            <Text style={[styles.detailName, { color: theme.text }]}>{dest.name}</Text>
            <View style={styles.detailTagRow}>
              <View style={[styles.classChip, { backgroundColor: vibeTint(meta.hue, 0.16), borderColor: vibeTint(meta.hue, 0.32) }]}>
                <Text style={[styles.classChipText, { color: meta.hue }]}>{classForCost(baseCost)}</Text>
              </View>
              {visited && (
                <View style={[styles.tinyPill, { backgroundColor: softFill(accent.success) }]}>
                  <CheckCircle size={scale(9)} color={accent.success} />
                  <Text style={[styles.tinyPillText, { color: accent.success }]}>Visited {visits.length}×</Text>
                </View>
              )}
              {passportRequired && (
                <View style={[styles.tinyPill, { backgroundColor: ownsPassport ? softFill(accent.success) : softFill(accent.warning) }]}>
                  <Globe size={scale(9)} color={ownsPassport ? accent.success : accent.warning} />
                  <Text style={[styles.tinyPillText, { color: ownsPassport ? accent.success : accent.warning }]}>
                    {ownsPassport ? 'Passport OK' : 'Passport needed'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.detailDesc, { color: theme.textSecondary }]}>{dest.description}</Text>

        {/* Fare breakdown */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Fare & duration</Text>
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: theme.textSecondary }]}>Base fare</Text>
            <Text style={[styles.fareValue, { color: savings > 0 ? theme.textMuted : theme.text }, savings > 0 && styles.strike]}>
              ${baseCost.toLocaleString()}
            </Text>
          </View>
          {savings > 0 && (
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: accent.success }]}>Policy savings</Text>
              <Text style={[styles.fareValue, { color: accent.success }]}>−${savings.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: theme.text, fontWeight: '800' }]}>You pay</Text>
            <Text style={[styles.fareValue, { color: IDENTITY, fontWeight: '800' }]}>${adjustedCost.toLocaleString()}</Text>
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

        {/* Stat effects — all benefits incl. stress + reputation */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Stat effects</Text>
          <View style={styles.benefitRow}>
            {benefitDescriptors(dest.benefits).map((d) => (
              <BenefitChip key={d.key} Icon={d.Icon} color={d.color} value={d.value} />
            ))}
          </View>
        </View>

        {/* Event pool — what the engine can roll for this trip (cost-eligible). */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>What could happen</Text>
          <Text style={[styles.cardHint, { color: theme.textMuted }]}>
            0–2 of these may fire on your return ({events.length} possible)
          </Text>
          {events.map((e) => {
            const { Icon, color } = eventIcon(e.category);
            return (
              <View key={e.id} style={[styles.eventRow, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : theme.surfaceElevated }]}>
                <View style={[styles.eventIcon, { backgroundColor: softFill(color), borderColor: softRim(color), borderWidth: 1 }]}>
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
          <View style={styles.sectionHeadRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your record</Text>
            <View style={styles.tileRow}>
              <Stamp size={scale(13)} color={IDENTITY} />
              <Text style={[styles.recordCount, { color: IDENTITY }]}>{visits.length} visit{visits.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
            {lastVisit
              ? `Last stamped Week ${lastVisit.week}, Year ${lastVisit.year}.`
              : 'No stamps yet — this would be a first visit.'}
          </Text>
          {!visited && (
            <View style={[styles.firstVisitRow, { backgroundColor: softFill(accent.gold), borderColor: softRim(accent.gold) }]}>
              <Award size={scale(13)} color={accent.gold} />
              <Text style={[styles.firstVisitText, { color: accent.gold }]}>First visit unlocks a local business deal</Text>
            </View>
          )}
        </View>

        {/* Business opportunity from this destination (if unlocked) */}
        {opp && (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Local business</Text>
            <StorefrontBody
              name={opp.name}
              locLabel={`${dest.name} · ${meta.code}`}
              description={opp.description}
              weeklyIncome={opp.weeklyIncome}
              cost={opp.cost}
              invested={!!opp.invested}
              hue={meta.hue}
              theme={theme}
              onInvest={() => handleInvest(opp.id)}
            />
          </View>
        )}

        {/* Book CTA — the one loud action on this screen */}
        <TouchableOpacity
          onPress={() => handleBook(dest)}
          disabled={!quote.ok}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !quote.ok }}
          style={[styles.bookCta, quote.ok && getPlatformShadows(5, 0.3, 2, 8)]}
        >
          <LinearGradient
            colors={quote.ok ? [IDENTITY, IDENTITY_PAIR] : [theme.surfaceElevated, theme.surfaceElevated]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookCtaInner}
          >
            <Plane size={scale(16)} color={quote.ok ? 'white' : theme.textMuted} />
            <Text style={[styles.bookCtaText, { color: quote.ok ? 'white' : theme.textMuted }]}>{ctaLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ---- My Trip: the BOARDING PASS ------------------------------------------
  const renderTripTab = () => {
    if (!currentTrip) {
      return (
        <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, styles.emptyPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
          <View style={[styles.emptyTicket, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={[getGlassIconContainer(darkMode, 64), { backgroundColor: tint(0.15), borderColor: tint(0.3), borderWidth: 1 }]}>
              <Ticket size={scale(28)} color={IDENTITY} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No boarding pass</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Book a destination and your boarding pass appears here.
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab('destinations')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Browse destinations"
              style={[styles.browseBtn, { backgroundColor: tint(0.16) }]}
            >
              <Compass size={scale(14)} color={IDENTITY} />
              <Text style={[styles.browseBtnText, { color: IDENTITY }]}>Browse destinations</Text>
            </TouchableOpacity>
          </View>
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
    const barColor = darkMode ? theme.text : '#0F172A';
    const dashColor = darkMode ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.25)';

    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Recipe B hero rendered AS a boarding pass. Identity teal wash. */}
        <View style={[getGlassCard(darkMode, 12), styles.passCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={styles.passInner}>
            <LinearGradient
              pointerEvents="none"
              colors={[tint(0.14), tint(0.03)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.passBlob} />
            {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}

            {/* Airline header */}
            <View style={styles.passHeadRow}>
              <View style={styles.tileRow}>
                <View style={[getGlassIconContainer(darkMode, 28), styles.edgeGlyph, { backgroundColor: tint(0.15), borderColor: tint(0.3) }]}>
                  <Plane size={scale(14)} color={IDENTITY} />
                </View>
                <Text style={[styles.passBrand, { color: theme.text }]}>DEEPLIFE AIR</Text>
              </View>
              <Text style={[styles.passKind, { color: IDENTITY }]}>BOARDING PASS</Text>
            </View>

            {/* Route */}
            <View style={styles.passRouteRow}>
              <View style={styles.routeEnd}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{HOME_CODE}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]}>Home</Text>
              </View>
              <View style={styles.passRouteMid}>
                <Text style={styles.routeEmoji}>{meta.emoji}</Text>
                <View style={styles.passDashWrap}>
                  <Svg width="100%" height={2} viewBox="0 0 120 2" preserveAspectRatio="none">
                    <Line x1="0" y1="1" x2="120" y2="1" stroke={dashColor} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
                  </Svg>
                </View>
                <Plane size={scale(15)} color={IDENTITY} />
              </View>
              <View style={[styles.routeEnd, { alignItems: 'flex-end' }]}>
                <Text style={[styles.routeCode, { color: theme.text }]}>{meta.code}</Text>
                <Text style={[styles.routeCity, { color: theme.textMuted }]} numberOfLines={1}>{dest.name}</Text>
              </View>
            </View>

            {/* Info grid */}
            <View style={styles.passGrid}>
              <PassCell Icon={Ticket} label="FLIGHT" value={flightNo(dest.id)} theme={theme} />
              <PassCell Icon={DoorGate} label="GATE" value={gateOf(dest.id)} theme={theme} />
              <PassCell Icon={Seat} label="SEAT" value={seatOf(dest.id)} theme={theme} />
            </View>
            <View style={styles.passGrid}>
              <PassCell Icon={Calendar} label="DEPART" value={`Wk ${startWeek}`} theme={theme} />
              <PassCell Icon={Calendar} label="RETURN" value={`Wk ${effectiveReturn}`} theme={theme} />
              <PassCell Icon={DollarSign} label="FARE" value={`$${fare.toLocaleString()}`} theme={theme} />
            </View>

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

            {/* Perforation with punched notches */}
            <View style={styles.perfRow}>
              <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.background }]} pointerEvents="none" />
              <View style={styles.perfLineWrap}>
                <Svg width="100%" height={2} viewBox="0 0 240 2" preserveAspectRatio="none">
                  <Line x1="0" y1="1" x2="240" y2="1" stroke={dashColor} strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
                </Svg>
              </View>
              <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.background }]} pointerEvents="none" />
            </View>

            {/* Stub: passenger + barcode */}
            <View style={styles.stubRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stubLabel, { color: theme.textMuted }]}>PASSENGER</Text>
                <Text style={[styles.stubValue, { color: theme.text }]} numberOfLines={1}>{travelerName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.stubLabel, { color: theme.textMuted }]}>BOOKING</Text>
                <Text style={[styles.stubValue, { color: theme.text }]}>{bookingRef(`${dest.id}:${startWeek}`)}</Text>
              </View>
            </View>
            <View style={styles.barcodeWrap}>
              <Svg width="100%" height={scale(34)} viewBox="0 0 240 34" preserveAspectRatio="none" pointerEvents="none">
                {barcodeBars(`${dest.id}:${startWeek}`, barColor)}
              </Svg>
            </View>

            {/* Return CTA */}
            <TouchableOpacity
              onPress={handleReturn}
              disabled={remaining > 0}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Return home"
              accessibilityState={{ disabled: remaining > 0 }}
              style={[styles.returnBtn, canReturn && getPlatformShadows(5, 0.3, 2, 8)]}
            >
              <LinearGradient
                colors={canReturn ? [IDENTITY, IDENTITY_PAIR] : [theme.surfaceElevated, theme.surfaceElevated]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.returnBtnInner}
              >
                <Text style={[styles.returnBtnText, { color: canReturn ? 'white' : theme.textMuted }]}>
                  {canReturn ? 'Return home' : 'Trip in progress…'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

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
          <View style={styles.empty}>
            <View style={[getGlassIconContainer(darkMode, 64), { backgroundColor: tint(0.15), borderColor: tint(0.3), borderWidth: 1 }]}>
              <Store size={scale(28)} color={IDENTITY} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No storefronts yet</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Visit a new destination to unlock a business deal there.
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab('destinations')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Browse destinations"
              style={[styles.browseBtn, { backgroundColor: tint(0.16) }]}
            >
              <Compass size={scale(14)} color={IDENTITY} />
              <Text style={[styles.browseBtnText, { color: IDENTITY }]}>Browse destinations</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const investedOpps = opps.filter((o) => o.invested);
    const weeklyPassive = investedOpps.reduce((s, o) => s + (o.weeklyIncome || 0), 0);

    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Portfolio summary */}
        <View style={[getGlassCard(darkMode, 6), styles.bizSummary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: softFill(accent.gold), borderColor: softRim(accent.gold), borderWidth: 1 }]}>
            <Award size={scale(22)} color={accent.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bizSummaryLabel, { color: theme.textMuted }]}>WEEKLY PASSIVE INCOME</Text>
            <Text style={[styles.bizSummaryValue, { color: accent.success }]}>+${weeklyPassive.toLocaleString()}/wk</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.bizSummaryValue, { color: theme.text }]}>{investedOpps.length}/{opps.length}</Text>
            <Text style={[styles.bizSummaryLabel, { color: theme.textMuted }]}>OWNED</Text>
          </View>
        </View>

        {opps.map((opp) => {
          const meta = metaFor(opp.destinationId);
          const destName = DESTINATIONS.find((d) => d.id === opp.destinationId)?.name || opp.name;
          return (
            <View key={opp.id} style={[getGlassCard(darkMode, 6), styles.storeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Awning */}
              <View style={[styles.storeAwning, { backgroundColor: vibeTint(meta.hue, darkMode ? 0.18 : 0.14) }]}>
                <Store size={scale(14)} color={meta.hue} />
                <Text style={[styles.storeAwningText, { color: theme.text }]} numberOfLines={1}>{destName}</Text>
                <View style={[styles.storeCode, { backgroundColor: vibeTint(meta.hue, 0.2) }]}>
                  <Text style={[styles.storeCodeText, { color: meta.hue }]}>{meta.code}</Text>
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
                  hue={meta.hue}
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
          <View style={styles.empty}>
            <View style={[getGlassIconContainer(darkMode, 64), { backgroundColor: tint(0.15), borderColor: tint(0.3), borderWidth: 1 }]}>
              <Stamp size={scale(28)} color={IDENTITY} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Empty passport</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Your trips get stamped here.</Text>
            <TouchableOpacity
              onPress={() => setActiveTab('destinations')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Browse destinations"
              style={[styles.browseBtn, { backgroundColor: tint(0.16) }]}
            >
              <Compass size={scale(14)} color={IDENTITY} />
              <Text style={[styles.browseBtnText, { color: IDENTITY }]}>Browse destinations</Text>
            </TouchableOpacity>
          </View>
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
          <View style={styles.boardStatsRow}>
            <BoardStat value={String(history.length)} label="Stamps" theme={theme} color={IDENTITY} />
            <View style={[styles.boardDivider, { backgroundColor: theme.border }]} />
            <BoardStat value={String(visitedCount)} label="Countries" theme={theme} />
            <View style={[styles.boardDivider, { backgroundColor: theme.border }]} />
            <BoardStat value={ownsPassport ? 'Yes' : 'No'} label="Passport" theme={theme} color={ownsPassport ? accent.success : accent.warning} />
          </View>
        </View>

        {/* Frequent-flyer milestones — a bounded one-off progression to aim for.
            Tiers are earned by distinct destinations visited; rewards apply on return. */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.tileRow}>
              <Award size={scale(14)} color={IDENTITY} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Frequent flyer</Text>
            </View>
            <Text style={[styles.sectionCount, { color: theme.textMuted }]}>{visitedCount} visited</Text>
          </View>
          <View style={styles.milestoneRow}>
            {TRAVEL_MILESTONE_TIERS.map((t) => {
              const earned = visitedCount >= t.threshold;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.milestoneChip,
                    {
                      backgroundColor: earned ? softFill(accent.gold) : theme.surfaceElevated,
                      borderColor: earned ? softRim(accent.gold) : theme.border,
                    },
                  ]}
                >
                  {earned ? <Award size={scale(11)} color={accent.gold} /> : <Globe size={scale(11)} color={theme.textMuted} />}
                  <Text style={[styles.milestoneChipLabel, { color: earned ? accent.gold : theme.textSecondary }]} numberOfLines={1}>{t.label}</Text>
                  <Text style={[styles.milestoneChipThreshold, { color: earned ? accent.gold : theme.textMuted }]}>{t.threshold}</Text>
                </View>
              );
            })}
          </View>
          {(() => {
            const next = TRAVEL_MILESTONE_TIERS.find((t) => visitedCount < t.threshold);
            if (!next) {
              return <Text style={[styles.cardHint, { color: accent.gold }]}>Every frequent-flyer tier unlocked. Bon voyage!</Text>;
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
            const rot = (hashStr(`${entry.destinationId}${entry.week}${idx}`) % 11) - 5; // -5°..+5°
            return (
              <TouchableOpacity
                key={`${entry.destinationId}-${entry.week}-${idx}`}
                onPress={() => setDetailId(dest.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${dest.name} stamp, Week ${entry.week} Year ${entry.year}. View details`}
                style={[styles.stamp, { transform: [{ rotate: `${rot}deg` }] }]}
              >
                <View style={[styles.stampInner, { borderColor: vibeTint(meta.hue, 0.55) }]}>
                  <View pointerEvents="none" style={[styles.stampWash, { backgroundColor: vibeTint(meta.hue, darkMode ? 0.12 : 0.08) }]} />
                  <Text style={styles.stampEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.stampCode, { color: meta.hue }]}>{meta.code}</Text>
                  <Text style={[styles.stampName, { color: theme.text }]} numberOfLines={1}>{dest.name}</Text>
                  <View style={[styles.stampDivider, { backgroundColor: vibeTint(meta.hue, 0.4) }]} />
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (detailId ? setDetailId(null) : onBack())}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerBtn}
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{headerTitle}</Text>
        <View style={[styles.cashChip, { backgroundColor: tint(0.14), borderColor: tint(0.3) }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>${money.toLocaleString()}</Text>
        </View>
      </View>

      {detailDest ? (
        renderDetail(detailDest)
      ) : (
        <>
          <View style={[styles.tabBar, { borderColor: theme.border }]}>
            {(['destinations', 'trip', 'business', 'history'] as TabType[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.tabBtn, active && { borderBottomColor: IDENTITY, borderBottomWidth: 2 }]}
                >
                  <Text style={[styles.tabText, { color: active ? IDENTITY : theme.textMuted }]}>
                    {tab === 'destinations' ? 'Destinations' : tab === 'trip' ? 'My Trip' : tab === 'business' ? 'Business' : 'Passport'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

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

function BoardStat({ value, label, theme, color }: { value: string; label: string; theme: ReturnType<typeof getThemeColors>; color?: string }) {
  return (
    <View style={styles.boardStat}>
      <Text style={[styles.boardStatValue, { color: color || theme.text }]}>{value}</Text>
      <Text style={[styles.boardStatLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function PassCell({ Icon, label, value, theme }: { Icon: React.ComponentType<{ size: number; color: string }>; label: string; value: string; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.passCell}>
      <View style={styles.tileRow}>
        <Icon size={scale(11)} color={theme.textMuted} />
        <Text style={[styles.passCellLabel, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.passCellValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// Tiny glyph wrappers so the pass grid can pass a "gate"/"seat" icon component.
const DoorGate = ({ size, color }: { size: number; color: string }) => <MapPin size={size} color={color} />;
const Seat = ({ size, color }: { size: number; color: string }) => <Ticket size={size} color={color} />;

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
        <View style={[styles.storeMetric, { backgroundColor: softFill(accent.success), borderColor: softRim(accent.success) }]}>
          <TrendingUp size={scale(11)} color={accent.success} />
          <Text style={[styles.storeMetricText, { color: accent.success }]}>+${weeklyIncome.toLocaleString()}/wk</Text>
        </View>
        <View style={[styles.storeMetric, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <DollarSign size={scale(11)} color={theme.textSecondary} />
          <Text style={[styles.storeMetricText, { color: theme.textSecondary }]}>Cost ${cost.toLocaleString()}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onInvest}
        disabled={invested}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={invested ? 'Already invested' : `Invest $${cost.toLocaleString()}`}
        accessibilityState={{ disabled: invested }}
        style={[styles.investBtn, { backgroundColor: invested ? softFill(accent.success) : tint(0.16), borderColor: invested ? softRim(accent.success) : tint(0.3) }]}
      >
        {invested ? <CheckCircle size={scale(14)} color={accent.success} /> : <Store size={scale(14)} color={IDENTITY} />}
        <Text style={[styles.investBtnText, { color: invested ? accent.success : IDENTITY }]}>{invested ? 'Invested — earning' : 'Invest'}</Text>
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
  return (
    <View style={[styles.benefitChip, { backgroundColor: `${color}26`, borderColor: `${color}4D` }]}>
      <Icon size={scale(11)} color={color} />
      <Text style={[styles.benefitText, { color }]}>{value}</Text>
    </View>
  );
}

// Deterministic barcode bars for an SVG viewBox of 240×34, stretched to width.
function barcodeBars(seed: string, color: string): React.ReactNode[] {
  const VW = 240;
  let s = hashStr(seed);
  const next = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s;
  };
  const bars: React.ReactNode[] = [];
  let x = 0;
  let i = 0;
  while (x < VW && i < 200) {
    const w = 1 + (next() % 4);
    const draw = next() % 3 !== 0;
    if (draw) bars.push(<Rect key={i} x={x} y={0} width={w} height={34} fill={color} />);
    x += w + 1 + (next() % 2);
    i++;
  }
  return bars;
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
    <Modal visible={!!result} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={[getGlassCard(darkMode, 12), styles.modalCard, { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border }]}>
          <View style={[getGlassIconContainer(darkMode, 48), { backgroundColor: tint(0.15), borderColor: tint(0.3), borderWidth: 1 }]}>
            <Plane size={scale(24)} color={IDENTITY} />
          </View>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Welcome back from {result.destinationName}!
          </Text>
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
                    <View style={[styles.eventIcon, { backgroundColor: `${color}26`, borderColor: `${color}4D`, borderWidth: 1 }]}>
                      <Icon size={scale(14)} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eventHeadline, { color: theme.text }]}>{e.headline}</Text>
                      <Text style={[styles.eventDesc, { color: theme.textSecondary }]}>{e.description}</Text>
                      <View style={styles.eventDeltas}>
                        {e.moneyDelta ? (
                          <Text style={{ color: e.moneyDelta < 0 ? accent.danger : accent.success, fontSize: fs.xs, fontWeight: '700' }}>
                            {e.moneyDelta < 0 ? '−' : '+'}${Math.abs(e.moneyDelta).toLocaleString()}
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
                  style={[styles.eventRow, { backgroundColor: `${accent.gold}1A`, borderColor: `${accent.gold}4D`, borderWidth: 1 }]}
                >
                  <View style={[styles.eventIcon, { backgroundColor: `${accent.gold}26`, borderColor: `${accent.gold}4D`, borderWidth: 1 }]}>
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
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.modalBtn, getPlatformShadows(5, 0.3, 2, 8)]}
          >
            <LinearGradient
              colors={[IDENTITY, IDENTITY_PAIR]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalBtnInner}
            >
              <Text style={styles.modalBtnText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },
  emptyPad: { flexGrow: 1, justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    gap: sp.sm,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: fs.lg, fontWeight: '700' },
  cashChip: { paddingHorizontal: sp.sm, paddingVertical: scale(4), borderRadius: br.full, borderWidth: 1 },
  cashChipText: { fontSize: fs.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center' },
  tabText: { fontSize: fs.sm, fontWeight: '700' },

  // Departures board / passport cover
  boardCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  boardHead: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  boardEyebrow: { fontSize: fs.xs, fontWeight: '700', letterSpacing: 1.2 },
  boardStatsRow: { flexDirection: 'row', alignItems: 'center' },
  boardStat: { flex: 1, alignItems: 'center', gap: 2 },
  boardStatValue: { fontSize: fs.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },
  boardStatLabel: { fontSize: fs.xs, fontWeight: '600' },
  boardDivider: { width: 1, height: scale(28) },
  boardPass: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.lg, borderWidth: 1 },
  boardPassText: { fontSize: fs.xs, fontWeight: '700' },

  // Travel edge
  edgeCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  edgeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  edgeGlyph: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  edgeTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },
  edgeChipsRow: { flexDirection: 'row', gap: sp.sm },
  edgeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.lg, borderWidth: 1 },
  edgeChipLabel: { fontSize: fs.xs, flex: 1 },
  edgeChipValue: { fontSize: fs.xs, fontWeight: '800' },
  edgeSources: { gap: sp.xs },
  edgeRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  edgeLine: { fontSize: fs.xs, flex: 1 },

  // Passport (purchase) card
  passportCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  passportTitle: { fontWeight: '800', fontSize: fs.md },
  passportSub: { fontSize: fs.xs, marginTop: 2 },
  passportBadge: { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },

  // Section headers
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: fs.md, fontWeight: '700', letterSpacing: 0.2 },
  sectionCount: { fontSize: fs.xs },

  // Vibe grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  tile: { flexGrow: 1, flexBasis: '46%', minWidth: scale(150), padding: sp.md, borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  tileWash: { ...StyleSheet.absoluteFillObject },
  tileStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.xs },
  tileEmoji: { fontSize: scale(26) },
  tileCode: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.sm, borderWidth: 1 },
  tileCodeText: { fontSize: fs.xs, fontWeight: '800', letterSpacing: 1 },
  tileName: { fontSize: fs.md, fontWeight: '800' },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  tileCountry: { fontSize: fs.xs },
  tileBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, marginTop: sp.xs, minHeight: scale(16) },
  tileFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: sp.sm },
  tilePrice: { fontSize: fs.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileMeta: { fontSize: fs.xs },
  tileView: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: sp.sm, paddingVertical: scale(6), borderRadius: br.full },
  tileViewText: { fontSize: fs.xs, fontWeight: '800' },
  tinyPill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full },
  tinyPillText: { fontSize: fs.xs, fontWeight: '700' },

  // Detail hero
  heroCard: { borderRadius: br['2xl'], borderWidth: 1 },
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.sm },
  heroHairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  detailBlob: { position: 'absolute', top: -scale(48), right: -scale(36), width: scale(150), height: scale(150), borderRadius: scale(75) },
  detailRouteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeEnd: { minWidth: scale(64) },
  routeCode: { fontSize: fs['3xl'], fontWeight: '800', letterSpacing: 1 },
  routeCity: { fontSize: fs.xs },
  routeMid: { flex: 1, alignItems: 'center', gap: 2 },
  routeEmoji: { fontSize: scale(22) },
  detailName: { fontSize: fs.xl, fontWeight: '800' },
  detailTagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp.xs },
  classChip: { paddingHorizontal: sp.sm, paddingVertical: 2, borderRadius: br.full, borderWidth: 1 },
  classChipText: { fontSize: fs.xs, fontWeight: '800', letterSpacing: 0.6 },
  detailDesc: { fontSize: fs.sm, lineHeight: fs.lg },

  // Generic detail card
  card: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  cardHint: { fontSize: fs.xs },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareLabel: { fontSize: fs.sm },
  fareValue: { fontSize: fs.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  fareDivider: { height: 1, marginVertical: 2 },
  strike: { textDecorationLine: 'line-through' },
  recordCount: { fontSize: fs.sm, fontWeight: '800' },
  firstVisitRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.lg, borderWidth: 1 },
  firstVisitText: { fontSize: fs.xs, fontWeight: '700', flex: 1 },

  // Benefits
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  benefitChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full, borderWidth: 1 },
  benefitText: { fontSize: fs.xs, fontWeight: '700' },

  // Book CTA
  bookCta: { borderRadius: br.full },
  bookCtaInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, minHeight: touchTargets.minimum, borderRadius: br.full, paddingHorizontal: sp.md, overflow: 'hidden' },
  bookCtaText: { fontSize: fs.md, fontWeight: '800' },

  // Boarding pass
  passCard: { borderRadius: br['2xl'], borderWidth: 1 },
  passInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.md },
  passBlob: { position: 'absolute', top: -scale(48), right: -scale(36), width: scale(150), height: scale(150), borderRadius: scale(75), backgroundColor: 'rgba(20, 184, 166, 0.10)' },
  passHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passBrand: { fontSize: fs.sm, fontWeight: '800', letterSpacing: 1 },
  passKind: { fontSize: fs.xs, fontWeight: '800', letterSpacing: 1.2 },
  passRouteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passRouteMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm },
  passDashWrap: { flex: 1 },
  passGrid: { flexDirection: 'row', gap: sp.sm },
  passCell: { flex: 1, gap: 2 },
  passCellLabel: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.5 },
  passCellValue: { fontSize: fs.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
  passProgressRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, paddingRight: sp.xs },
  passProgressText: { flex: 1, gap: 2 },
  passStatLabel: { fontSize: fs.xs },
  passRemainValue: { fontSize: fs.lg, fontWeight: '800' },

  // Perforation
  perfRow: { flexDirection: 'row', alignItems: 'center', height: scale(16), marginHorizontal: -sp.lg },
  perfLineWrap: { flex: 1, paddingHorizontal: sp.xs },
  notch: { position: 'absolute', width: scale(16), height: scale(16), borderRadius: scale(8) },
  notchLeft: { left: -scale(8) },
  notchRight: { right: -scale(8) },

  // Stub
  stubRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  stubLabel: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.5 },
  stubValue: { fontSize: fs.sm, fontWeight: '800', letterSpacing: 0.5 },
  barcodeWrap: { height: scale(34), width: '100%' },

  // Return CTA
  returnBtn: { width: '100%', borderRadius: br.full },
  returnBtnInner: { width: '100%', minHeight: touchTargets.minimum, borderRadius: br.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sp.md, overflow: 'hidden' },
  returnBtnText: { fontSize: fs.md, fontWeight: '800' },

  // Empty ticket
  emptyTicket: { alignItems: 'center', gap: sp.sm, padding: sp.xl, borderRadius: br['2xl'], borderWidth: 1, borderStyle: 'dashed' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  browseBtn: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.md, paddingVertical: sp.sm, borderRadius: br.full, marginTop: sp.xs },
  browseBtnText: { fontSize: fs.sm, fontWeight: '800' },

  // Business summary + storefront
  bizSummary: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  bizSummaryLabel: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.5 },
  bizSummaryValue: { fontSize: fs.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  storeCard: { borderRadius: br.xl, borderWidth: 1, overflow: 'hidden' },
  storeAwning: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.md, paddingVertical: sp.sm },
  storeAwningText: { fontSize: fs.sm, fontWeight: '800', flex: 1 },
  storeCode: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.sm },
  storeCodeText: { fontSize: fs.xs, fontWeight: '800', letterSpacing: 1 },
  storeBodyWrap: { padding: sp.md, gap: sp.xs },
  storeName: { fontSize: fs.md, fontWeight: '800' },
  storeLoc: { fontSize: fs.xs },
  storeDesc: { fontSize: fs.xs, marginTop: 2 },
  storeMetrics: { flexDirection: 'row', gap: sp.xs, marginTop: sp.xs, flexWrap: 'wrap' },
  storeMetric: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: sp.xs, borderRadius: br.lg, borderWidth: 1 },
  storeMetricText: { fontSize: fs.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  investBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, paddingVertical: sp.sm, borderRadius: br.full, borderWidth: 1, marginTop: sp.sm, minHeight: scale(40) },
  investBtnText: { fontSize: fs.sm, fontWeight: '800' },

  // Passport stamps
  coverCard: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  coverHead: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },

  // Frequent-flyer milestone strip
  milestoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  milestoneChip: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.sm, paddingVertical: scale(6), borderRadius: br.full, borderWidth: 1 },
  milestoneChipLabel: { fontSize: fs.xs, fontWeight: '700' },
  milestoneChipThreshold: { fontSize: fs.xs, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stampsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.md, paddingVertical: sp.xs },
  stamp: { flexGrow: 1, flexBasis: '44%', minWidth: scale(140) },
  stampInner: { borderRadius: br.lg, borderWidth: 2, borderStyle: 'dashed', padding: sp.sm, alignItems: 'center', gap: 2, overflow: 'hidden' },
  stampWash: { ...StyleSheet.absoluteFillObject },
  stampEmoji: { fontSize: scale(22) },
  stampCode: { fontSize: fs.lg, fontWeight: '800', letterSpacing: 2 },
  stampName: { fontSize: fs.xs, fontWeight: '700' },
  stampDivider: { width: '60%', height: 1, marginVertical: 2 },
  stampMeta: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },

  // Return modal
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: sp.md },
  modalCard: { width: '100%', maxWidth: 480, padding: sp.lg, borderRadius: br['2xl'], borderWidth: 1, alignItems: 'center', gap: sp.sm },
  modalTitle: { fontSize: fs.xl, fontWeight: '800', textAlign: 'center' },
  modalSub: { fontSize: fs.sm, textAlign: 'center', marginBottom: sp.sm },
  eventRow: { flexDirection: 'row', gap: sp.sm, padding: sp.sm, borderRadius: br.lg, marginBottom: sp.xs },
  eventIcon: { width: scale(30), height: scale(30), borderRadius: scale(15), alignItems: 'center', justifyContent: 'center' },
  eventHeadline: { fontSize: fs.sm, fontWeight: '800' },
  eventDesc: { fontSize: fs.xs, marginTop: 2 },
  eventDeltas: { flexDirection: 'row', gap: sp.sm, marginTop: sp.xs, flexWrap: 'wrap' },
  modalBtn: { marginTop: sp.md, borderRadius: br.full },
  modalBtnInner: { minHeight: touchTargets.minimum, paddingHorizontal: sp.xl, borderRadius: br.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalBtnText: { color: 'white', fontSize: fs.md, fontWeight: '800' },
});
