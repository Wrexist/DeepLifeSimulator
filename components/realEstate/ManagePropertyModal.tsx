import React, { useState, useEffect } from 'react';
import { askRentOverage } from '@/lib/realEstate/askRentGuidance';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { X, Wrench, Users, DoorOpen, Trash2, Building2, Sparkles, Plus, ArrowUpCircle } from 'lucide-react-native';
import { RealEstate } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';
import { maintenanceCost } from '@/lib/realEstate/operations';
import { DECOR_ITEMS, ROOM_ADDITIONS, getUpgradeTier } from '@/lib/realEstate/housing';
import { RENT_MODE_PARAMS, RentMode } from '@/lib/realEstate/tenancy';

import { formatMoney } from '@/utils/moneyFormatting';

interface Props {
  visible: boolean;
  property: RealEstate | null;
  mortgageRemaining?: number;
  availableCash: number;
  /** True if commercial-mode is allowed (e.g. the new system enables it). */
  allowCommercial?: boolean;
  darkMode: boolean;
  onClose: () => void;
  onSetRentMode: (mode: RentMode, weeklyRent: number) => void;
  onStopRenting: () => void;
  onEvict: () => void;
  onMaintain: () => void;
  onSell: () => void;
  onToggleLaunderingFront?: () => void;
  /** Improve flow (Wave A): install decor / add room / bump upgrade tier. */
  onInstallDecor?: (decorId: string) => void;
  onAddRoom?: (roomId: string) => void;
  onUpgrade?: () => void;
}

const MODE_LABEL: Record<RentMode, string> = {
  longTerm: 'Long-term',
  airbnb: 'Airbnb',
  commercial: 'Commercial',
};

