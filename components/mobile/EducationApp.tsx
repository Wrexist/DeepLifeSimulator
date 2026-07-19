/**
 * EducationApp — mobile education screen.
 *
 * Remake 7 + Course-app DNA pass. A 3-tab learning loop wired to:
 *   - lib/education/operations (pure transformers)
 *   - lib/education/gpa, lib/education/scholarships (pure helpers)
 *   - contexts/game/actions/EducationActions (React-aware wrappers)
 *
 * DNA (Coursera / Duolingo course app), on top of the Slate Glass token language:
 *   - Enrolled = wide signature course cards, each with a left ProgressRing
 *     (percent + subject glyph), a band-coloured GPA chip, weeks-left / semester
 *     / exams chips, and always-visible Study / Pause / Withdraw buttons.
 *   - Catalog  = a grouped academic directory (Foundational → Doctoral) with
 *     subject glyphs, tuition + duration chips, and a clear Enroll button per row.
 *   - Earned   = a transcript: a summary hero + credential rows (GPA + honors +
 *     credential badge), each tappable to its transcript detail.
 *   - Tapping an enrolled course or a transcript row opens a full detail page
 *     (list → detail via local useState) that surfaces data the row can't:
 *     enrolled classes, the linked student loan (routed through the bank),
 *     scholarship standing, exam pass-rate, study-session budget.
 *
 * Mechanics are unchanged — this pass only presents existing state more richly.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ArrowLeft, GraduationCap, BookOpen, Trophy, Briefcase, Clock, Award, Pause, Play,
  ChevronRight, Plus, Shield, Scale, Gavel, Rocket, Cpu, TrendingUp, Stethoscope,
  FlaskConical, CalendarDays, Users, Zap, Banknote, Percent, Target, BadgeCheck, CircleCheck,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Education, GameState, Loan } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer, getGlassCategoryTabsContainer, getPlatformShadows } from '@/utils/glassmorphismStyles';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ProgressRing from '@/components/ui/ProgressRing';
import EnrollModal, { EnrollTemplate } from '@/components/education/EnrollModal';
import {
  clearCampusEvent,
  enrollInProgram,
  studyExtra,
  togglePauseProgram,
  toggleStudyGroup,
  withdrawFromProgram,
} from '@/contexts/game/actions/EducationActions';
import { STUDY_GROUP_JOIN_COST } from '@/lib/education/educationSystem';
import { highestGpa, gpaLetter, gpaBand, gpaBandLabel, jobOfferMultiplier, GpaBand } from '@/lib/education/gpa';
import { meritRate } from '@/lib/education/scholarships';

const LinearGradient = LinearGradientFallback;

// Education identity accent — cyan. Solid only on small CTAs/badges (≤44pt);
// everywhere else it appears as translucent tints per the Slate Glass system.
const CYAN = '#06B6D4';
const CYAN_PAIR = '#0891B2'; // CTA gradient pair (fallback renders CYAN flat)

type IconType = React.ComponentType<{ size: number; color: string }>;

interface EducationAppProps {
  onBack: () => void;
}

type Tab = 'available' | 'enrolled' | 'completed';

const TABS: { id: Tab; label: string; icon: IconType }[] = [
  { id: 'available', label: 'Catalog',  icon: BookOpen },
  { id: 'enrolled',  label: 'Enrolled', icon: GraduationCap },
  { id: 'completed', label: 'Earned',   icon: Trophy },
];

// --- Academic directory tiers (presentational grouping of the catalog) -------
type TierId = 'foundation' | 'certificate' | 'undergrad' | 'graduate' | 'professional';
const TIER_ORDER: TierId[] = ['foundation', 'certificate', 'undergrad', 'graduate', 'professional'];
const TIER_LABEL: Record<TierId, string> = {
  foundation: 'Foundational',
  certificate: 'Certificates & Academies',
  undergrad: 'Undergraduate',
  graduate: 'Graduate',
  professional: 'Professional & Doctoral',
};

interface CatalogEntry extends EnrollTemplate {
  tier: TierId;
}

/** Course catalog. Trimmed from the legacy 11 entries; tier is display-only. */
const CATALOG: CatalogEntry[] = [
  { id: 'high_school',       name: 'High School Diploma',  description: 'Required for most jobs.',                    cost: 0,       duration: 104, tier: 'foundation' },
  { id: 'police_academy',    name: 'Police Academy',       description: 'Law enforcement training.',                  cost: 12_000,  duration: 30,  tier: 'certificate' },
  { id: 'legal_studies',     name: 'Legal Studies',        description: 'Paralegal track.',                           cost: 18_000,  duration: 46,  tier: 'certificate' },
  { id: 'entrepreneurship',  name: 'Entrepreneurship',     description: 'Start and run companies.',                   cost: 30_000,  duration: 72,  tier: 'undergrad' },
  { id: 'business_degree',   name: 'Business Degree',      description: 'Teacher / nurse track.',                     cost: 48_000,  duration: 90,  tier: 'undergrad' },
  { id: 'computer_science',  name: 'Computer Science',     description: 'Software engineering track.',                cost: 72_000,  duration: 104, tier: 'undergrad' },
  { id: 'masters_degree',    name: "Master's Degree",      description: 'Specialized — opens senior roles.',          cost: 90_000,  duration: 120, tier: 'graduate' },
  { id: 'mba',               name: 'MBA',                  description: 'Required for corporate executive careers.',  cost: 120_000, duration: 150, tier: 'graduate' },
  { id: 'medical_school',    name: 'Medical School',       description: 'Doctor track.',                              cost: 150_000, duration: 180, tier: 'professional' },
  { id: 'law_school',        name: 'Law School',           description: 'Lawyer track.',                              cost: 132_000, duration: 156, tier: 'professional' },
  { id: 'phd',               name: 'PhD',                  description: 'Research doctorate.',                        cost: 180_000, duration: 208, tier: 'professional' },
];

