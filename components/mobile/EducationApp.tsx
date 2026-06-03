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
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
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
    <View style={{ gap: responsiveSpacing.md }}>
      <EconomyEventBanner context="generic" />
      <SectionTitle theme={theme}>Catalog</SectionTitle>
      {availableForCatalog.length === 0 ? (
        <EmptyText theme={theme}>You&apos;ve enrolled in every program in the catalog.</EmptyText>
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
  );

  const renderEnrolled = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      {bestGpa > 0 && (
        <View style={[styles.heroCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: accent.info }]}>
            <Briefcase size={scale(20)} color="white" />
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
      )}

      {enrolled.length === 0 ? (
        <EmptyText theme={theme}>
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
              <TouchableOpacity
                disabled={e.paused}
                onPress={() => {
                  studyExtra(setGameState, e.id);
                  queueSave();
                }}
                style={[styles.actionBtn, { backgroundColor: e.paused ? theme.border : accent.info }]}
              >
                <Text style={styles.actionBtnText}>Study (−15 energy)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  withdrawFromProgram(setGameState, e.id);
                  queueSave();
                }}
                style={[styles.actionBtn, { backgroundColor: 'transparent', borderColor: accent.danger, borderWidth: 1 }]}
              >
                <Text style={[styles.actionBtnText, { color: accent.danger }]}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderCompleted = () => (
    <View style={{ gap: responsiveSpacing.md }}>
      {completed.length === 0 ? (
        <EmptyText theme={theme}>No completed programs yet.</EmptyText>
      ) : (
        completed.map((e) => (
          <EducationRow key={e.id} education={e} darkMode={darkMode} />
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]}>Education</Text>
        <View style={[styles.cashChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, active && { borderBottomColor: accent.info }]}
            >
              <Icon size={scale(16)} color={active ? accent.info : theme.textMuted} />
              <Text style={[styles.tabText, { color: active ? accent.info : theme.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: responsiveSpacing['2xl'] }}
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

function EmptyText({ theme, children }: { theme: ReturnType<typeof getThemeColors>; children: React.ReactNode }) {
  return <Text style={[styles.emptyText, { color: theme.textMuted }]}>{children}</Text>;
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
    borderBottomWidth: 1,
    gap: responsiveSpacing.sm,
  },
  backBtn: { padding: responsiveSpacing.xs },
  appTitle: { flex: 1, fontSize: responsiveFontSize.lg, fontWeight: '700' },
  cashChip: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  cashChipText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  sectionTitle: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    marginTop: responsiveSpacing.xs,
  },
  emptyText: {
    fontSize: responsiveFontSize.sm,
    textAlign: 'center',
    paddingVertical: responsiveSpacing.md,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  heroIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  heroValue: { fontSize: responsiveFontSize['2xl'], fontWeight: '800' },
  heroSub: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
    alignItems: 'center',
  },
  actionBtnText: { color: 'white', fontSize: responsiveFontSize.sm, fontWeight: '700' },
});
