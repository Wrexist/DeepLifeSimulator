/**
 * Action Simulator for AI Debug Suite
 * Simulates 100+ different game actions to test stability
 */

import React from 'react';
import { GameState, GameStats } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface SimulatedAction {
  id: string;
  name: string;
  category: 'money' | 'job' | 'social' | 'item' | 'stats' | 'progression' | 'property' | 'vehicle' | 'company' | 'hobby';
  execute: (gameState: GameState, setGameState: (updater: (prev: GameState) => GameState) => void) => Promise<{ success: boolean; message: string }>;
}

/**
 * Generate 100+ different reasonable game actions
 */
export function generateActionSimulations(): SimulatedAction[] {
  const actions: SimulatedAction[] = [];

  // === MONEY ACTIONS (20 actions) ===
  const moneyAmounts = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  moneyAmounts.forEach((amount, i) => {
    actions.push({
      id: `add-money-${i}`,
      name: `Add $${amount.toLocaleString()}`,
      category: 'money',
      execute: async (_gameState, setGameState) => {
        try {
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              money: (prev.stats?.money ?? 0) + amount,
            },
          }));
          return { success: true, message: `Added $${amount.toLocaleString()}` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });

    actions.push({
      id: `spend-money-${i}`,
      name: `Spend $${amount.toLocaleString()}`,
      category: 'money',
      execute: async (gameState, setGameState) => {
        try {
          const currentMoney = gameState?.stats?.money ?? 0;
          if (currentMoney >= amount) {
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                money: Math.max(0, (prev.stats?.money ?? 0) - amount),
              },
            }));
            return { success: true, message: `Spent $${amount.toLocaleString()}` };
          }
          return { success: false, message: `Insufficient funds` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });
  });

  // === STATS ACTIONS (12 actions) ===
  const statTypes: Array<keyof GameStats> = ['health', 'happiness', 'energy', 'fitness'];
  const statAmounts = [25, 50, -25, -50];

  statTypes.forEach((statType) => {
    statAmounts.forEach((amount) => {
      actions.push({
        id: `update-${statType}-${amount > 0 ? 'up' : 'down'}-${Math.abs(amount)}`,
        name: `${statType.charAt(0).toUpperCase() + statType.slice(1)} ${amount > 0 ? '+' : ''}${amount}`,
        category: 'stats',
        execute: async (_gameState, setGameState) => {
          try {
            setGameState(prev => {
              const currentValue = prev.stats?.[statType] ?? 50;
              const newValue = Math.max(0, Math.min(100, currentValue + amount));
              return {
                ...prev,
                stats: {
                  ...prev.stats,
                  [statType]: newValue,
                },
              };
            });
            return { success: true, message: `Updated ${statType} by ${amount}` };
          } catch (error) {
            return { success: false, message: `Failed: ${String(error)}` };
          }
        },
      });
    });
  });

  // === PROGRESSION ACTIONS (15 actions) ===
  for (let i = 0; i < 15; i++) {
    actions.push({
      id: `advance-week-${i}`,
      name: `Advance Week ${i + 1}`,
      category: 'progression',
      execute: async (gameState, setGameState) => {
        try {
          setGameState(prev => ({
            ...prev,
            date: {
              ...prev.date,
              week: (prev.date?.week ?? 1) + 1,
              age: (prev.date?.age ?? 18) + (1 / WEEKS_PER_YEAR), // ~1 week
            },
          }));
          return { success: true, message: `Advanced to week ${(gameState?.date?.week ?? 1) + 1}` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });
  }

  // === JOB ACTIONS (6 actions) ===
  const jobTypes = ['part-time', 'full-time', 'freelance'];
  jobTypes.forEach((jobType) => {
    actions.push({
      id: `job-${jobType}`,
      name: `${jobType.replace('-', ' ').charAt(0).toUpperCase() + jobType.slice(1)} Work`,
      category: 'job',
      execute: async (gameState, setGameState) => {
        try {
          const energyCost = jobType === 'part-time' ? 15 : jobType === 'full-time' ? 30 : 20;
          const moneyEarned = jobType === 'part-time' ? 200 : jobType === 'full-time' ? 500 : 350;
          const currentEnergy = gameState?.stats?.energy ?? 100;

          if (currentEnergy >= energyCost) {
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                energy: Math.max(0, (prev.stats?.energy ?? 0) - energyCost),
                money: (prev.stats?.money ?? 0) + moneyEarned,
              },
            }));
            return { success: true, message: `Worked ${jobType}, earned $${moneyEarned}` };
          }
          return { success: false, message: `Not enough energy (need ${energyCost})` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });
  });

  // === SOCIAL ACTIONS (10 actions) ===
  const socialActions = ['date', 'gift', 'conversation', 'event', 'relationship'];
  socialActions.forEach((action, i) => {
    for (let j = 0; j < 2; j++) {
      actions.push({
        id: `social-${action}-${i}-${j}`,
        name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${j + 1}`,
        category: 'social',
        execute: async (_gameState, setGameState) => {
          try {
            // Simulate social interaction - update happiness
            const happinessGain = 5 + (j * 5);
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                happiness: Math.min(100, (prev.stats?.happiness ?? 50) + happinessGain),
              },
            }));
            return { success: true, message: `Social ${action} completed, +${happinessGain} happiness` };
          } catch (error) {
            return { success: false, message: `Failed: ${String(error)}` };
          }
        },
      });
    }
  });

  // === ITEM ACTIONS (10 actions) ===
  for (let i = 0; i < 10; i++) {
    actions.push({
      id: `item-purchase-${i}`,
      name: `Purchase Item ${i + 1}`,
      category: 'item',
      execute: async (gameState, setGameState) => {
        try {
          const itemCost = 50 * (i + 1);
          const currentMoney = gameState?.stats?.money ?? 0;
          
          if (currentMoney >= itemCost) {
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                money: (prev.stats?.money ?? 0) - itemCost,
              },
            }));
            return { success: true, message: `Purchased item for $${itemCost}` };
          }
          return { success: false, message: `Insufficient funds for item` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });
  }

  // === PROPERTY ACTIONS (5 actions) ===
  for (let i = 0; i < 5; i++) {
    actions.push({
      id: `property-${i}`,
      name: `Property Action ${i + 1}`,
      category: 'property',
      execute: async (_gameState, setGameState) => {
        try {
          // Simulate property income
          const income = 1000 * (i + 1);
          setGameState(prev => ({
            ...prev,
            stats: {
              ...prev.stats,
              money: (prev.stats?.money ?? 0) + income,
            },
          }));
          return { success: true, message: `Property generated $${income}` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });
  }

  // === VEHICLE ACTIONS (5 actions) ===
  for (let i = 0; i < 5; i++) {
    actions.push({
      id: `vehicle-${i}`,
      name: `Vehicle Action ${i + 1}`,
      category: 'vehicle',
      execute: async (gameState, setGameState) => {
        try {
          // Simulate vehicle maintenance
          const cost = 100 * (i + 1);
          const currentMoney = gameState?.stats?.money ?? 0;
          
          if (currentMoney >= cost) {
            setGameState(prev => ({
              ...prev,
              stats: {
                ...prev.stats,
                money: (prev.stats?.money ?? 0) - cost,
              },
            }));
            return { success: true, message: `Vehicle maintenance cost $${cost}` };
          }
          return { success: false, message: `Insufficient funds for vehicle` };
        } catch (error) {
          return { success: false, message: `Failed: ${String(error)}` };
        }
      },
    });
  }

  return actions;
}

/**
 * Life Scenario Definitions
 */
export interface LifeScenario {
  id: string;
  name: string;
  description: string;
  actions: Array<{ actionId: string; delay?: number }>;
}

export function generateLifeScenarios(): LifeScenario[] {
  return [
    {
      id: 'quick-success',
      name: 'Quick Success',
      description: 'Fast track to wealth and happiness',
      actions: [
        { actionId: 'add-money-5' }, // $100,000
        { actionId: 'update-health-up-25' },
        { actionId: 'update-happiness-up-50' },
        { actionId: 'update-intelligence-up-25' },
        { actionId: 'advance-week-0' },
        { actionId: 'advance-week-1' },
      ],
    },
    {
      id: 'daily-grind',
      name: 'Daily Grind',
      description: 'Working professional balancing work and life',
      actions: [
        { actionId: 'job-full-time' },
        { actionId: 'update-energy-down-25' },
        { actionId: 'spend-money-2' }, // $1,000
        { actionId: 'update-happiness-up-25' },
        { actionId: 'advance-week-0' },
      ],
    },
    {
      id: 'student-life',
      name: 'Student Life',
      description: 'Part-time work, studying, and social life',
      actions: [
        { actionId: 'job-part-time' },
        { actionId: 'update-intelligence-up-25' },
        { actionId: 'update-energy-down-25' },
        { actionId: 'social-date-0-0' },
        { actionId: 'spend-money-0' }, // $100
        { actionId: 'advance-week-0' },
      ],
    },
    {
      id: 'crisis-mode',
      name: 'Crisis Mode',
      description: 'Dealing with multiple problems at once',
      actions: [
        { actionId: 'update-health-down-50' },
        { actionId: 'update-happiness-down-50' },
        { actionId: 'update-energy-down-50' },
        { actionId: 'spend-money-3' }, // $5,000
        { actionId: 'add-money-0' }, // $100
        { actionId: 'advance-week-0' },
      ],
    },
    {
      id: 'wealth-builder',
      name: 'Wealth Builder',
      description: 'Systematic approach to building wealth',
      actions: [
        { actionId: 'add-money-3' }, // $5,000
        { actionId: 'job-freelance' },
        { actionId: 'update-intelligence-up-25' },
        { actionId: 'spend-money-1' }, // $500
        { actionId: 'advance-week-0' },
        { actionId: 'advance-week-1' },
      ],
    },
  ];
}

/**
 * Run action simulation
 */
export async function runActionSimulation(
  actions: SimulatedAction[],
  getGameState: () => GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onProgress?: (current: number, total: number, action: SimulatedAction) => void
): Promise<{ success: number; failed: number; results: Array<{ action: SimulatedAction; result: { success: boolean; message: string } }> }> {
  const results: Array<{ action: SimulatedAction; result: { success: boolean; message: string } }> = [];
  let success = 0;
  let failed = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    try {
      onProgress?.(i + 1, actions.length, action);
      
      // Get fresh state for each action
      const currentState = getGameState();
      
      // Wrap setGameState to match the expected signature
      const wrappedSetGameState = (updater: (prev: GameState) => GameState) => {
        setGameState(updater);
      };
      
      const result = await action.execute(currentState, wrappedSetGameState);
      results.push({ action, result });
      
      if (result.success) {
        success++;
      } else {
        failed++;
      }
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      logger.error(`Action simulation failed for ${action.name}:`, error);
      results.push({
        action,
        result: { success: false, message: `Error: ${String(error)}` },
      });
      failed++;
    }
  }

  return { success, failed, results };
}

/**
 * Run life scenario simulation
 */
export async function runLifeScenario(
  scenario: LifeScenario,
  actions: SimulatedAction[],
  getGameState: () => GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  onProgress?: (current: number, total: number, actionName: string) => void
): Promise<{ success: number; failed: number; results: Array<{ actionId: string; result: { success: boolean; message: string } }> }> {
  const results: Array<{ actionId: string; result: { success: boolean; message: string } }> = [];
  let success = 0;
  let failed = 0;

  const actionMap = new Map(actions.map(a => [a.id, a]));

  for (let i = 0; i < scenario.actions.length; i++) {
    const scenarioAction = scenario.actions[i];
    const action = actionMap.get(scenarioAction.actionId);
    
    if (!action) {
      results.push({
        actionId: scenarioAction.actionId,
        result: { success: false, message: 'Action not found' },
      });
      failed++;
      continue;
    }

    try {
      onProgress?.(i + 1, scenario.actions.length, action.name);
      
      // Get fresh state for each action
      const currentState = getGameState();
      
      // Wrap setGameState to match the expected signature
      const wrappedSetGameState = (updater: (prev: GameState) => GameState) => {
        setGameState(updater);
      };
      
      const result = await action.execute(currentState, wrappedSetGameState);
      results.push({ actionId: scenarioAction.actionId, result });
      
      if (result.success) {
        success++;
      } else {
        failed++;
      }
      
      // Delay if specified
      if (scenarioAction.delay) {
        await new Promise(resolve => setTimeout(resolve, scenarioAction.delay));
      } else {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      logger.error(`Life scenario action failed for ${action.name}:`, error);
      results.push({
        actionId: scenarioAction.actionId,
        result: { success: false, message: `Error: ${String(error)}` },
      });
      failed++;
    }
  }

  return { success, failed, results };
}

