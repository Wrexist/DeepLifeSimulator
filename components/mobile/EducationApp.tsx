/**
 * EducationApp - mobile education screen.
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
 * Mechanics are unchanged - this pass only presents existing state more richly.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  GraduationCap, BookOpen, Trophy, Briefcase, Clock, Award, Pause, Play,
  ChevronRight, Plus, Shield, Scale, Gavel, Rocket, Cpu, TrendingUp, Stethoscope,
  FlaskConical, CalendarDays, Users, Zap, Banknote, BadgeCheck, CircleCheck,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Education, GameState, Loan } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import EconomyEventBanner from '@/components/shared/EconomyEventBanner';
import ProgressRing from '@/components/ui/ProgressRing';
import AppHeader, { CashChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip, { StatTile } from '@/components/ui/StatStrip';
import Chip from '@/components/ui/Chip';
import SectionTitle from '@/components/ui/SectionTitle';
import BaseModal from '@/components/ui/BaseModal';
import { Card, IconBubble } from '@/components/ui/Card';
import { useToast } from '@/contexts/ToastContext';
import EnrollModal, { EnrollTemplate } from '@/components/education/EnrollModal';
import {
  EDUCATION_PROGRAMS,
  EDUCATION_TIER_LABEL,
  EDUCATION_TIER_ORDER,
  type EducationTierId,
} from '@/lib/education/programs';
import {
  enrollInProgram,
  resolveCampusEventChoice,
  studyExtra,
  togglePauseProgram,
  toggleStudyGroup,
  withdrawFromProgram,
} from '@/contexts/game/actions/EducationActions';
import {
  STUDY_GROUP_BENEFITS,
  STUDY_GROUP_JOIN_COST,
  getRandomCampusEvent,
  type CampusEvent,
  type CampusEventChoice,
} from '@/lib/education/educationSystem';
import { highestGpa, meritGpa, gpaLetter, gpaBand, gpaBandLabel, jobOfferMultiplier, GpaBand } from '@/lib/education/gpa';
import { meritRate } from '@/lib/education/scholarships';

import { formatMoney } from '@/utils/moneyFormatting';
import { EmptyCard as EmptyText } from '@/components/ui/EmptyState';

// Education's identity colour. It was a private cyan pair (`#06B6D4` /
// `#0891B2`) that existed nowhere else in the app; it is one of the shared
// accents now, so "informational blue" means the same thing on this screen as
// it does on every other one.
const EDU = accent.info;

type IconType = React.ComponentType<{ size?: number; color?: string }>;

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
// The catalogue itself now lives in `lib/education/programs.ts`. It was moved
// there because `lib/` may not import values from `components/` (CLAUDE.md §5),
// which is what kept the two "start with all educations" prestige bonuses dead:
// with no catalogue in scope they completed the player's ENROLMENT list, which
// is empty at the start of every life.
type TierId = EducationTierId;
const TIER_ORDER: TierId[] = EDUCATION_TIER_ORDER;
const TIER_LABEL: Record<TierId, string> = EDUCATION_TIER_LABEL;

type CatalogEntry = EnrollTemplate & { tier: TierId };

const CATALOG: CatalogEntry[] = EDUCATION_PROGRAMS;

// --- Subject identity: a distinct GLYPH per programme, and a tint per FAMILY.
//
// Eleven programmes carried eleven private hexes, so the catalogue read as a
// paint chart while telling the player nothing - two law programmes shared an
// amber that meant "law" to nobody, and none of it was a colour used anywhere
// else in the app. The glyph is what makes a row recognisable; the tint now
// says which family it belongs to, in three shared accents.
const SUBJECT_ICON: Record<string, IconType> = {
  high_school: GraduationCap,
  police_academy: Shield,
  legal_studies: Scale,
  law_school: Gavel,
  entrepreneurship: Rocket,
  business_degree: Briefcase,
  computer_science: Cpu,
  masters_degree: BookOpen,
  mba: TrendingUp,
  medical_school: Stethoscope,
  phd: FlaskConical,
};
/** info = general & public service, success = business & law, purple = science. */
const SUBJECT_TINT: Record<string, string> = {
  high_school: accent.info,
  police_academy: accent.info,
  legal_studies: accent.success,
  law_school: accent.success,
  entrepreneurship: accent.success,
  business_degree: accent.success,
  mba: accent.success,
  computer_science: accent.purple,
  masters_degree: accent.purple,
  medical_school: accent.purple,
  phd: accent.purple,
};
function subjectFor(id: string): { Icon: IconType; tint: string } {
  return { Icon: SUBJECT_ICON[id] ?? GraduationCap, tint: SUBJECT_TINT[id] ?? EDU };
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
  const { showToast } = useToast();
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
  const catalogByTier = useMemo(() => {
    const groups: Record<TierId, CatalogEntry[]> = {
      foundation: [], certificate: [], undergrad: [], graduate: [], professional: [],
    };
    for (const e of availableForCatalog) groups[e.tier].push(e);
    return groups;
  }, [availableForCatalog]);

  // One memo for both GPA bases: `bestGpa` (overall - drives hiring) and
  // `scholarshipGpa` (PAID programmes only - the merit basis; the $0 High
  // School GPA farm no longer discounts tuition, see meritGpa's docblock).
  const { bestGpa, scholarshipGpa } = useMemo(
    () => ({ bestGpa: highestGpa(educations), scholarshipGpa: meritGpa(educations) }),
    [educations]
  );
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
  // one fires. The flag only carries the education id, so the UI draws the
  // concrete event ONCE when the flag appears (stable across re-renders) and
  // presents its real choices - each applies stat/money effects via
  // resolveCampusEventChoice, restoring the decision mechanic instead of the
  // old consequence-free "something happened" dismiss banner.
  const pendingCampusEventId = gameState.pendingCampusEventEducationId;
  const pendingCampusEventName = useMemo(
    () => educations.find((e) => e.id === pendingCampusEventId)?.name,
    [educations, pendingCampusEventId]
  );
  const [activeCampusEvent, setActiveCampusEvent] = useState<CampusEvent | null>(null);
  React.useEffect(() => {
    if (pendingCampusEventId) {
      setActiveCampusEvent((cur) => cur ?? getRandomCampusEvent());
    } else {
      setActiveCampusEvent(null);
    }
  }, [pendingCampusEventId]);
  const handleCampusEventChoice = useCallback((choice: CampusEventChoice) => {
    resolveCampusEventChoice(setGameState, choice);
    queueSave();
    // The outcome used to be a second hand-rolled floating card with its own
    // dismiss timer. It is one line of text with a lifetime - which is a toast,
    // and the app already has one.
    showToast(choice.resultText, 'info');
  }, [setGameState, queueSave, showToast]);

  // --- Tab bodies --------------------------------------------------------
  const renderAvailable = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {/* This tab's mandatory colourful element (the event banner) is its colour
          moment, so it carries NO Recipe B hero. */}
      <EconomyEventBanner context="generic" />
      {availableForCatalog.length === 0 ? (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Catalog" />
          <EmptyText theme={theme} darkMode={darkMode}>You&apos;ve enrolled in every program in the catalog.</EmptyText>
        </View>
      ) : (
        TIER_ORDER.map((tier) => {
          const items = catalogByTier[tier];
          if (items.length === 0) return null;
          return (
            <View key={tier} style={{ gap: responsiveSpacing.sm }}>
              <SectionTitle title={TIER_LABEL[tier]} right={<Chip label={String(items.length)} tint={EDU} />} />
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
        // Six numbers became three: the GPA a player studies to raise, how many
        // programmes are running, and what the loans cost every week. Energy is
        // on the HUD already, and the letter grade, the band and the hiring
        // multiplier are all restatements of the GPA - so they ride as its
        // sub-line and one chip rather than as three more tiles.
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <IconBubble color={EDU}>
              <GraduationCap size={scale(22)} color={EDU} />
            </IconBubble>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Academic standing</Text>
              <Text style={[styles.heroValue, { color: bestGradeColor }]}>
                {bestGpa.toFixed(2)} · {gpaLetter(bestGpa)}
              </Text>
            </View>
            <Chip
              label={gpaBandLabel(gpaBand(bestGpa))}
              icon={<Award size={scale(11)} color={bestGradeColor} />}
              tint={bestGradeColor}
            />
          </View>
          <StatStrip
            items={[
              {
                label: 'GPA',
                value: bestGpa.toFixed(2),
                tint: bestGradeColor,
                sub: `×${hiringMult.toFixed(2)} on job offers`,
              },
              { label: 'Enrolled', value: enrolled.length, tint: EDU },
              { label: 'Loans / wk', value: formatMoney(weeklyLoanPayment), tint: accent.info },
            ]}
          />
        </Card>
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
              onOpen={() => setSelectedId(e.id)}
              onStudy={() => handleStudy(e.id)}
            />
          ))
        )}
      </View>
    </View>
  );

  const renderCompleted = () => (
    <View style={{ gap: responsiveSpacing.lg }}>
      {completed.length > 0 && (
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <IconBubble color={EDU}>
              <Trophy size={scale(22)} color={EDU} />
            </IconBubble>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Transcript</Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>{completed.length}</Text>
              <Text style={[styles.heroSub, { color: theme.textMuted }]}>
                {completed.length === 1 ? 'credential earned' : 'credentials earned'}
              </Text>
            </View>
          </View>
          <StatStrip
            items={[
              { label: 'Best GPA', value: bestGpa.toFixed(2), tint: bestGradeColor },
              {
                label: 'Honors',
                value: honorsCount,
                tint: accent.success,
                sub: `${totalExamsPassed} exams passed`,
              },
            ]}
          />
        </Card>
      )}

      <View style={{ gap: responsiveSpacing.sm }}>
        {completed.length === 0 ? (
          <EmptyText theme={theme} darkMode={darkMode}>No completed programs yet.</EmptyText>
        ) : (
          <>
            <SectionTitle title="Credentials" />
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
      {/* Renders unconditionally; back returns to the list from a detail page,
          or exits the app from the tab list. The cash chip is now read out to
          screen readers, which the hand-rolled one never was. */}
      <AppHeader
        title={headerTitle}
        onBack={goBack}
        backLabel={inDetail ? 'Back to courses' : 'Back'}
        right={<CashChip value={formatMoney(cash)} tint={EDU} />}
      />

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
            scholarshipGpa={scholarshipGpa}
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
          <SegmentedControl
            style={styles.tabs}
            activeColor={EDU}
            value={activeTab}
            onChange={setActiveTab}
            segments={TABS.map((t) => ({ key: t.id, label: t.label, icon: t.icon }))}
          />

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

      {/* The campus event was a hand-rolled absolutely-positioned card - some
          48 lines of inline style reimplementing a dialog. It is a centred
          BaseModal now: same choices, same handlers, same effects. */}
      <BaseModal
        visible={!!(pendingCampusEventId && activeCampusEvent)}
        // No dismiss. The event is a decision with effects and the card it
        // replaces had no way out either; `hideCloseButton` keeps that true
        // rather than offering an X that would do nothing.
        onClose={() => {}}
        hideCloseButton
        title={activeCampusEvent?.title ?? 'Campus event'}
        subtitle={pendingCampusEventName}
        variant="center"
      >
        {activeCampusEvent ? (
          <View style={{ gap: responsiveSpacing.sm }}>
            <Text style={[styles.eventBody, { color: theme.textSecondary }]}>
              {activeCampusEvent.description}
            </Text>
            <View style={styles.actionRow}>
              {activeCampusEvent.choices.map((choice) => (
                <TouchableOpacity
                  key={choice.label}
                  onPress={() => handleCampusEventChoice(choice)}
                  accessibilityRole="button"
                  accessibilityLabel={choice.label}
                  style={[
                    styles.actionBtn,
                    {
                      flex: 1,
                      backgroundColor: withAlpha(EDU, 0.16),
                      borderWidth: 1,
                      borderColor: withAlpha(EDU, 0.35),
                    },
                  ]}
                >
                  <Text style={[styles.actionBtnText, { color: EDU }]}>{choice.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </BaseModal>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Signature components
// ---------------------------------------------------------------------------

/** Join / leave a study group - the missing writer for `studyGroupActive`.
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
  const tint = active ? accent.success : EDU;
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

/**
 * Enrolled course - the list row: ring, name, three chips, one Study button.
 *
 * Everything this card used to carry as well (the study group, Pause,
 * Withdraw, the loan balance, the exam record) is on the course page, one tap
 * away through the head. Nothing was removed - a list of three programmes was
 * offering twelve equally-weighted buttons, and the weekly action was one of
 * them.
 */
function CourseCard({ ed, theme, darkMode, study, onOpen, onStudy }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  study: StudyState;
  onOpen: () => void;
  onStudy: () => void;
}) {
  const grade = gradeInfo(ed);
  const pct = progressOf(ed);
  const { Icon: SubjIcon, tint: subjTint } = subjectFor(ed.id);
  const weeksLeft = ed.weeksRemaining ?? ed.duration;

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
            accentColor={EDU}
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
            {/* Three chips, not seven: how it is going, how long is left, and
                whether it is running at all. A paused programme says so here
                because that changes what the Study button will do. */}
            <View style={styles.chipRow}>
              <Chip label={`${grade.letter} ${grade.gpa.toFixed(2)}`} tint={grade.color} />
              <Chip icon={<Clock size={scale(11)} color={EDU} />} label={`${weeksLeft}w left`} tint={EDU} />
              {ed.paused ? (
                <Chip icon={<Pause size={scale(11)} color={accent.warning} />} label="Paused" tint={accent.warning} />
              ) : (
                <Chip icon={<CalendarDays size={scale(11)} color={theme.textMuted} />} label={`Sem ${ed.semesterNumber ?? 1}`} />
              )}
            </View>
          </View>

          <ChevronRight size={scale(18)} color={theme.textMuted} />
        </TouchableOpacity>

        {/* ONE action on the card - the one taken every week. Study spans the
            full row so its gated label (sessions / energy / reason) stays
            legible. */}
        <TouchableOpacity
          disabled={study.disabled}
          onPress={onStudy}
          style={[
            styles.actionBtn,
            study.disabled
              ? { backgroundColor: theme.surfaceElevated }
              : { backgroundColor: withAlpha(EDU, 0.16), borderWidth: 1, borderColor: withAlpha(EDU, 0.30) },
          ]}
          accessibilityRole="button"
          accessibilityLabel={study.label}
          accessibilityState={{ disabled: study.disabled }}
        >
          <Zap size={scale(14)} color={study.disabled ? theme.textMuted : EDU} />
          <Text style={[styles.actionBtnText, { color: study.disabled ? theme.textMuted : EDU }]} numberOfLines={1}>
            {study.label}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Catalog directory row - subject glyph, tuition + duration chips, Enroll button. */
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
        <IconBubble color={subjectFor(entry.id).tint} style={styles.bubble44}>
          {React.createElement(subjectFor(entry.id).Icon, { size: scale(19), color: subjectFor(entry.id).tint })}
        </IconBubble>
        <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
          <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>{entry.name}</Text>
          <Text style={[styles.catalogDesc, { color: theme.textMuted }]} numberOfLines={1}>{entry.description}</Text>
          <View style={styles.chipRow}>
            <Chip
              icon={<Banknote size={scale(11)} color={entry.cost === 0 ? accent.success : EDU} />}
              label={entry.cost === 0 ? 'Free' : formatMoney(entry.cost)}
              tint={entry.cost === 0 ? accent.success : EDU}
            />
            <Chip icon={<Clock size={scale(11)} color={theme.textMuted} />} label={formatDuration(entry.duration)} />
          </View>
        </View>
        <View
          style={[
            styles.enrollBtn,
            { backgroundColor: withAlpha(EDU, 0.16), borderColor: withAlpha(EDU, 0.32) },
          ]}
        >
          <Plus size={scale(13)} color={EDU} />
          <Text style={[styles.enrollBtnText, { color: EDU }]}>{canAfford ? 'Enroll' : 'Options'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Completed credential - transcript row: subject, GPA, band + credential badge. */
function TranscriptRow({ ed, theme, darkMode, onOpen }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  onOpen: () => void;
}) {
  const grade = gradeInfo(ed);
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
        <IconBubble color={subjectFor(ed.id).tint} style={styles.bubble44}>
          {React.createElement(subjectFor(ed.id).Icon, { size: scale(19), color: subjectFor(ed.id).tint })}
        </IconBubble>
        <View style={{ flex: 1, gap: responsiveSpacing.xs }}>
          <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>{ed.name}</Text>
          <View style={styles.chipRow}>
            <Chip
              icon={<Award size={scale(11)} color={grade.color} />}
              label={grade.noRecord ? 'Graduated' : `${grade.letter} ${grade.gpa.toFixed(2)}`}
              tint={grade.color}
            />
            <Chip label={grade.noRecord ? 'On record' : grade.label} tint={grade.color} />
            {/* Was "3✓ / 1✗" - two glyphs doing the work of two words, at a
                size where they are hard to tell apart. */}
            {(ed.examsPassed ?? 0) > 0 && <Chip tone="success" label={`${ed.examsPassed} passed`} />}
            {(ed.examsFailed ?? 0) > 0 && <Chip tone="danger" label={`${ed.examsFailed} failed`} />}
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
function CourseDetail({ ed, theme, darkMode, bestGpa, scholarshipGpa, study, loan, onStudy, onTogglePause, onToggleStudyGroup, onWithdraw, canAffordStudyGroup }: {
  ed: Education;
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  bestGpa: number;
  /** Best GPA among PAID programmes - the merit-scholarship basis. */
  scholarshipGpa: number;
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
  // Same basis the enrolment quote charges (meritGpa - paid programmes only),
  // so the advertised rate equals the applied rate.
  const currentMerit = Math.round(meritRate(scholarshipGpa) * 100);
  const classes = ed.enrolledClasses ?? [];

  return (
    <View style={{ gap: responsiveSpacing.lg }}>
      <Card style={styles.heroCard}>
        <View style={styles.detailHeroRow}>
          <ProgressRing
            value={pct * 100}
            size={104}
            strokeWidth={8}
            state={ed.completed ? 'done' : 'active'}
            accentColor={EDU}
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
              <Chip icon={<Award size={scale(11)} color={grade.color} />} label={grade.noRecord ? 'Graduated' : `${grade.letter} ${grade.gpa.toFixed(2)}`} tint={grade.color} />
              <Chip label={grade.noRecord ? 'On record' : grade.label} tint={grade.color} />
            </View>
            {ed.completed ? (
              <View style={styles.chipRow}>
                <Chip icon={<BadgeCheck size={scale(11)} color={accent.success} />} label="Earned" tint={accent.success} />
              </View>
            ) : (
              <View style={styles.chipRow}>
                <Chip icon={<Clock size={scale(11)} color={EDU} />} label={`${weeksLeft}w left`} tint={EDU} />
                <Chip icon={<CalendarDays size={scale(11)} color={theme.textMuted} />} label={`Sem ${ed.semesterNumber ?? 1}`} />
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* Stat grid - surfaces record fields the list rows can't fit. */}
      <View style={styles.detailGrid}>
        <DetailCard theme={theme} darkMode={darkMode}>
          <StatTile align="left" tint={EDU} label="Progress" value={`${Math.round(pct * 100)}%`} sub={`${weeksLeft}w of ${ed.duration}w`} />
        </DetailCard>
        <DetailCard theme={theme} darkMode={darkMode}>
          <StatTile align="left" tint={grade.color} label="GPA" value={grade.noRecord ? '-' : grade.gpa.toFixed(2)} sub={grade.noRecord ? 'no grade on file' : `${grade.letter} · ${grade.label}`} />
        </DetailCard>
        <DetailCard theme={theme} darkMode={darkMode}>
          <StatTile
            align="left"
            tint={accent.info}
            label="Exams"
            value={exams > 0 ? `${passed} of ${exams}` : 'None yet'}
            sub={passRate != null ? `${passRate}% pass rate` : 'no exams taken'}
          />
        </DetailCard>
        <DetailCard theme={theme} darkMode={darkMode}>
          <StatTile align="left" tint={accent.purple} label="Semester" value={String(ed.semesterNumber ?? 1)} sub={ed.studyGroupActive ? 'study group active' : 'solo study'} />
        </DetailCard>
        {!ed.completed && (
          <DetailCard theme={theme} darkMode={darkMode}>
            <StatTile align="left" tint={accent.warning} label="Study budget" value={`${study.sessionsThisWeek}/3`} sub="sessions this week" />
          </DetailCard>
        )}
        <DetailCard theme={theme} darkMode={darkMode}>
          <StatTile align="left" tint={accent.success} label="Scholarship rate" value={`${currentMerit}%`} sub="at your best paid-programme GPA" />
        </DetailCard>
      </View>

      {/* Enrolled classes - richest previously-hidden data. */}
      {classes.length > 0 && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Classes" right={<Chip label={String(classes.length)} tint={EDU} />} />
          <View
            style={[
              getGlassCard(darkMode, 6),
              { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
            ]}
          >
            <View style={styles.classList}>
              {classes.map((c, i) => (
                <View key={c.id} style={[styles.classRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <View style={[styles.classDot, { backgroundColor: c.completed ? accent.success : withAlpha(EDU, 0.5) }]} />
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

      {/* Linked student loan - cross-system readout (routed through the bank). */}
      {loan && (
        <View style={{ gap: responsiveSpacing.sm }}>
          <SectionTitle title="Student loan" />
          <View
            style={[
              getGlassCard(darkMode, 6),
              { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
            ]}
          >
            <View style={styles.loanInner}>
              <View style={styles.loanTopRow}>
                <IconBubble color={accent.info}>
                  <Banknote size={scale(18)} color={accent.info} />
                </IconBubble>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.loanBalance, { color: theme.text }]}>{formatMoney(loan.remaining)}</Text>
                  <Text style={[styles.loanSub, { color: theme.textMuted }]}>remaining of {formatMoney(loan.principal)}</Text>
                </View>
                {loan.autoPay && <Chip icon={<CircleCheck size={scale(11)} color={accent.success} />} label="Auto-pay" tint={accent.success} />}
              </View>
              <StatStrip
                items={[
                  { label: 'Weekly', value: formatMoney(loan.weeklyPayment), tint: accent.info },
                  { label: 'APR', value: `${(loan.rateAPR * 100).toFixed(1)}%`, tint: accent.warning },
                  { label: 'Weeks left', value: loan.weeksRemaining, tint: EDU },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* Description */}
      <View style={{ gap: responsiveSpacing.sm }}>
        <SectionTitle title="About" />
        <View
          style={[
            getGlassCard(darkMode, 6),
            { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
          ]}
        >
          <Text style={[styles.aboutText, { color: theme.textSecondary }]}>{ed.description}</Text>
        </View>
      </View>

      {/* Actions - only for in-progress programmes. */}
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
              { backgroundColor: study.disabled ? theme.surfaceElevated : EDU },
              !study.disabled && getPlatformShadows(5, 0.3, 2, 8),
            ]}
          >
            {/* The wrap above carries the solid fill; the gradient that used to
                sit here ran from the identity colour to a second shade of
                itself, which is decoration on a button that is already one
                colour. */}
            <View style={styles.primaryCta}>
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
          {/**
           * C-12. The button asked for money and named no benefit, which is
           * partly why nobody noticed `extraProgress` was never wired up. Read
           * from the constant so the copy cannot drift from the effect.
           */}
          <Text style={[styles.aboutText, { color: theme.textMuted }]}>
            {`Study group: +${Math.round(STUDY_GROUP_BENEFITS.examBonus * 100)}% exam pass chance, `}
            {`+${STUDY_GROUP_BENEFITS.extraProgress} extra week per study session, `}
            {`+${STUDY_GROUP_BENEFITS.weeklyHappiness} happiness and `}
            {`−${STUDY_GROUP_BENEFITS.weeklyEnergyCost} energy each week.`}
          </Text>

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

/** The card shell around one detail statistic. */
function DetailCard({ theme, darkMode, children }: {
  theme: ReturnType<typeof getThemeColors>;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        getGlassCard(darkMode, 6),
        styles.detailStatCard,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
      ]}
    >
      {children}
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
  // The segmented control sits directly under the header, which anchors the
  // screen - so the header carries no bottom border.
  tabs: {
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },

  // --- Hero ---
  // The shared Card, minus its own outer margins: this screen's ScrollView
  // already pads the content.
  heroCard: { marginHorizontal: 0, marginBottom: 0 },
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
  heroValue: { fontSize: responsiveFontSize['3xl'], fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: responsiveFontSize.xs, fontVariant: ['tabular-nums'] },

  // Subject bubble box; IconBubble owns the tint recipe.
  bubble44: { width: scale(44), height: scale(44) },

  // --- Chips ---
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(6) },

  // --- Course card (enrolled) ---
  courseInner: { padding: responsiveSpacing.md, gap: responsiveSpacing.sm },
  courseHead: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  courseName: { fontSize: responsiveFontSize.md, fontWeight: '600' },

  // --- Catalog row ---
  catalogInner: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md, padding: responsiveSpacing.md },
  catalogDesc: { fontSize: responsiveFontSize.xs },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  enrollBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600' },

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
    minHeight: touchTargets.minimum,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.lg,
  },
  actionBtnText: { fontSize: responsiveFontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // --- Detail ---
  detailHeroRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.lg },
  detailTitle: { fontSize: responsiveFontSize.xl, fontWeight: '700' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing.sm },
  detailStatCard: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: responsiveSpacing.md,
    gap: 4,
  },

  classList: { padding: responsiveSpacing.md, paddingVertical: 0 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm, paddingVertical: responsiveSpacing.sm },
  classDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  className: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  classMeta: { fontSize: responsiveFontSize.xs, marginTop: 1, textTransform: 'capitalize' },
  classPending: { fontSize: responsiveFontSize.xs, fontWeight: '600' },

  loanInner: { padding: responsiveSpacing.md, gap: responsiveSpacing.md },
  loanTopRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.md },
  loanBalance: { fontSize: responsiveFontSize.xl, fontWeight: '700', fontVariant: ['tabular-nums'] },
  loanSub: { fontSize: responsiveFontSize.xs, marginTop: 1, fontVariant: ['tabular-nums'] },

  aboutText: { fontSize: responsiveFontSize.sm, lineHeight: scale(20), padding: responsiveSpacing.md },
  // The same body copy inside a modal, which brings its own padding.
  eventBody: { fontSize: responsiveFontSize.sm, lineHeight: scale(20) },

  primaryCtaWrap: { borderRadius: responsiveBorderRadius.full },
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
  primaryCtaText: { fontSize: responsiveFontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
