/**
 * HireEmployeeModal — candidate list + offer flow.
 *
 * Lists fresh candidates from `sparkApp.hiringPipeline.candidates`, lets the
 * player adjust salary + sign-on bonus, then dispatches `hireCandidate`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Briefcase, RefreshCw, X } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { hireCandidate, refreshCandidates, fireNamedHire } from '@/contexts/game/actions/HustleActions';
import { evaluateOffer } from '@/lib/business/hustleLogic';
import { HUSTLE_GRADIENT, HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

const LinearGradient = LinearGradientFallback;

interface HireEmployeeModalProps {
  visible: boolean;
  companyId: string;
  onDismiss: () => void;
}

export default function HireEmployeeModal({ visible, companyId, onDismiss }: HireEmployeeModalProps) {
  const { gameState, setGameState, saveGame } = useGame() as any;
  const { theme } = useTheme();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [salaryOffer, setSalaryOffer] = useState('');
  const [bonusOffer, setBonusOffer] = useState('');
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const overlay = gameState.hustleApp?.companies?.[companyId];
  const candidates = overlay?.hiringPipeline?.candidates ?? [];
  const namedHires = overlay?.hiringPipeline?.namedHires ?? [];

  // Auto-refresh candidates if empty when opened
  useEffect(() => {
    if (visible && candidates.length === 0) {
      refreshCandidates(setGameState, companyId);
    }
  }, [visible, candidates.length, companyId, setGameState]);

  const selected = candidates.find((c: any) => c.id === selectedCandidateId);
  const reputation = gameState.stats?.reputation ?? 0;

  const offerScore = useMemo(() => {
    if (!selected) return 0;
    const s = parseInt(salaryOffer || String(selected.salaryAsk), 10);
    const b = parseInt(bonusOffer || '0', 10);
    return evaluateOffer(selected, s, b, reputation);
  }, [selected, salaryOffer, bonusOffer, reputation]);

  const handleSelect = useCallback((id: string) => {
    hustleHaptics.tap();
    setSelectedCandidateId(id);
    const cand = candidates.find((c: any) => c.id === id);
    if (cand) {
      setSalaryOffer(String(cand.salaryAsk));
      setBonusOffer('0');
    }
    setResultMsg(null);
  }, [candidates]);

  const handleRefresh = useCallback(() => {
    hustleHaptics.tap();
    refreshCandidates(setGameState, companyId);
    setSelectedCandidateId(null);
    setSalaryOffer('');
    setBonusOffer('');
  }, [setGameState, companyId]);

  const handleOffer = useCallback(() => {
    if (!selected) return;
    const salary = parseInt(salaryOffer || String(selected.salaryAsk), 10);
    const bonus = parseInt(bonusOffer || '0', 10);
    const r = hireCandidate(setGameState, gameState, companyId, selected.id, salary, bonus);
    if (r.accepted) hustleHaptics.success();
    else hustleHaptics.warning();
    setResultMsg(r.message);
    if (r.accepted) {
      saveGame?.();
      setSelectedCandidateId(null);
    }
  }, [selected, salaryOffer, bonusOffer, setGameState, gameState, companyId, saveGame]);

  const handleFire = useCallback((candidateId: string) => {
    const r = fireNamedHire(setGameState, gameState, companyId, candidateId);
    if (r.success) {
      hustleHaptics.warning();
      saveGame?.();
    }
  }, [setGameState, gameState, companyId, saveGame]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Hiring pipeline</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Refresh candidates" hitSlop={8} style={styles.iconBtn}>
                <RefreshCw size={fontScale(18)} color={theme.text} />
              </Pressable>
              <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.iconBtn}>
                <X size={fontScale(20)} color={theme.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(420) }}>
            {/* Named hires */}
            {namedHires.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Current team</Text>
                {namedHires.map((h: any) => (
                  <View key={h.candidateId} style={[styles.hireRow, { borderColor: theme.border }]}>
                    <View style={styles.hireText}>
                      <Text style={[styles.hireName, { color: theme.text }]}>
                        {h.role.charAt(0).toUpperCase() + h.role.slice(1)} · ${h.salary}/wk
                      </Text>
                      <Text style={[styles.hireMeta, { color: theme.textSecondary }]}>
                        Morale {h.morale} · Performance {h.performance}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleFire(h.candidateId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Fire this ${h.role}`}
                      style={[styles.fireBtn, { borderColor: HUSTLE_COLORS.danger }]}
                    >
                      <Text style={[styles.fireBtnText, { color: HUSTLE_COLORS.danger }]}>Fire</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}

            {/* Candidates */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Open positions</Text>
            {candidates.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textMuted }]}>No candidates. Tap refresh.</Text>
            ) : (
              candidates.map((c: any) => (
                <Pressable
                  key={c.id}
                  onPress={() => handleSelect(c.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: c.id === selectedCandidateId }}
                  style={[
                    styles.candCard,
                    {
                      backgroundColor: c.id === selectedCandidateId ? theme.surfaceElevated : theme.surface,
                      borderColor: c.id === selectedCandidateId ? HUSTLE_GRADIENT[0] : theme.border,
                      borderWidth: c.id === selectedCandidateId ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={[styles.candIcon, { backgroundColor: HUSTLE_COLORS.accent + '22' }]}>
                    <Briefcase size={fontScale(16)} color={HUSTLE_COLORS.accent} />
                  </View>
                  <View style={styles.candText}>
                    <Text style={[styles.candName, { color: theme.text }]}>{c.name}</Text>
                    <Text style={[styles.candMeta, { color: theme.textSecondary }]}>
                      {c.role} · skill {c.skill}/100 · asks ${c.salaryAsk}/wk
                    </Text>
                  </View>
                </Pressable>
              ))
            )}

            {/* Offer composer */}
            {selected ? (
              <View style={[styles.offerCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.offerTitle, { color: theme.text }]}>
                  Make {selected.name} an offer
                </Text>
                <View style={styles.offerField}>
                  <Text style={[styles.offerLabel, { color: theme.textSecondary }]}>Salary / week</Text>
                  <TextInput
                    value={salaryOffer}
                    onChangeText={(t) => { setSalaryOffer(t); setResultMsg(null); }}
                    keyboardType="numeric"
                    placeholder={String(selected.salaryAsk)}
                    placeholderTextColor={theme.textMuted}
                    style={[styles.offerInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <View style={styles.offerField}>
                  <Text style={[styles.offerLabel, { color: theme.textSecondary }]}>Sign-on bonus (one-time)</Text>
                  <TextInput
                    value={bonusOffer}
                    onChangeText={(t) => { setBonusOffer(t); setResultMsg(null); }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.offerInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <Text
                  style={[
                    styles.offerScore,
                    {
                      color:
                        offerScore >= 70 ? HUSTLE_COLORS.success
                          : offerScore >= 50 ? HUSTLE_COLORS.warning
                          : HUSTLE_COLORS.danger,
                    },
                  ]}
                >
                  Interest score: {offerScore}/100
                  {offerScore >= 70 ? ' · likely to accept' : offerScore >= 50 ? ' · 50/50' : ' · likely to decline'}
                </Text>
                <Pressable
                  onPress={handleOffer}
                  accessibilityRole="button"
                  accessibilityLabel="Send offer"
                  style={styles.cta}
                >
                  <LinearGradient
                    colors={HUSTLE_GRADIENT as unknown as string[]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaFill}
                  >
                    <Text style={styles.ctaText}>Send offer</Text>
                  </LinearGradient>
                </Pressable>
                {resultMsg ? (
                  <Text style={[styles.resultMsg, { color: theme.text }]}>{resultMsg}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
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
  title: {
    fontSize: fontScale(20),
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  iconBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  empty: {
    fontSize: fontScale(12),
    fontStyle: 'italic',
    paddingVertical: responsiveSpacing.md,
  },
  candCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    marginBottom: responsiveSpacing.sm,
  },
  candIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  candText: { flex: 1 },
  candName: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  candMeta: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  hireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: responsiveSpacing.sm,
  },
  hireText: { flex: 1 },
  hireName: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  hireMeta: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  fireBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  fireBtnText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  offerCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  offerTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  offerField: { gap: 4 },
  offerLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  offerInput: {
    borderWidth: 1,
    borderRadius: scale(10),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    fontSize: fontScale(14),
  },
  offerScore: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  cta: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginTop: responsiveSpacing.sm,
  },
  ctaFill: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  resultMsg: {
    fontSize: fontScale(12),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
});
