/**
 * Enhanced Goal System
 * 
 * Supports parallel goals across different categories with better progression feedback.
 */

import { DollarSign, Gem, Heart, Briefcase, GraduationCap, Users, Dumbbell, Home, TrendingUp } from 'lucide-react-native';
import type { GoalCategory, Goal, GoalReward } from './goalSystem';

// Extended goal definition with category
interface EnhancedGoalDefinition {
    id: string;
    title: string;
    description: string;
    type: 'money' | 'happiness' | 'career' | 'gems' | 'general' | 'health' | 'social' | 'education';
    category: GoalCategory;
    target: number;
    reward: GoalReward;
    priority: number; // Lower = higher priority
    minWeek?: number; // Minimum week to show this goal
    maxWeek?: number; // Maximum week to show this goal
    prerequisiteGoals?: string[]; // Goals that must be completed first
    isOptional?: boolean; // Challenge goals
}

// Enhanced goal definitions with categories and parallel support
export const ENHANCED_GOAL_DEFINITIONS: EnhancedGoalDefinition[] = [
    // === EARLY GAME (Week 1-4) ===
    {
        id: 'first_money',
        title: 'Earn Your First $200',
        description: 'Work a street job or find employment to start earning',
        type: 'money',
        category: 'finance',
        target: 200,
        priority: 1,
        maxWeek: 8,
        reward: { type: 'money', amount: 100, icon: DollarSign, color: '#10B981' }
    },
    {
        id: 'stay_happy',
        title: 'Stay Happy',
        description: 'Keep your happiness above 70 to stay motivated',
        type: 'happiness',
        category: 'health',
        target: 70,
        priority: 1,
        maxWeek: 4,
        reward: { type: 'energy', amount: 20, icon: Heart, color: '#EC4899' }
    },
    {
        id: 'get_employed',
        title: 'Find Employment',
        description: 'Apply for and get accepted to a career job',
        type: 'career',
        category: 'career',
        target: 1,
        priority: 2,
        maxWeek: 12,
        reward: { type: 'money', amount: 150, icon: Briefcase, color: '#3B82F6' }
    },

    // === MID GAME (Week 5-20) ===
    {
        id: 'save_2000',
        title: 'Build Emergency Fund',
        description: 'Save $2,000 for unexpected expenses',
        type: 'money',
        category: 'finance',
        target: 2000,
        priority: 3,
        minWeek: 3,
        prerequisiteGoals: ['first_money'],
        reward: { type: 'gems', amount: 15, icon: Gem, color: '#8B5CF6' }
    },
    {
        id: 'buy_phone',
        title: 'Get Connected',
        description: 'Buy a smartphone to unlock mobile apps',
        type: 'general',
        category: 'career',
        target: 1,
        priority: 3,
        minWeek: 2,
        reward: { type: 'happiness', amount: 15, icon: DollarSign, color: '#10B981' }
    },
    {
        id: 'maintain_health',
        title: 'Stay Healthy',
        description: 'Keep your health above 60 for 4 weeks',
        type: 'health',
        category: 'health',
        target: 4,
        priority: 4,
        minWeek: 4,
        reward: { type: 'health', amount: 20, icon: Heart, color: '#EF4444' }
    },
    {
        id: 'make_friend',
        title: 'Make a Friend',
        description: 'Build a relationship with someone',
        type: 'social',
        category: 'social',
        target: 1,
        priority: 4,
        minWeek: 2,
        reward: { type: 'happiness', amount: 20, icon: Users, color: '#EC4899' }
    },

    // === LATE GAME (Week 20+) ===
    {
        id: 'wealth_10k',
        title: 'Growing Wealth',
        description: 'Accumulate $10,000 in total assets',
        type: 'money',
        category: 'finance',
        target: 10000,
        priority: 5,
        minWeek: 10,
        prerequisiteGoals: ['save_2000'],
        reward: { type: 'gems', amount: 25, icon: Gem, color: '#8B5CF6' }
    },
    {
        id: 'wealth_50k',
        title: 'Serious Investor',
        description: 'Build a portfolio worth $50,000',
        type: 'money',
        category: 'finance',
        target: 50000,
        priority: 6,
        prerequisiteGoals: ['wealth_10k'],
        reward: { type: 'gems', amount: 50, icon: TrendingUp, color: '#10B981' }
    },
    {
        id: 'career_promotion',
        title: 'Get Promoted',
        description: 'Reach level 2 or higher in your career',
        type: 'career',
        category: 'career',
        target: 2,
        priority: 5,
        minWeek: 12,
        prerequisiteGoals: ['get_employed'],
        reward: { type: 'money', amount: 500, icon: Briefcase, color: '#3B82F6' }
    },
    {
        id: 'buy_home',
        title: 'Homeowner',
        description: 'Purchase your first property',
        type: 'general',
        category: 'finance',
        target: 1,
        priority: 6,
        minWeek: 20,
        prerequisiteGoals: ['wealth_10k'],
        reward: { type: 'happiness', amount: 30, icon: Home, color: '#F59E0B' }
    },
    {
        id: 'get_degree',
        title: 'Graduate',
        description: 'Complete an education program',
        type: 'education',
        category: 'education',
        target: 1,
        priority: 5,
        minWeek: 8,
        reward: { type: 'gems', amount: 20, icon: GraduationCap, color: '#8B5CF6' }
    },

    // === OPTIONAL CHALLENGE GOALS ===
    {
        id: 'gem_collector',
        title: 'Gem Collector',
        description: 'Collect 500 gems from achievements',
        type: 'gems',
        category: 'hobby',
        target: 500,
        priority: 10,
        isOptional: true,
        reward: { type: 'money', amount: 2000, icon: Gem, color: '#8B5CF6' }
    },
    {
        id: 'fitness_master',
        title: 'Fitness Master',
        description: 'Reach 80+ fitness level',
        type: 'health',
        category: 'health',
        target: 80,
        priority: 10,
        isOptional: true,
        minWeek: 10,
        reward: { type: 'health', amount: 30, icon: Dumbbell, color: '#10B981' }
    },
    {
        id: 'millionaire',
        title: 'Millionaire',
        description: 'Accumulate $1,000,000 in net worth',
        type: 'money',
        category: 'finance',
        target: 1000000,
        priority: 10,
        isOptional: true,
        prerequisiteGoals: ['wealth_50k'],
        reward: { type: 'gems', amount: 200, icon: DollarSign, color: '#F59E0B' }
    },
];

