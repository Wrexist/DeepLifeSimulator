/**
 * Bug tracking and reporting system
 */

import React from 'react';
import { Platform } from 'react-native';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'ui' | 'gameplay' | 'performance' | 'data' | 'crash';
  steps: string[];
  expectedResult: string;
  actualResult: string;
  deviceInfo: {
    platform: string;
    version: string;
    model?: string;
  };
  gameState?: any;
  timestamp: number;
  status: 'open' | 'investigating' | 'fixed' | 'closed';
  priority: number;
}

export interface BugStats {
  total: number;
  open: number;
  fixed: number;
  critical: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

class BugTracker {
  private bugs: BugReport[] = [];
  private listeners: ((bugs: BugReport[]) => void)[] = [];

  /**
   * Report a new bug
   */
  reportBug(bugData: Omit<BugReport, 'id' | 'timestamp' | 'status' | 'priority'>): string {
    const bug: BugReport = {
      ...bugData,
      id: this.generateBugId(),
      timestamp: Date.now(),
      status: 'open',
      priority: this.calculatePriority(bugData.severity, bugData.category),
    };

    this.bugs.push(bug);
    this.notifyListeners();
    this.logBug(bug);

    return bug.id;
  }

  /**
   * Update bug status
   */
  updateBugStatus(bugId: string, status: BugReport['status']): boolean {
    const bug = this.bugs.find(b => b.id === bugId);
    if (bug) {
      bug.status = status;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Get all bugs
   */
  getBugs(): BugReport[] {
    return [...this.bugs];
  }

  /**
   * Get bugs by status
   */
  getBugsByStatus(status: BugReport['status']): BugReport[] {
    return this.bugs.filter(bug => bug.status === status);
  }

  /**
   * Get bugs by severity
   */
  getBugsBySeverity(severity: BugReport['severity']): BugReport[] {
    return this.bugs.filter(bug => bug.severity === severity);
  }

  /**
   * Get bug statistics
   */
  getBugStats(): BugStats {
    const stats: BugStats = {
      total: this.bugs.length,
      open: this.bugs.filter(b => b.status === 'open').length,
      fixed: this.bugs.filter(b => b.status === 'fixed').length,
      critical: this.bugs.filter(b => b.severity === 'critical').length,
      byCategory: {},
      bySeverity: {},
    };

    // Count by category
    this.bugs.forEach(bug => {
      stats.byCategory[bug.category] = (stats.byCategory[bug.category] || 0) + 1;
      stats.bySeverity[bug.severity] = (stats.bySeverity[bug.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get high priority bugs
   */
  getHighPriorityBugs(): BugReport[] {
    return this.bugs
      .filter(bug => bug.priority >= 8)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Search bugs
   */
  searchBugs(query: string): BugReport[] {
    const lowercaseQuery = query.toLowerCase();
    return this.bugs.filter(bug => 
      bug.title.toLowerCase().includes(lowercaseQuery) ||
      bug.description.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Add bug listener
   */
  addListener(listener: (bugs: BugReport[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Clear all bugs
   */
  clearBugs(): void {
    this.bugs = [];
    this.notifyListeners();
  }

  /**
   * Export bugs to JSON
   */
  exportBugs(): string {
    return JSON.stringify(this.bugs, null, 2);
  }

  /**
   * Import bugs from JSON
   */
  importBugs(jsonData: string): boolean {
    try {
      const importedBugs = JSON.parse(jsonData);
      if (Array.isArray(importedBugs)) {
        this.bugs = importedBugs;
        this.notifyListeners();
        return true;
      }
    } catch (error) {
      console.error('Failed to import bugs:', error);
    }
    return false;
  }

  private generateBugId(): string {
    return `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePriority(severity: BugReport['severity'], category: BugReport['category']): number {
    const severityWeights = {
      'low': 1,
      'medium': 3,
      'high': 6,
      'critical': 10,
    };

    const categoryWeights = {
      'crash': 10,
      'data': 8,
      'performance': 6,
      'gameplay': 4,
      'ui': 2,
    };

    return severityWeights[severity] + categoryWeights[category];
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.bugs]));
  }

  private logBug(bug: BugReport): void {
    console.log('Bug reported:', {
      id: bug.id,
      title: bug.title,
      severity: bug.severity,
      category: bug.category,
      priority: bug.priority,
    });
  }
}

export const bugTracker = new BugTracker();

/**
 * Helper function to create bug reports
 */
export function createBugReport(
  title: string,
  description: string,
  severity: BugReport['severity'],
  category: BugReport['category'],
  steps: string[],
  expectedResult: string,
  actualResult: string,
  gameState?: any
): string {
  return bugTracker.reportBug({
    title,
    description,
    severity,
    category,
    steps,
    expectedResult,
    actualResult,
    deviceInfo: {
      platform: Platform.OS,
      version: Platform.Version.toString(),
    },
    gameState,
  });
}

/**
 * React hook for bug tracking
 */
export function useBugTracker() {
  const [bugs, setBugs] = React.useState<BugReport[]>([]);
  const [stats, setStats] = React.useState<BugStats>({
    total: 0,
    open: 0,
    fixed: 0,
    critical: 0,
    byCategory: {},
    bySeverity: {},
  });

  React.useEffect(() => {
    const unsubscribe = bugTracker.addListener((updatedBugs) => {
      setBugs(updatedBugs);
      setStats(bugTracker.getBugStats());
    });

    // Initial load
    setBugs(bugTracker.getBugs());
    setStats(bugTracker.getBugStats());

    return unsubscribe;
  }, []);

  return {
    bugs,
    stats,
    reportBug: bugTracker.reportBug.bind(bugTracker),
    updateBugStatus: bugTracker.updateBugStatus.bind(bugTracker),
    getHighPriorityBugs: bugTracker.getHighPriorityBugs.bind(bugTracker),
    searchBugs: bugTracker.searchBugs.bind(bugTracker),
  };
}
