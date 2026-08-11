/**
 * AcquireModal — list pending acquisition offers + accept/decline.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Building2, X } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import {
  acceptAcquisition,
  declineAcquisition,
  acquisitionWeeklyGain,
  acquisitionSharePoints,
} from '@/contexts/game/actions/HustleActions';
import { HUSTLE_GRADIENT, HUSTLE_COLORS, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

const LinearGradient = Gradient;

interface AcquireModalProps {
  visible: boolean;
  companyId: string;
  onDismiss: () => void;
}

export default function AcquireModal({ visible, companyId, onDismiss }: AcquireModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const offers = overlay?.pendingAcquisitions ?? [];
  const playerMoney = gameState.stats?.money ?? 0;

  const handleAccept = useCallback((offerId: string) => {
    const r = acceptAcquisition(setGameState, gameState, companyId, offerId);
    if (r.success) {
      hustleHaptics.success();
      saveGame?.();
    } else {
      hustleHaptics.error();
    }
  }, [setGameState, gameState, companyId, saveGame]);

  const handleDecline = useCallback((offerId: string) => {
    declineAcquisition(setGameState, companyId, offerId);
    hustleHaptics.tap();
    saveGame?.();
  }, [setGameState, companyId, saveGame]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Acquisition targets</Text>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.iconBtn}>
              <X size={fontScale(20)} color={theme.text} />
            </Pressable>
          </View>

          {offers.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              No pending offers. Tick generates new targets every 8 weeks when your company qualifies.
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
              {offers.map((offer: any) => {
                const color = industryColor(offer.targetIndustry);
                const canAfford = playerMoney >= offer.askingPrice;
                return (
                  <View
                    key={offer.id}
                    style={[styles.offerCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  >
                    <View style={styles.offerHeader}>
                      <LinearGradient
                        colors={[color, color + 'BB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.offerIcon}
                      >
                        <Building2 size={fontScale(18)} color="#FFFFFF" />
                      </LinearGradient>
                      <View style={styles.offerText}>
                        <Text style={[styles.offerName, { color: theme.text }]}>{offer.targetName}</Text>
                        <Text style={[styles.offerSub, { color: theme.textSecondary }]}>
                          {offer.targetIndustry} · ${(offer.estimatedAnnualRevenue / 1000).toFixed(0)}K annual
                        </Text>
                      </View>
                    </View>

                    <View style={styles.offerMetrics}>
                      <View style={styles.offerMetric}>
                        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Asking</Text>
                        <Text style={[styles.metricValue, { color: theme.text }]}>
                          ${offer.askingPrice.toLocaleString()}
                        </Text>
                      </View>
                      {/**
                        * The number the player is actually paid, not the raw
                        * `synergyBonusPercent`.
                        *
                        * This used to render `+{offer.synergyBonusPercent}%` under
                        * the bare label "Synergy" — no unit, no target. The field
                        * is 8–30, but only a QUARTER of it reaches market share
                        * (`+synergyBonusPercent / 4`), so a headline "+24%"
                        * described a +6-point share move. A 4× overstatement on a
                        * seven-figure purchase is the single most likely reason
                        * this read as "acquisition changed nothing".
                        *
                        * Weekly income is now the headline because it is the term
                        * the player can verify on the company card, and it is
                        * derived from the SAME arithmetic `acceptAcquisition`
                        * applies, so display and payout cannot drift.
                        */}
                      <View style={styles.offerMetric}>
                        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Adds weekly</Text>
                        <Text style={[styles.metricValue, { color: HUSTLE_COLORS.success }]}>
                          +${acquisitionWeeklyGain(offer.estimatedAnnualRevenue).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.offerSub, { color: theme.textSecondary }]}>
                      Synergy +{acquisitionSharePoints(offer.synergyBonusPercent).toFixed(1)} market share
                    </Text>

                    <View style={styles.offerCtaRow}>
                      <Pressable
                        onPress={() => handleDecline(offer.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Decline ${offer.targetName}`}
                        style={[styles.btnSecondary, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.btnSecondaryText, { color: theme.text }]}>Pass</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleAccept(offer.id)}
                        disabled={!canAfford}
                        accessibilityRole="button"
                        accessibilityLabel={`Accept ${offer.targetName}`}
                        accessibilityState={{ disabled: !canAfford }}
                        style={[styles.btnPrimary, !canAfford && { opacity: 0.55 }]}
                      >
                        <LinearGradient
                          colors={
                            canAfford
                              ? (HUSTLE_GRADIENT as unknown as string[])
                              : [theme.border, theme.border]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.btnPrimaryFill}
                        >
                          <Text style={styles.btnPrimaryText}>{canAfford ? 'Acquire' : 'Need cash'}</Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  // `maxHeight` + `flexShrink` on the list below, together. A bottom sheet with
  // no height bound grows to fit its content, so on a short screen its footer
  // button lands off the bottom of the SCREEN — and the sheet itself does not
  // scroll, so nothing can reach it. Bounding the sheet is what gives the list
  // something to shrink within. Same fix as ApplyCardModal (2026-08-02).
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.md,
  },
  title: { fontSize: fontScale(20), fontWeight: '800' },
  iconBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: fontScale(13),
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: responsiveSpacing.xl,
  },
  offerCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  offerIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerText: { flex: 1 },
  offerName: { fontSize: fontScale(14), fontWeight: '700' },
  offerSub: { fontSize: fontScale(11), marginTop: 2 },
  offerMetrics: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
  },
  offerMetric: { flex: 1 },
  metricLabel: {
    fontSize: fontScale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: fontScale(14),
    fontWeight: '700',
    marginTop: 2,
  },
  offerCtaRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1.4,
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  btnPrimaryFill: {
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '700',
  },
});
