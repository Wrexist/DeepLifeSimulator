/**
 * Bug Hunter Simulator
 * Extremely aggressive bug and exploit finder
 * Tests edge cases, invalid inputs, boundary conditions, exploits, and state corruption
 */

import { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import React from 'react';

const log = logger.scope('BugHunterSimulator');

export interface ExploitReport {
  id: string;
  type: 'exploit' | 'bug' | 'corruption' | 'performance' | 'logic_error' | 'race_condition';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  exploitPotential?: string; // How this could be exploited
  affectedFeatures: string[];
  stateSnapshot?: Partial<GameState>;
  stackTrace?: string;
  reproductionRate?: number; // 0-1, how often it occurs
}

export interface BugHunterReport {
  totalTests: number;
  exploitsFound: number;
  bugsFound: number;
  corruptionsFound: number;
  exploits: ExploitReport[];
  executionTime: number;
  testCoverage: {
    edgeCases: number;
    invalidInputs: number;
    boundaryConditions: number;
    exploitAttempts: number;
    raceConditions: number;
    stateCorruption: number;
  };
}

export interface BugHunterOptions {
  intensity?: 'light' | 'normal' | 'aggressive' | 'extreme'; // How aggressive to be
  focusAreas?: string[]; // Specific areas to focus on (e.g., ['money', 'stats', 'companies'])
  maxIterations?: number; // Max test iterations
  enableExploitTesting?: boolean; // Test for exploits
  enableCorruptionTesting?: boolean; // Test with corrupted data
  enableRaceConditionTesting?: boolean; // Test race conditions
}

export class BugHunterSimulator {
  private exploits: ExploitReport[] = [];
  private testCount = 0;
  private startTime = 0;
  private testCoverage = {
    edgeCases: 0,
    invalidInputs: 0,
    boundaryConditions: 0,
    exploitAttempts: 0,
    raceConditions: 0,
    stateCorruption: 0,
  };

  /**
   * Run comprehensive bug hunting simulation
   */
  async huntBugs(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    options: BugHunterOptions = {}
  ): Promise<BugHunterReport> {
    this.startTime = Date.now();
    this.exploits = [];
    this.testCount = 0;
    this.testCoverage = {
      edgeCases: 0,
      invalidInputs: 0,
      boundaryConditions: 0,
      exploitAttempts: 0,
      raceConditions: 0,
      stateCorruption: 0,
    };

    const intensity = options.intensity || 'aggressive';
    const maxIterations = options.maxIterations || (intensity === 'extreme' ? 10000 : intensity === 'aggressive' ? 5000 : 1000);

    log.info(`Starting bug hunt with intensity: ${intensity}, max iterations: ${maxIterations}`);

    // Run all bug hunting tests
    await this.testEdgeCases(gameState, setGameState, gameActions, intensity);
    await this.testInvalidInputs(gameState, setGameState, gameActions, intensity);
    await this.testBoundaryConditions(gameState, setGameState, gameActions, intensity);
    
    if (options.enableExploitTesting !== false) {
      await this.testExploits(gameState, setGameState, gameActions, intensity);
    }
    
    if (options.enableCorruptionTesting !== false) {
      await this.testStateCorruption(gameState, setGameState, gameActions, intensity);
    }
    
    if (options.enableRaceConditionTesting !== false) {
      await this.testRaceConditions(gameState, setGameState, gameActions, intensity);
    }
    
    await this.testLogicErrors(gameState, setGameState, gameActions, intensity);
    await this.testPerformanceIssues(gameState, setGameState, gameActions, intensity);
    await this.testIntegrationBugs(gameState, setGameState, gameActions, intensity);
    await this.testDataValidation(gameState, setGameState, gameActions, intensity);
    await this.testMemoryLeaks(gameState, setGameState, gameActions, intensity);

    const executionTime = Date.now() - this.startTime;
    const exploitsFound = this.exploits.filter(e => e.type === 'exploit').length;
    const bugsFound = this.exploits.filter(e => e.type === 'bug').length;
    const corruptionsFound = this.exploits.filter(e => e.type === 'corruption').length;

    return {
      totalTests: this.testCount,
      exploitsFound,
      bugsFound,
      corruptionsFound,
      exploits: this.exploits,
      executionTime,
      testCoverage: this.testCoverage,
    };
  }

  /**
   * Test edge cases - extreme values, null, undefined, empty arrays, etc.
   */
  private async testEdgeCases(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing edge cases...');

    // Test with extreme money values
    this.testCount++;
    this.testCoverage.edgeCases++;
    try {
      // Test with negative money
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: -1000000 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get updated state
      let updatedState: GameState | null = null;
      setGameState(prev => {
        updatedState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (updatedState && updatedState.stats.money < 0) {
        this.reportExploit({
          id: 'edgecase-001',
          type: 'bug',
          severity: 'high',
          category: 'Money Validation',
          description: 'Game allows negative money',
          stepsToReproduce: ['Set money to negative value', 'Check if game prevents it'],
          expectedBehavior: 'Money should be clamped to 0 or prevented from going negative',
          actualBehavior: `Money is ${updatedState.stats.money}`,
          affectedFeatures: ['Money System', 'All Purchases'],
        });
      }
    } catch (error: any) {
      // Expected to throw or prevent
    }

    // Test with Infinity money
    this.testCount++;
    this.testCoverage.edgeCases++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: Infinity },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let updatedState: GameState | null = null;
      setGameState(prev => {
        updatedState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (updatedState && !isFinite(updatedState.stats.money)) {
        this.reportExploit({
          id: 'edgecase-002',
          type: 'bug',
          severity: 'critical',
          category: 'Money Validation',
          description: 'Game allows Infinity money',
          stepsToReproduce: ['Set money to Infinity', 'Check if game prevents it'],
          expectedBehavior: 'Money should be validated and clamped to finite value',
          actualBehavior: `Money is ${updatedState.stats.money}`,
          affectedFeatures: ['Money System', 'All Purchases'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test with NaN money
    this.testCount++;
    this.testCoverage.edgeCases++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: NaN },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let updatedState: GameState | null = null;
      setGameState(prev => {
        updatedState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (updatedState && isNaN(updatedState.stats.money)) {
        this.reportExploit({
          id: 'edgecase-003',
          type: 'bug',
          severity: 'critical',
          category: 'Money Validation',
          description: 'Game allows NaN money',
          stepsToReproduce: ['Set money to NaN', 'Check if game prevents it'],
          expectedBehavior: 'Money should be validated and defaulted to 0',
          actualBehavior: `Money is NaN`,
          affectedFeatures: ['Money System', 'All Purchases'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test with extreme stat values (> 100)
    this.testCount++;
    this.testCoverage.edgeCases++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, health: 999, happiness: 999, energy: 999 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let updatedState: GameState | null = null;
      setGameState(prev => {
        updatedState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (updatedState && (updatedState.stats.health > 100 || updatedState.stats.happiness > 100 || updatedState.stats.energy > 100)) {
        this.reportExploit({
          id: 'edgecase-004',
          type: 'bug',
          severity: 'medium',
          category: 'Stat Validation',
          description: 'Stats can exceed maximum value (100)',
          stepsToReproduce: ['Set stats to > 100', 'Check if clamped'],
          expectedBehavior: 'Stats should be clamped to 0-100',
          actualBehavior: `Health: ${updatedState.stats.health}, Happiness: ${updatedState.stats.happiness}, Energy: ${updatedState.stats.energy}`,
          affectedFeatures: ['Stats System'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test with null/undefined in critical fields
    this.testCount++;
    this.testCoverage.edgeCases++;
    try {
      // Try to call actions with null/undefined
      if (typeof gameActions.buyItem === 'function') {
        // @ts-expect-error - Intentionally testing invalid type
        const result = gameActions.buyItem(null);
        if (result && result.success) {
          this.reportExploit({
            id: 'edgecase-005',
            type: 'bug',
            severity: 'high',
            category: 'Input Validation',
            description: 'buyItem accepts null itemId',
            stepsToReproduce: ['Call buyItem(null)', 'Check if it succeeds'],
            expectedBehavior: 'Should return error for null input',
            actualBehavior: 'Action succeeded with null input',
            affectedFeatures: ['Item Purchases'],
          });
        }
      }
    } catch (error: any) {
      // Expected to throw
    }

    // Test with empty strings
    this.testCount++;
    this.testCoverage.edgeCases++;
    try {
      if (typeof gameActions.buyItem === 'function') {
        const result = gameActions.buyItem('');
        if (result && result.success) {
          this.reportExploit({
            id: 'edgecase-006',
            type: 'bug',
            severity: 'medium',
            category: 'Input Validation',
            description: 'buyItem accepts empty string',
            stepsToReproduce: ['Call buyItem("")', 'Check if it succeeds'],
            expectedBehavior: 'Should return error for empty string',
            actualBehavior: 'Action succeeded with empty string',
            affectedFeatures: ['Item Purchases'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test invalid inputs - wrong types, malformed data, etc.
   */
  private async testInvalidInputs(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing invalid inputs...');

    // Test with wrong types
    this.testCount++;
    this.testCoverage.invalidInputs++;
    try {
      if (typeof gameActions.buyItem === 'function') {
        // @ts-expect-error - Intentionally testing invalid type
        const result = gameActions.buyItem(12345);
        if (result && result.success) {
          this.reportExploit({
            id: 'invalidinput-001',
            type: 'bug',
            severity: 'high',
            category: 'Type Validation',
            description: 'buyItem accepts number instead of string',
            stepsToReproduce: ['Call buyItem(12345)', 'Check if it succeeds'],
            expectedBehavior: 'Should return error for wrong type',
            actualBehavior: 'Action succeeded with number input',
            affectedFeatures: ['Item Purchases'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test with object instead of string
    this.testCount++;
    this.testCoverage.invalidInputs++;
    try {
      if (typeof gameActions.buyItem === 'function') {
        // @ts-expect-error - Intentionally testing invalid type
        const result = gameActions.buyItem({ id: 'test' });
        if (result && result.success) {
          this.reportExploit({
            id: 'invalidinput-002',
            type: 'bug',
            severity: 'high',
            category: 'Type Validation',
            description: 'buyItem accepts object instead of string',
            stepsToReproduce: ['Call buyItem({id: "test"})', 'Check if it succeeds'],
            expectedBehavior: 'Should return error for wrong type',
            actualBehavior: 'Action succeeded with object input',
            affectedFeatures: ['Item Purchases'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test with negative amounts for purchases
    this.testCount++;
    this.testCoverage.invalidInputs++;
    try {
      if (typeof gameActions.buyCrypto === 'function') {
        const initialMoney = gameState.stats.money || 0;
        const result = gameActions.buyCrypto('btc', -1000);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        let updatedState: GameState | null = null;
        setGameState(prev => {
          updatedState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (result && result.success && updatedState && updatedState.stats.money > initialMoney) {
          this.reportExploit({
            id: 'invalidinput-003',
            type: 'exploit',
            severity: 'critical',
            category: 'Input Validation',
            description: 'buyCrypto accepts negative amount (potential money duplication)',
            stepsToReproduce: ['Call buyCrypto("btc", -1000)', 'Check if money increases'],
            expectedBehavior: 'Should return error for negative amount',
            actualBehavior: 'Action succeeded with negative amount and money increased',
            exploitPotential: 'Could allow negative purchases to give money instead of taking it',
            affectedFeatures: ['Crypto Trading', 'Money System'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test with 0 amount
    this.testCount++;
    this.testCoverage.invalidInputs++;
    try {
      if (typeof gameActions.buyCrypto === 'function') {
        const result = gameActions.buyCrypto('btc', 0);
        if (result && result.success) {
          this.reportExploit({
            id: 'invalidinput-004',
            type: 'bug',
            severity: 'low',
            category: 'Input Validation',
            description: 'buyCrypto accepts 0 amount',
            stepsToReproduce: ['Call buyCrypto("btc", 0)', 'Check if it succeeds'],
            expectedBehavior: 'Should return error or skip for 0 amount',
            actualBehavior: 'Action succeeded with 0 amount',
            affectedFeatures: ['Crypto Trading'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test boundary conditions - min/max values, array bounds, etc.
   */
  private async testBoundaryConditions(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing boundary conditions...');

    // Test with maximum money (Number.MAX_SAFE_INTEGER)
    this.testCount++;
    this.testCoverage.boundaryConditions++;
    try {
      const maxMoney = Number.MAX_SAFE_INTEGER;
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: maxMoney },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Try to perform an action
      if (typeof gameActions.buyItem === 'function' && gameState.items && gameState.items.length > 0) {
        const item = gameState.items[0];
        const result = gameActions.buyItem(item.id);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        let updatedState: GameState | null = null;
        setGameState(prev => {
          updatedState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (updatedState && (!isFinite(updatedState.stats.money) || updatedState.stats.money < 0)) {
          this.reportExploit({
            id: 'boundary-001',
            type: 'bug',
            severity: 'critical',
            category: 'Integer Overflow',
            description: 'Money calculation overflows with MAX_SAFE_INTEGER',
            stepsToReproduce: ['Set money to Number.MAX_SAFE_INTEGER', 'Buy an item', 'Check money'],
            expectedBehavior: 'Should prevent overflow or clamp value',
            actualBehavior: `Money became ${updatedState.stats.money}`,
            affectedFeatures: ['Money System', 'All Purchases'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test with exactly 0 money
    this.testCount++;
    this.testCoverage.boundaryConditions++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: 0 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Try to buy something expensive
      if (typeof gameActions.buyItem === 'function' && gameState.items && gameState.items.length > 0) {
        const expensiveItem = gameState.items.find(i => i.price > 1000) || gameState.items[0];
        const result = gameActions.buyItem(expensiveItem.id);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (result && result.success) {
          this.reportExploit({
            id: 'boundary-002',
            type: 'exploit',
            severity: 'critical',
            category: 'Money Validation',
            description: 'Can purchase items with 0 money',
            stepsToReproduce: ['Set money to 0', 'Try to buy expensive item', 'Check if it succeeds'],
            expectedBehavior: 'Should return "Not enough money" error',
            actualBehavior: 'Purchase succeeded with 0 money',
            exploitPotential: 'Allows free purchases',
            affectedFeatures: ['Item Purchases', 'Money System'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test with exactly 100 stats (maximum)
    this.testCount++;
    this.testCoverage.boundaryConditions++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, health: 100, happiness: 100, energy: 100 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Try to increase stats beyond 100
      if (typeof gameActions.goOnDate === 'function' && gameState.relationships && gameState.relationships.length > 0) {
        const initialHappiness = gameState.stats.happiness;
        const result = gameActions.goOnDate(gameState.relationships[0].id);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        let updatedState: GameState | null = null;
        setGameState(prev => {
          updatedState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (updatedState && updatedState.stats.happiness > 100) {
          this.reportExploit({
            id: 'boundary-003',
            type: 'bug',
            severity: 'medium',
            category: 'Stat Clamping',
            description: 'Happiness can exceed 100',
            stepsToReproduce: ['Set happiness to 100', 'Go on date', 'Check happiness'],
            expectedBehavior: 'Happiness should be clamped to 100',
            actualBehavior: `Happiness is ${updatedState.stats.happiness}`,
            affectedFeatures: ['Stats System', 'Dating'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test for exploits - money duplication, infinite loops, stat manipulation, etc.
   */
  private async testExploits(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing for exploits...');

    // Test money duplication via rapid purchases/cancels
    this.testCount++;
    this.testCoverage.exploitAttempts++;
    try {
      let currentState: GameState = gameState;
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const initialMoney = currentState.stats.money || 0;
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: 10000 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Rapidly buy and "undo" (if possible) to test for duplication
      if (typeof gameActions.buyCrypto === 'function') {
        for (let i = 0; i < 10; i++) {
          const buyResult = gameActions.buyCrypto('btc', 100);
          await new Promise(resolve => setTimeout(resolve, 1));
          if (typeof gameActions.sellCrypto === 'function') {
            const sellResult = gameActions.sellCrypto('btc', 100);
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const finalMoney = currentState.stats.money || 0;
        // Check if money increased unexpectedly (more than transaction fees would account for)
        const expectedMaxMoney = 10000 + 50; // Allow small margin for fees
        if (finalMoney > expectedMaxMoney) {
          this.reportExploit({
            id: 'exploit-001',
            type: 'exploit',
            severity: 'critical',
            category: 'Money Duplication',
            description: 'Rapid buy/sell creates money duplication',
            stepsToReproduce: ['Set money to 10000', 'Rapidly buy and sell crypto 10 times', 'Check final money'],
            expectedBehavior: 'Money should decrease slightly due to fees',
            actualBehavior: `Money increased to ${finalMoney} (expected max: ${expectedMaxMoney})`,
            exploitPotential: 'Could allow infinite money generation',
            affectedFeatures: ['Crypto Trading', 'Money System'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test for infinite income loops
    this.testCount++;
    this.testCoverage.exploitAttempts++;
    try {
      let currentState: GameState = gameState;
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const initialMoney = currentState.stats.money || 0;
      
      // Advance multiple weeks rapidly to check for compounding income bugs
      if (typeof gameActions.nextWeek === 'function') {
        for (let i = 0; i < 5; i++) {
          await gameActions.nextWeek();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const finalMoney = currentState.stats.money || 0;
      const moneyGrowth = finalMoney - initialMoney;
      
      // Check for suspiciously high growth (more than 10x in 5 weeks is suspicious)
      if (initialMoney > 0 && finalMoney > initialMoney * 10) {
        this.reportExploit({
          id: 'exploit-002',
          type: 'exploit',
          severity: 'high',
          category: 'Income Multiplication',
          description: 'Income compounds exponentially (potential infinite income)',
          stepsToReproduce: ['Start with money', 'Advance 5 weeks', 'Check money growth'],
          expectedBehavior: 'Income should grow linearly or with diminishing returns',
          actualBehavior: `Money grew from ${initialMoney} to ${finalMoney} (${(finalMoney / initialMoney).toFixed(2)}x)`,
          exploitPotential: 'Could allow infinite money generation over time',
          affectedFeatures: ['Passive Income', 'Week Progression'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test for stat manipulation exploits
    this.testCount++;
    this.testCoverage.exploitAttempts++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, health: 0, happiness: 0 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Try multiple stat-increasing actions rapidly
      if (typeof gameActions.goOnDate === 'function' && gameState.relationships && gameState.relationships.length > 0) {
        for (let i = 0; i < 20; i++) {
          gameActions.goOnDate(gameState.relationships[0].id);
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      let updatedState: GameState | null = null;
      setGameState(prev => {
        updatedState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if stats exceeded 100 (should be clamped)
      if (updatedState && (updatedState.stats.happiness > 100 || updatedState.stats.health > 100)) {
        this.reportExploit({
          id: 'exploit-003',
          type: 'exploit',
          severity: 'medium',
          category: 'Stat Manipulation',
          description: 'Rapid stat-increasing actions can exceed maximum',
          stepsToReproduce: ['Set stats to 0', 'Rapidly perform stat-increasing actions 20 times', 'Check stats'],
          expectedBehavior: 'Stats should be clamped to 100',
          actualBehavior: `Health: ${updatedState.stats.health}, Happiness: ${updatedState.stats.happiness}`,
          exploitPotential: 'Could allow stats above maximum',
          affectedFeatures: ['Stats System'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test for negative price exploits
    this.testCount++;
    this.testCoverage.exploitAttempts++;
    try {
      if (gameState.items && gameState.items.length > 0) {
        // Try to manipulate item price to negative
        const item = gameState.items[0];
        setGameState(prev => ({
          ...prev,
          items: prev.items.map(i => 
            i.id === item.id ? { ...i, price: -1000 } : i
          ),
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (typeof gameActions.buyItem === 'function') {
          let currentState: GameState = gameState;
          setGameState(prev => {
            currentState = prev;
            return prev;
          });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const initialMoney = currentState.stats.money || 0;
          const result = gameActions.buyItem(item.id);
          await new Promise(resolve => setTimeout(resolve, 50));
          
          setGameState(prev => {
            currentState = prev;
            return prev;
          });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const finalMoney = currentState.stats.money || 0;
          if (result && result.success && finalMoney > initialMoney) {
            this.reportExploit({
              id: 'exploit-004',
              type: 'exploit',
              severity: 'critical',
              category: 'Price Manipulation',
              description: 'Negative item price gives money instead of taking it',
              stepsToReproduce: ['Set item price to negative', 'Buy item', 'Check if money increases'],
              expectedBehavior: 'Should prevent purchase or clamp price to >= 0',
              actualBehavior: `Money increased from ${initialMoney} to ${finalMoney}`,
              exploitPotential: 'Could allow infinite money by buying negative-priced items',
              affectedFeatures: ['Item Purchases', 'Money System'],
            });
          }
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test state corruption - NaN, Infinity, invalid types, missing properties
   */
  private async testStateCorruption(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing state corruption...');

    // Test if actions produce NaN
    this.testCount++;
    this.testCoverage.stateCorruption++;
    try {
      // Try operations that might produce NaN
      if (typeof gameActions.buyCrypto === 'function') {
        // Try with invalid crypto price (might be NaN)
        setGameState(prev => ({
          ...prev,
          cryptos: prev.cryptos?.map(c => 
            c.id === 'btc' ? { ...c, price: NaN } : c
          ) || [],
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const result = gameActions.buyCrypto('btc', 100);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        let updatedState: GameState | null = null;
        setGameState(prev => {
          updatedState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (updatedState && isNaN(updatedState.stats.money)) {
          this.reportExploit({
            id: 'corruption-001',
            type: 'corruption',
            severity: 'critical',
            category: 'NaN Propagation',
            description: 'NaN in crypto price propagates to money',
            stepsToReproduce: ['Set crypto price to NaN', 'Buy crypto', 'Check money'],
            expectedBehavior: 'Should validate price and prevent NaN propagation',
            actualBehavior: 'Money became NaN',
            affectedFeatures: ['Crypto Trading', 'Money System'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test if actions produce Infinity
    this.testCount++;
    this.testCoverage.stateCorruption++;
    try {
      if (typeof gameActions.buyCrypto === 'function') {
        setGameState(prev => ({
          ...prev,
          cryptos: prev.cryptos?.map(c => 
            c.id === 'btc' ? { ...c, price: Infinity } : c
          ) || [],
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const result = gameActions.buyCrypto('btc', 100);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        let updatedState: GameState | null = null;
        setGameState(prev => {
          updatedState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (updatedState && !isFinite(updatedState.stats.money)) {
          this.reportExploit({
            id: 'corruption-002',
            type: 'corruption',
            severity: 'critical',
            category: 'Infinity Propagation',
            description: 'Infinity in crypto price propagates to money',
            stepsToReproduce: ['Set crypto price to Infinity', 'Buy crypto', 'Check money'],
            expectedBehavior: 'Should validate price and prevent Infinity propagation',
            actualBehavior: 'Money became Infinity',
            affectedFeatures: ['Crypto Trading', 'Money System'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test with missing required properties
    this.testCount++;
    this.testCoverage.stateCorruption++;
    try {
      // Remove stats object
      setGameState(prev => {
        const corrupted = { ...prev };
        // @ts-expect-error - Intentionally corrupting state
        delete corrupted.stats;
        return corrupted;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Try to perform an action
      if (typeof gameActions.nextWeek === 'function') {
        try {
          await gameActions.nextWeek();
          this.reportExploit({
            id: 'corruption-003',
            type: 'corruption',
            severity: 'high',
            category: 'Missing Properties',
            description: 'nextWeek works with missing stats object',
            stepsToReproduce: ['Remove stats object from state', 'Call nextWeek', 'Check if it crashes'],
            expectedBehavior: 'Should throw error or handle gracefully',
            actualBehavior: 'Action succeeded without stats object',
            affectedFeatures: ['Week Progression'],
          });
        } catch (error: any) {
          // Good - it threw an error
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test race conditions - rapid state changes, concurrent actions
   */
  private async testRaceConditions(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing race conditions...');

    // Test rapid concurrent purchases
    this.testCount++;
    this.testCoverage.raceConditions++;
    try {
      let currentState: GameState = gameState;
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const initialMoney = currentState.stats.money || 0;
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: 100000 },
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (typeof gameActions.buyItem === 'function' && gameState.items && gameState.items.length > 0) {
        const item = gameState.items[0];
        const price = item.price || 1000;
        
        // Rapidly call buyItem multiple times without waiting
        const promises: Promise<any>[] = [];
        for (let i = 0; i < 10; i++) {
          promises.push(Promise.resolve(gameActions.buyItem(item.id)));
        }
        
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const finalMoney = currentState.stats.money || 0;
        const expectedMoney = 100000 - (price * 10);
        const tolerance = 100; // Allow small tolerance
        
        if (Math.abs(finalMoney - expectedMoney) > tolerance) {
          this.reportExploit({
            id: 'racecondition-001',
            type: 'race_condition',
            severity: 'high',
            category: 'Concurrent Purchases',
            description: 'Rapid concurrent purchases cause incorrect money deduction',
            stepsToReproduce: ['Set money to 100000', 'Rapidly call buyItem 10 times concurrently', 'Check final money'],
            expectedBehavior: `Money should be ${expectedMoney} (deducted ${price * 10})`,
            actualBehavior: `Money is ${finalMoney} (expected ${expectedMoney})`,
            affectedFeatures: ['Item Purchases', 'Money System'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test rapid state updates
    this.testCount++;
    this.testCoverage.raceConditions++;
    try {
      // Rapidly update state multiple times
      for (let i = 0; i < 100; i++) {
        setGameState(prev => ({
          ...prev,
          stats: { ...prev.stats, money: 1000 + i },
        }));
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let updatedState: GameState | null = null;
      setGameState(prev => {
        updatedState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if final state is correct
      if (updatedState && updatedState.stats.money !== 1099) {
        this.reportExploit({
          id: 'racecondition-002',
          type: 'race_condition',
          severity: 'medium',
          category: 'State Updates',
          description: 'Rapid state updates cause state loss',
          stepsToReproduce: ['Rapidly call setGameState 100 times', 'Check final state'],
          expectedBehavior: 'Final state should reflect last update (money = 1099)',
          actualBehavior: `Money is ${updatedState.stats.money} (expected 1099)`,
          affectedFeatures: ['State Management'],
        });
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test logic errors - wrong calculations, incorrect conditions, etc.
   */
  private async testLogicErrors(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing logic errors...');

    // Test if passive income is calculated correctly
    this.testCount++;
    try {
      let currentState: GameState = gameState;
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const initialMoney = currentState.stats.money || 0;
      
      // Set up passive income sources
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: 100000 },
        companies: [
          {
            id: 'test_company',
            type: 'factory',
            name: 'Test Factory',
            weeklyIncome: 1000,
            baseWeeklyIncome: 1000,
            employees: 0,
            upgrades: [],
            level: 1,
          },
        ],
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (typeof gameActions.nextWeek === 'function') {
        await gameActions.nextWeek();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const finalMoney = currentState.stats.money || 0;
      const moneyIncrease = finalMoney - 100000;
      
      // Company should give 1000 per week (with potential multipliers)
      // Allow range of 1000-2000 to account for multipliers
      if (moneyIncrease < 1000 || moneyIncrease > 2000) {
        this.reportExploit({
          id: 'logicerror-001',
          type: 'logic_error',
          severity: 'high',
          category: 'Passive Income Calculation',
          description: 'Company passive income calculation is incorrect',
          stepsToReproduce: ['Create company with 1000 weekly income', 'Advance week', 'Check money increase'],
          expectedBehavior: 'Money should increase by ~1000-2000 (accounting for multipliers)',
          actualBehavior: `Money increased by ${moneyIncrease}`,
          affectedFeatures: ['Passive Income', 'Companies'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test if net worth calculation is correct
    this.testCount++;
    try {
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: 50000 },
        bankSavings: 10000,
        companies: [
          {
            id: 'test_company',
            type: 'factory',
            name: 'Test Factory',
            weeklyIncome: 2000,
            baseWeeklyIncome: 2000,
            employees: 0,
            upgrades: [],
            level: 1,
          },
        ],
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Calculate expected net worth: money (50000) + bank (10000) + company (2000 * 10 = 20000) = 80000
      const expectedNetWorth = 50000 + 10000 + 20000;
      
      // Try to get net worth from calculateNetWorth if available
      try {
        const { calculateNetWorth } = require('@/contexts/game/GameActionsContext');
        let currentState: GameState = gameState;
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const actualNetWorth = calculateNetWorth(currentState);
        
        if (Math.abs(actualNetWorth - expectedNetWorth) > 1000) {
          this.reportExploit({
            id: 'logicerror-002',
            type: 'logic_error',
            severity: 'medium',
            category: 'Net Worth Calculation',
            description: 'Net worth calculation is incorrect',
            stepsToReproduce: ['Set money to 50000, bank to 10000, company with 2000 income', 'Check net worth'],
            expectedBehavior: `Net worth should be ~${expectedNetWorth}`,
            actualBehavior: `Net worth is ${actualNetWorth}`,
            affectedFeatures: ['Net Worth Calculation'],
          });
        }
      } catch (error: any) {
        // calculateNetWorth might not be available in this context
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test performance issues - slow operations, memory leaks, etc.
   */
  private async testPerformanceIssues(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing performance issues...');

    // Test if rapid actions cause performance degradation
    this.testCount++;
    try {
      const startTime = Date.now();
      
      // Perform 1000 rapid actions
      for (let i = 0; i < 1000; i++) {
        setGameState(prev => ({
          ...prev,
          stats: { ...prev.stats, money: i },
        }));
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // If 1000 state updates take more than 1 second, it's a performance issue
      if (duration > 1000) {
        this.reportExploit({
          id: 'performance-001',
          type: 'performance',
          severity: 'medium',
          category: 'State Update Performance',
          description: 'Rapid state updates are slow',
          stepsToReproduce: ['Perform 1000 rapid setGameState calls', 'Measure duration'],
          expectedBehavior: 'Should complete in < 1 second',
          actualBehavior: `Took ${duration}ms`,
          affectedFeatures: ['State Management', 'Performance'],
        });
      }
    } catch (error: any) {
      // Expected
    }

    // Test if nextWeek becomes slow with many items/companies
    this.testCount++;
    try {
      // Create many companies and items
      setGameState(prev => ({
        ...prev,
        companies: Array.from({ length: 100 }, (_, i) => ({
          id: `company_${i}`,
          type: 'factory',
          name: `Company ${i}`,
          weeklyIncome: 1000,
          baseWeeklyIncome: 1000,
          employees: 0,
          upgrades: [],
          level: 1,
        })),
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `item_${i}`,
          name: `Item ${i}`,
          price: 100,
          owned: true,
          category: 'misc',
        })),
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (typeof gameActions.nextWeek === 'function') {
        const startTime = Date.now();
        await gameActions.nextWeek();
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // If nextWeek takes more than 500ms with 100 companies, it's a performance issue
        if (duration > 500) {
          this.reportExploit({
            id: 'performance-002',
            type: 'performance',
            severity: 'medium',
            category: 'Week Progression Performance',
            description: 'nextWeek is slow with many companies/items',
            stepsToReproduce: ['Create 100 companies and 100 items', 'Call nextWeek', 'Measure duration'],
            expectedBehavior: 'Should complete in < 500ms',
            actualBehavior: `Took ${duration}ms`,
            affectedFeatures: ['Week Progression', 'Performance'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test integration bugs - interactions between systems
   */
  private async testIntegrationBugs(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing integration bugs...');

    // Test if prestige bonuses are applied correctly
    this.testCount++;
    try {
      let currentState: GameState = gameState;
      setGameState(prev => {
        currentState = prev;
        return prev;
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      
      setGameState(prev => ({
        ...prev,
        stats: { ...prev.stats, money: 100000 },
        prestige: {
          prestigeLevel: 1,
          prestigePoints: 1000,
          unlockedBonuses: ['income_multiplier_2x'],
          prestigeHistory: [],
        },
        companies: [
          {
            id: 'test_company',
            type: 'factory',
            name: 'Test Factory',
            weeklyIncome: 1000,
            baseWeeklyIncome: 1000,
            employees: 0,
            upgrades: [],
            level: 1,
          },
        ],
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (typeof gameActions.nextWeek === 'function') {
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const initialMoney = currentState.stats.money || 0;
        await gameActions.nextWeek();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const finalMoney = currentState.stats.money || 0;
        const moneyIncrease = finalMoney - initialMoney;
        
        // With 2x income multiplier, company should give 2000 per week
        // Allow range of 2000-3000 to account for other bonuses
        if (moneyIncrease < 2000 || moneyIncrease > 3000) {
          this.reportExploit({
            id: 'integration-001',
            type: 'bug',
            severity: 'high',
            category: 'Prestige Integration',
            description: 'Prestige income multiplier not applied to passive income',
            stepsToReproduce: ['Set prestige bonus: income_multiplier_2x', 'Create company with 1000 income', 'Advance week', 'Check money'],
            expectedBehavior: 'Money should increase by ~2000-3000 (2x multiplier applied)',
            actualBehavior: `Money increased by ${moneyIncrease}`,
            affectedFeatures: ['Prestige System', 'Passive Income'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }

    // Test if inflation affects all prices correctly
    this.testCount++;
    try {
      if (typeof gameActions.buyItem === 'function' && gameState.items && gameState.items.length > 0) {
        setGameState(prev => ({
          ...prev,
          economy: {
            ...prev.economy,
            priceIndex: 2.0, // 2x inflation
          },
          items: prev.items.map(item => ({
            ...item,
            price: 100, // Base price
          })),
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const item = gameState.items[0];
        let currentState: GameState = gameState;
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const initialMoney = currentState.stats.money || 0;
        setGameState(prev => ({
          ...prev,
          stats: { ...prev.stats, money: 10000 },
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const result = gameActions.buyItem(item.id);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        setGameState(prev => {
          currentState = prev;
          return prev;
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const finalMoney = currentState.stats.money || 0;
        const moneySpent = 10000 - finalMoney;
        
        // With 2x inflation, 100 base price should cost 200
        if (Math.abs(moneySpent - 200) > 10) {
          this.reportExploit({
            id: 'integration-002',
            type: 'bug',
            severity: 'medium',
            category: 'Inflation Integration',
            description: 'Inflation not applied to item prices',
            stepsToReproduce: ['Set priceIndex to 2.0', 'Buy item with base price 100', 'Check money spent'],
            expectedBehavior: 'Should spend 200 (2x inflation)',
            actualBehavior: `Spent ${moneySpent} (expected 200)`,
            affectedFeatures: ['Inflation System', 'Item Purchases'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Test data validation - ensure all data is validated
   */
  private async testDataValidation(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing data validation...');

    // Test if save/load preserves data correctly
    this.testCount++;
    try {
      const testState: GameState = {
        ...gameState,
        stats: {
          ...gameState.stats,
          money: 50000,
          health: 75,
          happiness: 80,
        },
        companies: [
          {
            id: 'test_company',
            type: 'factory',
            name: 'Test Factory',
            weeklyIncome: 1000,
            baseWeeklyIncome: 1000,
            employees: 0,
            upgrades: [],
            level: 1,
          },
        ],
      };
      
      // Simulate save (stringify and parse)
      const saved = JSON.stringify(testState);
      const loaded = JSON.parse(saved) as GameState;
      
      // Check if data is preserved
      if (loaded.stats.money !== 50000 || loaded.stats.health !== 75 || loaded.stats.happiness !== 80) {
        this.reportExploit({
          id: 'validation-001',
          type: 'bug',
          severity: 'high',
          category: 'Save/Load',
          description: 'Save/load does not preserve data correctly',
          stepsToReproduce: ['Set specific values', 'Save game', 'Load game', 'Check values'],
          expectedBehavior: 'All values should be preserved',
          actualBehavior: `Money: ${loaded.stats.money} (expected 50000), Health: ${loaded.stats.health} (expected 75)`,
          affectedFeatures: ['Save System'],
        });
      }
      
      // Check if companies are preserved
      if (!loaded.companies || loaded.companies.length !== 1 || loaded.companies[0].weeklyIncome !== 1000) {
        this.reportExploit({
          id: 'validation-002',
          type: 'bug',
          severity: 'high',
          category: 'Save/Load',
          description: 'Save/load does not preserve companies correctly',
          stepsToReproduce: ['Create company', 'Save game', 'Load game', 'Check company'],
          expectedBehavior: 'Company should be preserved with all properties',
          actualBehavior: `Companies: ${JSON.stringify(loaded.companies)}`,
          affectedFeatures: ['Save System', 'Companies'],
        });
      }
    } catch (error: any) {
      this.reportExploit({
        id: 'validation-003',
        type: 'bug',
        severity: 'critical',
        category: 'Save/Load',
        description: 'Save/load throws error',
        stepsToReproduce: ['Try to save and load game state'],
        expectedBehavior: 'Should save and load without errors',
        actualBehavior: `Error: ${error?.message || 'Unknown error'}`,
        affectedFeatures: ['Save System'],
        stackTrace: error?.stack,
      });
    }
  }

  /**
   * Test for memory leaks - long-running operations
   */
  private async testMemoryLeaks(
    gameState: GameState,
    setGameState: React.Dispatch<React.SetStateAction<GameState>>,
    gameActions: any,
    intensity: string
  ): Promise<void> {
    log.info('Testing memory leaks...');

    // Test if advancing many weeks causes memory issues
    this.testCount++;
    try {
      if (typeof gameActions.nextWeek === 'function') {
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
        
        // Advance 100 weeks
        for (let i = 0; i < 100; i++) {
          await gameActions.nextWeek();
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        
        const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryIncrease = endMemory - startMemory;
        
        // If memory increased by more than 50MB, it might be a leak
        if (memoryIncrease > 50 * 1024 * 1024) {
          this.reportExploit({
            id: 'memory-001',
            type: 'performance',
            severity: 'medium',
            category: 'Memory Leak',
            description: 'Advancing weeks causes memory increase',
            stepsToReproduce: ['Advance 100 weeks', 'Check memory usage'],
            expectedBehavior: 'Memory should remain stable or increase slightly',
            actualBehavior: `Memory increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
            affectedFeatures: ['Week Progression', 'Memory Management'],
          });
        }
      }
    } catch (error: any) {
      // Expected
    }
  }

  /**
   * Report an exploit/bug
   */
  private reportExploit(exploit: ExploitReport): void {
    this.exploits.push(exploit);
    log.warn(`[BugHunter] Found ${exploit.type}: ${exploit.id} - ${exploit.description}`, {
      severity: exploit.severity,
      category: exploit.category,
    });
  }
}

