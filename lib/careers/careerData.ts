import { Career } from '@/contexts/game/types';

/**
 * ── Salary scale ──────────────────────────────────────────────────────────
 *
 * Every `salary` here is WEEKLY.
 *
 * The advanced ladders in `advancedCareers.ts` are authored as annual÷52 and say
 * so (`salary: 3850, // ~$200k/yr`); these were not, and sat far below that
 * basis — a Line Cook read $40/week, $2 080 a year, beside a $95 000 studio.
 * Entry doctor to entry cook was 34:1 where reality is nearer 2:1, so the whole
 * sub-professional half of the tree was economically irrelevant.
 *
 * Rescaled by ONE rule, so the result is auditable rather than hand-tuned:
 *
 *   lifted = originalTop x (MIN_ENTRY_WEEKLY_SALARY / originalEntry)
 *   top    = max(originalTop, CEILING x (1 - e^(-lifted / CEILING)))
 *   entry  = MIN_ENTRY_WEEKLY_SALARY
 *   rungs  = each original rung mapped to its SAME relative position between the
 *            two new anchors — a linear rescale of the ladder, not evenly
 *            spaced steps. Fast food ran 50/60/64/70/85/110, so its middle
 *            rungs sit at 0.17/0.23/0.33/0.58 of the span and land on
 *            130/140/150/180 rather than on an even 24 apart. Preserving the
 *            shape keeps each ladder's own pacing — where the jumps come, and
 *            how flat the early years feel.
 *
 * Two anchors rather than a flat multiplier, because a flat one propagates each
 * ladder's internal ratio into its top: the musician ladder spans 40x, so
 * lifting its entry by multiplication put a busker's endgame in the millions.
 * And a SOFT cap rather than `min(CEILING, lifted)`, because a hard one ties
 * every steep ladder at exactly the ceiling and erases the musician's
 * "worst wage, best ceiling" design intent.
 *
 * ── Calibrating the floor ─────────────────────────────────────────────────
 *
 * The floor was FIRST set to 350 and that was too generous by roughly 3x. It
 * was chosen against a plausible real-world wage instead of against the thing
 * that actually decides difficulty: how long the first property takes. At 350 a
 * minimum-wage character bought the $95 000 studio in 5.5 years and finished
 * three game-years with $52 000 in the bank having spent nothing — which is what
 * the owner reported.
 *
 * 110 is calibrated against that goal instead, and the number is measured rather
 * than argued: `__tests__/economy/incomeScale.test.ts` prints the model and
 * fails if the relationships break. Run it after ANY change here.
 *
 * Ladders already at or above the floor — teacher, nurse, and the whole
 * professional tier — are untouched.
 */

/**
 * No career starts below this. Calibrated so the first property is a long-term
 * goal on the bottom rung (~17 years) rather than an incidental purchase.
 * Raising it makes the whole early game easier; check the income-scale model.
 */
export const MIN_ENTRY_WEEKLY_SALARY = 110;

/**
 * Asymptote for a rescaled ladder's TOP rung. Approached, never reached; marquee
 * ladders already above it — celebrity, athlete, politician — keep their own.
 */
export const TOP_WEEKLY_SALARY_CEILING = 2600;

