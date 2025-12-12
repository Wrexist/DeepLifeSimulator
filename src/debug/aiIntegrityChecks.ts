/**
 * AI Integrity Checks
 * Game-specific sanity checks that AI can analyze for patterns
 * 
 * This module validates game state for inconsistencies, invalid values,
 * and logical contradictions. The output is designed to be easily
 * analyzed by AI assistants for debugging.
 */

import { GameState, GameStats } from '@/contexts/game/types';

export interface IntegrityIssue {
  /** Unique identifier for the issue */
  id: string;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Category of the issue */
  category: 'state' | 'stats' | 'relationships' | 'economy' | 'save' | 'logic' | 'arrays';
  
  /** Human-readable description */
  message: string;
  
  /** Additional context/data */
  details?: unknown;
  
  /** Suggested fix */
  suggestedFix?: string;
}

export interface IntegrityReport {
  /** When the report was generated */
  createdAt: string;
  
  /** Game state version */
  gameVersion: number;
  
  /** Total number of checks run */
  totalChecks: number;
  
  /** Number of checks that passed */
  passedChecks: number;
  
  /** List of issues found */
  issues: IntegrityIssue[];
  
  /** Summary counts by severity */
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  
  /** Overall pass rate */
  passRate: number;
}

// Stat bounds for validation
const STAT_BOUNDS: Record<keyof GameStats, { min: number; max: number }> = {
  health: { min: 0, max: 100 },
  happiness: { min: 0, max: 100 },
  energy: { min: 0, max: 100 },
  fitness: { min: 0, max: 100 },
  reputation: { min: -100, max: 100 },
  money: { min: -Infinity, max: Infinity },
  gems: { min: 0, max: Infinity },
};

/**
 * Run comprehensive integrity checks on game state
 */
