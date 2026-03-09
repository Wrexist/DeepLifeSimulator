/**
 * Startup Performance Monitor
 *
 * Analyzes boot breadcrumbs to provide performance insights and identify bottlenecks.
 */

import { getBreadcrumbs } from './bootBreadcrumbs';
import { logger } from '@/utils/logger';

export interface PerformanceMetrics {
  totalStartupTime: number;
  stageBreakdown: Array<{
    stage: string;
    duration: number;
    percentage: number;
  }>;
  criticalPath: string[];
  bottlenecks: Array<{
    stage: string;
    duration: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  recommendations: string[];
}

export interface StageTimingThresholds {
  [stage: string]: number; // milliseconds
}

// Performance thresholds for different startup stages
const TIMING_THRESHOLDS: StageTimingThresholds = {
  'layout_init_start': 50,      // Basic setup should be fast
  'layout_error_handlers_setup': 10, // Error handlers are critical
  'layout_start': 100,          // Layout rendering
  'layout_providers_init': 200, // Provider initialization
  'first_screen_visible': 800,  // First frame should be under 1 second
  'layout_services_init': 500,  // Service initialization
  'app_ready': 1500,            // Total startup should be under 2 seconds
};

/**
 * Analyze startup performance from boot breadcrumbs
 */
export function analyzeStartupPerformance(): PerformanceMetrics | null {
  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  // Find start and end times
  const startTime = breadcrumbs[0]?.timestamp || 0;
  const endBreadcrumb = breadcrumbs.find(b => b.stage === 'app_ready');
  const endTime = endBreadcrumb?.timestamp || Date.now();

  const totalStartupTime = endTime - startTime;

  // Calculate stage durations
  const stageDurations: Array<{ stage: string; start: number; end: number; duration: number }> = [];

  for (let i = 0; i < breadcrumbs.length; i++) {
    const current = breadcrumbs[i];
    const next = breadcrumbs[i + 1];

    if (next) {
      stageDurations.push({
        stage: current.stage,
        start: current.timestamp,
        end: next.timestamp,
        duration: next.timestamp - current.timestamp,
      });
    } else {
      // Last stage duration to end
      stageDurations.push({
        stage: current.stage,
        start: current.timestamp,
        end: endTime,
        duration: endTime - current.timestamp,
      });
    }
  }

  // Create stage breakdown with percentages
  const stageBreakdown = stageDurations.map(stage => ({
    stage: stage.stage,
    duration: stage.duration,
    percentage: totalStartupTime > 0 ? (stage.duration / totalStartupTime) * 100 : 0,
  }));

  // Identify critical path (stages that took longest)
  const criticalPath = stageBreakdown
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 3)
    .map(s => s.stage);

  // Identify bottlenecks
  const bottlenecks = stageDurations
    .map(stage => {
      const threshold = TIMING_THRESHOLDS[stage.stage] || 500; // Default 500ms
      const exceeded = stage.duration - threshold;

      if (exceeded <= 0) return null;

      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (exceeded > threshold * 2) severity = 'critical';
      else if (exceeded > threshold * 1.5) severity = 'high';
      else if (exceeded > threshold * 1.2) severity = 'medium';

      return {
        stage: stage.stage,
        duration: stage.duration,
        threshold,
        severity,
      };
    })
    .filter(Boolean) as PerformanceMetrics['bottlenecks'];

  // Generate recommendations
  const recommendations: string[] = [];

  if (totalStartupTime > 2000) {
    recommendations.push('Total startup time exceeds 2 seconds - optimize critical path stages');
  }

  if (bottlenecks.length > 0) {
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      recommendations.push(`Critical bottlenecks detected: ${criticalBottlenecks.map(b => b.stage).join(', ')}`);
    }
  }

  const firstFrameTime = breadcrumbs.find(b => b.stage === 'first_screen_visible')?.elapsed || 0;
  if (firstFrameTime > 1000) {
    recommendations.push('First frame rendering is slow (>1s) - optimize initial layout and providers');
  }

  return {
    totalStartupTime,
    stageBreakdown,
    criticalPath,
    bottlenecks,
    recommendations,
  };
}

/**
 * Log performance analysis (development only)
 */
export function logPerformanceAnalysis(): void {
  if (!__DEV__) return;

  const metrics = analyzeStartupPerformance();
  if (!metrics) {
    logger.info('[Performance] No startup performance data available');
    return;
  }

  console.log('=== Startup Performance Analysis ===');
  console.log(`Total startup time: ${metrics.totalStartupTime}ms`);

  console.log('\nStage Breakdown:');
  metrics.stageBreakdown.forEach(stage => {
    console.log(`  ${stage.stage}: ${stage.duration}ms (${stage.percentage.toFixed(1)}%)`);
  });

  console.log(`\nCritical Path: ${metrics.criticalPath.join(' → ')}`);

  if (metrics.bottlenecks.length > 0) {
    console.log('\nBottlenecks:');
    metrics.bottlenecks.forEach(bottleneck => {
      console.log(`  ${bottleneck.stage}: ${bottleneck.duration}ms (threshold: ${bottleneck.threshold}ms) - ${bottleneck.severity.toUpperCase()}`);
    });
  }

  if (metrics.recommendations.length > 0) {
    console.log('\nRecommendations:');
    metrics.recommendations.forEach(rec => console.log(`  • ${rec}`));
  }

  console.log('=== End Performance Analysis ===');
}

/**
 * Get performance summary for crash reports
 */
export function getPerformanceSummary(): string {
  const metrics = analyzeStartupPerformance();
  if (!metrics) return 'No performance data available';

  const bottlenecks = metrics.bottlenecks.filter(b => b.severity === 'high' || b.severity === 'critical');
  const slowStages = bottlenecks.length > 0
    ? `Slow stages: ${bottlenecks.map(b => `${b.stage}(${b.duration}ms)`).join(', ')}`
    : 'All stages within acceptable limits';

  return `Startup: ${metrics.totalStartupTime}ms. ${slowStages}`;
}