export const INITIAL_CAREERS: Career[] = [
    {
        id: 'fast_food',
        levels: [
            { name: 'Fast Food Worker', salary: 110 },
            { name: 'Crew Member', salary: 130 },
            { name: 'Shift Leader', salary: 140 },
            { name: 'Assistant Manager', salary: 150 },
            { name: 'Restaurant Manager', salary: 180 },
            { name: 'District Manager', salary: 230 },
        ],
        level: 0,
        description: 'Flip burgers in a fast-food restaurant',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'retail',
        levels: [
            { name: 'Retail Associate', salary: 110 },
            { name: 'Senior Associate', salary: 120 },
            { name: 'Floor Supervisor', salary: 140 },
            { name: 'Assistant Manager', salary: 165 },
            { name: 'Store Manager', salary: 205 },
            { name: 'Regional Manager', salary: 250 },
        ],
        level: 0,
        description: 'Assist customers and manage inventory in retail',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'janitor',
        levels: [
            { name: 'Janitor', salary: 110 },
            { name: 'Senior Janitor', salary: 130 },
            { name: 'Maintenance Lead', salary: 135 },
            { name: 'Maintenance Supervisor', salary: 135 },
            { name: 'Facility Manager', salary: 165 },
            { name: 'Facilities Director', salary: 200 },
        ],
        level: 0,
        description: 'Keep buildings clean and operational',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'teacher',
        levels: [
            { name: 'Teaching Assistant', salary: 220 },
            { name: 'Substitute Teacher', salary: 280 },
            { name: 'School Teacher', salary: 340 },
            { name: 'Senior Teacher', salary: 400 },
            { name: 'Department Head', salary: 480 },
            { name: 'Principal', salary: 600 },
        ],
        level: 0,
        description: 'Educate the next generation',
        requirements: { education: ['business_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'nurse',
        levels: [
            { name: 'Nursing Assistant', salary: 300 },
            { name: 'LPN', salary: 360 },
            { name: 'Registered Nurse', salary: 420 },
            { name: 'Senior Nurse', salary: 480 },
            { name: 'Nurse Practitioner', salary: 580 },
            { name: 'Nurse Manager', salary: 700 },
        ],
        level: 0,
        description: 'Provide healthcare services',
        requirements: { fitness: 40, education: ['business_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'software',
        levels: [
            { name: 'Junior Developer', salary: 1100 },
            { name: 'Developer', salary: 1400 },
            { name: 'Software Engineer', salary: 1700 },
            { name: 'Senior Engineer', salary: 2000 },
            { name: 'Lead Engineer', salary: 2400 },
            { name: 'Engineering Manager', salary: 3000 },
        ],
        level: 0,
        description: 'Develop software applications',
        requirements: { items: ['computer'], education: ['masters_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'doctor',
        levels: [
            { name: 'Medical Intern', salary: 1700 },
            { name: 'Resident Doctor', salary: 2200 },
            { name: 'Senior Resident', salary: 2700 },
            { name: 'Medical Doctor', salary: 3200 },
            { name: 'Senior Doctor', salary: 3800 },
            { name: 'Chief of Medicine', salary: 4800 },
        ],
        level: 0,
        description: 'Practice medicine and heal patients',
        requirements: { education: ['phd'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'lawyer',
        levels: [
            { name: 'Paralegal', salary: 1400 },
            { name: 'Junior Associate', salary: 1750 },
            { name: 'Associate Lawyer', salary: 2100 },
            { name: 'Senior Associate', salary: 2600 },
            { name: 'Senior Lawyer', salary: 3100 },
            { name: 'Partner', salary: 4000 },
        ],
        level: 0,
        description: 'Practice law and represent clients',
        requirements: { items: ['suit'], education: ['legal_studies', 'masters_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'corporate',
        levels: [
            { name: 'Business Intern', salary: 1750 },
            { name: 'Analyst', salary: 2400 },
            { name: 'Senior Analyst', salary: 3000 },
            { name: 'Manager', salary: 3600 },
            { name: 'Senior Manager', salary: 4800 },
            { name: 'CEO', salary: 6000 },
        ],
        level: 0,
        description: 'Climb the corporate ladder',
        requirements: { items: ['suit', 'computer'], education: ['mba'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'police',
        levels: [
            { name: 'Police Cadet', salary: 150 },
            { name: 'Police Officer', salary: 230 },
            { name: 'Senior Officer', salary: 290 },
            { name: 'Sergeant', salary: 350 },
            { name: 'Lieutenant', salary: 430 },
            { name: 'Captain', salary: 550 },
        ],
        level: 0,
        description: 'Protect and serve the community',
        requirements: { fitness: 50, education: ['police_academy'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'legal',
        levels: [
            { name: 'Junior Legal Assistant', salary: 130 },
            { name: 'Legal Assistant', salary: 190 },
            { name: 'Senior Legal Assistant', salary: 270 },
            { name: 'Paralegal Manager', salary: 370, experienceRequired: 40, description: 'Coordinate the paralegal team' },
            { name: 'Legal Operations Lead', salary: 500, experienceRequired: 90, description: 'Run legal operations for the firm' },
            { name: 'Director of Legal Services', salary: 660, experienceRequired: 150, description: 'Head the legal support division' },
        ],
        level: 0,
        description: 'Support legal professionals',
        requirements: { items: ['smartphone', 'computer'], education: ['legal_studies'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'bank',
        levels: [
            { name: 'Bank Teller', salary: 230 },
            { name: 'Loan Officer', salary: 350 },
            { name: 'Bank Manager', salary: 510 },
            { name: 'Branch Director', salary: 720, experienceRequired: 40, description: 'Oversee an entire branch' },
            { name: 'Regional Banking Director', salary: 1000, experienceRequired: 90, description: 'Manage a region of branches' },
            { name: 'VP of Retail Banking', salary: 1350, experienceRequired: 150, description: 'Lead retail banking strategy' },
        ],
        level: 0,
        description: 'Manage banking operations',
        requirements: { items: ['smartphone', 'computer', 'suit'], education: ['business_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'accountant',
        levels: [
            { name: 'Accounting Clerk', salary: 155 },
            { name: 'Accountant', salary: 270 },
            { name: 'Senior Accountant', salary: 390 },
            { name: 'Accounting Manager', salary: 560, experienceRequired: 40, description: 'Manage the accounting team' },
            { name: 'Controller', salary: 760, experienceRequired: 90, description: 'Own the company books' },
            { name: 'Chief Accountant', salary: 1000, experienceRequired: 150, description: 'Direct all accounting operations' },
        ],
        level: 0,
        description: 'Handle financial records',
        requirements: { items: ['computer'], education: ['business_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'politician',
        levels: [
            { name: 'Campaign Volunteer', salary: 190 },
            { name: 'City Council Member', salary: 470 },
            { name: 'Mayor', salary: 980 },
            { name: 'State Representative', salary: 1600, experienceRequired: 52, description: 'Represent your district at the state level' },
            { name: 'Governor', salary: 2400, experienceRequired: 130, description: 'Lead the state' },
            { name: 'National Party Leader', salary: 3400, experienceRequired: 220, description: 'Shape the national agenda' },
        ],
        level: 0,
        description: 'Serve the public through politics',
        requirements: { reputation: 20 },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'celebrity',
        levels: [
            { name: 'Influencer', salary: 310 },
            { name: 'TV Star', salary: 700 },
            { name: 'Movie Icon', salary: 1370 },
            { name: 'A-List Celebrity', salary: 2200, experienceRequired: 40, description: 'Top billing and red carpets' },
            { name: 'Global Superstar', salary: 3300, experienceRequired: 100, description: 'Worldwide fame and sold-out tours' },
            { name: 'Entertainment Mogul', salary: 4600, experienceRequired: 170, description: 'Own studios and franchises' },
        ],
        level: 0,
        description: 'Live in the spotlight',
        requirements: { reputation: 30 },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'athlete',
        levels: [
            { name: 'Rookie', salary: 270 },
            { name: 'Pro', salary: 620 },
            { name: 'Champion', salary: 1170 },
            { name: 'All-Star', salary: 1900, experienceRequired: 40, description: 'A league-wide household name' },
            { name: 'League MVP', salary: 2900, experienceRequired: 100, description: 'The best in the game this season' },
            { name: 'Hall of Famer', salary: 4200, experienceRequired: 170, description: 'An all-time legend of the sport' },
        ],
        level: 0,
        description: 'Compete at the highest level',
        requirements: { fitness: 60 },
        progress: 0,
        applied: false,
        accepted: false,
    },
    // ─── New careers added in Phase 3 ───────────────────────────────
    {
        id: 'chef',
        levels: [
            { name: 'Line Cook', salary: 110 },
            { name: 'Sous Chef', salary: 165 },
            { name: 'Head Chef', salary: 235 },
            { name: 'Executive Chef', salary: 335 },
            { name: 'Restaurant Owner-Chef', salary: 470 },
            { name: 'Celebrity Chef', salary: 805 },
        ],
        level: 0,
        description: 'Create culinary masterpieces',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'military',
        levels: [
            { name: 'Private', salary: 120 },
            { name: 'Corporal', salary: 160 },
            { name: 'Sergeant', salary: 210 },
            { name: 'Lieutenant', salary: 280 },
            { name: 'Captain', salary: 370 },
            { name: 'Colonel', salary: 500 },
        ],
        level: 0,
        description: 'Serve your country in the armed forces',
        requirements: { fitness: 50 },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'pilot',
        levels: [
            { name: 'Flight Student', salary: 110 },
            { name: 'Co-Pilot', salary: 330 },
            { name: 'Commercial Pilot', salary: 525 },
            { name: 'Senior Pilot', salary: 725 },
            { name: 'Captain', salary: 970 },
            { name: 'Chief Pilot', salary: 1220 },
        ],
        level: 0,
        description: 'Fly commercial aircraft around the world',
        requirements: { education: ['business_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'journalist',
        levels: [
            { name: 'Intern Reporter', salary: 110 },
            { name: 'Staff Writer', salary: 185 },
            { name: 'Senior Reporter', salary: 290 },
            { name: 'Editor', salary: 435 },
            { name: 'Managing Editor', salary: 615 },
            { name: 'Editor-in-Chief', salary: 835 },
        ],
        level: 0,
        description: 'Report the news and uncover stories',
        requirements: { education: ['business_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'architect',
        levels: [
            { name: 'Draftsperson', salary: 200 },
            { name: 'Junior Architect', salary: 350 },
            { name: 'Architect', salary: 500 },
            { name: 'Senior Architect', salary: 700 },
            { name: 'Principal Architect', salary: 950 },
            { name: 'Firm Partner', salary: 1300 },
        ],
        level: 0,
        description: 'Design buildings and structures',
        requirements: { items: ['computer'], education: ['masters_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'veterinarian',
        levels: [
            { name: 'Vet Assistant', salary: 110 },
            { name: 'Vet Technician', salary: 190 },
            { name: 'Veterinarian', salary: 355 },
            { name: 'Senior Vet', salary: 505 },
            { name: 'Specialist Vet', salary: 655 },
            { name: 'Clinic Owner', salary: 850 },
        ],
        level: 0,
        description: 'Care for animals and treat their illnesses',
        requirements: { education: ['masters_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'musician',
        levels: [
            { name: 'Street Performer', salary: 110 },
            { name: 'Session Musician', salary: 180 },
            { name: 'Band Member', salary: 305 },
            { name: 'Solo Artist', salary: 575 },
            { name: 'Recording Artist', salary: 1090 },
            { name: 'Rock Star', salary: 2120 },
        ],
        level: 0,
        description: 'Make music and perform for audiences',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'electrician',
        levels: [
            { name: 'Apprentice', salary: 110 },
            { name: 'Journeyman', salary: 190 },
            { name: 'Electrician', salary: 270 },
            { name: 'Master Electrician', salary: 385 },
            { name: 'Electrical Contractor', salary: 535 },
            { name: 'Business Owner', salary: 705 },
        ],
        level: 0,
        description: 'Install and repair electrical systems',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'truck_driver',
        levels: [
            { name: 'Delivery Driver', salary: 110 },
            { name: 'Local Hauler', salary: 160 },
            { name: 'Long-Haul Trucker', salary: 240 },
            { name: 'Specialized Hauler', salary: 325 },
            { name: 'Fleet Supervisor', salary: 430 },
            { name: 'Fleet Manager', salary: 565 },
        ],
        level: 0,
        description: 'Transport goods across the country',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'farmer',
        levels: [
            { name: 'Farm Hand', salary: 110 },
            { name: 'Farm Worker', salary: 160 },
            { name: 'Senior Farm Hand', salary: 225 },
            { name: 'Farm Foreman', salary: 330 },
            { name: 'Farm Manager', salary: 480 },
            { name: 'Farm Owner', salary: 790 },
        ],
        level: 0,
        description: 'Work the land and grow crops',
        requirements: {},
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'real_estate_agent',
        levels: [
            { name: 'Trainee Agent', salary: 110 },
            { name: 'Junior Agent', salary: 185 },
            { name: 'Real Estate Agent', salary: 325 },
            { name: 'Senior Agent', salary: 505 },
            { name: 'Broker', salary: 720 },
            { name: 'Agency Owner', salary: 985 },
        ],
        level: 0,
        description: 'Buy and sell properties for clients',
        requirements: { items: ['smartphone'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'therapist',
        levels: [
            { name: 'Counseling Intern', salary: 110 },
            { name: 'Licensed Counselor', salary: 210 },
            { name: 'Therapist', salary: 355 },
            { name: 'Senior Therapist', salary: 505 },
            { name: 'Clinical Director', salary: 655 },
            { name: 'Private Practice Owner', salary: 850 },
        ],
        level: 0,
        description: 'Help people with their mental health',
        requirements: { education: ['masters_degree'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'firefighter',
        levels: [
            { name: 'Probationary Firefighter', salary: 130 },
            { name: 'Firefighter', salary: 190 },
            { name: 'Senior Firefighter', salary: 250 },
            { name: 'Lieutenant', salary: 330 },
            { name: 'Captain', salary: 420 },
            { name: 'Fire Chief', salary: 550 },
        ],
        level: 0,
        description: 'Fight fires and save lives',
        requirements: { fitness: 55 },
        progress: 0,
        applied: false,
        accepted: false,
    },
    {
        id: 'graphic_designer',
        levels: [
            { name: 'Junior Designer', salary: 110 },
            { name: 'Graphic Designer', salary: 185 },
            { name: 'Senior Designer', salary: 295 },
            { name: 'Art Director', salary: 460 },
            { name: 'Creative Director', salary: 675 },
            { name: 'Design Studio Owner', salary: 895 },
        ],
        level: 0,
        description: 'Create visual designs and brand identities',
        requirements: { items: ['computer'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
];
