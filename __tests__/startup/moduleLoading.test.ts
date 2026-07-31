/**
 * Module Loading Tests
 *
 * Covers the iOS compatibility checks and the TurboModule lazy-load wrapper —
 * both of which ship: `hooks/useFrameworkReady.ts` uses `turboModuleWrapper`,
 * which in turn uses `iosCompatibility`.
 *
 * The `Module Loader` / `Module Dependencies` / `Fallback System` /
 * `Error Handling` blocks are gone with `utils/moduleLoader.ts`. That module
 * was a 221-line safe-loading layer with its own dependency graph that NOTHING
 * shipped called — the app loads native modules with the `require()`-in-a-
 * try/catch idiom directly (CLAUDE.md §4.6). A suite named "Module Loading
 * Tests" asserting on it read as startup-crash coverage in a repo that has
 * shipped two launch crashes from module init, while covering none of it.
 * The dropped cases were shape-only (`toHaveProperty('success')`) and several
 * were wrapped in `if (!result.success)`, so they passed vacuously anyway.
 * 2026-07-30 audit PERF-5.
 */

import { isModuleCompatible, getIOSVersion, isIOS26Beta } from '@/utils/iosCompatibility';
import { lazyLoadTurboModule, getModuleStatus, isTurboModuleAvailable } from '@/utils/turboModuleWrapper';

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

});

