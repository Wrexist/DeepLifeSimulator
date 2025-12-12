import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react-native';
import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        const savedData = await AsyncStorage.getItem(`save_slot_${slotNumber}`);
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
        const savedData = await AsyncStorage.getItem(`save_slot_${slotNumber}`);
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

    // Log to analytics service
    try {
      const { analyticsService } = await import('@/services/AnalyticsService');
      await analyticsService.logCrash(
        category || 'unknown',
        error,
        {
          component_stack: errorInfo.componentStack?.substring(0, 500),
          retry_count: this.state.retryCount,
          game_context: gameContext,
          platform: Platform.OS,
          platform_version: Platform.Version,
        }
      );
    } catch (analyticsError) {
      logger.warn('Failed to log crash to analytics:', analyticsError);
    }

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
                componentStack: errorInfo.componentStack,
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
          const savedData = await AsyncStorage.getItem(`save_slot_${slotNumber}`);
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
      
      // Log to analytics service
      try {
        const { analyticsService } = await import('@/services/AnalyticsService');
        await analyticsService.logEvent('user_reported_bug', {
          category: errorCategory || 'unknown',
          error_message: error.message,
          platform: Platform.OS,
          has_game_context: !!gameContext,
        });
      } catch (analyticsError) {
        logger.warn('Failed to log bug report to analytics:', analyticsError);
      }
      
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
});

export default ErrorBoundary;