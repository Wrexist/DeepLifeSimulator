import { Career } from '@/contexts/game/types';

/**
 * ── Salary scale ──────────────────────────────────────────────────────────
 *
 * Every `salary` here is WEEKLY. The advanced ladders in `advancedCareers.ts`
 * are authored as annual÷52 and say so (`salary: 3850, // ~$200k/yr`); these
 * were not, and sat about an order of magnitude below that basis. A Line Cook
 * read $40/week — $2 080 a year — beside a $95 000 studio, street jobs paying
 * ~$700/week, and a Medical Intern on $88 400. Entry doctor to entry cook was
 * 34:1 where reality is nearer 2:1, so the whole sub-professional half of the
 * tree was economically irrelevant: something to leave, never to hold.
 *
 * Rescaled on 2026-08-04 by ONE rule, so the result is auditable rather than
 * hand-tuned ladder by ladder:
 *
 *   lifted = originalTop x (MIN_ENTRY_WEEKLY_SALARY / originalEntry)
 *   top    = max(originalTop, CEILING x (1 - e^(-lifted / CEILING)))
 *   entry  = MIN_ENTRY_WEEKLY_SALARY
 *   rungs  = linear interpolation between those two anchors
 *
 * Two anchors rather than a flat multiplier, because a flat one propagates each
 * ladder's internal ratio straight into its top: the musician ladder spans 40x,
 * so lifting its entry to a living wage by multiplication put a busker's endgame
 * at $728 000 a year.
 *
 * And a SOFT cap rather than `min(CEILING, lifted)`, because a hard one ties
 * every steep ladder at exactly the ceiling — which silently erased the
 * musician's design intent of "worst wage, best ceiling" by flattening it level
 * with the electrician. `jobMarket.test.ts` asserts that ordering and is what
 * caught it. The exponential form is monotone in `lifted`, so ladders that
 * started apart stay apart while still converging on the ceiling.
 *
 * Ladders already at or above the floor (software, doctor, lawyer, corporate)
 * are untouched, and no rung anywhere was lowered.
 *
 * NOTE this is a mechanical repair of a SCALE error, not a balance pass. The
 * relative worth of, say, a Principal against a Police Captain is a design
 * decision and is still whatever it was.
 */

/** No career may start below a plausible full-time wage (~$18k/yr). */
export const MIN_ENTRY_WEEKLY_SALARY = 350;

/**
 * Asymptote for a rescaled ladder's TOP rung (~$135k/yr). Approached, never
 * reached; marquee ladders already above it — celebrity, athlete, politician —
 * keep their own top.
 */
export const TOP_WEEKLY_SALARY_CEILING = 2600;

