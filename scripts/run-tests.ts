/**
 * Test Runner Script
 * Run this script to execute comprehensive game tests
 * 
 * Usage:
 *   npx ts-node scripts/run-tests.ts
 *   or
 *   npm run test:comprehensive
 */

import { runComprehensiveTests, exportBugReportToFile } from '../lib/simulation/runComprehensiveTests';
import { logger } from '../utils/logger';

const log = logger.scope('TestScript');

async function main() {
  try {
    log.info('='.repeat(60));
    log.info('COMPREHENSIVE GAME TEST SUITE');
    log.info('='.repeat(60));
    log.info('');

    // Run comprehensive tests
    const report = await runComprehensiveTests();

    // Export to file
    await exportBugReportToFile(report, 'comprehensive-bug-report.json');

    // Exit with appropriate code
    if (report.failedTests > 0) {
      log.error(`\nTests completed with ${report.failedTests} failures.`);
      process.exit(1);
    } else {
      log.info('\nAll tests passed!');
      process.exit(0);
    }
  } catch (error: any) {
    log.error('Test runner failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };

