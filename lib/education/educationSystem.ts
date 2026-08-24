/**
 * Education System — Classes, Exams, Study Groups, Campus Events
 *
 * Enhances the existing education system with engaging gameplay:
 *  - Class choices per semester with stat bonuses
 *  - Periodic exam skill checks (pass/fail)
 *  - Study groups for social bonding + progression boost
 *  - Student loan option for enrollment
 *  - Random campus life events
 */

import { Education, EducationClass } from '@/contexts/game/types';
import { calculatePeriodicPayment } from '@/lib/banking/amortization';
import { STUDENT_LOAN_APR } from '@/lib/config/gameConstants';

// ─── Class Definitions ────────────────────────────────────────────────────

export interface ClassTemplate {
  id: string;
  name: string;
  category: EducationClass['category'];
  statBonuses: EducationClass['statBonuses'];
  difficulty: EducationClass['difficulty'];
  /** Which education programs offer this class */
  availableIn: string[];
  description: string;
}

export const CLASS_TEMPLATES: ClassTemplate[] = [
  // Core classes
  {
    id: 'intro_writing',
    name: 'Academic Writing',
    category: 'core',
    statBonuses: { reputation: 2 },
    difficulty: 1,
    availableIn: ['high_school', 'business_degree', 'legal_studies'],
    description: 'Learn to write clearly and persuasively.',
  },
  {
    id: 'math_fundamentals',
    name: 'Mathematics',
    category: 'core',
    statBonuses: { reputation: 3 },
    difficulty: 2,
    availableIn: ['high_school', 'computer_science', 'business_degree'],
    description: 'Numbers, logic, and problem-solving.',
  },
  {
    id: 'public_speaking',
    name: 'Public Speaking',
    category: 'core',
    statBonuses: { reputation: 4, happiness: 1 },
    difficulty: 2,
    availableIn: ['business_degree', 'mba', 'law_school', 'legal_studies'],
    description: 'Master the art of presenting ideas confidently.',
  },
  {
    id: 'biology_101',
    name: 'Biology 101',
    category: 'core',
    statBonuses: { health: 3 },
    difficulty: 2,
    availableIn: ['high_school', 'medical_school'],
    description: 'The foundations of life science.',
  },
  {
    id: 'organic_chemistry',
    name: 'Organic Chemistry',
    category: 'core',
    statBonuses: { health: 2, reputation: 2 },
    difficulty: 3,
    availableIn: ['medical_school', 'phd'],
    description: 'The dreaded "orgo" - a rite of passage.',
  },
  {
    id: 'data_structures',
    name: 'Data Structures',
    category: 'core',
    statBonuses: { reputation: 4 },
    difficulty: 3,
    availableIn: ['computer_science', 'masters_degree'],
    description: 'Arrays, trees, graphs - the building blocks of software.',
  },
  {
    id: 'constitutional_law',
    name: 'Constitutional Law',
    category: 'core',
    statBonuses: { reputation: 5 },
    difficulty: 3,
    availableIn: ['law_school', 'legal_studies'],
    description: 'The supreme laws of the land.',
  },
  {
    id: 'corporate_finance',
    name: 'Corporate Finance',
    category: 'core',
    statBonuses: { reputation: 3 },
    difficulty: 2,
    availableIn: ['business_degree', 'mba', 'entrepreneurship'],
    description: 'How money moves through businesses.',
  },
  {
    id: 'anatomy',
    name: 'Human Anatomy',
    category: 'core',
    statBonuses: { health: 4, fitness: 1 },
    difficulty: 3,
    availableIn: ['medical_school', 'phd'],
    description: 'Know every bone, muscle, and organ.',
  },
  {
    id: 'criminal_justice',
    name: 'Criminal Justice',
    category: 'core',
    statBonuses: { reputation: 3 },
    difficulty: 2,
    availableIn: ['police_academy', 'law_school'],
    description: 'Understanding crime, punishment, and justice.',
  },

  // Elective classes
  {
    id: 'yoga_wellness',
    name: 'Yoga & Wellness',
    category: 'elective',
    statBonuses: { health: 3, happiness: 3, fitness: 2 },
    difficulty: 1,
    availableIn: ['high_school', 'business_degree', 'medical_school', 'computer_science', 'mba', 'law_school', 'phd', 'masters_degree'],
    description: 'Breathe, stretch, find inner peace.',
  },
  {
    id: 'creative_arts',
    name: 'Creative Arts',
    category: 'elective',
    statBonuses: { happiness: 5 },
    difficulty: 1,
    availableIn: ['high_school', 'business_degree', 'computer_science', 'mba'],
    description: 'Express yourself through painting, sculpture, or music.',
  },
  {
    id: 'debate_club',
    name: 'Debate & Rhetoric',
    category: 'elective',
    statBonuses: { reputation: 5 },
    difficulty: 2,
    availableIn: ['law_school', 'mba', 'business_degree', 'legal_studies'],
    description: 'Argue your point with style and substance.',
  },
  {
    id: 'sports_management',
    name: 'Sports Management',
    category: 'elective',
    statBonuses: { fitness: 3, reputation: 2 },
    difficulty: 1,
    availableIn: ['business_degree', 'mba', 'high_school'],
    description: 'The business side of athletics.',
  },
  {
    id: 'machine_learning',
    name: 'Machine Learning',
    category: 'elective',
    statBonuses: { reputation: 6 },
    difficulty: 3,
    availableIn: ['computer_science', 'masters_degree', 'phd'],
    description: 'Teach computers to learn from data.',
  },
  {
    id: 'leadership',
    name: 'Leadership Seminar',
    category: 'seminar',
    statBonuses: { reputation: 4, happiness: 2 },
    difficulty: 2,
    availableIn: ['mba', 'business_degree', 'police_academy', 'entrepreneurship'],
    description: 'Develop the skills to lead teams and organizations.',
  },

  // Lab classes
  {
    id: 'chemistry_lab',
    name: 'Chemistry Lab',
    category: 'lab',
    statBonuses: { health: 2, reputation: 2 },
    difficulty: 2,
    availableIn: ['medical_school', 'phd', 'high_school'],
    description: 'Hands-on experiments with volatile chemicals.',
  },
  {
    id: 'programming_lab',
    name: 'Programming Lab',
    category: 'lab',
    statBonuses: { reputation: 3 },
    difficulty: 2,
    availableIn: ['computer_science', 'masters_degree'],
    description: 'Build real software projects.',
  },
  {
    id: 'clinical_rotation',
    name: 'Clinical Rotation',
    category: 'lab',
    statBonuses: { health: 3, reputation: 3 },
    difficulty: 3,
    availableIn: ['medical_school'],
    description: 'Shadow doctors and treat real patients.',
  },
  {
    id: 'moot_court',
    name: 'Moot Court',
    category: 'lab',
    statBonuses: { reputation: 5 },
    difficulty: 3,
    availableIn: ['law_school'],
    description: 'Practice arguing cases in a simulated courtroom.',
  },
];

