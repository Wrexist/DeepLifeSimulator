/**
 * Comprehensive Test Runner
 * Executes all game feature tests and generates a detailed bug report
 */

import { ComprehensiveGameSimulator, SimulationReport, SimulationOptions } from './ComprehensiveGameSimulator';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { logger } from '@/utils/logger';
import React from 'react';
import { GameState } from '@/contexts/game/types';

const log = logger.scope('TestRunner');

/**
 * Run comprehensive tests and generate report
 */

export async function runComprehensiveTests(options: SimulationOptions = {}): Promise<SimulationReport> {
  log.info('Starting comprehensive test suite...');

  // Create a test game state
  let testGameState = createTestGameState({
    week: 1,
    money: 1000000, // Give plenty of money for testing
    health: 100,
    happiness: 100,
    energy: 100,
  });

  // Validate and repair the test state before running tests
  const { repairGameState } = require('@/utils/saveValidation');
  const { clampRelationshipScore, clampHobbySkill, clampHobbySkillLevel } = require('@/utils/stateValidation');
  
  // Repair relationships
  if (testGameState.relationships && Array.isArray(testGameState.relationships)) {
    testGameState.relationships = testGameState.relationships.map((rel: any) => {
      if (!rel || typeof rel !== 'object') return rel;
      return {
        ...rel,
        relationshipScore: clampRelationshipScore(rel.relationshipScore ?? 50),
      };
    });
  }
  
  // Repair hobbies
  if (testGameState.hobbies && Array.isArray(testGameState.hobbies)) {
    testGameState.hobbies = testGameState.hobbies.map((hobby: any) => {
      if (!hobby || typeof hobby !== 'object') return hobby;
      return {
        ...hobby,
        skill: clampHobbySkill(hobby.skill ?? 0),
        skillLevel: clampHobbySkillLevel(hobby.skillLevel ?? 1),
      };
    });
  }
  
  // Run full repair
  repairGameState(testGameState);

  // Create a mock setGameState function
  let currentState = testGameState;
  const setGameState: React.Dispatch<React.SetStateAction<GameState>> = (
    updater: React.SetStateAction<GameState>
  ) => {
    if (typeof updater === 'function') {
      currentState = updater(currentState);
    } else {
      currentState = updater;
    }
  };

  // Get game actions from useGame (we'll need to mock this or get it from context)
  // For now, we'll create a minimal mock
  const gameActions: any = {
    buyWarehouse: () => {
      const { buyWarehouse } = require('@/contexts/game/company');
      return buyWarehouse(currentState, setGameState);
    },
    upgradeWarehouse: () => {
      const { upgradeWarehouse } = require('@/contexts/game/company');
      return upgradeWarehouse(currentState, setGameState);
    },
    buyMiner: (minerId: string, minerName: string, cost: number) => {
      const { buyMiner } = require('@/contexts/game/company');
      return buyMiner(currentState, setGameState, minerId, minerName, cost);
    },
    sellMiner: (minerId: string, minerName: string, purchasePrice: number) => {
      const { sellMiner } = require('@/contexts/game/company');
      return sellMiner(currentState, setGameState, minerId, minerName, purchasePrice);
    },
    selectMiningCrypto: (cryptoId: string) => {
      const { selectMiningCrypto } = require('@/contexts/game/company');
      return selectMiningCrypto(currentState, setGameState, cryptoId);
    },
    buyCrypto: (cryptoId: string, amount: number) => {
      // Mock implementation - would need actual implementation
      log.info(`Mock buyCrypto: ${cryptoId}, amount: ${amount}`);
    },
    sellCrypto: (cryptoId: string, amount: number) => {
      // Mock implementation
      log.info(`Mock sellCrypto: ${cryptoId}, amount: ${amount}`);
    },
    swapCrypto: (fromCryptoId: string, toCryptoId: string, amount: number) => {
      // Mock implementation
      log.info(`Mock swapCrypto: ${fromCryptoId} -> ${toCryptoId}, amount: ${amount}`);
    },
    buyItem: (itemId: string) => {
      // Mock implementation
      log.info(`Mock buyItem: ${itemId}`);
    },
    applyForJob: (careerId: string) => {
      const { applyForJob } = require('@/contexts/game/actions/JobActions');
      return applyForJob(currentState, setGameState, careerId);
    },
    promoteCareer: (careerId: string) => {
      const { promoteCareer } = require('@/contexts/game/actions/JobActions');
      return promoteCareer(currentState, setGameState, careerId);
    },
    nextWeek: async () => {
      // For testing, we need to manually call the nextWeek logic
      // Since we can't use hooks, we'll simulate the week progression
      // Update currentState first
      const prevState = currentState;
      const currentWeek = typeof prevState.week === 'number' && !isNaN(prevState.week) && isFinite(prevState.week) && prevState.week >= 1 && prevState.week <= 4
        ? prevState.week
        : 1;
      const nextWeek = currentWeek >= 4 ? 1 : currentWeek + 1;
      const nextWeeksLived = (prevState.weeksLived || 0) + 1;
      
      setGameState(prev => ({
        ...prev,
        week: nextWeek,
        weeksLived: nextWeeksLived,
        date: {
          ...prev.date,
          week: nextWeek,
        },
      }));
      return Promise.resolve();
    },
  };

  // Create simulator instance
  const simulator = new ComprehensiveGameSimulator();

  // Run comprehensive tests
  const report = await simulator.runComprehensiveTest(
    currentState,
    setGameState,
    gameActions
  );

  // Log results
  log.info('Test suite completed!');
  log.info(`Total tests: ${report.totalTests}`);
  log.info(`Passed: ${report.passedTests}`);
  log.info(`Failed: ${report.failedTests}`);
  log.info(`Bugs found: ${report.bugs.length}`);
  log.info(`Warnings: ${report.warnings.length}`);
  log.info(`Execution time: ${report.executionTime}ms`);

  // Generate detailed report
  generateBugReport(report);

  return report;
}

