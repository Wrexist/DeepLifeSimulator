/**
 * VehicleApp — desktop vehicle screen. Car-marketplace DNA.
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
 * Slate Glass is still binding: LinearGradientFallback (renders colors[0] flat),
 * elevation only via getGlass helpers / getPlatformShadows, orange identity accent, one
 * focal gradient per screen, dark/light branching, a11y + nav-safety preserved.
 *
 * Existing systems are untouched: auto-loan financing (purchaseVehicleWithAutoLoan
 * → BankApp `Loan.type === 'auto'`), the weekly fuel/condition decay tick, and the
 * politics transportation perk all keep working — this pass is presentation only.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import {
  ArrowLeft, Car, ShoppingBag, Shield, Fuel, Wrench, AlertCircle, IdCard,
  ChevronRight, Gauge, Zap, Star,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Vehicle } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassCategoryTabsContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
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
import { weeklyCareerSalary } from '@/lib/careers/weeklySalary';

// Identity accent — orange (#F97316 / rgb 249,115,22 / accent.amber). Per the
// Slate Glass accent budget: solid only on small CTAs/badges; everywhere else
// translucent tints.
const ORANGE = accent.amber;
const ORANGE_FILL = 'rgba(249, 115, 22, 0.15)'; // Recipe C icon-bubble fill
const ORANGE_RIM = 'rgba(249, 115, 22, 0.30)';  // Recipe C icon-bubble rim / chip rim
const ORANGE_CHIP = 'rgba(249, 115, 22, 0.14)'; // top-bar chip, refuel / plan / buy chips
const ORANGE_TAB = 'rgba(249, 115, 22, 0.16)';  // active tab pill
// Semantic tints — data only, kept translucent (never a saturated fill).
const GREEN_CHIP = 'rgba(16, 185, 129, 0.14)';  // repair (condition)
const RED_CHIP = 'rgba(239, 68, 68, 0.12)';     // sell / cancel (destructive)
const AMBER_FILL = 'rgba(245, 158, 11, 0.15)';  // warning bubble fill
const AMBER_RIM = 'rgba(245, 158, 11, 0.30)';   // warning bubble rim

interface VehicleAppProps {
  onBack: () => void;
}

type Tab = 'garage' | 'dealership' | 'insurance';
type DealerFilter = 'all' | 'car' | 'sports' | 'luxury' | 'motorcycle';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'garage',     label: 'Garage',     icon: Car },
  { id: 'dealership', label: 'Dealership', icon: ShoppingBag },
  { id: 'insurance',  label: 'Insurance',  icon: Shield },
];

const DEALER_FILTERS: { id: DealerFilter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'car',        label: 'Cars' },
  { id: 'sports',     label: 'Sports' },
  { id: 'luxury',     label: 'Luxury' },
  { id: 'motorcycle', label: 'Bikes' },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function conditionColor(c: number): string {
  return c >= 70 ? accent.success : c >= 40 ? accent.warning : accent.danger;
}
function fuelColorFor(f: number): string {
  return f >= 50 ? accent.success : f >= 20 ? accent.warning : accent.danger;
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

  // Fleet analytics — surfaced from existing per-vehicle fields the old UI never
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
    for (const co of (gameState.companies ?? []) as any[]) income += co.weeklyIncome ?? 0;
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
    if (!result.success) Alert.alert('Refuel', result.message);
    queueSave();
  };
  const handleRepair = (v: Vehicle) => {
    const result = repairVehicle(gameState, setGameState, v.id, { updateMoney });
    if (!result.success) Alert.alert('Repair', result.message);
    queueSave();
  };
  const handleSetActive = (v: Vehicle) => {
    setActiveVehicle(gameState, setGameState, v.id);
    queueSave();
  };
  const handleSell = (v: Vehicle) => {
    Alert.alert(
      'Sell vehicle?',
      `${v.name} — sells for about ${formatMoney(calculateVehicleSellPrice(v))} based on age + condition.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          style: 'destructive',
          onPress: () => {
            const result = sellVehicle(gameState, setGameState, v.id, { updateMoney, updateStats });
            if (!result.success) Alert.alert('Sell', result.message);
            else if (detailVehicleId === v.id) setDetailVehicleId(null);
            queueSave();
          },
        },
      ]
    );
  };
  const handleBuyInsurance = (v: Vehicle, type: 'basic' | 'comprehensive' | 'premium') => {
    const result = purchaseInsurance(gameState, setGameState, v.id, type, { updateMoney });
    if (!result.success) Alert.alert('Insurance', result.message);
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
      <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: AMBER_FILL, borderWidth: 1, borderColor: AMBER_RIM }]}>
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
          if (!result.success) Alert.alert('License', result.message);
          queueSave();
        }}
        style={[
          styles.btn,
          { backgroundColor: cash >= DRIVERS_LICENSE.cost ? ORANGE : theme.surfaceElevated },
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
   * Pilot's licence — the gate on both aircraft in the dealership.
   *
   * `getPilotLicense` existed with the full age/cash/atomic-grant treatment and
   * had NO caller anywhere in the app, so `hasPilotLicense` could never become
   * true and the two aircraft were permanently unbuyable — advertised, priced,
   * and unreachable. 2026-07-28 audit reach-1. Note the signature differs from
   * getDriversLicense: no `deps` object.
   */
  const renderPilotLicensePrompt = () => {
    const affordable = cash >= PILOT_LICENSE.cost;
    const oldEnough = (gameState.date?.age ?? 0) >= PILOT_LICENSE.minAge;
    const enabled = affordable && oldEnough;
    return (
      <View style={[getGlassCard(darkMode, 6), styles.licenseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: AMBER_FILL, borderWidth: 1, borderColor: AMBER_RIM }]}>
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
            if (!result.success) Alert.alert('License', result.message);
            queueSave();
          }}
          style={[
            styles.btn,
            { backgroundColor: enabled ? ORANGE : theme.surfaceElevated },
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
              backgroundColor: 'rgba(249, 115, 22, 0.10)',
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
            <View style={[styles.badgeSolid, { backgroundColor: ORANGE }]}>
              <Text style={styles.badgeSolidText}>ACTIVE</Text>
            </View>
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
                <SpecChip icon={Fuel} color={fuelColorFor(fuel)} label={`Fuel ${Math.round(fuel)}%`} theme={theme} />
                <SpecChip icon={Gauge} color={theme.textSecondary} label={`${v.maxSpeed} mph`} theme={theme} />
                {v.speedBonus > 0 && <SpecChip icon={Zap} color={ORANGE} label={`+${v.speedBonus}% speed`} theme={theme} />}
                {v.insurance?.active ? (
                  <SpecChip icon={Shield} color={accent.success} label={`Insured ${v.insurance.coveragePercent}%`} theme={theme} />
                ) : (
                  <SpecChip icon={Shield} color={accent.danger} label="Uninsured" theme={theme} />
                )}
              </View>
            </View>
          </View>

          <View style={[styles.viewDetails, { borderColor: ORANGE_RIM, backgroundColor: ORANGE_CHIP }]}>
            <Text style={[styles.viewDetailsText, { color: ORANGE }]}>View details &amp; manage</Text>
            <ChevronRight size={scale(16)} color={ORANGE} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --- Garage: fleet card (art thumbnail + gauges + actions) ---------------
  const renderFleetCard = (v: Vehicle) => {
    const cond = v.condition ?? 100;
    const fuel = v.fuelLevel ?? 100;
    const isActive = v.id === activeVehicleId;
    const loan = loanFor(v);
    const image = getVehicleTemplate(v.id)?.image;
    const fuelCost = calculateFuelCost(v);
    const grossRepair = calculateRepairCost(v);
    const repairCost = calculateRepairCostAfterInsurance(v);
    const repairLabel =
      grossRepair <= 0
        ? 'Repair'
        : repairCost <= 0
          ? 'Repair · covered'
          : `Repair ${formatMoney(repairCost)}`;
    const sellPrice = calculateVehicleSellPrice(v);
    return (
      <View
        key={v.id}
        style={[
          getGlassCard(darkMode, 6),
          styles.fleetCard,
          { backgroundColor: theme.surface, borderColor: isActive ? ORANGE_RIM : theme.border },
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
              {isActive && (
                <View style={[styles.badgeSolid, { backgroundColor: ORANGE }]}>
                  <Text style={styles.badgeSolidText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.fleetSub, { color: theme.textMuted }]} numberOfLines={1}>
              {v.type} · {v.year} · {(v.mileage ?? 0).toLocaleString()} mi · {v.fuelEfficiency} mpg
            </Text>
          </View>
          <ChevronRight size={scale(18)} color={theme.textMuted} />
        </TouchableOpacity>

        <View style={styles.gaugesRow}>
          <MiniGauge icon={Wrench} color={conditionColor(cond)} label="Condition" value={Math.round(cond)} theme={theme} />
          <MiniGauge icon={Fuel} color={fuelColorFor(fuel)} label="Fuel" value={Math.round(fuel)} theme={theme} />
        </View>

        <View style={styles.footRow}>
          {v.insurance?.active ? (
            <FootChip icon={Shield} color={accent.success} label={`Insured ${v.insurance.coveragePercent}%`} />
          ) : (
            <FootChip icon={Shield} color={accent.danger} label="Uninsured" />
          )}
          {v.speedBonus > 0 && <FootChip icon={Zap} color={ORANGE} label={`+${v.speedBonus}% speed`} />}
          {loan && loan.remaining > 0 && (
            <FootChip icon={AlertCircle} color={accent.warning} label={`Loan ${formatMoney(loan.remaining)}`} />
          )}
        </View>

        <View style={styles.actionRow}>
          {isActive ? (
            <View style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated }]}>
              <Star size={scale(12)} color={ORANGE} />
              <Text style={[styles.actionBtnText, { color: theme.textMuted }]}>Active</Text>
            </View>
          ) : (
            <ActionChip icon={Star} label="Set active" fill={ORANGE_CHIP} color={ORANGE} onPress={() => handleSetActive(v)} a11y={`Set ${v.name} as active`} />
          )}
          <ActionChip icon={Fuel} label={fuelCost > 0 ? `Refuel ${formatMoney(fuelCost)}` : 'Refuel'} fill={ORANGE_CHIP} color={ORANGE} onPress={() => handleRefuel(v)} a11y={`Refuel ${v.name}`} disabled={fuelCost <= 0 || cash < fuelCost} />
        </View>
        <View style={styles.actionRow}>
          <ActionChip icon={Wrench} label={repairLabel} fill={GREEN_CHIP} color={accent.success} onPress={() => handleRepair(v)} a11y={`Repair ${v.name}`} disabled={grossRepair <= 0 || cash < repairCost} />
          <ActionChip label={`Sell ${formatMoney(sellPrice)}`} fill={RED_CHIP} color={accent.danger} onPress={() => handleSell(v)} a11y={`Sell ${v.name}`} />
        </View>
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
          <StatCell label="In garage" value={`${vehicles.length}`} theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatCell label="Fleet value" value={formatMoney(fleetValue)} theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatCell label="Weekly upkeep" value={formatMoney(weeklyUpkeep)} theme={theme} />
        </View>
      )}

      {totalAutoDebt > 0 && (
        <View style={[getGlassCard(darkMode, 6), styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: AMBER_FILL, borderWidth: 1, borderColor: AMBER_RIM }]}>
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
        <SectionTitle theme={theme}>Your Vehicles</SectionTitle>
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
    const fuelCost = calculateFuelCost(v);
    const grossRepair = calculateRepairCost(v);
    const repairCost = calculateRepairCostAfterInsurance(v);
    const repairLabel =
      grossRepair <= 0
        ? 'Repair'
        : repairCost <= 0
          ? 'Repair · covered'
          : `Repair ${formatMoney(repairCost)}`;
    const sellPrice = calculateVehicleSellPrice(v);
    const insWeeksLeft = ins?.active ? Math.max(0, (ins.expiresWeek ?? 0) - currentWeek) : 0;
    const weeksSinceService = v.lastServiceWeek != null ? Math.max(0, currentWeek - v.lastServiceWeek) : null;

    return (
      <View style={{ gap: responsiveSpacing.lg }}>
        {/* Recipe B hero — art + condition/fuel rings (ONE gradient per screen) */}
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
                backgroundColor: 'rgba(249, 115, 22, 0.10)',
              }}
            />
            {darkMode && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
            )}

            <View style={styles.heroTopRow}>
              <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>{v.type.toUpperCase()}</Text>
              {isActive && (
                <View style={[styles.badgeSolid, { backgroundColor: ORANGE }]}>
                  <Text style={styles.badgeSolidText}>ACTIVE</Text>
                </View>
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
          <View style={[styles.activePill, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }]}>
            <Star size={scale(14)} color={ORANGE} />
            <Text style={[styles.activePillText, { color: ORANGE }]}>Your active vehicle</Text>
          </View>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Set ${v.name} as active vehicle`}
            onPress={() => handleSetActive(v)}
            style={[styles.wideBtn, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }]}
          >
            <Star size={scale(15)} color={ORANGE} />
            <Text style={[styles.wideBtnText, { color: ORANGE }]}>Set as active vehicle</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <ActionChip icon={Fuel} label={fuelCost > 0 ? `Refuel ${formatMoney(fuelCost)}` : 'Refuel'} fill={ORANGE_CHIP} color={ORANGE} onPress={() => handleRefuel(v)} a11y={`Refuel ${v.name}`} disabled={fuelCost <= 0 || cash < fuelCost} />
          <ActionChip icon={Wrench} label={repairLabel} fill={GREEN_CHIP} color={accent.success} onPress={() => handleRepair(v)} a11y={`Repair ${v.name}`} disabled={grossRepair <= 0 || cash < repairCost} />
          <ActionChip label={`Sell ${formatMoney(sellPrice)}`} fill={RED_CHIP} color={accent.danger} onPress={() => handleSell(v)} a11y={`Sell ${v.name}`} />
        </View>

        {/* Spec grid — surfaces the full per-vehicle record */}
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Specifications</SectionTitle>
          <View style={styles.specGrid}>
            <SpecTile label="Sticker price" value={formatMoney(v.price)} theme={theme} />
            <SpecTile label="Resale value" value={formatMoney(sellPrice)} theme={theme} />
            <SpecTile label="Mileage" value={`${(v.mileage ?? 0).toLocaleString()} mi`} theme={theme} />
            <SpecTile label="Efficiency" value={`${v.fuelEfficiency} mpg`} theme={theme} />
            <SpecTile label="Fuel tank" value={`${v.fuelCapacity} gal`} theme={theme} />
            <SpecTile label="Top speed" value={`${v.maxSpeed} mph`} theme={theme} />
            <SpecTile label="Speed bonus" value={`+${v.speedBonus}%`} theme={theme} />
            <SpecTile label="Reputation" value={`+${v.reputationBonus}`} theme={theme} />
            <SpecTile label="Weekly maint." value={formatMoney(v.weeklyMaintenanceCost ?? 0)} theme={theme} />
            <SpecTile label="Weekly fuel" value={formatMoney(v.weeklyFuelCost ?? 0)} theme={theme} />
            <SpecTile label="Model year" value={`${v.year}`} theme={theme} />
            <SpecTile
              label="Last service"
              value={weeksSinceService == null ? '—' : weeksSinceService === 0 ? 'This week' : `${weeksSinceService} wk ago`}
              theme={theme}
            />
          </View>
        </View>

        {/* Auto loan */}
        {loan && (
          <View style={{ gap: responsiveSpacing.sm }}>
            <SectionTitle theme={theme}>Auto loan</SectionTitle>
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
          <SectionTitle theme={theme}>Insurance</SectionTitle>
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
              style={[styles.manageChip, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }]}
            >
              <Shield size={scale(13)} color={ORANGE} />
              <Text style={[styles.manageChipText, { color: ORANGE }]}>Manage insurance</Text>
              <ChevronRight size={scale(14)} color={ORANGE} />
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
            <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: ORANGE_FILL, borderWidth: 1, borderColor: ORANGE_RIM }]}>
              <ShoppingBag size={scale(18)} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dealerHeadTitle, { color: theme.text }]}>Dealership</Text>
              <Text style={[styles.dealerHeadSub, { color: theme.textMuted }]}>
                {available.length} model{available.length === 1 ? '' : 's'} available · finance or pay cash
              </Text>
            </View>
          </View>
          <View style={styles.filterRow}>
            {DEALER_FILTERS.map((f) => {
              const on = dealerFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter: ${f.label}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => setDealerFilter(f.id)}
                  style={[
                    styles.filterChip,
                    on
                      ? { backgroundColor: ORANGE_TAB, borderColor: ORANGE_RIM }
                      : { backgroundColor: 'transparent', borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: on ? ORANGE : theme.textMuted }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
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
                  <View style={[styles.dealerTypeBadge, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }]}>
                    <Text style={[styles.dealerTypeText, { color: ORANGE }]}>{t.type}</Text>
                  </View>
                </View>

                <View style={styles.dealerBody}>
                  <Text style={[styles.dealerName, { color: theme.text }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[styles.dealerSub, { color: theme.textMuted }]} numberOfLines={2}>{t.description}</Text>

                  <View style={styles.chipWrap}>
                    <SpecChip icon={Star} color={ORANGE} label={`+${t.reputationBonus} rep`} theme={theme} />
                    <SpecChip icon={Zap} color={theme.textSecondary} label={`+${t.speedBonus}% speed`} theme={theme} />
                    <SpecChip icon={Wrench} color={theme.textSecondary} label={`${formatMoney(t.weeklyMaintenanceCost)}/wk`} theme={theme} />
                  </View>

                  <View style={styles.dealerFootRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dealerPrice, { color: theme.text }]}>{formatMoney(t.price)}</Text>
                      {locked && (
                        <Text style={[styles.dealerLocked, { color: accent.danger }]}>Requires reputation ≥ {t.requiredReputation}</Text>
                      )}
                    </View>
                    <View style={[styles.buyBtn, { backgroundColor: buyable ? ORANGE_CHIP : theme.surfaceElevated, borderColor: buyable ? ORANGE_RIM : theme.border }]}>
                      <ShoppingBag size={scale(13)} color={buyable ? ORANGE : theme.textMuted} />
                      <Text style={[styles.buyBtnText, { color: buyable ? ORANGE : theme.textMuted }]}>
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
          <StatCell label="Insured" value={`${insuredCount}/${vehicles.length}`} theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatCell label="Uninsured" value={`${vehicles.length - insuredCount}`} theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatCell label="Weekly premium" value={formatMoney(weeklyPremium)} theme={theme} />
        </View>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Insurance Plans</SectionTitle>
        {vehicles.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>Buy a vehicle first.</EmptyText>
        ) : (
          vehicles.map((v) => {
            const ins = v.insurance;
            const insWeeksLeft = ins?.active ? Math.max(0, (ins.expiresWeek ?? 0) - currentWeek) : 0;
            return (
              <View key={v.id} style={[getGlassCard(darkMode, 6), styles.insVehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.headerRow}>
                  <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: ORANGE_FILL, borderWidth: 1, borderColor: ORANGE_RIM }]}>
                    <Car size={scale(16)} color={ORANGE} />
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
                    <View style={[styles.insBadge, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                      <Shield size={scale(11)} color={accent.success} />
                      <Text style={[styles.insBadgeText, { color: accent.success }]}>Covered</Text>
                    </View>
                  )}
                </View>

                <View style={styles.plansRow}>
                  {/* Hide the buy buttons while a policy is active — the action
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
                      style={[styles.planBtn, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }, cash < p.monthlyCost * 6 && { opacity: 0.55 }]}
                    >
                      <Text style={[styles.planType, { color: ORANGE }]}>{p.type}</Text>
                      <Text style={[styles.planCoverage, { color: theme.text }]}>{p.coveragePercent}%</Text>
                      <Text style={[styles.planPrice, { color: theme.textSecondary }]}>${p.monthlyCost * 6} / 6mo</Text>
                    </TouchableOpacity>
                  ))}
                  {ins?.active && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel insurance for ${v.name}`}
                      onPress={() => handleCancelInsurance(v)}
                      style={[styles.cancelBtn, { backgroundColor: RED_CHIP, borderColor: 'rgba(239,68,68,0.3)' }]}
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
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (inDetail ? setDetailVehicleId(null) : onBack())}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]} numberOfLines={1}>{headerTitle}</Text>
        <View style={[styles.cashChip, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      {!inDetail && (
        <View style={[styles.tabBar, getGlassCategoryTabsContainer(darkMode)]}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && { backgroundColor: ORANGE_TAB }]}
              >
                <Icon size={scale(16)} color={active ? ORANGE : theme.textMuted} />
                <Text style={[styles.tabText, { color: active ? ORANGE : theme.textMuted }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
            const result = purchaseVehicleWithAutoLoan(setGameState, {
              templateId: buyTarget.id,
              tier,
              term,
              weeklyIncome,
            });
            // Celebrate the win too — buying a car is one of the game's most
            // aspirational purchases and used to complete in total silence.
            Alert.alert(result.success ? '🚗 New Ride!' : 'Purchase', result.message);
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

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function EmptyText({ theme, darkMode, children }: { theme: ReturnType<typeof getThemeColors>; darkMode: boolean; children: React.ReactNode }) {
  // Give empty sections a card so they share the same rhythm as populated rows
  // instead of floating as bare text on the canvas.
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>
    </View>
  );
}

function SpecChip({
  icon: Icon,
  color,
  label,
  theme,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  label: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={[styles.specChip, { backgroundColor: theme.surfaceElevated }]}>
      <Icon size={scale(11)} color={color} />
      <Text style={[styles.specChipText, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function FootChip({
  icon: Icon,
  color,
  label,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  label: string;
}) {
  return (
    <View style={styles.footChip}>
      <Icon size={scale(10)} color={color} />
      <Text style={[styles.footText, { color }]}>{label}</Text>
    </View>
  );
}

function StatCell({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function SpecTile({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={[styles.specTile, { backgroundColor: theme.surfaceElevated }]}>
      <Text style={[styles.specTileValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.specTileLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

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

function MiniGauge({
  icon: Icon,
  color,
  label,
  value,
  theme,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  label: string;
  value: number;
  theme: ReturnType<typeof getThemeColors>;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={styles.gaugeHeader}>
        <Icon size={scale(10)} color={color} />
        <Text style={[styles.gaugeLabel, { color: theme.textMuted }]}>
          {label} <Text style={{ color, fontWeight: '700' }}>{value}%</Text>
        </Text>
      </View>
      <View style={[styles.gaugeTrack, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
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
  /** Grey out + block taps (unaffordable / nothing to do) — same 0.55 pattern as the dealer buy card. */
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.sm,
  },
  backBtn: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // Segmented control directly under the top bar — it anchors the screen, so
  // the top bar drops its bottom border.
  tabBar: {
    flexDirection: 'row',
    gap: scale(4),
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.lg,
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    opacity: 0.6,
  },
  licenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  licenseTitle: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  licenseSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  btn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    minHeight: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // Fleet + insurance summary strip (Recipe A) — dense stat cells.
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600', letterSpacing: 0.2 },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 2 },

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
  infoValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  infoSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },

  // Hero (Recipe B) — art-led.
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
  heroName: { fontSize: responsiveFontSize['2xl'], fontWeight: '800' },
  heroSub: { fontSize: responsiveFontSize.xs },
  artStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeSolid: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  badgeSolidText: { color: '#FFFFFF', fontSize: responsiveFontSize.xs, fontWeight: '800', letterSpacing: 0.4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
  },
  specChipText: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: scale(36),
  },
  viewDetailsText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

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
    minHeight: scale(38),
  },
  activePillText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  wideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: scale(40),
  },
  wideBtnText: { fontSize: responsiveFontSize.md, fontWeight: '700' },

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
  fleetName: { fontSize: responsiveFontSize.md, fontWeight: '700', flexShrink: 1 },
  fleetSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  gaugesRow: { flexDirection: 'row', gap: responsiveSpacing.md },
  gaugeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gaugeLabel: { fontSize: responsiveFontSize.xs },
  gaugeTrack: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  gaugeFill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  footRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  footChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footText: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    minHeight: scale(36),
  },
  actionBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // Detail spec grid.
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  specTile: {
    width: '31%',
    flexGrow: 1,
    minWidth: scale(96),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    gap: 2,
  },
  specTileValue: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  specTileLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },

  // Detail info cards (loan / insurance).
  detailCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.xs,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRowLabel: { fontSize: responsiveFontSize.sm },
  detailRowValue: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
    minHeight: scale(38),
  },
  manageChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // Dealership.
  dealerHeadCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.md,
  },
  dealerHeadTop: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  dealerHeadTitle: { fontSize: responsiveFontSize.lg, fontWeight: '800' },
  dealerHeadSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  filterChip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: scale(34),
    justifyContent: 'center',
  },
  filterChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
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
  dealerTypeText: { fontSize: responsiveFontSize.xs, fontWeight: '800', textTransform: 'capitalize' },
  dealerBody: { gap: responsiveSpacing.xs },
  dealerName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  dealerSub: { fontSize: responsiveFontSize.xs },
  dealerFootRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm, marginTop: responsiveSpacing.xs },
  dealerPrice: { fontSize: responsiveFontSize.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dealerLocked: { fontSize: responsiveFontSize.xs, fontWeight: '700', marginTop: 2 },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    minHeight: scale(38),
  },
  buyBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '800' },

  // Insurance.
  insVehicleCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  insName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  insStatus: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  insBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.full,
  },
  insBadgeText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
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
  planType: { fontSize: responsiveFontSize.xs, fontWeight: '800', textTransform: 'capitalize' },
  planCoverage: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  planPrice: { fontSize: responsiveFontSize.xs },
  cancelBtn: {
    flexGrow: 1,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(40),
  },
});
