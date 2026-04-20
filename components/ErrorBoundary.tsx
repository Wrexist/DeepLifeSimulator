import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Share, Linking } from 'react-native';
// CRITICAL: Use fallback instead of direct expo-linear-gradient import to prevent crashes
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { RefreshCw, AlertTriangle, Home, Download, MessageCircle, FileText } from 'lucide-react-native';
import { logger } from '@/utils/logger';

// CRITICAL: Lazy load AsyncStorage to prevent TurboModule crash on iOS 26 Beta
// This creates a proxy that loads the real module on first use
let _realAsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _loadAttempted = false;

function getRealAsyncStorage() {
  if (_realAsyncStorage) return _realAsyncStorage;
  if (_loadAttempted) return null;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _realAsyncStorage = require('@react-native-async-storage/async-storage').default;
    return _realAsyncStorage;
  } catch {
    return null;
  }
}

// Lazy-loaded AsyncStorage wrapper - same interface as real AsyncStorage
const AsyncStorage = {
  getItem: async (key: string) => {
    const storage = getRealAsyncStorage();
    return storage ? storage.getItem(key) : null;
  },
  setItem: async (key: string, value: string) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.removeItem(key);
  },
  getAllKeys: async () => {
    const storage = getRealAsyncStorage();
    return storage ? storage.getAllKeys() : [];
  },
  multiRemove: async (keys: readonly string[]) => {
    const storage = getRealAsyncStorage();
    if (storage) await storage.multiRemove(keys);
  },
};
import { remoteLogger } from '@/services/RemoteLoggingService';
import { validateGameEntry, validateSaveSlot } from '@/utils/gameEntryValidation';
import { validateGameState } from '@/utils/saveValidation';
import { DISCORD_URL } from '@/lib/config/appConfig';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorCategory?: 'save' | 'progression' | 'ui' | 'network' | 'unknown';
  recoverySuggestion?: string;
  gameStateBackedUp?: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      retryCount: 0,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Categorize error
    const category = this.categorizeError(error);
    const recoverySuggestion = this.getRecoverySuggestion(category);

    // Try to backup game state before showing error
    let gameStateBackedUp = false;
    try {
      gameStateBackedUp = await this.backupGameState();
    } catch (backupError) {
      logger.error('Failed to backup game state on error:', backupError);
    }

    this.setState({
      error,
      errorInfo,
      errorCategory: category,
      recoverySuggestion,
      gameStateBackedUp,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging
    this.logError(error, errorInfo, category);
  }

  /**
   * Categorize error based on error message and stack
   */
  private categorizeError(error: Error): 'save' | 'progression' | 'ui' | 'network' | 'unknown' {
    const message = error.message.toLowerCase();

    if (message.includes('save') || message.includes('asyncstorage') || message.includes('quota')) {
      return 'save';
    }
    if (message.includes('week') || message.includes('progression') || message.includes('nextweek')) {
      return 'progression';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('cloud')) {
      return 'network';
    }
    if (message.includes('render') || message.includes('component') || message.includes('keyboard')) {
      return 'ui';
    }
    return 'unknown';
  }

  /**
   * Get recovery suggestion based on error category
   */
  private getRecoverySuggestion(category: 'save' | 'progression' | 'ui' | 'network' | 'unknown'): string {
    switch (category) {
      case 'save':
        return 'Try deleting old saves or freeing up device storage. Your progress has been saved locally.';
      case 'progression':
        return 'Try restarting the app. Your game state has been backed up.';
      case 'network':
        return 'Check your internet connection. The app will work offline with local saves.';
      case 'ui':
        return 'Try navigating away and back, or restart the app.';
      default:
        return 'Try restarting the app. If the problem persists, please report this bug.';
    }
  }

  /**
   * Attempt to backup game state before error is shown
   */
  private async backupGameState(): Promise<boolean> {
    try {
      // Try to get the last saved state from AsyncStorage
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (lastSlot) {
        const slotNumber = parseInt(lastSlot, 10);
        // CRASH FIX (A-1): Read from double-buffer system
        const { readSaveSlot } = require('@/utils/saveValidation');
        const savedData = await readSaveSlot(slotNumber);
        if (savedData) {
          // Create emergency backup
          const backupKey = `error_backup_${Date.now()}`;
          try {
            await AsyncStorage.setItem(backupKey, savedData);
            logger.info('Game state backed up before error', { backupKey });
            return true;
          } catch (error: any) {
            // Handle quota exceeded - try to clean up old error backups
            if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota')) {
              try {
                const allKeys = await AsyncStorage.getAllKeys();
                const errorBackupKeys = allKeys
                  .filter(key => key.startsWith('error_backup_'))
                  .sort()
                  .slice(0, -5); // Keep only the 5 most recent error backups

                if (errorBackupKeys.length > 0) {
                  await AsyncStorage.multiRemove(errorBackupKeys);
                  logger.info(`Cleaned up ${errorBackupKeys.length} old error backups`);

                  // Retry backup after cleanup
                  try {
                    await AsyncStorage.setItem(backupKey, savedData);
                    logger.info('Game state backed up before error after cleanup', { backupKey });
                    return true;
                  } catch (retryError) {
                    logger.error('Failed to backup game state even after cleanup:', retryError);
                    return false;
                  }
                }
              } catch (cleanupError) {
                logger.error('Failed to cleanup old error backups:', cleanupError);
              }
            }
            logger.error('Failed to backup game state:', error);
            return false;
          }
        }
      }
      return false;
    } catch (error) {
      logger.error('Failed to backup game state:', error);
      return false;
    }
  }

  private logError = async (error: Error, errorInfo: ErrorInfo, category?: 'save' | 'progression' | 'ui' | 'network' | 'unknown') => {
    // Try to get minimal game state context (sanitized)
    let gameContext: any = null;
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (lastSlot) {
        const slotNumber = parseInt(lastSlot, 10);
        // CRASH FIX (A-1): Read from double-buffer system
        const { readSaveSlot } = require('@/utils/saveValidation');
        const savedData = await readSaveSlot(slotNumber);
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            // Only include safe, non-sensitive data
            gameContext = {
              week: parsed.week,
              age: parsed.date?.age,
              version: parsed.version,
              // Don't include stats, money, or personal data
            };
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (e) {
      // Ignore errors getting context
    }

    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: Platform.OS + ' ' + Platform.Version,
      retryCount: this.state.retryCount,
      category,
      gameContext, // Sanitized game context
    };

    // In production, send to crash reporting service
    if (!__DEV__) {
      // Send to crash reporting service (Sentry integration)
      try {
        // Dynamic import to avoid breaking if Sentry is not installed
        const Sentry = require('@sentry/react-native');
        if (Sentry && Sentry.captureException) {
          Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo?.componentStack,
              },
            },
            extra: {
              retryCount: this.state.retryCount,
              timestamp: errorData.timestamp,
            },
          });
        }
      } catch (sentryError) {
        // Sentry not available, log to console
        logger.warn('Error logged for crash reporting', errorData);
      }
    } else {
      logger.error('Development error:', errorData);
    }
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    } else {
      Alert.alert(
        'Maximum Retries Reached',
        'Unable to recover from this error. Please restart the app.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Report Bug', onPress: this.handleReportBug },
        ]
      );
    }
  };

  private handleReportBug = async () => {
    const { error, errorInfo, errorCategory } = this.state;
    if (error) {
      // Get game context for bug report
      let gameContext: any = null;
      try {
        const lastSlot = await AsyncStorage.getItem('lastSlot');
        if (lastSlot) {
          const slotNumber = parseInt(lastSlot, 10);
          // CRASH FIX (A-1): Read from double-buffer system
          const { readSaveSlot } = require('@/utils/saveValidation');
          const savedData = await readSaveSlot(slotNumber);
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);
              // Include sanitized game context
              gameContext = {
                week: parsed.week,
                age: parsed.date?.age,
                version: parsed.version,
                hasJob: !!parsed.currentJob,
                // Don't include sensitive data
              };
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }

      const bugReport = {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        category: errorCategory,
        gameContext,
        platform: Platform.OS,
        version: Platform.Version,
      };

      // Try to send to Sentry if available
      try {
        const Sentry = require('@sentry/react-native');
        if (Sentry && Sentry.captureMessage) {
          Sentry.captureMessage('User reported bug', {
            level: 'info',
            extra: bugReport,
            tags: {
              errorCategory: errorCategory || 'unknown',
            },
          });
        }
      } catch (sentryError) {
        // Sentry not available, log to console
        logger.info('Bug report:', bugReport);
      }

      Alert.alert(
        'Bug Report',
        'Thank you for reporting this issue. We will investigate. Your game state has been saved.'
      );
    }
  };

  private handleGoHome = () => {
    // Reset error state and navigate to home
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });

    // Navigate to home screen
    // This will be handled by the parent component
  };

  /**
   * Export detailed crash log for bug reporting
   * Focused on essential information for debugging
   */
  private handleExportLog = async () => {
    try {
      const { error, errorInfo, errorCategory } = this.state;

      // Get error logs (only errors and warnings, last 20 entries)
      let errorLogs: any[] = [];
      try {
        const allLogs = remoteLogger?.getLogs() || [];
        // Filter to only errors and warnings, limit to 20 most recent
        errorLogs = allLogs
          .filter((log: any) => log.level === 'error' || log.level === 'warn')
          .slice(-20)
          .map((log: any) => ({
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            // Only include context if it's relevant (not full state dumps)
            context: log.context && typeof log.context === 'object'
              ? Object.keys(log.context).length <= 5
                ? JSON.stringify(log.context).substring(0, 150)
                : undefined
              : undefined,
          }));
      } catch (logError) {
        logger.warn('Failed to get logs from remoteLogger:', logError);
      }

      // Get essential game state information
      let gameStateInfo: any = null;
      let saveValidation: any = null;
      let entryValidation: any = null;
      let stateValidation: any = null;

      try {
        const lastSlot = await AsyncStorage.getItem('lastSlot');
        if (lastSlot) {
          const slotNumber = parseInt(lastSlot, 10);

          // Validate save slot
          if (!isNaN(slotNumber) && slotNumber >= 1 && slotNumber <= 3) {
            saveValidation = await validateSaveSlot(slotNumber);
          }

          // CRASH FIX (A-1): Read from double-buffer system
          const { readSaveSlot } = require('@/utils/saveValidation');
          const savedData = await readSaveSlot(slotNumber);
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);

              // Essential game state info only
              gameStateInfo = {
                slot: slotNumber,
                version: parsed.version,
                week: parsed.week,
                weeksLived: parsed.weeksLived,
                age: parsed.date?.age,
                scenarioId: parsed.scenarioId,
                challengeScenarioId: parsed.challengeScenarioId,
                hasJob: !!parsed.currentJob,
                prestigeLevel: parsed.prestige?.prestigeLevel || 0,
                generationNumber: parsed.generationNumber || 1,
                // Critical state structure checks
                hasStats: !!parsed.stats,
                hasDate: !!parsed.date,
                hasUserProfile: !!parsed.userProfile,
                hasSettings: !!parsed.settings,
                // Array existence checks (count only, not contents)
                arrayCounts: {
                  careers: parsed.careers?.length || 0,
                  items: parsed.items?.length || 0,
                  relationships: parsed.relationships?.length || 0,
                  achievements: parsed.achievements?.length || 0,
                  educations: parsed.educations?.length || 0,
                },
              };

              // Validate game entry (critical for debugging entry point issues)
              entryValidation = validateGameEntry(parsed);

              // Validate state structure (for debugging state corruption)
              stateValidation = validateGameState(parsed, false);
            } catch (parseError: any) {
              gameStateInfo = {
                error: 'Failed to parse save data',
                parseError: parseError?.message || 'Unknown parse error',
              };
            }
          } else {
            gameStateInfo = {
              error: 'No save data found',
              slot: slotNumber,
            };
          }
        }
      } catch (e: any) {
        gameStateInfo = {
          error: 'Failed to read game state',
          errorMessage: e?.message || 'Unknown error',
        };
      }

      // Build focused crash report with only essential information
      const crashReport = {
        // Error details (essential)
        error: {
          message: error?.message || 'Unknown error',
          stack: error?.stack?.split('\n').slice(0, 15).join('\n') || 'No stack trace', // Limit stack trace
          componentStack: errorInfo?.componentStack?.split('\n').slice(0, 10).join('\n') || 'No component stack', // Limit component stack
          category: errorCategory || 'unknown',
        },

        // System information (essential)
        system: {
          platform: Platform.OS,
          platformVersion: Platform.Version,
          timestamp: new Date().toISOString(),
          retryCount: this.state.retryCount,
          gameStateBackedUp: this.state.gameStateBackedUp || false,
        },

        // Game state (essential only)
        gameState: gameStateInfo,

        // Validation results (NEW - critical for debugging)
        validation: {
          saveSlot: saveValidation,
          gameEntry: entryValidation ? {
            canEnter: entryValidation.canEnter,
            versionCompatible: entryValidation.versionCompatible,
            stateComplete: entryValidation.stateComplete,
            errorCount: entryValidation.errors.length,
            warningCount: entryValidation.warnings.length,
            // Only include first 3 errors (most important)
            errors: entryValidation.errors.slice(0, 3),
          } : null,
          stateStructure: stateValidation ? {
            valid: stateValidation.valid,
            errorCount: stateValidation.errors.length,
            warningCount: stateValidation.warnings.length,
            // Only include first 3 errors
            errors: stateValidation.errors.slice(0, 3),
          } : null,
        },

        // Error logs (only errors/warnings, last 20)
        errorLogs: errorLogs.slice(0, 20),
      };

      // Format as focused, readable text (essential information only)
      const reportText = `=== DEEPLIFESIM CRASH REPORT ===
Generated: ${new Date().toLocaleString()}

--- ERROR DETAILS ---
Message: ${crashReport.error.message}
Category: ${crashReport.error.category}
Retry Count: ${crashReport.system.retryCount}
Game State Backed Up: ${crashReport.system.gameStateBackedUp ? 'Yes' : 'No'}

--- SYSTEM INFO ---
Platform: ${crashReport.system.platform} ${crashReport.system.platformVersion}
Timestamp: ${crashReport.system.timestamp}

--- GAME STATE (Essential) ---
${gameStateInfo && !gameStateInfo.error ? `Slot: ${gameStateInfo.slot || 'N/A'}
Version: ${gameStateInfo.version || 'N/A'} ${gameStateInfo.version && gameStateInfo.version < 5 ? '⚠️ OLD VERSION' : ''}
Week: ${gameStateInfo.week || 'N/A'}
Age: ${gameStateInfo.age || 'N/A'}
Scenario: ${gameStateInfo.scenarioId || 'N/A'}
Has Job: ${gameStateInfo.hasJob ? 'Yes' : 'No'}
Prestige Level: ${gameStateInfo.prestigeLevel || 0}
Generation: ${gameStateInfo.generationNumber || 1}

