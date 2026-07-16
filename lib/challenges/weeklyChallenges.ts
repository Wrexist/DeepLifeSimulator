/**
 * Weekly Themed Challenges
 *
 * Multi-objective challenges that rotate every 7 real-time days.
 * Each challenge has 4-6 objectives that must ALL be met simultaneously.
 * Progress is checked against absolute game state each week.
 *
 * Rotation is deterministic based on UTC week number — all players
 * see the same challenge at the same time.
 */
import type { GameState } from '@/contexts/game/types';

export interface WeeklyChallengeObjective {
 id: string;
 description: string;
 target: number;
 checkCurrent: (state: GameState) => number;
}

export interface WeeklyChallengeDefinition {
 id: string;
 name: string;
 description: string;
 emoji?: string;
 reward: number; // gems
 difficulty: 'normal' | 'hard' | 'extreme';
 objectives: WeeklyChallengeObjective[];
}

// Helper: rough net worth
function getNetWorth(s: GameState): number {
 const cash = s.stats?.money ?? 0;
 const bank = s.bankSavings ?? 0;
 const holdings = Array.isArray(s.stocks) ? s.stocks : (s.stocks?.holdings ?? []);
 const stocks = Array.isArray(holdings)
 ? holdings.reduce(
 (sum: number, st: any) => sum + (st.shares ?? 0) * (st.currentPrice ?? 0),
 0
 )
 : 0;
 const realEstate = Array.isArray(s.realEstate)
 ? s.realEstate.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0)
 : 0;
 return cash + bank + stocks + realEstate;
}