export default function ManagePropertyModal({
  visible,
  property,
  mortgageRemaining,
  availableCash,
  allowCommercial = true,
  darkMode,
  onClose,
  onSetRentMode,
  onStopRenting,
  onEvict,
  onMaintain,
  onSell,
  onToggleLaunderingFront,
  onInstallDecor,
  onAddRoom,
  onUpgrade,
}: Props) {
  const theme = getThemeColors(darkMode);
  const [chosenMode, setChosenMode] = useState<RentMode>('longTerm');
  const [rentText, setRentText] = useState('');

  useEffect(() => {
    if (visible && property) {
      setChosenMode(property.rentMode ?? 'longTerm');
      const value = property.currentValue ?? property.price;
      const suggested = Math.round(value * RENT_MODE_PARAMS[property.rentMode ?? 'longTerm'].weeklyYieldMean);
      setRentText(String(property.rent ?? suggested));
    }
  }, [visible, property]);

  if (!property) return null;

  const rent = parseFloat(rentText) || 0;
  const value = property.currentValue ?? property.price;
  const equity = Math.max(0, value - (mortgageRemaining ?? 0));
  const maintCost = maintenanceCost(property);

  // Improve flow (Wave A): what's still available to install/add/upgrade.
  const showImprove = !!(onInstallDecor || onAddRoom || onUpgrade);
  const installedDecor = property.interior ?? [];
  const installedRooms = property.rooms ?? [];
  const availableDecor = DECOR_ITEMS.filter((d) => !installedDecor.includes(d.id));
  const availableRooms = ROOM_ADDITIONS.filter((r) => !installedRooms.includes(r.id));
  const nextTier = getUpgradeTier((property.upgradeLevel ?? 0) + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{property.name}</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Value {formatMoney(value)} · Equity {formatMoney(equity)} · Cond. {Math.round(property.condition ?? 90)}%
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={hitSlopToMinTarget(scale(20))} style={minTouchTargetStyle} accessibilityRole="button" accessibilityLabel="Close">
              <X size={scale(20)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: responsiveSpacing.md }}>
            <View style={[styles.section, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Users size={scale(14)} color={theme.text} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Rental mode</Text>
              </View>

              <View style={styles.chipRow}>
                {(['longTerm', 'airbnb', ...(allowCommercial ? ['commercial' as RentMode] : [])] as RentMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setChosenMode(m)}
                    style={[
                      styles.chip,
                      {
                        borderColor: chosenMode === m ? accent.info : theme.border,
                        backgroundColor: chosenMode === m ? accent.info : theme.surfaceElevated,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: chosenMode === m ? 'white' : theme.text }]}>
                      {MODE_LABEL[m]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.inputRow, { borderColor: theme.border }]}>
                <Text style={[styles.inputPrefix, { color: theme.textSecondary }]}>$</Text>
                <TextInput
                  value={rentText}
                  onChangeText={setRentText}
                  keyboardType="decimal-pad"
                  placeholder="Weekly rent"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
                <Text style={[styles.inputSuffix, { color: theme.textMuted }]}>/wk</Text>
              </View>

              {/* An over-ask is accepted and then clamped by `effectiveAskRent`
                  at payout. Stating the collectable amount only when the ask
                  exceeds the cap keeps this out of the way on a normal ask -
                  a warning shown every time is noise. */}
              {(() => {
                const over = askRentOverage(rent, value);
                if (!over) return null;
                return (
                  <Text style={[styles.capNote, { color: accent.warning }]}>
                    Tenants top out at ${Math.round(over.collected).toLocaleString()}/wk for this property - asking more collects the same.
                  </Text>
                );
              })()}

              <View style={styles.btnRow}>
                <TouchableOpacity
                  disabled={rent <= 0}
                  onPress={() => onSetRentMode(chosenMode, rent)}
                  style={[styles.btn, { backgroundColor: rent > 0 ? accent.info : theme.border }]}
                >
                  <Text style={styles.btnText}>Rent out</Text>
                </TouchableOpacity>
                {property.status === 'rented' && (
                  <TouchableOpacity
                    onPress={onStopRenting}
                    style={[styles.btn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                  >
                    <Text style={[styles.btnText, { color: theme.textSecondary }]}>Stop renting</Text>
                  </TouchableOpacity>
                )}
              </View>

              {property.tenant && (
                <View style={styles.tenantRow}>
                  <Text style={[styles.tenantText, { color: theme.textSecondary }]}>
                    Current tenant: <Text style={{ color: theme.text, fontWeight: '700' }}>{property.tenant.name}</Text> (
                    sat {Math.round(property.tenant.satisfaction)}%)
                  </Text>
                  <TouchableOpacity
                    onPress={onEvict}
                    style={minTouchTargetStyle}
                    hitSlop={hitSlopToMinTarget(scale(14))}
                    accessibilityRole="button"
                    accessibilityLabel="Evict the tenant"
                  >
                    <Trash2 size={scale(14)} color={accent.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Wrench size={scale(14)} color={theme.text} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Maintenance</Text>
              </View>
              <Text style={[styles.helpText, { color: theme.textMuted }]}>
                Restore condition to 100%. Cost scales with property value and how much damage there is.
              </Text>
              <TouchableOpacity
                disabled={maintCost === 0 || availableCash < maintCost}
                onPress={onMaintain}
                style={[
                  styles.btn,
                  {
                    backgroundColor:
                      maintCost > 0 && availableCash >= maintCost ? accent.success : theme.border,
                  },
                ]}
              >
                <Text style={styles.btnText}>
                  {maintCost === 0 ? 'Property in mint condition' : `Pay ${formatMoney(maintCost)} to fix up`}
                </Text>
              </TouchableOpacity>
            </View>

            {showImprove && (
              <View style={[styles.section, { backgroundColor: theme.surfaceElevated, borderColor: accent.success }]}>
                <View style={styles.sectionHeader}>
                  <Sparkles size={scale(14)} color={accent.success} />
                  <Text style={[styles.sectionTitle, { color: accent.success }]}>Improve</Text>
                </View>
                <Text style={[styles.helpText, { color: theme.textMuted }]}>
                  Upgrades lift value + rent; furnishings and rooms add comfort when this is your home.
                </Text>

                {/* Upgrade tier */}
                {onUpgrade && (
                  <TouchableOpacity
                    disabled={!nextTier || availableCash < (nextTier?.cost ?? Infinity)}
                    onPress={onUpgrade}
                    style={[
                      styles.improveRow,
                      { borderColor: theme.border, opacity: nextTier && availableCash >= nextTier.cost ? 1 : 0.5 },
                    ]}
                  >
                    <ArrowUpCircle size={scale(15)} color={accent.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.improveName, { color: theme.text }]}>
                        {nextTier ? `Upgrade to tier ${nextTier.level}` : `Max upgrade tier (${property.upgradeLevel ?? 0})`}
                      </Text>
                      {nextTier && (
                        <Text style={[styles.improveMeta, { color: theme.textMuted }]}>
                          +${nextTier.rentBonus}/wk rent when rented
                        </Text>
                      )}
                    </View>
                    {nextTier && <Text style={[styles.improveCost, { color: accent.success }]}>{formatMoney(nextTier.cost)}</Text>}
                  </TouchableOpacity>
                )}

                {/* Room additions */}
                {onAddRoom && availableRooms.length > 0 && (
                  <>
                    <Text style={[styles.improveGroup, { color: theme.textSecondary }]}>Add a room</Text>
                    {availableRooms.map((r) => {
                      const affordable = availableCash >= r.cost;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          disabled={!affordable}
                          onPress={() => onAddRoom(r.id)}
                          style={[styles.improveRow, { borderColor: theme.border, opacity: affordable ? 1 : 0.5 }]}
                        >
                          <Plus size={scale(15)} color={accent.info} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.improveName, { color: theme.text }]}>{r.name}</Text>
                            <Text style={[styles.improveMeta, { color: theme.textMuted }]}>+{r.happinessBonus} comfort/wk</Text>
                          </View>
                          <Text style={[styles.improveCost, { color: theme.textSecondary }]}>{formatMoney(r.cost)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* Decoration items */}
                {onInstallDecor && availableDecor.length > 0 && (
                  <>
                    <Text style={[styles.improveGroup, { color: theme.textSecondary }]}>Furnish</Text>
                    {availableDecor.map((d) => {
                      const affordable = availableCash >= d.cost;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          disabled={!affordable}
                          onPress={() => onInstallDecor(d.id)}
                          style={[styles.improveRow, { borderColor: theme.border, opacity: affordable ? 1 : 0.5 }]}
                        >
                          <Sparkles size={scale(15)} color={theme.textMuted} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.improveName, { color: theme.text }]}>{d.name}</Text>
                            <Text style={[styles.improveMeta, { color: theme.textMuted }]}>+{d.happiness} comfort/wk · {d.room}</Text>
                          </View>
                          <Text style={[styles.improveCost, { color: theme.textSecondary }]}>{formatMoney(d.cost)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {availableDecor.length === 0 && availableRooms.length === 0 && !nextTier && (
                  <Text style={[styles.helpText, { color: theme.textMuted }]}>
                    Fully improved - every upgrade, room, and furnishing is installed.
                  </Text>
                )}
              </View>
            )}

            {property.rentMode === 'commercial' && onToggleLaunderingFront && (
              <View style={[styles.section, { backgroundColor: theme.surfaceElevated, borderColor: accent.purple }]}>
                <View style={styles.sectionHeader}>
                  <Building2 size={scale(14)} color={accent.purple} />
                  <Text style={[styles.sectionTitle, { color: accent.purple }]}>Laundering front</Text>
                </View>
                <Text style={[styles.helpText, { color: theme.textMuted }]}>
                  Use this commercial property to launder dark-web BTC. Each active front cuts mixer fees and shortens delays.
                </Text>
                <TouchableOpacity
                  onPress={onToggleLaunderingFront}
                  style={[styles.btn, { backgroundColor: property.launderingFront ? accent.danger : accent.purple }]}
                >
                  <Text style={styles.btnText}>
                    {property.launderingFront ? 'Disable front' : 'Enable as front'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.section, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <DoorOpen size={scale(14)} color={accent.danger} />
                <Text style={[styles.sectionTitle, { color: accent.danger }]}>Sell</Text>
              </View>
              <Text style={[styles.helpText, { color: theme.textMuted }]}>
                Sell at market value. Any outstanding mortgage is paid off from the proceeds.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Sell property?',
                    `${property.name} for ${formatMoney(value)}. Mortgage payoff ${formatMoney(mortgageRemaining ?? 0)}. Net to you: ${formatMoney(equity)}.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sell', style: 'destructive', onPress: onSell },
                    ]
                  );
                }}
                style={[styles.btn, { backgroundColor: accent.danger }]}
              >
                <Text style={styles.btnText}>Sell for {formatMoney(value)}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.lg,
    gap: responsiveSpacing.md,
    maxHeight: '90%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  title: { fontSize: responsiveFontSize.lg, fontWeight: '700' },
  subtitle: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  section: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  sectionTitle: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  helpText: { fontSize: responsiveFontSize.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.xs },
  chip: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: responsiveSpacing.md,
  },
  inputPrefix: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  inputSuffix: { fontSize: responsiveFontSize.xs },
  capNote: { fontSize: responsiveFontSize.xs, marginTop: responsiveSpacing.xs, lineHeight: responsiveFontSize.md },
  input: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '600', paddingVertical: responsiveSpacing.sm },
  btnRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  btn: { flex: 1, paddingVertical: responsiveSpacing.sm, borderRadius: responsiveBorderRadius.lg, alignItems: 'center' },
  btnText: { color: 'white', fontSize: responsiveFontSize.sm, fontWeight: '700' },
  tenantRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  tenantText: { flex: 1, fontSize: responsiveFontSize.xs },
  improveGroup: { fontSize: responsiveFontSize.xs, fontWeight: '700', marginTop: responsiveSpacing.xs },
  improveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  improveName: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  improveMeta: { fontSize: responsiveFontSize.xs, marginTop: 1 },
  improveCost: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
});
