import { parseAmount } from '@/utils/parseAmount';
import { gameAlert } from '@/utils/gameAlert';
import { formatMoney } from '@/utils/moneyFormatting';
import { MAX_COMPANY_EMPLOYEES } from '@/contexts/game/company';
import AmountSlider from '@/components/ui/AmountSlider';
import { uiPalette , withAlpha } from '@/lib/config/theme';
/**
 * HireEmployeeModal - candidate list + offer flow.
 *
 * Lists fresh candidates from `sparkApp.hiringPipeline.candidates`, lets the
 * player adjust salary + sign-on bonus, then dispatches `hireCandidate`.
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Briefcase, RefreshCw } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import EmptyState from '@/components/ui/EmptyState';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';

import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { hireCandidate, refreshCandidates, fireNamedHire, HIRE_ENERGY_COST } from '@/contexts/game/actions/HustleActions';
import { evaluateOffer } from '@/lib/business/hustleLogic';
import { HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

interface HireEmployeeModalProps {
  visible: boolean;
  companyId: string;
  onDismiss: () => void;
}

export default function HireEmployeeModal({ visible, companyId, onDismiss }: HireEmployeeModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [salaryOffer, setSalaryOffer] = useState('');
  const [bonusOffer, setBonusOffer] = useState('');
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState<{ kind: 'offer' | 'fire'; id: string; name: string } | null>(null);
  // Per-open reroll nonce - bumped on every Refresh tap so the candidate seed
  // changes and Refresh yields a genuinely different set within the same week.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const overlay = gameState.hustleApp?.companies?.[companyId];
  const candidates = useMemo(() => overlay?.hiringPipeline?.candidates ?? [], [overlay?.hiringPipeline?.candidates]);
  const namedHires = overlay?.hiringPipeline?.namedHires ?? [];

  useEffect(() => {
    if (!pending) return;
    const pipeline = gameState.hustleApp?.companies?.[companyId]?.hiringPipeline;
    const hired = pipeline?.namedHires.some(h => h.candidateId === pending.id);
    const processed = pending.kind === 'fire' ? pipeline && !hired : pipeline && !pipeline.candidates.some(c => c.id === pending.id);
    if (processed) {
      if (pending.kind === 'offer' && hired) hustleHaptics.success();
      else hustleHaptics.warning();
      setResultMsg(pending.kind === 'fire' ? 'Employee released. Severance paid.' : hired ? `${pending.name} joined your team.` : `${pending.name} declined. Interview energy was used; no bonus was charged.`);
      void saveGame?.();
      setSelectedCandidateId(null);
    } else {
      hustleHaptics.error();
      setResultMsg('No change was made. Check your company, cash, energy and staff limit.');
    }
    busy.current = false;
    setPending(null);
  }, [pending, gameState, companyId, saveGame]);

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
    const salary = parseAmount(salaryOffer);
    const bonus = parseAmount(bonusOffer);
    return salary !== null && salary > 0 && bonus !== null ? evaluateOffer(selected, salary, bonus, reputation) : 0;
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
    const nextNonce = refreshNonce + 1;
    setRefreshNonce(nextNonce);
    refreshCandidates(setGameState, companyId, nextNonce);
    setSelectedCandidateId(null);
    setSalaryOffer('');
    setBonusOffer('');
  }, [setGameState, companyId, refreshNonce]);

  const salary = parseAmount(salaryOffer);
  const bonus = parseAmount(bonusOffer);
  const company = gameState.companies?.find(c => c.id === companyId);
  const offerProblem = !company ? 'Company no longer available'
    : (company.employees ?? 0) >= MAX_COMPANY_EMPLOYEES ? `At the ${MAX_COMPANY_EMPLOYEES}-employee limit`
    : (gameState.stats.energy ?? 0) < HIRE_ENERGY_COST ? `Needs ${HIRE_ENERGY_COST} energy to interview`
    : salary === null || salary <= 0 || bonus === null ? 'Choose a positive salary and a bonus'
    : bonus > gameState.stats.money ? 'Not enough cash for the sign-on bonus' : null;

  const handleOffer = useCallback(() => {
    if (!selected || offerProblem || salary === null || bonus === null || busy.current) return;
    busy.current = true;
    const r = hireCandidate(setGameState, gameState, companyId, selected.id, salary, bonus);
    if (!r.success) {
      busy.current = false;
      setResultMsg(r.message);
      hustleHaptics.error();
      return;
    }
    setPending({ kind: 'offer', id: selected.id, name: selected.name });
  }, [selected, offerProblem, salary, bonus, setGameState, gameState, companyId]);

  const handleFire = useCallback((candidateId: string) => {
    const hire = gameState.hustleApp?.companies?.[companyId]?.hiringPipeline.namedHires.find(h => h.candidateId === candidateId);
    if (!hire || busy.current) return;
    gameAlert('Release employee?', `Pay ${formatMoney(Math.floor(hire.salary * 4))} in severance (four weeks of salary). Your team loses one employee and reputation falls by 1.`, [
      { text: 'Keep employee', style: 'cancel' },
      { text: 'Release employee', style: 'destructive', onPress: () => {
        if (busy.current) return;
        busy.current = true;
        const r = fireNamedHire(setGameState, gameState, companyId, candidateId);
        if (!r.success) { busy.current = false; setResultMsg(r.message); hustleHaptics.error(); return; }
        setPending({ kind: 'fire', id: candidateId, name: hire.role });
      } },
    ]);
  }, [setGameState, gameState, companyId]);

  if (!visible) return null;

  return (
    <BaseModal visible={visible} onClose={onDismiss} variant="bottom" title="Hiring pipeline">
      <View>
            {resultMsg ? <Text accessibilityRole="alert" style={[styles.resultMsg, { color: theme.text }]}>{resultMsg}</Text> : null}
            {/* Named hires */}
            {namedHires.length > 0 ? (
              <>
                <SectionTitle title="Current team" />
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

            {/* Candidates. Refresh lives on the section heading now that the
                modal chrome belongs to BaseModal. */}
            <SectionTitle
              title="Open positions"
              right={
                <Pressable
                  onPress={handleRefresh}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh candidates"
                  hitSlop={8}
                  style={styles.iconBtn}
                >
                  <RefreshCw size={fontScale(18)} color={theme.text} />
                </Pressable>
              }
            />
            {candidates.length === 0 ? (
              <EmptyState
                compact
                observation="Nobody is on the shortlist."
                nudge="Refresh to bring in a new set of candidates."
              />
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
                      borderColor: c.id === selectedCandidateId ? HUSTLE_COLORS.accent : theme.border,
                      borderWidth: c.id === selectedCandidateId ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={[styles.candIcon, { backgroundColor: withAlpha(HUSTLE_COLORS.accent, 0.13) }]}>
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
                  <AmountSlider value={salaryOffer} onChangeText={(t) => { setSalaryOffer(t); setResultMsg(null); }} accessibilityLabel="Weekly salary in dollars" initialRange={Math.max(selected.salaryAsk * 2, 1000)} darkMode={!!gameState.settings?.darkMode} />
                </View>
                <View style={styles.offerField}>
                  <Text style={[styles.offerLabel, { color: theme.textSecondary }]}>Sign-on bonus (one-time)</Text>
                  <AmountSlider value={bonusOffer} onChangeText={(t) => { setBonusOffer(t); setResultMsg(null); }} accessibilityLabel="Sign-on bonus in dollars" maxAmount={gameState.stats?.money ?? 0} darkMode={!!gameState.settings?.darkMode} />
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
                  {offerScore >= 70 ? ' · will accept' : offerScore >= 50 ? ' · may accept' : ' · will decline'}
                </Text>
                <Text style={[styles.offerLabel, { color: theme.textSecondary }]}>Interview: {HIRE_ENERGY_COST} energy, even if declined. Salary is charged weekly; bonus is paid once on acceptance.</Text>
                {offerProblem ? <Text style={[styles.resultMsg, { color: theme.textSecondary }]}>{offerProblem}</Text> : null}
                {salary !== null && bonus !== null ? <Text style={[styles.offerLabel, { color: theme.text }]}>Offer: ${salary.toLocaleString('en-US', { maximumFractionDigits: 2 })}/week + ${bonus.toLocaleString('en-US', { maximumFractionDigits: 2 })} once</Text> : null}
                <Pressable
                  disabled={!!offerProblem || !!pending}
                  accessibilityState={{ disabled: !!offerProblem || !!pending, busy: !!pending }}
                  onPress={handleOffer}
                  accessibilityRole="button"
                  accessibilityLabel="Send offer"
                  style={({ pressed }) => [styles.cta, { backgroundColor: HUSTLE_COLORS.accent, opacity: offerProblem || pending ? 0.5 : pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.ctaText}>Send offer</Text>
                </Pressable>
              </View>
            ) : null}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  hireMeta: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  fireBtn: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fireBtnText: {
    fontSize: fontScale(11),
    fontWeight: '600',
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
    fontWeight: '600',
  },
  offerField: { gap: 4 },
  offerLabel: {
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  offerInput: {
    borderWidth: 1,
    borderRadius: scale(10),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
    fontSize: fontScale(14),
  },
  offerScore: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  cta: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginTop: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: uiPalette.white,
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  resultMsg: {
    fontSize: fontScale(12),
    textAlign: 'center',
    marginTop: responsiveSpacing.xs,
  },
});
