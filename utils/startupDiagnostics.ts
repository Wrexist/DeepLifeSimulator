/**
 * Startup Diagnostics
 * 
 * PHASE 6.1: Tracks startup sequence timing and module load times
 * to identify bottlenecks and diagnose crashes.
 */

interface PhaseTiming {
  phase: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

interface ModuleLoadInfo {
  moduleName: string;
  loadStartTime: number;
  loadEndTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

interface StartupDiagnostics {
  startTime: number;
  phases: PhaseTiming[];
  moduleLoads: ModuleLoadInfo[];
  endTime?: number;
  totalDuration?: number;
}

let diagnostics: StartupDiagnostics | null = null;
let currentPhase: PhaseTiming | null = null;

/**
 * Initialize startup diagnostics
 */
export function initializeStartupDiagnostics(): void {
  diagnostics = {
    startTime: Date.now(),
    phases: [],
    moduleLoads: [],
  };
}

/**
 * Start tracking a startup phase
 */
export function startPhase(phaseName: string): void {
  if (!diagnostics) {
    initializeStartupDiagnostics();
  }
  
  // End previous phase if any
  if (currentPhase) {
    endPhase(true);
  }
  
  currentPhase = {
    phase: phaseName,
    startTime: Date.now(),
    success: false,
  };
  
  if (diagnostics) {
    diagnostics.phases.push(currentPhase);
  }
}

/**
 * End tracking current startup phase
 */
export function endPhase(success: boolean, error?: string): void {
  if (currentPhase) {
    currentPhase.endTime = Date.now();
    currentPhase.duration = currentPhase.endTime - currentPhase.startTime;
    currentPhase.success = success;
    if (error) {
      currentPhase.error = error;
    }
    currentPhase = null;
  }
}

/**
 * Track module load
 */
export function trackModuleLoad(moduleName: string): (success: boolean, error?: string) => void {
  if (!diagnostics) {
    initializeStartupDiagnostics();
  }
  
  const loadInfo: ModuleLoadInfo = {
    moduleName,
    loadStartTime: Date.now(),
    success: false,
  };
  
  if (diagnostics) {
    diagnostics.moduleLoads.push(loadInfo);
  }
  
  // Return function to mark load as complete
  return (success: boolean, error?: string) => {
    loadInfo.loadEndTime = Date.now();
    loadInfo.duration = loadInfo.loadEndTime - loadInfo.loadStartTime;
    loadInfo.success = success;
    if (error) {
      loadInfo.error = error;
    }
  };
}

/**
 * Finalize startup diagnostics
 */
export function finalizeStartupDiagnostics(): void {
  if (currentPhase) {
    endPhase(true);
  }
  
  if (diagnostics) {
    diagnostics.endTime = Date.now();
    diagnostics.totalDuration = diagnostics.endTime - diagnostics.startTime;
  }
}

/**
 * Get current diagnostics
 */
export function getStartupDiagnostics(): StartupDiagnostics | null {
  return diagnostics;
}

/**
 * Get diagnostics summary for logging
 */
export function getDiagnosticsSummary(): string {
  if (!diagnostics) {
    return 'No diagnostics available';
  }
  
  const summary: string[] = [];
  summary.push(`Total startup time: ${diagnostics.totalDuration || 0}ms`);
  summary.push(`Phases: ${diagnostics.phases.length}`);
  summary.push(`Module loads: ${diagnostics.moduleLoads.length}`);
  
  // List slow phases (>100ms)
  const slowPhases = diagnostics.phases.filter(p => (p.duration || 0) > 100);
  if (slowPhases.length > 0) {
    summary.push('Slow phases:');
    slowPhases.forEach(p => {
      summary.push(`  - ${p.phase}: ${p.duration}ms`);
    });
  }
  
  // List failed module loads
  const failedModules = diagnostics.moduleLoads.filter(m => !m.success);
  if (failedModules.length > 0) {
    summary.push('Failed module loads:');
    failedModules.forEach(m => {
      summary.push(`  - ${m.moduleName}: ${m.error || 'Unknown error'}`);
    });
  }
  
  return summary.join('\n');
}

/**
 * Export diagnostics to JSON for crash reports
 */
export function exportDiagnostics(): string {
  if (!diagnostics) {
    return JSON.stringify({ error: 'No diagnostics available' });
  }
  
  return JSON.stringify(diagnostics, null, 2);
}

/**
 * Clear diagnostics (useful for testing)
 */
export function clearDiagnostics(): void {
  diagnostics = null;
  currentPhase = null;
}

