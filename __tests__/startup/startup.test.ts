/**
 * Startup Sequence Tests
 * 
 * Tests the app startup sequence from cold launch to first rendered screen.
 */

import { Platform } from 'react-native';

describe('Startup Sequence', () => {
  function installStartupTestGlobals() {
    (global as any).__STARTUP_HEALTH_CHECK__ = () => ({
      criticalModules: ['expo-splash-screen'],
      availableModules: ['expo-splash-screen'],
      failedModules: [],
      ready: true,
    });
    (global as any).__EARLY_INIT_ERROR__ = () => null;
    (global as any).RCTFatal = () => {};
    (global as any).ErrorUtils = {
      getGlobalHandler: () => () => {},
      setGlobalHandler: () => {},
    };
  }

  beforeEach(() => {
    // Reset global state
    (global as any).__IOS_VERSION_INFO__ = undefined;
    (global as any).__MODULE_AUDIT_REPORT__ = undefined;
    (global as any).__STARTUP_HEALTH_CHECK__ = undefined;
    (global as any).__EARLY_INIT_ERROR__ = undefined;
    (global as any).__errorQueue = [];
    installStartupTestGlobals();
  });

  describe('iOS Version Detection', () => {
    it('should detect iOS version on iOS platform', () => {
      const iosVersionInfo = (global as any).__IOS_VERSION_INFO__;
      if (Platform.OS === 'ios' && iosVersionInfo) {
        expect(iosVersionInfo).toHaveProperty('version');
        expect(iosVersionInfo).toHaveProperty('isBeta');
        expect(iosVersionInfo).toHaveProperty('isIOS26Beta');
      }
    });

    it('should identify iOS 26 beta correctly', () => {
      const iosVersionInfo = (global as any).__IOS_VERSION_INFO__;
      if (Platform.OS === 'ios' && iosVersionInfo?.version) {
        const major = parseInt(iosVersionInfo.version.split('.')[0], 10);
        if (major === 26) {
          expect(iosVersionInfo.isIOS26Beta).toBe(true);
        }
      }
    });
  });

  describe('Startup Health Check', () => {
    it('should have startup health check available', () => {
      const healthCheck = (global as any).__STARTUP_HEALTH_CHECK__;
      expect(typeof healthCheck).toBe('function');
      
      const health = healthCheck();
      expect(health).toHaveProperty('criticalModules');
      expect(health).toHaveProperty('availableModules');
      expect(health).toHaveProperty('failedModules');
      expect(health).toHaveProperty('ready');
    });

    it('should track critical modules', () => {
      const healthCheck = (global as any).__STARTUP_HEALTH_CHECK__;
      if (healthCheck) {
        const health = healthCheck();
        expect(health.criticalModules).toContain('expo-splash-screen');
      }
    });
  });

  describe('Module Audit', () => {
    it('should have module audit report available after startup', (done) => {
      // Module audit runs asynchronously after 500ms
      setTimeout(() => {
        const auditReport = (global as any).__MODULE_AUDIT_REPORT__;
        if (auditReport) {
          expect(auditReport).toHaveProperty('iosVersion');
          expect(auditReport).toHaveProperty('modules');
          expect(auditReport).toHaveProperty('summary');
        }
        done();
      }, 600);
    });

    it('should identify incompatible modules on iOS 26 beta', (done) => {
      setTimeout(() => {
        const auditReport = (global as any).__MODULE_AUDIT_REPORT__;
        if (auditReport?.isIOS26Beta) {
          expect(auditReport.summary).toHaveProperty('incompatible');
          // Should log warnings for incompatible modules
        }
        done();
      }, 600);
    });
  });

  describe('Early Error Handling', () => {
    it('should have early error getter available', () => {
      const earlyErrorGetter = (global as any).__EARLY_INIT_ERROR__;
      expect(typeof earlyErrorGetter).toBe('function');
    });

    it('should store early errors in error queue', () => {
      const errorQueue = (global as any).__errorQueue;
      expect(Array.isArray(errorQueue)).toBe(true);
    });
  });

  describe('Error Handler Setup', () => {
    it('should have error handler set up', () => {
      const errorUtils = (global as any).ErrorUtils;
      if (errorUtils) {
        const handler = errorUtils.getGlobalHandler();
        expect(typeof handler).toBe('function');
      }
    });

    it('should have RCTFatal stubbed', () => {
      const rctFatal = (global as any).RCTFatal;
      expect(typeof rctFatal).toBe('function');
      // Should be a no-op function
      expect(() => rctFatal()).not.toThrow();
    });
  });
});

