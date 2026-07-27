/**
 * Module Loading Tests
 * 
 * Tests the module loading system including iOS compatibility checks, lazy loading, and fallbacks.
 */

import { isModuleCompatible, getIOSVersion, isIOS26Beta } from '@/utils/iosCompatibility';
import { lazyLoadTurboModule, getModuleStatus, isTurboModuleAvailable } from '@/utils/turboModuleWrapper';
import { loadModuleSafely, getModuleLoadingHealth } from '@/utils/moduleLoader';

describe('Module Loading System', () => {
  describe('iOS Compatibility', () => {
    it('should detect iOS version', () => {
      const version = getIOSVersion();
      if (version) {
        expect(version).toHaveProperty('major');
        expect(version).toHaveProperty('minor');
        expect(version).toHaveProperty('patch');
        expect(version).toHaveProperty('full');
        expect(version).toHaveProperty('isBeta');
      }
    });

    it('should identify iOS 26 beta', () => {
      const isBeta = isIOS26Beta();
      expect(typeof isBeta).toBe('boolean');
    });

    it('should check module compatibility', () => {
      const compatibility = isModuleCompatible('expo-splash-screen');
      expect(compatibility).toHaveProperty('compatible');
      expect(typeof compatibility.compatible).toBe('boolean');
    });

    it('should provide reason for incompatible modules', () => {
      const compatibility = isModuleCompatible('expo-splash-screen');
      if (!compatibility.compatible) {
        expect(compatibility).toHaveProperty('reason');
        expect(typeof compatibility.reason).toBe('string');
      }
    });
  });

  describe('TurboModule Wrapper', () => {
    it('should get module status', () => {
      const status = getModuleStatus('expo-splash-screen');
      expect(['loading', 'loaded', 'failed', 'unavailable', 'incompatible']).toContain(status);
    });

    it('should check module availability', () => {
      const available = isTurboModuleAvailable('expo-splash-screen');
      expect(typeof available).toBe('boolean');
    });

    it('should lazy load modules with compatibility check', async () => {
      const module = await lazyLoadTurboModule('expo-splash-screen', {
        timeout: 1000,
        fallback: null,
      });
      
      // Should return module or fallback (null)
      expect(module === null || typeof module === 'object').toBe(true);
    }, 5000);

    it('should handle incompatible modules gracefully', async () => {
      // Mock incompatible module
      const module = await lazyLoadTurboModule('expo-splash-screen', {
        skipCompatibilityCheck: false,
        fallback: null,
      });
      
      // Should return fallback if incompatible
      expect(module === null || typeof module === 'object').toBe(true);
    }, 5000);
  });

  describe('Module Loader', () => {
    it('should load modules safely', async () => {
      const result = await loadModuleSafely('expo-splash-screen', {
        fallback: null,
        required: false,
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('module');
      expect(result).toHaveProperty('skipped');
      expect(typeof result.success).toBe('boolean');
    }, 5000);

    it('should provide error information on failure', async () => {
      // A real fallback object, not `null`. With `null` the loader reaches the
      // "returned nothing" branch, which was already correct — the branch that
      // was wrong is the one a caller with an actual fallback takes, and that is
      // every real caller.
      const result = await loadModuleSafely('nonexistent-module', {
        fallback: { stub: true },
        required: false,
      });

      // Unconditional. These assertions used to sit inside `if (!result.success)`
      // on a call that always reported success — the loader handed back the
      // fallback and called it a load — so the test named "on failure" ran
      // nothing at all.
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.skipped).toBe(true);
    }, 5000);

    it('should get module loading health', () => {
      const health = getModuleLoadingHealth();
      
      expect(health).toHaveProperty('iosVersion');
      expect(health).toHaveProperty('isIOS26Beta');
      expect(health).toHaveProperty('criticalModules');
      
      expect(typeof health.isIOS26Beta).toBe('boolean');
      expect(typeof health.criticalModules).toBe('object');
    });
  });

  describe('Module Dependencies', () => {
    it('should handle module dependencies', async () => {
      // expo-router depends on react-native-gesture-handler and react-native-screens
      // These should be loaded first
      const result = await loadModuleSafely('expo-router', {
        fallback: null,
        required: false,
      });
      
      // Should handle dependencies automatically
      expect(result).toHaveProperty('success');
    }, 10000);
  });

  describe('Fallback System', () => {
    it('should return fallback for unavailable modules', async () => {
      const fallback = { test: 'fallback' };
      const result = await loadModuleSafely('nonexistent-module', {
        fallback,
        required: false,
      });

      expect(result.module).toBe(fallback);
      // THE INVARIANT THAT WAS BROKEN: holding the fallback is not success.
      // A caller checking `success` to decide whether the real native module is
      // present was being told yes while holding a stub, and the double guard
      // above meant no assertion in this file ever ran to notice.
      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
    }, 5000);
  });

  describe('Error Handling', () => {
    it('should handle load timeouts', async () => {
      const result = await loadModuleSafely('expo-splash-screen', {
        fallback: null,
        required: false,
      });
      
      // Should complete without throwing
      expect(result).toHaveProperty('success');
    }, 5000);

    it('should handle load errors gracefully', async () => {
      const result = await loadModuleSafely('invalid-module-name', {
        fallback: null,
        required: false,
      });
      
      // Should not throw, should return error result
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    }, 5000);
  });
});

