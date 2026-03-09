/**
 * Multi-Week Simulation Test
 * Simulates multiple weeks of gameplay with various actions to find edge cases and corruption
 */

import { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { validateGameStateAfterAction, validateStatsBounds, validateMoney } from '@/lib/validation/stateValidator';
import { validateStateInvariants } from '@/utils/stateInvariants';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import React from 'react';

const log = logger.scope('MultiWeekSimulator');

export interface WeekSimulationResult {
  week: number;
  success: boolean;
  errors: string[];
  warnings: string[];
  stateSnapshot: {
    money: number;
    health: number;
    happiness: number;
    energy: number;
    week: number;
    weeksLived: number;
    age: number;
  };
  actionsPerformed: string[];
}

export interface MultiWeekSimulationReport {
  totalWeeks: number;
  successfulWeeks: number;
  failedWeeks: number;
  weekResults: WeekSimulationResult[];
  finalState: GameState | null;
  corruptionDetected: boolean;
  corruptionDetails: string[];
}

/**
 * Simulate multiple weeks with various actions
 */
export class MultiWeekSimulator {
  private gameState: GameState;
  private setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  private nextWeek: () => Promise<void>;
  private results: WeekSimulationResult[] = [];
  private actionsPerformed: string[] = [];

  constructor(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    nextWeek: () => Promise<void>
  ) {
    this.gameState = gameState;
    this.setGameState = setGameState;
    this.nextWeek = nextWeek;
  }

  /**
   * Run simulation for specified number of weeks
   */
  async runSimulation(weeks: number = WEEKS_PER_YEAR): Promise<MultiWeekSimulationReport> {
    log.info(`Starting multi-week simulation for ${weeks} weeks`);
    this.results = [];
    this.actionsPerformed = [];

    let currentState = this.gameState;
    let corruptionDetected = false;
    const corruptionDetails: string[] = [];

    for (let week = 1; week <= weeks; week++) {
      log.info(`Simulating week ${week}/${weeks}`);
      
      const weekStartState = { ...currentState };
      const weekActions: string[] = [];

      try {
        // Perform various actions before advancing week
        await this.performWeekActions(currentState, week, weekActions);

        // Advance to next week
        await this.nextWeek();

        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get updated state
        currentState = this.gameState;

        // Validate state after week progression
        const validation = this.validateWeekState(currentState, weekStartState, week);
        
        if (!validation.valid) {
          corruptionDetected = true;
          corruptionDetails.push(`Week ${week}: ${validation.errors.join(', ')}`);
        }

        // Record week result
        this.results.push({
          week,
          success: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          stateSnapshot: {
            money: currentState.stats.money,
            health: currentState.stats.health,
            happiness: currentState.stats.happiness,
            energy: currentState.stats.energy,
            week: currentState.week,
            weeksLived: currentState.weeksLived || 0,
            age: currentState.date.age,
          },
          actionsPerformed: [...weekActions],
        });

        // Check for NaN/Infinity corruption
        if (this.detectNaNCorruption(currentState)) {
          corruptionDetected = true;
          corruptionDetails.push(`Week ${week}: NaN/Infinity detected in state`);
        }

        // Check for negative money (should be clamped)
        if (currentState.stats.money < 0) {
          corruptionDetected = true;
          corruptionDetails.push(`Week ${week}: Negative money detected: ${currentState.stats.money}`);
        }

        // Check for out-of-bounds stats
        if (currentState.stats.health < 0 || currentState.stats.health > 100 ||
            currentState.stats.happiness < 0 || currentState.stats.happiness > 100 ||
            currentState.stats.energy < 0 || currentState.stats.energy > 100) {
          corruptionDetected = true;
          corruptionDetails.push(`Week ${week}: Stats out of bounds - health: ${currentState.stats.health}, happiness: ${currentState.stats.happiness}, energy: ${currentState.stats.energy}`);
        }

        // Check for week desynchronization
        const expectedWeeksLived = weekStartState.weeksLived + 1;
        if (currentState.weeksLived !== expectedWeeksLived) {
          corruptionDetected = true;
          corruptionDetails.push(`Week ${week}: WeeksLived desynchronized - expected ${expectedWeeksLived}, got ${currentState.weeksLived}`);
        }

        // Check for age desynchronization
        const expectedAge = weekStartState.date.age + (1/WEEKS_PER_YEAR);
        if (Math.abs(currentState.date.age - expectedAge) > 0.01) {
          corruptionDetected = true;
          corruptionDetails.push(`Week ${week}: Age desynchronized - expected ~${expectedAge.toFixed(2)}, got ${currentState.date.age}`);
        }

      } catch (error) {
        log.error(`Week ${week} simulation failed:`, error);
        this.results.push({
          week,
          success: false,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
          stateSnapshot: {
            money: currentState.stats.money,
            health: currentState.stats.health,
            happiness: currentState.stats.happiness,
            energy: currentState.stats.energy,
            week: currentState.week,
            weeksLived: currentState.weeksLived || 0,
            age: currentState.date.age,
          },
          actionsPerformed: [...weekActions],
        });
        corruptionDetected = true;
        corruptionDetails.push(`Week ${week}: Exception thrown - ${error instanceof Error ? error.message : String(error)}`);
      }

      // Small delay between weeks
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const successfulWeeks = this.results.filter(r => r.success).length;
    const failedWeeks = this.results.filter(r => !r.success).length;

    log.info(`Simulation complete: ${successfulWeeks}/${weeks} weeks successful, ${failedWeeks} failed`);

    return {
      totalWeeks: weeks,
      successfulWeeks,
      failedWeeks,
      weekResults: this.results,
      finalState: currentState,
      corruptionDetected,
      corruptionDetails,
    };
  }

  /**
   * Perform various actions during a week
   */
  private async performWeekActions(state: GameState, week: number, actions: string[]): Promise<void> {
    // Week 1: Buy essential items
    if (week === 1) {
      actions.push('Buy smartphone');
      // Would call buyItem here if we had access
    }

    // Week 5: Apply for a job
    if (week === 5 && state.stats.money > 1000) {
      actions.push('Apply for job');
      // Would call applyForJob here
    }

    // Week 10: Buy a vehicle
    if (week === 10 && state.stats.money > 5000) {
      actions.push('Buy vehicle');
      // Would call purchaseVehicle here
    }

    // Week 20: Create a company
    if (week === 20 && state.stats.money > 50000) {
      actions.push('Create company');
      // Would call createCompany here
    }

    // Every 4 weeks: Check for monthly events
    if (week % 4 === 0) {
      actions.push('Monthly check');
    }
  }

  /**
   * Validate state after week progression
   */
  private validateWeekState(
    currentState: GameState,
    previousState: GameState,
    week: number
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate stats
    const statsValidation = validateStatsBounds(currentState.stats);
    if (!statsValidation.valid) {
      errors.push(...statsValidation.errors);
      warnings.push(...statsValidation.warnings);
    }

    // Validate money
    const moneyValidation = validateMoney(currentState.stats.money);
    if (!moneyValidation.valid) {
      errors.push(...moneyValidation.errors);
    }

    // Validate state invariants
    const invariantValidation = validateStateInvariants(currentState);
    if (!invariantValidation.valid) {
      errors.push(...invariantValidation.errors);
      warnings.push(...invariantValidation.warnings);
    }

    // Check for NaN/Infinity
    if (isNaN(currentState.stats.money) || !isFinite(currentState.stats.money)) {
      errors.push('Money is NaN or Infinity');
    }
    if (isNaN(currentState.stats.health) || !isFinite(currentState.stats.health)) {
      errors.push('Health is NaN or Infinity');
    }
    if (isNaN(currentState.stats.happiness) || !isFinite(currentState.stats.happiness)) {
      errors.push('Happiness is NaN or Infinity');
    }
    if (isNaN(currentState.stats.energy) || !isFinite(currentState.stats.energy)) {
      errors.push('Energy is NaN or Infinity');
    }

    // Check week progression
    if (currentState.weeksLived !== previousState.weeksLived + 1) {
      errors.push(`WeeksLived didn't increment correctly: ${previousState.weeksLived} -> ${currentState.weeksLived}`);
    }

    // Check age progression (should increase by 1/52 per week)
    const expectedAge = previousState.date.age + (1/WEEKS_PER_YEAR);
    if (Math.abs(currentState.date.age - expectedAge) > 0.01) {
      errors.push(`Age didn't increment correctly: ${previousState.date.age} -> ${currentState.date.age} (expected ~${expectedAge.toFixed(2)})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect NaN/Infinity corruption in state
   */
  private detectNaNCorruption(state: GameState): boolean {
    // Check stats
    if (isNaN(state.stats.money) || !isFinite(state.stats.money)) return true;
    if (isNaN(state.stats.health) || !isFinite(state.stats.health)) return true;
    if (isNaN(state.stats.happiness) || !isFinite(state.stats.happiness)) return true;
    if (isNaN(state.stats.energy) || !isFinite(state.stats.energy)) return true;
    if (isNaN(state.stats.fitness) || !isFinite(state.stats.fitness)) return true;
    if (isNaN(state.stats.reputation) || !isFinite(state.stats.reputation)) return true;

    // Check date
    if (isNaN(state.date.age) || !isFinite(state.date.age)) return true;
    if (isNaN(state.date.year) || !isFinite(state.date.year)) return true;

    // Check week
    if (isNaN(state.week) || !isFinite(state.week)) return true;
    if (isNaN(state.weeksLived) || !isFinite(state.weeksLived)) return true;

    return false;
  }
}

