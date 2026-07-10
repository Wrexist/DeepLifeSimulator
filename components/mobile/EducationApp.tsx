/**
 * EducationApp — mobile education screen.
 *
 * Remake 7. Replaces the 1,636-LOC inline-mutation version with a clean
 * 3-tab loop wired to:
 *   - lib/education/operations (pure transformers)
 *   - lib/education/gpa, lib/education/scholarships (pure helpers)
 *   - contexts/game/actions/EducationActions (React-aware wrappers)
 *
 * What's new vs the legacy app:
 *   - Student loans route through the banking system (Loan[] with student-loan APR,
 *     auto-pay, credit-score impact) instead of an isolated `studentLoan` field
 *   - Scholarship engine: merit-based (GPA ≥ 3.0 → up to 80% off at 4.0)
 *     + politics-driven flat aid + politics cost reduction
 *   - GPA → job-offer multiplier (consumed elsewhere via `jobOfferMultiplier`)
 *   - Smaller, focused UI: enroll modal shows scholarship + loan trade-off
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft, GraduationCap, BookOpen, Trophy, Briefcase } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Education } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassCategoryTabsContainer } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import EducationRow from '@/components/education/EducationRow';
import EnrollModal, { EnrollTemplate } from '@/components/education/EnrollModal';
import {
  clearCampusEvent,
  enrollInProgram,
  studyExtra,
  togglePauseProgram,
  withdrawFromProgram,
} from '@/contexts/game/actions/EducationActions';
import { highestGpa, gpaLetter, jobOfferMultiplier } from '@/lib/education/gpa';

const LinearGradient = LinearGradientFallback;

// Education identity accent — cyan. Solid only on small CTAs/badges (≤44pt);
// everywhere else it appears as translucent tints per the Slate Glass system.
const CYAN = '#06B6D4';

interface EducationAppProps {
  onBack: () => void;
}

type Tab = 'available' | 'enrolled' | 'completed';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { id: 'available', label: 'Catalog',  icon: BookOpen },
  { id: 'enrolled',  label: 'Enrolled', icon: GraduationCap },
  { id: 'completed', label: 'Earned',   icon: Trophy },
];

/** Course catalog. Trimmed from the legacy 11 entries. */
const CATALOG: EnrollTemplate[] = [
  { id: 'high_school',       name: 'High School Diploma',  description: 'Required for most jobs.',                    cost: 0,       duration: 104 },
  { id: 'police_academy',    name: 'Police Academy',       description: 'Law enforcement training.',                  cost: 12_000,  duration: 30 },
  { id: 'legal_studies',     name: 'Legal Studies',        description: 'Paralegal track.',                           cost: 18_000,  duration: 46 },
  { id: 'entrepreneurship',  name: 'Entrepreneurship',     description: 'Start and run companies.',                   cost: 30_000,  duration: 72 },
  { id: 'business_degree',   name: 'Business Degree',      description: 'Teacher / nurse track.',                     cost: 48_000,  duration: 90 },
  { id: 'computer_science',  name: 'Computer Science',     description: 'Software engineering track.',                cost: 72_000,  duration: 104 },
  { id: 'masters_degree',    name: "Master's Degree",      description: 'Specialized — opens senior roles.',          cost: 90_000,  duration: 120 },
  { id: 'mba',               name: 'MBA',                  description: 'Required for corporate executive careers.',  cost: 120_000, duration: 150 },
  { id: 'medical_school',    name: 'Medical School',       description: 'Doctor track.',                              cost: 150_000, duration: 180 },
  { id: 'law_school',        name: 'Law School',           description: 'Lawyer track.',                              cost: 132_000, duration: 156 },
  { id: 'phd',               name: 'PhD',                  description: 'Research doctorate.',                        cost: 180_000, duration: 208 },
];

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function EducationAppInner({ onBack }: EducationAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const educations: Education[] = gameState.educations ?? [];
  const cash = gameState.stats?.money ?? 0;

  const enrolled = useMemo(() => educations.filter((e) => !e.completed), [educations]);
  const completed = useMemo(() => educations.filter((e) => e.completed), [educations]);
  const availableForCatalog = useMemo(
    () => CATALOG.filter((t) => !educations.some((e) => e.id === t.id)),
    [educations]
  );

  const bestGpa = useMemo(() => highestGpa(educations), [educations]);
  const hiringMult = useMemo(() => jobOfferMultiplier(bestGpa), [bestGpa]);

  const [activeTab, setActiveTab] = useState<Tab>(enrolled.length > 0 ? 'enrolled' : 'available');
  const [enrollTarget, setEnrollTarget] = useState<EnrollTemplate | null>(null);

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  // --- Render helpers ----------------------------------------------------
  const renderAvailable = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* This tab's mandatory colorful element (the event banner) is its color
          moment, so it carries NO Recipe B hero. */}
      <EconomyEventBanner context="generic" />
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>Catalog</SectionTitle>
        {availableForCatalog.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>You&apos;ve enrolled in every program in the catalog.</EmptyText>
        ) : (
          availableForCatalog.map((t) => {
            const placeholderEd: Education = {
              id: t.id,
              name: t.name,
              description: t.description,
              cost: t.cost,
              duration: t.duration,
              completed: false,
              weeksRemaining: t.duration,
            };
            return (
              <EducationRow
                key={t.id}
                education={placeholderEd}
                darkMode={darkMode}
                onPress={() => setEnrollTarget(t)}
              />
            );
          })
        )}
      </View>
    </View>
  );

  const renderEnrolled = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {bestGpa > 0 && (
        // Recipe B hero — the ONE focal gradient surface of this tab (cyan identity).
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
              colors={['rgba(6, 182, 212, 0.14)', 'rgba(6, 182, 212, 0.03)']}
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
                backgroundColor: 'rgba(6, 182, 212, 0.10)',
              }}
            />
            {darkMode && (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
              />
            )}
            <View style={styles.heroContent}>
              <View
                style={[
                  getGlassIconContainer(darkMode, 44),
                  { backgroundColor: 'rgba(6, 182, 212, 0.15)', borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.30)' },
                ]}
              >
                <Briefcase size={scale(22)} color={CYAN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Best GPA</Text>
                <Text style={[styles.heroValue, { color: theme.text }]}>
                  {bestGpa.toFixed(2)} ({gpaLetter(bestGpa)})
                </Text>
                <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                  Hiring boost: ×{hiringMult.toFixed(2)} on job offers
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        {enrolled.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            Not enrolled in anything. Pick a program from the Catalog tab.
          </EmptyText>
        ) : (
          enrolled.map((e) => (
            <View key={e.id} style={{ gap: responsiveSpacing.xs }}>
              <EducationRow
                education={e}
                darkMode={darkMode}
                onTogglePause={() => {
                  togglePauseProgram(setGameState, e.id);
                  queueSave();
                }}
              />
              <View style={styles.actionRow}>
                {(() => {
                  // Mirror studyExtra's real gates so the button can't silently
                  // no-op: it rejects (with only a logger.warn) below 15 energy
                  // or past 3 sessions/week.
                  const sessionsThisWeek = gameState.weeklyStudySessions?.[e.id] ?? 0;
                  const capReached = sessionsThisWeek >= 3;
                  const lowEnergy = (gameState.stats?.energy ?? 0) < 15;
                  const studyDisabled = e.paused || capReached || lowEnergy;
                  const label = capReached
                    ? 'Studied 3/3 this week'
                    : lowEnergy
                      ? 'Too tired (−15 energy)'
                      : `Study ${sessionsThisWeek}/3 (−15 energy)`;
                  return (
                    <TouchableOpacity
                      disabled={studyDisabled}
                      onPress={() => {
                        studyExtra(setGameState, e.id);
                        queueSave();
                      }}
                      style={[
                        styles.actionBtn,
                        studyDisabled
                          ? { backgroundColor: theme.surfaceElevated }
                          : { backgroundColor: 'rgba(6, 182, 212, 0.16)' },
                      ]}
                    >
                      <Text style={[styles.actionBtnText, { color: studyDisabled ? theme.textMuted : CYAN }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })()}
                <TouchableOpacity
                  onPress={() => {
                    withdrawFromProgram(setGameState, e.id);
                    queueSave();
                  }}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.10)' : 'rgba(239, 68, 68, 0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.30)',
                    },
                  ]}
                >
                  <Text style={[styles.actionBtnText, { color: accent.danger }]}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderCompleted = () => (
    <View style={{ gap: responsiveSpacing.sm }}>
      {completed.length === 0 ? (
        <EmptyText theme={theme} darkMode={darkMode}>No completed programs yet.</EmptyText>
      ) : (
        completed.map((e) => (
          <EducationRow key={e.id} education={e} darkMode={darkMode} />
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Education</Text>
        <View style={[styles.cashChip, { backgroundColor: 'rgba(6, 182, 212, 0.14)', borderColor: 'rgba(6, 182, 212, 0.30)' }]}>
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
              style={[styles.tab, active && { backgroundColor: 'rgba(6, 182, 212, 0.16)' }]}
            >
              <Icon size={scale(16)} color={active ? CYAN : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? CYAN : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
      >
        {activeTab === 'available' && renderAvailable()}
        {activeTab === 'enrolled' && renderEnrolled()}
        {activeTab === 'completed' && renderCompleted()}
      </ScrollView>

      <EnrollModal
        visible={!!enrollTarget}
        template={enrollTarget}
        gameState={gameState}
        darkMode={darkMode}
        onClose={() => setEnrollTarget(null)}
        onConfirm={(mode) => {
          if (enrollTarget) {
            enrollInProgram(setGameState, {
              templateId: enrollTarget.id,
              name: enrollTarget.name,
              description: enrollTarget.description,
              cost: enrollTarget.cost,
              duration: enrollTarget.duration,
              mode,
            });
            queueSave();
            setActiveTab('enrolled');
          }
          setEnrollTarget(null);
        }}
      />

      {/* Silence unused-var warnings for follow-up wiring. */}
      {false && <Text>{String(clearCampusEvent)}</Text>}
    </View>
  );
}

function SectionTitle({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function EmptyText({ theme, darkMode, children }: { theme: ReturnType<typeof getThemeColors>; darkMode: boolean; children: React.ReactNode }) {
  // Give empty sections a card so they share the same rhythm as populated ones
  // instead of floating as bare text between elevated rows (Recipe A, muted).
  return (
    <View style={[getGlassCard(darkMode, 6), styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>
    </View>
  );
}

export default function EducationApp(props: EducationAppProps) {
  return (
    <ErrorBoundary>
      <EducationAppInner {...props} />
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
    minWidth: scale(40),
    minHeight: scale(40),
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
  // Segmented control in its own glass container directly under the top bar,
  // which anchors the screen — so the top bar drops its bottom border.
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
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    opacity: 0.6,
  },
  emptyCard: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.lg,
  },
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
  heroLabel: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroValue: { fontSize: responsiveFontSize['3xl'], fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2, fontVariant: ['tabular-nums'] },
  actionRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