/**
 * Get available classes for a specific education program.
 * Returns 3-4 classes the player can choose from this semester.
 */
export function getAvailableClasses(educationId: string, alreadyTaken: string[]): ClassTemplate[] {
  const available = CLASS_TEMPLATES.filter(
    c => c.availableIn.includes(educationId) && !alreadyTaken.includes(c.id)
  );

  // Shuffle and pick 3-4 options
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(4, shuffled.length));
}

/**
 * How many classes a player may enrol in per semester. Kept small (2-3) so the
 * summed `statBonuses` stay a modest completion perk, not an economy lever.
 */
export const MIN_CLASSES_PER_SEMESTER = 2;
export const MAX_CLASSES_PER_SEMESTER = 3;

/**
 * Map a set of chosen class ids to concrete `EducationClass[]` for a program.
 *
 * Pure + deterministic (no `Math.random`, unlike `getAvailableClasses`) so it is
 * safe inside a `setGameState` updater under React StrictMode double-invocation.
 * Ids not offered by the program (`availableIn`) or duplicates are dropped, and
 * the result is capped at `MAX_CLASSES_PER_SEMESTER`. Each class starts
 * `completed: false`; the weekly tick applies its `statBonuses` on graduation.
 */
export function mapClassIdsToEnrolled(educationId: string, classIds: string[]): EducationClass[] {
  const seen = new Set<string>();
  const out: EducationClass[] = [];
  for (const id of classIds || []) {
    if (seen.has(id)) continue;
    const tpl = CLASS_TEMPLATES.find(c => c.id === id && c.availableIn.includes(educationId));
    if (!tpl) continue;
    seen.add(id);
    out.push({
      id: tpl.id,
      name: tpl.name,
      category: tpl.category,
      statBonuses: tpl.statBonuses,
      difficulty: tpl.difficulty,
      completed: false,
    });
    if (out.length >= MAX_CLASSES_PER_SEMESTER) break;
  }
  return out;
}

