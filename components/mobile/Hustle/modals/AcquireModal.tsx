import { uiPalette , withAlpha } from '@/lib/config/theme';
/**
 * AcquireModal - list pending acquisition offers + accept/decline.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2 } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import EmptyState from '@/components/ui/EmptyState';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';

import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import {
  acceptAcquisition,
  declineAcquisition,
  acquisitionWeeklyGain,
  acquisitionSharePoints,
} from '@/contexts/game/actions/HustleActions';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { HUSTLE_COLORS, industryColor } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

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

  const busy = useRef(false);
  const [pending, setPending] = useState<{ id: string; name: string; completedBefore: number } | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!pending) return;
    const committed = !gameState.hustleApp?.companies?.[companyId]?.pendingAcquisitions.some(o => o.id === pending.id)
      && (gameState.hustleApp?.lifetimeStats.totalAcquisitionsCompleted ?? 0) > pending.completedBefore;
    if (committed) { hustleHaptics.success(); void saveGame?.(); setResultMsg(`Acquired ${pending.name}. Weekly company revenue has increased.`); }
    else { hustleHaptics.error(); setResultMsg('Acquisition was not completed. Check available cash and try again.'); }
    busy.current = false;
    setPending(null);
  }, [pending, gameState, companyId, saveGame]);

  const handleAccept = useCallback((offerId: string) => {
    if (busy.current) return;
    const offer = gameState.hustleApp?.companies?.[companyId]?.pendingAcquisitions.find(o => o.id === offerId);
    if (!offer) return;
    busy.current = true;
    const r = acceptAcquisition(setGameState, gameState, companyId, offerId);
    if (r.success) setPending({ id: offerId, name: offer.targetName, completedBefore: gameState.hustleApp?.lifetimeStats.totalAcquisitionsCompleted ?? 0 });
    else { busy.current = false; hustleHaptics.error(); setResultMsg(r.message); }
  }, [setGameState, gameState, companyId]);

  const handleDecline = useCallback((offerId: string) => {
    declineAcquisition(setGameState, companyId, offerId);
    hustleHaptics.tap();
    saveGame?.();
  }, [setGameState, companyId, saveGame]);

  if (!visible) return null;

  return (
    <BaseModal visible={visible} onClose={onDismiss} variant="bottom" title="Acquisition targets">
      <View>
          {resultMsg ? <Text accessibilityRole="alert" style={[styles.offerSub, { color: theme.text }]}>{resultMsg}</Text> : null}
          {offers.length === 0 ? (
            <EmptyState
              compact
              observation="No one is up for sale right now."
              nudge="New targets appear every 8 weeks once your company qualifies."
            />
          ) : (
            <>
              {offers.map((offer: any) => {
                const color = industryColor(offer.targetIndustry);
                const canAfford = Number.isFinite(offer.askingPrice) && offer.askingPrice > 0 && playerMoney >= offer.askingPrice && !pending;
                // Every displayed figure goes through the SAME helper the accept
                // path uses. Re-deriving the guard inline here is what let the
                // card advertise a number the action would not pay.
                const weeklyGain = acquisitionWeeklyGain(offer.estimatedAnnualRevenue);
                const safeAnnualRevenue = weeklyGain * WEEKS_PER_YEAR;
                return (
                  <View
                    key={offer.id}
                    style={[styles.offerCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  >
                    <View style={styles.offerHeader}>
                      <View style={[styles.offerIcon, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.3) }]}>
                        <Building2 size={fontScale(18)} color={color} />
                      </View>
                      <View style={styles.offerText}>
                        <Text style={[styles.offerName, { color: theme.text }]}>{offer.targetName}</Text>
                        <Text style={[styles.offerSub, { color: theme.textSecondary }]}>
                          {offer.targetIndustry} · ${(safeAnnualRevenue / 1000).toFixed(0)}K annual
                        </Text>
                      </View>
                    </View>

                    <View style={styles.offerMetrics}>
                      <View style={styles.offerMetric}>
                        <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Asking</Text>
                        <Text style={[styles.metricValue, { color: theme.text }]}>
                          ${offer.askingPrice.toLocaleString('en-US')}
                        </Text>
                      </View>
                      {/**
                        * The number the player is actually paid, not the raw
                        * `synergyBonusPercent`.
                        *
                        * This used to render `+{offer.synergyBonusPercent}%` under
                        * the bare label "Synergy" - no unit, no target. The field
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
                          +${weeklyGain.toLocaleString('en-US')}
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
                        style={[
                          styles.btnPrimary,
                          { backgroundColor: canAfford ? HUSTLE_COLORS.accent : theme.border, opacity: canAfford ? 1 : 0.55 },
                        ]}
                      >
                        <Text style={styles.btnPrimaryText}>{canAfford ? 'Buy' : 'Need cash'}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </>
          )}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerText: { flex: 1 },
  offerName: { fontSize: fontScale(14), fontWeight: '600' },
  offerSub: { fontSize: fontScale(11), marginTop: 2 },
  offerMetrics: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
  },
  offerMetric: { flex: 1 },
  metricLabel: {
    fontSize: fontScale(11),
  },
  metricValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
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
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1.4,
    borderRadius: scale(10),
    overflow: 'hidden',
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: uiPalette.white,
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