export function runIntegrityChecks(state: GameState | null): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  let totalChecks = 0;
  let passedChecks = 0;
  let checkId = 0;

  // Helper to add a check result
  const addCheck = (passed: boolean, issue?: Omit<IntegrityIssue, 'id'>) => {
    totalChecks++;
    if (passed) {
      passedChecks++;
    } else if (issue) {
      issues.push({ ...issue, id: `check-${++checkId}` });
    }
  };

  // === Null State Check ===
  if (!state) {
    return {
      createdAt: new Date().toISOString(),
      gameVersion: 0,
      totalChecks: 1,
      passedChecks: 0,
      issues: [{
        id: 'check-null-state',
        severity: 'critical',
        category: 'state',
        message: 'Game state is null or undefined',
        suggestedFix: 'Initialize game state from initialState or load from save',
      }],
      summary: { critical: 1, high: 0, medium: 0, low: 0 },
      passRate: 0,
    };
  }

  // === Stats Validation ===
  if (state.stats) {
    const stats = state.stats;
    
    // Check each stat exists and is valid
    (Object.keys(STAT_BOUNDS) as (keyof GameStats)[]).forEach(stat => {
      const statName = String(stat);
      const value = stats[stat];
      const bounds = STAT_BOUNDS[stat];
      
      // Check type and NaN
      addCheck(
        typeof value === 'number' && !isNaN(value) && isFinite(value),
        {
          severity: 'high',
          category: 'stats',
          message: `Stat '${statName}' has invalid value: ${value} (type: ${typeof value})`,
          details: { stat: statName, value, expected: 'finite number' },
          suggestedFix: `Reset ${statName} to a valid number (e.g., 50 for percentage stats)`,
        }
      );

      // Check bounds (only if value is a valid number)
      if (typeof value === 'number' && !isNaN(value)) {
        const inBounds = value >= bounds.min && value <= bounds.max;
        addCheck(inBounds, {
          severity: stat === 'money' || stat === 'gems' ? 'medium' : 'high',
          category: 'stats',
          message: `Stat '${statName}' out of bounds: ${value} (expected ${bounds.min} to ${bounds.max})`,
          details: { stat: statName, value, bounds },
          suggestedFix: `Clamp ${statName} to range [${bounds.min}, ${bounds.max}]`,
        });
      }
    });
  } else {
    addCheck(false, {
      severity: 'critical',
      category: 'stats',
      message: 'Stats object is missing from game state',
      suggestedFix: 'Initialize stats with default values from initialState',
    });
  }

  // === Date Validation ===
  if (state.date) {
    // Age check
    addCheck(
      typeof state.date.age === 'number' && state.date.age >= 0 && state.date.age <= 200,
      {
        severity: 'high',
        category: 'state',
        message: `Invalid age: ${state.date.age}`,
        details: { age: state.date.age, expected: '0-200' },
        suggestedFix: 'Reset age to valid range (typically 18 for new game)',
      }
    );

    // Week check (1-4 within month)
    addCheck(
      typeof state.date.week === 'number' && state.date.week >= 1 && state.date.week <= 4,
      {
        severity: 'medium',
        category: 'state',
        message: `Invalid week number: ${state.date.week} (expected 1-4)`,
        details: { week: state.date.week },
        suggestedFix: 'Reset week to 1',
      }
    );

    // Year check
    addCheck(
      typeof state.date.year === 'number' && state.date.year >= 1900 && state.date.year <= 3000,
      {
        severity: 'medium',
        category: 'state',
        message: `Unusual year: ${state.date.year}`,
        details: { year: state.date.year },
        suggestedFix: 'Check year calculation logic',
      }
    );

    // Month check
    const validMonths = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    addCheck(
      validMonths.includes(state.date.month),
      {
        severity: 'low',
        category: 'state',
        message: `Invalid month: ${state.date.month}`,
        details: { month: state.date.month, validMonths },
        suggestedFix: 'Set month to a valid month name',
      }
    );
  } else {
    addCheck(false, {
      severity: 'critical',
      category: 'state',
      message: 'Date object is missing from game state',
      suggestedFix: 'Initialize date with default values',
    });
  }

  // === Array Integrity ===
  const arrayFields = [
    { field: 'careers', critical: true },
    { field: 'hobbies', critical: true },
    { field: 'items', critical: true },
    { field: 'relationships', critical: true },
    { field: 'pets', critical: false },
    { field: 'foods', critical: false },
    { field: 'healthActivities', critical: false },
    { field: 'diseases', critical: false },
    { field: 'realEstate', critical: false },
    { field: 'achievements', critical: true },
    { field: 'streetJobs', critical: false },
    { field: 'jailActivities', critical: false },
    { field: 'cryptos', critical: false },
    { field: 'companies', critical: false },
    { field: 'educations', critical: false },
  ];

  arrayFields.forEach(({ field, critical }) => {
    const arr = (state as any)[field];
    addCheck(
      Array.isArray(arr),
      {
        severity: critical ? 'high' : 'medium',
        category: 'arrays',
        message: `Field '${field}' is not an array (type: ${typeof arr})`,
        details: { field, type: typeof arr, value: arr },
        suggestedFix: `Initialize ${field} as empty array []`,
      }
    );
  });

  // === Relationship Integrity ===
  if (Array.isArray(state.relationships)) {
    state.relationships.forEach((rel, index) => {
      // Check relationship score
      if (typeof rel.relationshipScore === 'number') {
        addCheck(
          rel.relationshipScore >= 0 && rel.relationshipScore <= 100,
          {
            severity: 'low',
            category: 'relationships',
            message: `Relationship '${rel.name}' has invalid score: ${rel.relationshipScore}`,
            details: { name: rel.name, score: rel.relationshipScore, index },
            suggestedFix: 'Clamp relationship score to 0-100',
          }
        );
      }

      // Check required fields
      addCheck(
        !!rel.id && !!rel.name && !!rel.type,
        {
          severity: 'medium',
          category: 'relationships',
          message: `Relationship at index ${index} missing required fields`,
          details: { index, hasId: !!rel.id, hasName: !!rel.name, hasType: !!rel.type },
          suggestedFix: 'Ensure all relationships have id, name, and type',
        }
      );
    });
  }

  // === Economy Checks ===
  if (state.economy) {
    addCheck(
      typeof state.economy.inflationRateAnnual === 'number' &&
      state.economy.inflationRateAnnual >= -1 && 
      state.economy.inflationRateAnnual <= 10,
      {
        severity: 'medium',
        category: 'economy',
        message: `Unusual inflation rate: ${state.economy.inflationRateAnnual}`,
        details: { inflationRate: state.economy.inflationRateAnnual, expected: '-1 to 10' },
        suggestedFix: 'Reset inflation rate to reasonable value (e.g., 0.03)',
      }
    );

    addCheck(
      typeof state.economy.priceIndex === 'number' &&
      state.economy.priceIndex > 0 && 
      state.economy.priceIndex < 1000,
      {
        severity: 'medium',
        category: 'economy',
        message: `Unusual price index: ${state.economy.priceIndex}`,
        details: { priceIndex: state.economy.priceIndex, expected: '0-1000' },
        suggestedFix: 'Reset price index to 1.0',
      }
    );
  }

  // === Logic Checks ===
  
  // Job while in jail
  if (state.jailWeeks > 0 && state.currentJob) {
    addCheck(false, {
      severity: 'low',
      category: 'logic',
      message: 'Player has a current job while in jail',
      details: { jailWeeks: state.jailWeeks, currentJob: state.currentJob },
      suggestedFix: 'Clear currentJob when player goes to jail, restore on release',
    });
  } else {
    addCheck(true);
  }

  // Death popup consistency
  if (state.showDeathPopup) {
    addCheck(
      (state.stats?.health ?? 100) <= 0 || 
      (state.stats?.happiness ?? 100) <= 0 ||
      !!state.deathReason,
      {
        severity: 'medium',
        category: 'logic',
        message: 'Death popup showing but no death condition met',
        details: { 
          showDeathPopup: state.showDeathPopup, 
          health: state.stats?.health,
          happiness: state.stats?.happiness,
          deathReason: state.deathReason,
        },
        suggestedFix: 'Either hide death popup or set a death reason',
      }
    );
  }

  // Zero stat popup consistency
  if (state.showZeroStatPopup && !state.zeroStatType) {
    addCheck(false, {
      severity: 'low',
      category: 'logic',
      message: 'Zero stat popup showing but zeroStatType not set',
      details: { showZeroStatPopup: state.showZeroStatPopup, zeroStatType: state.zeroStatType },
      suggestedFix: 'Set zeroStatType when showing zero stat popup',
    });
  } else {
    addCheck(true);
  }

  // Wanted level range
  if (typeof state.wantedLevel === 'number') {
    addCheck(
      state.wantedLevel >= 0 && state.wantedLevel <= 5,
      {
        severity: 'medium',
        category: 'logic',
        message: `Wanted level out of range: ${state.wantedLevel}`,
        details: { wantedLevel: state.wantedLevel, expected: '0-5' },
        suggestedFix: 'Clamp wanted level to 0-5',
      }
    );
  }

  // Criminal level range
  if (typeof state.criminalLevel === 'number') {
    addCheck(
      state.criminalLevel >= 1 && state.criminalLevel <= 10,
      {
        severity: 'low',
        category: 'logic',
        message: `Criminal level unusual: ${state.criminalLevel}`,
        details: { criminalLevel: state.criminalLevel, expected: '1-10' },
      }
    );
  }

  // Weeks lived vs age consistency
  if (state.date?.age && typeof state.weeksLived === 'number') {
    const expectedMinWeeks = (state.date.age - 18) * 52;
    const expectedMaxWeeks = (state.date.age - 17) * 52;
    
    // Allow some tolerance
    addCheck(
      state.weeksLived >= expectedMinWeeks - 52 && state.weeksLived <= expectedMaxWeeks + 52,
      {
        severity: 'low',
        category: 'logic',
        message: 'Weeks lived inconsistent with age',
        details: { 
          age: state.date.age, 
          weeksLived: state.weeksLived,
          expectedRange: `${expectedMinWeeks}-${expectedMaxWeeks}`,
        },
        suggestedFix: 'Recalculate weeksLived based on age',
      }
    );
  }

  // === Save Version Check ===
  addCheck(
    typeof state.version === 'number' && state.version > 0,
    {
      severity: 'high',
      category: 'save',
      message: `Invalid or missing state version: ${state.version}`,
      details: { version: state.version },
      suggestedFix: 'Set state.version to STATE_VERSION constant',
    }
  );

  // === Settings Check ===
  if (state.settings) {
    addCheck(
      typeof state.settings.darkMode === 'boolean',
      {
        severity: 'low',
        category: 'state',
        message: 'settings.darkMode is not a boolean',
        details: { darkMode: state.settings.darkMode },
        suggestedFix: 'Set darkMode to true or false',
      }
    );
  } else {
    addCheck(false, {
      severity: 'high',
      category: 'state',
      message: 'Settings object is missing',
      suggestedFix: 'Initialize settings from initialState',
    });
  }

  // Build summary
  const summary = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
  };

  return {
    createdAt: new Date().toISOString(),
    gameVersion: state.version ?? 0,
    totalChecks,
    passedChecks,
    issues,
    summary,
    passRate: totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0,
  };
}

