/**
 * Native Module Audit Utility
 * 
 * Discovers and audits all TurboModules linked in the app.
 * Helps identify which modules might be causing crashes.
 */

import { NativeModules } from 'react-native';
import { getIOSVersion, isIOS26Beta, getCompatibilityReport } from './iosCompatibility';
import { getAllModuleStatuses } from './turboModuleWrapper';

export interface ModuleAuditResult {
  moduleName: string;
  isLinked: boolean;
  isTurboModule: boolean;
  status: 'available' | 'unavailable' | 'error' | 'unknown';
  error?: string;
  iosCompatible?: boolean;
  compatibilityReason?: string;
}

/**
 * List of known TurboModules in the app
 */
const KNOWN_TURBOMODULES = [
  'expo-splash-screen',
  'expo-status-bar',
  'expo-haptics',
  'expo-clipboard',
  'expo-constants',
  'expo-linear-gradient',
  '@react-native-community/netinfo',
  'react-native-gesture-handler',
  'react-native-screens',
  // Core React Native modules (always available)
  'ExceptionsManager',
  'PlatformConstants',
  'UIManager',
];

/**
 * Check if a module is linked in NativeModules
 */
function isModuleLinked(moduleName: string): boolean {
  try {
    // Check if module exists in NativeModules
    return moduleName in NativeModules && NativeModules[moduleName] !== null;
  } catch {
    return false;
  }
}

/**
 * Check if a module is a TurboModule
 * TurboModules typically have specific methods or properties
 */
function isTurboModule(moduleName: string): boolean {
  try {
    const module = NativeModules[moduleName];
    if (!module) return false;
    
    // TurboModules often have these characteristics:
    // - They're objects (not null/undefined)
    // - They may have methods
    // - They're not simple primitives
    return typeof module === 'object' && module !== null;
  } catch {
    return false;
  }
}

/**
 * Audit a single module
 */
export function auditModule(moduleName: string): ModuleAuditResult {
  const result: ModuleAuditResult = {
    moduleName,
    isLinked: false,
    isTurboModule: false,
    status: 'unknown',
  };

  try {
    result.isLinked = isModuleLinked(moduleName);
    result.isTurboModule = result.isLinked && isTurboModule(moduleName);
    
    if (result.isLinked) {
      result.status = 'available';
    } else {
      result.status = 'unavailable';
    }

    // Check iOS compatibility
    const compatibility = getCompatibilityReport()[moduleName];
    if (compatibility) {
      result.iosCompatible = compatibility.compatible;
      result.compatibilityReason = compatibility.reason;
    }
  } catch (error) {
    result.status = 'error';
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Audit all known modules
 */
export function auditAllModules(): ModuleAuditResult[] {
  const results: ModuleAuditResult[] = [];
  
  // Audit known TurboModules
  KNOWN_TURBOMODULES.forEach((moduleName) => {
    results.push(auditModule(moduleName));
  });
  
  // Also audit any other modules found in NativeModules
  try {
    Object.keys(NativeModules).forEach((moduleName) => {
      // Skip if already audited
      if (!KNOWN_TURBOMODULES.includes(moduleName)) {
        results.push(auditModule(moduleName));
      }
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[Module Audit] Failed to enumerate NativeModules:', error);
    }
  }
  
  return results;
}

/**
 * Get comprehensive audit report
 */
export function getAuditReport(): {
  iosVersion: ReturnType<typeof getIOSVersion>;
  isIOS26Beta: boolean;
  modules: ModuleAuditResult[];
  moduleStatuses: ReturnType<typeof getAllModuleStatuses>;
  compatibilityReport: ReturnType<typeof getCompatibilityReport>;
  summary: {
    total: number;
    linked: number;
    turboModules: number;
    compatible: number;
    incompatible: number;
    unavailable: number;
    errors: number;
  };
} {
  const modules = auditAllModules();
  const iosVersion = getIOSVersion();
  const moduleStatuses = getAllModuleStatuses();
  const compatibilityReport = getCompatibilityReport();
  
  const summary = {
    total: modules.length,
    linked: modules.filter((m) => m.isLinked).length,
    turboModules: modules.filter((m) => m.isTurboModule).length,
    compatible: modules.filter((m) => m.iosCompatible === true).length,
    incompatible: modules.filter((m) => m.iosCompatible === false).length,
    unavailable: modules.filter((m) => m.status === 'unavailable').length,
    errors: modules.filter((m) => m.status === 'error').length,
  };
  
  return {
    iosVersion,
    isIOS26Beta: isIOS26Beta(),
    modules,
    moduleStatuses,
    compatibilityReport,
    summary,
  };
}

/**
 * Log audit report to console (dev only)
 */
export function logAuditReport(): void {
  if (!__DEV__) return;
  
  const report = getAuditReport();
  
  console.log('=== Native Module Audit Report ===');
  console.log(`iOS Version: ${report.iosVersion?.full || 'Unknown'}`);
  console.log(`iOS 26 Beta: ${report.isIOS26Beta ? 'Yes' : 'No'}`);
  console.log('\nSummary:');
  console.log(`  Total modules: ${report.summary.total}`);
  console.log(`  Linked: ${report.summary.linked}`);
  console.log(`  TurboModules: ${report.summary.turboModules}`);
  console.log(`  Compatible: ${report.summary.compatible}`);
  console.log(`  Incompatible: ${report.summary.incompatible}`);
  console.log(`  Unavailable: ${report.summary.unavailable}`);
  console.log(`  Errors: ${report.summary.errors}`);
  
  console.log('\nModule Details:');
  report.modules.forEach((module) => {
    console.log(`  ${module.moduleName}:`);
    console.log(`    Linked: ${module.isLinked}`);
    console.log(`    TurboModule: ${module.isTurboModule}`);
    console.log(`    Status: ${module.status}`);
    if (module.iosCompatible !== undefined) {
      console.log(`    iOS Compatible: ${module.iosCompatible}`);
    }
    if (module.compatibilityReason) {
      console.log(`    Reason: ${module.compatibilityReason}`);
    }
    if (module.error) {
      console.log(`    Error: ${module.error}`);
    }
  });
  
  console.log('=== End Audit Report ===');
}

