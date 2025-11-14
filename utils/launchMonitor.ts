/**
 * Launch monitoring and analytics system
 */

import React from 'react';
import { Platform } from 'react-native';

export interface LaunchMetrics {
  timestamp: number;
  version: string;
  platform: string;
  deviceInfo: {
    model: string;
    osVersion: string;
    memory: number;
    storage: number;
  };
  performance: {
    loadTime: number;
    memoryUsage: number;
    crashRate: number;
    errorRate: number;
  };
  userEngagement: {
    sessionDuration: number;
    actionsPerSession: number;
    retentionRate: number;
    featureUsage: Record<string, number>;
  };
  business: {
    downloads: number;
    activeUsers: number;
    revenue: number;
    conversionRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'business' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  data?: any;
}

class LaunchMonitor {
  private metrics: LaunchMetrics[] = [];
  private alerts: Alert[] = [];
  private listeners: ((alert: Alert) => void)[] = [];
  private thresholds = {
    crashRate: 0.05, // 5%
    errorRate: 0.1, // 10%
    loadTime: 3000, // 3 seconds
    memoryUsage: 0.8, // 80%
    retentionRate: 0.3, // 30%
  };

  /**
   * Record launch metrics
   */
  recordMetrics(metrics: Partial<LaunchMetrics>): void {
    const fullMetrics: LaunchMetrics = {
      timestamp: Date.now(),
      version: '1.0.0',
      platform: Platform.OS,
      deviceInfo: {
        model: 'Unknown',
        osVersion: Platform.Version.toString(),
        memory: 0,
        storage: 0,
      },
      performance: {
        loadTime: 0,
        memoryUsage: 0,
        crashRate: 0,
        errorRate: 0,
      },
      userEngagement: {
        sessionDuration: 0,
        actionsPerSession: 0,
        retentionRate: 0,
        featureUsage: {},
      },
      business: {
        downloads: 0,
        activeUsers: 0,
        revenue: 0,
        conversionRate: 0,
      },
      ...metrics,
    };

    this.metrics.push(fullMetrics);
    this.checkThresholds(fullMetrics);
  }

  /**
   * Check metrics against thresholds and create alerts
   */
  private checkThresholds(metrics: LaunchMetrics): void {
    const { performance, userEngagement, business } = metrics;

    // Check crash rate
    if (performance.crashRate > this.thresholds.crashRate) {
      this.createAlert({
        type: 'performance',
        severity: 'high',
        title: 'High Crash Rate Detected',
        message: `Crash rate is ${(performance.crashRate * 100).toFixed(1)}%, exceeding threshold of ${(this.thresholds.crashRate * 100).toFixed(1)}%`,
        data: { crashRate: performance.crashRate },
      });
    }

    // Check error rate
    if (performance.errorRate > this.thresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'medium',
        title: 'High Error Rate Detected',
        message: `Error rate is ${(performance.errorRate * 100).toFixed(1)}%, exceeding threshold of ${(this.thresholds.errorRate * 100).toFixed(1)}%`,
        data: { errorRate: performance.errorRate },
      });
    }

    // Check load time
    if (performance.loadTime > this.thresholds.loadTime) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        title: 'Slow Load Time Detected',
        message: `Load time is ${performance.loadTime}ms, exceeding threshold of ${this.thresholds.loadTime}ms`,
        data: { loadTime: performance.loadTime },
      });
    }

    // Check memory usage
    if (performance.memoryUsage > this.thresholds.memoryUsage) {
      this.createAlert({
        type: 'performance',
        severity: 'high',
        title: 'High Memory Usage Detected',
        message: `Memory usage is ${(performance.memoryUsage * 100).toFixed(1)}%, exceeding threshold of ${(this.thresholds.memoryUsage * 100).toFixed(1)}%`,
        data: { memoryUsage: performance.memoryUsage },
      });
    }

    // Check retention rate
    if (userEngagement.retentionRate < this.thresholds.retentionRate) {
      this.createAlert({
        type: 'business',
        severity: 'medium',
        title: 'Low Retention Rate Detected',
        message: `Retention rate is ${(userEngagement.retentionRate * 100).toFixed(1)}%, below threshold of ${(this.thresholds.retentionRate * 100).toFixed(1)}%`,
        data: { retentionRate: userEngagement.retentionRate },
      });
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.notifyListeners(alert);
    this.logAlert(alert);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Get unresolved alerts
   */
  getUnresolvedAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: Alert['type']): Alert[] {
    return this.alerts.filter(alert => alert.type === type);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: Alert['severity']): Alert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Get launch metrics
   */
  getMetrics(): LaunchMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(): LaunchMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    totalSessions: number;
    averageLoadTime: number;
    averageCrashRate: number;
    averageErrorRate: number;
    averageRetentionRate: number;
    totalRevenue: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalSessions: 0,
        averageLoadTime: 0,
        averageCrashRate: 0,
        averageErrorRate: 0,
        averageRetentionRate: 0,
        totalRevenue: 0,
      };
    }

    const totalSessions = this.metrics.length;
    const averageLoadTime = this.metrics.reduce((sum, m) => sum + m.performance.loadTime, 0) / totalSessions;
    const averageCrashRate = this.metrics.reduce((sum, m) => sum + m.performance.crashRate, 0) / totalSessions;
    const averageErrorRate = this.metrics.reduce((sum, m) => sum + m.performance.errorRate, 0) / totalSessions;
    const averageRetentionRate = this.metrics.reduce((sum, m) => sum + m.userEngagement.retentionRate, 0) / totalSessions;
    const totalRevenue = this.metrics.reduce((sum, m) => sum + m.business.revenue, 0);

    return {
      totalSessions,
      averageLoadTime,
      averageCrashRate,
      averageErrorRate,
      averageRetentionRate,
      totalRevenue,
    };
  }

  /**
   * Add alert listener
   */
  addAlertListener(listener: (alert: Alert) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      alerts: this.alerts,
      thresholds: this.thresholds,
    }, null, 2);
  }

  /**
   * Clear all data
   */
  clearData(): void {
    this.metrics = [];
    this.alerts = [];
  }

  private notifyListeners(alert: Alert): void {
    this.listeners.forEach(listener => listener(alert));
  }

  private logAlert(alert: Alert): void {
    console.log('Launch Monitor Alert:', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      timestamp: new Date(alert.timestamp).toISOString(),
    });
  }
}

export const launchMonitor = new LaunchMonitor();

/**
 * React hook for launch monitoring
 */
export function useLaunchMonitor() {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [metrics, setMetrics] = React.useState<LaunchMetrics[]>([]);

  React.useEffect(() => {
    const unsubscribe = launchMonitor.addAlertListener((alert) => {
      setAlerts(prev => [...prev, alert]);
    });

    // Initial load
    setAlerts(launchMonitor.getAlerts());
    setMetrics(launchMonitor.getMetrics());

    return unsubscribe;
  }, []);

  return {
    alerts,
    metrics,
    recordMetrics: launchMonitor.recordMetrics.bind(launchMonitor),
    resolveAlert: launchMonitor.resolveAlert.bind(launchMonitor),
    getMetricsSummary: launchMonitor.getMetricsSummary.bind(launchMonitor),
  };
}
