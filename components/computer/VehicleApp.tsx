/**
 * VehicleApp - desktop vehicle screen. Car-marketplace DNA.
 *
 * A 3-tab loop with a list→detail sub-page, art-led throughout:
 *   - Garage: art hero for the active vehicle (condition ProgressRing + spec
 *     chips), a fleet-summary stat strip, and art-thumbnail fleet cards. Tap a
 *     card (or the hero) to drill into a full VEHICLE DETAIL page.
 *   - Dealership: art-led listing cards with a type filter + price buttons that
 *     open the financing modal.
 *   - Insurance: a summary strip + grouped per-vehicle policy cards.
 *
 * Every action reads as tappable (labelled, tinted, ≥36pt): refuel / repair /
 * sell now show their live cost, set-active is an explicit chip (not an
 * invisible row-tap), and the detail page re-homes every action plus a cross-nav
 * to the Insurance tab.
 *
 * Slate Glass is still binding. (The flat gradient stub this once worked around
 * is gone - `components/ui/Gradient.tsx` renders a real SVG gradient now.)
 * elevation only via getGlass helpers / getPlatformShadows, orange identity accent, one
 * focal gradient per screen, dark/light branching, a11y + nav-safety preserved.
 *
 * Existing systems are untouched: auto-loan financing (purchaseVehicleWithAutoLoan
 * → BankApp `Loan.type === 'auto'`), the weekly fuel/condition decay tick, and the
 * politics transportation perk all keep working - this pass is presentation only.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import {
  Car, ShoppingBag, Shield, Fuel, Wrench, AlertCircle, IdCard,
  ChevronRight, Gauge, Zap, Star,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Vehicle } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ProgressRing from '@/components/ui/ProgressRing';
import BuyVehicleModal from '@/components/vehicles/BuyVehicleModal';
import {
  getDriversLicense,
  getPilotLicense,
  refuelVehicle,
  repairVehicle,
  sellVehicle,
  setActiveVehicle,
  purchaseInsurance,
  cancelInsurance,
  purchaseVehicleWithAutoLoan,
} from '@/contexts/game/actions/VehicleActions';
import { PILOT_LICENSE } from '@/lib/vehicles/aircraft';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import {
  VEHICLE_TEMPLATES,
  INSURANCE_PLANS,
  DRIVERS_LICENSE,
  getVehicleTemplate,
  calculateVehicleSellPrice,
  calculateRepairCost,
  calculateRepairCostAfterInsurance,
  calculateFuelCost,
} from '@/lib/vehicles/vehicles';
import { AutoDownTier, AutoTerm } from '@/lib/vehicles/auto';
import { companyIncomePaidWeekly } from '@/lib/economy/passiveIncome';
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';

import { formatMoney } from '@/utils/moneyFormatting';
import { gameAlert } from '@/utils/gameAlert';
import { EmptyCard as EmptyText } from '@/components/ui/EmptyState';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import ProgressBar from '@/components/ui/ProgressBar';
import Chip from '@/components/ui/Chip';

// Identity accent - `accent.amber`, tinted through the shared `withAlpha`.
// Per the Slate Glass accent budget: solid only on small CTAs/badges;
// everywhere else translucent tints.

interface VehicleAppProps {
  onBack: () => void;
}

type Tab = 'garage' | 'dealership' | 'insurance';
type DealerFilter = 'all' | 'car' | 'sports' | 'luxury' | 'motorcycle';

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'garage',     label: 'Garage',     icon: Car },
  { key: 'dealership', label: 'Dealership', icon: ShoppingBag },
  { key: 'insurance',  label: 'Insurance',  icon: Shield },
];

const DEALER_FILTERS: { id: DealerFilter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'car',        label: 'Cars' },
  { id: 'sports',     label: 'Sports' },
  { id: 'luxury',     label: 'Luxury' },
  { id: 'motorcycle', label: 'Bikes' },
];

function conditionColor(c: number): string {
  return c >= 70 ? accent.success : c >= 40 ? accent.warning : accent.danger;
}
function fuelColorFor(f: number): string {
  return f >= 50 ? accent.success : f >= 20 ? accent.warning : accent.danger;
}

/**
 * The refuel and repair buttons, built in ONE place so the garage hero and
 * the detail page can never quote two different costs for the same tap.
 */
function refuelAction(v: Vehicle, cash: number): { label: string; disabled: boolean } {
  const fuelCost = calculateFuelCost(v);
  return { label: fuelCost > 0 ? `Refuel ${formatMoney(fuelCost)}` : 'Refuel', disabled: fuelCost <= 0 || cash < fuelCost };
}
function repairAction(v: Vehicle, cash: number): { label: string; disabled: boolean } {
  const grossRepair = calculateRepairCost(v);
  const repairCost = calculateRepairCostAfterInsurance(v);
  const label = grossRepair <= 0 ? 'Repair' : repairCost <= 0 ? 'Repair · covered' : `Repair ${formatMoney(repairCost)}`;
  return { label, disabled: grossRepair <= 0 || cash < repairCost };
}

/**
 * Which of the two the garage hero should lead with, if either. Urgency is the
 * chips' OWN tint ladder - a chip that would already read amber or red is the
 * one worth a button - so the hero never disagrees with the chip beside it.
 * Red beats amber; on a tie the lower percentage wins.
 */
function urgentVehicleAction(v: Vehicle): 'refuel' | 'repair' | null {
  const fuel = v.fuelLevel ?? 100;
  const cond = v.condition ?? 100;
  const rank = (tone: string) => (tone === accent.danger ? 2 : tone === accent.warning ? 1 : 0);
  const fuelRank = rank(fuelColorFor(fuel));
  const condRank = rank(conditionColor(cond));
  if (fuelRank === 0 && condRank === 0) return null;
  if (fuelRank !== condRank) return fuelRank > condRank ? 'refuel' : 'repair';
  return fuel <= cond ? 'refuel' : 'repair';
}

