/**
 * Travel App — full rewrite (Remake 9).
 *
 * Replaces 1.4kLOC of theme-decoupled decoration with a focused planner driven
 * by the new pure libs:
 *   - lib/travel/transportation.ts → vehicle + politics speed/cost combiner
 *   - lib/travel/events.ts         → random travel events (seeded)
 *   - lib/travel/operations.ts     → quoteTrip / buildTripReturnSummary
 *
 * Surfaces what the old UI hid: which destinations save money under current
 * policy, how vehicles speed up trips, what events fired on return.
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
import {
  ArrowLeft,
  Plane,
  MapPin,
  Heart,
  Zap,
  Battery,
  Brain,
  Globe,
  Clock,
  CheckCircle,
  Briefcase,
  History,
  Sparkles,
  Car,
  Vote,
  Skull,
  Coins,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { DESTINATIONS, TravelDestination } from '@/lib/travel/destinations';
import { transportationMods } from '@/lib/travel/transportation';
import { quoteTrip } from '@/lib/travel/operations';
import { TravelEventDef } from '@/lib/travel/events';
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
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
} from '@/utils/scaling';

type TabType = 'destinations' | 'trip' | 'business' | 'history';

interface TravelAppProps {
  onBack: () => void;
}

export default function TravelApp({ onBack }: TravelAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const [activeTab, setActiveTab] = useState<TabType>('destinations');
  const [returnEvents, setReturnEvents] = useState<TripReturnResult | null>(null);

  const travel = gameState.travel || {
    visitedDestinations: [],
    passportOwned: false,
    businessOpportunities: {},
    travelHistory: [],
  };
  const currentTrip = travel.currentTrip;
  const week = gameState.weeksLived || 0;

  const passportItem = gameState.items?.find((i) => i.id === 'passport');
  const ownsPassport = !!(travel.passportOwned || passportItem?.owned);

  const mods = useMemo(() => transportationMods(gameState), [gameState]);
  const activeVehicle = (gameState.vehicles || []).find((v) => v.id === gameState.activeVehicleId);

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

  const renderTransportationCard = () => {
    const vBonus = mods.breakdown.vehicleSpeedBonusPct;
    const pCost = mods.breakdown.politicsCostReductionPct;
    const pCommute = mods.breakdown.politicsCommuteReductionPct;
    if (vBonus === 0 && pCost === 0 && pCommute === 0) return null;
    return (
      <View style={[styles.modsCard, { backgroundColor: theme.surfaceElevated, borderColor: accent.info }]}>
        <Text style={[styles.modsTitle, { color: theme.text }]}>Your travel edge</Text>
        {vBonus > 0 && activeVehicle ? (
          <View style={styles.modsRow}>
            <Car size={scale(14)} color={accent.success} />
            <Text style={[styles.modsLine, { color: theme.textSecondary }]}>
              {activeVehicle.name || 'Vehicle'}: {vBonus}% faster trips
            </Text>
          </View>
        ) : null}
        {pCost > 0 ? (
          <View style={styles.modsRow}>
            <Vote size={scale(14)} color={accent.purple} />
            <Text style={[styles.modsLine, { color: theme.textSecondary }]}>
              Transport policy: {Math.round(pCost)}% off all fares
            </Text>
          </View>
        ) : null}
        {pCommute > 0 ? (
          <View style={styles.modsRow}>
            <Vote size={scale(14)} color={accent.purple} />
            <Text style={[styles.modsLine, { color: theme.textSecondary }]}>
              Transport policy: {Math.round(pCommute)}% shorter trips
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderDestinations = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      <EconomyEventBanner context="travel" />
      {renderTransportationCard()}
      {!ownsPassport && (
        <TouchableOpacity
          onPress={handlePassport}
          style={[styles.passportCard, { backgroundColor: accent.purple }]}
          activeOpacity={0.85}
        >
          <Globe size={scale(24)} color="white" />
          <View style={{ flex: 1 }}>
            <Text style={styles.passportTitle}>Unlock world travel</Text>
            <Text style={styles.passportSub}>$500 for a passport · international destinations</Text>
          </View>
          <Sparkles size={scale(18)} color="white" />
        </TouchableOpacity>
      )}
      {DESTINATIONS.map((dest) => {
        const quote = quoteTrip(dest.id, gameState, week);
        const visited = travel.visitedDestinations?.includes(dest.id);
        const adjusted = quote.ok ? quote.adjustedCost : null;
        const adjustedDuration = quote.ok ? quote.adjustedDuration : dest.duration;
        const baseCost = dest.cost;
        const hasDiscount = adjusted !== null && adjusted < baseCost;
        const passportRequired = dest.requirements?.items?.includes('passport');

        return (
          <TouchableOpacity
            key={dest.id}
            disabled={!quote.ok}
            onPress={() => handleBook(dest)}
            activeOpacity={0.85}
            style={[
              styles.destCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              !quote.ok && { opacity: 0.55 },
            ]}
          >
            <View style={styles.destHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={[styles.destName, { color: theme.text }]}>{dest.name}</Text>
                  {visited && (
                    <View style={[styles.pill, { backgroundColor: accent.success }]}>
                      <CheckCircle size={scale(10)} color="white" />
                      <Text style={styles.pillText}>Visited</Text>
                    </View>
                  )}
                </View>
                <View style={styles.row}>
                  <MapPin size={scale(11)} color={theme.textSecondary} />
                  <Text style={[styles.destSub, { color: theme.textSecondary }]}>{dest.country}</Text>
                  {passportRequired && !ownsPassport ? (
                    <View style={[styles.pill, { backgroundColor: accent.warning }]}>
                      <Globe size={scale(10)} color="white" />
                      <Text style={styles.pillText}>Passport</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.destPrice, { color: hasDiscount ? accent.success : theme.text }]}>
                  ${(adjusted ?? baseCost).toLocaleString()}
                </Text>
                {hasDiscount && (
                  <Text style={[styles.destPriceStrike, { color: theme.textSecondary }]}>
                    ${baseCost.toLocaleString()}
                  </Text>
                )}
              </View>
            </View>

            <Text style={[styles.destDesc, { color: theme.textSecondary }]} numberOfLines={2}>
              {dest.description}
            </Text>

            <View style={styles.benefitRow}>
              {dest.benefits.happiness > 0 && (
                <BenefitChip Icon={Heart} color={accent.danger} value={`+${dest.benefits.happiness}`} />
              )}
              {dest.benefits.health > 0 && (
                <BenefitChip Icon={Battery} color={accent.success} value={`+${dest.benefits.health}`} />
              )}
              {dest.benefits.energy > 0 && (
                <BenefitChip Icon={Zap} color={accent.warning} value={`+${dest.benefits.energy}`} />
              )}
              {!!dest.benefits.intelligence && dest.benefits.intelligence > 0 && (
                <BenefitChip Icon={Brain} color={accent.purple} value={`+${dest.benefits.intelligence}`} />
              )}
            </View>

            <View style={styles.destFooter}>
              <View style={styles.row}>
                <Clock size={scale(11)} color={theme.textSecondary} />
                <Text style={[styles.destSub, { color: theme.textSecondary }]}>
                  {adjustedDuration} week{adjustedDuration > 1 ? 's' : ''}
                  {quote.ok && quote.adjustedDuration < dest.duration ? ' (sped up)' : ''}
                </Text>
              </View>
              <View style={[styles.bookBtn, { backgroundColor: quote.ok ? accent.info : accent.muted }]}>
                <Text style={styles.bookBtnText}>{currentTrip ? 'Already traveling' : 'Book'}</Text>
                <Plane size={scale(12)} color="white" />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderTripTab = () => {
    if (!currentTrip) {
      return (
        <View style={styles.empty}>
          <Plane size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No active trip</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Pick a destination to start your next adventure.
          </Text>
        </View>
      );
    }
    const dest = DESTINATIONS.find((d) => d.id === currentTrip.destinationId);
    if (!dest) return null;
    const returnWeek = currentTrip.returnWeek || 0;
    const effectiveReturn = returnWeek <= 8 && week > 8 ? week : returnWeek;
    const remaining = Math.max(0, effectiveReturn - week);
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
        <View style={[styles.tripCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.tripIcon, { backgroundColor: accent.info }]}>
            <Plane size={scale(28)} color="white" />
          </View>
          <Text style={[styles.tripDest, { color: theme.text }]}>{dest.name}</Text>
          <Text style={[styles.tripCountry, { color: theme.textSecondary }]}>{dest.country}</Text>

          <View style={[styles.tripStat, { borderColor: theme.border }]}>
            <Text style={[styles.tripStatLabel, { color: theme.textSecondary }]}>Returning in</Text>
            <Text style={[styles.tripStatValue, { color: accent.info }]}>
              {remaining} week{remaining === 1 ? '' : 's'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleReturn}
            disabled={remaining > 0}
            style={[
              styles.returnBtn,
              { backgroundColor: remaining > 0 ? accent.muted : accent.success },
            ]}
            activeOpacity={0.85}
          >
            <Text style={styles.returnBtnText}>
              {remaining > 0 ? 'Trip in progress…' : 'Return home'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderBusiness = () => {
    const opps = Object.values(travel.businessOpportunities || {});
    if (opps.length === 0) {
      return (
        <View style={styles.empty}>
          <Briefcase size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No opportunities yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Visit a new destination to unlock a business deal there.
          </Text>
        </View>
      );
    }
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
        {opps.map((opp) => (
          <View
            key={opp.id}
            style={[styles.bizCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.bizName, { color: theme.text }]}>{opp.name}</Text>
              <Text style={[styles.bizSub, { color: theme.textSecondary }]}>{opp.description}</Text>
              <View style={styles.bizMetricsRow}>
                <Text style={[styles.bizMetric, { color: accent.success }]}>
                  +${opp.weeklyIncome.toLocaleString()}/wk
                </Text>
                <Text style={[styles.bizMetric, { color: theme.textSecondary }]}>
                  Cost ${opp.cost.toLocaleString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleInvest(opp.id)}
              disabled={!!opp.invested}
              style={[
                styles.investBtn,
                { backgroundColor: opp.invested ? accent.success : accent.info },
              ]}
            >
              <Text style={styles.investBtnText}>{opp.invested ? 'Invested' : 'Invest'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderHistory = () => {
    const history = travel.travelHistory || [];
    if (history.length === 0) {
      return (
        <View style={styles.empty}>
          <History size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No trips yet</Text>
        </View>
      );
    }
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
        {[...history].reverse().map((entry, idx) => {
          const dest = DESTINATIONS.find((d) => d.id === entry.destinationId);
          if (!dest) return null;
          return (
            <View
              key={`${entry.destinationId}-${entry.week}-${idx}`}
              style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <MapPin size={scale(14)} color={accent.info} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyDest, { color: theme.text }]}>{dest.name}</Text>
                <Text style={[styles.historyMeta, { color: theme.textSecondary }]}>
                  {dest.country} · Week {entry.week} · Year {entry.year}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={scale(18)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Travel</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {(['destinations', 'trip', 'business', 'history'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && { borderBottomColor: accent.info, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? accent.info : theme.textSecondary },
              ]}
            >
              {tab === 'destinations' ? 'Destinations' : tab === 'trip' ? 'My Trip' : tab === 'business' ? 'Business' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'destinations' && renderDestinations()}
      {activeTab === 'trip' && renderTripTab()}
      {activeTab === 'business' && renderBusiness()}
      {activeTab === 'history' && renderHistory()}

      <TripReturnModal
        result={returnEvents}
        onClose={() => setReturnEvents(null)}
        theme={theme}
      />
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
    <View style={[styles.benefitChip, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Icon size={scale(11)} color={color} />
      <Text style={[styles.benefitText, { color }]}>{value}</Text>
    </View>
  );
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
}: {
  result: TripReturnResult | null;
  onClose: () => void;
  theme: ReturnType<typeof getThemeColors>;
}) {
  if (!result) return null;
  const events = result.events || [];
  return (
    <Modal visible={!!result} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Plane size={scale(28)} color={accent.info} />
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
                    style={[styles.eventRow, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
                  >
                    <View style={[styles.eventIcon, { backgroundColor: color }]}>
                      <Icon size={scale(14)} color="white" />
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
          <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: accent.info }]}>
            <Text style={styles.modalBtnText}>Done</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs.xl, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center' },
  tabText: { fontSize: fs.sm, fontWeight: '700' },
  modsCard: {
    padding: sp.md,
    borderRadius: br.lg,
    borderWidth: 1,
    gap: sp.xs,
  },
  modsTitle: { fontSize: fs.sm, fontWeight: '800', marginBottom: sp.xs },
  modsRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  modsLine: { fontSize: fs.xs },
  passportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    padding: sp.md,
    borderRadius: br.lg,
  },
  passportTitle: { color: 'white', fontWeight: '800', fontSize: fs.md },
  passportSub: { color: 'rgba(255,255,255,0.85)', fontSize: fs.xs, marginTop: 2 },
  destCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.sm },
  destHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: sp.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  destName: { fontSize: fs.lg, fontWeight: '800' },
  destSub: { fontSize: fs.xs },
  destPrice: { fontSize: fs.lg, fontWeight: '800' },
  destPriceStrike: { fontSize: fs.xs, textDecorationLine: 'line-through' },
  destDesc: { fontSize: fs.xs },
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: sp.xs,
    paddingVertical: 2,
    borderRadius: br.full,
    borderWidth: 1,
  },
  benefitText: { fontSize: fs.xs, fontWeight: '700' },
  destFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, paddingHorizontal: sp.md, paddingVertical: sp.xs, borderRadius: br.md },
  bookBtnText: { color: 'white', fontSize: fs.sm, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full },
  pillText: { color: 'white', fontSize: fs.xs, fontWeight: '700' },
  tripCard: { alignItems: 'center', padding: sp.lg, borderRadius: br.lg, borderWidth: 1, gap: sp.sm },
  tripIcon: { width: scale(64), height: scale(64), borderRadius: scale(32), alignItems: 'center', justifyContent: 'center' },
  tripDest: { fontSize: fs['2xl'], fontWeight: '800' },
  tripCountry: { fontSize: fs.sm },
  tripStat: { width: '100%', alignItems: 'center', padding: sp.md, borderRadius: br.md, borderWidth: 1, marginVertical: sp.sm },
  tripStatLabel: { fontSize: fs.sm },
  tripStatValue: { fontSize: fs['3xl'], fontWeight: '800', marginTop: sp.xs },
  returnBtn: { width: '100%', padding: sp.md, borderRadius: br.md, alignItems: 'center' },
  returnBtnText: { color: 'white', fontSize: fs.md, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  bizCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  bizName: { fontSize: fs.md, fontWeight: '800' },
  bizSub: { fontSize: fs.xs },
  bizMetricsRow: { flexDirection: 'row', gap: sp.md, marginTop: sp.xs },
  bizMetric: { fontSize: fs.xs, fontWeight: '700' },
  investBtn: { paddingHorizontal: sp.md, paddingVertical: sp.sm, borderRadius: br.md },
  investBtnText: { color: 'white', fontSize: fs.sm, fontWeight: '700' },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  historyDest: { fontSize: fs.sm, fontWeight: '700' },
  historyMeta: { fontSize: fs.xs },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: sp.md },
  modalCard: { width: '100%', maxWidth: 480, padding: sp.lg, borderRadius: br.lg, borderWidth: 1, alignItems: 'center', gap: sp.sm },
  modalTitle: { fontSize: fs.xl, fontWeight: '800', textAlign: 'center' },
  modalSub: { fontSize: fs.sm, textAlign: 'center', marginBottom: sp.sm },
  eventRow: { flexDirection: 'row', gap: sp.sm, padding: sp.sm, borderRadius: br.md, borderWidth: 1, marginBottom: sp.xs },
  eventIcon: { width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  eventHeadline: { fontSize: fs.sm, fontWeight: '800' },
  eventDesc: { fontSize: fs.xs, marginTop: 2 },
  eventDeltas: { flexDirection: 'row', gap: sp.sm, marginTop: sp.xs, flexWrap: 'wrap' },
  modalBtn: { marginTop: sp.md, paddingHorizontal: sp.lg, paddingVertical: sp.sm, borderRadius: br.md },
  modalBtnText: { color: 'white', fontSize: fs.md, fontWeight: '700' },
});
