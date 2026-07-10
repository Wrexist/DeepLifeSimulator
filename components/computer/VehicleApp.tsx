/**
 * VehicleApp — desktop vehicle screen.
 *
 * Remake 8. Replaces the 1,339-LOC version with a 3-tab loop:
 *   - Garage: owned vehicles with condition / fuel gauges + refuel / repair / set-active / sell
 *   - Dealership: browse catalog, buy with cash or auto loan (banking-system loan)
 *   - Insurance: per-vehicle policies (basic / comprehensive / premium)
 *
 * What's new vs the legacy app:
 *   - **Auto-loan financing** via `purchaseVehicleWithAutoLoan` — vehicles now
 *     show up in BankApp as `Loan.type === 'auto'` with credit-score-derived APR,
 *     bill-pay autopay, and politics APR discount support.
 *   - **Net auto-debt display** in the garage hero card.
 *   - **Politics transportation perk awareness** — the legacy weekly tick still
 *     drives fuel/condition decay; the perk values are exposed in the UI but
 *     wiring them into actual savings is left as a small follow-up.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, Car, ShoppingBag, Shield, Fuel, Wrench, AlertCircle, IdCard } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Vehicle } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassCategoryTabsContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import VehicleRow from '@/components/vehicles/VehicleRow';
import BuyVehicleModal from '@/components/vehicles/BuyVehicleModal';
import {
  getDriversLicense,
  refuelVehicle,
  repairVehicle,
  sellVehicle,
  setActiveVehicle,
  purchaseInsurance,
  cancelInsurance,
  purchaseVehicleWithAutoLoan,
} from '@/contexts/game/actions/VehicleActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { VEHICLE_TEMPLATES, INSURANCE_PLANS, DRIVERS_LICENSE } from '@/lib/vehicles/vehicles';
import { AutoDownTier, AutoTerm } from '@/lib/vehicles/auto';

const LinearGradient = LinearGradientFallback;

// Identity accent — orange (#F97316 / rgb 249,115,22). Per the Slate Glass accent
// budget: solid only on small CTAs/badges; everywhere else translucent tints.
const ORANGE_FILL = 'rgba(249, 115, 22, 0.15)'; // Recipe C icon-bubble fill
const ORANGE_RIM = 'rgba(249, 115, 22, 0.30)';  // Recipe C icon-bubble rim / chip rim
const ORANGE_CHIP = 'rgba(249, 115, 22, 0.14)'; // top-bar chip, refuel / plan chips
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

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'garage',     label: 'Garage',     icon: Car },
  { id: 'dealership', label: 'Dealership', icon: ShoppingBag },
  { id: 'insurance',  label: 'Insurance',  icon: Shield },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
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

  const autoLoans = useMemo(
    () => (gameState.loans ?? []).filter((l) => l.type === 'auto'),
    [gameState.loans]
  );
  const totalAutoDebt = useMemo(
    () => autoLoans.reduce((s, l) => s + l.remaining, 0),
    [autoLoans]
  );

  const weeklyIncome = useMemo(() => {
    let income = 0;
    const job = (gameState.careers ?? []).find((c: any) => c?.id === gameState.currentJob && c?.accepted);
    if (job?.levels && job.level != null) {
      const safeLevel = Math.max(0, Math.min(job.level, job.levels.length - 1));
      income += job.levels[safeLevel]?.salary ?? 0;
    }
    for (const co of (gameState.companies ?? []) as any[]) income += co.weeklyIncome ?? 0;
    return income;
  }, [gameState.careers, gameState.currentJob, gameState.companies]);

  const [activeTab, setActiveTab] = useState<Tab>(vehicles.length > 0 ? 'garage' : 'dealership');
  const [buyTarget, setBuyTarget] = useState<typeof VEHICLE_TEMPLATES[number] | null>(null);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

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
      `${v.name} — sells for an amount based on age + condition.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sell',
          style: 'destructive',
          onPress: () => {
            const result = sellVehicle(gameState, setGameState, v.id, { updateMoney, updateStats });
            if (!result.success) Alert.alert('Sell', result.message);
            queueSave();
          },
        },
      ]
    );
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
        onPress={() => {
          const result = getDriversLicense(gameState, setGameState, { updateMoney });
          if (!result.success) Alert.alert('License', result.message);
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

  // --- Render helpers ----------------------------------------------------
  const renderGarage = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      <EconomyEventBanner context="generic" />

      {!hasLicense && renderLicensePrompt()}

      {/* Recipe B hero — the current vehicle's identity card (ONE per screen). */}
      {activeVehicle && (
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
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(249, 115, 22, 0.14)', 'rgba(249, 115, 22, 0.03)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
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
            <View style={styles.heroContent}>
              <View style={[getGlassIconContainer(darkMode, 44), { backgroundColor: ORANGE_FILL, borderWidth: 1, borderColor: ORANGE_RIM }]}>
                <Car size={scale(22)} color={accent.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroEyebrow, { color: theme.textMuted }]}>CURRENT VEHICLE</Text>
                <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={1}>
                  {activeVehicle.name}
                </Text>
                <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={1}>
                  {activeVehicle.type} · {activeVehicle.year} · {(activeVehicle.mileage ?? 0).toLocaleString()} mi
                  {activeVehicle.speedBonus > 0 ? ` · +${activeVehicle.speedBonus}% speed` : ''}
                </Text>
              </View>
            </View>
          </View>
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
              {autoLoans.length} loan{autoLoans.length === 1 ? '' : 's'} · paid weekly from checking
            </Text>
          </View>
        </View>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Your Vehicles</SectionTitle>
        {vehicles.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            {hasLicense ? "Garage is empty. Visit the Dealership tab to buy your first vehicle." : 'Get your license first.'}
          </EmptyText>
        ) : (
          vehicles.map((v) => {
            // Match the auto loan to this vehicle by id (reliable). Fall back to
            // the legacy name-substring match for loans created before vehicleId
            // existed. Guard the fallback so a legacy loan already claimed by its
            // own vehicle-id match isn't double-attributed here.
            const matchingLoan =
              autoLoans.find((l) => l.vehicleId === v.id) ??
              autoLoans.find((l) => !l.vehicleId && l.name.includes(v.name));
            return (
              <View key={v.id} style={{ gap: responsiveSpacing.xs }}>
                <VehicleRow
                  vehicle={v}
                  loanRemaining={matchingLoan?.remaining}
                  isActive={v.id === activeVehicleId}
                  darkMode={darkMode}
                  onPress={() => handleSetActive(v)}
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => handleRefuel(v)} style={[styles.actionBtn, { backgroundColor: ORANGE_CHIP }]}>
                    <Fuel size={scale(12)} color={accent.amber} />
                    <Text style={[styles.actionBtnText, { color: accent.amber }]}>Refuel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRepair(v)} style={[styles.actionBtn, { backgroundColor: GREEN_CHIP }]}>
                    <Wrench size={scale(12)} color={accent.success} />
                    <Text style={[styles.actionBtnText, { color: accent.success }]}>Repair</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSell(v)} style={[styles.actionBtn, { backgroundColor: RED_CHIP }]}>
                    <Text style={[styles.actionBtnText, { color: accent.danger }]}>Sell</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const renderDealership = () => {
    const available = VEHICLE_TEMPLATES.filter((t) => !vehicles.some((v) => v.id === t.id));
    const lockedByReputation = (t: typeof VEHICLE_TEMPLATES[number]) =>
      (t.requiredReputation ?? 0) > reputation;
    return (
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Dealership</SectionTitle>
        {!hasLicense && renderLicensePrompt()}
        {available.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>You already own every catalog vehicle.</EmptyText>
        ) : (
          available.map((t) => {
            const locked = lockedByReputation(t);
            return (
              <TouchableOpacity
                key={t.id}
                disabled={!hasLicense || locked}
                onPress={() => setBuyTarget(t)}
                activeOpacity={0.85}
                style={[
                  getGlassCard(darkMode, 6),
                  styles.dealerRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: hasLicense && !locked ? 1 : 0.45,
                  },
                ]}
              >
                <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: ORANGE_FILL, borderWidth: 1, borderColor: ORANGE_RIM }]}>
                  <Car size={scale(18)} color={accent.amber} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dealerName, { color: theme.text }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[styles.dealerSub, { color: theme.textMuted }]} numberOfLines={2}>
                    {t.description}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.dealerPrice, { color: theme.text }]}>{formatMoney(t.price)}</Text>
                  {locked && (
                    <Text style={[styles.dealerLocked, { color: accent.danger }]}>
                      Rep ≥ {t.requiredReputation}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  const renderInsurance = () => (
    <View style={{ gap: responsiveSpacing.sm }}>
      <SectionTitle theme={theme}>Insurance Plans</SectionTitle>
      {vehicles.length === 0 ? (
        <EmptyText theme={theme} darkMode={darkMode}>Buy a vehicle first.</EmptyText>
      ) : (
        vehicles.map((v) => (
          <View key={v.id} style={[getGlassCard(darkMode, 6), styles.insVehicleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.headerRow}>
              <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: ORANGE_FILL, borderWidth: 1, borderColor: ORANGE_RIM }]}>
                <Car size={scale(16)} color={accent.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.insName, { color: theme.text }]}>{v.name}</Text>
                {v.insurance?.active ? (
                  <Text style={[styles.insStatus, { color: accent.success }]}>
                    {v.insurance.type} · {v.insurance.coveragePercent}% coverage · expires w{v.insurance.expiresWeek}
                  </Text>
                ) : (
                  <Text style={[styles.insStatus, { color: accent.danger }]}>No active insurance</Text>
                )}
              </View>
            </View>

            <View style={styles.plansRow}>
              {/* Hide the buy buttons while a policy is active — the action
                  rejects the purchase anyway; offering three always-blue Buy
                  buttons next to an active policy just invited error taps. */}
              {!v.insurance?.active && INSURANCE_PLANS.map((p) => (
                <TouchableOpacity
                  key={p.type}
                  onPress={() => {
                    const result = purchaseInsurance(gameState, setGameState, v.id, p.type, { updateMoney });
                    if (!result.success) Alert.alert('Insurance', result.message);
                    queueSave();
                  }}
                  style={[styles.planBtn, { backgroundColor: ORANGE_CHIP }]}
                >
                  <Text style={[styles.planType, { color: accent.amber }]}>{p.type}</Text>
                  <Text style={[styles.planPrice, { color: theme.textSecondary }]}>${p.monthlyCost * 6} / 6mo</Text>
                </TouchableOpacity>
              ))}
              {v.insurance?.active && (
                <TouchableOpacity
                  onPress={() => {
                    cancelInsurance(gameState, setGameState, v.id);
                    queueSave();
                  }}
                  style={[styles.planBtn, { backgroundColor: RED_CHIP }]}
                >
                  <Text style={[styles.planType, { color: accent.danger }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Vehicles</Text>
        <View style={[styles.cashChip, { backgroundColor: ORANGE_CHIP, borderColor: ORANGE_RIM }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, getGlassCategoryTabsContainer(darkMode)]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, active && { backgroundColor: ORANGE_TAB }]}
            >
              <Icon size={scale(16)} color={active ? accent.amber : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.amber : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {activeTab === 'garage' && renderGarage()}
        {activeTab === 'dealership' && renderDealership()}
        {activeTab === 'insurance' && renderInsurance()}
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
  },
  btnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  // Auto-debt status card (Recipe A) — demoted from the old "hero" now that the
  // current-vehicle identity card is the garage's focal surface.
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
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  heroEyebrow: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroName: { fontSize: responsiveFontSize['2xl'], fontWeight: '800', marginTop: 2 },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
  },
  actionBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  dealerName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  dealerSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  dealerPrice: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dealerLocked: { fontSize: responsiveFontSize.xs, fontWeight: '700', marginTop: 2 },
  insVehicleCard: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  insName: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  insStatus: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  plansRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  planBtn: {
    flexGrow: 1,
    minWidth: '30%',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  planType: { fontSize: responsiveFontSize.xs, fontWeight: '800', textTransform: 'capitalize' },
  planPrice: { fontSize: responsiveFontSize.xs, marginTop: 2 },
});
