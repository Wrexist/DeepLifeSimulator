/**
 * The education programme catalogue — every course a player can enrol in.
 *
 * It lived in `components/mobile/EducationApp.tsx` as a module-local `CATALOG`,
 * which made it unreachable from `lib/` (CLAUDE.md §5: `lib/` may not import
 * VALUES from `components/`). That is why the two "start with all educations"
 * prestige bonuses were dead for their whole life: with no catalogue in scope,
 * `applyUnlockBonuses` completed educations by mapping over
 * `gameState.educations` — the player's ENROLMENT list, which is `[]` at the
 * start of every life and only grows when they enrol
 * (`lib/education/operations.ts`). Mapping an empty array completes nothing, so
 * `early_education_access` (3,000 points) and `legacy_education` (15,000
 * points) were both consumed and granted exactly zero.
 *
 * `tier` is a display grouping and is carried here rather than left behind in
 * the component on purpose: a second list keyed by the same ids is a drift
 * hazard, and the accompanying test asserts the app renders every id this
 * exports.
 */

/** Presentational grouping of the catalogue. Display-only; no game logic reads it. */
export type EducationTierId =
  | 'foundation'
  | 'certificate'
  | 'undergrad'
  | 'graduate'
  | 'professional';

export interface EducationProgram {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Weeks to completion at 1x speed. */
  duration: number;
  tier: EducationTierId;
}

/** Course catalogue. Trimmed from the legacy 11 entries; tier is display-only. */
export const EDUCATION_PROGRAMS: EducationProgram[] = [
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

export const EDUCATION_TIER_ORDER: EducationTierId[] = [
  'foundation',
  'certificate',
  'undergrad',
  'graduate',
  'professional',
];

export const EDUCATION_TIER_LABEL: Record<EducationTierId, string> = {
  foundation: 'Foundational',
  certificate: 'Certificates & Academies',
  undergrad: 'Undergraduate',
  graduate: 'Graduate',
  professional: 'Professional & Doctoral',
};

export function getEducationProgram(id: string): EducationProgram | undefined {
  return EDUCATION_PROGRAMS.find(p => p.id === id);
}