// Extended game state interface for goal tracking
export interface ExtendedGameState {
    stats: {
        money: number;
        gems: number;
        happiness: number;
        energy: number;
        health: number;
        fitness?: number;
    };
    week: number;
    weeksLived?: number;
    currentJob: string | null;
    bankSavings: number;
    completedGoals: string[];
    // Additional tracking
    items?: Array<{ id: string; owned: boolean }>;
    relationships?: Array<{ type: string }>;
    educations?: Array<{ completed: boolean }>;
    realEstate?: Array<{ owned: boolean }>;
    careers?: Array<{ id: string; level: number; accepted: boolean }>;
    healthyWeeksStreak?: number; // Weeks with health > 60
}

/**
 * Calculate goal progress for a specific goal
 */
function calculateGoalCurrent(goalDef: EnhancedGoalDefinition, gameState: ExtendedGameState): number {
    switch (goalDef.id) {
        case 'first_money':
        case 'save_2000':
        case 'wealth_10k':
        case 'wealth_50k':
        case 'millionaire':
            return Math.max(gameState.stats.money, gameState.bankSavings);

        case 'stay_happy':
            return gameState.stats.happiness;

        case 'get_employed':
            return gameState.currentJob ? 1 : 0;

        case 'buy_phone':
            return gameState.items?.some(i => i.id === 'smartphone' && i.owned) ? 1 : 0;

        case 'maintain_health':
            return gameState.healthyWeeksStreak ?? 0;

        case 'make_friend':
            return gameState.relationships?.filter(r =>
                r.type === 'friend' || r.type === 'partner' || r.type === 'spouse'
            ).length ?? 0;

        case 'career_promotion': {
            const career = gameState.careers?.find(c => c.id === gameState.currentJob && c.accepted);
            return career?.level ?? 0;
        }

        case 'buy_home':
            return gameState.realEstate?.filter(r => r.owned).length ?? 0;

        case 'get_degree':
            return gameState.educations?.filter(e => e.completed).length ?? 0;

        case 'gem_collector':
            return gameState.stats.gems;

        case 'fitness_master':
            return gameState.stats.fitness ?? 0;

        default:
            return 0;
    }
}

/**
 * Check if goal prerequisites are met
 */
function arePrerequisitesMet(goalDef: EnhancedGoalDefinition, completedGoals: string[]): boolean {
    if (!goalDef.prerequisiteGoals || goalDef.prerequisiteGoals.length === 0) {
        return true;
    }
    return goalDef.prerequisiteGoals.every(prereq => completedGoals.includes(prereq));
}

/**
 * Check if goal is available based on week and prerequisites
 */
