import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

interface PerformanceMetrics {
  timestamp: number;
  memoryUsage?: number;
  componentCount: number;
  renderTime: number;
  jsHeapSize?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100;
  private isMonitoring = false;
  private componentCount = 0;
  private renderStartTime = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startMemoryTracking();
    if (__DEV__) {
      logger.info('Performance monitoring started');
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (__DEV__) {
      logger.info('Performance monitoring stopped');
    }
  }

  private startMemoryTracking(): void {
    if (!this.isMonitoring) return;

    // Track memory usage every 5 seconds
    this.intervalId = setInterval(() => {
      this.recordMetrics();
    }, 5000);
  }

  recordMetrics(): void {
    if (!this.isMonitoring) return;

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      componentCount: this.componentCount,
      renderTime: this.renderStartTime > 0 ? Date.now() - this.renderStartTime : 0,
    };

    // Add platform-specific memory info
    if (Platform.OS === 'web' && (global as any).performance?.memory) {
      const memory = (global as any).performance.memory;
      metrics.jsHeapSize = memory.usedJSHeapSize;
      metrics.memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }

    this.metrics.push(metrics);

    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Check for potential memory leaks
    this.detectMemoryLeaks();
  }

  private detectMemoryLeaks(): void {
    if (this.metrics.length < 10) return;

    const recentMetrics = this.metrics.slice(-10);
    const componentGrowth = recentMetrics[recentMetrics.length - 1].componentCount - recentMetrics[0].componentCount;
    
    // Alert if component count is growing consistently
    if (componentGrowth > 5) {
      if (__DEV__) {
        logger.warn('Potential memory leak detected: Component count growing rapidly', {
          growth: componentGrowth,
          currentCount: recentMetrics[recentMetrics.length - 1].componentCount,
          timeSpan: recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp,
        });
      }
    }

    // Check for memory usage growth on web
    if (Platform.OS === 'web' && recentMetrics[0].jsHeapSize && recentMetrics[recentMetrics.length - 1].jsHeapSize) {
      const memoryGrowth = recentMetrics[recentMetrics.length - 1].jsHeapSize! - recentMetrics[0].jsHeapSize!;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);
      
      if (memoryGrowthMB > 10) { // 10MB growth threshold
        if (__DEV__) {
          logger.warn('Potential memory leak detected: Memory usage growing rapidly', {
            growthMB: memoryGrowthMB.toFixed(2),
            currentMB: (recentMetrics[recentMetrics.length - 1].jsHeapSize! / (1024 * 1024)).toFixed(2),
            timeSpan: recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp,
          });
        }
      }
    }
  }

  startRender(): void {
    this.renderStartTime = Date.now();
  }

  endRender(): void {
    if (this.renderStartTime > 0) {
      const renderTime = Date.now() - this.renderStartTime;
      if (renderTime > 16) { // 60fps threshold
        if (__DEV__) {
          logger.warn('Slow render detected:', { renderTime: renderTime + 'ms' });
        }
      }
      this.renderStartTime = 0;
    }
  }

  incrementComponentCount(): void {
    this.componentCount++;
  }

  decrementComponentCount(): void {
    this.componentCount = Math.max(0, this.componentCount - 1);
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getSummary(): {
    totalRecords: number;
    averageRenderTime: number;
    componentCount: number;
    memoryTrend: 'stable' | 'growing' | 'declining';
  } {
    if (this.metrics.length === 0) {
      return {
        totalRecords: 0,
        averageRenderTime: 0,
        componentCount: 0,
        memoryTrend: 'stable',
      };
    }

    const renderTimes = this.metrics
      .filter(m => m.renderTime > 0)
      .map(m => m.renderTime);
    
    const averageRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
      : 0;

    const memoryTrend = this.calculateMemoryTrend();

    return {
      totalRecords: this.metrics.length,
      averageRenderTime,
      componentCount: this.componentCount,
      memoryTrend,
    };
  }

  private calculateMemoryTrend(): 'stable' | 'growing' | 'declining' {
    if (this.metrics.length < 5 || Platform.OS !== 'web') return 'stable';

    const recentMetrics = this.metrics.slice(-5);
    const memorySizes = recentMetrics
      .filter(m => m.jsHeapSize)
      .map(m => m.jsHeapSize!);

    if (memorySizes.length < 3) return 'stable';

    const firstHalf = memorySizes.slice(0, Math.floor(memorySizes.length / 2));
    const secondHalf = memorySizes.slice(Math.floor(memorySizes.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, size) => sum + size, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, size) => sum + size, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% threshold

    if (difference > threshold) return 'growing';
    if (difference < -threshold) return 'declining';
    return 'stable';
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper functions
export const startPerformanceMonitoring = (): void => performanceMonitor.startMonitoring();
export const stopPerformanceMonitoring = (): void => performanceMonitor.stopMonitoring();
export const recordPerformanceMetrics = (): void => performanceMonitor.recordMetrics();
export const getPerformanceSummary = () => performanceMonitor.getSummary();
export const startRender = (): void => performanceMonitor.startRender();
export const endRender = (): void => performanceMonitor.endRender();
export const incrementComponentCount = (): void => performanceMonitor.incrementComponentCount();
export const decrementComponentCount = (): void => performanceMonitor.decrementComponentCount();
