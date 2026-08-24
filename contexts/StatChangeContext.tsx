/**
 * StatChangeContext
 * 
 * Global context for tracking and displaying stat changes throughout the app.
 * Subscribes to game state changes and generates floating notifications.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { StatChange } from '@/components/ui/StatChangeIndicator';

interface StatChangeContextType {
    changes: StatChange[];
    addChange: (stat: StatChange['stat'], amount: number) => void;
    clearChange: (id: string) => void;
    clearAllChanges: () => void;
}

/**
 * Minimum absolute change required before a stat surfaces a floating pill.
 * Higher floors on the stats that drift every week (energy especially) keep the
 * top-of-screen feedback quiet during routine "Next Week" progression while
 * still flagging genuinely impactful swings.
 */
const STAT_CHANGE_THRESHOLDS: Record<StatChange['stat'], number> = {
    energy: 20, // regenerates ~40/wk - a pill on every tick was pure noise
    health: 8,
    happiness: 8,
    fitness: 8,
    money: 250, // weekly income routinely clears 50 - only flag real swings
    gems: 1, // rare and meaningful - always worth showing
};

/** Max simultaneously-floating pills. 8 turned every week-advance into a
 *  confetti burst; a few at a time keeps the signal readable. */
const MAX_VISIBLE_PILLS = 4;

const StatChangeContext = createContext<StatChangeContextType | undefined>(undefined);

export function useStatChanges() {
    const context = useContext(StatChangeContext);
    if (!context) {
        throw new Error('useStatChanges must be used within StatChangeProvider');
    }
    return context;
}

interface StatChangeProviderProps {
    children: React.ReactNode;
}

export function StatChangeProvider({ children }: StatChangeProviderProps) {
    const [changes, setChanges] = useState<StatChange[]>([]);

    const addChange = useCallback((stat: StatChange['stat'], amount: number) => {
        // Only show significant changes
        if (Math.abs(amount) < 1) return;

        const newChange: StatChange = {
            id: `${stat}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            stat,
            amount: Math.round(amount),
            timestamp: Date.now(),
        };

        setChanges(prev => {
            // Combine with existing change of same stat if within 500ms
            const recentSameStat = prev.find(
                c => c.stat === stat && Date.now() - c.timestamp < 500
            );

            if (recentSameStat) {
                // Combine amounts
                return prev.map(c =>
                    c.id === recentSameStat.id
                        ? { ...c, amount: c.amount + newChange.amount }
                        : c
                );
            }

            // Add new change, bounded so bursts stay readable
            return [...prev, newChange].slice(-MAX_VISIBLE_PILLS);
        });
    }, []);

    const clearChange = useCallback((id: string) => {
        setChanges(prev => prev.filter(c => c.id !== id));
    }, []);

    const clearAllChanges = useCallback(() => {
        setChanges([]);
    }, []);

    return (
        <StatChangeContext.Provider value={{ changes, addChange, clearChange, clearAllChanges }}>
            {children}
        </StatChangeContext.Provider>
    );
}

/**
 * Hook to automatically track stat changes from game state
 * Place this in a component that has access to gameState
 */
export function useStatChangeTracker(gameState: {
    stats?: {
        health?: number;
        happiness?: number;
        energy?: number;
        money?: number;
        gems?: number;
        fitness?: number;
    };
} | null) {
    const { addChange } = useStatChanges();
    const prevStats = useRef<Record<string, number>>({});
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (!gameState?.stats) return;

        // Skip first render to prevent showing changes on load
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevStats.current = {
                health: gameState.stats.health ?? 0,
                happiness: gameState.stats.happiness ?? 0,
                energy: gameState.stats.energy ?? 0,
                money: gameState.stats.money ?? 0,
                gems: gameState.stats.gems ?? 0,
                fitness: gameState.stats.fitness ?? 0,
            };
            return;
        }

        const statsToTrack: ('health' | 'happiness' | 'energy' | 'money' | 'gems' | 'fitness')[] =
            ['health', 'happiness', 'energy', 'money', 'gems', 'fitness'];

        for (const stat of statsToTrack) {
            const current = gameState.stats[stat] ?? 0;
            const prev = prevStats.current[stat];

            if (prev !== undefined && current !== prev) {
                const diff = current - prev;
                // SMOOTHNESS: routine weekly upkeep nudges energy/health/etc. by a
                // point or two every single tick, which spawned a floating pill at
                // the top of the screen on every "Next Week". Only surface changes
                // large enough to be meaningful so progression feels calm. Gems are
                // rare and always worth showing (threshold 1).
                const threshold = STAT_CHANGE_THRESHOLDS[stat] ?? 1;
                if (Math.abs(diff) >= threshold) {
                    addChange(stat, Math.round(diff));
                }
            }
            prevStats.current[stat] = current;
        }
    }, [
        gameState?.stats?.health,
        gameState?.stats?.happiness,
        gameState?.stats?.energy,
        gameState?.stats?.money,
        gameState?.stats?.gems,
        gameState?.stats?.fitness,
        addChange,
    ]);
}

export default StatChangeProvider;