// ─── Exam System ──────────────────────────────────────────────────────────

export interface ExamResult {
  passed: boolean;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gpaChange: number;
  message: string;
  statChanges: Partial<Record<'happiness' | 'energy' | 'reputation', number>>;
}

/**
 * Run an exam check for the current education.
 * Pass chance depends on: study group, class difficulty, existing GPA, energy level.
 */
export function runExam(
  education: Education,
  currentEnergy: number,
  hasStudyGroup: boolean,
  /**
   * Life Skills exam bonus (Critical Thinking / Memory Palace / Polymath).
   * Additive to pass chance BEFORE the clamp, so it can't push past the 0.95
   * ceiling. Bounded [0, 0.3] by the accessor; defaults to 0 (neutral).
   */
  lifeSkillPassBonus: number = 0,
  /**
   * Optional seeded roll source, threaded from the deterministic weekly tick
   * (`applyEducationProgression`) so the same state + week yields byte-identical
   * exam outcomes across engines/reloads (no save-scum reroll). Each distinct
   * label returns an independent [0,1) value. Falls back to `Math.random()` for
   * live / non-tick callers.
   */
  rollFn?: (label: string) => number,
): ExamResult {
  const rand = (label: string): number =>
    rollFn ? rollFn(label) : Math.random();
  const difficulty = getAverageDifficulty(education.enrolledClasses || []);
  const gpa = education.gpa || 2.0;

  // Base pass chance: 60%
  let passChance = 0.60;

  // Study group bonus. Read from the constant rather than repeating 0.15:
  // three of STUDY_GROUP_BENEFITS' four values were shadowed by magic numbers
  // like this one, so editing the constant changed nothing (C-12). Declared
  // below in module order, which is fine — this runs at call time, not init.
  if (hasStudyGroup) passChance += STUDY_GROUP_BENEFITS.examBonus;

  // Energy bonus: +10% if above 50, -10% if below 30
  if (currentEnergy >= 50) passChance += 0.10;
  else if (currentEnergy < 30) passChance -= 0.10;

  // GPA bonus: existing good grades help
  if (gpa >= 3.0) passChance += 0.10;
  else if (gpa < 2.0) passChance -= 0.05;

  // Difficulty penalty
  if (difficulty >= 2.5) passChance -= 0.10;
  else if (difficulty <= 1.5) passChance += 0.10;

  // Life Skills: study effectiveness / retention bonus (bounded, additive).
  if (typeof lifeSkillPassBonus === 'number' && isFinite(lifeSkillPassBonus) && lifeSkillPassBonus > 0) {
    passChance += Math.min(0.3, lifeSkillPassBonus);
  }

  // Clamp
  passChance = Math.max(0.15, Math.min(0.95, passChance));

  const roll = rand('pass');
  const passed = roll < passChance;

  // Determine letter grade
  let grade: ExamResult['grade'];
  let gpaChange: number;

  if (passed) {
    const gradeRoll = rand('grade');
    if (gradeRoll < 0.20) {
      grade = 'A';
      gpaChange = 0.3;
    } else if (gradeRoll < 0.55) {
      grade = 'B';
      gpaChange = 0.15;
    } else {
      grade = 'C';
      gpaChange = 0.05;
    }
  } else {
    const failRoll = rand('fail');
    if (failRoll < 0.6) {
      grade = 'D';
      gpaChange = -0.1;
    } else {
      grade = 'F';
      gpaChange = -0.25;
    }
  }

  const messages: Record<string, string[]> = {
    A: ['Aced it! Top of the class!', 'Perfect score - the professor is impressed.'],
    B: ['Solid performance. Well done.', 'Good grade - your hard work paid off.'],
    C: ['Passed, but barely. Room for improvement.', 'Average - could do better next time.'],
    D: ['Struggling. Need to study harder.', 'Barely hanging on.'],
    F: ['Failed the exam. Time to reconsider your approach.', 'Bombed it. That was rough.'],
  };

  const msgList = messages[grade];
  const message = msgList[Math.floor(rand('message') * msgList.length)];

  const statChanges: ExamResult['statChanges'] = {};
  if (grade === 'A') {
    statChanges.happiness = 8;
    statChanges.reputation = 3;
  } else if (grade === 'B') {
    statChanges.happiness = 4;
    statChanges.reputation = 1;
  } else if (grade === 'D') {
    statChanges.happiness = -5;
  } else if (grade === 'F') {
    statChanges.happiness = -10;
    statChanges.reputation = -2;
  }
  statChanges.energy = -10; // Exams are draining

  return { passed, grade, gpaChange, message, statChanges };
}