export const WEEKLY_CHALLENGES: WeeklyChallengeDefinition[] = [
 {
 id: 'wc_monopoly',
 name: 'The Monopoly Challenge',
 emoji: '',
 description: 'Build a real estate empire with a family.',
 reward: 200,
 difficulty: 'hard',
 objectives: [
 {
 id: 'own_3_properties',
 description: 'Own 3+ properties',
 target: 3,
 checkCurrent: (s) => (s.realEstate ?? []).filter((r: any) => r.owned).length,
 },
 {
 id: 'net_worth_500k',
 description: 'Have $500K+ net worth',
 target: 1,
 checkCurrent: (s) => (getNetWorth(s) >= 500_000 ? 1 : 0),
 },
 {
 id: 'married',
 description: 'Be married',
 target: 1,
 checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
 },
 {
 id: 'reputation_50',
 description: 'Have 50+ reputation',
 target: 1,
 checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 50 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_scholar',
 name: 'The Scholar',
 emoji: '',
 description: 'Become the most educated person in town.',
 reward: 150,
 difficulty: 'normal',
 objectives: [
 {
 id: 'education_2',
 description: 'Complete 2+ educations',
 target: 2,
 checkCurrent: (s) =>
 (s.educations ?? []).filter((e: any) => e?.completed).length,
 },
 {
 id: 'savings_10k',
 description: 'Have $10K+ in savings',
 target: 1,
 checkCurrent: (s) => ((s.stats?.money ?? 0) >= 10000 ? 1 : 0),
 },
 {
 id: 'reputation_40',
 description: 'Have 40+ reputation',
 target: 1,
 checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 40 ? 1 : 0),
 },
 {
 id: 'health_60',
 description: 'Maintain 60+ health',
 target: 1,
 checkCurrent: (s) => ((s.stats?.health ?? 0) >= 60 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_fitness_guru',
 name: 'Fitness Guru',
 emoji: '',
 description: 'Peak physical condition with a social following.',
 reward: 150,
 difficulty: 'normal',
 objectives: [
 {
 id: 'fitness_80',
 description: 'Have 80+ fitness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.fitness ?? 0) >= 80 ? 1 : 0),
 },
 {
 id: 'health_80',
 description: 'Have 80+ health',
 target: 1,
 checkCurrent: (s) => ((s.stats?.health ?? 0) >= 80 ? 1 : 0),
 },
 {
 id: 'happiness_70',
 description: 'Have 70+ happiness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 70 ? 1 : 0),
 },
 {
 id: 'followers_1k',
 description: 'Have 1K+ social followers',
 target: 1,
 checkCurrent: (s) => ((s.socialMedia?.followers ?? 0) >= 1000 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_social_butterfly',
 name: 'Social Butterfly',
 emoji: '',
 description: 'Be the most connected person in your city.',
 reward: 175,
 difficulty: 'normal',
 objectives: [
 {
 id: 'relationships_5',
 description: 'Have 5+ relationships',
 target: 5,
 checkCurrent: (s) => (s.relationships ?? []).length,
 },
 {
 id: 'married',
 description: 'Be married',
 target: 1,
 checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
 },
 {
 id: 'happiness_80',
 description: 'Have 80+ happiness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 80 ? 1 : 0),
 },
 {
 id: 'followers_5k',
 description: 'Have 5K+ social followers',
 target: 1,
 checkCurrent: (s) => ((s.socialMedia?.followers ?? 0) >= 5000 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_tycoon',
 name: 'Business Tycoon',
 emoji: '',
 description: 'Build a corporate empire.',
 reward: 250,
 difficulty: 'hard',
 objectives: [
 {
 id: 'company_2',
 description: 'Own 2+ companies',
 target: 2,
 checkCurrent: (s) => (s.companies ?? []).filter((c: any) => c.owned).length,
 },
 {
 id: 'net_worth_1m',
 description: 'Have $1M+ net worth',
 target: 1,
 checkCurrent: (s) => (getNetWorth(s) >= 1_000_000 ? 1 : 0),
 },
 {
 id: 'employees_10',
 description: 'Employ 10+ people total',
 target: 10,
 checkCurrent: (s) =>
 (s.companies ?? []).reduce(
 (sum: number, c: any) => sum + (c.employees?.length ?? 0),
 0
 ),
 },
 {
 id: 'reputation_60',
 description: 'Have 60+ reputation',
 target: 1,
 checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 60 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_balanced_life',
 name: 'Balanced Life',
 emoji: '',
 description: 'Perfect balance across all areas of life.',
 reward: 200,
 difficulty: 'hard',
 objectives: [
 {
 id: 'all_stats_60',
 description: 'All stats above 60',
 target: 1,
 checkCurrent: (s) =>
 (s.stats?.health ?? 0) >= 60 &&
 (s.stats?.happiness ?? 0) >= 60 &&
 (s.stats?.energy ?? 0) >= 60
 ? 1
 : 0,
 },
 {
 id: 'employed',
 description: 'Be employed',
 target: 1,
 checkCurrent: (s) => (s.currentJob ? 1 : 0),
 },
 {
 id: 'married',
 description: 'Be married',
 target: 1,
 checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
 },
 {
 id: 'savings_50k',
 description: 'Have $50K+ in savings',
 target: 1,
 checkCurrent: (s) => ((s.stats?.money ?? 0) >= 50000 ? 1 : 0),
 },
 {
 id: 'fitness_50',
 description: 'Have 50+ fitness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.fitness ?? 0) >= 50 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_investor',
 name: 'Wall Street Wolf',
 emoji: '',
 description: 'Dominate the financial markets.',
 reward: 200,
 difficulty: 'hard',
 objectives: [
 {
 id: 'stocks_5',
 description: 'Own 5+ different stocks',
 target: 5,
 checkCurrent: (s) => {
 const holdings = s.stocks?.holdings ?? [];
 return holdings.filter(st => (st.shares ?? 0) > 0).length;
 },
 },
 {
 id: 'net_worth_250k',
 description: 'Have $250K+ net worth',
 target: 1,
 checkCurrent: (s) => (getNetWorth(s) >= 250_000 ? 1 : 0),
 },
 {
 id: 'property_1',
 description: 'Own at least 1 property',
 target: 1,
 checkCurrent: (s) =>
 (s.realEstate ?? []).filter((r: any) => r.owned).length >= 1 ? 1 : 0,
 },
 ],
 },
 {
 id: 'wc_family_values',
 name: 'Family Values',
 emoji: '',
 description: 'Build the perfect family life.',
 reward: 175,
 difficulty: 'normal',
 objectives: [
 {
 id: 'married',
 description: 'Be married',
 target: 1,
 checkCurrent: (s) => (s.family?.spouse ? 1 : 0),
 },
 {
 id: 'children_2',
 description: 'Have 2+ children',
 target: 2,
 checkCurrent: (s) => (s.family?.children ?? []).length,
 },
 {
 id: 'property',
 description: 'Own a home',
 target: 1,
 checkCurrent: (s) =>
 (s.realEstate ?? []).filter((r: any) => r.owned).length >= 1 ? 1 : 0,
 },
 {
 id: 'happiness_75',
 description: 'Have 75+ happiness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 75 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_survivor',
 name: 'The Survivor',
 emoji: '',
 description: 'Thrive despite impossible odds.',
 reward: 300,
 difficulty: 'extreme',
 objectives: [
 {
 id: 'age_60',
 description: 'Reach age 60+',
 target: 1,
 checkCurrent: (s) => (Math.floor(s.date?.age ?? 18) >= 60 ? 1 : 0),
 },
 {
 id: 'net_worth_100k',
 description: 'Have $100K+ net worth',
 target: 1,
 checkCurrent: (s) => (getNetWorth(s) >= 100_000 ? 1 : 0),
 },
 {
 id: 'all_stats_50',
 description: 'All stats above 50',
 target: 1,
 checkCurrent: (s) =>
 (s.stats?.health ?? 0) >= 50 &&
 (s.stats?.happiness ?? 0) >= 50 &&
 (s.stats?.energy ?? 0) >= 50
 ? 1
 : 0,
 },
 {
 id: 'achievements_10',
 description: 'Unlock 10+ achievements',
 target: 10,
 checkCurrent: (s) =>
 (s.achievements ?? []).filter((a: any) => a.completed).length,
 },
 ],
 },
 {
 id: 'wc_influencer',
 name: 'Influencer Life',
 emoji: '',
 description: 'Become the ultimate social media star.',
 reward: 200,
 difficulty: 'hard',
 objectives: [
 {
 id: 'followers_50k',
 description: 'Have 50K+ social followers',
 target: 1,
 checkCurrent: (s) => ((s.socialMedia?.followers ?? 0) >= 50000 ? 1 : 0),
 },
 {
 id: 'posts_20',
 description: 'Make 20+ social posts',
 target: 20,
 checkCurrent: (s) => s.socialMedia?.totalPosts ?? 0,
 },
 {
 id: 'reputation_70',
 description: 'Have 70+ reputation',
 target: 1,
 checkCurrent: (s) => ((s.stats?.reputation ?? 0) >= 70 ? 1 : 0),
 },
 {
 id: 'money_100k',
 description: 'Have $100K+ cash',
 target: 1,
 checkCurrent: (s) => ((s.stats?.money ?? 0) >= 100000 ? 1 : 0),
 },
 ],
 },
 {
 id: 'wc_pet_lover',
 name: 'Pet Paradise',
 emoji: '',
 description: 'Build the happiest pet family.',
 reward: 125,
 difficulty: 'normal',
 objectives: [
 {
 id: 'pets_2',
 description: 'Own 2+ pets',
 target: 2,
 checkCurrent: (s) => (s.pets ?? []).length,
 },
 {
 id: 'happiness_80',
 description: 'Have 80+ happiness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 80 ? 1 : 0),
 },
 {
 id: 'home',
 description: 'Own a home',
 target: 1,
 checkCurrent: (s) =>
 (s.realEstate ?? []).filter((r: any) => r.owned).length >= 1 ? 1 : 0,
 },
 ],
 },
 {
 id: 'wc_globe_trotter',
 name: 'Globe Trotter',
 emoji: '',
 description: 'See the world and build wealth.',
 reward: 175,
 difficulty: 'normal',
 objectives: [
 {
 id: 'countries_3',
 description: 'Visit 3+ countries',
 target: 3,
 checkCurrent: (s) => s.travel?.visitedDestinations?.length ?? 0,
 },
 {
 id: 'money_25k',
 description: 'Have $25K+ cash',
 target: 1,
 checkCurrent: (s) => ((s.stats?.money ?? 0) >= 25000 ? 1 : 0),
 },
 {
 id: 'happiness_70',
 description: 'Have 70+ happiness',
 target: 1,
 checkCurrent: (s) => ((s.stats?.happiness ?? 0) >= 70 ? 1 : 0),
 },
 ],
 },
];

export function getWeeklyChallengeDefinition(
 challengeId: string
): WeeklyChallengeDefinition | undefined {
 return WEEKLY_CHALLENGES.find((c) => c.id === challengeId);
}

/**
 * Evaluate progress for all objectives in a challenge.
 */
export function evaluateChallengeProgress(
 challengeId: string,
 state: GameState
): { id: string; description: string; target: number; current: number; completed: boolean }[] {
 const def = getWeeklyChallengeDefinition(challengeId);
 if (!def) return [];

 return def.objectives.map((obj) => {
 const current = obj.checkCurrent(state);
 return {
 id: obj.id,
 description: obj.description,
 target: obj.target,
 current,
 completed: current >= obj.target,
 };
 });
}

/**
 * Check if all objectives in a challenge are completed.
 */
export function isChallengeComplete(challengeId: string, state: GameState): boolean {
 const progress = evaluateChallengeProgress(challengeId, state);
 return progress.length > 0 && progress.every((p) => p.completed);
}

/**
 * Number of game weeks (weeksLived) a challenge instance lasts before rotating.
 * One game "month" (week cycles 1–4 within a month). A challenge persists across
 * the month so the player has multiple ticks to complete it, and the gem reward
 * can be earned at most once per rotation.
 */
const ROTATION_GAME_WEEKS = 4;

/**
 * ANTI-EXPLOIT: select the challenge by absolute game week (weeksLived), not
 * wall-clock. Wall-clock selection let a player scrub their device clock to
 * force rotation → re-claim the gem reward indefinitely. Game-time selection
 * ties the reward to genuine play (advancing weeks costs energy/money/ageing).
 */
export function getWeeklyChallengeIdForWeek(weeksLived: number): string {
 const w = typeof weeksLived === 'number' && isFinite(weeksLived) && weeksLived >= 0 ? Math.floor(weeksLived) : 0;
 // REACHABILITY FIX: index by ROTATION COUNT, not raw week. Rotation only
 // advances every ROTATION_GAME_WEEKS (4) weeks (see needsRotation), so a raw
 // `w % 12` index only ever landed on the residues hit at rotation boundaries —
 // gcd(4,12)=4 means just 3 of the 12 challenges ({1,5,9} from week 1) were ever
 // selectable. Dividing by the rotation length first makes each rotation advance
 // the index by exactly 1, cycling through all 12 challenges over 48 game weeks.
 const index = Math.floor(w / ROTATION_GAME_WEEKS) % WEEKLY_CHALLENGES.length;
 return WEEKLY_CHALLENGES[index].id;
}

/**
 * Initialize or rotate the weekly challenge.
 *
 * ANTI-EXPLOIT: rotation is gated on weeksLived, not Date.now(). A device-clock
 * change can no longer force a fresh, instantly-complete challenge with
 * `rewardClaimed: false` to mint gems on demand.
 */
export function getOrRotateWeeklyChallenge(
 state: GameState
): GameState['weeklyChallenge'] {
 const now = Date.now();
 const weeksLived = typeof state.weeksLived === 'number' && isFinite(state.weeksLived) ? Math.floor(state.weeksLived) : 0;
 const existing = state.weeklyChallenge;

 // If existing challenge hasn't expired (within ROTATION_GAME_WEEKS game weeks
 // of startedWeek), keep it. Legacy challenges without startedWeek are adopted
 // at the current week rather than force-rotated.
 if (existing && !needsRotation(existing, weeksLived)) {
 return existing.startedWeek === undefined ? { ...existing, startedWeek: weeksLived } : existing;
 }

 // New challenge needed
 const challengeId = getWeeklyChallengeIdForWeek(weeksLived);
 const def = getWeeklyChallengeDefinition(challengeId);
 if (!def) return undefined;

 const progressResult = evaluateChallengeProgress(challengeId, state);

 return {
 challengeId,
 startedAt: now,
 startedWeek: weeksLived,
 progress: progressResult.map((p) => ({
 objectiveId: p.id,
 current: p.current,
 target: p.target,
 met: p.completed,
 })),
 completed: progressResult.every((p) => p.completed),
 rewardClaimed: false,
 };
}

function needsRotation(
 challenge: NonNullable<GameState['weeklyChallenge']>,
 currentWeeksLived: number
): boolean {
 // Legacy challenge missing startedWeek: don't force-rotate (adopt instead).
 if (typeof challenge.startedWeek !== 'number' || !isFinite(challenge.startedWeek)) return false;
 return currentWeeksLived - challenge.startedWeek >= ROTATION_GAME_WEEKS;
}