export const INITIAL_CAREERS: Career[] = [
    {
        id: 'fast_food',
        levels: [
            { name: 'Fast Food Worker', salary: 350 },
            { name: 'Crew Member', salary: 400 },
            { name: 'Shift Leader', salary: 425 },
            { name: 'Assistant Manager', salary: 455 },
            { name: 'Restaurant Manager', salary: 535 },
            { name: 'District Manager', salary: 665 },
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
            { name: 'Retail Associate', salary: 350 },
            { name: 'Senior Associate', salary: 370 },
            { name: 'Floor Supervisor', salary: 430 },
            { name: 'Assistant Manager', salary: 490 },
            { name: 'Store Manager', salary: 595 },
            { name: 'Regional Manager', salary: 715 },
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
            { name: 'Janitor', salary: 350 },
            { name: 'Senior Janitor', salary: 400 },
            { name: 'Maintenance Lead', salary: 410 },
            { name: 'Maintenance Supervisor', salary: 420 },
            { name: 'Facility Manager', salary: 495 },
            { name: 'Facilities Director', salary: 590 },
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
            { name: 'Teaching Assistant', salary: 350 },
            { name: 'Substitute Teacher', salary: 420 },
            { name: 'School Teacher', salary: 490 },
            { name: 'Senior Teacher', salary: 565 },
            { name: 'Department Head', salary: 660 },
            { name: 'Principal', salary: 800 },
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
            { name: 'Nursing Assistant', salary: 350 },
            { name: 'LPN', salary: 400 },
            { name: 'Registered Nurse', salary: 455 },
            { name: 'Senior Nurse', salary: 510 },
            { name: 'Nurse Practitioner', salary: 595 },
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
            { name: 'Police Cadet', salary: 350 },
            { name: 'Police Officer', salary: 485 },
            { name: 'Senior Officer', salary: 585 },
            { name: 'Sergeant', salary: 680 },
            { name: 'Lieutenant', salary: 815 },
            { name: 'Captain', salary: 1015 },
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
            { name: 'Junior Legal Assistant', salary: 350 },
            { name: 'Legal Assistant', salary: 455 },
            { name: 'Senior Legal Assistant', salary: 595 },
            { name: 'Paralegal Manager', salary: 775, experienceRequired: 40, description: 'Coordinate the paralegal team' },
            { name: 'Legal Operations Lead', salary: 1005, experienceRequired: 90, description: 'Run legal operations for the firm' },
            { name: 'Director of Legal Services', salary: 1285, experienceRequired: 150, description: 'Head the legal support division' },
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
            { name: 'Bank Teller', salary: 350 },
            { name: 'Loan Officer', salary: 465 },
            { name: 'Bank Manager', salary: 620 },
            { name: 'Branch Director', salary: 820, experienceRequired: 40, description: 'Oversee an entire branch' },
            { name: 'Regional Banking Director', salary: 1085, experienceRequired: 90, description: 'Manage a region of branches' },
            { name: 'VP of Retail Banking', salary: 1420, experienceRequired: 150, description: 'Lead retail banking strategy' },
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
            { name: 'Accounting Clerk', salary: 350 },
            { name: 'Accountant', salary: 510 },
            { name: 'Senior Accountant', salary: 675 },
            { name: 'Accounting Manager', salary: 905, experienceRequired: 40, description: 'Manage the accounting team' },
            { name: 'Controller', salary: 1180, experienceRequired: 90, description: 'Own the company books' },
            { name: 'Chief Accountant', salary: 1510, experienceRequired: 150, description: 'Direct all accounting operations' },
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
            { name: 'Campaign Volunteer', salary: 350 },
            { name: 'City Council Member', salary: 615 },
            { name: 'Mayor', salary: 1100 },
            { name: 'State Representative', salary: 1690, experienceRequired: 52, description: 'Represent your district at the state level' },
            { name: 'Governor', salary: 2450, experienceRequired: 130, description: 'Lead the state' },
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
            { name: 'Influencer', salary: 350 },
            { name: 'TV Star', salary: 735 },
            { name: 'Movie Icon', salary: 1400 },
            { name: 'A-List Celebrity', salary: 2220, experienceRequired: 40, description: 'Top billing and red carpets' },
            { name: 'Global Superstar', salary: 3310, experienceRequired: 100, description: 'Worldwide fame and sold-out tours' },
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
            { name: 'Rookie', salary: 350 },
            { name: 'Pro', salary: 695 },
            { name: 'Champion', salary: 1230 },
            { name: 'All-Star', salary: 1945, experienceRequired: 40, description: 'A league-wide household name' },
            { name: 'League MVP', salary: 2925, experienceRequired: 100, description: 'The best in the game this season' },
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
            { name: 'Line Cook', salary: 350 },
            { name: 'Sous Chef', salary: 465 },
            { name: 'Head Chef', salary: 605 },
            { name: 'Executive Chef', salary: 820 },
            { name: 'Restaurant Owner-Chef', salary: 1100 },
            { name: 'Celebrity Chef', salary: 1800 },
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
            { name: 'Private', salary: 350 },
            { name: 'Corporal', salary: 430 },
            { name: 'Sergeant', salary: 530 },
            { name: 'Lieutenant', salary: 670 },
            { name: 'Captain', salary: 855 },
            { name: 'Colonel', salary: 1115 },
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
            { name: 'Flight Student', salary: 350 },
            { name: 'Co-Pilot', salary: 725 },
            { name: 'Commercial Pilot', salary: 1065 },
            { name: 'Senior Pilot', salary: 1405 },
            { name: 'Captain', salary: 1830 },
            { name: 'Chief Pilot', salary: 2255 },
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
            { name: 'Intern Reporter', salary: 350 },
            { name: 'Staff Writer', salary: 505 },
            { name: 'Senior Reporter', salary: 715 },
            { name: 'Editor', salary: 1020 },
            { name: 'Managing Editor', salary: 1385 },
            { name: 'Editor-in-Chief', salary: 1845 },
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
            { name: 'Draftsperson', salary: 350 },
            { name: 'Junior Architect', salary: 510 },
            { name: 'Architect', salary: 670 },
            { name: 'Senior Architect', salary: 880 },
            { name: 'Principal Architect', salary: 1145 },
            { name: 'Firm Partner', salary: 1515 },
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
            { name: 'Vet Assistant', salary: 350 },
            { name: 'Vet Technician', salary: 500 },
            { name: 'Veterinarian', salary: 825 },
            { name: 'Senior Vet', salary: 1105 },
            { name: 'Specialist Vet', salary: 1390 },
            { name: 'Clinic Owner', salary: 1770 },
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
            { name: 'Street Performer', salary: 350 },
            { name: 'Session Musician', salary: 430 },
            { name: 'Band Member', salary: 570 },
            { name: 'Solo Artist', salary: 865 },
            { name: 'Recording Artist', salary: 1440 },
            { name: 'Rock Star', salary: 2590 },
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
            { name: 'Apprentice', salary: 350 },
            { name: 'Journeyman', salary: 525 },
            { name: 'Electrician', salary: 700 },
            { name: 'Master Electrician', salary: 950 },
            { name: 'Electrical Contractor', salary: 1280 },
            { name: 'Business Owner', salary: 1655 },
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
            { name: 'Delivery Driver', salary: 350 },
            { name: 'Local Hauler', salary: 470 },
            { name: 'Long-Haul Trucker', salary: 650 },
            { name: 'Specialized Hauler', salary: 850 },
            { name: 'Fleet Supervisor', salary: 1090 },
            { name: 'Fleet Manager', salary: 1410 },
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
            { name: 'Farm Hand', salary: 350 },
            { name: 'Farm Worker', salary: 460 },
            { name: 'Senior Farm Hand', salary: 595 },
            { name: 'Farm Foreman', salary: 810 },
            { name: 'Farm Manager', salary: 1130 },
            { name: 'Farm Owner', salary: 1780 },
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
            { name: 'Trainee Agent', salary: 350 },
            { name: 'Junior Agent', salary: 495 },
            { name: 'Real Estate Agent', salary: 760 },
            { name: 'Senior Agent', salary: 1110 },
            { name: 'Broker', salary: 1520 },
            { name: 'Agency Owner', salary: 2030 },
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
            { name: 'Counseling Intern', salary: 350 },
            { name: 'Licensed Counselor', salary: 540 },
            { name: 'Therapist', salary: 825 },
            { name: 'Senior Therapist', salary: 1105 },
            { name: 'Clinical Director', salary: 1390 },
            { name: 'Private Practice Owner', salary: 1770 },
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
            { name: 'Probationary Firefighter', salary: 350 },
            { name: 'Firefighter', salary: 460 },
            { name: 'Senior Firefighter', salary: 575 },
            { name: 'Lieutenant', salary: 720 },
            { name: 'Captain', salary: 890 },
            { name: 'Fire Chief', salary: 1130 },
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
            { name: 'Junior Designer', salary: 350 },
            { name: 'Graphic Designer', salary: 505 },
            { name: 'Senior Designer', salary: 720 },
            { name: 'Art Director', salary: 1050 },
            { name: 'Creative Director', salary: 1490 },
            { name: 'Design Studio Owner', salary: 1925 },
        ],
        level: 0,
        description: 'Create visual designs and brand identities',
        requirements: { items: ['computer'] },
        progress: 0,
        applied: false,
        accepted: false,
    },
];
