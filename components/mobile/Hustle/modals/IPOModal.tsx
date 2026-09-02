/**
 * IPOModal - take a company public, or show post-IPO earnings.
 *
 * For private companies: float percent slider (10/25/40), share price preview,
 * cash raised preview, confirm CTA.
 * For public companies: recent earnings reports + share price ticker.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { launchIPO } from '@/contexts/game/actions/HustleActions';
import { computeIPOSharePrice } from '@/lib/business/hustleLogic';
import { HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

const FLOAT_OPTIONS = [10, 25, 40] as const;

interface IPOModalProps {
  visible: boolean;
  companyId: string;
  onDismiss: () => void;
}

export default function IPOModal({ visible, companyId, onDismiss }: IPOModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const [floatPct, setFloatPct] = useState<number>(25);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const company = (gameState.companies ?? []).find((c: any) => c.id === companyId);
  const overlay = gameState.hustleApp?.companies?.[companyId];
  const isPublic = overlay?.ipo?.status === 'public';

  const previewSharePrice = company && overlay && !isPublic
    ? computeIPOSharePrice(company, overlay, 100)
    : overlay?.ipo?.sharePrice ?? 0;
  const previewCash = Math.floor(100 * 1000 * (floatPct / 100) * previewSharePrice);

  const handleLaunch = useCallback(() => {
    const r = launchIPO(setGameState, gameState, companyId, floatPct);
    if (r.success) {
      hustleHaptics.success();
      saveGame?.();
      setResultMsg(`Raised $${r.cashRaised.toLocaleString()} at $${r.sharePrice}/share - you kept ${r.ownershipKept}%`);
    } else {
      hustleHaptics.error();
      setResultMsg(r.message);
    }
  }, [setGameState, gameState, companyId, floatPct, saveGame]);

  if (!visible || !company) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={onDismiss}
      variant="bottom"
      title={isPublic ? 'Public company' : `Take ${company.name} public`}
      subtitle={
        isPublic && overlay
          ? `Share price $${overlay.ipo.sharePrice.toFixed(2)} · ${overlay.ipo.ownershipPercent}% ownership`
          : 'An IPO raises cash but dilutes your ownership.'
      }
    >
      <View>
          {isPublic && overlay ? (
            <>
              <View style={[styles.earningsBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.earningsLabel, { color: theme.textSecondary }]}>Recent earnings reports</Text>
                {overlay.ipo.recentEarnings.length === 0 ? (
                  <Text style={[styles.earningsEmpty, { color: theme.textMuted }]}>
                    No reports yet - first quarterly drops at week {(overlay.ipo.lastEarningsWeek ?? 0) + 12}
                  </Text>
                ) : (
                  overlay.ipo.recentEarnings.map((e: any) => (
                    <View key={e.week} style={styles.earningsRow}>
                      {e.beat ? (
                        <TrendingUp size={fontScale(14)} color={HUSTLE_COLORS.success} />
                      ) : (
                        <TrendingDown size={fontScale(14)} color={HUSTLE_COLORS.danger} />
                      )}
                      <Text style={[styles.earningsText, { color: theme.text }]}>
                        Week {e.week} · ${(e.revenue / 1000).toFixed(0)}K revenue · {e.beat ? 'Beat' : 'Missed'}
                      </Text>
                    </View>
                  ))
                )}
              </View>
              {/* The IPO fires from the private branch, but success flips the
                  company to public and re-renders HERE - so the "raised $X"
                  confirmation must also show in the public branch, or a
                  successful IPO would look like it did nothing. */}
              {resultMsg ? <Text style={[styles.resultMsg, { color: theme.text }]}>{resultMsg}</Text> : null}
            </>
          ) : (
            <>
              <View style={styles.floatRow}>
                {FLOAT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => { hustleHaptics.tap(); setFloatPct(opt); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: floatPct === opt }}
                    accessibilityLabel={`Float ${opt} percent`}
                    style={[
                      styles.floatBtn,
                      {
                        borderColor: floatPct === opt ? HUSTLE_COLORS.accent : theme.border,
                        backgroundColor: floatPct === opt ? theme.surfaceElevated : theme.surface,
                        borderWidth: floatPct === opt ? 2 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Text style={[styles.floatPct, { color: theme.text }]}>{opt}%</Text>
                    <Text style={[styles.floatSub, { color: theme.textSecondary }]}>
                      Keep {100 - opt}%
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.preview, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Share price</Text>
                  <Text style={[styles.previewValue, { color: theme.text }]}>${previewSharePrice.toFixed(2)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>Cash raised</Text>
                  <Text style={[styles.previewValue, { color: HUSTLE_COLORS.success }]}>
                    ${previewCash.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleLaunch}
                accessibilityRole="button"
                accessibilityLabel={`IPO ${company.name} with ${floatPct}% float`}
                style={({ pressed }) => [styles.cta, { backgroundColor: HUSTLE_COLORS.accent, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.ctaText}>Launch IPO</Text>
              </Pressable>
              {resultMsg ? <Text style={[styles.resultMsg, { color: theme.text }]}>{resultMsg}</Text> : null}
            </>
          )}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  floatRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  floatBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    borderRadius: scale(12),
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatPct: {
    fontSize: fontScale(18),
    fontWeight: '600',
  },
  floatSub: {
    fontSize: fontScale(10),
    marginTop: 2,
  },
  preview: {
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: fontScale(12),
  },
  previewValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  earningsBox: {
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  earningsLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  earningsEmpty: {
    fontSize: fontScale(12),
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningsText: {
    fontSize: fontScale(12),
  },
  cta: {
    borderRadius: scale(14),
    overflow: 'hidden',
    paddingVertical: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  resultMsg: {
    fontSize: fontScale(12),
    textAlign: 'center',
    marginTop: responsiveSpacing.sm,
  },
});