function getAverageDifficulty(classes: EducationClass[]): number {
  if (classes.length === 0) return 2;
  return classes.reduce((sum, c) => sum + c.difficulty, 0) / classes.length;
}

// ─── Campus Events ────────────────────────────────────────────────────────

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  choices: CampusEventChoice[];
}

export interface CampusEventChoice {
  label: string;
  effects: Partial<Record<'happiness' | 'health' | 'energy' | 'reputation' | 'money', number>>;
  resultText: string;
}

const CAMPUS_EVENTS: CampusEvent[] = [
  {
    id: 'dorm_party',
    title: 'Dorm Party',
    description: 'Your roommate is throwing a party tonight. The music is already loud.',
    choices: [
      {
        label: 'Join the party',
        effects: { happiness: 10, energy: -15, health: -5 },
        resultText: 'You had a blast! But your head hurts this morning...',
      },
      {
        label: 'Stay in and study',
        effects: { happiness: -3, energy: -5, reputation: 2 },
        resultText: 'You got ahead on coursework. The noise was annoying though.',
      },
    ],
  },
  {
    id: 'study_marathon',
    title: 'Study Marathon',
    description: 'Finals are coming. The library is packed with stressed students.',
    choices: [
      {
        label: 'Pull an all-nighter',
        effects: { energy: -25, reputation: 3 },
        resultText: 'You covered all the material but you\'re exhausted.',
      },
      {
        label: 'Study with friends',
        effects: { happiness: 5, energy: -10, reputation: 1 },
        resultText: 'Group studying helped! You feel more prepared.',
      },
    ],
  },
  {
    id: 'professor_opportunity',
    title: 'Research Opportunity',
    description: 'A professor noticed your work and offers a research assistant position.',
    choices: [
      {
        label: 'Accept the position',
        effects: { reputation: 8, energy: -10, money: 200 },
        resultText: 'Great experience and a small stipend. Your resume looks better.',
      },
      {
        label: 'Politely decline',
        effects: { happiness: 3 },
        resultText: 'You chose to focus on your own priorities.',
      },
    ],
  },
  {
    id: 'campus_sport',
    title: 'Intramural Sports',
    description: 'Sign-ups for intramural basketball are open.',
    choices: [
      {
        label: 'Join the team',
        effects: { health: 5, happiness: 5, energy: -10 },
        resultText: 'Great exercise and you made some friends on the team!',
      },
      {
        label: 'Watch from the stands',
        effects: { happiness: 2 },
        resultText: 'Fun to watch. Maybe next semester.',
      },
    ],
  },
  {
    id: 'internship_offer',
    title: 'Internship Offer',
    description: 'A company is recruiting interns on campus. The pay is decent.',
    choices: [
      {
        label: 'Apply for the internship',
        effects: { reputation: 6, money: 500, energy: -15 },
        resultText: 'You got it! Real-world experience and some cash.',
      },
      {
        label: 'Focus on classes instead',
        effects: { reputation: 1 },
        resultText: 'You decided academics come first.',
      },
    ],
  },
  {
    id: 'cafeteria_food',
    title: 'Cafeteria Mystery Meat',
    description: 'The cafeteria is serving something... questionable today.',
    choices: [
      {
        label: 'Eat it anyway',
        effects: { health: -5, happiness: -3, money: 0 },
        resultText: 'Your stomach regrets that decision.',
      },
      {
        label: 'Order delivery instead',
        effects: { happiness: 3, money: -25 },
        resultText: 'Pizza saves the day. Your wallet, not so much.',
      },
    ],
  },
  {
    id: 'campus_protest',
    title: 'Campus Rally',
    description: 'Students are organizing a rally for a cause you care about.',
    choices: [
      {
        label: 'Join the rally',
        effects: { happiness: 5, reputation: 4, energy: -10 },
        resultText: 'You felt empowered standing with your peers.',
      },
      {
        label: 'Keep walking to class',
        effects: { energy: -2 },
        resultText: 'You focused on your studies instead.',
      },
    ],
  },
  {
    id: 'tutoring_request',
    title: 'Tutoring Request',
    description: 'A struggling classmate asks if you can help them study.',
    choices: [
      {
        label: 'Help them out',
        effects: { happiness: 5, reputation: 3, energy: -8 },
        resultText: 'They passed their test! Teaching reinforced your own understanding.',
      },
      {
        label: 'Too busy, sorry',
        effects: { happiness: -2 },
        resultText: 'You felt a little guilty but you had your own work.',
      },
    ],
  },
];