/**
 * Generate a formatted bug report
 */
function generateBugReport(report: SimulationReport): void {
  const criticalBugs = report.bugs.filter(b => b.severity === 'critical');
  const highBugs = report.bugs.filter(b => b.severity === 'high');
  const mediumBugs = report.bugs.filter(b => b.severity === 'medium');
  const lowBugs = report.bugs.filter(b => b.severity === 'low');

  log.info('\n========== COMPREHENSIVE TEST REPORT ==========');
  log.info(`\nTest Summary:`);
  log.info(`  Total Tests: ${report.totalTests}`);
  log.info(`  Passed: ${report.passedTests} (${((report.passedTests / report.totalTests) * 100).toFixed(1)}%)`);
  log.info(`  Failed: ${report.failedTests} (${((report.failedTests / report.totalTests) * 100).toFixed(1)}%)`);
  log.info(`  Execution Time: ${report.executionTime}ms`);

  log.info(`\nBug Summary:`);
  log.info(`  Critical: ${criticalBugs.length}`);
  log.info(`  High: ${highBugs.length}`);
  log.info(`  Medium: ${mediumBugs.length}`);
  log.info(`  Low: ${lowBugs.length}`);
  log.info(`  Total: ${report.bugs.length}`);

  if (report.warnings.length > 0) {
    log.info(`\nWarnings: ${report.warnings.length}`);
    report.warnings.forEach((warning, index) => {
      log.info(`  ${index + 1}. ${warning}`);
    });
  }

  if (criticalBugs.length > 0) {
    log.info(`\n========== CRITICAL BUGS (${criticalBugs.length}) ==========`);
    criticalBugs.forEach((bug, index) => {
      log.info(`\n${index + 1}. [${bug.id}] ${bug.description}`);
      log.info(`   Category: ${bug.category}`);
      log.info(`   Affected Features: ${bug.affectedFeatures.join(', ')}`);
      log.info(`   Steps to Reproduce:`);
      bug.stepsToReproduce.forEach((step, i) => {
        log.info(`     ${i + 1}. ${step}`);
      });
      log.info(`   Expected: ${bug.expectedBehavior}`);
      log.info(`   Actual: ${bug.actualBehavior}`);
      if (bug.stackTrace) {
        log.info(`   Stack Trace: ${bug.stackTrace.substring(0, 200)}...`);
      }
    });
  }

  if (highBugs.length > 0) {
    log.info(`\n========== HIGH PRIORITY BUGS (${highBugs.length}) ==========`);
    highBugs.forEach((bug, index) => {
      log.info(`\n${index + 1}. [${bug.id}] ${bug.description}`);
      log.info(`   Category: ${bug.category}`);
      log.info(`   Affected Features: ${bug.affectedFeatures.join(', ')}`);
      log.info(`   Steps to Reproduce:`);
      bug.stepsToReproduce.forEach((step, i) => {
        log.info(`     ${i + 1}. ${step}`);
      });
      log.info(`   Expected: ${bug.expectedBehavior}`);
      log.info(`   Actual: ${bug.actualBehavior}`);
    });
  }

  if (mediumBugs.length > 0) {
    log.info(`\n========== MEDIUM PRIORITY BUGS (${mediumBugs.length}) ==========`);
    mediumBugs.forEach((bug, index) => {
      log.info(`\n${index + 1}. [${bug.id}] ${bug.description}`);
      log.info(`   Category: ${bug.category}`);
    });
  }

  if (lowBugs.length > 0) {
    log.info(`\n========== LOW PRIORITY BUGS (${lowBugs.length}) ==========`);
    lowBugs.forEach((bug, index) => {
      log.info(`\n${index + 1}. [${bug.id}] ${bug.description}`);
      log.info(`   Category: ${bug.category}`);
    });
  }

  log.info('\n========== END OF REPORT ==========\n');
}

/**
 * Export bug report to JSON file
 */
export async function exportBugReportToFile(report: SimulationReport, filePath: string = 'bug-report.json'): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTests: report.totalTests,
        passedTests: report.passedTests,
        failedTests: report.failedTests,
        executionTime: report.executionTime,
        bugCount: report.bugs.length,
        warningCount: report.warnings.length,
      },
      bugs: report.bugs,
      warnings: report.warnings,
    };

    const fullPath = path.join(process.cwd(), filePath);
    await fs.writeFile(fullPath, JSON.stringify(reportData, null, 2), 'utf-8');
    log.info(`Bug report exported to: ${fullPath}`);
  } catch (error: any) {
    log.error('Failed to export bug report:', error);
  }
}