function isGoalAvailable(
    goalDef: EnhancedGoalDefinition,
    gameState: ExtendedGameState
): boolean {
    const week = gameState.weeksLived ?? 0;
    const completedGoals = gameState.completedGoals ?? [];

    // Already completed
    if (completedGoals.includes(goalDef.id)) return false;

    // Check week requirements
    if (goalDef.minWeek && week < goalDef.minWeek) return false;
    if (goalDef.maxWeek && week > goalDef.maxWeek) return false;

    // Check prerequisites
    if (!arePrerequisitesMet(goalDef, completedGoals)) return false;

    return true;
}

/**
 * Get all active goals (parallel goals across categories)
 * Returns up to 3 goals from different categories
 */
export function getActiveGoals(gameState: ExtendedGameState): Goal[] {
    const activeGoals: Goal[] = [];
    const usedCategories = new Set<GoalCategory>();

    // Sort by priority (lower = higher priority)
    const sortedGoals = [...ENHANCED_GOAL_DEFINITIONS]
        .filter(g => !g.isOptional) // Exclude optional goals from main list
        .sort((a, b) => a.priority - b.priority);

    for (const goalDef of sortedGoals) {
        // Skip if we already have a goal from this category
        if (usedCategories.has(goalDef.category)) continue;

        // Skip if goal is not available
        if (!isGoalAvailable(goalDef, gameState)) continue;

        // Calculate progress
        const current = calculateGoalCurrent(goalDef, gameState);
        const progress = Math.min(100, (current / goalDef.target) * 100);
        const completed = progress >= 100;

        // Skip completed goals
        if (completed) continue;

        activeGoals.push({
            id: goalDef.id,
            title: goalDef.title,
            description: goalDef.description,
            type: goalDef.type as Goal['type'],
            category: goalDef.category,
            target: goalDef.target,
            current,
            progress,
            reward: goalDef.reward,
            completed,
            priority: goalDef.priority === 10 ? 'low' :
                goalDef.priority <= 2 ? 'high' :
                    goalDef.priority <= 4 ? 'medium' : 'low',
        });

        usedCategories.add(goalDef.category);

        // Max 3 active goals
        if (activeGoals.length >= 3) break;
    }

    return activeGoals;
}

/**
 * Get optional challenge goals
 */
export function getChallengeGoals(gameState: ExtendedGameState): Goal[] {
    return ENHANCED_GOAL_DEFINITIONS
        .filter(g => g.isOptional && isGoalAvailable(g, gameState))
        .map(goalDef => {
            const current = calculateGoalCurrent(goalDef, gameState);
            const progress = Math.min(100, (current / goalDef.target) * 100);
            return {
                id: goalDef.id,
                title: goalDef.title,
                description: goalDef.description,
                type: goalDef.type as Goal['type'],
                category: goalDef.category,
                target: goalDef.target,
                current,
                progress,
                reward: goalDef.reward,
                completed: progress >= 100,
                priority: 'low' as const,
            };
        });
}

/**
 * Get completed goals with their reward info
 */
export function getCompletedGoals(completedGoalIds: string[]): Goal[] {
    return ENHANCED_GOAL_DEFINITIONS
        .filter(g => completedGoalIds.includes(g.id))
        .map(goalDef => ({
            id: goalDef.id,
            title: goalDef.title,
            description: goalDef.description,
            type: goalDef.type as Goal['type'],
            category: goalDef.category,
            target: goalDef.target,
            current: goalDef.target,
            progress: 100,
            reward: goalDef.reward,
            completed: true,
            priority: 'low' as const,
        }));
}

/**
 * Check for newly completed goals
 */
export function checkGoalsCompletion(gameState: ExtendedGameState): Goal[] {
    const newlyCompleted: Goal[] = [];
    const completedGoals = gameState.completedGoals ?? [];

    for (const goalDef of ENHANCED_GOAL_DEFINITIONS) {
        // Skip already completed
        if (completedGoals.includes(goalDef.id)) continue;

        // Skip unavailable goals
        if (!isGoalAvailable(goalDef, gameState)) continue;

        // Check if completed
        const current = calculateGoalCurrent(goalDef, gameState);
        const progress = (current / goalDef.target) * 100;

        if (progress >= 100) {
            newlyCompleted.push({
                id: goalDef.id,
                title: goalDef.title,
                description: goalDef.description,
                type: goalDef.type as Goal['type'],
                category: goalDef.category,
                target: goalDef.target,
                current,
                progress: 100,
                reward: goalDef.reward,
                completed: true,
                priority: 'medium',
            });
        }
    }

    return newlyCompleted;
}

export default {
    getActiveGoals,
    getChallengeGoals,
    getCompletedGoals,
    checkGoalsCompletion,
    ENHANCED_GOAL_DEFINITIONS,
};