// --- Subject identity — a glyph + tint per program, so each course reads as a
// distinct "subject" (directory silhouette), not a uniform row. Tints are only
// ever used as Recipe-C tinted bubbles (15% fill / 30% rim / saturated glyph),
// never as large fills — matching the categorical-icon rule in the design system.
const SUBJECTS: Record<string, { Icon: IconType; tint: string }> = {
  high_school:      { Icon: GraduationCap, tint: '#06B6D4' },
  police_academy:   { Icon: Shield,        tint: '#3B82F6' },
  legal_studies:    { Icon: Scale,         tint: '#F59E0B' },
  law_school:       { Icon: Gavel,         tint: '#F59E0B' },
  entrepreneurship: { Icon: Rocket,        tint: '#F97316' },
  business_degree:  { Icon: Briefcase,     tint: '#10B981' },
  computer_science: { Icon: Cpu,           tint: '#8B5CF6' },
  masters_degree:   { Icon: BookOpen,      tint: '#14B8A6' },
  mba:              { Icon: TrendingUp,    tint: '#10B981' },
  medical_school:   { Icon: Stethoscope,   tint: '#F43F5E' },
  phd:              { Icon: FlaskConical,  tint: '#8B5CF6' },
};
function subjectFor(id: string): { Icon: IconType; tint: string } {
  return SUBJECTS[id] ?? { Icon: GraduationCap, tint: CYAN };
}

const BAND_COLOR: Record<GpaBand, string> = {
  failing: accent.danger,
  atRisk: accent.warning,
  average: accent.info,
  solid: accent.info,
  honors: accent.success,
  topOfClass: accent.purple,
};

// ---------------------------------------------------------------------------
// Pure display helpers
// ---------------------------------------------------------------------------

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

/** Friendly programme length: weeks under a year, otherwise years. */
function formatDuration(weeks: number): string {
  if (!isFinite(weeks) || weeks <= 0) return '0w';
  if (weeks >= 52) {
    const yrs = weeks / 52;
    return `${Number.isInteger(yrs) ? yrs : yrs.toFixed(1)}yr`;
  }
  return `${Math.round(weeks)}w`;
}

interface GradeInfo {
  gpa: number;
  band: GpaBand;
  color: string;
  letter: string;
  label: string;
  noRecord: boolean;
}
function gradeInfo(ed: Education): GradeInfo {
  const noRecord = !!ed.completed && ed.gpa == null;
  const gpa = ed.gpa ?? 0;
  const band = noRecord ? 'solid' : gpaBand(gpa);
  return { gpa, band, color: BAND_COLOR[band], letter: gpaLetter(gpa), label: gpaBandLabel(band), noRecord };
}

function progressOf(ed: Education): number {
  const remaining = ed.weeksRemaining ?? ed.duration;
  const p = ed.duration > 0 ? 1 - remaining / ed.duration : 0;
  return Math.max(0, Math.min(1, p));
}

/** The student loan the bank system created for this programme, if any. */
function findStudentLoan(loans: Loan[] | undefined, ed: Education): Loan | undefined {
  if (!loans) return undefined;
  const target = `Student Loan: ${ed.name}`;
  return loans.find((l) => l.name === target);
}

interface StudyState {
  sessionsThisWeek: number;
  capReached: boolean;
  lowEnergy: boolean;
  disabled: boolean;
  label: string;
}
/**
 * Mirror studyExtra's real gates so the button can't silently no-op: it rejects
 * (with only a logger.warn) below 15 energy or past 3 sessions/week, or paused.
 */