/**
 * Get a random campus event.
 */
export function getRandomCampusEvent(): CampusEvent {
  return CAMPUS_EVENTS[Math.floor(Math.random() * CAMPUS_EVENTS.length)];
}

// ─── Student Loan System ──────────────────────────────────────────────────

export interface StudentLoanOffer {
  amount: number;
  interestRate: number; // annual
  termWeeks: number;
  weeklyPayment: number;
}

/**
 * Calculate a student loan offer for an education program.
 * Covers 80-100% of tuition with reasonable interest.
 *
 * NOTE: the LIVE enrolment path (`EducationActions.enrollInProgram`) issues real
 * loans through the banking system (6% / 10-year). This helper is retained for
 * the lighter standalone quote, but now shares the ONE amortization
 * implementation (`calculatePeriodicPayment`) instead of a hand-rolled formula —
 * so the two paths can no longer drift in their payment math.
 */
export function calculateStudentLoan(educationCost: number): StudentLoanOffer {
  const amount = Math.max(0, educationCost); // Full coverage
  const annualRate = STUDENT_LOAN_APR; // 4.5% annual interest
  const termWeeks = 260; // ~5 years to repay
  const weeklyPayment = Math.ceil(calculatePeriodicPayment(amount, annualRate, termWeeks));

  return { amount, interestRate: annualRate, termWeeks, weeklyPayment };
}

// ─── Study Group ──────────────────────────────────────────────────────────

/**
 * Study group provides:
 *  - +15% exam pass chance
 *  - +1 extra week progress per study action
 *  - Small happiness boost per week (+2)
 *  - Costs: small energy drain (-3/week)
 */
export const STUDY_GROUP_BENEFITS = {
  examBonus: 0.15,
  extraProgress: 1,
  weeklyHappiness: 2,
  weeklyEnergyCost: 3,
};

