import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react-native';
import { useRouter } from 'expo-router';

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging
    this.logError(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent || 'React Native',
      retryCount: this.state.retryCount,
    };

    // In production, send to crash reporting service
    if (!__DEV__) {
      // TODO: Send to crash reporting service (e.g., Sentry, Bugsnag)
      console.log('Error logged for crash reporting:', errorData);
    } else {
      console.error('Development error:', errorData);
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

  private handleReportBug = () => {
    const { error, errorInfo } = this.state;
    if (error) {
      const bugReport = {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
      };
      
      // TODO: Implement bug reporting system
      console.log('Bug report:', bugReport);
      Alert.alert('Bug Report', 'Thank you for reporting this issue. We will investigate.');
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
              </Text>
              
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
});

export default ErrorBoundary;