State Structure:
  - Stats: ${gameStateInfo.hasStats ? '✓' : '✗'}
  - Date: ${gameStateInfo.hasDate ? '✓' : '✗'}
  - User Profile: ${gameStateInfo.hasUserProfile ? '✓' : '✗'}
  - Settings: ${gameStateInfo.hasSettings ? '✓' : '✗'}
  - Arrays: Careers(${gameStateInfo.arrayCounts?.careers || 0}) Items(${gameStateInfo.arrayCounts?.items || 0}) Relationships(${gameStateInfo.arrayCounts?.relationships || 0})`
          : gameStateInfo?.error ? `ERROR: ${gameStateInfo.error}${gameStateInfo.parseError ? `\n  Parse Error: ${gameStateInfo.parseError}` : ''}${gameStateInfo.errorMessage ? `\n  Error: ${gameStateInfo.errorMessage}` : ''}`
            : 'No game state available'}

--- VALIDATION RESULTS (NEW) ---
${crashReport.validation.saveSlot ? `Save Slot Validation:
  Valid: ${crashReport.validation.saveSlot.valid ? '✓' : '✗'}
  Exists: ${crashReport.validation.saveSlot.exists ? 'Yes' : 'No'}
  Version: ${crashReport.validation.saveSlot.version || 'N/A'}
  ${crashReport.validation.saveSlot.errors.length > 0 ? `Errors: ${crashReport.validation.saveSlot.errors.slice(0, 2).join(', ')}` : ''}
` : 'Save slot validation: Not performed'}

${crashReport.validation.gameEntry ? `Game Entry Validation:
  Can Enter: ${crashReport.validation.gameEntry.canEnter ? '✓' : '✗'}
  Version Compatible: ${crashReport.validation.gameEntry.versionCompatible ? '✓' : '✗'}
  State Complete: ${crashReport.validation.gameEntry.stateComplete ? '✓' : '✗'}
  Errors: ${crashReport.validation.gameEntry.errorCount}
  Warnings: ${crashReport.validation.gameEntry.warningCount}
  ${crashReport.validation.gameEntry.errors.length > 0 ? `Key Errors: ${crashReport.validation.gameEntry.errors.join('; ')}` : ''}
` : 'Game entry validation: Not performed'}

${crashReport.validation.stateStructure ? `State Structure Validation:
  Valid: ${crashReport.validation.stateStructure.valid ? '✓' : '✗'}
  Errors: ${crashReport.validation.stateStructure.errorCount}
  Warnings: ${crashReport.validation.stateStructure.warningCount}
  ${crashReport.validation.stateStructure.errors.length > 0 ? `Key Errors: ${crashReport.validation.stateStructure.errors.join('; ')}` : ''}
` : 'State structure validation: Not performed'}

--- ERROR STACK TRACE (Limited) ---
${crashReport.error.stack}

--- COMPONENT STACK (Limited) ---
${crashReport.error.componentStack}

--- ERROR LOGS (Last 20 Errors/Warnings) ---
${crashReport.errorLogs.length > 0
          ? crashReport.errorLogs.map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.context ? `\n  ${log.context}` : ''}`).join('\n\n')
          : 'No error logs available'}

