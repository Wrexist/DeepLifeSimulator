import { uiPalette } from '@/lib/config/theme';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Share, Linking } from 'react-native';
// CRITICAL: Use fallback instead of direct expo-linear-gradient import to prevent crashes
import Gradient from '@/components/ui/Gradient';
import { RefreshCw, AlertTriangle, Home, Download, MessageCircle, FileText } from 'lucide-react-native';
import { logger } from '@/utils/logger';
import { remoteLogger } from '@/services/RemoteLoggingService';
import { validateGameEntry, validateSaveSlot } from '@/utils/gameEntryValidation';
import {
  validateGameState,
  readSaveSlot,
  decodePersistedSaveEnvelope,
  shouldAllowUnsignedLegacySaves,
} from '@/utils/saveValidation';
import { DISCORD_URL } from '@/lib/config/appConfig';
import { router } from 'expo-router';
const LinearGradient = Gradient;

/**
 * `readSaveSlot` returns the persisted ENVELOPE (`{v, data, checksum, hmac}`),
 * not a GameState. The crash context parsed the envelope directly, so every
 * report and exported log carried version/week/age as undefined. Decode first.
 * Throws when the save does not verify (callers already catch). (audit SAVE-6)
 */
function decodeSaveForContext(savedData: string): any {
  const decoded = decodePersistedSaveEnvelope(savedData, { allowLegacy: shouldAllowUnsignedLegacySaves() });
  if (!decoded.valid || typeof decoded.data !== 'string') {
    throw new Error(decoded.error || 'Save envelope verification failed');
  }
  return JSON.parse(decoded.data);
}