/**
 * Quick validation check - fast but less comprehensive
 */
export function quickStateCheck(state: GameState | null): { 
  valid: boolean; 
  criticalIssues: string[];
} {
  if (!state) {
    return { valid: false, criticalIssues: ['State is null'] };
  }
  
  const criticalIssues: string[] = [];
  
  // Check core objects exist
  if (!state.stats) criticalIssues.push('Missing stats');
  if (!state.date) criticalIssues.push('Missing date');
  if (!state.settings) criticalIssues.push('Missing settings');
  
  // Check critical stat values
  if (typeof state.stats?.money !== 'number' || isNaN(state.stats.money)) {
    criticalIssues.push('Invalid money value');
  }
  if (typeof state.stats?.health !== 'number' || isNaN(state.stats.health)) {
    criticalIssues.push('Invalid health value');
  }
  
  // Check arrays
  if (!Array.isArray(state.careers)) criticalIssues.push('Careers not an array');
  if (!Array.isArray(state.items)) criticalIssues.push('Items not an array');
  if (!Array.isArray(state.relationships)) criticalIssues.push('Relationships not an array');
  
  return {
    valid: criticalIssues.length === 0,
    criticalIssues,
  };
}

/**
 * Get issues filtered by severity
 */
export function filterIssuesBySeverity(
  report: IntegrityReport, 
  minSeverity: 'low' | 'medium' | 'high' | 'critical'
): IntegrityIssue[] {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const minLevel = severityOrder[minSeverity];
  
  return report.issues.filter(issue => severityOrder[issue.severity] >= minLevel);
}

/**
 * Get issues filtered by category
 */
export function filterIssuesByCategory(
  report: IntegrityReport,
  category: IntegrityIssue['category']
): IntegrityIssue[] {
  return report.issues.filter(issue => issue.category === category);
}

/**
 * Format report as human-readable text
 */
export function formatReportAsText(report: IntegrityReport): string {
  const lines: string[] = [
    `=== Integrity Report ===`,
    `Generated: ${report.createdAt}`,
    `Game Version: ${report.gameVersion}`,
    `Pass Rate: ${report.passRate}% (${report.passedChecks}/${report.totalChecks})`,
    ``,
    `Summary:`,
    `  Critical: ${report.summary.critical}`,
    `  High: ${report.summary.high}`,
    `  Medium: ${report.summary.medium}`,
    `  Low: ${report.summary.low}`,
  ];
  
  if (report.issues.length > 0) {
    lines.push('', '=== Issues ===');
    report.issues.forEach((issue, i) => {
      lines.push(`${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.suggestedFix) {
        lines.push(`   Fix: ${issue.suggestedFix}`);
      }
    });
  } else {
    lines.push('', 'No issues found!');
  }
  
  return lines.join('\n');
}