function VehicleAppInner({ onBack }: VehicleAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const vehicles: Vehicle[] = gameState.vehicles ?? [];
  const activeVehicleId = gameState.activeVehicleId;
  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId);
  const cash = gameState.stats?.money ?? 0;
  const hasLicense = !!gameState.hasDriversLicense;
  const reputation = gameState.stats?.reputation ?? 0;
  const currentWeek = gameState.weeksLived ?? 0;

  const autoLoans = useMemo(
    () => (gameState.loans ?? []).filter((l) => l.type === 'auto'),
    [gameState.loans]
  );
  const totalAutoDebt = useMemo(
    () => autoLoans.reduce((s, l) => s + l.remaining, 0),
    [autoLoans]
  );
  const totalWeeklyAutoPay = useMemo(
    () => autoLoans.reduce((s, l) => s + (l.weeklyPayment ?? 0), 0),
    [autoLoans]
  );

  // Fleet analytics - surfaced from existing per-vehicle fields the old UI never
  // showed (resale value + weekly running cost).
  const fleetValue = useMemo(
    () => vehicles.reduce((s, v) => s + calculateVehicleSellPrice(v), 0),
    [vehicles]
  );
  const weeklyUpkeep = useMemo(
    () => vehicles.reduce((s, v) => s + (v.weeklyMaintenanceCost ?? 0) + (v.weeklyFuelCost ?? 0), 0),
    [vehicles]
  );
  const insuredCount = useMemo(
    () => vehicles.filter((v) => v.insurance?.active).length,
    [vehicles]
  );
  // Premiums are charged upfront as a 6-month (26-week) term of `monthlyCost * 6`
  // (see purchaseInsurance). The true weekly amortization is therefore
  // (monthlyCost * 6) / 26, NOT monthlyCost / 4 (which assumed a 4-week month and
  // overstated the weekly cost by ~8%).
  const weeklyPremium = useMemo(
    () => vehicles.reduce((s, v) => s + (v.insurance?.active ? ((v.insurance.monthlyCost ?? 0) * 6) / 26 : 0), 0),
    [vehicles]
  );

  const weeklyIncome = useMemo(() => {
    let income = 0;
    // R3-M3: political salaries are ANNUAL; every other ladder is weekly. This
    // read them all as weekly, so an elected player's borrowing capacity was
    // inflated 52x at the DTI gate. One shared helper now encodes the rule.
    income += weeklyCareerSalary(gameState);
    // Company income through the same helper the paycheck uses - the stored
    // `weeklyIncome` is the base before the ceiling and the net-worth soft cap,
    // so summing it inflated borrowing capacity for a large portfolio.
    income += companyIncomePaidWeekly(gameState);
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies]);

  const [activeTab, setActiveTab] = useState<Tab>(vehicles.length > 0 ? 'garage' : 'dealership');
  const [buyTarget, setBuyTarget] = useState<typeof VEHICLE_TEMPLATES[number] | null>(null);
  const [dealerFilter, setDealerFilter] = useState<DealerFilter>('all');
  const [detailVehicleId, setDetailVehicleId] = useState<string | null>(null);

  const detailVehicle = detailVehicleId ? vehicles.find((v) => v.id === detailVehicleId) : undefined;
  const inDetail = !!detailVehicle;

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const loanFor = useCallback(
    (v: Vehicle) =>
      autoLoans.find((l) => l.vehicleId === v.id) ??
      autoLoans.find((l) => !l.vehicleId && l.name.includes(v.name)),
    [autoLoans]
  );

  // --- Garage actions ----------------------------------------------------
  const handleRefuel = (v: Vehicle) => {
    const result = refuelVehicle(gameState, setGameState, v.id, { updateMoney });
    if (!result.success) gameAlert('Refuel', result.message);
    queueSave();
  };
  const handleRepair = (v: Vehicle) => {
    const result = repairVehicle(gameState, setGameState, v.id, { updateMoney });
    if (!result.success) gameAlert('Repair', result.message);
    queueSave();
  };
  const handleSetActive = (v: Vehicle) => {
    setActiveVehicle(gameState, setGameState, v.id);
    queueSave();
  };
  const handleSell = (v: Vehicle) => {
    gameAlert(
      'Sell vehicle?',
      `${v.name} - sells for about ${formatMoney(calculateVehicleSellPrice(v))} based on age + condition.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          style: 'destructive',
          onPress: () => {
            const result = sellVehicle(gameState, setGameState, v.id, { updateMoney, updateStats });
            if (!result.success) gameAlert('Sell', result.message);
            else if (detailVehicleId === v.id) setDetailVehicleId(null);
            queueSave();
          },
        },
      ]
    );
  };
  const handleBuyInsurance = (v: Vehicle, type: 'basic' | 'comprehensive' | 'premium') => {
    const result = purchaseInsurance(gameState, setGameState, v.id, type, { updateMoney });
    if (!result.success) gameAlert('Insurance', result.message);
    queueSave();
  };
  const handleCancelInsurance = (v: Vehicle) => {
    cancelInsurance(gameState, setGameState, v.id);
    queueSave();
  };
  const openInsuranceTab = () => {
    setDetailVehicleId(null);
    setActiveTab('insurance');
  };

  // --- License gate -------------------------------------------------------
  const renderLicensePrompt = () => (
    <View style={[getGlassCard(darkMode, 6), styles.licenseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: withAlpha(accent.warning, 0.15), borderWidth: 1, borderColor: withAlpha(accent.warning, 0.3) }]}>
        <IdCard size={scale(20)} color={accent.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.licenseTitle, { color: theme.text }]}>Get your driver&apos;s license</Text>
        <Text style={[styles.licenseSub, { color: theme.textMuted }]}>
          Costs ${DRIVERS_LICENSE.cost} · Required to own any vehicle.
        </Text>
      </View>
      <TouchableOpacity
        disabled={cash < DRIVERS_LICENSE.cost}
        accessibilityRole="button"
        accessibilityLabel={`Pay ${DRIVERS_LICENSE.cost} dollars for a driver's license`}
        onPress={() => {
          const result = getDriversLicense(gameState, setGameState, { updateMoney });
          if (!result.success) gameAlert('License', result.message);
          queueSave();
        }}
        style={[
          styles.btn,
          { backgroundColor: cash >= DRIVERS_LICENSE.cost ? accent.amber : theme.surfaceElevated },
          cash >= DRIVERS_LICENSE.cost && getPlatformShadows(5, 0.3, 2, 8),
        ]}
      >
        <Text style={[styles.btnText, { color: cash >= DRIVERS_LICENSE.cost ? '#FFFFFF' : theme.textMuted }]}>
          Pay ${DRIVERS_LICENSE.cost}
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Pilot's licence - the gate on both aircraft in the dealership.
   *
   * `getPilotLicense` existed with the full age/cash/atomic-grant treatment and
   * had NO caller anywhere in the app, so `hasPilotLicense` could never become
   * true and the two aircraft were permanently unbuyable - advertised, priced,
   * and unreachable. 2026-07-28 audit reach-1. Note the signature differs from
   * getDriversLicense: no `deps` object.
   */
  const renderPilotLicensePrompt = () => {
    const affordable = cash >= PILOT_LICENSE.cost;
    const oldEnough = (gameState.date?.age ?? 0) >= PILOT_LICENSE.minAge;
    const enabled = affordable && oldEnough;
    return (
      <View style={[getGlassCard(darkMode, 6), styles.licenseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: withAlpha(accent.warning, 0.15), borderWidth: 1, borderColor: withAlpha(accent.warning, 0.3) }]}>
          <IdCard size={scale(20)} color={accent.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.licenseTitle, { color: theme.text }]}>Train for your pilot&apos;s license</Text>
          <Text style={[styles.licenseSub, { color: theme.textMuted }]}>
            {oldEnough
              ? `Costs $${PILOT_LICENSE.cost.toLocaleString()} · Required to own any aircraft.`
              : `Available from age ${PILOT_LICENSE.minAge}.`}
          </Text>
        </View>
        <TouchableOpacity
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityLabel={`Pay ${PILOT_LICENSE.cost} dollars for a pilot's license`}
          onPress={() => {
            const result = getPilotLicense(gameState, setGameState);
            if (!result.success) gameAlert('License', result.message);
            queueSave();
          }}
          style={[
            styles.btn,
            { backgroundColor: enabled ? accent.amber : theme.surfaceElevated },
            enabled && getPlatformShadows(5, 0.3, 2, 8),
          ]}
        >
          <Text style={[styles.btnText, { color: enabled ? '#FFFFFF' : theme.textMuted }]}>
            ${PILOT_LICENSE.cost.toLocaleString()}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // --- Vehicle art (require() image from the template, keyed by id) --------
  const renderArt = (v: Vehicle, height: number, radius: number) => {
    const image = getVehicleTemplate(v.id)?.image;
    return (
      <View style={[styles.artStage, { height: scale(height), backgroundColor: theme.surfaceElevated, borderRadius: radius }]}>
        {image ? (
          <Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Car size={scale(48)} color={theme.textMuted} />
        )}
      </View>
    );
  };

  // --- Garage: active-vehicle art hero (Recipe B, ONE gradient per screen) --
  const renderGarageHero = (v: Vehicle) => {
    const cond = v.condition ?? 100;
    const fuel = v.fuelLevel ?? 100;
    const urgent = urgentVehicleAction(v);
    const refuel = refuelAction(v, cash);
    const repair = repairAction(v, cash);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${v.name}`}
        onPress={() => setDetailVehicleId(v.id)}
        style={[
          getGlassCard(darkMode, 12),
          {
            backgroundColor: theme.surface,
            borderColor: darkMode ? theme.glassBorder : theme.border,
            borderWidth: 1,
            borderRadius: responsiveBorderRadius['2xl'],
          },
        ]}
      >
        <View style={styles.heroInner}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -scale(48),
              right: -scale(36),
              width: scale(150),
              height: scale(150),
              borderRadius: scale(75),
              backgroundColor: withAlpha(accent.amber, 0.1),
            }}
          />
          {darkMode && (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
            />
          )}

          <View style={styles.heroTopRow}>
            <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>CURRENT VEHICLE</Text>
            <Chip label="Active" tint={accent.amber} selected />
          </View>

          {renderArt(v, 138, responsiveBorderRadius.xl)}

          <View style={styles.heroBody}>
            <ProgressRing
              value={cond}
              size={74}
              strokeWidth={7}
              ambient={false}
              accentColor={conditionColor(cond)}
              surfaceColor={theme.surface}
              borderColor={theme.border}
              inkColor={theme.text}
              label={`${v.name} condition`}
            >
              <Wrench size={scale(18)} color={conditionColor(cond)} />
            </ProgressRing>

            <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
              <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={1}>
                {v.name}
              </Text>
              <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={1}>
                {v.brand} · {v.year} · {(v.mileage ?? 0).toLocaleString()} mi
              </Text>
              <View style={styles.chipWrap}>
                <Chip icon={<Fuel size={scale(11)} color={fuelColorFor(fuel)} />} label={`Fuel ${Math.round(fuel)}%`} tint={fuelColorFor(fuel)} />
                <Chip icon={<Gauge size={scale(11)} color={theme.textSecondary} />} label={`${v.maxSpeed} mph`} />
                {v.speedBonus > 0 && <Chip icon={<Zap size={scale(11)} color={accent.amber} />} label={`+${v.speedBonus}% speed`} tint={accent.amber} />}
                {v.insurance?.active ? (
                  <Chip icon={<Shield size={scale(11)} color={accent.success} />} label={`Insured ${v.insurance.coveragePercent}%`} tint={accent.success} />
                ) : (
                  <Chip icon={<Shield size={scale(11)} color={accent.danger} />} label="Uninsured" tint={accent.danger} />
                )}
              </View>
            </View>
          </View>

          {/* When a chip above is already amber or red, the bar yields to the
              action it implies: the SAME costed button the detail page renders,
              so the fix is one tap from the garage instead of two. The card
              itself still opens the details. */}
          {urgent === 'refuel' ? (
            <View style={[styles.actionRow, styles.heroAction]}>
              <ActionChip icon={Fuel} label={refuel.label} fill={withAlpha(accent.amber, 0.14)} color={accent.amber} onPress={() => handleRefuel(v)} a11y={`Refuel ${v.name}`} disabled={refuel.disabled} />
            </View>
          ) : urgent === 'repair' ? (
            <View style={[styles.actionRow, styles.heroAction]}>
              <ActionChip icon={Wrench} label={repair.label} fill={withAlpha(accent.success, 0.14)} color={accent.success} onPress={() => handleRepair(v)} a11y={`Repair ${v.name}`} disabled={repair.disabled} />
            </View>
          ) : (
            <View style={[styles.viewDetails, { borderColor: withAlpha(accent.amber, 0.3), backgroundColor: withAlpha(accent.amber, 0.14) }]}>
              <Text style={[styles.viewDetailsText, { color: accent.amber }]}>View details &amp; manage</Text>
              <ChevronRight size={scale(16)} color={accent.amber} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // --- Garage: fleet card ------------------------------------------------
  // The card answers "what do I own and is it usable"; every ACTION that costs
  // money (refuel / repair / sell) lives on the detail page the card opens, so
  // the same button is never in two places with two costs to keep in step.
  const renderFleetCard = (v: Vehicle) => {
    const cond = v.condition ?? 100;
    const isActive = v.id === activeVehicleId;
    const image = getVehicleTemplate(v.id)?.image;
    return (
      <View
        key={v.id}
        style={[
          getGlassCard(darkMode, 6),
          styles.fleetCard,
          { backgroundColor: theme.surface, borderColor: isActive ? withAlpha(accent.amber, 0.3) : theme.border },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${v.name}`}
          onPress={() => setDetailVehicleId(v.id)}
          style={styles.fleetHeader}
        >
          <View style={[styles.thumbStage, { backgroundColor: theme.surfaceElevated }]}>
            {image ? (
              <Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            ) : (
              <Car size={scale(22)} color={theme.textMuted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.fleetNameRow}>
              <Text style={[styles.fleetName, { color: theme.text }]} numberOfLines={1}>
                {v.name}
              </Text>
              {isActive && <Chip label="Active" tint={accent.amber} selected />}
            </View>
            <Text style={[styles.fleetSub, { color: theme.textMuted }]} numberOfLines={1}>
              {v.type} · {v.year} · {(v.mileage ?? 0).toLocaleString()} mi · {v.fuelEfficiency} mpg
            </Text>
          </View>
          <ChevronRight size={scale(18)} color={theme.textMuted} />
        </TouchableOpacity>

        <ProgressBar
          value={Math.max(0, Math.min(100, cond)) / 100}
          color={conditionColor(cond)}
          label={`${v.name} condition ${Math.round(cond)} percent`}
        />

        {!isActive && (
          <View style={styles.actionRow}>
            <ActionChip
              icon={Star}
              label="Set active"
              fill={withAlpha(accent.amber, 0.14)}
              color={accent.amber}
              onPress={() => handleSetActive(v)}
              a11y={`Set ${v.name} as active`}
            />
          </View>
        )}
      </View>
    );
  };

  const renderGarage = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <EconomyEventBanner context="generic" />

      {!hasLicense && renderLicensePrompt()}

      {activeVehicle && renderGarageHero(activeVehicle)}

      {vehicles.length > 0 && (
        <View style={[getGlassCard(darkMode, 6), styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatStrip
            items={[
              { label: 'In garage', value: vehicles.length },
              { label: 'Fleet value', value: formatMoney(fleetValue) },
              { label: 'Weekly upkeep', value: formatMoney(weeklyUpkeep) },
            ]}
          />
        </View>
      )}

      {totalAutoDebt > 0 && (
        <View style={[getGlassCard(darkMode, 6), styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: withAlpha(accent.warning, 0.15), borderWidth: 1, borderColor: withAlpha(accent.warning, 0.3) }]}>
            <AlertCircle size={scale(18)} color={accent.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Outstanding auto debt</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{formatMoney(totalAutoDebt)}</Text>
            <Text style={[styles.infoSub, { color: theme.textMuted }]}>
              {autoLoans.length} loan{autoLoans.length === 1 ? '' : 's'} · {formatMoney(totalWeeklyAutoPay)}/wk from checking
            </Text>
          </View>
        </View>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle title="Your Vehicles" />
        {vehicles.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            {hasLicense ? 'Garage is empty. Visit the Dealership tab to buy your first vehicle.' : 'Get your license first.'}
          </EmptyText>
        ) : (
          vehicles.map((v) => renderFleetCard(v))
        )}
      </View>
    </View>
  );

  // --- Vehicle detail sub-page --------------------------------------------
  const renderVehicleDetail = (v: Vehicle) => {
    const cond = v.condition ?? 100;
    const fuel = v.fuelLevel ?? 100;
    const isActive = v.id === activeVehicleId;
    const loan = loanFor(v);
    const ins = v.insurance;
    const refuel = refuelAction(v, cash);
    const repair = repairAction(v, cash);
    const sellPrice = calculateVehicleSellPrice(v);
    const insWeeksLeft = ins?.active ? Math.max(0, (ins.expiresWeek ?? 0) - currentWeek) : 0;
    const weeksSinceService = v.lastServiceWeek != null ? Math.max(0, currentWeek - v.lastServiceWeek) : null;

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Recipe B hero - art + condition/fuel rings (ONE gradient per screen) */}
        <View
          style={[
            getGlassCard(darkMode, 12),
            {
              backgroundColor: theme.surface,
              borderColor: darkMode ? theme.glassBorder : theme.border,
              borderWidth: 1,
              borderRadius: responsiveBorderRadius['2xl'],
            },
          ]}
        >
          <View style={styles.heroInner}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: -scale(48), right: -scale(36),
                width: scale(150), height: scale(150), borderRadius: scale(75),
                backgroundColor: withAlpha(accent.amber, 0.1),
              }}
            />
            {darkMode && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
            )}

            <View style={styles.heroTopRow}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>{v.type.toUpperCase()}</Text>
              {isActive && (
                <Chip label="Active" tint={accent.amber} selected />
              )}
            </View>

            {renderArt(v, 150, responsiveBorderRadius.xl)}

            <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={1}>{v.name}</Text>
            <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={1}>
              {v.brand} · {v.model} · {v.year}
            </Text>

            <View style={styles.ringRow}>
              <View style={styles.ringItem}>
                <ProgressRing
                  value={cond} size={78} strokeWidth={7} ambient={false}
                  accentColor={conditionColor(cond)} surfaceColor={theme.surface}
                  borderColor={theme.border} inkColor={theme.text} label={`${v.name} condition`}
                >
                  <Wrench size={scale(18)} color={conditionColor(cond)} />
                </ProgressRing>
                <Text style={[styles.ringLabel, { color: theme.textMuted }]}>Condition</Text>
              </View>
              <View style={styles.ringItem}>
                <ProgressRing
                  value={fuel} size={78} strokeWidth={7} ambient={false}
                  accentColor={fuelColorFor(fuel)} surfaceColor={theme.surface}
                  borderColor={theme.border} inkColor={theme.text} label={`${v.name} fuel`}
                >
                  <Fuel size={scale(18)} color={fuelColorFor(fuel)} />
                </ProgressRing>
                <Text style={[styles.ringLabel, { color: theme.textMuted }]}>Fuel</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Active status / set-active */}
        {isActive ? (
          <View style={[styles.activePill, { backgroundColor: withAlpha(accent.amber, 0.14), borderColor: withAlpha(accent.amber, 0.3) }]}>
            <Star size={scale(14)} color={accent.amber} />
            <Text style={[styles.activePillText, { color: accent.amber }]}>Your active vehicle</Text>
          </View>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Set ${v.name} as active vehicle`}
            onPress={() => handleSetActive(v)}
            style={[styles.wideBtn, { backgroundColor: withAlpha(accent.amber, 0.14), borderColor: withAlpha(accent.amber, 0.3) }]}
          >
            <Star size={scale(15)} color={accent.amber} />
            <Text style={[styles.wideBtnText, { color: accent.amber }]}>Set as active vehicle</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <ActionChip icon={Fuel} label={refuel.label} fill={withAlpha(accent.amber, 0.14)} color={accent.amber} onPress={() => handleRefuel(v)} a11y={`Refuel ${v.name}`} disabled={refuel.disabled} />
          <ActionChip icon={Wrench} label={repair.label} fill={withAlpha(accent.success, 0.14)} color={accent.success} onPress={() => handleRepair(v)} a11y={`Repair ${v.name}`} disabled={repair.disabled} />
          <ActionChip label={`Sell ${formatMoney(sellPrice)}`} fill={withAlpha(accent.danger, 0.12)} color={accent.danger} onPress={() => handleSell(v)} a11y={`Sell ${v.name}`} />
        </View>

        {/* The four specs that change how the vehicle plays; the full record folds. */}
        <StatStrip
          items={[
            { label: 'Condition', value: `${Math.round(cond)}%`, tint: conditionColor(cond) },
            { label: 'Fuel', value: `${Math.round(fuel)}%`, tint: fuelColorFor(fuel) },
            { label: 'Resale value', value: formatMoney(sellPrice) },
            { label: 'Upkeep/wk', value: formatMoney((v.weeklyMaintenanceCost ?? 0) + (v.weeklyFuelCost ?? 0)) },
          ]}
        />

        <View style={[getGlassCard(darkMode, 6), styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <CollapsibleSection id="vehicle-all-specs" title="All specs" compact defaultCollapsed summary={`${v.year} · ${v.maxSpeed} mph`}>
            <View style={styles.detailRows}>
              <DetailRow label="Sticker price" value={formatMoney(v.price)} theme={theme} />
              <DetailRow label="Mileage" value={`${(v.mileage ?? 0).toLocaleString()} mi`} theme={theme} />
              <DetailRow label="Efficiency" value={`${v.fuelEfficiency} mpg`} theme={theme} />
              <DetailRow label="Fuel tank" value={`${v.fuelCapacity} gal`} theme={theme} />
              <DetailRow label="Top speed" value={`${v.maxSpeed} mph`} theme={theme} />
              <DetailRow label="Speed bonus" value={`+${v.speedBonus}%`} theme={theme} />
              <DetailRow label="Reputation" value={`+${v.reputationBonus}`} theme={theme} />
              <DetailRow label="Weekly maint." value={formatMoney(v.weeklyMaintenanceCost ?? 0)} theme={theme} />
              <DetailRow label="Weekly fuel" value={formatMoney(v.weeklyFuelCost ?? 0)} theme={theme} />
              <DetailRow label="Model year" value={`${v.year}`} theme={theme} />
              <DetailRow
                label="Last service"
                value={weeksSinceService == null ? '-' : weeksSinceService === 0 ? 'This week' : `${weeksSinceService} wk ago`}
                theme={theme}
              />
            </View>
          </CollapsibleSection>
        </View>

        {/* Auto loan */}
        {loan && (
          <View style={{ gap: responsiveSpacing.sm }}>
            <SectionTitle title="Auto loan" />
            <View style={[getGlassCard(darkMode, 6), styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <DetailRow label="Original principal" value={formatMoney(loan.principal)} theme={theme} />
              <DetailRow label="Remaining balance" value={formatMoney(loan.remaining)} theme={theme} valueColor={accent.warning} />
              <DetailRow label="APR" value={`${(loan.rateAPR * 100).toFixed(2)}%`} theme={theme} />
              <DetailRow label="Weekly payment" value={formatMoney(loan.weeklyPayment)} theme={theme} />
              <DetailRow label="Weeks remaining" value={`${loan.weeksRemaining}`} theme={theme} />
              <DetailRow label="On-time payments" value={`${loan.onTimePayments ?? 0}`} theme={theme} valueColor={accent.success} />
              {(loan.latePayments ?? 0) > 0 && (
                <DetailRow label="Late payments" value={`${loan.latePayments}`} theme={theme} valueColor={accent.danger} />
              )}
              <DetailRow label="Autopay" value={loan.autoPay ? 'On' : 'Off'} theme={theme} valueColor={loan.autoPay ? accent.success : theme.textMuted} />
              <Text style={[styles.detailNote, { color: theme.textMuted }]}>Managed weekly from your checking account in the Bank app.</Text>
            </View>
          </View>
        )}

        {/* Insurance */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Insurance" />
          <View style={[getGlassCard(darkMode, 6), styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {ins?.active ? (
              <>
                <DetailRow label="Status" value="Active" theme={theme} valueColor={accent.success} />
                <DetailRow label="Plan" value={ins.type} theme={theme} capitalize />
                <DetailRow label="Coverage" value={`${ins.coveragePercent}%`} theme={theme} />
                <DetailRow label="Monthly cost" value={formatMoney(ins.monthlyCost ?? 0)} theme={theme} />
                <DetailRow label="Expires" value={`Week ${ins.expiresWeek} · ${insWeeksLeft} wk left`} theme={theme} />
              </>
            ) : (
              <DetailRow label="Status" value="No active insurance" theme={theme} valueColor={accent.danger} />
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Manage insurance for this vehicle"
              onPress={openInsuranceTab}
              style={[styles.manageChip, { backgroundColor: withAlpha(accent.amber, 0.14), borderColor: withAlpha(accent.amber, 0.3) }]}
            >
              <Shield size={scale(13)} color={accent.amber} />
              <Text style={[styles.manageChipText, { color: accent.amber }]}>Manage insurance</Text>
              <ChevronRight size={scale(14)} color={accent.amber} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // --- Dealership: art-led listing cards ----------------------------------
  const renderDealership = () => {
    const owned = (t: typeof VEHICLE_TEMPLATES[number]) => vehicles.some((v) => v.id === t.id);
    const available = VEHICLE_TEMPLATES.filter((t) => !owned(t));
    const filtered = available.filter((t) => dealerFilter === 'all' || t.type === dealerFilter);
    const lockedByReputation = (t: typeof VEHICLE_TEMPLATES[number]) => (t.requiredReputation ?? 0) > reputation;

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Marketplace summary + type filter */}
        <View style={[getGlassCard(darkMode, 6), styles.dealerHeadCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.dealerHeadTop}>
            <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: withAlpha(accent.amber, 0.15), borderWidth: 1, borderColor: withAlpha(accent.amber, 0.3) }]}>
              <ShoppingBag size={scale(18)} color={accent.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dealerHeadTitle, { color: theme.text }]}>Dealership</Text>
              <Text style={[styles.dealerHeadSub, { color: theme.textMuted }]}>
                {available.length} model{available.length === 1 ? '' : 's'} available · finance or pay cash
              </Text>
            </View>
          </View>
          <View style={styles.filterRow}>
            {DEALER_FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                size="md"
                tint={accent.amber}
                selected={dealerFilter === f.id}
                accessibilityLabel={`Filter: ${f.label}`}
                onPress={() => setDealerFilter(f.id)}
              />
            ))}
          </View>
        </View>

        {!hasLicense && renderLicensePrompt()}
        {hasLicense && !gameState.hasPilotLicense && renderPilotLicensePrompt()}

        {filtered.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            {available.length === 0 ? 'You already own every catalog vehicle.' : 'No vehicles in this category.'}
          </EmptyText>
        ) : (
          filtered.map((t) => {
            const locked = lockedByReputation(t);
            const buyable = hasLicense && !locked;
            return (
              <TouchableOpacity
                key={t.id}
                disabled={!buyable}
                onPress={() => setBuyTarget(t)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${t.name} for ${formatMoney(t.price)}`}
                style={[
                  getGlassCard(darkMode, 6),
                  styles.dealerCard,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: buyable ? 1 : 0.55 },
                ]}
              >
                <View style={[styles.dealerArtStage, { backgroundColor: theme.surfaceElevated }]}>
                  {t.image ? (
                    <Image source={t.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  ) : (
                    <Car size={scale(40)} color={theme.textMuted} />
                  )}
                  <View style={[styles.dealerTypeBadge, { backgroundColor: withAlpha(accent.amber, 0.14), borderColor: withAlpha(accent.amber, 0.3) }]}>
                    <Text style={[styles.dealerTypeText, { color: accent.amber }]}>{t.type}</Text>
                  </View>
                </View>

                <View style={styles.dealerBody}>
                  <Text style={[styles.dealerName, { color: theme.text }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[styles.dealerSub, { color: theme.textMuted }]} numberOfLines={2}>{t.description}</Text>

                  <View style={styles.chipWrap}>
                    <Chip icon={<Star size={scale(11)} color={accent.amber} />} label={`+${t.reputationBonus} rep`} tint={accent.amber} />
                    <Chip icon={<Zap size={scale(11)} color={theme.textSecondary} />} label={`+${t.speedBonus}% speed`} />
                    <Chip icon={<Wrench size={scale(11)} color={theme.textSecondary} />} label={`${formatMoney(t.weeklyMaintenanceCost)}/wk`} />
                  </View>

                  <View style={styles.dealerFootRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dealerPrice, { color: theme.text }]}>{formatMoney(t.price)}</Text>
                      {locked && (
                        <Text style={[styles.dealerLocked, { color: accent.danger }]}>Requires reputation ≥ {t.requiredReputation}</Text>
                      )}
                    </View>
                    <View style={[styles.buyBtn, { backgroundColor: buyable ? withAlpha(accent.amber, 0.14) : theme.surfaceElevated, borderColor: buyable ? withAlpha(accent.amber, 0.3) : theme.border }]}>
                      <ShoppingBag size={scale(13)} color={buyable ? accent.amber : theme.textMuted} />
                      <Text style={[styles.buyBtnText, { color: buyable ? accent.amber : theme.textMuted }]}>
                        {!hasLicense ? 'License needed' : locked ? 'Locked' : 'Buy'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  // --- Insurance: summary strip + grouped policy cards --------------------
  const renderInsurance = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {vehicles.length > 0 && (
        <View style={[getGlassCard(darkMode, 6), styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatStrip
            items={[
              { label: 'Insured', value: `${insuredCount}/${vehicles.length}`, tint: insuredCount > 0 ? accent.success : undefined },
              { label: 'Uninsured', value: vehicles.length - insuredCount, tint: vehicles.length - insuredCount > 0 ? accent.danger : undefined },
              { label: 'Weekly premium', value: formatMoney(weeklyPremium) },
            ]}
          />
        </View>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle title="Insurance Plans" />
        {vehicles.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>Buy a vehicle first.</EmptyText>
        ) : (
          vehicles.map((v) => {
            const ins = v.insurance;
            const insWeeksLeft = ins?.active ? Math.max(0, (ins.expiresWeek ?? 0) - currentWeek) : 0;
            return (
              <View key={v.id} style={[getGlassCard(darkMode, 6), styles.insVehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.headerRow}>
                  <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: withAlpha(accent.amber, 0.15), borderWidth: 1, borderColor: withAlpha(accent.amber, 0.3) }]}>
                    <Car size={scale(16)} color={accent.amber} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.insName, { color: theme.text }]}>{v.name}</Text>
                    {ins?.active ? (
                      <Text style={[styles.insStatus, { color: accent.success }]}>
                        {ins.type} · {ins.coveragePercent}% coverage · {insWeeksLeft} wk left
                      </Text>
                    ) : (
                      <Text style={[styles.insStatus, { color: accent.danger }]}>No active insurance</Text>
                    )}
                  </View>
                  {ins?.active && (
                    <Chip label="Covered" tint={accent.success} selected icon={<Shield size={scale(11)} color={accent.success} />} />
                  )}
                </View>

                <View style={styles.plansRow}>
                  {/* Hide the buy buttons while a policy is active - the action
                      rejects the purchase anyway; offering three Buy buttons next
                      to an active policy just invited error taps. */}
                  {!ins?.active && INSURANCE_PLANS.map((p) => (
                    <TouchableOpacity
                      key={p.type}
                      accessibilityRole="button"
                      accessibilityLabel={`Buy ${p.type} insurance for ${v.name}`}
                      accessibilityState={{ disabled: cash < p.monthlyCost * 6 }}
                      disabled={cash < p.monthlyCost * 6}
                      onPress={() => handleBuyInsurance(v, p.type)}
                      style={[styles.planBtn, { backgroundColor: withAlpha(accent.amber, 0.14), borderColor: withAlpha(accent.amber, 0.3) }, cash < p.monthlyCost * 6 && { opacity: 0.55 }]}
                    >
                      <Text style={[styles.planType, { color: accent.amber }]}>{p.type}</Text>
                      <Text style={[styles.planCoverage, { color: theme.text }]}>{p.coveragePercent}% cover</Text>
                      <Text style={[styles.planPrice, { color: theme.textSecondary }]}>${p.monthlyCost * 6} / 6mo</Text>
                    </TouchableOpacity>
                  ))}
                  {ins?.active && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel insurance for ${v.name}`}
                      onPress={() => handleCancelInsurance(v)}
                      style={[styles.cancelBtn, { backgroundColor: withAlpha(accent.danger, 0.12), borderColor: withAlpha(accent.danger, 0.3) }]}
                    >
                      <Text style={[styles.planType, { color: accent.danger }]}>Cancel policy</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const headerTitle = inDetail && detailVehicle ? detailVehicle.name : 'Vehicles';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <AppHeader
        title={headerTitle}
        onBack={() => (inDetail ? setDetailVehicleId(null) : onBack())}
        backLabel={inDetail ? 'Back to garage' : 'Back'}
        right={<CashChip value={formatMoney(cash)} tint={accent.amber} />}
      />

      {!inDetail && (
        <SegmentedControl
          segments={TABS}
          value={activeTab}
          onChange={setActiveTab}
          activeColor={accent.amber}
          style={styles.tabs}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {inDetail && detailVehicle
          ? renderVehicleDetail(detailVehicle)
          : (
            <>
              {activeTab === 'garage' && renderGarage()}
              {activeTab === 'dealership' && renderDealership()}
              {activeTab === 'insurance' && renderInsurance()}
            </>
          )}
      </ScrollView>

      <BuyVehicleModal
        visible={!!buyTarget}
        template={buyTarget ? { id: buyTarget.id, name: buyTarget.name, price: buyTarget.price, description: buyTarget.description } : null}
        gameState={gameState}
        weeklyIncome={weeklyIncome}
        darkMode={darkMode}
        onClose={() => setBuyTarget(null)}
        onConfirm={(tier: AutoDownTier, term: AutoTerm) => {
          if (buyTarget) {
            const result = purchaseVehicleWithAutoLoan(gameState, setGameState, {
              templateId: buyTarget.id,
              tier,
              term,
              weeklyIncome,
            });
            // Celebrate the win too - buying a car is one of the game's most
            // aspirational purchases and used to complete in total silence.
            gameAlert(result.success ? 'New ride' : 'Purchase', result.message);
            queueSave();
            setActiveTab('garage');
          }
          setBuyTarget(null);
        }}
      />
    </View>
  );
}

// --- Presentational helpers -----------------------------------------------

function DetailRow({
  label,
  value,
  theme,
  valueColor,
  capitalize,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getThemeColors>;
  valueColor?: string;
  capitalize?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailRowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.detailRowValue, { color: valueColor ?? theme.text }, capitalize && { textTransform: 'capitalize' }]}>{value}</Text>
    </View>
  );
}

function ActionChip({
  icon: Icon,
  label,
  fill,
  color,
  onPress,
  a11y,
  disabled,
}: {
  icon?: React.ComponentType<{ size: number; color: string }>;
  label: string;
  fill: string;
  color: string;
  onPress: () => void;
  a11y: string;
  /** Grey out + block taps (unaffordable / nothing to do) - same 0.55 pattern as the dealer buy card. */
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.actionBtn, { backgroundColor: fill }, disabled && { opacity: 0.55 }]}
    >
      {Icon && <Icon size={scale(12)} color={color} />}
      <Text style={[styles.actionBtnText, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function VehicleApp(props: VehicleAppProps) {
  return (
    <ErrorBoundary>
      <VehicleAppInner {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { marginHorizontal: responsiveSpacing.md, marginBottom: responsiveSpacing.sm },
  // Segmented control directly under the top bar - it anchors the screen, so
  // the top bar drops its bottom border.
  licenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  licenseTitle: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  licenseSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  btn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },

  // Fleet + insurance summary strip (Recipe A) - dense stat cells.
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },

  // Auto-debt status card (Recipe A).
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  infoLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  infoValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '600', fontVariant: ['tabular-nums'] },
  infoSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },

  // Hero (Recipe B) - art-led.
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  heroName: { fontSize: responsiveFontSize['2xl'], fontWeight: '700' },
  heroSub: { fontSize: responsiveFontSize.xs },
  artStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  viewDetailsText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  // Same top gap as the bar it replaces, so the hero's height does not jump
  // when a vehicle crosses the fuel or condition line.
  heroAction: { marginTop: responsiveSpacing.xs },

  // Detail rings.
  ringRow: { flexDirection: 'row', justifyContent: 'center', gap: responsiveSpacing.xl, marginTop: responsiveSpacing.sm },
  ringItem: { alignItems: 'center', gap: responsiveSpacing.md },
  ringLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  activePillText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  wideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  wideBtnText: { fontSize: responsiveFontSize.md, fontWeight: '600' },

  // Fleet card.
  fleetCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  fleetHeader: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  thumbStage: {
    width: scale(72),
    height: scale(52),
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fleetNameRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  fleetName: { fontSize: responsiveFontSize.md, fontWeight: '600', flexShrink: 1 },
  fleetSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    minHeight: touchTargets.minimum,
  },
  actionBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },

  // Detail spec grid.

  // Detail info cards (loan / insurance).
  detailCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.xs,
  },
  detailRows: { gap: responsiveSpacing.xs, paddingTop: responsiveSpacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRowLabel: { fontSize: responsiveFontSize.sm },
  detailRowValue: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  detailNote: { fontSize: responsiveFontSize.xs, marginTop: responsiveSpacing.xs, opacity: 0.8 },
  manageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  manageChipText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },

  // Dealership.
  dealerHeadCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.md,
  },
  dealerHeadTop: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  dealerHeadTitle: { fontSize: responsiveFontSize.lg, fontWeight: '600' },
  dealerHeadSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  dealerCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  dealerArtStage: {
    width: '100%',
    height: scale(120),
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dealerTypeBadge: {
    position: 'absolute',
    top: responsiveSpacing.sm,
    left: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  dealerTypeText: { fontSize: responsiveFontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  dealerBody: { gap: responsiveSpacing.xs },
  dealerName: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  dealerSub: { fontSize: responsiveFontSize.xs },
  dealerFootRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm, marginTop: responsiveSpacing.xs },
  dealerPrice: { fontSize: responsiveFontSize.xl, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dealerLocked: { fontSize: responsiveFontSize.xs, fontWeight: '600', marginTop: 2 },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },

  // Insurance.
  insVehicleCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  insName: { fontSize: responsiveFontSize.md, fontWeight: '600' },
  insStatus: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  plansRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  planBtn: {
    flexGrow: 1,
    minWidth: '30%',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
    minHeight: scale(56),
    justifyContent: 'center',
  },
  planType: { fontSize: responsiveFontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  planCoverage: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
  planPrice: { fontSize: responsiveFontSize.xs },
  cancelBtn: {
    flexGrow: 1,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
  },
});