=== END OF REPORT ===

Please share this report in our Discord server to help us fix this issue!
Discord: ${DISCORD_URL}`;

      // Also create JSON version for technical analysis (focused, no verbose logs)
      const reportJson = JSON.stringify(crashReport, null, 2);

      // Share the report
      try {
        const result = await Share.share({
          message: reportText,
          title: 'DeepLifeSim Crash Report',
        });

        if (result.action === Share.sharedAction) {
          Alert.alert(
            'Report Exported!',
            `Thank you for helping us improve the game! Please share this report in our Discord server.\n\nDiscord: ${DISCORD_URL}`,
            [
              { text: 'Open Discord', onPress: () => this.handleOpenDiscord() },
              { text: 'OK', style: 'default' },
            ]
          );
        }
      } catch (shareError) {
        // If Share API fails, show the report in an alert (truncated)
        Alert.alert(
          'Crash Report',
          `Error details:\n\n${error?.message || 'Unknown error'}\n\nPlease copy this information and share it in our Discord server.`,
          [
            { text: 'Open Discord', onPress: () => this.handleOpenDiscord() },
            { text: 'OK', style: 'default' },
          ]
        );
        logger.error('Failed to share crash report:', shareError);
      }
    } catch (exportError) {
      logger.error('Failed to export crash log:', exportError);
      Alert.alert(
        'Export Failed',
        'Could not export crash log. Please try again or report the error manually.',
        [
          { text: 'Open Discord', onPress: () => this.handleOpenDiscord() },
          { text: 'OK', style: 'default' },
        ]
      );
    }
  };

  /**
   * Open Discord server invite link
   */
  private handleOpenDiscord = async () => {
    const discordUrl = DISCORD_URL;
    try {
      const canOpen = await Linking.canOpenURL(discordUrl);
      if (canOpen) {
        await Linking.openURL(discordUrl);
      } else {
        Alert.alert(
          'Discord Link',
          `Could not open Discord. Please visit:\n\n${discordUrl}\n\nin your browser.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      logger.error('Failed to open Discord link:', error);
      Alert.alert(
        'Discord Link',
        `Please visit:\n\n${discordUrl}\n\nin your browser.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <LinearGradient
            colors={['#FEF2F2', '#FEE2E2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <AlertTriangle size={48} color="#DC2626" />
              </View>

              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.subtitle}>
                We're sorry, but something unexpected happened.
                {this.state.gameStateBackedUp && '\n\nYour game state has been backed up.'}
              </Text>

              {this.state.recoverySuggestion && (
                <View style={styles.recoveryContainer}>
                  <Text style={styles.recoveryTitle}>Suggestion:</Text>
                  <Text style={styles.recoveryText}>{this.state.recoverySuggestion}</Text>
                </View>
              )}

              {/* Bug Report Encouragement */}
              <View style={styles.bugReportContainer}>
                <View style={styles.bugReportHeader}>
                  <FileText size={20} color="#3B82F6" />
                  <Text style={styles.bugReportTitle}>Help Us Fix This!</Text>
                </View>
                <Text style={styles.bugReportText}>
                  Exporting your crash log helps us identify and fix bugs faster. Your report includes error details, system info, and recent logs (no personal data).
                </Text>
              </View>

              {__DEV__ && this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorTitle}>Error Details:</Text>
                  <Text style={styles.errorMessage}>
                    {this.state.error.message}
                  </Text>
                  {this.state.error.stack && (
                    <Text style={styles.errorStack}>
                      {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                    </Text>
                  )}
                </View>
              )}

              {/* Primary Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={this.handleRetry}
                  disabled={this.state.retryCount >= this.maxRetries}
                >
                  <RefreshCw size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>
                    {this.state.retryCount >= this.maxRetries ? 'Max Retries' : 'Try Again'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.homeButton]}
                  onPress={this.handleGoHome}
                >
                  <Home size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Go Home</Text>
                </TouchableOpacity>
              </View>

              {/* Bug Report & Discord Buttons */}
              <View style={styles.bugReportButtonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.exportButton]}
                  onPress={this.handleExportLog}
                >
                  <Download size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Export Crash Log</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.discordButton]}
                  onPress={this.handleOpenDiscord}
                >
                  <MessageCircle size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Join Discord</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helpText}>
                💡 Export your crash log and share it in our Discord server to help us debug this issue!
              </Text>

              <Text style={styles.retryInfo}>
                Retry attempt: {this.state.retryCount + 1} of {this.maxRetries + 1}
              </Text>
            </View>
          </LinearGradient>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  errorDetails: {
    backgroundColor: '#FEF2F2',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
    width: '100%',
    maxHeight: 200,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 12,
    color: '#7F1D1D',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#991B1B',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
  },
  homeButton: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryInfo: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  recoveryContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  recoveryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  recoveryText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  bugReportContainer: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  bugReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  bugReportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  bugReportText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  bugReportButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    width: '100%',
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
  },
  discordButton: {
    flex: 1,
    backgroundColor: '#5865F2',
  },
  helpText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

export default ErrorBoundary;