function computeStudyState(gameState: GameState, ed: Education): StudyState {
  const sessionsThisWeek = gameState.weeklyStudySessions?.[ed.id] ?? 0;
  const capReached = sessionsThisWeek >= 3;
  const lowEnergy = (gameState.stats?.energy ?? 0) < 15;
  const disabled = !!ed.paused || capReached || lowEnergy;
  const label = capReached
    ? 'Studied 3/3 this week'
    : lowEnergy
      ? 'Too tired (−15 energy)'
      : `Study ${sessionsThisWeek}/3 (−15 energy)`;
  return { sessionsThisWeek, capReached, lowEnergy, disabled, label };
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

function EducationAppInner({ onBack }: EducationAppProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);

  const educations: Education[] = gameState.educations ?? [];
  const cash = gameState.stats?.money ?? 0;
  const energy = gameState.stats?.energy ?? 0;

  const enrolled = useMemo(() => educations.filter((e) => !e.completed), [educations]);
  const completed = useMemo(() => educations.filter((e) => e.completed), [educations]);
  const availableForCatalog = useMemo(
    () => CATALOG.filter((t) => !educations.some((e) => e.id === t.id)),
    [educations]
  );
  const catalogByTier = useMemo(() => {
    const groups: Record<TierId, CatalogEntry[]> = {
      foundation: [], certificate: [], undergrad: [], graduate: [], professional: [],
    };
    for (const e of availableForCatalog) groups[e.tier].push(e);
    return groups;
  }, [availableForCatalog]);

  const bestGpa = useMemo(() => highestGpa(educations), [educations]);
  const hiringMult = useMemo(() => jobOfferMultiplier(bestGpa), [bestGpa]);
  const bestGradeColor = BAND_COLOR[gpaBand(bestGpa)];

  const studentLoans = useMemo(
    () => (gameState.loans ?? []).filter((l) => l.name.startsWith('Student Loan:')),
    [gameState.loans]
  );
  const weeklyLoanPayment = useMemo(
    () => studentLoans.reduce((s, l) => s + (l.weeklyPayment || 0), 0),
    [studentLoans]
  );
  const honorsCount = useMemo(
    () => completed.filter((e) => {
      const g = gradeInfo(e);
      return !g.noRecord && (g.band === 'honors' || g.band === 'topOfClass');
    }).length,
    [completed]
  );
  const totalExamsPassed = useMemo(
    () => completed.reduce((s, e) => s + (e.examsPassed ?? 0), 0),
    [completed]
  );

  const [activeTab, setActiveTab] = useState<Tab>(enrolled.length > 0 ? 'enrolled' : 'available');
  const [enrollTarget, setEnrollTarget] = useState<EnrollTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => (selectedId ? educations.find((e) => e.id === selectedId) ?? null : null),
    [educations, selectedId]
  );
  const inDetail = selectedCourse != null;

  const queueSave = useCallback(() => {
    saveGame().catch(() => {});
  }, [saveGame]);

  const handleStudy = useCallback((id: string) => {
    studyExtra(setGameState, id);
    queueSave();
  }, [setGameState, queueSave]);

  const handleTogglePause = useCallback((id: string) => {
    togglePauseProgram(setGameState, id);
    queueSave();
  }, [setGameState, queueSave]);

  const handleWithdraw = useCallback((id: string) => {
    withdrawFromProgram(setGameState, id);
    queueSave();
    setSelectedId((cur) => (cur === id ? null : cur));
  }, [setGameState, queueSave]);

  const handleToggleStudyGroup = useCallback((id: string) => {
    toggleStudyGroup(setGameState, id);
    queueSave();
  }, [setGameState, queueSave]);

  // Campus events: the weekly tick flags `pendingCampusEventEducationId` when
  // one fires; this dismissable banner finally CONSUMES that flag via the
  // previously-dead `clearCampusEvent` action (replacing the `{false && …}`
  // unused-var placeholder).
  const pendingCampusEventId = gameState.pendingCampusEventEducationId;
  const pendingCampusEventName = useMemo(
    () => educations.find((e) => e.id === pendingCampusEventId)?.name,
    [educations, pendingCampusEventId]
  );
  const handleDismissCampusEvent = useCallback(() => {
    clearCampusEvent(setGameState);
    queueSave();
  }, [setGameState, queueSave]);

  // --- Tab bodies --------------------------------------------------------
  const renderAvailable = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* This tab's mandatory colourful element (the event banner) is its colour
          moment, so it carries NO Recipe B hero. */}
      <EconomyEventBanner context="generic" />
      {availableForCatalog.length === 0 ? (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Catalog</SectionTitle>
          <EmptyText theme={theme} darkMode={darkMode}>You&apos;ve enrolled in every program in the catalog.</EmptyText>
        </View>
      ) : (
        TIER_ORDER.map((tier) => {
          const items = catalogByTier[tier];
          if (items.length === 0) return null;
          return (
            <View key={tier} style={{ gap: responsiveSpacing.sm }}>
              <View style={styles.sectionHeaderRow}>
                <SectionTitle theme={theme}>{TIER_LABEL[tier]}</SectionTitle>
                <View style={[styles.countPill, { backgroundColor: withAlpha(CYAN, 0.14), borderColor: withAlpha(CYAN, 0.30) }]}>
                  <Text style={[styles.countPillText, { color: CYAN }]}>{items.length}</Text>
                </View>
              </View>
              {items.map((entry) => (
                <CatalogRow
                  key={entry.id}
                  entry={entry}
                  theme={theme}
                  darkMode={darkMode}
                  canAfford={cash >= entry.cost}
                  onEnroll={() => setEnrollTarget(entry)}
                />
              ))}
            </View>
          );
        })
      )}
    </View>
  );

  const renderEnrolled = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {bestGpa > 0 && (
        // Recipe B hero — the ONE focal gradient surface of this tab (cyan identity).
        <HeroCard theme={theme} darkMode={darkMode}>
          <View style={styles.heroTopRow}>
            <View
              style={[
                getGlassIconContainer(darkMode, 46),
                { backgroundColor: withAlpha(CYAN, 0.15), borderWidth: 1, borderColor: withAlpha(CYAN, 0.30) },
              ]}
            >
              <GraduationCap size={scale(22)} color={CYAN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Academic standing</Text>
              <Text style={[styles.heroValue, { color: bestGradeColor }]}>
                {bestGpa.toFixed(2)} · {gpaLetter(bestGpa)}
              </Text>
              <View style={styles.heroSubRow}>
                <Target size={scale(12)} color={theme.textMuted} />
                <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                  Hiring boost ×{hiringMult.toFixed(2)} on job offers
                </Text>
              </View>
            </View>
            <View style={[styles.chip, { backgroundColor: withAlpha(bestGradeColor, 0.15), borderColor: withAlpha(bestGradeColor, 0.30) }]}>
              <Award size={scale(11)} color={bestGradeColor} />
              <Text style={[styles.chipText, { color: bestGradeColor }]}>{gpaBandLabel(gpaBand(bestGpa))}</Text>
            </View>
          </View>
          <View style={[styles.heroStatStrip, { borderTopColor: theme.border }]}>
            <StatTile theme={theme} icon={GraduationCap} tint={CYAN} label="Enrolled" value={String(enrolled.length)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatTile theme={theme} icon={Zap} tint={accent.warning} label="Energy" value={String(Math.round(energy))} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatTile theme={theme} icon={Banknote} tint={accent.info} label="Loans / wk" value={formatMoney(weeklyLoanPayment)} />
          </View>
        </HeroCard>
      )}

      <View style={{ gap: responsiveSpacing.md }}>
        {enrolled.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>
            Not enrolled in anything. Pick a program from the Catalog tab.
          </EmptyText>
        ) : (
          enrolled.map((e) => (
            <CourseCard
              key={e.id}
              ed={e}
              theme={theme}
              darkMode={darkMode}
              study={computeStudyState(gameState, e)}
              loan={findStudentLoan(gameState.loans, e)}
              onOpen={() => setSelectedId(e.id)}
              onStudy={() => handleStudy(e.id)}
              onTogglePause={() => handleTogglePause(e.id)}
              onToggleStudyGroup={() => handleToggleStudyGroup(e.id)}
              onWithdraw={() => handleWithdraw(e.id)}
              canAffordStudyGroup={cash >= STUDY_GROUP_JOIN_COST}
            />
          ))
        )}
      </View>
    </View>
  );

  const renderCompleted = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {completed.length > 0 && (
        <HeroCard theme={theme} darkMode={darkMode}>
          <View style={styles.heroTopRow}>
            <View
              style={[
                getGlassIconContainer(darkMode, 46),
                { backgroundColor: withAlpha(CYAN, 0.15), borderWidth: 1, borderColor: withAlpha(CYAN, 0.30) },
              ]}
            >
              <Trophy size={scale(22)} color={CYAN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Transcript</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{completed.length}</Text>
              <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                {completed.length === 1 ? 'credential earned' : 'credentials earned'}
              </Text>
            </View>
          </View>
          <View style={[styles.heroStatStrip, { borderTopColor: theme.border }]}>
            <StatTile theme={theme} icon={Target} tint={bestGradeColor} label="Best GPA" value={bestGpa.toFixed(2)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatTile theme={theme} icon={Award} tint={accent.success} label="Honors" value={String(honorsCount)} />
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <StatTile theme={theme} icon={BadgeCheck} tint={accent.info} label="Exams" value={String(totalExamsPassed)} />
          </View>
        </HeroCard>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        {completed.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No completed programs yet.</EmptyText>
        ) : (
          <>
            <SectionTitle theme={theme}>Credentials</SectionTitle>
            {completed.map((e) => (
              <TranscriptRow key={e.id} ed={e} theme={theme} darkMode={darkMode} onOpen={() => setSelectedId(e.id)} />
            ))}
          </>
        )}
      </View>
    </View>
  );

  const goBack = inDetail ? () => setSelectedId(null) : onBack;
  const headerTitle = inDetail && selectedCourse ? selectedCourse.name : 'Education';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: 0 }]}>
      {/* Header renders unconditionally; back returns to the list from a detail
          page, or exits the app from the tab list. */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={scale(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appTitle, { color: theme.text }]} numberOfLines={1}>{headerTitle}</Text>
        <View style={[styles.cashChip, { backgroundColor: withAlpha(CYAN, 0.14), borderColor: withAlpha(CYAN, 0.30) }]}>
          <Text style={[styles.cashChipText, { color: theme.text }]}>{formatMoney(cash)}</Text>
        </View>
      </View>

      {inDetail && selectedCourse ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: responsiveSpacing.md, paddingBottom: getAppScreenBottomPadding(insets.bottom) }}
        >
          <CourseDetail
            ed={selectedCourse}
            theme={theme}
            darkMode={darkMode}
            bestGpa={bestGpa}
            study={computeStudyState(gameState, selectedCourse)}
            loan={findStudentLoan(gameState.loans, selectedCourse)}
            onStudy={() => handleStudy(selectedCourse.id)}
            onTogglePause={() => handleTogglePause(selectedCourse.id)}
            onToggleStudyGroup={() => handleToggleStudyGroup(selectedCourse.id)}
            onWithdraw={() => handleWithdraw(selectedCourse.id)}
            canAffordStudyGroup={cash >= STUDY_GROUP_JOIN_COST}
          />
        </ScrollView>
      ) : (
        <>
          <View style={[styles.tabBar, getGlassCategoryTabsContainer(darkMode)]}>
            {TABS.map((t) => {
              const active = activeTab === t.id;
              const Icon = t.icon;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={[styles.tab, active && { backgroundColor: withAlpha(CYAN, 0.16) }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t.label}
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
        </>
      )}

      <EnrollModal
        visible={!!enrollTarget}
        template={enrollTarget}
        gameState={gameState}
        darkMode={darkMode}
        onClose={() => setEnrollTarget(null)}
        onConfirm={(mode, classIds) => {
          if (enrollTarget) {
            enrollInProgram(setGameState, {
              templateId: enrollTarget.id,
              name: enrollTarget.name,
              description: enrollTarget.description,
              cost: enrollTarget.cost,
              duration: enrollTarget.duration,
              mode,
              classIds,
            });
            queueSave();
            setActiveTab('enrolled');
          }
          setEnrollTarget(null);
        }}
      />

      {pendingCampusEventId ? (
        <View
          style={{
            position: 'absolute',
            left: responsiveSpacing.md,
            right: responsiveSpacing.md,
            bottom: getAppScreenBottomPadding(insets.bottom),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: responsiveSpacing.sm,
            padding: responsiveSpacing.md,
            borderRadius: 14,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ flex: 1, color: theme.text, fontSize: scale(13) }}>
            {`Something happened on campus${pendingCampusEventName ? ` in ${pendingCampusEventName}` : ''}.`}
          </Text>
          <TouchableOpacity
            onPress={handleDismissCampusEvent}
            accessibilityRole="button"
            accessibilityLabel="Dismiss campus event"
            style={{
              paddingVertical: responsiveSpacing.xs,
              paddingHorizontal: responsiveSpacing.md,
              borderRadius: 10,
              backgroundColor: withAlpha(CYAN, 0.16),
            }}
          >
            <Text style={{ color: CYAN, fontWeight: '700', fontSize: scale(13) }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Signature components
// ---------------------------------------------------------------------------

/** Recipe B hero shell — cyan identity wash + one glow blob + lit hairline. */
function HeroCard({ theme, darkMode, children }: { theme: ReturnType<typeof getThemeColors>; darkMode: boolean; children: React.ReactNode }) {
  return (
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
        <View pointerEvents="none" style={[styles.heroBlob, { backgroundColor: withAlpha(CYAN, 0.10) }]} />
        {darkMode && <View pointerEvents="none" style={styles.heroHairline} />}
        <View style={{ gap: responsiveSpacing.md }}>{children}</View>
      </View>
    </View>
  );
}

/** Tinted micro-metric used inside heroes and detail. */
function StatTile({ theme, icon: Icon, tint, label, value }: {
  theme: ReturnType<typeof getThemeColors>;
  icon: IconType;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileHead}>
        <Icon size={scale(12)} color={tint} />
        <Text style={[styles.statTileLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.statTileValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

/** Small labelled chip — the reusable readout/affordance unit. */
function Chip({ theme, icon: Icon, label, tint }: {
  theme: ReturnType<typeof getThemeColors>;
  icon?: IconType;
  label: string;
  tint?: string;
}) {
  // Tinted chips carry accent identity; untinted chips fall back to a neutral
  // inset (surfaceElevated) so they read as micro-surfaces, not accents.
  const fill = tint ? withAlpha(tint, 0.13) : theme.surfaceElevated;
  const border = tint ? withAlpha(tint, 0.28) : theme.border;
  const textColor = tint ?? theme.textSecondary;
  const iconColor = tint ?? theme.textMuted;
  return (
    <View style={[styles.chip, { backgroundColor: fill, borderColor: border }]}>
      {Icon ? <Icon size={scale(11)} color={iconColor} /> : null}
      <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Recipe-C tinted subject bubble. */
function SubjectBubble({ id, darkMode, size = 44 }: { id: string; darkMode: boolean; size?: number }) {
  const { Icon, tint } = subjectFor(id);
  return (
    <View
      style={[
        getGlassIconContainer(darkMode, size),
        { backgroundColor: withAlpha(tint, 0.15), borderWidth: 1, borderColor: withAlpha(tint, 0.30) },
      ]}
    >
      <Icon size={scale(size * 0.42)} color={tint} />
    </View>
  );
}

/** Join / leave a study group — the missing writer for `studyGroupActive`.
 *  Active: leave (free). Inactive: join for a one-time cost, gated on affordability. */
function StudyGroupButton({ ed, theme, canAfford, onPress }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  canAfford: boolean;
  onPress: () => void;
}) {
  const active = !!ed.studyGroupActive;
  // Inactive + unaffordable is the only disabled case (leaving is always allowed).
  const disabled = !active && !canAfford;
  const tint = active ? accent.success : CYAN;
  const label = active
    ? 'Leave study group'
    : `Join study group · ${formatMoney(STUDY_GROUP_JOIN_COST)}`;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        disabled
          ? { backgroundColor: theme.surfaceElevated }
          : { backgroundColor: withAlpha(tint, 0.14), borderWidth: 1, borderColor: withAlpha(tint, 0.30) },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Users size={scale(14)} color={disabled ? theme.textMuted : tint} />
      <Text style={[styles.actionBtnText, { color: disabled ? theme.textMuted : tint }]} numberOfLines={1}>
        {disabled ? `Study group · need ${formatMoney(STUDY_GROUP_JOIN_COST)}` : label}
      </Text>
    </TouchableOpacity>
  );
}

/** Enrolled course — wide signature card: ProgressRing + info + action buttons. */
function CourseCard({ ed, theme, darkMode, study, loan, onOpen, onStudy, onTogglePause, onToggleStudyGroup, onWithdraw, canAffordStudyGroup }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  study: StudyState;
  loan?: Loan;
  onOpen: () => void;
  onStudy: () => void;
  onTogglePause: () => void;
  onToggleStudyGroup: () => void;
  onWithdraw: () => void;
  canAffordStudyGroup: boolean;
}) {
  const grade = gradeInfo(ed);
  const pct = progressOf(ed);
  const { Icon: SubjIcon, tint: subjTint } = subjectFor(ed.id);
  const weeksLeft = ed.weeksRemaining ?? ed.duration;
  const exams = (ed.examsPassed ?? 0) + (ed.examsFailed ?? 0);

  return (
    <View
      style={[
        getGlassCard(darkMode, 6),
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
      ]}
    >
      <View style={styles.courseInner}>
        {/* Tap the head to open the full course page. */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpen}
          style={styles.courseHead}
          accessibilityRole="button"
          accessibilityLabel={`Open ${ed.name}`}
        >
          <ProgressRing
            value={pct * 100}
            size={72}
            strokeWidth={6}
            state="active"
            accentColor={CYAN}
            trackColor={darkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.30)'}
            surfaceColor={theme.surface}
            borderColor={theme.border}
            inkColor={theme.text}
            ambient={false}
            label={`${ed.name}, ${Math.round(pct * 100)} percent complete`}
          >
            <SubjIcon size={scale(22)} color={subjTint} />
          </ProgressRing>

          <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
            <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>{ed.name}</Text>
            <View style={styles.chipRow}>
              <Chip theme={theme} label={`${grade.letter} ${grade.gpa.toFixed(2)}`} tint={grade.color} />
              <Chip theme={theme} icon={Clock} label={`${weeksLeft}w left`} tint={CYAN} />
              <Chip theme={theme} icon={CalendarDays} label={`Sem ${ed.semesterNumber ?? 1}`} />
            </View>
            <View style={styles.chipRow}>
              {exams > 0 && (
                <Chip theme={theme} icon={BadgeCheck} label={`${ed.examsPassed ?? 0}✓ / ${ed.examsFailed ?? 0}✗`} />
              )}
              {ed.studyGroupActive && <Chip theme={theme} icon={Users} label="Study group" tint={accent.success} />}
              {loan && <Chip theme={theme} icon={Banknote} label={`Loan ${formatMoney(loan.remaining)}`} tint={accent.info} />}
              {ed.paused && <Chip theme={theme} icon={Pause} label="Paused" tint={accent.warning} />}
            </View>
          </View>

          <ChevronRight size={scale(18)} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Actions — always visible & tappable. Study spans a full row so its
            gated label (sessions / energy / reason) stays legible. */}
        <TouchableOpacity
          disabled={study.disabled}
          onPress={onStudy}
          style={[
            styles.actionBtn,
            study.disabled
              ? { backgroundColor: theme.surfaceElevated }
              : { backgroundColor: withAlpha(CYAN, 0.16), borderWidth: 1, borderColor: withAlpha(CYAN, 0.30) },
          ]}
          accessibilityRole="button"
          accessibilityLabel={study.label}
          accessibilityState={{ disabled: study.disabled }}
        >
          <Zap size={scale(14)} color={study.disabled ? theme.textMuted : CYAN} />
          <Text style={[styles.actionBtnText, { color: study.disabled ? theme.textMuted : CYAN }]} numberOfLines={1}>
            {study.label}
          </Text>
        </TouchableOpacity>

        <StudyGroupButton
          ed={ed}
          theme={theme}
          canAfford={canAffordStudyGroup}
          onPress={onToggleStudyGroup}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={onTogglePause}
            style={[styles.actionBtn, { flex: 1, backgroundColor: theme.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel={ed.paused ? 'Resume program' : 'Pause program'}
          >
            {ed.paused ? <Play size={scale(14)} color={accent.success} /> : <Pause size={scale(14)} color={accent.warning} />}
            <Text style={[styles.actionBtnText, { color: ed.paused ? accent.success : accent.warning }]}>
              {ed.paused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onWithdraw}
            style={[
              styles.actionBtn,
              { flex: 1, backgroundColor: withAlpha(accent.danger, darkMode ? 0.10 : 0.08), borderWidth: 1, borderColor: withAlpha(accent.danger, 0.30) },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Withdraw from program"
          >
            <Text style={[styles.actionBtnText, { color: accent.danger }]}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/** Catalog directory row — subject glyph, tuition + duration chips, Enroll button. */
function CatalogRow({ entry, theme, darkMode, canAfford, onEnroll }: {
  entry: CatalogEntry;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  canAfford: boolean;
  onEnroll: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onEnroll}
      style={[
        getGlassCard(darkMode, 6),
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Enroll in ${entry.name}`}
    >
      <View style={styles.catalogInner}>
        <SubjectBubble id={entry.id} darkMode={darkMode} size={44} />
        <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
          <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>{entry.name}</Text>
          <Text style={[styles.catalogDesc, { color: theme.textMuted }]} numberOfLines={1}>{entry.description}</Text>
          <View style={styles.chipRow}>
            <Chip theme={theme} icon={Banknote} label={entry.cost === 0 ? 'Free' : formatMoney(entry.cost)} tint={entry.cost === 0 ? accent.success : CYAN} />
            <Chip theme={theme} icon={Clock} label={formatDuration(entry.duration)} />
          </View>
        </View>
        <View
          style={[
            styles.enrollBtn,
            { backgroundColor: withAlpha(CYAN, 0.16), borderColor: withAlpha(CYAN, 0.32) },
          ]}
        >
          <Plus size={scale(13)} color={CYAN} />
          <Text style={[styles.enrollBtnText, { color: CYAN }]}>{canAfford ? 'Enroll' : 'Options'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Completed credential — transcript row: subject, GPA, band + credential badge. */
function TranscriptRow({ ed, theme, darkMode, onOpen }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  onOpen: () => void;
}) {
  const grade = gradeInfo(ed);
  const exams = (ed.examsPassed ?? 0) + (ed.examsFailed ?? 0);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onOpen}
      style={[
        getGlassCard(darkMode, 6),
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`View transcript for ${ed.name}`}
    >
      <View style={styles.transcriptInner}>
        <SubjectBubble id={ed.id} darkMode={darkMode} size={42} />
        <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
          <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>{ed.name}</Text>
          <View style={styles.chipRow}>
            <Chip
              theme={theme}
              icon={Award}
              label={grade.noRecord ? 'Graduated' : `${grade.letter} ${grade.gpa.toFixed(2)}`}
              tint={grade.color}
            />
            <Chip theme={theme} label={grade.noRecord ? 'On record' : grade.label} tint={grade.color} />
            {exams > 0 && <Chip theme={theme} icon={BadgeCheck} label={`${ed.examsPassed ?? 0}✓ / ${ed.examsFailed ?? 0}✗`} />}
          </View>
        </View>
        <View style={[styles.credentialBadge, { backgroundColor: withAlpha(accent.success, 0.15), borderColor: withAlpha(accent.success, 0.30) }]}>
          <BadgeCheck size={scale(13)} color={accent.success} />
        </View>
        <ChevronRight size={scale(18)} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

/** Full course / transcript detail page (presentational sub-view). */
function CourseDetail({ ed, theme, darkMode, bestGpa, study, loan, onStudy, onTogglePause, onToggleStudyGroup, onWithdraw, canAffordStudyGroup }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  bestGpa: number;
  study: StudyState;
  loan?: Loan;
  onStudy: () => void;
  onTogglePause: () => void;
  onToggleStudyGroup: () => void;
  onWithdraw: () => void;
  canAffordStudyGroup: boolean;
}) {
  const grade = gradeInfo(ed);
  const pct = progressOf(ed);
  const { Icon: SubjIcon, tint: subjTint } = subjectFor(ed.id);
  const weeksLeft = ed.weeksRemaining ?? ed.duration;
  const passed = ed.examsPassed ?? 0;
  const failed = ed.examsFailed ?? 0;
  const exams = passed + failed;
  const passRate = exams > 0 ? Math.round((passed / exams) * 100) : null;
  const currentMerit = Math.round(meritRate(bestGpa) * 100);
  const classes = ed.enrolledClasses ?? [];

  return (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* Recipe B hero — the ONE gradient surface on this screen. */}
      <HeroCard theme={theme} darkMode={darkMode}>
        <View style={styles.detailHeroRow}>
          <ProgressRing
            value={pct * 100}
            size={104}
            strokeWidth={8}
            state={ed.completed ? 'done' : 'active'}
            accentColor={CYAN}
            positiveColor={grade.color}
            trackColor={darkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.30)'}
            surfaceColor={theme.surface}
            borderColor={theme.border}
            inkColor={theme.text}
            ambient={false}
            label={`${ed.name}, ${Math.round(pct * 100)} percent complete`}
          >
            <SubjIcon size={scale(34)} color={subjTint} />
          </ProgressRing>
          <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
            <Text style={[styles.heroLabel, { color: theme.textMuted }]}>
              {ed.completed ? 'Credential' : 'In progress'}
            </Text>
            <Text style={[styles.detailTitle, { color: theme.text }]} numberOfLines={2}>{ed.name}</Text>
            <View style={styles.chipRow}>
              <Chip theme={theme} icon={Award} label={grade.noRecord ? 'Graduated' : `${grade.letter} ${grade.gpa.toFixed(2)}`} tint={grade.color} />
              <Chip theme={theme} label={grade.noRecord ? 'On record' : grade.label} tint={grade.color} />
            </View>
            {ed.completed ? (
              <View style={styles.chipRow}>
                <Chip theme={theme} icon={BadgeCheck} label="Earned" tint={accent.success} />
              </View>
            ) : (
              <View style={styles.chipRow}>
                <Chip theme={theme} icon={Clock} label={`${weeksLeft}w left`} tint={CYAN} />
                <Chip theme={theme} icon={CalendarDays} label={`Sem ${ed.semesterNumber ?? 1}`} />
              </View>
            )}
          </View>
        </View>
      </HeroCard>

      {/* Stat grid — surfaces record fields the list rows can't fit. */}
      <View style={styles.detailGrid}>
        <DetailStat theme={theme} darkMode={darkMode} icon={Percent} tint={CYAN} label="Progress" value={`${Math.round(pct * 100)}%`} sub={`${weeksLeft}w of ${ed.duration}w`} />
        <DetailStat theme={theme} darkMode={darkMode} icon={Target} tint={grade.color} label="GPA" value={grade.noRecord ? '—' : grade.gpa.toFixed(2)} sub={grade.noRecord ? 'no grade on file' : `${grade.letter} · ${grade.label}`} />
        <DetailStat theme={theme} darkMode={darkMode} icon={BadgeCheck} tint={accent.info} label="Exams" value={exams > 0 ? `${passed}✓ / ${failed}✗` : 'None yet'} sub={passRate != null ? `${passRate}% pass rate` : 'no exams taken'} />
        <DetailStat theme={theme} darkMode={darkMode} icon={CalendarDays} tint={accent.purple} label="Semester" value={String(ed.semesterNumber ?? 1)} sub={ed.studyGroupActive ? 'study group active' : 'solo study'} />
        {!ed.completed && (
          <DetailStat theme={theme} darkMode={darkMode} icon={Zap} tint={accent.warning} label="Study budget" value={`${study.sessionsThisWeek}/3`} sub="sessions this week" />
        )}
        <DetailStat theme={theme} darkMode={darkMode} icon={Percent} tint={accent.success} label="Scholarship rate" value={`${currentMerit}%`} sub="at your best GPA" />
      </View>

      {/* Enrolled classes — richest previously-hidden data. */}
      {classes.length > 0 && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Classes ({classes.length})</SectionTitle>
          <View
            style={[
              getGlassCard(darkMode, 6),
              { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
            ]}
          >
            <View style={styles.classList}>
              {classes.map((c, i) => (
                <View key={c.id} style={[styles.classRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <View style={[styles.classDot, { backgroundColor: c.completed ? accent.success : withAlpha(CYAN, 0.5) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.className, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.classMeta, { color: theme.textMuted }]} numberOfLines={1}>
                      {c.category} · difficulty {c.difficulty}/3
                    </Text>
                  </View>
                  {c.completed ? (
                    <CircleCheck size={scale(16)} color={accent.success} />
                  ) : (
                    <Text style={[styles.classPending, { color: theme.textMuted }]}>In progress</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Linked student loan — cross-system readout (routed through the bank). */}
      {loan && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle theme={theme}>Student loan</SectionTitle>
          <View
            style={[
              getGlassCard(darkMode, 6),
              { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
            ]}
          >
            <View style={styles.loanInner}>
              <View style={styles.loanTopRow}>
                <View style={[getGlassIconContainer(darkMode, 40), { backgroundColor: withAlpha(accent.info, 0.15), borderWidth: 1, borderColor: withAlpha(accent.info, 0.30) }]}>
                  <Banknote size={scale(18)} color={accent.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.loanBalance, { color: theme.text }]}>{formatMoney(loan.remaining)}</Text>
                  <Text style={[styles.loanSub, { color: theme.textMuted }]}>remaining of {formatMoney(loan.principal)}</Text>
                </View>
                {loan.autoPay && <Chip theme={theme} icon={CircleCheck} label="Auto-pay" tint={accent.success} />}
              </View>
              <View style={[styles.heroStatStrip, { borderTopColor: theme.border }]}>
                <StatTile theme={theme} icon={Banknote} tint={accent.info} label="Weekly" value={formatMoney(loan.weeklyPayment)} />
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <StatTile theme={theme} icon={Percent} tint={accent.warning} label="APR" value={`${(loan.rateAPR * 100).toFixed(1)}%`} />
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <StatTile theme={theme} icon={Clock} tint={CYAN} label="Weeks left" value={String(loan.weeksRemaining)} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Description */}
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle theme={theme}>About</SectionTitle>
        <View
          style={[
            getGlassCard(darkMode, 6),
            { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
          ]}
        >
          <Text style={[styles.aboutText, { color: theme.textSecondary }]}>{ed.description}</Text>
        </View>
      </View>

      {/* Actions — only for in-progress programmes. */}
      {!ed.completed && (
        <View style={{ gap: responsiveSpacing.sm }}>
          {/* Recipe D primary CTA: outer wrap carries solid fill + shadow (so
              Android elevation & the flat fallback both read correct); inner
              clipped view carries the gradient wash + content. */}
          <TouchableOpacity
            disabled={study.disabled}
            onPress={onStudy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={study.label}
            accessibilityState={{ disabled: study.disabled }}
            style={[
              styles.primaryCtaWrap,
              { backgroundColor: study.disabled ? theme.surfaceElevated : CYAN },
              !study.disabled && getPlatformShadows(5, 0.3, 2, 8),
            ]}
          >
            <View style={styles.primaryCta}>
              {!study.disabled && (
                <LinearGradient
                  pointerEvents="none"
                  colors={[CYAN, CYAN_PAIR]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Zap size={scale(16)} color={study.disabled ? theme.textMuted : '#FFFFFF'} />
              <Text style={[styles.primaryCtaText, { color: study.disabled ? theme.textMuted : '#FFFFFF' }]} numberOfLines={1}>
                {study.label}
              </Text>
            </View>
          </TouchableOpacity>

          <StudyGroupButton
            ed={ed}
            theme={theme}
            canAfford={canAffordStudyGroup}
            onPress={onToggleStudyGroup}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onTogglePause}
              style={[styles.actionBtn, { flex: 1, backgroundColor: theme.surfaceElevated }]}
              accessibilityRole="button"
              accessibilityLabel={ed.paused ? 'Resume program' : 'Pause program'}
            >
              {ed.paused ? <Play size={scale(14)} color={accent.success} /> : <Pause size={scale(14)} color={accent.warning} />}
              <Text style={[styles.actionBtnText, { color: ed.paused ? accent.success : accent.warning }]}>
                {ed.paused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onWithdraw}
              style={[
                styles.actionBtn,
                { flex: 1, backgroundColor: withAlpha(accent.danger, darkMode ? 0.10 : 0.08), borderWidth: 1, borderColor: withAlpha(accent.danger, 0.30) },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Withdraw from program"
            >
              <Text style={[styles.actionBtnText, { color: accent.danger }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function DetailStat({ theme, darkMode, icon: Icon, tint, label, value, sub }: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  icon: IconType;
  tint: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View
      style={[
        getGlassCard(darkMode, 6),
        styles.detailStatCard,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
      ]}
    >
      <View style={styles.statTileHead}>
        <Icon size={scale(13)} color={tint} />
        <Text style={[styles.statTileLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.detailStatValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.detailStatSub, { color: theme.textMuted }]} numberOfLines={1}>{sub}</Text>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countPill: {
    minWidth: scale(22),
    paddingHorizontal: scale(7),
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  countPillText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
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

  // --- Hero ---
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroBlob: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroTopRow: {
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
  heroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  heroSub: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },
  heroStatStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    paddingTop: responsiveSpacing.sm,
  },
  statTile: { flex: 1, gap: 2, paddingHorizontal: scale(2) },
  statTileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTileLabel: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  statTileValue: { fontSize: responsiveFontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statDivider: { width: 1, marginHorizontal: responsiveSpacing.sm, alignSelf: 'stretch' },

  // --- Chips ---
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(6) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // --- Course card (enrolled) ---
  courseInner: { padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  courseHead: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  courseName: { fontSize: responsiveFontSize.md, fontWeight: '700' },

  // --- Catalog row ---
  catalogInner: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md, padding: responsiveSpacing.md },
  catalogDesc: { fontSize: responsiveFontSize.xs },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: scale(36),
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  enrollBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700' },

  // --- Transcript row ---
  transcriptInner: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md, padding: responsiveSpacing.md },
  credentialBadge: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Actions ---
  actionRow: { flexDirection: 'row', gap: responsiveSpacing.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: scale(38),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
  },
  actionBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // --- Detail ---
  detailHeroRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.lg },
  detailTitle: { fontSize: responsiveFontSize.xl, fontWeight: '800' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  detailStatCard: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: responsiveSpacing.md,
    gap: 4,
  },
  detailStatValue: { fontSize: responsiveFontSize.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },
  detailStatSub: { fontSize: responsiveFontSize.xs },

  classList: { padding: responsiveSpacing.md, paddingVertical: 0 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm, paddingVertical: responsiveSpacing.sm },
  classDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  className: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  classMeta: { fontSize: responsiveFontSize.xs, marginTop: 1, textTransform: 'capitalize' },
  classPending: { fontSize: responsiveFontSize.xs, fontWeight: '600' },

  loanInner: { padding: responsiveSpacing.md, gap: responsiveSpacing.md },
  loanTopRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  loanBalance: { fontSize: responsiveFontSize.xl, fontWeight: '800', fontVariant: ['tabular-nums'] },
  loanSub: { fontSize: responsiveFontSize.xs, marginTop: 1, fontVariant: ['tabular-nums'] },

  aboutText: { fontSize: responsiveFontSize.sm, lineHeight: scale(20), padding: responsiveSpacing.md },

  primaryCtaWrap: {
    borderRadius: responsiveBorderRadius.full,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: scale(48),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    paddingHorizontal: responsiveSpacing.md,
  },
  primaryCtaText: { fontSize: responsiveFontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