/** Legacy crash copies (see `checkSaveOnDisk`). Nothing ever read them. */
const LEGACY_ERROR_BACKUP_PREFIX = 'error_backup_';

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

  // Only ONE boundary presents the full-screen crash UI at a time. The app
  // nests boundaries (screen + modal + provider), and a cascading failure put
  // TWO full fallbacks on screen at once - overlapping, semi-transparent,
  // unreadable. Non-presenting erroring boundaries render null; when the
  // presenter recovers/unmounts, the next erroring boundary is promoted.
  private static erroringInstances = new Set<ErrorBoundary>();
  private static presentingInstance: ErrorBoundary | null = null;

  private static claimPresentation(instance: ErrorBoundary) {
    ErrorBoundary.erroringInstances.add(instance);
    if (ErrorBoundary.presentingInstance === null) {
      ErrorBoundary.presentingInstance = instance;
    } else if (ErrorBoundary.presentingInstance !== instance) {
      // A presenter already exists - repaint this one to null right away.
      // componentDidCatch runs in the commit phase (before the frame paints),
      // so the user never sees the second screen.
      instance.forceUpdate();
    }
  }

  private static releasePresentation(instance: ErrorBoundary) {
    ErrorBoundary.erroringInstances.delete(instance);
    if (ErrorBoundary.presentingInstance === instance) {
      const next = ErrorBoundary.erroringInstances.values().next();
      ErrorBoundary.presentingInstance = next.done ? null : next.value;
      ErrorBoundary.presentingInstance?.forceUpdate();
    }
  }

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  componentWillUnmount() {
    ErrorBoundary.releasePresentation(this);
  }

  // retryCount is deliberately NOT reset here. handleRetry owns it: it bumps the
  // count and clears hasError, and when the subtree throws again this runs. It
  // used to return `retryCount: 0`, so the cap never tripped and a
  // deterministic render crash looped "Try Again" forever. (audit SAVE-5)
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    ErrorBoundary.claimPresentation(this);

    // Categorize error
    const category = this.categorizeError(error);
    const recoverySuggestion = this.getRecoverySuggestion(category);

    // Is the player's last save intact on disk? (A render crash does not touch
    // it; this only decides whether we may truthfully say so.)
    let gameStateBackedUp = false;
    try {
      gameStateBackedUp = await this.checkSaveOnDisk();
    } catch (backupError) {
      logger.error('Failed to check the save on error:', backupError);
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
        return 'Try deleting old saves or freeing up device storage.';
      case 'progression':
        return 'Try restarting the app.';
      case 'network':
        return 'Check your internet connection. The app will work offline with local saves.';
      case 'ui':
        return 'Try navigating away and back, or restart the app.';
      default:
        return 'Try restarting the app. If the problem persists, please report this bug.';
    }
  }

  /**
   * Report whether the last slot holds a save that still verifies.
   *
   * This used to copy that save, byte for byte, into `error_backup_<ts>` on
   * every caught error. Nothing in the app ever read those keys back (no
   * restore UI, no loader), quota cleanup did not know about them, and a crash
   * loop wrote one per tap - up to five multi-MB copies of bytes that were
   * still sitting untouched in the slot's own double buffer and backup ring.
   * They are no longer written, and any left over are removed here.
   * (audit SAVE-7)
   */
  private async checkSaveOnDisk(): Promise<boolean> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const legacy = allKeys.filter((k: string) => k.startsWith(LEGACY_ERROR_BACKUP_PREFIX));
      if (legacy.length > 0) await AsyncStorage.multiRemove(legacy);
    } catch {
      // best-effort
    }
    try {
      const lastSlot = await AsyncStorage.getItem('lastSlot');
      if (!lastSlot) return false;
      const savedData = await readSaveSlot(parseInt(lastSlot, 10));
      return !!savedData;
    } catch (error) {
      logger.error('Failed to check the save on disk:', error);
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
        const savedData = await readSaveSlot(slotNumber);
        if (savedData) {
          try {
            const parsed = decodeSaveForContext(savedData);
            // Only include safe, non-sensitive data
            gameContext = {
              week: parsed.week,
              weeksLived: parsed.weeksLived,
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

    // Recorded in the in-app log (utils/logger -> RemoteLoggingService), which
    // is what Export Crash Log shares. There is no crash-reporting SDK: Sentry
    // was removed (CLAUDE.md 4.6), and the `require('@sentry/react-native')`
    // here could only ever fall through to this same log line.
    logger.error('ErrorBoundary crash report:', errorData);
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      ErrorBoundary.releasePresentation(this);
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
          const savedData = await readSaveSlot(slotNumber);
          if (savedData) {
            try {
              const parsed = decodeSaveForContext(savedData);
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

      // Nothing leaves the device from here (no crash-reporting SDK), so say
      // what actually happens: the report goes into the crash log the player
      // can export and share. It used to claim "We will investigate. Your
      // game state has been saved." while sending nothing. (audit SAVE-6)
      logger.error('User bug report:', bugReport);

      Alert.alert(
        'Bug Report',
        'Thanks! The details were added to your crash log. Tap Export Crash Log and share it in our Discord so we can look into it.'
      );
    }
  };

  private handleGoHome = () => {
    // Leave the screen that crashed. This used to clear the error state and
    // nothing else ("handled by the parent component" - nothing handled it), so
    // the same failing subtree re-mounted and threw again. The main menu sits
    // outside the game tabs, and Continue there reloads the life from its save.
    // (audit SAVE-5)
    ErrorBoundary.releasePresentation(this);
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
    // After the reset commits, so a boundary that wraps the navigator has its
    // children (and the router) mounted again before we navigate.
    setTimeout(() => {
      try {
        router.replace('/(onboarding)/MainMenu');
      } catch (navError) {
        logger.warn('ErrorBoundary could not navigate to the main menu', { error: navError });
      }
    }, 0);
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
        logger.warn('Failed to get logs from remoteLogger:', { error: logError });
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

          const savedData = await readSaveSlot(slotNumber);
          if (savedData) {
            try {
              const parsed = decodeSaveForContext(savedData);

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
Version: ${gameStateInfo.version || 'N/A'} ${gameStateInfo.version && gameStateInfo.version < 5 ? 'OLD VERSION' : ''}
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

      // Another boundary already presents the full crash screen - stay quiet.
      // (Claims happen in componentDidCatch, which only runs for COMMITTED
      // instances; claiming during render broke when React discarded and
      // re-instantiated throwing trees, leaving a stale claim.) This subtree
      // is broken anyway, and the presenter offers Try Again / Go Home.
      if (ErrorBoundary.presentingInstance && ErrorBoundary.presentingInstance !== this) {
        return null;
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
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconContainer}>
                <AlertTriangle size={48} color="#DC2626" />
              </View>

              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.subtitle}>
                We're sorry, but something unexpected happened.
                {this.state.gameStateBackedUp && '\n\nYour last save is safe on this device.'}
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
                  <RefreshCw size={20} color={uiPalette.white} />
                  <Text style={styles.buttonText}>
                    {this.state.retryCount >= this.maxRetries ? 'Max Retries' : 'Try Again'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.homeButton]}
                  onPress={this.handleGoHome}
                >
                  <Home size={20} color={uiPalette.white} />
                  <Text style={styles.buttonText}>Main Menu</Text>
                </TouchableOpacity>
              </View>

              {/* Bug Report & Discord Buttons */}
              <View style={styles.bugReportButtonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.exportButton]}
                  onPress={this.handleExportLog}
                >
                  <Download size={20} color={uiPalette.white} />
                  <Text style={styles.buttonText}>Export Crash Log</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.discordButton]}
                  onPress={this.handleOpenDiscord}
                >
                  <MessageCircle size={20} color={uiPalette.white} />
                  <Text style={styles.buttonText}>Join Discord</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helpText}>
                Export your crash log and share it in our Discord server to help us debug this issue!
              </Text>

              <Text style={styles.retryInfo}>
                Retry attempt: {this.state.retryCount + 1} of {this.maxRetries + 1}
              </Text>
            </ScrollView>
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
    // Explicit opaque bg: the gradient renders via the LinearGradient
    // fallback, and a transparent crash screen let broken content bleed
    // through from behind.
    backgroundColor: '#FEF2F2',
  },
  gradient: {
    flex: 1,
  },
  content: {
    // flexGrow (not flex) so tall content - dev stack traces, the report
    // cards - scrolls instead of overflowing off-screen.
    flexGrow: 1,
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
    color: uiPalette.lightMuted,
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
    color: uiPalette.white,
    fontSize: 16,
    fontWeight: '600',
  },
  retryInfo: {
    fontSize: 12,
    color: uiPalette.lightMuted,
    textAlign: 'center',
  },
  recoveryContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    // Plain full border, no side stripe (DEV.md Hard Rule 7).
    borderWidth: 1,
    borderColor: '#F59E0B',
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
    // Plain full border, no side stripe (DEV.md Hard Rule 7).
    borderWidth: 1,
    borderColor: '#3B82F6',
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
    color: uiPalette.lightMuted,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

export default ErrorBoundary;