/**
 * One-time cost to join a course's study group. Keeps the +2 happiness/wk +
 * exam boost a tradeoff (materials/dues) rather than a free happiness tap; the
 * −3 energy/wk already offsets the ongoing benefit.
 */
export const STUDY_GROUP_JOIN_COST = 150;

// ─── GPA Calculation ──────────────────────────────────────────────────────

/**
 * Update GPA with a new exam result.
 * Uses running weighted average capped at [0.0, 4.0].
 */
export function updateGPA(currentGPA: number, examCount: number, gpaChange: number): number {
  const totalExams = Math.max(1, examCount);
  // Weighted: old GPA contributes (totalExams-1) weight, new change contributes 1 weight
  const newGPA = ((currentGPA * (totalExams - 1)) + (currentGPA + gpaChange)) / totalExams;
  return Math.max(0.0, Math.min(4.0, Math.round(newGPA * 100) / 100));
}

// ─── Exam Scheduling ──────────────────────────────────────────────────────

/** A semester is ~half a year of study. */
export const SEMESTER_LENGTH_WEEKS = 26;

/**
 * Derive the current semester purely from progress (duration vs weeksRemaining),
 * NOT an accumulator or wall-clock — so it is idempotent, never advances while a
 * program is paused (weeksRemaining is frozen), and freezes at the final semester
 * on completion. Capped at `ceil(duration / SEMESTER_LENGTH_WEEKS)` so a program
 * never reports more semesters than its length implies.
 */
export function computeSemesterNumber(duration: number, weeksRemaining: number | undefined): number {
  const dur = Math.max(1, Math.floor(duration));
  const remaining = Math.max(0, Math.min(dur, Math.floor(weeksRemaining ?? dur)));
  const elapsed = dur - remaining;
  const maxSemester = Math.max(1, Math.ceil(dur / SEMESTER_LENGTH_WEEKS));
  return Math.min(maxSemester, Math.floor(elapsed / SEMESTER_LENGTH_WEEKS) + 1);
}

/** Exams happen every 13 weeks (~one semester quarter). */
export const EXAM_INTERVAL_WEEKS = 13;

/** Campus events happen every 4-8 weeks. */
export const CAMPUS_EVENT_MIN_INTERVAL = 4;
export const CAMPUS_EVENT_MAX_INTERVAL = 8;

/**
 * Check if it's time for an exam.
 */
export function isExamWeek(education: Education, currentWeeksLived: number): boolean {
  // `<= 0` (not a falsy check) so NEGATIVE weeksRemaining — a corrupt/exhausted
  // save being finalize-only recovered by the weekly tick — can't fire a stray
  // exam: -3 is truthy, so a plain falsy check lets it through.
  if ((education.weeksRemaining ?? 0) <= 0 || education.completed || education.paused) return false;
  const lastExam = education.lastExamWeek || 0;
  return (currentWeeksLived - lastExam) >= EXAM_INTERVAL_WEEKS;
}

/**
 * Check if a campus event should trigger.
 */
export function shouldTriggerCampusEvent(
  education: Education,
  currentWeeksLived: number,
  /**
   * Optional seeded [0,1) roll threaded from the deterministic weekly tick so
   * the same state + week is byte-identical across engines/reloads. Falls back
   * to `Math.random()` for live / non-tick callers.
   */
  roll?: number,
): boolean {
  // Same `<= 0` guard as isExamWeek: negative weeksRemaining (corrupt save in
  // finalize-only recovery) must not spawn campus events.
  if ((education.weeksRemaining ?? 0) <= 0 || education.completed || education.paused) return false;
  const lastEvent = education.lastCampusEventWeek || 0;
  const weeksSinceEvent = currentWeeksLived - lastEvent;
  if (weeksSinceEvent < CAMPUS_EVENT_MIN_INTERVAL) return false;
  // Random chance increases as time passes
  const chance = Math.min(0.5, (weeksSinceEvent - CAMPUS_EVENT_MIN_INTERVAL) * 0.1);
  return (typeof roll === 'number' ? roll : Math.random()) < chance;
}
