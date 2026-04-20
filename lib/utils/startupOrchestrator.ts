/**
 * Startup Orchestrator
 * 
 * Safely initializes optional systems after first frame renders.
 * Ensures no optional system can crash the app during cold start.
 * 
 * Features:
 * - Sequential initialization with timeouts
 * - Try/catch per subsystem (failures don't propagate)
 * - Cancellation support
 * - Progress tracking
 */

import { InteractionManager } from 'react-native';
import { markBootStage } from '@/lib/utils/bootBreadcrumbs';
import { logger } from '@/utils/logger';

export type StartupTask = {
  name: string;
  task: () => Promise<void> | void;
  timeout?: number; // Milliseconds, default 5000
  critical?: boolean; // If true, failure is logged as error; default false
};

class StartupOrchestrator {
  private tasks: StartupTask[] = [];
  private isRunning = false;
  private isCancelled = false;
  private currentTask: string | null = null;

  /**
   * Add a startup task
   */
  addTask(task: StartupTask): void {
    this.tasks.push(task);
  }

  /**
   * Run all tasks sequentially after first frame
   */
  async runAfterFirstFrame(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[StartupOrchestrator] Already running, skipping');
      return;
    }

    this.isRunning = true;
    this.isCancelled = false;

    // Wait for first frame to render
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        // Additional small delay to ensure first frame is fully painted
        setTimeout(resolve, 100);
      });
    });

    if (this.isCancelled) {
      logger.info('[StartupOrchestrator] Cancelled before starting');
      return;
    }

    markBootStage('layout_services_init');

    // Run tasks sequentially
    for (const task of this.tasks) {
      if (this.isCancelled) {
        logger.info('[StartupOrchestrator] Cancelled during execution');
        break;
      }

      await this.runTask(task);
    }

    this.isRunning = false;
    markBootStage('app_ready');
  }

  /**
   * Run a single task with timeout and error handling
   */
  private async runTask(task: StartupTask): Promise<void> {
    this.currentTask = task.name;
    const timeout = task.timeout ?? 5000;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task "${task.name}" timed out after ${timeout}ms`));
        }, timeout);
      });

      // Race task against timeout
      await Promise.race([
        Promise.resolve(task.task()),
        timeoutPromise,
      ]);

      if (__DEV__) {
        logger.info(`[StartupOrchestrator] Task "${task.name}" completed`);
      }
    } catch (error) {
      // CRITICAL: Never throw - log and continue
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (task.critical) {
        logger.error(`[StartupOrchestrator] Critical task "${task.name}" failed`, error, { taskName: task.name });
      } else {
        logger.warn(`[StartupOrchestrator] Task "${task.name}" failed (non-critical)`, { taskName: task.name, error: errorMessage });
      }

      // Continue to next task - failure doesn't stop startup
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Cancel startup orchestration
   */
  cancel(): void {
    this.isCancelled = true;
    logger.info('[StartupOrchestrator] Cancelled');
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    isCancelled: boolean;
    currentTask: string | null;
    tasksRemaining: number;
  } {
    return {
      isRunning: this.isRunning,
      isCancelled: this.isCancelled,
      currentTask: this.currentTask,
      tasksRemaining: this.tasks.length,
    };
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks = [];
    this.isRunning = false;
    this.isCancelled = false;
    this.currentTask = null;
  }
}

// Singleton instance
export const startupOrchestrator = new StartupOrchestrator();

/**
 * Safe wrapper for initializing a service
 * Returns a startup task that can be added to the orchestrator
 */
export function createSafeServiceTask(
  name: string,
  initFn: () => Promise<void> | void,
  options?: {
    timeout?: number;
    critical?: boolean;
    enabled?: boolean;
  }
): StartupTask | null {
  // Check if service is enabled
  if (options?.enabled === false) {
    return null;
  }

  return {
    name,
    task: async () => {
      try {
        await initFn();
      } catch (error) {
        // Error is caught by orchestrator, but log here for context
        if (__DEV__) {
          logger.warn(`[SafeServiceTask] ${name} initialization error`, { serviceName: name, error });
        }
        throw error; // Re-throw so orchestrator can handle it
      }
    },
    timeout: options?.timeout ?? 5000,
    critical: options?.critical ?? false,
  };
}

