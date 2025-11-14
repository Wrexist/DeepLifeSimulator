/**
 * Launch validation system to ensure all systems are ready
 */

import React from 'react';

export interface LaunchCheck {
  id: string;
  name: string;
  category: 'technical' | 'content' | 'marketing' | 'legal';
  status: 'pending' | 'pass' | 'fail' | 'warning';
  message: string;
  required: boolean;
  details?: any;
}

export interface LaunchReport {
  overallStatus: 'ready' | 'not_ready' | 'warning';
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  criticalIssues: string[];
  recommendations: string[];
  checks: LaunchCheck[];
}

class LaunchValidator {
  private checks: LaunchCheck[] = [];

  /**
   * Run all launch validation checks
   */
  async validateLaunch(): Promise<LaunchReport> {
    this.checks = [];
    
    // Technical checks
    await this.checkTechnicalRequirements();
    
    // Content checks
    await this.checkContentRequirements();
    
    // Marketing checks
    await this.checkMarketingRequirements();
    
    // Legal checks
    await this.checkLegalRequirements();

    return this.generateReport();
  }

  /**
   * Technical requirements validation
   */
  private async checkTechnicalRequirements(): Promise<void> {
    // Check app performance
    this.addCheck({
      id: 'perf_load_time',
      name: 'App Load Time',
      category: 'technical',
      status: 'pending',
      message: 'Checking app load time...',
      required: true,
    });

    // Check memory usage
    this.addCheck({
      id: 'perf_memory',
      name: 'Memory Usage',
      category: 'technical',
      status: 'pending',
      message: 'Checking memory usage...',
      required: true,
    });

    // Check crash rate
    this.addCheck({
      id: 'perf_crashes',
      name: 'Crash Rate',
      category: 'technical',
      status: 'pending',
      message: 'Checking crash rate...',
      required: true,
    });

    // Check error handling
    this.addCheck({
      id: 'perf_errors',
      name: 'Error Handling',
      category: 'technical',
      status: 'pending',
      message: 'Checking error handling...',
      required: true,
    });

    // Check offline support
    this.addCheck({
      id: 'perf_offline',
      name: 'Offline Support',
      category: 'technical',
      status: 'pending',
      message: 'Checking offline support...',
      required: true,
    });

    // Check save system
    this.addCheck({
      id: 'perf_save',
      name: 'Save System',
      category: 'technical',
      status: 'pending',
      message: 'Checking save system...',
      required: true,
    });

    // Check IAP system
    this.addCheck({
      id: 'perf_iap',
      name: 'IAP System',
      category: 'technical',
      status: 'pending',
      message: 'Checking IAP system...',
      required: false,
    });
  }

  /**
   * Content requirements validation
   */
  private async checkContentRequirements(): Promise<void> {
    // Check game balance
    this.addCheck({
      id: 'content_balance',
      name: 'Game Balance',
      category: 'content',
      status: 'pending',
      message: 'Checking game balance...',
      required: true,
    });

    // Check tutorial system
    this.addCheck({
      id: 'content_tutorial',
      name: 'Tutorial System',
      category: 'content',
      status: 'pending',
      message: 'Checking tutorial system...',
      required: true,
    });

    // Check achievement system
    this.addCheck({
      id: 'content_achievements',
      name: 'Achievement System',
      category: 'content',
      status: 'pending',
      message: 'Checking achievement system...',
      required: true,
    });

    // Check localization
    this.addCheck({
      id: 'content_localization',
      name: 'Localization',
      category: 'content',
      status: 'pending',
      message: 'Checking localization...',
      required: false,
    });

    // Check content completeness
    this.addCheck({
      id: 'content_completeness',
      name: 'Content Completeness',
      category: 'content',
      status: 'pending',
      message: 'Checking content completeness...',
      required: true,
    });
  }

  /**
   * Marketing requirements validation
   */
  private async checkMarketingRequirements(): Promise<void> {
    // Check app store assets
    this.addCheck({
      id: 'marketing_assets',
      name: 'App Store Assets',
      category: 'marketing',
      status: 'pending',
      message: 'Checking app store assets...',
      required: true,
    });

    // Check ASO optimization
    this.addCheck({
      id: 'marketing_aso',
      name: 'ASO Optimization',
      category: 'marketing',
      status: 'pending',
      message: 'Checking ASO optimization...',
      required: true,
    });

    // Check social media presence
    this.addCheck({
      id: 'marketing_social',
      name: 'Social Media Presence',
      category: 'marketing',
      status: 'pending',
      message: 'Checking social media presence...',
      required: false,
    });

    // Check press kit
    this.addCheck({
      id: 'marketing_press',
      name: 'Press Kit',
      category: 'marketing',
      status: 'pending',
      message: 'Checking press kit...',
      required: false,
    });
  }

