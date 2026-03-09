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

            // Add new change, keep max 8
            return [...prev, newChange].slice(-8);
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

        const statsToTrack: Array<'health' | 'happiness' | 'energy' | 'money' | 'gems' | 'fitness'> =
            ['health', 'happiness', 'energy', 'money', 'gems', 'fitness'];

        for (const stat of statsToTrack) {
            const current = gameState.stats[stat] ?? 0;
            const prev = prevStats.current[stat];

            if (prev !== undefined && current !== prev) {
                const diff = current - prev;
                // Show changes of at least 1 (or $10 for money)
                const threshold = stat === 'money' ? 10 : 1;
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