  /**
   * Legal requirements validation
   */
  private async checkLegalRequirements(): Promise<void> {
    // Check privacy policy
    this.addCheck({
      id: 'legal_privacy',
      name: 'Privacy Policy',
      category: 'legal',
      status: 'pending',
      message: 'Checking privacy policy...',
      required: true,
    });

    // Check terms of service
    this.addCheck({
      id: 'legal_terms',
      name: 'Terms of Service',
      category: 'legal',
      status: 'pending',
      message: 'Checking terms of service...',
      required: true,
    });

    // Check age rating
    this.addCheck({
      id: 'legal_age_rating',
      name: 'Age Rating',
      category: 'legal',
      status: 'pending',
      message: 'Checking age rating...',
      required: true,
    });

    // Check data collection compliance
    this.addCheck({
      id: 'legal_data_collection',
      name: 'Data Collection Compliance',
      category: 'legal',
      status: 'pending',
      message: 'Checking data collection compliance...',
      required: true,
    });
  }

  /**
   * Add a check to the validation list
   */
  private addCheck(check: LaunchCheck): void {
    this.checks.push(check);
  }

  /**
   * Update check status
   */
  updateCheckStatus(checkId: string, status: LaunchCheck['status'], message: string, details?: any): void {
    const check = this.checks.find(c => c.id === checkId);
    if (check) {
      check.status = status;
      check.message = message;
      if (details) {
        check.details = details;
      }
    }
  }

  /**
   * Generate launch report
   */
  private generateReport(): LaunchReport {
    const totalChecks = this.checks.length;
    const passedChecks = this.checks.filter(c => c.status === 'pass').length;
    const failedChecks = this.checks.filter(c => c.status === 'fail').length;
    const warningChecks = this.checks.filter(c => c.status === 'warning').length;

    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    // Identify critical issues
    this.checks.forEach(check => {
      if (check.status === 'fail' && check.required) {
        criticalIssues.push(`${check.name}: ${check.message}`);
      }
    });

    // Generate recommendations
    if (failedChecks > 0) {
      recommendations.push('Address all failed checks before launch');
    }
    if (warningChecks > 0) {
      recommendations.push('Review warning checks and address if possible');
    }
    if (passedChecks < totalChecks * 0.8) {
      recommendations.push('Consider delaying launch to address more issues');
    }

    // Determine overall status
    let overallStatus: LaunchReport['overallStatus'] = 'ready';
    if (criticalIssues.length > 0) {
      overallStatus = 'not_ready';
    } else if (warningChecks > 0 || failedChecks > 0) {
      overallStatus = 'warning';
    }

    return {
      overallStatus,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      criticalIssues,
      recommendations,
      checks: [...this.checks],
    };
  }

  /**
   * Get checks by category
   */
  getChecksByCategory(category: LaunchCheck['category']): LaunchCheck[] {
    return this.checks.filter(check => check.category === category);
  }

  /**
   * Get checks by status
   */
  getChecksByStatus(status: LaunchCheck['status']): LaunchCheck[] {
    return this.checks.filter(check => check.status === status);
  }

  /**
   * Get all checks
   */
  getAllChecks(): LaunchCheck[] {
    return [...this.checks];
  }

  /**
   * Clear all checks
   */
  clearChecks(): void {
    this.checks = [];
  }
}

export const launchValidator = new LaunchValidator();

/**
 * React hook for launch validation
 */
export function useLaunchValidator() {
  const [report, setReport] = React.useState<LaunchReport | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);

  const validateLaunch = React.useCallback(async () => {
    setIsValidating(true);
    try {
      const validationReport = await launchValidator.validateLaunch();
      setReport(validationReport);
    } catch (error) {
      console.error('Launch validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const updateCheckStatus = React.useCallback((
    checkId: string,
    status: LaunchCheck['status'],
    message: string,
    details?: any
  ) => {
    launchValidator.updateCheckStatus(checkId, status, message, details);
    // Re-generate report
    setReport(launchValidator.generateReport());
  }, []);

  return {
    report,
    isValidating,
    validateLaunch,
    updateCheckStatus,
    getChecksByCategory: launchValidator.getChecksByCategory.bind(launchValidator),
    getChecksByStatus: launchValidator.getChecksByStatus.bind(launchValidator),
  };
}
